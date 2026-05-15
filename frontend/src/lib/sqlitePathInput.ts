/**
 * Client-side checks for SQLite path text (browser file picker quirks on Windows).
 */

/** Browsers often expose C:\\fakepath\\file.db — not a real path for the server. */
export function isBrowserFakePath(input: string): boolean {
  return /fakepath/i.test(input.trim());
}

/** True if input looks like an absolute or relative file path, not just a filename. */
export function looksLikeServerPath(input: string): boolean {
  const t = input.trim();
  if (!t || isBrowserFakePath(t)) return false;
  if (/^[a-zA-Z]:[\\/]/.test(t)) return true;
  if (t.startsWith("\\\\")) return true;
  if (t.startsWith("./") || t.startsWith("../")) return true;
  if (t.startsWith("/") && t.length > 1) return true;
  if (t.includes("\\") || t.includes("/")) return true;
  return false;
}
