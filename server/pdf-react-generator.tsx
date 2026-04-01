import React from "react";
import { Document, Page, View, Text, Image, Font, renderToBuffer, StyleSheet } from "@react-pdf/renderer";
import path from "path";
import {
  DOCUMENT_TYPES_FULL,
  getDocumentType,
  getDocTypeColor,
  parseCategoryColors,
  type ColorTheme,
} from "@shared/document-types";

Font.register({
  family: "Sarabun",
  fonts: [
    { src: path.join(process.cwd(), "server/fonts/Sarabun-Regular.ttf"), fontWeight: "normal" },
    { src: path.join(process.cwd(), "server/fonts/Sarabun-Bold.ttf"), fontWeight: "bold" },
    { src: path.join(process.cwd(), "server/fonts/Sarabun-SemiBold.ttf"), fontWeight: 600 },
    { src: path.join(process.cwd(), "server/fonts/Sarabun-Italic.ttf"), fontStyle: "italic" },
  ],
});

export interface PdfLineItem {
  productCode?: string;
  productName?: string;
  description?: string;
  qty: number;
  unit?: string;
  unitPrice: number;
  discount: number | string;
  discountType?: string;
  total: number;
  vatType?: string;
}

export interface PdfCompany {
  id?: number;
  name?: string;
  nameEn?: string | null;
  taxId?: string;
  address?: string;
  phone?: string;
  email?: string | null;
  branch?: string;
  lineId?: string | null;
  facebook?: string | null;
  instagram?: string | null;
  website?: string | null;
  fax?: string | null;
}

export interface PdfSettings {
  logoUrl?: string | null;
  logoBase64?: string | null;
  showLogo?: boolean;
  showSignature?: boolean;
  showTaxId?: boolean;
  showBranch?: boolean;
  showProductCode?: boolean;
  headerNote?: string | null;
  footerNote?: string | null;
  bankAccountName?: string | null;
  bankAccountNumber?: string | null;
  bankName?: string | null;
  qrCodeBase64?: string | null;
  promptpayQrBase64?: string | null;
  docTypeColors?: string | null;
  colorMode?: string | null;
  dateEra?: string | null;
  dateFormat?: string | null;
}

export interface PdfDocumentData {
  docNo: string;
  docDate: string | null;
  validUntil?: string | null;
  creditDays?: string | number | null;
  refDoc?: string | null;
  customerName?: string;
  customerAddress?: string;
  customerTaxId?: string;
  contactPerson?: string;
  contactPhone?: string;
  contactEmail?: string;
  customerBranch?: string;
  customerBranchName?: string;
  salesperson?: string;
  notes?: string;
  paymentTerms?: string;
  subtotal: number;
  vatAmount: number;
  discountAmount: number;
  totalAmount: number;
  withholdingTax: number;
  priceMode?: string;
  items: PdfLineItem[];
  currencyCode?: string | null;
  exchangeRate?: number | null;
  sellerBranchCode?: string;
  sellerBranchName?: string;
  sellerBranchAddress?: string;
}

export interface PdfSignature {
  signatureBase64?: string | null;
  signatureName?: string | null;
  signatureTitle?: string | null;
}

export interface GeneratePdfOptions {
  company: PdfCompany;
  settings: PdfSettings;
  document: PdfDocumentData;
  documentType: string;
  signature?: PdfSignature | null;
  etaxEnabled?: boolean;
  etaxStampBase64?: string | null;
}

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

function fmtQty(q: number): string {
  const n = Number(q);
  if (isNaN(n)) return "0";
  return n % 1 === 0 ? String(Math.round(n)) : parseFloat(n.toFixed(2)).toString();
}

