import { db } from "./db";
import { ecomDb } from "./ecom-db";
import { storage } from "./storage";
import { eq, desc, and, sql, inArray } from "drizzle-orm";
import { documentSettings, companies, accounts, accountingFormulas, accountingFormulaLines, journalEntries, journalLines, taxInvoices, taxInvoiceItems, ecommerceOrders, paymentMethods, activityLogs, vatProductDictionary, stockMovements, productStock, closedPeriods, employees, invoices, receipts, receiptLinkedDocs, purchaseInvoices, expenses, paymentVoucherLinkedDocs } from "@shared/schema";
import { formatDocNumber, validateDocNumberFormat, type DocNumberFormat, type DateEra } from "@shared/document-types";
import { DEFAULT_FORMULAS } from "@shared/accounting-formulas";

export async function checkClosedPeriod(companyId: number, entryDate: string): Promise<{ blocked: boolean; message: string }> {
  const d = new Date(entryDate);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;

  const yearlyClose = await db.select().from(closedPeriods)
    .where(and(
      eq(closedPeriods.companyId, companyId),
      eq(closedPeriods.periodType, "yearly"),
      eq(closedPeriods.year, year),
    )).limit(1);
  if (yearlyClose.length > 0) {
    return { blocked: true, message: `ไม่สามารถบันทึกบัญชีได้ — งวดปี ${year + 543} ถูกปิดแล้ว กรุณาเปิดงวดก่อนแก้ไข` };
  }

  const monthlyClose = await db.select().from(closedPeriods)
    .where(and(
      eq(closedPeriods.companyId, companyId),
      eq(closedPeriods.periodType, "monthly"),
      eq(closedPeriods.year, year),
      eq(closedPeriods.month, month),
    )).limit(1);
  if (monthlyClose.length > 0) {
    const THAI_MONTHS = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
    return { blocked: true, message: `ไม่สามารถบันทึกบัญชีได้ — งวดเดือน${THAI_MONTHS[month - 1]} ${year + 543} ถูกปิดแล้ว กรุณาเปิดงวดก่อนแก้ไข` };
  }

  return { blocked: false, message: "" };
}

export function isDbConnectionError(err: any): boolean {
  const msg = (err?.message || "").toLowerCase();
  const code = (err?.code || "").toString();
  const dbConnectionCodes = ["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EPIPE", "EAI_AGAIN",
    "57P01", "57P02", "57P03", "08000", "08001", "08003", "08004", "08006"];
  if (dbConnectionCodes.includes(code)) return true;
  return msg.includes("timeout exceeded") || msg.includes("connection refused") ||
    msg.includes("connection terminated") || msg.includes("too many clients") ||
    msg.includes("econnreset") || msg.includes("econnrefused") ||
    msg.includes("terminating connection") || msg.includes("server closed the connection unexpectedly");
}

export async function withDbRetry<T>(fn: () => Promise<T>, maxRetries = 2, delayMs = 1000): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      if (attempt < maxRetries && isDbConnectionError(err)) {
        console.warn(`[DB Retry] Attempt ${attempt + 1} failed: ${err.message}, retrying in ${delayMs}ms...`);
        await new Promise(r => setTimeout(r, delayMs));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

export async function isViewingOwnCompany(userId: number, viewingCompanyId: number | undefined): Promise<boolean> {
  if (!viewingCompanyId) return true;
  const emp = await storage.getEmployeeByUserId(userId);
  if (!emp) return true;
  return emp.companyId === viewingCompanyId;
}

export function isPrivilegedRole(role: string): boolean {
  return ["admin", "manager", "super_admin"].includes(role);
}

export function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function getNextDocNo(
  companyId: number,
  prefix: string,
  table: any,
  noColumn: any,
  companyIdColumn: any,
  docDate?: string,
  docTypeKey?: string,
  dbConn?: any,
): Promise<string> {
  const conn = dbConn || db;
  const [settings] = await conn.select().from(documentSettings).where(eq(documentSettings.companyId, companyId));
  const format = (settings?.docNumberFormat || "YM_SEQ") as DocNumberFormat;
  const digits = settings?.docNumberDigits || 5;
  const era = (settings?.dateEra || "BE") as DateEra;

  if (settings?.docPrefixes) {
    try {
      const { resolvePrefix, getPrefixOptions, DOCUMENT_TYPES_FULL } = await import("@shared/document-types");
      let key = docTypeKey;
      if (!key) {
        const match = DOCUMENT_TYPES_FULL.find(d => d.prefix === prefix);
        if (match) key = match.key;
      }
      if (key) {
        const validOptions = getPrefixOptions(key, settings.docPrefixes);
        if (!validOptions.includes(prefix)) {
          prefix = resolvePrefix(key, settings.docPrefixes);
        }
      }
    } catch {}
  }

  let now = docDate ? new Date(docDate + "T00:00:00") : new Date();
  if (isNaN(now.getTime())) {
    now = new Date();
  }
  const ceYear = now.getFullYear();
  const year = era === "BE" ? ceYear + 543 : ceYear;
  const yy = String(year).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");

  let likePattern: string;
  switch (format) {
    case "YMD_SEQ":
      likePattern = `${prefix}${yy}${mm}${dd}%`;
      break;
    case "YM_SEQ":
      likePattern = `${prefix}${yy}${mm}%`;
      break;
    case "Y_SEQ":
    default:
      likePattern = `${prefix}${yy}%`;
      break;
  }

  const existing = await conn.select({ docNo: noColumn })
    .from(table)
    .where(and(
      eq(companyIdColumn, companyId),
      sql`${noColumn} LIKE ${likePattern}`
    ))
    .orderBy(desc(noColumn))
    .limit(1);

  let nextSeq = 1;
  if (existing.length > 0) {
    const lastNo = existing[0].docNo;
    const seqPart = lastNo.slice(-digits);
    const parsed = parseInt(seqPart, 10);
    if (!isNaN(parsed)) nextSeq = parsed + 1;
  }

  return formatDocNumber(prefix, nextSeq, format, digits, era, now);
}

export async function validateDocNo(companyId: number, docNo: string, prefix: string, docDate?: string): Promise<{ valid: boolean; message?: string }> {
  if (!docNo || !prefix) return { valid: true };
  const [settings] = await db.select().from(documentSettings).where(eq(documentSettings.companyId, companyId));
  const format = (settings?.docNumberFormat || "YM_SEQ") as DocNumberFormat;
  const digits = settings?.docNumberDigits || 5;
  const era = (settings?.dateEra || "BE") as DateEra;
  return validateDocNumberFormat(docNo, prefix, format, digits, docDate, era);
}

export const JOURNAL_BOOK_PREFIX: Record<string, string> = {
  general: "JV",
  receive: "RV",
  payment: "PV",
  sales: "SV",
  purchase: "BV",
};

export async function getNextJournalEntryNo(companyId: number, journalBook: string, entryDate?: string): Promise<string> {
  const prefix = JOURNAL_BOOK_PREFIX[journalBook] || "JV";
  const [settings] = await db.select().from(documentSettings).where(eq(documentSettings.companyId, companyId));
  const format = (settings?.docNumberFormat || "YM_SEQ") as DocNumberFormat;
  const digits = settings?.docNumberDigits || 5;
  const era = (settings?.dateEra || "BE") as DateEra;

  let now = entryDate ? new Date(entryDate + "T00:00:00") : new Date();
  if (isNaN(now.getTime())) now = new Date();
  const ceYear = now.getFullYear();
  const year = era === "BE" ? ceYear + 543 : ceYear;
  const yy = String(year).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");

  let likePattern: string;
  switch (format) {
    case "YMD_SEQ": likePattern = `${prefix}${yy}${mm}${dd}%`; break;
    case "YM_SEQ": likePattern = `${prefix}${yy}${mm}%`; break;
    case "Y_SEQ": default: likePattern = `${prefix}${yy}%`; break;
  }

  const existing = await db.select({ docNo: journalEntries.entryNo })
    .from(journalEntries)
    .where(and(
      eq(journalEntries.companyId, companyId),
      sql`${journalEntries.entryNo} LIKE ${likePattern}`
    ))
    .orderBy(desc(journalEntries.entryNo))
    .limit(1);

  let nextSeq = 1;
  if (existing.length > 0 && existing[0].docNo) {
    const seqPart = existing[0].docNo.slice(-digits);
    const parsed = parseInt(seqPart, 10);
    if (!isNaN(parsed)) nextSeq = parsed + 1;
  }

  return formatDocNumber(prefix, nextSeq, format, digits, era, now);
}

export interface AutoJournalParams {
  companyId: number;
  documentType: string;
  sourceDocType: string;
  sourceDocId: number;
  docDate: string;
  docNo: string;
  subtotal: string;
  vatAmount: string;
  totalAmount: string;
  withholdingTax?: string;
  currencyCode?: string;
  exchangeRate?: string;
  userId: number;
  customerName?: string;
  paymentMethodAccountCode?: string;
  paymentMethod?: string;
  linkedInvoiceId?: number | null;
  lineItemDescriptions?: string[];
  formulaId?: number | null;
  formulaBusinessType?: string | null;
  lineItemAccounts?: { accountCode: string; accountName: string; amount: number; description?: string }[];
  overrideLines?: { accountCode: string; accountName: string; debit: string; credit: string }[];
}

export async function createAutoJournalEntry(params: AutoJournalParams): Promise<{ journalEntryId: number | null; skipped: boolean; reason?: string }> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await _createAutoJournalEntryInner(params);
    } catch (err: any) {
      const isConnTimeout = err.message?.includes("timeout") && err.message?.includes("connect");
      if (isConnTimeout && attempt < 3) {
        console.warn(`[AutoJournal] Connection timeout, retry ${attempt}/3...`);
        await new Promise(r => setTimeout(r, 500 * attempt));
        continue;
      }
      throw err;
    }
  }
  return { journalEntryId: null, skipped: true, reason: "retry exhausted" };
}

