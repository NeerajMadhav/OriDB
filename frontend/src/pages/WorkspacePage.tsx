/**
 * Main workspace — query editor, results, charts, ER, migrations, import/export, monitoring, diff, multi-DB.
 */
import { NavLink, Outlet } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useSessionStore } from "../stores/sessionStore";
import { useUiStore } from "../stores/uiStore";
import { api } from "../api/client";
import { QueryEditor, formatSql } from "../components/QueryEditor";
import { VirtualDataGrid } from "../components/VirtualDataGrid";
import { VisualQueryBuilder } from "../components/VisualQueryBuilder";
import { ErDiagramView } from "../components/ErDiagramView";
import { diffResults } from "../lib/queryDiff";
import { SchemaExplorer } from "../components/SchemaExplorer";
import { WorkspaceLayout } from "../components/WorkspaceLayout";
import { InspectorPanel } from "../components/InspectorPanel";
import { TableViewer } from "../components/TableViewer";
import { useWorkspaceStore } from "../stores/workspaceStore";

const tabs = [
  { to: "/workspace", end: true, label: "Query" },
  { to: "/workspace/visual", label: "Visual" },
  { to: "/workspace/er", label: "ER" },
  { to: "/workspace/migrations", label: "Migrations" },
  { to: "/workspace/import-export", label: "Import" },
  { to: "/workspace/monitoring", label: "Monitor" },
  { to: "/workspace/diff", label: "Diff" },
  { to: "/workspace/multi", label: "Multi-DB" },
  { to: "/workspace/saved", label: "Saved" },
  { to: "/workspace/settings", label: "Settings" },
];

function EditorTabBar() {
  const tabs = useWorkspaceStore((s) => s.tabs);
  const activeTabId = useWorkspaceStore((s) => s.activeTabId);
  const setActiveTab = useWorkspaceStore((s) => s.setActiveTab);
  const closeTab = useWorkspaceStore((s) => s.closeTab);
  const addTab = useWorkspaceStore((s) => s.addTab);

  if (tabs.length === 0) return null;

  return (
    <div className="border-border oridb-scrollbar flex shrink-0 gap-0.5 overflow-x-auto border-b px-1 py-0.5">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`flex max-w-[140px] items-center gap-1 rounded px-2 py-1 text-xs whitespace-nowrap ${
            activeTabId === t.id ? "bg-selection text-text-primary" : "text-text-secondary hover:bg-selection/50"
          }`}
          onClick={() => setActiveTab(t.id)}
        >
          <span className="truncate">{t.title}</span>
          {tabs.length > 1 && (
            <span
              role="button"
              tabIndex={0}
              className="hover:text-error shrink-0 opacity-60"
              onClick={(e) => {
                e.stopPropagation();
                closeTab(t.id);
              }}
            >
              ×
            </span>
          )}
        </button>
      ))}
      <button
        type="button"
        title="New query tab"
        className="text-text-muted hover:text-primary px-2 text-xs"
        onClick={() => addTab({ title: `Query ${tabs.length + 1}`, kind: "query" })}
      >
        +
      </button>
    </div>
  );
}

function WorkspaceCenter({ connId }: { connId: string }) {
  const activeTabId = useWorkspaceStore((s) => s.activeTabId);
  const tabs = useWorkspaceStore((s) => s.tabs);
  const active = tabs.find((t) => t.id === activeTabId);
  const schema = useSessionStore((s) => s.selectedSchema);

  if (active?.kind === "table" && active.table) {
    return (
      <TableViewer
        connId={connId}
        table={active.table}
        schema={active.schema ?? schema}
      />
    );
  }
  return <Outlet />;
}

