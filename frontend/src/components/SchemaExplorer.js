import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Sidebar schema tree — databases/schemas, tables, refresh.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, Table2, Eye } from "lucide-react";
import { api } from "../api/client";
import { defaultSchemaForEngine, useSessionStore } from "../stores/sessionStore";
import { PanelHeader } from "./ui";
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
    const autoPicked = useRef(false);
    const loadSchemas = useCallback(async () => {
        if (!connId)
            return;
        try {
            const r = await api(`/schema/${connId}`);
            const fallback = [defaultSchemaForEngine(engine)];
            const list = r.schemas?.length ? r.schemas : fallback;
            setSchemas(list);
            if (!list.includes(schema)) {
                setSchema(list[0] ?? defaultSchemaForEngine(engine));
            }
        }
        catch (e) {
            setSchemas([defaultSchemaForEngine(engine)]);
            setError(e instanceof Error ? e.message : "Could not load schemas");
        }
    }, [connId, engine, schema, setSchema]);
    const loadTables = useCallback(async (schemaName) => {
        if (!connId) {
            setTables([]);
            return [];
        }
        const sch = schemaName ?? schema;
        setLoading(true);
        setError(null);
        try {
            const q = engine === "sqlite" ? "" : `?schema=${encodeURIComponent(sch)}`;
            const r = await api(`/schema/${connId}/tables${q}`);
            const list = r.tables ?? [];
            setTables(list);
            return list;
        }
        catch (e) {
            setTables([]);
            setError(e instanceof Error ? e.message : String(e));
            return [];
        }
        finally {
            setLoading(false);
        }
    }, [connId, schema, engine]);
    /** If current schema is empty, try another schema that has tables */
    const tryAutoSchema = useCallback(async (currentTables, schemaList) => {
        if (autoPicked.current ||
            currentTables.length > 0 ||
            schemaList.length < 2 ||
            engine === "sqlite") {
            return;
        }
        for (const sch of schemaList) {
            if (sch === schema)
                continue;
            const found = await loadTables(sch);
            if (found.length > 0) {
                autoPicked.current = true;
                setSchema(sch);
                return;
            }
        }
    }, [engine, loadTables, schema, setSchema]);
    useEffect(() => {
        autoPicked.current = false;
        void loadSchemas();
    }, [loadSchemas, connId]);
    useEffect(() => {
        void (async () => {
            const list = await loadTables();
            if (list.length === 0 && schemas.length > 1) {
                await tryAutoSchema(list, schemas);
            }
        })();
    }, [loadTables, schemas, tryAutoSchema]);
    const visible = tables.filter((t) => t.name.toLowerCase().includes(filter.toLowerCase()));
    if (!connId) {
        return (_jsxs("div", { className: "text-text-muted flex h-full flex-col p-4 text-xs leading-relaxed", children: [_jsx(PanelHeader, { title: "Schema", subtitle: "No connection" }), _jsxs("p", { className: "px-3", children: ["Connect to a database to browse tables. Open", " ", _jsx("strong", { className: "text-text-secondary", children: "Connections" }), " and click", " ", _jsx("strong", { className: "text-text-secondary", children: "Connect" }), "."] })] }));
    }
    return (_jsxs("div", { className: "flex h-full min-h-0 flex-col", children: [_jsx(PanelHeader, { title: "Schema", subtitle: engine === "sqlite" ? "SQLite" : schema, action: _jsx("button", { type: "button", title: "Refresh", className: "text-text-muted hover:text-primary rounded-md p-1 transition-colors", onClick: () => {
                        void loadSchemas();
                        void loadTables();
                    }, children: _jsx(RefreshCw, { className: `h-3.5 w-3.5 ${loading ? "animate-spin" : ""}` }) }) }), _jsxs("div", { className: "space-y-2 px-3 pb-2", children: [schemas.length > 0 && engine !== "sqlite" && (_jsx("select", { className: "oridb-input oridb-select h-8 text-xs", value: schema, onChange: (e) => {
                            autoPicked.current = false;
                            setSchema(e.target.value);
                        }, "aria-label": "Schema", children: schemas.map((s) => (_jsx("option", { value: s, children: s }, s))) })), _jsx("input", { className: "oridb-input h-8 text-xs", placeholder: "Filter tables\u2026", value: filter, onChange: (e) => setFilter(e.target.value) })] }), _jsxs("div", { className: "oridb-scrollbar flex-1 overflow-y-auto px-2 pb-2", children: [loading && tables.length === 0 && (_jsx("p", { className: "text-text-muted animate-pulse px-2 py-4 text-xs", children: "Loading tables\u2026" })), error && (_jsx("p", { className: "text-error bg-error/5 mb-2 rounded-md px-2 py-2 text-xs", children: error })), !loading && !error && visible.length === 0 && (_jsxs("p", { className: "text-text-muted px-2 py-4 text-xs leading-relaxed", children: ["No tables in ", _jsx("strong", { children: schema }), ". Try another schema above, or run SQL to create objects."] })), visible.map((t) => (_jsxs("button", { type: "button", title: `Open ${t.name}`, className: "oridb-table-row", onClick: () => onSelectTable?.(t.name, schema), children: [t.type === "view" ? (_jsx(Eye, { className: "text-text-muted h-3.5 w-3.5 shrink-0" })) : (_jsx(Table2, { className: "text-text-muted h-3.5 w-3.5 shrink-0" })), _jsx("span", { className: "truncate", children: t.name })] }, t.name)))] }), _jsxs("div", { className: "border-border text-text-muted border-t px-3 py-2 font-mono text-[10px]", children: [visible.length, " ", visible.length === 1 ? "object" : "objects"] })] }));
}
