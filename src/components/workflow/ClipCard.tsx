import React, { useState, useRef } from 'react';
import { Play, Pause, ExternalLink, VideoOff, Download, Loader2 } from 'lucide-react';
import { ClipCandidate } from '../../types';
import { triggerBrowserDownload } from '../../services/zipBuilder';

interface ClipCardProps {
  candidate: ClipCandidate;
  candidateLabel?: string;
  rank?: number;
  isSelected?: boolean;
  onSelect?: () => void;
  isMainSelected?: boolean;
}

export const ClipCard: React.FC<ClipCardProps> = ({
  candidate,
  candidateLabel,
  rank,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isManuallyPlaying, setIsManuallyPlaying] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const displayLabel = candidate.candidateLabel || candidateLabel;

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDownloading) return;

    // Prefer highest quality/HD MP4 variant or previewVideoUrl
    const fileToDownload =
      candidate.files?.find((f) => f.quality === 'hd' || f.width >= 1920) ||
      candidate.files?.[0] ||
      (candidate.previewVideoUrl ? { url: candidate.previewVideoUrl } : null);

    const downloadUrl = fileToDownload?.url || candidate.previewVideoUrl;
    if (!downloadUrl) return;

    const labelSuffix = displayLabel ? `-${displayLabel}` : '';
    const filename = `clip-${candidate.pexelsVideoId}${labelSuffix}.mp4`;

    setIsDownloading(true);
    try {
      const response = await fetch(downloadUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      triggerBrowserDownload(objectUrl, filename);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch {
      // Direct navigation download fallback
      triggerBrowserDownload(downloadUrl, filename);
    } finally {
      setIsDownloading(false);
    }
  };

  const togglePlay = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    if (!candidate.previewVideoUrl || videoError) return;

    const video = videoRef.current;
    if (!video) return;

    if (!video.paused) {
      video.pause();
      setIsPlaying(false);
      setIsManuallyPlaying(false);
    } else {
      const playPromise = typeof video.play === 'function' ? video.play() : undefined;
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
            setIsManuallyPlaying(true);
          })
          .catch((err: unknown) => {
            const isAbort = err instanceof Error && err.name === 'AbortError';
            if (!isAbort) {
              setVideoError(true);
            }
            setIsPlaying(false);
            setIsManuallyPlaying(false);
          });
      } else {
        setIsPlaying(true);
        setIsManuallyPlaying(true);
      }
    }
  };

  const handleMouseEnter = () => {
    if (!candidate.previewVideoUrl || videoError) return;
    const video = videoRef.current;
    if (video && video.paused && !isManuallyPlaying) {
      const playPromise = typeof video.play === 'function' ? video.play() : undefined;
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
          })
          .catch(() => {
            // Autoplay on hover might be restricted or aborted; ignore silently
          });
      } else {
        setIsPlaying(true);
      }
    }
  };

  const handleMouseLeave = () => {
    if (!candidate.previewVideoUrl) return;
    const video = videoRef.current;
    if (video && !video.paused && !isManuallyPlaying) {
      video.pause();
      setIsPlaying(false);
    }
  };

  const handleVideoEnded = () => {
    setIsPlaying(false);
    setIsManuallyPlaying(false);
  };

  const handleVideoError = () => {
    setVideoError(true);
    setIsPlaying(false);
    setIsManuallyPlaying(false);
  };

  const formatResolution = () => {
    if (candidate.width >= 3840 || candidate.height >= 2160) return '4K';
    if (candidate.width >= 1920 || candidate.height >= 1080) return '1080p';
    if (candidate.width >= 1280 || candidate.height >= 720) return '720p';
    return `${candidate.width}x${candidate.height}`;
  };

  const orientationText = candidate.width >= candidate.height ? 'Landscape' : 'Portrait';

  return (
    <div
      className="clip-candidate-card"
      id={`clip-card-${candidate.id}`}
      aria-label={`Video clip ${displayLabel ? `Option ${displayLabel} ` : ''}by ${candidate.creatorName}, ${candidate.durationSeconds} seconds, ${orientationText}`}
    >
      {/* Video / Thumbnail Container */}
      <div
        className="clip-media-container"
        onClick={togglePlay}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        role="button"
        tabIndex={0}
        aria-label={`${isPlaying ? 'Pause' : 'Play'} video preview for ${displayLabel ? `Option ${displayLabel}` : 'clip'}`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            togglePlay();
          }
        }}
      >
        {candidate.previewVideoUrl && !videoError ? (
          <video
            ref={videoRef}
            src={candidate.previewVideoUrl}
            poster={candidate.previewImageUrl}
            className="clip-media-video"
            playsInline
            muted
            loop
            preload="metadata"
            onEnded={handleVideoEnded}
            onError={handleVideoError}
            onPlay={() => setIsPlaying(true)}
            onPause={() => {
              if (!isManuallyPlaying) {
                setIsPlaying(false);
              }
            }}
          />
        ) : (
          <img
            src={candidate.previewImageUrl}
            alt={`Clip preview from ${candidate.creatorName}`}
            className="clip-media-image"
            loading="lazy"
          />
        )}

        {/* Candidate Letter Badge (A-F) */}
        {displayLabel && (
          <div
            className="clip-candidate-label-badge"
            title={`Candidate ${displayLabel}${rank ? ` (Rank #${rank})` : ''}`}
            onClick={(e) => e.stopPropagation()}
          >
            <span>Option {displayLabel}</span>
          </div>
        )}

        {/* Play / Pause Toggle Button */}
        {candidate.previewVideoUrl && !videoError && (
          <button
            type="button"
            className={`clip-play-btn ${isPlaying ? 'playing' : ''}`}
            onClick={togglePlay}
            title={isPlaying ? 'Pause preview' : 'Play preview'}
            aria-label={isPlaying ? 'Pause video preview' : 'Play video preview'}
          >
            {isPlaying ? <Pause size={15} /> : <Play size={15} fill="currentColor" />}
          </button>
        )}

        {/* Quick download button at bottom left of media preview */}
        {candidate.previewVideoUrl && (
          <button
            type="button"
            className="clip-overlay-download-btn"
            onClick={handleDownload}
            disabled={isDownloading}
            title={isDownloading ? 'Downloading...' : `Download Option ${displayLabel || ''} clip`}
            aria-label={isDownloading ? 'Downloading...' : `Download Option ${displayLabel || ''} clip`}
          >
            {isDownloading ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
          </button>
        )}

        {videoError && (
          <div className="clip-playback-error-badge" title="Preview cannot play. Poster metadata intact.">
            <VideoOff size={14} />
            <span>Preview unavailable</span>
          </div>
        )}

        {/* Duration badge */}
        <span className="clip-duration-badge">{candidate.durationSeconds}s</span>
      </div>

      {/* Metadata & Controls */}
      <div className="clip-card-details">
        <div className="clip-card-tags">
          <span className={`badge-confidence confidence-${candidate.confidence}`}>
            {candidate.confidence.toUpperCase()}
          </span>
          <span className="clip-meta-tag">{formatResolution()}</span>
          <span className="clip-meta-tag">{orientationText}</span>
        </div>

        <div className="clip-card-footer">
          <button
            type="button"
            className="clip-download-btn"
            onClick={handleDownload}
            disabled={isDownloading}
            title={isDownloading ? 'Downloading clip...' : `Download ${displayLabel ? `Option ${displayLabel}` : 'video clip'}`}
            aria-label={`Download ${displayLabel ? `Option ${displayLabel}` : 'video clip'}`}
          >
            {isDownloading ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                <span>Downloading...</span>
              </>
            ) : (
              <>
                <Download size={12} />
                <span>Download</span>
              </>
            )}
          </button>

          {/* Attribution link to Pexels & Creator */}
          <div className="clip-attribution">
            <span className="attribution-text">By </span>
            <a
              href={candidate.creatorUrl || candidate.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="attribution-link"
              title={`View ${candidate.creatorName}'s profile`}
              onClick={(e) => e.stopPropagation()}
            >
              {candidate.creatorName}
            </a>
            <span className="attribution-text"> on </span>
            <a
              href={candidate.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="attribution-link pexels-link"
              title="View video on Pexels"
              onClick={(e) => e.stopPropagation()}
            >
              <span>Pexels</span>
              <ExternalLink size={10} className="external-icon" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
