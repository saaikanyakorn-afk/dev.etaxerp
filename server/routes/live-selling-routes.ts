import type { Express } from "express";
import { db } from "../db";
import { ecomDb } from "../ecom-db";
import { storage } from "../storage";
import { eq, and, desc, asc, sql, count, inArray, not, sum, gte, lte } from "drizzle-orm";
import { liveCfOrders, liveCfItems, liveSessionProducts, products, companies, ecommerceOrders, ecommerceOrderItems, luckyDrawCampaigns, luckyDrawPrizes, luckyDrawEntries, insertLuckyDrawCampaignSchema, insertLuckyDrawPrizeSchema, insertLuckyDrawEntrySchema, ecommerceConnections, liveCommissionShifts, users } from "@shared/schema";
import { requireAuth, requireModule , checkDocOwnership} from "../route-middleware";
import multer from "multer";
// ═══════════════════════════════════════════════════════════════════════
// ⚠️ AI DEPENDENCY — OpenAI SDK (used for slip verification in live selling)
// This client is used for payment slip reading via GPT-4o-mini Vision.
// To disable ALL AI calls in live selling: set openai = null below.
// ═══════════════════════════════════════════════════════════════════════
import OpenAI from "openai";

const openai = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
      ...(process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ? { baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL } : {}),
    })
  : null;

