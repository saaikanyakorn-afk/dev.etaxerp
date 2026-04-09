import type { Express, Request, Response } from "express";
import { db } from "../db";
import { eq, and } from "drizzle-orm";
import { customFormTemplates } from "@shared/schema";
import { requireAuth, requireAdmin, requireRole } from "../route-middleware";
import { z } from "zod";

const formFieldSchema = z.object({
  key: z.string(),
  label: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  fontSize: z.number(),
  fontWeight: z.string().optional(),
  align: z.enum(["left", "center", "right"]).optional(),
  maxChars: z.number().optional(),
});

const itemColumnSchema = z.object({
  key: z.string(),
  label: z.string(),
  x: z.number(),
  width: z.number(),
  fontSize: z.number(),
  align: z.enum(["left", "center", "right"]),
});

const itemsTableSchema = z.object({
  startY: z.number(),
  rowHeight: z.number(),
  maxRows: z.number().int().min(1).max(100),
  columns: z.array(itemColumnSchema),
}).nullable().optional();

const totalFieldSchema = z.object({
  key: z.string(),
  label: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  fontSize: z.number(),
  align: z.enum(["left", "center", "right"]).optional(),
});

const createSchema = z.object({
  companyId: z.number().int().positive(),
  name: z.string().min(1).max(200),
  docType: z.string().min(1).max(10),
  paperSize: z.enum(["A4", "A5", "Letter"]).default("A4"),
  orientation: z.enum(["portrait", "landscape"]).default("portrait"),
  backgroundImageUrl: z.string().nullable().optional(),
  fields: z.union([z.string(), z.array(formFieldSchema)]).default("[]"),
  itemsTable: z.union([z.string(), itemsTableSchema]).nullable().optional(),
  totals: z.union([z.string(), z.array(totalFieldSchema)]).nullable().optional(),
  isDefault: z.boolean().default(false),
});

const updateSchema = createSchema.partial().omit({ companyId: true });

async function verifyOwnership(templateId: number, req: Request): Promise<{ row: any; ok: boolean }> {
  const [row] = await db.select().from(customFormTemplates)
    .where(eq(customFormTemplates.id, templateId)).limit(1);
  if (!row) return { row: null, ok: false };
  const user = (req as any).user;
  if (!user) return { row, ok: false };
  if (user.role === "super_admin") return { row, ok: true };
  const userCompanyIds: number[] = (req as any).userCompanyIds || [];
  if (userCompanyIds.includes(row.companyId)) return { row, ok: true };
  if (user.companyId === row.companyId) return { row, ok: true };
  return { row, ok: false };
}

export function registerCustomFormRoutes(app: Express) {

  app.get("/api/custom-form-templates", requireAuth, async (req: Request, res: Response) => {
    try {
      const companyId = Number(req.query.companyId);
      if (!companyId) return res.status(400).json({ message: "กรุณาระบุ companyId" });
      const rows = await db.select().from(customFormTemplates)
        .where(eq(customFormTemplates.companyId, companyId))
        .orderBy(customFormTemplates.name);
      return res.json(rows);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/custom-form-templates/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      const { row, ok } = await verifyOwnership(id, req);
      if (!row) return res.status(404).json({ message: "ไม่พบเทมเพลต" });
      if (!ok) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึงเทมเพลตนี้" });
      return res.json(row);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/custom-form-templates", requireAuth, requireRole("admin", "super_admin", "manager"), async (req: Request, res: Response) => {
    try {
      const parsed = createSchema.parse(req.body);
      if (parsed.isDefault) {
        await db.update(customFormTemplates)
          .set({ isDefault: false })
          .where(and(
            eq(customFormTemplates.companyId, parsed.companyId),
            eq(customFormTemplates.docType, parsed.docType)
          ));
      }
      const fields = typeof parsed.fields === "string" ? parsed.fields : JSON.stringify(parsed.fields);
      const itemsTable = parsed.itemsTable ? (typeof parsed.itemsTable === "string" ? parsed.itemsTable : JSON.stringify(parsed.itemsTable)) : null;
      const totals = parsed.totals ? (typeof parsed.totals === "string" ? parsed.totals : JSON.stringify(parsed.totals)) : null;

      const [created] = await db.insert(customFormTemplates).values({
        companyId: parsed.companyId,
        name: parsed.name,
        docType: parsed.docType,
        paperSize: parsed.paperSize,
        orientation: parsed.orientation,
        backgroundImageUrl: parsed.backgroundImageUrl || null,
        fields,
        itemsTable,
        totals,
        isDefault: parsed.isDefault,
      }).returning();
      return res.json(created);
    } catch (e: any) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: "ข้อมูลไม่ถูกต้อง", errors: e.errors });
      }
      res.status(500).json({ message: e.message });
    }
  });

  app.put("/api/custom-form-templates/:id", requireAuth, requireRole("admin", "super_admin", "manager"), async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      const { row, ok } = await verifyOwnership(id, req);
      if (!row) return res.status(404).json({ message: "ไม่พบเทมเพลต" });
      if (!ok) return res.status(403).json({ message: "ไม่มีสิทธิ์แก้ไขเทมเพลตนี้" });

      const parsed = updateSchema.parse(req.body);
      if (parsed.isDefault && parsed.docType) {
        await db.update(customFormTemplates)
          .set({ isDefault: false })
          .where(and(
            eq(customFormTemplates.companyId, row.companyId),
            eq(customFormTemplates.docType, parsed.docType)
          ));
      }
      const updateData: any = { updatedAt: new Date() };
      if (parsed.name !== undefined) updateData.name = parsed.name;
      if (parsed.docType !== undefined) updateData.docType = parsed.docType;
      if (parsed.paperSize !== undefined) updateData.paperSize = parsed.paperSize;
      if (parsed.orientation !== undefined) updateData.orientation = parsed.orientation;
      if (parsed.backgroundImageUrl !== undefined) updateData.backgroundImageUrl = parsed.backgroundImageUrl;
      if (parsed.fields !== undefined) updateData.fields = typeof parsed.fields === "string" ? parsed.fields : JSON.stringify(parsed.fields);
      if (parsed.itemsTable !== undefined) updateData.itemsTable = parsed.itemsTable ? (typeof parsed.itemsTable === "string" ? parsed.itemsTable : JSON.stringify(parsed.itemsTable)) : null;
      if (parsed.totals !== undefined) updateData.totals = parsed.totals ? (typeof parsed.totals === "string" ? parsed.totals : JSON.stringify(parsed.totals)) : null;
      if (parsed.isDefault !== undefined) updateData.isDefault = parsed.isDefault;

      const [updated] = await db.update(customFormTemplates)
        .set(updateData)
        .where(eq(customFormTemplates.id, id))
        .returning();
      return res.json(updated);
    } catch (e: any) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: "ข้อมูลไม่ถูกต้อง", errors: e.errors });
      }
      res.status(500).json({ message: e.message });
    }
  });

  app.delete("/api/custom-form-templates/:id", requireAuth, requireRole("admin", "super_admin", "manager"), async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      const { row, ok } = await verifyOwnership(id, req);
      if (!row) return res.status(404).json({ message: "ไม่พบเทมเพลต" });
      if (!ok) return res.status(403).json({ message: "ไม่มีสิทธิ์ลบเทมเพลตนี้" });

      await db.delete(customFormTemplates).where(eq(customFormTemplates.id, id));
      return res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

}
