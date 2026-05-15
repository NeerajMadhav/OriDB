/**
 * Human-readable labels for saved connection profiles.
 */

export type ConnLike = {
  name: string;
  engine: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  readOnly?: boolean;
  ssl?: boolean;
  hasConnectionUrl?: boolean;
};

export function formatConnectionSubtitle(c: ConnLike): string {
  if (c.engine === "sqlite") {
    const path = c.database ?? "";
    if (!path) return "SQLite file";
    const parts = path.replace(/\\/g, "/").split("/");
    return parts[parts.length - 1] || path;
  }
  const bits: string[] = [];
  if (c.host) {
    bits.push(c.port && c.port > 0 ? `${c.host}:${c.port}` : c.host);
  }
  if (c.database) bits.push(c.database);
  if (c.username) bits.push(c.username);
  return bits.length > 0 ? bits.join(" · ") : c.engine;
}

export type ConnectionStats = {
  total: number;
  sqlite: number;
  server: number;
  readOnly: number;
  ssl: number;
  withUrl: number;
  byEngine: Record<string, number>;
  activeId: string | null;
};

export function computeConnectionStats(
  list: ConnLike[],
  activeId: string | null,
): ConnectionStats {
  const byEngine: Record<string, number> = {};
  let sqlite = 0;
  let readOnly = 0;
  let ssl = 0;
  let withUrl = 0;

  for (const c of list) {
    byEngine[c.engine] = (byEngine[c.engine] ?? 0) + 1;
    if (c.engine === "sqlite") sqlite += 1;
    if (c.readOnly) readOnly += 1;
    if (c.ssl) ssl += 1;
    if (c.hasConnectionUrl) withUrl += 1;
  }

  return {
    total: list.length,
    sqlite,
    server: list.length - sqlite,
    readOnly,
    ssl,
    withUrl,
    byEngine,
    activeId,
  };
}
