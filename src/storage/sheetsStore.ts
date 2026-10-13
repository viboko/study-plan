import { isGone, type Api } from '../google/api';
import * as calendar from '../google/calendar';
import { calendarName, diffEvents, eventBody, isDated } from '../google/calendarSync';
import { findSpreadsheet } from '../google/drive';
import * as sheets from '../google/sheets';
import { applyOp, newId, type Child, type Item, type Op, type Plan } from '../domain/types';
import {
  CHILD_HEADER,
  CHILDREN_SHEET,
  ITEM_HEADER,
  childToRow,
  isBlankRow,
  itemToRow,
  rowToChild,
  rowToItem,
  type Cell,
} from './rows';
import { AuthError, type Store } from './Store';

export const SPREADSHEET_NAME = 'Study Plan';
const ID_KEY = 'studyPlan.spreadsheetId';
const LAST_COLUMN = 'J';

/** Run `task` over `values`, a few at a time. */
async function inBatches<T>(values: T[], task: (value: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < values.length; i += 5) {
    await Promise.all(values.slice(i, i + 5).map(task));
  }
}

function groupByChild(items: Item[]): Map<string, Item[]> {
  const groups = new Map<string, Item[]>();
  for (const item of items) groups.set(item.child, [...(groups.get(item.child) ?? []), item]);
  return groups;
}

/** Keeps the plan in a Google spreadsheet and mirrors dated items to Calendar. */
export class SheetsStore implements Store {
  private spreadsheetId: string | null = null;
  private sheetIds = new Map<string, number>();
  private children: Child[] = [];
  /** Child name → calendar id. */
  private calendarIds = new Map<string, string>();
  /** Item id → calendar event id. */
  private eventIds = new Map<string, string>();
  private warning: string | null = null;
  private creatingCalendars = new Map<string, Promise<string>>();

  constructor(
    private readonly api: Api,
    private readonly storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = localStorage,
  ) {}

  spreadsheetUrl(): string | null {
    return this.spreadsheetId
      ? `https://docs.google.com/spreadsheets/d/${this.spreadsheetId}/edit`
      : null;
  }

  calendarWarning(): string | null {
    return this.warning;
  }

  /** The id of the app's spreadsheet, finding or creating it on first use. */
  private async id(): Promise<string> {
    if (this.spreadsheetId) return this.spreadsheetId;
    const remembered = this.storage.getItem(ID_KEY);
    if (remembered) {
      try {
        this.sheetIds = await sheets.getSheetIds(this.api, remembered);
        return (this.spreadsheetId = remembered);
      } catch (e) {
        if (!isGone(e)) throw e;
        this.storage.removeItem(ID_KEY);
      }
    }
    const id =
      (await findSpreadsheet(this.api, SPREADSHEET_NAME)) ??
      (await sheets.createSpreadsheet(this.api, SPREADSHEET_NAME, CHILDREN_SHEET, CHILD_HEADER));
    this.storage.setItem(ID_KEY, id);
    return (this.spreadsheetId = id);
  }

  async load(): Promise<Plan> {
    const id = await this.id();
    this.sheetIds = await sheets.getSheetIds(this.api, id);
    if (!this.sheetIds.has(CHILDREN_SHEET)) {
      const sheetId = await sheets.addSheet(this.api, id, CHILDREN_SHEET, CHILD_HEADER);
      this.sheetIds.set(CHILDREN_SHEET, sheetId);
    }

    const titles = [...this.sheetIds.keys()];
    const values = await sheets.getValues(
      this.api,
      id,
      titles.map((title) => sheets.range(title, `A2:${LAST_COLUMN}`)),
    );
    const rowsOf = (title: string) => values[titles.indexOf(title)] ?? [];

    this.children = [];
    this.calendarIds = new Map();
    this.eventIds = new Map();
    for (const row of rowsOf(CHILDREN_SHEET)) {
      const { child, calendarId } = rowToChild(row);
      if (!child.name || this.children.some((c) => c.name === child.name)) continue;
      this.children.push(child);
      if (calendarId) this.calendarIds.set(child.name, calendarId);
    }

    const items: Item[] = [];
    const newIds: { range: string; values: Cell[][] }[] = [];
    for (const child of this.children) {
      await this.ensureSheet(child.name);
      rowsOf(child.name).forEach((row, index) => {
        if (isBlankRow(row)) return;
        const { item, calendarEventId } = rowToItem(row, child.name);
        if (!item.id || items.some((i) => i.id === item.id)) {
          // Added by hand (or copy-pasted): give the row its own id.
          item.id = newId();
          newIds.push({ range: sheets.range(child.name, `A${index + 2}`), values: [[item.id]] });
        } else if (calendarEventId) {
          this.eventIds.set(item.id, calendarEventId);
        }
        items.push(item);
      });
    }
    await sheets.updateValues(this.api, id, newIds);

    return { children: this.children, items };
  }

