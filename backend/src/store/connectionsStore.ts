/**
 * Persists saved connections in ~/.oridb/connections.enc (AES-GCM JSON).
 */
import fs from "node:fs";
import { encryptJson, decryptJson } from "../crypto/vault.js";
import { ensureDir, getOriDbHome, oridbFile } from "../paths/oridbHome.js";
import type { ConnectionConfig } from "../types/connection.js";

const FILE = () => oridbFile("connections.enc");

export function loadConnections(): ConnectionConfig[] {
  const p = FILE();
  if (!fs.existsSync(p)) return [];
  const raw = fs.readFileSync(p, "utf8").trim();
  if (!raw) return [];
  try {
    return decryptJson<ConnectionConfig[]>(raw);
  } catch {
    return [];
  }
}

export function saveConnections(list: ConnectionConfig[]): void {
  ensureDir(getOriDbHome());
  fs.writeFileSync(FILE(), encryptJson(list), "utf8");
}
