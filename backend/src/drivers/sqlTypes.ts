/**
 * Database driver adapter contract for SQL engines.
 */
import type { ConnectionConfig } from "../types/connection.js";

export type QueryColumn = { name: string; dataType?: string };

export type QueryResult = {
  columns: QueryColumn[];
  rows: Record<string, unknown>[];
  rowCount: number;
  command: string;
  notices?: string[];
};

export interface SqlDriver {
  readonly engine: ConnectionConfig["engine"];
  test(): Promise<{ ok: boolean; latencyMs: number; error?: string }>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  ping(): Promise<void>;
  query(
    sql: string,
    params?: unknown[],
    options?: { timeoutMs?: number; signal?: AbortSignal },
  ): Promise<QueryResult>;
  /** Optional: cancel current work (best-effort). */
  cancel?(): Promise<void>;
}
