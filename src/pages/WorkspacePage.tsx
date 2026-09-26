import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Film, Volume2, Search, Package } from 'lucide-react';
import { useWorkflowStore } from '../store/workflowStore';
import { loadSettings } from '../storage/settingsStorage';
import { JobOptions } from '../components/workflow/JobOptions';
import { ScriptInput } from '../components/workflow/ScriptInput';
import { BulkWorkflowPanel } from '../components/workflow/BulkWorkflowPanel';
import { SceneEditor } from '../components/workflow/SceneEditor';
import { VoiceGenerationPanel } from '../components/workflow/VoiceGenerationPanel';
import { ClipsReview } from '../components/workflow/ClipsReview';
import { PackagingPanel } from '../components/workflow/PackagingPanel';
import { fetchElevenLabsVoices, fetchElevenLabsModels } from '../services/elevenLabs';
import { fetchAi33ProVoices } from '../services/ai33Pro';
import { ElevenLabsVoice, ElevenLabsModel, Ai33Voice } from '../types';

export const WorkspacePage: React.FC = () => {
  const navigate = useNavigate();

  const {
    step,
    status,
    script,
    options,
    scenes,
    searchStateByScene,
    imageSearchStateByScene,
    voiceStateByScene,
    isVoiceBatchRunning,
    excludedSceneIds,
    error,
    exportState,
    bulkWorkflowStatus,
    initializeFromSettings,
    setScript,
    setOptions,
    switchVoiceProvider,
    setStep,
    analyzeScript,
    cancelAnalysis,
    editScene,
    splitScene,
    mergeScenes,
    deleteScene,
    reorderScene,
    startOver,
    proceedToVoices,
    generateAllVoices,
    generateSceneVoice,
    retryFailedVoices,
    cancelVoiceGeneration,
    proceedToClips,
    searchAllScenes,
    searchScene,
    searchAllImages,
    searchSceneImages,
    excludeScene,
    restoreScene,
    canProceedToPackaging,
    proceedToPackaging,
    startExport,
    cancelExport,
    retryClipDownload,
    downloadZipFile,
    runBulkWorkflow,
    cancelBulkWorkflow,
  } = useWorkflowStore();

  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [pexelsApiKey, setPexelsApiKey] = useState('');
  const [elevenLabsApiKey, setElevenLabsApiKey] = useState('');
  const [ai33ProApiKey, setAi33ProApiKey] = useState('');
  const [voices, setVoices] = useState<ElevenLabsVoice[]>([]);
  const [models, setModels] = useState<ElevenLabsModel[]>([]);
  const [ai33Voices, setAi33Voices] = useState<Ai33Voice[]>([]);
  const [isLoadingAi33Voices, setIsLoadingAi33Voices] = useState(false);

  useEffect(() => {
    initializeFromSettings();
    const settings = loadSettings();
    setGeminiApiKey(settings.geminiApiKey);
    setPexelsApiKey(settings.pexelsApiKey);
    const elKey = settings.elevenLabsApiKey || '';
    setElevenLabsApiKey(elKey);
    const aiKey = settings.ai33ProApiKey || '';
    setAi33ProApiKey(aiKey);

    if (elKey.trim()) {
      fetchElevenLabsVoices(elKey).then(setVoices).catch(() => {});
      fetchElevenLabsModels(elKey).then(setModels).catch(() => {});
    }
  }, [initializeFromSettings]);

  // Load AI33 Pro voices whenever AI33 Pro is active or sourceProvider changes
  const ai33SourceProvider = options.ai33Pro?.sourceProvider || 'elevenlabs';
  useEffect(() => {
    if (options.voiceProvider === 'ai33pro' && ai33ProApiKey.trim()) {
      setIsLoadingAi33Voices(true);
      fetchAi33ProVoices(ai33ProApiKey, ai33SourceProvider)
        .then(setAi33Voices)
        .catch(() => setAi33Voices([]))
        .finally(() => setIsLoadingAi33Voices(false));
    }
  }, [options.voiceProvider, ai33ProApiKey, ai33SourceProvider]);

  // When reaching step 5 (packaging), automatically start the export process if idle
  useEffect(() => {
    if (step === 'packaging' && (!exportState || exportState.stage === 'idle')) {
      startExport();
    }
  }, [step, exportState, startExport]);

  const handleAnalyze = () => {
    const settings = loadSettings();
    setGeminiApiKey(settings.geminiApiKey);
    analyzeScript(settings.geminiApiKey);
  };

  const hasExistingAudio = Object.values(voiceStateByScene).some(
    (seg) =>
      seg &&
      (seg.status === 'ready' ||
        seg.status === 'generating' ||
        seg.status === 'failed' ||
        seg.status === 'stale' ||
        seg.status === 'cancelled' ||
        seg.status === 'queued')
  );

  const activeVoiceApiKey =
    options.voiceProvider === 'ai33pro' ? ai33ProApiKey : elevenLabsApiKey;

  return (
    <div className="workspace-page">
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">Script to Video Workspace</h1>
        <p className="page-description">
          Convert your YouTube narration into a sequence of relevant Pexels stock-video clips and AI voice narration.
        </p>
      </div>

      {/* Workflow Step Tracker */}
      <nav className="workflow-stepper" aria-label="Video Generation Steps">
        <div className={`stepper-item ${step === 'setup' ? 'current' : 'completed'}`}>
          <div className="step-circle">
            <FileText size={16} />
          </div>
          <div className="step-labels">
            <span className="step-tag">Step 1</span>
            <span className="step-name">Script & Options</span>
          </div>
        </div>

        <div className="stepper-line" />

        <div
          className={`stepper-item ${
            step === 'scenes'
              ? 'current'
              : step === 'voices' || step === 'clips' || step === 'packaging' || step === 'complete'
              ? 'completed'
              : 'upcoming'
          }`}
        >
          <div className="step-circle">
            <Film size={16} />
          </div>
          <div className="step-labels">
            <span className="step-tag">Step 2</span>
            <span className="step-name">Scene Analysis</span>
          </div>
        </div>

        <div className="stepper-line" />

        <div
          className={`stepper-item ${
            step === 'voices'
              ? 'current'
              : step === 'clips' || step === 'packaging' || step === 'complete'
              ? 'completed'
              : 'upcoming'
          }`}
        >
          <div className="step-circle">
            <Volume2 size={16} />
          </div>
          <div className="step-labels">
            <span className="step-tag">Step 3</span>
            <span className="step-name">Voice Narration</span>
          </div>
        </div>

        <div className="stepper-line" />

        <div
          className={`stepper-item ${
            step === 'clips'
              ? 'current'
              : step === 'packaging' || step === 'complete'
              ? 'completed'
              : 'upcoming'
          }`}
        >
          <div className="step-circle">
            <Search size={16} />
          </div>
          <div className="step-labels">
            <span className="step-tag">Step 4</span>
            <span className="step-name">Clip Selection</span>
          </div>
        </div>

        <div className="stepper-line" />

        <div className={`stepper-item ${step === 'packaging' || step === 'complete' ? 'current' : 'upcoming'}`}>
          <div className="step-circle">
            <Package size={16} />
          </div>
          <div className="step-labels">
            <span className="step-tag">Step 5</span>
            <span className="step-name">Export</span>
          </div>
        </div>
      </nav>

      {/* Step 1: Script Intake and Options */}
      {step === 'setup' && (
        <div className="workflow-step-content">
          <JobOptions
            options={options}
            onChange={setOptions}
            onSwitchVoiceProvider={switchVoiceProvider}
            voices={voices}
            models={models}
            ai33Voices={ai33Voices}
            isLoadingAi33Voices={isLoadingAi33Voices}
            hasExistingAudio={hasExistingAudio}
            scriptText={script}
            disabled={status === 'analyzing'}
          />

          <BulkWorkflowPanel
            status={bulkWorkflowStatus}
            hasScript={script.trim().length > 0}
            hasGeminiKey={Boolean(geminiApiKey.trim())}
            hasPexelsKey={Boolean(pexelsApiKey.trim())}
            hasVoiceKey={Boolean(activeVoiceApiKey.trim())}
            onRun={() => runBulkWorkflow(geminiApiKey, activeVoiceApiKey, pexelsApiKey)}
            onCancel={cancelBulkWorkflow}
          />

          <ScriptInput
            script={script}
            hasGeminiKey={Boolean(geminiApiKey.trim())}
            status={status}
            error={error}
            onScriptChange={setScript}
            onAnalyze={handleAnalyze}
            onCancel={cancelAnalysis}
          />
        </div>
      )}

      {/* Step 2: Scene Review and Editing */}
      {step === 'scenes' && (
        <div className="workflow-step-content">
          <SceneEditor
            scenes={scenes}
            options={options}
            onEditScene={editScene}
            onSplitScene={splitScene}
            onMergeScenes={mergeScenes}
            onDeleteScene={deleteScene}
            onMoveScene={reorderScene}
            onProceedToVoices={proceedToVoices}
            onFindClips={proceedToClips}
            onAnalyzeAgain={handleAnalyze}
            onStartOver={startOver}
          />
        </div>
      )}

      {/* Step 3: Voice Narration (ElevenLabs or AI33 Pro) */}
      {step === 'voices' && (
        <div className="workflow-step-content">
          <VoiceGenerationPanel
            scenes={scenes}
            options={options}
            voiceStateByScene={voiceStateByScene}
            isVoiceBatchRunning={isVoiceBatchRunning}
            excludedSceneIds={excludedSceneIds}
            elevenLabsApiKey={elevenLabsApiKey}
            ai33ProApiKey={ai33ProApiKey}
            voices={voices}
            ai33Voices={ai33Voices}
            onGenerateAll={() => generateAllVoices(activeVoiceApiKey)}
            onRetryScene={(sceneId) => generateSceneVoice(sceneId, activeVoiceApiKey, false)}
            onRegenerateScene={(sceneId) => generateSceneVoice(sceneId, activeVoiceApiKey, true)}
            onRetryFailed={() => retryFailedVoices(activeVoiceApiKey)}
            onCancelGeneration={cancelVoiceGeneration}
            onProceedToClips={proceedToClips}
            onBackToScenes={() => setStep('scenes')}
            onStartOver={startOver}
            onNavigateToSettings={() => navigate('/settings')}
          />
        </div>
      )}

      {/* Step 4: Clips Review and Selection */}
      {step === 'clips' && (
        <div className="workflow-step-content">
          <ClipsReview
            scenes={scenes}
            options={options}
            searchStateByScene={searchStateByScene}
            imageSearchStateByScene={imageSearchStateByScene}
            excludedSceneIds={excludedSceneIds}
            pexelsApiKey={pexelsApiKey}
            onSearchAll={searchAllScenes}
            onSearchScene={searchScene}
            onSearchAllImages={searchAllImages}
            onSearchSceneImages={searchSceneImages}
            onExcludeScene={excludeScene}
            onRestoreScene={restoreScene}
            canProceedToPackaging={canProceedToPackaging}
            onProceedToPackaging={proceedToPackaging}
            onBackToVoices={() => setStep('voices')}
            onBackToScenes={() => setStep('voices')}
            onStartOver={startOver}
            onNavigateToSettings={() => navigate('/settings')}
          />
        </div>
      )}

      {/* Step 5: Download and Packaging */}
      {(step === 'packaging' || step === 'complete') && (
        <div className="workflow-step-content">
          <PackagingPanel
            exportState={exportState}
            scenes={scenes.filter((s) => !excludedSceneIds.includes(s.id))}
            voiceStateByScene={voiceStateByScene}
            onStartExport={startExport}
            onCancelExport={cancelExport}
            onRetryClip={retryClipDownload}
            onDownloadZip={downloadZipFile}
            onBackToClips={() => setStep('clips')}
            onStartOver={startOver}
          />
        </div>
      )}
    </div>
  );
};
