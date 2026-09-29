import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ClipsReview } from './ClipsReview';
import { SceneClipsCard } from './SceneClipsCard';
import { ClipCard } from './ClipCard';
import { Scene, ClipCandidate, WorkflowOptions, SceneSearchState } from '../../types';

describe('Clip Selection Removal & 6-Candidate Review Interaction Tests', () => {
  const options: WorkflowOptions = {
    orientation: 'landscape',
    quality: '1080p',
    sceneLength: 'standard',
    elevenLabs: {
      voiceId: 'voice-1',
      modelId: 'eleven_multilingual_v2',
      outputFormat: 'mp3_44100_128',
      stability: 0.5,
      similarityBoost: 0.75,
      style: 0,
      speed: 1,
      useSpeakerBoost: true,
    },
  };

  const createCandidate = (index: number, label: 'A' | 'B' | 'C' | 'D' | 'E' | 'F'): ClipCandidate => ({
    id: `clip-${index}`,
    pexelsVideoId: 1000 + index,
    sourceUrl: `https://pexels.com/video/${1000 + index}`,
    creatorName: `Creator ${label}`,
    creatorUrl: `https://pexels.com/@creator${label}`,
    previewImageUrl: `https://images.pexels.com/${index}.jpg`,
    previewVideoUrl: `https://pexels.com/video${index}.mp4`,
    durationSeconds: 6,
    width: 1920,
    height: 1080,
    files: [{ url: `https://pexels.com/video${index}.mp4`, mimeType: 'video/mp4', width: 1920, height: 1080 }],
    matchedQuery: 'test query',
    score: 95 - index * 5,
    confidence: 'strong',
    candidateLabel: label,
  });

  const candidatesSix: ClipCandidate[] = [
    createCandidate(0, 'A'),
    createCandidate(1, 'B'),
    createCandidate(2, 'C'),
    createCandidate(3, 'D'),
    createCandidate(4, 'E'),
    createCandidate(5, 'F'),
  ];

  const scene: Scene = {
    id: 'scene-1',
    sequence: 1,
    scriptText: 'Explore the high mountain peaks under morning light.',
    visualDescription: 'Aerial drone view of mountain peaks.',
    primaryQuery: 'mountain peaks aerial',
    fallbackQueries: ['mountain peaks sunrise'],
    avoidTerms: [],
    estimatedSeconds: 6,
  };

  it('ClipCard does not render any radio buttons, checkboxes, or selection buttons', () => {
    const candidate = candidatesSix[0];
    render(<ClipCard candidate={candidate} candidateLabel="A" rank={1} />);

    // Assert candidate badge A is rendered
    expect(screen.getByText('Option A')).toBeInTheDocument();

    // Assert absence of selection controls when onSelect is omitted
    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('ClipCard renders a checkbox and handles toggling when onSelect is provided', () => {
    const candidate = candidatesSix[0];
    const onSelect = vi.fn();
    render(<ClipCard candidate={candidate} candidateLabel="A" rank={1} isSelected={true} onSelect={onSelect} />);

    const checkbox = screen.getByRole('checkbox', { name: /Select Option A/i });
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(checkbox);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('ClipCard renders a download button at the bottom left of each video card', () => {
    const candidate = candidatesSix[0];
    render(<ClipCard candidate={candidate} candidateLabel="A" rank={1} />);

    const downloadButtons = screen.getAllByRole('button', { name: /download/i });
    expect(downloadButtons.length).toBeGreaterThan(0);

    // Click the download button
    fireEvent.click(downloadButtons[0]);
  });

  it('SceneClipsCard displays all 6 video previews labelled A through F with selection controls when enabled', () => {
    const searchState: SceneSearchState = {
      status: 'ready',
      query: 'mountain peaks aerial',
      candidates: candidatesSix,
      error: null,
    };

    const onToggleSelectClip = vi.fn();
    const onSelectAllClips = vi.fn();
    const onDeselectAllClips = vi.fn();

    render(
      <SceneClipsCard
        scene={scene}
        searchState={searchState}
        isExcluded={false}
        selectedClipIds={['clip-0', 'clip-1', 'clip-2']}
        onToggleSelectClip={onToggleSelectClip}
        onSelectAllClips={onSelectAllClips}
        onDeselectAllClips={onDeselectAllClips}
        onReSearch={vi.fn()}
        onExcludeScene={vi.fn()}
        onRestoreScene={vi.fn()}
      />
    );

    // All 6 candidate options A-F must be displayed
    ['Option A', 'Option B', 'Option C', 'Option D', 'Option E', 'Option F'].forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });

    // Check count badge
    expect(screen.getByText('3 of 6 selected')).toBeInTheDocument();

    // Verify 6 checkboxes rendered
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(6);

    // Click first checkbox
    fireEvent.click(checkboxes[0]);
    expect(onToggleSelectClip).toHaveBeenCalledWith('clip-0');

    // Click Select All
    const selectAllBtn = screen.getByRole('button', { name: /^select all$/i });
    fireEvent.click(selectAllBtn);
    expect(onSelectAllClips).toHaveBeenCalledTimes(1);

    // Click Deselect All
    const deselectAllBtn = screen.getByRole('button', { name: /^deselect all$/i });
    fireEvent.click(deselectAllBtn);
    expect(onDeselectAllClips).toHaveBeenCalledTimes(1);
  });

  it('SceneClipsCard renders incomplete warning when fewer than 6 candidates exist', () => {
    const searchStateIncomplete: SceneSearchState = {
      status: 'empty',
      query: 'mountain peaks aerial',
      candidates: candidatesSix.slice(0, 3), // Only 3 candidates
      error: 'Incomplete candidate set: Only 3 clips found (6 required). Please edit your query or retry.',
    };

    const onReSearch = vi.fn();

    render(
      <SceneClipsCard
        scene={scene}
        searchState={searchStateIncomplete}
        isExcluded={false}
        onReSearch={onReSearch}
        onExcludeScene={vi.fn()}
        onRestoreScene={vi.fn()}
      />
    );

    expect(screen.getByText('Incomplete Clip Set')).toBeInTheDocument();
    expect(screen.getByText(/Only 3 clips found/i)).toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: /retry search/i });
    expect(retryBtn).toBeInTheDocument();
    fireEvent.click(retryBtn);
    expect(onReSearch).toHaveBeenCalledWith('mountain peaks aerial');
  });

  it('ClipsReview disables Generate ZIP when any scene has fewer than 6 candidates', () => {
    const searchStateByScene: Record<string, SceneSearchState> = {
      'scene-1': {
        status: 'ready',
        query: 'mountain peaks aerial',
        candidates: candidatesSix,
        error: null,
      },
      'scene-2': {
        status: 'empty',
        query: 'river flow',
        candidates: candidatesSix.slice(0, 4), // only 4
        error: 'Only 4 candidates found',
      },
    };

    const scene2: Scene = {
      id: 'scene-2',
      sequence: 2,
      scriptText: 'River flowing through the valley.',
      visualDescription: 'Clear river water.',
      primaryQuery: 'river flow',
      fallbackQueries: [],
      avoidTerms: [],
      estimatedSeconds: 5,
    };

    render(
      <ClipsReview
        scenes={[scene, scene2]}
        options={options}
        searchStateByScene={searchStateByScene}
        excludedSceneIds={[]}
        pexelsApiKey="test-key"
        onSearchAll={vi.fn()}
        onSearchScene={vi.fn()}
        onExcludeScene={vi.fn()}
        onRestoreScene={vi.fn()}
        canProceedToPackaging={() => false}
        onProceedToPackaging={vi.fn()}
        onBackToScenes={vi.fn()}
        onStartOver={vi.fn()}
        onNavigateToSettings={vi.fn()}
      />
    );

    const generateZipBtn = screen.getByRole('button', { name: /generate zip/i });
    expect(generateZipBtn).toBeDisabled();
    expect(screen.getByText('1 of 2 Ready (6 Clips Each)')).toBeInTheDocument();
  });
});
