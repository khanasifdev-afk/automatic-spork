import React, { useState, useEffect, useCallback } from 'react';
import {
  KeyRound,
  SlidersHorizontal,
  Save,
  Trash2,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Volume2,
  Layers,
  Check,
} from 'lucide-react';
import {
  loadSettings,
  saveSettings,
  clearStoredApiKeys,
  resetStoredVideoDefaults,
  resetStoredVoiceDefaults,
} from '../storage/settingsStorage';
import {
  SavedSettings,
  KeyTestStatus,
  OutputOrientation,
  VideoQuality,
  TargetSceneLength,
  ElevenLabsOptions,
  ElevenLabsVoice,
  ElevenLabsModel,
  VoiceProvider,
  Ai33SourceProvider,
  Ai33ProOptions,
  Ai33Voice,
} from '../types';
import { testGeminiApiKey } from '../services/gemini';
import { testPexelsApiKey } from '../services/pexels';
import {
  testElevenLabsApiKey,
  fetchElevenLabsVoices,
  fetchElevenLabsModels,
} from '../services/elevenLabs';
import {
  testAi33ProApiKey,
  fetchAi33ProVoices,
} from '../services/ai33Pro';
import { ApiKeyField } from '../components/settings/ApiKeyField';
import { VideoDefaultsForm } from '../components/settings/VideoDefaultsForm';
import { VoiceDefaultsForm } from '../components/settings/VoiceDefaultsForm';
import { Ai33ProDefaultsForm } from '../components/settings/Ai33ProDefaultsForm';
import { ConfirmDialog } from '../components/settings/ConfirmDialog';

