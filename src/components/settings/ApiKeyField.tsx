import React, { useState } from 'react';
import { Eye, EyeOff, Play, Loader2 } from 'lucide-react';
import { KeyTestStatus } from '../../types';
import { ApiTestStatus } from './ApiTestStatus';

interface ApiKeyFieldProps {
  id: string;
  label: string;
  provider: 'gemini' | 'pexels' | 'elevenlabs' | 'ai33pro';
  value: string;
  onChange: (newValue: string) => void;
  onTest: () => void;
  testStatus: KeyTestStatus;
  isSaved: boolean;
  disabled?: boolean;
  helperText?: string;
}

export const ApiKeyField: React.FC<ApiKeyFieldProps> = ({
  id,
  label,
  provider,
  value,
  onChange,
  onTest,
  testStatus,
  isSaved,
  disabled = false,
  helperText,
}) => {
  const [showKey, setShowKey] = useState(false);
  const isTesting = testStatus.state === 'testing';

  return (
    <div className="api-key-field-group">
      <div className="field-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label htmlFor={id} className="field-label">
            {label}
          </label>
          {provider === 'elevenlabs' && (
            <span className="provider-tag provider-tag-elevenlabs">ElevenLabs Direct</span>
          )}
          {provider === 'ai33pro' && (
            <span className="provider-tag provider-tag-ai33pro">AI33 Pro Proxy</span>
          )}
        </div>
        <span className={`badge ${isSaved ? 'badge-primary' : 'badge-subtle'}`}>
          {isSaved ? 'Configured' : 'Not configured'}
        </span>
      </div>

      {helperText && <p className="field-description">{helperText}</p>}

      <div className="key-input-row">
        <div className="input-mask-container">
          <input
            id={id}
            type={showKey ? 'text' : 'password'}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={
              provider === 'gemini'
                ? 'AIzaSy...'
                : provider === 'pexels'
                ? 'Enter your Pexels API key'
                : provider === 'elevenlabs'
                ? 'Enter your ElevenLabs API key'
                : 'Enter your AI33 Pro API key'
            }
            className="key-input"
            autoComplete="off"
            spellCheck="false"
            disabled={disabled || isTesting}
          />
          <button
            type="button"
            className="toggle-mask-btn"
            onClick={() => setShowKey(!showKey)}
            title={showKey ? 'Hide key' : 'Show key'}
            aria-label={showKey ? 'Hide API key' : 'Show API key'}
          >
            {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        <button
          type="button"
          onClick={onTest}
          disabled={!value.trim() || isTesting || disabled}
          className="btn btn-secondary test-key-btn"
          title={!value.trim() ? `Enter a key to test ${label}` : `Test ${label} access and validity`}
          aria-label={`Test ${label}`}
        >
          {isTesting ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              <span>Testing...</span>
            </>
          ) : (
            <>
              <Play size={14} />
              <span>Test Key</span>
            </>
          )}
        </button>
      </div>

      <div className="field-notes">
        {provider === 'pexels' && (
          <p className="field-note-text">
            * Note: Running this test sends a lightweight video query and consumes 1 Pexels API request from your monthly quota.
          </p>
        )}
        {provider === 'gemini' && (
          <p className="field-note-text">
            * Note: Authenticates directly with Google Generative Language API (`gemini-2.5-flash`) without consuming heavy generation tokens.
          </p>
        )}
        {provider === 'elevenlabs' && (
          <p className="field-note-text">
            * Note: Authenticates via subscription lookup (`GET /v1/user/subscription`) without synthesizing speech or consuming text-to-speech characters.
          </p>
        )}
        {provider === 'ai33pro' && (
          <p className="field-note-text">
            * Note: Authenticates via credits check (`GET /v1/credits`) without generating speech or consuming credits.
          </p>
        )}
      </div>

      <ApiTestStatus status={testStatus} provider={provider} />
    </div>
  );
};
