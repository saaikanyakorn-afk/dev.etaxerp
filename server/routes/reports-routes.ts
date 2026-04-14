import type { Express, Request, Response } from "express";
import { db } from "../db";
import { storage } from "../storage";
import { eq, desc, and, inArray, gte, lte, sum , sql } from "drizzle-orm";
import { companies, accounts, journalEntries, journalLines, expenses, taxInvoices, salesCreditNotes, purchaseInvoices, expenseItems, quotations, salesOrders, invoices, quotationItems, salesOrderItems, taxInvoiceItems, invoiceItems, products, fixedAssets, purchaseDebitNotes } from "@shared/schema";
import { requireAuth, requireModule, checkDocOwnership } from "../route-middleware";
import { getNextJournalEntryNo } from "../route-helpers";
import multer from "multer";
import * as XLSX from "xlsx";
import OpenAI from "openai";
import { getCachedReport, setCachedReport, invalidateCompanyReports, logReportTiming } from "./report-cache";
import { rebuildPeriodBalances, isPeriodBalancesAvailable, canUseSummaryPath, getOpeningBalancesFromSummary, getPeriodBalancesFromSummary } from "./period-balances";
import { getGeneralLedgerLines, getAccountBalancesBefore, getAccountBalances, balanceMapFromRows } from "./report-queries";

export function registerReportsRoutes(app: Express) {
// ========== Financial Reports API ==========

// General Ledger (บัญชีแยกประเภท) — optimized: SQL JOIN instead of IN clause
app.get("/api/reports/general-ledger", requireAuth, requireModule("accounting"), async (req, res) => {
  try {
    const _t0 = performance.now();
    const companyId = Number(req.query.companyId);
    const startDate = req.query.startDate as string || null;
    const endDate = req.query.endDate as string || null;
    const accountCode = req.query.accountCode as string || null;
    if (!companyId) return res.status(400).json({ message: "companyId required" });

    const cacheParams = { startDate: startDate || undefined, endDate: endDate || undefined, accountCode: accountCode || undefined };
    const cached = getCachedReport("general-ledger", companyId, cacheParams);
    if (cached) { logReportTiming("general-ledger", companyId, performance.now() - _t0, null, true, cacheParams); return res.json(cached); }
    const user = req.user as any;
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
    if (company && company.tenantId && company.tenantId !== user.tenantId) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });

    const [allAccounts, lines, bRows] = await Promise.all([
      db.select().from(accounts).where(eq(accounts.companyId, companyId)).orderBy(accounts.code),
      getGeneralLedgerLines(companyId, startDate || undefined, endDate || undefined, accountCode || undefined),
      startDate ? getAccountBalancesBefore(companyId, startDate, accountCode) : Promise.resolve([]),
    ]);

    const beginBalances = new Map<number, number>();
    if (startDate) {
      for (const b of bRows) {
        const acct = allAccounts.find(a => a.id === Number(b.accountId));
        if (acct) {
          const d = Number(b.totalDebit) || 0;
          const c = Number(b.totalCredit) || 0;
          const bal = (acct.type === "asset" || acct.type === "expense") ? d - c : c - d;
          beginBalances.set(acct.id, bal);
        }
      }
    }

    const filteredAccounts = accountCode
      ? allAccounts.filter(a => a.code === accountCode)
      : allAccounts;

    const linesByAccount = new Map<number, typeof lines>();
    for (const l of lines) {
      const arr = linesByAccount.get(l.accountId) || [];
      arr.push(l);
      linesByAccount.set(l.accountId, arr);
    }

    const ledger = filteredAccounts.map(acct => {
      const acctLines = linesByAccount.get(acct.id) || [];
      const beginBalance = beginBalances.get(acct.id) || 0;

      let runningBalance = beginBalance;
      const linesWithBalance = acctLines.map(l => {
        const debit = parseFloat(l.debit || "0");
        const credit = parseFloat(l.credit || "0");
        if (acct.type === "asset" || acct.type === "expense") {
          runningBalance += debit - credit;
        } else {
          runningBalance += credit - debit;
        }
        return { ...l, id: l.lineId, journalEntryId: l.journalEntryId, accountId: l.accountId, accountCode: l.accountCode, accountName: l.accountName, accountNameTh: l.accountNameTh, balance: runningBalance };
      });

      return {
        accountId: acct.id,
        accountCode: acct.code,
        accountName: acct.name,
        accountNameTh: acct.nameTh,
        accountType: acct.type,
        beginBalance,
        lines: linesWithBalance,
        totalDebit: acctLines.reduce((s, l) => s + parseFloat(l.debit || "0"), 0),
        totalCredit: acctLines.reduce((s, l) => s + parseFloat(l.credit || "0"), 0),
        endBalance: runningBalance,
      };
    }).filter(a => a.lines.length > 0 || accountCode);

    setCachedReport("general-ledger", companyId, { startDate: startDate || undefined, endDate: endDate || undefined, accountCode: accountCode || undefined }, ledger);
    logReportTiming("general-ledger", companyId, performance.now() - _t0, ledger.length, false, { startDate: startDate || undefined, endDate: endDate || undefined, accountCode: accountCode || undefined });
    res.json(ledger);
  } catch (err: any) { console.error("[general-ledger] Error:", err.message, err.stack?.split("\n").slice(0, 3).join(" ")); res.status(500).json({ message: err.message }); }
});

