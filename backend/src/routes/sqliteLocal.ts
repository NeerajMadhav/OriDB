/**
 * Local SQLite file workflows — open by path, upload copy, library listing.
 */
import { Router } from "express";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { z } from "zod";
import { HttpError } from "../http/HttpError.js";
import { ensureDir, getOriDbHome } from "../paths/oridbHome.js";
import { loadConnections, saveConnections } from "../store/connectionsStore.js";
import {
  sanitizeForApi,
  normalizeConnection,
} from "../util/connectionMerge.js";
import {
  isSqliteFilePath,
  resolveSqlitePath,
  sqliteDatabasesDir,
  suggestSqliteName,
} from "../util/sqlitePath.js";
import { createSqliteDriver } from "../drivers/sqlite.js";
import type { ConnectionConfig } from "../types/connection.js";
import { connectHandle } from "../registry/connectionRegistry.js";

ensureDir(sqliteDatabasesDir());
const upload = multer({
  dest: sqliteDatabasesDir(),
  limits: { fileSize: 2 * 1024 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (isSqliteFilePath(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error("File must be .db, .sqlite, or .sqlite3"));
    }
  },
});

export const sqliteLocalRouter = Router();

function findByResolvedPath(resolved: string): ConnectionConfig | undefined {
  return loadConnections().find(
    (c) =>
      c.engine === "sqlite" &&
      resolveSqlitePath(c.database ?? c.host ?? "") === resolved,
  );
}

async function testSqlitePath(resolved: string): Promise<void> {
  const cfg: ConnectionConfig = {
    id: randomUUID(),
    name: "test",
    engine: "sqlite",
    database: resolved,
  };
  const r = await createSqliteDriver(cfg).test();
  if (!r.ok) {
    throw new HttpError(
      400,
      r.error ?? "Cannot open SQLite file",
      "SQLITE_OPEN",
    );
  }
}

function upsertSqliteProfile(opts: {
  resolved: string;
  name?: string;
  readOnly?: boolean;
}): { connection: ConnectionConfig; created: boolean } {
  const resolved = opts.resolved;
  const existing = findByResolvedPath(resolved);
  if (existing) {
    const updated = normalizeConnection({
      ...existing,
      database: resolved,
      readOnly: opts.readOnly ?? existing.readOnly,
      name: opts.name?.trim() || existing.name,
    });
    const list = loadConnections().map((c) =>
      c.id === existing.id ? updated : c,
    );
    saveConnections(list);
    return { connection: updated, created: false };
  }

  const connection = normalizeConnection({
    id: randomUUID(),
    name: opts.name?.trim() || suggestSqliteName(resolved),
    engine: "sqlite",
    database: resolved,
    readOnly: opts.readOnly ?? false,
  });
  saveConnections([...loadConnections(), connection]);
  return { connection, created: true };
}

sqliteLocalRouter.post("/verify-path", (req, res, next) => {
  try {
    const { path: raw } = z.object({ path: z.string().min(1) }).parse(req.body);
    const resolved = resolveSqlitePath(raw);
    const exists = fs.existsSync(resolved);
    let stat: { size: number; mtime: string } | null = null;
    let isFile = false;
    if (exists) {
      const s = fs.statSync(resolved);
      isFile = s.isFile();
      stat = { size: s.size, mtime: s.mtime.toISOString() };
    }
    res.json({
      ok: isFile,
      resolvedPath: resolved,
      exists,
      stat,
      isSqliteName: isSqliteFilePath(resolved),
    });
  } catch (e) {
    next(e);
  }
});

sqliteLocalRouter.post("/open-path", async (req, res, next) => {
  try {
    const body = z
      .object({
        path: z.string().min(1),
        name: z.string().optional(),
        readOnly: z.boolean().optional(),
        connect: z.boolean().optional(),
      })
      .parse(req.body);

    const resolved = resolveSqlitePath(body.path);
    if (!fs.existsSync(resolved)) {
      throw new HttpError(404, `File not found: ${resolved}`, "NOT_FOUND");
    }
    if (!fs.statSync(resolved).isFile()) {
      throw new HttpError(400, "Path is not a file", "NOT_FILE");
    }
    if (!isSqliteFilePath(resolved)) {
      throw new HttpError(
        400,
        "File must end with .db, .sqlite, or .sqlite3",
        "BAD_EXT",
      );
    }

    await testSqlitePath(resolved);
    const { connection, created } = upsertSqliteProfile({
      resolved,
      name: body.name,
      readOnly: body.readOnly,
    });

    let connected = false;
    if (body.connect !== false) {
      await connectHandle(connection);
      connected = true;
    }

    res.status(created ? 201 : 200).json({
      connection: sanitizeForApi(connection),
      created,
      connected,
      resolvedPath: resolved,
    });
  } catch (e) {
    next(e);
  }
});

sqliteLocalRouter.post(
  "/upload",
  upload.single("file"),
  async (req, res, next) => {
    try {
      if (!req.file) {
        throw new HttpError(400, "No file uploaded", "NO_FILE");
      }
      const body = z
        .object({
          name: z.string().optional(),
          readOnly: z.coerce.boolean().optional(),
          connect: z.coerce.boolean().optional(),
          keepOriginalName: z.coerce.boolean().optional(),
        })
        .parse(req.body);

      const ext = path.extname(req.file.originalname) || ".db";
      const safeBase =
        path
          .basename(req.file.originalname, ext)
          .replace(/[^\w.-]+/g, "_")
          .slice(0, 60) || "database";
      const finalName = body.keepOriginalName
        ? `${safeBase}${ext}`
        : `${safeBase}-${randomUUID().slice(0, 8)}${ext}`;
      const dest = path.join(sqliteDatabasesDir(), finalName);

      if (fs.existsSync(dest)) {
        fs.unlinkSync(dest);
      }
      fs.renameSync(req.file.path, dest);
      const resolved = path.normalize(dest);

      await testSqlitePath(resolved);
      const { connection, created } = upsertSqliteProfile({
        resolved,
        name: body.name ?? suggestSqliteName(resolved),
        readOnly: body.readOnly,
      });

      let connected = false;
      if (body.connect !== false) {
        await connectHandle(connection);
        connected = true;
      }

      res.status(created ? 201 : 200).json({
        connection: sanitizeForApi(connection),
        created,
        connected,
        resolvedPath: resolved,
        storedIn: sqliteDatabasesDir(),
      });
    } catch (e) {
      if (req.file?.path && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
        } catch {
          /* ignore */
        }
      }
      next(e);
    }
  },
);

sqliteLocalRouter.get("/library", (_req, res) => {
  const dir = sqliteDatabasesDir();
  if (!fs.existsSync(dir)) {
    res.json({ directory: dir, files: [] });
    return;
  }
  const files = fs
    .readdirSync(dir)
    .filter((f) => isSqliteFilePath(f))
    .map((name) => {
      const full = path.join(dir, name);
      const st = fs.statSync(full);
      return {
        name,
        path: full,
        size: st.size,
        modified: st.mtime.toISOString(),
      };
    })
    .sort((a, b) => b.modified.localeCompare(a.modified));
  res.json({ directory: dir, files });
});

sqliteLocalRouter.get("/hints", (_req, res) => {
  res.json({
    databasesDir: sqliteDatabasesDir(),
    oridbHome: getOriDbHome(),
    cwd: process.cwd(),
    platform: process.platform,
    extensions: [".db", ".sqlite", ".sqlite3", ".db3"],
  });
});
