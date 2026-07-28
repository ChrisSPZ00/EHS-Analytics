/**
 * Minimal RFC 4180 CSV serialisation.
 *
 * Values are always quoted when they contain a delimiter, quote or newline, and embedded
 * quotes are doubled. A leading =, +, - or @ is prefixed with a tab so that spreadsheet
 * software treats it as text rather than a formula -- a description field that happens to
 * start with "=" should not execute when the client opens the export.
 */
export function toCsvValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (/^[=+\-@]/.test(text)) text = `\t${text}`;
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(toCsvValue).join(',')];
  for (const row of rows) lines.push(row.map(toCsvValue).join(','));
  // CRLF and a UTF-8 BOM so Excel opens accented characters correctly.
  return `﻿${lines.join('\r\n')}\r\n`;
}

export function csvResponse(filename: string, body: string): Response {
  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}

/** Client-side download of a string as a file, used by the import validation report. */
export function downloadTextFile(filename: string, body: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([body], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
