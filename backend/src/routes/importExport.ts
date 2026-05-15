/**
 * Import / export job API — streaming CSV import, ZIP export.
 */
import { Router } from "express";
import multer from "multer";
import path from "node:path";
import { z } from "zod";
import fs from "node:fs";
import {
  cancelJob,
  getJob,
  listExportJobs,
  startExportJob,
  startImportJob,
} from "../services/jobQueue.js";
import { ensureDir, getOriDbHome } from "../paths/oridbHome.js";

const uploadDir = path.join(getOriDbHome(), "uploads");
ensureDir(uploadDir);

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 1024 * 1024 * 1024 },
});

export const importExportRouter = Router();

importExportRouter.post("/import", upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: { code: "NO_FILE", message: "file required" } });
      return;
    }
    const body = z
      .object({
        connectionId: z.string().uuid(),
        table: z.string().min(1),
        schema: z.string().optional(),
        hasHeader: z.coerce.boolean().optional(),
      })
      .parse(req.body);
    const jobId = startImportJob({
      connectionId: body.connectionId,
      table: body.table,
      filePath: req.file.path,
      schema: body.schema,
      hasHeader: body.hasHeader,
    });
    res.status(202).json({ jobId });
  } catch (e) {
    res.status(400).json({
      error: { code: "BAD_REQUEST", message: e instanceof Error ? e.message : String(e) },
    });
  }
});

importExportRouter.get("/import/:jobId/status", (req, res) => {
  const j = getJob(req.params.jobId);
  if (!j || j.kind !== "import") {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Job" } });
    return;
  }
  res.json(j);
});

importExportRouter.delete("/import/:jobId", (req, res) => {
  cancelJob(req.params.jobId);
  res.status(204).end();
});

importExportRouter.post("/export", (req, res) => {
  try {
    const body = z
      .object({
        connectionId: z.string().uuid(),
        tables: z.array(z.string().min(1)).min(1),
        schema: z.string().optional(),
      })
      .parse(req.body);
    const jobId = startExportJob({
      connectionId: body.connectionId,
      tables: body.tables,
      schema: body.schema,
    });
    res.status(202).json({ jobId });
  } catch (e) {
    res.status(400).json({
      error: { code: "BAD_REQUEST", message: e instanceof Error ? e.message : String(e) },
    });
  }
});

importExportRouter.get("/export", (_req, res) => {
  res.json({ jobs: listExportJobs() });
});

importExportRouter.get("/export/:jobId/status", (req, res) => {
  const j = getJob(req.params.jobId);
  if (!j || j.kind !== "export") {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Job" } });
    return;
  }
  res.json(j);
});

importExportRouter.get("/export/:jobId/download", (req, res) => {
  const j = getJob(req.params.jobId);
  if (!j?.filePath || j.status !== "done" || !fs.existsSync(j.filePath)) {
    res.status(404).json({ error: { code: "NOT_READY", message: "Export not ready" } });
    return;
  }
  res.download(j.filePath, `oridb-export-${req.params.jobId}.zip`);
});
