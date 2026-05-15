/**
 * Open a local SQLite file — upload copy or use an absolute path on this machine.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { FolderOpen, HardDriveUpload, Loader2 } from "lucide-react";
import { api } from "../api/client";
import { useSessionStore } from "../stores/sessionStore";
import { useUiStore } from "../stores/uiStore";
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
};

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

  const finishOpen = (r: OpenResult) => {
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
    if (!path.trim()) return;
    setBusy(true);
    try {
      const r = await api<{
        ok: boolean;
        resolvedPath: string;
        stat?: { size: number };
      }>("/connections/sqlite/verify-path", {
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
    } catch (e) {
      pushToast({ type: "error", message: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const openPath = async (filePath: string, displayName?: string) => {
    setBusy(true);
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
      finishOpen(r);
    } catch (e) {
      pushToast({ type: "error", message: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const uploadFile = async (file: File) => {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (name.trim()) fd.append("name", name.trim());
      fd.append("readOnly", readOnly ? "true" : "false");
      fd.append("connect", "true");
      const r = await api<OpenResult>("/connections/sqlite/upload", {
        method: "POST",
        body: fd,
      });
      finishOpen(r);
      refreshLibrary();
    } catch (e) {
      pushToast({ type: "error", message: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={`oridb-card border-primary/20 bg-primary/5 ${compact ? "p-3" : "p-4"}`}
    >
      <div className="mb-3">
        <h3 className="text-text-primary text-sm font-semibold">
          Open local SQLite database
        </h3>
        <p className="text-text-muted mt-1 text-xs leading-relaxed">
          Browse for a <code className="text-text-secondary">.db</code> file on your
          computer, paste a full path, or upload a copy into{" "}
          <span className="font-mono text-[10px]">
            {hints?.databasesDir ?? "~/.oridb/databases"}
          </span>
          .
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Btn
          variant="primary"
          size="sm"
          className="gap-1.5"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <HardDriveUpload className="h-3.5 w-3.5" />
          )}
          Browse &amp; open file
        </Btn>
        <input
          ref={fileRef}
          type="file"
          accept=".db,.sqlite,.sqlite3,.db3,application/x-sqlite3"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void uploadFile(f);
            e.target.value = "";
          }}
        />
      </div>

      <div className="mt-4 space-y-3">
        <div>
          <Label>File path on this computer</Label>
          <div className="mt-1 flex gap-2">
            <Input
              placeholder="C:\Users\you\project\data.db"
              value={path}
              onChange={(e) => {
                setPath(e.target.value);
                setVerified(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") void verifyPath();
              }}
            />
            <Btn
              variant="secondary"
              size="sm"
              className="shrink-0"
              disabled={busy || !path.trim()}
              onClick={() => void verifyPath()}
            >
              Check
            </Btn>
          </div>
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
          variant="secondary"
          size="sm"
          className="gap-1.5"
          disabled={busy || !path.trim()}
          onClick={() => void openPath(verified?.resolvedPath ?? path.trim())}
        >
          <FolderOpen className="h-3.5 w-3.5" />
          Open path &amp; connect
        </Btn>
      </div>

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
                  <span className="truncate font-medium">{f.name}</span>
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
