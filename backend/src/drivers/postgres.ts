/**
 * PostgreSQL driver (also used for Neon, Supabase, CockroachDB).
 */
import pg from "pg";
import type { ConnectionConfig } from "../types/connection.js";
import type { SqlDriver } from "./sqlTypes.js";
import { defaultPortForEngine } from "../types/connection.js";

function mapPgType(oid: number): string | undefined {
  const oids: Record<number, string> = {
    16: "boolean",
    20: "bigint",
    21: "smallint",
    23: "integer",
    700: "real",
    701: "double precision",
    1043: "varchar",
    25: "text",
    1082: "date",
    1114: "timestamp",
    1184: "timestamptz",
    114: "json",
    3802: "jsonb",
  };
  return oids[oid];
}

export function createPostgresDriver(cfg: ConnectionConfig): SqlDriver {
  const isPgLike =
    cfg.engine === "postgresql" ||
    cfg.engine === "cockroachdb" ||
    cfg.engine === "neon" ||
    cfg.engine === "supabase";

  if (!isPgLike) {
    throw new Error("createPostgresDriver: unsupported engine");
  }

  let pool: pg.Pool | null = null;
  let activePid: number | null = null;

  const buildConfig = (): pg.PoolConfig => {
    const host = cfg.host ?? "127.0.0.1";
    const port = cfg.port ?? defaultPortForEngine("postgresql");
    const database = cfg.database ?? "postgres";
    const user = cfg.username ?? "postgres";
    const password = cfg.password ?? "";
    const ssl =
      cfg.ssl === true ? { rejectUnauthorized: false } : false;
    const max = cfg.poolMax ?? 10;
    const min = cfg.poolMin ?? 0;
    const connectionTimeoutMillis = (cfg.connectionTimeoutSec ?? 10) * 1000;
    return {
      host,
      port,
      database,
      user,
      password,
      ssl,
      max,
      min,
      connectionTimeoutMillis,
      idleTimeoutMillis: 30_000,
    };
  };

  const ensurePool = (): pg.Pool => {
    if (!pool) pool = new pg.Pool(buildConfig());
    return pool;
  };

  return {
    engine: cfg.engine,

    async test() {
      const start = Date.now();
      try {
        const p = new pg.Pool({ ...buildConfig(), max: 1 });
        const c = await p.connect();
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
      ensurePool();
    },

    async disconnect() {
      if (pool) {
        await pool.end();
        pool = null;
      }
      activePid = null;
    },

    async ping() {
      const p = ensurePool();
      await p.query("SELECT 1");
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
      const p = ensurePool();
      const timeoutMs = options?.timeoutMs ?? (cfg.queryTimeoutSec ?? 30) * 1000;
      const client = await p.connect();
      try {
        await client.query(`SET statement_timeout TO ${Math.max(1, timeoutMs)}`);
        const pidRes = await client.query<{ pid: string }>(
          "SELECT pg_backend_pid()::text AS pid",
        );
        activePid = Number(pidRes.rows[0]?.pid);
        const res = await client.query({
          text: sql,
          values: params as never[] | undefined,
        });
        const fields = res.fields ?? [];
        const columns = fields.map((f: { name: string; dataTypeID: number }) => ({
          name: f.name,
          dataType: mapPgType(f.dataTypeID),
        }));
        const rows = (res.rows as Record<string, unknown>[]) ?? [];
        return {
          columns,
          rows,
          rowCount: res.rowCount ?? rows.length,
          command: res.command ?? "",
        };
      } finally {
        activePid = null;
        client.release();
      }
    },

    async cancel() {
      const p = pool;
      const pid = activePid;
      if (!p || pid == null || !Number.isFinite(pid)) return;
      try {
        const killer = await p.connect();
        try {
          await killer.query("SELECT pg_cancel_backend($1::int)", [pid]);
        } finally {
          killer.release();
        }
      } catch {
        /* ignore */
      }
    },
  };
}