export function WorkspaceShell() {
  const id = useSessionStore((s) => s.activeConnectionId);
  const connected = useSessionStore((s) => s.connected);
  const setActive = useSessionStore((s) => s.setActive);
  const connectionName = useSessionStore((s) => s.connectionName);
  const engine = useSessionStore((s) => s.engine);

  useEffect(() => {
    if (!id || connected) return;
    void api<{ connections: { id: string; name: string; engine: string }[] }>(
      "/connections",
    )
      .then(async (r) => {
        const c = r.connections.find((x) => x.id === id);
        if (!c) return;
        await api(`/connections/${id}/connect`, { method: "POST" });
        setActive(id, true, { name: c.name, engine: c.engine });
      })
      .catch(() => {
        /* user can reconnect from Connections */
      });
  }, [id, connected, setActive]);

  if (!id) {
    return (
      <div className="text-text-secondary p-8 text-center text-sm">
        No active connection.{" "}
        <NavLink className="text-primary underline" to="/connections">
          Open connections
        </NavLink>
      </div>
    );
  }
  return (
    <div className="flex h-[calc(100vh-52px)] flex-col">
      <nav className="border-border bg-surface oridb-scrollbar flex gap-1 overflow-x-auto border-b px-2 py-1 text-xs">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              `rounded px-2 py-1 whitespace-nowrap ${isActive ? "bg-selection text-text-primary" : "text-text-secondary hover:bg-selection/60"}`
            }
          >
            {t.label}
          </NavLink>
        ))}
      </nav>
      <WorkspaceLayout
        sidebar={
          <SchemaExplorer
            onSelectTable={(table, sch) =>
              useWorkspaceStore.getState().addTab({
                title: table,
                kind: "table",
                table,
                schema: sch,
              })
            }
          />
        }
        inspector={<InspectorPanel />}
        center={
          <div className="flex h-full min-h-0 flex-col">
            <EditorTabBar />
            <div className="min-h-0 flex-1">
              <WorkspaceCenter connId={id} />
            </div>
          </div>
        }
      />
    </div>
  );
}

function useConnId(): string {
  return useSessionStore((s) => s.activeConnectionId!);
}

