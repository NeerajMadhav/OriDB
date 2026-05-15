import { describe, expect, it } from "vitest";
import { cellValueType, formatCellFull, formatCellPreview } from "./cellValue";

describe("cellValue", () => {
  it("formats null and objects", () => {
    expect(formatCellFull(null)).toBe("");
    expect(cellValueType(null)).toBe("null");
    expect(formatCellFull({ a: 1 })).toBe('{\n  "a": 1\n}');
  });

  it("truncates long preview", () => {
    const long = "x".repeat(200);
    expect(formatCellPreview(long, 50).endsWith("…")).toBe(true);
  });
});
