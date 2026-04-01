import { db } from "../db";
import { sql } from "drizzle-orm";

export async function getGeneralLedgerLines(
  companyId: number,
  startDate?: string,
  endDate?: string,
  accountCode?: string
) {
  const conditions = [sql`je.company_id = ${companyId}`, sql`je.status = 'posted'`];
  if (startDate) conditions.push(sql`je.entry_date >= ${startDate}`);
  if (endDate) conditions.push(sql`je.entry_date <= ${endDate}`);
  if (accountCode) conditions.push(sql`a.code = ${accountCode}`);

  const whereClause = sql.join(conditions, sql` AND `);

  const result = await db.execute(sql`
    SELECT
      jl.id AS "lineId",
      jl.journal_entry_id AS "journalEntryId",
      jl.account_id AS "accountId",
      a.code AS "accountCode",
      a.name AS "accountName",
      a.name_th AS "accountNameTh",
      jl.debit::text AS "debit",
      jl.credit::text AS "credit",
      jl.description,
      je.entry_date AS "entryDate",
      je.reference,
      je.description AS "entryDescription",
      je.journal_book AS "journalBook",
      je.source_doc_type AS "sourceDocType",
      je.source_doc_id AS "sourceDocId"
    FROM journal_lines jl
    JOIN journal_entries je ON je.id = jl.journal_entry_id
    JOIN accounts a ON a.id = jl.account_id
    WHERE ${whereClause}
    ORDER BY je.entry_date, je.id, jl.id
  `);

  return result.rows as any[];
}

export async function getAccountBalancesBefore(companyId: number, startDate: string) {
  const result = await db.execute(sql`
    SELECT
      jl.account_id AS "accountId",
      SUM(jl.debit) AS "totalDebit",
      SUM(jl.credit) AS "totalCredit"
    FROM journal_lines jl
    JOIN journal_entries je ON je.id = jl.journal_entry_id
    WHERE je.company_id = ${companyId}
      AND je.status = 'posted'
      AND je.entry_date < ${startDate}
    GROUP BY jl.account_id
  `);
  return result.rows as any[];
}

export async function getAccountBalances(companyId: number, startDate: string | null, endDate: string) {
  const conditions = [
    sql`je.company_id = ${companyId}`,
    sql`je.status = 'posted'`,
    sql`je.entry_date <= ${endDate}`,
  ];
  if (startDate) conditions.push(sql`je.entry_date >= ${startDate}`);

  const result = await db.execute(sql`
    SELECT
      jl.account_id AS "accountId",
      SUM(jl.debit) AS "totalDebit",
      SUM(jl.credit) AS "totalCredit"
    FROM journal_lines jl
    JOIN journal_entries je ON je.id = jl.journal_entry_id
    WHERE ${sql.join(conditions, sql` AND `)}
    GROUP BY jl.account_id
  `);
  return result.rows as any[];
}

export function balanceMapFromRows(rows: any[]): Map<number, { debit: number; credit: number }> {
  const map = new Map<number, { debit: number; credit: number }>();
  for (const row of rows) {
    map.set(Number(row.accountId), {
      debit: Number(row.totalDebit) || 0,
      credit: Number(row.totalCredit) || 0,
    });
  }
  return map;
}
