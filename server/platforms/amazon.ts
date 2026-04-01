import crypto from "crypto";
import type {
  PlatformAdapter, PlatformCredentials, OAuthTokenResult, SyncOptions,
  SyncResult, PlatformOrder, PlatformReturn, PlatformCancellation,
  PlatformSettlement, PlatformLogistics, PlatformFinanceReport,
} from "./types";

const AMAZON_AUTH_URL = "https://sellercentral.amazon.co.th/apps/authorize/consent";
const AMAZON_TOKEN_URL = "https://api.amazon.com/auth/o2/token";
const AMAZON_SP_API_URL = "https://sellingpartnerapi-fe.amazon.com";

function awsSign(secretKey: string, dateStamp: string, region: string, service: string): Buffer {
  const kDate = crypto.createHmac("sha256", `AWS4${secretKey}`).update(dateStamp).digest();
  const kRegion = crypto.createHmac("sha256", kDate).update(region).digest();
  const kService = crypto.createHmac("sha256", kRegion).update(service).digest();
  return crypto.createHmac("sha256", kService).update("aws4_request").digest();
}

function createSigV4Headers(
  method: string,
  host: string,
  path: string,
  queryString: string,
  accessToken: string,
  awsAccessKeyId: string,
  awsSecretKey: string,
  region: string = "us-west-2",
  service: string = "execute-api",
): Record<string, string> {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const dateStamp = amzDate.substring(0, 8);

  const canonicalHeaders = `host:${host}\nx-amz-access-token:${accessToken}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "host;x-amz-access-token;x-amz-date";

  const payloadHash = crypto.createHash("sha256").update("").digest("hex");
  const canonicalRequest = `${method}\n${path}\n${queryString}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${crypto.createHash("sha256").update(canonicalRequest).digest("hex")}`;

  const signingKey = awsSign(awsSecretKey, dateStamp, region, service);
  const signature = crypto.createHmac("sha256", signingKey).update(stringToSign).digest("hex");

  return {
    "x-amz-access-token": accessToken,
    "x-amz-date": amzDate,
    "Authorization": `AWS4-HMAC-SHA256 Credential=${awsAccessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    "Content-Type": "application/json",
  };
}

async function spApiRequest(path: string, creds: PlatformCredentials, accessToken: string, params: Record<string, string> = {}): Promise<any> {
  const query = new URLSearchParams(params);
  query.sort();
  const queryString = query.toString();
  const url = `${AMAZON_SP_API_URL}${path}${queryString ? "?" + queryString : ""}`;

  const host = new URL(AMAZON_SP_API_URL).host;
  const awsAccessKeyId = creds.extra?.awsAccessKeyId || "";
  const awsSecretKey = creds.extra?.awsSecretAccessKey || "";
  const region = creds.extra?.awsRegion || "us-west-2";

  let headers: Record<string, string>;
  if (awsAccessKeyId && awsSecretKey) {
    headers = createSigV4Headers("GET", host, path, queryString, accessToken, awsAccessKeyId, awsSecretKey, region);
  } else {
    headers = {
      "x-amz-access-token": accessToken,
      "Content-Type": "application/json",
    };
  }

  const res = await fetch(url, { headers });
  const data = await res.json();
  if (data.errors) throw new Error(`Amazon SP-API Error: ${JSON.stringify(data.errors)}`);
  return data;
}

