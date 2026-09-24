import { ElevenLabsOptions, Ai33ProOptions, VoiceProvider } from '../types';

/**
 * Creates a normalized fingerprint of the scene narration text.
 * Trims leading/trailing whitespace and normalizes repeated whitespace.
 */
export function createSourceTextFingerprint(text: string): string {
  if (!text) return '';
  return text.trim().replace(/\s+/g, ' ');
}

/**
 * Creates a deterministic fingerprint of workflow voice settings.
 * Supports both ElevenLabs and AI33 Pro options.
 * If any voice parameter or provider changes, this fingerprint changes, marking audio stale.
 */
export function createSettingsFingerprint(
  providerOrOptions: VoiceProvider | ElevenLabsOptions,
  maybeOptions?: ElevenLabsOptions | Ai33ProOptions
): string {
  if (providerOrOptions === 'ai33pro') {
    const ai33 = (maybeOptions || {}) as Ai33ProOptions;
    return JSON.stringify({
      provider: 'ai33pro',
      sourceProvider: ai33.sourceProvider || 'elevenlabs',
      voiceId: ai33.voiceId || '',
      speed: Number(ai33.speed?.toFixed(4) ?? 1),
    });
  }

  if (providerOrOptions === 'elevenlabs') {
    const el = (maybeOptions || {}) as ElevenLabsOptions;
    return JSON.stringify({
      provider: 'elevenlabs',
      voiceId: el.voiceId || '',
      modelId: el.modelId || '',
      outputFormat: el.outputFormat || 'mp3_44100_128',
      stability: Number(el.stability?.toFixed(4) ?? 0.5),
      similarityBoost: Number(el.similarityBoost?.toFixed(4) ?? 0.75),
      style: Number(el.style?.toFixed(4) ?? 0),
      speed: Number(el.speed?.toFixed(4) ?? 1),
      useSpeakerBoost: Boolean(el.useSpeakerBoost),
    });
  }

  // Backward compatibility when invoked with a single ElevenLabsOptions argument
  const el = providerOrOptions as ElevenLabsOptions;
  return JSON.stringify({
    provider: 'elevenlabs',
    voiceId: el.voiceId || '',
    modelId: el.modelId || '',
    outputFormat: el.outputFormat || 'mp3_44100_128',
    stability: Number(el.stability?.toFixed(4) ?? 0.5),
    similarityBoost: Number(el.similarityBoost?.toFixed(4) ?? 0.75),
    style: Number(el.style?.toFixed(4) ?? 0),
    speed: Number(el.speed?.toFixed(4) ?? 1),
    useSpeakerBoost: Boolean(el.useSpeakerBoost),
  });
}
