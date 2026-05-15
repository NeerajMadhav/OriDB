/**
 * Build inspector context from grid cell selection.
 */
import { cellValueType, formatCellFull } from "./cellValue";
import type { GridCellSelection } from "./gridTypes";
import type { InspectorCellContext } from "../stores/workspaceStore";

export function buildInspectorCellContext(
  sel: GridCellSelection,
  meta?: { table?: string; schema?: string },
): InspectorCellContext {
  return {
    type: "cell",
    column: sel.columnId,
    table: meta?.table,
    schema: meta?.schema,
    rowIndex: sel.rowIndex,
    value: sel.value,
    displayValue: formatCellFull(sel.value),
    valueType: cellValueType(sel.value),
  };
}
