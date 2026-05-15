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
  mergeConnectionUpdate,
  normalizeConnection,
  sanitizeForApi,
  stripPlaceholderSecrets,
} from "../util/connectionMerge.js";
import {
  connectHandle,
  disconnectHandle,
  isConnected,
} from "../registry/connectionRegistry.js";
import { sqliteLocalRouter } from "./sqliteLocal.js";
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
  const list = loadConnections().map(sanitizeForApi);
  res.json({ connections: list });
});

connectionsRouter.use("/sqlite", sqliteLocalRouter);

connectionsRouter.post("/parse-url", (req, res) => {
  const url = z.string().min(1).parse(req.body?.url);
  const parsed = parseConnectionUrl(url);
  if (!parsed) {
    res.status(400).json({ error: { code: "PARSE", message: "Unrecognized URL" } });
    return;
  }
  res.json({ parsed });
});

connectionsRouter.post("/", (req, res, next) => {
  try {
    const body = createBody.parse(stripPlaceholderSecrets(req.body));
    const id = body.id ?? randomUUID();
    const merged = normalizeConnection({
      ...body,
      id,
      port: body.port ?? defaultPortForEngine(body.engine),
    } as ConnectionConfig);
    const list = loadConnections().filter((c) => c.id !== id);
    list.push(merged);
    saveConnections(list);
    res.status(201).json({ connection: sanitizeForApi(merged) });
  } catch (e) {
    next(e);
  }
});

connectionsRouter.put("/:id", async (req, res, next) => {
  try {
    const id = req.params.id;
    const body = updateBody.parse(stripPlaceholderSecrets(req.body));
    const list = loadConnections();
    const idx = list.findIndex((c) => c.id === id);
    if (idx === -1) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Connection" } });
      return;
    }
    const merged = mergeConnectionUpdate(list[idx]!, body);
    list[idx] = merged;
    saveConnections(list);
    if (isConnected(id)) {
      await disconnectHandle(id);
    }
    res.json({ connection: sanitizeForApi(merged) });
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

connectionsRouter.post("/test", async (req, res, next) => {
  try {
    const body = stripPlaceholderSecrets(req.body ?? {});
    const id = typeof body.id === "string" ? body.id : undefined;
    let testCfg: ConnectionConfig;
    if (id) {
      const stored = loadConnections().find((c) => c.id === id);
      if (!stored) {
        res.status(404).json({ error: { code: "NOT_FOUND", message: "Connection" } });
        return;
      }
      const patch = updateBody.parse(body);
      testCfg = mergeConnectionUpdate(stored, patch);
    } else {
      const cfg = createBody.parse(body) as ConnectionConfig;
      testCfg = normalizeConnection({
        ...cfg,
        id: cfg.id ?? randomUUID(),
        port: cfg.port ?? defaultPortForEngine(cfg.engine),
      });
    }
    const r = await testConnection(testCfg);
    res.json(r);
  } catch (e) {
    next(e);
  }
});

connectionsRouter.get("/:id", (req, res) => {
  const c = loadConnections().find((x) => x.id === req.params.id);
  if (!c) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Connection" } });
    return;
  }
  res.json({ connection: sanitizeForApi(c) });
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
    if (cfg.engine === "snowflake") {
      const { createSnowflakeDriver } = await import("../drivers/snowflake.js");
      return await createSnowflakeDriver(cfg).test();
    }
    if (cfg.engine === "clickhouse" || cfg.engine === "sqlserver") {
      return {
        ok: false,
        latencyMs: 0,
        error: `${cfg.engine} connections can be saved but querying is not enabled yet in this build`,
      };
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
