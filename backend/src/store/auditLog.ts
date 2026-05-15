/**
 * Local audit log for queries and auth events (web mode).
 */
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { ensureDir, getOriDbHome, oridbFile } from "../paths/oridbHome.js";

export type AuditEntry = {
  id: string;
  at: string;
  user?: string;
  connectionId?: string;
  action: string;
  sql?: string;
  rowsAffected?: number;
  durationMs?: number;
  ip?: string;
};

const file = () => oridbFile("audit-log.json");
const MAX = 5000;

function load(): AuditEntry[] {
  if (!fs.existsSync(file())) return [];
  try {
    return JSON.parse(fs.readFileSync(file(), "utf8")) as AuditEntry[];
  } catch {
    return [];
  }
}

function save(entries: AuditEntry[]): void {
  ensureDir(getOriDbHome());
  fs.writeFileSync(file(), JSON.stringify(entries.slice(0, MAX), null, 0), "utf8");
}

export function appendAudit(
  partial: Omit<AuditEntry, "id" | "at"> & { at?: string },
): void {
  if ((process.env.ORIDB_MODE ?? "local") !== "web") return;
  const entries = load();
  entries.unshift({
    id: randomUUID(),
    at: partial.at ?? new Date().toISOString(),
    ...partial,
  });
  save(entries);
}

export function listAudit(opts?: {
  user?: string;
  connectionId?: string;
  action?: string;
  q?: string;
  limit?: number;
}): AuditEntry[] {
  let entries = load();
  if (opts?.user) entries = entries.filter((e) => e.user === opts.user);
  if (opts?.connectionId)
    entries = entries.filter((e) => e.connectionId === opts.connectionId);
  if (opts?.action) entries = entries.filter((e) => e.action === opts.action);
  if (opts?.q) {
    const q = opts.q.toLowerCase();
    entries = entries.filter((e) => e.sql?.toLowerCase().includes(q));
  }
  return entries.slice(0, opts?.limit ?? 500);
}

export function exportAuditCsv(): string {
  const rows = listAudit({ limit: MAX });
  const header = "timestamp,user,connection,action,sql,rows_affected,duration_ms,ip\n";
  const body = rows
    .map((e) =>
      [
        e.at,
        e.user ?? "",
        e.connectionId ?? "",
        e.action,
        `"${(e.sql ?? "").replaceAll('"', '""')}"`,
        e.rowsAffected ?? "",
        e.durationMs ?? "",
        e.ip ?? "",
      ].join(","),
    )
    .join("\n");
  return header + body;
}