async function _createAutoJournalEntryInner(params: AutoJournalParams): Promise<{ journalEntryId: number | null; skipped: boolean; reason?: string }> {
  const _t0 = performance.now();
  const {
    companyId, documentType, sourceDocType, sourceDocId,
    docDate, docNo, subtotal, vatAmount, totalAmount, withholdingTax,
    currencyCode, exchangeRate, userId, customerName, paymentMethodAccountCode,
    paymentMethod, linkedInvoiceId, formulaId,
    formulaBusinessType: overrideBusinessType,
  } = params;
  const isCreditPayment = paymentMethod === "เครดิต" || !paymentMethod;

  const existingJEPromise = db.select().from(journalEntries)
    .where(and(
      eq(journalEntries.companyId, companyId),
      eq(journalEntries.sourceDocType, sourceDocType),
      eq(journalEntries.sourceDocId, sourceDocId),
    ));
  const periodCheckPromise = sourceDocType !== "period_closing" ? checkClosedPeriod(companyId, docDate) : Promise.resolve(null);

  const [[company], allAccounts, existingJEArr, periodCheck] = await Promise.all([
    db.select().from(companies).where(eq(companies.id, companyId)),
    db.select().from(accounts).where(eq(accounts.companyId, companyId)),
    existingJEPromise,
    periodCheckPromise,
  ]);
  const _t1 = performance.now();
  console.log(`[AutoJournal] ${docNo} parallel-queries ${Math.round(_t1 - _t0)}ms, accounts=${allAccounts.length}`);
  if (!company) return { journalEntryId: null, skipped: true, reason: "ไม่พบบริษัท" };
  if (existingJEArr.length > 0) {
    return { journalEntryId: existingJEArr[0].id, skipped: true, reason: "มีรายการบัญชีสำหรับเอกสารนี้แล้ว" };
  }
  if (periodCheck && periodCheck.blocked) {
    return { journalEntryId: null, skipped: true, reason: periodCheck.message };
  }

  const businessType = company.businessType || "mixed";
  const accountMap = new Map(allAccounts.map(a => [a.code, a]));

  const isStandaloneTaxInvoice = documentType === "tax_invoice" && !linkedInvoiceId;
  const isServiceType = businessType === "service" || businessType === "accounting" || businessType === "accounting_firm" || businessType === "mixed";
  const formulaBusinessType = overrideBusinessType || ((businessType === "accounting" || businessType === "accounting_firm") ? "service" : businessType);

  let dbFormulas: typeof accountingFormulas.$inferSelect[] = [];
  const formulaQuery = formulaId
    ? db.select().from(accountingFormulas)
        .where(and(eq(accountingFormulas.id, formulaId), eq(accountingFormulas.companyId, companyId), eq(accountingFormulas.active, true)))
    : db.select().from(accountingFormulas)
        .where(and(eq(accountingFormulas.companyId, companyId), eq(accountingFormulas.documentType, documentType), eq(accountingFormulas.businessType, formulaBusinessType), eq(accountingFormulas.active, true)));
  dbFormulas = await formulaQuery;
  if (formulaId && dbFormulas.length > 0) dbFormulas = [dbFormulas[0]];

  let formulaLines: { accountCode: string; accountName: string; direction: string; sortOrder: number }[] = [];
  let noJournalEntry = false;

  if (isStandaloneTaxInvoice && isServiceType && dbFormulas.length === 0) {
    const resolveFirst = (...codes: string[]) => codes.find(c => accountMap.has(c)) || codes[0];
    const arCode = resolveFirst("1201000");
    const revenueCode = resolveFirst("4100100");
    const vatCode = resolveFirst("2341000");
    const cashCode = resolveFirst("1001000");
    if (isCreditPayment) {
      formulaLines = [
        { accountCode: arCode, accountName: "ลูกหนี้การค้า", direction: "debit", sortOrder: 1 },
        { accountCode: revenueCode, accountName: "รายได้จากการให้บริการ", direction: "credit", sortOrder: 2 },
        { accountCode: vatCode, accountName: "ภาษีขาย", direction: "credit", sortOrder: 3 },
      ];
    } else {
      formulaLines = [
        { accountCode: cashCode, accountName: "เงินสด/เงินฝากธนาคาร", direction: "debit", sortOrder: 1 },
        { accountCode: revenueCode, accountName: "รายได้จากการให้บริการ", direction: "credit", sortOrder: 2 },
        { accountCode: vatCode, accountName: "ภาษีขาย", direction: "credit", sortOrder: 3 },
      ];
    }
  } else if (dbFormulas.length > 0) {
    const formula = dbFormulas[0];
    noJournalEntry = formula.noJournalEntry === true;
    if (!noJournalEntry) {
      const lines = await db.select().from(accountingFormulaLines)
        .where(eq(accountingFormulaLines.formulaId, formula.id))
        .orderBy(accountingFormulaLines.sortOrder);
      formulaLines = lines;
    }
  } else {
    let defaultFormula = DEFAULT_FORMULAS.find(
      f => f.documentType === documentType && f.businessType === formulaBusinessType
    );
    if (!defaultFormula && documentType === "expense") {
      defaultFormula = DEFAULT_FORMULAS.find(
        f => f.documentType === "purchase" && f.businessType === formulaBusinessType
      );
    }
    if (!defaultFormula && documentType === "purchase") {
      defaultFormula = DEFAULT_FORMULAS.find(
        f => f.documentType === "expense" && f.businessType === formulaBusinessType
      );
    }
    console.log(`[AutoJournal] Lookup: docType=${documentType}, bizType=${formulaBusinessType}, found=${!!defaultFormula}${defaultFormula ? ` (${defaultFormula.name}, lines=${defaultFormula.lines.length})` : ''}`);
    if (defaultFormula) {
      noJournalEntry = defaultFormula.noJournalEntry === true;
      formulaLines = defaultFormula.lines;
    } else {
      return { journalEntryId: null, skipped: true, reason: `ไม่พบสูตรบัญชีสำหรับ ${documentType} (${formulaBusinessType})` };
    }
  }

  if (noJournalEntry) {
    return { journalEntryId: null, skipped: true, reason: "เอกสารนี้ไม่ลงบัญชี (noJournalEntry)" };
  }

  if (formulaLines.length === 0) {
    return { journalEntryId: null, skipped: true, reason: "สูตรบัญชีไม่มีรายการ" };
  }

  if ((documentType === "purchase" || documentType === "expense") && company.inventoryAccountingMethod === "periodic") {
    formulaLines = formulaLines.map(line => {
      if (line.accountCode === "1301000") {
        return { ...line, accountCode: "5102000", accountName: "ซื้อสินค้า" };
      }
      return line;
    });
  }

  const sub = parseFloat(subtotal) || 0;
  const vat = parseFloat(vatAmount) || 0;
  const wht = parseFloat(withholdingTax || "0") || 0;
  const grossTotal = sub + vat;

  const isReceipt = documentType === "receipt";
  const isTaxInvoice = documentType === "tax_invoice";
  const isPaymentVoucher = documentType === "payment";
  const isPurchaseOrExpense = documentType === "purchase" || documentType === "expense";
  const netCash = (isReceipt || isTaxInvoice || isPaymentVoucher || isPurchaseOrExpense) ? grossTotal - wht : grossTotal;

  const result = await db.transaction(async (tx) => {
    const docTypeLabel: Record<string, string> = {
      invoice: "ใบแจ้งหนี้",
      tax_invoice: "ใบกำกับภาษี",
      receipt: "ใบเสร็จรับเงิน",
      purchase: "เอกสารซื้อ",
      deposit: "รับเงินมัดจำ",
      payment: "ใบสำคัญจ่าย",
    };
    const descText = `${docTypeLabel[documentType] || documentType} ${docNo}${customerName ? ` - ${customerName}` : ""}`;

    const bookMap: Record<string, string> = {
      invoice: "sales", tax_invoice: "sales", receipt: "receive",
      purchase: "purchase", expense: "payment", deposit: "receive",
      payment: "payment",
    };
    const journalBook = bookMap[documentType] || "general";

    const entryNo = await getNextJournalEntryNo(companyId, journalBook, docDate);

    const [entry] = await tx.insert(journalEntries).values({
      companyId,
      entryNo,
      entryDate: docDate,
      reference: docNo,
      description: descText,
      journalBook,
      contactName: customerName || null,
      createdBy: userId,
      status: "posted",
      sourceDocType,
      sourceDocId,
      currencyCode: currencyCode || "THB",
      exchangeRate: exchangeRate || "1",
    }).returning();

    const isSalesDoc = documentType === "tax_invoice" || documentType === "invoice";
    const isPurchaseDoc = documentType === "purchase" || documentType === "expense";

    const pendingLines: { accountId: number; description: string; debit: string; credit: string; accountCode: string }[] = [];

    if (params.overrideLines && params.overrideLines.length > 0) {
      for (const ol of params.overrideLines) {
        const acc = accountMap.get(ol.accountCode);
        if (!acc) continue;
        const d = parseFloat(ol.debit) || 0;
        const c = parseFloat(ol.credit) || 0;
        if (d === 0 && c === 0) continue;
        pendingLines.push({
          accountId: acc.id,
          description: acc.nameTh || acc.name || ol.accountName,
          debit: d.toFixed(2),
          credit: c.toFixed(2),
          accountCode: ol.accountCode,
        });
      }
    } else {

    for (const line of formulaLines) {
      const c = line.accountCode;
      const isCashBankLine = c.startsWith("1001") || c.startsWith("1011") || c.startsWith("1021") || c.startsWith("1041") || c.startsWith("1042");
      const isARLine = c.startsWith("120") || c.startsWith("112") || c.startsWith("123");
      const isAPLine = c.startsWith("210");
      let effectiveCode = line.accountCode;

      if (isReceipt && paymentMethodAccountCode && isCashBankLine) {
        effectiveCode = paymentMethodAccountCode;
      }

      if (isPaymentVoucher && paymentMethodAccountCode && isCashBankLine) {
        effectiveCode = paymentMethodAccountCode;
      }

      if (isSalesDoc && !isCreditPayment && isCashBankLine && paymentMethodAccountCode) {
        effectiveCode = paymentMethodAccountCode;
      }

      if (isPurchaseDoc && isCreditPayment && isCashBankLine) {
        effectiveCode = "2101000";
      } else if (isPurchaseDoc && !isCreditPayment && paymentMethodAccountCode && isCashBankLine) {
        effectiveCode = paymentMethodAccountCode;
      }

      if (isPurchaseDoc && !isCreditPayment && paymentMethodAccountCode && isAPLine) {
        effectiveCode = paymentMethodAccountCode;
      }

      const acc = accountMap.get(effectiveCode);
      if (!acc) {
        console.log(`[AutoJournal] Account ${effectiveCode} not found in company ${companyId} chart of accounts — skipping line`);
        continue;
      }

      let amount = 0;
      const code = effectiveCode;

      if (isCashBankLine || code === paymentMethodAccountCode) {
        amount = (isReceipt || isTaxInvoice || isPaymentVoucher || isPurchaseOrExpense) ? netCash : grossTotal;
      } else if (code.startsWith("120") || code.startsWith("112")) {
        amount = grossTotal;
      } else if (code.startsWith("123")) {
        amount = grossTotal;
      } else if (code.startsWith("210")) {
        amount = grossTotal;
      } else if (code.startsWith("234") || code.startsWith("143")) {
        amount = vat;
      } else if (code.startsWith("233") || code.startsWith("238")) {
        amount = sub;
      } else if (code.startsWith("4")) {
        amount = sub;
      } else if (code.startsWith("5")) {
        amount = sub;
      } else if (code.startsWith("130") || code.startsWith("140")) {
        amount = sub;
      } else {
        amount = sub;
      }

      if (amount === 0) continue;

      const debitAmt = line.direction === "debit" ? String(Math.abs(amount).toFixed(2)) : "0";
      const creditAmt = line.direction === "credit" ? String(Math.abs(amount).toFixed(2)) : "0";

      const accountDesc = acc.nameTh && acc.name
        ? `${acc.nameTh} (${acc.name})`
        : acc.nameTh || acc.name || line.accountName;

      let lineDesc = accountDesc;
      if (line.direction === "debit" && params.lineItemDescriptions && params.lineItemDescriptions.length > 0 && !params.lineItemAccounts?.length) {
        lineDesc = params.lineItemDescriptions.join(", ");
      }

      pendingLines.push({
        accountId: acc.id,
        description: lineDesc,
        debit: debitAmt,
        credit: creditAmt,
        accountCode: effectiveCode,
      });
    }

    if (isPurchaseDoc && params.lineItemAccounts && params.lineItemAccounts.length > 0) {
      const grouped = new Map<string, { accountCode: string; accountName: string; total: number; descriptions: string[] }>();
      for (const la of params.lineItemAccounts) {
        const existing = grouped.get(la.accountCode);
        if (existing) {
          existing.total += la.amount;
          if (la.description) existing.descriptions.push(la.description);
        } else {
          grouped.set(la.accountCode, { accountCode: la.accountCode, accountName: la.accountName, total: la.amount, descriptions: la.description ? [la.description] : [] });
        }
      }
      const expenseLineIdx = pendingLines.findIndex(l => l.debit !== "0" && (l.accountCode.startsWith("5") || l.accountCode.startsWith("130") || l.accountCode.startsWith("140")));
      if (expenseLineIdx >= 0) {
        const origAmount = parseFloat(pendingLines[expenseLineIdx].debit);
        const rawItemTotal = Array.from(grouped.values()).reduce((s, g) => s + Math.abs(g.total), 0);
        const scale = rawItemTotal > 0 ? origAmount / rawItemTotal : 1;

        const replacementLines: typeof pendingLines = [];
        let scaledTotal = 0;
        const groupedArr = Array.from(grouped.values());
        for (let gi = 0; gi < groupedArr.length; gi++) {
          const g = groupedArr[gi];
          const gAcc = accountMap.get(g.accountCode);
          if (gAcc) {
            let amt: number;
            if (gi === groupedArr.length - 1 && Math.abs(scale - 1) > 0.0001) {
              amt = Math.abs(origAmount - scaledTotal);
            } else {
              amt = Math.round(Math.abs(g.total) * scale * 100) / 100;
            }
            scaledTotal += amt;
            const gDesc = g.descriptions.length > 0 ? g.descriptions.join(", ") : (gAcc.nameTh && gAcc.name ? `${gAcc.nameTh} (${gAcc.name})` : gAcc.nameTh || gAcc.name || g.accountName);
            replacementLines.push({
              accountId: gAcc.id,
              description: gDesc,
              debit: amt.toFixed(2),
              credit: "0",
              accountCode: g.accountCode,
            });
          }
        }
        if (replacementLines.length > 0) {
          const codedItemsRawTotal = rawItemTotal;
          const allItemsRawTotal = sub;
          const uncodedRaw = allItemsRawTotal - codedItemsRawTotal;
          if (uncodedRaw > 0.005) {
            const uncodedScaled = Math.round(uncodedRaw * scale * 100) / 100;
            pendingLines[expenseLineIdx].debit = uncodedScaled.toFixed(2);
            pendingLines.splice(expenseLineIdx + 1, 0, ...replacementLines);
          } else {
            pendingLines.splice(expenseLineIdx, 1, ...replacementLines);
          }
        }
      }
    }
    }

    if ((isReceipt || isTaxInvoice) && wht > 0) {
      const whtAcc = accountMap.get("1307") || accountMap.get("1434000") || accountMap.get("1301000");
      if (whtAcc) {
        const whtDesc = whtAcc.nameTh
          ? `${whtAcc.nameTh}(${whtAcc.name})`
          : whtAcc.name || "ภาษีถูกหัก ณ ที่จ่าย";
        pendingLines.push({
          accountId: whtAcc.id,
          description: whtDesc,
          debit: String(wht.toFixed(2)),
          credit: "0",
          accountCode: whtAcc.code,
        });
      }
    }

    if ((isPaymentVoucher || isPurchaseDoc) && wht > 0) {
      const whtAcc = accountMap.get("2303") || accountMap.get("2381000") || accountMap.get("2331000");
      if (whtAcc) {
        const whtDesc = whtAcc.nameTh
          ? `${whtAcc.nameTh}(${whtAcc.name})`
          : whtAcc.name || "ภาษีหัก ณ ที่จ่ายค้างจ่าย";
        pendingLines.push({
          accountId: whtAcc.id,
          description: whtDesc,
          debit: "0",
          credit: String(wht.toFixed(2)),
          accountCode: whtAcc.code,
        });
      }
    }

    if (pendingLines.length === 0) {
      await tx.delete(journalEntries).where(eq(journalEntries.id, entry.id));
      return { journalEntryId: null, skipped: true, reason: "ไม่มีรายการบัญชีที่คำนวณได้ (ผังบัญชีของบริษัทอาจไม่มีรหัสบัญชีที่สูตรต้องการ)" };
    }

    const totalDebit = pendingLines.reduce((s, l) => s + parseFloat(l.debit), 0);
    const totalCredit = pendingLines.reduce((s, l) => s + parseFloat(l.credit), 0);
    const diff = Math.round((totalDebit - totalCredit) * 100) / 100;
    if (Math.abs(diff) > 0.01) {
      if (isPurchaseDoc && diff > 0) {
        const apAcc = accountMap.get("2101000") || accountMap.get("2001");
        if (apAcc) {
          pendingLines.push({
            accountId: apAcc.id,
            description: apAcc.nameTh || apAcc.name || "เจ้าหนี้การค้า",
            debit: "0",
            credit: String(diff.toFixed(2)),
            accountCode: apAcc.code,
          });
        }
      } else if (isSalesDoc && diff < 0) {
        const arAcc = accountMap.get("1201000");
        if (arAcc) {
          pendingLines.push({
            accountId: arAcc.id,
            description: arAcc.nameTh || arAcc.name || "ลูกหนี้การค้า",
            debit: String(Math.abs(diff).toFixed(2)),
            credit: "0",
            accountCode: arAcc.code,
          });
        }
      }
      console.log(`[AutoJournal] Auto-balanced: diff=${diff}, added ${isPurchaseDoc ? 'AP' : 'AR'} line`);
    }

    const finalDebit = pendingLines.reduce((s, l) => s + parseFloat(l.debit), 0);
    const finalCredit = pendingLines.reduce((s, l) => s + parseFloat(l.credit), 0);
    const finalDiff = Math.abs(Math.round((finalDebit - finalCredit) * 100) / 100);
    if (finalDiff > 0.01) {
      console.log(`[AutoJournal] SKIP: still unbalanced after auto-balance (Dr=${finalDebit}, Cr=${finalCredit})`);
      await tx.delete(journalEntries).where(eq(journalEntries.id, entry.id));
      return null;
    }

    pendingLines.sort((a, b) => {
      const aIsDebit = parseFloat(a.debit) > 0;
      const bIsDebit = parseFloat(b.debit) > 0;
      if (aIsDebit && !bIsDebit) return -1;
      if (!aIsDebit && bIsDebit) return 1;
      return a.accountCode.localeCompare(b.accountCode);
    });

    if (pendingLines.length > 0) {
      await tx.insert(journalLines).values(
        pendingLines.map(pl => ({
          journalEntryId: entry.id,
          accountId: pl.accountId,
          description: pl.description,
          debit: pl.debit,
          credit: pl.credit,
        }))
      );
    }

    return entry;
  });
  console.log(`[AutoJournal] ${docNo} total ${Math.round(performance.now() - _t0)}ms`);

  if (!result) {
    return { journalEntryId: null, skipped: true, reason: "ไม่พบบัญชีที่ตรงกับสูตร — ตรวจสอบผังบัญชีของบริษัท" };
  }

  if ('skipped' in result && (result as any).skipped) {
    return result as { journalEntryId: number | null; skipped: boolean; reason?: string };
  }

  return { journalEntryId: result.id, skipped: false };
}

