import { formatDate, weekday, WEEKDAYS, addDays } from './dates';
import type { Child, DateRange, Item } from './types';

export interface Problem {
  kind: 'deadline' | 'unavailable' | 'load' | 'paper';
  message: string;
  itemIds: string[];
}

function inRange(range: DateRange, date: string): boolean {
  return range.from <= date && date <= range.to;
}

export function isUnavailableWeekday(child: Child, date: string): boolean {
  return child.unavailableWeekdays.includes(weekday(date));
}

export function isUnavailable(child: Child, date: string): boolean {
  return isUnavailableWeekday(child, date) || child.unavailableDates.some((r) => inRange(r, date));
}

/** Mark or unmark one specific date as unavailable, splitting ranges as needed. */
export function toggleUnavailableDate(child: Child, date: string): Child {
  const covering = child.unavailableDates.filter((r) => inRange(r, date));
  if (covering.length === 0) {
    const unavailableDates = [...child.unavailableDates, { from: date, to: date }].sort((a, b) =>
      a.from.localeCompare(b.from),
    );
    return { ...child, unavailableDates };
  }
  const unavailableDates = child.unavailableDates.flatMap((r) => {
    if (!inRange(r, date)) return [r];
    const parts: DateRange[] = [];
    if (r.from < date) parts.push({ from: r.from, to: addDays(date, -1) });
    if (r.to > date) parts.push({ from: addDays(date, 1), to: r.to });
    return parts;
  });
  return { ...child, unavailableDates };
}

function sessionsFor(items: Item[], paper: Item): Item[] {
  return items.filter((i) => i.type === 'Session' && i.subject === paper.subject);
}

/** How many sessions of the paper's subject are still to be completed. */
export function incompleteSessions(items: Item[], paper: Item): number {
  return sessionsFor(items, paper).filter((i) => !i.completed).length;
}

function label(item: Item): string {
  return `${item.subject}: ${item.title}`;
}

/** Rule breaks in one child's plan. `items` must all belong to `child`. */
export function findProblems(child: Child, items: Item[]): Problem[] {
  const problems: Problem[] = [];
  const open = items.filter((i) => i.date && !i.completed);

  for (const item of open) {
    const date = item.date as string;
    if (child.finalDate && date > child.finalDate) {
      problems.push({
        kind: 'deadline',
        message: `${label(item)} (${formatDate(date)}) is after the final date`,
        itemIds: [item.id],
      });
    }
    if (isUnavailable(child, date)) {
      const why = isUnavailableWeekday(child, date)
        ? `${WEEKDAYS[weekday(date)]}s are unavailable`
        : 'that day is unavailable';
      problems.push({
        kind: 'unavailable',
        message: `${label(item)} is on ${formatDate(date)}, but ${why}`,
        itemIds: [item.id],
      });
    }
  }

  const byDay = new Map<string, Item[]>();
  for (const item of items) {
    if (item.date) byDay.set(item.date, [...(byDay.get(item.date) ?? []), item]);
  }
  for (const [date, dayItems] of [...byDay].sort(([a], [b]) => a.localeCompare(b))) {
    if (dayItems.length > child.maxPerDay && dayItems.some((i) => !i.completed)) {
      problems.push({
        kind: 'load',
        message: `${dayItems.length} items on ${formatDate(date)} (max ${child.maxPerDay} per day)`,
        itemIds: dayItems.map((i) => i.id),
      });
    }
  }

  for (const paper of open.filter((i) => i.type === 'Paper')) {
    const sessions = sessionsFor(items, paper);
    const unplanned = sessions.filter((s) => !s.date && !s.completed).length;
    const lastSession = sessions
      .map((s) => s.date)
      .filter((d): d is string => d !== null)
      .sort()
      .at(-1);
    if (unplanned > 0) {
      problems.push({
        kind: 'paper',
        message: `${label(paper)} is planned, but ${unplanned} ${paper.subject} session${unplanned === 1 ? ' is' : 's are'} not planned yet`,
        itemIds: [paper.id],
      });
    } else if (lastSession && (paper.date as string) <= lastSession) {
      problems.push({
        kind: 'paper',
        message: `${label(paper)} (${formatDate(paper.date as string)}) is not after the last ${paper.subject} session (${formatDate(lastSession)})`,
        itemIds: [paper.id],
      });
    }
  }

  return problems;
}
