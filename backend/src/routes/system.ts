/**
 * System info, logs stub, restart, cache clear.
 */
import { Router } from "express";
import fs from "node:fs";
import { oridbFile } from "../paths/oridbHome.js";

export const systemRouter = Router();

systemRouter.get("/info", (_req, res) => {
  res.json({
    version: process.env.npm_package_version ?? "1.0.0",
    mode: process.env.ORIDB_MODE ?? "local",
    node: process.version,
    drivers: ["pg", "mysql2", "better-sqlite3", "mongodb", "ioredis"],
  });
});

systemRouter.get("/logs", (_req, res) => {
  res.json({ lines: [] });
});

systemRouter.post("/restart", (_req, res) => {
  res.json({ ok: true, message: "Manual restart required" });
});

systemRouter.delete("/cache", (_req, res) => {
  try {
    const p = oridbFile("schema-cache");
    if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
  res.json({ ok: true });
});
