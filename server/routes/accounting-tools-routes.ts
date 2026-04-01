import type { Express, Request, Response } from "express";
import { db } from "../db";
import { eq, desc, and, count , sql } from "drizzle-orm";
import { companies, accounts, journalEntries, journalLines, invoices, taxInvoices, receipts, purchaseInvoices, expenses, quotations, salesOrders, depositReceipts, salesCreditNotes, purchaseDebitNotes, paymentVouchers, closedPeriods, accountingMgmtLogs, posTransactions, fixedAssets } from "@shared/schema";
import { requireAuth, requireModule } from "../route-middleware";
import { invalidateCompanyReports } from "./report-cache";

export function registerAccountingToolsRoutes(app: Express) {
// ============ Accounting Management Tools ============

// 1. Balance Carry Forward - Preview
app.get("/api/accounting-mgmt/balance-carry-forward/preview", requireAuth, requireModule("accounting"), async (req, res) => {
  try {
    const companyId = Number(req.query.companyId);
    const fromYear = Number(req.query.fromYear);
    if (!companyId || !fromYear) return res.status(400).json({ message: "companyId, fromYear required" });
    const user = req.user as any;
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
    if (company && company.tenantId && company.tenantId !== user.tenantId) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });
    const endDate = `${fromYear}-12-31`;
    const allAccounts = await db.select().from(accounts).where(eq(accounts.companyId, companyId));
    const entries = await db.select({ id: journalEntries.id }).from(journalEntries)
      .where(and(eq(journalEntries.companyId, companyId), sql`${journalEntries.entryDate} <= ${endDate}`));
    const entryIds = entries.map(e => e.id);
    let lines: any[] = [];
    if (entryIds.length > 0) {
      lines = await db.select().from(journalLines)
        .where(sql`${journalLines.journalEntryId} IN (${sql.join(entryIds.map(id => sql`${id}`), sql`, `)})`);
    }
    const balances: any[] = [];
    for (const acc of allAccounts) {
      if (!acc.active || acc.isHeader) continue;
      const accLines = lines.filter(l => l.accountId === acc.id);
      const totalDebit = accLines.reduce((s: number, l: any) => s + parseFloat(l.debit || "0"), 0);
      const totalCredit = accLines.reduce((s: number, l: any) => s + parseFloat(l.credit || "0"), 0);
      const balance = totalDebit - totalCredit;
      if (Math.abs(balance) >= 0.01) {
        const isBS = ["1", "2", "3"].includes(acc.code.charAt(0));
        if (isBS) {
          balances.push({
            accountId: acc.id, code: acc.code, name: acc.nameTh || acc.name, type: acc.type,
            debit: balance > 0 ? Math.round(balance * 100) / 100 : 0,
            credit: balance < 0 ? Math.round(Math.abs(balance) * 100) / 100 : 0,
            balance: Math.round(balance * 100) / 100,
          });
        }
      }
    }
    balances.sort((a, b) => a.code.localeCompare(b.code));
    res.json({ fromYear, toYear: fromYear + 1, balances, totalAccounts: balances.length });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// 1. Balance Carry Forward - Execute
app.post("/api/accounting-mgmt/balance-carry-forward/execute", requireAuth, requireModule("accounting"), async (req, res) => {
  try {
    const { companyId, fromYear, balances } = req.body;
    if (!companyId || !fromYear || !balances?.length) return res.status(400).json({ message: "companyId, fromYear, balances required" });
    const user = req.user as any;
    // record at end of fromYear
    const entryDate = `${fromYear}-12-31`;
    const refNo = `CF-${fromYear}`;
    const existing = await db.select().from(journalEntries)
      .where(and(eq(journalEntries.companyId, companyId), eq(journalEntries.reference, refNo), eq(journalEntries.sourceDocType, "carry_forward")));
    if (existing.length > 0) return res.status(400).json({ message: `ยกยอดปี ${fromYear+543} แล้ว` });
    const [entry] = await db.insert(journalEntries).values({
      companyId, entryNo: refNo, entryDate, reference: refNo,
      description: `ยกยอดงบทดลอง ณ 31/12/${fromYear+543}`,
      journalBook: "general", createdBy: user.id, status: "approved", sourceDocType: "carry_forward",
    }).returning();
    for (const b of balances) {
      await db.insert(journalLines).values({
        journalEntryId: entry.id, accountId: b.accountId,
        description: `ยกยอด ${b.code} ${b.name}`,
        debit: String(b.debit || 0), credit: String(b.credit || 0),
      });
    }
    await db.insert(accountingMgmtLogs).values({
      companyId, toolName: "balance_carry_forward",
      params: JSON.stringify({ fromYear, toYear }),
      result: `สร้างรายการยกยอด ${balances.length} บัญชี`,
      affectedCount: balances.length, runBy: user.id,
    });
    res.json({ success: true, journalEntryId: entry.id, message: `ยกยอดสำเร็จ ${balances.length} บัญชี` });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// 2. TRIM DATA - Preview
app.get("/api/accounting-mgmt/trim-data/preview", requireAuth, requireModule("accounting"), async (req, res) => {
  try {
    const companyId = Number(req.query.companyId);
    const beforeDate = req.query.beforeDate as string;
    if (!companyId || !beforeDate) return res.status(400).json({ message: "companyId, beforeDate required" });
    const user = req.user as any;
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
    if (company && company.tenantId && company.tenantId !== user.tenantId) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });
    const entries = await db.select({ id: journalEntries.id, entryDate: journalEntries.entryDate, reference: journalEntries.reference })
      .from(journalEntries)
      .where(and(eq(journalEntries.companyId, companyId), sql`${journalEntries.entryDate} < ${beforeDate}`));
    let lineCount = 0;
    if (entries.length > 0) {
      const result = await db.select({ count: sql<number>`count(*)` }).from(journalLines)
        .where(sql`${journalLines.journalEntryId} IN (${sql.join(entries.map(e => sql`${e.id}`), sql`, `)})`);
      lineCount = Number(result[0]?.count || 0);
    }
    res.json({ entryCount: entries.length, lineCount, beforeDate });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// 2. TRIM DATA - Execute
app.post("/api/accounting-mgmt/trim-data/execute", requireAuth, requireModule("accounting"), async (req, res) => {
  try {
    const { companyId, beforeDate } = req.body;
    if (!companyId || !beforeDate) return res.status(400).json({ message: "companyId, beforeDate required" });
    const user = req.user as any;
    const entries = await db.select({ id: journalEntries.id }).from(journalEntries)
      .where(and(eq(journalEntries.companyId, companyId), sql`${journalEntries.entryDate} < ${beforeDate}`));
    if (entries.length > 0) {
      const entryIds = entries.map(e => e.id);
      await db.delete(journalLines)
        .where(sql`${journalLines.journalEntryId} IN (${sql.join(entryIds.map(id => sql`${id}`), sql`, `)})`);
      await db.delete(journalEntries)
        .where(and(eq(journalEntries.companyId, companyId), sql`${journalEntries.entryDate} < ${beforeDate}`));
    }
    await db.insert(accountingMgmtLogs).values({
      companyId, toolName: "trim_data",
      params: JSON.stringify({ beforeDate }),
      result: `ลบรายการบัญชี ${entries.length} รายการ`,
      affectedCount: entries.length, runBy: user.id,
    });
    res.json({ success: true, deletedEntries: entries.length, message: `ลบข้อมูลก่อน ${beforeDate} สำเร็จ ${entries.length} รายการ` });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// 3. Journal Validation
app.get("/api/accounting-mgmt/journal-validation", requireAuth, requireModule("accounting"), async (req, res) => {
  try {
    const companyId = Number(req.query.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId required" });
    const user = req.user as any;
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
    if (company && company.tenantId && company.tenantId !== user.tenantId) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });
    const allEntries = await db.select().from(journalEntries).where(eq(journalEntries.companyId, companyId));
    let allLines: any[] = [];
    if (allEntries.length > 0) {
      allLines = await db.select().from(journalLines)
        .where(sql`${journalLines.journalEntryId} IN (${sql.join(allEntries.map(e => sql`${e.id}`), sql`, `)})`);
    }
    const issues: any[] = [];
    for (const entry of allEntries) {
      const entryLines = allLines.filter(l => l.journalEntryId === entry.id);
      if (entryLines.length === 0) {
        issues.push({ type: "no_lines", entryId: entry.id, entryNo: entry.entryNo || "", entryDate: entry.entryDate, description: entry.description || "", detail: "ไม่มีรายการบัญชี" });
        continue;
      }
      const totalDebit = entryLines.reduce((s: number, l: any) => s + parseFloat(l.debit || "0"), 0);
      const totalCredit = entryLines.reduce((s: number, l: any) => s + parseFloat(l.credit || "0"), 0);
      const diff = Math.abs(totalDebit - totalCredit);
      if (diff >= 0.01) {
        issues.push({ type: "unbalanced", entryId: entry.id, entryNo: entry.entryNo || "", entryDate: entry.entryDate, description: entry.description || "", detail: `Dr=${totalDebit.toFixed(2)} Cr=${totalCredit.toFixed(2)} ต่าง=${diff.toFixed(2)}` });
      }
      if (!entry.reference && !entry.sourceDocType) {
        issues.push({ type: "no_reference", entryId: entry.id, entryNo: entry.entryNo || "", entryDate: entry.entryDate, description: entry.description || "", detail: "ไม่มีเอกสารอ้างอิง" });
      }
    }
    await db.insert(accountingMgmtLogs).values({
      companyId, toolName: "journal_validation",
      params: JSON.stringify({ totalEntries: allEntries.length }),
      result: `พบปัญหา ${issues.length} รายการ`,
      affectedCount: issues.length, runBy: user.id,
    });
    res.json({ totalEntries: allEntries.length, issueCount: issues.length, issues });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.get("/api/accounting-mgmt/orphan-journal/preview", requireAuth, requireModule("accounting"), async (req, res) => {
  try {
    const companyId = Number(req.query.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId required" });
    const user = req.user as any;
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
    if (!company) return res.status(404).json({ message: "ไม่พบบริษัท" });
    if (company.tenantId && company.tenantId !== user.tenantId) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });

    const entries = await db.select().from(journalEntries)
      .where(and(
        eq(journalEntries.companyId, companyId),
        sql`${journalEntries.sourceDocType} IS NOT NULL AND ${journalEntries.sourceDocType} != ''`,
        sql`${journalEntries.sourceDocId} IS NOT NULL`
      ));

    const docTypeTableMap: Record<string, { table: any; idCol: any }> = {
      invoice: { table: invoices, idCol: invoices.id },
      tax_invoice: { table: taxInvoices, idCol: taxInvoices.id },
      receipt: { table: receipts, idCol: receipts.id },
      purchase_invoice: { table: purchaseInvoices, idCol: purchaseInvoices.id },
      expense: { table: expenses, idCol: expenses.id },
      quotation: { table: quotations, idCol: quotations.id },
      sales_order: { table: salesOrders, idCol: salesOrders.id },
      purchase_order: { table: purchaseOrders, idCol: purchaseOrders.id },
      deposit_receipt: { table: depositReceipts, idCol: depositReceipts.id },
      sales_credit_note: { table: salesCreditNotes, idCol: salesCreditNotes.id },
      purchase_debit_note: { table: purchaseDebitNotes, idCol: purchaseDebitNotes.id },
      payment_voucher: { table: paymentVouchers, idCol: paymentVouchers.id },
      pos_transaction: { table: posTransactions, idCol: posTransactions.id },
      fixed_asset: { table: fixedAssets, idCol: fixedAssets.id },
    };

    const orphans: any[] = [];
    const grouped = new Map<string, typeof entries>();
    for (const e of entries) {
      const key = e.sourceDocType || "";
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(e);
    }

    for (const [docType, group] of grouped) {
      const mapping = docTypeTableMap[docType];
      if (!mapping) {
        continue;
      }
      const docIds = [...new Set(group.map(e => e.sourceDocId!))];
      const existingDocs = await db.select({ id: mapping.idCol }).from(mapping.table)
        .where(sql`${mapping.idCol} IN (${sql.join(docIds.map(id => sql`${id}`), sql`, `)})`);
      const existingIds = new Set(existingDocs.map(d => d.id));
      for (const entry of group) {
        if (!existingIds.has(entry.sourceDocId!)) {
          const entryLines = await db.select().from(journalLines).where(eq(journalLines.journalEntryId, entry.id));
          const totalDebit = entryLines.reduce((s, l) => s + parseFloat(l.debit || "0"), 0);
          const totalCredit = entryLines.reduce((s, l) => s + parseFloat(l.credit || "0"), 0);
          orphans.push({
            id: entry.id, entryNo: entry.entryNo || "", entryDate: entry.entryDate,
            description: entry.description || "", reference: entry.reference || "",
            sourceDocType: docType, sourceDocId: entry.sourceDocId,
            totalDebit: totalDebit.toFixed(2), totalCredit: totalCredit.toFixed(2),
            lineCount: entryLines.length,
          });
        }
      }
    }

    await db.insert(accountingMgmtLogs).values({
      companyId, toolName: "orphan_journal_preview",
      params: JSON.stringify({ totalChecked: entries.length }),
      result: `พบ ${orphans.length} รายการที่เอกสารต้นทางถูกลบ`,
      affectedCount: orphans.length, runBy: user.id,
    });

    res.json({ totalChecked: entries.length, orphanCount: orphans.length, orphans });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post("/api/accounting-mgmt/orphan-journal/delete", requireAuth, requireModule("accounting"), async (req, res) => {
  try {
    const { companyId, entryIds } = req.body;
    if (!companyId || !entryIds || !Array.isArray(entryIds) || entryIds.length === 0)
      return res.status(400).json({ message: "กรุณาระบุ companyId และ entryIds" });
    const user = req.user as any;
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
    if (!company) return res.status(404).json({ message: "ไม่พบบริษัท" });
    if (company.tenantId && company.tenantId !== user.tenantId) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });

    const docTypeTableMap: Record<string, { table: any; idCol: any }> = {
      invoice: { table: invoices, idCol: invoices.id },
      tax_invoice: { table: taxInvoices, idCol: taxInvoices.id },
      receipt: { table: receipts, idCol: receipts.id },
      purchase_invoice: { table: purchaseInvoices, idCol: purchaseInvoices.id },
      expense: { table: expenses, idCol: expenses.id },
      quotation: { table: quotations, idCol: quotations.id },
      sales_order: { table: salesOrders, idCol: salesOrders.id },
      purchase_order: { table: purchaseOrders, idCol: purchaseOrders.id },
      deposit_receipt: { table: depositReceipts, idCol: depositReceipts.id },
      sales_credit_note: { table: salesCreditNotes, idCol: salesCreditNotes.id },
      purchase_debit_note: { table: purchaseDebitNotes, idCol: purchaseDebitNotes.id },
      payment_voucher: { table: paymentVouchers, idCol: paymentVouchers.id },
      pos_transaction: { table: posTransactions, idCol: posTransactions.id },
      fixed_asset: { table: fixedAssets, idCol: fixedAssets.id },
    };

    let deletedCount = 0;
    let skippedCount = 0;
    await db.transaction(async (tx) => {
      for (const entryId of entryIds) {
        const [entry] = await tx.select().from(journalEntries).where(and(eq(journalEntries.id, entryId), eq(journalEntries.companyId, companyId)));
        if (!entry) continue;
        if (!entry.sourceDocType || !entry.sourceDocId) { skippedCount++; continue; }
        const mapping = docTypeTableMap[entry.sourceDocType];
        if (!mapping) { skippedCount++; continue; }
        const [existingDoc] = await tx.select({ id: mapping.idCol }).from(mapping.table).where(eq(mapping.idCol, entry.sourceDocId));
        if (existingDoc) { skippedCount++; continue; }
        if (entry.sourceDocType === "payroll") {
          await tx.update(payrollRecords)
            .set({ status: "approved", journalEntryId: null })
            .where(eq(payrollRecords.journalEntryId, entryId));
        }
        if (entry.sourceDocType === "depreciation") {
          await tx.update(assetDepreciations)
            .set({ posted: false, journalEntryId: null })
            .where(eq(assetDepreciations.journalEntryId, entryId));
        }
        await tx.delete(journalLines).where(eq(journalLines.journalEntryId, entryId));
        await tx.delete(journalEntries).where(eq(journalEntries.id, entryId));
        deletedCount++;
      }
    });

    invalidateCompanyReports(companyId);

    await db.insert(accountingMgmtLogs).values({
      companyId, toolName: "orphan_journal_delete",
      params: JSON.stringify({ entryIds }),
      result: `ลบ ${deletedCount} รายการสำเร็จ`,
      affectedCount: deletedCount, runBy: user.id,
    });

    res.json({ message: `ลบรายการบัญชีกำพร้า ${deletedCount} รายการสำเร็จ`, deletedCount });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// 4. Duplicate Detection
app.get("/api/accounting-mgmt/duplicate-detection", requireAuth, requireModule("accounting"), async (req, res) => {
  try {
    const companyId = Number(req.query.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId required" });
    const user = req.user as any;
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
    if (company && company.tenantId && company.tenantId !== user.tenantId) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });
    const allEntries = await db.select().from(journalEntries).where(eq(journalEntries.companyId, companyId));
    const groupMap = new Map<string, any[]>();
    for (const entry of allEntries) {
      const key = `${entry.entryDate}|${entry.reference || ""}|${entry.description || ""}`;
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(entry);
    }
    const duplicateGroups: any[] = [];
    for (const [key, entries] of groupMap) {
      if (entries.length > 1) {
        duplicateGroups.push({
          key, count: entries.length,
          entries: entries.map((e: any) => ({ id: e.id, entryNo: e.entryNo, entryDate: e.entryDate, reference: e.reference, description: e.description })),
        });
      }
    }
    await db.insert(accountingMgmtLogs).values({
      companyId, toolName: "duplicate_detection",
      params: JSON.stringify({ totalEntries: allEntries.length }),
      result: `พบ ${duplicateGroups.length} กลุ่มที่อาจซ้ำ`,
      affectedCount: duplicateGroups.reduce((s: number, g: any) => s + g.count, 0), runBy: user.id,
    });
    res.json({ totalEntries: allEntries.length, duplicateGroupCount: duplicateGroups.length, duplicateGroups });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// 6. Period Closing - Preview
app.get("/api/accounting-mgmt/period-closing/preview", requireAuth, requireModule("accounting"), async (req, res) => {
  try {
    const companyId = Number(req.query.companyId);
    const year = Number(req.query.year);
    const month = req.query.month ? Number(req.query.month) : undefined;
    if (!companyId || !year) return res.status(400).json({ message: "companyId, year required" });
    const user = req.user as any;
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
    if (company && company.tenantId && company.tenantId !== user.tenantId) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });
    const startDate = month ? `${year}-${String(month).padStart(2, "0")}-01` : `${year}-01-01`;
    const endDate = month ? `${year}-${String(month).padStart(2, "0")}-${new Date(year, month, 0).getDate()}` : `${year}-12-31`;
    const allAccounts = await db.select().from(accounts).where(eq(accounts.companyId, companyId));
    const entries = await db.select({ id: journalEntries.id }).from(journalEntries)
      .where(and(eq(journalEntries.companyId, companyId), sql`${journalEntries.entryDate} >= ${startDate}`, sql`${journalEntries.entryDate} <= ${endDate}`));
    let lines: any[] = [];
    if (entries.length > 0) {
      lines = await db.select().from(journalLines)
        .where(sql`${journalLines.journalEntryId} IN (${sql.join(entries.map(e => sql`${e.id}`), sql`, `)})`);
    }
    const incomeExpenseItems: any[] = [];
    let totalIncome = 0, totalExpense = 0;
    for (const acc of allAccounts) {
      if (!acc.active || acc.isHeader) continue;
      if (!["4", "5"].includes(acc.code.charAt(0))) continue;
      const accLines = lines.filter(l => l.accountId === acc.id);
      const totalDebit = accLines.reduce((s: number, l: any) => s + parseFloat(l.debit || "0"), 0);
      const totalCredit = accLines.reduce((s: number, l: any) => s + parseFloat(l.credit || "0"), 0);
      const balance = totalDebit - totalCredit;
      if (Math.abs(balance) >= 0.01) {
        incomeExpenseItems.push({ accountId: acc.id, code: acc.code, name: acc.nameTh || acc.name, type: acc.type, balance: Math.round(balance * 100) / 100 });
        if (acc.code.charAt(0) === "4") totalIncome += (totalCredit - totalDebit);
        if (acc.code.charAt(0) === "5") totalExpense += (totalDebit - totalCredit);
      }
    }
    const netIncome = Math.round((totalIncome - totalExpense) * 100) / 100;
    const retainedEarningsAcc = allAccounts.find(a => a.code === "3032000" || a.code === "3031000" || a.code === "3102" || a.code === "3101");
    const existingClosing = await db.select().from(closedPeriods)
      .where(and(eq(closedPeriods.companyId, companyId), eq(closedPeriods.year, year),
        month ? eq(closedPeriods.month, month) : sql`${closedPeriods.month} IS NULL`,
        sql`${closedPeriods.periodType} IN ('monthly', 'yearly')`));
    res.json({
      year, month, startDate, endDate,
      incomeExpenseItems: incomeExpenseItems.sort((a, b) => a.code.localeCompare(b.code)),
      totalIncome: Math.round(totalIncome * 100) / 100, totalExpense: Math.round(totalExpense * 100) / 100, netIncome,
      retainedEarningsAccount: retainedEarningsAcc ? { id: retainedEarningsAcc.id, code: retainedEarningsAcc.code, name: retainedEarningsAcc.nameTh || retainedEarningsAcc.name } : null,
      alreadyClosed: existingClosing.length > 0,
    });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});


  // 5.5 Period Closing - Checklist
  app.get("/api/accounting-mgmt/period-closing/checklist", requireAuth, requireModule("accounting"), async (req, res) => {
    try {
      const companyId = Number(req.query.companyId);
      const year = Number(req.query.year);
      const month = Number(req.query.month);
      if (!companyId || !year || !month) return res.status(400).json({ message: "companyId, year, month required" });
      const user = req.user as any;
      const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
      if (company && company.tenantId && company.tenantId !== user.tenantId) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });

      const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${year}-${String(month).padStart(2, "0")}-${lastDay}`;

      const checks: { key: string; label: string; passed: boolean; detail: string }[] = [];

      const allAccounts = await db.select().from(accounts).where(eq(accounts.companyId, companyId));
      const monthEntries = await db.select({ id: journalEntries.id }).from(journalEntries)
        .where(and(eq(journalEntries.companyId, companyId), sql`${journalEntries.entryDate} >= ${startDate}`, sql`${journalEntries.entryDate} <= ${endDate}`));

      let lines: any[] = [];
      if (monthEntries.length > 0) {
        lines = await db.select().from(journalLines)
          .where(sql`${journalLines.journalEntryId} IN (${sql.join(monthEntries.map(e => sql`${e.id}`), sql`, `)})`);
      }
      const totalDebit = lines.reduce((s: number, l: any) => s + parseFloat(l.debit || "0"), 0);
      const totalCredit = lines.reduce((s: number, l: any) => s + parseFloat(l.credit || "0"), 0);
      const trialDiff = Math.abs(totalDebit - totalCredit);
      checks.push({
        key: "trial_balance",
        label: "งบทดลองสมดุล (เดบิต = เครดิต)",
        passed: trialDiff < 0.01,
        detail: trialDiff < 0.01 ? `สมดุล — Dr ${totalDebit.toLocaleString("th-TH", {minimumFractionDigits:2})} = Cr ${totalCredit.toLocaleString("th-TH", {minimumFractionDigits:2})}` : `ไม่สมดุล — ผลต่าง ${trialDiff.toLocaleString("th-TH", {minimumFractionDigits:2})} บาท`,
      });

      const draftInvoices = await db.select({ cnt: sql<string>`COUNT(*)` }).from(taxInvoices)
        .where(and(eq(taxInvoices.companyId, companyId), eq(taxInvoices.status, "draft"),
          sql`${taxInvoices.taxInvoiceDate} >= ${startDate}`, sql`${taxInvoices.taxInvoiceDate} <= ${endDate}`));
      const draftCount = Number(draftInvoices[0]?.cnt || 0);
      checks.push({
        key: "draft_documents",
        label: "ไม่มีเอกสาร draft ค้าง",
        passed: draftCount === 0,
        detail: draftCount === 0 ? "ไม่มีเอกสารค้าง" : `มีเอกสาร draft ค้าง ${draftCount} รายการ`,
      });

      const draftJE = await db.select({ cnt: sql<string>`COUNT(*)` }).from(journalEntries)
        .where(and(eq(journalEntries.companyId, companyId), eq(journalEntries.status, "draft"),
          sql`${journalEntries.entryDate} >= ${startDate}`, sql`${journalEntries.entryDate} <= ${endDate}`));
      const draftJECount = Number(draftJE[0]?.cnt || 0);
      checks.push({
        key: "draft_journal_entries",
        label: "ไม่มี Journal Entry สถานะ draft",
        passed: draftJECount === 0,
        detail: draftJECount === 0 ? "ไม่มี JE ค้าง" : `มี JE draft ค้าง ${draftJECount} รายการ`,
      });

      const hasDepreciation = monthEntries.length > 0 && lines.some((l: any) => {
        const acc = allAccounts.find(a => a.id === l.accountId);
        return acc && (acc.code.startsWith("520") || acc.code.startsWith("5201") || acc.code.startsWith("5202"));
      });
      checks.push({
        key: "depreciation",
        label: "ลงค่าเสื่อมราคาประจำเดือน",
        passed: hasDepreciation,
        detail: hasDepreciation ? "พบรายการค่าเสื่อมราคาแล้ว" : "ยังไม่พบรายการค่าเสื่อมราคาในเดือนนี้",
      });

      const vatClosingExists = await db.select({ cnt: sql<string>`COUNT(*)` }).from(closedPeriods)
        .where(and(eq(closedPeriods.companyId, companyId), eq(closedPeriods.periodType, "vat"),
          eq(closedPeriods.year, year), eq(closedPeriods.month, month)));
      const vatClosed = Number(vatClosingExists[0]?.cnt || 0) > 0;
      checks.push({
        key: "vat_report",
        label: "ยื่น ภ.พ.30 แล้ว",
        passed: vatClosed,
        detail: vatClosed ? "ปิด VAT งวดนี้แล้ว" : "ยังไม่ได้ปิด VAT งวดนี้",
      });

      const entryCount = monthEntries.length;
      checks.push({
        key: "has_entries",
        label: "มีรายการบัญชีในเดือนนี้",
        passed: entryCount > 0,
        detail: entryCount > 0 ? `มี ${entryCount} รายการ` : "ยังไม่มีรายการบัญชีเลย",
      });

      const deadlineDays = company?.closingDeadlineDays || 15;
      const deadlineDate = new Date(year, month, deadlineDays);
      const now = new Date();
      const daysRemaining = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      const existingClosing = await db.select().from(closedPeriods)
        .where(and(eq(closedPeriods.companyId, companyId), eq(closedPeriods.periodType, "monthly"),
          eq(closedPeriods.year, year), eq(closedPeriods.month, month)));
      const alreadyClosed = existingClosing.length > 0;

      const passedCount = checks.filter(c => c.passed).length;

      res.json({
        checks,
        passedCount,
        totalCount: checks.length,
        allPassed: passedCount === checks.length,
        deadline: {
          days: deadlineDays,
          deadlineDate: deadlineDate.toISOString().slice(0, 10),
          daysRemaining,
          overdue: daysRemaining < 0 && !alreadyClosed,
        },
        alreadyClosed,
        closedAt: existingClosing[0]?.closedAt || null,
      });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // 5.6 Period Closing - Update Deadline Setting
  app.patch("/api/accounting-mgmt/period-closing/deadline", requireAuth, requireModule("accounting"), async (req, res) => {
    try {
      const companyId = Number(req.body.companyId);
      const closingDeadlineDays = Number(req.body.closingDeadlineDays);
      if (!companyId || !closingDeadlineDays || closingDeadlineDays < 1 || closingDeadlineDays > 60) {
        return res.status(400).json({ message: "กรุณาระบุจำนวนวัน 1-60" });
      }
      const user = req.user as any;
      const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
      if (!company) return res.status(404).json({ message: "ไม่พบบริษัท" });
      if (company.tenantId && company.tenantId !== user.tenantId) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });
      await db.update(companies).set({ closingDeadlineDays }).where(eq(companies.id, companyId));
      res.json({ success: true, closingDeadlineDays });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // 5.7 Period Closing - Status Overview (all months in a year)
  app.get("/api/accounting-mgmt/period-closing/status", requireAuth, requireModule("accounting"), async (req, res) => {
    try {
      const companyId = Number(req.query.companyId);
      const year = Number(req.query.year);
      if (!companyId || !year) return res.status(400).json({ message: "companyId, year required" });
      const user = req.user as any;
      const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
      if (company && company.tenantId && company.tenantId !== user.tenantId) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });

      const closedRows = await db.select().from(closedPeriods)
        .where(and(eq(closedPeriods.companyId, companyId), eq(closedPeriods.year, year),
          sql`${closedPeriods.periodType} IN ('monthly', 'yearly')`));

      const deadlineDays = company?.closingDeadlineDays || 15;
      const now = new Date();
      const months = [];
      for (let m = 1; m <= 12; m++) {
        const closed = closedRows.find(r => r.month === m && r.periodType === "monthly");
        const deadlineDate = new Date(year, m, deadlineDays);
        const daysRemaining = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        let status = "open";
        if (closed) status = "closed";
        else if (daysRemaining < 0) status = "overdue";
        else if (daysRemaining <= 3) status = "warning";

        months.push({
          month: m,
          status,
          closedAt: closed?.closedAt || null,
          deadlineDate: deadlineDate.toISOString().slice(0, 10),
          daysRemaining: closed ? null : daysRemaining,
        });
      }

      const yearlyClosed = closedRows.find(r => r.periodType === "yearly");

      res.json({
        year,
        deadlineDays,
        months,
        yearlyClosed: !!yearlyClosed,
        yearlyClosedAt: yearlyClosed?.closedAt || null,
      });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // 6. Period Closing - Execute
app.post("/api/accounting-mgmt/period-closing/execute", requireAuth, requireModule("accounting"), async (req, res) => {
  try {
    const { companyId, year, month, incomeExpenseItems, netIncome, retainedEarningsAccountId } = req.body;
    if (!companyId || !year) return res.status(400).json({ message: "companyId, year required" });
    const user = req.user as any;
    const periodType = month ? "monthly" : "yearly";
    const refNo = month ? `CLOSE-${year}${String(month).padStart(2, "0")}` : `CLOSE-${year}`;
    const entryDate = month ? `${year}-${String(month).padStart(2, "0")}-${new Date(year, month, 0).getDate()}` : `${year}-12-31`;
    const existing = await db.select().from(journalEntries)
      .where(and(eq(journalEntries.companyId, companyId), eq(journalEntries.reference, refNo), eq(journalEntries.sourceDocType, "period_closing")));
    if (existing.length > 0) return res.status(400).json({ message: "ปิดบัญชีงวดนี้แล้ว" });
    const THAI_MONTHS = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
    const periodLabel = month ? `เดือน ${THAI_MONTHS[month-1]} ${year+543}` : `ปี ${year+543}`;
    const [entry] = await db.insert(journalEntries).values({
      companyId, entryNo: refNo, entryDate, reference: refNo,
      description: `ปิดบัญชี ${periodLabel}`, journalBook: "general", createdBy: user.id, status: "approved", sourceDocType: "period_closing",
    }).returning();
    if (incomeExpenseItems?.length) {
      for (const item of incomeExpenseItems) {
        await db.insert(journalLines).values({
          journalEntryId: entry.id, accountId: item.accountId,
          description: `ปิดบัญชี ${item.code} ${item.name}`,
          debit: item.balance < 0 ? String(Math.abs(item.balance)) : "0",
          credit: item.balance > 0 ? String(item.balance) : "0",
        });
      }
    }
    if (retainedEarningsAccountId && Math.abs(netIncome) >= 0.01) {
      await db.insert(journalLines).values({
        journalEntryId: entry.id, accountId: retainedEarningsAccountId,
        description: `กำไร(ขาดทุน)สะสม ${periodLabel}`,
        debit: netIncome < 0 ? String(Math.abs(netIncome)) : "0",
        credit: netIncome > 0 ? String(netIncome) : "0",
      });
    }
    await db.insert(closedPeriods).values({
      companyId, periodType, month: month || undefined, year,
      closedBy: user.id, journalEntryId: entry.id, notes: `ปิดบัญชี ${periodLabel}`,
    });
    await db.insert(accountingMgmtLogs).values({
      companyId, toolName: "period_closing", params: JSON.stringify({ year, month, periodType }),
      result: `ปิดบัญชี ${periodLabel} สำเร็จ`, affectedCount: (incomeExpenseItems?.length || 0) + 1, runBy: user.id,
    });
    res.json({ success: true, journalEntryId: entry.id, message: `ปิดบัญชี ${periodLabel} สำเร็จ` });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// 7. Clean Zero Entries - Preview
app.get("/api/accounting-mgmt/clean-zero/preview", requireAuth, requireModule("accounting"), async (req, res) => {
  try {
    const companyId = Number(req.query.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId required" });
    const user = req.user as any;
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
    if (company && company.tenantId && company.tenantId !== user.tenantId) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });
    const zeroLines = await db.select({
      id: journalLines.id, journalEntryId: journalLines.journalEntryId,
      description: journalLines.description, debit: journalLines.debit, credit: journalLines.credit,
    }).from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
      .where(and(eq(journalEntries.companyId, companyId),
        sql`CAST(${journalLines.debit} AS NUMERIC) = 0`, sql`CAST(${journalLines.credit} AS NUMERIC) = 0`));
    res.json({ count: zeroLines.length, lines: zeroLines.slice(0, 100) });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// 7. Clean Zero Entries - Execute
app.post("/api/accounting-mgmt/clean-zero/execute", requireAuth, requireModule("accounting"), async (req, res) => {
  try {
    const { companyId } = req.body;
    if (!companyId) return res.status(400).json({ message: "companyId required" });
    const user = req.user as any;
    const zeroLineIds = await db.select({ id: journalLines.id }).from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
      .where(and(eq(journalEntries.companyId, companyId),
        sql`CAST(${journalLines.debit} AS NUMERIC) = 0`, sql`CAST(${journalLines.credit} AS NUMERIC) = 0`));
    let deleted = 0;
    if (zeroLineIds.length > 0) {
      await db.delete(journalLines).where(sql`${journalLines.id} IN (${sql.join(zeroLineIds.map(l => sql`${l.id}`), sql`, `)})`);
      deleted = zeroLineIds.length;
    }
    await db.insert(accountingMgmtLogs).values({
      companyId, toolName: "clean_zero", params: JSON.stringify({}),
      result: `ลบรายการ 0 บาท จำนวน ${deleted} รายการ`, affectedCount: deleted, runBy: user.id,
    });
    res.json({ success: true, deleted, message: `ลบรายการ 0 บาท ${deleted} รายการสำเร็จ` });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// 8. Fix Diff - Preview
app.get("/api/accounting-mgmt/fix-diff/preview", requireAuth, requireModule("accounting"), async (req, res) => {
  try {
    const companyId = Number(req.query.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId required" });
    const user = req.user as any;
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
    if (company && company.tenantId && company.tenantId !== user.tenantId) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });
    const allEntries = await db.select().from(journalEntries).where(eq(journalEntries.companyId, companyId));
    let allLines: any[] = [];
    if (allEntries.length > 0) {
      allLines = await db.select().from(journalLines)
        .where(sql`${journalLines.journalEntryId} IN (${sql.join(allEntries.map(e => sql`${e.id}`), sql`, `)})`);
    }
    const fixableEntries: any[] = [];
    for (const entry of allEntries) {
      const entryLines = allLines.filter(l => l.journalEntryId === entry.id);
      if (entryLines.length === 0) continue;
      const totalDebit = entryLines.reduce((s: number, l: any) => s + parseFloat(l.debit || "0"), 0);
      const totalCredit = entryLines.reduce((s: number, l: any) => s + parseFloat(l.credit || "0"), 0);
      const diff = Math.round((totalDebit - totalCredit) * 10000) / 10000;
      if (Math.abs(diff) > 0.0001 && Math.abs(diff) < 0.01) {
        fixableEntries.push({ entryId: entry.id, entryNo: entry.entryNo || "", entryDate: entry.entryDate, diff, lastLineId: entryLines[entryLines.length - 1].id });
      }
    }
    res.json({ count: fixableEntries.length, entries: fixableEntries });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// 8. Fix Diff - Execute
app.post("/api/accounting-mgmt/fix-diff/execute", requireAuth, requireModule("accounting"), async (req, res) => {
  try {
    const { companyId, entries } = req.body;
    if (!companyId) return res.status(400).json({ message: "companyId required" });
    const user = req.user as any;
    let fixed = 0;
    for (const e of (entries || [])) {
      const [line] = await db.select().from(journalLines).where(eq(journalLines.id, e.lastLineId));
      if (!line) continue;
      if (e.diff > 0) {
        await db.update(journalLines).set({ credit: (parseFloat(line.credit || "0") + e.diff).toFixed(2) }).where(eq(journalLines.id, e.lastLineId));
      } else {
        await db.update(journalLines).set({ debit: (parseFloat(line.debit || "0") + Math.abs(e.diff)).toFixed(2) }).where(eq(journalLines.id, e.lastLineId));
      }
      fixed++;
    }
    await db.insert(accountingMgmtLogs).values({
      companyId, toolName: "fix_diff", params: JSON.stringify({ count: fixed }),
      result: `แก้ไขผลต่าง ${fixed} รายการ`, affectedCount: fixed, runBy: user.id,
    });
    res.json({ success: true, fixed, message: `แก้ไขผลต่างเล็กน้อย ${fixed} รายการสำเร็จ` });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// 9. Change Anchor - Preview
app.get("/api/accounting-mgmt/change-anchor/preview", requireAuth, requireModule("accounting"), async (req, res) => {
  try {
    const companyId = Number(req.query.companyId);
    const oldAnchor = req.query.oldAnchor as string;
    if (!companyId) return res.status(400).json({ message: "companyId required" });
    const user = req.user as any;
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
    if (company && company.tenantId && company.tenantId !== user.tenantId) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });
    let matchingLines;
    if (oldAnchor) {
      matchingLines = await db.select({ id: journalLines.id, anchor: journalLines.anchor, description: journalLines.description, journalEntryId: journalLines.journalEntryId })
        .from(journalLines).innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
        .where(and(eq(journalEntries.companyId, companyId), eq(journalLines.anchor, oldAnchor)));
    } else {
      matchingLines = await db.select({ id: journalLines.id, anchor: journalLines.anchor, description: journalLines.description, journalEntryId: journalLines.journalEntryId })
        .from(journalLines).innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
        .where(and(eq(journalEntries.companyId, companyId), sql`${journalLines.anchor} IS NOT NULL AND ${journalLines.anchor} != ''`));
    }
    const anchors = new Map<string, number>();
    for (const l of matchingLines) { const a = l.anchor || ""; anchors.set(a, (anchors.get(a) || 0) + 1); }
    res.json({ totalLines: matchingLines.length, anchors: Array.from(anchors.entries()).map(([anchor, count]) => ({ anchor, count })), lines: matchingLines.slice(0, 50) });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// 9. Change Anchor - Execute
app.post("/api/accounting-mgmt/change-anchor/execute", requireAuth, requireModule("accounting"), async (req, res) => {
  try {
    const { companyId, oldAnchor, newAnchor } = req.body;
    if (!companyId || !oldAnchor || newAnchor === undefined) return res.status(400).json({ message: "companyId, oldAnchor, newAnchor required" });
    const user = req.user as any;
    const matchingLines = await db.select({ id: journalLines.id }).from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
      .where(and(eq(journalEntries.companyId, companyId), eq(journalLines.anchor, oldAnchor)));
    if (matchingLines.length > 0) {
      await db.update(journalLines).set({ anchor: newAnchor || null })
        .where(sql`${journalLines.id} IN (${sql.join(matchingLines.map(l => sql`${l.id}`), sql`, `)})`);
    }
    await db.insert(accountingMgmtLogs).values({
      companyId, toolName: "change_anchor", params: JSON.stringify({ oldAnchor, newAnchor }),
      result: `เปลี่ยน anchor ${matchingLines.length} รายการ`, affectedCount: matchingLines.length, runBy: user.id,
    });
    res.json({ success: true, updated: matchingLines.length, message: `เปลี่ยน anchor จาก "${oldAnchor}" เป็น "${newAnchor}" ${matchingLines.length} รายการสำเร็จ` });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// 10. GL NO DOC
app.get("/api/accounting-mgmt/gl-no-doc", requireAuth, requireModule("accounting"), async (req, res) => {
  try {
    const companyId = Number(req.query.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId required" });
    const user = req.user as any;
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
    if (company && company.tenantId && company.tenantId !== user.tenantId) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });
    const noDocEntries = await db.select().from(journalEntries)
      .where(and(eq(journalEntries.companyId, companyId),
        sql`(${journalEntries.sourceDocType} IS NULL OR ${journalEntries.sourceDocType} = '')`,
        sql`(${journalEntries.reference} IS NULL OR ${journalEntries.reference} = '')`));
    await db.insert(accountingMgmtLogs).values({
      companyId, toolName: "gl_no_doc", params: JSON.stringify({}),
      result: `พบ ${noDocEntries.length} รายการที่ไม่มีเอกสาร`, affectedCount: noDocEntries.length, runBy: user.id,
    });
    res.json({ count: noDocEntries.length, entries: noDocEntries.map(e => ({ id: e.id, entryNo: e.entryNo, entryDate: e.entryDate, description: e.description, reference: e.reference, sourceDocType: e.sourceDocType })) });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Accounting mgmt logs
app.get("/api/accounting-mgmt/logs", requireAuth, requireModule("accounting"), async (req, res) => {
  try {
    const companyId = Number(req.query.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId required" });
    const logs = await db.select().from(accountingMgmtLogs).where(eq(accountingMgmtLogs.companyId, companyId)).orderBy(desc(accountingMgmtLogs.runAt)).limit(100);
    res.json(logs);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Closed periods
app.get("/api/accounting-mgmt/closed-periods", requireAuth, requireModule("accounting"), async (req, res) => {
  try {
    const companyId = Number(req.query.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId required" });
    const periods = await db.select().from(closedPeriods).where(eq(closedPeriods.companyId, companyId)).orderBy(desc(closedPeriods.year), desc(closedPeriods.month));
    res.json(periods);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});


// Restaurant POS routes registered via registerRestaurantRoutes(app)
}
