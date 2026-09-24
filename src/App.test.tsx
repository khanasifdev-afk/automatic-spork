import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

describe('App Foundation and Routing', () => {
  it('renders application header and workspace by default', () => {
    render(<App />);

    expect(screen.getByText('Stock Video Generator')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /workspace/i })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /settings/i })[0]).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /script to video workspace/i })).toBeInTheDocument();
  });

  it('navigates to settings page when clicking settings link', async () => {
    const user = userEvent.setup();
    render(<App />);

    const settingsLink = screen.getAllByRole('link', { name: /settings/i })[0];
    await user.click(settingsLink);

    expect(screen.getByRole('heading', { name: /^settings$/i })).toBeInTheDocument();
    expect(screen.getByText(/api connections/i)).toBeInTheDocument();
  });
});
