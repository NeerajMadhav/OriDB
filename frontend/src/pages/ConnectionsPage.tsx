/**
 * Connection manager — list + create form + test + connect.
 */
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useSessionStore } from "../stores/sessionStore";
import { useUiStore } from "../stores/uiStore";

type Conn = {
  id: string;
  name: string;
  engine: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  ssl?: boolean;
  readOnly?: boolean;
};

const engines = [
  "postgresql",
  "mysql",
  "mariadb",
  "sqlite",
  "mongodb",
  "redis",
  "cockroachdb",
  "planetscale",
  "neon",
  "supabase",
] as const;

export function ConnectionsPage() {
  const nav = useNavigate();
  const pushToast = useUiStore((s) => s.pushToast);
  const setActive = useSessionStore((s) => s.setActive);
  const [list, setList] = useState<Conn[]>([]);
  const [form, setForm] = useState<Partial<Conn>>({
    name: "Local",
    engine: "postgresql",
    host: "127.0.0.1",
    port: 5432,
    database: "postgres",
    username: "postgres",
    password: "",
  });
  const [urlPaste, setUrlPaste] = useState("");

  const refresh = () =>
    api<{ connections: Conn[] }>("/connections").then((r) =>
      setList(r.connections),
    );

  useEffect(() => {
    void refresh().catch((e: unknown) =>
      pushToast({
        type: "error",
        message: e instanceof Error ? e.message : String(e),
      }),
    );
  }, [pushToast]);

  const save = async () => {
    try {
      await api("/connections", {
        method: "POST",
        body: JSON.stringify(form),
      });
      pushToast({ type: "success", message: "Connection saved" });
      await refresh();
    } catch (e) {
      pushToast({ type: "error", message: (e as Error).message });
    }
  };

  const test = async () => {
    try {
      const r = await api<{ ok: boolean; latencyMs: number; error?: string }>(
        "/connections/test",
        { method: "POST", body: JSON.stringify(form) },
      );
      pushToast({
        type: r.ok ? "success" : "error",
        message: r.ok
          ? `Connected in ${r.latencyMs}ms`
          : (r.error ?? "Failed"),
      });
    } catch (e) {
      pushToast({ type: "error", message: (e as Error).message });
    }
  };

  const connect = async (id: string, meta?: Conn) => {
    try {
      await api(`/connections/${id}/connect`, { method: "POST" });
      const c = meta ?? list.find((x) => x.id === id);
      setActive(id, true, { name: c?.name, engine: c?.engine });
      pushToast({ type: "success", message: `Connected to ${c?.name ?? "database"}` });
      nav("/workspace");
    } catch (e) {
      pushToast({ type: "error", message: (e as Error).message });
    }
  };

  const parseUrl = async () => {
    try {
      const r = await api<{ parsed: Record<string, unknown> }>(
        "/connections/parse-url",
        { method: "POST", body: JSON.stringify({ url: urlPaste }) },
      );
      setForm((f) => ({ ...f, ...r.parsed }));
      pushToast({ type: "info", message: "URL parsed" });
    } catch (e) {
      pushToast({ type: "error", message: (e as Error).message });
    }
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-6 md:flex-row">
      <div className="border-border bg-surface-elevated md:w-1/2 rounded-lg border p-3">
        <div className="text-text-secondary mb-2 text-xs font-semibold uppercase">
          Saved
        </div>
        <div className="oridb-scrollbar max-h-[420px] space-y-1 overflow-y-auto">
          {list.map((c) => (
            <div
              key={c.id}
              className="border-border hover:bg-selection flex items-center justify-between rounded border px-2 py-2 text-sm"
            >
              <div>
                <div className="text-text-primary font-medium">{c.name}</div>
                <div className="text-text-muted text-xs">
                  {c.engine} {c.host ? `· ${c.host}` : ""}
                </div>
              </div>
              <button
                type="button"
                className="bg-primary rounded px-2 py-1 text-xs text-white"
                onClick={() => void connect(c.id, c)}
              >
                Connect
              </button>
            </div>
          ))}
        </div>
        <Link to="/" className="text-primary mt-3 inline-block text-sm">
          ← Home
        </Link>
      </div>
      <div className="border-border bg-surface-elevated flex-1 space-y-3 rounded-lg border p-4">
        <h2 className="text-text-primary text-lg font-semibold">New connection</h2>
        <label className="text-text-secondary block text-xs">Connection string</label>
        <div className="flex gap-2">
          <input
            className="border-border bg-bg text-text-primary flex-1 rounded border px-2 py-1.5 text-sm"
            placeholder="postgres://..."
            value={urlPaste}
            onChange={(e) => setUrlPaste(e.target.value)}
          />
          <button
            type="button"
            className="border-border rounded border px-2 text-sm"
            onClick={() => void parseUrl()}
          >
            Parse
          </button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Name">
            <input
              className="field"
              value={form.name ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </Field>
          <Field label="Engine">
            <select
              className="field"
              value={form.engine}
              onChange={(e) => {
                const engine = e.target.value as Conn["engine"];
                const ports: Record<string, number> = {
                  postgresql: 5432,
                  mysql: 3306,
                  mariadb: 3306,
                  mongodb: 27017,
                  redis: 6379,
                  cockroachdb: 5432,
                  planetscale: 3306,
                  neon: 5432,
                  supabase: 5432,
                  sqlite: 0,
                };
                setForm((f) => ({
                  ...f,
                  engine,
                  port: ports[engine] ?? f.port,
                }));
              }}
            >
              {engines.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Host">
            <input
              className="field"
              value={form.host ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))}
            />
          </Field>
          <Field label="Port">
            <input
              className="field"
              type="number"
              value={form.port ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, port: Number(e.target.value) }))
              }
            />
          </Field>
          <Field label={form.engine === "sqlite" ? "Database file path" : "Database"}>
            <input
              className="field"
              placeholder={
                form.engine === "sqlite"
                  ? "C:\\path\\to\\file.db or ./local.db"
                  : "postgres"
              }
              value={form.database ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, database: e.target.value }))
              }
            />
          </Field>
          {form.engine === "sqlite" && (
            <p className="text-text-muted sm:col-span-2 text-xs">
              For SQLite, set <strong>Database file path</strong> to your .db file. Host/port are not used.
            </p>
          )}
          <Field label="User">
            <input
              className="field"
              value={form.username ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, username: e.target.value }))
              }
            />
          </Field>
          <Field label="Password" className="sm:col-span-2">
            <input
              className="field"
              type="password"
              value={form.password ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, password: e.target.value }))
              }
            />
          </Field>
        </div>
        <label className="text-text-secondary flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={!!form.ssl}
            onChange={(e) => setForm((f) => ({ ...f, ssl: e.target.checked }))}
          />
          SSL
        </label>
        <label className="text-text-secondary flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={!!form.readOnly}
            onChange={(e) =>
              setForm((f) => ({ ...f, readOnly: e.target.checked }))
            }
          />
          Read-only
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="border-border rounded border px-3 py-1.5 text-sm"
            onClick={() => void test()}
          >
            Test
          </button>
          <button
            type="button"
            className="bg-primary rounded px-3 py-1.5 text-sm text-white"
            onClick={() => void save()}
          >
            Save
          </button>
        </div>
      </div>
      <style>{`
        .field { width: 100%; border: 1px solid var(--border); border-radius: 6px; background: var(--bg); color: var(--text-primary); padding: 6px 8px; font-size: 13px; }
      `}</style>
    </div>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="text-text-muted mb-1 block text-[11px] uppercase tracking-wide">
        {label}
      </span>
      {children}
    </label>
  );
}
