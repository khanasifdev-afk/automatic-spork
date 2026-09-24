import {
  KeyTestStatus,
  UsageInfo,
  OutputOrientation,
  VideoQuality,
  ClipCandidate,
  ClipFileVariant,
  CandidateLabel,
  Scene,
} from '../types';

const PEXELS_TEST_TIMEOUT_MS = 6000;
const PEXELS_SEARCH_TIMEOUT_MS = 10000;
const PEXELS_SEARCH_BASE_URL = 'https://api.pexels.com/videos/search';
const PEXELS_TEST_URL = 'https://api.pexels.com/videos/search?query=nature&per_page=1';

export interface RawPexelsVideoFile {
  id: number;
  quality?: string;
  file_type?: string;
  width?: number | null;
  height?: number | null;
  fps?: number;
  link: string;
  size?: number;
}

export interface RawPexelsUser {
  id: number;
  name: string;
  url: string;
}

export interface RawPexelsVideo {
  id: number;
  width: number;
  height: number;
  duration: number;
  url: string;
  image: string;
  user: RawPexelsUser;
  video_files: RawPexelsVideoFile[];
  video_pictures?: Array<{ id: number; picture: string; nr: number }>;
}

export interface RawPexelsVideoSearchResponse {
  page: number;
  per_page: number;
  total_results: number;
  url?: string;
  videos: RawPexelsVideo[];
}

export class PexelsApiError extends Error {
  status?: number;
  isQuotaError?: boolean;
  isCredentialError?: boolean;
  isNetworkError?: boolean;

  constructor(
    message: string,
    options?: {
      status?: number;
      isQuotaError?: boolean;
      isCredentialError?: boolean;
      isNetworkError?: boolean;
    }
  ) {
    super(message);
    this.name = 'PexelsApiError';
    this.status = options?.status;
    this.isQuotaError = options?.isQuotaError;
    this.isCredentialError = options?.isCredentialError;
    this.isNetworkError = options?.isNetworkError;
  }
}

/**
 * In-memory cache for Pexels search results during the current session.
 * Never persisted to localStorage or sessionStorage.
 */
const searchCache = new Map<string, RawPexelsVideoSearchResponse>();

/**
 * Clears the in-memory Pexels search cache.
 */
export function clearPexelsSearchCache(): void {
  searchCache.clear();
}

/**
 * Formats a Unix epoch timestamp (seconds) into a readable local date and time.
 */
function formatResetTimestamp(rawTimestamp: string): string | undefined {
  const parsed = parseInt(rawTimestamp, 10);
  if (isNaN(parsed) || parsed <= 0) {
    return undefined;
  }
  try {
    const date = new Date(parsed * 1000);
    if (isNaN(date.getTime())) {
      return undefined;
    }
    return date.toLocaleString();
  } catch {
    return undefined;
  }
}

/**
 * Tests a Pexels API key with a lightweight 1-result video search request.
 * Parses rate-limit headers (X-Ratelimit-Limit, X-Ratelimit-Remaining, X-Ratelimit-Reset)
 * if accessible to browser JavaScript.
 * 
 * Never logs or exposes raw API keys in errors or network diagnostics.
 */
