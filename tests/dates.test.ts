import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  daysBetween,
  eachDay,
  formatDate,
  fromSerial,
  isISODate,
  monthGrid,
  weekday,
} from '../src/domain/dates';

describe('dates', () => {
  it('adds days across month, year and daylight-saving boundaries', () => {
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(daysBetween('2026-10-13', '2026-11-13')).toBe(31);
  });

  it('numbers weekdays from Monday', () => {
    expect(weekday('2026-10-12')).toBe(0);
    expect(weekday('2026-10-18')).toBe(6);
  });

  it('lists days inclusively', () => {
    expect(eachDay('2026-10-30', '2026-11-01')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01']);
    expect(eachDay('2026-10-02', '2026-10-01')).toEqual([]);
  });

  it('builds whole Monday-first weeks for a month', () => {
    const weeks = monthGrid('2026-10');
    expect(weeks).toHaveLength(5);
    expect(weeks[0]?.[0]).toBe('2026-09-28');
    expect(weeks.at(-1)?.at(-1)).toBe('2026-11-01');
    expect(addMonths('2026-12', 1)).toBe('2027-01');
  });

  it('validates, formats and converts sheet serials', () => {
    expect(isISODate('2026-10-13')).toBe(true);
    expect(isISODate('13/10/2026')).toBe(false);
    expect(isISODate('2026-13-45')).toBe(false);
    expect(formatDate('2026-10-14')).toBe('Wed 14 Oct 2026');
    expect(fromSerial(46309)).toBe('2026-10-14');
  });
});
