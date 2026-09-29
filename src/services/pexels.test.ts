import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  testPexelsApiKey,
  searchPexelsVideosDirect,
  normalizePexelsVideo,
  filterCandidatesByOrientation,
  rankCandidates,
  searchClipsForScene,
  clearPexelsSearchCache,
  RawPexelsVideo,
} from './pexels';
import { Scene, ClipCandidate } from '../types';

describe('testPexelsApiKey', () => {
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

    const result = await testPexelsApiKey('');
    expect(result.state).toBe('invalid');
    expect(result.message).toContain('Enter an API key first');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('parses rate-limit headers when returned on 200 OK', async () => {
    const mockHeaders = new Headers();
    mockHeaders.set('X-Ratelimit-Limit', '200');
    mockHeaders.set('X-Ratelimit-Remaining', '185');
    mockHeaders.set('X-Ratelimit-Reset', '1700000000');

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: mockHeaders,
    });

    const result = await testPexelsApiKey('valid-pexels-key');
    expect(result.state).toBe('valid');
    expect(result.usage).toBeDefined();
    expect(result.usage?.limit).toBe(200);
    expect(result.usage?.remaining).toBe(185);
    expect(result.usage?.resetsAt).toBeDefined();
  });

  it('remains valid with usage labeled unavailable when headers are missing', async () => {
    const mockHeaders = new Headers();

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: mockHeaders,
    });

    const result = await testPexelsApiKey('valid-pexels-key');
    expect(result.state).toBe('valid');
    expect(result.message).toContain('Usage details unavailable via browser headers');
    expect(result.usage).toBeUndefined();
  });

  it('returns invalid state on 401 or 403 unauthorized response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      headers: new Headers(),
    });

    const result = await testPexelsApiKey('bad-key');
    expect(result.state).toBe('invalid');
    expect(result.message).toContain('Invalid Pexels API key or unauthorized');
  });

  it('returns quota-exhausted state on 429 response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      headers: new Headers(),
    });

    const result = await testPexelsApiKey('quota-key');
    expect(result.state).toBe('quota-exhausted');
    expect(result.message).toContain('quota or rate limit exhausted');
  });

  it('returns timeout state when request is aborted', async () => {
    globalThis.fetch = vi.fn().mockImplementation(() => {
      const abortError = new DOMException('The user aborted a request.', 'AbortError');
      return Promise.reject(abortError);
    });

    const result = await testPexelsApiKey('timeout-key');
    expect(result.state).toBe('timeout');
    expect(result.message).toContain('Request timed out');
  });

  it('returns unavailable state on network or CORS failure', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    const result = await testPexelsApiKey('network-fail-key');
    expect(result.state).toBe('unavailable');
    expect(result.message).toContain('Network or CORS error');
  });

  it('returns unavailable state on server error (500)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      headers: new Headers(),
    });

    const result = await testPexelsApiKey('server-err-key');
    expect(result.state).toBe('unavailable');
    expect(result.message).toContain('temporarily unavailable');
  });
});

describe('searchPexelsVideosDirect and In-Memory Cache', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    clearPexelsSearchCache();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('throws credential error if API key is missing', async () => {
    await expect(searchPexelsVideosDirect('nature', 'landscape', '')).rejects.toThrow(
      'Pexels API key is missing'
    );
  });

  it('returns empty result if query is empty without fetching', async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock;

    const res = await searchPexelsVideosDirect('', 'landscape', 'valid-key');
    expect(res.videos).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fetches videos directly with correct params and authorization header', async () => {
    const mockResponse = {
      page: 1,
      per_page: 5,
      total_results: 1,
      videos: [
        {
          id: 101,
          width: 1920,
          height: 1080,
          duration: 10,
          url: 'https://pexels.com/video/101',
          image: 'https://images.pexels.com/101.jpg',
          user: { id: 1, name: 'Creator One', url: 'https://pexels.com/@creator1' },
          video_files: [
            { id: 1, file_type: 'video/mp4', link: 'https://pexels.com/video1.mp4', width: 1920, height: 1080 },
          ],
        },
      ],
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockResponse),
    });
    globalThis.fetch = fetchMock;

    const result = await searchPexelsVideosDirect('forest trees', 'landscape', 'secret-key', 5);
    expect(result.videos.length).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const callUrl = fetchMock.mock.calls[0][0] as string;
    expect(callUrl).toContain('query=forest+trees');
    expect(callUrl).toContain('orientation=landscape');
    expect(callUrl).toContain('per_page=5');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('secret-key');

    // Second call with same parameters should return from in-memory cache
    const cachedResult = await searchPexelsVideosDirect('forest trees', 'landscape', 'secret-key', 5);
    expect(cachedResult).toEqual(mockResponse);
    expect(fetchMock).toHaveBeenCalledTimes(1); // Not called again
  });

  it('handles 401/403 with descriptive credential error', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
    });

    await expect(searchPexelsVideosDirect('nature', 'landscape', 'bad-key')).rejects.toThrow(
      'Invalid Pexels API key'
    );
  });

  it('handles 429 with rate limit error', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
    });

    await expect(searchPexelsVideosDirect('nature', 'landscape', 'valid-key')).rejects.toThrow(
      'limit exceeded'
    );
  });
});