const PAYMENT_METHOD_ALIASES: Record<string, string[]> = {
  cash: ["cash", "เงินสด"],
  transfer: ["transfer", "โอนเงิน", "เงินโอน", "bank transfer"],
  cheque: ["cheque", "check", "เช็ค"],
  credit_card: ["credit card", "credit_card", "บัตรเครดิต"],
  promptpay: ["promptpay", "พร้อมเพย์"],
  ewallet: ["ewallet", "e-wallet", "อีวอลเล็ท"],
};

export async function resolvePaymentMethodAccountCode(companyId: number, paymentMethodName: string | null | undefined): Promise<string | undefined> {
  if (!paymentMethodName || paymentMethodName === "เครดิต") return undefined;
  const allPm = await db.select().from(paymentMethods)
    .where(eq(paymentMethods.companyId, companyId));
  const byCode = allPm.find(p => p.accountCode === paymentMethodName);
  if (byCode) return migrateAccountCode(byCode.accountCode) || undefined;
  const exact = allPm.find(p => p.name === paymentMethodName || p.nameTh === paymentMethodName);
  if (exact) return migrateAccountCode(exact.accountCode) || undefined;

  const aliases = PAYMENT_METHOD_ALIASES[paymentMethodName.toLowerCase()] || [paymentMethodName];
  for (const alias of aliases) {
    const matched = allPm.find(p =>
      (p.name && p.name.toLowerCase() === alias.toLowerCase()) ||
      (p.nameTh && p.nameTh === alias) ||
      (p.name && p.name.toLowerCase().includes(alias.toLowerCase())) ||
      (p.nameTh && p.nameTh.includes(alias))
    );
    if (matched) return migrateAccountCode(matched.accountCode) || undefined;
  }

  const partial = allPm.find(p =>
    (p.name && p.name.toLowerCase().includes(paymentMethodName.toLowerCase())) ||
    (p.nameTh && p.nameTh.includes(paymentMethodName)) ||
    (p.name && paymentMethodName.toLowerCase().includes(p.name.toLowerCase())) ||
    (p.nameTh && paymentMethodName.includes(p.nameTh))
  );
  return migrateAccountCode(partial?.accountCode) || undefined;
}

