import React from 'react';
import {
  Mic,
  Cpu,
  FileAudio,
  Sliders,
  AlertTriangle,
} from 'lucide-react';
import {
  ElevenLabsOptions,
  ElevenLabsVoice,
  ElevenLabsModel,
  ElevenLabsOutputFormat,
} from '../../types';

interface VoiceDefaultsFormProps {
  options: ElevenLabsOptions;
  onChange: (updates: Partial<ElevenLabsOptions>) => void;
  voices: ElevenLabsVoice[];
  models: ElevenLabsModel[];
  isLoadingVoices?: boolean;
  isLoadingModels?: boolean;
  disabled?: boolean;
}

const OUTPUT_FORMAT_OPTIONS: { value: ElevenLabsOutputFormat; label: string; planHint?: string }[] = [
  { value: 'mp3_44100_64', label: 'MP3 44.1 kHz / 64 kbps (Low bandwidth)' },
  { value: 'mp3_44100_96', label: 'MP3 44.1 kHz / 96 kbps (Balanced)' },
  { value: 'mp3_44100_128', label: 'MP3 44.1 kHz / 128 kbps (Default - All plans)' },
  { value: 'mp3_44100_192', label: 'MP3 44.1 kHz / 192 kbps (High quality - Creator+ plans)', planHint: 'Creator+' },
];

