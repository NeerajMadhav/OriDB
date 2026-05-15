import { describe, expect, it } from "vitest";
import {
  parseConnectionUrl,
  sanitizePgConnectionString,
} from "./parseConnectionUrl.js";

describe("parseConnectionUrl", () => {
  it("parses postgres URL with encoded password and sslmode", () => {
    const p = parseConnectionUrl(
      "postgres://u:p%40ss@h.example:5432/mydb?sslmode=require",
    );
    expect(p?.engine).toBe("postgresql");
    expect(p?.host).toBe("h.example");
    expect(p?.port).toBe(5432);
    expect(p?.database).toBe("mydb");
    expect(p?.username).toBe("u");
    expect(p?.password).toBe("p@ss");
    expect(p?.ssl).toBe(true);
    expect(p?.connectionUrl).toContain("postgresql://");
  });

  it("parses Neon pooler URL and detects provider", () => {
    const p = parseConnectionUrl(
      "postgresql://neondb_owner:secret@ep-cool-night-appk470i-pooler.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
    );
    expect(p?.engine).toBe("neon");
    expect(p?.provider).toBe("neon");
    expect(p?.host).toContain("neon.tech");
    expect(p?.database).toBe("neondb");
    expect(p?.ssl).toBe(true);
    expect(p?.suggestedName).toContain("Neon");
    expect(p?.connectionUrl).not.toContain("channel_binding");
    expect(p?.connectionUrl).toContain("sslmode=require");
  });

  it("parses AWS RDS PostgreSQL", () => {
    const p = parseConnectionUrl(
      "postgresql://admin:pass@mydb.abc123.us-east-1.rds.amazonaws.com:5432/production?sslmode=require",
    );
    expect(p?.engine).toBe("postgresql");
    expect(p?.provider).toBe("aws-rds");
    expect(p?.ssl).toBe(true);
    expect(p?.database).toBe("production");
  });

  it("parses Supabase pooler URL", () => {
    const p = parseConnectionUrl(
      "postgresql://postgres.xyz:pass@aws-0-us-east-1.pooler.supabase.com:6543/postgres",
    );
    expect(p?.engine).toBe("supabase");
    expect(p?.provider).toBe("supabase");
    expect(p?.ssl).toBe(true);
    expect(p?.port).toBe(6543);
  });

  it("parses mysql URL", () => {
    const p = parseConnectionUrl("mysql://root:secret@127.0.0.1:3306/app");
    expect(p?.engine).toBe("mysql");
    expect(p?.username).toBe("root");
    expect(p?.password).toBe("secret");
  });

  it("parses PlanetScale URL", () => {
    const p = parseConnectionUrl(
      "mysql://user:pass@aws.connect.psdb.cloud/mydb?sslaccept=strict",
    );
    expect(p?.engine).toBe("planetscale");
    expect(p?.provider).toBe("planetscale");
    expect(p?.ssl).toBe(true);
  });

  it("parses jdbc postgresql style", () => {
    const p = parseConnectionUrl("jdbc:postgresql://u:p@localhost:5432/testdb");
    expect(p?.engine).toBe("postgresql");
    expect(p?.host).toBe("localhost");
    expect(p?.database).toBe("testdb");
    expect(p?.username).toBe("u");
  });

  it("parses Snowflake URL with warehouse and role", () => {
    const p = parseConnectionUrl(
      "snowflake://user:secret@xy12345.us-east-1.snowflakecomputing.com/MY_DB/PUBLIC?warehouse=COMPUTE_WH&role=ANALYST",
    );
    expect(p?.engine).toBe("snowflake");
    expect(p?.provider).toBe("snowflake");
    expect(p?.host).toBe("xy12345.us-east-1");
    expect(p?.database).toBe("MY_DB");
    expect(p?.defaultSchema).toBe("PUBLIC");
    expect(p?.warehouse).toBe("COMPUTE_WH");
    expect(p?.role).toBe("ANALYST");
    expect(p?.username).toBe("user");
    expect(p?.password).toBe("secret");
  });
});

describe("sanitizePgConnectionString", () => {
  it("removes channel_binding for node-pg", () => {
    const out = sanitizePgConnectionString(
      "postgresql://u:p@host.neon.tech/db?sslmode=require&channel_binding=require",
    );
    expect(out).not.toContain("channel_binding");
    expect(out).toContain("sslmode=require");
  });
});
