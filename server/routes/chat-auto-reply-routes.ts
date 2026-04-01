import type { Express, Request, Response } from "express";
import { db } from "../db";
import { eq, and, asc } from "drizzle-orm";
import { requireAuth, requireModule, checkDocOwnership } from "../route-middleware";

export function registerChatAutoReplyRoutes(app: Express) {
// ========== Chat Auto-Reply Rules ==========

app.get("/api/ecommerce/chat/auto-rules", requireAuth, requireModule("ecommerce"), async (req, res) => {
  try {
    const companyId = Number(req.query.companyId || req.body.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId required" });
    const rules = await db.select().from(chatAutoRules).where(eq(chatAutoRules.companyId, companyId)).orderBy(asc(chatAutoRules.priority));
    res.json(rules);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post("/api/ecommerce/chat/auto-rules", requireAuth, requireModule("ecommerce"), async (req, res) => {
  try {
    const companyId = Number(req.query.companyId || req.body.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId required" });
    const data = insertChatAutoRuleSchema.parse({ ...req.body, companyId });
    const [rule] = await db.insert(chatAutoRules).values(data).returning();
    res.json(rule);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.put("/api/ecommerce/chat/auto-rules/:id", requireAuth, requireModule("ecommerce"), async (req, res) => {
  try {
    const companyId = Number(req.query.companyId || req.body.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId required" });
    const id = Number(req.params.id);
    const [rule] = await db.update(chatAutoRules).set({ ...req.body, updatedAt: new Date() }).where(and(eq(chatAutoRules.id, id), eq(chatAutoRules.companyId, companyId))).returning();
    res.json(rule);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.delete("/api/ecommerce/chat/auto-rules/:id", requireAuth, requireModule("ecommerce"), async (req, res) => {
  try {
    const companyId = Number(req.query.companyId || req.body.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId required" });
    const id = Number(req.params.id);
    await db.delete(chatAutoRules).where(and(eq(chatAutoRules.id, id), eq(chatAutoRules.companyId, companyId)));
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post("/api/ecommerce/chat/auto-rules/:id/toggle", requireAuth, requireModule("ecommerce"), async (req, res) => {
  try {
    const companyId = Number(req.query.companyId || req.body.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId required" });
    const id = Number(req.params.id);
    const [existing] = await db.select().from(chatAutoRules).where(and(eq(chatAutoRules.id, id), eq(chatAutoRules.companyId, companyId)));
    if (!existing) return res.status(404).json({ message: "Rule not found" });
    { const ac = await checkDocOwnership(existing.companyId, req.user); if (!ac.allowed) return res.status(403).json({ message: ac.message }); }
    const [rule] = await db.update(chatAutoRules).set({ isActive: !existing.isActive, updatedAt: new Date() }).where(eq(chatAutoRules.id, id)).returning();
    res.json(rule);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.get("/api/ecommerce/chat/review-replies", requireAuth, requireModule("ecommerce"), async (req, res) => {
  try {
    const companyId = Number(req.query.companyId || req.body.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId required" });
    const replies = await db.select().from(reviewAutoReplies).where(eq(reviewAutoReplies.companyId, companyId));
    res.json(replies);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post("/api/ecommerce/chat/review-replies", requireAuth, requireModule("ecommerce"), async (req, res) => {
  try {
    const companyId = Number(req.query.companyId || req.body.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId required" });
    const data = insertReviewAutoReplySchema.parse({ ...req.body, companyId });
    const [reply] = await db.insert(reviewAutoReplies).values(data).returning();
    res.json(reply);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.put("/api/ecommerce/chat/review-replies/:id", requireAuth, requireModule("ecommerce"), async (req, res) => {
  try {
    const companyId = Number(req.query.companyId || req.body.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId required" });
    const id = Number(req.params.id);
    const [reply] = await db.update(reviewAutoReplies).set(req.body).where(and(eq(reviewAutoReplies.id, id), eq(reviewAutoReplies.companyId, companyId))).returning();
    res.json(reply);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.delete("/api/ecommerce/chat/review-replies/:id", requireAuth, requireModule("ecommerce"), async (req, res) => {
  try {
    const companyId = Number(req.query.companyId || req.body.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId required" });
    const id = Number(req.params.id);
    await db.delete(reviewAutoReplies).where(and(eq(reviewAutoReplies.id, id), eq(reviewAutoReplies.companyId, companyId)));
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

}
