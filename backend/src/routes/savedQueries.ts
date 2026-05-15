/**
 * Saved queries library (local JSON under ~/.oridb/saved-queries.json).
 */
import { Router } from "express";
import fs from "node:fs";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { ensureDir, getOriDbHome, oridbFile } from "../paths/oridbHome.js";
import { getHandle } from "../registry/connectionRegistry.js";
import { HttpError } from "../http/HttpError.js";

const queriesFile = () => oridbFile("saved-queries.json");
const foldersFile = () => oridbFile("saved-query-folders.json");

type SavedQuery = {
  id: string;
  name: string;
  sql: string;
  tags: string[];
  folderId: string | null;
  connectionId: string | null;
  updatedAt: string;
  lastRunAt?: string;
  lastRowCount?: number;
};

type Folder = { id: string; name: string };

function loadQueries(): SavedQuery[] {
  if (!fs.existsSync(queriesFile())) return [];
  try {
    return JSON.parse(fs.readFileSync(queriesFile(), "utf8")) as SavedQuery[];
  } catch {
    return [];
  }
}

function saveQueries(list: SavedQuery[]): void {
  ensureDir(getOriDbHome());
  fs.writeFileSync(queriesFile(), JSON.stringify(list, null, 0), "utf8");
}

function loadFolders(): Folder[] {
  if (!fs.existsSync(foldersFile())) return [];
  try {
    return JSON.parse(fs.readFileSync(foldersFile(), "utf8")) as Folder[];
  } catch {
    return [];
  }
}

function saveFolders(list: Folder[]): void {
  ensureDir(getOriDbHome());
  fs.writeFileSync(foldersFile(), JSON.stringify(list, null, 0), "utf8");
}

export const savedQueriesRouter = Router();

savedQueriesRouter.get("/", (_req, res) => {
  res.json({ queries: loadQueries() });
});

savedQueriesRouter.post("/", (req, res) => {
  const body = z
    .object({
      name: z.string().min(1),
      sql: z.string().min(1),
      tags: z.array(z.string()).optional(),
      folderId: z.string().nullable().optional(),
      connectionId: z.string().uuid().nullable().optional(),
    })
    .parse(req.body);
  const q: SavedQuery = {
    id: randomUUID(),
    name: body.name,
    sql: body.sql,
    tags: body.tags ?? [],
    folderId: body.folderId ?? null,
    connectionId: body.connectionId ?? null,
    updatedAt: new Date().toISOString(),
  };
  const list = loadQueries();
  list.unshift(q);
  saveQueries(list);
  res.status(201).json({ query: q });
});

savedQueriesRouter.put("/:id", (req, res) => {
  const id = req.params.id;
  const patch = z
    .object({
      name: z.string().optional(),
      sql: z.string().optional(),
      tags: z.array(z.string()).optional(),
    })
    .parse(req.body);
  const list = loadQueries();
  const idx = list.findIndex((q) => q.id === id);
  if (idx === -1) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Query" } });
    return;
  }
  list[idx] = { ...list[idx], ...patch, updatedAt: new Date().toISOString() };
  saveQueries(list);
  res.json({ query: list[idx] });
});

savedQueriesRouter.delete("/:id", (req, res) => {
  const list = loadQueries().filter((q) => q.id !== req.params.id);
  saveQueries(list);
  res.status(204).end();
});

savedQueriesRouter.get("/folders", (_req, res) => {
  res.json({ folders: loadFolders() });
});

savedQueriesRouter.post("/folders", (req, res) => {
  const name = z.string().parse(req.body?.name);
  const folder: Folder = { id: randomUUID(), name };
  const list = loadFolders();
  list.push(folder);
  saveFolders(list);
  res.status(201).json({ folder });
});

savedQueriesRouter.put("/folders/:id", (req, res) => {
  const name = z.string().parse(req.body?.name);
  const list = loadFolders();
  const idx = list.findIndex((f) => f.id === req.params.id);
  if (idx === -1) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Folder" } });
    return;
  }
  list[idx] = { ...list[idx], name };
  saveFolders(list);
  res.json({ folder: list[idx] });
});

savedQueriesRouter.delete("/folders/:id", (req, res) => {
  const list = loadFolders().filter((f) => f.id !== req.params.id);
  saveFolders(list);
  const queries = loadQueries().map((q) =>
    q.folderId === req.params.id ? { ...q, folderId: null } : q,
  );
  saveQueries(queries);
  res.status(204).end();
});

savedQueriesRouter.post("/:id/run", async (req, res, next) => {
  try {
    const list = loadQueries();
    const q = list.find((x) => x.id === req.params.id);
    if (!q) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Query" } });
      return;
    }
    const connectionId = z.string().uuid().parse(req.body?.connectionId ?? q.connectionId);
    const h = getHandle(connectionId);
    if (!h?.sql) throw new HttpError(400, "SQL connection not active", "NO_SQL");
    const started = Date.now();
    const r = await h.sql.query(q.sql);
    const idx = list.findIndex((x) => x.id === q.id);
    if (idx >= 0) {
      list[idx] = {
        ...list[idx],
        lastRunAt: new Date().toISOString(),
        lastRowCount: r.rowCount,
      };
      saveQueries(list);
    }
    res.json({
      durationMs: Date.now() - started,
      results: [{ columns: r.columns, rows: r.rows, rowCount: r.rowCount }],
    });
  } catch (e) {
    next(e);
  }
});
