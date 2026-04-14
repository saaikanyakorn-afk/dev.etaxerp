interface TextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ParsedInvoice {
  invoiceNo: string;
  date: string;
  dueDate: string;
  vendorName: string;
  vendorTaxId: string;
  vendorAddress: string;
  vendorBranch: string;
  items: ParsedLineItem[];
  subtotal: number;
  vatAmount: number;
  totalAmount: number;
  withholdingTax: number;
  notes: string;
  rawText: string;
}

interface ParsedLineItem {
  description: string;
  qty: number;
  unit: string;
  unitPrice: number;
  amount: number;
  vatType: string;
}

async function extractTextItems(pdfBuffer: Buffer): Promise<{ items: TextItem[][]; rawText: string }> {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfBuffer) });
  const pdfDoc = await loadingTask.promise;

  const allPages: TextItem[][] = [];
  const rawParts: string[] = [];

  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const textContent = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1.0 });
    const pageHeight = viewport.height;

    const pageItems: TextItem[] = [];
    for (const item of textContent.items as any[]) {
      if (!item.str || item.str.trim() === "") continue;
      const tx = item.transform;
      pageItems.push({
        str: item.str.trim(),
        x: Math.round(tx[4]),
        y: Math.round(pageHeight - tx[5]),
        width: Math.round(item.width),
        height: Math.round(item.height || tx[3] || 10),
      });
    }
    allPages.push(pageItems);
    rawParts.push(pageItems.map(it => it.str).join(" "));
  }

  return { items: allPages, rawText: rawParts.join("\n\n") };
}

function groupIntoRows(items: TextItem[], tolerance = 3): TextItem[][] {
  if (items.length === 0) return [];

  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  const rows: TextItem[][] = [];
  let currentRow: TextItem[] = [sorted[0]];
  let currentY = sorted[0].y;

  for (let i = 1; i < sorted.length; i++) {
    if (Math.abs(sorted[i].y - currentY) <= tolerance) {
      currentRow.push(sorted[i]);
    } else {
      currentRow.sort((a, b) => a.x - b.x);
      rows.push(currentRow);
      currentRow = [sorted[i]];
      currentY = sorted[i].y;
    }
  }
  currentRow.sort((a, b) => a.x - b.x);
  rows.push(currentRow);
  return rows;
}

function rowText(row: TextItem[]): string {
  return row.map(it => it.str).join(" ");
}

function findPattern(text: string, patterns: RegExp[]): string {
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1]?.trim() || m[0]?.trim() || "";
  }
  return "";
}

