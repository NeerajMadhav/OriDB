/**
 * Right inspector — context for table, column, or query metrics.
 */
import { useWorkspaceStore } from "../stores/workspaceStore";

export function InspectorPanel() {
  const inspector = useWorkspaceStore((s) => s.inspector);

  if (inspector.type === "none") {
    return (
      <div className="text-text-muted flex h-full flex-col p-3 text-xs">
        <div className="text-text-secondary mb-2 font-semibold uppercase tracking-wide">
          Inspector
        </div>
        <p>Select a table or run a query to see details here.</p>
      </div>
    );
  }

  if (inspector.type === "table") {
    const s = inspector.stats ?? {};
    return (
      <div className="oridb-scrollbar flex h-full flex-col overflow-y-auto p-3 text-xs">
        <div className="text-text-secondary mb-2 font-semibold uppercase">Table</div>
        <div className="text-text-primary mb-3 font-medium">{inspector.table}</div>
        <dl className="space-y-2">
          {Object.entries(s).map(([k, v]) => (
            <div key={k}>
              <dt className="text-text-muted capitalize">{k.replace(/([A-Z])/g, " $1")}</dt>
              <dd className="text-text-primary font-mono">{String(v ?? "—")}</dd>
            </div>
          ))}
        </dl>
      </div>
    );
  }

  if (inspector.type === "column") {
    const s = inspector.stats ?? {};
    return (
      <div className="oridb-scrollbar flex h-full flex-col overflow-y-auto p-3 text-xs">
        <div className="text-text-secondary mb-1 font-semibold uppercase">Column</div>
        <div className="text-text-primary mb-3 font-medium">
          {inspector.table}.{inspector.column}
        </div>
        <dl className="space-y-2">
          {Object.entries(s).map(([k, v]) => (
            <div key={k}>
              <dt className="text-text-muted">{k}</dt>
              <dd className="text-text-primary font-mono">{String(v ?? "—")}</dd>
            </div>
          ))}
        </dl>
      </div>
    );
  }

  return (
    <div className="p-3 text-xs">
      <div className="text-text-secondary mb-2 font-semibold uppercase">Query</div>
      <p>Status: {inspector.status ?? "—"}</p>
      <p>Duration: {inspector.durationMs ?? "—"} ms</p>
      <p>Rows: {inspector.rows ?? "—"}</p>
    </div>
  );
}
