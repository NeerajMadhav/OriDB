# OriDB

Local-first universal database workspace (port **8037**).

## Quick start

```bash
npm install
npm run dev
```

- API + WebSocket: http://localhost:8037  
- Vite UI (dev): http://localhost:5173 (proxies `/api` and `/ws`)

Production:

```bash
npm run build
npm start
```

Open http://localhost:8037

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` / `ORIDB_PORT` | `8037` | HTTP port |
| `ORIDB_MASTER_PASSWORD` | dev fallback | AES-256-GCM key for `~/.oridb/connections.enc` |
| `ORIDB_MODE` | `local` | Set `web` to enable auth/users routes |
| `ORIDB_JWT_SECRET` | dev only | Required in production web mode |

## SQLite on Windows

`better-sqlite3` is optional. Install [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with “Desktop development with C++” if `npm install` fails on native addons.

## Docker

```bash
docker build -t oridb .
docker run -p 8037:8037 -e ORIDB_MASTER_PASSWORD=your-secret oridb
```

## Tests

```bash
npm test
```
