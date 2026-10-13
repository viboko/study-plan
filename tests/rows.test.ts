import { describe, expect, it } from 'vitest';
import { childNameError, childToRow, itemToRow, rowToChild, rowToItem } from '../src/storage/rows';
import { child, item, paper } from './fixtures';

describe('rows', () => {
  it('round-trips sessions and papers', () => {
    for (const original of [item({ date: '2026-10-14', completed: true }), paper()]) {
      const { item: parsed, calendarEventId } = rowToItem(itemToRow(original, 'ev1'), 'Alice');
      expect(parsed).toEqual(original);
      expect(calendarEventId).toBe('ev1');
    }
  });

  it('round-trips a child', () => {
    const original = child({
      unavailableWeekdays: [0, 6],
      unavailableDates: [{ from: '2026-12-24', to: '2026-12-31' }],
    });
    expect(childToRow(original, 'cal')).toEqual([
      'Alice',
      '2026-10-31',
      1,
      'Mon, Sun',
      '2026-12-24..2026-12-31',
      'cal',
    ]);
    expect(rowToChild(childToRow(original, 'cal'))).toEqual({ child: original, calendarId: 'cal' });
  });

  it('tolerates hand-typed and missing cells', () => {
    expect(rowToItem(['x1', 'paper', ' Book ', 'verbal reasoning'], 'Alice').item).toMatchObject({
      type: 'Paper',
      book: 'Book',
      subject: 'Verbal Reasoning',
      minutes: null,
      date: null,
      completed: false,
    });
    expect(rowToItem(['x', '', '', 'Science', '', '', '', 'soon', 'Yes'], 'A').item).toMatchObject({
      type: 'Session',
      subject: 'Science',
      date: null,
      completed: true,
    });
    expect(rowToChild(['Ben', '', '', 'tuesday; Sat', 'rubbish, 2026-11-05']).child).toEqual({
      name: 'Ben',
      finalDate: null,
      maxPerDay: 1,
      unavailableWeekdays: [1, 5],
      unavailableDates: [{ from: '2026-11-05', to: '2026-11-05' }],
    });
  });

  it('rejects names that cannot be sheet names', () => {
    expect(childNameError('Ben', ['Alice'])).toBeNull();
    expect(childNameError('  ', [])).toBeTruthy();
    expect(childNameError('alice', ['Alice'])).toBeTruthy();
    expect(childNameError('children', [])).toBeTruthy();
    expect(childNameError('A/B', [])).toBeTruthy();
  });
});
