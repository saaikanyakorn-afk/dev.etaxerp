import * as path from "path";
import * as fs from "fs";
import {
  DOCUMENT_TYPES_FULL,
  getDocumentType,
  getDocTypeColor,
  parseCategoryColors,
} from "@shared/document-types";
import type {
  GeneratePdfOptions,
  PdfLineItem,
} from "./pdf-react-generator";

import { createRequire } from "module";
const _require = createRequire(
  typeof __filename !== "undefined"
    ? "file://" + __filename
    : /* @vite-ignore */ import.meta.url
);
const PdfPrinter = _require("pdfmake/src/printer");

const fontsDir = path.join(process.cwd(), "server/fonts");
const printer = new PdfPrinter({
  Sarabun: {
    normal: path.join(fontsDir, "Sarabun-Regular.ttf"),
    bold: path.join(fontsDir, "Sarabun-Bold.ttf"),
    italics: path.join(fontsDir, "Sarabun-Italic.ttf"),
    bolditalics: path.join(fontsDir, "Sarabun-Bold.ttf"),
  },
});

function numberToThaiText(num: number): string {
  if (num === 0) return "ศูนย์บาทถ้วน";
  if (num < 0) return "ลบ" + numberToThaiText(Math.abs(num));
  const thaiDigits = ["", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
  const placeNames = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"];
  const absNum = Math.abs(num);
  const intPart = Math.floor(absNum);
  const decStr = absNum.toFixed(2).split(".")[1];
  const decPart = parseInt(decStr, 10);
  function convertChunk(n: number): string {
    if (n === 0) return "";
    const s = n.toString();
    let out = "";
    const len = s.length;
    for (let i = 0; i < len; i++) {
      const digit = parseInt(s[i]);
      const place = len - i - 1;
      if (digit === 0) continue;
      if (place === 1 && digit === 1) out += "สิบ";
      else if (place === 1 && digit === 2) out += "ยี่สิบ";
      else if (place === 0 && digit === 1 && len > 1) out += "เอ็ด";
      else out += thaiDigits[digit] + (placeNames[place] || "");
    }
    return out;
  }
  function convertFull(n: number): string {
    if (n === 0) return "";
    if (n < 1000000) return convertChunk(n);
    const mil = Math.floor(n / 1000000);
    const rem = n % 1000000;
    let result = convertFull(mil) + "ล้าน";
    if (rem > 0) result += convertChunk(rem);
    return result;
  }
  let result = intPart > 0 ? convertFull(intPart) + "บาท" : "ศูนย์บาท";
  result += decPart > 0 ? convertChunk(decPart) + "สตางค์" : "ถ้วน";
  return result;
}

function fmtDate(val: string | null | undefined, era?: string, dateFormat?: string | null): string {
  if (!val) return "-";
  const m = String(val).match(/^(\d{4})-(\d{2})-(\d{2})/);
  let dd: string, mm: string, ceYear: number;
  if (m) { ceYear = Number(m[1]); mm = m[2]; dd = m[3]; }
  else { const d = new Date(val); dd = d.getDate().toString().padStart(2, "0"); mm = (d.getMonth() + 1).toString().padStart(2, "0"); ceYear = d.getFullYear(); }
  const yyyy = String(era === "BE" ? ceYear + 543 : ceYear);
  const fmt = dateFormat || "DD/MM/YYYY";
  const sep = fmt.includes("/") ? "/" : fmt.includes("-") ? "-" : ".";
  const parts = fmt.split(/[/\-\.]/);
  return parts.map(p => {
    const pu = p.toUpperCase();
    if (pu.startsWith("D")) return dd;
    if (pu.startsWith("M")) return mm;
    if (pu.startsWith("Y")) return yyyy;
    return p;
  }).join(sep);
}

function fmtNum(n: number | string): string {
  const v = typeof n === "string" ? parseFloat(n) || 0 : n;
  return v.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtQty(n: number): string {
  return n % 1 === 0 ? String(Math.round(n)) : parseFloat(n.toFixed(2)).toString();
}

function lightenHex(hex: string, amount: number = 0.75): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  const lr = Math.round(r + (255 - r) * amount);
  const lg = Math.round(g + (255 - g) * amount);
  const lb = Math.round(b + (255 - b) * amount);
  return `#${lr.toString(16).padStart(2, "0")}${lg.toString(16).padStart(2, "0")}${lb.toString(16).padStart(2, "0")}`;
}

function ensureBase64DataUri(data: string | undefined | null): string | null {
  if (!data) return null;
  if (data.startsWith("data:image/")) return data;
  if (data.startsWith("/9j/") || data.startsWith("iVBOR")) {
    const prefix = data.startsWith("/9j/") ? "data:image/jpeg;base64," : "data:image/png;base64,";
    return prefix + data;
  }
  if (/^[A-Za-z0-9+/=]+$/.test(data.substring(0, 100))) {
    return "data:image/png;base64," + data;
  }
  return data;
}

type Content = any;
type ContentColumns = any;
type ContentTable = any;
type TableCell = any;
type TDocumentDefinitions = any;

function buildDocDefinition(opts: GeneratePdfOptions): TDocumentDefinitions {
  const { company, settings, document: doc, documentType, signature, etaxEnabled, etaxStampBase64 } = opts;

  console.log(`[PDF-pdfmake] Building doc: type=${documentType}, docNo=${doc.docNo}`);

  const docInfo = getDocumentType(documentType) || DOCUMENT_TYPES_FULL[0];
  const categoryColors = parseCategoryColors(settings.docTypeColors);
  const theme = getDocTypeColor(documentType, categoryColors, settings.colorMode || "color");
  const primary = theme.primary;
  const accent = theme.accent;
  const headerBgLight = lightenHex(primary, 0.85);

  const companyName = company.name || "บริษัท";
  const companyAddress = doc.sellerBranchAddress || company.address || "";
  const companyTaxId = company.taxId || "";
  const sellerBranchCode = doc.sellerBranchCode || "";
  const sellerBranchName = doc.sellerBranchName || "";
  const companyBranch = company.branch || "สำนักงานใหญ่";
  const isBranchHQ = doc.sellerBranchCode
    ? (!sellerBranchCode || sellerBranchCode === "00000")
    : (!companyBranch || companyBranch === "สำนักงานใหญ่" || companyBranch === "00000");
  const branchDisplay = isBranchHQ
    ? "สำนักงานใหญ่"
    : doc.sellerBranchCode
      ? `สาขาที่ ${sellerBranchCode}${sellerBranchName ? ` ${sellerBranchName}` : ""}`
      : `สาขาที่ ${companyBranch}`;

  const isTaxDoc = documentType === "tax_invoice" || documentType === "receipt" || documentType === "tax_invoice_receipt";
  const era = isTaxDoc ? "BE" : (settings.dateEra || "CE");

  const items = doc.items || [];
  const subtotal = doc.subtotal || 0;
  const discountAmount = doc.discountAmount || 0;
  const vatAmount = doc.vatAmount || 0;
  const totalAmount = doc.totalAmount || 0;
  const withholdingTax = doc.withholdingTax || 0;
  const priceMode = doc.priceMode || "excluded";
  const valueBeforeVat = priceMode === "included" ? (subtotal - discountAmount - vatAmount) : (subtotal - discountAmount);

  const currencyCode = doc.currencyCode || "THB";
  const isForeignCurrency = currencyCode !== "THB";
  const showCode = settings.showProductCode !== false;

  const custBranch = doc.customerBranch;
  const isCustHQ = !custBranch || custBranch === "สำนักงานใหญ่" || custBranch === "00000";
  const custBranchDisplay = isCustHQ ? "สำนักงานใหญ่" : `สาขาที่ ${custBranch}${doc.customerBranchName ? ` ${doc.customerBranchName}` : ""}`;

  const hasBank = settings.bankName || settings.qrCodeBase64 || settings.promptpayQrBase64;
  const qrSrc = ensureBase64DataUri(settings.qrCodeBase64 || settings.promptpayQrBase64 || null);

  const content: Content[] = [];


  const companyInfoStack: Content[] = [];
  companyInfoStack.push({ text: companyName, fontSize: 10, bold: true, color: "#1f2937" });
  if (companyAddress) companyInfoStack.push({ text: companyAddress, fontSize: 7.5, color: "#4b5563", margin: [0, 1.5, 0, 0] });
  if (settings.showTaxId !== false && companyTaxId) companyInfoStack.push({ text: `เลขประจำตัวผู้เสียภาษี: ${companyTaxId}`, fontSize: 7.5, color: "#4b5563", margin: [0, 1.5, 0, 0] });
  if (settings.showBranch !== false) companyInfoStack.push({ text: branchDisplay, fontSize: 7.5, color: primary, bold: true, margin: [0, 1.5, 0, 0] });
  if (company.phone || company.email) {
    const parts: string[] = [];
    if (company.phone) parts.push(`โทร. ${company.phone}`);
    if (company.email) parts.push(`อีเมล: ${company.email}`);
    companyInfoStack.push({ text: parts.join("  "), fontSize: 7.5, color: "#4b5563", margin: [0, 1.5, 0, 0] });
  }
  if (company.lineId || company.facebook) {
    const parts: string[] = [];
    if (company.lineId) parts.push(`LINE: ${company.lineId}`);
    if (company.facebook) parts.push(`Facebook: ${company.facebook}`);
    companyInfoStack.push({ text: parts.join("  "), fontSize: 7.5, color: "#4b5563", margin: [0, 1.5, 0, 0] });
  }
  if (company.website) companyInfoStack.push({ text: `เว็บไซต์: ${company.website}`, fontSize: 7.5, color: "#4b5563", margin: [0, 1.5, 0, 0] });

  const logoData = ensureBase64DataUri(settings.logoBase64);
  const leftCol: Content = settings.showLogo !== false && logoData
    ? { columns: [{ image: logoData, width: 72, height: 72 }, { stack: companyInfoStack, width: "*" }], columnGap: 16 }
    : { stack: companyInfoStack };

  const docInfoStack: Content[] = [];
  docInfoStack.push({
    table: {
      widths: ["*"],
      body: [[{
        stack: [
          { text: docInfo.label, fontSize: 18, bold: true, color: "white", alignment: "center" },
          { text: docInfo.labelEn.toUpperCase(), fontSize: 9, color: "white", alignment: "center", margin: [0, 1, 0, 0] },
        ],
      }]],
    },
    layout: { hLineWidth: () => 0, vLineWidth: () => 0, fillColor: () => primary, paddingLeft: () => 14, paddingRight: () => 14, paddingTop: () => 6, paddingBottom: () => 6 },
    margin: [0, 0, 0, 6],
  });
  docInfoStack.push({ text: [{ text: "เลขที่: ", fontSize: 8.5 }, { text: doc.docNo, fontSize: 8.5, bold: true, color: accent }], alignment: "right", margin: [0, 2, 0, 0] });
  docInfoStack.push({ text: `วันที่: ${fmtDate(doc.docDate, era, settings.dateFormat)}`, fontSize: 8.5, alignment: "right", margin: [0, 2, 0, 0] });
  if (doc.validUntil) docInfoStack.push({ text: `กำหนดส่ง: ${fmtDate(doc.validUntil, era, settings.dateFormat)}`, fontSize: 8.5, alignment: "right", margin: [0, 2, 0, 0] });
  if (doc.creditDays != null && Number(doc.creditDays) > 0) docInfoStack.push({ text: `เครดิต: ${doc.creditDays} วัน`, fontSize: 8.5, alignment: "right", margin: [0, 2, 0, 0] });
  if (isForeignCurrency) docInfoStack.push({ text: `สกุลเงิน: ${currencyCode}`, fontSize: 8, bold: true, color: accent, alignment: "right", margin: [0, 2, 0, 0] });
  if (doc.refDoc) docInfoStack.push({ text: `อ้างอิง: ${doc.refDoc}`, fontSize: 8, color: primary, alignment: "right", margin: [0, 2, 0, 0] });

  content.push({
    columns: [
      { stack: [leftCol], width: "*" },
      { stack: docInfoStack, width: 170 },
    ],
    margin: [0, 0, 0, 8],
  });

  if (settings.headerNote) {
    content.push({ text: settings.headerNote, fontSize: 7.5, color: "#6b7280", italics: true, margin: [0, 0, 0, 6] });
  }

  const custBody: Content[][] = [[
    {
      stack: [
        { text: "ลูกค้า / Customer", fontSize: 7.5, bold: true, color: primary, margin: [0, 0, 0, 3] },
        { text: doc.customerName || "-", fontSize: 8.5, bold: true, color: "#1f2937" },
        ...(doc.customerAddress ? [{ text: doc.customerAddress, fontSize: 7.5, color: "#4b5563", margin: [0, 1, 0, 0] }] : []),
        ...(doc.customerTaxId ? [{ text: `เลขประจำตัวผู้เสียภาษี: ${doc.customerTaxId}`, fontSize: 7.5, color: "#4b5563", margin: [0, 1, 0, 0] }] : []),
        { text: custBranchDisplay, fontSize: 7.5, color: primary, bold: true, margin: [0, 1, 0, 0] },
        ...(doc.contactPerson ? [{ text: `ผู้ติดต่อ: ${doc.contactPerson}`, fontSize: 7.5, color: "#4b5563", margin: [0, 1, 0, 0] }] : []),
        ...((doc.contactPhone || doc.contactEmail) ? [{ text: [doc.contactPhone ? `โทร: ${doc.contactPhone}` : "", doc.contactPhone && doc.contactEmail ? " | " : "", doc.contactEmail ? `อีเมล: ${doc.contactEmail}` : ""].join(""), fontSize: 7.5, color: "#4b5563", margin: [0, 1, 0, 0] }] : []),
        ...(doc.salesperson ? [{ text: `พนักงานขาย: ${doc.salesperson}`, fontSize: 7.5, color: "#4b5563", margin: [0, 1, 0, 0] }] : []),
      ],
    },
  ]];

  const boxLayout = {
    hLineWidth: () => 0.5,
    vLineWidth: () => 0.5,
    hLineColor: () => headerBgLight,
    vLineColor: () => headerBgLight,
    paddingLeft: () => 7,
    paddingRight: () => 7,
    paddingTop: () => 7,
    paddingBottom: () => 7,
    fillColor: () => headerBgLight,
  };

  const custBox: Content = {
    table: { widths: ["*"], body: custBody },
    layout: boxLayout,
  };

  if (hasBank) {
    const bankContent: Content[] = [];
    if (qrSrc) {
      try { bankContent.push({ image: qrSrc, width: 60, height: 60, alignment: "center", margin: [0, 0, 0, 4] }); } catch {}
    }
    bankContent.push({ text: "ข้อมูลชำระเงิน", fontSize: 7.5, bold: true, color: primary, alignment: "center", margin: [0, 0, 0, 2] });
    if (settings.promptpayQrBase64 && !settings.qrCodeBase64) {
      bankContent.push({ text: "พร้อมเพย์ (PromptPay)", fontSize: 7, color: "#03c9d7", bold: true, alignment: "center", margin: [0, 1, 0, 0] });
    }
    if (settings.bankName) bankContent.push({ text: `ธนาคาร: ${settings.bankName}`, fontSize: 7, color: "#4b5563", alignment: "center", margin: [0, 1, 0, 0] });
    if (settings.bankAccountNumber) bankContent.push({ text: `เลขที่บัญชี: ${settings.bankAccountNumber}`, fontSize: 7, color: "#4b5563", alignment: "center", margin: [0, 1, 0, 0] });
    if (settings.bankAccountName) bankContent.push({ text: `ชื่อบัญชี: ${settings.bankAccountName}`, fontSize: 7, color: "#4b5563", alignment: "center", margin: [0, 1, 0, 0] });
    if (totalAmount > 0) bankContent.push({ text: `จำนวนเงิน: ${fmtNum(totalAmount)} บาท`, fontSize: 7.5, bold: true, color: primary, alignment: "center", margin: [0, 3, 0, 0] });

    const fixedHeight = 174;
    const customerBox: Content = {
      table: { widths: ["*"], body: custBody },
      layout: boxLayout,
    };
    const bankBox: Content = {
      table: {
        widths: ["*"],
        body: [[{ stack: bankContent }]],
        heights: [fixedHeight],
      },
      layout: boxLayout,
    };
    const alignedCustomerBox: Content = {
      table: {
        widths: ["*"],
        body: [[{ stack: [customerBox] }]],
        heights: [fixedHeight],
      },
      layout: boxLayout,
    };

    content.push({
      columns: [
        { stack: [alignedCustomerBox], width: "*" },
        { stack: [bankBox], width: 140 },
      ],
      columnGap: 8,
      margin: [0, 0, 0, 8],
    });
  } else {
    content.push({ ...custBox, margin: [0, 0, 0, 8] });
  }

  const tableHeaders: TableCell[] = [
    { text: [{ text: "ลำดับ\n", fontSize: 7.5, bold: true }, { text: "No.", fontSize: 6 }], alignment: "center", color: accent },
  ];
  if (showCode) tableHeaders.push({ text: [{ text: "รหัส\n", fontSize: 7.5, bold: true }, { text: "Code", fontSize: 6 }], color: accent });
  tableHeaders.push({ text: [{ text: "รายละเอียด\n", fontSize: 7.5, bold: true }, { text: "Description", fontSize: 6 }], color: accent });
  tableHeaders.push({ text: [{ text: "จำนวน\n", fontSize: 7.5, bold: true }, { text: "Qty", fontSize: 6 }], alignment: "center", color: accent });
  tableHeaders.push({ text: [{ text: "หน่วย\n", fontSize: 7.5, bold: true }, { text: "Unit", fontSize: 6 }], alignment: "center", color: accent });
  tableHeaders.push({ text: [{ text: "ราคาต่อหน่วย\n", fontSize: 7.5, bold: true }, { text: "Unit Price", fontSize: 6 }], alignment: "right", color: accent });
  tableHeaders.push({ text: [{ text: "ส่วนลด\n", fontSize: 7.5, bold: true }, { text: "Discount", fontSize: 6 }], alignment: "right", color: accent });
  tableHeaders.push({ text: [{ text: "มูลค่า\n", fontSize: 7.5, bold: true }, { text: "Amount", fontSize: 6 }], alignment: "right", color: accent });

  const tableBody: TableCell[][] = [tableHeaders];

  items.forEach((item, i) => {
    const vatType = item.vatType || "vat7";
    const isIncluded = priceMode === "included" && vatType === "vat7";
    const displayUnitPrice = isIncluded ? Math.round((item.unitPrice * 100 / 107) * 100) / 100 : item.unitPrice;
    const displayTotal = isIncluded ? Math.round((item.total * 100 / 107) * 100) / 100 : item.total;
    const displayDiscount = (() => {
      const dv = parseFloat(String(item.discount)) || 0;
      if (dv === 0) return fmtNum(0);
      if (item.discountType === "percent") return `${parseFloat(dv.toFixed(2))}%`;
      const ddv = isIncluded ? Math.round((dv * 100 / 107) * 100) / 100 : dv;
      return fmtNum(ddv);
    })();

    const descContent: Content = item.description
      ? { stack: [{ text: item.productName || "", fontSize: 7.5 }, { text: item.description, fontSize: 6.5, color: "#9ca3af" }] }
      : { text: item.productName || "", fontSize: 7.5 };

    const row: TableCell[] = [
      { text: String(i + 1), alignment: "center", fontSize: 7.5, color: "#6b7280" },
    ];
    if (showCode) row.push({ text: item.productCode || "-", fontSize: 7.5, color: "#4b5563" });
    row.push(descContent);
    row.push({ text: fmtQty(item.qty), alignment: "center", fontSize: 7.5 });
    row.push({ text: item.unit || "ชิ้น", alignment: "center", fontSize: 7.5 });
    row.push({ text: fmtNum(displayUnitPrice), alignment: "right", fontSize: 7.5 });
    row.push({ text: displayDiscount, alignment: "right", fontSize: 7.5 });
    row.push({ text: fmtNum(displayTotal), alignment: "right", fontSize: 7.5 });
    tableBody.push(row);
  });

  const minRows = 5;
  const emptyRowCount = Math.max(0, minRows - items.length);
  for (let i = 0; i < emptyRowCount; i++) {
    const colCount = showCode ? 8 : 7;
    const emptyRow: TableCell[] = Array.from({ length: colCount }, () => ({ text: " ", fontSize: 7.5 }));
    tableBody.push(emptyRow);
  }

  const colWidths = showCode
    ? ["5%", "10%", "*", "8%", "7%", "14%", "12%", "14%"]
    : ["5%", "*", "8%", "7%", "14%", "12%", "14%"];

  content.push({
    table: {
      headerRows: 1,
      widths: colWidths,
      body: tableBody,
    },
    layout: {
      hLineWidth: (i: number, node: any) => i === 1 ? 0.5 : 0.3,
      vLineWidth: () => 0,
      hLineColor: (i: number, node: any) => i === 1 ? (theme.light || "#e5e7eb") : "#f3f4f6",
      paddingLeft: () => 3,
      paddingRight: () => 3,
      paddingTop: () => 3.5,
      paddingBottom: () => 3.5,
      fillColor: (rowIndex: number) => rowIndex === 0 ? headerBgLight : null,
    },
    margin: [0, 0, 0, 8],
  });

  const thaiAmountText = isForeignCurrency ? `${fmtNum(totalAmount)} ${currencyCode}` : numberToThaiText(totalAmount);

  const summaryBody: Content[][] = [];
  summaryBody.push([
    { text: [{ text: "ยอดรวม\n", fontSize: 7.5 }, { text: "Sub Total", fontSize: 6, color: "#9ca3af" }] },
    { text: fmtNum(subtotal), fontSize: 7.5, alignment: "right" },
  ]);
  if (discountAmount > 0) {
    summaryBody.push([
      { text: [{ text: "ส่วนลดพิเศษ\n", fontSize: 7.5 }, { text: "Special Discount", fontSize: 6, color: "#9ca3af" }] },
      { text: fmtNum(discountAmount), fontSize: 7.5, alignment: "right" },
    ]);
  }
  summaryBody.push([
    { text: [{ text: "มูลค่าก่อนภาษี\n", fontSize: 7.5 }, { text: "Value Before VAT", fontSize: 6, color: "#9ca3af" }] },
    { text: fmtNum(valueBeforeVat), fontSize: 7.5, alignment: "right" },
  ]);
  summaryBody.push([
    { text: [{ text: "ภาษีมูลค่าเพิ่ม 7%\n", fontSize: 7.5 }, { text: "Value Added Tax", fontSize: 6, color: "#9ca3af" }] },
    { text: fmtNum(vatAmount), fontSize: 7.5, alignment: "right" },
  ]);
  if (withholdingTax > 0) {
    summaryBody.push([
      { text: [{ text: "ภาษีหัก ณ ที่จ่าย\n", fontSize: 7.5 }, { text: "Withholding Tax", fontSize: 6, color: "#9ca3af" }] },
      { text: fmtNum(withholdingTax), fontSize: 7.5, alignment: "right" },
    ]);
  }
  summaryBody.push([
    { text: [{ text: `ยอดเงินสุทธิ ${isForeignCurrency ? `(${currencyCode})` : ""}\n`, fontSize: 9, bold: true, color: "white" }, { text: "Grand Total", fontSize: 6, color: "white" }], fillColor: primary },
    { text: fmtNum(totalAmount), fontSize: 9, bold: true, color: "white", alignment: "right", fillColor: primary },
  ]);

  const notesStack: Content[] = [];
  notesStack.push({
    table: {
      widths: ["*"],
      body: [[{
        text: thaiAmountText,
        fontSize: 7.5,
        bold: true,
        color: "#374151",
        alignment: "center",
      }]],
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => headerBgLight,
      vLineColor: () => headerBgLight,
      paddingLeft: () => 6,
      paddingRight: () => 6,
      paddingTop: () => 6,
      paddingBottom: () => 6,
      fillColor: () => headerBgLight,
    },
    margin: [0, 0, 0, 4],
  });
  if (doc.notes) notesStack.push({ text: doc.notes, fontSize: 7.5, color: "#6b7280", margin: [0, 4, 0, 0] });
  if (doc.paymentTerms) notesStack.push({ text: [{ text: "เงื่อนไขการชำระ: ", bold: true }, doc.paymentTerms], fontSize: 7.5, color: "#6b7280", margin: [0, 2, 0, 0] });
  if (settings.footerNote) notesStack.push({ text: settings.footerNote, fontSize: 7.5, color: "#6b7280" });

  content.push({
    columns: [
      { stack: notesStack, width: "*", margin: [0, 0, 10, 0] },
      {
        table: {
          widths: ["*", 60],
          body: summaryBody,
        },
        layout: {
          hLineWidth: () => 0.3,
          vLineWidth: () => 0,
          hLineColor: () => "#f3f4f6",
          paddingLeft: () => 3,
          paddingRight: () => 3,
          paddingTop: () => 2.5,
          paddingBottom: () => 2.5,
        },
        width: 180,
      },
    ],
    margin: [0, 0, 0, 8],
  });

  if (settings.showSignature !== false) {
    const sigLeftLabel = "ผู้อนุมัติ / ลูกค้า";
    const sigLeftSub = "Approved by";
    const sigRightLabel = documentType === "quotation" ? "ผู้เสนอราคา" : documentType === "receipt" ? "ผู้รับเงิน" : "ผู้ออกเอกสาร";
    const sigRightSub = documentType === "quotation" ? "Salesperson" : documentType === "receipt" ? "Cashier" : "Authorized";

    const sigRight: Content[] = [];
    const sigImg = ensureBase64DataUri(signature?.signatureBase64);
    if (sigImg) {
      try {
        sigRight.push({ image: sigImg, width: 60, height: 30, alignment: "center", margin: [0, 0, 0, 3] });
      } catch {}
    } else {
      sigRight.push({ text: " ", margin: [0, 30, 0, 0] });
    }
    if (signature?.signatureName) sigRight.push({ text: signature.signatureName, fontSize: 7.5, bold: true, alignment: "center" });
    sigRight.push({ text: sigRightLabel, fontSize: 7.5, bold: true, color: "#6b7280", alignment: "center" });
    sigRight.push({ text: sigRightSub, fontSize: 7, color: "#6b7280", alignment: "center" });

    content.push({
      columns: [
        {
          stack: [
            { text: " ", margin: [0, 30, 0, 0] },
            { canvas: [{ type: "line", x1: 0, y1: 0, x2: 115, y2: 0, lineWidth: 0.5, lineColor: "#9ca3af" }] },
            { text: sigLeftLabel, fontSize: 7.5, bold: true, alignment: "center", margin: [0, 3, 0, 0] },
            { text: sigLeftSub, fontSize: 7, color: "#6b7280", alignment: "center" },
            { text: "วันที่ ____/____/____", fontSize: 7, color: "#6b7280", alignment: "center" },
          ],
          width: 115,
          alignment: "center",
        },
        { text: "", width: "*" },
        {
          stack: [
            ...sigRight,
            { canvas: [{ type: "line", x1: 0, y1: 0, x2: 115, y2: 0, lineWidth: 0.5, lineColor: "#9ca3af" }], margin: [0, 0, 0, 3] },
          ],
          width: 115,
          alignment: "center",
        },
      ],
      margin: [0, 12, 0, 0],
    });
  }

  if (etaxEnabled && isTaxDoc) {
    const etaxContent: Content[] = [];
    etaxContent.push({ text: "ใบกำกับภาษีอิเล็กทรอนิกส์นี้ได้จัดทำและส่งข้อมูลให้แก่", fontSize: 6, color: "#6b7280", alignment: "right" });
    etaxContent.push({ text: "กรมสรรพากรด้วยวิธีการทางอิเล็กทรอนิกส์", fontSize: 6, color: "#6b7280", alignment: "right" });

    const etaxImg = ensureBase64DataUri(etaxStampBase64);
    if (etaxImg) {
      try {
        content.push({
          columns: [
            { text: "", width: "*" },
            { image: etaxImg, width: 50, height: 20, margin: [0, 0, 6, 0] },
            { stack: etaxContent, width: "auto" },
          ],
          margin: [0, 5, 0, 0],
        });
      } catch {
        content.push({ stack: etaxContent, margin: [0, 5, 0, 0] });
      }
    } else {
      content.push({ stack: etaxContent, margin: [0, 5, 0, 0] });
    }
  }

  return {
    pageSize: "A4",
    pageMargins: [28, 28, 28, 40],
    defaultStyle: {
      font: "Sarabun",
      fontSize: 8,
    },
    content,
    footer: (currentPage: number, pageCount: number) => ({
      columns: [
        { text: [{ text: "Powered by ", color: "#9ca3af" }, { text: "E-Tax Center", bold: true, color: primary }], fontSize: 6, margin: [0, 4, 0, 0] },
        { text: doc.docNo, fontSize: 6, color: "#d1d5db", alignment: "right", margin: [0, 4, 0, 0] },
      ],
      margin: [28, 0, 28, 0],
    }),
  };
}

const PDF_MAX_CONCURRENT = 5;
const PDF_RENDER_TIMEOUT = 30_000;
const PDF_QUEUE_TIMEOUT = 60_000;
let pdfActiveCount = 0;
let pdfTotalRendered = 0;
let pdfTotalFailed = 0;
let pdfTotalTimedOut = 0;
const pdfQueue: Array<{ resolve: () => void; reject: (err: Error) => void; enqueuedAt: number }> = [];
const pdfActiveRenders = new Map<number, number>();
let pdfRenderIdSeq = 0;

function acquirePdfSlot(): Promise<void> {
  if (pdfActiveCount < PDF_MAX_CONCURRENT) {
    pdfActiveCount++;
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const entry = { resolve, reject, enqueuedAt: Date.now() };
    pdfQueue.push(entry);
    const timer = setTimeout(() => {
      const idx = pdfQueue.indexOf(entry);
      if (idx !== -1) {
        pdfQueue.splice(idx, 1);
        reject(new Error(`PDF queue timeout: waited ${PDF_QUEUE_TIMEOUT / 1000}s — slots may be stuck (active=${pdfActiveCount}, queued=${pdfQueue.length})`));
      }
    }, PDF_QUEUE_TIMEOUT);
    const origResolve = entry.resolve;
    entry.resolve = () => { clearTimeout(timer); origResolve(); };
  });
}

