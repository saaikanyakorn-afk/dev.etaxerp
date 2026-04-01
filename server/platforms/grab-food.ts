import type {
  PlatformAdapter, PlatformCredentials, OAuthTokenResult, SyncOptions,
  SyncResult, PlatformOrder, PlatformReturn, PlatformCancellation,
  PlatformSettlement, PlatformLogistics, PlatformFinanceReport,
} from "./types";

const GRAB_API_PROD = "https://partner-api.grab.com/grabfood";
const GRAB_API_STG = "https://partner-api.stg-myteksi.com/grabfood";
const GRAB_AUTH_PROD = "https://api.grab.com/grabid/v1/oauth2/token";
const GRAB_AUTH_STG = "https://api.stg-myteksi.com/grabid/v1/oauth2/token";

function getBaseUrl(creds: PlatformCredentials): string {
  return creds.sandbox ? GRAB_API_STG : GRAB_API_PROD;
}

async function grabRequest(path: string, creds: PlatformCredentials, accessToken: string, method: "GET" | "POST" = "GET", body?: any): Promise<any> {
  const baseUrl = getBaseUrl(creds);
  const url = `${baseUrl}${path}`;
  const options: RequestInit = {
    method,
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  };
  if (body) options.body = JSON.stringify(body);
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`Grab API Error: ${res.status} ${await res.text()}`);
  return res.json();
}

export const grabFoodAdapter: PlatformAdapter = {
  platform: "grab_food",
  displayName: "Grab Food",
  supportsOAuth: false,
  supportsManualConnect: true,

  getAuthUrl(_creds, _state) {
    return "";
  },

  async exchangeToken(creds, _code) {
    const tokenUrl = creds.sandbox ? GRAB_AUTH_STG : GRAB_AUTH_PROD;
    const res = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: creds.appId,
        client_secret: creds.appSecret,
        grant_type: "client_credentials",
        scope: "grab_food.merchant_profile grab_food.orders",
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(`Grab token error: ${data.error}`);

    return {
      accessToken: data.access_token,
      refreshToken: "",
      expiresIn: data.expires_in || 7200,
    };
  },

  async refreshToken(creds, _refreshTk) {
    return this.exchangeToken(creds, "");
  },

  async getOrders(creds, accessToken, _shopId, options) {
    try {
      const merchantId = creds.extra?.merchantId || "";
      const data = await grabRequest(`/partner/v1/merchants/${merchantId}/orders`, creds, accessToken);
      const orderList = data.orders || [];

      const orders: PlatformOrder[] = orderList.map((o: any) => ({
        platformOrderId: o.orderID || "",
        orderNo: o.shortOrderNumber || o.orderID || "",
        status: o.state?.toLowerCase() || "unknown",
        buyerName: o.eater?.name || "",
        buyerPhone: "",
        buyerAddress: o.deliveryAddress?.address || "",
        items: (o.items || []).map((i: any) => ({
          sku: String(i.itemID || ""),
          name: i.name || "",
          quantity: Number(i.quantity || 1),
          unitPrice: Number(i.price || 0) / 100,
          totalPrice: (Number(i.price || 0) * Number(i.quantity || 1)) / 100,
        })),
        totalAmount: Number(o.price?.subtotal || 0) / 100,
        shippingFee: Number(o.price?.deliveryFee || 0) / 100,
        platformDiscount: Number(o.price?.promos || 0) / 100,
        sellerDiscount: 0,
        orderDate: o.createdAt || "",
        currency: o.currency || "THB",
        raw: o,
      }));

      return { data: orders, total: orders.length, hasMore: false };
    } catch { return { data: [], total: 0, hasMore: false }; }
  },

  async getReturns(_creds, _accessToken, _shopId, _options) {
    return { data: [], total: 0, hasMore: false };
  },

  async getCancellations(creds, accessToken, shopId, options) {
    const result = await this.getOrders(creds, accessToken, shopId, options);
    const cancellations: PlatformCancellation[] = result.data
      .filter(o => o.status === "cancelled" || o.status === "driver_cancelled")
      .map(o => ({
        platformCancelId: o.platformOrderId,
        orderId: o.platformOrderId,
        orderNo: o.orderNo,
        reason: o.raw?.cancelReason || "ยกเลิก",
        cancelledBy: "platform" as const,
        cancelDate: o.orderDate,
        refundAmount: o.totalAmount,
        status: "cancelled",
        buyerName: o.buyerName,
        raw: o.raw,
      }));
    return { data: cancellations, total: cancellations.length, hasMore: false };
  },

  async getSettlements(_creds, _accessToken, _shopId, _options) {
    return { data: [], total: 0, hasMore: false };
  },

  async getLogistics(_creds, _accessToken, _shopId, _orderId) {
    return null;
  },

  async getFinanceReport(_creds, _accessToken, _shopId, _options) {
    return null;
  },
};
