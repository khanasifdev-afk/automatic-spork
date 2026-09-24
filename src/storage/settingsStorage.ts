import {
  SavedSettings,
  OutputOrientation,
  VideoQuality,
  TargetSceneLength,
  ElevenLabsOptions,
  ElevenLabsOutputFormat,
  VoiceProvider,
  Ai33SourceProvider,
  Ai33ProOptions,
} from '../types';

export const STORAGE_KEY_V1 = 'youtube-stock-video-generator.settings.v1';
export const STORAGE_KEY_V2 = 'youtube-stock-video-generator.settings.v2';
export const STORAGE_KEY = 'youtube-stock-video-generator.settings.v3';

export const DEFAULT_ELEVENLABS_SETTINGS: ElevenLabsOptions = {
  voiceId: '',
  modelId: 'eleven_multilingual_v2',
  outputFormat: 'mp3_44100_128',
  stability: 0.5,
  similarityBoost: 0.75,
  style: 0,
  speed: 1,
  useSpeakerBoost: true,
};

export const DEFAULT_AI33PRO_SETTINGS: Ai33ProOptions = {
  sourceProvider: 'elevenlabs',
  voiceId: '',
  speed: 1.0,
};

export const DEFAULT_SETTINGS: SavedSettings = {
  geminiApiKey: '',
  pexelsApiKey: '',
  elevenLabsApiKey: '',
  ai33ProApiKey: '',
  defaultOrientation: 'landscape',
  defaultQuality: '1080p',
  defaultSceneLength: 'standard',
  defaultVoiceProvider: 'elevenlabs',
  defaultElevenLabs: DEFAULT_ELEVENLABS_SETTINGS,
  defaultAi33Pro: DEFAULT_AI33PRO_SETTINGS,
};

const VALID_ORIENTATIONS: OutputOrientation[] = ['landscape', 'portrait'];
const VALID_QUALITIES: VideoQuality[] = ['720p', '1080p', '4k'];
const VALID_SCENE_LENGTHS: TargetSceneLength[] = ['short', 'standard', 'long'];
const VALID_VOICE_PROVIDERS: VoiceProvider[] = ['elevenlabs', 'ai33pro'];
const VALID_AI33_SOURCE_PROVIDERS: Ai33SourceProvider[] = [
  'elevenlabs',
  'minimax',
  'clone',
  'edge',
  'kokoro',
  'vbee',
  'fishaudio',
];
const VALID_OUTPUT_FORMATS: ElevenLabsOutputFormat[] = [
  'mp3_44100_64',
  'mp3_44100_96',
  'mp3_44100_128',
  'mp3_44100_192',
];

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || isNaN(value)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, value));
}

export function sanitizeElevenLabsSettings(data: unknown): ElevenLabsOptions {
  if (!data || typeof data !== 'object') {
    return { ...DEFAULT_ELEVENLABS_SETTINGS };
  }

  const obj = data as Record<string, unknown>;

  const voiceId = typeof obj.voiceId === 'string' ? obj.voiceId.trim() : DEFAULT_ELEVENLABS_SETTINGS.voiceId;
  const modelId = typeof obj.modelId === 'string' && obj.modelId.trim() ? obj.modelId.trim() : DEFAULT_ELEVENLABS_SETTINGS.modelId;
  const outputFormat = VALID_OUTPUT_FORMATS.includes(obj.outputFormat as ElevenLabsOutputFormat)
    ? (obj.outputFormat as ElevenLabsOutputFormat)
    : DEFAULT_ELEVENLABS_SETTINGS.outputFormat;

  const stability = clamp(obj.stability, 0, 1, DEFAULT_ELEVENLABS_SETTINGS.stability);
  const similarityBoost = clamp(obj.similarityBoost, 0, 1, DEFAULT_ELEVENLABS_SETTINGS.similarityBoost);
  const style = clamp(obj.style, 0, 1, DEFAULT_ELEVENLABS_SETTINGS.style);
  const speed = clamp(obj.speed, 0.5, 2.0, DEFAULT_ELEVENLABS_SETTINGS.speed);
  const useSpeakerBoost =
    typeof obj.useSpeakerBoost === 'boolean' ? obj.useSpeakerBoost : DEFAULT_ELEVENLABS_SETTINGS.useSpeakerBoost;

  return {
    voiceId,
    modelId,
    outputFormat,
    stability,
    similarityBoost,
    style,
    speed,
    useSpeakerBoost,
  };
}

export function sanitizeAi33ProSettings(data: unknown): Ai33ProOptions {
  if (!data || typeof data !== 'object') {
    return { ...DEFAULT_AI33PRO_SETTINGS };
  }

  const obj = data as Record<string, unknown>;

  const sourceProvider = VALID_AI33_SOURCE_PROVIDERS.includes(obj.sourceProvider as Ai33SourceProvider)
    ? (obj.sourceProvider as Ai33SourceProvider)
    : DEFAULT_AI33PRO_SETTINGS.sourceProvider;

  const voiceId = typeof obj.voiceId === 'string' ? obj.voiceId.trim() : DEFAULT_AI33PRO_SETTINGS.voiceId;
  const speed = clamp(obj.speed, 0.5, 1.5, DEFAULT_AI33PRO_SETTINGS.speed);

  return {
    sourceProvider,
    voiceId,
    speed,
  };
}

