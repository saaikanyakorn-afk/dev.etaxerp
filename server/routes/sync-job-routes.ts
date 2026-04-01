import type { Express, Request, Response } from "express";
import { db } from "../db";
import { eq, desc, and } from "drizzle-orm";
import { syncJobQueue, ecommerceConnections } from "@shared/schema";
import { requireAuth, requireModule } from "../route-middleware";

export function registerSyncJobRoutes(app: Express) {
// ===== Sync Job Queue API =====
app.get("/api/sync-queue/stats", requireAuth, async (req, res) => {
  try {
    const { getQueueStats } = await import("./sync-queue");
    const stats = await getQueueStats();
    res.json(stats);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.get("/api/sync-queue/jobs", requireAuth, async (req, res) => {
  try {
    const companyId = Number(req.query.companyId);
    const status = req.query.status as string;
    const conditions: any[] = [];
    if (companyId) conditions.push(eq(syncJobQueue.companyId, companyId));
    if (status) conditions.push(eq(syncJobQueue.status, status));
    const jobs = await db.select().from(syncJobQueue)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(syncJobQueue.createdAt))
      .limit(100);
    res.json(jobs);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post("/api/sync-queue/enqueue", requireAuth, requireModule("ecommerce"), async (req, res) => {
  try {
    const user = req.user as any;
    const { companyId, connectionId, platform, syncType, priority, options } = req.body;
    if (!companyId || !connectionId || !platform) {
      return res.status(400).json({ message: "companyId, connectionId, platform required" });
    }
    const { enqueueSyncJob } = await import("./sync-queue");
    const jobId = await enqueueSyncJob({
      companyId, connectionId, platform,
      syncType: syncType || "orders",
      priority: priority || 0,
      createdBy: user.id,
      options,
    });
    res.json({ jobId, message: "Job enqueued" });
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

app.post("/api/sync-queue/enqueue-all", requireAuth, requireModule("ecommerce"), async (req, res) => {
  try {
    const user = req.user as any;
    const { companyId, syncType, options } = req.body;
    if (!companyId) return res.status(400).json({ message: "companyId required" });

    const connections = await db.select().from(ecommerceConnections).where(
      and(eq(ecommerceConnections.companyId, companyId), eq(ecommerceConnections.status, "connected"))
    );

    const { enqueueSyncJob } = await import("./sync-queue");
    const jobIds: number[] = [];
    for (const conn of connections) {
      const jobId = await enqueueSyncJob({
        companyId, connectionId: conn.id, platform: conn.platform,
        syncType: syncType || "orders",
        createdBy: user.id,
        options,
      });
      jobIds.push(jobId);
    }
    res.json({ jobIds, message: `${jobIds.length} jobs enqueued` });
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

app.delete("/api/sync-queue/jobs/:id", requireAuth, async (req, res) => {
  try {
    await db.delete(syncJobQueue).where(eq(syncJobQueue.id, Number(req.params.id)));
    res.json({ success: true });
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

}
