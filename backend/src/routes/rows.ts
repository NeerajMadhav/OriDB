/**
 * Table row CRUD (SQL engines) — simplified identifier quoting.
 */
import { Router } from "express";
import { z } from "zod";
import { getHandle } from "../registry/connectionRegistry.js";
import { getConnectionOr404 } from "./connections.js";
import { dialectOf } from "../services/schemaService.js";
import { HttpError } from "../http/HttpError.js";

export const rowsRouter = Router({ mergeParams: true });

function qIdent(d: "pg" | "mysql" | "sqlite", name: string): string {
  if (d === "mysql") return `\`${name.replaceAll("`", "``")}\``;
  return `"${name.replaceAll('"', '""')}"`;
}

rowsRouter.get("/:connId/:table", async (req, res, next) => {
  try {
    const cfg = getConnectionOr404(req.params.connId);
    if (!cfg) throw new HttpError(404, "Connection not found", "NOT_FOUND");
    const h = getHandle(req.params.connId);
    if (!h?.sql) throw new HttpError(400, "Not a SQL connection", "NO_SQL");
    const dialect = dialectOf(cfg);
    const schema = z.string().default("public").parse(req.query.schema);
    const limit = z.coerce.number().min(1).max(5000).default(100).parse(req.query.limit);
    const offset = z.coerce.number().min(0).default(0).parse(req.query.offset);
    const table = req.params.table;
    const fq =
      dialect === "sqlite"
        ? qIdent(dialect, table)
        : `${qIdent(dialect, schema)}.${qIdent(dialect, table)}`;
    const r = await h.sql.query(`SELECT * FROM ${fq} LIMIT ${limit} OFFSET ${offset}`);
    res.json(r);
  } catch (e) {
    next(e);
  }
});

rowsRouter.post("/:connId/:table", async (req, res, next) => {
  try {
    const cfg = getConnectionOr404(req.params.connId);
    if (!cfg) throw new HttpError(404, "Connection not found", "NOT_FOUND");
    const h = getHandle(req.params.connId);
    if (!h?.sql) throw new HttpError(400, "Not a SQL connection", "NO_SQL");
    const dialect = dialectOf(cfg);
    const schema = z.string().default("public").parse(req.query.schema);
    const table = req.params.table;
    const row = z.record(z.unknown()).parse(req.body?.row ?? req.body);
    const cols = Object.keys(row);
    if (!cols.length) throw new HttpError(400, "Empty row", "EMPTY");
    const fq =
      dialect === "sqlite"
        ? qIdent(dialect, table)
        : `${qIdent(dialect, schema)}.${qIdent(dialect, table)}`;
    const placeholders =
      dialect === "pg"
        ? cols.map((_, i) => `$${i + 1}`).join(", ")
        : cols.map(() => "?").join(", ");
    const sql = `INSERT INTO ${fq} (${cols.map((c) => qIdent(dialect, c)).join(", ")}) VALUES (${placeholders})`;
    const vals = cols.map((c) => row[c]);
    const r = await h.sql.query(sql, vals);
    res.json(r);
  } catch (e) {
    next(e);
  }
});

rowsRouter.put("/:connId/:table/:id", async (req, res, next) => {
  try {
    const cfg = getConnectionOr404(req.params.connId);
    if (!cfg) throw new HttpError(404, "Connection not found", "NOT_FOUND");
    const h = getHandle(req.params.connId);
    if (!h?.sql) throw new HttpError(400, "Not a SQL connection", "NO_SQL");
    const dialect = dialectOf(cfg);
    const schema = z.string().default("public").parse(req.query.schema);
    const table = req.params.table;
    const pkCol = z.string().parse(req.query.pkColumn ?? "id");
    const row = z.record(z.unknown()).parse(req.body?.row ?? req.body);
    const fq =
      dialect === "sqlite"
        ? qIdent(dialect, table)
        : `${qIdent(dialect, schema)}.${qIdent(dialect, table)}`;
    const sets = Object.keys(row)
      .filter((c) => c !== pkCol)
      .map((c, i) => {
        const ph =
          dialect === "pg" ? `$${i + 1}` : "?";
        return `${qIdent(dialect, c)} = ${ph}`;
      });
    const vals = Object.keys(row)
      .filter((c) => c !== pkCol)
      .map((c) => row[c]);
    const pkPh = dialect === "pg" ? `$${vals.length + 1}` : "?";
    vals.push(req.params.id);
    const sql = `UPDATE ${fq} SET ${sets.join(", ")} WHERE ${qIdent(dialect, pkCol)} = ${pkPh}`;
    const r = await h.sql.query(sql, vals);
    res.json(r);
  } catch (e) {
    next(e);
  }
});

rowsRouter.delete("/:connId/:table", async (req, res, next) => {
  try {
    const cfg = getConnectionOr404(req.params.connId);
    if (!cfg) throw new HttpError(404, "Connection not found", "NOT_FOUND");
    const h = getHandle(req.params.connId);
    if (!h?.sql) throw new HttpError(400, "Not a SQL connection", "NO_SQL");
    const dialect = dialectOf(cfg);
    const schema = z.string().default("public").parse(req.query.schema);
    const table = req.params.table;
    const where = z.string().min(1).parse(req.query.where);
    const fq =
      dialect === "sqlite"
        ? qIdent(dialect, table)
        : `${qIdent(dialect, schema)}.${qIdent(dialect, table)}`;
    const r = await h.sql.query(`DELETE FROM ${fq} WHERE ${where}`);
    res.json(r);
  } catch (e) {
    next(e);
  }
});
