import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { requireAuth } from "../route-middleware";
import multer from "multer";
import { decodeMulterFilename } from "../utils/safe-filename";

export function registerWhiteLabelRoutes(app: Express) {
// ==================== WHITE LABEL ====================

app.get("/api/white-label/settings", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const settings = await storage.getWhiteLabelSettings(user.tenantId);
    res.json(settings || null);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.put("/api/white-label/settings", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    if (user.role !== "admin" && user.role !== "owner") {
      return res.status(403).json({ message: "เฉพาะผู้ดูแลระบบเท่านั้น" });
    }
    const { subdomain, brandName, logoUrl, faviconUrl, primaryColor, secondaryColor, accentColor, loginBgColor, sidebarColor, footerText, supportEmail, supportPhone, active } = req.body;
    if (subdomain) {
      const subdomainRegex = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/;
      if (!subdomainRegex.test(subdomain)) {
        return res.status(400).json({ message: "Subdomain ต้องเป็นตัวอักษรภาษาอังกฤษพิมพ์เล็ก ตัวเลข หรือขีด (-) เท่านั้น (3-50 ตัวอักษร)" });
      }
      const available = await storage.checkSubdomainAvailable(subdomain, user.tenantId);
      if (!available) {
        return res.status(400).json({ message: "Subdomain นี้ถูกใช้แล้ว กรุณาเลือกชื่ออื่น" });
      }
    }
    const settings = await storage.upsertWhiteLabelSettings(user.tenantId, {
      subdomain: subdomain || null,
      brandName: brandName || null,
      logoUrl: logoUrl || null,
      faviconUrl: faviconUrl || null,
      primaryColor: primaryColor || "#fb9678",
      secondaryColor: secondaryColor || "#03c9d7",
      accentColor: accentColor || "#fec90f",
      loginBgColor: loginBgColor || "#fff5f0",
      sidebarColor: sidebarColor || "#ffffff",
      footerText: footerText || null,
      supportEmail: supportEmail || null,
      supportPhone: supportPhone || null,
      active: active ?? false,
    });
    res.json(settings);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/white-label/check-subdomain", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const subdomain = String(req.query.subdomain || "").toLowerCase().trim();
    if (!subdomain) return res.json({ available: false });
    const subdomainRegex = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/;
    if (!subdomainRegex.test(subdomain)) return res.json({ available: false, reason: "รูปแบบไม่ถูกต้อง" });
    const available = await storage.checkSubdomainAvailable(subdomain, user.tenantId);
    res.json({ available });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

const uploadLogo = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 }, fileFilter: (_req, file, cb) => {
  if (file.mimetype.startsWith("image/")) cb(null, true);
  else cb(new Error("รองรับเฉพาะไฟล์รูปภาพ"));
}});

app.post("/api/white-label/upload-logo", requireAuth, uploadLogo.single("logo"), async (req: any, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "กรุณาเลือกไฟล์รูปภาพ" });
    const { saveBufferLocally } = await import("../replit_integrations/object_storage/routes");
    const { objectPath } = saveBufferLocally(req.file.buffer, req.file.mimetype || "image/png", req.file.originalname);
    res.json({ url: objectPath, fileName: decodeMulterFilename(req.file.originalname) });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

}
