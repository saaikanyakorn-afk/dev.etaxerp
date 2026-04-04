import pg from "pg";
import { getConfig } from "../config-bootstrap";
import { db } from "../db";
import { cloneHistory } from "@shared/schema";
import { eq, and } from "drizzle-orm";

const FLUSH_INTERVAL_MS = 60_000;
const RETRY_DELAY_MS = 30_000;
const MAX_BATCH_SIZE = 100;

let centralPool: pg.Pool | null = null;
let flushTimer: ReturnType<typeof setInterval> | null = null;
let machineName: string = "unknown";

function getMachineName(): string {
  if (machineName !== "unknown") return machineName;
  try {
    const hostname = require("os").hostname();
    if (process.env.REPL_SLUG) {
      machineName = `replit-${process.env.REPL_SLUG}`;
    } else if (process.env.DB_MAIN_HOST) {
      machineName = process.env.DB_MAIN_HOST;
    } else {
      machineName = hostname;
    }
  } catch {
    machineName = "unknown";
  }
  return machineName;
}

function getCentralDbUrl(): string | null {
  const prodUrl = getConfig("DB_PROD_URL") || process.env.DB_PROD_URL || getConfig("DB_MAIN_URL");
  return prodUrl || null;
}

async function getCentralPool(): Promise<pg.Pool | null> {
  const url = getCentralDbUrl();
  if (!url) {
    console.log("[CloneHistoryCentral] No central DB URL configured — skipping");
    return null;
  }

  if (centralPool) return centralPool;

  centralPool = new pg.Pool({
    connectionString: url,
    max: 2,
    connectionTimeoutMillis: 8000,
    idleTimeoutMillis: 30000,
  });

  centralPool.on("error", (err) => {
    console.log(`[CloneHistoryCentral] Pool error (non-fatal): ${err.message?.slice(0, 120)}`);
    centralPool = null;
  });

  return centralPool;
}

async function ensureCentralTable(pool: pg.Pool): Promise<boolean> {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS clone_history (
        id SERIAL PRIMARY KEY,
        session_id TEXT NOT NULL,
        clone_type TEXT NOT NULL,
        direction TEXT DEFAULT 'us_to_th',
        table_name TEXT NOT NULL,
        row_count INTEGER DEFAULT 0,
        host_duration_ms INTEGER DEFAULT 0,
        remote_duration_ms INTEGER DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'pending',
        error_message TEXT,
        batch_index INTEGER DEFAULT 0,
        total_batches INTEGER DEFAULT 1,
        started_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP,
        created_by INTEGER,
        dump_file_size INTEGER DEFAULT 0,
        dump_speed INTEGER DEFAULT 0,
        restore_speed INTEGER DEFAULT 0,
        source_machine TEXT,
        synced_to_central BOOLEAN DEFAULT FALSE
      )
    `);
    return true;
  } catch (err: any) {
    console.log(`[CloneHistoryCentral] Failed to ensure table: ${err.message?.slice(0, 120)}`);
    return false;
  }
}

async function sendToCentral(rows: any[]): Promise<boolean> {
  if (rows.length === 0) return true;

  const pool = await getCentralPool();
  if (!pool) return false;

  try {
    await pool.query("SELECT 1");
  } catch {
    centralPool = null;
    return false;
  }

  const ok = await ensureCentralTable(pool);
  if (!ok) return false;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const row of rows) {
      await client.query(
        `INSERT INTO clone_history 
         (session_id, clone_type, direction, table_name, row_count, host_duration_ms, remote_duration_ms, 
          status, error_message, batch_index, total_batches, started_at, completed_at, created_by,
          dump_file_size, dump_speed, restore_speed, source_machine, synced_to_central)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,TRUE)
         ON CONFLICT DO NOTHING`,
        [
          row.sessionId, row.cloneType, row.direction, row.tableName, row.rowCount || 0,
          row.hostDurationMs || 0, row.remoteDurationMs || 0,
          row.status, row.errorMessage || null, row.batchIndex || 0, row.totalBatches || 1,
          row.startedAt, row.completedAt || null, row.createdBy || null,
          row.dumpFileSize || 0, row.dumpSpeed || 0, row.restoreSpeed || 0,
          row.sourceMachine || getMachineName(),
        ]
      );
    }
    await client.query("COMMIT");
    return true;
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    console.log(`[CloneHistoryCentral] Send failed: ${err.message?.slice(0, 150)}`);
    centralPool = null;
    return false;
  } finally {
    client.release();
  }
}

export async function recordCloneHistory(values: any): Promise<void> {
  const machine = getMachineName();
  const enriched = { ...values, sourceMachine: machine };

  try {
    await db.insert(cloneHistory).values(enriched);
  } catch (err: any) {
    console.log(`[CloneHistoryCentral] Local insert failed: ${err.message?.slice(0, 120)}`);
  }

  const sent = await sendToCentral([enriched]);
  if (sent) {
    try {
      await db.update(cloneHistory)
        .set({ syncedToCentral: true })
        .where(
          and(
            eq(cloneHistory.sessionId, values.sessionId),
            eq(cloneHistory.tableName, values.tableName)
          )
        );
    } catch {}
  }
}

async function flushPendingToCentral(): Promise<void> {
  try {
    const pending = await db.select()
      .from(cloneHistory)
      .where(eq(cloneHistory.syncedToCentral, false))
      .limit(MAX_BATCH_SIZE);

    if (pending.length === 0) return;

    console.log(`[CloneHistoryCentral] Flushing ${pending.length} pending records to central...`);

    const sent = await sendToCentral(pending);
    if (sent) {
      const ids = pending.map(r => r.id);
      for (const id of ids) {
        try {
          await db.update(cloneHistory)
            .set({ syncedToCentral: true })
            .where(eq(cloneHistory.id, id));
        } catch {}
      }
      console.log(`[CloneHistoryCentral] ✓ Flushed ${pending.length} records`);
    } else {
      console.log(`[CloneHistoryCentral] Central unavailable — will retry in ${RETRY_DELAY_MS / 1000}s`);
    }
  } catch (err: any) {
    console.log(`[CloneHistoryCentral] Flush error: ${err.message?.slice(0, 120)}`);
  }
}

export function startCentralHistorySync(): void {
  if (flushTimer) return;

  console.log(`[CloneHistoryCentral] Starting sync scheduler (every ${FLUSH_INTERVAL_MS / 1000}s)`);

  setTimeout(() => flushPendingToCentral(), 10_000);

  flushTimer = setInterval(() => flushPendingToCentral(), FLUSH_INTERVAL_MS);
}

export function stopCentralHistorySync(): void {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
  if (centralPool) {
    centralPool.end().catch(() => {});
    centralPool = null;
  }
}
