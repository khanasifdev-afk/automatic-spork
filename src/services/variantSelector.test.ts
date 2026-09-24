import { describe, it, expect } from 'vitest';
import {
  selectBestMp4Variant,
  VariantSelectionError,
  matchesOrientation,
  isValidMp4Variant,
} from './variantSelector';
import { ClipCandidate, ClipFileVariant } from '../types';

describe('variantSelector service', () => {
  const createCandidate = (files: ClipFileVariant[]): ClipCandidate => ({
    id: 'candidate-1',
    pexelsVideoId: 999,
    sourceUrl: 'https://pexels.com/video/999',
    creatorName: 'Videographer',
    creatorUrl: 'https://pexels.com/@videographer',
    previewImageUrl: 'https://pexels.com/image.jpg',
    durationSeconds: 10,
    width: 1920,
    height: 1080,
    files,
    matchedQuery: 'ocean sunset',
    score: 80,
    confidence: 'strong',
  });

  describe('isValidMp4Variant', () => {
    it('accepts video/mp4 and .mp4 links with positive dimensions', () => {
      expect(
        isValidMp4Variant({
          url: 'https://example.com/video.mp4',
          mimeType: 'video/mp4',
          width: 1920,
          height: 1080,
        })
      ).toBe(true);
    });

    it('rejects invalid mime types or non-mp4 urls', () => {
      expect(
        isValidMp4Variant({
          url: 'https://example.com/video.webm',
          mimeType: 'video/webm',
          width: 1920,
          height: 1080,
        })
      ).toBe(false);
    });

    it('rejects variants with missing or zero dimensions', () => {
      expect(
        isValidMp4Variant({
          url: 'https://example.com/video.mp4',
          mimeType: 'video/mp4',
          width: 0,
          height: 0,
        })
      ).toBe(false);
    });
  });

  describe('matchesOrientation', () => {
    it('correctly matches landscape (width >= height)', () => {
      expect(
        matchesOrientation(
          { url: 'a.mp4', mimeType: 'video/mp4', width: 1920, height: 1080 },
          'landscape'
        )
      ).toBe(true);
      expect(
        matchesOrientation(
          { url: 'a.mp4', mimeType: 'video/mp4', width: 1080, height: 1920 },
          'landscape'
        )
      ).toBe(false);
    });

    it('correctly matches portrait (height > width)', () => {
      expect(
        matchesOrientation(
          { url: 'a.mp4', mimeType: 'video/mp4', width: 1080, height: 1920 },
          'portrait'
        )
      ).toBe(true);
      expect(
        matchesOrientation(
          { url: 'a.mp4', mimeType: 'video/mp4', width: 1920, height: 1080 },
          'portrait'
        )
      ).toBe(false);
    });
  });

  describe('selectBestMp4Variant', () => {
    it('throws VariantSelectionError when no valid MP4 variants exist', () => {
      const candidate = createCandidate([]);
      expect(() => selectBestMp4Variant(candidate, 'landscape', '1080p')).toThrow(
        VariantSelectionError
      );
    });

    it('selects the closest resolution to requested 1080p quality', () => {
      const files: ClipFileVariant[] = [
        { url: 'https://example.com/720.mp4', mimeType: 'video/mp4', width: 1280, height: 720 },
        { url: 'https://example.com/1080.mp4', mimeType: 'video/mp4', width: 1920, height: 1080 },
        { url: 'https://example.com/4k.mp4', mimeType: 'video/mp4', width: 3840, height: 2160 },
      ];
      const candidate = createCandidate(files);
      const selected = selectBestMp4Variant(candidate, 'landscape', '1080p');
      expect(selected.url).toBe('https://example.com/1080.mp4');
      expect(selected.height).toBe(1080);
    });

    it('selects the 720p variant when requested quality is 720p', () => {
      const files: ClipFileVariant[] = [
        { url: 'https://example.com/720.mp4', mimeType: 'video/mp4', width: 1280, height: 720 },
        { url: 'https://example.com/1080.mp4', mimeType: 'video/mp4', width: 1920, height: 1080 },
      ];
      const candidate = createCandidate(files);
      const selected = selectBestMp4Variant(candidate, 'landscape', '720p');
      expect(selected.url).toBe('https://example.com/720.mp4');
    });

    it('prefers requested orientation when available', () => {
      const files: ClipFileVariant[] = [
        // Portrait 1080x1920
        { url: 'https://example.com/portrait.mp4', mimeType: 'video/mp4', width: 1080, height: 1920 },
        // Landscape 1920x1080
        { url: 'https://example.com/landscape.mp4', mimeType: 'video/mp4', width: 1920, height: 1080 },
      ];
      const candidate = createCandidate(files);

      const landscapeChoice = selectBestMp4Variant(candidate, 'landscape', '1080p');
      expect(landscapeChoice.url).toBe('https://example.com/landscape.mp4');

      const portraitChoice = selectBestMp4Variant(candidate, 'portrait', '1080p');
      expect(portraitChoice.url).toBe('https://example.com/portrait.mp4');
    });

    it('falls back to other orientations if no exact orientation match exists', () => {
      const files: ClipFileVariant[] = [
        // Only landscape exists
        { url: 'https://example.com/landscape.mp4', mimeType: 'video/mp4', width: 1920, height: 1080 },
      ];
      const candidate = createCandidate(files);

      const portraitRequest = selectBestMp4Variant(candidate, 'portrait', '1080p');
      expect(portraitRequest.url).toBe('https://example.com/landscape.mp4');
    });

    it('prefers lower resolution when both bracket quality with equal distance', () => {
      // Target 1080: distance from 720 is 360, distance from 1440 is 360
      const files: ClipFileVariant[] = [
        { url: 'https://example.com/1440.mp4', mimeType: 'video/mp4', width: 2560, height: 1440 },
        { url: 'https://example.com/720.mp4', mimeType: 'video/mp4', width: 1280, height: 720 },
      ];
      const candidate = createCandidate(files);
      const selected = selectBestMp4Variant(candidate, 'landscape', '1080p');
      expect(selected.url).toBe('https://example.com/720.mp4');
    });
  });
});
