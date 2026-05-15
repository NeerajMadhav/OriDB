/**
 * In-memory JSON file store with debounced async writes (reduces sync I/O under load).
 */
import fs from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { ensureDir, getOriDbHome } from "../paths/oridbHome.js";

type CacheEntry<T> = {
  data: T;
  dirty: boolean;
  flushTimer: ReturnType<typeof setTimeout> | null;
};

const caches = new Map<string, CacheEntry<unknown>>();
const FLUSH_MS = 400;

async function flush<T>(filePath: string, entry: CacheEntry<T>): Promise<void> {
  entry.flushTimer = null;
  if (!entry.dirty) return;
  entry.dirty = false;
  ensureDir(getOriDbHome());
  await fs.writeFile(filePath, JSON.stringify(entry.data, null, 0), "utf8");
}

function scheduleFlush<T>(filePath: string, entry: CacheEntry<T>): void {
  entry.dirty = true;
  if (entry.flushTimer) return;
  entry.flushTimer = setTimeout(() => {
    void flush(filePath, entry).catch((e) => {
      console.error("[oridb] json store flush failed:", e);
      entry.dirty = true;
    });
  }, FLUSH_MS);
}

export function loadJsonFile<T>(filePath: string, fallback: T): T {
  let entry = caches.get(filePath) as CacheEntry<T> | undefined;
  if (entry) return entry.data;

  let data = fallback;
  if (existsSync(filePath)) {
    try {
      data = JSON.parse(readFileSync(filePath, "utf8")) as T;
    } catch {
      data = fallback;
    }
  }
  entry = { data, dirty: false, flushTimer: null };
  caches.set(filePath, entry as CacheEntry<unknown>);
  return data;
}

export function saveJsonFile<T>(filePath: string, data: T): void {
  let entry = caches.get(filePath) as CacheEntry<T> | undefined;
  if (!entry) {
    entry = { data, dirty: false, flushTimer: null };
    caches.set(filePath, entry as CacheEntry<unknown>);
  } else {
    entry.data = data;
  }
  scheduleFlush(filePath, entry);
}

/** Flush all pending writes (tests / graceful shutdown). */
export async function flushAllJsonStores(): Promise<void> {
  const tasks: Promise<void>[] = [];
  for (const [path, raw] of caches) {
    const entry = raw as CacheEntry<unknown>;
    if (entry.flushTimer) {
      clearTimeout(entry.flushTimer);
      entry.flushTimer = null;
    }
    if (entry.dirty) tasks.push(flush(path, entry));
  }
  await Promise.all(tasks);
}
