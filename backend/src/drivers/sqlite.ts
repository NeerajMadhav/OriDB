/**
 * SQLite driver using better-sqlite3 when available.
 */
import type { ConnectionConfig } from "../types/connection.js";
import type { QueryColumn, SqlDriver } from "./sqlTypes.js";

type BetterDb = {
  prepare: (sql: string) => {
    all: (...params: unknown[]) => Record<string, unknown>[];
    run: (...params: unknown[]) => { changes: number };
  };
  exec: (sql: string) => void;
  close: () => void;
};

async function loadBetterSqlite(): Promise<{
  default: new (path: string, opts?: object) => BetterDb;
}> {
  return import("better-sqlite3") as Promise<{
    default: new (path: string, opts?: object) => BetterDb;
  }>;
}

export function createSqliteDriver(cfg: ConnectionConfig): SqlDriver {
  if (cfg.engine !== "sqlite") throw new Error("createSqliteDriver: wrong engine");

  let db: BetterDb | null = null;

  const path = cfg.database ?? cfg.host;
  if (!path) throw new Error("SQLite requires database file path");

  return {
    engine: "sqlite",

    async test() {
      const start = Date.now();
      try {
        const Database = (await loadBetterSqlite()).default;
        const t = new Database(path, { readonly: true });
        t.prepare("SELECT 1").all();
        t.close();
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
      const Database = (await loadBetterSqlite()).default;
      const readOnly = cfg.readOnly === true;
      db = new Database(path, { readonly: readOnly }) as unknown as BetterDb;
    },

    async disconnect() {
      db?.close();
      db = null;
    },

    async ping() {
      if (!db) throw new Error("not connected");
      db.prepare("SELECT 1").all();
    },

    async query(sql, params) {
      if (!db) throw new Error("not connected");
      if (cfg.readOnly) {
        const head = sql.trimStart().slice(0, 20).toUpperCase();
        if (!head.startsWith("SELECT") && !head.startsWith("PRAGMA")) {
          throw new Error("Connection is read-only");
        }
      }
      const stmt = db.prepare(sql);
      const isSelect =
        sql.trimStart().toUpperCase().startsWith("SELECT") ||
        sql.trimStart().toUpperCase().startsWith("PRAGMA");
      if (isSelect) {
        const rows = stmt.all(...(params ?? [])) as Record<string, unknown>[];
        const columns: QueryColumn[] =
          rows[0] != null
            ? Object.keys(rows[0]).map((name) => ({ name }))
            : [];
        return {
          columns,
          rows,
          rowCount: rows.length,
          command: "SELECT",
        };
      }
      const run = stmt.run(...(params ?? []));
      return {
        columns: [],
        rows: [],
        rowCount: run.changes,
        command: "MUTATE",
      };
    },
  };
}
