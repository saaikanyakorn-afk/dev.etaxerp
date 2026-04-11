import type { Express } from "express";
import { db } from "../db";
import { storage } from "../storage";
import { eq, and, inArray, sql } from "drizzle-orm";
import { products, productBundles, stockMovements, productStock, journalEntries, journalLines } from "@shared/schema";
import { requireAuth, requireAnyModule } from "../route-middleware";
import { createAutoJournalEntry } from "../route-helpers";

interface BundleFixItem {
  movementId: number;
  companyId: number;
  bundleProductId: number;
  bundleProductName: string;
  bundleProductCode: string | null;
  quantity: string;
  unitCost: string;
  totalCost: string;
  referenceType: string | null;
  referenceId: number | null;
  referenceNo: string | null;
  notes: string | null;
  createdAt: Date | null;
  components: {
    componentProductId: number;
    componentProductName: string;
    componentProductCode: string | null;
    componentQty: string;
    deductQty: number;
  }[];
}

export function registerBundleFixRoutes(app: Express) {

  app.post("/api/bundle-fix/preview", requireAuth, requireAnyModule("inventory", "settings"), async (req, res) => {
    try {
      const { companyId } = req.body;
      if (!companyId) return res.status(400).json({ message: "companyId required" });

      const bundleProducts = await db.select({ id: products.id, name: products.name, code: products.code })
        .from(products)
        .where(and(eq(products.companyId, companyId), eq(products.productType, "bundle")));

      if (bundleProducts.length === 0) {
        return res.json({ items: [], summary: { totalMovements: 0, totalBundleProducts: 0, affectedDocuments: 0 } });
      }

      const bundleIds = bundleProducts.map(p => p.id);
      const bundleMap: Record<number, { name: string; code: string | null }> = {};
      for (const p of bundleProducts) bundleMap[p.id] = { name: p.name, code: p.code };

      const movements = await db.select().from(stockMovements)
        .where(and(
          eq(stockMovements.companyId, companyId),
          eq(stockMovements.movementType, "sale_deduct"),
          inArray(stockMovements.productId, bundleIds)
        ));

      if (movements.length === 0) {
        return res.json({ items: [], summary: { totalMovements: 0, totalBundleProducts: 0, affectedDocuments: 0 } });
      }

      const alreadyFixed = await db.select({ referenceNo: stockMovements.referenceNo }).from(stockMovements)
        .where(and(
          eq(stockMovements.companyId, companyId),
          eq(stockMovements.movementType, "bundle_fix_reverse"),
        ));
      const fixedRefNos = new Set(alreadyFixed.map(r => r.referenceNo).filter(Boolean));

      const components = await db.select().from(productBundles)
        .where(inArray(productBundles.bundleProductId, bundleIds));

      const compIds = [...new Set(components.map(c => c.componentProductId))];
      const compProducts = compIds.length > 0
        ? await db.select({ id: products.id, name: products.name, code: products.code })
            .from(products).where(inArray(products.id, compIds))
        : [];
      const compProdMap: Record<number, { name: string; code: string | null }> = {};
      for (const p of compProducts) compProdMap[p.id] = { name: p.name, code: p.code };

      const compMap: Record<number, { componentProductId: number; qty: string }[]> = {};
      for (const c of components) {
        if (!compMap[c.bundleProductId]) compMap[c.bundleProductId] = [];
        compMap[c.bundleProductId].push({ componentProductId: c.componentProductId, qty: c.qty });
      }

      const items: BundleFixItem[] = [];
      const docSet = new Set<string>();

      for (const mv of movements) {
        const fixKey = `${mv.referenceNo}_${mv.id}`;
        if (fixedRefNos.has(String(mv.id))) continue;

        const bundleInfo = bundleMap[mv.productId];
        const bundleComps = compMap[mv.productId] || [];
        const absQty = Math.abs(parseFloat(mv.quantity));

        const compDetails = bundleComps.map(c => {
          const cInfo = compProdMap[c.componentProductId] || { name: "Unknown", code: null };
          const deductQty = absQty * parseFloat(c.qty || "1");
          return {
            componentProductId: c.componentProductId,
            componentProductName: cInfo.name,
            componentProductCode: cInfo.code,
            componentQty: c.qty,
            deductQty,
          };
        });

        items.push({
          movementId: mv.id,
          companyId: mv.companyId,
          bundleProductId: mv.productId,
          bundleProductName: bundleInfo?.name || "Unknown",
          bundleProductCode: bundleInfo?.code || null,
          quantity: mv.quantity,
          unitCost: mv.unitCost || "0",
          totalCost: mv.totalCost || "0",
          referenceType: mv.referenceType,
          referenceId: mv.referenceId,
          referenceNo: mv.referenceNo,
          notes: mv.notes,
          createdAt: mv.createdAt,
          components: compDetails,
        });

        if (mv.referenceType && mv.referenceId) {
          docSet.add(`${mv.referenceType}:${mv.referenceId}`);
        }
      }

      const summary = {
        totalMovements: items.length,
        totalBundleProducts: [...new Set(items.map(i => i.bundleProductId))].length,
        affectedDocuments: docSet.size,
      };

      res.json({ items, summary });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/bundle-fix/execute", requireAuth, requireAnyModule("inventory", "settings"), async (req, res) => {
    try {
      const { companyId, movementIds } = req.body;
      const user = req.user as any;
      if (!companyId) return res.status(400).json({ message: "companyId required" });
      if (!movementIds || !Array.isArray(movementIds) || movementIds.length === 0) {
        return res.status(400).json({ message: "movementIds required" });
      }

      const bundleProducts = await db.select({ id: products.id, name: products.name, code: products.code })
        .from(products)
        .where(and(eq(products.companyId, companyId), eq(products.productType, "bundle")));
      const bundleIds = bundleProducts.map(p => p.id);
      const bundleMap: Record<number, string> = {};
      for (const p of bundleProducts) bundleMap[p.id] = p.name;

      const movements = await db.select().from(stockMovements)
        .where(and(
          eq(stockMovements.companyId, companyId),
          eq(stockMovements.movementType, "sale_deduct"),
          inArray(stockMovements.id, movementIds),
          inArray(stockMovements.productId, bundleIds)
        ));

      if (movements.length === 0) {
        return res.json({ fixed: 0, message: "ไม่พบรายการที่ต้องแก้ไข" });
      }

      const components = await db.select().from(productBundles)
        .where(inArray(productBundles.bundleProductId, bundleIds));
      const compMap: Record<number, { componentProductId: number; qty: string }[]> = {};
      for (const c of components) {
        if (!compMap[c.bundleProductId]) compMap[c.bundleProductId] = [];
        compMap[c.bundleProductId].push({ componentProductId: c.componentProductId, qty: c.qty });
      }

      let fixedCount = 0;
      let reversedMovements: number[] = [];
      let newMovements: number[] = [];
      const affectedProductIds = new Set<number>();
      const affectedDocs = new Set<string>();

      for (const mv of movements) {
        const bundleComps = compMap[mv.productId] || [];
        if (bundleComps.length === 0) continue;

        const absQty = Math.abs(parseFloat(mv.quantity));
        const bundleName = bundleMap[mv.productId] || "Unknown";

        const [reverseRow] = await db.insert(stockMovements).values({
          companyId: mv.companyId,
          productId: mv.productId,
          movementType: "bundle_fix_reverse",
          quantity: String(absQty),
          unitCost: mv.unitCost || "0",
          totalCost: mv.totalCost || "0",
          referenceType: mv.referenceType,
          referenceId: mv.referenceId,
          referenceNo: String(mv.id),
          notes: `คืนสต็อก bundle "${bundleName}" (แก้ไขอัตโนมัติ) - movement #${mv.id}`,
          createdBy: user.id,
        }).returning();
        reversedMovements.push(reverseRow.id);
        affectedProductIds.add(mv.productId);

        for (const comp of bundleComps) {
          const compQty = absQty * parseFloat(comp.qty || "1");
          const compUnitCost = parseFloat(mv.unitCost || "0");
          const compTotalCost = compQty * compUnitCost;

          const [newRow] = await db.insert(stockMovements).values({
            companyId: mv.companyId,
            productId: comp.componentProductId,
            movementType: "bundle_fix_deduct",
            quantity: String(-compQty),
            unitCost: String(compUnitCost),
            totalCost: String(compTotalCost),
            referenceType: mv.referenceType,
            referenceId: mv.referenceId,
            referenceNo: mv.referenceNo,
            notes: `ตัดสต็อก component จากชุด "${bundleName}" (แก้ไขอัตโนมัติ) - movement #${mv.id}`,
            createdBy: user.id,
          }).returning();
          newMovements.push(newRow.id);
          affectedProductIds.add(comp.componentProductId);
        }

        if (mv.referenceType && mv.referenceId) {
          affectedDocs.add(`${mv.referenceType}:${mv.referenceId}`);
        }

        fixedCount++;
      }

      for (const pid of affectedProductIds) {
        const sumResult = await db.select({
          total: sql<string>`COALESCE(SUM(CAST(${stockMovements.quantity} AS DECIMAL)), 0)`,
        }).from(stockMovements)
          .where(and(eq(stockMovements.companyId, companyId), eq(stockMovements.productId, pid)));
        const newQty = sumResult[0]?.total || "0";

        const [existing] = await db.select().from(productStock)
          .where(and(eq(productStock.companyId, companyId), eq(productStock.productId, pid)));
        if (existing) {
          await db.update(productStock).set({ quantity: newQty, updatedAt: new Date() }).where(eq(productStock.id, existing.id));
        } else {
          await db.insert(productStock).values({ companyId, productId: pid, quantity: newQty });
        }
      }

      let glFixCount = 0;
      for (const docKey of affectedDocs) {
        const [refType, refIdStr] = docKey.split(":");
        const refId = Number(refIdStr);

        const existingJournals = await db.select().from(journalEntries)
          .where(and(
            eq(journalEntries.companyId, companyId),
            eq(journalEntries.sourceDocType, refType),
            eq(journalEntries.sourceDocId, refId),
          ));

        if (existingJournals.length > 0) {
          for (const je of existingJournals) {
            await db.delete(journalLines).where(eq(journalLines.journalEntryId, je.id));
            await db.delete(journalEntries).where(eq(journalEntries.id, je.id));
          }

          try {
            if (refType === "tax_invoice") {
              const tivResult = await db.execute(sql`SELECT * FROM tax_invoices WHERE id = ${refId} AND company_id = ${companyId} LIMIT 1`);
              const tiv = tivResult.rows?.[0] as any;
              if (tiv && tiv.status === "approved") {
                await createAutoJournalEntry({
                  companyId,
                  documentType: "tax_invoice",
                  sourceDocType: "tax_invoice",
                  sourceDocId: refId,
                  docDate: tiv.tax_invoice_date || tiv.taxInvoiceDate,
                  docNo: tiv.tax_invoice_no || tiv.taxInvoiceNo,
                  subtotal: String(tiv.subtotal || "0"),
                  vatAmount: String(tiv.vat_amount || tiv.vatAmount || "0"),
                  totalAmount: String(tiv.total_amount || tiv.totalAmount || "0"),
                  withholdingTax: String(tiv.withholding_tax || tiv.withholdingTax || "0"),
                  userId: user.id,
                  customerName: tiv.customer_name || tiv.customerName,
                });
                glFixCount++;
              }
            } else if (refType === "invoice") {
              const ivResult = await db.execute(sql`SELECT * FROM invoices WHERE id = ${refId} AND company_id = ${companyId} LIMIT 1`);
              const iv = ivResult.rows?.[0] as any;
              if (iv && iv.status === "approved") {
                await createAutoJournalEntry({
                  companyId,
                  documentType: "invoice",
                  sourceDocType: "invoice",
                  sourceDocId: refId,
                  docDate: iv.invoice_date || iv.invoiceDate,
                  docNo: iv.invoice_no || iv.invoiceNo,
                  subtotal: String(iv.subtotal || "0"),
                  vatAmount: String(iv.vat_amount || iv.vatAmount || "0"),
                  totalAmount: String(iv.total_amount || iv.totalAmount || "0"),
                  withholdingTax: String(iv.withholding_tax || iv.withholdingTax || "0"),
                  userId: user.id,
                  customerName: iv.customer_name || iv.customerName,
                });
                glFixCount++;
              }
            }
          } catch (e: any) {
            console.error(`[BundleFix] GL re-creation failed for ${refType}#${refId}:`, e.message);
          }
        }
      }

      res.json({
        fixed: fixedCount,
        reversedMovements: reversedMovements.length,
        newMovements: newMovements.length,
        productsUpdated: affectedProductIds.size,
        glFixed: glFixCount,
        message: `แก้ไขสำเร็จ ${fixedCount} รายการ, อัพเดทสต็อก ${affectedProductIds.size} สินค้า, แก้ไข GL ${glFixCount} เอกสาร`,
      });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });
}
