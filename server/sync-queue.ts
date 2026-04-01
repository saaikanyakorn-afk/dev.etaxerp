import { db } from "./db";
import { ecomDb } from "./ecom-db";
import { syncJobQueue, ecommerceConnections, companies, tenantPlatformCredentials, syncLogs } from "@shared/schema";
import { eq, and, lte, sql, asc } from "drizzle-orm";

const MAX_CONCURRENT = 10;
let isProcessing = false;
let activeJobs = 0;

export function log(message: string) {
  const now = new Date().toLocaleTimeString("en-US", { hour12: false });
  console.log(`${now} [sync-queue] ${message}`);
}

export async function enqueueSyncJob(params: {
  companyId: number;
  connectionId: number;
  platform: string;
  syncType?: string;
  priority?: number;
  createdBy?: number;
  options?: Record<string, any>;
}): Promise<number> {
  if (!tableVerified) {
    const exists = await checkTableExists();
    if (!exists) throw new Error("sync_job_queue table not available");
  }
  const existing = await db.select().from(syncJobQueue).where(
    and(
      eq(syncJobQueue.companyId, params.companyId),
      eq(syncJobQueue.connectionId, params.connectionId),
      eq(syncJobQueue.platform, params.platform),
      eq(syncJobQueue.syncType, params.syncType || "orders"),
      eq(syncJobQueue.status, "pending"),
    )
  );

  if (existing.length > 0) {
    return existing[0].id;
  }

  const [job] = await db.insert(syncJobQueue).values({
    companyId: params.companyId,
    connectionId: params.connectionId,
    platform: params.platform,
    syncType: params.syncType || "orders",
    priority: params.priority || 0,
    createdBy: params.createdBy,
    options: params.options ? JSON.stringify(params.options) : null,
  }).returning();

  return job.id;
}

async function claimJobs(limit: number): Promise<number[]> {
  const result = await db.execute(sql.raw(`
    UPDATE sync_job_queue
    SET status = 'running', started_at = NOW(), attempts = attempts + 1
    WHERE id IN (
      SELECT id FROM sync_job_queue
      WHERE status = 'pending' AND scheduled_at <= NOW()
      ORDER BY priority ASC, scheduled_at ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id
  `));
  return (result.rows as any[]).map(r => r.id);
}

async function processJob(jobId: number) {
  activeJobs++;
  try {
    const [job] = await db.select().from(syncJobQueue).where(eq(syncJobQueue.id, jobId));
    if (!job || job.status !== "running") {
      activeJobs--;
      return;
    }

    const [conn] = await ecomDb.select().from(ecommerceConnections).where(eq(ecommerceConnections.id, job.connectionId));
    if (!conn || conn.status !== "connected" || !conn.accessToken) {
      await db.update(syncJobQueue).set({
        status: "failed",
        lastError: "Connection not available or not connected",
        completedAt: new Date(),
      }).where(eq(syncJobQueue.id, jobId));
      activeJobs--;
      return;
    }

    const [comp] = await db.select().from(companies).where(eq(companies.id, conn.companyId));
    if (!comp?.tenantId) {
      await db.update(syncJobQueue).set({
        status: "failed",
        lastError: "Company or tenant not found",
        completedAt: new Date(),
      }).where(eq(syncJobQueue.id, jobId));
      activeJobs--;
      return;
    }

    const [cred] = await db.select().from(tenantPlatformCredentials).where(
      and(
        eq(tenantPlatformCredentials.tenantId, comp.tenantId),
        eq(tenantPlatformCredentials.platform, conn.platform),
        eq(tenantPlatformCredentials.active, true),
      )
    );

    if (!cred) {
      await db.update(syncJobQueue).set({
        status: "failed",
        lastError: "Platform credentials not found",
        completedAt: new Date(),
      }).where(eq(syncJobQueue.id, jobId));
      activeJobs--;
      return;
    }

    const { getAdapter } = await import("./platforms");
    const adapter = getAdapter(conn.platform);
    if (!adapter) {
      await db.update(syncJobQueue).set({
        status: "failed",
        lastError: `Unsupported platform: ${conn.platform}`,
        completedAt: new Date(),
      }).where(eq(syncJobQueue.id, jobId));
      activeJobs--;
      return;
    }

    const credentials: any = {
      appId: cred.appId,
      appSecret: cred.appSecret,
      region: cred.region || "TH",
      sandbox: cred.sandbox || false,
      extra: cred.extra ? JSON.parse(cred.extra) : {},
    };

    const options = job.options ? JSON.parse(job.options) : {};
    let result: any;

    switch (job.syncType) {
      case "orders":
        result = await adapter.getOrders(credentials, conn.accessToken, conn.shopId || "", options);
        break;
      case "returns":
        result = await adapter.getReturns(credentials, conn.accessToken, conn.shopId || "", options);
        break;
      case "cancellations":
        result = await adapter.getCancellations(credentials, conn.accessToken, conn.shopId || "", options);
        break;
      case "settlements":
        result = await adapter.getSettlements(credentials, conn.accessToken, conn.shopId || "", options);
        break;
      case "finance":
        result = await adapter.getFinanceReport(credentials, conn.accessToken, conn.shopId || "", options);
        break;
      default:
        throw new Error(`Unsupported sync type: ${job.syncType}`);
    }

    const recordCount = Array.isArray(result?.data) ? result.data.length : (result ? 1 : 0);

    await ecomDb.update(ecommerceConnections).set({ lastSyncAt: new Date() }).where(eq(ecommerceConnections.id, conn.id));

    await ecomDb.insert(syncLogs).values({
      connectionId: conn.id,
      companyId: conn.companyId,
      platform: conn.platform,
      syncType: job.syncType,
      status: "completed",
      totalRecords: recordCount,
    });

    await db.update(syncJobQueue).set({
      status: "completed",
      completedAt: new Date(),
    }).where(eq(syncJobQueue.id, jobId));

    log(`Job #${jobId} completed: ${conn.platform} ${job.syncType} for company ${job.companyId} (${recordCount} records)`);

  } catch (err: any) {
    const [job] = await db.select().from(syncJobQueue).where(eq(syncJobQueue.id, jobId));
    if (job && job.attempts < job.maxAttempts) {
      await db.update(syncJobQueue).set({
        status: "pending",
        lastError: err.message?.slice(0, 500),
        scheduledAt: new Date(Date.now() + 30000 * job.attempts),
      }).where(eq(syncJobQueue.id, jobId));
      log(`Job #${jobId} failed (attempt ${job.attempts}/${job.maxAttempts}), retrying: ${err.message?.slice(0, 100)}`);
    } else {
      await db.update(syncJobQueue).set({
        status: "failed",
        lastError: err.message?.slice(0, 500),
        completedAt: new Date(),
      }).where(eq(syncJobQueue.id, jobId));
      log(`Job #${jobId} permanently failed: ${err.message?.slice(0, 100)}`);
    }
  } finally {
    activeJobs--;
  }
}

