import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, X, Mic, Play, Pause, Check } from 'lucide-react';
import { VoiceOption } from './VoiceSearchSelect';

interface VoiceLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  voices: VoiceOption[];
  selectedVoiceId: string;
  onSelectVoice: (voiceId: string) => void;
  title?: string;
  isLoading?: boolean;
  providerName?: string;
}

export const VoiceLibraryModal: React.FC<VoiceLibraryModalProps> = ({
  isOpen,
  onClose,
  voices,
  selectedVoiceId,
  onSelectVoice,
  title = 'Voice Library',
  isLoading = false,
  providerName,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [genderFilter, setGenderFilter] = useState<'all' | 'male' | 'female'>('all');
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [visibleLimit, setVisibleLimit] = useState(60);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Stop audio playback when modal closes or unmounts
  useEffect(() => {
    if (!isOpen) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setPlayingVoiceId(null);
      setSearchQuery('');
      setGenderFilter('all');
      setVisibleLimit(60);
    }
  }, [isOpen]);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Filter voices live based on search text and gender filter
  const filteredVoices = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return voices.filter((v) => {
      // 1. Text Search (name, category, language, id)
      const matchesSearch =
        !query ||
        v.name.toLowerCase().includes(query) ||
        (v.category && v.category.toLowerCase().includes(query)) ||
        (v.language && v.language.toLowerCase().includes(query)) ||
        v.id.toLowerCase().includes(query);

      if (!matchesSearch) return false;

      // 2. Gender filter
      if (genderFilter === 'all') return true;

      const voiceGender = (v.gender || v.category || '').toLowerCase();
      if (genderFilter === 'male') {
        return voiceGender.includes('male') && !voiceGender.includes('female');
      }
      if (genderFilter === 'female') {
        return voiceGender.includes('female');
      }

      return true;
    });
  }, [voices, searchQuery, genderFilter]);

  const displayedVoices = useMemo(() => {
    return filteredVoices.slice(0, visibleLimit);
  }, [filteredVoices, visibleLimit]);

  const handlePlayPreview = (voice: VoiceOption) => {
    if (!voice.previewUrl) return;

    if (playingVoiceId === voice.id && audioRef.current) {
      if (audioRef.current.paused) {
        audioRef.current.play();
      } else {
        audioRef.current.pause();
        setPlayingVoiceId(null);
      }
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
    }

    const newAudio = new Audio(voice.previewUrl);
    audioRef.current = newAudio;
    setPlayingVoiceId(voice.id);

    newAudio.play().catch(() => {
      setPlayingVoiceId(null);
    });

    newAudio.onended = () => {
      setPlayingVoiceId(null);
    };
  };

  const handleSelect = (voiceId: string) => {
    onSelectVoice(voiceId);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="voice-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="voice-modal-content"
        onClick={(e) => e.stopPropagation()} // Prevent click inside from closing
      >
        {/* Header */}
        <div className="voice-modal-header">
          <div className="voice-modal-title-group">
            <div className="voice-modal-icon-wrap">
              <Mic size={20} />
            </div>
            <div>
              <h2 className="voice-modal-title">{title}</h2>
              <p className="voice-modal-subtitle">
                {providerName ? `${providerName} • ` : ''}
                {voices.length.toLocaleString()} voices available
              </p>
            </div>
          </div>
          <button
            type="button"
            className="voice-modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Toolbar: Search bar + Gender Filter Chips */}
        <div className="voice-modal-toolbar">
          <div className="voice-modal-search-box">
            <Search size={18} className="voice-modal-search-icon" />
            <input
              type="text"
              className="voice-modal-search-input"
              placeholder="Search voice by name, artist, language..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setVisibleLimit(60);
              }}
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                className="voice-modal-clear-btn"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <div className="voice-modal-gender-chips">
            <button
              type="button"
              className={`gender-chip ${genderFilter === 'all' ? 'active' : ''}`}
              onClick={() => {
                setGenderFilter('all');
                setVisibleLimit(60);
              }}
            >
              All
            </button>
            <button
              type="button"
              className={`gender-chip ${genderFilter === 'male' ? 'active' : ''}`}
              onClick={() => {
                setGenderFilter('male');
                setVisibleLimit(60);
              }}
            >
              Male
            </button>
            <button
              type="button"
              className={`gender-chip ${genderFilter === 'female' ? 'active' : ''}`}
              onClick={() => {
                setGenderFilter('female');
                setVisibleLimit(60);
              }}
            >
              Female
            </button>
          </div>
        </div>

        {/* Status Bar */}
        <div className="voice-modal-status-bar">
          <span className="voice-modal-stats-text">
            {isLoading
              ? 'Loading catalog voices...'
              : `Showing ${filteredVoices.length.toLocaleString()} voice${
                  filteredVoices.length === 1 ? '' : 's'
                }${searchQuery ? ` matching "${searchQuery}"` : ''}`}
          </span>
        </div>

        {/* Voice Grid Body */}
        <div className="voice-modal-body">
          {isLoading ? (
            <div className="voice-modal-empty-state">
              <div className="spinner" />
              <p>Loading voices, please wait...</p>
            </div>
          ) : filteredVoices.length === 0 ? (
            <div className="voice-modal-empty-state">
              <Mic size={36} className="text-muted" />
              <h3>No voices found</h3>
              <p>Try searching with a different artist name or reset the gender filter.</p>
              <button
                type="button"
                className="btn btn-secondary mt-2"
                onClick={() => {
                  setSearchQuery('');
                  setGenderFilter('all');
                }}
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <>
              <div className="voice-modal-grid">
                {displayedVoices.map((voice) => {
                  const isSelected = voice.id === selectedVoiceId;
                  const isPlaying = playingVoiceId === voice.id;

                  return (
                    <div
                      key={voice.id}
                      className={`voice-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleSelect(voice.id)}
                    >
                      <div className="voice-card-header">
                        <div className="voice-card-avatar">
                          {voice.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="voice-card-info">
                          <h4 className="voice-card-name" title={voice.name}>
                            {voice.name}
                          </h4>
                          <div className="voice-card-tags">
                            {voice.gender && (
                              <span className="voice-tag voice-tag-gender">
                                {voice.gender}
                              </span>
                            )}
                            {voice.language && (
                              <span className="voice-tag voice-tag-lang">
                                {voice.language}
                              </span>
                            )}
                            {voice.category && !voice.gender && (
                              <span className="voice-tag">{voice.category}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="voice-card-actions" onClick={(e) => e.stopPropagation()}>
                        {voice.previewUrl && (
                          <button
                            type="button"
                            className={`voice-card-play-btn ${isPlaying ? 'playing' : ''}`}
                            onClick={() => handlePlayPreview(voice)}
                            title={isPlaying ? 'Pause Sample' : 'Play Sample'}
                          >
                            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                            <span>{isPlaying ? 'Pause' : 'Sample'}</span>
                          </button>
                        )}
                        <button
                          type="button"
                          className={`voice-card-select-btn ${
                            isSelected ? 'btn-primary' : 'btn-outline'
                          }`}
                          onClick={() => handleSelect(voice.id)}
                        >
                          {isSelected ? (
                            <>
                              <Check size={14} /> Selected
                            </>
                          ) : (
                            'Select'
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {filteredVoices.length > visibleLimit && (
                <div className="voice-modal-load-more">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setVisibleLimit((prev) => prev + 60)}
                  >
                    Load More ({filteredVoices.length - visibleLimit} remaining)
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
