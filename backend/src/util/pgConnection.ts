/**
 * PostgreSQL pool options — connection string (Neon/RDS/Supabase) or discrete fields.
 */
import type { ConnectionConfig } from "../types/connection.js";
import type { PoolConfig } from "pg";
import { defaultPortForEngine } from "../types/connection.js";
import { sanitizePgConnectionString, inferSslFromHostname } from "./parseConnectionUrl.js";

export function pgNeedsSsl(cfg: ConnectionConfig): boolean {
  if (cfg.ssl === true) return true;
  if (cfg.ssl === false) return false;
  if (cfg.engine === "neon" || cfg.engine === "supabase") return true;
  if (cfg.host && inferSslFromHostname(cfg.host)) return true;
  if (cfg.connectionUrl) {
    try {
      const u = new URL(cfg.connectionUrl);
      const mode = u.searchParams.get("sslmode")?.toLowerCase();
      if (mode === "disable") return false;
      if (mode && mode !== "allow") return true;
      return inferSslFromHostname(u.hostname);
    } catch {
      /* ignore */
    }
  }
  return false;
}

/** Use discrete fields when host+user are set (edited profile); else connection string. */
function useConnectionString(cfg: ConnectionConfig): boolean {
  if (!cfg.connectionUrl?.trim()) return false;
  if (cfg.host?.trim() && cfg.username?.trim()) return false;
  return true;
}

export function buildPgPoolConfig(cfg: ConnectionConfig): PoolConfig {
  const max = cfg.poolMax ?? 10;
  const min = cfg.poolMin ?? 0;
  const connectionTimeoutMillis = (cfg.connectionTimeoutSec ?? 15) * 1000;
  const ssl = pgNeedsSsl(cfg) ? { rejectUnauthorized: false } : false;

  const base: PoolConfig = {
    max,
    min,
    connectionTimeoutMillis,
    idleTimeoutMillis: 30_000,
    ssl,
  };

  if (useConnectionString(cfg)) {
    return {
      ...base,
      connectionString: sanitizePgConnectionString(cfg.connectionUrl!),
    };
  }

  return {
    ...base,
    host: cfg.host ?? "127.0.0.1",
    port: cfg.port ?? defaultPortForEngine("postgresql"),
    database: cfg.database ?? "postgres",
    user: cfg.username ?? "postgres",
    password: cfg.password ?? "",
  };
}
