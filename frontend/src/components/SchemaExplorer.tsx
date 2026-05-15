/**
 * Sidebar schema tree — databases/schemas, tables, refresh.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, Table2, Eye } from "lucide-react";
import { api } from "../api/client";
import { defaultSchemaForEngine, useSessionStore } from "../stores/sessionStore";
import { PanelHeader } from "./ui";

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
  const autoPicked = useRef(false);

  const loadSchemas = useCallback(async () => {
    if (!connId) return;
    try {
      const r = await api<{ schemas?: string[] }>(`/schema/${connId}`);
      const fallback = [defaultSchemaForEngine(engine)];
      const list = r.schemas?.length ? r.schemas : fallback;
      setSchemas(list);
      if (!list.includes(schema)) {
        setSchema(list[0] ?? defaultSchemaForEngine(engine));
      }
    } catch (e: unknown) {
      setSchemas([defaultSchemaForEngine(engine)]);
      setError(e instanceof Error ? e.message : "Could not load schemas");
    }
  }, [connId, engine, schema, setSchema]);

  const loadTables = useCallback(
    async (schemaName?: string) => {
      if (!connId) {
        setTables([]);
        return [];
      }
      const sch = schemaName ?? schema;
      setLoading(true);
      setError(null);
      try {
        const q = engine === "sqlite" ? "" : `?schema=${encodeURIComponent(sch)}`;
        const r = await api<{ tables: TableRow[] }>(
          `/schema/${connId}/tables${q}`,
        );
        const list = r.tables ?? [];
        setTables(list);
        return list;
      } catch (e: unknown) {
        setTables([]);
        setError(e instanceof Error ? e.message : String(e));
        return [];
      } finally {
        setLoading(false);
      }
    },
    [connId, schema, engine],
  );

  /** If current schema is empty, try another schema that has tables */
  const tryAutoSchema = useCallback(
    async (currentTables: TableRow[], schemaList: string[]) => {
      if (
        autoPicked.current ||
        currentTables.length > 0 ||
        schemaList.length < 2 ||
        engine === "sqlite"
      ) {
        return;
      }
      for (const sch of schemaList) {
        if (sch === schema) continue;
        const found = await loadTables(sch);
        if (found.length > 0) {
          autoPicked.current = true;
          setSchema(sch);
          return;
        }
      }
    },
    [engine, loadTables, schema, setSchema],
  );

  useEffect(() => {
    autoPicked.current = false;
    void loadSchemas();
  }, [loadSchemas, connId]);

  useEffect(() => {
    void (async () => {
      const list = await loadTables();
      if (list.length === 0 && schemas.length > 1) {
        await tryAutoSchema(list, schemas);
      }
    })();
  }, [loadTables, schemas, tryAutoSchema]);

  const visible = tables.filter((t) =>
    t.name.toLowerCase().includes(filter.toLowerCase()),
  );

  if (!connId) {
    return (
      <div className="text-text-muted flex h-full flex-col p-4 text-xs leading-relaxed">
        <PanelHeader title="Schema" subtitle="No connection" />
        <p className="px-3">
          Connect to a database to browse tables. Open{" "}
          <strong className="text-text-secondary">Connections</strong> and click{" "}
          <strong className="text-text-secondary">Connect</strong>.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PanelHeader
        title="Schema"
        subtitle={engine === "sqlite" ? "SQLite" : schema}
        action={
          <button
            type="button"
            title="Refresh"
            className="text-text-muted hover:text-primary rounded-md p-1 transition-colors"
            onClick={() => {
              void loadSchemas();
              void loadTables();
            }}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        }
      />

      <div className="space-y-2 px-3 pb-2">
        {schemas.length > 0 && engine !== "sqlite" && (
          <select
            className="oridb-input oridb-select h-8 text-xs"
            value={schema}
            onChange={(e) => {
              autoPicked.current = false;
              setSchema(e.target.value);
            }}
            aria-label="Schema"
          >
            {schemas.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}
        <input
          className="oridb-input h-8 text-xs"
          placeholder="Filter tables…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      <div className="oridb-scrollbar flex-1 overflow-y-auto px-2 pb-2">
        {loading && tables.length === 0 && (
          <p className="text-text-muted animate-pulse px-2 py-4 text-xs">Loading tables…</p>
        )}
        {error && (
          <p className="text-error bg-error/5 mb-2 rounded-md px-2 py-2 text-xs">{error}</p>
        )}
        {!loading && !error && visible.length === 0 && (
          <p className="text-text-muted px-2 py-4 text-xs leading-relaxed">
            No tables in <strong>{schema}</strong>. Try another schema above, or run SQL to create
            objects.
          </p>
        )}
        {visible.map((t) => (
          <button
            key={t.name}
            type="button"
            title={`Open ${t.name}`}
            className="oridb-table-row"
            onClick={() => onSelectTable?.(t.name, schema)}
            onDoubleClick={() => {
              const q =
                engine === "sqlite"
                  ? `SELECT * FROM "${t.name.replace(/"/g, '""')}"\nLIMIT 10;`
                  : `SELECT * FROM "${schema.replace(/"/g, '""')}"."${t.name.replace(/"/g, '""')}"\nLIMIT 10;`;
              window.dispatchEvent(
                new CustomEvent("oridb-insert-query", { detail: { sql: q } }),
              );
            }}
          >
            {t.type === "view" ? (
              <Eye className="text-text-muted h-3.5 w-3.5 shrink-0" />
            ) : (
              <Table2 className="text-text-muted h-3.5 w-3.5 shrink-0" />
            )}
            <span className="truncate">{t.name}</span>
          </button>
        ))}
      </div>

      <div className="border-border text-text-muted border-t px-3 py-2 font-mono text-[10px]">
        {visible.length} {visible.length === 1 ? "object" : "objects"}
      </div>
    </div>
  );
}
