import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * App chrome — top bar, theme toggle, notifications, command palette trigger.
 */
import { Link, NavLink } from "react-router-dom";
import { Moon, Sun, Bell, Command, Database } from "lucide-react";
import { useEffect, useState } from "react";
import { useUiStore } from "../stores/uiStore";
import { useSessionStore } from "../stores/sessionStore";
import { useNotificationStore } from "../stores/notificationStore";
import { useAppHotkeys } from "../hooks/useAppHotkeys";
import { CommandPalette } from "./CommandPalette";
import { ToastHost } from "./ToastHost";
function NavItem({ to, children }) {
    return (_jsx(NavLink, { to: to, children: ({ isActive }) => (_jsx("span", { className: "oridb-nav-pill", "data-active": isActive, children: children })) }));
}
function IconBtn({ title, onClick, children, }) {
    return (_jsx("button", { type: "button", title: title, "aria-label": title, className: "text-text-muted hover:text-text-primary hover:bg-selection flex h-8 w-8 items-center justify-center rounded-lg transition-colors duration-150", onClick: onClick, children: children }));
}
export function AppShell({ children }) {
    const theme = useUiStore((s) => s.theme);
    const setTheme = useUiStore((s) => s.setTheme);
    const setCommandOpen = useUiStore((s) => s.setCommandOpen);
    const items = useNotificationStore((s) => s.items);
    const [bellOpen, setBellOpen] = useState(false);
    useAppHotkeys();
    useEffect(() => {
        const root = document.documentElement;
        const dark = theme === "dark" ||
            (theme === "system" &&
                window.matchMedia("(prefers-color-scheme: dark)").matches);
        root.classList.toggle("dark", dark);
    }, [theme]);
    useEffect(() => {
        const mq = window.matchMedia("(prefers-color-scheme: dark)");
        const fn = () => {
            if (theme !== "system")
                return;
            document.documentElement.classList.toggle("dark", mq.matches);
        };
        mq.addEventListener("change", fn);
        return () => mq.removeEventListener("change", fn);
    }, [theme]);
    useEffect(() => {
        const ws = new WebSocket(`${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws`);
        ws.onopen = () => {
            ws.send(JSON.stringify({ type: "subscribe", channel: "notifications" }));
        };
        ws.onmessage = (ev) => {
            try {
                const d = JSON.parse(String(ev.data));
                if (d.type === "notify") {
                    useNotificationStore.getState().push({
                        type: "info",
                        title: String(d.title ?? "Notice"),
                        body: d.body ? String(d.body) : undefined,
                    });
                }
            }
            catch {
                /* ignore */
            }
        };
        return () => ws.close();
    }, []);
    const activeId = useSessionStore((s) => s.activeConnectionId);
    const connectionName = useSessionStore((s) => s.connectionName);
    const engine = useSessionStore((s) => s.engine);
    const connected = useSessionStore((s) => s.connected);
    const isDark = theme === "dark" ||
        (theme === "system" &&
            typeof window !== "undefined" &&
            window.matchMedia("(prefers-color-scheme: dark)").matches);
    return (_jsxs("div", { className: "bg-bg text-text-primary flex min-h-screen flex-col", children: [_jsxs("header", { className: "border-border bg-surface/80 sticky top-0 z-50 flex h-14 items-center gap-4 border-b px-4 backdrop-blur-md", children: [_jsxs(Link, { to: "/", className: "text-text-primary flex shrink-0 items-center gap-2 font-semibold tracking-tight", children: [_jsx("span", { className: "bg-primary/10 text-primary flex h-8 w-8 items-center justify-center rounded-lg", children: _jsx(Database, { className: "h-4 w-4", strokeWidth: 2.25 }) }), _jsxs("span", { children: [_jsx("span", { className: "text-primary", children: "Ori" }), "DB"] })] }), _jsxs("nav", { className: "flex items-center gap-1", children: [_jsx(NavItem, { to: "/connections", children: "Connections" }), _jsx(NavItem, { to: "/workspace", children: "Workspace" })] }), _jsxs("div", { className: "ml-auto flex items-center gap-2", children: [activeId && (_jsxs(Link, { to: "/workspace", className: "border-border bg-surface-elevated hover:border-primary/30 hidden items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors duration-150 sm:flex", children: [_jsx("span", { className: `h-2 w-2 shrink-0 rounded-full ${connected ? "bg-success" : "bg-warning"}` }), _jsx("span", { className: "text-text-primary max-w-[120px] truncate font-medium", children: connectionName ?? "Connected" }), engine && (_jsx("span", { className: "text-text-muted font-mono text-[10px] uppercase", children: engine }))] })), _jsx(IconBtn, { title: "Command palette (Ctrl+K)", onClick: () => setCommandOpen(true), children: _jsx(Command, { size: 17, strokeWidth: 2 }) }), _jsxs("div", { className: "relative", children: [_jsxs(IconBtn, { title: "Notifications", onClick: () => setBellOpen((v) => !v), children: [_jsx(Bell, { size: 17, strokeWidth: 2 }), items.length > 0 && (_jsx("span", { className: "bg-primary absolute top-1 right-1 h-1.5 w-1.5 rounded-full" }))] }), bellOpen && (_jsxs(_Fragment, { children: [_jsx("button", { type: "button", className: "fixed inset-0 z-40", "aria-label": "Close notifications", onClick: () => setBellOpen(false) }), _jsxs("div", { className: "oridb-card border-border absolute right-0 z-50 mt-2 w-80 overflow-hidden p-0 shadow-lg", children: [_jsx("div", { className: "border-border border-b px-3 py-2 text-xs font-semibold tracking-wide uppercase", children: "Notifications" }), _jsx("div", { className: "oridb-scrollbar max-h-64 overflow-y-auto p-2", children: items.length === 0 ? (_jsx("p", { className: "text-text-muted py-6 text-center text-xs", children: "No notifications yet" })) : (items.map((n) => (_jsxs("div", { className: "hover:bg-selection rounded-lg px-2 py-2 transition-colors", children: [_jsx("div", { className: "text-text-primary text-sm font-medium", children: n.title }), n.body && (_jsx("div", { className: "text-text-muted mt-0.5 text-xs", children: n.body }))] }, n.id)))) })] })] }))] }), _jsx(IconBtn, { title: "Cycle theme", onClick: () => {
                                    if (theme === "light")
                                        setTheme("dark");
                                    else if (theme === "dark")
                                        setTheme("system");
                                    else
                                        setTheme("light");
                                }, children: isDark ? _jsx(Sun, { size: 17, strokeWidth: 2 }) : _jsx(Moon, { size: 17, strokeWidth: 2 }) })] })] }), _jsx("main", { className: "min-h-0 flex-1", children: children }), _jsx(ToastHost, {}), _jsx(CommandPalette, {})] }));
}
