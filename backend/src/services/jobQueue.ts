/**
 * Background import/export jobs with WebSocket progress.
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import PQueue from "p-queue";
import { createReadStream } from "node:fs";
import csv from "csv-parser";
import archiver from "archiver";
import { ensureDir, getOriDbHome } from "../paths/oridbHome.js";
import { getHandle } from "../registry/connectionRegistry.js";
import { getConnectionOr404 } from "../routes/connections.js";
import { dialectOf, isPgLike } from "./schemaService.js";
import { rowsToCsv } from "../util/exportCsv.js";
import { broadcast } from "../ws/multiplex.js";

export type JobState = {
  id: string;
  kind: "import" | "export";
  status: "pending" | "running" | "paused" | "done" | "error" | "cancelled";
  progress: number;
  total?: number;
  processed: number;
  message?: string;
  inserted?: number;
  skipped?: number;
  failed?: number;
  filePath?: string;
  connectionId?: string;
  table?: string;
};

const queue = new PQueue({ concurrency: Number(process.env.ORIDB_JOB_CONCURRENCY ?? 3) });
const jobs = new Map<string, JobState>();

function jobsDir(): string {
  const d = path.join(getOriDbHome(), "jobs");
  ensureDir(d);
  return d;
}

export function getJob(id: string): JobState | undefined {
  return jobs.get(id);
}

export function listExportJobs(): string[] {
  return [...jobs.entries()]
    .filter(([, j]) => j.kind === "export")
    .map(([id]) => id);
}

export function cancelJob(id: string): boolean {
  const j = jobs.get(id);
  if (!j || j.status === "done") return false;
  j.status = "cancelled";
  jobs.set(id, j);
  return true;
}

function emit(job: JobState): void {
  broadcast("importProgress", { type: "job", job });
  broadcast("notifications", {
    type: "notify",
    title: job.kind === "import" ? "Import" : "Export",
    body: job.message ?? job.status,
  });
}

export function startImportJob(opts: {
  connectionId: string;
  table: string;
  filePath: string;
  schema?: string;
  hasHeader?: boolean;
}): string {
  const jobId = randomUUID();
  const job: JobState = {
    id: jobId,
    kind: "import",
    status: "pending",
    progress: 0,
    processed: 0,
    connectionId: opts.connectionId,
    table: opts.table,
  };
  jobs.set(jobId, job);
  void queue.add(async () => {
    job.status = "running";
    emit(job);
    try {
      const cfg = getConnectionOr404(opts.connectionId);
      if (!cfg) throw new Error("Connection not found");
      const h = getHandle(opts.connectionId);
      if (!h?.sql) throw new Error("SQL connection not active");
      const dialect = dialectOf(cfg);
      const schema = opts.schema ?? "public";
      const fq =
        dialect === "sqlite"
          ? `"${opts.table.replaceAll('"', '""')}"`
          : isPgLike(dialect)
            ? `"${schema.replaceAll('"', '""')}"."${opts.table.replaceAll('"', '""')}"`
            : `\`${opts.table.replaceAll("`", "``")}\``;
      let inserted = 0;
      let failed = 0;
      const stream = createReadStream(opts.filePath).pipe(
        csv({ headers: opts.hasHeader !== false }),
      );
      for await (const row of stream) {
        if (jobs.get(jobId)?.status === "cancelled") break;
        const cols = Object.keys(row as Record<string, unknown>);
        if (!cols.length) continue;
        const placeholders =
          dialect === "pg" || dialect === "snowflake"
            ? cols.map((_, i) => `$${i + 1}`).join(", ")
            : cols.map(() => "?").join(", ");
        const qCols = cols
          .map((c) =>
            dialect === "mysql"
              ? `\`${c.replaceAll("`", "``")}\``
              : `"${c.replaceAll('"', '""')}"`,
          )
          .join(", ");
        const sql = `INSERT INTO ${fq} (${qCols}) VALUES (${placeholders})`;
        try {
          await h.sql!.query(sql, cols.map((c) => (row as Record<string, unknown>)[c]));
          inserted++;
        } catch {
          failed++;
        }
        job.processed++;
        if (job.processed % 1000 === 0) {
          job.inserted = inserted;
          job.failed = failed;
          job.message = `Row ${job.processed} — ${inserted} inserted`;
          emit(job);
        }
      }
      job.inserted = inserted;
      job.failed = failed;
      job.status = "done";
      job.progress = 100;
      job.message = `Complete: ${inserted} inserted, ${failed} failed`;
    } catch (e) {
      job.status = "error";
      job.message = e instanceof Error ? e.message : String(e);
    }
    emit(job);
    try {
      fs.unlinkSync(opts.filePath);
    } catch {
      /* ignore */
    }
  });
  return jobId;
}

export function startExportJob(opts: {
  connectionId: string;
  tables: string[];
  schema?: string;
  format?: "csv" | "jsonl";
}): string {
  const jobId = randomUUID();
  const outPath = path.join(jobsDir(), `${jobId}.zip`);
  const job: JobState = {
    id: jobId,
    kind: "export",
    status: "pending",
    progress: 0,
    processed: 0,
    filePath: outPath,
    connectionId: opts.connectionId,
  };
  jobs.set(jobId, job);
  void queue.add(async () => {
    job.status = "running";
    emit(job);
    try {
      const cfg = getConnectionOr404(opts.connectionId);
      if (!cfg) throw new Error("Connection not found");
      const h = getHandle(opts.connectionId);
      if (!h?.sql) throw new Error("SQL connection not active");
      const dialect = dialectOf(cfg);
      const schema = opts.schema ?? "public";
      const output = fs.createWriteStream(outPath);
      const archive = archiver("zip", { zlib: { level: 6 } });
      archive.pipe(output);
      let i = 0;
      for (const table of opts.tables) {
        if (jobs.get(jobId)?.status === "cancelled") break;
        const fq =
          dialect === "sqlite"
            ? `"${table.replaceAll('"', '""')}"`
            : isPgLike(dialect)
              ? `"${schema.replaceAll('"', '""')}"."${table.replaceAll('"', '""')}"`
              : `\`${table.replaceAll("`", "``")}\``;
        const r = await h.sql!.query(`SELECT * FROM ${fq}`);
        if (opts.format === "csv") {
          const csv = rowsToCsv(r.columns, r.rows);
          archive.append(csv, { name: `${table}.csv` });
        } else {
          const lines = r.rows.map((row) => JSON.stringify(row)).join("\n");
          archive.append(lines, { name: `${table}.jsonl` });
        }
        i++;
        job.processed = i;
        job.progress = Math.round((i / opts.tables.length) * 100);
        emit(job);
      }
      await archive.finalize();
      await new Promise<void>((resolve, reject) => {
        output.on("close", () => resolve());
        output.on("error", reject);
      });
      job.status = "done";
      job.progress = 100;
      job.message = "Export ready for download";
    } catch (e) {
      job.status = "error";
      job.message = e instanceof Error ? e.message : String(e);
    }
    emit(job);
  });
  return jobId;
}