export async function testPexelsApiKey(apiKey: string): Promise<KeyTestStatus> {
  const trimmed = apiKey.trim();

  if (!trimmed) {
    return {
      state: 'invalid',
      message: 'Enter an API key first.',
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PEXELS_TEST_TIMEOUT_MS);

  try {
    const response = await fetch(PEXELS_TEST_URL, {
      method: 'GET',
      headers: {
        Authorization: trimmed,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const limitHeader = response.headers.get('X-Ratelimit-Limit') ?? response.headers.get('x-ratelimit-limit');
      const remainingHeader = response.headers.get('X-Ratelimit-Remaining') ?? response.headers.get('x-ratelimit-remaining');
      const resetHeader = response.headers.get('X-Ratelimit-Reset') ?? response.headers.get('x-ratelimit-reset');

      let usage: UsageInfo | undefined = undefined;

      if (limitHeader || remainingHeader || resetHeader) {
        const limit = limitHeader ? parseInt(limitHeader, 10) : undefined;
        const remaining = remainingHeader ? parseInt(remainingHeader, 10) : undefined;
        const resetsAt = resetHeader ? formatResetTimestamp(resetHeader) : undefined;

        usage = {
          limit: !isNaN(limit as number) ? limit : undefined,
          remaining: !isNaN(remaining as number) ? remaining : undefined,
          resetsAt,
        };
      }

      return {
        state: 'valid',
        message: usage
          ? 'Pexels API key is valid and connection confirmed.'
          : 'Pexels API key is valid. (Usage details unavailable via browser headers)',
        usage,
      };
    }

    if (response.status === 401 || response.status === 403) {
      return {
        state: 'invalid',
        message: 'Invalid Pexels API key or unauthorized.',
      };
    }

    if (response.status === 429) {
      return {
        state: 'quota-exhausted',
        message: 'Pexels request quota or rate limit exhausted.',
      };
    }

    if (response.status >= 500) {
      return {
        state: 'unavailable',
        message: `Pexels service is temporarily unavailable (${response.status}).`,
      };
    }

    return {
      state: 'unavailable',
      message: `Pexels request returned status ${response.status}.`,
    };
  } catch (err: unknown) {
    clearTimeout(timeoutId);

    if (err instanceof DOMException && err.name === 'AbortError') {
      return {
        state: 'timeout',
        message: 'Request timed out after 6 seconds.',
      };
    }

    return {
      state: 'unavailable',
      message: 'Network or CORS error connecting to Pexels API.',
    };
  }
}

/**
 * Builds the cache key based on normalized query, orientation, and requested page size.
 */
function buildCacheKey(query: string, orientation: OutputOrientation, perPage: number): string {
  return `${query.trim().toLowerCase()}::${orientation}::${perPage}`;
}

/**
 * Makes a direct browser request to Pexels Video Search API with in-memory caching.
 */
export async function searchPexelsVideosDirect(
  query: string,
  orientation: OutputOrientation,
  apiKey: string,
  perPage: number = 6,
  signal?: AbortSignal
): Promise<RawPexelsVideoSearchResponse> {
  const trimmedKey = apiKey.trim();
  if (!trimmedKey) {
    throw new PexelsApiError('Pexels API key is missing. Please configure your key in Settings.', {
      isCredentialError: true,
    });
  }

  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return {
      page: 1,
      per_page: perPage,
      total_results: 0,
      videos: [],
    };
  }

  const cacheKey = buildCacheKey(trimmedQuery, orientation, perPage);
  const cached = searchCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const searchParams = new URLSearchParams({
    query: trimmedQuery,
    per_page: Math.max(1, perPage).toString(),
    orientation,
  });

  const url = `${PEXELS_SEARCH_BASE_URL}?${searchParams.toString()}`;

  const internalController = new AbortController();
  const timeoutId = setTimeout(() => internalController.abort(), PEXELS_SEARCH_TIMEOUT_MS);

  // Use AbortSignal if available, else link signals
  let fetchSignal = internalController.signal;
  if (signal) {
    if ('any' in AbortSignal && typeof (AbortSignal as { any?: (signals: AbortSignal[]) => AbortSignal }).any === 'function') {
      fetchSignal = (AbortSignal as { any: (signals: AbortSignal[]) => AbortSignal }).any([
        signal,
        internalController.signal,
      ]);
    } else {
      signal.addEventListener('abort', () => internalController.abort(), { once: true });
      fetchSignal = internalController.signal;
    }
  }

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: trimmedKey,
        Accept: 'application/json',
      },
      signal: fetchSignal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = (await response.json()) as RawPexelsVideoSearchResponse;
      searchCache.set(cacheKey, data);
      return data;
    }

    if (response.status === 401 || response.status === 403) {
      throw new PexelsApiError('Invalid Pexels API key. Please check your credentials in Settings.', {
        status: response.status,
        isCredentialError: true,
      });
    }

    if (response.status === 429) {
      throw new PexelsApiError('Pexels monthly request limit or rate limit exceeded.', {
        status: 429,
        isQuotaError: true,
      });
    }

    if (response.status >= 500) {
      throw new PexelsApiError(`Pexels service is temporarily unavailable (${response.status}).`, {
        status: response.status,
      });
    }

    throw new PexelsApiError(`Pexels search returned error status ${response.status}.`, {
      status: response.status,
    });
  } catch (err: unknown) {
    clearTimeout(timeoutId);

    if (err instanceof PexelsApiError) {
      throw err;
    }

    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new PexelsApiError('Pexels video search request timed out.', { status: 408 });
    }

    throw new PexelsApiError('Network or CORS failure connecting to Pexels video search.', {
      isNetworkError: true,
    });
  }
}

/**
 * Checks whether a video file variant is a usable MP4 video.
 */
function isUsableMp4Variant(file: RawPexelsVideoFile): boolean {
  if (!file.link || typeof file.link !== 'string') {
    return false;
  }
  const mimeType = (file.file_type || '').toLowerCase();
  const linkLower = file.link.toLowerCase();
  return mimeType === 'video/mp4' || linkLower.includes('.mp4');
}

/**
 * Selects an appropriate preview video URL from usable variants (prefers lower-bandwidth SD/HD).
 */
