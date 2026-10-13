import { addDays } from '../domain/dates';
import type { Item } from '../domain/types';
import type { CalendarEvent, EventBody } from './calendar';

export function calendarName(child: string): string {
  return `Study Plan – ${child}`;
}

/** The all-day event for a dated item. */
export function eventBody(item: Item & { date: string }): EventBody {
  const what = `${item.subject}: ${item.title}`;
  const summary =
    item.type === 'Paper' ? `Paper${item.minutes ? ` (${item.minutes} min)` : ''} — ${what}` : what;
  return {
    summary: item.completed ? `✓ ${summary}` : summary,
    description: [item.book, item.category].filter(Boolean).join('\n'),
    start: { date: item.date },
    end: { date: addDays(item.date, 1) },
    transparency: 'transparent',
    status: 'confirmed',
    extendedProperties: { private: { itemId: item.id } },
  };
}

export function isDated(item: Item): item is Item & { date: string } {
  return item.date !== null;
}

export interface EventDiff {
  insert: (Item & { date: string })[];
  patch: { eventId: string; item: Item & { date: string } }[];
  /** Event ids with no matching dated item, including duplicates. */
  remove: string[];
  /** Item id → event id for events that are already correct. */
  keep: Map<string, string>;
}

/** What it takes to make one child's calendar match their dated items. */
export function diffEvents(items: Item[], events: CalendarEvent[]): EventDiff {
  const diff: EventDiff = { insert: [], patch: [], remove: [], keep: new Map() };
  const byItem = new Map<string, CalendarEvent>();
  for (const event of events) {
    const itemId = event.extendedProperties?.private.itemId;
    if (itemId && !byItem.has(itemId)) byItem.set(itemId, event);
    else diff.remove.push(event.id);
  }
  for (const item of items.filter(isDated)) {
    const event = byItem.get(item.id);
    byItem.delete(item.id);
    if (!event) {
      diff.insert.push(item);
      continue;
    }
    const want = eventBody(item);
    const same =
      event.summary === want.summary &&
      (event.description ?? '') === want.description &&
      event.start?.date === want.start.date &&
      event.end?.date === want.end.date;
    if (same) diff.keep.set(item.id, event.id);
    else diff.patch.push({ eventId: event.id, item });
  }
  diff.remove.push(...[...byItem.values()].map((e) => e.id));
  return diff;
}
