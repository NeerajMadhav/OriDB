# OriDB — Frontend

React 19 single-page application for OriDB. Provides the connection manager, SQL workspace, schema explorer, table viewer, and auxiliary tools (visual builder, ER diagram, import/export, monitoring).

**Stack:** Vite 6, TypeScript, Tailwind CSS 4, React Router 7, Zustand, Monaco Editor, TanStack Table/Virtual, Recharts, React Flow.

---

## Folder structure

```
frontend/
├── src/
│   ├── main.tsx              # React root, Router, global CSS
│   ├── App.tsx               # Route definitions
│   ├── index.css             # Design tokens, oridb-* utility classes
│   ├── api/
│   │   └── client.ts         # fetch wrapper → /api
│   ├── pages/
│   │   ├── HomePage.tsx      # Landing, recent connections
│   │   ├── ConnectionsPage.tsx
│   │   └── WorkspacePage.tsx # Shell + Query, Visual, ER, … tabs
│   ├── components/
│   │   ├── AppShell.tsx      # Header, nav, layout
│   │   ├── WorkspaceLayout.tsx
│   │   ├── SchemaExplorer.tsx
│   │   ├── QueryEditor.tsx   # Monaco + format/run
│   │   ├── VirtualDataGrid.tsx
│   │   ├── TableViewer.tsx
│   │   ├── InspectorPanel.tsx
│   │   ├── VisualQueryBuilder.tsx
│   │   ├── ErDiagramView.tsx
│   │   ├── StatusBar.tsx
│   │   ├── CommandPalette.tsx
│   │   ├── ToastHost.tsx
│   │   └── ui.tsx            # Btn, Card, Input, EngineBadge, …
│   ├── stores/
│   │   ├── sessionStore.ts   # Active connection, schema, connected flag
│   │   ├── workspaceStore.ts # Editor tabs, results, inspector metrics
│   │   ├── uiStore.ts        # Toasts, theme-adjacent UI state
│   │   └── notificationStore.ts
│   ├── hooks/
│   │   └── useAppHotkeys.ts
│   └── lib/
│       ├── queryDiff.ts
│       └── visualSql.ts
├── index.html
├── vite.config.ts            # Dev proxy → backend :8037
├── package.json
└── tsconfig.json
```

Compiled output: **`dist/`** (served by backend in production).

---

## Scripts

```bash
npm run dev       # Vite dev server → http://localhost:5173
npm run build     # tsc -b && vite build
npm run preview   # Preview production build
npm run lint      # ESLint
```

From repo root: `npm run dev` runs frontend + backend together via `concurrently`.

---

## Development

### Prerequisites

- Backend running on **8037** (started automatically by root `npm run dev`)
- Node ≥ 20

### API proxy

`vite.config.ts` proxies:

| Path | Target |
|------|--------|
| `/api` | `http://127.0.0.1:8037` |
| `/ws` | `ws://127.0.0.1:8037` |

The UI uses relative URLs (`/api/...`) so cookies and CORS work in dev without extra config.

### Override API base (optional)

Set at build time:

```bash
VITE_API_BASE=https://your-host/api npm run build
```

Default: `/api` (see `src/api/client.ts` and `apiUrl()` for download links).

---

## Routing

| Path | Page | Description |
|------|------|-------------|
| `/` | Home | Welcome, quick connect |
| `/connections` | Connections | CRUD, URL parse, test, connect |
| `/workspace` | Query | SQL editor + results (default) |
| `/workspace/visual` | Visual | Visual query builder |
| `/workspace/er` | ER | Entity-relationship diagram |
| `/workspace/migrations` | Migrations | List/create migration files |
| `/workspace/import-export` | Import | CSV import, ZIP export |
| `/workspace/monitoring` | Monitor | DB activity (PG-oriented) |
| `/workspace/diff` | Diff | Compare table snapshots |
| `/workspace/multi` | Multi-DB | Run SQL on several connections |
| `/workspace/saved` | Saved | Saved queries library |
| `/workspace/settings` | Settings | Workspace preferences |

`WorkspaceShell` wraps all workspace routes with the three-panel layout (schema | center | inspector).

---

## State management (Zustand)

### `sessionStore`

