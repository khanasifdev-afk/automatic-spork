import React, { useState } from 'react';
import {
  Film,
  Clock,
  ArrowRight,
  RotateCcw,
  Sparkles,
  AlertTriangle,
  Monitor,
  Smartphone,
  Video,
  Volume2,
} from 'lucide-react';
import { Scene, WorkflowOptions } from '../../types';
import { SceneCard } from './SceneCard';

interface SceneEditorProps {
  scenes: Scene[];
  options: WorkflowOptions;
  onEditScene: (id: string, updates: Partial<Omit<Scene, 'id' | 'sequence'>>) => boolean;
  onSplitScene: (id: string, firstText: string, secondText: string) => boolean;
  onMergeScenes: (firstId: string, secondId: string) => boolean;
  onDeleteScene: (id: string) => boolean;
  onMoveScene: (id: string, direction: 'up' | 'down') => boolean;
  onProceedToVoices?: () => void;
  onFindClips: () => void;
  onAnalyzeAgain: () => void;
  onStartOver: () => void;
}

export const SceneEditor: React.FC<SceneEditorProps> = ({
  scenes,
  options,
  onEditScene,
  onSplitScene,
  onMergeScenes,
  onDeleteScene,
  onMoveScene,
  onProceedToVoices,
  onFindClips,
  onAnalyzeAgain,
  onStartOver,
}) => {
  const [showStartOverModal, setShowStartOverModal] = useState(false);
  const [showReanalyzeModal, setShowReanalyzeModal] = useState(false);

  const totalDurationSeconds = scenes.reduce((sum, s) => sum + s.estimatedSeconds, 0);
  const minutes = Math.floor(totalDurationSeconds / 60);
  const seconds = totalDurationSeconds % 60;
  const formattedDuration = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

  const canProceedToVoices =
    scenes.length > 0 && scenes.every((s) => s.scriptText.trim().length > 0);

  const canFindClips =
    scenes.length > 0 &&
    scenes.every((s) => s.scriptText.trim().length > 0 && s.primaryQuery.trim().length > 0);

  return (
    <div className="scene-editor-container">
      {/* Editor Header */}
      <div className="scene-editor-header">
        <div className="scene-summary-info">
          <h2 className="scene-editor-title">
            Visual Scenes Review
          </h2>
          <div className="scene-summary-badges">
            <span className="summary-badge">
              <Film size={15} />
              <span>{scenes.length} {scenes.length === 1 ? 'Scene' : 'Scenes'}</span>
            </span>
            <span className="summary-badge">
              <Clock size={15} />
              <span>~{formattedDuration} runtime</span>
            </span>
            <span className="summary-badge-subtle">
              {options.orientation === 'landscape' ? <Monitor size={14} /> : <Smartphone size={14} />}
              <span>{options.orientation === 'landscape' ? '16:9' : '9:16'}</span>
            </span>
            <span className="summary-badge-subtle">
              <Video size={14} />
              <span>{options.quality.toUpperCase()}</span>
            </span>
          </div>
        </div>

        <div className="scene-header-actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            title="Re-run Gemini analysis on your script"
            onClick={() => setShowReanalyzeModal(true)}
          >
            <Sparkles size={15} />
            <span>Analyze Again</span>
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            title="Discard current job and start over from scratch"
            onClick={() => setShowStartOverModal(true)}
          >
            <RotateCcw size={15} />
            <span>Start Over</span>
          </button>
        </div>
      </div>

      <p className="scene-editor-instructions">
        Gemini divided your script into the visual scenes below. Review, edit narration, customize search queries, split, merge, or reorder scenes before proceeding to find stock footage clips.
      </p>

      {/* Scenes List */}
      {scenes.length === 0 ? (
        <div className="scenes-empty-state">
          <Film size={36} className="empty-icon" />
          <h3>All scenes have been deleted</h3>
          <p>
            You have removed every scene from this job. Analyze your script again or start over to create new scenes.
          </p>
          <div className="empty-state-actions">
            <button
              type="button"
              className="btn btn-primary"
              title="Re-run Gemini analysis to recreate visual scenes"
              onClick={() => onAnalyzeAgain()}
            >
              <Sparkles size={16} />
              <span>Re-analyze Script</span>
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              title="Start over with a new script and default options"
              onClick={() => onStartOver()}
            >
              <RotateCcw size={16} />
              <span>Start Over</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="scene-cards-list">
          {scenes.map((scene, index) => (
            <SceneCard
              key={scene.id}
              scene={scene}
              totalScenes={scenes.length}
              onEdit={onEditScene}
              onSplit={onSplitScene}
              onMerge={onMergeScenes}
              onDelete={onDeleteScene}
              onMove={onMoveScene}
              previousSceneId={index > 0 ? scenes[index - 1].id : undefined}
              nextSceneId={index < scenes.length - 1 ? scenes[index + 1].id : undefined}
            />
          ))}
        </div>
      )}

      {/* Bottom Actions Bar */}
      <div className="scene-editor-footer">
        <button
          type="button"
          className="btn btn-secondary"
          title="Discard current job and start over from scratch"
          onClick={() => setShowStartOverModal(true)}
        >
          <RotateCcw size={16} />
          <span>Start Over</span>
        </button>

        <div className="scene-footer-proceed-group">
          {onProceedToVoices ? (
            <button
              type="button"
              className="btn btn-primary btn-proceed-voices"
              title={
                !canProceedToVoices
                  ? 'Ensure all scenes have valid narration text'
                  : 'Proceed to generate ElevenLabs voice narration'
              }
              onClick={onProceedToVoices}
              disabled={!canProceedToVoices}
            >
              <Volume2 size={16} />
              <span>Proceed to Voices</span>
              <ArrowRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary btn-find-clips"
              title={
                !canFindClips
                  ? 'Ensure all scenes have valid narration and search queries'
                  : 'Proceed to find stock footage clips for these scenes'
              }
              onClick={onFindClips}
              disabled={!canFindClips}
            >
              <span>Find Clips</span>
              <ArrowRight size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Start Over Confirmation Modal */}
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
              Starting over will discard your current script, generated scenes, and any custom edits from memory. Saved API keys and default settings will be preserved.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                title="Cancel and keep current scenes"
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

      {/* Re-analyze Confirmation Modal */}
      {showReanalyzeModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-box">
            <div className="modal-header">
              <div className="modal-icon-wrap icon-primary">
                <Sparkles size={20} />
              </div>
              <h3 className="modal-title">Analyze Script Again?</h3>
            </div>
            <p className="modal-body">
              Re-analyzing your script with Gemini will regenerate all visual scenes and overwrite any manual edits you have made to this scene list.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                title="Cancel and keep current scenes"
                onClick={() => setShowReanalyzeModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                title="Confirm and regenerate scenes with Gemini"
                onClick={() => {
                  setShowReanalyzeModal(false);
                  onAnalyzeAgain();
                }}
              >
                Re-analyze
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
