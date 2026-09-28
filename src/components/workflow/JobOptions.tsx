import React, { useState, useEffect, useRef } from 'react';
import {
  Monitor,
  Smartphone,
  Video,
  Film,
  Clock,
  Sliders,
  ChevronDown,
  ChevronUp,
  Volume2,
  Cpu,
  Info,
  Layers,
  AlertTriangle,
  Play,
  Square,
  Image,
} from 'lucide-react';
import {
  WorkflowOptions,
  VideoQuality,
  TargetSceneLength,
  ElevenLabsOutputFormat,
  ElevenLabsVoice,
  ElevenLabsModel,
  VoiceProvider,
  Ai33Voice,
  Ai33SourceProvider,
  Ai33ProOptions,
  StockMediaType,
} from '../../types';
import { VoiceSearchSelect } from '../common/VoiceSearchSelect';

interface JobOptionsProps {
  options: WorkflowOptions;
  onChange: (updates: Partial<WorkflowOptions>) => void;
  onSwitchVoiceProvider?: (provider: VoiceProvider) => void;
  voices?: ElevenLabsVoice[];
  models?: ElevenLabsModel[];
  ai33Voices?: Ai33Voice[];
  isLoadingAi33Voices?: boolean;
  hasExistingAudio?: boolean;
  scriptText?: string;
  disabled?: boolean;
}

