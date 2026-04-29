import type { Express, Request, Response } from "express";
import { db } from "../db";
import { eq, and , sql } from "drizzle-orm";
import { companies, pettyCashFunds, accounts, journalEntries, journalLines, pettyCashTransactions, expenses, invoices, taxInvoices, purchaseInvoices } from "@shared/schema";
import { requireAuth, requireModule } from "../route-middleware";
import { getNextJournalEntryNo } from "../route-helpers";

export function registerPettyCashRoutes(app: Express) {
// ==================== PETTY CASH ====================

async function verifyCompanyAccess(user: any, companyId: number): Promise<boolean> {
  if (!companyId) return false;
  if (user.role === "super_admin") return true;
  if (!user.tenantId) return false;
  const [company] = await db.select().from(companies).where(and(eq(companies.id, companyId), eq(companies.tenantId, user.tenantId)));
  return !!company;
}

app.get("/api/petty-cash/funds", requireAuth, requireModule("petty-cash"), async (req, res) => {
  try {
    const user = req.user as any;
    const companyId = Number(req.query.companyId);
    if (!companyId) return res.status(400).json({ message: "กรุณาเลือกบริษัท" });
    if (!(await verifyCompanyAccess(user, companyId))) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึงบริษัทนี้" });
    const funds = await db.select().from(pettyCashFunds)
      .where(eq(pettyCashFunds.companyId, companyId))
      .orderBy(pettyCashFunds.createdAt);
    res.json(funds);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/petty-cash/funds", requireAuth, requireModule("petty-cash"), async (req, res) => {
  try {
    const user = req.user as any;
    const { companyId, name, fundDate, fundLimit, custodianName, cashAccountCode, pettyCashAccountCode, notes } = req.body;
    if (!companyId || !name) return res.status(400).json({ message: "กรุณากรอกข้อมูลให้ครบ" });
    if (!(await verifyCompanyAccess(user, Number(companyId)))) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึงบริษัทนี้" });

    const fundLimitNum = Number(fundLimit || 0);
    const entryDate = fundDate || new Date().toISOString().split("T")[0];

    const result = await db.transaction(async (tx) => {
      const [fund] = await tx.insert(pettyCashFunds).values({
        companyId: Number(companyId),
        name,
        fundLimit: String(fundLimitNum),
        currentBalance: String(fundLimitNum),
        custodianName: custodianName || null,
        custodianId: user.id,
        cashAccountCode: cashAccountCode || null,
        pettyCashAccountCode: pettyCashAccountCode || null,
        status: "active",
        notes: notes || null,
        createdBy: user.id,
      }).returning();

      if (fundLimitNum > 0 && pettyCashAccountCode && cashAccountCode) {
        const allAccounts = await tx.select().from(accounts).where(eq(accounts.companyId, Number(companyId)));
        const accountMap = new Map(allAccounts.map(a => [a.code, a]));
        const pcAcc = accountMap.get(pettyCashAccountCode);
        const cashAcc = accountMap.get(cashAccountCode);

        if (pcAcc && cashAcc) {
          const entryNo = await getNextJournalEntryNo(Number(companyId), "general", entryDate);
          const [entry] = await tx.insert(journalEntries).values({
            companyId: Number(companyId),
            entryNo,
            entryDate,
            reference: `PCFUND${fund.id}`,
            description: `ตั้งวงเงินสดย่อย - ${name}`,
            journalBook: "general",
            createdBy: user.id,
            status: "posted",
            sourceDocType: "petty_cash_fund",
            sourceDocId: fund.id,
          }).returning();

          await tx.insert(journalLines).values([
            { journalEntryId: entry.id, accountId: pcAcc.id, description: `ตั้งวงเงินสดย่อย - ${name}`, debit: String(fundLimitNum), credit: "0" },
            { journalEntryId: entry.id, accountId: cashAcc.id, description: `ตั้งวงเงินสดย่อย - ${name}`, debit: "0", credit: String(fundLimitNum) },
          ]);

          await tx.update(pettyCashFunds).set({ journalEntryId: entry.id }).where(eq(pettyCashFunds.id, fund.id));
          return { ...fund, journalEntryId: entry.id };
        }
      }
      return fund;
    });

    res.status(201).json(result);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.put("/api/petty-cash/funds/:id", requireAuth, requireModule("petty-cash"), async (req, res) => {
  try {
    const user = req.user as any;
    const id = Number(req.params.id);
    const [existingFund] = await db.select().from(pettyCashFunds).where(eq(pettyCashFunds.id, id));
    if (!existingFund) return res.status(404).json({ message: "ไม่พบวงเงิน" });
    if (!(await verifyCompanyAccess(user, existingFund.companyId))) return res.status(403).json({ message: "ไม่มีสิทธิ์" });

    const { name, fundLimit, custodianName, cashAccountCode, pettyCashAccountCode, notes, status } = req.body;

    const result = await db.transaction(async (tx) => {
      const [updated] = await tx.update(pettyCashFunds)
        .set({
          ...(name !== undefined && { name }),
          ...(fundLimit !== undefined && { fundLimit: String(fundLimit) }),
          ...(custodianName !== undefined && { custodianName }),
          ...(cashAccountCode !== undefined && { cashAccountCode }),
          ...(pettyCashAccountCode !== undefined && { pettyCashAccountCode }),
          ...(notes !== undefined && { notes }),
          ...(status !== undefined && { status }),
        })
        .where(eq(pettyCashFunds.id, id))
        .returning();

      const finalPcCode = pettyCashAccountCode !== undefined ? pettyCashAccountCode : existingFund.pettyCashAccountCode;
      const finalCashCode = cashAccountCode !== undefined ? cashAccountCode : existingFund.cashAccountCode;
      const finalLimit = fundLimit !== undefined ? Number(fundLimit) : Number(existingFund.fundLimit || 0);
      const fundName = name || existingFund.name;

      if (finalPcCode && finalCashCode && finalLimit > 0) {
        const allAccounts = await tx.select().from(accounts).where(eq(accounts.companyId, existingFund.companyId));
        const accountMap = new Map(allAccounts.map(a => [a.code, a]));
        const pcAcc = accountMap.get(finalPcCode);
        const cashAcc = accountMap.get(finalCashCode);

        if (pcAcc && cashAcc) {
          if (existingFund.journalEntryId) {
            await tx.delete(journalLines).where(eq(journalLines.journalEntryId, existingFund.journalEntryId));
            await tx.update(journalEntries).set({
              description: `ตั้งวงเงินสดย่อย - ${fundName}`,
            }).where(eq(journalEntries.id, existingFund.journalEntryId));
            await tx.insert(journalLines).values([
              { journalEntryId: existingFund.journalEntryId, accountId: pcAcc.id, description: `ตั้งวงเงินสดย่อย - ${fundName}`, debit: String(finalLimit), credit: "0" },
              { journalEntryId: existingFund.journalEntryId, accountId: cashAcc.id, description: `ตั้งวงเงินสดย่อย - ${fundName}`, debit: "0", credit: String(finalLimit) },
            ]);
            return updated;
          } else {
            const entryNo = await getNextJournalEntryNo(existingFund.companyId, "general", new Date().toISOString().split("T")[0]);
            const [entry] = await tx.insert(journalEntries).values({
              companyId: existingFund.companyId,
              entryNo,
              entryDate: new Date().toISOString().split("T")[0],
              reference: `PCFUND${id}`,
              description: `ตั้งวงเงินสดย่อย - ${fundName}`,
              journalBook: "general",
              createdBy: user.id,
              status: "posted",
              sourceDocType: "petty_cash_fund",
              sourceDocId: id,
            }).returning();

            await tx.insert(journalLines).values([
              { journalEntryId: entry.id, accountId: pcAcc.id, description: `ตั้งวงเงินสดย่อย - ${fundName}`, debit: String(finalLimit), credit: "0" },
              { journalEntryId: entry.id, accountId: cashAcc.id, description: `ตั้งวงเงินสดย่อย - ${fundName}`, debit: "0", credit: String(finalLimit) },
            ]);

            await tx.update(pettyCashFunds).set({ journalEntryId: entry.id }).where(eq(pettyCashFunds.id, id));
            return { ...updated, journalEntryId: entry.id };
          }
        }
      }

      return updated;
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/petty-cash/transactions", requireAuth, requireModule("petty-cash"), async (req, res) => {
  try {
    const user = req.user as any;
    const fundId = Number(req.query.fundId);
    if (!fundId) return res.status(400).json({ message: "กรุณาเลือกวงเงิน" });
    const [fund] = await db.select().from(pettyCashFunds).where(eq(pettyCashFunds.id, fundId));
    if (!fund) return res.status(404).json({ message: "ไม่พบวงเงิน" });
    if (!(await verifyCompanyAccess(user, fund.companyId))) return res.status(403).json({ message: "ไม่มีสิทธิ์" });
    const conditions: any[] = [eq(pettyCashTransactions.fundId, fundId)];
    const dateFrom = req.query.dateFrom as string;
    const dateTo = req.query.dateTo as string;
    if (dateFrom) conditions.push(sql`${pettyCashTransactions.txnDate} >= ${dateFrom}`);
    if (dateTo) conditions.push(sql`${pettyCashTransactions.txnDate} <= ${dateTo}`);

    const txns = await db.select().from(pettyCashTransactions)
      .where(and(...conditions))
      .orderBy(sql`${pettyCashTransactions.txnDate} DESC, ${pettyCashTransactions.id} DESC`);
    res.json(txns);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/petty-cash/transactions", requireAuth, requireModule("petty-cash"), async (req, res) => {
  try {
    const user = req.user as any;
    const { fundId, companyId, txnDate, txnType, description, amount, receiptNo, expenseAccountCode, expenseAccountName, vendorName, notes, attachmentUrl } = req.body;
    if (!fundId || !txnDate || !txnType || !description || !amount) {
      return res.status(400).json({ message: "กรุณากรอกข้อมูลให้ครบ" });
    }
    if (!["expense", "replenish"].includes(txnType)) return res.status(400).json({ message: "ประเภทรายการไม่ถูกต้อง" });

    const [fund] = await db.select().from(pettyCashFunds).where(eq(pettyCashFunds.id, Number(fundId)));
    if (!fund) return res.status(404).json({ message: "ไม่พบวงเงิน" });
    if (!(await verifyCompanyAccess(user, fund.companyId))) return res.status(403).json({ message: "ไม่มีสิทธิ์" });

    const amtNum = Number(amount);
    if (isNaN(amtNum) || amtNum <= 0) return res.status(400).json({ message: "จำนวนเงินไม่ถูกต้อง" });
    const currentBal = Number(fund.currentBalance);

    if (txnType === "expense" && amtNum > currentBal) {
      return res.status(400).json({ message: `ยอดเงินคงเหลือไม่เพียงพอ (คงเหลือ ${currentBal.toFixed(2)} บาท)` });
    }

    const balanceChange = txnType === "replenish" ? amtNum : -amtNum;

    const result = await db.transaction(async (tx) => {
      const [txn] = await tx.insert(pettyCashTransactions).values({
        fundId: Number(fundId),
        companyId: fund.companyId,
        txnDate,
        txnType,
        description,
        amount: String(amtNum),
        receiptNo: receiptNo || null,
        expenseAccountCode: expenseAccountCode || null,
        expenseAccountName: expenseAccountName || null,
        vendorName: vendorName || null,
        status: "approved",
        notes: notes || null,
        attachmentUrl: attachmentUrl || null,
        createdBy: user.id,
      }).returning();

      const [updatedFund] = await tx.update(pettyCashFunds)
        .set({ currentBalance: sql`current_balance + ${balanceChange}` })
        .where(eq(pettyCashFunds.id, Number(fundId)))
        .returning();

      const pcAccCode = fund.pettyCashAccountCode;
      const cashAccCode = fund.cashAccountCode;
      if (pcAccCode) {
        const allAccounts = await tx.select().from(accounts).where(eq(accounts.companyId, fund.companyId));
        const accountMap = new Map(allAccounts.map(a => [a.code, a]));
        const pcAcc = accountMap.get(pcAccCode);

        if (txnType === "expense" && expenseAccountCode) {
          const expAcc = accountMap.get(expenseAccountCode);
          if (pcAcc && expAcc) {
            const journalDesc = `เบิกเงินสดย่อย - ${description}`;
            const entryNo = await getNextJournalEntryNo(fund.companyId, "payment", txnDate);
            const [entry] = await tx.insert(journalEntries).values({
              companyId: fund.companyId,
              entryNo,
              entryDate: txnDate,
              reference: `PCEXP${txn.id}`,
              description: journalDesc,
              journalBook: "payment",
              contactName: vendorName || null,
              createdBy: user.id,
              status: "posted",
              sourceDocType: "petty_cash_txn",
              sourceDocId: txn.id,
            }).returning();

            await tx.insert(journalLines).values([
              { journalEntryId: entry.id, accountId: expAcc.id, description: journalDesc, debit: String(amtNum), credit: "0" },
              { journalEntryId: entry.id, accountId: pcAcc.id, description: journalDesc, debit: "0", credit: String(amtNum) },
            ]);

            await tx.update(pettyCashTransactions).set({ journalEntryId: entry.id }).where(eq(pettyCashTransactions.id, txn.id));
          }
        } else if (txnType === "replenish" && cashAccCode) {
          const cashAcc = accountMap.get(cashAccCode);
          if (pcAcc && cashAcc) {
            const journalDesc = `เติมเงินสดย่อย - ${description}`;
            const entryNo = await getNextJournalEntryNo(fund.companyId, "general", txnDate);
            const [entry] = await tx.insert(journalEntries).values({
              companyId: fund.companyId,
              entryNo,
              entryDate: txnDate,
              reference: `PCREP${txn.id}`,
              description: journalDesc,
              journalBook: "general",
              createdBy: user.id,
              status: "posted",
              sourceDocType: "petty_cash_txn",
              sourceDocId: txn.id,
            }).returning();

            await tx.insert(journalLines).values([
              { journalEntryId: entry.id, accountId: pcAcc.id, description: journalDesc, debit: String(amtNum), credit: "0" },
              { journalEntryId: entry.id, accountId: cashAcc.id, description: journalDesc, debit: "0", credit: String(amtNum) },
            ]);

            await tx.update(pettyCashTransactions).set({ journalEntryId: entry.id }).where(eq(pettyCashTransactions.id, txn.id));
          }
        }
      }

      return { txn, newBalance: updatedFund.currentBalance };
    });

    res.status(201).json({ ...result.txn, newBalance: result.newBalance });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.put("/api/petty-cash/transactions/:id", requireAuth, requireModule("petty-cash"), async (req, res) => {
  try {
    const user = req.user as any;
    const id = Number(req.params.id);
    const [txn] = await db.select().from(pettyCashTransactions).where(eq(pettyCashTransactions.id, id));
    if (!txn) return res.status(404).json({ message: "ไม่พบรายการ" });

    const [fund] = await db.select().from(pettyCashFunds).where(eq(pettyCashFunds.id, txn.fundId));
    if (!fund) return res.status(404).json({ message: "ไม่พบวงเงิน" });
    if (!(await verifyCompanyAccess(user, fund.companyId))) return res.status(403).json({ message: "ไม่มีสิทธิ์" });

    const { txnDate, description, amount, receiptNo, vendorName, expenseAccountCode, expenseAccountName, notes, attachmentUrl } = req.body;

    const oldAmount = Number(txn.amount);
    const newAmount = amount != null ? Number(amount) : oldAmount;
    const amountDiff = newAmount - oldAmount;

    await db.transaction(async (tx) => {
      const updateData: any = {};
      if (txnDate != null) updateData.txnDate = txnDate;
      if (description != null) updateData.description = description;
      if (amount != null) updateData.amount = String(newAmount);
      if (receiptNo !== undefined) updateData.receiptNo = receiptNo || null;
      if (vendorName !== undefined) updateData.vendorName = vendorName || null;
      if (expenseAccountCode !== undefined) updateData.expenseAccountCode = expenseAccountCode || null;
      if (expenseAccountName !== undefined) updateData.expenseAccountName = expenseAccountName || null;
      if (notes !== undefined) updateData.notes = notes || null;
      if (attachmentUrl !== undefined) updateData.attachmentUrl = attachmentUrl || null;

      await tx.update(pettyCashTransactions).set(updateData).where(eq(pettyCashTransactions.id, id));

      if (amountDiff !== 0) {
        const balanceChange = txn.txnType === "expense" ? -amountDiff : amountDiff;
        await tx.update(pettyCashFunds)
          .set({ currentBalance: sql`current_balance + ${balanceChange}` })
          .where(eq(pettyCashFunds.id, txn.fundId));
      }

      const finalTxnDate = txnDate ?? txn.txnDate;
      const finalDesc = description ?? txn.description;
      const finalAmount = String(newAmount);
      const finalExpAccCode = expenseAccountCode !== undefined ? (expenseAccountCode || null) : txn.expenseAccountCode;
      const finalVendor = vendorName !== undefined ? (vendorName || null) : txn.vendorName;
      const pcAccCode = fund.pettyCashAccountCode;
      const cashAccCode = fund.cashAccountCode;

      if (pcAccCode) {
        const allAccounts = await tx.select().from(accounts).where(eq(accounts.companyId, fund.companyId));
        const accountMap = new Map(allAccounts.map(a => [a.code, a]));
        const pcAcc = accountMap.get(pcAccCode);

        if (txn.journalEntryId) {
          if (txn.txnType === "expense" && finalExpAccCode) {
            const expAcc = accountMap.get(finalExpAccCode);
            if (pcAcc && expAcc) {
              const journalDesc = `เบิกเงินสดย่อย - ${finalDesc}`;
              await tx.update(journalEntries).set({
                entryDate: finalTxnDate,
                description: journalDesc,
                contactName: finalVendor,
              }).where(eq(journalEntries.id, txn.journalEntryId));
              await tx.delete(journalLines).where(eq(journalLines.journalEntryId, txn.journalEntryId));
              await tx.insert(journalLines).values([
                { journalEntryId: txn.journalEntryId, accountId: expAcc.id, description: journalDesc, debit: finalAmount, credit: "0" },
                { journalEntryId: txn.journalEntryId, accountId: pcAcc.id, description: journalDesc, debit: "0", credit: finalAmount },
              ]);
            }
          } else if (txn.txnType === "replenish" && cashAccCode) {
            const cashAcc = accountMap.get(cashAccCode);
            if (pcAcc && cashAcc) {
              const journalDesc = `เติมเงินสดย่อย - ${finalDesc}`;
              await tx.update(journalEntries).set({
                entryDate: finalTxnDate,
                description: journalDesc,
              }).where(eq(journalEntries.id, txn.journalEntryId));
              await tx.delete(journalLines).where(eq(journalLines.journalEntryId, txn.journalEntryId));
              await tx.insert(journalLines).values([
                { journalEntryId: txn.journalEntryId, accountId: pcAcc.id, description: journalDesc, debit: finalAmount, credit: "0" },
                { journalEntryId: txn.journalEntryId, accountId: cashAcc.id, description: journalDesc, debit: "0", credit: finalAmount },
              ]);
            }
          }
        } else {
          if (txn.txnType === "expense" && finalExpAccCode) {
            const expAcc = accountMap.get(finalExpAccCode);
            if (pcAcc && expAcc) {
              const journalDesc = `เบิกเงินสดย่อย - ${finalDesc}`;
              const entryNo = await getNextJournalEntryNo(fund.companyId, "payment", finalTxnDate);
              const [entry] = await tx.insert(journalEntries).values({
                companyId: fund.companyId,
                entryNo,
                entryDate: finalTxnDate,
                reference: `PCEXP${txn.id}`,
                description: journalDesc,
                journalBook: "payment",
                contactName: finalVendor,
                createdBy: user.id,
                status: "posted",
                sourceDocType: "petty_cash_txn",
                sourceDocId: txn.id,
              }).returning();
              await tx.insert(journalLines).values([
                { journalEntryId: entry.id, accountId: expAcc.id, description: journalDesc, debit: finalAmount, credit: "0" },
                { journalEntryId: entry.id, accountId: pcAcc.id, description: journalDesc, debit: "0", credit: finalAmount },
              ]);
              await tx.update(pettyCashTransactions).set({ journalEntryId: entry.id }).where(eq(pettyCashTransactions.id, id));
            }
          } else if (txn.txnType === "replenish" && cashAccCode) {
            const cashAcc = accountMap.get(cashAccCode);
            if (pcAcc && cashAcc) {
              const journalDesc = `เติมเงินสดย่อย - ${finalDesc}`;
              const entryNo = await getNextJournalEntryNo(fund.companyId, "general", finalTxnDate);
              const [entry] = await tx.insert(journalEntries).values({
                companyId: fund.companyId,
                entryNo,
                entryDate: finalTxnDate,
                reference: `PCREP${txn.id}`,
                description: journalDesc,
                journalBook: "general",
                createdBy: user.id,
                status: "posted",
                sourceDocType: "petty_cash_txn",
                sourceDocId: txn.id,
              }).returning();
              await tx.insert(journalLines).values([
                { journalEntryId: entry.id, accountId: pcAcc.id, description: journalDesc, debit: finalAmount, credit: "0" },
                { journalEntryId: entry.id, accountId: cashAcc.id, description: journalDesc, debit: "0", credit: finalAmount },
              ]);
              await tx.update(pettyCashTransactions).set({ journalEntryId: entry.id }).where(eq(pettyCashTransactions.id, id));
            }
          }
        }
      }
    });

    const [updated] = await db.select().from(pettyCashTransactions).where(eq(pettyCashTransactions.id, id));
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.delete("/api/petty-cash/transactions/:id", requireAuth, requireModule("petty-cash"), async (req, res) => {
  try {
    const user = req.user as any;
    const id = Number(req.params.id);
    const [txn] = await db.select().from(pettyCashTransactions).where(eq(pettyCashTransactions.id, id));
    if (!txn) return res.status(404).json({ message: "ไม่พบรายการ" });

    const [fund] = await db.select().from(pettyCashFunds).where(eq(pettyCashFunds.id, txn.fundId));
    if (!fund) return res.status(404).json({ message: "ไม่พบวงเงิน" });
    if (!(await verifyCompanyAccess(user, fund.companyId))) return res.status(403).json({ message: "ไม่มีสิทธิ์" });

    const amtNum = Number(txn.amount);
    const reverseChange = txn.txnType === "replenish" ? -amtNum : amtNum;

    await db.transaction(async (tx) => {
      const savedJournalId = txn.journalEntryId;
      if (savedJournalId) {
        await tx.update(pettyCashTransactions)
          .set({ journalEntryId: null })
          .where(eq(pettyCashTransactions.id, id));
      }
      await tx.delete(pettyCashTransactions).where(eq(pettyCashTransactions.id, id));
      if (savedJournalId) {
        await tx.delete(journalLines).where(eq(journalLines.journalEntryId, savedJournalId));
        await tx.delete(journalEntries).where(eq(journalEntries.id, savedJournalId));
      }
      await tx.update(pettyCashFunds)
        .set({ currentBalance: sql`current_balance + ${reverseChange}` })
        .where(eq(pettyCashFunds.id, txn.fundId));
    });

    res.json({ message: "ลบรายการสำเร็จ" });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.delete("/api/petty-cash/funds/:id", requireAuth, requireModule("petty-cash"), async (req, res) => {
  try {
    const user = req.user as any;
    const id = Number(req.params.id);
    const [fund] = await db.select().from(pettyCashFunds).where(eq(pettyCashFunds.id, id));
    if (!fund) return res.status(404).json({ message: "ไม่พบวงเงิน" });
    if (!(await verifyCompanyAccess(user, fund.companyId))) return res.status(403).json({ message: "ไม่มีสิทธิ์" });

    await db.transaction(async (tx) => {
      const txns = await tx.select().from(pettyCashTransactions).where(eq(pettyCashTransactions.fundId, id));
      const txnJournalIds = txns.map(t => t.journalEntryId).filter(Boolean) as number[];

      await tx.update(pettyCashTransactions)
        .set({ journalEntryId: null })
        .where(eq(pettyCashTransactions.fundId, id));

      await tx.update(pettyCashFunds)
        .set({ journalEntryId: null })
        .where(eq(pettyCashFunds.id, id));

      await tx.delete(pettyCashTransactions).where(eq(pettyCashTransactions.fundId, id));
      await tx.delete(pettyCashFunds).where(eq(pettyCashFunds.id, id));

      const allJournalIds = [...txnJournalIds];
      if (fund.journalEntryId) allJournalIds.push(fund.journalEntryId);

      if (allJournalIds.length > 0) {
        for (const jid of allJournalIds) {
          await tx.execute(sql`UPDATE ecommerce_orders SET journal_entry_id = NULL WHERE journal_entry_id = ${jid}`);
          await tx.execute(sql`UPDATE ecommerce_settlements SET settle_journal_id = NULL WHERE settle_journal_id = ${jid}`);
          await tx.execute(sql`UPDATE ecommerce_settlements SET withdraw_journal_id = NULL WHERE withdraw_journal_id = ${jid}`);
          await tx.execute(sql`UPDATE ecommerce_settlements SET reversal_journal_id = NULL WHERE reversal_journal_id = ${jid}`);
          await tx.execute(sql`UPDATE live_cf_orders SET journal_entry_id = NULL WHERE journal_entry_id = ${jid}`);
          await tx.execute(sql`UPDATE bank_statements SET matched_journal_id = NULL WHERE matched_journal_id = ${jid}`);
          await tx.execute(sql`UPDATE payroll_records SET journal_entry_id = NULL WHERE journal_entry_id = ${jid}`);
          await tx.execute(sql`UPDATE closed_periods SET journal_entry_id = NULL WHERE journal_entry_id = ${jid}`);
          await tx.execute(sql`UPDATE expenses SET journal_entry_id = NULL WHERE journal_entry_id = ${jid}`);
          await tx.execute(sql`UPDATE purchase_invoices SET journal_entry_id = NULL WHERE journal_entry_id = ${jid}`);
          await tx.delete(journalLines).where(eq(journalLines.journalEntryId, jid));
          await tx.delete(journalEntries).where(eq(journalEntries.id, jid));
        }
      }
    });

    invalidateReportCache(fund.companyId);
    res.json({ message: "ลบวงเงินสำเร็จ" });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Finance: Due Date Calendar (ปฏิทินครบกำหนดชำระ)
app.get("/api/finance/due-calendar", requireAuth, async (req, res) => {
  try {
    const companyId = Number(req.query.companyId);
    const month = Number(req.query.month);
    const year = Number(req.query.year);
    if (!companyId || !month || !year) return res.status(400).json({ message: "companyId, month, year required" });

    const user = req.user as any;
    if (!(await verifyCompanyAccess(user, companyId))) return res.status(403).json({ message: "ไม่มีสิทธิ์" });

    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    const arInvoices = await db.select({
      id: invoices.id,
      docNo: invoices.invoiceNo,
      docDate: invoices.invoiceDate,
      dueDate: invoices.dueDate,
      contactName: invoices.customerName,
      totalAmount: invoices.totalAmount,
      paymentStatus: invoices.paymentStatus,
      status: invoices.status,
    }).from(invoices).where(and(
      eq(invoices.companyId, companyId),
      sql`${invoices.dueDate} IS NOT NULL`,
      sql`${invoices.dueDate} >= ${startDate}`,
      sql`${invoices.dueDate} <= ${endDate}`,
      sql`${invoices.status} NOT IN ('cancelled', 'cancel', 'paid')`,
      sql`invoice_no NOT LIKE 'RE%'`,
    ));

    const arTaxInvoices = await db.select({
      id: taxInvoices.id,
      docNo: taxInvoices.taxInvoiceNo,
      docDate: taxInvoices.taxInvoiceDate,
      dueDate: taxInvoices.dueDate,
      contactName: taxInvoices.customerName,
      totalAmount: taxInvoices.totalAmount,
      paymentStatus: taxInvoices.paymentStatus,
      status: taxInvoices.status,
    }).from(taxInvoices).where(and(
      eq(taxInvoices.companyId, companyId),
      sql`${taxInvoices.dueDate} IS NOT NULL`,
      sql`${taxInvoices.dueDate} >= ${startDate}`,
      sql`${taxInvoices.dueDate} <= ${endDate}`,
      sql`${taxInvoices.status} NOT IN ('cancelled', 'cancel', 'paid')`,
      sql`tax_invoice_no NOT LIKE 'RE%'`,
    ));

    const apInvoices = await db.select({
      id: purchaseInvoices.id,
      docNo: purchaseInvoices.apNo,
      docDate: purchaseInvoices.apDate,
      dueDate: purchaseInvoices.dueDate,
      contactName: purchaseInvoices.vendorName,
      totalAmount: purchaseInvoices.totalAmount,
      paymentStatus: purchaseInvoices.paymentStatus,
      status: purchaseInvoices.status,
    }).from(purchaseInvoices).where(and(
      eq(purchaseInvoices.companyId, companyId),
      sql`${purchaseInvoices.dueDate} IS NOT NULL`,
      sql`${purchaseInvoices.dueDate} >= ${startDate}`,
      sql`${purchaseInvoices.dueDate} <= ${endDate}`,
      sql`${purchaseInvoices.status} NOT IN ('cancelled', 'cancel')`,
    ));

    const apExpenses = await db.select({
      id: expenses.id,
      docNo: expenses.expNo,
      docDate: expenses.expDate,
      dueDate: expenses.dueDate,
      contactName: expenses.vendorName,
      totalAmount: expenses.totalAmount,
      paymentStatus: expenses.paymentStatus,
      status: expenses.status,
    }).from(expenses).where(and(
      eq(expenses.companyId, companyId),
      sql`${expenses.dueDate} IS NOT NULL`,
      sql`${expenses.dueDate} >= ${startDate}`,
      sql`${expenses.dueDate} <= ${endDate}`,
      sql`${expenses.status} NOT IN ('cancelled', 'cancel')`,
    ));

    const items: any[] = [];
    for (const r of arInvoices) {
      items.push({ ...r, type: "AR", docType: "IV", totalAmount: parseFloat(r.totalAmount || "0") });
    }
    for (const r of arTaxInvoices) {
      items.push({ ...r, type: "AR", docType: "TIV", totalAmount: parseFloat(r.totalAmount || "0") });
    }
    for (const r of apInvoices) {
      items.push({ ...r, type: "AP", docType: "AP", totalAmount: parseFloat(r.totalAmount || "0") });
    }
    for (const r of apExpenses) {
      items.push({ ...r, type: "AP", docType: "EXP", totalAmount: parseFloat(r.totalAmount || "0") });
    }

    res.json({ items });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

}
