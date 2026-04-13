import type { Express } from "express";
import { db } from "../db";
import { storage } from "../storage";
import { eq, and, desc, sql, count, sum, not } from "drizzle-orm";
import { fixedAssets, assetDepreciations, assetCategories, companies, journalEntries, journalLines, vatClosings, taxInvoices, invoices, purchaseInvoices, expenses, expenseItems } from "@shared/schema";
import { requireAuth, requireModule, checkDocOwnership } from "../route-middleware";
import { getNextJournalEntryNo } from "../route-helpers";
import { parsePagination, paginatedResponse } from "./pagination";
import * as XLSX from "xlsx";
import multer from "multer";
import path from "path";

export function registerFixedAssetsRoutes(app: Express) {
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
  // ============= FIXED ASSETS =============
  const DEFAULT_ASSET_CATEGORIES = [
    { accountCode: "1701000", name: "ที่ดิน", accumCode: null, depExpCode: null, usefulLifeMonths: 0, depreciationRate: "0", sortOrder: 1 },
    { accountCode: "1702000", name: "อาคาร", accumCode: "1712000", depExpCode: "5301500", usefulLifeMonths: 240, depreciationRate: "5", sortOrder: 2 },
    { accountCode: "1702100", name: "ส่วนต่อเติมอาคาร", accumCode: "1712100", depExpCode: "5301500", usefulLifeMonths: 240, depreciationRate: "5", sortOrder: 3 },
    { accountCode: "1702200", name: "ส่วนต่อเติมอาคารระหว่างทำ", accumCode: null, depExpCode: null, usefulLifeMonths: 0, depreciationRate: "0", sortOrder: 4 },
    { accountCode: "1707000", name: "เครื่องตกแต่งและติดตั้ง", accumCode: "1717000", depExpCode: "5301500", usefulLifeMonths: 60, depreciationRate: "20", sortOrder: 5 },
    { accountCode: "1704000", name: "อุปกรณ์สำนักงาน", accumCode: "1714000", depExpCode: "5301500", usefulLifeMonths: 60, depreciationRate: "20", sortOrder: 6 },
    { accountCode: "1706000", name: "ยานพาหนะ", accumCode: "1716000", depExpCode: "5301500", usefulLifeMonths: 60, depreciationRate: "20", sortOrder: 7 },
    { accountCode: "1705000", name: "อุปกรณ์คอมพิวเตอร์", accumCode: "1715000", depExpCode: "5301500", usefulLifeMonths: 36, depreciationRate: "33.33", sortOrder: 8 },
    { accountCode: "1801000", name: "สินทรัพย์ไม่มีตัวตน", accumCode: "1811000", depExpCode: "5311000", usefulLifeMonths: 60, depreciationRate: "20", sortOrder: 9 },
    { accountCode: "1703000", name: "งานระหว่างก่อสร้าง", accumCode: null, depExpCode: null, usefulLifeMonths: 0, depreciationRate: "0", sortOrder: 10 },
  ];

  const OLD_CODE_MAP: Record<string, string> = {
    "1401": "1701000", "1411": "1702000", "1421": "1702100", "1422": "1702200",
    "1431": "1707000", "1441": "1704000", "1451": "1706000", "1461": "1705000",
    "1501": "1801000", "1402": "1703000",
  };

  async function ensureDefaultCategories(companyId: number) {
    const existing = await db.select().from(assetCategories).where(eq(assetCategories.companyId, companyId));
    if (existing.length > 0) return existing;
    const rows = DEFAULT_ASSET_CATEGORIES.map(c => ({ ...c, companyId, isDefault: true }));
    return db.insert(assetCategories).values(rows).returning();
  }

  async function getCompanyCategories(companyId: number) {
    const cats = await ensureDefaultCategories(companyId);
    return cats.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  const findCategory = async (code: string, companyId: number) => {
    const mapped = OLD_CODE_MAP[code] || code;
    const cats = await getCompanyCategories(companyId);
    return cats.find(c => c.accountCode === mapped || c.accountCode === code);
  };

  app.get("/api/asset-categories", requireAuth, async (req, res) => {
    try {
      const companyId = Number(req.query.companyId) || (req.user as any)?.companyId;
      if (!companyId) return res.status(400).json({ message: "กรุณาระบุบริษัท" });
      const cats = await getCompanyCategories(companyId);
      res.json(cats);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/asset-categories", requireAuth, requireModule("fixed-assets"), async (req, res) => {
    try {
      const companyId = Number(req.body.companyId) || (req.user as any)?.companyId;
      if (!companyId) return res.status(400).json({ message: "กรุณาระบุบริษัท" });
      const { accountCode, name, accumCode, depExpCode, usefulLifeMonths, depreciationRate } = req.body;
      if (!accountCode || !name) return res.status(400).json({ message: "กรุณากรอกรหัสบัญชีและชื่อหมวดหมู่" });
      const [dup] = await db.select().from(assetCategories).where(and(eq(assetCategories.companyId, companyId), eq(assetCategories.accountCode, accountCode)));
      if (dup) return res.status(400).json({ message: `รหัสบัญชี ${accountCode} ซ้ำกับ "${dup.name}" ที่มีอยู่แล้ว` });
      const maxSort = await db.select({ max: sql<number>`COALESCE(MAX(sort_order), 0)` }).from(assetCategories).where(eq(assetCategories.companyId, companyId));
      const [cat] = await db.insert(assetCategories).values({
        companyId, accountCode, name,
        accumCode: accumCode || null,
        depExpCode: depExpCode || null,
        usefulLifeMonths: Number(usefulLifeMonths) || 0,
        depreciationRate: String(depreciationRate || "0"),
        sortOrder: (maxSort[0]?.max || 0) + 1,
        isDefault: false,
      }).returning();
      res.json(cat);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.patch("/api/asset-categories/:id", requireAuth, requireModule("fixed-assets"), async (req, res) => {
    try {
      const [existing] = await db.select().from(assetCategories).where(eq(assetCategories.id, Number(req.params.id)));
      if (!existing) return res.status(404).json({ message: "ไม่พบหมวดหมู่" });
      { const ac = await checkDocOwnership(existing.companyId, req.user); if (!ac.allowed) return res.status(403).json({ message: ac.message }); }
      const updates: any = {};
      if (req.body.accountCode !== undefined && req.body.accountCode !== existing.accountCode) {
        const [used] = await db.select({ cnt: count() }).from(fixedAssets).where(and(eq(fixedAssets.companyId, existing.companyId), eq(fixedAssets.categoryAccountCode, existing.accountCode)));
        if (Number(used.cnt) > 0) return res.status(400).json({ message: `ไม่สามารถเปลี่ยนรหัสบัญชีได้ มีสินทรัพย์ใช้รหัสนี้อยู่ ${used.cnt} รายการ` });
        const [dup] = await db.select().from(assetCategories).where(and(eq(assetCategories.companyId, existing.companyId), eq(assetCategories.accountCode, req.body.accountCode)));
        if (dup) return res.status(400).json({ message: `รหัสบัญชี ${req.body.accountCode} ซ้ำกับ "${dup.name}"` });
        updates.accountCode = req.body.accountCode;
      }
      if (req.body.name !== undefined) updates.name = req.body.name;
      if (req.body.accumCode !== undefined) updates.accumCode = req.body.accumCode || null;
      if (req.body.depExpCode !== undefined) updates.depExpCode = req.body.depExpCode || null;
      if (req.body.usefulLifeMonths !== undefined) updates.usefulLifeMonths = Number(req.body.usefulLifeMonths);
      if (req.body.depreciationRate !== undefined) updates.depreciationRate = String(req.body.depreciationRate);
      if (req.body.sortOrder !== undefined) updates.sortOrder = Number(req.body.sortOrder);
      const [updated] = await db.update(assetCategories).set(updates).where(eq(assetCategories.id, existing.id)).returning();
      res.json(updated);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.delete("/api/asset-categories/:id", requireAuth, requireModule("fixed-assets"), async (req, res) => {
    try {
      const [existing] = await db.select().from(assetCategories).where(eq(assetCategories.id, Number(req.params.id)));
      if (!existing) return res.status(404).json({ message: "ไม่พบหมวดหมู่" });
      { const ac = await checkDocOwnership(existing.companyId, req.user); if (!ac.allowed) return res.status(403).json({ message: ac.message }); }
      const [used] = await db.select({ cnt: count() }).from(fixedAssets).where(and(eq(fixedAssets.companyId, existing.companyId), eq(fixedAssets.categoryAccountCode, existing.accountCode)));
      if (Number(used.cnt) > 0) return res.status(400).json({ message: `ไม่สามารถลบได้ มีสินทรัพย์ใช้หมวดหมู่นี้อยู่ ${used.cnt} รายการ` });
      await db.delete(assetCategories).where(eq(assetCategories.id, existing.id));
      res.json({ message: "ลบสำเร็จ" });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/asset-categories/seed-defaults", requireAuth, requireModule("fixed-assets"), async (req, res) => {
    try {
      const companyId = Number(req.body.companyId) || (req.user as any)?.companyId;
      if (!companyId) return res.status(400).json({ message: "กรุณาระบุบริษัท" });
      const cats = await ensureDefaultCategories(companyId);
      res.json(cats);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/fixed-assets/import/template", async (req, res) => {
    try {
      const companyId = Number(req.query.companyId) || (req.user as any)?.companyId || 0;
      const cats = companyId ? await getCompanyCategories(companyId) : DEFAULT_ASSET_CATEGORIES;
      const headers = ["รหัสสินทรัพย์", "ชื่อสินทรัพย์", "รายละเอียด", "หมวดหมู่", "วันที่ซื้อ", "วันเริ่มคิดค่าเสื่อม", "ราคาทุน", "มูลค่าซาก", "อายุการใช้งาน(เดือน)", "ค่าเสื่อมสะสมยกมา", "มูลค่าสุทธิ", "สถานที่", "แผนก", "ผู้จำหน่าย", "เลขที่ใบแจ้งหนี้", "หมายเหตุ"];
      const sample = ["FA-0001", "เครื่องคอมพิวเตอร์", "Dell OptiPlex", "อุปกรณ์คอมพิวเตอร์", "01/01/2026", "01/01/2026", "35000", "1000", "36", "20000", "15000", "สำนักงานใหญ่", "บัญชี", "บจ. คอมพิวเตอร์ จำกัด", "INV-001", ""];
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([headers, sample]);
      ws["!cols"] = [12, 25, 25, 20, 14, 14, 14, 14, 14, 16, 12, 25, 16, 20].map(w => ({ wch: w }));
      const catWs = XLSX.utils.aoa_to_sheet([["รหัสบัญชี", "ชื่อหมวดหมู่", "อายุการใช้งาน(เดือน)", "อัตราค่าเสื่อม(%)"], ...cats.map(c => [c.accountCode, c.name, c.usefulLifeMonths, c.depreciationRate])]);
      catWs["!cols"] = [12, 25, 18, 18].map(w => ({ wch: w }));
      XLSX.utils.book_append_sheet(wb, ws, "สินทรัพย์");
      XLSX.utils.book_append_sheet(wb, catWs, "หมวดหมู่");
      const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=template_fixed_assets.xlsx");
      res.send(Buffer.from(buf));
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/fixed-assets/export", requireAuth, async (req, res) => {
    try {
      const companyId = Number(req.query.companyId);
      if (!companyId) return res.status(400).json({ message: "กรุณาระบุ companyId" });
      const assets = await storage.getFixedAssets(companyId);
      const catMap: Record<string, string> = {};
      const companyCats = await getCompanyCategories(companyId);
      companyCats.forEach(c => { catMap[c.accountCode] = c.name; });
      const statusLabel: Record<string, string> = { active: "ใช้งาน", disposed: "จำหน่ายแล้ว" };
      const headers = ["รหัสสินทรัพย์", "ชื่อสินทรัพย์", "รายละเอียด", "หมวดหมู่", "วันที่ซื้อ", "วันเริ่มคิดค่าเสื่อม", "ราคาทุน", "มูลค่าซาก", "อายุการใช้งาน(เดือน)", "ค่าเสื่อมรายเดือน", "ค่าเสื่อมสะสม", "มูลค่าสุทธิ", "สถานที่", "แผนก", "ผู้จำหน่าย", "เลขที่ใบแจ้งหนี้", "สถานะ", "วันจำหน่าย", "ราคาจำหน่าย", "กำไร/ขาดทุน", "หมายเหตุ"];
      const fmtDate = (d: string | null) => {
        if (!d) return "";
        const dt = new Date(d);
        const dd = String(dt.getDate()).padStart(2, "0");
        const mm = String(dt.getMonth() + 1).padStart(2, "0");
        const yy = dt.getFullYear() + 543;
        return `${dd}/${mm}/${yy}`;
      };
      const rows = assets.map(a => [
        a.assetCode, a.name, a.description || "", catMap[a.categoryAccountCode] || a.categoryAccountCode,
        fmtDate(a.purchaseDate), fmtDate(a.startDepreciationDate),
        parseFloat(a.cost || "0"), parseFloat(a.salvageValue || "0"), a.usefulLifeMonths,
        parseFloat(a.monthlyDepreciation || "0"), parseFloat(a.accumDepreciation || "0"), parseFloat(a.netBookValue || "0"),
        a.location || "", a.department || "", a.supplier || "", a.invoiceRef || "",
        statusLabel[a.status] || a.status,
        fmtDate(a.disposalDate || null), a.disposalPrice ? parseFloat(a.disposalPrice) : "",
        a.disposalGainLoss ? parseFloat(a.disposalGainLoss) : "",
        a.notes || ""
      ]);
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws["!cols"] = [14, 25, 25, 20, 14, 14, 14, 14, 14, 14, 14, 14, 16, 12, 25, 16, 10, 14, 14, 14, 20].map(w => ({ wch: w }));
      XLSX.utils.book_append_sheet(wb, ws, "สินทรัพย์");
      const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=fixed_assets_export.xlsx");
      res.send(Buffer.from(buf));
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/fixed-assets/import/preview", requireAuth, upload.single("file"), async (req: any, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "กรุณาอัปโหลดไฟล์" });
      const companyId = Number(req.body.companyId);
      if (!companyId) return res.status(400).json({ message: "กรุณาระบุ companyId" });

      let rows: any[] = [];
      const ext = path.extname(req.file.originalname).toLowerCase();
      if (ext === ".xlsx" || ext === ".xls") {
        const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      } else if (ext === ".csv") {
        let content = req.file.buffer.toString("utf-8");
        const hasThai = /[\u0E00-\u0E7F]/.test(content);
        const hasHighBytes = req.file.buffer.some((b: number) => b >= 0xA1 && b <= 0xFB);
        if (!hasThai && hasHighBytes) {
          try { content = new TextDecoder("tis-620").decode(req.file.buffer); } catch { content = req.file.buffer.toString("latin1"); }
        }
        const delimiter = content.split(/\r?\n/)[0].includes("\t") ? "\t" : ",";
        const { parse: csvParseFn } = await import("csv-parse/sync");
        rows = csvParseFn(content, { columns: true, skip_empty_lines: true, trim: true, bom: true, delimiter, relax_quotes: true, relax_column_count: true });
      } else {
        return res.status(400).json({ message: "รองรับเฉพาะไฟล์ .csv, .xlsx, .xls" });
      }
      if (rows.length === 0) return res.status(400).json({ message: "ไม่พบข้อมูลในไฟล์" });
      if (rows.length > 500) return res.status(400).json({ message: "รองรับสูงสุด 500 รายการต่อครั้ง" });

      const FIELD_MAP: Record<string, string[]> = {
        assetCode: ["รหัสสินทรัพย์", "asset_code", "assetCode", "รหัส", "code"],
        name: ["ชื่อสินทรัพย์", "ชื่อ", "name", "asset_name"],
        description: ["รายละเอียด", "description", "desc"],
        category: ["หมวดหมู่", "category", "ประเภท", "type"],
        purchaseDate: ["วันที่ซื้อ", "purchase_date", "purchaseDate", "buy_date"],
        startDepreciationDate: ["วันเริ่มคิดค่าเสื่อม", "start_depreciation_date", "startDepreciationDate", "dep_start"],
        cost: ["ราคาทุน", "cost", "price", "มูลค่า", "amount"],
        salvageValue: ["มูลค่าซาก", "salvage_value", "salvageValue", "residual"],
        usefulLifeMonths: ["อายุการใช้งาน(เดือน)", "อายุการใช้งาน", "useful_life", "usefulLifeMonths", "months"],
        accumDepreciation: ["ค่าเสื่อมสะสมยกมา", "ค่าเสื่อมสะสม", "accum_depreciation", "accumDepreciation", "accumulated_depreciation"],
        netBookValue: ["มูลค่าสุทธิ", "net_book_value", "netBookValue", "book_value"],
        location: ["สถานที่", "location"],
        department: ["แผนก", "department", "dept"],
        supplier: ["ผู้จำหน่าย", "supplier", "vendor"],
        invoiceRef: ["เลขที่ใบแจ้งหนี้", "invoice_ref", "invoiceRef", "invoice"],
        notes: ["หมายเหตุ", "notes", "remark"],
      };

      const headers = Object.keys(rows[0]);
      const columnMapping: Record<string, string | null> = {};
      headers.forEach(h => {
        const hl = h.trim().toLowerCase();
        for (const [field, aliases] of Object.entries(FIELD_MAP)) {
          if (aliases.some(a => a.toLowerCase() === hl)) { columnMapping[h] = field; return; }
        }
        columnMapping[h] = null;
      });

      const companyCats2 = await getCompanyCategories(companyId);
      const catNameMap: Record<string, typeof companyCats2[0]> = {};
      companyCats2.forEach(c => { catNameMap[c.name] = c; catNameMap[c.accountCode] = c; });

      const existingAssets = await storage.getFixedAssets(companyId);
      const existingCodes = new Set(existingAssets.map(a => a.assetCode));

      const parseDateStr = (s: string): string | null => {
        if (!s) return null;
        const parts = s.split("/");
        if (parts.length === 3) {
          let [dd, mm, yyyy] = parts.map(Number);
          if (yyyy > 2500) yyyy -= 543;
          if (mm > 0 && dd > 0 && yyyy > 1900) return `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
        }
        const d = new Date(s);
        if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
        return null;
      };

      const preview = rows.map((row: any, idx: number) => {
        const mapped: any = {};
        for (const [header, value] of Object.entries(row)) {
          const field = columnMapping[header];
          if (field) mapped[field] = String(value).trim();
        }

        const issues: string[] = [];
        if (!mapped.name) issues.push("ไม่มีชื่อสินทรัพย์");
        if (mapped.assetCode && existingCodes.has(mapped.assetCode)) issues.push(`รหัส "${mapped.assetCode}" มีในระบบแล้ว`);

        const cat = mapped.category ? catNameMap[mapped.category] : null;
        if (mapped.category && !cat) issues.push(`ไม่พบหมวดหมู่ "${mapped.category}"`);

        const purchaseDate = parseDateStr(mapped.purchaseDate || "");
        const startDepDate = parseDateStr(mapped.startDepreciationDate || mapped.purchaseDate || "");
        if (!purchaseDate) issues.push("วันที่ซื้อไม่ถูกต้อง");

        const cost = parseFloat(String(mapped.cost || "0").replace(/,/g, ""));
        if (!cost || cost <= 0) issues.push("ราคาทุนไม่ถูกต้อง");

        const salvageValue = parseFloat(String(mapped.salvageValue || "0").replace(/,/g, ""));
        const usefulLifeMonths = mapped.usefulLifeMonths ? parseInt(mapped.usefulLifeMonths) : (cat?.usefulLifeMonths || 60);
        const accumDep = parseFloat(String(mapped.accumDepreciation || "0").replace(/,/g, ""));
        const importedNetBV = parseFloat(String(mapped.netBookValue || "0").replace(/,/g, ""));

        return {
          row: idx + 1,
          data: {
            assetCode: mapped.assetCode || "",
            name: mapped.name || "",
            description: mapped.description || "",
            categoryAccountCode: cat?.accountCode || "",
            categoryName: cat?.name || mapped.category || "",
            purchaseDate: purchaseDate || "",
            startDepreciationDate: startDepDate || purchaseDate || "",
            cost: cost.toFixed(2),
            salvageValue: salvageValue.toFixed(2),
            usefulLifeMonths,
            accumDepreciation: accumDep.toFixed(2),
            netBookValue: importedNetBV > 0 ? importedNetBV.toFixed(2) : (cost - accumDep).toFixed(2),
            location: mapped.location || "",
            department: mapped.department || "",
            supplier: mapped.supplier || "",
            invoiceRef: mapped.invoiceRef || "",
            notes: mapped.notes || "",
          },
          issues,
          valid: issues.length === 0 && !!mapped.name && cost > 0 && !!purchaseDate && !!cat,
        };
      });

      res.json({ total: preview.length, valid: preview.filter(p => p.valid).length, invalid: preview.filter(p => !p.valid).length, preview });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/fixed-assets/import/confirm", requireAuth, async (req, res) => {
    try {
      const { companyId, items } = req.body;
      if (!companyId || !items?.length) return res.status(400).json({ message: "ไม่มีข้อมูลนำเข้า" });

      const created: any[] = [];
      for (const item of items) {
        const cost = parseFloat(item.cost || "0");
        const salvageValue = parseFloat(item.salvageValue || "0");
        const usefulLifeMonths = parseInt(item.usefulLifeMonths || "60");
        const monthlyDep = usefulLifeMonths > 0 ? (cost - salvageValue) / usefulLifeMonths : 0;
        const cat = await findCategory(item.categoryAccountCode, companyId);
        const assetCode = item.assetCode || await storage.getNextAssetCode(companyId);

        const importedAccumDep = parseFloat(item.accumDepreciation || "0");
        const importedNetBV = parseFloat(item.netBookValue || "0");
        const hasImportedDep = importedAccumDep > 0;

        const finalAccumDep = hasImportedDep ? importedAccumDep : 0;
        const finalNetBV = hasImportedDep ? (importedNetBV > 0 ? importedNetBV : cost - importedAccumDep) : cost;

        const asset = await storage.createFixedAsset({
          companyId,
          assetCode,
          name: item.name,
          description: item.description || null,
          categoryAccountCode: item.categoryAccountCode,
          accumDepreciationAccountCode: cat?.accumCode || null,
          depreciationExpenseAccountCode: cat?.depExpCode || "5301500",
          purchaseDate: item.purchaseDate,
          startDepreciationDate: item.startDepreciationDate || item.purchaseDate,
          cost: cost.toFixed(2),
          salvageValue: salvageValue.toFixed(2),
          usefulLifeMonths,
          depreciationMethod: "straight_line",
          monthlyDepreciation: monthlyDep.toFixed(2),
          accumDepreciation: finalAccumDep.toFixed(2),
          netBookValue: finalNetBV.toFixed(2),
          location: item.location || null,
          department: item.department || null,
          supplier: item.supplier || null,
          invoiceRef: item.invoiceRef || null,
          notes: item.notes || null,
          status: "active",
          createdBy: (req.user as any)?.id || null,
        });
        created.push(asset);
      }

      res.json({ created: created.length, assets: created });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/asset-settings", requireAuth, async (req, res) => {
    try {
      const companyId = req.query.companyId ? Number(req.query.companyId) : null;
      if (!companyId) return res.status(400).json({ message: "companyId required" });
      const [company] = await db.select({ assetMinThreshold: companies.assetMinThreshold }).from(companies).where(eq(companies.id, companyId));
      if (!company) return res.status(404).json({ message: "Company not found" });
      res.json({ assetMinThreshold: company.assetMinThreshold || "0" });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.patch("/api/asset-settings", requireAuth, async (req, res) => {
    try {
      const { companyId, assetMinThreshold } = req.body;
      if (!companyId) return res.status(400).json({ message: "companyId required" });
      await db.update(companies).set({ assetMinThreshold: String(assetMinThreshold || "0") }).where(eq(companies.id, companyId));
      res.json({ success: true, assetMinThreshold });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/expenses-with-assets", requireAuth, async (req, res) => {
    try {
      const companyId = req.query.companyId ? Number(req.query.companyId) : null;
      if (!companyId) return res.status(400).json({ message: "companyId required" });
      const allExpenses = await db.select().from(expenses).where(eq(expenses.companyId, companyId)).orderBy(desc(expenses.createdAt));
      const result = [];
      for (const exp of allExpenses) {
        const items = await db.select().from(expenseItems).where(eq(expenseItems.expenseId, exp.id));
        const assetItems = items.filter(it => it.expenseType === "asset");
        if (assetItems.length > 0) {
          result.push({ ...exp, assetItems });
        }
      }
      res.json(result);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/fixed-assets", requireAuth, async (req, res) => {
    try {
      const companyId = req.query.companyId ? Number(req.query.companyId) : null;
      if (!companyId) return res.status(400).json({ message: "companyId required" });
      const { page, pageSize, offset } = parsePagination(req, { pageSize: 50 });
      const whereClause = eq(fixedAssets.companyId, companyId);
      const [{ total }] = await db.select({ total: count() }).from(fixedAssets).where(whereClause);
      const assets = await db.select().from(fixedAssets).where(whereClause).orderBy(desc(fixedAssets.createdAt)).limit(pageSize).offset(offset);
      if (req.query.page) {
        res.json(paginatedResponse(assets, Number(total), { page, pageSize, offset }));
      } else {
        res.json(assets);
      }
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/fixed-assets/next-code", requireAuth, async (req, res) => {
    try {
      const companyId = req.query.companyId ? Number(req.query.companyId) : null;
      if (!companyId) return res.status(400).json({ message: "companyId required" });
      const code = await storage.getNextAssetCode(companyId);
      res.json({ code });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/fixed-assets/:id", requireAuth, async (req, res) => {
    try {
      const asset = await storage.getFixedAsset(Number(req.params.id));
      if (!asset) return res.status(404).json({ message: "Asset not found" });
      res.json(asset);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/fixed-assets", requireAuth, async (req, res) => {
    try {
      const companyId = req.query.companyId ? Number(req.query.companyId) : (req.body.companyId ? Number(req.body.companyId) : null);
      if (!companyId) return res.status(400).json({ message: "companyId required" });
      const data = req.body;
      const cost = parseFloat(data.cost || "0");
      const salvageValue = parseFloat(data.salvageValue || "0");
      const usefulLifeMonths = parseInt(data.usefulLifeMonths || "60");
      const monthlyDep = usefulLifeMonths > 0 ? (cost - salvageValue) / usefulLifeMonths : 0;
      
      const category = await findCategory(data.categoryAccountCode, companyId);
      
      const asset = await storage.createFixedAsset({
        ...data,
        companyId,
        monthlyDepreciation: monthlyDep.toFixed(2),
        accumDepreciation: "0",
        netBookValue: cost.toFixed(2),
        accumDepreciationAccountCode: data.accumDepreciationAccountCode || category?.accumCode || null,
        depreciationExpenseAccountCode: data.depreciationExpenseAccountCode || category?.depExpCode || "5301500",
        createdBy: (req.user as any)?.id || null,
      });
      res.json(asset);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.put("/api/fixed-assets/:id", requireAuth, async (req, res) => {
    try {
      const data = req.body;
      if (data.cost && data.usefulLifeMonths) {
        const cost = parseFloat(data.cost || "0");
        const salvageValue = parseFloat(data.salvageValue || "0");
        const usefulLifeMonths = parseInt(data.usefulLifeMonths || "60");
        data.monthlyDepreciation = usefulLifeMonths > 0 ? ((cost - salvageValue) / usefulLifeMonths).toFixed(2) : "0";
      }
      const asset = await storage.updateFixedAsset(Number(req.params.id), data);
      if (!asset) return res.status(404).json({ message: "Asset not found" });
      res.json(asset);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.delete("/api/fixed-assets/bulk/by-company", requireAuth, async (req, res) => {
    try {
      const companyId = Number(req.query.companyId);
      if (!companyId) return res.status(400).json({ message: "กรุณาระบุ companyId" });
      const allAssets = await storage.getFixedAssets(companyId);
      for (const asset of allAssets) {
        await storage.deleteFixedAsset(asset.id);
      }
      res.json({ deleted: allAssets.length });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.delete("/api/fixed-assets/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteFixedAsset(Number(req.params.id));
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/fixed-assets/:id/depreciations", requireAuth, async (req, res) => {
    try {
      const deps = await storage.getAssetDepreciations(Number(req.params.id));
      res.json(deps);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/fixed-assets/:id/calculate-depreciation", requireAuth, async (req, res) => {
    try {
      const assetId = Number(req.params.id);
      const { upToDate } = req.body;
      const asset = await storage.getFixedAsset(assetId);
      if (!asset) return res.status(404).json({ message: "Asset not found" });
      if (asset.status !== "active") return res.status(400).json({ message: "Asset is not active" });
      const assetCat = await findCategory(asset.categoryAccountCode, asset.companyId);
      if (assetCat && assetCat.usefulLifeMonths === 0) return res.status(400).json({ message: `หมวดหมู่ "${assetCat.name}" ไม่คิดค่าเสื่อมราคา` });

      const existingDeps = await storage.getAssetDepreciations(assetId);
      const existingPeriods = new Set(existingDeps.map(d => d.period));

      const cost = parseFloat(asset.cost || "0");
      const salvageValue = parseFloat(asset.salvageValue || "0");
      const usefulLifeMonths = asset.usefulLifeMonths;
      const monthlyDep = usefulLifeMonths > 0 ? (cost - salvageValue) / usefulLifeMonths : 0;

      const startDate = new Date(asset.startDepreciationDate);
      const endDate = new Date(upToDate || new Date().toISOString().split("T")[0]);
      
      let currentAccum = existingDeps.length > 0 
        ? parseFloat(existingDeps[existingDeps.length - 1].accumDepreciation || "0")
        : 0;

      const newDeps: any[] = [];
      const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);

      while (current <= endDate) {
        const period = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}`;
        
        if (!existingPeriods.has(period)) {
          const maxDepreciable = cost - salvageValue;
          let depAmount = monthlyDep;
          
          if (current.getFullYear() === startDate.getFullYear() && current.getMonth() === startDate.getMonth()) {
            const daysInMonth = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
            const daysUsed = daysInMonth - startDate.getDate() + 1;
            depAmount = (monthlyDep / daysInMonth) * daysUsed;
          }
          
          if (currentAccum + depAmount > maxDepreciable) {
            depAmount = maxDepreciable - currentAccum;
          }
          if (depAmount <= 0) break;
          
          currentAccum += depAmount;
          const nbv = cost - currentAccum;

          const dep = await storage.createAssetDepreciation({
            companyId: asset.companyId,
            assetId,
            period,
            periodDate: `${period}-01`,
            depreciationAmount: depAmount.toFixed(2),
            accumDepreciation: currentAccum.toFixed(2),
            netBookValue: nbv.toFixed(2),
            posted: false,
          });
          newDeps.push(dep);
        }

        current.setMonth(current.getMonth() + 1);
      }

      await storage.updateFixedAsset(assetId, {
        accumDepreciation: currentAccum.toFixed(2),
        netBookValue: (cost - currentAccum).toFixed(2),
      });

      res.json({ created: newDeps.length, depreciations: newDeps });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/fixed-assets/:id/post-depreciation", requireAuth, async (req, res) => {
    try {
      const assetId = Number(req.params.id);
      const { period } = req.body;
      const asset = await storage.getFixedAsset(assetId);
      if (!asset) return res.status(404).json({ message: "Asset not found" });

      const deps = await storage.getAssetDepreciations(assetId);
      const dep = deps.find(d => d.period === period);
      if (!dep) return res.status(404).json({ message: "Depreciation period not found" });
      if (dep.posted) return res.status(400).json({ message: "Already posted" });

      const companyId = asset.companyId!;
      const expenseCode = asset.depreciationExpenseAccountCode || "5251";
      const accumCode = asset.accumDepreciationAccountCode || "1412";
      
      const companyAccounts = await storage.getAccounts(companyId);
      const expenseAccount = companyAccounts.find(a => a.code === expenseCode);
      const accumAccount = companyAccounts.find(a => a.code === accumCode);
      if (!expenseAccount || !accumAccount) return res.status(400).json({ message: "ไม่พบบัญชีค่าเสื่อมราคาในผังบัญชี กรุณาตรวจสอบ" });
      
      const journalEntry = await storage.createJournalEntry({
        companyId,
        entryDate: dep.periodDate,
        description: `ค่าเสื่อมราคา ${asset.name} (${dep.period})`,
        reference: asset.assetCode,
        journalBook: "general",
        status: "posted",
        sourceDocType: "depreciation",
        sourceDocId: assetId,
      });
      
      await storage.createJournalLine({
        journalEntryId: journalEntry.id,
        accountId: expenseAccount.id,
        description: `ค่าเสื่อมราคา - ${asset.name}`,
        debit: dep.depreciationAmount,
        credit: "0",
      });
      await storage.createJournalLine({
        journalEntryId: journalEntry.id,
        accountId: accumAccount.id,
        description: `ค่าเสื่อมราคาสะสม - ${asset.name}`,
        debit: "0",
        credit: dep.depreciationAmount,
      });

      await db.update(assetDepreciations)
        .set({ posted: true, journalEntryId: journalEntry.id })
        .where(eq(assetDepreciations.id, dep.id));

      res.json({ success: true, journalEntryId: journalEntry.id });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/fixed-assets/batch/calculate", requireAuth, async (req, res) => {
    try {
      const { companyId, fromDate, toDate } = req.body;
      if (!companyId || !fromDate || !toDate) return res.status(400).json({ message: "กรุณาระบุ companyId, fromDate, toDate" });
      
      const allAssets = await storage.getFixedAssets(companyId);
      const companyCatsNoDep = await getCompanyCategories(companyId);
      const noDepCodes = new Set(companyCatsNoDep.filter(c => c.usefulLifeMonths === 0).map(c => c.accountCode));
      const activeAssets = allAssets.filter(a => a.status === "active" && !noDepCodes.has(a.categoryAccountCode));
      
      const from = new Date(fromDate);
      const to = new Date(toDate);
      const fromPeriod = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}`;
      const toPeriod = `${to.getFullYear()}-${String(to.getMonth() + 1).padStart(2, "0")}`;
      
      const results: any[] = [];
      
      for (const asset of activeAssets) {
        const existingDeps = await storage.getAssetDepreciations(asset.id);
        const existingPeriods = new Set(existingDeps.map(d => d.period));
        
        const cost = parseFloat(asset.cost || "0");
        const salvageValue = parseFloat(asset.salvageValue || "0");
        const usefulLifeMonths = asset.usefulLifeMonths;
        if (usefulLifeMonths <= 0) continue;
        const monthlyDep = (cost - salvageValue) / usefulLifeMonths;
        const maxDepreciable = cost - salvageValue;
        
        const startDate = new Date(asset.startDepreciationDate);
        const endDepDate = new Date(startDate.getFullYear(), startDate.getMonth() + usefulLifeMonths, startDate.getDate() - 1);
        if (from > endDepDate) continue;
        if (to < startDate) continue;
        
        const fillStart = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
        const toMonth = new Date(to.getFullYear(), to.getMonth(), 1);
        const current = new Date(fillStart);
        
        let runningAccum = 0;
        let accumBeforeRange = 0;
        let depInRange = 0;
        let hasUnposted = false;
        
        while (current <= toMonth) {
          const pStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}`;
          
          if (existingPeriods.has(pStr)) {
            const existing = existingDeps.find(d => d.period === pStr)!;
            const amt = parseFloat(existing.depreciationAmount || "0");
            runningAccum += amt;
            if (pStr < fromPeriod) accumBeforeRange += amt;
            if (pStr >= fromPeriod && pStr <= toPeriod) {
              depInRange += amt;
              if (!existing.posted) hasUnposted = true;
            }
          } else {
            let depAmount = monthlyDep;
            if (current.getFullYear() === startDate.getFullYear() && current.getMonth() === startDate.getMonth()) {
              const daysInMonth = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
              const daysUsed = daysInMonth - startDate.getDate() + 1;
              depAmount = (monthlyDep / daysInMonth) * daysUsed;
            }
            if (runningAccum + depAmount > maxDepreciable) depAmount = maxDepreciable - runningAccum;
            if (depAmount <= 0) break;
            
            runningAccum += depAmount;
            
            await storage.createAssetDepreciation({
              companyId: asset.companyId,
              assetId: asset.id,
              period: pStr,
              periodDate: `${pStr}-01`,
              depreciationAmount: depAmount.toFixed(2),
              accumDepreciation: runningAccum.toFixed(2),
              netBookValue: (cost - runningAccum).toFixed(2),
              posted: false,
            });
            existingPeriods.add(pStr);
            
            if (pStr < fromPeriod) accumBeforeRange += depAmount;
            if (pStr >= fromPeriod && pStr <= toPeriod) {
              depInRange += depAmount;
              hasUnposted = true;
            }
          }
          current.setMonth(current.getMonth() + 1);
        }
        
        await storage.updateFixedAsset(asset.id, {
          accumDepreciation: runningAccum.toFixed(2),
          netBookValue: (cost - runningAccum).toFixed(2),
        });
        
        if (depInRange > 0) {
          const catName = (await findCategory(asset.categoryAccountCode, asset.companyId))?.name || "";
          const accumEndOfRange = accumBeforeRange + depInRange;
          results.push({
            assetId: asset.id,
            assetCode: asset.assetCode,
            assetName: asset.name,
            categoryAccountCode: asset.categoryAccountCode,
            categoryName: catName,
            department: asset.department || "",
            purchaseDate: asset.purchaseDate,
            startDepreciationDate: asset.startDepreciationDate,
            endDepreciationDate: endDepDate.toISOString().split("T")[0],
            cost,
            salvageValue,
            monthlyDepreciation: parseFloat(asset.monthlyDepreciation || "0"),
            accumDepreciationBF: accumBeforeRange,
            depreciationInRange: depInRange,
            accumDepreciation: accumEndOfRange,
            netBookValue: cost - accumEndOfRange,
            hasUnposted,
          });
        }
      }
      
      res.json({ fromDate, toDate, totalAssets: results.length, results });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/fixed-assets/batch/post-journal", requireAuth, async (req, res) => {
    try {
      const { companyId, fromDate, toDate, entryDate } = req.body;
      if (!companyId || !fromDate || !toDate) return res.status(400).json({ message: "กรุณาระบุ companyId, fromDate, toDate" });
      
      const from = new Date(fromDate);
      const to = new Date(toDate);
      const allAssets = await storage.getFixedAssets(companyId);
      const companyAccounts = await storage.getAccounts(companyId);
      const assetMap = new Map(allAssets.map(a => [a.id, a]));
      
      const fromMonth = new Date(from.getFullYear(), from.getMonth(), 1);
      const toMonth = new Date(to.getFullYear(), to.getMonth(), 1);
      const periods: string[] = [];
      const c = new Date(fromMonth);
      while (c <= toMonth) {
        periods.push(`${c.getFullYear()}-${String(c.getMonth() + 1).padStart(2, "0")}`);
        c.setMonth(c.getMonth() + 1);
      }
      
      const journalEntryIds: number[] = [];
      let totalPosted = 0;
      const skippedItems: string[] = [];
      
      const allDepsToPost: any[] = [];
      for (const period of periods) {
        const depsInPeriod = await db.select().from(assetDepreciations)
          .where(and(
            eq(assetDepreciations.companyId, companyId),
            eq(assetDepreciations.period, period),
            eq(assetDepreciations.posted, false)
          ));
        allDepsToPost.push(...depsInPeriod);
      }
      
      if (allDepsToPost.length === 0) return res.status(400).json({ message: "ไม่มีรายการค่าเสื่อมที่ยังไม่ได้บันทึกบัญชีในช่วงนี้" });
      
      const groupedByCategory: Record<string, { expenseCode: string; accumCode: string; catName: string; items: any[] }> = {};
      for (const dep of allDepsToPost) {
        const asset = assetMap.get(dep.assetId);
        if (!asset) continue;
        
        const cat = await findCategory(asset.categoryAccountCode, asset.companyId);
        const expenseCode = cat?.depExpCode || asset.depreciationExpenseAccountCode || null;
        const accumCode = cat?.accumCode || asset.accumDepreciationAccountCode || null;
        const catName = cat?.name || asset.categoryAccountCode;
        
        if (!expenseCode || !accumCode) {
          skippedItems.push(`${asset.assetCode} (${catName}) - ไม่มีรหัสบัญชีค่าเสื่อม`);
          continue;
        }
        
        const key = `${expenseCode}_${accumCode}`;
        if (!groupedByCategory[key]) groupedByCategory[key] = { expenseCode, accumCode, catName, items: [] };
        groupedByCategory[key].items.push(dep);
      }
      
      const fromPeriod = periods[0];
      const toPeriod = periods[periods.length - 1];
      const refRange = `${fromPeriod}_${toPeriod}`;
      
      await db.transaction(async (tx) => {
        for (const [_key, group] of Object.entries(groupedByCategory)) {
          const expenseAccount = companyAccounts.find(a => a.code === group.expenseCode);
          const accumAccount = companyAccounts.find(a => a.code === group.accumCode);
          
          if (!expenseAccount || !accumAccount) {
            for (const dep of group.items) {
              const asset = assetMap.get(dep.assetId);
              skippedItems.push(`${asset?.assetCode || dep.assetId} (${group.catName}) - ไม่พบรหัสบัญชี ${!expenseAccount ? group.expenseCode : group.accumCode} ในผังบัญชี`);
            }
            continue;
          }
          
          const totalAmount = group.items.reduce((sum: number, d: any) => sum + parseFloat(d.depreciationAmount || "0"), 0);
          if (totalAmount <= 0) continue;
          
          const jeRef = `DEP-${refRange}-${group.expenseCode}`;
          const existingJE = await tx.select().from(journalEntries)
            .where(and(
              eq(journalEntries.companyId, companyId),
              eq(journalEntries.reference, jeRef),
              eq(journalEntries.sourceDocType, "depreciation"),
            ));
          if (existingJE.length > 0) {
            for (const dep of group.items) {
              await tx.update(assetDepreciations)
                .set({ posted: true, journalEntryId: existingJE[0].id })
                .where(eq(assetDepreciations.id, dep.id));
            }
            journalEntryIds.push(existingJE[0].id);
            totalPosted += group.items.length;
            continue;
          }
          
          const jeEntryDate = entryDate || toDate;
          const entryNo = await getNextJournalEntryNo(companyId, "general", jeEntryDate);
          const periodDesc = fromPeriod === toPeriod ? fromPeriod : `${fromPeriod} ถึง ${toPeriod}`;
          const [journalEntry] = await tx.insert(journalEntries).values({
            companyId,
            entryNo,
            entryDate: jeEntryDate,
            description: `ค่าเสื่อมราคา ${periodDesc} - ${group.catName}`,
            reference: jeRef,
            journalBook: "general",
            status: "posted",
            sourceDocType: "depreciation",
            sourceDocId: null,
          }).returning();
          
          await tx.insert(journalLines).values({
            journalEntryId: journalEntry.id,
            accountId: expenseAccount.id,
            description: `ค่าเสื่อมราคา - ${group.catName}`,
            debit: totalAmount.toFixed(2),
            credit: "0",
          });
          await tx.insert(journalLines).values({
            journalEntryId: journalEntry.id,
            accountId: accumAccount.id,
            description: `ค่าเสื่อมราคาสะสม - ${group.catName}`,
            debit: "0",
            credit: totalAmount.toFixed(2),
          });
          
          for (const dep of group.items) {
            await tx.update(assetDepreciations)
              .set({ posted: true, journalEntryId: journalEntry.id })
              .where(eq(assetDepreciations.id, dep.id));
          }
          
          journalEntryIds.push(journalEntry.id);
          totalPosted += group.items.length;
        }
      });
      
      if (journalEntryIds.length === 0 && skippedItems.length === 0) return res.status(400).json({ message: "ไม่มีรายการค่าเสื่อมที่ยังไม่ได้บันทึกบัญชีในช่วงนี้" });
      
      res.json({ success: true, journalEntryIds, postedCount: totalPosted, skippedItems });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/fixed-assets/batch/export-excel", requireAuth, async (req, res) => {
    try {
      const companyId = Number(req.query.companyId);
      const fromDate = req.query.fromDate as string;
      const toDate = req.query.toDate as string;
      if (!companyId || !fromDate || !toDate) return res.status(400).json({ message: "กรุณาระบุ companyId, fromDate, toDate" });
      
      const allAssets = await storage.getFixedAssets(companyId);
      const companyCatsNoDep = await getCompanyCategories(companyId);
      const noDepCodes = new Set(companyCatsNoDep.filter(c => c.usefulLifeMonths === 0).map(c => c.accountCode));
      const activeAssets = allAssets.filter(a => a.status === "active" && !noDepCodes.has(a.categoryAccountCode));
      
      const from = new Date(fromDate);
      const to = new Date(toDate);
      const fromPeriod = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}`;
      const toPeriod = `${to.getFullYear()}-${String(to.getMonth() + 1).padStart(2, "0")}`;
      
      const rows: any[][] = [];
      rows.push(["#", "แผนก", "รายการ", "หมวดหมู่สินทรัพย์", "วันที่ซื้อ", "วันสิ้นสุด", "วันที่เริ่มค่าเสื่อม", "มูลค่าสินทรัพย์", "มูลค่าค่าเสื่อมสะสมยกมา", "มูลค่าค่าตัดจำหน่าย", "ค่าเสื่อมสะสม", "มูลค่าสุทธิ", "ค่าเสื่อมเฉลี่ยต่อเดือน"]);
      
      let idx = 0;
      let totalCost = 0, totalAccumBF = 0, totalDep = 0, totalAccum = 0, totalNBV = 0, totalMonthly = 0;
      
      for (const asset of activeAssets) {
        const existingDeps = await storage.getAssetDepreciations(asset.id);
        const cost = parseFloat(asset.cost || "0");
        const monthly = parseFloat(asset.monthlyDepreciation || "0");
        const endDate = new Date(new Date(asset.startDepreciationDate));
        endDate.setMonth(endDate.getMonth() + asset.usefulLifeMonths);
        
        const accumBF = existingDeps.filter(d => d.period < fromPeriod).reduce((s, d) => s + parseFloat(d.depreciationAmount || "0"), 0);
        const depInRange = existingDeps.filter(d => d.period >= fromPeriod && d.period <= toPeriod).reduce((s, d) => s + parseFloat(d.depreciationAmount || "0"), 0);
        
        if (depInRange <= 0) continue;
        
        const accumTotal = existingDeps.filter(d => d.period <= toPeriod).reduce((s, d) => s + parseFloat(d.depreciationAmount || "0"), 0);
        const nbv = cost - accumTotal;
        const catName = (await findCategory(asset.categoryAccountCode, asset.companyId))?.name || "";
        
        idx++;
        totalCost += cost; totalAccumBF += accumBF; totalDep += depInRange; totalAccum += accumTotal; totalNBV += nbv; totalMonthly += monthly;
        
        rows.push([idx, asset.department || "", `${asset.assetCode} / ${asset.name}`, catName, asset.purchaseDate, endDate.toISOString().split("T")[0], asset.startDepreciationDate, cost, accumBF, depInRange, accumTotal, nbv, monthly]);
      }
      
      rows.push(["", "", "", "", "", "", "รวม", totalCost, totalAccumBF, totalDep, totalAccum, totalNBV, totalMonthly]);
      
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws["!cols"] = [5, 12, 35, 20, 12, 12, 14, 14, 14, 14, 14, 14, 14].map(w => ({ wch: w }));
      XLSX.utils.book_append_sheet(wb, ws, "รายงานค่าเสื่อมราคา");
      const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=depreciation_report_${fromDate}_${toDate}.xlsx`);
      res.send(Buffer.from(buf));
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/fixed-assets/:id/dispose", requireAuth, async (req, res) => {
    try {
      const assetId = Number(req.params.id);
      const { disposalDate, disposalPrice } = req.body;
      const asset = await storage.getFixedAsset(assetId);
      if (!asset) return res.status(404).json({ message: "Asset not found" });
      if (asset.status !== "active") return res.status(400).json({ message: "Asset is not active" });

      const cost = parseFloat(asset.cost || "0");
      const accumDep = parseFloat(asset.accumDepreciation || "0");
      const nbv = cost - accumDep;
      const price = parseFloat(disposalPrice || "0");
      const gainLoss = price - nbv;

      const companyId = asset.companyId!;
      const accumCode = asset.accumDepreciationAccountCode || "1412";
      const gainLossCode = gainLoss >= 0 ? "4200300" : "5901600";
      
      const companyAccounts = await storage.getAccounts(companyId);
      const findAcct = (code: string) => companyAccounts.find(a => a.code === code);
      const cashAcct = findAcct("1001000") || findAcct("1001");
      const accumAcct = findAcct(accumCode);
      const categoryAcct = findAcct(asset.categoryAccountCode);
      const gainLossAcct = findAcct(gainLossCode);
      if (!accumAcct || !categoryAcct) return res.status(400).json({ message: "ไม่พบบัญชีสินทรัพย์ในผังบัญชี กรุณาตรวจสอบ" });
      
      const journalEntry = await storage.createJournalEntry({
        companyId,
        entryDate: disposalDate,
        description: `จำหน่ายสินทรัพย์ ${asset.name}`,
        reference: asset.assetCode,
        journalBook: "general",
        status: "posted",
        sourceDocType: "asset_disposal",
        sourceDocId: assetId,
      });

      if (price > 0 && cashAcct) {
        await storage.createJournalLine({
          journalEntryId: journalEntry.id,
          accountId: cashAcct.id,
          description: `รับเงินจากการจำหน่าย ${asset.name}`,
          debit: price.toFixed(2),
          credit: "0",
        });
      }
      await storage.createJournalLine({
        journalEntryId: journalEntry.id,
        accountId: accumAcct.id,
        description: `ค่าเสื่อมราคาสะสม - ${asset.name}`,
        debit: accumDep.toFixed(2),
        credit: "0",
      });
      if (gainLoss < 0 && gainLossAcct) {
        await storage.createJournalLine({
          journalEntryId: journalEntry.id,
          accountId: gainLossAcct.id,
          description: `ขาดทุนจากการจำหน่าย ${asset.name}`,
          debit: Math.abs(gainLoss).toFixed(2),
          credit: "0",
        });
      }
      await storage.createJournalLine({
        journalEntryId: journalEntry.id,
        accountId: categoryAcct.id,
        description: `ตัดจำหน่ายสินทรัพย์ ${asset.name}`,
        debit: "0",
        credit: cost.toFixed(2),
      });
      if (gainLoss > 0 && gainLossAcct) {
        await storage.createJournalLine({
          journalEntryId: journalEntry.id,
          accountId: gainLossAcct.id,
          description: `กำไรจากการจำหน่าย ${asset.name}`,
          debit: "0",
          credit: gainLoss.toFixed(2),
        });
      }

      const updated = await storage.updateFixedAsset(assetId, {
        status: "disposed",
        disposalDate,
        disposalPrice: price.toFixed(2),
        disposalGainLoss: gainLoss.toFixed(2),
        disposalJournalId: journalEntry.id,
      });

      res.json({ success: true, asset: updated, journalEntryId: journalEntry.id, gainLoss });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/vat-closings", requireAuth, async (req, res) => {
    try {
      const companyId = Number(req.query.companyId);
      if (!companyId) return res.status(400).json({ message: "companyId required" });
      const rows = await db.select().from(vatClosings).where(eq(vatClosings.companyId, companyId)).orderBy(desc(vatClosings.year), desc(vatClosings.month));
      res.json(rows);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/vat-closing-check", requireAuth, async (req, res) => {
    try {
      const companyId = Number(req.query.companyId);
      const docDate = String(req.query.docDate || "");
      if (!companyId || !docDate) return res.status(400).json({ message: "companyId and docDate required" });
      const d = new Date(docDate);
      const docMonth = d.getMonth() + 1;
      const docYear = d.getFullYear();
      const [existing] = await db.select().from(vatClosings)
        .where(and(eq(vatClosings.companyId, companyId), eq(vatClosings.month, docMonth), eq(vatClosings.year, docYear)));
      if (!existing) return res.json({ closed: false });
      const now = new Date();
      const deadlineDay = 23;
      const nextMonth = docMonth === 12 ? 1 : docMonth + 1;
      const nextYear = docMonth === 12 ? docYear + 1 : docYear;
      const pastDeadline = (now.getFullYear() > nextYear) ||
        (now.getFullYear() === nextYear && now.getMonth() + 1 > nextMonth) ||
        (now.getFullYear() === nextYear && now.getMonth() + 1 === nextMonth && now.getDate() > deadlineDay);
      res.json({ closed: true, closedAt: existing.closedAt, pastDeadline, deadlineMonth: nextMonth, deadlineYear: nextYear });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/vat-closings", requireAuth, async (req, res) => {
    try {
      const { companyId, month, year, notes } = req.body;
      if (!companyId || !month || !year) return res.status(400).json({ message: "companyId, month, year required" });
      const [existing] = await db.select().from(vatClosings)
        .where(and(eq(vatClosings.companyId, companyId), eq(vatClosings.month, month), eq(vatClosings.year, year)));
      if (existing) return res.status(400).json({ message: "เดือนนี้ปิด VAT ไปแล้ว" });
      const userId = (req.user as any)?.id || null;
      const [created] = await db.insert(vatClosings).values({ companyId, month, year, closedBy: userId, notes }).returning();
      res.json(created);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.delete("/api/vat-closings/:id", requireAuth, async (req, res) => {
    try {
      const id = Number(req.params.id);
      await db.delete(vatClosings).where(eq(vatClosings.id, id));
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // AR Aging Report (รายงานลูกหนี้คงค้าง)
  app.get("/api/reports/ar-aging", requireAuth, requireModule("sales"), async (req, res) => {
    try {
      const companyId = Number(req.query.companyId);
      if (!companyId) return res.status(400).json({ message: "companyId required" });

      const asOfDate = (req.query.asOfDate as string) || new Date().toISOString().slice(0, 10);
      const asOfMs = new Date(asOfDate + "T00:00:00").getTime();

      const user = req.user as any;
      const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
      if (company && company.tenantId && company.tenantId !== user.tenantId) {
        return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });
      }

      const tivData = await db.select().from(taxInvoices).where(
        and(
          eq(taxInvoices.companyId, companyId),
          sql`${taxInvoices.status} != 'cancelled'`,
          sql`COALESCE(${taxInvoices.paymentStatus}, 'unpaid') != 'paid'`,
          sql`${taxInvoices.taxInvoiceDate} <= ${asOfDate}`
        )
      );

      const ivData = await db.select().from(invoices).where(
        and(
          eq(invoices.companyId, companyId),
          sql`${invoices.status} != 'cancelled'`,
          sql`COALESCE(${invoices.paymentStatus}, 'unpaid') != 'paid'`,
          sql`${invoices.invoiceDate} <= ${asOfDate}`
        )
      );

      const customerMap = new Map<string, {
        customerId: number | null;
        customerName: string;
        current: number;
        days31_60: number;
        days61_90: number;
        days91_120: number;
        over120: number;
        total: number;
        invoices: any[];
      }>();

      const addToARBucket = (key: string, customerId: number | null, doc: any) => {
        if (!customerMap.has(key)) {
          customerMap.set(key, {
            customerId,
            customerName: key,
            current: 0, days31_60: 0, days61_90: 0, days91_120: 0, over120: 0, total: 0,
            invoices: [],
          });
        }
        const bucket = customerMap.get(key)!;
        const amount = parseFloat(doc.totalAmount) || 0;
        if (doc.daysOutstanding <= 30) bucket.current += amount;
        else if (doc.daysOutstanding <= 60) bucket.days31_60 += amount;
        else if (doc.daysOutstanding <= 90) bucket.days61_90 += amount;
        else if (doc.daysOutstanding <= 120) bucket.days91_120 += amount;
        else bucket.over120 += amount;
        bucket.total += amount;
        bucket.invoices.push(doc);
      }

      for (const inv of tivData) {
        const invDate = new Date(inv.taxInvoiceDate + "T00:00:00").getTime();
        const daysOutstanding = Math.floor((asOfMs - invDate) / (1000 * 60 * 60 * 24));
        const key = inv.customerName || "ไม่ระบุ";
        addToARBucket(key, inv.customerId, {
          id: inv.id, docType: "TIV",
          taxInvoiceNo: inv.taxInvoiceNo, docNo: inv.taxInvoiceNo,
          taxInvoiceDate: inv.taxInvoiceDate, docDate: inv.taxInvoiceDate,
          totalAmount: inv.totalAmount, daysOutstanding,
        });
      }

      for (const inv of ivData) {
        const invDate = new Date(inv.invoiceDate + "T00:00:00").getTime();
        const daysOutstanding = Math.floor((asOfMs - invDate) / (1000 * 60 * 60 * 24));
        const key = inv.customerName || "ไม่ระบุ";
        addToARBucket(key, inv.customerId, {
          id: inv.id, docType: "IV",
          taxInvoiceNo: inv.invoiceNo, docNo: inv.invoiceNo,
          taxInvoiceDate: inv.invoiceDate, docDate: inv.invoiceDate,
          totalAmount: inv.totalAmount, daysOutstanding,
        });
      }

      const customers = Array.from(customerMap.values()).sort((a, b) => b.total - a.total);

      const totals = {
        current: 0, days31_60: 0, days61_90: 0, days91_120: 0, over120: 0, total: 0,
      };
      for (const c of customers) {
        totals.current += c.current;
        totals.days31_60 += c.days31_60;
        totals.days61_90 += c.days61_90;
        totals.days91_120 += c.days91_120;
        totals.over120 += c.over120;
        totals.total += c.total;
      }

      res.json({ asOfDate, customers, totals });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // AR Aging from Invoices (รายงานลูกหนี้จากใบแจ้งหนี้)
  app.get("/api/reports/ar-aging-invoices", requireAuth, requireModule("sales"), async (req, res) => {
    try {
      const companyId = Number(req.query.companyId);
      if (!companyId) return res.status(400).json({ message: "companyId required" });

      const asOfDate = (req.query.asOfDate as string) || new Date().toISOString().slice(0, 10);
      const asOfMs = new Date(asOfDate + "T00:00:00").getTime();

      const user = req.user as any;
      const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
      if (company && company.tenantId && company.tenantId !== user.tenantId) {
        return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });
      }

      const invoicesData = await db.select().from(invoices).where(
        and(
          eq(invoices.companyId, companyId),
          sql`${invoices.status} != 'cancelled'`,
          sql`COALESCE(${invoices.paymentStatus}, 'unpaid') != 'paid'`,
          sql`${invoices.invoiceDate} <= ${asOfDate}`
        )
      );

      const customerMap = new Map<string, {
        customerId: number | null;
        customerName: string;
        current: number;
        days31_60: number;
        days61_90: number;
        days91_120: number;
        over120: number;
        total: number;
        invoices: any[];
      }>();

      for (const inv of invoicesData) {
        const invDate = new Date(inv.invoiceDate + "T00:00:00").getTime();
        const daysOutstanding = Math.floor((asOfMs - invDate) / (1000 * 60 * 60 * 24));
        const amount = parseFloat(inv.totalAmount || "0") || 0;
        const key = inv.customerName || "ไม่ระบุ";

        if (!customerMap.has(key)) {
          customerMap.set(key, {
            customerId: inv.customerId,
            customerName: key,
            current: 0, days31_60: 0, days61_90: 0, days91_120: 0, over120: 0, total: 0,
            invoices: [],
          });
        }

        const bucket = customerMap.get(key)!;
        if (daysOutstanding <= 30) bucket.current += amount;
        else if (daysOutstanding <= 60) bucket.days31_60 += amount;
        else if (daysOutstanding <= 90) bucket.days61_90 += amount;
        else if (daysOutstanding <= 120) bucket.days91_120 += amount;
        else bucket.over120 += amount;
        bucket.total += amount;

        bucket.invoices.push({
          id: inv.id,
          invoiceNo: inv.invoiceNo,
          invoiceDate: inv.invoiceDate,
          dueDate: inv.dueDate,
          totalAmount: inv.totalAmount,
          withholdingTax: inv.withholdingTax,
          daysOutstanding,
        });
      }

      const customers = Array.from(customerMap.values()).sort((a, b) => b.total - a.total);

      const totals = {
        current: 0, days31_60: 0, days61_90: 0, days91_120: 0, over120: 0, total: 0,
      };
      for (const c of customers) {
        totals.current += c.current;
        totals.days31_60 += c.days31_60;
        totals.days61_90 += c.days61_90;
        totals.days91_120 += c.days91_120;
        totals.over120 += c.over120;
        totals.total += c.total;
      }

      res.json({ asOfDate, customers, totals });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // AP Aging Report (รายงานเจ้าหนี้คงค้าง)
  app.get("/api/reports/ap-aging", requireAuth, requireModule("purchases"), async (req, res) => {
    try {
      const companyId = Number(req.query.companyId);
      if (!companyId) return res.status(400).json({ message: "companyId required" });

      const asOfDate = (req.query.asOfDate as string) || new Date().toISOString().slice(0, 10);
      const asOfMs = new Date(asOfDate + "T00:00:00").getTime();

      const user = req.user as any;
      const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
      if (company && company.tenantId && company.tenantId !== user.tenantId) {
        return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });
      }

      const piData = await db.select().from(purchaseInvoices).where(
        and(
          eq(purchaseInvoices.companyId, companyId),
          sql`${purchaseInvoices.status} != 'cancelled'`,
          sql`COALESCE(${purchaseInvoices.paymentStatus}, 'unpaid') != 'paid'`,
          sql`${purchaseInvoices.apDate} <= ${asOfDate}`
        )
      );

      const expData = await db.select().from(expenses).where(
        and(
          eq(expenses.companyId, companyId),
          sql`${expenses.status} != 'cancelled'`,
          sql`COALESCE(${expenses.paymentStatus}, 'unpaid') != 'paid'`,
          sql`${expenses.expDate} <= ${asOfDate}`
        )
      );

      const vendorMap = new Map<string, {
        vendorName: string;
        current: number;
        days31_60: number;
        days61_90: number;
        days91_120: number;
        over120: number;
        total: number;
        documents: any[];
      }>();

      const addToBucket = (key: string, vendorName: string, doc: any) => {
        if (!vendorMap.has(key)) {
          vendorMap.set(key, {
            vendorName: key,
            current: 0, days31_60: 0, days61_90: 0, days91_120: 0, over120: 0, total: 0,
            documents: [],
          });
        }
        const bucket = vendorMap.get(key)!;
        const amount = parseFloat(doc.totalAmount) || 0;
        if (doc.daysOutstanding <= 30) bucket.current += amount;
        else if (doc.daysOutstanding <= 60) bucket.days31_60 += amount;
        else if (doc.daysOutstanding <= 90) bucket.days61_90 += amount;
        else if (doc.daysOutstanding <= 120) bucket.days91_120 += amount;
        else bucket.over120 += amount;
        bucket.total += amount;
        bucket.documents.push(doc);
      }

      for (const pi of piData) {
        const docDate = new Date(pi.apDate + "T00:00:00").getTime();
        const daysOutstanding = Math.floor((asOfMs - docDate) / (1000 * 60 * 60 * 24));
        const key = pi.vendorName || "ไม่ระบุ";
        addToBucket(key, key, {
          id: pi.id,
          docNo: pi.apNo,
          docDate: pi.apDate,
          docType: "purchase_invoice",
          totalAmount: pi.totalAmount,
          daysOutstanding,
        });
      }

      for (const exp of expData) {
        const docDate = new Date(exp.expDate + "T00:00:00").getTime();
        const daysOutstanding = Math.floor((asOfMs - docDate) / (1000 * 60 * 60 * 24));
        const key = exp.vendorName || "ไม่ระบุ";
        addToBucket(key, key, {
          id: exp.id,
          docNo: exp.expNo,
          docDate: exp.expDate,
          docType: "expense",
          totalAmount: exp.totalAmount,
          daysOutstanding,
        });
      }

      const vendors = Array.from(vendorMap.values()).sort((a, b) => b.total - a.total);

      const totals = {
        current: 0, days31_60: 0, days61_90: 0, days91_120: 0, over120: 0, total: 0,
      };
      for (const v of vendors) {
        totals.current += v.current;
        totals.days31_60 += v.days31_60;
        totals.days61_90 += v.days61_90;
        totals.days91_120 += v.days91_120;
        totals.over120 += v.over120;
        totals.total += v.total;
      }

      res.json({ asOfDate, vendors, totals });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

}
