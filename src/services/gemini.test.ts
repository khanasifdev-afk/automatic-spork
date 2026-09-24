import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  testGeminiApiKey,
  validateGeminiSceneResponse,
  analyzeScriptWithGemini,
} from './gemini';
import { DEFAULT_ELEVENLABS_SETTINGS } from '../storage/settingsStorage';

describe('testGeminiApiKey', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('rejects empty or whitespace-only key without fetching', async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock;

    const result = await testGeminiApiKey('   ');
    expect(result.state).toBe('invalid');
    expect(result.message).toContain('Enter an API key first');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns valid state on 200 OK response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });

    const result = await testGeminiApiKey('valid-gemini-key');
    expect(result.state).toBe('valid');
    expect(result.message).toContain('gemini-2.5-flash');
    expect(result.usage).toBeUndefined(); // Google AI Studio link will be shown in UI
  });

  it('returns invalid state on 401 or 403 unauthorized response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
    });

    const result = await testGeminiApiKey('bad-key');
    expect(result.state).toBe('invalid');
    expect(result.message).toContain('Invalid API key or unauthorized');
  });

  it('returns quota-exhausted state on 429 response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
    });

    const result = await testGeminiApiKey('quota-key');
    expect(result.state).toBe('quota-exhausted');
    expect(result.message).toContain('quota or rate limit exceeded');
  });

  it('returns timeout state when AbortError is thrown', async () => {
    globalThis.fetch = vi.fn().mockImplementation(() => {
      const abortError = new DOMException('The user aborted a request.', 'AbortError');
      return Promise.reject(abortError);
    });

    const result = await testGeminiApiKey('timeout-key');
    expect(result.state).toBe('timeout');
    expect(result.message).toContain('Request timed out');
  });

  it('returns unavailable state on network or CORS failure', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    const result = await testGeminiApiKey('network-fail-key');
    expect(result.state).toBe('unavailable');
    expect(result.message).toContain('Network or CORS error');
  });

  it('returns unavailable state on server error (500)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });

    const result = await testGeminiApiKey('server-err-key');
    expect(result.state).toBe('unavailable');
    expect(result.message).toContain('temporarily unavailable');
  });
});

describe('validateGeminiSceneResponse', () => {
  it('validates and normalizes valid scenes structure', () => {
    const raw = {
      scenes: [
        {
          scriptText: 'Regular walking can improve balance and confidence.',
          visualDescription: 'An active senior walking in a park',
          primaryQuery: 'senior walking park',
          fallbackQueries: ['older adult walking', 'outdoor fitness'],
          avoidTerms: ['wheelchair'],
          estimatedSeconds: 6,
        },
        {
          scriptText: 'It also helps your mood.',
          visualDescription: 'A smiling person enjoying morning sunshine',
          primaryQuery: 'happy person morning park',
        },
      ],
    };

    const scenes = validateGeminiSceneResponse(raw);
    expect(scenes).toHaveLength(2);
    expect(scenes[0].sequence).toBe(1);
    expect(scenes[0].scriptText).toBe('Regular walking can improve balance and confidence.');
    expect(scenes[0].primaryQuery).toBe('senior walking park');
    expect(scenes[0].fallbackQueries).toEqual(['older adult walking', 'outdoor fitness']);
    expect(scenes[0].avoidTerms).toEqual(['wheelchair']);
    expect(scenes[0].estimatedSeconds).toBe(6);

    expect(scenes[1].sequence).toBe(2);
    expect(scenes[1].fallbackQueries).toEqual([]);
    expect(scenes[1].avoidTerms).toEqual([]);
    expect(scenes[1].estimatedSeconds).toBeGreaterThan(0);
  });

  it('throws GeminiAnalysisError if scenes array is empty or missing', () => {
    expect(() => validateGeminiSceneResponse({ scenes: [] })).toThrow(
      'Gemini response contained no scenes'
    );
    expect(() => validateGeminiSceneResponse({})).toThrow(
      'Gemini response contained no scenes'
    );
  });

  it('throws GeminiAnalysisError if required fields are missing', () => {
    const invalid = {
      scenes: [
        {
          scriptText: 'Only script text',
        },
      ],
    };
    expect(() => validateGeminiSceneResponse(invalid)).toThrow(
      'missing or empty visual description'
    );
  });
});

describe('analyzeScriptWithGemini', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const sampleOptions = {
    orientation: 'landscape' as const,
    quality: '1080p' as const,
    sceneLength: 'standard' as const,
    elevenLabs: DEFAULT_ELEVENLABS_SETTINGS,
  };

  it('rejects missing API key', async () => {
    await expect(
      analyzeScriptWithGemini('Some script', sampleOptions, '   ')
    ).rejects.toThrow('Gemini API key is required');
  });

  it('rejects empty script', async () => {
    await expect(
      analyzeScriptWithGemini('   ', sampleOptions, 'valid-key')
    ).rejects.toThrow('Script cannot be empty');
  });

  it('successfully returns validated scenes from Gemini API', async () => {
    const geminiPayload = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  scenes: [
                    {
                      sequence: 1,
                      scriptText: 'Welcome to this guide.',
                      visualDescription: 'Host smiling at camera in studio',
                      primaryQuery: 'presenter studio smile',
                      fallbackQueries: ['speaking host', 'video creator'],
                      avoidTerms: ['dark room'],
                      estimatedSeconds: 4,
                    },
                  ],
                }),
              },
            ],
          },
        },
      ],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(geminiPayload),
    });

    const scenes = await analyzeScriptWithGemini('Welcome to this guide.', sampleOptions, 'key123');
    expect(scenes).toHaveLength(1);
    expect(scenes[0].scriptText).toBe('Welcome to this guide.');
    expect(scenes[0].primaryQuery).toBe('presenter studio smile');
  });

  it('handles 429 quota exhaustion', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
    });

    await expect(
      analyzeScriptWithGemini('Hello world', sampleOptions, 'key123')
    ).rejects.toThrow('Gemini quota or rate limit exceeded');
  });

  it('handles invalid response JSON from Gemini', async () => {
    const invalidGeminiPayload = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: 'Not JSON at all',
              },
            ],
          },
        },
      ],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(invalidGeminiPayload),
    });

    await expect(
      analyzeScriptWithGemini('Hello world', sampleOptions, 'key123')
    ).rejects.toThrow('Gemini returned an invalid response structure');
  });
});
