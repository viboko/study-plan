import { AuthError } from '../storage/Store';
import type { GoogleAuth } from './auth';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function isGone(e: unknown): boolean {
  return e instanceof ApiError && (e.status === 404 || e.status === 410);
}

export interface Request {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  query?: Record<string, string | string[]>;
  body?: unknown;
}

/** Calls a Google REST endpoint and returns the parsed JSON response. */
export type Api = <T = unknown>(url: string, request?: Request) => Promise<T>;

export function createApi(auth: GoogleAuth, fetchFn: typeof fetch = fetch): Api {
  return async <T>(url: string, { method = 'GET', query, body }: Request = {}): Promise<T> => {
    const target = new URL(url);
    for (const [key, value] of Object.entries(query ?? {})) {
      for (const v of [value].flat()) target.searchParams.append(key, v);
    }
    const response = await fetchFn(target, {
      method,
      headers: {
        Authorization: `Bearer ${auth.getToken()}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (response.status === 401) {
      auth.invalidate();
      throw new AuthError('Your Google session has expired');
    }
    const text = await response.text();
    const json = text ? (JSON.parse(text) as unknown) : undefined;
    if (!response.ok) {
      const message = (json as { error?: { message?: string } } | undefined)?.error?.message;
      throw new ApiError(response.status, message ?? `Google returned ${response.status}`);
    }
    return json as T;
  };
}