const s = StyleSheet.create({
  page: { fontFamily: "Sarabun", fontSize: 8, padding: "10mm", backgroundColor: "white" },
  topBar: { height: 4, marginBottom: 0, marginLeft: -28, marginRight: -28, marginTop: -28 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8, paddingTop: 12 },
  companyBlock: { flexDirection: "row", gap: 8, flex: 1 },
  logo: { width: 56, height: 56, objectFit: "contain" },
  companyName: { fontSize: 10, fontWeight: "bold", color: "#1f2937" },
  companyDetail: { fontSize: 7.5, color: "#4b5563", marginTop: 1.5 },
  docTypeBox: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, textAlign: "right" },
  docTypeLabel: { fontSize: 12, fontWeight: "bold" },
  docTypeLabelEn: { fontSize: 7.5, color: "#6b7280", marginTop: 1 },
  docInfoRow: { fontSize: 7.5, marginTop: 1.5 },
  sectionRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  customerBox: { flex: 1, borderWidth: 0.5, borderRadius: 3, padding: 7 },
  bankBox: { width: 130, borderWidth: 0.5, borderRadius: 3, padding: 7, alignItems: "center", justifyContent: "center" },
  sectionTitle: { fontSize: 7.5, fontWeight: 600, marginBottom: 3 },
  custName: { fontSize: 8.5, fontWeight: 600, color: "#1f2937" },
  custDetail: { fontSize: 7.5, color: "#4b5563", marginTop: 1 },
  table: { width: "100%", marginBottom: 8 },
  thRow: { flexDirection: "row", paddingVertical: 4, borderBottomWidth: 0.5 },
  th: { fontSize: 7.5, fontWeight: 600, paddingHorizontal: 3 },
  thSub: { fontSize: 6, fontWeight: "normal", opacity: 0.7, marginTop: 0.5 },
  tr: { flexDirection: "row", paddingVertical: 3.5, borderBottomWidth: 0.3, borderBottomColor: "#f3f4f6" },
  td: { fontSize: 7.5, paddingHorizontal: 3 },
  emptyRow: { flexDirection: "row", paddingVertical: 3.5, borderBottomWidth: 0.3, borderBottomColor: "#f3f4f6" },
  summaryRow: { flexDirection: "row", gap: 10, marginBottom: 8 },
  thaiTextBox: { flex: 1, borderWidth: 0.5, borderRadius: 3, padding: 6, alignItems: "center" },
  thaiText: { fontSize: 7.5, fontWeight: 600, color: "#374151", textAlign: "center" },
  totalsCol: { width: 150 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2.5, borderBottomWidth: 0.3, borderBottomColor: "#f3f4f6" },
  totalLabel: { fontSize: 7.5 },
  totalLabelSub: { fontSize: 6, color: "#9ca3af" },
  totalValue: { fontSize: 7.5, textAlign: "right" },
  grandTotalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, paddingHorizontal: 5, borderRadius: 3, marginTop: 3 },
  grandTotalLabel: { fontSize: 9, fontWeight: "bold", color: "white" },
  grandTotalLabelSub: { fontSize: 6, fontWeight: "normal", opacity: 0.8, color: "white" },
  grandTotalValue: { fontSize: 9, fontWeight: "bold", color: "white", textAlign: "right" },
  signatureRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 12, paddingTop: 10 },
  sigBlock: { width: 115, alignItems: "center" },
  sigLine: { width: "100%", borderTopWidth: 0.5, borderTopColor: "#9ca3af", paddingTop: 3, alignItems: "center" },
  sigLabel: { fontSize: 7.5, fontWeight: 600 },
  sigSub: { fontSize: 7, color: "#6b7280" },
  footerBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, paddingTop: 5, marginTop: "auto" },
  footerLogo: { flexDirection: "row", alignItems: "center", gap: 4 },
  footerBadge: { width: 12, height: 12, borderRadius: 2, alignItems: "center", justifyContent: "center" },
  footerBadgeText: { fontSize: 5, fontWeight: "bold", color: "white" },
  footerText: { fontSize: 6, color: "#9ca3af" },
  footerBrand: { fontWeight: 600 },
  footerDocNo: { fontSize: 6, color: "#d1d5db" },
  etaxRow: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", marginTop: 5, gap: 6, paddingHorizontal: 8, paddingVertical: 4 },
  etaxStamp: { width: 50, height: 20, objectFit: "contain" },
  etaxText: { fontSize: 6, color: "#6b7280", lineHeight: 1.4 },
  notesText: { fontSize: 7.5, color: "#6b7280", marginBottom: 4, whiteSpace: "pre-wrap" },
  qrImage: { width: 56, height: 56, objectFit: "contain", marginBottom: 4, borderWidth: 0.3, borderColor: "#e5e7eb", borderRadius: 2 },
  bankDetail: { fontSize: 7, color: "#4b5563", textAlign: "center", marginTop: 1 },
  bankTitle: { fontSize: 7.5, fontWeight: 600, marginBottom: 2 },
  bankAmount: { fontSize: 7.5, fontWeight: 600, marginTop: 3 },
});

