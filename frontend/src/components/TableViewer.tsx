/**
 * Table data viewer with CRUD — data, schema, DDL tabs.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { ExportDataMenu } from "./ExportDataMenu";
import { VirtualDataGrid, type GridCellSelection } from "./VirtualDataGrid";
import { formatCellFull } from "../lib/cellValue";
import { buildInspectorCellContext } from "../lib/inspector";
import { defaultExportBasename } from "../lib/exportData";
import { apiUrl } from "../api/client";
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
  const [missingTable, setMissingTable] = useState(false);
  const [showInsert, setShowInsert] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [editCell, setEditCell] = useState<GridCellSelection | null>(null);
  const [editDraft, setEditDraft] = useState("");

  const loadMeta = useCallback(async () => {
    const [cols, statsRes] = await Promise.all([
      api<{ columns: Col[] }>(
        `/schema/${connId}/tables/${encodeURIComponent(table)}/columns?schema=${encodeURIComponent(schema)}`,
      ),
      api<{ stats: Record<string, unknown> }>(
        `/schema/${connId}/tables/${encodeURIComponent(table)}/stats?schema=${encodeURIComponent(schema)}`,
      ),
    ]);
    setColumns(cols.columns);
    setStats(statsRes.stats);
    setInspector({ type: "table", table, stats: statsRes.stats });
  }, [connId, table, schema, setInspector]);

  const loadRows = useCallback(async () => {
    const data = await api<{ rows: Record<string, unknown>[] }>(
      `/rows/${connId}/${encodeURIComponent(table)}?schema=${encodeURIComponent(schema)}&limit=500`,
    );
    setRows(data.rows);
  }, [connId, table, schema]);

  const loadDdl = useCallback(async () => {
    const ddlRes = await api<{ ddl: string }>(
      `/schema/${connId}/tables/${encodeURIComponent(table)}/ddl?schema=${encodeURIComponent(schema)}`,
    );
    setDdl(ddlRes.ddl);
  }, [connId, table, schema]);

  const refresh = useCallback(
    async (which: "all" | "data" | "schema" | "ddl" = "all") => {
      setLoading(true);
      setMissingTable(false);
      try {
        if (which === "all" || which === "schema") await loadMeta();
        if (which === "all" || which === "data") await loadRows();
        if (which === "all" || which === "ddl") await loadDdl();
      } catch (e) {
        const msg = (e as Error).message;
        if (/does not exist|not found/i.test(msg)) {
          setMissingTable(true);
        }
        pushToast({ type: "error", message: msg });
      } finally {
        setLoading(false);
      }
    },
    [loadMeta, loadRows, loadDdl, pushToast],
  );

  useEffect(() => {
    void refresh("all");
  }, [connId, table, schema]);

  useEffect(() => {
    if (tab === "ddl" && !ddl) void refresh("ddl");
    if (tab === "data" && rows.length === 0 && columns.length > 0) void loadRows();
  }, [tab, ddl, rows.length, columns.length, refresh, loadRows]);

  const gridCols = useMemo(
    () =>
      (columns.length
        ? columns.map((c) => c.name)
        : rows[0]
          ? Object.keys(rows[0])
          : []
      ).map((name) => ({ id: name, header: name })),
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
      await refresh("data");
    } catch (e) {
      pushToast({ type: "error", message: (e as Error).message });
    }
  };

  const handleCellSelect = useCallback(
    (sel: GridCellSelection) => {
      setInspector(buildInspectorCellContext(sel, { table, schema }));
    },
    [table, schema, setInspector],
  );

  const saveCellEdit = async () => {
    if (!editCell) return;
    const pkCol = columns.find((c) => c.isPk)?.name ?? Object.keys(editCell.row)[0];
    if (!pkCol || editCell.row[pkCol] == null) {
      pushToast({ type: "error", message: "Cannot update row without a primary key" });
      return;
    }
    const colMeta = columns.find((c) => c.name === editCell.columnId);
    const parsed =
      editDraft === "" && colMeta?.isNullable
        ? null
        : editDraft;
    try {
      await api(
        `/rows/${connId}/${encodeURIComponent(table)}/${encodeURIComponent(String(editCell.row[pkCol]))}?schema=${encodeURIComponent(schema)}&pkColumn=${encodeURIComponent(pkCol)}`,
        {
          method: "PUT",
          body: JSON.stringify({ row: { [editCell.columnId]: parsed } }),
        },
      );
      pushToast({ type: "success", message: "Cell updated" });
      setEditCell(null);
      setEditDraft("");
      await refresh("data");
    } catch (e) {
      pushToast({ type: "error", message: (e as Error).message });
    }
  };

  const deleteSelected = async (row: Record<string, unknown>) => {
    const pk = columns.find((c) => c.isPk)?.name ?? Object.keys(row)[0];
    if (!pk || row[pk] == null) {
      pushToast({ type: "error", message: "Cannot delete row without a primary key value" });
      return;
    }
    if (!confirm(`Delete row where ${pk} = ${String(row[pk])}?`)) return;
    try {
      await api(
        `/rows/${connId}/${encodeURIComponent(table)}?schema=${encodeURIComponent(schema)}&where=${encodeURIComponent(`${pk} = '${String(row[pk]).replaceAll("'", "''")}'`)}`,
        { method: "DELETE" },
      );
      const pkVal = row[pk];
      setRows((prev) => prev.filter((r) => r[pk] !== pkVal));
      pushToast({ type: "success", message: "Row deleted" });
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

  if (missingTable) {
    return (
      <div className="border-error/30 bg-error/5 text-text-primary m-4 rounded-lg border p-4 text-sm">
        <p className="font-medium">Table not found</p>
        <p className="text-text-muted mt-1">
          <code className="text-text-secondary">
            {schema}.{table}
          </code>{" "}
          does not exist on this database. Close this tab or pick another table from the
          schema sidebar.
        </p>
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
            onClick={() => void refresh("all")}
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
          <ExportDataMenu
            columns={columns.map((c) => ({ name: c.name }))}
            rows={rows}
            basename={defaultExportBasename(table)}
          />
          <a
            className="border-border text-text-secondary hover:text-primary rounded border px-2 py-0.5 text-xs"
            href={apiUrl(
              `/rows/${connId}/${encodeURIComponent(table)}?schema=${encodeURIComponent(schema)}&format=csv&limit=100000`,
            )}
            download={`${table}.csv`}
            title="Download full table as CSV (up to 100k rows)"
          >
            Full CSV
          </a>
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
            editable
            onCellSelect={handleCellSelect}
            onRowDelete={(row) => void deleteSelected(row)}
            onCellEdit={(sel) => {
              setEditCell(sel);
              setEditDraft(formatCellFull(sel.value));
            }}
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
      {editCell && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-surface-elevated border-border w-full max-w-lg rounded-lg border p-4 shadow-lg">
            <h3 className="text-text-primary mb-1 font-semibold">Edit cell</h3>
            <p className="text-text-muted mb-3 font-mono text-xs">
              {editCell.columnId} (row {editCell.rowIndex + 1})
            </p>
            <textarea
              className="border-border bg-bg text-text-primary oridb-scrollbar max-h-48 min-h-[80px] w-full rounded border p-2 font-mono text-xs"
              value={editDraft}
              onChange={(e) => setEditDraft(e.target.value)}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="border-border rounded border px-3 py-1 text-sm"
                onClick={() => {
                  setEditCell(null);
                  setEditDraft("");
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="bg-primary rounded px-3 py-1 text-sm text-white"
                onClick={() => void saveCellEdit()}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
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
