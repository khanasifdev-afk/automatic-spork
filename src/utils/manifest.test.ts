import { describe, it, expect } from 'vitest';
import {
  escapeCsvField,
  generateManifestCsv,
  generateCreditsText,
  ManifestEntry,
  CreditsEntry,
} from './manifest';

describe('manifest utility', () => {
  describe('escapeCsvField', () => {
    it('returns regular strings and numbers unchanged', () => {
      expect(escapeCsvField('hello')).toBe('hello');
      expect(escapeCsvField(42)).toBe('42');
      expect(escapeCsvField('')).toBe('');
    });

    it('wraps fields with commas in quotes', () => {
      expect(escapeCsvField('walking, jogging, running')).toBe('"walking, jogging, running"');
    });

    it('escapes quotes by doubling them and wrapping', () => {
      expect(escapeCsvField('He said "hello"')).toBe('"He said ""hello"""');
    });

    it('wraps fields with newlines in quotes', () => {
      expect(escapeCsvField('line 1\nline 2')).toBe('"line 1\nline 2"');
    });
  });

  describe('generateManifestCsv', () => {
    const mockEntries: ManifestEntry[] = [
      {
        sequence: 1,
        candidateLabel: 'A',
        filename: '001-A.mp4',
        scriptText: 'Regular walking, jogging, and "active" habits.',
        searchQuery: 'active walking park',
        pexelsVideoId: 123456,
        sourceUrl: 'https://www.pexels.com/video/123456/',
        creator: 'Jane Doe, Videographer',
        creatorUrl: 'https://www.pexels.com/@janedoe',
        durationSeconds: 12,
        width: 1920,
        height: 1080,
        voiceFilename: '001.mp3',
        elevenLabsVoiceId: '21m00Tcm4TlvDq8ikWAM',
        elevenLabsModelId: 'eleven_multilingual_v2',
        audioOutputFormat: 'mp3_44100_128',
        audioDurationSeconds: 5.42,
      },
      {
        sequence: 1,
        candidateLabel: 'B',
        filename: '001-B.mp4',
        scriptText: 'Regular walking, jogging, and "active" habits.',
        searchQuery: 'active walking park',
        pexelsVideoId: 123457,
        sourceUrl: 'https://www.pexels.com/video/123457/',
        creator: 'Bob Johnson',
        creatorUrl: 'https://www.pexels.com/@bobjohnson',
        durationSeconds: 10,
        width: 1920,
        height: 1080,
        voiceFilename: '001.mp3',
        elevenLabsVoiceId: '21m00Tcm4TlvDq8ikWAM',
        elevenLabsModelId: 'eleven_multilingual_v2',
        audioOutputFormat: 'mp3_44100_128',
        audioDurationSeconds: 5.42,
      },
      {
        sequence: 2,
        candidateLabel: 'A',
        filename: '002-A.mp4',
        scriptText: 'A balanced evening meal\nsupports sleep.',
        searchQuery: 'healthy dinner table',
        pexelsVideoId: 789012,
        sourceUrl: 'https://www.pexels.com/video/789012/',
        creator: 'John Smith',
        creatorUrl: 'https://www.pexels.com/@johnsmith',
        durationSeconds: 8,
        width: 1280,
        height: 720,
        voiceFilename: '002.mp3',
        elevenLabsVoiceId: '21m00Tcm4TlvDq8ikWAM',
        elevenLabsModelId: 'eleven_multilingual_v2',
        audioOutputFormat: 'mp3_44100_128',
        audioDurationSeconds: 4.1,
      },
    ];

    it('generates a valid CSV with correct header and escaped rows including candidate_label', () => {
      const csv = generateManifestCsv(mockEntries);
      const lines = csv.trim().split('\n');

      expect(lines[0]).toBe(
        'scene_sequence,candidate_label,filename,script_text,search_query,pexels_video_id,source_url,creator,creator_url,duration_seconds,width,height,voice_filename,elevenlabs_voice_id,elevenlabs_model_id,audio_output_format,audio_duration_seconds'
      );

      // Line 1 (Scene 1, Option A)
      expect(lines[1]).toBe(
        '1,A,001-A.mp4,"Regular walking, jogging, and ""active"" habits.",active walking park,123456,https://www.pexels.com/video/123456/,"Jane Doe, Videographer",https://www.pexels.com/@janedoe,12,1920,1080,001.mp3,21m00Tcm4TlvDq8ikWAM,eleven_multilingual_v2,mp3_44100_128,5.42'
      );

      // Line 2 (Scene 1, Option B)
      expect(lines[2]).toBe(
        '1,B,001-B.mp4,"Regular walking, jogging, and ""active"" habits.",active walking park,123457,https://www.pexels.com/video/123457/,Bob Johnson,https://www.pexels.com/@bobjohnson,10,1920,1080,001.mp3,21m00Tcm4TlvDq8ikWAM,eleven_multilingual_v2,mp3_44100_128,5.42'
      );

      // Line 3 (Scene 2, Option A)
      expect(lines[3]).toBe(
        '2,A,002-A.mp4,A balanced evening meal supports sleep.,healthy dinner table,789012,https://www.pexels.com/video/789012/,John Smith,https://www.pexels.com/@johnsmith,8,1280,720,002.mp3,21m00Tcm4TlvDq8ikWAM,eleven_multilingual_v2,mp3_44100_128,4.1'
      );
    });

    it('never includes API keys or unauthorized columns', () => {
      const csv = generateManifestCsv(mockEntries);
      expect(csv.toLowerCase()).not.toContain('apikey');
      expect(csv.toLowerCase()).not.toContain('api_key');
      expect(csv.toLowerCase()).not.toContain('secret');
      expect(csv.toLowerCase()).not.toContain('token');
    });
  });

  describe('generateCreditsText', () => {
    const mockCredits: CreditsEntry[] = [
      {
        sequence: 1,
        candidateLabel: 'A',
        filename: '001-A.mp4',
        creator: 'Jane Doe',
        creatorUrl: 'https://www.pexels.com/@janedoe',
        sourceUrl: 'https://www.pexels.com/video/123456/',
      },
      {
        sequence: 1,
        candidateLabel: 'B',
        filename: '001-B.mp4',
        creator: 'Bob Johnson',
        creatorUrl: 'https://www.pexels.com/@bobjohnson',
        sourceUrl: 'https://www.pexels.com/video/123457/',
      },
      {
        sequence: 2,
        candidateLabel: 'A',
        filename: '002-A.mp4',
        creator: 'John Smith',
        creatorUrl: 'https://www.pexels.com/@johnsmith',
        sourceUrl: 'https://www.pexels.com/video/789012/',
      },
    ];

    it('includes Pexels attribution and clip creator links with scene and candidate label', () => {
      const text = generateCreditsText(mockCredits);
      expect(text).toContain('Videos provided by Pexels');
      expect(text).toContain('[001-A.mp4] (Scene #1 Option A)');
      expect(text).toContain('Jane Doe');
      expect(text).toContain('[001-B.mp4] (Scene #1 Option B)');
      expect(text).toContain('Bob Johnson');
      expect(text).toContain('[002-A.mp4] (Scene #2 Option A)');
      expect(text).toContain('John Smith');
    });

    it('does not include API keys, local paths, or blob URLs', () => {
      const text = generateCreditsText(mockCredits);
      expect(text).not.toContain('blob:');
      expect(text).not.toContain('/Users/');
      expect(text.toLowerCase()).not.toContain('apikey');
      expect(text.toLowerCase()).not.toContain('api_key');
    });
  });
});