export const JobOptions: React.FC<JobOptionsProps> = ({
  options,
  onChange,
  onSwitchVoiceProvider,
  voices = [],
  models = [],
  ai33Voices = [],
  isLoadingAi33Voices = false,
  hasExistingAudio = false,
  scriptText = '',
  disabled = false,
}) => {
  const [isVideoOpen, setIsVideoOpen] = useState(false);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [showSwitchProviderModal, setShowSwitchProviderModal] = useState(false);
  const [pendingProvider, setPendingProvider] = useState<VoiceProvider | null>(null);

  // AI33 Voice preview
  const [playingPreviewUrl, setPlayingPreviewUrl] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  const activeProvider: VoiceProvider = options.voiceProvider || 'elevenlabs';
  const characterCount = scriptText.trim().length;

  // Cleanup audio preview on unmount
  useEffect(() => {
    return () => {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
    };
  }, []);

  const handleTogglePreview = (url: string) => {
    if (playingPreviewUrl === url && previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
      setPlayingPreviewUrl(null);
      return;
    }

    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
    }

    const audio = new Audio(url);
    previewAudioRef.current = audio;
    setPlayingPreviewUrl(url);

    audio.play().catch(() => {
      setPlayingPreviewUrl(null);
    });

    audio.onended = () => {
      setPlayingPreviewUrl(null);
      previewAudioRef.current = null;
    };
    audio.onerror = () => {
      setPlayingPreviewUrl(null);
      previewAudioRef.current = null;
    };
  };

  const handleProviderSelect = (newProvider: VoiceProvider) => {
    if (newProvider === activeProvider) return;

    if (hasExistingAudio) {
      setPendingProvider(newProvider);
      setShowSwitchProviderModal(true);
    } else {
      if (onSwitchVoiceProvider) {
        onSwitchVoiceProvider(newProvider);
      } else {
        onChange({ voiceProvider: newProvider });
      }
    }
  };

  const confirmSwitchProvider = () => {
    if (pendingProvider) {
      if (onSwitchVoiceProvider) {
        onSwitchVoiceProvider(pendingProvider);
      } else {
        onChange({ voiceProvider: pendingProvider });
      }
      setPendingProvider(null);
    }
    setShowSwitchProviderModal(false);
  };

  const handleElevenLabsChange = (updates: Partial<typeof options.elevenLabs>) => {
    onChange({
      elevenLabs: {
        ...options.elevenLabs,
        ...updates,
      },
    });
  };

  const handleAi33Change = (updates: Partial<Ai33ProOptions>) => {
    onChange({
      ai33Pro: {
        sourceProvider: 'elevenlabs',
        voiceId: '',
        speed: 1.0,
        ...options.ai33Pro,
        ...updates,
      },
    });
  };

  const selectedElevenLabsVoiceName =
    voices.find((v) => v.voice_id === options.elevenLabs.voiceId)?.name ||
    (options.elevenLabs.voiceId ? `Voice (${options.elevenLabs.voiceId.slice(0, 6)}...)` : 'Default Voice');

  const selectedAi33Voice = ai33Voices.find((v) => v.voice_id === options.ai33Pro?.voiceId);
  const selectedAi33VoiceName =
    selectedAi33Voice?.name ||
    (options.ai33Pro?.voiceId ? `Voice (${options.ai33Pro.voiceId.slice(0, 8)}...)` : 'No voice selected');



  const videoSummary = `${options.orientation === 'landscape' ? 'Landscape (16:9)' : 'Portrait (9:16)'} · ${options.quality.toUpperCase()} · ${options.sceneLength}`;
  const currentMediaType: StockMediaType = options.stockMediaType ?? 'videos';
  const wantsVideos = currentMediaType === 'videos' || currentMediaType === 'both';
  const wantsImages = currentMediaType === 'images' || currentMediaType === 'both';

  const handleMediaTypeToggle = (type: 'videos' | 'images', checked: boolean) => {
    let next: StockMediaType;
    if (type === 'videos') {
      if (checked) {
        next = wantsImages ? 'both' : 'videos';
      } else {
        // Must keep at least one
        next = wantsImages ? 'images' : 'videos';
      }
    } else {
      if (checked) {
        next = wantsVideos ? 'both' : 'images';
      } else {
        next = wantsVideos ? 'videos' : 'videos'; // fallback to videos
      }
    }
    onChange({ stockMediaType: next });
  };
  const voiceSummary =
    activeProvider === 'ai33pro'
      ? `AI33 Pro (${options.ai33Pro?.sourceProvider || 'elevenlabs'}) · ${selectedAi33VoiceName} · ${(options.ai33Pro?.speed ?? 1.0).toFixed(2)}x`
      : `ElevenLabs · ${selectedElevenLabsVoiceName} · ${options.elevenLabs?.modelId}`;

  return (
    <div className="job-options-card">
      <div className="job-options-header">
        <div className="job-options-title-wrap">
          <Sliders className="job-options-icon" size={18} />
          <h3 className="job-options-title">Job Settings</h3>
        </div>
        <span className="job-options-badge">Job Specific</span>
      </div>
      <p className="job-options-hint">
        Adjust video and voice settings for this video job. These overrides do not alter your saved defaults in Settings.
      </p>

      <div className="job-sections-container">
        {/* Section 1: Video Settings (Collapsible, closed initially) */}
        <div className="collapsible-section">
          <button
            type="button"
            className="collapsible-header-btn"
            onClick={() => setIsVideoOpen(!isVideoOpen)}
            aria-expanded={isVideoOpen}
            aria-controls="workflow-video-settings-panel"
          >
            <div className="collapsible-title-wrap">
              <Film size={16} className="text-primary" />
              <span className="collapsible-title">1. Video Settings</span>
              <span className="badge badge-subtle">{videoSummary}</span>
            </div>
            {isVideoOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {isVideoOpen && (
            <div id="workflow-video-settings-panel" className="collapsible-content">
              {/* Video Options Grid */}
              <div className="job-options-grid">
                {/* Orientation */}
                <div className="job-option-group">
                  <label className="job-option-label" id="job-orientation-label">Orientation</label>
                  <div className="radio-pill-group" role="radiogroup" aria-labelledby="job-orientation-label">
                    <button
                      type="button"
                      className={`radio-pill-btn ${options.orientation === 'landscape' ? 'active' : ''}`}
                      onClick={() => onChange({ orientation: 'landscape' })}
                      disabled={disabled}
                      role="radio"
                      aria-checked={options.orientation === 'landscape'}
                    >
                      <Monitor size={14} className="inline-icon" aria-hidden="true" />
                      <span>Landscape (16:9)</span>
                    </button>
                    <button
                      type="button"
                      className={`radio-pill-btn ${options.orientation === 'portrait' ? 'active' : ''}`}
                      onClick={() => onChange({ orientation: 'portrait' })}
                      disabled={disabled}
                      role="radio"
                      aria-checked={options.orientation === 'portrait'}
                    >
                      <Smartphone size={14} className="inline-icon" aria-hidden="true" />
                      <span>Portrait (9:16)</span>
                    </button>
                  </div>
                </div>

                {/* Quality */}
                <div className="job-option-group">
                  <label htmlFor="job-quality-select" className="job-option-label">
                    <Video size={14} className="inline-icon" /> Video Quality
                  </label>
                  <select
                    id="job-quality-select"
                    className="form-select"
                    value={options.quality}
                    onChange={(e) => onChange({ quality: e.target.value as VideoQuality })}
                    disabled={disabled}
                  >
                    <option value="1080p">1080p (Full HD - Recommended)</option>
                    <option value="720p">720p (HD - Faster Download)</option>
                  </select>
                </div>

                {/* Target Scene Length */}
                <div className="job-option-group">
                  <label htmlFor="job-scene-length-select" className="job-option-label">
                    <Clock size={14} className="inline-icon" /> Target Scene Length
                  </label>
                  <select
                    id="job-scene-length-select"
                    className="form-select"
                    value={options.sceneLength}
                    onChange={(e) => onChange({ sceneLength: e.target.value as TargetSceneLength })}
                    disabled={disabled}
                  >
                    <option value="4-7s">4-7 seconds (Dynamic YouTube pacing)</option>
                    <option value="2-4s">2-4 seconds (Fast Shorts/TikTok pacing)</option>
                    <option value="7-10s">7-10 seconds (Calm/Documentary pacing)</option>
                  </select>
                </div>

                {/* Stock Media Type */}
                <div className="job-option-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="job-option-label" id="job-media-type-label">
                    <Image size={14} className="inline-icon" aria-hidden="true" /> Stock Media Type
                  </label>
                  <p className="job-option-hint">Choose which Pexels media to fetch per scene. Images are capped at 5; videos at 6.</p>
                  <div className="media-type-checkboxes" role="group" aria-labelledby="job-media-type-label">
                    <label className={`media-type-checkbox-label ${wantsVideos ? 'active' : ''}`}>
                      <input
                        id="job-media-videos"
                        type="checkbox"
                        className="media-type-checkbox"
                        checked={wantsVideos}
                        disabled={disabled || (wantsVideos && !wantsImages)}
                        onChange={(e) => handleMediaTypeToggle('videos', e.target.checked)}
                      />
                      <Video size={15} />
                      <span>Videos <span className="badge badge-subtle">6 per scene</span></span>
                    </label>
                    <label className={`media-type-checkbox-label ${wantsImages ? 'active' : ''}`}>
                      <input
                        id="job-media-images"
                        type="checkbox"
                        className="media-type-checkbox"
                        checked={wantsImages}
                        disabled={disabled}
                        onChange={(e) => handleMediaTypeToggle('images', e.target.checked)}
                      />
                      <Image size={15} />
                      <span>Images <span className="badge badge-subtle">5 per scene</span></span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Section 2: Voice Settings (Collapsible, closed initially) */}
        <div className="collapsible-section">
          <button
            type="button"
            className="collapsible-header-btn"
            onClick={() => setIsVoiceOpen(!isVoiceOpen)}
            aria-expanded={isVoiceOpen}
            aria-controls="workflow-voice-settings-panel"
          >
            <div className="collapsible-title-wrap">
              <Volume2 size={16} className="text-primary" />
              <span className="collapsible-title">2. Voice Settings</span>
              <span className="badge badge-subtle">{voiceSummary}</span>
            </div>
            {isVoiceOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {isVoiceOpen && (
            <div id="workflow-voice-settings-panel" className="collapsible-content">
              {/* Voice Service Control */}
              <div className="job-option-group mb-4">
                <label className="job-option-label" id="job-voice-service-label">
                  <Volume2 size={14} className="inline-icon" /> Voice Service
                </label>
                <div className="provider-service-cards-grid" role="radiogroup" aria-labelledby="job-voice-service-label">
                  <button
                    type="button"
                    className={`provider-service-card ${activeProvider === 'elevenlabs' ? 'active-elevenlabs' : ''}`}
                    onClick={() => handleProviderSelect('elevenlabs')}
                    disabled={disabled}
                    role="radio"
                    aria-checked={activeProvider === 'elevenlabs'}
                  >
                    <div className="provider-service-card-header">
                      <span className="provider-service-card-title">
                        <Volume2 size={16} style={{ color: '#7c3aed' }} />
                        <span>ElevenLabs</span>
                      </span>
                      {activeProvider === 'elevenlabs' && (
                        <span className="badge badge-primary">Active</span>
                      )}
                    </div>
                    <p className="provider-service-card-desc">
                      Official ElevenLabs API. Multilingual models, fine-tuned clarity, stability, and style controls.
                    </p>
                  </button>

                  <button
                    type="button"
                    className={`provider-service-card ${activeProvider === 'ai33pro' ? 'active-ai33pro' : ''}`}
                    onClick={() => handleProviderSelect('ai33pro')}
                    disabled={disabled}
                    role="radio"
                    aria-checked={activeProvider === 'ai33pro'}
                  >
                    <div className="provider-service-card-header">
                      <span className="provider-service-card-title">
                        <Layers size={16} style={{ color: '#059669' }} />
                        <span>AI33 Pro</span>
                      </span>
                      {activeProvider === 'ai33pro' && (
                        <span className="badge badge-primary" style={{ backgroundColor: '#059669' }}>
                          Active
                        </span>
                      )}
                    </div>
                    <p className="provider-service-card-desc">
                      Unified OpenSpeaker proxy API. Minimax, Edge, Kokoro, Vbee, Fish Audio, and Voice Cloning with speed control.
                    </p>
                  </button>
                </div>
              </div>

              {/* Planning Estimate Notice */}
              <div className="character-estimate-box">
                <Info size={16} className="text-primary" />
                <div className="estimate-text">
                  <strong>Planning estimate: </strong>
                  {activeProvider === 'elevenlabs' ? (
                    <span>
                      Current script has {characterCount.toLocaleString()} character{characterCount === 1 ? '' : 's'}.
                      Actual character consumption is determined by ElevenLabs when voice audio is generated.
                    </span>
                  ) : (
                    <span>
                      Current script has {characterCount.toLocaleString()} character{characterCount === 1 ? '' : 's'}.
                      Actual credit consumption is determined by AI33 Pro when speech is synthesized.
                    </span>
                  )}
                </div>
              </div>

              {/* ElevenLabs Specific Controls */}
              {activeProvider === 'elevenlabs' && (
                <>
                  <div className="job-options-grid voice-grid">
                    {/* Voice Select with Search */}
                    <div className="job-option-group">
                      <VoiceSearchSelect
                        id="job-voice-select"
                        label="Voice"
                        voices={voices.map((v) => ({
                          id: v.voice_id,
                          name: v.name,
                          category: v.category,
                        }))}
                        selectedVoiceId={options.elevenLabs.voiceId}
                        onSelectVoice={(voiceId) => handleElevenLabsChange({ voiceId })}
                        disabled={disabled}
                        placeholder="Search voice by name (e.g. Adam, Rachel)..."
                      />
                    </div>

                    {/* TTS Model Select */}
                    <div className="job-option-group">
                      <label htmlFor="job-model-select" className="job-option-label">
                        <Cpu size={14} className="inline-icon" /> Model
                      </label>
                      <select
                        id="job-model-select"
                        className="form-select"
                        value={options.elevenLabs.modelId}
                        onChange={(e) => handleElevenLabsChange({ modelId: e.target.value })}
                        disabled={disabled}
                      >
                        {models.length === 0 ? (
                          <option value={options.elevenLabs.modelId || 'eleven_multilingual_v2'}>
                            {options.elevenLabs.modelId || 'eleven_multilingual_v2 (Default)'}
                          </option>
                        ) : (
                          models.map((m) => (
                            <option key={m.model_id} value={m.model_id}>
                              {m.name || m.model_id}
                            </option>
                          ))
                        )}
                      </select>
                    </div>

                    {/* Output Format */}
                    <div className="job-option-group">
                      <label htmlFor="job-format-select" className="job-option-label">Output Format</label>
                      <select
                        id="job-format-select"
                        className="form-select"
                        value={options.elevenLabs.outputFormat}
                        onChange={(e) => handleElevenLabsChange({ outputFormat: e.target.value as ElevenLabsOutputFormat })}
                        disabled={disabled}
                      >
                        <option value="mp3_44100_64">MP3 44.1 kHz / 64 kbps</option>
                        <option value="mp3_44100_96">MP3 44.1 kHz / 96 kbps</option>
                        <option value="mp3_44100_128">MP3 44.1 kHz / 128 kbps (Default)</option>
                        <option value="mp3_44100_192">MP3 44.1 kHz / 192 kbps (Creator+)</option>
                      </select>
                    </div>
                  </div>

                  {/* Sliders */}
                  <div className="sliders-grid mt-2">
                    <div className="slider-group">
                      <div className="slider-header">
                        <label htmlFor="job-stability" className="slider-label">Stability</label>
                        <span className="slider-value">{(options.elevenLabs.stability * 100).toFixed(0)}%</span>
                      </div>
                      <input
                        id="job-stability"
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={options.elevenLabs.stability}
                        onChange={(e) => handleElevenLabsChange({ stability: parseFloat(e.target.value) })}
                        disabled={disabled}
                        className="range-input"
                      />
                      <div className="slider-labels">
                        <span>More variable</span>
                        <span>More stable</span>
                      </div>
                    </div>

                    <div className="slider-group">
                      <div className="slider-header">
                        <label htmlFor="job-similarity" className="slider-label">Clarity</label>
                        <span className="slider-value">{(options.elevenLabs.similarityBoost * 100).toFixed(0)}%</span>
                      </div>
                      <input
                        id="job-similarity"
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={options.elevenLabs.similarityBoost}
                        onChange={(e) => handleElevenLabsChange({ similarityBoost: parseFloat(e.target.value) })}
                        disabled={disabled}
                        className="range-input"
                      />
                      <div className="slider-labels">
                        <span>Low</span>
                        <span>High clarity</span>
                      </div>
                    </div>

                    <div className="slider-group">
                      <div className="slider-header">
                        <label htmlFor="job-speed" className="slider-label">Speed</label>
                        <span className="slider-value">{options.elevenLabs.speed.toFixed(2)}x</span>
                      </div>
                      <input
                        id="job-speed"
                        type="range"
                        min="0.7"
                        max="1.3"
                        step="0.05"
                        value={options.elevenLabs.speed}
                        onChange={(e) => handleElevenLabsChange({ speed: parseFloat(e.target.value) })}
                        disabled={disabled}
                        className="range-input"
                      />
                      <div className="slider-labels">
                        <span>0.7x (Slower)</span>
                        <span>1.3x (Faster)</span>
                      </div>
                    </div>

                    <div className="slider-group">
                      <div className="slider-header">
                        <label htmlFor="job-style" className="slider-label">Style</label>
                        <span className="slider-value">{(options.elevenLabs.style * 100).toFixed(0)}%</span>
                      </div>
                      <input
                        id="job-style"
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={options.elevenLabs.style}
                        onChange={(e) => handleElevenLabsChange({ style: parseFloat(e.target.value) })}
                        disabled={disabled}
                        className="range-input"
                      />
                      <div className="slider-labels">
                        <span>None (Natural)</span>
                        <span>Exaggerated</span>
                      </div>
                    </div>
                  </div>

                  {/* Speaker Boost Toggle */}
                  <div className="form-switch-row mt-2">
                    <div className="form-switch-info">
                      <label htmlFor="job-speaker-boost" className="form-switch-label">
                        Speaker Boost
                      </label>
                      <span className="form-switch-subtext">Enhance voice clarity and speaker similarity</span>
                    </div>
                    <label className="switch-toggle" htmlFor="job-speaker-boost">
                      <input
                        id="job-speaker-boost"
                        type="checkbox"
                        checked={options.elevenLabs.useSpeakerBoost}
                        onChange={(e) => handleElevenLabsChange({ useSpeakerBoost: e.target.checked })}
                        disabled={disabled}
                      />
                      <span className="switch-slider" />
                    </label>
                  </div>
                </>
              )}

              {/* AI33 Pro Specific Controls */}
              {activeProvider === 'ai33pro' && (
                <>
                  <div className="job-options-grid voice-grid">
                    {/* Source Provider */}
                    <div className="job-option-group">
                      <label htmlFor="job-ai33-source-select" className="job-option-label">
                        <Layers size={14} className="inline-icon" /> Source Provider
                      </label>
                      <select
                        id="job-ai33-source-select"
                        className="form-select"
                        value={options.ai33Pro?.sourceProvider || 'elevenlabs'}
                        onChange={(e) =>
                          handleAi33Change({
                            sourceProvider: e.target.value as Ai33SourceProvider,
                            voiceId: '',
                          })
                        }
                        disabled={disabled}
                      >
                        <option value="elevenlabs">ElevenLabs</option>
                        <option value="minimax">MiniMax (Recommended)</option>
                        <option value="clone">Clone</option>
                        <option value="edge">Microsoft Edge</option>
                        <option value="kokoro">Kokoro</option>
                        <option value="vbee">VBEE</option>
                        <option value="fishaudio">Fish Audio</option>
                      </select>
                    </div>

                    {/* Voice Selection & Preview */}
                    <div className="job-option-group">
                      <div className="voice-select-row" style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                        <VoiceSearchSelect
                          id="job-ai33-voice-select"
                          label="Voice Selection"
                          className="flex-1"
                          voices={ai33Voices.map((v) => {
                            const details = [v.language, v.gender].filter(Boolean).join(', ');
                            return {
                              id: v.voice_id,
                              name: v.name,
                              category: details,
                            };
                          })}
                          selectedVoiceId={options.ai33Pro?.voiceId || ''}
                          onSelectVoice={(voiceId) => handleAi33Change({ voiceId })}
                          isLoading={isLoadingAi33Voices}
                          disabled={disabled}
                          placeholder="Search voice by name (e.g. Adam, Rachel)..."
                        />

                        {selectedAi33Voice?.preview_url && (
                          <button
                            type="button"
                            className={`btn btn-preview-voice ${playingPreviewUrl === selectedAi33Voice.preview_url ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => handleTogglePreview(selectedAi33Voice.preview_url!)}
                            title={playingPreviewUrl === selectedAi33Voice.preview_url ? 'Stop voice sample' : 'Play voice sample'}
                            style={{ height: '36px', marginBottom: '1px' }}
                          >
                            {playingPreviewUrl === selectedAi33Voice.preview_url ? (
                              <>
                                <Square size={13} />
                                <span>Stop</span>
                              </>
                            ) : (
                              <>
                                <Play size={13} />
                                <span>Preview</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                      {isLoadingAi33Voices && (
                        <span className="text-muted text-sm mt-1" style={{ display: 'inline-block' }}>
                          Loading voices from AI33 Pro...
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Speed Slider (0.5 to 1.5) */}
                  <div className="sliders-grid mt-3">
                    <div className="slider-group">
                      <div className="slider-header">
                        <label htmlFor="job-ai33-speed" className="slider-label">Speed</label>
                        <span className="slider-value">{(options.ai33Pro?.speed ?? 1.0).toFixed(2)}x</span>
                      </div>
                      <input
                        id="job-ai33-speed"
                        type="range"
                        min="0.5"
                        max="1.5"
                        step="0.05"
                        value={options.ai33Pro?.speed ?? 1.0}
                        onChange={(e) => handleAi33Change({ speed: parseFloat(e.target.value) })}
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
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Switch Provider Confirmation Modal */}
      {showSwitchProviderModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-box">
            <div className="modal-header">
              <div className="modal-icon-wrap icon-warning">
                <AlertTriangle size={20} />
              </div>
              <h3 className="modal-title">Switch Voice Provider?</h3>
            </div>
            <p className="modal-body">
              Switching voice provider from{' '}
              <strong>{activeProvider === 'ai33pro' ? 'AI33 Pro' : 'ElevenLabs'}</strong> to{' '}
              <strong>{pendingProvider === 'ai33pro' ? 'AI33 Pro' : 'ElevenLabs'}</strong> will
              cancel any active voice generation, revoke audio previews, and remove all existing voice
              segments for this job.
              <br />
              <br />
              This action cannot be undone.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setShowSwitchProviderModal(false);
                  setPendingProvider(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-danger-action"
                onClick={confirmSwitchProvider}
              >
                Switch Provider
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
