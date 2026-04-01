export type DocumentCategory = "sales" | "purchases" | "finance" | "other";

export type ColorThemeKey = "blue" | "green" | "red" | "amber" | "emerald" | "violet" | "slate" | "teal" | "rose" | "indigo" | "cyan" | "orange" | "pink";

export interface ColorTheme {
  key: ColorThemeKey;
  label: string;
  primary: string;
  light: string;
  bg: string;
  accent: string;
}

export const ALL_COLORS: ColorTheme[] = [
  { key: "blue", label: "น้ำเงิน", primary: "#2563eb", light: "#bfdbfe", bg: "#eff6ff", accent: "#1e40af" },
  { key: "indigo", label: "คราม", primary: "#4f46e5", light: "#c7d2fe", bg: "#eef2ff", accent: "#3730a3" },
  { key: "violet", label: "ม่วง", primary: "#7c3aed", light: "#c4b5fd", bg: "#f5f3ff", accent: "#5b21b6" },
  { key: "pink", label: "ชมพู", primary: "#ec4899", light: "#f9a8d4", bg: "#fdf2f8", accent: "#be185d" },
  { key: "rose", label: "โรส", primary: "#e11d48", light: "#fecdd3", bg: "#fff1f2", accent: "#9f1239" },
  { key: "red", label: "แดง", primary: "#dc2626", light: "#fecaca", bg: "#fef2f2", accent: "#991b1b" },
  { key: "orange", label: "ส้ม", primary: "#ea580c", light: "#fed7aa", bg: "#fff7ed", accent: "#c2410c" },
  { key: "amber", label: "อำพัน", primary: "#d97706", light: "#fde68a", bg: "#fffbeb", accent: "#92400e" },
  { key: "green", label: "เขียว", primary: "#059669", light: "#a7f3d0", bg: "#ecfdf5", accent: "#065f46" },
  { key: "emerald", label: "เขียวมรกต", primary: "#10b981", light: "#6ee7b7", bg: "#ecfdf5", accent: "#047857" },
  { key: "teal", label: "เขียวน้ำทะเล", primary: "#0d9488", light: "#99f6e4", bg: "#f0fdfa", accent: "#115e59" },
  { key: "cyan", label: "ฟ้า", primary: "#0891b2", light: "#a5f3fc", bg: "#ecfeff", accent: "#155e75" },
  { key: "slate", label: "เทาเข้ม", primary: "#475569", light: "#cbd5e1", bg: "#f8fafc", accent: "#1e293b" },
];

export const DEFAULT_CATEGORY_COLORS: Record<DocumentCategory, ColorThemeKey> = {
  sales: "green",
  purchases: "amber",
  finance: "blue",
  other: "slate",
};

const SHADE_PALETTES: Record<ColorThemeKey, string[]> = {
  blue:    ["#93c5fd", "#60a5fa", "#3b82f6", "#2563eb", "#1d4ed8", "#1e40af", "#1e3a8a", "#172554", "#0c4a6e"],
  indigo:  ["#a5b4fc", "#818cf8", "#6366f1", "#4f46e5", "#4338ca", "#3730a3", "#312e81", "#1e1b4b", "#1a165e"],
  violet:  ["#c4b5fd", "#a78bfa", "#8b5cf6", "#7c3aed", "#6d28d9", "#5b21b6", "#4c1d95", "#3b0764", "#2e0554"],
  pink:    ["#f9a8d4", "#f472b6", "#ec4899", "#db2777", "#be185d", "#9d174d", "#831843", "#6b1530", "#500e23"],
  rose:    ["#fda4af", "#fb7185", "#f43f5e", "#e11d48", "#be123c", "#9f1239", "#881337", "#6e1030", "#4c0d21"],
  red:     ["#fca5a5", "#f87171", "#ef4444", "#dc2626", "#b91c1c", "#991b1b", "#7f1d1d", "#691a1a", "#501414"],
  orange:  ["#fdba74", "#fb923c", "#f97316", "#ea580c", "#c2410c", "#9a3412", "#7c2d12", "#5c210d", "#431a0a"],
  amber:   ["#fcd34d", "#fbbf24", "#f59e0b", "#d97706", "#b45309", "#92400e", "#78350f", "#5c2c0a", "#422006"],
  green:   ["#86efac", "#4ade80", "#22c55e", "#16a34a", "#15803d", "#166534", "#14532d", "#0f3d21", "#052e16"],
  emerald: ["#6ee7b7", "#34d399", "#10b981", "#059669", "#047857", "#065f46", "#064e3b", "#043b2e", "#022c22"],
  teal:    ["#5eead4", "#2dd4bf", "#14b8a6", "#0d9488", "#0f766e", "#115e59", "#134e4a", "#0c3c38", "#042f2e"],
  cyan:    ["#67e8f9", "#22d3ee", "#06b6d4", "#0891b2", "#0e7490", "#155e75", "#164e63", "#0e3e50", "#083344"],
  slate:   ["#cbd5e1", "#94a3b8", "#64748b", "#475569", "#334155", "#1e293b", "#0f172a", "#0b1120", "#020617"],
};

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0")).join("");
}

