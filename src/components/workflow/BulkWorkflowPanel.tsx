import React from 'react';
import {
  Zap,
  CheckCircle2,
  Circle,
  Loader2,
  XCircle,
  X,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';
import { BulkWorkflowStatus } from '../../types';

interface BulkWorkflowPanelProps {
  status: BulkWorkflowStatus;
  hasScript: boolean;
  hasGeminiKey: boolean;
  hasPexelsKey: boolean;
  hasVoiceKey: boolean;
  onRun: () => void;
  onCancel: () => void;
}

type StageDef = {
  key: BulkWorkflowStatus['stage'];
  label: string;
  description: string;
};

const STAGES: StageDef[] = [
  { key: 'analyzing',         label: 'Analyze Script',       description: 'Gemini segments your script into visual scenes' },
  { key: 'generating-voices', label: 'Generate Voices',      description: 'ElevenLabs / AI33 Pro generates narration audio' },
  { key: 'searching-media',   label: 'Search Stock Media',   description: 'Pexels fetches videos and/or images per scene' },
  { key: 'packaging',         label: 'Package & Download',   description: 'ZIP is built in-browser and auto-downloaded' },
];

const STAGE_ORDER = STAGES.map((s) => s.key);

function stageIndex(stage: BulkWorkflowStatus['stage']): number {
  return STAGE_ORDER.indexOf(stage as typeof STAGE_ORDER[number]);
}

export const BulkWorkflowPanel: React.FC<BulkWorkflowPanelProps> = ({
  status,
  hasScript,
  hasGeminiKey,
  hasPexelsKey,
  hasVoiceKey,
  onRun,
  onCancel,
}) => {
  const isRunning = ['analyzing', 'generating-voices', 'searching-media', 'packaging'].includes(status.stage);
  const isComplete = status.stage === 'complete';
  const isFailed   = status.stage === 'failed';
  const isCancelled = status.stage === 'cancelled';
  const isIdle      = status.stage === 'idle';
  const currentIdx  = stageIndex(status.stage);

  const canRun = hasScript && hasGeminiKey && hasPexelsKey && !isRunning;

  const missingItems: string[] = [];
  if (!hasScript)     missingItems.push('script text');
  if (!hasGeminiKey)  missingItems.push('Gemini API key');
  if (!hasPexelsKey)  missingItems.push('Pexels API key');

  return (
    <div className="bulk-workflow-panel">
      <div className="bulk-workflow-header">
        <div className="bulk-workflow-title-row">
          <div className="bulk-workflow-icon-wrap">
            <Zap size={20} />
          </div>
          <div>
            <h3 className="bulk-workflow-title">Bulk Automated Workflow</h3>
            <p className="bulk-workflow-subtitle">
              One click: Gemini analyzes your script, voices are generated, stock media is fetched, and a ZIP is
              downloaded — fully automatic.
            </p>
          </div>
        </div>

        <div className="bulk-workflow-actions">
          {!isRunning ? (
            <button
              id="bulk-run-btn"
              type="button"
              className="btn btn-primary bulk-run-btn"
              onClick={onRun}
              disabled={!canRun}
              title={missingItems.length > 0 ? `Missing: ${missingItems.join(', ')}` : 'Run the full workflow automatically'}
            >
              <Zap size={16} />
              <span>Run Full Workflow</span>
              <ChevronRight size={15} />
            </button>
          ) : (
            <button
              id="bulk-cancel-btn"
              type="button"
              className="btn btn-danger-outline bulk-cancel-btn"
              onClick={onCancel}
            >
              <X size={15} />
              <span>Cancel</span>
            </button>
          )}
        </div>
      </div>

      {/* Missing requirements notice */}
      {isIdle && missingItems.length > 0 && (
        <div className="bulk-missing-notice" role="alert">
          <AlertCircle size={14} />
          <span>Required to run: <strong>{missingItems.join(', ')}</strong>. Configure in Settings.</span>
          {!hasVoiceKey && (
            <span className="bulk-optional-note"> Voice key is optional — voices will be skipped if not set.</span>
          )}
        </div>
      )}

      {/* Progress bar */}
      {(isRunning || isComplete || isFailed || isCancelled) && (
        <div className="bulk-progress-bar-wrap" role="progressbar" aria-valuenow={status.progress} aria-valuemin={0} aria-valuemax={100}>
          <div
            className={`bulk-progress-bar ${isFailed ? 'failed' : isCancelled ? 'cancelled' : isComplete ? 'complete' : ''}`}
            style={{ width: `${status.progress}%` }}
          />
        </div>
      )}

      {/* Stage list */}
      {(isRunning || isComplete || isFailed || isCancelled) && (
        <ol className="bulk-stage-list" aria-label="Workflow stages">
          {STAGES.map((stage, idx) => {
            const stageCurrentIdx = currentIdx;
            let stageStatus: 'done' | 'active' | 'pending' | 'failed' = 'pending';

            if (isFailed && idx === stageCurrentIdx) stageStatus = 'failed';
            else if (idx < stageCurrentIdx || isComplete) stageStatus = 'done';
            else if (idx === stageCurrentIdx) stageStatus = 'active';

            return (
              <li
                key={stage.key}
                className={`bulk-stage-item bulk-stage-${stageStatus}`}
                aria-current={stageStatus === 'active' ? 'step' : undefined}
              >
                <span className="bulk-stage-icon" aria-hidden="true">
                  {stageStatus === 'done'   && <CheckCircle2 size={17} />}
                  {stageStatus === 'active' && <Loader2 size={17} className="bulk-spinner" />}
                  {stageStatus === 'failed' && <XCircle size={17} />}
                  {stageStatus === 'pending'&& <Circle size={17} />}
                </span>
                <span className="bulk-stage-text">
                  <span className="bulk-stage-label">{stage.label}</span>
                  <span className="bulk-stage-desc">{stage.description}</span>
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {/* Status message */}
      {status.message && (isRunning || isComplete || isFailed || isCancelled) && (
        <p
          className={`bulk-status-message ${isFailed ? 'bulk-status-failed' : isComplete ? 'bulk-status-complete' : ''}`}
          role={isFailed ? 'alert' : 'status'}
        >
          {isFailed && <XCircle size={14} />}
          {isComplete && <CheckCircle2 size={14} />}
          {status.message}
        </p>
      )}

      {/* Error detail */}
      {isFailed && status.error && status.error !== status.message && (
        <p className="bulk-error-detail" role="alert">{status.error}</p>
      )}
    </div>
  );
};
