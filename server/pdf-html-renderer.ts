import {
  DOCUMENT_TYPES_FULL,
  getDocumentType,
  getDocTypeColor,
  parseCategoryColors,
} from "@shared/document-types";
import type { GeneratePdfOptions } from "./pdf-react-generator";

const FONT_SIZE_MAP: Record<string, { base: string; small: string; tiny: string }> = {
  small:  { base: "10px", small: "8px", tiny: "7px" },
  medium: { base: "12px", small: "10px", tiny: "8px" },
  large:  { base: "14px", small: "11px", tiny: "9px" },
  xlarge: { base: "16px", small: "12px", tiny: "10px" },
};

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

function fmtDate(val: string | null | undefined, era?: string): string {
  if (!val) return "-";
  const m = String(val).match(/^(\d{4})-(\d{2})-(\d{2})/);
  let dd: string, mm: string, ceYear: number;
  if (m) { ceYear = Number(m[1]); mm = m[2]; dd = m[3]; }
  else { const d = new Date(val); dd = d.getDate().toString().padStart(2, "0"); mm = (d.getMonth() + 1).toString().padStart(2, "0"); ceYear = d.getFullYear(); }
  const yyyy = String(era === "BE" ? ceYear + 543 : ceYear);
  return `${dd}/${mm}/${yyyy}`;
}

interface SignatureLabels { left: string; leftSub: string; right: string; rightSub: string; }

function getSignatureLabels(docType: string): SignatureLabels {
  const map: Record<string, SignatureLabels> = {
    quotation: { left: "ผู้อนุมัติ / ลูกค้า", leftSub: "Approved by", right: "ผู้เสนอราคา", rightSub: "Salesperson" },
    sales_order: { left: "ผู้สั่งซื้อ", leftSub: "Ordered by", right: "ผู้รับคำสั่ง", rightSub: "Accepted by" },
    delivery_note: { left: "ผู้รับของ", leftSub: "Received by", right: "ผู้ส่งของ", rightSub: "Delivered by" },
    invoice: { left: "ผู้รับเอกสาร", leftSub: "Received by", right: "ผู้ออกเอกสาร", rightSub: "Issued by" },
    tax_invoice: { left: "ผู้รับเอกสาร", leftSub: "Received by", right: "ผู้มีอำนาจลงนาม", rightSub: "Authorized" },
    receipt: { left: "ผู้จ่ายเงิน", leftSub: "Paid by", right: "ผู้รับเงิน", rightSub: "Received by" },
    tax_invoice_receipt: { left: "ผู้จ่ายเงิน", leftSub: "Paid by", right: "ผู้รับเงิน", rightSub: "Received by" },
    credit_note: { left: "ผู้รับเอกสาร", leftSub: "Received by", right: "ผู้ออกเอกสาร", rightSub: "Issued by" },
    debit_note: { left: "ผู้รับเอกสาร", leftSub: "Received by", right: "ผู้ออกเอกสาร", rightSub: "Issued by" },
    purchase_request: { left: "ผู้ขอซื้อ", leftSub: "Requested by", right: "ผู้อนุมัติ", rightSub: "Approved by" },
    purchase_order: { left: "ผู้สั่งซื้อ", leftSub: "Ordered by", right: "ผู้อนุมัติ", rightSub: "Approved by" },
    payment_voucher: { left: "ผู้รับเงิน", leftSub: "Received by", right: "ผู้จ่ายเงิน", rightSub: "Paid by" },
    receipt_voucher: { left: "ผู้จ่ายเงิน", leftSub: "Paid by", right: "ผู้รับเงิน", rightSub: "Received by" },
    deposit: { left: "ผู้ชำระเงิน", leftSub: "Deposited by", right: "ผู้รับเงินมัดจำ", rightSub: "Received by" },
  };
  return map[docType] || { left: "ผู้รับเอกสาร", leftSub: "Received by", right: "ผู้ออกเอกสาร", rightSub: "Issued by" };
}