async function processQueue() {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const slotsAvailable = MAX_CONCURRENT - activeJobs;
    if (slotsAvailable <= 0) return;

    const claimedIds = await claimJobs(slotsAvailable);

    if (claimedIds.length > 0) {
      log(`Claimed ${claimedIds.length} sync jobs (${activeJobs} active, ${MAX_CONCURRENT} max)`);
      for (const id of claimedIds) {
        processJob(id);
      }
    }
  } catch (err: any) {
    console.error("Queue processing error:", err.message);
  } finally {
    isProcessing = false;
  }
}

async function cleanOldJobs() {
  try {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    await db.delete(syncJobQueue).where(
      and(
        sql`${syncJobQueue.status} IN ('completed', 'failed')`,
        lte(syncJobQueue.completedAt, cutoff),
      )
    );
  } catch (err: any) {
    console.error("Job cleanup error:", err.message);
  }
}

let queueInterval: NodeJS.Timeout | null = null;
let cleanupInterval: NodeJS.Timeout | null = null;

let tableVerified = false;
let lastTableCheck = 0;

async function checkTableExists(): Promise<boolean> {
  if (tableVerified) return true;
  const now = Date.now();
  if (now - lastTableCheck < 60000) return false;
  lastTableCheck = now;
  try {
    const res = await db.execute(sql.raw(
      `SELECT 1 FROM information_schema.tables WHERE table_name='sync_job_queue'`
    ));
    if ((res.rows as any[]).length > 0) {
      tableVerified = true;
      return true;
    }
    if (lastTableCheck === now) {
      log("sync_job_queue table does not exist, will recheck every 60s");
    }
    return false;
  } catch {
    return false;
  }
}

export function startSyncQueueWorker() {
  queueInterval = setInterval(async () => {
    if (await checkTableExists()) processQueue();
  }, 5000);
  cleanupInterval = setInterval(async () => {
    if (tableVerified) cleanOldJobs();
  }, 60 * 60 * 1000);
  log("Sync queue worker started (polling every 5s, max concurrent: " + MAX_CONCURRENT + ")");
}

export function stopSyncQueueWorker() {
  if (queueInterval) clearInterval(queueInterval);
  if (cleanupInterval) clearInterval(cleanupInterval);
  log("Sync queue worker stopped");
}

export async function getQueueStats() {
  try {
    const result = await db.execute(sql.raw(`
      SELECT 
        status, 
        COUNT(*)::int as count 
      FROM sync_job_queue 
      GROUP BY status
    `));
    const stats: Record<string, number> = {};
    for (const row of result.rows as any[]) {
      stats[row.status] = row.count;
    }
    return {
      pending: stats.pending || 0,
      running: stats.running || 0,
      completed: stats.completed || 0,
      failed: stats.failed || 0,
      activeWorkers: activeJobs,
      maxConcurrent: MAX_CONCURRENT,
    };
  } catch {
    return { pending: 0, running: 0, completed: 0, failed: 0, activeWorkers: 0, maxConcurrent: MAX_CONCURRENT };
  }
}