function migrateAccountCode(code: string | null | undefined): string | undefined {
  if (!code) return undefined;
  if (code.length >= 7) return code;
  return code.length <= 4 ? code + "0".repeat(7 - code.length) : code;
}

export const PLATFORM_DOC_PREFIX: Record<string, string> = {
  shopee: "SH", lazada: "LZ", tiktok: "TT",
  grab_food: "GR", grab: "GR", "grab food": "GR",
  line_man: "LM", lineman: "LM", "line man": "LM",
  robinhood: "RH", amazon: "AZ",
};
export const PLATFORM_DISPLAY_NAME: Record<string, string> = {
  shopee: "SHOPEE", lazada: "LAZADA", tiktok: "TIKTOK",
  grab_food: "GRAB", grab: "GRAB", "grab food": "GRAB",
  line_man: "LINEMAN", lineman: "LINEMAN", "line man": "LINEMAN",
  robinhood: "ROBINHOOD", amazon: "AMAZON",
};

interface GenerateTivFromOrderParams {
  orderId: number;
  companyId: number;
  platform: string;
  orderNo: string;
  platformOrderId: string;
  buyerName: string | null;
  buyerAddress: string | null;
  totalAmount: string | null;
  trackingNo: string | null;
  shippedAt: Date | null;
  placedAt: Date | null;
  accountingMode: string;
  userId: number;
  paymentMethod?: string | null;
  vatRegistered?: boolean;
  skipJournal?: boolean;
}

