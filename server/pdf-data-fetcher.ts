import { db } from "./db";
import { eq, and } from "drizzle-orm";
import {
  companies, taxInvoices, taxInvoiceItems, invoices, invoiceItems,
  quotations, quotationItems, salesOrders, salesOrderItems,
  receipts, receiptItems, purchaseInvoices, purchaseInvoiceItems,
  expenses, expenseItems, documentSettings, contacts,
  purchaseRequests, purchaseRequestItems, purchaseOrders, purchaseOrderItems,
  billingNotes, billingNoteLinkedDocs,
} from "@shared/schema";
import { storage } from "./storage";
import type { GeneratePdfOptions, PdfCompany, PdfSettings, PdfDocumentData, PdfLineItem, PdfSignature } from "./pdf-react-generator";
import * as fs from "fs";
import * as path from "path";

/**
 * Image cache for PDF generation (added 2026-03-31).
 * Prevents re-fetching the same logo/QR/signature for every PDF request.
 * TTL 5 minutes, max 50 entries with time-based eviction.
 * Impact: 20 requests for same company = 1 fetch instead of 20.
 */
const imageCache = new Map<string, { data: string | null; ts: number }>();
const IMAGE_CACHE_TTL = 5 * 60 * 1000;

function objectPathToUrl(objectPath: string | null | undefined): string {
  if (!objectPath) return "";
  const match = objectPath.match(/\/objects\/uploads\/(.+)/);
  if (match) return `/api/file/${match[1]}`;
  if (objectPath.startsWith("/api/")) return objectPath;
  return objectPath;
}

function isSafeUrl(urlStr: string): boolean {
  try {
    const u = new URL(urlStr);
    const host = u.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "::1") return true;
    if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(host)) return false;
    if (host.endsWith(".internal") || host === "metadata.google.internal") return false;
    if (host === "169.254.169.254") return false;
    return true;
  } catch {
    return false;
  }
}

async function fetchImageAsBase64(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  try {
    if (url.startsWith("data:")) return url;

    const cached = imageCache.get(url);
    if (cached && Date.now() - cached.ts < IMAGE_CACHE_TTL) return cached.data;

    let result: string | null = null;

    if (url.startsWith("/")) {
      const fullUrl = `http://localhost:${process.env.PORT || 5000}${url}`;
      const resp = await fetch(fullUrl, { signal: AbortSignal.timeout(5000) });
      if (resp.ok) {
        const buf = Buffer.from(await resp.arrayBuffer());
        const ct = resp.headers.get("content-type") || "image/png";
        result = `data:${ct};base64,${buf.toString("base64")}`;
      }
    } else if (url.startsWith("http")) {
      if (!isSafeUrl(url)) return null;
      const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (resp.ok) {
        const buf = Buffer.from(await resp.arrayBuffer());
        const ct = resp.headers.get("content-type") || "image/png";
        result = `data:${ct};base64,${buf.toString("base64")}`;
      }
    }

    imageCache.set(url, { data: result, ts: Date.now() });

    if (imageCache.size > 50) {
      const now = Date.now();
      for (const [key, val] of imageCache) {
        if (now - val.ts > IMAGE_CACHE_TTL) imageCache.delete(key);
      }
    }

    return result;
  } catch {
    return null;
  }
}

function resolveObjectStorageUrl(objectPath: string | null | undefined): string | null {
  if (!objectPath) return null;
  return objectPathToUrl(objectPath) || null;
}

function loadEtaxStamp(): string | null {
  try {
    const stampPath = path.join(process.cwd(), "public/etax-stamp.png");
    if (fs.existsSync(stampPath)) {
      const buf = fs.readFileSync(stampPath);
      return `data:image/png;base64,${buf.toString("base64")}`;
    }
  } catch {}
  return null;
}

let cachedEtaxStamp: string | null | undefined = undefined;
function getEtaxStamp(): string | null {
  if (cachedEtaxStamp === undefined) cachedEtaxStamp = loadEtaxStamp();
  return cachedEtaxStamp;
}

interface DocTableConfig {
  table: any;
  itemsTable: any;
  itemsFkColumn: string;
  noField: string;
  dateField: string;
  displayDocType: string;
}

