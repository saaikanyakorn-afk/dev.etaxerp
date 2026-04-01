import { db } from "./db";
import { ecomDb } from "./ecom-db";
import { posDb } from "./pos-db";
import { eq, and, isNull, sql, desc, inArray } from "drizzle-orm";
import {
  taxInvoices, taxInvoiceItems, salesCreditNotes, salesCreditNoteItems,
  journalEntries, journalLines, accounts, companies,
  moduleSyncLogs, posTransactions,
} from "@shared/schema";
import { getNextJournalEntryNo } from "./route-helpers";

interface SyncResult {
  module: string;
  synced: number;
  skipped: number;
  errors: number;
  details: string[];
}

async function syncTaxInvoicesToAccounting(
  sourceDb: any,
  sourceModule: "pos" | "ecommerce",
  companyId: number,
): Promise<SyncResult> {
  const result: SyncResult = { module: sourceModule, synced: 0, skipped: 0, errors: 0, details: [] };

  const alreadySynced = await db.select({ sourceDocId: moduleSyncLogs.sourceDocId })
    .from(moduleSyncLogs)
    .where(and(
      eq(moduleSyncLogs.companyId, companyId),
      eq(moduleSyncLogs.sourceModule, sourceModule),
      eq(moduleSyncLogs.sourceDocType, "tax_invoice"),
      eq(moduleSyncLogs.status, "synced"),
    ));
  const syncedIds = new Set(alreadySynced.map(s => s.sourceDocId));

  const sourceDocs = await sourceDb.select().from(taxInvoices)
    .where(and(
      eq(taxInvoices.companyId, companyId),
      eq(taxInvoices.status, "approved"),
    ))
    .orderBy(taxInvoices.id);

  for (const doc of sourceDocs) {
    if (syncedIds.has(doc.id)) {
      result.skipped++;
      continue;
    }

    try {
      const items = await sourceDb.select().from(taxInvoiceItems)
        .where(eq(taxInvoiceItems.taxInvoiceId, doc.id));

      const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
      if (!company) {
        result.errors++;
        result.details.push(`ไม่พบบริษัท ID ${companyId}`);
        continue;
      }

      const allAccounts = await db.select().from(accounts).where(eq(accounts.companyId, companyId));
      const accountMap = new Map(allAccounts.map(a => [a.code, a]));

      const salesAccount = accountMap.get("4001000");
      const vatAccount = accountMap.get("2341000");
      const arAccount = accountMap.get("1201000");
      const cashAccount = accountMap.get("1101000");

      const isCash = sourceModule === "pos";
      const debitAccount = isCash ? cashAccount : arAccount;

      if (!salesAccount || !vatAccount || !debitAccount) {
        result.errors++;
        result.details.push(`${doc.taxInvoiceNo}: ไม่พบผังบัญชีที่จำเป็น`);
        continue;
      }

      const subtotal = parseFloat(doc.subtotal || "0");
      const vatAmount = parseFloat(doc.vatAmount || "0");
      const totalAmount = parseFloat(doc.totalAmount || "0");
      const salesBeforeVat = subtotal - vatAmount;

      const docDate = doc.taxInvoiceDate
        ? new Date(doc.taxInvoiceDate).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0];

      const entryNo = await getNextJournalEntryNo(companyId, "sales", docDate);
      const journalBook = isCash ? "receive" : "sales";

      let journalEntryId: number | null = null;
      await db.transaction(async (tx) => {
        const [je] = await tx.insert(journalEntries).values({
          companyId,
          entryNo,
          entryDate: docDate,
          reference: doc.taxInvoiceNo,
          description: `[SYNC:${sourceModule.toUpperCase()}] ${doc.taxInvoiceNo} - ${doc.customerName || "ลูกค้าทั่วไป"}`,
          journalBook,
          contactName: doc.customerName || null,
          createdBy: null,
          status: "posted",
          sourceDocType: "tax_invoice",
          sourceDocId: doc.id,
          currencyCode: "THB",
          exchangeRate: "1",
        }).returning();

        journalEntryId = je.id;

        const lines: any[] = [];
        lines.push({
          journalEntryId: je.id,
          accountId: debitAccount.id,
          description: isCash ? "รับเงินสด (POS)" : "ลูกหนี้การค้า",
          debit: totalAmount.toFixed(2),
          credit: "0",
        });

        if (vatAmount > 0 && vatAccount) {
          lines.push({
            journalEntryId: je.id,
            accountId: salesAccount.id,
            description: "รายได้จากการขาย",
            debit: "0",
            credit: salesBeforeVat.toFixed(2),
          });
          lines.push({
            journalEntryId: je.id,
            accountId: vatAccount.id,
            description: "ภาษีขาย",
            debit: "0",
            credit: vatAmount.toFixed(2),
          });
        } else {
          lines.push({
            journalEntryId: je.id,
            accountId: salesAccount.id,
            description: "รายได้จากการขาย",
            debit: "0",
            credit: totalAmount.toFixed(2),
          });
        }

        await tx.insert(journalLines).values(lines);

        await tx.insert(moduleSyncLogs).values({
          companyId,
          sourceModule,
          sourceDocType: "tax_invoice",
          sourceDocId: doc.id,
          targetDocType: "journal_entry",
          targetDocId: je.id,
          journalEntryId: je.id,
          status: "synced",
        });
      });

      result.synced++;
      result.details.push(`${doc.taxInvoiceNo} → JE #${journalEntryId}`);
    } catch (err: any) {
      result.errors++;
      result.details.push(`${doc.taxInvoiceNo}: ${err.message}`);
      try {
        await db.insert(moduleSyncLogs).values({
          companyId,
          sourceModule,
          sourceDocType: "tax_invoice",
          sourceDocId: doc.id,
          status: "error",
          errorMessage: err.message,
        });
      } catch {}
    }
  }

  return result;
}

