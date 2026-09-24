import React, { useState } from 'react';
import { Scissors, AlertCircle, X, Check } from 'lucide-react';
import { Scene } from '../../types';
import { countWords, estimateDurationSeconds } from '../../utils/textUtils';

interface SceneSplitModalProps {
  scene: Scene;
  onConfirm: (firstText: string, secondText: string) => void;
  onClose: () => void;
}

export const SceneSplitModal: React.FC<SceneSplitModalProps> = ({
  scene,
  onConfirm,
  onClose,
}) => {
  // Try splitting by sentences or middle words initially
  const initialSplit = (): [string, string] => {
    const text = scene.scriptText.trim();
    // Try splitting by period
    const sentences = text.split(/(?<=[.?!])\s+/).filter(Boolean);
    if (sentences.length >= 2) {
      const mid = Math.ceil(sentences.length / 2);
      return [
        sentences.slice(0, mid).join(' '),
        sentences.slice(mid).join(' '),
      ];
    }
    // Otherwise split words roughly in half
    const words = text.split(/\s+/).filter(Boolean);
    const mid = Math.max(1, Math.floor(words.length / 2));
    return [
      words.slice(0, mid).join(' '),
      words.slice(mid).join(' '),
    ];
  };

  const [initialFirst, initialSecond] = initialSplit();
  const [firstPart, setFirstPart] = useState(initialFirst);
  const [secondPart, setSecondPart] = useState(initialSecond);
  const [error, setError] = useState<string | null>(null);

  const duration1 = estimateDurationSeconds(firstPart);
  const duration2 = estimateDurationSeconds(secondPart);

  const handleConfirm = () => {
    const t1 = firstPart.trim();
    const t2 = secondPart.trim();

    if (!t1 || !t2) {
      setError('Both scenes must have non-empty script text.');
      return;
    }

    onConfirm(t1, t2);
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="split-modal-title">
      <div className="modal-box split-modal-box">
        <div className="modal-header">
          <div className="modal-icon-wrap icon-primary">
            <Scissors size={20} />
          </div>
          <div>
            <h3 id="split-modal-title" className="modal-title">
              Split Scene {scene.sequence}
            </h3>
            <p className="split-modal-sub">
              Divide this scene into two separate, ordered visual segments.
            </p>
          </div>
          <button
            type="button"
            className="btn-modal-close"
            title="Close dialog"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="banner banner-error banner-compact" role="alert">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <div className="split-modal-body">
          {/* Part 1 */}
          <div className="split-part">
            <div className="split-part-header">
              <span className="split-part-badge">Scene {scene.sequence}A</span>
              <span className="split-meta">
                {countWords(firstPart)} words • ~{duration1}s
              </span>
            </div>
            <textarea
              className="split-textarea"
              rows={3}
              value={firstPart}
              onChange={(e) => {
                setFirstPart(e.target.value);
                setError(null);
              }}
              placeholder="First segment narration..."
            />
          </div>

          {/* Part 2 */}
          <div className="split-part">
            <div className="split-part-header">
              <span className="split-part-badge">Scene {scene.sequence}B</span>
              <span className="split-meta">
                {countWords(secondPart)} words • ~{duration2}s
              </span>
            </div>
            <textarea
              className="split-textarea"
              rows={3}
              value={secondPart}
              onChange={(e) => {
                setSecondPart(e.target.value);
                setError(null);
              }}
              placeholder="Second segment narration..."
            />
          </div>
        </div>

        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-secondary"
            title="Cancel and keep scene as is"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            title="Split this scene into two separate scenes"
            onClick={handleConfirm}
            disabled={!firstPart.trim() || !secondPart.trim()}
          >
            <Check size={16} />
            <span>Confirm Split</span>
          </button>
        </div>
      </div>
    </div>
  );
};
