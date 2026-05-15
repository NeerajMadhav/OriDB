# OriDB — Backend

Express 5 API server for OriDB. Manages encrypted connection profiles, active database pools, SQL/NoSQL execution, schema introspection, background import/export jobs, and WebSocket multiplexing.

**Entry point:** `src/index.ts` (default port **8037**)

---

## Tech stack

- **Runtime:** Node.js ≥ 20, TypeScript, ESM
- **HTTP:** Express 5, `compression`, `cors`, `express-rate-limit`
- **SQL:** `pg`, `mysql2`, optional `better-sqlite3`, `snowflake-sdk`
- **NoSQL:** `mongodb`, `ioredis`
- **Validation:** Zod
- **Tests:** Vitest + Supertest

---

## Folder structure

```
backend/
├── src/
│   ├── index.ts                 # HTTP server, graceful shutdown, driver banner
│   ├── http/
│   │   ├── createApp.ts         # Express app, /health, static SPA (production)
│   │   └── errorHandler.ts
│   ├── routes/                  # REST routers (mounted under /api)
│   │   ├── registerApiRoutes.ts
│   │   ├── connections.ts       # CRUD, connect/disconnect, test, parse-url
│   │   ├── schema.ts            # Databases, schemas, tables, columns, ER, stats
│   │   ├── query.ts             # Execute SQL, format, explain, cancel, autocomplete
│   │   ├── rows.ts              # Table row GET/POST/PUT/DELETE
│   │   ├── savedQueries.ts
│   │   ├── migrations.ts
│   │   ├── importExport.ts      # CSV import, ZIP export jobs
│   │   ├── monitor.ts           # PG activity (engine-specific)
│   │   ├── nosql.ts             # MongoDB / Redis helpers
│   │   ├── auth.ts, users.ts    # ORIDB_MODE=web only
│   │   └── system.ts
│   ├── drivers/                 # Per-engine SqlDriver / NoSQL implementations
│   │   ├── postgres.ts
│   │   ├── mysql.ts
│   │   ├── sqlite.ts
│   │   ├── snowflake.ts
│   │   ├── mongo.ts
│   │   └── redis.ts
│   ├── registry/
│   │   └── connectionRegistry.ts  # Active handles; connect/disconnect locks
│   ├── services/
│   │   ├── schemaService.ts     # information_schema, SQLite PRAGMA, Snowflake SHOW
│   │   └── jobQueue.ts          # Async import/export
│   ├── store/                   # File-backed persistence under ORIDB_HOME
│   │   ├── connectionsStore.ts
│   │   ├── queryHistory.ts
│   │   └── auditLog.ts
│   ├── util/
│   │   ├── parseConnectionUrl.ts
│   │   ├── connectionMerge.ts
│   │   ├── pgConnection.ts
│   │   ├── sqlPoolSession.ts    # Drain in-flight queries before pool.end()
│   │   ├── connectionLock.ts    # Serialize connect/disconnect per id
│   │   └── sqlSplit.ts, dangerSql.ts
│   ├── crypto/vault.ts          # Encrypt connections.enc
│   ├── ws/multiplex.ts          # WebSocket on same port as HTTP
│   └── types/connection.ts
├── package.json
└── tsconfig.json
```

---

## Scripts

```bash
npm run dev      # tsx watch src/index.ts
npm run build    # tsc → dist/
npm start        # node dist/index.js
npm test         # vitest run
```

From repo root: `npm run dev -w backend`, `npm test`, etc.

---

## API overview

Base path: **`/api`** (rate-limited ~2000 req/min per IP)

### Connections

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/connections` | List profiles (passwords/URLs redacted) |
| `GET` | `/connections/:id` | Single profile |
| `POST` | `/connections` | Create |
| `PUT` | `/connections/:id` | Update (disconnects if active) |
| `DELETE` | `/connections/:id` | Delete + disconnect |
| `POST` | `/connections/test` | Test without saving |
| `POST` | `/connections/parse-url` | Parse JDBC/standard URL → fields |
| `POST` | `/connections/:id/connect` | Open driver pool / client |
| `POST` | `/connections/:id/disconnect` | Close pool safely |
| `GET` | `/connections/:id/status` | `{ connected: boolean }` |

### Schema

Prefix: `/schema/:connId`

- `GET /` — list schemas (or SQLite `main`)
- `GET /databases`
- `GET /tables?schema=public`
- `GET /tables/:table/columns`, `/indexes`, `/constraints`, `/ddl`, `/stats`
- `GET /er-diagram?schema=...`
- `GET /views`, `/procedures`, `/functions`, `/triggers`
- `POST /refresh` — clear schema cache dir

Snowflake uses `SHOW SCHEMAS` / `SHOW TABLES` / `DESCRIBE TABLE` where PostgreSQL uses `information_schema`.

### Query

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/query` | Run SQL (`connectionId`, `sql`, optional `params`) |
| `POST` | `/query/cancel` | Cancel by `queryId` or `connectionId` |
| `POST` | `/query/format` | sql-formatter |
| `POST` | `/query/explain` | EXPLAIN (engine-dependent) |
| `GET` | `/query/history` | Local query history |
| `POST` | `/query/autocomplete` | Keywords + table names |