function lightenHex(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount);
}

function darkenHex(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r * (1 - amount), g * (1 - amount), b * (1 - amount));
}

function makeThemeFromPrimary(primary: string, key: ColorThemeKey): ColorTheme {
  return {
    key,
    label: ALL_COLORS.find(c => c.key === key)?.label || "",
    primary,
    light: lightenHex(primary, 0.65),
    bg: lightenHex(primary, 0.92),
    accent: darkenHex(primary, 0.2),
  };
}

export function getCategoryShades(colorKey: ColorThemeKey, count: number): ColorTheme[] {
  const palette = SHADE_PALETTES[colorKey] || SHADE_PALETTES.slate;
  const result: ColorTheme[] = [];
  for (let i = 0; i < count; i++) {
    const idx = count <= 1 ? Math.floor(palette.length / 2) : Math.round(i * (palette.length - 1) / (count - 1));
    result.push(makeThemeFromPrimary(palette[Math.min(idx, palette.length - 1)], colorKey));
  }
  return result;
}

export function parseCategoryColors(docTypeColors?: string | null): Record<string, string> {
  if (!docTypeColors) return {};
  try {
    return typeof docTypeColors === "string" ? JSON.parse(docTypeColors) : docTypeColors;
  } catch { return {}; }
}

export function getCategoryColor(category: DocumentCategory, categoryColors: Record<string, string>): ColorThemeKey {
  return (categoryColors[category] as ColorThemeKey) || DEFAULT_CATEGORY_COLORS[category];
}

export function getDocTypeShade(docTypeKey: string, categoryColors: Record<string, string>): ColorTheme {
  const docType = getDocumentType(docTypeKey);
  if (!docType) return ALL_COLORS[0];
  const category = docType.category;
  const colorKey = getCategoryColor(category, categoryColors);
  const docsInCategory = DOCUMENT_TYPES_FULL.filter(d => d.category === category);
  const docIndex = docsInCategory.findIndex(d => d.key === docTypeKey);
  const shades = getCategoryShades(colorKey, docsInCategory.length);
  return shades[docIndex >= 0 ? docIndex : 0];
}

export interface DocumentTypeInfo {
  key: string;
  label: string;
  labelEn: string;
  prefix: string;
  category: DocumentCategory;
  nextDocTypes?: string[];
  hasVat?: boolean;
}

export const DOCUMENT_CATEGORIES: Record<DocumentCategory, { label: string; labelEn: string }> = {
  sales: { label: "เอกสารขาย", labelEn: "Sales" },
  purchases: { label: "เอกสารซื้อ", labelEn: "Purchases" },
  finance: { label: "เอกสารการเงิน", labelEn: "Finance" },
  other: { label: "เอกสารอื่นๆ", labelEn: "Other" },
};