export function sanitizeSettings(data: unknown): SavedSettings {
  if (!data || typeof data !== 'object') {
    return { ...DEFAULT_SETTINGS };
  }

  const obj = data as Record<string, unknown>;

  const geminiApiKey = typeof obj.geminiApiKey === 'string' ? obj.geminiApiKey.trim() : DEFAULT_SETTINGS.geminiApiKey;
  const pexelsApiKey = typeof obj.pexelsApiKey === 'string' ? obj.pexelsApiKey.trim() : DEFAULT_SETTINGS.pexelsApiKey;
  const elevenLabsApiKey = typeof obj.elevenLabsApiKey === 'string' ? obj.elevenLabsApiKey.trim() : DEFAULT_SETTINGS.elevenLabsApiKey;
  const ai33ProApiKey = typeof obj.ai33ProApiKey === 'string' ? obj.ai33ProApiKey.trim() : DEFAULT_SETTINGS.ai33ProApiKey;

  const defaultOrientation = VALID_ORIENTATIONS.includes(obj.defaultOrientation as OutputOrientation)
    ? (obj.defaultOrientation as OutputOrientation)
    : DEFAULT_SETTINGS.defaultOrientation;

  const defaultQuality = VALID_QUALITIES.includes(obj.defaultQuality as VideoQuality)
    ? (obj.defaultQuality as VideoQuality)
    : DEFAULT_SETTINGS.defaultQuality;

  const defaultSceneLength = VALID_SCENE_LENGTHS.includes(obj.defaultSceneLength as TargetSceneLength)
    ? (obj.defaultSceneLength as TargetSceneLength)
    : DEFAULT_SETTINGS.defaultSceneLength;

  const defaultVoiceProvider = VALID_VOICE_PROVIDERS.includes(obj.defaultVoiceProvider as VoiceProvider)
    ? (obj.defaultVoiceProvider as VoiceProvider)
    : DEFAULT_SETTINGS.defaultVoiceProvider;

  const defaultElevenLabs = sanitizeElevenLabsSettings(obj.defaultElevenLabs);
  const defaultAi33Pro = sanitizeAi33ProSettings(obj.defaultAi33Pro);

  return {
    geminiApiKey,
    pexelsApiKey,
    elevenLabsApiKey,
    ai33ProApiKey,
    defaultOrientation,
    defaultQuality,
    defaultSceneLength,
    defaultVoiceProvider,
    defaultElevenLabs,
    defaultAi33Pro,
  };
}

/**
 * Loads saved settings from localStorage.
 * Automatically migrates from v2 or v1 to v3.
 * Falls back safely to defaults if storage is empty, corrupted, or invalid.
 */
export function loadSettings(): SavedSettings {
  try {
    const rawV3 = localStorage.getItem(STORAGE_KEY);
    if (rawV3) {
      const parsed = JSON.parse(rawV3);
      return sanitizeSettings(parsed);
    }

    // Check for v2 migration
    const rawV2 = localStorage.getItem(STORAGE_KEY_V2);
    if (rawV2) {
      const parsedV2 = JSON.parse(rawV2);
      const migrated = sanitizeSettings({
        ...parsedV2,
        ai33ProApiKey: '',
        defaultVoiceProvider: 'elevenlabs',
        defaultAi33Pro: DEFAULT_AI33PRO_SETTINGS,
      });
      // Save migrated settings to v3
      saveSettings(migrated);
      return migrated;
    }

    // Check for v1 migration
    const rawV1 = localStorage.getItem(STORAGE_KEY_V1);
    if (rawV1) {
      const parsedV1 = JSON.parse(rawV1);
      const migrated = sanitizeSettings({
        ...parsedV1,
        elevenLabsApiKey: '',
        defaultElevenLabs: DEFAULT_ELEVENLABS_SETTINGS,
        ai33ProApiKey: '',
        defaultVoiceProvider: 'elevenlabs',
        defaultAi33Pro: DEFAULT_AI33PRO_SETTINGS,
      });
      // Save migrated settings to v3
      saveSettings(migrated);
      return migrated;
    }

    return { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Persists the validated settings strictly containing API keys and default video and voice preferences.
 */
export function saveSettings(settings: SavedSettings): SavedSettings {
  const sanitized = sanitizeSettings(settings);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
  } catch (err) {
    console.error('Failed to save settings to localStorage', err);
  }
  return sanitized;
}

/**
 * Removes all four API keys from storage while preserving default video and voice settings.
 */
export function clearStoredApiKeys(): SavedSettings {
  const current = loadSettings();
  const updated: SavedSettings = {
    ...current,
    geminiApiKey: '',
    pexelsApiKey: '',
    elevenLabsApiKey: '',
    ai33ProApiKey: '',
  };
  saveSettings(updated);
  return updated;
}

/**
 * Restores initial video defaults while preserving saved API keys and voice defaults.
 */
export function resetStoredVideoDefaults(): SavedSettings {
  const current = loadSettings();
  const updated: SavedSettings = {
    ...current,
    defaultOrientation: DEFAULT_SETTINGS.defaultOrientation,
    defaultQuality: DEFAULT_SETTINGS.defaultQuality,
    defaultSceneLength: DEFAULT_SETTINGS.defaultSceneLength,
  };
  saveSettings(updated);
  return updated;
}

/**
 * Restores initial voice defaults for both providers while preserving saved API keys and video defaults.
 */
export function resetStoredVoiceDefaults(): SavedSettings {
  const current = loadSettings();
  const updated: SavedSettings = {
    ...current,
    defaultVoiceProvider: DEFAULT_SETTINGS.defaultVoiceProvider,
    defaultElevenLabs: { ...DEFAULT_ELEVENLABS_SETTINGS },
    defaultAi33Pro: { ...DEFAULT_AI33PRO_SETTINGS },
  };
  saveSettings(updated);
  return updated;
}
