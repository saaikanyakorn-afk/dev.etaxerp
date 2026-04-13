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

      if (user.role !== "super_admin" && user.tenantId) {
        const [company] = await db.select().from(companies).where(eq(companies.id, batch.companyId));
        if (company && company.tenantId && company.tenantId !== user.tenantId) {
          return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง batch นี้" });
        }
      }

      const docIds: number[] = batch.createdDocIds ? JSON.parse(batch.createdDocIds) : [];
      let deletedDocs = 0;
      let deletedJournals = 0;
      let skippedNames: string[] = [];

      if (docIds.length > 0) {
        await db.transaction(async (tx) => {
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
            for (const docId of docIds) {
              await deleteJournalEntriesForDoc(tx, "expense", docId);
              await tx.delete(expenseItems).where(eq(expenseItems.expenseId, docId));
            }
            const expRows = await tx.select({ id: expenses.id, expNo: expenses.expNo, batchId: expenses.batchId })
              .from(expenses).where(and(eq(expenses.companyId, batch.companyId), inArray(expenses.id, docIds)));
            const expIds = expRows.map(e => e.id);
            if (expIds.length > 0) {
              const whtCertsToDelete = await tx.select({ id: withholdingTaxCerts.id })
                .from(withholdingTaxCerts)
                .where(and(
                  eq(withholdingTaxCerts.companyId, batch.companyId),
                  eq(withholdingTaxCerts.sourceDocType, "expense"),
                  inArray(withholdingTaxCerts.sourceDocId, expIds)
                ));
              const whtIds = whtCertsToDelete.map(w => w.id);
              if (whtIds.length > 0) {
                await tx.delete(whtCertItems).where(inArray(whtCertItems.certId, whtIds));
                await tx.delete(withholdingTaxCerts).where(inArray(withholdingTaxCerts.id, whtIds));
              }
            }
            const result = await tx.delete(expenses).where(and(eq(expenses.companyId, batch.companyId), inArray(expenses.id, docIds)));
            deletedDocs = result.rowCount || 0;
            const affectedBatchIds = [...new Set(expRows.map(e => e.batchId).filter(Boolean))] as number[];
            for (const dxpId of affectedBatchIds) {
              const remaining = await tx.select({ id: expenses.id }).from(expenses).where(eq(expenses.batchId, dxpId));
              if (remaining.length === 0) {
                await tx.delete(expenseDailyBatches).where(eq(expenseDailyBatches.id, dxpId));
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
              }
            }
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
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });
}
