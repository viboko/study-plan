// A small in-memory stand-in for the Sheets, Drive and Calendar REST APIs,
// covering just the calls the app makes.

import { ApiError, type Api, type Request } from '../src/google/api';
import type { CalendarEvent } from '../src/google/calendar';
import type { Cell } from '../src/storage/rows';

interface Range {
  sheet: string;
  col: number;
  row: number;
  endCol: number | null;
  endRow: number | null;
}

function parseRange(a1: string): Range {
  const match = /^'(.*)'!([A-Z])(\d*)(?::([A-Z])(\d*))?$/.exec(a1);
  if (!match) throw new Error(`Unsupported range ${a1}`);
  const [, sheet = '', col = 'A', row, endCol, endRow] = match;
  const index = (letter: string) => letter.charCodeAt(0) - 65;
  return {
    sheet,
    col: index(col),
    row: row ? Number(row) - 1 : 0,
    endCol: endCol ? index(endCol) : null,
    endRow: endRow ? Number(endRow) - 1 : null,
  };
}

export class FakeGoogle {
  spreadsheetId: string | null = null;
  sheets = new Map<string, { id: number; rows: Cell[][] }>();
  calendars = new Map<string, { summary: string; events: Map<string, CalendarEvent> }>();
  calls: string[] = [];
  /** Set to make every call fail with this error. */
  failWith: Error | null = null;
  private nextId = 1;

  rows(sheet: string): Cell[][] {
    return this.sheets.get(sheet)?.rows ?? [];
  }

  events(summary: string): CalendarEvent[] {
    const calendar = [...this.calendars.values()].find((c) => c.summary === summary);
    return [...(calendar?.events.values() ?? [])];
  }

  private sheet(name: string): { id: number; rows: Cell[][] } {
    const sheet = this.sheets.get(name);
    if (!sheet) throw new ApiError(400, `Unable to parse range: ${name}`);
    return sheet;
  }

  private write(a1: string, values: Cell[][]): void {
    const range = parseRange(a1);
    const { rows } = this.sheet(range.sheet);
    values.forEach((value, i) => {
      const target = (rows[range.row + i] ??= []);
      value.forEach((cell, j) => (target[range.col + j] = cell));
    });
    for (let i = 0; i < rows.length; i++) rows[i] ??= [];
  }

  private read(a1: string): Cell[][] {
    const range = parseRange(a1);
    const rows = this.sheet(range.sheet)
      .rows.slice(range.row, range.endRow === null ? undefined : range.endRow + 1)
      .map((row) => row.slice(range.col, (range.endCol ?? range.col) + 1));
    // Like the real API, drop trailing empty rows.
    while (rows.length && rows.at(-1)?.every((c) => c === '' || c === undefined)) rows.pop();
    return rows;
  }

  api: Api = async <T>(url: string, request: Request = {}): Promise<T> => {
    const { method = 'GET', query = {}, body } = request;
    const path = decodeURIComponent(new URL(url).pathname);
    this.calls.push(`${method} ${path}`);
    if (this.failWith) throw this.failWith;
    return this.handle(method, path, query, body as Record<string, unknown>) as T;
  };

