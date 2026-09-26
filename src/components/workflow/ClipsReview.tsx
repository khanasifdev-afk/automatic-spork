import React, { useEffect, useState, useTransition } from 'react';
import {
  Film,
  Image,
  CheckCircle2,
  EyeOff,
  ArrowLeft,
  RotateCcw,
  Package,
  AlertTriangle,
  RefreshCw,
  Settings,
  Loader2,
  XCircle,
  Search,
  Download,
  ExternalLink,
} from 'lucide-react';
import { Scene, WorkflowOptions, SceneSearchState, ImageSearchState, ImageCandidate, StockMediaType } from '../../types';
import { SceneClipsCard } from './SceneClipsCard';
import { triggerBrowserDownload } from '../../services/zipBuilder';

interface ClipsReviewProps {
  scenes: Scene[];
  options: WorkflowOptions;
  searchStateByScene: Record<string, SceneSearchState>;
  imageSearchStateByScene?: Record<string, ImageSearchState>;
  excludedSceneIds: string[];
  pexelsApiKey: string;
  onSearchAll: (apiKey: string) => Promise<void>;
  onSearchScene: (sceneId: string, apiKey: string, customQuery?: string) => Promise<void>;
  onSearchAllImages?: (apiKey: string) => Promise<void>;
  onSearchSceneImages?: (sceneId: string, apiKey: string, customQuery?: string) => Promise<void>;
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
  imageSearchStateByScene = {},
  excludedSceneIds,
  pexelsApiKey,
  onSearchAll,
  onSearchScene,
  onSearchAllImages,
  onSearchSceneImages,
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

  const stockMediaType: StockMediaType = options.stockMediaType ?? 'videos';
  const needsVideos = stockMediaType === 'videos' || stockMediaType === 'both';
  const needsImages = stockMediaType === 'images' || stockMediaType === 'both';

  const includedScenes = scenes.filter((s) => !excludedSceneIds.includes(s.id));
  const readyScenesCount = includedScenes.filter((s) => {
    const st = searchStateByScene[s.id];
    return st && st.status === 'ready' && Array.isArray(st.candidates) && st.candidates.length === 6;
  }).length;

  const isAllIncludedReady =
    includedScenes.length > 0 && readyScenesCount === includedScenes.length;

  const hasApiKey = Boolean(pexelsApiKey.trim());