  async apply(op: Op): Promise<void> {
    this.warning = null;
    switch (op.kind) {
      case 'upsertItems':
        return this.upsertItems(op.items);
      case 'deleteItems':
        return this.deleteItems(op.items);
      case 'upsertChild':
        return this.upsertChild(op.child, op.previousName);
      case 'deleteChild':
        return this.deleteChild(op.name);
    }
  }

  private async ensureSheet(name: string): Promise<void> {
    if (this.sheetIds.has(name)) return;
    const sheetId = await sheets.addSheet(this.api, await this.id(), name, ITEM_HEADER);
    this.sheetIds.set(name, sheetId);
  }

  /** Item id → 1-based row number, read fresh so hand-sorting can't mislead us. */
  private async rowNumbers(child: string): Promise<Map<string, number>> {
    const [column = []] = await sheets.getValues(this.api, await this.id(), [
      sheets.range(child, 'A2:A'),
    ]);
    const rows = new Map<string, number>();
    column.forEach((row, index) => {
      const itemId = String(row[0] ?? '');
      if (itemId && !rows.has(itemId)) rows.set(itemId, index + 2);
    });
    return rows;
  }

  private async writeRows(child: string, items: Item[]): Promise<void> {
    const id = await this.id();
    await this.ensureSheet(child);
    const rows = await this.rowNumbers(child);
    const updates: { range: string; values: Cell[][] }[] = [];
    const appends: Cell[][] = [];
    for (const item of items) {
      const values = itemToRow(item, this.eventIds.get(item.id) ?? '');
      const row = rows.get(item.id);
      if (row) {
        updates.push({
          range: sheets.range(child, `A${row}:${LAST_COLUMN}${row}`),
          values: [values],
        });
      } else {
        appends.push(values);
      }
    }
    await sheets.updateValues(this.api, id, updates);
    await sheets.appendValues(this.api, id, sheets.range(child, `A:${LAST_COLUMN}`), appends);
  }

  private async upsertItems(items: Item[]): Promise<void> {
    await inBatches(items, (item) => this.syncEvent(item));
    for (const [child, childItems] of groupByChild(items)) {
      await this.writeRows(child, childItems);
    }
  }

  private async deleteItems(items: Item[]): Promise<void> {
    await inBatches(items, (item) => this.syncEvent({ ...item, date: null }));
    const id = await this.id();
    for (const [child, childItems] of groupByChild(items)) {
      const sheetId = this.sheetIds.get(child);
      if (sheetId === undefined) continue;
      const rows = await this.rowNumbers(child);
      const doomed = childItems.map((i) => rows.get(i.id)).filter((r) => r !== undefined);
      await sheets.deleteRows(this.api, id, sheetId, doomed);
    }
  }

  private async upsertChild(child: Child, previousName = child.name): Promise<void> {
    const id = await this.id();
    if (previousName !== child.name) {
      const sheetId = this.sheetIds.get(previousName);
      if (sheetId !== undefined) {
        await sheets.renameSheet(this.api, id, sheetId, child.name);
        this.sheetIds.delete(previousName);
        this.sheetIds.set(child.name, sheetId);
      }
      const calendarId = this.calendarIds.get(previousName);
      if (calendarId) {
        this.calendarIds.delete(previousName);
        this.calendarIds.set(child.name, calendarId);
        await this.calendarTask(() =>
          calendar.renameCalendar(this.api, calendarId, calendarName(child.name)),
        );
      }
    }
    await this.ensureSheet(child.name);
    this.children = applyOp(
      { children: this.children, items: [] },
      {
        kind: 'upsertChild',
        child,
        previousName,
      },
    ).children;
    await this.writeChildren();
  }

