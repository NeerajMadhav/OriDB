/**
 * CSV serialization for server-side exports.
 */
import type { QueryColumn } from "../drivers/sqlTypes.js";

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s =
    typeof value === "object" ? JSON.stringify(value) : String(value);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function rowsToCsv(
  columns: QueryColumn[],
  rows: Record<string, unknown>[],
): string {
  const names = columns.map((c) => c.name);
  const header = names.map((n) => escapeCell(n)).join(",");
  const lines = rows.map((row) =>
    names.map((n) => escapeCell(row[n])).join(","),
  );
  return [header, ...lines].join("\r\n");
}
