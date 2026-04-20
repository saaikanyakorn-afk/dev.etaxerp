import type { Express, Request, Response } from "express";
import { db } from "../db";
import { storage } from "../storage";
import { eq } from "drizzle-orm";
import { generalSettings, documentSettings } from "@shared/schema";
import { requireAuth, requireAdmin, requireRole } from "../route-middleware";
import { z } from "zod";

export function registerDocSettingsRoutes(app: Express) {
// ========== Document Settings Routes ==========

app.get("/api/settings/general", requireAuth, async (req, res) => {
  try {
    const companyId = Number(req.query.companyId);
    if (!companyId) return res.status(400).json({ message: "กรุณาระบุ companyId" });
    const [row] = await db.select().from(generalSettings).where(eq(generalSettings.companyId, companyId)).limit(1);
    if (!row) {
      return res.json({
        dateFormat: "DD/MM/YYYY", calendarType: "buddhist", language: "th",
        timezone: "Asia/Bangkok", notifyOnDocApproval: true, notifyOnOverdue: true,
        autoLogoutMinutes: "60", defaultPageSize: "50", showDecimalPlaces: "2",
      });
    }
    const { id, companyId: _cid, ...settings } = row;
    return res.json(settings);
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

app.put("/api/settings/general", requireAuth, async (req, res) => {
  try {
    const companyId = Number(req.query.companyId);
    if (!companyId) return res.status(400).json({ message: "กรุณาระบุ companyId" });
    const { dateFormat, calendarType, language, timezone, notifyOnDocApproval, notifyOnOverdue, autoLogoutMinutes, defaultPageSize, showDecimalPlaces, hiddenEmployeeModules, authorizedSignerName, authorizedSignerTitle, authorizedSignerSignatureUrl } = req.body;
    const data: any = { companyId, dateFormat, calendarType, language, timezone, notifyOnDocApproval, notifyOnOverdue, autoLogoutMinutes, defaultPageSize, showDecimalPlaces };
    if (hiddenEmployeeModules !== undefined) data.hiddenEmployeeModules = hiddenEmployeeModules;
    if (authorizedSignerName !== undefined) data.authorizedSignerName = authorizedSignerName;
    if (authorizedSignerTitle !== undefined) data.authorizedSignerTitle = authorizedSignerTitle;
    if (authorizedSignerSignatureUrl !== undefined) data.authorizedSignerSignatureUrl = authorizedSignerSignatureUrl;
    const [existing] = await db.select().from(generalSettings).where(eq(generalSettings.companyId, companyId)).limit(1);
    if (existing) {
      const { companyId: _cid, ...updateData } = data;
      await db.update(generalSettings).set(updateData).where(eq(generalSettings.companyId, companyId));
    } else {
      await db.insert(generalSettings).values(data);
    }

    return res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

app.get("/api/document-settings", requireAuth, async (req, res) => {
  try {
    const companyId = Number(req.query.companyId);
    if (!companyId) return res.status(400).json({ message: "กรุณาระบุ companyId" });
    const user = req.user as any;
    const company = await storage.getCompany(companyId);
    const canAccess = company && (user.role === "super_admin" || company.tenantId === user.tenantId || company.isPrimary);
    if (!canAccess) {
      return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึงบริษัทนี้" });
    }
    const settings = await storage.getDocumentSettings(companyId);
    const result = settings || {
      companyId,
      showLogo: true,
      showSignature: true,
      showTaxId: true,
      showBranch: true,
      dateFormat: "DD/MM/YYYY",
      dateEra: "CE",
    };
    if (!result.logoUrl && company?.tenantId) {
      try {
        const [wl] = await db.select({ logoUrl: whiteLabelSettings.logoUrl }).from(whiteLabelSettings).where(eq(whiteLabelSettings.tenantId, company.tenantId));
        if (wl?.logoUrl) {
          (result as any).logoUrl = wl.logoUrl;
          (result as any).logoSource = "whitelabel";
        }
      } catch {}
    }
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

app.get("/api/document-settings/:companyId", requireAuth, async (req, res) => {
  try {
    const companyId = Number(req.params.companyId);
    const user = req.user as any;
    const company = await storage.getCompany(companyId);
    const canAccess = company && (user.role === "super_admin" || company.tenantId === user.tenantId || company.isPrimary);
    if (!canAccess) {
      return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึงบริษัทนี้" });
    }
    const settings = await storage.getDocumentSettings(companyId);
    const result = settings || {
      companyId,
      showLogo: true,
      showSignature: true,
      showTaxId: true,
      showBranch: true,
      paperSize: "A4",
      docTypeColors: null,
      colorMode: "color",
      docNumberFormat: "YMD_SEQ",
      docNumberDigits: 4,
      dateEra: "CE",
      dateFormat: "DD/MM/YYYY",
    };
    if (!result.logoUrl && company?.tenantId) {
      try {
        const [wl] = await db.select({ logoUrl: whiteLabelSettings.logoUrl }).from(whiteLabelSettings).where(eq(whiteLabelSettings.tenantId, company.tenantId));
        if (wl?.logoUrl) {
          (result as any).logoUrl = wl.logoUrl;
          (result as any).logoSource = "whitelabel";
        }
      } catch {}
    }
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

app.put("/api/document-settings/:companyId", requireAuth, requireRole("admin", "super_admin", "manager"), async (req, res) => {
  try {
    const companyId = Number(req.params.companyId);
    const user = req.user as any;
    const company = await storage.getCompany(companyId);
    const canAccess = company && (user.role === "super_admin" || company.tenantId === user.tenantId || company.isPrimary);
    if (!canAccess) {
      return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึงบริษัทนี้" });
    }
    const docSettingsSchema = z.object({
      logoUrl: z.string().nullable().optional(),
      showLogo: z.boolean().optional(),
      showSignature: z.boolean().optional(),
      showTaxId: z.boolean().optional(),
      showBranch: z.boolean().optional(),
      showProductCode: z.boolean().optional(),
      headerNote: z.string().nullable().optional(),
      headerNoteEn: z.string().nullable().optional(),
      headerNoteZh: z.string().nullable().optional(),
      footerNote: z.string().nullable().optional(),
      footerNoteEn: z.string().nullable().optional(),
      footerNoteZh: z.string().nullable().optional(),
      paperSize: z.string().optional(),
      bankAccountName: z.string().nullable().optional(),
      bankAccountNameEn: z.string().nullable().optional(),
      bankAccountNameZh: z.string().nullable().optional(),
      bankAccountNumber: z.string().nullable().optional(),
      bankName: z.string().nullable().optional(),
      bankNameEn: z.string().nullable().optional(),
      bankNameZh: z.string().nullable().optional(),
      qrCodeUrl: z.string().nullable().optional(),
      promptpayId: z.string().nullable().optional(),
      promptpayType: z.string().nullable().optional(),
      promptpayEnabled: z.boolean().optional(),
      docTypeColors: z.string().nullable().optional(),
      colorMode: z.string().optional(),
      docNumberFormat: z.string().optional(),
      docNumberDigits: z.number().int().min(3).max(7).optional(),
      dateEra: z.string().optional(),
      dateFormat: z.string().optional(),
      documentLanguage: z.string().optional(),
      docPrefixes: z.string().nullable().optional(),
      certSignerName: z.string().nullable().optional(),
      certSignerPosition: z.string().nullable().optional(),
      docFontSize: z.string().optional(),
      showQrOnDoc: z.boolean().optional(),
      posReceiptWidth: z.string().optional(),
      posReceiptShowLogo: z.boolean().optional(),
      posReceiptShowCompanyInfo: z.boolean().optional(),
      posReceiptShowQr: z.boolean().optional(),
      posReceiptHeaderText: z.string().nullable().optional(),
      posReceiptFooterText: z.string().nullable().optional(),
      posReceiptAutoPrint: z.boolean().optional(),
      posReceiptFontSize: z.string().optional(),
      posReceiptPrefix: z.string().optional(),
      ecReceiptFontSize: z.string().optional(),
      ecReceiptShowCompanyInfo: z.boolean().optional(),
      ecReceiptShowQr: z.boolean().optional(),
      ecReceiptShowLogo: z.boolean().optional(),
      ecReceiptHeaderText: z.string().nullable().optional(),
      ecReceiptFooterText: z.string().nullable().optional(),
    });
    const validated = docSettingsSchema.parse(req.body);
    const settings = await storage.upsertDocumentSettings(companyId, validated);
    res.json(settings);
  } catch (err: any) {
    if (err.name === "ZodError") {
      return res.status(400).json({ message: "ข้อมูลไม่ถูกต้อง", errors: err.errors });
    }
    res.status(400).json({ message: err.message });
  }
});

}
