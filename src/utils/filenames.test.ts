import { describe, it, expect } from 'vitest';
import {
  formatSequenceNumber,
  getMp4Filename,
  getMp3Filename,
  normalizeScriptText,
  generateScriptSegmentsText,
} from './filenames';

describe('filenames utility', () => {
  describe('formatSequenceNumber', () => {
    it('pads with minimum 3 digits', () => {
      expect(formatSequenceNumber(1, 5)).toBe('001');
      expect(formatSequenceNumber(9, 9)).toBe('009');
      expect(formatSequenceNumber(10, 15)).toBe('010');
      expect(formatSequenceNumber(99, 99)).toBe('099');
      expect(formatSequenceNumber(100, 100)).toBe('100');
    });

    it('scales padding if total scene count exceeds 999', () => {
      expect(formatSequenceNumber(1, 1000)).toBe('0001');
      expect(formatSequenceNumber(42, 1200)).toBe('0042');
      expect(formatSequenceNumber(1000, 1000)).toBe('1000');
    });
  });

  describe('getMp4Filename', () => {
    it('creates zero-padded lowercase mp4 filenames with no user text', () => {
      expect(getMp4Filename(1, 3)).toBe('001.mp4');
      expect(getMp4Filename(2, 3)).toBe('002.mp4');
      expect(getMp4Filename(3, 3)).toBe('003.mp4');
    });

    it('creates 001-A.mp4 through 001-F.mp4 when candidateLabel is provided', () => {
      const labels = ['A', 'B', 'C', 'D', 'E', 'F'] as const;
      const expected = [
        '001-A.mp4',
        '001-B.mp4',
        '001-C.mp4',
        '001-D.mp4',
        '001-E.mp4',
        '001-F.mp4',
      ];
      labels.forEach((label, idx) => {
        expect(getMp4Filename(1, 3, label)).toBe(expected[idx]);
      });
      expect(getMp4Filename(2, 3, 'A')).toBe('002-A.mp4');
      expect(getMp4Filename(2, 3, 'F')).toBe('002-F.mp4');
    });

    it('scales padding with candidateLabel when total scenes exceed 999', () => {
      expect(getMp4Filename(1, 1500, 'A')).toBe('0001-A.mp4');
      expect(getMp4Filename(123, 1500, 'E')).toBe('0123-E.mp4');
    });
  });

  describe('getMp3Filename', () => {
    it('creates zero-padded lowercase mp3 filenames aligned with sequence', () => {
      expect(getMp3Filename(1, 3)).toBe('001.mp3');
      expect(getMp3Filename(2, 3)).toBe('002.mp3');
      expect(getMp3Filename(3, 3)).toBe('003.mp3');
    });
  });

  describe('normalizeScriptText', () => {
    it('replaces line breaks and multiple spaces with a single space', () => {
      const input = 'Regular walking\ncan improve balance\r\nand confidence.   Lots   of   spaces.';
      const expected = 'Regular walking can improve balance and confidence. Lots of spaces.';
      expect(normalizeScriptText(input)).toBe(expected);
    });

    it('trims leading and trailing whitespace', () => {
      expect(normalizeScriptText('   Hello world   \n  ')).toBe('Hello world');
    });
  });

  describe('generateScriptSegmentsText', () => {
    it('generates one numbered line per segment with matching padded prefix', () => {
      const items = [
        {
          sequence: 1,
          totalCount: 3,
          scriptText: 'Regular walking can improve balance and confidence.',
        },
        {
          sequence: 2,
          totalCount: 3,
          scriptText: 'A balanced evening meal\ncan support better sleep.',
        },
        {
          sequence: 3,
          totalCount: 3,
          scriptText: 'Small daily habits add up over time.',
        },
      ];

      const result = generateScriptSegmentsText(items);
      const expected =
        '001. Regular walking can improve balance and confidence.\n' +
        '002. A balanced evening meal can support better sleep.\n' +
        '003. Small daily habits add up over time.\n';

      expect(result).toBe(expected);

      // Verify exactly 3 non-empty lines
      const lines = result.trim().split('\n');
      expect(lines).toHaveLength(3);
      expect(lines[0]).toBe('001. Regular walking can improve balance and confidence.');
      expect(lines[1]).toBe('002. A balanced evening meal can support better sleep.');
      expect(lines[2]).toBe('003. Small daily habits add up over time.');
    });

    it('returns empty string for empty input', () => {
      expect(generateScriptSegmentsText([])).toBe('');
    });
  });
});
