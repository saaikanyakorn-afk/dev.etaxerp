import type { Express } from "express";
import { db } from "../db";
import { eq, and, desc, sql, gte, lte } from "drizzle-orm";
import {
  serialNumbers, traceabilityLogs, calibrationInstruments,
  bomHeaders, bomLines, products, warehouses, employees,
  manufacturingOrders,
} from "@shared/schema";
import { requireAuth, requireModule } from "../route-middleware";

export function registerManufacturingModuleRoutes(app: Express) {

  app.get("/api/manufacturing-module/serial-numbers", requireAuth, requireModule("manufacturing"), async (req, res) => {
    try {
      const companyId = Number(req.query.companyId);
      if (!companyId) return res.status(400).json({ message: "companyId required" });
      const status = req.query.status as string;
      const productId = req.query.productId ? Number(req.query.productId) : undefined;
      const search = req.query.search as string;

      const conditions: any[] = [eq(serialNumbers.companyId, companyId)];
      if (status && status !== "all") conditions.push(eq(serialNumbers.status, status));
      if (productId) conditions.push(eq(serialNumbers.productId, productId));
      if (search) conditions.push(sql`${serialNumbers.serialNumber} ILIKE ${'%' + search + '%'}`);

      const rows = await db.select().from(serialNumbers)
        .where(and(...conditions))
        .orderBy(desc(serialNumbers.createdAt))
        .limit(200);

      const productIds = [...new Set(rows.map(r => r.productId))];
      const prods = productIds.length > 0
        ? await db.select().from(products).where(sql`${products.id} IN (${sql.raw(productIds.join(",") || "0")})`)
        : [];
      const prodMap = new Map(prods.map(p => [p.id, p]));

      const warehouseIds = [...new Set(rows.filter(r => r.warehouseId).map(r => r.warehouseId!))];
      const whs = warehouseIds.length > 0
        ? await db.select().from(warehouses).where(sql`${warehouses.id} IN (${sql.raw(warehouseIds.join(",") || "0")})`)
        : [];
      const whMap = new Map(whs.map(w => [w.id, w]));

      const result = rows.map(r => ({
        ...r,
        productName: prodMap.get(r.productId)?.name || "",
        productCode: prodMap.get(r.productId)?.code || "",
        warehouseName: r.warehouseId ? whMap.get(r.warehouseId)?.name || "" : "",
      }));
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/manufacturing-module/serial-numbers", requireAuth, requireModule("manufacturing"), async (req, res) => {
    try {
      const { companyId, productId, serialNumber, warehouseId, notes } = req.body;
      if (!companyId || !productId || !serialNumber) {
        return res.status(400).json({ message: "companyId, productId, serialNumber required" });
      }

      const existing = await db.select().from(serialNumbers)
        .where(and(eq(serialNumbers.companyId, companyId), eq(serialNumbers.serialNumber, serialNumber)))
        .limit(1);
      if (existing.length > 0) {
        return res.status(400).json({ message: `Serial "${serialNumber}" มีอยู่แล้ว` });
      }

      const [created] = await db.insert(serialNumbers).values({
        companyId, productId, serialNumber,
        status: "available",
        warehouseId: warehouseId || null,
        notes: notes || null,
        createdBy: (req.user as any)?.id || null,
      }).returning();
      res.json(created);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/manufacturing-module/serial-numbers/batch", requireAuth, requireModule("manufacturing"), async (req, res) => {
    try {
      const { companyId, productId, prefix, startNo, count, warehouseId } = req.body;
      if (!companyId || !productId || !prefix || !startNo || !count) {
        return res.status(400).json({ message: "companyId, productId, prefix, startNo, count required" });
      }
      const created: any[] = [];
      const errors: string[] = [];
      for (let i = 0; i < Math.min(count, 500); i++) {
        const num = startNo + i;
        const sn = `${prefix}${String(num).padStart(4, "0")}`;
        try {
          const [row] = await db.insert(serialNumbers).values({
            companyId, productId, serialNumber: sn,
            status: "available", warehouseId: warehouseId || null,
            createdBy: (req.user as any)?.id || null,
          }).returning();
          created.push(row);
        } catch {
          errors.push(sn);
        }
      }
      res.json({ created: created.length, errors });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/manufacturing-module/validate-serial-scan", requireAuth, requireModule("manufacturing"), async (req, res) => {
    try {
      const { companyId, serialNumber, expectedPrefix, scannedSerials } = req.body;
      if (!companyId || !serialNumber) {
        return res.status(400).json({ message: "companyId, serialNumber required" });
      }

      if (expectedPrefix && !serialNumber.startsWith(expectedPrefix)) {
        return res.status(400).json({
          valid: false,
          message: `Serial ต้องขึ้นต้นด้วย "${expectedPrefix}" (Prefix Lock)`
        });
      }

      if (scannedSerials && Array.isArray(scannedSerials) && scannedSerials.includes(serialNumber)) {
        return res.status(400).json({
          valid: false,
          message: `Serial "${serialNumber}" ถูกสแกนแล้ว (ห้ามซ้ำ)`
        });
      }

      const [found] = await db.select().from(serialNumbers)
        .where(and(
          eq(serialNumbers.companyId, companyId),
          eq(serialNumbers.serialNumber, serialNumber),
        ))
        .limit(1);

      if (!found) {
        return res.status(400).json({ valid: false, message: `ไม่พบ Serial "${serialNumber}" ในระบบ` });
      }
      if (found.status !== "available") {
        return res.status(400).json({
          valid: false,
          message: `Serial "${serialNumber}" สถานะ "${found.status}" — ต้องเป็น "available" เท่านั้น`
        });
      }

      const prod = await db.select().from(products).where(eq(products.id, found.productId)).limit(1);
      res.json({
        valid: true,
        serial: found,
        productName: prod[0]?.name || "",
        productCode: prod[0]?.code || "",
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/manufacturing-module/validate-operator", requireAuth, requireModule("manufacturing"), async (req, res) => {
    try {
      const { companyId, employeeCode } = req.body;
      if (!companyId || !employeeCode) {
        return res.status(400).json({ message: "companyId, employeeCode required" });
      }
      const [emp] = await db.select().from(employees)
        .where(and(
          eq(employees.companyId, companyId),
          eq(employees.employeeCode, employeeCode),
        ))
        .limit(1);
      if (!emp) {
        return res.status(400).json({ valid: false, message: `ไม่พบรหัสพนักงาน "${employeeCode}"` });
      }
      res.json({
        valid: true,
        employee: { id: emp.id, name: `${emp.firstName} ${emp.lastName}`, code: emp.employeeCode },
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/manufacturing-module/traceability", requireAuth, requireModule("manufacturing"), async (req, res) => {
    try {
      const {
        companyId, fgSerialId, componentSerialIds, bomHeaderId,
        operatorEmployeeId, qcEmployeeId, manufacturingOrderId, notes,
      } = req.body;
      if (!companyId || !fgSerialId || !componentSerialIds?.length) {
        return res.status(400).json({ message: "companyId, fgSerialId, componentSerialIds required" });
      }

      const logs: any[] = [];
      for (const csId of componentSerialIds) {
        const [log] = await db.insert(traceabilityLogs).values({
          companyId, fgSerialId, componentSerialId: csId,
          bomHeaderId: bomHeaderId || null,
          operatorEmployeeId: operatorEmployeeId || null,
          qcEmployeeId: qcEmployeeId || null,
          manufacturingOrderId: manufacturingOrderId || null,
          notes: notes || null,
        }).returning();
        logs.push(log);
      }

      await db.update(serialNumbers).set({ status: "assembled" })
        .where(sql`${serialNumbers.id} IN (${sql.raw(componentSerialIds.join(","))})`);
      await db.update(serialNumbers).set({ status: "finished_good" })
        .where(eq(serialNumbers.id, fgSerialId));

      res.json({ created: logs.length, logs });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/manufacturing-module/traceability", requireAuth, requireModule("manufacturing"), async (req, res) => {
    try {
      const companyId = Number(req.query.companyId);
      if (!companyId) return res.status(400).json({ message: "companyId required" });
      const search = req.query.search as string;

      let fgSerialIds: number[] = [];
      if (search) {
        const matchedSerials = await db.select().from(serialNumbers)
          .where(and(
            eq(serialNumbers.companyId, companyId),
            sql`${serialNumbers.serialNumber} ILIKE ${'%' + search + '%'}`,
          ))
          .limit(50);
        fgSerialIds = matchedSerials.map(s => s.id);
        if (fgSerialIds.length === 0) return res.json([]);
      }

      const conditions: any[] = [eq(traceabilityLogs.companyId, companyId)];
      if (fgSerialIds.length > 0) {
        conditions.push(sql`(${traceabilityLogs.fgSerialId} IN (${sql.raw(fgSerialIds.join(","))}) OR ${traceabilityLogs.componentSerialId} IN (${sql.raw(fgSerialIds.join(","))}))`);
      }

      const logs = await db.select().from(traceabilityLogs)
        .where(and(...conditions))
        .orderBy(desc(traceabilityLogs.assembledAt))
        .limit(500);

      const allSerialIds = [...new Set([
        ...logs.map(l => l.fgSerialId),
        ...logs.map(l => l.componentSerialId),
      ])];
      const serials = allSerialIds.length > 0
        ? await db.select().from(serialNumbers).where(sql`${serialNumbers.id} IN (${sql.raw(allSerialIds.join(",") || "0")})`)
        : [];
      const serialMap = new Map(serials.map(s => [s.id, s]));

      const prodIds = [...new Set(serials.map(s => s.productId))];
      const prods = prodIds.length > 0
        ? await db.select().from(products).where(sql`${products.id} IN (${sql.raw(prodIds.join(",") || "0")})`)
        : [];
      const prodMap = new Map(prods.map(p => [p.id, p]));

      const empIds = [...new Set([
        ...logs.filter(l => l.operatorEmployeeId).map(l => l.operatorEmployeeId!),
        ...logs.filter(l => l.qcEmployeeId).map(l => l.qcEmployeeId!),
      ])];
      const emps = empIds.length > 0
        ? await db.select().from(employees).where(sql`${employees.id} IN (${sql.raw(empIds.join(",") || "0")})`)
        : [];
      const empMap = new Map(emps.map(e => [e.id, e]));

      const grouped = new Map<number, any>();
      for (const log of logs) {
        const fgSerial = serialMap.get(log.fgSerialId);
        const compSerial = serialMap.get(log.componentSerialId);
        if (!grouped.has(log.fgSerialId)) {
          const op = log.operatorEmployeeId ? empMap.get(log.operatorEmployeeId) : null;
          const qc = log.qcEmployeeId ? empMap.get(log.qcEmployeeId) : null;
          grouped.set(log.fgSerialId, {
            fgSerialId: log.fgSerialId,
            fgSerialNumber: fgSerial?.serialNumber || "",
            fgProductName: fgSerial ? prodMap.get(fgSerial.productId)?.name || "" : "",
            fgProductCode: fgSerial ? prodMap.get(fgSerial.productId)?.code || "" : "",
            operatorName: op ? `${op.firstName} ${op.lastName}` : "",
            qcName: qc ? `${qc.firstName} ${qc.lastName}` : "",
            assembledAt: log.assembledAt,
            components: [],
          });
        }
        grouped.get(log.fgSerialId)!.components.push({
          serialNumber: compSerial?.serialNumber || "",
          productName: compSerial ? prodMap.get(compSerial.productId)?.name || "" : "",
          productCode: compSerial ? prodMap.get(compSerial.productId)?.code || "" : "",
        });
      }

      res.json(Array.from(grouped.values()));
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/manufacturing-module/calibration", requireAuth, requireModule("manufacturing"), async (req, res) => {
    try {
      const companyId = Number(req.query.companyId);
      if (!companyId) return res.status(400).json({ message: "companyId required" });
      const rows = await db.select().from(calibrationInstruments)
        .where(eq(calibrationInstruments.companyId, companyId))
        .orderBy(calibrationInstruments.nextDueDate);
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/manufacturing-module/calibration", requireAuth, requireModule("manufacturing"), async (req, res) => {
    try {
      const { companyId, code, name, description, location, nextDueDate, lastCalibratedDate, calibrationInterval, notes } = req.body;
      if (!companyId || !code || !name) {
        return res.status(400).json({ message: "companyId, code, name required" });
      }
      const [created] = await db.insert(calibrationInstruments).values({
        companyId, code, name,
        description: description || null,
        location: location || null,
        nextDueDate: nextDueDate || null,
        lastCalibratedDate: lastCalibratedDate || null,
        calibrationInterval: calibrationInterval || 365,
        notes: notes || null,
      }).returning();
      res.json(created);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.put("/api/manufacturing-module/calibration/:id", requireAuth, requireModule("manufacturing"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { code, name, description, location, nextDueDate, lastCalibratedDate, calibrationInterval, status, notes } = req.body;
      const [updated] = await db.update(calibrationInstruments)
        .set({
          code, name,
          description: description || null,
          location: location || null,
          nextDueDate: nextDueDate || null,
          lastCalibratedDate: lastCalibratedDate || null,
          calibrationInterval: calibrationInterval || 365,
          status: status || "active",
          notes: notes || null,
        })
        .where(eq(calibrationInstruments.id, id))
        .returning();
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/manufacturing-module/calibration/:id", requireAuth, requireModule("manufacturing"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      await db.delete(calibrationInstruments).where(eq(calibrationInstruments.id, id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/manufacturing-module/calibration-alerts", requireAuth, async (req, res) => {
    try {
      const companyId = Number(req.query.companyId);
      if (!companyId) return res.status(400).json({ message: "companyId required" });

      const thirtyDaysLater = new Date();
      thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);
      const dateStr = thirtyDaysLater.toISOString().split("T")[0];

      const alerts = await db.select().from(calibrationInstruments)
        .where(and(
          eq(calibrationInstruments.companyId, companyId),
          eq(calibrationInstruments.status, "active"),
          lte(calibrationInstruments.nextDueDate, dateStr),
        ))
        .orderBy(calibrationInstruments.nextDueDate);
      res.json(alerts);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/manufacturing-module/dashboard-stats", requireAuth, requireModule("manufacturing"), async (req, res) => {
    try {
      const companyId = Number(req.query.companyId);
      if (!companyId) return res.status(400).json({ message: "companyId required" });

      const [serialCount] = await db.select({ count: sql<number>`count(*)::int` })
        .from(serialNumbers).where(eq(serialNumbers.companyId, companyId));
      const [availableCount] = await db.select({ count: sql<number>`count(*)::int` })
        .from(serialNumbers).where(and(eq(serialNumbers.companyId, companyId), eq(serialNumbers.status, "available")));
      const [assembledCount] = await db.select({ count: sql<number>`count(*)::int` })
        .from(serialNumbers).where(and(eq(serialNumbers.companyId, companyId), eq(serialNumbers.status, "assembled")));
      const [fgCount] = await db.select({ count: sql<number>`count(*)::int` })
        .from(serialNumbers).where(and(eq(serialNumbers.companyId, companyId), eq(serialNumbers.status, "finished_good")));
      const [traceCount] = await db.select({ count: sql<number>`count(*)::int` })
        .from(traceabilityLogs).where(eq(traceabilityLogs.companyId, companyId));
      const [bomCount] = await db.select({ count: sql<number>`count(*)::int` })
        .from(bomHeaders).where(eq(bomHeaders.companyId, companyId));

      const thirtyDays = new Date();
      thirtyDays.setDate(thirtyDays.getDate() + 30);
      const [calibAlerts] = await db.select({ count: sql<number>`count(*)::int` })
        .from(calibrationInstruments)
        .where(and(
          eq(calibrationInstruments.companyId, companyId),
          eq(calibrationInstruments.status, "active"),
          lte(calibrationInstruments.nextDueDate, thirtyDays.toISOString().split("T")[0]),
        ));

      res.json({
        totalSerials: serialCount.count,
        availableSerials: availableCount.count,
        assembledSerials: assembledCount.count,
        finishedGoods: fgCount.count,
        traceabilityRecords: traceCount.count,
        bomCount: bomCount.count,
        calibrationAlerts: calibAlerts.count,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}
