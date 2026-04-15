export const HIDDEN_MENUS_BY_BUSINESS_TYPE: Record<string, string[]> = {
  trading: [],
  service: [],
  ecommerce: [],
  mixed: [],
  accounting: [],
};

export const BUSINESS_TYPES = [
  { key: "accounting", label: "สำนักงานบัญชี", description: "สำนักงานบัญชี / สอบบัญชี / ที่ปรึกษาบัญชี" },
  { key: "service", label: "ธุรกิจบริการ", description: "ให้บริการ เช่น ที่ปรึกษา ซ่อมบำรุง โฆษณา" },
  { key: "trading", label: "ธุรกิจซื้อมาขายไป", description: "ซื้อสินค้ามาขาย ค้าปลีก ค้าส่ง" },
  { key: "ecommerce", label: "ธุรกิจ E-Commerce", description: "ขายออนไลน์ Shopee/Lazada/TikTok Shop" },
  { key: "mixed", label: "ธุรกิจผสม", description: "ทั้งบริการและขายสินค้า" },
] as const;

export type BusinessType = "accounting" | "service" | "trading" | "ecommerce" | "mixed";

export const CHART_TO_BUSINESS_TYPE: Record<string, BusinessType> = {
  standard: "mixed",
  ecommerce: "ecommerce",
  service: "service",
  accounting: "accounting",
  trading: "trading",
  none: "mixed",
};

export const DOCUMENT_TYPES = [
  { key: "invoice", label: "ใบแจ้งหนี้", labelEn: "Invoice" },
  { key: "tax_invoice", label: "ใบกำกับภาษี", labelEn: "Tax Invoice" },
  { key: "receipt", label: "ใบเสร็จรับเงิน", labelEn: "Receipt" },
  { key: "purchase", label: "เอกสารซื้อ", labelEn: "Purchase" },
  { key: "purchase_tax", label: "ใบกำกับภาษีซื้อ", labelEn: "Purchase Tax Invoice" },
  { key: "payment", label: "ใบสำคัญจ่าย", labelEn: "Payment Voucher" },
  { key: "deposit", label: "รับเงินมัดจำ", labelEn: "Deposit Receipt" },
  { key: "credit_note", label: "ใบลดหนี้ขาย", labelEn: "Sales Credit Note" },
  { key: "debit_note", label: "ใบลดหนี้ซื้อ", labelEn: "Purchase Debit Note" },
  { key: "purchase_deposit", label: "จ่ายเงินมัดจำ", labelEn: "Purchase Deposit" },
  { key: "ecommerce_import", label: "นำเข้าออเดอร์ E-Commerce", labelEn: "E-Commerce Order Import" },
  { key: "ecommerce_settlement", label: "Settlement E-Commerce", labelEn: "E-Commerce Settlement" },
] as const;

export interface DefaultFormulaTemplate {
  documentType: string;
  businessType: string;
  name: string;
  nameTh: string;
  description: string;
  noJournalEntry?: boolean;
  lines: {
    accountCode: string;
    accountName: string;
    direction: "debit" | "credit";
    sortOrder: number;
  }[];
}

