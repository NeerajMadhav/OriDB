/**
 * Snowflake SQL driver.
 */
import snowflake from "snowflake-sdk";
import type { ConnectionConfig } from "../types/connection.js";
import type { SqlDriver, QueryResult } from "./sqlTypes.js";

type SnowflakeConn = snowflake.Connection;

function parseSnowflakeOptions(cfg: ConnectionConfig): {
  account: string;
  username: string;
  password: string;
  database?: string;
  schema?: string;
  warehouse?: string;
  role?: string;
} {
  if (cfg.connectionUrl?.trim()) {
    try {
      const u = new URL(cfg.connectionUrl);
      const path = u.pathname.replace(/^\//, "").split("/").filter(Boolean);
      return {
        account: u.hostname.replace(/\.snowflakecomputing\.com$/i, ""),
        username: decodeURIComponent(u.username),
        password: decodeURIComponent(u.password),
        database: path[0] ?? cfg.database,
        schema: path[1] ?? cfg.defaultSchema,
        warehouse: u.searchParams.get("warehouse") ?? cfg.warehouse,
        role: u.searchParams.get("role") ?? cfg.role,
      };
    } catch {
      /* fall through */
    }
  }
  const account = (cfg.host ?? "").replace(/\.snowflakecomputing\.com$/i, "");
  return {
    account,
    username: cfg.username ?? "",
    password: cfg.password ?? "",
    database: cfg.database,
    schema: cfg.defaultSchema,
    warehouse: cfg.warehouse,
    role: cfg.role,
  };
}

function connectAsync(conn: SnowflakeConn): Promise<void> {
  return new Promise((resolve, reject) => {
    conn.connect((err) => (err ? reject(err) : resolve()));
  });
}

function destroyAsync(conn: SnowflakeConn): Promise<void> {
  return new Promise((resolve) => {
    conn.destroy((err) => {
      if (err) {
        /* ignore */
      }
      resolve();
    });
  });
}

function executeAsync(
  conn: SnowflakeConn,
  sql: string,
): Promise<{ columns: { name: string }[]; rows: Record<string, unknown>[] }> {
  return new Promise((resolve, reject) => {
    conn.execute({
      sqlText: sql,
      complete: (err, stmt, rows) => {
        if (err) {
          reject(err);
          return;
        }
        const cols =
          stmt?.getColumns?.()?.map((c: { getName: () => string }) => ({
            name: c.getName(),
          })) ?? [];
        resolve({
          columns: cols,
          rows: (rows as Record<string, unknown>[]) ?? [],
        });
      },
    });
  });
}

export function createSnowflakeDriver(cfg: ConnectionConfig): SqlDriver {
  let conn: SnowflakeConn | null = null;
  const opts = parseSnowflakeOptions(cfg);

  const open = async (): Promise<SnowflakeConn> => {
    if (conn) return conn;
    const c = snowflake.createConnection({
      account: opts.account,
      username: opts.username,
      password: opts.password,
      database: opts.database,
      schema: opts.schema ?? "PUBLIC",
      warehouse: opts.warehouse,
      role: opts.role,
    });
    await connectAsync(c);
    conn = c;
    return c;
  };

  return {
    engine: "snowflake",

    async test() {
      const start = Date.now();
      try {
        const c = snowflake.createConnection({
          account: opts.account,
          username: opts.username,
          password: opts.password,
          database: opts.database,
          schema: opts.schema ?? "PUBLIC",
          warehouse: opts.warehouse,
          role: opts.role,
        });
        await connectAsync(c);
        await executeAsync(c, "SELECT 1 AS ok");
        await destroyAsync(c);
        return { ok: true, latencyMs: Date.now() - start };
      } catch (e) {
        return {
          ok: false,
          latencyMs: Date.now() - start,
          error: e instanceof Error ? e.message : String(e),
        };
      }
    },

    async connect() {
      await open();
    },

    async disconnect() {
      if (conn) {
        await destroyAsync(conn);
        conn = null;
      }
    },

    async ping() {
      const c = await open();
      await executeAsync(c, "SELECT 1");
    },

    async query(sql, _params, options) {
      if (cfg.readOnly) {
        const head = sql.trimStart().split(/\s+/)[0]?.toUpperCase() ?? "";
        const allowed = new Set([
          "SELECT",
          "WITH",
          "SHOW",
          "EXPLAIN",
          "DESCRIBE",
          "DESC",
        ]);
        if (!allowed.has(head)) {
          throw new Error("Connection is read-only");
        }
      }
      const c = await open();
      const timeoutMs = options?.timeoutMs ?? (cfg.queryTimeoutSec ?? 60) * 1000;
      const run = executeAsync(c, sql);
      const { columns, rows } = await Promise.race([
        run,
        new Promise<never>((_, rej) =>
          setTimeout(() => rej(new Error("Query timeout")), timeoutMs),
        ),
      ]);
      return {
        columns: columns.map((col) => ({ name: col.name, dataType: undefined })),
        rows,
        rowCount: rows.length,
        command: "QUERY",
      } satisfies QueryResult;
    },
  };
}
