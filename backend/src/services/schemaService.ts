/**
 * Schema introspection — PostgreSQL, MySQL, SQLite.
 */
import type { ConnectionConfig } from "../types/connection.js";
import type { SqlDriver } from "../drivers/sqlTypes.js";

export type TableSummary = {
  schema: string;
  name: string;
  type: "table" | "view";
};

export type ColumnInfo = {
  name: string;
  dataType: string;
  isNullable: boolean;
  columnDefault: string | null;
  isPk: boolean;
};

/** SQL engines supported by schema introspection (excludes sqlite). */
export type PgMysqlDialect = "pg" | "mysql" | "snowflake";

export type SqlDialect = PgMysqlDialect | "sqlite";

function ph(dialect: PgMysqlDialect, n: number): string {
  return dialect === "mysql" ? "?" : `$${n}`;
}

export function isPgLike(dialect: PgMysqlDialect): boolean {
  return dialect === "pg" || dialect === "snowflake";
}

export async function listDatabases(
  driver: SqlDriver,
  dialect: PgMysqlDialect,
): Promise<string[]> {
  if (dialect === "pg") {
    const r = await driver.query(
      "SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname",
    );
    return r.rows.map((x) => String(x.datname));
  }
  const r = await driver.query("SHOW DATABASES");
  return r.rows
    .map((x) => {
      const row = x as Record<string, unknown>;
      return String(row.Database ?? row.database ?? "");
    })
    .filter(Boolean);
}

export async function listSchemas(
  driver: SqlDriver,
  dialect: PgMysqlDialect,
): Promise<string[]> {
  if (dialect === "pg") {
    const r = await driver.query(
      `SELECT schema_name AS n FROM information_schema.schemata
       WHERE schema_name NOT IN ('pg_catalog','information_schema','pg_toast')
       ORDER BY schema_name`,
    );
    return r.rows.map((x) => String(x.n));
  }
  const r = await driver.query(
    `SELECT SCHEMA_NAME AS n FROM information_schema.SCHEMATA
     WHERE SCHEMA_NAME NOT IN ('mysql','information_schema','performance_schema','sys')
     ORDER BY SCHEMA_NAME`,
  );
  return r.rows.map((x) => String(x.n));
}

export async function listTables(
  driver: SqlDriver,
  dialect: PgMysqlDialect,
  schema: string,
): Promise<TableSummary[]> {
  const p = ph(dialect, 1);
  const r = await driver.query(
    `SELECT table_schema AS s, table_name AS n, table_type AS t
     FROM information_schema.tables
     WHERE table_schema = ${p}
     ORDER BY table_name`,
    [schema],
  );
  return r.rows.map((row) => ({
    schema: String(row.s),
    name: String(row.n),
    type: String(row.t) === "VIEW" ? "view" : "table",
  }));
}