export async function generateTivFromEcommerceOrder(params: GenerateTivFromOrderParams): Promise<{ taxInvoiceId: number; taxInvoiceNo: string; isExisting: boolean } | null> {
  const platformLower = String(params.platform || "").toLowerCase();
  const platformDisplay = PLATFORM_DISPLAY_NAME[platformLower] || String(params.platform || "").toUpperCase();
  const orderNo = params.orderNo || params.platformOrderId;
  const refDoc = `${platformDisplay} #${orderNo}`;

  const existingTiv = await ecomDb.select({ id: taxInvoices.id, taxInvoiceNo: taxInvoices.taxInvoiceNo }).from(taxInvoices)
    .where(and(eq(taxInvoices.companyId, params.companyId), eq(taxInvoices.refDoc, refDoc)));

  if (existingTiv.length > 0) {
    await ecomDb.update(ecommerceOrders).set({ taxInvoiceId: existingTiv[0].id }).where(eq(ecommerceOrders.id, params.orderId));
    return { taxInvoiceId: existingTiv[0].id, taxInvoiceNo: existingTiv[0].taxInvoiceNo, isExisting: true };
  }

  const items = await storage.getEcommerceOrderItems(params.orderId);
  const prefix = PLATFORM_DOC_PREFIX[platformLower] || "TIV";
  const docDate = params.placedAt
    ? new Date(params.placedAt).toISOString().split("T")[0]
    : (params.shippedAt ? new Date(params.shippedAt).toISOString().split("T")[0] : new Date().toISOString().split("T")[0]);

  const dict = await ecomDb.select().from(vatProductDictionary)
    .where(eq(vatProductDictionary.companyId, params.companyId));
  const dictMap = new Map(dict.map(d => [d.normalizedName, d.vatType]));
  for (const item of items) {
    const normalized = String((item as any).name || "").trim().toLowerCase().replace(/\s+/g, " ");
    const dictVat = dictMap.get(normalized);
    if (dictVat) {
      (item as any).vatType = dictVat;
    }
  }

  const subtotalGross = items.length > 0
    ? items.reduce((sum: number, i: any) => sum + (parseFloat(i.total) || 0), 0)
    : parseFloat(String(params.totalAmount || "0"));
  const totalItemDiscount = items.length > 0
    ? items.reduce((sum: number, i: any) => sum + (parseFloat(i.discount) || 0), 0)
    : 0;
  const subtotal = subtotalGross - totalItemDiscount;
  const isVatReg = params.vatRegistered === true;

  let vatAmount = 0;
  if (isVatReg) {
    const vat7Total = items.length > 0
      ? items.filter((i: any) => ((i as any).vatType || "vat7") === "vat7")
          .reduce((sum: number, i: any) => sum + ((parseFloat(i.total) || 0) - (parseFloat(i.discount) || 0)), 0)
      : subtotal;
    vatAmount = Math.round(vat7Total * 7 / 107 * 100) / 100;
  }
  const fnDocLabel = isVatReg ? "ใบกำกับภาษี" : "ใบเสร็จรับเงิน";

  const [alreadyLinked] = await ecomDb.select({ taxInvoiceId: ecommerceOrders.taxInvoiceId })
    .from(ecommerceOrders).where(eq(ecommerceOrders.id, params.orderId));
  if (alreadyLinked?.taxInvoiceId) return null;

  const dupeCheck = await ecomDb.select({ id: taxInvoices.id, taxInvoiceNo: taxInvoices.taxInvoiceNo }).from(taxInvoices)
    .where(and(eq(taxInvoices.companyId, params.companyId), eq(taxInvoices.refDoc, refDoc)));
  if (dupeCheck.length > 0) {
    await ecomDb.update(ecommerceOrders).set({ taxInvoiceId: dupeCheck[0].id }).where(eq(ecommerceOrders.id, params.orderId));
    return { taxInvoiceId: dupeCheck[0].id, taxInvoiceNo: dupeCheck[0].taxInvoiceNo, isExisting: true };
  }

  const taxInvoiceNo = await getNextDocNo(params.companyId, prefix, taxInvoices, taxInvoices.taxInvoiceNo, taxInvoices.companyId, docDate, undefined, ecomDb);

  const result = await ecomDb.transaction(async (tx) => {
    const [doc] = await tx.insert(taxInvoices).values({
      companyId: params.companyId,
      taxInvoiceNo,
      taxInvoiceDate: docDate,
      customerName: params.buyerName || "ลูกค้า",
      customerAddress: params.buyerAddress || null,
      subtotal: String(subtotal.toFixed(2)),
      discountAmount: "0",
      vatAmount: String(vatAmount.toFixed(2)),
      totalAmount: String(subtotal.toFixed(2)),
      status: "approved",
      priceMode: isVatReg ? "included" : "excluded",
      docPrefix: prefix,
      refDoc,
      paymentMethod: params.paymentMethod || "เครดิต",
      notes: `${fnDocLabel} - สร้างจาก ${params.platform} - ${orderNo}${params.trackingNo ? ` | เลขพัสดุ: ${params.trackingNo}` : ""}`,
      createdBy: params.userId,
    }).returning();

    if (items.length > 0) {
      for (const item of items) {
        const itemTotal = parseFloat(String((item as any).total || "0"));
        const itemDisc = parseFloat(String((item as any).discount || "0"));
        await tx.insert(taxInvoiceItems).values({
          taxInvoiceId: doc.id,
          productCode: (item as any).platformSku || null,
          productName: (item as any).name || "สินค้า",
          qty: String((item as any).qty || "1"),
          unit: "ชิ้น",
          unitPrice: String(parseFloat(String((item as any).price || "0")).toFixed(2)),
          discount: String(itemDisc.toFixed(2)),
          total: String((itemTotal - itemDisc).toFixed(2)),
          vatType: isVatReg ? ((item as any).vatType || "vat7") : "vat0",
        });
      }
    } else {
      await tx.insert(taxInvoiceItems).values({
        taxInvoiceId: doc.id,
        productName: `ออเดอร์ ${orderNo}`,
        qty: "1",
        unit: "ชิ้น",
        unitPrice: String(subtotal.toFixed(2)),
        discount: "0",
        total: String(subtotal.toFixed(2)),
        vatType: isVatReg ? "vat7" : "vat0",
      });
    }

    return doc;
  });

  await ecomDb.update(ecommerceOrders).set({ taxInvoiceId: result.id }).where(eq(ecommerceOrders.id, params.orderId));

  if (!result) return null;

  if ((result as any).isExisting) {
    return { taxInvoiceId: result.id, taxInvoiceNo: result.taxInvoiceNo, isExisting: true };
  }

  if (params.accountingMode === "full_accounting" && !params.skipJournal) {
    try {
      const pmAccCode = await resolvePaymentMethodAccountCode(result.companyId, result.paymentMethod);
      await createAutoJournalEntry({
        companyId: result.companyId,
        documentType: "tax_invoice",
        sourceDocType: "tax_invoice",
        sourceDocId: result.id,
        docDate: result.taxInvoiceDate,
        docNo: result.taxInvoiceNo,
        subtotal: (parseFloat(result.totalAmount) - parseFloat(result.vatAmount)).toFixed(2),
        vatAmount: String(result.vatAmount),
        totalAmount: String(result.totalAmount),
        withholdingTax: "0",
        currencyCode: "THB",
        exchangeRate: "1",
        userId: params.userId,
        customerName: result.customerName,
        paymentMethod: result.paymentMethod || undefined,
        paymentMethodAccountCode: pmAccCode,
      });
    } catch (e) {}
  }

  return { taxInvoiceId: result.id, taxInvoiceNo: result.taxInvoiceNo, isExisting: false };
}

