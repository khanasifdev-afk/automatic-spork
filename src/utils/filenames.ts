/**
 * Utilities for formatting sequential filenames and script segments for export.
 * Follows the naming conventions defined in docs/features/feature-04-download-export.md.
 */

import { CandidateLabel } from '../types';

/**
 * Returns a zero-padded sequence string.
 * Padding is determined by the total included scene count, with a minimum of 3 digits.
 *
 * Examples:
 * - sequence: 1, totalCount: 5 -> "001"
 * - sequence: 12, totalCount: 50 -> "012"
 * - sequence: 105, totalCount: 1500 -> "0105"
 */
export function formatSequenceNumber(sequence: number, totalCount: number): string {
  const padLength = Math.max(3, String(Math.max(1, totalCount)).length);
  return String(sequence).padStart(padLength, '0');
}

/**
 * Returns the standardized sequential MP4 filename (e.g., "001-A.mp4" or "001.mp4").
 * No titles or user-provided text are included.
 */
export function getMp4Filename(
  sequence: number,
  totalCount: number,
  candidateLabel?: CandidateLabel
): string {
  const padded = formatSequenceNumber(sequence, totalCount);
  if (candidateLabel) {
    return `${padded}-${candidateLabel}.mp4`;
  }
  return `${padded}.mp4`;
}

/**
 * Returns the standardized sequential MP3 voice filename (e.g., "001.mp3").
 * Matches the basename of the corresponding MP4 video file.
 */
export function getMp3Filename(sequence: number, totalCount: number): string {
  const padded = formatSequenceNumber(sequence, totalCount);
  return `${padded}.mp3`;
}

/**
 * Returns the standardized sequential image filename (e.g., "001-A.jpg").
 * Follows the same zero-padded + candidate-label convention as MP4 files.
 * Extension defaults to 'jpg' but can be overridden.
 */
export function getImageFilename(
  sequence: number,
  totalCount: number,
  candidateLabel: string,
  ext: string = 'jpg'
): string {
  const padded = formatSequenceNumber(sequence, totalCount);
  return `${padded}-${candidateLabel}.${ext}`;
}

/**
 * Normalizes script text for export:
 * - Replaces internal line breaks (\r\n, \r, \n) and repeated whitespace with a single space
 * - Trims leading and trailing whitespace
 */
export function normalizeScriptText(text: string): string {
  if (!text) return '';
  return text
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface ScriptSegmentExportItem {
  sequence: number;
  totalCount: number;
  scriptText: string;
}

/**
 * Generates the contents of `script-segments.txt`.
 * Requirements:
 * - Encoded as UTF-8
 * - Include every included script segment in final video order
 * - Exactly one segment per line
 * - Prefix each line with matching zero-padded video number and period: `${padded}. ${text}`
 * - No heading, no blank lines, no excluded scenes
 */
export function generateScriptSegmentsText(items: ScriptSegmentExportItem[]): string {
  if (items.length === 0) {
    return '';
  }

  const lines = items.map((item) => {
    const padded = formatSequenceNumber(item.sequence, item.totalCount);
    const text = normalizeScriptText(item.scriptText);
    return `${padded}. ${text}`;
  });

  return lines.join('\n') + '\n';
}
