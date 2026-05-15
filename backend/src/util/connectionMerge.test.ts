import { describe, expect, it } from "vitest";
import { mergeConnectionUpdate, sanitizeForApi } from "./connectionMerge.js";
import type { ConnectionConfig } from "../types/connection.js";

const base: ConnectionConfig = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Neon",
  engine: "neon",
  host: "ep.example.neon.tech",
  port: 5432,
  database: "neondb",
  username: "user",
  password: "old-secret",
  connectionUrl:
    "postgresql://user:old-secret@ep.example.neon.tech/neondb?sslmode=require",
  ssl: true,
};

describe("connectionMerge", () => {
  it("sanitizeForApi omits connectionUrl credentials", () => {
    const s = sanitizeForApi(base);
    expect(s.password).toBe("********");
    expect(s.connectionUrl).toBeUndefined();
    expect(s.hasConnectionUrl).toBe(true);
  });

  it("password update clears stale connectionUrl", () => {
    const merged = mergeConnectionUpdate(base, { password: "new-secret" });
    expect(merged.password).toBe("new-secret");
    expect(merged.connectionUrl).toBeUndefined();
    expect(merged.host).toBe(base.host);
  });

  it("explicit connectionUrl replaces stored url", () => {
    const url =
      "postgresql://user:new@ep.example.neon.tech/neondb?sslmode=require";
    const merged = mergeConnectionUpdate(base, { connectionUrl: url });
    expect(merged.connectionUrl).toContain("new@");
  });
});
