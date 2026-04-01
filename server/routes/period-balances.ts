import { db } from "../db";
import { sql } from "drizzle-orm";

export async function rebuildPeriodBalances(companyId: number): Promise<{ periodsUpdated: number }> {
  await db.execute(sql`
    DELETE FROM account_period_balances WHERE company_id = ${companyId}
  `);

  const result = await db.execute(sql`
    INSERT INTO account_period_balances (company_id, account_id, period_year, period_month, total_debit, total_credit, entry_count, last_updated)
    SELECT
      je.company_id,
      jl.account_id,
      EXTRACT(YEAR FROM je.entry_date)::int AS period_year,
      EXTRACT(MONTH FROM je.entry_date)::int AS period_month,
      COALESCE(SUM(CAST(jl.debit AS numeric)), 0) AS total_debit,
      COALESCE(SUM(CAST(jl.credit AS numeric)), 0) AS total_credit,
      COUNT(DISTINCT je.id)::int AS entry_count,
      NOW()
    FROM journal_lines jl
    INNER JOIN journal_entries je ON je.id = jl.journal_entry_id
    WHERE je.company_id = ${companyId}
      AND je.status IN ('posted', 'approved')
    GROUP BY je.company_id, jl.account_id,
      EXTRACT(YEAR FROM je.entry_date),
      EXTRACT(MONTH FROM je.entry_date)
  `);
  const rows = (result as any).rowCount ?? (result as any).length ?? 0;
  return { periodsUpdated: rows };
}

export async function updatePeriodBalanceForEntry(companyId: number, entryDate: string): Promise<void> {
  const d = new Date(entryDate);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;

  await db.execute(sql`
    DELETE FROM account_period_balances
    WHERE company_id = ${companyId}
      AND period_year = ${year}
      AND period_month = ${month}
  `);

  await db.execute(sql`
    INSERT INTO account_period_balances (company_id, account_id, period_year, period_month, total_debit, total_credit, entry_count, last_updated)
    SELECT
      je.company_id,
      jl.account_id,
      ${year},
      ${month},
      COALESCE(SUM(CAST(jl.debit AS numeric)), 0),
      COALESCE(SUM(CAST(jl.credit AS numeric)), 0),
      COUNT(DISTINCT je.id)::int,
      NOW()
    FROM journal_lines jl
    INNER JOIN journal_entries je ON je.id = jl.journal_entry_id
    WHERE je.company_id = ${companyId}
      AND je.status IN ('posted', 'approved')
      AND EXTRACT(YEAR FROM je.entry_date) = ${year}
      AND EXTRACT(MONTH FROM je.entry_date) = ${month}
    GROUP BY je.company_id, jl.account_id
  `);
}

function isFirstOfMonth(dateStr: string): boolean {
  const d = new Date(dateStr);
  return d.getDate() === 1;
}

function isLastOfMonth(dateStr: string): boolean {
  const d = new Date(dateStr);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return d.getDate() === lastDay;
}

export function canUseSummaryPath(startDate: string, endDate: string): boolean {
  return isFirstOfMonth(startDate) && isLastOfMonth(endDate);
}

export async function getOpeningBalancesFromSummary(
  companyId: number,
  beforeDate: string
): Promise<{ accountId: number; totalDebit: number; totalCredit: number }[]> {
  const d = new Date(beforeDate);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;

  const rows = await db.execute(sql`
    SELECT
      account_id AS "accountId",
      SUM(total_debit) AS "totalDebit",
      SUM(total_credit) AS "totalCredit"
    FROM account_period_balances
    WHERE company_id = ${companyId}
      AND (period_year < ${y} OR (period_year = ${y} AND period_month < ${m}))
    GROUP BY account_id
  `);

  return ((rows.rows || rows) as any[]).map(r => ({
    accountId: Number(r.accountId),
    totalDebit: Number(r.totalDebit),
    totalCredit: Number(r.totalCredit),
  }));
}

export async function getPeriodBalancesFromSummary(
  companyId: number,
  startDate: string,
  endDate: string
): Promise<{ accountId: number; totalDebit: number; totalCredit: number }[]> {
  const sd = new Date(startDate);
  const ed = new Date(endDate);

  const rows = await db.execute(sql`
    SELECT
      account_id AS "accountId",
      SUM(total_debit) AS "totalDebit",
      SUM(total_credit) AS "totalCredit"
    FROM account_period_balances
    WHERE company_id = ${companyId}
      AND (period_year > ${sd.getFullYear()} OR (period_year = ${sd.getFullYear()} AND period_month >= ${sd.getMonth() + 1}))
      AND (period_year < ${ed.getFullYear()} OR (period_year = ${ed.getFullYear()} AND period_month <= ${ed.getMonth() + 1}))
    GROUP BY account_id
  `);

  return ((rows.rows || rows) as any[]).map(r => ({
    accountId: Number(r.accountId),
    totalDebit: Number(r.totalDebit),
    totalCredit: Number(r.totalCredit),
  }));
}

export async function isPeriodBalancesAvailable(companyId: number): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT COUNT(*) AS cnt FROM account_period_balances WHERE company_id = ${companyId} LIMIT 1
  `);
  const rows = (result.rows || result) as any[];
  return Number(rows[0]?.cnt || 0) > 0;
}
