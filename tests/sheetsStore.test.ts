import { beforeEach, describe, expect, it } from 'vitest';
import { ApiError } from '../src/google/api';
import { ITEM_HEADER } from '../src/storage/rows';
import { SheetsStore } from '../src/storage/sheetsStore';
import { AuthError } from '../src/storage/Store';
import { FakeGoogle, memoryStorage } from './fakeGoogle';
import { child, item, paper } from './fixtures';

let google: FakeGoogle;
let store: SheetsStore;

/** A store with Alice set up, as after first use. */
async function setUp(): Promise<void> {
  google = new FakeGoogle();
  store = new SheetsStore(google.api, memoryStorage());
  await store.load();
  await store.apply({ kind: 'upsertChild', child: child() });
}

const titles = (sheet: string) =>
  google
    .rows(sheet)
    .slice(1)
    .map((r) => r[5]);
const summaries = () => google.events('Study Plan – Alice').map((e) => e.summary);

beforeEach(setUp);

describe('SheetsStore', () => {
  it('creates the spreadsheet on first use and finds it again later', async () => {
    expect(google.rows('Children')[0]?.[0]).toBe('Name');
    expect(google.rows('Alice')[0]).toEqual(ITEM_HEADER);

    const again = new SheetsStore(google.api, memoryStorage());
    const plan = await again.load();
    expect(plan.children).toEqual([child()]);
    expect(google.calls.filter((c) => c === 'POST /v4/spreadsheets')).toHaveLength(1);
  });

  it('round-trips children and items through the sheet', async () => {
    const c = child({
      maxPerDay: 2,
      unavailableWeekdays: [1, 5],
      unavailableDates: [
        { from: '2026-10-20', to: '2026-10-20' },
        { from: '2026-12-24', to: '2026-12-31' },
      ],
    });
    const items = [item({ date: '2026-10-14', completed: true }), paper()];
    await store.apply({ kind: 'upsertChild', child: c });
    await store.apply({ kind: 'upsertItems', items });
    expect(await store.load()).toEqual({ children: [c], items });
  });

  it('updates rows in place, wherever they have moved to', async () => {
    const [a, b, c] = [item({ title: 'A' }), item({ title: 'B' }), item({ title: 'C' })];
    await store.apply({ kind: 'upsertItems', items: [a, b, c] });
    // Someone sorts the sheet by hand.
    const rows = google.rows('Alice');
    rows.splice(1, 3, ...rows.slice(1).reverse());

    await store.apply({ kind: 'upsertItems', items: [{ ...a, title: 'A2' }] });
    expect(titles('Alice')).toEqual(['C', 'B', 'A2']);

    await store.apply({ kind: 'deleteItems', items: [c, a] });
    expect(titles('Alice')).toEqual(['B']);
  });

  it('gives ids to rows typed in by hand and reads date serials', async () => {
    google.rows('Alice').push(['', 'Paper', 'Book', 'maths', '', 'By hand', 45, 46309, true]);
    const plan = await store.load();
    expect(plan.items[0]).toMatchObject({
      type: 'Paper',
      subject: 'Maths',
      title: 'By hand',
      minutes: 45,
      date: '2026-10-14',
      completed: true,
    });
    expect(plan.items[0]?.id).toBeTruthy();
    expect(google.rows('Alice')[1]?.[0]).toBe(plan.items[0]?.id);
  });

  it('mirrors dated items to an all-day event in the child calendar', async () => {
    const session = item({ title: 'Fractions', date: '2026-10-14' });
    await store.apply({ kind: 'upsertItems', items: [session, item()] });
    const [event] = google.events('Study Plan – Alice');
    expect(event).toMatchObject({
      summary: 'Maths: Fractions',
      start: { date: '2026-10-14' },
      end: { date: '2026-10-15' },
    });
    expect(google.rows('Alice')[1]?.[9]).toBe(event?.id);
    expect(google.rows('Children')[1]?.[5]).toMatch(/^cal-/);

    await store.apply({
      kind: 'upsertItems',
      items: [{ ...session, date: '2026-10-16', completed: true }],
    });
    expect(google.events('Study Plan – Alice')).toHaveLength(1);
    expect(google.events('Study Plan – Alice')[0]).toMatchObject({
      id: event?.id,
      summary: '✓ Maths: Fractions',
      start: { date: '2026-10-16' },
    });

    await store.apply({ kind: 'upsertItems', items: [{ ...session, date: null }] });
    expect(google.events('Study Plan – Alice')).toEqual([]);
    expect(google.rows('Alice')[1]?.[9]).toBe('');
  });

  it('creates a single calendar when many items are planned at once', async () => {
    const items = Array.from({ length: 8 }, (_, i) => item({ date: `2026-10-${14 + i}` }));
    await store.apply({ kind: 'upsertItems', items });
    expect(google.calendars.size).toBe(1);
    expect(google.events('Study Plan – Alice')).toHaveLength(8);
  });

  it('removes the event when an item is deleted', async () => {
    const session = item({ date: '2026-10-14' });
    await store.apply({ kind: 'upsertItems', items: [session] });
    await store.apply({ kind: 'deleteItems', items: [session] });
    expect(google.events('Study Plan – Alice')).toEqual([]);
    expect(titles('Alice')).toEqual([]);
  });

  it('still saves to the sheet when the calendar fails, and reports it', async () => {
    const realApi = google.api;
    const flaky = new SheetsStore((url, request) => {
      if (url.includes('/calendar/')) throw new ApiError(403, 'Calendar API is not enabled');
      return realApi(url, request);
    }, memoryStorage());
    await flaky.load();
    await flaky.apply({
      kind: 'upsertItems',
      items: [item({ title: 'Saved', date: '2026-10-14' })],
    });
    expect(titles('Alice')).toEqual(['Saved']);
    expect(flaky.calendarWarning()).toContain('Calendar API is not enabled');
  });

  it('lets an expired session fail the whole op so it can be retried', async () => {
    google.failWith = new AuthError();
    const op = { kind: 'upsertItems' as const, items: [item({ date: '2026-10-14' })] };
    await expect(store.apply(op)).rejects.toBeInstanceOf(AuthError);
    google.failWith = null;
    await store.apply(op);
    await store.apply(op);
    expect(titles('Alice')).toHaveLength(1);
    expect(google.events('Study Plan – Alice')).toHaveLength(1);
  });

  it('renames a child: sheet, calendar and Children row', async () => {
    await store.apply({ kind: 'upsertItems', items: [item({ date: '2026-10-14' })] });
    await store.apply({
      kind: 'upsertChild',
      child: child({ name: 'Alicia' }),
      previousName: 'Alice',
    });
    expect([...google.sheets.keys()]).toEqual(['Children', 'Alicia']);
    expect(google.events('Study Plan – Alicia')).toHaveLength(1);
    const plan = await store.load();
    expect(plan.children.map((c) => c.name)).toEqual(['Alicia']);
    expect(plan.items[0]?.child).toBe('Alicia');
  });

  it('removes a child with their sheet and calendar', async () => {
    await store.apply({ kind: 'upsertChild', child: child({ name: 'Ben' }) });
    await store.apply({ kind: 'upsertItems', items: [item({ date: '2026-10-14' })] });
    await store.apply({ kind: 'deleteChild', name: 'Alice' });
    expect([...google.sheets.keys()]).toEqual(['Children', 'Ben']);
    expect(google.calendars.size).toBe(0);
    expect(google.rows('Children').map((r) => r[0])).toEqual(['Name', 'Ben']);
  });

  it('resyncs the calendar after hand edits', async () => {
    const kept = item({ title: 'Kept', date: '2026-10-14' });
    const moved = item({ title: 'Moved', date: '2026-10-15' });
    const lost = item({ title: 'Lost', date: '2026-10-16' });
    await store.apply({ kind: 'upsertItems', items: [kept, moved, lost] });

    const calendar = [...google.calendars.values()][0];
    const events = [...(calendar?.events.values() ?? [])];
    // Deleted in Calendar, re-dated in the sheet, and a stray event added.
    calendar?.events.delete(events[2]?.id ?? '');
    (google.rows('Alice')[2] as unknown[])[7] = '2026-10-20';
    calendar?.events.set('stray', { id: 'stray', summary: 'Stray' });

    await store.resyncCalendar();
    expect(summaries().sort()).toEqual(['Maths: Kept', 'Maths: Lost', 'Maths: Moved']);
    const movedEvent = google
      .events('Study Plan – Alice')
      .find((e) => e.summary === 'Maths: Moved');
    expect(movedEvent?.start).toEqual({ date: '2026-10-20' });
    expect(movedEvent?.id).toBe(events[1]?.id);
    expect(google.rows('Alice')[3]?.[9]).toBeTruthy();
  });
});
