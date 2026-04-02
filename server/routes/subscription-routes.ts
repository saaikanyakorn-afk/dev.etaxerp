import type { Express, Request, Response } from "express";
import { db } from "../db";
import { storage } from "../storage";
import { eq, and, asc } from "drizzle-orm";
import { users, companies, products, subscriptionAddons, tenantAddonSubscriptions, taxInvoices, taxInvoiceItems, tenants, subscriptionPaymentOrders, modulePlans, tenantModuleSubscriptions } from "@shared/schema";
import { desc } from "drizzle-orm";
import { requireAuth, requireAdmin, requireSuperAdmin } from "../route-middleware";
import { pool } from "../db";
import { getConfig, setConfig } from "../config-bootstrap";
import { getNextDocNo, createAutoJournalEntry, resolvePaymentMethodAccountCode } from "../route-helpers";
import OpenAI from "openai";

const PLATFORM_COMPANY_ID = 4;

async function createSubscriptionTaxInvoice(orderId: number): Promise<{ taxInvoiceId: number; taxInvoiceNo: string } | null> {
  try {
    const order = await storage.getSubscriptionPaymentOrder(orderId);
    if (!order) return null;

    if (order.taxInvoiceId) {
      const [existing] = await db.select({ id: taxInvoices.id, taxInvoiceNo: taxInvoices.taxInvoiceNo }).from(taxInvoices).where(eq(taxInvoices.id, order.taxInvoiceId));
      if (existing) return { taxInvoiceId: existing.id, taxInvoiceNo: existing.taxInvoiceNo };
    }

    const [existingByRef] = await db.select({ id: taxInvoices.id, taxInvoiceNo: taxInvoices.taxInvoiceNo }).from(taxInvoices).where(eq(taxInvoices.refDoc, `SUB-${orderId}`));
    if (existingByRef) {
      await storage.updateSubscriptionPaymentOrder(orderId, { taxInvoiceId: existingByRef.id });
      return { taxInvoiceId: existingByRef.id, taxInvoiceNo: existingByRef.taxInvoiceNo };
    }

    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, order.tenantId));
    if (!tenant) return null;

    const plan = await storage.getSubscriptionPlan(order.planId);
    if (!plan) return null;

    const tenantCompanies = await db.select().from(companies).where(eq(companies.tenantId, order.tenantId));
    const primaryCompany = tenantCompanies.find(c => c.isPrimary) || tenantCompanies[0];

    const customerName = primaryCompany?.name || tenant.name;
    const customerAddress = primaryCompany?.address || "";
    const customerTaxId = primaryCompany?.taxId || "";
    const customerBranch = primaryCompany?.branch || "สำนักงานใหญ่";

    const totalAmount = parseFloat(String(order.amount)) + parseFloat(String(order.setupFeeAmount || "0"));
    const baseAmount = Math.round((totalAmount / 1.07) * 100) / 100;
    const vatAmount = Math.round((totalAmount - baseAmount) * 100) / 100;

    const today = new Date();
    const docDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    const taxInvoiceNo = await getNextDocNo(PLATFORM_COMPANY_ID, "TIV", taxInvoices, taxInvoices.taxInvoiceNo, taxInvoices.companyId, docDate);

    const cycleName = order.billingCycle === "yearly" ? "รายปี" : "รายเดือน";
    const setupFee = parseFloat(String(order.setupFeeAmount || "0"));

    const result = await db.transaction(async (tx) => {
      const [doc] = await tx.insert(taxInvoices).values({
        companyId: PLATFORM_COMPANY_ID,
        taxInvoiceNo,
        taxInvoiceDate: docDate,
        customerName,
        customerAddress,
        customerTaxId,
        branch: customerBranch,
        contactEmail: primaryCompany?.email || tenant.contactEmail || "",
        contactPhone: primaryCompany?.phone || tenant.contactPhone || "",
        subtotal: String(baseAmount),
        vatAmount: String(vatAmount),
        totalAmount: String(totalAmount),
        status: "approved",
        paymentStatus: "paid",
        priceMode: "included",
        paymentMethod: "โอนเงิน",
        docPrefix: "TIV",
        refDoc: `SUB-${order.id}`,
        notes: `ชำระค่าแพ็คเกจ ${plan.name} (${cycleName})`,
      }).returning();

      const items: { name: string; amount: number }[] = [];
      const planAmount = parseFloat(String(order.amount));
      if (planAmount > 0) {
        items.push({ name: `ค่าบริการแพ็คเกจ ${plan.name} (${cycleName})`, amount: planAmount });
      }
      if (setupFee > 0) {
        items.push({ name: `ค่าติดตั้งระบบ ${plan.name}`, amount: setupFee });
      }

      for (const item of items) {
        await tx.insert(taxInvoiceItems).values({
          taxInvoiceId: doc.id,
          productName: item.name,
          qty: "1",
          unit: "บริการ",
          unitPrice: String(item.amount.toFixed(2)),
          total: String(item.amount.toFixed(2)),
          vatType: "vat7",
        });
      }

      await tx.update(subscriptionPaymentOrders).set({ taxInvoiceId: doc.id }).where(eq(subscriptionPaymentOrders.id, orderId));

      return doc;
    });

    try {
      let pmAccCode: string | undefined;
      try {
        pmAccCode = await resolvePaymentMethodAccountCode(PLATFORM_COMPANY_ID, "โอนเงิน");
      } catch (_) {}
      if (!pmAccCode) pmAccCode = "1002000";

      const journalResult = await createAutoJournalEntry({
        companyId: PLATFORM_COMPANY_ID,
        documentType: "tax_invoice",
        sourceDocType: "tax_invoice",
        sourceDocId: result.id,
        docDate,
        docNo: taxInvoiceNo,
        subtotal: String(baseAmount),
        vatAmount: String(vatAmount),
        totalAmount: String(totalAmount),
        withholdingTax: "0",
        currencyCode: "THB",
        exchangeRate: "1",
        userId: null as any,
        customerName,
        paymentMethod: "โอนเงิน",
        paymentMethodAccountCode: pmAccCode,
      });
      console.log(`[Sub TIV] Journal for order #${orderId}: id=${journalResult.journalEntryId}, skipped=${journalResult.skipped}, reason=${journalResult.reason || "none"}`);
    } catch (e) {
      console.error(`[Sub TIV] Auto journal failed for order #${orderId}:`, (e as Error).message);
    }

    console.log(`[Sub TIV] Created tax invoice ${taxInvoiceNo} (id=${result.id}) for order #${orderId}, tenant: ${tenant.name}`);
    return { taxInvoiceId: result.id, taxInvoiceNo };
  } catch (err: any) {
    console.error(`[Sub TIV] Failed to create tax invoice for order #${orderId}:`, err.message);
    return null;
  }
}

export function registerSubscriptionRoutes(app: Express) {
// ===== Subscription Plans & Tenant Subscriptions =====
app.get("/api/subscription-plans", async (req, res) => {
  const plans = await storage.getSubscriptionPlans();
  const group = req.query.group as string | undefined;
  if (group) {
    res.json(plans.filter((p: any) => p.targetGroup === group));
  } else {
    res.json(plans);
  }
});

app.post("/api/subscription-plans", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const plan = await storage.createSubscriptionPlan(req.body);
    res.status(201).json(plan);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

app.delete("/api/subscription-plans/:id", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const planId = Number(req.params.id);
    const subs = await storage.getAllTenantSubscriptions();
    const activeCount = subs.filter(s => s.planId === planId && s.status !== "cancelled").length;
    if (activeCount > 0) {
      return res.status(400).json({ message: `ไม่สามารถลบได้ มีสมาชิกใช้งานอยู่ ${activeCount} ราย` });
    }
    const deleted = await storage.deleteSubscriptionPlan(planId);
    if (!deleted) return res.status(404).json({ message: "ไม่พบแพ็คเกจ" });
    res.json({ message: "ลบแพ็คเกจสำเร็จ" });
  } catch (err: any) {
    console.error("[subscription-plans] DELETE error:", err.message);
    res.status(500).json({ message: "เกิดข้อผิดพลาดในการลบ" });
  }
});

