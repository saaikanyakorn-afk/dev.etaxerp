import crypto from "crypto";
import type {
  PlatformAdapter, PlatformCredentials, OAuthTokenResult, SyncOptions,
  SyncResult, PlatformOrder, PlatformReturn, PlatformCancellation,
  PlatformSettlement, PlatformLogistics, PlatformFinanceReport,
} from "./types";

const TIKTOK_AUTH_URL = "https://auth.tiktok-shops.com/oauth/authorize";
const TIKTOK_API_URL = "https://open-api.tiktokglobalshop.com";

function tiktokSign(appSecret: string, path: string, params: Record<string, string>): string {
  const sorted = Object.keys(params).filter(k => k !== "sign" && k !== "access_token").sort();
  const signStr = appSecret + path + sorted.map(k => `${k}${params[k]}`).join("") + appSecret;
  return crypto.createHmac("sha256", appSecret).update(signStr).digest("hex");
}

async function tiktokRequest(path: string, creds: PlatformCredentials, accessToken: string, shopCipher: string, params: Record<string, any> = {}, method: "GET" | "POST" = "GET", body?: any): Promise<any> {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const baseParams: Record<string, string> = {
    app_key: creds.appId,
    timestamp,
    shop_cipher: shopCipher,
    version: "202309",
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
  };
  baseParams.sign = tiktokSign(creds.appSecret, path, baseParams);
  baseParams.access_token = accessToken;

  const query = new URLSearchParams(baseParams).toString();
  const url = `${TIKTOK_API_URL}${path}?${query}`;
  const options: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body && method === "POST") options.body = JSON.stringify(body);

  const res = await fetch(url, options);
  const data = await res.json();
  if (data.code !== 0) throw new Error(`TikTok API Error: ${data.code} - ${data.message || ""}`);
  return data;
}

function mapOrderStatus(s: number | string): string {
  const statusMap: Record<string, string> = {
    "100": "pending", "105": "pending", "111": "confirmed", "112": "confirmed",
    "114": "confirmed", "121": "shipping", "122": "delivered",
    "130": "delivered", "140": "cancelled", "250": "cancelled",
  };
  return statusMap[String(s)] || "unknown";
}

