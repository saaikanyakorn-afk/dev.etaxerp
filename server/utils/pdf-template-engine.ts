/**
 * PDF Template Engine
 * ==================
 * FILE: server/utils/pdf-template-engine.ts
 *
 * เมื่อ format ใหม่มาที่ template rules รองรับไม่ได้ ให้แก้ที่ไฟล์นี้:
 *   - เพิ่ม extractionType ใหม่ใน applyFieldRule()
 *   - เพิ่ม logic ใหม่ใน extractLineItems()
 *
 * Template field rules มีรูปแบบ:
 * {
 *   "invoiceNo": { "keyword": "เลขที่/No.", "pattern": "([A-Z0-9\\-]+)", "extractionType": "afterKeyword" },
 *   "date":      { "keyword": "วันที่/Date",  "pattern": "(\\d{1,2}/\\d{1,2}/\\d{4})", "extractionType": "afterKeyword" },
 *   "vendorName":{ "keyword": "Company",      "extractionType": "afterKeyword" },
 *   "vendorTaxId":{"keyword": "Tax ID",       "pattern": "(\\d{13})", "extractionType": "afterKeyword" },
 *   "subtotal":  { "keyword": "มูลค่าก่อนภาษี", "extractionType": "lastNumberOnLine" },
 *   "vatAmount": { "keyword": "ภาษีมูลค่าเพิ่ม", "extractionType": "lastNumberOnLine" },
 *   "totalAmount":{ "keyword": "รวมทั้งสิ้น",   "extractionType": "lastNumberOnLine" },
 *   "withholdingTax":{ "keyword": "หัก ณ ที่จ่าย", "extractionType": "lastNumberOnLine" },
 *   "lineItems": { "headerKeyword": "รายการ", "footerKeyword": "รวมเป็นเงิน", "extractionType": "tableRows" }
 * }
 *
 * extractionType options:
 *   "afterKeyword"     — จับ text ที่อยู่หลัง keyword (ใช้ pattern ถ้ามี)
 *   "lastNumberOnLine" — จับตัวเลขตัวสุดท้ายในบรรทัดที่มี keyword
 *   "firstNumberOnLine"— จับตัวเลขตัวแรกในบรรทัดที่มี keyword
 *   "fullLine"         — เอาทั้งบรรทัดที่ match keyword
 *   "nextLine"         — เอาบรรทัดถัดไปจาก keyword
 *   "tableRows"        — จับ line items ระหว่าง header/footer keywords
 *   "sectionUntil"     — จับข้อความตั้งแต่ keyword จนถึง stopKeyword
 */

export interface FieldRule {
  keyword: string;
  pattern?: string;
  extractionType: "afterKeyword" | "lastNumberOnLine" | "firstNumberOnLine" | "fullLine" | "nextLine" | "tableRows" | "sectionUntil";
  stopKeyword?: string;
  headerKeyword?: string;
  footerKeyword?: string;
  flags?: string;
}

export interface TemplateFieldRules {
  invoiceNo?: FieldRule;
  date?: FieldRule;
  dueDate?: FieldRule;
  vendorName?: FieldRule;
  vendorTaxId?: FieldRule;
  vendorAddress?: FieldRule;
  vendorBranch?: FieldRule;
  subtotal?: FieldRule;
  vatAmount?: FieldRule;
  totalAmount?: FieldRule;
  withholdingTax?: FieldRule;
  lineItems?: FieldRule;
  [key: string]: FieldRule | undefined;
}

export interface TemplateConfig {
  id: number;
  name: string;
  detectKeywords: string[];
  fieldRules: TemplateFieldRules;
  dateFormat: string;
  defaultVatType: string;
  priority: number;
}

interface ExtractedInvoice {
  invoiceNo: string;
  date: string;
  dueDate: string;
  vendorName: string;
  vendorTaxId: string;
  vendorAddress: string;
  vendorBranch: string;
  items: { description: string; qty: number; unit: string; unitPrice: number; amount: number; vatType: string }[];
  subtotal: number;
  vatAmount: number;
  totalAmount: number;
  withholdingTax: number;
  notes: string;
  rawText: string;
  templateId: number;
  templateName: string;
}

