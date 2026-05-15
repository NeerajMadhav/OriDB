import { describe, expect, it } from "vitest";
import type { ConnectionConfig } from "../types/connection.js";
import {
  buildPgPoolConfig,
  pgPassword,
  resolvePgSsl,
  shouldUseConnectionString,
} from "./pgConnection.js";

const basePg = (patch: Partial<ConnectionConfig>): ConnectionConfig => ({
  id: "00000000-0000-4000-8000-000000000001",
  name: "test",
  engine: "postgresql",
  ...patch,
});

describe("pgConnection", () => {
  it("uses connection string when password is only in URL", () => {
    const cfg = basePg({
      host: "codepui.c0fs68mkarob.us-east-1.rds.amazonaws.com",
      username: "admin",
      connectionUrl:
        "postgresql://admin:secret@codepui.c0fs68mkarob.us-east-1.rds.amazonaws.com:5432/codepui",
    });
    expect(shouldUseConnectionString(cfg)).toBe(true);
    const pool = buildPgPoolConfig(cfg);
    expect(pool.connectionString).toContain("postgresql://");
    expect(pool.connectionString).toContain("secret");
  });

  it("coerces password to string for discrete fields", () => {
    const cfg = basePg({
      host: "127.0.0.1",
      username: "postgres",
      database: "postgres",
      password: undefined,
    });
    expect(pgPassword(cfg)).toBe("");
    const pool = buildPgPoolConfig(cfg);
    expect(pool.password).toBe("");
    expect(typeof pool.password).toBe("string");
  });

  it("disables SSL for localhost by default", () => {
    const cfg = basePg({
      host: "127.0.0.1",
      username: "postgres",
      password: "x",
      ssl: undefined,
    });
    expect(resolvePgSsl(cfg)).toBe(false);
    const pool = buildPgPoolConfig(cfg);
    expect(pool.ssl).toBe(false);
  });

  it("enables SSL for RDS hosts", () => {
    const cfg = basePg({
      host: "x.rds.amazonaws.com",
      username: "u",
      password: "p",
    });
    expect(resolvePgSsl(cfg)).toBe(true);
  });

  it("respects explicit ssl=false on cloud host", () => {
    const cfg = basePg({
      connectionUrl:
        "postgresql://u:p@x.rds.amazonaws.com:5432/db?sslmode=require",
      ssl: false,
    });
    expect(resolvePgSsl(cfg)).toBe(false);
    const pool = buildPgPoolConfig(cfg);
    expect(pool.connectionString).toContain("sslmode=disable");
    expect(pool.ssl).toBe(false);
  });
});
