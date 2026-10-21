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

  it('adds several papers with shared minutes', async () => {
    const user = await openDemo();
    await user.click(screen.getByRole('link', { name: 'Items' }));
    await user.click(screen.getByRole('button', { name: '+ Add several papers' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).queryByLabelText('Category')).toBeNull();
    const minutes = within(dialog).getByLabelText('Minutes');
    await user.clear(minutes);
    await user.type(minutes, '45');
    await user.type(within(dialog).getByLabelText('Titles, one per line'), 'Mock A{Enter}Mock B');
    await user.click(within(dialog).getByRole('button', { name: 'Add 2 papers' }));

    for (const title of ['Mock A', 'Mock B']) {
      const row = screen.getByRole('button', { name: title }).closest('tr')!;
      expect(within(row).getByText('Paper')).toBeTruthy();
      expect(within(row).getByText('45 min')).toBeTruthy();
    }
  });

  it('suggests existing books when adding several sessions', async () => {
    const user = await openDemo();
    await user.click(screen.getByRole('link', { name: 'Items' }));
    await user.click(screen.getByRole('button', { name: '+ Add several sessions' }));
    const book = within(screen.getByRole('dialog')).getByLabelText('Book') as HTMLInputElement;
    const options = [...book.list!.querySelectorAll('option')].map((o) => o.value);
    expect(options.length).toBeGreaterThan(0);
  });

  it('switches child', async () => {
    const user = await openDemo();
    await user.click(screen.getByRole('tab', { name: 'Ben' }));
    expect(screen.getByRole('heading', { name: 'Unplanned (3)' })).toBeTruthy();
  });
});
