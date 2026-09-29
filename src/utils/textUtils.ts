import { TargetSceneLength } from '../types';

export const MAX_SCRIPT_WORDS = 5000;

export const DEFAULT_SAMPLE_SCRIPT = `How you spend your first sixty minutes sets the tone for your entire day.

Start by stepping away from screens and letting natural sunlight fill the room. Drink a tall glass of fresh water to wake up your body and hydrate your mind.

Take a quiet moment to brew a warm cup of coffee or tea, focusing entirely on the aroma and warmth.

Before diving into work, spend five minutes writing down your top three priorities for the day. When you begin with calm and intention, you can navigate any challenge with clarity.`;

/**
 * Counts words in a string, matching common text editor behavior.
 * Sequences of whitespace are treated as delimiters.
 */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) {
    return 0;
  }
  return trimmed.split(/\s+/).filter(Boolean).length;
}

/**
 * Counts characters in a string.
 */
export function countCharacters(text: string): number {
  return text.length;
}

/**
 * Estimates spoken duration in seconds based on 150 words per minute (~2.5 words/sec).
 * Enforces reasonable bounds depending on the requested scene length profile.
 */
export function estimateDurationSeconds(
  text: string,
  sceneLength: TargetSceneLength = 'standard'
): number {
  const words = countWords(text);
  if (words === 0) {
    return 0;
  }

  // 150 words per minute = 2.5 words per second => seconds = words / 2.5
  const rawSeconds = Math.round(words / 2.5);

  switch (sceneLength) {
    case '2.5s':
      // Target range: ~2 - 4 seconds (nominally 2.5s)
      return Math.max(2, Math.min(rawSeconds, 4));
    case 'short':
      // Target range: ~3 - 5 seconds
      return Math.max(3, Math.min(rawSeconds, 8));
    case 'long':
      // Target range: ~8 - 15 seconds
      return Math.max(6, Math.min(rawSeconds, 20));
    case 'standard':
    default:
      // Target range: ~4 - 10 seconds
      return Math.max(3, Math.min(rawSeconds, 12));
  }
}

export type ScriptValidationResult = {
  isValid: boolean;
  wordCount: number;
  charCount: number;
  error?: string;
};

/**
 * Validates script input according to Feature 2 rules:
 * - Rejects empty or whitespace-only scripts.
 * - Enforces the 5,000 word ceiling.
 */
export function validateScriptInput(
  text: string,
  maxWords = MAX_SCRIPT_WORDS
): ScriptValidationResult {
  const charCount = countCharacters(text);
  const wordCount = countWords(text);

  if (!text.trim()) {
    return {
      isValid: false,
      wordCount: 0,
      charCount,
      error: 'Script cannot be empty.',
    };
  }

  if (wordCount > maxWords) {
    return {
      isValid: false,
      wordCount,
      charCount,
      error: `Script exceeds the limit of ${maxWords.toLocaleString()} words (current: ${wordCount.toLocaleString()}).`,
    };
  }

  return {
    isValid: true,
    wordCount,
    charCount,
  };
}
