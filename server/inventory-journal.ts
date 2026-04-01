import { db } from "./db";
import { companies, journalEntries, journalLines, stockMovements } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { calculateCost, type CostingMethod } from "./inventory-costing";
import { storage } from "./storage";

async function getNextJournalEntryNo(companyId: number, journalBook: string, entryDate: string): Promise<string> {
  const prefix = journalBook === "purchase" ? "PV" : journalBook === "sales" ? "SV" : "JV";
  const yy = entryDate.slice(2, 4);
  const mm = entryDate.slice(5, 7);
  const pattern = `${prefix}${yy}${mm}%`;
  const [last] = await db.select({ entryNo: journalEntries.entryNo })
    .from(journalEntries)
    .where(and(
      eq(journalEntries.companyId, companyId),
      eq(journalEntries.journalBook, journalBook),
      sql`${journalEntries.entryNo} LIKE ${pattern}`
    ))
    .orderBy(sql`${journalEntries.entryNo} DESC`)
    .limit(1);
  if (last && last.entryNo) {
    const num = parseInt(last.entryNo.replace(/\D/g, "").slice(4)) + 1;
    return `${prefix}${yy}${mm}${String(num).padStart(5, "0")}`;
  }
  return `${prefix}${yy}${mm}00001`;
}

interface InventoryJEParams {
  companyId: number;
  sourceDocType: string;
  sourceDocId: number;
  entryDate: string;
  description: string;
  journalBook: string;
  debitAccountCode: string;
  creditAccountCode: string;
  amount: number;
  createdBy?: number;
  contactName?: string;
}

export async function createInventoryJE(params: InventoryJEParams): Promise<{ journalEntryId: number } | null> {
  const { companyId, sourceDocType, sourceDocId, entryDate, description, journalBook, debitAccountCode, creditAccountCode, amount, createdBy, contactName } = params;

  if (amount <= 0) return null;

  const [company] = await db.select({
    inventoryAccountingMethod: companies.inventoryAccountingMethod,
  }).from(companies).where(eq(companies.id, companyId));

  if (!company || company.inventoryAccountingMethod !== "perpetual") return null;

  const accs = await storage.getAccounts(companyId);
  const debitAcc = accs.find((a: any) => a.code === debitAccountCode);
  const creditAcc = accs.find((a: any) => a.code === creditAccountCode);

  if (!debitAcc || !creditAcc) return null;

  const [existingJE] = await db.select({ id: journalEntries.id }).from(journalEntries).where(and(
    eq(journalEntries.companyId, companyId),
    eq(journalEntries.sourceDocType, sourceDocType),
    eq(journalEntries.sourceDocId, sourceDocId),
  ));
  if (existingJE) return { journalEntryId: existingJE.id };

  const entryNo = await getNextJournalEntryNo(companyId, journalBook, entryDate);
  const [entry] = await db.insert(journalEntries).values({
    companyId,
    entryNo,
    entryDate,
    description,
    journalBook,
    sourceDocType,
    sourceDocId,
    status: "posted",
    createdBy: createdBy || null,
    contactName: contactName || null,
  }).returning();

  await db.insert(journalLines).values([
    {
      journalEntryId: entry.id,
      accountId: debitAcc.id,
      description: (debitAcc as any).nameTh || (debitAcc as any).name || "",
      debit: String(amount.toFixed(2)),
      credit: "0",
    },
    {
      journalEntryId: entry.id,
      accountId: creditAcc.id,
      description: (creditAcc as any).nameTh || (creditAcc as any).name || "",
      debit: "0",
      credit: String(amount.toFixed(2)),
    },
  ]);

  return { journalEntryId: entry.id };
}

export async function createCOGSJournalEntry(
  companyId: number,
  sourceDocType: string,
  sourceDocId: number,
  entryDate: string,
  description: string,
  totalCost: number,
  createdBy?: number,
  contactName?: string
): Promise<number | null> {
  const result = await createInventoryJE({
    companyId,
    sourceDocType: `cogs_${sourceDocType}`,
    sourceDocId,
    entryDate,
    description: `ต้นทุนขาย - ${description}`,
    journalBook: "general",
    debitAccountCode: "5001",
    creditAccountCode: "1201",
    amount: totalCost,
    createdBy,
    contactName,
  });
  return result?.journalEntryId || null;
}

export async function createGRJournalEntry(
  companyId: number,
  sourceDocId: number,
  entryDate: string,
  description: string,
  totalCost: number,
  createdBy?: number,
  contactName?: string
): Promise<number | null> {
  const result = await createInventoryJE({
    companyId,
    sourceDocType: "inventory_gr",
    sourceDocId,
    entryDate,
    description: `รับสินค้า - ${description}`,
    journalBook: "purchase",
    debitAccountCode: "1201",
    creditAccountCode: "2101",
    amount: totalCost,
    createdBy,
    contactName,
  });
  return result?.journalEntryId || null;
}

interface CostUpdateLog {
  journalEntryId: number;
  entryNo: string;
  sourceDocType: string;
  sourceDocId: number;
  oldAmount: number;
  newAmount: number;
  status: "updated" | "created" | "skipped" | "deleted";
}