export const VoiceDefaultsForm: React.FC<VoiceDefaultsFormProps> = ({
  options,
  onChange,
  voices,
  models,
  isLoadingVoices = false,
  isLoadingModels = false,
  disabled = false,
}) => {
  const isSelectedVoiceAvailable =
    !options.voiceId || voices.some((v) => v.voice_id === options.voiceId);
  const isSelectedModelAvailable =
    !options.modelId || models.some((m) => m.model_id === options.modelId);

  return (
    <div className="voice-defaults-form">
      {/* Voice & Model Grid */}
      <div className="form-row-grid">
        {/* Voice Selector */}
        <div className="form-group">
          <div className="field-label-row">
            <label htmlFor="elevenlabs-default-voice" className="field-label">
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

          <select
            id="elevenlabs-default-voice"
            className={`form-select ${!isSelectedVoiceAvailable ? 'border-warning' : ''}`}
            value={options.voiceId}
            onChange={(e) => onChange({ voiceId: e.target.value })}
            disabled={disabled || isLoadingVoices}
            aria-label="Select default ElevenLabs voice"
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

            {voices.map((v) => (
              <option key={v.voice_id} value={v.voice_id}>
                {v.name} {v.category ? `(${v.category})` : ''}
              </option>
            ))}
          </select>
          <span className="field-hint">
            Voices are loaded directly from your ElevenLabs account after entering a valid API key.
          </span>
        </div>

        {/* TTS Model Selector */}
        <div className="form-group">
          <div className="field-label-row">
            <label htmlFor="elevenlabs-default-model" className="field-label">
              <Cpu size={15} className="inline-icon" />
              <span>Text-to-Speech Model</span>
            </label>
            {!isSelectedModelAvailable && (
              <span className="badge badge-warning">
                <AlertTriangle size={12} />
                <span>Saved model unavailable</span>
              </span>
            )}
          </div>

          <select
            id="elevenlabs-default-model"
            className={`form-select ${!isSelectedModelAvailable ? 'border-warning' : ''}`}
            value={options.modelId}
            onChange={(e) => onChange({ modelId: e.target.value })}
            disabled={disabled || isLoadingModels}
            aria-label="Select ElevenLabs text-to-speech model"
          >
            <option value="">
              {isLoadingModels
                ? 'Loading models...'
                : models.length === 0
                ? 'eleven_multilingual_v2 (Default)'
                : '— Select a model —'}
            </option>

            {!isSelectedModelAvailable && options.modelId && (
              <option value={options.modelId} disabled>
                Unavailable model ID ({options.modelId})
              </option>
            )}

            {models.map((m) => (
              <option key={m.model_id} value={m.model_id}>
                {m.name || m.model_id}
              </option>
            ))}
          </select>
          <span className="field-hint">
            Filtered exclusively to models reported by ElevenLabs as capable of text-to-speech.
          </span>
        </div>
      </div>

      {/* Output Audio Format */}
      <div className="form-group">
        <label htmlFor="elevenlabs-default-format" className="field-label">
          <FileAudio size={15} className="inline-icon" />
          <span>Default Audio Output Format</span>
        </label>
        <select
          id="elevenlabs-default-format"
          className="form-select"
          value={options.outputFormat}
          onChange={(e) => onChange({ outputFormat: e.target.value as ElevenLabsOutputFormat })}
          disabled={disabled}
          aria-label="Select audio output format"
        >
          {OUTPUT_FORMAT_OPTIONS.map((fmt) => (
            <option key={fmt.value} value={fmt.value}>
              {fmt.label}
            </option>
          ))}
        </select>
        <span className="field-hint">
          Standard fallback is 128 kbps. High-bitrate options (192 kbps) require an eligible ElevenLabs plan.
        </span>
      </div>

      {/* Voice Fine-tuning Controls */}
      <div className="voice-controls-section">
        <div className="section-subtitle-row">
          <Sliders size={16} className="text-primary" />
          <h3 className="section-subheading">Voice Generation Controls</h3>
        </div>

        <div className="sliders-grid">
          {/* Stability */}
          <div className="slider-group">
            <div className="slider-header">
              <label htmlFor="slider-stability" className="slider-label">Stability</label>
              <span className="slider-value">{(options.stability * 100).toFixed(0)}%</span>
            </div>
            <input
              id="slider-stability"
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={options.stability}
              onChange={(e) => onChange({ stability: parseFloat(e.target.value) })}
              disabled={disabled}
              className="range-input"
            />
            <div className="slider-labels">
              <span>More variable</span>
              <span>More stable</span>
            </div>
          </div>

          {/* Similarity Boost */}
          <div className="slider-group">
            <div className="slider-header">
              <label htmlFor="slider-similarity" className="slider-label">Clarity + Similarity</label>
              <span className="slider-value">{(options.similarityBoost * 100).toFixed(0)}%</span>
            </div>
            <input
              id="slider-similarity"
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={options.similarityBoost}
              onChange={(e) => onChange({ similarityBoost: parseFloat(e.target.value) })}
              disabled={disabled}
              className="range-input"
            />
            <div className="slider-labels">
              <span>Low</span>
              <span>High clarity</span>
            </div>
          </div>

          {/* Style Exaggeration */}
          <div className="slider-group">
            <div className="slider-header">
              <label htmlFor="slider-style" className="slider-label">Style Exaggeration</label>
              <span className="slider-value">{(options.style * 100).toFixed(0)}%</span>
            </div>
            <input
              id="slider-style"
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={options.style}
              onChange={(e) => onChange({ style: parseFloat(e.target.value) })}
              disabled={disabled}
              className="range-input"
            />
            <div className="slider-labels">
              <span>None</span>
              <span>Exaggerated</span>
            </div>
          </div>

          {/* Speed */}
          <div className="slider-group">
            <div className="slider-header">
              <label htmlFor="slider-speed" className="slider-label">Speed</label>
              <span className="slider-value">{options.speed.toFixed(2)}x</span>
            </div>
            <input
              id="slider-speed"
              type="range"
              min="0.7"
              max="1.3"
              step="0.05"
              value={options.speed}
              onChange={(e) => onChange({ speed: parseFloat(e.target.value) })}
              disabled={disabled}
              className="range-input"
            />
            <div className="slider-labels">
              <span>0.7x (Slower)</span>
              <span>1.0x (Normal)</span>
              <span>1.3x (Faster)</span>
            </div>
          </div>
        </div>

        {/* Speaker Boost Toggle */}
        <div className="toggle-group">
          <div className="toggle-info">
            <span className="toggle-title">Speaker Boost</span>
            <span className="toggle-description">
              Boosts similarity to the original speaker voice at a slight compute cost.
            </span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={options.useSpeakerBoost}
            className={`switch-btn ${options.useSpeakerBoost ? 'switch-on' : 'switch-off'}`}
            onClick={() => onChange({ useSpeakerBoost: !options.useSpeakerBoost })}
            disabled={disabled}
          >
            <span className="switch-thumb" />
          </button>
        </div>
      </div>
    </div>
  );
};
