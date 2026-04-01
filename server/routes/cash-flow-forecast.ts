import type { Express } from "express";
import { requireAuth, requireModule, getCompanyTenantId } from "../route-middleware";
import { db } from "../db";
import { sql, eq } from "drizzle-orm";
import { accounts } from "@shared/schema";
import { getAccountBalances } from "../report-queries";

interface ForecastPoint {
  day: number;
  date: string;
  bestCase: number;
  expected: number;
  worstCase: number;
}

interface WorkingCapitalData {
  currentAssets: number;
  currentLiabilities: number;
  netWorkingCapital: number;
  workingCapitalRatio: number;
  cashConversionCycle: number;
  dso: number;
  dpo: number;
  dio: number;
  monthlyTrend: { month: string; ratio: number; nwc: number }[];
}

export function registerCashFlowForecastRoutes(app: Express) {
  app.get("/api/finance/cash-flow-forecast", requireAuth, requireModule("finance"), async (req, res) => {
    try {
      const companyId = Number(req.query.companyId);
      if (!companyId) return res.status(400).json({ message: "companyId required" });

      const user = req.user as any;
      const tenantId = user.tenantId;
      const valid = await getCompanyTenantId(companyId);
      if (tenantId && valid !== tenantId) return res.status(403).json({ message: "Forbidden" });

      const threshold = Number(req.query.threshold) || 0;
      const today = new Date();
      const todayStr = today.toISOString().split("T")[0];
      const yearStart = `${today.getFullYear()}-01-01`;

      const companyAccounts = await db.select().from(accounts).where(eq(accounts.companyId, companyId));

      const balances = await getAccountBalances(companyId, null, todayStr);
      const balanceMap = new Map(balances.map(b => [b.accountId, b]));

      let currentCash = 0;
      for (const acct of companyAccounts) {
        if (acct.code && (acct.code.startsWith("100") || acct.code.startsWith("101") || acct.code.startsWith("102"))) {
          const bal = balanceMap.get(acct.id);
          if (bal) {
            currentCash += Number(bal.totalDebit) - Number(bal.totalCredit);
          }
        }
      }

      const arDocs = await db.execute(sql`
        SELECT 
          COALESCE(CAST(total_amount AS numeric), 0) AS amount,
          COALESCE(due_date, tax_invoice_date) AS due_date,
          payment_status
        FROM tax_invoices
        WHERE company_id = ${companyId}
          AND status != 'cancelled'
          AND payment_status != 'paid'
        UNION ALL
        SELECT 
          COALESCE(CAST(total_amount AS numeric), 0) AS amount,
          COALESCE(due_date, invoice_date) AS due_date,
          payment_status
        FROM invoices
        WHERE company_id = ${companyId}
          AND status != 'cancelled'
          AND payment_status != 'paid'
      `);

      const apDocs = await db.execute(sql`
        SELECT 
          COALESCE(CAST(total_amount AS numeric), 0) AS amount,
          COALESCE(due_date, ap_date) AS due_date,
          payment_status
        FROM purchase_invoices
        WHERE company_id = ${companyId}
          AND status != 'cancelled'
          AND payment_status != 'paid'
        UNION ALL
        SELECT 
          COALESCE(CAST(total_amount AS numeric), 0) AS amount,
          COALESCE(due_date, exp_date) AS due_date,
          payment_status
        FROM expenses
        WHERE company_id = ${companyId}
          AND status != 'cancelled'
          AND payment_status != 'paid'
      `);

      const arRows = (arDocs.rows || arDocs) as any[];
      const apRows = (apDocs.rows || apDocs) as any[];

      const forecast: ForecastPoint[] = [];
      let runningBest = currentCash;
      let runningExpected = currentCash;
      let runningWorst = currentCash;

      const arCollectionRate = { best: 0.95, expected: 0.80, worst: 0.60 };
      const apPaymentRate = { best: 0.90, expected: 1.00, worst: 1.00 };

      for (let d = 0; d <= 90; d++) {
        const date = new Date(today);
        date.setDate(date.getDate() + d);
        const dateStr = date.toISOString().split("T")[0];

        let arDue = 0;
        let apDue = 0;

        for (const row of arRows) {
          const dueDate = row.due_date ? String(row.due_date).split("T")[0] : null;
          if (d === 0) {
            if (dueDate && dueDate <= dateStr) {
              arDue += Number(row.amount) || 0;
            }
          } else {
            if (dueDate === dateStr) {
              arDue += Number(row.amount) || 0;
            }
          }
        }

        for (const row of apRows) {
          const dueDate = row.due_date ? String(row.due_date).split("T")[0] : null;
          if (d === 0) {
            if (dueDate && dueDate <= dateStr) {
              apDue += Number(row.amount) || 0;
            }
          } else {
            if (dueDate === dateStr) {
              apDue += Number(row.amount) || 0;
            }
          }
        }

        runningBest += arDue * arCollectionRate.best - apDue * apPaymentRate.best;
        runningExpected += arDue * arCollectionRate.expected - apDue * apPaymentRate.expected;
        runningWorst += arDue * arCollectionRate.worst - apDue * apPaymentRate.worst;

        forecast.push({
          day: d,
          date: dateStr,
          bestCase: Math.round(runningBest * 100) / 100,
          expected: Math.round(runningExpected * 100) / 100,
          worstCase: Math.round(runningWorst * 100) / 100,
        });
      }

      const totalAR = arRows.reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0);
      const totalAP = apRows.reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0);

      let currentAssets = 0;
      let currentLiabilities = 0;
      for (const acct of companyAccounts) {
        if (!acct.code) continue;
        const bal = balanceMap.get(acct.id);
        if (!bal) continue;
        const net = Number(bal.totalDebit) - Number(bal.totalCredit);

        if (acct.code.startsWith("1") && acct.code < "140") {
          currentAssets += net;
        }
        if (acct.code.startsWith("2") && acct.code < "230") {
          currentLiabilities += Math.abs(net);
        }
      }

      const wcRatio = currentLiabilities > 0 ? currentAssets / currentLiabilities : 0;
      const nwc = currentAssets - currentLiabilities;

      const revenueResult = await db.execute(sql`
        SELECT COALESCE(SUM(CAST(jl.credit AS numeric) - CAST(jl.debit AS numeric)), 0) AS revenue
        FROM journal_lines jl
        INNER JOIN journal_entries je ON je.id = jl.journal_entry_id
        INNER JOIN accounts a ON a.id = jl.account_id
        WHERE je.company_id = ${companyId}
          AND je.status IN ('posted','approved')
          AND je.entry_date >= ${yearStart}
          AND je.entry_date <= ${todayStr}
          AND a.code LIKE '4%'
      `);
      const annualRevenue = Number((revenueResult.rows || revenueResult)[0]?.revenue || 0);
      const daysElapsed = Math.max(1, Math.ceil((today.getTime() - new Date(yearStart).getTime()) / 86400000));
      const dailyRevenue = annualRevenue / daysElapsed;

      const cogsResult = await db.execute(sql`
        SELECT COALESCE(SUM(CAST(jl.debit AS numeric) - CAST(jl.credit AS numeric)), 0) AS cogs
        FROM journal_lines jl
        INNER JOIN journal_entries je ON je.id = jl.journal_entry_id
        INNER JOIN accounts a ON a.id = jl.account_id
        WHERE je.company_id = ${companyId}
          AND je.status IN ('posted','approved')
          AND je.entry_date >= ${yearStart}
          AND je.entry_date <= ${todayStr}
          AND (a.code LIKE '500%' OR a.code LIKE '510%')
      `);
      const annualCOGS = Number((cogsResult.rows || cogsResult)[0]?.cogs || 0);
      const dailyCOGS = annualCOGS / daysElapsed;

      let inventoryBalance = 0;
      for (const acct of companyAccounts) {
        if (!acct.code) continue;
        const bal = balanceMap.get(acct.id);
        if (!bal) continue;
        if (acct.code.startsWith("120") || acct.code.startsWith("121") || acct.code.startsWith("115")) {
          inventoryBalance += Number(bal.totalDebit) - Number(bal.totalCredit);
        }
      }

      let arBalance = 0;
      for (const acct of companyAccounts) {
        if (!acct.code) continue;
        const bal = balanceMap.get(acct.id);
        if (!bal) continue;
        if (acct.code.startsWith("110") || acct.code.startsWith("111") || acct.code.startsWith("112")) {
          arBalance += Number(bal.totalDebit) - Number(bal.totalCredit);
        }
      }

      let apBalance = 0;
      for (const acct of companyAccounts) {
        if (!acct.code) continue;
        const bal = balanceMap.get(acct.id);
        if (!bal) continue;
        if (acct.code.startsWith("200") || acct.code.startsWith("210") || acct.code.startsWith("211")) {
          apBalance += Math.abs(Number(bal.totalDebit) - Number(bal.totalCredit));
        }
      }

      const dso = dailyRevenue > 0 ? Math.round(arBalance / dailyRevenue) : 0;
      const dio = dailyCOGS > 0 ? Math.round(inventoryBalance / dailyCOGS) : 0;
      const dpo = dailyCOGS > 0 ? Math.round(apBalance / dailyCOGS) : 0;
      const ccc = dio + dso - dpo;

      const monthlyTrend: { month: string; ratio: number; nwc: number; ccc: number }[] = [];
      for (let m = 11; m >= 0; m--) {
        const trendYear = today.getFullYear();
        const trendMonth = today.getMonth() - m;
        const lastDayOfMonth = new Date(trendYear, trendMonth + 1, 0);
        const endDate = m === 0 ? today : lastDayOfMonth;
        const trendEndStr = endDate.toISOString().split("T")[0];
        const monthLabel = `${lastDayOfMonth.getFullYear()}-${String(lastDayOfMonth.getMonth() + 1).padStart(2, "0")}`;

        const monthStart = `${lastDayOfMonth.getFullYear()}-01-01`;
        const trendBalances = await getAccountBalances(companyId, null, trendEndStr);
        const trendBalMap = new Map(trendBalances.map(b => [b.accountId, b]));

        let ca = 0;
        let cl = 0;
        let tAr = 0;
        let tAp = 0;
        let tInv = 0;
        for (const acct of companyAccounts) {
          if (!acct.code) continue;
          const bal = trendBalMap.get(acct.id);
          if (!bal) continue;
          const net = Number(bal.totalDebit) - Number(bal.totalCredit);
          if (acct.code.startsWith("1") && acct.code < "140") ca += net;
          if (acct.code.startsWith("2") && acct.code < "230") cl += Math.abs(net);
          if (acct.code.startsWith("110") || acct.code.startsWith("111") || acct.code.startsWith("112")) tAr += net;
          if (acct.code.startsWith("200") || acct.code.startsWith("210") || acct.code.startsWith("211")) tAp += Math.abs(net);
          if (acct.code.startsWith("120") || acct.code.startsWith("121") || acct.code.startsWith("115")) tInv += net;
        }

        const trendRevResult = await db.execute(sql`
          SELECT COALESCE(SUM(CAST(jl.credit AS numeric) - CAST(jl.debit AS numeric)), 0) AS revenue
          FROM journal_lines jl
          INNER JOIN journal_entries je ON je.id = jl.journal_entry_id
          INNER JOIN accounts a ON a.id = jl.account_id
          WHERE je.company_id = ${companyId}
            AND je.status IN ('posted','approved')
            AND je.entry_date >= ${monthStart}
            AND je.entry_date <= ${trendEndStr}
            AND a.code LIKE '4%'
        `);
        const trendCogsResult = await db.execute(sql`
          SELECT COALESCE(SUM(CAST(jl.debit AS numeric) - CAST(jl.credit AS numeric)), 0) AS cogs
          FROM journal_lines jl
          INNER JOIN journal_entries je ON je.id = jl.journal_entry_id
          INNER JOIN accounts a ON a.id = jl.account_id
          WHERE je.company_id = ${companyId}
            AND je.status IN ('posted','approved')
            AND je.entry_date >= ${monthStart}
            AND je.entry_date <= ${trendEndStr}
            AND (a.code LIKE '500%' OR a.code LIKE '510%')
        `);

        const tRev = Number((trendRevResult.rows || trendRevResult)[0]?.revenue || 0);
        const tCogs = Number((trendCogsResult.rows || trendCogsResult)[0]?.cogs || 0);
        const tDaysElapsed = Math.max(1, Math.ceil((endDate.getTime() - new Date(monthStart).getTime()) / 86400000));
        const tDailyRev = tRev / tDaysElapsed;
        const tDailyCogs = tCogs / tDaysElapsed;

        const tDso = tDailyRev > 0 ? Math.round(tAr / tDailyRev) : 0;
        const tDio = tDailyCogs > 0 ? Math.round(tInv / tDailyCogs) : 0;
        const tDpo = tDailyCogs > 0 ? Math.round(tAp / tDailyCogs) : 0;

        monthlyTrend.push({
          month: monthLabel,
          ratio: cl > 0 ? Math.round((ca / cl) * 100) / 100 : 0,
          nwc: Math.round((ca - cl) * 100) / 100,
          ccc: tDio + tDso - tDpo,
        });
      }

      const alerts: { date: string; projectedBalance: number; scenario: string }[] = [];
      if (threshold > 0) {
        for (const fp of forecast) {
          if (fp.expected < threshold && (alerts.length === 0 || alerts[alerts.length - 1].date !== fp.date)) {
            alerts.push({ date: fp.date, projectedBalance: fp.expected, scenario: "expected" });
          }
          if (fp.worstCase < threshold && !alerts.find(a => a.date === fp.date && a.scenario === "worstCase")) {
            alerts.push({ date: fp.date, projectedBalance: fp.worstCase, scenario: "worstCase" });
          }
        }
      }

      const snapshot30 = forecast.find(f => f.day === 30);
      const snapshot60 = forecast.find(f => f.day === 60);
      const snapshot90 = forecast.find(f => f.day === 90);

      res.json({
        currentCash: Math.round(currentCash * 100) / 100,
        totalAR: Math.round(totalAR * 100) / 100,
        totalAP: Math.round(totalAP * 100) / 100,
        forecast,
        snapshots: {
          day30: snapshot30 || null,
          day60: snapshot60 || null,
          day90: snapshot90 || null,
        },
        workingCapital: {
          currentAssets: Math.round(currentAssets * 100) / 100,
          currentLiabilities: Math.round(currentLiabilities * 100) / 100,
          netWorkingCapital: Math.round(nwc * 100) / 100,
          workingCapitalRatio: Math.round(wcRatio * 100) / 100,
          cashConversionCycle: ccc,
          dso,
          dpo,
          dio,
          monthlyTrend,
        },
        alerts,
      });
    } catch (err: any) {
      console.error("[cash-flow-forecast] Error:", err.message);
      res.status(500).json({ message: err.message });
    }
  });
}