export const SettingsPage: React.FC = () => {
  // Loaded / Persisted state
  const [persistedSettings, setPersistedSettings] = useState<SavedSettings>(() => loadSettings());

  // Editable form state (can be tested before saving)
  const [geminiApiKey, setGeminiApiKey] = useState<string>(persistedSettings.geminiApiKey);
  const [pexelsApiKey, setPexelsApiKey] = useState<string>(persistedSettings.pexelsApiKey);
  const [elevenLabsApiKey, setElevenLabsApiKey] = useState<string>(persistedSettings.elevenLabsApiKey);
  const [ai33ProApiKey, setAi33ProApiKey] = useState<string>(persistedSettings.ai33ProApiKey);

  const [orientation, setOrientation] = useState<OutputOrientation>(persistedSettings.defaultOrientation);
  const [quality, setQuality] = useState<VideoQuality>(persistedSettings.defaultQuality);
  const [sceneLength, setSceneLength] = useState<TargetSceneLength>(persistedSettings.defaultSceneLength);
  const [defaultVoiceProvider, setDefaultVoiceProvider] = useState<VoiceProvider>(persistedSettings.defaultVoiceProvider);
  const [voiceDefaults, setVoiceDefaults] = useState<ElevenLabsOptions>(persistedSettings.defaultElevenLabs);
  const [ai33ProDefaults, setAi33ProDefaults] = useState<Ai33ProOptions>(persistedSettings.defaultAi33Pro);

  // Temporary test states
  const [geminiStatus, setGeminiStatus] = useState<KeyTestStatus>({ state: 'not-tested' });
  const [pexelsStatus, setPexelsStatus] = useState<KeyTestStatus>({ state: 'not-tested' });
  const [elevenLabsStatus, setElevenLabsStatus] = useState<KeyTestStatus>({ state: 'not-tested' });
  const [ai33ProStatus, setAi33ProStatus] = useState<KeyTestStatus>({ state: 'not-tested' });

  // Loaded voices and models for ElevenLabs
  const [voices, setVoices] = useState<ElevenLabsVoice[]>([]);
  const [models, setModels] = useState<ElevenLabsModel[]>([]);
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  // Loaded voices for AI33 Pro
  const [ai33Voices, setAi33Voices] = useState<Ai33Voice[]>([]);
  const [isLoadingAi33Voices, setIsLoadingAi33Voices] = useState(false);

  // UI feedback banners
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Confirmation dialog state
  const [dialogState, setDialogState] = useState<{
    isOpen: boolean;
    type: 'clear-keys' | 'reset-defaults' | 'reset-voice-defaults';
  }>({
    isOpen: false,
    type: 'clear-keys',
  });

  const loadAccountVoicesAndModels = useCallback(async (key: string) => {
    if (!key.trim()) {
      setVoices([]);
      setModels([]);
      return;
    }
    setIsLoadingVoices(true);
    setIsLoadingModels(true);
    try {
      const [voicesRes, modelsRes] = await Promise.allSettled([
        fetchElevenLabsVoices(key),
        fetchElevenLabsModels(key),
      ]);
      if (voicesRes.status === 'fulfilled') {
        setVoices(voicesRes.value);
      }
      if (modelsRes.status === 'fulfilled') {
        setModels(modelsRes.value);
      }
    } finally {
      setIsLoadingVoices(false);
      setIsLoadingModels(false);
    }
  }, []);

  const loadAi33Voices = useCallback(async (key: string, provider: Ai33SourceProvider) => {
    if (!key.trim()) {
      setAi33Voices([]);
      return;
    }
    setIsLoadingAi33Voices(true);
    try {
      const loadedVoices = await fetchAi33ProVoices(key, provider);
      setAi33Voices(loadedVoices);
    } catch {
      setAi33Voices([]);
    } finally {
      setIsLoadingAi33Voices(false);
    }
  }, []);

  // Sync state if persistedSettings changes externally and populate voices if key is saved
  useEffect(() => {
    const loaded = loadSettings();
    setPersistedSettings(loaded);
    setGeminiApiKey(loaded.geminiApiKey);
    setPexelsApiKey(loaded.pexelsApiKey);
    setElevenLabsApiKey(loaded.elevenLabsApiKey);
    setAi33ProApiKey(loaded.ai33ProApiKey);
    setOrientation(loaded.defaultOrientation);
    setQuality(loaded.defaultQuality);
    setSceneLength(loaded.defaultSceneLength);
    setDefaultVoiceProvider(loaded.defaultVoiceProvider);
    setVoiceDefaults(loaded.defaultElevenLabs);
    setAi33ProDefaults(loaded.defaultAi33Pro);

    if (loaded.elevenLabsApiKey.trim()) {
      loadAccountVoicesAndModels(loaded.elevenLabsApiKey);
    }
    if (loaded.ai33ProApiKey.trim()) {
      loadAi33Voices(loaded.ai33ProApiKey, loaded.defaultAi33Pro.sourceProvider);
    }
  }, [loadAccountVoicesAndModels, loadAi33Voices]);

  // Handler for Gemini key change (resets test status)
  const handleGeminiKeyChange = (val: string) => {
    setGeminiApiKey(val);
    setGeminiStatus({ state: 'not-tested' });
    setFeedback(null);
  };

  // Handler for Pexels key change (resets test status)
  const handlePexelsKeyChange = (val: string) => {
    setPexelsApiKey(val);
    setPexelsStatus({ state: 'not-tested' });
    setFeedback(null);
  };

  // Handler for ElevenLabs key change (resets test status and loaded voice list)
  const handleElevenLabsKeyChange = (val: string) => {
    setElevenLabsApiKey(val);
    setElevenLabsStatus({ state: 'not-tested' });
    setVoices([]);
    setModels([]);
    setFeedback(null);
  };

  // Handler for AI33 Pro key change (resets test status and loaded voice list)
  const handleAi33ProKeyChange = (val: string) => {
    setAi33ProApiKey(val);
    setAi33ProStatus({ state: 'not-tested' });
    setAi33Voices([]);
    setFeedback(null);
  };

  // Test individual Gemini key
  const handleTestGemini = async () => {
    setGeminiStatus({ state: 'testing' });
    const result = await testGeminiApiKey(geminiApiKey);
    setGeminiStatus(result);
  };

  // Test individual Pexels key
  const handleTestPexels = async () => {
    setPexelsStatus({ state: 'testing' });
    const result = await testPexelsApiKey(pexelsApiKey);
    setPexelsStatus(result);
  };

  // Test individual ElevenLabs key
  const handleTestElevenLabs = async () => {
    setElevenLabsStatus({ state: 'testing' });
    const result = await testElevenLabsApiKey(elevenLabsApiKey);
    setElevenLabsStatus(result);
    if (result.state === 'valid') {
      loadAccountVoicesAndModels(elevenLabsApiKey);
    }
  };

  // Test individual AI33 Pro key
  const handleTestAi33Pro = async () => {
    setAi33ProStatus({ state: 'testing' });
    const result = await testAi33ProApiKey(ai33ProApiKey);
    setAi33ProStatus(result);
    if (result.state === 'valid') {
      loadAi33Voices(ai33ProApiKey, ai33ProDefaults.sourceProvider);
    }
  };

  // Test All Keys in parallel without blocking one on another
  const handleTestAll = async () => {
    const runGemini = async () => {
      if (geminiApiKey.trim()) {
        setGeminiStatus({ state: 'testing' });
        const res = await testGeminiApiKey(geminiApiKey);
        setGeminiStatus(res);
      } else {
        setGeminiStatus({ state: 'invalid', message: 'Enter an API key first.' });
      }
    };

    const runPexels = async () => {
      if (pexelsApiKey.trim()) {
        setPexelsStatus({ state: 'testing' });
        const res = await testPexelsApiKey(pexelsApiKey);
        setPexelsStatus(res);
      } else {
        setPexelsStatus({ state: 'invalid', message: 'Enter an API key first.' });
      }
    };

    const runElevenLabs = async () => {
      if (elevenLabsApiKey.trim()) {
        setElevenLabsStatus({ state: 'testing' });
        const res = await testElevenLabsApiKey(elevenLabsApiKey);
        setElevenLabsStatus(res);
        if (res.state === 'valid') {
          loadAccountVoicesAndModels(elevenLabsApiKey);
        }
      } else {
        setElevenLabsStatus({ state: 'invalid', message: 'Enter an API key first.' });
      }
    };

    const runAi33Pro = async () => {
      if (ai33ProApiKey.trim()) {
        setAi33ProStatus({ state: 'testing' });
        const res = await testAi33ProApiKey(ai33ProApiKey);
        setAi33ProStatus(res);
        if (res.state === 'valid') {
          loadAi33Voices(ai33ProApiKey, ai33ProDefaults.sourceProvider);
        }
      } else {
        setAi33ProStatus({ state: 'invalid', message: 'Enter an API key first.' });
      }
    };

    await Promise.allSettled([runGemini(), runPexels(), runElevenLabs(), runAi33Pro()]);
  };

  // Save settings action
  const handleSaveSettings = () => {
    const toSave: SavedSettings = {
      geminiApiKey: geminiApiKey.trim(),
      pexelsApiKey: pexelsApiKey.trim(),
      elevenLabsApiKey: elevenLabsApiKey.trim(),
      ai33ProApiKey: ai33ProApiKey.trim(),
      defaultOrientation: orientation,
      defaultQuality: quality,
      defaultSceneLength: sceneLength,
      defaultVoiceProvider,
      defaultElevenLabs: voiceDefaults,
      defaultAi33Pro: ai33ProDefaults,
      // Preserve the defaultStockMediaType that was loaded; it is managed per-job in JobOptions
      defaultStockMediaType: persistedSettings.defaultStockMediaType,
    };

    const saved = saveSettings(toSave);
    setPersistedSettings(saved);
    setGeminiApiKey(saved.geminiApiKey);
    setPexelsApiKey(saved.pexelsApiKey);
    setElevenLabsApiKey(saved.elevenLabsApiKey);
    setAi33ProApiKey(saved.ai33ProApiKey);
    setFeedback({
      type: 'success',
      message: 'Settings saved successfully to this browser.',
    });

    setTimeout(() => {
      setFeedback(null);
    }, 4000);
  };

  // Confirm Clear Keys
  const handleConfirmClearKeys = () => {
    const updated = clearStoredApiKeys();
    setPersistedSettings(updated);
    setGeminiApiKey('');
    setPexelsApiKey('');
    setElevenLabsApiKey('');
    setAi33ProApiKey('');
    setGeminiStatus({ state: 'not-tested' });
    setPexelsStatus({ state: 'not-tested' });
    setElevenLabsStatus({ state: 'not-tested' });
    setAi33ProStatus({ state: 'not-tested' });
    setVoices([]);
    setModels([]);
    setAi33Voices([]);
    setDialogState({ isOpen: false, type: 'clear-keys' });
    setFeedback({
      type: 'success',
      message: 'All API keys cleared from local storage.',
    });
  };

  // Confirm Reset Video Defaults
  const handleConfirmResetDefaults = () => {
    const updated = resetStoredVideoDefaults();
    setPersistedSettings(updated);
    setOrientation(updated.defaultOrientation);
    setQuality(updated.defaultQuality);
    setSceneLength(updated.defaultSceneLength);
    setDialogState({ isOpen: false, type: 'reset-defaults' });
    setFeedback({
      type: 'success',
      message: 'Video defaults reset to initial recommendations.',
    });
  };

  // Confirm Reset Voice Defaults
  const handleConfirmResetVoiceDefaults = () => {
    const updated = resetStoredVoiceDefaults();
    setPersistedSettings(updated);
    setDefaultVoiceProvider(updated.defaultVoiceProvider);
    setVoiceDefaults(updated.defaultElevenLabs);
    setAi33ProDefaults(updated.defaultAi33Pro);
    setDialogState({ isOpen: false, type: 'reset-voice-defaults' });
    setFeedback({
      type: 'success',
      message: 'Voice defaults reset to initial values.',
    });
  };

  const isAnyTesting =
    geminiStatus.state === 'testing' ||
    pexelsStatus.state === 'testing' ||
    elevenLabsStatus.state === 'testing' ||
    ai33ProStatus.state === 'testing';

  const hasAnyKey =
    Boolean(geminiApiKey.trim()) ||
    Boolean(pexelsApiKey.trim()) ||
    Boolean(elevenLabsApiKey.trim()) ||
    Boolean(ai33ProApiKey.trim());

  const hasSavedKeys =
    Boolean(persistedSettings.geminiApiKey) ||
    Boolean(persistedSettings.pexelsApiKey) ||
    Boolean(persistedSettings.elevenLabsApiKey) ||
    Boolean(persistedSettings.ai33ProApiKey);

  return (
    <div className="settings-page">
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-description">
          Configure API credentials, video options, and default voice settings for ElevenLabs and AI33 Pro.
        </p>
      </div>

      {feedback && (
        <div className={`notification-banner banner-${feedback.type}`}>
          {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* API Connections Section */}
      <div className="card settings-section-card">
        <div className="section-title-row">
          <div className="title-left">
            <KeyRound size={22} className="text-primary" />
            <div>
              <h2 className="section-heading">API Connections</h2>
              <p className="section-subtext">
                Credentials are stored exclusively in your browser's local storage and used directly for API requests.
              </p>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            title="Test connection and validity of all entered API keys"
            onClick={handleTestAll}
            disabled={!hasAnyKey || isAnyTesting}
          >
            <Sparkles size={15} />
            <span>Test All Keys</span>
          </button>
        </div>

        <div className="fields-container">
          <ApiKeyField
            id="gemini-api-key"
            label="Google Gemini API Key"
            provider="gemini"
            value={geminiApiKey}
            onChange={handleGeminiKeyChange}
            onTest={handleTestGemini}
            testStatus={geminiStatus}
            isSaved={Boolean(persistedSettings.geminiApiKey)}
            helperText="Required for script segmentation and search query generation via gemini-2.5-flash."
          />

          <ApiKeyField
            id="pexels-api-key"
            label="Pexels Video API Key"
            provider="pexels"
            value={pexelsApiKey}
            onChange={handlePexelsKeyChange}
            onTest={handleTestPexels}
            testStatus={pexelsStatus}
            isSaved={Boolean(persistedSettings.pexelsApiKey)}
            helperText="Required for searching, previewing, and retrieving stock video candidates."
          />

          <ApiKeyField
            id="elevenlabs-api-key"
            label="ElevenLabs API Key"
            provider="elevenlabs"
            value={elevenLabsApiKey}
            onChange={handleElevenLabsKeyChange}
            onTest={handleTestElevenLabs}
            testStatus={elevenLabsStatus}
            isSaved={Boolean(persistedSettings.elevenLabsApiKey)}
            helperText="Required for generating text-to-speech voice narration via ElevenLabs."
          />

          <ApiKeyField
            id="ai33pro-api-key"
            label="AI33 Pro API Key"
            provider="ai33pro"
            value={ai33ProApiKey}
            onChange={handleAi33ProKeyChange}
            onTest={handleTestAi33Pro}
            testStatus={ai33ProStatus}
            isSaved={Boolean(persistedSettings.ai33ProApiKey)}
            helperText="Required for generating text-to-speech voice narration via AI33 Pro."
          />
        </div>
      </div>

      {/* Default Video Settings Section */}
      <div className="card settings-section-card">
        <div className="section-title-row">
          <div className="title-left">
            <SlidersHorizontal size={22} className="text-primary" />
            <div>
              <h2 className="section-heading">Default Video Settings</h2>
              <p className="section-subtext">
                These preferences prefill every new script job on the Workspace. You can still adjust them per job.
              </p>
            </div>
          </div>
        </div>

        <VideoDefaultsForm
          orientation={orientation}
          quality={quality}
          sceneLength={sceneLength}
          onChangeOrientation={setOrientation}
          onChangeQuality={setQuality}
          onChangeSceneLength={setSceneLength}
        />
      </div>

      {/* Voice Service & Defaults Section */}
      <div className="card settings-section-card">
        <div className="section-title-row">
          <div className="title-left">
            <Volume2 size={22} className="text-primary" />
            <div>
              <h2 className="section-heading">Default Voice Settings</h2>
              <p className="section-subtext">
                Configure your preferred default voice provider and default parameters for each provider.
              </p>
            </div>
          </div>
        </div>

        {/* Default Voice Service Selector */}
        <div className="form-group" style={{ marginBottom: '2rem' }}>
          <div className="field-header" style={{ marginBottom: '0.5rem' }}>
            <label htmlFor="default-voice-provider" className="field-label">
              Default Voice Service
            </label>
            <span className="field-hint">
              Preselected service for new workflows on the Workspace.
            </span>
          </div>

          {/* Interactive Provider Cards */}
          <div className="provider-service-cards-grid">
            <button
              type="button"
              className={`provider-service-card ${defaultVoiceProvider === 'elevenlabs' ? 'active-elevenlabs' : ''}`}
              onClick={() => setDefaultVoiceProvider('elevenlabs')}
            >
              <div className="provider-service-card-header">
                <span className="provider-service-card-title">
                  <Volume2 size={18} style={{ color: '#7c3aed' }} />
                  <span>ElevenLabs</span>
                </span>
                {defaultVoiceProvider === 'elevenlabs' ? (
                  <span className="badge badge-primary" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Check size={12} />
                    <span>Active Default</span>
                  </span>
                ) : (
                  <span className="provider-tag provider-tag-elevenlabs">Direct API</span>
                )}
              </div>
              <p className="provider-service-card-desc">
                Direct official ElevenLabs API. High-expression speech, custom models (Multilingual v2, Turbo v2), voice fine-tuning & stability controls.
              </p>
              <div className="provider-feature-list">
                <span className="provider-feature-chip">Voice Cloning</span>
                <span className="provider-feature-chip">Model Selection</span>
                <span className="provider-feature-chip">Clarity & Stability</span>
                <span className="provider-feature-chip">Bitrate Formats</span>
              </div>
            </button>

            <button
              type="button"
              className={`provider-service-card ${defaultVoiceProvider === 'ai33pro' ? 'active-ai33pro' : ''}`}
              onClick={() => setDefaultVoiceProvider('ai33pro')}
            >
              <div className="provider-service-card-header">
                <span className="provider-service-card-title">
                  <Layers size={18} style={{ color: '#059669' }} />
                  <span>AI33 Pro</span>
                </span>
                {defaultVoiceProvider === 'ai33pro' ? (
                  <span className="badge badge-primary" style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#059669' }}>
                    <Check size={12} />
                    <span>Active Default</span>
                  </span>
                ) : (
                  <span className="provider-tag provider-tag-ai33pro">Multi-Engine</span>
                )}
              </div>
              <p className="provider-service-card-desc">
                Unified OpenSpeaker proxy API. Access Minimax, Edge TTS, Kokoro, Vbee, Fish Audio, and Voice Cloning with custom speed control.
              </p>
              <div className="provider-feature-list">
                <span className="provider-feature-chip">Minimax & Edge</span>
                <span className="provider-feature-chip">Kokoro & Fish Audio</span>
                <span className="provider-feature-chip">Vbee & Clones</span>
                <span className="provider-feature-chip">Speed Scaling</span>
              </div>
            </button>
          </div>

          {/* Native Select for accessibility & testing */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
              Quick selector:
            </span>
            <select
              id="default-voice-provider"
              className="form-select"
              style={{ maxWidth: '200px' }}
              value={defaultVoiceProvider}
              onChange={(e) => setDefaultVoiceProvider(e.target.value as VoiceProvider)}
              aria-label="Select default voice service"
            >
              <option value="elevenlabs">ElevenLabs</option>
              <option value="ai33pro">AI33 Pro</option>
            </select>
          </div>
        </div>

        {/* ElevenLabs Defaults Panel */}
        <div className="voice-provider-panel panel-elevenlabs">
          <div className="voice-provider-panel-header">
            <div className="voice-provider-header-left">
              <Volume2 size={20} style={{ color: '#7c3aed' }} />
              <div>
                <h3 className="voice-provider-header-title">
                  ElevenLabs Defaults
                  <span className="provider-tag provider-tag-elevenlabs">Direct API</span>
                  {defaultVoiceProvider === 'elevenlabs' && (
                    <span className="badge badge-primary">Active Workflow Default</span>
                  )}
                </h3>
                <p className="voice-provider-header-desc">
                  ElevenLabs-specific models, stability, clarity, style exaggeration, and audio bitrate settings.
                </p>
              </div>
            </div>
          </div>
          <div className="voice-provider-panel-body">
            <VoiceDefaultsForm
              options={voiceDefaults}
              onChange={(updates) => setVoiceDefaults((prev) => ({ ...prev, ...updates }))}
              voices={voices}
              models={models}
              isLoadingVoices={isLoadingVoices}
              isLoadingModels={isLoadingModels}
            />
          </div>
        </div>

        {/* AI33 Pro Defaults Panel */}
        <div className="voice-provider-panel panel-ai33pro">
          <div className="voice-provider-panel-header">
            <div className="voice-provider-header-left">
              <Layers size={20} style={{ color: '#059669' }} />
              <div>
                <h3 className="voice-provider-header-title">
                  AI33 Pro Defaults
                  <span className="provider-tag provider-tag-ai33pro">Multi-Engine Proxy</span>
                  {defaultVoiceProvider === 'ai33pro' && (
                    <span className="badge badge-primary" style={{ backgroundColor: '#059669' }}>Active Workflow Default</span>
                  )}
                </h3>
                <p className="voice-provider-header-desc">
                  OpenSpeaker multi-engine provider (Minimax, Edge, Kokoro, Vbee, Fish Audio), prefixed voice library, and speech rate.
                </p>
              </div>
            </div>
          </div>
          <div className="voice-provider-panel-body">
            <Ai33ProDefaultsForm
              options={ai33ProDefaults}
              onChange={(updates) => {
                const next = { ...ai33ProDefaults, ...updates };
                setAi33ProDefaults(next);
                if (updates.sourceProvider && ai33ProApiKey.trim()) {
                  loadAi33Voices(ai33ProApiKey, updates.sourceProvider);
                }
              }}
              voices={ai33Voices}
              isLoadingVoices={isLoadingAi33Voices}
            />
          </div>
        </div>
      </div>

      {/* Actions Toolbar */}
      <div className="settings-actions-bar">
        <div className="actions-left">
          <button
            type="button"
            className="btn btn-danger-outline"
            title="Permanently remove saved API keys from browser storage"
            onClick={() => setDialogState({ isOpen: true, type: 'clear-keys' })}
            disabled={!hasAnyKey && !hasSavedKeys}
          >
            <Trash2 size={16} />
            <span>Clear API Keys</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            title="Restore default video orientation, quality, and scene duration"
            onClick={() => setDialogState({ isOpen: true, type: 'reset-defaults' })}
          >
            <RotateCcw size={16} />
            <span>Reset Video Defaults</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            title="Restore default voice settings for both ElevenLabs and AI33 Pro"
            onClick={() => setDialogState({ isOpen: true, type: 'reset-voice-defaults' })}
          >
            <RotateCcw size={16} />
            <span>Reset Voice Defaults</span>
          </button>
        </div>

        <div className="actions-right">
          <button
            type="button"
            className="btn btn-primary btn-save"
            title="Save API keys, video settings, and voice settings to local storage"
            onClick={handleSaveSettings}
          >
            <Save size={16} />
            <span>Save Settings</span>
          </button>
        </div>
      </div>

      {/* Confirmation Dialogs */}
      <ConfirmDialog
        isOpen={dialogState.isOpen && dialogState.type === 'clear-keys'}
        title="Clear All API Keys?"
        message="This will remove your Gemini, Pexels, ElevenLabs, and AI33 Pro API keys from local storage. Your video and voice default preferences will remain intact."
        confirmLabel="Clear Keys"
        confirmVariant="danger"
        onConfirm={handleConfirmClearKeys}
        onCancel={() => setDialogState((prev) => ({ ...prev, isOpen: false }))}
      />

      <ConfirmDialog
        isOpen={dialogState.isOpen && dialogState.type === 'reset-defaults'}
        title="Reset Video Defaults?"
        message="This will restore orientation (Landscape 16:9), quality (1080p), and scene duration (Standard 5–8s) to default recommendations. Your API keys and voice settings will not be affected."
        confirmLabel="Reset Defaults"
        confirmVariant="primary"
        onConfirm={handleConfirmResetDefaults}
        onCancel={() => setDialogState((prev) => ({ ...prev, isOpen: false }))}
      />

      <ConfirmDialog
        isOpen={dialogState.isOpen && dialogState.type === 'reset-voice-defaults'}
        title="Reset Voice Defaults?"
        message="This will restore all voice controls for both ElevenLabs and AI33 Pro to standard defaults. Your API keys and video preferences will not be affected."
        confirmLabel="Reset Voice Defaults"
        confirmVariant="primary"
        onConfirm={handleConfirmResetVoiceDefaults}
        onCancel={() => setDialogState((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
