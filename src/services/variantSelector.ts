/**
 * Service for selecting the optimal MP4 file variant from a candidate clip.
 * Implements the selection rules defined in docs/features/feature-04-download-export.md section 7.
 */

import {
  ClipCandidate,
  ClipFileVariant,
  OutputOrientation,
  VideoQuality,
} from '../types';

export class VariantSelectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VariantSelectionError';
  }
}

/**
 * Maps VideoQuality to the target short dimension (height in landscape, width in portrait).
 */
export function getTargetShortDimension(quality: VideoQuality): number {
  switch (quality) {
    case '720p':
      return 720;
    case '1080p':
      return 1080;
    case '4k':
      return 2160;
    default:
      return 1080;
  }
}

/**
 * Determines whether a file variant is a valid MP4 video.
 */
export function isValidMp4Variant(variant: ClipFileVariant): boolean {
  if (!variant.url || typeof variant.url !== 'string' || !variant.url.trim()) {
    return false;
  }
  if (!variant.width || !variant.height || variant.width <= 0 || variant.height <= 0) {
    return false;
  }
  const mime = (variant.mimeType || '').toLowerCase();
  const urlLower = variant.url.toLowerCase();
  return mime === 'video/mp4' || urlLower.includes('.mp4');
}

/**
 * Checks if a variant matches the requested orientation.
 * Landscape: width >= height
 * Portrait: height > width
 */
export function matchesOrientation(
  variant: ClipFileVariant,
  orientation: OutputOrientation
): boolean {
  if (orientation === 'landscape') {
    return variant.width >= variant.height;
  }
  return variant.height > variant.width;
}

/**
 * Selects the best MP4 variant for the candidate clip based on orientation and quality.
 *
 * Rules:
 * 1. Keep valid MP4 variants only.
 * 2. Prefer the requested orientation. Fall back to other valid MP4s if no exact match exists.
 * 3. Choose the closest available resolution to the requested quality (using short dimension).
 * 4. Prefer a lower resolution over a much larger file when both satisfy the requested quality.
 * 5. Do not upscale or transform the file.
 * 6. Throw VariantSelectionError if no usable variant exists.
 */
export function selectBestMp4Variant(
  candidate: ClipCandidate,
  orientation: OutputOrientation,
  quality: VideoQuality
): ClipFileVariant {
  const allFiles = Array.isArray(candidate.files) ? candidate.files : [];
  const validMp4s = allFiles.filter(isValidMp4Variant);

  if (validMp4s.length === 0) {
    throw new VariantSelectionError(
      `No usable MP4 variant available for clip #${candidate.pexelsVideoId}.`
    );
  }

  // 2. Prefer requested orientation
  const orientationMatches = validMp4s.filter((v) => matchesOrientation(v, orientation));
  const pool = orientationMatches.length > 0 ? orientationMatches : validMp4s;

  const targetDim = getTargetShortDimension(quality);

  // 3 & 4. Choose closest resolution to requested quality
  const sorted = [...pool].sort((a, b) => {
    const shortA = Math.min(a.width, a.height);
    const shortB = Math.min(b.width, b.height);

    const distA = Math.abs(shortA - targetDim);
    const distB = Math.abs(shortB - targetDim);

    if (distA !== distB) {
      return distA - distB;
    }

    // If both satisfy or bracket quality with equal distance, prefer lower resolution
    if (shortA !== shortB) {
      return shortA - shortB;
    }

    // If dimensions are equal, prefer smaller file size if known
    const sizeA = a.fileSize ?? 0;
    const sizeB = b.fileSize ?? 0;
    if (sizeA > 0 && sizeB > 0 && sizeA !== sizeB) {
      return sizeA - sizeB;
    }

    return 0;
  });

  return sorted[0];
}