describe('normalizePexelsVideo and Hard Filters', () => {
  it('rejects video missing ID or with ID <= 0', () => {
    const raw = {
      id: 0,
      width: 1920,
      height: 1080,
      duration: 10,
      url: 'url',
      image: 'img.jpg',
      user: { id: 1, name: 'User', url: 'url' },
      video_files: [{ id: 1, file_type: 'video/mp4', link: 'clip.mp4' }],
    } as unknown as RawPexelsVideo;

    expect(normalizePexelsVideo(raw, 'query')).toBeNull();
  });

  it('rejects video with zero or negative duration', () => {
    const raw = {
      id: 10,
      width: 1920,
      height: 1080,
      duration: 0,
      url: 'url',
      image: 'img.jpg',
      user: { id: 1, name: 'User', url: 'url' },
      video_files: [{ id: 1, file_type: 'video/mp4', link: 'clip.mp4' }],
    } as unknown as RawPexelsVideo;

    expect(normalizePexelsVideo(raw, 'query')).toBeNull();
  });

  it('rejects video missing preview image', () => {
    const raw = {
      id: 10,
      width: 1920,
      height: 1080,
      duration: 5,
      url: 'url',
      image: '',
      user: { id: 1, name: 'User', url: 'url' },
      video_files: [{ id: 1, file_type: 'video/mp4', link: 'clip.mp4' }],
    } as unknown as RawPexelsVideo;

    expect(normalizePexelsVideo(raw, 'query')).toBeNull();
  });

  it('rejects video without any usable MP4 variants', () => {
    const raw = {
      id: 10,
      width: 1920,
      height: 1080,
      duration: 5,
      url: 'url',
      image: 'img.jpg',
      user: { id: 1, name: 'User', url: 'url' },
      video_files: [{ id: 1, file_type: 'video/webm', link: 'clip.webm' }],
    } as unknown as RawPexelsVideo;

    expect(normalizePexelsVideo(raw, 'query')).toBeNull();
  });

  it('normalizes valid video and picks suitable preview video URL', () => {
    const raw: RawPexelsVideo = {
      id: 123,
      width: 1920,
      height: 1080,
      duration: 12.4,
      url: 'https://pexels.com/video/123/',
      image: 'https://images.pexels.com/123.jpg',
      user: { id: 45, name: 'Jane Doe', url: 'https://pexels.com/@janedoe' },
      video_files: [
        { id: 1, quality: 'hd', file_type: 'video/mp4', link: 'https://pexels.com/hd.mp4', width: 1920, height: 1080 },
        { id: 2, quality: 'sd', file_type: 'video/mp4', link: 'https://pexels.com/sd.mp4', width: 960, height: 540 },
      ],
    };

    const candidate = normalizePexelsVideo(raw, 'running athlete');
    expect(candidate).not.toBeNull();
    expect(candidate?.id).toBe('clip-123');
    expect(candidate?.pexelsVideoId).toBe(123);
    expect(candidate?.creatorName).toBe('Jane Doe');
    expect(candidate?.durationSeconds).toBe(12);
    expect(candidate?.previewVideoUrl).toBe('https://pexels.com/sd.mp4');
    expect(candidate?.matchedQuery).toBe('running athlete');
  });
});

