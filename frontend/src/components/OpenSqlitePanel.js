import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Open a local SQLite file — upload copy or use an absolute path on this machine.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { FolderOpen, HardDriveUpload, Loader2 } from "lucide-react";
import { api } from "../api/client";
import { useSessionStore } from "../stores/sessionStore";
import { useUiStore } from "../stores/uiStore";
import { Btn, Input, Label } from "./ui";
export function OpenSqlitePanel({ onOpened, compact = false, }) {
    const pushToast = useUiStore((s) => s.pushToast);
    const setActive = useSessionStore((s) => s.setActive);
    const fileRef = useRef(null);
    const [path, setPath] = useState("");
    const [name, setName] = useState("");
    const [readOnly, setReadOnly] = useState(false);
    const [busy, setBusy] = useState(false);
    const [verified, setVerified] = useState(null);
    const [library, setLibrary] = useState([]);
    const [hints, setHints] = useState(null);
    const refreshLibrary = useCallback(() => {
        void api("/connections/sqlite/library")
            .then((r) => setLibrary(r.files))
            .catch(() => setLibrary([]));
    }, []);
    useEffect(() => {
        refreshLibrary();
        void api("/connections/sqlite/hints")
            .then(setHints)
            .catch(() => setHints(null));
    }, [refreshLibrary]);
    const finishOpen = (r) => {
        if (r.connected) {
            setActive(r.connection.id, true, {
                name: r.connection.name,
                engine: "sqlite",
            });
        }
        pushToast({
            type: "success",
            message: r.created
                ? `Opened ${r.connection.name}`
                : `Reconnected to ${r.connection.name}`,
        });
        onOpened?.(r.connection.id);
    };
    const verifyPath = async () => {
        if (!path.trim())
            return;
        setBusy(true);
        try {
            const r = await api("/connections/sqlite/verify-path", {
                method: "POST",
                body: JSON.stringify({ path: path.trim() }),
            });
            if (!r.ok) {
                setVerified(null);
                pushToast({ type: "error", message: "File not found on this machine" });
                return;
            }
            setVerified({ resolvedPath: r.resolvedPath, size: r.stat?.size });
            if (!name.trim()) {
                const base = r.resolvedPath.split(/[/\\]/).pop() ?? "SQLite";
                setName(base.replace(/\.(db|sqlite3?)$/i, ""));
            }
        }
        catch (e) {
            pushToast({ type: "error", message: e.message });
        }
        finally {
            setBusy(false);
        }
    };
    const openPath = async (filePath, displayName) => {
        setBusy(true);
        try {
            const r = await api("/connections/sqlite/open-path", {
                method: "POST",
                body: JSON.stringify({
                    path: filePath,
                    name: displayName || name || undefined,
                    readOnly,
                    connect: true,
                }),
            });
            finishOpen(r);
        }
        catch (e) {
            pushToast({ type: "error", message: e.message });
        }
        finally {
            setBusy(false);
        }
    };
    const uploadFile = async (file) => {
        setBusy(true);
        try {
            const fd = new FormData();
            fd.append("file", file);
            if (name.trim())
                fd.append("name", name.trim());
            fd.append("readOnly", readOnly ? "true" : "false");
            fd.append("connect", "true");
            const r = await api("/connections/sqlite/upload", {
                method: "POST",
                body: fd,
            });
            finishOpen(r);
            refreshLibrary();
        }
        catch (e) {
            pushToast({ type: "error", message: e.message });
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs("div", { className: `oridb-card border-primary/20 bg-primary/5 ${compact ? "p-3" : "p-4"}`, children: [_jsxs("div", { className: "mb-3", children: [_jsx("h3", { className: "text-text-primary text-sm font-semibold", children: "Open local SQLite database" }), _jsxs("p", { className: "text-text-muted mt-1 text-xs leading-relaxed", children: ["Browse for a ", _jsx("code", { className: "text-text-secondary", children: ".db" }), " file on your computer, paste a full path, or upload a copy into", " ", _jsx("span", { className: "font-mono text-[10px]", children: hints?.databasesDir ?? "~/.oridb/databases" }), "."] })] }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsxs(Btn, { variant: "primary", size: "sm", className: "gap-1.5", disabled: busy, onClick: () => fileRef.current?.click(), children: [busy ? (_jsx(Loader2, { className: "h-3.5 w-3.5 animate-spin" })) : (_jsx(HardDriveUpload, { className: "h-3.5 w-3.5" })), "Browse & open file"] }), _jsx("input", { ref: fileRef, type: "file", accept: ".db,.sqlite,.sqlite3,.db3,application/x-sqlite3", className: "hidden", onChange: (e) => {
                            const f = e.target.files?.[0];
                            if (f)
                                void uploadFile(f);
                            e.target.value = "";
                        } })] }), _jsxs("div", { className: "mt-4 space-y-3", children: [_jsxs("div", { children: [_jsx(Label, { children: "File path on this computer" }), _jsxs("div", { className: "mt-1 flex gap-2", children: [_jsx(Input, { placeholder: "C:\\Users\\you\\project\\data.db", value: path, onChange: (e) => {
                                            setPath(e.target.value);
                                            setVerified(null);
                                        }, onKeyDown: (e) => {
                                            if (e.key === "Enter")
                                                void verifyPath();
                                        } }), _jsx(Btn, { variant: "secondary", size: "sm", className: "shrink-0", disabled: busy || !path.trim(), onClick: () => void verifyPath(), children: "Check" })] }), verified && (_jsxs("p", { className: "text-success mt-1 font-mono text-[10px] break-all", children: [verified.resolvedPath, verified.size != null
                                        ? ` (${Math.round(verified.size / 1024)} KB)`
                                        : ""] }))] }), _jsxs("div", { className: "grid gap-3 sm:grid-cols-2", children: [_jsxs("div", { children: [_jsx(Label, { children: "Display name (optional)" }), _jsx(Input, { value: name, onChange: (e) => setName(e.target.value), placeholder: "My local DB" })] }), _jsxs("label", { className: "text-text-secondary flex items-end gap-2 pb-2 text-sm", children: [_jsx("input", { type: "checkbox", className: "accent-primary h-4 w-4", checked: readOnly, onChange: (e) => setReadOnly(e.target.checked) }), "Open read-only"] })] }), _jsxs(Btn, { variant: "secondary", size: "sm", className: "gap-1.5", disabled: busy || !path.trim(), onClick: () => void openPath(verified?.resolvedPath ?? path.trim()), children: [_jsx(FolderOpen, { className: "h-3.5 w-3.5" }), "Open path & connect"] })] }), library.length > 0 && (_jsxs("div", { className: "border-border mt-4 border-t pt-3", children: [_jsx("p", { className: "text-text-muted mb-2 text-[11px] font-medium uppercase tracking-wide", children: "Previously uploaded" }), _jsx("ul", { className: "max-h-36 space-y-1 overflow-y-auto", children: library.map((f) => (_jsx("li", { children: _jsxs("button", { type: "button", className: "text-text-secondary hover:bg-selection hover:text-text-primary flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-xs", disabled: busy, onClick: () => void openPath(f.path, f.name.replace(/\.[^.]+$/, "")), children: [_jsx("span", { className: "truncate font-medium", children: f.name }), _jsxs("span", { className: "text-text-muted shrink-0 font-mono text-[10px]", children: [Math.round(f.size / 1024), " KB"] })] }) }, f.path))) })] }))] }));
}
