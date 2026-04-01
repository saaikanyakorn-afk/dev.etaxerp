import type { Express, Request, Response } from "express";
import { db } from "../db";
import { ecomDb } from "../ecom-db";
import { storage } from "../storage";
import { eq, desc, and, inArray , sql } from "drizzle-orm";
import { companies, invoices, taxInvoices, invoiceItems, taxInvoiceItems, accounts, products, ecommerceOrders, ecommerceOrderItems, stockMovements, journalEntries, journalLines, productStock, salesCreditNotes, salesCreditNoteItems, vatProductDictionary, taxReminderSettings, taxReminderLogs, ecommerceConnections } from "@shared/schema";
import { requireAuth, requireModule, requireAnyModule } from "../route-middleware";
import { getNextDocNo, getNextJournalEntryNo, createAutoJournalEntry, PLATFORM_DOC_PREFIX, deleteStockMovementsForDoc, withDbRetry } from "../route-helpers";
import * as XLSX from "xlsx";
import path from "path";
import OpenAI from "openai";
import { recalcBundleStock, recalcBomStock } from "../inventory-recalc";
import { createCOGSJournalEntry } from "../inventory-journal";
import { parse as csvParse } from "csv-parse/sync";
import { checkAndSendTaxReminders, sendTaxReminder } from "../services/tax-reminder";
import multer from "multer";
import { getStandardTaxDeadlines } from "./tax-calendar";
const upload = multer({ storage: multer.memoryStorage() });

export function registerEcommerceImportRoutes(app: Express) {
// ============ Grab Food API Integration ============

app.post("/api/grab/connect", requireAuth, requireModule("ecommerce"), async (req, res) => {
  try {
    const user = req.user as any;
    const { companyId, clientId, clientSecret, merchantId, shopName, useStaging } = req.body;
    if (!companyId || !clientId || !clientSecret || !merchantId || !shopName) {
      return res.status(400).json({ message: "กรุณากรอกข้อมูลให้ครบ" });
    }
    const userCompanies = await storage.getUserCompanies(user.id);
    if (!userCompanies.some((uc: any) => uc.companyId === Number(companyId))) {
      return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึงกิจการนี้" });
    }

    const baseUrl = useStaging ? "https://api.stg-myteksi.com" : "https://api.grab.com";

    let accessToken = "";
    let expiresIn = 0;
    try {
      const tokenRes = await fetch(`${baseUrl}/grabid/v1/oauth2/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "client_credentials",
          scope: "food.partner_api",
        }),
      });
      if (!tokenRes.ok) {
        const errBody = await tokenRes.text();
        throw new Error(`Grab OAuth failed: ${tokenRes.status} - ${errBody}`);
      }
      const tokenData = await tokenRes.json();
      accessToken = tokenData.access_token;
      expiresIn = tokenData.expires_in || 3600;
    } catch (err: any) {
      return res.status(400).json({ message: `ไม่สามารถเชื่อมต่อ Grab API ได้: ${err.message}` });
    }

    const expiresAt = new Date(Date.now() + expiresIn * 1000);
    const settings = JSON.stringify({ clientId, clientSecret, merchantId, useStaging });

    const connection = await storage.createEcommerceConnection({
      companyId: Number(companyId),
      platform: "grab_food",
      shopName,
      shopId: merchantId,
      accessToken,
      refreshToken: null,
      tokenExpiresAt: expiresAt,
      status: "connected",
      lastSyncAt: null,
      settings,
    });

    const { accessToken: _at, settings: _s, ...safeConn } = connection;
    res.status(201).json(safeConn);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post("/api/grab/sync-orders", requireAuth, requireModule("ecommerce"), async (req, res) => {
  try {
    const user = req.user as any;
    const { connectionId, companyId } = req.body;
    if (!connectionId || !companyId) return res.status(400).json({ message: "connectionId and companyId required" });

    const userCompanies = await storage.getUserCompanies(user.id);
    if (!userCompanies.some((uc: any) => uc.companyId === Number(companyId))) {
      return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึงกิจการนี้" });
    }

    const conn = await storage.getEcommerceConnection(Number(connectionId));
    if (!conn || conn.companyId !== Number(companyId)) return res.status(404).json({ message: "ไม่พบการเชื่อมต่อ" });

    const settings = conn.settings ? JSON.parse(conn.settings) : {};
    const { clientId, clientSecret, merchantId, useStaging } = settings;
    if (!clientId || !clientSecret || !merchantId) return res.status(400).json({ message: "ข้อมูล API ไม่ครบ กรุณาเชื่อมต่อใหม่" });

    const oauthBase = useStaging ? "https://api.stg-myteksi.com" : "https://api.grab.com";
    const apiBase = useStaging ? "https://partner-api.stg-myteksi.com/grabfood" : "https://partner-api.grab.com/grabfood";

    let accessToken = conn.accessToken;
    const isExpired = !conn.tokenExpiresAt || new Date(conn.tokenExpiresAt) < new Date();

    if (isExpired || !accessToken) {
      try {
        const tokenRes = await fetch(`${oauthBase}/grabid/v1/oauth2/token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: "client_credentials",
            scope: "food.partner_api",
          }),
        });
        if (!tokenRes.ok) throw new Error(`Token refresh failed: ${tokenRes.status}`);
        const tokenData = await tokenRes.json();
        accessToken = tokenData.access_token;
        const expiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000);
        await storage.updateEcommerceConnection(conn.id, {
          accessToken,
          tokenExpiresAt: expiresAt,
          status: "connected",
        });
      } catch (err: any) {
        await storage.updateEcommerceConnection(conn.id, { status: "error" });
        return res.status(400).json({ message: `ไม่สามารถรีเฟรช Token ได้: ${err.message}` });
      }
    }

    let grabOrders: any[] = [];
    try {
      const ordersRes = await fetch(`${apiBase}/partner/v1/orders?merchantID=${merchantId}`, {
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      });
      if (!ordersRes.ok) {
        const errText = await ordersRes.text();
        throw new Error(`API error ${ordersRes.status}: ${errText}`);
      }
      const ordersData = await ordersRes.json();
      grabOrders = ordersData.orders || ordersData || [];
    } catch (err: any) {
      await storage.updateEcommerceConnection(conn.id, { status: "error" });
      return res.status(400).json({ message: `ดึงออเดอร์ล้มเหลว: ${err.message}` });
    }

    await storage.updateEcommerceConnection(conn.id, { lastSyncAt: new Date(), status: "connected" });

    const orders = (Array.isArray(grabOrders) ? grabOrders : []).map((go: any) => {
      const items = (go.items || []).map((item: any) => ({
        productName: item.name || "รายการอาหาร",
        qty: item.quantity || 1,
        unitPrice: item.price || 0,
        totalPrice: (item.price || 0) * (item.quantity || 1),
      }));

      const subtotal = items.reduce((s: number, i: any) => s + i.totalPrice, 0);

      return {
        orderNo: go.orderID || go.shortOrderNumber || go.order_id || "",
        orderDate: go.orderTime || go.order_time || go.createdAt || new Date().toISOString(),
        buyerName: go.receiver?.name || go.eater?.name || "ลูกค้า Grab",
        status: go.state || go.status || "COMPLETED",
        orderTotal: go.price?.eaterPayment || go.price?.subtotal || subtotal,
        items,
      };
    });

    res.json({ totalOrders: orders.length, orders });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ============ E-Commerce Excel Import ============
