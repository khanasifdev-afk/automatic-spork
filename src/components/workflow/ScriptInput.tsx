import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, AlertCircle, RefreshCw, X, Loader2 } from 'lucide-react';
import { countWords, countCharacters, MAX_SCRIPT_WORDS, DEFAULT_SAMPLE_SCRIPT } from '../../utils/textUtils';

interface ScriptInputProps {
  script: string;
  hasGeminiKey: boolean;
  status: 'idle' | 'analyzing' | 'ready' | 'error';
  error: string | null;
  onScriptChange: (script: string) => void;
  onAnalyze: () => void;
  onCancel: () => void;
}

export const ScriptInput: React.FC<ScriptInputProps> = ({
  script,
  hasGeminiKey,
  status,
  error,
  onScriptChange,
  onAnalyze,
  onCancel,
}) => {
  const wordCount = countWords(script);
  const charCount = countCharacters(script);
  const isOverLimit = wordCount > MAX_SCRIPT_WORDS;
  const isEmpty = script.trim().length === 0;
  const isAnalyzing = status === 'analyzing';

  const canSubmit = !isEmpty && !isOverLimit && !isAnalyzing && hasGeminiKey;

  return (
    <div className="script-input-container">
      {!hasGeminiKey && (
        <div className="banner banner-warning" role="alert">
          <AlertCircle size={18} className="banner-icon" />
          <div className="banner-text">
            <strong>Gemini API Key Required:</strong> You need to configure your Gemini API key in{' '}
            <Link to="/settings" className="banner-link">
              Settings
            </Link>{' '}
            before analyzing scripts.
          </div>
        </div>
      )}

      {error && status === 'error' && (
        <div className="banner banner-error" role="alert">
          <AlertCircle size={18} className="banner-icon" />
          <div className="banner-text">
            <strong>Analysis Failed:</strong> {error}
          </div>
          <button
            type="button"
            className="btn btn-sm btn-retry"
            title="Retry script analysis with Gemini"
            onClick={onAnalyze}
            disabled={!hasGeminiKey || isEmpty || isOverLimit}
          >
            <RefreshCw size={14} />
            <span>Retry</span>
          </button>
        </div>
      )}

      <div className="script-input-card">
        <div className="script-input-header">
          <label htmlFor="script-textarea" className="script-label">
            YouTube Narration Script
          </label>
          <div className="script-counters">
            <span
              className={`counter-item ${isOverLimit ? 'counter-overflow' : ''}`}
              title="Words count"
            >
              <strong>{wordCount.toLocaleString()}</strong> / {MAX_SCRIPT_WORDS.toLocaleString()} words
            </span>
            <span className="counter-separator">•</span>
            <span className="counter-item" title="Character count">
              {charCount.toLocaleString()} chars
            </span>
          </div>
        </div>

        <div className="textarea-wrapper">
          <textarea
            id="script-textarea"
            className={`script-textarea ${isOverLimit ? 'textarea-error' : ''}`}
            placeholder="Paste your YouTube video narration script here... (e.g. 'Regular walking can improve balance and confidence. An active senior walking in a sunny park...')"
            rows={10}
            value={script}
            onChange={(e) => onScriptChange(e.target.value)}
            disabled={isAnalyzing}
          />
        </div>

        {isOverLimit && (
          <p className="field-error-text">
            Script exceeds the maximum limit of {MAX_SCRIPT_WORDS.toLocaleString()} words. Please trim your text.
          </p>
        )}

        <div className="script-input-footer">
          <div className="script-actions-left" style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              title="Clear all script text"
              onClick={() => onScriptChange('')}
              disabled={isEmpty || isAnalyzing}
            >
              <X size={15} />
              <span>Clear</span>
            </button>

            {isEmpty && (
              <button
                type="button"
                className="btn btn-secondary"
                title="Load sample script"
                onClick={() => onScriptChange(DEFAULT_SAMPLE_SCRIPT)}
                disabled={isAnalyzing}
              >
                <Sparkles size={15} />
                <span>Load Sample</span>
              </button>
            )}
          </div>

          <div className="script-actions-right">
            {isAnalyzing ? (
              <button
                type="button"
                className="btn btn-danger-outline"
                title="Cancel script analysis"
                onClick={onCancel}
              >
                <X size={16} />
                <span>Cancel Analysis</span>
              </button>
            ) : null}

            <button
              type="button"
              className="btn btn-primary btn-analyze"
              title={
                !hasGeminiKey
                  ? 'Gemini API key is required (configure in Settings)'
                  : isEmpty
                  ? 'Paste or type a script to analyze'
                  : isOverLimit
                  ? 'Script exceeds 5,000 words limit'
                  : 'Analyze script with Gemini to generate visual scenes'
              }
              onClick={onAnalyze}
              disabled={!canSubmit}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 size={16} className="btn-spinner" />
                  <span>Analyzing Script with Gemini...</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  <span>Analyze Script</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
