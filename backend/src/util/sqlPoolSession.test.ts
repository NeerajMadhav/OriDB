import { describe, expect, it } from "vitest";
import { createSqlPoolSession } from "./sqlPoolSession.js";

describe("createSqlPoolSession", () => {
  it("waits for in-flight work before close completes", async () => {
    const session = createSqlPoolSession();
    session.open();
    let released = false;
    const work = session.run(async () => {
      await new Promise((r) => setTimeout(r, 40));
      released = true;
    });
    const closing = session.close();
    expect(released).toBe(false);
    await Promise.all([work, closing]);
    expect(released).toBe(true);
  });

  it("rejects new work after close", async () => {
    const session = createSqlPoolSession();
    session.open();
    await session.close();
    await expect(session.run(async () => "x")).rejects.toThrow(
      /disconnected/i,
    );
  });
});
