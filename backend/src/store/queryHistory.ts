/**
 * Query history under ~/.oridb/query-history.json (debounced writes).
 */
import { ensureDir, getOriDbHome, oridbFile } from "../paths/oridbHome.js";
import { loadJsonFile, saveJsonFile } from "../util/jsonFileStore.js";

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
const MAX = 500;

export function loadHistory(): HistoryEntry[] {
  return loadJsonFile<HistoryEntry[]>(file(), []);
}

export function appendHistory(entry: HistoryEntry): void {
  ensureDir(getOriDbHome());
  const list = loadHistory();
  list.unshift(entry);
  saveJsonFile(file(), list.slice(0, MAX));
}

export function clearHistory(): void {
  ensureDir(getOriDbHome());
  saveJsonFile(file(), []);
}
