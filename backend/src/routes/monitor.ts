/**
 * Monitoring endpoints — Postgres-first with SQLite/MySQL fallbacks.
 */
import { Router } from "express";
import { getHandle } from "../registry/connectionRegistry.js";
import { getConnectionOr404 } from "./connections.js";
import { dialectOf, listTables } from "../services/schemaService.js";
import { HttpError } from "../http/HttpError.js";
import { loadHistory } from "../store/queryHistory.js";

export const monitorRouter = Router({ mergeParams: true });

monitorRouter.get("/:connId/overview", async (req, res, next) => {
  try {
    const cfg = getConnectionOr404(req.params.connId);
    if (!cfg) throw new HttpError(404, "Not found", "NOT_FOUND");
    const h = getHandle(req.params.connId);
    if (!h?.sql) throw new HttpError(400, "Not SQL", "NO_SQL");
    const d = dialectOf(cfg);
    const history = loadHistory().filter((x) => x.connectionId === req.params.connId);
    const today = history.filter((x) => x.at.startsWith(new Date().toISOString().slice(0, 10)));
    const avgMs =
      today.length > 0
        ? Math.round(today.reduce((s, x) => s + x.durationMs, 0) / today.length)
        : 0;
    const slowest = today.reduce(
      (best, x) => (x.durationMs > (best?.durationMs ?? 0) ? x : best),
      today[0],
    );
    const errors = today.filter((x) => !x.ok).length;
    let databaseBytes = 0;
    if (d === "pg") {
      const size = await h.sql.query(`SELECT pg_database_size(current_database()) AS bytes`);
      databaseBytes = Number(size.rows[0]?.bytes ?? 0);
    }
    res.json({
      overview: {
        engine: cfg.engine,
        databaseBytes,
        queriesToday: today.length,
        avgQueryMs: avgMs,
        slowestQueryMs: slowest?.durationMs ?? 0,
        errorRate: today.length ? errors / today.length : 0,
        poolMin: cfg.poolMin ?? 2,
        poolMax: cfg.poolMax ?? 10,
      },
    });
  } catch (e) {
    next(e);
  }
});

monitorRouter.get("/:connId/queries/active", async (req, res, next) => {
  try {
    const cfg = getConnectionOr404(req.params.connId);
    if (!cfg) throw new HttpError(404, "Not found", "NOT_FOUND");
    const h = getHandle(req.params.connId);
    if (!h?.sql) throw new HttpError(400, "Not SQL", "NO_SQL");
    if (dialectOf(cfg) !== "pg") {
      res.json({ queries: [] });
      return;
    }
    const r = await h.sql.query(
      `SELECT pid, usename, datname, LEFT(query, 200) AS query, state,
              EXTRACT(EPOCH FROM (NOW() - query_start)) * 1000 AS duration_ms,
              wait_event_type AS wait_event
       FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid()
       ORDER BY query_start`,
    );
    res.json({ queries: r.rows });
  } catch (e) {
    next(e);
  }
});

