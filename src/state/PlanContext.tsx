import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { applyOp, type Child, type Item, type Op, type Plan } from '../domain/types';
import { AuthError, type Store } from '../storage/Store';
import { WriteQueue, type SyncStatus } from '../storage/writeQueue';

export interface PlanApi {
  plan: Plan;
  /** The selected child, if there are any children. */
  child: Child | null;
  /** The selected child's items, in sheet order. */
  items: Item[];
  selectChild(name: string): void;
  /** Update the UI immediately and save in the background. */
  apply(op: Op): void;
  status: SyncStatus;
  warning: string | null;
  refreshing: boolean;
  /** Reload from the store, unless there are unsaved changes. */
  refresh(): Promise<void>;
  /** Try again after an error; signs in again first if the session expired. */
  retry(): Promise<void>;
  resyncCalendar(): Promise<void>;
  store: Store;
  demo: boolean;
}

const PlanContext = createContext<PlanApi | null>(null);

export function usePlan(): PlanApi {
  const api = useContext(PlanContext);
  if (!api) throw new Error('usePlan must be used inside PlanProvider');
  return api;
}

interface Props {
  store: Store;
  initialPlan: Plan;
  demo: boolean;
  /** Get a fresh Google token; resolves once signed in. */
  signIn(): Promise<void>;
  children: ReactNode;
}

const REFRESH_INTERVAL_MS = 30_000;

export function PlanProvider({ store, initialPlan, demo, signIn, children }: Props) {
  const [plan, setPlan] = useState(initialPlan);
  const [childName, selectChild] = useState<string | null>(null);
  const [status, setStatus] = useState<SyncStatus>({ state: 'saved', pending: 0 });
  const [warning, setWarning] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [queue] = useState(
    () =>
      new WriteQueue(
        (op) => store.apply(op),
        (next) => {
          setStatus(next);
          if (next.state === 'saved') setWarning(store.calendarWarning?.() ?? null);
        },
      ),
  );

  const apply = useCallback(
    (op: Op) => {
      setPlan((current) => applyOp(current, op));
      queue.enqueue(op);
    },
    [queue],
  );

  const fail = useCallback((e: unknown) => {
    setStatus({
      state: e instanceof AuthError ? 'auth' : 'error',
      pending: 0,
      error: e instanceof Error ? e.message : String(e),
    });
  }, []);

  const refresh = useCallback(async () => {
    if (!queue.idle) return;
    setRefreshing(true);
    try {
      const loaded = await store.load();
      // Don't clobber changes made while the load was in flight.
      if (queue.idle) {
        setPlan(loaded);
        setStatus({ state: 'saved', pending: 0 });
      }
    } catch (e) {
      fail(e);
    } finally {
      setRefreshing(false);
    }
  }, [queue, store, fail]);

  const retry = useCallback(async () => {
    try {
      if (status.state === 'auth') await signIn();
    } catch (e) {
      return fail(e instanceof Error ? new AuthError(e.message) : e);
    }
    if (queue.idle) await refresh();
    else queue.retry();
  }, [status.state, signIn, queue, refresh, fail]);

  const resyncCalendar = useCallback(async () => {
    if (!queue.idle || !store.resyncCalendar) return;
    setRefreshing(true);
    try {
      await store.resyncCalendar();
      setWarning(null);
    } catch (e) {
      fail(e);
    } finally {
      setRefreshing(false);
    }
  }, [queue, store, fail]);

  // Pick up edits made directly in the spreadsheet when the tab regains focus.
  useEffect(() => {
    if (demo) return;
    let last = Date.now();
    const onFocus = () => {
      if (Date.now() - last < REFRESH_INTERVAL_MS) return;
      last = Date.now();
      void refresh();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [demo, refresh]);

  // Warn before closing the tab with unsaved changes.
  useEffect(() => {
    if (status.pending === 0) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [status.pending]);

  const child = plan.children.find((c) => c.name === childName) ?? plan.children[0] ?? null;
  const items = child ? plan.items.filter((i) => i.child === child.name) : [];

  return (
    <PlanContext.Provider
      value={{
        plan,
        child,
        items,
        selectChild,
        apply,
        status,
        warning,
        refreshing,
        refresh,
        retry,
        resyncCalendar,
        store,
        demo,
      }}
    >
      {children}
    </PlanContext.Provider>
  );
}
