export function visualSql(m, dialect) {
    const q = dialect === "mysql" ? (x) => `\`${x}\`` : (x) => `"${x.replaceAll('"', '""')}"`;
    if (!m.tables.length)
        return "-- Add tables from the schema list";
    const from = q(m.tables[0]);
    let sql = `SELECT ${m.columns.length ? m.columns.map((c) => `${q(c.table)}.${q(c.column)}${c.alias ? ` AS ${q(c.alias)}` : ""}`).join(", ") : "*"} FROM ${from}`;
    for (const j of m.joins) {
        sql += ` ${j.joinType} JOIN ${q(j.toTable)} ON ${q(j.fromTable)}.${q(j.fromCol)} = ${q(j.toTable)}.${q(j.toCol)}`;
    }
    if (m.where.trim())
        sql += ` WHERE ${m.where}`;
    if (m.limit > 0)
        sql += ` LIMIT ${m.limit}`;
    return sql + ";";
}
