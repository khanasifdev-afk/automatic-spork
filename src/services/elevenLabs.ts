import {
  KeyTestStatus,
  ElevenLabsVoice,
  ElevenLabsModel,
  ElevenLabsOptions,
} from '../types';

export const ELEVENLABS_API_BASE = 'https://api.elevenlabs.io';

export class ElevenLabsApiError extends Error {
  public statusCode?: number;
  public isCredentialError: boolean;
  public isQuotaError: boolean;
  public isValidationError: boolean;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'ElevenLabsApiError';
    this.statusCode = statusCode;
    this.isCredentialError = statusCode === 401 || statusCode === 403;
    this.isQuotaError = statusCode === 429;
    this.isValidationError = statusCode === 422;
  }
}

/**
 * Tests an ElevenLabs API key using the lightweight subscription endpoint.
 * Does not synthesize speech or consume text-to-speech characters.
 */
export async function testElevenLabsApiKey(apiKey: string): Promise<KeyTestStatus> {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    return {
      state: 'invalid',
      message: 'ElevenLabs API key is empty.',
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const response = await fetch(`${ELEVENLABS_API_BASE}/v1/user/subscription`, {
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
        message: 'Invalid ElevenLabs API key or unauthorized access.',
      };
    }

    if (response.status === 429) {
      return {
        state: 'quota-exhausted',
        message: 'ElevenLabs quota exhausted or rate limit reached.',
      };
    }

    if (!response.ok) {
      return {
        state: 'unavailable',
        message: `ElevenLabs returned HTTP error ${response.status}.`,
      };
    }

    const data = await response.json();
    const characterCount = typeof data.character_count === 'number' ? data.character_count : 0;
    const characterLimit = typeof data.character_limit === 'number' ? data.character_limit : 0;
    const remainingIncludedCharacters = Math.max(0, characterLimit - characterCount);

    let resetsAt: string | undefined;
    if (typeof data.next_character_count_reset_unix === 'number' && data.next_character_count_reset_unix > 0) {
      try {
        resetsAt = new Date(data.next_character_count_reset_unix * 1000).toLocaleString();
      } catch {
        resetsAt = undefined;
      }
    }

    const isOveragesEnabled = Boolean(
      data.can_extend_character_limit || data.allowed_to_extend_character_limit
    );

    return {
      state: 'valid',
      message: 'ElevenLabs connection verified successfully.',
      usage: {
        tier: data.tier || undefined,
        characterCount,
        characterLimit,
        remainingIncludedCharacters,
        isOveragesEnabled,
        resetsAt,
      },
    };
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === 'AbortError') {
      return {
        state: 'timeout',
        message: 'Request timed out after 6 seconds. Please retry.',
      };
    }
    return {
      state: 'unavailable',
      message: 'Failed to connect to ElevenLabs. Please check network connectivity or CORS settings.',
    };
  }
}

/**
 * Fetches available voices for the authenticated account from GET /v2/voices.
 */
export async function fetchElevenLabsVoices(
  apiKey: string,
  signal?: AbortSignal
): Promise<ElevenLabsVoice[]> {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    return [];
  }

  const response = await fetch(`${ELEVENLABS_API_BASE}/v2/voices`, {
    method: 'GET',
    headers: {
      'xi-api-key': trimmed,
    },
    signal,
  });

  if (!response.ok) {
    throw new ElevenLabsApiError(
      `Failed to load voices from ElevenLabs (HTTP ${response.status}).`,
      response.status
    );
  }

  const data = await response.json();
  const voicesList = Array.isArray(data.voices) ? data.voices : [];

  return voicesList.map((v: Record<string, unknown>) => ({
    voice_id: String(v.voice_id || ''),
    name: String(v.name || 'Unnamed Voice'),
    category: typeof v.category === 'string' ? v.category : undefined,
    preview_url: typeof v.preview_url === 'string' ? v.preview_url : undefined,
    labels: typeof v.labels === 'object' && v.labels !== null ? (v.labels as Record<string, string>) : undefined,
  }));
}

/**
 * Fetches available models from GET /v1/models, filtered to models capable of text-to-speech.
 */
export async function fetchElevenLabsModels(
  apiKey: string,
  signal?: AbortSignal
): Promise<ElevenLabsModel[]> {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    return [];
  }

  const response = await fetch(`${ELEVENLABS_API_BASE}/v1/models`, {
    method: 'GET',
    headers: {
      'xi-api-key': trimmed,
    },
    signal,
  });

  if (!response.ok) {
    throw new ElevenLabsApiError(
      `Failed to load models from ElevenLabs (HTTP ${response.status}).`,
      response.status
    );
  }

  const data = await response.json();
  const modelsList = Array.isArray(data) ? data : [];

  return modelsList
    .filter((m: Record<string, unknown>) => m.can_do_text_to_speech === true)
    .map((m: Record<string, unknown>) => ({
      model_id: String(m.model_id || ''),
      name: String(m.name || m.model_id || ''),
      can_do_text_to_speech: Boolean(m.can_do_text_to_speech),
      can_be_finetuned: Boolean(m.can_be_finetuned),
      description: typeof m.description === 'string' ? m.description : undefined,
    }));
}

