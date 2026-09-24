import React, { useState } from 'react';
import {
  Volume2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  Clock,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { Scene, VoiceSegmentState, WorkflowOptions } from '../../types';

export interface VoiceSegmentCardProps {
  scene: Scene;
  totalScenes: number;
  voiceState?: VoiceSegmentState;
  options: WorkflowOptions;
  voiceName?: string;
  isGeneratingBatch: boolean;
  onRetry: (sceneId: string) => void;
  onRegenerate: (sceneId: string) => void;
}

export const VoiceSegmentCard: React.FC<VoiceSegmentCardProps> = ({
  scene,
  totalScenes,
  voiceState,
  options,
  voiceName,
  isGeneratingBatch,
  onRetry,
  onRegenerate,
}) => {
  const [showConfirmRegenerate, setShowConfirmRegenerate] = useState(false);

  const status = voiceState?.status || 'idle';
  const charCount = scene.scriptText.length;
  const isBusy = status === 'queued' || status === 'generating' || isGeneratingBatch;
  const isAi33 = options.voiceProvider === 'ai33pro';

  const handleConfirmRegenerate = () => {
    setShowConfirmRegenerate(false);
    onRegenerate(scene.id);
  };

  const formattedDuration =
    voiceState?.durationSeconds !== null && voiceState?.durationSeconds !== undefined
      ? `${voiceState.durationSeconds.toFixed(1)}s`
      : null;

  return (
    <div
      className={`voice-segment-card card ${
        status === 'ready'
          ? 'voice-card-ready'
          : status === 'generating'
          ? 'voice-card-generating'
          : status === 'stale'
          ? 'voice-card-stale'
          : status === 'failed'
          ? 'voice-card-failed'
          : ''
      }`}
    >
      <div className="voice-card-header">
        <div className="voice-card-title-group">
          <span className="sequence-badge">
            Scene {scene.sequence} of {totalScenes}
          </span>
          <span className="voice-char-count" title="Narration character count">
            {charCount} {charCount === 1 ? 'char' : 'chars'}
          </span>
          <span className="voice-model-pill" title="Selected Voice and Engine">
            <Volume2 size={12} />
            {isAi33 ? (
              <span>
                AI33 Pro ({options.ai33Pro?.sourceProvider || 'elevenlabs'}) ·{' '}
                {voiceName || options.ai33Pro?.voiceId || 'Default Voice'} ·{' '}
                {(options.ai33Pro?.speed ?? 1.0).toFixed(2)}x
              </span>
            ) : (
              <span>
                {voiceName || options.elevenLabs.voiceId || 'Default Voice'} ·{' '}
                {options.elevenLabs.modelId}
              </span>
            )}
          </span>
        </div>

        <div className="voice-card-status-actions">
          {/* Status badge */}
          {status === 'idle' && (
            <span className="status-badge badge-pending">
              <Clock size={12} />
              <span>Not Generated</span>
            </span>
          )}
          {status === 'queued' && (
            <span className="status-badge badge-pending">
              <Clock size={12} />
              <span>Queued</span>
            </span>
          )}
          {status === 'generating' && (
            <span className="status-badge badge-downloading">
              <Loader2 size={12} className="spin-icon" />
              <span>Generating...</span>
            </span>
          )}
          {status === 'ready' && (
            <span className="status-badge badge-complete">
              <CheckCircle2 size={12} />
              <span>Ready</span>
            </span>
          )}
          {status === 'stale' && (
            <span className="status-badge badge-cancelled" title="Script text or settings changed">
              <AlertTriangle size={12} />
              <span>Stale Audio</span>
            </span>
          )}
          {status === 'failed' && (
            <span className="status-badge badge-failed" title={voiceState?.error || 'Generation failed'}>
              <AlertTriangle size={12} />
              <span>Failed</span>
            </span>
          )}
          {status === 'cancelled' && (
            <span className="status-badge badge-cancelled">
              <XCircle size={12} />
              <span>Cancelled</span>
            </span>
          )}

          {/* Action buttons */}
          {(status === 'failed' || status === 'cancelled') && (
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              disabled={isBusy}
              onClick={() => onRetry(scene.id)}
              title="Retry generating voice for this scene"
            >
              <RefreshCw size={13} />
              <span>Retry</span>
            </button>
          )}

          {status === 'idle' && (
            <button
              type="button"
              className="btn btn-sm btn-primary"
              disabled={isBusy}
              onClick={() => onRetry(scene.id)}
              title="Generate speech for this scene"
            >
              <Sparkles size={13} />
              <span>Generate</span>
            </button>
          )}

          {(status === 'ready' || status === 'stale') && (
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              disabled={isBusy}
              onClick={() => setShowConfirmRegenerate(true)}
              title="Regenerate speech for this scene"
            >
              <RefreshCw size={13} />
              <span>Regenerate</span>
            </button>
          )}
        </div>
      </div>

      {/* Spoken Narration Script */}
      <div className="voice-card-narration">
        <p className="narration-text">"{scene.scriptText}"</p>
      </div>

      {/* Stale Warning Banner */}
      {status === 'stale' && (
        <div className="voice-stale-banner" role="alert">
          <AlertTriangle size={14} className="text-warning" />
          <span>
            Script text or voice settings were modified after this audio was created. Regenerate
            this segment before exporting your video package.
          </span>
        </div>
      )}

      {/* Error Banner */}
      {status === 'failed' && voiceState?.error && (
        <div className="voice-error-banner" role="alert">
          <AlertTriangle size={14} className="text-danger" />
          <span>{voiceState.error}</span>
        </div>
      )}

      {/* Audio Playback & Duration */}
      {(status === 'ready' || status === 'stale') && voiceState?.audioUrl && (
        <div className="voice-card-audio-row">
          <audio
            className="voice-audio-player"
            controls
            preload="metadata"
            src={voiceState.audioUrl}
            aria-label={`Audio playback for Scene ${scene.sequence}`}
          >
            Your browser does not support HTML5 audio playback.
          </audio>

          <div className="voice-duration-info">
            <Clock size={13} />
            <span>{formattedDuration ? `${formattedDuration} duration` : 'Duration unavailable'}</span>
          </div>
        </div>
      )}

      {/* Confirm Regeneration Modal */}
      {showConfirmRegenerate && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-box">
            <div className="modal-header">
              <div className="modal-icon-wrap icon-primary">
                <RefreshCw size={20} />
              </div>
              <h3 className="modal-title">Regenerate Scene Audio?</h3>
            </div>
            <p className="modal-body">
              {isAi33 ? (
                <>
                  Regenerating voice narration for <strong>Scene {scene.sequence}</strong> will make a
                  new <strong>AI33 Pro</strong> text-to-speech request and consume credits from your AI33 Pro account.
                </>
              ) : (
                <>
                  Regenerating voice narration for <strong>Scene {scene.sequence}</strong> will make a
                  new <strong>ElevenLabs</strong> text-to-speech request and consume approximately{' '}
                  <strong>{charCount} characters</strong> from your ElevenLabs quota.
                </>
              )}
              <br />
              <br />
              Your current audio segment for this scene will be replaced.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowConfirmRegenerate(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirmRegenerate}
              >
                Regenerate Audio
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