export const DOCUMENT_TYPES_FULL: DocumentTypeInfo[] = [
  {
    key: "quotation",
    label: "ใบเสนอราคา",
    labelEn: "Quotation",
    prefix: "QO",
    category: "sales",
    nextDocTypes: ["sales_order", "invoice", "tax_invoice"],
    hasVat: false,
  },
  {
    key: "sales_order",
    label: "ใบสั่งขาย",
    labelEn: "Sales Order",
    prefix: "SO",
    category: "sales",
    nextDocTypes: ["invoice", "tax_invoice", "delivery_note"],
    hasVat: false,
  },
  {
    key: "delivery_note",
    label: "ใบส่งของ",
    labelEn: "Delivery Note",
    prefix: "DN",
    category: "sales",
    nextDocTypes: ["invoice", "tax_invoice"],
    hasVat: false,
  },
  {
    key: "invoice",
    label: "ใบแจ้งหนี้",
    labelEn: "Invoice",
    prefix: "IV",
    category: "sales",
    nextDocTypes: ["tax_invoice", "receipt"],
    hasVat: false,
  },
  {
    key: "tax_invoice",
    label: "ใบกำกับภาษี",
    labelEn: "Tax Invoice",
    prefix: "TIV",
    category: "sales",
    nextDocTypes: ["receipt"],
    hasVat: true,
  },
  {
    key: "billing_note",
    label: "ใบวางบิล",
    labelEn: "Billing Note",
    prefix: "BN",
    category: "sales",
    nextDocTypes: ["receipt"],
    hasVat: false,
  },
  {
    key: "receipt",
    label: "ใบเสร็จรับเงิน",
    labelEn: "Receipt",
    prefix: "RE",
    category: "sales",
    nextDocTypes: [],
    hasVat: false,
  },
  {
    key: "tax_invoice_receipt",
    label: "ใบเสร็จรับเงิน/ใบกำกับภาษี",
    labelEn: "Receipt / Tax Invoice",
    prefix: "TR",
    category: "sales",
    nextDocTypes: [],
    hasVat: true,
  },
  {
    key: "credit_note",
    label: "ใบลดหนี้",
    labelEn: "Credit Note",
    prefix: "CN",
    category: "sales",
    nextDocTypes: [],
    hasVat: true,
  },
  {
    key: "debit_note",
    label: "ใบเพิ่มหนี้",
    labelEn: "Debit Note",
    prefix: "DBN",
    category: "sales",
    nextDocTypes: [],
    hasVat: true,
  },

  {
    key: "purchase_request",
    label: "ใบขอซื้อ",
    labelEn: "Purchase Request",
    prefix: "PR",
    category: "purchases",
    nextDocTypes: ["purchase_order"],
    hasVat: false,
  },
  {
    key: "purchase_order",
    label: "ใบสั่งซื้อ",
    labelEn: "Purchase Order",
    prefix: "PO",
    category: "purchases",
    nextDocTypes: ["purchase_invoice", "purchase_tax_invoice"],
    hasVat: false,
  },
  {
    key: "purchase_invoice",
    label: "เอกสารซื้อ",
    labelEn: "Purchase Invoice",
    prefix: "AP",
    category: "purchases",
    nextDocTypes: ["purchase_tax_invoice", "payment_voucher"],
    hasVat: false,
  },
  {
    key: "purchase_tax_invoice",
    label: "ใบกำกับภาษีซื้อ",
    labelEn: "Purchase Tax Invoice",
    prefix: "PTI",
    category: "purchases",
    nextDocTypes: ["payment_voucher"],
    hasVat: true,
  },
  {
    key: "expense",
    label: "ค่าใช้จ่าย",
    labelEn: "Expense",
    prefix: "EXP",
    category: "purchases",
    nextDocTypes: ["payment_voucher"],
    hasVat: false,
  },

  {
    key: "payment_voucher",
    label: "ใบสำคัญจ่าย",
    labelEn: "Payment Voucher",
    prefix: "PV",
    category: "finance",
    nextDocTypes: [],
    hasVat: false,
  },
  {
    key: "receipt_voucher",
    label: "ใบสำคัญรับ",
    labelEn: "Receipt Voucher",
    prefix: "RV",
    category: "finance",
    nextDocTypes: [],
    hasVat: false,
  },
  {
    key: "deposit",
    label: "ใบรับเงินมัดจำ",
    labelEn: "Deposit Receipt",
    prefix: "DP",
    category: "finance",
    nextDocTypes: ["invoice", "tax_invoice"],
    hasVat: false,
  },
  {
    key: "withholding_tax",
    label: "หนังสือรับรองหัก ณ ที่จ่าย",
    labelEn: "Withholding Tax Certificate",
    prefix: "WHT",
    category: "finance",
    nextDocTypes: [],
    hasVat: false,
  },
];

