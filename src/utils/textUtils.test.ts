import { describe, it, expect } from 'vitest';
import {
  countWords,
  countCharacters,
  estimateDurationSeconds,
  validateScriptInput,
  MAX_SCRIPT_WORDS,
} from './textUtils';

describe('textUtils', () => {
  describe('countWords', () => {
    it('returns 0 for empty or whitespace strings', () => {
      expect(countWords('')).toBe(0);
      expect(countWords('   \n\t  ')).toBe(0);
    });

    it('counts words separated by spaces, tabs, and newlines', () => {
      expect(countWords('Hello world')).toBe(2);
      expect(countWords('The quick  brown   fox\njumped\tover.')).toBe(6);
    });
  });

  describe('countCharacters', () => {
    it('counts exact character length', () => {
      expect(countCharacters('')).toBe(0);
      expect(countCharacters('Hello')).toBe(5);
      expect(countCharacters('Hello\nworld')).toBe(11);
    });
  });

  describe('estimateDurationSeconds', () => {
    it('returns 0 for empty text', () => {
      expect(estimateDurationSeconds('')).toBe(0);
    });

    it('estimates reasonable durations for standard scene length', () => {
      // 10 words at 2.5 words/sec is 4 seconds
      const text = 'One two three four five six seven eight nine ten';
      const duration = estimateDurationSeconds(text, 'standard');
      expect(duration).toBe(4);
    });

    it('respects short target length constraints', () => {
      const shortText = 'Quick introduction.';
      expect(estimateDurationSeconds(shortText, 'short')).toBeGreaterThanOrEqual(3);
    });

    it('respects long target length constraints', () => {
      const longText = 'A longer narration segment that goes into deeper explanation of the subject.';
      expect(estimateDurationSeconds(longText, 'long')).toBeGreaterThanOrEqual(6);
    });
  });

  describe('validateScriptInput', () => {
    it('rejects empty and whitespace-only text', () => {
      const result = validateScriptInput('   ');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Script cannot be empty.');
    });

    it('accepts valid text within word limit', () => {
      const result = validateScriptInput('This is a great video script for YouTube.');
      expect(result.isValid).toBe(true);
      expect(result.wordCount).toBe(8);
      expect(result.error).toBeUndefined();
    });

    it('rejects scripts over the max word limit', () => {
      const longScript = new Array(MAX_SCRIPT_WORDS + 10).fill('word').join(' ');
      const result = validateScriptInput(longScript);
      expect(result.isValid).toBe(false);
      expect(result.wordCount).toBe(MAX_SCRIPT_WORDS + 10);
      expect(result.error).toContain('Script exceeds the limit of 5,000 words');
    });
  });
});
