import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * Connection manager — list, create, edit, update, delete, test, connect.
 */
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Database, Link2, Pencil, Plug, Plus, Trash2, } from "lucide-react";
import { api } from "../api/client";
import { useSessionStore } from "../stores/sessionStore";
import { useUiStore } from "../stores/uiStore";
import { OpenSqlitePanel } from "../components/OpenSqlitePanel";
import { Btn, Card, EngineBadge, Input, Label, Select } from "../components/ui";
const URL_PREFIX = /^(postgres(ql)?|mysql|mariadb|mongodb(\+srv)?|redis(s)?|snowflake|clickhouse|sqlserver|mssql|jdbc|file):|^.+\.(db|sqlite|sqlite3|db3)$/i;
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
    "snowflake",
    "clickhouse",
    "sqlserver",
];
const DEFAULT_FORM = {
    name: "Local",
    engine: "postgresql",
    host: "127.0.0.1",
    port: 5432,
    database: "postgres",
    username: "postgres",
    password: "",
    ssl: false,
    readOnly: false,
};
const PORTS = {
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
    snowflake: 443,
    clickhouse: 8123,
    sqlserver: 1433,
};
export function ConnectionsPage() {
    const nav = useNavigate();
    const pushToast = useUiStore((s) => s.pushToast);
    const setActive = useSessionStore((s) => s.setActive);
    const activeConnectionId = useSessionStore((s) => s.activeConnectionId);
    const [list, setList] = useState([]);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState({ ...DEFAULT_FORM });
    const [urlPaste, setUrlPaste] = useState("");
    const [detectedProvider, setDetectedProvider] = useState(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);
    const [saving, setSaving] = useState(false);
    const refresh = useCallback(() => api("/connections").then((r) => setList(r.connections)), []);
    useEffect(() => {
        void refresh().catch((e) => pushToast({
            type: "error",
            message: e instanceof Error ? e.message : String(e),
        }));
    }, [pushToast, refresh]);
    const startNew = () => {
        setEditingId(null);
        setForm({ ...DEFAULT_FORM });
        setUrlPaste("");
        setDetectedProvider(null);
        setDeleteConfirmId(null);
    };
    const applyParsed = useCallback((parsed, rawUrl) => {
        setForm((f) => ({
            ...f,
            engine: parsed.engine ?? f.engine,
            host: parsed.host ?? f.host,
            port: parsed.port ?? f.port,
            database: parsed.database ?? f.database,
            username: parsed.username ?? f.username,
            password: parsed.password ?? f.password ?? "",
            ssl: parsed.ssl ?? f.ssl,
            warehouse: parsed.warehouse ?? f.warehouse,
            role: parsed.role ?? f.role,
            defaultSchema: parsed.defaultSchema ?? f.defaultSchema,
            connectionUrl: parsed.connectionUrl ?? rawUrl.trim(),
            name: !editingId && (f.name === DEFAULT_FORM.name || !f.name?.trim())
                ? (parsed.suggestedName ?? f.name)
                : f.name,
        }));
        setDetectedProvider(parsed.provider ?? null);
        if (parsed.connectionUrl) {
            setUrlPaste(parsed.connectionUrl);
        }
    }, [editingId]);
    const startEdit = (c) => {
        setEditingId(c.id);
        setForm({
            id: c.id,
            name: c.name,
            engine: c.engine,
            host: c.host,
            port: c.port,
            database: c.database,
            username: c.username,
            password: "",
            ssl: c.ssl,
            readOnly: c.readOnly,
            warehouse: c.warehouse,
            role: c.role,
            defaultSchema: c.defaultSchema,
        });
        setUrlPaste("");
        setDeleteConfirmId(null);
    };
    const buildPayload = () => {
        const { password, connectionUrl: _drop, ...rest } = form;
        const payload = { ...rest };
        if (password?.trim()) {
            payload.password = password.trim();
        }
        const url = urlPaste.trim();
        if (url) {
            payload.connectionUrl = url;
        }
        if (payload.port !== undefined && !Number.isFinite(Number(payload.port))) {
            delete payload.port;
        }
        return payload;
    };
    const save = async () => {
        setSaving(true);
        try {
            const payload = buildPayload();
            if (editingId) {
                await api(`/connections/${editingId}`, {
                    method: "PUT",
                    body: JSON.stringify(payload),
                });
                pushToast({ type: "success", message: "Connection updated" });
                if (activeConnectionId === editingId) {
                    await api(`/connections/${editingId}/connect`, { method: "POST" });
                    setActive(editingId, true, {
                        name: form.name,
                        engine: form.engine,
                        defaultSchema: form.defaultSchema,
                    });
                }
            }
            else {
                await api("/connections", {
                    method: "POST",
                    body: JSON.stringify(payload),
                });
                pushToast({ type: "success", message: "Connection saved" });
                startNew();
            }
            await refresh();
        }
        catch (e) {
            pushToast({ type: "error", message: e.message });
        }
        finally {
            setSaving(false);
        }
    };
    const remove = async (id) => {
        try {
            await api(`/connections/${id}`, { method: "DELETE" });
            pushToast({ type: "success", message: "Connection deleted" });
            if (activeConnectionId === id) {
                setActive(null, false);
            }
            if (editingId === id) {
                startNew();
            }
            setDeleteConfirmId(null);
            await refresh();
        }
        catch (e) {
            pushToast({ type: "error", message: e.message });
        }
    };
    const test = async () => {
        try {
            const payload = buildPayload();
            const body = editingId ? { ...payload, id: editingId } : payload;
            const r = await api("/connections/test", { method: "POST", body: JSON.stringify(body) });
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
            const prev = activeConnectionId;
            if (prev && prev !== id) {
                await api(`/connections/${prev}/disconnect`, { method: "POST" }).catch(() => undefined);
            }
            await api(`/connections/${id}/connect`, { method: "POST" });
            const c = meta ?? list.find((x) => x.id === id);
            setActive(id, true, {
                name: c?.name,
                engine: c?.engine,
                defaultSchema: c?.defaultSchema ?? form.defaultSchema,
            });
            pushToast({ type: "success", message: `Connected to ${c?.name ?? "database"}` });
            nav("/workspace");
        }
        catch (e) {
            pushToast({ type: "error", message: e.message });
        }
    };
    const parseUrl = async (silent = false) => {
        const raw = urlPaste.trim();
        if (!raw)
            return;
        try {
            const r = await api("/connections/parse-url", { method: "POST", body: JSON.stringify({ url: raw }) });
            applyParsed(r.parsed, raw);
            if (!silent) {
                const label = r.parsed.provider
                    ? String(r.parsed.provider).replace(/-/g, " ")
                    : r.parsed.engine;
                pushToast({
                    type: "success",
                    message: `Detected ${label} — fields filled (SSL ${r.parsed.ssl ? "on" : "off"})`,
                });
            }
        }
        catch (e) {
            if (!silent) {
                pushToast({ type: "error", message: e.message });
            }
        }
    };
    useEffect(() => {
        const raw = urlPaste.trim();
        if (!raw || raw.length < 20 || !URL_PREFIX.test(raw)) {
            setDetectedProvider(null);
            return;
        }
        const timer = window.setTimeout(() => {
            void parseUrl(true);
        }, 600);
        return () => window.clearTimeout(timer);
    }, [urlPaste]); // eslint-disable-line react-hooks/exhaustive-deps -- parseUrl uses latest state
    const editingConn = editingId ? list.find((c) => c.id === editingId) : null;
    return (_jsxs("div", { className: "mx-auto max-w-6xl px-4 py-8", children: [_jsxs("div", { className: "mb-6", children: [_jsxs(Link, { to: "/", className: "text-text-muted hover:text-primary mb-2 inline-flex items-center gap-1.5 text-sm transition-colors", children: [_jsx(ArrowLeft, { className: "h-4 w-4" }), "Home"] }), _jsx("h1", { className: "text-text-primary text-2xl font-semibold tracking-tight", children: "Connections" }), _jsx("p", { className: "text-text-secondary mt-1 text-sm", children: "Create, edit, and manage saved database profiles." })] }), _jsxs("div", { className: "flex flex-col gap-6 lg:flex-row", children: [_jsxs(Card, { className: "lg:w-[380px] shrink-0", padding: "md", children: [_jsxs("div", { className: "mb-4 flex items-center justify-between gap-2", children: [_jsx("h2", { className: "text-text-muted text-[11px] font-semibold tracking-widest uppercase", children: "Saved" }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-text-muted text-xs", children: list.length }), _jsxs(Btn, { variant: "ghost", size: "sm", className: "gap-1", onClick: startNew, children: [_jsx(Plus, { className: "h-3.5 w-3.5" }), "New"] })] })] }), _jsx("div", { className: "oridb-scrollbar max-h-[min(520px,60vh)] space-y-1 overflow-y-auto", children: list.length === 0 ? (_jsx("p", { className: "text-text-muted py-8 text-center text-xs", children: "No saved connections yet. Click New or fill in the form." })) : (list.map((c) => (_jsxs("div", { className: `oridb-connection-row flex-wrap ${editingId === c.id ? "ring-primary/40 bg-primary/5 ring-1" : ""}`, children: [_jsxs("button", { type: "button", className: "flex min-w-0 flex-1 items-center gap-2 text-left", onClick: () => startEdit(c), children: [_jsx("span", { className: "bg-primary/10 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", children: _jsx(Database, { className: "h-4 w-4" }) }), _jsxs("span", { className: "min-w-0 flex-1", children: [_jsx("p", { className: "text-text-primary truncate font-medium", children: c.name }), _jsx("p", { className: "text-text-muted truncate text-xs", children: c.host ?? c.engine })] })] }), _jsx(EngineBadge, { engine: c.engine }), _jsxs("div", { className: "flex shrink-0 gap-1", children: [_jsx(Btn, { variant: "ghost", size: "sm", title: "Edit", "aria-label": `Edit ${c.name}`, onClick: () => startEdit(c), children: _jsx(Pencil, { className: "h-3.5 w-3.5" }) }), deleteConfirmId === c.id ? (_jsxs(_Fragment, { children: [_jsx(Btn, { variant: "danger", size: "sm", onClick: () => void remove(c.id), children: "Confirm" }), _jsx(Btn, { variant: "ghost", size: "sm", onClick: () => setDeleteConfirmId(null), children: "Cancel" })] })) : (_jsx(Btn, { variant: "ghost", size: "sm", title: "Delete", "aria-label": `Delete ${c.name}`, className: "hover:text-error", onClick: () => setDeleteConfirmId(c.id), children: _jsx(Trash2, { className: "h-3.5 w-3.5" }) })), _jsxs(Btn, { variant: "primary", size: "sm", className: "gap-1", onClick: () => void connect(c.id, c), children: [_jsx(Plug, { className: "h-3 w-3" }), "Connect"] })] })] }, c.id)))) })] }), _jsxs(Card, { className: "min-w-0 flex-1", padding: "lg", children: [_jsx(OpenSqlitePanel, { onOpened: () => {
                                    void refresh();
                                    nav("/workspace");
                                } }), _jsxs("div", { className: "mb-6 mt-6 flex flex-wrap items-start justify-between gap-2", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-text-primary text-lg font-semibold", children: editingId ? "Edit connection" : "New connection" }), _jsx("p", { className: "text-text-muted mt-1 text-xs", children: editingId
                                                    ? `Updating “${editingConn?.name ?? form.name}”. Leave password blank to keep the current one.`
                                                    : "Paste a URL or fill in the fields below. Enable SSL for cloud databases (e.g. RDS)." })] }), editingId && (_jsx(Btn, { variant: "secondary", size: "sm", onClick: startNew, children: "Cancel edit" }))] }), _jsxs("div", { className: "mb-6", children: [_jsx(Label, { children: "Connection string" }), _jsx("p", { className: "text-text-muted mb-2 text-xs", children: "Neon, Supabase, RDS, Snowflake, ClickHouse, SQL Server, and standard URLs are auto-detected." }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Input, { placeholder: "postgresql://user:pass@host.neon.tech/neondb?sslmode=require", value: urlPaste, onChange: (e) => setUrlPaste(e.target.value), onPaste: () => {
                                                    window.setTimeout(() => void parseUrl(true), 50);
                                                } }), _jsxs(Btn, { variant: "secondary", size: "sm", className: "shrink-0 gap-1", onClick: () => void parseUrl(false), children: [_jsx(Link2, { className: "h-3.5 w-3.5" }), "Parse"] })] }), detectedProvider && (_jsxs("p", { className: "text-success mt-2 text-xs capitalize", children: ["Detected: ", detectedProvider.replace(/-/g, " "), form.ssl ? " · SSL enabled" : ""] }))] }), _jsxs("div", { className: "grid gap-4 sm:grid-cols-2", children: [_jsx(Field, { label: "Name", children: _jsx(Input, { value: form.name ?? "", onChange: (e) => setForm((f) => ({ ...f, name: e.target.value })) }) }), _jsx(Field, { label: "Engine", children: _jsx(Select, { value: form.engine, onChange: (e) => {
                                                const engine = e.target.value;
                                                setForm((f) => ({
                                                    ...f,
                                                    engine,
                                                    port: PORTS[engine] ?? f.port,
                                                }));
                                            }, children: engines.map((e) => (_jsx("option", { value: e, children: e }, e))) }) }), form.engine !== "sqlite" && (_jsxs(_Fragment, { children: [_jsx(Field, { label: "Host", children: _jsx(Input, { value: form.host ?? "", onChange: (e) => setForm((f) => ({ ...f, host: e.target.value })) }) }), _jsx(Field, { label: "Port", children: _jsx(Input, { type: "number", value: form.port ?? "", onChange: (e) => {
                                                        const v = e.target.value;
                                                        setForm((f) => ({
                                                            ...f,
                                                            port: v === "" ? undefined : Number(v),
                                                        }));
                                                    } }) })] })), _jsx(Field, { label: form.engine === "sqlite"
                                            ? "Database file path"
                                            : form.engine === "snowflake"
                                                ? "Database (optional)"
                                                : "Database", children: _jsx(Input, { placeholder: form.engine === "sqlite"
                                                ? "C:\\path\\to\\file.db or ./local.db"
                                                : form.engine === "snowflake"
                                                    ? "MY_DB"
                                                    : "postgres", value: form.database ?? "", onChange: (e) => setForm((f) => ({ ...f, database: e.target.value })) }) }), form.engine === "snowflake" && (_jsxs(_Fragment, { children: [_jsx(Field, { label: "Warehouse", children: _jsx(Input, { placeholder: "COMPUTE_WH", value: form.warehouse ?? "", onChange: (e) => setForm((f) => ({ ...f, warehouse: e.target.value })) }) }), _jsx(Field, { label: "Role", children: _jsx(Input, { placeholder: "ACCOUNTADMIN", value: form.role ?? "", onChange: (e) => setForm((f) => ({ ...f, role: e.target.value })) }) }), _jsx(Field, { label: "Default schema", children: _jsx(Input, { placeholder: "PUBLIC", value: form.defaultSchema ?? "", onChange: (e) => setForm((f) => ({ ...f, defaultSchema: e.target.value })) }) })] })), form.engine !== "sqlite" && (_jsxs(_Fragment, { children: [_jsx(Field, { label: "User", children: _jsx(Input, { value: form.username ?? "", onChange: (e) => setForm((f) => ({ ...f, username: e.target.value })) }) }), _jsx(Field, { label: "Password", className: "sm:col-span-2", children: _jsx(Input, { type: "password", placeholder: editingId ? "Leave blank to keep current password" : "", value: form.password ?? "", onChange: (e) => setForm((f) => ({ ...f, password: e.target.value })) }) })] }))] }), form.engine === "sqlite" && (_jsx("p", { className: "text-text-muted -mt-2 mb-4 text-xs", children: "For SQLite, set the file path only \u2014 host and port are not used." })), _jsxs("div", { className: "border-border mb-6 flex flex-wrap gap-4 border-t pt-4", children: [_jsxs("label", { className: "text-text-secondary flex cursor-pointer items-center gap-2 text-sm", children: [_jsx("input", { type: "checkbox", className: "accent-primary h-4 w-4 rounded", checked: !!form.ssl, onChange: (e) => setForm((f) => ({ ...f, ssl: e.target.checked })) }), "SSL"] }), _jsxs("label", { className: "text-text-secondary flex cursor-pointer items-center gap-2 text-sm", children: [_jsx("input", { type: "checkbox", className: "accent-primary h-4 w-4 rounded", checked: !!form.readOnly, onChange: (e) => setForm((f) => ({ ...f, readOnly: e.target.checked })) }), "Read-only"] })] }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsx(Btn, { variant: "secondary", onClick: () => void test(), children: "Test connection" }), _jsx(Btn, { variant: "primary", disabled: saving, onClick: () => void save(), children: saving
                                            ? "Saving…"
                                            : editingId
                                                ? "Update connection"
                                                : "Save connection" }), editingId && (_jsx(Btn, { variant: "danger", className: "ml-auto", onClick: () => setDeleteConfirmId(editingId), children: "Delete" }))] }), editingId && deleteConfirmId === editingId && (_jsxs("div", { className: "border-error/30 bg-error/5 mt-4 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm", children: [_jsxs("span", { className: "text-text-primary", children: ["Delete \u201C", editingConn?.name, "\u201D? This cannot be undone."] }), _jsx(Btn, { variant: "danger", size: "sm", onClick: () => void remove(editingId), children: "Yes, delete" }), _jsx(Btn, { variant: "ghost", size: "sm", onClick: () => setDeleteConfirmId(null), children: "Cancel" })] }))] })] })] }));
}
function Field({ label, children, className = "", }) {
    return (_jsxs("label", { className: `block ${className}`, children: [_jsx(Label, { children: label }), children] }));
}