export async function logActivity(params: {
  companyId: number;
  tenantId?: number;
  userId?: number;
  userName?: string;
  action: string;
  entityType: string;
  entityId?: string;
  entityName?: string;
  details?: string;
  ipAddress?: string;
}) {
  await db.insert(activityLogs).values(params);
}

export async function checkDocumentLimit(req: any, res: any): Promise<boolean> {
  const currentUser = req.user as any;
  if (currentUser?.tenantId) {
    try {
      const limitCheck = await storage.checkTenantLimit(currentUser.tenantId, "documents");
      if (!limitCheck.allowed) {
        res.status(403).json({ message: `แพ็คเกจ ${limitCheck.planName} รองรับเอกสารสูงสุด ${limitCheck.limit} รายการ/เดือน (ใช้แล้ว ${limitCheck.current}) กรุณาอัพเกรดแพ็คเกจ` });
        return false;
      }
    } catch (err: any) {
      console.error("[checkDocumentLimit] Subscription check failed, allowing operation:", err?.message || err);
    }
  }
  return true;
}

export async function deleteJournalEntriesForDoc(tx: any, sourceDocType: string, sourceDocId: number) {
  const entries = await tx.select({ id: journalEntries.id })
    .from(journalEntries)
    .where(and(
      eq(journalEntries.sourceDocType, sourceDocType),
      eq(journalEntries.sourceDocId, sourceDocId),
    ));
  if (entries.length === 0) return;
  const entryIds = entries.map((e: any) => e.id);
  const idsList = entryIds.join(",");
  try { await tx.execute(sql.raw(`UPDATE bank_statements SET matched_journal_id = NULL WHERE matched_journal_id IN (${idsList})`)); } catch {}
  try { await tx.execute(sql.raw(`UPDATE manufacturing_orders SET journal_entry_id = NULL WHERE journal_entry_id IN (${idsList})`)); } catch {}
  try { await tx.execute(sql.raw(`UPDATE payroll_records SET journal_entry_id = NULL WHERE journal_entry_id IN (${idsList})`)); } catch {}
  try { await tx.execute(sql.raw(`UPDATE petty_cash_transactions SET journal_entry_id = NULL WHERE journal_entry_id IN (${idsList})`)); } catch {}
  try { await tx.execute(sql.raw(`UPDATE petty_cash_funds SET journal_entry_id = NULL WHERE journal_entry_id IN (${idsList})`)); } catch {}
  try { await tx.execute(sql.raw(`UPDATE live_cf_orders SET journal_entry_id = NULL WHERE journal_entry_id IN (${idsList})`)); } catch {}
  try { await tx.execute(sql.raw(`UPDATE closed_periods SET journal_entry_id = NULL WHERE journal_entry_id IN (${idsList})`)); } catch {}
  try { await tx.execute(sql.raw(`UPDATE fixed_assets SET journal_entry_id = NULL WHERE journal_entry_id IN (${idsList})`)); } catch {}
  try { await tx.execute(sql.raw(`UPDATE pos_sessions SET close_journal_id = NULL WHERE close_journal_id IN (${idsList})`)); } catch {}
  try { await tx.execute(sql.raw(`UPDATE restaurant_pos_sessions SET close_journal_id = NULL WHERE close_journal_id IN (${idsList})`)); } catch {}
  try { await ecomDb.execute(sql.raw(`UPDATE ecommerce_orders SET journal_entry_id = NULL WHERE journal_entry_id IN (${idsList})`)); } catch {}
  try { await ecomDb.execute(sql.raw(`UPDATE ecommerce_settlements SET settle_journal_id = NULL WHERE settle_journal_id IN (${idsList})`)); } catch {}
  try { await ecomDb.execute(sql.raw(`UPDATE ecommerce_settlements SET withdraw_journal_id = NULL WHERE withdraw_journal_id IN (${idsList})`)); } catch {}
  try { await ecomDb.execute(sql.raw(`UPDATE ecommerce_settlements SET reversal_journal_id = NULL WHERE reversal_journal_id IN (${idsList})`)); } catch {}
  await tx.delete(journalLines).where(inArray(journalLines.journalEntryId, entryIds));
  await tx.delete(journalEntries).where(inArray(journalEntries.id, entryIds));
}

