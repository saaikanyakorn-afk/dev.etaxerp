import type { Express } from "express";
import { db, pool } from "../db";
import { budgets, accounts, notifications, companies } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth, requireModule } from "../route-middleware";
import { z } from "zod";

const budgetItemSchema = z.object({
  accountCode: z.string().min(1),
  accountName: z.string().min(1),
  accountType: z.enum(["revenue", "expense"]),
  month: z.number().int().min(1).max(12),
  amount: z.number(),
});

const saveBudgetSchema = z.object({
  companyId: z.number().int().positive(),
  year: z.number().int().min(2000).max(2100),
  items: z.array(budgetItemSchema),
});

const copyBudgetSchema = z.object({
  companyId: z.number().int().positive(),
  sourceYear: z.number().int().min(2000).max(2100),
  targetYear: z.number().int().min(2000).max(2100),
  adjustPercent: z.union([z.string(), z.number()]).optional().default("0"),
});

async function verifyTenantAccess(companyId: number, user: any): Promise<boolean> {
  const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
  if (company && company.tenantId && company.tenantId !== user.tenantId) {
    return false;
  }
  return true;
}

export function registerBudgetRoutes(app: Express) {
  app.get("/api/budgets", requireAuth, requireModule("accounting"), async (req, res) => {
    try {
      const companyId = Number(req.query.companyId);
      const year = Number(req.query.year);
      if (!companyId || !year) return res.status(400).json({ message: "companyId and year required" });

      const user = req.user as any;
      if (!(await verifyTenantAccess(companyId, user))) {
        return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });
      }

      const version = req.query.version ? Number(req.query.version) : null;

      let rows;
      if (version) {
        rows = await db.select().from(budgets)
          .where(and(eq(budgets.companyId, companyId), eq(budgets.year, year), eq(budgets.version, version)))
          .orderBy(budgets.accountCode, budgets.month);
      } else {
        const maxVerResult = await db.execute(sql`
          SELECT COALESCE(MAX(version), 0) AS max_ver FROM budgets WHERE company_id = ${companyId} AND year = ${year}
        `);
        const maxVer = (maxVerResult.rows?.[0] as any)?.max_ver || 0;
        if (maxVer === 0) {
          return res.json([]);
        }
        rows = await db.select().from(budgets)
          .where(and(eq(budgets.companyId, companyId), eq(budgets.year, year), eq(budgets.version, maxVer)))
          .orderBy(budgets.accountCode, budgets.month);
      }

      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/budgets/save", requireAuth, requireModule("accounting"), async (req, res) => {
    try {
      const parsed = saveBudgetSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid request", errors: parsed.error.flatten() });
      }
      const { companyId, year, items } = parsed.data;

      const user = req.user as any;
      if (!(await verifyTenantAccess(companyId, user))) {
        return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        const versionResult = await client.query(
          "SELECT COALESCE(MAX(version), 0) AS max_ver FROM budgets WHERE company_id = $1 AND year = $2",
          [companyId, year]
        );
        const newVersion = (versionResult.rows[0]?.max_ver || 0) + 1;

        const toInsert = items.filter(item => item.amount !== 0).map(item => ({
          companyId,
          accountCode: item.accountCode,
          accountName: item.accountName,
          accountType: item.accountType,
          year,
          month: item.month,
          amount: String(item.amount),
          version: newVersion,
          createdBy: user.id,
        }));

        if (toInsert.length > 0) {
          const batchSize = 200;
          for (let i = 0; i < toInsert.length; i += batchSize) {
            const batch = toInsert.slice(i, i + batchSize);
            const values: any[] = [];
            const placeholders = batch.map((item, idx) => {
              const base = idx * 9;
              values.push(item.companyId, item.accountCode, item.accountName, item.accountType, item.year, item.month, item.amount, item.version, item.createdBy);
              return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9})`;
            }).join(", ");
            await client.query(
              `INSERT INTO budgets (company_id, account_code, account_name, account_type, year, month, amount, version, created_by) VALUES ${placeholders}`,
              values
            );
          }
        }

        await client.query("COMMIT");
        res.json({ success: true, count: toInsert.length, version: newVersion });
      } catch (txErr) {
        await client.query("ROLLBACK");
        throw txErr;
      } finally {
        client.release();
      }
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/budgets/copy-year", requireAuth, requireModule("accounting"), async (req, res) => {
    try {
      const parsed = copyBudgetSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid request", errors: parsed.error.flatten() });
      }
      const { companyId, sourceYear, targetYear, adjustPercent } = parsed.data;

      const user = req.user as any;
      if (!(await verifyTenantAccess(companyId, user))) {
        return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });
      }

      const sourceRows = await db.select().from(budgets)
        .where(and(eq(budgets.companyId, companyId), eq(budgets.year, sourceYear)));

      if (sourceRows.length === 0) {
        return res.status(400).json({ message: `ไม่พบข้อมูลงบประมาณปี ${sourceYear}` });
      }

      const multiplier = 1 + (parseFloat(String(adjustPercent)) / 100);

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        const versionResult = await client.query(
          "SELECT COALESCE(MAX(version), 0) AS max_ver FROM budgets WHERE company_id = $1 AND year = $2",
          [companyId, targetYear]
        );
        const newVersion = (versionResult.rows[0]?.max_ver || 0) + 1;

        const newRows = sourceRows.map(row => ({
          companyId,
          accountCode: row.accountCode,
          accountName: row.accountName,
          accountType: row.accountType,
          year: targetYear,
          month: row.month,
          amount: String(Math.round(parseFloat(row.amount) * multiplier * 100) / 100),
          version: newVersion,
          createdBy: user.id,
        }));

        if (newRows.length > 0) {
          const batchSize = 200;
          for (let i = 0; i < newRows.length; i += batchSize) {
            const batch = newRows.slice(i, i + batchSize);
            const values: any[] = [];
            const placeholders = batch.map((item, idx) => {
              const base = idx * 9;
              values.push(item.companyId, item.accountCode, item.accountName, item.accountType, item.year, item.month, item.amount, item.version, item.createdBy);
              return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9})`;
            }).join(", ");
            await client.query(
              `INSERT INTO budgets (company_id, account_code, account_name, account_type, year, month, amount, version, created_by) VALUES ${placeholders}`,
              values
            );
          }
        }

        await client.query("COMMIT");
        res.json({ success: true, count: newRows.length, version: newVersion });
      } catch (txErr) {
        await client.query("ROLLBACK");
        throw txErr;
      } finally {
        client.release();
      }
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/budgets/years", requireAuth, requireModule("accounting"), async (req, res) => {
    try {
      const companyId = Number(req.query.companyId);
      if (!companyId) return res.status(400).json({ message: "companyId required" });

      const user = req.user as any;
      if (!(await verifyTenantAccess(companyId, user))) {
        return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });
      }

      const rows = await db.execute(sql`
        SELECT DISTINCT year FROM budgets WHERE company_id = ${companyId} ORDER BY year DESC
      `);
      const years = ((rows.rows || rows) as any[]).map(r => r.year);
      res.json(years);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/reports/budget-vs-actual", requireAuth, requireModule("accounting"), async (req, res) => {
    try {
      const companyId = Number(req.query.companyId);
      const year = Number(req.query.year);
      if (!companyId || !year) return res.status(400).json({ message: "companyId, year required" });

      const user = req.user as any;
      if (!(await verifyTenantAccess(companyId, user))) {
        return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });
      }

      const maxVerResult = await db.execute(sql`
        SELECT COALESCE(MAX(version), 0) AS max_ver FROM budgets WHERE company_id = ${companyId} AND year = ${year}
      `);
      const latestVer = (maxVerResult.rows?.[0] as any)?.max_ver || 0;

      const budgetRows = latestVer > 0
        ? await db.select().from(budgets)
            .where(and(eq(budgets.companyId, companyId), eq(budgets.year, year), eq(budgets.version, latestVer)))
        : [];

      const { getAccountBalances, balanceMapFromRows } = await import("../report-queries");

      const allAccounts = await db.select().from(accounts)
        .where(eq(accounts.companyId, companyId))
        .orderBy(accounts.code);

      const monthlyActuals: Map<string, number>[] = [];
      for (let m = 1; m <= 12; m++) {
        const mStart = `${year}-${String(m).padStart(2, "0")}-01`;
        const lastDay = new Date(year, m, 0).getDate();
        const mEnd = `${year}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
        const rows = await getAccountBalances(companyId, mStart, mEnd);
        const bMap = balanceMapFromRows(rows);

        const acctBalances = new Map<string, number>();
        for (const acct of allAccounts) {
          const bal = bMap.get(acct.id) || { debit: 0, credit: 0 };
          let balance: number;
          if (acct.type === "revenue") {
            balance = bal.credit - bal.debit;
          } else if (acct.type === "expense") {
            balance = bal.debit - bal.credit;
          } else {
            continue;
          }
          if (balance !== 0) {
            acctBalances.set(acct.code, balance);
          }
        }
        monthlyActuals.push(acctBalances);
      }

      const budgetMap = new Map<string, number[]>();
      for (const b of budgetRows) {
        const key = b.accountCode;
        if (!budgetMap.has(key)) budgetMap.set(key, new Array(12).fill(0));
        budgetMap.get(key)![b.month - 1] = parseFloat(b.amount);
      }

      const relevantAccounts = allAccounts.filter(a =>
        a.type === "revenue" || a.type === "expense"
      );

      const allAccountCodes = new Set<string>();
      for (const acct of relevantAccounts) allAccountCodes.add(acct.code);
      for (const code of budgetMap.keys()) allAccountCodes.add(code);

      const reportLines: any[] = [];

      for (const code of [...allAccountCodes].sort()) {
        const acct = relevantAccounts.find(a => a.code === code);
        const budgetEntry = budgetRows.find(b => b.accountCode === code);
        const acctName = acct?.name || budgetEntry?.accountName || code;
        const acctNameTh = (acct as any)?.nameTh || null;
        const acctType = acct?.type || budgetEntry?.accountType || "expense";

        const monthlyData: any[] = [];
        let totalBudget = 0;
        let totalActual = 0;

        for (let m = 0; m < 12; m++) {
          const budget = budgetMap.get(code)?.[m] || 0;
          const actual = monthlyActuals[m].get(code) || 0;
          const variance = budget - actual;
          const variancePct = budget !== 0 ? ((variance / Math.abs(budget)) * 100) : 0;

          totalBudget += budget;
          totalActual += actual;

          monthlyData.push({ month: m + 1, budget, actual, variance, variancePct });
        }

        const totalVariance = totalBudget - totalActual;
        const totalVariancePct = totalBudget !== 0 ? ((totalVariance / Math.abs(totalBudget)) * 100) : 0;

        const hasBudget = totalBudget !== 0;
        const hasActual = totalActual !== 0;

        if (!hasBudget && !hasActual) continue;

        reportLines.push({
          accountCode: code,
          accountName: acctName,
          accountNameTh: acctNameTh,
          accountType: acctType,
          monthly: monthlyData,
          totalBudget,
          totalActual,
          totalVariance,
          totalVariancePct,
        });
      }

      const revenues = reportLines.filter(l => l.accountType === "revenue");
      const expenses = reportLines.filter(l => l.accountType === "expense");

      const alerts: any[] = [];
      for (const line of expenses) {
        for (const md of line.monthly) {
          if (md.budget > 0 && md.actual > 0) {
            const usagePct = (md.actual / md.budget) * 100;
            if (usagePct > 100) {
              alerts.push({
                level: "danger",
                accountCode: line.accountCode,
                accountName: line.accountNameTh || line.accountName,
                month: md.month,
                budget: md.budget,
                actual: md.actual,
                usagePct: Math.round(usagePct * 100) / 100,
                message: `ค่าใช้จ่าย ${line.accountNameTh || line.accountName} เดือน ${md.month} เกินงบ ${Math.round(usagePct)}%`,
              });
            } else if (usagePct > 80) {
              alerts.push({
                level: "warning",
                accountCode: line.accountCode,
                accountName: line.accountNameTh || line.accountName,
                month: md.month,
                budget: md.budget,
                actual: md.actual,
                usagePct: Math.round(usagePct * 100) / 100,
                message: `ค่าใช้จ่าย ${line.accountNameTh || line.accountName} เดือน ${md.month} ใช้ไป ${Math.round(usagePct)}% ของงบ`,
              });
            }
          }
        }
      }

      res.json({ revenues, expenses, alerts, year });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/budgets/versions", requireAuth, requireModule("accounting"), async (req, res) => {
    try {
      const companyId = Number(req.query.companyId);
      const year = Number(req.query.year);
      if (!companyId || !year) return res.status(400).json({ message: "companyId and year required" });

      const user = req.user as any;
      if (!(await verifyTenantAccess(companyId, user))) {
        return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });
      }

      const result = await db.execute(sql`
        SELECT version, COUNT(*) AS item_count, MIN(created_at) AS created_at, MAX(created_by) AS created_by
        FROM budgets
        WHERE company_id = ${companyId} AND year = ${year}
        GROUP BY version
        ORDER BY version DESC
      `);
      res.json((result.rows || result) as any[]);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/budgets/generate-alerts", requireAuth, requireModule("accounting"), async (req, res) => {
    try {
      const { companyId, year } = req.body;
      if (!companyId || !year) return res.status(400).json({ message: "companyId, year required" });

      const user = req.user as any;
      const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
      if (!company) return res.status(404).json({ message: "Company not found" });
      if (company.tenantId && company.tenantId !== user.tenantId) {
        return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });
      }

      const budgetRows = await db.select().from(budgets)
        .where(and(eq(budgets.companyId, companyId), eq(budgets.year, year)));

      if (budgetRows.length === 0) {
        return res.json({ generated: 0 });
      }

      const { getAccountBalances, balanceMapFromRows } = await import("../report-queries");
      const allAccounts = await db.select().from(accounts)
        .where(eq(accounts.companyId, companyId));

      const currentMonth = new Date().getMonth() + 1;

      const budgetMap = new Map<string, number[]>();
      for (const b of budgetRows) {
        if (!budgetMap.has(b.accountCode)) budgetMap.set(b.accountCode, new Array(12).fill(0));
        budgetMap.get(b.accountCode)![b.month - 1] = parseFloat(b.amount);
      }

      let generated = 0;

      for (let m = 1; m <= Math.min(currentMonth, 12); m++) {
        const mStart = `${year}-${String(m).padStart(2, "0")}-01`;
        const lastDay = new Date(year, m, 0).getDate();
        const mEnd = `${year}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
        const rows = await getAccountBalances(companyId, mStart, mEnd);
        const bMap = balanceMapFromRows(rows);

        for (const acct of allAccounts) {
          if (acct.type !== "expense") continue;
          const bal = bMap.get(acct.id) || { debit: 0, credit: 0 };
          const actual = bal.debit - bal.credit;
          const budget = budgetMap.get(acct.code)?.[m - 1] || 0;

          if (budget <= 0 || actual <= 0) continue;
          const usagePct = (actual / budget) * 100;

          if (usagePct > 80) {
            const level = usagePct > 100 ? "danger" : "warning";
            const title = `budget_alert_${acct.code}_${year}_${m}_${level}`;

            const existing = await db.select({ id: notifications.id }).from(notifications)
              .where(and(eq(notifications.companyId, companyId), eq(notifications.title, title)))
              .limit(1);

            if (existing.length === 0) {
              const message = usagePct > 100
                ? `ค่าใช้จ่าย ${(acct as any).nameTh || acct.name} เดือน ${m}/${year} เกินงบ ${Math.round(usagePct)}%`
                : `ค่าใช้จ่าย ${(acct as any).nameTh || acct.name} เดือน ${m}/${year} ใช้ไป ${Math.round(usagePct)}% ของงบ`;

              await db.insert(notifications).values({
                companyId,
                tenantId: company.tenantId,
                type: "budget_alert",
                title,
                message,
                link: `/reports/budget-vs-actual?year=${year}`,
              });
              generated++;
            }
          }
        }
      }

      res.json({ generated });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}