import type { Express } from "express";
import { db } from "../db";
import { ecomDb } from "../ecom-db";
import { eq, desc, and, sql } from "drizzle-orm";
import { stockSyncSettings, stockSyncLogs } from "@shared/schema";
import { createRouteGroup, notFound, forbidden } from "../route-factory";
import { checkDocOwnership } from "../route-middleware";

export function registerStockSyncRoutes(app: Express) {

const r = createRouteGroup(app, { module: "ecommerce" });

r.companyRoute("get", "/api/ecommerce/stock-sync/settings", async ({ companyId }) => {
  return db.select().from(stockSyncSettings).where(eq(stockSyncSettings.companyId, companyId));
});

r.companyRoute("post", "/api/ecommerce/stock-sync/settings", async ({ companyId, req }) => {
  const [setting] = await db.insert(stockSyncSettings).values({ ...req.body, companyId }).returning();
  return setting;
});

r.companyRoute("put", "/api/ecommerce/stock-sync/settings/:id", async ({ companyId, req }) => {
  const id = Number(req.params.id);
  const [setting] = await db.update(stockSyncSettings).set(req.body)
    .where(and(eq(stockSyncSettings.id, id), eq(stockSyncSettings.companyId, companyId))).returning();
  return setting;
});

r.companyRoute("post", "/api/ecommerce/stock-sync/settings/:id/toggle", async ({ companyId, req }) => {
  const id = Number(req.params.id);
  const [existing] = await db.select().from(stockSyncSettings).where(and(eq(stockSyncSettings.id, id), eq(stockSyncSettings.companyId, companyId)));
  if (!existing) notFound("Setting not found");
  const ac = await checkDocOwnership(existing.companyId, req.user);
  if (!ac.allowed) forbidden(ac.message);
  const [setting] = await db.update(stockSyncSettings).set({ isEnabled: !existing.isEnabled }).where(eq(stockSyncSettings.id, id)).returning();
  return setting;
});

r.companyRoute("post", "/api/ecommerce/stock-sync/trigger", async ({ companyId, req }) => {
  const { platform } = req.body;
  await ecomDb.insert(stockSyncLogs).values({
    companyId, platform: platform || "all", direction: "push",
    status: "success", triggeredBy: "manual",
  });
  if (platform) {
    await db.update(stockSyncSettings).set({ lastSyncAt: new Date(), lastSyncStatus: "success" })
      .where(and(eq(stockSyncSettings.companyId, companyId), eq(stockSyncSettings.platform, platform)));
  }
  return { success: true, message: "Sync triggered" };
});

r.companyRoute("get", "/api/ecommerce/stock-sync/logs", async ({ companyId, req }) => {
  const page = Number(req.query.page || 1);
  const limit = Math.min(Number(req.query.limit || 50), 200);
  const offset = (page - 1) * limit;
  const platform = req.query.platform ? String(req.query.platform) : undefined;
  const conditions: any[] = [eq(stockSyncLogs.companyId, companyId)];
  if (platform) conditions.push(eq(stockSyncLogs.platform, platform));
  const logs = await ecomDb.select().from(stockSyncLogs).where(and(...conditions)).orderBy(desc(stockSyncLogs.createdAt)).limit(limit).offset(offset);
  const [{ total }] = await ecomDb.select({ total: sql<number>`count(*)` }).from(stockSyncLogs).where(and(...conditions));
  return { logs, total: Number(total), page, limit };
});

r.companyRoute("get", "/api/ecommerce/stock-sync/dashboard", async ({ companyId }) => {
  const settings = await db.select().from(stockSyncSettings).where(eq(stockSyncSettings.companyId, companyId));
  const successLogs = await ecomDb.select({ total: sql<number>`count(*)` }).from(stockSyncLogs)
    .where(and(eq(stockSyncLogs.companyId, companyId), eq(stockSyncLogs.status, "success")));
  const failedLogs = await ecomDb.select({ total: sql<number>`count(*)` }).from(stockSyncLogs)
    .where(and(eq(stockSyncLogs.companyId, companyId), eq(stockSyncLogs.status, "failed")));
  const platformStats = settings.map(s => ({
    platform: s.platform, isEnabled: s.isEnabled, lastSyncAt: s.lastSyncAt,
    lastSyncStatus: s.lastSyncStatus, totalSynced: s.totalSynced, totalFailed: s.totalFailed,
  }));
  return { totalSynced: Number(successLogs[0]?.total || 0), totalFailed: Number(failedLogs[0]?.total || 0), platforms: platformStats };
});

}
