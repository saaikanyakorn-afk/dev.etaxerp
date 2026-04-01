import crypto from "crypto";
import type {
  PlatformAdapter, PlatformCredentials, OAuthTokenResult, SyncOptions,
  SyncResult, PlatformOrder, PlatformReturn, PlatformCancellation,
  PlatformSettlement, PlatformLogistics, PlatformFinanceReport,
} from "./types";

const SHOPEE_API_V2 = "https://partner.shopeemobile.com";
const SHOPEE_AUTH_PATH = "/api/v2/shop/auth_partner";
const SHOPEE_TOKEN_PATH = "/api/v2/auth/token/get";
const SHOPEE_REFRESH_PATH = "/api/v2/auth/access_token/get";

function shopeeSign(partnerId: string, partnerKey: string, path: string, timestamp: number, accessToken?: string, shopId?: string): string {
  let baseStr = `${partnerId}${path}${timestamp}`;
  if (accessToken) baseStr += accessToken;
  if (shopId) baseStr += shopId;
  return crypto.createHmac("sha256", partnerKey).update(baseStr).digest("hex");
}

function buildUrl(path: string, creds: PlatformCredentials, params: Record<string, string> = {}, accessToken?: string, shopId?: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = shopeeSign(creds.appId, creds.appSecret, path, timestamp, accessToken, shopId);
  const query = new URLSearchParams({
    partner_id: creds.appId,
    timestamp: String(timestamp),
    sign,
    ...params,
  });
  if (accessToken) query.set("access_token", accessToken);
  if (shopId) query.set("shop_id", shopId);
  return `${SHOPEE_API_V2}${path}?${query.toString()}`;
}

async function shopeeRequest(path: string, creds: PlatformCredentials, accessToken: string, shopId: string, body?: any): Promise<any> {
  const url = buildUrl(path, creds, {}, accessToken, shopId);
  const options: RequestInit = {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
  };
  if (body) options.body = JSON.stringify(body);
  const res = await fetch(url, options);
  const data = await res.json();
  if (data.error) throw new Error(`Shopee API Error: ${data.error} - ${data.message || ""}`);
  return data;
}

function mapOrderStatus(s: string): string {
  const map: Record<string, string> = {
    UNPAID: "pending", READY_TO_SHIP: "confirmed", PROCESSED: "confirmed",
    SHIPPED: "shipping", COMPLETED: "delivered", IN_CANCEL: "cancelling",
    CANCELLED: "cancelled", INVOICE_PENDING: "pending",
  };
  return map[s] || s.toLowerCase();
}

function mapReturnStatus(s: string): string {
  const map: Record<string, string> = {
    REQUESTED: "requested", ACCEPTED: "approved", CANCELLED: "cancelled",
    JUDGING: "processing", CLOSED: "closed", PROCESSING: "processing",
    SELLER_DISPUTE: "disputed", REFUND_PAID: "refunded", COMPLETED: "completed",
  };
  return map[s] || s.toLowerCase();
}

