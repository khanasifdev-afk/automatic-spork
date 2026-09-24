import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VoiceGenerationPanel } from './VoiceGenerationPanel';
import { Scene, VoiceSegmentState, WorkflowOptions } from '../../types';

describe('VoiceGenerationPanel', () => {
  const defaultOptions: WorkflowOptions = {
    orientation: 'landscape',
    quality: '1080p',
    sceneLength: 'standard',
    elevenLabs: {
      voiceId: '21m00Tcm4TlvDq8ikWAM',
      modelId: 'eleven_multilingual_v2',
      outputFormat: 'mp3_44100_128',
      stability: 0.5,
      similarityBoost: 0.75,
      style: 0,
      speed: 1,
      useSpeakerBoost: true,
    },
  };

  const mockScenes: Scene[] = [
    {
      id: 'scene-1',
      sequence: 1,
      scriptText: 'Welcome to this trail hiking tutorial.',
      visualDescription: 'A hiker on a mountain trail',
      primaryQuery: 'hiker mountain trail',
      fallbackQueries: [],
      avoidTerms: [],
      estimatedSeconds: 4,
    },
    {
      id: 'scene-2',
      sequence: 2,
      scriptText: 'Always pack plenty of clean water.',
      visualDescription: 'Water bottle being placed into a backpack',
      primaryQuery: 'hiking water bottle backpack',
      fallbackQueries: [],
      avoidTerms: [],
      estimatedSeconds: 3,
    },
  ];

  it('renders header, metrics bar, and planning character estimate disclaimer', () => {
    render(
      <VoiceGenerationPanel
        scenes={mockScenes}
        options={defaultOptions}
        voiceStateByScene={{}}
        isVoiceBatchRunning={false}
        excludedSceneIds={[]}
        elevenLabsApiKey="test-eleven-key"
        onGenerateAll={vi.fn()}
        onRetryScene={vi.fn()}
        onRegenerateScene={vi.fn()}
        onRetryFailed={vi.fn()}
        onCancelGeneration={vi.fn()}
        onProceedToClips={vi.fn()}
        onBackToScenes={vi.fn()}
        onStartOver={vi.fn()}
        onNavigateToSettings={vi.fn()}
      />
    );

    expect(screen.getByText(/Voice Narration & Review/i)).toBeInTheDocument();
    expect(screen.getByText('Included Scenes')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText(/Character count is a planning estimate/i)).toBeInTheDocument();
    expect(screen.getByText(/Welcome to this trail hiking tutorial/i)).toBeInTheDocument();
    expect(screen.getByText(/Always pack plenty of clean water/i)).toBeInTheDocument();
  });

  it('shows warning and Settings button when ElevenLabs API key is missing', async () => {
    const user = userEvent.setup();
    const navSpy = vi.fn();

    render(
      <VoiceGenerationPanel
        scenes={mockScenes}
        options={defaultOptions}
        voiceStateByScene={{}}
        isVoiceBatchRunning={false}
        excludedSceneIds={[]}
        elevenLabsApiKey=""
        onGenerateAll={vi.fn()}
        onRetryScene={vi.fn()}
        onRegenerateScene={vi.fn()}
        onRetryFailed={vi.fn()}
        onCancelGeneration={vi.fn()}
        onProceedToClips={vi.fn()}
        onBackToScenes={vi.fn()}
        onStartOver={vi.fn()}
        onNavigateToSettings={navSpy}
      />
    );

    expect(screen.getByText(/ElevenLabs API Key Required/i)).toBeInTheDocument();
    const settingsBtn = screen.getByRole('button', { name: /Go to Settings/i });
    await user.click(settingsBtn);
    expect(navSpy).toHaveBeenCalled();
  });

  it('calls onGenerateAll when Generate All Voices button is clicked', async () => {
    const user = userEvent.setup();
    const genSpy = vi.fn();

    render(
      <VoiceGenerationPanel
        scenes={mockScenes}
        options={defaultOptions}
        voiceStateByScene={{}}
        isVoiceBatchRunning={false}
        excludedSceneIds={[]}
        elevenLabsApiKey="test-eleven-key"
        onGenerateAll={genSpy}
        onRetryScene={vi.fn()}
        onRegenerateScene={vi.fn()}
        onRetryFailed={vi.fn()}
        onCancelGeneration={vi.fn()}
        onProceedToClips={vi.fn()}
        onBackToScenes={vi.fn()}
        onStartOver={vi.fn()}
        onNavigateToSettings={vi.fn()}
      />
    );

    const generateBtn = screen.getByRole('button', { name: /Generate All Voices/i });
    expect(generateBtn).toBeEnabled();
    await user.click(generateBtn);
    expect(genSpy).toHaveBeenCalledTimes(1);
  });

  it('displays cancel button when batch is running and calls onCancelGeneration', async () => {
    const user = userEvent.setup();
    const cancelSpy = vi.fn();

    render(
      <VoiceGenerationPanel
        scenes={mockScenes}
        options={defaultOptions}
        voiceStateByScene={{}}
        isVoiceBatchRunning={true}
        excludedSceneIds={[]}
        elevenLabsApiKey="test-eleven-key"
        onGenerateAll={vi.fn()}
        onRetryScene={vi.fn()}
        onRegenerateScene={vi.fn()}
        onRetryFailed={vi.fn()}
        onCancelGeneration={cancelSpy}
        onProceedToClips={vi.fn()}
        onBackToScenes={vi.fn()}
        onStartOver={vi.fn()}
        onNavigateToSettings={vi.fn()}
      />
    );

    const cancelBtn = screen.getByRole('button', { name: /Cancel Generation/i });
    await user.click(cancelBtn);
    expect(cancelSpy).toHaveBeenCalledTimes(1);
  });

  it('displays audio player and measured duration for ready scene', () => {
    const voiceState: Record<string, VoiceSegmentState> = {
      'scene-1': {
        sceneId: 'scene-1',
        provider: 'elevenlabs',
        status: 'ready',
        sourceTextFingerprint: 'fp1',
        settingsFingerprint: 'sfp',
        audioBlob: new Blob(['audio-data'], { type: 'audio/mpeg' }),
        audioUrl: 'blob:http://localhost/mock-audio-1',
        durationSeconds: 4.5,
        requestId: 'req-1',
        error: null,
      },
    };

    render(
      <VoiceGenerationPanel
        scenes={mockScenes}
        options={defaultOptions}
        voiceStateByScene={voiceState}
        isVoiceBatchRunning={false}
        excludedSceneIds={[]}
        elevenLabsApiKey="test-eleven-key"
        onGenerateAll={vi.fn()}
        onRetryScene={vi.fn()}
        onRegenerateScene={vi.fn()}
        onRetryFailed={vi.fn()}
        onCancelGeneration={vi.fn()}
        onProceedToClips={vi.fn()}
        onBackToScenes={vi.fn()}
        onStartOver={vi.fn()}
        onNavigateToSettings={vi.fn()}
      />
    );

    expect(screen.getAllByText('Ready').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/4.5s duration/i)).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Audio playback for Scene 1/i)
    ).toHaveAttribute('src', 'blob:http://localhost/mock-audio-1');
  });

  it('shows confirmation modal before regenerating ready segment and calls onRegenerateScene', async () => {
    const user = userEvent.setup();
    const regenSpy = vi.fn();

    const voiceState: Record<string, VoiceSegmentState> = {
      'scene-1': {
        sceneId: 'scene-1',
        provider: 'elevenlabs',
        status: 'ready',
        sourceTextFingerprint: 'fp1',
        settingsFingerprint: 'sfp',
        audioBlob: new Blob(['audio-data'], { type: 'audio/mpeg' }),
        audioUrl: 'blob:http://localhost/mock-audio-1',
        durationSeconds: 4.5,
        requestId: 'req-1',
        error: null,
      },
    };

    render(
      <VoiceGenerationPanel
        scenes={mockScenes}
        options={defaultOptions}
        voiceStateByScene={voiceState}
        isVoiceBatchRunning={false}
        excludedSceneIds={[]}
        elevenLabsApiKey="test-eleven-key"
        onGenerateAll={vi.fn()}
        onRetryScene={vi.fn()}
        onRegenerateScene={regenSpy}
        onRetryFailed={vi.fn()}
        onCancelGeneration={vi.fn()}
        onProceedToClips={vi.fn()}
        onBackToScenes={vi.fn()}
        onStartOver={vi.fn()}
        onNavigateToSettings={vi.fn()}
      />
    );

    const regenBtn = screen.getByRole('button', { name: /Regenerate/i });
    await user.click(regenBtn);

    // Modal should appear warning about characters
    const modal = screen.getByRole('dialog');
    expect(within(modal).getByText(/Regenerate Scene Audio\?/i)).toBeInTheDocument();
    expect(within(modal).getByText(/consume approximately/i)).toBeInTheDocument();

    const confirmBtn = within(modal).getByRole('button', { name: /Regenerate Audio/i });
    await user.click(confirmBtn);

    expect(regenSpy).toHaveBeenCalledWith('scene-1');
  });

  it('displays retry button for failed scene and handles retry', async () => {
    const user = userEvent.setup();
    const retrySceneSpy = vi.fn();
    const retryFailedSpy = vi.fn();

    const voiceState: Record<string, VoiceSegmentState> = {
      'scene-1': {
        sceneId: 'scene-1',
        provider: 'elevenlabs',
        status: 'failed',
        sourceTextFingerprint: 'fp1',
        settingsFingerprint: 'sfp',
        audioBlob: null,
        audioUrl: null,
        durationSeconds: null,
        requestId: null,
        error: 'Network error generating speech.',
      },
    };

    render(
      <VoiceGenerationPanel
        scenes={mockScenes}
        options={defaultOptions}
        voiceStateByScene={voiceState}
        isVoiceBatchRunning={false}
        excludedSceneIds={[]}
        elevenLabsApiKey="test-eleven-key"
        onGenerateAll={vi.fn()}
        onRetryScene={retrySceneSpy}
        onRegenerateScene={vi.fn()}
        onRetryFailed={retryFailedSpy}
        onCancelGeneration={vi.fn()}
        onProceedToClips={vi.fn()}
        onBackToScenes={vi.fn()}
        onStartOver={vi.fn()}
        onNavigateToSettings={vi.fn()}
      />
    );

    expect(screen.getByText('Network error generating speech.')).toBeInTheDocument();
    expect(screen.getAllByText('Failed').length).toBeGreaterThanOrEqual(1);

    // Scene card retry button
    const retryCardBtn = screen.getByRole('button', { name: /^Retry$/i });
    await user.click(retryCardBtn);
    expect(retrySceneSpy).toHaveBeenCalledWith('scene-1');

    // Batch retry button in header
    const retryFailedBtn = screen.getByRole('button', { name: /Retry Failed \(1\)/i });
    await user.click(retryFailedBtn);
    expect(retryFailedSpy).toHaveBeenCalled();
  });

  it('navigates to clips and back to scenes', async () => {
    const user = userEvent.setup();
    const proceedToClipsSpy = vi.fn();
    const backToScenesSpy = vi.fn();

    render(
      <VoiceGenerationPanel
        scenes={mockScenes}
        options={defaultOptions}
        voiceStateByScene={{}}
        isVoiceBatchRunning={false}
        excludedSceneIds={[]}
        elevenLabsApiKey="test-eleven-key"
        onGenerateAll={vi.fn()}
        onRetryScene={vi.fn()}
        onRegenerateScene={vi.fn()}
        onRetryFailed={vi.fn()}
        onCancelGeneration={vi.fn()}
        onProceedToClips={proceedToClipsSpy}
        onBackToScenes={backToScenesSpy}
        onStartOver={vi.fn()}
        onNavigateToSettings={vi.fn()}
      />
    );

    const backBtn = screen.getByRole('button', { name: /Back to Scene Editor/i });
    await user.click(backBtn);
    expect(backToScenesSpy).toHaveBeenCalledTimes(1);

    const clipsBtn = screen.getByRole('button', { name: /Find Pexels Clips/i });
    await user.click(clipsBtn);
    expect(proceedToClipsSpy).toHaveBeenCalledTimes(1);
  });

  it('renders AI33 Pro provider controls, warnings, and credits messaging', async () => {
    const user = userEvent.setup();
    const regenSpy = vi.fn();

    const ai33Options: WorkflowOptions = {
      ...defaultOptions,
      voiceProvider: 'ai33pro',
      ai33Pro: {
        sourceProvider: 'minimax',
        voiceId: 'minimax_male-qn-qingse',
        speed: 1.1,
      },
    };

    const voiceState: Record<string, VoiceSegmentState> = {
      'scene-1': {
        sceneId: 'scene-1',
        provider: 'ai33pro',
        status: 'ready',
        sourceTextFingerprint: 'fp1',
        settingsFingerprint: 'sfp',
        audioBlob: new Blob(['ai33-audio'], { type: 'audio/mpeg' }),
        audioUrl: 'blob:http://localhost/mock-audio-ai33',
        durationSeconds: 3.5,
        taskId: 'ai33-task-99',
        creditCost: 15,
        error: null,
      },
    };

    render(
      <VoiceGenerationPanel
        scenes={mockScenes}
        options={ai33Options}
        voiceStateByScene={voiceState}
        isVoiceBatchRunning={false}
        excludedSceneIds={[]}
        elevenLabsApiKey="" // Unselected provider has NO key: must not block!
        ai33ProApiKey="valid-ai33-key"
        ai33Voices={[
          {
            voice_id: 'minimax_male-qn-qingse',
            name: 'Qingse (Male)',
            language: 'Chinese',
            gender: 'male',
          },
        ]}
        onGenerateAll={vi.fn()}
        onRetryScene={vi.fn()}
        onRegenerateScene={regenSpy}
        onRetryFailed={vi.fn()}
        onCancelGeneration={vi.fn()}
        onProceedToClips={vi.fn()}
        onBackToScenes={vi.fn()}
        onStartOver={vi.fn()}
        onNavigateToSettings={vi.fn()}
      />
    );

    // Verify AI33 Pro header and source info
    expect(screen.getByText(/AI33 Pro Voice Narration & Review/i)).toBeInTheDocument();
    expect(screen.getByText('minimax')).toBeInTheDocument();
    expect(screen.queryByText(/ElevenLabs API Key Required/i)).not.toBeInTheDocument();

    // Verify pill shows AI33 Pro details
    expect(screen.getAllByText(/AI33 Pro \(minimax\) · Qingse \(Male\) · 1.10x/i).length).toBeGreaterThanOrEqual(1);

    // Verify regeneration modal says AI33 Pro credits
    const regenBtn = screen.getByRole('button', { name: /Regenerate/i });
    await user.click(regenBtn);

    const modal = screen.getByRole('dialog');
    expect(within(modal).getByText(/Regenerate Scene Audio\?/i)).toBeInTheDocument();
    expect(within(modal).getByText(/consume credits from your AI33 Pro account/i)).toBeInTheDocument();

    const confirmBtn = within(modal).getByRole('button', { name: /Regenerate Audio/i });
    await user.click(confirmBtn);
    expect(regenSpy).toHaveBeenCalledWith('scene-1');
  });

  it('shows missing key warning for AI33 Pro when AI33 Pro key is empty', () => {
    const ai33Options: WorkflowOptions = {
      ...defaultOptions,
      voiceProvider: 'ai33pro',
      ai33Pro: {
        sourceProvider: 'minimax',
        voiceId: 'minimax_male-qn-qingse',
        speed: 1.0,
      },
    };

    render(
      <VoiceGenerationPanel
        scenes={mockScenes}
        options={ai33Options}
        voiceStateByScene={{}}
        isVoiceBatchRunning={false}
        excludedSceneIds={[]}
        elevenLabsApiKey="valid-eleven-key" // Other provider has key
        ai33ProApiKey="" // Active provider is missing key
        onGenerateAll={vi.fn()}
        onRetryScene={vi.fn()}
        onRegenerateScene={vi.fn()}
        onRetryFailed={vi.fn()}
        onCancelGeneration={vi.fn()}
        onProceedToClips={vi.fn()}
        onBackToScenes={vi.fn()}
        onStartOver={vi.fn()}
        onNavigateToSettings={vi.fn()}
      />
    );

    expect(screen.getByText(/AI33 Pro API Key Required/i)).toBeInTheDocument();
    expect(screen.queryByText(/ElevenLabs API Key Required/i)).not.toBeInTheDocument();
  });
});
