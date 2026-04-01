import type { Express } from "express";
import { db } from "../db";
import { eq, and, desc, sql } from "drizzle-orm";
import { loyaltyPrograms, loyaltyRewards, loyaltyMembers, loyaltyPointTransactions } from "@shared/schema";
import { createRouteGroup, badRequest, notFound, forbidden, verifyCompanyAccess } from "../route-factory";

export function registerLoyaltyRoutes(app: Express) {

const r = createRouteGroup(app, { module: "pos" });

r.companyRoute("get", "/api/loyalty/programs", async ({ companyId }) => {
  return db.select().from(loyaltyPrograms).where(eq(loyaltyPrograms.companyId, companyId)).orderBy(desc(loyaltyPrograms.createdAt));
});

r.companyRoute("post", "/api/loyalty/programs", async ({ companyId, user, req, res }) => {
  const { name, pointsPerSpend, spendAmount, minSpendPerTxn, pointExpireDays } = req.body;
  if (!name) badRequest("กรุณากรอกข้อมูลให้ครบ");
  const [program] = await db.insert(loyaltyPrograms).values({
    companyId, name, pointsPerSpend: String(pointsPerSpend || 1), spendAmount: String(spendAmount || 100),
    minSpendPerTxn: String(minSpendPerTxn || 0), pointExpireDays: pointExpireDays ? Number(pointExpireDays) : null, createdBy: user.id,
  }).returning();
  res.status(201).json(program);
});

r.ownerRoute("put", "/api/loyalty/programs/:id", async ({ user, req }) => {
  const id = Number(req.params.id);
  const [existing] = await db.select().from(loyaltyPrograms).where(eq(loyaltyPrograms.id, id));
  if (!existing) notFound("ไม่พบโปรแกรม");
  if (!(await verifyCompanyAccess(user, existing.companyId))) forbidden();
  const { name, pointsPerSpend, spendAmount, minSpendPerTxn, pointExpireDays, active } = req.body;
  const [updated] = await db.update(loyaltyPrograms).set({
    ...(name !== undefined && { name }),
    ...(pointsPerSpend !== undefined && { pointsPerSpend: String(pointsPerSpend) }),
    ...(spendAmount !== undefined && { spendAmount: String(spendAmount) }),
    ...(minSpendPerTxn !== undefined && { minSpendPerTxn: String(minSpendPerTxn) }),
    ...(pointExpireDays !== undefined && { pointExpireDays: pointExpireDays ? Number(pointExpireDays) : null }),
    ...(active !== undefined && { active }),
  }).where(eq(loyaltyPrograms.id, id)).returning();
  return updated;
});

r.ownerRoute("delete", "/api/loyalty/programs/:id", async ({ user, req }) => {
  const id = Number(req.params.id);
  const [existing] = await db.select().from(loyaltyPrograms).where(eq(loyaltyPrograms.id, id));
  if (!existing) notFound("ไม่พบโปรแกรม");
  if (!(await verifyCompanyAccess(user, existing.companyId))) forbidden();
  await db.delete(loyaltyPrograms).where(eq(loyaltyPrograms.id, id));
  return { success: true };
});

r.companyRoute("get", "/api/loyalty/rewards", async ({ companyId, req }) => {
  const programId = req.query.programId ? Number(req.query.programId) : undefined;
  let q = db.select().from(loyaltyRewards).where(eq(loyaltyRewards.companyId, companyId)).orderBy(loyaltyRewards.pointsCost).$dynamic();
  if (programId) q = q.where(and(eq(loyaltyRewards.companyId, companyId), eq(loyaltyRewards.programId, programId)));
  return q;
});

r.companyRoute("post", "/api/loyalty/rewards", async ({ companyId, req, res }) => {
  const { programId, name, pointsCost, rewardType, discountAmount, discountPercent, maxDiscount } = req.body;
  if (!programId || !name || !pointsCost) badRequest("กรุณากรอกข้อมูลให้ครบ");
  const [reward] = await db.insert(loyaltyRewards).values({
    companyId, programId: Number(programId), name, pointsCost: Number(pointsCost),
    rewardType: rewardType || "discount", discountAmount: discountAmount ? String(discountAmount) : null,
    discountPercent: discountPercent ? String(discountPercent) : null, maxDiscount: maxDiscount ? String(maxDiscount) : null,
  }).returning();
  res.status(201).json(reward);
});

r.ownerRoute("put", "/api/loyalty/rewards/:id", async ({ user, req }) => {
  const id = Number(req.params.id);
  const [existing] = await db.select().from(loyaltyRewards).where(eq(loyaltyRewards.id, id));
  if (!existing) notFound("ไม่พบรางวัล");
  if (!(await verifyCompanyAccess(user, existing.companyId))) forbidden();
  const { name, pointsCost, rewardType, discountAmount, discountPercent, maxDiscount, active } = req.body;
  const [updated] = await db.update(loyaltyRewards).set({
    ...(name !== undefined && { name }),
    ...(pointsCost !== undefined && { pointsCost: Number(pointsCost) }),
    ...(rewardType !== undefined && { rewardType }),
    ...(discountAmount !== undefined && { discountAmount: discountAmount ? String(discountAmount) : null }),
    ...(discountPercent !== undefined && { discountPercent: discountPercent ? String(discountPercent) : null }),
    ...(maxDiscount !== undefined && { maxDiscount: maxDiscount ? String(maxDiscount) : null }),
    ...(active !== undefined && { active }),
  }).where(eq(loyaltyRewards.id, id)).returning();
  return updated;
});

r.ownerRoute("delete", "/api/loyalty/rewards/:id", async ({ user, req }) => {
  const id = Number(req.params.id);
  const [existing] = await db.select().from(loyaltyRewards).where(eq(loyaltyRewards.id, id));
  if (!existing) notFound("ไม่พบรางวัล");
  if (!(await verifyCompanyAccess(user, existing.companyId))) forbidden();
  await db.delete(loyaltyRewards).where(eq(loyaltyRewards.id, id));
  return { success: true };
});

r.companyRoute("get", "/api/loyalty/members", async ({ companyId, req }) => {
  const search = req.query.search as string | undefined;
  if (search) {
    return db.select().from(loyaltyMembers)
      .where(and(eq(loyaltyMembers.companyId, companyId), sql`(${loyaltyMembers.name} ILIKE ${'%' + search + '%'} OR ${loyaltyMembers.phone} ILIKE ${'%' + search + '%'} OR ${loyaltyMembers.memberCode} ILIKE ${'%' + search + '%'})`))
      .orderBy(desc(loyaltyMembers.createdAt)).limit(50);
  }
  return db.select().from(loyaltyMembers)
    .where(eq(loyaltyMembers.companyId, companyId))
    .orderBy(desc(loyaltyMembers.createdAt)).limit(200);
});

r.companyRoute("post", "/api/loyalty/members", async ({ companyId, user, req, res }) => {
  const { programId, name, phone, email } = req.body;
  if (!programId || !name) badRequest("กรุณากรอกชื่อสมาชิก");
  const countResult = await db.select({ count: sql<number>`count(*)::int` }).from(loyaltyMembers).where(eq(loyaltyMembers.companyId, companyId));
  const nextNum = (countResult[0]?.count || 0) + 1;
  const memberCode = `M${String(nextNum).padStart(5, "0")}`;
  const [member] = await db.insert(loyaltyMembers).values({
    companyId, programId: Number(programId), memberCode, name, phone: phone || null, email: email || null,
  }).returning();
  res.status(201).json(member);
});

r.ownerRoute("put", "/api/loyalty/members/:id", async ({ user, req }) => {
  const id = Number(req.params.id);
  const [existing] = await db.select().from(loyaltyMembers).where(eq(loyaltyMembers.id, id));
  if (!existing) notFound("ไม่พบสมาชิก");
  if (!(await verifyCompanyAccess(user, existing.companyId))) forbidden();
  const { name, phone, email, active } = req.body;
  const [updated] = await db.update(loyaltyMembers).set({
    ...(name !== undefined && { name }),
    ...(phone !== undefined && { phone }),
    ...(email !== undefined && { email }),
    ...(active !== undefined && { active }),
  }).where(eq(loyaltyMembers.id, id)).returning();
  return updated;
});

r.companyRoute("post", "/api/loyalty/earn", async ({ companyId, user, req }) => {
  const { memberId, amount, posTransactionId, description } = req.body;
  if (!memberId || !amount) badRequest("ข้อมูลไม่ครบ");
  const [member] = await db.select().from(loyaltyMembers).where(eq(loyaltyMembers.id, Number(memberId)));
  if (!member) notFound("ไม่พบสมาชิก");
  const [program] = await db.select().from(loyaltyPrograms).where(eq(loyaltyPrograms.id, member.programId));
  if (!program || !program.active) badRequest("โปรแกรมสะสมคะแนนไม่พร้อมใช้งาน");
  const spendAmt = Number(program.spendAmount) || 100;
  const ptsPerSpend = Number(program.pointsPerSpend) || 1;
  const minSpend = Number(program.minSpendPerTxn) || 0;
  if (Number(amount) < minSpend) badRequest(`ยอดซื้อขั้นต่ำ ฿${minSpend}`);
  const earnedPoints = Math.floor(Number(amount) / spendAmt) * ptsPerSpend;
  if (earnedPoints <= 0) return { points: 0, message: "ยอดซื้อไม่เพียงพอสำหรับสะสมคะแนน" };
  const newTotal = (member.totalPoints || 0) + earnedPoints;
  const newSpent = Number(member.totalSpent || 0) + Number(amount);
  const newVisits = (member.visitCount || 0) + 1;
  await db.update(loyaltyMembers).set({ totalPoints: newTotal, totalSpent: String(newSpent), visitCount: newVisits }).where(eq(loyaltyMembers.id, member.id));
  const expiresAt = program.pointExpireDays ? new Date(Date.now() + program.pointExpireDays * 86400000) : null;
  const [txn] = await db.insert(loyaltyPointTransactions).values({
    companyId, memberId: member.id, programId: program.id, type: "earn", points: earnedPoints,
    balanceAfter: newTotal, description: description || `สะสมคะแนนจากยอดซื้อ ฿${Number(amount).toLocaleString()}`,
    posTransactionId: posTransactionId ? Number(posTransactionId) : null, expiresAt, createdBy: user.id,
  }).returning();
  return { points: earnedPoints, totalPoints: newTotal, transaction: txn };
});

r.companyRoute("post", "/api/loyalty/redeem", async ({ companyId, user, req }) => {
  const { memberId, rewardId, posTransactionId } = req.body;
  if (!memberId || !rewardId) badRequest("ข้อมูลไม่ครบ");
  const [member] = await db.select().from(loyaltyMembers).where(eq(loyaltyMembers.id, Number(memberId)));
  if (!member) notFound("ไม่พบสมาชิก");
  const [reward] = await db.select().from(loyaltyRewards).where(eq(loyaltyRewards.id, Number(rewardId)));
  if (!reward || !reward.active) badRequest("รางวัลไม่พร้อมใช้งาน");
  if ((member.totalPoints || 0) < reward.pointsCost) badRequest(`คะแนนไม่เพียงพอ (ต้องการ ${reward.pointsCost} คะแนน, มี ${member.totalPoints} คะแนน)`);
  const newTotal = (member.totalPoints || 0) - reward.pointsCost;
  await db.update(loyaltyMembers).set({ totalPoints: newTotal }).where(eq(loyaltyMembers.id, member.id));
  const [txn] = await db.insert(loyaltyPointTransactions).values({
    companyId, memberId: member.id, programId: member.programId, type: "redeem", points: -reward.pointsCost,
    balanceAfter: newTotal, description: `แลกคะแนน: ${reward.name}`, rewardId: reward.id,
    posTransactionId: posTransactionId ? Number(posTransactionId) : null, createdBy: user.id,
  }).returning();
  return { reward, pointsUsed: reward.pointsCost, totalPoints: newTotal, transaction: txn };
});

r.ownerRoute("get", "/api/loyalty/history/:memberId", async ({ user, req }) => {
  const memberId = Number(req.params.memberId);
  const [member] = await db.select().from(loyaltyMembers).where(eq(loyaltyMembers.id, memberId));
  if (!member) notFound("ไม่พบสมาชิก");
  if (!(await verifyCompanyAccess(user, member.companyId))) forbidden();
  return db.select().from(loyaltyPointTransactions)
    .where(eq(loyaltyPointTransactions.memberId, memberId))
    .orderBy(desc(loyaltyPointTransactions.createdAt)).limit(100);
});

app.get("/api/public/loyalty/program/:companyId", async (req, res) => {
  try {
    const companyId = Number(req.params.companyId);
    if (!companyId) return res.status(400).json({ message: "invalid" });
    const [program] = await db.select().from(loyaltyPrograms)
      .where(and(eq(loyaltyPrograms.companyId, companyId), eq(loyaltyPrograms.active, true)))
      .limit(1);
    if (!program) return res.status(404).json({ message: "ไม่พบโปรแกรมสะสมแต้ม" });
    const { companies: companiesTable } = await import("@shared/schema");
    const [company] = await db.select({ name: companiesTable.name }).from(companiesTable).where(eq(companiesTable.id, companyId)).limit(1);
    res.json({ program: { id: program.id, name: program.name, pointsPerSpend: program.pointsPerSpend, spendAmount: program.spendAmount }, companyName: company?.name || "" });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post("/api/public/loyalty/signup/:companyId", async (req, res) => {
  try {
    const companyId = Number(req.params.companyId);
    const { name, phone, email } = req.body;
    if (!companyId || !name?.trim()) return res.status(400).json({ message: "กรุณากรอกชื่อ" });
    const [program] = await db.select().from(loyaltyPrograms)
      .where(and(eq(loyaltyPrograms.companyId, companyId), eq(loyaltyPrograms.active, true)))
      .limit(1);
    if (!program) return res.status(404).json({ message: "ไม่พบโปรแกรมสะสมแต้ม" });
    if (phone?.trim()) {
      const [existing] = await db.select().from(loyaltyMembers)
        .where(and(eq(loyaltyMembers.companyId, companyId), eq(loyaltyMembers.phone, phone.trim())))
        .limit(1);
      if (existing) return res.status(409).json({ message: "เบอร์โทรนี้เป็นสมาชิกอยู่แล้ว", member: { memberCode: existing.memberCode, name: existing.name, totalPoints: existing.totalPoints } });
    }
    const countResult = await db.select({ count: sql<number>`count(*)::int` }).from(loyaltyMembers).where(eq(loyaltyMembers.companyId, companyId));
    const nextNum = (countResult[0]?.count || 0) + 1;
    const memberCode = `M${String(nextNum).padStart(5, "0")}`;
    const [member] = await db.insert(loyaltyMembers).values({
      companyId, programId: program.id, memberCode, name: name.trim(), phone: phone?.trim() || null, email: email?.trim() || null,
    }).returning();
    res.status(201).json({ success: true, member: { memberCode: member.memberCode, name: member.name, totalPoints: 0 } });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

r.companyRoute("post", "/api/loyalty/adjust", async ({ companyId, user, req }) => {
  const { memberId, points, description } = req.body;
  if (!memberId || !points) badRequest("ข้อมูลไม่ครบ");
  const [member] = await db.select().from(loyaltyMembers).where(eq(loyaltyMembers.id, Number(memberId)));
  if (!member) notFound("ไม่พบสมาชิก");
  const newTotal = Math.max(0, (member.totalPoints || 0) + Number(points));
  await db.update(loyaltyMembers).set({ totalPoints: newTotal }).where(eq(loyaltyMembers.id, member.id));
  const [txn] = await db.insert(loyaltyPointTransactions).values({
    companyId, memberId: member.id, programId: member.programId,
    type: Number(points) > 0 ? "adjust_add" : "adjust_deduct", points: Number(points),
    balanceAfter: newTotal, description: description || "ปรับคะแนนโดยผู้ดูแล", createdBy: user.id,
  }).returning();
  return { totalPoints: newTotal, transaction: txn };
});

}