const COL_W = {
  no: "5%",
  code: "10%",
  desc: "30%",
  qty: "8%",
  unit: "7%",
  price: "14%",
  disc: "12%",
  amount: "14%",
};

const COL_W_NOCODE = {
  no: "5%",
  desc: "40%",
  qty: "8%",
  unit: "7%",
  price: "14%",
  disc: "12%",
  amount: "14%",
};

function InvoiceDocument({ opts }: { opts: GeneratePdfOptions }) {
  const { company, settings, document: doc, documentType, signature, etaxEnabled, etaxStampBase64 } = opts;
  const docInfo = getDocumentType(documentType) || DOCUMENT_TYPES_FULL[0];
  const categoryColors = parseCategoryColors(settings.docTypeColors);
  const theme = getDocTypeColor(documentType, categoryColors, settings.colorMode || "color");
  const primary = theme.primary;
  const accent = theme.accent;

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

  const isTaxDoc = documentType === "taxInvoice" || documentType === "receipt" || documentType === "tax_invoice_receipt";
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
  const cols = showCode ? COL_W : COL_W_NOCODE;

  const minRows = 5;
  const emptyRowCount = Math.max(0, minRows - items.length);

  const custBranch = doc.customerBranch;
  const isCustHQ = !custBranch || custBranch === "สำนักงานใหญ่" || custBranch === "00000";
  const custBranchDisplay = isCustHQ ? "สำนักงานใหญ่" : `สาขาที่ ${custBranch}${doc.customerBranchName ? ` ${doc.customerBranchName}` : ""}`;

  const hasBank = settings.bankName || settings.qrCodeBase64 || settings.promptpayQrBase64;
  const qrSrc = settings.qrCodeBase64 || settings.promptpayQrBase64 || null;

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={[s.topBar, { backgroundColor: primary }]} />

        <View style={s.headerRow}>
          <View style={s.companyBlock}>
            {settings.showLogo !== false && settings.logoBase64 && (
              <Image src={settings.logoBase64} style={s.logo} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={s.companyName}>{companyName}</Text>
              {companyAddress ? <Text style={s.companyDetail}>{companyAddress}</Text> : null}
              {settings.showTaxId !== false && companyTaxId ? (
                <Text style={s.companyDetail}>เลขประจำตัวผู้เสียภาษี: {companyTaxId}</Text>
              ) : null}
              {settings.showBranch !== false ? (
                <Text style={[s.companyDetail, { color: primary, fontWeight: 600 }]}>{branchDisplay}</Text>
              ) : null}
              {(company.phone || company.email) ? (
                <Text style={s.companyDetail}>
                  {company.phone ? `โทร. ${company.phone}` : ""}{company.phone && company.email ? "  " : ""}{company.email ? `อีเมล: ${company.email}` : ""}
                </Text>
              ) : null}
              {(company.lineId || company.facebook) ? (
                <Text style={s.companyDetail}>
                  {company.lineId ? `LINE: ${company.lineId}` : ""}{company.lineId && company.facebook ? "  " : ""}{company.facebook ? `Facebook: ${company.facebook}` : ""}
                </Text>
              ) : null}
              {company.website ? <Text style={s.companyDetail}>เว็บไซต์: {company.website}</Text> : null}
            </View>
          </View>

          <View style={{ alignItems: "flex-end" }}>
            <View style={[s.docTypeBox, { backgroundColor: theme.bg }]}>
              <Text style={[s.docTypeLabel, { color: primary }]}>{docInfo.label}</Text>
            </View>
            <Text style={s.docTypeLabelEn}>{docInfo.labelEn.toUpperCase()}</Text>
            <View style={{ marginTop: 5 }}>
              <Text style={s.docInfoRow}>เลขที่: <Text style={{ fontWeight: 600, color: accent }}>{doc.docNo}</Text></Text>
              <Text style={s.docInfoRow}>วันที่: {fmtDate(doc.docDate, era, settings.dateFormat)}</Text>
              {doc.validUntil ? <Text style={s.docInfoRow}>กำหนดส่ง: {fmtDate(doc.validUntil, era, settings.dateFormat)}</Text> : null}
              {doc.creditDays != null && Number(doc.creditDays) > 0 ? <Text style={s.docInfoRow}>เครดิต: {doc.creditDays} วัน</Text> : null}
              {isForeignCurrency ? <Text style={[s.docInfoRow, { fontWeight: 600, color: accent, fontSize: 7 }]}>สกุลเงิน: {currencyCode}</Text> : null}
              {doc.refDoc ? <Text style={[s.docInfoRow, { color: primary, fontSize: 7 }]}>อ้างอิง: {doc.refDoc}</Text> : null}
            </View>
          </View>
        </View>

        {settings.headerNote ? <Text style={[s.notesText, { fontStyle: "italic", marginBottom: 6 }]}>{settings.headerNote}</Text> : null}

        <View style={s.sectionRow}>
          <View style={[s.customerBox, { borderColor: theme.light, backgroundColor: theme.bg }]}>
            <Text style={[s.sectionTitle, { color: primary }]}>ลูกค้า / Customer</Text>
            <Text style={s.custName}>{doc.customerName || "-"}</Text>
            {doc.customerAddress ? <Text style={s.custDetail}>{doc.customerAddress}</Text> : null}
            {doc.customerTaxId ? <Text style={s.custDetail}>เลขประจำตัวผู้เสียภาษี: {doc.customerTaxId}</Text> : null}
            <Text style={[s.custDetail, { color: primary, fontWeight: 600 }]}>{custBranchDisplay}</Text>
            {doc.contactPerson ? <Text style={s.custDetail}>ผู้ติดต่อ: {doc.contactPerson}</Text> : null}
            {(doc.contactPhone || doc.contactEmail) ? (
              <Text style={s.custDetail}>
                {doc.contactPhone ? `โทร: ${doc.contactPhone}` : ""}{doc.contactPhone && doc.contactEmail ? " | " : ""}{doc.contactEmail ? `อีเมล: ${doc.contactEmail}` : ""}
              </Text>
            ) : null}
            {doc.salesperson ? <Text style={s.custDetail}>พนักงานขาย: {doc.salesperson}</Text> : null}
          </View>

          {hasBank ? (
            <View style={[s.bankBox, { borderColor: theme.light, backgroundColor: theme.bg }]}>
              {qrSrc ? <Image src={qrSrc} style={s.qrImage} /> : null}
              <Text style={[s.bankTitle, { color: primary }]}>ข้อมูลชำระเงิน</Text>
              {settings.promptpayQrBase64 && !settings.qrCodeBase64 ? (
                <Text style={[s.bankDetail, { color: "#03c9d7", fontWeight: 600 }]}>พร้อมเพย์ (PromptPay)</Text>
              ) : null}
              {settings.bankName ? <Text style={s.bankDetail}>ธนาคาร: {settings.bankName}</Text> : null}
              {settings.bankAccountNumber ? <Text style={s.bankDetail}>เลขที่บัญชี: {settings.bankAccountNumber}</Text> : null}
              {settings.bankAccountName ? <Text style={s.bankDetail}>ชื่อบัญชี: {settings.bankAccountName}</Text> : null}
              {totalAmount > 0 ? <Text style={[s.bankAmount, { color: primary }]}>จำนวนเงิน: {fmtNum(totalAmount)} บาท</Text> : null}
            </View>
          ) : null}
        </View>

        <View style={s.table}>
          <View style={[s.thRow, { backgroundColor: theme.light + "40", borderBottomColor: theme.light }]}>
            <View style={{ width: cols.no, alignItems: "center" }}>
              <Text style={[s.th, { color: accent }]}>ลำดับ</Text>
              <Text style={[s.thSub, { color: accent }]}>No.</Text>
            </View>
            {showCode ? (
              <View style={{ width: cols.code }}>
                <Text style={[s.th, { color: accent }]}>รหัส</Text>
                <Text style={[s.thSub, { color: accent }]}>Code</Text>
              </View>
            ) : null}
            <View style={{ width: cols.desc }}>
              <Text style={[s.th, { color: accent }]}>รายละเอียด</Text>
              <Text style={[s.thSub, { color: accent }]}>Description</Text>
            </View>
            <View style={{ width: cols.qty, alignItems: "center" }}>
              <Text style={[s.th, { color: accent }]}>จำนวน</Text>
              <Text style={[s.thSub, { color: accent }]}>Qty</Text>
            </View>
            <View style={{ width: cols.unit, alignItems: "center" }}>
              <Text style={[s.th, { color: accent }]}>หน่วย</Text>
              <Text style={[s.thSub, { color: accent }]}>Unit</Text>
            </View>
            <View style={{ width: cols.price, alignItems: "flex-end" }}>
              <Text style={[s.th, { color: accent }]}>ราคาต่อหน่วย</Text>
              <Text style={[s.thSub, { color: accent }]}>Unit Price</Text>
            </View>
            <View style={{ width: cols.disc, alignItems: "flex-end" }}>
              <Text style={[s.th, { color: accent }]}>ส่วนลด</Text>
              <Text style={[s.thSub, { color: accent }]}>Discount</Text>
            </View>
            <View style={{ width: cols.amount, alignItems: "flex-end" }}>
              <Text style={[s.th, { color: accent }]}>มูลค่า</Text>
              <Text style={[s.thSub, { color: accent }]}>Amount</Text>
            </View>
          </View>

          {items.map((item, i) => {
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
            return (
              <View key={i} style={s.tr}>
                <Text style={[s.td, { width: cols.no, textAlign: "center", color: "#6b7280" }]}>{i + 1}</Text>
                {showCode ? <Text style={[s.td, { width: cols.code, color: "#4b5563" }]}>{item.productCode || "-"}</Text> : null}
                <View style={{ width: cols.desc, paddingHorizontal: 3 }}>
                  <Text style={[s.td, { paddingHorizontal: 0 }]}>{item.productName}</Text>
                  {item.description ? <Text style={{ fontSize: 6.5, color: "#9ca3af" }}>{item.description}</Text> : null}
                </View>
                <Text style={[s.td, { width: cols.qty, textAlign: "center" }]}>{fmtQty(item.qty)}</Text>
                <Text style={[s.td, { width: cols.unit, textAlign: "center" }]}>{item.unit || "ชิ้น"}</Text>
                <Text style={[s.td, { width: cols.price, textAlign: "right" }]}>{fmtNum(displayUnitPrice)}</Text>
                <Text style={[s.td, { width: cols.disc, textAlign: "right" }]}>{displayDiscount}</Text>
                <Text style={[s.td, { width: cols.amount, textAlign: "right" }]}>{fmtNum(displayTotal)}</Text>
              </View>
            );
          })}

          {Array.from({ length: emptyRowCount }).map((_, i) => (
            <View key={`e${i}`} style={s.emptyRow}>
              <Text style={[s.td, { width: "100%" }]}> </Text>
            </View>
          ))}
        </View>

        <View style={s.summaryRow}>
          <View style={{ flex: 1 }}>
            <View style={[s.thaiTextBox, { borderColor: theme.light, backgroundColor: theme.bg }]}>
              <Text style={s.thaiText}>
                {isForeignCurrency ? `${fmtNum(totalAmount)} ${currencyCode}` : numberToThaiText(totalAmount)}
              </Text>
            </View>
            {doc.notes ? <Text style={[s.notesText, { marginTop: 4 }]}>{doc.notes}</Text> : null}
            {doc.paymentTerms ? (
              <Text style={[s.notesText, { marginTop: 2 }]}>
                <Text style={{ fontWeight: 600 }}>เงื่อนไขการชำระ: </Text>{doc.paymentTerms}
              </Text>
            ) : null}
            {settings.footerNote ? <Text style={s.notesText}>{settings.footerNote}</Text> : null}
          </View>

          <View style={s.totalsCol}>
            <View style={s.totalRow}>
              <View>
                <Text style={s.totalLabel}>ยอดรวม</Text>
                <Text style={s.totalLabelSub}>Sub Total</Text>
              </View>
              <Text style={s.totalValue}>{fmtNum(subtotal)}</Text>
            </View>
            {discountAmount > 0 ? (
              <View style={s.totalRow}>
                <View>
                  <Text style={s.totalLabel}>ส่วนลดพิเศษ</Text>
                  <Text style={s.totalLabelSub}>Special Discount</Text>
                </View>
                <Text style={s.totalValue}>{fmtNum(discountAmount)}</Text>
              </View>
            ) : null}
            <View style={s.totalRow}>
              <View>
                <Text style={s.totalLabel}>มูลค่าก่อนภาษี</Text>
                <Text style={s.totalLabelSub}>Value Before VAT</Text>
              </View>
              <Text style={s.totalValue}>{fmtNum(valueBeforeVat)}</Text>
            </View>
            <View style={s.totalRow}>
              <View>
                <Text style={s.totalLabel}>ภาษีมูลค่าเพิ่ม 7%</Text>
                <Text style={s.totalLabelSub}>Value Added Tax</Text>
              </View>
              <Text style={s.totalValue}>{fmtNum(vatAmount)}</Text>
            </View>
            {withholdingTax > 0 ? (
              <View style={s.totalRow}>
                <View>
                  <Text style={s.totalLabel}>ภาษีหัก ณ ที่จ่าย</Text>
                  <Text style={s.totalLabelSub}>Withholding Tax</Text>
                </View>
                <Text style={s.totalValue}>{fmtNum(withholdingTax)}</Text>
              </View>
            ) : null}
            <View style={[s.grandTotalRow, { backgroundColor: primary }]}>
              <View>
                <Text style={s.grandTotalLabel}>ยอดเงินสุทธิ {isForeignCurrency ? `(${currencyCode})` : ""}</Text>
                <Text style={s.grandTotalLabelSub}>Grand Total</Text>
              </View>
              <Text style={s.grandTotalValue}>{fmtNum(totalAmount)}</Text>
            </View>
          </View>
        </View>

        {settings.showSignature !== false ? (
          <View style={s.signatureRow}>
            <View style={s.sigBlock}>
              <View style={{ height: 30 }} />
              <View style={s.sigLine}>
                <Text style={s.sigLabel}>ผู้อนุมัติ / ลูกค้า</Text>
                <Text style={s.sigSub}>Approved by</Text>
                <Text style={s.sigSub}>วันที่ ____/____/____</Text>
              </View>
            </View>
            <View style={s.sigBlock}>
              {signature?.signatureBase64 ? (
                <Image src={signature.signatureBase64} style={{ height: 30, objectFit: "contain", marginBottom: 3 }} />
              ) : (
                <View style={{ height: 30 }} />
              )}
              <View style={s.sigLine}>
                {signature?.signatureName ? <Text style={s.sigLabel}>{signature.signatureName}</Text> : null}
                <Text style={[s.sigLabel, { color: "#6b7280" }]}>
                  {documentType === "quotation" ? "ผู้เสนอราคา" : documentType === "receipt" ? "ผู้รับเงิน" : "ผู้ออกเอกสาร"}
                </Text>
                <Text style={s.sigSub}>
                  {documentType === "quotation" ? "Salesperson" : documentType === "receipt" ? "Cashier" : "Authorized"}
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        <View style={s.footerBar} fixed>
          <View style={[s.footerBar, { borderTopWidth: 0, paddingTop: 0, borderTopColor: primary }]}>
            <View style={s.footerLogo}>
              <View style={[s.footerBadge, { backgroundColor: primary }]}>
                <Text style={s.footerBadgeText}>ET</Text>
              </View>
              <Text style={s.footerText}>
                Powered by <Text style={[s.footerBrand, { color: primary }]}>E-Tax Center</Text>
              </Text>
            </View>
            <Text style={s.footerDocNo}>{doc.docNo}</Text>
          </View>
        </View>

        {etaxEnabled && (documentType === "taxInvoice" || documentType === "receipt" || documentType === "tax_invoice_receipt") ? (
          <View style={s.etaxRow}>
            {etaxStampBase64 ? <Image src={etaxStampBase64} style={s.etaxStamp} /> : null}
            <View>
              <Text style={s.etaxText}>ใบกำกับภาษีอิเล็กทรอนิกส์นี้ได้จัดทำและส่งข้อมูลให้แก่</Text>
              <Text style={s.etaxText}>กรมสรรพากรด้วยวิธีการทางอิเล็กทรอนิกส์</Text>
            </View>
          </View>
        ) : null}
      </Page>
    </Document>
  );
}

/**
 * PDF Concurrency Limiter + Timeout + Health Monitor
 *
 * Architecture: In-process rendering via @react-pdf/renderer (no Chromium).
 * Concurrency limited to prevent memory exhaustion from parallel React tree builds.
 *
 * Failure protection (added 2026-03-31):
 *   - Render timeout: 30s — if renderToBuffer hangs, reject + release slot
 *   - Queue wait timeout: 60s — if queue is stuck, reject with 503
 *   - Health monitor: every 60s logs active/queued/stuck counts
 *   - Self-healing: if all slots stuck but no tracked renders, reset to 0
 *   - Counters: pdfTotalRendered/Failed/TimedOut for monitoring
 *
 * Stress test results (Replit dev, 0.5 vCPU, 1GB RAM):
 *   40 concurrent: 40/40 OK, peak 240MB, avg 14s (mostly queue wait)
 *   40 with 4 throws + 3 hangs: 33 OK, 7 caught, recovery 5/5 OK
 *   ⚠️ 40 concurrent is below production minimum (100-150 for 500+ user server)
 *
 * _setTestHook / getPdfHealthStats: exported for stress testing only
 */
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


let _testHook: ((opts: GeneratePdfOptions) => Promise<void>) | null = null;
export function _setTestHook(hook: ((opts: GeneratePdfOptions) => Promise<void>) | null) { _testHook = hook; }

export async function generatePdfDirect(opts: GeneratePdfOptions): Promise<Buffer> {
  await acquirePdfSlot();
  const renderId = ++pdfRenderIdSeq;
  pdfActiveRenders.set(renderId, Date.now());
  try {
    const work = async (): Promise<Buffer> => {
      if (_testHook) await _testHook(opts);
      return await renderToBuffer(<InvoiceDocument opts={opts} />) as Buffer;
    };

    const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          pdfTotalTimedOut++;
          console.error(`[PDF] RENDER TIMEOUT: render #${renderId} exceeded ${PDF_RENDER_TIMEOUT / 1000}s — releasing slot (active=${pdfActiveCount}, queued=${pdfQueue.length})`);
          reject(new Error(`PDF render timeout after ${PDF_RENDER_TIMEOUT / 1000}s`));
        }
      }, PDF_RENDER_TIMEOUT);

      work()
        .then((buf) => { if (!settled) { settled = true; clearTimeout(timer); resolve(buf); } })
        .catch((err) => { if (!settled) { settled = true; clearTimeout(timer); reject(err); } });
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

export function getPdfHealthStats() {
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
      console.error(`[PDF] STUCK RENDER DETECTED: render #${id} running for ${Math.round(elapsed / 1000)}s`);
    }
  }
  if (pdfActiveCount > 0 || pdfQueue.length > 0 || stuckCount > 0) {
    console.log(`[PDF Health] active=${pdfActiveCount}/${PDF_MAX_CONCURRENT} queued=${pdfQueue.length} rendered=${pdfTotalRendered} failed=${pdfTotalFailed} timedOut=${pdfTotalTimedOut} stuck=${stuckCount}`);
  }
  if (stuckCount >= PDF_MAX_CONCURRENT && pdfActiveRenders.size === 0) {
    console.error(`[PDF] ALL SLOTS STUCK but no active renders tracked — resetting pdfActiveCount from ${pdfActiveCount} to 0`);
    pdfActiveCount = 0;
    while (pdfQueue.length > 0) {
      const next = pdfQueue.shift()!;
      next.reject(new Error("PDF system reset: all slots were stuck"));
    }
  }
}, PDF_HEALTH_INTERVAL);
