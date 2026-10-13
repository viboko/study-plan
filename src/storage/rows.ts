// Mapping between spreadsheet rows and domain objects. Cells arrive as
// unformatted values: strings, numbers (including date serials) or booleans.

import { fromSerial, isISODate, WEEKDAYS } from '../domain/dates';
import { SUBJECTS, type Child, type DateRange, type Item } from '../domain/types';

export type Cell = string | number | boolean;

export const CHILDREN_SHEET = 'Children';

export const CHILD_HEADER = [
  'Name',
  'FinalDate',
  'MaxPerDay',
  'UnavailableWeekdays',
  'UnavailableDates',
  'CalendarId',
];

export const ITEM_HEADER = [
  'ID',
  'Type',
  'Book',
  'Subject',
  'Category',
  'Title',
  'Minutes',
  'Date',
  'Completed',
  'CalendarEventId',
];

function text(cell: Cell | undefined): string {
  return cell === undefined ? '' : String(cell).trim();
}

function parseDate(cell: Cell | undefined): string | null {
  if (typeof cell === 'number') return fromSerial(cell);
  const value = text(cell);
  return isISODate(value) ? value : null;
}

function parseBool(cell: Cell | undefined): boolean {
  return cell === true || ['true', 'yes', 'y', '1', 'x'].includes(text(cell).toLowerCase());
}

function parseSubject(cell: Cell | undefined): string {
  const value = text(cell);
  return SUBJECTS.find((s) => s.toLowerCase() === value.toLowerCase()) ?? value;
}

export function itemToRow(item: Item, calendarEventId: string): Cell[] {
  return [
    item.id,
    item.type,
    item.book,
    item.subject,
    item.category,
    item.title,
    item.minutes ?? '',
    item.date ?? '',
    item.completed ? 'TRUE' : 'FALSE',
    calendarEventId,
  ];
}

export function rowToItem(row: Cell[], child: string): { item: Item; calendarEventId: string } {
  const minutes = Number(row[6]);
  return {
    item: {
      id: text(row[0]),
      child,
      type: text(row[1]).toLowerCase() === 'paper' ? 'Paper' : 'Session',
      book: text(row[2]),
      subject: parseSubject(row[3]),
      category: text(row[4]),
      title: text(row[5]),
      minutes: text(row[6]) !== '' && Number.isFinite(minutes) ? minutes : null,
      date: parseDate(row[7]),
      completed: parseBool(row[8]),
    },
    calendarEventId: text(row[9]),
  };
}

export function isBlankRow(row: Cell[]): boolean {
  return row.every((cell) => text(cell) === '');
}

function formatRanges(ranges: DateRange[]): string {
  return ranges.map((r) => (r.from === r.to ? r.from : `${r.from}..${r.to}`)).join('; ');
}

function parseRanges(value: string): DateRange[] {
  return value
    .split(/[;,]/)
    .map((part) => part.trim().split('..'))
    .map(([from = '', to = from]) => ({ from: from.trim(), to: to.trim() }))
    .filter((r) => isISODate(r.from) && isISODate(r.to) && r.from <= r.to);
}

export function childToRow(child: Child, calendarId: string): Cell[] {
  return [
    child.name,
    child.finalDate ?? '',
    child.maxPerDay,
    child.unavailableWeekdays.map((d) => WEEKDAYS[d]).join(', '),
    formatRanges(child.unavailableDates),
    calendarId,
  ];
}

export function rowToChild(row: Cell[]): { child: Child; calendarId: string } {
  const maxPerDay = Math.floor(Number(row[2]));
  const weekdays = text(row[3])
    .split(/[;,\s]+/)
    .map((name) => WEEKDAYS.findIndex((d) => d.toLowerCase() === name.slice(0, 3).toLowerCase()))
    .filter((d) => d >= 0);
  return {
    child: {
      name: text(row[0]),
      finalDate: parseDate(row[1]),
      maxPerDay: maxPerDay >= 1 ? maxPerDay : 1,
      unavailableWeekdays: [...new Set(weekdays)].sort(),
      unavailableDates: parseRanges(text(row[4])),
    },
    calendarId: text(row[5]),
  };
}

/** Why a child name can't be used as a sheet name, or null if it is fine. */
export function childNameError(name: string, existing: string[]): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'Enter a name';
  if (trimmed.length > 50) return 'Name is too long';
  if (/[[\]*?/\\:']/.test(trimmed)) return "Name can't contain [ ] * ? / \\ : or '";
  if (trimmed.toLowerCase() === CHILDREN_SHEET.toLowerCase()) return `"${trimmed}" is reserved`;
  if (existing.some((n) => n.toLowerCase() === trimmed.toLowerCase())) {
    return `There is already a child called ${trimmed}`;
  }
  return null;
}
