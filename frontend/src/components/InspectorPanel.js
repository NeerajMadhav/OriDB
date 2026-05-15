import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Right inspector — context for table, column, or query metrics.
 */
import { useWorkspaceStore } from "../stores/workspaceStore";
export function InspectorPanel() {
    const inspector = useWorkspaceStore((s) => s.inspector);
    if (inspector.type === "none") {
        return (_jsxs("div", { className: "text-text-muted flex h-full flex-col p-3 text-xs", children: [_jsx("div", { className: "text-text-secondary mb-2 font-semibold uppercase tracking-wide", children: "Inspector" }), _jsx("p", { children: "Select a table or run a query to see details here." })] }));
    }
    if (inspector.type === "table") {
        const s = inspector.stats ?? {};
        return (_jsxs("div", { className: "oridb-scrollbar flex h-full flex-col overflow-y-auto p-3 text-xs", children: [_jsx("div", { className: "text-text-secondary mb-2 font-semibold uppercase", children: "Table" }), _jsx("div", { className: "text-text-primary mb-3 font-medium", children: inspector.table }), _jsx("dl", { className: "space-y-2", children: Object.entries(s).map(([k, v]) => (_jsxs("div", { children: [_jsx("dt", { className: "text-text-muted capitalize", children: k.replace(/([A-Z])/g, " $1") }), _jsx("dd", { className: "text-text-primary font-mono", children: String(v ?? "—") })] }, k))) })] }));
    }
    if (inspector.type === "column") {
        const s = inspector.stats ?? {};
        return (_jsxs("div", { className: "oridb-scrollbar flex h-full flex-col overflow-y-auto p-3 text-xs", children: [_jsx("div", { className: "text-text-secondary mb-1 font-semibold uppercase", children: "Column" }), _jsxs("div", { className: "text-text-primary mb-3 font-medium", children: [inspector.table, ".", inspector.column] }), _jsx("dl", { className: "space-y-2", children: Object.entries(s).map(([k, v]) => (_jsxs("div", { children: [_jsx("dt", { className: "text-text-muted", children: k }), _jsx("dd", { className: "text-text-primary font-mono", children: String(v ?? "—") })] }, k))) })] }));
    }
    return (_jsxs("div", { className: "p-3 text-xs", children: [_jsx("div", { className: "text-text-secondary mb-2 font-semibold uppercase", children: "Query" }), _jsxs("p", { children: ["Status: ", inspector.status ?? "—"] }), _jsxs("p", { children: ["Duration: ", inspector.durationMs ?? "—", " ms"] }), _jsxs("p", { children: ["Rows: ", inspector.rows ?? "—"] })] }));
}
