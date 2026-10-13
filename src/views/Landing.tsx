import { useEffect, useState, type FormEvent } from 'react';
import { preloadGoogleSignIn } from '../google/auth';
import { SetupInstructions } from '../components/SetupInstructions';

interface Props {
  savedClientId: string;
  busy: boolean;
  error: string | null;
  onConnect(clientId: string): void;
  onDemo(): void;
}

export function Landing({ savedClientId, busy, error, onConnect, onDemo }: Props) {
  const [clientId, setClientId] = useState(savedClientId);

  useEffect(preloadGoogleSignIn, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (clientId.trim()) onConnect(clientId.trim());
  };

  return (
    <main className="landing">
      <h1>Study Plan</h1>
      <p>
        Plan study sessions and practice papers up to a deadline. Your data lives in your own Google
        Sheet, and the plan is mirrored to a Google Calendar for each child. This site has no server
        and keeps nothing itself.
      </p>
      <form className="connect" onSubmit={submit}>
        <label>
          Google OAuth client ID
          <input
            value={clientId}
            required
            spellCheck={false}
            placeholder="1234567890-abc123.apps.googleusercontent.com"
            onChange={(e) => setClientId(e.target.value)}
          />
        </label>
        <button type="submit" className="primary" disabled={busy}>
          {busy ? 'Connecting…' : 'Connect to Google'}
        </button>
      </form>
      {error && (
        <p className="warning" role="alert">
          {error}
        </p>
      )}
      <SetupInstructions />
      <p>
        <button type="button" disabled={busy} onClick={onDemo}>
          Try the demo
        </button>{' '}
        <span className="muted">Sample data; nothing is saved or sent to Google.</span>
      </p>
    </main>
  );
}