export type DocNumberFormat = "Y_SEQ" | "YM_SEQ" | "YMD_SEQ";

export const DOC_NUMBER_FORMATS: { key: DocNumberFormat; label: string; example: string }[] = [
  { key: "Y_SEQ", label: "ปี + ลำดับ", example: "QO6800001" },
  { key: "YM_SEQ", label: "ปี + เดือน + ลำดับ", example: "QO680100001" },
  { key: "YMD_SEQ", label: "ปี + เดือน + วัน + ลำดับ", example: "QO68011500001" },
];

export type DateEra = "BE" | "CE";

export function getDocumentType(key: string): DocumentTypeInfo | undefined {
  return DOCUMENT_TYPES_FULL.find(d => d.key === key);
}

export function getDocumentsByCategory(category: DocumentCategory): DocumentTypeInfo[] {
  return DOCUMENT_TYPES_FULL.filter(d => d.category === category);
}

export function getColorByKey(colorKey?: string | null): ColorTheme {
  if (colorKey) {
    const found = ALL_COLORS.find(c => c.key === colorKey);
    if (found) return found;
  }
  return ALL_COLORS[0];
}

export const MONO_THEME: ColorTheme = {
  key: "slate",
  label: "ขาวดำ",
  primary: "#374151",
  light: "#d1d5db",
  bg: "#f9fafb",
  accent: "#1f2937",
};

export function getDocTypeColor(docTypeKey: string, categoryColors?: Record<string, string> | null, colorMode?: string): ColorTheme {
  if (colorMode === "mono") return MONO_THEME;
  return getDocTypeShade(docTypeKey, categoryColors || {});
}

export function getDocumentColor(docTypeKey: string, categoryColors?: Record<string, string> | null): string {
  return getDocTypeShade(docTypeKey, categoryColors || {}).primary;
}

export function getNextDocumentTypes(docTypeKey: string): DocumentTypeInfo[] {
  const docType = getDocumentType(docTypeKey);
  if (!docType?.nextDocTypes) return [];
  return docType.nextDocTypes
    .map(key => getDocumentType(key))
    .filter((d): d is DocumentTypeInfo => !!d);
}

export interface DocPrefixConfig {
  options: string[];
  default: string;
}

export function parseDocPrefixes(docPrefixesJson?: string | null): Record<string, DocPrefixConfig> {
  if (!docPrefixesJson) return {};
  try {
    const raw = JSON.parse(docPrefixesJson);
    const result: Record<string, DocPrefixConfig> = {};
    for (const [key, val] of Object.entries(raw)) {
      if (typeof val === "string") {
        result[key] = { options: [val], default: val };
      } else if (val && typeof val === "object" && "options" in (val as any)) {
        const cfg = val as DocPrefixConfig;
        result[key] = {
          options: Array.isArray(cfg.options) ? cfg.options : [],
          default: cfg.default || (Array.isArray(cfg.options) ? cfg.options[0] : ""),
        };
      }
    }
    return result;
  } catch {
    return {};
  }
}

export function resolvePrefix(docTypeKey: string, docPrefixesJson?: string | null): string {
  const configs = parseDocPrefixes(docPrefixesJson);
  if (configs[docTypeKey]) return configs[docTypeKey].default;
  const docType = DOCUMENT_TYPES_FULL.find(d => d.key === docTypeKey);
  return docType?.prefix || docTypeKey.toUpperCase();
}

export function getPrefixOptions(docTypeKey: string, docPrefixesJson?: string | null): string[] {
  const docType = DOCUMENT_TYPES_FULL.find(d => d.key === docTypeKey);
  const builtinPrefix = docType?.prefix || docTypeKey.toUpperCase();
  const configs = parseDocPrefixes(docPrefixesJson);
  if (configs[docTypeKey] && configs[docTypeKey].options.length > 0) {
    const opts = [...configs[docTypeKey].options];
    if (!opts.includes(builtinPrefix)) {
      opts.push(builtinPrefix);
    }
    return opts;
  }
  return [builtinPrefix];
}

