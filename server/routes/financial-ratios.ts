import type { Express } from "express";
import { db } from "../db";
import { accounts, companies } from "@shared/schema";
import { eq } from "drizzle-orm";
import { requireAuth, requireModule } from "../route-middleware";
import { getAccountBalances, balanceMapFromRows } from "../report-queries";
import { getCachedReport, setCachedReport, logReportTiming } from "./report-cache";
import OpenAI from "openai";

const openai = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
      ...(process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ? { baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL } : {}),
    })
  : null;

interface IndustryBenchmark {
  currentRatio: { min: number; max: number; ideal: number };
  quickRatio: { min: number; max: number; ideal: number };
  debtToEquity: { min: number; max: number; ideal: number };
  debtRatio: { min: number; max: number; ideal: number };
  roa: { min: number; max: number; ideal: number };
  roe: { min: number; max: number; ideal: number };
  netProfitMargin: { min: number; max: number; ideal: number };
  grossProfitMargin: { min: number; max: number; ideal: number };
  dso: { min: number; max: number; ideal: number };
  dpo: { min: number; max: number; ideal: number };
  dio: { min: number; max: number; ideal: number };
  assetTurnover: { min: number; max: number; ideal: number };
}

const INDUSTRY_BENCHMARKS: Record<string, IndustryBenchmark> = {
  manufacturing: {
    currentRatio: { min: 1.2, max: 2.5, ideal: 1.8 },
    quickRatio: { min: 0.8, max: 1.5, ideal: 1.0 },
    debtToEquity: { min: 0.3, max: 1.5, ideal: 0.8 },
    debtRatio: { min: 0.2, max: 0.6, ideal: 0.4 },
    roa: { min: 3, max: 15, ideal: 8 },
    roe: { min: 8, max: 25, ideal: 15 },
    netProfitMargin: { min: 3, max: 15, ideal: 8 },
    grossProfitMargin: { min: 20, max: 45, ideal: 30 },
    dso: { min: 20, max: 60, ideal: 35 },
    dpo: { min: 25, max: 60, ideal: 40 },
    dio: { min: 30, max: 90, ideal: 50 },
    assetTurnover: { min: 0.8, max: 2.0, ideal: 1.2 },
  },
  service: {
    currentRatio: { min: 1.0, max: 3.0, ideal: 2.0 },
    quickRatio: { min: 0.8, max: 2.5, ideal: 1.5 },
    debtToEquity: { min: 0.2, max: 1.2, ideal: 0.5 },
    debtRatio: { min: 0.15, max: 0.55, ideal: 0.35 },
    roa: { min: 5, max: 20, ideal: 12 },
    roe: { min: 10, max: 30, ideal: 18 },
    netProfitMargin: { min: 5, max: 25, ideal: 12 },
    grossProfitMargin: { min: 30, max: 70, ideal: 50 },
    dso: { min: 15, max: 45, ideal: 25 },
    dpo: { min: 15, max: 45, ideal: 30 },
    dio: { min: 0, max: 15, ideal: 5 },
    assetTurnover: { min: 1.0, max: 3.0, ideal: 1.8 },
  },
  retail: {
    currentRatio: { min: 1.0, max: 2.0, ideal: 1.5 },
    quickRatio: { min: 0.5, max: 1.2, ideal: 0.8 },
    debtToEquity: { min: 0.5, max: 2.0, ideal: 1.0 },
    debtRatio: { min: 0.3, max: 0.65, ideal: 0.45 },
    roa: { min: 3, max: 12, ideal: 6 },
    roe: { min: 8, max: 20, ideal: 12 },
    netProfitMargin: { min: 2, max: 8, ideal: 4 },
    grossProfitMargin: { min: 15, max: 40, ideal: 25 },
    dso: { min: 5, max: 30, ideal: 15 },
    dpo: { min: 20, max: 50, ideal: 35 },
    dio: { min: 20, max: 60, ideal: 35 },
    assetTurnover: { min: 1.5, max: 4.0, ideal: 2.5 },
  },
  sme: {
    currentRatio: { min: 1.0, max: 2.5, ideal: 1.5 },
    quickRatio: { min: 0.7, max: 1.5, ideal: 1.0 },
    debtToEquity: { min: 0.3, max: 1.5, ideal: 0.8 },
    debtRatio: { min: 0.2, max: 0.6, ideal: 0.4 },
    roa: { min: 3, max: 15, ideal: 8 },
    roe: { min: 8, max: 25, ideal: 15 },
    netProfitMargin: { min: 3, max: 15, ideal: 8 },
    grossProfitMargin: { min: 20, max: 50, ideal: 30 },
    dso: { min: 15, max: 60, ideal: 30 },
    dpo: { min: 20, max: 60, ideal: 35 },
    dio: { min: 15, max: 60, ideal: 30 },
    assetTurnover: { min: 0.8, max: 2.5, ideal: 1.5 },
  },
};

