import type { Express } from "express";
import { db } from "../db";
import { eq, desc, and, sql } from "drizzle-orm";
import { ecommerceOrders, ecommerceOrderItems, demandForecasts } from "@shared/schema";
import { createRouteGroup } from "../route-factory";

export function registerAiAnalyticsRoutes(app: Express) {

const r = createRouteGroup(app, { module: "ecommerce" });

r.companyRoute("get", "/api/ecommerce/analytics/demand-forecast", async ({ companyId }) => {
  return db.select().from(demandForecasts).where(eq(demandForecasts.companyId, companyId)).orderBy(desc(demandForecasts.forecastDate));
});

r.companyRoute("post", "/api/ecommerce/analytics/demand-forecast/generate", async ({ companyId, req }) => {
  const weeks = Number(req.body.weeks || 4);
  const orders = await db.select().from(ecommerceOrders).where(and(eq(ecommerceOrders.companyId, companyId), sql`${ecommerceOrders.status} != 'cancelled'`));
  const orderIds = orders.map(o => o.id);
  if (orderIds.length === 0) return { message: "No orders to analyze", forecasts: [] };
  const allItems = await db.select().from(ecommerceOrderItems).where(sql`${ecommerceOrderItems.orderId} IN (${sql.join(orderIds.map(id => sql`${id}`), sql`, `)})`);
  const orderMap = new Map(orders.map(o => [o.id, o]));
  const productWeekly: Record<string, { productId: number | null; productName: string; sku: string | null; weeklyQty: Record<string, number> }> = {};
  for (const item of allItems) {
    const order = orderMap.get(item.orderId!);
    if (!order) continue;
    const key = item.sku || item.productName || "unknown";
    if (!productWeekly[key]) {
      productWeekly[key] = { productId: item.productId, productName: item.productName || key, sku: item.sku, weeklyQty: {} };
    }
    const orderDate = new Date(order.orderDate || order.createdAt!);
    const weekStart = new Date(orderDate);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekKey = weekStart.toISOString().slice(0, 10);
    productWeekly[key].weeklyQty[weekKey] = (productWeekly[key].weeklyQty[weekKey] || 0) + (item.quantity || 1);
  }
  const generatedForecasts: any[] = [];
  for (const [, data] of Object.entries(productWeekly)) {
    const weekValues = Object.values(data.weeklyQty);
    if (weekValues.length === 0) continue;
    const avg = Math.round(weekValues.reduce((s, v) => s + v, 0) / weekValues.length);
    for (let w = 1; w <= weeks; w++) {
      const forecastDate = new Date();
      forecastDate.setDate(forecastDate.getDate() + w * 7);
      const [forecast] = await db.insert(demandForecasts).values({
        companyId, productId: data.productId, sku: data.sku,
        productName: data.productName, forecastDate,
        forecastQty: avg, method: "moving_average", periodType: "weekly",
      }).returning();
      generatedForecasts.push(forecast);
    }
  }
  return { forecasts: generatedForecasts, count: generatedForecasts.length };
});

r.companyRoute("get", "/api/ecommerce/analytics/top-products", async ({ companyId, req }) => {
  const limit = Math.min(Number(req.query.limit || 20), 100);
  const orders = await db.select().from(ecommerceOrders).where(and(eq(ecommerceOrders.companyId, companyId), sql`${ecommerceOrders.status} != 'cancelled'`));
  const orderIds = orders.map(o => o.id);
  if (orderIds.length === 0) return [];
  const allItems = await db.select().from(ecommerceOrderItems).where(sql`${ecommerceOrderItems.orderId} IN (${sql.join(orderIds.map(id => sql`${id}`), sql`, `)})`);
  const productSales: Record<string, { productName: string; sku: string | null; totalQty: number; totalRevenue: number }> = {};
  for (const item of allItems) {
    const key = item.sku || item.productName || "unknown";
    if (!productSales[key]) productSales[key] = { productName: item.productName || key, sku: item.sku, totalQty: 0, totalRevenue: 0 };
    productSales[key].totalQty += item.quantity || 1;
    productSales[key].totalRevenue += parseFloat(item.totalPrice || "0");
  }
  return Object.values(productSales).sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, limit);
});

r.companyRoute("get", "/api/ecommerce/analytics/platform-comparison", async ({ companyId }) => {
  const orders = await db.select().from(ecommerceOrders).where(and(eq(ecommerceOrders.companyId, companyId), sql`${ecommerceOrders.status} != 'cancelled'`));
  const platformStats: Record<string, { platform: string; orderCount: number; totalRevenue: number; avgOrderValue: number }> = {};
  for (const order of orders) {
    const platform = order.platform || "unknown";
    if (!platformStats[platform]) platformStats[platform] = { platform, orderCount: 0, totalRevenue: 0, avgOrderValue: 0 };
    platformStats[platform].orderCount++;
    platformStats[platform].totalRevenue += parseFloat(order.totalAmount || "0");
  }
  for (const stat of Object.values(platformStats)) {
    stat.avgOrderValue = stat.orderCount > 0 ? Math.round((stat.totalRevenue / stat.orderCount) * 100) / 100 : 0;
  }
  return Object.values(platformStats).sort((a, b) => b.totalRevenue - a.totalRevenue);
});

}