export function formatDocNumber(
  prefix: string,
  seq: number,
  format: DocNumberFormat = "Y_SEQ",
  digits: number = 5,
  era: DateEra = "BE",
  date?: Date,
): string {
  const d = date || new Date();
  const ceYear = d.getFullYear();
  const year = era === "BE" ? ceYear + 543 : ceYear;
  const yy = String(year).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const seqStr = String(seq).padStart(digits, "0");

  switch (format) {
    case "YM_SEQ":
      return `${prefix}${yy}${mm}${seqStr}`;
    case "YMD_SEQ":
      return `${prefix}${yy}${mm}${dd}${seqStr}`;
    case "Y_SEQ":
    default:
      return `${prefix}${yy}${seqStr}`;
  }
}

export function validateDocNumberFormat(
  docNo: string,
  prefix: string,
  format: DocNumberFormat = "Y_SEQ",
  digits: number = 5,
  docDate?: string,
  era?: DateEra,
): { valid: boolean; message?: string } {
  if (!docNo || !prefix) return { valid: true };
  if (!docNo.startsWith(prefix)) {
    return { valid: false, message: `เลขที่เอกสารต้องขึ้นต้นด้วย "${prefix}"` };
  }
  const afterPrefix = docNo.slice(prefix.length);

  let expectedLen: number;
  let patternDesc: string;
  switch (format) {
    case "YMD_SEQ":
      expectedLen = 2 + 2 + 2 + digits; // yy + mm + dd + seq
      patternDesc = `ปี(2)+เดือน(2)+วัน(2)+ลำดับ(${digits})`;
      break;
    case "YM_SEQ":
      expectedLen = 2 + 2 + digits; // yy + mm + seq
      patternDesc = `ปี(2)+เดือน(2)+ลำดับ(${digits})`;
      break;
    case "Y_SEQ":
    default:
      expectedLen = 2 + digits; // yy + seq
      patternDesc = `ปี(2)+ลำดับ(${digits})`;
      break;
  }

  if (!/^\d+$/.test(afterPrefix)) {
    return { valid: false, message: `ส่วนตัวเลขหลัง "${prefix}" ต้องเป็นตัวเลขเท่านั้น` };
  }
  if (afterPrefix.length !== expectedLen) {
    return { valid: false, message: `รูปแบบไม่ถูกต้อง: ${prefix} + ${patternDesc} (รวม ${prefix.length + expectedLen} ตัวอักษร)` };
  }

  if (docDate) {
    const d = new Date(docDate + "T00:00:00");
    if (!isNaN(d.getTime())) {
      const dateEra = era || "BE";
      const ceYear = d.getFullYear();
      const year = dateEra === "BE" ? ceYear + 543 : ceYear;
      const expectedYY = String(year).slice(-2);
      const expectedMM = String(d.getMonth() + 1).padStart(2, "0");
      const expectedDD = String(d.getDate()).padStart(2, "0");

      const docYY = afterPrefix.slice(0, 2);
      if (docYY !== expectedYY) {
        return { valid: false, message: `ปีในเลขเอกสาร (${docYY}) ไม่ตรงกับวันที่เอกสาร (${expectedYY})` };
      }

      if (format === "YM_SEQ" || format === "YMD_SEQ") {
        const docMM = afterPrefix.slice(2, 4);
        if (docMM !== expectedMM) {
          return { valid: false, message: `เดือนในเลขเอกสาร (${docMM}) ไม่ตรงกับวันที่เอกสาร (${expectedMM})` };
        }
      }

      if (format === "YMD_SEQ") {
        const docDD = afterPrefix.slice(4, 6);
        if (docDD !== expectedDD) {
          return { valid: false, message: `วันในเลขเอกสาร (${docDD}) ไม่ตรงกับวันที่เอกสาร (${expectedDD})` };
        }
      }
    }
  }

  return { valid: true };
}

export function formatThaiDate(date?: Date, era: DateEra = "BE"): string {
  const d = date || new Date();
  const day = d.getDate().toString().padStart(2, "0");
  const ceYear = d.getFullYear();

  if (era === "CE") {
    const mm = (d.getMonth() + 1).toString().padStart(2, "0");
    return `${day}/${mm}/${ceYear}`;
  }

  const months = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
  ];
  const month = months[d.getMonth()];
  const year = ceYear + 543;
  return `${day} ${month} ${year}`;
}
