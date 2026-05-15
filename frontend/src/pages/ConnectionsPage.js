import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Connection manager — list + create form + test + connect.
 */
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useSessionStore } from "../stores/sessionStore";
import { useUiStore } from "../stores/uiStore";
const engines = [
    "postgresql",
    "mysql",
    "mariadb",
    "sqlite",
    "mongodb",
    "redis",
    "cockroachdb",
    "planetscale",
    "neon",
    "supabase",
];
export function ConnectionsPage() {
    const nav = useNavigate();
    const pushToast = useUiStore((s) => s.pushToast);
    const setActive = useSessionStore((s) => s.setActive);
    const [list, setList] = useState([]);
    const [form, setForm] = useState({
        name: "Local",
        engine: "postgresql",
        host: "127.0.0.1",
        port: 5432,
        database: "postgres",
        username: "postgres",
        password: "",
    });
    const [urlPaste, setUrlPaste] = useState("");
    const refresh = () => api("/connections").then((r) => setList(r.connections));
    useEffect(() => {
        void refresh().catch((e) => pushToast({
            type: "error",
            message: e instanceof Error ? e.message : String(e),
        }));
    }, [pushToast]);
    const save = async () => {
        try {
            await api("/connections", {
                method: "POST",
                body: JSON.stringify(form),
            });
            pushToast({ type: "success", message: "Connection saved" });
            await refresh();
        }
        catch (e) {
            pushToast({ type: "error", message: e.message });
        }
    };
    const test = async () => {
        try {
            const r = await api("/connections/test", { method: "POST", body: JSON.stringify(form) });
            pushToast({
                type: r.ok ? "success" : "error",
                message: r.ok
                    ? `Connected in ${r.latencyMs}ms`
                    : (r.error ?? "Failed"),
            });
        }
        catch (e) {
            pushToast({ type: "error", message: e.message });
        }
    };
    const connect = async (id, meta) => {
        try {
            await api(`/connections/${id}/connect`, { method: "POST" });
            const c = meta ?? list.find((x) => x.id === id);
            setActive(id, true, { name: c?.name, engine: c?.engine });
            pushToast({ type: "success", message: `Connected to ${c?.name ?? "database"}` });
            nav("/workspace");
        }
        catch (e) {
            pushToast({ type: "error", message: e.message });
        }
    };
    const parseUrl = async () => {
        try {
            const r = await api("/connections/parse-url", { method: "POST", body: JSON.stringify({ url: urlPaste }) });
            setForm((f) => ({ ...f, ...r.parsed }));
            pushToast({ type: "info", message: "URL parsed" });
        }
        catch (e) {
            pushToast({ type: "error", message: e.message });
        }
    };
    return (_jsxs("div", { className: "mx-auto flex max-w-5xl flex-col gap-4 px-4 py-6 md:flex-row", children: [_jsxs("div", { className: "border-border bg-surface-elevated md:w-1/2 rounded-lg border p-3", children: [_jsx("div", { className: "text-text-secondary mb-2 text-xs font-semibold uppercase", children: "Saved" }), _jsx("div", { className: "oridb-scrollbar max-h-[420px] space-y-1 overflow-y-auto", children: list.map((c) => (_jsxs("div", { className: "border-border hover:bg-selection flex items-center justify-between rounded border px-2 py-2 text-sm", children: [_jsxs("div", { children: [_jsx("div", { className: "text-text-primary font-medium", children: c.name }), _jsxs("div", { className: "text-text-muted text-xs", children: [c.engine, " ", c.host ? `· ${c.host}` : ""] })] }), _jsx("button", { type: "button", className: "bg-primary rounded px-2 py-1 text-xs text-white", onClick: () => void connect(c.id, c), children: "Connect" })] }, c.id))) }), _jsx(Link, { to: "/", className: "text-primary mt-3 inline-block text-sm", children: "\u2190 Home" })] }), _jsxs("div", { className: "border-border bg-surface-elevated flex-1 space-y-3 rounded-lg border p-4", children: [_jsx("h2", { className: "text-text-primary text-lg font-semibold", children: "New connection" }), _jsx("label", { className: "text-text-secondary block text-xs", children: "Connection string" }), _jsxs("div", { className: "flex gap-2", children: [_jsx("input", { className: "border-border bg-bg text-text-primary flex-1 rounded border px-2 py-1.5 text-sm", placeholder: "postgres://...", value: urlPaste, onChange: (e) => setUrlPaste(e.target.value) }), _jsx("button", { type: "button", className: "border-border rounded border px-2 text-sm", onClick: () => void parseUrl(), children: "Parse" })] }), _jsxs("div", { className: "grid gap-2 sm:grid-cols-2", children: [_jsx(Field, { label: "Name", children: _jsx("input", { className: "field", value: form.name ?? "", onChange: (e) => setForm((f) => ({ ...f, name: e.target.value })) }) }), _jsx(Field, { label: "Engine", children: _jsx("select", { className: "field", value: form.engine, onChange: (e) => {
                                        const engine = e.target.value;
                                        const ports = {
                                            postgresql: 5432,
                                            mysql: 3306,
                                            mariadb: 3306,
                                            mongodb: 27017,
                                            redis: 6379,
                                            cockroachdb: 5432,
                                            planetscale: 3306,
                                            neon: 5432,
                                            supabase: 5432,
                                            sqlite: 0,
                                        };
                                        setForm((f) => ({
                                            ...f,
                                            engine,
                                            port: ports[engine] ?? f.port,
                                        }));
                                    }, children: engines.map((e) => (_jsx("option", { value: e, children: e }, e))) }) }), _jsx(Field, { label: "Host", children: _jsx("input", { className: "field", value: form.host ?? "", onChange: (e) => setForm((f) => ({ ...f, host: e.target.value })) }) }), _jsx(Field, { label: "Port", children: _jsx("input", { className: "field", type: "number", value: form.port ?? "", onChange: (e) => setForm((f) => ({ ...f, port: Number(e.target.value) })) }) }), _jsx(Field, { label: form.engine === "sqlite" ? "Database file path" : "Database", children: _jsx("input", { className: "field", placeholder: form.engine === "sqlite"
                                        ? "C:\\path\\to\\file.db or ./local.db"
                                        : "postgres", value: form.database ?? "", onChange: (e) => setForm((f) => ({ ...f, database: e.target.value })) }) }), form.engine === "sqlite" && (_jsxs("p", { className: "text-text-muted sm:col-span-2 text-xs", children: ["For SQLite, set ", _jsx("strong", { children: "Database file path" }), " to your .db file. Host/port are not used."] })), _jsx(Field, { label: "User", children: _jsx("input", { className: "field", value: form.username ?? "", onChange: (e) => setForm((f) => ({ ...f, username: e.target.value })) }) }), _jsx(Field, { label: "Password", className: "sm:col-span-2", children: _jsx("input", { className: "field", type: "password", value: form.password ?? "", onChange: (e) => setForm((f) => ({ ...f, password: e.target.value })) }) })] }), _jsxs("label", { className: "text-text-secondary flex items-center gap-2 text-xs", children: [_jsx("input", { type: "checkbox", checked: !!form.ssl, onChange: (e) => setForm((f) => ({ ...f, ssl: e.target.checked })) }), "SSL"] }), _jsxs("label", { className: "text-text-secondary flex items-center gap-2 text-xs", children: [_jsx("input", { type: "checkbox", checked: !!form.readOnly, onChange: (e) => setForm((f) => ({ ...f, readOnly: e.target.checked })) }), "Read-only"] }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsx("button", { type: "button", className: "border-border rounded border px-3 py-1.5 text-sm", onClick: () => void test(), children: "Test" }), _jsx("button", { type: "button", className: "bg-primary rounded px-3 py-1.5 text-sm text-white", onClick: () => void save(), children: "Save" })] })] }), _jsx("style", { children: `
        .field { width: 100%; border: 1px solid var(--border); border-radius: 6px; background: var(--bg); color: var(--text-primary); padding: 6px 8px; font-size: 13px; }
      ` })] }));
}
function Field({ label, children, className = "", }) {
    return (_jsxs("label", { className: `block ${className}`, children: [_jsx("span", { className: "text-text-muted mb-1 block text-[11px] uppercase tracking-wide", children: label }), children] }));
}
