import React, { useState } from 'react';
import {
  Download,
  RotateCcw,
  XCircle,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  FileArchive,
  ArrowLeft,
  Loader2,
  Film,
  Volume2,
} from 'lucide-react';
import { CandidateLabel, ExportState, Scene, VoiceSegmentState } from '../../types';
import { getMp3Filename } from '../../utils/filenames';

interface PackagingPanelProps {
  exportState: ExportState | null;
  scenes: Scene[];
  voiceStateByScene?: Record<string, VoiceSegmentState>;
  onStartExport: () => void;
  onCancelExport: () => void;
  onRetryClip: (sceneId: string, candidateLabel?: CandidateLabel) => void;
  onDownloadZip: () => void;
  onBackToClips: () => void;
  onStartOver: () => void;
}

function formatBytes(bytes?: number): string {
  if (bytes === undefined || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const PackagingPanel: React.FC<PackagingPanelProps> = ({
  exportState,
  scenes,
  voiceStateByScene,
  onStartExport,
  onCancelExport,
  onRetryClip,
  onDownloadZip,
  onBackToClips,
  onStartOver,
}) => {
  const [showStartOverModal, setShowStartOverModal] = useState(false);

  const stage = exportState?.stage || 'idle';
  const clips = exportState?.clips || [];
  const error = exportState?.error;

  const totalClips = clips.length;
  const completedClips = clips.filter((c) => c.state === 'complete').length;
  const failedClips = clips.filter((c) => c.state === 'failed').length;

  const progressPercent =
    totalClips > 0
      ? Math.round(
          stage === 'complete'
            ? 100
            : stage === 'compressing'
            ? 90
            : stage === 'preparing-files'
            ? 80
            : (completedClips / totalClips) * 75
        )
      : 0;

  const sceneMap = new Map(scenes.map((s) => [s.id, s]));

  const isWorking =
    stage === 'validating' ||
    stage === 'downloading' ||
    stage === 'preparing-files' ||
    stage === 'compressing';

  return (
    <div className="packaging-panel card">
      {/* Header Overview */}
      <div className="packaging-header">
        <div className="packaging-title-group">
          <div className="packaging-icon-badge">
            {stage === 'complete' ? (
              <CheckCircle2 size={24} className="text-success" />
            ) : stage === 'failed' ? (
              <AlertTriangle size={24} className="text-danger" />
            ) : stage === 'cancelled' ? (
              <XCircle size={24} className="text-warning" />
            ) : (
              <FileArchive size={24} className="text-primary" />
            )}
          </div>
          <div>
            <h2 className="packaging-title">
              {stage === 'complete'
                ? 'Package Ready for Download'
                : stage === 'failed'
                ? 'Export Failed'
                : stage === 'cancelled'
                ? 'Export Cancelled'
                : stage === 'compressing'
                ? 'Creating ZIP Archive...'
                : stage === 'preparing-files'
                ? 'Preparing Metadata & Text Files...'
                : stage === 'validating'
                ? 'Validating Video Clips...'
                : 'Downloading Stock Video Clips...'}
            </h2>
            <p className="packaging-subtitle">
              {stage === 'complete'
                ? 'Your numbered MP4 and MP3 files, script segments, manifest, and credits have been packaged into youtube-video-clips.zip.'
                : stage === 'failed'
                ? error || 'One or more clips could not be downloaded. You can retry failed clips below.'
                : stage === 'cancelled'
                ? 'Export was stopped. You can resume downloading or return to clip selection.'
                : failedClips > 0
                ? `Downloaded ${completedClips} of ${totalClips} clips. ${failedClips} clip${failedClips > 1 ? 's' : ''} failed — click Retry below to retry.`
                : `Downloaded ${completedClips} of ${totalClips} clips (${progressPercent}% complete)`}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="packaging-actions">
          {isWorking && (
            <button
              type="button"
              className="btn btn-secondary btn-cancel-export"
              title="Stop active downloads"
              onClick={onCancelExport}
            >
              <XCircle size={16} />
              <span>Cancel Export</span>
            </button>
          )}

          {stage === 'complete' && (
            <>
              <button
                type="button"
                className="btn btn-primary btn-download-zip"
                title="Save youtube-video-clips.zip to your computer"
                onClick={onDownloadZip}
              >
                <Download size={16} />
                <span>Download youtube-video-clips.zip</span>
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                title="Start a new script session"
                onClick={() => setShowStartOverModal(true)}
              >
                <RotateCcw size={16} />
                <span>Start Over</span>
              </button>
            </>
          )}

          {(stage === 'cancelled' || stage === 'failed') && (
            <>
              <button
                type="button"
                className="btn btn-secondary"
                title="Return to clip selection"
                onClick={onBackToClips}
              >
                <ArrowLeft size={16} />
                <span>Back to Selection</span>
              </button>
              <button
                type="button"
                className="btn btn-primary"
                title="Resume or restart export"
                onClick={onStartExport}
              >
                <RefreshCw size={16} />
                <span>Retry Export</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="packaging-progress-container">
        <div
          className="packaging-progress-bar"
          role="progressbar"
          aria-valuenow={progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className={`packaging-progress-fill ${
              stage === 'complete'
                ? 'fill-complete'
                : stage === 'failed'
                ? 'fill-failed'
                : stage === 'cancelled'
                ? 'fill-cancelled'
                : 'fill-active'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="packaging-progress-stats">
          <span className="stats-label">
            {stage === 'preparing-files'
              ? 'Generating script-segments.txt, manifest.csv, and credits.txt...'
              : stage === 'compressing'
              ? 'Building in-memory ZIP package with JSZip...'
              : stage === 'complete'
              ? 'ZIP archive successfully created.'
              : `${completedClips} of ${totalClips} clips downloaded`}
          </span>
          <span className="stats-percentage">{progressPercent}%</span>
        </div>
      </div>

      {/* Error Notice */}
      {error && stage !== 'cancelled' && (
        <div className="packaging-error-banner" role="alert">
          <AlertTriangle size={18} className="text-danger" />
          <span>{error}</span>
        </div>
      )}

      {/* Clips Progress List */}
      <div className="packaging-clips-list" aria-label="Clip Download List">
        <div className="packaging-clips-header">
          <span className="col-num">#</span>
          <span className="col-file">Filename</span>
          <span className="col-scene">Script Narration</span>
          <span className="col-size">Size</span>
          <span className="col-status">Status</span>
          <span className="col-action">Action</span>
        </div>

        {(() => {
          const totalScenes = new Set(clips.map((c) => c.sceneId)).size || scenes.length;
          return clips.map((clip) => {
            const scene = sceneMap.get(clip.sceneId);
            const sizeText =
              clip.receivedBytes && clip.totalBytes
                ? `${formatBytes(clip.receivedBytes)} / ${formatBytes(clip.totalBytes)}`
                : clip.receivedBytes
                ? formatBytes(clip.receivedBytes)
                : '—';

            return (
              <div
                key={`${clip.sceneId}-${clip.candidateLabel || clip.sequence}`}
                className={`packaging-clip-row clip-status-${clip.state}`}
              >
                <div className="col-num">
                  <span className="sequence-badge">{clip.sequence}</span>
                  {clip.candidateLabel && (
                    <span className="candidate-badge" style={{ marginLeft: '4px', fontWeight: 700 }}>
                      {clip.candidateLabel}
                    </span>
                  )}
                </div>
                <div className="col-file">
                  <div className="packaging-file-entry">
                    <Film size={14} className="file-icon" />
                    <span className="filename-text">{clip.filename}</span>
                  </div>
                  {voiceStateByScene && (!clip.candidateLabel || clip.candidateLabel === 'A') && (
                    <div className="packaging-file-entry packaging-voice-file-entry">
                      <Volume2 size={13} className="file-icon text-muted" />
                      <span className="filename-text voice-filename-text">
                        {getMp3Filename(clip.sequence, totalScenes)}
                      </span>
                      {voiceStateByScene[clip.sceneId]?.status === 'ready' && (
                        <span className="badge-voice-pill text-success" title="Voice audio ready">
                          Ready
                        </span>
                      )}
                      {voiceStateByScene[clip.sceneId]?.status &&
                        voiceStateByScene[clip.sceneId].status !== 'ready' && (
                          <span
                            className="badge-voice-pill text-warning"
                            title={`Voice status: ${voiceStateByScene[clip.sceneId].status}`}
                          >
                            {voiceStateByScene[clip.sceneId].status}
                          </span>
                        )}
                    </div>
                  )}
                </div>
                <div className="col-scene">
                  <p className="scene-narration-snippet" title={scene?.scriptText}>
                    {scene?.scriptText || 'Scene segment'}
                  </p>
                </div>
                <div className="col-size">
                  <span className="size-text">{sizeText}</span>
                </div>
                <div className="col-status">
                  {clip.state === 'pending' && (
                    <span className="status-badge badge-pending">Pending</span>
                  )}
                  {clip.state === 'downloading' && (
                    <span className="status-badge badge-downloading">
                      <Loader2 size={12} className="spin-icon" />
                      <span>Downloading</span>
                    </span>
                  )}
                  {clip.state === 'complete' && (
                    <span className="status-badge badge-complete">
                      <CheckCircle2 size={12} />
                      <span>Complete</span>
                    </span>
                  )}
                  {clip.state === 'failed' && (
                    <span className="status-badge badge-failed" title={clip.error}>
                      <AlertTriangle size={12} />
                      <span>Failed</span>
                    </span>
                  )}
                  {clip.state === 'cancelled' && (
                    <span className="status-badge badge-cancelled">Cancelled</span>
                  )}
                </div>
                <div className="col-action">
                  {clip.state === 'failed' && (
                    <button
                      type="button"
                      className="btn btn-xs btn-retry-clip"
                      title={`Retry downloading ${clip.filename}`}
                      onClick={() => onRetryClip(clip.sceneId, clip.candidateLabel)}
                    >
                      <RefreshCw size={12} />
                      <span>Retry</span>
                    </button>
                  )}
                </div>
              </div>
            );
          });
        })()}
      </div>

      {/* Start Over Modal */}
      {showStartOverModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-box">
            <div className="modal-header">
              <div className="modal-icon-wrap icon-danger">
                <AlertTriangle size={20} />
              </div>
              <h3 className="modal-title">Start Over?</h3>
            </div>
            <p className="modal-body">
              Starting over will discard your current script, generated scenes, search queries, and
              downloaded video files. Saved API keys and default settings will be preserved.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                title="Cancel"
                onClick={() => setShowStartOverModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                title="Confirm discard and start over"
                onClick={() => {
                  setShowStartOverModal(false);
                  onStartOver();
                }}
              >
                Start Over
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
