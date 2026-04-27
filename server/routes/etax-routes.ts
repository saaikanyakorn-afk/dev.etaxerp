import type { Express } from "express";
import { z } from "zod";
import { db } from "../db";
import { companies, taxInvoices, taxInvoiceItems, contacts } from "@shared/schema";
import { eq, and, isNotNull, gte, lte, sql, desc } from "drizzle-orm";
import { requireAuth } from "../route-middleware";
import { generateEtaxXml, type EtaxInvoiceData, type EtaxLineItem } from "@shared/etax-xml";
import { convertToPdfA3, getDocumentTypeFromInvoice } from "../etax-pdf-a3";
import { generatePdfMake } from "../pdf-pdfmake-generator";
import { buildPdfDataById } from "../pdf-data-fetcher";

function parseDateToBE(dateVal: string | Date | null | undefined): string {
  const s = dateVal ? String(dateVal) : "";
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const dd = m[3];
    const mm = m[2];
    const yyyy = Number(m[1]) + 543;
    return `${dd}${mm}${yyyy}`;
  }
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}${String(d.getMonth() + 1).padStart(2, "0")}${d.getFullYear() + 543}`;
}

const etaxSettingsSchema = z.object({
  companyId: z.number(),
  etaxEnabled: z.boolean(),
  etaxEmail: z.string().max(255).optional(),
  etaxTimestampEmail: z.string().max(255).optional(),
  etaxBuyerTestEmail: z.string().max(255).optional(),
  sellerTaxIdType: z.enum(["TXID", "NIDN"]).optional(),
  sellerBranchId: z.string().max(5).optional(),
  sellerBuildingName: z.string().max(255).optional(),
  sellerBuildingNumber: z.string().max(100).optional(),
  sellerPostcode: z.string().max(5).optional(),
  sellerDistrictCode: z.string().max(10).optional(),
  sellerSubdistrictCode: z.string().max(10).optional(),
  sellerProvinceCode: z.string().max(5).optional(),
  etaxEmailProvider: z.enum(["resend", "gmail", "smtp"]).optional(),
  smtpHost: z.string().max(255).optional(),
  smtpPort: z.number().optional(),
  smtpUser: z.string().max(255).optional(),
  smtpPass: z.string().max(255).optional(),
  smtpSecure: z.boolean().optional(),
});

function checkCompanyAccess(company: any, user: any): boolean {
  if (!user.tenantId) return true;
  if (!company.tenantId) return true;
  return company.tenantId === user.tenantId;
}

export function registerEtaxRoutes(app: Express) {
  app.get("/api/thai-addresses", async (_req, res) => {
    try {
      const path = await import("path");
      const fs = await import("fs");
      const dataPath = path.join(process.cwd(), "server/data/thai-addresses.json");
      const data = fs.readFileSync(dataPath, "utf8");
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.setHeader("Content-Type", "application/json");
      res.send(data);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to load address data" });
    }
  });

  app.get("/api/etax/settings", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const companyId = Number(req.query.companyId);
      if (!companyId) return res.status(400).json({ message: "companyId is required" });

      const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
      if (!company) return res.status(404).json({ message: "Company not found" });
      if (!checkCompanyAccess(company, user)) {
        return res.status(403).json({ message: "ไม่มีสิทธิ์" });
      }

      res.json({
        etaxEnabled: company.etaxEnabled,
        etaxEmail: company.etaxEmail || "",
        etaxTimestampEmail: company.etaxTimestampEmail || "csemail@etax.teda.th",
        etaxBuyerTestEmail: company.etaxBuyerTestEmail || "",
        sellerTaxIdType: (company as any).sellerTaxIdType || "TXID",
        sellerBranchId: company.sellerBranchId || "00000",
        sellerBuildingName: company.sellerBuildingName || "",
        sellerBuildingNumber: company.sellerBuildingNumber || "",
        sellerPostcode: company.sellerPostcode || "",
        sellerDistrictCode: company.sellerDistrictCode || "",
        sellerSubdistrictCode: company.sellerSubdistrictCode || "",
        sellerProvinceCode: company.sellerProvinceCode || "",
        etaxEmailProvider: company.etaxEmailProvider || "resend",
        smtpHost: company.smtpHost || "",
        smtpPort: company.smtpPort || 587,
        smtpUser: company.smtpUser || "",
        smtpPass: company.smtpPass ? "••••••••" : "",
        smtpSecure: company.smtpSecure ?? true,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/etax/settings", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const parsed = etaxSettingsSchema.parse(req.body);
      const { companyId, etaxEnabled, etaxEmail, etaxTimestampEmail, etaxBuyerTestEmail, sellerTaxIdType, sellerBranchId, sellerBuildingName, sellerBuildingNumber, sellerPostcode, sellerDistrictCode, sellerSubdistrictCode, sellerProvinceCode, etaxEmailProvider, smtpHost, smtpPort, smtpUser, smtpPass, smtpSecure } = parsed as any;

      const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
      if (!company) return res.status(404).json({ message: "Company not found" });
      if (!checkCompanyAccess(company, user)) {
        return res.status(403).json({ message: "ไม่มีสิทธิ์" });
      }

      const updateData: any = {
        etaxEnabled: !!etaxEnabled,
        etaxEmail: etaxEmail || null,
        etaxTimestampEmail: etaxTimestampEmail || "csemail@etax.teda.th",
        etaxBuyerTestEmail: etaxBuyerTestEmail || null,
        sellerTaxIdType: sellerTaxIdType || "TXID",
        sellerBranchId: sellerBranchId || "00000",
        sellerBuildingName: sellerBuildingName || null,
        sellerBuildingNumber: sellerBuildingNumber || null,
        sellerPostcode: sellerPostcode || null,
        sellerDistrictCode: sellerDistrictCode || null,
        sellerSubdistrictCode: sellerSubdistrictCode || null,
        sellerProvinceCode: sellerProvinceCode || null,
        etaxEmailProvider: etaxEmailProvider || "resend",
        smtpHost: smtpHost || null,
        smtpPort: smtpPort || 587,
        smtpSecure: smtpSecure ?? true,
      };
      if (smtpUser !== undefined) updateData.smtpUser = smtpUser || null;
      if (smtpPass && !smtpPass.startsWith("••••")) updateData.smtpPass = smtpPass;
      if (smtpPass === "") updateData.smtpPass = null;

      await db.update(companies).set(updateData).where(eq(companies.id, companyId));

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/etax/generate-xml", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const { taxInvoiceId, companyId, printType: rawPT } = req.body;
      if (!taxInvoiceId || !companyId) return res.status(400).json({ message: "taxInvoiceId and companyId are required" });

      const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
      if (!company) return res.status(404).json({ message: "Company not found" });
      if (!checkCompanyAccess(company, user)) {
        return res.status(403).json({ message: "ไม่มีสิทธิ์" });
      }

      const validPTs = ["tax_invoice", "tax_invoice_receipt", "receipt"];
      const printType = rawPT && validPTs.includes(rawPT) ? rawPT : undefined;

      const { tiv, data } = await buildEtaxDataFromInvoice(taxInvoiceId, companyId, printType);
      const xml = generateEtaxXml(data);
      const filename = `${tiv.taxInvoiceNo || "etax"}.xml`;

      res.json({ xml, filename, data });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/etax/test-xml", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const { companyId } = req.body;
      if (!companyId) return res.status(400).json({ message: "companyId is required" });

      const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
      if (!company) return res.status(404).json({ message: "Company not found" });
      if (!checkCompanyAccess(company, user)) {
        return res.status(403).json({ message: "ไม่มีสิทธิ์" });
      }

      const sampleData: EtaxInvoiceData = {
        documentType: "TaxInvoice",
        typeCode: "388",
        documentNo: "TIV-TEST-001",
        documentDate: new Date().toISOString(),
        sellerName: company.name,
        sellerTaxId: company.taxId || "0000000000000",
        sellerBranchId: company.sellerBranchId || "00000",
        sellerAddress: company.address || "ที่อยู่บริษัท",
        sellerPostcode: company.sellerPostcode || "10000",
        sellerBuildingName: company.sellerBuildingName || "",
        sellerBuildingNumber: company.sellerBuildingNumber || "1",
        sellerPhone: company.phone || "",
        sellerEmail: company.etaxEmail || company.email || "",
        sellerDistrictCode: company.sellerDistrictCode || "1001",
        sellerSubdistrictCode: company.sellerSubdistrictCode || "100101",
        sellerProvinceCode: company.sellerProvinceCode || "10",
        buyerName: "บริษัท ทดสอบ จำกัด",
        buyerTaxId: "0000000000001",
        buyerBranchId: "00000",
        buyerAddress: "123 ถ.ทดสอบ แขวงทดสอบ เขตทดสอบ กรุงเทพฯ",
        buyerPostcode: "10100",
        buyerBuildingNumber: "123",
        buyerDistrictCode: "1001",
        buyerSubdistrictCode: "100101",
        buyerProvinceCode: "10",
        currencyCode: "THB",
        items: [
          {
            lineNo: 1,
            productCode: "SRV-001",
            productName: "ค่าบริการทางด้านบัญชี",
            qty: 1,
            unit: "บริการ",
            unitPrice: 15000,
            discount: 0,
            total: 15000,
            vatRate: 7,
            vatAmount: 1050,
          },
        ],
        subtotal: 15000,
        discountAmount: 0,
        vatRate: 7,
        vatAmount: 1050,
        totalAmount: 16050,
      };

      const xml = generateEtaxXml(sampleData);
      const filename = `${company.name.replace(/[^a-zA-Z0-9ก-๙]/g, "_")}_test_etax.xml`;

      res.json({ xml, filename });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/etax/email-subject", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const { taxInvoiceId, companyId } = req.body;
      if (!taxInvoiceId || !companyId) return res.status(400).json({ message: "taxInvoiceId and companyId required" });

      const [company] = await db.select().from(companies).where(eq(companies.id, Number(companyId)));
      if (!company || !checkCompanyAccess(company, user)) {
        return res.status(403).json({ message: "ไม่มีสิทธิ์" });
      }

      const [tiv] = await db.select().from(taxInvoices).where(
        and(eq(taxInvoices.id, taxInvoiceId), eq(taxInvoices.companyId, Number(companyId)))
      );
      if (!tiv) return res.status(404).json({ message: "Tax invoice not found" });

      const dateStr = parseDateToBE(tiv.taxInvoiceDate);

      let subject = "";
      if (tiv.isDebitNote) {
        subject = `[${dateStr}][DBN][${tiv.taxInvoiceNo}]${tiv.originalTaxInvoiceNo ? `[${tiv.originalTaxInvoiceNo}]` : ""}`;
      } else if (tiv.isCreditNote) {
        subject = `[${dateStr}][CRN][${tiv.taxInvoiceNo}]${tiv.originalTaxInvoiceNo ? `[${tiv.originalTaxInvoiceNo}]` : ""}`;
      } else {
        subject = `[${dateStr}][INV][${tiv.taxInvoiceNo}]`;
      }

      res.json({ subject, documentNo: tiv.taxInvoiceNo, documentDate: dateStr });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  function resolveTypeCode(
    tiv: { isDebitNote?: boolean | null; isCreditNote?: boolean | null },
    printType?: string
  ): "388" | "T02" | "T03" | "T04" | "80" | "81" {
    if (tiv.isDebitNote) return "80";
    if (tiv.isCreditNote) return "81";
    if (printType === "tax_invoice_receipt") return "T03";
    return "388";
  }

  async function buildEtaxDataFromInvoice(taxInvoiceId: number, companyId: number, printType?: string) {
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
    if (!company) throw new Error("Company not found");

    const [tiv] = await db.select().from(taxInvoices).where(
      and(eq(taxInvoices.id, taxInvoiceId), eq(taxInvoices.companyId, companyId))
    );
    if (!tiv) throw new Error("Tax invoice not found");

    const items = await db.select().from(taxInvoiceItems).where(eq(taxInvoiceItems.taxInvoiceId, taxInvoiceId));

    let buyerPostcode = "";
    let buyerBuildingName = "";
    let buyerBuildingNumber = "";
    let buyerBranchId = "00000";
    let buyerPhone = "";
    let buyerEmail = "";
    let buyerDistrictCode = "";
    let buyerSubdistrictCode = "";
    let buyerProvinceCode = "";
    if (tiv.customerId) {
      const [contact] = await db.select().from(contacts).where(eq(contacts.id, tiv.customerId));
      if (contact) {
        buyerPostcode = contact.postcode || "";
        buyerBuildingName = (contact as any).buildingName || "";
        buyerBuildingNumber = contact.buildingNumber || "";
        buyerBranchId = (contact as any).branch || "00000";
        buyerPhone = contact.phone || "";
        buyerEmail = tiv.contactEmail || "";
        buyerDistrictCode = contact.districtCode || "";
        buyerSubdistrictCode = contact.subdistrictCode || "";
        buyerProvinceCode = contact.provinceCode || "";
      }
    }

    const documentType = getDocumentTypeFromInvoice(tiv);
    const typeCode = resolveTypeCode(tiv, printType);

    const etaxItems: EtaxLineItem[] = items.map((item, idx) => {
      const qty = parseFloat(String(item.qty || "1"));
      const unitPrice = parseFloat(String(item.unitPrice || "0"));
      const total = parseFloat(String(item.total || "0"));
      const vatRate = item.vatType === "vat7" ? 7 : 0;
      const vatAmt = vatRate > 0 ? total * vatRate / 100 : 0;
      return {
        lineNo: idx + 1,
        productCode: (item as any).productCode || "",
        productName: (item as any).productName || `รายการ ${idx + 1}`,
        qty, unit: (item as any).unit || "ชิ้น",
        unitPrice,
        discount: parseFloat(String((item as any).discount || "0")),
        total, vatRate, vatAmount: vatAmt,
      };
    });

    const data: EtaxInvoiceData = {
      documentType, typeCode,
      documentNo: tiv.taxInvoiceNo || "",
      documentDate: tiv.taxInvoiceDate ? String(tiv.taxInvoiceDate) : new Date().toISOString(),
      sellerName: company.name,
      sellerTaxId: company.taxId || "",
      sellerTaxIdType: (company as any).sellerTaxIdType || "TXID",
      sellerBranchId: company.sellerBranchId || "00000",
      sellerAddress: company.address || "",
      sellerPostcode: company.sellerPostcode || "",
      sellerBuildingName: company.sellerBuildingName || "",
      sellerBuildingNumber: company.sellerBuildingNumber || "",
      sellerPhone: company.phone || "",
      sellerEmail: company.etaxEmail || company.email || "",
      sellerDistrictCode: company.sellerDistrictCode || "",
      sellerSubdistrictCode: company.sellerSubdistrictCode || "",
      sellerProvinceCode: company.sellerProvinceCode || "",
      sellerCountryCode: "TH",
      buyerName: tiv.customerName || "",
      buyerTaxId: tiv.customerTaxId || "",
      buyerTaxIdType: ((tiv as any).customerTaxIdType || "TXID") as any,
      buyerCountryCode: (tiv as any).customerCountryCode || "TH",
      buyerBranchId, buyerAddress: tiv.customerAddress || "",
      buyerPostcode, buyerBuildingName, buyerBuildingNumber,
      buyerPhone, buyerEmail,
      buyerDistrictCode, buyerSubdistrictCode, buyerProvinceCode,
      currencyCode: (tiv as any).currencyCode || "THB",
      items: etaxItems,
      subtotal: parseFloat(String(tiv.subtotal || "0")),
      discountAmount: parseFloat(String(tiv.discountAmount || "0")),
      vatRate: 7,
      vatAmount: parseFloat(String(tiv.vatAmount || "0")),
      totalAmount: parseFloat(String(tiv.totalAmount || "0")),
      withholdingTax: parseFloat(String(tiv.withholdingTax || "0")),
      originalDocumentNo: tiv.originalTaxInvoiceNo || undefined,
    };

    return { company, tiv, data, documentType };
  }

  app.post("/api/etax/debug-xml", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const { taxInvoiceId, companyId } = req.body;
      if (!taxInvoiceId || !companyId) return res.status(400).json({ message: "taxInvoiceId and companyId are required" });

      const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
      if (!company) return res.status(404).json({ message: "Company not found" });
      if (!checkCompanyAccess(company, user)) {
        return res.status(403).json({ message: "ไม่มีสิทธิ์" });
      }

      const { data } = await buildEtaxDataFromInvoice(taxInvoiceId, companyId);
      const xml = generateEtaxXml(data);

      res.setHeader("Content-Type", "application/xml; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="ETDA-invoice-debug.xml"`);
      res.send(xml);
    } catch (err: any) {
      console.error("e-Tax debug XML error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/etax/generate-pdf", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const { taxInvoiceId, companyId, printType: rawPT } = req.body;
      if (!taxInvoiceId || !companyId) return res.status(400).json({ message: "taxInvoiceId and companyId are required" });

      const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
      if (!company) return res.status(404).json({ message: "Company not found" });
      if (!checkCompanyAccess(company, user)) {
        return res.status(403).json({ message: "ไม่มีสิทธิ์" });
      }

      const validPTs = ["tax_invoice", "tax_invoice_receipt", "receipt"];
      const printType = rawPT && validPTs.includes(rawPT) ? rawPT : undefined;
      const { tiv, data, documentType } = await buildEtaxDataFromInvoice(taxInvoiceId, companyId, printType);

      const xml = generateEtaxXml(data);
      const xmlFileName = "ETDA-invoice.xml";

      const pdfOpts = await buildPdfDataById("tax_invoice", taxInvoiceId, printType);
      const pdfBuffer = await generatePdfMake(pdfOpts);

      const pdfA3Buffer = await convertToPdfA3(pdfBuffer, xml, xmlFileName, documentType);

      const filename = `${tiv.taxInvoiceNo || "etax"}_PDFA3.pdf`;
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
      res.send(pdfA3Buffer);
    } catch (err: any) {
      console.error("e-Tax PDF/A-3 generation error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/etax/send-email", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const { taxInvoiceId, companyId, printType: rawPrintType } = req.body;
      if (!taxInvoiceId || !companyId) return res.status(400).json({ message: "taxInvoiceId and companyId are required" });
      const validPrintTypes = ["tax_invoice", "tax_invoice_receipt", "receipt"];
      const printType = validPrintTypes.includes(rawPrintType) ? rawPrintType : undefined;

      const [comp] = await db.select().from(companies).where(eq(companies.id, companyId));
      if (!comp) return res.status(404).json({ message: "Company not found" });
      if (!checkCompanyAccess(comp, user)) {
        return res.status(403).json({ message: "ไม่มีสิทธิ์" });
      }
      if (!comp.etaxEnabled) {
        return res.status(400).json({ message: "e-Tax Invoice ยังไม่เปิดใช้งาน" });
      }

      if (!comp.etaxTimestampEmail) {
        return res.status(400).json({ message: "ยังไม่ได้ตั้งค่าอีเมล TEDA (Timestamp Email) ในหน้าตั้งค่า e-Tax Invoice" });
      }
      const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      if (!isValidEmail(comp.etaxTimestampEmail)) {
        return res.status(400).json({ message: `รูปแบบอีเมล TEDA ไม่ถูกต้อง "${comp.etaxTimestampEmail}" กรุณาแก้ไขในหน้าตั้งค่า e-Tax Invoice` });
      }
      const timestampEmail = comp.etaxTimestampEmail;

      const { tiv, data, documentType } = await buildEtaxDataFromInvoice(taxInvoiceId, companyId, printType);

      if (!data.buyerEmail) {
        return res.status(400).json({ message: "ไม่พบอีเมลลูกค้าในเอกสาร กรุณากรอกอีเมลลูกค้าในหน้าแก้ไขเอกสารก่อนส่ง e-Tax", errorCode: "MISSING_BUYER_EMAIL" });
      }
      if (!isValidEmail(data.buyerEmail)) {
        return res.status(400).json({ message: `รูปแบบอีเมลลูกค้าไม่ถูกต้อง "${data.buyerEmail}" กรุณาแก้ไขในหน้าแก้ไขเอกสารก่อนส่ง e-Tax`, errorCode: "INVALID_BUYER_EMAIL" });
      }

      const debugLogs: string[] = [];
      const dlog = (msg: string) => { console.log(msg); debugLogs.push(msg); };

      const xml = generateEtaxXml(data);
      const xmlFileName = "ETDA-invoice.xml";
      dlog(`[XML] taxInvoiceNo: "${tiv.taxInvoiceNo}" | to: "${timestampEmail}"`);

      const pdfOpts = await buildPdfDataById("tax_invoice", taxInvoiceId, printType);
      const pdfBuffer = await generatePdfMake(pdfOpts);
      dlog(`[PDF] pdfmake: ${pdfBuffer.length} bytes`);
      const pdfA3Buffer = await convertToPdfA3(pdfBuffer, xml, xmlFileName, documentType);
      dlog(`[PDF] PDF/A-3: ${pdfA3Buffer.length} bytes`);

      const dateStr = parseDateToBE(tiv.taxInvoiceDate);

      const SUBJECT_PREFIX: Record<string, string> = {
        "388": "INV", "T02": "INV", "T03": "INV", "T04": "INV",
        "80": "DBN", "81": "CRN",
      };
      if (!(data.typeCode in SUBJECT_PREFIX)) {
        throw new Error(`typeCode ไม่รู้จัก "${data.typeCode}" — ไม่สามารถสร้าง subject ได้`);
      }
      const subjectPrefix = SUBJECT_PREFIX[data.typeCode];

      if (!tiv.taxInvoiceNo) {
        throw new Error("ไม่พบเลขที่เอกสาร (taxInvoiceNo) — ไม่สามารถส่งได้");
      }
      const subject = `[${dateStr}][${subjectPrefix}][${tiv.taxInvoiceNo}]${tiv.originalTaxInvoiceNo ? `[${tiv.originalTaxInvoiceNo}]` : ""}`;

      const pdfFilename = `${tiv.taxInvoiceNo}.pdf`;

      const DOC_LABEL: Record<string, string> = {
        "388": "ใบกำกับภาษี", "T02": "ใบแจ้งหนี้/ใบกำกับภาษี",
        "T03": "ใบเสร็จรับเงิน/ใบกำกับภาษี", "T04": "ใบส่งของ/ใบกำกับภาษี",
        "80": "ใบเพิ่มหนี้", "81": "ใบลดหนี้",
      };
      if (!(data.typeCode in DOC_LABEL)) {
        throw new Error(`typeCode ไม่รู้จัก "${data.typeCode}" — ไม่สามารถสร้างเนื้อหาอีเมลได้`);
      }
      const docTypeLabel = DOC_LABEL[data.typeCode];

      const htmlBody = `
        <div style="font-family: 'Sarabun', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #fb9678; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0;">e-Tax Invoice Submission</h2>
            <p style="margin: 5px 0 0; opacity: 0.9;">${comp.name}</p>
          </div>
          <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <p>ส่ง${docTypeLabel}อิเล็กทรอนิกส์เพื่อประทับเวลา</p>
            <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
              <tr><td style="padding: 6px 0; color: #666;">ประเภทเอกสาร:</td><td style="padding: 6px 0; font-weight: 600;">${docTypeLabel}</td></tr>
              <tr><td style="padding: 6px 0; color: #666;">เลขที่เอกสาร:</td><td style="padding: 6px 0; font-weight: 600;">${tiv.taxInvoiceNo}</td></tr>
              <tr><td style="padding: 6px 0; color: #666;">จำนวนเงินรวม:</td><td style="padding: 6px 0; font-weight: 600;">฿${parseFloat(String(tiv.totalAmount || "0")).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td></tr>
            </table>
            <p style="font-size: 13px; color: #888;">ไฟล์แนบ: ${pdfFilename} (PDF/A-3 พร้อม XML ตามมาตรฐาน สพธอ.)</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 15px 0;">
            <p style="font-size: 12px; color: #999;">
              เอกสารนี้จัดทำและส่งข้อมูลให้แก่กรมสรรพากรด้วยวิธีการทางอิเล็กทรอนิกส์<br>
              ตามประกาศอธิบดีกรมสรรพากร
            </p>
          </div>
        </div>
      `;

      const validProviders = ["resend", "gmail", "smtp"] as const;
      type EmailProvider = typeof validProviders[number];
      if (!comp.etaxEmailProvider) {
        return res.status(400).json({ message: "ยังไม่ได้ตั้งค่าผู้ให้บริการอีเมล (Email Provider) ในหน้าตั้งค่า e-Tax Invoice" });
      }
      if (!validProviders.includes(comp.etaxEmailProvider as EmailProvider)) {
        throw new Error(`Email Provider ไม่รู้จัก "${comp.etaxEmailProvider}" — ค่าที่รองรับ: ${validProviders.join(", ")}`);
      }
      const provider = comp.etaxEmailProvider as EmailProvider;
      let messageId: string | null = null;

      if (provider === "gmail" || provider === "smtp") {
        if (!comp.smtpUser || !comp.smtpPass) {
          return res.status(400).json({ message: "ยังไม่ได้ตั้งค่า SMTP Email/Password ในหน้าตั้งค่า e-Tax Invoice" });
        }
        if (provider === "smtp" && !comp.smtpHost) {
          return res.status(400).json({ message: "ยังไม่ได้ตั้งค่า SMTP Host ในหน้าตั้งค่า e-Tax Invoice" });
        }
        const nodemailer = await import("nodemailer");
        const smtpConfig: any = {
          host: provider === "gmail" ? "smtp.gmail.com" : comp.smtpHost,
          port: provider === "gmail" ? 587 : (comp.smtpPort || 587),
          secure: false,
          auth: { user: comp.smtpUser, pass: comp.smtpPass },
        };
        const transporter = nodemailer.default.createTransport(smtpConfig);
        const mailOptions: any = {
          from: `"${comp.name}" <${comp.smtpUser}>`,
          to: timestampEmail,
          cc: data.buyerEmail,
          subject,
          html: htmlBody,
          attachments: [{ filename: pdfFilename, content: pdfA3Buffer, contentType: "application/pdf" }],
        };
        const info = await transporter.sendMail(mailOptions);
        messageId = info.messageId || null;
        dlog(`[EMAIL] SMTP sent | to: ${timestampEmail} | cc: ${data.buyerEmail} | msgId: ${messageId}`);
      } else {
        if (!process.env.RESEND_API_KEY) {
          return res.status(400).json({ message: "ยังไม่ได้ตั้งค่า RESEND_API_KEY" });
        }
        const { Resend } = await import("resend");
        const resend = new Resend(process.env.RESEND_API_KEY);
        const rawFrom = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
        const isTestEmail = rawFrom.includes("onboarding@resend.dev");
        const fromEmail = rawFrom.includes("<") ? rawFrom : (isTestEmail ? rawFrom : `${comp.name.slice(0, 200)} <${rawFrom}>`);
        const emailPayload: any = {
          from: fromEmail,
          to: [timestampEmail],
          cc: data.buyerEmail ? [data.buyerEmail] : undefined,
          subject,
          html: htmlBody,
          attachments: [{ filename: pdfFilename, content: pdfA3Buffer.toString("base64") }],
        };
        const sendResult = await resend.emails.send(emailPayload) as any;
        if (sendResult?.error || !sendResult?.data?.id) {
          const errMsg = sendResult?.error?.message || "ส่งอีเมลไม่สำเร็จ (Resend error)";
          dlog(`[EMAIL] Resend error: ${errMsg}`);
          return res.status(500).json({ message: errMsg, debugInfo: debugLogs });
        }
        messageId = sendResult.data.id;
        dlog(`[EMAIL] Resend sent | to: ${timestampEmail} | cc: ${data.buyerEmail} | msgId: ${messageId}`);
      }

      await db.update(taxInvoices).set({
        etaxSentAt: new Date(),
        etaxSentTo: timestampEmail,
        etaxSentCc: data.buyerEmail || null,
        etaxMessageId: messageId,
      }).where(eq(taxInvoices.id, taxInvoiceId));

      res.json({
        success: true,
        provider,
        to: timestampEmail,
        subject,
        messageId,
        debugInfo: debugLogs,
      });
    } catch (err: any) {
      console.error("e-Tax email error:", err);
      res.status(500).json({ message: err.message, debugInfo: [`[ERROR] ${err.message}`] });
    }
  });

  app.get("/api/etax/sent-list", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const companyId = Number(req.query.companyId);
      if (!companyId) return res.status(400).json({ message: "companyId required" });

      const [comp] = await db.select().from(companies).where(eq(companies.id, companyId));
      if (!comp || !checkCompanyAccess(comp, user)) return res.status(403).json({ message: "ไม่มีสิทธิ์" });

      const conditions = [
        eq(taxInvoices.companyId, companyId),
        isNotNull(taxInvoices.etaxSentAt),
      ];

      const fromDate = req.query.fromDate ? String(req.query.fromDate) : null;
      const toDate = req.query.toDate ? String(req.query.toDate) : null;
      if (fromDate) conditions.push(gte(taxInvoices.etaxSentAt, new Date(fromDate)));
      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        conditions.push(lte(taxInvoices.etaxSentAt, end));
      }

      const rows = await db
        .select({
          id: taxInvoices.id,
          taxInvoiceNo: taxInvoices.taxInvoiceNo,
          taxInvoiceDate: taxInvoices.taxInvoiceDate,
          customerName: taxInvoices.customerName,
          customerTaxId: taxInvoices.customerTaxId,
          totalAmount: taxInvoices.totalAmount,
          vatAmount: taxInvoices.vatAmount,
          subtotal: taxInvoices.subtotal,
          etaxSentAt: taxInvoices.etaxSentAt,
          etaxSentTo: taxInvoices.etaxSentTo,
          etaxSentCc: taxInvoices.etaxSentCc,
          etaxMessageId: taxInvoices.etaxMessageId,
          isDebitNote: taxInvoices.isDebitNote,
          isCreditNote: taxInvoices.isCreditNote,
          status: taxInvoices.status,
        })
        .from(taxInvoices)
        .where(and(...conditions))
        .orderBy(desc(taxInvoices.etaxSentAt));

      const totalSent = rows.length;
      const totalAmount = rows.reduce((sum, r) => sum + parseFloat(String(r.totalAmount || "0")), 0);
      const totalVat = rows.reduce((sum, r) => sum + parseFloat(String(r.vatAmount || "0")), 0);
      const uniqueRecipients = new Set(rows.map(r => r.etaxSentTo).filter(Boolean)).size;

      res.json({
        rows,
        summary: {
          totalSent,
          totalAmount: totalAmount.toFixed(2),
          totalVat: totalVat.toFixed(2),
          uniqueRecipients,
        },
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}
