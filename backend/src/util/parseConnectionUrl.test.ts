import { describe, expect, it } from "vitest";
import { parseConnectionUrl } from "./parseConnectionUrl.js";

describe("parseConnectionUrl", () => {
  it("parses postgres URL", () => {
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
  });

  it("parses mysql URL", () => {
    const p = parseConnectionUrl("mysql://root:secret@127.0.0.1:3306/app");
    expect(p?.engine).toBe("mysql");
    expect(p?.username).toBe("root");
    expect(p?.password).toBe("secret");
  });
});
