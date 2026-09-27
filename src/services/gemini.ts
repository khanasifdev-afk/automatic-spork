import { KeyTestStatus } from '../types';
import { estimateDurationSeconds } from '../utils/textUtils';

const GEMINI_TEST_TIMEOUT_MS = 6000;
export const GEMINI_MODELS = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-2.5-flash'];
export const GEMINI_MODEL = GEMINI_MODELS[0];

function isTransientOrModelUnavailableError(status: number, detailMessage?: string): boolean {
  if (status === 404 || status === 503 || status === 500 || status === 502 || status === 504) return true;
  if (detailMessage) {
    const lower = detailMessage.toLowerCase();
    if (
      lower.includes('not found') ||
      lower.includes('not available') ||
      lower.includes('no longer available') ||
      lower.includes('high demand') ||
      lower.includes('temporarily') ||
      lower.includes('does not exist') ||
      lower.includes('models/')
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Tests a Gemini API key by checking access to available Gemini Flash models
 * (gemini-2.5-flash, gemini-2.0-flash, gemini-1.5-flash) via direct browser fetch.
 * 
 * Never logs or exposes raw API keys in errors or network diagnostics.
 */
export async function testGeminiApiKey(apiKey: string): Promise<KeyTestStatus> {
  const trimmed = apiKey.trim();

  if (!trimmed) {
    return {
      state: 'invalid',
      message: 'Enter an API key first.',
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GEMINI_TEST_TIMEOUT_MS);

  try {
    // First try universal models list endpoint which works for all key formats (AIzaSy... & AQ...)
    const modelsUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(trimmed)}`;
    const modelsResponse = await fetch(modelsUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'x-goog-api-key': trimmed,
      },
      signal: controller.signal,
    });

    if (modelsResponse.ok) {
      clearTimeout(timeoutId);
      return {
        state: 'valid',
        message: 'Key is valid and Gemini API model access confirmed.',
      };
    }

    if (modelsResponse.status === 401 || modelsResponse.status === 403) {
      clearTimeout(timeoutId);
      return {
        state: 'invalid',
        message: 'Invalid API key or unauthorized.',
      };
    }

    if (modelsResponse.status === 429) {
      clearTimeout(timeoutId);
      return {
        state: 'quota-exhausted',
        message: 'Gemini quota or rate limit exceeded.',
      };
    }

    let lastErrorStatus = modelsResponse.status;
    let lastErrorMessage = '';
    try {
      const errData = await modelsResponse.json();
      if (errData?.error?.message) {
        lastErrorMessage = errData.error.message;
      }
    } catch {
      // ignore
    }

    // Fallback: iterate specific models if GET /v1beta/models returned 404 or non-standard status
    for (let i = 0; i < GEMINI_MODELS.length; i++) {
      const model = GEMINI_MODELS[i];
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}?key=${encodeURIComponent(trimmed)}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'x-goog-api-key': trimmed,
        },
        signal: controller.signal,
      });

      if (response.ok) {
        clearTimeout(timeoutId);
        return {
          state: 'valid',
          message: `Key is valid and ${model} model access confirmed.`,
        };
      }

      if (response.status === 401 || response.status === 403) {
        clearTimeout(timeoutId);
        return {
          state: 'invalid',
          message: 'Invalid API key or unauthorized.',
        };
      }

      if (response.status === 429) {
        clearTimeout(timeoutId);
        return {
          state: 'quota-exhausted',
          message: 'Gemini quota or rate limit exceeded.',
        };
      }

      let detail = '';
      try {
        const errData = await response.json();
        if (errData?.error?.message) {
          detail = errData.error.message;
        }
      } catch {
        // ignore
      }

      lastErrorStatus = response.status;
      lastErrorMessage = detail;

      if (isTransientOrModelUnavailableError(response.status, detail)) {
        continue;
      }

      if (response.status === 400) {
        clearTimeout(timeoutId);
        return {
          state: 'invalid',
          message: 'Invalid API key or unauthorized.',
        };
      }

      if (response.status >= 500) {
        clearTimeout(timeoutId);
        return {
          state: 'unavailable',
          message: `Gemini service is temporarily unavailable (${response.status}).`,
        };
      }
    }

    clearTimeout(timeoutId);
    if (lastErrorStatus >= 500) {
      return {
        state: 'unavailable',
        message: `Gemini service is temporarily unavailable (${lastErrorStatus}).`,
      };
    }

    if (lastErrorStatus === 404) {
      return {
        state: 'invalid',
        message: 'Gemini API is not enabled for this API key/project (404). Please generate a key at aistudio.google.com.',
      };
    }

    return {
      state: 'unavailable',
      message: `No supported Gemini Flash model is available for this API key (${lastErrorStatus}${lastErrorMessage ? `: ${lastErrorMessage}` : ''}).`,
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
      message: 'Network or CORS error connecting to Gemini API.',
    };
  }
}

const GEMINI_ANALYSIS_TIMEOUT_MS = 300000;

export class GeminiAnalysisError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = 'GeminiAnalysisError';
  }
}

/**
 * Validates and normalizes raw JSON output from Gemini into structured Scene items.
 * Enforces all validation rules from Feature 2:
 * - Must be non-empty array of scenes.
 * - Required non-empty fields: scriptText, visualDescription, primaryQuery.
 * - Normalizes whitespace.
 * - Generates stable unique client IDs.
 * - Renumbers sequence 1..N based on array order.
 * - Ensures valid duration (estimatedSeconds).
 */
export function validateGeminiSceneResponse(
  raw: unknown,
  options?: { sceneLength?: import('../types').TargetSceneLength }
): import('../types').Scene[] {
  if (!raw || typeof raw !== 'object') {
    throw new GeminiAnalysisError('Gemini returned an invalid response structure (not an object).');
  }

  // Support either { scenes: [...] } or direct array [...]
  let sceneArray: unknown[] | null = null;
  if (Array.isArray(raw)) {
    sceneArray = raw;
  } else if ('scenes' in raw && Array.isArray((raw as { scenes: unknown }).scenes)) {
    sceneArray = (raw as { scenes: unknown[] }).scenes;
  }

  if (!sceneArray || sceneArray.length === 0) {
    throw new GeminiAnalysisError('Gemini response contained no scenes.');
  }

  const validated: import('../types').Scene[] = [];

  for (let i = 0; i < sceneArray.length; i++) {
    const item = sceneArray[i];
    if (!item || typeof item !== 'object') {
      throw new GeminiAnalysisError(`Scene at index ${i} is not a valid object.`);
    }

    const cast = item as Record<string, unknown>;

    const scriptText = typeof cast.scriptText === 'string' ? cast.scriptText.trim() : '';
    const visualDescription =
      typeof cast.visualDescription === 'string' ? cast.visualDescription.trim() : '';
    const primaryQuery =
      typeof cast.primaryQuery === 'string' ? cast.primaryQuery.trim() : '';

    if (!scriptText) {
      throw new GeminiAnalysisError(`Scene ${i + 1} has missing or empty script text.`);
    }
    if (!visualDescription) {
      throw new GeminiAnalysisError(`Scene ${i + 1} has missing or empty visual description.`);
    }
    if (!primaryQuery) {
      throw new GeminiAnalysisError(`Scene ${i + 1} has missing or empty primary query.`);
    }

    // Process fallbackQueries
    let fallbackQueries: string[] = [];
    if (Array.isArray(cast.fallbackQueries)) {
      fallbackQueries = cast.fallbackQueries
        .filter((q): q is string => typeof q === 'string' && q.trim().length > 0)
        .map((q) => q.trim())
        .slice(0, 2);
    }

    // Process avoidTerms
    let avoidTerms: string[] = [];
    if (Array.isArray(cast.avoidTerms)) {
      avoidTerms = cast.avoidTerms
        .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
        .map((t) => t.trim());
    }

    // Estimate/validate duration
    let estimatedSeconds = 0;
    if (
      typeof cast.estimatedSeconds === 'number' &&
      !isNaN(cast.estimatedSeconds) &&
      cast.estimatedSeconds > 0
    ) {
      estimatedSeconds = Math.round(cast.estimatedSeconds);
    }

    // Sanity check duration: if missing or unreasonably small/large, calculate via WPM
    if (estimatedSeconds < 2 || estimatedSeconds > 60) {
      estimatedSeconds = estimateDurationSeconds(scriptText, options?.sceneLength);
    }

    // Generate stable ID
    const randomSuffix = Math.random().toString(36).substring(2, 9);
    const stableId =
      typeof cast.id === 'string' && cast.id.trim()
        ? cast.id.trim()
        : `scene-${i + 1}-${randomSuffix}`;

    validated.push({
      id: stableId,
      sequence: i + 1, // Strictly renumbered 1..N based on array order
      scriptText,
      visualDescription,
      primaryQuery,
      fallbackQueries,
      avoidTerms,
      estimatedSeconds,
    });
  }

  return validated;
}

/**
 * Builds the Gemini prompt for script segmentation according to Feature 2 rules.
 */
function buildSegmentationPrompt(
  script: string,
  options: import('../types').WorkflowOptions
): string {
  const sceneLengthGuidance =
    options.sceneLength === 'short'
      ? 'Target approximately 3 to 5 seconds per scene (roughly 8–13 spoken words).'
      : options.sceneLength === 'long'
      ? 'Target approximately 8 to 15 seconds per scene (roughly 20–38 spoken words).'
      : 'Target approximately 5 to 8 seconds per scene (roughly 13–20 spoken words).';

  return `You are an expert video director, film editor, and stock footage curator.
Analyze the following YouTube narration script and divide it into meaningful visual scenes suitable for stock video clip discovery.

Target video parameters:
- Output orientation: ${options.orientation} (${options.orientation === 'landscape' ? '16:9 widescreen' : '9:16 vertical/Shorts'})
- Target scene duration: ${options.sceneLength} (${sceneLengthGuidance})
- Speaking pace: ~150 words per minute (~2.5 words per second).

CRITICAL SEGMENTATION RULES:
1. GROUP BY VISUAL IDEA, NOT BY SENTENCE:
   - A scene should only change when the on-screen visual focus, action, subject, or setting MUST change.
   - Do NOT split consecutive sentences that refer to, elaborate on, or share the same visual subject.
   - WHAT TO AVOID: Do NOT split "Since I started doing this, my tomatoes grew 3x bigger" and "This tomato weighs almost three times what a normal one does" into two separate scenes. Both describe the exact same visual subject (large prize-winning tomatoes), so they MUST be grouped together into a single scene.
   - ONLY start a new scene when the narration transitions to a DISTINCT visual shift (e.g. cutting from showing the big harvested tomatoes to showing the gardening soil, fertilizer preparation, or hands planting seeds).

2. AVOID REDUNDANT & OVERLAPPING CLIPS:
   - Each consecutive scene MUST have a clearly different visual concept, action, or camera perspective from the previous scene to ensure diverse, engaging B-roll footage.
   - Never create two consecutive scenes that would search for the same clip or show the same thing twice.

3. DURATION & WORD PACING:
   - Aim for the target scene duration: ${sceneLengthGuidance}.
   - Do NOT create micro-scenes of only 4-7 words unless the scene duration profile is 'short' and the visual idea is genuinely standalone. Group related sentences together to hit the target duration range.

4. PRESERVE ORIGINAL NARRATION ORDER & TEXT:
   - The combined "scriptText" across all scenes must include 100% of the original script narration in its exact original order.
   - Do NOT rewrite, summarize, or omit narration text.

5. TRANSITION WORDS:
   - Never isolate transition phrases (e.g., "however", "therefore", "because of this", "and that's not all"). Group them with the substantive visual idea that follows.

6. FOR EACH SCENE, GENERATE:
   - "scriptText": The exact narration segment belonging to this scene.
   - "visualDescription": A concrete, vivid visual description focusing on visible physical subjects, specific actions, environment, lighting, and mood (e.g., "Close-up of a gardener proudly holding a giant ripe red beefsteak tomato in a sunny vegetable garden").
   - "primaryQuery": A concise, high-converting 2-4 word search query for stock video libraries (e.g. Pexels) describing the physical action and subject (e.g., "giant tomato garden").
   - "fallbackQueries": Up to 2 broader alternative search queries if the primary query yields no clips (e.g., ["harvesting tomatoes", "organic garden vegetable"]).
   - "avoidTerms": Up to 3 terms/concepts to avoid (e.g. ["rotten", "supermarket", "indoor"]).
   - "estimatedSeconds": Estimated duration in seconds based on word count (~words / 2.5, rounded to nearest second).

Return ONLY a JSON object with a "scenes" array following this exact schema.

Script:
"""
${script.trim()}
"""`;
}

/**
 * Analyzes a narration script using Gemini 2.0 Flash via direct browser REST fetch.
 * Divides the script into visual scenes with search queries.
 */
export async function analyzeScriptWithGemini(
  script: string,
  options: import('../types').WorkflowOptions,
  apiKey: string,
  externalSignal?: AbortSignal
): Promise<import('../types').Scene[]> {
  const trimmedKey = apiKey.trim();
  if (!trimmedKey) {
    throw new GeminiAnalysisError('Gemini API key is required. Please configure it in Settings.');
  }

  const trimmedScript = script.trim();
  if (!trimmedScript) {
    throw new GeminiAnalysisError('Script cannot be empty.');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GEMINI_ANALYSIS_TIMEOUT_MS);

  // Link external abort signal if provided
  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timeoutId);
      throw new GeminiAnalysisError('Analysis was cancelled.');
    }
    externalSignal.addEventListener(
      'abort',
      () => {
        controller.abort();
      },
      { once: true }
    );
  }

  try {
    const prompt = buildSegmentationPrompt(trimmedScript, options);

    const requestBody = {
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            scenes: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  sequence: { type: 'INTEGER' },
                  scriptText: { type: 'STRING' },
                  visualDescription: { type: 'STRING' },
                  primaryQuery: { type: 'STRING' },
                  fallbackQueries: {
                    type: 'ARRAY',
                    items: { type: 'STRING' },
                  },
                  avoidTerms: {
                    type: 'ARRAY',
                    items: { type: 'STRING' },
                  },
                  estimatedSeconds: { type: 'INTEGER' },
                },
                required: ['scriptText', 'visualDescription', 'primaryQuery'],
              },
            },
          },
          required: ['scenes'],
        },
      },
    };

    let lastErrorStatus = 0;
    let lastErrorMessage = '';

    for (let i = 0; i < GEMINI_MODELS.length; i++) {
      const model = GEMINI_MODELS[i];
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
        trimmedKey
      )}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'x-goog-api-key': trimmedKey,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      if (response.status === 429) {
        clearTimeout(timeoutId);
        throw new GeminiAnalysisError(
          'Gemini quota or rate limit exceeded. Please wait a moment before trying again.',
          429
        );
      }

      if (response.status === 401 || response.status === 403) {
        clearTimeout(timeoutId);
        throw new GeminiAnalysisError(
          'Invalid or unauthorized Gemini API key. Please check your key in Settings.',
          response.status
        );
      }

      if (!response.ok) {
        let detail = '';
        try {
          const errData = await response.json();
          if (errData?.error?.message) {
            detail = errData.error.message;
          }
        } catch {
          // ignore
        }

        lastErrorStatus = response.status;
        lastErrorMessage = detail;

        if (isTransientOrModelUnavailableError(response.status, detail)) {
          continue;
        }

        if (response.status === 400) {
          clearTimeout(timeoutId);
          throw new GeminiAnalysisError(
            `Invalid Gemini API request or unauthorized key${detail ? `: ${detail}` : ''}.`,
            response.status
          );
        }

        clearTimeout(timeoutId);
        throw new GeminiAnalysisError(
          `Gemini service returned an error (${response.status}${detail ? `: ${detail}` : ''}). Please try again.`,
          response.status
        );
      }

      clearTimeout(timeoutId);

      const data = await response.json();

      // Extract text content from Gemini's candidate response
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText || typeof rawText !== 'string') {
        throw new GeminiAnalysisError('Gemini returned an empty response. Please try again.');
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(rawText);
      } catch {
        throw new GeminiAnalysisError(
          'Gemini returned an invalid response structure. Please try again.'
        );
      }

      return validateGeminiSceneResponse(parsed, { sceneLength: options.sceneLength });
    }

    clearTimeout(timeoutId);
    if (lastErrorStatus >= 500) {
      throw new GeminiAnalysisError(
        `Gemini service is experiencing high demand or is temporarily unavailable (${lastErrorStatus}${lastErrorMessage ? `: ${lastErrorMessage}` : ''}). Please try again in a few seconds.`,
        lastErrorStatus
      );
    }
    throw new GeminiAnalysisError(
      `No supported Gemini Flash model is available for this API key (${lastErrorStatus}${lastErrorMessage ? `: ${lastErrorMessage}` : ''}). Please check your key or try again later.`,
      lastErrorStatus
    );
  } catch (err: unknown) {
    clearTimeout(timeoutId);

    if (err instanceof GeminiAnalysisError) {
      throw err;
    }

    if (err instanceof DOMException && err.name === 'AbortError') {
      if (externalSignal?.aborted) {
        throw new GeminiAnalysisError('Analysis was cancelled.');
      }
      throw new GeminiAnalysisError('The analysis request timed out after 5 minutes. Try shortening your script or try again.');
    }

    throw new GeminiAnalysisError('Network or CORS error connecting to Gemini API.');
  }
}
