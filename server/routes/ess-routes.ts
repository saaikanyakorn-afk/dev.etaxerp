import type { Express, Request, Response } from "express";
import { db } from "../db";
import { storage } from "../storage";
import { eq, and, inArray , sql } from "drizzle-orm";
import { leaveBalances, contracts, otRecords } from "@shared/schema";
import { requireAuth, checkDocOwnership } from "../route-middleware";
import { getNextDocNo } from "../route-helpers";
import crypto from "crypto";
import { z } from "zod";

export function registerEssRoutes(app: Express) {
// ========== ESS (Employee Self-Service) Routes ==========

app.get("/api/ess/profile", requireAuth, async (req, res) => {
  const user = req.user as any;
  const employee = await storage.getEmployeeByUserId(user.id);
  if (!employee) return res.status(404).json({ message: "ไม่พบข้อมูลพนักงานของคุณ" });
  const empCompany = employee.companyId ? await storage.getCompany(employee.companyId) : null;
  res.json({ employee, company: empCompany });
});

app.get("/api/ess/leaves", requireAuth, async (req, res) => {
  const user = req.user as any;
  const employee = await storage.getEmployeeByUserId(user.id);
  if (!employee) return res.status(404).json({ message: "ไม่พบข้อมูลพนักงาน" });
  const records = await storage.getLeavesByEmployee(employee.id);
  res.json(records);
});

app.get("/api/ess/leave-balance-summary", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const employee = await storage.getEmployeeByUserId(user.id);
    if (!employee) return res.status(404).json({ message: "ไม่พบข้อมูลพนักงาน" });
    const year = Number(req.query.year) || new Date().getFullYear();
    const empCompanyId = employee.companyId || 0;
    const policies = await storage.getLeavePolicies(empCompanyId);
    const usedLeaves = await db.select({
      leaveType: leaveRequests.leaveType,
      totalDays: sql<number>`COALESCE(SUM(${leaveRequests.days}::numeric), 0)`,
    }).from(leaveRequests).where(and(
      eq(leaveRequests.employeeId, employee.id),
      inArray(leaveRequests.status, ["approved", "pending"]),
      sql`EXTRACT(YEAR FROM ${leaveRequests.startDate}::date) = ${year}`,
    )).groupBy(leaveRequests.leaveType);
    const balances = await storage.getLeaveBalances(employee.id, year);
    const FALLBACK_QUOTA: Record<string, number> = { sick: 30, vacation: 6, personal: 3 };
    const today = new Date();
    const policyList = policies.length > 0 ? policies : [
      { leaveType: "sick", annualQuota: 30, carryOverEnabled: false, maxCarryOverDays: 0, carryOverExpiryMonth: 3, carryOverExpiryDay: 31 },
      { leaveType: "vacation", annualQuota: 6, carryOverEnabled: false, maxCarryOverDays: 0, carryOverExpiryMonth: 3, carryOverExpiryDay: 31 },
      { leaveType: "personal", annualQuota: 3, carryOverEnabled: false, maxCarryOverDays: 0, carryOverExpiryMonth: 3, carryOverExpiryDay: 31 },
    ];
    const summary = policyList.map((p: any) => {
      const used = usedLeaves.find(u => u.leaveType === p.leaveType);
      const usedDays = used ? Number(used.totalDays) : 0;
      const balance = balances.find((b: any) => b.leaveType === p.leaveType);
      const quota = policies.length > 0 ? Number(p.annualQuota) : (FALLBACK_QUOTA[p.leaveType] || 0);
      const carriedOver = balance ? Number(balance.carriedOver) : 0;
      const expired = balance ? Number(balance.expired) : 0;
      let carryOverExpired = false;
      const actualExpiryDate = balance?.carryOverExpiryDate || null;
      if (carriedOver > 0 && actualExpiryDate) {
        carryOverExpired = today > new Date(actualExpiryDate);
      }
      const effectiveCarriedOver = carryOverExpired ? 0 : carriedOver;
      const totalAvailable = quota + effectiveCarriedOver - expired;
      const remaining = Math.max(0, totalAvailable - usedDays);
      return {
        leaveType: p.leaveType, quota, carriedOver, effectiveCarriedOver,
        used: usedDays, expired, remaining, carryOverExpired,
        carryOverExpiryDate: actualExpiryDate,
      };
    });
    res.json(summary);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post("/api/ess/leaves", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const employee = await storage.getEmployeeByUserId(user.id);
    if (!employee) return res.status(404).json({ message: "ไม่พบข้อมูลพนักงาน" });
    const parsed = insertLeaveSchema.parse({ ...req.body, employeeId: employee.id, status: "pending" });

    if (parsed.startDate && parsed.endDate && !req.body.halfDay) {
      const empCompanyId = employee.companyId;
      let wdArr = ["mon","tue","wed","thu","fri"];
      if (empCompanyId) {
        const [ws] = await db.select({ workDays: workSchedules.workDays }).from(workSchedules).where(eq(workSchedules.companyId, empCompanyId));
        if (ws?.workDays) wdArr = ws.workDays;
      }
      const holRows = empCompanyId
        ? await db.select({ date: holidays.date }).from(holidays).where(eq(holidays.companyId, empCompanyId))
        : [];
      const holSet = new Set(holRows.map(h => h.date));
      const DAY_MAP: Record<number, string> = { 0: "sun", 1: "mon", 2: "tue", 3: "wed", 4: "thu", 5: "fri", 6: "sat" };
      const s = new Date(String(parsed.startDate));
      const e = new Date(String(parsed.endDate));
      let count = 0;
      const cur = new Date(s);
      while (cur <= e) {
        const dk = DAY_MAP[cur.getDay()];
        const ds = cur.toISOString().slice(0, 10);
        if (wdArr.includes(dk) && !holSet.has(ds)) count++;
        cur.setDate(cur.getDate() + 1);
      }
      (parsed as any).days = String(count);
    }

    const record = await storage.createLeave(parsed);

    const year = new Date(String(parsed.startDate)).getFullYear();
    const [usedResult] = await db.select({
      total: sql<number>`COALESCE(SUM(${leaveRequests.days}::numeric), 0)`,
    }).from(leaveRequests).where(and(
      eq(leaveRequests.employeeId, employee.id),
      eq(leaveRequests.leaveType, (parsed as any).leaveType),
      inArray(leaveRequests.status, ["approved", "pending"]),
      sql`EXTRACT(YEAR FROM ${leaveRequests.startDate}::date) = ${year}`,
    ));
    const usedTotal = Number(usedResult?.total || 0);
    const existingBal = await db.select().from(leaveBalances).where(and(
      eq(leaveBalances.employeeId, employee.id),
      eq(leaveBalances.year, year),
      eq(leaveBalances.leaveType, (parsed as any).leaveType),
    ));
    if (existingBal.length > 0) {
      await db.update(leaveBalances).set({ used: String(usedTotal) }).where(eq(leaveBalances.id, existingBal[0].id));
    } else {
      await db.insert(leaveBalances).values({
        employeeId: employee.id, year, leaveType: (parsed as any).leaveType,
        quota: "0", used: String(usedTotal), carriedOver: "0", expired: "0",
      });
    }

    res.status(201).json(record);
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
    res.status(400).json({ message: err.message });
  }
});

