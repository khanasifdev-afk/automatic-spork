import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { WorkspacePage } from './WorkspacePage';
import { useWorkflowStore } from '../store/workflowStore';
import * as storage from '../storage/settingsStorage';
import * as geminiService from '../services/gemini';

describe('WorkspacePage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useWorkflowStore.getState().startOver();

    // Default settings with valid key
    vi.spyOn(storage, 'loadSettings').mockReturnValue({
      ...storage.DEFAULT_SETTINGS,
      geminiApiKey: 'test-gemini-key',
      pexelsApiKey: 'test-pexels-key',
      elevenLabsApiKey: 'test-eleven-key',
      defaultOrientation: 'landscape',
      defaultQuality: '1080p',
      defaultSceneLength: 'standard',
      defaultElevenLabs: {
        voiceId: '21m00Tcm4TlvDq8ikWAM',
        modelId: 'eleven_multilingual_v2',
        outputFormat: 'mp3_44100_128',
        stability: 0.5,
        similarityBoost: 0.75,
        style: 0,
        speed: 1,
        useSpeakerBoost: true,
      },
    });
  });

  it('renders step 1 with prefilled defaults from settings and sample script', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <WorkspacePage />
      </MemoryRouter>
    );

    expect(screen.getByText('Script to Video Workspace')).toBeInTheDocument();
    expect(screen.getByText('YouTube Narration Script')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Analyze Script/i })).toBeEnabled();

    // Verify sections are closed initially
    const videoHeader = screen.getByRole('button', { name: /1\. Video Settings/i });
    expect(videoHeader).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('radio', { name: /Landscape/i })).not.toBeInTheDocument();

    // Open Video Settings
    await user.click(videoHeader);
    expect(videoHeader).toHaveAttribute('aria-expanded', 'true');

    // Orientation buttons
    const landscapeBtn = screen.getByRole('radio', { name: /Landscape/i });
    expect(landscapeBtn).toHaveClass('active');
  });

  it('shows warning when Gemini API key is missing', () => {
    vi.spyOn(storage, 'loadSettings').mockReturnValue({
      ...storage.DEFAULT_SETTINGS,
      geminiApiKey: '',
      pexelsApiKey: '',
      elevenLabsApiKey: '',
      defaultOrientation: 'landscape',
      defaultQuality: '1080p',
      defaultSceneLength: 'standard',
      defaultElevenLabs: storage.DEFAULT_ELEVENLABS_SETTINGS,
    });

    render(
      <MemoryRouter>
        <WorkspacePage />
      </MemoryRouter>
    );

    expect(screen.getByText(/Gemini API Key Required/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Analyze Script/i })).toBeDisabled();
  });

  it('updates live word and character counters as user types', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <WorkspacePage />
      </MemoryRouter>
    );

    const textarea = screen.getByPlaceholderText(/Paste your YouTube video narration script here/i);
    await user.clear(textarea);
    await user.type(textarea, 'Hello world of video');

    expect(screen.getByTitle('Words count')).toHaveTextContent('4');
    expect(screen.getByTitle('Character count')).toHaveTextContent('20 chars');
    expect(screen.getByRole('button', { name: /Analyze Script/i })).toBeEnabled();
  });

  it('overrides job options without calling saveSettings', async () => {
    const user = userEvent.setup();
    const saveSpy = vi.spyOn(storage, 'saveSettings');

    render(
      <MemoryRouter>
        <WorkspacePage />
      </MemoryRouter>
    );

    // Expand Video Settings collapsible section first
    const videoHeader = screen.getByRole('button', { name: /1\. Video Settings/i });
    await user.click(videoHeader);

    const portraitBtn = screen.getByRole('radio', { name: /Portrait/i });
    await user.click(portraitBtn);

    expect(portraitBtn).toHaveClass('active');
    expect(useWorkflowStore.getState().options.orientation).toBe('portrait');
    expect(saveSpy).not.toHaveBeenCalled();
  });

  it('renders Job Settings with 2 collapsible sections closed initially and can toggle open', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <WorkspacePage />
      </MemoryRouter>
    );

    const videoHeader = screen.getByRole('button', { name: /1\. Video Settings/i });
    const voiceHeader = screen.getByRole('button', { name: /2\. Voice Settings/i });

    expect(videoHeader).toHaveAttribute('aria-expanded', 'false');
    expect(voiceHeader).toHaveAttribute('aria-expanded', 'false');

    // Neither panel content is visible initially
    expect(screen.queryByRole('radio', { name: /Landscape/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /^Voice$/i })).not.toBeInTheDocument();

    // Open Video Settings
    await user.click(videoHeader);
    expect(videoHeader).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('radio', { name: /Landscape/i })).toBeInTheDocument();

    // Open Voice Settings
    await user.click(voiceHeader);
    expect(voiceHeader).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('combobox', { name: /^Voice$/i })).toBeInTheDocument();

    // Close Video Settings
    await user.click(videoHeader);
    expect(videoHeader).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('radio', { name: /Landscape/i })).not.toBeInTheDocument();
  });

  it('analyzes script and presents editable scene cards', async () => {
    const mockScenes: import('../types').Scene[] = [
      {
        id: 'scene-1',
        sequence: 1,
        scriptText: 'Welcome to this mountain trek tutorial.',
        visualDescription: 'A hiker standing on a mountain peak at sunrise',
        primaryQuery: 'hiker mountain summit',
        fallbackQueries: ['sunrise hike', 'mountain climber'],
        avoidTerms: ['dark', 'rain'],
        estimatedSeconds: 5,
      },
      {
        id: 'scene-2',
        sequence: 2,
        scriptText: 'Make sure you bring the right hiking boots.',
        visualDescription: 'Close-up of durable hiking boots stepping on rocks',
        primaryQuery: 'hiking boots trail',
        fallbackQueries: ['walking shoes outdoor'],
        avoidTerms: ['sneakers'],
        estimatedSeconds: 4,
      },
    ];

    vi.spyOn(geminiService, 'analyzeScriptWithGemini').mockResolvedValue(mockScenes);

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <WorkspacePage />
      </MemoryRouter>
    );

    const textarea = screen.getByPlaceholderText(/Paste your YouTube video narration script here/i);
    await user.type(textarea, 'Welcome to this mountain trek tutorial. Make sure you bring the right boots.');

    const analyzeBtn = screen.getByRole('button', { name: /Analyze Script/i });
    await user.click(analyzeBtn);

    await waitFor(() => {
      expect(screen.getByText('Visual Scenes Review')).toBeInTheDocument();
    });

    expect(screen.getByText(/2 Scenes/i)).toBeInTheDocument();
    expect(screen.getByText('Scene 1')).toBeInTheDocument();
    expect(screen.getByText('Scene 2')).toBeInTheDocument();
    expect(screen.getByText('"Welcome to this mountain trek tutorial."')).toBeInTheDocument();
    expect(screen.getByText('hiker mountain summit')).toBeInTheDocument();
  });

  it('allows reordering, editing, and deleting scenes', async () => {
    const mockScenes: import('../types').Scene[] = [
      {
        id: 'scene-1',
        sequence: 1,
        scriptText: 'Scene one text.',
        visualDescription: 'Scene one visual.',
        primaryQuery: 'query one',
        fallbackQueries: [],
        avoidTerms: [],
        estimatedSeconds: 4,
      },
      {
        id: 'scene-2',
        sequence: 2,
        scriptText: 'Scene two text.',
        visualDescription: 'Scene two visual.',
        primaryQuery: 'query two',
        fallbackQueries: [],
        avoidTerms: [],
        estimatedSeconds: 5,
      },
    ];

    useWorkflowStore.setState({
      step: 'scenes',
      status: 'ready',
      scenes: mockScenes,
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <WorkspacePage />
      </MemoryRouter>
    );

    // Reorder: Move Scene 2 up
    const moveUpBtn = screen.getByRole('button', { name: /Move scene 2 up/i });
    await user.click(moveUpBtn);

    // After reorder, scene-2 is first
    const scenesState = useWorkflowStore.getState().scenes;
    expect(scenesState[0].id).toBe('scene-2');
    expect(scenesState[0].sequence).toBe(1);

    // Delete first scene
    const deleteBtn = screen.getByRole('button', { name: /Delete scene 1/i });
    await user.click(deleteBtn);

    // Confirm deletion modal
    const modal = screen.getByRole('dialog');
    const confirmDeleteBtn = within(modal).getByRole('button', { name: 'Delete Scene' });
    await user.click(confirmDeleteBtn);

    expect(useWorkflowStore.getState().scenes).toHaveLength(1);
    expect(useWorkflowStore.getState().scenes[0].sequence).toBe(1);
  });

  it('proceed to clips button on voice panel advances workflow step to clips', async () => {
    const mockScenes: import('../types').Scene[] = [
      {
        id: 'scene-1',
        sequence: 1,
        scriptText: 'Valid scene script.',
        visualDescription: 'Visual description.',
        primaryQuery: 'valid query',
        fallbackQueries: [],
        avoidTerms: [],
        estimatedSeconds: 4,
      },
    ];

    useWorkflowStore.setState({
      step: 'voices',
      status: 'ready',
      scenes: mockScenes,
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <WorkspacePage />
      </MemoryRouter>
    );

    const proceedClipsBtn = screen.getByRole('button', { name: /Find Pexels Clips/i });
    expect(proceedClipsBtn).toBeEnabled();

    await user.click(proceedClipsBtn);

    expect(screen.getByText('Stock Video Review')).toBeInTheDocument();
    expect(useWorkflowStore.getState().step).toBe('clips');
  });

  it('proceed to voices button advances workflow step to voices', async () => {
    const mockScenes: import('../types').Scene[] = [
      {
        id: 'scene-1',
        sequence: 1,
        scriptText: 'Valid scene script.',
        visualDescription: 'Visual description.',
        primaryQuery: 'valid query',
        fallbackQueries: [],
        avoidTerms: [],
        estimatedSeconds: 4,
      },
    ];

    useWorkflowStore.setState({
      step: 'scenes',
      status: 'ready',
      scenes: mockScenes,
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <WorkspacePage />
      </MemoryRouter>
    );

    const proceedVoicesBtn = screen.getByRole('button', { name: /Proceed to Voices/i });
    expect(proceedVoicesBtn).toBeEnabled();
    expect(screen.queryByRole('button', { name: /Find Clips/i })).not.toBeInTheDocument();

    await user.click(proceedVoicesBtn);

    expect(screen.getByText(/Voice Narration & Review/i)).toBeInTheDocument();
    expect(useWorkflowStore.getState().step).toBe('voices');
  });

  it('renders voice generation panel when step is voices', () => {
    useWorkflowStore.setState({
      step: 'voices',
      scenes: [
        {
          id: 'scene-1',
          sequence: 1,
          scriptText: 'Valid scene script for voice testing.',
          visualDescription: 'Visual description.',
          primaryQuery: 'valid query',
          fallbackQueries: [],
          avoidTerms: [],
          estimatedSeconds: 4,
        },
      ],
    });

    render(
      <MemoryRouter>
        <WorkspacePage />
      </MemoryRouter>
    );

    expect(screen.getByText(/Voice Narration & Review/i)).toBeInTheDocument();
    expect(screen.getByText('"Valid scene script for voice testing."')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Generate All Voices/i })).toBeInTheDocument();
  });

  it('renders packaging panel when step is packaging', () => {
    useWorkflowStore.setState({
      step: 'packaging',
      scenes: [
        {
          id: 'scene-1',
          sequence: 1,
          scriptText: 'Valid scene script.',
          visualDescription: 'Visual description.',
          primaryQuery: 'valid query',
          fallbackQueries: [],
          avoidTerms: [],
          estimatedSeconds: 4,
        },
      ],
      exportState: {
        stage: 'downloading',
        clips: [
          {
            sceneId: 'scene-1',
            sequence: 1,
            candidateLabel: 'A',
            filename: '001-A.mp4',
            state: 'downloading',
          },
        ],
        zipBlobUrl: null,
        error: null,
      },
    });

    render(
      <MemoryRouter>
        <WorkspacePage />
      </MemoryRouter>
    );

    expect(screen.getByText(/Downloading Stock Video Clips/i)).toBeInTheDocument();
    expect(screen.getByText('001-A.mp4')).toBeInTheDocument();
  });

  it('navigates from clips step back to voices step when "Back to Voices" is clicked', async () => {
    const user = userEvent.setup();
    useWorkflowStore.setState({
      step: 'clips',
      scenes: [
        {
          id: 'scene-1',
          sequence: 1,
          scriptText: 'Valid scene script for testing back to voices.',
          visualDescription: 'Visual description.',
          primaryQuery: 'valid query',
          fallbackQueries: [],
          avoidTerms: [],
          estimatedSeconds: 4,
        },
      ],
      searchStateByScene: {
        'scene-1': {
          status: 'idle',
          query: 'valid query',
          candidates: [],
          selectedCandidateId: null,
          error: null,
        },
      },
    });

    render(
      <MemoryRouter>
        <WorkspacePage />
      </MemoryRouter>
    );

    const backButtons = screen.getAllByRole('button', { name: /Back to Voices/i });
    expect(backButtons.length).toBeGreaterThanOrEqual(1);

    await user.click(backButtons[0]);

    expect(useWorkflowStore.getState().step).toBe('voices');
    expect(screen.getByText(/Voice Narration & Review/i)).toBeInTheDocument();
  });
});

