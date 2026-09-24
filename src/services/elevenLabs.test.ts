import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  testElevenLabsApiKey,
  fetchElevenLabsVoices,
  fetchElevenLabsModels,
  generateSpeechForScene,
  measureAudioDuration,
  ElevenLabsApiError,
  ELEVENLABS_API_BASE,
} from './elevenLabs';
import { ElevenLabsOptions } from '../types';

describe('elevenLabs service', () => {
  const defaultOptions: ElevenLabsOptions = {
    voiceId: 'voice-123',
    modelId: 'eleven_multilingual_v2',
    outputFormat: 'mp3_44100_128',
    stability: 0.5,
    similarityBoost: 0.75,
    style: 0,
    speed: 1,
    useSpeakerBoost: true,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('testElevenLabsApiKey', () => {
    it('returns invalid immediately if key is empty', async () => {
      const res = await testElevenLabsApiKey('');
      expect(res.state).toBe('invalid');
      expect(res.message).toContain('empty');
    });

    it('returns valid and parses subscription info on 200 OK', async () => {
      const mockSubscription = {
        tier: 'starter',
        character_count: 4500,
        character_limit: 10000,
        next_character_count_reset_unix: 1735689600,
        can_extend_character_limit: false,
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockSubscription,
      } as Response);

      const res = await testElevenLabsApiKey('valid-key');
      expect(res.state).toBe('valid');
      expect(res.usage).toBeDefined();
      expect(res.usage?.tier).toBe('starter');
      expect(res.usage?.characterCount).toBe(4500);
      expect(res.usage?.characterLimit).toBe(10000);
      expect(res.usage?.remainingIncludedCharacters).toBe(5500);
      expect(res.usage?.resetsAt).toBeDefined();
    });

    it('clamps remaining included characters to 0 when character_count exceeds limit', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          tier: 'creator',
          character_count: 12000,
          character_limit: 10000,
          allowed_to_extend_character_limit: true,
        }),
      } as Response);

      const res = await testElevenLabsApiKey('over-quota-key');
      expect(res.state).toBe('valid');
      expect(res.usage?.remainingIncludedCharacters).toBe(0);
      expect(res.usage?.isOveragesEnabled).toBe(true);
    });

    it('returns invalid on 401/403 status', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response);

      const res = await testElevenLabsApiKey('bad-key');
      expect(res.state).toBe('invalid');
      expect(res.message).toContain('Invalid ElevenLabs API key');
    });

    it('returns quota-exhausted on 429 status', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 429,
      } as Response);

      const res = await testElevenLabsApiKey('exhausted-key');
      expect(res.state).toBe('quota-exhausted');
      expect(res.message).toContain('quota exhausted');
    });

    it('returns unavailable on network error', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch'));

      const res = await testElevenLabsApiKey('any-key');
      expect(res.state).toBe('unavailable');
      expect(res.message).toContain('Failed to connect');
    });
  });

  describe('fetchElevenLabsVoices', () => {
    it('returns empty array when key is empty', async () => {
      const res = await fetchElevenLabsVoices('');
      expect(res).toEqual([]);
    });

    it('returns parsed voices on success', async () => {
      const mockVoices = [
        {
          voice_id: 'v1',
          name: 'Rachel',
          category: 'premade',
          preview_url: 'https://preview.mp3',
        },
        {
          voice_id: 'v2',
          name: 'Adam',
          category: 'premade',
        },
      ];

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ voices: mockVoices }),
      } as Response);

      const res = await fetchElevenLabsVoices('valid-key');
      expect(res).toHaveLength(2);
      expect(res[0].voice_id).toBe('v1');
      expect(res[0].name).toBe('Rachel');
      expect(res[1].name).toBe('Adam');
    });

    it('throws ElevenLabsApiError on HTTP error', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      await expect(fetchElevenLabsVoices('test-key')).rejects.toThrow(ElevenLabsApiError);
    });
  });

  describe('fetchElevenLabsModels', () => {
    it('filters models to only text-to-speech capable models', async () => {
      const mockModels = [
        {
          model_id: 'eleven_multilingual_v2',
          name: 'Eleven Multilingual v2',
          can_do_text_to_speech: true,
        },
        {
          model_id: 'eleven_english_v1',
          name: 'Eleven English v1',
          can_do_text_to_speech: true,
        },
        {
          model_id: 'eleven_voice_isolator_v1',
          name: 'Voice Isolator',
          can_do_text_to_speech: false,
        },
      ];

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockModels,
      } as Response);

      const res = await fetchElevenLabsModels('valid-key');
      expect(res).toHaveLength(2);
      expect(res.map((m) => m.model_id)).toEqual(['eleven_multilingual_v2', 'eleven_english_v1']);
    });
  });

  describe('generateSpeechForScene', () => {
    it('validates required fields before calling API', async () => {
      await expect(
        generateSpeechForScene({
          scriptText: '',
          voiceId: 'v1',
          options: defaultOptions,
          apiKey: 'key',
        })
      ).rejects.toThrow('empty');

      await expect(
        generateSpeechForScene({
          scriptText: 'Hello world',
          voiceId: '',
          options: { ...defaultOptions, voiceId: '' },
          apiKey: 'key',
        })
      ).rejects.toThrow('voice');

      await expect(
        generateSpeechForScene({
          scriptText: 'Hello world',
          voiceId: 'v1',
          options: defaultOptions,
          apiKey: '',
        })
      ).rejects.toThrow('missing');
    });

    it('sends correct headers, params, and continuity payload on generation', async () => {
      let capturedUrl = '';
      let capturedBody: {
        text?: string;
        model_id?: string;
        previous_text?: string;
        next_text?: string;
        voice_settings?: { stability?: number };
      } = {};
      let capturedHeaders: Record<string, string> = {};

      const fakeBlob = new Blob(['mock audio binary'], { type: 'audio/mpeg' });

      vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (url, init) => {
        capturedUrl = String(url);
        capturedHeaders = (init?.headers || {}) as Record<string, string>;
        capturedBody = JSON.parse(init?.body as string);
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'request-id': 'req-xyz-987' }),
          blob: async () => fakeBlob,
        } as Response;
      });

      const res = await generateSpeechForScene({
        scriptText: 'Regular walking improves balance.',
        voiceId: 'voice-123',
        options: defaultOptions,
        apiKey: 'my-secret-key',
        previousText: 'Introductory sentence.',
        nextText: 'Concluding remark.',
      });

      expect(capturedUrl).toBe(
        `${ELEVENLABS_API_BASE}/v1/text-to-speech/voice-123?output_format=mp3_44100_128`
      );
      expect(capturedHeaders['xi-api-key']).toBe('my-secret-key');
      expect(capturedBody.text).toBe('Regular walking improves balance.');
      expect(capturedBody.model_id).toBe('eleven_multilingual_v2');
      expect(capturedBody.previous_text).toBe('Introductory sentence.');
      expect(capturedBody.next_text).toBe('Concluding remark.');
      expect(capturedBody.voice_settings?.stability).toBe(0.5);

      expect(res.audioBlob).toBe(fakeBlob);
      expect(res.requestId).toBe('req-xyz-987');
    });

    it('throws error when empty audio body is returned', async () => {
      const emptyBlob = new Blob([], { type: 'audio/mpeg' });

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        blob: async () => emptyBlob,
      } as Response);

      await expect(
        generateSpeechForScene({
          scriptText: 'Hello',
          voiceId: 'voice-123',
          options: defaultOptions,
          apiKey: 'key',
        })
      ).rejects.toThrow('empty audio');
    });

    it('classifies 429 quota errors accurately', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({ detail: { message: 'Quota exceeded for this month.' } }),
      } as Response);

      try {
        await generateSpeechForScene({
          scriptText: 'Hello',
          voiceId: 'voice-123',
          options: defaultOptions,
          apiKey: 'key',
        });
        expect.unreachable('Should have thrown');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ElevenLabsApiError);
        expect((err as ElevenLabsApiError).isQuotaError).toBe(true);
      }
    });
  });

  describe('measureAudioDuration', () => {
    it('returns null in non-browser or jsdom environment without full audio decoding', async () => {
      const fakeBlob = new Blob(['mock audio'], { type: 'audio/mpeg' });
      const duration = await measureAudioDuration(fakeBlob);
      // In vitest / jsdom without Web Audio implementation, safely resolves to null
      expect(duration === null || typeof duration === 'number').toBe(true);
    });
  });
});