app.get("/api/ess/ot", requireAuth, async (req, res) => {
  const user = req.user as any;
  const employee = await storage.getEmployeeByUserId(user.id);
  if (!employee) return res.status(404).json({ message: "ไม่พบข้อมูลพนักงาน" });
  const records = await storage.getOtByEmployee(employee.id);
  res.json(records);
});

app.post("/api/ess/ot", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const employee = await storage.getEmployeeByUserId(user.id);
    if (!employee) return res.status(404).json({ message: "ไม่พบข้อมูลพนักงาน" });
    const baseSalary = Number(employee.baseSalary || 0);
    const hourlyRate = baseSalary / 30 / 8;
    const hours = Number(req.body.hours || 0);
    if (hours <= 0) return res.status(400).json({ message: "กรุณาระบุจำนวนชั่วโมง OT" });
    const rate = Number(req.body.rate || 1.5);
    const amount = +(hourlyRate * hours * rate).toFixed(2);
    const parsed = insertOtSchema.parse({
      ...req.body,
      date: req.body.date ? String(req.body.date).split("T")[0] : undefined,
      startTime: req.body.startTime ? new Date(req.body.startTime) : undefined,
      endTime: req.body.endTime ? new Date(req.body.endTime) : undefined,
      employeeId: employee.id,
      hours: String(hours),
      rate: String(rate),
      amount: String(amount),
      status: "pending",
    });
    const record = await storage.createOt(parsed);
    res.status(201).json(record);
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
    res.status(400).json({ message: err.message });
  }
});

