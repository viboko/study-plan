import type { Api } from './api';

const BASE = 'https://www.googleapis.com/calendar/v3';

/** The parts of a Calendar event this app reads and writes. */
export interface EventBody {
  summary: string;
  description: string;
  start: { date: string };
  end: { date: string };
  transparency: 'transparent';
  status: 'confirmed';
  extendedProperties: { private: { itemId: string } };
}

export interface CalendarEvent extends Partial<EventBody> {
  id: string;
}

function eventsUrl(calendarId: string, eventId?: string): string {
  const base = `${BASE}/calendars/${encodeURIComponent(calendarId)}/events`;
  return eventId ? `${base}/${encodeURIComponent(eventId)}` : base;
}

export async function createCalendar(api: Api, summary: string): Promise<string> {
  const calendar = await api<{ id: string }>(`${BASE}/calendars`, {
    method: 'POST',
    body: { summary },
  });
  return calendar.id;
}

export async function renameCalendar(api: Api, calendarId: string, summary: string): Promise<void> {
  await api(`${BASE}/calendars/${encodeURIComponent(calendarId)}`, {
    method: 'PATCH',
    body: { summary },
  });
}

export async function deleteCalendar(api: Api, calendarId: string): Promise<void> {
  await api(`${BASE}/calendars/${encodeURIComponent(calendarId)}`, { method: 'DELETE' });
}

export async function insertEvent(api: Api, calendarId: string, body: EventBody): Promise<string> {
  const event = await api<{ id: string }>(eventsUrl(calendarId), { method: 'POST', body });
  return event.id;
}

export async function patchEvent(
  api: Api,
  calendarId: string,
  eventId: string,
  body: EventBody,
): Promise<void> {
  await api(eventsUrl(calendarId, eventId), { method: 'PATCH', body });
}

export async function deleteEvent(api: Api, calendarId: string, eventId: string): Promise<void> {
  await api(eventsUrl(calendarId, eventId), { method: 'DELETE' });
}

export async function listEvents(api: Api, calendarId: string): Promise<CalendarEvent[]> {
  const events: CalendarEvent[] = [];
  let pageToken: string | undefined;
  do {
    const page = await api<{ items?: CalendarEvent[]; nextPageToken?: string }>(
      eventsUrl(calendarId),
      { query: { maxResults: '2500', ...(pageToken ? { pageToken } : {}) } },
    );
    events.push(...(page.items ?? []));
    pageToken = page.nextPageToken;
  } while (pageToken);
  return events;
}