  private handle(
    method: string,
    path: string,
    query: Record<string, string | string[]>,
    body: Record<string, unknown>,
  ): unknown {
    let m: RegExpExecArray | null;
    if (path === '/drive/v3/files') {
      return { files: this.spreadsheetId ? [{ id: this.spreadsheetId }] : [] };
    }
    if (path === '/v4/spreadsheets' && method === 'POST') {
      this.spreadsheetId = 'sheet-1';
      const sheets = body['sheets'] as { properties: { title: string } }[];
      for (const s of sheets) this.sheets.set(s.properties.title, { id: this.nextId++, rows: [] });
      return { spreadsheetId: this.spreadsheetId };
    }
    if ((m = /^\/v4\/spreadsheets\/([^/:]+)(.*)$/.exec(path))) {
      if (m[1] !== this.spreadsheetId) throw new ApiError(404, 'Requested entity was not found.');
      return this.handleSheets(method, m[2] ?? '', query, body);
    }
    if (path === '/calendar/v3/calendars' && method === 'POST') {
      const id = `cal-${this.nextId++}`;
      this.calendars.set(id, { summary: body['summary'] as string, events: new Map() });
      return { id };
    }
    if ((m = /^\/calendar\/v3\/calendars\/([^/]+)(?:\/events(?:\/(.+))?)?$/.exec(path))) {
      const calendar = this.calendars.get(m[1] ?? '');
      if (!calendar) throw new ApiError(404, 'Not Found');
      const isEvents = path.includes('/events');
      const eventId = m[2];
      if (!isEvents) {
        if (method === 'DELETE') this.calendars.delete(m[1] ?? '');
        else calendar.summary = body['summary'] as string;
        return undefined;
      }
      if (!eventId) {
        if (method === 'GET') return { items: [...calendar.events.values()] };
        const id = `ev-${this.nextId++}`;
        calendar.events.set(id, { ...(body as object), id });
        return { id };
      }
      const event = calendar.events.get(eventId);
      if (!event) throw new ApiError(404, 'Not Found');
      if (method === 'DELETE') calendar.events.delete(eventId);
      else calendar.events.set(eventId, { ...event, ...(body as object) });
      return undefined;
    }
    throw new Error(`Unhandled ${method} ${path}`);
  }

  private handleSheets(
    method: string,
    rest: string,
    query: Record<string, string | string[]>,
    body: Record<string, unknown>,
  ): unknown {
    let m: RegExpExecArray | null;
    if (rest === '' && method === 'GET') {
      return {
        sheets: [...this.sheets].map(([title, s]) => ({ properties: { sheetId: s.id, title } })),
      };
    }
    if (rest === '/values:batchGet') {
      return { valueRanges: [query['ranges']].flat().map((r) => ({ values: this.read(r ?? '') })) };
    }
    if (rest === '/values:batchUpdate') {
      for (const d of body['data'] as { range: string; values: Cell[][] }[]) {
        this.write(d.range, d.values);
      }
      return {};
    }
    if ((m = /^\/values\/(.+):append$/.exec(rest))) {
      const { sheet } = parseRange(m[1] ?? '');
      this.sheet(sheet).rows.push(...(body['values'] as Cell[][]));
      return {};
    }
    if ((m = /^\/values\/(.+):clear$/.exec(rest))) {
      const range = parseRange(m[1] ?? '');
      this.sheet(range.sheet).rows.splice(range.row);
      return {};
    }
    if (rest === ':batchUpdate') {
      const replies: unknown[] = [];
      type Req = {
        addSheet?: { properties: { title: string } };
        updateSheetProperties?: { properties: { sheetId: number; title: string } };
        deleteSheet?: { sheetId: number };
        deleteDimension?: { range: { sheetId: number; startIndex: number; endIndex: number } };
      };
      const find = (id: number) => [...this.sheets].find(([, s]) => s.id === id);
      for (const r of body['requests'] as Req[]) {
        if (r.addSheet) {
          const id = this.nextId++;
          this.sheets.set(r.addSheet.properties.title, { id, rows: [] });
          replies.push({ addSheet: { properties: { sheetId: id } } });
        } else if (r.updateSheetProperties) {
          const { sheetId, title } = r.updateSheetProperties.properties;
          const found = find(sheetId);
          if (found) {
            this.sheets.delete(found[0]);
            this.sheets.set(title, found[1]);
          }
        } else if (r.deleteSheet) {
          const found = find(r.deleteSheet.sheetId);
          if (found) this.sheets.delete(found[0]);
        } else if (r.deleteDimension) {
          const { sheetId, startIndex, endIndex } = r.deleteDimension.range;
          find(sheetId)?.[1].rows.splice(startIndex, endIndex - startIndex);
        }
      }
      return { replies };
    }
    throw new Error(`Unhandled ${method} sheets${rest}`);
  }
}

export function memoryStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
    removeItem: (key) => void values.delete(key),
  };
}