app.patch("/api/ess/ot/:id/cancel", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const employee = await storage.getEmployeeByUserId(user.id);
    if (!employee) return res.status(404).json({ message: "ไม่พบข้อมูลพนักงาน" });
    const otId = Number(req.params.id);
    const records = await storage.getOtByEmployee(employee.id);
    const record = records.find((r: any) => r.id === otId);
    if (!record) return res.status(404).json({ message: "ไม่พบรายการ OT" });
    if (record.status !== "pending") return res.status(400).json({ message: "สามารถยกเลิกได้เฉพาะรายการที่รออนุมัติ" });
    await db.update(otRecords).set({ status: "cancelled" }).where(eq(otRecords.id, otId));
    res.json({ success: true, message: "ยกเลิกคำขอ OT เรียบร้อย" });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/ess/payslips", requireAuth, async (req, res) => {
  const user = req.user as any;
  const employee = await storage.getEmployeeByUserId(user.id);
  if (!employee) return res.status(404).json({ message: "ไม่พบข้อมูลพนักงาน" });
  if (!employee.companyId) return res.json([]);
  const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
  const records = await storage.getPayrollRecordsByYear(employee.companyId, year);
  const myRecords = records.filter((r: any) => r.employeeId === employee.id);
  const enriched = await Promise.all(myRecords.map(async (rec: any) => {
    const adjustments = await storage.getPayrollAdjustments(employee.companyId, rec.month, rec.year);
    const empAdj = adjustments.filter((a: any) => a.employeeId === employee.id);
    const extraEarnings = empAdj.filter((a: any) => a.type === "earning").map((a: any) => ({ label: a.name, amount: Number(a.amount) }));
    const extraDeductions = empAdj.filter((a: any) => a.type === "deduction").map((a: any) => ({ label: a.name, amount: Number(a.amount) }));
    return { ...rec, extraEarnings, extraDeductions };
  }));
  res.json(enriched);
});

app.get("/api/ess/fifty-tawi", requireAuth, async (req, res) => {
  const user = req.user as any;
  const employee = await storage.getEmployeeByUserId(user.id);
  if (!employee) return res.status(404).json({ message: "ไม่พบข้อมูลพนักงาน" });
  const empCompany = employee.companyId ? await storage.getCompany(employee.companyId) : null;
  if (!empCompany) return res.json({ employee, company: null, annualEarnings: 0, annualTax: 0 });
  const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
  const records = await storage.getPayrollRecordsByYear(empCompany.id, year);
  const myRecords = records.filter((r: any) => r.employeeId === employee.id);
  const annualEarnings = myRecords.reduce((s: number, r: any) => s + Number(r.totalEarnings || 0), 0);
  const annualTax = myRecords.reduce((s: number, r: any) => s + Number(r.withholdingTax || 0), 0);
  const annualSso = myRecords.reduce((s: number, r: any) => s + Number(r.socialSecurity || 0), 0);
  res.json({ employee, company: empCompany, annualEarnings, annualTax, annualSso, year });
});

app.get("/api/contracts", requireAuth, async (req, res) => {
  const user = req.user as any;
  const companyId = req.query.companyId ? Number(req.query.companyId) : undefined;
  if (!companyId) return res.json([]);
  const allContracts = await storage.getContracts(companyId);
  res.json(allContracts);
});

