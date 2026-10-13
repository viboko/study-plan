import { useState, useSyncExternalStore } from 'react';
import type { Plan } from './domain/types';
import { createApi } from './google/api';
import { GoogleAuth } from './google/auth';
import { PlanProvider, usePlan } from './state/PlanContext';
import { DemoStore } from './storage/demoStore';
import { SheetsStore } from './storage/sheetsStore';
import type { Store } from './storage/Store';
import { ItemsView } from './views/ItemsView';
import { Landing } from './views/Landing';
import { PlanView } from './views/PlanView';
import { SettingsView } from './views/SettingsView';

const CLIENT_ID_KEY = 'studyPlan.clientId';
const VIEWS = ['plan', 'items', 'settings'] as const;
type View = (typeof VIEWS)[number];

interface Session {
  store: Store;
  plan: Plan;
  auth: GoogleAuth | null;
}

function subscribeToHash(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

function useView(): View {
  const hash = useSyncExternalStore(subscribeToHash, () => window.location.hash.slice(1));
  return VIEWS.find((v) => v === hash) ?? 'plan';
}

function SyncStatus() {
  const { status, warning, refreshing, refresh, retry, demo } = usePlan();
  const count = status.pending > 1 ? ` (${status.pending} changes)` : '';
  return (
    <div className="sync">
      {warning && (
        <span className="sync-warning" title={warning}>
          ⚠ Calendar
        </span>
      )}
      {status.state === 'saving' && <span className="muted">Saving…{count}</span>}
      {status.state === 'saved' && (
        <span className="muted">{demo ? 'Demo' : refreshing ? 'Loading…' : 'Saved ✓'}</span>
      )}
      {status.state === 'auth' && (
        <button type="button" className="primary" onClick={() => void retry()}>
          Reconnect to Google{status.pending ? ' to save' : ''}
        </button>
      )}
      {status.state === 'error' && (
        <button type="button" className="danger" title={status.error} onClick={() => void retry()}>
          Error{count} · Retry
        </button>
      )}
      {!demo && status.state === 'saved' && (
        <button type="button" disabled={refreshing} onClick={() => void refresh()}>
          Refresh
        </button>
      )}
    </div>
  );
}

function Shell({ clientId, onSignOut }: { clientId: string | null; onSignOut(): void }) {
  const view = useView();
  const { plan, child, selectChild, status } = usePlan();
  return (
    <>
      <header className="app-header">
        <h1>Study Plan</h1>
        <nav>
          {VIEWS.map((v) => (
            <a key={v} href={`#${v}`} aria-current={v === view ? 'page' : undefined}>
              {v[0]?.toUpperCase() + v.slice(1)}
            </a>
          ))}
        </nav>
        <span className="spacer" />
        <SyncStatus />
      </header>
      {status.state === 'error' && (
        <p className="warning banner" role="alert">
          {status.error}
        </p>
      )}
      <main className="app-main">
        {view !== 'settings' && plan.children.length > 0 && (
          <div className="child-tabs" role="tablist" aria-label="Child">
            {plan.children.map((c) => (
              <button
                key={c.name}
                type="button"
                role="tab"
                aria-selected={c.name === child?.name}
                onClick={() => selectChild(c.name)}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
        {view === 'plan' && <PlanView />}
        {view === 'items' && <ItemsView />}
        {view === 'settings' && <SettingsView clientId={clientId} onSignOut={onSignOut} />}
      </main>
    </>
  );
}

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedClientId, setSavedClientId] = useState(
    () => localStorage.getItem(CLIENT_ID_KEY) ?? '',
  );

  const start = async (open: () => Promise<Session>) => {
    setBusy(true);
    setError(null);
    try {
      setSession(await open());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const connect = (clientId: string) =>
    start(async () => {
      const auth = new GoogleAuth(clientId);
      await auth.signIn();
      localStorage.setItem(CLIENT_ID_KEY, clientId);
      setSavedClientId(clientId);
      const store = new SheetsStore(createApi(auth));
      return { store, plan: await store.load(), auth };
    });

  const demo = () =>
    start(async () => {
      const store = new DemoStore();
      return { store, plan: await store.load(), auth: null };
    });

  if (!session) {
    return (
      <Landing
        savedClientId={savedClientId}
        busy={busy}
        error={error}
        onConnect={(clientId) => void connect(clientId)}
        onDemo={() => void demo()}
      />
    );
  }

  const { store, plan, auth } = session;
  return (
    <PlanProvider
      store={store}
      initialPlan={plan}
      demo={!auth}
      signIn={() => auth?.signIn() ?? Promise.resolve()}
    >
      <Shell
        clientId={auth?.clientId ?? null}
        onSignOut={() => {
          auth?.signOut();
          setSession(null);
        }}
      />
    </PlanProvider>
  );
}
