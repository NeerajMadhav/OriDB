/**
 * Virtualized data grid with row/cell selection, copy, and optional delete/edit.
 */
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Copy, Trash2 } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cellValueType, copyText, formatCellFull, formatCellPreview } from "../lib/cellValue";
import type { GridCellSelection } from "../lib/gridTypes";
import { useUiStore } from "../stores/uiStore";

export type GridColumn = { id: string; header: string };
export type { GridCellSelection } from "../lib/gridTypes";

type Props = {
  columns: GridColumn[];
  rows: Record<string, unknown>[];
  onRowDelete?: (row: Record<string, unknown>) => void;
  onCellSelect?: (sel: GridCellSelection) => void;
  onCellEdit?: (sel: GridCellSelection) => void;
  editable?: boolean;
};

const ROW_HEIGHT = 28;
const HEADER_HEIGHT = 32;
const GUTTER_WIDTH = 44;

const CellContent = memo(function CellContent({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return (
      <span className="text-text-muted rounded bg-code-bg px-1.5 py-0.5 text-xs">NULL</span>
    );
  }
  if (typeof value === "boolean") {
    return (
      <span className="text-primary font-medium">{value ? "true" : "false"}</span>
    );
  }
  if (typeof value === "object") {
    return (
      <span className="font-mono text-xs" title={formatCellFull(value)}>
        {formatCellPreview(value)}
      </span>
    );
  }
  const text = String(value);
  return (
    <span className="block truncate" title={text.length > 40 ? text : undefined}>
      {text}
    </span>
  );
});

