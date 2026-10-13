import type { Cell } from '../storage/rows';
import type { Api } from './api';

const BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

/** A1-notation range on a named sheet, e.g. `'Alice'!A2:J`. */
export function range(sheet: string, cells: string): string {
  return `'${sheet.replace(/'/g, "''")}'!${cells}`;
}

export async function createSpreadsheet(
  api: Api,
  title: string,
  sheet: string,
  header: Cell[],
): Promise<string> {
  const created = await api<{ spreadsheetId: string }>(BASE, {
    method: 'POST',
    body: { properties: { title }, sheets: [{ properties: { title: sheet } }] },
  });
  await updateValues(api, created.spreadsheetId, [{ range: range(sheet, 'A1'), values: [header] }]);
  return created.spreadsheetId;
}

/** Sheet title → numeric sheet id. */
export async function getSheetIds(api: Api, id: string): Promise<Map<string, number>> {
  const meta = await api<{ sheets: { properties: { sheetId: number; title: string } }[] }>(
    `${BASE}/${id}`,
    { query: { fields: 'sheets.properties(sheetId,title)' } },
  );
  return new Map(meta.sheets.map((s) => [s.properties.title, s.properties.sheetId]));
}

/** Unformatted values for each range; dates entered by hand arrive as serial numbers. */
export async function getValues(api: Api, id: string, ranges: string[]): Promise<Cell[][][]> {
  if (ranges.length === 0) return [];
  const result = await api<{ valueRanges: { values?: Cell[][] }[] }>(
    `${BASE}/${id}/values:batchGet`,
    {
      query: {
        ranges,
        valueRenderOption: 'UNFORMATTED_VALUE',
        dateTimeRenderOption: 'SERIAL_NUMBER',
      },
    },
  );
  return result.valueRanges.map((r) => r.values ?? []);
}

export async function updateValues(
  api: Api,
  id: string,
  data: { range: string; values: Cell[][] }[],
): Promise<void> {
  if (data.length === 0) return;
  await api(`${BASE}/${id}/values:batchUpdate`, {
    method: 'POST',
    body: { valueInputOption: 'RAW', data },
  });
}

export async function appendValues(
  api: Api,
  id: string,
  target: string,
  values: Cell[][],
): Promise<void> {
  if (values.length === 0) return;
  await api(`${BASE}/${id}/values/${encodeURIComponent(target)}:append`, {
    method: 'POST',
    query: { valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS' },
    body: { values },
  });
}

export async function clearValues(api: Api, id: string, target: string): Promise<void> {
  await api(`${BASE}/${id}/values/${encodeURIComponent(target)}:clear`, { method: 'POST' });
}

type BatchRequest = Record<string, unknown>;

async function batchUpdate(
  api: Api,
  id: string,
  requests: BatchRequest[],
): Promise<{ replies: { addSheet?: { properties: { sheetId: number } } }[] }> {
  return api(`${BASE}/${id}:batchUpdate`, { method: 'POST', body: { requests } });
}

export async function addSheet(
  api: Api,
  id: string,
  title: string,
  header: Cell[],
): Promise<number> {
  const result = await batchUpdate(api, id, [
    { addSheet: { properties: { title, gridProperties: { frozenRowCount: 1 } } } },
  ]);
  await updateValues(api, id, [{ range: range(title, 'A1'), values: [header] }]);
  return result.replies[0]?.addSheet?.properties.sheetId ?? 0;
}

export async function renameSheet(
  api: Api,
  id: string,
  sheetId: number,
  title: string,
): Promise<void> {
  await batchUpdate(api, id, [
    { updateSheetProperties: { properties: { sheetId, title }, fields: 'title' } },
  ]);
}

export async function deleteSheet(api: Api, id: string, sheetId: number): Promise<void> {
  await batchUpdate(api, id, [{ deleteSheet: { sheetId } }]);
}

/** Delete whole rows, given 1-based row numbers. */
export async function deleteRows(
  api: Api,
  id: string,
  sheetId: number,
  rows: number[],
): Promise<void> {
  if (rows.length === 0) return;
  // Bottom-up, so earlier deletions don't shift the rows still to go.
  const requests = [...rows]
    .sort((a, b) => b - a)
    .map((row) => ({
      deleteDimension: {
        range: { sheetId, dimension: 'ROWS', startIndex: row - 1, endIndex: row },
      },
    }));
  await batchUpdate(api, id, requests);
}
