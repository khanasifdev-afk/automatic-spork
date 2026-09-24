import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadSettings,
  saveSettings,
  clearStoredApiKeys,
  resetStoredVideoDefaults,
  resetStoredVoiceDefaults,
  STORAGE_KEY,
  STORAGE_KEY_V1,
  STORAGE_KEY_V2,
  DEFAULT_SETTINGS,
  DEFAULT_ELEVENLABS_SETTINGS,
  DEFAULT_AI33PRO_SETTINGS,
} from './settingsStorage';
import { SavedSettings } from '../types';

describe('settingsStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns default settings when storage is empty', () => {
    const settings = loadSettings();
    expect(settings).toEqual(DEFAULT_SETTINGS);
    expect(settings.ai33ProApiKey).toBe('');
    expect(settings.defaultVoiceProvider).toBe('elevenlabs');
    expect(settings.defaultAi33Pro).toEqual(DEFAULT_AI33PRO_SETTINGS);
  });

  it('returns default settings when storage contains invalid JSON', () => {
    localStorage.setItem(STORAGE_KEY, '{invalid json');
    const settings = loadSettings();
    expect(settings).toEqual(DEFAULT_SETTINGS);
  });

  it('automatically migrates v1 settings to v3 without losing Gemini, Pexels, or video defaults', () => {
    const v1Data = {
      geminiApiKey: 'gemini-v1-key',
      pexelsApiKey: 'pexels-v1-key',
      defaultOrientation: 'portrait',
      defaultQuality: '4k',
      defaultSceneLength: 'long',
    };
    localStorage.setItem(STORAGE_KEY_V1, JSON.stringify(v1Data));

    const settings = loadSettings();
    expect(settings.geminiApiKey).toBe('gemini-v1-key');
    expect(settings.pexelsApiKey).toBe('pexels-v1-key');
    expect(settings.elevenLabsApiKey).toBe('');
    expect(settings.ai33ProApiKey).toBe('');
    expect(settings.defaultOrientation).toBe('portrait');
    expect(settings.defaultQuality).toBe('4k');
    expect(settings.defaultSceneLength).toBe('long');
    expect(settings.defaultVoiceProvider).toBe('elevenlabs');
    expect(settings.defaultElevenLabs).toEqual(DEFAULT_ELEVENLABS_SETTINGS);
    expect(settings.defaultAi33Pro).toEqual(DEFAULT_AI33PRO_SETTINGS);

    // Verify written to v3 storage key
    const rawV3 = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    expect(rawV3.geminiApiKey).toBe('gemini-v1-key');
    expect(rawV3.pexelsApiKey).toBe('pexels-v1-key');
    expect(rawV3.ai33ProApiKey).toBe('');
    expect(rawV3.defaultVoiceProvider).toBe('elevenlabs');
  });

  it('automatically migrates v2 settings to v3 preserving ElevenLabs key and voice defaults', () => {
    const v2Data = {
      geminiApiKey: 'gemini-v2-key',
      pexelsApiKey: 'pexels-v2-key',
      elevenLabsApiKey: 'eleven-v2-key',
      defaultOrientation: 'portrait',
      defaultQuality: '720p',
      defaultSceneLength: 'short',
      defaultElevenLabs: {
        voiceId: 'eleven-voice-123',
        modelId: 'eleven_multilingual_v2',
        outputFormat: 'mp3_44100_192',
        stability: 0.6,
        similarityBoost: 0.8,
        style: 0.1,
        speed: 1.1,
        useSpeakerBoost: false,
      },
    };
    localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(v2Data));

    const settings = loadSettings();
    expect(settings.geminiApiKey).toBe('gemini-v2-key');
    expect(settings.pexelsApiKey).toBe('pexels-v2-key');
    expect(settings.elevenLabsApiKey).toBe('eleven-v2-key');
    expect(settings.ai33ProApiKey).toBe('');
    expect(settings.defaultOrientation).toBe('portrait');
    expect(settings.defaultQuality).toBe('720p');
    expect(settings.defaultSceneLength).toBe('short');
    expect(settings.defaultVoiceProvider).toBe('elevenlabs');
    expect(settings.defaultElevenLabs.voiceId).toBe('eleven-voice-123');
    expect(settings.defaultElevenLabs.outputFormat).toBe('mp3_44100_192');
    expect(settings.defaultAi33Pro).toEqual(DEFAULT_AI33PRO_SETTINGS);

    // Verify written to v3 storage key
    const rawV3 = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    expect(rawV3.elevenLabsApiKey).toBe('eleven-v2-key');
    expect(rawV3.ai33ProApiKey).toBe('');
    expect(rawV3.defaultVoiceProvider).toBe('elevenlabs');
  });

  it('recovers with fallback defaults for missing or invalid properties', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        geminiApiKey: 'test-gemini',
        defaultOrientation: 'invalid-orientation',
        defaultQuality: '8k',
        defaultVoiceProvider: 'invalid-provider',
        defaultElevenLabs: {
          stability: 99, // should clamp to 1
          speed: -5, // should clamp to 0.5
        },
        defaultAi33Pro: {
          sourceProvider: 'unsupported-provider',
          speed: 99, // should clamp to 1.5
        },
      })
    );
    const settings = loadSettings();
    expect(settings.geminiApiKey).toBe('test-gemini');
    expect(settings.pexelsApiKey).toBe('');
    expect(settings.elevenLabsApiKey).toBe('');
    expect(settings.ai33ProApiKey).toBe('');
    expect(settings.defaultOrientation).toBe('landscape');
    expect(settings.defaultQuality).toBe('1080p');
    expect(settings.defaultSceneLength).toBe('standard');
    expect(settings.defaultVoiceProvider).toBe('elevenlabs');
    expect(settings.defaultElevenLabs.stability).toBe(1);
    expect(settings.defaultElevenLabs.speed).toBe(0.5);
    expect(settings.defaultAi33Pro.sourceProvider).toBe('elevenlabs');
    expect(settings.defaultAi33Pro.speed).toBe(1.5);
  });

  it('persists and loads valid settings including AI33 Pro and ElevenLabs voice defaults', () => {
    const custom: SavedSettings = {
      geminiApiKey: 'gemini-key-123',
      pexelsApiKey: 'pexels-key-456',
      elevenLabsApiKey: 'eleven-key-789',
      ai33ProApiKey: 'ai33-key-abc',
      defaultOrientation: 'portrait',
      defaultQuality: '4k',
      defaultSceneLength: 'long',
      defaultVoiceProvider: 'ai33pro',
      defaultElevenLabs: {
        voiceId: 'custom-voice-id',
        modelId: 'eleven_turbo_v2',
        outputFormat: 'mp3_44100_192',
        stability: 0.7,
        similarityBoost: 0.85,
        style: 0.2,
        speed: 1.15,
        useSpeakerBoost: false,
      },
      defaultAi33Pro: {
        sourceProvider: 'minimax',
        voiceId: 'minimax_male-qn-qingse',
        speed: 1.25,
      },
    };

    saveSettings(custom);
    const loaded = loadSettings();
    expect(loaded).toEqual(custom);

    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    expect(raw).toEqual(custom);
    expect(Object.keys(raw).sort()).toEqual([
      'ai33ProApiKey',
      'defaultAi33Pro',
      'defaultElevenLabs',
      'defaultOrientation',
      'defaultQuality',
      'defaultSceneLength',
      'defaultVoiceProvider',
      'elevenLabsApiKey',
      'geminiApiKey',
      'pexelsApiKey',
    ]);
  });

  it('clears all 4 API keys while preserving video and voice defaults', () => {
    const initial: SavedSettings = {
      geminiApiKey: 'gemini-key',
      pexelsApiKey: 'pexels-key',
      elevenLabsApiKey: 'eleven-key',
      ai33ProApiKey: 'ai33-key',
      defaultOrientation: 'portrait',
      defaultQuality: '720p',
      defaultSceneLength: 'short',
      defaultVoiceProvider: 'ai33pro',
      defaultElevenLabs: {
        voiceId: 'custom-voice',
        modelId: 'eleven_multilingual_v2',
        outputFormat: 'mp3_44100_64',
        stability: 0.6,
        similarityBoost: 0.8,
        style: 0.1,
        speed: 1.2,
        useSpeakerBoost: false,
      },
      defaultAi33Pro: {
        sourceProvider: 'edge',
        voiceId: 'edge_en-US-GuyNeural',
        speed: 0.9,
      },
    };
    saveSettings(initial);

    const afterClear = clearStoredApiKeys();
    expect(afterClear.geminiApiKey).toBe('');
    expect(afterClear.pexelsApiKey).toBe('');
    expect(afterClear.elevenLabsApiKey).toBe('');
    expect(afterClear.ai33ProApiKey).toBe('');
    expect(afterClear.defaultOrientation).toBe('portrait');
    expect(afterClear.defaultVoiceProvider).toBe('ai33pro');
    expect(afterClear.defaultElevenLabs.voiceId).toBe('custom-voice');
    expect(afterClear.defaultAi33Pro.voiceId).toBe('edge_en-US-GuyNeural');

    const loaded = loadSettings();
    expect(loaded).toEqual(afterClear);
  });

  it('resets video defaults while preserving API keys and voice defaults', () => {
    const initial: SavedSettings = {
      geminiApiKey: 'gemini-key',
      pexelsApiKey: 'pexels-key',
      elevenLabsApiKey: 'eleven-key',
      ai33ProApiKey: 'ai33-key',
      defaultOrientation: 'portrait',
      defaultQuality: '720p',
      defaultSceneLength: 'short',
      defaultVoiceProvider: 'ai33pro',
      defaultElevenLabs: {
        voiceId: 'custom-voice',
        modelId: 'eleven_multilingual_v2',
        outputFormat: 'mp3_44100_128',
        stability: 0.6,
        similarityBoost: 0.8,
        style: 0,
        speed: 1,
        useSpeakerBoost: true,
      },
      defaultAi33Pro: {
        sourceProvider: 'kokoro',
        voiceId: 'kokoro_af_bella',
        speed: 1.1,
      },
    };
    saveSettings(initial);

    const afterReset = resetStoredVideoDefaults();
    expect(afterReset.geminiApiKey).toBe('gemini-key');
    expect(afterReset.pexelsApiKey).toBe('pexels-key');
    expect(afterReset.elevenLabsApiKey).toBe('eleven-key');
    expect(afterReset.ai33ProApiKey).toBe('ai33-key');
    expect(afterReset.defaultOrientation).toBe('landscape');
    expect(afterReset.defaultQuality).toBe('1080p');
    expect(afterReset.defaultSceneLength).toBe('standard');
    expect(afterReset.defaultVoiceProvider).toBe('ai33pro');
    expect(afterReset.defaultElevenLabs.voiceId).toBe('custom-voice');
    expect(afterReset.defaultAi33Pro.voiceId).toBe('kokoro_af_bella');
  });

  it('resets voice defaults for both providers while preserving API keys and video defaults', () => {
    const initial: SavedSettings = {
      geminiApiKey: 'gemini-key',
      pexelsApiKey: 'pexels-key',
      elevenLabsApiKey: 'eleven-key',
      ai33ProApiKey: 'ai33-key',
      defaultOrientation: 'portrait',
      defaultQuality: '720p',
      defaultSceneLength: 'short',
      defaultVoiceProvider: 'ai33pro',
      defaultElevenLabs: {
        voiceId: 'custom-voice',
        modelId: 'eleven_turbo_v2',
        outputFormat: 'mp3_44100_192',
        stability: 0.9,
        similarityBoost: 0.9,
        style: 0.5,
        speed: 1.5,
        useSpeakerBoost: false,
      },
      defaultAi33Pro: {
        sourceProvider: 'fishaudio',
        voiceId: 'fishaudio_custom_1',
        speed: 1.4,
      },
    };
    saveSettings(initial);

    const afterReset = resetStoredVoiceDefaults();
    expect(afterReset.geminiApiKey).toBe('gemini-key');
    expect(afterReset.pexelsApiKey).toBe('pexels-key');
    expect(afterReset.elevenLabsApiKey).toBe('eleven-key');
    expect(afterReset.ai33ProApiKey).toBe('ai33-key');
    expect(afterReset.defaultOrientation).toBe('portrait');
    expect(afterReset.defaultQuality).toBe('720p');
    expect(afterReset.defaultSceneLength).toBe('short');
    expect(afterReset.defaultVoiceProvider).toBe('elevenlabs');
    expect(afterReset.defaultElevenLabs).toEqual(DEFAULT_ELEVENLABS_SETTINGS);
    expect(afterReset.defaultAi33Pro).toEqual(DEFAULT_AI33PRO_SETTINGS);
  });
});
