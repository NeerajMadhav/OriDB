/**
 * Resolves OriDB local config directory (~/.oridb).
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export function getOriDbHome(): string {
  const base = process.env.ORIDB_HOME?.trim();
  if (base) return path.resolve(base);
  return path.join(os.homedir(), ".oridb");
}

export function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

export function oridbFile(name: string): string {
  return path.join(getOriDbHome(), name);
}
