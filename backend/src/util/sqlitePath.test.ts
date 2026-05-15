import { describe, expect, it } from "vitest";
import path from "node:path";
import {
  isSqliteFilePath,
  parseBareSqlitePath,
  suggestSqliteName,
} from "./sqlitePath.js";
import { parseConnectionUrl } from "./parseConnectionUrl.js";

describe("sqlitePath", () => {
  it("detects sqlite extensions", () => {
    expect(isSqliteFilePath("app.db")).toBe(true);
    expect(isSqliteFilePath("data.sqlite3")).toBe(true);
    expect(isSqliteFilePath("nope.txt")).toBe(false);
  });

  it("parses bare file paths", () => {
    expect(parseBareSqlitePath("C:\\data\\local.db")).toBe("C:\\data\\local.db");
    expect(parseBareSqlitePath("./relative.db")).toBe("./relative.db");
  });

  it("suggests display names from paths", () => {
    expect(suggestSqliteName("/foo/bar/my_app.sqlite")).toBe("my_app");
  });
});

describe("parseConnectionUrl sqlite", () => {
  it("parses bare .db path", () => {
    const p = parseConnectionUrl("./test-local.db");
    expect(p?.engine).toBe("sqlite");
    expect(p?.database).toContain("test-local.db");
  });

  it("parses file:// URL on Windows-style paths", () => {
    const p = parseConnectionUrl("file:///C:/Users/test/app.db");
    expect(p?.engine).toBe("sqlite");
    expect(p?.database).toMatch(/app\.db$/i);
    expect(path.isAbsolute(p!.database!)).toBe(true);
  });
});
