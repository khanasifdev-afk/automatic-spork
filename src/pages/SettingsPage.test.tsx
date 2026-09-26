import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { SettingsPage } from './SettingsPage';
import {
  STORAGE_KEY,
  DEFAULT_ELEVENLABS_SETTINGS,
  DEFAULT_AI33PRO_SETTINGS,
} from '../storage/settingsStorage';

describe('SettingsPage', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function renderSettingsPage() {
    return render(
      <MemoryRouter initialEntries={['/settings']}>
        <Routes>
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </MemoryRouter>
    );
  }

  it('renders settings page with headings, forms, and all 4 provider inputs', () => {
    renderSettingsPage();

    expect(screen.getByRole('heading', { name: /^settings$/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /api connections/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /default video settings/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /default voice settings/i })).toBeInTheDocument();

    expect(screen.getByLabelText(/^google gemini api key$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^pexels video api key$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^elevenlabs api key$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^ai33 pro api key$/i)).toBeInTheDocument();

    expect(screen.getByLabelText(/^default voice service$/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /elevenlabs defaults/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /ai33 pro defaults/i })).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /save settings/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /test all keys/i })).toBeInTheDocument();
  });

  it('loads previously saved settings including AI33 Pro and ElevenLabs keys from localStorage', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        geminiApiKey: 'saved-gemini-key',
        pexelsApiKey: 'saved-pexels-key',
        elevenLabsApiKey: 'saved-eleven-key',
        ai33ProApiKey: 'saved-ai33-key',
        defaultOrientation: 'portrait',
        defaultQuality: '4k',
        defaultSceneLength: 'long',
        defaultVoiceProvider: 'ai33pro',
        defaultElevenLabs: DEFAULT_ELEVENLABS_SETTINGS,
        defaultAi33Pro: {
          sourceProvider: 'minimax',
          voiceId: 'minimax_male-qn-qingse',
          speed: 1.2,
        },
      })
    );

    renderSettingsPage();

    const geminiInput = screen.getByLabelText(/^google gemini api key$/i) as HTMLInputElement;
    const pexelsInput = screen.getByLabelText(/^pexels video api key$/i) as HTMLInputElement;
    const elevenInput = screen.getByLabelText(/^elevenlabs api key$/i) as HTMLInputElement;
    const ai33Input = screen.getByLabelText(/^ai33 pro api key$/i) as HTMLInputElement;
    const voiceServiceSelect = screen.getByLabelText(/^default voice service$/i) as HTMLSelectElement;

    expect(geminiInput.value).toBe('saved-gemini-key');
    expect(pexelsInput.value).toBe('saved-pexels-key');
    expect(elevenInput.value).toBe('saved-eleven-key');
    expect(ai33Input.value).toBe('saved-ai33-key');
    expect(voiceServiceSelect.value).toBe('ai33pro');
  });

  it('toggles password visibility when show/hide button is clicked for AI33 Pro', async () => {
    const user = userEvent.setup();
    renderSettingsPage();

    const ai33Input = screen.getByLabelText(/^ai33 pro api key$/i);
    expect(ai33Input).toHaveAttribute('type', 'password');

    const toggleBtns = screen.getAllByRole('button', { name: /show api key/i });
    // 4th toggle button corresponds to AI33 Pro
    await user.click(toggleBtns[3]);
    expect(ai33Input).toHaveAttribute('type', 'text');

    const hideBtns = screen.getAllByRole('button', { name: /hide api key/i });
    await user.click(hideBtns[0]);
    expect(ai33Input).toHaveAttribute('type', 'password');
  });

  it('tests AI33 Pro key independently and displays credit balance', async () => {
    const user = userEvent.setup();

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/v1/credits')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            credits: 9500,
          }),
        });
      }
      if (url.includes('/v3/voices')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: [{ voice_id: 'elevenlabs_voice_1', name: 'Adam' }],
            pagination: { has_more: false },
          }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });

    renderSettingsPage();

    const ai33Input = screen.getByLabelText(/^ai33 pro api key$/i);
    await user.type(ai33Input, 'valid-ai33-key');

    const testAi33Btn = screen.getByRole('button', { name: /test ai33 pro api key/i });
    await user.click(testAi33Btn);

    await waitFor(() => {
      expect(screen.getByText(/ai33 pro connection verified successfully/i)).toBeInTheDocument();
      expect(screen.getByText('9,500')).toBeInTheDocument();
    });
  });

  it('resets AI33 Pro test status on key edit', async () => {
    const user = userEvent.setup();

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/v1/credits')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            credits: 5000,
          }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });

    renderSettingsPage();

    const ai33Input = screen.getByLabelText(/^ai33 pro api key$/i);
    await user.type(ai33Input, 'key-1');

    const testAi33Btn = screen.getByRole('button', { name: /test ai33 pro api key/i });
    await user.click(testAi33Btn);

    await waitFor(() => {
      expect(screen.getByText(/ai33 pro connection verified successfully/i)).toBeInTheDocument();
    });

    // Edit key
    await user.type(ai33Input, '2');

    // Should reset to not tested
    expect(screen.queryByText(/ai33 pro connection verified successfully/i)).not.toBeInTheDocument();
  });

  it('runs "Test All Keys" in parallel across all 4 providers independently', async () => {
    const user = userEvent.setup();

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('generativelanguage.googleapis.com')) {
        return Promise.resolve({ ok: true, status: 200 });
      }
      if (url.includes('api.pexels.com')) {
        return Promise.resolve({ ok: false, status: 401, headers: new Headers() });
      }
      if (url.includes('/v1/user/subscription')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ tier: 'free', character_count: 100, character_limit: 10000 }),
        });
      }
      if (url.includes('/v1/credits')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ success: true, credits: 4200 }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });

    renderSettingsPage();

    const geminiInput = screen.getByLabelText(/^google gemini api key$/i);
    const pexelsInput = screen.getByLabelText(/^pexels video api key$/i);
    const elevenInput = screen.getByLabelText(/^elevenlabs api key$/i);
    const ai33Input = screen.getByLabelText(/^ai33 pro api key$/i);

    await user.type(geminiInput, 'gemini-val');
    await user.type(pexelsInput, 'pexels-bad');
    await user.type(elevenInput, 'eleven-val');
    await user.type(ai33Input, 'ai33-val');

    const testAllBtn = screen.getByRole('button', { name: /test all keys/i });
    await user.click(testAllBtn);

    await waitFor(() => {
      expect(screen.getByText(/model access confirmed/i)).toBeInTheDocument();
      expect(screen.getByText(/invalid pexels api key/i)).toBeInTheDocument();
      expect(screen.getByText(/elevenlabs connection verified successfully/i)).toBeInTheDocument();
      expect(screen.getByText(/ai33 pro connection verified successfully/i)).toBeInTheDocument();
      expect(screen.getByText('4,200')).toBeInTheDocument();
    });
  }, 15000);

  it('saves all settings including AI33 Pro defaults and defaultVoiceProvider to localStorage', async () => {
    const user = userEvent.setup();
    renderSettingsPage();

    const geminiInput = screen.getByLabelText(/^google gemini api key$/i);
    const pexelsInput = screen.getByLabelText(/^pexels video api key$/i);
    const elevenInput = screen.getByLabelText(/^elevenlabs api key$/i);
    const ai33Input = screen.getByLabelText(/^ai33 pro api key$/i);
    const voiceServiceSelect = screen.getByLabelText(/^default voice service$/i);

    await user.type(geminiInput, 'new-gemini');
    await user.type(pexelsInput, 'new-pexels');
    await user.type(elevenInput, 'new-eleven');
    await user.type(ai33Input, 'new-ai33');
    await user.selectOptions(voiceServiceSelect, 'ai33pro');

    const saveBtn = screen.getByRole('button', { name: /save settings/i });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText(/settings saved successfully/i)).toBeInTheDocument();
    });

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    expect(stored.geminiApiKey).toBe('new-gemini');
    expect(stored.pexelsApiKey).toBe('new-pexels');
    expect(stored.elevenLabsApiKey).toBe('new-eleven');
    expect(stored.ai33ProApiKey).toBe('new-ai33');
    expect(stored.defaultVoiceProvider).toBe('ai33pro');
    expect(stored.defaultElevenLabs).toBeDefined();
    expect(stored.defaultAi33Pro).toBeDefined();
  }, 15000);

  it('confirms and clears all 4 API keys while preserving video and voice defaults', async () => {
    const user = userEvent.setup();

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        geminiApiKey: 'to-clear-gemini',
        pexelsApiKey: 'to-clear-pexels',
        elevenLabsApiKey: 'to-clear-eleven',
        ai33ProApiKey: 'to-clear-ai33',
        defaultOrientation: 'portrait',
        defaultQuality: '720p',
        defaultSceneLength: 'short',
        defaultVoiceProvider: 'ai33pro',
        defaultElevenLabs: DEFAULT_ELEVENLABS_SETTINGS,
        defaultAi33Pro: DEFAULT_AI33PRO_SETTINGS,
      })
    );

    renderSettingsPage();

    const clearBtn = screen.getByRole('button', { name: /clear api keys/i });
    await user.click(clearBtn);

    expect(screen.getByText(/clear all api keys\?/i)).toBeInTheDocument();

    const confirmClearBtn = screen.getByRole('button', { name: /^clear keys$/i });
    await user.click(confirmClearBtn);

    await waitFor(() => {
      expect(screen.getByText(/all api keys cleared from local storage/i)).toBeInTheDocument();
    });

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    expect(stored.geminiApiKey).toBe('');
    expect(stored.pexelsApiKey).toBe('');
    expect(stored.elevenLabsApiKey).toBe('');
    expect(stored.ai33ProApiKey).toBe('');
    expect(stored.defaultOrientation).toBe('portrait');
    expect(stored.defaultVoiceProvider).toBe('ai33pro');
    expect(stored.defaultElevenLabs).toBeDefined();
    expect(stored.defaultAi33Pro).toBeDefined();
  });

  it('confirms and resets voice defaults for both ElevenLabs and AI33 Pro while preserving keys', async () => {
    const user = userEvent.setup();

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        geminiApiKey: 'keep-gemini',
        pexelsApiKey: 'keep-pexels',
        elevenLabsApiKey: 'keep-eleven',
        ai33ProApiKey: 'keep-ai33',
        defaultOrientation: 'portrait',
        defaultQuality: '4k',
        defaultSceneLength: 'long',
        defaultVoiceProvider: 'ai33pro',
        defaultElevenLabs: {
          ...DEFAULT_ELEVENLABS_SETTINGS,
          stability: 0.9,
          speed: 1.4,
        },
        defaultAi33Pro: {
          sourceProvider: 'minimax',
          voiceId: 'minimax_custom',
          speed: 1.5,
        },
      })
    );

    renderSettingsPage();

    const resetVoiceBtn = screen.getByRole('button', { name: /reset voice defaults/i });
    await user.click(resetVoiceBtn);

    expect(screen.getByText(/reset voice defaults\?/i)).toBeInTheDocument();

    const confirmResetBtn = screen.getByTitle(/confirm: reset voice defaults/i);
    await user.click(confirmResetBtn);

    await waitFor(() => {
      expect(screen.getByText(/voice defaults reset to initial values/i)).toBeInTheDocument();
    });

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    expect(stored.geminiApiKey).toBe('keep-gemini');
    expect(stored.ai33ProApiKey).toBe('keep-ai33');
    expect(stored.defaultVoiceProvider).toBe('elevenlabs');
    expect(stored.defaultElevenLabs.stability).toBe(0.5);
    expect(stored.defaultAi33Pro.sourceProvider).toBe('elevenlabs');
    expect(stored.defaultAi33Pro.speed).toBe(1.0);
  });
});
