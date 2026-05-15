/**
 * Virtualized query result grid (TanStack Table + Virtual).
 */
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useMemo, useRef } from "react";

export type GridColumn = { id: string; header: string };

type Props = {
  columns: GridColumn[];
  rows: Record<string, unknown>[];
  onRowDelete?: (row: Record<string, unknown>) => void;
};

export function VirtualDataGrid({ columns, rows, onRowDelete }: Props) {
  const parentRef = useRef<HTMLDivElement>(null);

  const defs = useMemo<ColumnDef<Record<string, unknown>>[]>(
    () =>
      columns.map((c) => ({
        id: c.id,
        accessorKey: c.id,
        header: c.header,
        cell: (info) => {
          const v = info.getValue();
          if (v === null || v === undefined)
            return <span className="text-text-muted rounded bg-code-bg px-1.5 py-0.5 text-xs">NULL</span>;
          if (typeof v === "object")
            return (
              <span className="font-mono text-xs">{JSON.stringify(v)}</span>
            );
          return String(v);
        },
      })),
    [columns],
  );

  const table = useReactTable({
    data: rows,
    columns: defs.length ? defs : [{ id: "_", header: "—", accessorKey: "_" }],
    getCoreRowModel: getCoreRowModel(),
  });

  if (!columns.length) {
    return (
      <div className="text-text-muted border-border bg-surface-elevated flex h-full items-center justify-center rounded border p-4 text-sm">
        No columns to display
      </div>
    );
  }

  const rowVirtualizer = useVirtualizer({
    count: table.getRowModel().rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 28,
    overscan: 12,
  });

  const vRows = rowVirtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      className="oridb-scrollbar border-border bg-surface-elevated h-full overflow-auto rounded border font-mono text-xs"
    >
      <div
        style={{ height: rowVirtualizer.getTotalSize(), position: "relative" }}
      >
        <div className="border-border bg-surface sticky top-0 z-10 flex border-b">
          {table.getHeaderGroups()[0]?.headers.map((h) => (
            <div
              key={h.id}
              className="text-text-secondary border-border min-w-[120px] flex-1 truncate border-r px-2 py-1 font-sans text-[11px] font-medium uppercase tracking-wide last:border-r-0"
            >
              {flexRender(h.column.columnDef.header, h.getContext())}
            </div>
          ))}
        </div>
        {vRows.map((vr) => {
          const row = table.getRowModel().rows[vr.index];
          if (!row) return null;
          return (
            <div
              key={row.id}
              className="border-border absolute left-0 right-0 flex border-b"
              style={{ transform: `translateY(${vr.start + 32}px)` }}
            >
              {row.getVisibleCells().map((cell) => (
                <div
                  key={cell.id}
                  className="border-border text-text-primary min-w-[120px] flex-1 truncate border-r px-2 py-1 last:border-r-0"
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
