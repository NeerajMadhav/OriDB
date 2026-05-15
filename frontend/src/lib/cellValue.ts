/**
 * Format cell values for grid preview and inspector (full text).
 */

export function cellValueType(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (Array.isArray(value)) return "array";
  if (value instanceof Date) return "datetime";
  if (typeof value === "object") return "object";
  return typeof value;
}

export function formatCellFull(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

export function formatCellPreview(value: unknown, maxLen = 120): string {
  if (value === null || value === undefined) return "";
  const full = formatCellFull(value);
  if (full.length <= maxLen) return full;
  return `${full.slice(0, maxLen)}…`;
}

export async function copyText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}
