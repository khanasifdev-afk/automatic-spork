import {
  VoiceProvider,
  KeyTestStatus,
  NormalizedVoice,
  NormalizedModel,
  GenerateSceneSpeechParams,
  GeneratedVoiceResult,
  ElevenLabsOptions,
  Ai33SourceProvider,
} from '../types';
import {
  testElevenLabsApiKey,
  fetchElevenLabsVoices,
  fetchElevenLabsModels,
  generateSpeechForScene,
} from './elevenLabs';
import {
  testAi33ProApiKey,
  fetchAi33ProVoices,
  generateAi33ProSpeech,
} from './ai33Pro';

export interface VoiceAdapter {
  readonly provider: VoiceProvider;
  testApiKey(apiKey: string): Promise<KeyTestStatus>;
  fetchVoices(apiKey: string, filter?: unknown): Promise<NormalizedVoice[]>;
  fetchModels?(apiKey: string, signal?: AbortSignal): Promise<NormalizedModel[]>;
  generateSpeech(params: GenerateSceneSpeechParams): Promise<GeneratedVoiceResult>;
}

export const elevenLabsAdapter: VoiceAdapter = {
  provider: 'elevenlabs',

  testApiKey: async (apiKey: string): Promise<KeyTestStatus> => {
    return testElevenLabsApiKey(apiKey);
  },

  fetchVoices: async (apiKey: string): Promise<NormalizedVoice[]> => {
    const raw = await fetchElevenLabsVoices(apiKey);
    return raw.map((v) => ({
      voice_id: v.voice_id,
      name: v.name,
      category: v.category,
      preview_url: v.preview_url,
      labels: v.labels,
    }));
  },

  fetchModels: async (apiKey: string, signal?: AbortSignal): Promise<NormalizedModel[]> => {
    const raw = await fetchElevenLabsModels(apiKey, signal);
    return raw.map((m) => ({
      model_id: m.model_id,
      name: m.name,
      description: m.description,
    }));
  },

  generateSpeech: async (params: GenerateSceneSpeechParams): Promise<GeneratedVoiceResult> => {
    const result = await generateSpeechForScene({
      scriptText: params.scriptText,
      voiceId: params.voiceId,
      options: params.options as ElevenLabsOptions,
      apiKey: params.apiKey,
      previousText: params.previousText,
      nextText: params.nextText,
      signal: params.signal,
    });

    return {
      audioBlob: result.audioBlob,
      durationSeconds: result.durationSeconds,
      requestId: result.requestId,
    };
  },
};

export const ai33ProAdapter: VoiceAdapter = {
  provider: 'ai33pro',

  testApiKey: async (apiKey: string): Promise<KeyTestStatus> => {
    return testAi33ProApiKey(apiKey);
  },

  fetchVoices: async (apiKey: string, filter?: unknown): Promise<NormalizedVoice[]> => {
    const sourceProvider = (typeof filter === 'string' ? filter : 'elevenlabs') as Ai33SourceProvider;
    const raw = await fetchAi33ProVoices(apiKey, sourceProvider);
    return raw.map((v) => ({
      voice_id: v.voice_id,
      name: v.name,
      language: v.language,
      gender: v.gender,
      tags: v.tags,
      preview_url: v.preview_url,
    }));
  },

  generateSpeech: async (params: GenerateSceneSpeechParams): Promise<GeneratedVoiceResult> => {
    return generateAi33ProSpeech(params);
  },
};

export function getVoiceAdapter(provider: VoiceProvider): VoiceAdapter {
  switch (provider) {
    case 'ai33pro':
      return ai33ProAdapter;
    case 'elevenlabs':
    default:
      return elevenLabsAdapter;
  }
}
