import React, { useEffect, useState, useTransition } from 'react';
import {
  Film,
  CheckCircle2,
  EyeOff,
  ArrowLeft,
  RotateCcw,
  Package,
  AlertTriangle,
  RefreshCw,
  Settings,
} from 'lucide-react';
import { Scene, WorkflowOptions, SceneSearchState } from '../../types';
import { SceneClipsCard } from './SceneClipsCard';

interface ClipsReviewProps {
  scenes: Scene[];
  options: WorkflowOptions;
  searchStateByScene: Record<string, SceneSearchState>;
  excludedSceneIds: string[];
  pexelsApiKey: string;
  onSearchAll: (apiKey: string) => Promise<void>;
  onSearchScene: (sceneId: string, apiKey: string, customQuery?: string) => Promise<void>;
  onExcludeScene: (sceneId: string) => void;
  onRestoreScene: (sceneId: string) => void;
  canProceedToPackaging: () => boolean;
  onProceedToPackaging: () => boolean;
  onBackToVoices?: () => void;
  onBackToScenes?: () => void;
  onStartOver: () => void;
  onNavigateToSettings: () => void;
}

export const ClipsReview: React.FC<ClipsReviewProps> = ({
  scenes,
  options,
  searchStateByScene,
  excludedSceneIds,
  pexelsApiKey,
  onSearchAll,
  onSearchScene,
  onExcludeScene,
  onRestoreScene,
  canProceedToPackaging,
  onProceedToPackaging,
  onBackToVoices,
  onBackToScenes,
  onStartOver,
  onNavigateToSettings,
}) => {
  const handleBackToVoices = onBackToVoices || onBackToScenes;
  const [, startTransition] = useTransition();
  const [showStartOverModal, setShowStartOverModal] = useState(false);
  const [hasAutoSearched, setHasAutoSearched] = useState(false);
  const [confirmationNotice, setConfirmationNotice] = useState<string | null>(null);

  const includedScenes = scenes.filter((s) => !excludedSceneIds.includes(s.id));
  const readyScenesCount = includedScenes.filter((s) => {
    const st = searchStateByScene[s.id];
    return st && st.status === 'ready' && Array.isArray(st.candidates) && st.candidates.length === 6;
  }).length;

  const isAllIncludedReady =
    includedScenes.length > 0 && readyScenesCount === includedScenes.length;

  const hasApiKey = Boolean(pexelsApiKey.trim());

  // Auto-search unsearched scenes on first mount if API key is present
  useEffect(() => {
    if (!hasAutoSearched && hasApiKey && scenes.length > 0) {
      const needsSearch = scenes.some(
        (s) => !searchStateByScene[s.id] || searchStateByScene[s.id].status === 'idle'
      );
      if (needsSearch) {
        setHasAutoSearched(true);
        startTransition(() => {
          onSearchAll(pexelsApiKey);
        });
      }
    }
  }, [hasAutoSearched, hasApiKey, scenes, searchStateByScene, onSearchAll, pexelsApiKey]);

  const handleConfirmSelections = () => {
    if (isAllIncludedReady) {
      setConfirmationNotice('Clip sets confirmed! All included scenes have six verified video options.');
      setTimeout(() => setConfirmationNotice(null), 4000);
    }
  };

  const handleGenerateZip = () => {
    if (canProceedToPackaging()) {
      onProceedToPackaging();
    }
  };

  return (
    <div className="clips-review-container">
      {/* Header Summary */}
      <div className="clips-review-header">
        <div className="clips-summary-info">
          <h2 className="clips-review-title">Stock Video Review</h2>
          <div className="clips-summary-badges">
            <span className="summary-badge">
              <Film size={15} />
              <span>{scenes.length} Total Scenes</span>
            </span>
            <span className="summary-badge">
              <CheckCircle2 size={15} className="text-success" />
              <span>
                {readyScenesCount} of {includedScenes.length} Ready (6 Clips Each)
              </span>
            </span>
            {excludedSceneIds.length > 0 && (
              <span className="summary-badge-subtle">
                <EyeOff size={14} />
                <span>{excludedSceneIds.length} Excluded</span>
              </span>
            )}
            <span className="summary-badge-subtle">
              <span>Orientation: {options.orientation}</span>
            </span>
          </div>
        </div>

        <div className="clips-header-actions">
          {hasApiKey && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              title="Search Pexels footage for all unsearched or pending scenes"
              onClick={() => onSearchAll(pexelsApiKey)}
            >
              <RefreshCw size={14} />
              <span>Search All Scenes</span>
            </button>
          )}

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            title="Return to voice narration review"
            onClick={handleBackToVoices}
          >
            <ArrowLeft size={14} />
            <span>Back to Voices</span>
          </button>
        </div>
      </div>

      <p className="clips-review-instructions">
        Review the stock clips retrieved from Pexels. Six clips (Options A through F) are provided
        for every included scene and all six will be exported. You can preview video playback,
        customize search queries, or exclude scenes before export.
      </p>

      {/* Confirmation Flash Alert */}
      {confirmationNotice && (
        <div className="alert alert-success clips-confirm-alert" role="status">
          <CheckCircle2 size={18} className="alert-icon" />
          <div className="alert-content">
            <div className="alert-title">Clip Sets Confirmed</div>
            <p className="alert-message">{confirmationNotice}</p>
          </div>
        </div>
      )}

      {/* Missing Key Banner */}
      {!hasApiKey && (
        <div className="alert alert-warning clips-missing-key-banner">
          <AlertTriangle size={20} className="alert-icon" />
          <div className="alert-content">
            <div className="alert-title">Pexels API Key Required</div>
            <p className="alert-message">
              You must configure a valid Pexels API key in Settings before stock video clips can be
              retrieved.
            </p>
            <button
              type="button"
              className="btn btn-secondary btn-sm mt-2"
              onClick={onNavigateToSettings}
            >
              <Settings size={14} />
              <span>Open Settings</span>
            </button>
          </div>
        </div>
      )}

      {/* Scene Cards List */}
      <div className="scene-clips-list">
        {scenes.map((scene) => (
          <SceneClipsCard
            key={scene.id}
            scene={scene}
            searchState={searchStateByScene[scene.id]}
            isExcluded={excludedSceneIds.includes(scene.id)}
            onReSearch={(customQuery) => onSearchScene(scene.id, pexelsApiKey, customQuery)}
            onExcludeScene={() => onExcludeScene(scene.id)}
            onRestoreScene={() => onRestoreScene(scene.id)}
          />
        ))}
      </div>

      {/* Sticky Bottom Actions Bar */}
      <div className="clips-review-footer">
        <div className="footer-left-actions">
          <button
            type="button"
            className="btn btn-secondary"
            title="Return to voice narration review"
            onClick={handleBackToVoices}
          >
            <ArrowLeft size={16} />
            <span>Back to Voices</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            title="Discard current job and start over"
            onClick={() => setShowStartOverModal(true)}
          >
            <RotateCcw size={16} />
            <span>Start Over</span>
          </button>
        </div>

        <div className="footer-right-actions">
          <button
            type="button"
            className="btn btn-secondary"
            title="Confirm current clip sets across all included scenes"
            onClick={handleConfirmSelections}
            disabled={!isAllIncludedReady}
          >
            <CheckCircle2 size={16} />
            <span>Confirm Clip Sets</span>
          </button>

          <button
            type="button"
            className="btn btn-primary btn-generate-zip"
            title={
              !canProceedToPackaging()
                ? 'Every included scene must have six valid video clips before proceeding to export'
                : 'Proceed to ZIP file download and packaging'
            }
            onClick={handleGenerateZip}
            disabled={!canProceedToPackaging()}
          >
            <Package size={16} />
            <span>Generate ZIP</span>
          </button>
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
              Starting over will discard your current script, generated scenes, search queries, and
              selected video clips. Saved API keys and default settings will be preserved.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                title="Cancel and keep current selections"
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
