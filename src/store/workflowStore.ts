import { create } from 'zustand';
import {
  WorkflowStep,
  WorkflowOptions,
  Scene,
  SceneSearchState,
  ScriptAnalysisStatus,
  ExportState,
  ClipDownloadStatus,
  VoiceSegmentState,
  CandidateLabel,
  VoiceProvider,
  ImageSearchState,
  BulkWorkflowStatus,
} from '../types';
import {
  loadSettings,
  DEFAULT_AI33PRO_SETTINGS,
} from '../storage/settingsStorage';
import { analyzeScriptWithGemini, GeminiAnalysisError } from '../services/gemini';
import { searchClipsForScene, searchImagesForScene, PexelsApiError } from '../services/pexels';
import {
  validateScriptInput,
  estimateDurationSeconds,
  DEFAULT_SAMPLE_SCRIPT,
} from '../utils/textUtils';
import { selectBestMp4Variant } from '../services/variantSelector';
import { downloadClipsWithConcurrency, downloadClipBlob } from '../services/downloader';
import {
  buildZipPackage,
  triggerBrowserDownload,
  revokeBlobUrl,
} from '../services/zipBuilder';
import {
  getMp4Filename,
  getMp3Filename,
  getImageFilename,
  generateScriptSegmentsText,
} from '../utils/filenames';
import {
  generateManifestCsv,
  generateCreditsText,
  ManifestEntry,
  CreditsEntry,
} from '../utils/manifest';
import { getVoiceAdapter } from '../services/voiceAdapter';
import {
  createSourceTextFingerprint,
  createSettingsFingerprint,
} from '../utils/fingerprints';

export type WorkflowState = {
  step: WorkflowStep;
  status: ScriptAnalysisStatus;
  script: string;
  options: WorkflowOptions;
  scenes: Scene[];
  searchStateByScene: Record<string, SceneSearchState>;
  /** Image search state per scene (only populated when stockMediaType includes images). */
  imageSearchStateByScene: Record<string, ImageSearchState>;
  /** User-selected video candidate IDs per scene (default: all 6 candidates). */
  selectedVideoClipIdsByScene: Record<string, string[]>;
  /** User-selected photo IDs per scene for images (default: all image candidates). */
  selectedImageIdsByScene: Record<string, number[]>;
  excludedSceneIds: string[];
  error: string | null;

  // Active controller for cancelling in-flight Gemini requests
  activeAbortController: AbortController | null;

  // Feature 5 voice generation state
  voiceStateByScene: Record<string, VoiceSegmentState>;
  isVoiceBatchRunning: boolean;

  // Feature 4 export state and controller
  exportState: ExportState | null;
  activeDownloadController: AbortController | null;

  /** Bulk Gemini automated workflow status. */
  bulkWorkflowStatus: BulkWorkflowStatus;

  // Actions
  initializeFromSettings: () => void;
  setScript: (script: string) => void;
  setOptions: (options: Partial<WorkflowOptions>) => void;
  setStep: (step: WorkflowStep) => void;
  analyzeScript: (geminiApiKey: string) => Promise<void>;
  cancelAnalysis: () => void;
  editScene: (id: string, updates: Partial<Omit<Scene, 'id' | 'sequence'>>) => boolean;
  splitScene: (
    id: string,
    firstText: string,
    secondText: string,
    firstDescription?: string,
    secondDescription?: string,
    firstQuery?: string,
    secondQuery?: string
  ) => boolean;
  mergeScenes: (firstId: string, secondId: string) => boolean;
  deleteScene: (id: string) => boolean;
  reorderScene: (id: string, direction: 'up' | 'down') => boolean;
  startOver: () => void;
  proceedToVoices: () => boolean;
  proceedToClips: () => boolean;

  // Feature 5 voice actions
  switchVoiceProvider: (provider: VoiceProvider) => void;
  generateAllVoices: (apiKey: string) => Promise<void>;
  generateSceneVoice: (sceneId: string, apiKey: string, isRegeneration?: boolean) => Promise<void>;
  retryFailedVoices: (apiKey: string) => Promise<void>;
  cancelVoiceGeneration: () => void;

  // Feature 3 actions
  searchAllScenes: (pexelsApiKey: string) => Promise<void>;
  searchScene: (sceneId: string, pexelsApiKey: string, customQuery?: string) => Promise<void>;
  /** Search Pexels Photos (images) for all scenes. */
  searchAllImages: (pexelsApiKey: string) => Promise<void>;
  /** Search Pexels Photos (images) for a single scene. */
  searchSceneImages: (sceneId: string, pexelsApiKey: string, customQuery?: string) => Promise<void>;
  selectCandidate: (sceneId: string, candidateId: string) => void;
  toggleVideoClipSelection: (sceneId: string, candidateId: string) => void;
  toggleImageSelection: (sceneId: string, photoId: number) => void;
  selectAllVideoClips: (sceneId: string) => void;
  deselectAllVideoClips: (sceneId: string) => void;
  selectAllImages: (sceneId: string) => void;
  deselectAllImages: (sceneId: string) => void;
  excludeScene: (sceneId: string) => void;
  restoreScene: (sceneId: string) => void;
  canProceedToPackaging: () => boolean;
  proceedToPackaging: () => boolean;

  // Feature 4 actions
  startExport: () => Promise<void>;
  cancelExport: () => void;
  retryClipDownload: (sceneId: string, candidateLabel?: CandidateLabel) => Promise<void>;
  downloadZipFile: () => void;

  // Bulk Gemini Nano automated workflow
  runBulkWorkflow: (geminiKey: string, voiceKey: string, pexelsKey: string) => Promise<void>;
  cancelBulkWorkflow: () => void;
};

/**
 * Ensures sequence numbers are strictly 1..N matching array index.
 */
function renumberScenes(scenes: Scene[]): Scene[] {
  return scenes.map((scene, index) => ({
    ...scene,
    sequence: index + 1,
  }));
}

/**
 * Generates a unique client-side ID for new scenes.
 */
