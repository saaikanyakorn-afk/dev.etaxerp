import type { Express } from "express";
import { db } from "../db";
import { eq, and, desc, inArray } from "drizzle-orm";
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
            const result = await tx.delete(expenses).where(and(eq(expenses.companyId, batch.companyId), inArray(expenses.id, docIds)));
            deletedDocs = result.rowCount || 0;
            break;
          }
          case "product": {
            const result = await tx.delete(products).where(and(eq(products.companyId, batch.companyId), inArray(products.id, docIds)));
            deletedDocs = result.rowCount || 0;
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

      res.json({ deletedDocs, deletedJournals, batchId });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });
}
