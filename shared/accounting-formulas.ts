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
      { accountCode: "1201000", accountName: "ลูกหนี้การค้า", direction: "debit", sortOrder: 1 },
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
      { accountCode: "1201000", accountName: "ลูกหนี้การค้า", direction: "debit", sortOrder: 1 },
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
      { accountCode: "1001000", accountName: "เงินสด/เงินฝากธนาคาร", direction: "debit", sortOrder: 1 },
      { accountCode: "1201000", accountName: "ลูกหนี้การค้า", direction: "credit", sortOrder: 2 },
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
      { accountCode: "1201000", accountName: "ลูกหนี้การค้า", direction: "debit", sortOrder: 1 },
      { accountCode: "4001000", accountName: "รายได้จากการขายสินค้า", direction: "credit", sortOrder: 2 },
      { accountCode: "2341000", accountName: "ภาษีขาย", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "tax_invoice",
    businessType: "ecommerce",
    name: "E-Commerce Tax Invoice",
    nameTh: "ใบกำกับภาษี (E-Commerce)",
    description: "Tax Point เกิดเมื่อส่งมอบสินค้า — แยกรายได้ตามแพลตฟอร์ม",
    lines: [
      { accountCode: "1231000", accountName: "ลูกหนี้แพลตฟอร์ม", direction: "debit", sortOrder: 1 },
      { accountCode: "4011000", accountName: "รายได้จากการขายออนไลน์", direction: "credit", sortOrder: 2 },
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
      { accountCode: "1201000", accountName: "ลูกหนี้การค้า", direction: "debit", sortOrder: 1 },
      { accountCode: "4001000", accountName: "รายได้", direction: "credit", sortOrder: 2 },
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
      { accountCode: "1001000", accountName: "เงินสด/เงินฝากธนาคาร", direction: "debit", sortOrder: 1 },
      { accountCode: "1201000", accountName: "ลูกหนี้การค้า", direction: "credit", sortOrder: 2 },
    ],
  },
  {
    documentType: "receipt",
    businessType: "trading",
    name: "Trading Receipt",
    nameTh: "ใบเสร็จรับเงิน (ขายสินค้า)",
    description: "รับชำระเงินค่าสินค้า",
    lines: [
      { accountCode: "1001000", accountName: "เงินสด/เงินฝากธนาคาร", direction: "debit", sortOrder: 1 },
      { accountCode: "1201000", accountName: "ลูกหนี้การค้า", direction: "credit", sortOrder: 2 },
    ],
  },
  {
    documentType: "receipt",
    businessType: "ecommerce",
    name: "E-Commerce Receipt",
    nameTh: "ใบเสร็จรับเงิน (E-Commerce)",
    description: "รับชำระเงินจาก Marketplace — แพลตฟอร์มโอนเงินหลังหักค่าธรรมเนียม",
    lines: [
      { accountCode: "1001000", accountName: "เงินสด/เงินฝากธนาคาร", direction: "debit", sortOrder: 1 },
      { accountCode: "5241000", accountName: "ค่าคอมมิชชั่น Marketplace", direction: "debit", sortOrder: 2 },
      { accountCode: "1231000", accountName: "ลูกหนี้แพลตฟอร์ม", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "receipt",
    businessType: "mixed",
    name: "Mixed Receipt",
    nameTh: "ใบเสร็จรับเงิน (ผสม)",
    description: "รับชำระเงิน",
    lines: [
      { accountCode: "1001000", accountName: "เงินสด/เงินฝากธนาคาร", direction: "debit", sortOrder: 1 },
      { accountCode: "1201000", accountName: "ลูกหนี้การค้า", direction: "credit", sortOrder: 2 },
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
      { accountCode: "1301000", accountName: "สินค้าคงเหลือ", direction: "debit", sortOrder: 1 },
      { accountCode: "1432000", accountName: "ภาษีซื้อ", direction: "debit", sortOrder: 2 },
      { accountCode: "2101000", accountName: "เจ้าหนี้การค้า", direction: "credit", sortOrder: 3 },
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
      { accountCode: "2101000", accountName: "เจ้าหนี้การค้า", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "purchase",
    businessType: "ecommerce",
    name: "E-Commerce Purchase",
    nameTh: "บันทึกซื้อสินค้า (E-Commerce)",
    description: "ซื้อสินค้าเข้าสต็อกสำหรับขายออนไลน์",
    lines: [
      { accountCode: "1301000", accountName: "สินค้าคงเหลือ", direction: "debit", sortOrder: 1 },
      { accountCode: "1432000", accountName: "ภาษีซื้อ", direction: "debit", sortOrder: 2 },
      { accountCode: "2101000", accountName: "เจ้าหนี้การค้า", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "purchase",
    businessType: "ecommerce_commission",
    name: "E-Commerce Commission Reversal (TikTok)",
    nameTh: "ล้างค่าใช้จ่ายล่วงหน้า — ค่าคอมมิชชั่น TikTok",
    description: "ได้รับเอกสารจริงจาก TikTok Shop → ล้างค่าใช้จ่ายล่วงหน้า (144) เป็นค่าใช้จ่ายจริง (524)",
    lines: [
      { accountCode: "5243000", accountName: "ค่าคอมมิชชั่น TikTok Shop", direction: "debit", sortOrder: 1 },
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
      { accountCode: "5243000", accountName: "ค่าคอมมิชชั่น TikTok Shop", direction: "debit", sortOrder: 1 },
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
      { accountCode: "1301000", accountName: "สินค้าคงเหลือ / ค่าใช้จ่าย", direction: "debit", sortOrder: 1 },
      { accountCode: "1432000", accountName: "ภาษีซื้อ", direction: "debit", sortOrder: 2 },
      { accountCode: "2101000", accountName: "เจ้าหนี้การค้า", direction: "credit", sortOrder: 3 },
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
      { accountCode: "2101000", accountName: "เจ้าหนี้การค้า", direction: "credit", sortOrder: 3 },
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
      { accountCode: "1001000", accountName: "เงินสด/เงินฝากธนาคาร", direction: "debit", sortOrder: 1 },
      { accountCode: "2331000", accountName: "รายได้รับล่วงหน้า", direction: "credit", sortOrder: 2 },
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
      { accountCode: "1001000", accountName: "เงินสด/เงินฝากธนาคาร", direction: "debit", sortOrder: 1 },
      { accountCode: "2331000", accountName: "รายได้รับล่วงหน้า", direction: "credit", sortOrder: 2 },
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
      { accountCode: "1001000", accountName: "เงินสด/เงินฝากธนาคาร", direction: "debit", sortOrder: 1 },
      { accountCode: "2331000", accountName: "รายได้รับล่วงหน้า", direction: "credit", sortOrder: 2 },
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
      { accountCode: "1001000", accountName: "เงินสด/เงินฝากธนาคาร", direction: "debit", sortOrder: 1 },
      { accountCode: "2331000", accountName: "รายได้รับล่วงหน้า", direction: "credit", sortOrder: 2 },
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
      { accountCode: "1403000", accountName: "เงินจ่ายล่วงหน้า", direction: "debit", sortOrder: 1 },
      { accountCode: "1432000", accountName: "ภาษีซื้อ", direction: "debit", sortOrder: 2 },
      { accountCode: "1001000", accountName: "เงินสด/เงินฝากธนาคาร", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "purchase_deposit",
    businessType: "trading",
    name: "Trading Purchase Deposit",
    nameTh: "จ่ายเงินมัดจำ (ขายสินค้า)",
    description: "จ่ายเงินมัดจำให้ผู้ขาย — บันทึกสินทรัพย์เงินจ่ายล่วงหน้า",
    lines: [
      { accountCode: "1403000", accountName: "เงินจ่ายล่วงหน้า", direction: "debit", sortOrder: 1 },
      { accountCode: "1432000", accountName: "ภาษีซื้อ", direction: "debit", sortOrder: 2 },
      { accountCode: "1001000", accountName: "เงินสด/เงินฝากธนาคาร", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "purchase_deposit",
    businessType: "ecommerce",
    name: "E-Commerce Purchase Deposit",
    nameTh: "จ่ายเงินมัดจำ (E-Commerce)",
    description: "จ่ายเงินมัดจำให้ผู้ขาย — บันทึกสินทรัพย์เงินจ่ายล่วงหน้า",
    lines: [
      { accountCode: "1403000", accountName: "เงินจ่ายล่วงหน้า", direction: "debit", sortOrder: 1 },
      { accountCode: "1432000", accountName: "ภาษีซื้อ", direction: "debit", sortOrder: 2 },
      { accountCode: "1001000", accountName: "เงินสด/เงินฝากธนาคาร", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "purchase_deposit",
    businessType: "mixed",
    name: "Mixed Purchase Deposit",
    nameTh: "จ่ายเงินมัดจำ (ผสม)",
    description: "จ่ายเงินมัดจำให้ผู้ขาย — บันทึกสินทรัพย์เงินจ่ายล่วงหน้า",
    lines: [
      { accountCode: "1403000", accountName: "เงินจ่ายล่วงหน้า", direction: "debit", sortOrder: 1 },
      { accountCode: "1432000", accountName: "ภาษีซื้อ", direction: "debit", sortOrder: 2 },
      { accountCode: "1001000", accountName: "เงินสด/เงินฝากธนาคาร", direction: "credit", sortOrder: 3 },
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
      { accountCode: "2101000", accountName: "เจ้าหนี้การค้า", direction: "debit", sortOrder: 1 },
      { accountCode: "1001000", accountName: "เงินสด/เงินฝากธนาคาร", direction: "credit", sortOrder: 2 },
    ],
  },
  {
    documentType: "payment",
    businessType: "trading",
    name: "Trading Payment Voucher",
    nameTh: "ใบสำคัญจ่าย (ขายสินค้า)",
    description: "จ่ายชำระเงินให้ผู้ขาย — ล้างเจ้าหนี้การค้า",
    lines: [
      { accountCode: "2101000", accountName: "เจ้าหนี้การค้า", direction: "debit", sortOrder: 1 },
      { accountCode: "1001000", accountName: "เงินสด/เงินฝากธนาคาร", direction: "credit", sortOrder: 2 },
    ],
  },
  {
    documentType: "payment",
    businessType: "ecommerce",
    name: "E-Commerce Payment Voucher",
    nameTh: "ใบสำคัญจ่าย (E-Commerce)",
    description: "จ่ายชำระเงินให้ผู้ขาย — ล้างเจ้าหนี้การค้า",
    lines: [
      { accountCode: "2101000", accountName: "เจ้าหนี้การค้า", direction: "debit", sortOrder: 1 },
      { accountCode: "1001000", accountName: "เงินสด/เงินฝากธนาคาร", direction: "credit", sortOrder: 2 },
    ],
  },
  {
    documentType: "payment",
    businessType: "mixed",
    name: "Mixed Payment Voucher",
    nameTh: "ใบสำคัญจ่าย (ผสม)",
    description: "จ่ายชำระเงินให้ผู้ขาย — ล้างเจ้าหนี้การค้า",
    lines: [
      { accountCode: "2101000", accountName: "เจ้าหนี้การค้า", direction: "debit", sortOrder: 1 },
      { accountCode: "1001000", accountName: "เงินสด/เงินฝากธนาคาร", direction: "credit", sortOrder: 2 },
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
      { accountCode: "1201000", accountName: "ลูกหนี้การค้า", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "credit_note",
    businessType: "trading",
    name: "Trading Credit Note",
    nameTh: "ใบลดหนี้ขาย (ขายสินค้า)",
    description: "ลดหนี้ขาย — กลับรายการรายได้และภาษีขาย",
    lines: [
      { accountCode: "4001000", accountName: "รายได้จากการขายสินค้า", direction: "debit", sortOrder: 1 },
      { accountCode: "2341000", accountName: "ภาษีขาย", direction: "debit", sortOrder: 2 },
      { accountCode: "1201000", accountName: "ลูกหนี้การค้า", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "credit_note",
    businessType: "ecommerce",
    name: "E-Commerce Credit Note",
    nameTh: "ใบลดหนี้ขาย (E-Commerce)",
    description: "ลดหนี้ขาย — กลับรายการรายได้และภาษีขาย",
    lines: [
      { accountCode: "4011000", accountName: "รายได้จากการขายออนไลน์", direction: "debit", sortOrder: 1 },
      { accountCode: "2341000", accountName: "ภาษีขาย", direction: "debit", sortOrder: 2 },
      { accountCode: "1231000", accountName: "ลูกหนี้แพลตฟอร์ม", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "credit_note",
    businessType: "mixed",
    name: "Mixed Credit Note",
    nameTh: "ใบลดหนี้ขาย (ผสม)",
    description: "ลดหนี้ขาย — กลับรายการรายได้และภาษีขาย",
    lines: [
      { accountCode: "4001000", accountName: "รายได้", direction: "debit", sortOrder: 1 },
      { accountCode: "2341000", accountName: "ภาษีขาย", direction: "debit", sortOrder: 2 },
      { accountCode: "1201000", accountName: "ลูกหนี้การค้า", direction: "credit", sortOrder: 3 },
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
      { accountCode: "2101000", accountName: "เจ้าหนี้การค้า", direction: "debit", sortOrder: 1 },
      { accountCode: "1301000", accountName: "สินค้าคงเหลือ", direction: "credit", sortOrder: 2 },
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
      { accountCode: "2101000", accountName: "เจ้าหนี้การค้า", direction: "debit", sortOrder: 1 },
      { accountCode: "1301000", accountName: "สินค้าคงเหลือ", direction: "credit", sortOrder: 2 },
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
      { accountCode: "2101000", accountName: "เจ้าหนี้การค้า", direction: "debit", sortOrder: 1 },
      { accountCode: "1301000", accountName: "สินค้าคงเหลือ / ค่าใช้จ่าย", direction: "credit", sortOrder: 2 },
      { accountCode: "1432000", accountName: "ภาษีซื้อ", direction: "credit", sortOrder: 3 },
    ],
  },

  // ============================================
  // E-COMMERCE SETTLEMENT
  // ============================================
  {
    documentType: "ecommerce_settlement",
    businessType: "ecommerce",
    name: "E-Commerce Settlement",
    nameTh: "Settlement จากแพลตฟอร์ม",
    description: "บันทึกการรับเงินจาก Marketplace พร้อมหักค่าธรรมเนียม",
    lines: [
      { accountCode: "1041000", accountName: "Wallet แพลตฟอร์ม", direction: "debit", sortOrder: 1 },
      { accountCode: "5241000", accountName: "ค่าธรรมเนียมแพลตฟอร์ม", direction: "debit", sortOrder: 2 },
      { accountCode: "1231000", accountName: "ลูกหนี้แพลตฟอร์ม", direction: "credit", sortOrder: 3 },
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
      { accountCode: "1201000", accountName: "ลูกหนี้การค้า", direction: "debit", sortOrder: 1 },
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
      { accountCode: "1001000", accountName: "เงินสด/เงินฝากธนาคาร", direction: "debit", sortOrder: 1 },
      { accountCode: "1201000", accountName: "ลูกหนี้การค้า", direction: "credit", sortOrder: 2 },
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
      { accountCode: "1001000", accountName: "เงินสด/เงินฝากธนาคาร", direction: "debit", sortOrder: 1 },
      { accountCode: "1201000", accountName: "ลูกหนี้การค้า", direction: "credit", sortOrder: 2 },
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
      { accountCode: "2101000", accountName: "เจ้าหนี้การค้า", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "payment",
    businessType: "accounting",
    name: "Accounting Firm Payment",
    nameTh: "ใบสำคัญจ่าย (สำนักงานบัญชี)",
    description: "จ่ายชำระเงินให้ผู้ขาย",
    lines: [
      { accountCode: "2101000", accountName: "เจ้าหนี้การค้า", direction: "debit", sortOrder: 1 },
      { accountCode: "1001000", accountName: "เงินสด/เงินฝากธนาคาร", direction: "credit", sortOrder: 2 },
    ],
  },
  {
    documentType: "deposit",
    businessType: "accounting",
    name: "Accounting Firm Deposit",
    nameTh: "รับเงินมัดจำ (สำนักงานบัญชี)",
    description: "รับเงินมัดจำค่าบริการ",
    lines: [
      { accountCode: "1001000", accountName: "เงินสด/เงินฝากธนาคาร", direction: "debit", sortOrder: 1 },
      { accountCode: "2331000", accountName: "รายได้รับล่วงหน้า", direction: "credit", sortOrder: 2 },
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
      { accountCode: "1403000", accountName: "เงินจ่ายล่วงหน้า", direction: "debit", sortOrder: 1 },
      { accountCode: "1432000", accountName: "ภาษีซื้อ", direction: "debit", sortOrder: 2 },
      { accountCode: "1001000", accountName: "เงินสด/เงินฝากธนาคาร", direction: "credit", sortOrder: 3 },
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
      { accountCode: "1201000", accountName: "ลูกหนี้การค้า", direction: "credit", sortOrder: 3 },
    ],
  },

  // ============================================
  // ONLINE SHOP (ร้านค้าออนไลน์)
  // ============================================
  {
    documentType: "invoice",
    businessType: "online_shop",
    name: "Online Shop Invoice (No Journal)",
    nameTh: "ใบแจ้งหนี้ (ร้านออนไลน์)",
    description: "เอกสารเรียกเก็บเงินเท่านั้น — ไม่ลงบัญชี (Tax Point เกิดเมื่อออกใบกำกับภาษี)",
    noJournalEntry: true,
    lines: [],
  },
  {
    documentType: "tax_invoice",
    businessType: "online_shop",
    name: "Online Shop Tax Invoice",
    nameTh: "ใบกำกับภาษี (ร้านออนไลน์)",
    description: "Tax Point เกิดเมื่อส่งมอบสินค้า — แยกรายได้ตามแพลตฟอร์ม",
    lines: [
      { accountCode: "1231000", accountName: "ลูกหนี้แพลตฟอร์ม", direction: "debit", sortOrder: 1 },
      { accountCode: "4011000", accountName: "รายได้จากการขายออนไลน์", direction: "credit", sortOrder: 2 },
      { accountCode: "2341000", accountName: "ภาษีขาย", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "receipt",
    businessType: "online_shop",
    name: "Online Shop Receipt",
    nameTh: "ใบเสร็จรับเงิน (ร้านออนไลน์)",
    description: "รับชำระเงินจาก Marketplace — แพลตฟอร์มโอนเงินหลังหักค่าธรรมเนียม",
    lines: [
      { accountCode: "1001000", accountName: "เงินสด/เงินฝากธนาคาร", direction: "debit", sortOrder: 1 },
      { accountCode: "5241000", accountName: "ค่าคอมมิชชั่น Marketplace", direction: "debit", sortOrder: 2 },
      { accountCode: "1231000", accountName: "ลูกหนี้แพลตฟอร์ม", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "purchase",
    businessType: "online_shop",
    name: "Online Shop Purchase",
    nameTh: "บันทึกซื้อสินค้า (ร้านออนไลน์)",
    description: "ซื้อสินค้า/วัตถุดิบเข้าสต็อกสำหรับขายออนไลน์",
    lines: [
      { accountCode: "1301000", accountName: "สินค้าคงเหลือ", direction: "debit", sortOrder: 1 },
      { accountCode: "1432000", accountName: "ภาษีซื้อ", direction: "debit", sortOrder: 2 },
      { accountCode: "2101000", accountName: "เจ้าหนี้การค้า", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "deposit",
    businessType: "online_shop",
    name: "Online Shop Deposit",
    nameTh: "รับเงินมัดจำ (ร้านออนไลน์)",
    description: "รับเงินมัดจำจากลูกค้าออนไลน์ — Tax Point เกิดทันที",
    lines: [
      { accountCode: "1001000", accountName: "เงินสด/เงินฝากธนาคาร", direction: "debit", sortOrder: 1 },
      { accountCode: "2331000", accountName: "รายได้รับล่วงหน้า", direction: "credit", sortOrder: 2 },
      { accountCode: "2341000", accountName: "ภาษีขาย", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "purchase_deposit",
    businessType: "online_shop",
    name: "Online Shop Purchase Deposit",
    nameTh: "จ่ายเงินมัดจำ (ร้านออนไลน์)",
    description: "จ่ายเงินมัดจำให้ผู้ขาย — บันทึกสินทรัพย์เงินจ่ายล่วงหน้า",
    lines: [
      { accountCode: "1403000", accountName: "เงินจ่ายล่วงหน้า", direction: "debit", sortOrder: 1 },
      { accountCode: "1432000", accountName: "ภาษีซื้อ", direction: "debit", sortOrder: 2 },
      { accountCode: "1001000", accountName: "เงินสด/เงินฝากธนาคาร", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "payment",
    businessType: "online_shop",
    name: "Online Shop Payment Voucher",
    nameTh: "ใบสำคัญจ่าย (ร้านออนไลน์)",
    description: "จ่ายชำระเงินให้ผู้ขาย — ล้างเจ้าหนี้การค้า",
    lines: [
      { accountCode: "2101000", accountName: "เจ้าหนี้การค้า", direction: "debit", sortOrder: 1 },
      { accountCode: "1001000", accountName: "เงินสด/เงินฝากธนาคาร", direction: "credit", sortOrder: 2 },
    ],
  },
  {
    documentType: "credit_note",
    businessType: "online_shop",
    name: "Online Shop Credit Note",
    nameTh: "ใบลดหนี้ขาย (ร้านออนไลน์)",
    description: "ลดหนี้ขาย — กลับรายการรายได้และภาษีขาย",
    lines: [
      { accountCode: "4011000", accountName: "รายได้จากการขายออนไลน์", direction: "debit", sortOrder: 1 },
      { accountCode: "2341000", accountName: "ภาษีขาย", direction: "debit", sortOrder: 2 },
      { accountCode: "1231000", accountName: "ลูกหนี้แพลตฟอร์ม", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "debit_note",
    businessType: "online_shop",
    name: "Online Shop Debit Note",
    nameTh: "ใบลดหนี้ซื้อ (ร้านออนไลน์)",
    description: "ลดหนี้ซื้อ — กลับรายการต้นทุนและภาษีซื้อ",
    lines: [
      { accountCode: "2101000", accountName: "เจ้าหนี้การค้า", direction: "debit", sortOrder: 1 },
      { accountCode: "1301000", accountName: "สินค้าคงเหลือ", direction: "credit", sortOrder: 2 },
      { accountCode: "1432000", accountName: "ภาษีซื้อ", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "ecommerce_settlement",
    businessType: "online_shop",
    name: "Online Shop Settlement",
    nameTh: "Settlement จากแพลตฟอร์ม (ร้านออนไลน์)",
    description: "บันทึกการรับเงินจาก Marketplace พร้อมหักค่าธรรมเนียม",
    lines: [
      { accountCode: "1041000", accountName: "Wallet แพลตฟอร์ม", direction: "debit", sortOrder: 1 },
      { accountCode: "5241000", accountName: "ค่าธรรมเนียมแพลตฟอร์ม", direction: "debit", sortOrder: 2 },
      { accountCode: "1231000", accountName: "ลูกหนี้แพลตฟอร์ม", direction: "credit", sortOrder: 3 },
    ],
  },
  {
    documentType: "purchase",
    businessType: "online_shop_commission",
    name: "Online Shop Commission Reversal",
    nameTh: "ล้างค่าใช้จ่ายล่วงหน้า — ค่าคอมมิชชั่น (ร้านออนไลน์ — ได้เอกสารจริง)",
    description: "ได้รับเอกสารจริงจากแพลตฟอร์ม → ล้างค่าใช้จ่ายล่วงหน้า (144) เป็นค่าใช้จ่ายจริง (524)",
    lines: [
      { accountCode: "5243000", accountName: "ค่าคอมมิชชั่น (เอกสารจริง)", direction: "debit", sortOrder: 1 },
      { accountCode: "1432000", accountName: "ภาษีซื้อ", direction: "debit", sortOrder: 2 },
      { accountCode: "1441300", accountName: "ค่าคอมมิชชั่นรับรู้ล่วงหน้า", direction: "credit", sortOrder: 3 },
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
      { accountCode: "5301100", accountName: "ค่าบริการแพลตฟอร์ม TikTok", direction: "credit", sortOrder: 2 },
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
      { accountCode: "5301100", accountName: "ค่าบริการแพลตฟอร์ม Shopee", direction: "credit", sortOrder: 2 },
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
      { accountCode: "5301100", accountName: "ค่าบริการแพลตฟอร์ม Lazada", direction: "credit", sortOrder: 2 },
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
      { accountCode: "1001000", accountName: "เงินสด/ธนาคาร", direction: "debit", sortOrder: 1 },
      { accountCode: "5301100", accountName: "ค่าบริการแพลตฟอร์ม", direction: "credit", sortOrder: 2 },
      { accountCode: "1432000", accountName: "ภาษีซื้อ", direction: "credit", sortOrder: 3 },
    ],
  },
];
