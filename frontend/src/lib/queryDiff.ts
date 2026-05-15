/**
 * Diff two tabular result sets by primary key column or first column.
 */
export type DiffRow = Record<string, unknown> & { __diff?: "left" | "right" | "both" };

export function diffResults(
  left: Record<string, unknown>[],
  right: Record<string, unknown>[],
  keyColumn: string,
): {
  rows: DiffRow[];
  added: number;
  removed: number;
  changed: number;
} {
  const lm = new Map<string, Record<string, unknown>>();
  for (const r of left) {
    const k = String(r[keyColumn] ?? "");
    lm.set(k, r);
  }
  const rm = new Map<string, Record<string, unknown>>();
  for (const r of right) {
    const k = String(r[keyColumn] ?? "");
    rm.set(k, r);
  }
  let added = 0;
  let removed = 0;
  let changed = 0;
  const rows: DiffRow[] = [];
  for (const [k, lr] of lm) {
    const rr = rm.get(k);
    if (!rr) {
      rows.push({ ...lr, __diff: "left" });
      removed += 1;
      continue;
    }
    let cellChange = false;
    const keys = new Set([...Object.keys(lr), ...Object.keys(rr)]);
    for (const ck of keys) {
      if (ck === "__diff") continue;
      if (JSON.stringify(lr[ck]) !== JSON.stringify(rr[ck])) cellChange = true;
    }
    if (cellChange) {
      changed += 1;
      rows.push({ ...lr, ...rr, __diff: "both" });
    } else {
      rows.push({ ...lr, __diff: "both" });
    }
  }
  for (const [k, rr] of rm) {
    if (lm.has(k)) continue;
    rows.push({ ...rr, __diff: "right" });
    added += 1;
  }
  return { rows, added, removed, changed };
}
