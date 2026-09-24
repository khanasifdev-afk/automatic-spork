import React from 'react';
import { Mic, Layers, Gauge, AlertTriangle, Play, Square } from 'lucide-react';
import { Ai33ProOptions, Ai33Voice, Ai33SourceProvider } from '../../types';

interface Ai33ProDefaultsFormProps {
  options: Ai33ProOptions;
  onChange: (updates: Partial<Ai33ProOptions>) => void;
  voices: Ai33Voice[];
  isLoadingVoices?: boolean;
  disabled?: boolean;
}

const SOURCE_PROVIDER_OPTIONS: { value: Ai33SourceProvider; label: string }[] = [
  { value: 'elevenlabs', label: 'ElevenLabs' },
  { value: 'minimax', label: 'Minimax' },
  { value: 'clone', label: 'Cloned Voices' },
  { value: 'edge', label: 'Edge TTS' },
  { value: 'kokoro', label: 'Kokoro' },
  { value: 'vbee', label: 'Vbee' },
  { value: 'fishaudio', label: 'Fish Audio' },
];

export const Ai33ProDefaultsForm: React.FC<Ai33ProDefaultsFormProps> = ({
  options,
  onChange,
  voices,
  isLoadingVoices = false,
  disabled = false,
}) => {
  const [playingPreviewUrl, setPlayingPreviewUrl] = React.useState<string | null>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  const selectedVoice = voices.find((v) => v.voice_id === options.voiceId);
  const isSelectedVoiceAvailable =
    !options.voiceId || Boolean(selectedVoice);

  const handleTogglePreview = (previewUrl?: string) => {
    if (!previewUrl) return;

    if (playingPreviewUrl === previewUrl) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setPlayingPreviewUrl(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(previewUrl);
      audioRef.current = audio;
      audio.play().catch(() => setPlayingPreviewUrl(null));
      audio.onended = () => setPlayingPreviewUrl(null);
      setPlayingPreviewUrl(previewUrl);
    }
  };

  return (
    <div className="voice-defaults-form ai33pro-defaults-form">
      <div className="form-row-grid">
        {/* Source Provider Selector */}
        <div className="form-group">
          <label htmlFor="ai33pro-source-provider" className="field-label">
            <Layers size={15} className="inline-icon" />
            <span>Source Voice Provider</span>
          </label>
          <select
            id="ai33pro-source-provider"
            className="form-select"
            value={options.sourceProvider}
            onChange={(e) => {
              const newProvider = e.target.value as Ai33SourceProvider;
              onChange({ sourceProvider: newProvider, voiceId: '' });
            }}
            disabled={disabled}
            aria-label="Select AI33 Pro source voice provider"
          >
            {SOURCE_PROVIDER_OPTIONS.map((sp) => (
              <option key={sp.value} value={sp.value}>
                {sp.label}
              </option>
            ))}
          </select>
          <span className="field-hint">
            The underlying TTS engine used by AI33 Pro for voice catalog retrieval and synthesis.
          </span>
        </div>

        {/* Voice Selector */}
        <div className="form-group">
          <div className="field-label-row">
            <label htmlFor="ai33pro-default-voice" className="field-label">
              <Mic size={15} className="inline-icon" />
              <span>Default Voice</span>
            </label>
            {!isSelectedVoiceAvailable && (
              <span className="badge badge-warning">
                <AlertTriangle size={12} />
                <span>Saved voice unavailable</span>
              </span>
            )}
          </div>

          <div className="voice-select-row" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select
              id="ai33pro-default-voice"
              className={`form-select ${!isSelectedVoiceAvailable ? 'border-warning' : ''}`}
              value={options.voiceId}
              onChange={(e) => onChange({ voiceId: e.target.value })}
              disabled={disabled || isLoadingVoices}
              aria-label="Select default AI33 Pro voice"
            >
              <option value="">
                {isLoadingVoices
                  ? 'Loading available voices...'
                  : voices.length === 0
                  ? 'No voices loaded (test API key first)'
                  : '— Select a voice —'}
              </option>

              {!isSelectedVoiceAvailable && options.voiceId && (
                <option value={options.voiceId} disabled>
                  Unavailable voice ID ({options.voiceId})
                </option>
              )}

              {voices.map((v) => {
                const details = [v.language, v.gender].filter(Boolean).join(', ');
                return (
                  <option key={v.voice_id} value={v.voice_id}>
                    {v.name} {details ? `(${details})` : ''}
                  </option>
                );
              })}
            </select>

            {selectedVoice?.preview_url && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleTogglePreview(selectedVoice.preview_url)}
                title={playingPreviewUrl === selectedVoice.preview_url ? 'Stop sample' : 'Play voice sample'}
                aria-label={playingPreviewUrl === selectedVoice.preview_url ? 'Stop sample' : 'Play voice sample'}
              >
                {playingPreviewUrl === selectedVoice.preview_url ? (
                  <Square size={14} className="text-danger" />
                ) : (
                  <Play size={14} />
                )}
              </button>
            )}
          </div>

          <span className="field-hint">
            Voices are loaded directly from AI33 Pro for the selected provider. Voice IDs use exact service prefixes.
          </span>
        </div>
      </div>

      {/* Speed Slider */}
      <div className="voice-controls-section">
        <div className="section-subtitle-row">
          <Gauge size={16} className="text-primary" />
          <h3 className="section-subheading">Speech Generation Controls</h3>
        </div>

        <div className="sliders-grid">
          <div className="slider-group">
            <div className="slider-header">
              <label htmlFor="ai33pro-slider-speed" className="slider-label">Speed</label>
              <span className="slider-value">{options.speed.toFixed(2)}x</span>
            </div>
            <input
              id="ai33pro-slider-speed"
              type="range"
              min="0.5"
              max="1.5"
              step="0.05"
              value={options.speed}
              onChange={(e) => onChange({ speed: parseFloat(e.target.value) })}
              disabled={disabled}
              className="range-input"
            />
            <div className="slider-labels">
              <span>0.5x (Slower)</span>
              <span>1.0x (Normal)</span>
              <span>1.5x (Faster)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
