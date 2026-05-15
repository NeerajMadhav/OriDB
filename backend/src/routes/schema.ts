/**
 * Schema REST routes.
 */
import { Router } from "express";
import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import { getHandle } from "../registry/connectionRegistry.js";
import { getConnectionOr404 } from "./connections.js";
import { getOriDbHome } from "../paths/oridbHome.js";
import {
  approximateTableDdl,
  columnStats,
  dialectOf,
  erDiagram,
  listColumns,
  listConstraints,
  listDatabases,
  listFunctions,
  listIndexes,
  listProcedures,
  listSchemas,
  listTables,
  listTriggers,
  listViews,
  sqliteErDiagram,
  sqliteListColumns,
  sqliteListTables,
  tableStats,
} from "../services/schemaService.js";

import { HttpError } from "../http/HttpError.js";
import type { SqlDriver } from "../drivers/sqlTypes.js";

export const schemaRouter = Router({ mergeParams: true });

function requireSql(connId: string): SqlDriver {
  const h = getHandle(connId);
  if (!h?.sql) {
    throw new HttpError(400, "Not connected or not a SQL connection", "NO_SQL");
  }
  return h.sql;
}

schemaRouter.get("/:connId/databases", async (req, res, next) => {
  try {
    const cfg = getConnectionOr404(req.params.connId);
    if (!cfg) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Connection" } });
      return;
    }
    const sql = requireSql(req.params.connId);
    const d = dialectOf(cfg);
    if (d === "sqlite") {
      res.json({ databases: ["main"] });
      return;
    }
    const databases = await listDatabases(sql, d);
    res.json({ databases });
  } catch (e) {
    next(e);
  }
});

schemaRouter.get("/:connId", async (req, res, next) => {
  try {
    const cfg = getConnectionOr404(req.params.connId);
    if (!cfg) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Connection" } });
      return;
    }
    const sql = requireSql(req.params.connId);
    const d = dialectOf(cfg);
    if (d === "sqlite") {
      const tables = await sqliteListTables(sql);
      res.json({ engine: cfg.engine, schemas: ["main"], tables });
      return;
    }
    const schemas = await listSchemas(sql, d);
    res.json({ engine: cfg.engine, schemas });
  } catch (e) {
    next(e);
  }
});

schemaRouter.get("/:connId/tables", async (req, res, next) => {
  try {
    const cfg = getConnectionOr404(req.params.connId);
    if (!cfg) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Connection" } });
      return;
    }
    const schema = z.string().default("public").parse(req.query.schema);
    const sql = requireSql(req.params.connId);
    const d = dialectOf(cfg);
    if (d === "sqlite") {
      const tables = await sqliteListTables(sql);
      res.json({ tables });
      return;
    }
    const tables = await listTables(sql, d, schema);
    res.json({ tables });
  } catch (e) {
    next(e);
  }
});

schemaRouter.get("/:connId/tables/:table/columns", async (req, res, next) => {
  try {
    const cfg = getConnectionOr404(req.params.connId);
    if (!cfg) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Connection" } });
      return;
    }
    const schema = z.string().default("public").parse(req.query.schema);
    const table = req.params.table;
    const sql = requireSql(req.params.connId);
    const d = dialectOf(cfg);
    const columns =
      d === "sqlite"
        ? await sqliteListColumns(sql, table)
        : await listColumns(sql, d, schema, table);
    res.json({ columns });
  } catch (e) {
    next(e);
  }
});

schemaRouter.get("/:connId/tables/:table/indexes", async (req, res, next) => {
  try {
    const cfg = getConnectionOr404(req.params.connId);
    if (!cfg) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Connection" } });
      return;
    }
    const schema = z.string().default("public").parse(req.query.schema);
    const sql = requireSql(req.params.connId);
    const d = dialectOf(cfg);
    if (d === "sqlite") {
      const r = await sql.query(`PRAGMA index_list(${JSON.stringify(req.params.table)})`);
      res.json({ indexes: r.rows });
      return;
    }
    const indexes = await listIndexes(sql, d, schema, req.params.table);
    res.json({ indexes });
  } catch (e) {
    next(e);
  }
});

schemaRouter.get("/:connId/tables/:table/constraints", async (req, res, next) => {
  try {
    const cfg = getConnectionOr404(req.params.connId);
    if (!cfg) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Connection" } });
      return;
    }
    const schema = z.string().default("public").parse(req.query.schema);
    const sql = requireSql(req.params.connId);
    const d = dialectOf(cfg);
    if (d === "sqlite") {
      res.json({ constraints: [] });
      return;
    }
    const constraints = await listConstraints(sql, d, schema, req.params.table);
    res.json({ constraints });
  } catch (e) {
    next(e);
  }
});