export const tiktokAdapter: PlatformAdapter = {
  platform: "tiktok",
  displayName: "TikTok Shop",
  supportsOAuth: true,
  supportsManualConnect: false,

  getAuthUrl(creds, state) {
    const params = new URLSearchParams({
      app_key: creds.appId,
      state,
    });
    return `${TIKTOK_AUTH_URL}?${params.toString()}`;
  },

  async exchangeToken(creds, code) {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const path = "/api/v2/token/get";
    const params: Record<string, string> = {
      app_key: creds.appId,
      app_secret: creds.appSecret,
      auth_code: code,
      grant_type: "authorized_code",
    };

    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${TIKTOK_API_URL}${path}?${query}`);
    const data = await res.json();
    if (data.code !== 0) throw new Error(`TikTok token error: ${data.code} - ${data.message || ""}`);

    const tokenData = data.data;
    return {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresIn: tokenData.access_token_expire_in || 86400,
      shopId: tokenData.open_id || "",
      shopName: tokenData.seller_name || "",
      extra: {
        shopCipher: tokenData.seller_base_region ? `${tokenData.seller_base_region}` : "",
        openId: tokenData.open_id,
      },
    };
  },

  async refreshToken(creds, refreshTk) {
    const path = "/api/v2/token/refresh";
    const params: Record<string, string> = {
      app_key: creds.appId,
      app_secret: creds.appSecret,
      refresh_token: refreshTk,
      grant_type: "refresh_token",
    };

    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${TIKTOK_API_URL}${path}?${query}`);
    const data = await res.json();
    if (data.code !== 0) throw new Error(`TikTok refresh error: ${data.code} - ${data.message || ""}`);

    const tokenData = data.data;
    return {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresIn: tokenData.access_token_expire_in || 86400,
    };
  },

  async getOrders(creds, accessToken, shopId, options) {
    const pageSize = options.pageSize || 50;
    const body: any = {
      page_size: pageSize,
      sort_order: 2,
      sort_type: 1,
    };
    if (options.cursor) body.cursor = options.cursor;
    if (options.startDate) body.create_time_ge = Math.floor(new Date(options.startDate).getTime() / 1000);
    if (options.endDate) body.create_time_lt = Math.floor(new Date(options.endDate).getTime() / 1000);

    const shopCipher = shopId;
    const data = await tiktokRequest("/api/orders/search", creds, accessToken, shopCipher, {}, "POST", body);
    const orderList = data.data?.orders || [];

    const orders: PlatformOrder[] = orderList.map((o: any) => ({
      platformOrderId: o.id || "",
      orderNo: o.order_id || o.id || "",
      status: mapOrderStatus(o.status),
      buyerName: o.recipient_address?.name || o.buyer_message?.buyer_username || "",
      buyerPhone: o.recipient_address?.phone_number || "",
      buyerAddress: [o.recipient_address?.address_detail, o.recipient_address?.district, o.recipient_address?.city, o.recipient_address?.state].filter(Boolean).join(", "),
      shippingAddress: o.recipient_address?.full_address || "",
      items: (o.line_items || o.item_list || []).map((i: any) => ({
        sku: i.seller_sku || i.sku_id || "",
        name: i.product_name || "",
        quantity: Number(i.quantity || 1),
        unitPrice: Number(i.sale_price || i.original_price || 0),
        totalPrice: Number(i.sale_price || i.original_price || 0) * Number(i.quantity || 1),
        variationName: i.sku_name || "",
        platformItemId: String(i.id || ""),
      })),
      totalAmount: Number(o.payment?.total_amount || o.total_amount || 0),
      shippingFee: Number(o.payment?.shipping_fee || 0),
      platformDiscount: Number(o.payment?.platform_discount || 0),
      sellerDiscount: Number(o.payment?.seller_discount || 0),
      paymentMethod: o.payment?.payment_method_name || "",
      orderDate: o.create_time ? new Date(o.create_time * 1000).toISOString() : "",
      shipDate: o.rts_time ? new Date(o.rts_time * 1000).toISOString() : undefined,
      trackingNo: o.tracking_number || "",
      logisticsProvider: o.shipping_provider || "",
      currency: o.payment?.currency || "THB",
      raw: o,
    }));

    return {
      data: orders,
      total: data.data?.total_count || orders.length,
      hasMore: !!data.data?.next_cursor,
      nextCursor: data.data?.next_cursor,
    };
  },

  async getReturns(creds, accessToken, shopId, options) {
    const body: any = {
      page_size: options.pageSize || 20,
      sort_order: 2,
    };
    if (options.cursor) body.cursor = options.cursor;
    if (options.startDate) body.create_time_ge = Math.floor(new Date(options.startDate).getTime() / 1000);
    if (options.endDate) body.create_time_lt = Math.floor(new Date(options.endDate).getTime() / 1000);

    const data = await tiktokRequest("/api/reverse/reverse_order/list", creds, accessToken, shopId, {}, "POST", body);
    const returnList = data.data?.reverse_order_list || [];

    const returns: PlatformReturn[] = returnList.map((r: any) => ({
      platformReturnId: r.reverse_order_id || "",
      orderId: r.order_id || "",
      status: r.reverse_order_status?.toLowerCase() || "",
      reason: r.reverse_reason?.text || r.reason || "",
      reasonDetail: r.buyer_comments || "",
      returnType: r.reverse_type === "REFUND_ONLY" ? "refund" as const : "return_refund" as const,
      refundAmount: Number(r.refund_total || 0),
      items: (r.reverse_order_line_items || []).map((i: any) => ({
        sku: i.seller_sku || "",
        name: i.product_name || "",
        quantity: Number(i.quantity || 1),
        amount: Number(i.refund_amount || 0),
        platformItemId: String(i.id || ""),
      })),
      requestDate: r.create_time ? new Date(r.create_time * 1000).toISOString() : "",
      resolvedDate: r.update_time ? new Date(r.update_time * 1000).toISOString() : undefined,
      trackingNo: r.reverse_shipping?.tracking_number || "",
      buyerName: r.buyer_username || "",
      raw: r,
    }));

    return {
      data: returns,
      total: data.data?.total || returns.length,
      hasMore: !!data.data?.next_cursor,
      nextCursor: data.data?.next_cursor,
    };
  },

  async getCancellations(creds, accessToken, shopId, options) {
    const body: any = {
      page_size: options.pageSize || 50,
      sort_order: 2,
    };
    if (options.cursor) body.cursor = options.cursor;
    if (options.startDate) body.create_time_ge = Math.floor(new Date(options.startDate).getTime() / 1000);
    if (options.endDate) body.create_time_lt = Math.floor(new Date(options.endDate).getTime() / 1000);

    const data = await tiktokRequest("/api/reverse/reverse_order/list", creds, accessToken, shopId, {}, "POST", {
      ...body,
      reverse_type: "CANCELLATION",
    });
    const cancelList = data.data?.reverse_order_list || [];

    const cancellations: PlatformCancellation[] = cancelList.map((c: any) => ({
      platformCancelId: c.reverse_order_id || "",
      orderId: c.order_id || "",
      orderNo: c.order_id || "",
      reason: c.reverse_reason?.text || c.cancel_reason || "ยกเลิก",
      cancelledBy: (c.role === "BUYER" ? "buyer" : c.role === "SELLER" ? "seller" : "platform") as any,
      cancelDate: c.create_time ? new Date(c.create_time * 1000).toISOString() : "",
      refundAmount: Number(c.refund_total || 0),
      status: c.reverse_order_status?.toLowerCase() || "cancelled",
      buyerName: c.buyer_username || "",
      raw: c,
    }));

    return {
      data: cancellations,
      total: data.data?.total || cancellations.length,
      hasMore: !!data.data?.next_cursor,
      nextCursor: data.data?.next_cursor,
    };
  },

  async getSettlements(creds, accessToken, shopId, options) {
    const body: any = {
      page_size: options.pageSize || 50,
      sort_order: 2,
    };
    if (options.cursor) body.cursor = options.cursor;
    if (options.startDate) body.request_time_ge = Math.floor(new Date(options.startDate).getTime() / 1000);
    if (options.endDate) body.request_time_lt = Math.floor(new Date(options.endDate).getTime() / 1000);

    const data = await tiktokRequest("/api/finance/settlements/search", creds, accessToken, shopId, {}, "POST", body);
    const settlementList = data.data?.settlement_list || [];

    const settlements: PlatformSettlement[] = settlementList.map((s: any) => {
      const items = (s.order_list || []).map((o: any) => ({
        orderId: o.order_id || "",
        orderNo: o.order_id || "",
        grossAmount: Number(o.sku_subtotal_before_discount || 0),
        commission: Math.abs(Number(o.platform_commission || 0)),
        serviceFee: Math.abs(Number(o.transaction_fee || 0)),
        paymentFee: Math.abs(Number(o.payment_fee || 0)),
        shippingCost: Math.abs(Number(o.shipping_fee || 0)),
        refundAmount: Math.abs(Number(o.refund_amount || 0)),
        otherFees: Math.abs(Number(o.adjustment_amount || 0)),
        netAmount: Number(o.revenue || o.settlement_amount || 0),
        settledDate: s.settlement_time ? new Date(s.settlement_time * 1000).toISOString() : "",
      }));

      return {
        settlementId: s.settlement_id || "",
        period: `${s.statement_time?.start_time || ""} - ${s.statement_time?.end_time || ""}`,
        settlementDate: s.settlement_time ? new Date(s.settlement_time * 1000).toISOString() : "",
        totalOrders: items.length,
        grossSales: items.reduce((s: number, i: any) => s + i.grossAmount, 0),
        totalCommission: items.reduce((s: number, i: any) => s + i.commission, 0),
        totalServiceFee: items.reduce((s: number, i: any) => s + i.serviceFee, 0),
        totalPaymentFee: items.reduce((s: number, i: any) => s + i.paymentFee, 0),
        totalShippingCost: items.reduce((s: number, i: any) => s + i.shippingCost, 0),
        totalRefund: items.reduce((s: number, i: any) => s + i.refundAmount, 0),
        totalOtherFees: items.reduce((s: number, i: any) => s + i.otherFees, 0),
        netAmount: Number(s.settlement_amount || 0),
        currency: s.currency || "THB",
        items,
        raw: s,
      };
    });

    return {
      data: settlements,
      total: data.data?.total || settlements.length,
      hasMore: !!data.data?.next_cursor,
      nextCursor: data.data?.next_cursor,
    };
  },

  async getLogistics(creds, accessToken, shopId, orderId) {
    try {
      const data = await tiktokRequest("/api/fulfillment/detail", creds, accessToken, shopId, { order_id: orderId });
      const pkg = data.data?.package_list?.[0];
      if (!pkg) return null;

      return {
        orderId,
        orderNo: orderId,
        trackingNo: pkg.tracking_number || "",
        logisticsProvider: pkg.shipping_provider_name || "",
        status: pkg.package_status || "",
        events: (pkg.tracking_info_list || []).map((e: any) => ({
          timestamp: e.update_time ? new Date(e.update_time * 1000).toISOString() : "",
          status: e.description || "",
          description: e.description || "",
          location: "",
        })),
        raw: data.data,
      };
    } catch { return null; }
  },

  async getFinanceReport(creds, accessToken, shopId, options) {
    try {
      const data = await tiktokRequest("/api/finance/transactions/search", creds, accessToken, shopId, {}, "POST", {
        page_size: options.pageSize || 100,
        create_time_ge: options.startDate ? Math.floor(new Date(options.startDate).getTime() / 1000) : undefined,
        create_time_lt: options.endDate ? Math.floor(new Date(options.endDate).getTime() / 1000) : undefined,
      });

      const transactions = data.data?.transaction_list || [];
      const breakdown: Record<string, any> = {};
      let totalSales = 0, totalFees = 0, totalRefunds = 0;

      for (const t of transactions) {
        const cat = t.type || "other";
        if (!breakdown[cat]) breakdown[cat] = { category: cat, description: cat, amount: 0, transactionCount: 0 };
        const amt = Number(t.amount || 0);
        breakdown[cat].amount += amt;
        breakdown[cat].transactionCount++;

        if (cat.includes("SALE") || cat.includes("REVENUE")) totalSales += amt;
        else if (cat.includes("REFUND")) totalRefunds += Math.abs(amt);
        else totalFees += Math.abs(amt);
      }

      return {
        reportType: "finance_transactions",
        period: `${options.startDate || ""} - ${options.endDate || ""}`,
        totalSales,
        totalFees,
        totalRefunds,
        totalAdjustments: 0,
        netIncome: totalSales - totalFees - totalRefunds,
        breakdown: Object.values(breakdown),
        raw: data,
      };
    } catch { return null; }
  },
};
