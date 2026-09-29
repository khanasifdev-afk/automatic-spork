import React, { useState } from 'react';
import {
  Search,
  RefreshCw,
  EyeOff,
  Eye,
  AlertCircle,
  Film,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { Scene, SceneSearchState } from '../../types';
import { ClipCard } from './ClipCard';

interface SceneClipsCardProps {
  scene: Scene;
  searchState?: SceneSearchState;
  isExcluded: boolean;
  selectedClipIds?: string[];
  onToggleSelectClip?: (candidateId: string) => void;
  onSelectAllClips?: () => void;
  onDeselectAllClips?: () => void;
  onSelectCandidate?: (candidateId: string) => void;
  onReSearch: (customQuery: string) => void;
  onExcludeScene: () => void;
  onRestoreScene: () => void;
}

export const SceneClipsCard: React.FC<SceneClipsCardProps> = ({
  scene,
  searchState,
  isExcluded,
  selectedClipIds,
  onToggleSelectClip,
  onSelectAllClips,
  onDeselectAllClips,
  onReSearch,
  onExcludeScene,
  onRestoreScene,
}) => {
  const currentQuery = searchState?.query || scene.primaryQuery;
  const [queryInput, setQueryInput] = useState(currentQuery);
  const [isEditingQuery, setIsEditingQuery] = useState(false);

  const status = searchState?.status || 'idle';
  const candidates = searchState?.candidates || [];

  const handleQuerySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (queryInput.trim()) {
      setIsEditingQuery(false);
      onReSearch(queryInput.trim());
    }
  };

  const handleCancelEdit = () => {
    setQueryInput(currentQuery);
    setIsEditingQuery(false);
  };

  return (
    <div
      className={`scene-clips-card card ${isExcluded ? 'is-excluded' : ''}`}
      id={`scene-clips-${scene.id}`}
    >
      {/* Scene Header */}
      <div className="scene-clips-header">
        <div className="scene-number-pill">
          <span>Scene {scene.sequence}</span>
        </div>

        <div className="scene-clips-header-meta">
          <span className="scene-segment-badge font-mono text-xs">
            Segment {String(scene.sequence).padStart(3, '0')}
          </span>
          <span className="scene-audio-ref-badge font-mono text-xs text-muted">
            Audio: {String(scene.sequence).padStart(3, '0')}.mp3
          </span>
          <span className="scene-timing-tag">~{scene.estimatedSeconds}s</span>
        </div>

        <div className="scene-clips-header-actions">
          {isExcluded ? (
            <button
              type="button"
              className="btn btn-secondary btn-sm btn-restore-scene"
              title="Restore this scene so it is included in video generation"
              onClick={onRestoreScene}
            >
              <Eye size={15} />
              <span>Restore Scene</span>
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-secondary btn-sm btn-exclude-scene"
              title="Exclude this scene from stock video search and packaging"
              onClick={onExcludeScene}
            >
              <EyeOff size={15} />
              <span>Exclude</span>
            </button>
          )}
        </div>
      </div>

      {/* Script narration & visual description */}
      <div className="scene-clips-content">
        <div className="scene-script-quote">
          <span className="quote-label">Narration:</span>
          <p className="quote-text">"{scene.scriptText}"</p>
        </div>

        {scene.visualDescription && (
          <div className="scene-visual-cue">
            <Sparkles size={14} className="visual-icon" />
            <span className="visual-text">{scene.visualDescription}</span>
          </div>
        )}
      </div>

      {/* Excluded Scene Notice */}
      {isExcluded ? (
        <div className="scene-excluded-notice">
          <EyeOff size={18} className="excluded-icon" />
          <div className="excluded-text">
            <strong>Scene Excluded</strong>
            <p>This scene is excluded from video discovery and will not be included in the final export.</p>
          </div>
        </div>
      ) : (
        <>
          {/* Query Bar */}
          <div className="scene-query-bar">
            {isEditingQuery ? (
              <form onSubmit={handleQuerySubmit} className="query-edit-form">
                <input
                  type="text"
                  className="input query-edit-input"
                  value={queryInput}
                  onChange={(e) => setQueryInput(e.target.value)}
                  placeholder="Enter custom search query..."
                  autoFocus
                />
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={!queryInput.trim() || status === 'searching'}
                >
                  <Search size={14} />
                  <span>Search</span>
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleCancelEdit}
                >
                  Cancel
                </button>
              </form>
            ) : (
              <div className="query-display-wrap">
                <div className="query-pill">
                  <Search size={14} className="query-icon" />
                  <span className="query-label">Search Query:</span>
                  <span className="query-value">"{currentQuery}"</span>
                </div>
                <div className="query-actions">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    title="Change search query for this scene"
                    onClick={() => {
                      setQueryInput(currentQuery);
                      setIsEditingQuery(true);
                    }}
                    disabled={status === 'searching'}
                  >
                    Edit Query
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    title="Re-run search for this scene"
                    onClick={() => onReSearch(currentQuery)}
                    disabled={status === 'searching'}
                  >
                    <RefreshCw size={13} className={status === 'searching' ? 'animate-spin' : ''} />
                    <span>Search Again</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Search State: Loading */}
          {status === 'searching' && (
            <div className="scene-state-loading">
              <Loader2 size={28} className="spinner-icon animate-spin" />
              <span>Searching Pexels for stock video clips...</span>
            </div>
          )}

          {/* Search State: Error */}
          {status === 'error' && (
            <div className="scene-state-error alert alert-error">
              <AlertCircle size={18} className="alert-icon" />
              <div className="alert-content">
                <div className="alert-title">Search Failed</div>
                <p className="alert-message">
                  {searchState?.error || 'Could not retrieve video results from Pexels.'}
                </p>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm retry-btn"
                  onClick={() => onReSearch(currentQuery)}
                >
                  <RefreshCw size={13} />
                  <span>Retry Search</span>
                </button>
              </div>
            </div>
          )}

          {/* Search State: Empty or Incomplete */}
          {status === 'empty' && (
            <div className="scene-state-empty alert alert-warning">
              <Film size={28} className="empty-icon text-muted" />
              <div className="empty-content">
                <div className="alert-title">
                  {candidates.length > 0 ? 'Incomplete Clip Set' : 'No matching clips found'}
                </div>
                <p className="alert-message">
                  {searchState?.error ||
                    (candidates.length > 0
                      ? `Only ${candidates.length} usable clips were found (6 required). Try editing your search query or retry search.`
                      : `Pexels did not return any usable clips matching "${currentQuery}". Try editing your query.`)}
                </p>
                <div className="empty-actions mt-2 flex gap-2">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setQueryInput(currentQuery);
                      setIsEditingQuery(true);
                    }}
                  >
                    Edit Query
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm retry-btn"
                    onClick={() => onReSearch(currentQuery)}
                  >
                    <RefreshCw size={13} />
                    <span>Retry Search</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Search State: Idle (Not searched yet) */}
          {status === 'idle' && (
            <div className="scene-state-idle">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => onReSearch(currentQuery)}
              >
                <Search size={14} />
                <span>Search Clips for Scene {scene.sequence}</span>
              </button>
            </div>
          )}

          {/* Fallback Option Applied: Image replacement */}
          {searchState?.isFallbackToImage && (
            <div className="scene-fallback-image-notice alert alert-info mb-3">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-primary" />
                <span className="font-semibold text-sm">
                  Stock Video Unavailable — Replaced with Contextual High-Quality Images
                </span>
              </div>
              <p className="text-xs text-muted mt-1">
                No unique stock video clips were available for this 2.5s segment. Contextually relevant stock images have been retrieved below as the visual fallback.
              </p>
            </div>
          )}

          {/* Search State: Ready with Candidates (1 to 6) */}
          {status === 'ready' && candidates.length > 0 && (
            <div className="scene-candidates-wrapper">
              <div className="scene-clips-grid-header mb-2 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <h4 className="section-label font-medium text-sm">
                    {candidates.length === 6
                      ? 'Ranked Video Options (6 Candidates A–F):'
                      : candidates.length === 1
                      ? 'Ranked Video Option (1 Candidate A):'
                      : `Ranked Video Options (${candidates.length} Candidates A–${(['A', 'B', 'C', 'D', 'E', 'F'] as const)[candidates.length - 1]}):`}
                  </h4>
                  <span className="badge badge-subtle selection-count-badge">
                    {selectedClipIds
                      ? `${candidates.slice(0, 6).filter((c) => selectedClipIds.includes(c.id)).length} of ${candidates.length} selected`
                      : `${candidates.length} of ${candidates.length} selected`}
                  </span>
                </div>
                {(onSelectAllClips || onDeselectAllClips) && (
                  <div className="selection-actions-bar flex items-center gap-2">
                    {onSelectAllClips && (
                      <button
                        type="button"
                        className="btn btn-xs btn-outline"
                        onClick={onSelectAllClips}
                        title={`Select all ${candidates.length} video clips for export`}
                      >
                        Select All
                      </button>
                    )}
                    {onDeselectAllClips && (
                      <button
                        type="button"
                        className="btn btn-xs btn-outline"
                        onClick={onDeselectAllClips}
                        title="Deselect all clips"
                      >
                        Deselect All
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="scene-all-clips-grid">
                {candidates.slice(0, 6).map((candidate, idx) => {
                  const isSelected = selectedClipIds ? selectedClipIds.includes(candidate.id) : true;
                  return (
                    <ClipCard
                      key={candidate.id}
                      candidate={candidate}
                      candidateLabel={candidate.candidateLabel || (['A', 'B', 'C', 'D', 'E', 'F'] as const)[idx]}
                      rank={idx + 1}
                      isSelected={isSelected}
                      onSelect={onToggleSelectClip ? () => onToggleSelectClip(candidate.id) : undefined}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
