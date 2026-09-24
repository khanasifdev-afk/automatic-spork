import React, { useState } from 'react';
import {
  Volume2,
  Sparkles,
  RefreshCw,
  XCircle,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  AlertTriangle,
  Key,
  Info,
} from 'lucide-react';
import {
  Scene,
  VoiceSegmentState,
  WorkflowOptions,
  ElevenLabsVoice,
  Ai33Voice,
  VoiceProvider,
} from '../../types';
import { VoiceSegmentCard } from './VoiceSegmentCard';

export interface VoiceGenerationPanelProps {
  scenes: Scene[];
  options: WorkflowOptions;
  voiceStateByScene: Record<string, VoiceSegmentState>;
  isVoiceBatchRunning: boolean;
  excludedSceneIds: string[];
  elevenLabsApiKey?: string;
  ai33ProApiKey?: string;
  voices?: ElevenLabsVoice[];
  ai33Voices?: Ai33Voice[];
  onGenerateAll: () => void;
  onRetryScene: (sceneId: string) => void;
  onRegenerateScene: (sceneId: string) => void;
  onRetryFailed: () => void;
  onCancelGeneration: () => void;
  onProceedToClips: () => void;
  onBackToScenes: () => void;
  onStartOver: () => void;
  onNavigateToSettings: () => void;
}

