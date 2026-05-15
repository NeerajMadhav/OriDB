import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Main workspace — query editor, results, charts, ER, migrations, import/export, monitoring, diff, multi-DB.
 */
import { NavLink, Outlet } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, } from "recharts";
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
    if (tabs.length === 0)
        return null;
    return (_jsxs("div", { className: "border-border oridb-scrollbar flex shrink-0 gap-0.5 overflow-x-auto border-b px-1 py-0.5", children: [tabs.map((t) => (_jsxs("button", { type: "button", className: `flex max-w-[140px] items-center gap-1 rounded px-2 py-1 text-xs whitespace-nowrap ${activeTabId === t.id ? "bg-selection text-text-primary" : "text-text-secondary hover:bg-selection/50"}`, onClick: () => setActiveTab(t.id), children: [_jsx("span", { className: "truncate", children: t.title }), tabs.length > 1 && (_jsx("span", { role: "button", tabIndex: 0, className: "hover:text-error shrink-0 opacity-60", onClick: (e) => {
                            e.stopPropagation();
                            closeTab(t.id);
                        }, children: "\u00D7" }))] }, t.id))), _jsx("button", { type: "button", title: "New query tab", className: "text-text-muted hover:text-primary px-2 text-xs", onClick: () => addTab({ title: `Query ${tabs.length + 1}`, kind: "query" }), children: "+" })] }));
}
function WorkspaceCenter({ connId }) {
    const activeTabId = useWorkspaceStore((s) => s.activeTabId);
    const tabs = useWorkspaceStore((s) => s.tabs);
    const active = tabs.find((t) => t.id === activeTabId);
    const schema = useSessionStore((s) => s.selectedSchema);
    if (active?.kind === "table" && active.table) {
        return (_jsx(TableViewer, { connId: connId, table: active.table, schema: active.schema ?? schema }));
    }
    return _jsx(Outlet, {});
}
export function WorkspaceShell() {
    const id = useSessionStore((s) => s.activeConnectionId);
    const connected = useSessionStore((s) => s.connected);
    const setActive = useSessionStore((s) => s.setActive);
    const connectionName = useSessionStore((s) => s.connectionName);
    const engine = useSessionStore((s) => s.engine);
    useEffect(() => {
        if (!id || connected)
            return;
        void api("/connections")
            .then(async (r) => {
            const c = r.connections.find((x) => x.id === id);
            if (!c)
                return;
            await api(`/connections/${id}/connect`, { method: "POST" });
            setActive(id, true, { name: c.name, engine: c.engine });
        })
            .catch(() => {
            /* user can reconnect from Connections */
        });
    }, [id, connected, setActive]);
    if (!id) {
        return (_jsxs("div", { className: "text-text-secondary p-8 text-center text-sm", children: ["No active connection.", " ", _jsx(NavLink, { className: "text-primary underline", to: "/connections", children: "Open connections" })] }));
    }
    return (_jsxs("div", { className: "flex h-[calc(100vh-52px)] flex-col", children: [_jsx("nav", { className: "border-border bg-surface oridb-scrollbar flex gap-1 overflow-x-auto border-b px-2 py-1 text-xs", children: tabs.map((t) => (_jsx(NavLink, { to: t.to, end: t.end, className: ({ isActive }) => `rounded px-2 py-1 whitespace-nowrap ${isActive ? "bg-selection text-text-primary" : "text-text-secondary hover:bg-selection/60"}`, children: t.label }, t.to))) }), _jsx(WorkspaceLayout, { sidebar: _jsx(SchemaExplorer, { onSelectTable: (table, sch) => useWorkspaceStore.getState().addTab({
                        title: table,
                        kind: "table",
                        table,
                        schema: sch,
                    }) }), inspector: _jsx(InspectorPanel, {}), center: _jsxs("div", { className: "flex h-full min-h-0 flex-col", children: [_jsx(EditorTabBar, {}), _jsx("div", { className: "min-h-0 flex-1", children: _jsx(WorkspaceCenter, { connId: id }) })] }) })] }));
}
function useConnId() {
    return useSessionStore((s) => s.activeConnectionId);
}
export function QueryTab() {
    const connId = useConnId();
    const pushToast = useUiStore((s) => s.pushToast);
    const [sql, setSql] = useState("SELECT 1 AS one;");
    const [results, setResults] = useState([]);
    const [tab, setTab] = useState("grid");
    const run = useCallback(async (q) => {
        try {
            const r = await api("/query", {
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
        }
        catch (e) {
            pushToast({ type: "error", message: e.message });
        }
    }, [connId, pushToast]);
    const onFormat = async () => {
        try {
            const next = await formatSql(sql, "postgresql");
            setSql(next);
        }
        catch (e) {
            pushToast({ type: "error", message: e.message });
        }
    };
    const last = results[results.length - 1];
    const cols = useMemo(() => last?.columns.map((c) => ({ id: c.name, header: c.name })) ?? [], [last]);
    const rows = last?.rows ?? [];
    const chartData = useMemo(() => {
        if (!last?.columns.length)
            return [];
        const nums = last.columns
            .map((c, i) => ({ c, i }))
            .filter((x) => last.rows[0] != null && typeof last.rows[0][x.c.name] === "number");
        if (nums.length < 2)
            return [];
        const [x, y] = [nums[0], nums[1]];
        return last.rows.slice(0, 50).map((r) => ({
            x: Number(r[x.c.name]),
            y: Number(r[y.c.name]),
        }));
    }, [last]);
    return (_jsxs("div", { className: "flex min-h-0 min-w-0 flex-1 flex-col gap-2 p-2", children: [_jsxs("div", { className: "border-border bg-surface-elevated flex flex-wrap items-center gap-2 rounded border px-2 py-1", children: [_jsx("button", { type: "button", className: "bg-primary rounded px-3 py-1 text-xs text-white", onClick: () => void run(sql), children: "Run" }), _jsx("button", { type: "button", className: "border-border rounded border px-2 py-1 text-xs", onClick: () => void onFormat(), children: "Format" }), _jsx("div", { className: "ml-auto flex gap-1 text-[11px]", children: ["grid", "chart", "messages"].map((t) => (_jsx("button", { type: "button", className: `rounded px-2 py-0.5 capitalize ${tab === t ? "bg-selection" : ""}`, onClick: () => setTab(t), children: t }, t))) })] }), _jsx("div", { className: "border-border bg-surface-elevated min-h-[200px] flex-1 rounded border", children: _jsx(QueryEditor, { value: sql, onChange: setSql, onRun: (q) => void run(q) }) }), tab === "grid" && (_jsx("div", { className: "border-border bg-surface-elevated h-64 rounded border p-1", children: _jsx(VirtualDataGrid, { columns: cols, rows: rows }) })), tab === "chart" && (_jsx("div", { className: "border-border bg-surface-elevated h-64 rounded border p-2", children: chartData.length ? (_jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(BarChart, { data: chartData, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3" }), _jsx(XAxis, { dataKey: "x" }), _jsx(YAxis, { dataKey: "y" }), _jsx(Tooltip, {}), _jsx(Bar, { dataKey: "y", fill: "var(--primary)" })] }) })) : (_jsx("div", { className: "text-text-muted p-4 text-center text-sm", children: "Run a query with two numeric columns for a bar chart." })) })), tab === "messages" && (_jsx("div", { className: "text-text-muted border-border bg-surface-elevated rounded border p-2 text-xs", children: "Server notices appear here." }))] }));
}
export function VisualTab() {
    const connId = useConnId();
    const pushToast = useUiStore((s) => s.pushToast);
    const [tables, setTables] = useState([]);
    useEffect(() => {
        void api(`/schema/${connId}/tables?schema=public`)
            .then((r) => setTables(r.tables.map((t) => t.name)))
            .catch(() => setTables([]));
    }, [connId]);
    const run = async (sql) => {
        try {
            await api("/query", {
                method: "POST",
                body: JSON.stringify({ connectionId: connId, sql }),
            });
            pushToast({ type: "success", message: "Visual query executed" });
        }
        catch (e) {
            pushToast({ type: "error", message: e.message });
        }
    };
    return _jsx(VisualQueryBuilder, { schemaTables: tables, onRun: (q) => void run(q) });
}
export function ErTab() {
    const connId = useConnId();
    const [data, setData] = useState({ nodes: [], edges: [] });
    useEffect(() => {
        void api(`/schema/${connId}/er-diagram?schema=public`)
            .then(setData)
            .catch(() => setData({ nodes: [], edges: [] }));
    }, [connId]);
    return _jsx(ErDiagramView, { data: data });
}
export function MigrationsTab() {
    const connId = useConnId();
    const [files, setFiles] = useState([]);
    const pushToast = useUiStore((s) => s.pushToast);
    const refresh = useCallback(() => api(`/migrations/${connId}`).then((r) => setFiles(r.migrations.map((m) => m.name))), [connId]);
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
        }
        catch (e) {
            pushToast({ type: "error", message: e.message });
        }
    };
    return (_jsxs("div", { className: "p-4 text-sm", children: [_jsx("button", { type: "button", className: "bg-primary mb-3 rounded px-3 py-1 text-white", onClick: () => void create(), children: "New migration" }), _jsx("ul", { className: "text-text-secondary list-inside list-disc", children: files.map((f) => (_jsx("li", { children: f }, f))) })] }));
}
export function ImportExportTab() {
    const connId = useConnId();
    const pushToast = useUiStore((s) => s.pushToast);
    const [table, setTable] = useState("");
    const [tables, setTables] = useState([]);
    const [exportJobId, setExportJobId] = useState(null);
    useEffect(() => {
        void api(`/schema/${connId}/tables`)
            .then((r) => setTables(r.tables.map((t) => t.name)))
            .catch(() => setTables([]));
    }, [connId]);
    const importCsv = async (file) => {
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
            const r = await api("/import", { method: "POST", body: fd });
            pushToast({ type: "success", message: `Import job ${r.jobId.slice(0, 8)} started` });
        }
        catch (e) {
            pushToast({ type: "error", message: e.message });
        }
    };
    const exportZip = async () => {
        if (!table) {
            pushToast({ type: "error", message: "Select a table first" });
            return;
        }
        try {
            const r = await api("/export", {
                method: "POST",
                body: JSON.stringify({ connectionId: connId, tables: [table] }),
            });
            setExportJobId(r.jobId);
            pushToast({ type: "info", message: "Export running…" });
        }
        catch (e) {
            pushToast({ type: "error", message: e.message });
        }
    };
    return (_jsxs("div", { className: "text-text-primary space-y-4 p-4 text-sm", children: [_jsxs("select", { className: "border-border bg-bg block max-w-xs rounded border px-2 py-1", value: table, onChange: (e) => setTable(e.target.value), children: [_jsx("option", { value: "", children: "Table\u2026" }), tables.map((t) => (_jsx("option", { value: t, children: t }, t)))] }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsxs("label", { className: "bg-primary cursor-pointer rounded px-3 py-1 text-white", children: ["Import CSV", _jsx("input", { type: "file", accept: ".csv", className: "hidden", onChange: (e) => {
                                    const f = e.target.files?.[0];
                                    if (f)
                                        void importCsv(f);
                                } })] }), _jsx("button", { type: "button", className: "border-border rounded border px-3 py-1", onClick: () => void exportZip(), children: "Export ZIP" }), exportJobId && (_jsx("a", { className: "text-primary underline", href: `/api/export/${exportJobId}/download`, children: "Download" }))] })] }));
}
export function MonitorTab() {
    const connId = useConnId();
    const [overview, setOverview] = useState(null);
    useEffect(() => {
        void api(`/monitor/${connId}/overview`)
            .then(setOverview)
            .catch(() => setOverview(null));
    }, [connId]);
    return (_jsx("pre", { className: "text-text-primary oridb-scrollbar m-4 max-h-[400px] overflow-auto rounded bg-code-bg p-3 text-xs", children: JSON.stringify(overview, null, 2) }));
}
export function DiffTab() {
    const [a, setA] = useState("SELECT 1 AS id, 'x' AS v");
    const [b, setB] = useState("SELECT 1 AS id, 'y' AS v");
    const [key, setKey] = useState("id");
    const connId = useConnId();
    const [rows, setRows] = useState([]);
    const pushToast = useUiStore((s) => s.pushToast);
    const run = async () => {
        try {
            const [ra, rb] = await Promise.all([
                api("/query", {
                    method: "POST",
                    body: JSON.stringify({ connectionId: connId, sql: a }),
                }),
                api("/query", {
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
        }
        catch (e) {
            pushToast({ type: "error", message: e.message });
        }
    };
    const cols = rows[0] != null
        ? Object.keys(rows[0])
            .filter((k) => k !== "__diff")
            .map((k) => ({ id: k, header: k }))
        : [];
    return (_jsxs("div", { className: "flex flex-col gap-2 p-2", children: [_jsxs("div", { className: "grid gap-2 md:grid-cols-2", children: [_jsx("textarea", { className: "border-border bg-bg text-text-primary min-h-[100px] rounded border p-2 font-mono text-xs", value: a, onChange: (e) => setA(e.target.value) }), _jsx("textarea", { className: "border-border bg-bg text-text-primary min-h-[100px] rounded border p-2 font-mono text-xs", value: b, onChange: (e) => setB(e.target.value) })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("label", { className: "text-text-secondary text-xs", children: "Key" }), _jsx("input", { className: "border-border bg-bg rounded border px-2 py-1 text-xs", value: key, onChange: (e) => setKey(e.target.value) }), _jsx("button", { type: "button", className: "bg-primary rounded px-3 py-1 text-xs text-white", onClick: () => void run(), children: "Run both" })] }), _jsx("div", { className: "h-56", children: _jsx(VirtualDataGrid, { columns: cols, rows: rows }) })] }));
}
export function MultiTab() {
    const [sql, setSql] = useState("SELECT current_database() AS db, now() AS t;");
    const [list, setList] = useState([]);
    const [sel, setSel] = useState([]);
    const [out, setOut] = useState({});
    const pushToast = useUiStore((s) => s.pushToast);
    useEffect(() => {
        void api("/connections").then((r) => setList(r.connections));
    }, []);
    const run = async () => {
        const results = {};
        for (const id of sel) {
            try {
                const r = await api("/query", {
                    method: "POST",
                    body: JSON.stringify({ connectionId: id, sql }),
                });
                results[id] = r.results;
            }
            catch (e) {
                results[id] = { error: e.message };
            }
        }
        setOut(results);
        pushToast({ type: "success", message: "Multi-run complete" });
    };
    return (_jsxs("div", { className: "flex flex-col gap-2 p-2 text-sm", children: [_jsx("textarea", { className: "border-border bg-bg text-text-primary min-h-[100px] rounded border p-2 font-mono text-xs", value: sql, onChange: (e) => setSql(e.target.value) }), _jsx("div", { className: "text-text-secondary text-xs", children: "Select connections" }), _jsx("div", { className: "flex flex-wrap gap-2", children: list.map((c) => (_jsxs("label", { className: "flex items-center gap-1 text-xs", children: [_jsx("input", { type: "checkbox", checked: sel.includes(c.id), onChange: (e) => setSel((s) => e.target.checked ? [...s, c.id] : s.filter((x) => x !== c.id)) }), c.name] }, c.id))) }), _jsx("button", { type: "button", className: "bg-primary w-fit rounded px-3 py-1 text-white", onClick: () => void run(), children: "Run on all selected" }), _jsx("pre", { className: "bg-code-bg oridb-scrollbar max-h-64 overflow-auto rounded p-2 text-[11px]", children: JSON.stringify(out, null, 2) })] }));
}
export function SavedTab() {
    const [queries, setQueries] = useState([]);
    useEffect(() => {
        void api("/saved-queries").then((r) => setQueries(r.queries));
    }, []);
    return (_jsx("ul", { className: "text-text-primary p-4 text-sm", children: queries.map((q) => (_jsx("li", { children: q.name }, q.id))) }));
}
export function SettingsTab() {
    const theme = useUiStore((s) => s.theme);
    const setTheme = useUiStore((s) => s.setTheme);
    return (_jsxs("div", { className: "text-text-primary space-y-3 p-4 text-sm", children: [_jsxs("div", { children: [_jsx("div", { className: "text-text-secondary mb-1 text-xs uppercase", children: "Theme" }), _jsxs("select", { className: "border-border bg-bg rounded border px-2 py-1", value: theme, onChange: (e) => setTheme(e.target.value), children: [_jsx("option", { value: "light", children: "Light" }), _jsx("option", { value: "dark", children: "Dark" }), _jsx("option", { value: "system", children: "System" })] })] }), _jsxs("p", { className: "text-text-muted text-xs", children: ["Local credentials are encrypted with AES-256-GCM when", " ", _jsx("code", { children: "ORIDB_MASTER_PASSWORD" }), " is set (see backend README)."] })] }));
}
