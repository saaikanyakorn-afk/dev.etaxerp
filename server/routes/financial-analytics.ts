import type { Express } from "express";
import { db } from "../db";
import { sql, eq } from "drizzle-orm";
import { accounts, companies, departments, journalEntries, journalLines } from "@shared/schema";
import { requireAuth, requireModule } from "../route-middleware";
import { getCachedReport, setCachedReport, logReportTiming } from "./report-cache";

export function registerFinancialAnalyticsRoutes(app: Express) {

  app.get("/api/reports/opex-capex", requireAuth, requireModule("accounting"), async (req, res) => {
    try {
      const _t0 = performance.now();
      const companyId = Number(req.query.companyId);
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      if (!companyId || !startDate || !endDate) return res.status(400).json({ message: "companyId, startDate, endDate required" });

      const cached = getCachedReport("opex-capex", companyId, { startDate, endDate });
      if (cached) { logReportTiming("opex-capex", companyId, performance.now() - _t0, null, true, { startDate, endDate }); return res.json(cached); }

      const user = req.user as any;
      const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
      if (company && company.tenantId && company.tenantId !== user.tenantId) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });

      const rows = await db.execute(sql`
        SELECT
          TO_CHAR(je.entry_date, 'YYYY-MM') AS "month",
          a.code AS "accountCode",
          a.name AS "accountName",
          a.name_th AS "accountNameTh",
          a.type AS "accountType",
          COALESCE(SUM(CAST(jl.debit AS numeric)), 0) - COALESCE(SUM(CAST(jl.credit AS numeric)), 0) AS "amount"
        FROM journal_lines jl
        INNER JOIN journal_entries je ON je.id = jl.journal_entry_id
        INNER JOIN accounts a ON a.id = jl.account_id
        WHERE je.company_id = ${companyId}
          AND je.status IN ('posted', 'approved')
          AND je.entry_date >= ${startDate}
          AND je.entry_date <= ${endDate}
          AND a.type = 'expense'
        GROUP BY TO_CHAR(je.entry_date, 'YYYY-MM'), a.code, a.name, a.name_th, a.type
        ORDER BY "month", a.code
      `);

      const data = (rows.rows || rows) as any[];

      const capexPrefixes = ["15", "16", "17", "18", "19"];
      const isCapex = (code: string) => capexPrefixes.some(p => code.startsWith(p));

      const monthlyMap = new Map<string, { opex: number; capex: number }>();
      const opexAccounts = new Map<string, { code: string; name: string; nameTh: string | null; total: number }>();
      const capexAccounts = new Map<string, { code: string; name: string; nameTh: string | null; total: number }>();

      let totalOpex = 0;
      let totalCapex = 0;

      for (const row of data) {
        const amount = Number(row.amount) || 0;
        if (amount === 0) continue;
        const month = row.month;
        const code = row.accountCode;
        const isCap = isCapex(code);

        if (!monthlyMap.has(month)) monthlyMap.set(month, { opex: 0, capex: 0 });
        const m = monthlyMap.get(month)!;

        if (isCap) {
          m.capex += amount;
          totalCapex += amount;
          const existing = capexAccounts.get(code);
          if (existing) existing.total += amount;
          else capexAccounts.set(code, { code, name: row.accountName, nameTh: row.accountNameTh, total: amount });
        } else {
          m.opex += amount;
          totalOpex += amount;
          const existing = opexAccounts.get(code);
          if (existing) existing.total += amount;
          else opexAccounts.set(code, { code, name: row.accountName, nameTh: row.accountNameTh, total: amount });
        }
      }

      const assetRows = await db.execute(sql`
        SELECT
          TO_CHAR(je.entry_date, 'YYYY-MM') AS "month",
          a.code AS "accountCode",
          a.name AS "accountName",
          a.name_th AS "accountNameTh",
          COALESCE(SUM(CAST(jl.debit AS numeric)), 0) - COALESCE(SUM(CAST(jl.credit AS numeric)), 0) AS "amount"
        FROM journal_lines jl
        INNER JOIN journal_entries je ON je.id = jl.journal_entry_id
        INNER JOIN accounts a ON a.id = jl.account_id
        WHERE je.company_id = ${companyId}
          AND je.status IN ('posted', 'approved')
          AND je.entry_date >= ${startDate}
          AND je.entry_date <= ${endDate}
          AND a.type = 'asset'
          AND (${sql.raw(capexPrefixes.map(p => `a.code LIKE '${p}%'`).join(' OR '))})
        GROUP BY TO_CHAR(je.entry_date, 'YYYY-MM'), a.code, a.name, a.name_th
        ORDER BY "month", a.code
      `);

      for (const row of (assetRows.rows || assetRows) as any[]) {
        const amount = Number(row.amount) || 0;
        if (amount <= 0) continue;
        const month = row.month;
        if (!monthlyMap.has(month)) monthlyMap.set(month, { opex: 0, capex: 0 });
        monthlyMap.get(month)!.capex += amount;
        totalCapex += amount;
        const code = row.accountCode;
        const existing = capexAccounts.get(code);
        if (existing) existing.total += amount;
        else capexAccounts.set(code, { code, name: row.accountName, nameTh: row.accountNameTh, total: amount });
      }

      const monthly = Array.from(monthlyMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([month, values]) => ({ month, ...values }));

      const result = {
        monthly,
        totalOpex,
        totalCapex,
        opexAccounts: Array.from(opexAccounts.values()).sort((a, b) => b.total - a.total),
        capexAccounts: Array.from(capexAccounts.values()).sort((a, b) => b.total - a.total),
        opexRatio: totalOpex + totalCapex > 0 ? (totalOpex / (totalOpex + totalCapex)) * 100 : 0,
        capexRatio: totalOpex + totalCapex > 0 ? (totalCapex / (totalOpex + totalCapex)) * 100 : 0,
      };

      setCachedReport("opex-capex", companyId, { startDate, endDate }, result);
      logReportTiming("opex-capex", companyId, performance.now() - _t0, data.length, false, { startDate, endDate });
      res.json(result);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/reports/growth-trend", requireAuth, requireModule("accounting"), async (req, res) => {
    try {
      const _t0 = performance.now();
      const companyId = Number(req.query.companyId);
      const periods = Math.min(Math.max(Number(req.query.periods) || 8, 2), 20);
      const mode = (req.query.mode as string) === "yearly" ? "yearly" : "quarterly";
      if (!companyId) return res.status(400).json({ message: "companyId required" });

      const user = req.user as any;
      const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
      if (company && company.tenantId && company.tenantId !== user.tenantId) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });

      const now = new Date();
      const periodDefs: { label: string; startDate: string; endDate: string }[] = [];

      if (mode === "yearly") {
        for (let i = periods - 1; i >= 0; i--) {
          const year = now.getFullYear() - i;
          periodDefs.push({ label: `${year}`, startDate: `${year}-01-01`, endDate: `${year}-12-31` });
        }
      } else {
        const currentQ = Math.ceil((now.getMonth() + 1) / 3);
        const currentYear = now.getFullYear();
        for (let i = periods - 1; i >= 0; i--) {
          let q = currentQ - i;
          let y = currentYear;
          while (q <= 0) { q += 4; y--; }
          const startMonth = (q - 1) * 3 + 1;
          const endMonth = q * 3;
          const sd = `${y}-${String(startMonth).padStart(2, "0")}-01`;
          const lastDay = new Date(y, endMonth, 0).getDate();
          const ed = `${y}-${String(endMonth).padStart(2, "0")}-${lastDay}`;
          periodDefs.push({ label: `Q${q}/${y}`, startDate: sd, endDate: ed });
        }
      }

      const { getAccountBalances, balanceMapFromRows } = await import("../report-queries");
      const allAccounts = await db.select().from(accounts).where(eq(accounts.companyId, companyId)).orderBy(accounts.code);

      const periodData: any[] = [];
      for (const pd of periodDefs) {
        const rows = await getAccountBalances(companyId, pd.startDate, pd.endDate);
        const balMap = balanceMapFromRows(rows);

        let revenue = 0, expense = 0, assets = 0, equity = 0;
        for (const acct of allAccounts) {
          const bal = balMap.get(acct.id) || { debit: 0, credit: 0 };
          if (acct.type === "revenue") revenue += bal.credit - bal.debit;
          else if (acct.type === "expense") expense += bal.debit - bal.credit;
          else if (acct.type === "asset") assets += bal.debit - bal.credit;
          else if (acct.type === "equity") equity += bal.credit - bal.debit;
        }

        periodData.push({
          label: pd.label,
          revenue,
          netProfit: revenue - expense,
          assets,
          equity,
        });
      }

      const result = periodData.map((p, idx) => {
        const prev = idx > 0 ? periodData[idx - 1] : null;
        return {
          label: p.label,
          revenue: p.revenue,
          netProfit: p.netProfit,
          assets: p.assets,
          equity: p.equity,
          revenueGrowth: prev && prev.revenue !== 0 ? ((p.revenue - prev.revenue) / Math.abs(prev.revenue)) * 100 : null,
          profitGrowth: prev && prev.netProfit !== 0 ? ((p.netProfit - prev.netProfit) / Math.abs(prev.netProfit)) * 100 : null,
          assetGrowth: prev && prev.assets !== 0 ? ((p.assets - prev.assets) / Math.abs(prev.assets)) * 100 : null,
          equityGrowth: prev && prev.equity !== 0 ? ((p.equity - prev.equity) / Math.abs(prev.equity)) * 100 : null,
        };
      });

      logReportTiming("growth-trend", companyId, performance.now() - _t0, periods, false, { mode });
      res.json({ periods: result, mode });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/reports/department-pl", requireAuth, requireModule("accounting"), async (req, res) => {
    try {
      const _t0 = performance.now();
      const companyId = Number(req.query.companyId);
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      if (!companyId || !startDate || !endDate) return res.status(400).json({ message: "companyId, startDate, endDate required" });

      const user = req.user as any;
      const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
      if (company && company.tenantId && company.tenantId !== user.tenantId) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });

      const rows = await db.execute(sql`
        SELECT
          COALESCE(NULLIF(jl.cost_center, ''), 'ไม่ระบุแผนก') AS "department",
          a.code AS "accountCode",
          a.name AS "accountName",
          a.name_th AS "accountNameTh",
          a.type AS "accountType",
          COALESCE(SUM(CAST(jl.debit AS numeric)), 0) AS "totalDebit",
          COALESCE(SUM(CAST(jl.credit AS numeric)), 0) AS "totalCredit"
        FROM journal_lines jl
        INNER JOIN journal_entries je ON je.id = jl.journal_entry_id
        INNER JOIN accounts a ON a.id = jl.account_id
        WHERE je.company_id = ${companyId}
          AND je.status IN ('posted', 'approved')
          AND je.entry_date >= ${startDate}
          AND je.entry_date <= ${endDate}
          AND a.type IN ('revenue', 'expense')
        GROUP BY COALESCE(NULLIF(jl.cost_center, ''), 'ไม่ระบุแผนก'), a.code, a.name, a.name_th, a.type
        ORDER BY a.type DESC, a.code
      `);

      const data = (rows.rows || rows) as any[];
      const deptSet = new Set<string>();
      const accountMap = new Map<string, { code: string; name: string; nameTh: string | null; type: string; departments: Record<string, number> }>();

      for (const row of data) {
        const dept = row.department;
        deptSet.add(dept);
        const code = row.accountCode;
        const debit = Number(row.totalDebit) || 0;
        const credit = Number(row.totalCredit) || 0;
        const balance = row.accountType === "revenue" ? credit - debit : debit - credit;

        if (!accountMap.has(code)) {
          accountMap.set(code, { code, name: row.accountName, nameTh: row.accountNameTh, type: row.accountType, departments: {} });
        }
        const acct = accountMap.get(code)!;
        acct.departments[dept] = (acct.departments[dept] || 0) + balance;
      }

      const deptList = Array.from(deptSet).sort();
      const accountsList = Array.from(accountMap.values());
      const revenueAccounts = accountsList.filter(a => a.type === "revenue");
      const expenseAccounts = accountsList.filter(a => a.type === "expense");

      const deptTotals: Record<string, { revenue: number; expense: number; netIncome: number }> = {};
      for (const dept of deptList) {
        const rev = revenueAccounts.reduce((s, a) => s + (a.departments[dept] || 0), 0);
        const exp = expenseAccounts.reduce((s, a) => s + (a.departments[dept] || 0), 0);
        deptTotals[dept] = { revenue: rev, expense: exp, netIncome: rev - exp };
      }

      const result = { departments: deptList, revenueAccounts, expenseAccounts, deptTotals };
      logReportTiming("department-pl", companyId, performance.now() - _t0, data.length, false, { startDate, endDate });
      res.json(result);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/reports/break-even", requireAuth, requireModule("accounting"), async (req, res) => {
    try {
      const { fixedCosts, variableCostPerUnit, sellingPricePerUnit, currentSalesUnits } = req.body;
      if (fixedCosts == null || variableCostPerUnit == null || sellingPricePerUnit == null) {
        return res.status(400).json({ message: "fixedCosts, variableCostPerUnit, sellingPricePerUnit required" });
      }

      const fc = Number(fixedCosts);
      const vc = Number(variableCostPerUnit);
      const sp = Number(sellingPricePerUnit);
      const currentUnits = Number(currentSalesUnits) || 0;

      if (sp <= vc) {
        return res.json({
          bepUnits: null,
          bepValue: null,
          contributionMargin: sp - vc,
          contributionMarginRatio: 0,
          marginOfSafety: 0,
          marginOfSafetyRatio: 0,
          chartData: [],
          error: "ราคาขายต่อหน่วยต้องมากกว่าต้นทุนผันแปรต่อหน่วย",
        });
      }

      const contributionMargin = sp - vc;
      const contributionMarginRatio = contributionMargin / sp;
      const bepUnits = Math.ceil(fc / contributionMargin);
      const bepValue = bepUnits * sp;

      const marginOfSafety = currentUnits > bepUnits ? (currentUnits - bepUnits) * sp : 0;
      const marginOfSafetyRatio = currentUnits > 0 && currentUnits > bepUnits ? ((currentUnits - bepUnits) / currentUnits) * 100 : 0;

      const maxUnits = Math.max(bepUnits * 2, currentUnits * 1.5, 100);
      const step = Math.max(1, Math.floor(maxUnits / 20));
      const chartData: { units: number; revenue: number; totalCost: number; fixedCost: number }[] = [];

      for (let u = 0; u <= maxUnits; u += step) {
        chartData.push({
          units: u,
          revenue: u * sp,
          totalCost: fc + u * vc,
          fixedCost: fc,
        });
      }

      res.json({
        bepUnits,
        bepValue,
        contributionMargin,
        contributionMarginRatio: contributionMarginRatio * 100,
        marginOfSafety,
        marginOfSafetyRatio,
        currentSalesUnits: currentUnits,
        currentRevenue: currentUnits * sp,
        currentTotalCost: fc + currentUnits * vc,
        currentProfit: currentUnits * sp - (fc + currentUnits * vc),
        chartData,
      });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });
}