export async function deleteStockMovementsForDoc(tx: any, referenceType: string, referenceId: number) {
  const movements = await tx.select({
    id: stockMovements.id,
    productId: stockMovements.productId,
    companyId: stockMovements.companyId,
  }).from(stockMovements).where(
    and(
      eq(stockMovements.referenceType, referenceType),
      eq(stockMovements.referenceId, referenceId)
    )
  );

  if (movements.length === 0) return;

  const movementIds = movements.map((m: any) => m.id);

  const bundleDerived = await tx.select({
    id: stockMovements.id,
    productId: stockMovements.productId,
    companyId: stockMovements.companyId,
  }).from(stockMovements)
    .where(and(
      inArray(stockMovements.referenceId, movementIds),
      sql`${stockMovements.movementType} IN ('bundle_deduct', 'bundle_offset', 'bom_consume', 'mapping_convert')`
    ));
  if (bundleDerived.length > 0) {
    const derivedIds = bundleDerived.map((d: any) => d.id);
    for (let i = 0; i < derivedIds.length; i += 500) {
      const batch = derivedIds.slice(i, i + 500);
      await tx.delete(stockMovements).where(inArray(stockMovements.id, batch));
    }
    const derivedProducts = [...new Map(bundleDerived.map((d: any) => [d.productId + '_' + d.companyId, d])).values()] as any[];
    for (const { productId: dpid, companyId: dcid } of derivedProducts) {
      const [{ totalQty: dTotalQty }] = await tx.select({
        totalQty: sql<string>`COALESCE(SUM(CAST(${stockMovements.quantity} AS numeric)), 0)`,
      }).from(stockMovements).where(
        and(eq(stockMovements.productId, dpid), eq(stockMovements.companyId, dcid))
      );
      const [dExisting] = await tx.select().from(productStock).where(
        and(eq(productStock.productId, dpid), eq(productStock.companyId, dcid))
      );
      if (dExisting) {
        await tx.update(productStock).set({ quantity: dTotalQty }).where(
          and(eq(productStock.productId, dpid), eq(productStock.companyId, dcid))
        );
      }
    }
  }

  await tx.delete(stockMovements).where(
    and(
      eq(stockMovements.referenceType, referenceType),
      eq(stockMovements.referenceId, referenceId)
    )
  );

  const affectedProducts = [...new Map(movements.map((m: any) => [m.productId + '_' + m.companyId, m])).values()] as any[];

  for (const { productId: pid, companyId: cid } of affectedProducts) {
    const [{ totalQty }] = await tx.select({
      totalQty: sql<string>`COALESCE(SUM(CAST(${stockMovements.quantity} AS numeric)), 0)`,
    }).from(stockMovements).where(
      and(
        eq(stockMovements.productId, pid),
        eq(stockMovements.companyId, cid)
      )
    );

    const [existingStock] = await tx.select().from(productStock).where(
      and(eq(productStock.productId, pid), eq(productStock.companyId, cid))
    );

    if (existingStock) {
      await tx.update(productStock).set({ quantity: totalQty }).where(
        and(eq(productStock.productId, pid), eq(productStock.companyId, cid))
      );
    }
  }
}

