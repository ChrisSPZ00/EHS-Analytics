import Papa from 'papaparse';

export interface ParsedSheet {
  headers: string[];
  rows: Record<string, string>[];
  /** Rows beyond the cap, reported so a truncated import is never silent. */
  truncated: number;
}

/** Guards the browser against a runaway file; the client is told when it trips. */
export const MAX_IMPORT_ROWS = 20_000;

function normaliseHeaders(headers: string[]): string[] {
  const seen = new Map<string, number>();
  return headers.map((raw, index) => {
    const base = (raw ?? '').trim() || `Column ${index + 1}`;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    // Duplicate headers are common in exported spreadsheets; keep both, distinctly.
    return count === 0 ? base : `${base} (${count + 1})`;
  });
}

export async function parseCsv(file: File): Promise<ParsedSheet> {
  const text = await file.text();
  const result = Papa.parse<string[]>(text, { skipEmptyLines: 'greedy' });

  if (!result.data.length) return { headers: [], rows: [], truncated: 0 };

  const headers = normaliseHeaders(result.data[0] as string[]);
  const body = result.data.slice(1);
  const truncated = Math.max(0, body.length - MAX_IMPORT_ROWS);

  const rows = body.slice(0, MAX_IMPORT_ROWS).map((cells) => {
    const row: Record<string, string> = {};
    headers.forEach((header, i) => {
      row[header] = (cells[i] ?? '').toString().trim();
    });
    return row;
  });

  return { headers, rows, truncated };
}

export async function parseXlsx(file: File): Promise<ParsedSheet> {
  // Loaded lazily: exceljs is large and only the import route needs it.
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());

  const sheet = workbook.worksheets[0];
  if (!sheet) return { headers: [], rows: [], truncated: 0 };

  const cellText = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    if (typeof value === 'object') {
      const v = value as { text?: string; result?: unknown; richText?: { text: string }[] };
      if (typeof v.text === 'string') return v.text.trim();
      if (v.richText) return v.richText.map((r) => r.text).join('').trim();
      if (v.result !== undefined) return String(v.result).trim();
      return '';
    }
    return String(value).trim();
  };

  const rawHeaders: string[] = [];
  sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
    rawHeaders[col - 1] = cellText(cell.value);
  });
  const headers = normaliseHeaders(rawHeaders);

  const rows: Record<string, string>[] = [];
  let truncated = 0;

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    if (rows.length >= MAX_IMPORT_ROWS) {
      truncated += 1;
      return;
    }
    const record: Record<string, string> = {};
    headers.forEach((header, i) => {
      record[header] = cellText(row.getCell(i + 1).value);
    });
    // Skip rows that are entirely blank.
    if (Object.values(record).some((v) => v !== '')) rows.push(record);
  });

  return { headers, rows, truncated };
}

export async function parseSpreadsheet(file: File): Promise<ParsedSheet> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.xlsx') || name.endsWith('.xlsm')) return parseXlsx(file);
  return parseCsv(file);
}
