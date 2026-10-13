import type { Api } from './api';

/**
 * Find a spreadsheet this app created earlier. Under the `drive.file` scope
 * Drive only lists files the app itself made, so a name match is enough.
 */
export async function findSpreadsheet(api: Api, name: string): Promise<string | null> {
  const result = await api<{ files: { id: string }[] }>(
    'https://www.googleapis.com/drive/v3/files',
    {
      query: {
        q: `mimeType='application/vnd.google-apps.spreadsheet' and name='${name}' and trashed=false`,
        orderBy: 'createdTime',
        fields: 'files(id)',
      },
    },
  );
  return result.files[0]?.id ?? null;
}
