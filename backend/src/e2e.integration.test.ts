/**
 * End-to-end API smoke tests (SQLite temp file, no external DB).
 */
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import request from "supertest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { createApp } from "./http/createApp.js";

const require = createRequire(import.meta.url);
const sqliteAvailable = (() => {
  try {
    require.resolve("better-sqlite3");
    return true;
  } catch {
    return false;
  }
})();

const tmpDb = path.join(os.tmpdir(), `oridb-e2e-${Date.now()}.db`);

describe.runIf(sqliteAvailable)("OriDB E2E (SQLite)", () => {
  let app: ReturnType<typeof createApp>;
  let connId: string;

  beforeAll(() => {
    process.env.ORIDB_HOME = path.join(os.tmpdir(), `oridb-e2e-home-${Date.now()}`);
    fs.mkdirSync(process.env.ORIDB_HOME, { recursive: true });
    app = createApp();
  });

  afterAll(() => {
    try {
      fs.unlinkSync(tmpDb);
    } catch {
      /* ignore */
    }
  });

  it("GET /health", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("POST /api/connections creates SQLite profile", async () => {
    const res = await request(app)
      .post("/api/connections")
      .send({
        name: "E2E SQLite",
        engine: "sqlite",
        database: tmpDb,
      });
    expect(res.status).toBe(201);
    expect(res.body.connection.id).toBeDefined();
    connId = res.body.connection.id;
  });

  it("POST /api/connections/:id/connect", async () => {
    const res = await request(app).post(`/api/connections/${connId}/connect`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("GET /api/connections/:id/status", async () => {
    const res = await request(app).get(`/api/connections/${connId}/status`);
    expect(res.status).toBe(200);
    expect(res.body.connected).toBe(true);
  });

  it("POST /api/query runs DDL and SELECT", async () => {
    const ddl = await request(app)
      .post("/api/query")
      .send({
        connectionId: connId,
        sql: "CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY, name TEXT);",
      });
    expect(ddl.status).toBe(200);

    const ins = await request(app)
      .post("/api/query")
      .send({
        connectionId: connId,
        sql: "INSERT INTO items (name) VALUES ('alpha'), ('beta');",
      });
    expect(ins.status).toBe(200);

    const sel = await request(app)
      .post("/api/query")
      .send({
        connectionId: connId,
        sql: "SELECT * FROM items ORDER BY id;",
      });
    expect(sel.status).toBe(200);
    expect(sel.body.results[0].rows.length).toBeGreaterThanOrEqual(2);
  });

  it("POST /api/query/format", async () => {
    const res = await request(app)
      .post("/api/query/format")
      .send({ sql: "select 1", dialect: "sqlite" });
    expect(res.status).toBe(200);
    expect(res.body.sql.toLowerCase()).toContain("select");
  });

  it("POST /api/query/dry-run", async () => {
    const res = await request(app)
      .post("/api/query/dry-run")
      .send({ sql: "SELECT 1" });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("GET /api/schema/:connId/tables", async () => {
    const res = await request(app).get(`/api/schema/${connId}/tables`);
    expect(res.status).toBe(200);
    const names = res.body.tables.map((t: { name: string }) => t.name);
    expect(names).toContain("items");
  });

  it("GET /api/rows/:connId/items", async () => {
    const res = await request(app).get(`/api/rows/${connId}/items?limit=10`);
    expect(res.status).toBe(200);
    expect(res.body.rows.length).toBeGreaterThanOrEqual(1);
  });

  it("GET /api/query/history", async () => {
    const res = await request(app).get("/api/query/history");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.history)).toBe(true);
    expect(res.body.history.length).toBeGreaterThan(0);
  });

  it("POST /api/connections/sqlite/open-path opens existing file", async () => {
    const res = await request(app)
      .post("/api/connections/sqlite/open-path")
      .send({ path: tmpDb, name: "E2E File", connect: true });
    expect([200, 201]).toContain(res.status);
    expect(res.body.connection.engine).toBe("sqlite");
    expect(res.body.connected).toBe(true);
    expect(res.body.resolvedPath).toBe(path.normalize(tmpDb));
    const q = await request(app)
      .post("/api/query")
      .send({ connectionId: res.body.connection.id, sql: "SELECT COUNT(*) AS c FROM items" });
    expect(q.status).toBe(200);
    expect(Number(q.body.results[0].rows[0].c)).toBeGreaterThanOrEqual(1);
  });

  it("POST /api/connections/:id/disconnect", async () => {
    const res = await request(app).post(`/api/connections/${connId}/disconnect`);
    expect(res.status).toBe(200);
    const st = await request(app).get(`/api/connections/${connId}/status`);
    expect(st.body.connected).toBe(false);
  });
});