export const shopeeAdapter: PlatformAdapter = {
  platform: "shopee",
  displayName: "Shopee",
  supportsOAuth: true,
  supportsManualConnect: false,

  getAuthUrl(creds, state, _shopId) {
    const redirectUrl = creds.redirectUrl || `${creds.extra?.baseUrl || ""}/api/ecommerce/oauth/shopee/callback`;
    const timestamp = Math.floor(Date.now() / 1000);
    const path = SHOPEE_AUTH_PATH;
    const sign = shopeeSign(creds.appId, creds.appSecret, path, timestamp);
    const params = new URLSearchParams({
      partner_id: creds.appId,
      timestamp: String(timestamp),
      sign,
      redirect: redirectUrl,
      state,
    });
    return `${SHOPEE_API_V2}${path}?${params.toString()}`;
  },

  async exchangeToken(creds, code, shopId) {
    const timestamp = Math.floor(Date.now() / 1000);
    const path = SHOPEE_TOKEN_PATH;
    const sign = shopeeSign(creds.appId, creds.appSecret, path, timestamp);
    const url = `${SHOPEE_API_V2}${path}?partner_id=${creds.appId}&timestamp=${timestamp}&sign=${sign}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        shop_id: shopId ? Number(shopId) : undefined,
        partner_id: Number(creds.appId),
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(`Shopee token error: ${data.error} - ${data.message || ""}`);
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expire_in || 14400,
      shopId: String(data.shop_id || shopId || ""),
      shopName: data.shop_name,
    };
  },

  async refreshToken(creds, refreshTk, shopId) {
    const timestamp = Math.floor(Date.now() / 1000);
    const path = SHOPEE_REFRESH_PATH;
    const sign = shopeeSign(creds.appId, creds.appSecret, path, timestamp);
    const url = `${SHOPEE_API_V2}${path}?partner_id=${creds.appId}&timestamp=${timestamp}&sign=${sign}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        refresh_token: refreshTk,
        shop_id: shopId ? Number(shopId) : undefined,
        partner_id: Number(creds.appId),
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(`Shopee refresh error: ${data.error} - ${data.message || ""}`);
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expire_in || 14400,
      shopId: String(data.shop_id || shopId || ""),
    };
  },

  async getOrders(creds, accessToken, shopId, options) {
    const timeFrom = options.startDate ? Math.floor(new Date(options.startDate).getTime() / 1000) : Math.floor(Date.now() / 1000) - 86400 * 15;
    const timeTo = options.endDate ? Math.floor(new Date(options.endDate).getTime() / 1000) : Math.floor(Date.now() / 1000);
    const pageSize = options.pageSize || 50;
    const cursor = options.cursor || "";

    const listData = await shopeeRequest("/api/v2/order/get_order_list", creds, accessToken, shopId, {
      time_range_field: "create_time",
      time_from: timeFrom,
      time_to: timeTo,
      page_size: pageSize,
      cursor,
      order_status: options.status || "ALL",
    });

    const orderList = listData.response?.order_list || [];
    if (orderList.length === 0) return { data: [], total: 0, hasMore: false };

    const orderIds = orderList.map((o: any) => o.order_sn);
    const detailData = await shopeeRequest("/api/v2/order/get_order_detail", creds, accessToken, shopId, {
      order_sn_list: orderIds,
      response_optional_fields: "buyer_user_id,buyer_username,estimated_shipping_fee,recipient_address,actual_shipping_fee,item_list,pay_time,ship_by_date,tracking_no,logistics_status",
    });

    const orders: PlatformOrder[] = (detailData.response?.order_list || []).map((o: any) => ({
      platformOrderId: o.order_sn,
      orderNo: o.order_sn,
      status: mapOrderStatus(o.order_status),
      buyerName: o.buyer_username || o.buyer_user_id || "",
      buyerPhone: o.recipient_address?.phone || "",
      buyerAddress: [o.recipient_address?.full_address, o.recipient_address?.city, o.recipient_address?.state].filter(Boolean).join(", "),
      shippingAddress: o.recipient_address?.full_address || "",
      items: (o.item_list || []).map((i: any) => ({
        sku: i.model_sku || i.item_sku || "",
        name: i.item_name || "",
        quantity: i.model_quantity_purchased || 1,
        unitPrice: Number(i.model_discounted_price || i.model_original_price || 0),
        totalPrice: Number(i.model_discounted_price || i.model_original_price || 0) * (i.model_quantity_purchased || 1),
        variationName: i.model_name || "",
        platformItemId: String(i.item_id || ""),
      })),
      totalAmount: Number(o.total_amount || 0),
      shippingFee: Number(o.estimated_shipping_fee || o.actual_shipping_fee || 0),
      platformDiscount: Number(o.voucher_from_shopee || 0),
      sellerDiscount: Number(o.voucher_from_seller || 0),
      paymentMethod: o.payment_method || "",
      orderDate: o.create_time ? new Date(o.create_time * 1000).toISOString() : "",
      shipDate: o.ship_by_date ? new Date(o.ship_by_date * 1000).toISOString() : undefined,
      trackingNo: o.tracking_no || "",
      logisticsProvider: o.shipping_carrier || "",
      currency: o.currency || "THB",
      raw: o,
    }));

    return {
      data: orders,
      total: listData.response?.total_count || orders.length,
      hasMore: listData.response?.more || false,
      nextCursor: listData.response?.next_cursor || undefined,
    };
  },

  async getReturns(creds, accessToken, shopId, options) {
    const pageNo = options.page || 1;
    const pageSize = options.pageSize || 50;

    const data = await shopeeRequest("/api/v2/returns/get_return_list", creds, accessToken, shopId, {
      page_no: pageNo,
      page_size: pageSize,
      create_time_from: options.startDate ? Math.floor(new Date(options.startDate).getTime() / 1000) : undefined,
      create_time_to: options.endDate ? Math.floor(new Date(options.endDate).getTime() / 1000) : undefined,
    });

    const returns: PlatformReturn[] = (data.response?.return_list || []).map((r: any) => ({
      platformReturnId: String(r.return_sn || ""),
      orderId: r.order_sn || "",
      status: mapReturnStatus(r.status || ""),
      reason: r.reason_text || r.reason || "",
      reasonDetail: r.text_reason || "",
      returnType: r.refund_amount > 0 && r.item?.length > 0 ? "return_refund" : r.refund_amount > 0 ? "refund" : "return",
      refundAmount: Number(r.refund_amount || 0),
      items: (r.item || []).map((i: any) => ({
        sku: i.model_sku || i.item_sku || "",
        name: i.name || "",
        quantity: i.amount || 1,
        amount: Number(i.item_price || 0),
        platformItemId: String(i.item_id || ""),
      })),
      requestDate: r.create_time ? new Date(r.create_time * 1000).toISOString() : "",
      resolvedDate: r.update_time ? new Date(r.update_time * 1000).toISOString() : undefined,
      trackingNo: r.tracking_number || "",
      buyerName: r.buyer_username || "",
      raw: r,
    }));

    return {
      data: returns,
      total: data.response?.total_count || returns.length,
      hasMore: returns.length >= pageSize,
      nextPage: returns.length >= pageSize ? pageNo + 1 : undefined,
    };
  },

  async getCancellations(creds, accessToken, shopId, options) {
    const result = await this.getOrders(creds, accessToken, shopId, { ...options, status: "CANCELLED" });
    const cancellations: PlatformCancellation[] = result.data.map((o) => ({
      platformCancelId: o.platformOrderId,
      orderId: o.platformOrderId,
      orderNo: o.orderNo,
      reason: o.raw?.cancel_reason || "ยกเลิก",
      cancelledBy: (o.raw?.cancel_by === "buyer" ? "buyer" : o.raw?.cancel_by === "seller" ? "seller" : "platform") as any,
      cancelDate: o.raw?.update_time ? new Date(o.raw.update_time * 1000).toISOString() : o.orderDate,
      refundAmount: o.totalAmount,
      status: "cancelled",
      buyerName: o.buyerName,
      raw: o.raw,
    }));
    return { data: cancellations, total: result.total, hasMore: result.hasMore, nextCursor: result.nextCursor };
  },

  async getSettlements(creds, accessToken, shopId, options) {
    const data = await shopeeRequest("/api/v2/payment/get_escrow_list", creds, accessToken, shopId, {
      page_no: options.page || 1,
      page_size: options.pageSize || 50,
      release_time_from: options.startDate ? Math.floor(new Date(options.startDate).getTime() / 1000) : undefined,
      release_time_to: options.endDate ? Math.floor(new Date(options.endDate).getTime() / 1000) : undefined,
    });

    const settlements: PlatformSettlement[] = [];
    const escrowList = data.response?.escrow_list || [];
    if (escrowList.length > 0) {
      const items = escrowList.map((e: any) => ({
        orderId: e.order_sn || "",
        orderNo: e.order_sn || "",
        grossAmount: Number(e.order_income?.original_price || 0),
        commission: Math.abs(Number(e.order_income?.commission_fee || 0)),
        serviceFee: Math.abs(Number(e.order_income?.service_fee || 0)),
        paymentFee: Math.abs(Number(e.order_income?.credit_card_transaction_fee || 0)),
        shippingCost: Math.abs(Number(e.order_income?.actual_shipping_fee || 0)),
        refundAmount: Math.abs(Number(e.order_income?.buyer_shopee_kredit || 0)),
        otherFees: Math.abs(Number(e.order_income?.shopee_shipping_rebate || 0)),
        netAmount: Number(e.order_income?.escrow_amount || 0),
        settledDate: e.escrow_release_time ? new Date(e.escrow_release_time * 1000).toISOString() : "",
      }));

      const totals = items.reduce((acc: any, i: any) => ({
        grossSales: acc.grossSales + i.grossAmount,
        totalCommission: acc.totalCommission + i.commission,
        totalServiceFee: acc.totalServiceFee + i.serviceFee,
        totalPaymentFee: acc.totalPaymentFee + i.paymentFee,
        totalShippingCost: acc.totalShippingCost + i.shippingCost,
        totalRefund: acc.totalRefund + i.refundAmount,
        totalOtherFees: acc.totalOtherFees + i.otherFees,
        netAmount: acc.netAmount + i.netAmount,
      }), { grossSales: 0, totalCommission: 0, totalServiceFee: 0, totalPaymentFee: 0, totalShippingCost: 0, totalRefund: 0, totalOtherFees: 0, netAmount: 0 });

      settlements.push({
        settlementId: `shopee-${options.startDate || "all"}-${Date.now()}`,
        period: `${options.startDate || ""} - ${options.endDate || ""}`,
        settlementDate: new Date().toISOString(),
        totalOrders: items.length,
        ...totals,
        currency: "THB",
        items,
        raw: data.response,
      });
    }

    return { data: settlements, total: settlements.length, hasMore: false };
  },

  async getLogistics(creds, accessToken, shopId, orderId) {
    try {
      const data = await shopeeRequest("/api/v2/logistics/get_tracking_info", creds, accessToken, shopId, {
        order_sn: orderId,
      });
      const info = data.response;
      if (!info) return null;

      return {
        orderId,
        orderNo: orderId,
        trackingNo: info.tracking_number || "",
        logisticsProvider: info.logistics_channel_name || "",
        status: info.logistics_status || "",
        events: (info.tracking_info || []).map((e: any) => ({
          timestamp: e.update_time ? new Date(e.update_time * 1000).toISOString() : "",
          status: e.logistics_status || "",
          description: e.description || "",
          location: "",
        })),
        raw: info,
      };
    } catch { return null; }
  },

  async getFinanceReport(creds, accessToken, shopId, options) {
    try {
      const data = await shopeeRequest("/api/v2/payment/get_wallet_transaction_list", creds, accessToken, shopId, {
        page_no: options.page || 1,
        page_size: options.pageSize || 100,
        create_time_from: options.startDate ? Math.floor(new Date(options.startDate).getTime() / 1000) : undefined,
        create_time_to: options.endDate ? Math.floor(new Date(options.endDate).getTime() / 1000) : undefined,
      });
      const transactions = data.response?.transaction_list || [];
      const breakdown = transactions.reduce((acc: Record<string, any>, t: any) => {
        const cat = t.transaction_type || "other";
        if (!acc[cat]) acc[cat] = { category: cat, description: cat, amount: 0, transactionCount: 0 };
        acc[cat].amount += Number(t.amount || 0);
        acc[cat].transactionCount++;
        return acc;
      }, {});

      return {
        reportType: "wallet_transactions",
        period: `${options.startDate || ""} - ${options.endDate || ""}`,
        totalSales: Object.values(breakdown).reduce((s: number, b: any) => b.category === "SALES" ? s + b.amount : s, 0),
        totalFees: Object.values(breakdown).reduce((s: number, b: any) => b.category === "COMMISSION" || b.category === "SERVICE_FEE" ? s + Math.abs(b.amount) : s, 0),
        totalRefunds: Object.values(breakdown).reduce((s: number, b: any) => b.category === "REFUND" ? s + Math.abs(b.amount) : s, 0),
        totalAdjustments: Object.values(breakdown).reduce((s: number, b: any) => b.category === "ADJUSTMENT" ? s + b.amount : s, 0),
        netIncome: transactions.reduce((s: number, t: any) => s + Number(t.amount || 0), 0),
        breakdown: Object.values(breakdown) as any[],
        raw: data.response,
      };
    } catch { return null; }
  },
};
