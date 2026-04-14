import type { Express } from "express";
import { db } from "../db";
import { eq, and, desc, or, isNull } from "drizzle-orm";
import { pdfImportTemplates } from "@shared/schema";
import { requireAuth, requireModule } from "../route-middleware";
import multer from "multer";

const pdfUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

export async function seedDefaultPdfTemplates() {
  try {
    const existing = await db.select({ id: pdfImportTemplates.id }).from(pdfImportTemplates)
      .where(eq(pdfImportTemplates.isBuiltIn, true));
    if (existing.length > 0) return;

    const shopeeTemplate = {
      companyId: null as number | null,
      name: "Shopee / SPX Express Invoice",
      description: "ใบแจ้งค่าบริการ Shopee และ SPX Express (Thailand)",
      detectKeywords: ["Shopee", "Seller ID"],
      fieldRules: {
        invoiceNo: { keyword: "เลขที่/No.", extractionType: "afterKeyword", pattern: "([A-Z0-9\\-]{10,})" },
        date: { keyword: "วันที่/Date", extractionType: "afterKeyword", pattern: "(\\d{1,2}/\\d{1,2}/\\d{4})" },
        vendorName: { keyword: "Shopee|SPX Express", extractionType: "afterKeyword", pattern: "((?:Shopee|SPX\\s*Express)\\s*\\(Thailand\\)\\s*Co\\.?,?\\s*Ltd\\.?)" },
        vendorTaxId: { keyword: "Tax ID No", extractionType: "afterKeyword", pattern: "(\\d{13})" },
        subtotal: { keyword: "มูลค่าก่อนภาษี|Total Value.*Excluded VAT", extractionType: "lastNumberOnLine" },
        vatAmount: { keyword: "ภาษีมูลค่าเพิ่ม 7%|VAT 7%", extractionType: "lastNumberOnLine" },
        totalAmount: { keyword: "มูลค่าบริการรวมภาษี|Total Value.*Included VAT|จำนวนเงินรวม|Total amount", extractionType: "lastNumberOnLine" },
        withholdingTax: { keyword: "หักภาษีเงินได้ ณ ที่จ่าย|withholding tax", extractionType: "lastNumberOnLine" },
      },
      dateFormat: "DD/MM/YYYY",
      defaultVatType: "vat7",
      active: true,
      priority: 100,
      isBuiltIn: true,
      createdBy: null as number | null,
    };

    const tiktokTemplate = {
      companyId: null as number | null,
      name: "TikTok Creator Receipt",
      description: "ใบเสร็จค่าคอมมิชชั่น TikTok Creator",
      detectKeywords: ["Receipt Number", "Creator"],
      fieldRules: {
        invoiceNo: { keyword: "Receipt Number", extractionType: "afterKeyword", pattern: "([A-Za-z0-9]+)" },
        date: { keyword: "Receipt Date", extractionType: "afterKeyword" },
        vendorName: { keyword: "Client Name", extractionType: "afterKeyword" },
        vendorTaxId: { keyword: "Tax Number", extractionType: "afterKeyword", pattern: "(\\d{13})" },
        vendorAddress: { keyword: "Billing Address", extractionType: "afterKeyword" },
        totalAmount: { keyword: "total amount", extractionType: "lastNumberOnLine" },
        withholdingTax: { keyword: "personal income tax", extractionType: "lastNumberOnLine" },
      },
      dateFormat: "DD/MM/YYYY",
      defaultVatType: "non_vat",
      active: true,
      priority: 90,
      isBuiltIn: true,
      createdBy: null as number | null,
    };

    await db.insert(pdfImportTemplates).values([shopeeTemplate, tiktokTemplate]);
    console.log("[PDF Templates] Seeded 2 built-in templates (Shopee, TikTok)");
  } catch (err: any) {
    console.error("[PDF Templates] Seed error:", err.message);
  }
}

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

  app.post("/api/pdf-import-templates/seed-defaults", requireAuth, requireModule("purchases"), async (_req, res) => {
    try {
      await seedDefaultPdfTemplates();
      const rows = await db.select({ id: pdfImportTemplates.id, name: pdfImportTemplates.name }).from(pdfImportTemplates)
        .where(eq(pdfImportTemplates.isBuiltIn, true));
      res.json({ message: `Built-in templates: ${rows.length}`, templates: rows });
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
