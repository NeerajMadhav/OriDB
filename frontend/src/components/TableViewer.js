import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Table data viewer with CRUD — data, schema, DDL tabs.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { VirtualDataGrid } from "./VirtualDataGrid";
import { useUiStore } from "../stores/uiStore";
import { useWorkspaceStore } from "../stores/workspaceStore";
export function TableViewer({ connId, table, schema = "public", }) {
    const pushToast = useUiStore((s) => s.pushToast);
    const setInspector = useWorkspaceStore((s) => s.setInspector);
    const [tab, setTab] = useState("data");
    const [rows, setRows] = useState([]);
    const [columns, setColumns] = useState([]);
    const [ddl, setDdl] = useState("");
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(true);
    const [showInsert, setShowInsert] = useState(false);
    const [draft, setDraft] = useState({});
    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const [data, cols, ddlRes, statsRes] = await Promise.all([
                api(`/rows/${connId}/${encodeURIComponent(table)}?schema=${encodeURIComponent(schema)}&limit=500`),
                api(`/schema/${connId}/tables/${encodeURIComponent(table)}/columns?schema=${encodeURIComponent(schema)}`),
                api(`/schema/${connId}/tables/${encodeURIComponent(table)}/ddl?schema=${encodeURIComponent(schema)}`),
                api(`/schema/${connId}/tables/${encodeURIComponent(table)}/stats?schema=${encodeURIComponent(schema)}`),
            ]);
            setRows(data.rows);
            setColumns(cols.columns);
            setDdl(ddlRes.ddl);
            setStats(statsRes.stats);
            setInspector({ type: "table", table, stats: statsRes.stats });
        }
        catch (e) {
            pushToast({ type: "error", message: e.message });
        }
        finally {
            setLoading(false);
        }
    }, [connId, table, schema, pushToast, setInspector]);
    useEffect(() => {
        void refresh();
    }, [refresh]);
    const gridCols = useMemo(() => (rows[0] ? Object.keys(rows[0]) : columns.map((c) => c.name)).map((name) => ({
        id: name,
        header: name,
    })), [rows, columns]);
    const insertRow = async () => {
        const row = {};
        for (const [k, v] of Object.entries(draft)) {
            if (v !== "")
                row[k] = v;
        }
        try {
            await api(`/rows/${connId}/${encodeURIComponent(table)}?schema=${encodeURIComponent(schema)}`, {
                method: "POST",
                body: JSON.stringify({ row }),
            });
            pushToast({ type: "success", message: "Row inserted" });
            setShowInsert(false);
            setDraft({});
            await refresh();
        }
        catch (e) {
            pushToast({ type: "error", message: e.message });
        }
    };
    const deleteSelected = async (row) => {
        const pk = columns.find((c) => c.isPk)?.name ?? Object.keys(row)[0];
        if (!pk || row[pk] == null)
            return;
        if (!confirm(`Delete row where ${pk} = ${String(row[pk])}?`))
            return;
        try {
            await api(`/rows/${connId}/${encodeURIComponent(table)}?schema=${encodeURIComponent(schema)}&where=${encodeURIComponent(`${pk} = '${String(row[pk]).replaceAll("'", "''")}'`)}`, { method: "DELETE" });
            pushToast({ type: "success", message: "Row deleted" });
            await refresh();
        }
        catch (e) {
            pushToast({ type: "error", message: e.message });
        }
    };
    if (loading) {
        return (_jsx("div", { className: "text-text-muted animate-pulse p-4 text-sm", children: "Loading table\u2026" }));
    }
    return (_jsxs("div", { className: "flex h-full min-h-0 flex-col", children: [_jsxs("div", { className: "border-border flex flex-wrap items-center gap-2 border-b px-2 py-1.5", children: [_jsxs("span", { className: "text-text-primary text-sm font-medium", children: [schema, " \u203A ", table] }), _jsxs("span", { className: "text-text-muted text-xs", children: [String(stats.rowCount ?? rows.length), " rows"] }), _jsxs("div", { className: "ml-auto flex gap-1", children: [_jsx("button", { type: "button", title: "Refresh", className: "border-border rounded border px-2 py-0.5 text-xs", onClick: () => void refresh(), children: "Refresh" }), _jsx("button", { type: "button", title: "Add row", className: "bg-primary rounded px-2 py-0.5 text-xs text-white", onClick: () => {
                                    setDraft(Object.fromEntries(columns.map((c) => [c.name, ""])));
                                    setShowInsert(true);
                                }, children: "Add row" })] })] }), _jsx("div", { className: "border-border flex gap-1 border-b px-2 py-1 text-xs", children: ["data", "schema", "ddl"].map((t) => (_jsx("button", { type: "button", className: `rounded px-2 py-0.5 capitalize ${tab === t ? "bg-selection" : ""}`, onClick: () => setTab(t), children: t }, t))) }), _jsxs("div", { className: "min-h-0 flex-1 p-1", children: [tab === "data" && (_jsx(VirtualDataGrid, { columns: gridCols, rows: rows, onRowDelete: (row) => void deleteSelected(row) })), tab === "schema" && (_jsxs("table", { className: "w-full text-left text-xs", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-text-muted border-border border-b", children: [_jsx("th", { className: "p-2", children: "Name" }), _jsx("th", { className: "p-2", children: "Type" }), _jsx("th", { className: "p-2", children: "Null" }), _jsx("th", { className: "p-2", children: "PK" })] }) }), _jsx("tbody", { children: columns.map((c) => (_jsxs("tr", { className: "border-border border-b", children: [_jsx("td", { className: "text-text-primary p-2 font-mono", children: c.name }), _jsx("td", { className: "p-2", children: c.dataType }), _jsx("td", { className: "p-2", children: c.isNullable ? "YES" : "NO" }), _jsx("td", { className: "p-2", children: c.isPk ? "✓" : "" })] }, c.name))) })] })), tab === "ddl" && (_jsx("pre", { className: "bg-code-bg oridb-scrollbar text-text-primary overflow-auto rounded p-2 font-mono text-xs", children: ddl }))] }), showInsert && (_jsx("div", { className: "fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4", role: "dialog", "aria-modal": "true", children: _jsxs("div", { className: "bg-surface-elevated border-border w-full max-w-md rounded-lg border p-4 shadow-lg", children: [_jsx("h3", { className: "text-text-primary mb-3 font-semibold", children: "Insert row" }), _jsx("div", { className: "max-h-64 space-y-2 overflow-y-auto", children: columns.map((c) => (_jsxs("label", { className: "block text-xs", children: [_jsxs("span", { className: "text-text-muted", children: [c.name, !c.isNullable && " *"] }), _jsx("input", { className: "border-border bg-bg text-text-primary mt-0.5 w-full rounded border px-2 py-1 font-mono", value: draft[c.name] ?? "", onChange: (e) => setDraft((d) => ({ ...d, [c.name]: e.target.value })) })] }, c.name))) }), _jsxs("div", { className: "mt-4 flex justify-end gap-2", children: [_jsx("button", { type: "button", className: "border-border rounded border px-3 py-1 text-sm", onClick: () => setShowInsert(false), children: "Cancel" }), _jsx("button", { type: "button", className: "bg-primary rounded px-3 py-1 text-sm text-white", onClick: () => void insertRow(), children: "Insert" })] })] }) }))] }));
}