describe('filterCandidatesByOrientation', () => {
  const landscapeCandidate = {
    id: 'c1',
    pexelsVideoId: 1,
    width: 1920,
    height: 1080,
  } as ClipCandidate;

  const portraitCandidate = {
    id: 'c2',
    pexelsVideoId: 2,
    width: 1080,
    height: 1920,
  } as ClipCandidate;

  it('keeps only landscape candidates when matching media is available', () => {
    const result = filterCandidatesByOrientation([landscapeCandidate, portraitCandidate], 'landscape');
    expect(result).toEqual([landscapeCandidate]);
  });

  it('keeps only portrait candidates when matching media is available', () => {
    const result = filterCandidatesByOrientation([landscapeCandidate, portraitCandidate], 'portrait');
    expect(result).toEqual([portraitCandidate]);
  });

  it('falls back to all candidates if none match requested orientation', () => {
    const result = filterCandidatesByOrientation([portraitCandidate], 'landscape');
    expect(result).toEqual([portraitCandidate]);
  });
});

describe('rankCandidates and duplicate avoidance', () => {
  const scene: Scene = {
    id: 's1',
    sequence: 1,
    scriptText: 'Walking through a serene forest path.',
    visualDescription: 'Serene forest path with tall trees.',
    primaryQuery: 'forest path',
    fallbackQueries: ['trees woods'],
    avoidTerms: [],
    estimatedSeconds: 6,
  };

  const candidateA: ClipCandidate = {
    id: 'c-10',
    pexelsVideoId: 10,
    sourceUrl: 'https://pexels.com/video/forest-path-10/',
    creatorName: 'Nature Lover',
    creatorUrl: '',
    previewImageUrl: 'img1.jpg',
    durationSeconds: 6,
    width: 1920,
    height: 1080,
    files: [],
    matchedQuery: 'forest path', // Primary
    score: 0,
    confidence: 'fair',
  };

  const candidateB: ClipCandidate = {
    id: 'c-20',
    pexelsVideoId: 20,
    sourceUrl: 'https://pexels.com/video/trees-woods-20/',
    creatorName: 'Cam Operator',
    creatorUrl: '',
    previewImageUrl: 'img2.jpg',
    durationSeconds: 25,
    width: 1280,
    height: 720,
    files: [],
    matchedQuery: 'trees woods', // Fallback
    score: 0,
    confidence: 'fair',
  };

  it('ranks primary query, matching duration, and 1080p higher', () => {
    const ranked = rankCandidates(
      [candidateB, candidateA],
      scene,
      'landscape',
      '1080p',
      new Set()
    );

    expect(ranked[0].id).toBe('c-10');
    expect(ranked[0].confidence).toBe('strong');
    expect(ranked[1].id).toBe('c-20');
  });

  it('applies duplicate avoidance penalty when a video is already used in another scene', () => {
    // candidateA was already selected in another scene
    const previousSelections = new Set([10]);

    const ranked = rankCandidates(
      [candidateA, candidateB],
      scene,
      'landscape',
      '1080p',
      previousSelections
    );

    // Because candidateA received a -45 duplicate penalty, candidateB should rank higher
    expect(ranked[0].id).toBe('c-20');
    expect(ranked[1].id).toBe('c-10');
  });

  it('caps candidates at a maximum of six and assigns candidate labels A through F', () => {
    const manyCandidates: ClipCandidate[] = Array.from({ length: 10 }, (_, i) => ({
      ...candidateA,
      id: `c-${i}`,
      pexelsVideoId: i + 100,
    }));

    const ranked = rankCandidates(
      manyCandidates,
      scene,
      'landscape',
      '1080p',
      new Set()
    );

    expect(ranked.length).toBe(6);
    expect(ranked.map((c) => c.candidateLabel)).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
  });
});