function createSceneId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `scene-${crypto.randomUUID()}`;
  }
  return `scene-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * In-memory cache for downloaded video blobs during the active export process.
 * Never persisted to localStorage, sessionStorage, or IndexedDB.
 * Cleared on cancellation, startOver, or successful archive creation.
 */
const clipBlobsCache = new Map<string, Blob>();

/**
 * Active AbortControllers for per-scene ElevenLabs requests.
 */
const activeVoiceControllers = new Map<string, AbortController>();

function getDefaultOptions(): WorkflowOptions {
  const saved = loadSettings();
  return {
    orientation: saved.defaultOrientation,
    quality: saved.defaultQuality,
    sceneLength: saved.defaultSceneLength,
    voiceProvider: saved.defaultVoiceProvider,
    elevenLabs: { ...saved.defaultElevenLabs },
    ai33Pro: { ...saved.defaultAi33Pro },
    stockMediaType: saved.defaultStockMediaType ?? 'videos',
  };
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  step: 'setup',
  status: 'idle',
  script: DEFAULT_SAMPLE_SCRIPT,
  options: getDefaultOptions(),
  scenes: [],
  searchStateByScene: {},
  imageSearchStateByScene: {},
  selectedVideoClipIdsByScene: {},
  selectedImageIdsByScene: {},
  excludedSceneIds: [],
  error: null,
  activeAbortController: null,
  voiceStateByScene: {},
  isVoiceBatchRunning: false,
  exportState: null,
  activeDownloadController: null,
  bulkWorkflowStatus: { stage: 'idle', progress: 0, message: '', error: null },

  initializeFromSettings: () => {
    const saved = loadSettings();
    set((state) => {
      // If the user hasn't generated scenes yet, update default options to match latest saved settings
      if (state.status === 'idle' && state.scenes.length === 0) {
        return {
          options: {
            orientation: saved.defaultOrientation,
            quality: saved.defaultQuality,
            sceneLength: saved.defaultSceneLength,
            voiceProvider: saved.defaultVoiceProvider,
            elevenLabs: { ...saved.defaultElevenLabs },
            ai33Pro: { ...saved.defaultAi33Pro },
            stockMediaType: saved.defaultStockMediaType ?? 'videos',
          },
        };
      }
      return {};
    });
  },

  setScript: (script: string) => {
    set({ script, error: null });
  },

  setOptions: (updates: Partial<WorkflowOptions>) => {
    // Only updates in-memory options for the active job. Never persists to localStorage.
    set((state) => {
      const newOptions = {
        ...state.options,
        ...updates,
      };

      // If voice provider or active provider settings changed and audio exists, mark all ready audio as stale
      let newVoiceState = state.voiceStateByScene;
      if (updates.elevenLabs || updates.ai33Pro || updates.voiceProvider) {
        const oldProvider: VoiceProvider = state.options.voiceProvider || 'elevenlabs';
        const oldOpts = oldProvider === 'ai33pro' ? state.options.ai33Pro || DEFAULT_AI33PRO_SETTINGS : state.options.elevenLabs;
        const oldFp = createSettingsFingerprint(oldProvider, oldOpts);

        const newProvider: VoiceProvider = newOptions.voiceProvider || 'elevenlabs';
        const newOpts = newProvider === 'ai33pro' ? newOptions.ai33Pro || DEFAULT_AI33PRO_SETTINGS : newOptions.elevenLabs;
        const newFp = createSettingsFingerprint(newProvider, newOpts);

        if (oldFp !== newFp && Object.keys(state.voiceStateByScene).length > 0) {
          newVoiceState = { ...state.voiceStateByScene };
          for (const [id, seg] of Object.entries(newVoiceState)) {
            if (seg.status === 'ready') {
              newVoiceState[id] = { ...seg, status: 'stale' };
            }
          }
        }
      }

      return {
        options: newOptions,
        voiceStateByScene: newVoiceState,
      };
    });
  },

  switchVoiceProvider: (provider: VoiceProvider) => {
    for (const controller of activeVoiceControllers.values()) {
      controller.abort();
    }
    activeVoiceControllers.clear();

    const { voiceStateByScene, options } = get();
    for (const seg of Object.values(voiceStateByScene)) {
      if (seg?.audioUrl) {
        revokeBlobUrl(seg.audioUrl);
      }
    }

    const saved = loadSettings();
    const updatedOptions: WorkflowOptions = {
      ...options,
      voiceProvider: provider,
      elevenLabs: provider === 'elevenlabs' ? { ...saved.defaultElevenLabs } : options.elevenLabs,
      ai33Pro: provider === 'ai33pro' ? { ...saved.defaultAi33Pro } : options.ai33Pro,
    };

    set({
      options: updatedOptions,
      voiceStateByScene: {},
      isVoiceBatchRunning: false,
    });
  },

  setStep: (step: WorkflowStep) => {
    set({ step });
  },

  analyzeScript: async (geminiApiKey: string) => {
    const { script, options, activeAbortController, voiceStateByScene } = get();

    // If an analysis is already running, abort it
    if (activeAbortController) {
      activeAbortController.abort();
    }

    const validation = validateScriptInput(script);
    if (!validation.isValid) {
      set({
        status: 'error',
        error: validation.error || 'Invalid script text.',
      });
      return;
    }

    const controller = new AbortController();
    set({
      status: 'analyzing',
      error: null,
      activeAbortController: controller,
    });

    try {
      const scenes = await analyzeScriptWithGemini(
        script,
        options,
        geminiApiKey,
        controller.signal
      );

      // Clean up previous voice object URLs
      for (const seg of Object.values(voiceStateByScene)) {
        if (seg.audioUrl) {
          revokeBlobUrl(seg.audioUrl);
        }
      }

      set({
        scenes: renumberScenes(scenes),
        status: 'ready',
        step: 'scenes',
        error: null,
        activeAbortController: null,
        // Reset search and voice states when fresh scenes are generated
        searchStateByScene: {},
        imageSearchStateByScene: {},
        voiceStateByScene: {},
        excludedSceneIds: [],
      });
    } catch (err: unknown) {
      // Preserve script and options intact on error
      const message =
        err instanceof GeminiAnalysisError
          ? err.message
          : err instanceof Error
          ? err.message
          : 'An unexpected error occurred during script analysis.';

      set({
        status: 'error',
        error: message,
        activeAbortController: null,
      });
    }
  },

  cancelAnalysis: () => {
    const { activeAbortController } = get();
    if (activeAbortController) {
      activeAbortController.abort();
    }
    set({
      status: 'idle',
      activeAbortController: null,
      error: 'Analysis was cancelled.',
    });
  },

  editScene: (id: string, updates: Partial<Omit<Scene, 'id' | 'sequence'>>) => {
    const { scenes, searchStateByScene, voiceStateByScene } = get();
    const index = scenes.findIndex((s) => s.id === id);
    if (index === -1) return false;

    // Prevent empty script segment
    if (updates.scriptText !== undefined && !updates.scriptText.trim()) {
      return false;
    }

    const currentScene = scenes[index];
    const updatedScene: Scene = {
      ...currentScene,
      ...updates,
      scriptText: updates.scriptText !== undefined ? updates.scriptText.trim() : currentScene.scriptText,
      visualDescription:
        updates.visualDescription !== undefined
          ? updates.visualDescription.trim()
          : currentScene.visualDescription,
      primaryQuery:
        updates.primaryQuery !== undefined
          ? updates.primaryQuery.trim()
          : currentScene.primaryQuery,
    };

    const newScenes = [...scenes];
    newScenes[index] = updatedScene;

    // Material query change invalidates search results for this scene
    const newSearchStates = { ...searchStateByScene };
    delete newSearchStates[id];

    // Material scriptText change invalidates voice audio for this scene (marks stale)
    const newVoiceStates = { ...voiceStateByScene };
    if (
      updates.scriptText !== undefined &&
      updates.scriptText.trim() !== currentScene.scriptText
    ) {
      const existingVoice = newVoiceStates[id];
      if (existingVoice && (existingVoice.status === 'ready' || existingVoice.status === 'stale')) {
        newVoiceStates[id] = {
          ...existingVoice,
          status: 'stale',
          sourceTextFingerprint: createSourceTextFingerprint(updates.scriptText.trim()),
        };
      }
    }

    set({
      scenes: newScenes,
      searchStateByScene: newSearchStates,
      voiceStateByScene: newVoiceStates,
    });

    return true;
  },

  splitScene: (
    id: string,
    firstText: string,
    secondText: string,
    firstDescription?: string,
    secondDescription?: string,
    firstQuery?: string,
    secondQuery?: string
  ) => {
    const { scenes, options, searchStateByScene, voiceStateByScene } = get();
    const index = scenes.findIndex((s) => s.id === id);
    if (index === -1) return false;

    const trimmed1 = firstText.trim();
    const trimmed2 = secondText.trim();
    if (!trimmed1 || !trimmed2) return false;

    const targetScene = scenes[index];

    const scene1: Scene = {
      id: createSceneId(),
      sequence: 0,
      scriptText: trimmed1,
      visualDescription: firstDescription?.trim() || targetScene.visualDescription,
      primaryQuery: firstQuery?.trim() || targetScene.primaryQuery,
      fallbackQueries: [...targetScene.fallbackQueries],
      avoidTerms: [...targetScene.avoidTerms],
      estimatedSeconds: estimateDurationSeconds(trimmed1, options.sceneLength),
    };

    const scene2: Scene = {
      id: createSceneId(),
      sequence: 0,
      scriptText: trimmed2,
      visualDescription:
        secondDescription?.trim() || `Continuation: ${targetScene.visualDescription}`,
      primaryQuery: secondQuery?.trim() || targetScene.primaryQuery,
      fallbackQueries: [...targetScene.fallbackQueries],
      avoidTerms: [...targetScene.avoidTerms],
      estimatedSeconds: estimateDurationSeconds(trimmed2, options.sceneLength),
    };

    const newScenes = [...scenes];
    newScenes.splice(index, 1, scene1, scene2);

    // Invalidate search state for original scene
    const newSearchStates = { ...searchStateByScene };
    delete newSearchStates[id];

    // Revoke and remove voice state for split scene
    const newVoiceStates = { ...voiceStateByScene };
    if (newVoiceStates[id]?.audioUrl) {
      revokeBlobUrl(newVoiceStates[id].audioUrl);
    }
    delete newVoiceStates[id];

    set({
      scenes: renumberScenes(newScenes),
      searchStateByScene: newSearchStates,
      voiceStateByScene: newVoiceStates,
    });

    return true;
  },

  mergeScenes: (firstId: string, secondId: string) => {
    const { scenes, options, searchStateByScene, voiceStateByScene } = get();
    const index1 = scenes.findIndex((s) => s.id === firstId);
    const index2 = scenes.findIndex((s) => s.id === secondId);

    if (index1 === -1 || index2 === -1) return false;
    // Must be adjacent
    if (Math.abs(index1 - index2) !== 1) return false;

    const [firstIndex, secondIndex] = index1 < index2 ? [index1, index2] : [index2, index1];
    const firstScene = scenes[firstIndex];
    const secondScene = scenes[secondIndex];

    const mergedScriptText = `${firstScene.scriptText} ${secondScene.scriptText}`.trim();
    const mergedVisualDescription = `${firstScene.visualDescription}; ${secondScene.visualDescription}`;
    const mergedFallbacks = Array.from(
      new Set([...firstScene.fallbackQueries, ...secondScene.fallbackQueries])
    ).slice(0, 2);
    const mergedAvoidTerms = Array.from(
      new Set([...firstScene.avoidTerms, ...secondScene.avoidTerms])
    );

    const mergedScene: Scene = {
      id: createSceneId(),
      sequence: 0,
      scriptText: mergedScriptText,
      visualDescription: mergedVisualDescription,
      primaryQuery: firstScene.primaryQuery,
      fallbackQueries: mergedFallbacks,
      avoidTerms: mergedAvoidTerms,
      estimatedSeconds: estimateDurationSeconds(mergedScriptText, options.sceneLength),
    };

    const newScenes = [...scenes];
    newScenes.splice(firstIndex, 2, mergedScene);

    // Invalidate search states of both merged scenes
    const newSearchStates = { ...searchStateByScene };
    delete newSearchStates[firstId];
    delete newSearchStates[secondId];

    // Revoke and remove voice states of both merged scenes
    const newVoiceStates = { ...voiceStateByScene };
    if (newVoiceStates[firstId]?.audioUrl) {
      revokeBlobUrl(newVoiceStates[firstId].audioUrl);
    }
    if (newVoiceStates[secondId]?.audioUrl) {
      revokeBlobUrl(newVoiceStates[secondId].audioUrl);
    }
    delete newVoiceStates[firstId];
    delete newVoiceStates[secondId];

    set({
      scenes: renumberScenes(newScenes),
      searchStateByScene: newSearchStates,
      voiceStateByScene: newVoiceStates,
    });

    return true;
  },

  deleteScene: (id: string) => {
    const { scenes, searchStateByScene, voiceStateByScene } = get();
    const index = scenes.findIndex((s) => s.id === id);
    if (index === -1) return false;

    const newScenes = scenes.filter((s) => s.id !== id);
    const newSearchStates = { ...searchStateByScene };
    delete newSearchStates[id];

    // Abort in-flight request if any
    if (activeVoiceControllers.has(id)) {
      activeVoiceControllers.get(id)?.abort();
      activeVoiceControllers.delete(id);
    }

    // Revoke and remove voice state
    const newVoiceStates = { ...voiceStateByScene };
    if (newVoiceStates[id]?.audioUrl) {
      revokeBlobUrl(newVoiceStates[id].audioUrl);
    }
    delete newVoiceStates[id];

    set({
      scenes: renumberScenes(newScenes),
      searchStateByScene: newSearchStates,
      voiceStateByScene: newVoiceStates,
    });

    return true;
  },

  reorderScene: (id: string, direction: 'up' | 'down') => {
    const { scenes } = get();
    const index = scenes.findIndex((s) => s.id === id);
    if (index === -1) return false;

    if (direction === 'up' && index === 0) return false;
    if (direction === 'down' && index === scenes.length - 1) return false;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const newScenes = [...scenes];
    const [moved] = newScenes.splice(index, 1);
    newScenes.splice(targetIndex, 0, moved);

    // Audio is preserved intact on reordering
    set({
      scenes: renumberScenes(newScenes),
    });

    return true;
  },

  startOver: () => {
    const { activeAbortController, activeDownloadController, exportState, voiceStateByScene } = get();
    if (activeAbortController) {
      activeAbortController.abort();
    }
    if (activeDownloadController) {
      activeDownloadController.abort();
    }
    if (exportState?.zipBlobUrl) {
      revokeBlobUrl(exportState.zipBlobUrl);
    }
    clipBlobsCache.clear();

    // Abort and cleanup all voice requests and URLs
    for (const controller of activeVoiceControllers.values()) {
      controller.abort();
    }
    activeVoiceControllers.clear();

    for (const voice of Object.values(voiceStateByScene)) {
      if (voice.audioUrl) {
        revokeBlobUrl(voice.audioUrl);
      }
    }

    set({
      step: 'setup',
      status: 'idle',
      script: DEFAULT_SAMPLE_SCRIPT,
      options: getDefaultOptions(),
      scenes: [],
      searchStateByScene: {},
      imageSearchStateByScene: {},
      selectedVideoClipIdsByScene: {},
      selectedImageIdsByScene: {},
      voiceStateByScene: {},
      isVoiceBatchRunning: false,
      excludedSceneIds: [],
      error: null,
      activeAbortController: null,
      activeDownloadController: null,
      exportState: null,
      bulkWorkflowStatus: { stage: 'idle', progress: 0, message: '', error: null },
    });
  },

  proceedToVoices: () => {
    const { scenes } = get();
    if (scenes.length === 0) return false;

    const allValid = scenes.every((s) => s.scriptText.trim().length > 0);
    if (!allValid) return false;

    set({ step: 'voices' });
    return true;
  },

  proceedToClips: () => {
    const { scenes } = get();
    if (scenes.length === 0) return false;

    const allValid = scenes.every(
      (s) => s.scriptText.trim().length > 0 && s.primaryQuery.trim().length > 0
    );
    if (!allValid) return false;

    set({ step: 'clips' });
    return true;
  },

  // Feature 5 Voice Generation actions
  generateAllVoices: async (apiKey: string) => {
    const { scenes, options, voiceStateByScene, excludedSceneIds } = get();
    const includedScenes = scenes.filter((s) => !excludedSceneIds.includes(s.id));
    if (includedScenes.length === 0) return;

    const activeProvider: VoiceProvider = options.voiceProvider || 'elevenlabs';
    const activeOptions = activeProvider === 'ai33pro' ? (options.ai33Pro || DEFAULT_AI33PRO_SETTINGS) : options.elevenLabs;
    const providerDisplayName = activeProvider === 'ai33pro' ? 'AI33 Pro' : 'ElevenLabs';
    const currentSettingsFp = createSettingsFingerprint(activeProvider, activeOptions);

    const trimmedKey = (apiKey || '').trim();
    if (!trimmedKey) {
      set((state) => {
        const next = { ...state.voiceStateByScene };
        for (const s of includedScenes) {
          if (!next[s.id] || next[s.id].status !== 'ready') {
            next[s.id] = {
              sceneId: s.id,
              provider: activeProvider,
              status: 'failed',
              sourceTextFingerprint: createSourceTextFingerprint(s.scriptText),
              settingsFingerprint: currentSettingsFp,
              audioBlob: null,
              audioUrl: null,
              durationSeconds: null,
              requestId: null,
              taskId: null,
              creditCost: null,
              error: `${providerDisplayName} API key is missing. Please configure your key in Settings.`,
            };
          }
        }
        return { voiceStateByScene: next };
      });
      return;
    }

    // Identify scenes needing generation (not ready, or stale/different fingerprint)
    const scenesToGenerate = includedScenes.filter((s) => {
      const cur = voiceStateByScene[s.id];
      const textFp = createSourceTextFingerprint(s.scriptText);
      return (
        !cur ||
        cur.status !== 'ready' ||
        cur.sourceTextFingerprint !== textFp ||
        cur.settingsFingerprint !== currentSettingsFp
      );
    });

    if (scenesToGenerate.length === 0) {
      return;
    }

    // Set them to queued
    set((state) => {
      const next = { ...state.voiceStateByScene };
      for (const s of scenesToGenerate) {
        next[s.id] = {
          sceneId: s.id,
          provider: activeProvider,
          status: 'queued',
          sourceTextFingerprint: createSourceTextFingerprint(s.scriptText),
          settingsFingerprint: currentSettingsFp,
          audioBlob: null,
          audioUrl: null,
          durationSeconds: null,
          requestId: null,
          taskId: null,
          creditCost: null,
          error: null,
        };
      }
      return { voiceStateByScene: next, isVoiceBatchRunning: true };
    });

    // Run batch with concurrency limit (sequential for AI33 Pro to prevent API task collisions/rate limiting)
    const CONCURRENCY_LIMIT = activeProvider === 'ai33pro' ? 1 : 2;
    const executing = new Set<Promise<void>>();

    for (const scene of scenesToGenerate) {
      const task: Promise<void> = (async () => {
        await get().generateSceneVoice(scene.id, trimmedKey, false);
      })().finally(() => {
        executing.delete(task);
      });

      executing.add(task);
      if (executing.size >= CONCURRENCY_LIMIT) {
        await Promise.race(executing);
      }
    }

    await Promise.allSettled(Array.from(executing));
    set({ isVoiceBatchRunning: false });
  },

  generateSceneVoice: async (sceneId: string, elevenLabsApiKey: string, isRegeneration = false) => {
    const { scenes, options, voiceStateByScene, excludedSceneIds } = get();
    const scene = scenes.find((s) => s.id === sceneId);
    if (!scene) return;

    const activeProvider: VoiceProvider = options.voiceProvider || 'elevenlabs';
    const activeOptions = activeProvider === 'ai33pro' ? options.ai33Pro || DEFAULT_AI33PRO_SETTINGS : options.elevenLabs;

    const trimmedKey = (elevenLabsApiKey || '').trim();
    const textFp = createSourceTextFingerprint(scene.scriptText);
    const settingsFp = createSettingsFingerprint(activeProvider, activeOptions);

    if (!trimmedKey) {
      set((state) => ({
        voiceStateByScene: {
          ...state.voiceStateByScene,
          [sceneId]: {
            sceneId,
            provider: activeProvider,
            status: 'failed',
            sourceTextFingerprint: textFp,
            settingsFingerprint: settingsFp,
            audioBlob: null,
            audioUrl: null,
            durationSeconds: null,
            requestId: null,
            taskId: null,
            creditCost: null,
            error: `${activeProvider === 'ai33pro' ? 'AI33 Pro' : 'ElevenLabs'} API key is missing. Please configure your key in Settings.`,
          },
        },
      }));
      return;
    }

    // Abort existing controller if already running
    if (activeVoiceControllers.has(sceneId)) {
      activeVoiceControllers.get(sceneId)?.abort();
      activeVoiceControllers.delete(sceneId);
    }

    const controller = new AbortController();
    activeVoiceControllers.set(sceneId, controller);

    // Find continuity text from adjacent included scenes
    const includedScenes = scenes.filter((s) => !excludedSceneIds.includes(s.id));
    const sceneIndexInIncluded = includedScenes.findIndex((s) => s.id === sceneId);
    const previousScene = sceneIndexInIncluded > 0 ? includedScenes[sceneIndexInIncluded - 1] : undefined;
    const nextScene = sceneIndexInIncluded < includedScenes.length - 1 ? includedScenes[sceneIndexInIncluded + 1] : undefined;

    const oldState = voiceStateByScene[sceneId];

    set((state) => ({
      voiceStateByScene: {
        ...state.voiceStateByScene,
        [sceneId]: {
          sceneId,
          provider: activeProvider,
          status: 'generating',
          sourceTextFingerprint: textFp,
          settingsFingerprint: settingsFp,
          audioBlob: isRegeneration ? oldState?.audioBlob || null : null,
          audioUrl: isRegeneration ? oldState?.audioUrl || null : null,
          durationSeconds: oldState?.durationSeconds || null,
          requestId: oldState?.requestId || null,
          taskId: oldState?.taskId || null,
          creditCost: oldState?.creditCost || null,
          error: null,
        },
      },
    }));

    try {
      const adapter = getVoiceAdapter(activeProvider);
      const effectiveVoiceId =
        activeProvider === 'ai33pro'
          ? (options.ai33Pro?.voiceId || '')
          : (options.elevenLabs.voiceId || '');

      const result = await adapter.generateSpeech({
        scriptText: scene.scriptText,
        voiceId: effectiveVoiceId,
        options: activeOptions,
        apiKey: trimmedKey,
        previousText: previousScene?.scriptText,
        nextText: nextScene?.scriptText,
        signal: controller.signal,
      });

      // Verify scene scriptText hasn't changed while request was in-flight
      const currentLatestScene = get().scenes.find((s) => s.id === sceneId);
      const latestTextFp = createSourceTextFingerprint(currentLatestScene?.scriptText || '');
      if (latestTextFp !== textFp) {
        // Text changed in the meantime: discard late response
        activeVoiceControllers.delete(sceneId);
        return;
      }

      // Revoke old object URL if present
      if (oldState?.audioUrl) {
        revokeBlobUrl(oldState.audioUrl);
      }

      const audioUrl = URL.createObjectURL(result.audioBlob);

      set((state) => ({
        voiceStateByScene: {
          ...state.voiceStateByScene,
          [sceneId]: {
            sceneId,
            provider: activeProvider,
            status: 'ready',
            sourceTextFingerprint: textFp,
            settingsFingerprint: settingsFp,
            audioBlob: result.audioBlob,
            audioUrl,
            durationSeconds: result.durationSeconds,
            requestId: result.requestId || null,
            taskId: result.taskId || null,
            creditCost: result.creditCost || null,
            error: null,
          },
        },
      }));
    } catch (err: unknown) {
      if (controller.signal.aborted) {
        set((state) => {
          const cur = state.voiceStateByScene[sceneId];
          if (!cur || cur.status !== 'generating') return {};
          return {
            voiceStateByScene: {
              ...state.voiceStateByScene,
              [sceneId]: {
                ...cur,
                status: 'cancelled',
                error: 'Generation was cancelled.',
              },
            },
          };
        });
        return;
      }

      const msg = err instanceof Error ? err.message : 'Speech generation failed.';
      set((state) => ({
        voiceStateByScene: {
          ...state.voiceStateByScene,
          [sceneId]: {
            sceneId,
            provider: activeProvider,
            status: 'failed',
            sourceTextFingerprint: textFp,
            settingsFingerprint: settingsFp,
            audioBlob: null,
            audioUrl: null,
            durationSeconds: null,
            requestId: null,
            taskId: null,
            creditCost: null,
            error: msg,
          },
        },
      }));
    } finally {
      activeVoiceControllers.delete(sceneId);
    }
  },

  retryFailedVoices: async (apiKey: string) => {
    const { scenes, voiceStateByScene, excludedSceneIds } = get();
    const includedScenes = scenes.filter((s) => !excludedSceneIds.includes(s.id));
    const failedScenes = includedScenes.filter((s) => {
      const state = voiceStateByScene[s.id];
      return state && (state.status === 'failed' || state.status === 'cancelled');
    });

    if (failedScenes.length === 0) return;

    set({ isVoiceBatchRunning: true });
    const CONCURRENCY_LIMIT = 2;
    const executing = new Set<Promise<void>>();

    for (const scene of failedScenes) {
      const task: Promise<void> = (async () => {
        await get().generateSceneVoice(scene.id, apiKey, false);
      })().finally(() => {
        executing.delete(task);
      });

      executing.add(task);
      if (executing.size >= CONCURRENCY_LIMIT) {
        await Promise.race(executing);
      }
    }

    await Promise.allSettled(Array.from(executing));
    set({ isVoiceBatchRunning: false });
  },

  cancelVoiceGeneration: () => {
    for (const controller of activeVoiceControllers.values()) {
      controller.abort();
    }
    activeVoiceControllers.clear();

    set((state) => {
      const next = { ...state.voiceStateByScene };
      for (const [id, seg] of Object.entries(next)) {
        if (seg.status === 'generating' || seg.status === 'queued') {
          next[id] = { ...seg, status: 'cancelled', error: 'Generation was cancelled.' };
        }
      }
      return { voiceStateByScene: next, isVoiceBatchRunning: false };
    });
  },

  // Feature 3 actions
  searchAllScenes: async (pexelsApiKey: string) => {
    const { scenes, options, searchStateByScene } = get();
    if (scenes.length === 0) return;

    if (!pexelsApiKey.trim()) {
      const updated = { ...searchStateByScene };
      for (const s of scenes) {
        if (!updated[s.id] || updated[s.id].status === 'idle') {
          updated[s.id] = {
            status: 'error',
            query: s.primaryQuery,
            candidates: [],
            selectedCandidateId: null,
            error: 'Pexels API key is missing. Please configure your key in Settings.',
          };
        }
      }
      set({ searchStateByScene: updated });
      return;
    }

    const previouslySelected = new Set<number>();
    for (const [, state] of Object.entries(searchStateByScene)) {
      if (state.status === 'ready' && state.selectedCandidateId) {
        const sel = state.candidates.find((c) => c.id === state.selectedCandidateId);
        if (sel) {
          previouslySelected.add(sel.pexelsVideoId);
        }
      }
    }

    // Set idle, error, or unsearched scenes to searching
    set((state) => {
      const nextSearch = { ...state.searchStateByScene };
      for (const scene of state.scenes) {
        if (!nextSearch[scene.id] || nextSearch[scene.id].status === 'idle' || nextSearch[scene.id].status === 'error') {
          nextSearch[scene.id] = {
            status: 'searching',
            query: nextSearch[scene.id]?.query || scene.primaryQuery,
            candidates: [],
            selectedCandidateId: null,
            error: null,
          };
        }
      }
      return { searchStateByScene: nextSearch };
    });

    for (const scene of scenes) {
      const current = get().searchStateByScene[scene.id];
      if (current && current.status === 'ready' && current.selectedCandidateId) {
        continue;
      }

      set((state) => ({
        searchStateByScene: {
          ...state.searchStateByScene,
          [scene.id]: {
            status: 'searching',
            query: current?.query || scene.primaryQuery,
            candidates: [],
            selectedCandidateId: null,
            error: null,
          },
        },
      }));

      try {
        const queryToUse = current?.query || scene.primaryQuery;
        const candidates = await searchClipsForScene(
          scene,
          options.orientation,
          options.quality,
          pexelsApiKey,
          previouslySelected,
          queryToUse !== scene.primaryQuery ? queryToUse : undefined
        );

        if (candidates.length === 0) {
          set((state) => ({
            searchStateByScene: {
              ...state.searchStateByScene,
              [scene.id]: {
                status: 'empty',
                query: queryToUse,
                candidates: [],
                selectedCandidateId: null,
                error: null,
              },
            },
          }));
        } else if (candidates.length < 6) {
          set((state) => ({
            searchStateByScene: {
              ...state.searchStateByScene,
              [scene.id]: {
                status: 'empty',
                query: queryToUse,
                candidates,
                selectedCandidateId: candidates[0]?.id || null,
                error: `Incomplete candidate set: Only ${candidates.length} clips found (6 required). Please edit your query or retry.`,
              },
            },
          }));
        } else {
          for (const cand of candidates) {
            previouslySelected.add(cand.pexelsVideoId);
          }
          set((state) => ({
            searchStateByScene: {
              ...state.searchStateByScene,
              [scene.id]: {
                status: 'ready',
                query: queryToUse,
                candidates,
                selectedCandidateId: candidates[0]?.id || null,
                error: null,
              },
            },
          }));
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Video search failed.';
        set((state) => ({
          searchStateByScene: {
            ...state.searchStateByScene,
            [scene.id]: {
              status: 'error',
              query: current?.query || scene.primaryQuery,
              candidates: [],
              selectedCandidateId: null,
              error: message,
            },
          },
        }));

        if (err instanceof PexelsApiError && (err.isQuotaError || err.isCredentialError)) {
          break;
        }
      }
    }
  },

  searchScene: async (sceneId: string, pexelsApiKey: string, customQuery?: string) => {
    const { scenes, options, searchStateByScene } = get();
    const scene = scenes.find((s) => s.id === sceneId);
    if (!scene) return;

    if (!pexelsApiKey.trim()) {
      set((state) => ({
        searchStateByScene: {
          ...state.searchStateByScene,
          [sceneId]: {
            status: 'error',
            query: customQuery?.trim() || scene.primaryQuery,
            candidates: [],
            selectedCandidateId: null,
            error: 'Pexels API key is missing. Please configure your key in Settings.',
          },
        },
      }));
      return;
    }

    const previousState = searchStateByScene[sceneId];
    const queryToUse = customQuery?.trim() || previousState?.query || scene.primaryQuery;

    // Collect previously discovered video IDs from ALL OTHER ready scenes
    const previouslySelected = new Set<number>();
    for (const [otherId, otherState] of Object.entries(searchStateByScene)) {
      if (otherId !== sceneId && otherState.status === 'ready') {
        for (const c of otherState.candidates) {
          previouslySelected.add(c.pexelsVideoId);
        }
      }
    }

    set((state) => ({
      searchStateByScene: {
        ...state.searchStateByScene,
        [sceneId]: {
          status: 'searching',
          query: queryToUse,
          candidates: previousState?.candidates || [],
          selectedCandidateId: previousState?.selectedCandidateId || null,
          error: null,
        },
      },
    }));

    try {
      const candidates = await searchClipsForScene(
        scene,
        options.orientation,
        options.quality,
        pexelsApiKey,
        previouslySelected,
        queryToUse
      );

      if (candidates.length === 0) {
        set((state) => ({
          searchStateByScene: {
            ...state.searchStateByScene,
            [sceneId]: {
              status: 'empty',
              query: queryToUse,
              candidates: [],
              selectedCandidateId: null,
              error: null,
            },
          },
        }));
      } else if (candidates.length < 6) {
        set((state) => ({
          searchStateByScene: {
            ...state.searchStateByScene,
            [sceneId]: {
              status: 'empty',
              query: queryToUse,
              candidates,
              selectedCandidateId: candidates[0]?.id || null,
              error: `Incomplete candidate set: Only ${candidates.length} clips found (6 required). Please edit your query or retry.`,
            },
          },
        }));
      } else {
        set((state) => ({
          searchStateByScene: {
            ...state.searchStateByScene,
            [sceneId]: {
              status: 'ready',
              query: queryToUse,
              candidates,
              selectedCandidateId: candidates[0]?.id || null,
              error: null,
            },
          },
          selectedVideoClipIdsByScene: {
            ...state.selectedVideoClipIdsByScene,
            [sceneId]: candidates.slice(0, 6).map((c) => c.id),
          },
        }));
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Search failed.';
      set((state) => ({
        searchStateByScene: {
          ...state.searchStateByScene,
          [sceneId]: {
            status: 'error',
            query: queryToUse,
            candidates: [],
            selectedCandidateId: null,
            error: message,
          },
        },
      }));
    }
  },

  selectCandidate: (sceneId: string, candidateId: string) => {
    // Retained for transitional API compatibility; no-op in 6-clip all-export workflow
    set((state) => {
      const current = state.searchStateByScene[sceneId];
      if (!current) return {};
      return {
        searchStateByScene: {
          ...state.searchStateByScene,
          [sceneId]: {
            ...current,
            selectedCandidateId: candidateId,
          },
        },
      };
    });
  },

  toggleVideoClipSelection: (sceneId: string, candidateId: string) => {
    set((state) => {
      const allCandidates = state.searchStateByScene[sceneId]?.candidates || [];
      const currentSelected = state.selectedVideoClipIdsByScene[sceneId] ?? allCandidates.map((c) => c.id);
      const isAlreadySelected = currentSelected.includes(candidateId);
      const nextSelected = isAlreadySelected
        ? currentSelected.filter((id) => id !== candidateId)
        : [...currentSelected, candidateId];

      return {
        selectedVideoClipIdsByScene: {
          ...state.selectedVideoClipIdsByScene,
          [sceneId]: nextSelected,
        },
      };
    });
  },

  toggleImageSelection: (sceneId: string, photoId: number) => {
    set((state) => {
      const allCandidates = state.imageSearchStateByScene[sceneId]?.candidates || [];
      const currentSelected = state.selectedImageIdsByScene[sceneId] ?? allCandidates.map((c) => c.pexelsPhotoId);
      const isAlreadySelected = currentSelected.includes(photoId);
      const nextSelected = isAlreadySelected
        ? currentSelected.filter((id) => id !== photoId)
        : [...currentSelected, photoId];

      return {
        selectedImageIdsByScene: {
          ...state.selectedImageIdsByScene,
          [sceneId]: nextSelected,
        },
      };
    });
  },

  selectAllVideoClips: (sceneId: string) => {
    set((state) => {
      const allCandidates = state.searchStateByScene[sceneId]?.candidates || [];
      return {
        selectedVideoClipIdsByScene: {
          ...state.selectedVideoClipIdsByScene,
          [sceneId]: allCandidates.map((c) => c.id),
        },
      };
    });
  },

  deselectAllVideoClips: (sceneId: string) => {
    set((state) => ({
      selectedVideoClipIdsByScene: {
        ...state.selectedVideoClipIdsByScene,
        [sceneId]: [],
      },
    }));
  },

  selectAllImages: (sceneId: string) => {
    set((state) => {
      const allCandidates = state.imageSearchStateByScene[sceneId]?.candidates || [];
      return {
        selectedImageIdsByScene: {
          ...state.selectedImageIdsByScene,
          [sceneId]: allCandidates.map((c) => c.pexelsPhotoId),
        },
      };
    });
  },

  deselectAllImages: (sceneId: string) => {
    set((state) => ({
      selectedImageIdsByScene: {
        ...state.selectedImageIdsByScene,
        [sceneId]: [],
      },
    }));
  },

  excludeScene: (sceneId: string) => {
    set((state) => ({
      excludedSceneIds: Array.from(new Set([...state.excludedSceneIds, sceneId])),
    }));
  },

  restoreScene: (sceneId: string) => {
    set((state) => ({
      excludedSceneIds: state.excludedSceneIds.filter((id) => id !== sceneId),
    }));
  },

  canProceedToPackaging: () => {
    const {
      scenes,
      searchStateByScene,
      imageSearchStateByScene,
      voiceStateByScene,
      options,
      excludedSceneIds,
      selectedVideoClipIdsByScene,
      selectedImageIdsByScene,
    } = get();
    if (scenes.length === 0) return false;
    const includedScenes = scenes.filter((s) => !excludedSceneIds.includes(s.id));
    if (includedScenes.length === 0) return false;

    const activeProvider = options.voiceProvider || 'elevenlabs';
    const activeOptions = activeProvider === 'ai33pro' ? options.ai33Pro || DEFAULT_AI33PRO_SETTINGS : options.elevenLabs;
    const currentSettingsFp = createSettingsFingerprint(activeProvider, activeOptions);
    const hasAnyVoice = includedScenes.some((s) => Boolean(voiceStateByScene[s.id]));

    const stockMediaType = options.stockMediaType ?? 'videos';
    const needsVideos = stockMediaType === 'videos' || stockMediaType === 'both';
    const needsImages = stockMediaType === 'images' || stockMediaType === 'both';

    return includedScenes.every((scene) => {
      if (needsVideos) {
        const sState = searchStateByScene[scene.id];
        const hasClips = Boolean(
          sState &&
          sState.status === 'ready' &&
          Array.isArray(sState.candidates) &&
          sState.candidates.length === 6
        );
        if (!hasClips) return false;

        const selectedClips = selectedVideoClipIdsByScene[scene.id] ?? sState.candidates.map((c) => c.id);
        if (selectedClips.length === 0 && !needsImages) return false;
      }

      if (needsImages) {
        const imgState = imageSearchStateByScene[scene.id];
        const hasImages = Boolean(
          imgState &&
          imgState.status === 'ready' &&
          Array.isArray(imgState.candidates) &&
          imgState.candidates.length > 0
        );
        if (!hasImages) return false;

        const selectedImgs = selectedImageIdsByScene[scene.id] ?? imgState.candidates.map((c) => c.pexelsPhotoId);
        if (selectedImgs.length === 0 && !needsVideos) return false;
      }

      // If voice generation was used in this workflow, every included scene must have a matching ready voice
      if (hasAnyVoice) {
        const vState = voiceStateByScene[scene.id];
        const expectedTextFp = createSourceTextFingerprint(scene.scriptText);
        const hasVoice = Boolean(
          vState &&
          vState.status === 'ready' &&
          vState.audioBlob &&
          vState.sourceTextFingerprint === expectedTextFp &&
          vState.settingsFingerprint === currentSettingsFp
        );

        if (!hasVoice) return false;
      }

      return true;
    });
  },

  proceedToPackaging: () => {
    const { canProceedToPackaging } = get();
    if (!canProceedToPackaging()) {
      return false;
    }
    set({ step: 'packaging', exportState: null });
    return true;
  },

  // Feature 4 actions
  startExport: async () => {
    const {
      scenes,
      options,
      searchStateByScene,
      voiceStateByScene,
      excludedSceneIds,
      activeDownloadController,
    } = get();

    if (activeDownloadController) {
      activeDownloadController.abort();
    }

    const includedScenes = scenes.filter((s) => !excludedSceneIds.includes(s.id));
    if (includedScenes.length === 0 || !get().canProceedToPackaging()) {
      set({
        exportState: {
          stage: 'failed',
          clips: [],
          zipBlobUrl: null,
          error:
            'Export is blocked until every included scene has exactly six usable Pexels candidates and a current voice segment.',
        },
      });
      return;
    }

    const totalCount = includedScenes.length;
    const activeProvider = options.voiceProvider || 'elevenlabs';
    const activeOptions = activeProvider === 'ai33pro' ? (options.ai33Pro || DEFAULT_AI33PRO_SETTINGS) : options.elevenLabs;
    const currentSettingsFp = createSettingsFingerprint(activeProvider, activeOptions);
    const LABELS: CandidateLabel[] = ['A', 'B', 'C', 'D', 'E', 'F'];

    const stockMediaType = options.stockMediaType ?? 'videos';
    const needsVideos = stockMediaType === 'videos' || stockMediaType === 'both';

    // Validate MP4 variants and voice status for all included scenes and candidates if videos needed
    if (needsVideos) {
      for (let i = 0; i < includedScenes.length; i++) {
        const scene = includedScenes[i];
        const searchState = searchStateByScene[scene.id];

        if (
          !searchState ||
          searchState.status !== 'ready' ||
          !Array.isArray(searchState.candidates) ||
          searchState.candidates.length !== 6
        ) {
          set({
            exportState: {
              stage: 'failed',
              clips: [],
              zipBlobUrl: null,
              error: `Scene #${i + 1} does not have exactly six usable video candidates.`,
            },
          });
          return;
        }

        const selectedIds = (get().selectedVideoClipIdsByScene[scene.id]) ?? searchState.candidates.map((c) => c.id);
        for (let j = 0; j < 6; j++) {
          const candidate = searchState.candidates[j];
          if (!selectedIds.includes(candidate.id)) continue;
          const label = LABELS[j];
          try {
            selectBestMp4Variant(candidate, options.orientation, options.quality);
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'No usable MP4 variant.';
            set({
              exportState: {
                stage: 'failed',
                clips: [],
                zipBlobUrl: null,
                error: `Scene #${i + 1} Candidate ${label}: ${msg}`,
              },
            });
            return;
          }
        }
      }
    }

    const hasAnyVoice = includedScenes.some((s) => Boolean(voiceStateByScene[s.id]));
    if (hasAnyVoice) {
      for (let i = 0; i < includedScenes.length; i++) {
        const scene = includedScenes[i];
        const voice = voiceStateByScene[scene.id];
        const expectedTextFp = createSourceTextFingerprint(scene.scriptText);
        if (
          !voice ||
          voice.status !== 'ready' ||
          !voice.audioBlob ||
          voice.sourceTextFingerprint !== expectedTextFp ||
          voice.settingsFingerprint !== currentSettingsFp
        ) {
          set({
            exportState: {
              stage: 'failed',
              clips: [],
              zipBlobUrl: null,
              error: `Scene #${i + 1} lacks a current successful voice segment. Please generate audio first.`,
            },
          });
          return;
        }
      }
    }

    const selectedVideoClipIdsByScene = get().selectedVideoClipIdsByScene || {};
    const initialClips: ClipDownloadStatus[] = [];
    if (needsVideos) {
      includedScenes.forEach((scene, sceneIdx) => {
        const seq = sceneIdx + 1;
        const searchState = searchStateByScene[scene.id];
        const selectedIds = selectedVideoClipIdsByScene[scene.id] ?? searchState?.candidates?.map((c) => c.id) ?? [];

        searchState?.candidates?.forEach((candidate, candidateIdx) => {
          if (!selectedIds.includes(candidate.id)) return;
          const label = LABELS[candidateIdx] || candidate.candidateLabel || 'A';
          const cacheKey = `${scene.id}-${label}`;
          const hasBlob = clipBlobsCache.has(cacheKey);
          const blob = clipBlobsCache.get(cacheKey);
          initialClips.push({
            sceneId: scene.id,
            sequence: seq,
            candidateLabel: label,
            filename: getMp4Filename(seq, totalCount, label),
            state: hasBlob ? ('complete' as const) : ('pending' as const),
            receivedBytes: blob?.size,
            totalBytes: blob?.size,
          });
        });
      });
    }

    const downloadController = new AbortController();
    set({
      exportState: {
        stage: needsVideos ? 'downloading' : 'preparing-files',
        clips: initialClips,
        zipBlobUrl: null,
        error: null,
      },
      activeDownloadController: downloadController,
    });

    // Determine clips that need downloading
    const tasksToDownload: {
      taskId: string;
      sceneId: string;
      candidateLabel: CandidateLabel;
      url: string;
    }[] = [];

    if (needsVideos) {
      includedScenes.forEach((scene) => {
        const searchState = searchStateByScene[scene.id];
        const selectedIds = selectedVideoClipIdsByScene[scene.id] ?? searchState?.candidates?.map((c) => c.id) ?? [];

        searchState?.candidates?.forEach((candidate, candidateIdx) => {
          if (!selectedIds.includes(candidate.id)) return;
          const label = LABELS[candidateIdx] || candidate.candidateLabel || 'A';
          const cacheKey = `${scene.id}-${label}`;
          if (!clipBlobsCache.has(cacheKey)) {
            const variant = selectBestMp4Variant(candidate, options.orientation, options.quality);
            tasksToDownload.push({
              taskId: cacheKey,
              sceneId: scene.id,
              candidateLabel: label,
              url: variant.url,
            });
          }
        });
      });
    }

    if (tasksToDownload.length === 0) {
      // All clips already in memory cache
      await packageAndFinalizeZip(get, set);
      return;
    }

    await downloadClipsWithConcurrency(
      tasksToDownload,
      3,
      downloadController.signal,
      (taskId, receivedBytes, totalBytes) => {
        set((state) => {
          if (!state.exportState) return {};
          const updatedClips = state.exportState.clips.map((clip) => {
            const clipKey = `${clip.sceneId}-${clip.candidateLabel}`;
            return clipKey === taskId
              ? { ...clip, state: 'downloading' as const, receivedBytes, totalBytes }
              : clip;
          });
          return { exportState: { ...state.exportState, clips: updatedClips } };
        });
      },
      (taskId, blob) => {
        clipBlobsCache.set(taskId, blob);
        set((state) => {
          if (!state.exportState) return {};
          const updatedClips = state.exportState.clips.map((clip) => {
            const clipKey = `${clip.sceneId}-${clip.candidateLabel}`;
            return clipKey === taskId
              ? {
                  ...clip,
                  state: 'complete' as const,
                  receivedBytes: blob.size,
                  totalBytes: blob.size,
                  error: undefined,
                }
              : clip;
          });
          return { exportState: { ...state.exportState, clips: updatedClips } };
        });
      },
      (taskId, errorMsg) => {
        set((state) => {
          if (!state.exportState) return {};
          const updatedClips = state.exportState.clips.map((clip) => {
            const clipKey = `${clip.sceneId}-${clip.candidateLabel}`;
            return clipKey === taskId
              ? { ...clip, state: 'failed' as const, error: errorMsg }
              : clip;
          });
          return { exportState: { ...state.exportState, clips: updatedClips } };
        });
      }
    );

    if (downloadController.signal.aborted) {
      set((state) => {
        if (!state.exportState) return {};
        const cancelledClips = state.exportState.clips.map((c) =>
          c.state === 'complete' ? c : { ...c, state: 'cancelled' as const }
        );
        return {
          exportState: {
            ...state.exportState,
            stage: 'cancelled',
            clips: cancelledClips,
            error: 'Export was cancelled.',
          },
          activeDownloadController: null,
        };
      });
      return;
    }

    const currentClips = get().exportState?.clips || [];
    const hasFailures = currentClips.some((c) => c.state === 'failed');

    // If some clips failed, keep stage at 'downloading' with failed status visible for retry
    if (hasFailures) {
      return;
    }

    // All clips completed successfully, proceed to packaging
    await packageAndFinalizeZip(get, set);
  },

  retryClipDownload: async (sceneId: string, candidateLabel?: CandidateLabel) => {
    const { scenes, options, searchStateByScene, exportState } = get();
    if (!exportState) return;

    const scene = scenes.find((s) => s.id === sceneId);
    if (!scene) return;

    const searchState = searchStateByScene[sceneId];
    if (!searchState || !searchState.candidates) return;

    const LABELS: CandidateLabel[] = ['A', 'B', 'C', 'D', 'E', 'F'];
    const targetLabels: CandidateLabel[] = candidateLabel
      ? [candidateLabel]
      : LABELS.filter((l) => {
          const key = `${sceneId}-${l}`;
          return !clipBlobsCache.has(key);
        });

    for (const label of targetLabels) {
      const key = `${sceneId}-${label}`;
      const candidateIdx = LABELS.indexOf(label);
      const candidate = searchState.candidates[candidateIdx];
      if (!candidate) continue;

      let variant;
      try {
        variant = selectBestMp4Variant(candidate, options.orientation, options.quality);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'No usable MP4 variant.';
        set((state) => {
          if (!state.exportState) return {};
          const updatedClips = state.exportState.clips.map((clip) =>
            clip.sceneId === sceneId && clip.candidateLabel === label
              ? { ...clip, state: 'failed' as const, error: msg }
              : clip
          );
          return { exportState: { ...state.exportState, clips: updatedClips } };
        });
        continue;
      }

      set((state) => {
        if (!state.exportState) return {};
        const updatedClips = state.exportState.clips.map((clip) =>
          clip.sceneId === sceneId && clip.candidateLabel === label
            ? { ...clip, state: 'downloading' as const, error: undefined }
            : clip
        );
        return {
          exportState: { ...state.exportState, stage: 'downloading', clips: updatedClips },
        };
      });

      const controller = new AbortController();
      set({ activeDownloadController: controller });

      try {
        const blob = await downloadClipBlob(variant.url, controller.signal, (received, total) => {
          set((state) => {
            if (!state.exportState) return {};
            const updatedClips = state.exportState.clips.map((clip) =>
              clip.sceneId === sceneId && clip.candidateLabel === label
                ? { ...clip, receivedBytes: received, totalBytes: total }
                : clip
            );
            return { exportState: { ...state.exportState, clips: updatedClips } };
          });
        });

        clipBlobsCache.set(key, blob);

        set((state) => {
          if (!state.exportState) return {};
          const updatedClips = state.exportState.clips.map((clip) =>
            clip.sceneId === sceneId && clip.candidateLabel === label
              ? {
                  ...clip,
                  state: 'complete' as const,
                  receivedBytes: blob.size,
                  totalBytes: blob.size,
                  error: undefined,
                }
              : clip
          );
          return { exportState: { ...state.exportState, clips: updatedClips } };
        });
      } catch (err: unknown) {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : 'Download failed.';
        set((state) => {
          if (!state.exportState) return {};
          const updatedClips = state.exportState.clips.map((clip) =>
            clip.sceneId === sceneId && clip.candidateLabel === label
              ? { ...clip, state: 'failed' as const, error: message }
              : clip
          );
          return { exportState: { ...state.exportState, clips: updatedClips } };
        });
      }
    }

    // Check if all clips are now complete
    const latestClips = get().exportState?.clips || [];
    const allDone = latestClips.length > 0 && latestClips.every((c) => c.state === 'complete');
    if (allDone) {
      await packageAndFinalizeZip(get, set);
    }
  },

  cancelExport: () => {
    const { activeDownloadController, exportState } = get();
    if (activeDownloadController) {
      activeDownloadController.abort();
    }
    if (exportState?.zipBlobUrl) {
      revokeBlobUrl(exportState.zipBlobUrl);
    }
    clipBlobsCache.clear();

    set((state) => {
      if (!state.exportState) return {};
      const cancelledClips = state.exportState.clips.map((clip) =>
        clip.state === 'complete' ? clip : { ...clip, state: 'cancelled' as const }
      );
      return {
        exportState: {
          ...state.exportState,
          stage: 'cancelled',
          clips: cancelledClips,
          zipBlobUrl: null,
          error: 'Export was cancelled.',
        },
        activeDownloadController: null,
      };
    });
  },

  downloadZipFile: () => {
    const { exportState } = get();
    if (exportState?.zipBlobUrl) {
      triggerBrowserDownload(exportState.zipBlobUrl);
    }
  },

  // ---------------------------------------------------------------------------
  // Image search actions (Pexels Photos API)
  // ---------------------------------------------------------------------------

  searchAllImages: async (pexelsApiKey: string) => {
    const { scenes, excludedSceneIds } = get();
    const includedScenes = scenes.filter((s) => !excludedSceneIds.includes(s.id));
    if (includedScenes.length === 0) return;

    const previouslyUsed = new Set<number>();

    for (const scene of includedScenes) {
      const { imageSearchStateByScene } = get();
      const previousState = imageSearchStateByScene[scene.id];
      const queryToUse = previousState?.query || scene.primaryQuery;

      // Collect already-used photo IDs from other ready image searches
      const allStates = get().imageSearchStateByScene;
      for (const [otherId, otherState] of Object.entries(allStates)) {
        if (otherId !== scene.id && otherState.status === 'ready') {
          for (const c of otherState.candidates) {
            previouslyUsed.add(c.pexelsPhotoId);
          }
        }
      }

      await get().searchSceneImages(scene.id, pexelsApiKey, queryToUse);
    }
  },

  searchSceneImages: async (sceneId: string, pexelsApiKey: string, customQuery?: string) => {
    const { scenes, options, imageSearchStateByScene } = get();
    const scene = scenes.find((s) => s.id === sceneId);
    if (!scene) return;

    if (!pexelsApiKey.trim()) {
      set((state) => ({
        imageSearchStateByScene: {
          ...state.imageSearchStateByScene,
          [sceneId]: {
            status: 'error',
            query: customQuery?.trim() || scene.primaryQuery,
            candidates: [],
            error: 'Pexels API key is missing. Please configure your key in Settings.',
          },
        },
      }));
      return;
    }

    const queryToUse = customQuery?.trim() || imageSearchStateByScene[sceneId]?.query || scene.primaryQuery;

    // Collect photo IDs used by other ready scenes
    const previouslyUsed = new Set<number>();
    for (const [otherId, otherState] of Object.entries(imageSearchStateByScene)) {
      if (otherId !== sceneId && otherState.status === 'ready') {
        for (const c of otherState.candidates) {
          previouslyUsed.add(c.pexelsPhotoId);
        }
      }
    }

    set((state) => ({
      imageSearchStateByScene: {
        ...state.imageSearchStateByScene,
        [sceneId]: {
          status: 'searching',
          query: queryToUse,
          candidates: state.imageSearchStateByScene[sceneId]?.candidates || [],
          error: null,
        },
      },
    }));

    try {
      const candidates = await searchImagesForScene(
        scene,
        options.orientation,
        pexelsApiKey,
        previouslyUsed,
        queryToUse
      );

      if (candidates.length === 0) {
        set((state) => ({
          imageSearchStateByScene: {
            ...state.imageSearchStateByScene,
            [sceneId]: { status: 'empty', query: queryToUse, candidates: [], error: null },
          },
        }));
      } else {
        set((state) => ({
          imageSearchStateByScene: {
            ...state.imageSearchStateByScene,
            [sceneId]: { status: 'ready', query: queryToUse, candidates, error: null },
          },
          selectedImageIdsByScene: {
            ...state.selectedImageIdsByScene,
            [sceneId]: candidates.map((c) => c.pexelsPhotoId),
          },
        }));
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Image search failed.';
      set((state) => ({
        imageSearchStateByScene: {
          ...state.imageSearchStateByScene,
          [sceneId]: { status: 'error', query: queryToUse, candidates: [], error: message },
        },
      }));
    }
  },

  // ---------------------------------------------------------------------------
  // Bulk Gemini Nano Automated Workflow
  // Chains: Analyze → Voices → Stock Media Search → Package & Download ZIP
  // ---------------------------------------------------------------------------

  /** AbortController for the entire bulk run (shared across stages). */

  runBulkWorkflow: async (geminiKey: string, voiceKey: string, pexelsKey: string) => {
    const bulkController = new AbortController();

    const setBulk = (partial: Partial<BulkWorkflowStatus>) => {
      set((state) => ({
        bulkWorkflowStatus: { ...state.bulkWorkflowStatus, ...partial },
      }));
    };

    setBulk({ stage: 'analyzing', progress: 0, message: 'Analyzing script with Gemini…', error: null });

    // ---- Stage 1: Analyze Script ----
    try {
      await get().analyzeScript(geminiKey);
    } catch {
      // analyzeScript stores error in state; we just surface it here
    }

    const afterAnalyze = get();
    if (afterAnalyze.status === 'error' || afterAnalyze.scenes.length === 0) {
      setBulk({ stage: 'failed', progress: 0, message: 'Script analysis failed.', error: afterAnalyze.error || 'Analysis failed.' });
      return;
    }
    if (bulkController.signal.aborted) { setBulk({ stage: 'cancelled', message: 'Cancelled.' }); return; }

    const scenes = afterAnalyze.scenes;
    const totalScenes = scenes.length;
    setBulk({ stage: 'analyzing', progress: 10, message: `Script analyzed — ${totalScenes} scenes created.` });

    // ---- Stage 2: Generate Voices (if a voice key is provided) ----
    if (voiceKey.trim()) {
      setBulk({ stage: 'generating-voices', progress: 15, message: 'Generating voice narration…', error: null });
      try {
        await get().generateAllVoices(voiceKey);
      } catch { /* failures are stored per-scene */ }

      if (bulkController.signal.aborted) { setBulk({ stage: 'cancelled', message: 'Cancelled.' }); return; }
      setBulk({ stage: 'generating-voices', progress: 40, message: 'Voice narration complete.' });
    } else {
      setBulk({ progress: 40, message: 'Skipping voice narration (no voice key).' });
    }

    // ---- Stage 3: Search Stock Media ----
    const { options } = get();
    const stockMediaType = options.stockMediaType ?? 'videos';
    const needsVideos = stockMediaType === 'videos' || stockMediaType === 'both';
    const needsImages = stockMediaType === 'images' || stockMediaType === 'both';

    setBulk({ stage: 'searching-media', progress: 45, message: 'Searching for stock media…', error: null });

    if (pexelsKey.trim()) {
      if (needsVideos) {
        try {
          await get().searchAllScenes(pexelsKey);
        } catch { /* per-scene errors */ }
        if (bulkController.signal.aborted) { setBulk({ stage: 'cancelled', message: 'Cancelled.' }); return; }
      }

      if (needsImages) {
        try {
          await get().searchAllImages(pexelsKey);
        } catch { /* per-scene errors */ }
        if (bulkController.signal.aborted) { setBulk({ stage: 'cancelled', message: 'Cancelled.' }); return; }
      }
    }

    setBulk({ stage: 'searching-media', progress: 75, message: 'Stock media search complete.' });

    // ---- Stage 4: Package & Download ZIP ----
    if (!get().canProceedToPackaging()) {
      setBulk({
        stage: 'failed',
        progress: 75,
        message: 'Some scenes are missing required media or voice. Review the clip and voice steps.',
        error: 'Cannot package: not all scenes are complete.',
      });
      return;
    }

    setBulk({ stage: 'packaging', progress: 80, message: 'Packaging ZIP…', error: null });

    try {
      get().proceedToPackaging();
      await get().startExport();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Packaging failed.';
      setBulk({ stage: 'failed', progress: 80, message: msg, error: msg });
      return;
    }

    if (bulkController.signal.aborted) { setBulk({ stage: 'cancelled', message: 'Cancelled.' }); return; }

    // Trigger download
    get().downloadZipFile();

    setBulk({ stage: 'complete', progress: 100, message: 'Done! ZIP downloaded successfully.', error: null });
  },

  cancelBulkWorkflow: () => {
    get().cancelAnalysis();
    get().cancelVoiceGeneration();
    get().cancelExport();
    set({ bulkWorkflowStatus: { stage: 'cancelled', progress: 0, message: 'Workflow cancelled.', error: null } });
  },
}));