app.get("/api/contracts/by-client/:clientId", requireAuth, async (req, res) => {
  const clientId = Number(req.params.clientId);
  const clientContracts = await storage.getContractsByClient(clientId);
  const companyId = req.query.companyId ? Number(req.query.companyId) : undefined;
  res.json(companyId ? clientContracts.filter((c: any) => c.companyId === companyId) : clientContracts);
});

app.get("/api/contracts/:id", requireAuth, async (req, res) => {
  const contract = await storage.getContract(Number(req.params.id));
  if (!contract) return res.status(404).json({ message: "ไม่พบสัญญา" });
  res.json(contract);
});

app.post("/api/contracts", requireAuth, async (req, res) => {
  const user = req.user as any;
  const companyId = req.body.companyId ? Number(req.body.companyId) : undefined;
  if (!companyId) return res.status(400).json({ message: "กรุณาระบุบริษัท" });
  const publicToken = crypto.randomUUID();
  const nextNo = await getNextDocNo(companyId, "CTR", contracts, contracts.contractNo, contracts.companyId, req.body.contractDate);
  const contract = await storage.createContract({
    ...req.body,
    companyId,
    contractNo: nextNo,
    publicToken,
    status: "draft",
    createdBy: user.id,
  });
  res.json(contract);
});

app.put("/api/contracts/:id", requireAuth, async (req, res) => {
  const existing = await storage.getContract(Number(req.params.id));
  if (!existing) return res.status(404).json({ message: "ไม่พบสัญญา" });
  { const ac = await checkDocOwnership(existing.companyId, req.user); if (!ac.allowed) return res.status(403).json({ message: ac.message }); }
  const contract = await storage.updateContract(existing.id, req.body);
  res.json(contract);
});

app.post("/api/contracts/:id/send", requireAuth, async (req, res) => {
  const existing = await storage.getContract(Number(req.params.id));
  if (!existing) return res.status(404).json({ message: "ไม่พบสัญญา" });
  { const ac = await checkDocOwnership(existing.companyId, req.user); if (!ac.allowed) return res.status(403).json({ message: ac.message }); }
  const contract = await storage.updateContract(existing.id, {
    status: "sent",
    sentAt: new Date(),
  } as any);
  res.json(contract);
});

app.delete("/api/contracts/:id", requireAuth, async (req, res) => {
  const existing = await storage.getContract(Number(req.params.id));
  if (!existing) return res.status(404).json({ message: "ไม่พบสัญญา" });
  { const ac = await checkDocOwnership(existing.companyId, req.user); if (!ac.allowed) return res.status(403).json({ message: ac.message }); }
  await storage.deleteContract(existing.id);
  res.json({ success: true });
});

app.get("/api/public/contracts/:token", async (req, res) => {
  const contract = await storage.getContractByToken(req.params.token);
  if (!contract) return res.status(404).json({ message: "ไม่พบสัญญา" });
  if (contract.status === "signed") return res.status(400).json({ message: "สัญญาฉบับนี้ได้ลงนามแล้ว" });
  if (contract.status === "void") return res.status(400).json({ message: "สัญญาฉบับนี้ถูกยกเลิก" });
  const safeContract = { ...contract, publicToken: undefined };
  res.json(safeContract);
});

app.post("/api/public/contracts/:token/sign", async (req, res) => {
  const contract = await storage.getContractByToken(req.params.token);
  if (!contract) return res.status(404).json({ message: "ไม่พบสัญญา" });
  if (contract.status === "signed") return res.status(400).json({ message: "สัญญาฉบับนี้ได้ลงนามแล้ว" });
  const { signatureDataUrl, signerName, signerPosition } = req.body;
  if (!signatureDataUrl || !signerName) return res.status(400).json({ message: "กรุณาระบุลายเซ็นและชื่อผู้ลงนาม" });
  const updated = await storage.updateContract(contract.id, {
    signatureDataUrl,
    signerName,
    signerPosition: signerPosition || "",
    status: "signed",
    signedAt: new Date(),
  } as any);
  res.json({ success: true, message: "ลงนามสัญญาเรียบร้อยแล้ว" });
});

}
