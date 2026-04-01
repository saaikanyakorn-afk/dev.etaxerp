import type { Express } from "express";
import { requireAuth, requireModule } from "../route-middleware";
import { syncModuleToAccounting, getSyncStatus, startAutoSync, stopAutoSync } from "../module-sync-engine";
import { db } from "../db";
import { eq, and, desc } from "drizzle-orm";
import { moduleSyncLogs } from "@shared/schema";

export function registerModuleSyncRoutes(app: Express) {
  app.post("/api/module-sync/run", requireAuth, requireModule("accounting"), async (req, res) => {
    try {
      const companyId = Number(req.query.companyId || (req.user as any)?.primaryCompanyId);
      const module = (req.body.module || "all") as "pos" | "ecommerce" | "all";

      if (!companyId) return res.status(400).json({ message: "กรุณาระบุ companyId" });

      const results = await syncModuleToAccounting(companyId, module);

      const totalSynced = results.reduce((sum, r) => sum + r.synced, 0);
      const totalErrors = results.reduce((sum, r) => sum + r.errors, 0);
      const totalSkipped = results.reduce((sum, r) => sum + r.skipped, 0);

      res.json({
        success: true,
        summary: {
          synced: totalSynced,
          skipped: totalSkipped,
          errors: totalErrors,
        },
        results,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/module-sync/status", requireAuth, requireModule("accounting"), async (req, res) => {
    try {
      const companyId = Number(req.query.companyId || (req.user as any)?.primaryCompanyId);
      if (!companyId) return res.status(400).json({ message: "กรุณาระบุ companyId" });

      const status = await getSyncStatus(companyId);
      res.json(status);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/module-sync/logs", requireAuth, requireModule("accounting"), async (req, res) => {
    try {
      const companyId = Number(req.query.companyId || (req.user as any)?.primaryCompanyId);
      const module = req.query.module as string | undefined;
      const limit = Math.min(Number(req.query.limit) || 50, 200);
      const offset = Number(req.query.offset) || 0;

      if (!companyId) return res.status(400).json({ message: "กรุณาระบุ companyId" });

      const conditions = [eq(moduleSyncLogs.companyId, companyId)];
      if (module) conditions.push(eq(moduleSyncLogs.sourceModule, module));

      const logs = await db.select().from(moduleSyncLogs)
        .where(and(...conditions))
        .orderBy(desc(moduleSyncLogs.syncedAt))
        .limit(limit)
        .offset(offset);

      res.json({ data: logs, pagination: { limit, offset } });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/module-sync/retry-errors", requireAuth, requireModule("accounting"), async (req, res) => {
    try {
      const companyId = Number(req.query.companyId || (req.user as any)?.primaryCompanyId);
      if (!companyId) return res.status(400).json({ message: "กรุณาระบุ companyId" });

      await db.delete(moduleSyncLogs).where(and(
        eq(moduleSyncLogs.companyId, companyId),
        eq(moduleSyncLogs.status, "error"),
      ));

      const results = await syncModuleToAccounting(companyId, "all");
      const totalSynced = results.reduce((sum, r) => sum + r.synced, 0);

      res.json({ success: true, retriedAndSynced: totalSynced, results });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/module-sync/auto-sync", requireAuth, requireModule("accounting"), async (req, res) => {
    try {
      const action = req.body.action as "start" | "stop";
      const intervalMinutes = Number(req.body.intervalMinutes) || 30;

      if (action === "stop") {
        stopAutoSync();
        res.json({ success: true, message: "หยุด auto-sync แล้ว" });
      } else {
        startAutoSync(intervalMinutes);
        res.json({ success: true, message: `เริ่ม auto-sync ทุก ${intervalMinutes} นาที` });
      }
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}