export const DEFAULT_FORMULAS: DefaultFormulaTemplate[] = [
  // ============================================
  // INVOICE (ใบแจ้งหนี้)
  // ============================================
  {
    documentType: "invoice",
    businessType: "service",
    name: "Service Invoice",
    nameTh: "ใบแจ้งหนี้ (บริการ)",
    description: "Tax Point ยังไม่เกิด — ภาษีขายยังไม่ถึงกำหนด",
    lines: [
      { accountCode: "1201000", accountName: "ลูกหนี้การค้า - ในประเทศ", direction: "debit", sortOrder: 1 },
      { accountCode: "4100100", accountName: "รายได้จากการให้บริการ", direction: "credit", sortOrder: 2 },
      { accountCode: "2342000", accountName: "ภาษีขายยังไม่ถึงกำหนด", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "invoice",
    businessType: "trading",
    name: "Trading Invoice (No Journal)",
    nameTh: "ใบแจ้งหนี้ (ขายสินค้า)",
    description: "เอกสารเรียกเก็บเงินเท่านั้น — ไม่ลงบัญชี (Tax Point เกิดเมื่อออกใบกำกับภาษี)",
    noJournalEntry: true,
    lines: [],
  },
  {
    documentType: "invoice",
    businessType: "ecommerce",
    name: "E-Commerce Invoice (No Journal)",
    nameTh: "ใบแจ้งหนี้ (E-Commerce)",
    description: "เอกสารเรียกเก็บเงินเท่านั้น — ไม่ลงบัญชี (Tax Point เกิดเมื่อออกใบกำกับภาษี)",
    noJournalEntry: true,
    lines: [],
  },
  {
    documentType: "invoice",
    businessType: "mixed",
    name: "Mixed Invoice",
    nameTh: "ใบแจ้งหนี้ (ผสม)",
    description: "ใช้สำหรับส่วนบริการในธุรกิจผสม — ภาษีขายยังไม่ถึงกำหนด",
    lines: [
      { accountCode: "1201000", accountName: "ลูกหนี้การค้า - ในประเทศ", direction: "debit", sortOrder: 1 },
      { accountCode: "4100100", accountName: "รายได้จากการให้บริการ", direction: "credit", sortOrder: 2 },
      { accountCode: "2342000", accountName: "ภาษีขายยังไม่ถึงกำหนด", direction: "credit", sortOrder: 3 },
    ],
  },

  // ============================================
  // TAX INVOICE (ใบกำกับภาษี)
  // ============================================
  {
    documentType: "tax_invoice",
    businessType: "service",
    name: "Service Tax Invoice (on payment)",
    nameTh: "ใบกำกับภาษี (บริการ — รับชำระแล้ว)",
    description: "เมื่อได้รับชำระเงิน กลับภาษีขายยังไม่ถึงกำหนดเป็นภาษีขาย",
    lines: [
      { accountCode: "1001000", accountName: "เงินสด", direction: "debit", sortOrder: 1 },
      { accountCode: "1201000", accountName: "ลูกหนี้การค้า - ในประเทศ", direction: "credit", sortOrder: 2 },
      { accountCode: "2342000", accountName: "ภาษีขายยังไม่ถึงกำหนด", direction: "debit", sortOrder: 3 },
      { accountCode: "2341000", accountName: "ภาษีขาย", direction: "credit", sortOrder: 4 },
    ],
  },
  {
    documentType: "tax_invoice",
    businessType: "trading",
    name: "Trading Tax Invoice",
    nameTh: "ใบกำกับภาษี (ขายสินค้า)",
    description: "Tax Point เกิดเมื่อส่งมอบสินค้า — ภาษีขายทันที",
    lines: [
      { accountCode: "1201000", accountName: "ลูกหนี้การค้า - ในประเทศ", direction: "debit", sortOrder: 1 },
      { accountCode: "4001000", accountName: "รายได้จากการขาย", direction: "credit", sortOrder: 2 },
      { accountCode: "2341000", accountName: "ภาษีขาย", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "tax_invoice",
    businessType: "ecommerce",
    name: "Shopee Tax Invoice",
    nameTh: "ใบกำกับภาษี (Shopee)",
    description: "Tax Point เกิดเมื่อส่งมอบสินค้า — Shopee",
    lines: [
      { accountCode: "1231000", accountName: "ลูกหนี้ Shopee", direction: "debit", sortOrder: 1 },
      { accountCode: "4011000", accountName: "รายได้จากการขาย Shopee", direction: "credit", sortOrder: 2 },
      { accountCode: "2341000", accountName: "ภาษีขาย", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "tax_invoice",
    businessType: "lazada",
    name: "Lazada Tax Invoice",
    nameTh: "ใบกำกับภาษี (Lazada)",
    description: "Tax Point เกิดเมื่อส่งมอบสินค้า — Lazada",
    lines: [
      { accountCode: "1232000", accountName: "ลูกหนี้ Lazada", direction: "debit", sortOrder: 1 },
      { accountCode: "4012000", accountName: "รายได้จากการขาย Lazada", direction: "credit", sortOrder: 2 },
      { accountCode: "2341000", accountName: "ภาษีขาย", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "tax_invoice",
    businessType: "tiktok",
    name: "TikTok Tax Invoice",
    nameTh: "ใบกำกับภาษี (TikTok Shop)",
    description: "Tax Point เกิดเมื่อส่งมอบสินค้า — TikTok Shop",
    lines: [
      { accountCode: "1233000", accountName: "ลูกหนี้ TikTok Shop", direction: "debit", sortOrder: 1 },
      { accountCode: "4013000", accountName: "รายได้จากการขาย TikTok Shop", direction: "credit", sortOrder: 2 },
      { accountCode: "2341000", accountName: "ภาษีขาย", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "tax_invoice",
    businessType: "mixed",
    name: "Mixed Tax Invoice",
    nameTh: "ใบกำกับภาษี (ผสม)",
    description: "ใช้ได้ทั้งขายสินค้าและบริการ — ภาษีขายทันที",
    lines: [
      { accountCode: "1201000", accountName: "ลูกหนี้การค้า - ในประเทศ", direction: "debit", sortOrder: 1 },
      { accountCode: "4001000", accountName: "รายได้จากการขาย", direction: "credit", sortOrder: 2 },
      { accountCode: "2341000", accountName: "ภาษีขาย", direction: "credit", sortOrder: 3 },
    ],
  },

  // ============================================
  // RECEIPT (ใบเสร็จรับเงิน)
  // ============================================
  {
    documentType: "receipt",
    businessType: "service",
    name: "Service Receipt",
    nameTh: "ใบเสร็จรับเงิน (บริการ)",
    description: "รับชำระเงินค่าบริการ",
    lines: [
      { accountCode: "1001000", accountName: "เงินสด", direction: "debit", sortOrder: 1 },
      { accountCode: "1201000", accountName: "ลูกหนี้การค้า - ในประเทศ", direction: "credit", sortOrder: 2 },
    ],
  },
  {
    documentType: "receipt",
    businessType: "trading",
    name: "Trading Receipt",
    nameTh: "ใบเสร็จรับเงิน (ขายสินค้า)",
    description: "รับชำระเงินค่าสินค้า",
    lines: [
      { accountCode: "1001000", accountName: "เงินสด", direction: "debit", sortOrder: 1 },
      { accountCode: "1201000", accountName: "ลูกหนี้การค้า - ในประเทศ", direction: "credit", sortOrder: 2 },
    ],
  },
  {
    documentType: "receipt",
    businessType: "ecommerce",
    name: "Shopee Receipt",
    nameTh: "ใบเสร็จรับเงิน (Shopee)",
    description: "รับชำระเงินจาก Shopee — แพลตฟอร์มโอนเงินหลังหักค่าธรรมเนียม",
    lines: [
      { accountCode: "1001000", accountName: "เงินสด", direction: "debit", sortOrder: 1 },
      { accountCode: "5241000", accountName: "ค่าคอมมิชชั่น Shopee", direction: "debit", sortOrder: 2 },
      { accountCode: "1231000", accountName: "ลูกหนี้ Shopee", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "receipt",
    businessType: "lazada",
    name: "Lazada Receipt",
    nameTh: "ใบเสร็จรับเงิน (Lazada)",
    description: "รับชำระเงินจาก Lazada — แพลตฟอร์มโอนเงินหลังหักค่าธรรมเนียม",
    lines: [
      { accountCode: "1001000", accountName: "เงินสด", direction: "debit", sortOrder: 1 },
      { accountCode: "5242000", accountName: "ค่าคอมมิชชั่น Lazada", direction: "debit", sortOrder: 2 },
      { accountCode: "1232000", accountName: "ลูกหนี้ Lazada", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "receipt",
    businessType: "tiktok",
    name: "TikTok Receipt",
    nameTh: "ใบเสร็จรับเงิน (TikTok Shop)",
    description: "รับชำระเงินจาก TikTok Shop — แพลตฟอร์มโอนเงินหลังหักค่าธรรมเนียม",
    lines: [
      { accountCode: "1001000", accountName: "เงินสด", direction: "debit", sortOrder: 1 },
      { accountCode: "5243100", accountName: "ค่าคอมมิชชั่นแพลตฟอร์ม TikTok", direction: "debit", sortOrder: 2 },
      { accountCode: "1233000", accountName: "ลูกหนี้ TikTok Shop", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "receipt",
    businessType: "mixed",
    name: "Mixed Receipt",
    nameTh: "ใบเสร็จรับเงิน (ผสม)",
    description: "รับชำระเงิน",
    lines: [
      { accountCode: "1001000", accountName: "เงินสด", direction: "debit", sortOrder: 1 },
      { accountCode: "1201000", accountName: "ลูกหนี้การค้า - ในประเทศ", direction: "credit", sortOrder: 2 },
    ],
  },

  // ============================================
  // PURCHASE (เอกสารซื้อ)
  // ============================================
  {
    documentType: "purchase",
    businessType: "trading",
    name: "Trading Purchase",
    nameTh: "บันทึกซื้อสินค้า",
    description: "ซื้อสินค้าเข้าสต็อก",
    lines: [
      { accountCode: "1301000", accountName: "สินค้าสำเร็จรูป", direction: "debit", sortOrder: 1 },
      { accountCode: "1432000", accountName: "ภาษีซื้อ", direction: "debit", sortOrder: 2 },
      { accountCode: "2101000", accountName: "เจ้าหนี้การค้า - ในประเทศ", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "purchase",
    businessType: "service",
    name: "Service Purchase",
    nameTh: "บันทึกค่าใช้จ่าย (บริการ)",
    description: "บันทึกค่าใช้จ่ายในการให้บริการ",
    lines: [
      { accountCode: "5102000", accountName: "ต้นทุนบริการ", direction: "debit", sortOrder: 1 },
      { accountCode: "1432000", accountName: "ภาษีซื้อ", direction: "debit", sortOrder: 2 },
      { accountCode: "2101000", accountName: "เจ้าหนี้การค้า - ในประเทศ", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "purchase",
    businessType: "ecommerce",
    name: "E-Commerce Purchase",
    nameTh: "บันทึกซื้อสินค้า (E-Commerce)",
    description: "ซื้อสินค้าเข้าสต็อกสำหรับขายออนไลน์",
    lines: [
      { accountCode: "1301000", accountName: "สินค้าสำเร็จรูป", direction: "debit", sortOrder: 1 },
      { accountCode: "1432000", accountName: "ภาษีซื้อ", direction: "debit", sortOrder: 2 },
      { accountCode: "2101000", accountName: "เจ้าหนี้การค้า - ในประเทศ", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "purchase",
    businessType: "ecommerce_commission",
    name: "E-Commerce Commission Reversal (TikTok Platform)",
    nameTh: "ล้างค่าใช้จ่ายล่วงหน้า — ค่าคอมมิชชั่นแพลตฟอร์ม TikTok",
    description: "ได้รับเอกสารจริงจาก TikTok Shop → ล้าง prepaid (144) เป็นค่าคอมมิชชั่นแพลตฟอร์ม (5243100)",
    lines: [
      { accountCode: "5243100", accountName: "ค่าคอมมิชชั่นแพลตฟอร์ม TikTok", direction: "debit", sortOrder: 1 },
      { accountCode: "1432000", accountName: "ภาษีซื้อ", direction: "debit", sortOrder: 2 },
      { accountCode: "1441300", accountName: "ค่าคอมมิชชั่น TikTok รับรู้ล่วงหน้า", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "purchase",
    businessType: "tiktok_affiliate_commission",
    name: "TikTok Affiliate Commission Reversal",
    nameTh: "ล้างค่าใช้จ่ายล่วงหน้า — ค่าคอมมิชชั่น Affiliate TikTok",
    description: "ได้รับเอกสารจริงจาก TikTok → ล้าง prepaid (144) เป็นค่าคอมมิชชั่น Affiliate (5243200)",
    lines: [
      { accountCode: "5243200", accountName: "ค่าคอมมิชชั่น Affiliate TikTok", direction: "debit", sortOrder: 1 },
      { accountCode: "1432000", accountName: "ภาษีซื้อ", direction: "debit", sortOrder: 2 },
      { accountCode: "1441300", accountName: "ค่าคอมมิชชั่น TikTok รับรู้ล่วงหน้า", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "purchase",
    businessType: "shopee_commission",
    name: "E-Commerce Commission Reversal (Shopee)",
    nameTh: "ล้างค่าใช้จ่ายล่วงหน้า — ค่าคอมมิชชั่น Shopee",
    description: "ได้รับเอกสารจริงจาก Shopee → ล้างค่าใช้จ่ายล่วงหน้า (144) เป็นค่าใช้จ่ายจริง (524)",
    lines: [
      { accountCode: "5241000", accountName: "ค่าคอมมิชชั่น Shopee", direction: "debit", sortOrder: 1 },
      { accountCode: "1432000", accountName: "ภาษีซื้อ", direction: "debit", sortOrder: 2 },
      { accountCode: "1441100", accountName: "ค่าคอมมิชชั่น Shopee รับรู้ล่วงหน้า", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "purchase",
    businessType: "lazada_commission",
    name: "E-Commerce Commission Reversal (Lazada)",
    nameTh: "ล้างค่าใช้จ่ายล่วงหน้า — ค่าคอมมิชชั่น Lazada",
    description: "ได้รับเอกสารจริงจาก Lazada → ล้างค่าใช้จ่ายล่วงหน้า (144) เป็นค่าใช้จ่ายจริง (524)",
    lines: [
      { accountCode: "5242000", accountName: "ค่าคอมมิชชั่น Lazada", direction: "debit", sortOrder: 1 },
      { accountCode: "1432000", accountName: "ภาษีซื้อ", direction: "debit", sortOrder: 2 },
      { accountCode: "1441200", accountName: "ค่าคอมมิชชั่น Lazada รับรู้ล่วงหน้า", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "purchase",
    businessType: "shopee_platform_fee",
    name: "Shopee Platform Fee Reversal",
    nameTh: "ล้างค่าใช้จ่ายล่วงหน้า — ค่าบริการ Shopee",
    description: "ได้รับเอกสารจริงจาก Shopee (ใบ TIV) → ล้าง prepaid (144) เป็นค่าใช้จ่ายจริง (5xx)",
    lines: [
      { accountCode: "5241000", accountName: "ค่าคอมมิชชั่น Shopee", direction: "debit", sortOrder: 1 },
      { accountCode: "5251000", accountName: "ค่าบริการ Shopee", direction: "debit", sortOrder: 2 },
      { accountCode: "5271000", accountName: "ค่าโฆษณา Shopee Ads", direction: "debit", sortOrder: 3 },
      { accountCode: "1432000", accountName: "ภาษีซื้อ", direction: "debit", sortOrder: 4 },
      { accountCode: "1442100", accountName: "ค่าบริการ Shopee รับรู้ล่วงหน้า", direction: "credit", sortOrder: 5 },
    ],
  },
  {
    documentType: "purchase",
    businessType: "shopee_shipping",
    name: "SPX Express Shipping Fee Reversal",
    nameTh: "ล้างค่าใช้จ่ายล่วงหน้า — ค่าขนส่ง SPX Express",
    description: "ได้รับเอกสารจริงจาก SPX (ใบ RCT) → ล้าง prepaid ค่าขนส่ง (1445) เป็นค่าใช้จ่ายจริง (5265)",
    lines: [
      { accountCode: "5265000", accountName: "ค่าขนส่ง SPX Express", direction: "debit", sortOrder: 1 },
      { accountCode: "1445100", accountName: "ค่าขนส่ง Shopee รับรู้ล่วงหน้า", direction: "credit", sortOrder: 2 },
    ],
  },
  {
    documentType: "purchase",
    businessType: "lazada_platform_fee",
    name: "Lazada Platform Fee Reversal",
    nameTh: "ล้างค่าใช้จ่ายล่วงหน้า — ค่าบริการ Lazada",
    description: "ได้รับเอกสารจริงจาก Lazada (ใบ THMPTI) → ล้าง prepaid (144) เป็นค่าใช้จ่ายจริง (5xx)",
    lines: [
      { accountCode: "5242000", accountName: "ค่าคอมมิชชั่น Lazada", direction: "debit", sortOrder: 1 },
      { accountCode: "5252000", accountName: "ค่าบริการ Lazada", direction: "debit", sortOrder: 2 },
      { accountCode: "5272000", accountName: "ค่าโฆษณา Lazada Sponsored", direction: "debit", sortOrder: 3 },
      { accountCode: "1432000", accountName: "ภาษีซื้อ", direction: "debit", sortOrder: 4 },
      { accountCode: "1442200", accountName: "ค่าบริการ Lazada รับรู้ล่วงหน้า", direction: "credit", sortOrder: 5 },
    ],
  },
  {
    documentType: "purchase",
    businessType: "lazada_shipping",
    name: "Lazada Express Shipping Fee Reversal",
    nameTh: "ล้างค่าใช้จ่ายล่วงหน้า — ค่าขนส่ง Lazada Express",
    description: "ได้รับเอกสารจริงจาก Lazada (ใบ THLPTI) → ล้าง prepaid ค่าขนส่ง (1445) เป็นค่าใช้จ่ายจริง (5266)",
    lines: [
      { accountCode: "5266000", accountName: "ค่าขนส่ง Lazada Express", direction: "debit", sortOrder: 1 },
      { accountCode: "1445200", accountName: "ค่าขนส่ง Lazada รับรู้ล่วงหน้า", direction: "credit", sortOrder: 2 },
    ],
  },
  {
    documentType: "purchase",
    businessType: "tiktok_platform_fee",
    name: "TikTok Platform Fee Reversal",
    nameTh: "ล้างค่าใช้จ่ายล่วงหน้า — ค่าบริการ TikTok",
    description: "ได้รับเอกสารจริงจาก TikTok (ใบ TTSTH) → ล้าง prepaid (144) เป็นค่าใช้จ่ายจริง (5xx)",
    lines: [
      { accountCode: "5243100", accountName: "ค่าคอมมิชชั่นแพลตฟอร์ม TikTok", direction: "debit", sortOrder: 1 },
      { accountCode: "5253000", accountName: "ค่าบริการ TikTok Shop", direction: "debit", sortOrder: 2 },
      { accountCode: "5273000", accountName: "ค่าโฆษณา TikTok Ads", direction: "debit", sortOrder: 3 },
      { accountCode: "1432000", accountName: "ภาษีซื้อ", direction: "debit", sortOrder: 4 },
      { accountCode: "1442300", accountName: "ค่าบริการ TikTok รับรู้ล่วงหน้า", direction: "credit", sortOrder: 5 },
    ],
  },
  {
    documentType: "purchase",
    businessType: "tiktok_shipping",
    name: "TikTok Logistics Fee Reversal",
    nameTh: "ล้างค่าใช้จ่ายล่วงหน้า — ค่าขนส่ง TikTok",
    description: "ได้รับเอกสารจริงจาก TikTok (ใบ THJV) → ล้าง prepaid ค่าขนส่ง (1445) เป็นค่าใช้จ่ายจริง (5267)",
    lines: [
      { accountCode: "5267000", accountName: "ค่าขนส่ง TikTok (Thai Happy Logistics)", direction: "debit", sortOrder: 1 },
      { accountCode: "1445300", accountName: "ค่าขนส่ง TikTok รับรู้ล่วงหน้า", direction: "credit", sortOrder: 2 },
    ],
  },
  {
    documentType: "purchase",
    businessType: "grab_service_fee",
    name: "Grab Service Fee Reversal",
    nameTh: "ล้างค่าใช้จ่ายล่วงหน้า — ค่าบริการ Grab",
    description: "ได้รับเอกสารจริงจาก Grab (ใบ IM) → ล้าง prepaid (144) เป็นค่าใช้จ่ายจริง (5xx)",
    lines: [
      { accountCode: "5244000", accountName: "ค่าคอมมิชชั่น Grab", direction: "debit", sortOrder: 1 },
      { accountCode: "5254000", accountName: "ค่าบริการ Grab", direction: "debit", sortOrder: 2 },
      { accountCode: "1432000", accountName: "ภาษีซื้อ", direction: "debit", sortOrder: 3 },
      { accountCode: "1442900", accountName: "ค่าบริการแพลตฟอร์มอื่นรับรู้ล่วงหน้า", direction: "credit", sortOrder: 4 },
    ],
  },
  {
    documentType: "purchase",
    businessType: "shopeefood_fee",
    name: "ShopeeFood Commission Fee Reversal",
    nameTh: "ล้างค่าใช้จ่ายล่วงหน้า — ค่าบริการ ShopeeFood",
    description: "ได้รับเอกสารจริงจาก ShopeeFood (ใบ TRSPESPF) → ล้าง prepaid (144) เป็นค่าใช้จ่ายจริง (5xx)",
    lines: [
      { accountCode: "5245000", accountName: "ค่าคอมมิชชั่น ShopeeFood", direction: "debit", sortOrder: 1 },
      { accountCode: "5255000", accountName: "ค่าบริการ ShopeeFood", direction: "debit", sortOrder: 2 },
      { accountCode: "1432000", accountName: "ภาษีซื้อ", direction: "debit", sortOrder: 3 },
      { accountCode: "1442100", accountName: "ค่าบริการ Shopee รับรู้ล่วงหน้า", direction: "credit", sortOrder: 4 },
    ],
  },
  {
    documentType: "purchase",
    businessType: "spx_admin_fee",
    name: "SPX Express Admin Fee Reversal",
    nameTh: "ล้างค่าใช้จ่ายล่วงหน้า — ค่าบริการ SPX Admin",
    description: "ได้รับเอกสารจริงจาก SPX (ใบ TRSPXADB) → ล้าง prepaid (144) เป็นค่าใช้จ่ายจริง (5256)",
    lines: [
      { accountCode: "5256000", accountName: "ค่าบริการ SPX Express (Admin)", direction: "debit", sortOrder: 1 },
      { accountCode: "1432000", accountName: "ภาษีซื้อ", direction: "debit", sortOrder: 2 },
      { accountCode: "1442100", accountName: "ค่าบริการ Shopee รับรู้ล่วงหน้า", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "purchase",
    businessType: "mixed",
    name: "Mixed Purchase",
    nameTh: "บันทึกซื้อ (ผสม)",
    description: "บันทึกการซื้อสินค้า/บริการ",
    lines: [
      { accountCode: "1301000", accountName: "สินค้าสำเร็จรูป", direction: "debit", sortOrder: 1 },
      { accountCode: "1432000", accountName: "ภาษีซื้อ", direction: "debit", sortOrder: 2 },
      { accountCode: "2101000", accountName: "เจ้าหนี้การค้า - ในประเทศ", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "purchase",
    businessType: "platform_fee",
    name: "Platform Fee Expense",
    nameTh: "บันทึกค่าธรรมเนียมแพลตฟอร์ม (รวม)",
    description: "ค่าธรรมเนียมรวมทุกแพลตฟอร์ม Shopee/Lazada/TikTok — VAT/non-VAT ผสม",
    lines: [
      { accountCode: "5249000", accountName: "ค่าคอมมิชชั่นแพลตฟอร์มอื่น", direction: "debit", sortOrder: 1 },
      { accountCode: "1432000", accountName: "ภาษีซื้อ", direction: "debit", sortOrder: 2 },
      { accountCode: "2101000", accountName: "เจ้าหนี้การค้า - ในประเทศ", direction: "credit", sortOrder: 3 },
    ],
  },

  // ============================================
  // DEPOSIT (รับเงินมัดจำ)
  // ============================================
  {
    documentType: "deposit",
    businessType: "service",
    name: "Service Deposit",
    nameTh: "รับเงินมัดจำ (บริการ)",
    description: "รับเงินมัดจำค่าบริการ — Tax Point เกิดทันที",
    lines: [
      { accountCode: "1001000", accountName: "เงินสด", direction: "debit", sortOrder: 1 },
      { accountCode: "2331000", accountName: "รายได้รับล่วงหน้า - สินค้า", direction: "credit", sortOrder: 2 },
      { accountCode: "2341000", accountName: "ภาษีขาย", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "deposit",
    businessType: "trading",
    name: "Trading Deposit",
    nameTh: "รับเงินมัดจำ (ขายสินค้า)",
    description: "รับเงินมัดจำก่อนส่งสินค้า — Tax Point เกิดทันที",
    lines: [
      { accountCode: "1001000", accountName: "เงินสด", direction: "debit", sortOrder: 1 },
      { accountCode: "2331000", accountName: "รายได้รับล่วงหน้า - สินค้า", direction: "credit", sortOrder: 2 },
      { accountCode: "2341000", accountName: "ภาษีขาย", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "deposit",
    businessType: "ecommerce",
    name: "E-Commerce Deposit",
    nameTh: "รับเงินมัดจำ (E-Commerce)",
    description: "รับเงินมัดจำจากลูกค้าออนไลน์ — Tax Point เกิดทันที",
    lines: [
      { accountCode: "1001000", accountName: "เงินสด", direction: "debit", sortOrder: 1 },
      { accountCode: "2331000", accountName: "รายได้รับล่วงหน้า - สินค้า", direction: "credit", sortOrder: 2 },
      { accountCode: "2341000", accountName: "ภาษีขาย", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "deposit",
    businessType: "mixed",
    name: "Mixed Deposit",
    nameTh: "รับเงินมัดจำ (ผสม)",
    description: "รับเงินมัดจำ — Tax Point เกิดทันที",
    lines: [
      { accountCode: "1001000", accountName: "เงินสด", direction: "debit", sortOrder: 1 },
      { accountCode: "2331000", accountName: "รายได้รับล่วงหน้า - สินค้า", direction: "credit", sortOrder: 2 },
      { accountCode: "2341000", accountName: "ภาษีขาย", direction: "credit", sortOrder: 3 },
    ],
  },

  // ============================================
  // PURCHASE DEPOSIT (จ่ายเงินมัดจำ)
  // ============================================
  {
    documentType: "purchase_deposit",
    businessType: "service",
    name: "Service Purchase Deposit",
    nameTh: "จ่ายเงินมัดจำ (บริการ)",
    description: "จ่ายเงินมัดจำให้ผู้ขาย — บันทึกสินทรัพย์เงินจ่ายล่วงหน้า",
    lines: [
      { accountCode: "1403000", accountName: "เงินมัดจำจ่ายล่วงหน้า", direction: "debit", sortOrder: 1 },
      { accountCode: "1432000", accountName: "ภาษีซื้อ", direction: "debit", sortOrder: 2 },
      { accountCode: "1001000", accountName: "เงินสด", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "purchase_deposit",
    businessType: "trading",
    name: "Trading Purchase Deposit",
    nameTh: "จ่ายเงินมัดจำ (ขายสินค้า)",
    description: "จ่ายเงินมัดจำให้ผู้ขาย — บันทึกสินทรัพย์เงินจ่ายล่วงหน้า",
    lines: [
      { accountCode: "1403000", accountName: "เงินมัดจำจ่ายล่วงหน้า", direction: "debit", sortOrder: 1 },
      { accountCode: "1432000", accountName: "ภาษีซื้อ", direction: "debit", sortOrder: 2 },
      { accountCode: "1001000", accountName: "เงินสด", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "purchase_deposit",
    businessType: "ecommerce",
    name: "E-Commerce Purchase Deposit",
    nameTh: "จ่ายเงินมัดจำ (E-Commerce)",
    description: "จ่ายเงินมัดจำให้ผู้ขาย — บันทึกสินทรัพย์เงินจ่ายล่วงหน้า",
    lines: [
      { accountCode: "1403000", accountName: "เงินมัดจำจ่ายล่วงหน้า", direction: "debit", sortOrder: 1 },
      { accountCode: "1432000", accountName: "ภาษีซื้อ", direction: "debit", sortOrder: 2 },
      { accountCode: "1001000", accountName: "เงินสด", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "purchase_deposit",
    businessType: "mixed",
    name: "Mixed Purchase Deposit",
    nameTh: "จ่ายเงินมัดจำ (ผสม)",
    description: "จ่ายเงินมัดจำให้ผู้ขาย — บันทึกสินทรัพย์เงินจ่ายล่วงหน้า",
    lines: [
      { accountCode: "1403000", accountName: "เงินมัดจำจ่ายล่วงหน้า", direction: "debit", sortOrder: 1 },
      { accountCode: "1432000", accountName: "ภาษีซื้อ", direction: "debit", sortOrder: 2 },
      { accountCode: "1001000", accountName: "เงินสด", direction: "credit", sortOrder: 3 },
    ],
  },

  // ============================================
  // PAYMENT VOUCHER (ใบสำคัญจ่าย)
  // ============================================
  {
    documentType: "payment",
    businessType: "service",
    name: "Service Payment Voucher",
    nameTh: "ใบสำคัญจ่าย (บริการ)",
    description: "จ่ายชำระเงินให้ผู้ขาย — ล้างเจ้าหนี้การค้า",
    lines: [
      { accountCode: "2101000", accountName: "เจ้าหนี้การค้า - ในประเทศ", direction: "debit", sortOrder: 1 },
      { accountCode: "1001000", accountName: "เงินสด", direction: "credit", sortOrder: 2 },
    ],
  },
  {
    documentType: "payment",
    businessType: "trading",
    name: "Trading Payment Voucher",
    nameTh: "ใบสำคัญจ่าย (ขายสินค้า)",
    description: "จ่ายชำระเงินให้ผู้ขาย — ล้างเจ้าหนี้การค้า",
    lines: [
      { accountCode: "2101000", accountName: "เจ้าหนี้การค้า - ในประเทศ", direction: "debit", sortOrder: 1 },
      { accountCode: "1001000", accountName: "เงินสด", direction: "credit", sortOrder: 2 },
    ],
  },
  {
    documentType: "payment",
    businessType: "ecommerce",
    name: "E-Commerce Payment Voucher",
    nameTh: "ใบสำคัญจ่าย (E-Commerce)",
    description: "จ่ายชำระเงินให้ผู้ขาย — ล้างเจ้าหนี้การค้า",
    lines: [
      { accountCode: "2101000", accountName: "เจ้าหนี้การค้า - ในประเทศ", direction: "debit", sortOrder: 1 },
      { accountCode: "1001000", accountName: "เงินสด", direction: "credit", sortOrder: 2 },
    ],
  },
  {
    documentType: "payment",
    businessType: "mixed",
    name: "Mixed Payment Voucher",
    nameTh: "ใบสำคัญจ่าย (ผสม)",
    description: "จ่ายชำระเงินให้ผู้ขาย — ล้างเจ้าหนี้การค้า",
    lines: [
      { accountCode: "2101000", accountName: "เจ้าหนี้การค้า - ในประเทศ", direction: "debit", sortOrder: 1 },
      { accountCode: "1001000", accountName: "เงินสด", direction: "credit", sortOrder: 2 },
    ],
  },

  // ============================================
  // CREDIT NOTE (ใบลดหนี้ขาย)
  // ============================================
  {
    documentType: "credit_note",
    businessType: "service",
    name: "Service Credit Note",
    nameTh: "ใบลดหนี้ขาย (บริการ)",
    description: "ลดหนี้ขาย — กลับรายการรายได้และภาษีขาย",
    lines: [
      { accountCode: "4100100", accountName: "รายได้จากการให้บริการ", direction: "debit", sortOrder: 1 },
      { accountCode: "2341000", accountName: "ภาษีขาย", direction: "debit", sortOrder: 2 },
      { accountCode: "1201000", accountName: "ลูกหนี้การค้า - ในประเทศ", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "credit_note",
    businessType: "trading",
    name: "Trading Credit Note",
    nameTh: "ใบลดหนี้ขาย (ขายสินค้า)",
    description: "ลดหนี้ขาย — กลับรายการรายได้และภาษีขาย",
    lines: [
      { accountCode: "4001000", accountName: "รายได้จากการขาย", direction: "debit", sortOrder: 1 },
      { accountCode: "2341000", accountName: "ภาษีขาย", direction: "debit", sortOrder: 2 },
      { accountCode: "1201000", accountName: "ลูกหนี้การค้า - ในประเทศ", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "credit_note",
    businessType: "ecommerce",
    name: "E-Commerce Credit Note",
    nameTh: "ใบลดหนี้ขาย (E-Commerce)",
    description: "ลดหนี้ขาย — กลับรายการรายได้และภาษีขาย",
    lines: [
      { accountCode: "4011000", accountName: "รายได้จากการขาย Shopee", direction: "debit", sortOrder: 1 },
      { accountCode: "2341000", accountName: "ภาษีขาย", direction: "debit", sortOrder: 2 },
      { accountCode: "1231000", accountName: "ลูกหนี้ Shopee", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "credit_note",
    businessType: "mixed",
    name: "Mixed Credit Note",
    nameTh: "ใบลดหนี้ขาย (ผสม)",
    description: "ลดหนี้ขาย — กลับรายการรายได้และภาษีขาย",
    lines: [
      { accountCode: "4001000", accountName: "รายได้จากการขาย", direction: "debit", sortOrder: 1 },
      { accountCode: "2341000", accountName: "ภาษีขาย", direction: "debit", sortOrder: 2 },
      { accountCode: "1201000", accountName: "ลูกหนี้การค้า - ในประเทศ", direction: "credit", sortOrder: 3 },
    ],
  },

  // ============================================
  // DEBIT NOTE (ใบลดหนี้ซื้อ)
  // ============================================
  {
    documentType: "debit_note",
    businessType: "trading",
    name: "Trading Debit Note",
    nameTh: "ใบลดหนี้ซื้อ (ขายสินค้า)",
    description: "ลดหนี้ซื้อ — กลับรายการต้นทุนและภาษีซื้อ",
    lines: [
      { accountCode: "2101000", accountName: "เจ้าหนี้การค้า - ในประเทศ", direction: "debit", sortOrder: 1 },
      { accountCode: "1301000", accountName: "สินค้าสำเร็จรูป", direction: "credit", sortOrder: 2 },
      { accountCode: "1432000", accountName: "ภาษีซื้อ", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "debit_note",
    businessType: "ecommerce",
    name: "E-Commerce Debit Note",
    nameTh: "ใบลดหนี้ซื้อ (E-Commerce)",
    description: "ลดหนี้ซื้อ — กลับรายการต้นทุนและภาษีซื้อ",
    lines: [
      { accountCode: "2101000", accountName: "เจ้าหนี้การค้า - ในประเทศ", direction: "debit", sortOrder: 1 },
      { accountCode: "1301000", accountName: "สินค้าสำเร็จรูป", direction: "credit", sortOrder: 2 },
      { accountCode: "1432000", accountName: "ภาษีซื้อ", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "debit_note",
    businessType: "mixed",
    name: "Mixed Debit Note",
    nameTh: "ใบลดหนี้ซื้อ (ผสม)",
    description: "ลดหนี้ซื้อ — กลับรายการต้นทุนและภาษีซื้อ",
    lines: [
      { accountCode: "2101000", accountName: "เจ้าหนี้การค้า - ในประเทศ", direction: "debit", sortOrder: 1 },
      { accountCode: "1301000", accountName: "สินค้าสำเร็จรูป", direction: "credit", sortOrder: 2 },
      { accountCode: "1432000", accountName: "ภาษีซื้อ", direction: "credit", sortOrder: 3 },
    ],
  },

  // ============================================
  // E-COMMERCE SETTLEMENT
  // ============================================
  {
    documentType: "ecommerce_settlement",
    businessType: "ecommerce",
    name: "Shopee Settlement",
    nameTh: "Settlement จาก Shopee",
    description: "บันทึกการรับเงินจาก Shopee — ค่าธรรมเนียมลงรับรู้ล่วงหน้า (รอเอกสารจริง)",
    lines: [
      { accountCode: "1041000", accountName: "เงินฝาก Shopee Wallet", direction: "debit", sortOrder: 1 },
      { accountCode: "1441100", accountName: "ค่าคอมมิชชั่น Shopee รับรู้ล่วงหน้า", direction: "debit", sortOrder: 2 },
      { accountCode: "1442100", accountName: "ค่าบริการ Shopee รับรู้ล่วงหน้า", direction: "debit", sortOrder: 3 },
      { accountCode: "1231000", accountName: "ลูกหนี้ Shopee", direction: "credit", sortOrder: 4 },
    ],
  },
  {
    documentType: "ecommerce_settlement",
    businessType: "lazada",
    name: "Lazada Settlement",
    nameTh: "Settlement จาก Lazada",
    description: "บันทึกการรับเงินจาก Lazada — ค่าธรรมเนียมลงรับรู้ล่วงหน้า (รอเอกสารจริง)",
    lines: [
      { accountCode: "1042000", accountName: "เงินฝาก Lazada Wallet", direction: "debit", sortOrder: 1 },
      { accountCode: "1441200", accountName: "ค่าคอมมิชชั่น Lazada รับรู้ล่วงหน้า", direction: "debit", sortOrder: 2 },
      { accountCode: "1442200", accountName: "ค่าบริการ Lazada รับรู้ล่วงหน้า", direction: "debit", sortOrder: 3 },
      { accountCode: "1232000", accountName: "ลูกหนี้ Lazada", direction: "credit", sortOrder: 4 },
    ],
  },
  {
    documentType: "ecommerce_settlement",
    businessType: "tiktok",
    name: "TikTok Settlement",
    nameTh: "Settlement จาก TikTok Shop",
    description: "บันทึกการรับเงินจาก TikTok Shop — ค่าธรรมเนียมลงรับรู้ล่วงหน้า (รอเอกสารจริง)",
    lines: [
      { accountCode: "1043000", accountName: "เงินฝาก TikTok Shop Wallet", direction: "debit", sortOrder: 1 },
      { accountCode: "1441300", accountName: "ค่าคอมมิชชั่น TikTok รับรู้ล่วงหน้า", direction: "debit", sortOrder: 2 },
      { accountCode: "1442300", accountName: "ค่าบริการ TikTok รับรู้ล่วงหน้า", direction: "debit", sortOrder: 3 },
      { accountCode: "1233000", accountName: "ลูกหนี้ TikTok Shop", direction: "credit", sortOrder: 4 },
    ],
  },

  // ============================================
  // GRAB (Food Delivery)
  // ============================================
  {
    documentType: "tax_invoice",
    businessType: "grab",
    name: "Grab Tax Invoice",
    nameTh: "ใบกำกับภาษี (Grab)",
    description: "Tax Point เกิดเมื่อส่งมอบอาหาร/สินค้า",
    lines: [
      { accountCode: "1235000", accountName: "ลูกหนี้ Grab", direction: "debit", sortOrder: 1 },
      { accountCode: "4017000", accountName: "รายได้จากการขาย Grab", direction: "credit", sortOrder: 2 },
      { accountCode: "2341000", accountName: "ภาษีขาย", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "receipt",
    businessType: "grab",
    name: "Grab Receipt",
    nameTh: "ใบเสร็จรับเงิน (Grab)",
    description: "รับชำระเงินจาก Grab — แพลตฟอร์มโอนเงินหลังหักค่าธรรมเนียม",
    lines: [
      { accountCode: "1001000", accountName: "เงินสด", direction: "debit", sortOrder: 1 },
      { accountCode: "5244000", accountName: "ค่าคอมมิชชั่น Grab", direction: "debit", sortOrder: 2 },
      { accountCode: "1235000", accountName: "ลูกหนี้ Grab", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "ecommerce_settlement",
    businessType: "grab",
    name: "Grab Settlement",
    nameTh: "Settlement จาก Grab",
    description: "บันทึกการรับเงินจาก Grab — ค่าธรรมเนียมลงรับรู้ล่วงหน้า (รอเอกสารจริง)",
    lines: [
      { accountCode: "1045000", accountName: "เงินฝาก Grab Wallet", direction: "debit", sortOrder: 1 },
      { accountCode: "1441400", accountName: "ค่าคอมมิชชั่น Grab รับรู้ล่วงหน้า", direction: "debit", sortOrder: 2 },
      { accountCode: "1442400", accountName: "ค่าบริการ Grab รับรู้ล่วงหน้า", direction: "debit", sortOrder: 3 },
      { accountCode: "1235000", accountName: "ลูกหนี้ Grab", direction: "credit", sortOrder: 4 },
    ],
  },
  {
    documentType: "credit_note",
    businessType: "grab",
    name: "Grab Credit Note",
    nameTh: "ใบลดหนี้ขาย (Grab)",
    description: "ลดหนี้ขาย — กลับรายการรายได้และภาษีขาย",
    lines: [
      { accountCode: "4017000", accountName: "รายได้จากการขาย Grab", direction: "debit", sortOrder: 1 },
      { accountCode: "2341000", accountName: "ภาษีขาย", direction: "debit", sortOrder: 2 },
      { accountCode: "1235000", accountName: "ลูกหนี้ Grab", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "purchase",
    businessType: "grab_commission",
    name: "Grab Commission Reversal",
    nameTh: "ล้างค่าใช้จ่ายล่วงหน้า — ค่าคอมมิชชั่น Grab",
    description: "ได้รับเอกสารจริงจาก Grab → ล้างค่าใช้จ่ายล่วงหน้า (1441) เป็นค่าใช้จ่ายจริง (524)",
    lines: [
      { accountCode: "5244000", accountName: "ค่าคอมมิชชั่น Grab", direction: "debit", sortOrder: 1 },
      { accountCode: "1432000", accountName: "ภาษีซื้อ", direction: "debit", sortOrder: 2 },
      { accountCode: "1441400", accountName: "ค่าคอมมิชชั่น Grab รับรู้ล่วงหน้า", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "purchase",
    businessType: "grab_platform_fee",
    name: "Grab Platform Fee Reversal",
    nameTh: "ล้างค่าใช้จ่ายล่วงหน้า — ค่าบริการ Grab",
    description: "ได้รับเอกสารจริงจาก Grab → ล้างค่าบริการล่วงหน้า (1442) เป็นค่าใช้จ่ายจริง (525)",
    lines: [
      { accountCode: "5254000", accountName: "ค่าบริการ Grab", direction: "debit", sortOrder: 1 },
      { accountCode: "1432000", accountName: "ภาษีซื้อ", direction: "debit", sortOrder: 2 },
      { accountCode: "1442400", accountName: "ค่าบริการ Grab รับรู้ล่วงหน้า", direction: "credit", sortOrder: 3 },
    ],
  },

  // ============================================
  // LINE MAN (Food Delivery)
  // ============================================
  {
    documentType: "tax_invoice",
    businessType: "lineman",
    name: "LINE MAN Tax Invoice",
    nameTh: "ใบกำกับภาษี (LINE MAN)",
    description: "Tax Point เกิดเมื่อส่งมอบอาหาร/สินค้า",
    lines: [
      { accountCode: "1236000", accountName: "ลูกหนี้ LINE MAN", direction: "debit", sortOrder: 1 },
      { accountCode: "4018000", accountName: "รายได้จากการขาย LINE MAN", direction: "credit", sortOrder: 2 },
      { accountCode: "2341000", accountName: "ภาษีขาย", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "receipt",
    businessType: "lineman",
    name: "LINE MAN Receipt",
    nameTh: "ใบเสร็จรับเงิน (LINE MAN)",
    description: "รับชำระเงินจาก LINE MAN — แพลตฟอร์มโอนเงินหลังหักค่าธรรมเนียม",
    lines: [
      { accountCode: "1001000", accountName: "เงินสด", direction: "debit", sortOrder: 1 },
      { accountCode: "5246000", accountName: "ค่าคอมมิชชั่น LINE MAN", direction: "debit", sortOrder: 2 },
      { accountCode: "1236000", accountName: "ลูกหนี้ LINE MAN", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "ecommerce_settlement",
    businessType: "lineman",
    name: "LINE MAN Settlement",
    nameTh: "Settlement จาก LINE MAN",
    description: "บันทึกการรับเงินจาก LINE MAN — ค่าธรรมเนียมลงรับรู้ล่วงหน้า (รอเอกสารจริง)",
    lines: [
      { accountCode: "1046000", accountName: "เงินฝาก LINE MAN Wallet", direction: "debit", sortOrder: 1 },
      { accountCode: "1441500", accountName: "ค่าคอมมิชชั่น LINE MAN รับรู้ล่วงหน้า", direction: "debit", sortOrder: 2 },
      { accountCode: "1442500", accountName: "ค่าบริการ LINE MAN รับรู้ล่วงหน้า", direction: "debit", sortOrder: 3 },
      { accountCode: "1236000", accountName: "ลูกหนี้ LINE MAN", direction: "credit", sortOrder: 4 },
    ],
  },
  {
    documentType: "credit_note",
    businessType: "lineman",
    name: "LINE MAN Credit Note",
    nameTh: "ใบลดหนี้ขาย (LINE MAN)",
    description: "ลดหนี้ขาย — กลับรายการรายได้และภาษีขาย",
    lines: [
      { accountCode: "4018000", accountName: "รายได้จากการขาย LINE MAN", direction: "debit", sortOrder: 1 },
      { accountCode: "2341000", accountName: "ภาษีขาย", direction: "debit", sortOrder: 2 },
      { accountCode: "1236000", accountName: "ลูกหนี้ LINE MAN", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "purchase",
    businessType: "lineman_commission",
    name: "LINE MAN Commission Reversal",
    nameTh: "ล้างค่าใช้จ่ายล่วงหน้า — ค่าคอมมิชชั่น LINE MAN",
    description: "ได้รับเอกสารจริงจาก LINE MAN → ล้างค่าใช้จ่ายล่วงหน้า (1441) เป็นค่าใช้จ่ายจริง (524)",
    lines: [
      { accountCode: "5246000", accountName: "ค่าคอมมิชชั่น LINE MAN", direction: "debit", sortOrder: 1 },
      { accountCode: "1432000", accountName: "ภาษีซื้อ", direction: "debit", sortOrder: 2 },
      { accountCode: "1441500", accountName: "ค่าคอมมิชชั่น LINE MAN รับรู้ล่วงหน้า", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "purchase",
    businessType: "lineman_platform_fee",
    name: "LINE MAN Platform Fee Reversal",
    nameTh: "ล้างค่าใช้จ่ายล่วงหน้า — ค่าบริการ LINE MAN",
    description: "ได้รับเอกสารจริงจาก LINE MAN → ล้างค่าบริการล่วงหน้า (1442) เป็นค่าใช้จ่ายจริง (525)",
    lines: [
      { accountCode: "5257000", accountName: "ค่าบริการ LINE MAN", direction: "debit", sortOrder: 1 },
      { accountCode: "1432000", accountName: "ภาษีซื้อ", direction: "debit", sortOrder: 2 },
      { accountCode: "1442500", accountName: "ค่าบริการ LINE MAN รับรู้ล่วงหน้า", direction: "credit", sortOrder: 3 },
    ],
  },

  // ============================================
  // FOODPANDA (Food Delivery)
  // ============================================
  {
    documentType: "tax_invoice",
    businessType: "foodpanda",
    name: "foodpanda Tax Invoice",
    nameTh: "ใบกำกับภาษี (foodpanda)",
    description: "Tax Point เกิดเมื่อส่งมอบอาหาร/สินค้า",
    lines: [
      { accountCode: "1237000", accountName: "ลูกหนี้ foodpanda", direction: "debit", sortOrder: 1 },
      { accountCode: "4019000", accountName: "รายได้จากการขาย foodpanda", direction: "credit", sortOrder: 2 },
      { accountCode: "2341000", accountName: "ภาษีขาย", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "receipt",
    businessType: "foodpanda",
    name: "foodpanda Receipt",
    nameTh: "ใบเสร็จรับเงิน (foodpanda)",
    description: "รับชำระเงินจาก foodpanda — แพลตฟอร์มโอนเงินหลังหักค่าธรรมเนียม",
    lines: [
      { accountCode: "1001000", accountName: "เงินสด", direction: "debit", sortOrder: 1 },
      { accountCode: "5247000", accountName: "ค่าคอมมิชชั่น foodpanda", direction: "debit", sortOrder: 2 },
      { accountCode: "1237000", accountName: "ลูกหนี้ foodpanda", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "ecommerce_settlement",
    businessType: "foodpanda",
    name: "foodpanda Settlement",
    nameTh: "Settlement จาก foodpanda",
    description: "บันทึกการรับเงินจาก foodpanda — ค่าธรรมเนียมลงรับรู้ล่วงหน้า (รอเอกสารจริง)",
    lines: [
      { accountCode: "1047000", accountName: "เงินฝาก foodpanda Wallet", direction: "debit", sortOrder: 1 },
      { accountCode: "1441600", accountName: "ค่าคอมมิชชั่น foodpanda รับรู้ล่วงหน้า", direction: "debit", sortOrder: 2 },
      { accountCode: "1442600", accountName: "ค่าบริการ foodpanda รับรู้ล่วงหน้า", direction: "debit", sortOrder: 3 },
      { accountCode: "1237000", accountName: "ลูกหนี้ foodpanda", direction: "credit", sortOrder: 4 },
    ],
  },
  {
    documentType: "credit_note",
    businessType: "foodpanda",
    name: "foodpanda Credit Note",
    nameTh: "ใบลดหนี้ขาย (foodpanda)",
    description: "ลดหนี้ขาย — กลับรายการรายได้และภาษีขาย",
    lines: [
      { accountCode: "4019000", accountName: "รายได้จากการขาย foodpanda", direction: "debit", sortOrder: 1 },
      { accountCode: "2341000", accountName: "ภาษีขาย", direction: "debit", sortOrder: 2 },
      { accountCode: "1237000", accountName: "ลูกหนี้ foodpanda", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "purchase",
    businessType: "foodpanda_commission",
    name: "foodpanda Commission Reversal",
    nameTh: "ล้างค่าใช้จ่ายล่วงหน้า — ค่าคอมมิชชั่น foodpanda",
    description: "ได้รับเอกสารจริงจาก foodpanda → ล้างค่าใช้จ่ายล่วงหน้า (1441) เป็นค่าใช้จ่ายจริง (524)",
    lines: [
      { accountCode: "5247000", accountName: "ค่าคอมมิชชั่น foodpanda", direction: "debit", sortOrder: 1 },
      { accountCode: "1432000", accountName: "ภาษีซื้อ", direction: "debit", sortOrder: 2 },
      { accountCode: "1441600", accountName: "ค่าคอมมิชชั่น foodpanda รับรู้ล่วงหน้า", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "purchase",
    businessType: "foodpanda_platform_fee",
    name: "foodpanda Platform Fee Reversal",
    nameTh: "ล้างค่าใช้จ่ายล่วงหน้า — ค่าบริการ foodpanda",
    description: "ได้รับเอกสารจริงจาก foodpanda → ล้างค่าบริการล่วงหน้า (1442) เป็นค่าใช้จ่ายจริง (525)",
    lines: [
      { accountCode: "5258000", accountName: "ค่าบริการ foodpanda", direction: "debit", sortOrder: 1 },
      { accountCode: "1432000", accountName: "ภาษีซื้อ", direction: "debit", sortOrder: 2 },
      { accountCode: "1442600", accountName: "ค่าบริการ foodpanda รับรู้ล่วงหน้า", direction: "credit", sortOrder: 3 },
    ],
  },

  // ============================================
  // LINE SHOPPING
  // ============================================
  {
    documentType: "tax_invoice",
    businessType: "line_shopping",
    name: "LINE Shopping Tax Invoice",
    nameTh: "ใบกำกับภาษี (LINE Shopping)",
    description: "Tax Point เกิดเมื่อส่งมอบสินค้า",
    lines: [
      { accountCode: "1238000", accountName: "ลูกหนี้ LINE Shopping", direction: "debit", sortOrder: 1 },
      { accountCode: "4015000", accountName: "รายได้จากการขาย LINE Shopping", direction: "credit", sortOrder: 2 },
      { accountCode: "2341000", accountName: "ภาษีขาย", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "receipt",
    businessType: "line_shopping",
    name: "LINE Shopping Receipt",
    nameTh: "ใบเสร็จรับเงิน (LINE Shopping)",
    description: "รับชำระเงินจาก LINE Shopping — แพลตฟอร์มโอนเงินหลังหักค่าธรรมเนียม",
    lines: [
      { accountCode: "1001000", accountName: "เงินสด", direction: "debit", sortOrder: 1 },
      { accountCode: "5248000", accountName: "ค่าคอมมิชชั่น LINE Shopping", direction: "debit", sortOrder: 2 },
      { accountCode: "1238000", accountName: "ลูกหนี้ LINE Shopping", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "ecommerce_settlement",
    businessType: "line_shopping",
    name: "LINE Shopping Settlement",
    nameTh: "Settlement จาก LINE Shopping",
    description: "บันทึกการรับเงินจาก LINE Shopping — ค่าธรรมเนียมลงรับรู้ล่วงหน้า (รอเอกสารจริง)",
    lines: [
      { accountCode: "1048000", accountName: "เงินฝาก LINE Shopping Wallet", direction: "debit", sortOrder: 1 },
      { accountCode: "1441700", accountName: "ค่าคอมมิชชั่น LINE Shopping รับรู้ล่วงหน้า", direction: "debit", sortOrder: 2 },
      { accountCode: "1442700", accountName: "ค่าบริการ LINE Shopping รับรู้ล่วงหน้า", direction: "debit", sortOrder: 3 },
      { accountCode: "1238000", accountName: "ลูกหนี้ LINE Shopping", direction: "credit", sortOrder: 4 },
    ],
  },
  {
    documentType: "credit_note",
    businessType: "line_shopping",
    name: "LINE Shopping Credit Note",
    nameTh: "ใบลดหนี้ขาย (LINE Shopping)",
    description: "ลดหนี้ขาย — กลับรายการรายได้และภาษีขาย",
    lines: [
      { accountCode: "4015000", accountName: "รายได้จากการขาย LINE Shopping", direction: "debit", sortOrder: 1 },
      { accountCode: "2341000", accountName: "ภาษีขาย", direction: "debit", sortOrder: 2 },
      { accountCode: "1238000", accountName: "ลูกหนี้ LINE Shopping", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "purchase",
    businessType: "line_shopping_commission",
    name: "LINE Shopping Commission Reversal",
    nameTh: "ล้างค่าใช้จ่ายล่วงหน้า — ค่าคอมมิชชั่น LINE Shopping",
    description: "ได้รับเอกสารจริงจาก LINE Shopping → ล้างค่าใช้จ่ายล่วงหน้า (1441) เป็นค่าใช้จ่ายจริง (524)",
    lines: [
      { accountCode: "5248000", accountName: "ค่าคอมมิชชั่น LINE Shopping", direction: "debit", sortOrder: 1 },
      { accountCode: "1432000", accountName: "ภาษีซื้อ", direction: "debit", sortOrder: 2 },
      { accountCode: "1441700", accountName: "ค่าคอมมิชชั่น LINE Shopping รับรู้ล่วงหน้า", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "purchase",
    businessType: "line_shopping_platform_fee",
    name: "LINE Shopping Platform Fee Reversal",
    nameTh: "ล้างค่าใช้จ่ายล่วงหน้า — ค่าบริการ LINE Shopping",
    description: "ได้รับเอกสารจริงจาก LINE Shopping → ล้างค่าบริการล่วงหน้า (1442) เป็นค่าใช้จ่ายจริง (525)",
    lines: [
      { accountCode: "5259000", accountName: "ค่าบริการ LINE Shopping", direction: "debit", sortOrder: 1 },
      { accountCode: "1432000", accountName: "ภาษีซื้อ", direction: "debit", sortOrder: 2 },
      { accountCode: "1442700", accountName: "ค่าบริการ LINE Shopping รับรู้ล่วงหน้า", direction: "credit", sortOrder: 3 },
    ],
  },

  // ============================================
  // ACCOUNTING FIRM FORMULAS
  // ============================================
  {
    documentType: "invoice",
    businessType: "accounting",
    name: "Accounting Firm Invoice",
    nameTh: "ใบแจ้งหนี้ (สำนักงานบัญชี)",
    description: "ใบแจ้งหนี้ค่าบริการทำบัญชี — ภาษีขายยังไม่ถึงกำหนด",
    lines: [
      { accountCode: "1201000", accountName: "ลูกหนี้การค้า - ในประเทศ", direction: "debit", sortOrder: 1 },
      { accountCode: "4100100", accountName: "รายได้จากการให้บริการ", direction: "credit", sortOrder: 2 },
      { accountCode: "2342000", accountName: "ภาษีขายยังไม่ถึงกำหนด", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "tax_invoice",
    businessType: "accounting",
    name: "Accounting Firm Tax Invoice",
    nameTh: "ใบกำกับภาษี (สำนักงานบัญชี)",
    description: "รับชำระเงิน กลับภาษีขายยังไม่ถึงกำหนดเป็นภาษีขาย",
    lines: [
      { accountCode: "1001000", accountName: "เงินสด", direction: "debit", sortOrder: 1 },
      { accountCode: "1201000", accountName: "ลูกหนี้การค้า - ในประเทศ", direction: "credit", sortOrder: 2 },
      { accountCode: "2342000", accountName: "ภาษีขายยังไม่ถึงกำหนด", direction: "debit", sortOrder: 3 },
      { accountCode: "2341000", accountName: "ภาษีขาย", direction: "credit", sortOrder: 4 },
    ],
  },
  {
    documentType: "receipt",
    businessType: "accounting",
    name: "Accounting Firm Receipt",
    nameTh: "ใบเสร็จรับเงิน (สำนักงานบัญชี)",
    description: "รับชำระเงินค่าบริการ",
    lines: [
      { accountCode: "1001000", accountName: "เงินสด", direction: "debit", sortOrder: 1 },
      { accountCode: "1201000", accountName: "ลูกหนี้การค้า - ในประเทศ", direction: "credit", sortOrder: 2 },
    ],
  },
  {
    documentType: "purchase",
    businessType: "accounting",
    name: "Accounting Firm Purchase",
    nameTh: "บันทึกค่าใช้จ่าย (สำนักงานบัญชี)",
    description: "บันทึกค่าใช้จ่ายของสำนักงาน",
    lines: [
      { accountCode: "5102000", accountName: "ต้นทุนบริการ", direction: "debit", sortOrder: 1 },
      { accountCode: "1432000", accountName: "ภาษีซื้อ", direction: "debit", sortOrder: 2 },
      { accountCode: "2101000", accountName: "เจ้าหนี้การค้า - ในประเทศ", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "payment",
    businessType: "accounting",
    name: "Accounting Firm Payment",
    nameTh: "ใบสำคัญจ่าย (สำนักงานบัญชี)",
    description: "จ่ายชำระเงินให้ผู้ขาย",
    lines: [
      { accountCode: "2101000", accountName: "เจ้าหนี้การค้า - ในประเทศ", direction: "debit", sortOrder: 1 },
      { accountCode: "1001000", accountName: "เงินสด", direction: "credit", sortOrder: 2 },
    ],
  },
  {
    documentType: "deposit",
    businessType: "accounting",
    name: "Accounting Firm Deposit",
    nameTh: "รับเงินมัดจำ (สำนักงานบัญชี)",
    description: "รับเงินมัดจำค่าบริการ",
    lines: [
      { accountCode: "1001000", accountName: "เงินสด", direction: "debit", sortOrder: 1 },
      { accountCode: "2331000", accountName: "รายได้รับล่วงหน้า - สินค้า", direction: "credit", sortOrder: 2 },
      { accountCode: "2341000", accountName: "ภาษีขาย", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "purchase_deposit",
    businessType: "accounting",
    name: "Accounting Firm Purchase Deposit",
    nameTh: "จ่ายเงินมัดจำ (สำนักงานบัญชี)",
    description: "จ่ายเงินมัดจำให้ผู้ขาย",
    lines: [
      { accountCode: "1403000", accountName: "เงินมัดจำจ่ายล่วงหน้า", direction: "debit", sortOrder: 1 },
      { accountCode: "1432000", accountName: "ภาษีซื้อ", direction: "debit", sortOrder: 2 },
      { accountCode: "1001000", accountName: "เงินสด", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "credit_note",
    businessType: "accounting",
    name: "Accounting Firm Credit Note",
    nameTh: "ใบลดหนี้ขาย (สำนักงานบัญชี)",
    description: "ลดหนี้ขาย — กลับรายการรายได้และภาษีขาย",
    lines: [
      { accountCode: "4100100", accountName: "รายได้จากการให้บริการ", direction: "debit", sortOrder: 1 },
      { accountCode: "2341000", accountName: "ภาษีขาย", direction: "debit", sortOrder: 2 },
      { accountCode: "1201000", accountName: "ลูกหนี้การค้า - ในประเทศ", direction: "credit", sortOrder: 3 },
    ],
  },

  // ============================================
  // DEBIT NOTE — PLATFORM FEE (ใบลดหนี้ค่าบริการแพลตฟอร์ม)
  // ============================================
  {
    documentType: "debit_note",
    businessType: "tiktok_platform_fee",
    name: "TikTok Platform Fee Credit Note",
    nameTh: "ใบลดหนี้ — ค่าบริการ TikTok",
    description: "กลับรายการค่าบริการ TikTok — Dr. Wallet / Cr. ค่าใช้จ่าย + ภาษีซื้อ",
    lines: [
      { accountCode: "1043000", accountName: "เงินฝาก TikTok Shop Wallet", direction: "debit", sortOrder: 1 },
      { accountCode: "5253000", accountName: "ค่าบริการ TikTok Shop", direction: "credit", sortOrder: 2 },
      { accountCode: "1432000", accountName: "ภาษีซื้อ", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "debit_note",
    businessType: "shopee_platform_fee",
    name: "Shopee Platform Fee Credit Note",
    nameTh: "ใบลดหนี้ — ค่าบริการ Shopee",
    description: "กลับรายการค่าบริการ Shopee — Dr. Wallet / Cr. ค่าใช้จ่าย + ภาษีซื้อ",
    lines: [
      { accountCode: "1041000", accountName: "เงินฝาก Shopee Wallet", direction: "debit", sortOrder: 1 },
      { accountCode: "5251000", accountName: "ค่าบริการ Shopee", direction: "credit", sortOrder: 2 },
      { accountCode: "1432000", accountName: "ภาษีซื้อ", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "debit_note",
    businessType: "lazada_platform_fee",
    name: "Lazada Platform Fee Credit Note",
    nameTh: "ใบลดหนี้ — ค่าบริการ Lazada",
    description: "กลับรายการค่าบริการ Lazada — Dr. Wallet / Cr. ค่าใช้จ่าย + ภาษีซื้อ",
    lines: [
      { accountCode: "1042000", accountName: "เงินฝาก Lazada Wallet", direction: "debit", sortOrder: 1 },
      { accountCode: "5252000", accountName: "ค่าบริการ Lazada", direction: "credit", sortOrder: 2 },
      { accountCode: "1432000", accountName: "ภาษีซื้อ", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "debit_note",
    businessType: "platform_fee",
    name: "Platform Fee Credit Note (General)",
    nameTh: "ใบลดหนี้ — ค่าบริการแพลตฟอร์ม (รวม)",
    description: "กลับรายการค่าบริการแพลตฟอร์ม — Dr. Wallet / Cr. ค่าใช้จ่าย + ภาษีซื้อ",
    lines: [
      { accountCode: "1001000", accountName: "เงินสด", direction: "debit", sortOrder: 1 },
      { accountCode: "5253000", accountName: "ค่าบริการ TikTok Shop", direction: "credit", sortOrder: 2 },
      { accountCode: "1432000", accountName: "ภาษีซื้อ", direction: "credit", sortOrder: 3 },
    ],
  },

  // ============================================
  // RESTAURANT — GRAB (ผังบัญชีร้านอาหาร)
  // สูตรต่างจาก E-Commerce: ไม่มีค่าขนส่ง/ค่า infra
  // แพลตฟอร์มหัก GP รวมเป็นก้อนเดียว (Service Fee)
  // ============================================
  {
    documentType: "tax_invoice",
    businessType: "restaurant_grab",
    name: "Grab Food Tax Invoice (Restaurant)",
    nameTh: "ใบกำกับภาษี ขายอาหารผ่าน Grab",
    description: "ออกใบกำกับภาษีเมื่อส่งมอบอาหารให้ลูกค้าผ่าน Grab — ยังไม่รับเงิน",
    lines: [
      { accountCode: "1251000", accountName: "ลูกหนี้ Grab", direction: "debit", sortOrder: 1 },
      { accountCode: "4051000", accountName: "รายได้จากการขาย Grab", direction: "credit", sortOrder: 2 },
      { accountCode: "2341000", accountName: "ภาษีขาย", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "ecommerce_settlement",
    businessType: "restaurant_grab",
    name: "Grab Food Settlement (Restaurant)",
    nameTh: "Settlement จาก Grab — ร้านอาหาร",
    description: "Grab โอนเงินหลังหัก GP — บันทึกค่า GP รับรู้ล่วงหน้า (รอใบกำกับภาษีจาก Grab)",
    lines: [
      { accountCode: "1051000", accountName: "เงินฝาก Grab Wallet", direction: "debit", sortOrder: 1 },
      { accountCode: "1451000", accountName: "ค่า GP Grab รับรู้ล่วงหน้า", direction: "debit", sortOrder: 2 },
      { accountCode: "1251000", accountName: "ลูกหนี้ Grab", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "purchase",
    businessType: "restaurant_grab_gp",
    name: "Grab GP Reversal (Restaurant)",
    nameTh: "ล้างค่า GP ล่วงหน้า — ได้รับใบกำกับภาษีจาก Grab",
    description: "ได้รับเอกสาร Service Fee จาก Grab → ล้างค่า GP ล่วงหน้าเป็นค่าใช้จ่ายจริง",
    lines: [
      { accountCode: "5291000", accountName: "ค่า GP Grab (ค่าบริการรวม)", direction: "debit", sortOrder: 1 },
      { accountCode: "1432000", accountName: "ภาษีซื้อ", direction: "debit", sortOrder: 2 },
      { accountCode: "1451000", accountName: "ค่า GP Grab รับรู้ล่วงหน้า", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "credit_note",
    businessType: "restaurant_grab",
    name: "Grab Food Credit Note (Restaurant)",
    nameTh: "ใบลดหนี้ขาย Grab — ร้านอาหาร",
    description: "ลดหนี้ขาย — กลับรายการรายได้และภาษีขาย (ลูกค้ายกเลิก/คืนเงิน)",
    lines: [
      { accountCode: "4051000", accountName: "รายได้จากการขาย Grab", direction: "debit", sortOrder: 1 },
      { accountCode: "2341000", accountName: "ภาษีขาย", direction: "debit", sortOrder: 2 },
      { accountCode: "1251000", accountName: "ลูกหนี้ Grab", direction: "credit", sortOrder: 3 },
    ],
  },

  // ============================================
  // RESTAURANT — LINE MAN
  // ============================================
  {
    documentType: "tax_invoice",
    businessType: "restaurant_lineman",
    name: "LINE MAN Tax Invoice (Restaurant)",
    nameTh: "ใบกำกับภาษี ขายอาหารผ่าน LINE MAN",
    description: "ออกใบกำกับภาษีเมื่อส่งมอบอาหารให้ลูกค้าผ่าน LINE MAN",
    lines: [
      { accountCode: "1252000", accountName: "ลูกหนี้ LINE MAN", direction: "debit", sortOrder: 1 },
      { accountCode: "4052000", accountName: "รายได้จากการขาย LINE MAN", direction: "credit", sortOrder: 2 },
      { accountCode: "2341000", accountName: "ภาษีขาย", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "ecommerce_settlement",
    businessType: "restaurant_lineman",
    name: "LINE MAN Settlement (Restaurant)",
    nameTh: "Settlement จาก LINE MAN — ร้านอาหาร",
    description: "LINE MAN โอนเงินหลังหัก GP — บันทึกค่า GP รับรู้ล่วงหน้า",
    lines: [
      { accountCode: "1052000", accountName: "เงินฝาก LINE MAN Wallet", direction: "debit", sortOrder: 1 },
      { accountCode: "1452000", accountName: "ค่า GP LINE MAN รับรู้ล่วงหน้า", direction: "debit", sortOrder: 2 },
      { accountCode: "1252000", accountName: "ลูกหนี้ LINE MAN", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "purchase",
    businessType: "restaurant_lineman_gp",
    name: "LINE MAN GP Reversal (Restaurant)",
    nameTh: "ล้างค่า GP ล่วงหน้า — ได้รับใบกำกับภาษีจาก LINE MAN",
    description: "ได้รับเอกสาร Service Fee จาก LINE MAN → ล้างค่า GP ล่วงหน้าเป็นค่าใช้จ่ายจริง",
    lines: [
      { accountCode: "5292000", accountName: "ค่า GP LINE MAN (ค่าบริการรวม)", direction: "debit", sortOrder: 1 },
      { accountCode: "1432000", accountName: "ภาษีซื้อ", direction: "debit", sortOrder: 2 },
      { accountCode: "1452000", accountName: "ค่า GP LINE MAN รับรู้ล่วงหน้า", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "credit_note",
    businessType: "restaurant_lineman",
    name: "LINE MAN Credit Note (Restaurant)",
    nameTh: "ใบลดหนี้ขาย LINE MAN — ร้านอาหาร",
    description: "ลดหนี้ขาย — กลับรายการรายได้และภาษีขาย",
    lines: [
      { accountCode: "4052000", accountName: "รายได้จากการขาย LINE MAN", direction: "debit", sortOrder: 1 },
      { accountCode: "2341000", accountName: "ภาษีขาย", direction: "debit", sortOrder: 2 },
      { accountCode: "1252000", accountName: "ลูกหนี้ LINE MAN", direction: "credit", sortOrder: 3 },
    ],
  },

  // ============================================
  // RESTAURANT — FOODPANDA
  // ============================================
  {
    documentType: "tax_invoice",
    businessType: "restaurant_foodpanda",
    name: "foodpanda Tax Invoice (Restaurant)",
    nameTh: "ใบกำกับภาษี ขายอาหารผ่าน foodpanda",
    description: "ออกใบกำกับภาษีเมื่อส่งมอบอาหารให้ลูกค้าผ่าน foodpanda",
    lines: [
      { accountCode: "1253000", accountName: "ลูกหนี้ foodpanda", direction: "debit", sortOrder: 1 },
      { accountCode: "4053000", accountName: "รายได้จากการขาย foodpanda", direction: "credit", sortOrder: 2 },
      { accountCode: "2341000", accountName: "ภาษีขาย", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "ecommerce_settlement",
    businessType: "restaurant_foodpanda",
    name: "foodpanda Settlement (Restaurant)",
    nameTh: "Settlement จาก foodpanda — ร้านอาหาร",
    description: "foodpanda โอนเงินหลังหัก GP — บันทึกค่า GP รับรู้ล่วงหน้า",
    lines: [
      { accountCode: "1053000", accountName: "เงินฝาก foodpanda Wallet", direction: "debit", sortOrder: 1 },
      { accountCode: "1453000", accountName: "ค่า GP foodpanda รับรู้ล่วงหน้า", direction: "debit", sortOrder: 2 },
      { accountCode: "1253000", accountName: "ลูกหนี้ foodpanda", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "purchase",
    businessType: "restaurant_foodpanda_gp",
    name: "foodpanda GP Reversal (Restaurant)",
    nameTh: "ล้างค่า GP ล่วงหน้า — ได้รับใบกำกับภาษีจาก foodpanda",
    description: "ได้รับเอกสาร Service Fee จาก foodpanda → ล้างค่า GP ล่วงหน้าเป็นค่าใช้จ่ายจริง",
    lines: [
      { accountCode: "5293000", accountName: "ค่า GP foodpanda (ค่าบริการรวม)", direction: "debit", sortOrder: 1 },
      { accountCode: "1432000", accountName: "ภาษีซื้อ", direction: "debit", sortOrder: 2 },
      { accountCode: "1453000", accountName: "ค่า GP foodpanda รับรู้ล่วงหน้า", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "credit_note",
    businessType: "restaurant_foodpanda",
    name: "foodpanda Credit Note (Restaurant)",
    nameTh: "ใบลดหนี้ขาย foodpanda — ร้านอาหาร",
    description: "ลดหนี้ขาย — กลับรายการรายได้และภาษีขาย",
    lines: [
      { accountCode: "4053000", accountName: "รายได้จากการขาย foodpanda", direction: "debit", sortOrder: 1 },
      { accountCode: "2341000", accountName: "ภาษีขาย", direction: "debit", sortOrder: 2 },
      { accountCode: "1253000", accountName: "ลูกหนี้ foodpanda", direction: "credit", sortOrder: 3 },
    ],
  },

  // ============================================
  // RESTAURANT — ROBINHOOD
  // ============================================
  {
    documentType: "tax_invoice",
    businessType: "restaurant_robinhood",
    name: "Robinhood Tax Invoice (Restaurant)",
    nameTh: "ใบกำกับภาษี ขายอาหารผ่าน Robinhood",
    description: "ออกใบกำกับภาษีเมื่อส่งมอบอาหารให้ลูกค้าผ่าน Robinhood",
    lines: [
      { accountCode: "1254000", accountName: "ลูกหนี้ Robinhood", direction: "debit", sortOrder: 1 },
      { accountCode: "4054000", accountName: "รายได้จากการขาย Robinhood", direction: "credit", sortOrder: 2 },
      { accountCode: "2341000", accountName: "ภาษีขาย", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "ecommerce_settlement",
    businessType: "restaurant_robinhood",
    name: "Robinhood Settlement (Restaurant)",
    nameTh: "Settlement จาก Robinhood — ร้านอาหาร",
    description: "Robinhood โอนเงินหลังหัก GP — บันทึกค่า GP รับรู้ล่วงหน้า",
    lines: [
      { accountCode: "1054000", accountName: "เงินฝาก Robinhood Wallet", direction: "debit", sortOrder: 1 },
      { accountCode: "1454000", accountName: "ค่า GP Robinhood รับรู้ล่วงหน้า", direction: "debit", sortOrder: 2 },
      { accountCode: "1254000", accountName: "ลูกหนี้ Robinhood", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "purchase",
    businessType: "restaurant_robinhood_gp",
    name: "Robinhood GP Reversal (Restaurant)",
    nameTh: "ล้างค่า GP ล่วงหน้า — ได้รับใบกำกับภาษีจาก Robinhood",
    description: "ได้รับเอกสาร Service Fee จาก Robinhood → ล้างค่า GP ล่วงหน้าเป็นค่าใช้จ่ายจริง",
    lines: [
      { accountCode: "5294000", accountName: "ค่า GP Robinhood (ค่าบริการรวม)", direction: "debit", sortOrder: 1 },
      { accountCode: "1432000", accountName: "ภาษีซื้อ", direction: "debit", sortOrder: 2 },
      { accountCode: "1454000", accountName: "ค่า GP Robinhood รับรู้ล่วงหน้า", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "credit_note",
    businessType: "restaurant_robinhood",
    name: "Robinhood Credit Note (Restaurant)",
    nameTh: "ใบลดหนี้ขาย Robinhood — ร้านอาหาร",
    description: "ลดหนี้ขาย — กลับรายการรายได้และภาษีขาย",
    lines: [
      { accountCode: "4054000", accountName: "รายได้จากการขาย Robinhood", direction: "debit", sortOrder: 1 },
      { accountCode: "2341000", accountName: "ภาษีขาย", direction: "debit", sortOrder: 2 },
      { accountCode: "1254000", accountName: "ลูกหนี้ Robinhood", direction: "credit", sortOrder: 3 },
    ],
  },

  // ============================================
  // RESTAURANT — SHOPEEFOOD
  // ============================================
  {
    documentType: "tax_invoice",
    businessType: "restaurant_shopeefood",
    name: "ShopeeFood Tax Invoice (Restaurant)",
    nameTh: "ใบกำกับภาษี ขายอาหารผ่าน ShopeeFood",
    description: "ออกใบกำกับภาษีเมื่อส่งมอบอาหารให้ลูกค้าผ่าน ShopeeFood",
    lines: [
      { accountCode: "1255000", accountName: "ลูกหนี้ ShopeeFood", direction: "debit", sortOrder: 1 },
      { accountCode: "4055000", accountName: "รายได้จากการขาย ShopeeFood", direction: "credit", sortOrder: 2 },
      { accountCode: "2341000", accountName: "ภาษีขาย", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "ecommerce_settlement",
    businessType: "restaurant_shopeefood",
    name: "ShopeeFood Settlement (Restaurant)",
    nameTh: "Settlement จาก ShopeeFood — ร้านอาหาร",
    description: "ShopeeFood โอนเงินหลังหัก GP — บันทึกค่า GP รับรู้ล่วงหน้า",
    lines: [
      { accountCode: "1055000", accountName: "เงินฝาก ShopeeFood Wallet", direction: "debit", sortOrder: 1 },
      { accountCode: "1455000", accountName: "ค่า GP ShopeeFood รับรู้ล่วงหน้า", direction: "debit", sortOrder: 2 },
      { accountCode: "1255000", accountName: "ลูกหนี้ ShopeeFood", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "purchase",
    businessType: "restaurant_shopeefood_gp",
    name: "ShopeeFood GP Reversal (Restaurant)",
    nameTh: "ล้างค่า GP ล่วงหน้า — ได้รับใบกำกับภาษีจาก ShopeeFood",
    description: "ได้รับเอกสาร Service Fee จาก ShopeeFood → ล้างค่า GP ล่วงหน้าเป็นค่าใช้จ่ายจริง",
    lines: [
      { accountCode: "5295000", accountName: "ค่า GP ShopeeFood (ค่าบริการรวม)", direction: "debit", sortOrder: 1 },
      { accountCode: "1432000", accountName: "ภาษีซื้อ", direction: "debit", sortOrder: 2 },
      { accountCode: "1455000", accountName: "ค่า GP ShopeeFood รับรู้ล่วงหน้า", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "credit_note",
    businessType: "restaurant_shopeefood",
    name: "ShopeeFood Credit Note (Restaurant)",
    nameTh: "ใบลดหนี้ขาย ShopeeFood — ร้านอาหาร",
    description: "ลดหนี้ขาย — กลับรายการรายได้และภาษีขาย",
    lines: [
      { accountCode: "4055000", accountName: "รายได้จากการขาย ShopeeFood", direction: "debit", sortOrder: 1 },
      { accountCode: "2341000", accountName: "ภาษีขาย", direction: "debit", sortOrder: 2 },
      { accountCode: "1255000", accountName: "ลูกหนี้ ShopeeFood", direction: "credit", sortOrder: 3 },
    ],
  },

  // ============================================
  // RESTAURANT — DINE-IN / WALK-IN
  // ============================================
  {
    documentType: "tax_invoice",
    businessType: "restaurant_dinein",
    name: "Dine-in Tax Invoice (Restaurant)",
    nameTh: "ใบกำกับภาษี ขายอาหาร (ทานที่ร้าน)",
    description: "ออกใบกำกับภาษีสำหรับลูกค้าทานที่ร้าน — รับเงินสดหรือโอน",
    lines: [
      { accountCode: "1001000", accountName: "เงินสด", direction: "debit", sortOrder: 1 },
      { accountCode: "4021000", accountName: "รายได้ขายอาหาร (ทานที่ร้าน)", direction: "credit", sortOrder: 2 },
      { accountCode: "4024000", accountName: "รายได้ค่าบริการ (Service Charge)", direction: "credit", sortOrder: 3 },
      { accountCode: "2341000", accountName: "ภาษีขาย", direction: "credit", sortOrder: 4 },
    ],
  },
  {
    documentType: "tax_invoice",
    businessType: "restaurant_takeaway",
    name: "Takeaway Tax Invoice (Restaurant)",
    nameTh: "ใบกำกับภาษี ขายอาหาร (ซื้อกลับบ้าน)",
    description: "ออกใบกำกับภาษีสำหรับลูกค้าซื้อกลับบ้าน",
    lines: [
      { accountCode: "1001000", accountName: "เงินสด", direction: "debit", sortOrder: 1 },
      { accountCode: "4023000", accountName: "รายได้ขายอาหาร (ซื้อกลับบ้าน)", direction: "credit", sortOrder: 2 },
      { accountCode: "2341000", accountName: "ภาษีขาย", direction: "credit", sortOrder: 3 },
    ],
  },
];