export interface GenerateSpeechParams {
  scriptText: string;
  voiceId: string;
  options: ElevenLabsOptions;
  apiKey: string;
  previousText?: string;
  nextText?: string;
  signal?: AbortSignal;
}

export interface GenerateSpeechResult {
  audioBlob: Blob;
  durationSeconds: number | null;
  requestId: string | null;
}

/**
 * Generates an audio segment for a scene's narration text using ElevenLabs POST /v1/text-to-speech/{voice_id}.
 */
export async function generateSpeechForScene({
  scriptText,
  voiceId,
  options,
  apiKey,
  previousText,
  nextText,
  signal,
}: GenerateSpeechParams): Promise<GenerateSpeechResult> {
  const trimmedKey = apiKey.trim();
  if (!trimmedKey) {
    throw new ElevenLabsApiError('ElevenLabs API key is missing.', 401);
  }

  const trimmedText = scriptText.trim();
  if (!trimmedText) {
    throw new ElevenLabsApiError('Scene script text cannot be empty.', 422);
  }

  const effectiveVoiceId = voiceId.trim() || options.voiceId.trim();
  if (!effectiveVoiceId) {
    throw new ElevenLabsApiError('No ElevenLabs voice selected. Please choose a voice.', 422);
  }

  const outputFormat = options.outputFormat || 'mp3_44100_128';
  const url = `${ELEVENLABS_API_BASE}/v1/text-to-speech/${encodeURIComponent(effectiveVoiceId)}?output_format=${outputFormat}`;

  const payload: Record<string, unknown> = {
    text: trimmedText,
    model_id: options.modelId || 'eleven_multilingual_v2',
    voice_settings: {
      stability: options.stability,
      similarity_boost: options.similarityBoost,
      style: options.style,
      speed: options.speed,
      use_speaker_boost: options.useSpeakerBoost,
    },
  };

  if (previousText && previousText.trim()) {
    payload.previous_text = previousText.trim();
  }
  if (nextText && nextText.trim()) {
    payload.next_text = nextText.trim();
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': trimmedKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    let errorDetail = '';
    try {
      const errJson = await response.json();
      if (errJson && typeof errJson.detail === 'object' && errJson.detail?.message) {
        errorDetail = errJson.detail.message;
      } else if (errJson && typeof errJson.detail === 'string') {
        errorDetail = errJson.detail;
      }
    } catch {
      // Ignore JSON parse error on non-JSON response
    }

    const message = errorDetail
      ? `ElevenLabs error: ${errorDetail}`
      : response.status === 401 || response.status === 403
      ? 'Invalid ElevenLabs API key or unauthorized request.'
      : response.status === 429
      ? 'ElevenLabs quota exceeded or rate limit reached.'
      : response.status === 422
      ? 'ElevenLabs rejected the request settings or text.'
      : `ElevenLabs generation failed with status HTTP ${response.status}.`;

    throw new ElevenLabsApiError(message, response.status);
  }

  // Attempt to read request ID if exposed by provider headers
  const requestId =
    response.headers.get('request-id') ||
    response.headers.get('xi-request-id') ||
    null;

  const audioBlob = await response.blob();
  if (audioBlob.size === 0) {
    throw new ElevenLabsApiError('ElevenLabs returned an empty audio response.');
  }

  // Measure audio duration in browser
  const durationSeconds = await measureAudioDuration(audioBlob);

  return {
    audioBlob,
    durationSeconds,
    requestId,
  };
}

/**
 * Measures the duration in seconds of an audio blob using the browser Audio element.
 * Gracefully returns null if Audio is unavailable or metadata cannot be loaded.
 */
export async function measureAudioDuration(blob: Blob): Promise<number | null> {
  if (typeof Audio === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    return null;
  }

  return new Promise<number | null>((resolve) => {
    try {
      const url = URL.createObjectURL(blob);
      const audio = new Audio();

      const cleanup = () => {
        audio.removeEventListener('loadedmetadata', onLoaded);
        audio.removeEventListener('error', onError);
        if (typeof URL.revokeObjectURL === 'function') {
          URL.revokeObjectURL(url);
        }
      };

      const onLoaded = () => {
        const duration = audio.duration;
        cleanup();
        if (typeof duration === 'number' && !isNaN(duration) && duration > 0) {
          resolve(duration);
        } else {
          resolve(null);
        }
      };

      const onError = () => {
        cleanup();
        resolve(null);
      };

      // Set timeout in case metadata event never fires
      const timeoutId = setTimeout(() => {
        cleanup();
        resolve(null);
      }, 3000);

      audio.addEventListener('loadedmetadata', () => {
        clearTimeout(timeoutId);
        onLoaded();
      });
      audio.addEventListener('error', () => {
        clearTimeout(timeoutId);
        onError();
      });

      audio.src = url;
    } catch {
      resolve(null);
    }
  });
}