  private async deleteChild(name: string): Promise<void> {
    const id = await this.id();
    const sheetId = this.sheetIds.get(name);
    if (sheetId !== undefined) {
      await sheets.deleteSheet(this.api, id, sheetId);
      this.sheetIds.delete(name);
    }
    const calendarId = this.calendarIds.get(name);
    if (calendarId) {
      this.calendarIds.delete(name);
      await this.calendarTask(async () => {
        try {
          await calendar.deleteCalendar(this.api, calendarId);
        } catch (e) {
          if (!isGone(e)) throw e;
        }
      });
    }
    this.children = this.children.filter((c) => c.name !== name);
    await this.writeChildren();
  }

  private async writeChildren(): Promise<void> {
    const id = await this.id();
    const rows = this.children.map((c) => childToRow(c, this.calendarIds.get(c.name) ?? ''));
    await sheets.updateValues(this.api, id, [
      { range: sheets.range(CHILDREN_SHEET, 'A1'), values: [CHILD_HEADER, ...rows] },
    ]);
    await sheets.clearValues(this.api, id, sheets.range(CHILDREN_SHEET, `A${rows.length + 2}:F`));
  }

  /** Calendar trouble is reported as a warning; it never blocks saving to the sheet. */
  private async calendarTask(task: () => Promise<void>): Promise<void> {
    try {
      await task();
    } catch (e) {
      if (e instanceof AuthError) throw e;
      this.warning = `Calendar not updated: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  private ensureCalendar(child: string): Promise<string> {
    const existing = this.calendarIds.get(child);
    if (existing) return Promise.resolve(existing);
    // Shared between concurrent callers so only one calendar is ever created.
    let creating = this.creatingCalendars.get(child);
    if (!creating) {
      creating = (async () => {
        const calendarId = await calendar.createCalendar(this.api, calendarName(child));
        this.calendarIds.set(child, calendarId);
        await this.writeChildren();
        return calendarId;
      })().finally(() => this.creatingCalendars.delete(child));
      this.creatingCalendars.set(child, creating);
    }
    return creating;
  }

  /** Create, move or remove the item's all-day event to match its date. */
  private syncEvent(item: Item): Promise<void> {
    return this.calendarTask(async () => {
      const eventId = this.eventIds.get(item.id);
      if (!isDated(item)) {
        const calendarId = this.calendarIds.get(item.child);
        if (!eventId || !calendarId) return;
        try {
          await calendar.deleteEvent(this.api, calendarId, eventId);
        } catch (e) {
          if (!isGone(e)) throw e;
        }
        this.eventIds.delete(item.id);
        return;
      }
      const body = eventBody(item);
      if (eventId) {
        try {
          await calendar.patchEvent(this.api, await this.ensureCalendar(item.child), eventId, body);
          return;
        } catch (e) {
          if (!isGone(e)) throw e;
          this.eventIds.delete(item.id);
        }
      }
      let created: string;
      try {
        created = await calendar.insertEvent(this.api, await this.ensureCalendar(item.child), body);
      } catch (e) {
        if (!isGone(e)) throw e;
        // The calendar itself was deleted by hand: start a new one.
        this.calendarIds.delete(item.child);
        created = await calendar.insertEvent(this.api, await this.ensureCalendar(item.child), body);
      }
      this.eventIds.set(item.id, created);
    });
  }

  async resyncCalendar(): Promise<void> {
    const plan = await this.load();
    for (const [child, items] of groupByChild(plan.items)) {
      let calendarId = await this.ensureCalendar(child);
      let events: calendar.CalendarEvent[];
      try {
        events = await calendar.listEvents(this.api, calendarId);
      } catch (e) {
        if (!isGone(e)) throw e;
        this.calendarIds.delete(child);
        calendarId = await this.ensureCalendar(child);
        events = [];
      }
      const diff = diffEvents(items, events);
      for (const item of items) this.eventIds.delete(item.id);
      for (const [itemId, eventId] of diff.keep) this.eventIds.set(itemId, eventId);
      await inBatches(diff.remove, (eventId) =>
        calendar.deleteEvent(this.api, calendarId, eventId),
      );
      await inBatches(diff.patch, async ({ eventId, item }) => {
        await calendar.patchEvent(this.api, calendarId, eventId, eventBody(item));
        this.eventIds.set(item.id, eventId);
      });
      await inBatches(diff.insert, async (item) => {
        this.eventIds.set(
          item.id,
          await calendar.insertEvent(this.api, calendarId, eventBody(item)),
        );
      });
      await this.writeRows(child, items);
    }
  }
}
