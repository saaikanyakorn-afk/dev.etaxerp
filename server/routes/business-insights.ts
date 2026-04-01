import { Router } from "express";
import { requireAuth, requireAnyModule } from "../route-middleware";
import { db } from "../db";
import { ecomDb } from "../ecom-db";
import { shopStats, shopStatSyncLogs, companies, ecommerceConnections } from "@shared/schema";
import { eq, and, desc, sql, gte, lte } from "drizzle-orm";
import multer from "multer";
import * as XLSX from "xlsx";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

function parseThaiNumber(val: string | number | null | undefined): number {
  if (val === null || val === undefined || val === "" || val === "-") return 0;
  const s = String(val).replace(/,/g, "").replace(/%/g, "").trim();
  return parseFloat(s) || 0;
}

function parsePeriodDate(raw: string): string | null {
  if (!raw) return null;
  const s = raw.trim();
  const m = s.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}`;
  const m2 = s.match(/^(\d{4})-(\d{2})$/);
  if (m2) return s;
  return null;
}

router.get("/api/business-insights/stats", requireAuth, requireAnyModule("sales", "ecommerce"), async (req: any, res) => {
  try {
    const companyId = Number(req.query.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId required" });
    const user = req.user;
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
    if (!company) return res.status(404).json({ message: "ไม่พบกิจการ" });
    if (user.role !== "super_admin" && company.tenantId && company.tenantId !== user.tenantId) {
      return res.status(403).json({ message: "ไม่มีสิทธิ์" });
    }

    const platform = req.query.platform as string || "all";
    const dateFrom = req.query.dateFrom as string;
    const dateTo = req.query.dateTo as string;
    const year = req.query.year as string;

    let conditions: any[] = [eq(shopStats.companyId, companyId)];

    if (dateFrom && dateTo) {
      conditions.push(gte(shopStats.periodDate, dateFrom));
      conditions.push(lte(shopStats.periodDate, dateTo));
    } else if (year) {
      conditions.push(sql`${shopStats.periodDate} LIKE ${year + '-%'}`);
    } else {
      conditions.push(sql`${shopStats.periodDate} LIKE ${new Date().getFullYear() + '-%'}`);
    }

    if (platform !== "all") {
      conditions.push(eq(shopStats.platform, platform));
    }

    const data = await db.select().from(shopStats)
      .where(and(...conditions))
      .orderBy(shopStats.periodDate);

    const platforms = await db.selectDistinct({ platform: shopStats.platform })
      .from(shopStats)
      .where(eq(shopStats.companyId, companyId));

    const years = await db.selectDistinct({ year: sql<string>`SUBSTRING(${shopStats.periodDate}, 1, 4)` })
      .from(shopStats)
      .where(eq(shopStats.companyId, companyId))
      .orderBy(sql`SUBSTRING(${shopStats.periodDate}, 1, 4) DESC`);

    const summary = {
      totalSales: data.reduce((s, r) => s + parseFloat(String(r.totalSales)), 0),
      totalOrders: data.reduce((s, r) => s + (r.totalOrders || 0), 0),
      totalVisitors: data.reduce((s, r) => s + (r.totalVisitors || 0), 0),
      totalClicks: data.reduce((s, r) => s + (r.totalClicks || 0), 0),
      avgConversion: data.length > 0
        ? data.reduce((s, r) => s + parseFloat(String(r.conversionRate)), 0) / data.length
        : 0,
      cancelledOrders: data.reduce((s, r) => s + (r.cancelledOrders || 0), 0),
      cancelledSales: data.reduce((s, r) => s + parseFloat(String(r.cancelledSales)), 0),
      returnedOrders: data.reduce((s, r) => s + (r.returnedOrders || 0), 0),
      returnedSales: data.reduce((s, r) => s + parseFloat(String(r.returnedSales)), 0),
    };

    const byPlatform: Record<string, any> = {};
    for (const row of data) {
      if (!byPlatform[row.platform]) {
        byPlatform[row.platform] = {
          platform: row.platform,
          totalSales: 0, totalOrders: 0, totalVisitors: 0, totalClicks: 0,
          cancelledOrders: 0, returnedOrders: 0,
          conversionRates: [],
          monthly: [],
        };
      }
      const p = byPlatform[row.platform];
      p.totalSales += parseFloat(String(row.totalSales));
      p.totalOrders += (row.totalOrders || 0);
      p.totalVisitors += (row.totalVisitors || 0);
      p.totalClicks += (row.totalClicks || 0);
      p.cancelledOrders += (row.cancelledOrders || 0);
      p.returnedOrders += (row.returnedOrders || 0);
      p.conversionRates.push(parseFloat(String(row.conversionRate)));
      p.monthly.push({
        period: row.periodDate,
        totalSales: parseFloat(String(row.totalSales)),
        totalOrders: row.totalOrders,
        totalVisitors: row.totalVisitors,
        totalClicks: row.totalClicks,
        conversionRate: parseFloat(String(row.conversionRate)),
        avgOrderValue: parseFloat(String(row.avgOrderValue)),
        cancelledOrders: row.cancelledOrders,
        cancelledSales: parseFloat(String(row.cancelledSales)),
        returnedOrders: row.returnedOrders,
        returnedSales: parseFloat(String(row.returnedSales)),
      });
    }

    for (const key of Object.keys(byPlatform)) {
      const p = byPlatform[key];
      p.avgConversion = p.conversionRates.length > 0
        ? p.conversionRates.reduce((a: number, b: number) => a + b, 0) / p.conversionRates.length
        : 0;
      delete p.conversionRates;
    }

    res.json({
      summary,
      byPlatform: Object.values(byPlatform),
      monthly: data.map(r => ({
        period: r.periodDate,
        platform: r.platform,
        storeName: r.storeName,
        totalSales: parseFloat(String(r.totalSales)),
        totalOrders: r.totalOrders,
        totalVisitors: r.totalVisitors,
        totalClicks: r.totalClicks,
        conversionRate: parseFloat(String(r.conversionRate)),
        avgOrderValue: parseFloat(String(r.avgOrderValue)),
        cancelledOrders: r.cancelledOrders,
        cancelledSales: parseFloat(String(r.cancelledSales)),
        returnedOrders: r.returnedOrders,
        returnedSales: parseFloat(String(r.returnedSales)),
      })),
      platforms: platforms.map(p => p.platform),
      years: years.map(y => y.year),
    });
  } catch (error: any) {
    console.error("[Business Insights] Stats error:", error.message);
    res.status(500).json({ message: error.message });
  }
});

router.post("/api/business-insights/import", requireAuth, requireAnyModule("sales", "ecommerce"), upload.single("file"), async (req: any, res) => {
  try {
    const user = req.user;
    const companyId = Number(req.body.companyId);
    const platform = String(req.body.platform || "").toLowerCase();
    const storeName = String(req.body.storeName || "").trim() || null;

    if (!companyId || !platform) {
      return res.status(400).json({ message: "กรุณาระบุ companyId และ platform" });
    }
    if (!req.file) {
      return res.status(400).json({ message: "กรุณาอัปโหลดไฟล์" });
    }

    const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
    if (!company) return res.status(404).json({ message: "ไม่พบกิจการ" });
    if (user.role !== "super_admin" && company.tenantId && company.tenantId !== user.tenantId) {
      return res.status(403).json({ message: "ไม่มีสิทธิ์" });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    let headerRowIdx = -1;
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      const row = rows[i];
      if (row && row.some((c: any) => String(c || "").includes("วันที่") || String(c || "").toLowerCase().includes("date"))) {
        headerRowIdx = i;
        break;
      }
    }

    let dataStartIdx = headerRowIdx + 1;
    if (headerRowIdx >= 0 && headerRowIdx < 3) {
      for (let i = headerRowIdx + 1; i < Math.min(rows.length, headerRowIdx + 5); i++) {
        const row = rows[i];
        if (row && row[0] && String(row[0]).match(/^\d{2}-\d{2}-\d{4}$/)) {
          if (String(row[0]).match(/^\d{2}-\d{2}-\d{4}$/) && rows[i + 1] && !rows[i + 1][0]) {
            dataStartIdx = i + 1;
            for (let j = i + 1; j < rows.length; j++) {
              if (rows[j] && rows[j][0] && String(rows[j][0]).includes("วันที่")) {
                dataStartIdx = j + 1;
                break;
              }
            }
          }
          break;
        }
      }
    }

    const inserted: any[] = [];
    const skipped: string[] = [];
    const errors: string[] = [];

    for (let i = dataStartIdx; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row[0]) continue;

      const dateStr = String(row[0]).trim();
      const periodDate = parsePeriodDate(dateStr);
      if (!periodDate) {
        if (dateStr && !dateStr.includes("วันที่")) {
          errors.push(`Row ${i + 1}: ไม่สามารถอ่านวันที่ "${dateStr}"`);
        }
        continue;
      }

      const existing = await db.select({ id: shopStats.id }).from(shopStats)
        .where(and(
          eq(shopStats.companyId, companyId),
          eq(shopStats.platform, platform),
          eq(shopStats.periodDate, periodDate),
        ));

      if (existing.length > 0) {
        await db.update(shopStats)
          .set({
            totalSales: String(parseThaiNumber(row[1])),
            totalOrders: Math.round(parseThaiNumber(row[3])),
            avgOrderValue: String(parseThaiNumber(row[4])),
            totalClicks: Math.round(parseThaiNumber(row[5])),
            totalVisitors: Math.round(parseThaiNumber(row[6])),
            conversionRate: String(parseThaiNumber(row[7])),
            cancelledOrders: Math.round(parseThaiNumber(row[8])),
            cancelledSales: String(parseThaiNumber(row[9])),
            returnedOrders: Math.round(parseThaiNumber(row[10])),
            returnedSales: String(parseThaiNumber(row[11])),
            storeName,
            source: "excel",
            importedAt: new Date(),
          })
          .where(eq(shopStats.id, existing[0].id));
        skipped.push(periodDate);
        continue;
      }

      await db.insert(shopStats).values({
        companyId,
        platform,
        storeName,
        periodDate,
        periodType: "monthly",
        totalSales: String(parseThaiNumber(row[1])),
        totalOrders: Math.round(parseThaiNumber(row[3])),
        avgOrderValue: String(parseThaiNumber(row[4])),
        totalClicks: Math.round(parseThaiNumber(row[5])),
        totalVisitors: Math.round(parseThaiNumber(row[6])),
        conversionRate: String(parseThaiNumber(row[7])),
        cancelledOrders: Math.round(parseThaiNumber(row[8])),
        cancelledSales: String(parseThaiNumber(row[9])),
        returnedOrders: Math.round(parseThaiNumber(row[10])),
        returnedSales: String(parseThaiNumber(row[11])),
        source: "excel",
        createdBy: user.id,
      });
      inserted.push(periodDate);
    }

    res.json({
      success: true,
      inserted: inserted.length,
      updated: skipped.length,
      errors: errors.length,
      errorDetails: errors,
      periods: inserted,
    });
  } catch (error: any) {
    console.error("[Business Insights] Import error:", error.message);
    res.status(500).json({ message: error.message });
  }
});

router.delete("/api/business-insights/stats", requireAuth, requireAnyModule("sales", "ecommerce"), async (req: any, res) => {
  try {
    const companyId = Number(req.query.companyId);
    const platform = req.query.platform as string;
    const year = req.query.year as string;

    if (!companyId) return res.status(400).json({ message: "companyId required" });

    let conditions = [eq(shopStats.companyId, companyId)];
    if (platform) conditions.push(eq(shopStats.platform, platform));
    if (year) conditions.push(sql`${shopStats.periodDate} LIKE ${year + '-%'}`);

    const result = await db.delete(shopStats).where(and(...conditions));
    res.json({ success: true, message: "ลบข้อมูลเรียบร้อย" });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// ============ API Sync Endpoints ============

const PLATFORM_SYNC_ADAPTERS: Record<string, {
  fetchShopStats: (connection: any, dateFrom: string, dateTo: string) => Promise<any[]>;
}> = {
  shopee: {
    async fetchShopStats(connection, dateFrom, dateTo) {
      // TODO: Implement Shopee Shop Performance API
      // Endpoint: /api/v2/data_analytics/get_shop_performance
      // Requires: shop_id, access_token
      // Returns: daily/monthly metrics (visitors, page_views, orders, revenue, conversion)
      // Docs: https://open.shopee.com/documents/v2/v2.data_analytics.get_shop_performance
      throw new Error("Shopee API ยังไม่ได้เชื่อมต่อ — กรุณานำเข้าจาก Excel");
    },
  },
  lazada: {
    async fetchShopStats(connection, dateFrom, dateTo) {
      // TODO: Implement Lazada Seller Statistics API
      // Endpoint: /datacenter/api/dashboard
      // Requires: access_token
      // Returns: daily metrics (visitors, orders, revenue, conversion_rate)
      // Docs: https://open.lazada.com/apps/doc/api?path=/datacenter/api/dashboard
      throw new Error("Lazada API ยังไม่ได้เชื่อมต่อ — กรุณานำเข้าจาก Excel");
    },
  },
  tiktok: {
    async fetchShopStats(connection, dateFrom, dateTo) {
      // TODO: Implement TikTok Shop Analytics API
      // Endpoint: /api/analytics/shop/overview
      // Requires: shop_id, access_token
      // Returns: daily/weekly/monthly metrics (page_views, orders, revenue, conversion)
      // Docs: https://partner.tiktokshop.com/docv2/page/6507ead7b99d5302be949ba9
      throw new Error("TikTok Shop API ยังไม่ได้เชื่อมต่อ — กรุณานำเข้าจาก Excel");
    },
  },
};

router.get("/api/business-insights/connections", requireAuth, requireAnyModule("sales", "ecommerce"), async (req: any, res) => {
  try {
    const companyId = Number(req.query.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId required" });

    const connections = await db.select({
      id: ecommerceConnections.id,
      platform: ecommerceConnections.platform,
      shopName: ecommerceConnections.shopName,
      shopId: ecommerceConnections.shopId,
      status: ecommerceConnections.status,
    }).from(ecommerceConnections)
      .where(and(
        eq(ecommerceConnections.companyId, companyId),
        eq(ecommerceConnections.status, "connected"),
      ));

    const supportedPlatforms = Object.keys(PLATFORM_SYNC_ADAPTERS);
    const syncable = connections.filter(c => supportedPlatforms.includes(c.platform));

    res.json({ connections: syncable, supportedPlatforms });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/api/business-insights/sync", requireAuth, requireAnyModule("sales", "ecommerce"), async (req: any, res) => {
  try {
    const user = req.user;
    const { companyId, platform, connectionId, dateFrom, dateTo } = req.body;

    if (!companyId || !platform) {
      return res.status(400).json({ message: "กรุณาระบุ companyId และ platform" });
    }

    const [company] = await db.select().from(companies).where(eq(companies.id, Number(companyId)));
    if (!company) return res.status(404).json({ message: "ไม่พบกิจการ" });
    if (user.role !== "super_admin" && company.tenantId && company.tenantId !== user.tenantId) {
      return res.status(403).json({ message: "ไม่มีสิทธิ์" });
    }

    const adapter = PLATFORM_SYNC_ADAPTERS[platform];
    if (!adapter) {
      return res.status(400).json({ message: `ยังไม่รองรับ API ของ ${platform}` });
    }

    const [log] = await ecomDb.insert(shopStatSyncLogs).values({
      companyId: Number(companyId),
      platform,
      connectionId: connectionId ? Number(connectionId) : null,
      syncType: "manual",
      status: "syncing",
      createdBy: user.id,
    }).returning();

    try {
      let connection = null;
      if (connectionId) {
        const [conn] = await ecomDb.select().from(ecommerceConnections)
          .where(eq(ecommerceConnections.id, Number(connectionId)));
        connection = conn;
      }

      const from = dateFrom || `${new Date().getFullYear()}-01`;
      const to = dateTo || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

      const statsData = await adapter.fetchShopStats(connection, from, to);

      for (const stat of statsData) {
        const existing = await db.select({ id: shopStats.id }).from(shopStats)
          .where(and(
            eq(shopStats.companyId, Number(companyId)),
            eq(shopStats.platform, platform),
            eq(shopStats.periodDate, stat.periodDate),
          ));

        if (existing.length > 0) {
          await db.update(shopStats).set({ ...stat, source: "api", importedAt: new Date() })
            .where(eq(shopStats.id, existing[0].id));
        } else {
          await db.insert(shopStats).values({
            ...stat,
            companyId: Number(companyId),
            platform,
            source: "api",
            createdBy: user.id,
          });
        }
      }

      await ecomDb.update(shopStatSyncLogs).set({
        status: "completed",
        periodssynced: statsData.length,
        completedAt: new Date(),
      }).where(eq(shopStatSyncLogs.id, log.id));

      res.json({ success: true, syncLogId: log.id, periodsSynced: statsData.length });
    } catch (syncError: any) {
      await ecomDb.update(shopStatSyncLogs).set({
        status: "failed",
        errorMessage: syncError.message,
        completedAt: new Date(),
      }).where(eq(shopStatSyncLogs.id, log.id));

      res.status(400).json({ message: syncError.message, syncLogId: log.id });
    }
  } catch (error: any) {
    console.error("[Business Insights] Sync error:", error.message);
    res.status(500).json({ message: error.message });
  }
});

router.get("/api/business-insights/sync-logs", requireAuth, requireAnyModule("sales", "ecommerce"), async (req: any, res) => {
  try {
    const companyId = Number(req.query.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId required" });

    const logs = await ecomDb.select().from(shopStatSyncLogs)
      .where(eq(shopStatSyncLogs.companyId, companyId))
      .orderBy(desc(shopStatSyncLogs.startedAt))
      .limit(20);

    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
