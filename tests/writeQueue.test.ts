import { describe, expect, it, vi } from 'vitest';
import type { Op } from '../src/domain/types';
import { AuthError } from '../src/storage/Store';
import { WriteQueue, type SyncStatus } from '../src/storage/writeQueue';

const op = (name: string): Op => ({ kind: 'deleteChild', name });
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function setUp(apply: (op: Op) => Promise<void>) {
  const statuses: SyncStatus[] = [];
  const queue = new WriteQueue(apply, (s) => statuses.push(s));
  return { queue, statuses, last: () => statuses.at(-1) };
}

describe('WriteQueue', () => {
  it('applies ops one at a time, in order', async () => {
    const seen: string[] = [];
    let active = 0;
    const { queue, last } = setUp(async (o) => {
      expect(++active).toBe(1);
      await settle();
      seen.push((o as { name: string }).name);
      active--;
    });
    queue.enqueue(op('a'));
    queue.enqueue(op('b'));
    queue.enqueue(op('c'));
    expect(last()).toEqual({ state: 'saving', pending: 3 });
    await vi.waitFor(() => expect(last()).toEqual({ state: 'saved', pending: 0 }));
    expect(seen).toEqual(['a', 'b', 'c']);
    expect(queue.idle).toBe(true);
  });

  it('holds everything behind a failed op until retried', async () => {
    let failing = true;
    const seen: string[] = [];
    const { queue, last } = setUp(async (o) => {
      if (failing) throw new Error('offline');
      seen.push((o as { name: string }).name);
    });
    queue.enqueue(op('a'));
    await vi.waitFor(() => expect(last()?.state).toBe('error'));
    queue.enqueue(op('b'));
    expect(last()).toMatchObject({ state: 'error', pending: 2, error: 'offline' });
    expect(seen).toEqual([]);

    failing = false;
    queue.retry();
    await vi.waitFor(() => expect(last()?.state).toBe('saved'));
    expect(seen).toEqual(['a', 'b']);
  });

  it('distinguishes an expired session from other errors', async () => {
    const { queue, last } = setUp(async () => {
      throw new AuthError();
    });
    queue.enqueue(op('a'));
    await vi.waitFor(() => expect(last()?.state).toBe('auth'));
    expect(queue.idle).toBe(false);
  });
});
