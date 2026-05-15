/**
 * Append-only query history stored under ~/.oridb/query-history.json (plaintext for MVP).
 */
import fs from "node:fs";
import { ensureDir, getOriDbHome, oridbFile } from "../paths/oridbHome.js";

export type HistoryEntry = {
  id: string;
  at: string;
  connectionId: string;
  sql: string;
  durationMs: number;
  ok: boolean;
  error?: string;
};

const file = () => oridbFile("query-history.json");

export function loadHistory(): HistoryEntry[] {
  const p = file();
  if (!fs.existsSync(p)) return [];
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as HistoryEntry[];
  } catch {
    return [];
  }
}

export function appendHistory(entry: HistoryEntry): void {
  ensureDir(getOriDbHome());
  const list = loadHistory();
  list.unshift(entry);
  fs.writeFileSync(file(), JSON.stringify(list.slice(0, 500), null, 0), "utf8");
}

export function clearHistory(): void {
  ensureDir(getOriDbHome());
  fs.writeFileSync(file(), "[]", "utf8");
}
