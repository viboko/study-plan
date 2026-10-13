import type { Op } from '../domain/types';
import { AuthError } from './Store';

export type SyncState = 'saved' | 'saving' | 'auth' | 'error';

export interface SyncStatus {
  state: SyncState;
  pending: number;
  error?: string;
}

/**
 * Persists ops strictly in order. A failed op stays at the head of the queue
 * and everything waits behind it until `retry()` is called.
 */
export class WriteQueue {
  private queue: Op[] = [];
  private running = false;
  private status: SyncStatus = { state: 'saved', pending: 0 };

  constructor(
    private readonly apply: (op: Op) => Promise<void>,
    private readonly onStatus: (status: SyncStatus) => void,
  ) {}

  get idle(): boolean {
    return this.queue.length === 0;
  }

  enqueue(op: Op): void {
    this.queue.push(op);
    if (this.status.state === 'saved' || this.status.state === 'saving') void this.run();
    else this.setStatus({ ...this.status, pending: this.queue.length });
  }

  retry(): void {
    void this.run();
  }

  private setStatus(status: SyncStatus): void {
    this.status = status;
    this.onStatus(status);
  }

  private async run(): Promise<void> {
    if (this.running) {
      this.setStatus({ state: 'saving', pending: this.queue.length });
      return;
    }
    this.running = true;
    try {
      for (let op = this.queue[0]; op; op = this.queue[0]) {
        this.setStatus({ state: 'saving', pending: this.queue.length });
        await this.apply(op);
        this.queue.shift();
      }
      this.setStatus({ state: 'saved', pending: 0 });
    } catch (e) {
      this.setStatus({
        state: e instanceof AuthError ? 'auth' : 'error',
        pending: this.queue.length,
        error: e instanceof Error ? e.message : String(e),
      });
    } finally {
      this.running = false;
    }
  }
}
