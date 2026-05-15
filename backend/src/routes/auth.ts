/**
 * Web mode authentication (JWT + bcrypt). Users stored in ~/.oridb/users.json when ORIDB_MODE=web.
 */
import { Router } from "express";
import fs from "node:fs";
import { z } from "zod";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { ensureDir, getOriDbHome, oridbFile } from "../paths/oridbHome.js";
import { HttpError } from "../http/HttpError.js";

type User = {
  id: string;
  email: string;
  passwordHash: string;
  role: "admin" | "editor" | "viewer";
};

const usersFile = () => oridbFile("users.json");

function loadUsers(): User[] {
  if (!fs.existsSync(usersFile())) return [];
  return JSON.parse(fs.readFileSync(usersFile(), "utf8")) as User[];
}

function saveUsers(u: User[]): void {
  ensureDir(getOriDbHome());
  fs.writeFileSync(usersFile(), JSON.stringify(u, null, 0), "utf8");
}

function jwtSecret(): string {
  const s = process.env.ORIDB_JWT_SECRET?.trim();
  if (!s) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("ORIDB_JWT_SECRET required in production web mode");
    }
    return "oridb-dev-jwt-secret";
  }
  return s;
}

export const authRouter = Router();

function requireWeb(_req: unknown, res: import("express").Response, next: import("express").NextFunction) {
  if ((process.env.ORIDB_MODE ?? "local") !== "web") {
    res.status(404).json({ error: { code: "NO_WEB", message: "Auth disabled in local mode" } });
    return;
  }
  next();
}

authRouter.use(requireWeb);

authRouter.post("/login", async (req, res, next) => {
  try {
    let users = loadUsers();
    if (users.length === 0) {
      const email = process.env.ORIDB_BOOTSTRAP_ADMIN_EMAIL ?? "admin@local.dev";
      const pass = process.env.ORIDB_BOOTSTRAP_ADMIN_PASSWORD ?? "admin";
      const passwordHash = await bcrypt.hash(pass, 10);
      users = [{ id: randomUUID(), email, passwordHash, role: "admin" }];
      saveUsers(users);
    }
    const body = z
      .object({ email: z.string().email(), password: z.string().min(1) })
      .parse(req.body);
    const u = users.find((x) => x.email === body.email);
    if (!u || !(await bcrypt.compare(body.password, u.passwordHash))) {
      throw new HttpError(401, "Invalid credentials", "AUTH");
    }
    const token = jwt.sign(
      { sub: u.id, email: u.email, role: u.role },
      jwtSecret(),
      { expiresIn: "7d" },
    );
    res.json({ token, user: { id: u.id, email: u.email, role: u.role } });
  } catch (e) {
    next(e);
  }
});

authRouter.post("/logout", (_req, res) => {
  res.json({ ok: true });
});

authRouter.post("/refresh", (req, res) => {
  const h = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!h) {
    res.status(401).json({ error: { code: "NO_TOKEN", message: "Missing token" } });
    return;
  }
  try {
    const p = jwt.verify(h, jwtSecret()) as { sub: string; email: string; role: string };
    const token = jwt.sign(
      { sub: p.sub, email: p.email, role: p.role },
      jwtSecret(),
      { expiresIn: "15m" },
    );
    res.json({ token });
  } catch {
    res.status(401).json({ error: { code: "BAD_TOKEN", message: "Invalid token" } });
  }
});

authRouter.post("/forgot-password", (req, res) => {
  const email = z.string().email().parse(req.body?.email);
  const users = loadUsers();
  const u = users.find((x) => x.email === email);
  if (u) {
    const token = jwt.sign({ sub: u.id, purpose: "reset" }, jwtSecret(), { expiresIn: "1h" });
    res.json({ ok: true, message: "Reset token issued", resetToken: token });
  } else {
    res.json({ ok: true, message: "If an account exists, a reset link was sent" });
  }
});

authRouter.post("/reset-password", async (req, res, next) => {
  try {
    const body = z
      .object({ token: z.string(), password: z.string().min(8) })
      .parse(req.body);
    const p = jwt.verify(body.token, jwtSecret()) as { sub: string; purpose?: string };
    if (p.purpose !== "reset") throw new HttpError(400, "Invalid reset token", "BAD_TOKEN");
    const users = loadUsers();
    const idx = users.findIndex((x) => x.id === p.sub);
    if (idx === -1) throw new HttpError(404, "User not found", "NOT_FOUND");
    users[idx] = {
      ...users[idx],
      passwordHash: await bcrypt.hash(body.password, 10),
    };
    saveUsers(users);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

authRouter.get("/me", (req, res) => {
  const h = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!h) {
    res.status(401).json({ error: { code: "NO_TOKEN", message: "Missing token" } });
    return;
  }
  try {
    const p = jwt.verify(h, jwtSecret()) as {
      sub: string;
      email: string;
      role: string;
    };
    res.json({ user: { id: p.sub, email: p.email, role: p.role } });
  } catch {
    res.status(401).json({ error: { code: "BAD_TOKEN", message: "Invalid token" } });
  }
});
