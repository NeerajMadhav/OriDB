/**
 * MySQL / MariaDB / PlanetScale driver.
 */
import mysql from "mysql2/promise";
import type { ConnectionConfig } from "../types/connection.js";
import type { SqlDriver } from "./sqlTypes.js";
import { defaultPortForEngine } from "../types/connection.js";

export function createMysqlDriver(cfg: ConnectionConfig): SqlDriver {
  const ok =
    cfg.engine === "mysql" ||
    cfg.engine === "mariadb" ||
    cfg.engine === "planetscale";
  if (!ok) throw new Error("createMysqlDriver: unsupported engine");

  let pool: mysql.Pool | null = null;

  const build = (): mysql.PoolOptions => ({
    host: cfg.host ?? "127.0.0.1",
    port: cfg.port ?? defaultPortForEngine("mysql"),
    database: cfg.database,
    user: cfg.username,
    password: cfg.password,
    ssl: cfg.ssl ? {} : undefined,
    connectionLimit: cfg.poolMax ?? 10,
    connectTimeout: (cfg.connectionTimeoutSec ?? 10) * 1000,
  });

  const ensure = (): mysql.Pool => {
    if (!pool) pool = mysql.createPool(build());
    return pool;
  };

  return {
    engine: cfg.engine,

    async test() {
      const start = Date.now();
      try {
        const p = mysql.createPool({ ...build(), connectionLimit: 1 });
        const c = await p.getConnection();
        await c.query("SELECT 1");
        c.release();
        await p.end();
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
      ensure();
    },

    async disconnect() {
      if (pool) {
        await pool.end();
        pool = null;
      }
    },

    async ping() {
      const p = ensure();
      const [rows] = await p.query("SELECT 1");
      void rows;
    },

    async query(sql, params, options) {
      if (cfg.readOnly) {
        const head = sql.trimStart().split(/\s+/)[0]?.toUpperCase() ?? "";
        const allowed = new Set([
          "SELECT",
          "WITH",
          "SHOW",
          "EXPLAIN",
          "TABLE",
          "VALUES",
        ]);
        if (!allowed.has(head)) {
          throw new Error("Connection is read-only");
        }
      }
      const p = ensure();
      const timeoutMs = options?.timeoutMs ?? (cfg.queryTimeoutSec ?? 30) * 1000;
      const run = p.query({ sql, values: params });
      const [rows, fields] = (await Promise.race([
        run,
        new Promise<never>((_, rej) =>
          setTimeout(() => rej(new Error("Query timeout")), timeoutMs),
        ),
      ])) as unknown as [
        mysql.RowDataPacket[] | mysql.ResultSetHeader,
        mysql.FieldPacket[] | undefined,
      ];

      if (Array.isArray(fields)) {
        const cols = fields.map((f) => ({
          name: f.name,
          dataType: String(f.columnType),
        }));
        const r = rows as Record<string, unknown>[];
        return {
          columns: cols,
          rows: r,
          rowCount: r.length,
          command: "QUERY",
        };
      }
      const okPacket = rows as mysql.ResultSetHeader;
      return {
        columns: [],
        rows: [],
        rowCount: okPacket.affectedRows ?? 0,
        command: "MUTATE",
      };
    },
  };
}
