/**
 * MySQL / MariaDB / PlanetScale driver.
 */
import mysql from "mysql2/promise";
import type { ConnectionConfig } from "../types/connection.js";
import type { SqlDriver } from "./sqlTypes.js";
import { defaultPortForEngine } from "../types/connection.js";
import { inferSslFromHostname } from "../util/parseConnectionUrl.js";
import { createSqlPoolSession } from "../util/sqlPoolSession.js";

function mysqlNeedsSsl(cfg: ConnectionConfig): boolean {
  if (cfg.ssl === true) return true;
  if (cfg.ssl === false) return false;
  if (cfg.engine === "planetscale") return true;
  if (cfg.host && inferSslFromHostname(cfg.host)) return true;
  return false;
}

function useMysqlUri(cfg: ConnectionConfig): boolean {
  if (!cfg.connectionUrl?.trim()) return false;
  if (cfg.host?.trim() && cfg.username?.trim()) return false;
  return true;
}

export function createMysqlDriver(cfg: ConnectionConfig): SqlDriver {
  const ok =
    cfg.engine === "mysql" ||
    cfg.engine === "mariadb" ||
    cfg.engine === "planetscale";
  if (!ok) throw new Error("createMysqlDriver: unsupported engine");

  let pool: mysql.Pool | null = null;
  const session = createSqlPoolSession();

  const build = (): mysql.PoolOptions => {
    const ssl = mysqlNeedsSsl(cfg) ? {} : undefined;
    const base = {
      ssl,
      connectionLimit: cfg.poolMax ?? 10,
      connectTimeout: (cfg.connectionTimeoutSec ?? 15) * 1000,
    };
    if (useMysqlUri(cfg)) {
      return { ...base, uri: cfg.connectionUrl!.trim() };
    }
    return {
      ...base,
      host: cfg.host ?? "127.0.0.1",
      port: cfg.port ?? defaultPortForEngine("mysql"),
      database: cfg.database,
      user: cfg.username,
      password: cfg.password,
    };
  };

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
      session.open();
      ensure();
    },

    async disconnect() {
      await session.close();
      if (pool) {
        await pool.end();
        pool = null;
      }
    },

    async ping() {
      await session.run(async () => {
        const p = ensure();
        const [rows] = await p.query("SELECT 1");
        void rows;
      });
    },

    async query(sql, params, options) {
      return session.run(async () => {
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
        const timeoutMs =
          options?.timeoutMs ?? (cfg.queryTimeoutSec ?? 30) * 1000;
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
      });
    },
  };
}