app.get("/api/reports/account-statement", requireAuth, requireModule("accounting"), async (req, res) => {
  try {
    const companyId = Number(req.query.companyId);
    const startDate = req.query.startDate as string || null;
    const endDate = req.query.endDate as string || null;
    const accountCode = req.query.accountCode as string || null;
    const contactId = req.query.contactId ? Number(req.query.contactId) : null;
    if (!companyId) return res.status(400).json({ message: "companyId required" });

    const user = req.user as any;
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
    if (company && company.tenantId && company.tenantId !== user.tenantId) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });

    
    const allAccounts = await db.select().from(accounts).where(eq(accounts.companyId, companyId)).orderBy(accounts.code);

    const conditions = [sql`je.company_id = ${companyId}`, sql`je.status IN ('posted','approved')`];
    if (startDate) conditions.push(sql`je.entry_date >= ${startDate}`);
    if (endDate) conditions.push(sql`je.entry_date <= ${endDate}`);
    if (accountCode) conditions.push(sql`a.code = ${accountCode}`);
    if (contactId) conditions.push(sql`je.contact_id = ${contactId}`);
    const whereClause = sql.join(conditions, sql` AND `);

    const rows = await db.execute(sql`
      SELECT jl.id AS "lineId", jl.journal_entry_id AS "journalEntryId", jl.account_id AS "accountId",
        a.code AS "accountCode", a.name AS "accountName", a.name_th AS "accountNameTh", a.type AS "accountType",
        jl.description, COALESCE(CAST(jl.debit AS numeric),0) AS debit, COALESCE(CAST(jl.credit AS numeric),0) AS credit,
        je.entry_date AS "entryDate", je.reference, je.description AS "entryDescription",
        je.source_doc_type AS "sourceDocType", je.source_doc_id AS "sourceDocId",
        je.contact_id AS "contactId", je.contact_name AS "contactName"
      FROM journal_lines jl
      INNER JOIN journal_entries je ON je.id = jl.journal_entry_id
      INNER JOIN accounts a ON a.id = jl.account_id
      WHERE ${whereClause}
      ORDER BY a.code, je.entry_date, je.id
    `);
    const lines = (rows.rows || rows) as any[];

    const beginBalances = new Map<number, number>();
    if (startDate) {
      const bfConditions = [sql`je.company_id = ${companyId}`, sql`je.status IN ('posted','approved')`, sql`je.entry_date < ${startDate}`];
      if (accountCode) bfConditions.push(sql`a.code = ${accountCode}`);
      if (contactId) bfConditions.push(sql`je.contact_id = ${contactId}`);
      const bfWhere = sql.join(bfConditions, sql` AND `);
      const bfRows = await db.execute(sql`
        SELECT jl.account_id AS "accountId", COALESCE(SUM(CAST(jl.debit AS numeric)),0) AS "totalDebit",
          COALESCE(SUM(CAST(jl.credit AS numeric)),0) AS "totalCredit"
        FROM journal_lines jl INNER JOIN journal_entries je ON je.id = jl.journal_entry_id
        INNER JOIN accounts a ON a.id = jl.account_id
        WHERE ${bfWhere} GROUP BY jl.account_id
      `);
      for (const b of (bfRows.rows || bfRows) as any[]) {
        const acct = allAccounts.find(a => a.id === Number(b.accountId));
        if (acct) {
          const d = Number(b.totalDebit) || 0, c = Number(b.totalCredit) || 0;
          beginBalances.set(acct.id, (acct.type === "asset" || acct.type === "expense") ? d - c : c - d);
        }
      }
    }

    const linesByAccount = new Map<number, any[]>();
    for (const l of lines) { const arr = linesByAccount.get(l.accountId) || []; arr.push(l); linesByAccount.set(l.accountId, arr); }

    const targetAccounts = accountCode ? allAccounts.filter(a => a.code === accountCode) : allAccounts;
    const statement = targetAccounts.map(acct => {
      const acctLines = linesByAccount.get(acct.id) || [];
      const beginBalance = beginBalances.get(acct.id) || 0;
      let runningBalance = beginBalance;
      const linesWithBalance = acctLines.map(l => {
        const d = parseFloat(l.debit || "0"), c = parseFloat(l.credit || "0");
        runningBalance += (acct.type === "asset" || acct.type === "expense") ? d - c : c - d;
        return { ...l, balance: runningBalance };
      });
      return {
        accountId: acct.id, accountCode: acct.code, accountName: acct.name, accountNameTh: acct.nameTh, accountType: acct.type,
        beginBalance, lines: linesWithBalance,
        totalDebit: acctLines.reduce((s, l) => s + parseFloat(l.debit || "0"), 0),
        totalCredit: acctLines.reduce((s, l) => s + parseFloat(l.credit || "0"), 0),
        endBalance: runningBalance,
      };
    }).filter(a => a.lines.length > 0 || accountCode);

    res.json(statement);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.get("/api/reports/reconcile-by-account-type", requireAuth, requireModule("accounting"), async (req, res) => {
  try {
    const companyId = Number(req.query.companyId);
    const startDate = req.query.startDate as string || null;
    const endDate = req.query.endDate as string || null;
    const contactId = req.query.contactId ? Number(req.query.contactId) : null;
    const accountType = req.query.accountType as string || null;
    if (!companyId) return res.status(400).json({ message: "companyId required" });

    const user = req.user as any;
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
    if (company && company.tenantId && company.tenantId !== user.tenantId) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });

    const allAccounts = await db.select().from(accounts).where(eq(accounts.companyId, companyId)).orderBy(accounts.code);
    const filteredAccounts = accountType ? allAccounts.filter(a => a.type === accountType) : allAccounts;
    const accountIds = filteredAccounts.map(a => a.id);
    if (accountIds.length === 0) return res.json([]);

    const accountIdsList = accountIds.map(id => sql`${id}`);
    const conditions = [sql`je.company_id = ${companyId}`, sql`je.status IN ('posted','approved')`, sql`jl.account_id IN (${sql.join(accountIdsList, sql`, `)})`];
    if (startDate) conditions.push(sql`je.entry_date >= ${startDate}`);
    if (endDate) conditions.push(sql`je.entry_date <= ${endDate}`);
    if (contactId) conditions.push(sql`je.contact_id = ${contactId}`);
    const whereClause = sql.join(conditions, sql` AND `);

    const rows = await db.execute(sql`
      SELECT je.contact_id AS "contactId", je.contact_name AS "contactName", a.type AS "accountType",
        a.code AS "accountCode", a.name AS "accountName", a.name_th AS "accountNameTh",
        COALESCE(SUM(CAST(jl.debit AS numeric)),0) AS "totalDebit",
        COALESCE(SUM(CAST(jl.credit AS numeric)),0) AS "totalCredit"
      FROM journal_lines jl
      INNER JOIN journal_entries je ON je.id = jl.journal_entry_id
      INNER JOIN accounts a ON a.id = jl.account_id
      WHERE ${whereClause}
      GROUP BY je.contact_id, je.contact_name, a.type, a.code, a.name, a.name_th
      ORDER BY je.contact_name, a.code
    `);

    const data = (rows.rows || rows) as any[];
    const grouped = new Map<string, any>();
    for (const r of data) {
      const key = r.contactId ? String(r.contactId) : "no-contact";
      if (!grouped.has(key)) {
        grouped.set(key, { contactId: r.contactId, contactName: r.contactName || "ไม่ระบุคู่ค้า", accounts: [], totalDebit: 0, totalCredit: 0, balance: 0 });
      }
      const g = grouped.get(key)!;
      const d = Number(r.totalDebit), c = Number(r.totalCredit);
      g.accounts.push({ accountCode: r.accountCode, accountName: r.accountName, accountNameTh: r.accountNameTh, accountType: r.accountType, totalDebit: d, totalCredit: c, balance: d - c });
      g.totalDebit += d; g.totalCredit += c; g.balance += d - c;
    }

    res.json(Array.from(grouped.values()));
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.get("/api/reports/worksheet", requireAuth, requireModule("accounting"), async (req, res) => {
  try {
    const companyId = Number(req.query.companyId);
    const startDate = req.query.startDate as string || null;
    const endDate = req.query.endDate as string || null;
    if (!companyId) return res.status(400).json({ message: "companyId required" });

    const user = req.user as any;
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
    if (company && company.tenantId && company.tenantId !== user.tenantId) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });

    const allAccounts = await db.select().from(accounts).where(eq(accounts.companyId, companyId)).orderBy(accounts.code);
    const detailAccounts = allAccounts.filter(a => !a.isHeader);

    const conditions = [sql`je.company_id = ${companyId}`, sql`je.status IN ('posted','approved')`];
    if (startDate) conditions.push(sql`je.entry_date >= ${startDate}`);
    if (endDate) conditions.push(sql`je.entry_date <= ${endDate}`);
    const whereClause = sql.join(conditions, sql` AND `);

    const rows = await db.execute(sql`
      SELECT jl.account_id AS "accountId",
        COALESCE(SUM(CAST(jl.debit AS numeric)),0) AS "totalDebit",
        COALESCE(SUM(CAST(jl.credit AS numeric)),0) AS "totalCredit"
      FROM journal_lines jl
      INNER JOIN journal_entries je ON je.id = jl.journal_entry_id
      WHERE ${whereClause}
      GROUP BY jl.account_id
    `);
    const balances = new Map<number, { debit: number; credit: number }>();
    for (const r of (rows.rows || rows) as any[]) {
      balances.set(Number(r.accountId), { debit: Number(r.totalDebit), credit: Number(r.totalCredit) });
    }

    const worksheet = detailAccounts.map(acct => {
      const bal = balances.get(acct.id) || { debit: 0, credit: 0 };
      const tbDebit = bal.debit, tbCredit = bal.credit;
      const adjDebit = 0, adjCredit = 0;
      const adjTbDebit = tbDebit + adjDebit, adjTbCredit = tbCredit + adjCredit;
      const isBS = acct.type === "asset" || acct.type === "liability" || acct.type === "equity";
      const isPL = acct.type === "revenue" || acct.type === "expense";
      return {
        accountCode: acct.code, accountName: acct.name, accountNameTh: acct.nameTh, accountType: acct.type,
        trialBalance: { debit: tbDebit, credit: tbCredit },
        adjustments: { debit: adjDebit, credit: adjCredit },
        adjustedTrialBalance: { debit: adjTbDebit, credit: adjTbCredit },
        incomeStatement: isPL ? { debit: adjTbDebit, credit: adjTbCredit } : { debit: 0, credit: 0 },
        balanceSheet: isBS ? { debit: adjTbDebit, credit: adjTbCredit } : { debit: 0, credit: 0 },
      };
    }).filter(r => r.trialBalance.debit !== 0 || r.trialBalance.credit !== 0);

    const totals = {
      trialBalance: { debit: 0, credit: 0 }, adjustments: { debit: 0, credit: 0 },
      adjustedTrialBalance: { debit: 0, credit: 0 }, incomeStatement: { debit: 0, credit: 0 }, balanceSheet: { debit: 0, credit: 0 },
    };
    for (const r of worksheet) {
      totals.trialBalance.debit += r.trialBalance.debit; totals.trialBalance.credit += r.trialBalance.credit;
      totals.adjustments.debit += r.adjustments.debit; totals.adjustments.credit += r.adjustments.credit;
      totals.adjustedTrialBalance.debit += r.adjustedTrialBalance.debit; totals.adjustedTrialBalance.credit += r.adjustedTrialBalance.credit;
      totals.incomeStatement.debit += r.incomeStatement.debit; totals.incomeStatement.credit += r.incomeStatement.credit;
      totals.balanceSheet.debit += r.balanceSheet.debit; totals.balanceSheet.credit += r.balanceSheet.credit;
    }

    const plDebit = totals.incomeStatement.debit, plCredit = totals.incomeStatement.credit;
    const netIncome = plCredit - plDebit;

    res.json({ rows: worksheet, totals, netIncome });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.get("/api/reports/journal-book", requireAuth, requireModule("accounting"), async (req, res) => {
  try {
    const companyId = Number(req.query.companyId);
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    if (!companyId) return res.status(400).json({ message: "companyId required" });

    const user = req.user as any;
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
    if (company && company.tenantId && company.tenantId !== user.tenantId) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });

    let whereConditions = [eq(journalEntries.companyId, companyId)];
    if (startDate) whereConditions.push(gte(journalEntries.entryDate, startDate));
    if (endDate) whereConditions.push(lte(journalEntries.entryDate, endDate + "T23:59:59"));

    const entries = await db.select().from(journalEntries).where(and(...whereConditions)).orderBy(journalEntries.entryDate);
    if (entries.length === 0) return res.json([]);

    const entryIds = entries.map(e => e.id);
    const lines = await db.select({
      id: journalLines.id,
      journalEntryId: journalLines.journalEntryId,
      accountId: journalLines.accountId,
      accountCode: accounts.code,
      accountName: accounts.name,
      lineDescription: journalLines.description,
      debit: journalLines.debit,
      credit: journalLines.credit,
    }).from(journalLines)
      .leftJoin(accounts, eq(journalLines.accountId, accounts.id))
      .where(inArray(journalLines.journalEntryId, entryIds))
      .orderBy(journalLines.id);

    const entryMap = new Map(entries.map(e => [e.id, e]));
    const result = lines.map(l => {
      const entry = entryMap.get(l.journalEntryId!);
      return {
        ...l,
        entryDate: entry?.entryDate,
        entryNo: entry?.entryNo,
        reference: entry?.reference,
        entryDescription: entry?.description,
        journalBook: entry?.journalBook || "general",
      };
    });

    res.json(result);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Trial Balance 6 columns (งบทดลอง 6 ช่อง) — optimized: SQL aggregate
app.get("/api/reports/trial-balance", requireAuth, requireModule("accounting"), async (req, res) => {
  try {
    const _t0 = performance.now();
    const companyId = Number(req.query.companyId);
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    if (!companyId || !startDate || !endDate) return res.status(400).json({ message: "companyId, startDate, endDate required" });

    const cachedTB = getCachedReport("trial-balance", companyId, { startDate, endDate });
    if (cachedTB) { logReportTiming("trial-balance", companyId, performance.now() - _t0, null, true, { startDate, endDate }); return res.json(cachedTB); }

    const user = req.user as any;
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
    if (company && company.tenantId && company.tenantId !== user.tenantId) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });

    const summaryAvailable = await isPeriodBalancesAvailable(companyId);
    const useSummary = summaryAvailable && canUseSummaryPath(startDate, endDate);
    let openingMap: Map<number, { debit: number; credit: number }>;
    let periodMap: Map<number, { debit: number; credit: number }>;

    const accountsPromise = db.select().from(accounts).where(eq(accounts.companyId, companyId)).orderBy(accounts.code);

    let allAccounts: Awaited<typeof accountsPromise>;
    if (useSummary) {
      const [accts, openingSummary, periodSummary] = await Promise.all([
        accountsPromise,
        getOpeningBalancesFromSummary(companyId, startDate),
        getPeriodBalancesFromSummary(companyId, startDate, endDate),
      ]);
      allAccounts = accts;
      openingMap = balanceMapFromRows(openingSummary);
      periodMap = balanceMapFromRows(periodSummary);
    } else {
      const [accts, openingRows, periodRows] = await Promise.all([
        accountsPromise,
        getAccountBalancesBefore(companyId, startDate),
        getAccountBalances(companyId, startDate, endDate),
      ]);
      allAccounts = accts;
      openingMap = balanceMapFromRows(openingRows);
      periodMap = balanceMapFromRows(periodRows);
    }

    const result = allAccounts.map(acct => {
      const op = openingMap.get(acct.id) || { debit: 0, credit: 0 };
      const mv = periodMap.get(acct.id) || { debit: 0, credit: 0 };

      let openingDebit = 0, openingCredit = 0;
      const netOpening = op.debit - op.credit;
      if (acct.type === "asset" || acct.type === "expense") {
        if (netOpening >= 0) openingDebit = netOpening; else openingCredit = Math.abs(netOpening);
      } else {
        if (netOpening <= 0) openingCredit = Math.abs(netOpening); else openingDebit = netOpening;
      }

      const closingDebit = openingDebit + mv.debit;
      const closingCredit = openingCredit + mv.credit;
      let endDebit = 0, endCredit = 0;
      const netClosing = closingDebit - closingCredit;
      if (netClosing >= 0) endDebit = netClosing; else endCredit = Math.abs(netClosing);

      return {
        accountCode: acct.code,
        accountName: acct.name,
        accountNameTh: acct.nameTh,
        accountType: acct.type,
        openingDebit, openingCredit,
        movementDebit: mv.debit, movementCredit: mv.credit,
        closingDebit: endDebit, closingCredit: endCredit,
      };
    }).filter(r => r.openingDebit || r.openingCredit || r.movementDebit || r.movementCredit || r.closingDebit || r.closingCredit);

    const totals = result.reduce((t, r) => ({
      openingDebit: t.openingDebit + r.openingDebit,
      openingCredit: t.openingCredit + r.openingCredit,
      movementDebit: t.movementDebit + r.movementDebit,
      movementCredit: t.movementCredit + r.movementCredit,
      closingDebit: t.closingDebit + r.closingDebit,
      closingCredit: t.closingCredit + r.closingCredit,
    }), { openingDebit: 0, openingCredit: 0, movementDebit: 0, movementCredit: 0, closingDebit: 0, closingCredit: 0 });

    const headerAccounts: Record<string, { code: string; name: string; nameTh: string; parentCode: string | null }> = {};
    allAccounts.filter(a => a.isHeader).forEach(a => {
      headerAccounts[a.code] = { code: a.code, name: a.name, nameTh: a.nameTh || a.name, parentCode: a.parentCode || null };
    });

    const tbResult = { rows: result, totals, headerAccounts };
    setCachedReport("trial-balance", companyId, { startDate, endDate }, tbResult);
    logReportTiming("trial-balance", companyId, performance.now() - _t0, tbResult?.rows?.length ?? null, false, { startDate, endDate });
    res.json(tbResult);
  } catch (err: any) { console.error("[trial-balance] Error:", err.message, err.stack?.split("\n").slice(0, 3).join(" ")); res.status(500).json({ message: err.message }); }
});

app.get("/api/reports/trial-balance-12month", requireAuth, requireModule("accounting"), async (req, res) => {
  try {
    const companyId = Number(req.query.companyId);
    const year = Number(req.query.year);
    if (!companyId || !year) return res.status(400).json({ message: "companyId, year required" });

    const user = req.user as any;
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
    if (company && company.tenantId && company.tenantId !== user.tenantId) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });

    
    const allAccounts = await db.select().from(accounts).where(eq(accounts.companyId, companyId)).orderBy(accounts.code);

    const months: Record<string, { debit: number; credit: number }>[] = [];
    const monthPromises = [];
    for (let m = 1; m <= 12; m++) {
      const startDate = `${year}-${String(m).padStart(2, "0")}-01`;
      const lastDay = new Date(year, m, 0).getDate();
      const endDate = `${year}-${String(m).padStart(2, "0")}-${lastDay}`;
      monthPromises.push(getAccountBalances(companyId, startDate, endDate));
    }
    const monthResults = await Promise.all(monthPromises);

    const rows = allAccounts.filter(a => !a.isHeader).map(acct => {
      const monthlyData: (number | null)[] = [];
      let hasAny = false;
      for (let m = 0; m < 12; m++) {
        const map = balanceMapFromRows(monthResults[m]);
        const bal = map.get(acct.id);
        if (bal) {
          const isDebitNature = acct.type === "asset" || acct.type === "expense";
          const net = isDebitNature ? (bal.debit - bal.credit) : (bal.credit - bal.debit);
          if (net !== 0) { monthlyData.push(net); hasAny = true; }
          else monthlyData.push(null);
        } else {
          monthlyData.push(null);
        }
      }
      if (!hasAny) return null;
      return {
        accountCode: acct.code,
        accountName: acct.name,
        accountNameTh: acct.nameTh,
        accountType: acct.type,
        months: monthlyData,
      };
    }).filter(Boolean);

    res.json({ rows, year });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post("/api/reports/rebuild-period-balances", requireAuth, requireModule("accounting"), async (req, res) => {
  try {
    const companyId = Number(req.body.companyId || req.query.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId required" });
    const user = req.user as any;
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
    if (company && company.tenantId && company.tenantId !== user.tenantId) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });
    const t0 = performance.now();
    const result = await rebuildPeriodBalances(companyId);
    const ms = Math.round(performance.now() - t0);
    invalidateCompanyReports(companyId);
    res.json({ success: true, ...result, executionMs: ms, message: `สร้างสรุปยอดรายเดือนสำเร็จ (${result.periodsUpdated} periods, ${ms}ms)` });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.get("/api/reports/period-balance-status", requireAuth, requireModule("accounting"), async (req, res) => {
  try {
    const companyId = Number(req.query.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId required" });
    const user = req.user as any;
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
    if (company && company.tenantId && company.tenantId !== user.tenantId) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });
    const available = await isPeriodBalancesAvailable(companyId);
    const countResult = await db.execute(sql`SELECT COUNT(*)::int AS cnt FROM account_period_balances WHERE company_id = ${companyId}`);
    const rows = (countResult.rows || countResult) as any[];
    res.json({ available, periodCount: Number(rows[0]?.cnt || 0) });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Income Statement (งบกำไรขาดทุน) — optimized: SQL aggregate
app.get("/api/reports/income-statement", requireAuth, requireModule("accounting"), async (req, res) => {
  try {
    const _t0 = performance.now();
    const companyId = Number(req.query.companyId);
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    if (!companyId || !startDate || !endDate) return res.status(400).json({ message: "companyId, startDate, endDate required" });

    const cachedIS = getCachedReport("income-statement", companyId, { startDate, endDate });
    if (cachedIS) { logReportTiming("income-statement", companyId, performance.now() - _t0, null, true, { startDate, endDate }); return res.json(cachedIS); }

    const user = req.user as any;
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
    if (company && company.tenantId && company.tenantId !== user.tenantId) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });

    const [allAccounts, periodRows] = await Promise.all([
      db.select().from(accounts).where(eq(accounts.companyId, companyId)).orderBy(accounts.code),
      getAccountBalances(companyId, startDate, endDate),
    ]);
    const balMap = balanceMapFromRows(periodRows);

    const calcBalance = (acct: any) => {
      const bal = balMap.get(acct.id) || { debit: 0, credit: 0 };
      const balance = acct.type === "revenue" ? bal.credit - bal.debit : bal.debit - bal.credit;
      return { ...acct, totalDebit: bal.debit, totalCredit: bal.credit, balance };
    };

    const revenues = allAccounts.filter(a => a.type === "revenue").map(calcBalance).filter(r => r.balance !== 0);
    const expenses = allAccounts.filter(a => a.type === "expense").map(calcBalance).filter(r => r.balance !== 0);
    const totalRevenue = revenues.reduce((s, r) => s + r.balance, 0);
    const totalExpense = expenses.reduce((s, r) => s + r.balance, 0);
    const netIncome = totalRevenue - totalExpense;

    const headerAccounts: Record<string, { code: string; name: string; nameTh: string; parentCode: string | null }> = {};
    allAccounts.filter(a => a.isHeader && (a.type === "revenue" || a.type === "expense")).forEach(a => {
      headerAccounts[a.code] = { code: a.code, name: a.name, nameTh: a.nameTh || a.name, parentCode: a.parentCode || null };
    });

    const isResult = { revenues, expenses, totalRevenue, totalExpense, netIncome, headerAccounts };
    setCachedReport("income-statement", companyId, { startDate, endDate }, isResult);
    logReportTiming("income-statement", companyId, performance.now() - _t0, isResult?.revenue?.length ?? null, false, { startDate, endDate });
    res.json(isResult);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Balance Sheet (งบแสดงฐานะทางการเงิน) — optimized: SQL aggregate
app.get("/api/reports/balance-sheet", requireAuth, requireModule("accounting"), async (req, res) => {
  try {
    const _t0 = performance.now();
    const companyId = Number(req.query.companyId);
    const asOfDate = req.query.asOfDate as string;
    if (!companyId || !asOfDate) return res.status(400).json({ message: "companyId, asOfDate required" });

    const cachedBS = getCachedReport("balance-sheet", companyId, { asOfDate });
    if (cachedBS) { logReportTiming("balance-sheet", companyId, performance.now() - _t0, null, true, { asOfDate }); return res.json(cachedBS); }

    const user = req.user as any;
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
    if (company && company.tenantId && company.tenantId !== user.tenantId) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });

    const [allAccounts, allRows] = await Promise.all([
      db.select().from(accounts).where(eq(accounts.companyId, companyId)).orderBy(accounts.code),
      getAccountBalances(companyId, null, asOfDate),
    ]);
    const balMap = balanceMapFromRows(allRows);

    const calcBalance = (acct: any) => {
      const bal = balMap.get(acct.id) || { debit: 0, credit: 0 };
      let balance: number;
      if (acct.type === "asset" || acct.type === "expense") {
        balance = bal.debit - bal.credit;
      } else {
        balance = bal.credit - bal.debit;
      }
      return { ...acct, balance };
    };

    const assets = allAccounts.filter(a => a.type === "asset").map(calcBalance).filter(r => r.balance !== 0);
    const liabilities = allAccounts.filter(a => a.type === "liability").map(calcBalance).filter(r => r.balance !== 0);
    const equityAccounts = allAccounts.filter(a => a.type === "equity").map(calcBalance);

    const totalRevenue = allAccounts.filter(a => a.type === "revenue").reduce((s, a) => {
      const bal = balMap.get(a.id) || { debit: 0, credit: 0 };
      return s + (bal.credit - bal.debit);
    }, 0);
    const totalExpense = allAccounts.filter(a => a.type === "expense").reduce((s, a) => {
      const bal = balMap.get(a.id) || { debit: 0, credit: 0 };
      return s + (bal.debit - bal.credit);
    }, 0);
    const retainedEarnings = totalRevenue - totalExpense;

    const equityWithRetained = [...equityAccounts.filter(r => r.balance !== 0)];
    if (retainedEarnings !== 0) {
      equityWithRetained.push({
        id: -1, companyId, code: "RE", name: "Retained Earnings", nameTh: "กำไร(ขาดทุน)สะสม", nameZh: null,
        type: "equity", parentCode: null, active: true, balance: retainedEarnings,
      } as any);
    }

    const totalAssets = assets.reduce((s, a) => s + a.balance, 0);
    const totalLiabilities = liabilities.reduce((s, a) => s + a.balance, 0);
    const totalEquity = equityWithRetained.reduce((s, a) => s + a.balance, 0);

    const bsResult = {
      assets, liabilities, equity: equityWithRetained,
      totalAssets, totalLiabilities, totalEquity,
      totalLiabilitiesAndEquity: totalLiabilities + totalEquity,
    };
    setCachedReport("balance-sheet", companyId, { asOfDate }, bsResult);
    logReportTiming("balance-sheet", companyId, performance.now() - _t0, bsResult?.assets?.length ?? null, false, { asOfDate });
    res.json(bsResult);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Cash Flow Statement (งบกระแสเงินสด) — optimized: SQL aggregate
app.get("/api/reports/cash-flow", requireAuth, requireModule("accounting"), async (req, res) => {
  try {
    const _t0 = performance.now();
    const companyId = Number(req.query.companyId);
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    if (!companyId || !startDate || !endDate) return res.status(400).json({ message: "companyId, startDate, endDate required" });
    const user = req.user as any;
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
    if (company && company.tenantId && company.tenantId !== user.tenantId) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });

    

    const allAccounts = await db.select().from(accounts).where(eq(accounts.companyId, companyId)).orderBy(accounts.code);
    const [periodRows, priorRows] = await Promise.all([
      getAccountBalances(companyId, startDate, endDate),
      getAccountBalancesBefore(companyId, startDate),
    ]);
    const periodMap = balanceMapFromRows(periodRows);
    const priorMap = balanceMapFromRows(priorRows);

    const getNetChange = (acct: any) => {
      const bal = periodMap.get(acct.id) || { debit: 0, credit: 0 };
      if (acct.type === "asset" || acct.type === "expense") return bal.debit - bal.credit;
      return bal.credit - bal.debit;
    };

    const revenueAccounts = allAccounts.filter(a => a.type === "revenue");
    const expenseAccounts = allAccounts.filter(a => a.type === "expense");
    const netIncome = revenueAccounts.reduce((s, a) => s + getNetChange(a), 0)
                     - expenseAccounts.reduce((s, a) => s + getNetChange(a), 0);

    const assetAccounts = allAccounts.filter(a => a.type === "asset");
    const liabilityAccounts = allAccounts.filter(a => a.type === "liability");

    const cashCodes = ["100", "101", "102"];
    const arCodes = ["112", "120", "123"];
    const apCodes = ["210"];
    const inventoryCodes = ["130"];
    const fixedAssetCodes = ["140", "141", "142", "143", "144", "145", "146", "150", "170", "171", "172", "173", "174", "175", "176", "177", "180"];
    const loanCodes = ["230", "240"];

    const isMatchCode = (code: string, prefixes: string[]) => prefixes.some(p => code.startsWith(p));

    const arChange = assetAccounts.filter(a => isMatchCode(a.code, arCodes)).reduce((s, a) => s + getNetChange(a), 0);
    const inventoryChange = assetAccounts.filter(a => isMatchCode(a.code, inventoryCodes)).reduce((s, a) => s + getNetChange(a), 0);
    const apChange = liabilityAccounts.filter(a => isMatchCode(a.code, apCodes)).reduce((s, a) => s + getNetChange(a), 0);
    const otherCurrentAssets = assetAccounts.filter(a => !isMatchCode(a.code, [...cashCodes, ...arCodes, ...inventoryCodes, ...fixedAssetCodes]))
      .reduce((s, a) => s + getNetChange(a), 0);
    const otherCurrentLiab = liabilityAccounts.filter(a => !isMatchCode(a.code, [...apCodes, ...loanCodes]))
      .reduce((s, a) => s + getNetChange(a), 0);

    const operating = [
      { label: "กำไร(ขาดทุน)สุทธิ", amount: netIncome },
      { label: "ลูกหนี้การค้าเพิ่มขึ้น(ลดลง)", amount: -arChange },
      { label: "สินค้าคงเหลือเพิ่มขึ้น(ลดลง)", amount: -inventoryChange },
      { label: "เจ้าหนี้การค้าเพิ่มขึ้น(ลดลง)", amount: apChange },
      { label: "สินทรัพย์หมุนเวียนอื่นเพิ่มขึ้น(ลดลง)", amount: -otherCurrentAssets },
      { label: "หนี้สินหมุนเวียนอื่นเพิ่มขึ้น(ลดลง)", amount: otherCurrentLiab },
    ].filter(i => i.amount !== 0);
    const totalOperating = operating.reduce((s, i) => s + i.amount, 0);

    const fixedAssetChange = assetAccounts.filter(a => isMatchCode(a.code, fixedAssetCodes)).reduce((s, a) => s + getNetChange(a), 0);
    const investing = [
      { label: "ซื้อ(ขาย)สินทรัพย์ถาวร", amount: -fixedAssetChange },
    ].filter(i => i.amount !== 0);
    const totalInvesting = investing.reduce((s, i) => s + i.amount, 0);

    const loanChange = liabilityAccounts.filter(a => isMatchCode(a.code, loanCodes)).reduce((s, a) => s + getNetChange(a), 0);
    const equityAccts = allAccounts.filter(a => a.type === "equity");
    const equityChange = equityAccts.reduce((s, a) => s + getNetChange(a), 0);
    const financing = [
      { label: "เงินกู้ยืมเพิ่มขึ้น(ลดลง)", amount: loanChange },
      { label: "ส่วนของผู้ถือหุ้นเพิ่มขึ้น(ลดลง)", amount: equityChange },
    ].filter(i => i.amount !== 0);
    const totalFinancing = financing.reduce((s, i) => s + i.amount, 0);

    const netCashChange = totalOperating + totalInvesting + totalFinancing;

    const beginningCash = assetAccounts.filter(a => isMatchCode(a.code, cashCodes)).reduce((s, a) => {
      const bal = priorMap.get(a.id) || { debit: 0, credit: 0 };
      return s + (bal.debit - bal.credit);
    }, 0);
    const endingCash = beginningCash + netCashChange;

    logReportTiming("cash-flow", companyId, performance.now() - _t0, null, false, { startDate, endDate });
    res.json({
      operating, totalOperating,
      investing, totalInvesting,
      financing, totalFinancing,
      netCashChange, beginningCash, endingCash,
    });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Income Statement Compare — optimized: SQL aggregate
app.get("/api/reports/income-statement-compare", requireAuth, requireModule("accounting"), async (req, res) => {
  try {
    const _t0 = performance.now();
    const companyId = Number(req.query.companyId);
    const startDate1 = req.query.startDate1 as string;
    const endDate1 = req.query.endDate1 as string;
    const startDate2 = req.query.startDate2 as string;
    const endDate2 = req.query.endDate2 as string;
    if (!companyId || !startDate1 || !endDate1 || !startDate2 || !endDate2)
      return res.status(400).json({ message: "companyId, startDate1, endDate1, startDate2, endDate2 required" });

    const user = req.user as any;
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
    if (company && company.tenantId && company.tenantId !== user.tenantId) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });

    

    const allAccounts = await db.select().from(accounts).where(eq(accounts.companyId, companyId)).orderBy(accounts.code);
    const [rows1, rows2] = await Promise.all([
      getAccountBalances(companyId, startDate1, endDate1),
      getAccountBalances(companyId, startDate2, endDate2),
    ]);
    const map1 = balanceMapFromRows(rows1);
    const map2 = balanceMapFromRows(rows2);

    const calcBal = (acct: any, bMap: Map<number, {debit: number; credit: number}>) => {
      const b = bMap.get(acct.id) || { debit: 0, credit: 0 };
      return acct.type === "revenue" ? b.credit - b.debit : b.debit - b.credit;
    };

    const buildRows = (type: string) => allAccounts.filter(a => a.type === type).map(a => {
      const v1 = calcBal(a, map1), v2 = calcBal(a, map2);
      return {
        code: a.code, name: a.name, nameTh: a.nameTh,
        period1: v1, period2: v2,
        change: v1 - v2,
        changePct: v2 !== 0 ? ((v1 - v2) / Math.abs(v2)) * 100 : 0,
      };
    }).filter(r => r.period1 !== 0 || r.period2 !== 0);

    const revenues = buildRows("revenue");
    const expenses = buildRows("expense");
    const totalRevP1 = revenues.reduce((s, r) => s + r.period1, 0);
    const totalRevP2 = revenues.reduce((s, r) => s + r.period2, 0);
    const totalExpP1 = expenses.reduce((s, r) => s + r.period1, 0);
    const totalExpP2 = expenses.reduce((s, r) => s + r.period2, 0);

    logReportTiming("income-statement-compare", companyId, performance.now() - _t0, null, false, { fiscalYear });
    res.json({
      revenues, expenses,
      totalRevenue: { period1: totalRevP1, period2: totalRevP2, change: totalRevP1 - totalRevP2, changePct: totalRevP2 !== 0 ? ((totalRevP1 - totalRevP2) / Math.abs(totalRevP2)) * 100 : 0 },
      totalExpense: { period1: totalExpP1, period2: totalExpP2, change: totalExpP1 - totalExpP2, changePct: totalExpP2 !== 0 ? ((totalExpP1 - totalExpP2) / Math.abs(totalExpP2)) * 100 : 0 },
      netIncome: {
        period1: totalRevP1 - totalExpP1, period2: totalRevP2 - totalExpP2,
        change: (totalRevP1 - totalExpP1) - (totalRevP2 - totalExpP2),
        changePct: (totalRevP2 - totalExpP2) !== 0 ? (((totalRevP1 - totalExpP1) - (totalRevP2 - totalExpP2)) / Math.abs(totalRevP2 - totalExpP2)) * 100 : 0,
      },
    });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Balance Sheet Compare — optimized: SQL aggregate
app.get("/api/reports/balance-sheet-compare", requireAuth, requireModule("accounting"), async (req, res) => {
  try {
    const _t0 = performance.now();
    const companyId = Number(req.query.companyId);
    const asOfDate1 = req.query.asOfDate1 as string;
    const asOfDate2 = req.query.asOfDate2 as string;
    if (!companyId || !asOfDate1 || !asOfDate2)
      return res.status(400).json({ message: "companyId, asOfDate1, asOfDate2 required" });

    const user = req.user as any;
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
    if (company && company.tenantId && company.tenantId !== user.tenantId) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });

    

    const allAccounts = await db.select().from(accounts).where(eq(accounts.companyId, companyId)).orderBy(accounts.code);
    const [rows1, rows2] = await Promise.all([
      getAccountBalances(companyId, null, asOfDate1),
      getAccountBalances(companyId, null, asOfDate2),
    ]);
    const map1 = balanceMapFromRows(rows1);
    const map2 = balanceMapFromRows(rows2);

    const calcBal = (acct: any, bMap: Map<number, {debit: number; credit: number}>) => {
      const b = bMap.get(acct.id) || { debit: 0, credit: 0 };
      return (acct.type === "asset" || acct.type === "expense") ? b.debit - b.credit : b.credit - b.debit;
    };

    const buildRows = (type: string) => allAccounts.filter(a => a.type === type).map(a => {
      const v1 = calcBal(a, map1), v2 = calcBal(a, map2);
      return {
        code: a.code, name: a.name, nameTh: a.nameTh,
        period1: v1, period2: v2,
        change: v1 - v2,
        changePct: v2 !== 0 ? ((v1 - v2) / Math.abs(v2)) * 100 : 0,
      };
    }).filter(r => r.period1 !== 0 || r.period2 !== 0);

    const assets = buildRows("asset");
    const liabilities = buildRows("liability");
    const equity = buildRows("equity");
    const sum = (rows: any[], field: string) => rows.reduce((s, r) => s + r[field], 0);

    logReportTiming("balance-sheet-compare", companyId, performance.now() - _t0, null, false, { fiscalYear });
    res.json({
      assets, liabilities, equity,
      totalAssets: { period1: sum(assets, "period1"), period2: sum(assets, "period2"), change: sum(assets, "period1") - sum(assets, "period2"), changePct: sum(assets, "period2") !== 0 ? ((sum(assets, "period1") - sum(assets, "period2")) / Math.abs(sum(assets, "period2"))) * 100 : 0 },
      totalLiabilities: { period1: sum(liabilities, "period1"), period2: sum(liabilities, "period2"), change: sum(liabilities, "period1") - sum(liabilities, "period2"), changePct: sum(liabilities, "period2") !== 0 ? ((sum(liabilities, "period1") - sum(liabilities, "period2")) / Math.abs(sum(liabilities, "period2"))) * 100 : 0 },
      totalEquity: { period1: sum(equity, "period1"), period2: sum(equity, "period2"), change: sum(equity, "period1") - sum(equity, "period2"), changePct: sum(equity, "period2") !== 0 ? ((sum(equity, "period1") - sum(equity, "period2")) / Math.abs(sum(equity, "period2"))) * 100 : 0 },
    });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Income Statement Monthly (12 months breakdown)
  app.get("/api/reports/income-statement-monthly", requireAuth, requireModule("accounting"), async (req, res) => {
    try {
      const companyId = Number(req.query.companyId);
      const year = Number(req.query.year);
      if (!companyId || !year) return res.status(400).json({ message: "companyId, year required" });
      const user = req.user as any;
      const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
      if (company && company.tenantId && company.tenantId !== user.tenantId) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });

      
      const allAccounts = await db.select().from(accounts).where(eq(accounts.companyId, companyId)).orderBy(accounts.code);
      const revenueAccounts = allAccounts.filter(a => a.type === "revenue");
      const expenseAccounts = allAccounts.filter(a => a.type === "expense");

      const months: any[] = [];
      const accountMonthlyData = new Map<number, number[]>();

      for (let m = 1; m <= 12; m++) {
        const startDate = `${year}-${String(m).padStart(2, "0")}-01`;
        const lastDay = new Date(year, m, 0).getDate();
        const endDate = `${year}-${String(m).padStart(2, "0")}-${lastDay}`;
        const rows = await getAccountBalances(companyId, startDate, endDate);
        const bMap = balanceMapFromRows(rows);

        const calcBal = (acct: any) => {
          const b = bMap.get(acct.id) || { debit: 0, credit: 0 };
          return acct.type === "revenue" ? b.credit - b.debit : b.debit - b.credit;
        };

        let totalRevenue = 0, totalExpense = 0;
        revenueAccounts.forEach(a => { totalRevenue += calcBal(a); });
        expenseAccounts.forEach(a => { totalExpense += calcBal(a); });

        [...revenueAccounts, ...expenseAccounts].forEach(a => {
          const val = calcBal(a);
          if (!accountMonthlyData.has(a.id)) accountMonthlyData.set(a.id, new Array(12).fill(0));
          accountMonthlyData.get(a.id)![m - 1] = val;
        });

        months.push({ month: m, totalRevenue, totalExpense, netIncome: totalRevenue - totalExpense });
      }

      const accountDetails = [...revenueAccounts, ...expenseAccounts]
        .map(a => {
          const monthlyVals = accountMonthlyData.get(a.id) || new Array(12).fill(0);
          const total = monthlyVals.reduce((s, v) => s + v, 0);
          return { code: a.code, name: a.name, nameTh: a.nameTh, type: a.type, months: monthlyVals, total };
        })
        .filter(a => a.total !== 0 || a.months.some(v => v !== 0));

      res.json({ year, months, accountDetails });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Balance Sheet Monthly (12 months breakdown)
  app.get("/api/reports/balance-sheet-monthly", requireAuth, requireModule("accounting"), async (req, res) => {
    try {
      const companyId = Number(req.query.companyId);
      const year = Number(req.query.year);
      if (!companyId || !year) return res.status(400).json({ message: "companyId, year required" });
      const user = req.user as any;
      const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
      if (company && company.tenantId && company.tenantId !== user.tenantId) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });

      
      const allAccounts = await db.select().from(accounts).where(eq(accounts.companyId, companyId)).orderBy(accounts.code);

      const months: any[] = [];
      for (let m = 1; m <= 12; m++) {
        const lastDay = new Date(year, m, 0).getDate();
        const asOfDate = `${year}-${String(m).padStart(2, "0")}-${lastDay}`;
        const rows = await getAccountBalances(companyId, null, asOfDate);
        const bMap = balanceMapFromRows(rows);

        const calcBal = (acct: any) => {
          const b = bMap.get(acct.id) || { debit: 0, credit: 0 };
          return (acct.type === "asset" || acct.type === "expense") ? b.debit - b.credit : b.credit - b.debit;
        };

        let totalAssets = 0, totalLiabilities = 0, totalEquity = 0;
        allAccounts.forEach(a => {
          if (a.type === "asset") totalAssets += calcBal(a);
          else if (a.type === "liability") totalLiabilities += calcBal(a);
          else if (a.type === "equity") totalEquity += calcBal(a);
        });

        months.push({ month: m, totalAssets, totalLiabilities, totalEquity });
      }

      res.json({ year, months });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

    // Financial Statement Settings (ตั้งค่างบการเงิน)
app.get("/api/financial-statement-settings/:companyId", requireAuth, async (req, res) => {
  try {
    const companyId = Number(req.params.companyId);
    const user = req.user as any;
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
    if (!company || (company.tenantId && company.tenantId !== user.tenantId)) return res.status(403).json({ message: "ไม่มีสิทธิ์" });
    const [existing] = await db.select().from(financialStatementSettings).where(eq(financialStatementSettings.companyId, companyId)).limit(1);
    res.json(existing || null);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/financial-statement-settings/:companyId", requireAuth, async (req, res) => {
  try {
    const companyId = Number(req.params.companyId);
    const user = req.user as any;
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
    if (!company || (company.tenantId && company.tenantId !== user.tenantId)) return res.status(403).json({ message: "ไม่มีสิทธิ์" });
    const { signerName1, signerTitle1, signerName2, signerTitle2, auditorName, auditorLicense, businessStartDate, businessType, businessTypeDetail, fiscalYearEndMonth, fiscalYearEndDay, registeredCapital, paidUpCapital, shareParValue, numberOfShares } = req.body;
    const safeData = { signerName1, signerTitle1, signerName2, signerTitle2, auditorName, auditorLicense, businessStartDate, businessType, businessTypeDetail, fiscalYearEndMonth, fiscalYearEndDay, registeredCapital, paidUpCapital, shareParValue, numberOfShares };
    const [existing] = await db.select().from(financialStatementSettings).where(eq(financialStatementSettings.companyId, companyId)).limit(1);
    if (existing) {
      const [updated] = await db.update(financialStatementSettings).set({ ...safeData, updatedAt: new Date() }).where(eq(financialStatementSettings.companyId, companyId)).returning();
      res.json(updated);
    } else {
      const [created] = await db.insert(financialStatementSettings).values({ ...safeData, companyId }).returning();
      res.json(created);
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Financial Statement Drafts (ร่างงบการเงิน)
app.get("/api/financial-statement-drafts", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const drafts = await db.select({ id: financialStatementDrafts.id, name: financialStatementDrafts.name, createdAt: financialStatementDrafts.createdAt, updatedAt: financialStatementDrafts.updatedAt }).from(financialStatementDrafts).where(eq(financialStatementDrafts.userId, user.id)).orderBy(desc(financialStatementDrafts.updatedAt));
    res.json(drafts);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/financial-statement-drafts/:id", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const [draft] = await db.select().from(financialStatementDrafts).where(and(eq(financialStatementDrafts.id, Number(req.params.id)), eq(financialStatementDrafts.userId, user.id))).limit(1);
    if (!draft) return res.status(404).json({ message: "ไม่พบร่างงบ" });
    res.json(draft);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/financial-statement-drafts", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const { name, data } = req.body;
    if (!name || !data) return res.status(400).json({ message: "name, data required" });
    const [created] = await db.insert(financialStatementDrafts).values({ userId: user.id, name, data }).returning();
    res.json(created);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/financial-statement-drafts/:id", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const id = Number(req.params.id);
    const [existing] = await db.select().from(financialStatementDrafts).where(and(eq(financialStatementDrafts.id, id), eq(financialStatementDrafts.userId, user.id))).limit(1);
    if (!existing) return res.status(404).json({ message: "ไม่พบร่างงบ" });
    { const ac = await checkDocOwnership(existing.companyId, req.user); if (!ac.allowed) return res.status(403).json({ message: ac.message }); }
    const { name, data } = req.body;
    const updates: any = { updatedAt: new Date() };
    if (name) updates.name = name;
    if (data) updates.data = data;
    const [updated] = await db.update(financialStatementDrafts).set(updates).where(and(eq(financialStatementDrafts.id, id), eq(financialStatementDrafts.userId, user.id))).returning();
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/financial-statement-drafts/:id", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const id = Number(req.params.id);
    const [existing] = await db.select().from(financialStatementDrafts).where(and(eq(financialStatementDrafts.id, id), eq(financialStatementDrafts.userId, user.id))).limit(1);
    if (!existing) return res.status(404).json({ message: "ไม่พบร่างงบ" });
    { const ac = await checkDocOwnership(existing.companyId, req.user); if (!ac.allowed) return res.status(403).json({ message: ac.message }); }
    await db.delete(financialStatementDrafts).where(and(eq(financialStatementDrafts.id, id), eq(financialStatementDrafts.userId, user.id)));
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Financial Statements Package (งบการเงินฉบับเต็ม - 4 งบ)
app.get("/api/reports/financial-statements-package", requireAuth, requireModule("accounting"), async (req, res) => {
  try {
    const _t0 = performance.now();
    const companyId = Number(req.query.companyId);
    const fiscalYear = Number(req.query.fiscalYear);
    if (!companyId || !fiscalYear) return res.status(400).json({ message: "companyId, fiscalYear required" });
    const user = req.user as any;
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
    if (!company || (company.tenantId && company.tenantId !== user.tenantId)) return res.status(403).json({ message: "ไม่มีสิทธิ์" });

    const yearEnd = `${fiscalYear}-12-31`;
    const yearStart = `${fiscalYear}-01-01`;
    const prevYearEnd = `${fiscalYear - 1}-12-31`;
    const prevYearStart = `${fiscalYear - 1}-01-01`;

    const allAccounts = await db.select().from(accounts).where(eq(accounts.companyId, companyId)).orderBy(accounts.code);

    

    const [curBalRows, prevBalRows, curPeriodRows, prevPeriodRows] = await Promise.all([
      getAccountBalances(companyId, null, yearEnd),
      getAccountBalances(companyId, null, prevYearEnd),
      getAccountBalances(companyId, yearStart, yearEnd),
      getAccountBalances(companyId, prevYearStart, prevYearEnd),
    ]);
    const curBalMap = balanceMapFromRows(curBalRows);
    const prevBalMap = balanceMapFromRows(prevBalRows);
    const curPeriodMap = balanceMapFromRows(curPeriodRows);
    const prevPeriodMap = balanceMapFromRows(prevPeriodRows);

    const curBal = (acct: any) => {
      const b = curBalMap.get(acct.id) || { debit: 0, credit: 0 };
      return (acct.type === "asset" || acct.type === "expense") ? b.debit - b.credit : b.credit - b.debit;
    };
    const prevBal = (acct: any) => {
      const b = prevBalMap.get(acct.id) || { debit: 0, credit: 0 };
      return (acct.type === "asset" || acct.type === "expense") ? b.debit - b.credit : b.credit - b.debit;
    };
    const curPeriod = (acct: any) => {
      const b = curPeriodMap.get(acct.id) || { debit: 0, credit: 0 };
      return acct.type === "revenue" ? b.credit - b.debit : b.debit - b.credit;
    };
    const prevPeriod = (acct: any) => {
      const b = prevPeriodMap.get(acct.id) || { debit: 0, credit: 0 };
      return acct.type === "revenue" ? b.credit - b.debit : b.debit - b.credit;
    };

    const currentAssetCodes = ["100", "110", "120", "130"];
    const nonCurrentAssetCodes = ["140", "150", "160"];
    const currentLiabCodes = ["200", "210", "220", "230"];
    const nonCurrentLiabCodes = ["240"];

    const isInGroup = (code: string, groupCodes: string[]) => groupCodes.some(g => code === g || code.startsWith(g));

    const buildGroupRows = (accts: any[], calcCur: Function, calcPrev: Function) => {
      return accts.filter(a => !a.parentCode || !accts.some(p => p.code === a.parentCode && a.parentCode !== null && accts.some(pp => pp.code === a.code && pp.parentCode))).map(a => {
        const children = accts.filter(c => c.parentCode === a.code);
        if (children.length > 0) {
          const curVal = children.reduce((s: number, c: any) => s + calcCur(c), 0);
          const prevVal = children.reduce((s: number, c: any) => s + calcPrev(c), 0);
          if (curVal === 0 && prevVal === 0) return null;
          return { code: a.code, name: a.nameTh || a.name, current: curVal, previous: prevVal, isHeader: true };
        } else {
          const curVal = calcCur(a);
          const prevVal = calcPrev(a);
          if (curVal === 0 && prevVal === 0) return null;
          return { code: a.code, name: a.nameTh || a.name, current: curVal, previous: prevVal, isHeader: false };
        }
      }).filter(Boolean);
    };

    const headerAccounts = allAccounts.filter(a => {
      const hasChildren = allAccounts.some(c => c.parentCode === a.code);
      return hasChildren && !a.parentCode;
    });

    const buildSection = (type: string, groupCodes: string[], calcCur: Function, calcPrev: Function) => {
      const sectionHeaders = headerAccounts.filter(h => h.type === type && isInGroup(h.code, groupCodes));
      const rows: any[] = [];
      sectionHeaders.forEach(header => {
        const children = allAccounts.filter(c => {
          let p = c.parentCode;
          while (p) {
            if (p === header.code) return true;
            const parent = allAccounts.find(a => a.code === p);
            p = parent?.parentCode || null;
          }
          return false;
        });
        const leafChildren = children.filter(c => !allAccounts.some(x => x.parentCode === c.code));
        const curVal = leafChildren.reduce((s: number, c: any) => s + calcCur(c), 0);
        const prevVal = leafChildren.reduce((s: number, c: any) => s + calcPrev(c), 0);
        if (curVal !== 0 || prevVal !== 0) {
          rows.push({ code: header.code, name: header.nameTh || header.name, current: curVal, previous: prevVal });
        }
      });
      const total = { current: rows.reduce((s, r) => s + r.current, 0), previous: rows.reduce((s, r) => s + r.previous, 0) };
      return { rows, total };
    };

    const currentAssets = buildSection("asset", currentAssetCodes, curBal, prevBal);
    const nonCurrentAssets = buildSection("asset", nonCurrentAssetCodes, curBal, prevBal);
    const currentLiabilities = buildSection("liability", currentLiabCodes, curBal, prevBal);
    const nonCurrentLiabilities = buildSection("liability", nonCurrentLiabCodes, curBal, prevBal);

    const equityHeaders = headerAccounts.filter(h => h.type === "equity");
    const equityRows: any[] = [];
    equityHeaders.forEach(header => {
      const children = allAccounts.filter(c => {
        let p = c.parentCode;
        while (p) { if (p === header.code) return true; const parent = allAccounts.find(a => a.code === p); p = parent?.parentCode || null; }
        return false;
      });
      const leafChildren = children.filter(c => !allAccounts.some(x => x.parentCode === c.code));
      const curVal = leafChildren.reduce((s: number, c: any) => s + curBal(c), 0);
      const prevVal = leafChildren.reduce((s: number, c: any) => s + prevBal(c), 0);
      if (curVal !== 0 || prevVal !== 0) {
        equityRows.push({ code: header.code, name: header.nameTh || header.name, current: curVal, previous: prevVal });
      }
    });

    const revenueAccts = allAccounts.filter(a => a.type === "revenue");
    const expenseAccts = allAccounts.filter(a => a.type === "expense");
    const curNetIncome = revenueAccts.reduce((s, a) => s + curPeriod(a), 0) - expenseAccts.reduce((s, a) => s + curPeriod(a), 0);
    const prevNetIncome = revenueAccts.reduce((s, a) => s + prevPeriod(a), 0) - expenseAccts.reduce((s, a) => s + prevPeriod(a), 0);

    const currentYearPLRow = equityRows.find(r => r.code === "320");
    if (currentYearPLRow) {
      const idx = equityRows.indexOf(currentYearPLRow);
      equityRows.splice(idx, 1);
    }

    const [fsSettingsEq] = await db.select().from(financialStatementSettings).where(eq(financialStatementSettings.companyId, companyId));
    const settingsPaidUpEq = parseFloat(fsSettingsEq?.paidUpCapital || "0");

    const capitalInEquity = equityRows.find(r => r.code === "300");
    if (capitalInEquity) {
      if (capitalInEquity.current === 0 && settingsPaidUpEq > 0) capitalInEquity.current = settingsPaidUpEq;
      if (capitalInEquity.previous === 0 && settingsPaidUpEq > 0) capitalInEquity.previous = settingsPaidUpEq;
    } else if (settingsPaidUpEq > 0) {
      equityRows.unshift({ code: "300", name: "ทุนเรือนหุ้น", current: settingsPaidUpEq, previous: settingsPaidUpEq });
    }

    const retainedInEquity = equityRows.find(r => r.code === "310");
    if (retainedInEquity) {
      retainedInEquity.current += curNetIncome;
      retainedInEquity.previous += prevNetIncome;
      retainedInEquity.name = "กำไรสะสมยังไม่ได้จัดสรร";
    } else {
      equityRows.push({ code: "RE", name: "กำไรสะสมยังไม่ได้จัดสรร", current: curNetIncome, previous: prevNetIncome });
    }

    const totalEquity = { current: equityRows.reduce((s, r) => s + r.current, 0), previous: equityRows.reduce((s, r) => s + r.previous, 0) };

    const totalAssets = { current: currentAssets.total.current + nonCurrentAssets.total.current, previous: currentAssets.total.previous + nonCurrentAssets.total.previous };
    const totalLiabilities = { current: currentLiabilities.total.current + nonCurrentLiabilities.total.current, previous: currentLiabilities.total.previous + nonCurrentLiabilities.total.previous };
    const totalLiabAndEquity = { current: totalLiabilities.current + totalEquity.current, previous: totalLiabilities.previous + totalEquity.previous };

    const revenueHeaders = headerAccounts.filter(h => h.type === "revenue");
    const serviceRevRows: any[] = [];
    const otherRevRows: any[] = [];
    revenueHeaders.forEach(header => {
      const children = allAccounts.filter(c => { let p = c.parentCode; while (p) { if (p === header.code) return true; const parent = allAccounts.find(a => a.code === p); p = parent?.parentCode || null; } return false; });
      const leafChildren = children.filter(c => !allAccounts.some(x => x.parentCode === c.code));
      const curVal = leafChildren.reduce((s: number, c: any) => s + curPeriod(c), 0);
      const prevVal = leafChildren.reduce((s: number, c: any) => s + prevPeriod(c), 0);
      if (curVal !== 0 || prevVal !== 0) {
        const row = { code: header.code, name: header.nameTh || header.name, current: curVal, previous: prevVal };
        if (header.code === "490") otherRevRows.push(row);
        else serviceRevRows.push(row);
      }
    });

    const expenseHeaders = headerAccounts.filter(h => h.type === "expense");
    const costRows: any[] = [];
    const adminExpRows: any[] = [];
    const financeRows: any[] = [];
    const taxRows: any[] = [];
    expenseHeaders.forEach(header => {
      const children = allAccounts.filter(c => { let p = c.parentCode; while (p) { if (p === header.code) return true; const parent = allAccounts.find(a => a.code === p); p = parent?.parentCode || null; } return false; });
      const leafChildren = children.filter(c => !allAccounts.some(x => x.parentCode === c.code));
      const curVal = leafChildren.reduce((s: number, c: any) => s + curPeriod(c), 0);
      const prevVal = leafChildren.reduce((s: number, c: any) => s + prevPeriod(c), 0);
      if (curVal !== 0 || prevVal !== 0) {
        const row = { code: header.code, name: header.nameTh || header.name, current: curVal, previous: prevVal };
        if (header.code.startsWith("5") && parseInt(header.code) < 520) costRows.push(row);
        else if (header.code === "560" || header.code === "570") financeRows.push(row);
        else if (header.code === "580") taxRows.push(row);
        else adminExpRows.push(row);
      }
    });

    const totalRevenue = { current: serviceRevRows.reduce((s, r) => s + r.current, 0) + otherRevRows.reduce((s, r) => s + r.current, 0), previous: serviceRevRows.reduce((s, r) => s + r.previous, 0) + otherRevRows.reduce((s, r) => s + r.previous, 0) };
    const totalCost = { current: costRows.reduce((s, r) => s + r.current, 0), previous: costRows.reduce((s, r) => s + r.previous, 0) };
    const totalAdmin = { current: adminExpRows.reduce((s, r) => s + r.current, 0), previous: adminExpRows.reduce((s, r) => s + r.previous, 0) };
    const totalFinance = { current: financeRows.reduce((s, r) => s + r.current, 0), previous: financeRows.reduce((s, r) => s + r.previous, 0) };
    const totalTax = { current: taxRows.reduce((s, r) => s + r.current, 0), previous: taxRows.reduce((s, r) => s + r.previous, 0) };
    const totalExpenses = { current: totalCost.current + totalAdmin.current, previous: totalCost.previous + totalAdmin.previous };
    const profitBeforeFinance = { current: totalRevenue.current - totalExpenses.current, previous: totalRevenue.previous - totalExpenses.previous };
    const profitBeforeTax = { current: profitBeforeFinance.current - totalFinance.current, previous: profitBeforeFinance.previous - totalFinance.previous };
    const netProfit = { current: profitBeforeTax.current - totalTax.current, previous: profitBeforeTax.previous - totalTax.previous };

    const prevPrevYearEnd = `${fiscalYear - 2}-12-31`;
    const prevPrevBal = await getBalancesAsOf(prevPrevYearEnd);
    const getEquityTotal = (calcFn: Function) => {
      let total = 0;
      equityHeaders.forEach(header => {
        const children = allAccounts.filter(c => { let p = c.parentCode; while (p) { if (p === header.code) return true; const parent = allAccounts.find(a => a.code === p); p = parent?.parentCode || null; } return false; });
        const leafChildren = children.filter(c => !allAccounts.some(x => x.parentCode === c.code));
        total += leafChildren.reduce((s: number, c: any) => s + calcFn(c), 0);
      });
      return total;
    };

    const getCapital = (calcFn: Function) => {
      const capHeader = allAccounts.find(a => a.type === "equity" && a.code === "300");
      if (!capHeader) return 0;
      const children = allAccounts.filter(c => { let p = c.parentCode; while (p) { if (p === "300") return true; const parent = allAccounts.find(a => a.code === p); p = parent?.parentCode || null; } return false; });
      const leafChildren = children.filter(c => !allAccounts.some(x => x.parentCode === c.code));
      return leafChildren.reduce((s: number, c: any) => s + calcFn(c), 0);
    };

    let capitalPrevPrev = getCapital(prevPrevBal);
    let capitalPrev = getCapital(prevBal);
    let capitalCur = getCapital(curBal);

    const [fsSettings] = await db.select().from(financialStatementSettings).where(eq(financialStatementSettings.companyId, companyId));
    const settingsPaidUp = parseFloat(fsSettings?.paidUpCapital || "0");
    if (settingsPaidUp > 0) {
      if (capitalCur === 0) capitalCur = settingsPaidUp;
      if (capitalPrev === 0) capitalPrev = settingsPaidUp;
      if (capitalPrevPrev === 0) capitalPrevPrev = settingsPaidUp;
    }

    const retainedPrevPrev = getEquityTotal(prevPrevBal) - capitalPrevPrev;

    const equityChanges = {
      beginPrev: { capital: capitalPrevPrev, retained: retainedPrevPrev, total: capitalPrevPrev + retainedPrevPrev },
      netIncomePrev: prevNetIncome,
      endPrev: { capital: capitalPrev, retained: retainedPrevPrev + prevNetIncome + (capitalPrev - capitalPrevPrev), total: capitalPrev + retainedPrevPrev + prevNetIncome + (capitalPrev - capitalPrevPrev) },
      beginCur: { capital: capitalPrev, retained: totalEquity.previous - capitalPrev, total: totalEquity.previous },
      netIncomeCur: curNetIncome,
      endCur: { capital: capitalCur, retained: totalEquity.current - capitalCur, total: totalEquity.current },
    };

    logReportTiming("financial-statements-package", companyId, performance.now() - _t0, null, false, { fiscalYear });
    res.json({
      company: { name: company.name, taxId: company.taxId, address: company.address },
      fiscalYear,
      balanceSheet: {
        currentAssets, nonCurrentAssets, currentLiabilities, nonCurrentLiabilities,
        equityRows, totalAssets, totalLiabilities, totalEquity, totalLiabAndEquity,
      },
      incomeStatement: {
        serviceRevRows, otherRevRows, costRows, adminExpRows, financeRows, taxRows,
        totalRevenue, totalCost, totalAdmin, totalExpenses, totalFinance, totalTax,
        profitBeforeFinance, profitBeforeTax, netProfit,
      },
      equityChanges,
    });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Financial Statements Package - Excel Export
app.get("/api/reports/financial-statements-package/excel", requireAuth, requireModule("accounting"), async (req, res) => {
  try {
    const companyId = Number(req.query.companyId);
    const fiscalYear = Number(req.query.fiscalYear);
    let signerName = (req.query.signerName as string) || "";
    let signerTitle = (req.query.signerTitle as string) || "";
    if (!companyId || !fiscalYear) return res.status(400).json({ message: "companyId, fiscalYear required" });

    const user = req.user as any;
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
    if (!company || (company.tenantId && company.tenantId !== user.tenantId)) return res.status(403).json({ message: "ไม่มีสิทธิ์" });

    if (!signerName) {
      const [fsSettings] = await db.select().from(financialStatementSettings).where(eq(financialStatementSettings.companyId, companyId)).limit(1);
      if (fsSettings) {
        signerName = fsSettings.signerName1 || "";
        signerTitle = fsSettings.signerTitle1 || "กรรมการ";
      }
    }
    if (!signerTitle) signerTitle = "กรรมการ";

    const dataRes = await fetch(`http://localhost:5000/api/reports/financial-statements-package?companyId=${companyId}&fiscalYear=${fiscalYear}`, {
      headers: { cookie: req.headers.cookie || "" },
    });
    const data = await dataRes.json();

    const XLSX = require("xlsx");
    const wb = XLSX.utils.book_new();

    const buddhYear = fiscalYear + 543;
    const prevBuddhYear = fiscalYear + 543 - 1;

    const bsRows: any[][] = [
      [company.name],
      ["งบฐานะการเงิน"],
      [`ณ วันที่ 31 ธันวาคม ${buddhYear}`],
      [],
      ["", "", `${buddhYear}`, `${prevBuddhYear}`],
      ["", "", "บาท", "บาท"],
      ["สินทรัพย์"],
      [],
      ["สินทรัพย์หมุนเวียน"],
    ];
    data.balanceSheet.currentAssets.rows.forEach((r: any) => bsRows.push(["", r.name, r.current, r.previous]));
    bsRows.push(["", "รวมสินทรัพย์หมุนเวียน", data.balanceSheet.currentAssets.total.current, data.balanceSheet.currentAssets.total.previous]);
    bsRows.push(["สินทรัพย์ไม่หมุนเวียน"]);
    data.balanceSheet.nonCurrentAssets.rows.forEach((r: any) => bsRows.push(["", r.name, r.current, r.previous]));
    bsRows.push(["", "รวมสินทรัพย์ไม่หมุนเวียน", data.balanceSheet.nonCurrentAssets.total.current, data.balanceSheet.nonCurrentAssets.total.previous]);
    bsRows.push(["", "รวมสินทรัพย์", data.balanceSheet.totalAssets.current, data.balanceSheet.totalAssets.previous]);
    bsRows.push([]);
    bsRows.push(["หนี้สินและส่วนของผู้ถือหุ้น"]);
    bsRows.push([]);
    bsRows.push(["หนี้สินหมุนเวียน"]);
    data.balanceSheet.currentLiabilities.rows.forEach((r: any) => bsRows.push(["", r.name, r.current, r.previous]));
    bsRows.push(["", "รวมหนี้สินหมุนเวียน", data.balanceSheet.currentLiabilities.total.current, data.balanceSheet.currentLiabilities.total.previous]);
    bsRows.push(["หนี้สินไม่หมุนเวียน"]);
    data.balanceSheet.nonCurrentLiabilities.rows.forEach((r: any) => bsRows.push(["", r.name, r.current, r.previous]));
    bsRows.push(["", "รวมหนี้สินไม่หมุนเวียน", data.balanceSheet.nonCurrentLiabilities.total.current, data.balanceSheet.nonCurrentLiabilities.total.previous]);
    bsRows.push(["", "รวมหนี้สิน", data.balanceSheet.totalLiabilities.current, data.balanceSheet.totalLiabilities.previous]);
    bsRows.push(["ส่วนของผู้ถือหุ้น"]);
    data.balanceSheet.equityRows.forEach((r: any) => bsRows.push(["", r.name, r.current, r.previous]));
    bsRows.push(["", "รวมส่วนของผู้ถือหุ้น", data.balanceSheet.totalEquity.current, data.balanceSheet.totalEquity.previous]);
    bsRows.push(["", "รวมหนี้สินและส่วนของผู้ถือหุ้น", data.balanceSheet.totalLiabAndEquity.current, data.balanceSheet.totalLiabAndEquity.previous]);
    bsRows.push([]);
    if (signerName) {
      bsRows.push([], ["", "ขอรับรองว่าถูกต้อง"], [], ["", `(${signerName})`], ["", signerTitle]);
    }

    const bsSheet = XLSX.utils.aoa_to_sheet(bsRows);
    bsSheet["!cols"] = [{ wch: 5 }, { wch: 45 }, { wch: 18 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, bsSheet, "งบฐานะการเงิน");

    const isRows: any[][] = [
      [company.name],
      ["งบกำไรขาดทุน"],
      [`สำหรับปีสิ้นสุดวันที่ 31 ธันวาคม ${buddhYear}`],
      [],
      ["", `${buddhYear}`, `${prevBuddhYear}`],
      ["", "บาท", "บาท"],
      ["รายได้"],
    ];
    data.incomeStatement.serviceRevRows.forEach((r: any) => isRows.push([r.name, r.current, r.previous]));
    data.incomeStatement.otherRevRows.forEach((r: any) => isRows.push([r.name, r.current, r.previous]));
    isRows.push(["รวมรายได้", data.incomeStatement.totalRevenue.current, data.incomeStatement.totalRevenue.previous]);
    isRows.push(["ค่าใช้จ่าย"]);
    data.incomeStatement.costRows.forEach((r: any) => isRows.push([r.name, r.current, r.previous]));
    data.incomeStatement.adminExpRows.forEach((r: any) => isRows.push([r.name, r.current, r.previous]));
    isRows.push(["รวมค่าใช้จ่าย", data.incomeStatement.totalExpenses.current, data.incomeStatement.totalExpenses.previous]);
    isRows.push(["กำไรก่อนต้นทุนทางการเงินและภาษีเงินได้", data.incomeStatement.profitBeforeFinance.current, data.incomeStatement.profitBeforeFinance.previous]);
    data.incomeStatement.financeRows.forEach((r: any) => isRows.push([r.name, -r.current, -r.previous]));
    isRows.push(["กำไรก่อนภาษีเงินได้", data.incomeStatement.profitBeforeTax.current, data.incomeStatement.profitBeforeTax.previous]);
    data.incomeStatement.taxRows.forEach((r: any) => isRows.push([r.name, -r.current, -r.previous]));
    isRows.push(["กำไรสุทธิสำหรับปี", data.incomeStatement.netProfit.current, data.incomeStatement.netProfit.previous]);
    isRows.push([]);
    if (signerName) {
      isRows.push([], ["ขอรับรองว่าถูกต้อง"], [], [`(${signerName})`], [signerTitle]);
    }

    const isSheet = XLSX.utils.aoa_to_sheet(isRows);
    isSheet["!cols"] = [{ wch: 50 }, { wch: 18 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, isSheet, "งบกำไรขาดทุน");

    const ecRows: any[][] = [
      [company.name],
      ["งบการเปลี่ยนแปลงส่วนของผู้ถือหุ้น"],
      [`สำหรับปีสิ้นสุดวันที่ 31 ธันวาคม ${buddhYear}`],
      [],
      ["", "ทุนที่ชำระแล้ว", "กำไรสะสมยังไม่ได้จัดสรร", "รวม"],
      ["", "บาท", "บาท", "บาท"],
      [`ยอดคงเหลือ ณ วันที่ 1 มกราคม ${prevBuddhYear}`, data.equityChanges.beginPrev.capital, data.equityChanges.beginPrev.retained, data.equityChanges.beginPrev.total],
      ["กำไรสุทธิสำหรับปี", "-", data.equityChanges.netIncomePrev, data.equityChanges.netIncomePrev],
      [`ยอดคงเหลือ ณ วันที่ 31 ธันวาคม ${prevBuddhYear}`, data.equityChanges.endPrev.capital, data.equityChanges.endPrev.retained, data.equityChanges.endPrev.total],
      [],
      [`ยอดคงเหลือ ณ วันที่ 1 มกราคม ${buddhYear}`, data.equityChanges.beginCur.capital, data.equityChanges.beginCur.retained, data.equityChanges.beginCur.total],
      ["กำไรสุทธิสำหรับปี", "-", data.equityChanges.netIncomeCur, data.equityChanges.netIncomeCur],
      [`ยอดคงเหลือ ณ วันที่ 31 ธันวาคม ${buddhYear}`, data.equityChanges.endCur.capital, data.equityChanges.endCur.retained, data.equityChanges.endCur.total],
    ];
    ecRows.push([]);
    if (signerName) {
      ecRows.push([], ["ขอรับรองว่าถูกต้อง"], [], [`(${signerName})`], [signerTitle]);
    }

    const ecSheet = XLSX.utils.aoa_to_sheet(ecRows);
    ecSheet["!cols"] = [{ wch: 45 }, { wch: 18 }, { wch: 25 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ecSheet, "งบเปลี่ยนแปลงส่วนผู้ถือหุ้น");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="financial-statements-${fiscalYear}.xlsx"`);
    res.send(buf);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.get("/api/financial-notes", requireAuth, requireModule("accounting"), async (req, res) => {
  try {
    const companyId = Number(req.query.companyId);
    const fiscalYear = Number(req.query.fiscalYear);
    if (!companyId || !fiscalYear) return res.status(400).json({ message: "companyId, fiscalYear required" });
    const user = req.user as any;
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
    if (!company || (company.tenantId && company.tenantId !== user.tenantId)) return res.status(403).json({ message: "ไม่มีสิทธิ์" });
    const notes = await storage.getFinancialNotes(companyId, fiscalYear);
    res.json(notes || null);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post("/api/financial-notes", requireAuth, requireModule("accounting"), async (req, res) => {
  try {
    const { companyId, fiscalYear, sections, status } = req.body;
    if (!companyId || !fiscalYear) return res.status(400).json({ message: "companyId, fiscalYear required" });
    const user = req.user as any;
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
    if (!company || (company.tenantId && company.tenantId !== user.tenantId)) return res.status(403).json({ message: "ไม่มีสิทธิ์" });
    const result = await storage.upsertFinancialNotes(companyId, fiscalYear, sections || [], status);
    res.json(result);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.get("/api/financial-notes/defaults", requireAuth, requireModule("accounting"), async (req, res) => {
  try {
    const companyId = Number(req.query.companyId);
    const fiscalYear = Number(req.query.fiscalYear);
    if (!companyId || !fiscalYear) return res.status(400).json({ message: "companyId, fiscalYear required" });
    const user = req.user as any;
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
    if (!company || (company.tenantId && company.tenantId !== user.tenantId)) return res.status(403).json({ message: "ไม่มีสิทธิ์" });

    const yearStart = `${fiscalYear}-01-01`;
    const yearEnd = `${fiscalYear}-12-31`;

    const allAccounts = await db.select().from(accounts).where(eq(accounts.companyId, companyId)).orderBy(accounts.code);
    const entries = await db.select().from(journalEntries).where(and(eq(journalEntries.companyId, companyId), sql`${journalEntries.entryDate} >= ${yearStart}`, sql`${journalEntries.entryDate} <= ${yearEnd}`));
    const eids = entries.map(e => e.id);
    let jlines: any[] = [];
    if (eids.length > 0) {
      jlines = await db.select({ accountId: journalLines.accountId, debit: journalLines.debit, credit: journalLines.credit })
        .from(journalLines).where(sql`${journalLines.journalEntryId} IN (${sql.join(eids.map(id => sql`${id}`), sql`, `)})`);
    }
    const getBalance = (acct: any) => {
      const al = jlines.filter(l => l.accountId === acct.id);
      const td = al.reduce((s, l) => s + parseFloat(l.debit || "0"), 0);
      const tc = al.reduce((s, l) => s + parseFloat(l.credit || "0"), 0);
      return (acct.type === "asset" || acct.type === "expense") ? td - tc : tc - td;
    };

    const assets = await db.select().from(fixedAssets).where(eq(fixedAssets.companyId, companyId));

    const defaultSections = [
      {
        id: "general_info",
        title: "1. ข้อมูลทั่วไป",
        content: `${company.name || ""}\n` +
          `เลขประจำตัวผู้เสียภาษี: ${company.taxId || "-"}\n` +
          `ที่อยู่: ${company.address || "-"}\n` +
          `ประเภทธุรกิจ: ${company.industry || "-"}\n` +
          `สาขา: ${company.branch || "สำนักงานใหญ่"}\n` +
          `จดทะเบียนภาษีมูลค่าเพิ่ม: ${company.vatRegistered ? "ใช่" : "ไม่ใช่"}${company.vatRegisteredDate ? ` (${company.vatRegisteredDate})` : ""}\n` +
          `สกุลเงินหลัก: ${company.baseCurrency || "THB"}`,
      },
      {
        id: "accounting_basis",
        title: "2. เกณฑ์การจัดทำงบการเงิน",
        content: "งบการเงินนี้จัดทำขึ้นตามมาตรฐานการรายงานทางการเงินสำหรับกิจการที่ไม่มีส่วนได้เสียสาธารณะ (TFRS for NPAEs)\n\nงบการเงินจัดทำขึ้นโดยใช้เกณฑ์ราคาทุนเดิมในการวัดมูลค่าขององค์ประกอบของงบการเงิน เว้นแต่จะได้เปิดเผยไว้เป็นอย่างอื่นในนโยบายการบัญชี\n\nงบการเงินจัดทำขึ้นเป็นภาษาไทยและมีหน่วยเป็นบาท",
      },
      {
        id: "accounting_policies",
        title: "3. นโยบายการบัญชีที่สำคัญ",
        content: "3.1 การรับรู้รายได้\nรายได้จากการขายสินค้ารับรู้เมื่อได้โอนความเสี่ยงและผลตอบแทนที่เป็นสาระสำคัญของความเป็นเจ้าของสินค้าให้กับผู้ซื้อแล้ว\nรายได้จากการให้บริการรับรู้เมื่อผลสำเร็จของรายการนั้นประมาณได้อย่างน่าเชื่อถือ\n\n" +
          "3.2 เงินสดและรายการเทียบเท่าเงินสด\nเงินสดและรายการเทียบเท่าเงินสด หมายถึง เงินสดในมือ เงินฝากธนาคารประเภทเผื่อเรียก และเงินลงทุนระยะสั้นที่มีสภาพคล่องสูง ซึ่งถึงกำหนดจ่ายคืนภายในระยะเวลาไม่เกิน 3 เดือน\n\n" +
          "3.3 ลูกหนี้การค้า\nลูกหนี้การค้าแสดงมูลค่าตามจำนวนเงินในใบแจ้งหนี้ หักค่าเผื่อหนี้สงสัยจะสูญ\n\n" +
          `3.4 สินค้าคงเหลือ\nสินค้าคงเหลือแสดงมูลค่าตามราคาทุนหรือมูลค่าสุทธิที่จะได้รับแล้วแต่ราคาใดจะต่ำกว่า ราคาทุนคำนวณโดยวิธี${company.inventoryCostingMethod === "fifo" ? "เข้าก่อนออกก่อน (FIFO)" : company.inventoryCostingMethod === "weighted_average" ? "ถัวเฉลี่ยถ่วงน้ำหนัก" : "ถัวเฉลี่ยเคลื่อนที่ (Moving Average)"}\n\n` +
          "3.5 ที่ดิน อาคาร และอุปกรณ์\nที่ดิน อาคาร และอุปกรณ์ แสดงมูลค่าตามราคาทุนหักค่าเสื่อมราคาสะสมและค่าเผื่อการด้อยค่า\nค่าเสื่อมราคาคำนวณโดยวิธีเส้นตรงตามอายุการให้ประโยชน์โดยประมาณ\n\n" +
          "3.6 ภาษีเงินได้\nภาษีเงินได้คำนวณจากกำไรทางภาษีตามกฎหมายภาษีอากร",
      },
      {
        id: "cash_and_equivalents",
        title: "4. เงินสดและรายการเทียบเท่าเงินสด",
        content: (() => {
          const cashAccounts = allAccounts.filter(a => a.code?.startsWith("110") || a.code?.startsWith("111"));
          if (cashAccounts.length === 0) return "ไม่มีข้อมูล";
          let text = "";
          let total = 0;
          cashAccounts.forEach(a => {
            const bal = getBalance(a);
            if (bal !== 0) { text += `${a.nameTh || a.name}: ${bal.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท\n`; total += bal; }
          });
          text += `\nรวมเงินสดและรายการเทียบเท่าเงินสด: ${total.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท`;
          return text || "ไม่มีข้อมูล";
        })(),
      },
      {
        id: "trade_receivables",
        title: "5. ลูกหนี้การค้าและลูกหนี้อื่น",
        content: (() => {
          const arAccounts = allAccounts.filter(a => a.code?.startsWith("112") || a.code?.startsWith("113"));
          if (arAccounts.length === 0) return "ไม่มีข้อมูล";
          let text = "";
          let total = 0;
          arAccounts.forEach(a => {
            const bal = getBalance(a);
            if (bal !== 0) { text += `${a.nameTh || a.name}: ${bal.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท\n`; total += bal; }
          });
          text += `\nรวมลูกหนี้การค้าและลูกหนี้อื่น: ${total.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท`;
          return text || "ไม่มีข้อมูล";
        })(),
      },
      {
        id: "inventory",
        title: "6. สินค้าคงเหลือ",
        content: (() => {
          const invAccounts = allAccounts.filter(a => a.code?.startsWith("114") || a.code?.startsWith("115"));
          if (invAccounts.length === 0) return "ไม่มีข้อมูล";
          let text = "";
          let total = 0;
          invAccounts.forEach(a => {
            const bal = getBalance(a);
            if (bal !== 0) { text += `${a.nameTh || a.name}: ${bal.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท\n`; total += bal; }
          });
          text += `\nรวมสินค้าคงเหลือ: ${total.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท`;
          return text || "ไม่มีข้อมูล";
        })(),
      },
      {
        id: "fixed_assets",
        title: "7. ที่ดิน อาคาร และอุปกรณ์",
        content: (() => {
          if (assets.length === 0) {
            const faAccounts = allAccounts.filter(a => a.code?.startsWith("12") || a.code?.startsWith("13"));
            if (faAccounts.length === 0) return "ไม่มีข้อมูล";
            let text = "";
            let total = 0;
            faAccounts.forEach(a => {
              const bal = getBalance(a);
              if (bal !== 0) { text += `${a.nameTh || a.name}: ${bal.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท\n`; total += bal; }
            });
            text += `\nรวมที่ดิน อาคาร และอุปกรณ์สุทธิ: ${total.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท`;
            return text;
          }
          let text = "รายการสินทรัพย์ถาวร:\n";
          let totalCost = 0, totalDepre = 0;
          assets.forEach((a: any) => {
            const cost = parseFloat(a.cost || "0");
            const accDep = parseFloat(a.accumulatedDepreciation || "0");
            totalCost += cost;
            totalDepre += accDep;
            text += `- ${a.name}: ราคาทุน ${cost.toLocaleString("th-TH", { minimumFractionDigits: 2 })} ค่าเสื่อมสะสม ${accDep.toLocaleString("th-TH", { minimumFractionDigits: 2 })} มูลค่าสุทธิ ${(cost - accDep).toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท\n`;
          });
          text += `\nรวมราคาทุน: ${totalCost.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท\nรวมค่าเสื่อมราคาสะสม: ${totalDepre.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท\nมูลค่าสุทธิ: ${(totalCost - totalDepre).toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท`;
          return text;
        })(),
      },
      {
        id: "trade_payables",
        title: "8. เจ้าหนี้การค้าและเจ้าหนี้อื่น",
        content: (() => {
          const apAccounts = allAccounts.filter(a => a.code?.startsWith("211") || a.code?.startsWith("212"));
          if (apAccounts.length === 0) return "ไม่มีข้อมูล";
          let text = "";
          let total = 0;
          apAccounts.forEach(a => {
            const bal = getBalance(a);
            if (bal !== 0) { text += `${a.nameTh || a.name}: ${bal.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท\n`; total += bal; }
          });
          text += `\nรวมเจ้าหนี้การค้าและเจ้าหนี้อื่น: ${total.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท`;
          return text || "ไม่มีข้อมูล";
        })(),
      },
      {
        id: "revenue",
        title: "9. รายได้",
        content: (() => {
          const revAccounts = allAccounts.filter(a => a.code?.startsWith("4"));
          if (revAccounts.length === 0) return "ไม่มีข้อมูล";
          let text = "";
          let total = 0;
          revAccounts.forEach(a => {
            const bal = getBalance(a);
            if (bal !== 0) { text += `${a.nameTh || a.name}: ${bal.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท\n`; total += bal; }
          });
          text += `\nรวมรายได้: ${total.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท`;
          return text || "ไม่มีข้อมูล";
        })(),
      },
      {
        id: "expenses",
        title: "10. ค่าใช้จ่าย",
        content: (() => {
          const expAccounts = allAccounts.filter(a => a.code?.startsWith("5"));
          if (expAccounts.length === 0) return "ไม่มีข้อมูล";
          let text = "";
          let total = 0;
          expAccounts.forEach(a => {
            const bal = getBalance(a);
            if (bal !== 0) { text += `${a.nameTh || a.name}: ${bal.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท\n`; total += bal; }
          });
          text += `\nรวมค่าใช้จ่าย: ${total.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท`;
          return text || "ไม่มีข้อมูล";
        })(),
      },
      {
        id: "income_tax",
        title: "11. ภาษีเงินได้",
        content: "ภาษีเงินได้นิติบุคคลคำนวณจากกำไรสุทธิทางภาษีตามประมวลรัษฎากร โดยใช้อัตราภาษีที่กำหนดไว้ในพระราชกฤษฎีกาออกตามความในประมวลรัษฎากร",
      },
      {
        id: "related_party",
        title: "12. รายการกับบุคคลหรือกิจการที่เกี่ยวข้องกัน",
        content: "รายการที่เกี่ยวข้องกัน (ถ้ามี) ระบุรายละเอียดตามความเป็นจริง",
      },
      {
        id: "commitments",
        title: "13. ภาระผูกพันและหนี้สินที่อาจเกิดขึ้น",
        content: "ไม่มีภาระผูกพันและหนี้สินที่อาจเกิดขึ้นที่มีนัยสำคัญ ณ วันที่ในงบการเงิน",
      },
      {
        id: "subsequent_events",
        title: "14. เหตุการณ์ภายหลังรอบระยะเวลารายงาน",
        content: "ไม่มีเหตุการณ์ภายหลังวันที่ในงบการเงินที่มีนัยสำคัญซึ่งต้องปรับปรุงหรือเปิดเผยในงบการเงิน",
      },
      {
        id: "approval",
        title: "15. การอนุมัติงบการเงิน",
        content: `งบการเงินนี้ได้รับอนุมัติให้ออกโดยกรรมการผู้มีอำนาจของ ${company.name || "บริษัท"} เมื่อวันที่ ............`,
      },
    ];

    res.json({ sections: defaultSections });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

const uploadFinancialNotesPdf = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
app.post("/api/financial-notes/import-pdf", requireAuth, requireModule("accounting"), uploadFinancialNotesPdf.single("file"), async (req, res) => {
  try {
    const file = (req as any).file;
    if (!file) return res.status(400).json({ message: "กรุณาอัพโหลดไฟล์ PDF" });

    const useAi = req.body.useAi === "true";

    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs" as any);
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(file.buffer) });
    const pdfDoc = await loadingTask.promise;

    let fullText = "";
    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(" ");
      fullText += pageText + "\n\n";
    }

    if (!fullText.trim()) {
      return res.status(400).json({ message: "ไม่สามารถอ่านข้อความจาก PDF ได้ — อาจเป็นไฟล์ที่เป็นภาพ (scanned PDF)" });
    }

    let sections: { id: string; title: string; content: string }[] = [];

    if (useAi) {
      try {
        const OpenAI = (await import("openai")).default;
        const openai = new OpenAI({
          apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
          baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
        });

        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `คุณเป็นผู้เชี่ยวชาญด้านบัญชีไทย (TFRS/NPAEs) วิเคราะห์เอกสาร "หมายเหตุประกอบงบการเงิน" แล้วแยกเป็น sections ที่มี title กับ content
ตอบเป็น JSON array เท่านั้น: [{"id": "section_1", "title": "1. ข้อมูลทั่วไป", "content": "..."}]
ถ้ามีหัวข้อย่อย ให้รวมอยู่ใน content ของหัวข้อหลัก
id ใช้รูปแบบ section_1, section_2, ...
ตอบ JSON เท่านั้น ห้ามมี markdown code fence`
            },
            {
              role: "user",
              content: `วิเคราะห์หมายเหตุประกอบงบการเงินนี้:\n\n${fullText.substring(0, 12000)}`
            }
          ],
          temperature: 0.2,
          max_tokens: 4000,
        });

        const aiResponse = completion.choices[0]?.message?.content?.trim() || "[]";
        const cleaned = aiResponse.replace(/```json\s*|```\s*/g, "").trim();
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed) && parsed.length > 0) {
          sections = parsed.map((s: any, i: number) => ({
            id: s.id || `section_${i + 1}`,
            title: s.title || `หัวข้อ ${i + 1}`,
            content: s.content || "",
          }));
        }
      } catch (aiErr: any) {
        console.error("AI parsing failed, falling back to regex:", aiErr.message);
      }
    }

    if (sections.length === 0) {
      const lines = fullText.split(/\n/);
      let currentTitle = "";
      let currentContent: string[] = [];
      let sectionCount = 0;

      const sectionHeaderPattern = /^\s*(\d+)\.\s+(.+)/;
      const subHeaderPattern = /^\s*(\d+\.\d+)\s+(.+)/;

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
          if (currentContent.length > 0) currentContent.push("");
          continue;
        }

        const headerMatch = trimmed.match(sectionHeaderPattern);
        if (headerMatch && !trimmed.match(subHeaderPattern)) {
          if (currentTitle && currentContent.length > 0) {
            sectionCount++;
            sections.push({
              id: `imported_${sectionCount}`,
              title: currentTitle,
              content: currentContent.join("\n").trim(),
            });
          }
          currentTitle = trimmed;
          currentContent = [];
        } else {
          currentContent.push(trimmed);
        }
      }

      if (currentTitle && currentContent.length > 0) {
        sectionCount++;
        sections.push({
          id: `imported_${sectionCount}`,
          title: currentTitle,
          content: currentContent.join("\n").trim(),
        });
      }

      if (sections.length === 0) {
        sections.push({
          id: "imported_full",
          title: "หมายเหตุประกอบงบการเงิน (นำเข้าจาก PDF)",
          content: fullText.trim(),
        });
      }
    }

    res.json({ sections, pageCount: pdfDoc.numPages, textLength: fullText.length });
  } catch (err: any) {
    console.error("PDF import error:", err);
    res.status(500).json({ message: err.message });
  }
});

// Sales Tax Report (รายงานภาษีขาย)
app.get("/api/reports/sales-tax", requireAuth, requireModule("accounting"), async (req, res) => {
  try {
    const _t0 = performance.now();
    const companyId = Number(req.query.companyId);
    const month = Number(req.query.month);
    const year = Number(req.query.year);
    const sortBy = (req.query.sortBy as string) || "date";
    const customStart = req.query.startDate as string | undefined;
    const customEnd = req.query.endDate as string | undefined;
    const filterBranch = req.query.branch as string | undefined;
    const filterSellerBranch = req.query.sellerBranch as string | undefined;
    const filterDepartment = req.query.department as string | undefined;
    const filterSalesperson = req.query.salesperson as string | undefined;

    if (!companyId) return res.status(400).json({ message: "companyId required" });
    if (!customStart && (!month || !year)) return res.status(400).json({ message: "companyId, month, year required" });

    const user = req.user as any;
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
    if (company && company.tenantId && company.tenantId !== user.tenantId) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });

    let startDate: string, endDate: string;
    if (customStart && customEnd) {
      startDate = customStart;
      endDate = customEnd;
    } else {
      startDate = `${year}-${String(month).padStart(2, "0")}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    }

    const tivConditions: any[] = [
      eq(taxInvoices.companyId, companyId),
      sql`${taxInvoices.taxInvoiceDate} >= ${startDate}`,
      sql`${taxInvoices.taxInvoiceDate} <= ${endDate}`,
      sql`${taxInvoices.status} != 'cancelled'`,
      sql`${taxInvoices.summaryTaxInvoiceId} IS NULL`,
    ];
    if (filterBranch) tivConditions.push(sql`${taxInvoices.branch} = ${filterBranch}`);
    if (filterSellerBranch) tivConditions.push(sql`${taxInvoices.sellerBranchId} = ${filterSellerBranch}`);
    if (filterDepartment) tivConditions.push(sql`${taxInvoices.department} = ${filterDepartment}`);
    if (filterSalesperson) tivConditions.push(sql`${taxInvoices.salesperson} = ${filterSalesperson}`);

    const cnConditions: any[] = [
      eq(salesCreditNotes.companyId, companyId),
      sql`${salesCreditNotes.creditNoteDate} >= ${startDate}`,
      sql`${salesCreditNotes.creditNoteDate} <= ${endDate}`,
      sql`${salesCreditNotes.status} != 'cancelled'`,
    ];
    if (filterBranch) cnConditions.push(sql`${salesCreditNotes.branch} = ${filterBranch}`);
    if (filterSellerBranch) cnConditions.push(sql`${salesCreditNotes.sellerBranchId} = ${filterSellerBranch}`);

    const [taxInvs, creditNotes] = await Promise.all([
      db.select().from(taxInvoices)
        .where(and(...tivConditions))
        .orderBy(
          sortBy === "number" ? taxInvoices.taxInvoiceNo : taxInvoices.taxInvoiceDate,
          taxInvoices.id,
        ),
      db.select().from(salesCreditNotes)
        .where(and(...cnConditions))
        .orderBy(
          sortBy === "number" ? salesCreditNotes.creditNoteNo : salesCreditNotes.creditNoteDate,
          salesCreditNotes.id,
        ),
    ]);

    const allRows: any[] = [];

    taxInvs.forEach((inv) => {
      const invSubtotal = parseFloat(inv.subtotal || "0");
      const invVat = parseFloat(inv.vatAmount || "0");
      const invTotal = parseFloat(inv.totalAmount || "0");
      const invPriceMode = inv.priceMode || "excluded";
      const taxBase = invPriceMode === "included" ? Math.round((invSubtotal - invVat) * 100) / 100 : invSubtotal;
      allRows.push({
        id: inv.id,
        date: inv.taxInvoiceDate,
        taxInvoiceNo: inv.taxInvoiceNo,
        customerName: inv.customerName,
        customerTaxId: inv.customerTaxId || "-",
        branch: inv.branch || "สำนักงานใหญ่",
        subtotal: taxBase,
        totalAmount: invTotal,
        vatAmount: invVat,
        isCreditNote: false,
        isDebitNote: false,
        isSummaryInvoice: !!inv.isSummaryInvoice,
        posSessionId: inv.posSessionId || null,
        sortDate: inv.taxInvoiceDate,
        sortNo: inv.taxInvoiceNo,
      });
    });

    creditNotes.forEach((cn) => {
      allRows.push({
        date: cn.creditNoteDate,
        taxInvoiceNo: cn.creditNoteNo,
        customerName: cn.customerName,
        customerTaxId: cn.customerTaxId || "-",
        branch: cn.branch || "สำนักงานใหญ่",
        subtotal: -parseFloat(cn.subtotal || "0"),
        totalAmount: -parseFloat(cn.totalAmount || "0"),
        vatAmount: -parseFloat(cn.vatAmount || "0"),
        isCreditNote: true,
        isDebitNote: false,
        refTaxInvoiceNo: cn.refTaxInvoiceNo || null,
        refTaxInvoiceDate: cn.refTaxInvoiceDate || null,
        sortDate: cn.creditNoteDate,
        sortNo: cn.creditNoteNo,
      });
    });

    if (sortBy === "number") {
      allRows.sort((a, b) => (a.sortNo || "").localeCompare(b.sortNo || ""));
    } else {
      allRows.sort((a, b) => (a.sortDate || "").localeCompare(b.sortDate || "") || (a.sortNo || "").localeCompare(b.sortNo || ""));
    }

    const rows = allRows.map((r, idx) => ({ no: idx + 1, ...r }));

    const totalSubtotal = rows.reduce((s, r) => s + r.subtotal, 0);
    const totalVat = rows.reduce((s, r) => s + r.vatAmount, 0);
    const totalAmount = rows.reduce((s, r) => s + r.totalAmount, 0);

    logReportTiming("sales-tax", companyId, performance.now() - _t0, rows?.length ?? null, false, { month, year });
    res.json({ rows, totalSubtotal, totalVat, totalAmount });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Purchase Tax Report (รายงานภาษีซื้อ)
app.get("/api/reports/purchase-tax", requireAuth, requireModule("accounting"), async (req, res) => {
  try {
    const _t0 = performance.now();
    const companyId = Number(req.query.companyId);
    const month = Number(req.query.month);
    const year = Number(req.query.year);
    const sortBy = (req.query.sortBy as string) || "date";
    const customStart = req.query.startDate as string | undefined;
    const customEnd = req.query.endDate as string | undefined;
    const filterBranch = req.query.branch as string | undefined;
    const filterSellerBranch = req.query.sellerBranch as string | undefined;
    const filterDepartment = req.query.department as string | undefined;
    const filterSalesperson = req.query.salesperson as string | undefined;

    if (!companyId) return res.status(400).json({ message: "companyId required" });
    if (!customStart && (!month || !year)) return res.status(400).json({ message: "companyId, month, year required" });

    const user = req.user as any;
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
    if (company && company.tenantId && company.tenantId !== user.tenantId) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });

    let startDate: string, endDate: string;
    if (customStart && customEnd) {
      startDate = customStart;
      endDate = customEnd;
    } else {
      startDate = `${year}-${String(month).padStart(2, "0")}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    }

    const piConditions = [
      eq(purchaseInvoices.companyId, companyId),
      sql`${purchaseInvoices.apDate} >= ${startDate}`,
      sql`${purchaseInvoices.apDate} <= ${endDate}`,
      sql`${purchaseInvoices.status} != 'cancelled'`,
      eq(purchaseInvoices.showInTaxReport, true),
    ];
    if (filterBranch) piConditions.push(sql`${purchaseInvoices.branch} = ${filterBranch}`);
    if (filterSellerBranch) piConditions.push(sql`${purchaseInvoices.sellerBranchId} = ${filterSellerBranch}`);
    if (filterDepartment) piConditions.push(sql`${purchaseInvoices.department} = ${filterDepartment}`);
    if (filterSalesperson) piConditions.push(sql`${purchaseInvoices.salesperson} = ${filterSalesperson}`);

    const expConditions = [
      eq(expenses.companyId, companyId),
      sql`${expenses.expDate} >= ${startDate}`,
      sql`${expenses.expDate} <= ${endDate}`,
      sql`${expenses.status} != 'cancelled'`,
      eq(expenses.showInTaxReport, true),
    ];
    if (filterBranch) expConditions.push(sql`${expenses.branch} = ${filterBranch}`);
    if (filterSellerBranch) expConditions.push(sql`${expenses.sellerBranchId} = ${filterSellerBranch}`);
    if (filterDepartment) expConditions.push(sql`${expenses.department} = ${filterDepartment}`);
    if (filterSalesperson) expConditions.push(sql`${expenses.salesperson} = ${filterSalesperson}`);

    const dnConditions = [
      eq(purchaseDebitNotes.companyId, companyId),
      sql`${purchaseDebitNotes.debitNoteDate} >= ${startDate}`,
      sql`${purchaseDebitNotes.debitNoteDate} <= ${endDate}`,
      sql`${purchaseDebitNotes.status} != 'cancelled'`,
      eq(purchaseDebitNotes.showInTaxReport, true),
    ];
    if (filterBranch) dnConditions.push(sql`${purchaseDebitNotes.branch} = ${filterBranch}`);
    if (filterSellerBranch) dnConditions.push(sql`${purchaseDebitNotes.sellerBranchId} = ${filterSellerBranch}`);

    const [piRows, expRows, dnRows] = await Promise.all([
      db.select().from(purchaseInvoices).where(and(...piConditions)),
      db.select().from(expenses).where(and(...expConditions)),
      db.select().from(purchaseDebitNotes).where(and(...dnConditions)),
    ]);

    const combined: any[] = [];

    for (const pi of piRows) {
      const piVat = parseFloat(pi.vatAmount || "0");
      if (Math.abs(piVat) < 0.005) continue;
      combined.push({
        date: pi.apDate,
        taxInvoiceRef: pi.taxInvoiceRef || "",
        docNo: pi.apNo,
        docType: "PI",
        vendorName: pi.vendorName,
        vendorTaxId: pi.vendorTaxId || "-",
        branch: pi.branch || "สำนักงานใหญ่",
        subtotal: parseFloat(pi.subtotal || "0"),
        vatAmount: piVat,
        totalAmount: parseFloat(pi.totalAmount || "0"),
      });
    }

    const expIds = expRows.map(e => e.id);
    let expItemsByExpId: Record<number, any[]> = {};
    if (expIds.length > 0) {
      const allExpItems = await db.select().from(expenseItems)
        .where(sql`${expenseItems.expenseId} IN (${sql.join(expIds.map(id => sql`${id}`), sql`, `)})`);
      for (const item of allExpItems) {
        if (!expItemsByExpId[item.expenseId]) expItemsByExpId[item.expenseId] = [];
        expItemsByExpId[item.expenseId].push(item);
      }
    }

    const accountCodes = new Set<string>();
    for (const items of Object.values(expItemsByExpId)) {
      for (const item of items) {
        if (item.accountCode) accountCodes.add(item.accountCode);
      }
    }
    let accountTypeMap: Record<string, string> = {};
    if (accountCodes.size > 0) {
      const acctRows = await db.select({ code: accounts.code, type: accounts.type }).from(accounts)
        .where(and(
          eq(accounts.companyId, companyId),
          sql`${accounts.code} IN (${sql.join([...accountCodes].map(c => sql`${c}`), sql`, `)})`
        ));
      for (const a of acctRows) {
        accountTypeMap[a.code] = a.type;
      }
    }

    for (const exp of expRows) {
      const items = expItemsByExpId[exp.id] || [];

      const deductibleItems = items.filter((it: any) => it.vatType !== "vat_non_deductible");
      const allNonDeductible = items.length > 0 && deductibleItems.length === 0;
      if (allNonDeductible) continue;

      let docType = "EXP";
      if (items.length > 0) {
        const hasAsset = items.some((item: any) => {
          const acctType = item.accountCode ? accountTypeMap[item.accountCode] : null;
          return acctType === "asset" || acctType === "fixed_asset" || (acctType && acctType.toLowerCase().includes("asset"));
        });
        if (hasAsset) {
          const allAsset = items.every((item: any) => {
            const acctType = item.accountCode ? accountTypeMap[item.accountCode] : null;
            return acctType === "asset" || acctType === "fixed_asset" || (acctType && acctType.toLowerCase().includes("asset"));
          });
          docType = allAsset ? "ASSET" : "EXP_ASSET";
        }
      }

      let reportSubtotal = parseFloat(exp.subtotal || "0");
      let reportVat = parseFloat(exp.vatAmount || "0");
      if (items.length > 0 && deductibleItems.length < items.length) {
        const deductibleBase = deductibleItems
          .filter((it: any) => it.vatType === "vat7")
          .reduce((s: number, it: any) => s + parseFloat(it.amount || "0"), 0);
        reportSubtotal = deductibleBase;
        reportVat = deductibleBase * 0.07;
      }

      if (Math.abs(reportVat) < 0.005) continue;

      combined.push({
        date: exp.expDate,
        taxInvoiceRef: exp.taxInvoiceRef || "",
        docNo: exp.expNo,
        docType,
        vendorName: exp.vendorName,
        vendorTaxId: exp.vendorTaxId || "-",
        branch: exp.branch || "สำนักงานใหญ่",
        subtotal: reportSubtotal,
        vatAmount: reportVat,
        totalAmount: reportSubtotal + reportVat,
      });
    }

    for (const dn of dnRows) {
      const dnVat = parseFloat(dn.vatAmount || "0");
      if (Math.abs(dnVat) < 0.005) continue;
      const dnSub = parseFloat(dn.subtotal || "0");
      combined.push({
        date: dn.debitNoteDate,
        taxInvoiceRef: dn.taxInvoiceRef || dn.debitNoteNo || "",
        docNo: dn.debitNoteNo,
        docType: "DN",
        vendorName: dn.vendorName,
        vendorTaxId: dn.vendorTaxId || "-",
        branch: dn.branch || "สำนักงานใหญ่",
        subtotal: -dnSub,
        vatAmount: -dnVat,
        totalAmount: -(dnSub + dnVat),
      });
    }

    if (sortBy === "number") {
      combined.sort((a, b) => a.docNo.localeCompare(b.docNo));
    } else {
      combined.sort((a, b) => a.date.localeCompare(b.date));
    }

    const rows = combined.map((r, idx) => ({ ...r, no: idx + 1 }));

    const totalSubtotal = rows.reduce((s, r) => s + r.subtotal, 0);
    const totalVat = rows.reduce((s, r) => s + r.vatAmount, 0);
    const totalAmount = rows.reduce((s, r) => s + r.totalAmount, 0);

    logReportTiming("purchase-tax", companyId, performance.now() - _t0, rows?.length ?? null, false, { month, year });
    res.json({ rows, totalSubtotal, totalVat, totalAmount });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.get("/api/reports/vat-pp30", requireAuth, requireModule("accounting"), async (req, res) => {
  try {
    const _t0 = performance.now();
    const companyId = Number(req.query.companyId);
    const month = Number(req.query.month);
    const year = Number(req.query.year);
    if (!companyId || !month || !year) return res.status(400).json({ message: "companyId, month, year required" });

    const user = req.user as any;
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
    if (company && company.tenantId && company.tenantId !== user.tenantId) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });

    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    const salesRows = await db.select().from(taxInvoices)
      .where(and(
        eq(taxInvoices.companyId, companyId),
        sql`${taxInvoices.taxInvoiceDate} >= ${startDate}`,
        sql`${taxInvoices.taxInvoiceDate} <= ${endDate}`,
        sql`${taxInvoices.status} != 'cancelled'`,
      ));

    const piRows = await db.select().from(purchaseInvoices)
      .where(and(
        eq(purchaseInvoices.companyId, companyId),
        sql`${purchaseInvoices.apDate} >= ${startDate}`,
        sql`${purchaseInvoices.apDate} <= ${endDate}`,
        sql`${purchaseInvoices.status} != 'cancelled'`,
        eq(purchaseInvoices.showInTaxReport, true),
      ));

    const expRows = await db.select().from(expenses)
      .where(and(
        eq(expenses.companyId, companyId),
        sql`${expenses.expDate} >= ${startDate}`,
        sql`${expenses.expDate} <= ${endDate}`,
        sql`${expenses.status} != 'cancelled'`,
        eq(expenses.showInTaxReport, true),
      ));

    const dnPp30Rows = await db.select().from(purchaseDebitNotes)
      .where(and(
        eq(purchaseDebitNotes.companyId, companyId),
        sql`${purchaseDebitNotes.debitNoteDate} >= ${startDate}`,
        sql`${purchaseDebitNotes.debitNoteDate} <= ${endDate}`,
        sql`${purchaseDebitNotes.status} != 'cancelled'`,
        eq(purchaseDebitNotes.showInTaxReport, true),
      ));

    const salesTaxBase = salesRows.reduce((s, r) => s + parseFloat(r.subtotal || "0"), 0);
    const salesVat = salesRows.reduce((s, r) => s + parseFloat(r.vatAmount || "0"), 0);
    const salesCount = salesRows.length;

    const dnTaxBase = dnPp30Rows.reduce((s, r) => s + parseFloat(r.subtotal || "0"), 0);
    const dnVatTotal = dnPp30Rows.reduce((s, r) => s + parseFloat(r.vatAmount || "0"), 0);

    const purchaseTaxBase = [...piRows, ...expRows].reduce((s, r) => s + parseFloat((r as any).subtotal || "0"), 0) - dnTaxBase;
    const purchaseVat = [...piRows, ...expRows].reduce((s, r) => s + parseFloat((r as any).vatAmount || "0"), 0) - dnVatTotal;
    const purchaseCount = piRows.length + expRows.length + dnPp30Rows.length;

    const netVat = salesVat - purchaseVat;

    let carryForwardOverpaid = 0;
    const vatRefundAccRows = await db.select().from(accounts)
      .where(and(
        eq(accounts.companyId, companyId),
        sql`(${accounts.code} = '1306' OR ${accounts.code} = '1306000' OR ${accounts.nameTh} LIKE '%ลูกหนี้สรรพากร%')`,
        sql`${accounts.isHeader} IS NOT TRUE`,
      ));
    if (vatRefundAccRows.length > 0) {
      const vatRefundIds = vatRefundAccRows.map(a => a.id);
      const priorEntries = await db.select({ id: journalEntries.id }).from(journalEntries)
        .where(and(
          eq(journalEntries.companyId, companyId),
          sql`${journalEntries.entryDate} < ${startDate}`,
        ));
      const priorIds = priorEntries.map(e => e.id);
      if (priorIds.length > 0) {
        const priorLines = await db.select().from(journalLines)
          .where(and(
            sql`${journalLines.journalEntryId} IN (${sql.join(priorIds.map(id => sql`${id}`), sql`, `)})`,
            sql`${journalLines.accountId} IN (${sql.join(vatRefundIds.map(id => sql`${id}`), sql`, `)})`,
          ));
        for (const pl of priorLines) {
          carryForwardOverpaid += parseFloat(pl.debit || "0") - parseFloat(pl.credit || "0");
        }
      }
      carryForwardOverpaid = Math.round(carryForwardOverpaid * 100) / 100;
      if (carryForwardOverpaid < 0) carryForwardOverpaid = 0;
    }

    logReportTiming("vat-pp30", companyId, performance.now() - _t0, null, false, { month, year });
    res.json({
      salesTaxBase,
      salesVat,
      salesCount,
      purchaseTaxBase,
      purchaseVat,
      purchaseCount,
      netVat,
      carryForwardOverpaid,
    });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.get("/api/reports/purchase-tax-pending", requireAuth, requireModule("accounting"), async (req, res) => {
  try {
    const companyId = Number(req.query.companyId);
    const asOfDate = req.query.asOfDate as string || new Date().toISOString().slice(0, 10);
    if (!companyId) return res.status(400).json({ message: "companyId required" });
    const rows = await db.execute(sql`
      SELECT pi.ap_date, pi.ap_no, pi.tax_invoice_ref, pi.vendor_name, pi.vendor_tax_id,
             pi.subtotal as base_amount, pi.vat_amount,
             (pi.ap_date::date + INTERVAL '6 months')::date as due_date
      FROM purchase_invoices pi
      WHERE pi.company_id = ${companyId}
        AND pi.vat_amount > 0
        AND pi.status = 'approved'
        AND (pi.ap_date::date + INTERVAL '6 months')::date > ${asOfDate}::date
        AND pi.ap_date::date <= ${asOfDate}::date
      ORDER BY pi.ap_date
    `);
    const mapped = (rows.rows || []).map((r: any) => ({
      invoiceDate: r.ap_date, invoiceNumber: r.tax_invoice_ref || r.ap_no,
      vendorName: r.vendor_name, taxId: r.vendor_tax_id,
      baseAmount: r.base_amount, vatAmount: r.vat_amount,
      dueDate: r.due_date,
    }));
    res.json(mapped);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.get("/api/reports/wht-summary", requireAuth, requireModule("accounting"), async (req, res) => {
  try {
    const companyId = Number(req.query.companyId);
    const pndType = req.query.pndType as string || "3";
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    if (!companyId) return res.status(400).json({ message: "companyId required" });

    let query = sql`
      SELECT wc.cert_date, wc.paid_date, wc.payee_name, wc.payee_tax_id, wc.income_type,
             wc.tax_rate, wc.amount_paid, wc.tax_withheld, wc.form_type
      FROM withholding_tax_certs wc
      WHERE wc.company_id = ${companyId}
    `;
    if (pndType === "3") {
      query = sql`${query} AND (wc.form_type = '3' OR wc.form_type = 'pnd3' OR wc.form_type = 'ภงด.3')`;
    } else if (pndType === "53") {
      query = sql`${query} AND (wc.form_type = '53' OR wc.form_type = 'pnd53' OR wc.form_type = 'ภงด.53')`;
    }
    if (startDate) query = sql`${query} AND wc.cert_date >= ${startDate}::date`;
    if (endDate) query = sql`${query} AND wc.cert_date <= ${endDate}::date`;
    query = sql`${query} ORDER BY wc.cert_date`;

    const rows = await db.execute(query);
    const mapped = (rows.rows || []).map((r: any) => ({
      certDate: r.cert_date, payDate: r.paid_date,
      payeeName: r.payee_name, payeeTaxId: r.payee_tax_id,
      incomeType: r.income_type, whtRate: r.tax_rate,
      paidAmount: r.amount_paid, whtAmount: r.tax_withheld,
    }));
    res.json(mapped);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.get("/api/reports/vat-pp30-from-tb", requireAuth, requireModule("accounting"), async (req, res) => {
  try {
    const companyId = Number(req.query.companyId);
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    if (!companyId) return res.status(400).json({ message: "companyId required" });

    const rows = await db.execute(sql`
      SELECT a.code as account_code,
             COALESCE(a.name_th, a.name) as account_name_th,
             COALESCE(SUM(jl.debit), 0) as total_debit,
             COALESCE(SUM(jl.credit), 0) as total_credit
      FROM journal_lines jl
      JOIN journal_entries je ON je.id = jl.journal_entry_id
      JOIN accounts a ON a.id = jl.account_id
      WHERE je.company_id = ${companyId}
        AND je.status = 'approved'
        AND (a.code LIKE '1432%' OR a.code LIKE '1433%' OR a.code LIKE '2341%' OR a.code LIKE '2342%')
        ${startDate ? sql`AND je.entry_date >= ${startDate}::date` : sql``}
        ${endDate ? sql`AND je.entry_date <= ${endDate}::date` : sql``}
      GROUP BY a.code, a.name_th, a.name
      ORDER BY a.code
    `);

    const salesAccounts: any[] = [];
    const purchaseAccounts: any[] = [];
    let totalSalesVat = 0, totalSalesBase = 0;
    let totalPurchaseVat = 0, totalPurchaseBase = 0;

    for (const r of (rows.rows || [])) {
      const d = Number(r.total_debit) || 0;
      const c = Number(r.total_credit) || 0;
      const code = String(r.account_code);
      if (code.startsWith("2341") || code.startsWith("2342")) {
        const vatAmt = c - d;
        const baseAmt = vatAmt / 0.07;
        salesAccounts.push({ accountCode: code, accountNameTh: r.account_name_th, vatAmount: vatAmt, baseAmount: baseAmt });
        totalSalesVat += vatAmt;
        totalSalesBase += baseAmt;
      } else if (code.startsWith("1432") || code.startsWith("1433")) {
        const vatAmt = d - c;
        const baseAmt = vatAmt / 0.07;
        purchaseAccounts.push({ accountCode: code, accountNameTh: r.account_name_th, vatAmount: vatAmt, baseAmount: baseAmt });
        totalPurchaseVat += vatAmt;
        totalPurchaseBase += baseAmt;
      }
    }

    res.json({
      salesAccounts, purchaseAccounts,
      totalSalesVat, totalSalesBase,
      totalPurchaseVat, totalPurchaseBase,
      netVat: totalSalesVat - totalPurchaseVat,
    });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ========== Sales Summary Report ==========
app.get("/api/reports/sales-summary", requireAuth, requireModule("accounting"), async (req, res) => {
  try {
    const _t0 = performance.now();
    const companyId = Number(req.query.companyId);
    const docType = req.query.docType as string || "taxInvoice";
    const dateFrom = req.query.dateFrom as string || null;
    const dateTo = req.query.dateTo as string || null;
    const groupByParam = req.query.groupBy as string || "employee";
    if (!companyId) return res.status(400).json({ message: "companyId required" });

    const user = req.user as any;
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
    if (company && company.tenantId && company.tenantId !== user.tenantId) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });

    let docs: any[] = [];

    const buildConditions = (table: any, dateCol: any) => {
      const conds: any[] = [eq(table.companyId, companyId), sql`${table.status} != 'cancelled'`];
      if (dateFrom) conds.push(sql`${dateCol} >= ${dateFrom}`);
      if (dateTo) conds.push(sql`${dateCol} <= ${dateTo}`);
      return and(...conds);
    };

    if (docType === "quotation") {
      const rows = await db.select().from(quotations).where(buildConditions(quotations, quotations.quotationDate));
      docs = rows.map((r: any) => ({
        id: r.id, docNo: r.quotationNo, docDate: r.quotationDate,
        customerName: r.customerName, customerId: r.customerId,
        subtotal: r.subtotal, vatAmount: r.vatAmount, totalAmount: r.totalAmount,
        salesperson: r.salesperson, sellerBranchId: r.sellerBranchId, department: r.department, project: r.project,
      }));
    } else if (docType === "salesOrder") {
      const rows = await db.select().from(salesOrders).where(buildConditions(salesOrders, salesOrders.orderDate));
      docs = rows.map((r: any) => ({
        id: r.id, docNo: r.orderNo, docDate: r.orderDate,
        customerName: r.customerName, customerId: r.customerId,
        subtotal: r.subtotal, vatAmount: r.vatAmount, totalAmount: r.totalAmount,
        salesperson: r.salesperson, sellerBranchId: r.sellerBranchId, department: r.department, project: r.project,
      }));
    } else if (docType === "taxInvoice") {
      const rows = await db.select().from(taxInvoices).where(buildConditions(taxInvoices, taxInvoices.taxInvoiceDate));
      docs = rows.map((r: any) => ({
        id: r.id, docNo: r.taxInvoiceNo, docDate: r.taxInvoiceDate,
        customerName: r.customerName, customerId: r.customerId,
        subtotal: r.subtotal, vatAmount: r.vatAmount, totalAmount: r.totalAmount,
        salesperson: r.salesperson, sellerBranchId: r.sellerBranchId, department: r.department, project: r.project,
      }));
    } else if (docType === "invoice") {
      const rows = await db.select().from(invoices).where(buildConditions(invoices, invoices.invoiceDate));
      docs = rows.map((r: any) => ({
        id: r.id, docNo: r.invoiceNo, docDate: r.invoiceDate,
        customerName: r.customerName, customerId: r.customerId,
        subtotal: r.subtotal, vatAmount: r.vatAmount, totalAmount: r.totalAmount,
        salesperson: r.salesperson, sellerBranchId: r.sellerBranchId, department: r.department, project: r.project,
      }));
    }

    let branchMap = new Map<string, string>();
    if (groupByParam === "branch") {
      const allBranches = await db.select().from(branches).where(eq(branches.companyId, companyId));
      allBranches.forEach(b => branchMap.set(b.code, b.name));
    }

    const groupMap = new Map<string, { name: string; count: number; totalAmount: number; items: any[] }>();

    for (const doc of docs) {
      let key = "";
      let name = "";

      if (groupByParam === "employee") {
        key = doc.salesperson || "__none__";
        name = doc.salesperson || "(ไม่ระบุพนักงาน)";
      } else if (groupByParam === "customer") {
        key = doc.customerName || "__none__";
        name = doc.customerName || "(ไม่ระบุลูกค้า)";
      } else if (groupByParam === "branch") {
        const branchCode = doc.sellerBranchId || "__none__";
        key = branchCode;
        name = branchMap.get(branchCode) || branchCode || "(ไม่ระบุสาขา)";
        if (branchCode === "__none__") name = "(ไม่ระบุสาขา)";
      } else if (groupByParam === "department") {
        key = doc.department || "__none__";
        name = doc.department || "(ไม่ระบุแผนก)";
      } else if (groupByParam === "project") {
        key = doc.project || "__none__";
        name = doc.project || "(ไม่ระบุโครงการ)";
      } else if (groupByParam === "product") {
        key = "__all__";
        name = "ทั้งหมด";
      }

      if (!groupMap.has(key)) {
        groupMap.set(key, { name, count: 0, totalAmount: 0, items: [] });
      }
      const g = groupMap.get(key)!;
      g.count++;
      g.totalAmount += parseFloat(doc.totalAmount || "0");
      g.items.push(doc);
    }

    if (groupByParam === "product") {
      groupMap.clear();
      let itemTable: any;
      let parentIdCol: string;
      let docIds = docs.map(d => d.id);
      if (docIds.length === 0) {
    logReportTiming("sales-summary", companyId, performance.now() - _t0, 0, false, { docType, dateFrom, dateTo, groupBy: groupByParam });
        return res.json({ groups: [], summary: { totalDocs: 0, totalAmount: 0, avgAmount: 0 } });
      }

      let lineItems: any[] = [];
      if (docType === "quotation") {
        lineItems = await db.select().from(quotationItems).where(inArray(quotationItems.quotationId, docIds));
        lineItems = lineItems.map((li: any) => ({ ...li, parentDocId: li.quotationId }));
      } else if (docType === "salesOrder") {
        lineItems = await db.select().from(salesOrderItems).where(inArray(salesOrderItems.salesOrderId, docIds));
        lineItems = lineItems.map((li: any) => ({ ...li, parentDocId: li.salesOrderId }));
      } else if (docType === "taxInvoice") {
        lineItems = await db.select().from(taxInvoiceItems).where(inArray(taxInvoiceItems.taxInvoiceId, docIds));
        lineItems = lineItems.map((li: any) => ({ ...li, parentDocId: li.taxInvoiceId }));
      } else if (docType === "invoice") {
        lineItems = await db.select().from(invoiceItems).where(inArray(invoiceItems.invoiceId, docIds));
        lineItems = lineItems.map((li: any) => ({ ...li, parentDocId: li.invoiceId }));
      }

      const docMap = new Map(docs.map(d => [d.id, d]));
      const productGroupMap = new Map<string, { name: string; count: number; totalAmount: number; items: any[] }>();

      for (const li of lineItems) {
        const productName = li.productName || "(ไม่ระบุสินค้า)";
        const key = productName;
        if (!productGroupMap.has(key)) {
          productGroupMap.set(key, { name: productName, count: 0, totalAmount: 0, items: [] });
        }
        const g = productGroupMap.get(key)!;
        const lineTotal = parseFloat(li.total || "0");
        g.totalAmount += lineTotal;
        g.count++;

        const parentDoc = docMap.get(li.parentDocId);
        g.items.push({
          docNo: parentDoc?.docNo || "-",
          docDate: parentDoc?.docDate,
          customerName: parentDoc?.customerName || "-",
          subtotal: li.total,
          vatAmount: "0",
          totalAmount: li.total,
          salesperson: parentDoc?.salesperson || "-",
        });
      }

      const groups = Array.from(productGroupMap.values()).sort((a, b) => b.totalAmount - a.totalAmount);
      const totalDocs = docs.length;
      const totalAmount = docs.reduce((s, d) => s + parseFloat(d.totalAmount || "0"), 0);
      const avgAmount = totalDocs > 0 ? totalAmount / totalDocs : 0;

      return res.json({
        groups,
        summary: { totalDocs, totalAmount, avgAmount },
      });
    }

    const groups = Array.from(groupMap.values()).sort((a, b) => b.totalAmount - a.totalAmount);
    const totalDocs = docs.length;
    const totalAmount = docs.reduce((s, d) => s + parseFloat(d.totalAmount || "0"), 0);
    const avgAmount = totalDocs > 0 ? totalAmount / totalDocs : 0;

    res.json({
      groups,
      summary: { totalDocs, totalAmount, avgAmount },
    });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.get("/api/reports/gross-profit", requireAuth, requireModule("accounting"), async (req, res) => {
  try {
    const _t0 = performance.now();
    const companyId = Number(req.query.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId required" });

    const user = req.user as any;
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
    if (company && company.tenantId && company.tenantId !== user.tenantId) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });

    const dateFrom = req.query.dateFrom as string | undefined;
    const dateTo = req.query.dateTo as string | undefined;
    const customerIdRaw = req.query.customerId as string | undefined;
    const customerId = customerIdRaw && customerIdRaw !== "all" ? Number(customerIdRaw) : undefined;
    const branchIdRaw = req.query.branchId as string | undefined;
    const branchId = branchIdRaw && branchIdRaw !== "all" ? branchIdRaw : undefined;

    const tivConditions: any[] = [
      eq(taxInvoices.companyId, companyId),
      sql`${taxInvoices.status} != 'cancelled'`,
    ];
    if (dateFrom) tivConditions.push(sql`${taxInvoices.taxInvoiceDate} >= ${dateFrom}`);
    if (dateTo) tivConditions.push(sql`${taxInvoices.taxInvoiceDate} <= ${dateTo}`);
    if (customerId) tivConditions.push(eq(taxInvoices.customerId, customerId));
    if (branchId) tivConditions.push(eq(taxInvoices.sellerBranchId, branchId));

    const tivRows = await db.select().from(taxInvoices).where(and(...tivConditions)).orderBy(desc(taxInvoices.taxInvoiceDate));

    const ivConditions: any[] = [
      eq(invoices.companyId, companyId),
      sql`${invoices.status} != 'cancelled'`,
    ];
    if (dateFrom) ivConditions.push(sql`${invoices.invoiceDate} >= ${dateFrom}`);
    if (dateTo) ivConditions.push(sql`${invoices.invoiceDate} <= ${dateTo}`);
    if (customerId) ivConditions.push(eq(invoices.customerId, customerId));
    if (branchId) ivConditions.push(eq(invoices.sellerBranchId, branchId));

    const ivRows = await db.select().from(invoices).where(and(...ivConditions)).orderBy(desc(invoices.invoiceDate));

    const allProducts = await db.select({ id: products.id, cost: products.cost }).from(products).where(eq(products.companyId, companyId));
    const productCostMap = new Map(allProducts.map(p => [p.id, parseFloat(p.cost || "0")]));

    const items: any[] = [];

    for (const tiv of tivRows) {
      const lineItems = await db.select().from(taxInvoiceItems).where(eq(taxInvoiceItems.taxInvoiceId, tiv.id));
      let cost = 0;
      for (const li of lineItems) {
        const qty = parseFloat(li.qty || "0");
        const unitCost = li.productId ? (productCostMap.get(li.productId) || 0) : 0;
        cost += qty * unitCost;
      }
      const revenue = parseFloat(tiv.subtotal || "0");
      const profit = revenue - cost;
      const marginPct = revenue > 0 ? (profit / revenue) * 100 : 0;
      items.push({
        docType: "tax_invoice",
        docNo: tiv.taxInvoiceNo,
        date: tiv.taxInvoiceDate,
        customer: tiv.customerName,
        sellerBranchId: tiv.sellerBranchId,
        revenue,
        cost,
        profit,
        marginPct: Math.round(marginPct * 100) / 100,
      });
    }

    for (const iv of ivRows) {
      const lineItems = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, iv.id));
      let cost = 0;
      for (const li of lineItems) {
        const qty = parseFloat(li.qty || "0");
        const unitCost = li.productId ? (productCostMap.get(li.productId) || 0) : 0;
        cost += qty * unitCost;
      }
      const revenue = parseFloat(iv.subtotal || "0");
      const profit = revenue - cost;
      const marginPct = revenue > 0 ? (profit / revenue) * 100 : 0;
      items.push({
        docType: "invoice",
        docNo: iv.invoiceNo,
        date: iv.invoiceDate,
        customer: iv.customerName,
        sellerBranchId: iv.sellerBranchId,
        revenue,
        cost,
        profit,
        marginPct: Math.round(marginPct * 100) / 100,
      });
    }

    items.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

    const totalRevenue = items.reduce((s, i) => s + i.revenue, 0);
    const totalCost = items.reduce((s, i) => s + i.cost, 0);
    const totalProfit = totalRevenue - totalCost;
    const avgMargin = totalRevenue > 0 ? Math.round(((totalProfit / totalRevenue) * 100) * 100) / 100 : 0;

    logReportTiming("gross-profit", companyId, performance.now() - _t0, items?.length ?? null, false, { dateFrom, dateTo });
    res.json({
      items,
      summary: { totalRevenue, totalCost, totalProfit, avgMargin },
    });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});


  // ========== Sales Line Items Detail (R10) ==========
  app.get("/api/reports/sales-line-items", requireAuth, requireModule("accounting"), async (req, res) => {
    try {
      const companyId = Number(req.query.companyId);
      const dateFrom = req.query.dateFrom as string || null;
      const dateTo = req.query.dateTo as string || null;
      const docType = req.query.docType as string || "taxInvoice";
      if (!companyId) return res.status(400).json({ message: "companyId required" });

      const user = req.user as any;
      const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
      if (company && company.tenantId && company.tenantId !== user.tenantId) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });

      const buildConds = (table: any, dateCol: any) => {
        const c: any[] = [eq(table.companyId, companyId), sql`${table.status} != 'cancelled'`];
        if (dateFrom) c.push(sql`${dateCol} >= ${dateFrom}`);
        if (dateTo) c.push(sql`${dateCol} <= ${dateTo}`);
        return and(...c);
      };

      let docs: any[] = [];
      let lineItems: any[] = [];

      if (docType === "taxInvoice") {
        docs = await db.select().from(taxInvoices).where(buildConds(taxInvoices, taxInvoices.taxInvoiceDate));
        const docIds = docs.map(d => d.id);
        if (docIds.length > 0) lineItems = await db.select().from(taxInvoiceItems).where(inArray(taxInvoiceItems.taxInvoiceId, docIds));
        lineItems = lineItems.map((li: any) => ({ ...li, parentDocId: li.taxInvoiceId }));
      } else if (docType === "invoice") {
        docs = await db.select().from(invoices).where(buildConds(invoices, invoices.invoiceDate));
        const docIds = docs.map(d => d.id);
        if (docIds.length > 0) lineItems = await db.select().from(invoiceItems).where(inArray(invoiceItems.invoiceId, docIds));
        lineItems = lineItems.map((li: any) => ({ ...li, parentDocId: li.invoiceId }));
      } else if (docType === "quotation") {
        docs = await db.select().from(quotations).where(buildConds(quotations, quotations.quotationDate));
        const docIds = docs.map(d => d.id);
        if (docIds.length > 0) lineItems = await db.select().from(quotationItems).where(inArray(quotationItems.quotationId, docIds));
        lineItems = lineItems.map((li: any) => ({ ...li, parentDocId: li.quotationId }));
      } else if (docType === "salesOrder") {
        docs = await db.select().from(salesOrders).where(buildConds(salesOrders, salesOrders.orderDate));
        const docIds = docs.map(d => d.id);
        if (docIds.length > 0) lineItems = await db.select().from(salesOrderItems).where(inArray(salesOrderItems.salesOrderId, docIds));
        lineItems = lineItems.map((li: any) => ({ ...li, parentDocId: li.salesOrderId }));
      }

      const docMap = new Map(docs.map((d: any) => {
        const docNo = d.taxInvoiceNo || d.invoiceNo || d.quotationNo || d.orderNo || "-";
        const docDate = d.taxInvoiceDate || d.invoiceDate || d.quotationDate || d.orderDate;
        return [d.id, { docNo, docDate, customerName: d.customerName || "-", salesperson: d.salesperson || "-", department: d.department || "-", project: d.project || "-" }];
      }));

      const items = lineItems.map((li: any) => {
        const doc = docMap.get(li.parentDocId) || { docNo: "-", docDate: null, customerName: "-", salesperson: "-", department: "-", project: "-" };
        return {
          docNo: doc.docNo, docDate: doc.docDate, customerName: doc.customerName, salesperson: doc.salesperson,
          productCode: li.productCode || "-", productName: li.productName || "-", qty: li.qty, unit: li.unit || "-",
          unitPrice: li.unitPrice, discount: li.discount || "0", total: li.total,
        };
      });

      const totalQty = items.reduce((s: number, i: any) => s + parseFloat(i.qty || "0"), 0);
      const totalAmount = items.reduce((s: number, i: any) => s + parseFloat(i.total || "0"), 0);

      res.json({ items, summary: { totalItems: items.length, totalDocs: docs.length, totalQty, totalAmount } });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ========== Daily Sales Summary (R12) ==========
  app.get("/api/reports/daily-sales-summary", requireAuth, requireModule("accounting"), async (req, res) => {
    try {
      const companyId = Number(req.query.companyId);
      const dateFrom = req.query.dateFrom as string || null;
      const dateTo = req.query.dateTo as string || null;
      const docType = req.query.docType as string || "taxInvoice";
      if (!companyId) return res.status(400).json({ message: "companyId required" });

      const user = req.user as any;
      const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
      if (company && company.tenantId && company.tenantId !== user.tenantId) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });

      let dateCol: any, table: any;
      if (docType === "taxInvoice") { table = taxInvoices; dateCol = taxInvoices.taxInvoiceDate; }
      else if (docType === "invoice") { table = invoices; dateCol = invoices.invoiceDate; }
      else if (docType === "quotation") { table = quotations; dateCol = quotations.quotationDate; }
      else if (docType === "salesOrder") { table = salesOrders; dateCol = salesOrders.orderDate; }
      else { return res.json({ days: [], summary: { totalDocs: 0, totalAmount: 0 } }); }

      const conds: any[] = [eq(table.companyId, companyId), sql`${table.status} != 'cancelled'`];
      if (dateFrom) conds.push(sql`${dateCol} >= ${dateFrom}`);
      if (dateTo) conds.push(sql`${dateCol} <= ${dateTo}`);

      const rows = await db.select({
        day: dateCol,
        count: sql<number>`COUNT(*)::int`,
        totalAmount: sql<string>`COALESCE(SUM(${table.totalAmount}::numeric), 0)`,
        totalVat: sql<string>`COALESCE(SUM(${table.vatAmount}::numeric), 0)`,
        totalSubtotal: sql<string>`COALESCE(SUM(${table.subtotal}::numeric), 0)`,
      }).from(table).where(and(...conds)).groupBy(dateCol).orderBy(dateCol);

      const totalDocs = rows.reduce((s, r) => s + r.count, 0);
      const totalAmount = rows.reduce((s, r) => s + parseFloat(r.totalAmount || "0"), 0);

      res.json({ days: rows, summary: { totalDocs, totalAmount } });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ========== Top Products (R13) ==========
  app.get("/api/reports/top-products", requireAuth, requireModule("accounting"), async (req, res) => {
    try {
      const companyId = Number(req.query.companyId);
      const dateFrom = req.query.dateFrom as string || null;
      const dateTo = req.query.dateTo as string || null;
      const limit = Math.min(Number(req.query.limit) || 20, 100);
      const sortBy = req.query.sortBy as string || "revenue";
      if (!companyId) return res.status(400).json({ message: "companyId required" });

      const user = req.user as any;
      const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
      if (company && company.tenantId && company.tenantId !== user.tenantId) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });

      const conds: any[] = [eq(taxInvoices.companyId, companyId), sql`${taxInvoices.status} != 'cancelled'`];
      if (dateFrom) conds.push(sql`${taxInvoices.taxInvoiceDate} >= ${dateFrom}`);
      if (dateTo) conds.push(sql`${taxInvoices.taxInvoiceDate} <= ${dateTo}`);

      const docIds = (await db.select({ id: taxInvoices.id }).from(taxInvoices).where(and(...conds))).map(r => r.id);
      if (docIds.length === 0) return res.json({ products: [], summary: { totalRevenue: 0, totalQty: 0 } });

      const rows = await db.select({
        productName: taxInvoiceItems.productName,
        productCode: taxInvoiceItems.productCode,
        unit: taxInvoiceItems.unit,
        totalQty: sql<string>`SUM(${taxInvoiceItems.qty}::numeric)`,
        totalRevenue: sql<string>`SUM(${taxInvoiceItems.total}::numeric)`,
        docCount: sql<number>`COUNT(DISTINCT ${taxInvoiceItems.taxInvoiceId})::int`,
      }).from(taxInvoiceItems)
        .where(inArray(taxInvoiceItems.taxInvoiceId, docIds))
        .groupBy(taxInvoiceItems.productName, taxInvoiceItems.productCode, taxInvoiceItems.unit)
        .orderBy(sortBy === "qty" ? sql`SUM(${taxInvoiceItems.qty}::numeric) DESC` : sql`SUM(${taxInvoiceItems.total}::numeric) DESC`)
        .limit(limit);

      const totalRevenue = rows.reduce((s, r) => s + parseFloat(r.totalRevenue || "0"), 0);
      const totalQty = rows.reduce((s, r) => s + parseFloat(r.totalQty || "0"), 0);

      res.json({ products: rows, summary: { totalRevenue, totalQty, totalProducts: rows.length } });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ========== Sales Monthly Comparison (R14) ==========
  app.get("/api/reports/sales-monthly-comparison", requireAuth, requireModule("accounting"), async (req, res) => {
    try {
      const companyId = Number(req.query.companyId);
      const year = Number(req.query.year) || new Date().getFullYear();
      const docType = req.query.docType as string || "taxInvoice";
      if (!companyId) return res.status(400).json({ message: "companyId required" });

      const user = req.user as any;
      const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
      if (company && company.tenantId && company.tenantId !== user.tenantId) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });

      let table: any, dateCol: any;
      if (docType === "taxInvoice") { table = taxInvoices; dateCol = taxInvoices.taxInvoiceDate; }
      else if (docType === "invoice") { table = invoices; dateCol = invoices.invoiceDate; }
      else if (docType === "quotation") { table = quotations; dateCol = quotations.quotationDate; }
      else { table = salesOrders; dateCol = salesOrders.orderDate; }

      const yearStart = `${year}-01-01`;
      const yearEnd = `${year}-12-31`;
      const prevYearStart = `${year - 1}-01-01`;
      const prevYearEnd = `${year - 1}-12-31`;

      const fetchMonthly = async (from: string, to: string) => {
        const conds: any[] = [eq(table.companyId, companyId), sql`${table.status} != 'cancelled'`, sql`${dateCol} >= ${from}`, sql`${dateCol} <= ${to}`];
        return db.select({
          month: sql<number>`EXTRACT(MONTH FROM ${dateCol})::int`,
          count: sql<number>`COUNT(*)::int`,
          totalAmount: sql<string>`COALESCE(SUM(${table.totalAmount}::numeric), 0)`,
        }).from(table).where(and(...conds)).groupBy(sql`EXTRACT(MONTH FROM ${dateCol})`);
      };

      const [currentYear, previousYear] = await Promise.all([
        fetchMonthly(yearStart, yearEnd),
        fetchMonthly(prevYearStart, prevYearEnd),
      ]);

      const months = [];
      for (let m = 1; m <= 12; m++) {
        const cur = currentYear.find(r => r.month === m);
        const prev = previousYear.find(r => r.month === m);
        const curAmt = parseFloat(cur?.totalAmount || "0");
        const prevAmt = parseFloat(prev?.totalAmount || "0");
        const change = prevAmt > 0 ? ((curAmt - prevAmt) / prevAmt) * 100 : curAmt > 0 ? 100 : 0;
        months.push({
          month: m, currentAmount: curAmt, currentCount: cur?.count || 0,
          previousAmount: prevAmt, previousCount: prev?.count || 0,
          changePercent: Math.round(change * 100) / 100,
        });
      }

      res.json({ year, months });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ========== Gross Profit by Product (R15) ==========
  app.get("/api/reports/gross-profit-by-product", requireAuth, requireModule("accounting"), async (req, res) => {
    try {
      const companyId = Number(req.query.companyId);
      const dateFrom = req.query.dateFrom as string || null;
      const dateTo = req.query.dateTo as string || null;
      if (!companyId) return res.status(400).json({ message: "companyId required" });

      const user = req.user as any;
      const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
      if (company && company.tenantId && company.tenantId !== user.tenantId) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });

      const conds: any[] = [eq(taxInvoices.companyId, companyId), sql`${taxInvoices.status} != 'cancelled'`];
      if (dateFrom) conds.push(sql`${taxInvoices.taxInvoiceDate} >= ${dateFrom}`);
      if (dateTo) conds.push(sql`${taxInvoices.taxInvoiceDate} <= ${dateTo}`);

      const docIds = (await db.select({ id: taxInvoices.id }).from(taxInvoices).where(and(...conds))).map(r => r.id);
      if (docIds.length === 0) return res.json({ products: [], summary: { totalRevenue: 0, totalCost: 0, totalProfit: 0, avgMargin: 0 } });

      const salesByProduct = await db.select({
        productName: taxInvoiceItems.productName,
        productCode: taxInvoiceItems.productCode,
        totalQty: sql<string>`SUM(${taxInvoiceItems.qty}::numeric)`,
        totalRevenue: sql<string>`SUM(${taxInvoiceItems.total}::numeric)`,
      }).from(taxInvoiceItems)
        .where(inArray(taxInvoiceItems.taxInvoiceId, docIds))
        .groupBy(taxInvoiceItems.productName, taxInvoiceItems.productCode);

      const productCostMap = new Map<string, number>();
      const allProducts = await db.select({ id: products.id, name: products.name, code: products.code, costPrice: products.costPrice }).from(products).where(eq(products.companyId, companyId));
      allProducts.forEach((p: any) => {
        if (p.costPrice) productCostMap.set(p.name, parseFloat(p.costPrice));
        if (p.code) productCostMap.set(p.code, parseFloat(p.costPrice || "0"));
      });

      const productResults = salesByProduct.map((sp: any) => {
        const revenue = parseFloat(sp.totalRevenue || "0");
        const qty = parseFloat(sp.totalQty || "0");
        const costPerUnit = productCostMap.get(sp.productCode) || productCostMap.get(sp.productName) || 0;
        const totalCost = costPerUnit * qty;
        const profit = revenue - totalCost;
        const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
        return {
          productName: sp.productName, productCode: sp.productCode,
          qty, revenue, costPerUnit, totalCost, profit, margin: Math.round(margin * 100) / 100,
        };
      }).sort((a: any, b: any) => b.revenue - a.revenue);

      const totalRevenue = productResults.reduce((s: number, p: any) => s + p.revenue, 0);
      const totalCost = productResults.reduce((s: number, p: any) => s + p.totalCost, 0);
      const totalProfit = totalRevenue - totalCost;
      const avgMargin = totalRevenue > 0 ? Math.round(((totalProfit / totalRevenue) * 100) * 100) / 100 : 0;

      res.json({ products: productResults, summary: { totalRevenue, totalCost, totalProfit, avgMargin } });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });


// ========== VAT Closing (ปิดบัญชี VAT) ==========

// Get VAT summary for a month
app.get("/api/vat-closing/summary", requireAuth, requireModule("accounting"), async (req, res) => {
  try {
    const companyId = Number(req.query.companyId);
    const month = Number(req.query.month);
    const year = Number(req.query.year);
    if (!companyId || !month || !year) return res.status(400).json({ message: "companyId, month, year required" });

    const user = req.user as any;
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
    if (company && company.tenantId && company.tenantId !== user.tenantId) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });

    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    const companyAccounts = await db.select().from(accounts).where(eq(accounts.companyId, companyId));
    const outputVatCodes = ["2341000", "2342000"];
    const inputVatCodes = ["1432000", "1433000"];
    const outputVatAccounts = companyAccounts.filter(a => outputVatCodes.includes(a.code));
    const inputVatAccounts = companyAccounts.filter(a => inputVatCodes.includes(a.code));

    const periodEntries = await db.select().from(journalEntries)
      .where(and(
        eq(journalEntries.companyId, companyId),
        sql`${journalEntries.entryDate} >= ${startDate}`,
        sql`${journalEntries.entryDate} <= ${endDate}`,
      ));

    const existingClosing = periodEntries.find(e =>
      e.reference === `VAT-CLOSE-${year}${String(month).padStart(2, "0")}` &&
      e.sourceDocType === "vat_closing"
    );

    const nonClosingEntries = periodEntries.filter(e => e.sourceDocType !== "vat_closing");
    const entryIds = nonClosingEntries.map(e => e.id);

    let lines: any[] = [];
    if (entryIds.length > 0) {
      lines = await db.select().from(journalLines)
        .where(sql`${journalLines.journalEntryId} IN (${sql.join(entryIds.map(id => sql`${id}`), sql`, `)})`);
    }

    const outputVatIds = new Set(outputVatAccounts.map(a => a.id));
    const inputVatIds = new Set(inputVatAccounts.map(a => a.id));

    let totalOutputVat = 0;
    let totalInputVat = 0;

    for (const line of lines) {
      const debit = parseFloat(line.debit || "0");
      const credit = parseFloat(line.credit || "0");
      if (outputVatIds.has(line.accountId)) {
        totalOutputVat += credit - debit;
      }
      if (inputVatIds.has(line.accountId)) {
        totalInputVat += debit - credit;
      }
    }

    const diff = totalOutputVat - totalInputVat;

    const outputVatBreakdown = outputVatAccounts.map(acc => {
      const accLines = lines.filter(l => l.accountId === acc.id);
      const balance = accLines.reduce((s, l) => s + parseFloat(l.credit || "0") - parseFloat(l.debit || "0"), 0);
      return { id: acc.id, code: acc.code, name: acc.nameTh || acc.name, balance: Math.round(balance * 100) / 100 };
    }).filter(a => Math.abs(a.balance) >= 0.01);

    const inputVatBreakdown = inputVatAccounts.map(acc => {
      const accLines = lines.filter(l => l.accountId === acc.id);
      const balance = accLines.reduce((s, l) => s + parseFloat(l.debit || "0") - parseFloat(l.credit || "0"), 0);
      return { id: acc.id, code: acc.code, name: acc.nameTh || acc.name, balance: Math.round(balance * 100) / 100 };
    }).filter(a => Math.abs(a.balance) >= 0.01);

    const payableAcc = companyAccounts.find(a => a.code === "2328000" || a.code === "2201");
    const refundAcc = companyAccounts.find(a => a.code === "1431000" || a.code === "1306");

    let carryForwardReceivable = 0;
    if (refundAcc) {
      const allPriorEntries = await db.select({ id: journalEntries.id }).from(journalEntries)
        .where(and(
          eq(journalEntries.companyId, companyId),
          sql`${journalEntries.entryDate} < ${startDate}`,
        ));
      const priorIds = allPriorEntries.map(e => e.id);
      if (priorIds.length > 0) {
        const priorLines = await db.select().from(journalLines)
          .where(and(
            sql`${journalLines.journalEntryId} IN (${sql.join(priorIds.map(id => sql`${id}`), sql`, `)})`,
            eq(journalLines.accountId, refundAcc.id),
          ));
        for (const pl of priorLines) {
          carryForwardReceivable += parseFloat(pl.debit || "0") - parseFloat(pl.credit || "0");
        }
      }
      carryForwardReceivable = Math.round(carryForwardReceivable * 100) / 100;
      if (carryForwardReceivable < 0) carryForwardReceivable = 0;
    }

    let vatPayable = 0;
    let vatRefundable = 0;
    let carryForwardUsed = 0;

    if (diff > 0) {
      if (carryForwardReceivable > 0) {
        carryForwardUsed = Math.min(carryForwardReceivable, diff);
        const netPayable = diff - carryForwardUsed;
        vatPayable = Math.round(netPayable * 100) / 100;
      } else {
        vatPayable = Math.round(diff * 100) / 100;
      }
    } else if (diff < 0) {
      vatRefundable = Math.round(Math.abs(diff) * 100) / 100;
    }

    const THAI_MONTHS_SUM = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
    const mName = THAI_MONTHS_SUM[month - 1] || "";

    const journalPreview: { code: string; name: string; description: string; debit: number; credit: number }[] = [];

    for (const acc of outputVatBreakdown) {
      journalPreview.push({
        code: acc.code, name: acc.name,
        description: `ปิดบัญชี ${acc.name} ประจำเดือน ${mName} ${year}`,
        debit: acc.balance, credit: 0,
      });
    }
    for (const acc of inputVatBreakdown) {
      journalPreview.push({
        code: acc.code, name: acc.name,
        description: `ปิดบัญชี ${acc.name} ประจำเดือน ${mName} ${year}`,
        debit: 0, credit: acc.balance,
      });
    }
    if (carryForwardUsed > 0) {
      journalPreview.push({
        code: "1163_cf", name: refundAcc ? (refundAcc.nameTh || refundAcc.name || "ลูกหนี้สรรพากร") : "ลูกหนี้สรรพากร",
        description: `หักลูกหนี้สรรพากรยกมา ประจำเดือน ${mName} ${year}`,
        debit: 0, credit: Math.round(carryForwardUsed * 100) / 100,
      });
    }
    if (vatPayable > 0) {
      journalPreview.push({
        code: "2201", name: payableAcc ? (payableAcc.nameTh || payableAcc.name || "เจ้าหนี้สรรพากร") : "เจ้าหนี้สรรพากร",
        description: `${payableAcc ? (payableAcc.nameTh || payableAcc.name) : "เจ้าหนี้สรรพากร"} - ต้องชำระภาษี ประจำเดือน ${mName} ${year}`,
        debit: 0, credit: Math.round(vatPayable * 100) / 100,
      });
    }
    if (vatRefundable > 0) {
      journalPreview.push({
        code: "1306", name: refundAcc ? (refundAcc.nameTh || refundAcc.name || "ลูกหนี้สรรพากร") : "ลูกหนี้สรรพากร",
        description: `${refundAcc ? (refundAcc.nameTh || refundAcc.name) : "ลูกหนี้สรรพากร"} - ขอคืนภาษี ประจำเดือน ${mName} ${year}`,
        debit: Math.round(vatRefundable * 100) / 100, credit: 0,
      });
    }

    const missingAccounts: string[] = [];
    if (vatPayable > 0 && !payableAcc) missingAccounts.push("2133 (เจ้าหนี้สรรพากร)");
    if ((vatRefundable > 0 || carryForwardUsed > 0) && !refundAcc) missingAccounts.push("1163 (ลูกหนี้สรรพากร)");

    res.json({
      totalOutputVat: Math.round(totalOutputVat * 100) / 100,
      totalInputVat: Math.round(totalInputVat * 100) / 100,
      vatPayable: Math.round(vatPayable * 100) / 100,
      vatRefundable: Math.round(vatRefundable * 100) / 100,
      carryForwardReceivable: Math.round(carryForwardReceivable * 100) / 100,
      carryForwardUsed: Math.round(carryForwardUsed * 100) / 100,
      alreadyClosed: !!existingClosing,
      closingEntryId: existingClosing?.id || null,
      outputVatAccounts: outputVatAccounts.map(a => ({ id: a.id, code: a.code, name: a.nameTh || a.name })),
      inputVatAccounts: inputVatAccounts.map(a => ({ id: a.id, code: a.code, name: a.nameTh || a.name })),
      journalPreview,
      missingAccounts,
      entryDescription: `ปิดบัญชี VAT ประจำเดือน ${mName} ${year}`,
      entryReference: `VAT-CLOSE-${year}${String(month).padStart(2, "0")}`,
      entryDate: endDate,
    });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Execute VAT closing
app.post("/api/vat-closing/close", requireAuth, requireModule("accounting"), async (req, res) => {
  try {
    const { companyId, month, year, description: customDesc, entryDate: customEntryDate, lineDescriptions } = req.body;
    if (!companyId || !month || !year) return res.status(400).json({ message: "companyId, month, year required" });

    const user = req.user as any;
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
    if (company && company.tenantId && company.tenantId !== user.tenantId) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });

    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    const refNo = `VAT-CLOSE-${year}${String(month).padStart(2, "0")}`;

    const existing = await db.select().from(journalEntries)
      .where(and(
        eq(journalEntries.companyId, companyId),
        eq(journalEntries.reference, refNo),
        eq(journalEntries.sourceDocType, "vat_closing"),
      ));
    if (existing.length > 0) return res.status(400).json({ message: "เดือนนี้ปิดบัญชี VAT ไปแล้ว" });

    const companyAccounts = await db.select().from(accounts).where(eq(accounts.companyId, companyId));
    const accountMap = new Map(companyAccounts.map(a => [a.code, a]));

    const outputVatCodes = ["2341000", "2342000"];
    const inputVatCodes = ["1432000", "1433000"];

    const nonClosingEntries = await db.select().from(journalEntries)
      .where(and(
        eq(journalEntries.companyId, companyId),
        sql`${journalEntries.entryDate} >= ${startDate}`,
        sql`${journalEntries.entryDate} <= ${endDate}`,
        sql`(${journalEntries.sourceDocType} IS NULL OR ${journalEntries.sourceDocType} != 'vat_closing')`,
      ));
    const entryIds = nonClosingEntries.map(e => e.id);
    let lines: any[] = [];
    if (entryIds.length > 0) {
      lines = await db.select().from(journalLines)
        .where(sql`${journalLines.journalEntryId} IN (${sql.join(entryIds.map(id => sql`${id}`), sql`, `)})`);
    }

    const outputVatAccounts = companyAccounts.filter(a => outputVatCodes.includes(a.code));
    const inputVatAccounts = companyAccounts.filter(a => inputVatCodes.includes(a.code));
    const outputVatIds = new Set(outputVatAccounts.map(a => a.id));
    const inputVatIds = new Set(inputVatAccounts.map(a => a.id));

    let totalOutputVat = 0;
    let totalInputVat = 0;
    for (const line of lines) {
      const debit = parseFloat(line.debit || "0");
      const credit = parseFloat(line.credit || "0");
      if (outputVatIds.has(line.accountId)) totalOutputVat += credit - debit;
      if (inputVatIds.has(line.accountId)) totalInputVat += debit - credit;
    }

    totalOutputVat = Math.round(totalOutputVat * 100) / 100;
    totalInputVat = Math.round(totalInputVat * 100) / 100;

    if (totalOutputVat === 0 && totalInputVat === 0) {
      return res.status(400).json({ message: "ไม่มียอดภาษีซื้อและภาษีขายในเดือนนี้" });
    }

    const diff = totalOutputVat - totalInputVat;
    const vatPayableAcc = accountMap.get("2328000") || accountMap.get("2201");
    const vatRefundAcc = accountMap.get("1431000") || accountMap.get("1306");

    let carryForwardReceivable = 0;
    if (vatRefundAcc) {
      const allPriorEntries = await db.select({ id: journalEntries.id }).from(journalEntries)
        .where(and(
          eq(journalEntries.companyId, companyId),
          sql`${journalEntries.entryDate} < ${startDate}`,
        ));
      const priorIds = allPriorEntries.map(e => e.id);
      if (priorIds.length > 0) {
        const priorLines = await db.select().from(journalLines)
          .where(and(
            sql`${journalLines.journalEntryId} IN (${sql.join(priorIds.map(id => sql`${id}`), sql`, `)})`,
            eq(journalLines.accountId, vatRefundAcc.id),
          ));
        for (const pl of priorLines) {
          carryForwardReceivable += parseFloat(pl.debit || "0") - parseFloat(pl.credit || "0");
        }
      }
      carryForwardReceivable = Math.round(carryForwardReceivable * 100) / 100;
      if (carryForwardReceivable < 0) carryForwardReceivable = 0;
    }

    let carryForwardUsed = 0;
    let netPayable = 0;
    if (diff > 0) {
      carryForwardUsed = Math.min(carryForwardReceivable, diff);
      netPayable = Math.round((diff - carryForwardUsed) * 100) / 100;
    }

    if (netPayable > 0 && !vatPayableAcc) {
      return res.status(400).json({ message: "ไม่พบบัญชี 2133 (เจ้าหนี้สรรพากร) กรุณาเพิ่มบัญชีในผังบัญชีก่อนปิดบัญชี VAT" });
    }
    if (diff < 0 && !vatRefundAcc) {
      return res.status(400).json({ message: "ไม่พบบัญชี 1163 (ลูกหนี้สรรพากร) กรุณาเพิ่มบัญชีในผังบัญชีก่อนปิดบัญชี VAT" });
    }
    if (carryForwardUsed > 0 && !vatRefundAcc) {
      return res.status(400).json({ message: "ไม่พบบัญชี 1163 (ลูกหนี้สรรพากร) กรุณาเพิ่มบัญชีในผังบัญชีก่อนปิดบัญชี VAT" });
    }

    const lineDescMap = new Map<string, string>();
    if (Array.isArray(lineDescriptions)) {
      for (const ld of lineDescriptions) {
        if (ld.code && ld.description) lineDescMap.set(ld.code, ld.description);
      }
    }

    const THAI_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
    const monthName = THAI_MONTHS[month - 1] || "";
    const desc = customDesc || `ปิดบัญชี VAT ประจำเดือน ${monthName} ${year}`;

    const result = await db.transaction(async (tx) => {
      const finalEntryDate = customEntryDate || endDate;
      const entryNo = await getNextJournalEntryNo(companyId, "general", finalEntryDate);
      const [entry] = await tx.insert(journalEntries).values({
        companyId,
        entryNo,
        entryDate: finalEntryDate,
        reference: refNo,
        description: desc,
        journalBook: "general",
        createdBy: user.id,
        status: "posted",
        sourceDocType: "vat_closing",
      }).returning();

      for (const acc of outputVatAccounts) {
        const accLines = lines.filter(l => l.accountId === acc.id);
        const accBalance = accLines.reduce((s, l) => s + parseFloat(l.credit || "0") - parseFloat(l.debit || "0"), 0);
        if (Math.abs(accBalance) < 0.01) continue;
        const lineDesc = lineDescMap.get(acc.code) || `ปิดบัญชี ${acc.nameTh || acc.name}`;
        await tx.insert(journalLines).values({
          journalEntryId: entry.id,
          accountId: acc.id,
          description: lineDesc,
          debit: String(Math.abs(accBalance).toFixed(2)),
          credit: "0",
        });
      }

      for (const acc of inputVatAccounts) {
        const accLines = lines.filter(l => l.accountId === acc.id);
        const accBalance = accLines.reduce((s, l) => s + parseFloat(l.debit || "0") - parseFloat(l.credit || "0"), 0);
        if (Math.abs(accBalance) < 0.01) continue;
        const lineDesc = lineDescMap.get(acc.code) || `ปิดบัญชี ${acc.nameTh || acc.name}`;
        await tx.insert(journalLines).values({
          journalEntryId: entry.id,
          accountId: acc.id,
          description: lineDesc,
          debit: "0",
          credit: String(Math.abs(accBalance).toFixed(2)),
        });
      }

      if (carryForwardUsed > 0 && vatRefundAcc) {
        const lineDesc = lineDescMap.get("1163_cf") || `หักลูกหนี้สรรพากรยกมา`;
        await tx.insert(journalLines).values({
          journalEntryId: entry.id,
          accountId: vatRefundAcc.id,
          description: lineDesc,
          debit: "0",
          credit: String(carryForwardUsed.toFixed(2)),
        });
      }

      if (netPayable > 0 && vatPayableAcc) {
        const lineDesc = lineDescMap.get("2201") || `${vatPayableAcc.nameTh || vatPayableAcc.name} - ต้องชำระภาษี`;
        await tx.insert(journalLines).values({
          journalEntryId: entry.id,
          accountId: vatPayableAcc.id,
          description: lineDesc,
          debit: "0",
          credit: String(netPayable.toFixed(2)),
        });
      } else if (diff < 0 && vatRefundAcc) {
        const lineDesc = lineDescMap.get("1306") || `${vatRefundAcc.nameTh || vatRefundAcc.name} - ขอคืนภาษี`;
        await tx.insert(journalLines).values({
          journalEntryId: entry.id,
          accountId: vatRefundAcc.id,
          description: lineDesc,
          debit: String(Math.abs(diff).toFixed(2)),
          credit: "0",
        });
      }

      return entry;
    });

    res.json({ success: true, journalEntryId: result.id, message: `ปิดบัญชี VAT เดือน ${monthName} ${year} สำเร็จ` });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

}
