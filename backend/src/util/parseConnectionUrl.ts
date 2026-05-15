/**
 * Parses database URLs into partial connection fields.
 */
import type { Engine } from "../types/connection.js";

export type ParsedUrl = {
  engine: Engine;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  ssl?: boolean;
};

export function parseConnectionUrl(raw: string): ParsedUrl | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  const protocol = url.protocol.replace(":", "").toLowerCase();

  if (protocol === "postgres" || protocol === "postgresql") {
    const user = url.username ? decodeURIComponent(url.username) : undefined;
    const pass = url.password ? decodeURIComponent(url.password) : undefined;
    const ssl =
      url.searchParams.get("sslmode") === "require" ||
      url.hostname.includes("neon.tech") ||
      url.hostname.includes("supabase.co");
    return {
      engine: "postgresql",
      host: url.hostname || undefined,
      port: url.port ? Number(url.port) : 5432,
      database: url.pathname.replace(/^\//, "") || undefined,
      username: user,
      password: pass,
      ssl: ssl || undefined,
    };
  }

  if (protocol === "mysql" || protocol === "mariadb") {
    const user = url.username ? decodeURIComponent(url.username) : undefined;
    const pass = url.password ? decodeURIComponent(url.password) : undefined;
    return {
      engine: protocol === "mariadb" ? "mariadb" : "mysql",
      host: url.hostname || undefined,
      port: url.port ? Number(url.port) : 3306,
      database: url.pathname.replace(/^\//, "") || undefined,
      username: user,
      password: pass,
    };
  }

  if (protocol === "mongodb" || protocol === "mongodb+srv") {
    const user = url.username ? decodeURIComponent(url.username) : undefined;
    const pass = url.password ? decodeURIComponent(url.password) : undefined;
    return {
      engine: "mongodb",
      host: url.hostname || undefined,
      port: url.port ? Number(url.port) : undefined,
      database: url.pathname.replace(/^\//, "").split("?")[0] || undefined,
      username: user,
      password: pass,
      ssl: protocol === "mongodb+srv" ? true : undefined,
    };
  }

  if (protocol === "redis" || protocol === "rediss") {
    const user = url.username ? decodeURIComponent(url.username) : undefined;
    const pass = url.password ? decodeURIComponent(url.password) : undefined;
    return {
      engine: "redis",
      host: url.hostname || undefined,
      port: url.port ? Number(url.port) : 6379,
      database: url.pathname.replace(/^\//, "") || undefined,
      username: user,
      password: pass,
      ssl: protocol === "rediss" ? true : undefined,
    };
  }

  if (protocol === "file") {
    const filePath = decodeURIComponent(url.pathname.replace(/^\//, ""));
    return {
      engine: "sqlite",
      database: filePath || undefined,
    };
  }

  return null;
}