- `activeConnectionId`, `connectionName`, `engine`, `connected`
- `selectedSchema` — drives schema explorer, table viewer, visual/ER/import tabs
- `setActive(id, connected, meta)` — on connect; Snowflake defaults schema to `PUBLIC`, SQLite to `main`

Persisted partially via `persist` middleware (see `sessionStore.ts`).

### `workspaceStore`

- SQL editor **tabs** (`kind: "query" | "table"`)
- Per-tab `sql`, `lastResults`, `lastMessages`
- Inspector payload, query timing metrics

### `uiStore`

- Toast queue (`pushToast`)

---

## End-to-end user flows

### 1. Connect to a database

1. User opens **Connections**, pastes URL or fills form.
2. Debounced `POST /api/connections/parse-url` fills engine/host/ssl (and Snowflake warehouse/role).
3. **Test** → `POST /api/connections/test`.
4. **Save** → `POST` or `PUT /api/connections`.
5. **Connect** → `POST /api/connections/:id/connect` → `setActive(id, true, meta)` → navigate to `/workspace`.

### 2. Run a query

1. `WorkspaceShell` verifies `GET /api/connections/:id/status`; reconnects if server disconnected.
2. `QueryTab` reads active tab from `workspaceStore`, runs `POST /api/query` with `connectionId` + `sql`.
3. Results render in virtual grid; optional chart if two numeric columns exist.
4. **Format** uses `POST /api/query/format` with dialect from engine (`postgresql` | `mysql` | `sqlite`).

### 3. Browse schema

1. `SchemaExplorer` loads `GET /api/schema/:connId` and `.../tables?schema=...`.
2. Selecting a schema updates `sessionStore.selectedSchema`.
3. Clicking a table opens a **table** tab → `TableViewer` uses `GET /api/rows/:connId/:table`.

### 4. Edit connection while active

1. `PUT /api/connections/:id` disconnects backend pool.
2. If this was the active profile, Connections page reconnects and refreshes session.
3. Workspace status check avoids stale `connected: true` without a live pool.

---

## UI conventions

- Shared primitives in **`components/ui.tsx`** (`oridb-btn`, `oridb-card`, `oridb-panel` in `index.css`)
- **Engine badges** color-coded by database type
- **Mobile-first** responsive layout via Tailwind utilities
- Monaco editor: Ctrl/Cmd+Enter to run selection or full buffer

---

## Key components

| Component | Responsibility |
|-----------|----------------|
| `QueryEditor` | Monaco, dialect hint, run callback |
| `VirtualDataGrid` | Large result sets with virtualization |
| `TableViewer` | Paginated table data + row edit |
| `SchemaExplorer` | Tree: schemas → tables/views |
| `InspectorPanel` | Column/query metadata sidebar |
| `StatusBar` | Connection dot, row count, latency, WS status |

---

## Engines in the UI

`ConnectionsPage` engine dropdown includes:

`postgresql`, `mysql`, `mariadb`, `sqlite`, `mongodb`, `redis`, `cockroachdb`, `planetscale`, `neon`, `supabase`, `snowflake`, `clickhouse`, `sqlserver`

Snowflake shows extra fields: **Warehouse**, **Role**, **Default schema**.

URL paste accepts prefixes listed in `URL_PREFIX` (including `snowflake://`, `clickhouse://`, `sqlserver://`).

---

## Build & deployment

```bash
npm run build
```

Artifacts in `frontend/dist/`. The backend serves them when:

- `NODE_ENV=production`
- `frontend/dist/index.html` exists relative to backend `dist/`

Single-origin deployment: users open port **8037** only.

---

## Linting

```bash
npm run lint
```

Uses ESLint 9 + TypeScript ESLint + React hooks plugin.

---

## Troubleshooting (frontend)

| Symptom | Check |
|---------|--------|
| API 404 / network error | Backend on 8037? Proxy in `vite.config.ts`? |
| “Not connected” toast | Call Connect; watch `/connections/:id/status` |
| Export download fails | Uses `apiUrl()` — must be same origin or set `VITE_API_BASE` |
| Empty schema | Wrong schema selected; try another in dropdown |
| Stale results | Each query tab stores its own `lastResults` |

---

## Related docs

- [Root README](../README.md) — full project quick start
- [Backend README](../backend/README.md) — API contracts and drivers
