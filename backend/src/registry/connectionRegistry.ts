/**
 * In-memory active connection handles (drivers) keyed by connection id.
 */
import type { ConnectionConfig } from "../types/connection.js";
import type { SqlDriver } from "../drivers/sqlTypes.js";
import { createPostgresDriver } from "../drivers/postgres.js";
import { createSqliteDriver } from "../drivers/sqlite.js";
import { createMysqlDriver } from "../drivers/mysql.js";
import type { MongoDriver } from "../drivers/mongo.js";
import type { RedisDriver } from "../drivers/redis.js";
import { createMongoDriver } from "../drivers/mongo.js";
import { createRedisDriver } from "../drivers/redis.js";

export type ActiveHandle = {
  config: ConnectionConfig;
  sql?: SqlDriver;
  mongo?: MongoDriver;
  redis?: RedisDriver;
};

const active = new Map<string, ActiveHandle>();

function createSql(cfg: ConnectionConfig): SqlDriver {
  switch (cfg.engine) {
    case "postgresql":
    case "cockroachdb":
    case "neon":
    case "supabase":
      return createPostgresDriver(cfg);
    case "mysql":
    case "mariadb":
    case "planetscale":
      return createMysqlDriver(cfg);
    case "sqlite":
      return createSqliteDriver(cfg);
    default:
      throw new Error(`Engine ${cfg.engine} is not SQL-backed in this build`);
  }
}

export async function connectHandle(cfg: ConnectionConfig): Promise<ActiveHandle> {
  const existing = active.get(cfg.id);
  if (existing) await disconnectHandle(cfg.id);

  if (
    cfg.engine === "mongodb"
  ) {
    const mongo = createMongoDriver(cfg);
    await mongo.connect();
    const h: ActiveHandle = { config: cfg, mongo };
    active.set(cfg.id, h);
    return h;
  }
  if (cfg.engine === "redis") {
    const redis = createRedisDriver(cfg);
    await redis.connect();
    const h: ActiveHandle = { config: cfg, redis };
    active.set(cfg.id, h);
    return h;
  }

  const sql = createSql(cfg);
  await sql.connect();
  const h: ActiveHandle = { config: cfg, sql };
  active.set(cfg.id, h);
  return h;
}

export async function disconnectHandle(id: string): Promise<void> {
  const h = active.get(id);
  if (!h) return;
  await h.sql?.disconnect();
  await h.mongo?.disconnect();
  await h.redis?.disconnect();
  active.delete(id);
}

export function getHandle(id: string): ActiveHandle | undefined {
  return active.get(id);
}

export function isConnected(id: string): boolean {
  return active.has(id);
}

export async function shutdownAll(): Promise<void> {
  for (const id of [...active.keys()]) {
    await disconnectHandle(id);
  }
}