export const VoiceGenerationPanel: React.FC<VoiceGenerationPanelProps> = ({
  scenes,
  options,
  voiceStateByScene,
  isVoiceBatchRunning,
  excludedSceneIds,
  elevenLabsApiKey = '',
  ai33ProApiKey = '',
  voices = [],
  ai33Voices = [],
  onGenerateAll,
  onRetryScene,
  onRegenerateScene,
  onRetryFailed,
  onCancelGeneration,
  onProceedToClips,
  onBackToScenes,
  onStartOver,
  onNavigateToSettings,
}) => {
  const [showStartOverModal, setShowStartOverModal] = useState(false);

  const activeProvider: VoiceProvider = options.voiceProvider || 'elevenlabs';
  const providerDisplayName = activeProvider === 'ai33pro' ? 'AI33 Pro' : 'ElevenLabs';

  const hasKey =
    activeProvider === 'ai33pro'
      ? Boolean(ai33ProApiKey.trim())
      : Boolean(elevenLabsApiKey.trim());

  const hasVoiceSelected =
    activeProvider === 'ai33pro'
      ? Boolean(options.ai33Pro?.voiceId?.trim())
      : Boolean(options.elevenLabs.voiceId?.trim());

  const includedScenes = scenes.filter((s) => !excludedSceneIds.includes(s.id));
  const totalIncluded = includedScenes.length;
  const totalCharacters = includedScenes.reduce((sum, s) => sum + s.scriptText.length, 0);

  let readyCount = 0;
  let failedCount = 0;
  let staleCount = 0;
  let generatingCount = 0;

  for (const scene of includedScenes) {
    const v = voiceStateByScene[scene.id];
    if (!v || v.status === 'idle') {
      // ungenerated
    } else if (v.status === 'ready') {
      readyCount++;
    } else if (v.status === 'stale') {
      staleCount++;
    } else if (v.status === 'failed' || v.status === 'cancelled') {
      failedCount++;
    } else if (v.status === 'generating' || v.status === 'queued') {
      generatingCount++;
    }
  }

  const allReady = totalIncluded > 0 && readyCount === totalIncluded;

  const currentVoiceName =
    activeProvider === 'ai33pro'
      ? ai33Voices.find((v) => v.voice_id === options.ai33Pro?.voiceId)?.name || options.ai33Pro?.voiceId
      : voices.find((v) => v.voice_id === options.elevenLabs.voiceId)?.name || options.elevenLabs.voiceId;

  return (
    <div className="voice-generation-panel card">
      {/* Header */}
      <div className="voice-panel-header">
        <div className="voice-title-group">
          <div className="voice-icon-badge">
            <Volume2 size={24} className="text-primary" />
          </div>
          <div>
            <h2 className="voice-panel-title">{providerDisplayName} Voice Narration & Review</h2>
            <p className="voice-panel-subtitle">
              {activeProvider === 'ai33pro'
                ? 'Generate AI33 Pro voice narration for each scene using OpenSpeaker multi-engine TTS.'
                : 'Generate natural ElevenLabs voice narration for each scene in your video.'}
            </p>
          </div>
        </div>

        <div className="voice-header-actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setShowStartOverModal(true)}
            title="Discard session and start over"
          >
            <RotateCcw size={14} />
            <span>Start Over</span>
          </button>
        </div>
      </div>

      {/* Missing Key Warning for the Active Provider */}
      {!hasKey && (
        <div className="voice-warning-banner" role="alert">
          <div className="warning-banner-content">
            <Key size={18} className="text-warning" />
            <div>
              <strong>{providerDisplayName} API Key Required:</strong>
              <p>
                To generate voice audio with {providerDisplayName}, configure your {providerDisplayName} API key on the Settings page.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={onNavigateToSettings}
          >
            Go to Settings
          </button>
        </div>
      )}

      {/* Missing Voice Selection Warning */}
      {hasKey && !hasVoiceSelected && (
        <div className="voice-warning-banner" role="alert">
          <div className="warning-banner-content">
            <AlertTriangle size={18} className="text-warning" />
            <div>
              <strong>Voice Selection Required:</strong>
              <p>
                Please select a {providerDisplayName} voice in Step 1 (Job Settings) before generating speech.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Summary Metrics Bar */}
      <div className="voice-metrics-bar">
        <div className="metric-chip">
          <span className="metric-label">Included Scenes</span>
          <span className="metric-value">{totalIncluded}</span>
        </div>
        <div className="metric-chip">
          <span className="metric-label">Ready</span>
          <span className="metric-value text-success">{readyCount}</span>
        </div>
        {generatingCount > 0 && (
          <div className="metric-chip">
            <span className="metric-label">Generating</span>
            <span className="metric-value text-primary">{generatingCount}</span>
          </div>
        )}
        {staleCount > 0 && (
          <div className="metric-chip">
            <span className="metric-label">Stale</span>
            <span className="metric-value text-warning">{staleCount}</span>
          </div>
        )}
        {failedCount > 0 && (
          <div className="metric-chip">
            <span className="metric-label">Failed</span>
            <span className="metric-value text-danger">{failedCount}</span>
          </div>
        )}
        <div className="metric-chip">
          <span className="metric-label">Service</span>
          <span className="metric-value">{providerDisplayName}</span>
        </div>
        {activeProvider === 'ai33pro' ? (
          <div className="metric-chip">
            <span className="metric-label">Source</span>
            <span className="metric-value">{options.ai33Pro?.sourceProvider || 'elevenlabs'}</span>
          </div>
        ) : (
          <div className="metric-chip">
            <span className="metric-label">Estimated Chars</span>
            <span className="metric-value">{totalCharacters.toLocaleString()}</span>
          </div>
        )}
      </div>

      {/* Planning estimate disclaimer */}
      <div className="voice-disclaimer">
        <Info size={13} />
        {activeProvider === 'ai33pro' ? (
          <span>
            Speech will be generated via AI33 Pro ({options.ai33Pro?.sourceProvider || 'elevenlabs'}).
            Credit usage is determined by the AI33 Pro backend.
          </span>
        ) : (
          <span>
            Character count is a planning estimate. Provider billing is controlled by ElevenLabs and
            actual character usage may vary.
          </span>
        )}
      </div>

      {/* Batch Actions Bar */}
      <div className="voice-batch-controls">
        <div className="batch-actions-left">
          {isVoiceBatchRunning ? (
            <button
              type="button"
              className="btn btn-danger"
              onClick={onCancelGeneration}
              title="Stop voice generation requests"
            >
              <XCircle size={16} />
              <span>Cancel Generation</span>
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              disabled={!hasKey || !hasVoiceSelected || totalIncluded === 0 || allReady}
              onClick={onGenerateAll}
              title={
                !hasKey
                  ? `Please configure your ${providerDisplayName} API key in Settings`
                  : !hasVoiceSelected
                    ? `Please select a voice in Job Settings (Step 1)`
                    : allReady
                      ? 'All scene voice narrations are ready'
                      : 'Generate speech for all scenes needing audio'
              }
            >
              <Sparkles size={16} />
              <span>
                {readyCount === 0
                  ? 'Generate All Voices'
                  : staleCount > 0
                    ? 'Regenerate Stale Voices'
                    : allReady
                      ? 'All Voices Ready'
                      : 'Generate Remaining Voices'}
              </span>
            </button>
          )}

          {failedCount > 0 && !isVoiceBatchRunning && (
            <button
              type="button"
              className="btn btn-secondary"
              disabled={!hasKey || !hasVoiceSelected}
              onClick={onRetryFailed}
              title="Retry all failed scene voice generations"
            >
              <RefreshCw size={14} />
              <span>Retry Failed ({failedCount})</span>
            </button>
          )}
        </div>
      </div>

      {/* Voice Segment Cards List */}
      <div className="voice-segments-list">
        {includedScenes.map((scene) => (
          <VoiceSegmentCard
            key={scene.id}
            scene={scene}
            totalScenes={totalIncluded}
            voiceState={voiceStateByScene[scene.id]}
            options={options}
            voiceName={currentVoiceName}
            isGeneratingBatch={isVoiceBatchRunning}
            onRetry={onRetryScene}
            onRegenerate={onRegenerateScene}
          />
        ))}
      </div>

      {/* Footer Navigation */}
      <div className="voice-panel-footer">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onBackToScenes}
          disabled={isVoiceBatchRunning}
        >
          <ArrowLeft size={16} />
          <span>Back to Scene Editor</span>
        </button>

        <button
          type="button"
          className="btn btn-primary"
          onClick={onProceedToClips}
          disabled={isVoiceBatchRunning || totalIncluded === 0}
        >
          <span>Find Pexels Clips</span>
          <ArrowRight size={16} />
        </button>
      </div>

      {/* Start Over Confirmation Modal */}
      {showStartOverModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-box">
            <div className="modal-header">
              <div className="modal-icon-wrap icon-warning">
                <AlertTriangle size={20} />
              </div>
              <h3 className="modal-title">Discard Workflow & Start Over?</h3>
            </div>
            <p className="modal-body">
              Starting over will discard your current script, generated scene cuts, and any audio or
              video selections. This action cannot be undone.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowStartOverModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  setShowStartOverModal(false);
                  onStartOver();
                }}
              >
                Yes, Start Over
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