export async function updateCostJournalEntries(companyId: number): Promise<CostUpdateLog[]> {
  const logs: CostUpdateLog[] = [];

  const [company] = await db.select({
    inventoryAccountingMethod: companies.inventoryAccountingMethod,
    inventoryCostingMethod: companies.inventoryCostingMethod,
  }).from(companies).where(eq(companies.id, companyId));

  if (!company || company.inventoryAccountingMethod !== "perpetual") return logs;

  const method = (company.inventoryCostingMethod || "moving_average") as CostingMethod;

  const outMovements = await db.select().from(stockMovements)
    .where(and(
      eq(stockMovements.companyId, companyId),
      sql`CAST(${stockMovements.quantity} AS numeric) < 0`,
      sql`${stockMovements.movementType} NOT IN ('bundle_deduct', 'bundle_offset', 'bom_consume', 'mapping_convert')`
    ));

  const productIds = Array.from(new Set(outMovements.map(m => m.productId)));

  const costByMovement = new Map<number, { unitCost: number; totalCost: number }>();

  for (const pid of productIds) {
    const allMov = await db.select().from(stockMovements)
      .where(and(
        eq(stockMovements.companyId, companyId),
        eq(stockMovements.productId, pid),
      ))
      .orderBy(sql`${stockMovements.createdAt} ASC`);

    const calculated = calculateCost(allMov, method);
    for (const m of calculated) {
      if (m.quantity < 0) {
        costByMovement.set(m.id, { unitCost: m.unitCost, totalCost: m.totalCost });
      }
    }
  }

  const docCosts = new Map<string, number>();
  for (const mov of outMovements) {
    if (!mov.referenceType || !mov.referenceId) continue;
    const key = `cogs_${mov.referenceType}_${mov.referenceId}`;
    const cost = costByMovement.get(mov.id);
    if (cost) {
      docCosts.set(key, (docCosts.get(key) || 0) + cost.totalCost);
    }
  }

  const inMovements = await db.select().from(stockMovements)
    .where(and(
      eq(stockMovements.companyId, companyId),
      sql`CAST(${stockMovements.quantity} AS numeric) > 0`,
      sql`${stockMovements.movementType} NOT IN ('bundle_deduct', 'bundle_offset', 'bom_consume', 'mapping_convert')`
    ));

  for (const mov of inMovements) {
    if (!mov.referenceType || !mov.referenceId) continue;
    if (mov.referenceType !== "goods_receiving") continue;
    const key = `inventory_gr_${mov.referenceId}`;
    const tc = parseFloat(mov.totalCost || "0");
    if (tc > 0) {
      docCosts.set(key, (docCosts.get(key) || 0) + tc);
    }
  }

  const accs = await storage.getAccounts(companyId);
  const cogsAcc = accs.find((a: any) => a.code === "5001");
  const inventoryAcc = accs.find((a: any) => a.code === "1201");

  if (!cogsAcc || !inventoryAcc) return logs;

  const entries = Array.from(docCosts.entries());
  for (const [key, newAmount] of entries) {
    const parts = key.match(/^(cogs_\w+|inventory_gr)_(\d+)$/);
    if (!parts) continue;
    const docType = parts[1];
    const docId = parseInt(parts[2]);

    const [existingJE] = await db.select().from(journalEntries).where(and(
      eq(journalEntries.companyId, companyId),
      eq(journalEntries.sourceDocType, docType),
      eq(journalEntries.sourceDocId, docId),
    ));

    if (existingJE) {
      const lines = await db.select().from(journalLines).where(eq(journalLines.journalEntryId, existingJE.id));
      const debitLine = lines.find(l => parseFloat(l.debit || "0") > 0);
      const oldAmount = debitLine ? parseFloat(debitLine.debit || "0") : 0;

      if (Math.abs(oldAmount - newAmount) < 0.01) {
        logs.push({ journalEntryId: existingJE.id, entryNo: existingJE.entryNo || "", sourceDocType: docType, sourceDocId: docId, oldAmount, newAmount, status: "skipped" });
        continue;
      }

      if (newAmount <= 0) {
        await db.delete(journalLines).where(eq(journalLines.journalEntryId, existingJE.id));
        await db.delete(journalEntries).where(eq(journalEntries.id, existingJE.id));
        logs.push({ journalEntryId: existingJE.id, entryNo: existingJE.entryNo || "", sourceDocType: docType, sourceDocId: docId, oldAmount, newAmount: 0, status: "deleted" });
        continue;
      }

      for (const line of lines) {
        if (parseFloat(line.debit || "0") > 0) {
          await db.update(journalLines).set({ debit: String(newAmount.toFixed(2)) }).where(eq(journalLines.id, line.id));
        } else if (parseFloat(line.credit || "0") > 0) {
          await db.update(journalLines).set({ credit: String(newAmount.toFixed(2)) }).where(eq(journalLines.id, line.id));
        }
      }

      logs.push({ journalEntryId: existingJE.id, entryNo: existingJE.entryNo || "", sourceDocType: docType, sourceDocId: docId, oldAmount, newAmount, status: "updated" });
    }
  }

  return logs;
}
