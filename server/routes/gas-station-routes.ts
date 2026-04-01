import { Express } from "express";
import { db } from "../db";
import { eq, and, sql, desc, gte, lte } from "drizzle-orm";
import {
  fuelProducts, fuelTanks, fuelPumps, fuelNozzles,
  dailyFuelSales, fuelReceivings, tankDippings, localTaxRecords,
  gasStationCreditCustomers, taxInvoices, taxInvoiceItems,
  insertFuelProductSchema, insertFuelTankSchema, insertFuelPumpSchema,
  insertFuelNozzleSchema, insertDailyFuelSaleSchema, insertFuelReceivingSchema,
  insertTankDippingSchema, insertLocalTaxRecordSchema,
} from "@shared/schema";
import { requireAuth } from "../route-middleware";
import { createAutoJournalEntry, resolvePaymentMethodAccountCode } from "../route-helpers";

function getCompanyId(req: any): number {
  const id = Number(req.query.companyId);
  if (!id) throw new Error("companyId required");
  return id;
}

export function registerGasStationRoutes(app: Express) {

  app.get("/api/gas-station/fuel-products", requireAuth, async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      const rows = await db.select().from(fuelProducts).where(eq(fuelProducts.companyId, companyId)).orderBy(fuelProducts.sortOrder);
      res.json(rows);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.post("/api/gas-station/fuel-products", requireAuth, async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      const data = { ...req.body, companyId };
      const [row] = await db.insert(fuelProducts).values(data).returning();
      res.json(row);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.patch("/api/gas-station/fuel-products/:id", requireAuth, async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      const id = Number(req.params.id);
      const { code, name, nameTh, fuelGroup, unitPrice, vatRate, exciseTaxRate, municipalTaxRate, isActive } = req.body;
      const [row] = await db.update(fuelProducts)
        .set({ code, name, nameTh, fuelGroup, unitPrice, vatRate, exciseTaxRate, municipalTaxRate, isActive, updatedAt: new Date() })
        .where(and(eq(fuelProducts.id, id), eq(fuelProducts.companyId, companyId)))
        .returning();
      res.json(row);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.post("/api/gas-station/fuel-products/seed", requireAuth, async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      const { products: items } = req.body;
      const rows = [];
      for (let i = 0; i < items.length; i++) {
        const [row] = await db.insert(fuelProducts).values({ ...items[i], companyId, sortOrder: i }).returning();
        rows.push(row);
      }
      res.json(rows);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.get("/api/gas-station/fuel-tanks", requireAuth, async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      const rows = await db.select().from(fuelTanks).where(eq(fuelTanks.companyId, companyId)).orderBy(fuelTanks.tankNo);
      res.json(rows);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.post("/api/gas-station/fuel-tanks", requireAuth, async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      const data = { ...req.body, companyId };
      const [row] = await db.insert(fuelTanks).values(data).returning();
      res.json(row);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.get("/api/gas-station/fuel-pumps", requireAuth, async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      const pumps = await db.select().from(fuelPumps).where(eq(fuelPumps.companyId, companyId)).orderBy(fuelPumps.pumpNo);
      const nozzles = await db.select().from(fuelNozzles).where(eq(fuelNozzles.companyId, companyId));
      const result = pumps.map(p => ({
        ...p,
        nozzles: nozzles.filter(n => n.pumpId === p.id),
      }));
      res.json(result);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.post("/api/gas-station/fuel-pumps", requireAuth, async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      const { nozzles: nozzleData, ...pumpData } = req.body;
      const [pump] = await db.insert(fuelPumps).values({ ...pumpData, companyId }).returning();
      const createdNozzles = [];
      if (nozzleData?.length) {
        for (const n of nozzleData) {
          const [nozzle] = await db.insert(fuelNozzles).values({
            companyId,
            pumpId: pump.id,
            nozzleNo: n.nozzleNo,
            fuelProductId: n.fuelProductId,
            tankId: n.tankId || null,
          }).returning();
          createdNozzles.push(nozzle);
        }
      }
      res.json({ ...pump, nozzles: createdNozzles });
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.get("/api/gas-station/daily-sales", requireAuth, async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      const date = req.query.date as string;
      let query = db.select().from(dailyFuelSales).where(eq(dailyFuelSales.companyId, companyId));
      if (date) {
        const rows = await db.select().from(dailyFuelSales).where(and(eq(dailyFuelSales.companyId, companyId), eq(dailyFuelSales.saleDate, date)));
        return res.json(rows);
      }
      const rows = await query.orderBy(desc(dailyFuelSales.saleDate));
      res.json(rows);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.post("/api/gas-station/daily-sales", requireAuth, async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      const { saleDate, lines } = req.body;
      const userId = (req.user as any)?.id;

      await db.delete(dailyFuelSales).where(and(eq(dailyFuelSales.companyId, companyId), eq(dailyFuelSales.saleDate, saleDate)));

      const created = [];
      for (const line of lines) {
        const liters = Number(line.litersSold || 0);
        if (liters <= 0 && !line.meterOpen && !line.meterClose) continue;

        const nozzleId = Number(line.nozzleId);
        const nozzle = await db.select().from(fuelNozzles).where(and(eq(fuelNozzles.id, nozzleId), eq(fuelNozzles.companyId, companyId))).then(r => r[0]);
        if (!nozzle) continue;

        const [row] = await db.insert(dailyFuelSales).values({
          companyId,
          saleDate,
          nozzleId,
          fuelProductId: line.fuelProductId || nozzle?.fuelProductId,
          meterOpen: line.meterOpen || "0",
          meterClose: line.meterClose || "0",
          litersSold: line.litersSold || "0",
          unitPrice: line.unitPrice || "0",
          totalAmount: line.totalAmount || "0",
          testLiters: line.testLiters || "0",
          paymentMethod: line.paymentMethod || "cash",
          payments: line.payments ? JSON.stringify(line.payments) : "[]",
          creditCustomerId: line.creditCustomerId ? Number(line.creditCustomerId) : null,
          createdBy: userId,
        }).returning();
        created.push(row);

        if (nozzle?.tankId && liters > 0) {
          await db.update(fuelTanks).set({
            currentVolume: sql`GREATEST(0, CAST(${fuelTanks.currentVolume} AS numeric) - ${liters})`,
            updatedAt: new Date(),
          }).where(and(eq(fuelTanks.id, nozzle.tankId), eq(fuelTanks.companyId, companyId)));
        }
      }
      res.json(created);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.get("/api/gas-station/daily-sales/summary", requireAuth, async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      if (!startDate || !endDate) return res.json([]);

      const rows = await db.select({
        fuelProductId: dailyFuelSales.fuelProductId,
        saleDate: dailyFuelSales.saleDate,
        totalLiters: sql<string>`SUM(CAST(${dailyFuelSales.litersSold} AS numeric))`,
        totalAmount: sql<string>`SUM(CAST(${dailyFuelSales.totalAmount} AS numeric))`,
      })
      .from(dailyFuelSales)
      .where(and(
        eq(dailyFuelSales.companyId, companyId),
        gte(dailyFuelSales.saleDate, startDate),
        lte(dailyFuelSales.saleDate, endDate),
      ))
      .groupBy(dailyFuelSales.fuelProductId, dailyFuelSales.saleDate);
      res.json(rows);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.get("/api/gas-station/dashboard", requireAuth, async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      const startDate = (req.query.startDate as string) || new Date().toISOString().slice(0, 10);
      const endDate = (req.query.endDate as string) || startDate;

      const salesByProduct = await db.select({
        fuelProductId: dailyFuelSales.fuelProductId,
        totalLiters: sql<string>`SUM(CAST(${dailyFuelSales.litersSold} AS numeric))`,
        totalAmount: sql<string>`SUM(CAST(${dailyFuelSales.totalAmount} AS numeric))`,
        count: sql<string>`COUNT(*)`,
      })
      .from(dailyFuelSales)
      .where(and(
        eq(dailyFuelSales.companyId, companyId),
        gte(dailyFuelSales.saleDate, startDate),
        lte(dailyFuelSales.saleDate, endDate),
      ))
      .groupBy(dailyFuelSales.fuelProductId);

      const allSalesRows = await db.select({
        payments: dailyFuelSales.payments,
        paymentMethod: dailyFuelSales.paymentMethod,
        totalAmount: dailyFuelSales.totalAmount,
      })
      .from(dailyFuelSales)
      .where(and(
        eq(dailyFuelSales.companyId, companyId),
        gte(dailyFuelSales.saleDate, startDate),
        lte(dailyFuelSales.saleDate, endDate),
      ));

      const paymentAgg: Record<string, { totalAmount: number; count: number }> = {};
      for (const row of allSalesRows) {
        let parsed: any[] = [];
        try { parsed = JSON.parse(row.payments || "[]"); } catch {}
        if (parsed.length > 0) {
          for (const p of parsed) {
            const key = p.method || "cash";
            if (!paymentAgg[key]) paymentAgg[key] = { totalAmount: 0, count: 0 };
            paymentAgg[key].totalAmount += Number(p.amount || 0);
            paymentAgg[key].count += 1;
          }
        } else {
          const key = row.paymentMethod || "cash";
          if (!paymentAgg[key]) paymentAgg[key] = { totalAmount: 0, count: 0 };
          paymentAgg[key].totalAmount += Number(row.totalAmount || 0);
          paymentAgg[key].count += 1;
        }
      }
      const salesByPayment = Object.entries(paymentAgg).map(([method, data]) => ({
        paymentMethod: method,
        totalAmount: String(data.totalAmount),
        totalLiters: "0",
        count: String(data.count),
      }));

      const dailyTrend = await db.select({
        saleDate: dailyFuelSales.saleDate,
        totalLiters: sql<string>`SUM(CAST(${dailyFuelSales.litersSold} AS numeric))`,
        totalAmount: sql<string>`SUM(CAST(${dailyFuelSales.totalAmount} AS numeric))`,
      })
      .from(dailyFuelSales)
      .where(and(
        eq(dailyFuelSales.companyId, companyId),
        gte(dailyFuelSales.saleDate, startDate),
        lte(dailyFuelSales.saleDate, endDate),
      ))
      .groupBy(dailyFuelSales.saleDate)
      .orderBy(dailyFuelSales.saleDate);

      const products = await db.select().from(fuelProducts).where(eq(fuelProducts.companyId, companyId));
      const tanks = await db.select().from(fuelTanks).where(eq(fuelTanks.companyId, companyId));

      res.json({ salesByProduct, salesByPayment, dailyTrend, products, tanks });
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.get("/api/gas-station/fuel-receivings", requireAuth, async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      const rows = await db.select().from(fuelReceivings).where(eq(fuelReceivings.companyId, companyId)).orderBy(desc(fuelReceivings.receiveDate));
      res.json(rows);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.post("/api/gas-station/fuel-receivings", requireAuth, async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      const userId = (req.user as any)?.id;
      const tankId = Number(req.body.tankId);

      const tank = await db.select().from(fuelTanks).where(and(eq(fuelTanks.id, tankId), eq(fuelTanks.companyId, companyId))).then(r => r[0]);
      if (!tank) return res.status(404).json({ message: "Tank not found" });
      const volumeBefore = tank.currentVolume || "0";
      const volumeReceived = Number(req.body.volumeReceived || 0);
      const volumeAfter = String((Number(volumeBefore) + volumeReceived).toFixed(2));

      const [row] = await db.insert(fuelReceivings).values({
        ...req.body,
        companyId,
        volumeBefore,
        volumeAfter,
        createdBy: userId,
      }).returning();

      await db.update(fuelTanks).set({
        currentVolume: volumeAfter,
        updatedAt: new Date(),
      }).where(and(eq(fuelTanks.id, tankId), eq(fuelTanks.companyId, companyId)));

      res.json(row);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.get("/api/gas-station/tank-dippings", requireAuth, async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;

      let conditions = [eq(tankDippings.companyId, companyId)];
      if (startDate) conditions.push(gte(tankDippings.dipDate, startDate));
      if (endDate) conditions.push(lte(tankDippings.dipDate, endDate));

      const rows = await db.select().from(tankDippings).where(and(...conditions)).orderBy(desc(tankDippings.dipDate));
      res.json(rows);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.post("/api/gas-station/tank-dippings", requireAuth, async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      const userId = (req.user as any)?.id;
      const [row] = await db.insert(tankDippings).values({
        ...req.body,
        companyId,
        createdBy: userId,
      }).returning();
      res.json(row);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.get("/api/gas-station/local-tax", requireAuth, async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      const rows = await db.select().from(localTaxRecords).where(eq(localTaxRecords.companyId, companyId)).orderBy(desc(localTaxRecords.createdAt));
      res.json(rows);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.post("/api/gas-station/local-tax", requireAuth, async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      const userId = (req.user as any)?.id;
      const [row] = await db.insert(localTaxRecords).values({
        ...req.body,
        companyId,
        createdBy: userId,
      }).returning();
      res.json(row);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.patch("/api/gas-station/local-tax/:id", requireAuth, async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      const id = Number(req.params.id);
      const { status, paidDate } = req.body;
      const [row] = await db.update(localTaxRecords)
        .set({ status, paidDate, updatedAt: new Date() })
        .where(and(eq(localTaxRecords.id, id), eq(localTaxRecords.companyId, companyId)))
        .returning();
      res.json(row);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.get("/api/gas-station/tax-form-data", requireAuth, async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      const month = req.query.month as string;
      const year = req.query.year as string;
      if (!month || !year) return res.json({ salesByProduct: [], stockMovement: [] });

      const startDate = `${year}-${month.padStart(2, "0")}-01`;
      const lastDay = new Date(Number(year), Number(month), 0).getDate();
      const endDate = `${year}-${month.padStart(2, "0")}-${lastDay}`;

      const prevMonth = Number(month) === 1 ? 12 : Number(month) - 1;
      const prevYear = Number(month) === 1 ? Number(year) - 1 : Number(year);
      const prevStartDate = `${prevYear}-${String(prevMonth).padStart(2, "0")}-01`;
      const prevLastDay = new Date(prevYear, prevMonth, 0).getDate();
      const prevEndDate = `${prevYear}-${String(prevMonth).padStart(2, "0")}-${prevLastDay}`;

      const salesByProduct = await db.select({
        fuelProductId: dailyFuelSales.fuelProductId,
        totalLiters: sql<string>`SUM(CAST(${dailyFuelSales.litersSold} AS numeric))`,
        totalAmount: sql<string>`SUM(CAST(${dailyFuelSales.totalAmount} AS numeric))`,
      })
      .from(dailyFuelSales)
      .where(and(
        eq(dailyFuelSales.companyId, companyId),
        gte(dailyFuelSales.saleDate, startDate),
        lte(dailyFuelSales.saleDate, endDate),
      ))
      .groupBy(dailyFuelSales.fuelProductId);

      const products = await db.select().from(fuelProducts).where(eq(fuelProducts.companyId, companyId));
      const tanks = await db.select().from(fuelTanks).where(eq(fuelTanks.companyId, companyId));

      const receivingsByProduct = await db.select({
        fuelProductId: fuelReceivings.fuelProductId,
        totalLiters: sql<string>`SUM(CAST(${fuelReceivings.liters} AS numeric))`,
      })
      .from(fuelReceivings)
      .where(and(
        eq(fuelReceivings.companyId, companyId),
        gte(fuelReceivings.receiveDate, startDate),
        lte(fuelReceivings.receiveDate, endDate),
      ))
      .groupBy(fuelReceivings.fuelProductId);

      const dippingStart = await db.select({
        tankId: tankDippings.tankId,
        measuredVolume: tankDippings.measuredVolume,
      })
      .from(tankDippings)
      .where(and(
        eq(tankDippings.companyId, companyId),
        lte(tankDippings.dippingDate, prevEndDate),
      ))
      .orderBy(desc(tankDippings.dippingDate));

      const dippingEnd = await db.select({
        tankId: tankDippings.tankId,
        measuredVolume: tankDippings.measuredVolume,
      })
      .from(tankDippings)
      .where(and(
        eq(tankDippings.companyId, companyId),
        lte(tankDippings.dippingDate, endDate),
      ))
      .orderBy(desc(tankDippings.dippingDate));

      res.json({
        salesByProduct,
        products,
        tanks,
        receivingsByProduct,
        dippingStart,
        dippingEnd,
        period: { month, year, startDate, endDate },
      });
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.get("/api/gas-station/integration-config", requireAuth, async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      const rows = await db.execute(sql`SELECT * FROM gas_station_integration_config WHERE company_id = ${companyId} LIMIT 1`);
      const row = (rows as any).rows?.[0] || (rows as any)[0] || null;
      res.json(row || { posSystem: "manual", apiUrl: "", apiKey: "", autoSync: false, syncIntervalMinutes: 30 });
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.post("/api/gas-station/integration-config", requireAuth, async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      const { posSystem, apiUrl, apiKey, autoSync, syncIntervalMinutes } = req.body;
      const existing = await db.execute(sql`SELECT id FROM gas_station_integration_config WHERE company_id = ${companyId} LIMIT 1`);
      const existingRow = (existing as any).rows?.[0] || (existing as any)[0] || null;

      if (existingRow) {
        await db.execute(sql`UPDATE gas_station_integration_config SET
          pos_system = ${posSystem || 'manual'},
          api_url = ${apiUrl || ''},
          api_key = ${apiKey || ''},
          auto_sync = ${autoSync ?? false},
          sync_interval_minutes = ${syncIntervalMinutes || 30},
          updated_at = NOW()
        WHERE company_id = ${companyId}`);
      } else {
        await db.execute(sql`INSERT INTO gas_station_integration_config (company_id, pos_system, api_url, api_key, auto_sync, sync_interval_minutes)
        VALUES (${companyId}, ${posSystem || 'manual'}, ${apiUrl || ''}, ${apiKey || ''}, ${autoSync ?? false}, ${syncIntervalMinutes || 30})`);
      }
      res.json({ success: true });
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  // ===== Credit Customers (ลูกค้าเชื่อ) =====
  app.get("/api/gas-station/credit-customers", requireAuth, async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      const rows = await db.select().from(gasStationCreditCustomers)
        .where(eq(gasStationCreditCustomers.companyId, companyId))
        .orderBy(gasStationCreditCustomers.customerName);
      res.json(rows);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.post("/api/gas-station/credit-customers", requireAuth, async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      const [row] = await db.insert(gasStationCreditCustomers).values({
        companyId,
        customerName: req.body.customerName,
        taxId: req.body.taxId || null,
        address: req.body.address || null,
        phone: req.body.phone || null,
        creditLimit: req.body.creditLimit || "0",
        contactPerson: req.body.contactPerson || null,
        fleetCardNo: req.body.fleetCardNo || null,
        notes: req.body.notes || null,
      }).returning();
      res.status(201).json(row);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.patch("/api/gas-station/credit-customers/:id", requireAuth, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const [row] = await db.update(gasStationCreditCustomers)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(gasStationCreditCustomers.id, id))
        .returning();
      res.json(row);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.delete("/api/gas-station/credit-customers/:id", requireAuth, async (req, res) => {
    try {
      await db.delete(gasStationCreditCustomers).where(eq(gasStationCreditCustomers.id, Number(req.params.id)));
      res.json({ success: true });
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  // ===== Generate Tax Invoices from Daily Sales =====
  app.post("/api/gas-station/generate-invoices", requireAuth, async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      const { saleDate } = req.body;
      const user = req.user as any;
      if (!saleDate) return res.status(400).json({ message: "saleDate required" });

      const sales = await db.select().from(dailyFuelSales)
        .where(and(
          eq(dailyFuelSales.companyId, companyId),
          eq(dailyFuelSales.saleDate, saleDate),
        ));

      if (sales.length === 0) return res.status(400).json({ message: "ไม่มียอดขายในวันที่เลือก" });

      const products = await db.select().from(fuelProducts)
        .where(eq(fuelProducts.companyId, companyId));
      const productMap = new Map(products.map(p => [p.id, p]));

      const creditCustomerRows = await db.select().from(gasStationCreditCustomers)
        .where(eq(gasStationCreditCustomers.companyId, companyId));
      const creditMap = new Map(creditCustomerRows.map(c => [c.id, c]));

      const cashSales: typeof sales = [];
      const creditSalesMap = new Map<number, typeof sales>();

      for (const sale of sales) {
        let payments: any[] = [];
        try { payments = JSON.parse(sale.payments || "[]"); } catch {}

        const hasCreditPayment = payments.some((p: any) => p.method === "credit") ||
          sale.paymentMethod === "credit";

        if (hasCreditPayment && sale.creditCustomerId) {
          const existing = creditSalesMap.get(sale.creditCustomerId) || [];
          existing.push(sale);
          creditSalesMap.set(sale.creditCustomerId, existing);
        } else {
          cashSales.push(sale);
        }
      }

      const createdInvoices: any[] = [];

      const getNextTivNo = async (companyId: number, date: string): Promise<string> => {
        const year = date.slice(0, 4);
        const month = date.slice(5, 7);
        const prefix = `TIV${year}${month}`;
        const result = await db.select({ no: taxInvoices.taxInvoiceNo })
          .from(taxInvoices)
          .where(and(
            eq(taxInvoices.companyId, companyId),
            sql`${taxInvoices.taxInvoiceNo} LIKE ${prefix + '%'}`,
          ))
          .orderBy(desc(taxInvoices.taxInvoiceNo))
          .limit(1);
        const last = result[0]?.no;
        const seq = last ? (parseInt(last.replace(prefix, "")) || 0) + 1 : 1;
        return `${prefix}${String(seq).padStart(4, "0")}`;
      };

      // 1) Cash summary invoice (1 per day)
      if (cashSales.length > 0) {
        const subtotal = cashSales.reduce((s, r) => s + Number(r.totalAmount || 0), 0);
        const vatAmount = Math.round((subtotal * 7 / 107) * 100) / 100;
        const beforeVat = Math.round((subtotal - vatAmount) * 100) / 100;
        const taxInvoiceNo = await getNextTivNo(companyId, saleDate);

        const items = cashSales.map(sale => {
          const prod = productMap.get(sale.fuelProductId);
          return {
            productName: prod?.nameTh || "น้ำมัน",
            description: `${sale.litersSold} ลิตร x ${sale.unitPrice} บาท`,
            qty: String(sale.litersSold),
            unit: "ลิตร",
            unitPrice: String(sale.unitPrice),
            total: String(sale.totalAmount),
            vatType: "vat7",
          };
        });

        let primaryPayment = "เงินสด";
        const allPayments: any[] = [];
        for (const sale of cashSales) {
          try { allPayments.push(...JSON.parse(sale.payments || "[]")); } catch {}
        }
        if (allPayments.length > 0) {
          const methodTotals: Record<string, number> = {};
          for (const p of allPayments) {
            methodTotals[p.method] = (methodTotals[p.method] || 0) + Number(p.amount || 0);
          }
          const topMethod = Object.entries(methodTotals).sort((a, b) => b[1] - a[1])[0]?.[0];
          const methodLabels: Record<string, string> = {
            cash: "เงินสด", transfer: "โอนเงิน", credit_card: "บัตรเครดิต",
            debit_card: "บัตรเดบิต", qr_payment: "QR Payment", fleet_card: "Fleet Card",
          };
          primaryPayment = methodLabels[topMethod] || "เงินสด";
        }

        const result = await db.transaction(async (tx) => {
          const [doc] = await tx.insert(taxInvoices).values({
            companyId,
            taxInvoiceNo,
            taxInvoiceDate: saleDate,
            customerName: "ลูกค้าเงินสด (สรุปรายวัน)",
            customerAddress: "",
            subtotal: String(beforeVat),
            vatAmount: String(vatAmount),
            totalAmount: String(subtotal),
            status: "approved",
            docPrefix: "TIV",
            paymentMethod: primaryPayment,
            notes: `สรุปยอดขายน้ำมันรายวัน ${saleDate}`,
            createdBy: user.id,
          }).returning();

          for (const item of items) {
            await tx.insert(taxInvoiceItems).values({
              taxInvoiceId: doc.id,
              productName: item.productName,
              description: item.description,
              qty: item.qty,
              unit: item.unit,
              unitPrice: item.unitPrice,
              total: item.total,
              vatType: item.vatType,
            });
          }
          return doc;
        });

        try {
          const pmAccCode = await resolvePaymentMethodAccountCode(companyId, primaryPayment);
          await createAutoJournalEntry({
            companyId,
            documentType: "tax_invoice",
            sourceDocType: "tax_invoice",
            sourceDocId: result.id,
            docDate: saleDate,
            docNo: taxInvoiceNo,
            subtotal: String(beforeVat),
            vatAmount: String(vatAmount),
            totalAmount: String(subtotal),
            withholdingTax: "0",
            currencyCode: "THB",
            exchangeRate: "1",
            userId: user.id,
            customerName: "ลูกค้าเงินสด (สรุปรายวัน)",
            paymentMethod: primaryPayment,
            paymentMethodAccountCode: pmAccCode,
            overrideLines: body?.journalOverrideLines || req?.body?.journalOverrideLines || undefined,
          });
        } catch (e) {}

        createdInvoices.push({ type: "cash_summary", ...result });
      }

      // 2) Per-credit-customer invoices
      for (const [custId, custSales] of creditSalesMap.entries()) {
        const customer = creditMap.get(custId);
        if (!customer) continue;

        const subtotal = custSales.reduce((s, r) => s + Number(r.totalAmount || 0), 0);
        const vatAmount = Math.round((subtotal * 7 / 107) * 100) / 100;
        const beforeVat = Math.round((subtotal - vatAmount) * 100) / 100;
        const taxInvoiceNo = await getNextTivNo(companyId, saleDate);

        const items = custSales.map(sale => {
          const prod = productMap.get(sale.fuelProductId);
          return {
            productName: prod?.nameTh || "น้ำมัน",
            description: `${sale.litersSold} ลิตร x ${sale.unitPrice} บาท`,
            qty: String(sale.litersSold),
            unit: "ลิตร",
            unitPrice: String(sale.unitPrice),
            total: String(sale.totalAmount),
            vatType: "vat7",
          };
        });

        const result = await db.transaction(async (tx) => {
          const [doc] = await tx.insert(taxInvoices).values({
            companyId,
            taxInvoiceNo,
            taxInvoiceDate: saleDate,
            customerId: null,
            customerName: customer.customerName,
            customerAddress: customer.address || "",
            customerTaxId: customer.taxId || null,
            subtotal: String(beforeVat),
            vatAmount: String(vatAmount),
            totalAmount: String(subtotal),
            status: "approved",
            docPrefix: "TIV",
            paymentMethod: "เครดิต",
            notes: `ยอดขายน้ำมันเชื่อ ${saleDate} - ${customer.customerName}`,
            createdBy: user.id,
          }).returning();

          for (const item of items) {
            await tx.insert(taxInvoiceItems).values({
              taxInvoiceId: doc.id,
              productName: item.productName,
              description: item.description,
              qty: item.qty,
              unit: item.unit,
              unitPrice: item.unitPrice,
              total: item.total,
              vatType: item.vatType,
            });
          }
          return doc;
        });

        try {
          const pmAccCode = await resolvePaymentMethodAccountCode(companyId, "เครดิต");
          await createAutoJournalEntry({
            companyId,
            documentType: "tax_invoice",
            sourceDocType: "tax_invoice",
            sourceDocId: result.id,
            docDate: saleDate,
            docNo: taxInvoiceNo,
            subtotal: String(beforeVat),
            vatAmount: String(vatAmount),
            totalAmount: String(subtotal),
            withholdingTax: "0",
            currencyCode: "THB",
            exchangeRate: "1",
            userId: user.id,
            customerName: customer.customerName,
            paymentMethod: "เครดิต",
            paymentMethodAccountCode: pmAccCode,
            overrideLines: body?.journalOverrideLines || req?.body?.journalOverrideLines || undefined,
          });
        } catch (e) {}

        createdInvoices.push({ type: "credit_customer", customerName: customer.customerName, ...result });
      }

      res.json({
        success: true,
        invoiceCount: createdInvoices.length,
        invoices: createdInvoices,
      });
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });
}