app.post("/api/ecommerce/import/preview", requireAuth, requireAnyModule("sales", "ecommerce"), upload.single("file"), async (req: any, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "กรุณาอัปโหลดไฟล์" });
    const companyId = Number(req.body.companyId);
    const platform = req.body.platform; // shopee, lazada, tiktok
    if (!companyId) return res.status(400).json({ message: "กรุณาระบุ companyId" });
    if (!platform || !["shopee", "lazada", "tiktok", "facebook", "grab_food", "line_man", "robinhood", "shopee_food"].includes(platform)) {
      return res.status(400).json({ message: "กรุณาระบุแพลตฟอร์ม (shopee, lazada, tiktok, facebook, grab_food, line_man, robinhood, shopee_food)" });
    }

    let rows: any[] = [];
    const ext = path.extname(req.file.originalname).toLowerCase();

    if (ext === ".csv") {
      let content = req.file.buffer.toString("utf-8");
      const hasThai = /[\u0E00-\u0E7F]/.test(content);
      const hasHighBytes = req.file.buffer.some((b: number) => b >= 0xA1 && b <= 0xFB);
      if (!hasThai && hasHighBytes) {
        try {
          const decoder = new TextDecoder("tis-620");
          content = decoder.decode(req.file.buffer);
        } catch { content = req.file.buffer.toString("latin1"); }
      }
      const firstLine = content.split(/\r?\n/)[0];
      const delimiter = firstLine.includes("\t") ? "\t" : ",";
      rows = csvParse(content, { columns: true, skip_empty_lines: true, trim: true, bom: true, delimiter, relax_quotes: true, relax_column_count: true });
    } else if (ext === ".xlsx" || ext === ".xls") {
      const workbook = XLSX.read(req.file.buffer, { type: "buffer", cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    } else {
      return res.status(400).json({ message: "รองรับเฉพาะไฟล์ .csv, .xlsx, .xls" });
    }

    if (rows.length === 0) return res.status(400).json({ message: "ไม่พบข้อมูลในไฟล์" });
    if (rows.length > 200000) return res.status(400).json({ message: "รองรับสูงสุด 200,000 รายการต่อครั้ง" });

    const headers = Object.keys(rows[0]);

    const SHOPEE_MAP: Record<string, string[]> = {
      orderNo: ["Order ID", "เลขที่คำสั่งซื้อ", "หมายเลขคำสั่งซื้อ", "order_sn", "Order No", "order_id"],
      orderStatus: ["Order Status", "สถานะคำสั่งซื้อ", "สถานะ", "order_status"],
      trackingNo: ["Tracking Number*", "Tracking Number", "หมายเลขพัสดุ", "tracking_no", "เลขพัสดุ"],
      shippingProvider: ["Shipping Option", "ขนส่ง", "shipping_carrier"],
      buyerName: ["Username (Buyer)", "ผู้ซื้อ", "ชื่อผู้ซื้อ", "buyer_username", "Buyer Username", "Recipient Name"],
      buyerPhone: ["Phone Number", "เบอร์โทรศัพท์", "phone"],
      buyerAddress: ["Shipping Address", "ที่อยู่จัดส่ง", "Delivery Address"],
      productName: ["Product Name", "ชื่อสินค้า", "สินค้า", "product_name"],
      sku: ["SKU Reference No.", "SKU", "sku", "Parent SKU Reference No."],
      variation: ["Variation Name", "ตัวเลือกสินค้า", "variation"],
      qty: ["Quantity", "จำนวน", "quantity", "จำนวนสินค้า"],
      unitPrice: ["Original Price", "ราคาสินค้า", "Deal Price", "unit_price", "ราคาขาย", "ราคาต่อชิ้น", "ราคาต่อหน่วย"],
      totalPrice: ["Product Subtotal", "ราคารวม", "ยอดรวมสินค้า"],
      discount: ["Seller Discount", "ส่วนลดจากผู้ขาย", "Seller Voucher", "seller_discount", "โค้ดส่วนลดชำระโดยผู้ขาย"],
      sellerCoinsCashback: ["โค้ด Coins Cashback ชำระโดยผู้ขาย"],
      sellerBundleDeal: ["ส่วนลด bundle deal ชำระโดยผู้ขาย"],
      platformDiscount: ["Shopee Discount", "ส่วนลดจาก Shopee", "Shopee Voucher", "โค้ดส่วนลดชำระโดย Shopee (เช่น โค้ดจากโปรแกรม ร้านโค้ดคุ้ม, โค้ดส่วนลด Shopee, โค้ดส่วนลด Shopee Mall)"],
      platformBundleDeal: ["ส่วนลด bundle deal ชำระโดย Shopee"],
      coinDiscount: ["ส่วนลดจากการใช้เหรียญ"],
      shippingFee: ["Shipping Fee Paid by Buyer", "ค่าจัดส่งที่ผู้ซื้อจ่าย", "Estimated Shipping Fee", "ค่าจัดส่ง"],
      orderTotal: ["Order Total Amount", "ยอดรวมคำสั่งซื้อ", "Total Amount", "Grand Total"],
      orderDate: ["Order Creation Date", "วันที่สร้างคำสั่งซื้อ", "create_time", "Order Paid Time", "วันที่ชำระเงิน"],
      paymentMethod: ["Payment Method", "ช่องทางชำระเงิน"],
      commissionFee: ["Commission Fee", "ค่าคอมมิชชั่น", "Service Fee"],
      netSellingPrice: ["ราคาขายสุทธิ"],
      buyerPaidPrice: ["ราคาสินค้าที่ชำระโดยผู้ซื้อ (THB)", "ราคาสินค้าที่ชำระโดยผู้ซื้อ"],
      shippingBuyerPaid: ["ค่าจัดส่งที่ชำระโดยผู้ซื้อ"],
      shippingShopeeSubsidy: ["ค่าจัดส่งที่ Shopee ออกให้โดยประมาณ"],
      shippingActualCost: ["ค่าจัดส่งโดยประมาณ"],
      commission: ["ค่าคอมมิชชั่น"],
      transactionFee: ["Transaction Fee"],
      serviceFee: ["ค่าบริการ"],
      netAmount: ["จำนวนเงินทั้งหมด"],
      completedDate: ["เวลาที่ทำการสั่งซื้อสำเร็จ"],
      shippedDate: ["เวลาจัดส่งสินค้า", "วันที่จัดส่ง", "วันที่ส่งสินค้า", "วันที่ส่งของ", "เวลาส่งสินค้า", "วันที่จัดส่งสินค้า", "Shipment Creation Date", "ship_time", "Shipment Date", "Ship by Date", "Ship Time"],
      orderStatusFull: ["สถานะการสั่งซื้อ"],
      recipientName: ["ชื่อผู้รับ"],
      recipientPhone: ["หมายเลขโทรศัพท์"],
      recipientAddress: ["ที่อยู่ในการจัดส่ง"],
      province: ["จังหวัด"],
      district: ["เขต/อำเภอ"],
      postalCode: ["รหัสไปรษณีย์"],
    };

    const LAZADA_MAP: Record<string, string[]> = {
      orderNo: ["Order Number", "orderNumber", "Order ID", "หมายเลขคำสั่งซื้อ"],
      orderStatus: ["Status", "สถานะ", "status"],
      trackingNo: ["Tracking Code", "trackingCode", "Tracking Number", "หมายเลขพัสดุ"],
      shippingProvider: ["Shipping Provider", "shippingProvider", "ขนส่ง"],
      buyerName: ["Customer Name", "customerName", "Buyer Name", "ชื่อผู้ซื้อ", "buyerName"],
      buyerPhone: ["Billing Phone Number", "billingPhone", "Phone"],
      buyerAddress: ["Shipping Address", "shippingAddress", "Delivery Address", "ที่อยู่"],
      productName: ["Item Name", "itemName", "Product Name", "ชื่อสินค้า"],
      sku: ["Seller SKU", "sellerSku", "SKU"],
      variation: ["Variation", "variation"],
      qty: ["Quantity", "quantity", "จำนวน"],
      unitPrice: ["Unit Price", "unitPrice", "ราคาต่อหน่วย", "ราคา"],
      totalPrice: ["Paid Price", "paidPrice", "Item Revenue", "ราคารวม"],
      discount: ["Seller Discount Total", "sellerDiscountTotal", "Seller Discount", "Voucher Seller", "ส่วนลดผู้ขาย"],
      platformDiscount: ["Lazada Discount", "Voucher Platform", "ส่วนลดแพลตฟอร์ม", "Voucher Code Lazada"],
      shippingFee: ["Shipping Fee (Paid By Customer)", "Shipping Fee", "shippingFee", "ค่าจัดส่ง"],
      orderTotal: ["Order Amount", "ยอดรวม"],
      orderDate: ["Created at", "createdAt", "createTime", "Order Creation Date", "วันที่สั่งซื้อ", "Payment Date"],
      paymentMethod: ["Payment Method", "paymentMethod"],
      commissionFee: ["Commission", "commission"],
      shippedDate: ["Shipped Date", "Delivery Date", "วันที่จัดส่ง", "Ship Time", "Shipment Date", "Delivered Date"],
      completedDate: ["Completed Date", "วันที่สำเร็จ", "Delivered Date"],
      walletCredit: ["Wallet Credit", "walletCredit"],
      bundleDiscount: ["Bundle Discount", "bundleDiscount", "Bundle Deal"],
      refundAmount: ["Refund Amount", "refundAmount"],
    };

    const TIKTOK_MAP: Record<string, string[]> = {
      orderNo: ["Order ID", "order_id", "หมายเลขคำสั่งซื้อ", "Order No."],
      orderStatus: ["Order Status", "order_status", "สถานะ"],
      trackingNo: ["Tracking ID", "tracking_id", "Tracking Number", "หมายเลขพัสดุ"],
      shippingProvider: ["Shipping Provider Name", "shipping_provider", "ขนส่ง"],
      buyerName: ["Buyer Username", "Recipient", "ชื่อผู้ซื้อ", "buyer_name"],
      buyerPhone: ["Buyer Phone", "เบอร์โทร"],
      buyerAddress: ["Recipient Address", "Shipping Address", "ที่อยู่"],
      productName: ["SKU Name", "Product Name", "ชื่อสินค้า", "product_name"],
      sku: ["Seller SKU", "SKU ID", "sku_id", "SKU"],
      variation: ["Variation", "SKU Info"],
      qty: ["Quantity", "quantity", "จำนวน"],
      unitPrice: ["SKU Unit Original Price", "SKU Unit Price", "Original Price", "ราคา"],
      totalPrice: ["SKU Subtotal After Discount", "SKU Subtotal Before Discount", "ราคารวม"],
      discount: ["SKU Seller Discount", "Seller Discount", "ส่วนลดผู้ขาย"],
      platformDiscount: ["SKU Platform Discount", "TikTok Discount", "Platform Discount", "ส่วนลดแพลตฟอร์ม"],
      shippingFee: ["Shipping Fee After Discount", "ค่าจัดส่งหลังส่วนลด"],
      shippingOriginal: ["Original Shipping Fee", "ค่าจัดส่งเดิม"],
      shippingSellerDiscount: ["Shipping Fee Seller Discount", "ส่วนลดค่าส่งผู้ขาย"],
      shippingPlatformDiscount: ["Shipping Fee Platform Discount", "ส่วนลดค่าส่งแพลตฟอร์ม"],
      orderTotal: ["Order Amount", "Total Settlement Amount", "ยอดรวม", "Total"],
      orderDate: ["Created Time", "Paid Time", "วันที่สั่งซื้อ", "Order Create Time"],
      paymentMethod: ["Payment Method", "ช่องทางชำระ"],
      commissionFee: ["Commission", "Commission Fee", "ค่าคอมมิชชั่น"],
      shippedDate: ["Shipped Time", "Ship Time", "วันที่จัดส่ง", "Delivery Date", "Shipment Date"],
      completedDate: ["Completed Time", "Complete Time", "วันที่สำเร็จ", "Delivered Date", "Delivered Time"],
      refundAmount: ["Order Refund Amount", "Refund Amount"],
      smallOrderFee: ["Small Order Fee", "ค่าธรรมเนียมออเดอร์เล็ก"],
    };

    const GRAB_FOOD_MAP: Record<string, string[]> = {
      orderNo: ["Order ID", "หมายเลขออเดอร์", "หมายเลขคำสั่งซื้อ", "order_id", "Transaction ID", "เลขที่รายการ"],
      orderStatus: ["Order Status", "สถานะ", "สถานะออเดอร์", "Status"],
      trackingNo: ["Tracking No", "Driver ID"],
      shippingProvider: ["Delivery Type", "ประเภทการจัดส่ง"],
      buyerName: ["Customer Name", "ชื่อลูกค้า", "ผู้สั่ง", "Recipient Name"],
      buyerPhone: ["Customer Phone", "เบอร์โทรลูกค้า", "Phone"],
      buyerAddress: ["Delivery Address", "ที่อยู่จัดส่ง", "Customer Address"],
      productName: ["Item Name", "ชื่อรายการ", "ชื่อเมนู", "Menu Item", "รายการอาหาร", "Item"],
      sku: ["SKU", "Item ID", "Menu ID"],
      variation: ["Modifier", "ตัวเลือก", "Option", "Add-on"],
      qty: ["Quantity", "จำนวน", "Qty"],
      unitPrice: ["Unit Price", "ราคาต่อหน่วย", "ราคา", "Price"],
      totalPrice: ["Subtotal", "ราคารวม", "Item Total", "Amount"],
      discount: ["Merchant Discount", "ส่วนลดร้านค้า", "Merchant Promo", "Seller Discount"],
      platformDiscount: ["Grab Discount", "ส่วนลดจาก Grab", "Platform Discount", "Grab Promo", "Voucher"],
      shippingFee: ["Delivery Fee", "ค่าจัดส่ง", "Delivery Charge"],
      orderTotal: ["Total", "ยอดรวม", "Grand Total", "Order Total", "Net Amount", "ยอดสุทธิ"],
      orderDate: ["Order Date", "Order Time", "วันที่สั่ง", "Created At", "Date", "วันที่"],
      paymentMethod: ["Payment Method", "ช่องทางชำระเงิน", "Payment Type"],
      commissionFee: ["Commission", "GP", "ค่า GP", "Service Fee", "ค่าคอมมิชชั่น", "Platform Fee", "Grab Fee", "ค่าบริการ"],
    };

    const LINE_MAN_MAP: Record<string, string[]> = {
      orderNo: ["Order ID", "Order No", "หมายเลขออเดอร์", "หมายเลขคำสั่งซื้อ", "เลขที่ออเดอร์", "order_id"],
      orderStatus: ["Order Status", "สถานะ", "สถานะออเดอร์", "Status"],
      trackingNo: ["Tracking No", "Rider ID"],
      shippingProvider: ["Delivery Type", "ประเภทจัดส่ง"],
      buyerName: ["Customer Name", "ชื่อลูกค้า", "ผู้สั่ง", "Recipient"],
      buyerPhone: ["Customer Phone", "เบอร์โทร", "Phone", "เบอร์โทรลูกค้า"],
      buyerAddress: ["Delivery Address", "ที่อยู่", "ที่อยู่จัดส่ง", "Address"],
      productName: ["Item Name", "Menu Name", "ชื่อเมนู", "ชื่อรายการ", "รายการอาหาร", "Product Name", "เมนู"],
      sku: ["SKU", "Item ID", "Menu ID", "รหัสเมนู"],
      variation: ["Option", "ตัวเลือก", "Add-on", "Modifier", "ตัวเลือกเพิ่มเติม"],
      qty: ["Quantity", "จำนวน", "Qty"],
      unitPrice: ["Unit Price", "ราคา", "Price", "ราคาต่อชิ้น"],
      totalPrice: ["Total", "ราคารวม", "Subtotal", "Item Total", "ยอดรวมรายการ"],
      discount: ["Merchant Discount", "ส่วนลดร้าน", "Seller Discount", "ส่วนลดผู้ขาย"],
      platformDiscount: ["LINE MAN Discount", "ส่วนลดจาก LINE MAN", "Platform Discount", "ส่วนลดแพลตฟอร์ม", "Voucher"],
      shippingFee: ["Delivery Fee", "ค่าจัดส่ง", "ค่าส่ง"],
      orderTotal: ["Total Amount", "ยอดรวม", "Grand Total", "Net Amount", "ยอดสุทธิ", "ยอดรวมทั้งหมด"],
      orderDate: ["Order Date", "วันที่สั่ง", "Created At", "Date", "วันที่", "Order Time", "วันเวลาที่สั่ง"],
      paymentMethod: ["Payment Method", "ช่องทางชำระเงิน", "Payment", "การชำระเงิน"],
      commissionFee: ["Commission", "GP", "ค่า GP", "ค่าคอมมิชชั่น", "Service Fee", "ค่าบริการ", "Platform Fee"],
    };

    const ROBINHOOD_MAP: Record<string, string[]> = {
      orderNo: ["Order ID", "Order No", "หมายเลขออเดอร์", "หมายเลขคำสั่งซื้อ", "เลขที่รายการ", "order_id"],
      orderStatus: ["Order Status", "สถานะ", "สถานะออเดอร์", "Status"],
      trackingNo: ["Tracking No", "Rider"],
      shippingProvider: ["Delivery Type", "ประเภทจัดส่ง"],
      buyerName: ["Customer Name", "ชื่อลูกค้า", "ผู้สั่ง", "Recipient", "ชื่อผู้รับ"],
      buyerPhone: ["Customer Phone", "เบอร์โทร", "Phone", "เบอร์โทรลูกค้า"],
      buyerAddress: ["Delivery Address", "ที่อยู่", "ที่อยู่จัดส่ง", "Address"],
      productName: ["Item Name", "Menu Name", "ชื่อเมนู", "ชื่อรายการ", "รายการอาหาร", "Product Name", "เมนู"],
      sku: ["SKU", "Item ID", "Menu ID", "รหัสเมนู"],
      variation: ["Option", "ตัวเลือก", "Add-on", "Modifier"],
      qty: ["Quantity", "จำนวน", "Qty"],
      unitPrice: ["Unit Price", "ราคา", "Price", "ราคาต่อชิ้น"],
      totalPrice: ["Total", "ราคารวม", "Subtotal", "Item Total"],
      discount: ["Merchant Discount", "ส่วนลดร้าน", "Seller Discount", "ส่วนลดผู้ขาย"],
      platformDiscount: ["Robinhood Discount", "ส่วนลดจาก Robinhood", "Platform Discount", "ส่วนลดแพลตฟอร์ม"],
      shippingFee: ["Delivery Fee", "ค่าจัดส่ง", "ค่าส่ง"],
      orderTotal: ["Total Amount", "ยอดรวม", "Grand Total", "Net Amount", "ยอดสุทธิ"],
      orderDate: ["Order Date", "วันที่สั่ง", "Created At", "Date", "วันที่", "Order Time"],
      paymentMethod: ["Payment Method", "ช่องทางชำระเงิน", "Payment"],
      commissionFee: ["Commission", "ค่าคอมมิชชั่น", "Service Fee", "ค่าบริการ", "Platform Fee"],
    };

    const AMAZON_MAP: Record<string, string[]> = {
      orderNo: ["Order ID", "Amazon Order Id", "order-id", "หมายเลขคำสั่งซื้อ", "Order Number"],
      orderStatus: ["Order Status", "order-status", "สถานะ", "Status", "Item Status"],
      trackingNo: ["Tracking Number", "tracking-number", "Carrier Tracking ID", "หมายเลขพัสดุ"],
      shippingProvider: ["Carrier", "carrier", "Ship Service Level", "Shipping Service", "ขนส่ง"],
      buyerName: ["Buyer Name", "buyer-name", "Recipient Name", "recipient-name", "ชื่อผู้ซื้อ", "Ship Name"],
      buyerPhone: ["Buyer Phone Number", "buyer-phone", "Ship Phone Number", "เบอร์โทร"],
      buyerAddress: ["Ship Address", "ship-address-1", "Shipping Address", "Ship City", "ที่อยู่จัดส่ง"],
      productName: ["Product Name", "product-name", "Title", "Item Name", "ชื่อสินค้า", "Item Description"],
      sku: ["SKU", "sku", "Seller SKU", "seller-sku", "ASIN", "asin", "Listing ID"],
      variation: ["Variation", "Item Variation"],
      qty: ["Quantity", "quantity", "Quantity Purchased", "quantity-purchased", "จำนวน", "Qty"],
      unitPrice: ["Item Price", "item-price", "Unit Price", "Price", "ราคา", "Per Unit Price"],
      totalPrice: ["Item Total", "item-total", "Subtotal", "ราคารวม", "Product Sales"],
      discount: ["Promotion Discount", "promotion-discount", "Seller Discount", "ส่วนลดผู้ขาย", "Item Promotion Discount"],
      platformDiscount: ["Amazon Discount", "ส่วนลดจาก Amazon", "Platform Discount", "ส่วนลดแพลตฟอร์ม"],
      shippingFee: ["Shipping Price", "shipping-price", "Shipping Fee", "ค่าจัดส่ง", "Postage Credits"],
      orderTotal: ["Order Total", "Total", "ยอดรวม", "Grand Total", "Amount"],
      orderDate: ["Purchase Date", "purchase-date", "Order Date", "Payments Date", "วันที่สั่งซื้อ", "Last Updated Date"],
      paymentMethod: ["Payment Method", "payment-method", "ช่องทางชำระเงิน"],
      commissionFee: ["Referral Fee", "Selling Fees", "Commission", "ค่าคอมมิชชั่น", "Amazon Fees", "FBA Fees", "Service Fee"],
    };

    const SHOPEE_FOOD_MAP: Record<string, string[]> = {
      orderNo: ["Order ID", "หมายเลขออเดอร์", "หมายเลขคำสั่งซื้อ", "order_id", "เลขที่คำสั่งซื้อ", "เลขออเดอร์"],
      orderStatus: ["Order Status", "สถานะ", "สถานะออเดอร์", "Status", "สถานะคำสั่งซื้อ"],
      trackingNo: ["Tracking No", "เลขพัสดุ", "Tracking Number"],
      shippingProvider: ["Delivery Type", "ประเภทการจัดส่ง", "Shipping Provider"],
      buyerName: ["Customer Name", "ชื่อลูกค้า", "ผู้สั่ง", "Recipient Name", "ชื่อผู้รับ"],
      buyerPhone: ["Customer Phone", "เบอร์โทรลูกค้า", "Phone", "เบอร์โทร"],
      buyerAddress: ["Delivery Address", "ที่อยู่จัดส่ง", "Customer Address", "ที่อยู่"],
      productName: ["Item Name", "ชื่อรายการ", "ชื่อเมนู", "ชื่อสินค้า", "Product Name", "รายการอาหาร"],
      sku: ["SKU", "Item ID", "รหัสสินค้า"],
      variation: ["Variation", "ตัวเลือก", "Option"],
      qty: ["Quantity", "จำนวน", "Qty"],
      unitPrice: ["Unit Price", "ราคาต่อหน่วย", "ราคา", "Price", "ราคาต่อชิ้น"],
      totalPrice: ["Subtotal", "ราคารวม", "Item Total", "Amount", "ยอดรวม"],
      discount: ["Seller Discount", "ส่วนลดร้านค้า", "Merchant Discount"],
      platformDiscount: ["Shopee Discount", "ส่วนลดจาก Shopee", "Platform Discount", "Voucher"],
      shippingFee: ["Shipping Fee", "ค่าส่ง", "ค่าจัดส่ง", "Delivery Fee"],
      commissionFee: ["Commission Fee", "ค่าคอมมิชชั่น", "Service Fee", "ค่าบริการ", "GP"],
      paymentMethod: ["Payment Method", "วิธีชำระเงิน", "ช่องทางชำระ"],
      orderDate: ["Order Creation Date", "วันที่สั่ง", "Created Date", "วันที่สร้าง", "Order Date", "วันที่ออเดอร์"],
    };

    const FACEBOOK_MAP: Record<string, string[]> = {
      orderNo: ["หมายเลขคำสั่งซื้อออนไลน์", "หมายเลขออเดอร์ภายใน", "Order ID", "Order No"],
      orderStatus: ["สถานะคำสั่งซื้อ", "Order Status", "สถานะ"],
      trackingNo: ["Tracking Number", "หมายเลขพัสดุ", "เลขพัสดุ"],
      shippingProvider: ["ขนส่ง", "Shipping Provider"],
      buyerName: ["ผู้รับ", "ชื่อผู้รับ", "Recipient Name", "Customer Name"],
      buyerPhone: ["เบอร์โทร", "Phone", "เบอร์โทรศัพท์"],
      buyerAddress: ["ที่อยู่ผู้รับ", "Shipping Address", "ที่อยู่"],
      productName: ["ชื่อสินค้า", "Product Name", "สินค้า"],
      sku: ["รหัสสินค้า", "SKU", "Product Code"],
      variation: ["ตัวเลือกสินค้า", "Variation"],
      qty: ["จำนวน", "Quantity", "Qty"],
      unitPrice: ["ราคาต่อหน่วย", "Unit Price", "ราคา", "ราคาต่อชิ้น"],
      totalPrice: ["รายละเอียดยอดที่ชำระแล้ว", "ยอดรวม", "Subtotal"],
      discount: ["จำนวนส่วนลดร้านค้า", "Seller Discount", "ส่วนลดร้านค้า"],
      platformDiscount: ["จํานวนเงินจํากัด (ตัดส่วนลด)", "Platform Discount"],
      shippingFee: ["ค่าจัดส่ง", "Shipping Fee", "ค่าส่ง"],
      orderTotal: ["ยอดที่ชำระแล้ว", "จำนวนเงินที่ควรได้รับ", "Order Total", "Grand Total"],
      orderDate: ["เวลาชำระเงิน", "Payment Date", "Order Date", "วันที่ชำระเงิน"],
      paymentMethod: ["Payment Method", "ช่องทางชำระเงิน"],
      province: ["จังหวัด", "Province"],
      district: ["เมือง", "District"],
      postalCode: ["รหัสไปรษณีย์", "Postal Code"],
    };

    const fieldMap = platform === "shopee" ? SHOPEE_MAP : platform === "lazada" ? LAZADA_MAP : platform === "tiktok" ? TIKTOK_MAP : platform === "facebook" ? FACEBOOK_MAP : platform === "grab_food" ? GRAB_FOOD_MAP : platform === "line_man" ? LINE_MAN_MAP : platform === "amazon" ? AMAZON_MAP : platform === "shopee_food" ? SHOPEE_FOOD_MAP : ROBINHOOD_MAP;

    const findCol = (field: string): string | null => {
      const candidates = fieldMap[field] || [];
      for (const c of candidates) {
        const found = headers.find(h => h.trim().toLowerCase() === c.toLowerCase());
        if (found) return found;
      }
      for (const c of candidates) {
        const found = headers.find(h => h.trim().toLowerCase().includes(c.toLowerCase()));
        if (found) return found;
      }
      return null;
    };

    const colMap: Record<string, string | null> = {};
    for (const key of Object.keys(fieldMap)) {
      colMap[key] = findCol(key);
    }
    console.log("[Import] Column mapping:", JSON.stringify({ shippedDate: colMap["shippedDate"], completedDate: colMap["completedDate"], orderDate: colMap["orderDate"] }));
    console.log("[Import] Excel headers:", headers.slice(0, 30).join(" | "));

    const getRaw = (row: any, field: string): any => {
      const col = colMap[field];
      if (!col) return "";
      return row[col];
    };

    const getVal = (row: any, field: string): string => {
      const val = getRaw(row, field);
      if (val instanceof Date) return val.toISOString();
      return String(val || "").trim();
    };

    const getNum = (row: any, field: string): number => {
      const raw = getRaw(row, field);
      if (typeof raw === "number") return raw;
      const v = String(raw || "").replace(/[,฿$\s]/g, "");
      return parseFloat(v) || 0;
    };

    const isShopee = platform === "shopee";
    const ordersMap = new Map<string, any>();
    let totalCancelled = 0;

    const parseDateStr = (dateStr: string | Date | number): string => {
      if (!dateStr) return new Date().toISOString().split("T")[0];
      if (dateStr instanceof Date) {
        if (!isNaN(dateStr.getTime())) return dateStr.toISOString().split("T")[0];
        return new Date().toISOString().split("T")[0];
      }
      if (typeof dateStr === "number") {
        if (dateStr > 25000 && dateStr < 80000) {
          const excelEpoch = new Date(1899, 11, 30);
          const jsDate = new Date(excelEpoch.getTime() + dateStr * 86400000);
          return jsDate.toISOString().split("T")[0];
        }
        return new Date().toISOString().split("T")[0];
      }
      const str = String(dateStr).trim();
      if (!str) return new Date().toISOString().split("T")[0];
      const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (isoMatch) {
        let y = Number(isoMatch[1]);
        if (y > 2500) y -= 543;
        return `${y}-${isoMatch[2]}-${isoMatch[3]}`;
      }
      const parts = str.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
      if (parts) {
        let year = Number(parts[3]);
        if (year > 2500) year -= 543;
        if (year < 100) year += 2000;
        return `${year}-${parts[2].padStart(2, "0")}-${parts[1].padStart(2, "0")}`;
      }
      const d = new Date(str);
      if (!isNaN(d.getTime()) && d.getFullYear() > 1990) return d.toISOString().split("T")[0];
      return new Date().toISOString().split("T")[0];
    };

    for (const row of rows) {
      const orderNo = getVal(row, "orderNo");
      if (!orderNo) continue;

      if (isShopee) {
        const orderStatusFull = getVal(row, "orderStatusFull");
        if (orderStatusFull && orderStatusFull !== "สำเร็จแล้ว") {
          if (!ordersMap.has(orderNo)) {
            totalCancelled++;
          }
          continue;
        }
      }

      if (platform === "lazada") {
        const lazStatus = getVal(row, "orderStatus").toLowerCase();
        if (lazStatus === "canceled" || lazStatus === "cancelled" || lazStatus.includes("lost") || lazStatus === "returned" || lazStatus === "failed") {
          if (!ordersMap.has(orderNo)) {
            totalCancelled++;
          }
          continue;
        }
      }

      if (platform === "tiktok") {
        const ttStatus = getVal(row, "orderStatus").toLowerCase();
        if (ttStatus === "cancelled" || ttStatus === "canceled" || ttStatus.includes("cancel")) {
          if (!ordersMap.has(orderNo)) {
            totalCancelled++;
          }
          continue;
        }
      }

      if (!isShopee && platform !== "lazada" && platform !== "tiktok") {
        const genStatus = getVal(row, "orderStatus").toLowerCase();
        if (genStatus.includes("cancel") || genStatus.includes("ยกเลิก") || genStatus === "refunded" || genStatus === "returned") {
          if (!ordersMap.has(orderNo)) {
            totalCancelled++;
          }
          continue;
        }
      }

      const itemName = getVal(row, "productName");
      const variation = getVal(row, "variation");
      const fullName = variation ? `${itemName} (${variation})` : itemName;

      if (!isShopee && ordersMap.size === 0) {
        console.log("[Import] First non-Shopee row sample:", JSON.stringify({
          orderNo,
          unitPrice: getNum(row, "unitPrice"),
          totalPrice: getNum(row, "totalPrice"),
          qty: getNum(row, "qty"),
          shippingFee: getNum(row, "shippingFee"),
          commissionFee: getNum(row, "commissionFee"),
          orderTotal: getNum(row, "orderTotal"),
          colMap_unitPrice: colMap["unitPrice"],
          colMap_totalPrice: colMap["totalPrice"],
          colMap_qty: colMap["qty"],
          rawUnitPrice: getRaw(row, "unitPrice"),
          rawTotalPrice: getRaw(row, "totalPrice"),
          rawQty: getRaw(row, "qty"),
        }));
      }

      const itemNetSellingPrice = isShopee ? getNum(row, "netSellingPrice") : 0;

      const rawQty = getNum(row, "qty");
      const rawUnitPrice = getNum(row, "unitPrice");
      const rawTotalPrice = getNum(row, "totalPrice");

      const isTotalPriceAfterDiscount = !isShopee;
      const sellerVoucherDiscount = getNum(row, "discount");
      const sellerCoinsCashback = isShopee ? getNum(row, "sellerCoinsCashback") : 0;
      const sellerBundleDeal = isShopee ? getNum(row, "sellerBundleDeal") : 0;
      const itemLevelSellerDiscount = isTotalPriceAfterDiscount ? 0 : (sellerVoucherDiscount + sellerCoinsCashback);

      const grossSellingPrice = isShopee ? (itemNetSellingPrice || rawTotalPrice) : rawTotalPrice;

      const item: any = {
        sku: getVal(row, "sku"),
        productName: fullName || "สินค้า",
        qty: rawQty || 1,
        unitPrice: rawUnitPrice,
        totalPrice: isShopee && itemNetSellingPrice ? itemNetSellingPrice : grossSellingPrice,
        discount: itemLevelSellerDiscount,
        sellerVoucherDiscount: isTotalPriceAfterDiscount ? 0 : sellerVoucherDiscount,
        sellerCoinsCashback,
        sellerBundleDeal,
        grossSellingPrice,
        vatType: "vat7",
      };

      if (!item.totalPrice && item.unitPrice && item.qty) {
        item.totalPrice = item.unitPrice * item.qty - item.discount;
      }
      if (!item.unitPrice && item.totalPrice && item.qty) {
        item.unitPrice = Math.round((item.totalPrice + item.discount) / item.qty * 100) / 100;
      }
      if (item.unitPrice && item.qty && !item.totalPrice) {
        item.totalPrice = item.unitPrice * item.qty - item.discount;
      }

      if (ordersMap.has(orderNo)) {
        const existing = ordersMap.get(orderNo);
        existing.items.push(item);
        existing.subtotal += item.totalPrice;
        existing.bundleDealDiscount = (existing.bundleDealDiscount || 0) + (item.sellerBundleDeal || 0);
      } else {
        const orderDate = parseDateStr(getVal(row, "orderDate"));

        if (isShopee) {
          const recipientAddr = getVal(row, "recipientAddress");
          const district = getVal(row, "district");
          const province = getVal(row, "province");
          const postalCode = getVal(row, "postalCode");
          let fullAddress = recipientAddr || "";
          if (fullAddress && (district || province || postalCode)) {
            const hasPostalCode = postalCode && fullAddress.includes(postalCode);
            const hasProvince = province && (fullAddress.includes(province) || fullAddress.includes("จ." + province) || fullAddress.includes("จังหวัด" + province));
            if (!hasPostalCode && !hasProvince) {
              const extras = [district, province, postalCode].filter(Boolean);
              fullAddress = [fullAddress, ...extras.filter(p => !fullAddress.includes(p))].join(" ");
            }
          } else if (!fullAddress) {
            fullAddress = [district, province, postalCode].filter(Boolean).join(" ");
          }
          ordersMap.set(orderNo, {
            orderNo,
            platform,
            orderDate,
            completedDate: orderDate,
            status: getVal(row, "orderStatusFull") || getVal(row, "orderStatus") || "delivered",
            buyerName: getVal(row, "recipientName") || getVal(row, "buyerName") || "ลูกค้า",
            buyerPhone: getVal(row, "recipientPhone") || getVal(row, "buyerPhone"),
            buyerAddress: fullAddress || getVal(row, "buyerAddress"),
            trackingNo: getVal(row, "trackingNo"),
            shippingProvider: getVal(row, "shippingProvider"),
            paymentMethod: getVal(row, "paymentMethod"),
            buyerPaidPrice: getNum(row, "buyerPaidPrice"),
            shippingBuyerPaid: getNum(row, "shippingBuyerPaid"),
            shippingShopeeSubsidy: getNum(row, "shippingShopeeSubsidy"),
            shippingActualCost: getNum(row, "shippingActualCost"),
            commission: getNum(row, "commission"),
            transactionFee: getNum(row, "transactionFee"),
            serviceFee: getNum(row, "serviceFee"),
            netAmount: getNum(row, "netAmount"),
            totalFees: getNum(row, "commission") + getNum(row, "transactionFee") + getNum(row, "serviceFee"),
            subtotal: item.totalPrice,
            bundleDealDiscount: item.sellerBundleDeal || 0,
            items: [item],
          });
        } else {
          const commFee = getNum(row, "commissionFee");
          const smallOrderFee = getNum(row, "smallOrderFee");
          const shipFeeAfterDiscount = getNum(row, "shippingFee");
          const shipOriginal = getNum(row, "shippingOriginal");
          const shipPlatformDiscount = getNum(row, "shippingPlatformDiscount");
          const shipSellerDiscount = getNum(row, "shippingSellerDiscount");
          const actualShipCost = shipOriginal > 0 ? shipOriginal : shipFeeAfterDiscount;
          const buyerPaidShipping = shipFeeAfterDiscount;
          const platformSubsidy = shipPlatformDiscount > 0 ? shipPlatformDiscount : Math.max(0, actualShipCost - buyerPaidShipping - shipSellerDiscount);
          ordersMap.set(orderNo, {
            orderNo,
            platform,
            orderDate,
            completedDate: orderDate,
            status: getVal(row, "orderStatus") || "delivered",
            buyerName: getVal(row, "buyerName") || "ลูกค้า",
            buyerPhone: getVal(row, "buyerPhone"),
            buyerAddress: getVal(row, "buyerAddress"),
            trackingNo: getVal(row, "trackingNo"),
            shippingProvider: getVal(row, "shippingProvider"),
            shippingFee: buyerPaidShipping,
            shippingActualCost: actualShipCost,
            shippingBuyerPaid: buyerPaidShipping,
            shippingShopeeSubsidy: platformSubsidy,
            shippingSellerDiscount: shipSellerDiscount,
            platformDiscount: getNum(row, "platformDiscount"),
            sellerDiscount: getNum(row, "discount"),
            orderTotal: getNum(row, "orderTotal"),
            paymentMethod: getVal(row, "paymentMethod"),
            commissionFee: commFee + smallOrderFee,
            commission: commFee,
            transactionFee: smallOrderFee,
            serviceFee: 0,
            totalFees: commFee + smallOrderFee,
            subtotal: item.totalPrice,
            bundleDealDiscount: item.sellerBundleDeal || 0,
            items: [item],
          });
        }
      }
    }

    const orders = Array.from(ordersMap.values()).map(o => {
      if (!isShopee) {
        if (!o.orderTotal) o.orderTotal = o.subtotal + (o.shippingFee || 0) - (o.platformDiscount || 0) - (o.sellerDiscount || 0);
      }
      return o;
    });

    const responseData: any = {
      platform,
      totalRows: rows.length,
      totalOrders: orders.length,
      totalCancelled,
      headers,
      columnMapping: colMap,
      orders,
    };

    const hasDetailedFees = platform === "shopee" || platform === "tiktok";
    {
      const grandTotalSalesGross = orders.reduce((s, o) => s + (o.subtotal || 0), 0);
      const grandTotalSellerDiscount = orders.reduce((s, o) => {
        const items = o.items || [];
        const itemDisc = items.reduce((sd: number, i: any) => sd + (i.discount || 0), 0);
        return s + itemDisc + (o.bundleDealDiscount || 0);
      }, 0);
      const grandTotalBundleDeal = orders.reduce((s, o) => s + (o.bundleDealDiscount || 0), 0);
      const grandTotalSales = grandTotalSalesGross - grandTotalSellerDiscount;
      responseData.totalCompleted = orders.length;
      responseData.totalCancelled = totalCancelled;
      responseData.totalSkipped = 0;
      responseData.grandTotalSales = Math.round(grandTotalSales * 100) / 100;
      responseData.grandTotalSalesGross = Math.round(grandTotalSalesGross * 100) / 100;
      responseData.grandTotalSellerDiscount = Math.round(grandTotalSellerDiscount * 100) / 100;
      responseData.grandTotalBundleDeal = Math.round(grandTotalBundleDeal * 100) / 100;
      if (hasDetailedFees) {
        const grandTotalFees = orders.reduce((s, o) => s + (o.totalFees || 0), 0);
        const grandTotalShipping = orders.reduce((s, o) => s + (o.shippingActualCost || 0), 0);
        const grandTotalShippingBuyerPaid = orders.reduce((s, o) => s + (o.shippingBuyerPaid || 0), 0);
        const grandTotalShippingShopeeSubsidy = orders.reduce((s, o) => s + (o.shippingShopeeSubsidy || 0), 0);
        const grandTotalShippingSellerPaid = grandTotalShipping - grandTotalShippingBuyerPaid - grandTotalShippingShopeeSubsidy;
        responseData.grandTotalFees = Math.round(grandTotalFees * 100) / 100;
        responseData.grandTotalShipping = Math.round(grandTotalShipping * 100) / 100;
        responseData.grandTotalShippingBuyerPaid = Math.round(grandTotalShippingBuyerPaid * 100) / 100;
        responseData.grandTotalShippingShopeeSubsidy = Math.round(grandTotalShippingShopeeSubsidy * 100) / 100;
        responseData.grandTotalShippingSellerPaid = Math.round(grandTotalShippingSellerPaid * 100) / 100;
      }
    }

    res.json(responseData);
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

app.post("/api/ecommerce/import/create-documents", requireAuth, requireAnyModule("sales", "ecommerce"), async (req, res) => {
  try {
    const user = req.user as any;
    const { companyId, documentType, orders, platform } = req.body;
    if (!companyId || !documentType || !orders || !Array.isArray(orders) || orders.length === 0) {
      return res.status(400).json({ message: "กรุณาระบุข้อมูลให้ครบถ้วน" });
    }
    if (!["invoice", "tax_invoice"].includes(documentType)) {
      return res.status(400).json({ message: "ประเภทเอกสารไม่ถูกต้อง (invoice หรือ tax_invoice)" });
    }

    const [company] = await db.select().from(companies).where(eq(companies.id, Number(companyId)));
    if (!company) return res.status(404).json({ message: "ไม่พบกิจการ" });
    if (user.role !== "super_admin" && company.tenantId && company.tenantId !== user.tenantId) {
      return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึงกิจการนี้" });
    }

    if (orders.length > 5000) {
      return res.status(400).json({ message: "สร้างได้สูงสุด 5,000 เอกสารต่อครั้ง" });
    }

    const existingRefDocs = new Set<string>();
    const platformUpper = String(platform || "").toUpperCase();
    if (documentType === "invoice") {
      const existing = await db.select({ refDoc: invoices.refDoc }).from(invoices)
        .where(and(eq(invoices.companyId, Number(companyId)), sql`${invoices.refDoc} LIKE ${`${platformUpper} #%`}`));
      existing.forEach(e => { if (e.refDoc) existingRefDocs.add(e.refDoc); });
    } else {
      const existing = await db.select({ refDoc: taxInvoices.refDoc }).from(taxInvoices)
        .where(and(eq(taxInvoices.companyId, Number(companyId)), sql`${taxInvoices.refDoc} LIKE ${`${platformUpper} #%`}`));
      existing.forEach(e => { if (e.refDoc) existingRefDocs.add(e.refDoc); });
    }

    const createdDocs: any[] = [];
    const errors: any[] = [];
    const skipped: any[] = [];

    for (const order of orders) {
      const orderNo = String(order.orderNo || "").trim();
      if (!orderNo) { errors.push({ orderNo: "N/A", error: "ไม่มีเลขคำสั่งซื้อ" }); continue; }

      const refDoc = `${platformUpper} #${orderNo}`;
      if (existingRefDocs.has(refDoc)) {
        skipped.push({ orderNo, reason: "นำเข้าแล้ว" });
        continue;
      }
      try {
        if (documentType === "invoice") {
          const prefix = "IV";
          const docDateStr = order.completedDate || order.orderDate || new Date().toISOString().split("T")[0];
          const invoiceNo = await getNextDocNo(companyId, prefix, invoices, invoices.invoiceNo, invoices.companyId, docDateStr);

          const subtotalGross = order.items.reduce((sum: number, i: any) => sum + (parseFloat(i.totalPrice) || 0), 0);
          const itemDiscount = order.items.reduce((sum: number, i: any) => sum + (parseFloat(i.discount) || 0), 0);
          const bundleDeal = parseFloat(order.bundleDealDiscount) || 0;
          const subtotalAfterItemDisc = subtotalGross - itemDiscount;
          const totalAmount = subtotalAfterItemDisc - bundleDeal;
          const vatAmount = Math.round(totalAmount * 7 / 107 * 100) / 100;

          const result = await withDbRetry(() => db.transaction(async (tx) => {
            const [doc] = await tx.insert(invoices).values({
              companyId,
              invoiceNo,
              invoiceDate: order.completedDate || order.orderDate || new Date().toISOString().split("T")[0],
              customerName: order.buyerName || "ลูกค้า",
              customerAddress: order.buyerAddress || null,
              subtotal: String(subtotalAfterItemDisc.toFixed(2)),
              discountAmount: String(bundleDeal.toFixed(2)),
              vatAmount: String(vatAmount.toFixed(2)),
              totalAmount: String(totalAmount.toFixed(2)),
              status: "approved",
              paymentStatus: "paid",
              priceMode: "included",
              docPrefix: prefix,
              refDoc: `${platform?.toUpperCase()} #${order.orderNo}`,
              notes: `นำเข้าจาก ${platform} - ${order.orderNo}${order.trackingNo ? ` | เลขพัสดุ: ${order.trackingNo}` : ""}`,
              createdBy: user.id,
            }).returning();

            for (const item of order.items) {
              const itemGross = parseFloat(item.totalPrice || "0");
              const itemDisc = parseFloat(item.discount || "0");
              await tx.insert(invoiceItems).values({
                invoiceId: doc.id,
                productCode: item.sku || null,
                productName: item.productName || "สินค้า",
                qty: String(item.qty || "1"),
                unit: "ชิ้น",
                unitPrice: String(parseFloat(item.unitPrice || "0").toFixed(2)),
                discount: String(itemDisc.toFixed(2)),
                total: String((itemGross - itemDisc).toFixed(2)),
                vatType: item.vatType || "vat7",
              });
            }
            return doc;
          }));

          let journalInfo: any = null;
          try {
            const revenueBeforeVat = (parseFloat(result.totalAmount) - parseFloat(result.vatAmount)).toFixed(2);
            journalInfo = await createAutoJournalEntry({
              companyId: result.companyId,
              documentType: "invoice",
              sourceDocType: "invoice",
              sourceDocId: result.id,
              docDate: result.invoiceDate,
              docNo: result.invoiceNo,
              subtotal: revenueBeforeVat,
              vatAmount: String(result.vatAmount),
              totalAmount: String(result.totalAmount),
              withholdingTax: "0",
              currencyCode: "THB",
              exchangeRate: "1",
              userId: user.id,
              customerName: result.customerName,
              overrideLines: body?.journalOverrideLines || undefined,
            });
            if (journalInfo?.skipped) {
              console.log(`[E-Com Import] Invoice ${result.invoiceNo} auto-journal skipped: ${journalInfo.reason}`);
            }
          } catch (e: any) {
            console.error(`[E-Com Import] Invoice ${result.invoiceNo} auto-journal error:`, e.message);
            journalInfo = { journalEntryId: null, skipped: true, reason: e.message };
          }

          createdDocs.push({ orderNo: order.orderNo, docNo: result.invoiceNo, docId: result.id, type: "invoice", journal: journalInfo });
        } else {
          const PLATFORM_DOC_PREFIX_BATCH: Record<string, string> = {
            shopee: "SH", lazada: "LZ", tiktok: "TK",
            grab: "GR", "grab food": "GR", grab_food: "GR", lineman: "LM", "line man": "LM", line_man: "LM",
            robinhood: "RH", amazon: "AZ", shopee_food: "SF", "shopee food": "SF",
          };
          const platformKey = String(platform || "").toLowerCase();
          const prefix = connection?.docPrefix || PLATFORM_DOC_PREFIX_BATCH[platformKey] || "TIV";
          const tivDocDate = order.completedDate || order.orderDate || new Date().toISOString().split("T")[0];
          const taxInvoiceNo = await getNextDocNo(companyId, prefix, taxInvoices, taxInvoices.taxInvoiceNo, taxInvoices.companyId, tivDocDate);

          const subtotalGrossTiv = order.items.reduce((sum: number, i: any) => sum + (parseFloat(i.totalPrice) || 0), 0);
          const itemDiscountTiv = order.items.reduce((sum: number, i: any) => sum + (parseFloat(i.discount) || 0), 0);
          const bundleDealTiv = parseFloat(order.bundleDealDiscount) || 0;
          const subtotalAfterItemDiscTiv = subtotalGrossTiv - itemDiscountTiv;
          const totalAmountTiv = subtotalAfterItemDiscTiv - bundleDealTiv;
          const vatAmount = Math.round(totalAmountTiv * 7 / 107 * 100) / 100;

          const result = await withDbRetry(() => db.transaction(async (tx) => {
            const [doc] = await tx.insert(taxInvoices).values({
              companyId,
              taxInvoiceNo,
              taxInvoiceDate: order.completedDate || order.orderDate || new Date().toISOString().split("T")[0],
              customerName: order.buyerName || "ลูกค้า",
              customerAddress: order.buyerAddress || null,
              subtotal: String(subtotalAfterItemDiscTiv.toFixed(2)),
              discountAmount: String(bundleDealTiv.toFixed(2)),
              vatAmount: String(vatAmount.toFixed(2)),
              totalAmount: String(totalAmountTiv.toFixed(2)),
              status: "approved",
              priceMode: "included",
              docPrefix: prefix,
              refDoc: `${platform?.toUpperCase()} #${order.orderNo}`,
              notes: `นำเข้าจาก ${platform} - ${order.orderNo}${order.trackingNo ? ` | เลขพัสดุ: ${order.trackingNo}` : ""}`,
              createdBy: user.id,
            }).returning();

            for (const item of order.items) {
              await tx.insert(taxInvoiceItems).values({
                taxInvoiceId: doc.id,
                productCode: item.sku || null,
                productName: item.productName || "สินค้า",
                qty: String(item.qty || "1"),
                unit: "ชิ้น",
                unitPrice: String(parseFloat(item.unitPrice || "0").toFixed(2)),
                discount: String(parseFloat(item.discount || "0").toFixed(2)),
                total: String(((parseFloat(item.totalPrice || "0")) - (parseFloat(item.discount || "0"))).toFixed(2)),
                vatType: item.vatType || "vat7",
              });
            }
            return doc;
          }));

          let journalInfo: any = null;
          try {
            journalInfo = await createAutoJournalEntry({
              companyId: result.companyId,
              documentType: "tax_invoice",
              sourceDocType: "tax_invoice",
              sourceDocId: result.id,
              docDate: result.taxInvoiceDate,
              docNo: result.taxInvoiceNo,
              subtotal: (parseFloat(result.totalAmount) - parseFloat(result.vatAmount)).toFixed(2),
              vatAmount: String(result.vatAmount),
              totalAmount: String(result.totalAmount),
              withholdingTax: "0",
              currencyCode: "THB",
              exchangeRate: "1",
              userId: user.id,
              customerName: result.customerName,
              overrideLines: body?.journalOverrideLines || undefined,
            });
            if (journalInfo?.skipped) {
              console.log(`[E-Com Import] TaxInvoice ${result.taxInvoiceNo} auto-journal skipped: ${journalInfo.reason}`);
            }
          } catch (e: any) {
            console.error(`[E-Com Import] TaxInvoice ${result.taxInvoiceNo} auto-journal error:`, e.message);
            journalInfo = { journalEntryId: null, skipped: true, reason: e.message };
          }

          createdDocs.push({ orderNo: order.orderNo, docNo: result.taxInvoiceNo, docId: result.id, type: "tax_invoice", journal: journalInfo });
        }
      } catch (err: any) {
        errors.push({ orderNo: order.orderNo, error: err.message });
      }
    }

    res.json({
      success: true,
      totalCreated: createdDocs.length,
      totalErrors: errors.length,
      totalSkipped: skipped.length,
      createdDocs,
      errors,
      skipped,
    });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ============ Shopee Batch Import ============
app.post("/api/ecommerce/import/create-shopee-batch", requireAuth, requireAnyModule("sales", "ecommerce"), async (req, res) => {
  try {
    const user = req.user as any;
    const { companyId, platform, fileName, orders, appendToBatchId, includeShippingInTiv, connectionId: reqConnectionId } = req.body;
    const includeShipping = includeShippingInTiv !== false;
    if (!companyId || !orders || !Array.isArray(orders) || orders.length === 0) {
      return res.status(400).json({ message: "กรุณาระบุข้อมูลให้ครบถ้วน" });
    }

    const [company] = await db.select().from(companies).where(eq(companies.id, Number(companyId)));
    if (!company) return res.status(404).json({ message: "ไม่พบกิจการ" });
    if (user.role !== "super_admin" && company.tenantId && company.tenantId !== user.tenantId) {
      return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึงกิจการนี้" });
    }

    if (orders.length > 5000) {
      return res.status(400).json({ message: "สร้างได้สูงสุด 5,000 เอกสารต่อครั้ง" });
    }

    let connection: any = null;
    if (reqConnectionId) {
      const [c] = await ecomDb.select().from(ecommerceConnections)
        .where(and(eq(ecommerceConnections.id, Number(reqConnectionId)), eq(ecommerceConnections.companyId, Number(companyId))));
      connection = c || null;
    }
    if (!connection) {
      const [c] = await ecomDb.select().from(ecommerceConnections)
        .where(and(eq(ecommerceConnections.companyId, Number(companyId)), eq(ecommerceConnections.platform, platform || "shopee")));
      connection = c || null;
    }
    if (!connection) {
      const PLATFORM_DEFAULT_PREFIX: Record<string, string> = { shopee: "SH01", lazada: "LZ01", tiktok: "TK01", amazon: "AZ01" };
      const [newConn] = await ecomDb.insert(ecommerceConnections).values({
        companyId: Number(companyId),
        platform: platform || "shopee",
        shopName: `${platform || "Shopee"} Import`,
        docPrefix: PLATFORM_DEFAULT_PREFIX[platform || "shopee"] || (platform || "XX").substring(0, 2).toUpperCase() + "01",
        status: "connected",
      }).returning();
      connection = newConn;
    }

    let batch: any;
    if (appendToBatchId) {
      const [existingBatch] = await db.select().from(ecommerceImportBatches).where(eq(ecommerceImportBatches.id, Number(appendToBatchId)));
      if (existingBatch && existingBatch.companyId === Number(companyId)) {
        batch = existingBatch;
      }
    }
    if (!batch) {
      const [newBatch] = await db.insert(ecommerceImportBatches).values({
        companyId: Number(companyId),
        platform: platform || "shopee",
        fileName: fileName || null,
        importType: "orders",
        totalOrders: 0,
        totalSkipped: 0,
        totalErrors: 0,
        totalTaxInvoices: 0,
        totalJournalEntries: 0,
        status: "active",
        createdBy: user.id,
      }).returning();
      batch = newBatch;
    }

    const allAccounts = await db.select().from(accounts).where(eq(accounts.companyId, Number(companyId)));
    const accountMap = new Map(allAccounts.map(a => [a.code, a]));

    const findAccount = (primaryCode: string, ...fallbackCodes: string[]) => {
      let acc = accountMap.get(primaryCode);
      if (acc) return acc;
      for (const code of fallbackCodes) {
        acc = accountMap.get(code);
        if (acc) return acc;
      }
      if (fallbackCodes.some(c => c.includes("xxx"))) {
        const prefix = primaryCode.substring(0, 1);
        for (const [code, a] of accountMap) {
          if (code.startsWith(prefix) && !a.isHeader) return a;
        }
      }
      return null;
    };

    // Platform-specific account codes (ลูกหนี้/รายได้ แยกตามแพลตฟอร์ม)
    // Uses chart-of-accounts ECOMMERCE_EXTRA_ACCOUNTS structure
    const PLATFORM_AR: Record<string, string> = {
      shopee: "1231000", lazada: "1232000", tiktok: "1233000", live: "1234000",
    };
    const PLATFORM_REVENUE: Record<string, string> = {
      shopee: "4011000", lazada: "4012000", tiktok: "4013000", live: "4014000",
    };
    const PLATFORM_REV_NAMES: Record<string, { name: string; nameTh: string }> = {
      shopee:  { name: "Shopee Sales", nameTh: "รายได้จากการขาย Shopee" },
      lazada:  { name: "Lazada Sales", nameTh: "รายได้จากการขาย Lazada" },
      tiktok:  { name: "TikTok Shop Sales", nameTh: "รายได้จากการขาย TikTok Shop" },
      live:    { name: "Facebook Sales", nameTh: "รายได้จากการขาย Facebook" },
    };
    const PLATFORM_AR_NAMES: Record<string, { name: string; nameTh: string }> = {
      shopee:  { name: "Shopee Receivable", nameTh: "ลูกหนี้ Shopee" },
      lazada:  { name: "Lazada Receivable", nameTh: "ลูกหนี้ Lazada" },
      tiktok:  { name: "TikTok Shop Receivable", nameTh: "ลูกหนี้ TikTok Shop" },
      live:    { name: "Facebook Receivable", nameTh: "ลูกหนี้ Facebook" },
    };
    const platformKey = (platform || "shopee").toLowerCase();

    const resolveOneAccount = (code: string): any => {
      if (!code) return null;
      const exact = accountMap.get(code);
      if (exact && !exact.isHeader) return exact;
      for (const [aCode, acc] of accountMap) {
        if (aCode.startsWith(code) && aCode !== code && !acc.isHeader) return acc;
      }
      return null;
    };

    // Resolve account by code, verifying it's the RIGHT type of account (asset/revenue)
    const resolveTypedAccount = (code: string, expectedType: string): any => {
      const acc = resolveOneAccount(code);
      if (acc && acc.type === expectedType) return acc;
      return null;
    };

    const PLATFORM_PARENT_HEADERS: Record<string, { code: string; name: string; nameTh: string; type: string; parentCode: string }> = {
      "123": { code: "123", name: "Platform Receivables", nameTh: "ลูกหนี้แพลตฟอร์ม", type: "asset", parentCode: "120" },
      "401": { code: "401", name: "E-commerce Revenue", nameTh: "รายได้จากการขาย E-Commerce", type: "revenue", parentCode: "400" },
    };

    const ensureParentHeader = async (parentCode: string): Promise<any> => {
      const existingParent = await db.select().from(accounts).where(and(eq(accounts.companyId, Number(companyId)), eq(accounts.code, parentCode)));
      if (existingParent.length > 0) { accountMap.set(parentCode, existingParent[0]); return existingParent[0]; }
      const tmpl = PLATFORM_PARENT_HEADERS[parentCode];
      if (!tmpl) return null;
      const existingGrandParent = await db.select().from(accounts).where(and(eq(accounts.companyId, Number(companyId)), eq(accounts.code, tmpl.parentCode)));
      if (existingGrandParent.length === 0) return null;
      try {
        const [newParent] = await db.insert(accounts).values({
          companyId: Number(companyId),
          code: tmpl.code,
          name: tmpl.name,
          nameTh: tmpl.nameTh,
          type: tmpl.type,
          parentCode: tmpl.parentCode,
          isHeader: true,
        }).returning();
        accountMap.set(tmpl.code, newParent);
        return newParent;
      } catch (e: any) {
        const existing = await db.select().from(accounts).where(and(eq(accounts.companyId, Number(companyId)), eq(accounts.code, tmpl.code)));
        if (existing.length > 0) { accountMap.set(tmpl.code, existing[0]); return existing[0]; }
        console.error(`ensureParentHeader failed for ${parentCode}:`, e.message);
        return null;
      }
    };

    const ensurePlatformAccount = async (code: string, parentCode: string, names: { name: string; nameTh: string }, type: string): Promise<any> => {
      const existing = await db.select().from(accounts).where(and(eq(accounts.companyId, Number(companyId)), eq(accounts.code, code)));
      if (existing.length > 0) {
        const acc = existing[0];
        if (!acc.isHeader) { accountMap.set(code, acc); return acc; }
      }
      let parent = accountMap.get(parentCode);
      if (!parent) {
        parent = await ensureParentHeader(parentCode);
      }
      if (!parent) return null;
      try {
        const [newAcc] = await db.insert(accounts).values({
          companyId: Number(companyId),
          code,
          name: names.name,
          nameTh: names.nameTh,
          type,
          parentCode,
          isHeader: false,
        }).returning();
        accountMap.set(code, newAcc);
        return newAcc;
      } catch (e: any) {
        const existingRetry = await db.select().from(accounts).where(and(eq(accounts.companyId, Number(companyId)), eq(accounts.code, code)));
        if (existingRetry.length > 0) { accountMap.set(code, existingRetry[0]); return existingRetry[0]; }
        return null;
      }
    };

    // Resolve AR account: platform-specific → generic 112 → 1101
    const platformArCode = PLATFORM_AR[platformKey];
    let arAccount: any = null;
    if (platformArCode) {
      const directLookup = await db.select().from(accounts).where(and(eq(accounts.companyId, Number(companyId)), eq(accounts.code, platformArCode)));
      if (directLookup.length > 0 && !directLookup[0].isHeader) {
        arAccount = directLookup[0];
        accountMap.set(platformArCode, arAccount);
      }
    }
    if (!arAccount && platformArCode && PLATFORM_AR_NAMES[platformKey]) {
      arAccount = await ensurePlatformAccount(platformArCode, "123", PLATFORM_AR_NAMES[platformKey], "asset");
    }
    if (!arAccount) {
      const fallback123Children = await db.select().from(accounts).where(and(eq(accounts.companyId, Number(companyId)), eq(accounts.parentCode, "123"), eq(accounts.isHeader, false)));
      if (fallback123Children.length > 0) {
        arAccount = fallback123Children[0];
      }
    }
    if (!arAccount) {
      console.warn(`[batch-import] Company ${companyId}: AR account 1201000 not found for platform ${platformKey}`);
    }

    // Resolve revenue account: platform-specific → check it's actually revenue → 4001
    const platformRevCode = PLATFORM_REVENUE[platformKey];
    let salesAccount: any = null;
    if (platformRevCode) {
      const directRevLookup = await db.select().from(accounts).where(and(eq(accounts.companyId, Number(companyId)), eq(accounts.code, platformRevCode)));
      if (directRevLookup.length > 0 && !directRevLookup[0].isHeader && directRevLookup[0].type === "revenue") {
        salesAccount = directRevLookup[0];
        accountMap.set(platformRevCode, salesAccount);
      }
      if (!salesAccount && PLATFORM_REV_NAMES[platformKey]) {
        salesAccount = await ensurePlatformAccount(platformRevCode, "401", PLATFORM_REV_NAMES[platformKey], "revenue");
      }
    }
    if (!salesAccount) {
      const fallback401Children = await db.select().from(accounts).where(and(eq(accounts.companyId, Number(companyId)), eq(accounts.parentCode, "401"), eq(accounts.isHeader, false)));
      if (fallback401Children.length > 0) {
        salesAccount = fallback401Children[0];
      }
    }
    if (!salesAccount) {
      console.warn(`[batch-import] Company ${companyId}: Revenue account not found for platform ${platformKey}`);
    }

    let vatAccount: any = null;
    for (const vatCode of ["2341000", "2341100"]) {
      const lookup = await db.select().from(accounts).where(and(eq(accounts.companyId, Number(companyId)), eq(accounts.code, vatCode), eq(accounts.isHeader, false)));
      if (lookup.length > 0) { vatAccount = lookup[0]; break; }
    }
    if (!vatAccount) {
      const fallback234 = await db.select().from(accounts).where(and(eq(accounts.companyId, Number(companyId)), eq(accounts.parentCode, "234"), eq(accounts.isHeader, false)));
      if (fallback234.length > 0) vatAccount = fallback234.find((a: any) => a.nameTh?.includes("ภาษีขาย")) || fallback234[0];
    }
    if (!vatAccount) {
      console.warn(`[batch-import] Company ${companyId}: VAT account 2341000 not found`);
    }

    // Auto-create products from imported SKUs
    const existingProducts = await db.select().from(products)
      .where(eq(products.companyId, Number(companyId)));
    const productByCode = new Map(existingProducts.filter(p => p.code).map(p => [p.code.trim().toLowerCase(), p]));
    const productByName = new Map(existingProducts.filter(p => p.name).map(p => [p.name.trim().toLowerCase(), p]));

    let productsCreated = 0;
    const seenCodes = new Set<string>();
    const seenNames = new Set<string>();

    for (const order of orders) {
      const orderItems = order.items || [];
      for (const item of orderItems) {
        const sku = String(item.sku || "").trim();
        const productName = String(item.productName || "").trim();
        if (!sku && !productName) continue;

        const skuLower = sku ? sku.toLowerCase() : "";
        const nameLower = productName ? productName.toLowerCase() : "";

        if (skuLower && (seenCodes.has(skuLower) || productByCode.has(skuLower))) continue;
        if (!skuLower && nameLower && (seenNames.has(nameLower) || productByName.has(nameLower))) continue;

        if (skuLower) seenCodes.add(skuLower);
        if (nameLower) seenNames.add(nameLower);

        try {
          const code = sku || `IMP-${companyId}-${Date.now()}-${productsCreated}`;
          if (productByCode.has(code.toLowerCase())) continue;

          const unitPrice = parseFloat(item.unitPrice || "0") || 0;
          const [newProduct] = await db.insert(products).values({
            companyId: Number(companyId),
            code,
            name: productName || sku,
            category: "product",
            productType: "simple",
            unit: "ชิ้น",
            price: String(unitPrice.toFixed(2)),
            cost: "0",
            vatType: item.vatType || "vat7",
            active: true,
          }).returning();

          productByCode.set(code.toLowerCase(), newProduct);
          if (nameLower) productByName.set(nameLower, newProduct);
          productsCreated++;
        } catch (e: any) {
          // Skip duplicate - product may already exist
        }
      }
    }

    const createdDocs: any[] = [];
    const errors: any[] = [];
    const skipped: any[] = [];

    const totalToProcess = orders.length;
    const logEvery = Math.max(50, Math.floor(totalToProcess / 20));
    console.log(`[batch-import] Starting batch: ${totalToProcess} orders for company ${companyId} (${platform})`);

    for (let orderIdx = 0; orderIdx < orders.length; orderIdx++) {
      const order = orders[orderIdx];
      const orderNo = String(order.orderNo || "").trim();
      if (!orderNo) { errors.push({ orderNo: "N/A", error: "ไม่มีเลขคำสั่งซื้อ" }); continue; }

      if (orderIdx > 0 && orderIdx % logEvery === 0) {
        console.log(`[batch-import] Progress: ${orderIdx}/${totalToProcess} (created: ${createdDocs.length}, skipped: ${skipped.length}, errors: ${errors.length})`);
      }

      const t1 = Date.now();
      try {
        const t0 = Date.now();
        const [existingOrder] = await ecomDb.select().from(ecommerceOrders)
          .where(and(eq(ecommerceOrders.companyId, Number(companyId)), eq(ecommerceOrders.platformOrderId, orderNo)));
        console.log(`[batch-import] [${orderNo}] dup check: ${Date.now()-t0}ms`);
        if (existingOrder) {
          skipped.push({ orderNo, reason: "มีออเดอร์นี้อยู่แล้ว" });
          continue;
        }

        const items = order.items || [];
        const itemSubtotalGross = items.reduce((s: number, i: any) => s + (parseFloat(i.totalPrice) || 0), 0);
        const itemLevelDiscount = items.reduce((s: number, i: any) => s + (parseFloat(i.discount) || 0), 0);
        const bundleDealDiscount = parseFloat(order.bundleDealDiscount) || 0;
        const totalSellerDiscount = itemLevelDiscount + bundleDealDiscount;
        const itemSubtotal = itemSubtotalGross - itemLevelDiscount;
        const shippingBuyerPaid = Math.abs(parseFloat(order.shippingBuyerPaid) || parseFloat(order.shippingFee) || 0);
        const shippingActualCost = Math.abs(parseFloat(order.shippingActualCost) || 0);
        const commissionVal = Math.abs(parseFloat(order.commission || order.commissionFee) || 0);
        const transactionFeeVal = Math.abs(parseFloat(order.transactionFee) || 0);
        const serviceFeeVal = Math.abs(parseFloat(order.serviceFee) || 0);
        const paymentFeeVal = Math.abs(parseFloat(order.paymentFee) || 0);
        const totalFees = commissionVal + transactionFeeVal + serviceFeeVal + paymentFeeVal;
        if (orderIdx === 0) {
          console.log(`[batch-import] Fee debug: commission=${order.commission} → ${commissionVal}, txFee=${order.transactionFee} → ${transactionFeeVal}, svcFee=${order.serviceFee} → ${serviceFeeVal}, pmtFee=${order.paymentFee} → ${paymentFeeVal}, totalFees=${totalFees}`);
          console.log(`[batch-import] Discount debug: itemSubtotalGross=${itemSubtotalGross}, itemLevelDiscount=${itemLevelDiscount}, bundleDeal=${bundleDealDiscount}, netSubtotal=${itemSubtotal}`);
        }
        const shippingShopeeSubsidyVal = Math.abs(parseFloat(order.shippingShopeeSubsidy) || 0);
        const sellerShippingDiff = Math.max(0, shippingActualCost - shippingBuyerPaid - shippingShopeeSubsidyVal);
        const shippingForTiv = includeShipping ? shippingBuyerPaid : 0;
        const tivSubtotalGross = itemSubtotalGross + shippingForTiv;
        const tivSubtotal = itemSubtotal + shippingForTiv - bundleDealDiscount;
        const isVatRegistered = company.vatRegistered === true;

        let vatAmount = 0;
        if (isVatRegistered) {
          const vat7ItemsNet = items
            .filter((i: any) => (i.vatType || "vat7") === "vat7")
            .reduce((s: number, i: any) => s + ((parseFloat(i.totalPrice) || 0) - (parseFloat(i.discount) || 0)), 0);
          const vat7Shipping = shippingForTiv;
          const vat7Total = vat7ItemsNet + vat7Shipping - bundleDealDiscount;
          vatAmount = Math.round(vat7Total * 7 / 107 * 100) / 100;
        }
        const completedDate = order.orderDate || order.completedDate || new Date().toISOString().split("T")[0];

        console.log(`[batch-import] [${orderNo}] starting transaction...`);
        const result = await db.transaction(async (tx) => {
          const [eOrder] = await tx.insert(ecommerceOrders).values({
            companyId: Number(companyId),
            connectionId: connection.id,
            platform: platform || "shopee",
            platformOrderId: orderNo,
            orderNo: orderNo,
            status: "delivered",
            buyerName: order.buyerName || "ลูกค้า",
            buyerPhone: order.buyerPhone || null,
            buyerAddress: order.buyerAddress || null,
            subtotal: String(itemSubtotal.toFixed(2)),
            shippingFee: String(shippingBuyerPaid.toFixed(2)),
            platformDiscount: String(Math.abs(parseFloat(order.platformDiscount) || 0).toFixed(2)),
            sellerDiscount: String(totalSellerDiscount.toFixed(2)),
            totalAmount: String(tivSubtotal.toFixed(2)),
            commissionFee: String(commissionVal.toFixed(2)),
            serviceFee: String(serviceFeeVal.toFixed(2)),
            shippingCost: String(shippingActualCost.toFixed(2)),
            trackingNo: order.trackingNo || null,
            shippingProvider: order.shippingProvider || null,
            paymentMethod: order.paymentMethod || null,
            placedAt: order.orderDate ? new Date(order.orderDate) : new Date(),
            shippedAt: completedDate ? new Date(completedDate) : new Date(),
            deliveredAt: completedDate ? new Date(completedDate) : new Date(),
            importBatchId: batch.id,
            netSellingPrice: String(itemSubtotal.toFixed(2)),
            buyerPaidPrice: String((parseFloat(order.buyerPaidPrice) || tivSubtotal).toFixed(2)),
            platformShippingSubsidy: String((parseFloat(order.shippingShopeeSubsidy) || parseFloat(order.platformShippingSubsidy) || 0).toFixed(2)),
            transactionFee: String(transactionFeeVal.toFixed(2)),
            paymentFee: String(paymentFeeVal.toFixed(2)),
            netIncome: String((itemSubtotal + shippingBuyerPaid - commissionVal - serviceFeeVal - transactionFeeVal - paymentFeeVal - shippingActualCost + shippingShopeeSubsidyVal).toFixed(2)),
            completedAt: completedDate ? new Date(completedDate) : new Date(),
            orderSource: "import",
          }).returning();

          for (const item of items) {
            const skuLower = (item.sku || "").trim().toLowerCase();
            const matchedProduct = skuLower ? productByCode.get(skuLower) : null;
            await tx.insert(ecommerceOrderItems).values({
              orderId: eOrder.id,
              productId: matchedProduct?.id || null,
              platformSku: item.sku || null,
              name: item.productName || "สินค้า",
              qty: String(item.qty || "1"),
              price: String(parseFloat(item.unitPrice || "0").toFixed(2)),
              discount: String(parseFloat(item.discount || "0").toFixed(2)),
              total: String(parseFloat(item.totalPrice || "0").toFixed(2)),
              vatType: item.vatType || "vat7",
            });
          }

          const PLATFORM_DEFAULT_PREFIX: Record<string, string> = { shopee: "SH", lazada: "LZ", tiktok: "TK", amazon: "AZ" };
          const prefix = connection?.docPrefix || PLATFORM_DEFAULT_PREFIX[String(platform || "shopee").toLowerCase()] || "SH";
          const taxInvoiceNo = await getNextDocNo(Number(companyId), prefix, taxInvoices, taxInvoices.taxInvoiceNo, taxInvoices.companyId, completedDate);

          const tivItemsData: any[] = items.map((item: any) => {
            const gross = parseFloat(item.totalPrice || "0");
            const disc = parseFloat(item.discount || "0");
            const net = gross - disc;
            return {
              productCode: item.sku || null,
              productName: item.productName || "สินค้า",
              qty: String(item.qty || "1"),
              unit: "ชิ้น",
              unitPrice: String(parseFloat(item.unitPrice || "0").toFixed(2)),
              discount: String(disc.toFixed(2)),
              total: String(net.toFixed(2)),
              vatType: isVatRegistered ? (item.vatType || "vat7") : "vat0",
            };
          });

          if (shippingForTiv > 0) {
            tivItemsData.push({
              productCode: null,
              productName: "ค่าจัดส่ง",
              qty: "1",
              unit: "รายการ",
              unitPrice: String(shippingForTiv.toFixed(2)),
              discount: "0",
              total: String(shippingForTiv.toFixed(2)),
              vatType: isVatRegistered ? "vat7" : "vat0",
            });
          }

          const docLabel = isVatRegistered ? "ใบกำกับภาษี" : "ใบเสร็จรับเงิน";
          // subtotal = items total (VAT-inclusive when priceMode=included)
          // Document renderer calculates valueBeforeVat from subtotal/vatAmount/priceMode
          const [tiv] = await tx.insert(taxInvoices).values({
            companyId: Number(companyId),
            taxInvoiceNo,
            taxInvoiceDate: completedDate,
            customerName: order.buyerName || "ลูกค้า",
            customerAddress: order.buyerAddress || null,
            subtotal: String((itemSubtotal + shippingForTiv).toFixed(2)),
            discountAmount: String(bundleDealDiscount.toFixed(2)),
            vatAmount: String(vatAmount.toFixed(2)),
            totalAmount: String(tivSubtotal.toFixed(2)),
            status: "approved",
            priceMode: isVatRegistered ? "included" : "excluded",
            docPrefix: prefix,
            refDoc: `${String(platform || "SHOPEE").toUpperCase()} #${orderNo}`,
            notes: `${docLabel} - นำเข้าจาก ${platform || "Shopee"} - ${orderNo}${order.trackingNo ? ` | เลขพัสดุ: ${order.trackingNo}` : ""}`,
            createdBy: user.id,
          }).returning();

          for (const tivItem of tivItemsData) {
            await tx.insert(taxInvoiceItems).values({
              taxInvoiceId: tiv.id,
              ...tivItem,
            });
          }

          // Create stock movements (ตัดสต๊อก) for each product item
          for (const item of items) {
            const sku = String(item.sku || "").trim().toLowerCase();
            const productName = String(item.productName || "").trim().toLowerCase();
            const matchedProduct = (sku ? productByCode.get(sku) : null) || (productName ? productByName.get(productName) : null);
            if (matchedProduct) {
              const qty = parseFloat(item.qty || "1") || 1;
              const unitPrice = parseFloat(item.unitPrice || "0") || 0;
              await tx.insert(stockMovements).values({
                companyId: Number(companyId),
                productId: matchedProduct.id,
                movementType: "sale",
                quantity: String(-qty),
                unitCost: String(unitPrice.toFixed(2)),
                totalCost: String((qty * unitPrice).toFixed(2)),
                referenceType: "tax_invoice",
                referenceId: tiv.id,
                referenceNo: taxInvoiceNo,
                notes: `ขาย ${platform || "Shopee"} #${orderNo}`,
                createdBy: user.id,
              });
            }
          }

          try { await recalcBundleStock(Number(companyId)); } catch(e) { console.error("Bundle recalc error:", e); }
          try { await recalcBomStock(Number(companyId)); } catch(e) { console.error("BOM recalc error:", e); }

          try {
            const itemsCost = items.reduce((sum: number, i: any) => {
              const qty = parseFloat(i.qty || "1") || 1;
              const unitPrice = parseFloat(i.unitPrice || "0") || 0;
              return sum + (qty * unitPrice);
            }, 0);
            if (itemsCost > 0) {
              await createCOGSJournalEntry(
                Number(companyId), "tax_invoice", tiv.id, completedDate,
                `${docLabel} ${taxInvoiceNo} - ${order.buyerName || "ลูกค้า"}`,
                itemsCost, user.id, order.buyerName || undefined
              );
            }
          } catch (cogsErr: any) { console.error("E-commerce COGS JE error:", cogsErr.message); }

          let journalEntry: any = null;

          const canCreateJournal = arAccount && salesAccount && (isVatRegistered ? vatAccount : true);
          if (!canCreateJournal) {
            console.warn(`[batch-import] Company ${companyId} order ${orderNo}: ไม่สามารถลงบัญชีอัตโนมัติ - arAccount=${!!arAccount}, salesAccount=${!!salesAccount}, vatAccount=${!!vatAccount}, isVatRegistered=${isVatRegistered}`);
          }
          if (canCreateJournal) {
            const entryNo = await getNextJournalEntryNo(Number(companyId), "sales", completedDate);
            const journalDesc = `${docLabel} ${taxInvoiceNo} - ${order.buyerName || "ลูกค้า"}`;

            const [je] = await tx.insert(journalEntries).values({
              companyId: Number(companyId),
              entryNo,
              entryDate: completedDate,
              reference: taxInvoiceNo,
              description: journalDesc,
              journalBook: "sales",
              contactName: order.buyerName || null,
              createdBy: user.id,
              status: "posted",
              sourceDocType: "tax_invoice",
              sourceDocId: tiv.id,
              currencyCode: "THB",
              exchangeRate: "1",
            }).returning();

            journalEntry = je;

            // Calculate revenue and VAT (ตั้งหนี้อย่างเดียว - ไม่บันทึกค่าใช้จ่าย)
            // tivSubtotal = itemSubtotal + shippingBuyerPaid (VAT-included total)
            let totalVat: number;
            let salesRevenue: number;

            if (isVatRegistered) {
              totalVat = vatAmount;
              salesRevenue = Math.round((tivSubtotal - totalVat) * 100) / 100;
            } else {
              salesRevenue = tivSubtotal;
              totalVat = 0;
            }

            // DR ลูกหนี้แพลตฟอร์ม = ยอดรวมใบกำกับภาษี (ยอดสินค้า + ค่าส่ง)
            await tx.insert(journalLines).values({
              journalEntryId: je.id,
              accountId: arAccount.id,
              description: arAccount.nameTh || arAccount.name || `ลูกหนี้ ${platform || "Shopee"}`,
              debit: String(tivSubtotal.toFixed(2)),
              credit: "0",
            });

            // CR รายได้จากการขาย (ก่อน VAT)
            await tx.insert(journalLines).values({
              journalEntryId: je.id,
              accountId: salesAccount.id,
              description: salesAccount.nameTh || salesAccount.name || "รายได้จากการขายสินค้า",
              debit: "0",
              credit: String(salesRevenue.toFixed(2)),
            });

            // CR ภาษีขาย (ถ้าจด VAT)
            if (isVatRegistered && totalVat > 0 && vatAccount) {
              await tx.insert(journalLines).values({
                journalEntryId: je.id,
                accountId: vatAccount.id,
                description: vatAccount.nameTh || vatAccount.name || "ภาษีขาย",
                debit: "0",
                credit: String(totalVat.toFixed(2)),
              });
            }
            // *** ค่าธรรมเนียม/ค่าขนส่ง จะบันทึกตอน Settlement ***
          }

          await tx.update(ecommerceOrders).set({
            taxInvoiceId: tiv.id,
            journalEntryId: journalEntry?.id || null,
          }).where(eq(ecommerceOrders.id, eOrder.id));

          return { eOrder, tiv, journalEntry };
        });

        createdDocs.push({
          orderNo,
          ecommerceOrderId: result.eOrder.id,
          taxInvoiceNo: result.tiv.taxInvoiceNo,
          taxInvoiceId: result.tiv.id,
          journalEntryId: result.journalEntry?.id || null,
          journalEntryNo: result.journalEntry?.entryNo || null,
        });
        console.log(`[batch-import] [${orderNo}] transaction OK: ${Date.now()-t1}ms`);
      } catch (err: any) {
        console.log(`[batch-import] [${orderNo}] ERROR after ${Date.now()-t1}ms: ${err.message}`);
        errors.push({ orderNo, error: err.message });
      }
    }

    let autoGRCount = 0;
    if (company.ecomAutoReceiveStock && createdDocs.length > 0) {
      try {
        const grNo = `GR-ECOM-${batch.id}`;
        const [existingGR] = await db.select({ id: goodsReceivings.id }).from(goodsReceivings)
          .where(and(eq(goodsReceivings.companyId, Number(companyId)), eq(goodsReceivings.grNo, grNo)));
        if (existingGR) {
          autoGRCount = -1;
        } else {
          const productQtyMap = new Map<number, { qty: number; unitCost: number; productName: string }>();
          for (const doc of createdDocs) {
            if (!doc.orderId) continue;
            const items = await ecomDb.select().from(ecommerceOrderItems)
              .where(eq(ecommerceOrderItems.orderId, doc.orderId));
            for (const item of items) {
              if (!item.productId) continue;
              const qty = parseFloat(String(item.quantity || "1")) || 0;
              const price = parseFloat(String(item.unitPrice || "0")) || 0;
              if (qty <= 0) continue;
              const existing = productQtyMap.get(item.productId);
              if (existing) {
                const totalOldCost = existing.qty * existing.unitCost;
                const totalNewCost = qty * price;
                existing.qty += qty;
                existing.unitCost = existing.qty > 0 ? (totalOldCost + totalNewCost) / existing.qty : 0;
              } else {
                productQtyMap.set(item.productId, { qty, unitCost: price, productName: item.productName || "" });
              }
            }
          }

          if (productQtyMap.size > 0) {
            await db.transaction(async (tx) => {
              const today = new Date().toISOString().split("T")[0];
              const [gr] = await tx.insert(goodsReceivings).values({
                companyId: Number(companyId),
                grNo,
                grDate: today,
                status: "approved",
                notes: `รับสินค้าอัตโนมัติจาก E-Commerce Import Batch #${batch.id}`,
                createdBy: user.id,
              }).returning();

              let sortOrder = 1;
              for (const [productId, { qty, unitCost, productName }] of productQtyMap) {
                await tx.insert(goodsReceivingItems).values({
                  goodsReceivingId: gr.id,
                  productId,
                  productName,
                  qty: String(qty),
                  unitCost: String(unitCost),
                  receivedQty: String(qty),
                  sortOrder: sortOrder++,
                });

                await tx.insert(stockMovements).values({
                  companyId: Number(companyId),
                  productId,
                  movementType: "goods_in",
                  quantity: String(qty),
                  unitCost: String(unitCost),
                  totalCost: String(qty * unitCost),
                  referenceType: "goods_receiving",
                  referenceId: gr.id,
                  referenceNo: grNo,
                  createdBy: user.id,
                });

                const [existingStock] = await tx.select().from(productStock)
                  .where(and(eq(productStock.companyId, Number(companyId)), eq(productStock.productId, productId)));
                if (existingStock) {
                  await tx.update(productStock)
                    .set({ quantity: sql`CAST(${productStock.quantity} AS numeric) + ${qty}` })
                    .where(eq(productStock.id, existingStock.id));
                } else {
                  await tx.insert(productStock).values({
                    companyId: Number(companyId),
                    productId,
                    quantity: String(qty),
                  });
                }
                autoGRCount++;
              }
            });

            await recalcBundleStock(Number(companyId));
            await recalcBomStock(Number(companyId));
          }
        }
      } catch (grErr: any) {
        console.error("Auto GR from ecommerce error:", grErr.message);
      }
    }

    const isAppend = !!appendToBatchId && batch.id === Number(appendToBatchId);
    await db.update(ecommerceImportBatches).set({
      totalOrders: isAppend ? sql`${ecommerceImportBatches.totalOrders} + ${createdDocs.length}` : createdDocs.length,
      totalSkipped: isAppend ? sql`${ecommerceImportBatches.totalSkipped} + ${skipped.length}` : skipped.length,
      totalErrors: isAppend ? sql`${ecommerceImportBatches.totalErrors} + ${errors.length}` : errors.length,
      totalTaxInvoices: isAppend ? sql`${ecommerceImportBatches.totalTaxInvoices} + ${createdDocs.length}` : createdDocs.length,
      totalJournalEntries: isAppend ? sql`${ecommerceImportBatches.totalJournalEntries} + ${createdDocs.filter(d => d.journalEntryId).length}` : createdDocs.filter(d => d.journalEntryId).length,
      summaryData: JSON.stringify({ createdDocs: createdDocs.length, errors: errors.length, skipped: skipped.length, autoGRCount, isChunk: isAppend }),
    }).where(eq(ecommerceImportBatches.id, batch.id));

    console.log(`[batch-import] Complete: ${createdDocs.length} created, ${skipped.length} skipped, ${errors.length} errors, ${productsCreated} products created`);

    res.json({
      batchId: batch.id,
      totalCreated: createdDocs.length,
      totalErrors: errors.length,
      totalSkipped: skipped.length,
      productsCreated,
      createdDocs,
      errors,
      skipped,
      autoGRCount,
    });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ============ Preview Return Orders for Credit Note Creation ============
app.post("/api/ecommerce/import/preview-returns", requireAuth, requireAnyModule("sales", "ecommerce"), async (req, res) => {
  try {
    const { companyId, orderNumbers } = req.body;
    if (!companyId || !orderNumbers || !Array.isArray(orderNumbers) || orderNumbers.length === 0) {
      return res.status(400).json({ message: "กรุณาระบุเลขคำสั่งซื้อ" });
    }

    const user = req.user as any;
    const [company] = await db.select().from(companies).where(eq(companies.id, Number(companyId)));
    if (company && company.tenantId && company.tenantId !== user.tenantId) return res.status(403).json({ message: "ไม่มีสิทธิ์" });

    const results: any[] = [];
    const skipped: any[] = [];

    for (const orderNo of orderNumbers) {
      const trimmed = String(orderNo).trim();
      if (!trimmed) continue;

      const [order] = await ecomDb.select().from(ecommerceOrders)
        .where(and(eq(ecommerceOrders.companyId, Number(companyId)), eq(ecommerceOrders.platformOrderId, trimmed)));

      if (!order) {
        skipped.push({ orderNo: trimmed, reason: "ไม่พบออเดอร์นี้ในระบบ" });
        continue;
      }

      if (!order.taxInvoiceId) {
        skipped.push({ orderNo: trimmed, reason: "ยังไม่มีใบกำกับภาษี" });
        continue;
      }

      if (order.creditNoteId) {
        skipped.push({ orderNo: trimmed, reason: "มีใบลดหนี้แล้ว" });
        continue;
      }

      const [tiv] = await db.select().from(taxInvoices).where(eq(taxInvoices.id, order.taxInvoiceId));
      results.push({
        orderNo: trimmed,
        platform: order.platform,
        buyerName: order.buyerName,
        taxInvoiceNo: tiv?.taxInvoiceNo || "-",
        taxInvoiceDate: tiv?.taxInvoiceDate || "-",
        totalAmount: parseFloat(tiv?.totalAmount || order.totalAmount || "0"),
        vatAmount: parseFloat(tiv?.vatAmount || "0"),
      });
    }

    res.json({ orders: results, skipped, totalEligible: results.length, totalSkipped: skipped.length });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ============ Create Credit Notes from Return/Cancel Orders ============
app.post("/api/ecommerce/import/create-return-batch", requireAuth, requireAnyModule("sales", "ecommerce"), async (req, res) => {
  try {
    const user = req.user as any;
    const { companyId, platform, fileName, orders } = req.body;
    if (!companyId || !orders || !Array.isArray(orders) || orders.length === 0) {
      return res.status(400).json({ message: "กรุณาระบุข้อมูลให้ครบถ้วน" });
    }

    const [company] = await db.select().from(companies).where(eq(companies.id, Number(companyId)));
    if (!company) return res.status(404).json({ message: "ไม่พบกิจการ" });
    if (user.role !== "super_admin" && company.tenantId && company.tenantId !== user.tenantId) {
      return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึงกิจการนี้" });
    }

    if (orders.length > 5000) {
      return res.status(400).json({ message: "สร้างได้สูงสุด 5,000 เอกสารต่อครั้ง" });
    }

    const [batch] = await db.insert(ecommerceImportBatches).values({
      companyId: Number(companyId),
      platform: platform || "shopee",
      fileName: fileName || null,
      importType: "returns",
      totalOrders: 0,
      totalSkipped: 0,
      totalErrors: 0,
      totalTaxInvoices: 0,
      totalJournalEntries: 0,
      status: "active",
      createdBy: user.id,
    }).returning();

    const allAccounts = await db.select().from(accounts).where(eq(accounts.companyId, Number(companyId)));
    const accountMap = new Map(allAccounts.map(a => [a.code, a]));
    const findAccount = (primaryCode: string, ...fallbackCodes: string[]) => {
      let acc = accountMap.get(primaryCode);
      if (acc) return acc;
      for (const code of fallbackCodes) {
        acc = accountMap.get(code);
        if (acc) return acc;
      }
      return null;
    };

    const createdDocs: any[] = [];
    const errors: any[] = [];
    const skipped: any[] = [];

    for (const order of orders) {
      const orderNo = String(order.orderNo || "").trim();
      if (!orderNo) { errors.push({ orderNo: "N/A", error: "ไม่มีเลขคำสั่งซื้อ" }); continue; }

      try {
        const [existingOrder] = await ecomDb.select().from(ecommerceOrders)
          .where(and(eq(ecommerceOrders.companyId, Number(companyId)), eq(ecommerceOrders.platformOrderId, orderNo)));

        if (!existingOrder) {
          skipped.push({ orderNo, reason: "ไม่พบออเดอร์นี้ในระบบ" });
          continue;
        }

        if (!existingOrder.taxInvoiceId) {
          skipped.push({ orderNo, reason: "ออเดอร์นี้ยังไม่มีใบกำกับภาษี" });
          continue;
        }

        if (existingOrder.creditNoteId) {
          skipped.push({ orderNo, reason: "ออเดอร์นี้มีใบลดหนี้แล้ว" });
          continue;
        }

        const [originalTiv] = await db.select().from(taxInvoices)
          .where(eq(taxInvoices.id, existingOrder.taxInvoiceId));
        if (!originalTiv) {
          skipped.push({ orderNo, reason: "ไม่พบใบกำกับภาษีเดิม" });
          continue;
        }

        const originalItems = await db.select().from(taxInvoiceItems)
          .where(eq(taxInvoiceItems.taxInvoiceId, originalTiv.id));

        const returnDate = order.returnDate || new Date().toISOString().split("T")[0];
        const returnReason = order.returnReason || "ลูกค้าขอคืนสินค้า/ยกเลิกคำสั่งซื้อ";

        const subtotal = parseFloat(originalTiv.subtotal || "0");
        const totalAmount = parseFloat(originalTiv.totalAmount || "0");
        const vatAmount = parseFloat(originalTiv.vatAmount || "0");

        const result = await db.transaction(async (tx) => {
          const prefix = "CN";
          const creditNoteNo = await getNextDocNo(Number(companyId), prefix, salesCreditNotes, salesCreditNotes.creditNoteNo, salesCreditNotes.companyId, returnDate);

          const [cn] = await tx.insert(salesCreditNotes).values({
            companyId: Number(companyId),
            creditNoteNo,
            creditNoteDate: returnDate,
            customerName: originalTiv.customerName || "ลูกค้า",
            customerAddress: originalTiv.customerAddress || null,
            customerTaxId: originalTiv.customerTaxId || null,
            branch: originalTiv.branch || null,
            refTaxInvoiceId: originalTiv.id,
            refTaxInvoiceNo: originalTiv.taxInvoiceNo,
            refTaxInvoiceDate: originalTiv.taxInvoiceDate,
            reason: returnReason,
            reasonDetail: `คืนสินค้า/ยกเลิก - ${platform || "Shopee"} #${orderNo}`,
            subtotal: String(subtotal.toFixed(2)),
            vatAmount: String(vatAmount.toFixed(2)),
            totalAmount: String(totalAmount.toFixed(2)),
            status: "approved",
            priceMode: "included",
            docPrefix: prefix,
            notes: `ใบลดหนี้จากการคืนสินค้า - ${orderNo}`,
            createdBy: user.id,
          }).returning();

          for (const item of originalItems) {
            await tx.insert(salesCreditNoteItems).values({
              creditNoteId: cn.id,
              productCode: item.productCode || null,
              productName: item.productName || "สินค้า",
              qty: item.qty || "1",
              unit: item.unit || "ชิ้น",
              unitPrice: item.unitPrice || "0",
              discount: item.discount || "0",
              total: item.total || "0",
              vatType: item.vatType || "vat7",
            });
          }

          const salesAccount = findAccount("4001000");
          const vatAccount = findAccount("2341000");
          const arAccount = findAccount("1201000");
          let journalEntry: any = null;

          if (salesAccount && vatAccount && arAccount) {
            const salesBeforeVat = subtotal - vatAmount;
            const totalVat = vatAmount;

            const entryNo = await getNextJournalEntryNo(Number(companyId), "sales", returnDate);
            const [je] = await tx.insert(journalEntries).values({
              companyId: Number(companyId),
              entryNo,
              entryDate: returnDate,
              reference: creditNoteNo,
              description: `ใบลดหนี้ ${creditNoteNo} - คืนสินค้า ${orderNo}`,
              journalBook: "sales",
              contactName: originalTiv.customerName || null,
              createdBy: user.id,
              status: "posted",
              sourceDocType: "sales_credit_note",
              sourceDocId: cn.id,
              currencyCode: "THB",
              exchangeRate: "1",
            }).returning();
            journalEntry = je;

            await tx.insert(journalLines).values({
              journalEntryId: je.id,
              accountId: salesAccount.id,
              description: "กลับรายการรายได้จากการขาย",
              debit: String(salesBeforeVat.toFixed(2)),
              credit: "0",
            });

            await tx.insert(journalLines).values({
              journalEntryId: je.id,
              accountId: vatAccount.id,
              description: "กลับรายการภาษีขาย",
              debit: String(totalVat.toFixed(2)),
              credit: "0",
            });

            await tx.insert(journalLines).values({
              journalEntryId: je.id,
              accountId: arAccount.id,
              description: "ลดยอดลูกหนี้การค้า",
              debit: "0",
              credit: String(subtotal.toFixed(2)),
            });
          }

          await tx.update(ecommerceOrders).set({
            status: "returned",
            creditNoteId: cn.id,
            returnReason,
          }).where(eq(ecommerceOrders.id, existingOrder.id));

          return { cn, journalEntry };
        });

        createdDocs.push({
          orderNo,
          creditNoteNo: result.cn.creditNoteNo,
          creditNoteId: result.cn.id,
          journalEntryId: result.journalEntry?.id || null,
          journalEntryNo: result.journalEntry?.entryNo || null,
          refTaxInvoiceNo: originalTiv.taxInvoiceNo,
        });
      } catch (err: any) {
        errors.push({ orderNo, error: err.message });
      }
    }

    await db.update(ecommerceImportBatches).set({
      totalOrders: createdDocs.length,
      totalSkipped: skipped.length,
      totalErrors: errors.length,
      totalTaxInvoices: createdDocs.length,
      totalJournalEntries: createdDocs.filter(d => d.journalEntryId).length,
      summaryData: JSON.stringify({ createdDocs: createdDocs.length, errors: errors.length, skipped: skipped.length }),
    }).where(eq(ecommerceImportBatches.id, batch.id));

    res.json({
      batchId: batch.id,
      totalCreated: createdDocs.length,
      totalErrors: errors.length,
      totalSkipped: skipped.length,
      createdDocs,
      errors,
      skipped,
    });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ============ Delete Import Batch ============
app.delete("/api/ecommerce/import/batch/:id", requireAuth, requireAnyModule("sales", "ecommerce"), async (req, res) => {
  try {
    const user = req.user as any;
    const batchId = Number(req.params.id);
    if (!batchId) return res.status(400).json({ message: "กรุณาระบุ batch ID" });

    const [batch] = await db.select().from(ecommerceImportBatches).where(eq(ecommerceImportBatches.id, batchId));
    if (!batch) return res.status(404).json({ message: "ไม่พบ batch" });

    if (user.role !== "super_admin" && batch.companyId) {
      const [company] = await db.select().from(companies).where(eq(companies.id, batch.companyId));
      if (company && company.tenantId && company.tenantId !== user.tenantId) {
        return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง batch นี้" });
      }
    }

    const batchOrders = await ecomDb.select().from(ecommerceOrders)
      .where(and(eq(ecommerceOrders.importBatchId, batchId), eq(ecommerceOrders.companyId, batch.companyId)));

    const journalEntryIds = batchOrders.map(o => o.journalEntryId).filter(Boolean) as number[];
    const taxInvoiceIds = batchOrders.map(o => o.taxInvoiceId).filter(Boolean) as number[];
    const invoiceIds: number[] = [];
    const orderIds = batchOrders.map(o => o.id);
    const orderNos = batchOrders.map(o => o.orderNo).filter(Boolean);

    // Find documents by refDoc pattern (created via create-documents batch endpoint)
    // refDoc format: "PLATFORM #orderNo" e.g. "SHOPEE #2502101ABC"
    if (orderNos.length > 0 && batch.companyId) {
      for (const no of orderNos) {
        const pattern = `% #${no}%`;
        const matchedTivs = await db.select({ id: taxInvoices.id }).from(taxInvoices)
          .where(and(eq(taxInvoices.companyId, batch.companyId), sql`${taxInvoices.refDoc} LIKE ${pattern}`));
        for (const t of matchedTivs) {
          if (!taxInvoiceIds.includes(t.id)) taxInvoiceIds.push(t.id);
        }
        const matchedInvs = await db.select({ id: invoices.id }).from(invoices)
          .where(and(eq(invoices.companyId, batch.companyId), sql`${invoices.refDoc} LIKE ${pattern}`));
        for (const inv of matchedInvs) {
          if (!invoiceIds.includes(inv.id)) invoiceIds.push(inv.id);
        }
      }

      // Find journal entries linked to those documents
      if (taxInvoiceIds.length > 0 || invoiceIds.length > 0) {
        const tivJournals = taxInvoiceIds.length > 0 ? await db.select({ id: journalEntries.id }).from(journalEntries)
          .where(and(eq(journalEntries.companyId, batch.companyId), eq(journalEntries.sourceDocType, "tax_invoice"), inArray(journalEntries.sourceDocId, taxInvoiceIds))) : [];
        const invJournals = invoiceIds.length > 0 ? await db.select({ id: journalEntries.id }).from(journalEntries)
          .where(and(eq(journalEntries.companyId, batch.companyId), eq(journalEntries.sourceDocType, "invoice"), inArray(journalEntries.sourceDocId, invoiceIds))) : [];
        for (const j of [...tivJournals, ...invJournals]) {
          if (!journalEntryIds.includes(j.id)) journalEntryIds.push(j.id);
        }
      }
    }

    await db.transaction(async (tx) => {
      if (orderIds.length > 0) {
        await tx.update(ecommerceOrders)
          .set({ journalEntryId: null, taxInvoiceId: null })
          .where(inArray(ecommerceOrders.id, orderIds));
      }

      if (journalEntryIds.length > 0) {
        await tx.delete(journalLines).where(inArray(journalLines.journalEntryId, journalEntryIds));
        await tx.delete(journalEntries).where(inArray(journalEntries.id, journalEntryIds));
      }

      if (taxInvoiceIds.length > 0) {
        for (const tivId of taxInvoiceIds) {
          await deleteStockMovementsForDoc(tx, "tax_invoice", tivId);
        }
        await tx.delete(taxInvoiceItems).where(inArray(taxInvoiceItems.taxInvoiceId, taxInvoiceIds));
        await tx.delete(taxInvoices).where(inArray(taxInvoices.id, taxInvoiceIds));
      }

      if (invoiceIds.length > 0) {
        for (const invId of invoiceIds) {
          await deleteStockMovementsForDoc(tx, "invoice", invId);
        }
        await tx.delete(invoiceItems).where(inArray(invoiceItems.invoiceId, invoiceIds));
        await tx.delete(invoices).where(inArray(invoices.id, invoiceIds));
      }

      if (orderIds.length > 0) {
        await tx.delete(ecommerceOrderItems).where(inArray(ecommerceOrderItems.orderId, orderIds));
        await tx.delete(ecommerceOrders).where(inArray(ecommerceOrders.id, orderIds));
      }

      await tx.update(ecommerceImportBatches).set({ status: "deleted" }).where(eq(ecommerceImportBatches.id, batchId));
    });

    res.json({
      success: true,
      deletedOrders: orderIds.length,
      deletedTaxInvoices: taxInvoiceIds.length,
      deletedInvoices: invoiceIds.length,
      deletedJournalEntries: journalEntryIds.length,
    });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ============ Get Import Batches ============
app.get("/api/ecommerce/import/batches", requireAuth, requireAnyModule("sales", "ecommerce"), async (req, res) => {
  try {
    const user = req.user as any;
    const companyId = Number(req.query.companyId);
    if (!companyId) return res.status(400).json({ message: "กรุณาระบุ companyId" });

    const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
    if (!company) return res.status(404).json({ message: "ไม่พบกิจการ" });
    if (user.role !== "super_admin" && company.tenantId && company.tenantId !== user.tenantId) {
      return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึงกิจการนี้" });
    }

    const batches = await db.select().from(ecommerceImportBatches)
      .where(eq(ecommerceImportBatches.companyId, companyId))
      .orderBy(desc(ecommerceImportBatches.createdAt));

    res.json(batches);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ========== VAT Product Dictionary ==========
app.get("/api/vat-dictionary", requireAuth, async (req, res) => {
  try {
    const companyId = Number(req.query.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId required" });
    const entries = await ecomDb.select().from(vatProductDictionary)
      .where(eq(vatProductDictionary.companyId, companyId))
      .orderBy(vatProductDictionary.productName);
    res.json(entries);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post("/api/vat-dictionary", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const { companyId, productName, vatType } = req.body;
    if (!companyId || !productName || !vatType) return res.status(400).json({ message: "ข้อมูลไม่ครบ" });
    const normalizedName = String(productName).trim().toLowerCase().replace(/\s+/g, " ");
    const [existing] = await ecomDb.select().from(vatProductDictionary)
      .where(and(eq(vatProductDictionary.companyId, Number(companyId)), eq(vatProductDictionary.normalizedName, normalizedName)));
    if (existing) {
      const [updated] = await ecomDb.update(vatProductDictionary).set({
        vatType, confirmedBy: user.id, confirmedAt: new Date(), source: "manual",
      }).where(eq(vatProductDictionary.id, existing.id)).returning();
      return res.json(updated);
    }
    const [entry] = await ecomDb.insert(vatProductDictionary).values({
      companyId: Number(companyId), productName: String(productName).trim(),
      normalizedName, vatType, source: "manual",
      confirmedBy: user.id, confirmedAt: new Date(),
    }).returning();
    res.json(entry);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post("/api/vat-dictionary/bulk", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const { companyId, items } = req.body;
    if (!companyId || !items || !Array.isArray(items)) return res.status(400).json({ message: "ข้อมูลไม่ครบ" });
    const results = [];
    for (const item of items) {
      const normalizedName = String(item.productName).trim().toLowerCase().replace(/\s+/g, " ");
      const [existing] = await ecomDb.select().from(vatProductDictionary)
        .where(and(eq(vatProductDictionary.companyId, Number(companyId)), eq(vatProductDictionary.normalizedName, normalizedName)));
      if (existing) {
        const [updated] = await ecomDb.update(vatProductDictionary).set({
          vatType: item.vatType, confirmedBy: user.id, confirmedAt: new Date(), source: item.source || "confirmed",
        }).where(eq(vatProductDictionary.id, existing.id)).returning();
        results.push(updated);
      } else {
        const [entry] = await ecomDb.insert(vatProductDictionary).values({
          companyId: Number(companyId), productName: String(item.productName).trim(),
          normalizedName, vatType: item.vatType, source: item.source || "confirmed",
          confirmedBy: user.id, confirmedAt: new Date(),
        }).returning();
        results.push(entry);
      }
    }
    res.json({ saved: results.length, items: results });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.delete("/api/vat-dictionary/:id", requireAuth, async (req, res) => {
  try {
    await ecomDb.delete(vatProductDictionary).where(eq(vatProductDictionary.id, Number(req.params.id)));
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post("/api/vat-dictionary/lookup", requireAuth, async (req, res) => {
  try {
    const { companyId, productNames } = req.body;
    if (!companyId || !productNames || !Array.isArray(productNames)) return res.status(400).json({ message: "ข้อมูลไม่ครบ" });
    const dict = await ecomDb.select().from(vatProductDictionary)
      .where(eq(vatProductDictionary.companyId, Number(companyId)));
    const dictMap = new Map(dict.map(d => [d.normalizedName, d]));
    const results: { productName: string; vatType: string | null; source: string; confidence: string }[] = [];
    const unknowns: string[] = [];
    for (const name of productNames) {
      const normalized = String(name).trim().toLowerCase().replace(/\s+/g, " ");
      const found = dictMap.get(normalized);
      if (found) {
        results.push({ productName: name, vatType: found.vatType, source: "dictionary", confidence: "confirmed" });
      } else {
        results.push({ productName: name, vatType: null, source: "unknown", confidence: "unknown" });
        unknowns.push(name);
      }
    }
    res.json({ results, unknowns, totalKnown: results.filter(r => r.vatType !== null).length, totalUnknown: unknowns.length });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.get("/api/line-groups", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const tenantId = user.tenantId;
    const groups = tenantId
      ? await db.select().from(lineGroupMappings).where(eq(lineGroupMappings.tenantId, tenantId))
      : await db.select().from(lineGroupMappings);
    res.json(groups);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.get("/api/tax-reminder/settings", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const tenantId = user.tenantId;
    const rows = tenantId
      ? await db.select().from(taxReminderSettings).where(eq(taxReminderSettings.tenantId, tenantId))
      : await db.select().from(taxReminderSettings);
    res.json(rows[0] || null);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.put("/api/tax-reminder/settings", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const tenantId = user.tenantId;
    if (!tenantId) return res.status(400).json({ message: "ต้องมี tenant" });

    const { enabled, daysBefore, sendSticker, reminderTime, customStickerPackageId, customStickerId } = req.body;
    const existing = await db.select().from(taxReminderSettings).where(eq(taxReminderSettings.tenantId, tenantId));

    if (existing.length > 0) {
      const updateData: any = { updatedAt: new Date() };
      if (enabled !== undefined) updateData.enabled = enabled;
      if (daysBefore !== undefined) updateData.daysBefore = Number(daysBefore);
      if (sendSticker !== undefined) updateData.sendSticker = sendSticker;
      if (reminderTime !== undefined) updateData.reminderTime = reminderTime;
      if (customStickerPackageId !== undefined) updateData.customStickerPackageId = customStickerPackageId || null;
      if (customStickerId !== undefined) updateData.customStickerId = customStickerId || null;
      const [updated] = await db.update(taxReminderSettings).set(updateData).where(eq(taxReminderSettings.id, existing[0].id)).returning();
      res.json(updated);
    } else {
      const [created] = await db.insert(taxReminderSettings).values({
        tenantId,
        enabled: enabled ?? true,
        daysBefore: Number(daysBefore) || 3,
        sendSticker: sendSticker ?? true,
        reminderTime: reminderTime || "09:00",
        customStickerPackageId: customStickerPackageId || null,
        customStickerId: customStickerId || null,
      }).returning();
      res.json(created);
    }
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.get("/api/tax-reminder/logs", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const tenantId = user.tenantId;
    const logs = tenantId
      ? await db.select().from(taxReminderLogs).where(eq(taxReminderLogs.tenantId, tenantId)).orderBy(sql`sent_at DESC`).limit(50)
      : await db.select().from(taxReminderLogs).orderBy(sql`sent_at DESC`).limit(50);
    res.json(logs);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post("/api/tax-reminder/test-send", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const tenantId = user.tenantId;
    if (!tenantId) return res.status(403).json({ message: "ไม่มีสิทธิ์" });
    if (!["admin", "manager"].includes(user.role)) return res.status(403).json({ message: "เฉพาะ admin/manager เท่านั้น" });

    const lineToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!lineToken) return res.status(400).json({ message: "ยังไม่ได้ตั้งค่า LINE Channel Access Token" });

    const { groupId } = req.body;
    if (!groupId) return res.status(400).json({ message: "กรุณาระบุ Group ID" });

    const [group] = await db.select().from(lineGroupMappings).where(
      and(eq(lineGroupMappings.lineGroupId, groupId), eq(lineGroupMappings.tenantId, tenantId))
    );
    if (!group) return res.status(403).json({ message: "กลุ่มนี้ไม่ได้อยู่ในสำนักงานของคุณ" });

    const today = new Date();
    const nextDeadlines = getStandardTaxDeadlines(today.getFullYear(), today.getMonth() + 1);
    const upcoming = nextDeadlines.filter(d => new Date(d.date) >= today);
    if (upcoming.length === 0) {
      return res.status(400).json({ message: "ไม่มีกำหนดภาษีที่จะถึงในเดือนนี้" });
    }

    const [tenantSettings] = await db.select().from(taxReminderSettings).where(eq(taxReminderSettings.tenantId, tenantId));

    const daysUntil = Math.ceil((new Date(upcoming[0].date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const sameDate = upcoming.filter(d => d.date === upcoming[0].date);
    await sendTaxReminder(lineToken, groupId, sameDate, daysUntil, true, tenantSettings?.customStickerPackageId, tenantSettings?.customStickerId);

    res.json({ message: "ส่งข้อความทดสอบสำเร็จ", deadline: upcoming[0] });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post("/api/tax-reminder/run-now", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const tenantId = user.tenantId;
    if (!tenantId) return res.status(403).json({ message: "ไม่มีสิทธิ์" });
    if (!["admin", "manager"].includes(user.role)) return res.status(403).json({ message: "เฉพาะ admin/manager เท่านั้น" });

    const result = await checkAndSendTaxReminders(tenantId);
    res.json(result);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post("/api/ai/user-guide", requireAuth, async (req, res) => {
  try {
    if (!openai) return res.status(400).json({ message: "AI ไม่พร้อมใช้งาน กรุณาตั้งค่า OpenAI API Key" });
    const { question, history } = req.body;
    if (!question || typeof question !== "string" || question.trim().length === 0) {
      return res.status(400).json({ message: "กรุณาพิมพ์คำถาม" });
    }

    const systemPrompt = `คุณคือ "E-Tax Assistant" ผู้ช่วย AI ของระบบ E-Tax Center ระบบบัญชีดิจิทัลครบวงจรสำหรับสำนักงานบัญชีไทย
ตอบเป็นภาษาไทยเสมอ ใช้ภาษาเข้าใจง่าย กระชับ ตรงประเด็น
ถ้าผู้ใช้ถามเรื่องที่ไม่เกี่ยวกับโปรแกรม ให้ตอบสั้นๆ ว่าช่วยได้เฉพาะเรื่องการใช้งานระบบ E-Tax Center

## ข้อมูลฟีเจอร์และวิธีใช้งานระบบ E-Tax Center:

### 1. เริ่มต้นใช้งาน
- สมัครสมาชิก → ล็อกอิน → ตั้งค่าข้อมูลบริษัท (ชื่อ, เลขผู้เสียภาษี, ที่อยู่, สถานะ VAT)
- เพิ่มผู้ใช้งานและกำหนดสิทธิ์ (admin/manager/accountant/employee)
- ผังบัญชีเริ่มต้นตาม TFRS มีให้อัตโนมัติ ปรับแก้ได้
- ตั้งค่าช่องทางชำระเงิน, ธีมสี (ส้ม/น้ำเงิน), ภาษา (ไทย/EN/简体/繁體)
- ทดลองใช้ฟรี 15 วัน แพ็คเกจ: Free/Starter ฿590/Professional ฿1,490/Enterprise ฿4,990 ต่อเดือน

### 2. ตั้งค่าระบบ
- ข้อมูลบริษัท: เมนู ตั้งค่า → ข้อมูลบริษัท → แก้ไขชื่อ/ที่อยู่/โลโก้/เลขผู้เสียภาษี
- ผู้ใช้งาน & สิทธิ์: ตั้งค่า → ผู้ใช้งาน → เพิ่ม/แก้ไข/กำหนดสิทธิ์ แบ่งเป็น superadmin/admin/manager/accountant/employee
- ธีม & ภาษา: กดไอคอน Palette/Moon/Globe ที่ Header
- ตั้งค่าอนุมัติ: กำหนดผู้อนุมัติ+ลำดับ เปิด/ปิดต่อประเภทเอกสาร

### 3. ประวัติคู่ค้า (Contacts)
- เมนู ประวัติคู่ค้า → เพิ่มลูกค้า/ผู้ขาย กรอก ชื่อ/เลขผู้เสียภาษี/ที่อยู่/โทรศัพท์
- ประเภท: ลูกค้า (Customer) หรือ ผู้ขาย (Vendor) หรือทั้งสองอย่าง
- นำเข้า Excel ได้ ดาวน์โหลดไฟล์ตัวอย่างแล้วกรอกตาม format
- ลบทีละรายการหรือ bulk delete ได้ (ลบ firm_clients ที่เชื่อมด้วย)

### 4. เอกสารขาย / ลูกหนี้ (Sales & AR)
- **ใบเสนอราคา (QO)**: สร้าง → เลือกลูกค้า → เพิ่มรายการสินค้า → VAT 7% อัตโนมัติ → อนุมัติ → แปลงเป็น SO/IV
- **ใบสั่งขาย (SO)**: สร้างหรือแปลงจาก QO → ระบุรายละเอียด → แปลงเป็น IV/TIV
- **ใบแจ้งหนี้ (IV)**: ออกใบแจ้งหนี้เรียกเก็บเงิน → ลงบัญชีลูกหนี้อัตโนมัติ → แปลงเป็น TIV
- **ใบกำกับภาษี (TIV)**: ออกตามกฎหมาย → ลงรายงานภาษีขายอัตโนมัติ → เลือกรูปแบบพิมพ์ 4 แบบ
- **ใบเสร็จรับเงิน (RE) & ใบรับเงินมัดจำ (DP)**: บันทึกรับเงิน/มัดจำ → ระบุวิธีชำระ → ลงบัญชีอัตโนมัติ
- **ใบลดหนี้ (CN)**: ออกเมื่อลดราคา/คืนสินค้า → อ้างอิงเอกสารเดิม → ปรับยอดภาษีขาย
- **รายงานภาษีขาย**: ดูรายเดือนตามรูปแบบสรรพากร กรองตามช่วงเวลา ส่งออก Excel/พิมพ์
- Flow เอกสารขาย: QO → SO → IV → TIV → RE (แปลงได้ทุกขั้น)
- รองรับ 12 สกุลเงิน, ส่วนลดรายบรรทัด/ท้ายบิล, แนบไฟล์ได้

### 5. เอกสารซื้อ / เจ้าหนี้ (Purchases & AP)
- **ใบขอซื้อ (PR)**: สร้าง → ระบุรายการ+เหตุผล → ส่งอนุมัติ → แปลงเป็น PO
- **เปรียบเทียบราคา (BID)**: เชิญผู้ขายเสนอราคา → เปรียบเทียบ → เลือกรายที่ดีที่สุด
- **ใบสั่งซื้อ (PO)**: ออกให้ผู้ขาย → ส่ง Email/Supplier Portal → ติดตามสถานะ
- **บันทึกซื้อ (AP)**: บันทึกใบแจ้งหนี้จากผู้ขาย → VAT+WHT อัตโนมัติ → ลงบัญชีเจ้าหนี้
- **ค่าใช้จ่ายอื่น (EXP)**: บันทึกค่าเช่า/ค่าบริการ → VAT+WHT ต่อบรรทัด → ลงบัญชีอัตโนมัติ
- **ใบเพิ่มหนี้ (DN) & เงินมัดจำจ่าย (PDP)**: ปรับยอดซื้อ / จ่ายมัดจำล่วงหน้า
- **เงินสดย่อย (Petty Cash)**: ตั้งวงเงิน → เบิกจ่าย (ต้องเลือกหมวดค่าใช้จ่าย) → เติมเงินชดเชย → ลง GL อัตโนมัติ
- **รายงานภาษีซื้อ & WHT**: ดูรายเดือน ออก 50 ทวิ/ภงด.3/ภงด.53

### 6. สินค้าคงคลัง (Inventory)
- รายการสินค้า: เพิ่ม/แก้ไข ประเภท (สินค้า/บริการ/Bundle/ผลิต) รองรับ VAT 7%/0%/ยกเว้น
- สูตรการผลิต (BOM) & สินค้าชุด (Bundle)
- คลังสินค้าหลายแห่ง + Bin Location (Zone/Aisle/Shelf/Bin)
- Barcode: สแกนเพิ่มสินค้า สร้าง EAN-13 อัตโนมัติ พิมพ์ฉลาก
- รายงาน: สรุปสต็อก, เคลื่อนไหวสินค้า, สินค้าใกล้หมด, มูลค่าคงคลัง
- Wave/Batch Picking + PDA Mobile Interface

### 7. บัญชี & การเงิน (Accounting)
- **ผังบัญชี**: 3 หลัก (บัญชีคุม) / 7 หลัก (บัญชีย่อย) ตาม TFRS เพิ่ม/แก้ไข/ลบได้
- **สมุดบัญชี 5 เล่ม**: ทั่วไป, รับเงิน, จ่ายเงิน, ขาย, ซื้อ (ระบบจัดให้อัตโนมัติ)
- **บันทึกบัญชี**: สร้างรายการ Dr/Cr → ตรวจสอบ Dr=Cr → อนุมัติ → โพสต์
- **รายงาน**: บัญชีแยกประเภท (GL), งบทดลอง, งบกำไรขาดทุน, งบดุล, งบกระแสเงินสด, เปรียบเทียบรายเดือน
- **ปิดบัญชี VAT รายเดือน**: ล็อคงวดไม่ให้แก้ไขเอกสารย้อนหลัง
- **กระทบยอดธนาคาร**: นำเข้า Statement → จับคู่กับบันทึกบัญชี
- **เครื่องมือจัดการบัญชี 10 อย่าง**: ย้ายยอดเปิด, แก้ไขยอดยกมา, ตรวจสอบความถูกต้อง ฯลฯ

### 8. ทรัพยากรบุคคล (HR)
- พนักงาน: เพิ่ม/แก้ไข ข้อมูลส่วนตัว ตำแหน่ง เงินเดือน
- ลงเวลา: เข้า/ออกงาน ลาป่วย/ลาพักร้อน/ลากิจ
- OT: บันทึกล่วงเวลา อนุมัติอัตโนมัติ (24 ชม.) คำนวณค่า OT
- เงินเดือน: คำนวณอัตโนมัติ (เงินเดือน+OT-หักขาด-ประกันสังคม-ภาษี)
- Payslip: สลิปเงินเดือน PDF พิมพ์/ส่ง
- เอกสารภาษี: ภงด.1, ภงด.1ก, 50 ทวิ
- ESS Portal: พนักงานเข้าดูข้อมูลตัวเอง ขอลา/OT ดาวน์โหลดเอกสาร

### 9. E-Commerce Hub
- เชื่อมต่อ Shopee/Lazada/TikTok Shop ผ่าน OAuth
- ดึงออเดอร์อัตโนมัติ / นำเข้า Excel
- จับคู่ SKU กับสินค้าในระบบ
- ออกใบกำกับภาษีอัตโนมัติ (Auto-TIV on Ship)
- Settlement & Wallet Tracking
- Bulk Operations: อัพเดตสถานะ/พิมพ์ทีละหลายออเดอร์
- Analytics: ยอดขายรวม, ออเดอร์, ค่าเฉลี่ย, กำไรต่อออเดอร์
- Store Clone: โคลนสินค้าข้ามแพลตฟอร์ม/ร้านค้า
- Stock Sync: ซิงค์สต็อกข้ามแพลตฟอร์มแบบ Manual/Auto/Realtime

### 10. POS (จุดขาย)
- เปิด Session ขาย → เพิ่มสินค้า (กริด/สแกน/ค้นหา) → ชำระเงิน → ปิด Session
- หลายวิธีชำระ: เงินสด/โอน/บัตรเครดิต/QR
- ส่วนลดรายบรรทัด/ท้ายบิล, ค้นหาลูกค้า, Hold/Park
- Cash Reconciliation ตอนปิด Session
- Auto Journal Entry เมื่อปิด Session
- **สะสมคะแนน (Loyalty/Membership)**: สร้างโปรแกรมสะสมแต้ม (เช่น ทุก ฿100 ได้ 1 แต้ม) → สร้างรางวัลแลกแต้ม → เพิ่มสมาชิก
- **QR สมัครสมาชิก**: กดปุ่ม "QR สมัครสมาชิก" ในหน้า POS หรือหน้าสะสมคะแนน → แสดง QR Code → ลูกค้าสแกนด้วยมือถือ → เปิดหน้าสมัครทันที (ไม่ต้อง Login)
- ดาวน์โหลด QR เป็นรูปภาพพิมพ์แปะหน้าร้าน หรือคัดลอกลิงก์ส่งทาง LINE/Facebook
- ใช้ใน POS: ตอนชำระเงิน → ค้นหาสมาชิก → สะสมแต้มอัตโนมัติ → เลือกแลกรางวัลหักส่วนลด
- ป้องกัน OT ซ้ำ: ระบบตรวจสอบพนักงาน+วัน+ประเภท ไม่ให้สร้างหรืออนุมัติ OT ซ้ำ

### 11. POS ร้านอาหาร (Restaurant POS)
- จัดการโต๊ะ → รับออเดอร์ → ส่งครัว (Kitchen Display) → เสิร์ฟ → ชำระเงิน
- แบ่งบิล, ค่าบริการ, Modifier (เช่น ไม่ใส่ผัก, พิเศษ)
- หมวดเมนู: อาหาร/เครื่องดื่ม/ของหวาน

### 12. สำนักงานบัญชี (Firm Management)
- จัดการลูกค้าสำนักงาน (Firm Clients)
- Board จัดการงาน (Monday.com-style) + คอลัมน์ปรับแต่งได้
- สัญญาบริการออนไลน์ + ลายเซ็นดิจิทัล
- คลังเอกสาร: จัดเก็บเอกสารสำคัญแยกหมวดหมู่

### 13. ศูนย์จัดส่ง (Delivery Hub)
- Dashboard: ดูจำนวนพัสดุรอจัดส่ง/กำลังส่ง/ส่งแล้ว แยกตามขนส่ง
- Fulfillment: เลือกออเดอร์ → Pick → Pack → พิมพ์ใบปะหน้า → จัดส่ง (Bulk Ship ได้)
- พิมพ์ใบปะหน้า: เลือกขนาดกระดาษ (A4, A6, 10x15 cm) พิมพ์ Shipping Label
- สแกนพัสดุ: สแกน Barcode/QR → อัพเดตสถานะ "จัดส่งแล้ว" อัตโนมัติ
- Packing Station Camera: บันทึกวิดีโอแพ็คสินค้าเป็นหลักฐาน
- ติดตามพัสดุ: ดูสถานะ รอรับ/กำลังส่ง/ส่งสำเร็จ/มีปัญหา
- LINE Notify: แจ้งเตือนเลขพัสดุให้ลูกค้าผ่าน LINE อัตโนมัติ
- ตั้งค่าขนส่ง: Flash/Kerry/J&T/ไปรษณีย์ ฯลฯ กำหนดค่าส่ง

### 14. สถานีบริการน้ำมัน (Gas Station)
- Dashboard: ดูยอดขายวันนี้/สัปดาห์/เดือน แยกตามประเภทน้ำมัน
- ยอดขายรายวัน: กรอกมิเตอร์เริ่มต้น/สิ้นสุดแต่ละหัวจ่าย → คำนวณปริมาณ+ยอดเงิน
- สต็อกน้ำมัน: บันทึกระดับน้ำมันในถัง (Dip Stick / Gauge) รับน้ำมันจากรถขนส่ง
- น้ำมันสูญเสีย/เกิน (Oil Loss/Gain): คำนวณอัตโนมัติจากยอดขาย+รับ+สต็อก
- ภาษีท้องถิ่น: คำนวณจากปริมาณน้ำมันที่ขาย
- รายงาน: สรุปยอดขาย/สต็อก/น้ำมันสูญเสีย

### 15. ศูนย์ Food Delivery
- เชื่อมต่อแอพส่งอาหาร: Grab Food, LINE MAN, Robinhood ฯลฯ
- นำเข้าออเดอร์: Import Excel หรือเชื่อมต่อ API อัตโนมัติ
- จัดการเมนู: เพิ่ม/แก้ไข ตั้งราคาแยกตามแพลตฟอร์ม
- Analytics: ยอดขายรวม สินค้าขายดี ออเดอร์เฉลี่ย แยกตามแพลตฟอร์ม
- บัญชีอัตโนมัติ: ลงบัญชีรายได้+ค่าคอมมิชชั่นอัตโนมัติ

### 16. POS ร้านอาหาร (Restaurant POS)
- จัดการโต๊ะ: ตั้งค่าผังโต๊ะ แบ่งโซน เปิดโต๊ะ → รับออเดอร์
- สั่งอาหาร: เลือกเมนู → Modifier (ไม่ใส่ผัก/พิเศษ/น้อย) → ส่งครัว
- Kitchen Display: แสดงออเดอร์เรียงลำดับ ครัวกดรับ → กดเสร็จ → พนักงานเสิร์ฟ
- แบ่งบิล: แบ่งตามจำนวนคน หรือเลือกรายการ
- ค่าบริการ (Service Charge): ตั้ง % เพิ่มอัตโนมัติ
- ชำระเงิน: เงินสด/โอน/บัตร/QR → พิมพ์ใบเสร็จ

### 17. AI Live Commerce Agency
- จัดการลูกค้า Agency: ข้อมูลบริษัท สินค้า งบโฆษณา
- วางแผนไลฟ์: สร้าง Session → AI จัดลำดับสินค้าตาม AIDA Framework
- จัดสรรงบโฆษณา: AI แนะนำจัดสรรตามช่วงเวลา+สินค้า
- Real-time Monitor: ยอดขาย จำนวนคนดู Engagement แบบเรียลไทม์
- Post-Live Report: สรุปยอดขาย ROI สินค้าขายดี ประสิทธิภาพโฆษณา

### 18. เครื่องมือสำนักงาน (Office Tools)
- ปฏิทิน: ดูนัดหมาย/กำหนดส่ง/วันหยุด มุมมอง วัน/สัปดาห์/เดือน
- ห้องประชุม: จอง → ระบุเวลา → ดูสถานะว่าง/ไม่ว่าง
- Work Board: Kanban สร้าง Board → เพิ่ม Column → เพิ่ม Task → ลาก Drop
- แชทภายในทีม: ส่งข้อความ แชร์ไฟล์

### 19. ฟีเจอร์เสริม
- คลังเอกสาร: จัดเก็บเอกสารสำคัญแยกหมวด อัพโหลด/ค้นหา/แชร์ลิงก์
- White Label: ปรับ Logo/สี/ชื่อระบบ/Favicon ตามแบรนด์ลูกค้า
- LINE Document Archive: บันทึกเอกสารจากกลุ่ม LINE อัตโนมัติ AI จำแนกประเภท
- FTP Archive: สำรองเอกสารไปยัง FTP Server อัตโนมัติ โครงสร้างโฟลเดอร์ C+5/S+3
- Supplier Portal: ผู้ขายเข้าดู PO/ส่งใบเสนอราคาผ่าน Token Link (ไม่ต้องสมัคร)
- AI Analytics & Demand Forecasting: พยากรณ์ยอดขาย Moving Average/Exponential Smoothing สินค้าขายดี Restock Urgency
- Activity Log: ประวัติใคร-ทำอะไร-เมื่อไหร่ กรองตามผู้ใช้/เอกสาร/เวลา ส่งออก Excel
- AI ผู้ช่วยคู่มือ: ถาม AI วิธีใช้งานโปรแกรม ตอบภาษาไทย จำบทสนทนาต่อเนื่อง
- Online Contract: สร้างสัญญาบริการ + เซ็นออนไลน์
- Facebook Chat Orders: AI อ่านข้อความ "CF" สร้างออเดอร์อัตโนมัติ
- Live Selling: จัดไลฟ์ขายสินค้า + Lucky Draw + ออเดอร์อัตโนมัติ
- Unified Chat: แชทรวมจากหลายช่องทาง + Auto-Reply Rules

## หลักการตอบ:
1. ตอบตรงประเด็น กระชับ ใช้ bullet points เมื่อเหมาะสม
2. บอกเมนูที่ต้องเข้าไปชัดเจน (เช่น "ไปที่เมนู การขาย → ใบเสนอราคา")
3. ถ้ามีขั้นตอน ให้บอกเป็นลำดับ 1, 2, 3...
4. ถ้าไม่แน่ใจหรือไม่มีข้อมูล ให้บอกตรงๆ ว่าไม่มีข้อมูลในส่วนนี้ แนะนำให้ติดต่อทีมสนับสนุน`;

    const messages: any[] = [{ role: "system", content: systemPrompt }];
    if (history && Array.isArray(history)) {
      for (const msg of history.slice(-10)) {
        if (msg.role === "user" || msg.role === "assistant") {
          messages.push({ role: msg.role, content: msg.content });
        }
      }
    }
    messages.push({ role: "user", content: question.trim() });

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      max_tokens: 1000,
      temperature: 0.3,
    });

    const answer = response.choices[0]?.message?.content || "ขออภัย ไม่สามารถตอบคำถามได้ในขณะนี้";
    res.json({ answer });
  } catch (err: any) {
    console.error("[AI Guide] Error:", err.message);
    res.status(500).json({ message: "เกิดข้อผิดพลาดในการประมวลผล AI" });
  }
});

app.post("/api/vat-dictionary/ai-analyze", requireAuth, async (req, res) => {
  try {
    if (!openai) return res.status(400).json({ message: "AI ไม่พร้อมใช้งาน" });
    const { companyId, productNames } = req.body;
    if (!companyId || !productNames || !Array.isArray(productNames) || productNames.length === 0) {
      return res.status(400).json({ message: "กรุณาระบุชื่อสินค้า" });
    }
    const dict = await ecomDb.select().from(vatProductDictionary)
      .where(eq(vatProductDictionary.companyId, Number(companyId)));
    const dictMap = new Map(dict.map(d => [d.normalizedName, d]));
    const known: { productName: string; vatType: string; source: string; confidence: string }[] = [];
    const toAnalyze: string[] = [];
    for (const name of productNames) {
      const normalized = String(name).trim().toLowerCase().replace(/\s+/g, " ");
      const found = dictMap.get(normalized);
      if (found) {
        known.push({ productName: name, vatType: found.vatType, source: "dictionary", confidence: "confirmed" });
      } else {
        toAnalyze.push(name);
      }
    }
    if (toAnalyze.length === 0) {
      return res.json({ results: known, aiAnalyzed: 0 });
    }
    const uniqueProducts = [...new Set(toAnalyze)];
    const prompt = `คุณเป็นผู้เชี่ยวชาญภาษีมูลค่าเพิ่ม (VAT) ของประเทศไทย
วิเคราะห์รายการสินค้าต่อไปนี้และกำหนด vatType:
- "vat7" = สินค้าที่ต้องเสียภาษีมูลค่าเพิ่ม 7% (สินค้าทั่วไป เช่น เสื้อผ้า อิเล็กทรอนิกส์ เครื่องสำอาง อาหารแปรรูป ฯลฯ)
- "vat0" = สินค้าที่ยกเว้นภาษีมูลค่าเพิ่ม (ตามประมวลรัษฎากร มาตรา 81 เช่น ผักสด ผลไม้สด เนื้อสัตว์สด ไข่ไก่สด ปุ๋ย อาหารสัตว์ หนังสือพิมพ์ ตำราเรียน ยารักษาโรค ฯลฯ)

สินค้าส่วนใหญ่ที่ขายออนไลน์จะเป็น vat7 ให้ตั้ง vat0 เฉพาะกรณีที่แน่ใจว่าเข้าข่ายยกเว้น VAT เท่านั้น

รายการสินค้า:
${uniqueProducts.map((p, i) => `${i + 1}. ${p}`).join("\n")}

ตอบเป็น JSON array โดยแต่ละรายการมีรูปแบบ:
{"name": "ชื่อสินค้า", "vatType": "vat7" หรือ "vat0", "reason": "เหตุผลสั้นๆ"}
ตอบเฉพาะ JSON array เท่านั้น ไม่ต้องมีข้อความอื่น`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    let aiResults: any[] = [];
    try {
      const content = response.choices[0]?.message?.content || "{}";
      const parsed = JSON.parse(content);
      aiResults = Array.isArray(parsed) ? parsed : (parsed.results || parsed.items || parsed.products || []);
    } catch { aiResults = []; }

    const aiMap = new Map(aiResults.map((r: any) => [String(r.name).trim().toLowerCase().replace(/\s+/g, " "), r]));
    const allResults = [...known];
    for (const name of toAnalyze) {
      const normalized = String(name).trim().toLowerCase().replace(/\s+/g, " ");
      const aiResult = aiMap.get(normalized);
      allResults.push({
        productName: name,
        vatType: aiResult?.vatType || "vat7",
        source: "ai",
        confidence: aiResult ? "ai_suggested" : "default",
      });
    }
    res.json({ results: allResults, aiAnalyzed: toAnalyze.length });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

}
