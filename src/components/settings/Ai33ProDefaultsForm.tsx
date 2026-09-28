import React from 'react';
import { Layers, Gauge, Play, Square } from 'lucide-react';
import { Ai33ProOptions, Ai33Voice, Ai33SourceProvider } from '../../types';
import { VoiceSearchSelect } from '../common/VoiceSearchSelect';

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

        {/* Voice Selector with Live Search */}
        <div className="form-group">
          <div className="voice-select-row" style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            <VoiceSearchSelect
              id="ai33pro-default-voice"
              label="Default Voice"
              className="flex-1"
              voices={voices.map((v) => {
                const details = [v.language, v.gender].filter(Boolean).join(', ');
                return {
                  id: v.voice_id,
                  name: v.name,
                  category: details,
                };
              })}
              selectedVoiceId={options.voiceId}
              onSelectVoice={(voiceId) => onChange({ voiceId })}
              isLoading={isLoadingVoices}
              disabled={disabled}
              placeholder="Search voice by name (e.g. Adam, Rachel)..."
              unavailableMessage="Saved voice unavailable"
            />

            {selectedVoice?.preview_url && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleTogglePreview(selectedVoice.preview_url)}
                title={playingPreviewUrl === selectedVoice.preview_url ? 'Stop voice sample' : 'Play voice sample'}
                style={{ height: '36px', minWidth: '80px', marginBottom: '1px' }}
              >
                {playingPreviewUrl === selectedVoice.preview_url ? (
                  <>
                    <Square size={13} />
                    <span>Stop</span>
                  </>
                ) : (
                  <>
                    <Play size={13} />
                    <span>Sample</span>
                  </>
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
