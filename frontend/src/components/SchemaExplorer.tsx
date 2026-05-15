/**
 * Sidebar schema tree — databases/schemas, tables, refresh.
 */
import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { api } from "../api/client";
import { useSessionStore } from "../stores/sessionStore";

type TableRow = { name: string; type: string };

export function SchemaExplorer({
  onSelectTable,
}: {
  onSelectTable?: (table: string, schema: string) => void;
}) {
  const connId = useSessionStore((s) => s.activeConnectionId);
  const engine = useSessionStore((s) => s.engine);
  const schema = useSessionStore((s) => s.selectedSchema);
  const setSchema = useSessionStore((s) => s.setSelectedSchema);
  const [schemas, setSchemas] = useState<string[]>([]);
  const [tables, setTables] = useState<TableRow[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSchemas = useCallback(async () => {
    if (!connId) return;
    try {
      const r = await api<{ schemas?: string[]; engine?: string }>(
        `/schema/${connId}`,
      );
      const list = r.schemas?.length
        ? r.schemas
        : engine === "sqlite"
          ? ["main"]
          : ["public"];
      setSchemas(list);
      if (!list.includes(schema)) {
        setSchema(list[0] ?? "public");
      }
    } catch {
      setSchemas(engine === "sqlite" ? ["main"] : ["public"]);
    }
  }, [connId, engine, schema, setSchema]);

  const loadTables = useCallback(async () => {
    if (!connId) {
      setTables([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const q = engine === "sqlite" ? "" : `?schema=${encodeURIComponent(schema)}`;
      const r = await api<{ tables: TableRow[] }>(
        `/schema/${connId}/tables${q}`,
      );
      setTables(r.tables ?? []);
    } catch (e: unknown) {
      setTables([]);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [connId, schema, engine]);

  useEffect(() => {
    void loadSchemas();
  }, [loadSchemas]);

  useEffect(() => {
    void loadTables();
  }, [loadTables]);

  const visible = tables.filter((t) =>
    t.name.toLowerCase().includes(filter.toLowerCase()),
  );

  if (!connId) {
    return (
      <div className="text-text-muted flex h-full flex-col p-3 text-xs">
        <p>Connect to a database to browse tables.</p>
        <p className="text-text-muted mt-2">
          Go to <strong className="text-text-secondary">Connections</strong>, save a profile, then click{" "}
          <strong className="text-text-secondary">Connect</strong>.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col text-xs">
      <div className="border-border space-y-2 border-b p-2">
        {schemas.length > 1 && (
          <select
            className="border-border bg-bg text-text-primary w-full rounded border px-2 py-1"
            value={schema}
            onChange={(e) => setSchema(e.target.value)}
            aria-label="Schema"
          >
            {schemas.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}
        {schemas.length === 1 && (
          <div className="text-text-muted truncate" title={schemas[0]}>
            Schema: <span className="text-text-primary">{schemas[0]}</span>
          </div>
        )}
        <div className="flex gap-1">
          <input
            className="border-border bg-bg text-text-primary min-w-0 flex-1 rounded border px-2 py-1"
            placeholder="Filter tables…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <button
            type="button"
            title="Refresh schema"
            className="border-border hover:bg-selection shrink-0 rounded border p-1"
            onClick={() => {
              void loadSchemas();
              void loadTables();
            }}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>
      <div className="oridb-scrollbar flex-1 overflow-y-auto p-2">
        {loading && tables.length === 0 && (
          <p className="text-text-muted animate-pulse">Loading tables…</p>
        )}
        {error && <p className="text-error mb-2">{error}</p>}
        {!loading && !error && visible.length === 0 && (
          <p className="text-text-muted">
            No tables in this schema. Run SQL to create tables, or pick another schema.
          </p>
        )}
        {visible.map((t) => (
          <button
            key={t.name}
            type="button"
            title={`Open ${t.name}`}
            className="hover:bg-selection text-text-primary mb-0.5 flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left"
            onClick={() => onSelectTable?.(t.name, schema)}
          >
            <span className="text-text-muted w-3 shrink-0 font-mono text-[10px]">
              {t.type === "view" ? "V" : "T"}
            </span>
            <span className="truncate">{t.name}</span>
          </button>
        ))}
      </div>
      <p className="text-text-muted border-border border-t p-2">
        {visible.length} table{visible.length === 1 ? "" : "s"}
      </p>
    </div>
  );
}
