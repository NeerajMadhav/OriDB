/**
 * Tracks in-flight SQL operations so pools are not ended while queries run.
 */
const DRAIN_MS = 30_000;
const DRAIN_POLL_MS = 25;

export type SqlPoolSession = {
  open: () => void;
  close: () => Promise<void>;
  run: <T>(fn: () => Promise<T>) => Promise<T>;
};

export function createSqlPoolSession(): SqlPoolSession {
  let closed = true;
  let activeOps = 0;
  let drain: Promise<void> | null = null;

  return {
    open() {
      closed = false;
    },

    async close() {
      if (drain) {
        await drain;
        return;
      }
      drain = (async () => {
        closed = true;
        const deadline = Date.now() + DRAIN_MS;
        while (activeOps > 0 && Date.now() < deadline) {
          await new Promise((r) => setTimeout(r, DRAIN_POLL_MS));
        }
      })();
      try {
        await drain;
      } finally {
        drain = null;
      }
    },

    async run(fn) {
      if (closed) {
        throw new Error("Connection disconnected");
      }
      activeOps++;
      try {
        return await fn();
      } finally {
        activeOps--;
      }
    },
  };
}
