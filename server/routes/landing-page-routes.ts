import type { Express, Request, Response } from "express";
import { db } from "../db";
import { eq, count, sql } from "drizzle-orm";
import { companies, accounts, contracts, expenses, invoices, notifications, promotions, quotations, receipts, products, employees, contacts, tenants, users } from "@shared/schema";
import { requireAuth } from "../route-middleware";
import { deleteCompaniesCascade } from "../route-helpers";
import multer from "multer";
import path from "path";
import fs from "fs";
import { makeStorageFilename } from "../utils/safe-filename";

export function registerLandingPageRoutes(app: Express) {
// ============ Landing Page Content Management ============

app.get("/api/landing-content", async (_req, res) => {
  try {
    const sections = await db.select().from(landingContent).where(eq(landingContent.active, true)).orderBy(landingContent.sortOrder);
    res.json(sections);
  } catch (err: any) { res.json([]); }
});

app.get("/api/landing-content/all", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    if (user.role !== "super_admin" && user.role !== "admin") return res.status(403).json({ message: "ไม่มีสิทธิ์" });
    const sections = await db.select().from(landingContent).orderBy(landingContent.sortOrder);
    res.json(sections);
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

app.put("/api/landing-content/:id", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    if (user.role !== "super_admin" && user.role !== "admin") return res.status(403).json({ message: "ไม่มีสิทธิ์" });
    const id = Number(req.params.id);
    const { title, subtitle, items, active, sortOrder } = req.body;
    const updateData: any = { updatedAt: new Date(), updatedBy: user.id };
    if (title !== undefined) updateData.title = title;
    if (subtitle !== undefined) updateData.subtitle = subtitle;
    if (items !== undefined) updateData.items = items;
    if (active !== undefined) updateData.active = active;
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
    const [updated] = await db.update(landingContent).set(updateData).where(eq(landingContent.id, id)).returning();
    if (!updated) return res.status(404).json({ message: "ไม่พบส่วนนี้" });
    res.json(updated);
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

app.post("/api/landing-content", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    if (user.role !== "super_admin" && user.role !== "admin") return res.status(403).json({ message: "ไม่มีสิทธิ์" });
    const { sectionType, title, subtitle, items, sortOrder, active } = req.body;
    const [created] = await db.insert(landingContent).values({
      sectionType, title, subtitle, items: items || [], sortOrder: sortOrder || 0, active: active !== false, updatedBy: user.id,
    }).returning();
    res.status(201).json(created);
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

app.delete("/api/landing-content/:id", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    if (user.role !== "super_admin" && user.role !== "admin") return res.status(403).json({ message: "ไม่มีสิทธิ์" });
    const id = Number(req.params.id);
    const [deleted] = await db.delete(landingContent).where(eq(landingContent.id, id)).returning();
    if (!deleted) return res.status(404).json({ message: "ไม่พบ" });
    res.json({ success: true });
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

const uploadLandingImage = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (_req, file, cb) => {
  if (file.mimetype.startsWith("image/")) cb(null, true);
  else cb(new Error("อนุญาตเฉพาะไฟล์รูปภาพ"));
}});
app.post("/api/landing-content/upload-image", requireAuth, uploadLandingImage.single("file"), async (req, res) => {
  try {
    const user = req.user as any;
    if (user.role !== "super_admin" && user.role !== "admin") return res.status(403).json({ message: "ไม่มีสิทธิ์" });
    const file = req.file;
    if (!file) return res.status(400).json({ message: "ไม่พบไฟล์" });
    const { safeFilename } = makeStorageFilename(file.originalname);
    const key = `public/landing/${safeFilename}`;
    try {
      const { Client } = await import("@replit/object-storage");
      const client = new Client({ bucketId: process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID });
      await client.uploadFromBytes(key, file.buffer);
      res.json({ url: `/objects/${key}` });
    } catch {
      const uploadDir = path.join(process.cwd(), "uploads", "landing");
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
      fs.writeFileSync(path.join(uploadDir, safeFilename), file.buffer);
      res.json({ url: `/uploads/landing/${safeFilename}` });
    }
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});


// ═══════════════════════════════════════════════════════
// Cleanup orphan companies (available on all environments)
// ═══════════════════════════════════════════════════════
app.get("/api/platform/orphan-companies-count", async (req, res) => {
  const key = req.query.key as string;
  const syncKey = process.env.SYNC_API_KEY;
  if (!syncKey || key !== syncKey) {
    return res.status(403).json({ message: "Invalid sync key" });
  }
  try {
    const orphanResult = await db.execute(sql.raw(
      `SELECT count(*) as cnt FROM companies c WHERE NOT EXISTS (SELECT 1 FROM firm_clients fc WHERE fc.company_id = c.id)`
    ));
    const totalResult = await db.execute(sql.raw(`SELECT count(*) as cnt FROM companies`));
    const orphanCount = Number((orphanResult as any).rows?.[0]?.cnt || 0);
    const totalCount = Number((totalResult as any).rows?.[0]?.cnt || 0);
    res.json({ orphanCount, totalCount, linkedCount: totalCount - orphanCount });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/platform/cleanup-orphan-companies", async (req, res) => {
  const key = req.query.key as string || req.body?.key as string;
  const syncKey = process.env.SYNC_API_KEY;
  if (!syncKey || key !== syncKey) {
    return res.status(403).json({ message: "Invalid sync key" });
  }
  try {
    const orphanResult = await db.execute(sql.raw(
      `SELECT c.id FROM companies c WHERE NOT EXISTS (SELECT 1 FROM firm_clients fc WHERE fc.company_id = c.id)`
    ));
    const orphanIds = ((orphanResult as any).rows || orphanResult || []).map((r: any) => Number(r.id));

    if (orphanIds.length === 0) {
      return res.json({ message: "ไม่มี orphan companies", deleted: 0 });
    }

    const cascadeResult = await deleteCompaniesCascade(orphanIds);

    res.json({ message: `ลบ orphan companies สำเร็จ`, deleted: cascadeResult.deleted, remaining: 0, errors: cascadeResult.errors });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});


// ═══════════════════════════════════════════════════════
// Sync Export API (available on all environments)
// ═══════════════════════════════════════════════════════
const SYNCABLE_TABLES = [
  "tenants", "users", "companies", "contacts", "firm_clients", "branches",
  "employees", "attendance_records", "leave_requests", "ot_records",
  "payroll_records", "journal_entries", "journal_lines",
  "accounts", "accounting_formulas", "accounting_formula_lines",
  "payment_methods", "products", "work_schedules", "work_locations",
  "ot_settings", "holidays", "departments", "general_settings",
  "document_settings", "vat_product_dictionary",
  "ecommerce_connections", "ecommerce_orders", "subscription_plans",
];

app.get("/api/platform/sync-export", async (req, res) => {
  const key = req.query.key as string;
  const syncKey = process.env.SYNC_API_KEY;
  if (!syncKey || key !== syncKey) {
    return res.status(403).json({ message: "Invalid sync key" });
  }
  const tableName = req.query.table as string;
  if (!tableName || !SYNCABLE_TABLES.includes(tableName)) {
    return res.status(400).json({ message: "Invalid table", allowed: SYNCABLE_TABLES });
  }
  const afterId = parseInt(req.query.after_id as string) || 0;
  const limit = Math.min(parseInt(req.query.limit as string) || 5000, 10000);
  try {
    const result = await db.execute(sql.raw(
      `SELECT * FROM "${tableName}" WHERE id > ${afterId} ORDER BY id ASC LIMIT ${limit}`
    ));
    const rows = (result as any).rows || result;
    const countResult = await db.execute(sql.raw(`SELECT COUNT(*) as total FROM "${tableName}"`));
    const total = Number((countResult as any).rows?.[0]?.total || (countResult as any)[0]?.total || 0);
    res.json({ table: tableName, afterId, total, fetched: rows.length, rows });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/platform/sync-tables", async (req, res) => {
  const key = req.query.key as string;
  const syncKey = process.env.SYNC_API_KEY;
  if (!syncKey || key !== syncKey) {
    return res.status(403).json({ message: "Invalid sync key" });
  }
  try {
    const counts: Record<string, { count: number; maxId: number }> = {};
    for (const t of SYNCABLE_TABLES) {
      try {
        const r = await db.execute(sql.raw(`SELECT COUNT(*) as cnt, COALESCE(MAX(id), 0) as max_id FROM "${t}"`));
        const row = (r as any).rows?.[0] || (r as any)[0];
        counts[t] = { count: Number(row?.cnt || 0), maxId: Number(row?.max_id || 0) };
      } catch {
        counts[t] = { count: -1, maxId: -1 };
      }
    }
    res.json({ tables: counts });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/platform/sync-object", async (req, res) => {
  const key = req.query.key as string;
  const syncKey = process.env.SYNC_API_KEY;
  if (!syncKey || key !== syncKey) return res.status(403).json({ message: "Invalid sync key" });
  const objPath = req.query.path as string;
  if (!objPath || objPath.includes("..")) return res.status(400).json({ message: "Invalid path" });
  try {
    const { getLocalFilePath } = await import("./replit_integrations/object_storage/routes");
    const fileId = objPath.replace(/.*\//, "");
    const localPath = getLocalFilePath(fileId);
    if (!localPath) return res.status(404).json({ message: "Not found" });
    res.setHeader("Content-Type", "application/octet-stream");
    const fss = await import("fs");
    fss.createReadStream(localPath).pipe(res);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

}