function cleanNumber(str: string): number {
  const cleaned = str.replace(/[,\s฿]/g, "").replace(/[^\d.\-]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
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
    let day = parseInt(dmy[1]);
    let month = parseInt(dmy[2]);
    let year = parseInt(dmy[3]);
    if (year > 2400) year -= 543;
    if (year < 100) year += 2000;
    if (month > 12 && day <= 12) [day, month] = [month, day];
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
    const re = new RegExp(`(?:${name}\\w*)\\s+(\\d{1,2}),?\\s*(\\d{2,4})`, "i");
    const m = cleaned.match(re);
    if (m) {
      let year = parseInt(m[2]);
      if (year < 100) year += 2000;
      return `${year}-${num}-${m[1].padStart(2, "0")}`;
    }
    const re2 = new RegExp(`(\\d{1,2})\\s*${name}\\w*\\s*(\\d{2,4})`, "i");
    const m2 = cleaned.match(re2);
    if (m2) {
      let year = parseInt(m2[2]);
      if (year < 100) year += 2000;
      return `${year}-${num}-${m2[1].padStart(2, "0")}`;
    }
  }

  return "";
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findLineWithKeyword(lines: string[], keyword: string): { line: string; index: number } | null {
  const keywords = keyword.split("|").map(k => k.trim()).filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    for (const kw of keywords) {
      if (lines[i].toLowerCase().includes(kw.toLowerCase())) {
        return { line: lines[i], index: i };
      }
    }
  }
  return null;
}

/**
 * applyFieldRule — ดึงค่าจาก text ตาม rule ที่กำหนด
 *
 * *** ถ้า format ใหม่ต้องการ extractionType แบบใหม่ ให้เพิ่ม case ที่นี่ ***
 */
function applyFieldRule(lines: string[], rule: FieldRule): string {
  const found = findLineWithKeyword(lines, rule.keyword);
  if (!found) return "";

  switch (rule.extractionType) {
    case "afterKeyword": {
      const line = found.line;
      const keywords = rule.keyword.split("|").map(k => k.trim());
      let remaining = line;
      for (const kw of keywords) {
        const idx = remaining.toLowerCase().indexOf(kw.toLowerCase());
        if (idx >= 0) {
          remaining = remaining.substring(idx + kw.length);
          break;
        }
      }
      remaining = remaining.replace(/^[\s:：]+/, "").trim();

      if (rule.pattern) {
        try {
          const re = new RegExp(rule.pattern, rule.flags || "i");
          const m = remaining.match(re);
          if (m) return m[1] || m[0] || "";
          const fullM = line.match(re);
          if (fullM) return fullM[1] || fullM[0] || "";
        } catch {}
      }
      return remaining;
    }

    case "lastNumberOnLine": {
      const nums = found.line.match(/[\d,]+\.?\d*/g);
      if (nums && nums.length > 0) return nums[nums.length - 1];
      return "";
    }

    case "firstNumberOnLine": {
      const keywords = rule.keyword.split("|").map(k => k.trim());
      let afterKeyword = found.line;
      for (const kw of keywords) {
        const idx = afterKeyword.toLowerCase().indexOf(kw.toLowerCase());
        if (idx >= 0) {
          afterKeyword = afterKeyword.substring(idx + kw.length);
          break;
        }
      }
      const nums = afterKeyword.match(/[\d,]+\.?\d*/g);
      if (nums && nums.length > 0) return nums[0];
      return "";
    }

    case "fullLine":
      return found.line.trim();

    case "nextLine":
      if (found.index + 1 < lines.length) {
        const next = lines[found.index + 1].trim();
        if (rule.pattern) {
          try {
            const re = new RegExp(rule.pattern, rule.flags || "i");
            const m = next.match(re);
            if (m) return m[1] || m[0] || "";
          } catch {}
        }
        return next;
      }
      return "";

    case "sectionUntil": {
      const result: string[] = [];
      for (let i = found.index + 1; i < lines.length; i++) {
        if (rule.stopKeyword && lines[i].toLowerCase().includes(rule.stopKeyword.toLowerCase())) break;
        const trimmed = lines[i].trim();
        if (trimmed) result.push(trimmed);
        if (result.length > 10) break;
      }
      return result.join(" ");
    }

    default:
      return "";
  }
}

/**
 * extractLineItems — ดึงรายการสินค้า/บริการจากตาราง
 *
 * *** ถ้า format ตารางใหม่ซับซ้อน ให้เพิ่ม logic ที่นี่ ***
 */
