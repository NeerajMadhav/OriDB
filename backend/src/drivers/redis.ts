/**
 * Redis driver — basic key/value and INFO.
 */
import { Redis } from "ioredis";
import type { ConnectionConfig } from "../types/connection.js";

export type RedisDriver = {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  ping(): Promise<void>;
  scanKeys(pattern: string, count?: number): Promise<string[]>;
  get(key: string): Promise<string | null>;
  type(key: string): Promise<string>;
  ttl(key: string): Promise<number>;
  info(section?: string): Promise<string>;
};

function buildRedisUrl(cfg: ConnectionConfig): string {
  if (cfg.connectionUrl?.trim()) return cfg.connectionUrl.trim();
  const host = cfg.host ?? "127.0.0.1";
  const port = cfg.port ?? 6379;
  const pass = cfg.password ? `:${encodeURIComponent(cfg.password)}@` : "";
  const user = cfg.username ? `${encodeURIComponent(cfg.username)}` : "";
  const auth = user || pass ? `${user}${pass}` : "";
  const proto = cfg.ssl ? "rediss" : "redis";
  const dbn = cfg.database ?? "0";
  return `${proto}://${auth}${host}:${port}/${dbn}`;
}

export function createRedisDriver(cfg: ConnectionConfig): RedisDriver {
  if (cfg.engine !== "redis") throw new Error("Redis only");

  const url = buildRedisUrl(cfg);
  let redis: Redis | null = null;

  return {
    async connect() {
      redis = new Redis(url, { maxRetriesPerRequest: 1, enableReadyCheck: true });
    },
    async disconnect() {
      if (redis) {
        redis.disconnect();
        redis = null;
      }
    },
    async ping() {
      if (!redis) throw new Error("not connected");
      await redis.ping();
    },
    async scanKeys(pattern, count = 200) {
      if (!redis) throw new Error("not connected");
      const keys: string[] = [];
      let cursor = "0";
      do {
        const [next, batch] = await redis.scan(
          cursor,
          "MATCH",
          pattern,
          "COUNT",
          count,
        );
        cursor = next;
        keys.push(...batch);
        if (keys.length >= count) break;
      } while (cursor !== "0");
      return keys;
    },
    async get(key) {
      if (!redis) throw new Error("not connected");
      return redis.get(key);
    },
    async type(key) {
      if (!redis) throw new Error("not connected");
      return redis.type(key);
    },
    async ttl(key) {
      if (!redis) throw new Error("not connected");
      return redis.ttl(key);
    },
    async info(section) {
      if (!redis) throw new Error("not connected");
      return section ? redis.info(section) : redis.info();
    },
  };
}
