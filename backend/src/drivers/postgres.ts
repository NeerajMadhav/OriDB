/**
 * PostgreSQL driver (also used for Neon, Supabase, CockroachDB).
 */
import pg from "pg";
import type { ConnectionConfig } from "../types/connection.js";
import type { SqlDriver } from "./sqlTypes.js";
import { buildPgPoolConfig } from "../util/pgConnection.js";
import { createSqlPoolSession } from "../util/sqlPoolSession.js";

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
  const session = createSqlPoolSession();

  const buildConfig = (): pg.PoolConfig => buildPgPoolConfig(cfg);

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
      session.open();
      ensurePool();
    },

    async disconnect() {
      await session.close();
      if (pool) {
        await pool.end();
        pool = null;
      }
      activePid = null;
    },

    async ping() {
      await session.run(async () => {
        const p = ensurePool();
        await p.query("SELECT 1");
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
        const p = ensurePool();
        const timeoutMs =
          options?.timeoutMs ?? (cfg.queryTimeoutSec ?? 30) * 1000;
        const client = await p.connect();
        try {
          await client.query(
            `SET statement_timeout TO ${Math.max(1, timeoutMs)}`,
          );
          const pidRes = await client.query<{ pid: string }>(
            "SELECT pg_backend_pid()::text AS pid",
          );
          activePid = Number(pidRes.rows[0]?.pid);
          const res = await client.query({
            text: sql,
            values: params as never[] | undefined,
          });
          const fields = res.fields ?? [];
          const columns = fields.map(
            (f: { name: string; dataTypeID: number }) => ({
              name: f.name,
              dataType: mapPgType(f.dataTypeID),
            }),
          );
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
      });
    },

    async cancel() {
      const p = pool;
      const pid = activePid;
      if (!p || pid == null || !Number.isFinite(pid)) return;
      try {
        await session.run(async () => {
          const killer = await p.connect();
          try {
            await killer.query("SELECT pg_cancel_backend($1::int)", [pid]);
          } finally {
            killer.release();
          }
        });
      } catch {
        /* ignore */
      }
    },
  };
}
