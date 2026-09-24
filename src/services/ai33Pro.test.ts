import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  testAi33ProApiKey,
  fetchAi33ProVoices,
  generateAi33ProSpeech,
  AI33_PRO_API_BASE,
} from './ai33Pro';

describe('ai33Pro service', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('testAi33ProApiKey', () => {
    it('returns invalid status without network call when key is empty', async () => {
      const fetchSpy = vi.fn();
      globalThis.fetch = fetchSpy;

      const result = await testAi33ProApiKey('   ');
      expect(result).toEqual({
        state: 'invalid',
        message: 'Enter an API key first.',
      });
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('returns valid status and credits when credits endpoint succeeds', async () => {
      globalThis.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        expect(url).toBe(`${AI33_PRO_API_BASE}/v1/credits`);
        expect((init?.headers as Record<string, string>)['xi-api-key']).toBe('valid-key');
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            credits: 8500,
          }),
        });
      });

      const result = await testAi33ProApiKey('valid-key');
      expect(result).toEqual({
        state: 'valid',
        message: 'AI33 Pro connection verified successfully.',
        usage: {
          credits: 8500,
        },
      });
    });

    it('returns invalid status on 401 unauthorized', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      });

      const result = await testAi33ProApiKey('bad-key');
      expect(result.state).toBe('invalid');
      expect(result.message).toContain('Invalid AI33 Pro API key');
    });

    it('returns invalid status on 403 forbidden', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
      });

      const result = await testAi33ProApiKey('forbidden-key');
      expect(result.state).toBe('invalid');
    });

    it('returns quota-exhausted status on 429 rate limited', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
      });

      const result = await testAi33ProApiKey('rate-limited-key');
      expect(result.state).toBe('quota-exhausted');
      expect(result.message).toContain('quota exhausted or rate limit reached');
    });

    it('returns unavailable status on 500 server error', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await testAi33ProApiKey('server-err-key');
      expect(result.state).toBe('unavailable');
      expect(result.message).toContain('HTTP error 500');
    });

    it('returns timeout status when request aborts due to timeout', async () => {
      const abortError = new DOMException('The operation was aborted', 'AbortError');
      globalThis.fetch = vi.fn().mockRejectedValue(abortError);

      const result = await testAi33ProApiKey('timeout-key');
      expect(result.state).toBe('timeout');
      expect(result.message).toContain('Request timed out after 6 seconds');
    });

    it('returns unavailable status on network or CORS failure', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'));

      const result = await testAi33ProApiKey('network-err-key');
      expect(result.state).toBe('unavailable');
      expect(result.message).toBe('Failed to fetch');
    });
  });

  describe('fetchAi33ProVoices', () => {
    it('returns empty array when key is empty', async () => {
      const fetchSpy = vi.fn();
      globalThis.fetch = fetchSpy;

      const voices = await fetchAi33ProVoices('', 'minimax');
      expect(voices).toEqual([]);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('fetches single page of voices and normalizes attributes', async () => {
      globalThis.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        expect(url).toContain('/v3/voices?provider=minimax&page=1&page_size=100');
        expect((init?.headers as Record<string, string>)['xi-api-key']).toBe('valid-key');
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: [
              {
                voice_id: 'minimax_male-qn-qingse',
                name: 'Qingse (Male)',
                language: 'Chinese',
                gender: 'male',
                tags: ['narration', 'deep'],
                preview_url: 'https://cdn.ai33.pro/preview.mp3',
              },
            ],
            pagination: {
              page: 1,
              page_size: 100,
              total: 1,
              has_more: false,
            },
          }),
        });
      });

      const voices = await fetchAi33ProVoices('valid-key', 'minimax');
      expect(voices).toEqual([
        {
          voice_id: 'minimax_male-qn-qingse',
          name: 'Qingse (Male)',
          language: 'Chinese',
          gender: 'male',
          tags: ['narration', 'deep'],
          preview_url: 'https://cdn.ai33.pro/preview.mp3',
        },
      ]);
    });

    it('handles multi-page pagination when has_more is true', async () => {
      let callCount = 0;
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        callCount++;
        if (url.includes('page=1')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              data: [{ voice_id: 'edge_en-US-GuyNeural', name: 'Guy' }],
              pagination: { page: 1, page_size: 100, has_more: true },
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: [{ voice_id: 'edge_en-US-JennyNeural', name: 'Jenny' }],
            pagination: { page: 2, page_size: 100, has_more: false },
          }),
        });
      });

      const voices = await fetchAi33ProVoices('valid-key', 'edge');
      expect(callCount).toBe(2);
      expect(voices).toHaveLength(2);
      expect(voices[0].voice_id).toBe('edge_en-US-GuyNeural');
      expect(voices[1].voice_id).toBe('edge_en-US-JennyNeural');
    });

    it('throws error when voice fetching fails with 401', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      });

      await expect(fetchAi33ProVoices('bad-key', 'elevenlabs')).rejects.toThrow(
        'Invalid AI33 Pro API key'
      );
    });
  });

  describe('generateAi33ProSpeech', () => {
    it('throws error if API key is empty', async () => {
      const fetchSpy = vi.fn();
      globalThis.fetch = fetchSpy;

      await expect(
        generateAi33ProSpeech({
          scriptText: 'Hello world',
          voiceId: 'elevenlabs_21m00Tcm4TlvDq8ikWAM',
          options: {
            sourceProvider: 'elevenlabs',
            voiceId: 'elevenlabs_21m00Tcm4TlvDq8ikWAM',
            speed: 1,
          },
          apiKey: '',
        })
      ).rejects.toThrow('AI33 Pro API key is missing.');
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('throws error if script text is empty', async () => {
      await expect(
        generateAi33ProSpeech({
          scriptText: '   ',
          voiceId: 'elevenlabs_21m00Tcm4TlvDq8ikWAM',
          options: {
            sourceProvider: 'elevenlabs',
            voiceId: 'elevenlabs_21m00Tcm4TlvDq8ikWAM',
            speed: 1,
          },
          apiKey: 'valid-key',
        })
      ).rejects.toThrow('Scene script text cannot be empty.');
    });

    it('throws error if voice ID is empty', async () => {
      await expect(
        generateAi33ProSpeech({
          scriptText: 'Valid text',
          voiceId: '',
          options: {
            sourceProvider: 'elevenlabs',
            voiceId: '',
            speed: 1,
          },
          apiKey: 'valid-key',
        })
      ).rejects.toThrow('No AI33 Pro voice selected.');
    });

    it('creates task via FormData, polls doing then done, and downloads audio', async () => {
      const mockAudioBlob = new Blob(['sample-mp3-audio-bytes'], { type: 'audio/mpeg' });
      const progressUpdates: number[] = [];

      let pollCount = 0;
      globalThis.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (url === `${AI33_PRO_API_BASE}/v3/text-to-speech`) {
          expect(init?.method).toBe('POST');
          expect((init?.headers as Record<string, string>)['xi-api-key']).toBe('secret-ai33-key');

          // Check FormData payload
          const body = init?.body as FormData;
          expect(body).toBeInstanceOf(FormData);
          expect(body.get('text')).toBe('A walk in the fresh air rejuvenates the mind.');
          expect(body.get('voice_id')).toBe('elevenlabs_21m00Tcm4TlvDq8ikWAM');
          expect(body.get('speed')).toBe('1');
          expect(body.get('with_transcript')).toBe('false');

          // Ensure unsupported fields are NOT in the payload
          expect(body.get('model_id')).toBeNull();
          expect(body.get('output_format')).toBeNull();
          expect(body.get('receive_url')).toBeNull();
          expect(body.get('file_name')).toBeNull();
          expect(body.get('pronunciation_dictionary_id')).toBeNull();

          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              task_id: 'task-abc-123',
            }),
          });
        }

        if (url === `${AI33_PRO_API_BASE}/v1/task/task-abc-123`) {
          pollCount++;
          expect((init?.headers as Record<string, string>)['xi-api-key']).toBe('secret-ai33-key');

          if (pollCount === 1) {
            return Promise.resolve({
              ok: true,
              status: 200,
              json: async () => ({
                success: true,
                status: 'doing',
                progress: 50,
              }),
            });
          }

          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              status: 'done',
              credit_cost: 15,
              metadata: {
                audio_url: 'https://cdn.ai33.pro/audio/task-abc-123.mp3',
              },
            }),
          });
        }

        if (url === 'https://cdn.ai33.pro/audio/task-abc-123.mp3') {
          return Promise.resolve({
            ok: true,
            status: 200,
            blob: async () => mockAudioBlob,
          });
        }

        throw new Error(`Unexpected URL: ${url}`);
      });

      const result = await generateAi33ProSpeech({
        scriptText: 'A walk in the fresh air rejuvenates the mind.',
        voiceId: 'elevenlabs_21m00Tcm4TlvDq8ikWAM',
        options: {
          sourceProvider: 'elevenlabs',
          voiceId: 'elevenlabs_21m00Tcm4TlvDq8ikWAM',
          speed: 1.0,
        },
        apiKey: 'secret-ai33-key',
        onProgress: (p) => progressUpdates.push(p),
      });

      expect(result.audioBlob).toBe(mockAudioBlob);
      expect(result.taskId).toBe('task-abc-123');
      expect(result.creditCost).toBe(15);
      expect(progressUpdates).toContain(50);
      expect(pollCount).toBe(2);
    });

    it('throws error when task polling returns status error', async () => {
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/v3/text-to-speech')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              task_id: 'task-fail-456',
            }),
          });
        }

        if (url.includes('/v1/task/task-fail-456')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              status: 'error',
              error_message: 'Voice synthesis backend error occurred.',
            }),
          });
        }

        throw new Error(`Unexpected URL: ${url}`);
      });

      await expect(
        generateAi33ProSpeech({
          scriptText: 'Test text',
          voiceId: 'minimax_male-qn',
          options: {
            sourceProvider: 'minimax',
            voiceId: 'minimax_male-qn',
            speed: 1.0,
          },
          apiKey: 'some-key',
        })
      ).rejects.toThrow('Voice synthesis backend error occurred.');
    });

    it('throws error if downloaded audio blob is empty', async () => {
      const emptyBlob = new Blob([], { type: 'audio/mpeg' });

      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/v3/text-to-speech')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ success: true, task_id: 'task-empty-789' }),
          });
        }

        if (url.includes('/v1/task/task-empty-789')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              status: 'done',
              metadata: { audio_url: 'https://cdn.ai33.pro/empty.mp3' },
            }),
          });
        }

        if (url === 'https://cdn.ai33.pro/empty.mp3') {
          return Promise.resolve({
            ok: true,
            status: 200,
            blob: async () => emptyBlob,
          });
        }

        throw new Error(`Unexpected URL: ${url}`);
      });

      await expect(
        generateAi33ProSpeech({
          scriptText: 'Test text',
          voiceId: 'voice-empty',
          options: {
            sourceProvider: 'elevenlabs',
            voiceId: 'voice-empty',
            speed: 1.0,
          },
          apiKey: 'key',
        })
      ).rejects.toThrow('AI33 Pro returned an empty audio file.');
    });

    it('respects AbortSignal cancellation', async () => {
      const controller = new AbortController();

      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/v3/text-to-speech')) {
          controller.abort();
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ success: true, task_id: 'task-aborted' }),
          });
        }
        throw new Error(`Should not reach here: ${url}`);
      });

      await expect(
        generateAi33ProSpeech({
          scriptText: 'Cancel me',
          voiceId: 'voice-cancel',
          options: {
            sourceProvider: 'elevenlabs',
            voiceId: 'voice-cancel',
            speed: 1.0,
          },
          apiKey: 'key',
          signal: controller.signal,
        })
      ).rejects.toThrow();
    });
  });
});
