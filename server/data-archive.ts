import { db } from "./db";
import { ecomDb } from "./ecom-db";
import {
  ecommerceOrders, ecommerceOrderItems,
  journalEntries, journalLines,
  archiveEcommerceOrders, archiveJournalEntries, archiveJournalLines,
  archiveRuns,
} from "@shared/schema";
import { eq, and, lte, sql, inArray } from "drizzle-orm";

function log(message: string) {
  const now = new Date().toLocaleTimeString("en-US", { hour12: false });
  console.log(`${now} [data-archive] ${message}`);
}

export async function archiveEcommerceOrdersForCompany(
  companyId: number,
  cutoffDate: string,
  createdBy?: number,
): Promise<{ archived: number; runId: number }> {
  const [run] = await db.insert(archiveRuns).values({
    companyId,
    archiveType: "ecommerce_orders",
    cutoffDate,
    createdBy,
  }).returning();

  try {
    const cutoff = new Date(cutoffDate);

    const oldOrders = await ecomDb.select()
      .from(ecommerceOrders)
      .where(
        and(
          eq(ecommerceOrders.companyId, companyId),
          lte(ecommerceOrders.createdAt, cutoff),
          sql`${ecommerceOrders.status} IN ('delivered', 'cancelled', 'returned')`,
          sql`${ecommerceOrders.settlementStatus} IN ('settled', 'cancelled')`,
        )
      );

    if (oldOrders.length === 0) {
      await db.update(archiveRuns).set({
        status: "completed",
        recordsArchived: 0,
        completedAt: new Date(),
      }).where(eq(archiveRuns.id, run.id));
      return { archived: 0, runId: run.id };
    }

    const BATCH_SIZE = 500;
    let totalArchived = 0;

    for (let i = 0; i < oldOrders.length; i += BATCH_SIZE) {
      const batch = oldOrders.slice(i, i + BATCH_SIZE);
      const orderIds = batch.map(o => o.id);

      await ecomDb.transaction(async (tx) => {
        const archiveValues = batch.map(o => ({
          originalId: o.id,
          companyId: o.companyId,
          connectionId: o.connectionId,
          platform: o.platform,
          platformOrderId: o.platformOrderId,
          orderNo: o.orderNo,
          status: o.status,
          buyerName: o.buyerName,
          totalAmount: o.totalAmount,
          trackingNo: o.trackingNo,
          shippingProvider: o.shippingProvider,
          placedAt: o.placedAt,
          deliveredAt: o.deliveredAt,
          settlementStatus: o.settlementStatus,
          rawData: o.rawData,
          createdAt: o.createdAt,
        }));

        await tx.insert(archiveEcommerceOrders).values(archiveValues);
        await tx.delete(ecommerceOrderItems).where(inArray(ecommerceOrderItems.orderId, orderIds));
        await tx.delete(ecommerceOrders).where(inArray(ecommerceOrders.id, orderIds));
      });

      totalArchived += batch.length;
    }

    await db.update(archiveRuns).set({
      status: "completed",
      recordsArchived: totalArchived,
      completedAt: new Date(),
    }).where(eq(archiveRuns.id, run.id));

    log(`Archived ${totalArchived} ecommerce orders for company ${companyId} (cutoff: ${cutoffDate})`);
    return { archived: totalArchived, runId: run.id };

  } catch (err: any) {
    await db.update(archiveRuns).set({
      status: "failed",
      errorDetails: err.message?.slice(0, 500),
      completedAt: new Date(),
    }).where(eq(archiveRuns.id, run.id));
    throw err;
  }
}

