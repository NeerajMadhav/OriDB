/**
 * File-based migrations per connection with applied history.
 */
import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { ensureDir, getOriDbHome } from "../paths/oridbHome.js";
import { getHandle } from "../registry/connectionRegistry.js";
import { getConnectionOr404 } from "./connections.js";
import { HttpError } from "../http/HttpError.js";
import {
  dialectOf,
  listTables,
  listTablesSnowflake,
  sqliteListTables,
} from "../services/schemaService.js";

type HistoryEntry = {
  name: string;
  status: "applied" | "failed" | "rolled_back";
  appliedAt: string;
  durationMs: number;
};

function migDir(connId: string): string {
  const d = path.join(getOriDbHome(), "migrations", connId);
  ensureDir(d);
  return d;
}

function historyFile(connId: string): string {
  return path.join(migDir(connId), "_history.json");
}

function loadHistory(connId: string): HistoryEntry[] {
  const f = historyFile(connId);
  if (!fs.existsSync(f)) return [];
  try {
    return JSON.parse(fs.readFileSync(f, "utf8")) as HistoryEntry[];
  } catch {
    return [];
  }
}

function saveHistory(connId: string, entries: HistoryEntry[]): void {
  fs.writeFileSync(historyFile(connId), JSON.stringify(entries, null, 0), "utf8");
}

function appliedNames(connId: string): Set<string> {
  return new Set(
    loadHistory(connId)
      .filter((h) => h.status === "applied")
      .map((h) => h.name),
  );
}

export const migrationsRouter = Router({ mergeParams: true });

migrationsRouter.get("/:connId", (req, res) => {
  const dir = migDir(req.params.connId);
  const files = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((f) => f.endsWith(".sql"))
    : [];
  const applied = appliedNames(req.params.connId);
  const history = loadHistory(req.params.connId);
  res.json({
    migrations: files.map((name) => {
      const h = history.find((x) => x.name === name && x.status === "applied");
      return {
        name,
        status: applied.has(name) ? "applied" : "pending",
        appliedAt: h?.appliedAt,
      };
    }),
  });
});

migrationsRouter.post("/:connId", (req, res) => {
  const name = z.string().min(1).parse(req.body?.name);
  const up = z.string().default("").parse(req.body?.up);
  const down = z.string().default("").parse(req.body?.down);
  const dir = migDir(req.params.connId);
  const file = path.join(dir, name);
  fs.writeFileSync(file, `-- up\n${up}\n\n-- down\n${down}\n`, "utf8");
  res.status(201).json({ ok: true, name });
});

migrationsRouter.put("/:connId/:id", (req, res) => {
  const up = z.string().parse(req.body?.up);
  const down = z.string().default("").parse(req.body?.down);
  const file = path.join(migDir(req.params.connId), req.params.id);
  if (!fs.existsSync(file)) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Migration file" } });
    return;
  }
  fs.writeFileSync(file, `-- up\n${up}\n\n-- down\n${down}\n`, "utf8");
  res.json({ ok: true });
});

migrationsRouter.post("/:connId/:id/run", async (req, res, next) => {
  try {
    const cfg = getConnectionOr404(req.params.connId);
    if (!cfg) throw new HttpError(404, "Connection not found", "NOT_FOUND");
    const h = getHandle(req.params.connId);
    if (!h?.sql) throw new HttpError(400, "Not SQL", "NO_SQL");
    const file = path.join(migDir(req.params.connId), req.params.id);
    if (!fs.existsSync(file)) throw new HttpError(404, "Migration file", "NOT_FOUND");
    const raw = fs.readFileSync(file, "utf8");
    const up = raw.split(/--\s*down/i)[0]?.replace(/--\s*up/i, "") ?? raw;
    const started = Date.now();
    await h.sql.query(up);
    const history = loadHistory(req.params.connId).filter((x) => x.name !== req.params.id);
    history.unshift({
      name: req.params.id,
      status: "applied",
      appliedAt: new Date().toISOString(),
      durationMs: Date.now() - started,
    });
    saveHistory(req.params.connId, history);
    res.json({ ok: true, durationMs: Date.now() - started });
  } catch (e) {
    const history = loadHistory(req.params.connId);
    history.unshift({
      name: req.params.id,
      status: "failed",
      appliedAt: new Date().toISOString(),
      durationMs: 0,
    });
    saveHistory(req.params.connId, history);
    next(e);
  }
});

migrationsRouter.post("/:connId/:id/rollback", async (req, res, next) => {
  try {
    const cfg = getConnectionOr404(req.params.connId);
    if (!cfg) throw new HttpError(404, "Connection not found", "NOT_FOUND");
    const h = getHandle(req.params.connId);
    if (!h?.sql) throw new HttpError(400, "Not SQL", "NO_SQL");
    const file = path.join(migDir(req.params.connId), req.params.id);
    const raw = fs.readFileSync(file, "utf8");
    const parts = raw.split(/--\s*down/i);
    const down = parts[1] ?? "";
    const started = Date.now();
    await h.sql.query(down);
    const history = loadHistory(req.params.connId);
    history.unshift({
      name: req.params.id,
      status: "rolled_back",
      appliedAt: new Date().toISOString(),
      durationMs: Date.now() - started,
    });
    saveHistory(req.params.connId, history);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

migrationsRouter.get("/:connId/history", (req, res) => {
  res.json({ history: loadHistory(req.params.connId) });
});

migrationsRouter.delete("/:connId/lock", (_req, res) => {
  res.json({ ok: true, locked: false });
});

migrationsRouter.post("/:connId/diff", async (req, res, next) => {
  try {
    const cfg = getConnectionOr404(req.params.connId);
    if (!cfg) throw new HttpError(404, "Connection not found", "NOT_FOUND");
    const h = getHandle(req.params.connId);
    if (!h?.sql) throw new HttpError(400, "Not SQL", "NO_SQL");
    const schema = z.string().default("public").parse(req.body?.schema ?? "public");
    const snapshot = z.array(z.string()).parse(req.body?.snapshotTables ?? []);
    const d = dialectOf(cfg);
    const current =
      d === "sqlite"
        ? (await sqliteListTables(h.sql)).map((t) => t.name)
        : d === "snowflake"
          ? (
              await listTablesSnowflake(
                h.sql,
                cfg.database ?? "SNOWFLAKE",
                schema,
              )
            ).map((t) => t.name)
          : (await listTables(h.sql, d, schema)).map((t) => t.name);
    const added = current.filter((t) => !snapshot.includes(t));
    const removed = snapshot.filter((t) => !current.includes(t));
    res.json({ diff: { added, removed, tables: [...added, ...removed] } });
  } catch (e) {
    next(e);
  }
});
