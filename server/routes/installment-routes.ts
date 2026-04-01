import type { Express } from "express";
import { db } from "../db";
import { eq, and, desc, sql } from "drizzle-orm";
import { assetInstallmentContracts, assetInstallmentSchedules, fixedAssets, accounts, journalEntries, journalLines } from "@shared/schema";
import { requireAuth } from "../route-middleware";
import { getNextJournalEntryNo } from "../route-helpers";

function getUserCompanyIds(req: any): number[] {
  const user = req.user as any;
  if (!user) return [];
  if (user.role === "super_admin") return [];
  return user.companyAccess || (user.companyId ? [user.companyId] : []);
}

function canAccessCompany(req: any, companyId: number): boolean {
  const user = req.user as any;
  if (!user) return false;
  if (user.role === "super_admin") return true;
  const allowed = user.companyAccess || (user.companyId ? [user.companyId] : []);
  return allowed.includes(companyId);
}

export function registerInstallmentRoutes(app: Express) {

  app.get("/api/asset-installments", requireAuth, async (req, res) => {
    try {
      const companyId = Number(req.query.companyId);
      if (!companyId) return res.status(400).json({ message: "companyId required" });
      if (!canAccessCompany(req, companyId)) return res.status(403).json({ message: "Access denied" });
      const contracts = await db.select().from(assetInstallmentContracts)
        .where(eq(assetInstallmentContracts.companyId, companyId))
        .orderBy(desc(assetInstallmentContracts.createdAt));
      res.json(contracts);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/asset-installments/:id", requireAuth, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const [contract] = await db.select().from(assetInstallmentContracts)
        .where(eq(assetInstallmentContracts.id, id));
      if (!contract) return res.status(404).json({ message: "Contract not found" });
      if (!canAccessCompany(req, contract.companyId)) return res.status(403).json({ message: "Access denied" });
      const schedules = await db.select().from(assetInstallmentSchedules)
        .where(eq(assetInstallmentSchedules.contractId, id))
        .orderBy(assetInstallmentSchedules.installmentNo);
      res.json({ ...contract, schedules });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/asset-installments", requireAuth, async (req, res) => {
    try {
      const data = req.body;
      const companyId = Number(data.companyId);
      if (!companyId) return res.status(400).json({ message: "companyId required" });
      if (!canAccessCompany(req, companyId)) return res.status(403).json({ message: "Access denied" });
      if (!data.contractNo) return res.status(400).json({ message: "contractNo required" });
      if (!data.startDate) return res.status(400).json({ message: "startDate required" });

      const contractType = data.contractType || "hire_purchase";
      const vehicleType = data.vehicleType || "other";
      const vatReclaimable = vehicleType !== "passenger_car";

      const totalPriceInclVat = parseFloat(data.totalPrice || "0");
      const vatRate = parseFloat(data.vatRate || "7");
      const downPayment = parseFloat(data.downPayment || "0");
      const totalInstallments = parseInt(data.totalInstallments || "0");
      const interestRate = parseFloat(data.interestRate || "0");

      if (totalPriceInclVat <= 0) return res.status(400).json({ message: "totalPrice must be > 0" });
      if (totalInstallments <= 0) return res.status(400).json({ message: "totalInstallments must be > 0" });

      const vatOnPurchase = totalPriceInclVat * vatRate / (100 + vatRate);
      const priceExclVat = totalPriceInclVat - vatOnPurchase;

      let assetCost: number;
      let financeAmount: number;

      if (contractType === "hire_purchase") {
        if (vatReclaimable) {
          assetCost = priceExclVat;
          financeAmount = totalPriceInclVat - downPayment;
        } else {
          assetCost = totalPriceInclVat;
          financeAmount = totalPriceInclVat - downPayment;
        }
      } else {
        assetCost = priceExclVat;
        financeAmount = totalPriceInclVat - downPayment;
      }

      const totalInterest = financeAmount * (interestRate / 100) * (totalInstallments / 12);
      const principalPerMonth = financeAmount / totalInstallments;
      const interestPerMonth = totalInterest / totalInstallments;

      let monthlyBase = principalPerMonth + interestPerMonth;
      let monthlyPayment: number;
      if (contractType === "leasing") {
        monthlyPayment = monthlyBase * (1 + vatRate / 100);
      } else {
        monthlyPayment = monthlyBase;
      }

      const startDate = data.startDate;
      const startDt = new Date(startDate);
      const endDt = new Date(startDt);
      endDt.setMonth(endDt.getMonth() + totalInstallments);
      const endDate = endDt.toISOString().split("T")[0];

      const defaultAssetCode = contractType === "leasing" ? "1708000" : "1706000";
      const defaultLiabCode = contractType === "leasing" ? "2103500" : "2103400";
      const assetAccountCode = data.assetAccountCode || defaultAssetCode;
      const paymentAccountCode = data.paymentAccountCode || "1001000";
      const liabilityAccountCode = data.liabilityAccountCode || defaultLiabCode;
      const interestAccountCode = data.interestAccountCode || "5901000";

      const allAccounts = await db.select().from(accounts).where(eq(accounts.companyId, companyId));
      const accountMap = new Map(allAccounts.map(a => [a.code, a]));

      const assetAcc = accountMap.get(assetAccountCode);
      const payAcc = accountMap.get(paymentAccountCode);
      const liabAcc = accountMap.get(liabilityAccountCode);

      if (!assetAcc) return res.status(400).json({ message: `บัญชีทรัพย์สิน ${assetAccountCode} ไม่พบ` });
      if (!liabAcc) return res.status(400).json({ message: `บัญชีเจ้าหนี้ ${liabilityAccountCode} ไม่พบ` });
      if (downPayment > 0 && !payAcc) return res.status(400).json({ message: `บัญชีจ่ายเงิน ${paymentAccountCode} ไม่พบ` });

      if (data.assetId) {
        const [asset] = await db.select().from(fixedAssets)
          .where(and(eq(fixedAssets.id, Number(data.assetId)), eq(fixedAssets.companyId, companyId)));
        if (!asset) return res.status(400).json({ message: "ทรัพย์สินไม่พบหรือไม่ใช่ของบริษัทนี้" });
      }

      const result = await db.transaction(async (tx) => {
        const entryNo = await getNextJournalEntryNo(companyId, "general", startDate);
        const descText = contractType === "hire_purchase"
          ? `บันทึกเช่าซื้อ สัญญา ${data.contractNo}`
          : `บันทึกสัญญาลิสซิ่ง ${data.contractNo}`;

        const [entry] = await tx.insert(journalEntries).values({
          companyId,
          entryNo,
          entryDate: startDate,
          reference: data.contractNo,
          description: descText,
          journalBook: "general",
          createdBy: (req.user as any)?.id || null,
          status: "posted",
          sourceDocType: "installment_contract",
        }).returning();

        const lines: any[] = [];

        if (contractType === "hire_purchase") {
          if (vatReclaimable) {
            lines.push({
              journalEntryId: entry.id, accountId: assetAcc.id,
              description: `ทรัพย์สิน - ${data.contractNo}`,
              debit: priceExclVat.toFixed(2), credit: "0",
            });
            const inputVatAcc = accountMap.get("1432000") || accountMap.get("1301000");
            if (inputVatAcc && vatOnPurchase > 0) {
              lines.push({
                journalEntryId: entry.id, accountId: inputVatAcc.id,
                description: `ภาษีซื้อ - ${data.contractNo}`,
                debit: vatOnPurchase.toFixed(2), credit: "0",
              });
            }
          } else {
            lines.push({
              journalEntryId: entry.id, accountId: assetAcc.id,
              description: `ทรัพย์สิน(รวมVAT) - ${data.contractNo}`,
              debit: totalPriceInclVat.toFixed(2), credit: "0",
            });
          }

          if (downPayment > 0 && payAcc) {
            lines.push({
              journalEntryId: entry.id, accountId: payAcc.id,
              description: `เงินดาวน์ - ${data.contractNo}`,
              debit: "0", credit: downPayment.toFixed(2),
            });
          }

          lines.push({
            journalEntryId: entry.id, accountId: liabAcc.id,
            description: `เจ้าหนี้เช่าซื้อ - ${data.contractNo}`,
            debit: "0", credit: financeAmount.toFixed(2),
          });
        } else {
          lines.push({
            journalEntryId: entry.id, accountId: assetAcc.id,
            description: `สินทรัพย์ตามสัญญาเช่า - ${data.contractNo}`,
            debit: priceExclVat.toFixed(2), credit: "0",
          });

          if (downPayment > 0 && payAcc) {
            lines.push({
              journalEntryId: entry.id, accountId: payAcc.id,
              description: `ค่าเช่าล่วงหน้า - ${data.contractNo}`,
              debit: "0", credit: downPayment.toFixed(2),
            });
          }

          lines.push({
            journalEntryId: entry.id, accountId: liabAcc.id,
            description: `หนี้สินตามสัญญาเช่า - ${data.contractNo}`,
            debit: "0", credit: financeAmount.toFixed(2),
          });
        }

        let totalDebit = 0, totalCredit = 0;
        for (const l of lines) {
          totalDebit += parseFloat(l.debit);
          totalCredit += parseFloat(l.credit);
        }
        const diff = Math.abs(totalDebit - totalCredit);
        if (diff > 0.02) {
          throw new Error(`บันทึกรายวันไม่สมดุล: เดบิต ${totalDebit.toFixed(2)} เครดิต ${totalCredit.toFixed(2)}`);
        }

        for (const l of lines) {
          await tx.insert(journalLines).values(l);
        }

        const [contract] = await tx.insert(assetInstallmentContracts).values({
          companyId,
          assetId: data.assetId ? Number(data.assetId) : null,
          contractNo: data.contractNo,
          contractType,
          vehicleType,
          financeCompany: data.financeCompany || null,
          totalPrice: totalPriceInclVat.toFixed(2),
          vatAmount: vatOnPurchase.toFixed(2),
          downPayment: downPayment.toFixed(2),
          financeAmount: financeAmount.toFixed(2),
          interestRate: interestRate.toFixed(4),
          totalInstallments,
          monthlyPayment: monthlyPayment.toFixed(2),
          vatRate: vatRate.toFixed(2),
          vatReclaimable,
          startDate,
          endDate,
          status: "active",
          paidInstallments: 0,
          remainingBalance: financeAmount.toFixed(2),
          paymentAccountCode,
          liabilityAccountCode,
          interestAccountCode,
          assetAccountCode,
          purchaseJournalId: entry.id,
          notes: data.notes || null,
          createdBy: (req.user as any)?.id || null,
        }).returning();

        for (let i = 1; i <= totalInstallments; i++) {
          const dueDt = new Date(startDt);
          dueDt.setMonth(dueDt.getMonth() + i);
          const dueDate = dueDt.toISOString().split("T")[0];

          const isLast = i === totalInstallments;
          let principal = isLast
            ? financeAmount - principalPerMonth * (totalInstallments - 1)
            : principalPerMonth;
          let interest = isLast
            ? totalInterest - interestPerMonth * (totalInstallments - 1)
            : interestPerMonth;

          let vatOnInstallment = 0;
          if (contractType === "leasing") {
            vatOnInstallment = (principal + interest) * vatRate / 100;
          }

          const totalAmt = principal + interest + vatOnInstallment;

          await tx.insert(assetInstallmentSchedules).values({
            contractId: contract.id,
            installmentNo: i,
            dueDate,
            principal: principal.toFixed(2),
            interest: interest.toFixed(2),
            vatAmount: vatOnInstallment.toFixed(2),
            totalAmount: totalAmt.toFixed(2),
            status: "pending",
          });
        }

        return contract;
      });

      const schedules = await db.select().from(assetInstallmentSchedules)
        .where(eq(assetInstallmentSchedules.contractId, result.id))
        .orderBy(assetInstallmentSchedules.installmentNo);

      res.json({ ...result, schedules });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  async function payInstallment(
    tx: any,
    contract: any,
    schedule: any,
    paidDate: string,
    accountMap: Map<string, any>,
    userId: number | null,
  ) {
    const companyId = contract.companyId;
    const principal = parseFloat(schedule.principal);
    const interest = parseFloat(schedule.interest);
    const vatAmount = parseFloat(schedule.vatAmount || "0");
    const totalAmount = parseFloat(schedule.totalAmount);

    const entryNo = await getNextJournalEntryNo(companyId, "payment", paidDate);
    const descText = `จ่ายค่างวด #${schedule.installmentNo} สัญญา ${contract.contractNo}`;

    const [entry] = await tx.insert(journalEntries).values({
      companyId,
      entryNo,
      entryDate: paidDate,
      reference: contract.contractNo,
      description: descText,
      journalBook: "payment",
      createdBy: userId,
      status: "posted",
      sourceDocType: "installment_payment",
      sourceDocId: schedule.id,
    }).returning();

    const liabilityAccountCode = contract.liabilityAccountCode || "2103400";
    const interestAccountCode = contract.interestAccountCode || "5901000";
    const paymentAccountCode = contract.paymentAccountCode || "1001000";

    const liabAcc = accountMap.get(liabilityAccountCode);
    const intAcc = accountMap.get(interestAccountCode);
    const payAcc = accountMap.get(paymentAccountCode);

    if (!liabAcc) throw new Error(`บัญชีเจ้าหนี้ ${liabilityAccountCode} ไม่พบ`);
    if (!payAcc) throw new Error(`บัญชีจ่ายเงิน ${paymentAccountCode} ไม่พบ`);

    const lines: any[] = [];

    if (principal > 0) {
      lines.push({
        journalEntryId: entry.id, accountId: liabAcc.id,
        description: contract.contractType === "hire_purchase"
          ? `เจ้าหนี้เช่าซื้อ - งวด ${schedule.installmentNo}`
          : `หนี้สินตามสัญญาเช่า - งวด ${schedule.installmentNo}`,
        debit: principal.toFixed(2), credit: "0",
      });
    }

    if (interest > 0 && intAcc) {
      lines.push({
        journalEntryId: entry.id, accountId: intAcc.id,
        description: `ดอกเบี้ยจ่าย - งวด ${schedule.installmentNo}`,
        debit: interest.toFixed(2), credit: "0",
      });
    }

    if (contract.contractType === "leasing" && vatAmount > 0) {
      if (contract.vatReclaimable) {
        const inputVatAcc = accountMap.get("1432000") || accountMap.get("1301000");
        if (inputVatAcc) {
          lines.push({
            journalEntryId: entry.id, accountId: inputVatAcc.id,
            description: `ภาษีซื้อ - งวด ${schedule.installmentNo}`,
            debit: vatAmount.toFixed(2), credit: "0",
          });
        }
      } else {
        const nonReclaimVatAcc = accountMap.get("5911100") || accountMap.get("5902000");
        if (nonReclaimVatAcc) {
          lines.push({
            journalEntryId: entry.id, accountId: nonReclaimVatAcc.id,
            description: `ภาษีซื้อไม่ขอคืน - งวด ${schedule.installmentNo}`,
            debit: vatAmount.toFixed(2), credit: "0",
          });
        }
      }
    }

    lines.push({
      journalEntryId: entry.id, accountId: payAcc.id,
      description: `จ่ายค่างวด - งวด ${schedule.installmentNo}`,
      debit: "0", credit: totalAmount.toFixed(2),
    });

    let totalDebit = 0, totalCredit = 0;
    for (const l of lines) {
      totalDebit += parseFloat(l.debit);
      totalCredit += parseFloat(l.credit);
    }
    if (Math.abs(totalDebit - totalCredit) > 0.02) {
      throw new Error(`บันทึกรายวันไม่สมดุล: เดบิต ${totalDebit.toFixed(2)} เครดิต ${totalCredit.toFixed(2)}`);
    }

    for (const l of lines) {
      await tx.insert(journalLines).values(l);
    }

    await tx.update(assetInstallmentSchedules).set({
      status: "paid",
      paidDate,
      journalEntryId: entry.id,
    }).where(eq(assetInstallmentSchedules.id, schedule.id));

    return { scheduleId: schedule.id, installmentNo: schedule.installmentNo, journalEntryId: entry.id, principal };
  }

  app.post("/api/asset-installments/:id/pay/:scheduleId", requireAuth, async (req, res) => {
    try {
      const contractId = Number(req.params.id);
      const scheduleId = Number(req.params.scheduleId);

      const [contract] = await db.select().from(assetInstallmentContracts)
        .where(eq(assetInstallmentContracts.id, contractId));
      if (!contract) return res.status(404).json({ message: "Contract not found" });
      if (!canAccessCompany(req, contract.companyId)) return res.status(403).json({ message: "Access denied" });

      const [schedule] = await db.select().from(assetInstallmentSchedules)
        .where(and(
          eq(assetInstallmentSchedules.id, scheduleId),
          eq(assetInstallmentSchedules.contractId, contractId),
        ));
      if (!schedule) return res.status(404).json({ message: "Schedule not found" });
      if (schedule.status === "paid") return res.status(400).json({ message: "งวดนี้จ่ายแล้ว" });

      const companyId = contract.companyId;
      const allAccounts = await db.select().from(accounts).where(eq(accounts.companyId, companyId));
      const accountMap = new Map(allAccounts.map(a => [a.code, a]));

      const paidDate = req.body.paidDate || new Date().toISOString().split("T")[0];
      const userId = (req.user as any)?.id || null;

      const result = await db.transaction(async (tx) => {
        const payResult = await payInstallment(tx, contract, schedule, paidDate, accountMap, userId);

        const paidCount = (contract.paidInstallments || 0) + 1;
        const principal = parseFloat(schedule.principal);
        const remainBal = parseFloat(contract.remainingBalance || contract.financeAmount) - principal;
        const newStatus = paidCount >= contract.totalInstallments ? "completed" : "active";

        await tx.update(assetInstallmentContracts).set({
          paidInstallments: paidCount,
          remainingBalance: Math.max(0, remainBal).toFixed(2),
          status: newStatus,
        }).where(eq(assetInstallmentContracts.id, contractId));

        return { ...payResult, paidCount, newStatus };
      });

      res.json({ success: true, ...result });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/asset-installments/:id/pay-batch", requireAuth, async (req, res) => {
    try {
      const contractId = Number(req.params.id);
      const [contract] = await db.select().from(assetInstallmentContracts)
        .where(eq(assetInstallmentContracts.id, contractId));
      if (!contract) return res.status(404).json({ message: "Contract not found" });
      if (!canAccessCompany(req, contract.companyId)) return res.status(403).json({ message: "Access denied" });

      const scheduleIds: number[] = req.body.scheduleIds || [];
      const paidDate = req.body.paidDate || new Date().toISOString().split("T")[0];
      const userId = (req.user as any)?.id || null;

      let pendingSchedules;
      if (scheduleIds.length > 0) {
        pendingSchedules = await db.select().from(assetInstallmentSchedules)
          .where(and(
            eq(assetInstallmentSchedules.contractId, contractId),
            eq(assetInstallmentSchedules.status, "pending"),
          ))
          .orderBy(assetInstallmentSchedules.installmentNo);
        pendingSchedules = pendingSchedules.filter(s => scheduleIds.includes(s.id));
      } else {
        const today = new Date().toISOString().split("T")[0];
        pendingSchedules = await db.select().from(assetInstallmentSchedules)
          .where(and(
            eq(assetInstallmentSchedules.contractId, contractId),
            eq(assetInstallmentSchedules.status, "pending"),
            sql`${assetInstallmentSchedules.dueDate} <= ${today}`,
          ))
          .orderBy(assetInstallmentSchedules.installmentNo);
      }

      if (pendingSchedules.length === 0) {
        return res.status(400).json({ message: "ไม่มีงวดที่ต้องจ่าย" });
      }

      const companyId = contract.companyId;
      const allAccounts = await db.select().from(accounts).where(eq(accounts.companyId, companyId));
      const accountMap = new Map(allAccounts.map(a => [a.code, a]));

      const results: any[] = [];
      let totalPrincipalPaid = 0;

      for (const schedule of pendingSchedules) {
        const payResult = await db.transaction(async (tx) => {
          return payInstallment(tx, contract, schedule, paidDate, accountMap, userId);
        });
        results.push(payResult);
        totalPrincipalPaid += payResult.principal;
      }

      const paidCount = (contract.paidInstallments || 0) + results.length;
      const remainBal = parseFloat(contract.remainingBalance || contract.financeAmount) - totalPrincipalPaid;
      const newStatus = paidCount >= contract.totalInstallments ? "completed" : "active";

      await db.update(assetInstallmentContracts).set({
        paidInstallments: paidCount,
        remainingBalance: Math.max(0, remainBal).toFixed(2),
        status: newStatus,
      }).where(eq(assetInstallmentContracts.id, contractId));

      res.json({ success: true, paidCount: results.length, results, newStatus });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.delete("/api/asset-installments/:id", requireAuth, async (req, res) => {
    try {
      const contractId = Number(req.params.id);
      const [contract] = await db.select().from(assetInstallmentContracts)
        .where(eq(assetInstallmentContracts.id, contractId));
      if (!contract) return res.status(404).json({ message: "Contract not found" });
      if (!canAccessCompany(req, contract.companyId)) return res.status(403).json({ message: "Access denied" });

      const paidSchedules = await db.select().from(assetInstallmentSchedules)
        .where(and(
          eq(assetInstallmentSchedules.contractId, contractId),
          eq(assetInstallmentSchedules.status, "paid"),
        ));
      if (paidSchedules.length > 0) {
        return res.status(400).json({ message: "ไม่สามารถลบสัญญาที่มีงวดจ่ายแล้วได้" });
      }

      await db.transaction(async (tx) => {
        await tx.delete(assetInstallmentSchedules)
          .where(eq(assetInstallmentSchedules.contractId, contractId));

        if (contract.purchaseJournalId) {
          await tx.delete(journalLines)
            .where(eq(journalLines.journalEntryId, contract.purchaseJournalId));
          await tx.delete(journalEntries)
            .where(eq(journalEntries.id, contract.purchaseJournalId));
        }

        await tx.delete(assetInstallmentContracts)
          .where(eq(assetInstallmentContracts.id, contractId));
      });

      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });
}
