import type { Express } from "express";
import { db } from "../db";
import { posDb } from "../pos-db";
import { eq, and, desc, sql, not } from "drizzle-orm";
import { restaurantAreas, restaurantTables, menuCategories, menuItems, restaurantOrders, restaurantOrderItems } from "@shared/schema";
import { requireAuth } from "../route-middleware";

export function registerRestaurantRoutes(app: Express) {
  // ============ Restaurant POS Module ============

  // Restaurant Areas
  app.get("/api/restaurant/areas", requireAuth, async (req, res) => {
    try {
      const companyId = Number(req.query.companyId);
      if (!companyId) return res.status(400).json({ message: "companyId required" });
      const rows = await posDb.select().from(restaurantAreas).where(eq(restaurantAreas.companyId, companyId)).orderBy(restaurantAreas.sortOrder);
      res.json(rows);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/restaurant/areas", requireAuth, async (req, res) => {
    try {
      const [created] = await posDb.insert(restaurantAreas).values(req.body).returning();
      res.json(created);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.put("/api/restaurant/areas/:id", requireAuth, async (req, res) => {
    try {
      const [updated] = await posDb.update(restaurantAreas).set(req.body).where(eq(restaurantAreas.id, Number(req.params.id))).returning();
      res.json(updated);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.delete("/api/restaurant/areas/:id", requireAuth, async (req, res) => {
    try {
      await posDb.delete(restaurantAreas).where(eq(restaurantAreas.id, Number(req.params.id)));
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Restaurant Tables
  app.get("/api/restaurant/tables", requireAuth, async (req, res) => {
    try {
      const companyId = Number(req.query.companyId);
      if (!companyId) return res.status(400).json({ message: "companyId required" });
      const rows = await posDb.select().from(restaurantTables).where(eq(restaurantTables.companyId, companyId)).orderBy(restaurantTables.sortOrder);
      res.json(rows);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/restaurant/tables", requireAuth, async (req, res) => {
    try {
      const [created] = await posDb.insert(restaurantTables).values(req.body).returning();
      res.json(created);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.put("/api/restaurant/tables/:id", requireAuth, async (req, res) => {
    try {
      const [updated] = await posDb.update(restaurantTables).set(req.body).where(eq(restaurantTables.id, Number(req.params.id))).returning();
      res.json(updated);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.delete("/api/restaurant/tables/:id", requireAuth, async (req, res) => {
    try {
      await posDb.delete(restaurantTables).where(eq(restaurantTables.id, Number(req.params.id)));
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Menu Categories
  app.get("/api/restaurant/menu-categories", requireAuth, async (req, res) => {
    try {
      const companyId = Number(req.query.companyId);
      if (!companyId) return res.status(400).json({ message: "companyId required" });
      const rows = await posDb.select().from(menuCategories).where(eq(menuCategories.companyId, companyId)).orderBy(menuCategories.sortOrder);
      res.json(rows);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/restaurant/menu-categories", requireAuth, async (req, res) => {
    try {
      const [created] = await posDb.insert(menuCategories).values(req.body).returning();
      res.json(created);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.put("/api/restaurant/menu-categories/:id", requireAuth, async (req, res) => {
    try {
      const [updated] = await posDb.update(menuCategories).set(req.body).where(eq(menuCategories.id, Number(req.params.id))).returning();
      res.json(updated);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.delete("/api/restaurant/menu-categories/:id", requireAuth, async (req, res) => {
    try {
      await posDb.delete(menuCategories).where(eq(menuCategories.id, Number(req.params.id)));
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Menu Items
  app.get("/api/restaurant/menu-items", requireAuth, async (req, res) => {
    try {
      const companyId = Number(req.query.companyId);
      if (!companyId) return res.status(400).json({ message: "companyId required" });
      const rows = await posDb.select().from(menuItems).where(eq(menuItems.companyId, companyId)).orderBy(menuItems.sortOrder);
      res.json(rows);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/restaurant/menu-items", requireAuth, async (req, res) => {
    try {
      const [created] = await posDb.insert(menuItems).values(req.body).returning();
      res.json(created);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.put("/api/restaurant/menu-items/:id", requireAuth, async (req, res) => {
    try {
      const [updated] = await posDb.update(menuItems).set(req.body).where(eq(menuItems.id, Number(req.params.id))).returning();
      res.json(updated);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.delete("/api/restaurant/menu-items/:id", requireAuth, async (req, res) => {
    try {
      await posDb.delete(menuItems).where(eq(menuItems.id, Number(req.params.id)));
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Menu Modifier Groups
  app.get("/api/restaurant/modifier-groups", requireAuth, async (req, res) => {
    try {
      const companyId = Number(req.query.companyId);
      if (!companyId) return res.status(400).json({ message: "companyId required" });
      const groups = await posDb.select().from(menuModifierGroups).where(eq(menuModifierGroups.companyId, companyId));
      const groupIds = groups.map(g => g.id);
      let options: any[] = [];
      if (groupIds.length > 0) {
        options = await posDb.select().from(menuModifierOptions)
          .where(sql`${menuModifierOptions.groupId} IN (${sql.join(groupIds.map(id => sql`${id}`), sql`, `)})`);
      }
      const result = groups.map(g => ({ ...g, options: options.filter(o => o.groupId === g.id) }));
      res.json(result);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/restaurant/modifier-groups", requireAuth, async (req, res) => {
    try {
      const { options, ...groupData } = req.body;
      const [group] = await posDb.insert(menuModifierGroups).values(groupData).returning();
      if (options?.length) {
        for (const opt of options) {
          await posDb.insert(menuModifierOptions).values({ ...opt, groupId: group.id });
        }
      }
      res.json(group);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.put("/api/restaurant/modifier-groups/:id", requireAuth, async (req, res) => {
    try {
      const { options, ...groupData } = req.body;
      const [updated] = await posDb.update(menuModifierGroups).set(groupData).where(eq(menuModifierGroups.id, Number(req.params.id))).returning();
      if (options) {
        await posDb.delete(menuModifierOptions).where(eq(menuModifierOptions.groupId, updated.id));
        for (const opt of options) {
          await posDb.insert(menuModifierOptions).values({ ...opt, groupId: updated.id });
        }
      }
      res.json(updated);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.delete("/api/restaurant/modifier-groups/:id", requireAuth, async (req, res) => {
    try {
      const id = Number(req.params.id);
      await posDb.delete(menuModifierOptions).where(eq(menuModifierOptions.groupId, id));
      await posDb.delete(menuItemModifiers).where(eq(menuItemModifiers.modifierGroupId, id));
      await posDb.delete(menuModifierGroups).where(eq(menuModifierGroups.id, id));
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Menu Item Modifiers (linking)
  app.get("/api/restaurant/menu-item-modifiers/:menuItemId", requireAuth, async (req, res) => {
    try {
      const rows = await posDb.select().from(menuItemModifiers).where(eq(menuItemModifiers.menuItemId, Number(req.params.menuItemId)));
      res.json(rows);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/restaurant/menu-item-modifiers", requireAuth, async (req, res) => {
    try {
      const { menuItemId, modifierGroupIds } = req.body;
      await posDb.delete(menuItemModifiers).where(eq(menuItemModifiers.menuItemId, menuItemId));
      for (const gid of (modifierGroupIds || [])) {
        await posDb.insert(menuItemModifiers).values({ menuItemId, modifierGroupId: gid });
      }
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Restaurant Orders
  app.get("/api/restaurant/orders", requireAuth, async (req, res) => {
    try {
      const companyId = Number(req.query.companyId);
      const status = req.query.status as string;
      if (!companyId) return res.status(400).json({ message: "companyId required" });
      let query = posDb.select().from(restaurantOrders).where(eq(restaurantOrders.companyId, companyId)).orderBy(desc(restaurantOrders.createdAt));
      const rows = status
        ? await posDb.select().from(restaurantOrders).where(and(eq(restaurantOrders.companyId, companyId), eq(restaurantOrders.status, status))).orderBy(desc(restaurantOrders.createdAt))
        : await posDb.select().from(restaurantOrders).where(eq(restaurantOrders.companyId, companyId)).orderBy(desc(restaurantOrders.createdAt));
      res.json(rows);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/restaurant/orders/:id", requireAuth, async (req, res) => {
    try {
      const [order] = await posDb.select().from(restaurantOrders).where(eq(restaurantOrders.id, Number(req.params.id)));
      if (!order) return res.status(404).json({ message: "Order not found" });
      const items = await posDb.select().from(restaurantOrderItems).where(eq(restaurantOrderItems.orderId, order.id));
      res.json({ ...order, items });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/restaurant/orders", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const { items, ...orderData } = req.body;
      const orderNo = `RO-${Date.now().toString(36).toUpperCase()}`;
      const [order] = await posDb.insert(restaurantOrders).values({
        ...orderData, orderNo, createdBy: user.id,
      }).returning();
      if (items?.length) {
        for (const item of items) {
          await posDb.insert(restaurantOrderItems).values({
            ...item, orderId: order.id,
            modifiers: item.modifiers ? JSON.stringify(item.modifiers) : null,
          });
        }
      }
      if (orderData.tableId) {
        await posDb.update(restaurantTables).set({ status: "occupied" }).where(eq(restaurantTables.id, orderData.tableId));
      }
      res.json(order);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Add items to existing order
  app.post("/api/restaurant/orders/:id/items", requireAuth, async (req, res) => {
    try {
      const orderId = Number(req.params.id);
      const { items } = req.body;
      for (const item of (items || [])) {
        await posDb.insert(restaurantOrderItems).values({
          ...item, orderId,
          modifiers: item.modifiers ? JSON.stringify(item.modifiers) : null,
        });
      }
      const allItems = await posDb.select().from(restaurantOrderItems).where(eq(restaurantOrderItems.orderId, orderId));
      const subtotal = allItems.reduce((s, i) => s + parseFloat(i.unitPrice) * i.quantity, 0);
      await posDb.update(restaurantOrders).set({ subtotal: String(subtotal) }).where(eq(restaurantOrders.id, orderId));
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Update order status
  app.put("/api/restaurant/orders/:id/status", requireAuth, async (req, res) => {
    try {
      const { status } = req.body;
      const [updated] = await posDb.update(restaurantOrders).set({
        status,
        ...(status === "paid" ? { paidAt: new Date() } : {}),
      }).where(eq(restaurantOrders.id, Number(req.params.id))).returning();
      if (status === "paid" || status === "cancelled") {
        if (updated.tableId) {
          await posDb.update(restaurantTables).set({ status: "available" }).where(eq(restaurantTables.id, updated.tableId));
        }
      }
      res.json(updated);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Calculate & update order totals
  app.post("/api/restaurant/orders/:id/calculate", requireAuth, async (req, res) => {
    try {
      const orderId = Number(req.params.id);
      const { serviceChargeRate, discountAmount } = req.body;
      const items = await posDb.select().from(restaurantOrderItems).where(and(eq(restaurantOrderItems.orderId, orderId), sql`${restaurantOrderItems.status} != 'cancelled'`));
      const subtotal = items.reduce((s, i) => s + parseFloat(i.unitPrice) * i.quantity, 0);
      const sc = serviceChargeRate ? Math.round(subtotal * serviceChargeRate / 100 * 100) / 100 : 0;
      const disc = discountAmount || 0;
      const beforeVat = subtotal + sc - disc;
      const vat = Math.round(beforeVat * 7 / 107 * 100) / 100;
      const total = Math.round(beforeVat * 100) / 100;
      const [updated] = await posDb.update(restaurantOrders).set({
        subtotal: String(subtotal), serviceCharge: String(sc),
        serviceChargeRate: String(serviceChargeRate || 0),
        discountAmount: String(disc), vatAmount: String(vat), total: String(total),
      }).where(eq(restaurantOrders.id, orderId)).returning();
      res.json(updated);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Send to kitchen
  app.post("/api/restaurant/orders/:id/send-to-kitchen", requireAuth, async (req, res) => {
    try {
      const orderId = Number(req.params.id);
      const [order] = await posDb.select().from(restaurantOrders).where(eq(restaurantOrders.id, orderId));
      if (!order) return res.status(404).json({ message: "Order not found" });
      const pendingItems = await posDb.select().from(restaurantOrderItems)
        .where(and(eq(restaurantOrderItems.orderId, orderId), eq(restaurantOrderItems.status, "pending")));
      if (pendingItems.length === 0) return res.json({ message: "ไม่มีรายการที่ต้องส่งครัว" });
      for (const item of pendingItems) {
        await posDb.update(restaurantOrderItems).set({ status: "preparing", sentToKitchenAt: new Date() })
          .where(eq(restaurantOrderItems.id, item.id));
      }
      const tableName = order.tableId
        ? (await posDb.select({ name: restaurantTables.name }).from(restaurantTables).where(eq(restaurantTables.id, order.tableId)))[0]?.name
        : null;
      const [ticket] = await posDb.insert(kitchenTickets).values({
        companyId: order.companyId, orderId, tableName: tableName || order.orderNo, status: "new",
      }).returning();
      await posDb.update(restaurantOrders).set({ status: "preparing" }).where(eq(restaurantOrders.id, orderId));
      res.json({ ticket, itemCount: pendingItems.length });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Kitchen Tickets (KDS)
  app.get("/api/restaurant/kitchen-tickets", requireAuth, async (req, res) => {
    try {
      const companyId = Number(req.query.companyId);
      if (!companyId) return res.status(400).json({ message: "companyId required" });
      const tickets = await posDb.select().from(kitchenTickets)
        .where(and(eq(kitchenTickets.companyId, companyId), sql`${kitchenTickets.status} != 'done'`))
        .orderBy(kitchenTickets.createdAt);
      const result = [];
      for (const ticket of tickets) {
        const items = await posDb.select().from(restaurantOrderItems)
          .where(and(eq(restaurantOrderItems.orderId, ticket.orderId), sql`${restaurantOrderItems.status} IN ('preparing', 'ready')`));
        result.push({ ...ticket, items });
      }
      res.json(result);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.put("/api/restaurant/kitchen-tickets/:id/status", requireAuth, async (req, res) => {
    try {
      const { status } = req.body;
      const [updated] = await posDb.update(kitchenTickets).set({
        status, ...(status === "done" ? { completedAt: new Date() } : {}),
      }).where(eq(kitchenTickets.id, Number(req.params.id))).returning();
      if (status === "done") {
        await posDb.update(restaurantOrderItems).set({ status: "ready" })
          .where(and(eq(restaurantOrderItems.orderId, updated.orderId), eq(restaurantOrderItems.status, "preparing")));
      }
      res.json(updated);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Update order item status
  app.put("/api/restaurant/order-items/:id/status", requireAuth, async (req, res) => {
    try {
      const { status } = req.body;
      const [updated] = await posDb.update(restaurantOrderItems).set({
        status, ...(status === "served" ? { servedAt: new Date() } : {}),
      }).where(eq(restaurantOrderItems.id, Number(req.params.id))).returning();
      res.json(updated);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Bill Splits
  app.get("/api/restaurant/orders/:id/splits", requireAuth, async (req, res) => {
    try {
      const splits = await db.select().from(billSplits).where(eq(billSplits.orderId, Number(req.params.id)));
      res.json(splits);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/restaurant/orders/:id/splits", requireAuth, async (req, res) => {
    try {
      const orderId = Number(req.params.id);
      const { splits } = req.body;
      await db.delete(billSplits).where(eq(billSplits.orderId, orderId));
      for (const split of (splits || [])) {
        await db.insert(billSplits).values({ ...split, orderId });
      }
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.put("/api/restaurant/splits/:id/pay", requireAuth, async (req, res) => {
    try {
      const [updated] = await db.update(billSplits).set({ paid: true, paymentMethod: req.body.paymentMethod || "เงินสด" })
        .where(eq(billSplits.id, Number(req.params.id))).returning();
      const allSplits = await db.select().from(billSplits).where(eq(billSplits.orderId, updated.orderId));
      if (allSplits.every(s => s.paid)) {
        await posDb.update(restaurantOrders).set({ status: "paid", paidAt: new Date() }).where(eq(restaurantOrders.id, updated.orderId));
        const [order] = await posDb.select().from(restaurantOrders).where(eq(restaurantOrders.id, updated.orderId));
        if (order?.tableId) {
          await posDb.update(restaurantTables).set({ status: "available" }).where(eq(restaurantTables.id, order.tableId));
        }
      }
      res.json(updated);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Move table
  app.post("/api/restaurant/orders/:id/move-table", requireAuth, async (req, res) => {
    try {
      const orderId = Number(req.params.id);
      const { newTableId } = req.body;
      const [order] = await posDb.select().from(restaurantOrders).where(eq(restaurantOrders.id, orderId));
      if (!order) return res.status(404).json({ message: "Order not found" });
      if (order.tableId) {
        await posDb.update(restaurantTables).set({ status: "available" }).where(eq(restaurantTables.id, order.tableId));
      }
      await posDb.update(restaurantOrders).set({ tableId: newTableId }).where(eq(restaurantOrders.id, orderId));
      await posDb.update(restaurantTables).set({ status: "occupied" }).where(eq(restaurantTables.id, newTableId));
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Merge tables (merge orders)
  app.post("/api/restaurant/orders/merge", requireAuth, async (req, res) => {
    try {
      const { targetOrderId, sourceOrderId } = req.body;
      const sourceItems = await posDb.select().from(restaurantOrderItems).where(eq(restaurantOrderItems.orderId, sourceOrderId));
      for (const item of sourceItems) {
        await posDb.update(restaurantOrderItems).set({ orderId: targetOrderId }).where(eq(restaurantOrderItems.id, item.id));
      }
      const [sourceOrder] = await posDb.select().from(restaurantOrders).where(eq(restaurantOrders.id, sourceOrderId));
      if (sourceOrder?.tableId) {
        await posDb.update(restaurantTables).set({ status: "available" }).where(eq(restaurantTables.id, sourceOrder.tableId));
      }
      await posDb.update(restaurantOrders).set({ status: "cancelled" }).where(eq(restaurantOrders.id, sourceOrderId));
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

}
