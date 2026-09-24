import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  elevenLabsAdapter,
  ai33ProAdapter,
  getVoiceAdapter,
} from './voiceAdapter';
import * as elevenLabsModule from './elevenLabs';
import * as ai33ProModule from './ai33Pro';
import { GenerateSceneSpeechParams } from '../types';

describe('voiceAdapter', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getVoiceAdapter', () => {
    it('returns elevenLabsAdapter for "elevenlabs"', () => {
      const adapter = getVoiceAdapter('elevenlabs');
      expect(adapter.provider).toBe('elevenlabs');
      expect(adapter).toBe(elevenLabsAdapter);
    });

    it('returns ai33ProAdapter for "ai33pro"', () => {
      const adapter = getVoiceAdapter('ai33pro');
      expect(adapter.provider).toBe('ai33pro');
      expect(adapter).toBe(ai33ProAdapter);
    });
  });

  describe('elevenLabsAdapter', () => {
    it('delegates testApiKey to testElevenLabsApiKey', async () => {
      const spy = vi.spyOn(elevenLabsModule, 'testElevenLabsApiKey').mockResolvedValue({
        state: 'valid',
        message: 'Valid ElevenLabs key',
      });

      const result = await elevenLabsAdapter.testApiKey('my-eleven-key');
      expect(spy).toHaveBeenCalledWith('my-eleven-key');
      expect(result.state).toBe('valid');
    });

    it('delegates fetchVoices and normalizes results', async () => {
      const mockRaw = [
        {
          voice_id: 'voice-1',
          name: 'Rachel',
          category: 'premade',
          preview_url: 'https://preview.url/1.mp3',
          labels: { accent: 'american' },
          settings: { stability: 0.5, similarity_boost: 0.75 },
        },
      ];
      vi.spyOn(elevenLabsModule, 'fetchElevenLabsVoices').mockResolvedValue(mockRaw);

      const voices = await elevenLabsAdapter.fetchVoices('my-key');
      expect(voices).toEqual([
        {
          voice_id: 'voice-1',
          name: 'Rachel',
          category: 'premade',
          preview_url: 'https://preview.url/1.mp3',
          labels: { accent: 'american' },
        },
      ]);
    });

    it('delegates fetchModels and normalizes results', async () => {
      const mockModels = [
        {
          model_id: 'eleven_multilingual_v2',
          name: 'Eleven Multilingual v2',
          description: 'High quality',
          can_do_text_to_speech: true,
        },
      ];
      vi.spyOn(elevenLabsModule, 'fetchElevenLabsModels').mockResolvedValue(mockModels);

      const models = await elevenLabsAdapter.fetchModels!('my-key');
      expect(models).toEqual([
        {
          model_id: 'eleven_multilingual_v2',
          name: 'Eleven Multilingual v2',
          description: 'High quality',
        },
      ]);
    });

    it('delegates generateSpeech to generateSpeechForScene without altering payload contract', async () => {
      const dummyBlob = new Blob(['audio-content'], { type: 'audio/mpeg' });
      const spy = vi.spyOn(elevenLabsModule, 'generateSpeechForScene').mockResolvedValue({
        audioBlob: dummyBlob,
        durationSeconds: 3.5,
        requestId: 'req-123',
      });

      const params: GenerateSceneSpeechParams = {
        scriptText: 'Hello world narration',
        voiceId: 'voice-1',
        options: {
          voiceId: 'voice-1',
          modelId: 'eleven_multilingual_v2',
          outputFormat: 'mp3_44100_128',
          stability: 0.5,
          similarityBoost: 0.75,
          style: 0,
          speed: 1,
          useSpeakerBoost: true,
        },
        apiKey: 'eleven-key',
        previousText: 'Intro line',
        nextText: 'Outro line',
      };

      const result = await elevenLabsAdapter.generateSpeech(params);
      expect(spy).toHaveBeenCalledWith({
        scriptText: 'Hello world narration',
        voiceId: 'voice-1',
        options: params.options,
        apiKey: 'eleven-key',
        previousText: 'Intro line',
        nextText: 'Outro line',
        signal: undefined,
      });

      expect(result.audioBlob).toBe(dummyBlob);
      expect(result.durationSeconds).toBe(3.5);
      expect(result.requestId).toBe('req-123');
    });
  });

  describe('ai33ProAdapter', () => {
    it('delegates testApiKey to testAi33ProApiKey', async () => {
      const spy = vi.spyOn(ai33ProModule, 'testAi33ProApiKey').mockResolvedValue({
        state: 'valid',
        message: 'Valid AI33 Pro key',
      });

      const result = await ai33ProAdapter.testApiKey('my-ai33-key');
      expect(spy).toHaveBeenCalledWith('my-ai33-key');
      expect(result.state).toBe('valid');
    });

    it('delegates fetchVoices with sourceProvider filter', async () => {
      const mockAi33Voices = [
        {
          voice_id: 'minimax_male-qn-qingse',
          name: 'Qingse (Male)',
          language: 'Chinese',
          gender: 'male',
          tags: ['narration'],
          preview_url: 'https://preview.ai33.pro/1.mp3',
        },
      ];
      const spy = vi.spyOn(ai33ProModule, 'fetchAi33ProVoices').mockResolvedValue(mockAi33Voices);

      const voices = await ai33ProAdapter.fetchVoices('my-ai33-key', 'minimax');
      expect(spy).toHaveBeenCalledWith('my-ai33-key', 'minimax');
      expect(voices).toEqual([
        {
          voice_id: 'minimax_male-qn-qingse',
          name: 'Qingse (Male)',
          language: 'Chinese',
          gender: 'male',
          tags: ['narration'],
          preview_url: 'https://preview.ai33.pro/1.mp3',
        },
      ]);
    });

    it('delegates generateSpeech to generateAi33ProSpeech', async () => {
      const dummyBlob = new Blob(['ai33-audio'], { type: 'audio/mpeg' });
      const spy = vi.spyOn(ai33ProModule, 'generateAi33ProSpeech').mockResolvedValue({
        audioBlob: dummyBlob,
        durationSeconds: 4.2,
        taskId: 'task-ai33-999',
        creditCost: 10,
      });

      const params: GenerateSceneSpeechParams = {
        scriptText: 'Narration with AI33 Pro',
        voiceId: 'elevenlabs_21m00Tcm4TlvDq8ikWAM',
        options: {
          sourceProvider: 'elevenlabs',
          voiceId: 'elevenlabs_21m00Tcm4TlvDq8ikWAM',
          speed: 1.1,
        },
        apiKey: 'ai33-key',
      };

      const result = await ai33ProAdapter.generateSpeech(params);
      expect(spy).toHaveBeenCalledWith(params);
      expect(result.audioBlob).toBe(dummyBlob);
      expect(result.durationSeconds).toBe(4.2);
      expect(result.taskId).toBe('task-ai33-999');
      expect(result.creditCost).toBe(10);
    });
  });
});
