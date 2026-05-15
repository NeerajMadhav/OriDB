/**
 * Parses database URLs into connection fields + provider detection (Neon, RDS, Supabase, etc.).
 */
import type { Engine } from "../types/connection.js";
import {
  parseBareSqlitePath,
  resolveSqlitePath,
  suggestSqliteName,
} from "./sqlitePath.js";

export type ConnectionProvider =
  | "neon"
  | "supabase"
  | "aws-rds"
  | "planetscale"
  | "cockroachdb"
  | "mongodb-atlas"
  | "snowflake"
  | "clickhouse"
  | "sqlserver"
  | "generic";

export type ParsedUrl = {
  engine: Engine;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  ssl?: boolean;
  warehouse?: string;
  role?: string;
  defaultSchema?: string;
  /** Normalized URL safe for node drivers (stored on profile). */
  connectionUrl?: string;
  provider?: ConnectionProvider;
  suggestedName?: string;
};

const SSL_MODES_REQUIRE = new Set([
  "require",
  "verify-ca",
  "verify-full",
  "prefer",
]);

export function parseConnectionUrl(raw: string): ParsedUrl | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const bareSqlite = parseBareSqlitePath(trimmed);
  if (bareSqlite) {
    const resolved = resolveSqlitePath(bareSqlite);
    return {
      engine: "sqlite",
      database: resolved,
      provider: "generic",
      suggestedName: suggestSqliteName(resolved),
    };
  }

  if (/^jdbc:/i.test(trimmed)) {
    return parseJdbcStyle(trimmed);
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  const protocol = url.protocol.replace(":", "").toLowerCase();

  if (protocol === "postgres" || protocol === "postgresql") {
    return parsePostgresUrl(url, trimmed);
  }

  if (protocol === "mysql" || protocol === "mariadb") {
    return parseMysqlUrl(url, trimmed, protocol === "mariadb");
  }

  if (protocol === "mongodb" || protocol === "mongodb+srv") {
    return parseMongoUrl(url, trimmed, protocol === "mongodb+srv");
  }

  if (protocol === "redis" || protocol === "rediss") {
    return parseRedisUrl(url, trimmed, protocol === "rediss");
  }

  if (protocol === "file") {
    let filePath = decodeURIComponent(url.pathname);
    if (process.platform === "win32" && /^\/[a-zA-Z]:/.test(filePath)) {
      filePath = filePath.slice(1);
    } else {
      filePath = filePath.replace(/^\//, "");
    }
    const resolved = filePath ? resolveSqlitePath(filePath) : "";
    return {
      engine: "sqlite",
      database: resolved || undefined,
      provider: "generic",
      suggestedName: resolved ? suggestSqliteName(resolved) : "SQLite",
    };
  }

  if (protocol === "snowflake") {
    return parseSnowflakeUrl(url, trimmed);
  }

  if (protocol === "clickhouse" || protocol === "clickhouses") {
    return parseClickHouseUrl(url, trimmed);
  }

  if (
    protocol === "sqlserver" ||
    protocol === "mssql" ||
    protocol === "jdbc:sqlserver"
  ) {
    return parseSqlServerUrl(url, trimmed);
  }

  return null;
}

/** Strip params that break node-pg while keeping sslmode. */
export function sanitizePgConnectionString(raw: string): string {
  let s = raw.trim();
  if (!s) return s;
  try {
    const u = new URL(s);
    if (u.protocol === "postgres:") {
      u.protocol = "postgresql:";
    }
    u.searchParams.delete("channel_binding");
    if (!u.searchParams.has("sslmode") && inferSslFromHostname(u.hostname)) {
      u.searchParams.set("sslmode", "require");
    }
    return u.toString();
  } catch {
    return s.replace(/[?&]channel_binding=[^&]*/gi, "").replace(/\?&/, "?");
  }
}

export function inferSslFromHostname(host: string): boolean {
  const h = host.toLowerCase();
  return (
    h.includes("neon.tech") ||
    h.includes("supabase.co") ||
    h.includes("rds.amazonaws.com") ||
    h.includes("cockroachlabs.cloud") ||
    h.includes("psdb.cloud") ||
    h.includes("render.com") ||
    h.includes("redshift.amazonaws.com") ||
    h.includes("snowflakecomputing.com")
  );
}

function parsePostgresUrl(url: URL, raw: string): ParsedUrl {
  const host = url.hostname || undefined;
  const provider = detectProvider(host, "postgresql");
  const engine = providerToEngine(provider, "postgresql");
  const database = url.pathname.replace(/^\//, "").split("?")[0] || undefined;
  const sslMode = url.searchParams.get("sslmode")?.toLowerCase();
  const ssl =
    sslMode === "disable"
      ? false
      : sslMode
        ? SSL_MODES_REQUIRE.has(sslMode)
        : inferSslFromHostname(host ?? "") || provider === "neon" || provider === "supabase";

  return {
    engine,
    host,
    port: url.port ? Number(url.port) : 5432,
    database,
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    ssl: ssl || undefined,
    connectionUrl: sanitizePgConnectionString(raw),
    provider,
    suggestedName: suggestName(provider, database, host),
  };
}

function parseMysqlUrl(url: URL, raw: string, mariadb: boolean): ParsedUrl {
  const host = url.hostname || undefined;
  const provider = detectProvider(host, "mysql");
  const engine = providerToEngine(provider, mariadb ? "mariadb" : "mysql");
  const sslMode = url.searchParams.get("ssl-mode")?.toLowerCase() ?? url.searchParams.get("sslmode")?.toLowerCase();
  const ssl =
    sslMode === "disabled" || sslMode === "disable"
      ? false
      : sslMode
        ? SSL_MODES_REQUIRE.has(sslMode) || sslMode === "required"
        : provider === "planetscale" ||
          provider === "aws-rds" ||
          host?.includes("psdb.cloud");

  return {
    engine,
    host,
    port: url.port ? Number(url.port) : 3306,
    database: url.pathname.replace(/^\//, "").split("?")[0] || undefined,
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    ssl: ssl || undefined,
    connectionUrl: raw.trim(),
    provider,
    suggestedName: suggestName(provider, url.pathname.replace(/^\//, ""), host),
  };
}

function parseMongoUrl(url: URL, raw: string, srv: boolean): ParsedUrl {
  const host = url.hostname || undefined;
  return {
    engine: "mongodb",
    host,
    port: url.port ? Number(url.port) : srv ? undefined : 27017,
    database: url.pathname.replace(/^\//, "").split("?")[0] || undefined,
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    ssl: srv ? true : undefined,
    connectionUrl: raw.trim(),
    provider: host?.includes("mongodb.net") ? "mongodb-atlas" : "generic",
    suggestedName: suggestName("mongodb-atlas", undefined, host),
  };
}

function parseRedisUrl(url: URL, raw: string, tls: boolean): ParsedUrl {
  return {
    engine: "redis",
    host: url.hostname || undefined,
    port: url.port ? Number(url.port) : 6379,
    database: url.pathname.replace(/^\//, "") || undefined,
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    ssl: tls ? true : undefined,
    connectionUrl: raw.trim(),
    provider: "generic",
    suggestedName: "Redis",
  };
}

/** jdbc:postgresql://... or plain host:port/db fallback */
function parseJdbcStyle(trimmed: string): ParsedUrl | null {
  const jdbc = trimmed.match(/^jdbc:([^:]+):\/\/(.+)$/i);
  if (jdbc) {
    const proto = jdbc[1]!.toLowerCase();
    const rest = jdbc[2]!;
    if (proto === "snowflake") {
      return parseConnectionUrl(`snowflake://${rest}`);
    }
    if (proto === "sqlserver") {
      return parseConnectionUrl(`sqlserver://${rest}`);
    }
    const normalized =
      proto === "postgresql"
        ? `postgresql://${rest}`
        : `${proto}://${rest}`;
    return parseConnectionUrl(normalized);
  }
  return null;
}

function parseSnowflakeUrl(url: URL, raw: string): ParsedUrl {
  const path = url.pathname.replace(/^\//, "").split("/").filter(Boolean);
  const database = path[0] || url.searchParams.get("db") || undefined;
  const defaultSchema = path[1] ?? url.searchParams.get("schema") ?? "PUBLIC";
  return {
    engine: "snowflake",
    host: url.hostname.replace(/\.snowflakecomputing\.com$/i, ""),
    port: url.port ? Number(url.port) : 443,
    database,
    defaultSchema,
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    ssl: true,
    warehouse: url.searchParams.get("warehouse") ?? undefined,
    role: url.searchParams.get("role") ?? undefined,
    connectionUrl: raw.trim(),
    provider: "snowflake",
    suggestedName: suggestName("snowflake", database, url.hostname),
  };
}

function parseClickHouseUrl(url: URL, raw: string): ParsedUrl {
  const database = url.pathname.replace(/^\//, "").split("?")[0] || "default";
  return {
    engine: "clickhouse",
    host: url.hostname || undefined,
    port: url.port ? Number(url.port) : 8123,
    database,
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    ssl: url.protocol === "clickhouses:" || url.searchParams.get("ssl") === "1",
    connectionUrl: raw.trim(),
    provider: "clickhouse",
    suggestedName: suggestName("clickhouse", database, url.hostname),
  };
}

function parseSqlServerUrl(url: URL, raw: string): ParsedUrl {
  const database = url.pathname.replace(/^\//, "").split("?")[0] || undefined;
  return {
    engine: "sqlserver",
    host: url.hostname || undefined,
    port: url.port ? Number(url.port) : 1433,
    database,
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    ssl: url.searchParams.get("encrypt") !== "false",
    connectionUrl: raw.trim(),
    provider: "sqlserver",
    suggestedName: suggestName("sqlserver", database, url.hostname),
  };
}

function detectProvider(
  host: string | undefined,
  family: "postgresql" | "mysql",
): ConnectionProvider {
  const h = (host ?? "").toLowerCase();
  if (h.includes("neon.tech")) return "neon";
  if (h.includes("supabase.co")) return "supabase";
  if (h.includes("rds.amazonaws.com")) return "aws-rds";
  if (h.includes("psdb.cloud")) return "planetscale";
  if (h.includes("cockroachlabs.cloud")) return "cockroachdb";
  if (family === "postgresql" && h.includes("amazonaws.com")) return "aws-rds";
  return "generic";
}

function providerToEngine(
  provider: ConnectionProvider,
  fallback: Engine,
): Engine {
  switch (provider) {
    case "neon":
      return "neon";
    case "supabase":
      return "supabase";
    case "cockroachdb":
      return "cockroachdb";
    case "planetscale":
      return "planetscale";
    case "snowflake":
      return "snowflake";
    case "clickhouse":
      return "clickhouse";
    case "sqlserver":
      return "sqlserver";
    case "aws-rds":
      return fallback === "mariadb" ? "mariadb" : fallback === "mysql" ? "mysql" : "postgresql";
    default:
      return fallback;
  }
}

function suggestName(
  provider: ConnectionProvider,
  database: string | undefined,
  host: string | undefined,
): string {
  const db = database?.split("?")[0]?.trim();
  const labels: Record<ConnectionProvider, string> = {
    neon: "Neon",
    supabase: "Supabase",
    "aws-rds": "AWS RDS",
    planetscale: "PlanetScale",
    cockroachdb: "CockroachDB",
    "mongodb-atlas": "MongoDB Atlas",
    snowflake: "Snowflake",
    clickhouse: "ClickHouse",
    sqlserver: "SQL Server",
    generic: "Database",
  };
  const label = labels[provider];
  if (db) return `${label} — ${db}`;
  if (host) return `${label} — ${host.split(".")[0]}`;
  return label;
}