function calculateHealthScore(ratios: any, benchmark: IndustryBenchmark): { score: number; label: string; color: string; breakdown: any[] } {
  const weights = {
    currentRatio: 15,
    quickRatio: 10,
    debtToEquity: 15,
    debtRatio: 10,
    roa: 12,
    roe: 12,
    netProfitMargin: 10,
    grossProfitMargin: 8,
    assetTurnover: 8,
  };

  const breakdown: any[] = [];
  let totalScore = 0;
  let totalWeight = 0;

  for (const [key, weight] of Object.entries(weights)) {
    const value = ratios[key];
    const bench = (benchmark as any)[key];
    if (value === null || value === undefined || !bench) continue;

    let score: number;

    if (key === 'debtToEquity' || key === 'debtRatio') {
      const v = Math.abs(value);
      if (v <= bench.ideal) score = 100;
      else if (v <= bench.max) score = 100 - ((v - bench.ideal) / (bench.max - bench.ideal)) * 50;
      else score = Math.max(0, 50 - ((v - bench.max) / bench.max) * 50);
    } else {
      if (value < 0) {
        score = 0;
      } else if (value >= bench.ideal) {
        score = 100;
      } else if (value >= bench.min) {
        score = 50 + ((value - bench.min) / (bench.ideal - bench.min)) * 50;
      } else {
        score = Math.max(0, (value / bench.min) * 50);
      }
    }

    score = Math.min(100, Math.max(0, score));
    totalScore += score * weight;
    totalWeight += weight;

    breakdown.push({ key, value, score: Math.round(score), weight, benchMin: bench.min, benchMax: bench.max, benchIdeal: bench.ideal });
  }

  const finalScore = totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;

  let label: string;
  let color: string;
  if (finalScore >= 80) { label = "ดีมาก"; color = "#22c55e"; }
  else if (finalScore >= 60) { label = "ดี"; color = "#3b82f6"; }
  else if (finalScore >= 40) { label = "พอใช้"; color = "#f59e0b"; }
  else if (finalScore >= 20) { label = "ต้องปรับปรุง"; color = "#f97316"; }
  else { label = "อันตราย"; color = "#ef4444"; }

  return { score: finalScore, label, color, breakdown };
}

const VALID_INDUSTRIES = ["sme", "manufacturing", "service", "retail"];

function isValidISODate(d: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(new Date(d + "T00:00:00").getTime());
}