schemaRouter.get("/:connId/tables/:table/ddl", async (req, res, next) => {
  try {
    const cfg = getConnectionOr404(req.params.connId);
    if (!cfg) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Connection" } });
      return;
    }
    const schema = z.string().default("public").parse(req.query.schema);
    const sql = requireSql(req.params.connId);
    const d = dialectOf(cfg);
    if (d === "sqlite") {
      const safeName = req.params.table.replaceAll("'", "''");
      const r = await sql.query(
        `SELECT sql FROM sqlite_master WHERE type='table' AND name='${safeName}'`,
      );
      const ddl = r.rows[0]?.sql ? String(r.rows[0].sql) : "";
      res.json({ ddl });
      return;
    }
    const ddl = await approximateTableDdl(sql, d, schema, req.params.table);
    res.json({ ddl });
  } catch (e) {
    next(e);
  }
});

schemaRouter.get("/:connId/tables/:table/stats", async (req, res, next) => {
  try {
    const cfg = getConnectionOr404(req.params.connId);
    if (!cfg) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Connection" } });
      return;
    }
    const schema = z.string().default("public").parse(req.query.schema);
    const sql = requireSql(req.params.connId);
    const d = dialectOf(cfg);
    const stats = await tableStats(sql, d, schema, req.params.table);
    res.json({ stats });
  } catch (e) {
    next(e);
  }
});

schemaRouter.get("/:connId/tables/:table/column-stats/:col", async (req, res, next) => {
  try {
    const cfg = getConnectionOr404(req.params.connId);
    if (!cfg) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Connection" } });
      return;
    }
    const schema = z.string().default("public").parse(req.query.schema);
    const sql = requireSql(req.params.connId);
    const d = dialectOf(cfg);
    const stats = await columnStats(sql, d, schema, req.params.table, req.params.col);
    res.json({ stats });
  } catch (e) {
    next(e);
  }
});

schemaRouter.get("/:connId/er-diagram", async (req, res, next) => {
  try {
    const cfg = getConnectionOr404(req.params.connId);
    if (!cfg) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Connection" } });
      return;
    }
    const schema = z.string().default("public").parse(req.query.schema);
    const sql = requireSql(req.params.connId);
    const d = dialectOf(cfg);
    if (d === "sqlite") {
      const diagram = await sqliteErDiagram(sql);
      res.json(diagram);
      return;
    }
    const diagram = await erDiagram(sql, d, schema);
    res.json(diagram);
  } catch (e) {
    next(e);
  }
});

schemaRouter.post("/:connId/refresh", async (req, res, next) => {
  try {
    getConnectionOr404(req.params.connId);
    const cacheDir = path.join(getOriDbHome(), "schema-cache", req.params.connId);
    if (fs.existsSync(cacheDir)) fs.rmSync(cacheDir, { recursive: true, force: true });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

schemaRouter.get("/:connId/views", async (req, res, next) => {
  try {
    const cfg = getConnectionOr404(req.params.connId);
    if (!cfg) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Connection" } });
      return;
    }
    const schema = z.string().default("public").parse(req.query.schema);
    const sql = requireSql(req.params.connId);
    const d = dialectOf(cfg);
    if (d === "sqlite") {
      const tables = await sqliteListTables(sql);
      res.json({
        views: tables.filter((t) => t.type === "view").map((t) => ({ name: t.name })),
      });
      return;
    }
    const views = await listViews(sql, d, schema);
    res.json({ views });
  } catch (e) {
    next(e);
  }
});

schemaRouter.get("/:connId/procedures", async (req, res, next) => {
  try {
    const cfg = getConnectionOr404(req.params.connId);
    if (!cfg) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Connection" } });
      return;
    }
    const schema = z.string().default("public").parse(req.query.schema);
    const sql = requireSql(req.params.connId);
    const d = dialectOf(cfg);
    if (d === "sqlite") {
      res.json({ procedures: [] });
      return;
    }
    const procedures = await listProcedures(sql, d, schema);
    res.json({ procedures });
  } catch (e) {
    next(e);
  }
});

schemaRouter.get("/:connId/functions", async (req, res, next) => {
  try {
    const cfg = getConnectionOr404(req.params.connId);
    if (!cfg) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Connection" } });
      return;
    }
    const schema = z.string().default("public").parse(req.query.schema);
    const sql = requireSql(req.params.connId);
    const d = dialectOf(cfg);
    if (d === "sqlite") {
      res.json({ functions: [] });
      return;
    }
    const functions = await listFunctions(sql, d, schema);
    res.json({ functions });
  } catch (e) {
    next(e);
  }
});

schemaRouter.get("/:connId/triggers", async (req, res, next) => {
  try {
    const cfg = getConnectionOr404(req.params.connId);
    if (!cfg) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Connection" } });
      return;
    }
    const schema = z.string().default("public").parse(req.query.schema);
    const sql = requireSql(req.params.connId);
    const d = dialectOf(cfg);
    if (d === "sqlite") {
      res.json({ triggers: [] });
      return;
    }
    const triggers = await listTriggers(sql, d, schema);
    res.json({ triggers });
  } catch (e) {
    next(e);
  }
});
