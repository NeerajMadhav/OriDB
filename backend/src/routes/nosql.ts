/**
 * MongoDB / Redis helper routes beyond SQL schema.
 */
import { Router } from "express";
import { z } from "zod";
import { getHandle } from "../registry/connectionRegistry.js";
import { getConnectionOr404 } from "./connections.js";
import { HttpError } from "../http/HttpError.js";

export const nosqlRouter = Router();

nosqlRouter.get("/:connId/mongo/databases", async (req, res, next) => {
  try {
    const cfg = getConnectionOr404(req.params.connId);
    if (!cfg) throw new HttpError(404, "Not found", "NOT_FOUND");
    const h = getHandle(req.params.connId);
    if (!h?.mongo) throw new HttpError(400, "Not MongoDB", "NO_MONGO");
    const dbs = await h.mongo.listDatabases();
    res.json({ databases: dbs });
  } catch (e) {
    next(e);
  }
});

nosqlRouter.get("/:connId/mongo/collections", async (req, res, next) => {
  try {
    const db = z.string().default("test").parse(req.query.db);
    const cfg = getConnectionOr404(req.params.connId);
    if (!cfg) throw new HttpError(404, "Not found", "NOT_FOUND");
    const h = getHandle(req.params.connId);
    if (!h?.mongo) throw new HttpError(400, "Not MongoDB", "NO_MONGO");
    const cols = await h.mongo.listCollections(db);
    res.json({ collections: cols });
  } catch (e) {
    next(e);
  }
});

nosqlRouter.post("/:connId/mongo/find", async (req, res, next) => {
  try {
    const body = z
      .object({
        db: z.string(),
        collection: z.string(),
        filter: z.record(z.unknown()).default({}),
        limit: z.number().optional(),
      })
      .parse(req.body);
    const h = getHandle(req.params.connId);
    if (!h?.mongo) throw new HttpError(400, "Not MongoDB", "NO_MONGO");
    const docs = await h.mongo.find(body.db, body.collection, body.filter, {
      limit: body.limit ?? 100,
    });
    res.json({ documents: docs });
  } catch (e) {
    next(e);
  }
});

nosqlRouter.get("/:connId/redis/keys", async (req, res, next) => {
  try {
    const pattern = z.string().default("*").parse(req.query.pattern);
    const h = getHandle(req.params.connId);
    if (!h?.redis) throw new HttpError(400, "Not Redis", "NO_REDIS");
    const keys = await h.redis.scanKeys(pattern);
    res.json({ keys });
  } catch (e) {
    next(e);
  }
});

nosqlRouter.get("/:connId/redis/string/:key", async (req, res, next) => {
  try {
    const h = getHandle(req.params.connId);
    if (!h?.redis) throw new HttpError(400, "Not Redis", "NO_REDIS");
    const key = decodeURIComponent(req.params.key);
    const val = await h.redis.get(key);
    const typ = await h.redis.type(key);
    const ttl = await h.redis.ttl(key);
    res.json({ key, type: typ, value: val, ttl });
  } catch (e) {
    next(e);
  }
});

nosqlRouter.get("/:connId/redis/info", async (req, res, next) => {
  try {
    const h = getHandle(req.params.connId);
    if (!h?.redis) throw new HttpError(400, "Not Redis", "NO_REDIS");
    const info = await h.redis.info();
    res.json({ info });
  } catch (e) {
    next(e);
  }
});
