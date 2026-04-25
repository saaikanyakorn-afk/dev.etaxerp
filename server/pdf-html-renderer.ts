import {
  DOCUMENT_TYPES_FULL,
  getDocumentType,
  getDocTypeColor,
  parseCategoryColors,
} from "@shared/document-types";
import type { GeneratePdfOptions } from "./pdf-react-generator";

function esc(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmt(n: number): string {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
  const f = dateFormat || "DD/MM/YYYY";
  const sep = f.includes("/") ? "/" : f.includes("-") ? "-" : ".";
  const parts = f.split(/[/\-\.]/);
  return parts.map(p => {
    const pu = p.toUpperCase();
    if (pu.startsWith("D")) return dd;
    if (pu.startsWith("M")) return mm;
    if (pu.startsWith("Y")) return yyyy;
    return p;
  }).join(sep);
}

export function renderDocumentHtml(opts: GeneratePdfOptions): string {
  const { company, settings, document: doc, documentType, signature, etaxStampBase64 } = opts;

  const docInfo = getDocumentType(documentType) || DOCUMENT_TYPES_FULL[0];
  const categoryColors = parseCategoryColors(settings.docTypeColors || null);
  const theme = getDocTypeColor(documentType, categoryColors, settings.colorMode || "color");
  const primary = theme.primary;
  const accent = theme.accent;

  const isTaxDoc = documentType === "tax_invoice" || documentType === "receipt" || documentType === "tax_invoice_receipt";
  const era = isTaxDoc ? "BE" : (settings.dateEra || "CE");

  const companyName = company.name || "บริษัท";
  const companyAddress = (doc as any).sellerBranchAddress || company.address || "";
  const companyPhone = company.phone || "";
  const companyTaxId = company.taxId || "";
  const sellerBranchCode = (doc as any).sellerBranchCode || "";
  const sellerBranchName = (doc as any).sellerBranchName || "";
  const companyBranch = company.branch || "สำนักงานใหญ่";

  const hasBranch = sellerBranchCode || sellerBranchName;
  const isBranchHQ = hasBranch
    ? (!sellerBranchCode || sellerBranchCode === "00000")
    : (!companyBranch || companyBranch === "สำนักงานใหญ่" || companyBranch === "00000");
  const branchDisplay = isBranchHQ
    ? "สำนักงานใหญ่"
    : hasBranch
      ? `สาขาที่ ${sellerBranchCode}${sellerBranchName ? ` ${sellerBranchName}` : ""}`
      : `สาขาที่ ${companyBranch}`;

  const custBranch = doc.customerBranch || "";
  const isCustHQ = !custBranch || custBranch === "สำนักงานใหญ่" || custBranch === "00000";
  const custBranchDisplay = isCustHQ ? "สำนักงานใหญ่" : `สาขาที่ ${custBranch}`;

  const items = doc.items || [];
  const subtotal = parseFloat(String(doc.subtotal ?? items.reduce((s: number, i: any) => s + (i.total || 0), 0)));
  const discountAmount = parseFloat(String(doc.discountAmount || "0"));
  const vatAmount = parseFloat(String(doc.vatAmount || "0"));
  const withholdingTax = parseFloat(String(doc.withholdingTax || "0"));
  const totalAmount = parseFloat(String(doc.totalAmount || "0"));
  const priceMode = doc.priceMode || "excluded";
  const valueBeforeVat = priceMode === "included"
    ? (subtotal - discountAmount - vatAmount)
    : (subtotal - discountAmount);

  const currencyCode = doc.currencyCode || "THB";
  const isForeignCurrency = currencyCode !== "THB";

  const minRows = 5;
  const emptyRows = Math.max(0, minRows - items.length);
  const showProductCode = settings.showProductCode !== false;

  const logoHtml = (settings.showLogo !== false) && settings.logoBase64
    ? `<div style="width:80px;height:80px;display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden">
         <img src="${settings.logoBase64}" style="max-width:100%;max-height:100%;object-fit:contain" />
       </div>`
    : "";

  const companyInfoHtml = `
    <div style="text-align:left">
      <div style="font-weight:bold;font-size:14px;color:#1f2937">${esc(companyName)}</div>
      ${(company as any).nameEn ? `<div style="font-size:10px;color:#6b7280">${esc((company as any).nameEn)}</div>` : ""}
      ${companyAddress ? `<div style="font-size:10px;color:#4b5563;margin-top:2px;max-width:360px">${esc(companyAddress)}</div>` : ""}
      ${(settings.showTaxId !== false) && companyTaxId ? `<div style="font-size:10px;color:#4b5563">เลขประจำตัวผู้เสียภาษี: ${esc(companyTaxId)}</div>` : ""}
      ${(settings.showBranch !== false) ? `<div style="font-size:10px;font-weight:500;color:${primary}">${esc(branchDisplay)}</div>` : ""}
      ${companyPhone || company.email ? `<div style="font-size:10px;color:#4b5563">${companyPhone ? `โทร. ${esc(companyPhone)}` : ""}${companyPhone && company.email ? "  " : ""}${company.email ? `อีเมล: ${esc(company.email)}` : ""}</div>` : ""}
      ${(company as any).lineId || (company as any).facebook ? `<div style="font-size:10px;color:#4b5563">${(company as any).lineId ? `LINE: ${esc((company as any).lineId)}` : ""}${(company as any).lineId && (company as any).facebook ? "  " : ""}${(company as any).facebook ? `Facebook: ${esc((company as any).facebook)}` : ""}</div>` : ""}
      ${(company as any).instagram ? `<div style="font-size:10px;color:#4b5563">Instagram: ${esc((company as any).instagram)}</div>` : ""}
      ${(company as any).website ? `<div style="font-size:10px;color:#4b5563">เว็บไซต์: ${esc((company as any).website)}</div>` : ""}
    </div>
  `;

  const docTitleHtml = `
    <div style="text-align:right">
      <div style="display:inline-block;padding:4px 12px;border-radius:6px;background:${theme.bg};text-align:right">
        <div style="font-weight:bold;font-size:16px;color:${primary}">${esc(docInfo.label)}</div>
        <div style="font-size:10px;color:#6b7280;margin-top:1px">${esc(docInfo.labelEn?.toUpperCase())}</div>
      </div>
      <div style="margin-top:8px;font-size:10px">
        <div>เลขที่: <span style="font-weight:600;color:${accent}">${esc(doc.docNo)}</span></div>
        <div>วันที่: ${fmtDate(doc.docDate, era, settings.dateFormat)}</div>
        ${doc.validUntil ? `<div>กำหนดส่ง: ${fmtDate(doc.validUntil, era, settings.dateFormat)}</div>` : ""}
        ${doc.creditDays != null && Number(doc.creditDays) > 0 ? `<div>เครดิต: ${doc.creditDays} วัน</div>` : ""}
        ${isForeignCurrency ? `<div style="margin-top:4px;font-size:9px;font-weight:600;color:${accent}">สกุลเงิน: ${currencyCode}</div>` : ""}
        ${doc.refDoc ? `<div style="margin-top:4px;font-size:9px;color:${primary}">อ้างอิง: ${esc(doc.refDoc)}</div>` : ""}
      </div>
    </div>
  `;

  const headerNoteHtml = settings.headerNote
    ? `<div style="font-size:10px;color:#6b7280;font-style:italic;margin-bottom:12px">${esc(settings.headerNote)}</div>`
    : "";

  const customerBoxHtml = `
    <div style="flex:1;border:1px solid ${theme.light || "#e5e7eb"};border-radius:4px;padding:10px;background:${theme.bg || "#fafafa"}">
      <div style="font-size:10px;font-weight:500;color:${primary};margin-bottom:4px">ลูกค้า / Customer</div>
      <div style="font-weight:500;font-size:12px;color:#1f2937">${esc(doc.customerName) || "-"}</div>
      ${doc.customerAddress ? `<div style="font-size:10px;color:#4b5563">${esc(doc.customerAddress)}</div>` : ""}
      ${doc.customerTaxId ? `<div style="font-size:10px;color:#4b5563">เลขประจำตัวผู้เสียภาษี: ${esc(doc.customerTaxId)}</div>` : ""}
      <div style="font-size:10px;font-weight:500;color:${primary}">${esc(custBranchDisplay)}</div>
      ${doc.contactPerson ? `<div style="font-size:10px;color:#4b5563">ผู้ติดต่อ: ${esc(doc.contactPerson)}</div>` : ""}
      ${doc.contactPhone || doc.contactEmail ? `<div style="font-size:10px;color:#4b5563">${doc.contactPhone ? `โทร: ${esc(doc.contactPhone)}` : ""}${doc.contactPhone && doc.contactEmail ? " | " : ""}${doc.contactEmail ? `อีเมล: ${esc(doc.contactEmail)}` : ""}</div>` : ""}
      ${doc.salesperson ? `<div style="font-size:10px;color:#4b5563">พนักงานขาย: ${esc(doc.salesperson)}</div>` : ""}
    </div>
  `;

  const hasBankInfo = settings.bankName || settings.qrBase64;
  const bankSideBoxHtml = hasBankInfo ? `
    <div style="width:192px;border:1px solid ${theme.light || "#e5e7eb"};border-radius:4px;padding:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:${theme.bg || "#fafafa"}">
      ${settings.qrBase64 ? `<div style="width:80px;height:80px;border:1px solid #e5e7eb;border-radius:4px;overflow:hidden;display:flex;align-items:center;justify-content:center;background:#fff;margin-bottom:6px"><img src="${settings.qrBase64}" style="max-width:100%;max-height:100%;object-fit:contain" /></div>` : ""}
      <div style="font-size:9px;color:#4b5563;text-align:center;width:100%">
        <div style="font-weight:500;color:${primary};margin-bottom:2px">ข้อมูลชำระเงิน</div>
        ${settings.bankName ? `<div>ธนาคาร: ${esc(settings.bankName)}</div>` : ""}
        ${settings.bankAccountNumber ? `<div>เลขที่บัญชี: ${esc(settings.bankAccountNumber)}</div>` : ""}
        ${settings.bankAccountName ? `<div>ชื่อบัญชี: ${esc(settings.bankAccountName)}</div>` : ""}
        ${totalAmount > 0 ? `<div style="font-weight:600;font-size:10px;margin-top:4px;color:${primary}">จำนวนเงิน: ${fmt(totalAmount)} บาท</div>` : ""}
      </div>
    </div>
  ` : "";

  const itemsHeaderHtml = `
    <tr style="background:${theme.bg || "#f0f0f0"}">
      <th style="text-align:center;padding:6px 4px;font-size:10px;font-weight:600;border-bottom:1px solid ${theme.light || "#e5e7eb"};width:32px;color:${accent}">
        <div>ลำดับ</div><div style="font-size:8px;font-weight:normal;opacity:0.7">No.</div>
      </th>
      ${showProductCode ? `<th style="text-align:left;padding:6px 8px;font-size:10px;font-weight:600;border-bottom:1px solid ${theme.light || "#e5e7eb"};width:64px;color:${accent}"><div>รหัส</div><div style="font-size:8px;font-weight:normal;opacity:0.7">Code</div></th>` : ""}
      <th style="text-align:left;padding:6px 8px;font-size:10px;font-weight:600;border-bottom:1px solid ${theme.light || "#e5e7eb"};color:${accent}">
        <div>รายละเอียด</div><div style="font-size:8px;font-weight:normal;opacity:0.7">Description</div>
      </th>
      <th style="text-align:center;padding:6px 8px;font-size:10px;font-weight:600;border-bottom:1px solid ${theme.light || "#e5e7eb"};width:48px;color:${accent}">
        <div>จำนวน</div><div style="font-size:8px;font-weight:normal;opacity:0.7">Qty</div>
      </th>
      <th style="text-align:center;padding:6px 4px;font-size:10px;font-weight:600;border-bottom:1px solid ${theme.light || "#e5e7eb"};width:40px;color:${accent}">
        <div>หน่วย</div><div style="font-size:8px;font-weight:normal;opacity:0.7">Unit</div>
      </th>
      <th style="text-align:right;padding:6px 8px;font-size:10px;font-weight:600;border-bottom:1px solid ${theme.light || "#e5e7eb"};width:80px;color:${accent}">
        <div>ราคาต่อหน่วย</div><div style="font-size:8px;font-weight:normal;opacity:0.7">Unit Price</div>
      </th>
      <th style="text-align:right;padding:6px 8px;font-size:10px;font-weight:600;border-bottom:1px solid ${theme.light || "#e5e7eb"};width:80px;color:${accent}">
        <div>ส่วนลด</div><div style="font-size:8px;font-weight:normal;opacity:0.7">Discount</div>
      </th>
      <th style="text-align:right;padding:6px 8px;font-size:10px;font-weight:600;border-bottom:1px solid ${theme.light || "#e5e7eb"};width:80px;color:${accent}">
        <div>มูลค่า</div><div style="font-size:8px;font-weight:normal;opacity:0.7">Amount</div>
      </th>
    </tr>
  `;

  const itemRowsHtml = items.map((item: any, i: number) => {
    const vatType = item.vatType || "vat7";
    const isIncluded = priceMode === "included" && vatType === "vat7";
    const displayUnitPrice = isIncluded ? Math.round((item.unitPrice * 100 / 107) * 100) / 100 : item.unitPrice;
    const displayTotal = isIncluded ? Math.round((item.total * 100 / 107) * 100) / 100 : item.total;
    const dv = parseFloat(String(item.discount)) || 0;
    let displayDiscount: string;
    if (dv === 0) { displayDiscount = fmt(0); }
    else if (item.discountType === "percent") { displayDiscount = `${parseFloat(dv.toFixed(2))}%`; }
    else { const ddv = isIncluded ? Math.round((dv * 100 / 107) * 100) / 100 : dv; displayDiscount = fmt(ddv); }

    const qtyNum = Number(item.qty);
    const qtyStr = isNaN(qtyNum) ? "0" : qtyNum % 1 === 0 ? String(Math.round(qtyNum)) : parseFloat(qtyNum.toFixed(2)).toString();

    return `
    <tr style="border-bottom:1px solid #f3f4f6">
      <td style="padding:6px 4px;font-size:10px;text-align:center;color:#6b7280">${i + 1}</td>
      ${showProductCode ? `<td style="padding:6px 8px;font-size:10px;color:#4b5563">${esc(item.productCode) || "-"}</td>` : ""}
      <td style="padding:6px 8px;font-size:10px">
        <div>${esc(item.productName)}</div>
        ${item.description ? `<div style="font-size:9px;color:#9ca3af">${esc(item.description)}</div>` : ""}
      </td>
      <td style="padding:6px 8px;font-size:10px;text-align:center">${qtyStr}</td>
      <td style="padding:6px 4px;font-size:10px;text-align:center">${esc(item.unit) || "ชิ้น"}</td>
      <td style="padding:6px 8px;font-size:10px;text-align:right">${fmt(displayUnitPrice)}</td>
      <td style="padding:6px 8px;font-size:10px;text-align:right">${displayDiscount}</td>
      <td style="padding:6px 8px;font-size:10px;text-align:right">${fmt(displayTotal)}</td>
    </tr>`;
  }).join("");

  const colCount = showProductCode ? 8 : 7;
  const emptyRowsHtml = Array.from({ length: emptyRows }, () =>
    `<tr style="border-bottom:1px solid #f3f4f6"><td style="padding:6px 4px;font-size:10px">&nbsp;</td>${showProductCode ? '<td style="padding:6px 8px">&nbsp;</td>' : ""}<td style="padding:6px 8px">&nbsp;</td><td style="padding:6px 8px">&nbsp;</td><td style="padding:6px 4px">&nbsp;</td><td style="padding:6px 8px">&nbsp;</td><td style="padding:6px 8px">&nbsp;</td><td style="padding:6px 8px">&nbsp;</td></tr>`
  ).join("");

  const thaiTextBoxHtml = `
    <div style="border:1px solid ${theme.light || "#e5e7eb"};border-radius:4px;padding:8px;background:${theme.bg || "#fafafa"};text-align:center;font-size:10px;font-weight:600;color:#374151;margin-bottom:8px">
      ${isForeignCurrency ? `${fmt(totalAmount)} ${currencyCode}` : esc(numberToThaiText(totalAmount))}
    </div>
  `;

  const notesHtml = [
    doc.notes ? `<div style="font-size:10px;color:#6b7280;white-space:pre-line;margin-bottom:8px">${esc(doc.notes)}</div>` : "",
    doc.paymentTerms ? `<div style="font-size:10px;color:#6b7280;white-space:pre-line;margin-bottom:8px"><span style="font-weight:500">เงื่อนไขการชำระ:</span> ${esc(doc.paymentTerms)}</div>` : "",
    settings.footerNote ? `<div style="font-size:10px;color:#6b7280;white-space:pre-line">${esc(settings.footerNote)}</div>` : "",
  ].join("");

  const summaryRows = [
    { label: "ยอดรวม", en: "Sub Total", val: subtotal, show: true },
    { label: "ส่วนลดพิเศษ", en: "Special Discount", val: discountAmount, show: discountAmount > 0 },
    { label: "มูลค่าก่อนภาษี", en: "Value Before VAT", val: valueBeforeVat, show: true },
    { label: "ภาษีมูลค่าเพิ่ม 7%", en: "Value Added Tax", val: vatAmount, show: true },
    { label: "ภาษีหัก ณ ที่จ่าย", en: "Withholding Tax", val: withholdingTax, show: withholdingTax > 0 },
  ];

  const summaryHtml = `
    <div style="width:208px">
      ${summaryRows.filter(r => r.show).map(r => `
        <div style="display:flex;justify-content:space-between;font-size:10px;padding:4px 0;border-bottom:1px solid #f3f4f6">
          <div>
            <div>${r.label}</div>
            <div style="font-size:8px;color:#9ca3af">${r.en}</div>
          </div>
          <span style="align-self:center">${fmt(r.val)}</span>
        </div>
      `).join("")}
      <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:bold;padding:8px;margin-top:4px;border-radius:4px;background:${primary};color:white">
        <div>
          <div>ยอดเงินสุทธิ${isForeignCurrency ? ` (${currencyCode})` : ""}</div>
          <div style="font-size:8px;font-weight:normal;opacity:0.8">Grand Total</div>
        </div>
        <span style="align-self:center">${fmt(totalAmount)}</span>
      </div>
    </div>
  `;

  let signatureHtml = "";
  if (settings.showSignature !== false) {
    const sigImg = signature?.signatureBase64
      ? `<img src="${signature.signatureBase64}" style="height:40px;margin:0 auto 4px;display:block;object-fit:contain" />`
      : `<div style="height:40px;margin-bottom:4px"></div>`;

    const rightLabel = documentType === "quotation" ? "ผู้เสนอราคา"
      : documentType === "receipt" ? "ผู้รับเงิน"
      : "ผู้ออกเอกสาร";
    const rightLabelEn = documentType === "quotation" ? "Salesperson"
      : documentType === "receipt" ? "Cashier"
      : "Authorized";

    signatureHtml = `
      <div style="display:flex;justify-content:space-between;margin-top:16px;padding-top:16px">
        <div style="text-align:center;width:160px">
          <div style="height:40px;margin-bottom:4px"></div>
          <div style="border-top:1px solid #9ca3af;padding-top:4px">
            <div style="font-size:10px;font-weight:500">ผู้อนุมัติ / ลูกค้า</div>
            <div style="font-size:9px;color:#6b7280">Approved by</div>
            <div style="font-size:9px;color:#6b7280">วันที่ ____/____/____</div>
          </div>
        </div>
        <div style="text-align:center;width:160px">
          ${sigImg}
          <div style="border-top:1px solid #9ca3af;padding-top:4px">
            ${signature?.signatureName ? `<div style="font-size:10px;font-weight:500">${esc(signature.signatureName)}</div>` : ""}
            <div style="font-size:10px;font-weight:500;color:#6b7280">${rightLabel}</div>
            <div style="font-size:9px;color:#6b7280">${rightLabelEn}</div>
          </div>
        </div>
      </div>
    `;
  }

  const etaxHtml = etaxStampBase64 && isTaxDoc ? `
    <div style="display:flex;justify-content:flex-end;margin-top:8px">
      <div style="display:flex;align-items:center;gap:10px;padding:6px 12px">
        <img src="${etaxStampBase64}" style="height:28px;object-fit:contain" />
        <div style="font-size:8px;line-height:1.4;color:#6b7280">
          <div>ใบกำกับภาษีอิเล็กทรอนิกส์นี้ได้จัดทำและส่งข้อมูลให้แก่</div>
          <div>กรมสรรพากรด้วยวิธีการทางอิเล็กทรอนิกส์</div>
        </div>
      </div>
    </div>
  ` : "";

  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(docInfo.label)} ${esc(doc.docNo)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Sarabun', 'Noto Sans Thai', sans-serif;
      font-size: 11px;
      line-height: 1.5;
      color: #111827;
      background: white;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .page {
      width: 210mm;
      min-height: 297mm;
      margin: 0;
      background: white;
      display: flex;
      flex-direction: column;
    }
    .content {
      padding: 20px 32px;
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: calc(297mm - 6px - 40px);
    }
    table { border-collapse: collapse; width: 100%; font-variant-numeric: tabular-nums; }
    @page { size: A4; margin: 0; }
  </style>
</head>
<body>
  <div class="page">
    <div class="content">

      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px">
        <div style="display:flex;align-items:flex-start;gap:20px">
          ${logoHtml}
          ${companyInfoHtml}
        </div>
        ${docTitleHtml}
      </div>

      ${headerNoteHtml}

      <div style="display:flex;gap:12px;margin-bottom:16px">
        ${customerBoxHtml}
        ${bankSideBoxHtml}
      </div>

      <table style="margin-bottom:16px">
        <thead>${itemsHeaderHtml}</thead>
        <tbody>
          ${itemRowsHtml}
          ${emptyRowsHtml}
        </tbody>
      </table>

      <div style="display:flex;gap:16px;margin-bottom:16px">
        <div style="flex:1">
          ${thaiTextBoxHtml}
          ${notesHtml}
        </div>
        ${summaryHtml}
      </div>

      ${signatureHtml}

      <div style="flex-grow:1"></div>

      <div style="border-top:2px solid ${primary};padding-top:8px;display:flex;align-items:center;justify-content:space-between;margin-top:16px">
        <div style="display:flex;align-items:center;gap:6px">
          <div style="width:16px;height:16px;border-radius:4px;background:${primary};display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:7px">ET</div>
          <span style="font-size:8px;color:#9ca3af;letter-spacing:0.5px">Powered by <span style="font-weight:600;color:${primary}">E-Tax Center</span></span>
        </div>
        <span style="font-size:8px;color:#d1d5db">${esc(doc.docNo)}</span>
      </div>

      ${etaxHtml}
    </div>
  </div>
</body>
</html>`;
}

export function renderPosReceiptHtml(opts: {
  companyName: string;
  companyAddress?: string;
  companyPhone?: string;
  companyTaxId?: string;
  logoBase64?: string | null;
  receiptNo: string;
  cashierName?: string;
  posName?: string;
  items: Array<{ name: string; qty: number; price: number; total: number }>;
  subtotal: number;
  discount: number;
  vat: number;
  grandTotal: number;
  paymentMethod?: string;
  change?: number;
  headerText?: string;
  footerText?: string;
  showLogo?: boolean;
  showCompanyInfo?: boolean;
  showQr?: boolean;
  qrBase64?: string | null;
  fontSize?: string;
  paperWidth?: string;
}): string {
  const fontConf = {
    small: { base: "11px", total: "14px" },
    medium: { base: "12px", total: "16px" },
    large: { base: "14px", total: "18px" },
    xlarge: { base: "16px", total: "20px" },
  }[opts.fontSize || "large"] || { base: "14px", total: "18px" };

  const width = opts.paperWidth === "58mm" ? "58mm" : "80mm";
  const dash = "- - - - - - - - - - - - - - - - - - - -";

  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Sarabun', 'Noto Sans Thai', sans-serif;
      font-size: ${fontConf.base};
      line-height: 1.4;
      color: #000;
      width: ${width};
    }
    .receipt { padding: 4mm 3mm; }
    .dash { text-align: center; color: #999; letter-spacing: 2px; margin: 4px 0; font-size: 10px; }
    @media print { body { width: ${width}; } @page { size: ${width} auto; margin: 0; } }
  </style>
</head>
<body>
  <div class="receipt">
    ${(opts.showLogo !== false) && opts.logoBase64 ? `<div style="text-align:center;padding:8px 0"><img src="${opts.logoBase64}" style="max-height:40px;max-width:90%;object-fit:contain" /></div>` : ""}
    ${(opts.showCompanyInfo !== false) ? `
      <div style="text-align:center;margin-bottom:4px">
        <div style="font-weight:bold;font-size:calc(${fontConf.base} + 2px)">${esc(opts.companyName)}</div>
        ${opts.companyAddress ? `<div style="color:#555">${esc(opts.companyAddress)}</div>` : ""}
        ${opts.companyPhone ? `<div style="color:#555">โทร ${esc(opts.companyPhone)}</div>` : ""}
        ${opts.companyTaxId ? `<div style="color:#555">เลขผู้เสียภาษี ${esc(opts.companyTaxId)}</div>` : ""}
      </div>
    ` : ""}
    ${opts.headerText ? `<div style="text-align:center;color:#555;white-space:pre-line;margin-bottom:4px">${esc(opts.headerText)}</div>` : ""}
    <div class="dash">${dash}</div>
    <div style="text-align:center;font-weight:bold;margin:4px 0">ใบเสร็จรับเงิน</div>
    <div style="text-align:center;color:#555;margin-bottom:4px">${esc(opts.receiptNo)}</div>
    ${opts.cashierName ? `<div style="color:#555">พนักงาน: ${esc(opts.cashierName)}</div>` : ""}
    ${opts.posName ? `<div style="color:#555;margin-bottom:4px">POS: ${esc(opts.posName)}</div>` : ""}
    <div class="dash">${dash}</div>
    <div style="padding:4px 0">
      ${opts.items.map(item => `
        <div style="margin-bottom:4px">
          <div style="font-weight:500">${esc(item.name)}</div>
          <div style="display:flex;justify-content:space-between;color:#555">
            <span>${item.qty} x ฿${fmt(item.price)}</span>
            <span>฿${fmt(item.total)}</span>
          </div>
        </div>
      `).join("")}
    </div>
    <div class="dash">${dash}</div>
    <div style="padding:4px 0">
      ${opts.discount > 0 ? `<div style="display:flex;justify-content:space-between;color:#555"><span>ส่วนลด</span><span>-฿${fmt(opts.discount)}</span></div>` : ""}
      <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:${fontConf.total}">
        <span>รวมทั้งหมด</span><span>฿${fmt(opts.grandTotal)}</span>
      </div>
      ${opts.vat > 0 ? `<div style="display:flex;justify-content:space-between;color:#555"><span>ภาษีมูลค่าเพิ่ม 7%</span><span>฿${fmt(opts.vat)}</span></div>` : ""}
      ${opts.paymentMethod ? `<div style="display:flex;justify-content:space-between;color:#555"><span>ชำระโดย</span><span>${esc(opts.paymentMethod)}</span></div>` : ""}
      ${(opts.change ?? 0) > 0 ? `<div style="display:flex;justify-content:space-between;color:#555"><span>เงินทอน</span><span>฿${fmt(opts.change!)}</span></div>` : ""}
    </div>
    ${opts.showQr && opts.qrBase64 ? `
      <div class="dash">${dash}</div>
      <div style="text-align:center;padding:8px 0">
        <img src="${opts.qrBase64}" style="width:80px;height:80px" />
      </div>
    ` : ""}
    ${opts.footerText ? `
      <div class="dash">${dash}</div>
      <div style="text-align:center;color:#555;white-space:pre-line;padding:4px 0">${esc(opts.footerText)}</div>
    ` : ""}
    <div class="dash">${dash}</div>
    <div style="display:flex;justify-content:space-between;font-size:10px;color:#999;padding:4px 0">
      <span>${new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}</span>
      <span>${esc(opts.receiptNo)}</span>
    </div>
  </div>
</body>
</html>`;
}
