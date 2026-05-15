/**
 * Query execution, explain, format, dry-run, cancel, history, autocomplete.
 */
import { Router } from "express";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { format } from "sql-formatter";
import sqlParser from "node-sql-parser";

const { Parser } = sqlParser as { Parser: new () => { astify: (sql: string, opt?: object) => unknown } };
import { splitSqlStatements } from "../util/sqlSplit.js";
import { dangerHints } from "../util/dangerSql.js";
import { getHandle } from "../registry/connectionRegistry.js";
import { getConnectionOr404 } from "./connections.js";
import { appendHistory, clearHistory, loadHistory } from "../store/queryHistory.js";
import { appendAudit } from "../store/auditLog.js";
import { HttpError } from "../http/HttpError.js";
import {
  listTables,
  listTablesSnowflake,
  sqliteListTables,
  dialectOf,
} from "../services/schemaService.js";

const bodySchema = z.object({
  connectionId: z.string().uuid(),
  database: z.string().optional(),
  sql: z.string().min(1),
  params: z.array(z.unknown()).optional(),
  tabId: z.string().optional(),
});

const cancelMap = new Map<string, { cancel: () => Promise<void> }>();

export const queryRouter = Router();

queryRouter.post("/", async (req, res, next) => {
  try {
    const body = bodySchema.parse(req.body);
    const cfg = getConnectionOr404(body.connectionId);
    if (!cfg) throw new HttpError(404, "Connection not found", "NOT_FOUND");
    const h = getHandle(body.connectionId);
    if (!h?.sql) {
      throw new HttpError(
        400,
        "SQL connection not active — open Connections and connect again",
        "NO_SQL",
      );
    }

    if (cfg.readOnly) {
      const upper = body.sql.trim().toUpperCase();
      if (!upper.startsWith("SELECT") && !upper.startsWith("EXPLAIN") && !upper.startsWith("WITH")) {
        throw new HttpError(403, "Connection is read-only — only SELECT queries are allowed", "READ_ONLY");
      }
    }

    const queryId = randomUUID();
    cancelMap.set(queryId, { cancel: () => h.sql?.cancel?.() ?? Promise.resolve() });

    const started = Date.now();
    const statements = splitSqlStatements(body.sql);
    const results: {
      columns: { name: string; dataType?: string }[];
      rows: Record<string, unknown>[];
      rowCount: number;
    }[] = [];

    try {
      for (const stmt of statements) {
        const r = await h.sql.query(stmt, body.params);
        results.push({
          columns: r.columns,
          rows: r.rows,
          rowCount: r.rowCount,
        });
      }
      const durationMs = Date.now() - started;
      appendHistory({
        id: randomUUID(),
        at: new Date().toISOString(),
        connectionId: body.connectionId,
        sql: body.sql.slice(0, 2000),
        durationMs,
        ok: true,
      });
      appendAudit({
        connectionId: body.connectionId,
        action: "QUERY",
        sql: body.sql.slice(0, 500),
        durationMs,
        rowsAffected: results.reduce((s, r) => s + r.rowCount, 0),
        ip: req.ip,
      });
      res.json({ queryId, durationMs, results, messages: [] });
    } catch (e) {
      appendHistory({
        id: randomUUID(),
        at: new Date().toISOString(),
        connectionId: body.connectionId,
        sql: body.sql.slice(0, 2000),
        durationMs: Date.now() - started,
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
      throw e;
    } finally {
      cancelMap.delete(queryId);
    }
  } catch (e) {
    next(e);
  }
});

queryRouter.delete("/cancel/:queryId", async (req, res, next) => {
  try {
    const h = cancelMap.get(req.params.queryId);
    if (!h) {
      res.json({ ok: false, message: "Unknown or completed query" });
      return;
    }
    await h.cancel();
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

queryRouter.post("/format", (req, res, next) => {
  try {
    const sql = z.string().parse(req.body?.sql);
    const dialect =
      req.body?.dialect === "mysql"
        ? "mysql"
        : req.body?.dialect === "sqlite"
          ? "sqlite"
          : "postgresql";
    const out = format(sql, { language: dialect });
    res.json({ sql: out });
  } catch (e) {
    next(e);
  }
});

queryRouter.post("/dry-run", (req, res) => {
  try {
    const sql = z.string().parse(req.body?.sql);
    const ast = new Parser().astify(sql, { database: "postgresql" });
    const hints = dangerHints(sql);
    res.json({ ok: true, ast, hints });
  } catch (e) {
    res.json({
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      hints: dangerHints(String(req.body?.sql ?? "")),
    });
  }
});

queryRouter.post("/explain", async (req, res, next) => {
  try {
    const body = bodySchema.parse(req.body);
    const h = getHandle(body.connectionId);
    if (!h?.sql) {
      throw new HttpError(
        400,
        "SQL connection not active — open Connections and connect again",
        "NO_SQL",
      );
    }
    const explainSql = `EXPLAIN ${body.sql}`;
    const r = await h.sql.query(explainSql, body.params);
    res.json({ plan: r });
  } catch (e) {
    next(e);
  }
});

queryRouter.get("/history", (_req, res) => {
  res.json({ history: loadHistory() });
});

queryRouter.delete("/history", (_req, res) => {
  clearHistory();
  res.status(204).end();
});

queryRouter.post("/autocomplete", async (req, res, next) => {
  try {
    const prefix = z.string().parse(req.body?.prefix ?? "");
    const connectionId = z.string().uuid().optional().parse(req.body?.connectionId);
    const schema = z.string().default("public").parse(req.body?.schema ?? "public");
    const kw = [
      "SELECT", "FROM", "WHERE", "JOIN", "LEFT", "INNER", "GROUP", "ORDER",
      "LIMIT", "INSERT", "UPDATE", "DELETE", "CREATE", "ALTER", "DROP",
    ]
      .filter((k) => k.startsWith(prefix.toUpperCase()))
      .map((k) => ({ kind: "keyword", label: k }));
    const tables: { kind: string; label: string }[] = [];
    if (connectionId) {
      const cfg = getConnectionOr404(connectionId);
      const h = getHandle(connectionId);
      if (cfg && h?.sql) {
        const d = dialectOf(cfg);
        const list =
          d === "sqlite"
            ? await sqliteListTables(h.sql)
            : d === "snowflake"
              ? await listTablesSnowflake(
                  h.sql,
                  cfg.database ?? "SNOWFLAKE",
                  schema,
                )
              : await listTables(h.sql, d, schema);
        for (const t of list) {
          if (t.name.toUpperCase().startsWith(prefix.toUpperCase())) {
            tables.push({ kind: "table", label: t.name });
          }
        }
      }
    }
    res.json({ suggestions: [...tables, ...kw].slice(0, 50) });
  } catch (e) {
    next(e);
  }
});
