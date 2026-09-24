import { describe, it, expect } from 'vitest';
import { createSourceTextFingerprint, createSettingsFingerprint } from './fingerprints';
import { ElevenLabsOptions } from '../types';

describe('fingerprints utility', () => {
  const defaultOptions: ElevenLabsOptions = {
    voiceId: '21m00Tcm4TlvDq8ikWAM',
    modelId: 'eleven_multilingual_v2',
    outputFormat: 'mp3_44100_128',
    stability: 0.5,
    similarityBoost: 0.75,
    style: 0,
    speed: 1,
    useSpeakerBoost: true,
  };

  describe('createSourceTextFingerprint', () => {
    it('normalizes whitespace and newlines', () => {
      const text1 = 'Hello   world  from \n\n script.';
      const text2 = 'Hello world from script.';
      expect(createSourceTextFingerprint(text1)).toBe(createSourceTextFingerprint(text2));
    });

    it('returns different fingerprints for different text', () => {
      const text1 = 'Regular walking can improve balance.';
      const text2 = 'Regular jogging can improve balance.';
      expect(createSourceTextFingerprint(text1)).not.toBe(createSourceTextFingerprint(text2));
    });

    it('handles empty or blank text gracefully', () => {
      expect(createSourceTextFingerprint('')).toBe('');
      expect(createSourceTextFingerprint('   \n  ')).toBe('');
    });
  });

  describe('createSettingsFingerprint', () => {
    it('produces identical fingerprint for identical options', () => {
      const fp1 = createSettingsFingerprint(defaultOptions);
      const fp2 = createSettingsFingerprint({ ...defaultOptions });
      expect(fp1).toBe(fp2);
    });

    it('changes when voiceId changes', () => {
      const fp1 = createSettingsFingerprint(defaultOptions);
      const fp2 = createSettingsFingerprint({ ...defaultOptions, voiceId: 'other-voice-id' });
      expect(fp1).not.toBe(fp2);
    });

    it('changes when modelId changes', () => {
      const fp1 = createSettingsFingerprint(defaultOptions);
      const fp2 = createSettingsFingerprint({ ...defaultOptions, modelId: 'eleven_turbo_v2' });
      expect(fp1).not.toBe(fp2);
    });

    it('changes when outputFormat changes', () => {
      const fp1 = createSettingsFingerprint(defaultOptions);
      const fp2 = createSettingsFingerprint({ ...defaultOptions, outputFormat: 'mp3_44100_192' });
      expect(fp1).not.toBe(fp2);
    });

    it('changes when slider values or speaker boost change', () => {
      const fp1 = createSettingsFingerprint(defaultOptions);
      const fp2 = createSettingsFingerprint({ ...defaultOptions, stability: 0.8 });
      const fp3 = createSettingsFingerprint({ ...defaultOptions, useSpeakerBoost: false });
      expect(fp1).not.toBe(fp2);
      expect(fp1).not.toBe(fp3);
    });

    it('produces different fingerprints for different voice providers', () => {
      const fpEleven = createSettingsFingerprint('elevenlabs', defaultOptions);
      const fpAi33 = createSettingsFingerprint('ai33pro', {
        sourceProvider: 'elevenlabs',
        voiceId: 'elevenlabs_21m00Tcm4TlvDq8ikWAM',
        speed: 1,
      });
      expect(fpEleven).not.toBe(fpAi33);
      expect(fpEleven).toContain('"provider":"elevenlabs"');
      expect(fpAi33).toContain('"provider":"ai33pro"');
    });

    it('changes when AI33 Pro speed, voiceId, or sourceProvider changes', () => {
      const baseAi33 = {
        sourceProvider: 'elevenlabs' as const,
        voiceId: 'elevenlabs_21m00Tcm4TlvDq8ikWAM',
        speed: 1,
      };
      const fp1 = createSettingsFingerprint('ai33pro', baseAi33);
      const fp2 = createSettingsFingerprint('ai33pro', { ...baseAi33, speed: 1.2 });
      const fp3 = createSettingsFingerprint('ai33pro', { ...baseAi33, voiceId: 'minimax_male-qn' });
      const fp4 = createSettingsFingerprint('ai33pro', { ...baseAi33, sourceProvider: 'minimax' });

      expect(fp1).not.toBe(fp2);
      expect(fp1).not.toBe(fp3);
      expect(fp1).not.toBe(fp4);
    });
  });
});
