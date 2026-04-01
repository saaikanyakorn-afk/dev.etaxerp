import type { Express, Request, Response } from "express";
import { db } from "../db";
import { ecomDb } from "../ecom-db";
import { eq, desc, and, asc, inArray, gte } from "drizzle-orm";
import { liveAgencyClients, budgets } from "@shared/schema";
import { requireAuth, checkDocOwnership } from "../route-middleware";

export function registerLiveAgencyRoutes(app: Express) {
// ============= AI LIVE COMMERCE AGENCY =============

// Agency Clients CRUD
app.get("/api/live-agency/clients", requireAuth, async (req, res) => {
  try {
    const companyId = Number(req.query.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId is required" });
    const clients = await db.select().from(liveAgencyClients)
      .where(eq(liveAgencyClients.companyId, companyId))
      .orderBy(desc(liveAgencyClients.createdAt));
    res.json(clients);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post("/api/live-agency/clients", requireAuth, async (req, res) => {
  try {
    const parsed = insertLiveAgencyClientSchema.parse(req.body);
    const [client] = await db.insert(liveAgencyClients).values(parsed).returning();
    res.json(client);
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

app.put("/api/live-agency/clients/:id", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const companyId = Number(req.query.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId is required" });
    const [existing] = await db.select().from(liveAgencyClients).where(eq(liveAgencyClients.id, id));
    if (!existing) return res.status(404).json({ message: "ไม่พบลูกค้า Agency" });
    { const ac = await checkDocOwnership(existing.companyId, req.user); if (!ac.allowed) return res.status(403).json({ message: ac.message }); }
    if (existing.companyId !== companyId) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });
    const [updated] = await db.update(liveAgencyClients).set(req.body).where(eq(liveAgencyClients.id, id)).returning();
    res.json(updated);
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

app.delete("/api/live-agency/clients/:id", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const companyId = Number(req.query.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId is required" });
    const [existing] = await db.select().from(liveAgencyClients).where(eq(liveAgencyClients.id, id));
    if (!existing) return res.status(404).json({ message: "ไม่พบลูกค้า Agency" });
    { const ac = await checkDocOwnership(existing.companyId, req.user); if (!ac.allowed) return res.status(403).json({ message: ac.message }); }
    if (existing.companyId !== companyId) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });
    await db.delete(liveAgencyClients).where(eq(liveAgencyClients.id, id));
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Live Session Dashboard
app.get("/api/live-agency/sessions", requireAuth, async (req, res) => {
  try {
    const companyId = Number(req.query.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId is required" });
    const agencyClientId = req.query.agencyClientId ? Number(req.query.agencyClientId) : undefined;
    const conditions = [eq(liveSessions.companyId, companyId)];
    if (agencyClientId) {
      conditions.push(eq(liveSessions.agencyClientId, agencyClientId));
    }
    const sessions = await ecomDb.select().from(liveSessions)
      .where(and(...conditions))
      .orderBy(desc(liveSessions.createdAt));
    res.json(sessions);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.get("/api/live-agency/sessions/:id/dashboard", requireAuth, async (req, res) => {
  try {
    const sessionId = Number(req.params.id);
    const companyId = Number(req.query.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId is required" });
    const [session] = await ecomDb.select().from(liveSessions).where(eq(liveSessions.id, sessionId));
    if (!session) return res.status(404).json({ message: "ไม่พบเซสชัน" });
    if (session.companyId !== companyId) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });
    const metrics = await db.select().from(liveSessionMetrics)
      .where(eq(liveSessionMetrics.sessionId, sessionId))
      .orderBy(desc(liveSessionMetrics.capturedAt));
    const orders = await db.select().from(liveCfOrders)
      .where(eq(liveCfOrders.sessionId, sessionId))
      .orderBy(desc(liveCfOrders.createdAt));
    const aidaActions = await db.select().from(liveAidaActions)
      .where(eq(liveAidaActions.sessionId, sessionId))
      .orderBy(desc(liveAidaActions.createdAt));
    const adBudgets = await db.select().from(liveAdBudgets)
      .where(eq(liveAdBudgets.sessionId, sessionId))
      .orderBy(desc(liveAdBudgets.createdAt));
    res.json({ session, metrics, orders, aidaActions, adBudgets });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post("/api/live-agency/sessions/:id/metrics", requireAuth, async (req, res) => {
  try {
    const sessionId = Number(req.params.id);
    const companyId = Number(req.query.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId is required" });
    const [session] = await ecomDb.select().from(liveSessions).where(eq(liveSessions.id, sessionId));
    if (!session) return res.status(404).json({ message: "ไม่พบเซสชัน" });
    if (session.companyId !== companyId) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });
    const parsed = insertLiveSessionMetricSchema.parse({ ...req.body, sessionId });
    const [metric] = await db.insert(liveSessionMetrics).values(parsed).returning();
    res.json(metric);
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

// AIDA Actions
app.get("/api/live-agency/sessions/:id/aida-actions", requireAuth, async (req, res) => {
  try {
    const sessionId = Number(req.params.id);
    const companyId = Number(req.query.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId is required" });
    const [session] = await ecomDb.select().from(liveSessions).where(eq(liveSessions.id, sessionId));
    if (!session) return res.status(404).json({ message: "ไม่พบเซสชัน" });
    if (session.companyId !== companyId) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });
    const actions = await db.select().from(liveAidaActions)
      .where(eq(liveAidaActions.sessionId, sessionId))
      .orderBy(desc(liveAidaActions.createdAt));
    res.json(actions);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post("/api/live-agency/sessions/:id/aida-actions", requireAuth, async (req, res) => {
  try {
    const sessionId = Number(req.params.id);
    const companyId = Number(req.query.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId is required" });
    const [session] = await ecomDb.select().from(liveSessions).where(eq(liveSessions.id, sessionId));
    if (!session) return res.status(404).json({ message: "ไม่พบเซสชัน" });
    if (session.companyId !== companyId) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });
    const parsed = insertLiveAidaActionSchema.parse({ ...req.body, sessionId });
    const [action] = await db.insert(liveAidaActions).values(parsed).returning();
    res.json(action);
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

app.patch("/api/live-agency/sessions/:id/aida-actions/:actionId", requireAuth, async (req, res) => {
  try {
    const sessionId = Number(req.params.id);
    const companyId = Number(req.query.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId is required" });
    const [session] = await ecomDb.select().from(liveSessions).where(eq(liveSessions.id, sessionId));
    if (!session) return res.status(404).json({ message: "ไม่พบเซสชัน" });
    if (session.companyId !== companyId) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });
    const actionId = Number(req.params.actionId);
    const [existing] = await db.select().from(liveAidaActions).where(eq(liveAidaActions.id, actionId));
    if (!existing) return res.status(404).json({ message: "ไม่พบ AIDA action" });
    { const ac = await checkDocOwnership(existing.companyId, req.user); if (!ac.allowed) return res.status(403).json({ message: ac.message }); }
    const user = req.user as any;
    const updateData: any = { status: req.body.status };
    if (req.body.status === "applied") {
      updateData.appliedAt = new Date();
      updateData.appliedBy = user.id;
    }
    const [updated] = await db.update(liveAidaActions).set(updateData).where(eq(liveAidaActions.id, actionId)).returning();
    res.json(updated);
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

// Ad Budget
app.get("/api/live-agency/sessions/:id/ad-budgets", requireAuth, async (req, res) => {
  try {
    const sessionId = Number(req.params.id);
    const companyId = Number(req.query.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId is required" });
    const [session] = await ecomDb.select().from(liveSessions).where(eq(liveSessions.id, sessionId));
    if (!session) return res.status(404).json({ message: "ไม่พบเซสชัน" });
    if (session.companyId !== companyId) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });
    const budgets = await db.select().from(liveAdBudgets)
      .where(eq(liveAdBudgets.sessionId, sessionId))
      .orderBy(desc(liveAdBudgets.createdAt));
    res.json(budgets);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post("/api/live-agency/sessions/:id/ad-budgets", requireAuth, async (req, res) => {
  try {
    const sessionId = Number(req.params.id);
    const companyId = Number(req.query.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId is required" });
    const [session] = await ecomDb.select().from(liveSessions).where(eq(liveSessions.id, sessionId));
    if (!session) return res.status(404).json({ message: "ไม่พบเซสชัน" });
    if (session.companyId !== companyId) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });
    const parsed = insertLiveAdBudgetSchema.parse({ ...req.body, sessionId });
    const [budget] = await db.insert(liveAdBudgets).values(parsed).returning();
    res.json(budget);
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

// Reports
app.get("/api/live-agency/sessions/:id/report", requireAuth, async (req, res) => {
  try {
    const sessionId = Number(req.params.id);
    const companyId = Number(req.query.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId is required" });
    const [session] = await ecomDb.select().from(liveSessions).where(eq(liveSessions.id, sessionId));
    if (!session) return res.status(404).json({ message: "ไม่พบเซสชัน" });
    if (session.companyId !== companyId) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });
    const [report] = await db.select().from(liveSessionReports)
      .where(eq(liveSessionReports.sessionId, sessionId));
    if (!report) return res.status(404).json({ message: "ยังไม่มีรายงาน" });
    res.json(report);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post("/api/live-agency/sessions/:id/report", requireAuth, async (req, res) => {
  try {
    const sessionId = Number(req.params.id);
    const companyId = Number(req.query.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId is required" });
    const [session] = await ecomDb.select().from(liveSessions).where(eq(liveSessions.id, sessionId));
    if (!session) return res.status(404).json({ message: "ไม่พบเซสชัน" });
    if (session.companyId !== companyId) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });

    const orders = await db.select().from(liveCfOrders)
      .where(eq(liveCfOrders.sessionId, sessionId));
    const totalOrders = orders.length;
    const paidOrders = orders.filter(o => o.status === "paid" || o.status === "shipped" || o.status === "delivered");
    const totalRevenue = orders.reduce((s, o) => s + parseFloat(o.totalAmount || "0"), 0);

    const orderIds = orders.map(o => o.id);
    let items: any[] = [];
    if (orderIds.length > 0) {
      items = await db.select().from(liveCfItems).where(inArray(liveCfItems.cfOrderId, orderIds));
    }

    const sessionProducts = await ecomDb.select().from(liveSessionProducts)
      .where(eq(liveSessionProducts.sessionId, sessionId));

    const productSales: Record<string, { name: string; qty: number; revenue: number }> = {};
    for (const item of items) {
      const sp = sessionProducts.find(p => p.productId === item.productId);
      const name = sp?.name || `Product ${item.productId}`;
      if (!productSales[item.productId]) {
        productSales[item.productId] = { name, qty: 0, revenue: 0 };
      }
      productSales[item.productId].qty += parseFloat(item.qty || "0");
      productSales[item.productId].revenue += parseFloat(item.total || "0");
    }
    const topProducts = Object.values(productSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    const metrics = await db.select().from(liveSessionMetrics)
      .where(eq(liveSessionMetrics.sessionId, sessionId))
      .orderBy(desc(liveSessionMetrics.capturedAt));
    const peakViewers = metrics.reduce((max, m) => Math.max(max, m.peakViewers || 0), 0);
    const avgViewers = metrics.length > 0
      ? Math.round(metrics.reduce((s, m) => s + (m.viewers || 0), 0) / metrics.length)
      : 0;
    const totalAdSpend = metrics.reduce((s, m) => s + parseFloat(m.adSpend || "0"), 0);

    const roas = totalAdSpend > 0 ? parseFloat((totalRevenue / totalAdSpend).toFixed(2)) : 0;
    const conversionRate = peakViewers > 0 ? parseFloat(((paidOrders.length / peakViewers) * 100).toFixed(2)) : 0;

    let duration = 0;
    if (session.startedAt && session.endedAt) {
      duration = Math.round((new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / 60000);
    }

    let serviceFee = 0;
    if (session.agencyClientId) {
      const [client] = await db.select().from(liveAgencyClients)
        .where(eq(liveAgencyClients.id, session.agencyClientId));
      if (client) {
        if (client.feeModel === "percent") {
          serviceFee = totalRevenue * (parseFloat(client.feeRate || "0") / 100);
        } else {
          serviceFee = parseFloat(client.feeFixedAmount || "0");
        }
      }
    }

    const totalProfit = totalRevenue - totalAdSpend - serviceFee;
    const aiSummary = `สรุปผลไลฟ์: ยอดขาย ${totalRevenue.toLocaleString()} บาท จาก ${totalOrders} ออเดอร์ (ชำระแล้ว ${paidOrders.length}) ผู้ชมสูงสุด ${peakViewers} คน ROAS ${roas}x ค่าโฆษณา ${totalAdSpend.toLocaleString()} บาท`;

    const [existingReport] = await db.select().from(liveSessionReports)
      .where(eq(liveSessionReports.sessionId, sessionId));

    const reportData = {
      sessionId,
      companyId: session.companyId,
      agencyClientId: session.agencyClientId,
      duration,
      peakViewers,
      avgViewers,
      totalOrders,
      totalRevenue: totalRevenue.toFixed(2),
      totalProfit: totalProfit.toFixed(2),
      totalAdSpend: totalAdSpend.toFixed(2),
      roas: roas.toFixed(2),
      conversionRate: conversionRate.toFixed(2),
      topProducts: JSON.stringify(topProducts),
      serviceFee: serviceFee.toFixed(2),
      aiSummary,
      aiRecommendations: req.body.aiRecommendations || null,
      comparisonJson: req.body.comparisonJson || null,
    };

    let report;
    if (existingReport) {
      [report] = await db.update(liveSessionReports).set(reportData)
        .where(eq(liveSessionReports.id, existingReport.id)).returning();
    } else {
      [report] = await db.insert(liveSessionReports).values(reportData).returning();
    }

    await ecomDb.update(liveSessions).set({ postReportSent: true }).where(eq(liveSessions.id, sessionId));

    res.json(report);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Planning - Calendar
app.get("/api/live-agency/calendar", requireAuth, async (req, res) => {
  try {
    const companyId = Number(req.query.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId is required" });
    const now = new Date();
    const sessions = await ecomDb.select().from(liveSessions)
      .where(and(
        eq(liveSessions.companyId, companyId),
        gte(liveSessions.scheduledAt, now)
      ))
      .orderBy(asc(liveSessions.scheduledAt));
    res.json(sessions);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Planning - Send pre-live LINE notification
app.post("/api/live-agency/sessions/:id/notify", requireAuth, async (req, res) => {
  try {
    const sessionId = Number(req.params.id);
    const companyId = Number(req.query.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId is required" });
    const [session] = await ecomDb.select().from(liveSessions).where(eq(liveSessions.id, sessionId));
    if (!session) return res.status(404).json({ message: "ไม่พบเซสชัน" });
    if (session.companyId !== companyId) return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });
    await ecomDb.update(liveSessions).set({ preNotifySent: true }).where(eq(liveSessions.id, sessionId));
    res.json({ success: true, message: "ส่งแจ้งเตือนเรียบร้อย" });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

}
