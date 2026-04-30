import type { Express, Request, Response } from "express";
import { db } from "../db";
import { storage } from "../storage";
import { eq, desc, and, or, inArray, count } from "drizzle-orm";
import { receipts, depositReceipts, contacts, users, purchaseDeposits, taxInvoices, taxInvoiceItems, salesCreditNotes, salesCreditNoteItems, purchaseInvoices, purchaseInvoiceItems, purchaseDebitNotes, purchaseDebitNoteItems, purchaseDepositDeductions, depositDeductions, companies, documentSettings, journalEntries, journalLines } from "@shared/schema";
import { requireAuth, requireModule, requireRole, requireAnyModule, checkDocOwnership } from "../route-middleware";
import { sql } from "drizzle-orm";
import { getNextDocNo, createAutoJournalEntry, resolvePaymentMethodAccountCode, logActivity, upsertWarehouseStockLevel, getInventoryTriggers } from "../route-helpers";
import { parsePagination, paginatedResponse } from "./pagination";
import { runCreditNoteShareTokenMigration, runCreditNoteOriginalAmountMigration } from "@shared/schema-extra";

export function registerFinancialDocsRoutes(app: Express) {
runCreditNoteShareTokenMigration(db);
runCreditNoteOriginalAmountMigration(db);

// ========== Deposit Receipt Routes (ใบรับเงินมัดจำ) ==========

app.get("/api/deposit-receipts/available", requireAuth, requireAnyModule("sales", "ecommerce"), async (req, res) => {
  try {
    const companyId = Number(req.query.companyId);
    const customerId = Number(req.query.customerId);
    if (!companyId) return res.status(400).json({ message: "companyId required" });
    if (!customerId) return res.status(400).json({ message: "customerId required" });
    const rows = await db.select().from(depositReceipts)
      .where(and(
        eq(depositReceipts.companyId, companyId),
        eq(depositReceipts.customerId, customerId),
        eq(depositReceipts.status, "approved"),
        or(
          eq(depositReceipts.depositStatus, "available"),
          eq(depositReceipts.depositStatus, "partial")
        )
      ))
      .orderBy(desc(depositReceipts.depositDate), desc(depositReceipts.id));
    res.json(rows);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.get("/api/deposit-receipts", requireAuth, requireAnyModule("sales", "ecommerce"), async (req, res) => {
  try {
    const companyId = Number(req.query.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId required" });
    const whereClause = eq(depositReceipts.companyId, companyId);
    const buildResult = async (rows: any[]) => {
      const userIds = Array.from(new Set(rows.map((r: any) => r.deposit.createdBy).concat(rows.map((r: any) => r.deposit.updatedBy)).filter(Boolean))) as number[];
      const userMap: Record<number, string> = {};
      if (userIds.length > 0) { const uu = await db.select({ id: users.id, fullName: users.fullName }).from(users).where(inArray(users.id, userIds)); for (const u of uu) userMap[u.id] = u.fullName; }
      return rows.map((r: any) => ({ ...r.deposit, contactName: r.contactName || r.deposit.customerName, contactCode: r.contactCode || r.deposit.customerCode, createdByName: r.deposit.createdBy ? userMap[r.deposit.createdBy] || "-" : "-", updatedByName: r.deposit.updatedBy ? userMap[r.deposit.updatedBy] || "-" : "-" }));
    };
    const query = db.select({ deposit: depositReceipts, contactName: contacts.name, contactCode: contacts.code }).from(depositReceipts).leftJoin(contacts, eq(depositReceipts.customerId, contacts.id)).where(whereClause).orderBy(desc(depositReceipts.depositDate), desc(depositReceipts.id));
    if (req.query.page) {
      const { page, pageSize, offset } = parsePagination(req, { pageSize: 50 });
      const [{ total }] = await db.select({ total: count() }).from(depositReceipts).where(whereClause);
      const rows = await query.limit(pageSize).offset(offset);
      return res.json(paginatedResponse(await buildResult(rows), Number(total), { page, pageSize, offset }));
    }
    const rows = await query;
    res.json(await buildResult(rows));
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.get("/api/deposit-receipts/:id", requireAuth, requireAnyModule("sales", "ecommerce"), async (req, res) => {
  try {
    const [doc] = await db.select().from(depositReceipts).where(eq(depositReceipts.id, Number(req.params.id)));
    if (!doc) return res.status(404).json({ message: "ไม่พบใบรับเงินมัดจำ" });
    { const ac = await checkDocOwnership(doc.companyId, req.user); if (!ac.allowed) return res.status(403).json({ message: ac.message }); }
    const deductions = await db.select().from(depositDeductions).where(eq(depositDeductions.depositReceiptId, doc.id));
    let createdByName = "-";
    let updatedByName = "-";
    if (doc.createdBy) { const u = await storage.getUser(doc.createdBy); if (u) createdByName = u.fullName; }
    if (doc.updatedBy) { const u = await storage.getUser(doc.updatedBy); if (u) updatedByName = u.fullName; }
    res.json({ ...doc, deductions, createdByName, updatedByName });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post("/api/deposit-receipts", requireAuth, requireAnyModule("sales", "ecommerce"), async (req, res) => {
  try {
    const body = req.body;
    const user = req.user as any;
    const companyId = Number(body.companyId);
    if (!companyId || !body.customerName || !body.depositDate) {
      return res.status(400).json({ message: "กรุณากรอกข้อมูลให้ครบถ้วน (companyId, customerName, depositDate)" });
    }
    if (body.customerId === "" || body.customerId === undefined) body.customerId = null;
    else body.customerId = Number(body.customerId) || null;

    const prefix = body.docPrefix || "DP";
    let depositNo = body.depositNo;
    if (!depositNo) {
      depositNo = await getNextDocNo(companyId, prefix, depositReceipts, depositReceipts.depositNo, depositReceipts.companyId, body.depositDate);
    }

    const totalAmount = body.totalAmount || "0";

    const result = await db.transaction(async (tx) => {
      const [doc] = await tx.insert(depositReceipts).values({
        companyId,
        depositNo,
        depositDate: body.depositDate,
        customerId: body.customerId ? Number(body.customerId) : null,
        customerCode: body.customerCode || null,
        customerName: body.customerName,
        customerAddress: body.customerAddress || null,
        customerTaxId: body.customerTaxId || null,
        branch: body.branch || null,
      sellerBranchId: body.sellerBranchId || null,
        contactPerson: body.contactPerson || null,
        contactPhone: body.contactPhone || null,
        contactEmail: body.contactEmail || null,
        description: body.description || null,
        subtotal: body.subtotal || "0",
        vatAmount: body.vatAmount || "0",
        totalAmount,
        usedAmount: "0",
        remainingAmount: totalAmount,
        depositStatus: "available",
        status: body.status || "approved",
        paymentMethod: body.paymentMethod || null,
        priceMode: body.priceMode || "excluded",
        currencyCode: body.currencyCode || "THB",
        exchangeRate: body.exchangeRate || "1",
        docPrefix: prefix,
        notes: body.notes || null,
        linkJournal: body.linkJournal ?? true,
        createdBy: user.id,
      }).returning();
      return doc;
    });

    let journalResult = null;
    try {
      const pmAccCode = await resolvePaymentMethodAccountCode(result.companyId, result.paymentMethod);
      journalResult = await createAutoJournalEntry({
        companyId: result.companyId,
        documentType: "deposit",
        sourceDocType: "deposit",
        sourceDocId: result.id,
        docDate: result.depositDate,
        docNo: result.depositNo,
        subtotal: String(result.subtotal),
        vatAmount: String(result.vatAmount || "0"),
        totalAmount: String(result.totalAmount),
        currencyCode: result.currencyCode || "THB",
        exchangeRate: String(result.exchangeRate || "1"),
        userId: user.id,
        customerName: result.customerName,
        paymentMethod: result.paymentMethod || undefined,
        paymentMethodAccountCode: pmAccCode,
        overrideLines: body?.journalOverrideLines || req?.body?.journalOverrideLines || undefined,
      });
    } catch (e) {}

    res.status(201).json({ ...result, journalResult });
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

app.patch("/api/deposit-receipts/:id", requireAuth, requireAnyModule("sales", "ecommerce"), async (req, res) => {
  try {
    const [existing] = await db.select().from(depositReceipts).where(eq(depositReceipts.id, Number(req.params.id)));
    if (!existing) return res.status(404).json({ message: "ไม่พบใบรับเงินมัดจำ" });
    { const ac = await checkDocOwnership(existing.companyId, req.user); if (!ac.allowed) return res.status(403).json({ message: ac.message }); }
    const body = req.body;
    const user = req.user as any;
    const updateData: any = {};
    const allowedFields = [
      "depositNo", "depositDate", "customerId", "customerCode", "customerName",
      "customerAddress", "customerTaxId", "branch", "contactPerson", "contactPhone", "contactEmail",
      "description", "subtotal", "vatAmount", "totalAmount", "usedAmount", "remainingAmount",
      "depositStatus", "status", "paymentMethod", "priceMode",
      "currencyCode", "exchangeRate", "docPrefix", "notes", "linkJournal"
    ];
    const integerFields = ["customerId"];
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (integerFields.includes(field)) {
          updateData[field] = body[field] !== "" && body[field] !== null && body[field] !== undefined ? Number(body[field]) || null : null;
        } else {
          updateData[field] = body[field];
        }
      }
    }
    updateData.updatedBy = user.id;
    updateData.updatedAt = new Date();

    if (updateData.totalAmount && !updateData.remainingAmount) {
      const usedAmt = parseFloat(String(existing.usedAmount || "0"));
      const newTotal = parseFloat(String(updateData.totalAmount));
      updateData.remainingAmount = String(Math.max(0, newTotal - usedAmt).toFixed(2));
    }

    await db.update(depositReceipts).set(updateData).where(eq(depositReceipts.id, existing.id));

    const wasNotApproved = existing.status !== "approved";
    const isNowApproved = updateData.status === "approved" || (existing.status === "approved" && updateData.status === undefined);

    let journalResult = null;
    if (wasNotApproved && updateData.status === "approved") {
      try {
        const updated = { ...existing, ...updateData };
        const pmAccCode = await resolvePaymentMethodAccountCode(updated.companyId, updated.paymentMethod);
        journalResult = await createAutoJournalEntry({
          companyId: updated.companyId,
          documentType: "deposit",
          sourceDocType: "deposit",
          sourceDocId: existing.id,
          docDate: updated.depositDate,
          docNo: updated.depositNo,
          subtotal: String(updated.subtotal),
          vatAmount: String(updated.vatAmount || "0"),
          totalAmount: String(updated.totalAmount),
          currencyCode: updated.currencyCode || "THB",
          exchangeRate: String(updated.exchangeRate || "1"),
          userId: user.id,
          customerName: updated.customerName,
          paymentMethod: updated.paymentMethod || undefined,
          paymentMethodAccountCode: pmAccCode,
          overrideLines: body?.journalOverrideLines || req?.body?.journalOverrideLines || undefined,
        });
      } catch (e) {}
    }

    const [updatedDoc] = await db.select().from(depositReceipts).where(eq(depositReceipts.id, existing.id));
    const deductions = await db.select().from(depositDeductions).where(eq(depositDeductions.depositReceiptId, existing.id));
    res.json({ ...updatedDoc, deductions, journalResult });
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

app.delete("/api/deposit-receipts/:id", requireAuth, requireAnyModule("sales", "ecommerce"), async (req, res) => {
  try {
    const [existing] = await db.select().from(depositReceipts).where(eq(depositReceipts.id, Number(req.params.id)));
    if (!existing) return res.status(404).json({ message: "ไม่พบใบรับเงินมัดจำ" });
    { const ac = await checkDocOwnership(existing.companyId, req.user); if (!ac.allowed) return res.status(403).json({ message: ac.message }); }
    if (existing.status !== "draft") {
      return res.status(400).json({ message: "สามารถลบได้เฉพาะเอกสารที่เป็นแบบร่างเท่านั้น" });
    }
    const deductions = await db.select().from(depositDeductions).where(eq(depositDeductions.depositReceiptId, existing.id));
    if (deductions.length > 0) {
      return res.status(400).json({ message: "ไม่สามารถลบได้ เนื่องจากมีการหักเงินมัดจำแล้ว" });
    }
    await db.delete(depositReceipts).where(eq(depositReceipts.id, existing.id));
    res.json({ message: "ลบสำเร็จ" });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post("/api/deposit-deductions", requireAuth, requireAnyModule("sales", "ecommerce"), async (req, res) => {
  try {
    const { depositReceiptId, documentType, documentId, documentNo, amount } = req.body;
    if (!depositReceiptId || !documentType || !documentId || !amount) {
      return res.status(400).json({ message: "กรุณากรอกข้อมูลให้ครบถ้วน" });
    }
    const deductAmount = parseFloat(String(amount));
    if (isNaN(deductAmount) || deductAmount <= 0) {
      return res.status(400).json({ message: "จำนวนเงินไม่ถูกต้อง" });
    }

    const result = await db.transaction(async (tx) => {
      const [deposit] = await tx.select().from(depositReceipts).where(eq(depositReceipts.id, Number(depositReceiptId)));
      if (!deposit) throw new Error("ไม่พบใบรับเงินมัดจำ");
      if (deposit.status !== "approved") throw new Error("ใบรับเงินมัดจำยังไม่ได้อนุมัติ");

      const remaining = parseFloat(String(deposit.remainingAmount || "0"));
      if (deductAmount > remaining) {
        throw new Error(`จำนวนเงินเกินยอดคงเหลือ (คงเหลือ ${remaining.toFixed(2)})`);
      }

      const [deduction] = await tx.insert(depositDeductions).values({
        depositReceiptId: Number(depositReceiptId),
        documentType,
        documentId: Number(documentId),
        documentNo: documentNo || null,
        amount: String(deductAmount.toFixed(2)),
      }).returning();

      const newUsed = parseFloat(String(deposit.usedAmount || "0")) + deductAmount;
      const newRemaining = parseFloat(String(deposit.totalAmount)) - newUsed;
      let newStatus = "available";
      if (newRemaining <= 0) {
        newStatus = "used";
      } else if (newUsed > 0) {
        newStatus = "partial";
      }

      await tx.update(depositReceipts).set({
        usedAmount: String(newUsed.toFixed(2)),
        remainingAmount: String(Math.max(0, newRemaining).toFixed(2)),
        depositStatus: newStatus,
        updatedAt: new Date(),
      }).where(eq(depositReceipts.id, deposit.id));

      return deduction;
    });

    res.status(201).json(result);
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

app.get("/api/deposit-deductions/by-document", requireAuth, requireAnyModule("sales", "ecommerce"), async (req, res) => {
  try {
    const { documentType, documentId } = req.query;
    if (!documentType || !documentId) return res.status(400).json({ message: "documentType and documentId required" });
    const rows = await db.select().from(depositDeductions)
      .where(and(
        eq(depositDeductions.documentType, String(documentType)),
        eq(depositDeductions.documentId, Number(documentId)),
      ));
    res.json(rows);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.put("/api/deposit-deductions/replace", requireAuth, requireAnyModule("sales", "ecommerce"), async (req, res) => {
  try {
    const { documentType, documentId, deductions } = req.body;
    if (!documentType || !documentId) return res.status(400).json({ message: "documentType and documentId required" });

    await db.transaction(async (tx) => {
      const existing = await tx.select().from(depositDeductions)
        .where(and(
          eq(depositDeductions.documentType, String(documentType)),
          eq(depositDeductions.documentId, Number(documentId)),
        ));

      for (const old of existing) {
        const [deposit] = await tx.select().from(depositReceipts).where(eq(depositReceipts.id, old.depositReceiptId));
        if (deposit) {
          const oldAmount = parseFloat(String(old.amount || "0"));
          const currentUsed = parseFloat(String(deposit.usedAmount || "0"));
          const newUsed = Math.max(0, currentUsed - oldAmount);
          const totalAmt = parseFloat(String(deposit.totalAmount));
          const newRemaining = totalAmt - newUsed;
          await tx.update(depositReceipts).set({
            usedAmount: String(newUsed.toFixed(2)),
            remainingAmount: String(Math.max(0, newRemaining).toFixed(2)),
            depositStatus: newUsed <= 0 ? "available" : newRemaining <= 0 ? "used" : "partial",
            updatedAt: new Date(),
          }).where(eq(depositReceipts.id, deposit.id));
        }
      }

      await tx.delete(depositDeductions).where(and(
        eq(depositDeductions.documentType, String(documentType)),
        eq(depositDeductions.documentId, Number(documentId)),
      ));

      const validDeds = (deductions || []).filter((d: any) => parseFloat(String(d.amount || "0")) > 0);
      for (const ded of validDeds) {
        const deductAmount = parseFloat(String(ded.amount));
        const [deposit] = await tx.select().from(depositReceipts).where(eq(depositReceipts.id, Number(ded.depositReceiptId)));
        if (!deposit) throw new Error("ไม่พบใบรับเงินมัดจำ");

        const remaining = parseFloat(String(deposit.remainingAmount || "0"));
        if (deductAmount > remaining + 0.01) {
          throw new Error(`จำนวนเงินเกินยอดคงเหลือของ ${deposit.depositNo} (คงเหลือ ${remaining.toFixed(2)})`);
        }

        await tx.insert(depositDeductions).values({
          depositReceiptId: Number(ded.depositReceiptId),
          documentType,
          documentId: Number(documentId),
          documentNo: ded.documentNo || null,
          amount: String(deductAmount.toFixed(2)),
        });

        const currentUsed = parseFloat(String(deposit.usedAmount || "0"));
        const newUsed = currentUsed + deductAmount;
        const totalAmt = parseFloat(String(deposit.totalAmount));
        const newRemaining = totalAmt - newUsed;
        await tx.update(depositReceipts).set({
          usedAmount: String(newUsed.toFixed(2)),
          remainingAmount: String(Math.max(0, newRemaining).toFixed(2)),
          depositStatus: newUsed <= 0 ? "available" : newRemaining <= 0 ? "used" : "partial",
          updatedAt: new Date(),
        }).where(eq(depositReceipts.id, deposit.id));
      }
    });

    res.json({ success: true });
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

// ========== Purchase Deposits (ใบจ่ายเงินมัดจำ) Routes ==========

app.get("/api/purchase-deposits/available", requireAuth, requireModule("purchases"), async (req, res) => {
  try {
    const companyId = Number(req.query.companyId);
    const vendorId = Number(req.query.vendorId);
    if (!companyId) return res.status(400).json({ message: "companyId required" });
    if (!vendorId) return res.status(400).json({ message: "vendorId required" });
    const rows = await db.select().from(purchaseDeposits)
      .where(and(
        eq(purchaseDeposits.companyId, companyId),
        eq(purchaseDeposits.vendorId, vendorId),
        eq(purchaseDeposits.status, "approved"),
        or(
          eq(purchaseDeposits.depositStatus, "available"),
          eq(purchaseDeposits.depositStatus, "partial")
        )
      ))
      .orderBy(desc(purchaseDeposits.depositDate), desc(purchaseDeposits.id));
    res.json(rows);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.get("/api/purchase-deposits", requireAuth, requireModule("purchases"), async (req, res) => {
  try {
    const companyId = Number(req.query.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId required" });
    const whereClause = eq(purchaseDeposits.companyId, companyId);
    const buildResult = async (rows: any[]) => {
      const userIds = Array.from(new Set(rows.map((r: any) => r.deposit.createdBy).concat(rows.map((r: any) => r.deposit.updatedBy)).filter(Boolean))) as number[];
      const userMap: Record<number, string> = {};
      if (userIds.length > 0) { const uu = await db.select({ id: users.id, fullName: users.fullName }).from(users).where(inArray(users.id, userIds)); for (const u of uu) userMap[u.id] = u.fullName; }
      return rows.map((r: any) => ({ ...r.deposit, contactName: r.contactName || r.deposit.vendorName, contactCode: r.contactCode || r.deposit.vendorCode, createdByName: r.deposit.createdBy ? userMap[r.deposit.createdBy] || "-" : "-", updatedByName: r.deposit.updatedBy ? userMap[r.deposit.updatedBy] || "-" : "-" }));
    };
    const query = db.select({ deposit: purchaseDeposits, contactName: contacts.name, contactCode: contacts.code }).from(purchaseDeposits).leftJoin(contacts, eq(purchaseDeposits.vendorId, contacts.id)).where(whereClause).orderBy(desc(purchaseDeposits.depositDate), desc(purchaseDeposits.id));
    if (req.query.page) {
      const { page, pageSize, offset } = parsePagination(req, { pageSize: 50 });
      const [{ total }] = await db.select({ total: count() }).from(purchaseDeposits).where(whereClause);
      const rows = await query.limit(pageSize).offset(offset);
      return res.json(paginatedResponse(await buildResult(rows), Number(total), { page, pageSize, offset }));
    }
    const rows = await query;
    res.json(await buildResult(rows));
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.get("/api/purchase-deposits/:id", requireAuth, requireModule("purchases"), async (req, res) => {
  try {
    const [doc] = await db.select().from(purchaseDeposits).where(eq(purchaseDeposits.id, Number(req.params.id)));
    if (!doc) return res.status(404).json({ message: "ไม่พบใบจ่ายเงินมัดจำ" });
    { const ac = await checkDocOwnership(doc.companyId, req.user); if (!ac.allowed) return res.status(403).json({ message: ac.message }); }
    const deductions = await db.select().from(purchaseDepositDeductions).where(eq(purchaseDepositDeductions.purchaseDepositId, doc.id));
    let createdByName = "-";
    let updatedByName = "-";
    if (doc.createdBy) { const u = await storage.getUser(doc.createdBy); if (u) createdByName = u.fullName; }
    if (doc.updatedBy) { const u = await storage.getUser(doc.updatedBy); if (u) updatedByName = u.fullName; }
    res.json({ ...doc, deductions, createdByName, updatedByName });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post("/api/purchase-deposits", requireAuth, requireModule("purchases"), async (req, res) => {
  try {
    const body = req.body;
    const user = req.user as any;
    const companyId = Number(body.companyId);
    if (!companyId || !body.vendorName || !body.depositDate) {
      return res.status(400).json({ message: "กรุณากรอกข้อมูลให้ครบถ้วน (companyId, vendorName, depositDate)" });
    }
    if (body.vendorId === "" || body.vendorId === undefined) body.vendorId = null;
    else body.vendorId = Number(body.vendorId) || null;

    const prefix = body.docPrefix || "PDP";
    let depositNo = body.depositNo;
    if (!depositNo) {
      depositNo = await getNextDocNo(companyId, prefix, purchaseDeposits, purchaseDeposits.depositNo, purchaseDeposits.companyId, body.depositDate);
    }

    const totalAmount = body.totalAmount || "0";

    const result = await db.transaction(async (tx) => {
      const [doc] = await tx.insert(purchaseDeposits).values({
        companyId,
        depositNo,
        depositDate: body.depositDate,
        vendorId: body.vendorId ? Number(body.vendorId) : null,
        vendorCode: body.vendorCode || null,
        vendorName: body.vendorName,
        vendorAddress: body.vendorAddress || null,
        vendorTaxId: body.vendorTaxId || null,
        branch: body.branch || null,
      sellerBranchId: body.sellerBranchId || null,
        contactPerson: body.contactPerson || null,
        contactPhone: body.contactPhone || null,
        contactEmail: body.contactEmail || null,
        description: body.description || null,
        subtotal: body.subtotal || "0",
        vatAmount: body.vatAmount || "0",
        totalAmount,
        usedAmount: "0",
        remainingAmount: totalAmount,
        depositStatus: "available",
        status: body.status || "approved",
        paymentMethod: body.paymentMethod || null,
        priceMode: body.priceMode || "excluded",
        currencyCode: body.currencyCode || "THB",
        exchangeRate: body.exchangeRate || "1",
        docPrefix: prefix,
        notes: body.notes || null,
        linkJournal: body.linkJournal ?? true,
        createdBy: user.id,
      }).returning();
      return doc;
    });

    let journalResult = null;
    try {
      const pmAccCode = await resolvePaymentMethodAccountCode(result.companyId, result.paymentMethod);
      journalResult = await createAutoJournalEntry({
        companyId: result.companyId,
        documentType: "purchase_deposit",
        sourceDocType: "purchase_deposit",
        sourceDocId: result.id,
        docDate: result.depositDate,
        docNo: result.depositNo,
        subtotal: String(result.subtotal),
        vatAmount: String(result.vatAmount || "0"),
        totalAmount: String(result.totalAmount),
        currencyCode: result.currencyCode || "THB",
        exchangeRate: String(result.exchangeRate || "1"),
        userId: user.id,
        customerName: result.vendorName,
        paymentMethod: result.paymentMethod || undefined,
        paymentMethodAccountCode: pmAccCode,
        overrideLines: body?.journalOverrideLines || req?.body?.journalOverrideLines || undefined,
      });
    } catch (e) {}

    res.status(201).json({ ...result, journalResult });
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

app.patch("/api/purchase-deposits/:id", requireAuth, requireModule("purchases"), async (req, res) => {
  try {
    const [existing] = await db.select().from(purchaseDeposits).where(eq(purchaseDeposits.id, Number(req.params.id)));
    if (!existing) return res.status(404).json({ message: "ไม่พบใบจ่ายเงินมัดจำ" });
    { const ac = await checkDocOwnership(existing.companyId, req.user); if (!ac.allowed) return res.status(403).json({ message: ac.message }); }
    const body = req.body;
    const user = req.user as any;
    const updateData: any = {};
    const allowedFields = [
      "depositNo", "depositDate", "vendorId", "vendorCode", "vendorName",
      "vendorAddress", "vendorTaxId", "branch", "contactPerson", "contactPhone", "contactEmail",
      "description", "subtotal", "vatAmount", "totalAmount", "usedAmount", "remainingAmount",
      "depositStatus", "status", "paymentMethod", "priceMode",
      "currencyCode", "exchangeRate", "docPrefix", "notes", "linkJournal"
    ];
    const integerFields = ["vendorId"];
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (integerFields.includes(field)) {
          updateData[field] = body[field] !== "" && body[field] !== null && body[field] !== undefined ? Number(body[field]) || null : null;
        } else {
          updateData[field] = body[field];
        }
      }
    }
    updateData.updatedBy = user.id;
    updateData.updatedAt = new Date();

    if (updateData.totalAmount && !updateData.remainingAmount) {
      const usedAmt = parseFloat(String(existing.usedAmount || "0"));
      const newTotal = parseFloat(String(updateData.totalAmount));
      updateData.remainingAmount = String(Math.max(0, newTotal - usedAmt).toFixed(2));
    }

    await db.update(purchaseDeposits).set(updateData).where(eq(purchaseDeposits.id, existing.id));

    const wasNotApproved = existing.status !== "approved";

    let journalResult = null;
    if (wasNotApproved && updateData.status === "approved") {
      try {
        const updated = { ...existing, ...updateData };
        const pmAccCode = await resolvePaymentMethodAccountCode(updated.companyId, updated.paymentMethod);
        journalResult = await createAutoJournalEntry({
          companyId: updated.companyId,
          documentType: "purchase_deposit",
          sourceDocType: "purchase_deposit",
          sourceDocId: existing.id,
          docDate: updated.depositDate,
          docNo: updated.depositNo,
          subtotal: String(updated.subtotal),
          vatAmount: String(updated.vatAmount || "0"),
          totalAmount: String(updated.totalAmount),
          currencyCode: updated.currencyCode || "THB",
          exchangeRate: String(updated.exchangeRate || "1"),
          userId: user.id,
          customerName: updated.vendorName,
          paymentMethod: updated.paymentMethod || undefined,
          paymentMethodAccountCode: pmAccCode,
          overrideLines: body?.journalOverrideLines || req?.body?.journalOverrideLines || undefined,
        });
      } catch (e) {}
    }

    const [updatedDoc] = await db.select().from(purchaseDeposits).where(eq(purchaseDeposits.id, existing.id));
    const deductions = await db.select().from(purchaseDepositDeductions).where(eq(purchaseDepositDeductions.purchaseDepositId, existing.id));
    res.json({ ...updatedDoc, deductions, journalResult });
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

app.delete("/api/purchase-deposits/:id", requireAuth, requireModule("purchases"), async (req, res) => {
  try {
    const [existing] = await db.select().from(purchaseDeposits).where(eq(purchaseDeposits.id, Number(req.params.id)));
    if (!existing) return res.status(404).json({ message: "ไม่พบใบจ่ายเงินมัดจำ" });
    { const ac = await checkDocOwnership(existing.companyId, req.user); if (!ac.allowed) return res.status(403).json({ message: ac.message }); }
    if (existing.status !== "draft") {
      return res.status(400).json({ message: "สามารถลบได้เฉพาะเอกสารที่เป็นแบบร่างเท่านั้น" });
    }
    const deductions = await db.select().from(purchaseDepositDeductions).where(eq(purchaseDepositDeductions.purchaseDepositId, existing.id));
    if (deductions.length > 0) {
      return res.status(400).json({ message: "ไม่สามารถลบได้ เนื่องจากมีการหักเงินมัดจำแล้ว" });
    }
    await db.delete(purchaseDeposits).where(eq(purchaseDeposits.id, existing.id));
    res.json({ message: "ลบสำเร็จ" });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post("/api/purchase-deposit-deductions", requireAuth, requireModule("purchases"), async (req, res) => {
  try {
    const { purchaseDepositId, documentType, documentId, documentNo, amount } = req.body;
    if (!purchaseDepositId || !documentType || !documentId || !amount) {
      return res.status(400).json({ message: "กรุณากรอกข้อมูลให้ครบถ้วน" });
    }
    const deductAmount = parseFloat(String(amount));
    if (isNaN(deductAmount) || deductAmount <= 0) {
      return res.status(400).json({ message: "จำนวนเงินไม่ถูกต้อง" });
    }

    const result = await db.transaction(async (tx) => {
      const [deposit] = await tx.select().from(purchaseDeposits).where(eq(purchaseDeposits.id, Number(purchaseDepositId)));
      if (!deposit) throw new Error("ไม่พบใบจ่ายเงินมัดจำ");
      if (deposit.status !== "approved") throw new Error("ใบจ่ายเงินมัดจำยังไม่ได้อนุมัติ");

      const remaining = parseFloat(String(deposit.remainingAmount || "0"));
      if (deductAmount > remaining) {
        throw new Error(`จำนวนเงินเกินยอดคงเหลือ (คงเหลือ ${remaining.toFixed(2)})`);
      }

      const [deduction] = await tx.insert(purchaseDepositDeductions).values({
        purchaseDepositId: Number(purchaseDepositId),
        documentType,
        documentId: Number(documentId),
        documentNo: documentNo || null,
        amount: String(deductAmount.toFixed(2)),
      }).returning();

      const newUsed = parseFloat(String(deposit.usedAmount || "0")) + deductAmount;
      const newRemaining = parseFloat(String(deposit.totalAmount)) - newUsed;
      let newStatus = "available";
      if (newRemaining <= 0) {
        newStatus = "used";
      } else if (newUsed > 0) {
        newStatus = "partial";
      }

      await tx.update(purchaseDeposits).set({
        usedAmount: String(newUsed.toFixed(2)),
        remainingAmount: String(Math.max(0, newRemaining).toFixed(2)),
        depositStatus: newStatus,
        updatedAt: new Date(),
      }).where(eq(purchaseDeposits.id, deposit.id));

      return deduction;
    });

    res.status(201).json(result);
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

app.get("/api/purchase-deposit-deductions/by-document", requireAuth, requireModule("purchases"), async (req, res) => {
  try {
    const { documentType, documentId } = req.query;
    if (!documentType || !documentId) return res.status(400).json({ message: "documentType and documentId required" });
    const rows = await db.select().from(purchaseDepositDeductions)
      .where(and(
        eq(purchaseDepositDeductions.documentType, String(documentType)),
        eq(purchaseDepositDeductions.documentId, Number(documentId)),
      ));
    res.json(rows);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.put("/api/purchase-deposit-deductions/replace", requireAuth, requireModule("purchases"), async (req, res) => {
  try {
    const { documentType, documentId, deductions } = req.body;
    if (!documentType || !documentId) return res.status(400).json({ message: "documentType and documentId required" });

    await db.transaction(async (tx) => {
      const existing = await tx.select().from(purchaseDepositDeductions)
        .where(and(
          eq(purchaseDepositDeductions.documentType, String(documentType)),
          eq(purchaseDepositDeductions.documentId, Number(documentId)),
        ));

      for (const old of existing) {
        const [deposit] = await tx.select().from(purchaseDeposits).where(eq(purchaseDeposits.id, old.purchaseDepositId));
        if (deposit) {
          const oldAmount = parseFloat(String(old.amount || "0"));
          const currentUsed = parseFloat(String(deposit.usedAmount || "0"));
          const newUsed = Math.max(0, currentUsed - oldAmount);
          const totalAmt = parseFloat(String(deposit.totalAmount));
          const newRemaining = totalAmt - newUsed;
          await tx.update(purchaseDeposits).set({
            usedAmount: String(newUsed.toFixed(2)),
            remainingAmount: String(Math.max(0, newRemaining).toFixed(2)),
            depositStatus: newUsed <= 0 ? "available" : newRemaining <= 0 ? "used" : "partial",
            updatedAt: new Date(),
          }).where(eq(purchaseDeposits.id, deposit.id));
        }
      }

      await tx.delete(purchaseDepositDeductions).where(and(
        eq(purchaseDepositDeductions.documentType, String(documentType)),
        eq(purchaseDepositDeductions.documentId, Number(documentId)),
      ));

      const validDeds = (deductions || []).filter((d: any) => parseFloat(String(d.amount || "0")) > 0);
      for (const ded of validDeds) {
        const deductAmount = parseFloat(String(ded.amount));
        const [deposit] = await tx.select().from(purchaseDeposits).where(eq(purchaseDeposits.id, Number(ded.purchaseDepositId)));
        if (!deposit) throw new Error("ไม่พบใบจ่ายเงินมัดจำ");

        const remaining = parseFloat(String(deposit.remainingAmount || "0"));
        if (deductAmount > remaining + 0.01) {
          throw new Error(`จำนวนเงินเกินยอดคงเหลือของ ${deposit.depositNo} (คงเหลือ ${remaining.toFixed(2)})`);
        }

        await tx.insert(purchaseDepositDeductions).values({
          purchaseDepositId: Number(ded.purchaseDepositId),
          documentType,
          documentId: Number(documentId),
          documentNo: ded.documentNo || null,
          amount: String(deductAmount.toFixed(2)),
        });

        const currentUsed = parseFloat(String(deposit.usedAmount || "0"));
        const newUsed = currentUsed + deductAmount;
        const totalAmt = parseFloat(String(deposit.totalAmount));
        const newRemaining = totalAmt - newUsed;
        await tx.update(purchaseDeposits).set({
          usedAmount: String(newUsed.toFixed(2)),
          remainingAmount: String(Math.max(0, newRemaining).toFixed(2)),
          depositStatus: newUsed <= 0 ? "available" : newRemaining <= 0 ? "used" : "partial",
          updatedAt: new Date(),
        }).where(eq(purchaseDeposits.id, deposit.id));
      }
    });

    res.json({ success: true });
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

// ========== Sales Credit Notes (ใบลดหนี้ขาย) Routes ==========

app.get("/api/sales-credit-notes/ref-invoice/:invoiceId", requireAuth, requireAnyModule("sales", "ecommerce"), async (req, res) => {
  try {
    const [invoice] = await db.select().from(taxInvoices).where(eq(taxInvoices.id, Number(req.params.invoiceId)));
    if (!invoice) return res.status(404).json({ message: "ไม่พบใบกำกับภาษี" });
    const items = await db.select().from(taxInvoiceItems).where(eq(taxInvoiceItems.taxInvoiceId, invoice.id));
    res.json({ ...invoice, items });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.get("/api/sales-credit-notes", requireAuth, requireAnyModule("sales", "ecommerce"), async (req, res) => {
  try {
    const companyId = Number(req.query.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId required" });
    const rows = await db.select().from(salesCreditNotes).where(eq(salesCreditNotes.companyId, companyId)).orderBy(desc(salesCreditNotes.creditNoteDate), desc(salesCreditNotes.id));
    const userIds = Array.from(new Set(rows.map(r => r.createdBy).concat(rows.map(r => r.updatedBy)).filter(Boolean))) as number[];
    const userMap: Record<number, string> = {};
    if (userIds.length > 0) { const uu = await db.select({ id: users.id, fullName: users.fullName }).from(users).where(inArray(users.id, userIds)); for (const u of uu) userMap[u.id] = u.fullName; }
    const result = rows.map(r => ({
      ...r,
      createdByName: r.createdBy ? userMap[r.createdBy] || "-" : "-",
      updatedByName: r.updatedBy ? userMap[r.updatedBy] || "-" : "-",
    }));
    res.json(result);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.get("/api/sales-credit-notes/:id", requireAuth, requireAnyModule("sales", "ecommerce"), async (req, res) => {
  try {
    const [doc] = await db.select().from(salesCreditNotes).where(eq(salesCreditNotes.id, Number(req.params.id)));
    if (!doc) return res.status(404).json({ message: "ไม่พบใบลดหนี้" });
    { const ac = await checkDocOwnership(doc.companyId, req.user); if (!ac.allowed) return res.status(403).json({ message: ac.message }); }
    const items = await db.select().from(salesCreditNoteItems).where(eq(salesCreditNoteItems.creditNoteId, doc.id));
    let createdByName = "-";
    let updatedByName = "-";
    if (doc.createdBy) { const u = await storage.getUser(doc.createdBy); if (u) createdByName = u.fullName; }
    if (doc.updatedBy) { const u = await storage.getUser(doc.updatedBy); if (u) updatedByName = u.fullName; }
    res.json({ ...doc, items, createdByName, updatedByName });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post("/api/sales-credit-notes", requireAuth, requireAnyModule("sales", "ecommerce"), async (req, res) => {
  try {
    const { items, ...body } = req.body;
    const user = req.user as any;
    const companyId = Number(body.companyId);
    if (!companyId || !body.customerName || !body.creditNoteDate) {
      return res.status(400).json({ message: "กรุณากรอกข้อมูลให้ครบถ้วน (companyId, customerName, creditNoteDate)" });
    }
    if (body.customerId === "" || body.customerId === undefined) body.customerId = null;
    else body.customerId = Number(body.customerId) || null;
    if (body.refTaxInvoiceId === "" || body.refTaxInvoiceId === undefined) body.refTaxInvoiceId = null;
    else body.refTaxInvoiceId = Number(body.refTaxInvoiceId) || null;

    const prefix = body.docPrefix || "CN";
    let creditNoteNo = body.creditNoteNo;
    if (!creditNoteNo) {
      creditNoteNo = await getNextDocNo(companyId, prefix, salesCreditNotes, salesCreditNotes.creditNoteNo, salesCreditNotes.companyId, body.creditNoteDate);
    }

    const result = await db.transaction(async (tx) => {
      const [doc] = await tx.insert(salesCreditNotes).values({
        companyId,
        creditNoteNo,
        creditNoteDate: body.creditNoteDate,
        customerId: body.customerId,
        customerCode: body.customerCode || null,
        customerName: body.customerName,
        customerAddress: body.customerAddress || null,
        customerTaxId: body.customerTaxId || null,
        branch: body.branch || null,
      sellerBranchId: body.sellerBranchId || null,
        contactPerson: body.contactPerson || null,
        contactPhone: body.contactPhone || null,
        contactEmail: body.contactEmail || null,
        refTaxInvoiceId: body.refTaxInvoiceId,
        refTaxInvoiceNo: body.refTaxInvoiceNo || null,
        refTaxInvoiceDate: body.refTaxInvoiceDate || null,
        reason: body.reason || null,
        reasonDetail: body.reasonDetail || null,
        subtotal: body.subtotal || "0",
        discountAmount: body.discountAmount || "0",
        vatAmount: body.vatAmount || "0",
        totalAmount: body.totalAmount || "0",
        status: body.status || "approved",
        priceMode: body.priceMode || "excluded",
        paymentMethod: body.paymentMethod || "เครดิต",
        currencyCode: body.currencyCode || "THB",
        exchangeRate: body.exchangeRate || "1",
        docPrefix: prefix,
        notes: body.notes || null,
        originalInvoiceAmount: body.originalInvoiceAmount ? String(body.originalInvoiceAmount) : null,
        createdBy: user.id,
      }).returning();

      if (items && Array.isArray(items) && items.length > 0) {
        for (const item of items) {
          const rawDiscount = String(item.discount || "0");
          const isPercent = rawDiscount.includes("%");
          const discountNum = parseFloat(rawDiscount.replace("%", "")) || 0;
          await tx.insert(salesCreditNoteItems).values({
            creditNoteId: doc.id,
            productId: item.productId ? Number(item.productId) : null,
            productCode: item.productCode || null,
            productName: item.productName || "",
            description: item.description || null,
            qty: String(item.qty || "1"),
            unit: item.unit || "ชิ้น",
            unitPrice: String(item.unitPrice || "0"),
            discount: String(discountNum),
            discountType: isPercent ? "percent" : "amount",
            total: String(item.total || "0"),
            vatType: item.vatType || "vat7",
          });
        }
      }
      return doc;
    });

    const savedItems = await db.select().from(salesCreditNoteItems).where(eq(salesCreditNoteItems.creditNoteId, result.id));

    const returnToStock = body.returnToStock === true || body.returnToStock === "true";
    const returnWarehouseId = body.returnWarehouseId ? Number(body.returnWarehouseId) : null;
    if (returnToStock && returnWarehouseId) {
      await db.execute(sql`UPDATE sales_credit_notes SET return_to_stock = TRUE, return_warehouse_id = ${returnWarehouseId} WHERE id = ${result.id}`);
      const cnCreateTriggers = await getInventoryTriggers(result.companyId);
      if (cnCreateTriggers.credit_note_return) {
        for (const item of savedItems) {
          if (item.productId && item.qty) {
            await upsertWarehouseStockLevel(result.companyId, item.productId, returnWarehouseId, Number(item.qty));
          }
        }
      }
    } else {
      await db.execute(sql`UPDATE sales_credit_notes SET return_to_stock = FALSE, return_warehouse_id = NULL WHERE id = ${result.id}`);
    }

    let journalResult = null;
    try {
      const cnPmAccCode = await resolvePaymentMethodAccountCode(result.companyId, result.paymentMethod);
      journalResult = await createAutoJournalEntry({
        companyId: result.companyId,
        documentType: "credit_note",
        sourceDocType: "credit_note",
        sourceDocId: result.id,
        docDate: result.creditNoteDate,
        docNo: result.creditNoteNo,
        subtotal: String(result.subtotal),
        vatAmount: String(result.vatAmount),
        totalAmount: String(result.totalAmount),
        currencyCode: result.currencyCode || "THB",
        exchangeRate: String(result.exchangeRate || "1"),
        userId: user.id,
        customerName: result.customerName,
        paymentMethod: result.paymentMethod || "เครดิต",
        paymentMethodAccountCode: cnPmAccCode,
        overrideLines: body?.journalOverrideLines || req?.body?.journalOverrideLines || undefined,
      });
    } catch (e) {}

    res.status(201).json({ ...result, items: savedItems, journalResult });
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

app.patch("/api/sales-credit-notes/:id", requireAuth, requireAnyModule("sales", "ecommerce"), async (req, res) => {
  try {
    const { items, ...body } = req.body;
    const user = req.user as any;
    const [existing] = await db.select().from(salesCreditNotes).where(eq(salesCreditNotes.id, Number(req.params.id)));
    if (!existing) return res.status(404).json({ message: "ไม่พบใบลดหนี้" });
    { const ac = await checkDocOwnership(existing.companyId, req.user); if (!ac.allowed) return res.status(403).json({ message: ac.message }); }

    if (body.customerId === "" || body.customerId === undefined) body.customerId = null;
    else if (body.customerId !== null) body.customerId = Number(body.customerId) || null;
    if (body.refTaxInvoiceId === "" || body.refTaxInvoiceId === undefined) body.refTaxInvoiceId = null;
    else if (body.refTaxInvoiceId !== null) body.refTaxInvoiceId = Number(body.refTaxInvoiceId) || null;

    const statusChanged = body.status && body.status !== existing.status;

    const oldCnRaw = await db.execute(sql`SELECT return_to_stock, return_warehouse_id FROM sales_credit_notes WHERE id = ${existing.id}`);
    const oldCnMeta = (oldCnRaw as any).rows?.[0] || {};
    const oldReturnToStock = oldCnMeta.return_to_stock === true;
    const oldReturnWarehouseId = oldCnMeta.return_warehouse_id ? Number(oldCnMeta.return_warehouse_id) : null;
    const oldItemsForRevert = (items && Array.isArray(items) && oldReturnToStock && oldReturnWarehouseId)
      ? await db.select().from(salesCreditNoteItems).where(eq(salesCreditNoteItems.creditNoteId, existing.id))
      : [];

    const result = await db.transaction(async (tx) => {
      const [updated] = await tx.update(salesCreditNotes).set({
        ...body,
        updatedBy: user.id,
        updatedAt: new Date(),
      }).where(eq(salesCreditNotes.id, existing.id)).returning();

      if (items && Array.isArray(items)) {
        await tx.delete(salesCreditNoteItems).where(eq(salesCreditNoteItems.creditNoteId, existing.id));
        for (const item of items) {
          const rawDiscount = String(item.discount || "0");
          const isPercent = rawDiscount.includes("%");
          const discountNum = parseFloat(rawDiscount.replace("%", "")) || 0;
          await tx.insert(salesCreditNoteItems).values({
            creditNoteId: existing.id,
            productId: item.productId ? Number(item.productId) : null,
            productCode: item.productCode || null,
            productName: item.productName || "",
            description: item.description || null,
            qty: String(item.qty || "1"),
            unit: item.unit || "ชิ้น",
            unitPrice: String(item.unitPrice || "0"),
            discount: String(discountNum),
            discountType: isPercent ? "percent" : "amount",
            total: String(item.total || "0"),
            vatType: item.vatType || "vat7",
          });
        }
      }
      return updated;
    });

    let journalResult = null;
    if (statusChanged && body.status === "approved") {
      try {
        const cnPatchPmAccCode = await resolvePaymentMethodAccountCode(result.companyId, result.paymentMethod);
        journalResult = await createAutoJournalEntry({
          companyId: result.companyId,
          documentType: "credit_note",
          sourceDocType: "credit_note",
          sourceDocId: result.id,
          docDate: result.creditNoteDate,
          docNo: result.creditNoteNo,
          subtotal: String(result.subtotal),
          vatAmount: String(result.vatAmount),
          totalAmount: String(result.totalAmount),
          currencyCode: result.currencyCode || "THB",
          exchangeRate: String(result.exchangeRate || "1"),
          userId: user.id,
          customerName: result.customerName,
          paymentMethod: result.paymentMethod || "เครดิต",
          paymentMethodAccountCode: cnPatchPmAccCode,
          overrideLines: body?.journalOverrideLines || req?.body?.journalOverrideLines || undefined,
        });
      } catch (e) {}
    }

    const savedItems = await db.select().from(salesCreditNoteItems).where(eq(salesCreditNoteItems.creditNoteId, result.id));

    const returnToStock = body.returnToStock === true || body.returnToStock === "true";
    const returnWarehouseId = body.returnWarehouseId ? Number(body.returnWarehouseId) : null;

    const cnPatchTriggers = await getInventoryTriggers(existing.companyId);
    for (const item of oldItemsForRevert) {
      if (item.productId && item.qty && oldReturnWarehouseId && cnPatchTriggers.credit_note_return) {
        await upsertWarehouseStockLevel(existing.companyId, item.productId, oldReturnWarehouseId, -Number(item.qty));
      }
    }

    if (returnToStock && returnWarehouseId) {
      await db.execute(sql`UPDATE sales_credit_notes SET return_to_stock = TRUE, return_warehouse_id = ${returnWarehouseId} WHERE id = ${result.id}`);
      if (cnPatchTriggers.credit_note_return) {
        for (const item of savedItems) {
          if (item.productId && item.qty) {
            await upsertWarehouseStockLevel(result.companyId, item.productId, returnWarehouseId, Number(item.qty));
          }
        }
      }
    } else {
      await db.execute(sql`UPDATE sales_credit_notes SET return_to_stock = FALSE, return_warehouse_id = NULL WHERE id = ${result.id}`);
    }

    res.json({ ...result, items: savedItems, journalResult });
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

app.delete("/api/sales-credit-notes/:id", requireAuth, requireAnyModule("sales", "ecommerce"), async (req, res) => {
  try {
    const [existing] = await db.select().from(salesCreditNotes).where(eq(salesCreditNotes.id, Number(req.params.id)));
    if (!existing) return res.status(404).json({ message: "ไม่พบใบลดหนี้" });
    { const ac = await checkDocOwnership(existing.companyId, req.user); if (!ac.allowed) return res.status(403).json({ message: ac.message }); }
    const cnMetaRaw = await db.execute(sql`SELECT return_to_stock, return_warehouse_id FROM sales_credit_notes WHERE id = ${existing.id}`);
    const cnMeta = (cnMetaRaw as any).rows?.[0] || {};
    const delReturnToStock = cnMeta.return_to_stock === true;
    const delReturnWarehouseId = cnMeta.return_warehouse_id ? Number(cnMeta.return_warehouse_id) : null;
    const cnItemsToRevert = delReturnToStock && delReturnWarehouseId
      ? await db.select().from(salesCreditNoteItems).where(eq(salesCreditNoteItems.creditNoteId, existing.id))
      : [];
    const relatedJournals = await db.select({ id: journalEntries.id }).from(journalEntries)
      .where(and(eq(journalEntries.sourceDocType, "sales_credit_note"), eq(journalEntries.sourceDocId, existing.id)));
    const relatedJournalIds = relatedJournals.map((j) => j.id);
    await db.transaction(async (tx) => {
      if (relatedJournalIds.length > 0) {
        await tx.delete(journalLines).where(inArray(journalLines.journalEntryId, relatedJournalIds));
        await tx.delete(journalEntries).where(inArray(journalEntries.id, relatedJournalIds));
      }
      await tx.delete(salesCreditNoteItems).where(eq(salesCreditNoteItems.creditNoteId, existing.id));
      await tx.delete(salesCreditNotes).where(eq(salesCreditNotes.id, existing.id));
    });
    const cnDelTriggers = await getInventoryTriggers(existing.companyId);
    for (const item of cnItemsToRevert) {
      if (item.productId && item.qty && delReturnWarehouseId && cnDelTriggers.credit_note_return) {
        await upsertWarehouseStockLevel(existing.companyId, item.productId, delReturnWarehouseId, -Number(item.qty));
      }
    }
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post("/api/sales-credit-notes/bulk-delete", requireAuth, requireAnyModule("sales", "ecommerce"), requireRole("admin", "owner", "super_admin"), async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: "กรุณาระบุรายการที่ต้องการลบ" });
    const user = req.user as any;
    let deleted = 0; const errors: string[] = [];
    for (const id of ids) {
      try {
        const [existing] = await db.select().from(salesCreditNotes).where(eq(salesCreditNotes.id, Number(id)));
        if (!existing) { errors.push(`#${id}: ไม่พบ`); continue; }
        const bulkCnMetaRaw = await db.execute(sql`SELECT return_to_stock, return_warehouse_id FROM sales_credit_notes WHERE id = ${existing.id}`);
        const bulkCnMeta = (bulkCnMetaRaw as any).rows?.[0] || {};
        const bulkReturnToStock = bulkCnMeta.return_to_stock === true;
        const bulkReturnWarehouseId = bulkCnMeta.return_warehouse_id ? Number(bulkCnMeta.return_warehouse_id) : null;
        const bulkCnItems = bulkReturnToStock && bulkReturnWarehouseId
          ? await db.select().from(salesCreditNoteItems).where(eq(salesCreditNoteItems.creditNoteId, existing.id))
          : [];
        const bulkRelatedJournals = await db.select({ id: journalEntries.id }).from(journalEntries)
          .where(and(eq(journalEntries.sourceDocType, "sales_credit_note"), eq(journalEntries.sourceDocId, existing.id)));
        const bulkRelatedJournalIds = bulkRelatedJournals.map((j) => j.id);
        await db.transaction(async (tx) => {
          if (bulkRelatedJournalIds.length > 0) {
            await tx.delete(journalLines).where(inArray(journalLines.journalEntryId, bulkRelatedJournalIds));
            await tx.delete(journalEntries).where(inArray(journalEntries.id, bulkRelatedJournalIds));
          }
          await tx.delete(salesCreditNoteItems).where(eq(salesCreditNoteItems.creditNoteId, existing.id));
          await tx.delete(salesCreditNotes).where(eq(salesCreditNotes.id, existing.id));
        });
        const bulkCnDelTriggers = await getInventoryTriggers(existing.companyId);
        for (const item of bulkCnItems) {
          if (item.productId && item.qty && bulkReturnWarehouseId && bulkCnDelTriggers.credit_note_return) {
            await upsertWarehouseStockLevel(existing.companyId, item.productId, bulkReturnWarehouseId, -Number(item.qty));
          }
        }
        logActivity({ companyId: existing.companyId, userId: user.id, userName: user.username, action: "delete", entityType: "sales_credit_note", entityId: String(existing.id), entityName: existing.creditNoteNo }).catch(() => {});
        deleted++;
      } catch (e: any) { errors.push(`#${id}: ${e.message}`); }
    }
    res.json({ deleted, errors, total: ids.length });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ========== Purchase Debit Notes (ใบลดหนี้ซื้อ) Routes ==========

app.get("/api/purchase-debit-notes/ref-purchase/:purchaseId", requireAuth, requireModule("purchases"), async (req, res) => {
  try {
    const [invoice] = await db.select().from(purchaseInvoices).where(eq(purchaseInvoices.id, Number(req.params.purchaseId)));
    if (!invoice) return res.status(404).json({ message: "ไม่พบใบซื้อ" });
    const items = await db.select().from(purchaseInvoiceItems).where(eq(purchaseInvoiceItems.purchaseInvoiceId, invoice.id));
    res.json({ ...invoice, items });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.get("/api/purchase-debit-notes", requireAuth, requireModule("purchases"), async (req, res) => {
  try {
    const companyId = Number(req.query.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId required" });
    const rows = await db.select().from(purchaseDebitNotes).where(eq(purchaseDebitNotes.companyId, companyId)).orderBy(desc(purchaseDebitNotes.debitNoteDate), desc(purchaseDebitNotes.id));
    const userIds = Array.from(new Set(rows.map(r => r.createdBy).concat(rows.map(r => r.updatedBy)).filter(Boolean))) as number[];
    const userMap: Record<number, string> = {};
    for (const uid of userIds) {
      const u = await storage.getUser(uid);
      if (u) userMap[uid] = u.username;
    }
    const result = rows.map(r => ({
      ...r,
      createdByName: r.createdBy ? userMap[r.createdBy] || "-" : "-",
      updatedByName: r.updatedBy ? userMap[r.updatedBy] || "-" : "-",
    }));
    res.json(result);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.get("/api/purchase-debit-notes/:id", requireAuth, requireModule("purchases"), async (req, res) => {
  try {
    const [doc] = await db.select().from(purchaseDebitNotes).where(eq(purchaseDebitNotes.id, Number(req.params.id)));
    if (!doc) return res.status(404).json({ message: "ไม่พบใบลดหนี้ซื้อ" });
    { const ac = await checkDocOwnership(doc.companyId, req.user); if (!ac.allowed) return res.status(403).json({ message: ac.message }); }
    const items = await db.select().from(purchaseDebitNoteItems).where(eq(purchaseDebitNoteItems.debitNoteId, doc.id));
    let createdByName = "-";
    let updatedByName = "-";
    if (doc.createdBy) { const u = await storage.getUser(doc.createdBy); if (u) createdByName = u.fullName; }
    if (doc.updatedBy) { const u = await storage.getUser(doc.updatedBy); if (u) updatedByName = u.fullName; }
    res.json({ ...doc, items, createdByName, updatedByName });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post("/api/purchase-debit-notes", requireAuth, requireModule("purchases"), async (req, res) => {
  try {
    const { items, ...body } = req.body;
    const user = req.user as any;
    const companyId = Number(body.companyId);
    if (!companyId || !body.vendorName || !body.debitNoteDate) {
      return res.status(400).json({ message: "กรุณากรอกข้อมูลให้ครบถ้วน (companyId, vendorName, debitNoteDate)" });
    }
    if (body.vendorId === "" || body.vendorId === undefined) body.vendorId = null;
    else body.vendorId = Number(body.vendorId) || null;
    if (body.refPurchaseInvoiceId === "" || body.refPurchaseInvoiceId === undefined) body.refPurchaseInvoiceId = null;
    else body.refPurchaseInvoiceId = Number(body.refPurchaseInvoiceId) || null;

    const prefix = body.docPrefix || "DN";
    let debitNoteNo = body.debitNoteNo;
    if (!debitNoteNo) {
      debitNoteNo = await getNextDocNo(companyId, prefix, purchaseDebitNotes, purchaseDebitNotes.debitNoteNo, purchaseDebitNotes.companyId, body.debitNoteDate);
    }

    const result = await db.transaction(async (tx) => {
      const [doc] = await tx.insert(purchaseDebitNotes).values({
        companyId,
        debitNoteNo,
        debitNoteDate: body.debitNoteDate,
        vendorId: body.vendorId,
        vendorCode: body.vendorCode || null,
        vendorName: body.vendorName,
        vendorAddress: body.vendorAddress || null,
        vendorTaxId: body.vendorTaxId || null,
        branch: body.branch || null,
      sellerBranchId: body.sellerBranchId || null,
        contactPhone: body.contactPhone || null,
        contactEmail: body.contactEmail || null,
        refPurchaseInvoiceId: body.refPurchaseInvoiceId,
        refPurchaseInvoiceNo: body.refPurchaseInvoiceNo || null,
        refPurchaseInvoiceDate: body.refPurchaseInvoiceDate || null,
        reason: body.reason || null,
        reasonDetail: body.reasonDetail || null,
        subtotal: body.subtotal || "0",
        discountAmount: body.discountAmount || "0",
        vatAmount: body.vatAmount || "0",
        totalAmount: body.totalAmount || "0",
        status: body.status || "approved",
        priceMode: body.priceMode || "excluded",
        paymentMethod: body.paymentMethod || "เครดิต",
        currencyCode: body.currencyCode || "THB",
        exchangeRate: body.exchangeRate || "1",
        docPrefix: prefix,
        notes: body.notes || null,
        createdBy: user.id,
      }).returning();

      if (items && Array.isArray(items) && items.length > 0) {
        for (const item of items) {
          const rawDiscount = String(item.discount || "0");
          const isPercent = rawDiscount.includes("%");
          const discountNum = parseFloat(rawDiscount.replace("%", "")) || 0;
          await tx.insert(purchaseDebitNoteItems).values({
            debitNoteId: doc.id,
            productId: item.productId ? Number(item.productId) : null,
            productCode: item.productCode || null,
            productName: item.productName || "",
            description: item.description || null,
            qty: String(item.qty || "1"),
            unit: item.unit || "ชิ้น",
            unitPrice: String(item.unitPrice || "0"),
            discount: String(discountNum),
            discountType: isPercent ? "percent" : "amount",
            total: String(item.total || "0"),
            vatType: item.vatType || "vat7",
          });
        }
      }
      return doc;
    });

    const savedItems = await db.select().from(purchaseDebitNoteItems).where(eq(purchaseDebitNoteItems.debitNoteId, result.id));

    let journalResult = null;
    try {
      journalResult = await createAutoJournalEntry({
        companyId: result.companyId,
        documentType: "debit_note",
        sourceDocType: "debit_note",
        sourceDocId: result.id,
        docDate: result.debitNoteDate,
        docNo: result.debitNoteNo,
        subtotal: String(result.subtotal),
        vatAmount: String(result.vatAmount),
        totalAmount: String(result.totalAmount),
        currencyCode: result.currencyCode || "THB",
        exchangeRate: String(result.exchangeRate || "1"),
        userId: user.id,
        customerName: result.vendorName,
        paymentMethod: result.paymentMethod || "เครดิต",
        overrideLines: body?.journalOverrideLines || req?.body?.journalOverrideLines || undefined,
      });
    } catch (e) {}

    res.status(201).json({ ...result, items: savedItems, journalResult });
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

app.patch("/api/purchase-debit-notes/:id", requireAuth, requireModule("purchases"), async (req, res) => {
  try {
    const { items, ...body } = req.body;
    const user = req.user as any;
    const [existing] = await db.select().from(purchaseDebitNotes).where(eq(purchaseDebitNotes.id, Number(req.params.id)));
    if (!existing) return res.status(404).json({ message: "ไม่พบใบลดหนี้ซื้อ" });
    { const ac = await checkDocOwnership(existing.companyId, req.user); if (!ac.allowed) return res.status(403).json({ message: ac.message }); }

    if (body.vendorId === "" || body.vendorId === undefined) body.vendorId = null;
    else if (body.vendorId !== null) body.vendorId = Number(body.vendorId) || null;
    if (body.refPurchaseInvoiceId === "" || body.refPurchaseInvoiceId === undefined) body.refPurchaseInvoiceId = null;
    else if (body.refPurchaseInvoiceId !== null) body.refPurchaseInvoiceId = Number(body.refPurchaseInvoiceId) || null;

    const statusChanged = body.status && body.status !== existing.status;

    const result = await db.transaction(async (tx) => {
      const [updated] = await tx.update(purchaseDebitNotes).set({
        ...body,
        updatedBy: user.id,
        updatedAt: new Date(),
      }).where(eq(purchaseDebitNotes.id, existing.id)).returning();

      if (items && Array.isArray(items)) {
        await tx.delete(purchaseDebitNoteItems).where(eq(purchaseDebitNoteItems.debitNoteId, existing.id));
        for (const item of items) {
          const rawDiscount = String(item.discount || "0");
          const isPercent = rawDiscount.includes("%");
          const discountNum = parseFloat(rawDiscount.replace("%", "")) || 0;
          await tx.insert(purchaseDebitNoteItems).values({
            debitNoteId: existing.id,
            productId: item.productId ? Number(item.productId) : null,
            productCode: item.productCode || null,
            productName: item.productName || "",
            description: item.description || null,
            qty: String(item.qty || "1"),
            unit: item.unit || "ชิ้น",
            unitPrice: String(item.unitPrice || "0"),
            discount: String(discountNum),
            discountType: isPercent ? "percent" : "amount",
            total: String(item.total || "0"),
            vatType: item.vatType || "vat7",
          });
        }
      }
      return updated;
    });

    let journalResult = null;
    if (statusChanged && body.status === "approved") {
      try {
        journalResult = await createAutoJournalEntry({
          companyId: result.companyId,
          documentType: "debit_note",
          sourceDocType: "debit_note",
          sourceDocId: result.id,
          docDate: result.debitNoteDate,
          docNo: result.debitNoteNo,
          subtotal: String(result.subtotal),
          vatAmount: String(result.vatAmount),
          totalAmount: String(result.totalAmount),
          currencyCode: result.currencyCode || "THB",
          exchangeRate: String(result.exchangeRate || "1"),
          userId: user.id,
          customerName: result.vendorName,
          paymentMethod: result.paymentMethod || "เครดิต",
          overrideLines: body?.journalOverrideLines || req?.body?.journalOverrideLines || undefined,
        });
      } catch (e) {}
    }

    const savedItems = await db.select().from(purchaseDebitNoteItems).where(eq(purchaseDebitNoteItems.debitNoteId, result.id));
    res.json({ ...result, items: savedItems, journalResult });
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

app.delete("/api/purchase-debit-notes/:id", requireAuth, requireModule("purchases"), async (req, res) => {
  try {
    const [existing] = await db.select().from(purchaseDebitNotes).where(eq(purchaseDebitNotes.id, Number(req.params.id)));
    if (!existing) return res.status(404).json({ message: "ไม่พบใบลดหนี้ซื้อ" });
    { const ac = await checkDocOwnership(existing.companyId, req.user); if (!ac.allowed) return res.status(403).json({ message: ac.message }); }
    if (existing.status !== "draft") return res.status(400).json({ message: "ลบได้เฉพาะใบลดหนี้ซื้อสถานะแบบร่างเท่านั้น" });
    await db.transaction(async (tx) => {
      await tx.delete(purchaseDebitNoteItems).where(eq(purchaseDebitNoteItems.debitNoteId, existing.id));
      await tx.delete(purchaseDebitNotes).where(eq(purchaseDebitNotes.id, existing.id));
    });
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post("/api/purchase-debit-notes/bulk-delete", requireAuth, requireModule("purchases"), requireRole("admin", "owner", "super_admin"), async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: "กรุณาระบุรายการที่ต้องการลบ" });
    const user = req.user as any;
    let deleted = 0; const errors: string[] = [];
    for (const id of ids) {
      try {
        const [existing] = await db.select().from(purchaseDebitNotes).where(eq(purchaseDebitNotes.id, Number(id)));
        if (!existing) { errors.push(`#${id}: ไม่พบ`); continue; }
        await db.transaction(async (tx) => {
          await tx.delete(purchaseDebitNoteItems).where(eq(purchaseDebitNoteItems.debitNoteId, existing.id));
          await tx.delete(purchaseDebitNotes).where(eq(purchaseDebitNotes.id, existing.id));
        });
        logActivity({ companyId: existing.companyId, userId: user.id, userName: user.username, action: "delete", entityType: "purchase_debit_note", entityId: String(existing.id), entityName: existing.debitNoteNo }).catch(() => {});
        deleted++;
      } catch (e: any) { errors.push(`#${id}: ${e.message}`); }
    }
    res.json({ deleted, errors, total: ids.length });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ========== Credit Note Share Routes ==========

app.post("/api/sales-credit-notes/:id/share", requireAuth, requireAnyModule("sales"), async (req, res) => {
  try {
    const [doc] = await db.select().from(salesCreditNotes).where(eq(salesCreditNotes.id, Number(req.params.id)));
    if (!doc) return res.status(404).json({ message: "ไม่พบใบลดหนี้" });
    const ac = await checkDocOwnership(doc.companyId, req.user);
    if (!ac.allowed) return res.status(403).json({ message: ac.message });
    let token = doc.shareToken;
    if (!token) {
      const { randomBytes } = await import("crypto");
      token = randomBytes(24).toString("hex");
      await db.update(salesCreditNotes).set({ shareToken: token }).where(eq(salesCreditNotes.id, doc.id));
    }
    res.json({ shareToken: token });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.get("/api/share/credit-note/:token", async (req, res) => {
  try {
    const [doc] = await db.select().from(salesCreditNotes).where(eq(salesCreditNotes.shareToken, req.params.token));
    if (!doc) return res.status(404).json({ message: "ไม่พบเอกสาร" });
    const items = await db.select().from(salesCreditNoteItems).where(eq(salesCreditNoteItems.creditNoteId, doc.id));
    const [company] = await db.select().from(companies).where(eq(companies.id, doc.companyId));
    let docSetting = null;
    let userSignature = null;
    try { const [ds] = await db.select().from(documentSettings).where(eq(documentSettings.companyId, doc.companyId)); docSetting = ds || null; } catch {}
    if (doc.createdBy) {
      try { const u = await storage.getUser(doc.createdBy); if (u) userSignature = { signatureUrl: u.signatureUrl || null, signatureName: u.signatureName || u.fullName, signatureTitle: u.signatureTitle || null }; } catch {}
    }
    const { shareToken, createdBy, updatedBy, ...publicDoc } = doc;
    res.json({ ...publicDoc, items, company: company || null, documentSettings: docSetting, userSignature });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

}
