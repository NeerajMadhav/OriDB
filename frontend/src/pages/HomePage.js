import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Landing — welcome when no connection active; recent connections.
 */
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useSessionStore } from "../stores/sessionStore";
import { useUiStore } from "../stores/uiStore";
const RECENT_KEY = "oridb-recent-connections";
function loadRecent() {
    try {
        return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    }
    catch {
        return [];
    }
}
function pushRecent(id) {
    const list = [id, ...loadRecent().filter((x) => x !== id)].slice(0, 8);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
}
export function HomePage() {
    const nav = useNavigate();
    const setActive = useSessionStore((s) => s.setActive);
    const pushToast = useUiStore((s) => s.pushToast);
    const [recent, setRecent] = useState([]);
    useEffect(() => {
        void api("/connections")
            .then((r) => {
            const ids = loadRecent();
            setRecent(ids
                .map((id) => r.connections.find((c) => c.id === id))
                .filter((c) => !!c));
        })
            .catch(() => setRecent([]));
    }, []);
    const connect = async (c) => {
        try {
            await api(`/connections/${c.id}/connect`, { method: "POST" });
            pushRecent(c.id);
            setActive(c.id, true, { name: c.name, engine: c.engine });
            pushToast({ type: "success", message: `Connected to ${c.name}` });
            nav("/workspace");
        }
        catch (e) {
            pushToast({ type: "error", message: e.message });
        }
    };
    return (_jsxs("div", { className: "flex min-h-[calc(100vh-52px)] flex-col items-center justify-center gap-6 px-4", children: [_jsxs("div", { className: "text-center", children: [_jsxs("h1", { className: "text-text-primary mb-2 text-3xl font-semibold tracking-tight", children: [_jsx("span", { className: "text-primary", children: "Ori" }), _jsx("span", { children: "DB" })] }), _jsx("p", { className: "text-text-secondary text-sm", children: "Your universal database workspace" })] }), _jsxs("div", { className: "flex flex-wrap justify-center gap-3", children: [_jsx(Link, { to: "/connections", className: "bg-primary hover:bg-primary-hover rounded-full px-5 py-2.5 text-sm font-medium text-white transition-colors duration-150", children: "New connection" }), _jsx(Link, { to: "/connections", className: "border-border text-text-primary hover:bg-selection rounded-full border px-5 py-2.5 text-sm transition-colors duration-150", children: "Import connection" })] }), recent.length > 0 && (_jsxs("div", { className: "border-border bg-surface-elevated w-full max-w-md rounded-lg border p-4", children: [_jsx("h2", { className: "text-text-secondary mb-3 text-xs font-semibold uppercase tracking-wide", children: "Recent connections" }), _jsx("ul", { className: "space-y-2", children: recent.map((c) => (_jsx("li", { children: _jsxs("button", { type: "button", className: "hover:bg-selection border-border flex w-full items-center justify-between rounded border px-3 py-2 text-left text-sm transition-colors duration-150", onClick: () => void connect(c), children: [_jsxs("span", { children: [_jsx("span", { className: "text-text-primary font-medium", children: c.name }), _jsxs("span", { className: "text-text-muted ml-2 text-xs", children: [c.engine, c.host ? ` · ${c.host}` : ""] })] }), c.environment && (_jsx("span", { className: "bg-selection text-text-secondary rounded-full px-2 py-0.5 text-[10px] uppercase", children: c.environment }))] }) }, c.id))) })] })), _jsxs("p", { className: "text-text-muted text-xs", children: ["Press ", _jsx("kbd", { className: "rounded border px-1", children: "Ctrl" }), "+", _jsx("kbd", { className: "rounded border px-1", children: "K" }), " for the command palette"] }), _jsx("p", { className: "text-text-muted fixed right-3 bottom-3 text-[10px]", children: "v1.0.0" })] }));
}
