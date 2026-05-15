import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Sidebar schema tree — databases/schemas, tables, refresh.
 */
import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { api } from "../api/client";
import { useSessionStore } from "../stores/sessionStore";
export function SchemaExplorer({ onSelectTable, }) {
    const connId = useSessionStore((s) => s.activeConnectionId);
    const engine = useSessionStore((s) => s.engine);
    const schema = useSessionStore((s) => s.selectedSchema);
    const setSchema = useSessionStore((s) => s.setSelectedSchema);
    const [schemas, setSchemas] = useState([]);
    const [tables, setTables] = useState([]);
    const [filter, setFilter] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const loadSchemas = useCallback(async () => {
        if (!connId)
            return;
        try {
            const r = await api(`/schema/${connId}`);
            const list = r.schemas?.length
                ? r.schemas
                : engine === "sqlite"
                    ? ["main"]
                    : ["public"];
            setSchemas(list);
            if (!list.includes(schema)) {
                setSchema(list[0] ?? "public");
            }
        }
        catch {
            setSchemas(engine === "sqlite" ? ["main"] : ["public"]);
        }
    }, [connId, engine, schema, setSchema]);
    const loadTables = useCallback(async () => {
        if (!connId) {
            setTables([]);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const q = engine === "sqlite" ? "" : `?schema=${encodeURIComponent(schema)}`;
            const r = await api(`/schema/${connId}/tables${q}`);
            setTables(r.tables ?? []);
        }
        catch (e) {
            setTables([]);
            setError(e instanceof Error ? e.message : String(e));
        }
        finally {
            setLoading(false);
        }
    }, [connId, schema, engine]);
    useEffect(() => {
        void loadSchemas();
    }, [loadSchemas]);
    useEffect(() => {
        void loadTables();
    }, [loadTables]);
    const visible = tables.filter((t) => t.name.toLowerCase().includes(filter.toLowerCase()));
    if (!connId) {
        return (_jsxs("div", { className: "text-text-muted flex h-full flex-col p-3 text-xs", children: [_jsx("p", { children: "Connect to a database to browse tables." }), _jsxs("p", { className: "text-text-muted mt-2", children: ["Go to ", _jsx("strong", { className: "text-text-secondary", children: "Connections" }), ", save a profile, then click", " ", _jsx("strong", { className: "text-text-secondary", children: "Connect" }), "."] })] }));
    }
    return (_jsxs("div", { className: "flex h-full min-h-0 flex-col text-xs", children: [_jsxs("div", { className: "border-border space-y-2 border-b p-2", children: [schemas.length > 1 && (_jsx("select", { className: "border-border bg-bg text-text-primary w-full rounded border px-2 py-1", value: schema, onChange: (e) => setSchema(e.target.value), "aria-label": "Schema", children: schemas.map((s) => (_jsx("option", { value: s, children: s }, s))) })), schemas.length === 1 && (_jsxs("div", { className: "text-text-muted truncate", title: schemas[0], children: ["Schema: ", _jsx("span", { className: "text-text-primary", children: schemas[0] })] })), _jsxs("div", { className: "flex gap-1", children: [_jsx("input", { className: "border-border bg-bg text-text-primary min-w-0 flex-1 rounded border px-2 py-1", placeholder: "Filter tables\u2026", value: filter, onChange: (e) => setFilter(e.target.value) }), _jsx("button", { type: "button", title: "Refresh schema", className: "border-border hover:bg-selection shrink-0 rounded border p-1", onClick: () => {
                                    void loadSchemas();
                                    void loadTables();
                                }, children: _jsx(RefreshCw, { className: `h-3.5 w-3.5 ${loading ? "animate-spin" : ""}` }) })] })] }), _jsxs("div", { className: "oridb-scrollbar flex-1 overflow-y-auto p-2", children: [loading && tables.length === 0 && (_jsx("p", { className: "text-text-muted animate-pulse", children: "Loading tables\u2026" })), error && _jsx("p", { className: "text-error mb-2", children: error }), !loading && !error && visible.length === 0 && (_jsx("p", { className: "text-text-muted", children: "No tables in this schema. Run SQL to create tables, or pick another schema." })), visible.map((t) => (_jsxs("button", { type: "button", title: `Open ${t.name}`, className: "hover:bg-selection text-text-primary mb-0.5 flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left", onClick: () => onSelectTable?.(t.name, schema), children: [_jsx("span", { className: "text-text-muted w-3 shrink-0 font-mono text-[10px]", children: t.type === "view" ? "V" : "T" }), _jsx("span", { className: "truncate", children: t.name })] }, t.name)))] }), _jsxs("p", { className: "text-text-muted border-border border-t p-2", children: [visible.length, " table", visible.length === 1 ? "" : "s"] })] }));
}
