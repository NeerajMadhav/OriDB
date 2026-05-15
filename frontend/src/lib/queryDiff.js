export function diffResults(left, right, keyColumn) {
    const lm = new Map();
    for (const r of left) {
        const k = String(r[keyColumn] ?? "");
        lm.set(k, r);
    }
    const rm = new Map();
    for (const r of right) {
        const k = String(r[keyColumn] ?? "");
        rm.set(k, r);
    }
    let added = 0;
    let removed = 0;
    let changed = 0;
    const rows = [];
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
            if (ck === "__diff")
                continue;
            if (JSON.stringify(lr[ck]) !== JSON.stringify(rr[ck]))
                cellChange = true;
        }
        if (cellChange) {
            changed += 1;
            rows.push({ ...lr, ...rr, __diff: "both" });
        }
        else {
            rows.push({ ...lr, __diff: "both" });
        }
    }
    for (const [k, rr] of rm) {
        if (lm.has(k))
            continue;
        rows.push({ ...rr, __diff: "right" });
        added += 1;
    }
    return { rows, added, removed, changed };
}
