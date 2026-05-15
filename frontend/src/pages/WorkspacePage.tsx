/**
 * Main workspace — query editor, results, charts, ER, migrations, import/export, monitoring, diff, multi-DB.
 */
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Play, Sparkles } from "lucide-react";
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
import { api, apiUrl } from "../api/client";
import { QueryEditor, formatSql } from "../components/QueryEditor";
import { QuerySnippets } from "../components/QuerySnippets";
import { buildQuerySnippets } from "../lib/querySnippets";
import { VirtualDataGrid, type GridCellSelection } from "../components/VirtualDataGrid";
import { buildInspectorCellContext } from "../lib/inspector";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { VisualQueryBuilder } from "../components/VisualQueryBuilder";
import { ErDiagramView } from "../components/ErDiagramView";
import { diffResults } from "../lib/queryDiff";
import { ExportDataMenu } from "../components/ExportDataMenu";
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
  const location = useLocation();
  const activeTabId = useWorkspaceStore((s) => s.activeTabId);
  const tabs = useWorkspaceStore((s) => s.tabs);
  const active = tabs.find((t) => t.id === activeTabId);
  const schema = useSessionStore((s) => s.selectedSchema);
  const onQueryRoute =
    location.pathname === "/workspace" || location.pathname === "/workspace/";

  if (active?.kind === "table" && active.table && onQueryRoute) {
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
  const pushToast = useUiStore((s) => s.pushToast);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void (async () => {
      try {
        const status = await api<{ connected: boolean }>(
          `/connections/${id}/status`,
        );
        if (cancelled) return;

        const list = await api<{
          connections: {
            id: string;
            name: string;
            engine: string;
            defaultSchema?: string;
          }[];
        }>("/connections");
        const c = list.connections.find((x) => x.id === id);
        if (!c) {
          setActive(null, false);
          pushToast({
            type: "error",
            message: "Saved connection no longer exists.",
          });
          return;
        }

        if (status.connected) {
          if (!connected) {
            setActive(id, true, {
              name: c.name,
              engine: c.engine,
              defaultSchema: c.defaultSchema,
            });
          }
          return;
        }

        if (connected) {
          setActive(id, false, { name: c.name, engine: c.engine });
        }
        await api(`/connections/${id}/connect`, { method: "POST" });
        if (cancelled) return;
        setActive(id, true, {
          name: c.name,
          engine: c.engine,
          defaultSchema: c.defaultSchema,
        });
      } catch (e: unknown) {
        if (!cancelled) {
          pushToast({
            type: "error",
            message: e instanceof Error ? e.message : "Reconnect failed",
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, setActive, pushToast]); // eslint-disable-line react-hooks/exhaustive-deps -- sync once per connection id

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
      <ErrorBoundary title="Workspace error">
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
      </ErrorBoundary>
    </div>
  );
}

function useConnId(): string {
  return useSessionStore((s) => s.activeConnectionId!);
}

function sqlDialect(engine: string | null): "postgresql" | "mysql" | "sqlite" {
  if (engine === "mysql" || engine === "mariadb" || engine === "planetscale") {
    return "mysql";
  }
  if (engine === "sqlite") return "sqlite";
  return "postgresql";
}

export function QueryTab() {
  const connId = useConnId();
  const connected = useSessionStore((s) => s.connected);
  const engine = useSessionStore((s) => s.engine);
  const schema = useSessionStore((s) => s.selectedSchema);
  const pushToast = useUiStore((s) => s.pushToast);
  const tabs = useWorkspaceStore((s) => s.tabs);
  const activeTabId = useWorkspaceStore((s) => s.activeTabId);
  const updateTab = useWorkspaceStore((s) => s.updateTab);
  const setActiveTab = useWorkspaceStore((s) => s.setActiveTab);
  const setInspector = useWorkspaceStore((s) => s.setInspector);

  const queryTab =
    tabs.find((t) => t.id === activeTabId && t.kind === "query") ??
    tabs.find((t) => t.kind === "query");

  useEffect(() => {
    if (queryTab && activeTabId !== queryTab.id) {
      setActiveTab(queryTab.id);
    }
  }, [activeTabId, queryTab, setActiveTab]);

  useEffect(() => {
    const onInsert = (e: Event) => {
      const sql = (e as CustomEvent<{ sql: string }>).detail?.sql;
      if (!sql || !queryTab) return;
      updateTab(queryTab.id, { sql });
      setActiveTab(queryTab.id);
    };
    window.addEventListener("oridb-insert-query", onInsert);
    return () => window.removeEventListener("oridb-insert-query", onInsert);
  }, [queryTab, updateTab, setActiveTab]);

  const sql = queryTab?.sql ?? "SELECT 1 AS one;";
  const setSql = (next: string) => {
    if (queryTab) updateTab(queryTab.id, { sql: next });
  };

  const results = queryTab?.lastResults ?? [];
  const messages = queryTab?.lastMessages ?? [];

  const [view, setView] = useState<"grid" | "chart" | "messages">("grid");
  const [running, setRunning] = useState(false);

  const run = useCallback(
    async (q: string) => {
      if (!connected) {
        pushToast({
          type: "error",
          message: "Not connected — open Connections and connect first.",
        });
        return;
      }
      const tabId = queryTab?.id;
      if (!tabId) return;
      setRunning(true);
      try {
        const r = await api<{
          durationMs: number;
          results: {
            columns: { name: string }[];
            rows: Record<string, unknown>[];
            rowCount: number;
          }[];
          messages?: string[];
        }>("/query", {
          method: "POST",
          body: JSON.stringify({ connectionId: connId, sql: q }),
        });
        updateTab(tabId, {
          lastResults: r.results,
          lastMessages: r.messages ?? [],
        });
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
        updateTab(tabId, { lastResults: [], lastMessages: [] });
        useWorkspaceStore.getState().setInspector({
          type: "query",
          status: "error",
        });
        pushToast({ type: "error", message: (e as Error).message });
      } finally {
        setRunning(false);
      }
    },
    [connId, connected, pushToast, queryTab?.id, updateTab],
  );

  const onFormat = async () => {
    try {
      const next = await formatSql(sql, sqlDialect(engine));
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

  const handleCellSelect = useCallback(
    (sel: GridCellSelection) => {
      setInspector(buildInspectorCellContext(sel));
    },
    [setInspector],
  );

  const snippetTable =
    tabs.find((t) => t.kind === "table" && t.table)?.table ??
    tabs.find((t) => t.id === activeTabId && t.table)?.table;

  const snippets = useMemo(
    () =>
      buildQuerySnippets({
        dialect: sqlDialect(engine),
        schema,
        table: snippetTable,
      }),
    [engine, schema, snippetTable],
  );

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
          className="oridb-btn oridb-btn-primary h-7 px-3 text-xs"
          disabled={running}
          onClick={() => void run(sql)}
        >
          {running ? "Running…" : "Run"}
        </button>
        <button
          type="button"
          className="border-border rounded border px-2 py-1 text-xs"
          onClick={() => void onFormat()}
        >
          Format
        </button>
        <ExportDataMenu
          columns={cols.map((c) => ({ name: c.id }))}
          rows={rows}
          basename="query-results"
          disabled={running}
        />
        <div className="ml-auto flex gap-1 text-[11px]">
          {(["grid", "chart", "messages"] as const).map((t) => (
            <button
              key={t}
              type="button"
              className={`rounded px-2 py-0.5 capitalize ${view === t ? "bg-selection" : ""}`}
              onClick={() => setView(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <QuerySnippets snippets={snippets} onInsert={(q) => setSql(q)} />
      <QueryEditor
        value={sql}
        onChange={setSql}
        onRun={(q) => void run(q)}
        dialect={sqlDialect(engine)}
        connectionId={connId}
        schema={schema}
        heightPx={300}
      />
      {view === "grid" && (
        <div className="border-border bg-surface-elevated min-h-[180px] flex-1 rounded border p-1">
          {cols.length === 0 ? (
            <p className="text-text-muted flex h-full items-center justify-center p-4 text-sm">
              Run a query to see results
            </p>
          ) : (
            <VirtualDataGrid columns={cols} rows={rows} onCellSelect={handleCellSelect} />
          )}
        </div>
      )}
      {view === "chart" && (
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
      {view === "messages" && (
        <div className="text-text-muted border-border bg-surface-elevated oridb-scrollbar max-h-48 overflow-y-auto rounded border p-2 text-xs">
          {messages.length === 0 ? (
            <p>No messages for the last query.</p>
          ) : (
            messages.map((m, i) => <p key={i}>{m}</p>)
          )}
        </div>
      )}
    </div>
  );
}

export function VisualTab() {
  const connId = useConnId();
  const schema = useSessionStore((s) => s.selectedSchema);
  const pushToast = useUiStore((s) => s.pushToast);
  const [tables, setTables] = useState<string[]>([]);
  useEffect(() => {
    void api<{ tables: { name: string }[] }>(
      `/schema/${connId}/tables?schema=${encodeURIComponent(schema)}`,
    )
      .then((r) => setTables(r.tables.map((t) => t.name)))
      .catch(() => setTables([]));
  }, [connId, schema]);
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
  const schema = useSessionStore((s) => s.selectedSchema);
  const [data, setData] = useState<{
    nodes: { id: string; label: string }[];
    edges: { id: string; source: string; target: string; label: string }[];
  }>({ nodes: [], edges: [] });
  useEffect(() => {
    void api<typeof data>(
      `/schema/${connId}/er-diagram?schema=${encodeURIComponent(schema)}`,
    )
      .then(setData)
      .catch(() => setData({ nodes: [], edges: [] }));
  }, [connId, schema]);
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
  const schema = useSessionStore((s) => s.selectedSchema);
  const pushToast = useUiStore((s) => s.pushToast);
  const [table, setTable] = useState("");
  const [tables, setTables] = useState<string[]>([]);
  const [exportJobId, setExportJobId] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<"csv" | "jsonl">("csv");

  useEffect(() => {
    void api<{ tables: { name: string }[] }>(
      `/schema/${connId}/tables?schema=${encodeURIComponent(schema)}`,
    )
      .then((r) => setTables(r.tables.map((t) => t.name)))
      .catch(() => setTables([]));
  }, [connId, schema]);

  const importCsv = async (file: File) => {
    if (!table) {
      pushToast({ type: "error", message: "Select a target table first" });
      return;
    }
    const fd = new FormData();
    fd.append("file", file);
    fd.append("connectionId", connId);
    fd.append("table", table);
    fd.append("schema", schema);
    fd.append("hasHeader", "true");
    try {
      const r = await api<{ jobId: string }>("/import", { method: "POST", body: fd });
      pushToast({ type: "success", message: `Import job ${r.jobId.slice(0, 8)} started` });
    } catch (e) {
      pushToast({ type: "error", message: (e as Error).message });
    }
  };

  const exportTable = async () => {
    if (!table) {
      pushToast({ type: "error", message: "Select a table first" });
      return;
    }
    try {
      const r = await api<{ jobId: string }>("/export", {
        method: "POST",
        body: JSON.stringify({
          connectionId: connId,
          tables: [table],
          schema,
          format: exportFormat,
        }),
      });
      setExportJobId(r.jobId);
      pushToast({ type: "info", message: "Export job started…" });
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
        <select
          className="border-border bg-bg rounded border px-2 py-1 text-xs"
          value={exportFormat}
          onChange={(e) => setExportFormat(e.target.value as "csv" | "jsonl")}
        >
          <option value="csv">ZIP of CSV files</option>
          <option value="jsonl">ZIP of JSONL</option>
        </select>
        <button
          type="button"
          className="border-border rounded border px-3 py-1"
          onClick={() => void exportTable()}
        >
          Export table (background)
        </button>
        {table && (
          <a
            className="border-border text-primary rounded border px-3 py-1 underline"
            href={apiUrl(
              `/rows/${connId}/${encodeURIComponent(table)}?schema=${encodeURIComponent(schema)}&format=csv&limit=100000`,
            )}
            download={`${table}.csv`}
          >
            Download CSV now
          </a>
        )}
        {exportJobId && (
          <a
            className="text-primary underline"
            href={apiUrl(`/export/${exportJobId}/download`)}
          >
            Download
          </a>
        )}
      </div>
    </div>
  );
}

export function MonitorTab() {
  const connId = useConnId();
  const engine = useSessionStore((s) => s.engine);
  const [overview, setOverview] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setError(null);
    void api(`/monitor/${connId}/overview`)
      .then((r) => {
        setOverview(r);
        setError(null);
      })
      .catch((e: unknown) => {
        setOverview(null);
        setError(e instanceof Error ? e.message : String(e));
      });
  }, [connId]);
  if (error) {
    return (
      <p className="text-text-muted m-4 text-sm">
        {engine === "postgresql" ||
        engine === "neon" ||
        engine === "supabase" ||
        engine === "cockroachdb"
          ? error
          : "Monitoring overview is limited on this engine. Query history stats may still appear when supported."}
      </p>
    );
  }
  return (
    <pre className="text-text-primary oridb-scrollbar m-4 max-h-[400px] overflow-auto rounded bg-code-bg p-3 text-xs">
      {overview == null ? "Loading…" : JSON.stringify(overview, null, 2)}
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
