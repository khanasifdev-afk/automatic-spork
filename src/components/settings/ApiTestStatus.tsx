import React from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Clock, Ban, Loader2, ExternalLink } from 'lucide-react';
import { KeyTestStatus } from '../../types';

interface ApiTestStatusProps {
  status: KeyTestStatus;
  provider: 'gemini' | 'pexels' | 'elevenlabs' | 'ai33pro';
}

export const ApiTestStatus: React.FC<ApiTestStatusProps> = ({ status, provider }) => {
  if (status.state === 'not-tested') {
    return (
      <div className="test-status-box test-status-idle">
        <span className="status-badge status-idle">Not tested</span>
        <span className="status-hint">Test this key to verify credentials and connectivity before using it.</span>
      </div>
    );
  }

  if (status.state === 'testing') {
    return (
      <div className="test-status-box test-status-testing">
        <Loader2 className="animate-spin text-primary" size={16} />
        <span className="status-badge status-testing">Testing...</span>
        <span className="status-hint">Sending lightweight authentication request...</span>
      </div>
    );
  }

  if (status.state === 'valid') {
    return (
      <div className="test-status-box test-status-valid">
        <div className="status-header">
          <CheckCircle2 size={16} className="text-success" />
          <span className="status-badge status-valid">Valid</span>
          <span className="status-message">{status.message}</span>
        </div>

        {provider === 'gemini' && (
          <div className="status-meta">
            <span className="meta-item">
              Usage details are available in{' '}
              <a
                href="https://aistudio.google.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="external-link"
              >
                Google AI Studio <ExternalLink size={12} />
              </a>
            </span>
          </div>
        )}

        {provider === 'pexels' && status.usage && (
          <div className="status-meta quota-grid">
            {status.usage.limit !== undefined && (
              <div className="quota-pill">
                <span className="quota-label">Monthly Limit:</span>
                <span className="quota-value">{status.usage.limit.toLocaleString()}</span>
              </div>
            )}
            {status.usage.remaining !== undefined && (
              <div className="quota-pill">
                <span className="quota-label">Remaining:</span>
                <span className="quota-value">{status.usage.remaining.toLocaleString()}</span>
              </div>
            )}
            {status.usage.resetsAt && (
              <div className="quota-pill">
                <span className="quota-label">Resets:</span>
                <span className="quota-value">{status.usage.resetsAt}</span>
              </div>
            )}
          </div>
        )}

        {provider === 'elevenlabs' && status.usage && (
          <div className="status-meta quota-grid">
            {status.usage.tier && (
              <div className="quota-pill">
                <span className="quota-label">Tier:</span>
                <span className="quota-value capitalize">{status.usage.tier}</span>
              </div>
            )}
            {status.usage.characterCount !== undefined && (
              <div className="quota-pill">
                <span className="quota-label">Characters Used:</span>
                <span className="quota-value">{status.usage.characterCount.toLocaleString()}</span>
              </div>
            )}
            {status.usage.characterLimit !== undefined && (
              <div className="quota-pill">
                <span className="quota-label">Allowance:</span>
                <span className="quota-value">{status.usage.characterLimit.toLocaleString()}</span>
              </div>
            )}
            {status.usage.remainingIncludedCharacters !== undefined && (
              <div className="quota-pill">
                <span className="quota-label">
                  {status.usage.isOveragesEnabled ? 'Included Remaining:' : 'Remaining:'}
                </span>
                <span className="quota-value">
                  {status.usage.remainingIncludedCharacters.toLocaleString()}
                </span>
              </div>
            )}
            {status.usage.resetsAt && (
              <div className="quota-pill">
                <span className="quota-label">Next Reset:</span>
                <span className="quota-value">{status.usage.resetsAt}</span>
              </div>
            )}
          </div>
        )}

        {provider === 'ai33pro' && status.usage && status.usage.credits !== undefined && (
          <div className="status-meta quota-grid">
            <div className="quota-pill">
              <span className="quota-label">Available Credits:</span>
              <span className="quota-value">{status.usage.credits.toLocaleString()}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (status.state === 'invalid') {
    return (
      <div className="test-status-box test-status-error">
        <div className="status-header">
          <XCircle size={16} className="text-danger" />
          <span className="status-badge status-invalid">Invalid</span>
          <span className="status-message">{status.message || 'API key was rejected.'}</span>
        </div>
      </div>
    );
  }

  if (status.state === 'quota-exhausted') {
    return (
      <div className="test-status-box test-status-warning">
        <div className="status-header">
          <AlertTriangle size={16} className="text-warning" />
          <span className="status-badge status-quota">Quota exhausted</span>
          <span className="status-message">{status.message || 'Rate limit or monthly quota exceeded.'}</span>
        </div>
      </div>
    );
  }

  if (status.state === 'timeout') {
    return (
      <div className="test-status-box test-status-warning">
        <div className="status-header">
          <Clock size={16} className="text-warning" />
          <span className="status-badge status-timeout">Timed out</span>
          <span className="status-message">{status.message || 'Request timed out after 6 seconds. Please retry.'}</span>
        </div>
      </div>
    );
  }

  // 'unavailable'
  return (
    <div className="test-status-box test-status-error">
      <div className="status-header">
        <Ban size={16} className="text-danger" />
        <span className="status-badge status-unavailable">Blocked or unavailable</span>
        <span className="status-message">{status.message || 'Connection or provider error occurred.'}</span>
      </div>
    </div>
  );
};
