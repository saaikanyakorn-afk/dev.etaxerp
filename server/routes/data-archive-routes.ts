import type { Express, Request, Response } from "express";
import { db } from "../db";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../route-middleware";

export function registerDataArchiveRoutes(app: Express) {
// ===== Data Archive API =====
app.post("/api/archive/preview", requireAuth, async (req, res) => {
  try {
    const { companyId, archiveType, cutoffDate } = req.body;
    if (!companyId || !archiveType || !cutoffDate) {
      return res.status(400).json({ message: "companyId, archiveType, cutoffDate required" });
    }
    const { getArchivePreview } = await import("./data-archive");
    const preview = await getArchivePreview(companyId, archiveType, cutoffDate);
    res.json(preview);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post("/api/archive/execute", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    if (user.role !== "super_admin" && user.role !== "admin") {
      return res.status(403).json({ message: "Only admins can archive data" });
    }
    const { companyId, archiveType, cutoffDate } = req.body;
    if (!companyId || !archiveType || !cutoffDate) {
      return res.status(400).json({ message: "companyId, archiveType, cutoffDate required" });
    }
    const { archiveEcommerceOrdersForCompany, archiveJournalEntriesForCompany } = await import("./data-archive");
    let result;
    if (archiveType === "ecommerce_orders") {
      result = await archiveEcommerceOrdersForCompany(companyId, cutoffDate, user.id);
    } else if (archiveType === "journal_entries") {
      result = await archiveJournalEntriesForCompany(companyId, cutoffDate, user.id);
    } else {
      return res.status(400).json({ message: "archiveType must be 'ecommerce_orders' or 'journal_entries'" });
    }
    res.json(result);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.get("/api/archive/history", requireAuth, async (req, res) => {
  try {
    const companyId = Number(req.query.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId required" });
    const { getArchiveHistory } = await import("./data-archive");
    const history = await getArchiveHistory(companyId);
    res.json(history);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.get("/api/archive/ecommerce-orders", requireAuth, async (req, res) => {
  try {
    const companyId = Number(req.query.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId required" });
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = (page - 1) * limit;
    const orders = await db.select().from(archiveEcommerceOrders)
      .where(eq(archiveEcommerceOrders.companyId, companyId))
      .orderBy(desc(archiveEcommerceOrders.archivedAt))
      .limit(limit)
      .offset(offset);
    res.json(orders);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.get("/api/archive/journal-entries", requireAuth, async (req, res) => {
  try {
    const companyId = Number(req.query.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId required" });
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = (page - 1) * limit;
    const entries = await db.select().from(archiveJournalEntries)
      .where(eq(archiveJournalEntries.companyId, companyId))
      .orderBy(desc(archiveJournalEntries.archivedAt))
      .limit(limit)
      .offset(offset);
    res.json(entries);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});


}