monitorRouter.delete("/:connId/queries/:pid", async (req, res, next) => {
  try {
    const cfg = getConnectionOr404(req.params.connId);
    if (!cfg) throw new HttpError(404, "Not found", "NOT_FOUND");
    const h = getHandle(req.params.connId);
    if (!h?.sql) throw new HttpError(400, "Not SQL", "NO_SQL");
    const pid = Number(req.params.pid);
    await h.sql.query(`SELECT pg_terminate_backend($1::int)`, [pid]);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

monitorRouter.get("/:connId/queries/slow", async (req, res, next) => {
  try {
    const threshold = Number(req.query.thresholdMs ?? 1000);
    const history = loadHistory()
      .filter((x) => x.connectionId === req.params.connId && x.durationMs >= threshold)
      .slice(0, 100)
      .map((x) => ({
        query: x.sql.slice(0, 200),
        durationMs: x.durationMs,
        at: x.at,
        ok: x.ok,
      }));
    res.json({ slow: history });
  } catch (e) {
    next(e);
  }
});

monitorRouter.get("/:connId/queries/locks", async (req, res, next) => {
  try {
    const cfg = getConnectionOr404(req.params.connId);
    if (!cfg) throw new HttpError(404, "Not found", "NOT_FOUND");
    const h = getHandle(req.params.connId);
    if (!h?.sql) throw new HttpError(400, "Not SQL", "NO_SQL");
    if (dialectOf(cfg) !== "pg") {
      res.json({ locks: [] });
      return;
    }
    const r = await h.sql.query(
      `SELECT blocked.pid AS blocked_pid, blocked.query AS blocked_query,
              blocking.pid AS blocking_pid, blocking.query AS blocking_query
       FROM pg_stat_activity blocked
       JOIN pg_locks blocked_locks ON blocked.pid = blocked_locks.pid
       JOIN pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype
         AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
         AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
         AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
         AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
         AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
         AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
         AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
         AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
         AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
         AND blocking_locks.pid <> blocked_locks.pid
       JOIN pg_stat_activity blocking ON blocking.pid = blocking_locks.pid
       WHERE NOT blocked_locks.granted`,
    );
    res.json({ locks: r.rows });
  } catch (e) {
    next(e);
  }
});

monitorRouter.get("/:connId/indexes/usage", async (req, res, next) => {
  try {
    const cfg = getConnectionOr404(req.params.connId);
    if (!cfg) throw new HttpError(404, "Not found", "NOT_FOUND");
    const h = getHandle(req.params.connId);
    if (!h?.sql) throw new HttpError(400, "Not SQL", "NO_SQL");
    if (dialectOf(cfg) !== "pg") {
      res.json({ indexes: [] });
      return;
    }
    const schema = String(req.query.schema ?? "public");
    const r = await h.sql.query(
      `SELECT schemaname AS schema, relname AS table, indexrelname AS index_name,
              idx_scan AS scans, idx_tup_read AS rows_read, idx_tup_fetch AS rows_fetched,
              pg_relation_size(indexrelid) AS size_bytes
       FROM pg_stat_user_indexes
       WHERE schemaname = $1
       ORDER BY idx_scan DESC`,
      [schema],
    );
    res.json({ indexes: r.rows });
  } catch (e) {
    next(e);
  }
});

monitorRouter.get("/:connId/indexes/missing", async (req, res, next) => {
  try {
    const cfg = getConnectionOr404(req.params.connId);
    if (!cfg) throw new HttpError(404, "Not found", "NOT_FOUND");
    const h = getHandle(req.params.connId);
    if (!h?.sql) throw new HttpError(400, "Not SQL", "NO_SQL");
    if (dialectOf(cfg) !== "pg") {
      res.json({ suggestions: [] });
      return;
    }
    const schema = String(req.query.schema ?? "public");
    const r = await h.sql.query(
      `SELECT schemaname AS schema, relname AS table, seq_scan, seq_tup_read, idx_scan
       FROM pg_stat_user_tables
       WHERE schemaname = $1 AND seq_scan > 1000 AND seq_tup_read > idx_scan
       ORDER BY seq_tup_read DESC
       LIMIT 20`,
      [schema],
    );
    res.json({
      suggestions: r.rows.map((row) => ({
        table: row.table,
        reason: "High sequential scan volume — consider an index on frequently filtered columns",
        seqScan: row.seq_scan,
      })),
    });
  } catch (e) {
    next(e);
  }
});

monitorRouter.get("/:connId/tables/bloat", async (req, res, next) => {
  try {
    const cfg = getConnectionOr404(req.params.connId);
    if (!cfg) throw new HttpError(404, "Not found", "NOT_FOUND");
    const h = getHandle(req.params.connId);
    if (!h?.sql) throw new HttpError(400, "Not SQL", "NO_SQL");
    const d = dialectOf(cfg);
    const schema = String(req.query.schema ?? "public");
    if (d === "pg") {
      const r = await h.sql.query(
        `SELECT relname AS table, n_dead_tup AS dead_tuples, n_live_tup AS live_tuples,
                last_vacuum, last_autovacuum
         FROM pg_stat_user_tables WHERE schemaname = $1 ORDER BY n_dead_tup DESC`,
        [schema],
      );
      res.json({ tables: r.rows });
      return;
    }
    const tables = await listTables(h.sql, d === "mysql" ? "mysql" : "pg", schema);
    res.json({
      tables: tables.slice(0, 20).map((t) => ({ table: t.name, dead_tuples: null })),
    });
  } catch (e) {
    next(e);
  }
});

monitorRouter.post("/:connId/tables/:table/vacuum", async (req, res, next) => {
  try {
    const cfg = getConnectionOr404(req.params.connId);
    if (!cfg) throw new HttpError(404, "Not found", "NOT_FOUND");
    const h = getHandle(req.params.connId);
    if (!h?.sql) throw new HttpError(400, "Not SQL", "NO_SQL");
    const schema = String(req.query.schema ?? "public");
    await h.sql.query(
      `VACUUM ANALYZE "${schema.replaceAll('"', '""')}"."${req.params.table.replaceAll('"', '""')}"`,
    );
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});
