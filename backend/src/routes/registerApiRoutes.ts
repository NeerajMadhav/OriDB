/**
 * Mounts all /api routes for OriDB.
 */
import type { Express } from "express";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { connectionsRouter } from "./connections.js";
import { schemaRouter } from "./schema.js";
import { queryRouter } from "./query.js";
import { rowsRouter } from "./rows.js";
import { savedQueriesRouter } from "./savedQueries.js";
import { migrationsRouter } from "./migrations.js";
import { importExportRouter } from "./importExport.js";
import { monitorRouter } from "./monitor.js";
import { systemRouter } from "./system.js";
import { authRouter } from "./auth.js";
import { nosqlRouter } from "./nosql.js";
import { usersRouter } from "./users.js";
import { exportAuditCsv, listAudit } from "../store/auditLog.js";

const apiLimiter = rateLimit({
  windowMs: 60_000,
  max: 2000,
  standardHeaders: true,
  legacyHeaders: false,
});

export function registerApiRoutes(app: Express): void {
  const api = Router();
  api.use(apiLimiter);

  api.use("/connections", connectionsRouter);
  api.use("/schema", schemaRouter);
  api.use("/query", queryRouter);
  api.use("/rows", rowsRouter);
  api.use("/saved-queries", savedQueriesRouter);
  api.use("/migrations", migrationsRouter);
  api.use("/", importExportRouter);
  api.use("/monitor", monitorRouter);
  api.use("/system", systemRouter);
  api.use("/auth", authRouter);
  api.use("/users", usersRouter);
  api.use("/nosql", nosqlRouter);
  api.get("/audit-log", (req, res) => {
    const entries = listAudit({
      user: req.query.user ? String(req.query.user) : undefined,
      connectionId: req.query.connectionId ? String(req.query.connectionId) : undefined,
      action: req.query.action ? String(req.query.action) : undefined,
      q: req.query.q ? String(req.query.q) : undefined,
    });
    res.json({ entries, mode: process.env.ORIDB_MODE ?? "local" });
  });
  api.get("/audit-log/export", (_req, res) => {
    res.setHeader("Content-Type", "text/csv");
    res.send(exportAuditCsv());
  });

  app.use("/api", api);
}