async function syncCreditNotesToAccounting(
  companyId: number,
): Promise<SyncResult> {
  const result: SyncResult = { module: "ecommerce", synced: 0, skipped: 0, errors: 0, details: [] };

  const alreadySynced = await db.select({ sourceDocId: moduleSyncLogs.sourceDocId })
    .from(moduleSyncLogs)
    .where(and(
      eq(moduleSyncLogs.companyId, companyId),
      eq(moduleSyncLogs.sourceModule, "ecommerce"),
      eq(moduleSyncLogs.sourceDocType, "sales_credit_note"),
      eq(moduleSyncLogs.status, "synced"),
    ));
  const syncedIds = new Set(alreadySynced.map(s => s.sourceDocId));

  const sourceDocs = await ecomDb.select().from(salesCreditNotes)
    .where(and(
      eq(salesCreditNotes.companyId, companyId),
      eq(salesCreditNotes.status, "approved"),
    ))
    .orderBy(salesCreditNotes.id);

  for (const doc of sourceDocs) {
    if (syncedIds.has(doc.id)) {
      result.skipped++;
      continue;
    }

    try {
      const allAccounts = await db.select().from(accounts).where(eq(accounts.companyId, companyId));
      const accountMap = new Map(allAccounts.map(a => [a.code, a]));
      const salesAccount = accountMap.get("4001000");
      const vatAccount = accountMap.get("2341000");
      const arAccount = accountMap.get("1201000");

      if (!salesAccount || !vatAccount || !arAccount) {
        result.errors++;
        result.details.push(`CN ${doc.creditNoteNo}: ไม่พบผังบัญชีที่จำเป็น`);
        continue;
      }

      const subtotal = parseFloat(doc.totalAmount || "0");
      const vatAmount = parseFloat(doc.vatAmount || "0");
      const salesBeforeVat = subtotal - vatAmount;
      const docDate = doc.creditNoteDate
        ? new Date(doc.creditNoteDate).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0];

      const entryNo = await getNextJournalEntryNo(companyId, "sales", docDate);

      let journalEntryId: number | null = null;
      await db.transaction(async (tx) => {
        const [je] = await tx.insert(journalEntries).values({
          companyId,
          entryNo,
          entryDate: docDate,
          reference: doc.creditNoteNo,
          description: `[SYNC:ECOM] ใบลดหนี้ ${doc.creditNoteNo}`,
          journalBook: "sales",
          contactName: doc.customerName || null,
          createdBy: null,
          status: "posted",
          sourceDocType: "sales_credit_note",
          sourceDocId: doc.id,
          currencyCode: "THB",
          exchangeRate: "1",
        }).returning();

        journalEntryId = je.id;

        await tx.insert(journalLines).values([
          { journalEntryId: je.id, accountId: salesAccount.id, description: "กลับรายการรายได้", debit: salesBeforeVat.toFixed(2), credit: "0" },
          { journalEntryId: je.id, accountId: vatAccount.id, description: "กลับรายการภาษีขาย", debit: vatAmount.toFixed(2), credit: "0" },
          { journalEntryId: je.id, accountId: arAccount.id, description: "ลดยอดลูกหนี้", debit: "0", credit: subtotal.toFixed(2) },
        ]);

        await tx.insert(moduleSyncLogs).values({
          companyId,
          sourceModule: "ecommerce",
          sourceDocType: "sales_credit_note",
          sourceDocId: doc.id,
          targetDocType: "journal_entry",
          targetDocId: je.id,
          journalEntryId: je.id,
          status: "synced",
        });
      });

      result.synced++;
      result.details.push(`${doc.creditNoteNo} → JE #${journalEntryId}`);
    } catch (err: any) {
      result.errors++;
      result.details.push(`${doc.creditNoteNo}: ${err.message}`);
    }
  }

  return result;
}

