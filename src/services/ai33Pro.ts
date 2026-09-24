import {
  KeyTestStatus,
  Ai33Voice,
  Ai33SourceProvider,
  GenerateSceneSpeechParams,
  GeneratedVoiceResult,
  Ai33ProOptions,
} from '../types';
import { measureAudioDuration } from './elevenLabs';

export const AI33_PRO_API_BASE = 'https://api.ai33.pro';

export class Ai33ProApiError extends Error {
  public statusCode?: number;
  public isCredentialError: boolean;
  public isQuotaError: boolean;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'Ai33ProApiError';
    this.statusCode = statusCode;
    this.isCredentialError = statusCode === 401 || statusCode === 403;
    this.isQuotaError = statusCode === 429;
  }
}

/**
 * Tests an AI33 Pro API key using the lightweight credits endpoint.
 * Does not synthesize speech or consume credits.
 */
export async function testAi33ProApiKey(apiKey: string): Promise<KeyTestStatus> {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    return {
      state: 'invalid',
      message: 'Enter an API key first.',
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const response = await fetch(`${AI33_PRO_API_BASE}/v1/credits`, {
      method: 'GET',
      headers: {
        'xi-api-key': trimmed,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.status === 401 || response.status === 403) {
      return {
        state: 'invalid',
        message: 'Invalid AI33 Pro API key or unauthorized access.',
      };
    }

    if (response.status === 429) {
      return {
        state: 'quota-exhausted',
        message: 'AI33 Pro quota exhausted or rate limit reached.',
      };
    }

    if (!response.ok) {
      return {
        state: 'unavailable',
        message: `AI33 Pro returned HTTP error ${response.status}.`,
      };
    }

    const data = await response.json();
    const credits = typeof data.credits === 'number' ? data.credits : undefined;

    return {
      state: 'valid',
      message: 'AI33 Pro connection verified successfully.',
      usage: {
        credits,
      },
    };
  } catch (err) {
    clearTimeout(timeoutId);

    if (err instanceof DOMException && err.name === 'AbortError') {
      return {
        state: 'timeout',
        message: 'Request timed out after 6 seconds. Please retry.',
      };
    }

    const errorMessage = err instanceof Error ? err.message : 'Unable to connect to AI33 Pro service.';
    return {
      state: 'unavailable',
      message: errorMessage,
    };
  }
}

/**
 * Loads available voices from AI33 Pro for a specified source provider.
 * Uses pagination to retrieve the full catalog without persisting to storage.
 */
export async function fetchAi33ProVoices(
  apiKey: string,
  provider: Ai33SourceProvider
): Promise<Ai33Voice[]> {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    return [];
  }

  const allVoices: Ai33Voice[] = [];
  let page = 1;
  const pageSize = 100;
  const maxPages = 10; // Safety cap to avoid infinite pagination

  while (page <= maxPages) {
    const url = `${AI33_PRO_API_BASE}/v3/voices?provider=${encodeURIComponent(provider)}&page=${page}&page_size=${pageSize}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'xi-api-key': trimmed,
      },
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Ai33ProApiError('Invalid AI33 Pro API key.', response.status);
      }
      throw new Ai33ProApiError(`Failed to fetch AI33 Pro voices (${response.status}).`, response.status);
    }

    const data = await response.json();
    const items = Array.isArray(data.data) ? data.data : [];

    for (const item of items) {
      if (item && item.voice_id) {
        allVoices.push({
          voice_id: String(item.voice_id),
          name: String(item.name || item.voice_id),
          language: item.language ? String(item.language) : undefined,
          gender: item.gender ? String(item.gender) : undefined,
          tags: Array.isArray(item.tags) ? item.tags.map(String) : undefined,
          preview_url: item.preview_url ? String(item.preview_url) : undefined,
        });
      }
    }

    if (!data.pagination?.has_more) {
      break;
    }

    page++;
  }

  return allVoices;
}

/**
 * Helper to pause polling while respecting AbortSignal cancellation immediately.
 */
function waitWithSignal(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      return reject(new DOMException('The operation was aborted', 'AbortError'));
    }
    const timeoutId = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timeoutId);
      signal?.removeEventListener('abort', onAbort);
      reject(new DOMException('The operation was aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort);
  });
}

/**
 * Generates an audio segment for a scene's narration text using AI33 Pro v3 text-to-speech.
 * Sends FormData to POST /v3/text-to-speech and polls GET /v1/task/{task_id} until done.
 */
export async function generateAi33ProSpeech({
  scriptText,
  voiceId,
  options,
  apiKey,
  signal,
  onProgress,
}: GenerateSceneSpeechParams): Promise<GeneratedVoiceResult> {
  const trimmedKey = apiKey.trim();
  if (!trimmedKey) {
    throw new Ai33ProApiError('AI33 Pro API key is missing.', 401);
  }

  const trimmedText = scriptText.trim();
  if (!trimmedText) {
    throw new Ai33ProApiError('Scene script text cannot be empty.', 422);
  }

  const effectiveVoiceId = voiceId.trim() || (options as Ai33ProOptions).voiceId?.trim();
  if (!effectiveVoiceId) {
    throw new Ai33ProApiError('No AI33 Pro voice selected. Please select a voice.', 422);
  }

  const speedVal = (options as Ai33ProOptions).speed ?? 1.0;
  const clampedSpeed = Math.max(0.5, Math.min(1.5, speedVal));

  // Build FormData payload strictly containing supported v3 fields
  const buildFormData = () => {
    const formData = new FormData();
    formData.append('text', trimmedText);
    formData.append('voice_id', effectiveVoiceId);
    formData.append('speed', String(clampedSpeed));
    formData.append('with_transcript', 'false');
    return formData;
  };

  let createResponse: Response | null = null;
  const MAX_CREATION_ATTEMPTS = 3;

  for (let attempt = 1; attempt <= MAX_CREATION_ATTEMPTS; attempt++) {
    createResponse = await fetch(`${AI33_PRO_API_BASE}/v3/text-to-speech`, {
      method: 'POST',
      headers: {
        'xi-api-key': trimmedKey,
      },
      body: buildFormData(),
      signal,
    });

    if (createResponse.ok) {
      break;
    }

    if (createResponse.status === 429 && attempt < MAX_CREATION_ATTEMPTS) {
      await waitWithSignal(1500 * attempt, signal);
      continue;
    }

    // Non-retryable error or exhausted attempts
    break;
  }

  if (!createResponse || !createResponse.ok) {
    let errorDetail = '';
    try {
      const errJson = await createResponse?.json();
      if (errJson && typeof errJson.error_message === 'string') {
        errorDetail = errJson.error_message;
      } else if (errJson && typeof errJson.message === 'string') {
        errorDetail = errJson.message;
      }
    } catch {
      // Non-JSON response
    }

    const status = createResponse ? createResponse.status : 500;
    const message = errorDetail
      ? `AI33 Pro error: ${errorDetail}`
      : status === 401 || status === 403
      ? 'Invalid AI33 Pro API key or unauthorized request.'
      : status === 429
      ? 'AI33 Pro quota exceeded or rate limit reached.'
      : status === 422
      ? 'AI33 Pro rejected the request parameters or voice ID.'
      : `AI33 Pro task creation failed with status HTTP ${status}.`;

    throw new Ai33ProApiError(message, status);
  }

  const createData = await createResponse.json();
  if (!createData.success || !createData.task_id) {
    throw new Ai33ProApiError(
      createData.error_message || 'AI33 Pro did not return a valid task ID.'
    );
  }

  const taskId = String(createData.task_id);

  // Poll task status until done, error, timeout, or cancellation
  const POLL_INTERVAL_MS = 1500;
  const MAX_POLL_DURATION_MS = 60000;
  const startTime = Date.now();

  while (Date.now() - startTime < MAX_POLL_DURATION_MS) {
    if (signal?.aborted) {
      throw new DOMException('The operation was aborted', 'AbortError');
    }

    await waitWithSignal(POLL_INTERVAL_MS, signal);

    const taskResponse = await fetch(`${AI33_PRO_API_BASE}/v1/task/${encodeURIComponent(taskId)}`, {
      method: 'GET',
      headers: {
        'xi-api-key': trimmedKey,
      },
      signal,
    });

    if (!taskResponse.ok) {
      if (taskResponse.status === 401 || taskResponse.status === 403) {
        throw new Ai33ProApiError('Invalid AI33 Pro API key during task status check.', taskResponse.status);
      }
      if (taskResponse.status === 429) {
        // Rate limited on polling: wait before continuing
        continue;
      }
      throw new Ai33ProApiError(`Failed to check AI33 Pro task status (${taskResponse.status}).`, taskResponse.status);
    }

    const taskData = await taskResponse.json();
    const status = taskData.status;

    if (status === 'doing') {
      if (typeof taskData.progress === 'number') {
        onProgress?.(taskData.progress);
      }
      continue;
    }

    if (status === 'done') {
      const audioUrl = taskData.metadata?.audio_url;
      if (!audioUrl || typeof audioUrl !== 'string') {
        throw new Ai33ProApiError('AI33 Pro task completed but returned no audio URL.');
      }

      // Fetch the generated audio Blob
      const audioResponse = await fetch(audioUrl, { signal });
      if (!audioResponse.ok) {
        throw new Ai33ProApiError(`Failed to download generated audio from ${audioUrl} (${audioResponse.status}).`);
      }

      const audioBlob = await audioResponse.blob();
      if (audioBlob.size === 0) {
        throw new Ai33ProApiError('AI33 Pro returned an empty audio file.');
      }

      const durationSeconds = await measureAudioDuration(audioBlob);
      const creditCost = typeof taskData.credit_cost === 'number' ? taskData.credit_cost : null;

      return {
        audioBlob,
        durationSeconds,
        taskId,
        creditCost,
      };
    }

    if (status === 'error') {
      const errorMsg = taskData.error_message || 'AI33 Pro speech generation failed.';
      throw new Ai33ProApiError(errorMsg);
    }
  }

  throw new Ai33ProApiError('AI33 Pro speech generation timed out after 60 seconds.');
}
