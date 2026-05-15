import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Bottom status bar — connection, query metrics, WebSocket, transaction.
 */
import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useSessionStore } from "../stores/sessionStore";
import { useWorkspaceStore } from "../stores/workspaceStore";
export function StatusBar() {
    const connId = useSessionStore((s) => s.activeConnectionId);
    const connected = useSessionStore((s) => s.connected);
    const connectionName = useSessionStore((s) => s.connectionName);
    const engine = useSessionStore((s) => s.engine);
    const lastQueryMs = useWorkspaceStore((s) => s.lastQueryMs);
    const lastRows = useWorkspaceStore((s) => s.lastRows);
    const lastAffected = useWorkspaceStore((s) => s.lastAffected);
    const wsConnected = useWorkspaceStore((s) => s.wsConnected);
    const inTransaction = useWorkspaceStore((s) => s.inTransaction);
    const setWsConnected = useWorkspaceStore((s) => s.setWsConnected);
    const [conn, setConn] = useState(null);
    useEffect(() => {
        if (!connId) {
            setConn(null);
            return;
        }
        if (connectionName && engine) {
            setConn({ name: connectionName, engine });
            return;
        }
        void api("/connections").then((r) => {
            const c = r.connections.find((x) => x.id === connId);
            setConn(c ? { name: c.name, engine: c.engine } : null);
        });
    }, [connId, connectionName, engine]);
    useEffect(() => {
        const ws = new WebSocket(`${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws`);
        ws.onopen = () => {
            setWsConnected(true);
            ws.send(JSON.stringify({ type: "subscribe", channel: "importProgress" }));
        };
        ws.onclose = () => setWsConnected(false);
        return () => ws.close();
    }, [setWsConnected]);
    const dot = connected && connId
        ? "bg-success shadow-[0_0_6px_var(--success)]"
        : connId
            ? "bg-warning"
            : "bg-error";
    return (_jsxs("footer", { className: "border-border bg-surface text-text-secondary flex h-7 shrink-0 items-center justify-between border-t px-3 font-mono text-[11px]", children: [_jsxs("div", { className: "flex min-w-0 items-center gap-2", children: [_jsx("span", { className: `inline-block h-2 w-2 shrink-0 rounded-full ${dot}`, title: "Connection" }), _jsx("span", { className: "text-text-primary truncate font-medium", children: conn?.name ?? "No connection" }), conn && (_jsx("span", { className: "text-text-muted hidden truncate sm:inline", children: conn.engine }))] }), _jsxs("div", { className: "text-text-muted flex items-center gap-3", children: [lastQueryMs != null && _jsxs("span", { children: [lastQueryMs, " ms"] }), lastRows != null && _jsxs("span", { children: [lastRows, " rows"] }), lastAffected != null && lastAffected > 0 && (_jsxs("span", { children: [lastAffected, " affected"] }))] }), _jsxs("div", { className: "flex items-center gap-2", children: [inTransaction && (_jsx("span", { className: "bg-warning/15 text-warning rounded px-1.5 py-0.5 text-[10px] font-semibold", children: "TX" })), _jsxs("span", { className: wsConnected ? "text-success" : "text-text-muted", children: ["WS ", wsConnected ? "on" : "off"] }), _jsx("span", { className: "text-text-muted/80 rounded border border-border px-1.5 py-0.5 text-[10px]", children: ":8037" })] })] }));
}
