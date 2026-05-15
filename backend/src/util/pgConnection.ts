/**
 * PostgreSQL pool options — connection string (Neon/RDS/Supabase) or discrete fields.
 */
import type { ConnectionConfig } from "../types/connection.js";
import type { PoolConfig } from "pg";
import { defaultPortForEngine } from "../types/connection.js";
import {
  sanitizePgConnectionString,
  inferSslFromHostname,
  normalizeDriverConnectionUrl,
} from "./parseConnectionUrl.js";

export function isLocalPgHost(host: string | undefined): boolean {
  const h = (host ?? "").toLowerCase().trim();
  if (!h) return false;
  return (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h === "::1" ||
    h === "0.0.0.0" ||
    h.endsWith(".local")
  );
}

/** Whether node-pg should enable TLS for this profile. */
export function resolvePgSsl(cfg: ConnectionConfig): boolean {
  if (cfg.ssl === false) return false;
  if (isLocalPgHost(cfg.host)) {
    return cfg.ssl === true;
  }
  if (cfg.ssl === true) return true;
  if (cfg.engine === "neon" || cfg.engine === "supabase") return true;
  if (cfg.host && inferSslFromHostname(cfg.host)) return true;
  if (cfg.connectionUrl) {
    try {
      const u = new URL(normalizeDriverConnectionUrl(cfg.connectionUrl));
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

export function pgNeedsSsl(cfg: ConnectionConfig): boolean {
  return resolvePgSsl(cfg);
}

/** Prefer URL when credentials live only in the connection string. */
export function shouldUseConnectionString(cfg: ConnectionConfig): boolean {
  const url = cfg.connectionUrl?.trim();
  if (!url) return false;
  const hasUser = !!cfg.username?.trim();
  const hasHost = !!cfg.host?.trim();
  const hasPassword =
    cfg.password != null && String(cfg.password).length > 0;
  if (hasUser && hasHost && hasPassword) return false;
  if (url.includes("@")) return true;
  return !hasUser || !hasHost;
}

export function applyPgSslModeToUrl(raw: string, enableSsl: boolean): string {
  try {
    const u = new URL(normalizeDriverConnectionUrl(raw));
    if (u.protocol === "postgres:") u.protocol = "postgresql:";
    if (enableSsl) {
      if (!u.searchParams.has("sslmode")) {
        u.searchParams.set("sslmode", "require");
      }
    } else {
      u.searchParams.set("sslmode", "disable");
    }
    u.searchParams.delete("channel_binding");
    return u.toString();
  } catch {
    return raw;
  }
}

export function pgPassword(cfg: ConnectionConfig): string {
  if (cfg.password != null && String(cfg.password).length > 0) {
    return String(cfg.password);
  }
  const url = cfg.connectionUrl?.trim();
  if (!url) return "";
  try {
    const u = new URL(normalizeDriverConnectionUrl(url));
    if (u.password) return decodeURIComponent(u.password);
  } catch {
    /* ignore */
  }
  return "";
}

export function buildPgPoolConfig(cfg: ConnectionConfig): PoolConfig {
  const max = cfg.poolMax ?? 10;
  const min = cfg.poolMin ?? 0;
  const connectionTimeoutMillis = (cfg.connectionTimeoutSec ?? 15) * 1000;
  const sslEnabled = resolvePgSsl(cfg);
  const ssl: PoolConfig["ssl"] = sslEnabled
    ? { rejectUnauthorized: false }
    : false;

  const base: PoolConfig = {
    max,
    min,
    connectionTimeoutMillis,
    idleTimeoutMillis: 30_000,
    ssl,
  };

  if (shouldUseConnectionString(cfg)) {
    let connectionString = sanitizePgConnectionString(cfg.connectionUrl!);
    connectionString = applyPgSslModeToUrl(connectionString, sslEnabled);
    return { ...base, connectionString };
  }

  return {
    ...base,
    host: cfg.host ?? "127.0.0.1",
    port: cfg.port ?? defaultPortForEngine("postgresql"),
    database: cfg.database ?? "postgres",
    user: cfg.username ?? "postgres",
    password: pgPassword(cfg),
  };
}
