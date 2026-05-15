/**
 * Heuristic warnings for destructive SQL.
 */
export function dangerHints(sql: string): string[] {
  const hints: string[] = [];
  const s = sql.replace(/\/\*[\s\S]*?\*\/|--[^\n]*/g, " ").toUpperCase();
  if (/\bDROP\b/.test(s)) hints.push("Statement contains DROP");
  if (/\bTRUNCATE\b/.test(s)) hints.push("Statement contains TRUNCATE");
  if (/\bDELETE\s+FROM\b/.test(s) && !/\bWHERE\b/.test(s)) {
    hints.push("DELETE without WHERE");
  }
  return hints;
}
