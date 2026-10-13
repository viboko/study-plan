import { describe, expect, it } from 'vitest';
import { findProblems } from '../src/domain/rules';
import { autoSchedule } from '../src/domain/schedule';
import type { Child, Item } from '../src/domain/types';
import { child, item, paper } from './fixtures';

const FROM = '2026-10-12'; // a Monday

function apply(items: Item[], c: Child): Item[] {
  const dates = new Map(autoSchedule(c, items, FROM).assignments.map((a) => [a.id, a.date]));
  return items.map((i) => ({ ...i, date: dates.get(i.id) ?? i.date }));
}

describe('autoSchedule', () => {
  it('spreads items evenly up to the final date', () => {
    const items = [item(), item(), item(), item()];
    const { assignments, unplaced } = autoSchedule(child({ finalDate: '2026-10-19' }), items, FROM);
    expect(unplaced).toEqual([]);
    expect(assignments.map((a) => a.date)).toEqual([
      '2026-10-12',
      '2026-10-14',
      '2026-10-16',
      '2026-10-18',
    ]);
  });

  it('skips unavailable days and days that are already full', () => {
    const c = child({
      finalDate: '2026-10-16',
      unavailableWeekdays: [1],
      unavailableDates: [{ from: '2026-10-15', to: '2026-10-15' }],
    });
    const items = [item({ date: '2026-10-12' }), item(), item()];
    const { assignments } = autoSchedule(c, items, FROM);
    expect(assignments.map((a) => a.date)).toEqual(['2026-10-14', '2026-10-16']);
  });

  it('uses spare capacity when several items are allowed per day', () => {
    const c = child({ finalDate: '2026-10-13', maxPerDay: 2 });
    const items = [item(), item(), item(), item()];
    const { assignments } = autoSchedule(c, items, FROM);
    expect(assignments.map((a) => a.date)).toEqual([
      '2026-10-12',
      '2026-10-12',
      '2026-10-13',
      '2026-10-13',
    ]);
  });

  it('reports what does not fit instead of breaking a rule', () => {
    const items = [item(), item(), item()];
    const { assignments, unplaced } = autoSchedule(child({ finalDate: '2026-10-13' }), items, FROM);
    expect(assignments).toHaveLength(2);
    expect(unplaced).toEqual([items[2]?.id]);
  });

  it('places nothing without a final date', () => {
    const items = [item(), paper()];
    const { assignments, unplaced } = autoSchedule(child({ finalDate: null }), items, FROM);
    expect(assignments).toEqual([]);
    expect(unplaced).toHaveLength(2);
  });

  it('leaves planned and completed items alone', () => {
    const items = [item({ date: '2026-10-30' }), item({ completed: true }), item()];
    const { assignments } = autoSchedule(child(), items, FROM);
    expect(assignments.map((a) => a.id)).toEqual([items[2]?.id]);
  });

  it('interleaves subjects while keeping order within a subject', () => {
    const m1 = item({ title: 'M1' });
    const m2 = item({ title: 'M2' });
    const e1 = item({ title: 'E1', subject: 'English' });
    const e2 = item({ title: 'E2', subject: 'English' });
    const scheduled = apply([m1, m2, e1, e2], child())
      .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
      .map((i) => i.title);
    expect(scheduled).toEqual(['M1', 'E1', 'M2', 'E2']);
  });

  it('puts each paper after the last session of its subject', () => {
    const items = [
      paper(),
      paper({ subject: 'English' }),
      item(),
      item({ subject: 'English' }),
      item(),
      item({ date: '2026-10-28', subject: 'English' }),
    ];
    const c = child();
    const scheduled = apply(items, c);
    expect(scheduled.every((i) => i.date)).toBe(true);
    expect(findProblems(c, scheduled)).toEqual([]);
    expect(scheduled[1]?.date && scheduled[1].date > '2026-10-28').toBe(true);
  });

  it('holds back a paper whose sessions cannot all be placed', () => {
    const items = [item(), item(), item(), paper()];
    const { unplaced } = autoSchedule(child({ finalDate: '2026-10-13' }), items, FROM);
    expect(unplaced).toEqual([items[2]?.id, items[3]?.id]);
  });

  it('never produces a rule break on a crowded plan', () => {
    const c = child({ unavailableWeekdays: [5, 6], finalDate: '2026-11-13' });
    const subjects = ['Maths', 'English', 'Verbal Reasoning'];
    const items = subjects.flatMap((subject) => [
      ...Array.from({ length: 6 }, () => item({ subject })),
      paper({ subject }),
      paper({ subject }),
    ]);
    const scheduled = apply(items, c);
    expect(scheduled.filter((i) => !i.date)).toEqual([]);
    expect(findProblems(c, scheduled)).toEqual([]);
  });
});
