/**
 * MongoDB driver — collections and basic find/aggregate.
 */
import { MongoClient, type Document } from "mongodb";
import type { ConnectionConfig } from "../types/connection.js";

export type MongoDriver = {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  ping(): Promise<void>;
  listDatabases(): Promise<string[]>;
  listCollections(dbName: string): Promise<string[]>;
  find(
    dbName: string,
    coll: string,
    filter: Document,
    opts: { limit?: number; projection?: Document; sort?: Document },
  ): Promise<Document[]>;
  aggregate(
    dbName: string,
    coll: string,
    pipeline: Document[],
  ): Promise<Document[]>;
};

function buildMongoUri(c: ConnectionConfig): string {
  if (c.connectionUrl?.trim()) return c.connectionUrl.trim();
  const host = c.host ?? "127.0.0.1";
  const port = c.port ?? 27017;
  const user = c.username ? encodeURIComponent(c.username) : "";
  const pass = c.password ? encodeURIComponent(c.password) : "";
  const auth =
    user || pass ? `${user}${pass ? `:${pass}` : ""}@` : "";
  const db = c.database ? `/${encodeURIComponent(c.database)}` : "";
  return `mongodb://${auth}${host}:${port}${db}`;
}

export function createMongoDriver(cfg: ConnectionConfig): MongoDriver {
  if (cfg.engine !== "mongodb") throw new Error("Mongo only");

  const uri = buildMongoUri(cfg);
  let client: MongoClient | null = null;

  return {
    async connect() {
      client = new MongoClient(uri);
      await client.connect();
    },
    async disconnect() {
      if (client) await client.close();
      client = null;
    },
    async ping() {
      if (!client) throw new Error("not connected");
      await client.db("admin").command({ ping: 1 });
    },
    async listDatabases() {
      if (!client) throw new Error("not connected");
      const d = await client.db().admin().listDatabases();
      return d.databases.map((x) => x.name);
    },
    async listCollections(dbName: string) {
      if (!client) throw new Error("not connected");
      const cols = await client.db(dbName).listCollections().toArray();
      return cols.map((c) => c.name);
    },
    async find(dbName, coll, filter, opts) {
      if (!client) throw new Error("not connected");
      const cur = client
        .db(dbName)
        .collection(coll)
        .find(filter, {
          limit: opts.limit ?? 200,
          projection: opts.projection,
          sort: opts.sort,
        });
      return cur.toArray();
    },
    async aggregate(dbName, coll, pipeline) {
      if (!client) throw new Error("not connected");
      return client
        .db(dbName)
        .collection(coll)
        .aggregate(pipeline)
        .toArray();
    },
  };
}