export function QueryTab() {
  const connId = useConnId();
  const pushToast = useUiStore((s) => s.pushToast);
  const [sql, setSql] = useState("SELECT 1 AS one;");
  const [results, setResults] = useState<
    { columns: { name: string }[]; rows: Record<string, unknown>[] }[]
  >([]);
  const [tab, setTab] = useState<"grid" | "chart" | "messages">("grid");

  const run = useCallback(
    async (q: string) => {
      try {
        const r = await api<{
          durationMs: number;
          results: {
            columns: { name: string }[];
            rows: Record<string, unknown>[];
            rowCount: number;
          }[];
        }>("/query", {
          method: "POST",
          body: JSON.stringify({ connectionId: connId, sql: q }),
        });
        setResults(r.results);
        const last = r.results[r.results.length - 1];
        useWorkspaceStore.getState().setQueryMetrics({
          durationMs: r.durationMs,
          rows: last?.rowCount ?? last?.rows?.length ?? 0,
        });
        useWorkspaceStore.getState().setInspector({
          type: "query",
          durationMs: r.durationMs,
          rows: last?.rowCount ?? last?.rows?.length,
          status: "ok",
        });
        pushToast({ type: "success", message: "Query finished" });
      } catch (e) {
        pushToast({ type: "error", message: (e as Error).message });
      }
    },
    [connId, pushToast],
  );

  const onFormat = async () => {
    try {
      const next = await formatSql(sql, "postgresql");
      setSql(next);
    } catch (e) {
      pushToast({ type: "error", message: (e as Error).message });
    }
  };

  const last = results[results.length - 1];
  const cols = useMemo(
    () => last?.columns.map((c) => ({ id: c.name, header: c.name })) ?? [],
    [last],
  );
  const rows = last?.rows ?? [];

  const chartData = useMemo(() => {
    if (!last?.columns.length) return [];
    const nums = last.columns
      .map((c, i) => ({ c, i }))
      .filter((x) =>
        last.rows[0] != null && typeof last.rows[0][x.c.name] === "number",
      );
    if (nums.length < 2) return [];
    const [x, y] = [nums[0]!, nums[1]!];
    return last.rows.slice(0, 50).map((r) => ({
      x: Number(r[x.c.name]),
      y: Number(r[y.c.name]),
    }));
  }, [last]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 p-2">
      <div className="border-border bg-surface-elevated flex flex-wrap items-center gap-2 rounded border px-2 py-1">
        <button
          type="button"
          className="bg-primary rounded px-3 py-1 text-xs text-white"
          onClick={() => void run(sql)}
        >
          Run
        </button>
        <button
          type="button"
          className="border-border rounded border px-2 py-1 text-xs"
          onClick={() => void onFormat()}
        >
          Format
        </button>
        <div className="ml-auto flex gap-1 text-[11px]">
          {(["grid", "chart", "messages"] as const).map((t) => (
            <button
              key={t}
              type="button"
              className={`rounded px-2 py-0.5 capitalize ${tab === t ? "bg-selection" : ""}`}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="border-border bg-surface-elevated min-h-[200px] flex-1 rounded border">
        <QueryEditor value={sql} onChange={setSql} onRun={(q) => void run(q)} />
      </div>
      {tab === "grid" && (
        <div className="border-border bg-surface-elevated h-64 rounded border p-1">
          <VirtualDataGrid columns={cols} rows={rows} />
        </div>
      )}
      {tab === "chart" && (
        <div className="border-border bg-surface-elevated h-64 rounded border p-2">
          {chartData.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="x" />
                <YAxis dataKey="y" />
                <Tooltip />
                <Bar dataKey="y" fill="var(--primary)" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-text-muted p-4 text-center text-sm">
              Run a query with two numeric columns for a bar chart.
            </div>
          )}
        </div>
      )}
      {tab === "messages" && (
        <div className="text-text-muted border-border bg-surface-elevated rounded border p-2 text-xs">
          Server notices appear here.
        </div>
      )}
    </div>
  );
}

export function VisualTab() {
  const connId = useConnId();
  const pushToast = useUiStore((s) => s.pushToast);
  const [tables, setTables] = useState<string[]>([]);
  useEffect(() => {
    void api<{ tables: { name: string }[] }>(
      `/schema/${connId}/tables?schema=public`,
    )
      .then((r) => setTables(r.tables.map((t) => t.name)))
      .catch(() => setTables([]));
  }, [connId]);
  const run = async (sql: string) => {
    try {
      await api("/query", {
        method: "POST",
        body: JSON.stringify({ connectionId: connId, sql }),
      });
      pushToast({ type: "success", message: "Visual query executed" });
    } catch (e) {
      pushToast({ type: "error", message: (e as Error).message });
    }
  };
  return <VisualQueryBuilder schemaTables={tables} onRun={(q) => void run(q)} />;
}

export function ErTab() {
  const connId = useConnId();
  const [data, setData] = useState<{
    nodes: { id: string; label: string }[];
    edges: { id: string; source: string; target: string; label: string }[];
  }>({ nodes: [], edges: [] });
  useEffect(() => {
    void api<typeof data>(`/schema/${connId}/er-diagram?schema=public`)
      .then(setData)
      .catch(() => setData({ nodes: [], edges: [] }));
  }, [connId]);
  return <ErDiagramView data={data} />;
}

export function MigrationsTab() {
  const connId = useConnId();
  const [files, setFiles] = useState<string[]>([]);
  const pushToast = useUiStore((s) => s.pushToast);
  const refresh = useCallback(
    () =>
      api<{ migrations: { name: string }[] }>(`/migrations/${connId}`).then(
        (r) => setFiles(r.migrations.map((m) => m.name)),
      ),
    [connId],
  );
  useEffect(() => {
    void refresh().catch(() => setFiles([]));
  }, [connId, refresh]);
  const create = async () => {
    const name = `migration_${Date.now()}.sql`;
    try {
      await api(`/migrations/${connId}`, {
        method: "POST",
        body: JSON.stringify({ name, up: "SELECT 1;", down: "SELECT 1;" }),
      });
      pushToast({ type: "success", message: "Migration file created" });
      await refresh();
    } catch (e) {
      pushToast({ type: "error", message: (e as Error).message });
    }
  };
  return (
    <div className="p-4 text-sm">
      <button
        type="button"
        className="bg-primary mb-3 rounded px-3 py-1 text-white"
        onClick={() => void create()}
      >
        New migration
      </button>
      <ul className="text-text-secondary list-inside list-disc">
        {files.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
    </div>
  );
}

export function ImportExportTab() {
  const connId = useConnId();
  const pushToast = useUiStore((s) => s.pushToast);
  const [table, setTable] = useState("");
  const [tables, setTables] = useState<string[]>([]);
  const [exportJobId, setExportJobId] = useState<string | null>(null);

  useEffect(() => {
    void api<{ tables: { name: string }[] }>(`/schema/${connId}/tables`)
      .then((r) => setTables(r.tables.map((t) => t.name)))
      .catch(() => setTables([]));
  }, [connId]);

  const importCsv = async (file: File) => {
    if (!table) {
      pushToast({ type: "error", message: "Select a target table first" });
      return;
    }
    const fd = new FormData();
    fd.append("file", file);
    fd.append("connectionId", connId);
    fd.append("table", table);
    fd.append("hasHeader", "true");
    try {
      const r = await api<{ jobId: string }>("/import", { method: "POST", body: fd });
      pushToast({ type: "success", message: `Import job ${r.jobId.slice(0, 8)} started` });
    } catch (e) {
      pushToast({ type: "error", message: (e as Error).message });
    }
  };

  const exportZip = async () => {
    if (!table) {
      pushToast({ type: "error", message: "Select a table first" });
      return;
    }
    try {
      const r = await api<{ jobId: string }>("/export", {
        method: "POST",
        body: JSON.stringify({ connectionId: connId, tables: [table] }),
      });
      setExportJobId(r.jobId);
      pushToast({ type: "info", message: "Export running…" });
    } catch (e) {
      pushToast({ type: "error", message: (e as Error).message });
    }
  };

  return (
    <div className="text-text-primary space-y-4 p-4 text-sm">
      <select
        className="border-border bg-bg block max-w-xs rounded border px-2 py-1"
        value={table}
        onChange={(e) => setTable(e.target.value)}
      >
        <option value="">Table…</option>
        {tables.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <div className="flex flex-wrap gap-2">
        <label className="bg-primary cursor-pointer rounded px-3 py-1 text-white">
          Import CSV
          <input
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importCsv(f);
            }}
          />
        </label>
        <button type="button" className="border-border rounded border px-3 py-1" onClick={() => void exportZip()}>
          Export ZIP
        </button>
        {exportJobId && (
          <a className="text-primary underline" href={`/api/export/${exportJobId}/download`}>
            Download
          </a>
        )}
      </div>
    </div>
  );
}

export function MonitorTab() {
  const connId = useConnId();
  const [overview, setOverview] = useState<unknown>(null);
  useEffect(() => {
    void api(`/monitor/${connId}/overview`)
      .then(setOverview)
      .catch(() => setOverview(null));
  }, [connId]);
  return (
    <pre className="text-text-primary oridb-scrollbar m-4 max-h-[400px] overflow-auto rounded bg-code-bg p-3 text-xs">
      {JSON.stringify(overview, null, 2)}
    </pre>
  );
}

export function DiffTab() {
  const [a, setA] = useState("SELECT 1 AS id, 'x' AS v");
  const [b, setB] = useState("SELECT 1 AS id, 'y' AS v");
  const [key, setKey] = useState("id");
  const connId = useConnId();
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const pushToast = useUiStore((s) => s.pushToast);
  const run = async () => {
    try {
      const [ra, rb] = await Promise.all([
        api<{ results: { rows: Record<string, unknown>[] }[] }>("/query", {
          method: "POST",
          body: JSON.stringify({ connectionId: connId, sql: a }),
        }),
        api<{ results: { rows: Record<string, unknown>[] }[] }>("/query", {
          method: "POST",
          body: JSON.stringify({ connectionId: connId, sql: b }),
        }),
      ]);
      const left = ra.results[0]?.rows ?? [];
      const right = rb.results[0]?.rows ?? [];
      const d = diffResults(left, right, key);
      setRows(d.rows);
      pushToast({
        type: "info",
        message: `Added ${d.added}, removed ${d.removed}, changed ${d.changed}`,
      });
    } catch (e) {
      pushToast({ type: "error", message: (e as Error).message });
    }
  };
  const cols =
    rows[0] != null
      ? Object.keys(rows[0])
          .filter((k) => k !== "__diff")
          .map((k) => ({ id: k, header: k }))
      : [];
  return (
    <div className="flex flex-col gap-2 p-2">
      <div className="grid gap-2 md:grid-cols-2">
        <textarea
          className="border-border bg-bg text-text-primary min-h-[100px] rounded border p-2 font-mono text-xs"
          value={a}
          onChange={(e) => setA(e.target.value)}
        />
        <textarea
          className="border-border bg-bg text-text-primary min-h-[100px] rounded border p-2 font-mono text-xs"
          value={b}
          onChange={(e) => setB(e.target.value)}
        />
      </div>
      <div className="flex items-center gap-2">
        <label className="text-text-secondary text-xs">Key</label>
        <input
          className="border-border bg-bg rounded border px-2 py-1 text-xs"
          value={key}
          onChange={(e) => setKey(e.target.value)}
        />
        <button
          type="button"
          className="bg-primary rounded px-3 py-1 text-xs text-white"
          onClick={() => void run()}
        >
          Run both
        </button>
      </div>
      <div className="h-56">
        <VirtualDataGrid columns={cols} rows={rows} />
      </div>
    </div>
  );
}

export function MultiTab() {
  const [sql, setSql] = useState("SELECT current_database() AS db, now() AS t;");
  const [list, setList] = useState<{ id: string; name: string }[]>([]);
  const [sel, setSel] = useState<string[]>([]);
  const [out, setOut] = useState<Record<string, unknown>>({});
  const pushToast = useUiStore((s) => s.pushToast);
  useEffect(() => {
    void api<{ connections: { id: string; name: string }[] }>("/connections").then(
      (r) => setList(r.connections),
    );
  }, []);
  const run = async () => {
    const results: Record<string, unknown> = {};
    for (const id of sel) {
      try {
        const r = await api<{ results: unknown[] }>("/query", {
          method: "POST",
          body: JSON.stringify({ connectionId: id, sql }),
        });
        results[id] = r.results;
      } catch (e) {
        results[id] = { error: (e as Error).message };
      }
    }
    setOut(results);
    pushToast({ type: "success", message: "Multi-run complete" });
  };
  return (
    <div className="flex flex-col gap-2 p-2 text-sm">
      <textarea
        className="border-border bg-bg text-text-primary min-h-[100px] rounded border p-2 font-mono text-xs"
        value={sql}
        onChange={(e) => setSql(e.target.value)}
      />
      <div className="text-text-secondary text-xs">Select connections</div>
      <div className="flex flex-wrap gap-2">
        {list.map((c) => (
          <label key={c.id} className="flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={sel.includes(c.id)}
              onChange={(e) =>
                setSel((s) =>
                  e.target.checked ? [...s, c.id] : s.filter((x) => x !== c.id),
                )
              }
            />
            {c.name}
          </label>
        ))}
      </div>
      <button
        type="button"
        className="bg-primary w-fit rounded px-3 py-1 text-white"
        onClick={() => void run()}
      >
        Run on all selected
      </button>
      <pre className="bg-code-bg oridb-scrollbar max-h-64 overflow-auto rounded p-2 text-[11px]">
        {JSON.stringify(out, null, 2)}
      </pre>
    </div>
  );
}

export function SavedTab() {
  const [queries, setQueries] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    void api<{ queries: { id: string; name: string }[] }>("/saved-queries").then((r) =>
      setQueries(r.queries),
    );
  }, []);
  return (
    <ul className="text-text-primary p-4 text-sm">
      {queries.map((q) => (
        <li key={q.id}>{q.name}</li>
      ))}
    </ul>
  );
}

export function SettingsTab() {
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  return (
    <div className="text-text-primary space-y-3 p-4 text-sm">
      <div>
        <div className="text-text-secondary mb-1 text-xs uppercase">Theme</div>
        <select
          className="border-border bg-bg rounded border px-2 py-1"
          value={theme}
          onChange={(e) =>
            setTheme(e.target.value as "light" | "dark" | "system")
          }
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="system">System</option>
        </select>
      </div>
      <p className="text-text-muted text-xs">
        Local credentials are encrypted with AES-256-GCM when{" "}
        <code>ORIDB_MASTER_PASSWORD</code> is set (see backend README).
      </p>
    </div>
  );
}
