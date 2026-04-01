import { db } from "./db";
import { eq } from "drizzle-orm";
import {
  customers, ecommerceOrders, ecommerceOrderItems, ecommerceReturns, ecommerceReturnItems,
  ecommerceSettlements, taxInvoices, taxInvoiceItems
} from "@shared/schema";

export async function seedDemoExtraData(
  companyId: number,
  userId: number,
  connectionIds: Record<string, number>,
  demoProducts: any[]
) {
  const customerData = [
    { name: "สมชาย ใจดี", phone: "081-234-5678", email: "somchai@gmail.com", platform: "shopee", totalSpend: "45000", orderCount: 12 },
    { name: "สมหญิง รักษ์ไทย", phone: "089-876-5432", email: "somying@gmail.com", platform: "lazada", totalSpend: "28500", orderCount: 8 },
    { name: "วิชัย ศรีสุข", phone: "062-111-2222", email: "wichai@hotmail.com", platform: "tiktok", totalSpend: "62000", orderCount: 15 },
    { name: "พรทิพย์ สวัสดี", phone: "095-333-4444", email: "porntip@gmail.com", platform: "shopee", totalSpend: "18900", orderCount: 5 },
    { name: "อนุชา เจริญกิจ", phone: "083-555-6666", email: "anucha@outlook.com", platform: "lazada", totalSpend: "95000", orderCount: 22 },
    { name: "จิราพร มั่นคง", phone: "091-777-8888", email: "jiraporn@gmail.com", platform: "tiktok", totalSpend: "33200", orderCount: 9 },
    { name: "ธนกร สุขใจ", phone: "084-999-0000", email: "thanakorn@gmail.com", platform: "shopee", totalSpend: "71500", orderCount: 18 },
    { name: "กมลวรรณ ดีเลิศ", phone: "086-222-3333", email: "kamonwan@gmail.com", platform: "lazada", totalSpend: "14200", orderCount: 4 },
  ];
  const createdCustomers: any[] = [];
  for (const c of customerData) {
    const [cust] = await db.insert(customers).values({
      companyId,
      name: c.name,
      phone: c.phone,
      email: c.email,
      platform: c.platform,
      totalSpend: c.totalSpend,
      orderCount: c.orderCount,
      lastOrderDate: new Date(Date.now() - Math.floor(Math.random() * 7) * 86400000),
    }).returning();
    createdCustomers.push(cust);
  }

  const deliveredOrders = await db.select().from(ecommerceOrders)
    .where(eq(ecommerceOrders.companyId, companyId))
    .limit(100);
  const deliveredOnly = deliveredOrders.filter(o => o.status === "delivered");
  const returnReasons = ["สินค้าชำรุด", "ไม่ตรงตามคำสั่งซื้อ", "ขนาดไม่พอดี", "เปลี่ยนใจ", "สินค้าไม่ตรงรูป"];
  const returnStatuses = ["requested", "approved", "shipping", "received", "completed"];
  let returnCount = 0;
  for (let i = 0; i < Math.min(8, deliveredOnly.length); i++) {
    const order = deliveredOnly[i];
    const reason = returnReasons[Math.floor(Math.random() * returnReasons.length)];
    const rStatus = returnStatuses[Math.floor(Math.random() * returnStatuses.length)];
    const requestedAt = new Date(Date.now() - Math.floor(Math.random() * 14) * 86400000);
    const [ret] = await db.insert(ecommerceReturns).values({
      companyId,
      orderId: order.id,
      platform: order.platform!,
      returnNo: `RTN-${String(returnCount + 1).padStart(6, "0")}`,
      reason,
      reasonDetail: `ลูกค้าแจ้ง: ${reason}`,
      status: rStatus,
      returnStatus: rStatus === "completed" ? "completed" : rStatus === "received" ? "inspecting" : "pending",
      refundAmount: order.totalAmount || "0",
      refundMethod: "platform_credit",
      buyerName: order.buyerName,
      returnTrackingNo: rStatus !== "requested" ? `RTH${Math.floor(Math.random() * 9000000000 + 1000000000)}` : null,
      returnShipper: rStatus !== "requested" ? "Kerry Express" : null,
      requestedAt,
      approvedAt: rStatus !== "requested" ? new Date(requestedAt.getTime() + 86400000) : null,
      shippedAt: ["shipping", "received", "completed"].includes(rStatus) ? new Date(requestedAt.getTime() + 2 * 86400000) : null,
      receivedAt: ["received", "completed"].includes(rStatus) ? new Date(requestedAt.getTime() + 4 * 86400000) : null,
      completedAt: rStatus === "completed" ? new Date(requestedAt.getTime() + 5 * 86400000) : null,
    }).returning();

    const orderItems = await db.select().from(ecommerceOrderItems).where(eq(ecommerceOrderItems.orderId, order.id));
    for (const item of orderItems) {
      await db.insert(ecommerceReturnItems).values({
        returnId: ret.id,
        orderItemId: item.id,
        productId: item.productId,
        productName: item.name!,
        sku: item.platformSku,
        qty: "1",
        receivedQty: ["received", "completed"].includes(rStatus) ? "1" : "0",
        refundAmount: item.price || "0",
        condition: "unopened",
      });
    }
    returnCount++;
  }

  let settlementCount = 0;
  for (const [platform, connId] of Object.entries(connectionIds)) {
    for (let week = 0; week < 4; week++) {
      const periodTo = new Date(Date.now() - week * 7 * 86400000);
      const periodFrom = new Date(periodTo.getTime() - 7 * 86400000);
      const totalSales = Math.floor(Math.random() * 50000) + 20000;
      const commission = Math.round(totalSales * 0.04);
      const serviceFee = Math.round(totalSales * 0.02);
      const shippingCost = Math.floor(Math.random() * 3000) + 1000;
      const paymentFee = Math.round(totalSales * 0.015);
      const netAmount = totalSales - commission - serviceFee - shippingCost - paymentFee;
      const walletStatus = week >= 2 ? "withdrawn" : "in_wallet";

      await db.insert(ecommerceSettlements).values({
        companyId,
        connectionId: connId,
        platform,
        settlementNo: `STL-${platform.toUpperCase()}-${String(settlementCount + 1).padStart(4, "0")}`,
        periodFrom: periodFrom.toISOString().split("T")[0],
        periodTo: periodTo.toISOString().split("T")[0],
        settlementDate: periodTo.toISOString().split("T")[0],
        totalSales: String(totalSales),
        totalCommission: String(commission),
        totalServiceFee: String(serviceFee),
        totalShippingCost: String(shippingCost),
        totalPaymentFee: String(paymentFee),
        netAmount: String(netAmount),
        walletStatus,
        withdrawnDate: walletStatus === "withdrawn" ? periodTo.toISOString().split("T")[0] : null,
        invoiceStatus: "matched",
        orderCount: Math.floor(Math.random() * 30) + 10,
        importSource: "excel",
      });
      settlementCount++;
    }
  }

  let tivCount = 0;
  for (let i = 0; i < 12; i++) {
    const cust = createdCustomers[Math.floor(Math.random() * createdCustomers.length)];
    const product = demoProducts[Math.floor(Math.random() * demoProducts.length)];
    const qty = Math.floor(Math.random() * 5) + 1;
    const unitPrice = Number(product.price);
    const subtotal = unitPrice * qty;
    const vatAmount = Math.round(subtotal * 0.07 * 100) / 100;
    const totalAmount = subtotal + vatAmount;
    const dayOffset = Math.floor(Math.random() * 30);
    const invoiceDate = new Date(Date.now() - dayOffset * 86400000);
    const tivStatus = i < 3 ? "draft" : "approved";

    const [tiv] = await db.insert(taxInvoices).values({
      companyId,
      taxInvoiceNo: `TIV-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(tivCount + 1).padStart(4, "0")}`,
      taxInvoiceDate: invoiceDate.toISOString().split("T")[0],
      customerName: cust.name,
      customerTaxId: `0${Math.floor(Math.random() * 900000000 + 100000000)}0000`,
      customerAddress: `${Math.floor(Math.random() * 999) + 1} ถ.สุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพฯ 10110`,
      branch: "สำนักงานใหญ่",
      subtotal: String(subtotal),
      vatAmount: String(vatAmount),
      totalAmount: String(totalAmount),
      status: tivStatus,
      paymentStatus: tivStatus === "approved" ? "paid" : "unpaid",
      priceMode: "excluded",
      docPrefix: "TIV",
      currencyCode: "THB",
      createdBy: userId,
    }).returning();

    await db.insert(taxInvoiceItems).values({
      taxInvoiceId: tiv.id,
      productId: product.id,
      productCode: product.code,
      productName: product.name,
      qty: String(qty),
      unit: "ชิ้น",
      unitPrice: String(unitPrice),
      discount: "0",
      total: String(subtotal),
      vatType: "vat7",
    });
    tivCount++;
  }

  return { customers: createdCustomers.length, returns: returnCount, settlements: settlementCount, taxInvoices: tivCount };
}