app.patch("/api/subscription-plans/:id", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { id, code, createdAt, ...updateData } = req.body;
    const plan = await storage.updateSubscriptionPlan(Number(req.params.id), updateData);
    if (!plan) return res.status(404).json({ message: "ไม่พบแพ็คเกจ" });
    res.json(plan);
  } catch (err: any) {
    console.error("[subscription-plans] PATCH error:", err.message);
    res.status(500).json({ message: "เกิดข้อผิดพลาดในการบันทึก" });
  }
});

app.get("/api/tenant-subscription", requireAuth, async (req, res) => {
  const user = req.user as any;
  if (!user.tenantId) return res.json(null);
  const sub = await storage.getTenantSubscription(user.tenantId);
  res.json(sub || null);
});

app.get("/api/tenant-subscriptions", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const subs = await storage.getAllTenantSubscriptions();
    console.log(`[tenant-subscriptions] returning ${subs.length} subscriptions`);
    res.json(subs);
  } catch (err: any) {
    console.error(`[tenant-subscriptions] ERROR: ${err.message}`);
    res.json([]);
  }
});

app.post("/api/tenant-subscriptions", requireAuth, requireAdmin, async (req, res) => {
  try {
    const sub = await storage.createTenantSubscription(req.body);
    res.status(201).json(sub);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

app.patch("/api/tenant-subscriptions/:id", requireAuth, requireAdmin, async (req, res) => {
  const data = { ...req.body };
  if (data.trialEndsAt !== undefined) {
    data.trialEndsAt = data.trialEndsAt ? new Date(data.trialEndsAt) : null;
  }
  if (data.endDate !== undefined) {
    data.endDate = data.endDate ? new Date(data.endDate) : null;
  }
  if (data.startDate !== undefined) {
    data.startDate = data.startDate ? new Date(data.startDate) : null;
  }
  const sub = await storage.updateTenantSubscription(Number(req.params.id), data);
  if (!sub) return res.status(404).json({ message: "ไม่พบข้อมูลสมาชิก" });
  res.json(sub);
});

app.get("/api/tenant-usage", requireAuth, async (req, res) => {
  const user = req.user as any;
  if (!user.tenantId) return res.json({ users: 0, companies: 0, products: 0, documents: 0, ecommerceConnections: 0 });
  const stats = await storage.getTenantUsageStats(user.tenantId);
  res.json(stats);
});

app.get("/api/my-subscription-info", requireAuth, async (req, res) => {
  const user = req.user as any;
  if (!user.tenantId) {
    if (user.role === "super_admin") {
      const plans = await storage.getSubscriptionPlans();
      const enterprisePlan = plans.find((p: any) => p.code === "enterprise") || plans[plans.length - 1];
      return res.json({ subscription: { status: "active" }, usage: { users: 0, documents: 0, products: 0 }, plan: enterprisePlan, daysRemaining: null, isExpiringSoon: false, addons: [] });
    }
    return res.json({ subscription: null, usage: null, plan: null, addons: [] });
  }
  const sub = await storage.getTenantSubscription(user.tenantId);
  const usage = await storage.getTenantUsageStats(user.tenantId);
  const plan = sub?.plan || null;
  const daysRemaining = sub?.endDate ? Math.max(0, Math.ceil((new Date(sub.endDate).getTime() - Date.now()) / 86400000)) : null;
  const isExpiringSoon = daysRemaining !== null && daysRemaining <= 14;

  const activeAddons = await db.select({
    id: subscriptionAddons.id,
    code: subscriptionAddons.code,
    name: subscriptionAddons.name,
    featureFlag: subscriptionAddons.featureFlag,
  })
  .from(tenantAddonSubscriptions)
  .innerJoin(subscriptionAddons, eq(tenantAddonSubscriptions.addonId, subscriptionAddons.id))
  .where(and(
    eq(tenantAddonSubscriptions.tenantId, user.tenantId),
    eq(tenantAddonSubscriptions.status, "active"),
  ));

  const mergedPlan = plan ? { ...plan } : null;
  if (mergedPlan) {
    for (const addon of activeAddons) {
      if (addon.featureFlag && addon.featureFlag in mergedPlan) {
        (mergedPlan as any)[addon.featureFlag] = true;
      }
    }
  }

  res.json({ subscription: sub, usage, plan: mergedPlan, daysRemaining, isExpiringSoon, addons: activeAddons });
});

app.get("/api/subscription-addons", async (_req, res) => {
  const addons = await db.select().from(subscriptionAddons).where(eq(subscriptionAddons.active, true)).orderBy(asc(subscriptionAddons.sortOrder));
  res.json(addons);
});

app.get("/api/public/landing-packages", async (_req, res) => {
  try {
    const plans = await storage.getSubscriptionPlans();
    const addons = await db.select().from(subscriptionAddons).where(eq(subscriptionAddons.active, true)).orderBy(asc(subscriptionAddons.sortOrder));
    res.json({ plans, addons });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/my-addons", requireAuth, async (req, res) => {
  const user = req.user as any;
  if (!user.tenantId) return res.json([]);
  const result = await db.select({
    id: tenantAddonSubscriptions.id,
    addonId: tenantAddonSubscriptions.addonId,
    status: tenantAddonSubscriptions.status,
    billingCycle: tenantAddonSubscriptions.billingCycle,
    startDate: tenantAddonSubscriptions.startDate,
    endDate: tenantAddonSubscriptions.endDate,
    addon: subscriptionAddons,
  })
  .from(tenantAddonSubscriptions)
  .innerJoin(subscriptionAddons, eq(tenantAddonSubscriptions.addonId, subscriptionAddons.id))
  .where(eq(tenantAddonSubscriptions.tenantId, user.tenantId));
  res.json(result);
});

app.post("/api/my-addons/subscribe", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    if (!user.tenantId) return res.status(400).json({ message: "ไม่พบข้อมูล tenant" });
    if (user.role !== "admin" && user.role !== "super_admin" && user.role !== "manager") {
      return res.status(403).json({ message: "ไม่มีสิทธิ์" });
    }
    const { addonId, billingCycle } = req.body;
    if (!addonId) return res.status(400).json({ message: "กรุณาระบุ addon" });

    const existing = await db.select().from(tenantAddonSubscriptions)
      .where(and(
        eq(tenantAddonSubscriptions.tenantId, user.tenantId),
        eq(tenantAddonSubscriptions.addonId, addonId),
        eq(tenantAddonSubscriptions.status, "active"),
      ));
    if (existing.length > 0) return res.status(400).json({ message: "สมัครโมดูลนี้อยู่แล้ว" });

    const [created] = await db.insert(tenantAddonSubscriptions).values({
      tenantId: user.tenantId,
      addonId,
      billingCycle: billingCycle || "monthly",
      status: "active",
    }).returning();
    res.json({ message: "สมัครโมดูลเสริมสำเร็จ", subscription: created });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/my-addons/:id/cancel", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    if (!user.tenantId) return res.status(400).json({ message: "ไม่พบข้อมูล tenant" });
    const id = parseInt(req.params.id);
    const [sub] = await db.select().from(tenantAddonSubscriptions)
      .where(and(
        eq(tenantAddonSubscriptions.id, id),
        eq(tenantAddonSubscriptions.tenantId, user.tenantId),
      ));
    if (!sub) return res.status(404).json({ message: "ไม่พบการสมัคร" });
    await db.update(tenantAddonSubscriptions)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(tenantAddonSubscriptions.id, id));
    res.json({ message: "ยกเลิกโมดูลเสริมสำเร็จ" });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/my-subscription/change-plan", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    if (!user.tenantId) return res.status(400).json({ message: "ไม่พบข้อมูลบริษัท" });

    if (user.role !== "admin" && user.role !== "superadmin") {
      return res.status(403).json({ message: "เฉพาะเจ้าของ/ผู้ดูแลระบบเท่านั้นที่สามารถเปลี่ยนแพ็คเกจได้" });
    }

    const { planId, billingCycle } = req.body;
    if (!planId) return res.status(400).json({ message: "กรุณาเลือกแพ็คเกจ" });

    const plans = await storage.getSubscriptionPlans();
    const newPlan = plans.find((p: any) => p.id === planId);
    if (!newPlan) return res.status(404).json({ message: "ไม่พบแพ็คเกจที่เลือก" });

    const existingSub = await storage.getTenantSubscription(user.tenantId);
    const now = new Date();
    const cycle = billingCycle || "monthly";
    const endDate = new Date(now);
    if (cycle === "yearly") {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }

    if (existingSub) {
      const updated = await storage.updateTenantSubscription(existingSub.id, {
        planId,
        billingCycle: cycle,
        status: "active",
        startDate: now,
        endDate,
      });
      res.json({ message: "เปลี่ยนแพ็คเกจสำเร็จ", subscription: updated, plan: newPlan });
    } else {
      const created = await storage.createTenantSubscription({
        tenantId: user.tenantId,
        planId,
        billingCycle: cycle,
        status: "active",
        startDate: now,
        endDate,
      });
      res.json({ message: "สมัครแพ็คเกจสำเร็จ", subscription: created, plan: newPlan });
    }
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/tenant-limit/:feature", requireAuth, async (req, res) => {
  const user = req.user as any;
  if (!user.tenantId) return res.json({ allowed: true, current: 0, limit: 999999, planName: "ไม่มีแพ็คเกจ" });
  const result = await storage.checkTenantLimit(user.tenantId, req.params.feature);
  res.json(result);
});

// ===== Subscription Payment Orders =====
app.post("/api/subscription/create-payment", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    if (!user.tenantId) return res.status(400).json({ message: "ไม่พบข้อมูลบริษัท" });
    const { planId, billingCycle, orderType } = req.body;
    if (!planId) return res.status(400).json({ message: "กรุณาเลือกแพ็คเกจ" });

    const cycle = billingCycle === "yearly" ? "yearly" : "monthly";
    const validOrderType = orderType === "new" ? "new" : "renewal";

    const plan = await storage.getSubscriptionPlan(Number(planId));
    if (!plan) return res.status(404).json({ message: "ไม่พบแพ็คเกจที่เลือก" });

    const monthlyAmt = parseFloat(String(plan.monthlyPrice)) || 0;
    const yearlyAmt = parseFloat(String(plan.yearlyPrice || plan.monthlyPrice)) || 0;
    const amount = cycle === "yearly" ? yearlyAmt : monthlyAmt;
    const setupFeeAmount = (validOrderType === "new" && plan.setupFee) ? plan.setupFee : "0";

    const { generatePromptPayQRData } = await import("../utils/promptpay-qr");
    const totalAmount = parseFloat(String(amount)) + parseFloat(String(setupFeeAmount));

    const promptpayId = getConfig("PLATFORM_PROMPTPAY_ID") || "0649195196";
    const qrData = generatePromptPayQRData(promptpayId, totalAmount);

    const order = await storage.createSubscriptionPaymentOrder({
      tenantId: user.tenantId,
      planId,
      amount: String(amount),
      setupFeeAmount: String(setupFeeAmount),
      billingCycle: cycle,
      status: "pending",
      orderType: validOrderType,
      promptpayRef: qrData,
    });

    let qrImageDataUrl = "";
    try {
      const QRCode = await import("qrcode");
      qrImageDataUrl = await QRCode.default.toDataURL(qrData, { width: 300, margin: 2 });
    } catch {}

    res.status(201).json({ order, qrData, qrImageDataUrl, totalAmount, promptpayId });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/subscription/upload-slip/:id", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const order = await storage.getSubscriptionPaymentOrder(Number(req.params.id));
    if (!order) return res.status(404).json({ message: "ไม่พบรายการชำระเงิน" });
    if (order.tenantId !== user.tenantId) return res.status(403).json({ message: "ไม่มีสิทธิ์" });
    if (order.status === "confirmed") return res.status(400).json({ message: "รายการนี้ยืนยันแล้ว" });

    const { slipImageUrl } = req.body;
    if (!slipImageUrl) return res.status(400).json({ message: "กรุณาแนบสลิป" });

    if (typeof slipImageUrl !== "string" || slipImageUrl.length > 2 * 1024 * 1024) {
      return res.status(400).json({ message: "ไฟล์สลิปใหญ่เกินไป (สูงสุด 2MB)" });
    }
    if (slipImageUrl.startsWith("data:") && !slipImageUrl.match(/^data:image\/(jpeg|jpg|png|webp);base64,/)) {
      return res.status(400).json({ message: "รองรับเฉพาะไฟล์รูปภาพ (JPG, PNG, WebP)" });
    }

    await storage.updateSubscriptionPaymentOrder(order.id, { slipImageUrl, status: "pending" });

    const aiAutoVerify = getConfig("PLATFORM_AI_AUTO_VERIFY") !== "false";
    const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;

    if (aiAutoVerify && apiKey && slipImageUrl) {
      try {
        const openai = new OpenAI({
          apiKey,
          ...(process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ? { baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL } : {}),
        });

        const expectedAmount = parseFloat(String(order.amount)) + parseFloat(String(order.setupFeeAmount || "0"));
        const configAccountName = getConfig("PLATFORM_ACCOUNT_NAME") || "";

        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          max_tokens: 1024,
          messages: [
            {
              role: "system",
              content: `คุณเป็น AI ตรวจสอบสลิปโอนเงินธนาคารไทย อ่านข้อมูลจากรูปสลิปแล้วตอบกลับเป็น JSON เท่านั้น
ห้ามอธิบาย ตอบ JSON เพียงอย่างเดียว:
{"amount": ยอดเงินที่โอน(ตัวเลข), "senderBank": "ชื่อธนาคารผู้โอน", "receiverName": "ชื่อผู้รับเงิน", "ref": "เลขอ้างอิง/transaction ID", "date": "วันที่โอน dd/mm/yyyy", "time": "เวลาโอน HH:mm", "confidence": "high/medium/low"}
ถ้าอ่านไม่ได้ ให้ตอบ {"amount": 0, "senderBank": "", "receiverName": "", "ref": "", "date": "", "time": "", "confidence": "low"}`
            },
            {
              role: "user",
              content: [
                { type: "text", text: `กรุณาอ่านสลิปโอนเงินนี้ ยอดที่ต้องชำระคือ ${expectedAmount.toLocaleString()} บาท${configAccountName ? ` ชื่อบัญชีผู้รับควรเป็น "${configAccountName}"` : ""}` },
                { type: "image_url", image_url: { url: slipImageUrl } },
              ]
            }
          ],
        });

        const aiText = response.choices[0]?.message?.content || "";
        const jsonMatch = aiText.match(/\{[\s\S]*\}/);

        if (jsonMatch) {
          let parsed: any;
          try { parsed = JSON.parse(jsonMatch[0]); } catch { parsed = null; }

          if (parsed) {
            const slipAmount = Number(parsed.amount) || 0;
            const tolerance = expectedAmount * 0.02;
            const amountMatch = Math.abs(slipAmount - expectedAmount) <= tolerance;
            const nameMatch = configAccountName
              ? (parsed.receiverName || "").toLowerCase().includes(configAccountName.toLowerCase().substring(0, 6))
              : true;
            const isVerified = amountMatch && nameMatch && parsed.confidence !== "low";

            if (isVerified) {
              const plan = await storage.getSubscriptionPlan(order.planId);
              const now = new Date();
              const existingSub = await storage.getTenantSubscription(order.tenantId);
              const baseDate = (existingSub?.endDate && new Date(existingSub.endDate) > now) ? new Date(existingSub.endDate) : now;
              const endDate = new Date(baseDate);
              if (order.billingCycle === "yearly") { endDate.setFullYear(endDate.getFullYear() + 1); }
              else { endDate.setMonth(endDate.getMonth() + 1); }

              if (existingSub) {
                await storage.updateTenantSubscription(existingSub.id, { planId: order.planId, billingCycle: order.billingCycle, status: "active", startDate: existingSub.startDate || now, endDate });
              } else {
                await storage.createTenantSubscription({ tenantId: order.tenantId, planId: order.planId, billingCycle: order.billingCycle, status: "active", startDate: now, endDate });
              }
              const invoiceNumber = await storage.getNextInvoiceNumber();
              await storage.updateSubscriptionPaymentOrder(order.id, {
                status: "confirmed", confirmedAt: now, invoiceNumber,
                notes: `AI ตรวจสลิปอัตโนมัติ — ยอด: ฿${slipAmount.toLocaleString()} / Ref: ${parsed.ref || "-"} / ผู้รับ: ${parsed.receiverName || "-"} / ความเชื่อมั่น: ${parsed.confidence}`,
              });
              console.log(`[AI Slip] Order #${order.id} AUTO-APPROVED — amount: ${slipAmount}, ref: ${parsed.ref}, confidence: ${parsed.confidence}`);
              let tivResult = null;
              try { tivResult = await createSubscriptionTaxInvoice(order.id); } catch (e) {}
              return res.json({ slipUploaded: true, aiVerified: true, message: "ตรวจสลิปผ่าน! แพ็คเกจเปิดใช้งานแล้ว", aiResult: { amount: slipAmount, receiverName: parsed.receiverName, ref: parsed.ref, confidence: parsed.confidence }, taxInvoice: tivResult });
            } else {
              const reason = !amountMatch ? `ยอดไม่ตรง (สลิป: ฿${slipAmount.toLocaleString()} / ต้องชำระ: ฿${expectedAmount.toLocaleString()})` : !nameMatch ? "ชื่อผู้รับไม่ตรง" : `ความเชื่อมั่นต่ำ (${parsed.confidence})`;
              await storage.updateSubscriptionPaymentOrder(order.id, { notes: `AI ตรวจสลิป — ${reason}` });
              console.log(`[AI Slip] Order #${order.id} NEEDS_REVIEW — ${reason}`);
              return res.json({ slipUploaded: true, aiVerified: false, message: `AI ตรวจสลิปไม่ผ่าน (${reason}) — รอแอดมินตรวจสอบ` });
            }
          }
        }
        console.log(`[AI Slip] Order #${order.id} — AI could not parse response, sending to manual review`);
        return res.json({ slipUploaded: true, aiVerified: false, message: "AI อ่านสลิปไม่สำเร็จ — รอแอดมินตรวจสอบ" });
      } catch (aiErr: any) {
        console.error(`[AI Slip] Order #${order.id} error:`, aiErr.message);
        return res.json({ slipUploaded: true, aiVerified: false, message: "ส่งสลิปสำเร็จ — รอแอดมินตรวจสอบ" });
      }
    }

    const updated = await storage.getSubscriptionPaymentOrder(order.id);
    res.json({ slipUploaded: true, aiVerified: false, message: "ส่งสลิปสำเร็จ — รอแอดมินตรวจสอบ" });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/subscription/my-payments", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    if (!user.tenantId) return res.json([]);
    const orders = await storage.getSubscriptionPaymentOrdersByTenant(user.tenantId);
    const plans = await storage.getSubscriptionPlans();
    const enriched = orders.map(o => ({
      ...o,
      plan: plans.find((p: any) => p.id === o.planId),
    }));
    res.json(enriched);
  } catch (err: any) {
    res.json([]);
  }
});