const DOC_CONFIGS: Record<string, DocTableConfig> = {
  tax_invoice: {
    table: taxInvoices, itemsTable: taxInvoiceItems, itemsFkColumn: "taxInvoiceId",
    noField: "taxInvoiceNo", dateField: "taxInvoiceDate", displayDocType: "tax_invoice",
  },
  invoice: {
    table: invoices, itemsTable: invoiceItems, itemsFkColumn: "invoiceId",
    noField: "invoiceNo", dateField: "invoiceDate", displayDocType: "invoice",
  },
  quotation: {
    table: quotations, itemsTable: quotationItems, itemsFkColumn: "quotationId",
    noField: "quotationNo", dateField: "quotationDate", displayDocType: "quotation",
  },
  sales_order: {
    table: salesOrders, itemsTable: salesOrderItems, itemsFkColumn: "salesOrderId",
    noField: "orderNo", dateField: "orderDate", displayDocType: "sales_order",
  },
  receipt: {
    table: receipts, itemsTable: receiptItems, itemsFkColumn: "receiptId",
    noField: "receiptNo", dateField: "receiptDate", displayDocType: "receipt",
  },
  purchase_invoice: {
    table: purchaseInvoices, itemsTable: purchaseInvoiceItems, itemsFkColumn: "purchaseInvoiceId",
    noField: "apNo", dateField: "apDate", displayDocType: "purchase_invoice",
  },
  expense: {
    table: expenses, itemsTable: expenseItems, itemsFkColumn: "expenseId",
    noField: "expNo", dateField: "expDate", displayDocType: "expense",
  },
  purchase_request: {
    table: purchaseRequests, itemsTable: purchaseRequestItems, itemsFkColumn: "purchaseRequestId",
    noField: "prNo", dateField: "prDate", displayDocType: "purchase_request",
  },
  purchase_order: {
    table: purchaseOrders, itemsTable: purchaseOrderItems, itemsFkColumn: "purchaseOrderId",
    noField: "poNo", dateField: "poDate", displayDocType: "purchase_order",
  },
};

function mapItemsToPdfItems(items: any[]): PdfLineItem[] {
  return items.map(item => ({
    productCode: item.productCode || "",
    productName: item.productName || item.description || "",
    description: item.description || "",
    qty: parseFloat(String(item.qty || "0")),
    unit: item.unit || "ชิ้น",
    unitPrice: parseFloat(String(item.unitPrice || "0")),
    discount: parseFloat(String(item.discount || "0")),
    discountType: item.discountType || "amount",
    total: parseFloat(String(item.total || "0")),
    vatType: item.vatType || "vat7",
  }));
}

export async function buildPdfDataById(
  docType: string,
  docId: number,
  printType?: string
): Promise<GeneratePdfOptions> {
  const cfg = DOC_CONFIGS[docType];
  if (!cfg) throw new Error(`ประเภทเอกสารไม่รองรับ: ${docType}`);

  const [doc] = await db.select().from(cfg.table).where(eq(cfg.table.id, docId));
  if (!doc) throw new Error("ไม่พบเอกสาร");

  return buildPdfDataFromDoc(doc, cfg, printType);
}

export async function buildPdfDataByToken(
  docType: string,
  token: string,
  printType?: string
): Promise<GeneratePdfOptions> {
  const cfg = DOC_CONFIGS[docType];
  if (!cfg) throw new Error(`ประเภทเอกสารไม่รองรับ: ${docType}`);

  const [doc] = await db.select().from(cfg.table).where(eq(cfg.table.shareToken, token));
  if (!doc) throw new Error("ไม่พบเอกสาร");

  return buildPdfDataFromDoc(doc, cfg, printType);
}

