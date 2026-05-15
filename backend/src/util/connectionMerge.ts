/**
 * Merge connection updates — avoid stale connectionUrl overriding edited credentials.
 */
import type { ConnectionConfig } from "../types/connection.js";
import { sanitizePgConnectionString } from "./parseConnectionUrl.js";
import { resolveSqlitePath } from "./sqlitePath.js";

export type SanitizedConnection = ConnectionConfig & { hasConnectionUrl?: boolean };

/** API-safe profile: no raw password or credentials in URL. */
export function sanitizeForApi(c: ConnectionConfig): SanitizedConnection {
  const { connectionUrl, password, ...rest } = c;
  return {
    ...rest,
    password: password ? "********" : undefined,
    hasConnectionUrl: !!connectionUrl?.trim(),
  };
}

export function stripPlaceholderSecrets(
  body: Partial<ConnectionConfig>,
): Partial<ConnectionConfig> {
  const next = { ...body };
  if (next.password === "********") delete next.password;
  if (
    next.connectionUrl === "********" ||
    next.connectionUrl?.includes("://********")
  ) {
    delete next.connectionUrl;
  }
  return next;
}

const AUTH_KEYS = ["password", "host", "username", "database", "port"] as const;

export function mergeConnectionUpdate(
  stored: ConnectionConfig,
  patch: Partial<ConnectionConfig>,
): ConnectionConfig {
  const authTouched = AUTH_KEYS.some((k) => patch[k] !== undefined);
  const merged: ConnectionConfig = {
    ...stored,
    ...patch,
    id: stored.id,
    password: patch.password ?? stored.password,
  };

  if (patch.connectionUrl?.trim()) {
    merged.connectionUrl = patch.connectionUrl.trim();
  } else if (authTouched) {
    delete merged.connectionUrl;
  }

  return normalizeConnection(merged);
}

export function normalizeConnection(cfg: ConnectionConfig): ConnectionConfig {
  const next = { ...cfg };
  if (next.engine === "sqlite" && (next.database?.trim() || next.host?.trim())) {
    const raw = next.database?.trim() || next.host?.trim() || "";
    next.database = resolveSqlitePath(raw);
    delete next.host;
    delete next.port;
    delete next.username;
    delete next.password;
    delete next.connectionUrl;
  }
  if (next.connectionUrl?.trim()) {
    const isPg =
      next.engine === "postgresql" ||
      next.engine === "neon" ||
      next.engine === "supabase" ||
      next.engine === "cockroachdb";
    if (isPg) {
      next.connectionUrl = sanitizePgConnectionString(next.connectionUrl);
    }
  }
  if (next.port === undefined || Number.isNaN(next.port)) {
    /* filled by caller */
  }
  return next;
}
