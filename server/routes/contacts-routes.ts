import type { Express, Request, Response } from "express";
import { db } from "../db";
import { storage } from "../storage";
import { eq, desc, and, asc, ilike, inArray, count , sql } from "drizzle-orm";
import { contacts, insertContactSchema, tenants, companies, firmClients, accounts, salesOrders, quotations, invoices, taxInvoices, receipts, billingNotes, paymentVouchers, purchaseInvoices, expenses, withholdingTaxCerts, depositReceipts, salesCreditNotes, purchaseDebitNotes, purchaseDeposits, documentImportBatches, posTransactions, deliveryNotes, pipelineDeals, supplierQuotes, supplierPortalTokens, workStatusRows, workStatusCells } from "@shared/schema";
import { requireAuth, requireAdmin, requireModule, checkDocOwnership } from "../route-middleware";
import { logActivity } from "../route-helpers";
import { parsePagination, paginatedResponse } from "./pagination";
import multer from "multer";
import * as XLSX from "xlsx";
import path from "path";
import { z } from "zod";
import { getChartOfAccounts } from "@shared/chart-of-accounts";
import { parse as csvParse } from "csv-parse/sync";

export function registerContactsRoutes(app: Express) {
// ==================== Contacts ====================
app.get("/api/contacts", requireAuth, requireModule("contacts"), async (req, res) => {
  try {
    const companyId = Number(req.query.companyId);
    if (!companyId) return res.status(400).json({ message: "กรุณาระบุ companyId" });
    const type = req.query.type as string | undefined;
    const showInactive = req.query.showInactive === "true";
    const conditions: any[] = [eq(contacts.companyId, companyId)];
    if (!showInactive) conditions.push(eq(contacts.active, true));
    if (type) conditions.push(eq(contacts.type, type));
    const whereClause = and(...conditions);
    const sortBy = req.query.sortBy as string || "code";
    const sortDir = req.query.sortDir as string || "asc";
    const orderClause = sortBy === "name" 
      ? (sortDir === "desc" ? desc(contacts.name) : asc(contacts.name))
      : sortBy === "createdAt"
      ? (sortDir === "desc" ? desc(contacts.createdAt) : asc(contacts.createdAt))
      : (sortDir === "desc" ? desc(contacts.code) : asc(contacts.code));
    if (req.query.page) {
      const { page, pageSize, offset } = parsePagination(req, { pageSize: 50 });
      const [{ total }] = await db.select({ total: count() }).from(contacts).where(whereClause);
      const list = await db.select().from(contacts).where(whereClause).orderBy(orderClause).limit(pageSize).offset(offset);
      res.json(paginatedResponse(list, Number(total), { page, pageSize, offset }));
    } else {
      const list = await db.select().from(contacts).where(whereClause).orderBy(orderClause);
      res.json(list);
    }
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/contacts/check-duplicates", requireAuth, requireModule("contacts"), async (req, res) => {
  try {
    const companyId = Number(req.query.companyId);
    if (!companyId) return res.status(400).json({ message: "กรุณาระบุ companyId" });
    const taxId = req.query.taxId as string | undefined;
    const name = req.query.name as string | undefined;
    const code = req.query.code as string | undefined;
    const excludeId = req.query.excludeId ? Number(req.query.excludeId) : undefined;
    const duplicates = await storage.findDuplicateContacts(companyId, { taxId, name, code, excludeId });
    res.json(duplicates);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/contacts", requireAuth, requireModule("contacts"), async (req, res) => {
  try {
    if (!req.body.code) {
      req.body.code = await storage.getNextContactCode(req.body.companyId);
    }
    const parsed = insertContactSchema.parse(req.body);
    const codeExists = await storage.findDuplicateContacts(parsed.companyId, { code: parsed.code });
    if (codeExists.length > 0) {
      return res.status(409).json({ message: `รหัสคู่ค้า "${parsed.code}" ถูกใช้แล้ว`, field: "code", duplicates: codeExists });
    }
    if (parsed.taxId && parsed.taxId.trim()) {
      const taxExists = await storage.findDuplicateContacts(parsed.companyId, { taxId: parsed.taxId });
      if (taxExists.length > 0) {
        return res.status(409).json({ message: `เลขประจำตัวผู้เสียภาษี "${parsed.taxId}" มีในระบบแล้ว`, field: "taxId", duplicates: taxExists });
      }
    }
    const created = await storage.createContact(parsed);
    logActivity({ companyId: created.companyId || 0, userId: (req.user as any)?.id, userName: (req.user as any)?.username, action: "create", entityType: "contact", entityId: String(created.id), entityName: created.name || created.companyName || "" }).catch(() => {});

    // Auto-create Firm Client if user is accounting_firm tenant and adding to primary company
    let autoCreatedFirmClient: any = null;
    try {
      const currentUser = req.user as any;
      if (currentUser.tenantId && (parsed.type === "customer" || !parsed.type)) {
        const [tenant] = await db.select().from(tenants).where(eq(tenants.id, currentUser.tenantId)).limit(1);
        if (tenant && tenant.tenantType === "accounting_firm") {
          const [primaryComp] = await db.select({ id: companies.id }).from(companies)
            .where(and(eq(companies.tenantId, currentUser.tenantId), eq(companies.isPrimary, true))).limit(1);
          if (primaryComp && parsed.companyId === primaryComp.id) {
            const contactName = created.name || created.companyName || "";
            const existingFc = await db.select({ id: firmClients.id }).from(firmClients)
              .innerJoin(companies, eq(firmClients.companyId, companies.id))
              .where(and(eq(companies.tenantId, currentUser.tenantId), ilike(firmClients.name, contactName)))
              .limit(1);
            if (existingFc.length === 0) {
              const template = "standard";
              const businessType = "mixed";
              const [newCompany] = await db.insert(companies).values({
                name: contactName,
                nameEn: created.nameEn || null,
                nameZh: created.nameZh || null,
                taxId: created.taxId || null,
                address: created.address || null,
                addressEn: created.addressEn || null,
                addressZh: created.addressZh || null,
                phone: created.phone || null,
                active: true,
                businessType,
                tenantId: currentUser.tenantId,
              }).returning();
              const [fc] = await db.insert(firmClients).values({
                companyId: newCompany.id,
                name: contactName,
                nameEn: created.nameEn || null,
                nameZh: created.nameZh || null,
                taxId: created.taxId || null,
                branch: created.branch || "สำนักงานใหญ่",
                address: created.address || null,
                addressEn: created.addressEn || null,
                addressZh: created.addressZh || null,
                phone: created.phone || null,
                email: created.email || null,
                contactPerson: created.contactPerson || null,
                contactId: created.id,
                status: "active",
              }).returning();
              const templateAccounts = getChartOfAccounts(template);
              if (templateAccounts.length > 0) {
                await db.insert(accounts).values(templateAccounts.map(acc => ({
                  companyId: newCompany.id, code: acc.code, name: acc.name, nameTh: acc.nameTh,
                  nameZh: acc.nameZh, type: acc.type, parentCode: acc.parentCode, isHeader: acc.isHeader,
                })));
              }
              await storage.seedDefaultFormulas(newCompany.id, businessType);
              autoCreatedFirmClient = fc;
            }
          }
        }
      }
    } catch (e: any) {
      console.log("[auto-firm-client]", e.message);
    }

    res.status(201).json({ ...created, autoCreatedFirmClient });
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
    res.status(400).json({ message: err.message });
  }
});

app.patch("/api/contacts/:id", requireAuth, requireModule("contacts"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = await storage.getContact(id);
    if (!existing) return res.status(404).json({ message: "ไม่พบคู่ค้า" });
    { const ac = await checkDocOwnership(existing.companyId, req.user); if (!ac.allowed) return res.status(403).json({ message: ac.message }); }
    const newCode = req.body.code?.trim();
    if (newCode && newCode !== existing.code) {
      const [dup] = await db.select({ id: contacts.id }).from(contacts)
        .where(and(eq(contacts.companyId, existing.companyId!), eq(contacts.code, newCode), eq(contacts.active, true), sql`${contacts.id} != ${id}`)).limit(1);
      if (dup) return res.status(409).json({ message: `รหัสคู่ค้า "${newCode}" ถูกใช้แล้ว`, field: "code" });
    }
    const newTaxId = req.body.taxId?.trim();
    if (newTaxId && newTaxId !== (existing.taxId || "").trim()) {
      const [dup] = await db.select({ id: contacts.id }).from(contacts)
        .where(and(eq(contacts.companyId, existing.companyId!), eq(contacts.taxId, newTaxId), eq(contacts.active, true), sql`${contacts.id} != ${id}`)).limit(1);
      if (dup) return res.status(409).json({ message: `เลขประจำตัวผู้เสียภาษี "${newTaxId}" มีในระบบแล้ว`, field: "taxId" });
    }
    const updated = await storage.updateContact(id, req.body);
    if (!updated) return res.status(404).json({ message: "ไม่พบคู่ค้า" });
    logActivity({ companyId: updated.companyId || 0, userId: (req.user as any)?.id, userName: (req.user as any)?.username, action: "update", entityType: "contact", entityId: String(id), entityName: updated.name || updated.companyName || "" }).catch(() => {});
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

app.post("/api/contacts/bulk-delete", requireAuth, requireModule("contacts"), async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: "กรุณาระบุรายการ" });
    const safeIds = ids.map(Number).filter(n => !isNaN(n) && n > 0);
    if (safeIds.length === 0) return res.status(400).json({ message: "ไม่มีรายการที่ถูกต้อง" });
    await db.transaction(async (tx) => {
      await tx.update(salesOrders).set({ customerId: null }).where(inArray(salesOrders.customerId, safeIds));
      await tx.update(quotations).set({ customerId: null }).where(inArray(quotations.customerId, safeIds));
      await tx.update(invoices).set({ customerId: null }).where(inArray(invoices.customerId, safeIds));
      await tx.update(taxInvoices).set({ customerId: null }).where(inArray(taxInvoices.customerId, safeIds));
      await tx.update(receipts).set({ customerId: null }).where(inArray(receipts.customerId, safeIds));
      await tx.update(billingNotes).set({ customerId: null }).where(inArray(billingNotes.customerId, safeIds));
      await tx.update(posTransactions).set({ customerId: null }).where(inArray(posTransactions.customerId, safeIds));
      await tx.update(depositReceipts).set({ customerId: null }).where(inArray(depositReceipts.customerId, safeIds));
      await tx.update(salesCreditNotes).set({ customerId: null }).where(inArray(salesCreditNotes.customerId, safeIds));
      await tx.update(deliveryNotes).set({ customerId: null }).where(inArray(deliveryNotes.customerId, safeIds));
      await tx.update(pipelineDeals).set({ contactId: null }).where(inArray(pipelineDeals.contactId, safeIds));
      await tx.delete(supplierQuotes).where(inArray(supplierQuotes.contactId, safeIds));
      await tx.delete(supplierPortalTokens).where(inArray(supplierPortalTokens.contactId, safeIds));
      const linkedFirmClients = await tx.select({ id: firmClients.id }).from(firmClients)
        .where(inArray(firmClients.contactId, safeIds));
      if (linkedFirmClients.length > 0) {
        const fcIds = linkedFirmClients.map(fc => fc.id);
        const linkedRows = await tx.select({ id: workStatusRows.id }).from(workStatusRows)
          .where(inArray(workStatusRows.firmClientId, fcIds));
        if (linkedRows.length > 0) {
          const rowIds = linkedRows.map(r => r.id);
          await tx.delete(workStatusCells).where(inArray(workStatusCells.rowId, rowIds));
          await tx.delete(workStatusRows).where(inArray(workStatusRows.firmClientId, fcIds));
        }
        await tx.delete(firmClients).where(inArray(firmClients.contactId, safeIds));
      }
      await tx.delete(contacts).where(inArray(contacts.id, safeIds));
    });
    logActivity({ companyId: Number(req.query.companyId) || 0, userId: (req.user as any)?.id, userName: (req.user as any)?.username, action: "bulk_delete", entityType: "contact", entityId: safeIds.join(","), entityName: `ลบคู่ค้า ${safeIds.length} รายการ` }).catch(() => {});
    res.json({ success: true, deleted: safeIds.length });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/contacts/reset-all", requireAuth, requireAdmin, async (req, res) => {
  try {
    const companyId = Number(req.query.companyId);
    if (!companyId) return res.status(400).json({ message: "กรุณาระบุ companyId" });
    const type = req.query.type as string || "customer";

    const allContacts = await db.select({ id: contacts.id }).from(contacts)
      .where(and(eq(contacts.companyId, companyId), eq(contacts.type, type)));
    const contactIds = allContacts.map(c => c.id);

    if (contactIds.length > 0) {
      await db.transaction(async (tx) => {
        await tx.update(firmClients).set({ contactId: null }).where(inArray(firmClients.contactId, contactIds));
        await tx.delete(contacts).where(inArray(contacts.id, contactIds));
      });
    }

    const maxCodeRow = await db.select({ code: contacts.code }).from(contacts)
      .where(and(eq(contacts.companyId, companyId), eq(contacts.type, type)))
      .orderBy(desc(contacts.code)).limit(1);
    const nextCode = maxCodeRow.length > 0 ? maxCodeRow[0].code : null;

    const user = req.user as any;
    logActivity({ companyId, tenantId: user.tenantId, userId: user.id, userName: user.username, action: "reset_all", entityType: "contact", entityId: String(contactIds.length), entityName: `Reset คู่ค้า ${type} ${contactIds.length} รายการ` }).catch(() => {});
    res.json({ success: true, deleted: contactIds.length, message: `ลบคู่ค้า ${contactIds.length} ราย สำเร็จ — รหัสจะเริ่มที่ C0001 ใหม่` });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.delete("/api/contacts/:id", requireAuth, requireModule("contacts"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = await storage.getContact(id);
    if (!existing) return res.status(404).json({ message: "ไม่พบคู่ค้า" });
    { const ac = await checkDocOwnership(existing.companyId, req.user); if (!ac.allowed) return res.status(403).json({ message: ac.message }); }

    const linkedDocs: string[] = [];
    const [qo] = await db.select({ c: sql<number>`count(*)` }).from(quotations).where(eq(quotations.customerId, id));
    if (Number(qo.c) > 0) linkedDocs.push(`ใบเสนอราคา ${qo.c} รายการ`);
    const [iv] = await db.select({ c: sql<number>`count(*)` }).from(invoices).where(eq(invoices.customerId, id));
    if (Number(iv.c) > 0) linkedDocs.push(`ใบแจ้งหนี้ ${iv.c} รายการ`);
    const [tx] = await db.select({ c: sql<number>`count(*)` }).from(taxInvoices).where(eq(taxInvoices.customerId, id));
    if (Number(tx.c) > 0) linkedDocs.push(`ใบกำกับภาษี ${tx.c} รายการ`);
    const [rc] = await db.select({ c: sql<number>`count(*)` }).from(receipts).where(eq(receipts.customerId, id));
    if (Number(rc.c) > 0) linkedDocs.push(`ใบเสร็จรับเงิน ${rc.c} รายการ`);
    const [so] = await db.select({ c: sql<number>`count(*)` }).from(salesOrders).where(eq(salesOrders.customerId, id));
    if (Number(so.c) > 0) linkedDocs.push(`ใบสั่งขาย ${so.c} รายการ`);
    const [bn] = await db.select({ c: sql<number>`count(*)` }).from(billingNotes).where(eq(billingNotes.customerId, id));
    if (Number(bn.c) > 0) linkedDocs.push(`ใบวางบิล ${bn.c} รายการ`);
    const [pt] = await db.select({ c: sql<number>`count(*)` }).from(posTransactions).where(eq(posTransactions.customerId, id));
    if (Number(pt.c) > 0) linkedDocs.push(`POS ${pt.c} รายการ`);
    const [fc] = await db.select({ c: sql<number>`count(*)` }).from(firmClients).where(eq(firmClients.contactId, id));
    if (Number(fc.c) > 0) linkedDocs.push(`ลูกค้าสำนักงาน ${fc.c} รายการ`);

    if (linkedDocs.length > 0) {
      return res.status(400).json({
        message: `ลบไม่ได้ — คู่ค้า "${existing.name}" มีเอกสารเชื่อมโยง: ${linkedDocs.join(", ")}`,
        linkedDocs,
      });
    }

    await storage.deleteContact(id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// ==================== Contact Duplicates ====================
app.get("/api/contacts/duplicates", requireAuth, requireModule("contacts"), async (req, res) => {
  try {
    const companyId = Number(req.query.companyId);
    if (!companyId) return res.status(400).json({ message: "กรุณาระบุบริษัท" });
    const dupes = await db.execute(sql`
      SELECT c1.id, c1.code, c1.name, c1.tax_id, c1.type, c1.branch, c1.phone, c1.email
      FROM contacts c1
      WHERE c1.company_id = ${companyId} AND c1.active = true
        AND c1.tax_id IS NOT NULL AND c1.tax_id != ''
        AND EXISTS (
          SELECT 1 FROM contacts c2 
          WHERE c2.company_id = c1.company_id AND c2.tax_id = c1.tax_id 
            AND c2.active = true AND c2.id != c1.id
        )
      ORDER BY c1.tax_id, c1.id
    `);
    const groups: Record<string, any[]> = {};
    for (const row of dupes.rows) {
      const key = row.tax_id as string;
      if (!groups[key]) groups[key] = [];
      groups[key].push(row);
    }
    res.json({ groups: Object.values(groups), totalDuplicates: dupes.rows.length });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/contacts/merge", requireAuth, requireModule("contacts"), async (req, res) => {
  try {
    const { keepId, removeIds, companyId } = req.body;
    const safeKeepId = Number(keepId);
    const safeCompanyId = Number(companyId);
    const safeRemoveIds = (Array.isArray(removeIds) ? removeIds : []).map(Number).filter(n => !isNaN(n) && n > 0 && n !== Number(keepId));
    if (!safeKeepId || safeRemoveIds.length === 0 || !safeCompanyId) {
      return res.status(400).json({ message: "กรุณาระบุรายการที่จะรวม" });
    }
    const keepContact = await storage.getContact(safeKeepId);
    if (!keepContact || keepContact.companyId !== safeCompanyId) {
      return res.status(404).json({ message: "ไม่พบคู่ค้าที่จะเก็บไว้" });
    }
    const removeContacts = await db.select({ id: contacts.id, companyId: contacts.companyId }).from(contacts)
      .where(and(inArray(contacts.id, safeRemoveIds), eq(contacts.companyId, safeCompanyId)));
    const validRemoveIds = removeContacts.map(c => c.id);
    if (validRemoveIds.length === 0) {
      return res.status(400).json({ message: "ไม่พบรายการที่จะลบในบริษัทนี้" });
    }

    let totalMoved = 0;
    await db.transaction(async (tx) => {
      for (const removeId of validRemoveIds) {
        const updates: Array<Promise<any>> = [
          tx.update(firmClients).set({ contactId: safeKeepId }).where(eq(firmClients.contactId, removeId)),
          tx.update(salesOrders).set({ customerId: safeKeepId }).where(eq(salesOrders.customerId, removeId)),
          tx.update(quotations).set({ customerId: safeKeepId }).where(eq(quotations.customerId, removeId)),
          tx.update(invoices).set({ customerId: safeKeepId }).where(eq(invoices.customerId, removeId)),
          tx.update(taxInvoices).set({ customerId: safeKeepId }).where(eq(taxInvoices.customerId, removeId)),
          tx.update(receipts).set({ customerId: safeKeepId }).where(eq(receipts.customerId, removeId)),
          tx.update(billingNotes).set({ customerId: safeKeepId }).where(eq(billingNotes.customerId, removeId)),
          tx.update(paymentVouchers).set({ vendorId: safeKeepId }).where(eq(paymentVouchers.vendorId, removeId)),
          tx.update(purchaseRequests).set({ vendorId: safeKeepId }).where(eq(purchaseRequests.vendorId, removeId)),
          tx.update(purchaseOrders).set({ vendorId: safeKeepId }).where(eq(purchaseOrders.vendorId, removeId)),
          tx.update(purchaseInvoices).set({ vendorId: safeKeepId }).where(eq(purchaseInvoices.vendorId, removeId)),
          tx.update(expenses).set({ vendorId: safeKeepId }).where(eq(expenses.vendorId, removeId)),
        ];
        const results = await Promise.all(updates);
        totalMoved += results.reduce((s, r) => s + ((r as any)?.rowCount || 0), 0);

        const extraUpdates: Array<Promise<any>> = [
          tx.update(withholdingTaxCerts).set({ payeeVendorId: safeKeepId }).where(eq(withholdingTaxCerts.payeeVendorId, removeId)),
          tx.update(posTransactions).set({ customerId: safeKeepId }).where(eq(posTransactions.customerId, removeId)),
          tx.update(depositReceipts).set({ customerId: safeKeepId }).where(eq(depositReceipts.customerId, removeId)),
          tx.update(salesCreditNotes).set({ customerId: safeKeepId }).where(eq(salesCreditNotes.customerId, removeId)),
          tx.update(purchaseDebitNotes).set({ vendorId: safeKeepId }).where(eq(purchaseDebitNotes.vendorId, removeId)),
          tx.update(purchaseDeposits).set({ vendorId: safeKeepId }).where(eq(purchaseDeposits.vendorId, removeId)),
        ];
        const extraResults = await Promise.all(extraUpdates);
        totalMoved += extraResults.reduce((s, r) => s + ((r as any)?.rowCount || 0), 0);

        await tx.update(contacts).set({ active: false }).where(eq(contacts.id, removeId));
      }
    });

    logActivity({ companyId: safeCompanyId, userId: (req.user as any)?.id, userName: (req.user as any)?.username, action: "merge", entityType: "contact", entityId: String(safeKeepId), entityName: keepContact.name || "", details: `รวมคู่ค้า ${validRemoveIds.length} รายการ → ${keepContact.code} (ย้าย ${totalMoved} เอกสาร)` }).catch(() => {});
    res.json({ message: `รวมสำเร็จ: เก็บ ${keepContact.code} ${keepContact.name}, ลบ ${validRemoveIds.length} รายการ, ย้ายเอกสาร ${totalMoved} รายการ`, keepId: safeKeepId, removedCount: validRemoveIds.length, movedReferences: totalMoved });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ==================== Contact Settings ====================
app.get("/api/contacts/settings", requireAuth, requireModule("contacts"), async (req, res) => {
  try {
    const companyId = Number(req.query.companyId);
    if (!companyId) return res.status(400).json({ message: "กรุณาระบุ companyId" });
    const settings = await storage.getContactSettings(companyId);
    res.json(settings || { autoCode: true, codePrefix: "C", codeDigits: 4, defaultType: "customer", defaultCreditDays: 30 });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.put("/api/contacts/settings", requireAuth, requireModule("contacts"), async (req, res) => {
  try {
    const schema = z.object({
      companyId: z.number().int().positive(),
      autoCode: z.boolean().optional(),
      codePrefix: z.string().max(10).optional(),
      codeDigits: z.number().int().min(2).max(8).optional(),
      defaultType: z.enum(["customer", "vendor", "both"]).optional(),
      defaultCreditDays: z.number().int().min(0).max(365).optional(),
    });
    const parsed = schema.parse(req.body);
    const result = await storage.upsertContactSettings(parsed);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

app.get("/api/contacts/next-code", requireAuth, requireModule("contacts"), async (req, res) => {
  try {
    const companyId = Number(req.query.companyId);
    if (!companyId) return res.status(400).json({ message: "กรุณาระบุ companyId" });
    const code = await storage.getNextContactCode(companyId);
    res.json({ code });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ==================== Contact Import ====================
app.get("/api/contacts/import/template", requireAuth, (_req, res) => {
  const headers = ["รหัสคู่ค้า", "ชื่อคู่ค้า", "ชื่ออังกฤษ", "ชื่อจีน", "ประเภท", "เลขภาษี", "สาขา", "ที่อยู่", "โทรศัพท์", "อีเมล", "ผู้ติดต่อ", "เครดิต", "หมายเหตุ"];
  const sample = ["C001", "บริษัท ตัวอย่าง จำกัด", "Example Co., Ltd.", "", "ลูกค้า", "1234567890123", "สำนักงานใหญ่", "123 ถนนสุขุมวิท", "02-123-4567", "info@example.com", "คุณสมชาย", 30, ""];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, sample]);
  const colWidths = [12, 30, 25, 20, 10, 18, 16, 30, 15, 25, 15, 8, 20];
  ws["!cols"] = colWidths.map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws, "Contacts");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=template_contacts.xlsx");
  res.send(Buffer.from(buf));
});

app.get("/api/contacts/export", requireAuth, requireModule("contacts"), async (req, res) => {
  try {
    const companyId = Number(req.query.companyId);
    if (!companyId) return res.status(400).json({ message: "กรุณาระบุ companyId" });
    const contacts = await storage.getContacts(companyId);
    const active = contacts.filter(c => c.active);
    const headers = ["รหัสคู่ค้า", "ชื่อคู่ค้า", "ชื่ออังกฤษ", "ชื่อจีน", "ประเภท", "เลขภาษี", "สาขา", "ที่อยู่", "ที่อยู่อังกฤษ", "ที่อยู่จีน", "โทรศัพท์", "อีเมล", "ผู้ติดต่อ", "เครดิต", "หมายเหตุ"];
    const typeLabel: Record<string, string> = { customer: "ลูกค้า", vendor: "ผู้ขาย", both: "ลูกค้า/ผู้ขาย" };
    const rows = active.map(c => [
      c.code, c.name, c.nameEn || "", c.nameZh || "",
      typeLabel[c.type] || c.type,
      c.taxId || "", c.branch || "", c.address || "", c.addressEn || "", c.addressZh || "",
      c.phone || "", c.email || "", c.contactPerson || "",
      c.creditDays ?? 30, c.notes || ""
    ]);
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const colWidths = [12, 30, 25, 20, 10, 18, 16, 30, 25, 20, 15, 25, 15, 8, 20];
    ws["!cols"] = colWidths.map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, "Contacts");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=contacts_export.xlsx");
    res.send(Buffer.from(buf));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });

app.post("/api/contacts/import/preview", requireAuth, requireModule("contacts"), upload.single("file"), async (req: any, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "กรุณาอัปโหลดไฟล์" });
    const companyId = Number(req.body.companyId);
    if (!companyId) return res.status(400).json({ message: "กรุณาระบุ companyId" });

    let rows: any[] = [];
    const ext = path.extname(req.file.originalname).toLowerCase();

    if (ext === ".csv") {
      let content = req.file.buffer.toString("utf-8");
      const hasThai = /[\u0E00-\u0E7F]/.test(content);
      const hasHighBytes = req.file.buffer.some((b: number) => b >= 0xA1 && b <= 0xFB);
      if (!hasThai && hasHighBytes) {
        try {
          const decoder = new TextDecoder("tis-620");
          content = decoder.decode(req.file.buffer);
        } catch {
          content = req.file.buffer.toString("latin1");
        }
      }
      const firstLine = content.split(/\r?\n/)[0];
      const delimiter = firstLine.includes("\t") ? "\t" : ",";
      rows = csvParse(content, { columns: true, skip_empty_lines: true, trim: true, bom: true, delimiter, relax_quotes: true, relax_column_count: true });
    } else if (ext === ".xlsx" || ext === ".xls") {
      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    } else {
      return res.status(400).json({ message: "รองรับเฉพาะไฟล์ .csv, .xlsx, .xls" });
    }

    if (rows.length === 0) return res.status(400).json({ message: "ไม่พบข้อมูลในไฟล์" });
    if (rows.length > 5000) return res.status(400).json({ message: "รองรับสูงสุด 5,000 รายการต่อครั้ง" });

    const headers = Object.keys(rows[0]);

    const FIELD_MAP: Record<string, string[]> = {
      code: ["code", "รหัส", "รหัสคู่ค้า", "contact_code", "id", "รหัสลูกค้า", "customer_code", "vendor_code", "no", "ลำดับ", "เลขที่"],
      name: ["name", "ชื่อ", "ชื่อคู่ค้า", "contact_name", "company_name", "ชื่อบริษัท", "ชื่อลูกค้า", "customer_name", "ชื่อผู้ขาย", "vendor_name", "ชื่อกิจการ"],
      nameEn: ["name_en", "nameEn", "ชื่ออังกฤษ", "english_name"],
      nameZh: ["name_zh", "nameZh", "ชื่อจีน", "chinese_name"],
      type: ["type", "ประเภท", "contact_type"],
      taxId: ["tax_id", "taxId", "เลขภาษี", "เลขประจำตัวผู้เสียภาษี", "tax_number", "tin", "เลขผู้เสียภาษี", "tax"],
      branch: ["branch", "สาขา", "สาขาที่"],
      address: ["address", "ที่อยู่", "ที่อยู่จดทะเบียน"],
      addressEn: ["address_en", "addressEn", "ที่อยู่อังกฤษ"],
      addressZh: ["address_zh", "addressZh", "ที่อยู่จีน"],
      phone: ["phone", "โทรศัพท์", "tel", "telephone", "เบอร์โทร", "เบอร์", "mobile", "มือถือ"],
      email: ["email", "อีเมล", "e-mail", "อีเมลล์"],
      contactPerson: ["contact_person", "contactPerson", "ผู้ติดต่อ", "ชื่อผู้ติดต่อ"],
      creditDays: ["credit_days", "creditDays", "เครดิต", "credit", "เครดิตวัน", "วันเครดิต"],
      notes: ["notes", "หมายเหตุ", "remark", "remarks", "note"],
    };

    const mapField = (header: string): string | null => {
      const h = header.trim().toLowerCase();
      for (const [field, aliases] of Object.entries(FIELD_MAP)) {
        if (aliases.some(a => a.toLowerCase() === h)) return field;
      }
      return null;
    };

    const columnMapping: Record<string, string | null> = {};
    headers.forEach(h => { columnMapping[h] = mapField(h); });

    const existingContacts = await storage.getContacts(companyId);
    const existingCodes = new Set(existingContacts.filter(c => c.active).map(c => c.code));
    const existingTaxIds = new Set(existingContacts.filter(c => c.active && c.taxId && c.taxId.length >= 5).map(c => c.taxId));

    const preview = rows.map((row: any, idx: number) => {
      const mapped: any = {};
      for (const [header, value] of Object.entries(row)) {
        const field = columnMapping[header];
        if (field) {
          const v = String(value ?? "").trim();
          mapped[field] = v === "-" || v === "." || v === "N/A" ? "" : v;
        }
      }

      const issues: string[] = [];
      if (!mapped.code) issues.push("ไม่มีรหัสคู่ค้า");
      if (!mapped.name) issues.push("ไม่มีชื่อคู่ค้า");
      if (mapped.code && existingCodes.has(mapped.code)) issues.push(`รหัส "${mapped.code}" มีในระบบแล้ว`);
      const taxIdValid = mapped.taxId && mapped.taxId.length >= 5;
      if (taxIdValid && existingTaxIds.has(mapped.taxId)) issues.push(`เลขภาษี "${mapped.taxId}" มีในระบบแล้ว (แนะนำตรวจสอบ)`);

      if (mapped.type) {
        const t = mapped.type.toLowerCase();
        if (["ลูกค้า", "customer"].includes(t)) mapped.type = "customer";
        else if (["ผู้ขาย", "vendor", "supplier"].includes(t)) mapped.type = "vendor";
        else if (["ทั้งสอง", "both", "ลูกค้า/ผู้ขาย"].includes(t)) mapped.type = "both";
        else mapped.type = "customer";
      } else {
        mapped.type = "customer";
      }

      if (mapped.creditDays) mapped.creditDays = Number(mapped.creditDays) || 30;
      else mapped.creditDays = 30;

      const hasCodeDuplicate = issues.some(i => i.startsWith('รหัส "') && i.includes("มีในระบบแล้ว"));
      const hasMissingField = issues.some(i => i.startsWith("ไม่มี"));
      let status: string = "ok";
      if (hasMissingField) status = "error";
      else if (hasCodeDuplicate) status = "duplicate";
      else if (issues.length > 0) status = "warning";

      return {
        row: idx + 1,
        data: mapped,
        issues,
        status,
      };
    });

    const seenCodes = new Set<string>();
    preview.forEach(p => {
      if (p.data.code && seenCodes.has(p.data.code)) {
        p.issues.push(`รหัส "${p.data.code}" ซ้ำในไฟล์`);
        p.status = "duplicate";
      }
      if (p.data.code) seenCodes.add(p.data.code);
    });

    res.json({
      headers,
      columnMapping,
      totalRows: rows.length,
      preview,
      stats: {
        ok: preview.filter(p => p.status === "ok").length,
        warning: preview.filter(p => p.status === "warning").length,
        duplicate: preview.filter(p => p.status === "duplicate").length,
        error: preview.filter(p => p.status === "error").length,
      },
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/contacts/import/execute", requireAuth, requireModule("contacts"), async (req, res) => {
  try {
    const { companyId, contacts: contactList } = req.body;
    if (!companyId || !contactList || !Array.isArray(contactList)) {
      return res.status(400).json({ message: "ข้อมูลไม่ถูกต้อง" });
    }

    const existingContacts = await storage.getContacts(companyId);
    const existingCodes = new Set(existingContacts.filter(c => c.active).map(c => c.code));
    const existingNames = new Set(existingContacts.filter(c => c.active).map(c => c.name?.toLowerCase()));
    const existingTaxIds = new Set(existingContacts.filter(c => c.active && c.taxId).map(c => c.taxId!));

    const validContacts = contactList
      .filter((c: any) => {
        if (!c.code || !c.name) return false;
        if (existingCodes.has(c.code)) return false;
        if (existingNames.has(c.name.toLowerCase())) return false;
        if (c.taxId && existingTaxIds.has(c.taxId)) return false;
        existingCodes.add(c.code);
        existingNames.add(c.name.toLowerCase());
        if (c.taxId) existingTaxIds.add(c.taxId);
        return true;
      })
      .map((c: any) => ({
        companyId,
        code: c.code,
        name: c.name,
        nameEn: c.nameEn || null,
        nameZh: c.nameZh || null,
        type: c.type || "customer",
        taxId: c.taxId || null,
        branch: c.branch || "สำนักงานใหญ่",
        address: c.address || null,
        addressEn: c.addressEn || null,
        addressZh: c.addressZh || null,
        phone: c.phone || null,
        email: c.email || null,
        contactPerson: c.contactPerson || null,
        creditDays: Number(c.creditDays) || 30,
        notes: c.notes || null,
      }));

    if (validContacts.length === 0) {
      return res.status(400).json({ message: "ไม่มีรายการที่สามารถนำเข้าได้" });
    }

    const created = await storage.bulkCreateContacts(validContacts);
    const createdIds = created.map((c: any) => c.id).filter(Boolean);
    let batchId: number | undefined;
    if (createdIds.length > 0) {
      const [batch] = await db.insert(documentImportBatches).values({
        companyId,
        docType: "contact",
        fileName: req.body.fileName || null,
        totalCreated: createdIds.length,
        totalSkipped: contactList.length - created.length,
        totalErrors: 0,
        createdDocIds: JSON.stringify(createdIds),
        createdBy: (req.user as any).id,
      }).returning();
      batchId = batch.id;
    }
    res.json({ imported: created.length, total: contactList.length, skipped: contactList.length - created.length, batchId });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

}