export function registerLiveSellingRoutes(app: Express) {
  // ============ Live Selling ============

  app.get("/api/live/sessions", requireAuth, requireModule("ecommerce"), async (req, res) => {
    try {
      const companyId = Number(req.query.companyId);
      if (!companyId) return res.status(400).json({ message: "companyId required" });
      const sessions = await storage.getLiveSessions(companyId);
      res.json(sessions);
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  app.get("/api/live/sessions/:id", requireAuth, requireModule("ecommerce"), async (req, res) => {
    try {
      const session = await storage.getLiveSession(Number(req.params.id));
      if (!session) return res.status(404).json({ message: "ไม่พบเซสชัน" });
      res.json(session);
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  app.post("/api/live/sessions", requireAuth, requireModule("ecommerce"), async (req, res) => {
    try {
      const session = await storage.createLiveSession(req.body);
      res.status(201).json(session);
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  app.patch("/api/live/sessions/:id", requireAuth, requireModule("ecommerce"), async (req, res) => {
    try {
      const session = await storage.updateLiveSession(Number(req.params.id), req.body);
      if (!session) return res.status(404).json({ message: "ไม่พบเซสชัน" });
      res.json(session);
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  app.get("/api/live/sessions/:id/products", requireAuth, requireModule("ecommerce"), async (req, res) => {
    try {
      const products = await storage.getLiveSessionProducts(Number(req.params.id));
      res.json(products);
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  app.post("/api/live/sessions/:id/products", requireAuth, requireModule("ecommerce"), async (req, res) => {
    try {
      const product = await storage.createLiveSessionProduct({ ...req.body, sessionId: Number(req.params.id) });
      res.status(201).json(product);
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  app.patch("/api/live/session-products/:id", requireAuth, requireModule("ecommerce"), async (req, res) => {
    try {
      const product = await storage.updateLiveSessionProduct(Number(req.params.id), req.body);
      if (!product) return res.status(404).json({ message: "ไม่พบสินค้าในเซสชัน" });
      res.json(product);
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  app.delete("/api/live/session-products/:id", requireAuth, requireModule("ecommerce"), async (req, res) => {
    try {
      const deleted = await storage.deleteLiveSessionProduct(Number(req.params.id));
      if (!deleted) return res.status(404).json({ message: "ไม่พบสินค้าในเซสชัน" });
      res.json({ success: true });
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  app.get("/api/live/cf-orders", requireAuth, requireModule("ecommerce"), async (req, res) => {
    try {
      const companyId = Number(req.query.companyId);
      if (!companyId) return res.status(400).json({ message: "companyId required" });
      const sessionId = req.query.sessionId ? Number(req.query.sessionId) : undefined;
      const status = req.query.status ? String(req.query.status) : undefined;
      const orders = await storage.getLiveCfOrders(companyId, sessionId, status);
      res.json(orders);
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  app.get("/api/live/cf-orders/:id", requireAuth, requireModule("ecommerce"), async (req, res) => {
    try {
      const order = await storage.getLiveCfOrder(Number(req.params.id));
      if (!order) return res.status(404).json({ message: "ไม่พบออเดอร์ CF" });
      res.json(order);
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  app.post("/api/live/cf-orders", requireAuth, requireModule("ecommerce"), async (req, res) => {
    try {
      const order = await storage.createLiveCfOrder(req.body);
      res.status(201).json(order);
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  app.patch("/api/live/cf-orders/:id", requireAuth, requireModule("ecommerce"), async (req, res) => {
    try {
      const order = await storage.updateLiveCfOrder(Number(req.params.id), req.body);
      if (!order) return res.status(404).json({ message: "ไม่พบออเดอร์ CF" });
      res.json(order);
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  app.get("/api/live/cf-orders/:id/items", requireAuth, requireModule("ecommerce"), async (req, res) => {
    try {
      const items = await storage.getLiveCfItems(Number(req.params.id));
      res.json(items);
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  app.post("/api/live/cf-orders/:id/items", requireAuth, requireModule("ecommerce"), async (req, res) => {
    try {
      const item = await storage.createLiveCfItem({ ...req.body, cfOrderId: Number(req.params.id) });
      res.status(201).json(item);
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  app.get("/api/live/payments", requireAuth, requireModule("ecommerce"), async (req, res) => {
    try {
      const companyId = Number(req.query.companyId);
      if (!companyId) return res.status(400).json({ message: "companyId required" });
      const allCfOrders = await db.select().from(liveCfOrders).where(eq(liveCfOrders.companyId, companyId));
      const allPayments: any[] = [];
      for (const o of allCfOrders) {
        const payments = await db.select().from(livePayments).where(eq(livePayments.cfOrderId, o.id));
        for (const p of payments) {
          allPayments.push({ ...p, customerName: o.customerName, cfOrderStatus: o.status });
        }
      }
      allPayments.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      res.json(allPayments);
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  app.get("/api/live/payments/:cfOrderId", requireAuth, requireModule("ecommerce"), async (req, res) => {
    try {
      const payments = await storage.getLivePayments(Number(req.params.cfOrderId));
      res.json(payments);
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  app.post("/api/live/payments", requireAuth, requireModule("ecommerce"), async (req, res) => {
    try {
      const payment = await storage.createLivePayment(req.body);
      res.status(201).json(payment);
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  app.patch("/api/live/payments/:id", requireAuth, requireModule("ecommerce"), async (req, res) => {
    try {
      const payment = await storage.updateLivePayment(Number(req.params.id), req.body);
      if (!payment) return res.status(404).json({ message: "ไม่พบการชำระเงิน" });
      res.json(payment);
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  // Upload payment slip + AI auto-verify for Live CF orders
  const liveCfSlipUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
  app.post("/api/live/payments/:id/upload-slip", requireAuth, requireModule("ecommerce"), liveCfSlipUpload.single("slip"), async (req: any, res) => {
    try {
      const paymentId = Number(req.params.id);
      const user = req.user as any;

      const [payment] = await db.select().from(livePayments).where(eq(livePayments.id, paymentId));
      if (!payment) return res.status(404).json({ message: "ไม่พบรายการชำระเงิน" });

      const [cfOrder] = await db.select().from(liveCfOrders).where(eq(liveCfOrders.id, payment.cfOrderId));
      if (!cfOrder) return res.status(404).json({ message: "ไม่พบออเดอร์ CF" });

      const [company] = await db.select().from(companies).where(eq(companies.id, cfOrder.companyId));
      if (!company || (user.role !== "super_admin" && company.tenantId !== user.tenantId)) {
        return res.status(403).json({ message: "ไม่มีสิทธิ์" });
      }

      if (!req.file) return res.status(400).json({ message: "กรุณาอัพโหลดรูปสลิป" });

      const fileBuffer = req.file.buffer as Buffer;
      const base64Image = fileBuffer.toString("base64");
      const mimeType = req.file.mimetype || "image/jpeg";

      const { saveBufferLocally } = await import("../replit_integrations/object_storage/routes");
      const { objectPath } = saveBufferLocally(fileBuffer, mimeType, req.file.originalname);

      const orderAmount = Number(cfOrder.totalAmount) || 0;

      let aiResult: { amount: number; bank: string; ref: string; date: string; match: boolean; note: string } = {
        amount: 0, bank: "", ref: "", date: "", match: false, note: "ไม่สามารถอ่านสลิปได้"
      };

      // ⚠️ AI API CALL — Slip verification via GPT-4o-mini Vision (real cost per call)
      try {
        if (!openai) throw new Error("OpenAI API key not configured");
        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          max_tokens: 1024,
          messages: [
            {
              role: "system",
              content: `คุณเป็น AI ตรวจสอบสลิปโอนเงินธนาคารไทย อ่านข้อมูลจากรูปสลิปแล้วตอบกลับเป็น JSON เท่านั้น
ห้ามอธิบาย ตอบ JSON เพียงอย่างเดียว:
{"amount": ยอดเงินที่โอน(ตัวเลข), "bank": "ชื่อธนาคารผู้โอน", "ref": "เลขอ้างอิง/transaction ID", "date": "วันที่โอน dd/mm/yyyy", "confidence": "high/medium/low"}
ถ้าอ่านไม่ได้ ให้ตอบ {"amount": 0, "bank": "", "ref": "", "date": "", "confidence": "low"}`
            },
            {
              role: "user",
              content: [
                { type: "text", text: `กรุณาอ่านสลิปโอนเงินนี้ ยอดออเดอร์คือ ${orderAmount.toLocaleString()} บาท` },
                { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Image}` } }
              ]
            }
          ],
        });

        const aiText = response.choices[0]?.message?.content || "";
        const jsonMatch = aiText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          const slipAmount = Number(parsed.amount) || 0;
          const tolerance = orderAmount * 0.02;
          const amountMatch = Math.abs(slipAmount - orderAmount) <= tolerance;

          aiResult = {
            amount: slipAmount,
            bank: parsed.bank || "",
            ref: parsed.ref || "",
            date: parsed.date || "",
            match: amountMatch,
            note: amountMatch
              ? `ยอดตรงกัน (สลิป: ฿${slipAmount.toLocaleString()} / ออเดอร์: ฿${orderAmount.toLocaleString()})`
              : `ยอดไม่ตรง (สลิป: ฿${slipAmount.toLocaleString()} / ออเดอร์: ฿${orderAmount.toLocaleString()}) ความเชื่อมั่น: ${parsed.confidence || "unknown"}`,
          };
        }
      } catch (aiErr: any) {
        console.error("Live CF AI slip verification error:", aiErr.message);
        aiResult.note = `AI อ่านสลิปไม่สำเร็จ: ${aiErr.message}`;
      }

      const newVerificationStatus = aiResult.match ? "verified" : "needs_review";

      await db.update(livePayments).set({
        slipUrl: objectPath,
        verificationStatus: newVerificationStatus,
        verifiedAt: aiResult.match ? new Date() : null,
        bankName: aiResult.bank || payment.bankName,
        aiVerifyAmount: String(aiResult.amount),
        aiVerifyBank: aiResult.bank,
        aiVerifyRef: aiResult.ref,
        aiVerifyDate: aiResult.date,
        aiVerifyNote: aiResult.note,
      }).where(eq(livePayments.id, paymentId));

      let autoOrderResult: any = null;
      let autoTivResult: any = null;

      if (aiResult.match) {
        await db.update(liveCfOrders).set({ status: "paid" }).where(eq(liveCfOrders.id, cfOrder.id));

        try {
          const cfItems = await db.select().from(liveCfItems).where(eq(liveCfItems.cfOrderId, cfOrder.id));
          const session = await ecomDb.select().from(liveSessions).where(eq(liveSessions.id, cfOrder.sessionId)).then(r => r[0]);

          let [conn] = await ecomDb.select().from(ecommerceConnections)
            .where(and(eq(ecommerceConnections.companyId, cfOrder.companyId), eq(ecommerceConnections.platform, "live")));
          if (!conn) {
            [conn] = await ecomDb.insert(ecommerceConnections).values({
              companyId: cfOrder.companyId, platform: "live", shopName: "Live Selling", status: "connected",
            }).returning();
          }

          const orderNo = `LIVE-${Date.now().toString(36).toUpperCase()}`;
          const totalAmount = Number(cfOrder.totalAmount) || 0;

          const livePaymentMethod = aiResult.bank || payment.bankName || "โอนเงิน";

          const [ecomOrder] = await ecomDb.insert(ecommerceOrders).values({
            companyId: cfOrder.companyId,
            connectionId: conn.id,
            platform: "live",
            platformOrderId: `LIVE-CF-${cfOrder.id}`,
            orderNo,
            status: "confirmed",
            buyerName: cfOrder.customerName,
            buyerPhone: cfOrder.customerPhone || null,
            buyerAddress: cfOrder.customerAddress || null,
            totalAmount: String(totalAmount),
            subtotal: String(totalAmount),
            shippingFee: String(Number(cfOrder.shippingFee) || 0),
            placedAt: cfOrder.createdAt || new Date(),
            liveSessionId: cfOrder.sessionId,
            paymentMethod: livePaymentMethod,
          }).returning();

          if (cfItems.length > 0) {
            for (const item of cfItems) {
              await ecomDb.insert(ecommerceOrderItems).values({
                orderId: ecomOrder.id,
                productId: item.productId,
                name: (await db.select({ name: products.name }).from(products).where(eq(products.id, item.productId)).then(r => r[0]?.name)) || "สินค้า",
                qty: String(item.qty),
                price: String(item.price),
                total: String(item.total),
              });
            }
          }

          await db.update(liveCfOrders).set({ ecommerceOrderId: ecomOrder.id }).where(eq(liveCfOrders.id, cfOrder.id));
          autoOrderResult = { orderId: ecomOrder.id, orderNo };

          const tivResult = await generateTivFromEcommerceOrder({
            companyId: cfOrder.companyId,
            orderId: ecomOrder.id,
            platform: "live",
            platformOrderId: `LIVE-CF-${cfOrder.id}`,
            orderNo,
            totalAmount: String(totalAmount),
            buyerName: cfOrder.customerName,
            buyerAddress: cfOrder.customerAddress || null,
            placedAt: cfOrder.createdAt ? new Date(cfOrder.createdAt).toISOString() : new Date().toISOString(),
            userId: user.id,
            accountingMode: company.accountingMode || "simple",
            paymentMethod: livePaymentMethod,
            vatRegistered: company.vatRegistered,
            skipJournal: !!company.ecDailySummaryMode,
          });

          if (tivResult) {
            await db.update(liveCfOrders).set({ taxInvoiceId: tivResult.taxInvoiceId }).where(eq(liveCfOrders.id, cfOrder.id));
            autoTivResult = tivResult;
          }
        } catch (autoErr: any) {
          console.error("Live CF auto-order/TIV error:", autoErr.message);
        }
      }

      const [updatedPayment] = await db.select().from(livePayments).where(eq(livePayments.id, paymentId));

      res.json({
        payment: updatedPayment,
        verification: aiResult,
        autoOrder: autoOrderResult,
        autoTaxInvoice: autoTivResult,
      });
    } catch (err: any) {
      console.error("Live CF slip upload error:", err.message);
      res.status(400).json({ message: err.message });
    }
  });

  // Manual verify/reject live payment + auto-create order & TIV
  app.post("/api/live/payments/:id/verify", requireAuth, requireModule("ecommerce"), async (req, res) => {
    try {
      const paymentId = Number(req.params.id);
      const user = req.user as any;
      const { action, rejectReason: reason } = req.body;

      const [payment] = await db.select().from(livePayments).where(eq(livePayments.id, paymentId));
      if (!payment) return res.status(404).json({ message: "ไม่พบรายการชำระเงิน" });

      const [cfOrder] = await db.select().from(liveCfOrders).where(eq(liveCfOrders.id, payment.cfOrderId));
      if (!cfOrder) return res.status(404).json({ message: "ไม่พบออเดอร์ CF" });

      const [company] = await db.select().from(companies).where(eq(companies.id, cfOrder.companyId));
      if (!company || (user.role !== "super_admin" && company.tenantId !== user.tenantId)) {
        return res.status(403).json({ message: "ไม่มีสิทธิ์" });
      }

      if (action === "approve") {
        await db.update(livePayments).set({
          verificationStatus: "verified",
          verifiedBy: user.id,
          verifiedAt: new Date(),
          aiVerifyNote: (payment.aiVerifyNote || "") + " | ยืนยันโดยผู้ดูแล",
        }).where(eq(livePayments.id, paymentId));

        await db.update(liveCfOrders).set({ status: "paid" }).where(eq(liveCfOrders.id, cfOrder.id));

        let autoOrderResult: any = null;
        let autoTivResult: any = null;

        if (!cfOrder.ecommerceOrderId) {
          try {
            const cfItems = await db.select().from(liveCfItems).where(eq(liveCfItems.cfOrderId, cfOrder.id));
            let [conn] = await ecomDb.select().from(ecommerceConnections)
              .where(and(eq(ecommerceConnections.companyId, cfOrder.companyId), eq(ecommerceConnections.platform, "live")));
            if (!conn) {
              [conn] = await ecomDb.insert(ecommerceConnections).values({
                companyId: cfOrder.companyId, platform: "live", shopName: "Live Selling", status: "connected",
              }).returning();
            }

            const orderNo = `LIVE-${Date.now().toString(36).toUpperCase()}`;
            const totalAmount = Number(cfOrder.totalAmount) || 0;
            const manualPaymentMethod = payment.aiVerifyBank || payment.bankName || "โอนเงิน";

            const [ecomOrder] = await ecomDb.insert(ecommerceOrders).values({
              companyId: cfOrder.companyId,
              connectionId: conn.id,
              platform: "live",
              platformOrderId: `LIVE-CF-${cfOrder.id}`,
              orderNo,
              status: "confirmed",
              buyerName: cfOrder.customerName,
              buyerPhone: cfOrder.customerPhone || null,
              buyerAddress: cfOrder.customerAddress || null,
              totalAmount: String(totalAmount),
              subtotal: String(totalAmount),
              shippingFee: String(Number(cfOrder.shippingFee) || 0),
              placedAt: cfOrder.createdAt || new Date(),
              liveSessionId: cfOrder.sessionId,
              paymentMethod: manualPaymentMethod,
            }).returning();

            if (cfItems.length > 0) {
              for (const item of cfItems) {
                await ecomDb.insert(ecommerceOrderItems).values({
                  orderId: ecomOrder.id,
                  productId: item.productId,
                  name: (await db.select({ name: products.name }).from(products).where(eq(products.id, item.productId)).then(r => r[0]?.name)) || "สินค้า",
                  qty: String(item.qty),
                  price: String(item.price),
                  total: String(item.total),
                });
              }
            }

            await db.update(liveCfOrders).set({ ecommerceOrderId: ecomOrder.id }).where(eq(liveCfOrders.id, cfOrder.id));
            autoOrderResult = { orderId: ecomOrder.id, orderNo };

            const tivResult = await generateTivFromEcommerceOrder({
              companyId: cfOrder.companyId,
              orderId: ecomOrder.id,
              platform: "live",
              platformOrderId: `LIVE-CF-${cfOrder.id}`,
              orderNo,
              totalAmount: String(totalAmount),
              buyerName: cfOrder.customerName,
              buyerAddress: cfOrder.customerAddress || null,
              placedAt: cfOrder.createdAt ? new Date(cfOrder.createdAt).toISOString() : new Date().toISOString(),
              userId: user.id,
              accountingMode: company.accountingMode || "simple",
              paymentMethod: manualPaymentMethod,
              vatRegistered: company.vatRegistered,
              skipJournal: !!company.ecDailySummaryMode,
            });

            if (tivResult) {
              await db.update(liveCfOrders).set({ taxInvoiceId: tivResult.taxInvoiceId }).where(eq(liveCfOrders.id, cfOrder.id));
              autoTivResult = tivResult;
            }
          } catch (autoErr: any) {
            console.error("Live CF manual verify auto-order/TIV error:", autoErr.message);
          }
        }

        res.json({ message: "ยืนยันการชำระเงินสำเร็จ", autoOrder: autoOrderResult, autoTaxInvoice: autoTivResult });
      } else if (action === "reject") {
        await db.update(livePayments).set({
          verificationStatus: "rejected",
          verifiedBy: user.id,
          verifiedAt: new Date(),
          rejectReason: reason || "ไม่ผ่านการตรวจสอบ",
        }).where(eq(livePayments.id, paymentId));

        res.json({ message: "ปฏิเสธการชำระเงิน" });
      } else {
        res.status(400).json({ message: "action ต้องเป็น approve หรือ reject" });
      }
    } catch (err: any) {
      console.error("Live CF manual verify error:", err.message);
      res.status(400).json({ message: err.message });
    }
  });

  app.get("/api/live/sessions/:id/stats", requireAuth, requireModule("ecommerce"), async (req, res) => {
    try {
      const sessionId = Number(req.params.id);
      const session = await ecomDb.select().from(liveSessions).where(eq(liveSessions.id, sessionId)).then(r => r[0]);
      if (!session) return res.status(404).json({ message: "ไม่พบเซสชัน" });

      const products = await ecomDb.select().from(liveSessionProducts).where(eq(liveSessionProducts.sessionId, sessionId));
      const cfOrders = await db.select().from(liveCfOrders).where(eq(liveCfOrders.sessionId, sessionId));
      const cfItems = [];
      for (const o of cfOrders) {
        const items = await db.select().from(liveCfItems).where(eq(liveCfItems.cfOrderId, o.id));
        cfItems.push(...items);
      }
      const payments = [];
      for (const o of cfOrders) {
        const p = await db.select().from(livePayments).where(eq(livePayments.cfOrderId, o.id));
        payments.push(...p);
      }

      const totalOrders = cfOrders.length;
      const paidOrders = cfOrders.filter(o => o.status === "paid" || o.status === "preparing" || o.status === "shipped" || o.status === "delivered").length;
      const totalRevenue = cfOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
      const paidRevenue = cfOrders.filter(o => o.status === "paid" || o.status === "preparing" || o.status === "shipped" || o.status === "delivered").reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
      const cfRevenue = totalRevenue;
      const totalItemsSold = cfItems.reduce((sum, i) => sum + Number(i.qty || 0), 0);
      const skuCount = new Set(cfItems.map(i => i.productId)).size;
      const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      const paymentChannels: Record<string, { count: number; amount: number }> = {};
      for (const p of payments) {
        const method = p.method || "other";
        if (!paymentChannels[method]) paymentChannels[method] = { count: 0, amount: 0 };
        paymentChannels[method].count++;
        paymentChannels[method].amount += Number(p.amount || 0);
      }

      const ordersByHour: Record<string, number> = {};
      for (const o of cfOrders) {
        if (o.createdAt) {
          const h = new Date(o.createdAt).getHours();
          const m = Math.floor(new Date(o.createdAt).getMinutes() / 10) * 10;
          const key = `${h}:${String(m).padStart(2, "0")}`;
          ordersByHour[key] = (ordersByHour[key] || 0) + 1;
        }
      }

      const paymentRate = totalOrders > 0 ? Math.round((paidOrders / totalOrders) * 100) : 0;
      const shippedOrders = cfOrders.filter(o => o.status === "shipped" || o.status === "delivered").length;
      const shippingRate = totalOrders > 0 ? Math.round((shippedOrders / totalOrders) * 100) : 0;
      const completionRate = totalOrders > 0 ? Math.round((paidOrders / totalOrders) * 100) : 0;

      res.json({
        session,
        totalOrders,
        paidOrders,
        totalRevenue,
        paidRevenue,
        cfRevenue,
        totalItemsSold,
        skuCount,
        avgOrderValue,
        paymentRate,
        shippingRate,
        completionRate,
        paymentChannels,
        ordersByHour,
        totalComments: session.totalComments || 0,
        pulledOrders: session.pulledOrders || 0,
      });
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  app.post("/api/live/sessions/:id/products/bulk", requireAuth, requireModule("ecommerce"), async (req, res) => {
    try {
      const sessionId = Number(req.params.id);
      const { productIds } = req.body;
      if (!Array.isArray(productIds) || productIds.length === 0) {
        return res.status(400).json({ message: "productIds required" });
      }
      const productsData = await db.select().from(products).where(inArray(products.id, productIds));
      const added = [];
      for (const p of productsData) {
        const existing = await ecomDb.select().from(liveSessionProducts).where(and(eq(liveSessionProducts.sessionId, sessionId), eq(liveSessionProducts.productId, p.id))).then(r => r[0]);
        if (!existing) {
          const [created] = await ecomDb.insert(liveSessionProducts).values({
            sessionId,
            productId: p.id,
            sku: p.code || "",
            barcode: p.barcode || "",
            name: p.name,
            category: p.category || "",
            brand: "",
            livePrice: String(p.price || "0"),
            originalPrice: String(p.price || "0"),
            availableQty: "0",
            soldQty: "0",
            status: "active",
          }).returning();
          added.push(created);
        }
      }
      res.json({ message: `เพิ่ม ${added.length} สินค้าเข้าไลฟ์แล้ว`, added });
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  // ============ Lucky Draw / จับรางวัล ============

  app.get("/api/lucky-draw/campaigns", requireAuth, requireModule("ecommerce"), async (req, res) => {
    try {
      const companyId = Number(req.query.companyId);
      if (!companyId) return res.status(400).json({ message: "companyId required" });
      const campaigns = await db.select().from(luckyDrawCampaigns)
        .where(eq(luckyDrawCampaigns.companyId, companyId))
        .orderBy(desc(luckyDrawCampaigns.createdAt));
      res.json(campaigns);
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  app.get("/api/lucky-draw/campaigns/:id", requireAuth, requireModule("ecommerce"), async (req, res) => {
    try {
      const companyId = Number(req.query.companyId);
      const campaign = await db.select().from(luckyDrawCampaigns).where(eq(luckyDrawCampaigns.id, Number(req.params.id))).then(r => r[0]);
      if (!campaign) return res.status(404).json({ message: "ไม่พบแคมเปญ" });
      if (companyId && campaign.companyId !== companyId) return res.status(403).json({ message: "ไม่มีสิทธิเข้าถึง" });
      const prizes = await db.select().from(luckyDrawPrizes)
        .where(eq(luckyDrawPrizes.campaignId, campaign.id))
        .orderBy(asc(luckyDrawPrizes.sortOrder));
      const entries = await db.select().from(luckyDrawEntries)
        .where(eq(luckyDrawEntries.campaignId, campaign.id))
        .orderBy(desc(luckyDrawEntries.totalSpending));
      const session = campaign.sessionId
        ? await ecomDb.select().from(liveSessions).where(eq(liveSessions.id, campaign.sessionId)).then(r => r[0])
        : null;
      res.json({ ...campaign, prizes, entries, session });
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  app.post("/api/lucky-draw/campaigns", requireAuth, requireModule("ecommerce"), async (req, res) => {
    try {
      const data = insertLuckyDrawCampaignSchema.parse(req.body);
      const [campaign] = await db.insert(luckyDrawCampaigns).values(data).returning();
      if (req.body.prizes && Array.isArray(req.body.prizes)) {
        for (let i = 0; i < req.body.prizes.length; i++) {
          const p = req.body.prizes[i];
          await db.insert(luckyDrawPrizes).values({
            campaignId: campaign.id,
            name: p.name,
            description: p.description || null,
            quantity: Number(p.quantity) || 1,
            sortOrder: i,
          });
        }
      }
      res.json(campaign);
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  app.patch("/api/lucky-draw/campaigns/:id", requireAuth, requireModule("ecommerce"), async (req, res) => {
    try {
      const { prizes, companyId: reqCompanyId, ...updates } = req.body;
      const existing = await db.select().from(luckyDrawCampaigns).where(eq(luckyDrawCampaigns.id, Number(req.params.id))).then(r => r[0]);
      if (!existing) return res.status(404).json({ message: "ไม่พบแคมเปญ" });
      { const ac = await checkDocOwnership(existing.companyId, req.user); if (!ac.allowed) return res.status(403).json({ message: ac.message }); }
      if (reqCompanyId && existing.companyId !== reqCompanyId) return res.status(403).json({ message: "ไม่มีสิทธิ" });
      const [campaign] = await db.update(luckyDrawCampaigns)
        .set(updates)
        .where(eq(luckyDrawCampaigns.id, existing.id))
        .returning();
      if (!campaign) return res.status(404).json({ message: "ไม่พบแคมเปญ" });
      if (prizes && Array.isArray(prizes)) {
        await db.delete(luckyDrawPrizes).where(eq(luckyDrawPrizes.campaignId, campaign.id));
        for (let i = 0; i < prizes.length; i++) {
          const p = prizes[i];
          await db.insert(luckyDrawPrizes).values({
            campaignId: campaign.id,
            name: p.name,
            description: p.description || null,
            quantity: Number(p.quantity) || 1,
            sortOrder: i,
          });
        }
      }
      res.json(campaign);
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  app.delete("/api/lucky-draw/campaigns/:id", requireAuth, requireModule("ecommerce"), async (req, res) => {
    try {
      const companyId = Number(req.query.companyId);
      const existing = await db.select().from(luckyDrawCampaigns).where(eq(luckyDrawCampaigns.id, Number(req.params.id))).then(r => r[0]);
      if (!existing) return res.status(404).json({ message: "ไม่พบแคมเปญ" });
      { const ac = await checkDocOwnership(existing.companyId, req.user); if (!ac.allowed) return res.status(403).json({ message: ac.message }); }
      if (companyId && existing.companyId !== companyId) return res.status(403).json({ message: "ไม่มีสิทธิ" });
      await db.delete(luckyDrawCampaigns).where(eq(luckyDrawCampaigns.id, existing.id));
      res.json({ success: true });
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  app.post("/api/lucky-draw/campaigns/:id/prizes", requireAuth, requireModule("ecommerce"), async (req, res) => {
    try {
      const data = insertLuckyDrawPrizeSchema.parse({ ...req.body, campaignId: Number(req.params.id) });
      const [prize] = await db.insert(luckyDrawPrizes).values(data).returning();
      res.json(prize);
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  app.post("/api/lucky-draw/campaigns/:id/auto-qualify", requireAuth, requireModule("ecommerce"), async (req, res) => {
    try {
      const campaignId = Number(req.params.id);
      const campaign = await db.select().from(luckyDrawCampaigns).where(eq(luckyDrawCampaigns.id, campaignId)).then(r => r[0]);
      if (!campaign) return res.status(404).json({ message: "ไม่พบแคมเปญ" });

      const sessionFilter = campaign.sessionId
        ? and(eq(liveCfOrders.companyId, campaign.companyId), eq(liveCfOrders.sessionId, campaign.sessionId))
        : eq(liveCfOrders.companyId, campaign.companyId);

      const paidOrders = await db.select().from(liveCfOrders).where(and(sessionFilter, eq(liveCfOrders.status, "paid")));

      const customerMap = new Map<string, { name: string; phone: string | null; social: string | null; totalSpending: number; orderIds: number[] }>();
      for (const o of paidOrders) {
        const key = (o.customerPhone || o.customerSocial || o.customerName).toLowerCase().trim();
        const existing = customerMap.get(key);
        if (existing) {
          existing.totalSpending += Number(o.totalAmount || 0);
          existing.orderIds.push(o.id);
          if (!existing.phone && o.customerPhone) existing.phone = o.customerPhone;
          if (!existing.social && o.customerSocial) existing.social = o.customerSocial;
        } else {
          customerMap.set(key, {
            name: o.customerName,
            phone: o.customerPhone,
            social: o.customerSocial,
            totalSpending: Number(o.totalAmount || 0),
            orderIds: [o.id],
          });
        }
      }

      const minSpending = Number(campaign.conditionValue || 0);
      let addedCount = 0;

      await db.delete(luckyDrawEntries).where(eq(luckyDrawEntries.campaignId, campaignId));

      for (const [, customer] of customerMap) {
        if (customer.totalSpending >= minSpending) {
          const tickets = campaign.conditionType === "per_amount"
            ? Math.floor(customer.totalSpending / minSpending)
            : 1;

          await db.insert(luckyDrawEntries).values({
            campaignId,
            customerName: customer.name,
            customerPhone: customer.phone,
            customerSocial: customer.social,
            cfOrderId: customer.orderIds[0],
            totalSpending: String(customer.totalSpending),
            tickets: Math.max(1, tickets),
            isWinner: false,
            prizeId: null,
          });
          addedCount++;
        }
      }

      res.json({ qualified: addedCount, total: customerMap.size, minSpending });
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  app.post("/api/lucky-draw/campaigns/:id/add-entry", requireAuth, requireModule("ecommerce"), async (req, res) => {
    try {
      const data = insertLuckyDrawEntrySchema.parse({ ...req.body, campaignId: Number(req.params.id) });
      const [entry] = await db.insert(luckyDrawEntries).values(data).returning();
      res.json(entry);
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  app.delete("/api/lucky-draw/entries/:id", requireAuth, requireModule("ecommerce"), async (req, res) => {
    try {
      const entry = await db.select().from(luckyDrawEntries).where(eq(luckyDrawEntries.id, Number(req.params.id))).then(r => r[0]);
      if (!entry) return res.status(404).json({ message: "ไม่พบรายการ" });
      const campaign = await db.select().from(luckyDrawCampaigns).where(eq(luckyDrawCampaigns.id, entry.campaignId)).then(r => r[0]);
      if (!campaign) return res.status(404).json({ message: "ไม่พบแคมเปญ" });
      await db.delete(luckyDrawEntries).where(eq(luckyDrawEntries.id, entry.id));
      res.json({ success: true });
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  app.post("/api/lucky-draw/campaigns/:id/draw", requireAuth, requireModule("ecommerce"), async (req, res) => {
    try {
      const campaignId = Number(req.params.id);
      const prizeId = req.body.prizeId ? Number(req.body.prizeId) : null;
      const count = Number(req.body.count) || 1;

      const campaign = await db.select().from(luckyDrawCampaigns).where(eq(luckyDrawCampaigns.id, campaignId)).then(r => r[0]);
      if (!campaign) return res.status(404).json({ message: "ไม่พบแคมเปญ" });

      const allEntries = await db.select().from(luckyDrawEntries)
        .where(and(eq(luckyDrawEntries.campaignId, campaignId), eq(luckyDrawEntries.isWinner, false)));

      if (allEntries.length === 0) return res.status(400).json({ message: "ไม่มีผู้มีสิทธิเหลือ" });

      const pool: typeof allEntries = [];
      for (const entry of allEntries) {
        for (let t = 0; t < entry.tickets; t++) {
          pool.push(entry);
        }
      }

      const winners: typeof allEntries = [];
      const usedIds = new Set<number>();
      const drawCount = Math.min(count, allEntries.length);

      for (let i = 0; i < drawCount; i++) {
        let attempts = 0;
        while (attempts < pool.length * 2) {
          const idx = Math.floor(Math.random() * pool.length);
          const picked = pool[idx];
          if (!usedIds.has(picked.id)) {
            usedIds.add(picked.id);
            winners.push(picked);
            break;
          }
          attempts++;
        }
      }

      for (const w of winners) {
        await db.update(luckyDrawEntries)
          .set({ isWinner: true, prizeId })
          .where(eq(luckyDrawEntries.id, w.id));
      }

      await db.update(luckyDrawCampaigns)
        .set({ status: "drawn", drawnAt: new Date() })
        .where(eq(luckyDrawCampaigns.id, campaignId));

      const updatedWinners = await db.select().from(luckyDrawEntries)
        .where(and(eq(luckyDrawEntries.campaignId, campaignId), eq(luckyDrawEntries.isWinner, true)));

      res.json({ winners: updatedWinners });
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  app.post("/api/lucky-draw/campaigns/:id/reset", requireAuth, requireModule("ecommerce"), async (req, res) => {
    try {
      const campaignId = Number(req.params.id);
      await db.update(luckyDrawEntries)
        .set({ isWinner: false, prizeId: null })
        .where(eq(luckyDrawEntries.campaignId, campaignId));
      await db.update(luckyDrawCampaigns)
        .set({ status: "active", drawnAt: null })
        .where(eq(luckyDrawCampaigns.id, campaignId));
      res.json({ success: true });
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  app.get("/api/live-commission/shifts", requireAuth, requireModule("ecommerce"), async (req, res) => {
    try {
      const companyId = Number(req.query.companyId);
      if (!companyId) return res.status(400).json({ message: "companyId required" });
      const rows = await db.select().from(liveCommissionShifts)
        .where(eq(liveCommissionShifts.companyId, companyId))
        .orderBy(desc(liveCommissionShifts.createdAt));
      const userIds = [...new Set(rows.flatMap(r => r.hostUserIds || []))];
      let userMap: Record<number, string> = {};
      if (userIds.length > 0) {
        const uu = await db.select({ id: users.id, fullName: users.fullName, username: users.username }).from(users).where(inArray(users.id, userIds));
        uu.forEach(u => { userMap[u.id] = u.fullName || u.username; });
      }
      res.json(rows.map(r => ({ ...r, hostNames: (r.hostUserIds || []).map(id => userMap[id] || `User#${id}`) })));
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/live-commission/shifts", requireAuth, requireModule("ecommerce"), async (req, res) => {
    try {
      const { companyId, title, platforms, hostUserIds, startedAt, endedAt, commissionRate, notes } = req.body;
      if (!companyId || !title || !platforms?.length || !hostUserIds?.length || !startedAt) {
        return res.status(400).json({ message: "กรุณากรอกข้อมูลให้ครบ (บริษัท, ชื่อรอบ, แพลตฟอร์ม, ผู้ไลฟ์, เวลาเริ่ม)" });
      }
      const [row] = await db.insert(liveCommissionShifts).values({
        companyId, title, platforms, hostUserIds,
        startedAt: new Date(startedAt),
        endedAt: endedAt ? new Date(endedAt) : null,
        commissionRate: commissionRate || "0",
        notes: notes || null,
        status: "draft",
      }).returning();
      res.json(row);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.put("/api/live-commission/shifts/:id", requireAuth, requireModule("ecommerce"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { title, platforms, hostUserIds, startedAt, endedAt, commissionRate, notes, status } = req.body;
      const updates: any = {};
      if (title !== undefined) updates.title = title;
      if (platforms !== undefined) updates.platforms = platforms;
      if (hostUserIds !== undefined) updates.hostUserIds = hostUserIds;
      if (startedAt !== undefined) updates.startedAt = new Date(startedAt);
      if (endedAt !== undefined) updates.endedAt = endedAt ? new Date(endedAt) : null;
      if (commissionRate !== undefined) updates.commissionRate = commissionRate;
      if (notes !== undefined) updates.notes = notes;
      if (status !== undefined) updates.status = status;
      const [row] = await db.update(liveCommissionShifts).set(updates).where(eq(liveCommissionShifts.id, id)).returning();
      if (!row) return res.status(404).json({ message: "ไม่พบรอบไลฟ์" });
      res.json(row);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.delete("/api/live-commission/shifts/:id", requireAuth, requireModule("ecommerce"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      await db.delete(liveCommissionShifts).where(eq(liveCommissionShifts.id, id));
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/live-commission/shifts/:id/calculate", requireAuth, requireModule("ecommerce"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const [shift] = await db.select().from(liveCommissionShifts).where(eq(liveCommissionShifts.id, id));
      if (!shift) return res.status(404).json({ message: "ไม่พบรอบไลฟ์" });
      if (!shift.endedAt) return res.status(400).json({ message: "กรุณาระบุเวลาจบไลฟ์ก่อนคำนวณ" });

      const conditions = [
        eq(ecommerceOrders.companyId, shift.companyId),
        inArray(ecommerceOrders.platform, shift.platforms),
        gte(ecommerceOrders.placedAt, shift.startedAt),
        lte(ecommerceOrders.placedAt, shift.endedAt),
        inArray(ecommerceOrders.status, ["completed", "delivered", "confirmed", "shipping"]),
      ];

      const orderRows = await ecomDb.select({
        cnt: count(),
        rev: sum(ecommerceOrders.totalAmount),
      }).from(ecommerceOrders).where(and(...conditions));

      const totalOrders = Number(orderRows[0]?.cnt || 0);
      const totalRevenue = parseFloat(String(orderRows[0]?.rev || "0"));
      const rate = parseFloat(String(shift.commissionRate || "0"));
      const commissionAmount = (totalRevenue * rate) / 100;

      const [updated] = await db.update(liveCommissionShifts).set({
        totalRevenue: totalRevenue.toFixed(2),
        totalOrders,
        commissionAmount: commissionAmount.toFixed(2),
        calculatedAt: new Date(),
        status: "calculated",
      }).where(eq(liveCommissionShifts.id, id)).returning();

      const orderList = await ecomDb.select({
        id: ecommerceOrders.id,
        platform: ecommerceOrders.platform,
        orderNo: ecommerceOrders.orderNo,
        buyerName: ecommerceOrders.buyerName,
        totalAmount: ecommerceOrders.totalAmount,
        placedAt: ecommerceOrders.placedAt,
        status: ecommerceOrders.status,
      }).from(ecommerceOrders).where(and(...conditions)).orderBy(asc(ecommerceOrders.placedAt));

      res.json({ shift: updated, orders: orderList, totalOrders, totalRevenue, commissionAmount });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

}
