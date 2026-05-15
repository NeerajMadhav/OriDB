/**
 * Resolve and validate local SQLite database file paths.
 */
import fs from "node:fs";
import path from "node:path";
import { getOriDbHome } from "../paths/oridbHome.js";

const SQLITE_EXT = /\.(db|sqlite|sqlite3|db3)$/i;

/** Trim user paste; strip wrapping quotes from Explorer copy-paste. */
export function normalizePathInput(input: string): string {
  let raw = input.trim();
  if (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    raw = raw.slice(1, -1).trim();
  }
  return raw;
}

export function isSqliteFilePath(input: string): boolean {
  const base = path.basename(normalizePathInput(input));
  return SQLITE_EXT.test(base);
}

/** Compare resolved paths (case-insensitive on Windows). */
export function sqlitePathsEqual(a: string, b: string): boolean {
  const na = path.normalize(a);
  const nb = path.normalize(b);
  if (process.platform === "win32") {
    return na.toLowerCase() === nb.toLowerCase();
  }
  return na === nb;
}

export function sqliteDatabasesDir(): string {
  return path.join(getOriDbHome(), "databases");
}

/** Turn user input, file:// URL, or relative path into an absolute normalized path. */
export function resolveSqlitePath(input: string): string {
  let raw = normalizePathInput(input);
  if (/^file:\/\//i.test(raw)) {
    try {
      const u = new URL(raw);
      if (process.platform === "win32" && /^\/[a-zA-Z]:/.test(u.pathname)) {
        raw = u.pathname.slice(1);
      } else {
        raw = decodeURIComponent(u.pathname);
        if (raw.startsWith("/") && /^\/[a-zA-Z]:/.test(raw)) {
          raw = raw.slice(1);
        }
      }
    } catch {
      raw = raw.replace(/^file:\/\//i, "");
    }
  }

  if (/^[a-zA-Z]:[\\/]/.test(raw)) {
    return path.normalize(raw);
  }

  if (path.isAbsolute(raw)) {
    return path.normalize(raw);
  }

  const candidates = [
    path.resolve(process.cwd(), raw),
    path.resolve(getOriDbHome(), raw),
    path.resolve(sqliteDatabasesDir(), raw),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return path.normalize(c);
  }
  return path.normalize(path.resolve(process.cwd(), raw));
}

export function suggestSqliteName(filePath: string): string {
  const base = path.basename(filePath, path.extname(filePath));
  const cleaned = base.replace(/[^\w.-]+/g, "_").slice(0, 48);
  return cleaned || "SQLite";
}

export function parseBareSqlitePath(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.includes("://")) return null;
  if (!isSqliteFilePath(trimmed)) return null;
  return trimmed;
}
