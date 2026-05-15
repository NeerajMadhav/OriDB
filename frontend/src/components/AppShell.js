import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * App chrome — top bar, theme toggle, notifications, command palette trigger.
 */
import { Link, NavLink } from "react-router-dom";
import { Moon, Sun, Bell, Command } from "lucide-react";
import { useEffect, useState } from "react";
import { useUiStore } from "../stores/uiStore";
import { useSessionStore } from "../stores/sessionStore";
import { useNotificationStore } from "../stores/notificationStore";
import { useAppHotkeys } from "../hooks/useAppHotkeys";
import { CommandPalette } from "./CommandPalette";
import { ToastHost } from "./ToastHost";
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
    const connected = useSessionStore((s) => s.connected);
    return (_jsxs("div", { className: "bg-bg text-text-primary flex min-h-screen flex-col", children: [_jsxs("header", { className: "border-border bg-surface flex h-[52px] items-center gap-3 border-b px-3", children: [_jsxs(Link, { to: "/", className: "text-text-primary flex items-center gap-1 font-semibold tracking-tight", children: [_jsx("span", { className: "text-primary", children: "Ori" }), "DB"] }), _jsxs("nav", { className: "text-text-secondary flex gap-3 text-sm", children: [_jsx(NavLink, { to: "/connections", className: ({ isActive }) => isActive ? "text-text-primary font-medium" : "hover:text-text-primary", children: "Connections" }), _jsx(NavLink, { to: "/workspace", className: ({ isActive }) => isActive ? "text-text-primary font-medium" : "hover:text-text-primary", children: "Workspace" })] }), _jsxs("div", { className: "text-text-muted ml-auto flex items-center gap-2 text-xs", children: [activeId && (_jsxs("span", { className: "flex items-center gap-1", children: [_jsx("span", { className: connected ? "bg-success inline-block h-2 w-2 rounded-full" : "bg-warning inline-block h-2 w-2 rounded-full" }), connectionName ?? "Connected"] })), _jsx("button", { type: "button", className: "border-border hover:bg-selection rounded border p-1", title: "Command palette", "aria-label": "Command palette", onClick: () => setCommandOpen(true), children: _jsx(Command, { size: 16 }) }), _jsxs("div", { className: "relative", children: [_jsx("button", { type: "button", className: "border-border hover:bg-selection rounded border p-1", "aria-label": "Notifications", onClick: () => setBellOpen((v) => !v), children: _jsx(Bell, { size: 16 }) }), bellOpen && (_jsx("div", { className: "border-border bg-surface-elevated absolute right-0 z-40 mt-1 w-72 rounded border p-2 text-xs shadow-lg", children: items.length === 0 ? (_jsx("div", { className: "text-text-muted py-4 text-center", children: "No notifications" })) : (items.map((n) => (_jsxs("div", { className: "border-border mb-1 border-b pb-1 last:border-0", children: [_jsx("div", { className: "text-text-primary font-medium", children: n.title }), n.body && (_jsx("div", { className: "text-text-muted", children: n.body }))] }, n.id)))) }))] }), _jsx("button", { type: "button", className: "border-border hover:bg-selection rounded border p-1", title: "Cycle theme", "aria-label": "Cycle theme", onClick: () => {
                                    if (theme === "light")
                                        setTheme("dark");
                                    else if (theme === "dark")
                                        setTheme("system");
                                    else
                                        setTheme("light");
                                }, children: theme === "dark" ||
                                    (theme === "system" &&
                                        window.matchMedia("(prefers-color-scheme: dark)").matches) ? (_jsx(Sun, { size: 16 })) : (_jsx(Moon, { size: 16 })) })] })] }), _jsx("main", { className: "min-h-0 flex-1", children: children }), _jsx(ToastHost, {}), _jsx(CommandPalette, {})] }));
}