describe('searchClipsForScene orchestration', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    clearPexelsSearchCache();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const testScene: Scene = {
    id: 'scene-1',
    sequence: 1,
    scriptText: 'Script segment about deep ocean life.',
    visualDescription: 'Deep ocean footage with glowing jellyfish.',
    primaryQuery: 'deep ocean',
    fallbackQueries: ['jellyfish swimming', 'underwater sea life'],
    avoidTerms: [],
    estimatedSeconds: 5,
  };

  const createMockRawVideo = (id: number, width = 1920, height = 1080) => ({
    id,
    width,
    height,
    duration: 5,
    url: `https://pexels.com/video/${id}`,
    image: `img${id}.jpg`,
    user: { id, name: `User ${id}`, url: '' },
    video_files: [{ id, file_type: 'video/mp4', link: `${id}.mp4`, width, height }],
  });

  it('caps primary query results greater than six to exactly six and assigns labels A-F', async () => {
    const primaryVideos = [1, 2, 3, 4, 5, 6, 7, 8].map((id) => createMockRawVideo(id));

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ page: 1, per_page: 6, total_results: 8, videos: primaryVideos }),
    });

    const candidates = await searchClipsForScene(
      testScene,
      'landscape',
      '1080p',
      'valid-key',
      new Set()
    );

    expect(candidates.length).toBe(6);
    expect(candidates.map((c) => c.candidateLabel)).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
  });

  it('uses fallback queries when primary query returns fewer than 6 candidates to reach 6', async () => {
    const primaryVideos = [1, 2, 3].map((id) => createMockRawVideo(id));
    const fallbackVideos = [4, 5, 6, 7].map((id) => createMockRawVideo(id));

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('deep+ocean')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ page: 1, per_page: 6, total_results: 3, videos: primaryVideos }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ page: 1, per_page: 6, total_results: 4, videos: fallbackVideos }),
      });
    });

    const candidates = await searchClipsForScene(
      testScene,
      'landscape',
      '1080p',
      'valid-key',
      new Set()
    );

    expect(candidates.length).toBe(6);
    const ids = candidates.map((c) => c.pexelsVideoId);
    expect(ids).toEqual([1, 2, 3, 4, 5, 6]);
    expect(candidates.map((c) => c.candidateLabel)).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
  });

  it('deduplicates duplicate IDs across primary and fallback queries without duplicating videos', async () => {
    // Primary has 1, 2, 3. Fallback has 2, 3, 4, 5 (2 and 3 are duplicates)
    const primaryVideos = [1, 2, 3].map((id) => createMockRawVideo(id));
    const fallbackVideos = [2, 3, 4, 5].map((id) => createMockRawVideo(id));

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('deep+ocean')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ page: 1, per_page: 6, total_results: 3, videos: primaryVideos }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ page: 1, per_page: 6, total_results: 4, videos: fallbackVideos }),
      });
    });

    const candidates = await searchClipsForScene(
      testScene,
      'landscape',
      '1080p',
      'valid-key',
      new Set()
    );

    // Total unique videos: 1, 2, 3, 4, 5 (5 total)
    expect(candidates.length).toBe(5);
    const ids = candidates.map((c) => c.pexelsVideoId);
    expect(new Set(ids).size).toBe(5);
    expect(ids).toContain(1);
    expect(ids).toContain(2);
    expect(ids).toContain(3);
    expect(ids).toContain(4);
    expect(ids).toContain(5);
  });

  it('strictly excludes clips that were already used in other scenes (no repetition rule)', async () => {
    // Primary has clips 1, 2, 3, 4, 5, 6, but clips 1 and 2 were used in previous scenes
    const primaryVideos = [1, 2, 3, 4, 5, 6].map((id) => createMockRawVideo(id));
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ page: 1, per_page: 6, total_results: 6, videos: primaryVideos }),
    });

    const previouslySelected = new Set([1, 2]);
    const candidates = await searchClipsForScene(
      testScene,
      'landscape',
      '1080p',
      'valid-key',
      previouslySelected
    );

    const ids = candidates.map((c) => c.pexelsVideoId);
    expect(ids).not.toContain(1);
    expect(ids).not.toContain(2);
    expect(ids).toEqual([3, 4, 5, 6]);
  });

  it('returns fewer than 6 candidates when all fallbacks are exhausted and total unique usable clips < 6', async () => {
    const primaryVideos = [1, 2].map((id) => createMockRawVideo(id));
    const fallback1Videos = [3].map((id) => createMockRawVideo(id));
    const fallback2Videos: typeof primaryVideos = [];

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('deep+ocean')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ page: 1, per_page: 6, total_results: 2, videos: primaryVideos }),
        });
      }
      if (url.includes('jellyfish+swimming')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ page: 1, per_page: 6, total_results: 1, videos: fallback1Videos }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ page: 1, per_page: 6, total_results: 0, videos: fallback2Videos }),
      });
    });

    const candidates = await searchClipsForScene(
      testScene,
      'landscape',
      '1080p',
      'valid-key',
      new Set()
    );

    // Total found is 3 (< 6)
    expect(candidates.length).toBe(3);
    expect(candidates.map((c) => c.candidateLabel)).toEqual(['A', 'B', 'C']);
  });
});
