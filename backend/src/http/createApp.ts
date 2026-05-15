/**
 * Express application factory for OriDB API and static SPA.
 */
import express from "express";
import cors from "cors";
import compression from "compression";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { registerApiRoutes } from "../routes/registerApiRoutes.js";
import { errorHandler } from "./errorHandler.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp(): express.Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(compression());
  app.use(
    cors({
      origin: process.env.ORIDB_CORS_ORIGIN?.split(",") ?? true,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "4mb" }));

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      version: process.env.npm_package_version ?? "1.0.0",
      uptime: Math.round(process.uptime()),
    });
  });

  registerApiRoutes(app);

  app.use("/api", (_req, res) => {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "API route not found" } });
  });

  const staticDir = path.resolve(__dirname, "../../../frontend/dist");
  if (
    process.env.NODE_ENV === "production" &&
    fs.existsSync(path.join(staticDir, "index.html"))
  ) {
    app.use(express.static(staticDir));
    app.get("/{*splat}", (_req, res) => {
      res.sendFile(path.join(staticDir, "index.html"));
    });
  }

  app.use(errorHandler);
  return app;
}
