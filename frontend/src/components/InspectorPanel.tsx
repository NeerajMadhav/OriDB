/**
 * Right inspector — context for table, column, or query metrics.
 */
import { Activity, Table2 } from "lucide-react";
import { useWorkspaceStore } from "../stores/workspaceStore";
import { EmptyState, PanelHeader } from "./ui";

export function InspectorPanel() {
  const inspector = useWorkspaceStore((s) => s.inspector);

  if (inspector.type === "none") {
    return (
      <div className="flex h-full flex-col">
        <PanelHeader title="Inspector" subtitle="Details & metrics" />
        <EmptyState
          icon={<Table2 className="h-5 w-5" />}
          title="Nothing selected"
          description="Select a table from the sidebar or run a query to see details here."
        />
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
