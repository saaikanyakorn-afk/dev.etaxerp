import type { Express } from "express";
import { db } from "../db";
import { sql, eq, and } from "drizzle-orm";
import { accounts, companies, financialBuffers } from "@shared/schema";
import { requireAuth, requireModule } from "../route-middleware";

const BUFFER_TYPES = ["survival", "development", "expansion", "protection"] as const;

export function registerFinancialManagementRoutes(app: Express) {

  app.get("/api/finance/management-dashboard", requireAuth, requireModule("accounting"), async (req, res) => {
    try {
      const companyId = Number(req.query.companyId);
      const period = (req.query.period as string) || "month";
      if (!companyId) return res.status(400).json({ message: "companyId required" });

      const user = req.user as any;
      const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
      if (company && company.tenantId && company.tenantId !== user.tenantId) {
        return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });
      }

      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;

      let periodStart: string;
      let periodEnd: string;
      let compareStart: string | null = null;
      let compareEnd: string | null = null;

      if (period === "quarter") {
        const q = Math.ceil(currentMonth / 3);
        const qStart = (q - 1) * 3 + 1;
        periodStart = `${currentYear}-${String(qStart).padStart(2, "0")}-01`;
        const qEndMonth = q * 3;
        const qEndDay = new Date(currentYear, qEndMonth, 0).getDate();
        periodEnd = `${currentYear}-${String(qEndMonth).padStart(2, "0")}-${qEndDay}`;
      } else if (period === "year") {
        periodStart = `${currentYear}-01-01`;
        periodEnd = `${currentYear}-12-31`;
      } else if (period === "compare") {
        periodStart = `${currentYear}-01-01`;
        periodEnd = `${currentYear}-12-31`;
        compareStart = `${currentYear - 1}-01-01`;
        compareEnd = `${currentYear - 1}-12-31`;
      } else {
        periodStart = `${currentYear}-${String(currentMonth).padStart(2, "0")}-01`;
        const lastDay = new Date(currentYear, currentMonth, 0).getDate();
        periodEnd = `${currentYear}-${String(currentMonth).padStart(2, "0")}-${lastDay}`;
      }

      const trendStart = new Date(currentYear, currentMonth - 7, 1);
      const trendStartStr = `${trendStart.getFullYear()}-${String(trendStart.getMonth() + 1).padStart(2, "0")}-01`;
      const trendEndStr = periodEnd;

      const monthlyData = await db.execute(sql`
        SELECT
          TO_CHAR(je.entry_date, 'YYYY-MM') AS "month",
          a.type AS "accountType",
          a.code AS "accountCode",
          COALESCE(SUM(CAST(jl.debit AS numeric)), 0) AS "totalDebit",
          COALESCE(SUM(CAST(jl.credit AS numeric)), 0) AS "totalCredit"
        FROM journal_lines jl
        INNER JOIN journal_entries je ON je.id = jl.journal_entry_id
        INNER JOIN accounts a ON a.id = jl.account_id
        WHERE je.company_id = ${companyId}
          AND je.status IN ('posted', 'approved')
          AND je.entry_date >= ${trendStartStr}
          AND je.entry_date <= ${trendEndStr}
        GROUP BY TO_CHAR(je.entry_date, 'YYYY-MM'), a.type, a.code
        ORDER BY "month"
      `);

      const rows = (monthlyData.rows || monthlyData) as any[];

      const monthMap = new Map<string, {
        revenue: number; expense: number; cogs: number;
        assets: number; currentAssets: number; fixedAssets: number;
        liabilities: number; currentLiabilities: number;
        equity: number; cash: number; ar: number; ap: number;
        depreciation: number; interest: number; tax: number;
      }>();

      for (const row of rows) {
        const m = row.month;
        if (!monthMap.has(m)) {
          monthMap.set(m, {
            revenue: 0, expense: 0, cogs: 0,
            assets: 0, currentAssets: 0, fixedAssets: 0,
            liabilities: 0, currentLiabilities: 0,
            equity: 0, cash: 0, ar: 0, ap: 0,
            depreciation: 0, interest: 0, tax: 0,
          });
        }
        const d = monthMap.get(m)!;
        const debit = Number(row.totalDebit) || 0;
        const credit = Number(row.totalCredit) || 0;
        const code = row.accountCode || "";
        const type = row.accountType;

        if (type === "revenue") {
          d.revenue += credit - debit;
        } else if (type === "expense") {
          const amt = debit - credit;
          d.expense += amt;
          if (code.startsWith("50") || code.startsWith("51")) d.cogs += amt;
          if (code.startsWith("15") || code.startsWith("16") || code.startsWith("17") || code.startsWith("18") || code.startsWith("19")) {
            d.fixedAssets += amt;
          }
          if (code.includes("5300") || code.includes("5400")) d.interest += amt;
          if (code.includes("5200") || code.includes("depreciation") || code.includes("ค่าเสื่อม")) d.depreciation += amt;
          if (code.includes("5500") || code.includes("tax") || code.includes("ภาษี")) d.tax += amt;
        } else if (type === "asset") {
          const amt = debit - credit;
          d.assets += amt;
          if (code.startsWith("10") || code.startsWith("11") || code.startsWith("12") || code.startsWith("13") || code.startsWith("14")) {
            d.currentAssets += amt;
          }
          if (code.startsWith("100") || code.startsWith("101") || code.startsWith("110")) {
            d.cash += amt;
          }
          if (code.startsWith("112") || code.startsWith("1200")) {
            d.ar += amt;
          }
          if (code.startsWith("15") || code.startsWith("16") || code.startsWith("17") || code.startsWith("18") || code.startsWith("19")) {
            d.fixedAssets += amt;
          }
        } else if (type === "liability") {
          const amt = credit - debit;
          d.liabilities += amt;
          if (code < "2500") d.currentLiabilities += amt;
          if (code.startsWith("200") || code.startsWith("210") || code.startsWith("211") || code.startsWith("212")) {
            d.ap += amt;
          }
        } else if (type === "equity") {
          d.equity += credit - debit;
        }
      }

      const months = Array.from(monthMap.keys()).sort();
      const last6 = months.slice(-6);

      const cumulative = {
        revenue: 0, expense: 0, cogs: 0,
        assets: 0, currentAssets: 0, fixedAssets: 0,
        liabilities: 0, currentLiabilities: 0,
        equity: 0, cash: 0, ar: 0, ap: 0,
        depreciation: 0, interest: 0, tax: 0,
      };

      for (const m of months) {
        const d = monthMap.get(m)!;
        cumulative.revenue += d.revenue;
        cumulative.expense += d.expense;
        cumulative.cogs += d.cogs;
        cumulative.assets += d.assets;
        cumulative.currentAssets += d.currentAssets;
        cumulative.fixedAssets += d.fixedAssets;
        cumulative.liabilities += d.liabilities;
        cumulative.currentLiabilities += d.currentLiabilities;
        cumulative.equity += d.equity;
        cumulative.cash += d.cash;
        cumulative.ar += d.ar;
        cumulative.ap += d.ap;
        cumulative.depreciation += d.depreciation;
        cumulative.interest += d.interest;
        cumulative.tax += d.tax;
      }

      const latestMonth = months.length > 0 ? monthMap.get(months[months.length - 1])! : cumulative;

      const totalAssets = cumulative.assets + cumulative.fixedAssets;
      const netProfit = cumulative.revenue - cumulative.expense;
      const grossProfit = cumulative.revenue - cumulative.cogs;
      const operatingExpenses = cumulative.expense - cumulative.cogs - cumulative.interest - cumulative.tax - cumulative.depreciation;
      const ebitda = cumulative.revenue - cumulative.cogs - operatingExpenses;
      const contributionMargin = cumulative.revenue > 0 ? grossProfit / cumulative.revenue : 0;
      const breakEvenRevenue = contributionMargin > 0 ? (cumulative.expense - cumulative.cogs) / contributionMargin : 0;

      const topMetrics = {
        cashPosition: cumulative.cash,
        netProfit,
        ebitda,
        trend: last6.map(m => {
          const d = monthMap.get(m)!;
          const mNetProfit = d.revenue - d.expense;
          const mGrossProfit = d.revenue - d.cogs;
          const mOpex = d.expense - d.cogs - d.interest - d.tax - d.depreciation;
          return {
            month: m,
            cashPosition: d.cash,
            netProfit: mNetProfit,
            ebitda: d.revenue - d.cogs - mOpex,
            revenue: d.revenue,
            expense: d.expense,
          };
        }),
      };

      const financialPosition = {
        revenue: cumulative.revenue,
        expenses: cumulative.expense,
        accountsReceivable: cumulative.ar,
        accountsPayable: cumulative.ap,
        bookBalance: cumulative.cash,
      };

      const roa = totalAssets > 0 ? netProfit / totalAssets : 0;
      const opexRatio = cumulative.revenue > 0 ? operatingExpenses / cumulative.revenue : 0;
      const capex = cumulative.fixedAssets;

      const cfoMetrics = {
        roa,
        opexRatio,
        capex,
        breakEvenRevenue,
      };

      const netProfitMargin = cumulative.revenue > 0 ? netProfit / cumulative.revenue : 0;
      const currentRatio = cumulative.currentLiabilities > 0 ? cumulative.currentAssets / cumulative.currentLiabilities : 0;
      const costToRevenue = cumulative.revenue > 0 ? cumulative.expense / cumulative.revenue : 0;

      const revenueGrowth = (() => {
        if (last6.length < 2) return 0;
        const first = monthMap.get(last6[0])!.revenue;
        const lastR = monthMap.get(last6[last6.length - 1])!.revenue;
        return first > 0 ? (lastR - first) / first : 0;
      })();

      const healthIndicators = {
        profitability: {
          value: netProfitMargin,
          status: netProfitMargin >= 0.1 ? "good" : netProfitMargin >= 0.03 ? "caution" : netProfitMargin >= 0 ? "risk" : "risk",
        },
        liquidity: {
          value: currentRatio,
          status: cumulative.currentAssets === 0 && cumulative.currentLiabilities === 0 ? "nodata" : currentRatio >= 1.5 ? "good" : currentRatio >= 1.0 ? "caution" : "risk",
        },
        costDiscipline: {
          value: costToRevenue,
          status: cumulative.revenue === 0 && cumulative.expense === 0 ? "nodata" : costToRevenue <= 0.85 ? "good" : costToRevenue <= 0.95 ? "caution" : "risk",
        },
        growthReadiness: {
          value: revenueGrowth,
          status: last6.length < 2 ? "nodata" : revenueGrowth >= 0.1 ? "good" : revenueGrowth >= 0 ? "caution" : "risk",
        },
      };

      const buffers = await db.select().from(financialBuffers).where(eq(financialBuffers.companyId, companyId));
      const bufferMap: Record<string, number> = {};
      for (const b of buffers) {
        bufferMap[b.bufferType] = Number(b.targetAmount) || 0;
      }

      const financialBuffer = BUFFER_TYPES.map(type => ({
        type,
        targetAmount: bufferMap[type] || 0,
        currentAmount: cumulative.cash,
        percentage: bufferMap[type] > 0 ? Math.min((cumulative.cash / bufferMap[type]) * 100, 100) : 0,
      }));

      let compareData = null;
      if (compareStart && compareEnd) {
        const prevRows = await db.execute(sql`
          SELECT
            a.type AS "accountType",
            COALESCE(SUM(CAST(jl.debit AS numeric)), 0) AS "totalDebit",
            COALESCE(SUM(CAST(jl.credit AS numeric)), 0) AS "totalCredit"
          FROM journal_lines jl
          INNER JOIN journal_entries je ON je.id = jl.journal_entry_id
          INNER JOIN accounts a ON a.id = jl.account_id
          WHERE je.company_id = ${companyId}
            AND je.status IN ('posted', 'approved')
            AND je.entry_date >= ${compareStart}
            AND je.entry_date <= ${compareEnd}
          GROUP BY a.type
        `);
        const prevData = (prevRows.rows || prevRows) as any[];
        let prevRevenue = 0, prevExpense = 0;
        for (const r of prevData) {
          if (r.accountType === "revenue") prevRevenue += Number(r.totalCredit) - Number(r.totalDebit);
          if (r.accountType === "expense") prevExpense += Number(r.totalDebit) - Number(r.totalCredit);
        }
        compareData = {
          prevRevenue,
          prevExpense,
          prevNetProfit: prevRevenue - prevExpense,
          revenueChange: prevRevenue > 0 ? (cumulative.revenue - prevRevenue) / prevRevenue : 0,
          profitChange: (prevRevenue - prevExpense) !== 0 ? (netProfit - (prevRevenue - prevExpense)) / Math.abs(prevRevenue - prevExpense) : 0,
        };
      }

      res.json({
        period,
        periodStart,
        periodEnd,
        topMetrics,
        financialPosition,
        cfoMetrics,
        healthIndicators,
        financialBuffer,
        compareData,
      });
    } catch (e: any) {
      console.error("Financial Management Dashboard error:", e.message);
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/finance/buffers", requireAuth, async (req, res) => {
    try {
      const companyId = Number(req.query.companyId);
      if (!companyId) return res.status(400).json({ message: "companyId required" });
      const buffers = await db.select().from(financialBuffers).where(eq(financialBuffers.companyId, companyId));
      res.json(buffers);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.put("/api/finance/buffers", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const { companyId, buffers: bufferData } = req.body;
      if (!companyId || !Array.isArray(bufferData)) return res.status(400).json({ message: "companyId and buffers[] required" });

      for (const b of bufferData) {
        if (!BUFFER_TYPES.includes(b.bufferType)) continue;
        const existing = await db.select().from(financialBuffers)
          .where(and(eq(financialBuffers.companyId, companyId), eq(financialBuffers.bufferType, b.bufferType)));

        if (existing.length > 0) {
          await db.update(financialBuffers)
            .set({ targetAmount: String(b.targetAmount), updatedBy: user.id, updatedAt: new Date() })
            .where(eq(financialBuffers.id, existing[0].id));
        } else {
          await db.insert(financialBuffers).values({
            companyId,
            bufferType: b.bufferType,
            targetAmount: String(b.targetAmount),
            updatedBy: user.id,
          });
        }
      }

      const result = await db.select().from(financialBuffers).where(eq(financialBuffers.companyId, companyId));
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });
}