export function registerFinancialRatiosRoutes(app: Express) {
  app.get("/api/reports/financial-ratios", requireAuth, requireModule("accounting"), async (req, res) => {
    try {
      const _t0 = performance.now();
      const companyId = Number(req.query.companyId);
      const asOfDate = req.query.asOfDate as string;
      const industry = (req.query.industry as string) || "sme";
      if (!companyId || !asOfDate) return res.status(400).json({ message: "companyId, asOfDate required" });
      if (!isValidISODate(asOfDate)) return res.status(400).json({ message: "asOfDate must be YYYY-MM-DD" });
      if (!VALID_INDUSTRIES.includes(industry)) return res.status(400).json({ message: "industry must be one of: " + VALID_INDUSTRIES.join(", ") });

      const cached = getCachedReport("financial-ratios", companyId, { asOfDate, industry });
      if (cached) { logReportTiming("financial-ratios", companyId, performance.now() - _t0, null, true, { asOfDate }); return res.json(cached); }

      const user = req.user as any;
      const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
      if (company && company.tenantId && company.tenantId !== user.tenantId) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });

      const allAccounts = await db.select().from(accounts).where(eq(accounts.companyId, companyId)).orderBy(accounts.code);

      const bsRows = await getAccountBalances(companyId, null, asOfDate);
      const bsMap = balanceMapFromRows(bsRows);

      const year = new Date(asOfDate).getFullYear();
      const startOfYear = `${year}-01-01`;
      const isRows = await getAccountBalances(companyId, startOfYear, asOfDate);
      const isMap = balanceMapFromRows(isRows);

      const getBalance = (acct: any, map: Map<number, { debit: number; credit: number }>) => {
        const bal = map.get(acct.id) || { debit: 0, credit: 0 };
        if (acct.type === "asset" || acct.type === "expense") return bal.debit - bal.credit;
        return bal.credit - bal.debit;
      };

      let totalCurrentAssets = 0;
      let totalAssets = 0;
      let totalCurrentLiabilities = 0;
      let totalLiabilities = 0;
      let totalEquity = 0;
      let cashBalance = 0;
      let inventoryBalance = 0;
      let arBalance = 0;
      let apBalance = 0;

      for (const acct of allAccounts) {
        const balance = getBalance(acct, bsMap);
        if (balance === 0) continue;
        const code = acct.code || "";

        if (acct.type === "asset") {
          totalAssets += balance;
          if (code.startsWith("1")) {
            if (code < "1500" || code.startsWith("11") || code.startsWith("12") || code.startsWith("13") || code.startsWith("14")) {
              totalCurrentAssets += balance;
            }
          }
          if (code.startsWith("1000") || code.startsWith("1001") || code.startsWith("1010") || code.startsWith("110")) {
            cashBalance += balance;
          }
          if (code.startsWith("112") || code.startsWith("1120") || code.startsWith("113") || code.startsWith("1200")) {
            arBalance += balance;
          }
          if (code.startsWith("114") || code.startsWith("115") || code.startsWith("1140") || code.startsWith("1150") || code.startsWith("1300")) {
            inventoryBalance += balance;
          }
        } else if (acct.type === "liability") {
          totalLiabilities += balance;
          if (code.startsWith("2")) {
            if (code < "2500" || code.startsWith("21") || code.startsWith("22") || code.startsWith("23") || code.startsWith("24")) {
              totalCurrentLiabilities += balance;
            }
          }
          if (code.startsWith("212") || code.startsWith("2120") || code.startsWith("2200")) {
            apBalance += balance;
          }
        } else if (acct.type === "equity") {
          totalEquity += balance;
        }
      }

      let totalRevenue = 0;
      let totalCOGS = 0;
      let totalExpenseAmt = 0;
      let interestExpense = 0;

      for (const acct of allAccounts) {
        const bal = isMap.get(acct.id) || { debit: 0, credit: 0 };
        const code = acct.code || "";

        if (acct.type === "revenue") {
          totalRevenue += bal.credit - bal.debit;
        } else if (acct.type === "expense") {
          const expBal = bal.debit - bal.credit;
          totalExpenseAmt += expBal;
          if (code.startsWith("5") && (code.startsWith("50") || code.startsWith("51"))) {
            totalCOGS += expBal;
          }
          if (code.includes("ดอกเบี้ย") || code.startsWith("5300") || code.startsWith("5400")) {
            interestExpense += expBal;
          }
        }
      }

      const retainedEarnings = totalRevenue - totalExpenseAmt;
      totalEquity += retainedEarnings;

      const netIncome = totalRevenue - totalExpenseAmt;
      const grossProfit = totalRevenue - totalCOGS;

      const currentRatio = totalCurrentLiabilities > 0 ? totalCurrentAssets / totalCurrentLiabilities : null;
      const quickRatio = totalCurrentLiabilities > 0 ? (totalCurrentAssets - inventoryBalance) / totalCurrentLiabilities : null;
      const cashRatio = totalCurrentLiabilities > 0 ? cashBalance / totalCurrentLiabilities : null;

      const debtToEquity = totalEquity !== 0 ? totalLiabilities / totalEquity : null;
      const debtRatio = totalAssets > 0 ? totalLiabilities / totalAssets : null;
      const interestCoverage = interestExpense > 0 ? (netIncome + interestExpense) / interestExpense : null;

      const roa = totalAssets > 0 ? (netIncome / totalAssets) * 100 : null;
      const roe = totalEquity > 0 ? (netIncome / totalEquity) * 100 : null;
      const netProfitMargin = totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : null;
      const grossProfitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : null;

      const daysPeriod = Math.max(1, Math.ceil((new Date(asOfDate).getTime() - new Date(startOfYear).getTime()) / (1000 * 60 * 60 * 24)));
      const dso = totalRevenue > 0 ? (arBalance / totalRevenue) * daysPeriod : null;
      const dpo = totalCOGS > 0 ? (apBalance / totalCOGS) * daysPeriod : null;
      const dio = totalCOGS > 0 ? (inventoryBalance / totalCOGS) * daysPeriod : null;
      const assetTurnover = totalAssets > 0 ? totalRevenue / totalAssets : null;

      const ratios = {
        liquidity: {
          currentRatio: currentRatio !== null ? Math.round(currentRatio * 100) / 100 : null,
          quickRatio: quickRatio !== null ? Math.round(quickRatio * 100) / 100 : null,
          cashRatio: cashRatio !== null ? Math.round(cashRatio * 100) / 100 : null,
        },
        leverage: {
          debtToEquity: debtToEquity !== null ? Math.round(debtToEquity * 100) / 100 : null,
          debtRatio: debtRatio !== null ? Math.round(debtRatio * 100) / 100 : null,
          interestCoverage: interestCoverage !== null ? Math.round(interestCoverage * 100) / 100 : null,
        },
        profitability: {
          roa: roa !== null ? Math.round(roa * 100) / 100 : null,
          roe: roe !== null ? Math.round(roe * 100) / 100 : null,
          netProfitMargin: netProfitMargin !== null ? Math.round(netProfitMargin * 100) / 100 : null,
          grossProfitMargin: grossProfitMargin !== null ? Math.round(grossProfitMargin * 100) / 100 : null,
        },
        efficiency: {
          dso: dso !== null ? Math.round(dso * 100) / 100 : null,
          dpo: dpo !== null ? Math.round(dpo * 100) / 100 : null,
          dio: dio !== null ? Math.round(dio * 100) / 100 : null,
          assetTurnover: assetTurnover !== null ? Math.round(assetTurnover * 100) / 100 : null,
        },
      };

      const flatRatios = {
        currentRatio: ratios.liquidity.currentRatio,
        quickRatio: ratios.liquidity.quickRatio,
        debtToEquity: ratios.leverage.debtToEquity,
        debtRatio: ratios.leverage.debtRatio,
        roa: ratios.profitability.roa,
        roe: ratios.profitability.roe,
        netProfitMargin: ratios.profitability.netProfitMargin,
        grossProfitMargin: ratios.profitability.grossProfitMargin,
        assetTurnover: ratios.efficiency.assetTurnover,
      };

      const benchmark = INDUSTRY_BENCHMARKS[industry] || INDUSTRY_BENCHMARKS.sme;
      const healthScore = calculateHealthScore(flatRatios, benchmark);

      const summary = {
        totalAssets,
        totalLiabilities,
        totalEquity,
        totalCurrentAssets,
        totalCurrentLiabilities,
        cashBalance,
        arBalance,
        apBalance,
        inventoryBalance,
        totalRevenue,
        totalCOGS,
        totalExpense: totalExpenseAmt,
        netIncome,
        grossProfit,
      };

      const result = { ratios, healthScore, benchmark, summary, industry, asOfDate };
      setCachedReport("financial-ratios", companyId, { asOfDate, industry }, result);
      logReportTiming("financial-ratios", companyId, performance.now() - _t0, null, false, { asOfDate });
      res.json(result);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/reports/financial-ratios/trend", requireAuth, requireModule("accounting"), async (req, res) => {
    try {
      const companyId = Number(req.query.companyId);
      const endDate = req.query.endDate as string;
      const months = Math.min(Math.max(Number(req.query.months) || 12, 1), 24);
      if (!companyId || !endDate) return res.status(400).json({ message: "companyId, endDate required" });
      if (!isValidISODate(endDate)) return res.status(400).json({ message: "endDate must be YYYY-MM-DD" });

      const user = req.user as any;
      const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
      if (company && company.tenantId && company.tenantId !== user.tenantId) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });

      const allAccounts = await db.select().from(accounts).where(eq(accounts.companyId, companyId)).orderBy(accounts.code);

      const trendData: any[] = [];
      const endD = new Date(endDate + "T00:00:00");

      for (let i = months - 1; i >= 0; i--) {
        const targetYear = endD.getFullYear();
        const targetMonth = endD.getMonth() - i;
        const lastDayOfMonth = new Date(targetYear, targetMonth + 1, 0);
        const monthEnd = `${lastDayOfMonth.getFullYear()}-${String(lastDayOfMonth.getMonth() + 1).padStart(2, '0')}-${String(lastDayOfMonth.getDate()).padStart(2, '0')}`;
        const monthStart = `${lastDayOfMonth.getFullYear()}-01-01`;
        const monthLabel = `${lastDayOfMonth.getFullYear()}-${String(lastDayOfMonth.getMonth() + 1).padStart(2, '0')}`;

        const bsRows = await getAccountBalances(companyId, null, monthEnd);
        const bsMap = balanceMapFromRows(bsRows);

        const isRows = await getAccountBalances(companyId, monthStart, monthEnd);
        const isMap = balanceMapFromRows(isRows);

        let totalCurrentAssets = 0, totalAssets = 0, totalCurrentLiabilities = 0, totalLiabilities = 0, totalEquity = 0;
        let totalRevenue = 0, totalExpenseAmt = 0, totalCOGS = 0;

        for (const acct of allAccounts) {
          const bsBal = bsMap.get(acct.id) || { debit: 0, credit: 0 };
          const isBal = isMap.get(acct.id) || { debit: 0, credit: 0 };
          const code = acct.code || "";
          const balance = (acct.type === "asset" || acct.type === "expense") ? bsBal.debit - bsBal.credit : bsBal.credit - bsBal.debit;

          if (acct.type === "asset" && balance !== 0) {
            totalAssets += balance;
            if (code < "1500" || code.startsWith("11") || code.startsWith("12") || code.startsWith("13") || code.startsWith("14")) {
              totalCurrentAssets += balance;
            }
          } else if (acct.type === "liability" && balance !== 0) {
            totalLiabilities += balance;
            if (code < "2500" || code.startsWith("21") || code.startsWith("22") || code.startsWith("23") || code.startsWith("24")) {
              totalCurrentLiabilities += balance;
            }
          } else if (acct.type === "equity") {
            totalEquity += balance;
          }

          if (acct.type === "revenue") totalRevenue += isBal.credit - isBal.debit;
          if (acct.type === "expense") {
            const exp = isBal.debit - isBal.credit;
            totalExpenseAmt += exp;
            if (code.startsWith("50") || code.startsWith("51")) totalCOGS += exp;
          }
        }

        const retainedEarnings = totalRevenue - totalExpenseAmt;
        totalEquity += retainedEarnings;
        const netIncome = totalRevenue - totalExpenseAmt;

        trendData.push({
          month: monthLabel,
          currentRatio: totalCurrentLiabilities > 0 ? Math.round((totalCurrentAssets / totalCurrentLiabilities) * 100) / 100 : null,
          debtToEquity: totalEquity !== 0 ? Math.round((totalLiabilities / totalEquity) * 100) / 100 : null,
          roa: totalAssets > 0 ? Math.round(((netIncome / totalAssets) * 100) * 100) / 100 : null,
          roe: totalEquity > 0 ? Math.round(((netIncome / totalEquity) * 100) * 100) / 100 : null,
          netProfitMargin: totalRevenue > 0 ? Math.round(((netIncome / totalRevenue) * 100) * 100) / 100 : null,
          grossProfitMargin: totalRevenue > 0 ? Math.round((((totalRevenue - totalCOGS) / totalRevenue) * 100) * 100) / 100 : null,
          assetTurnover: totalAssets > 0 ? Math.round((totalRevenue / totalAssets) * 100) / 100 : null,
        });
      }

      res.json({ trend: trendData });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/reports/financial-ratios/ai-recommendations", requireAuth, requireModule("accounting"), async (req, res) => {
    try {
      if (!openai) return res.status(400).json({ message: "AI not configured" });

      const companyId = Number(req.body.companyId);
      const asOfDate = req.body.asOfDate as string;
      const industry = (req.body.industry as string) || "sme";
      if (!companyId || !asOfDate) return res.status(400).json({ message: "companyId, asOfDate required" });
      if (!isValidISODate(asOfDate)) return res.status(400).json({ message: "asOfDate must be YYYY-MM-DD" });
      if (!VALID_INDUSTRIES.includes(industry)) return res.status(400).json({ message: "invalid industry" });

      const user = req.user as any;
      const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
      if (company && company.tenantId && company.tenantId !== user.tenantId) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });

      const cached = getCachedReport("financial-ratios", companyId, { asOfDate, industry });
      if (!cached) return res.status(400).json({ message: "กรุณาวิเคราะห์อัตราส่วนก่อน" });

      const { ratios, healthScore, summary } = cached as any;

      const prompt = `คุณเป็นนักวิเคราะห์การเงินผู้เชี่ยวชาญ กรุณาวิเคราะห์อัตราส่วนทางการเงินต่อไปนี้ แล้วให้คำแนะนำเป็นภาษาไทย:

ประเภทธุรกิจ: ${industry === 'manufacturing' ? 'ผลิต' : industry === 'service' ? 'บริการ' : industry === 'retail' ? 'ค้าปลีก' : 'SME ทั่วไป'}
คะแนนสุขภาพงบการเงิน: ${healthScore?.score || 0}/100 (${healthScore?.label || ''})

อัตราส่วนสภาพคล่อง:
- Current Ratio: ${ratios.liquidity?.currentRatio ?? 'N/A'}
- Quick Ratio: ${ratios.liquidity?.quickRatio ?? 'N/A'}
- Cash Ratio: ${ratios.liquidity?.cashRatio ?? 'N/A'}

อัตราส่วนหนี้สิน:
- Debt-to-Equity: ${ratios.leverage?.debtToEquity ?? 'N/A'}
- Debt Ratio: ${ratios.leverage?.debtRatio ?? 'N/A'}
- Interest Coverage: ${ratios.leverage?.interestCoverage ?? 'N/A'}

อัตราส่วนความสามารถในการทำกำไร:
- ROA: ${ratios.profitability?.roa ?? 'N/A'}%
- ROE: ${ratios.profitability?.roe ?? 'N/A'}%
- Net Profit Margin: ${ratios.profitability?.netProfitMargin ?? 'N/A'}%
- Gross Profit Margin: ${ratios.profitability?.grossProfitMargin ?? 'N/A'}%

อัตราส่วนประสิทธิภาพ:
- DSO: ${ratios.efficiency?.dso ?? 'N/A'} วัน
- DPO: ${ratios.efficiency?.dpo ?? 'N/A'} วัน
- DIO: ${ratios.efficiency?.dio ?? 'N/A'} วัน
- Asset Turnover: ${ratios.efficiency?.assetTurnover ?? 'N/A'}

ข้อมูลสรุป:
- สินทรัพย์รวม: ${summary?.totalAssets?.toLocaleString() ?? 'N/A'}
- หนี้สินรวม: ${summary?.totalLiabilities?.toLocaleString() ?? 'N/A'}
- ส่วนของเจ้าของ: ${summary?.totalEquity?.toLocaleString() ?? 'N/A'}
- รายได้: ${summary?.totalRevenue?.toLocaleString() ?? 'N/A'}
- กำไรสุทธิ: ${summary?.netIncome?.toLocaleString() ?? 'N/A'}

กรุณาให้คำแนะนำ 3-5 ข้อ เน้นอัตราส่วนที่ผิดปกติหรือต้องปรับปรุง ตอบเป็น JSON array:
[{"title":"หัวข้อ","detail":"คำอธิบายและคำแนะนำ","severity":"warning|danger|info|success","ratioKey":"ชื่อ ratio ที่เกี่ยวข้อง"}]`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 1500,
      });

      const text = completion.choices[0]?.message?.content || "[]";
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      let recommendations: any[] = [];
      try {
        recommendations = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
      } catch {
        recommendations = [{ title: "ไม่สามารถวิเคราะห์ได้", detail: "กรุณาลองใหม่อีกครั้ง", severity: "info", ratioKey: "" }];
      }

      res.json({ recommendations });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}