export const amazonAdapter: PlatformAdapter = {
  platform: "amazon",
  displayName: "Amazon",
  supportsOAuth: true,
  supportsManualConnect: false,

  getAuthUrl(creds, state) {
    const redirectUrl = creds.redirectUrl || `${creds.extra?.baseUrl || ""}/api/ecommerce/oauth/amazon/callback`;
    const params = new URLSearchParams({
      application_id: creds.appId,
      state,
      redirect_uri: redirectUrl,
      version: "beta",
    });
    return `${AMAZON_AUTH_URL}?${params.toString()}`;
  },

  async exchangeToken(creds, code) {
    const res = await fetch(AMAZON_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: creds.appId,
        client_secret: creds.appSecret,
        redirect_uri: creds.redirectUrl || "",
      }).toString(),
    });
    const data = await res.json();
    if (data.error) throw new Error(`Amazon token error: ${data.error} - ${data.error_description || ""}`);

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in || 3600,
    };
  },

  async refreshToken(creds, refreshTk) {
    const res = await fetch(AMAZON_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshTk,
        client_id: creds.appId,
        client_secret: creds.appSecret,
      }).toString(),
    });
    const data = await res.json();
    if (data.error) throw new Error(`Amazon refresh error: ${data.error} - ${data.error_description || ""}`);

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshTk,
      expiresIn: data.expires_in || 3600,
    };
  },

  async getOrders(creds, accessToken, _shopId, options) {
    const params: Record<string, string> = {
      MarketplaceIds: creds.extra?.marketplaceId || "A2VIGQ35RCS4UG",
      MaxResultsPerPage: String(options.pageSize || 50),
      SortOrder: "DESC",
    };
    if (options.startDate) params.CreatedAfter = new Date(options.startDate).toISOString();
    if (options.endDate) params.CreatedBefore = new Date(options.endDate).toISOString();
    if (options.cursor) params.NextToken = options.cursor;

    const data = await spApiRequest("/orders/v0/orders", creds, accessToken, params);
    const orderList = data.payload?.Orders || [];

    const orders: PlatformOrder[] = orderList.map((o: any) => ({
      platformOrderId: o.AmazonOrderId || "",
      orderNo: o.AmazonOrderId || "",
      status: o.OrderStatus?.toLowerCase() || "unknown",
      buyerName: o.BuyerInfo?.BuyerName || "",
      buyerPhone: o.ShippingAddress?.Phone || "",
      buyerAddress: [o.ShippingAddress?.AddressLine1, o.ShippingAddress?.AddressLine2, o.ShippingAddress?.City, o.ShippingAddress?.PostalCode].filter(Boolean).join(", "),
      items: [],
      totalAmount: Number(o.OrderTotal?.Amount || 0),
      shippingFee: 0,
      platformDiscount: 0,
      sellerDiscount: 0,
      paymentMethod: o.PaymentMethod || "",
      orderDate: o.PurchaseDate || "",
      currency: o.OrderTotal?.CurrencyCode || "THB",
      raw: o,
    }));

    return {
      data: orders,
      total: orders.length,
      hasMore: !!data.payload?.NextToken,
      nextCursor: data.payload?.NextToken,
    };
  },

  async getReturns(creds, accessToken, _shopId, options) {
    const params: Record<string, string> = {
      MaxResultsPerPage: String(options.pageSize || 50),
    };
    if (options.cursor) params.NextToken = options.cursor;

    try {
      const data = await spApiRequest("/fba/returns/v0/returns", creds, accessToken, params);
      const returnList = data.payload?.returnItems || [];

      const returns: PlatformReturn[] = returnList.map((r: any) => ({
        platformReturnId: r.returnAuthorizationId || "",
        orderId: r.amazonOrderId || "",
        status: r.status?.toLowerCase() || "",
        reason: r.returnReason?.reasonCode || "",
        reasonDetail: r.returnReason?.reasonDescription || "",
        returnType: "return_refund" as const,
        refundAmount: Number(r.refundAmount?.Amount || 0),
        items: [{
          sku: r.sellerSKU || "",
          name: r.productName || "",
          quantity: Number(r.quantityReturned || 1),
          amount: Number(r.refundAmount?.Amount || 0),
        }],
        requestDate: r.returnRequestedDate || "",
        buyerName: "",
        raw: r,
      }));

      return {
        data: returns,
        total: returns.length,
        hasMore: !!data.payload?.NextToken,
        nextCursor: data.payload?.NextToken,
      };
    } catch { return { data: [], total: 0, hasMore: false }; }
  },

  async getCancellations(creds, accessToken, shopId, options) {
    const result = await this.getOrders(creds, accessToken, shopId, { ...options, status: "Canceled" });
    const cancellations: PlatformCancellation[] = result.data.map((o) => ({
      platformCancelId: o.platformOrderId,
      orderId: o.platformOrderId,
      orderNo: o.orderNo,
      reason: o.raw?.CancelReason || "Cancelled",
      cancelledBy: "platform" as const,
      cancelDate: o.raw?.LastUpdateDate || o.orderDate,
      refundAmount: o.totalAmount,
      status: "cancelled",
      buyerName: o.buyerName,
      raw: o.raw,
    }));
    return { data: cancellations, total: result.total, hasMore: result.hasMore, nextCursor: result.nextCursor };
  },

  async getSettlements(creds, accessToken, _shopId, options) {
    try {
      const params: Record<string, string> = {
        MaxResultsPerPage: String(options.pageSize || 10),
      };
      if (options.startDate) params.CreatedSince = new Date(options.startDate).toISOString();
      if (options.endDate) params.CreatedUntil = new Date(options.endDate).toISOString();

      const data = await spApiRequest("/finances/v0/financialEventGroups", creds, accessToken, params);
      const groups = data.payload?.FinancialEventGroupList || [];

      const settlements: PlatformSettlement[] = groups.map((g: any) => ({
        settlementId: g.FinancialEventGroupId || "",
        period: `${g.FinancialEventGroupStart || ""} - ${g.FinancialEventGroupEnd || ""}`,
        settlementDate: g.FundTransferDate || "",
        totalOrders: 0,
        grossSales: Number(g.OriginalTotal?.Amount || 0),
        totalCommission: 0,
        totalServiceFee: 0,
        totalPaymentFee: 0,
        totalShippingCost: 0,
        totalRefund: 0,
        totalOtherFees: 0,
        netAmount: Number(g.ConvertedTotal?.Amount || 0),
        currency: g.ConvertedTotal?.CurrencyCode || "THB",
        items: [],
        raw: g,
      }));

      return {
        data: settlements,
        total: settlements.length,
        hasMore: !!data.payload?.NextToken,
        nextCursor: data.payload?.NextToken,
      };
    } catch { return { data: [], total: 0, hasMore: false }; }
  },

  async getLogistics(creds, accessToken, _shopId, orderId) {
    try {
      const data = await spApiRequest(`/orders/v0/orders/${orderId}`, creds, accessToken);
      const order = data.payload;
      if (!order) return null;

      return {
        orderId,
        orderNo: orderId,
        trackingNo: "",
        logisticsProvider: order.FulfillmentChannel || "",
        status: order.OrderStatus || "",
        events: [],
        raw: order,
      };
    } catch { return null; }
  },

  async getFinanceReport(creds, accessToken, _shopId, options) {
    try {
      const params: Record<string, string> = {
        MaxResultsPerPage: "100",
      };
      if (options.startDate) params.PostedAfter = new Date(options.startDate).toISOString();
      if (options.endDate) params.PostedBefore = new Date(options.endDate).toISOString();

      const data = await spApiRequest("/finances/v0/financialEvents", creds, accessToken, params);
      const events = data.payload?.FinancialEvents || {};

      return {
        reportType: "financial_events",
        period: `${options.startDate || ""} - ${options.endDate || ""}`,
        totalSales: (events.ShipmentEventList || []).reduce((s: number, e: any) =>
          s + (e.ShipmentItemList || []).reduce((ss: number, i: any) =>
            ss + (i.ItemChargeList || []).reduce((sss: number, c: any) =>
              sss + Number(c.ChargeAmount?.Amount || 0), 0), 0), 0),
        totalFees: (events.ShipmentEventList || []).reduce((s: number, e: any) =>
          s + (e.ShipmentItemList || []).reduce((ss: number, i: any) =>
            ss + (i.ItemFeeList || []).reduce((sss: number, f: any) =>
              sss + Math.abs(Number(f.FeeAmount?.Amount || 0)), 0), 0), 0),
        totalRefunds: (events.RefundEventList || []).reduce((s: number, e: any) =>
          s + Math.abs(Number(e.RefundAmount?.Amount || 0)), 0),
        totalAdjustments: (events.AdjustmentEventList || []).reduce((s: number, e: any) =>
          s + Number(e.AdjustmentAmount?.Amount || 0), 0),
        netIncome: 0,
        breakdown: [],
        raw: events,
      };
    } catch { return null; }
  },
};
