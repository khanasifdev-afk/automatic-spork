import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { VoiceSearchSelect, VoiceOption } from './VoiceSearchSelect';

describe('VoiceSearchSelect Component', () => {
  const sampleVoices: VoiceOption[] = [
    { id: 'v1', name: 'Adam', category: 'conversational' },
    { id: 'v2', name: 'Alice', category: 'news' },
    { id: 'v3', name: 'Antony', category: 'narration' },
    { id: 'v4', name: 'Bella', category: 'expressive' },
    { id: 'v5', name: 'Charlie', category: 'acting' },
  ];

  it('renders all voices in dropdown by default', () => {
    render(
      <VoiceSearchSelect
        id="test-voice-select"
        label="Voice"
        voices={sampleVoices}
        selectedVoiceId=""
        onSelectVoice={() => {}}
      />
    );

    expect(screen.getByLabelText(/filter voices by name/i)).toBeInTheDocument();
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.options).toHaveLength(6); // 1 default placeholder + 5 voices
  });

  it('filters voices live as user types search query e.g. "Ali"', async () => {
    const user = userEvent.setup();
    render(
      <VoiceSearchSelect
        id="test-voice-select"
        label="Voice"
        voices={sampleVoices}
        selectedVoiceId=""
        onSelectVoice={() => {}}
      />
    );

    const searchInput = screen.getByLabelText(/filter voices by name/i);
    await user.type(searchInput, 'Ali');

    expect(screen.getByText(/found 1 matching voice/i)).toBeInTheDocument();
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.options).toHaveLength(2); // placeholder + Alice
    expect(screen.getByRole('option', { name: 'Alice (news)' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Adam (conversational)' })).not.toBeInTheDocument();
  });

  it('clears search input when clear button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <VoiceSearchSelect
        id="test-voice-select"
        label="Voice"
        voices={sampleVoices}
        selectedVoiceId=""
        onSelectVoice={() => {}}
      />
    );

    const searchInput = screen.getByLabelText(/filter voices by name/i);
    await user.type(searchInput, 'Bella');
    expect(screen.getByText(/found 1 matching voice/i)).toBeInTheDocument();

    const clearBtn = screen.getByTitle('Clear voice search');
    await user.click(clearBtn);

    expect(searchInput).toHaveValue('');
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.options).toHaveLength(6);
  });

  it('calls onSelectVoice when user selects a voice from dropdown', async () => {
    const user = userEvent.setup();
    const onSelectMock = vi.fn();
    render(
      <VoiceSearchSelect
        id="test-voice-select"
        label="Voice"
        voices={sampleVoices}
        selectedVoiceId=""
        onSelectVoice={onSelectMock}
      />
    );

    const select = screen.getByRole('combobox');
    await user.selectOptions(select, 'v4');
    expect(onSelectMock).toHaveBeenCalledWith('v4');
  });
});
