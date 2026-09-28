import React, { useState, useMemo } from 'react';
import { Search, X, Mic, AlertTriangle, LayoutGrid } from 'lucide-react';
import { VoiceLibraryModal } from './VoiceLibraryModal';

export interface VoiceOption {
  id: string;
  name: string;
  category?: string;
  previewUrl?: string;
  gender?: string;
  language?: string;
}

interface VoiceSearchSelectProps {
  id: string;
  label?: string;
  voices: VoiceOption[];
  selectedVoiceId: string;
  onSelectVoice: (voiceId: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  unavailableMessage?: string;
  className?: string;
  providerName?: string;
}

export const VoiceSearchSelect: React.FC<VoiceSearchSelectProps> = ({
  id,
  label = 'Voice',
  voices,
  selectedVoiceId,
  onSelectVoice,
  isLoading = false,
  disabled = false,
  placeholder = 'Search voice by name (e.g. Adam, Rachel)...',
  unavailableMessage,
  className = '',
  providerName,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Filter voices live based on searchQuery (case-insensitive substring/prefix match)
  const filteredVoices = useMemo(() => {
    const trimmed = searchQuery.trim().toLowerCase();
    if (!trimmed) return voices;
    return voices.filter(
      (v) =>
        v.name.toLowerCase().includes(trimmed) ||
        (v.category && v.category.toLowerCase().includes(trimmed)) ||
        (v.language && v.language.toLowerCase().includes(trimmed))
    );
  }, [voices, searchQuery]);

  const isSelectedVoiceInList =
    !selectedVoiceId || voices.some((v) => v.id === selectedVoiceId);

  const searchInputId = `${id}-search-input`;

  return (
    <div className={`voice-search-select-container ${className}`}>
      {label && (
        <div className="field-label-row mb-1 flex items-center justify-between">
          <label htmlFor={id} className="field-label">
            <Mic size={14} className="inline-icon" />
            <span>{label}</span>
          </label>
          <div className="flex items-center gap-2">
            {unavailableMessage && !isSelectedVoiceInList && (
              <span className="badge badge-warning">
                <AlertTriangle size={12} />
                <span>{unavailableMessage}</span>
              </span>
            )}
            <button
              type="button"
              className="btn btn-sm btn-outline voice-library-browse-btn"
              onClick={() => setIsModalOpen(true)}
              disabled={disabled || isLoading}
              title="Open full Voice Library popup"
            >
              <LayoutGrid size={13} className="inline-icon" />
              <span>Browse All ({voices.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* Voice Search Box */}
      <div className="voice-search-input-wrap">
        <Search size={14} className="voice-search-icon" />
        <input
          id={searchInputId}
          type="text"
          className="voice-search-input"
          placeholder={placeholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          disabled={disabled || isLoading || voices.length === 0}
          aria-label="Filter voices by name"
        />
        {searchQuery && (
          <button
            type="button"
            className="voice-search-clear-btn"
            onClick={() => setSearchQuery('')}
            title="Clear voice search"
            aria-label="Clear voice search"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* Search match stats badge when filter active */}
      {searchQuery.trim() !== '' && (
        <div className="voice-search-stats">
          <span className="badge badge-subtle">
            {filteredVoices.length === 0
              ? 'No voices match search'
              : `Found ${filteredVoices.length} matching voice${filteredVoices.length === 1 ? '' : 's'}`}
          </span>
        </div>
      )}

      {/* Select Dropdown */}
      <select
        id={id}
        className="form-select mt-1"
        value={selectedVoiceId}
        onChange={(e) => onSelectVoice(e.target.value)}
        disabled={disabled || isLoading}
      >
        <option value="">
          {isLoading
            ? 'Loading available voices...'
            : voices.length === 0
            ? 'No voices loaded'
            : searchQuery.trim() !== '' && filteredVoices.length === 0
            ? '— No voices match search —'
            : '— Select a voice —'}
        </option>

        {!isSelectedVoiceInList && selectedVoiceId && (
          <option value={selectedVoiceId} disabled>
            Saved voice ({selectedVoiceId})
          </option>
        )}

        {filteredVoices.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name} {v.category ? `(${v.category})` : ''}
          </option>
        ))}
      </select>

      {/* Full Screen Voice Library Modal */}
      <VoiceLibraryModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        voices={voices}
        selectedVoiceId={selectedVoiceId}
        onSelectVoice={onSelectVoice}
        title={label ? `${label} Library` : 'Voice Library'}
        isLoading={isLoading}
        providerName={providerName}
      />
    </div>
  );
};
