import type { Express } from "express";
import { db } from "../db";
import { eq, desc, and } from "drizzle-orm";
import { supplierPortalTokens, contacts, supplierQuotes, supplierQuoteItems, purchaseOrders } from "@shared/schema";
import { createRouteGroup, badRequest, notFound } from "../route-factory";
import crypto from "crypto";

export function registerSupplierPortalRoutes(app: Express) {

const r = createRouteGroup(app, { module: "ecommerce" });

r.companyRoute("get", "/api/ecommerce/supplier-portal/tokens", async ({ companyId }) => {
  return db.select().from(supplierPortalTokens).where(eq(supplierPortalTokens.companyId, companyId));
});

r.companyRoute("post", "/api/ecommerce/supplier-portal/tokens", async ({ companyId, req }) => {
  const { contactId, email, expiresAt } = req.body;
  if (!contactId) badRequest("contactId required");
  const token = crypto.randomBytes(32).toString("hex");
  const [created] = await db.insert(supplierPortalTokens).values({
    companyId, contactId, token, email: email || null,
    expiresAt: expiresAt ? new Date(expiresAt) : null,
  }).returning();
  return created;
});

r.companyRoute("delete", "/api/ecommerce/supplier-portal/tokens/:id", async ({ companyId, req }) => {
  const id = Number(req.params.id);
  await db.update(supplierPortalTokens).set({ isActive: false })
    .where(and(eq(supplierPortalTokens.id, id), eq(supplierPortalTokens.companyId, companyId)));
  return { success: true };
});

r.companyRoute("get", "/api/ecommerce/supplier-portal/quotes", async ({ companyId }) => {
  return db.select().from(supplierQuotes).where(eq(supplierQuotes.companyId, companyId)).orderBy(desc(supplierQuotes.createdAt));
});

r.companyRoute("get", "/api/ecommerce/supplier-portal/quotes/:id", async ({ companyId, req }) => {
  const id = Number(req.params.id);
  const [quote] = await db.select().from(supplierQuotes).where(and(eq(supplierQuotes.id, id), eq(supplierQuotes.companyId, companyId)));
  if (!quote) notFound("Quote not found");
  const items = await db.select().from(supplierQuoteItems).where(eq(supplierQuoteItems.quoteId, id));
  return { ...quote, items };
});

r.companyRoute("put", "/api/ecommerce/supplier-portal/quotes/:id/review", async ({ companyId, user, req }) => {
  const id = Number(req.params.id);
  const { status, notes } = req.body;
  const [quote] = await db.update(supplierQuotes).set({ status, notes, reviewedAt: new Date(), reviewedBy: user.id })
    .where(and(eq(supplierQuotes.id, id), eq(supplierQuotes.companyId, companyId))).returning();
  return quote;
});

app.get("/api/supplier-portal/:token", async (req, res) => {
  try {
    const token = req.params.token;
    const [portalToken] = await db.select().from(supplierPortalTokens).where(and(eq(supplierPortalTokens.token, token), eq(supplierPortalTokens.isActive, true)));
    if (!portalToken) return res.status(404).json({ message: "Invalid or expired token" });
    if (portalToken.expiresAt && new Date(portalToken.expiresAt) < new Date()) return res.status(401).json({ message: "Token expired" });
    await db.update(supplierPortalTokens).set({ lastAccessAt: new Date() }).where(eq(supplierPortalTokens.id, portalToken.id));
    const [supplier] = await db.select().from(contacts).where(eq(contacts.id, portalToken.contactId));
    const pos = await db.select().from(purchaseOrders).where(and(eq(purchaseOrders.companyId, portalToken.companyId), eq(purchaseOrders.vendorId, portalToken.contactId)));
    res.json({ supplier, purchaseOrders: pos });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post("/api/supplier-portal/:token/quotes", async (req, res) => {
  try {
    const token = req.params.token;
    const [portalToken] = await db.select().from(supplierPortalTokens).where(and(eq(supplierPortalTokens.token, token), eq(supplierPortalTokens.isActive, true)));
    if (!portalToken) return res.status(404).json({ message: "Invalid or expired token" });
    if (portalToken.expiresAt && new Date(portalToken.expiresAt) < new Date()) return res.status(401).json({ message: "Token expired" });
    const { poId, items, notes, totalAmount, validUntil } = req.body;
    const existingQuotes = await db.select().from(supplierQuotes).where(eq(supplierQuotes.companyId, portalToken.companyId)).orderBy(desc(supplierQuotes.createdAt));
    const quoteNo = `SQ-${String(existingQuotes.length + 1).padStart(5, "0")}`;
    const [quote] = await db.insert(supplierQuotes).values({
      companyId: portalToken.companyId, contactId: portalToken.contactId,
      poId: poId || null, quoteNo, status: "pending",
      totalAmount: totalAmount || null, notes: notes || null,
      validUntil: validUntil ? new Date(validUntil) : null, submittedAt: new Date(),
    }).returning();
    if (items && Array.isArray(items)) {
      for (const item of items) {
        await db.insert(supplierQuoteItems).values({
          quoteId: quote.id, productId: item.productId || null,
          productName: item.productName, sku: item.sku || null,
          qty: item.qty || 1, unitPrice: item.unitPrice || null,
          totalPrice: item.totalPrice || null, leadTimeDays: item.leadTimeDays || null,
          notes: item.notes || null,
        });
      }
    }
    res.json(quote);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

}
