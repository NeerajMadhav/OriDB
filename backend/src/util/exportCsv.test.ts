import { describe, expect, it } from "vitest";
import { rowsToCsv } from "./exportCsv.js";

describe("rowsToCsv", () => {
  it("escapes commas and quotes", () => {
    const csv = rowsToCsv(
      [{ name: "a" }, { name: "b" }],
      [{ a: 1, b: 'say "hi"' }],
    );
    expect(csv).toContain('"say ""hi"""');
    expect(csv.split("\r\n").length).toBe(2);
  });

  it("handles null values", () => {
    const csv = rowsToCsv([{ name: "x" }], [{ x: null }]);
    expect(csv).toBe("x\r\n");
  });
});