async function buildPdfDataFromDoc(
  doc: any,
  cfg: DocTableConfig,
  printType?: string
): Promise<GeneratePdfOptions> {
  const companyId = doc.companyId;
  const docId = doc.id;

  const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
  if (!company) throw new Error("ไม่พบบริษัท");

  const rawItems = await db.select().from(cfg.itemsTable).where(
    eq(cfg.itemsTable[cfg.itemsFkColumn], docId)
  );

  let docSetting: any = null;
  try {
    const [ds] = await db.select().from(documentSettings).where(eq(documentSettings.companyId, companyId));
    docSetting = ds || null;
  } catch {}

  let userSig: PdfSignature | null = null;
  if (doc.createdBy) {
    try {
      const u = await storage.getUser(doc.createdBy);
      if (u) {
        const sigBase64 = await fetchImageAsBase64(u.signatureUrl ? await resolveObjectStorageUrl(u.signatureUrl) : null);
        userSig = {
          signatureBase64: sigBase64,
          signatureName: u.signatureName || u.fullName,
          signatureTitle: u.signatureTitle || null,
        };
      }
    } catch {}
  }

  let logoBase64: string | null = null;
  if (docSetting?.logoUrl) {
    const logoUrl = await resolveObjectStorageUrl(docSetting.logoUrl);
    logoBase64 = await fetchImageAsBase64(logoUrl);
  }

  let qrCodeBase64: string | null = null;
  if (docSetting?.qrCodeUrl) {
    const qrUrl = await resolveObjectStorageUrl(docSetting.qrCodeUrl);
    qrCodeBase64 = await fetchImageAsBase64(qrUrl);
  }

  let promptpayQrBase64: string | null = null;
  if (docSetting?.promptpayEnabled && docSetting?.promptpayId && !docSetting?.qrCodeUrl) {
    try {
      const generatePayload = (await import("promptpay-qr")).default;
      const QRCode = (await import("qrcode")).default;
      const id = docSetting.promptpayId.replace(/[-\s]/g, "");
      const totalAmount = parseFloat(String(doc.totalAmount || "0"));
      const payload = generatePayload(id, { amount: totalAmount > 0 ? totalAmount : undefined });
      promptpayQrBase64 = await QRCode.toDataURL(payload, { width: 200, margin: 1 });
    } catch {}
  }

  let effectiveDocType = cfg.displayDocType;
  const docNo = doc[cfg.noField] || "";
  const docDate = doc[cfg.dateField] || null;

  if (printType && cfg.displayDocType === "tax_invoice") {
    if (printType === "receipt") effectiveDocType = "receipt";
    else if (printType === "invoice") effectiveDocType = "invoice";
    else if (printType === "tax_invoice_receipt") effectiveDocType = "tax_invoice_receipt";
    else if (printType === "delivery_note") effectiveDocType = "delivery_note";
  }

  const pdfCompany: PdfCompany = {
    id: company.id,
    name: company.name,
    nameEn: company.nameEn,
    taxId: company.taxId || "",
    address: company.address || "",
    phone: company.phone || "",
    email: company.email || null,
    branch: company.branch || "สำนักงานใหญ่",
    lineId: (company as any).lineId || null,
    facebook: (company as any).facebook || null,
    instagram: (company as any).instagram || null,
    website: (company as any).website || null,
  };

  const pdfSettings: PdfSettings = {
    logoBase64,
    showLogo: docSetting?.showLogo !== false,
    showSignature: docSetting?.showSignature !== false,
    showTaxId: docSetting?.showTaxId !== false,
    showBranch: docSetting?.showBranch !== false,
    showProductCode: docSetting?.showProductCode !== false,
    headerNote: docSetting?.headerNote || null,
    footerNote: docSetting?.footerNote || null,
    bankAccountName: docSetting?.bankAccountName || null,
    bankAccountNumber: docSetting?.bankAccountNumber || null,
    bankName: docSetting?.bankName || null,
    qrCodeBase64,
    promptpayQrBase64,
    docTypeColors: docSetting?.docTypeColors || null,
    colorMode: docSetting?.colorMode || null,
    dateEra: docSetting?.dateEra || null,
    dateFormat: docSetting?.dateFormat || null,
    docFontSize: docSetting?.docFontSize || "medium",
    showQrOnDoc: docSetting?.showQrOnDoc !== false,
    qrBase64: qrCodeBase64 || promptpayQrBase64 || null,
  };

  const custBranch = doc.branch || doc.customerBranch || "";

  const pdfDocument: PdfDocumentData = {
    docNo,
    docDate: docDate ? String(docDate) : null,
    validUntil: doc.validUntil ? String(doc.validUntil) : null,
    creditDays: doc.creditDays,
    refDoc: doc.refDoc || null,
    customerName: doc.customerName || "",
    customerAddress: doc.customerAddress || "",
    customerTaxId: doc.customerTaxId || "",
    contactPerson: doc.contactPerson || "",
    contactPhone: doc.contactPhone || "",
    contactEmail: doc.contactEmail || "",
    customerBranch: custBranch,
    salesperson: doc.salesperson || "",
    notes: doc.notes || "",
    paymentTerms: doc.paymentTerms || "",
    subtotal: parseFloat(String(doc.subtotal || "0")),
    vatAmount: parseFloat(String(doc.vatAmount || "0")),
    discountAmount: parseFloat(String(doc.discountAmount || "0")),
    totalAmount: parseFloat(String(doc.totalAmount || "0")),
    withholdingTax: parseFloat(String(doc.withholdingTax || "0")),
    priceMode: doc.priceMode || "excluded",
    items: mapItemsToPdfItems(rawItems),
    currencyCode: doc.currencyCode || "THB",
    exchangeRate: doc.exchangeRate ? parseFloat(String(doc.exchangeRate)) : null,
    sellerBranchCode: doc.sellerBranchId || "",
    sellerBranchName: "",
    sellerBranchAddress: "",
  };

  const etaxEnabled = !!(company as any).etaxEnabled;

  return {
    company: pdfCompany,
    settings: pdfSettings,
    document: pdfDocument,
    documentType: effectiveDocType,
    signature: userSig,
    etaxEnabled,
    etaxStampBase64: etaxEnabled ? getEtaxStamp() : null,
  };
}