export function renderDocumentHtml(opts: GeneratePdfOptions): string {
  const { company, settings, document: doc, documentType, signature, etaxStampBase64 } = opts;

  const docInfo = getDocumentType(documentType);
  const categoryColors = parseCategoryColors(settings.docTypeColors || null);
  const theme = getDocTypeColor(documentType, categoryColors, settings.colorMode || "color");
  const primary = theme.primary;

  const fontSize = FONT_SIZE_MAP[settings.docFontSize || "medium"] || FONT_SIZE_MAP.medium;

  const showPaymentCheckboxes = ["receipt", "tax_invoice_receipt", "tax_invoice", "payment_voucher", "receipt_voucher", "deposit"].includes(documentType);
  const showInvoicePaymentTerms = documentType === "invoice";
  const showBankInfo = ["receipt", "tax_invoice_receipt", "tax_invoice", "deposit"].includes(documentType);

  const items = doc.items || [];
  const subtotal = items.reduce((s, i) => s + (i.total || 0), 0);
  const specialDiscount = doc.discountAmount || 0;
  const afterDiscount = subtotal - specialDiscount;
  const vat = doc.vatAmount || 0;
  const withholdingTax = doc.withholdingTax || 0;
  const grandTotal = doc.totalAmount || (afterDiscount + vat - withholdingTax);

  const branch = (doc as any).sellerBranchCode || company.branch;
  const isBranchHQ = !branch || branch === "สำนักงานใหญ่" || branch === "00000";
  const branchDisplay = isBranchHQ ? "สำนักงานใหญ่" : `สาขาที่ ${branch}`;

  const sigLabels = getSignatureLabels(documentType);
  const docLabel = docInfo?.label || "เอกสาร";
  const docLabelEn = docInfo?.labelEn || "Document";

  const logoHtml = settings.showLogo && settings.logoBase64
    ? `<div style="width:64px;height:64px;border:1px solid #e5e7eb;border-radius:4px;overflow:hidden;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:#f9fafb">
         <img src="${settings.logoBase64}" style="max-width:100%;max-height:100%;object-fit:contain" />
       </div>`
    : settings.showLogo
    ? `<div style="width:64px;height:64px;border:1px solid #e5e7eb;border-radius:4px;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:#f9fafb">
         <span style="font-size:${fontSize.tiny};color:#9ca3af;text-align:center;line-height:1.2">โลโก้<br/>บริษัท</span>
       </div>`
    : "";

  const companyInfoHtml = `
    <div style="flex:1">
      <div style="font-size:14px;font-weight:bold;color:#111">${esc(company.name)}</div>
      ${company.nameEn ? `<div style="font-size:${fontSize.small};color:#6b7280">${esc(company.nameEn)}</div>` : ""}
      <div style="font-size:${fontSize.small};color:#4b5563;margin-top:2px">${esc(company.address)}</div>
      ${company.phone ? `<div style="font-size:${fontSize.small};color:#6b7280">โทร ${esc(company.phone)}</div>` : ""}
      ${settings.showTaxId && company.taxId ? `<div style="font-size:${fontSize.small};color:#6b7280">เลขผู้เสียภาษี ${esc(company.taxId)}</div>` : ""}
      ${settings.showBranch ? `<div style="font-size:${fontSize.small};color:#6b7280">${esc(branchDisplay)}</div>` : ""}
    </div>
  `;

  const docTitleHtml = `
    <div style="text-align:right">
      <div style="font-size:16px;font-weight:bold;color:${primary}">${esc(docLabel)}</div>
      <div style="font-size:${fontSize.small};color:#9ca3af">${esc(docLabelEn)}</div>
      ${etaxStampBase64 ? `<div style="margin-top:4px"><img src="${etaxStampBase64}" style="height:24px" /></div>` : ""}
    </div>
  `;

  const customerHtml = `
    <table style="width:100%;border-collapse:collapse;margin-bottom:12px;font-size:${fontSize.small}">
      <tr>
        <td style="padding:3px 8px;color:#6b7280;width:80px">ลูกค้า</td>
        <td style="padding:3px 8px;font-weight:600">${esc(doc.customerName)}</td>
        <td style="padding:3px 8px;color:#6b7280;width:80px;text-align:right">เลขที่</td>
        <td style="padding:3px 8px;font-weight:600;color:${primary}">${esc(doc.docNo)}</td>
      </tr>
      <tr>
        <td style="padding:3px 8px;color:#6b7280">ที่อยู่</td>
        <td style="padding:3px 8px">${esc(doc.customerAddress)}</td>
        <td style="padding:3px 8px;color:#6b7280;text-align:right">วันที่</td>
        <td style="padding:3px 8px">${fmtDate(doc.docDate, settings.dateEra)}</td>
      </tr>
      ${doc.customerTaxId ? `
      <tr>
        <td style="padding:3px 8px;color:#6b7280">เลขผู้เสียภาษี</td>
        <td style="padding:3px 8px">${esc(doc.customerTaxId)}</td>
        ${doc.customerBranch ? `<td style="padding:3px 8px;color:#6b7280;text-align:right">สาขา</td><td style="padding:3px 8px">${esc(doc.customerBranch)}</td>` : "<td></td><td></td>"}
      </tr>` : ""}
      ${doc.refDoc ? `
      <tr>
        <td style="padding:3px 8px;color:#6b7280">อ้างอิง</td>
        <td colspan="3" style="padding:3px 8px">${esc(doc.refDoc)}</td>
      </tr>` : ""}
    </table>
  `;

  const headerNoteHtml = settings.headerNote
    ? `<div style="font-size:${fontSize.small};color:#4b5563;white-space:pre-line;margin-bottom:8px;padding:6px 8px;background:#f9fafb;border-radius:4px">${esc(settings.headerNote)}</div>`
    : "";

  let paymentTermsHtml = "";
  if (showInvoicePaymentTerms && doc.creditDays) {
    paymentTermsHtml = `
      <div style="font-size:${fontSize.small};color:#4b5563;margin-bottom:8px">
        <span style="color:#6b7280">เครดิต:</span> ${doc.creditDays} วัน
        ${doc.validUntil ? `<span style="margin-left:16px;color:#6b7280">กำหนดชำระ:</span> ${fmtDate(doc.validUntil, settings.dateEra)}` : ""}
      </div>
    `;
  }

  const showProductCode = settings.showProductCode !== false;
  const itemsHeaderHtml = `
    <tr style="background:${theme.bg || "#f0f0f0"}">
      <th style="padding:6px 4px;text-align:center;width:30px;border-bottom:2px solid ${primary}">ลำดับ</th>
      ${showProductCode ? `<th style="padding:6px 4px;text-align:left;width:60px;border-bottom:2px solid ${primary}">รหัส</th>` : ""}
      <th style="padding:6px 4px;text-align:left;border-bottom:2px solid ${primary}">รายการ</th>
      <th style="padding:6px 4px;text-align:center;width:40px;border-bottom:2px solid ${primary}">จำนวน</th>
      <th style="padding:6px 4px;text-align:center;width:35px;border-bottom:2px solid ${primary}">หน่วย</th>
      <th style="padding:6px 4px;text-align:right;width:65px;border-bottom:2px solid ${primary}">ราคา/หน่วย</th>
      <th style="padding:6px 4px;text-align:right;width:55px;border-bottom:2px solid ${primary}">ส่วนลด</th>
      <th style="padding:6px 4px;text-align:right;width:70px;border-bottom:2px solid ${primary}">จำนวนเงิน</th>
    </tr>
  `;

  const colCount = showProductCode ? 8 : 7;
  const itemRowsHtml = items.map((item, i) => `
    <tr style="border-bottom:1px solid #f3f4f6">
      <td style="padding:4px;text-align:center;color:#6b7280">${i + 1}</td>
      ${showProductCode ? `<td style="padding:4px;font-family:monospace;font-size:${fontSize.tiny}">${esc(item.productCode)}</td>` : ""}
      <td style="padding:4px">
        <div style="font-weight:500">${esc(item.productName)}</div>
        ${item.description && item.description !== item.productName ? `<div style="font-size:${fontSize.tiny};color:#9ca3af">${esc(item.description)}</div>` : ""}
      </td>
      <td style="padding:4px;text-align:center">${item.qty}</td>
      <td style="padding:4px;text-align:center">${esc(item.unit)}</td>
      <td style="padding:4px;text-align:right">${fmt(item.unitPrice)}</td>
      <td style="padding:4px;text-align:right">${Number(item.discount) > 0 ? fmt(Number(item.discount)) : "-"}</td>
      <td style="padding:4px;text-align:right;font-weight:500">${fmt(item.total)}</td>
    </tr>
  `).join("");

  const minRows = 5;
  const emptyRowsHtml = items.length < minRows
    ? Array.from({ length: minRows - items.length }, () =>
        `<tr style="border-bottom:1px solid #f3f4f6"><td colspan="${colCount}" style="padding:10px">&nbsp;</td></tr>`
      ).join("")
    : "";

  const summaryHtml = `
    <div style="width:200px">
      ${[
        { label: "ยอดรวม", labelEn: "Sub Total", val: subtotal },
        { label: "ส่วนลดพิเศษ", labelEn: "Special Discount", val: specialDiscount },
        { label: "มูลค่าก่อนภาษี", labelEn: "Value Before VAT", val: afterDiscount },
        { label: "ภาษีมูลค่าเพิ่ม 7%", labelEn: "Value Added Tax", val: vat },
        { label: "ภาษีหัก ณ ที่จ่าย", labelEn: "Withholding Tax", val: withholdingTax },
      ].map(r => `
        <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #f3f4f6;font-size:${fontSize.small}">
          <div>
            <div>${r.label}</div>
            <div style="font-size:${fontSize.tiny};color:#9ca3af">${r.labelEn}</div>
          </div>
          <span style="align-self:center">${fmt(r.val)}</span>
        </div>
      `).join("")}
      <div style="display:flex;justify-content:space-between;padding:8px;margin-top:4px;border-radius:4px;background:${primary};color:white;font-weight:bold;font-size:${fontSize.base}">
        <div>
          <div>ยอดเงินสุทธิ</div>
          <div style="font-size:${fontSize.tiny};font-weight:normal;opacity:0.8">Grand Total</div>
        </div>
        <span style="align-self:center">${fmt(grandTotal)}</span>
      </div>
    </div>
  `;

  const thaiTextHtml = `
    <div style="border:1px solid ${theme.light || "#e5e7eb"};border-radius:4px;padding:8px;background:${theme.bg || "#fafafa"};text-align:center;font-size:${fontSize.small};font-weight:600;color:#374151;margin-bottom:8px">
      ${esc(numberToThaiText(grandTotal))}
    </div>
  `;

  let paymentHtml = "";
  if (showPaymentCheckboxes) {
    paymentHtml = `
      <div style="border:1px solid ${theme.light || "#e5e7eb"};border-radius:4px;padding:8px;font-size:${fontSize.small};color:#374151">
        <div style="font-weight:500;margin-bottom:6px">ชำระเงินโดย :</div>
        <div style="display:flex;gap:24px;margin-bottom:4px">
          <label style="display:flex;align-items:center;gap:4px">
            <span style="width:14px;height:14px;border:1px solid #9ca3af;border-radius:2px;display:inline-block"></span> เงินสด
          </label>
          <label style="display:flex;align-items:center;gap:4px">
            <span style="width:14px;height:14px;border:1px solid #9ca3af;border-radius:2px;display:inline-block"></span> เงินโอน
          </label>
        </div>
        <div style="display:flex;align-items:center;gap:4px;margin-bottom:4px">
          <span style="width:14px;height:14px;border:1px solid #9ca3af;border-radius:2px;display:inline-block;flex-shrink:0"></span>
          เช็คธนาคาร / เลขที่ / ลงวันที่ / มูลค่าก่อนภาษี
        </div>
        <div style="display:flex;align-items:center;gap:4px">
          <span style="width:14px;height:14px;border:1px solid #9ca3af;border-radius:2px;display:inline-block;flex-shrink:0"></span>
          อื่นๆ _______________
        </div>
      </div>
    `;
  }

  let bankHtml = "";
  if (showBankInfo && (settings.showQrOnDoc ?? true)) {
    const qr = settings.qrBase64
      ? `<div style="width:64px;height:64px;border:1px solid #e5e7eb;border-radius:4px;overflow:hidden;display:flex;align-items:center;justify-content:center;background:#f9fafb">
           <img src="${settings.qrBase64}" style="max-width:100%;max-height:100%;object-fit:contain" />
         </div>`
      : `<div style="width:64px;height:64px;border:2px dashed #e5e7eb;border-radius:4px;display:flex;align-items:center;justify-content:center;background:#f9fafb">
           <span style="font-size:${fontSize.tiny};color:#9ca3af;text-align:center">QR<br/>Code</span>
         </div>`;

    bankHtml = `
      <div style="display:flex;align-items:flex-start;gap:12px;border-top:1px solid #e5e7eb;padding-top:12px;margin-bottom:16px">
        ${qr}
        <div style="font-size:${fontSize.small};color:#4b5563">
          <div style="font-weight:500;color:#374151;margin-bottom:2px">ข้อมูลชำระเงิน</div>
          ${settings.bankName ? `<div>ธนาคาร: ${esc(settings.bankName)}</div>` : ""}
          ${settings.bankAccountNumber ? `<div>เลขที่บัญชี: ${esc(settings.bankAccountNumber)}</div>` : ""}
          ${settings.bankAccountName ? `<div>ชื่อบัญชี: ${esc(settings.bankAccountName)}</div>` : ""}
        </div>
      </div>
    `;
  }

  let signatureHtml = "";
  if (settings.showSignature) {
    const sigImg = signature?.signatureBase64
      ? `<img src="${signature.signatureBase64}" style="height:40px;margin:0 auto 4px;display:block;object-fit:contain" />`
      : `<div style="height:40px;margin-bottom:4px"></div>`;

    signatureHtml = `
      <div style="display:flex;justify-content:space-between;margin-top:16px;padding-top:16px">
        <div style="text-align:center;width:160px">
          <div style="height:40px;margin-bottom:4px"></div>
          <div style="border-top:1px solid #9ca3af;padding-top:4px">
            <div style="font-size:${fontSize.small};font-weight:500">${esc(sigLabels.left)}</div>
            <div style="font-size:${fontSize.tiny};color:#6b7280">${esc(sigLabels.leftSub)}</div>
            <div style="font-size:${fontSize.tiny};color:#6b7280">วันที่ ____/____/____</div>
          </div>
        </div>
        <div style="text-align:center;width:160px">
          ${sigImg}
          <div style="border-top:1px solid #9ca3af;padding-top:4px">
            <div style="font-size:${fontSize.small};font-weight:500">${esc(signature?.signatureName || sigLabels.right)}</div>
            <div style="font-size:${fontSize.tiny};color:#6b7280">${esc(sigLabels.rightSub)}</div>
            ${signature?.signatureTitle ? `<div style="font-size:${fontSize.tiny};color:#6b7280">${esc(signature.signatureTitle)}</div>` : ""}
          </div>
        </div>
      </div>
    `;
  }

  const footerNote = settings.footerNote || (documentType === "quotation" ? "ใบเสนอราคานี้มีอายุ 30 วัน นับจากวันที่ออกเอกสาร" : "");
  const footerHtml = footerNote
    ? `<div style="font-size:${fontSize.small};color:#6b7280;white-space:pre-line;margin-top:8px">${esc(footerNote)}</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(docLabel)} ${esc(doc.docNo)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Sarabun', 'Noto Sans Thai', sans-serif;
      font-size: ${fontSize.base};
      line-height: 1.5;
      color: #111827;
      background: white;
    }
    .page {
      width: 210mm;
      min-height: 297mm;
      padding: 20mm;
      margin: 0 auto;
      position: relative;
    }
    table { border-collapse: collapse; }
    @media print {
      body { background: white; }
      .page { padding: 10mm; margin: 0; width: 100%; }
    }
    @page { size: A4; margin: 0; }
  </style>
</head>
<body>
  <div class="page">
    <div style="height:6px;background:${primary};border-radius:3px;margin-bottom:16px"></div>

    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px">
      <div style="display:flex;align-items:flex-start;gap:12px">
        ${logoHtml}
        ${companyInfoHtml}
      </div>
      ${docTitleHtml}
    </div>

    ${customerHtml}
    ${headerNoteHtml}
    ${paymentTermsHtml}

    <table style="width:100%;font-size:${fontSize.small};margin-bottom:16px">
      <thead>${itemsHeaderHtml}</thead>
      <tbody>
        ${itemRowsHtml}
        ${emptyRowsHtml}
      </tbody>
    </table>

    <div style="display:flex;gap:16px;margin-bottom:16px">
      <div style="flex:1">
        ${thaiTextHtml}
        ${paymentHtml}
        ${footerHtml}
      </div>
      ${summaryHtml}
    </div>

    ${bankHtml}
    ${signatureHtml}
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