function parseDate(dateStr: string): string {
  const cleaned = dateStr.replace(/\s+/g, " ").trim();

  const isoMatch = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    let year = parseInt(isoMatch[1]);
    if (year > 2400) year -= 543;
    return `${year}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const dmy = cleaned.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
  if (dmy) {
    let [, d, m, y] = dmy;
    let day = parseInt(d);
    let month = parseInt(m);
    let year = parseInt(y);
    if (year > 2400) year -= 543;
    if (year < 100) year += 2000;
    if (month > 12 && day <= 12) {
      [day, month] = [month, day];
    }
    if (month > 12 || day > 31) return "";
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const thaiMonths: Record<string, string> = {
    "มกราคม": "01", "ม.ค.": "01", "ม.ค": "01", "มค": "01",
    "กุมภาพันธ์": "02", "ก.พ.": "02", "ก.พ": "02", "กพ": "02",
    "มีนาคม": "03", "มี.ค.": "03", "มี.ค": "03", "มีค": "03",
    "เมษายน": "04", "เม.ย.": "04", "เม.ย": "04", "เมย": "04",
    "พฤษภาคม": "05", "พ.ค.": "05", "พ.ค": "05", "พค": "05",
    "มิถุนายน": "06", "มิ.ย.": "06", "มิ.ย": "06", "มิย": "06",
    "กรกฎาคม": "07", "ก.ค.": "07", "ก.ค": "07", "กค": "07",
    "สิงหาคม": "08", "ส.ค.": "08", "ส.ค": "08", "สค": "08",
    "กันยายน": "09", "ก.ย.": "09", "ก.ย": "09", "กย": "09",
    "ตุลาคม": "10", "ต.ค.": "10", "ต.ค": "10", "ตค": "10",
    "พฤศจิกายน": "11", "พ.ย.": "11", "พ.ย": "11", "พย": "11",
    "ธันวาคม": "12", "ธ.ค.": "12", "ธ.ค": "12", "ธค": "12",
  };
  for (const [name, num] of Object.entries(thaiMonths)) {
    const re = new RegExp(`(\\d{1,2})\\s*${name.replace(".", "\\.")}\\s*(\\d{2,4})`);
    const m = cleaned.match(re);
    if (m) {
      let year = parseInt(m[2]);
      if (year > 2400) year -= 543;
      if (year < 100) year += 2000;
      return `${year}-${num}-${m[1].padStart(2, "0")}`;
    }
  }

  const engMonths: Record<string, string> = {
    "jan": "01", "feb": "02", "mar": "03", "apr": "04",
    "may": "05", "jun": "06", "jul": "07", "aug": "08",
    "sep": "09", "oct": "10", "nov": "11", "dec": "12",
  };

  for (const [name, num] of Object.entries(engMonths)) {
    const re = new RegExp(`${name}\\w*\\s+(\\d{1,2}),?\\s*(\\d{2,4})`, "i");
    const m = cleaned.match(re);
    if (m) {
      let year = parseInt(m[2]);
      if (year < 100) year += 2000;
      return `${year}-${num}-${m[1].padStart(2, "0")}`;
    }
  }

  for (const [name, num] of Object.entries(engMonths)) {
    const re = new RegExp(`(\\d{1,2})\\s*${name}\\w*\\s*(\\d{2,4})`, "i");
    const m = cleaned.match(re);
    if (m) {
      let year = parseInt(m[2]);
      if (year < 100) year += 2000;
      return `${year}-${num}-${m[1].padStart(2, "0")}`;
    }
  }

  return "";
}

function cleanNumber(str: string): number {
  const cleaned = str.replace(/[,\s฿]/g, "").replace(/[^\d.\-]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

function extractBahtAmount(text: string): number {
  const m = text.match(/฿\s*([\d,]+\.?\d*)/);
  if (m) return cleanNumber(m[1]);
  const nums = text.match(/[\d,]+\.\d{2}/g);
  if (nums && nums.length > 0) return cleanNumber(nums[nums.length - 1]);
  return 0;
}

function joinRowItemsSmart(items: TextItem[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0].str;

  const gaps: number[] = [];
  for (let i = 1; i < items.length; i++) {
    const gap = items[i].x - (items[i - 1].x + items[i - 1].width);
    gaps.push(gap);
  }

  const avgCharWidth = items.reduce((s, it) => s + (it.str.length > 0 ? it.width / it.str.length : 0), 0) / items.length || 5;
  const spaceThreshold = avgCharWidth * 0.8;

  let result = items[0].str;
  for (let i = 1; i < items.length; i++) {
    const gap = gaps[i - 1];
    const prevThai = /[\u0E00-\u0E7F]$/.test(items[i - 1].str);
    const nextThai = /^[\u0E00-\u0E7F]/.test(items[i].str);

    if (prevThai && nextThai) {
      result += gap > spaceThreshold ? " " : "";
    } else {
      result += gap > spaceThreshold * 0.3 ? " " : "";
    }
    result += items[i].str;
  }
  return result.trim();
}

function extractValueFromRow(row: TextItem[], labelPattern: RegExp): string {
  let colonIdx = -1;
  for (let i = 0; i < row.length; i++) {
    if (labelPattern.test(row[i].str) || /[:：]/.test(row[i].str)) {
      if (/[:：]/.test(row[i].str)) {
        colonIdx = i;
        break;
      }
    }
  }
  if (colonIdx < 0) {
    for (let i = 0; i < row.length; i++) {
      if (/[:：]/.test(row[i].str)) { colonIdx = i; break; }
    }
  }
  if (colonIdx < 0) return "";
  const valueItems = row.slice(colonIdx + 1).filter(it => it.str.trim());
  if (valueItems.length <= 1) return "";
  return joinRowItemsSmart(valueItems);
}

function cleanThaiSpaces(text: string): string {
  const tokens = text.split(/(\s+)/);
  const result: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (/^\s+$/.test(tokens[i])) {
      const prev = tokens[i - 1] || "";
      const next = tokens[i + 1] || "";
      const prevThai = /[\u0E00-\u0E7F]$/.test(prev);
      const nextThai = /^[\u0E00-\u0E7F]/.test(next);
      if (prevThai && nextThai) {
        const prevLen = prev.replace(/[^\u0E00-\u0E7F]/g, "").length;
        const nextLen = next.replace(/[^\u0E00-\u0E7F]/g, "").length;
        if (prevLen <= 2 && nextLen <= 2) {
          continue;
        }
      }
      result.push(" ");
    } else {
      result.push(tokens[i]);
    }
  }
  return result.join("").trim();
}

function isShopeeOrSpxInvoice(fullText: string): boolean {
  return /(?:Shopee|SPX\s*Express).*(?:Co\.,?\s*Ltd|จำกัด)/i.test(fullText) && /(?:Seller\s*ID|เลขที่\/\s*No\.)/i.test(fullText);
}

function parseShopeeInvoice(rows: TextItem[][], fullText: string): ParsedInvoice {
  let invoiceNo = "";
  let date = "";
  let vendorName = "";
  let vendorTaxId = "";
  let vendorAddress = "";
  let vendorBranch = "สำนักงานใหญ่";
  let subtotal = 0;
  let vatAmount = 0;
  let totalAmount = 0;
  let withholdingTax = 0;
  const items: ParsedLineItem[] = [];

  let isTaxInvoice = false;
  for (let r = 0; r < Math.min(rows.length, 8); r++) {
    const rText = rowText(rows[r]);
    if (!vendorName) {
      const shopeeMatch = rText.match(/((?:Shopee|SPX\s*Express)\s*\(Thailand\)\s*Co\.,?\s*Ltd\.?)/i);
      if (shopeeMatch) vendorName = shopeeMatch[1].trim();
    }
    if (/ใบกำกับภาษี|Tax\s*Invoice/i.test(rText)) isTaxInvoice = true;
  }
  const defaultVatType = isTaxInvoice ? "vat7" : "non_vat";

  for (let i = 0; i < rows.length; i++) {
    const text = rowText(rows[i]);

    const invNoMatch = text.match(/เลขที่\/?\s*No\.?\s*([A-Z0-9\-]+)/i);
    if (invNoMatch && !invoiceNo) {
      let no = invNoMatch[1].trim();
      for (let j = i + 1; j < Math.min(i + 3, rows.length); j++) {
        for (const item of rows[j]) {
          const m = item.str.match(/^(\d{4}-\d{5,})/);
          if (m) { no += m[1]; break; }
        }
        if (no.length > invNoMatch[1].length) break;
        const combined = rowText(rows[j]);
        const cm = combined.match(/(\d{4}-\d{5,})/);
        if (cm) { no += cm[1]; break; }
      }
      if (no.length >= 10) invoiceNo = no;
    }

    if (!invoiceNo) {
      for (const item of rows[i]) {
        const m = item.str.match(/((?:TRSPEMKP|RCSPXSPR|RCSPXSPB|TRSLZD)[A-Z0-9\-]{10,})/i);
        if (m) { invoiceNo = m[1]; break; }
      }
    }

    const dateMatch = text.match(/วันที่\/?\s*Date\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
    if (dateMatch && !date) {
      date = parseDate(dateMatch[1]);
    }

    if (!vendorTaxId) {
      const taxNoMatch = text.match(/Tax\s*ID\s*No\.?\s*(\d{13})/i);
      if (taxNoMatch) vendorTaxId = taxNoMatch[1];
    }

    if (!vendorAddress) {
      if (/AIA\s*Capital\s*Center/i.test(text)) {
        vendorAddress = "89 AIA Capital Center, 24th Floor, Ratchadaphisek Road, Dindaeng, Bangkok 10400";
      }
    }

    const whtMatch = text.match(/หักภาษีเงินได้\s*ณ\s*ที่จ่าย.*?(\d+(?:\.\d+)?)\s*(?:บาท|THB)/i);
    if (!whtMatch) {
      const whtAlt = text.match(/deducted\s*\d+%\s*withholding\s*tax.*?at\s*(\d+(?:\.\d+)?)\s*THB/i);
      if (whtAlt) withholdingTax = parseFloat(whtAlt[1]);
    } else {
      withholdingTax = parseFloat(whtMatch[1]);
    }

    if (/ภาษีมูลค่าเพิ่ม\s*7%|VAT\s*7%/i.test(text)) {
      const nums = text.match(/[\d,]+\.\d{2}/g);
      if (nums) vatAmount = cleanNumber(nums[nums.length - 1]);
    }

    if (/มูลค่าบริการรวมภาษี|Total\s*Value.*Included\s*VAT/i.test(text)) {
      const nums = text.match(/[\d,]+\.\d{2}/g);
      if (nums) totalAmount = cleanNumber(nums[nums.length - 1]);
    }

    if (/มูลค่าก่อนภาษี.*หลังส่วนลด|after\s*discount/i.test(text)) {
      const nums = text.match(/[\d,]+\.\d{2}/g);
      if (nums) subtotal = cleanNumber(nums[nums.length - 1]);
    } else if (!subtotal && /มูลค่าก่อนภาษี|Total\s*Value.*Excluded\s*VAT/i.test(text) && !/หลังส่วนลด|after\s*discount/i.test(text)) {
      const nums = text.match(/[\d,]+\.\d{2}/g);
      if (nums) subtotal = cleanNumber(nums[nums.length - 1]);
    }

    if (/จำนวนเงินรวม|Total\s*amount/i.test(text) && !totalAmount) {
      const nums = text.match(/[\d,]+\.\d{2}/g);
      if (nums) totalAmount = cleanNumber(nums[nums.length - 1]);
    }

    const lineMatch = text.match(/^\d+\s+(.+?)\s+(\d+)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})$/);
    if (lineMatch) {
      items.push({
        description: lineMatch[1].trim(),
        qty: parseInt(lineMatch[2]),
        unit: "ครั้ง",
        unitPrice: cleanNumber(lineMatch[3]),
        amount: cleanNumber(lineMatch[4]),
        vatType: defaultVatType,
      });
      continue;
    }

    const feePatterns = [
      /^(\d+)\s+((?:Paid\s*ads|Commission\s*fee|Transaction\s*fee|Service\s*fee|AMS.*Fee|Platform.*Fee|Shipping\s*fee|Withdrawal\s*fee|Adjustment.*|FSS.*|Free\s*Shipping.*|Coins\s*Cash\s*Back.*|Voucher.*|Bundle\s*Deal.*|Seller\s*Voucher.*|Flash\s*Sale.*|Return.*Fee|Penalty.*|Rebate.*))\s+(\d+)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})/i,
    ];
    for (const fp of feePatterns) {
      const fm = text.match(fp);
      if (fm) {
        items.push({
          description: fm[2].trim(),
          qty: parseInt(fm[3]),
          unit: "ครั้ง",
          unitPrice: cleanNumber(fm[4]),
          amount: cleanNumber(fm[5]),
          vatType: defaultVatType,
        });
        break;
      }
    }
  }

  if (items.length === 0 && totalAmount > 0) {
    items.push({
      description: vendorName.includes("SPX") ? "Shipping fee" : "Service fee",
      qty: 1,
      unit: "ครั้ง",
      unitPrice: subtotal || totalAmount,
      amount: subtotal || totalAmount,
      vatType: vatAmount > 0 ? "vat7" : "non_vat",
    });
  }

  if (!subtotal && items.length > 0) {
    subtotal = items.reduce((s, it) => s + it.amount, 0);
  }
  if (!totalAmount) {
    totalAmount = subtotal + vatAmount;
  }

  return {
    invoiceNo,
    date,
    dueDate: "",
    vendorName,
    vendorTaxId,
    vendorAddress,
    vendorBranch,
    items,
    subtotal: Math.round(subtotal * 100) / 100,
    vatAmount: Math.round(vatAmount * 100) / 100,
    totalAmount: Math.round(totalAmount * 100) / 100,
    withholdingTax: Math.round(withholdingTax * 100) / 100,
    notes: "",
    rawText: fullText.substring(0, 3000),
  };
}

function isTikTokReceipt(fullText: string): boolean {
  return /Receipt\s*Number/i.test(fullText) && /Creator\s*(name|commission)/i.test(fullText);
}

function parseTikTokReceipt(rows: TextItem[][], fullText: string): ParsedInvoice {
  let invoiceNo = "";
  let date = "";
  let vendorName = "";
  let vendorTaxId = "";
  let vendorAddress = "";
  let vendorBranch = "";
  let totalAmount = 0;
  let withholdingTax = 0;
  const items: ParsedLineItem[] = [];

  let inBillFrom = false;
  let billFromTaxFound = false;

  for (let i = 0; i < rows.length; i++) {
    const text = rowText(rows[i]);

    const receiptNoMatch = text.match(/Receipt\s*Number\s*[:：]\s*([A-Za-z0-9]+)/i);
    if (receiptNoMatch) invoiceNo = receiptNoMatch[1];

    const dateMatch = text.match(/Receipt\s*Date\s*[:：]\s*(.+)/i);
    if (dateMatch) date = parseDate(dateMatch[1].trim());

    if (/Bill\s*From/i.test(text)) {
      inBillFrom = true;
      continue;
    }
    if (/Bill\s*To/i.test(text)) {
      inBillFrom = false;
      continue;
    }

    if (inBillFrom) {
      const clientMatch = text.match(/Client\s*Name\s*[:：]\s*(.+)/i);
      if (clientMatch) {
        vendorName = extractValueFromRow(rows[i], /Client\s*Name/i) || cleanThaiSpaces(clientMatch[1].trim());
      }

      const addrMatch = text.match(/Billing\s*Address\s*[:：]\s*(.+)/i);
      if (addrMatch) {
        const smart = extractValueFromRow(rows[i], /Billing\s*Address/i);
        vendorAddress = smart ? smart.replace(/\|/g, " ") : cleanThaiSpaces(addrMatch[1].trim().replace(/\|/g, " "));
      }

      if (!billFromTaxFound) {
        const taxMatch = text.match(/Tax\s*Number\s*[:：]\s*(\d{13})/i);
        if (taxMatch) {
          vendorTaxId = taxMatch[1];
          billFromTaxFound = true;
        }
      }
    }

    const commissionMatch = text.match(/[-–]\s*(.*?commission.*?)\s+[\/\s]*฿\s*([\d,]+\.?\d*)/i);
    if (!commissionMatch) {
      const altMatch = text.match(/[-–]\s*(.*?commission.*?)\s+\//i);
      if (altMatch) {
        const nextRow = i + 1 < rows.length ? rowText(rows[i]) : "";
        const combined = text + " " + (i + 1 < rows.length ? rowText(rows[i + 1]) : "");
        const amtMatch = combined.match(/฿\s*([\d,]+\.?\d*)/);
        if (amtMatch) {
          const desc = altMatch[1].trim();
          const amount = cleanNumber(amtMatch[1]);
          if (amount > 0) {
            items.push({
              description: desc,
              qty: 1,
              unit: "ครั้ง",
              unitPrice: amount,
              amount,
              vatType: "non_vat",
            });
          }
        }
      }
    }
    if (commissionMatch) {
      const desc = commissionMatch[1].trim();
      const amount = cleanNumber(commissionMatch[2]);
      if (amount > 0) {
        items.push({
          description: desc,
          qty: 1,
          unit: "ครั้ง",
          unitPrice: amount,
          amount,
          vatType: "non_vat",
        });
      }
    }

    if (/personal\s*income\s*tax/i.test(text)) {
      withholdingTax = extractBahtAmount(text);
    }
    if (/total\s*amount/i.test(text)) {
      totalAmount = extractBahtAmount(text);
    }
  }

  if (items.length === 0 && totalAmount > 0) {
    items.push({
      description: "Creator commission",
      qty: 1,
      unit: "ครั้ง",
      unitPrice: totalAmount,
      amount: totalAmount,
      vatType: "non_vat",
    });
  }

  const subtotal = items.reduce((s, it) => s + it.amount, 0);

  return {
    invoiceNo,
    date,
    dueDate: "",
    vendorName,
    vendorTaxId,
    vendorAddress,
    vendorBranch,
    items,
    subtotal: Math.round(subtotal * 100) / 100,
    vatAmount: 0,
    totalAmount: Math.round(totalAmount * 100) / 100,
    withholdingTax: Math.round(withholdingTax * 100) / 100,
    notes: "",
    rawText: fullText.substring(0, 3000),
  };
}

const INVOICE_NO_PATTERNS = [
  /(?:tax\s*invoice\s*no\.?|invoice\s*no\.?|inv\s*no\.?|เลขที่ใบกำกับภาษี|เลขที่ใบแจ้งหนี้|เลขที่ใบกำกับ|เลขที่เอกสาร|document\s*no\.?|doc\s*no\.?|bill\s*no\.?|receipt\s*no\.?|receipt\s*number)[\s:：]*([A-Za-z0-9\-\/_.]+)/i,
  /(?:เลขที่)\s*[:：/]\s*([A-Za-z0-9\-\/_.]{4,})/i,
  /(?:no\.?|เลข(?:ที่)?)\s*[:：]?\s*([A-Za-z]{1,5}[\-\/]?\d{4,})/i,
  /(TIV[\-_]?[A-Z]{2,5}[\-_]?\d{6,})/i,
  /(INV[\-_]?\d{6,})/i,
  /(SH[\-_]?(?:TIV|INV|RCP)[\-_]?[A-Z0-9\-]{6,})/i,
  /(LZD[\-_]?(?:INV|TIV|RCP)[\-_]?[A-Z0-9\-]{6,})/i,
];

const DATE_PATTERNS = [
  /(?:วันที่|(?:invoice|receipt)\s*date)[\s:：]*(.+?)(?:\s{2,}|$)/i,
  /(?:date)[\s:：]*(.+?)(?:\s{2,}|$)/i,
  /(?:วันที่|date)[\s:：]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
];

const DUE_DATE_PATTERNS = [
  /(?:วันครบกำหนด|due\s*date|ครบกำหนด|กำหนดชำระ)[\s:：]*(.+?)(?:\s{2,}|$)/i,
];

const TAX_ID_PATTERNS = [
  /(?:เลขประจำตัวผู้เสียภาษี|tax\s*(?:id|number)|เลขที่ผู้เสียภาษี|tax\s*identification)[\s:：]*(\d[\d\-\s]{10,16}\d)/i,
];

const BRANCH_PATTERNS = [
  /(?:สาขา|branch)[\s:：]*((?:สำนักงานใหญ่|สาขาที่\s*\d+|head\s*office|\d{5}))/i,
];

function isLikelyLineItem(text: string): boolean {
  const nums = text.match(/[\d,]+\.?\d*/g) || [];
  return nums.length >= 1;
}

function splitRowTokens(row: TextItem[]): { numbers: number[]; textParts: string[]; unitStr: string; seqNum: boolean } {
  const numbers: number[] = [];
  const textParts: string[] = [];
  let unitStr = "";
  const unitRe = /^(ชิ้น|หน่วย|เดือน|วัน|ครั้ง|กล่อง|ชุด|pcs|unit|set|box|ea|kg|g|m|cm|lot)$/i;

  const tokens: string[] = [];
  if (row.length <= 2) {
    for (const item of row) {
      const parts = item.str.split(/\s{2,}/).map(s => s.trim()).filter(Boolean);
      if (parts.length > 1) {
        tokens.push(...parts);
      } else {
        const words = item.str.trim().split(/\s+/);
        tokens.push(...words);
      }
    }
  } else {
    for (const item of row) {
      tokens.push(item.str.trim());
    }
  }

  for (const tok of tokens) {
    const cleanStr = tok.replace(/[,\s฿]/g, "");
    if (/^-?[\d,]+\.?\d*$/.test(cleanStr) && cleanStr.length > 0) {
      numbers.push(cleanNumber(tok));
    } else if (unitRe.test(tok)) {
      unitStr = tok;
    } else if (!/^\d{1,3}$/.test(tok)) {
      textParts.push(tok);
    }
  }

  const seqNum = /^\d{1,3}$/.test(tokens[0] || "");
  return { numbers, textParts, unitStr, seqNum };
}

function parseLineItems(rows: TextItem[][], startIdx: number, endIdx: number): ParsedLineItem[] {
  const items: ParsedLineItem[] = [];

  for (let i = startIdx; i < endIdx; i++) {
    const row = rows[i];
    const text = rowText(row);

    if (!isLikelyLineItem(text)) continue;
    if (/(?:รวม|total|subtotal|ยอดรวม|ภาษี|vat|หัก ณ|withholding|จำนวนเงินรวม)/i.test(text)) continue;
    if (/(?:สาขา\s*[\/\\]?\s*branch|head\s*office|สำนักงานใหญ่|เลขประจำตัวผู้เสียภาษี|tax\s*(?:id|identification)|เลขที่ผู้เสียภาษี)/i.test(text)) continue;
    if (/(?:ผู้ขาย|seller|ผู้ซื้อ|buyer|ผู้ให้บริการ|service\s*provider|ที่อยู่|address)/i.test(text) && !/(?:ค่า|fee|charge|commission)/i.test(text)) continue;

    const { numbers, textParts, unitStr, seqNum } = splitRowTokens(row);

    if (numbers.length < 1) continue;

    const desc = textParts.join(" ").trim();

    let qty = 1, unitPrice = 0, amount = 0;
    if (numbers.length >= 3) {
      if (seqNum) {
        qty = numbers[1] || 1;
        unitPrice = numbers[2] || 0;
        amount = numbers[numbers.length - 1] || 0;
      } else {
        qty = numbers[0] || 1;
        unitPrice = numbers[1] || 0;
        amount = numbers[numbers.length - 1] || 0;
      }
    } else if (numbers.length === 2) {
      if (seqNum) {
        amount = numbers[1] || 0;
        qty = 1;
        unitPrice = amount;
      } else {
        qty = numbers[0] || 1;
        amount = numbers[1] || 0;
        unitPrice = qty > 0 ? amount / qty : amount;
      }
    } else if (numbers.length === 1) {
      amount = numbers[0];
      unitPrice = amount;
    }

    if (desc && amount !== 0) {
      items.push({
        description: desc,
        qty,
        unit: unitStr || "ชิ้น",
        unitPrice: Math.round(unitPrice * 100) / 100,
        amount: Math.round(amount * 100) / 100,
        vatType: "vat7",
      });
    }
  }

  return items;
}

function extractInvoiceNoFromRows(rows: TextItem[][], fullText: string): string {
  const result = findPattern(fullText, INVOICE_NO_PATTERNS);
  if (result && result.length >= 4) return result;

  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const text = rowText(rows[i]);
    const rowResult = findPattern(text, INVOICE_NO_PATTERNS);
    if (rowResult && rowResult.length >= 4) return rowResult;

    const labelMatch = text.match(/(?:เลขที่|no\.?|number)\s*$/i);
    if (labelMatch && i + 1 < rows.length) {
      const nextText = rowText(rows[i + 1]).trim();
      if (/^[A-Za-z0-9\-\/_.]{4,}$/.test(nextText)) return nextText;
    }

    for (const item of rows[i]) {
      if (/(?:เลขที่|no\.?)[\s:：]/i.test(item.str)) {
        const afterLabel = rows[i].filter(it => it.x > item.x + item.width);
        if (afterLabel.length > 0) {
          const val = afterLabel[0].str.trim();
          if (/^[A-Za-z0-9\-\/_.]{4,}$/.test(val)) return val;
        }
      }
    }
  }

  return "";
}

function parseGenericInvoice(rows: TextItem[][], fullText: string): ParsedInvoice {
  const invoiceNo = extractInvoiceNoFromRows(rows, fullText);
  const dateRaw = findPattern(fullText, DATE_PATTERNS);
  const date = dateRaw ? parseDate(dateRaw) : "";
  const dueDateRaw = findPattern(fullText, DUE_DATE_PATTERNS);
  const dueDate = dueDateRaw ? parseDate(dueDateRaw) : "";

  let vendorName = "";
  let vendorAddress = "";
  let vendorTaxId = "";
  let vendorBranch = "";

  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const text = rowText(rows[i]);

    if (!vendorTaxId) {
      const taxMatch = findPattern(text, TAX_ID_PATTERNS);
      if (taxMatch && taxMatch.replace(/[\-\s]/g, "").length === 13) {
        vendorTaxId = taxMatch.replace(/[\-\s]/g, "");
      }
    }

    if (!vendorBranch) {
      vendorBranch = findPattern(text, BRANCH_PATTERNS);
    }

    if (!vendorName) {
      if (/(?:บริษัท|ห้างหุ้นส่วน|หจก\.|บจ\.|company|co\.,?\s*ltd|corp)/i.test(text)) {
        const nameMatch = text.match(/((?:บริษัท|ห้างหุ้นส่วน|หจก\.|บจ\.)[\s\S]*?(?:จำกัด|มหาชน|ltd\.?|corp\.?))/i);
        if (nameMatch) {
          vendorName = nameMatch[1].trim();
          for (let j = i + 1; j < Math.min(i + 4, rows.length); j++) {
            const addrText = rowText(rows[j]);
            if (/(?:เลขประจำตัว|tax\s*(?:id|number)|เลขที่ใบ|invoice|date|วันที่|สาขา)/i.test(addrText)) break;
            if (/\d{1,4}[\s\/]/.test(addrText) || /(?:ถ\.|ซ\.|แขวง|เขต|จังหวัด|ตำบล|อำเภอ|หมู่|road|street|district|province|ม\.|ต\.|อ\.)/i.test(addrText)) {
              vendorAddress += (vendorAddress ? " " : "") + addrText;
            }
          }
        }
      }
    }
  }

  let tableStartIdx = -1;
  let tableEndIdx = rows.length;
  const headerKeywords = /(?:รายการ|ลำดับ|description|item|no\.?\s|qty|จำนวน|ราคา|price|amount|หน่วย|unit)/i;
  const footerKeywords = /(?:รวมเป็นเงิน|รวมทั้งสิ้น|total|subtotal|ยอดรวม|รวมเงิน|grand\s*total)/i;

  for (let i = 0; i < rows.length; i++) {
    const text = rowText(rows[i]);
    if (tableStartIdx === -1 && headerKeywords.test(text)) {
      tableStartIdx = i + 1;
    }
    if (tableStartIdx !== -1 && footerKeywords.test(text)) {
      tableEndIdx = i;
      break;
    }
  }

  if (tableStartIdx === -1) tableStartIdx = Math.min(10, rows.length);

  const lineItems = parseLineItems(rows, tableStartIdx, tableEndIdx);

  let subtotal = 0;
  let vatAmount = 0;
  let totalAmount = 0;
  let withholdingTax = 0;

  for (let i = Math.max(tableEndIdx, 0); i < rows.length; i++) {
    const text = rowText(rows[i]);
    const nums = text.match(/[\d,]+\.?\d*/g) || [];
    const lastNum = nums.length > 0 ? cleanNumber(nums[nums.length - 1]) : 0;

    if (/(?:ภาษีมูลค่าเพิ่ม|vat|ภาษี\s*7%|vat\s*7)/i.test(text) && !/(?:รวม.*ภาษี|before.*vat|ก่อนภาษี)/i.test(text)) {
      vatAmount = lastNum;
    } else if (/(?:หัก\s*ณ\s*ที่\s*จ่าย|withholding|ภาษีหัก)/i.test(text)) {
      withholdingTax = lastNum;
    } else if (/(?:รวมทั้งสิ้น|grand\s*total|ยอดรวมสุทธิ|จำนวนเงินรวมทั้งสิ้น|net\s*amount|ยอดชำระ)/i.test(text)) {
      totalAmount = lastNum;
    } else if (/(?:รวมเป็นเงิน|subtotal|ยอดรวม(?!สุทธิ)|รวมก่อน)/i.test(text)) {
      subtotal = lastNum;
    }
  }

  if (subtotal === 0 && lineItems.length > 0) {
    subtotal = lineItems.reduce((s, it) => s + it.amount, 0);
  }
  if (totalAmount === 0) {
    totalAmount = subtotal + vatAmount - withholdingTax;
  }

  return {
    invoiceNo,
    date,
    dueDate,
    vendorName,
    vendorTaxId,
    vendorAddress,
    vendorBranch,
    items: lineItems,
    subtotal: Math.round(subtotal * 100) / 100,
    vatAmount: Math.round(vatAmount * 100) / 100,
    totalAmount: Math.round(totalAmount * 100) / 100,
    withholdingTax: Math.round(withholdingTax * 100) / 100,
    notes: "",
    rawText: fullText.substring(0, 3000),
  };
}

export async function extractPdfFullText(pdfBuffer: Buffer): Promise<string> {
  const { items: pages } = await extractTextItems(pdfBuffer);
  const pageRows = pages.map(pageItems => groupIntoRows(pageItems));
  const rows = pageRows.flat();
  return rows.map(r => rowText(r)).join("\n");
}

export async function parsePdfInvoice(pdfBuffer: Buffer, templates?: import("./pdf-template-engine").TemplateConfig[]): Promise<ParsedInvoice & { templateId?: number; templateName?: string }> {
  const { items: pages, rawText } = await extractTextItems(pdfBuffer);
  const pageRows = pages.map(pageItems => groupIntoRows(pageItems));
  const rows = pageRows.flat();
  const fullText = rows.map(r => rowText(r)).join("\n");

  if (templates && templates.length > 0) {
    const { matchTemplate, applyTemplate } = await import("./pdf-template-engine");
    const matched = matchTemplate(fullText, templates);
    if (matched) {
      const result = applyTemplate(fullText, matched);
      return result;
    }
  }

  if (isShopeeOrSpxInvoice(fullText)) {
    return parseShopeeInvoice(rows, fullText);
  }

  if (isTikTokReceipt(fullText)) {
    return parseTikTokReceipt(rows, fullText);
  }

  return parseGenericInvoice(rows, fullText);
}