export async function buildBillingNotePdfData(billingNoteId: number): Promise<GeneratePdfOptions> {
  const [bn] = await db.select().from(billingNotes).where(eq(billingNotes.id, billingNoteId));
  if (!bn) throw new Error("ไม่พบใบวางบิล");

  const [company] = await db.select().from(companies).where(eq(companies.id, bn.companyId));
  if (!company) throw new Error("ไม่พบบริษัท");

  const linkedDocs = await db.select().from(billingNoteLinkedDocs).where(eq(billingNoteLinkedDocs.billingNoteId, billingNoteId));

  const items: PdfLineItem[] = linkedDocs.map((doc: any) => ({
    productCode: "",
    productName: doc.docType === "IV" ? "ใบแจ้งหนี้" : doc.docType === "TIV" ? "ใบกำกับภาษี" : (doc.docType || ""),
    description: `เลขที่ ${doc.docNo || "-"}${doc.docDate ? ` ลงวันที่ ${doc.docDate}` : ""}`,
    qty: 1,
    unit: "รายการ",
    unitPrice: parseFloat(String(doc.amount || "0")),
    discount: 0,
    discountType: "amount" as const,
    total: parseFloat(String(doc.amount || "0")),
    vatType: "no_vat" as const,
  }));

  const totalAmount = parseFloat(String(bn.totalAmount || "0"));

  let docSetting: any = null;
  try {
    const [ds] = await db.select().from(documentSettings).where(eq(documentSettings.companyId, bn.companyId));
    docSetting = ds || null;
  } catch {}

  let userSig: PdfSignature | null = null;
  if (bn.createdBy) {
    try {
      const u = await storage.getUser(bn.createdBy);
      if (u) {
        const sigBase64 = await fetchImageAsBase64(u.signatureUrl ? await resolveObjectStorageUrl(u.signatureUrl) : null);
        userSig = {
          name: u.signatureName || u.fullName || "",
          title: u.signatureTitle || "",
          imageBase64: sigBase64,
        };
      }
    } catch {}
  }

  const logoBase64 = await fetchImageAsBase64(company.logoUrl ? await resolveObjectStorageUrl(company.logoUrl) : null);
  const qrBase64 = await fetchImageAsBase64(docSetting?.qrCode ? await resolveObjectStorageUrl(docSetting.qrCode) : null);

  const pdfCompany: PdfCompany = {
    id: company.id,
    name: company.name || "",
    nameEn: (company as any).nameEn || "",
    address: company.address || "",
    taxId: company.taxId || "",
    phone: company.phone || "",
    email: (company as any).email || "",
    website: (company as any).website || "",
    logoBase64: logoBase64 || "",
    logoUrl: company.logoUrl || "",
    branchName: "",
    branchCode: "",
  };

  const pdfSettings: PdfSettings = {
    themeColor: docSetting?.themeColor || "#fb9678",
    showLogo: docSetting?.showLogo !== false,
    showSignature: docSetting?.showSignature !== false,
    showStamp: docSetting?.showStamp !== false,
    showTaxId: docSetting?.showTaxId !== false,
    showNote: docSetting?.showNote !== false,
    showQrCode: !!(docSetting?.qrCode && docSetting?.promptpayEnabled),
    qrCodeBase64: qrBase64,
    showWatermark: false,
    watermarkText: "",
    docTypeColors: docSetting?.docTypeColors || null,
    showDocumentBorder: docSetting?.showDocumentBorder !== false,
    documentBorderColor: docSetting?.documentBorderColor || "",
    borderRadius: docSetting?.borderRadius ?? 8,
    showHeaderBackground: docSetting?.showHeaderBackground !== false,
    showTable: docSetting?.showTable !== false,
    tableStyle: docSetting?.tableStyle || "bordered",
    showItemCode: docSetting?.showItemCode !== false,
    showDiscount: docSetting?.showDiscount !== false,
    vatRate: docSetting?.vatRate ?? 7,
  };

  const pdfDocument: PdfDocumentData = {
    docNo: bn.billingNo,
    docDate: bn.billingDate,
    dueDate: bn.dueDate || "",
    customerName: bn.customerName || "",
    customerAddress: bn.customerAddress || "",
    customerTaxId: bn.customerTaxId || "",
    customerBranch: "",
    sellerBranchName: "",
    sellerBranchAddress: "",
    subtotal: totalAmount,
    vatAmount: 0,
    totalAmount,
    withholdingTax: 0,
    discountAmount: 0,
    notes: bn.notes || "",
    items,
  };

  return {
    company: pdfCompany,
    settings: pdfSettings,
    document: pdfDocument,
    documentType: "billing_note",
    signature: userSig,
    etaxEnabled: false,
    etaxStampBase64: null,
  };
}
