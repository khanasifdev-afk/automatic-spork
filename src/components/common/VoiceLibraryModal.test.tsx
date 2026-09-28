import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VoiceLibraryModal } from './VoiceLibraryModal';
import { VoiceOption } from './VoiceSearchSelect';

const sampleVoices: VoiceOption[] = [
  { id: 'v1', name: 'Adam Smith', category: 'American, Male', gender: 'Male', language: 'English' },
  { id: 'v2', name: 'Alice Walker', category: 'British, Female', gender: 'Female', language: 'English' },
  { id: 'v3', name: 'Antoni Banderas', category: 'Spanish, Male', gender: 'Male', language: 'Spanish' },
  { id: 'v4', name: 'Bella Thorne', category: 'American, Female', gender: 'Female', language: 'English' },
];

describe('VoiceLibraryModal Component', () => {
  it('does not render when isOpen is false', () => {
    render(
      <VoiceLibraryModal
        isOpen={false}
        onClose={vi.fn()}
        voices={sampleVoices}
        selectedVoiceId="v1"
        onSelectVoice={vi.fn()}
      />
    );

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders modal header, total voices count, search input, gender filter chips, and voice cards when isOpen is true', () => {
    render(
      <VoiceLibraryModal
        isOpen={true}
        onClose={vi.fn()}
        voices={sampleVoices}
        selectedVoiceId="v1"
        onSelectVoice={vi.fn()}
        providerName="AI33 Pro (MINIMAX)"
      />
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Voice Library')).toBeInTheDocument();
    expect(screen.getByText(/AI33 Pro \(MINIMAX\) • 4 voices available/i)).toBeInTheDocument();

    // Check all sample voices rendered as cards
    expect(screen.getByText('Adam Smith')).toBeInTheDocument();
    expect(screen.getByText('Alice Walker')).toBeInTheDocument();
    expect(screen.getByText('Antoni Banderas')).toBeInTheDocument();
    expect(screen.getByText('Bella Thorne')).toBeInTheDocument();
  });

  it('filters voice cards live when user types into modal search input', () => {
    render(
      <VoiceLibraryModal
        isOpen={true}
        onClose={vi.fn()}
        voices={sampleVoices}
        selectedVoiceId="v1"
        onSelectVoice={vi.fn()}
      />
    );

    const searchInput = screen.getByPlaceholderText(/Search voice by name, artist, language/i);
    fireEvent.change(searchInput, { target: { value: 'Antoni' } });

    expect(screen.getByText('Antoni Banderas')).toBeInTheDocument();
    expect(screen.queryByText('Adam Smith')).toBeNull();
    expect(screen.queryByText('Alice Walker')).toBeNull();
  });

  it('filters voices when clicking gender filter chips (Male / Female / All)', () => {
    render(
      <VoiceLibraryModal
        isOpen={true}
        onClose={vi.fn()}
        voices={sampleVoices}
        selectedVoiceId="v1"
        onSelectVoice={vi.fn()}
      />
    );

    // Click Female chip
    const femaleChip = screen.getByRole('button', { name: 'Female' });
    fireEvent.click(femaleChip);

    expect(screen.getByText('Alice Walker')).toBeInTheDocument();
    expect(screen.getByText('Bella Thorne')).toBeInTheDocument();
    expect(screen.queryByText('Adam Smith')).toBeNull();
    expect(screen.queryByText('Antoni Banderas')).toBeNull();

    // Click All chip to reset
    const allChip = screen.getByRole('button', { name: 'All' });
    fireEvent.click(allChip);

    expect(screen.getByText('Adam Smith')).toBeInTheDocument();
  });

  it('calls onSelectVoice and onClose when clicking Select on a voice card', () => {
    const onSelectVoice = vi.fn();
    const onClose = vi.fn();

    render(
      <VoiceLibraryModal
        isOpen={true}
        onClose={onClose}
        voices={sampleVoices}
        selectedVoiceId="v1"
        onSelectVoice={onSelectVoice}
      />
    );

    const selectButtons = screen.getAllByRole('button', { name: /Select/i });
    fireEvent.click(selectButtons[1]); // Click second card (Alice Walker - v2)

    expect(onSelectVoice).toHaveBeenCalledWith('v2');
    expect(onClose).toHaveBeenCalled();
  });
});
