/**
 * Common SQL snippets for the query editor.
 */
export type QuerySnippet = {
  id: string;
  label: string;
  description: string;
  sql: string;
};

export function buildQuerySnippets(opts: {
  dialect: "postgresql" | "mysql" | "sqlite";
  schema: string;
  table?: string;
}): QuerySnippet[] {
  const { dialect, schema, table } = opts;
  const q = (name: string) =>
    dialect === "mysql" ? `\`${name}\`` : `"${name.replace(/"/g, '""')}"`;
  const schemaQ = q(schema);
  const tableRef = table
    ? dialect === "sqlite"
      ? q(table)
      : `${schemaQ}.${q(table)}`
    : dialect === "sqlite"
      ? "your_table"
      : `${schemaQ}.your_table`;

  const listTables =
    dialect === "postgresql"
      ? `SELECT table_schema, table_name, table_type
FROM information_schema.tables
WHERE table_schema = '${schema.replace(/'/g, "''")}'
ORDER BY table_name;`
      : dialect === "mysql"
        ? `SELECT table_schema, table_name, table_type
FROM information_schema.tables
WHERE table_schema = '${schema.replace(/'/g, "''")}'
ORDER BY table_name;`
        : `SELECT name AS table_name, type
FROM sqlite_master
WHERE type IN ('table', 'view')
ORDER BY name;`;

  const listColumns =
    dialect === "sqlite"
      ? table
        ? `PRAGMA table_info(${q(table)});`
        : `-- Select a table from the sidebar first`
      : `SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = '${schema.replace(/'/g, "''")}'
  AND table_name = '${(table ?? "your_table").replace(/'/g, "''")}'
ORDER BY ordinal_position;`;

  return [
    {
      id: "first10",
      label: "First 10 rows",
      description: table ? `Preview ${table}` : "Select * limit 10",
      sql: `SELECT * FROM ${tableRef}\nLIMIT 10;`,
    },
    {
      id: "count",
      label: "Row count",
      description: "Count rows in table",
      sql: `SELECT COUNT(*) AS row_count FROM ${tableRef};`,
    },
    {
      id: "tables",
      label: "List tables",
      description: "Tables in current schema",
      sql: listTables,
    },
    {
      id: "columns",
      label: "List columns",
      description: table ? `Columns in ${table}` : "Table columns",
      sql: listColumns,
    },
    {
      id: "schemas",
      label: "List schemas",
      description: dialect === "sqlite" ? "SQLite uses main" : "All schemas",
      sql:
        dialect === "postgresql"
          ? `SELECT schema_name FROM information_schema.schemata ORDER BY schema_name;`
          : dialect === "mysql"
            ? `SHOW DATABASES;`
            : `SELECT 'main' AS schema_name;`,
    },
  ];
}

export const STARTER_SQL = `-- Write SQL here, then Run (Ctrl+Enter)
SELECT 1 AS connected;
`;
