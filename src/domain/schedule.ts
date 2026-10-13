import { addDays, eachDay } from './dates';
import { isUnavailable } from './rules';
import type { Child, Item } from './types';

export interface Schedule {
  /** New dates for previously unplanned items. */
  assignments: { id: string; date: string }[];
  /** Ids of items that could not be fitted in before the final date. */
  unplaced: string[];
}

/** Round-robin across subjects, keeping the original order within each subject. */
function interleave(items: Item[]): Item[] {
  const groups = new Map<string, Item[]>();
  for (const item of items) groups.set(item.subject, [...(groups.get(item.subject) ?? []), item]);
  const queues = [...groups.values()];
  const result: Item[] = [];
  for (let i = 0; queues.some((q) => i < q.length); i++) {
    for (const q of queues) {
      const item = q[i];
      if (item) result.push(item);
    }
  }
  return result;
}

/**
 * Spread a child's unplanned, incomplete items over the free days between
 * `from` and the final date. Sessions come first; each paper lands after the
 * last session of its subject. Never breaks a rule: what doesn't fit is
 * returned as `unplaced`.
 */
export function autoSchedule(child: Child, items: Item[], from: string): Schedule {
  const todo = items.filter((i) => !i.date && !i.completed);
  const sessions = interleave(todo.filter((i) => i.type === 'Session'));
  const papers = interleave(todo.filter((i) => i.type === 'Paper'));
  const queue = [...sessions, ...papers];
  if (!child.finalDate || child.finalDate < from) {
    return { assignments: [], unplaced: queue.map((i) => i.id) };
  }

  // One slot per unit of spare capacity on each available day.
  const used = new Map<string, number>();
  for (const item of items) if (item.date) used.set(item.date, (used.get(item.date) ?? 0) + 1);
  const slots: string[] = [];
  for (const day of eachDay(from, child.finalDate)) {
    if (isUnavailable(child, day)) continue;
    for (let n = used.get(day) ?? 0; n < child.maxPerDay; n++) slots.push(day);
  }

  // Pick evenly spaced slots, one per item, in order.
  const count = Math.min(queue.length, slots.length);
  const chosen = Array.from({ length: count }, (_, i) => Math.floor((i * slots.length) / count));
  const free = new Set(slots.keys());
  const assignments: Schedule['assignments'] = [];
  const unplaced: string[] = [];

  const sessionSlots = chosen.slice(0, sessions.length);
  sessions.forEach((session, i) => {
    const slot = sessionSlots[i];
    if (slot === undefined) return unplaced.push(session.id);
    free.delete(slot);
    assignments.push({ id: session.id, date: slots[slot] as string });
  });

  // The latest session date per subject, counting both existing and new dates.
  const lastSession = new Map<string, string>();
  const blocked = new Set<string>();
  const newDates = new Map(assignments.map((a) => [a.id, a.date]));
  for (const item of items) {
    if (item.type !== 'Session') continue;
    const date = item.date ?? newDates.get(item.id);
    if (date) {
      if (date > (lastSession.get(item.subject) ?? '')) lastSession.set(item.subject, date);
    } else if (!item.completed) {
      blocked.add(item.subject);
    }
  }

  const paperSlots = chosen.slice(sessions.length);
  for (const paper of papers) {
    const earliest = addDays(lastSession.get(paper.subject) ?? addDays(from, -1), 1);
    const fits = (slot: number) => free.has(slot) && (slots[slot] as string) >= earliest;
    const slot = blocked.has(paper.subject)
      ? undefined
      : (paperSlots.find(fits) ?? [...free].find(fits));
    if (slot === undefined) {
      unplaced.push(paper.id);
      continue;
    }
    free.delete(slot);
    assignments.push({ id: paper.id, date: slots[slot] as string });
  }

  return { assignments, unplaced };
}
