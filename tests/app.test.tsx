import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { App } from '../src/App';

beforeAll(() => {
  // jsdom doesn't implement modal dialogs.
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
});

afterEach(() => {
  cleanup();
  window.location.hash = '';
});

async function openDemo() {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole('button', { name: 'Try the demo' }));
  await screen.findByRole('heading', { name: /Unplanned/ });
  return user;
}

describe('App in demo mode', () => {
  it('shows the landing page with setup instructions first', () => {
    render(<App />);
    expect(screen.getByLabelText('Google OAuth client ID')).toBeTruthy();
    expect(screen.getByText(/How to get a client ID/)).toBeTruthy();
  });

  it('adds a session and lists it as unplanned', async () => {
    const user = await openDemo();
    expect(screen.getByRole('heading', { name: 'Unplanned (8)' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: '+ Add item' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Title'), 'Ratio');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(screen.getByRole('heading', { name: 'Unplanned (9)' })).toBeTruthy();
    expect(screen.getByText('Ratio')).toBeTruthy();
  });

  it('auto-schedules everything without creating problems', async () => {
    const user = await openDemo();
    await user.click(screen.getByRole('button', { name: /Auto-schedule/ }));
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(screen.getByRole('heading', { name: 'Unplanned (0)' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Problems (0)' })).toBeTruthy();
  });

  it('switches child', async () => {
    const user = await openDemo();
    await user.click(screen.getByRole('tab', { name: 'Ben' }));
    expect(screen.getByRole('heading', { name: 'Unplanned (3)' })).toBeTruthy();
  });
});