/**
 * Packages all downloaded video blobs, audio voice blobs, and metadata files into a browser-generated ZIP.
 */
async function packageAndFinalizeZip(
  get: () => WorkflowState,
  set: (fn: (state: WorkflowState) => Partial<WorkflowState>) => void
): Promise<void> {
  const {
    scenes,
    options,
    searchStateByScene,
    imageSearchStateByScene,
    voiceStateByScene,
    excludedSceneIds,
    selectedVideoClipIdsByScene,
    selectedImageIdsByScene,
  } = get();
  const includedScenes = scenes.filter((s) => !excludedSceneIds.includes(s.id));
  const totalCount = includedScenes.length;
  const LABELS: CandidateLabel[] = ['A', 'B', 'C', 'D', 'E', 'F'];
  const IMAGE_LABELS: CandidateLabel[] = ['A', 'B', 'C', 'D', 'E'];

  const stockMediaType = options.stockMediaType ?? 'videos';
  const needsVideos = stockMediaType === 'videos' || stockMediaType === 'both';
  const needsImages = stockMediaType === 'images' || stockMediaType === 'both';

  set((state) => ({
    exportState: state.exportState
      ? { ...state.exportState, stage: 'preparing-files', error: null }
      : null,
  }));

  try {
    const scriptItems = includedScenes.map((scene, idx) => ({
      sequence: idx + 1,
      totalCount,
      scriptText: scene.scriptText,
    }));
    const scriptSegmentsText = generateScriptSegmentsText(scriptItems);

    const manifestEntries: ManifestEntry[] = [];
    const creditsEntries: CreditsEntry[] = [];
    const videoFiles: { filename: string; blob: Blob }[] = [];
    const imageFiles: { filename: string; blob: Blob }[] = [];
    const voiceFiles: { filename: string; blob: Blob }[] = [];

    const hasAnyVoice = includedScenes.some((s) => Boolean(voiceStateByScene[s.id]));

    for (let idx = 0; idx < includedScenes.length; idx++) {
      const scene = includedScenes[idx];
      const seq = idx + 1;
      const voiceFilename = getMp3Filename(seq, totalCount);

      const voiceState = voiceStateByScene[scene.id];
      if (hasAnyVoice) {
        if (!voiceState || !voiceState.audioBlob || voiceState.status !== 'ready') {
          throw new Error(`Missing voice audio for scene #${seq}.`);
        }
        voiceFiles.push({ filename: voiceFilename, blob: voiceState.audioBlob });
      }

      if (needsVideos) {
        const searchState = searchStateByScene[scene.id];
        if (!searchState || !Array.isArray(searchState.candidates) || searchState.candidates.length !== 6) {
          throw new Error(`Scene #${seq} does not have exactly six candidate clips.`);
        }

        const selectedIds = selectedVideoClipIdsByScene[scene.id] ?? searchState.candidates.map((c) => c.id);

        for (let j = 0; j < 6; j++) {
          const candidate = searchState.candidates[j];
          if (!selectedIds.includes(candidate.id)) {
            continue; // Skip unselected video clip
          }

          const label = LABELS[j];
          const filename = getMp4Filename(seq, totalCount, label);
          const cacheKey = `${scene.id}-${label}`;

          const videoBlob = clipBlobsCache.get(cacheKey);
          if (!videoBlob) {
            throw new Error(`Missing downloaded video blob for scene #${seq} Option ${label}.`);
          }
          videoFiles.push({ filename, blob: videoBlob });

          const variant = selectBestMp4Variant(candidate, options.orientation, options.quality);

          const activeVoiceProvider = options.voiceProvider || 'elevenlabs';
          manifestEntries.push({
            sequence: seq,
            candidateLabel: label,
            filename,
            scriptText: scene.scriptText,
            searchQuery: candidate.matchedQuery || searchState.query || scene.primaryQuery,
            pexelsVideoId: candidate.pexelsVideoId,
            sourceUrl: candidate.sourceUrl,
            creator: candidate.creatorName,
            creatorUrl: candidate.creatorUrl,
            durationSeconds: candidate.durationSeconds,
            width: variant.width,
            height: variant.height,
            voiceFilename: hasAnyVoice ? voiceFilename : undefined,
            elevenLabsVoiceId: hasAnyVoice && activeVoiceProvider === 'elevenlabs' ? options.elevenLabs.voiceId : (hasAnyVoice && activeVoiceProvider === 'ai33pro' ? (options.ai33Pro?.voiceId || DEFAULT_AI33PRO_SETTINGS.voiceId) : undefined),
            elevenLabsModelId: hasAnyVoice && activeVoiceProvider === 'elevenlabs' ? options.elevenLabs.modelId : undefined,
            audioOutputFormat: hasAnyVoice && activeVoiceProvider === 'elevenlabs' ? options.elevenLabs.outputFormat : undefined,
            audioDurationSeconds: hasAnyVoice && voiceState ? voiceState.durationSeconds : undefined,
          });

          creditsEntries.push({
            sequence: seq,
            candidateLabel: label,
            filename,
            creator: candidate.creatorName,
            creatorUrl: candidate.creatorUrl,
            sourceUrl: candidate.sourceUrl,
          });
        }
      }

      if (needsImages) {
        const imgState = imageSearchStateByScene[scene.id];
        if (imgState && imgState.status === 'ready' && Array.isArray(imgState.candidates)) {
          const selectedImgIds = selectedImageIdsByScene[scene.id] ?? imgState.candidates.map((c) => c.pexelsPhotoId);

          for (let j = 0; j < imgState.candidates.length; j++) {
            const candidate = imgState.candidates[j];
            if (!selectedImgIds.includes(candidate.pexelsPhotoId)) {
              continue; // Skip unselected image
            }

            const label: CandidateLabel = candidate.candidateLabel || IMAGE_LABELS[j] || 'A';
            const filename = getImageFilename(seq, totalCount, label);

            try {
              const imageUrl = candidate.previewImageUrl || candidate.files[0]?.url;
              if (imageUrl) {
                const resp = await fetch(imageUrl);
                const blob = await resp.blob();
                imageFiles.push({ filename, blob });
              }
            } catch {
              // skip failed image download
            }

            creditsEntries.push({
              sequence: seq,
              candidateLabel: label,
              filename,
              creator: candidate.creatorName,
              creatorUrl: candidate.creatorUrl,
              sourceUrl: candidate.sourceUrl,
            });
          }
        }
      }
    }

    const manifestCsvText = generateManifestCsv(manifestEntries);
    const creditsText = generateCreditsText(creditsEntries);

    set((state) => ({
      exportState: state.exportState
        ? { ...state.exportState, stage: 'compressing', error: null }
        : null,
    }));

    const zipBlob = await buildZipPackage({
      videos: videoFiles,
      images: imageFiles,
      voices: voiceFiles,
      scriptSegmentsText,
      manifestCsvText,
      creditsText,
    });

    const zipBlobUrl = URL.createObjectURL(zipBlob);

    // Release individual video blobs from memory now that the ZIP is generated
    clipBlobsCache.clear();

    set((state) => ({
      step: 'complete',
      exportState: state.exportState
        ? {
            ...state.exportState,
            stage: 'complete',
            zipBlobUrl,
            error: null,
          }
        : null,
      activeDownloadController: null,
    }));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'ZIP generation failed.';
    set((state) => ({
      exportState: state.exportState
        ? { ...state.exportState, stage: 'failed', error: msg }
        : null,
      activeDownloadController: null,
    }));
  }
}
