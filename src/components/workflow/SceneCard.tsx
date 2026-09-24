import React, { useState } from 'react';
import {
  ArrowUp,
  ArrowDown,
  Scissors,
  Merge,
  Trash2,
  Clock,
  Search,
  Eye,
  AlertTriangle,
  Tag,
  Ban,
  Check,
  Edit2,
} from 'lucide-react';
import { Scene } from '../../types';
import { SceneSplitModal } from './SceneSplitModal';

interface SceneCardProps {
  scene: Scene;
  totalScenes: number;
  onEdit: (id: string, updates: Partial<Omit<Scene, 'id' | 'sequence'>>) => boolean;
  onSplit: (id: string, firstText: string, secondText: string) => boolean;
  onMerge: (firstId: string, secondId: string) => boolean;
  onDelete: (id: string) => boolean;
  onMove: (id: string, direction: 'up' | 'down') => boolean;
  previousSceneId?: string;
  nextSceneId?: string;
}

export const SceneCard: React.FC<SceneCardProps> = ({
  scene,
  totalScenes,
  onEdit,
  onSplit,
  onMerge,
  onDelete,
  onMove,
  previousSceneId,
  nextSceneId,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Local edit states
  const [scriptText, setScriptText] = useState(scene.scriptText);
  const [visualDescription, setVisualDescription] = useState(scene.visualDescription);
  const [primaryQuery, setPrimaryQuery] = useState(scene.primaryQuery);
  const [fallbackQueriesStr, setFallbackQueriesStr] = useState(scene.fallbackQueries.join(', '));
  const [avoidTermsStr, setAvoidTermsStr] = useState(scene.avoidTerms.join(', '));
  const [estimatedSeconds, setEstimatedSeconds] = useState(scene.estimatedSeconds);
  const [editError, setEditError] = useState<string | null>(null);

  const handleSaveEdits = () => {
    if (!scriptText.trim()) {
      setEditError('Script text cannot be empty.');
      return;
    }
    if (!visualDescription.trim()) {
      setEditError('Visual description cannot be empty.');
      return;
    }
    if (!primaryQuery.trim()) {
      setEditError('Primary query cannot be empty.');
      return;
    }

    const fallbacks = fallbackQueriesStr
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 2);

    const avoid = avoidTermsStr
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const success = onEdit(scene.id, {
      scriptText: scriptText.trim(),
      visualDescription: visualDescription.trim(),
      primaryQuery: primaryQuery.trim(),
      fallbackQueries: fallbacks,
      avoidTerms: avoid,
      estimatedSeconds: Math.max(2, Math.round(Number(estimatedSeconds) || 5)),
    });

    if (success) {
      setIsEditing(false);
      setEditError(null);
    }
  };

  const handleCancelEdits = () => {
    setScriptText(scene.scriptText);
    setVisualDescription(scene.visualDescription);
    setPrimaryQuery(scene.primaryQuery);
    setFallbackQueriesStr(scene.fallbackQueries.join(', '));
    setAvoidTermsStr(scene.avoidTerms.join(', '));
    setEstimatedSeconds(scene.estimatedSeconds);
    setEditError(null);
    setIsEditing(false);
  };

  return (
    <>
      <div className={`scene-card ${isEditing ? 'scene-card-editing' : ''}`} data-scene-id={scene.id}>
        {/* Card Header */}
        <div className="scene-card-header">
          <div className="scene-badge-wrap">
            <span className="scene-number-badge">Scene {scene.sequence}</span>
            <span className="scene-duration-pill">
              <Clock size={13} />
              <span>{scene.estimatedSeconds}s</span>
            </span>
          </div>

          <div className="scene-card-actions">
            {/* Move buttons */}
            <div className="scene-move-buttons" role="group" aria-label="Scene Order">
              <button
                type="button"
                className="scene-action-btn"
                title="Move scene up"
                aria-label={`Move scene ${scene.sequence} up`}
                disabled={scene.sequence <= 1 || isEditing}
                onClick={() => onMove(scene.id, 'up')}
              >
                <ArrowUp size={14} />
                <span>Up</span>
              </button>
              <button
                type="button"
                className="scene-action-btn"
                title="Move scene down"
                aria-label={`Move scene ${scene.sequence} down`}
                disabled={scene.sequence >= totalScenes || isEditing}
                onClick={() => onMove(scene.id, 'down')}
              >
                <ArrowDown size={14} />
                <span>Down</span>
              </button>
            </div>

            {/* Edit toggle */}
            {!isEditing && (
              <button
                type="button"
                className="scene-action-btn"
                title="Edit scene fields"
                aria-label={`Edit scene ${scene.sequence}`}
                onClick={() => setIsEditing(true)}
              >
                <Edit2 size={14} />
                <span>Edit</span>
              </button>
            )}

            {/* Split */}
            <button
              type="button"
              className="scene-action-btn"
              title="Split scene into two"
              aria-label={`Split scene ${scene.sequence}`}
              disabled={isEditing}
              onClick={() => setShowSplitModal(true)}
            >
              <Scissors size={14} />
              <span>Split</span>
            </button>

            {/* Merge Up (previous) */}
            {previousSceneId && (
              <button
                type="button"
                className="scene-action-btn"
                title={`Merge with Scene ${scene.sequence - 1}`}
                aria-label={`Merge scene ${scene.sequence} with previous`}
                disabled={isEditing}
                onClick={() => onMerge(previousSceneId, scene.id)}
              >
                <Merge size={14} style={{ transform: 'rotate(180deg)' }} />
                <span>Merge Up</span>
              </button>
            )}

            {/* Merge Down (next) */}
            {nextSceneId && (
              <button
                type="button"
                className="scene-action-btn"
                title={`Merge with Scene ${scene.sequence + 1}`}
                aria-label={`Merge scene ${scene.sequence} with next`}
                disabled={isEditing}
                onClick={() => onMerge(scene.id, nextSceneId)}
              >
                <Merge size={14} />
                <span>Merge Down</span>
              </button>
            )}

            {/* Delete */}
            <button
              type="button"
              className="scene-action-btn scene-action-btn-danger"
              title="Delete scene"
              aria-label={`Delete scene ${scene.sequence}`}
              disabled={isEditing}
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 size={14} />
              <span>Delete</span>
            </button>
          </div>
        </div>

        {/* Card Body */}
        <div className="scene-card-body">
          {editError && (
            <div className="field-error-text" style={{ marginBottom: '0.75rem' }}>
              {editError}
            </div>
          )}

          {isEditing ? (
            /* Editing Mode */
            <div className="scene-edit-form">
              <div className="edit-field-group">
                <label className="edit-field-label">Script Narration Text</label>
                <textarea
                  className="edit-field-textarea"
                  rows={3}
                  value={scriptText}
                  onChange={(e) => setScriptText(e.target.value)}
                />
              </div>

              <div className="edit-field-group">
                <label className="edit-field-label">Visual Description (Gemini)</label>
                <textarea
                  className="edit-field-textarea"
                  rows={2}
                  value={visualDescription}
                  onChange={(e) => setVisualDescription(e.target.value)}
                />
              </div>

              <div className="edit-grid-row">
                <div className="edit-field-group">
                  <label className="edit-field-label">Primary Pexels Query</label>
                  <input
                    type="text"
                    className="edit-field-input"
                    value={primaryQuery}
                    onChange={(e) => setPrimaryQuery(e.target.value)}
                  />
                </div>

                <div className="edit-field-group">
                  <label className="edit-field-label">Estimated Duration (seconds)</label>
                  <input
                    type="number"
                    min={2}
                    max={60}
                    className="edit-field-input"
                    value={estimatedSeconds}
                    onChange={(e) => setEstimatedSeconds(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="edit-grid-row">
                <div className="edit-field-group">
                  <label className="edit-field-label">Fallback Queries (comma separated, max 2)</label>
                  <input
                    type="text"
                    className="edit-field-input"
                    value={fallbackQueriesStr}
                    placeholder="e.g. outdoor walk, active senior"
                    onChange={(e) => setFallbackQueriesStr(e.target.value)}
                  />
                </div>

                <div className="edit-field-group">
                  <label className="edit-field-label">Avoid Terms (comma separated)</label>
                  <input
                    type="text"
                    className="edit-field-input"
                    value={avoidTermsStr}
                    placeholder="e.g. wheelchair, hospital"
                    onChange={(e) => setAvoidTermsStr(e.target.value)}
                  />
                </div>
              </div>

              <div className="scene-edit-actions">
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  title="Cancel editing and discard unsaved changes"
                  onClick={handleCancelEdits}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  title="Save changes to this scene"
                  onClick={handleSaveEdits}
                >
                  <Check size={14} />
                  <span>Save Changes</span>
                </button>
              </div>
            </div>
          ) : (
            /* View Mode */
            <div className="scene-view-content">
              {/* Script Text */}
              <div className="scene-script-text">
                <p>"{scene.scriptText}"</p>
              </div>

              {/* Visual Description */}
              <div className="scene-visual-meta">
                <div className="meta-row">
                  <Eye size={15} className="meta-icon text-muted" />
                  <span className="meta-label">Visual:</span>
                  <span className="meta-value">{scene.visualDescription}</span>
                </div>

                {/* Primary Query */}
                <div className="meta-row">
                  <Search size={15} className="meta-icon text-primary" />
                  <span className="meta-label">Pexels Query:</span>
                  <span className="meta-query-tag">{scene.primaryQuery}</span>
                </div>

                {/* Fallbacks & Avoid Terms */}
                {(scene.fallbackQueries.length > 0 || scene.avoidTerms.length > 0) && (
                  <div className="meta-tags-row">
                    {scene.fallbackQueries.map((q, idx) => (
                      <span key={idx} className="meta-tag meta-tag-fallback" title="Fallback search query">
                        <Tag size={12} />
                        <span>{q}</span>
                      </span>
                    ))}
                    {scene.avoidTerms.map((term, idx) => (
                      <span key={idx} className="meta-tag meta-tag-avoid" title="Avoid term">
                        <Ban size={12} />
                        <span>{term}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Split Modal */}
      {showSplitModal && (
        <SceneSplitModal
          scene={scene}
          onConfirm={(part1, part2) => {
            onSplit(scene.id, part1, part2);
            setShowSplitModal(false);
          }}
          onClose={() => setShowSplitModal(false)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-box">
            <div className="modal-header">
              <div className="modal-icon-wrap icon-danger">
                <AlertTriangle size={20} />
              </div>
              <h3 className="modal-title">Delete Scene {scene.sequence}?</h3>
            </div>
            <p className="modal-body">
              Are you sure you want to delete this scene? All associated query terms and duration estimates will be removed. Remaining scenes will be automatically renumbered.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                title="Cancel deletion and keep scene"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                title="Confirm deletion of this scene"
                onClick={() => {
                  onDelete(scene.id);
                  setShowDeleteConfirm(false);
                }}
              >
                Delete Scene
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
