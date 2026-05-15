import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Right inspector — context for table, column, or query metrics.
 */
import { Activity, Table2 } from "lucide-react";
import { useWorkspaceStore } from "../stores/workspaceStore";
import { EmptyState, PanelHeader } from "./ui";
export function InspectorPanel() {
    const inspector = useWorkspaceStore((s) => s.inspector);
    if (inspector.type === "none") {
        return (_jsxs("div", { className: "flex h-full flex-col", children: [_jsx(PanelHeader, { title: "Inspector", subtitle: "Details & metrics" }), _jsx(EmptyState, { icon: _jsx(Table2, { className: "h-5 w-5" }), title: "Nothing selected", description: "Select a table from the sidebar or run a query to see details here." })] }));
    }
    if (inspector.type === "table") {
        const s = inspector.stats ?? {};
        return (_jsxs("div", { className: "flex h-full flex-col", children: [_jsx(PanelHeader, { title: "Table", subtitle: inspector.table }), _jsxs("dl", { className: "oridb-scrollbar flex-1 space-y-3 overflow-y-auto px-3 pb-4 text-xs", children: [Object.entries(s).map(([k, v]) => (_jsxs("div", { className: "border-border border-b pb-2 last:border-0", children: [_jsx("dt", { className: "text-text-muted mb-0.5 capitalize", children: k.replace(/([A-Z])/g, " $1") }), _jsx("dd", { className: "text-text-primary font-mono text-sm", children: String(v ?? "—") })] }, k))), Object.keys(s).length === 0 && (_jsx("p", { className: "text-text-muted", children: "No statistics available for this table." }))] })] }));
    }
    if (inspector.type === "column") {
        const s = inspector.stats ?? {};
        return (_jsxs("div", { className: "flex h-full flex-col", children: [_jsx(PanelHeader, { title: "Column", subtitle: `${inspector.table}.${inspector.column}` }), _jsx("dl", { className: "oridb-scrollbar flex-1 space-y-3 overflow-y-auto px-3 pb-4 text-xs", children: Object.entries(s).map(([k, v]) => (_jsxs("div", { className: "border-border border-b pb-2 last:border-0", children: [_jsx("dt", { className: "text-text-muted mb-0.5", children: k }), _jsx("dd", { className: "text-text-primary font-mono text-sm", children: String(v ?? "—") })] }, k))) })] }));
    }
    return (_jsxs("div", { className: "flex h-full flex-col", children: [_jsx(PanelHeader, { title: "Query", subtitle: "Last execution" }), _jsxs("div", { className: "space-y-3 px-3 text-xs", children: [_jsxs("div", { className: "oridb-panel flex items-center gap-3 p-3", children: [_jsx(Activity, { className: "text-primary h-4 w-4 shrink-0" }), _jsxs("div", { children: [_jsx("p", { className: "text-text-muted", children: "Status" }), _jsx("p", { className: "text-text-primary font-medium capitalize", children: inspector.status ?? "—" })] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(Stat, { label: "Duration", value: inspector.durationMs != null ? `${inspector.durationMs} ms` : "—" }), _jsx(Stat, { label: "Rows", value: inspector.rows != null ? String(inspector.rows) : "—" })] })] })] }));
}
function Stat({ label, value }) {
    return (_jsxs("div", { className: "oridb-panel p-2.5", children: [_jsx("p", { className: "text-text-muted text-[10px] uppercase tracking-wide", children: label }), _jsx("p", { className: "text-text-primary mt-0.5 font-mono text-sm font-medium", children: value })] }));
}
