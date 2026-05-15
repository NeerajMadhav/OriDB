import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Landing — welcome when no connection active; recent connections.
 */
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Database, Upload } from "lucide-react";
import { api } from "../api/client";
import { useSessionStore } from "../stores/sessionStore";
import { useUiStore } from "../stores/uiStore";
import { OpenSqlitePanel } from "../components/OpenSqlitePanel";
import { Btn, Card, EngineBadge, Kbd } from "../components/ui";
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
            const prev = useSessionStore.getState().activeConnectionId;
            if (prev && prev !== c.id) {
                await api(`/connections/${prev}/disconnect`, { method: "POST" }).catch(() => undefined);
            }
            await api(`/connections/${c.id}/connect`, { method: "POST" });
            pushRecent(c.id);
            setActive(c.id, true, {
                name: c.name,
                engine: c.engine,
                defaultSchema: c.defaultSchema,
            });
            pushToast({ type: "success", message: `Connected to ${c.name}` });
            nav("/workspace");
        }
        catch (e) {
            pushToast({ type: "error", message: e.message });
        }
    };
    return (_jsxs("div", { className: "relative flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center px-4 py-16", children: [_jsxs("div", { className: "mb-10 text-center", children: [_jsx("div", { className: "bg-primary/10 text-primary mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl shadow-sm", children: _jsx(Database, { className: "h-7 w-7", strokeWidth: 1.75 }) }), _jsxs("h1", { className: "text-text-primary mb-2 text-4xl font-semibold tracking-tight", children: [_jsx("span", { className: "text-primary", children: "Ori" }), "DB"] }), _jsx("p", { className: "text-text-secondary mx-auto max-w-sm text-sm leading-relaxed", children: "Your universal database workspace \u2014 connect, query, and explore with a calm, focused UI." })] }), _jsxs("div", { className: "mb-10 flex flex-wrap justify-center gap-3", children: [_jsx(Link, { to: "/connections", children: _jsxs(Btn, { variant: "primary", className: "gap-2 px-6", children: [_jsx(Database, { className: "h-4 w-4" }), "New connection"] }) }), _jsx(Link, { to: "/connections", children: _jsxs(Btn, { variant: "secondary", className: "gap-2 px-6", children: [_jsx(Upload, { className: "h-4 w-4" }), "Import connection"] }) })] }), _jsx("div", { className: "mb-10 w-full max-w-xl", children: _jsx(OpenSqlitePanel, { compact: true, onOpened: (id) => {
                        pushRecent(id);
                        nav("/workspace");
                    } }) }), recent.length > 0 && (_jsxs(Card, { className: "w-full max-w-lg", padding: "md", children: [_jsx("h2", { className: "text-text-muted mb-4 text-[11px] font-semibold tracking-widest uppercase", children: "Recent connections" }), _jsx("ul", { className: "space-y-1", children: recent.map((c) => (_jsx("li", { children: _jsxs("button", { type: "button", className: "oridb-connection-row group w-full", onClick: () => void connect(c), children: [_jsx("span", { className: "bg-primary/10 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", children: _jsx(Database, { className: "h-4 w-4" }) }), _jsxs("span", { className: "min-w-0 flex-1 text-left", children: [_jsx("span", { className: "text-text-primary block truncate font-medium", children: c.name }), _jsx("span", { className: "text-text-muted block truncate text-xs", children: c.host ?? c.engine })] }), _jsx(EngineBadge, { engine: c.engine }), c.environment && (_jsx("span", { className: "text-text-muted hidden rounded-md bg-bg px-2 py-0.5 text-[10px] uppercase sm:inline", children: c.environment })), _jsx(ArrowRight, { className: "text-text-muted h-4 w-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" })] }) }, c.id))) })] })), _jsxs("p", { className: "text-text-muted mt-10 flex items-center gap-1.5 text-xs", children: ["Press ", _jsx(Kbd, { children: "Ctrl" }), " + ", _jsx(Kbd, { children: "K" }), " for the command palette"] }), _jsx("p", { className: "text-text-muted/60 fixed right-4 bottom-4 font-mono text-[10px]", children: "v1.0.0" })] }));
}
