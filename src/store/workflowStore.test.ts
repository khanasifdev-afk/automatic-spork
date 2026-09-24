import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useWorkflowStore } from './workflowStore';
import * as geminiService from '../services/gemini';
import * as pexelsService from '../services/pexels';
import * as elevenLabsService from '../services/elevenLabs';
import * as ai33ProService from '../services/ai33Pro';
import * as storage from '../storage/settingsStorage';
import { Scene, ClipCandidate, VoiceSegmentState } from '../types';
import { createSourceTextFingerprint, createSettingsFingerprint } from '../utils/fingerprints';

function createMockReadyVoice(
  sceneId: string,
  scriptText: string,
  options = useWorkflowStore.getState().options.elevenLabs
): VoiceSegmentState {
  return {
    sceneId,
    provider: 'elevenlabs',
    status: 'ready',
    sourceTextFingerprint: createSourceTextFingerprint(scriptText),
    settingsFingerprint: createSettingsFingerprint(options),
    audioBlob: new Blob(['mock audio'], { type: 'audio/mpeg' }),
    audioUrl: `blob:http://localhost/voice-${sceneId}`,
    durationSeconds: 5,
    requestId: 'req-123',
    error: null,
  };
}

describe('workflowStore', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    globalThis.URL.createObjectURL = vi.fn().mockImplementation(() => 'blob:http://localhost/mock-url');
    globalThis.URL.revokeObjectURL = vi.fn();
    useWorkflowStore.getState().startOver();
  });

  it('initializes job options from saved settings without modifying them', () => {
    vi.spyOn(storage, 'loadSettings').mockReturnValue({
      ...storage.DEFAULT_SETTINGS,
      geminiApiKey: 'test-key',
      pexelsApiKey: 'pexels-key',
      elevenLabsApiKey: 'eleven-key',
      defaultOrientation: 'portrait',
      defaultQuality: '4k',
      defaultSceneLength: 'long',
      defaultElevenLabs: storage.DEFAULT_ELEVENLABS_SETTINGS,
    });

    useWorkflowStore.getState().initializeFromSettings();
    const state = useWorkflowStore.getState();

    expect(state.options.orientation).toBe('portrait');
    expect(state.options.quality).toBe('4k');
    expect(state.options.sceneLength).toBe('long');
  });

  it('updates options in memory without calling saveSettings', () => {
    const saveSpy = vi.spyOn(storage, 'saveSettings');
    useWorkflowStore.getState().setOptions({ orientation: 'landscape' });

    expect(useWorkflowStore.getState().options.orientation).toBe('landscape');
    expect(saveSpy).not.toHaveBeenCalled();
  });

  it('sets error and blocks analysis on empty script', async () => {
    useWorkflowStore.getState().setScript('   ');
    await useWorkflowStore.getState().analyzeScript('gemini-key');

    const state = useWorkflowStore.getState();
    expect(state.status).toBe('error');
    expect(state.error).toContain('Script cannot be empty');
    expect(state.scenes).toHaveLength(0);
  });

  it('successfully analyzes script, numbers scenes, and updates step', async () => {
    const mockScenes: Scene[] = [
      {
        id: 's1',
        sequence: 1,
        scriptText: 'First segment narration.',
        visualDescription: 'A sunrise over mountains.',
        primaryQuery: 'sunrise mountain',
        fallbackQueries: [],
        avoidTerms: [],
        estimatedSeconds: 5,
      },
      {
        id: 's2',
        sequence: 2,
        scriptText: 'Second segment narration.',
        visualDescription: 'A hiker walking up trail.',
        primaryQuery: 'hiker mountain trail',
        fallbackQueries: [],
        avoidTerms: [],
        estimatedSeconds: 6,
      },
    ];

    vi.spyOn(geminiService, 'analyzeScriptWithGemini').mockResolvedValue(mockScenes);

    useWorkflowStore.getState().setScript('First segment narration. Second segment narration.');
    await useWorkflowStore.getState().analyzeScript('gemini-key');

    const state = useWorkflowStore.getState();
    expect(state.status).toBe('ready');
    expect(state.step).toBe('scenes');
    expect(state.scenes).toHaveLength(2);
    expect(state.scenes[0].sequence).toBe(1);
    expect(state.scenes[1].sequence).toBe(2);
  });

  it('preserves script and options on Gemini error', async () => {
    vi.spyOn(geminiService, 'analyzeScriptWithGemini').mockRejectedValue(
      new geminiService.GeminiAnalysisError('Quota limit reached', 429)
    );

    const scriptText = 'Narration text that should be preserved.';
    useWorkflowStore.getState().setScript(scriptText);
    useWorkflowStore.getState().setOptions({ quality: '4k' });

    await useWorkflowStore.getState().analyzeScript('gemini-key');

    const state = useWorkflowStore.getState();
    expect(state.status).toBe('error');
    expect(state.error).toBe('Quota limit reached');
    expect(state.script).toBe(scriptText);
    expect(state.options.quality).toBe('4k');
    expect(state.scenes).toHaveLength(0);
  });

  it('edits scene text and invalidates existing search results', () => {
    useWorkflowStore.setState({
      scenes: [
        {
          id: 'scene-1',
          sequence: 1,
          scriptText: 'Original text',
          visualDescription: 'Original visual',
          primaryQuery: 'original query',
          fallbackQueries: [],
          avoidTerms: [],
          estimatedSeconds: 4,
        },
      ],
      searchStateByScene: {
        'scene-1': {
          status: 'ready',
          query: 'original query',
          candidates: [],
          selectedCandidateId: null,
          error: null,
        },
      },
    });

    const success = useWorkflowStore.getState().editScene('scene-1', {
      scriptText: 'Updated text',
      primaryQuery: 'new query',
    });

    expect(success).toBe(true);
    const state = useWorkflowStore.getState();
    expect(state.scenes[0].scriptText).toBe('Updated text');
    expect(state.scenes[0].primaryQuery).toBe('new query');
    expect(state.searchStateByScene['scene-1']).toBeUndefined();
  });

  it('rejects empty script text when editing scene', () => {
    useWorkflowStore.setState({
      scenes: [
        {
          id: 'scene-1',
          sequence: 1,
          scriptText: 'Valid text',
          visualDescription: 'Desc',
          primaryQuery: 'query',
          fallbackQueries: [],
          avoidTerms: [],
          estimatedSeconds: 4,
        },
      ],
    });

    const success = useWorkflowStore.getState().editScene('scene-1', {
      scriptText: '   ',
    });

    expect(success).toBe(false);
    expect(useWorkflowStore.getState().scenes[0].scriptText).toBe('Valid text');
  });

  it('splits scene into two with new IDs and renumbers sequentially', () => {
    useWorkflowStore.setState({
      scenes: [
        {
          id: 'scene-1',
          sequence: 1,
          scriptText: 'Full segment text.',
          visualDescription: 'Visual',
          primaryQuery: 'query',
          fallbackQueries: [],
          avoidTerms: [],
          estimatedSeconds: 6,
        },
        {
          id: 'scene-2',
          sequence: 2,
          scriptText: 'Next segment.',
          visualDescription: 'Visual 2',
          primaryQuery: 'query 2',
          fallbackQueries: [],
          avoidTerms: [],
          estimatedSeconds: 4,
        },
      ],
      searchStateByScene: {
        'scene-1': {
          status: 'ready',
          query: 'query',
          candidates: [],
          selectedCandidateId: null,
          error: null,
        },
      },
    });

    const success = useWorkflowStore.getState().splitScene(
      'scene-1',
      'First half text.',
      'Second half text.'
    );

    expect(success).toBe(true);
    const state = useWorkflowStore.getState();
    expect(state.scenes).toHaveLength(3);
    expect(state.scenes[0].sequence).toBe(1);
    expect(state.scenes[0].scriptText).toBe('First half text.');
    expect(state.scenes[1].sequence).toBe(2);
    expect(state.scenes[1].scriptText).toBe('Second half text.');
    expect(state.scenes[2].sequence).toBe(3);
    expect(state.scenes[2].scriptText).toBe('Next segment.');
    expect(state.searchStateByScene['scene-1']).toBeUndefined();
  });

  it('merges adjacent scenes with single space and renumbers', () => {
    useWorkflowStore.setState({
      scenes: [
        {
          id: 'scene-1',
          sequence: 1,
          scriptText: 'First segment.',
          visualDescription: 'Visual 1',
          primaryQuery: 'query 1',
          fallbackQueries: ['fallback 1'],
          avoidTerms: [],
          estimatedSeconds: 4,
        },
        {
          id: 'scene-2',
          sequence: 2,
          scriptText: 'Second segment.',
          visualDescription: 'Visual 2',
          primaryQuery: 'query 2',
          fallbackQueries: ['fallback 2'],
          avoidTerms: [],
          estimatedSeconds: 4,
        },
      ],
    });

    const success = useWorkflowStore.getState().mergeScenes('scene-1', 'scene-2');
    expect(success).toBe(true);

    const state = useWorkflowStore.getState();
    expect(state.scenes).toHaveLength(1);
    expect(state.scenes[0].sequence).toBe(1);
    expect(state.scenes[0].scriptText).toBe('First segment. Second segment.');
  });

  it('deletes scene and renumbers remaining', () => {
    useWorkflowStore.setState({
      scenes: [
        {
          id: 'scene-1',
          sequence: 1,
          scriptText: 'Scene 1',
          visualDescription: 'V1',
          primaryQuery: 'q1',
          fallbackQueries: [],
          avoidTerms: [],
          estimatedSeconds: 4,
        },
        {
          id: 'scene-2',
          sequence: 2,
          scriptText: 'Scene 2',
          visualDescription: 'V2',
          primaryQuery: 'q2',
          fallbackQueries: [],
          avoidTerms: [],
          estimatedSeconds: 4,
        },
      ],
    });

    const success = useWorkflowStore.getState().deleteScene('scene-1');
    expect(success).toBe(true);

    const state = useWorkflowStore.getState();
    expect(state.scenes).toHaveLength(1);
    expect(state.scenes[0].id).toBe('scene-2');
    expect(state.scenes[0].sequence).toBe(1);
  });

  it('reorders scenes up and down and updates sequences', () => {
    useWorkflowStore.setState({
      scenes: [
        {
          id: 'scene-1',
          sequence: 1,
          scriptText: 'Scene 1',
          visualDescription: 'V1',
          primaryQuery: 'q1',
          fallbackQueries: [],
          avoidTerms: [],
          estimatedSeconds: 4,
        },
        {
          id: 'scene-2',
          sequence: 2,
          scriptText: 'Scene 2',
          visualDescription: 'V2',
          primaryQuery: 'q2',
          fallbackQueries: [],
          avoidTerms: [],
          estimatedSeconds: 4,
        },
      ],
    });

    const success = useWorkflowStore.getState().reorderScene('scene-2', 'up');
    expect(success).toBe(true);

    const state = useWorkflowStore.getState();
    expect(state.scenes[0].id).toBe('scene-2');
    expect(state.scenes[0].sequence).toBe(1);
    expect(state.scenes[1].id).toBe('scene-1');
    expect(state.scenes[1].sequence).toBe(2);
  });

  it('proceedToClips requires at least one valid scene', () => {
    expect(useWorkflowStore.getState().proceedToClips()).toBe(false);

    useWorkflowStore.setState({
      scenes: [
        {
          id: 'scene-1',
          sequence: 1,
          scriptText: 'Valid text',
          visualDescription: 'Visual',
          primaryQuery: 'Query',
          fallbackQueries: [],
          avoidTerms: [],
          estimatedSeconds: 5,
        },
      ],
    });

    expect(useWorkflowStore.getState().proceedToClips()).toBe(true);
    expect(useWorkflowStore.getState().step).toBe('clips');
  });

  // Feature 3 tests
  describe('Feature 3 Video Search & Selection', () => {
    const createSixMockCandidates = (scenePrefix: number, query = 'ocean waves'): ClipCandidate[] => {
      const labels: ('A' | 'B' | 'C' | 'D' | 'E' | 'F')[] = ['A', 'B', 'C', 'D', 'E', 'F'];
      return labels.map((label, i) => ({
        id: `clip-${scenePrefix * 100 + i + 1}`,
        pexelsVideoId: scenePrefix * 100 + i + 1,
        sourceUrl: `https://pexels.com/video/${scenePrefix * 100 + i + 1}`,
        creatorName: `Creator ${scenePrefix}-${label}`,
        creatorUrl: `https://pexels.com/@creator${scenePrefix}`,
        previewImageUrl: `https://pexels.com/preview${scenePrefix}-${i}.jpg`,
        previewVideoUrl: `https://pexels.com/video${scenePrefix}-${i}.mp4`,
        durationSeconds: 10 + i,
        width: 1920,
        height: 1080,
        files: [
          {
            url: `https://example.com/video-${scenePrefix * 100 + i + 1}.mp4`,
            mimeType: 'video/mp4',
            width: 1920,
            height: 1080,
          },
        ],
        matchedQuery: query,
        score: 90 - i * 5,
        confidence: 'strong',
        candidateLabel: label,
      }));
    };

    beforeEach(() => {
      useWorkflowStore.setState({
        scenes: [
          {
            id: 'scene-1',
            sequence: 1,
            scriptText: 'Walking along the beach.',
            visualDescription: 'Waves crashing on beach.',
            primaryQuery: 'ocean waves',
            fallbackQueries: [],
            avoidTerms: [],
            estimatedSeconds: 6,
          },
          {
            id: 'scene-2',
            sequence: 2,
            scriptText: 'Sunset over the horizon.',
            visualDescription: 'Sunset beach horizon.',
            primaryQuery: 'sunset beach',
            fallbackQueries: [],
            avoidTerms: [],
            estimatedSeconds: 6,
          },
        ],
      });
    });

    it('sets error state if searchAllScenes is called without an API key', async () => {
      await useWorkflowStore.getState().searchAllScenes('');
      const state = useWorkflowStore.getState();
      expect(state.searchStateByScene['scene-1']?.status).toBe('error');
      expect(state.searchStateByScene['scene-1']?.error).toContain('Pexels API key is missing');
    });

    it('searches all scenes and assigns six candidates with labels A-F per scene', async () => {
      const candidates1 = createSixMockCandidates(1, 'ocean waves');
      const candidates2 = createSixMockCandidates(2, 'sunset beach');
      vi.spyOn(pexelsService, 'searchClipsForScene')
        .mockResolvedValueOnce(candidates1)
        .mockResolvedValueOnce(candidates2);

      await useWorkflowStore.getState().searchAllScenes('valid-pexels-key');

      const state = useWorkflowStore.getState();
      expect(state.searchStateByScene['scene-1']?.status).toBe('ready');
      expect(state.searchStateByScene['scene-1']?.candidates).toHaveLength(6);
      expect(state.searchStateByScene['scene-1']?.candidates.map((c) => c.candidateLabel)).toEqual([
        'A',
        'B',
        'C',
        'D',
        'E',
        'F',
      ]);

      expect(state.searchStateByScene['scene-2']?.status).toBe('ready');
      expect(state.searchStateByScene['scene-2']?.candidates).toHaveLength(6);
      expect(state.searchStateByScene['scene-2']?.candidates.map((c) => c.candidateLabel)).toEqual([
        'A',
        'B',
        'C',
        'D',
        'E',
        'F',
      ]);
    });

    it('searches a single scene with a custom query without affecting other scenes', async () => {
      useWorkflowStore.setState({
        searchStateByScene: {
          'scene-1': {
            status: 'ready',
            query: 'ocean waves',
            candidates: createSixMockCandidates(1, 'ocean waves'),
            selectedCandidateId: 'clip-101',
            error: null,
          },
          'scene-2': {
            status: 'ready',
            query: 'sunset beach',
            candidates: createSixMockCandidates(2, 'sunset beach'),
            selectedCandidateId: 'clip-201',
            error: null,
          },
        },
      });

      const updatedCandidates = createSixMockCandidates(9, 'calm shoreline');

      vi.spyOn(pexelsService, 'searchClipsForScene').mockResolvedValueOnce(updatedCandidates);

      await useWorkflowStore.getState().searchScene('scene-1', 'valid-key', 'calm shoreline');

      const state = useWorkflowStore.getState();
      // Scene 1 updated with new results
      expect(state.searchStateByScene['scene-1'].query).toBe('calm shoreline');
      expect(state.searchStateByScene['scene-1'].candidates).toHaveLength(6);
      expect(state.searchStateByScene['scene-1'].candidates[0].id).toBe('clip-901');

      // Scene 2 remains completely untouched
      expect(state.searchStateByScene['scene-2'].candidates[0].id).toBe('clip-201');
      expect(state.searchStateByScene['scene-2'].query).toBe('sunset beach');
    });

    it('manually selects an alternative candidate', () => {
      useWorkflowStore.setState({
        searchStateByScene: {
          'scene-1': {
            status: 'ready',
            query: 'ocean waves',
            candidates: createSixMockCandidates(1, 'ocean waves'),
            selectedCandidateId: 'clip-101',
            error: null,
          },
        },
      });

      useWorkflowStore.getState().selectCandidate('scene-1', 'clip-102');
      expect(useWorkflowStore.getState().searchStateByScene['scene-1'].selectedCandidateId).toBe(
        'clip-102'
      );
    });

    it('excludes and restores a scene', () => {
      expect(useWorkflowStore.getState().excludedSceneIds).toHaveLength(0);

      useWorkflowStore.getState().excludeScene('scene-1');
      expect(useWorkflowStore.getState().excludedSceneIds).toContain('scene-1');

      useWorkflowStore.getState().restoreScene('scene-1');
      expect(useWorkflowStore.getState().excludedSceneIds).not.toContain('scene-1');
    });

    it('canProceedToPackaging blocks if any included scene lacks six candidates', () => {
      const s1: Scene = {
        id: 'scene-1',
        sequence: 1,
        scriptText: 'First segment.',
        visualDescription: 'Visual 1',
        primaryQuery: 'ocean waves',
        fallbackQueries: [],
        avoidTerms: [],
        estimatedSeconds: 5,
      };
      const s2: Scene = {
        id: 'scene-2',
        sequence: 2,
        scriptText: 'Second segment.',
        visualDescription: 'Visual 2',
        primaryQuery: 'sunset beach',
        fallbackQueries: [],
        avoidTerms: [],
        estimatedSeconds: 5,
      };

      // Both scenes ready with voice
      useWorkflowStore.setState({
        scenes: [s1, s2],
        voiceStateByScene: {
          'scene-1': createMockReadyVoice('scene-1', s1.scriptText),
          'scene-2': createMockReadyVoice('scene-2', s2.scriptText),
        },
        searchStateByScene: {
          'scene-1': {
            status: 'ready',
            query: 'ocean waves',
            candidates: createSixMockCandidates(1, 'ocean waves'),
            selectedCandidateId: 'clip-101',
            error: null,
          },
          'scene-2': {
            status: 'empty',
            query: 'sunset beach',
            candidates: createSixMockCandidates(2, 'sunset beach').slice(0, 3), // incomplete (<6)
            selectedCandidateId: null,
            error: 'Incomplete',
          },
        },
      });

      // Scene 2 has only 3 candidates -> blocked
      expect(useWorkflowStore.getState().canProceedToPackaging()).toBe(false);
      expect(useWorkflowStore.getState().proceedToPackaging()).toBe(false);

      // Exclude scene-2 -> now all included scenes (scene-1) are ready with 6 candidates
      useWorkflowStore.getState().excludeScene('scene-2');
      expect(useWorkflowStore.getState().canProceedToPackaging()).toBe(true);
      expect(useWorkflowStore.getState().proceedToPackaging()).toBe(true);
      expect(useWorkflowStore.getState().step).toBe('packaging');
    });
  });

  describe('Feature 4: Export and Packaging Actions', () => {
    const mockScene1: Scene = {
      id: 'scene-1',
      sequence: 1,
      scriptText: 'First line of script text.',
      visualDescription: 'First scene visual.',
      primaryQuery: 'ocean waves',
      fallbackQueries: [],
      avoidTerms: [],
      estimatedSeconds: 5,
    };

    const mockScene2: Scene = {
      id: 'scene-2',
      sequence: 2,
      scriptText: 'Second line of script text.',
      visualDescription: 'Second scene visual.',
      primaryQuery: 'sunset beach',
      fallbackQueries: [],
      avoidTerms: [],
      estimatedSeconds: 6,
    };

    beforeEach(() => {
      globalThis.URL.createObjectURL = vi.fn().mockReturnValue('blob:http://localhost/test-zip');
      globalThis.URL.revokeObjectURL = vi.fn();
    });

    const createSixMockCandidates4 = (sceneIdNum: number, query = 'ocean waves'): ClipCandidate[] =>
      (['A', 'B', 'C', 'D', 'E', 'F'] as const).map((label, i) => ({
        id: `clip-${sceneIdNum * 100 + i + 1}`,
        pexelsVideoId: sceneIdNum * 100 + i + 1,
        sourceUrl: `https://pexels.com/video/${sceneIdNum * 100 + i + 1}`,
        creatorName: `Creator ${sceneIdNum}-${label}`,
        creatorUrl: `https://pexels.com/@creator${sceneIdNum}`,
        previewImageUrl: `https://pexels.com/preview${sceneIdNum}-${i}.jpg`,
        durationSeconds: 10 + i,
        width: 1920,
        height: 1080,
        files: [
          {
            url: `https://example.com/video-${sceneIdNum * 100 + i + 1}.mp4`,
            mimeType: 'video/mp4',
            width: 1920,
            height: 1080,
          },
        ],
        matchedQuery: query,
        score: 90 - i * 5,
        confidence: 'strong',
        candidateLabel: label,
      }));

    it('blocks export if any included scene lacks a valid selection', async () => {
      useWorkflowStore.setState({
        scenes: [mockScene1],
        searchStateByScene: {
          'scene-1': {
            status: 'empty',
            query: 'ocean waves',
            candidates: [],
            selectedCandidateId: null,
            error: null,
          },
        },
      });

      await useWorkflowStore.getState().startExport();
      const state = useWorkflowStore.getState();
      expect(state.exportState?.stage).toBe('failed');
      expect(state.exportState?.error).toContain('Export is blocked');
    });

    it('blocks export if any included scene has fewer than 6 candidates', async () => {
      useWorkflowStore.setState({
        scenes: [mockScene1],
        searchStateByScene: {
          'scene-1': {
            status: 'ready',
            query: 'ocean waves',
            candidates: createSixMockCandidates4(1).slice(0, 5),
            selectedCandidateId: null,
            error: null,
          },
        },
      });

      await useWorkflowStore.getState().startExport();
      const state = useWorkflowStore.getState();
      expect(state.exportState?.stage).toBe('failed');
      expect(state.exportState?.error).toContain('Export is blocked');
    });

    it('successfully runs export, numbers included scenes with no gaps, and reaches complete stage', async () => {
      useWorkflowStore.setState({
        scenes: [mockScene1, mockScene2],
        excludedSceneIds: ['scene-1'], // exclude scene-1 to test exclusion & zero gap numbering
        voiceStateByScene: {
          'scene-1': createMockReadyVoice('scene-1', mockScene1.scriptText),
          'scene-2': createMockReadyVoice('scene-2', mockScene2.scriptText),
        },
        searchStateByScene: {
          'scene-1': {
            status: 'ready',
            query: 'ocean waves',
            candidates: createSixMockCandidates4(1),
            selectedCandidateId: 'clip-101',
            error: null,
          },
          'scene-2': {
            status: 'ready',
            query: 'sunset beach',
            candidates: createSixMockCandidates4(2, 'sunset beach'),
            selectedCandidateId: 'clip-201',
            error: null,
          },
        },
      });

      // Mock fetch for video file
      const mockBlob = new Blob([new Uint8Array([1, 2, 3])], { type: 'video/mp4' });
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-length': '3', 'content-type': 'video/mp4' }),
        body: {
          getReader: () => {
            let done = false;
            return {
              read: () => {
                if (done) return Promise.resolve({ done: true, value: undefined });
                done = true;
                return Promise.resolve({ done: false, value: new Uint8Array([1, 2, 3]) });
              },
            };
          },
        },
        blob: () => Promise.resolve(mockBlob),
      } as unknown as Response);

      await useWorkflowStore.getState().startExport();

      const state = useWorkflowStore.getState();
      expect(state.exportState?.stage).toBe('complete');
      expect(state.exportState?.zipBlobUrl).toBe('blob:http://localhost/test-zip');
      // Only scene-2 was included, so it receives sequence 1 and 001-A.mp4 through 001-F.mp4 (no gaps)
      expect(state.exportState?.clips).toHaveLength(6);
      expect(state.exportState?.clips[0].sequence).toBe(1);
      expect(state.exportState?.clips[0].candidateLabel).toBe('A');
      expect(state.exportState?.clips[0].filename).toBe('001-A.mp4');
      expect(state.exportState?.clips[0].state).toBe('complete');
      expect(state.exportState?.clips[5].sequence).toBe(1);
      expect(state.exportState?.clips[5].candidateLabel).toBe('F');
      expect(state.exportState?.clips[5].filename).toBe('001-F.mp4');
      expect(state.exportState?.clips[5].state).toBe('complete');
    });

    it('successfully validates AI33 Pro voice segments and exports ZIP without fingerprint mismatch error', async () => {
      const mockBlob = new Blob(['mock video data'], { type: 'video/mp4' });
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-length': '1024' }),
        body: {
          getReader() {
            let done = false;
            return {
              read() {
                if (done) return Promise.resolve({ done: true, value: undefined });
                done = true;
                return Promise.resolve({ done: false, value: new Uint8Array([1, 2, 3, 4]) });
              },
            };
          },
        },
        blob: () => Promise.resolve(mockBlob),
      } as unknown as Response);

      const ai33Opts = {
        sourceProvider: 'minimax' as const,
        voiceId: 'minimax_mature_partner',
        speed: 1.0,
      };
      const ai33Fp = createSettingsFingerprint('ai33pro', ai33Opts);

      useWorkflowStore.setState({
        options: {
          ...useWorkflowStore.getState().options,
          voiceProvider: 'ai33pro',
          ai33Pro: ai33Opts,
        },
        scenes: [mockScene1],
        voiceStateByScene: {
          'scene-1': {
            sceneId: 'scene-1',
            provider: 'ai33pro',
            status: 'ready',
            sourceTextFingerprint: createSourceTextFingerprint(mockScene1.scriptText),
            settingsFingerprint: ai33Fp,
            audioBlob: new Blob(['ai33 audio'], { type: 'audio/mpeg' }),
            audioUrl: 'blob:http://localhost/ai33-voice-scene-1',
            durationSeconds: 5.3,
            taskId: 'ai33-task-1',
            creditCost: 1,
            error: null,
          },
        },
        searchStateByScene: {
          'scene-1': {
            status: 'ready',
            query: 'ocean waves',
            candidates: createSixMockCandidates4(1),
            selectedCandidateId: null,
            error: null,
          },
        },
      });

      await useWorkflowStore.getState().startExport();

      const state = useWorkflowStore.getState();
      expect(state.exportState?.stage).toBe('complete');
      expect(state.exportState?.error).toBeNull();
      expect(state.exportState?.zipBlobUrl).toBe('blob:http://localhost/test-zip');
    });

    it('cancels export and marks active clips as cancelled', async () => {
      useWorkflowStore.setState({
        scenes: [mockScene1],
        voiceStateByScene: {
          'scene-1': createMockReadyVoice('scene-1', mockScene1.scriptText),
        },
        searchStateByScene: {
          'scene-1': {
            status: 'ready',
            query: 'ocean waves',
            candidates: createSixMockCandidates4(1),
            selectedCandidateId: 'clip-101',
            error: null,
          },
        },
      });

      // Hang fetch indefinitely until aborted
      vi.spyOn(globalThis, 'fetch').mockImplementation((_url, opts) => {
        return new Promise((_, reject) => {
          opts?.signal?.addEventListener('abort', () => {
            const err = new DOMException('Operation aborted', 'AbortError');
            reject(err);
          });
        });
      });

      const exportPromise = useWorkflowStore.getState().startExport();
      // Cancel immediately
      useWorkflowStore.getState().cancelExport();
      await exportPromise;

      const state = useWorkflowStore.getState();
      expect(state.exportState?.stage).toBe('cancelled');
    });

    it('retrying a failed clip downloads it and completes packaging', async () => {
      useWorkflowStore.setState({
        scenes: [mockScene1],
        voiceStateByScene: {
          'scene-1': createMockReadyVoice('scene-1', mockScene1.scriptText),
        },
        searchStateByScene: {
          'scene-1': {
            status: 'ready',
            query: 'ocean waves',
            candidates: createSixMockCandidates4(1),
            selectedCandidateId: 'clip-101',
            error: null,
          },
        },
      });

      const mockBlob = new Blob([new Uint8Array([1, 2, 3])], { type: 'video/mp4' });
      const createMockResponse = () =>
        ({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-length': '3', 'content-type': 'video/mp4' }),
          body: {
            getReader: () => {
              let done = false;
              return {
                read: () => {
                  if (done) return Promise.resolve({ done: true, value: undefined });
                  done = true;
                  return Promise.resolve({ done: false, value: new Uint8Array([1, 2, 3]) });
                },
              };
            },
          },
          blob: () => Promise.resolve(mockBlob),
        } as unknown as Response);

      // First fetch fails with 500, others succeed
      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          headers: new Headers(),
        } as unknown as Response)
        .mockResolvedValue(createMockResponse());

      await useWorkflowStore.getState().startExport();

      expect(useWorkflowStore.getState().exportState?.stage).toBe('downloading');
      expect(useWorkflowStore.getState().exportState?.clips[0].state).toBe('failed');
      expect(useWorkflowStore.getState().exportState?.clips[1].state).toBe('complete');

      // Retry candidate A succeeds
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(createMockResponse());

      await useWorkflowStore.getState().retryClipDownload('scene-1', 'A');

      const state = useWorkflowStore.getState();
      expect(state.exportState?.stage).toBe('complete');
      expect(state.exportState?.clips[0].state).toBe('complete');
      expect(state.exportState?.zipBlobUrl).toBe('blob:http://localhost/test-zip');
    });

    it('startOver completely clears exportState, aborts controller, and revokes URLs', () => {
      useWorkflowStore.setState({
        exportState: {
          stage: 'complete',
          clips: [],
          zipBlobUrl: 'blob:http://localhost/test-zip',
          error: null,
        },
      });

      useWorkflowStore.getState().startOver();

      expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith('blob:http://localhost/test-zip');
      expect(useWorkflowStore.getState().exportState).toBeNull();
      expect(useWorkflowStore.getState().step).toBe('setup');
    });
  });

  describe('Feature 5: ElevenLabs Voice Generation', () => {
    const mockSceneA: Scene = {
      id: 'scene-a',
      sequence: 1,
      scriptText: 'Regular walking can improve balance and confidence.',
      visualDescription: 'Senior walking in park',
      primaryQuery: 'walking park',
      fallbackQueries: [],
      avoidTerms: [],
      estimatedSeconds: 5,
    };

    const mockSceneB: Scene = {
      id: 'scene-b',
      sequence: 2,
      scriptText: 'Small daily habits add up over time.',
      visualDescription: 'Healthy routine',
      primaryQuery: 'healthy routine',
      fallbackQueries: [],
      avoidTerms: [],
      estimatedSeconds: 4,
    };

    it('proceedToVoices transitions to voices step when valid scenes exist', () => {
      useWorkflowStore.setState({ scenes: [mockSceneA] });
      expect(useWorkflowStore.getState().proceedToVoices()).toBe(true);
      expect(useWorkflowStore.getState().step).toBe('voices');
    });

    it('proceedToVoices rejects when no scenes exist', () => {
      useWorkflowStore.setState({ scenes: [] });
      expect(useWorkflowStore.getState().proceedToVoices()).toBe(false);
    });

    it('generateAllVoices sets error when ElevenLabs key is missing', async () => {
      useWorkflowStore.setState({ scenes: [mockSceneA] });
      await useWorkflowStore.getState().generateAllVoices('');

      const voice = useWorkflowStore.getState().voiceStateByScene['scene-a'];
      expect(voice?.status).toBe('failed');
      expect(voice?.error).toContain('API key is missing');
    });

    it('generateAllVoices batches requests with concurrency and updates voice states to ready', async () => {
      useWorkflowStore.setState({ scenes: [mockSceneA, mockSceneB] });

      const fakeAudioBlob = new Blob(['mock audio'], { type: 'audio/mpeg' });
      vi.spyOn(elevenLabsService, 'generateSpeechForScene').mockResolvedValue({
        audioBlob: fakeAudioBlob,
        durationSeconds: 4.8,
        requestId: 'req-456',
      });

      await useWorkflowStore.getState().generateAllVoices('valid-eleven-key');

      const state = useWorkflowStore.getState();
      expect(state.isVoiceBatchRunning).toBe(false);
      expect(state.voiceStateByScene['scene-a']?.status).toBe('ready');
      expect(state.voiceStateByScene['scene-a']?.durationSeconds).toBe(4.8);
      expect(state.voiceStateByScene['scene-a']?.audioUrl).toBeDefined();

      expect(state.voiceStateByScene['scene-b']?.status).toBe('ready');
      expect(state.voiceStateByScene['scene-b']?.durationSeconds).toBe(4.8);
    });

    it('invalidates voice to stale when scriptText is edited, but preserves on query edit', () => {
      useWorkflowStore.setState({
        scenes: [mockSceneA],
        voiceStateByScene: {
          'scene-a': createMockReadyVoice('scene-a', mockSceneA.scriptText),
        },
      });

      // Editing only primaryQuery should PRESERVE ready voice
      useWorkflowStore.getState().editScene('scene-a', { primaryQuery: 'new query' });
      expect(useWorkflowStore.getState().voiceStateByScene['scene-a']?.status).toBe('ready');

      // Editing scriptText must invalidate audio to STALE
      useWorkflowStore.getState().editScene('scene-a', { scriptText: 'Modified narration text.' });
      expect(useWorkflowStore.getState().voiceStateByScene['scene-a']?.status).toBe('stale');
    });

    it('removes voice audio and revokes URLs on splitScene and mergeScenes', () => {
      useWorkflowStore.setState({
        scenes: [mockSceneA, mockSceneB],
        voiceStateByScene: {
          'scene-a': createMockReadyVoice('scene-a', mockSceneA.scriptText),
          'scene-b': createMockReadyVoice('scene-b', mockSceneB.scriptText),
        },
      });

      // Split scene-a
      useWorkflowStore.getState().splitScene('scene-a', 'Part 1.', 'Part 2.');
      expect(useWorkflowStore.getState().voiceStateByScene['scene-a']).toBeUndefined();
      expect(globalThis.URL.revokeObjectURL).toHaveBeenCalled();

      // New scenes are idle (not present in voiceStateByScene)
      const currentScenes = useWorkflowStore.getState().scenes;
      expect(currentScenes).toHaveLength(3); // 2 split + scene-b
    });

    it('reordering scenes preserves valid voice audio', () => {
      useWorkflowStore.setState({
        scenes: [mockSceneA, mockSceneB],
        voiceStateByScene: {
          'scene-a': createMockReadyVoice('scene-a', mockSceneA.scriptText),
          'scene-b': createMockReadyVoice('scene-b', mockSceneB.scriptText),
        },
      });

      useWorkflowStore.getState().reorderScene('scene-a', 'down');

      const state = useWorkflowStore.getState();
      expect(state.scenes[0].id).toBe('scene-b');
      expect(state.scenes[1].id).toBe('scene-a');
      expect(state.voiceStateByScene['scene-a']?.status).toBe('ready');
      expect(state.voiceStateByScene['scene-b']?.status).toBe('ready');
    });

    it('changing ElevenLabs options marks existing ready voice segments as stale', () => {
      useWorkflowStore.setState({
        scenes: [mockSceneA],
        voiceStateByScene: {
          'scene-a': createMockReadyVoice('scene-a', mockSceneA.scriptText),
        },
      });

      useWorkflowStore.getState().setOptions({
        elevenLabs: {
          ...useWorkflowStore.getState().options.elevenLabs,
          stability: 0.9,
        },
      });

      expect(useWorkflowStore.getState().voiceStateByScene['scene-a']?.status).toBe('stale');
    });

    it('blocks export when any scene voice segment is stale or missing', async () => {
      useWorkflowStore.setState({
        scenes: [mockSceneA],
        voiceStateByScene: {
          'scene-a': {
            ...createMockReadyVoice('scene-a', mockSceneA.scriptText),
            status: 'stale',
          },
        },
        searchStateByScene: {
          'scene-a': {
            status: 'ready',
            query: 'walking park',
            candidates: [
              {
                id: 'clip-1',
                pexelsVideoId: 1,
                sourceUrl: 'https://pexels.com/1',
                creatorName: 'Creator',
                creatorUrl: 'https://pexels.com/@creator',
                previewImageUrl: 'https://pexels.com/preview.jpg',
                durationSeconds: 5,
                width: 1920,
                height: 1080,
                files: [{ url: 'https://example.com/1.mp4', mimeType: 'video/mp4', width: 1920, height: 1080 }],
                matchedQuery: 'walking park',
                score: 90,
                confidence: 'strong',
              },
            ],
            selectedCandidateId: 'clip-1',
            error: null,
          },
        },
      });

      expect(useWorkflowStore.getState().canProceedToPackaging()).toBe(false);

      await useWorkflowStore.getState().startExport();
      expect(useWorkflowStore.getState().exportState?.stage).toBe('failed');
      expect(useWorkflowStore.getState().exportState?.error).toContain('Export is blocked');
    });

    it('generates voices with AI33 Pro adapter when voiceProvider is ai33pro', async () => {
      useWorkflowStore.setState({
        scenes: [mockSceneA],
        options: {
          ...useWorkflowStore.getState().options,
          voiceProvider: 'ai33pro',
          ai33Pro: {
            sourceProvider: 'elevenlabs',
            voiceId: 'elevenlabs_21m00Tcm4TlvDq8ikWAM',
            speed: 1.0,
          },
        },
      });

      const fakeBlob = new Blob(['ai33-audio'], { type: 'audio/mpeg' });
      vi.spyOn(ai33ProService, 'generateAi33ProSpeech').mockResolvedValue({
        audioBlob: fakeBlob,
        durationSeconds: 3.8,
        taskId: 'ai33-task-123',
        creditCost: 12,
      });

      await useWorkflowStore.getState().generateAllVoices('ai33-valid-key');

      const voice = useWorkflowStore.getState().voiceStateByScene['scene-a'];
      expect(voice?.status).toBe('ready');
      expect(voice?.provider).toBe('ai33pro');
      expect(voice?.taskId).toBe('ai33-task-123');
      expect(voice?.creditCost).toBe(12);
      expect(voice?.durationSeconds).toBe(3.8);
    });

    it('switching voiceProvider marks existing ready voices as stale', () => {
      useWorkflowStore.setState({
        scenes: [mockSceneA],
        options: {
          ...useWorkflowStore.getState().options,
          voiceProvider: 'elevenlabs',
        },
        voiceStateByScene: {
          'scene-a': {
            ...createMockReadyVoice('scene-a', mockSceneA.scriptText),
            provider: 'elevenlabs',
          },
        },
      });

      expect(useWorkflowStore.getState().voiceStateByScene['scene-a']?.status).toBe('ready');

      useWorkflowStore.getState().setOptions({
        voiceProvider: 'ai33pro',
      });

      expect(useWorkflowStore.getState().voiceStateByScene['scene-a']?.status).toBe('stale');
    });

    it('initializeFromSettings loads defaults for active provider from storage', () => {
      vi.spyOn(storage, 'loadSettings').mockReturnValue({
        ...storage.loadSettings(),
        defaultVoiceProvider: 'ai33pro',
        defaultAi33Pro: {
          sourceProvider: 'minimax',
          voiceId: 'minimax_custom_id',
          speed: 1.25,
        },
      });

      useWorkflowStore.setState({ status: 'idle', scenes: [] });
      useWorkflowStore.getState().initializeFromSettings();

      const { options } = useWorkflowStore.getState();
      expect(options.voiceProvider).toBe('ai33pro');
      expect(options.ai33Pro?.sourceProvider).toBe('minimax');
      expect(options.ai33Pro?.voiceId).toBe('minimax_custom_id');
      expect(options.ai33Pro?.speed).toBe(1.25);
    });

    it('workflow-level option changes do not overwrite saved defaults in localStorage', () => {
      const saveSpy = vi.spyOn(storage, 'saveSettings');

      useWorkflowStore.getState().setOptions({
        voiceProvider: 'ai33pro',
        ai33Pro: {
          sourceProvider: 'edge',
          voiceId: 'edge_voice_temp',
          speed: 0.8,
        },
      });

      expect(saveSpy).not.toHaveBeenCalled();
    });

    it('switchVoiceProvider switches provider and initializes workflow settings from saved defaults', () => {
      vi.spyOn(storage, 'loadSettings').mockReturnValue({
        ...storage.loadSettings(),
        defaultAi33Pro: {
          sourceProvider: 'edge',
          voiceId: 'edge_default_id',
          speed: 1.15,
        },
      });

      useWorkflowStore.setState({
        options: {
          ...useWorkflowStore.getState().options,
          voiceProvider: 'elevenlabs',
        },
        voiceStateByScene: {},
      });

      useWorkflowStore.getState().switchVoiceProvider('ai33pro');

      const { options, voiceStateByScene } = useWorkflowStore.getState();
      expect(options.voiceProvider).toBe('ai33pro');
      expect(options.ai33Pro?.voiceId).toBe('edge_default_id');
      expect(options.ai33Pro?.speed).toBe(1.15);
      expect(voiceStateByScene).toEqual({});
    });

    it('switchVoiceProvider with existing audio revokes object URLs and clears all voice state', () => {
      useWorkflowStore.setState({
        voiceStateByScene: {
          'scene-a': {
            ...createMockReadyVoice('scene-a', mockSceneA.scriptText),
            audioUrl: 'blob:http://localhost/audio-to-revoke',
          },
        },
      });

      useWorkflowStore.getState().switchVoiceProvider('ai33pro');

      expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith('blob:http://localhost/audio-to-revoke');
      expect(useWorkflowStore.getState().voiceStateByScene).toEqual({});
    });

    it('changing AI33 voice source marks existing ready AI33 audio as stale', () => {
      useWorkflowStore.setState({
        scenes: [mockSceneA],
        options: {
          ...useWorkflowStore.getState().options,
          voiceProvider: 'ai33pro',
          ai33Pro: {
            sourceProvider: 'elevenlabs',
            voiceId: 'elevenlabs_voice',
            speed: 1.0,
          },
        },
        voiceStateByScene: {
          'scene-a': {
            ...createMockReadyVoice('scene-a', mockSceneA.scriptText),
            provider: 'ai33pro',
          },
        },
      });

      expect(useWorkflowStore.getState().voiceStateByScene['scene-a']?.status).toBe('ready');

      // Change sourceProvider from elevenlabs to minimax
      useWorkflowStore.getState().setOptions({
        ai33Pro: {
          sourceProvider: 'minimax',
          voiceId: 'minimax_voice',
          speed: 1.0,
        },
      });

      expect(useWorkflowStore.getState().voiceStateByScene['scene-a']?.status).toBe('stale');
    });

    it('cancelVoiceGeneration aborts active requests and updates status to cancelled', () => {
      useWorkflowStore.setState({
        voiceStateByScene: {
          'scene-a': {
            sceneId: 'scene-a',
            provider: 'elevenlabs',
            status: 'generating',
            sourceTextFingerprint: 'fp',
            settingsFingerprint: 'sfp',
            audioBlob: null,
            audioUrl: null,
            durationSeconds: null,
            error: null,
          },
        },
        isVoiceBatchRunning: true,
      });

      useWorkflowStore.getState().cancelVoiceGeneration();

      const state = useWorkflowStore.getState();
      expect(state.isVoiceBatchRunning).toBe(false);
      expect(state.voiceStateByScene['scene-a']?.status).toBe('cancelled');
      expect(state.voiceStateByScene['scene-a']?.error).toContain('cancelled');
    });
  });
});
