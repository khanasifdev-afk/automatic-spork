import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { JobOptions } from './JobOptions';
import { WorkflowOptions } from '../../types';

describe('JobOptions', () => {
  const baseOptions: WorkflowOptions = {
    orientation: 'landscape',
    quality: '1080p',
    sceneLength: 'standard',
    voiceProvider: 'elevenlabs',
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
    ai33Pro: {
      sourceProvider: 'minimax',
      voiceId: 'minimax_male-qn-qingse',
      speed: 1.0,
    },
  };

  const mockElevenVoices = [
    { voice_id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel' },
    { voice_id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi' },
  ];

  const mockAi33Voices = [
    {
      voice_id: 'minimax_male-qn-qingse',
      name: 'Qingse (Male)',
      language: 'Chinese',
      gender: 'male',
      preview_url: 'https://cdn.ai33.pro/preview-qingse.mp3',
    },
    {
      voice_id: 'minimax_female-qn-jingjing',
      name: 'Jingjing (Female)',
      language: 'Chinese',
      gender: 'female',
    },
  ];

  it('renders video settings and collapsible voice section', async () => {
    const user = userEvent.setup();
    render(
      <JobOptions
        options={baseOptions}
        onChange={vi.fn()}
        voices={mockElevenVoices}
      />
    );

    expect(screen.getByText('Job Settings')).toBeInTheDocument();
    expect(screen.getByText('1. Video Settings')).toBeInTheDocument();
    expect(screen.getByText('2. Voice Settings')).toBeInTheDocument();

    // Open Voice section
    const voiceBtn = screen.getByRole('button', { name: /2\. Voice Settings/i });
    await user.click(voiceBtn);

    // Voice Service selection should be visible
    expect(screen.getByRole('radio', { name: /ElevenLabs/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /AI33 Pro/i })).toBeInTheDocument();
  });

  it('renders only ElevenLabs controls when ElevenLabs is selected', async () => {
    const user = userEvent.setup();
    render(
      <JobOptions
        options={{ ...baseOptions, voiceProvider: 'elevenlabs' }}
        onChange={vi.fn()}
        voices={mockElevenVoices}
      />
    );

    const voiceBtn = screen.getByRole('button', { name: /2\. Voice Settings/i });
    await user.click(voiceBtn);

    // ElevenLabs controls present
    expect(screen.getByLabelText(/Model/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Output Format/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Stability/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Clarity/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Style/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Speaker Boost/i)).toBeInTheDocument();

    // AI33-specific controls not present
    expect(screen.queryByLabelText(/Source Provider/i)).not.toBeInTheDocument();
  });

  it('renders only AI33 Pro controls when AI33 Pro is selected', async () => {
    const user = userEvent.setup();
    render(
      <JobOptions
        options={{ ...baseOptions, voiceProvider: 'ai33pro' }}
        onChange={vi.fn()}
        ai33Voices={mockAi33Voices}
      />
    );

    const voiceBtn = screen.getByRole('button', { name: /2\. Voice Settings/i });
    await user.click(voiceBtn);

    // AI33 Pro controls present
    expect(screen.getByLabelText(/Source Provider/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Voice Selection/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Speed/i)).toBeInTheDocument();

    // ElevenLabs controls MUST NOT be present
    expect(screen.queryByLabelText(/Model/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Output Format/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Stability/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Clarity/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Speaker Boost/i)).not.toBeInTheDocument();
  });

  it('switches provider immediately when hasExistingAudio is false', async () => {
    const user = userEvent.setup();
    const switchSpy = vi.fn();

    render(
      <JobOptions
        options={{ ...baseOptions, voiceProvider: 'elevenlabs' }}
        onChange={vi.fn()}
        onSwitchVoiceProvider={switchSpy}
        hasExistingAudio={false}
      />
    );

    const voiceBtn = screen.getByRole('button', { name: /2\. Voice Settings/i });
    await user.click(voiceBtn);

    const ai33Radio = screen.getByRole('radio', { name: /AI33 Pro/i });
    await user.click(ai33Radio);

    expect(switchSpy).toHaveBeenCalledWith('ai33pro');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows confirmation modal before switching provider when hasExistingAudio is true', async () => {
    const user = userEvent.setup();
    const switchSpy = vi.fn();

    render(
      <JobOptions
        options={{ ...baseOptions, voiceProvider: 'elevenlabs' }}
        onChange={vi.fn()}
        onSwitchVoiceProvider={switchSpy}
        hasExistingAudio={true}
      />
    );

    const voiceBtn = screen.getByRole('button', { name: /2\. Voice Settings/i });
    await user.click(voiceBtn);

    const ai33Radio = screen.getByRole('radio', { name: /AI33 Pro/i });
    await user.click(ai33Radio);

    // Should NOT have called switchVoiceProvider yet
    expect(switchSpy).not.toHaveBeenCalled();

    // Confirmation dialog should be open
    const modal = screen.getByRole('dialog');
    expect(within(modal).getByText(/Switch Voice Provider\?/i)).toBeInTheDocument();
    expect(within(modal).getByText(/remove all existing voice segments/i)).toBeInTheDocument();

    // Click confirm
    const confirmBtn = within(modal).getByRole('button', { name: /Switch Provider/i });
    await user.click(confirmBtn);

    expect(switchSpy).toHaveBeenCalledWith('ai33pro');
  });

  it('renders audio preview button when selected AI33 voice has preview_url', async () => {
    const user = userEvent.setup();

    // Mock HTMLAudioElement play and pause
    const playSpy = vi.fn().mockResolvedValue(undefined);
    const pauseSpy = vi.fn();
    window.Audio = vi.fn().mockImplementation(() => ({
      play: playSpy,
      pause: pauseSpy,
    })) as unknown as typeof Audio;

    render(
      <JobOptions
        options={{
          ...baseOptions,
          voiceProvider: 'ai33pro',
          ai33Pro: {
            sourceProvider: 'minimax',
            voiceId: 'minimax_male-qn-qingse',
            speed: 1.0,
          },
        }}
        onChange={vi.fn()}
        ai33Voices={mockAi33Voices}
      />
    );

    const voiceBtn = screen.getByRole('button', { name: /2\. Voice Settings/i });
    await user.click(voiceBtn);

    const previewBtn = screen.getByRole('button', { name: /Preview/i });
    expect(previewBtn).toBeInTheDocument();

    await user.click(previewBtn);
    expect(window.Audio).toHaveBeenCalledWith('https://cdn.ai33.pro/preview-qingse.mp3');
    expect(playSpy).toHaveBeenCalled();
  });
});
