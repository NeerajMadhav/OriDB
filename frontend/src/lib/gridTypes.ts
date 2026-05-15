/** Shared types for data grids. */
export type GridCellSelection = {
  rowIndex: number;
  columnId: string;
  row: Record<string, unknown>;
  value: unknown;
};