function releasePdfSlot() {
  if (pdfQueue.length > 0) {
    const next = pdfQueue.shift()!;
    next.resolve();
  } else {
    pdfActiveCount = Math.max(0, pdfActiveCount - 1);
  }
}

export async function generatePdfMake(opts: GeneratePdfOptions): Promise<Buffer> {
  await acquirePdfSlot();
  const renderId = ++pdfRenderIdSeq;
  pdfActiveRenders.set(renderId, Date.now());
  try {
    const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          pdfTotalTimedOut++;
          console.error(`[PDF-pdfmake] RENDER TIMEOUT: render #${renderId} exceeded ${PDF_RENDER_TIMEOUT / 1000}s`);
          reject(new Error(`PDF render timeout after ${PDF_RENDER_TIMEOUT / 1000}s`));
        }
      }, PDF_RENDER_TIMEOUT);

      try {
        const docDef = buildDocDefinition(opts);
        const pdfDoc = printer.createPdfKitDocument(docDef);
        const chunks: Buffer[] = [];
        pdfDoc.on("data", (chunk: Buffer) => chunks.push(chunk));
        pdfDoc.on("end", () => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve(Buffer.concat(chunks));
          }
        });
        pdfDoc.on("error", (err: Error) => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            reject(err);
          }
        });
        pdfDoc.end();
      } catch (err) {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(err);
        }
      }
    });

    pdfTotalRendered++;
    return pdfBuffer;
  } catch (err) {
    pdfTotalFailed++;
    throw err;
  } finally {
    pdfActiveRenders.delete(renderId);
    releasePdfSlot();
  }
}

