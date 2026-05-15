# OriDB

**OriDB** is a local-first universal database workspace. Connect to PostgreSQL, MySQL, SQLite, Snowflake, MongoDB, Redis, and more from one UI — run SQL, browse schema, view tables, build visual queries, and manage saved connections with encrypted on-disk storage.

This repository is an **npm workspaces** monorepo:

| Package | Path | Role |
|---------|------|------|
| **API + drivers** | [`backend/`](backend/README.md) | Express server, database drivers, REST + WebSocket |
| **Web UI** | [`frontend/`](frontend/README.md) | React + Vite SPA |

---

## Features

- **Connection manager** — create, edit, test, connect, delete profiles; paste URLs (Neon, Supabase, RDS, Snowflake, etc.) for auto-fill
- **Local SQLite files** — browse for `.db` / `.sqlite` files, paste a path, or upload a copy; opens as a saved connection instantly
- **Query workspace** — Monaco SQL editor, multi-tab results, format SQL, grid + chart views
- **Schema explorer** — databases, schemas, tables, columns, indexes, views, ER diagram
- **Table viewer** — paginated data grid with row CRUD (SQL engines)
- **Visual query builder**, **migrations**, **import/export** (CSV/ZIP jobs), **monitoring** (PostgreSQL), **saved queries**, **multi-DB** runner
- **Security** — connections encrypted at rest (`~/.oridb`); optional web mode with JWT auth
- **Read-only connections** — block mutating SQL at the driver layer

---

## Supported databases

| Engine | Query / schema | Notes |
|--------|----------------|-------|
| PostgreSQL, Neon, Supabase, CockroachDB | Full | SSL + URL parsing; `channel_binding` stripped for node-pg |
| MySQL, MariaDB, PlanetScale | Full | URI or discrete fields |
| SQLite | Full | Requires optional `better-sqlite3` native module |
| Snowflake | Query + schema (`SHOW` / `DESCRIBE`) | Warehouse, role, default schema |
| MongoDB, Redis | NoSQL routes | Browse / command-style APIs |
| ClickHouse, SQL Server | Profile + URL parse only | Connect returns a clear “driver coming soon” message |

See [backend/README.md](backend/README.md) for driver and API details.

---

## Requirements

- **Node.js** ≥ 20
- **npm** (workspaces)
- **Windows (SQLite only):** [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with “Desktop development with C++” if `better-sqlite3` fails to compile

---

## Quick start (development)

```bash
git clone <your-repo-url>
cd OriDB
npm install
npm run dev
```

| Service | URL |
|---------|-----|
| **Frontend (Vite)** | http://localhost:5173 |
| **API + WebSocket** | http://localhost:8037 |
| **Health check** | http://localhost:8037/health |

In dev, Vite proxies `/api` and `/ws` to the backend. Open the UI at **5173**.

### End-to-end flow

1. Open **Connections** → paste a connection URL or fill host/user/database → **Test** → **Save** → **Connect**
2. You are redirected to **Workspace** → write SQL → **Run**
3. Use the left **Schema** panel to pick a schema and open tables
4. Use tabs: **Visual**, **ER**, **Import**, **Monitor**, **Saved**, etc.

If the workspace shows “not connected”, it will call `/api/connections/:id/status` and reconnect automatically when possible.

---

## Production build

```bash
npm run build    # frontend → frontend/dist, backend → backend/dist
npm start        # serves API + static SPA on one port
```

Open **http://localhost:8037** (API and UI on the same origin).

---

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` / `ORIDB_PORT` | `8037` | HTTP port |
| `ORIDB_HOME` | `~/.oridb` | Config, encrypted connections, jobs, audit |
| `ORIDB_MASTER_PASSWORD` | dev fallback | AES-256-GCM key for `connections.enc` |
| `ORIDB_MODE` | `local` | Set to `web` to enable `/api/auth` and `/api/users` |
| `ORIDB_JWT_SECRET` | dev only | **Required** in production when `ORIDB_MODE=web` |
| `ORIDB_CORS_ORIGIN` | `*` (dev) | Comma-separated origins for CORS |
| `NODE_ENV` | — | `production` enables static SPA from `frontend/dist` |
| `VITE_API_BASE` | `/api` | Frontend API prefix (build-time; see [frontend/README.md](frontend/README.md)) |

---

## Docker

```bash
docker build -t oridb .
docker run -p 8037:8037 \
  -e ORIDB_MASTER_PASSWORD=your-strong-secret \
  -v oridb-data:/root/.oridb \
  oridb
```

---

## Tests

```bash
npm test
```

Runs backend Vitest suites (unit + SQLite integration). See [backend/README.md](backend/README.md#testing).

---

## Project layout

```
OriDB/
├── backend/          # Express API, drivers, stores
├── frontend/         # React SPA
├── package.json      # Workspace root scripts
├── Dockerfile        # Multi-stage production image
└── README.md         # This file
```

---

## Troubleshooting

| Issue | What to try |
|-------|-------------|
| **Cannot use a pool after calling end on the pool** | Connection was closed while a query ran. Reconnect via **Connections** or refresh workspace (auto-reconnect). Avoid saving/editing a profile during a long query. |
| **SQL connection not active** | Click **Connect** on the profile; confirm `/api/connections/:id/status` returns `connected: true`. |
| **Port 8037 in use** | Stop the other process or set `ORIDB_PORT`. |
| **SQLite install fails on Windows** | Install C++ build tools or use PostgreSQL/MySQL only. |
| **Neon / RDS SSL errors** | Use `sslmode=require` in URL; OriDB enables SSL for known cloud hosts. |
| **0 tables in `public`** | Tables may live in another schema — use the schema dropdown in the explorer. |

---

## Documentation

- [Backend README](backend/README.md) — API routes, drivers, data directory, architecture
- [Frontend README](frontend/README.md) — UI structure, stores, routing, development

---

## License

Private / project-specific — add your license here if open-sourcing.
