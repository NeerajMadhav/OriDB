/**
 * Right inspector — table stats, cell value, column, or query metrics.
 */
import { Activity, Copy, Table2 } from "lucide-react";
import { copyText, formatCellFull } from "../lib/cellValue";
import { useWorkspaceStore } from "../stores/workspaceStore";
import { useUiStore } from "../stores/uiStore";
import { EmptyState, PanelHeader } from "./ui";

export function InspectorPanel() {
  const inspector = useWorkspaceStore((s) => s.inspector);
  const pushToast = useUiStore((s) => s.pushToast);

  if (inspector.type === "none") {
    return (
      <div className="flex h-full flex-col">
        <PanelHeader title="Inspector" subtitle="Details & metrics" />
        <EmptyState
          icon={<Table2 className="h-5 w-5" />}
          title="Nothing selected"
          description="Click a cell in the grid to inspect its full value, or select a table from the sidebar."
        />
      </div>
    );
  }

  if (inspector.type === "cell") {
    const label = inspector.table
      ? `${inspector.table}.${inspector.column}`
      : inspector.column;
    const copyValue = async () => {
      try {
        await copyText(inspector.displayValue);
        pushToast({ type: "success", message: "Copied to clipboard" });
      } catch {
        pushToast({ type: "error", message: "Copy failed" });
      }
    };
    return (
      <div className="flex h-full min-h-0 flex-col">
        <PanelHeader
          title="Cell"
          subtitle={label}
          action={
            <button
              type="button"
              className="border-border hover:bg-selection flex items-center gap-1 rounded border px-2 py-1 text-[10px]"
              onClick={() => void copyValue()}
            >
              <Copy className="h-3 w-3" />
              Copy
            </button>
          }
        />
        <dl className="border-border shrink-0 space-y-2 border-b px-3 py-2 text-xs">
          <div className="flex justify-between gap-2">
            <dt className="text-text-muted">Row</dt>
            <dd className="text-text-primary font-mono">{inspector.rowIndex + 1}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-text-muted">Type</dt>
            <dd className="text-text-primary font-mono capitalize">{inspector.valueType}</dd>
          </div>
          {inspector.schema && (
            <div className="flex justify-between gap-2">
              <dt className="text-text-muted">Schema</dt>
              <dd className="text-text-primary font-mono">{inspector.schema}</dd>
            </div>
          )}
        </dl>
        <div className="oridb-scrollbar min-h-0 flex-1 overflow-y-auto p-3">
          {inspector.value === null || inspector.value === undefined ? (
            <span className="text-text-muted rounded bg-code-bg px-2 py-1 text-xs">NULL</span>
          ) : (
            <pre className="bg-code-bg text-text-primary whitespace-pre-wrap break-all rounded p-2 font-mono text-xs leading-relaxed">
              {inspector.displayValue || formatCellFull(inspector.value)}
            </pre>
          )}
        </div>
        <p className="text-text-muted shrink-0 px-3 pb-3 text-[10px]">
          Double-click a cell in a table tab to edit. Press Del to delete the selected row.
        </p>
      </div>
    );
  }

  if (inspector.type === "table") {
    const s = inspector.stats ?? {};
    return (
      <div className="flex h-full flex-col">
        <PanelHeader title="Table" subtitle={inspector.table} />
        <dl className="oridb-scrollbar flex-1 space-y-3 overflow-y-auto px-3 pb-4 text-xs">
          {Object.entries(s).map(([k, v]) => (
            <div key={k} className="border-border border-b pb-2 last:border-0">
              <dt className="text-text-muted mb-0.5 capitalize">
                {k.replace(/([A-Z])/g, " $1")}
              </dt>
              <dd className="text-text-primary font-mono text-sm">{String(v ?? "—")}</dd>
            </div>
          ))}
          {Object.keys(s).length === 0 && (
            <p className="text-text-muted">No statistics available for this table.</p>
          )}
        </dl>
      </div>
    );
  }

  if (inspector.type === "column") {
    const s = inspector.stats ?? {};
    return (
      <div className="flex h-full flex-col">
        <PanelHeader
          title="Column"
          subtitle={`${inspector.table}.${inspector.column}`}
        />
        <dl className="oridb-scrollbar flex-1 space-y-3 overflow-y-auto px-3 pb-4 text-xs">
          {Object.entries(s).map(([k, v]) => (
            <div key={k} className="border-border border-b pb-2 last:border-0">
              <dt className="text-text-muted mb-0.5">{k}</dt>
              <dd className="text-text-primary font-mono text-sm">{String(v ?? "—")}</dd>
            </div>
          ))}
        </dl>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <PanelHeader title="Query" subtitle="Last execution" />
      <div className="space-y-3 px-3 text-xs">
        <div className="oridb-panel flex items-center gap-3 p-3">
          <Activity className="text-primary h-4 w-4 shrink-0" />
          <div>
            <p className="text-text-muted">Status</p>
            <p className="text-text-primary font-medium capitalize">
              {inspector.status ?? "—"}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Duration" value={inspector.durationMs != null ? `${inspector.durationMs} ms` : "—"} />
          <Stat label="Rows" value={inspector.rows != null ? String(inspector.rows) : "—"} />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="oridb-panel p-2.5">
      <p className="text-text-muted text-[10px] uppercase tracking-wide">{label}</p>
      <p className="text-text-primary mt-0.5 font-mono text-sm font-medium">{value}</p>
    </div>
  );
}