export function VirtualDataGrid({
  columns,
  rows,
  onRowDelete,
  onCellSelect,
  onCellEdit,
  editable = false,
}: Props) {
  const parentRef = useRef<HTMLDivElement>(null);
  const pushToast = useUiStore((s) => s.pushToast);
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);
  const [selectedCell, setSelectedCell] = useState<{
    rowIndex: number;
    columnId: string;
  } | null>(null);

  const defs = useMemo<ColumnDef<Record<string, unknown>>[]>(
    () =>
      columns.map((c) => ({
        id: c.id,
        accessorKey: c.id,
        header: c.header,
        cell: (info) => <CellContent value={info.getValue()} />,
      })),
    [columns],
  );

  const table = useReactTable({
    data: rows,
    columns: defs.length ? defs : [{ id: "_", header: "—", accessorKey: "_" }],
    getCoreRowModel: getCoreRowModel(),
  });

  const rowCount = columns.length ? table.getRowModel().rows.length : 0;

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  });

  const selectCell = useCallback(
    (rowIndex: number, columnId: string) => {
      const row = rows[rowIndex];
      if (!row) return;
      const value = row[columnId];
      setSelectedRowIndex(rowIndex);
      setSelectedCell({ rowIndex, columnId });
      onCellSelect?.({ rowIndex, columnId, row, value });
    },
    [rows, onCellSelect],
  );

  const selectRow = useCallback((rowIndex: number) => {
    if (!rows[rowIndex]) return;
    setSelectedRowIndex(rowIndex);
    setSelectedCell(null);
  }, [rows]);

  const selectedRow =
    selectedRowIndex != null ? (rows[selectedRowIndex] ?? null) : null;

  const copyCellValue = useCallback(async () => {
    if (!selectedCell) {
      pushToast({ type: "error", message: "Select a cell first" });
      return;
    }
    const row = rows[selectedCell.rowIndex];
    if (!row) return;
    try {
      await copyText(formatCellFull(row[selectedCell.columnId]));
      pushToast({ type: "success", message: "Cell copied" });
    } catch {
      pushToast({ type: "error", message: "Copy failed" });
    }
  }, [selectedCell, rows, pushToast]);

  const copyRowJson = useCallback(async () => {
    if (!selectedRow) {
      pushToast({ type: "error", message: "Select a row first" });
      return;
    }
    try {
      await copyText(JSON.stringify(selectedRow, null, 2));
      pushToast({ type: "success", message: "Row copied as JSON" });
    } catch {
      pushToast({ type: "error", message: "Copy failed" });
    }
  }, [selectedRow, pushToast]);

  const deleteRow = useCallback(() => {
    if (!selectedRow || !onRowDelete) return;
    onRowDelete(selectedRow);
    setSelectedRowIndex(null);
    setSelectedCell(null);
  }, [selectedRow, onRowDelete]);

  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Delete" && onRowDelete && selectedRow) {
        e.preventDefault();
        deleteRow();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "c" && selectedCell) {
        e.preventDefault();
        void copyCellValue();
      }
    };
    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  }, [copyCellValue, deleteRow, onRowDelete, selectedCell, selectedRow]);

  if (!columns.length) {
    return (
      <div className="text-text-muted border-border bg-surface-elevated flex h-full items-center justify-center rounded border p-4 text-sm">
        No columns to display
      </div>
    );
  }

  const vRows = rowVirtualizer.getVirtualItems();
  const hasSelection = selectedRowIndex != null;

  return (
    <div className="flex h-full min-h-0 flex-col gap-1">
      {hasSelection && (
        <div className="border-border bg-surface flex shrink-0 flex-wrap items-center gap-1 rounded border px-2 py-1 text-[11px]">
          <span className="text-text-muted mr-1">
            {selectedCell
              ? `Row ${selectedRowIndex! + 1} · ${selectedCell.columnId}`
              : `Row ${selectedRowIndex! + 1} selected`}
          </span>
          <button
            type="button"
            className="border-border hover:bg-selection flex items-center gap-1 rounded border px-2 py-0.5"
            onClick={() => void copyCellValue()}
            disabled={!selectedCell}
            title="Copy cell (Ctrl+C)"
          >
            <Copy className="h-3 w-3" />
            Copy cell
          </button>
          <button
            type="button"
            className="border-border hover:bg-selection flex items-center gap-1 rounded border px-2 py-0.5"
            onClick={() => void copyRowJson()}
          >
            <Copy className="h-3 w-3" />
            Copy row
          </button>
          {onRowDelete && (
            <button
              type="button"
              className="border-error/40 text-error hover:bg-error/10 flex items-center gap-1 rounded border px-2 py-0.5"
              onClick={deleteRow}
              title="Delete row (Del)"
            >
              <Trash2 className="h-3 w-3" />
              Delete row
            </button>
          )}
          {editable && selectedCell && onCellEdit && (
            <button
              type="button"
              className="border-border hover:bg-selection rounded border px-2 py-0.5"
              onClick={() => {
                const row = rows[selectedCell.rowIndex];
                if (!row) return;
                onCellEdit({
                  rowIndex: selectedCell.rowIndex,
                  columnId: selectedCell.columnId,
                  row,
                  value: row[selectedCell.columnId],
                });
              }}
            >
              Edit cell
            </button>
          )}
        </div>
      )}
      <div
        ref={parentRef}
        tabIndex={0}
        className="oridb-scrollbar border-border bg-surface-elevated min-h-0 flex-1 overflow-auto rounded border font-mono text-xs outline-none focus-visible:ring-1 focus-visible:ring-[var(--primary)]"
      >
        <div
          style={{
            height: rowVirtualizer.getTotalSize() + HEADER_HEIGHT,
            position: "relative",
          }}
        >
          <div
            className="border-border bg-surface sticky top-0 z-10 flex border-b"
            style={{ height: HEADER_HEIGHT }}
          >
            <div
              className="text-text-muted border-border shrink-0 border-r px-2 py-1 text-center text-[10px] font-sans font-medium uppercase"
              style={{ width: GUTTER_WIDTH }}
            >
              #
            </div>
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
            const rowSelected = selectedRowIndex === vr.index;
            return (
              <div
                key={row.id}
                className={`border-border absolute left-0 right-0 flex border-b ${
                  rowSelected ? "bg-selection/40" : "hover:bg-selection/15"
                }`}
                style={{
                  height: ROW_HEIGHT,
                  transform: `translateY(${vr.start + HEADER_HEIGHT}px)`,
                }}
              >
                <button
                  type="button"
                  className={`text-text-muted border-border shrink-0 border-r px-1 py-1 text-center text-[10px] ${
                    rowSelected ? "bg-selection/60 font-medium" : ""
                  }`}
                  style={{ width: GUTTER_WIDTH }}
                  onClick={() => selectRow(vr.index)}
                  title="Select row"
                >
                  {vr.index + 1}
                </button>
                {row.getVisibleCells().map((cell) => {
                  const colId = cell.column.id;
                  const cellSelected =
                    selectedCell?.rowIndex === vr.index &&
                    selectedCell.columnId === colId;
                  return (
                    <button
                      key={cell.id}
                      type="button"
                      className={`border-border text-text-primary min-w-[120px] flex-1 truncate border-r px-2 py-1 text-left last:border-r-0 ${
                        cellSelected
                          ? "bg-primary/15 ring-1 ring-inset ring-[var(--primary)]"
                          : ""
                      }`}
                      onClick={() => selectCell(vr.index, colId)}
                      onDoubleClick={() => {
                        if (!editable || !onCellEdit) return;
                        const data = rows[vr.index];
                        if (!data) return;
                        onCellEdit({
                          rowIndex: vr.index,
                          columnId: colId,
                          row: data,
                          value: data[colId],
                        });
                      }}
                      title={`${colId}: ${cellValueType(row.original[colId])} — double-click to edit`}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

