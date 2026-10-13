// Google Identity Services token flow. A static site can't hold a refresh
// token, so the access token lives in memory and lasts about an hour.

import { AuthError } from '../storage/Store';

const GIS_SRC = 'https://accounts.google.com/gsi/client';

export const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/calendar.app.created',
].join(' ');

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

interface TokenClient {
  requestAccessToken(options?: { prompt?: string }): void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(config: {
            client_id: string;
            scope: string;
            callback: (response: TokenResponse) => void;
            error_callback?: (error: { type: string; message?: string }) => void;
          }): TokenClient;
          revoke(token: string, done?: () => void): void;
        };
      };
    };
  }
}

let gisLoading: Promise<void> | null = null;

function loadGis(): Promise<void> {
  gisLoading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gisLoading = null;
      reject(new Error('Could not load Google sign-in. Check your connection or ad blocker.'));
    };
    document.head.append(script);
  });
  return gisLoading;
}

/** Start loading the sign-in script so a later click can open the popup promptly. */
export function preloadGoogleSignIn(): void {
  void loadGis().catch(() => undefined);
}

export class GoogleAuth {
  private token: string | null = null;
  private expiresAt = 0;

  constructor(readonly clientId: string) {}

  /** Opens Google's popup; call from a click handler. */
  async signIn(): Promise<void> {
    await loadGis();
    const oauth2 = window.google?.accounts.oauth2;
    if (!oauth2) throw new Error('Google sign-in is unavailable');
    const response = await new Promise<TokenResponse>((resolve, reject) => {
      oauth2
        .initTokenClient({
          client_id: this.clientId,
          scope: SCOPES,
          callback: resolve,
          error_callback: (e) =>
            reject(
              new Error(
                e.type === 'popup_closed'
                  ? 'Sign-in was cancelled'
                  : e.type === 'popup_failed_to_open'
                    ? 'The sign-in popup was blocked. Allow popups for this site and try again.'
                    : (e.message ?? 'Sign-in failed'),
              ),
            ),
        })
        .requestAccessToken({ prompt: '' });
    });
    if (!response.access_token) {
      throw new Error(response.error_description ?? response.error ?? 'Sign-in failed');
    }
    this.token = response.access_token;
    this.expiresAt = Date.now() + ((response.expires_in ?? 3600) - 60) * 1000;
  }

  getToken(): string {
    if (!this.token || Date.now() >= this.expiresAt) {
      throw new AuthError('Your Google session has expired');
    }
    return this.token;
  }

  /** Forget the token, e.g. after Google rejects it. */
  invalidate(): void {
    this.token = null;
  }

  signOut(): void {
    if (this.token) window.google?.accounts.oauth2.revoke(this.token);
    this.token = null;
  }
}