export async function recomputePaymentStatus(docType: "taxInvoice" | "invoice", docId: number) {
  const table = docType === "taxInvoice" ? taxInvoices : invoices;
  const linkCol = docType === "taxInvoice" ? receipts.taxInvoiceId : receipts.invoiceId;
  const rldDocType = docType === "taxInvoice" ? "TIV" : "IV";
  const [doc] = await db.select().from(table).where(eq(table.id, docId));
  if (!doc) return;
  const docTotal = parseFloat((doc as any).totalAmount || "0");
  const linkedReceipts = await db.select().from(receipts).where(eq(linkCol, docId));
  const directSum = linkedReceipts.reduce((sum: number, r: any) => sum + parseFloat(r.totalAmount || "0"), 0);
  const linkedDocs = await db.select().from(receiptLinkedDocs).where(and(eq(receiptLinkedDocs.docType, rldDocType), eq(receiptLinkedDocs.docId, docId)));
  const batchSum = linkedDocs.reduce((sum: number, ld: any) => sum + parseFloat(ld.amount || "0"), 0);
  const totalPaid = directSum + batchSum;
  let status: "unpaid" | "partial" | "paid" = "unpaid";
  if (totalPaid > 0 && totalPaid < docTotal - 0.01) status = "partial";
  else if (totalPaid >= docTotal - 0.01 && totalPaid > 0) status = "paid";
  await db.update(table).set({ paymentStatus: status }).where(eq(table.id, docId));
}

export async function recomputeAPPaymentStatus(docType: "purchaseInvoice" | "expense", docId: number) {
  const table = docType === "purchaseInvoice" ? purchaseInvoices : expenses;
  const pvDocType = docType === "purchaseInvoice" ? "AP" : "EXP";
  const [doc] = await db.select().from(table).where(eq(table.id, docId));
  if (!doc) return;
  const docTotal = parseFloat((doc as any).totalAmount || "0");
  const linkedDocs = await db.select().from(paymentVoucherLinkedDocs).where(and(eq(paymentVoucherLinkedDocs.docType, pvDocType), eq(paymentVoucherLinkedDocs.docId, docId)));
  const totalPaid = linkedDocs.reduce((sum: number, ld: any) => sum + parseFloat(ld.amount || "0"), 0);
  let status: "unpaid" | "partial" | "paid" = "unpaid";
  if (totalPaid > 0 && totalPaid < docTotal - 0.01) status = "partial";
  else if (totalPaid >= docTotal - 0.01 && totalPaid > 0) status = "paid";
  await db.update(table).set({ paymentStatus: status }).where(eq(table.id, docId));
}

export async function deleteCompaniesCascade(companyIds: number[]): Promise<{ deleted: number; errors: string[] }> {
  if (companyIds.length === 0) return { deleted: 0, errors: [] };
  const errors: string[] = [];
  const idList = companyIds.join(",");

  const fkResult = await db.execute(sql`
    SELECT tc.constraint_name, tc.table_name, kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
    WHERE ccu.table_name = 'companies' AND ccu.column_name = 'id' AND tc.constraint_type = 'FOREIGN KEY'
    ORDER BY tc.table_name
  `);
  const fkRows = (fkResult as any).rows || fkResult || [];

  console.log(`[deleteCompaniesCascade] Temporarily setting ${fkRows.length} FK constraints to CASCADE for ${companyIds.length} companies`);

  const alteredConstraints: { constraintName: string; tableName: string }[] = [];
  for (const fk of fkRows) {
    try {
      await db.execute(sql.raw(`ALTER TABLE "${fk.table_name}" DROP CONSTRAINT "${fk.constraint_name}"`));
      await db.execute(sql.raw(`ALTER TABLE "${fk.table_name}" ADD CONSTRAINT "${fk.constraint_name}" FOREIGN KEY ("${fk.column_name}") REFERENCES companies(id) ON DELETE CASCADE`));
      alteredConstraints.push({ constraintName: fk.constraint_name, tableName: fk.table_name });
    } catch (err: any) {
      errors.push(`ALTER FK ${fk.constraint_name}: ${err.message}`);
    }
  }

  let deleted = 0;
  try {
    const result = await db.execute(sql.raw(`DELETE FROM companies WHERE id IN (${idList})`));
    deleted = (result as any).rowCount || companyIds.length;
    console.log(`[deleteCompaniesCascade] Deleted ${deleted} companies with CASCADE`);
  } catch (err: any) {
    errors.push(`DELETE companies: ${err.message}`);
    console.error(`[deleteCompaniesCascade] DELETE failed:`, err.message);
  }

  for (const ac of alteredConstraints) {
    try {
      await db.execute(sql.raw(`ALTER TABLE "${ac.tableName}" DROP CONSTRAINT "${ac.constraintName}"`));
      await db.execute(sql.raw(`ALTER TABLE "${ac.tableName}" ADD CONSTRAINT "${ac.constraintName}" FOREIGN KEY ("company_id") REFERENCES companies(id) ON DELETE NO ACTION`));
    } catch (err: any) {
      errors.push(`RESTORE FK ${ac.constraintName}: ${err.message}`);
    }
  }

  console.log(`[deleteCompaniesCascade] Restored ${alteredConstraints.length} FK constraints to NO ACTION`);
  return { deleted, errors };
}