export async function archiveJournalEntriesForCompany(
  companyId: number,
  cutoffDate: string,
  createdBy?: number,
): Promise<{ archived: number; runId: number }> {
  const [run] = await db.insert(archiveRuns).values({
    companyId,
    archiveType: "journal_entries",
    cutoffDate,
    createdBy,
  }).returning();

  try {
    const cutoff = new Date(cutoffDate);

    const oldEntries = await db.select()
      .from(journalEntries)
      .where(
        and(
          eq(journalEntries.companyId, companyId),
          lte(journalEntries.createdAt, cutoff),
          eq(journalEntries.status, "posted"),
        )
      );

    if (oldEntries.length === 0) {
      await db.update(archiveRuns).set({
        status: "completed",
        recordsArchived: 0,
        completedAt: new Date(),
      }).where(eq(archiveRuns.id, run.id));
      return { archived: 0, runId: run.id };
    }

    const BATCH_SIZE = 500;
    let totalArchived = 0;

    for (let i = 0; i < oldEntries.length; i += BATCH_SIZE) {
      const batch = oldEntries.slice(i, i + BATCH_SIZE);
      const entryIds = batch.map(e => e.id);

      await db.transaction(async (tx) => {
        const archiveEntryValues = batch.map(e => ({
          originalId: e.id,
          companyId: e.companyId,
          entryNo: e.entryNo,
          entryDate: e.entryDate,
          reference: e.reference,
          description: e.description,
          journalBook: e.journalBook,
          status: e.status,
          sourceDocType: e.sourceDocType,
          sourceDocId: e.sourceDocId,
          createdAt: e.createdAt,
        }));

        const insertedArchive = await tx.insert(archiveJournalEntries).values(archiveEntryValues).returning();

        const originalToArchiveMap = new Map<number, number>();
        for (let j = 0; j < batch.length; j++) {
          originalToArchiveMap.set(batch[j].id, insertedArchive[j].id);
        }

        const lines = await tx.select().from(journalLines).where(inArray(journalLines.journalEntryId, entryIds));

        if (lines.length > 0) {
          const archiveLineValues = lines.map(l => ({
            originalId: l.id,
            journalEntryId: l.journalEntryId,
            archiveJournalEntryId: originalToArchiveMap.get(l.journalEntryId) || null,
            accountId: l.accountId,
            description: l.description,
            debit: l.debit,
            credit: l.credit,
            anchor: l.anchor,
          }));

          await tx.insert(archiveJournalLines).values(archiveLineValues);
        }

        await tx.delete(journalLines).where(inArray(journalLines.journalEntryId, entryIds));
        await tx.delete(journalEntries).where(inArray(journalEntries.id, entryIds));
      });

      totalArchived += batch.length;
    }

    await db.update(archiveRuns).set({
      status: "completed",
      recordsArchived: totalArchived,
      completedAt: new Date(),
    }).where(eq(archiveRuns.id, run.id));

    log(`Archived ${totalArchived} journal entries for company ${companyId} (cutoff: ${cutoffDate})`);
    return { archived: totalArchived, runId: run.id };

  } catch (err: any) {
    await db.update(archiveRuns).set({
      status: "failed",
      errorDetails: err.message?.slice(0, 500),
      completedAt: new Date(),
    }).where(eq(archiveRuns.id, run.id));
    throw err;
  }
}

export async function getArchivePreview(
  companyId: number,
  archiveType: string,
  cutoffDate: string,
): Promise<{ count: number; oldestDate: string | null; newestDate: string | null }> {
  const cutoff = new Date(cutoffDate);

  if (archiveType === "ecommerce_orders") {
    const result = await db.execute(sql`
      SELECT COUNT(*)::int as count,
             MIN(created_at)::text as oldest,
             MAX(created_at)::text as newest
      FROM ecommerce_orders 
      WHERE company_id = ${companyId} 
        AND created_at <= ${cutoff.toISOString()}
        AND status IN ('delivered', 'cancelled', 'returned')
        AND settlement_status IN ('settled', 'cancelled')
    `);
    const row = (result.rows as any[])[0];
    return { count: row?.count || 0, oldestDate: row?.oldest, newestDate: row?.newest };
  }

  if (archiveType === "journal_entries") {
    const result = await db.execute(sql`
      SELECT COUNT(*)::int as count,
             MIN(created_at)::text as oldest,
             MAX(created_at)::text as newest
      FROM journal_entries 
      WHERE company_id = ${companyId} 
        AND created_at <= ${cutoff.toISOString()}
        AND status = 'posted'
    `);
    const row = (result.rows as any[])[0];
    return { count: row?.count || 0, oldestDate: row?.oldest, newestDate: row?.newest };
  }

  return { count: 0, oldestDate: null, newestDate: null };
}

export async function getArchiveHistory(companyId: number) {
  return db.select().from(archiveRuns)
    .where(eq(archiveRuns.companyId, companyId))
    .orderBy(sql`${archiveRuns.startedAt} DESC`)
    .limit(50);
}
