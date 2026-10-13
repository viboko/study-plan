import type { Op, Plan } from '../domain/types';

/** Thrown when the Google access token is missing, expired or rejected. */
export class AuthError extends Error {
  constructor(message = 'Not signed in to Google') {
    super(message);
    this.name = 'AuthError';
  }
}

/** Where the plan is kept. Ops are applied one at a time, in order. */
export interface Store {
  load(): Promise<Plan>;
  /** Persist one change. Must be safe to call again if it failed part-way. */
  apply(op: Op): Promise<void>;
  /** Make the calendars match the plan exactly. */
  resyncCalendar?(): Promise<void>;
  /** A non-fatal problem from the last calendar update, if any. */
  calendarWarning?(): string | null;
  spreadsheetUrl?(): string | null;
}
