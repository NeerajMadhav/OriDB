/**
 * OriDB backend entry — HTTP + WebSocket on port 8037.
 */
import http from "node:http";
import { createRequire } from "node:module";
import { createApp } from "./http/createApp.js";

const require = createRequire(import.meta.url);
import { attachWebSocket } from "./ws/multiplex.js";
import { shutdownAll } from "./registry/connectionRegistry.js";

const port = Number(process.env.PORT ?? process.env.ORIDB_PORT ?? 8037);

const app = createApp();
const server = http.createServer(app);
attachWebSocket(server);

function shutdown(): void {
  void shutdownAll().finally(() => {
    server.close(() => process.exit(0));
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

function driverStatus(name: string, ok: boolean): void {
  console.log(ok ? `  ✓ ${name} driver ready` : `  ○ ${name} (optional, not installed)`);
}

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\n  OriDB: port ${port} is already in use.`);
    console.error(`  Stop the other process or set ORIDB_PORT to a different port.\n`);
    process.exit(1);
  }
  throw err;
});

server.listen(port, () => {
  const ver = process.env.npm_package_version ?? "1.0.0";
  console.log(`\n  OriDB v${ver}`);
  driverStatus("PostgreSQL", true);
  driverStatus("MySQL", true);
  driverStatus("MongoDB", true);
  driverStatus("Redis", true);
  let sqliteOk = false;
  try {
    require.resolve("better-sqlite3");
    sqliteOk = true;
  } catch {
    sqliteOk = false;
  }
  driverStatus("SQLite", sqliteOk);
  const home = process.env.ORIDB_HOME ?? `${process.env.HOME ?? process.env.USERPROFILE}/.oridb`;
  console.log(`  Config: ${home}`);
  console.log(`  Ready at http://localhost:${port}\n`);
});