function selectPreviewVideoUrl(variants: ClipFileVariant[]): string | undefined {
  if (variants.length === 0) return undefined;
  // Prefer smaller resolutions (<= 960 width or SD) for snappy preview playback in the browser
  const sd = variants.find(
    (v) => (v.quality && v.quality.toLowerCase() === 'sd') || (v.width > 0 && v.width <= 960)
  );
  if (sd) return sd.url;

  const hd = variants.find((v) => v.width > 0 && v.width <= 1920);
  if (hd) return hd.url;

  return variants[0].url;
}

/**
 * Normalizes a raw Pexels video object into ClipCandidate.
 * Applies hard filters:
 * 1. Valid Pexels video ID
 * 2. At least one usable MP4 variant
 * 3. Non-zero duration
 * 4. Valid preview or poster image URL
 */
export function normalizePexelsVideo(
  video: RawPexelsVideo,
  matchedQuery: string
): ClipCandidate | null {
  if (!video || typeof video.id !== 'number' || video.id <= 0) {
    return null;
  }

  if (typeof video.duration !== 'number' || video.duration <= 0) {
    return null;
  }

  if (!video.image || typeof video.image !== 'string' || !video.image.trim()) {
    return null;
  }

  const rawFiles = Array.isArray(video.video_files) ? video.video_files : [];
  const usableVariants: ClipFileVariant[] = rawFiles
    .filter(isUsableMp4Variant)
    .map((file) => ({
      url: file.link,
      mimeType: file.file_type || 'video/mp4',
      width: file.width ?? 0,
      height: file.height ?? 0,
      quality: file.quality,
      fileSize: file.size,
    }));

  if (usableVariants.length === 0) {
    return null;
  }

  const previewVideoUrl = selectPreviewVideoUrl(usableVariants);

  return {
    id: `clip-${video.id}`,
    pexelsVideoId: video.id,
    sourceUrl: video.url || `https://www.pexels.com/video/${video.id}/`,
    creatorName: video.user?.name || 'Pexels Creator',
    creatorUrl: video.user?.url || 'https://www.pexels.com',
    previewImageUrl: video.image,
    previewVideoUrl,
    durationSeconds: Math.round(video.duration),
    width: video.width || 0,
    height: video.height || 0,
    files: usableVariants,
    matchedQuery,
    score: 0,
    confidence: 'fair',
  };
}

/**
 * Filters candidates by orientation when matching media is available.
 * If candidates matching requested orientation exist, returns only those.
 * If none match, returns all candidates so we don't return an empty list when media exists.
 */
export function filterCandidatesByOrientation(
  candidates: ClipCandidate[],
  orientation: OutputOrientation
): ClipCandidate[] {
  const matchesOrientation = (c: ClipCandidate) => {
    if (orientation === 'landscape') {
      return c.width >= c.height;
    }
    return c.height >= c.width;
  };

  const matching = candidates.filter(matchesOrientation);
  if (matching.length > 0) {
    return matching;
  }

  // Fallback to any orientation when matching media is unavailable
  return candidates;
}

/**
 * Scores and ranks candidates according to Feature 3 rules:
 * 1. Query & metadata relevance (primary vs fallback query, keyword overlap)
 * 2. Orientation match
 * 3. Resolution suitability (close to target quality)
 * 4. Duration suitability (near scene estimated seconds)
 * 5. Duplicate avoidance across scenes (penalty if already selected elsewhere)
 */
export function rankCandidates(
  candidates: ClipCandidate[],
  scene: Scene,
  orientation: OutputOrientation,
  quality: VideoQuality,
  previouslySelectedVideoIds: Set<number>
): ClipCandidate[] {
  const isPrimaryQuery = (matchedQuery: string) =>
    matchedQuery.trim().toLowerCase() === scene.primaryQuery.trim().toLowerCase();

  const queryTerms = scene.primaryQuery
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2);

  const scored = candidates.map((candidate) => {
    let score = 0;

    // 1. Query & metadata relevance (up to 40 points)
    if (isPrimaryQuery(candidate.matchedQuery)) {
      score += 35;
    } else {
      score += 20; // Fallback query
    }

    const urlOrCreator = `${candidate.sourceUrl} ${candidate.creatorName}`.toLowerCase();
    const matchesTerm = queryTerms.some((term) => urlOrCreator.includes(term));
    if (matchesTerm) {
      score += 5;
    }

    // 2. Orientation match (up to 25 points)
    const matchesOrientation =
      orientation === 'landscape'
        ? candidate.width >= candidate.height
        : candidate.height >= candidate.width;

    if (matchesOrientation) {
      score += 25;
    } else {
      score += 0;
    }

    // 3. Resolution suitability (up to 20 points)
    const maxDimension = Math.max(candidate.width, candidate.height);
    if (quality === '4k') {
      if (maxDimension >= 3840) score += 20;
      else if (maxDimension >= 1920) score += 15;
      else score += 10;
    } else if (quality === '1080p') {
      if (maxDimension >= 1920) score += 20;
      else if (maxDimension >= 1280) score += 14;
      else score += 8;
    } else {
      // 720p
      if (maxDimension >= 1280) score += 20;
      else score += 12;
    }

    // 4. Duration suitability (up to 15 points)
    const targetDuration = scene.estimatedSeconds || 5;
    const durationDiff = Math.abs(candidate.durationSeconds - targetDuration);
    if (durationDiff <= 3) {
      score += 15;
    } else if (durationDiff <= 8) {
      score += 10;
    } else if (durationDiff <= 15) {
      score += 6;
    } else {
      score += 2;
    }

    // 5. Duplicate avoidance across scenes (penalty of -45 points)
    if (previouslySelectedVideoIds.has(candidate.pexelsVideoId)) {
      score -= 45;
    }

    // Determine confidence label
    let confidence: 'strong' | 'fair' | 'weak';
    if (score >= 70) {
      confidence = 'strong';
    } else if (score >= 45) {
      confidence = 'fair';
    } else {
      confidence = 'weak';
    }

    return {
      ...candidate,
      score,
      confidence,
    };
  });

  // Sort descending by score
  scored.sort((a, b) => b.score - a.score);

  const CANDIDATE_LABELS: CandidateLabel[] = ['A', 'B', 'C', 'D', 'E', 'F'];

  // Retain the top 6 candidates and assign labels A-F
  return scored.slice(0, 6).map((candidate, index) => ({
    ...candidate,
    candidateLabel: CANDIDATE_LABELS[index],
  }));
}

