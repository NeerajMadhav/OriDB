/**
 * Saved connections API (local encrypted store) + connect lifecycle.
 */
import { Router } from "express";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import {
  connectionConfigSchema,
  defaultPortForEngine,
  type ConnectionConfig,
} from "../types/connection.js";
import { loadConnections, saveConnections } from "../store/connectionsStore.js";
import { parseConnectionUrl } from "../util/parseConnectionUrl.js";
import {
  connectHandle,
  disconnectHandle,
  isConnected,
} from "../registry/connectionRegistry.js";
import { createPostgresDriver } from "../drivers/postgres.js";
import { createSqliteDriver } from "../drivers/sqlite.js";
import { createMysqlDriver } from "../drivers/mysql.js";
import { createMongoDriver } from "../drivers/mongo.js";
import { createRedisDriver } from "../drivers/redis.js";

const createBody = connectionConfigSchema
  .omit({ id: true })
  .extend({ id: z.string().uuid().optional() });

const updateBody = connectionConfigSchema.omit({ id: true }).partial();

export const connectionsRouter = Router();

connectionsRouter.get("/", (_req, res) => {
  const list = loadConnections().map(sanitize);
  res.json({ connections: list });
});

connectionsRouter.post("/parse-url", (req, res) => {
  const url = z.string().min(1).parse(req.body?.url);
  const parsed = parseConnectionUrl(url);
  if (!parsed) {
    res.status(400).json({ error: { code: "PARSE", message: "Unrecognized URL" } });
    return;
  }
  res.json({ parsed });
});

function stripPlaceholderSecrets(
  body: Partial<ConnectionConfig>,
): Partial<ConnectionConfig> {
  const next = { ...body };
  if (next.password === "********") delete next.password;
  return next;
}

connectionsRouter.post("/", (req, res, next) => {
  try {
    const body = createBody.parse(stripPlaceholderSecrets(req.body));
    const id = body.id ?? randomUUID();
    const merged: ConnectionConfig = {
      ...body,
      id,
      port: body.port ?? defaultPortForEngine(body.engine),
    } as ConnectionConfig;
    const list = loadConnections().filter((c) => c.id !== id);
    list.push(merged);
    saveConnections(list);
    res.status(201).json({ connection: sanitize(merged) });
  } catch (e) {
    next(e);
  }
});

connectionsRouter.put("/:id", (req, res, next) => {
  try {
    const id = req.params.id;
    const body = updateBody.parse(stripPlaceholderSecrets(req.body));
    const list = loadConnections();
    const idx = list.findIndex((c) => c.id === id);
    if (idx === -1) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Connection" } });
      return;
    }
    const merged = { ...list[idx], ...body, id } as ConnectionConfig;
    list[idx] = merged;
    saveConnections(list);
    res.json({ connection: sanitize(merged) });
  } catch (e) {
    next(e);
  }
});

connectionsRouter.delete("/:id", async (req, res) => {
  const id = req.params.id;
  await disconnectHandle(id);
  const list = loadConnections().filter((c) => c.id !== id);
  saveConnections(list);
  res.status(204).end();
});

connectionsRouter.post("/test", async (req, res) => {
  const cfg = createBody.parse(req.body) as ConnectionConfig;
  const testCfg = { ...cfg, id: cfg.id ?? randomUUID() };
  const r = await testConnection(testCfg);
  res.json(r);
});

connectionsRouter.post("/:id/connect", async (req, res) => {
  const id = req.params.id;
  const list = loadConnections();
  const cfg = list.find((c) => c.id === id);
  if (!cfg) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Connection" } });
    return;
  }
  await connectHandle(cfg);
  res.json({ ok: true, connectionId: id });
});

connectionsRouter.post("/:id/disconnect", async (req, res) => {
  await disconnectHandle(req.params.id);
  res.json({ ok: true });
});

connectionsRouter.get("/:id/status", (req, res) => {
  const id = req.params.id;
  res.json({ connected: isConnected(id) });
});

function sanitize(c: ConnectionConfig): ConnectionConfig {
  return { ...c, password: c.password ? "********" : undefined };
}

async function testConnection(cfg: ConnectionConfig): Promise<{
  ok: boolean;
  latencyMs: number;
  error?: string;
}> {
  try {
    if (
      cfg.engine === "postgresql" ||
      cfg.engine === "cockroachdb" ||
      cfg.engine === "neon" ||
      cfg.engine === "supabase"
    ) {
      return await createPostgresDriver(cfg).test();
    }
    if (
      cfg.engine === "mysql" ||
      cfg.engine === "mariadb" ||
      cfg.engine === "planetscale"
    ) {
      return await createMysqlDriver(cfg).test();
    }
    if (cfg.engine === "sqlite") {
      return await createSqliteDriver(cfg).test();
    }
    if (cfg.engine === "mongodb") {
      const d = createMongoDriver(cfg);
      await d.connect();
      await d.ping();
      await d.disconnect();
      return { ok: true, latencyMs: 0 };
    }
    if (cfg.engine === "redis") {
      const d = createRedisDriver(cfg);
      await d.connect();
      await d.ping();
      await d.disconnect();
      return { ok: true, latencyMs: 0 };
    }
    return { ok: false, latencyMs: 0, error: "Unsupported engine" };
  } catch (e) {
    return {
      ok: false,
      latencyMs: 0,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export function getConnectionOr404(id: string): ConnectionConfig | undefined {
  return loadConnections().find((c) => c.id === id);
}
