import type { Express } from "express";
import { db } from "../db";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
import {
  documentImportBatches,
  invoices, invoiceItems,
  purchaseInvoices, purchaseInvoiceItems,
  expenses, expenseItems,
  products,
  contacts,
  journalEntries, journalLines,
  stockMovements,
  companies,
  productStock,
  productBundles,
  ecommerceProductMappings,
  warehouseStockLevels,
  productBinAssignments,
  productLots,
  demandForecasts,
  withholdingTaxCerts, whtCertItems,
  expenseDailyBatches,
} from "@shared/schema";
import { requireAuth, requireModule, requireRole } from "../route-middleware";
import { logActivity, deleteJournalEntriesForDoc, deleteStockMovementsForDoc } from "../route-helpers";

export function registerImportBatchRoutes(app: Express) {

  app.get("/api/import-batches", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const companyId = Number(req.query.companyId);
      const docType = req.query.docType as string;
      if (!companyId) return res.status(400).json({ message: "กรุณาระบุ companyId" });

      if (user.role !== "super_admin" && user.tenantId) {
        const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
        if (company && company.tenantId && company.tenantId !== user.tenantId) {
          return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึงกิจการนี้" });
        }
      }

      const conditions: any[] = [eq(documentImportBatches.companyId, companyId)];
      if (docType) conditions.push(eq(documentImportBatches.docType, docType));

      const batches = await db.select().from(documentImportBatches)
        .where(and(...conditions))
        .orderBy(desc(documentImportBatches.createdAt));

      res.json(batches);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.delete("/api/import-batches/:id", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const batchId = Number(req.params.id);
      if (!batchId) return res.status(400).json({ message: "กรุณาระบุ batch ID" });

      const [batch] = await db.select().from(documentImportBatches).where(eq(documentImportBatches.id, batchId));
      if (!batch) return res.status(404).json({ message: "ไม่พบล็อตนำเข้า" });
      if (batch.status === "deleted") return res.json({ deletedDocs: 0, deletedJournals: 0, batchId, message: "ล็อตนี้ถูกลบไปแล้ว" });

      if (user.role !== "super_admin" && user.tenantId) {
        const [company] = await db.select().from(companies).where(eq(companies.id, batch.companyId));
        if (company && company.tenantId && company.tenantId !== user.tenantId) {
          return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง batch นี้" });
        }
      }

      const docIds: number[] = batch.createdDocIds ? JSON.parse(batch.createdDocIds) : [];
      console.log(`[import-batch-delete] batch ${batchId}, docType=${batch.docType}, docIds count=${docIds.length}, first5=${JSON.stringify(docIds.slice(0, 5))}`);
      let deletedDocs = 0;
      let deletedJournals = 0;
      let skippedNames: string[] = [];

      if (docIds.length > 0) {
        await db.transaction(async (tx) => {
        console.log(`[import-batch-delete] starting transaction for ${batch.docType}, ${docIds.length} docs`);
        switch (batch.docType) {
          case "invoice": {
            for (const docId of docIds) {
              await deleteJournalEntriesForDoc(tx, "invoice", docId);
              await tx.delete(invoiceItems).where(eq(invoiceItems.invoiceId, docId));
            }
            const result = await tx.delete(invoices).where(and(eq(invoices.companyId, batch.companyId), inArray(invoices.id, docIds)));
            deletedDocs = result.rowCount || 0;
            break;
          }
          case "purchase_invoice": {
            for (const docId of docIds) {
              await deleteJournalEntriesForDoc(tx, "purchase_invoice", docId);
              await deleteStockMovementsForDoc(tx, "purchase_invoice", docId);
              await tx.delete(purchaseInvoiceItems).where(eq(purchaseInvoiceItems.purchaseInvoiceId, docId));
            }
            const result = await tx.delete(purchaseInvoices).where(and(eq(purchaseInvoices.companyId, batch.companyId), inArray(purchaseInvoices.id, docIds)));
            deletedDocs = result.rowCount || 0;
            break;
          }
          case "expense": {
            const pgDocIds = sql.raw(`ARRAY[${docIds.join(',')}]::int[]`);
            console.log(`[import-batch-delete] Step 1: querying expense rows...`);
            const expRowsResult = await tx.execute(sql`
              SELECT id, exp_no, batch_id FROM expenses 
              WHERE company_id = ${batch.companyId} AND id = ANY(${pgDocIds})
            `);
            const expRows = (expRowsResult.rows as any[]);
            const expIds = expRows.map((e: any) => e.id);
            console.log(`[import-batch-delete] Step 2: found ${expIds.length} expenses, deleting expense_items...`);

            if (expIds.length > 0) {
              const pgExpIds = sql.raw(`ARRAY[${expIds.join(',')}]::int[]`);
              await tx.execute(sql`DELETE FROM expense_items WHERE expense_id = ANY(${pgExpIds})`);
              console.log(`[import-batch-delete] Step 3: deleting per-expense journals...`);

              const jResult = await tx.execute(sql`
                SELECT id FROM journal_entries 
                WHERE source_doc_type = 'expense' AND source_doc_id = ANY(${pgExpIds})
              `);
              const jIds = (jResult.rows as any[]).map((j: any) => j.id);
              if (jIds.length > 0) {
                const pgJIds = sql.raw(`ARRAY[${jIds.join(',')}]::int[]`);
                console.log(`[import-batch-delete] Clearing ${jIds.length} per-expense journal refs...`);
                const clearRef = async (stmt: string) => { try { await tx.execute(sql.raw(stmt)); } catch {} };
                const jIdsList = jIds.join(",");
                await clearRef(`UPDATE bank_statements SET matched_journal_id = NULL WHERE matched_journal_id IN (${jIdsList})`);
                await clearRef(`UPDATE manufacturing_orders SET journal_entry_id = NULL WHERE journal_entry_id IN (${jIdsList})`);
                await clearRef(`UPDATE payroll_records SET journal_entry_id = NULL WHERE journal_entry_id IN (${jIdsList})`);
                await clearRef(`UPDATE fixed_assets SET journal_entry_id = NULL WHERE journal_entry_id IN (${jIdsList})`);
                await tx.execute(sql`DELETE FROM journal_lines WHERE journal_entry_id = ANY(${pgJIds})`);
                await tx.execute(sql`DELETE FROM journal_entries WHERE id = ANY(${pgJIds})`);
                deletedJournals += jIds.length;
              }

              console.log(`[import-batch-delete] Step 4: deleting WHT certs...`);
              const whtResult = await tx.execute(sql`
                SELECT id FROM withholding_tax_certs 
                WHERE company_id = ${batch.companyId} AND source_doc_type = 'expense' AND source_doc_id = ANY(${pgExpIds})
              `);
              const whtIds = (whtResult.rows as any[]).map((w: any) => w.id);
              if (whtIds.length > 0) {
                const pgWhtIds = sql.raw(`ARRAY[${whtIds.join(',')}]::int[]`);
                await tx.execute(sql`DELETE FROM wht_cert_items WHERE wht_cert_id = ANY(${pgWhtIds})`);
                await tx.execute(sql`DELETE FROM withholding_tax_certs WHERE id = ANY(${pgWhtIds})`);
              }

              console.log(`[import-batch-delete] Step 5: deleting ${expIds.length} expenses...`);
              const delResult = await tx.execute(sql`
                DELETE FROM expenses WHERE company_id = ${batch.companyId} AND id = ANY(${pgExpIds})
              `);
              deletedDocs = delResult.rowCount || 0;
            }

            console.log(`[import-batch-delete] Step 6: handling DXP batches...`);
            const affectedBatchIds = [...new Set(expRows.map((e: any) => e.batch_id).filter(Boolean))] as number[];
            for (const dxpId of affectedBatchIds) {
              const remResult = await tx.execute(sql`SELECT id FROM expenses WHERE batch_id = ${dxpId}`);
              const remaining = remResult.rows as any[];
              const dxpBatchResult = await tx.execute(sql`SELECT * FROM expense_daily_batches WHERE id = ${dxpId}`);
              const dxpBatch = (dxpBatchResult.rows as any[])[0];
              if (dxpBatch) {
                const dxpNo = dxpBatch.batch_no;
                const dxpJResult = await tx.execute(sql`
                  SELECT id FROM journal_entries 
                  WHERE company_id = ${batch.companyId} AND reference = ${dxpNo} AND source_doc_type = 'expense_daily_batch'
                `);
                const djIds = (dxpJResult.rows as any[]).map((dj: any) => dj.id);
                if (djIds.length > 0) {
                  const djIdsList = djIds.join(",");
                  try { await tx.execute(sql.raw(`UPDATE bank_statements SET matched_journal_id = NULL WHERE matched_journal_id IN (${djIdsList})`)); } catch {}
                  const pgDjIds = sql.raw(`ARRAY[${djIds.join(',')}]::int[]`);
                  await tx.execute(sql`DELETE FROM journal_lines WHERE journal_entry_id = ANY(${pgDjIds})`);
                  await tx.execute(sql`DELETE FROM journal_entries WHERE id = ANY(${pgDjIds})`);
                  deletedJournals += djIds.length;
                }
              }
              if (remaining.length === 0) {
                await tx.execute(sql`DELETE FROM expense_daily_batches WHERE id = ${dxpId}`);
                console.log(`[import-batch-delete] DXP batch ${dxpId} fully removed`);
              } else {
                const sums = await tx.execute(sql`
                  SELECT COALESCE(SUM(total_amount::numeric),0) as total,
                         COALESCE(SUM(vat_amount::numeric),0) as vat,
                         COALESCE(SUM(withholding_tax::numeric),0) as wht,
                         COUNT(*) as cnt
                  FROM expenses WHERE batch_id = ${dxpId}
                `);
                const row = (sums.rows as any[])[0];
                await tx.update(expenseDailyBatches).set({
                  totalAmount: String(row.total),
                  totalVat: String(row.vat),
                  totalWht: String(row.wht),
                  totalExpenses: Number(row.cnt),
                }).where(eq(expenseDailyBatches.id, dxpId));
                console.log(`[import-batch-delete] DXP batch ${dxpId} updated: ${row.cnt} left. Journal deleted.`);
              }
            }
            console.log(`[import-batch-delete] Done: deleted=${deletedDocs}, journals=${deletedJournals}`);
            break;
          }
          case "product": {
            const pgDocIds = sql.raw(`ARRAY[${docIds.join(',')}]::int[]`);
            const usedRows = await tx.execute(sql`
              SELECT DISTINCT product_id FROM (
                SELECT product_id FROM pos_transaction_items WHERE product_id = ANY(${pgDocIds})
                UNION ALL SELECT product_id FROM invoice_items WHERE product_id = ANY(${pgDocIds})
                UNION ALL SELECT product_id FROM stock_movements WHERE product_id = ANY(${pgDocIds})
                UNION ALL SELECT product_id FROM quotation_items WHERE product_id = ANY(${pgDocIds})
                UNION ALL SELECT product_id FROM sales_order_items WHERE product_id = ANY(${pgDocIds})
                UNION ALL SELECT product_id FROM tax_invoice_items WHERE product_id = ANY(${pgDocIds})
                UNION ALL SELECT product_id FROM receipt_items WHERE product_id = ANY(${pgDocIds})
                UNION ALL SELECT product_id FROM purchase_order_items WHERE product_id = ANY(${pgDocIds})
                UNION ALL SELECT product_id FROM purchase_invoice_items WHERE product_id = ANY(${pgDocIds})
                UNION ALL SELECT product_id FROM ecommerce_order_items WHERE product_id = ANY(${pgDocIds})
                UNION ALL SELECT product_id FROM goods_receiving_items WHERE product_id = ANY(${pgDocIds})
              ) t
            `);
            const usedIds = new Set((usedRows.rows as any[]).map(r => r.product_id));
            const canDeleteIds = docIds.filter(id => !usedIds.has(id));
            const deactivateIds = docIds.filter(id => usedIds.has(id));

            if (canDeleteIds.length > 0) {
              const pgDelIds = sql.raw(`ARRAY[${canDeleteIds.join(',')}]::int[]`);
              await tx.delete(productStock).where(inArray(productStock.productId, canDeleteIds));
              await tx.delete(productBundles).where(inArray(productBundles.bundleProductId, canDeleteIds));
              await tx.delete(productBundles).where(inArray(productBundles.componentProductId, canDeleteIds));
              await tx.delete(ecommerceProductMappings).where(inArray(ecommerceProductMappings.productId, canDeleteIds));
              await tx.delete(warehouseStockLevels).where(inArray(warehouseStockLevels.productId, canDeleteIds));
              await tx.delete(productLots).where(inArray(productLots.productId, canDeleteIds));
              await tx.delete(demandForecasts).where(inArray(demandForecasts.productId, canDeleteIds));
              await tx.execute(sql`DELETE FROM product_bin_assignments WHERE product_id = ANY(${pgDelIds})`);
              await tx.execute(sql`DELETE FROM menu_items WHERE product_id = ANY(${pgDelIds})`);
              await tx.execute(sql`DELETE FROM promotion_rules WHERE buy_product_id = ANY(${pgDelIds}) OR get_product_id = ANY(${pgDelIds})`);
              await tx.execute(sql`DELETE FROM product_mappings WHERE buy_product_id = ANY(${pgDelIds}) OR sell_product_id = ANY(${pgDelIds})`);
              await tx.execute(sql`DELETE FROM supplier_quote_items WHERE product_id = ANY(${pgDelIds})`);
              await tx.delete(products).where(and(eq(products.companyId, batch.companyId), inArray(products.id, canDeleteIds)));
            }
            if (deactivateIds.length > 0) {
              await tx.update(products).set({ active: false }).where(and(eq(products.companyId, batch.companyId), inArray(products.id, deactivateIds)));
              const deactivatedProducts = await tx.select({ code: products.code, name: products.name })
                .from(products).where(inArray(products.id, deactivateIds));
              skippedNames = deactivatedProducts.map(p => `${p.code} ${p.name}`);
            }
            deletedDocs = canDeleteIds.length;
            break;
          }
          case "contact": {
            const result = await tx.delete(contacts).where(and(eq(contacts.companyId, batch.companyId), inArray(contacts.id, docIds)));
            deletedDocs = result.rowCount || 0;
            break;
          }
        }
        });
      }

      await db.update(documentImportBatches)
        .set({ status: "deleted" })
        .where(eq(documentImportBatches.id, batchId));

      await logActivity({
        userId: user.id,
        companyId: batch.companyId,
        action: "delete_import_batch",
        entityType: batch.docType,
        entityId: String(batchId),
        entityName: `ล็อตนำเข้า ${batch.docType} (${deletedDocs} รายการ)`,
      });

      res.json({ deletedDocs, deletedJournals, batchId, deactivated: skippedNames.length, deactivatedNames: skippedNames });
    } catch (err: any) {
      console.error("[import-batch-delete] Error:", err.message);
      res.status(500).json({ message: err.message });
    }
  });
}