function extractLineItems(lines: string[], rule: FieldRule, defaultVatType: string): ExtractedInvoice["items"] {
  const items: ExtractedInvoice["items"] = [];
  const headerKw = rule.headerKeyword || rule.keyword;
  const footerKw = rule.footerKeyword || rule.stopKeyword || "";

  let startIdx = -1;
  let endIdx = lines.length;

  for (let i = 0; i < lines.length; i++) {
    if (startIdx === -1 && lines[i].toLowerCase().includes(headerKw.toLowerCase())) {
      startIdx = i + 1;
    }
    if (startIdx > -1 && footerKw && lines[i].toLowerCase().includes(footerKw.toLowerCase())) {
      endIdx = i;
      break;
    }
  }

  if (startIdx === -1) return items;

  for (let i = startIdx; i < endIdx; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (/(?:รวม|total|subtotal|ยอดรวม|ภาษี|vat|หัก\s*ณ|withholding)/i.test(line)) continue;

    const nums = line.match(/[\d,]+\.?\d*/g) || [];
    const numValues = nums.map(n => cleanNumber(n)).filter(n => n !== 0);
    if (numValues.length < 1) continue;

    let textPart = line;
    for (const n of nums) {
      textPart = textPart.replace(n, "").trim();
    }
    textPart = textPart.replace(/^\d{1,3}\s+/, "").replace(/\s{2,}/g, " ").trim();

    if (!textPart || textPart.length < 2) continue;

    let qty = 1, unitPrice = 0, amount = 0;
    if (numValues.length >= 3) {
      qty = numValues[0] || 1;
      unitPrice = numValues[1] || 0;
      amount = numValues[numValues.length - 1] || 0;
    } else if (numValues.length === 2) {
      qty = numValues[0] || 1;
      amount = numValues[1] || 0;
      unitPrice = qty > 0 ? amount / qty : amount;
    } else {
      amount = numValues[0];
      unitPrice = amount;
    }

    if (amount !== 0) {
      items.push({
        description: textPart,
        qty,
        unit: "ชิ้น",
        unitPrice: Math.round(unitPrice * 100) / 100,
        amount: Math.round(amount * 100) / 100,
        vatType: defaultVatType,
      });
    }
  }

  return items;
}

export function matchTemplate(fullText: string, templates: TemplateConfig[]): TemplateConfig | null {
  const sorted = [...templates].sort((a, b) => (b.priority || 0) - (a.priority || 0));
  for (const t of sorted) {
    const allMatch = t.detectKeywords.every(kw => {
      try {
        if (kw.startsWith("/") && kw.lastIndexOf("/") > 0) {
          const lastSlash = kw.lastIndexOf("/");
          const pattern = kw.substring(1, lastSlash);
          const flags = kw.substring(lastSlash + 1) || "i";
          return new RegExp(pattern, flags).test(fullText);
        }
        return fullText.toLowerCase().includes(kw.toLowerCase());
      } catch {
        return fullText.toLowerCase().includes(kw.toLowerCase());
      }
    });
    if (allMatch) return t;
  }
  return null;
}

export function applyTemplate(fullText: string, template: TemplateConfig): ExtractedInvoice {
  const lines = fullText.split("\n").map(l => l.trim()).filter(Boolean);
  const rules = template.fieldRules;

  const invoiceNo = rules.invoiceNo ? applyFieldRule(lines, rules.invoiceNo) : "";
  const dateRaw = rules.date ? applyFieldRule(lines, rules.date) : "";
  const date = dateRaw ? parseDate(dateRaw) : "";
  const dueDateRaw = rules.dueDate ? applyFieldRule(lines, rules.dueDate) : "";
  const dueDate = dueDateRaw ? parseDate(dueDateRaw) : "";
  const vendorName = rules.vendorName ? applyFieldRule(lines, rules.vendorName) : "";
  const vendorTaxIdRaw = rules.vendorTaxId ? applyFieldRule(lines, rules.vendorTaxId) : "";
  const vendorTaxId = vendorTaxIdRaw.replace(/[\-\s]/g, "");
  const vendorAddress = rules.vendorAddress ? applyFieldRule(lines, rules.vendorAddress) : "";
  const vendorBranch = rules.vendorBranch ? applyFieldRule(lines, rules.vendorBranch) : "";

  const subtotalRaw = rules.subtotal ? applyFieldRule(lines, rules.subtotal) : "";
  const vatAmountRaw = rules.vatAmount ? applyFieldRule(lines, rules.vatAmount) : "";
  const totalAmountRaw = rules.totalAmount ? applyFieldRule(lines, rules.totalAmount) : "";
  const whtRaw = rules.withholdingTax ? applyFieldRule(lines, rules.withholdingTax) : "";

  let subtotal = cleanNumber(subtotalRaw);
  let vatAmount = cleanNumber(vatAmountRaw);
  let totalAmount = cleanNumber(totalAmountRaw);
  let withholdingTax = cleanNumber(whtRaw);

  const defaultVatType = template.defaultVatType || "vat7";
  const items = rules.lineItems
    ? extractLineItems(lines, rules.lineItems, defaultVatType)
    : [];

  if (items.length === 0 && totalAmount > 0) {
    items.push({
      description: vendorName || "Service fee",
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
    items,
    subtotal: Math.round(subtotal * 100) / 100,
    vatAmount: Math.round(vatAmount * 100) / 100,
    totalAmount: Math.round(totalAmount * 100) / 100,
    withholdingTax: Math.round(withholdingTax * 100) / 100,
    notes: "",
    rawText: fullText.substring(0, 3000),
    templateId: template.id,
    templateName: template.name,
  };
}
