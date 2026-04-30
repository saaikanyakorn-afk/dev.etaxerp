import type { Express, Request, Response } from "express";
import { db } from "../db";
import { ecomDb } from "../ecom-db";
import { eq, desc, and, asc , sql } from "drizzle-orm";
import { warehouseZones, warehouseBins, ecommerceOrders, ecommerceOrderItems } from "@shared/schema";
import { requireAuth, requireModule } from "../route-middleware";
import { runWarehouseColumnsMigration } from "@shared/schema-extra";

export function registerWarehouseBinRoutes(app: Express) {
// Run after DB is ready (inside function = called after migrationReady, not at module import time)
runWarehouseColumnsMigration(db);

// ========== Warehouse Bin Location System ==========

app.get("/api/ecommerce/warehouse/zones", requireAuth, requireModule("ecommerce"), async (req, res) => {
  try {
    const companyId = Number(req.query.companyId || req.body.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId required" });
    const warehouseId = req.query.warehouseId ? Number(req.query.warehouseId) : undefined;
    const conditions = [eq(warehouseZones.companyId, companyId)];
    if (warehouseId) conditions.push(eq(warehouseZones.warehouseId, warehouseId));
    const zones = await db.select().from(warehouseZones).where(and(...conditions)).orderBy(asc(warehouseZones.sortOrder));
    res.json(zones);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post("/api/ecommerce/warehouse/zones", requireAuth, requireModule("ecommerce"), async (req, res) => {
  try {
    const companyId = Number(req.query.companyId || req.body.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId required" });
    const data = insertWarehouseZoneSchema.parse({ ...req.body, companyId });
    const [zone] = await db.insert(warehouseZones).values(data).returning();
    res.json(zone);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.put("/api/ecommerce/warehouse/zones/:id", requireAuth, requireModule("ecommerce"), async (req, res) => {
  try {
    const companyId = Number(req.query.companyId || req.body.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId required" });
    const id = Number(req.params.id);
    const [zone] = await db.update(warehouseZones).set(req.body).where(and(eq(warehouseZones.id, id), eq(warehouseZones.companyId, companyId))).returning();
    res.json(zone);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.delete("/api/ecommerce/warehouse/zones/:id", requireAuth, requireModule("ecommerce"), async (req, res) => {
  try {
    const companyId = Number(req.query.companyId || req.body.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId required" });
    const id = Number(req.params.id);
    await db.delete(warehouseZones).where(and(eq(warehouseZones.id, id), eq(warehouseZones.companyId, companyId)));
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.get("/api/ecommerce/warehouse/bins", requireAuth, requireModule("ecommerce"), async (req, res) => {
  try {
    const companyId = Number(req.query.companyId || req.body.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId required" });
    const zoneId = req.query.zoneId ? Number(req.query.zoneId) : undefined;
    const warehouseId = req.query.warehouseId ? Number(req.query.warehouseId) : undefined;
    const conditions = [eq(warehouseBins.companyId, companyId)];
    if (zoneId) conditions.push(eq(warehouseBins.zoneId, zoneId));
    if (warehouseId) conditions.push(eq(warehouseBins.warehouseId, warehouseId));
    const bins = await db.select().from(warehouseBins).where(and(...conditions)).orderBy(asc(warehouseBins.sortOrder));
    res.json(bins);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post("/api/ecommerce/warehouse/bins", requireAuth, requireModule("ecommerce"), async (req, res) => {
  try {
    const companyId = Number(req.query.companyId || req.body.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId required" });
    const data = insertWarehouseBinSchema.parse({ ...req.body, companyId });
    const [bin] = await db.insert(warehouseBins).values(data).returning();
    res.json(bin);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.put("/api/ecommerce/warehouse/bins/:id", requireAuth, requireModule("ecommerce"), async (req, res) => {
  try {
    const companyId = Number(req.query.companyId || req.body.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId required" });
    const id = Number(req.params.id);
    const [bin] = await db.update(warehouseBins).set(req.body).where(and(eq(warehouseBins.id, id), eq(warehouseBins.companyId, companyId))).returning();
    res.json(bin);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.delete("/api/ecommerce/warehouse/bins/:id", requireAuth, requireModule("ecommerce"), async (req, res) => {
  try {
    const companyId = Number(req.query.companyId || req.body.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId required" });
    const id = Number(req.params.id);
    await db.delete(warehouseBins).where(and(eq(warehouseBins.id, id), eq(warehouseBins.companyId, companyId)));
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post("/api/ecommerce/warehouse/bins/bulk-generate", requireAuth, requireModule("ecommerce"), async (req, res) => {
  try {
    const companyId = Number(req.query.companyId || req.body.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId required" });
    const { warehouseId, zoneId, aisleStart, aisleEnd, shelfStart, shelfEnd, levelStart, levelEnd } = req.body;
    if (!warehouseId || !zoneId) return res.status(400).json({ message: "warehouseId and zoneId required" });
    const aisles: string[] = [];
    const aStart = (aisleStart || "A").charCodeAt(0);
    const aEnd = (aisleEnd || "D").charCodeAt(0);
    for (let i = aStart; i <= aEnd; i++) aisles.push(String.fromCharCode(i));
    const sStart = Number(shelfStart || 1);
    const sEnd = Number(shelfEnd || 5);
    const lStart = Number(levelStart || 1);
    const lEnd = Number(levelEnd || 3);
    const generated: any[] = [];
    let sortOrder = 0;
    for (const aisle of aisles) {
      for (let shelf = sStart; shelf <= sEnd; shelf++) {
        for (let level = lStart; level <= lEnd; level++) {
          const code = `${aisle}-${shelf}-${level}`;
          const fullPath = `${aisle}/${shelf}/${level}`;
          const [bin] = await db.insert(warehouseBins).values({
            companyId, warehouseId: Number(warehouseId), zoneId: Number(zoneId),
            code, aisle, shelf: String(shelf), level: String(level),
            fullPath, sortOrder: sortOrder++,
          }).returning();
          generated.push(bin);
        }
      }
    }
    res.json({ count: generated.length, bins: generated });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.get("/api/ecommerce/warehouse/bin-assignments", requireAuth, requireModule("ecommerce"), async (req, res) => {
  try {
    const companyId = Number(req.query.companyId || req.body.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId required" });
    const productId = req.query.productId ? Number(req.query.productId) : undefined;
    const binId = req.query.binId ? Number(req.query.binId) : undefined;
    const conditions = [eq(productBinAssignments.companyId, companyId)];
    if (productId) conditions.push(eq(productBinAssignments.productId, productId));
    if (binId) conditions.push(eq(productBinAssignments.binId, binId));
    const assignments = await db.select().from(productBinAssignments).where(and(...conditions));
    res.json(assignments);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post("/api/ecommerce/warehouse/bin-assignments", requireAuth, requireModule("ecommerce"), async (req, res) => {
  try {
    const companyId = Number(req.query.companyId || req.body.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId required" });
    const data = insertProductBinSchema.parse({ ...req.body, companyId });
    const [assignment] = await db.insert(productBinAssignments).values(data).returning();
    res.json(assignment);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.put("/api/ecommerce/warehouse/bin-assignments/:id", requireAuth, requireModule("ecommerce"), async (req, res) => {
  try {
    const companyId = Number(req.query.companyId || req.body.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId required" });
    const id = Number(req.params.id);
    const [assignment] = await db.update(productBinAssignments).set({ ...req.body, updatedAt: new Date() }).where(and(eq(productBinAssignments.id, id), eq(productBinAssignments.companyId, companyId))).returning();
    res.json(assignment);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.delete("/api/ecommerce/warehouse/bin-assignments/:id", requireAuth, requireModule("ecommerce"), async (req, res) => {
  try {
    const companyId = Number(req.query.companyId || req.body.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId required" });
    const id = Number(req.params.id);
    await db.delete(productBinAssignments).where(and(eq(productBinAssignments.id, id), eq(productBinAssignments.companyId, companyId)));
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.get("/api/ecommerce/warehouse/bin-map", requireAuth, requireModule("ecommerce"), async (req, res) => {
  try {
    const companyId = Number(req.query.companyId || req.body.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId required" });
    const warehouseId = req.query.warehouseId ? Number(req.query.warehouseId) : undefined;
    const zoneConditions = [eq(warehouseZones.companyId, companyId)];
    if (warehouseId) zoneConditions.push(eq(warehouseZones.warehouseId, warehouseId));
    const zones = await db.select().from(warehouseZones).where(and(...zoneConditions)).orderBy(asc(warehouseZones.sortOrder));
    const binConditions = [eq(warehouseBins.companyId, companyId)];
    if (warehouseId) binConditions.push(eq(warehouseBins.warehouseId, warehouseId));
    const bins = await db.select().from(warehouseBins).where(and(...binConditions)).orderBy(asc(warehouseBins.sortOrder));
    const assignments = await db.select().from(productBinAssignments).where(eq(productBinAssignments.companyId, companyId));
    const binMap = zones.map(zone => ({
      ...zone,
      bins: bins.filter(b => b.zoneId === zone.id).map(bin => ({
        ...bin,
        assignments: assignments.filter(a => a.binId === bin.id),
        occupancy: assignments.filter(a => a.binId === bin.id).reduce((sum, a) => sum + (a.qty || 0), 0),
      })),
    }));
    res.json(binMap);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ========== Wave/Batch Picking ==========

app.get("/api/ecommerce/picking/waves", requireAuth, requireModule("ecommerce"), async (req, res) => {
  try {
    const companyId = Number(req.query.companyId || req.body.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId required" });
    const status = req.query.status ? String(req.query.status) : undefined;
    const conditions = [eq(pickingWaves.companyId, companyId)];
    if (status) conditions.push(eq(pickingWaves.status, status));
    const waves = await db.select().from(pickingWaves).where(and(...conditions)).orderBy(desc(pickingWaves.createdAt));
    res.json(waves);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post("/api/ecommerce/picking/waves", requireAuth, requireModule("ecommerce"), async (req, res) => {
  try {
    const companyId = Number(req.query.companyId || req.body.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId required" });
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const existing = await db.select().from(pickingWaves).where(and(eq(pickingWaves.companyId, companyId), sql`${pickingWaves.waveNo} LIKE ${"WV-" + dateStr + "%"}`)).orderBy(desc(pickingWaves.waveNo));
    let seq = 1;
    if (existing.length > 0) {
      const lastNo = existing[0].waveNo;
      const parts = lastNo.split("-");
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }
    const waveNo = `WV-${dateStr}-${String(seq).padStart(3, "0")}`;
    const user = req.user as any;
    const data = insertPickingWaveSchema.parse({ ...req.body, companyId, waveNo, createdBy: user?.id });
    const [wave] = await db.insert(pickingWaves).values(data).returning();
    res.json(wave);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.get("/api/ecommerce/picking/waves/:id", requireAuth, requireModule("ecommerce"), async (req, res) => {
  try {
    const companyId = Number(req.query.companyId || req.body.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId required" });
    const id = Number(req.params.id);
    const [wave] = await db.select().from(pickingWaves).where(and(eq(pickingWaves.id, id), eq(pickingWaves.companyId, companyId)));
    if (!wave) return res.status(404).json({ message: "Wave not found" });
    const items = await db.select().from(pickingWaveItems).where(eq(pickingWaveItems.waveId, id)).orderBy(asc(pickingWaveItems.sortOrder));
    res.json({ ...wave, items });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.put("/api/ecommerce/picking/waves/:id", requireAuth, requireModule("ecommerce"), async (req, res) => {
  try {
    const companyId = Number(req.query.companyId || req.body.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId required" });
    const id = Number(req.params.id);
    const [wave] = await db.update(pickingWaves).set(req.body).where(and(eq(pickingWaves.id, id), eq(pickingWaves.companyId, companyId))).returning();
    res.json(wave);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post("/api/ecommerce/picking/waves/:id/assign", requireAuth, requireModule("ecommerce"), async (req, res) => {
  try {
    const companyId = Number(req.query.companyId || req.body.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId required" });
    const id = Number(req.params.id);
    const { assignedTo, assignedName } = req.body;
    const [wave] = await db.update(pickingWaves).set({ assignedTo, assignedName }).where(and(eq(pickingWaves.id, id), eq(pickingWaves.companyId, companyId))).returning();
    res.json(wave);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post("/api/ecommerce/picking/waves/:id/start", requireAuth, requireModule("ecommerce"), async (req, res) => {
  try {
    const companyId = Number(req.query.companyId || req.body.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId required" });
    const id = Number(req.params.id);
    const [wave] = await db.update(pickingWaves).set({ status: "picking", startedAt: new Date() }).where(and(eq(pickingWaves.id, id), eq(pickingWaves.companyId, companyId))).returning();
    res.json(wave);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post("/api/ecommerce/picking/waves/:id/complete", requireAuth, requireModule("ecommerce"), async (req, res) => {
  try {
    const companyId = Number(req.query.companyId || req.body.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId required" });
    const id = Number(req.params.id);
    const [wave] = await db.update(pickingWaves).set({ status: "completed", completedAt: new Date() }).where(and(eq(pickingWaves.id, id), eq(pickingWaves.companyId, companyId))).returning();
    res.json(wave);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.get("/api/ecommerce/picking/waves/:id/items", requireAuth, requireModule("ecommerce"), async (req, res) => {
  try {
    const companyId = Number(req.query.companyId || req.body.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId required" });
    const id = Number(req.params.id);
    const [wave] = await db.select().from(pickingWaves).where(and(eq(pickingWaves.id, id), eq(pickingWaves.companyId, companyId)));
    if (!wave) return res.status(404).json({ message: "Wave not found" });
    const items = await db.select().from(pickingWaveItems).where(eq(pickingWaveItems.waveId, id)).orderBy(asc(pickingWaveItems.sortOrder));
    res.json(items);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post("/api/ecommerce/picking/waves/:id/items/:itemId/pick", requireAuth, requireModule("ecommerce"), async (req, res) => {
  try {
    const companyId = Number(req.query.companyId || req.body.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId required" });
    const id = Number(req.params.id);
    const itemId = Number(req.params.itemId);
    const user = req.user as any;
    const { pickedQty } = req.body;
    const [item] = await db.update(pickingWaveItems).set({ pickedQty: pickedQty || 0, pickedAt: new Date(), pickedBy: user?.id, status: "picked" }).where(eq(pickingWaveItems.id, itemId)).returning();
    const allItems = await db.select().from(pickingWaveItems).where(eq(pickingWaveItems.waveId, id));
    const pickedCount = allItems.filter(i => i.status === "picked").length;
    await db.update(pickingWaves).set({ pickedItems: pickedCount }).where(eq(pickingWaves.id, id));
    res.json(item);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post("/api/ecommerce/picking/waves/auto-create", requireAuth, requireModule("ecommerce"), async (req, res) => {
  try {
    const companyId = Number(req.query.companyId || req.body.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId required" });
    const pendingOrders = await ecomDb.select().from(ecommerceOrders).where(and(eq(ecommerceOrders.companyId, companyId), eq(ecommerceOrders.status, "pending")));
    if (pendingOrders.length === 0) return res.json({ message: "No pending orders", waves: [] });
    const groups: Record<string, typeof pendingOrders> = {};
    for (const order of pendingOrders) {
      const key = order.carrier || "default";
      if (!groups[key]) groups[key] = [];
      groups[key].push(order);
    }
    const user = req.user as any;
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const existingWaves = await db.select().from(pickingWaves).where(and(eq(pickingWaves.companyId, companyId), sql`${pickingWaves.waveNo} LIKE ${"WV-" + dateStr + "%"}`)).orderBy(desc(pickingWaves.waveNo));
    let seq = 1;
    if (existingWaves.length > 0) {
      const parts = existingWaves[0].waveNo.split("-");
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }
    const createdWaves: any[] = [];
    for (const [carrier, orders] of Object.entries(groups)) {
      const waveNo = `WV-${dateStr}-${String(seq).padStart(3, "0")}`;
      seq++;
      const orderItems = [];
      for (const order of orders) {
        const items = await ecomDb.select().from(ecommerceOrderItems).where(eq(ecommerceOrderItems.orderId, order.id));
        for (const item of items) {
          orderItems.push({ orderId: order.id, orderNo: order.orderNo, productName: item.productName, sku: item.sku, qty: item.quantity || 1 });
        }
      }
      const [wave] = await db.insert(pickingWaves).values({
        companyId, waveNo, waveType: "auto", status: "draft", carrier: carrier === "default" ? null : carrier,
        totalOrders: orders.length, totalItems: orderItems.length, createdBy: user?.id,
      }).returning();
      for (let i = 0; i < orderItems.length; i++) {
        await db.insert(pickingWaveItems).values({
          waveId: wave.id, orderId: orderItems[i].orderId, orderNo: orderItems[i].orderNo,
          productName: orderItems[i].productName, sku: orderItems[i].sku, qty: orderItems[i].qty, sortOrder: i,
        });
      }
      createdWaves.push(wave);
    }
    res.json({ waves: createdWaves, count: createdWaves.length });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

}
