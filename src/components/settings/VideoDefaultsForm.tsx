import React from 'react';
import { Monitor, Smartphone, Video, Clock } from 'lucide-react';
import { OutputOrientation, VideoQuality, TargetSceneLength } from '../../types';

interface VideoDefaultsFormProps {
  orientation: OutputOrientation;
  quality: VideoQuality;
  sceneLength: TargetSceneLength;
  onChangeOrientation: (val: OutputOrientation) => void;
  onChangeQuality: (val: VideoQuality) => void;
  onChangeSceneLength: (val: TargetSceneLength) => void;
  disabled?: boolean;
}

export const VideoDefaultsForm: React.FC<VideoDefaultsFormProps> = ({
  orientation,
  quality,
  sceneLength,
  onChangeOrientation,
  onChangeQuality,
  onChangeSceneLength,
  disabled = false,
}) => {
  return (
    <div className="video-defaults-form">
      {/* Orientation Selector */}
      <div className="form-section">
        <label className="section-label">
          <Monitor size={16} className="text-primary" />
          <span>Default Output Orientation</span>
        </label>
        <p className="section-hint">Choose the default aspect ratio loaded when creating a new script job.</p>

        <div className="options-grid options-grid-2">
          <button
            type="button"
            className={`option-card ${orientation === 'landscape' ? 'selected' : ''}`}
            title="Set default orientation to Landscape (16:9 widescreen)"
            onClick={() => onChangeOrientation('landscape')}
            disabled={disabled}
          >
            <div className="option-header">
              <Monitor size={20} />
              <span className="option-title">Landscape (16:9)</span>
            </div>
            <p className="option-desc">Standard YouTube horizontal format</p>
          </button>

          <button
            type="button"
            className={`option-card ${orientation === 'portrait' ? 'selected' : ''}`}
            title="Set default orientation to Portrait (9:16 vertical/Shorts)"
            onClick={() => onChangeOrientation('portrait')}
            disabled={disabled}
          >
            <div className="option-header">
              <Smartphone size={20} />
              <span className="option-title">Portrait (9:16)</span>
            </div>
            <p className="option-desc">Vertical format for YouTube Shorts & Reels</p>
          </button>
        </div>
      </div>

      {/* Quality Selector */}
      <div className="form-section">
        <label className="section-label">
          <Video size={16} className="text-primary" />
          <span>Default Preferred Quality</span>
        </label>
        <p className="section-hint">Select the preferred resolution for downloaded stock footage.</p>

        <div className="options-grid options-grid-3">
          {(['720p', '1080p', '4k'] as VideoQuality[]).map((q) => (
            <button
              key={q}
              type="button"
              className={`option-card ${quality === q ? 'selected' : ''}`}
              title={`Set default video resolution to ${q.toUpperCase()}`}
              onClick={() => onChangeQuality(q)}
              disabled={disabled}
            >
              <div className="option-header">
                <span className="option-title">{q.toUpperCase()}</span>
                {q === '1080p' && <span className="badge badge-primary">Recommended</span>}
              </div>
              <p className="option-desc">
                {q === '720p' && 'Fastest download & smaller ZIP'}
                {q === '1080p' && 'Crisp Full HD standard'}
                {q === '4k' && 'Ultra HD when provided by creator'}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Target Scene Length */}
      <div className="form-section">
        <label className="section-label">
          <Clock size={16} className="text-primary" />
          <span>Default Target Scene Duration</span>
        </label>
        <p className="section-hint">Determines how Gemini splits sentences based on narration pace (140-160 WPM).</p>

        <div className="options-grid options-grid-3">
          {(
            [
              { id: 'short', label: 'Short', range: '3–5 seconds', desc: 'Fast, dynamic B-roll cuts' },
              { id: 'standard', label: 'Standard', range: '5–8 seconds', desc: 'Balanced documentary cadence' },
              { id: 'long', label: 'Long', range: '8–12 seconds', desc: 'Slow, expansive visual scenes' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              className={`option-card ${sceneLength === item.id ? 'selected' : ''}`}
              title={`Set default scene duration to ${item.label} (${item.range})`}
              onClick={() => onChangeSceneLength(item.id)}
              disabled={disabled}
            >
              <div className="option-header">
                <span className="option-title">{item.label}</span>
                <span className="badge">{item.range}</span>
              </div>
              <p className="option-desc">{item.desc}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
