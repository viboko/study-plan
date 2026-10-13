// All dates are ISO `YYYY-MM-DD` strings, manipulated in UTC so that no
// timezone or daylight-saving maths can shift a day.

const DAY_MS = 86_400_000;

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function toMs(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`);
}

function fromMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function isISODate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(toMs(value));
}

/** Today in the user's local timezone. */
export function today(): string {
  const d = new Date();
  return fromMs(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

export function addDays(iso: string, days: number): string {
  return fromMs(toMs(iso) + days * DAY_MS);
}

/** Whole days from `from` to `to` (negative if `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((toMs(to) - toMs(from)) / DAY_MS);
}

/** 0 = Monday … 6 = Sunday. */
export function weekday(iso: string): number {
  return (new Date(toMs(iso)).getUTCDay() + 6) % 7;
}

/** Every date from `from` to `to` inclusive. */
export function eachDay(from: string, to: string): string[] {
  const days: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  return days;
}

/** `YYYY-MM` of a date. */
export function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

export function addMonths(month: string, n: number): string {
  const [y = 0, m = 1] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
}

/** Whole weeks (Monday first) covering the given `YYYY-MM` month. */
export function monthGrid(month: string): string[][] {
  const first = `${month}-01`;
  const last = addDays(`${addMonths(month, 1)}-01`, -1);
  const start = addDays(first, -weekday(first));
  const end = addDays(last, 6 - weekday(last));
  const days = eachDay(start, end);
  const weeks: string[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return weeks;
}

export function formatMonth(month: string): string {
  const [y, m = 1] = month.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

/** e.g. `Wed 14 Oct 2026`. */
export function formatDate(iso: string): string {
  const [y, m = 1, d] = iso.split('-').map(Number);
  return `${WEEKDAYS[weekday(iso)]} ${d} ${MONTHS[m - 1]?.slice(0, 3)} ${y}`;
}

/** Google Sheets serial day number (days since 1899-12-30) to ISO. */
export function fromSerial(serial: number): string {
  return fromMs(Date.UTC(1899, 11, 30) + Math.floor(serial) * DAY_MS);
}
