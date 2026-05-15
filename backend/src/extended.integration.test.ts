/**
 * Extended integration tests — rows CRUD, schema metadata, saved queries, read-only.
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

describe.runIf(sqliteAvailable)("OriDB extended (SQLite)", () => {
  let app: ReturnType<typeof createApp>;
  let connId: string;
  let roConnId: string;
  const tmpDb = path.join(os.tmpdir(), `oridb-ext-${Date.now()}.db`);

  beforeAll(() => {
    process.env.ORIDB_HOME = path.join(os.tmpdir(), `oridb-ext-home-${Date.now()}`);
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

  it("setup connection and table", async () => {
    const create = await request(app)
      .post("/api/connections")
      .send({ name: "Ext SQLite", engine: "sqlite", database: tmpDb });
    expect(create.status).toBe(201);
    connId = create.body.connection.id;

    await request(app).post(`/api/connections/${connId}/connect`);

    await request(app).post("/api/query").send({
      connectionId: connId,
      sql: `CREATE TABLE pets (id INTEGER PRIMARY KEY, name TEXT NOT NULL, age INTEGER);
             INSERT INTO pets (name, age) VALUES ('cat', 3);`,
    });
  });

  it("GET table stats and columns", async () => {
    const stats = await request(app).get(`/api/schema/${connId}/tables/pets/stats`);
    expect(stats.status).toBe(200);
    expect(stats.body.stats.rowCount).toBeGreaterThanOrEqual(0);

    const cols = await request(app).get(`/api/schema/${connId}/tables/pets/columns`);
    expect(cols.status).toBe(200);
    expect(cols.body.columns.length).toBeGreaterThan(0);

    const ddl = await request(app).get(`/api/schema/${connId}/tables/pets/ddl`);
    expect(ddl.status).toBe(200);
    expect(String(ddl.body.ddl)).toContain("pets");
  });

  it("GET er-diagram for sqlite", async () => {
    const er = await request(app).get(`/api/schema/${connId}/er-diagram`);
    expect(er.status).toBe(200);
    expect(Array.isArray(er.body.nodes)).toBe(true);
  });

  it("POST row and PUT row", async () => {
    const ins = await request(app)
      .post(`/api/rows/${connId}/pets`)
      .send({ row: { name: "dog", age: 5 } });
    expect(ins.status).toBe(200);

    const list = await request(app).get(`/api/rows/${connId}/pets?limit=10`);
    expect(list.status).toBe(200);
    const row = list.body.rows.find((r: { name: string }) => r.name === "dog");
    expect(row).toBeDefined();

    const upd = await request(app)
      .put(`/api/rows/${connId}/pets/${row.id}?pkColumn=id`)
      .send({ row: { name: "doggo", age: 6 } });
    expect(upd.status).toBe(200);

    const after = await request(app).get(`/api/rows/${connId}/pets?limit=10`);
    const updated = after.body.rows.find((r: { id: number }) => r.id === row.id);
    expect(updated?.name).toBe("doggo");
  });

  it("saved queries CRUD and run", async () => {
    const create = await request(app)
      .post("/api/saved-queries")
      .send({
        name: "All pets",
        sql: "SELECT * FROM pets;",
        connectionId: connId,
      });
    expect(create.status).toBe(201);
    const qid = create.body.query.id;

    const folder = await request(app)
      .post("/api/saved-queries/folders")
      .send({ name: "Test folder" });
    expect(folder.status).toBe(201);

    const folders = await request(app).get("/api/saved-queries/folders");
    expect(folders.body.folders.length).toBeGreaterThan(0);

    const run = await request(app)
      .post(`/api/saved-queries/${qid}/run`)
      .send({ connectionId: connId });
    expect(run.status).toBe(200);
    expect(run.body.results[0].rows.length).toBeGreaterThan(0);
  });

  it("read-only connection rejects INSERT", async () => {
    const create = await request(app)
      .post("/api/connections")
      .send({
        name: "RO SQLite",
        engine: "sqlite",
        database: tmpDb,
        readOnly: true,
      });
    roConnId = create.body.connection.id;
    await request(app).post(`/api/connections/${roConnId}/connect`);

    const sel = await request(app).post("/api/query").send({
      connectionId: roConnId,
      sql: "SELECT * FROM pets;",
    });
    expect(sel.status).toBe(200);

    const ins = await request(app).post("/api/query").send({
      connectionId: roConnId,
      sql: "INSERT INTO pets (name, age) VALUES ('x', 1);",
    });
    expect(ins.status).toBe(403);
  });

  it("POST /api/query/autocomplete with tables", async () => {
    const res = await request(app)
      .post("/api/query/autocomplete")
      .send({ prefix: "p", connectionId: connId, schema: "main" });
    expect(res.status).toBe(200);
    const labels = res.body.suggestions.map((s: { label: string }) => s.label);
    expect(labels.some((l: string) => l.toLowerCase().includes("p"))).toBe(true);
  });
});
