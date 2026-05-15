/**
 * Export tabular data to CSV, Excel (.xlsx), or JSON — client-side download.
 */

export type ExportColumn = { name: string };

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function escapeCsvCell(value: unknown): string {
  const s = cellText(value);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function buildCsv(
  columns: ExportColumn[],
  rows: Record<string, unknown>[],
): string {
  const names = columns.map((c) => c.name);
  const header = names.map((n) => escapeCsvCell(n)).join(",");
  const body = rows.map((row) =>
    names.map((n) => escapeCsvCell(row[n])).join(","),
  );
  return [header, ...body].join("\r\n");
}

export function buildJson(
  columns: ExportColumn[],
  rows: Record<string, unknown>[],
): string {
  const names = columns.map((c) => c.name);
  const data = rows.map((row) => {
    const o: Record<string, unknown> = {};
    for (const n of names) o[n] = row[n] ?? null;
    return o;
  });
  return JSON.stringify(data, null, 2);
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function downloadCsv(
  filename: string,
  columns: ExportColumn[],
  rows: Record<string, unknown>[],
): void {
  const csv = buildCsv(columns, rows);
  const blob = new Blob(["\uFEFF", csv], {
    type: "text/csv;charset=utf-8",
  });
  downloadBlob(filename.endsWith(".csv") ? filename : `${filename}.csv`, blob);
}

export function downloadJson(
  filename: string,
  columns: ExportColumn[],
  rows: Record<string, unknown>[],
): void {
  const json = buildJson(columns, rows);
  downloadBlob(
    filename.endsWith(".json") ? filename : `${filename}.json`,
    new Blob([json], { type: "application/json;charset=utf-8" }),
  );
}

export async function downloadExcel(
  filename: string,
  columns: ExportColumn[],
  rows: Record<string, unknown>[],
): Promise<void> {
  const XLSX = await import("xlsx");
  const names = columns.map((c) => c.name);
  const data = rows.map((row) => {
    const o: Record<string, unknown> = {};
    for (const n of names) {
      const v = row[n];
      o[n] =
        v === null || v === undefined
          ? ""
          : typeof v === "object"
            ? JSON.stringify(v)
            : v;
    }
    return o;
  });
  const sheet = XLSX.utils.json_to_sheet(data, { header: names });
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Sheet1");
  XLSX.writeFile(
    book,
    filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`,
  );
}

export function defaultExportBasename(prefix = "oridb-export"): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${prefix}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}