### Rows

`/rows/:connId/:table` — `GET` (paginate), `POST` (insert), `PUT /:id` (update by PK), `DELETE` (with `where` query param).

### Other

- `/saved-queries` — CRUD + run
- `/migrations/:connId` — file-based migration stubs
- `/import`, `/export`, `/export/:jobId/download` — background jobs
- `/monitor/:connId/*` — PostgreSQL-focused stats
- `/nosql/:connId/*` — Mongo/Redis
- `/audit-log`, `/audit-log/export`
- `/system/*` — version, mode
- `/auth/*`, `/users/*` — when `ORIDB_MODE=web`

### Health

`GET /health` — `{ status, version, uptime }` (not under `/api`).

---

## Connection lifecycle

1. Profiles are stored in **`$ORIDB_HOME/connections.enc`** (AES-256-GCM via `ORIDB_MASTER_PASSWORD`).
2. **`connectHandle(cfg)`** creates a driver, opens pool/client, stores handle in memory map.
3. **`disconnectHandle(id)`** removes handle first, drains in-flight SQL via `sqlPoolSession`, then `pool.end()`.
4. **`connectHandle`** and **`disconnectHandle`** are serialized per connection id (`connectionLock.ts`) to avoid pool races.

Re-connecting the same id always disconnects the previous handle before creating a new driver.

---

## Drivers

| File | Engines |
|------|---------|
| `postgres.ts` | `postgresql`, `neon`, `supabase`, `cockroachdb` |
| `mysql.ts` | `mysql`, `mariadb`, `planetscale` |
| `sqlite.ts` | `sqlite` (optional native module) |
| `snowflake.ts` | `snowflake` |
| `mongo.ts` | `mongodb` |
| `redis.ts` | `redis` |

`connectionRegistry.ts` throws friendly errors for `clickhouse` and `sqlserver` until dedicated drivers exist.

### URL parsing (`parseConnectionUrl.ts`)

Supports `postgresql://`, `mysql://`, `snowflake://`, `clickhouse://`, `sqlserver://`, `mssql://`, `jdbc:...`, `file:` (SQLite). Detects Neon, Supabase, AWS RDS, PlanetScale, Snowflake hosts; strips `channel_binding` from PostgreSQL URLs for node-pg compatibility.

### PostgreSQL pool config (`pgConnection.ts`)

Builds pool from discrete fields or `connectionUrl`; infers SSL from host/query params.

---

## Local data directory

Default: **`~/.oridb`** (override with `ORIDB_HOME`)

| Path | Purpose |
|------|---------|
| `connections.enc` | Encrypted connection profiles |
| `query-history.json` | Recent queries |
| `audit.jsonl` | Audit log entries |
| `jobs/` | Import/export temp files |
| `schema-cache/:connId/` | Optional schema cache (cleared on refresh) |
| `migrations/:connId/` | Migration SQL files |

---

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` / `ORIDB_PORT` | `8037` | Listen port |
| `ORIDB_HOME` | `~/.oridb` | Data directory |
| `ORIDB_MASTER_PASSWORD` | dev key | Encryption for connections |
| `ORIDB_MODE` | `local` | `web` enables auth routes |
| `ORIDB_JWT_SECRET` | — | JWT signing (required in prod web mode) |
| `ORIDB_CORS_ORIGIN` | permissive | CORS allowlist |
| `NODE_ENV` | — | `production` + built `frontend/dist` → SPA |

---

## WebSocket

`ws/multiplex.ts` attaches to the same HTTP server. Used for live job progress / notifications (see frontend `StatusBar` and notification store).

Path in dev: proxied as **`/ws`** from Vite to port 8037.

---

## Testing

```bash
npm test
```

| Suite | File | Coverage |
|-------|------|----------|
| Unit | `util/*.test.ts`, `health.test.ts` | URL parse, SQL split, merge |
| E2E | `e2e.integration.test.ts` | SQLite connect, query, schema |
| Extended | `extended.integration.test.ts` | Rows CRUD, saved queries, read-only |

Integration tests use **SQLite** in a temp `ORIDB_HOME` — no external DB required for CI.

---

## Production notes

- Build: `npm run build` (from repo root builds frontend first, then backend).
- `createApp.ts` serves `frontend/dist` when `NODE_ENV=production` and `index.html` exists.
- On shutdown (`SIGINT`/`SIGTERM`), `shutdownAll()` closes every active pool before exit.
- Set a strong **`ORIDB_MASTER_PASSWORD`**; never commit real connection URLs or passwords.

---

## Adding a new SQL driver

1. Implement `SqlDriver` in `src/drivers/<engine>.ts` (`test`, `connect`, `disconnect`, `query`, optional `cancel`).
2. Register in `connectionRegistry.ts` `createSql()`.
3. Extend `engineSchema` in `types/connection.ts` and `parseConnectionUrl.ts`.
4. Add schema branches in `schemaService.ts` / `routes/schema.ts` if introspection differs.
5. Add Vitest coverage where possible.

---

## Related docs

- [Root README](../README.md) — monorepo overview and quick start
- [Frontend README](../frontend/README.md) — UI that consumes this API
