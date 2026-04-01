import crypto from "crypto";
import type {
  PlatformAdapter, PlatformCredentials, OAuthTokenResult, SyncOptions,
  SyncResult, PlatformOrder, PlatformReturn, PlatformCancellation,
  PlatformSettlement, PlatformLogistics, PlatformFinanceReport,
} from "./types";

const LAZADA_AUTH_URL = "https://auth.lazada.com/oauth/authorize";
const LAZADA_API_URL = "https://api.lazada.co.th/rest";
const LAZADA_TOKEN_URL = "https://auth.lazada.com/rest/auth/token/create";
const LAZADA_REFRESH_URL = "https://auth.lazada.com/rest/auth/token/refresh";

function lazadaSign(appSecret: string, apiPath: string, params: Record<string, string>): string {
  const sorted = Object.keys(params).sort().map(k => `${k}${params[k]}`).join("");
  const signStr = `${apiPath}${sorted}`;
  return crypto.createHmac("sha256", appSecret).update(signStr).digest("hex").toUpperCase();
}

async function lazadaRequest(apiPath: string, creds: PlatformCredentials, accessToken: string, params: Record<string, string> = {}): Promise<any> {
  const timestamp = String(Date.now());
  const allParams: Record<string, string> = {
    app_key: creds.appId,
    timestamp,
    sign_method: "sha256",
    access_token: accessToken,
    ...params,
  };
  allParams.sign = lazadaSign(creds.appSecret, apiPath, allParams);

  const query = new URLSearchParams(allParams).toString();
  const url = `${LAZADA_API_URL}${apiPath}?${query}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.code && data.code !== "0") throw new Error(`Lazada API Error: ${data.code} - ${data.message || ""}`);
  return data;
}

function mapOrderStatus(s: string): string {
  const map: Record<string, string> = {
    unpaid: "pending", pending: "pending", packed: "confirmed",
    ready_to_ship: "confirmed", shipped: "shipping", delivered: "delivered",
    canceled: "cancelled", returned: "returned", failed: "failed",
  };
  return map[s?.toLowerCase()] || s?.toLowerCase() || "unknown";
}

export const lazadaAdapter: PlatformAdapter = {
  platform: "lazada",
  displayName: "Lazada",
  supportsOAuth: true,
  supportsManualConnect: false,

  getAuthUrl(creds, state) {
    const redirectUrl = creds.redirectUrl || `${creds.extra?.baseUrl || ""}/api/ecommerce/oauth/lazada/callback`;
    const params = new URLSearchParams({
      response_type: "code",
      force_auth: "true",
      redirect_uri: redirectUrl,
      client_id: creds.appId,
      state,
      country: creds.region || "th",
    });
    return `${LAZADA_AUTH_URL}?${params.toString()}`;
  },

  async exchangeToken(creds, code) {
    const timestamp = String(Date.now());
    const apiPath = "/auth/token/create";
    const params: Record<string, string> = {
      app_key: creds.appId,
      timestamp,
      sign_method: "sha256",
      code,
    };
    params.sign = lazadaSign(creds.appSecret, apiPath, params);

    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${LAZADA_TOKEN_URL}?${query}`);
    const data = await res.json();
    if (data.code && data.code !== "0") throw new Error(`Lazada token error: ${data.code} - ${data.message || ""}`);

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in || 604800,
      shopId: String(data.country_user_info?.[0]?.seller_id || ""),
      shopName: data.country_user_info?.[0]?.short_code || data.account || "",
    };
  },

  async refreshToken(creds, refreshTk) {
    const timestamp = String(Date.now());
    const apiPath = "/auth/token/refresh";
    const params: Record<string, string> = {
      app_key: creds.appId,
      timestamp,
      sign_method: "sha256",
      refresh_token: refreshTk,
    };
    params.sign = lazadaSign(creds.appSecret, apiPath, params);

    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${LAZADA_REFRESH_URL}?${query}`);
    const data = await res.json();
    if (data.code && data.code !== "0") throw new Error(`Lazada refresh error: ${data.code} - ${data.message || ""}`);

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in || 604800,
    };
  },

  async getOrders(creds, accessToken, _shopId, options) {
    const params: Record<string, string> = {
      offset: String(((options.page || 1) - 1) * (options.pageSize || 50)),
      limit: String(options.pageSize || 50),
      sort_direction: "DESC",
      sort_by: "created_at",
    };
    if (options.startDate) params.created_after = new Date(options.startDate).toISOString();
    if (options.endDate) params.created_before = new Date(options.endDate).toISOString();
    if (options.status) params.status = options.status;

    const data = await lazadaRequest("/orders/get", creds, accessToken, params);
    const orderList = data.data?.orders || [];

    const orders: PlatformOrder[] = [];
    for (const o of orderList) {
      const itemData = await lazadaRequest("/order/items/get", creds, accessToken, { order_id: String(o.order_id) });
      const items = (itemData.data || []).map((i: any) => ({
        sku: i.sku || "",
        name: i.name || "",
        quantity: Number(i.quantity || 1),
        unitPrice: Number(i.item_price || 0),
        totalPrice: Number(i.paid_price || i.item_price || 0),
        variationName: i.variation || "",
        platformItemId: String(i.order_item_id || ""),
      }));

      orders.push({
        platformOrderId: String(o.order_id),
        orderNo: String(o.order_number || o.order_id),
        status: mapOrderStatus(o.statuses?.[0] || o.status || ""),
        buyerName: o.customer_first_name ? `${o.customer_first_name} ${o.customer_last_name || ""}`.trim() : "",
        buyerPhone: o.address_shipping?.phone || "",
        buyerAddress: [o.address_shipping?.address1, o.address_shipping?.address2, o.address_shipping?.city, o.address_shipping?.post_code].filter(Boolean).join(", "),
        shippingAddress: o.address_shipping?.address1 || "",
        items,
        totalAmount: Number(o.price || 0),
        shippingFee: Number(o.shipping_fee || 0),
        platformDiscount: Number(o.voucher_platform || 0),
        sellerDiscount: Number(o.voucher_seller || 0),
        paymentMethod: o.payment_method || "",
        orderDate: o.created_at || "",
        shipDate: o.updated_at || undefined,
        trackingNo: "",
        logisticsProvider: "",
        currency: o.currency || "THB",
        raw: o,
      });
    }

    return {
      data: orders,
      total: data.data?.count || orders.length,
      hasMore: orders.length >= (options.pageSize || 50),
      nextPage: orders.length >= (options.pageSize || 50) ? (options.page || 1) + 1 : undefined,
    };
  },

  async getReturns(creds, accessToken, _shopId, options) {
    const params: Record<string, string> = {
      offset: String(((options.page || 1) - 1) * (options.pageSize || 50)),
      limit: String(options.pageSize || 50),
    };

    const data = await lazadaRequest("/order/reverse/return/list", creds, accessToken, params);
    const returnList = data.data?.reverse_order_list || [];

    const returns: PlatformReturn[] = returnList.map((r: any) => ({
      platformReturnId: String(r.reverse_order_id || ""),
      orderId: String(r.trade_order_id || ""),
      status: r.status?.toLowerCase() || "",
      reason: r.reason || "",
      reasonDetail: r.reason_detail || "",
      returnType: r.reverse_type === "refund_only" ? "refund" as const : "return_refund" as const,
      refundAmount: Number(r.refund_amount || 0),
      items: (r.reverse_order_line_list || []).map((i: any) => ({
        sku: i.sku || "",
        name: i.product_name || "",
        quantity: Number(i.quantity || 1),
        amount: Number(i.item_price || 0),
        platformItemId: String(i.order_item_id || ""),
      })),
      requestDate: r.created_at || "",
      resolvedDate: r.updated_at || undefined,
      buyerName: r.buyer_id || "",
      raw: r,
    }));

    return {
      data: returns,
      total: data.data?.total || returns.length,
      hasMore: returns.length >= (options.pageSize || 50),
      nextPage: returns.length >= (options.pageSize || 50) ? (options.page || 1) + 1 : undefined,
    };
  },

  async getCancellations(creds, accessToken, shopId, options) {
    const result = await this.getOrders(creds, accessToken, shopId, { ...options, status: "canceled" });
    const cancellations: PlatformCancellation[] = result.data.map((o) => ({
      platformCancelId: o.platformOrderId,
      orderId: o.platformOrderId,
      orderNo: o.orderNo,
      reason: o.raw?.cancel_reason || o.raw?.reason || "ยกเลิก",
      cancelledBy: "platform" as const,
      cancelDate: o.raw?.updated_at || o.orderDate,
      refundAmount: o.totalAmount,
      status: "cancelled",
      buyerName: o.buyerName,
      raw: o.raw,
    }));
    return { data: cancellations, total: result.total, hasMore: result.hasMore, nextPage: result.nextPage };
  },

  async getSettlements(creds, accessToken, _shopId, options) {
    const params: Record<string, string> = {};
    if (options.startDate) params.start_time = options.startDate;
    if (options.endDate) params.end_time = options.endDate;

    const data = await lazadaRequest("/finance/transaction/details/get", creds, accessToken, params);
    const transactions = data.data || [];

    const itemMap = new Map<string, any>();
    for (const t of transactions) {
      const orderId = String(t.order_no || t.trade_order_id || "");
      if (!itemMap.has(orderId)) {
        itemMap.set(orderId, { orderId, orderNo: orderId, grossAmount: 0, commission: 0, serviceFee: 0, paymentFee: 0, shippingCost: 0, refundAmount: 0, otherFees: 0, netAmount: 0, settledDate: t.paid_time || "" });
      }
      const item = itemMap.get(orderId)!;
      const amt = Number(t.amount || 0);
      const feeType = (t.fee_name || t.transaction_type || "").toLowerCase();

      if (feeType.includes("commission")) item.commission += Math.abs(amt);
      else if (feeType.includes("service")) item.serviceFee += Math.abs(amt);
      else if (feeType.includes("payment")) item.paymentFee += Math.abs(amt);
      else if (feeType.includes("shipping") || feeType.includes("logistic")) item.shippingCost += Math.abs(amt);
      else if (feeType.includes("refund")) item.refundAmount += Math.abs(amt);
      else if (feeType.includes("item_price") || feeType.includes("revenue")) item.grossAmount += amt;
      else item.otherFees += Math.abs(amt);
      item.netAmount += amt;
    }

    const items = Array.from(itemMap.values());
    const totals = items.reduce((acc, i) => ({
      grossSales: acc.grossSales + i.grossAmount,
      totalCommission: acc.totalCommission + i.commission,
      totalServiceFee: acc.totalServiceFee + i.serviceFee,
      totalPaymentFee: acc.totalPaymentFee + i.paymentFee,
      totalShippingCost: acc.totalShippingCost + i.shippingCost,
      totalRefund: acc.totalRefund + i.refundAmount,
      totalOtherFees: acc.totalOtherFees + i.otherFees,
      netAmount: acc.netAmount + i.netAmount,
    }), { grossSales: 0, totalCommission: 0, totalServiceFee: 0, totalPaymentFee: 0, totalShippingCost: 0, totalRefund: 0, totalOtherFees: 0, netAmount: 0 });

    const settlement: PlatformSettlement = {
      settlementId: `lazada-${options.startDate || "all"}-${Date.now()}`,
      period: `${options.startDate || ""} - ${options.endDate || ""}`,
      settlementDate: new Date().toISOString(),
      totalOrders: items.length,
      ...totals,
      currency: "THB",
      items,
      raw: data,
    };

    return { data: items.length > 0 ? [settlement] : [], total: items.length > 0 ? 1 : 0, hasMore: false };
  },

  async getLogistics(creds, accessToken, _shopId, orderId) {
    try {
      const data = await lazadaRequest("/logistic/order/trace", creds, accessToken, { order_id: orderId });
      const trackInfo = data.data;
      if (!trackInfo) return null;

      return {
        orderId,
        orderNo: orderId,
        trackingNo: trackInfo.tracking_number || "",
        logisticsProvider: trackInfo.shipment_provider || "",
        status: trackInfo.package_status || "",
        events: (trackInfo.package_detail_info_list || []).map((e: any) => ({
          timestamp: e.time_stamp || "",
          status: e.activity || "",
          description: e.details || "",
          location: e.location || "",
        })),
        raw: trackInfo,
      };
    } catch { return null; }
  },

  async getFinanceReport(creds, accessToken, _shopId, options) {
    try {
      const data = await lazadaRequest("/finance/transaction/details/get", creds, accessToken, {
        start_time: options.startDate || "",
        end_time: options.endDate || "",
      });
      const transactions = data.data || [];

      const breakdown: Record<string, any> = {};
      let totalSales = 0, totalFees = 0, totalRefunds = 0;

      for (const t of transactions) {
        const cat = t.fee_name || t.transaction_type || "other";
        if (!breakdown[cat]) breakdown[cat] = { category: cat, description: cat, amount: 0, transactionCount: 0 };
        breakdown[cat].amount += Number(t.amount || 0);
        breakdown[cat].transactionCount++;

        const amt = Number(t.amount || 0);
        if (cat.toLowerCase().includes("revenue") || cat.toLowerCase().includes("item_price")) totalSales += amt;
        else if (cat.toLowerCase().includes("refund")) totalRefunds += Math.abs(amt);
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
