import { describe, expect, it } from 'vitest';
import {
  findProblems,
  incompleteSessions,
  isUnavailable,
  toggleUnavailableDate,
} from '../src/domain/rules';
import { applyOp } from '../src/domain/types';
import { child, item, paper } from './fixtures';

const kinds = (...args: Parameters<typeof findProblems>) =>
  findProblems(...args).map((p) => p.kind);

describe('availability', () => {
  const c = child({
    unavailableWeekdays: [1],
    unavailableDates: [{ from: '2026-10-19', to: '2026-10-23' }],
  });

  it('combines weekdays and date ranges', () => {
    expect(isUnavailable(c, '2026-10-13')).toBe(true); // a Tuesday
    expect(isUnavailable(c, '2026-10-21')).toBe(true);
    expect(isUnavailable(c, '2026-10-14')).toBe(false);
  });

  it('toggles a single date, splitting a range around it', () => {
    expect(toggleUnavailableDate(c, '2026-10-21').unavailableDates).toEqual([
      { from: '2026-10-19', to: '2026-10-20' },
      { from: '2026-10-22', to: '2026-10-23' },
    ]);
    expect(toggleUnavailableDate(c, '2026-10-15').unavailableDates).toEqual([
      { from: '2026-10-15', to: '2026-10-15' },
      { from: '2026-10-19', to: '2026-10-23' },
    ]);
  });
});

describe('findProblems', () => {
  it('finds nothing wrong with a tidy plan', () => {
    const items = [
      item({ date: '2026-10-14' }),
      item({ date: '2026-10-15' }),
      paper({ date: '2026-10-16' }),
      item({ subject: 'English' }),
    ];
    expect(findProblems(child(), items)).toEqual([]);
  });

  it('flags items after the final date and on unavailable days', () => {
    const c = child({ unavailableWeekdays: [1] });
    expect(kinds(c, [item({ date: '2026-11-02' })])).toEqual(['deadline']);
    expect(kinds(c, [item({ date: '2026-10-13' })])).toEqual(['unavailable']);
  });

  it('ignores completed items for deadline and availability', () => {
    const c = child({ unavailableWeekdays: [1] });
    expect(kinds(c, [item({ date: '2026-10-13', completed: true })])).toEqual([]);
  });

  it('flags days over the daily limit', () => {
    const items = [item({ date: '2026-10-14' }), item({ date: '2026-10-14', subject: 'English' })];
    expect(kinds(child(), items)).toEqual(['load']);
    expect(kinds(child({ maxPerDay: 2 }), items)).toEqual([]);
  });

  it('flags a paper on or before the last session of its subject', () => {
    const sessions = [item({ date: '2026-10-14' }), item({ date: '2026-10-20' })];
    expect(kinds(child(), [...sessions, paper({ date: '2026-10-19' })])).toEqual(['paper']);
    expect(kinds(child({ maxPerDay: 2 }), [...sessions, paper({ date: '2026-10-20' })])).toEqual([
      'paper',
    ]);
    expect(kinds(child(), [...sessions, paper({ date: '2026-10-21' })])).toEqual([]);
  });

  it('flags a planned paper while sessions of its subject are unplanned', () => {
    const items = [item(), paper({ date: '2026-10-21' })];
    expect(kinds(child(), items)).toEqual(['paper']);
  });

  it('only gates papers on their own subject', () => {
    const items = [item({ subject: 'English' }), paper({ date: '2026-10-21' })];
    expect(kinds(child(), items)).toEqual([]);
  });
});

describe('incompleteSessions', () => {
  it('counts sessions of the paper subject that are not completed', () => {
    const p = paper();
    const items = [item({ completed: true }), item(), item({ subject: 'English' }), p];
    expect(incompleteSessions(items, p)).toBe(1);
  });
});

describe('applyOp', () => {
  it('updates existing items and appends new ones', () => {
    const a = item();
    const b = item();
    const plan = applyOp(
      { children: [child()], items: [a] },
      { kind: 'upsertItems', items: [{ ...a, title: 'Changed' }, b] },
    );
    expect(plan.items.map((i) => i.title)).toEqual(['Changed', b.title]);
  });

  it('renames a child along with their items, and removes them together', () => {
    const start = { children: [child()], items: [item()] };
    const renamed = applyOp(start, {
      kind: 'upsertChild',
      child: child({ name: 'Alicia' }),
      previousName: 'Alice',
    });
    expect(renamed.children.map((c) => c.name)).toEqual(['Alicia']);
    expect(renamed.items[0]?.child).toBe('Alicia');
    expect(applyOp(renamed, { kind: 'deleteChild', name: 'Alicia' })).toEqual({
      children: [],
      items: [],
    });
  });
});