/**
 * Searches Pexels videos for a scene, applying primary and fallback queries if needed,
 * normalizing, filtering, deduplicating, ranking, and capping at 6 candidates.
 */
export async function searchClipsForScene(
  scene: Scene,
  orientation: OutputOrientation,
  quality: VideoQuality,
  apiKey: string,
  previouslySelectedVideoIds: Set<number>,
  customQuery?: string,
  signal?: AbortSignal
): Promise<ClipCandidate[]> {
  const primaryQuery = customQuery?.trim() || scene.primaryQuery.trim();
  const allCandidates: ClipCandidate[] = [];
  const seenVideoIds = new Set<number>();

  const matchesOrientation = (c: ClipCandidate) =>
    orientation === 'landscape' ? c.width >= c.height : c.height >= c.width;

  // 1. Search primary query
  if (primaryQuery) {
    try {
      const response = await searchPexelsVideosDirect(
        primaryQuery,
        orientation,
        apiKey,
        6,
        signal
      );

      for (const rawVideo of response.videos || []) {
        const candidate = normalizePexelsVideo(rawVideo, primaryQuery);
        if (candidate && !seenVideoIds.has(candidate.pexelsVideoId)) {
          seenVideoIds.add(candidate.pexelsVideoId);
          allCandidates.push(candidate);
        }
      }
    } catch (err) {
      // If primary query fails with a credential or quota error, rethrow immediately
      if (err instanceof PexelsApiError && (err.isCredentialError || err.isQuotaError)) {
        throw err;
      }
      // Otherwise allow fallbacks to attempt
    }
  }

  // 2. If insufficient orientation-matching candidates (< 6) and not a custom query, attempt fallback queries
  const matchingCount = allCandidates.filter(matchesOrientation).length;
  if (!customQuery && (matchingCount < 6 || allCandidates.length < 6) && Array.isArray(scene.fallbackQueries)) {
    for (const fallbackQuery of scene.fallbackQueries) {
      const currentMatching = allCandidates.filter(matchesOrientation).length;
      if (currentMatching >= 6 && allCandidates.length >= 6) break;

      const trimmedFallback = fallbackQuery.trim();
      if (!trimmedFallback || trimmedFallback.toLowerCase() === primaryQuery.toLowerCase()) {
        continue;
      }

      try {
        const fallbackResponse = await searchPexelsVideosDirect(
          trimmedFallback,
          orientation,
          apiKey,
          6,
          signal
        );

        for (const rawVideo of fallbackResponse.videos || []) {
          const candidate = normalizePexelsVideo(rawVideo, trimmedFallback);
          if (candidate && !seenVideoIds.has(candidate.pexelsVideoId)) {
            seenVideoIds.add(candidate.pexelsVideoId);
            allCandidates.push(candidate);
            if (allCandidates.filter(matchesOrientation).length >= 12) break; // Collect a pool before ranking
          }
        }
      } catch {
        // Continue to next fallback
      }
    }
  }

  // 3. Filter candidates by orientation when matching media is available
  const orientationFiltered = filterCandidatesByOrientation(allCandidates, orientation);

  // 4. Rank candidates, cap at 6, and assign labels A-F
  return rankCandidates(
    orientationFiltered,
    scene,
    orientation,
    quality,
    previouslySelectedVideoIds
  );
}
