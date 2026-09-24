import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ClipsReview } from './ClipsReview';
import { Scene, ClipCandidate, WorkflowOptions, SceneSearchState } from '../../types';

describe('ClipsReview component', () => {
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

  const createMockCandidate = (index: number, sceneNum: number): ClipCandidate => {
    const labels: ('A' | 'B' | 'C' | 'D' | 'E' | 'F')[] = ['A', 'B', 'C', 'D', 'E', 'F'];
    const pexelsId = sceneNum * 100 + index + 1;
    return {
      id: `clip-${pexelsId}`,
      pexelsVideoId: pexelsId,
      sourceUrl: `https://pexels.com/video/${pexelsId}`,
      creatorName: `Videographer ${pexelsId}`,
      creatorUrl: `https://pexels.com/@videographer${pexelsId}`,
      previewImageUrl: `https://images.pexels.com/${pexelsId}.jpg`,
      previewVideoUrl: `https://pexels.com/video${pexelsId}.mp4`,
      durationSeconds: 10 + index,
      width: 1920,
      height: 1080,
      files: [],
      matchedQuery: 'mountain sunrise',
      score: 90 - index * 5,
      confidence: index < 2 ? 'strong' : index < 4 ? 'fair' : 'weak',
      candidateLabel: labels[index],
    };
  };

  const mockScenes: Scene[] = [
    {
      id: 'scene-1',
      sequence: 1,
      scriptText: 'First segment script narration.',
      visualDescription: 'Sunrise on peak.',
      primaryQuery: 'mountain sunrise',
      fallbackQueries: [],
      avoidTerms: [],
      estimatedSeconds: 5,
    },
    {
      id: 'scene-2',
      sequence: 2,
      scriptText: 'Second segment script narration.',
      visualDescription: 'Deep river valley.',
      primaryQuery: 'river valley',
      fallbackQueries: [],
      avoidTerms: [],
      estimatedSeconds: 6,
    },
  ];

  const searchStateReady: Record<string, SceneSearchState> = {
    'scene-1': {
      status: 'ready',
      query: 'mountain sunrise',
      candidates: [0, 1, 2, 3, 4, 5].map((i) => createMockCandidate(i, 1)),
      error: null,
    },
    'scene-2': {
      status: 'ready',
      query: 'river valley',
      candidates: [0, 1, 2, 3, 4, 5].map((i) => createMockCandidate(i, 2)),
      error: null,
    },
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders header, scene cards, and all six video previews labelled A-F', () => {
    render(
      <ClipsReview
        scenes={mockScenes}
        options={defaultOptions}
        searchStateByScene={searchStateReady}
        excludedSceneIds={[]}
        pexelsApiKey="valid-key"
        onSearchAll={vi.fn()}
        onSearchScene={vi.fn()}
        onExcludeScene={vi.fn()}
        onRestoreScene={vi.fn()}
        canProceedToPackaging={() => true}
        onProceedToPackaging={vi.fn()}
        onBackToScenes={vi.fn()}
        onStartOver={vi.fn()}
        onNavigateToSettings={vi.fn()}
      />
    );

    expect(screen.getByText('Stock Video Review')).toBeInTheDocument();
    expect(screen.getByText('2 Total Scenes')).toBeInTheDocument();
    expect(screen.getByText('2 of 2 Ready (6 Clips Each)')).toBeInTheDocument();
    expect(screen.getByText('Scene 1')).toBeInTheDocument();
    expect(screen.getByText('Scene 2')).toBeInTheDocument();

    // Verify all 6 options A-F are rendered for each scene
    const optionsA = screen.getAllByText('Option A');
    const optionsB = screen.getAllByText('Option B');
    const optionsC = screen.getAllByText('Option C');
    const optionsD = screen.getAllByText('Option D');
    const optionsE = screen.getAllByText('Option E');
    const optionsF = screen.getAllByText('Option F');

    expect(optionsA).toHaveLength(2); // 1 per scene
    expect(optionsB).toHaveLength(2);
    expect(optionsC).toHaveLength(2);
    expect(optionsD).toHaveLength(2);
    expect(optionsE).toHaveLength(2);
    expect(optionsF).toHaveLength(2);
  });

  it('proves there is NO radio button, checkbox, or Select Clip action for choosing one clip', () => {
    render(
      <ClipsReview
        scenes={mockScenes}
        options={defaultOptions}
        searchStateByScene={searchStateReady}
        excludedSceneIds={[]}
        pexelsApiKey="valid-key"
        onSearchAll={vi.fn()}
        onSearchScene={vi.fn()}
        onExcludeScene={vi.fn()}
        onRestoreScene={vi.fn()}
        canProceedToPackaging={() => true}
        onProceedToPackaging={vi.fn()}
        onBackToScenes={vi.fn()}
        onStartOver={vi.fn()}
        onNavigateToSettings={vi.fn()}
      />
    );

    // 1. Ensure no radio buttons exist in the document
    const radioInputs = screen.queryAllByRole('radio');
    expect(radioInputs).toHaveLength(0);

    // 2. Ensure no checkboxes exist in the document
    const checkboxInputs = screen.queryAllByRole('checkbox');
    expect(checkboxInputs).toHaveLength(0);

    // 3. Ensure no "Select Clip" or "Select" buttons exist
    const selectClipButtons = screen.queryAllByText(/Select Clip/i);
    expect(selectClipButtons).toHaveLength(0);

    const selectButtons = screen.queryAllByRole('button', { name: /^Select$/i });
    expect(selectButtons).toHaveLength(0);

    // 4. Ensure no "Selected" indicator badges exist
    const selectedBadges = screen.queryAllByText(/^Selected$/i);
    expect(selectedBadges).toHaveLength(0);
  });

  it('allows query edit and search again', () => {
    const onSearchScene = vi.fn();

    render(
      <ClipsReview
        scenes={mockScenes}
        options={defaultOptions}
        searchStateByScene={searchStateReady}
        excludedSceneIds={[]}
        pexelsApiKey="valid-key"
        onSearchAll={vi.fn()}
        onSearchScene={onSearchScene}
        onExcludeScene={vi.fn()}
        onRestoreScene={vi.fn()}
        canProceedToPackaging={() => true}
        onProceedToPackaging={vi.fn()}
        onBackToScenes={vi.fn()}
        onStartOver={vi.fn()}
        onNavigateToSettings={vi.fn()}
      />
    );

    // Click "Edit Query" on first scene
    const editButtons = screen.getAllByText('Edit Query');
    fireEvent.click(editButtons[0]);

    const input = screen.getByPlaceholderText('Enter custom search query...');
    fireEvent.change(input, { target: { value: 'golden hour mountains' } });

    const searchBtn = screen.getByText('Search');
    fireEvent.click(searchBtn);

    expect(onSearchScene).toHaveBeenCalledWith('scene-1', 'valid-key', 'golden hour mountains');
  });

  it('handles exclude and restore scene actions', () => {
    const onExcludeScene = vi.fn();
    const onRestoreScene = vi.fn();

    const { rerender } = render(
      <ClipsReview
        scenes={mockScenes}
        options={defaultOptions}
        searchStateByScene={searchStateReady}
        excludedSceneIds={[]}
        pexelsApiKey="valid-key"
        onSearchAll={vi.fn()}
        onSearchScene={vi.fn()}
        onExcludeScene={onExcludeScene}
        onRestoreScene={onRestoreScene}
        canProceedToPackaging={() => true}
        onProceedToPackaging={vi.fn()}
        onBackToScenes={vi.fn()}
        onStartOver={vi.fn()}
        onNavigateToSettings={vi.fn()}
      />
    );

    const excludeButtons = screen.getAllByText('Exclude');
    fireEvent.click(excludeButtons[0]);
    expect(onExcludeScene).toHaveBeenCalledWith('scene-1');

    // Rerender with scene-1 excluded
    rerender(
      <ClipsReview
        scenes={mockScenes}
        options={defaultOptions}
        searchStateByScene={searchStateReady}
        excludedSceneIds={['scene-1']}
        pexelsApiKey="valid-key"
        onSearchAll={vi.fn()}
        onSearchScene={vi.fn()}
        onExcludeScene={onExcludeScene}
        onRestoreScene={onRestoreScene}
        canProceedToPackaging={() => true}
        onProceedToPackaging={vi.fn()}
        onBackToScenes={vi.fn()}
        onStartOver={vi.fn()}
        onNavigateToSettings={vi.fn()}
      />
    );

    expect(screen.getByText('Restore Scene')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Restore Scene'));
    expect(onRestoreScene).toHaveBeenCalledWith('scene-1');
  });

  it('disables Generate ZIP button when canProceedToPackaging is false and enables when true', () => {
    const onProceed = vi.fn();

    const { rerender } = render(
      <ClipsReview
        scenes={mockScenes}
        options={defaultOptions}
        searchStateByScene={{
          'scene-1': {
            status: 'searching',
            query: 'mountain sunrise',
            candidates: [],
            selectedCandidateId: null,
            error: null,
          },
        }}
        excludedSceneIds={[]}
        pexelsApiKey="valid-key"
        onSearchAll={vi.fn()}
        onSearchScene={vi.fn()}
        onExcludeScene={vi.fn()}
        onRestoreScene={vi.fn()}
        canProceedToPackaging={() => false}
        onProceedToPackaging={onProceed}
        onBackToScenes={vi.fn()}
        onStartOver={vi.fn()}
        onNavigateToSettings={vi.fn()}
      />
    );

    const zipBtn = screen.getByRole('button', { name: /Generate ZIP/i });
    expect(zipBtn).toBeDisabled();

    // Rerender with all ready
    rerender(
      <ClipsReview
        scenes={mockScenes}
        options={defaultOptions}
        searchStateByScene={searchStateReady}
        excludedSceneIds={[]}
        pexelsApiKey="valid-key"
        onSearchAll={vi.fn()}
        onSearchScene={vi.fn()}
        onExcludeScene={vi.fn()}
        onRestoreScene={vi.fn()}
        canProceedToPackaging={() => true}
        onProceedToPackaging={onProceed}
        onBackToScenes={vi.fn()}
        onStartOver={vi.fn()}
        onNavigateToSettings={vi.fn()}
      />
    );

    const readyZipBtn = screen.getByRole('button', { name: /Generate ZIP/i });
    expect(readyZipBtn).not.toBeDisabled();
    fireEvent.click(readyZipBtn);
    expect(onProceed).toHaveBeenCalledTimes(1);
  });

  it('renders "Back to Voices" buttons and triggers callback when clicked', () => {
    const onBackToVoices = vi.fn();
    render(
      <ClipsReview
        scenes={mockScenes}
        options={defaultOptions}
        searchStateByScene={searchStateReady}
        excludedSceneIds={[]}
        pexelsApiKey="valid-key"
        onSearchAll={vi.fn()}
        onSearchScene={vi.fn()}
        onExcludeScene={vi.fn()}
        onRestoreScene={vi.fn()}
        canProceedToPackaging={() => true}
        onProceedToPackaging={vi.fn()}
        onBackToVoices={onBackToVoices}
        onStartOver={vi.fn()}
        onNavigateToSettings={vi.fn()}
      />
    );

    const backButtons = screen.getAllByRole('button', { name: /Back to Voices/i });
    expect(backButtons.length).toBeGreaterThanOrEqual(2);
    fireEvent.click(backButtons[0]);
    expect(onBackToVoices).toHaveBeenCalledTimes(1);
  });
});

