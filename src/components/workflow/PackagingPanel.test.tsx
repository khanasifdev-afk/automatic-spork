import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { PackagingPanel } from './PackagingPanel';
import { ExportState, Scene } from '../../types';

describe('PackagingPanel Component', () => {
  const mockScenes: Scene[] = [
    {
      id: 'scene-1',
      sequence: 1,
      scriptText: 'First segment of the video script.',
      visualDescription: 'Sunrise on a calm beach.',
      primaryQuery: 'sunrise beach',
      fallbackQueries: [],
      avoidTerms: [],
      estimatedSeconds: 5,
    },
    {
      id: 'scene-2',
      sequence: 2,
      scriptText: 'Second segment of the video script.',
      visualDescription: 'Ocean waves crashing.',
      primaryQuery: 'ocean waves',
      fallbackQueries: [],
      avoidTerms: [],
      estimatedSeconds: 6,
    },
  ];

  it('renders downloading state with clip rows and progress bar', () => {
    const exportState: ExportState = {
      stage: 'downloading',
      clips: [
        {
          sceneId: 'scene-1',
          sequence: 1,
          candidateLabel: 'A',
          filename: '001-A.mp4',
          state: 'complete',
          receivedBytes: 1048576,
          totalBytes: 1048576,
        },
        {
          sceneId: 'scene-1',
          sequence: 1,
          candidateLabel: 'B',
          filename: '001-B.mp4',
          state: 'downloading',
          receivedBytes: 524288,
          totalBytes: 1048576,
        },
      ],
      zipBlobUrl: null,
      error: null,
    };

    render(
      <PackagingPanel
        exportState={exportState}
        scenes={mockScenes}
        onStartExport={vi.fn()}
        onCancelExport={vi.fn()}
        onRetryClip={vi.fn()}
        onDownloadZip={vi.fn()}
        onBackToClips={vi.fn()}
        onStartOver={vi.fn()}
      />
    );

    expect(screen.getByText(/Downloading Stock Video Clips/i)).toBeInTheDocument();
    expect(screen.getByText('001-A.mp4')).toBeInTheDocument();
    expect(screen.getByText('001-B.mp4')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cancel Export/i })).toBeInTheDocument();
  });

  it('renders complete state with download button and triggers download', () => {
    const exportState: ExportState = {
      stage: 'complete',
      clips: [
        {
          sceneId: 'scene-1',
          sequence: 1,
          candidateLabel: 'A',
          filename: '001-A.mp4',
          state: 'complete',
        },
        {
          sceneId: 'scene-2',
          sequence: 2,
          candidateLabel: 'A',
          filename: '002-A.mp4',
          state: 'complete',
        },
      ],
      zipBlobUrl: 'blob:http://localhost/test-zip',
      error: null,
    };

    const downloadZipMock = vi.fn();

    render(
      <PackagingPanel
        exportState={exportState}
        scenes={mockScenes}
        onStartExport={vi.fn()}
        onCancelExport={vi.fn()}
        onRetryClip={vi.fn()}
        onDownloadZip={downloadZipMock}
        onBackToClips={vi.fn()}
        onStartOver={vi.fn()}
      />
    );

    expect(screen.getByText(/Package Ready for Download/i)).toBeInTheDocument();
    const downloadBtn = screen.getByRole('button', {
      name: /Download youtube-video-clips\.zip/i,
    });
    expect(downloadBtn).toBeInTheDocument();

    fireEvent.click(downloadBtn);
    expect(downloadZipMock).toHaveBeenCalledTimes(1);
  });

  it('renders retry button for failed clips and calls onRetryClip', () => {
    const exportState: ExportState = {
      stage: 'downloading',
      clips: [
        {
          sceneId: 'scene-1',
          sequence: 1,
          candidateLabel: 'A',
          filename: '001-A.mp4',
          state: 'failed',
          error: 'Network timeout',
        },
      ],
      zipBlobUrl: null,
      error: null,
    };

    const retryMock = vi.fn();

    render(
      <PackagingPanel
        exportState={exportState}
        scenes={mockScenes}
        onStartExport={vi.fn()}
        onCancelExport={vi.fn()}
        onRetryClip={retryMock}
        onDownloadZip={vi.fn()}
        onBackToClips={vi.fn()}
        onStartOver={vi.fn()}
      />
    );

    const retryBtn = screen.getByTitle('Retry downloading 001-A.mp4');
    expect(retryBtn).toBeInTheDocument();

    fireEvent.click(retryBtn);
    expect(retryMock).toHaveBeenCalledWith('scene-1', 'A');
  });

  it('shows Start Over modal and triggers onStartOver upon confirmation', () => {
    const exportState: ExportState = {
      stage: 'complete',
      clips: [],
      zipBlobUrl: 'blob:http://localhost/test',
      error: null,
    };

    const startOverMock = vi.fn();

    render(
      <PackagingPanel
        exportState={exportState}
        scenes={mockScenes}
        onStartExport={vi.fn()}
        onCancelExport={vi.fn()}
        onRetryClip={vi.fn()}
        onDownloadZip={vi.fn()}
        onBackToClips={vi.fn()}
        onStartOver={startOverMock}
      />
    );

    const startOverBtn = screen.getByRole('button', { name: /Start Over/i });
    fireEvent.click(startOverBtn);

    // Modal appears
    const modal = screen.getByRole('dialog');
    expect(modal).toBeInTheDocument();
    const confirmBtn = within(modal).getByRole('button', { name: /Start Over/i });
    fireEvent.click(confirmBtn);

    expect(startOverMock).toHaveBeenCalledTimes(1);
  });
});