app.get("/api/admin/subscription-addons", requireAuth, requireSuperAdmin, async (_req, res) => {
  try {
    const addons = await db.select().from(subscriptionAddons).orderBy(asc(subscriptionAddons.sortOrder));
    res.json(addons);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/admin/subscription-addons", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { code, name, nameEn, description, monthlyPrice, yearlyPrice, featureFlag, icon, active, sortOrder } = req.body;
    if (!code || !name) return res.status(400).json({ message: "กรุณาระบุรหัสและชื่อ Add-on" });
    const [addon] = await db.insert(subscriptionAddons).values({
      code, name, nameEn: nameEn || null, description: description || null,
      monthlyPrice: monthlyPrice || "0", yearlyPrice: yearlyPrice || null,
      featureFlag: featureFlag || "", icon: icon || null,
      active: active !== false, sortOrder: sortOrder || 0,
    }).returning();
    res.json(addon);
  } catch (err: any) {
    if (err.code === "23505") return res.status(400).json({ message: "รหัส Add-on ซ้ำ" });
    res.status(500).json({ message: err.message });
  }
});

app.patch("/api/admin/subscription-addons/:id", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { code, createdAt, id: _, ...data } = req.body;
    const [addon] = await db.update(subscriptionAddons).set(data).where(eq(subscriptionAddons.id, id)).returning();
    if (!addon) return res.status(404).json({ message: "ไม่พบ Add-on" });
    res.json(addon);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/admin/subscription-payments", requireAuth, requireAdmin, async (req, res) => {
  try {
    const statusFilter = req.query.status as string | undefined;
    const orders = await storage.getAllSubscriptionPaymentOrders(statusFilter || undefined);
    res.json(orders);
  } catch (err: any) {
    res.json([]);
  }
});

