/**
 * Table data viewer with CRUD — data, schema, DDL tabs.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { VirtualDataGrid } from "./VirtualDataGrid";
import { useUiStore } from "../stores/uiStore";
import { useWorkspaceStore } from "../stores/workspaceStore";

type Col = { name: string; dataType: string; isNullable: boolean; isPk: boolean };

export function TableViewer({
  connId,
  table,
  schema = "public",
}: {
  connId: string;
  table: string;
  schema?: string;
}) {
  const pushToast = useUiStore((s) => s.pushToast);
  const setInspector = useWorkspaceStore((s) => s.setInspector);
  const [tab, setTab] = useState<"data" | "schema" | "ddl">("data");
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [columns, setColumns] = useState<Col[]>([]);
  const [ddl, setDdl] = useState("");
  const [stats, setStats] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [showInsert, setShowInsert] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [data, cols, ddlRes, statsRes] = await Promise.all([
        api<{ rows: Record<string, unknown>[]; columns: { name: string }[] }>(
          `/rows/${connId}/${encodeURIComponent(table)}?schema=${encodeURIComponent(schema)}&limit=500`,
        ),
        api<{ columns: Col[] }>(
          `/schema/${connId}/tables/${encodeURIComponent(table)}/columns?schema=${encodeURIComponent(schema)}`,
        ),
        api<{ ddl: string }>(
          `/schema/${connId}/tables/${encodeURIComponent(table)}/ddl?schema=${encodeURIComponent(schema)}`,
        ),
        api<{ stats: Record<string, unknown> }>(
          `/schema/${connId}/tables/${encodeURIComponent(table)}/stats?schema=${encodeURIComponent(schema)}`,
        ),
      ]);
      setRows(data.rows);
      setColumns(cols.columns);
      setDdl(ddlRes.ddl);
      setStats(statsRes.stats);
      setInspector({ type: "table", table, stats: statsRes.stats });
    } catch (e) {
      pushToast({ type: "error", message: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, [connId, table, schema, pushToast, setInspector]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const gridCols = useMemo(
    () =>
      (rows[0] ? Object.keys(rows[0]) : columns.map((c) => c.name)).map((name) => ({
        id: name,
        header: name,
      })),
    [rows, columns],
  );

  const insertRow = async () => {
    const row: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(draft)) {
      if (v !== "") row[k] = v;
    }
    try {
      await api(`/rows/${connId}/${encodeURIComponent(table)}?schema=${encodeURIComponent(schema)}`, {
        method: "POST",
        body: JSON.stringify({ row }),
      });
      pushToast({ type: "success", message: "Row inserted" });
      setShowInsert(false);
      setDraft({});
      await refresh();
    } catch (e) {
      pushToast({ type: "error", message: (e as Error).message });
    }
  };

  const deleteSelected = async (row: Record<string, unknown>) => {
    const pk = columns.find((c) => c.isPk)?.name ?? Object.keys(row)[0];
    if (!pk || row[pk] == null) return;
    if (!confirm(`Delete row where ${pk} = ${String(row[pk])}?`)) return;
    try {
      await api(
        `/rows/${connId}/${encodeURIComponent(table)}?schema=${encodeURIComponent(schema)}&where=${encodeURIComponent(`${pk} = '${String(row[pk]).replaceAll("'", "''")}'`)}`,
        { method: "DELETE" },
      );
      pushToast({ type: "success", message: "Row deleted" });
      await refresh();
    } catch (e) {
      pushToast({ type: "error", message: (e as Error).message });
    }
  };

  if (loading) {
    return (
      <div className="text-text-muted animate-pulse p-4 text-sm">
        Loading table…
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-border flex flex-wrap items-center gap-2 border-b px-2 py-1.5">
        <span className="text-text-primary text-sm font-medium">
          {schema} › {table}
        </span>
        <span className="text-text-muted text-xs">
          {String(stats.rowCount ?? rows.length)} rows
        </span>
        <div className="ml-auto flex gap-1">
          <button
            type="button"
            title="Refresh"
            className="border-border rounded border px-2 py-0.5 text-xs"
            onClick={() => void refresh()}
          >
            Refresh
          </button>
          <button
            type="button"
            title="Add row"
            className="bg-primary rounded px-2 py-0.5 text-xs text-white"
            onClick={() => {
              setDraft(Object.fromEntries(columns.map((c) => [c.name, ""])));
              setShowInsert(true);
            }}
          >
            Add row
          </button>
        </div>
      </div>
      <div className="border-border flex gap-1 border-b px-2 py-1 text-xs">
        {(["data", "schema", "ddl"] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={`rounded px-2 py-0.5 capitalize ${tab === t ? "bg-selection" : ""}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 p-1">
        {tab === "data" && (
          <VirtualDataGrid
            columns={gridCols}
            rows={rows}
            onRowDelete={(row) => void deleteSelected(row)}
          />
        )}
        {tab === "schema" && (
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-text-muted border-border border-b">
                <th className="p-2">Name</th>
                <th className="p-2">Type</th>
                <th className="p-2">Null</th>
                <th className="p-2">PK</th>
              </tr>
            </thead>
            <tbody>
              {columns.map((c) => (
                <tr key={c.name} className="border-border border-b">
                  <td className="text-text-primary p-2 font-mono">{c.name}</td>
                  <td className="p-2">{c.dataType}</td>
                  <td className="p-2">{c.isNullable ? "YES" : "NO"}</td>
                  <td className="p-2">{c.isPk ? "✓" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {tab === "ddl" && (
          <pre className="bg-code-bg oridb-scrollbar text-text-primary overflow-auto rounded p-2 font-mono text-xs">
            {ddl}
          </pre>
        )}
      </div>
      {showInsert && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-surface-elevated border-border w-full max-w-md rounded-lg border p-4 shadow-lg">
            <h3 className="text-text-primary mb-3 font-semibold">Insert row</h3>
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {columns.map((c) => (
                <label key={c.name} className="block text-xs">
                  <span className="text-text-muted">
                    {c.name}
                    {!c.isNullable && " *"}
                  </span>
                  <input
                    className="border-border bg-bg text-text-primary mt-0.5 w-full rounded border px-2 py-1 font-mono"
                    value={draft[c.name] ?? ""}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, [c.name]: e.target.value }))
                    }
                  />
                </label>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="border-border rounded border px-3 py-1 text-sm"
                onClick={() => setShowInsert(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="bg-primary rounded px-3 py-1 text-sm text-white"
                onClick={() => void insertRow()}
              >
                Insert
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
