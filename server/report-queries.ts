import { db } from "./db";
import { sql } from "drizzle-orm";

export interface AccountBalance {
  accountId: number;
  totalDebit: number;
  totalCredit: number;
}

export async function getAccountBalances(
  companyId: number,
  startDate?: string | null,
  endDate?: string | null
): Promise<AccountBalance[]> {
  const conditions = [sql`je.company_id = ${companyId}`, sql`je.status IN ('posted','approved')`];
  if (startDate) conditions.push(sql`je.entry_date >= ${startDate}`);
  if (endDate) conditions.push(sql`je.entry_date <= ${endDate}`);

  const whereClause = sql.join(conditions, sql` AND `);

  const rows = await db.execute(sql`
    SELECT
      jl.account_id AS "accountId",
      COALESCE(SUM(CAST(jl.debit AS numeric)), 0) AS "totalDebit",
      COALESCE(SUM(CAST(jl.credit AS numeric)), 0) AS "totalCredit"
    FROM journal_lines jl
    INNER JOIN journal_entries je ON je.id = jl.journal_entry_id
    WHERE ${whereClause}
    GROUP BY jl.account_id
  `);
  return (rows.rows || rows) as AccountBalance[];
}

export async function getAccountBalancesBefore(
  companyId: number,
  beforeDate: string
): Promise<AccountBalance[]> {
  const rows = await db.execute(sql`
    SELECT
      jl.account_id AS "accountId",
      COALESCE(SUM(CAST(jl.debit AS numeric)), 0) AS "totalDebit",
      COALESCE(SUM(CAST(jl.credit AS numeric)), 0) AS "totalCredit"
    FROM journal_lines jl
    INNER JOIN journal_entries je ON je.id = jl.journal_entry_id
    WHERE je.company_id = ${companyId}
      AND je.status IN ('posted','approved')
      AND je.entry_date < ${beforeDate}
    GROUP BY jl.account_id
  `);
  return (rows.rows || rows) as AccountBalance[];
}

export interface GLLine {
  lineId: number;
  journalEntryId: number;
  accountId: number;
  accountCode: string;
  accountName: string;
  accountNameTh: string | null;
  description: string | null;
  debit: string;
  credit: string;
  entryDate: string;
  reference: string | null;
  entryDescription: string | null;
  sourceDocType: string | null;
  sourceDocId: number | null;
  journalBook: string | null;
}

export async function getGeneralLedgerLines(
  companyId: number,
  startDate?: string | null,
  endDate?: string | null,
  accountCode?: string | null
): Promise<GLLine[]> {
  const conditions = [sql`je.company_id = ${companyId}`];
  if (startDate) conditions.push(sql`je.entry_date >= ${startDate}`);
  if (endDate) conditions.push(sql`je.entry_date <= ${endDate}`);
  if (accountCode) conditions.push(sql`a.code = ${accountCode}`);

  const whereClause = sql.join(conditions, sql` AND `);

  const rows = await db.execute(sql`
    SELECT
      jl.id AS "lineId",
      jl.journal_entry_id AS "journalEntryId",
      jl.account_id AS "accountId",
      a.code AS "accountCode",
      a.name AS "accountName",
      a.name_th AS "accountNameTh",
      jl.description,
      COALESCE(CAST(jl.debit AS numeric), 0) AS "debit",
      COALESCE(CAST(jl.credit AS numeric), 0) AS "credit",
      je.entry_date AS "entryDate",
      je.reference,
      je.description AS "entryDescription",
      je.source_doc_type AS "sourceDocType",
      je.source_doc_id AS "sourceDocId",
      je.journal_book AS "journalBook"
    FROM journal_lines jl
    INNER JOIN journal_entries je ON je.id = jl.journal_entry_id
    INNER JOIN accounts a ON a.id = jl.account_id
    WHERE ${whereClause}
    ORDER BY a.code, je.entry_date, je.id
  `);
  return (rows.rows || rows) as GLLine[];
}

export function balanceMapFromRows(rows: AccountBalance[]): Map<number, { debit: number; credit: number }> {
  const map = new Map<number, { debit: number; credit: number }>();
  for (const r of rows) {
    map.set(Number(r.accountId), {
      debit: Number(r.totalDebit),
      credit: Number(r.totalCredit),
    });
  }
  return map;
}
