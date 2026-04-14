import type { Express } from "express";
import { db } from "../db";
import { eq, and, desc, or, isNull } from "drizzle-orm";
import { pdfImportTemplates } from "@shared/schema";
import { requireAuth, requireModule } from "../route-middleware";
import multer from "multer";

const pdfUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

export function registerPdfTemplateRoutes(app: Express) {
  app.get("/api/pdf-import-templates", requireAuth, requireModule("purchases"), async (req, res) => {
    try {
      const user = req.user as any;
      const companyId = user.activeCompanyId || user.companyId;
      const rows = await db.select().from(pdfImportTemplates)
        .where(or(isNull(pdfImportTemplates.companyId), eq(pdfImportTemplates.companyId, companyId)))
        .orderBy(desc(pdfImportTemplates.priority), desc(pdfImportTemplates.createdAt));
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/pdf-import-templates/:id", requireAuth, requireModule("purchases"), async (req, res) => {
    try {
      const [row] = await db.select().from(pdfImportTemplates).where(eq(pdfImportTemplates.id, Number(req.params.id)));
      if (!row) return res.status(404).json({ message: "ไม่พบ Template" });
      res.json(row);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/pdf-import-templates", requireAuth, requireModule("purchases"), async (req, res) => {
    try {
      const user = req.user as any;
      const { name, description, detectKeywords, fieldRules, dateFormat, defaultVatType, active, priority } = req.body;
      if (!name || !detectKeywords || !fieldRules) return res.status(400).json({ message: "กรุณาระบุชื่อ, คำค้นหา, และกฎ" });

      const [row] = await db.insert(pdfImportTemplates).values({
        companyId: user.activeCompanyId || user.companyId || null,
        name,
        description: description || null,
        detectKeywords: Array.isArray(detectKeywords) ? detectKeywords : [detectKeywords],
        fieldRules,
        dateFormat: dateFormat || "DD/MM/YYYY",
        defaultVatType: defaultVatType || "vat7",
        active: active !== false,
        priority: priority || 0,
        isBuiltIn: false,
        createdBy: user.id,
      }).returning();
      res.json(row);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/pdf-import-templates/:id", requireAuth, requireModule("purchases"), async (req, res) => {
    try {
      const user = req.user as any;
      const id = Number(req.params.id);
      const { name, description, detectKeywords, fieldRules, dateFormat, defaultVatType, active, priority } = req.body;

      const updates: any = { updatedBy: user.id, updatedAt: new Date() };
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (detectKeywords !== undefined) updates.detectKeywords = Array.isArray(detectKeywords) ? detectKeywords : [detectKeywords];
      if (fieldRules !== undefined) updates.fieldRules = fieldRules;
      if (dateFormat !== undefined) updates.dateFormat = dateFormat;
      if (defaultVatType !== undefined) updates.defaultVatType = defaultVatType;
      if (active !== undefined) updates.active = active;
      if (priority !== undefined) updates.priority = priority;

      const [row] = await db.update(pdfImportTemplates).set(updates).where(eq(pdfImportTemplates.id, id)).returning();
      if (!row) return res.status(404).json({ message: "ไม่พบ Template" });
      res.json(row);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/pdf-import-templates/:id", requireAuth, requireModule("purchases"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const [row] = await db.select().from(pdfImportTemplates).where(eq(pdfImportTemplates.id, id));
      if (!row) return res.status(404).json({ message: "ไม่พบ Template" });
      if (row.isBuiltIn) return res.status(400).json({ message: "ไม่สามารถลบ Template ในตัวระบบได้ (ปิดใช้งานแทน)" });

      await db.delete(pdfImportTemplates).where(eq(pdfImportTemplates.id, id));
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/pdf-import-templates/:id/test", requireAuth, requireModule("purchases"), pdfUpload.single("file"), async (req, res) => {
    try {
      const file = req.file;
      if (!file) return res.status(400).json({ message: "กรุณาอัปโหลดไฟล์ PDF" });

      const id = Number(req.params.id);
      const [tpl] = await db.select().from(pdfImportTemplates).where(eq(pdfImportTemplates.id, id));
      if (!tpl) return res.status(404).json({ message: "ไม่พบ Template" });

      const { extractPdfFullText } = await import("../utils/pdf-invoice-parser");
      const { matchTemplate, applyTemplate } = await import("../utils/pdf-template-engine");
      const fullText = await extractPdfFullText(file.buffer);

      const templateConfig = {
        id: tpl.id,
        name: tpl.name,
        detectKeywords: tpl.detectKeywords,
        fieldRules: tpl.fieldRules as any,
        dateFormat: tpl.dateFormat || "DD/MM/YYYY",
        defaultVatType: tpl.defaultVatType || "vat7",
        priority: tpl.priority || 0,
      };

      const matched = matchTemplate(fullText, [templateConfig]);
      if (!matched) {
        return res.json({
          matched: false,
          message: "PDF ไม่ตรงกับคำค้นหา (Detect Keywords) ของ Template นี้",
          rawText: fullText.substring(0, 5000),
          result: null,
        });
      }

      const result = applyTemplate(fullText, templateConfig);
      res.json({
        matched: true,
        message: "จับคู่สำเร็จ",
        rawText: fullText.substring(0, 5000),
        result,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/pdf-import-templates/extract-text", requireAuth, requireModule("purchases"), pdfUpload.single("file"), async (req, res) => {
    try {
      const file = req.file;
      if (!file) return res.status(400).json({ message: "กรุณาอัปโหลดไฟล์ PDF" });
      const { extractPdfFullText } = await import("../utils/pdf-invoice-parser");
      const fullText = await extractPdfFullText(file.buffer);
      res.json({ rawText: fullText });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}
