import type { Express, Request, Response } from "express";
import { db } from "../db";
import { eq, desc, and, or, asc, ilike, inArray, count, sum , sql } from "drizzle-orm";
import { companies, ecommerceOrders } from "@shared/schema";
import { requireAuth, checkDocOwnership } from "../route-middleware";

export function registerCrmRoutes(app: Express) {
// ==================== CRM CUSTOMERS ====================
app.get("/api/crm/customers", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const companyId = Number(req.query.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId is required" });
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
    if (!company || (company.tenantId && user.tenantId && company.tenantId !== user.tenantId)) {
      return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });
    }
    const search = req.query.search as string | undefined;
    const tag = req.query.tag as string | undefined;
    const sortBy = (req.query.sortBy as string) || "totalSpend";
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Number(req.query.offset) || 0;

    const conditions: any[] = [eq(customers.companyId, companyId)];
    if (search) {
      conditions.push(or(
        ilike(customers.name, `%${search}%`),
        ilike(customers.phone, `%${search}%`),
        ilike(customers.email, `%${search}%`)
      ));
    }
    if (tag) {
      conditions.push(sql`${tag} = ANY(${customers.tags})`);
    }

    const whereClause = and(...conditions);
    const [countResult] = await db.select({ count: sql<number>`count(*)::int` }).from(customers).where(whereClause);

    let orderByClause;
    switch (sortBy) {
      case "orderCount": orderByClause = desc(customers.orderCount); break;
      case "lastOrderDate": orderByClause = desc(customers.lastOrderDate); break;
      case "name": orderByClause = asc(customers.name); break;
      default: orderByClause = desc(customers.totalSpend);
    }

    const list = await db.select().from(customers).where(whereClause).orderBy(orderByClause).limit(limit).offset(offset);
    res.json({ customers: list, total: countResult?.count || 0 });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.get("/api/crm/customers/:id", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const customerId = Number(req.params.id);
    const [customer] = await db.select().from(customers).where(eq(customers.id, customerId));
    if (!customer) return res.status(404).json({ message: "ไม่พบลูกค้า" });
    const [company] = await db.select().from(companies).where(eq(companies.id, customer.companyId));
    if (!company || (company.tenantId && user.tenantId && company.tenantId !== user.tenantId)) {
      return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });
    }

    const orderConditions: any[] = [
      eq(ecommerceOrders.companyId, customer.companyId),
      ilike(ecommerceOrders.customerName, `%${customer.name}%`),
    ];
    if (customer.phone) {
      orderConditions[1] = or(
        ilike(ecommerceOrders.customerName, `%${customer.name}%`),
        ilike(ecommerceOrders.customerPhone, `%${customer.phone}%`)
      );
    }

    const orders = await db.select().from(ecommerceOrders)
      .where(and(...orderConditions))
      .orderBy(desc(ecommerceOrders.orderDate))
      .limit(50);

    res.json({ customer, orders });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post("/api/crm/customers", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const data = insertCustomerSchema.parse({ ...req.body, tenantId: user.tenantId });
    const [company] = await db.select().from(companies).where(eq(companies.id, data.companyId));
    if (!company || (company.tenantId && user.tenantId && company.tenantId !== user.tenantId)) {
      return res.status(403).json({ message: "ไม่มีสิทธิ์" });
    }
    const [created] = await db.insert(customers).values(data).returning();
    res.json(created);
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

app.put("/api/crm/customers/:id", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const customerId = Number(req.params.id);
    const [existing] = await db.select().from(customers).where(eq(customers.id, customerId));
    if (!existing) return res.status(404).json({ message: "ไม่พบลูกค้า" });
    { const ac = await checkDocOwnership(existing.companyId, req.user); if (!ac.allowed) return res.status(403).json({ message: ac.message }); }
    const [company] = await db.select().from(companies).where(eq(companies.id, existing.companyId));
    if (!company || (company.tenantId && user.tenantId && company.tenantId !== user.tenantId)) {
      return res.status(403).json({ message: "ไม่มีสิทธิ์" });
    }
    const { companyId, tenantId, ...updateData } = req.body;
    const [updated] = await db.update(customers).set(updateData).where(eq(customers.id, customerId)).returning();
    res.json(updated);
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

app.delete("/api/crm/customers/:id", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const customerId = Number(req.params.id);
    const [existing] = await db.select().from(customers).where(eq(customers.id, customerId));
    if (!existing) return res.status(404).json({ message: "ไม่พบลูกค้า" });
    { const ac = await checkDocOwnership(existing.companyId, req.user); if (!ac.allowed) return res.status(403).json({ message: ac.message }); }
    const [company] = await db.select().from(companies).where(eq(companies.id, existing.companyId));
    if (!company || (company.tenantId && user.tenantId && company.tenantId !== user.tenantId)) {
      return res.status(403).json({ message: "ไม่มีสิทธิ์" });
    }
    await db.delete(customers).where(eq(customers.id, customerId));
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post("/api/crm/customers/:id/tags", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const customerId = Number(req.params.id);
    const { tags } = req.body;
    const [existing] = await db.select().from(customers).where(eq(customers.id, customerId));
    if (!existing) return res.status(404).json({ message: "ไม่พบลูกค้า" });
    { const ac = await checkDocOwnership(existing.companyId, req.user); if (!ac.allowed) return res.status(403).json({ message: ac.message }); }
    const [company] = await db.select().from(companies).where(eq(companies.id, existing.companyId));
    if (!company || (company.tenantId && user.tenantId && company.tenantId !== user.tenantId)) {
      return res.status(403).json({ message: "ไม่มีสิทธิ์" });
    }
    const [updated] = await db.update(customers).set({ tags: tags || [] }).where(eq(customers.id, customerId)).returning();
    res.json(updated);
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

app.get("/api/crm/tags", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const companyId = Number(req.query.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId is required" });
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
    if (!company || (company.tenantId && user.tenantId && company.tenantId !== user.tenantId)) {
      return res.status(403).json({ message: "ไม่มีสิทธิ์" });
    }
    const result = await db.select({ tag: sql<string>`unnest(${customers.tags})` }).from(customers).where(eq(customers.companyId, companyId));
    const uniqueTags = [...new Set(result.map(r => r.tag))].filter(Boolean);
    res.json(uniqueTags);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.get("/api/crm/summary", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const companyId = Number(req.query.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId is required" });
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
    if (!company || (company.tenantId && user.tenantId && company.tenantId !== user.tenantId)) {
      return res.status(403).json({ message: "ไม่มีสิทธิ์" });
    }
    const [stats] = await db.select({
      totalCustomers: sql<number>`count(*)::int`,
      totalRevenue: sql<string>`COALESCE(sum(${customers.totalSpend}::numeric), 0)`,
      avgOrderValue: sql<string>`COALESCE(avg(${customers.averageOrderValue}::numeric), 0)`,
      totalOrders: sql<number>`COALESCE(sum(${customers.orderCount}), 0)::int`,
    }).from(customers).where(eq(customers.companyId, companyId));
    const vipCount = await db.select({ count: sql<number>`count(*)::int` }).from(customers)
      .where(and(eq(customers.companyId, companyId), sql`'VIP' = ANY(${customers.tags})`));
    res.json({ ...stats, vipCustomers: vipCount[0]?.count || 0 });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post("/api/crm/sync-from-orders", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const companyId = Number(req.body.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId is required" });
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
    if (!company || (company.tenantId && user.tenantId && company.tenantId !== user.tenantId)) {
      return res.status(403).json({ message: "ไม่มีสิทธิ์" });
    }

    const orders = await db.select().from(ecommerceOrders).where(eq(ecommerceOrders.companyId, companyId));
    const customerMap = new Map<string, { name: string; phone: string | null; email: string | null; platform: string | null; totalSpend: number; orderCount: number; lastOrderDate: Date | null }>();

    for (const order of orders) {
      const key = (order.customerName || "").trim().toLowerCase();
      if (!key) continue;
      const existing = customerMap.get(key);
      const orderTotal = parseFloat(String(order.totalAmount || "0"));
      const orderDate = order.orderDate ? new Date(order.orderDate) : null;

      if (existing) {
        existing.totalSpend += orderTotal;
        existing.orderCount += 1;
        if (orderDate && (!existing.lastOrderDate || orderDate > existing.lastOrderDate)) {
          existing.lastOrderDate = orderDate;
        }
        if (!existing.phone && order.customerPhone) existing.phone = order.customerPhone;
        if (!existing.email && order.customerEmail) existing.email = order.customerEmail;
      } else {
        customerMap.set(key, {
          name: order.customerName || key,
          phone: order.customerPhone,
          email: order.customerEmail,
          platform: order.platform,
          totalSpend: orderTotal,
          orderCount: 1,
          lastOrderDate: orderDate,
        });
      }
    }

    let created = 0;
    let updated = 0;
    for (const [, data] of customerMap) {
      const avg = data.orderCount > 0 ? data.totalSpend / data.orderCount : 0;
      const [existingCustomer] = await db.select().from(customers)
        .where(and(eq(customers.companyId, companyId), ilike(customers.name, data.name)));

      if (existingCustomer) {
        await db.update(customers).set({
          totalSpend: String(data.totalSpend),
          orderCount: data.orderCount,
          averageOrderValue: String(avg.toFixed(2)),
          lastOrderDate: data.lastOrderDate,
          phone: data.phone || existingCustomer.phone,
          email: data.email || existingCustomer.email,
        }).where(eq(customers.id, existingCustomer.id));
        updated++;
      } else {
        await db.insert(customers).values({
          companyId,
          tenantId: user.tenantId,
          name: data.name,
          phone: data.phone,
          email: data.email,
          platform: data.platform,
          totalSpend: String(data.totalSpend),
          orderCount: data.orderCount,
          averageOrderValue: String(avg.toFixed(2)),
          lastOrderDate: data.lastOrderDate,
        });
        created++;
      }
    }
    res.json({ created, updated, total: customerMap.size });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post("/api/crm/send-line", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const { customerIds, message, companyId } = req.body;
    if (!companyId || !customerIds?.length || !message) {
      return res.status(400).json({ message: "customerIds, message, companyId required" });
    }
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
    if (!company || (company.tenantId && user.tenantId && company.tenantId !== user.tenantId)) {
      return res.status(403).json({ message: "ไม่มีสิทธิ์" });
    }

    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!token) return res.status(400).json({ message: "LINE Channel Access Token ยังไม่ได้ตั้งค่า" });

    const targetCustomers = await db.select().from(customers)
      .where(and(eq(customers.companyId, companyId), inArray(customers.id, customerIds)));

    const lineUserIds = targetCustomers.map(c => c.lineUserId).filter(Boolean);
    if (lineUserIds.length === 0) {
      return res.status(400).json({ message: "ไม่พบลูกค้าที่มี LINE User ID" });
    }

    let sent = 0;
    let failed = 0;
    for (const lineUserId of lineUserIds) {
      try {
        const resp = await fetch("https://api.line.me/v2/bot/message/push", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ to: lineUserId, messages: [{ type: "text", text: message }] }),
        });
        if (resp.ok) sent++;
        else failed++;
      } catch { failed++; }
    }
    res.json({ sent, failed, total: lineUserIds.length });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

}
