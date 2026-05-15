/**
 * Users API (web mode).
 */
import { Router } from "express";
import fs from "node:fs";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { ensureDir, getOriDbHome, oridbFile } from "../paths/oridbHome.js";
import { HttpError } from "../http/HttpError.js";

type User = {
  id: string;
  email: string;
  passwordHash: string;
  role: "admin" | "editor" | "viewer";
};

const usersFile = () => oridbFile("users.json");

function load(): User[] {
  if (!fs.existsSync(usersFile())) return [];
  return JSON.parse(fs.readFileSync(usersFile(), "utf8")) as User[];
}

function save(u: User[]): void {
  ensureDir(getOriDbHome());
  fs.writeFileSync(usersFile(), JSON.stringify(u, null, 0), "utf8");
}

export const usersRouter = Router();

function requireWeb(
  _req: unknown,
  res: import("express").Response,
  next: import("express").NextFunction,
) {
  if ((process.env.ORIDB_MODE ?? "local") !== "web") {
    res.status(404).json({ error: { code: "NO_WEB", message: "Users disabled" } });
    return;
  }
  next();
}

usersRouter.use(requireWeb);

usersRouter.get("/", (_req, res) => {
  const list = load().map((u) => ({
    id: u.id,
    email: u.email,
    role: u.role,
  }));
  res.json({ users: list });
});

usersRouter.post("/invite", async (req, res, next) => {
  try {
    const body = z
      .object({
        email: z.string().email(),
        role: z.enum(["admin", "editor", "viewer"]).default("viewer"),
        password: z.string().min(6).optional(),
      })
      .parse(req.body);
    const users = load();
    if (users.some((u) => u.email === body.email)) {
      throw new HttpError(409, "User exists", "DUPLICATE");
    }
    const pass = body.password ?? randomUUID().slice(0, 12);
    const passwordHash = await bcrypt.hash(pass, 10);
    const u: User = {
      id: randomUUID(),
      email: body.email,
      passwordHash,
      role: body.role,
    };
    users.push(u);
    save(users);
    res.status(201).json({ user: { id: u.id, email: u.email, role: u.role }, tempPassword: body.password ? undefined : pass });
  } catch (e) {
    next(e);
  }
});

usersRouter.put("/:id/role", (req, res) => {
  const role = z.enum(["admin", "editor", "viewer"]).parse(req.body?.role);
  const users = load();
  const idx = users.findIndex((u) => u.id === req.params.id);
  if (idx === -1) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "User" } });
    return;
  }
  users[idx] = { ...users[idx], role };
  save(users);
  res.json({ user: users[idx] });
});

usersRouter.delete("/:id", (req, res) => {
  const users = load().filter((u) => u.id !== req.params.id);
  save(users);
  res.status(204).end();
});
