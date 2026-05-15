/**
 * Deterministic SQL generation from a minimal visual query model.
 */
export type VbJoin = {
  id: string;
  fromTable: string;
  fromCol: string;
  toTable: string;
  toCol: string;
  joinType: "INNER" | "LEFT" | "RIGHT" | "FULL";
};

export type VbModel = {
  tables: string[];
  columns: { table: string; column: string; alias?: string }[];
  joins: VbJoin[];
  where: string;
  limit: number;
};

export function visualSql(m: VbModel, dialect: "pg" | "mysql" | "sqlite"): string {
  const q = dialect === "mysql" ? (x: string) => `\`${x}\`` : (x: string) => `"${x.replaceAll('"', '""')}"`;
  if (!m.tables.length) return "-- Add tables from the schema list";
  const from = q(m.tables[0]!);
  let sql = `SELECT ${m.columns.length ? m.columns.map((c) => `${q(c.table)}.${q(c.column)}${c.alias ? ` AS ${q(c.alias)}` : ""}`).join(", ") : "*"} FROM ${from}`;
  for (const j of m.joins) {
    sql += ` ${j.joinType} JOIN ${q(j.toTable)} ON ${q(j.fromTable)}.${q(j.fromCol)} = ${q(j.toTable)}.${q(j.toCol)}`;
  }
  if (m.where.trim()) sql += ` WHERE ${m.where}`;
  if (m.limit > 0) sql += ` LIMIT ${m.limit}`;
  return sql + ";";
}