  // Auto-search on first mount
  useEffect(() => {
    if (!hasAutoSearched && hasApiKey && scenes.length > 0) {
      const needsVideoSearch = needsVideos && scenes.some(
        (s) => !searchStateByScene[s.id] || searchStateByScene[s.id].status === 'idle'
      );
      const needsImageSearch = needsImages && onSearchAllImages && scenes.some(
        (s) => !imageSearchStateByScene[s.id] || imageSearchStateByScene[s.id].status === 'idle'
      );
      if (needsVideoSearch || needsImageSearch) {
        setHasAutoSearched(true);
        startTransition(() => {
          if (needsVideoSearch) onSearchAll(pexelsApiKey);
          if (needsImageSearch && onSearchAllImages) onSearchAllImages(pexelsApiKey);
        });
      }
    }
  }, [hasAutoSearched, hasApiKey, scenes, searchStateByScene, imageSearchStateByScene,
      onSearchAll, onSearchAllImages, pexelsApiKey, needsVideos, needsImages]);

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
          <h2 className="clips-review-title">
            {stockMediaType === 'videos' ? 'Stock Video Review' : 'Stock Media Review'}
          </h2>
          <div className="clips-summary-badges">
            <span className="summary-badge">
              <Film size={15} />
              <span>{scenes.length} Total Scenes</span>
            </span>
            {needsVideos && (
              <span className="summary-badge">
                <CheckCircle2 size={15} className="text-success" />
                <span>
                  {readyScenesCount} of {includedScenes.length} {stockMediaType === 'videos' ? 'Ready (6 Clips Each)' : 'Videos Ready'}
                </span>
              </span>
            )}
            {needsImages && (
              <span className="summary-badge" style={{ color: 'var(--color-primary)' }}>
                <Image size={15} />
                <span>
                  {includedScenes.filter((s) => imageSearchStateByScene[s.id]?.status === 'ready').length} of {includedScenes.length} Images Ready
                </span>
              </span>
            )}
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
          {hasApiKey && needsVideos && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              title="Search Pexels footage for all unsearched or pending scenes"
              onClick={() => onSearchAll(pexelsApiKey)}
            >
              <RefreshCw size={14} />
              <span>Search All Videos</span>
            </button>
          )}
          {hasApiKey && needsImages && onSearchAllImages && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              title="Search Pexels images for all scenes"
              onClick={() => onSearchAllImages(pexelsApiKey)}
            >
              <Image size={14} />
              <span>Search All Images</span>
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
        Review stock media from Pexels for each scene.
        {needsVideos && ' Six video clips (A–F) are provided per scene.'}
        {needsImages && ' Up to five still images are shown per scene.'}
        {' '}You can re-search, preview, or exclude scenes before export.
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
              You must configure a valid Pexels API key in Settings before stock media can be retrieved.
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
          <div key={scene.id} className="scene-media-block">
            {/* Video clips section */}
            {needsVideos && (
              <SceneClipsCard
                scene={scene}
                searchState={searchStateByScene[scene.id]}
                isExcluded={excludedSceneIds.includes(scene.id)}
                onReSearch={(customQuery) => onSearchScene(scene.id, pexelsApiKey, customQuery)}
                onExcludeScene={() => onExcludeScene(scene.id)}
                onRestoreScene={() => onRestoreScene(scene.id)}
              />
            )}

            {/* Image results section */}
            {needsImages && !excludedSceneIds.includes(scene.id) && (
              <ImageResultsCard
                scene={scene}
                imageState={imageSearchStateByScene[scene.id]}
                onReSearch={(customQuery) => onSearchSceneImages?.(scene.id, pexelsApiKey, customQuery)}
              />
            )}
          </div>
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
          {needsVideos && (
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
          )}

          <button
            type="button"
            className="btn btn-primary btn-generate-zip"
            title={
              !canProceedToPackaging()
                ? 'Every included scene must have valid media before proceeding to export'
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

// ---------------------------------------------------------------------------
// ImageResultsCard — shows fetched still images for a single scene
// ---------------------------------------------------------------------------

interface ImageResultsCardProps {
  scene: Scene;
  imageState: ImageSearchState | undefined;
  onReSearch: (customQuery?: string) => void;
}

const ImageResultsCard: React.FC<ImageResultsCardProps> = ({ scene, imageState, onReSearch }) => {
  const [editingQuery, setEditingQuery] = useState(false);
  const [draftQuery, setDraftQuery] = useState('');
  const [lightboxCandidate, setLightboxCandidate] = useState<{
    candidate: ImageCandidate;
    label: string;
  } | null>(null);

  const status = imageState?.status ?? 'idle';
  const candidates = imageState?.candidates ?? [];
  const query = imageState?.query ?? scene.primaryQuery;

  const handleStartEdit = () => {
    setDraftQuery(query);
    setEditingQuery(true);
  };

  const handleSubmitQuery = (e: React.FormEvent) => {
    e.preventDefault();
    setEditingQuery(false);
    onReSearch(draftQuery.trim() || query);
  };

  return (
    <div className="image-results-card">
      {/* Card header */}
      <div className="image-results-header">
        <div className="image-results-title-row">
          <Image size={15} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
          <span className="image-results-label">
            Scene {scene.sequence} — Stock Images
          </span>
          <span className={`image-status-badge status-${status}`}>
            {status === 'searching' && <Loader2 size={12} className="bulk-spinner" />}
            {status === 'ready' && <CheckCircle2 size={12} />}
            {status === 'error' && <XCircle size={12} />}
            <span>
              {status === 'idle' && 'Not searched'}
              {status === 'searching' && 'Searching…'}
              {status === 'ready' && `${candidates.length} image${candidates.length !== 1 ? 's' : ''} found`}
              {status === 'empty' && 'No results'}
              {status === 'error' && 'Search failed'}
            </span>
          </span>
        </div>

        {/* Query row */}
        <div className="image-query-row">
          {editingQuery ? (
            <form onSubmit={handleSubmitQuery} className="image-query-form">
              <input
                type="text"
                className="form-input image-query-input"
                value={draftQuery}
                onChange={(e) => setDraftQuery(e.target.value)}
                autoFocus
                placeholder="Enter search query…"
              />
              <button type="submit" className="btn btn-primary btn-sm">
                <Search size={13} />
                <span>Search</span>
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditingQuery(false)}>
                Cancel
              </button>
            </form>
          ) : (
            <div className="image-query-display">
              <span className="image-query-text">"{query}"</span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleStartEdit}
                title="Edit search query"
              >
                Edit Query
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => onReSearch(query)}
                title="Re-search with current query"
              >
                <RefreshCw size={13} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Image grid */}
      {status === 'searching' && (
        <div className="image-searching-placeholder">
          <Loader2 size={22} className="bulk-spinner" style={{ color: 'var(--color-primary)' }} />
          <span>Fetching images from Pexels…</span>
        </div>
      )}

      {status === 'error' && imageState?.error && (
        <p className="image-error-text">{imageState.error}</p>
      )}

      {(status === 'ready' || status === 'empty') && (
        <div className="image-candidates-grid">
          {candidates.length === 0 ? (
            <p className="image-no-results">No images found. Try editing the search query above.</p>
          ) : (
            candidates.map((candidate, idx) => {
              const label = candidate.candidateLabel || String.fromCharCode(65 + idx);
              const formatResolution = (w: number, h: number) => {
                if (w >= 3840 || h >= 2160) return '4K';
                if (w >= 1920 || h >= 1080) return '1080p';
                if (w >= 1280 || h >= 720) return '720p';
                return `${w}×${h}`;
              };
              const orientationText = candidate.width >= candidate.height ? 'Landscape' : 'Portrait';

              const handleDownloadImage = async (e: React.MouseEvent) => {
                e.stopPropagation();
                const downloadUrl = candidate.previewImageUrl || candidate.files[0]?.url;
                if (!downloadUrl) return;
                const filename = `image-${candidate.pexelsPhotoId}-${label}.jpg`;
                try {
                  const response = await fetch(downloadUrl);
                  if (!response.ok) throw new Error(`HTTP ${response.status}`);
                  const blob = await response.blob();
                  const objectUrl = URL.createObjectURL(blob);
                  triggerBrowserDownload(objectUrl, filename);
                  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
                } catch {
                  triggerBrowserDownload(downloadUrl, filename);
                }
              };

              const handleOpenExternal = (e: React.MouseEvent) => {
                e.stopPropagation();
                const downloadUrl = candidate.previewImageUrl || candidate.sourceUrl;
                if (downloadUrl) {
                  window.open(downloadUrl, '_blank', 'noopener,noreferrer');
                }
              };

              return (
                <div key={candidate.pexelsPhotoId} className="clip-candidate-card" id={`image-card-${candidate.pexelsPhotoId}`}>
                  <div
                    className="clip-media-container"
                    style={{ aspectRatio: candidate.width >= candidate.height ? '16 / 9' : '9 / 16', cursor: 'pointer' }}
                    onClick={() => setLightboxCandidate({ candidate, label })}
                    title={`Click to view full image (Option ${label})`}
                  >
                    <img
                      src={candidate.previewImageUrl}
                      alt={`Image Option ${label} by ${candidate.creatorName}`}
                      className="clip-media-image"
                      loading="lazy"
                    />
                    <div className="clip-candidate-label-badge" title={`Option ${label}`}>
                      <span>Option {label}</span>
                    </div>
                    <button
                      type="button"
                      className="clip-overlay-download-btn"
                      onClick={handleDownloadImage}
                      title={`Download Option ${label} image`}
                      aria-label={`Download Option ${label} image`}
                    >
                      <Download size={12} />
                    </button>
                  </div>

                  <div className="clip-card-details">
                    <div className="clip-card-tags">
                      <span className={`badge-confidence confidence-${candidate.confidence || 'fair'}`}>
                        {(candidate.confidence || 'fair').toUpperCase()}
                      </span>
                      <span className="clip-meta-tag">{formatResolution(candidate.width, candidate.height)}</span>
                      <span className="clip-meta-tag">{orientationText}</span>
                    </div>
                    <div className="clip-creator-info">
                      <a
                        href={candidate.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="clip-creator-link"
                        onClick={handleOpenExternal}
                        title={`View photo by ${candidate.creatorName} on Pexels`}
                      >
                        <ExternalLink size={12} />
                        <span>{candidate.creatorName}</span>
                      </a>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Image Lightbox Modal */}
      {lightboxCandidate && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => setLightboxCandidate(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999,
            padding: '1.5rem',
          }}
        >
          <div
            className="modal-box"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '850px',
              width: '100%',
              background: 'var(--color-bg-card)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.5rem',
              boxShadow: 'var(--shadow-xl)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1rem',
                borderBottom: '1px solid var(--color-border)',
                paddingBottom: '0.75rem',
              }}
            >
              <h3 className="modal-title" style={{ margin: 0, fontSize: 'var(--font-size-base)', fontWeight: 600 }}>
                Scene {scene.sequence} — Option {lightboxCandidate.label} Preview
              </h3>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setLightboxCandidate(null)}
              >
                Close
              </button>
            </div>

            <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
              <img
                src={lightboxCandidate.candidate.previewImageUrl}
                alt={`Option ${lightboxCandidate.label}`}
                style={{
                  maxWidth: '100%',
                  maxHeight: '65vh',
                  objectFit: 'contain',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--shadow-md)',
                }}
              />
              <p style={{ marginTop: '0.75rem', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', margin: 0 }}>
                {lightboxCandidate.candidate.width} × {lightboxCandidate.candidate.height} · Photo by {lightboxCandidate.candidate.creatorName}
              </p>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: '1.25rem',
                paddingTop: '0.75rem',
                borderTop: '1px solid var(--color-border)',
              }}
            >
              <a
                href={lightboxCandidate.candidate.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary btn-sm"
              >
                <ExternalLink size={14} />
                <span>View on Pexels ↗</span>
              </a>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  const url = lightboxCandidate.candidate.previewImageUrl;
                  const filename = `image-${lightboxCandidate.candidate.pexelsPhotoId}-${lightboxCandidate.label}.jpg`;
                  triggerBrowserDownload(url, filename);
                }}
              >
                <Download size={14} />
                <span>Download Photo</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
