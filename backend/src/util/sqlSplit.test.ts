import { describe, expect, it } from "vitest";
import { splitSqlStatements } from "./sqlSplit.js";

describe("splitSqlStatements", () => {
  it("splits simple statements", () => {
    expect(splitSqlStatements("select 1; select 2")).toEqual([
      "select 1",
      "select 2",
    ]);
  });

  it("ignores semicolon in string", () => {
    expect(splitSqlStatements("select ';'; select 2")).toEqual([
      "select ';'",
      "select 2",
    ]);
  });
});
