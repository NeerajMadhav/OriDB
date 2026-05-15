/**
 * Open a local SQLite file — upload a copy (browse) OR open by absolute path on this machine.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { DragEvent } from "react";
import { FolderOpen, HardDriveUpload, Loader2, X } from "lucide-react";
import { api } from "../api/client";
import { useSessionStore } from "../stores/sessionStore";
import { useUiStore } from "../stores/uiStore";
import { isBrowserFakePath, looksLikeServerPath } from "../lib/sqlitePathInput";
import { Btn, Input, Label } from "./ui";

type LibraryFile = {
  name: string;
  path: string;
  size: number;
  modified: string;
};

type OpenResult = {
  connection: { id: string; name: string; engine: string; database?: string };
  connected: boolean;
  created: boolean;
  resolvedPath: string;
  fileName?: string;
};

const SQLITE_ACCEPT =
  ".db,.sqlite,.sqlite3,.db3,application/x-sqlite3,application/vnd.sqlite3";

export function OpenSqlitePanel({
  onOpened,
  compact = false,
}: {
  onOpened?: (connectionId: string) => void;
  compact?: boolean;
}) {
  const pushToast = useUiStore((s) => s.pushToast);
  const setActive = useSessionStore((s) => s.setActive);
  const fileRef = useRef<HTMLInputElement>(null);
  const [path, setPath] = useState("");
  const [name, setName] = useState("");
  const [readOnly, setReadOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyAction, setBusyAction] = useState<"upload" | "path" | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [verified, setVerified] = useState<{
    resolvedPath: string;
    size?: number;
  } | null>(null);
  const [library, setLibrary] = useState<LibraryFile[]>([]);
  const [hints, setHints] = useState<{ databasesDir: string } | null>(null);

  const refreshLibrary = useCallback(() => {
    void api<{ files: LibraryFile[] }>("/connections/sqlite/library")
      .then((r) => setLibrary(r.files))
      .catch(() => setLibrary([]));
  }, []);

  useEffect(() => {
    refreshLibrary();
    void api<{ databasesDir: string }>("/connections/sqlite/hints")
      .then(setHints)
      .catch(() => setHints(null));
  }, [refreshLibrary]);

  const clearSelectedFile = () => {
    setSelectedFile(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const finishOpen = (r: OpenResult, via: "upload" | "path") => {
    if (r.connected) {
      setActive(r.connection.id, true, {
        name: r.connection.name,
        engine: "sqlite",
      });
    }
    clearSelectedFile();
    setPath("");
    setVerified(null);
    pushToast({
      type: "success",
      message:
        via === "upload"
          ? `Uploaded and opened ${r.connection.name}`
          : r.created
            ? `Opened ${r.connection.name}`
            : `Reconnected to ${r.connection.name}`,
    });
    onOpened?.(r.connection.id);
  };

  const verifyPath = async (rawPath?: string) => {
    const input = (rawPath ?? path).trim();
    if (!input) return null;
    if (isBrowserFakePath(input)) {
      pushToast({
        type: "error",
        message:
          "That path came from the file picker and is not valid here. Use “Upload & connect” above instead.",
      });
      return null;
    }
    if (!looksLikeServerPath(input)) {
      pushToast({
        type: "error",
        message: "Enter the full file path (e.g. C:\\Users\\you\\project\\data.db).",
      });
      return null;
    }
    setBusy(true);
    setBusyAction("path");
    try {
      const r = await api<{
        ok: boolean;
        resolvedPath: string;
        stat?: { size: number };
        isSqliteName?: boolean;
      }>("/connections/sqlite/verify-path", {
        method: "POST",
        body: JSON.stringify({ path: input }),
      });
      if (!r.ok) {
        setVerified(null);
        const msg =
          r.isSqliteName === false
            ? "File must end with .db, .sqlite, .sqlite3, or .db3"
            : "File not found on this machine";
        pushToast({ type: "error", message: msg });
        return null;
      }
      const v = { resolvedPath: r.resolvedPath, size: r.stat?.size };
      setVerified(v);
      if (!name.trim()) {
        const base = r.resolvedPath.split(/[/\\]/).pop() ?? "SQLite";
        setName(base.replace(/\.(db|sqlite3?|db3)$/i, ""));
      }
      return v;
    } catch (e) {
      pushToast({ type: "error", message: (e as Error).message });
      return null;
    } finally {
      setBusy(false);
      setBusyAction(null);
    }
  };

  const openPath = async (filePath: string, displayName?: string) => {
    setBusy(true);
    setBusyAction("path");
    try {
      const r = await api<OpenResult>("/connections/sqlite/open-path", {
        method: "POST",
        body: JSON.stringify({
          path: filePath,
          name: displayName || name || undefined,
          readOnly,
          connect: true,
        }),
      });
      finishOpen(r, "path");
      refreshLibrary();
    } catch (e) {
      pushToast({ type: "error", message: (e as Error).message });
    } finally {
      setBusy(false);
      setBusyAction(null);
    }
  };

  const openByPathFlow = async () => {
    clearSelectedFile();
    const trimmed = path.trim();
    if (!trimmed) return;
    let target = verified?.resolvedPath;
    if (!target) {
      const v = await verifyPath(trimmed);
      if (!v) return;
      target = v.resolvedPath;
    }
    await openPath(target);
  };

  const uploadSelectedFile = async () => {
    if (!selectedFile) return;
    setBusy(true);
    setBusyAction("upload");
    try {
      const fd = new FormData();
      fd.append("file", selectedFile);
      const displayName =
        name.trim() ||
        selectedFile.name.replace(/\.(db|sqlite3?|db3)$/i, "") ||
        "SQLite";
      fd.append("name", displayName);
      fd.append("readOnly", readOnly ? "true" : "false");
      fd.append("connect", "true");
      const r = await api<OpenResult>("/connections/sqlite/upload", {
        method: "POST",
        body: fd,
      });
      finishOpen(r, "upload");
      refreshLibrary();
    } catch (e) {
      pushToast({ type: "error", message: (e as Error).message });
    } finally {
      setBusy(false);
      setBusyAction(null);
    }
  };

  const onPickFile = (file: File | null) => {
    if (!file) return;
    setSelectedFile(file);
    setPath("");
    setVerified(null);
    if (!name.trim()) {
      setName(file.name.replace(/\.(db|sqlite3?|db3)$/i, "") || file.name);
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onPickFile(file);
  };

  const uploadBusy = busy && busyAction === "upload";
  const pathBusy = busy && busyAction === "path";

  return (
    <div
      className={`oridb-card border-primary/20 bg-primary/5 ${compact ? "p-3" : "p-4"}`}
    >
      <div className="mb-3">
        <h3 className="text-text-primary text-sm font-semibold">
          Open local SQLite database
        </h3>
        <p className="text-text-muted mt-1 text-xs leading-relaxed">
          Use <strong className="text-text-secondary">Upload</strong> when you pick a file in
          the browser. Use <strong className="text-text-secondary">Path</strong> only for a file
          already on this PC (full path).
        </p>
      </div>

      <section
        className={`mb-4 rounded-lg border-2 border-dashed p-4 transition-colors ${
          dragOver
            ? "border-primary bg-primary/10"
            : "border-primary/30 bg-surface/50"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <p className="text-text-muted mb-2 text-[11px] font-semibold tracking-wide uppercase">
          1 — Upload a copy
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Btn
            type="button"
            variant="secondary"
            size="sm"
            className="gap-1.5"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            <HardDriveUpload className="h-3.5 w-3.5" />
            Choose file
          </Btn>
          <Btn
            type="button"
            variant="primary"
            size="sm"
            className="gap-1.5"
            disabled={!selectedFile || busy}
            onClick={() => void uploadSelectedFile()}
          >
            {uploadBusy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <HardDriveUpload className="h-3.5 w-3.5" />
            )}
            Upload &amp; connect
          </Btn>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept={SQLITE_ACCEPT}
          className="hidden"
          onChange={(e) => {
            onPickFile(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />
        {selectedFile ? (
          <div className="bg-primary/10 mt-3 flex items-start gap-2 rounded-md px-3 py-2 text-xs">
            <span className="text-text-primary min-w-0 flex-1 break-all">
              Selected: <strong>{selectedFile.name}</strong>
              {selectedFile.size > 0
                ? ` (${Math.round(selectedFile.size / 1024)} KB)`
                : ""}
            </span>
            <button
              type="button"
              className="text-text-muted hover:text-text-primary shrink-0"
              aria-label="Clear selected file"
              onClick={clearSelectedFile}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <p className="text-text-muted mt-2 text-xs">
            Copies into{" "}
            <span className="font-mono text-[10px]">
              {hints?.databasesDir ?? "~/.oridb/databases"}
            </span>
            , then connects.
          </p>
        )}
      </section>

      <section className="border-border space-y-3 border-t pt-4">
        <p className="text-text-muted text-[11px] font-semibold tracking-wide uppercase">
          2 — Open file on disk (path)
        </p>
        <div>
          <Label>Full path on this computer</Label>
          <div className="mt-1 flex gap-2">
            <Input
              placeholder="C:\Users\you\project\data.db"
              value={path}
              disabled={!!selectedFile}
              onChange={(e) => {
                setPath(e.target.value);
                setVerified(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void openByPathFlow();
                }
              }}
            />
            <Btn
              type="button"
              variant="secondary"
              size="sm"
              className="shrink-0"
              disabled={pathBusy || !path.trim() || !!selectedFile}
              onClick={() => void verifyPath()}
            >
              Check
            </Btn>
          </div>
          {selectedFile && (
            <p className="text-text-muted mt-1 text-xs">
              Clear the selected upload above to use path mode.
            </p>
          )}
          {verified && (
            <p className="text-success mt-1 font-mono text-[10px] break-all">
              {verified.resolvedPath}
              {verified.size != null
                ? ` (${Math.round(verified.size / 1024)} KB)`
                : ""}
            </p>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Display name (optional)</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My local DB"
            />
          </div>
          <label className="text-text-secondary flex items-end gap-2 pb-2 text-sm">
            <input
              type="checkbox"
              className="accent-primary h-4 w-4"
              checked={readOnly}
              onChange={(e) => setReadOnly(e.target.checked)}
            />
            Open read-only
          </label>
        </div>

        <Btn
          type="button"
          variant="secondary"
          size="sm"
          className="gap-1.5"
          disabled={pathBusy || !path.trim() || !!selectedFile}
          onClick={() => void openByPathFlow()}
        >
          {pathBusy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <FolderOpen className="h-3.5 w-3.5" />
          )}
          Open path &amp; connect
        </Btn>
      </section>

      {library.length > 0 && (
        <div className="border-border mt-4 border-t pt-3">
          <p className="text-text-muted mb-2 text-[11px] font-medium uppercase tracking-wide">
            Previously uploaded
          </p>
          <ul className="max-h-36 space-y-1 overflow-y-auto">
            {library.map((f) => (
              <li key={f.path}>
                <button
                  type="button"
                  className="text-text-secondary hover:bg-selection hover:text-text-primary flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-xs"
                  disabled={busy}
                  onClick={() => void openPath(f.path, f.name.replace(/\.[^.]+$/, ""))}
                >
                  <span className="min-w-0 flex-1 break-words font-medium">{f.name}</span>
                  <span className="text-text-muted shrink-0 font-mono text-[10px]">
                    {Math.round(f.size / 1024)} KB
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}