export async function syncModuleToAccounting(
  companyId: number,
  module?: "pos" | "ecommerce" | "all",
): Promise<SyncResult[]> {
  const results: SyncResult[] = [];
  const target = module || "all";

  if (target === "pos" || target === "all") {
    const posResult = await syncTaxInvoicesToAccounting(posDb, "pos", companyId);
    results.push(posResult);
  }

  if (target === "ecommerce" || target === "all") {
    const ecomTivResult = await syncTaxInvoicesToAccounting(ecomDb, "ecommerce", companyId);
    results.push(ecomTivResult);

    const ecomCnResult = await syncCreditNotesToAccounting(companyId);
    results.push(ecomCnResult);
  }

  return results;
}

export async function getSyncStatus(companyId: number) {
  const logs = await db.select().from(moduleSyncLogs)
    .where(eq(moduleSyncLogs.companyId, companyId))
    .orderBy(desc(moduleSyncLogs.syncedAt));

  const posCount = logs.filter(l => l.sourceModule === "pos" && l.status === "synced").length;
  const ecomCount = logs.filter(l => l.sourceModule === "ecommerce" && l.status === "synced").length;
  const errorCount = logs.filter(l => l.status === "error").length;
  const lastSync = logs.length > 0 ? logs[0].syncedAt : null;

  const posPending = await posDb.select({ count: sql<number>`count(*)` })
    .from(taxInvoices)
    .where(and(
      eq(taxInvoices.companyId, companyId),
      eq(taxInvoices.status, "approved"),
    ));

  const ecomPending = await ecomDb.select({ count: sql<number>`count(*)` })
    .from(taxInvoices)
    .where(and(
      eq(taxInvoices.companyId, companyId),
      eq(taxInvoices.status, "approved"),
    ));

  return {
    pos: { synced: posCount, pending: Number(posPending[0]?.count || 0) - posCount },
    ecommerce: { synced: ecomCount, pending: Number(ecomPending[0]?.count || 0) - ecomCount },
    errors: errorCount,
    lastSync,
    recentLogs: logs.slice(0, 20),
  };
}

let syncInterval: ReturnType<typeof setInterval> | null = null;

export function startAutoSync(intervalMinutes = 30) {
  if (syncInterval) clearInterval(syncInterval);

  console.log(`[Module Sync] Auto-sync started (every ${intervalMinutes} min)`);

  syncInterval = setInterval(async () => {
    try {
      const allCompanies = await db.select({ id: companies.id }).from(companies);
      for (const company of allCompanies) {
        const results = await syncModuleToAccounting(company.id, "all");
        const totalSynced = results.reduce((sum, r) => sum + r.synced, 0);
        if (totalSynced > 0) {
          console.log(`[Module Sync] Company ${company.id}: synced ${totalSynced} documents`);
        }
      }
    } catch (err: any) {
      console.error("[Module Sync] Auto-sync error:", err.message);
    }
  }, intervalMinutes * 60 * 1000);
}

export function stopAutoSync() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
    console.log("[Module Sync] Auto-sync stopped");
  }
}