app.post("/api/admin/subscription-payments/:id/confirm", requireAuth, requireAdmin, async (req, res) => {
  try {
    const order = await storage.getSubscriptionPaymentOrder(Number(req.params.id));
    if (!order) return res.status(404).json({ message: "ไม่พบรายการ" });
    if (order.status === "confirmed") return res.status(400).json({ message: "รายการนี้ยืนยันแล้ว" });

    const user = req.user as any;
    const invoiceNumber = await storage.getNextInvoiceNumber();

    const plan = await storage.getSubscriptionPlan(order.planId);
    const now = new Date();
    const existingSub = await storage.getTenantSubscription(order.tenantId);

    const baseDate = (existingSub?.endDate && new Date(existingSub.endDate) > now)
      ? new Date(existingSub.endDate)
      : now;
    const endDate = new Date(baseDate);
    if (order.billingCycle === "yearly") {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }

    if (existingSub) {
      await storage.updateTenantSubscription(existingSub.id, {
        planId: order.planId,
        billingCycle: order.billingCycle,
        status: "active",
        startDate: existingSub.startDate || now,
        endDate,
      });
    } else {
      await storage.createTenantSubscription({
        tenantId: order.tenantId,
        planId: order.planId,
        billingCycle: order.billingCycle,
        status: "active",
        startDate: now,
        endDate,
      });
    }

    const updated = await storage.updateSubscriptionPaymentOrder(order.id, {
      status: "confirmed",
      confirmedByUserId: user.id,
      confirmedAt: now,
      invoiceNumber,
      notes: req.body.notes || null,
    });

    let tivResult = null;
    try {
      tivResult = await createSubscriptionTaxInvoice(order.id);
    } catch (e) {
      console.error(`[Sub Payment] Tax invoice creation failed for order #${order.id}:`, (e as Error).message);
    }

    res.json({ order: updated, invoiceNumber, plan, taxInvoice: tivResult });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/admin/subscription-payments/:id/reject", requireAuth, requireAdmin, async (req, res) => {
  try {
    const order = await storage.getSubscriptionPaymentOrder(Number(req.params.id));
    if (!order) return res.status(404).json({ message: "ไม่พบรายการ" });

    const updated = await storage.updateSubscriptionPaymentOrder(order.id, {
      status: "rejected",
      notes: req.body.notes || "ปฏิเสธการชำระเงิน",
    });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/admin/system-config", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const { pool } = await import("./db");
    const result = await pool.query(
      `SELECT id, config_key, config_value, description, environment, is_secret, updated_at FROM system_config ORDER BY config_key`
    );
    const rows = result.rows.map((r: any) => ({
      ...r,
      config_value: r.is_secret ? "••••••••" : r.config_value,
    }));
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.put("/api/admin/system-config/:key", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { setConfig } = await import("./config-bootstrap");
    const { value, description, isSecret, environment } = req.body;
    if (value === undefined) return res.status(400).json({ message: "value is required" });
    const ok = await setConfig(req.params.key, value, description, isSecret, environment);
    if (!ok) return res.status(500).json({ message: "Failed to update config" });
    res.json({ message: "ok" });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/admin/system-config", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { setConfig } = await import("./config-bootstrap");
    const { key, value, description, isSecret, environment } = req.body;
    if (!key || value === undefined) return res.status(400).json({ message: "key and value are required" });
    const ok = await setConfig(key, value, description, isSecret ?? false, environment ?? "all");
    if (!ok) return res.status(500).json({ message: "Failed to create config" });
    res.json({ message: "ok" });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.delete("/api/admin/system-config/:key", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { pool } = await import("./db");
    await pool.query(`DELETE FROM system_config WHERE config_key = $1`, [req.params.key]);
    res.json({ message: "ok" });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/admin/force-migrate-coa", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const { migrateChartOfAccountCodes } = await import("./index");
    await migrateChartOfAccountCodes();
    res.json({ message: "COA migration completed successfully" });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ===== Platform Payment Config (SuperAdmin) =====
app.get("/api/platform/payment-config", requireAuth, requireSuperAdmin, async (_req, res) => {
  try {
    res.json({
      promptpayId: getConfig("PLATFORM_PROMPTPAY_ID") || "",
      accountName: getConfig("PLATFORM_ACCOUNT_NAME") || "",
      bankName: getConfig("PLATFORM_BANK_NAME") || "",
      aiAutoVerify: getConfig("PLATFORM_AI_AUTO_VERIFY") !== "false",
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.put("/api/platform/payment-config", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { promptpayId, accountName, bankName, aiAutoVerify } = req.body;
    if (promptpayId !== undefined) await setConfig("PLATFORM_PROMPTPAY_ID", promptpayId, "PromptPay ID สำหรับรับชำระค่าแพ็คเกจ");
    if (accountName !== undefined) await setConfig("PLATFORM_ACCOUNT_NAME", accountName, "ชื่อบัญชีผู้รับเงิน");
    if (bankName !== undefined) await setConfig("PLATFORM_BANK_NAME", bankName, "ชื่อธนาคาร");
    if (aiAutoVerify !== undefined) await setConfig("PLATFORM_AI_AUTO_VERIFY", String(aiAutoVerify), "เปิด/ปิด AI ตรวจสลิปอัตโนมัติ");
    res.json({ message: "บันทึกการตั้งค่าสำเร็จ" });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/subscription/payment-config-public", requireAuth, async (_req, res) => {
  try {
    res.json({
      promptpayId: getConfig("PLATFORM_PROMPTPAY_ID") || "",
      accountName: getConfig("PLATFORM_ACCOUNT_NAME") || "",
      bankName: getConfig("PLATFORM_BANK_NAME") || "",
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ===== AI Slip Verification for Subscription Payments =====
app.post("/api/subscription/verify-slip/:id", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const order = await storage.getSubscriptionPaymentOrder(Number(req.params.id));
    if (!order) return res.status(404).json({ message: "ไม่พบรายการชำระเงิน" });
    if (order.tenantId !== user.tenantId) return res.status(403).json({ message: "ไม่มีสิทธิ์" });
    if (!order.slipImageUrl) return res.status(400).json({ message: "ยังไม่ได้แนบสลิป" });
    if (order.status === "confirmed") return res.status(400).json({ message: "รายการนี้ยืนยันแล้ว" });

    const aiAutoVerify = getConfig("PLATFORM_AI_AUTO_VERIFY") !== "false";
    if (!aiAutoVerify) {
      return res.json({ status: "pending", message: "รอแอดมินตรวจสอบ", aiResult: null });
    }

    const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.json({ status: "pending", message: "ระบบ AI ไม่พร้อมใช้งาน รอแอดมินตรวจสอบ", aiResult: null });
    }

    const openai = new OpenAI({
      apiKey,
      ...(process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ? { baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL } : {}),
    });

    const expectedAmount = parseFloat(String(order.amount)) + parseFloat(String(order.setupFeeAmount || "0"));
    const configAccountName = getConfig("PLATFORM_ACCOUNT_NAME") || "";

    const slipImage = order.slipImageUrl;
    const isBase64 = slipImage.startsWith("data:");
    const imageContent = isBase64
      ? { type: "image_url" as const, image_url: { url: slipImage } }
      : { type: "image_url" as const, image_url: { url: slipImage } };

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 1024,
      messages: [
        {
          role: "system",
          content: `คุณเป็น AI ตรวจสอบสลิปโอนเงินธนาคารไทย อ่านข้อมูลจากรูปสลิปแล้วตอบกลับเป็น JSON เท่านั้น
ห้ามอธิบาย ตอบ JSON เพียงอย่างเดียว:
{"amount": ยอดเงินที่โอน(ตัวเลข), "senderBank": "ชื่อธนาคารผู้โอน", "receiverName": "ชื่อผู้รับเงิน", "ref": "เลขอ้างอิง/transaction ID", "date": "วันที่โอน dd/mm/yyyy", "time": "เวลาโอน HH:mm", "confidence": "high/medium/low"}
ถ้าอ่านไม่ได้ ให้ตอบ {"amount": 0, "senderBank": "", "receiverName": "", "ref": "", "date": "", "time": "", "confidence": "low"}`
        },
        {
          role: "user",
          content: [
            { type: "text", text: `กรุณาอ่านสลิปโอนเงินนี้ ยอดที่ต้องชำระคือ ${expectedAmount.toLocaleString()} บาท${configAccountName ? ` ชื่อบัญชีผู้รับควรเป็น "${configAccountName}"` : ""}` },
            imageContent,
          ]
        }
      ],
    });

    const aiText = response.choices[0]?.message?.content || "";
    const jsonMatch = aiText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return res.json({ status: "pending", message: "AI อ่านสลิปไม่สำเร็จ รอแอดมินตรวจสอบ", aiResult: null });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const slipAmount = Number(parsed.amount) || 0;
    const tolerance = expectedAmount * 0.02;
    const amountMatch = Math.abs(slipAmount - expectedAmount) <= tolerance;

    const nameMatch = configAccountName
      ? (parsed.receiverName || "").toLowerCase().includes(configAccountName.toLowerCase().substring(0, 6))
      : true;

    const isVerified = amountMatch && nameMatch && parsed.confidence !== "low";

    const aiResult = {
      amount: slipAmount,
      expectedAmount,
      senderBank: parsed.senderBank || "",
      receiverName: parsed.receiverName || "",
      ref: parsed.ref || "",
      date: parsed.date || "",
      time: parsed.time || "",
      confidence: parsed.confidence || "unknown",
      amountMatch,
      nameMatch,
      verified: isVerified,
    };

    if (isVerified) {
      const plan = await storage.getSubscriptionPlan(order.planId);
      const now = new Date();
      const existingSub = await storage.getTenantSubscription(order.tenantId);

      const baseDate = (existingSub?.endDate && new Date(existingSub.endDate) > now)
        ? new Date(existingSub.endDate) : now;
      const endDate = new Date(baseDate);
      if (order.billingCycle === "yearly") {
        endDate.setFullYear(endDate.getFullYear() + 1);
      } else {
        endDate.setMonth(endDate.getMonth() + 1);
      }

      if (existingSub) {
        await storage.updateTenantSubscription(existingSub.id, {
          planId: order.planId,
          billingCycle: order.billingCycle,
          status: "active",
          startDate: existingSub.startDate || now,
          endDate,
        });
      } else {
        await storage.createTenantSubscription({
          tenantId: order.tenantId,
          planId: order.planId,
          billingCycle: order.billingCycle,
          status: "active",
          startDate: now,
          endDate,
        });
      }

      const invoiceNumber = await storage.getNextInvoiceNumber();
      await storage.updateSubscriptionPaymentOrder(order.id, {
        status: "confirmed",
        confirmedAt: now,
        invoiceNumber,
        notes: `AI ตรวจสลิปอัตโนมัติ — ยอด: ฿${slipAmount.toLocaleString()} / Ref: ${parsed.ref || "-"} / ผู้รับ: ${parsed.receiverName || "-"} / ความเชื่อมั่น: ${parsed.confidence}`,
      });

      console.log(`[AI Slip] Order #${order.id} AUTO-APPROVED — amount: ${slipAmount}, ref: ${parsed.ref}, confidence: ${parsed.confidence}`);
      let tivResult = null;
      try { tivResult = await createSubscriptionTaxInvoice(order.id); } catch (e) {}
      return res.json({ status: "confirmed", message: "ตรวจสลิปผ่าน! แพ็คเกจเปิดใช้งานแล้ว", aiResult, taxInvoice: tivResult });
    }

    await storage.updateSubscriptionPaymentOrder(order.id, {
      notes: `AI ตรวจสลิป — ${!amountMatch ? `ยอดไม่ตรง (สลิป: ฿${slipAmount.toLocaleString()} / ต้องชำระ: ฿${expectedAmount.toLocaleString()})` : ""}${!nameMatch ? ` ชื่อผู้รับไม่ตรง` : ""} ความเชื่อมั่น: ${parsed.confidence}`,
    });

    console.log(`[AI Slip] Order #${order.id} NEEDS_REVIEW — amount: ${slipAmount} vs ${expectedAmount}, nameMatch: ${nameMatch}, confidence: ${parsed.confidence}`);
    return res.json({
      status: "needs_review",
      message: `AI ตรวจสลิปไม่ผ่าน${!amountMatch ? " (ยอดไม่ตรง)" : ""}${!nameMatch ? " (ชื่อผู้รับไม่ตรง)" : ""} — รอแอดมินตรวจสอบ`,
      aiResult,
    });
  } catch (err: any) {
    console.error("[AI Slip] Error:", err.message);
    res.status(500).json({ message: "ตรวจสลิปไม่สำเร็จ: " + err.message });
  }
});

app.get("/api/subscription/tax-invoice/:orderId/pdf", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const order = await storage.getSubscriptionPaymentOrder(Number(req.params.orderId));
    if (!order) return res.status(404).json({ message: "ไม่พบรายการ" });
    if (user.role !== "super_admin" && order.tenantId !== user.tenantId) return res.status(403).json({ message: "ไม่มีสิทธิ์" });
    if (!order.taxInvoiceId) return res.status(404).json({ message: "ยังไม่มีใบกำกับภาษี" });

    const [tiv] = await db.select().from(taxInvoices).where(eq(taxInvoices.id, order.taxInvoiceId));
    if (!tiv) return res.status(404).json({ message: "ไม่พบใบกำกับภาษี" });

    const items = await db.select().from(taxInvoiceItems).where(eq(taxInvoiceItems.taxInvoiceId, tiv.id));
    const [issuer] = await db.select().from(companies).where(eq(companies.id, PLATFORM_COMPANY_ID));

    const subtotal = parseFloat(String(tiv.subtotal || "0"));
    const vatAmt = parseFloat(String(tiv.vatAmount || "0"));
    const total = parseFloat(String(tiv.totalAmount || "0"));

    const docDate = tiv.taxInvoiceDate ? new Date(tiv.taxInvoiceDate) : new Date();
    const thaiDate = `${docDate.getDate()}/${docDate.getMonth() + 1}/${docDate.getFullYear() + 543}`;

    const itemRows = items.map((item, i) => `
      <tr>
        <td style="text-align:center;padding:6px 8px;border-bottom:1px solid #eee">${i + 1}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee">${item.productName}</td>
        <td style="text-align:center;padding:6px 8px;border-bottom:1px solid #eee">${item.qty}</td>
        <td style="text-align:center;padding:6px 8px;border-bottom:1px solid #eee">${item.unit || "บริการ"}</td>
        <td style="text-align:right;padding:6px 8px;border-bottom:1px solid #eee">${Number(item.unitPrice).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
        <td style="text-align:right;padding:6px 8px;border-bottom:1px solid #eee">${Number(item.total).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
      </tr>
    `).join("");

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>ใบกำกับภาษี ${tiv.taxInvoiceNo}</title>
<style>
  @page { size: A4; margin: 15mm; }
  body { font-family: 'Sarabun', 'Noto Sans Thai', sans-serif; font-size: 13px; color: #333; margin: 0; padding: 20px; }
  .header { display: flex; justify-content: space-between; margin-bottom: 20px; border-bottom: 3px solid #fb9678; padding-bottom: 15px; }
  .title { font-size: 22px; font-weight: bold; color: #fb9678; text-align: center; margin: 15px 0; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; }
  .info-box { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; }
  .info-box h4 { margin: 0 0 8px; font-size: 12px; color: #888; text-transform: uppercase; }
  .info-box p { margin: 2px 0; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  th { background: #f9fafb; padding: 8px; text-align: left; font-weight: 600; border-bottom: 2px solid #e5e7eb; font-size: 12px; }
  .summary { text-align: right; margin-top: 10px; }
  .summary-row { display: flex; justify-content: flex-end; gap: 30px; padding: 4px 0; }
  .summary-total { font-size: 18px; font-weight: bold; color: #fb9678; border-top: 2px solid #fb9678; padding-top: 8px; margin-top: 8px; }
  @media print { body { padding: 0; } button { display: none !important; } }
</style></head><body>
<button onclick="window.print()" style="position:fixed;top:10px;right:10px;padding:8px 20px;background:#fb9678;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px;z-index:100">🖨️ พิมพ์</button>
<div class="title">ใบกำกับภาษี / Tax Invoice</div>
<div style="text-align:center;margin-bottom:5px;font-size:12px;color:#666">เลขที่: ${tiv.taxInvoiceNo} | วันที่: ${thaiDate}</div>
<div class="info-grid">
  <div class="info-box">
    <h4>ผู้ออก (Issuer)</h4>
    <p style="font-weight:600">${issuer?.name || "บริษัท อี แท็กซ์ เซ็นเตอร์ (ประเทศไทย) จำกัด"}</p>
    <p>${issuer?.address || ""}</p>
    <p>เลขประจำตัวผู้เสียภาษี: ${issuer?.taxId || ""}</p>
    <p>โทร: ${issuer?.phone || ""}</p>
  </div>
  <div class="info-box">
    <h4>ผู้ซื้อ (Buyer)</h4>
    <p style="font-weight:600">${tiv.customerName || ""}</p>
    <p>${tiv.customerAddress || ""}</p>
    ${tiv.customerTaxId ? `<p>เลขประจำตัวผู้เสียภาษี: ${tiv.customerTaxId}</p>` : ""}
    ${tiv.branch ? `<p>สาขา: ${tiv.branch}</p>` : ""}
  </div>
</div>
<table>
  <thead><tr>
    <th style="text-align:center;width:40px">ลำดับ</th>
    <th>รายการ</th>
    <th style="text-align:center;width:60px">จำนวน</th>
    <th style="text-align:center;width:60px">หน่วย</th>
    <th style="text-align:right;width:100px">ราคา/หน่วย</th>
    <th style="text-align:right;width:100px">จำนวนเงิน</th>
  </tr></thead>
  <tbody>${itemRows}</tbody>
</table>
<div class="summary">
  <div class="summary-row"><span>ราคาก่อนภาษี:</span><span>${subtotal.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท</span></div>
  <div class="summary-row"><span>ภาษีมูลค่าเพิ่ม 7%:</span><span>${vatAmt.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท</span></div>
  <div class="summary-row summary-total"><span>รวมทั้งสิ้น:</span><span>${total.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท</span></div>
</div>
<div style="margin-top:40px;text-align:center;color:#aaa;font-size:11px">เอกสารฉบับนี้ออกโดยระบบ E-Tax Center</div>
</body></html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/seed-plans", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const existing = await storage.getSubscriptionPlans();
    const existingCodes = existing.map((p: any) => p.code);
    const plans = [
      {
        code: "general-starter", name: "Starter", nameEn: "Starter", targetGroup: "general",
        description: "เริ่มต้นใช้งานฟรี สำหรับธุรกิจขนาดเล็ก", setupFee: "0",
        monthlyPrice: "0", yearlyPrice: "0",
        maxUsers: 2, maxDocumentsPerMonth: 50, maxCompanies: 1, maxBranches: 1,
        maxEcommerceConnections: 0, maxProducts: 100,
        features: ["ออกใบกำกับภาษี", "รายงานภาษี", "บัญชีแยกประเภท", "งบทดลอง"],
        hasAiFeatures: false, hasHrModule: false, hasPosModule: false, hasApiAccess: false, hasWhiteLabel: false, hasFirmModule: false,
        active: true, sortOrder: 1,
      },
      {
        code: "general-business", name: "Business Pro", nameEn: "Business Pro", targetGroup: "general",
        description: "สำหรับธุรกิจที่เติบโต ฟีเจอร์ครบครัน", setupFee: "0",
        monthlyPrice: "990", yearlyPrice: "9900",
        maxUsers: 10, maxDocumentsPerMonth: 1000, maxCompanies: 3, maxBranches: 3,
        maxEcommerceConnections: 0, maxProducts: 500,
        features: ["ออกใบกำกับภาษี", "รายงานภาษี", "บัญชีแยกประเภท", "งบทดลอง", "งบกำไรขาดทุน", "งบดุล", "ระบบ HR", "POS"],
        hasAiFeatures: false, hasHrModule: true, hasPosModule: true, hasApiAccess: false, hasWhiteLabel: false, hasFirmModule: false,
        active: true, sortOrder: 2,
      },
      {
        code: "general-plus", name: "Business Plus", nameEn: "Business Plus", targetGroup: "general",
        description: "สำหรับธุรกิจขนาดกลาง-ใหญ่ ครบทุกฟีเจอร์", setupFee: "0",
        monthlyPrice: "1490", yearlyPrice: "14900",
        maxUsers: 30, maxDocumentsPerMonth: 5000, maxCompanies: 10, maxBranches: 10,
        maxEcommerceConnections: 0, maxProducts: 5000,
        features: ["ออกใบกำกับภาษี", "รายงานภาษี", "งบการเงินครบ", "ระบบ HR", "POS", "AI ตรวจสลิป", "API เชื่อมต่อ"],
        hasAiFeatures: true, hasHrModule: true, hasPosModule: true, hasApiAccess: true, hasWhiteLabel: false, hasFirmModule: false,
        active: true, sortOrder: 3,
      },
      {
        code: "ecom-lite", name: "eTax Lite", nameEn: "eTax Lite", targetGroup: "ecommerce",
        description: "สำหรับร้านค้าออนไลน์เริ่มต้น ออกใบกำกับภาษีอัตโนมัติ", setupFee: "0",
        monthlyPrice: "390", yearlyPrice: "3900",
        maxUsers: 3, maxDocumentsPerMonth: 500, maxCompanies: 1, maxBranches: 1,
        maxEcommerceConnections: 2, maxProducts: 500,
        features: ["เชื่อมต่อ Shopee/Lazada", "ออกใบกำกับภาษีอัตโนมัติ", "รายงาน ภ.พ.30", "นำเข้าออเดอร์จาก Excel"],
        hasAiFeatures: false, hasHrModule: false, hasPosModule: false, hasApiAccess: false, hasWhiteLabel: false, hasFirmModule: false,
        active: true, sortOrder: 4,
      },
      {
        code: "ecom-hub", name: "E-Commerce Hub", nameEn: "E-Commerce Hub", targetGroup: "ecommerce",
        description: "ศูนย์กลางจัดการร้านค้าออนไลน์ ครบวงจร", setupFee: "1500",
        monthlyPrice: "590", yearlyPrice: "5900",
        maxUsers: 5, maxDocumentsPerMonth: 2000, maxCompanies: 3, maxBranches: 3,
        maxEcommerceConnections: 5, maxProducts: 5000,
        features: ["เชื่อมต่อ Shopee/Lazada/TikTok", "ออกใบกำกับภาษีอัตโนมัติ", "คลังสินค้า/Stock Sync", "รายงาน Settlement", "Delivery Hub", "LINE แจ้งเตือน"],
        hasAiFeatures: false, hasHrModule: false, hasPosModule: false, hasApiAccess: true, hasWhiteLabel: false, hasFirmModule: false,
        active: true, sortOrder: 5,
      },
      {
        code: "ecom-pro", name: "E-Commerce Pro", nameEn: "E-Commerce Pro", targetGroup: "ecommerce",
        description: "สำหรับผู้ค้าออนไลน์มืออาชีพ ครบทุกเครื่องมือ", setupFee: "3000",
        monthlyPrice: "1490", yearlyPrice: "14900",
        maxUsers: 20, maxDocumentsPerMonth: 10000, maxCompanies: 10, maxBranches: 10,
        maxEcommerceConnections: 20, maxProducts: 50000,
        features: ["ทุกฟีเจอร์ E-Commerce Hub", "Live Selling", "Chat Order + AI", "Warehouse Bin Location", "Wave Picking", "Store Clone", "AI Analytics"],
        hasAiFeatures: true, hasHrModule: true, hasPosModule: true, hasApiAccess: true, hasWhiteLabel: false, hasFirmModule: false,
        active: true, sortOrder: 6,
      },
      {
        code: "firm-starter", name: "Firm Starter", nameEn: "Firm Starter", targetGroup: "firm",
        description: "สำหรับสำนักงานบัญชีขนาดเล็ก", setupFee: "0",
        monthlyPrice: "1490", yearlyPrice: "14900",
        maxUsers: 5, maxDocumentsPerMonth: 2000, maxCompanies: 20, maxBranches: 1,
        maxEcommerceConnections: 0, maxProducts: 100,
        features: ["จัดการลูกค้าสำนักงาน", "ออกใบกำกับภาษี", "งบการเงินครบ", "นำเข้ารายชื่อลูกค้า", "แดชบอร์ดภาพรวม"],
        hasAiFeatures: false, hasHrModule: false, hasPosModule: false, hasApiAccess: false, hasWhiteLabel: false, hasFirmModule: true,
        active: true, sortOrder: 7,
      },
      {
        code: "firm-pro", name: "Firm Pro", nameEn: "Firm Pro", targetGroup: "firm",
        description: "สำหรับสำนักงานบัญชีขนาดกลาง ฟีเจอร์ครบ", setupFee: "5000",
        monthlyPrice: "2990", yearlyPrice: "29900",
        maxUsers: 20, maxDocumentsPerMonth: 10000, maxCompanies: 100, maxBranches: 5,
        maxEcommerceConnections: 5, maxProducts: 1000,
        features: ["ทุกฟีเจอร์ Firm Starter", "ระบบ HR/เงินเดือน", "E-Commerce Hub", "สัญญาบริการออนไลน์", "White Label"],
        hasAiFeatures: true, hasHrModule: true, hasPosModule: true, hasApiAccess: true, hasWhiteLabel: true, hasFirmModule: true,
        active: true, sortOrder: 8,
      },
      {
        code: "firm-enterprise", name: "Firm Enterprise", nameEn: "Firm Enterprise", targetGroup: "firm",
        description: "สำหรับสำนักงานบัญชีขนาดใหญ่ ไม่จำกัด", setupFee: "10000",
        monthlyPrice: "4990", yearlyPrice: "49900",
        maxUsers: 999, maxDocumentsPerMonth: 999999, maxCompanies: 999, maxBranches: 999,
        maxEcommerceConnections: 999, maxProducts: 999999,
        features: ["ทุกฟีเจอร์ Firm Pro", "ไม่จำกัดบริษัท", "ไม่จำกัดผู้ใช้", "API เชื่อมต่อ", "AI Analytics", "Support ลำดับแรก"],
        hasAiFeatures: true, hasHrModule: true, hasPosModule: true, hasApiAccess: true, hasWhiteLabel: true, hasFirmModule: true,
        active: true, sortOrder: 9,
      },
    ];
    const created = [];
    const toCreate = plans.filter((p: any) => !existingCodes.includes(p.code));
    if (toCreate.length === 0) {
      return res.json({ message: "แพ็คเกจมีครบแล้ว", plans: existing, added: 0 });
    }
    for (const p of toCreate) {
      const plan = await storage.createSubscriptionPlan(p as any);
      created.push(plan);
    }
    res.status(201).json({ message: `เพิ่ม ${created.length} แพ็คเกจสำเร็จ`, plans: [...existing, ...created], added: created.length });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/module-plans", async (_req, res) => {
  try {
    const plans = await db.select().from(modulePlans)
      .where(eq(modulePlans.active, true))
      .orderBy(modulePlans.moduleKey, modulePlans.sortOrder);
    res.json(plans);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.get("/api/my-modules", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    if (!user.tenantId) return res.json({ subscriptions: [], plans: [] });

    const subs = await db.select({
      id: tenantModuleSubscriptions.id,
      tenantId: tenantModuleSubscriptions.tenantId,
      moduleKey: tenantModuleSubscriptions.moduleKey,
      modulePlanId: tenantModuleSubscriptions.modulePlanId,
      tier: tenantModuleSubscriptions.tier,
      status: tenantModuleSubscriptions.status,
      billingCycle: tenantModuleSubscriptions.billingCycle,
      startDate: tenantModuleSubscriptions.startDate,
      endDate: tenantModuleSubscriptions.endDate,
      trialEndsAt: tenantModuleSubscriptions.trialEndsAt,
      autoRenew: tenantModuleSubscriptions.autoRenew,
      planName: modulePlans.name,
      monthlyPrice: modulePlans.monthlyPrice,
      yearlyPrice: modulePlans.yearlyPrice,
      maxUsers: modulePlans.maxUsers,
      maxDocuments: modulePlans.maxDocuments,
      features: modulePlans.features,
    }).from(tenantModuleSubscriptions)
      .leftJoin(modulePlans, eq(tenantModuleSubscriptions.modulePlanId, modulePlans.id))
      .where(eq(tenantModuleSubscriptions.tenantId, user.tenantId))
      .orderBy(tenantModuleSubscriptions.moduleKey);

    const now = new Date();
    const enriched = subs.map(s => {
      const endDate = s.endDate ? new Date(s.endDate) : null;
      const trialEnd = s.trialEndsAt ? new Date(s.trialEndsAt) : null;
      let daysRemaining: number | null = null;
      let isExpiring = false;

      if (s.status === "trial" && trialEnd) {
        daysRemaining = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / 86400000));
        isExpiring = daysRemaining <= 5;
      } else if (endDate) {
        daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / 86400000));
        isExpiring = daysRemaining <= 7;
      }

      return { ...s, daysRemaining, isExpiring };
    });

    const allPlans = await db.select().from(modulePlans)
      .where(eq(modulePlans.active, true))
      .orderBy(modulePlans.moduleKey, modulePlans.sortOrder);

    res.json({ subscriptions: enriched, plans: allPlans });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post("/api/my-modules/subscribe", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    if (!user.tenantId) return res.status(400).json({ message: "ไม่พบ tenant" });
    if (!["admin", "manager", "super_admin"].includes(user.role)) {
      return res.status(403).json({ message: "เฉพาะผู้ดูแลระบบเท่านั้น" });
    }

    const { modulePlanId, billingCycle } = req.body;
    if (!modulePlanId) return res.status(400).json({ message: "กรุณาเลือกแพ็คเกจ" });

    const safeBilling = billingCycle === "yearly" ? "yearly" : "monthly";

    const [plan] = await db.select().from(modulePlans).where(eq(modulePlans.id, Number(modulePlanId)));
    if (!plan || !plan.active) return res.status(404).json({ message: "ไม่พบแพ็คเกจ" });

    const now = new Date();
    const isFree = Number(plan.monthlyPrice) === 0;

    const [existing] = await db.select().from(tenantModuleSubscriptions)
      .where(and(
        eq(tenantModuleSubscriptions.tenantId, user.tenantId),
        eq(tenantModuleSubscriptions.moduleKey, plan.moduleKey),
      ));

    if (existing) {
      const hadTrial = existing.trialEndsAt !== null;
      const [updated] = await db.update(tenantModuleSubscriptions).set({
        modulePlanId: plan.id,
        tier: plan.tier,
        status: isFree ? "active" : (hadTrial ? existing.status : "trial"),
        billingCycle: safeBilling,
        trialEndsAt: isFree ? null : (hadTrial ? existing.trialEndsAt : new Date(now.getTime() + 15 * 86400000)),
        updatedAt: now,
      }).where(eq(tenantModuleSubscriptions.id, existing.id)).returning();
      return res.json({ ...updated, planName: plan.name });
    }

    const trialEnd = isFree ? null : new Date(now.getTime() + 15 * 86400000);

    const [sub] = await db.insert(tenantModuleSubscriptions).values({
      tenantId: user.tenantId,
      moduleKey: plan.moduleKey,
      modulePlanId: plan.id,
      tier: plan.tier,
      status: isFree ? "active" : "trial",
      billingCycle: safeBilling,
      startDate: now,
      trialEndsAt: trialEnd,
      autoRenew: true,
    }).returning();

    res.status(201).json({ ...sub, planName: plan.name });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

}