export async function listColumns(
  driver: SqlDriver,
  dialect: PgMysqlDialect,
  schema: string,
  table: string,
): Promise<ColumnInfo[]> {
  if (dialect === "snowflake") {
    const sch = schema.replace(/"/g, '""');
    const tbl = table.replace(/"/g, '""');
    const r = await driver.query(`DESCRIBE TABLE "${sch}"."${tbl}"`);
    return r.rows.map((row) => {
      const rec = row as Record<string, unknown>;
      const pk = String(rec["primary key"] ?? rec.primary_key ?? rec.key ?? "");
      return {
        name: String(rec.name ?? rec.NAME ?? ""),
        dataType: String(rec.type ?? rec.TYPE ?? ""),
        isNullable: String(rec["null?"] ?? rec.null ?? "Y").toUpperCase() === "Y",
        columnDefault:
          rec.default == null || rec.default === ""
            ? null
            : String(rec.default),
        isPk: pk.toUpperCase() === "Y",
      };
    });
  }
  const p1 = ph(dialect, 1);
  const p2 = ph(dialect, 2);
  const r = await driver.query(
    `SELECT c.column_name AS n, c.data_type AS dt, c.is_nullable AS nullable,
            c.column_default AS def,
            EXISTS (
              SELECT 1 FROM information_schema.table_constraints tc
              JOIN information_schema.key_column_usage kcu
                ON tc.constraint_name = kcu.constraint_name
               AND tc.table_schema = kcu.table_schema
              WHERE tc.constraint_type = 'PRIMARY KEY'
                AND tc.table_schema = c.table_schema
                AND tc.table_name = c.table_name
                AND kcu.column_name = c.column_name
            ) AS is_pk
     FROM information_schema.columns c
     WHERE c.table_schema = ${p1} AND c.table_name = ${p2}
     ORDER BY c.ordinal_position`,
    [schema, table],
  );
  return r.rows.map((row) => ({
    name: String(row.n),
    dataType: String(row.dt),
    isNullable: String(row.nullable) === "YES",
    columnDefault: row.def == null ? null : String(row.def),
    isPk: Boolean(row.is_pk),
  }));
}

export async function approximateTableDdl(
  driver: SqlDriver,
  dialect: PgMysqlDialect,
  schema: string,
  table: string,
): Promise<string> {
  const cols = await listColumns(driver, dialect, schema, table);
  const q = isPgLike(dialect)
    ? (s: string) => `"${s.replaceAll('"', '""')}"`
    : (s: string) => `\`${s.replaceAll("`", "``")}\``;
  const lines = cols.map((c) => {
    const nulls = c.isNullable ? "NULL" : "NOT NULL";
    const def =
      c.columnDefault != null && c.columnDefault !== ""
        ? ` DEFAULT ${c.columnDefault}`
        : "";
    const pk = c.isPk ? " PRIMARY KEY" : "";
    return `  ${q(c.name)} ${c.dataType} ${nulls}${def}${pk}`;
  });
  if (isPgLike(dialect)) {
    return `CREATE TABLE ${q(schema)}.${q(table)} (\n${lines.join(",\n")}\n);`;
  }
  return `CREATE TABLE ${q(table)} (\n${lines.join(",\n")}\n);`;
}

export async function listIndexes(
  driver: SqlDriver,
  dialect: PgMysqlDialect,
  schema: string,
  table: string,
) {
  if (isPgLike(dialect)) {
    if (dialect === "snowflake") {
      const sch = schema.replace(/"/g, '""');
      const tbl = table.replace(/"/g, '""');
      const r = await driver.query(`SHOW INDEXES IN TABLE "${sch}"."${tbl}"`);
      return r.rows.map((x) => {
        const row = x as Record<string, unknown>;
        return {
          name: String(row.name ?? row.column_name ?? ""),
          definition: String(row.index_type ?? row.kind ?? ""),
        };
      });
    }
    const r = await driver.query(
      `SELECT indexname AS n, indexdef AS def
       FROM pg_indexes
       WHERE schemaname = $1 AND tablename = $2`,
      [schema, table],
    );
    return r.rows.map((x) => ({ name: String(x.n), definition: String(x.def) }));
  }
  const p1 = ph(dialect, 1);
  const p2 = ph(dialect, 2);
  const r = await driver.query(
    `SELECT index_name AS n, index_type AS t, column_name AS c
     FROM information_schema.statistics
     WHERE table_schema = ${p1} AND table_name = ${p2}
     ORDER BY index_name, seq_in_index`,
    [schema, table],
  );
  return r.rows.map((x) => ({
    name: String(x.n),
    definition: `${String(x.t)} ${String(x.c)}`,
  }));
}

export async function listConstraints(
  driver: SqlDriver,
  dialect: PgMysqlDialect,
  schema: string,
  table: string,
) {
  const p1 = ph(dialect, 1);
  const p2 = ph(dialect, 2);
  const r = await driver.query(
    `SELECT tc.constraint_name AS n, tc.constraint_type AS t
     FROM information_schema.table_constraints tc
     WHERE tc.table_schema = ${p1} AND tc.table_name = ${p2}`,
    [schema, table],
  );
  return r.rows.map((x) => ({ name: String(x.n), type: String(x.t) }));
}

export async function erDiagram(
  driver: SqlDriver,
  dialect: PgMysqlDialect,
  schema: string,
) {
  const p = ph(dialect, 1);
  const r = await driver.query(
    `SELECT
        kcu.table_schema AS src_schema,
        kcu.table_name AS src_table,
        kcu.column_name AS src_col,
        ccu.table_schema AS tgt_schema,
        ccu.table_name AS tgt_table,
        ccu.column_name AS tgt_col,
        tc.constraint_name AS name
     FROM information_schema.table_constraints AS tc
     JOIN information_schema.key_column_usage AS kcu
       ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
     JOIN information_schema.constraint_column_usage AS ccu
       ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
     WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = ${p}`,
    [schema],
  );
  const nodes = new Map<string, { id: string; label: string }>();
  const edges: {
    id: string;
    source: string;
    target: string;
    label: string;
  }[] = [];
  for (const row of r.rows) {
    const src = `${row.src_schema}.${row.src_table}`;
    const tgt = `${row.tgt_schema}.${row.tgt_table}`;
    nodes.set(src, { id: src, label: String(row.src_table) });
    nodes.set(tgt, { id: tgt, label: String(row.tgt_table) });
    edges.push({
      id: `${src}->${tgt}:${row.name}`,
      source: src,
      target: tgt,
      label: `${row.src_col}->${row.tgt_col}`,
    });
  }
  return { nodes: [...nodes.values()], edges };
}

export async function sqliteListTables(driver: SqlDriver): Promise<TableSummary[]> {
  const r = await driver.query(
    `SELECT name AS n, type AS t FROM sqlite_master WHERE type IN ('table','view') ORDER BY name`,
  );
  return r.rows.map((row) => ({
    schema: "main",
    name: String(row.n),
    type: String(row.t) === "view" ? "view" : "table",
  }));
}

export async function sqliteListColumns(
  driver: SqlDriver,
  table: string,
): Promise<ColumnInfo[]> {
  const r = await driver.query(`PRAGMA table_info(${quoteSqliteIdent(table)})`);
  return r.rows.map((row) => ({
    name: String(row.name),
    dataType: String(row.type),
    isNullable: Number(row.notnull) === 0,
    columnDefault: row.dflt_value == null ? null : String(row.dflt_value),
    isPk: Number(row.pk) === 1,
  }));
}

export function dialectOf(
  cfg: ConnectionConfig,
): SqlDialect {
  if (cfg.engine === "snowflake") return "snowflake";
  if (
    cfg.engine === "postgresql" ||
    cfg.engine === "cockroachdb" ||
    cfg.engine === "neon" ||
    cfg.engine === "supabase"
  )
    return "pg";
  if (
    cfg.engine === "mysql" ||
    cfg.engine === "mariadb" ||
    cfg.engine === "planetscale"
  )
    return "mysql";
  return "sqlite";
}

function snowflakeCell(row: Record<string, unknown>): string {
  const v = row.name ?? row.NAME ?? row.schema_name ?? row.SCHEMA_NAME;
  return String(v ?? Object.values(row)[0] ?? "");
}

export async function listSchemasSnowflake(
  driver: SqlDriver,
  database: string,
): Promise<string[]> {
  const db = database.replace(/"/g, '""');
  const r = await driver.query(`SHOW SCHEMAS IN DATABASE "${db}"`);
  return r.rows.map((row) => snowflakeCell(row as Record<string, unknown>)).filter(Boolean);
}

export async function listTablesSnowflake(
  driver: SqlDriver,
  database: string,
  schema: string,
): Promise<TableSummary[]> {
  const db = database.replace(/"/g, '""');
  const sch = schema.replace(/"/g, '""');
  const r = await driver.query(`SHOW TABLES IN SCHEMA "${db}"."${sch}"`);
  return r.rows.map((row) => {
    const rec = row as Record<string, unknown>;
    const name = String(rec.name ?? rec.NAME ?? rec.table_name ?? "");
    return { schema, name, type: "table" as const };
  });
}

function quoteSqliteIdent(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}

export async function listViews(
  driver: SqlDriver,
  dialect: PgMysqlDialect,
  schema: string,
): Promise<{ name: string; definition?: string }[]> {
  const p = ph(dialect, 1);
  const r = await driver.query(
    `SELECT table_name AS n FROM information_schema.views WHERE table_schema = ${p} ORDER BY table_name`,
    [schema],
  );
  return r.rows.map((row) => ({ name: String(row.n) }));
}

export async function listProcedures(
  driver: SqlDriver,
  dialect: PgMysqlDialect,
  schema: string,
) {
  if (dialect === "pg") {
    const r = await driver.query(
      `SELECT p.proname AS n, l.lanname AS lang
       FROM pg_proc p
       JOIN pg_namespace ns ON p.pronamespace = ns.oid
       JOIN pg_language l ON p.prolang = l.oid
       WHERE ns.nspname = $1 AND p.prokind = 'p'
       ORDER BY p.proname`,
      [schema],
    );
    return r.rows.map((row) => ({
      name: String(row.n),
      language: String(row.lang),
    }));
  }
  const p = ph(dialect, 1);
  const r = await driver.query(
    `SELECT ROUTINE_NAME AS n, ROUTINE_TYPE AS t
     FROM information_schema.ROUTINES
     WHERE ROUTINE_SCHEMA = ${p} AND ROUTINE_TYPE = 'PROCEDURE'
     ORDER BY ROUTINE_NAME`,
    [schema],
  );
  return r.rows.map((row) => ({ name: String(row.n), language: String(row.t) }));
}

export async function listFunctions(
  driver: SqlDriver,
  dialect: PgMysqlDialect,
  schema: string,
) {
  if (dialect === "pg") {
    const r = await driver.query(
      `SELECT p.proname AS n, pg_catalog.format_type(p.prorettype, NULL) AS ret, l.lanname AS lang
       FROM pg_proc p
       JOIN pg_namespace ns ON p.pronamespace = ns.oid
       JOIN pg_language l ON p.prolang = l.oid
       WHERE ns.nspname = $1 AND p.prokind = 'f'
       ORDER BY p.proname`,
      [schema],
    );
    return r.rows.map((row) => ({
      name: String(row.n),
      returnType: String(row.ret),
      language: String(row.lang),
    }));
  }
  const p = ph(dialect, 1);
  const r = await driver.query(
    `SELECT ROUTINE_NAME AS n, DATA_TYPE AS ret
     FROM information_schema.ROUTINES
     WHERE ROUTINE_SCHEMA = ${p} AND ROUTINE_TYPE = 'FUNCTION'
     ORDER BY ROUTINE_NAME`,
    [schema],
  );
  return r.rows.map((row) => ({
    name: String(row.n),
    returnType: String(row.ret),
  }));
}

export async function listTriggers(
  driver: SqlDriver,
  dialect: PgMysqlDialect,
  schema: string,
) {
  const p1 = ph(dialect, 1);
  const r = await driver.query(
    isPgLike(dialect)
      ? `SELECT trigger_name AS n, event_manipulation AS ev, action_timing AS timing, event_object_table AS tbl
         FROM information_schema.triggers WHERE trigger_schema = ${p1} ORDER BY trigger_name`
      : `SELECT TRIGGER_NAME AS n, EVENT_MANIPULATION AS ev, ACTION_TIMING AS timing, EVENT_OBJECT_TABLE AS tbl
         FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = ${p1} ORDER BY TRIGGER_NAME`,
    [schema],
  );
  return r.rows.map((row) => ({
    name: String(row.n),
    event: String(row.ev),
    timing: String(row.timing),
    table: String(row.tbl),
  }));
}

export async function tableStats(
  driver: SqlDriver,
  dialect: SqlDialect,
  schema: string,
  table: string,
) {
  if (dialect === "sqlite") {
    const count = await driver.query(
      `SELECT COUNT(*) AS c FROM ${quoteSqliteIdent(table)}`,
    );
    return {
      rowCount: Number(count.rows[0]?.c ?? 0),
      sizeBytes: null,
      lastVacuum: null,
      lastAnalyze: null,
    };
  }
  if (isPgLike(dialect)) {
    if (dialect === "snowflake") {
      const sch = schema.replace(/"/g, '""');
      const tbl = table.replace(/"/g, '""');
      const r = await driver.query(
        `SELECT COUNT(*) AS c FROM "${sch}"."${tbl}"`,
      );
      return {
        rowCount: Number(r.rows[0]?.c ?? 0),
        sizeBytes: null,
        lastVacuum: null,
        lastAnalyze: null,
      };
    }
    const p1 = ph(dialect, 1);
    const p2 = ph(dialect, 2);
    const est = await driver.query(
      `SELECT c.reltuples::bigint AS est, pg_total_relation_size(c.oid) AS bytes,
              s.last_vacuum, s.last_analyze
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
       WHERE n.nspname = ${p1} AND c.relname = ${p2}`,
      [schema, table],
    );
    const row = est.rows[0];
    return {
      rowCount: Number(row?.est ?? 0),
      sizeBytes: Number(row?.bytes ?? 0),
      lastVacuum: row?.last_vacuum ?? null,
      lastAnalyze: row?.last_analyze ?? null,
    };
  }
  const p1 = ph(dialect, 1);
  const p2 = ph(dialect, 2);
  const r = await driver.query(
    `SELECT table_rows AS est, data_length + index_length AS bytes
     FROM information_schema.tables
     WHERE table_schema = ${p1} AND table_name = ${p2}`,
    [schema, table],
  );
  const row = r.rows[0];
  return {
    rowCount: Number(row?.est ?? 0),
    sizeBytes: Number(row?.bytes ?? 0),
    lastVacuum: null,
    lastAnalyze: null,
  };
}

export async function columnStats(
  driver: SqlDriver,
  dialect: SqlDialect,
  schema: string,
  table: string,
  column: string,
) {
  const q =
    dialect === "sqlite"
      ? quoteSqliteIdent(table)
      : isPgLike(dialect)
        ? `"${schema.replaceAll('"', '""')}"."${table.replaceAll('"', '""')}"`
        : `\`${table.replaceAll("`", "``")}\``;
  const col =
    dialect === "mysql"
      ? `\`${column.replaceAll("`", "``")}\``
      : `"${column.replaceAll('"', '""')}"`;
  const r = await driver.query(
    `SELECT MIN(${col}) AS min, MAX(${col}) AS max, AVG(${col}) AS avg,
            COUNT(DISTINCT ${col}) AS distinct_count,
            SUM(CASE WHEN ${col} IS NULL THEN 1 ELSE 0 END) AS null_count
     FROM ${q}`,
  );
  const row = r.rows[0] ?? {};
  return {
    min: row.min ?? null,
    max: row.max ?? null,
    avg: row.avg ?? null,
    distinctCount: Number(row.distinct_count ?? 0),
    nullCount: Number(row.null_count ?? 0),
  };
}

export async function sqliteErDiagram(driver: SqlDriver) {
  const tables = await sqliteListTables(driver);
  const nodes = tables
    .filter((t) => t.type === "table")
    .map((t) => ({ id: t.name, label: t.name }));
  const edges: {
    id: string;
    source: string;
    target: string;
    label: string;
  }[] = [];
  for (const t of tables.filter((x) => x.type === "table")) {
    const fks = await driver.query(`PRAGMA foreign_key_list(${quoteSqliteIdent(t.name)})`);
    for (const fk of fks.rows) {
      edges.push({
        id: `${t.name}->${fk.table}:${fk.id}`,
        source: t.name,
        target: String(fk.table),
        label: `${String(fk.from)}->${String(fk.to)}`,
      });
    }
  }
  return { nodes, edges };
}