export function getPdfMakeHealthStats() {
  return { pdfActiveCount, pdfTotalRendered, pdfTotalFailed, pdfTotalTimedOut, queueLength: pdfQueue.length, activeRenders: pdfActiveRenders.size };
}

const PDF_HEALTH_INTERVAL = 60_000;
setInterval(() => {
  if (pdfActiveCount === 0 && pdfQueue.length === 0) return;
  const now = Date.now();
  let stuckCount = 0;
  for (const [id, startedAt] of pdfActiveRenders) {
    const elapsed = now - startedAt;
    if (elapsed > PDF_RENDER_TIMEOUT) {
      stuckCount++;
      console.error(`[PDF-pdfmake] STUCK RENDER DETECTED: render #${id} running for ${Math.round(elapsed / 1000)}s`);
    }
  }
  if (pdfActiveCount > 0 || pdfQueue.length > 0 || stuckCount > 0) {
    console.log(`[PDF-pdfmake Health] active=${pdfActiveCount}/${PDF_MAX_CONCURRENT} queued=${pdfQueue.length} rendered=${pdfTotalRendered} failed=${pdfTotalFailed} timedOut=${pdfTotalTimedOut} stuck=${stuckCount}`);
  }
  if (stuckCount >= PDF_MAX_CONCURRENT && pdfActiveRenders.size === 0) {
    console.error(`[PDF-pdfmake] ALL SLOTS STUCK — resetting pdfActiveCount from ${pdfActiveCount} to 0`);
    pdfActiveCount = 0;
    while (pdfQueue.length > 0) {
      const next = pdfQueue.shift()!;
      next.reject(new Error("PDF system reset: all slots were stuck"));
    }
  }
}, PDF_HEALTH_INTERVAL);
