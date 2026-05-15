/**
 * Visual query builder tab — canvas + live SQL.
 */
import { useEffect, useMemo, useState } from "react";
import ReactFlow, { Background, Controls, MiniMap, useNodesState } from "reactflow";
import type { Node } from "reactflow";
import "reactflow/dist/style.css";
import { visualSql, type VbModel } from "../lib/visualSql";

type Props = {
  schemaTables: string[];
  onRun: (sql: string) => void;
};

export function VisualQueryBuilder({ schemaTables, onRun }: Props) {
  const [model, setModel] = useState<VbModel>({
    tables: [],
    columns: [],
    joins: [],
    where: "",
    limit: 100,
  });

  const sql = useMemo(() => visualSql(model, "pg"), [model]);

  const nodes: Node[] = useMemo(
    () =>
      model.tables.map((t, i) => ({
        id: t,
        data: { label: t },
        position: { x: 40 + i * 220, y: 40 },
        style: {
          background: "var(--surface-elevated)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: 8,
          width: 180,
          fontSize: 12,
        },
      })),
    [model.tables],
  );

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState(nodes);

  useEffect(() => {
    setRfNodes(nodes);
  }, [nodes, setRfNodes]);

  return (
    <div className="flex h-full min-h-[420px] flex-col gap-2 md:flex-row">
      <div className="border-border bg-surface-elevated flex w-full flex-col rounded border md:w-56">
        <div className="text-text-muted border-b px-2 py-1 text-xs font-medium uppercase">
          Schema tables
        </div>
        <div className="oridb-scrollbar max-h-64 overflow-y-auto p-2">
          {schemaTables.map((t) => (
            <button
              key={t}
              type="button"
              className="hover:bg-selection text-text-primary mb-1 w-full rounded px-2 py-1 text-left text-xs"
              onClick={() =>
                setModel((m) =>
                  m.tables.includes(t)
                    ? m
                    : { ...m, tables: [...m.tables, t] },
                )
              }
            >
              + {t}
            </button>
          ))}
        </div>
      </div>
      <div className="border-border bg-surface-elevated min-h-[320px] flex-1 rounded border">
        <ReactFlow nodes={rfNodes} onNodesChange={onNodesChange} fitView>
          <MiniMap />
          <Controls />
          <Background />
        </ReactFlow>
      </div>
      <div className="border-border bg-surface-elevated flex w-full flex-col gap-2 rounded border p-2 md:w-72">
        <label className="text-text-secondary text-xs">WHERE</label>
        <textarea
          className="border-border bg-bg text-text-primary min-h-[72px] rounded border p-2 font-mono text-xs"
          value={model.where}
          onChange={(e) => setModel((m) => ({ ...m, where: e.target.value }))}
        />
        <label className="text-text-secondary text-xs">LIMIT</label>
        <input
          type="number"
          className="border-border bg-bg text-text-primary rounded border px-2 py-1 text-xs"
          value={model.limit}
          onChange={(e) =>
            setModel((m) => ({ ...m, limit: Number(e.target.value) || 0 }))
          }
        />
        <pre className="bg-code-bg text-text-primary oridb-scrollbar max-h-40 overflow-auto rounded p-2 text-[11px]">
          {sql}
        </pre>
        <button
          type="button"
          className="bg-primary hover:bg-primary-hover rounded px-3 py-2 text-sm text-white"
          onClick={() => onRun(sql)}
        >
          Run
        </button>
      </div>
    </div>
  );
}
