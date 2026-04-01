export interface PlatformCredentials {
  appId: string;
  appSecret: string;
  redirectUrl?: string;
  region?: string;
  sandbox?: boolean;
  extra?: Record<string, any>;
}

export interface OAuthStartResult {
  authUrl: string;
  state: string;
}

export interface OAuthTokenResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  shopId?: string;
  shopName?: string;
  extra?: Record<string, any>;
}

export interface PlatformOrder {
  platformOrderId: string;
  orderNo: string;
  status: string;
  buyerName: string;
  buyerPhone?: string;
  buyerAddress?: string;
  shippingAddress?: string;
  items: PlatformOrderItem[];
  totalAmount: number;
  shippingFee: number;
  platformDiscount: number;
  sellerDiscount: number;
  paymentMethod?: string;
  orderDate: string;
  shipDate?: string;
  deliverDate?: string;
  trackingNo?: string;
  logisticsProvider?: string;
  currency: string;
  notes?: string;
  raw?: any;
}

export interface PlatformOrderItem {
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  variationName?: string;
  platformItemId?: string;
}

export interface PlatformReturn {
  platformReturnId: string;
  orderId: string;
  status: string;
  reason: string;
  reasonDetail?: string;
  returnType: "return" | "refund" | "return_refund";
  refundAmount: number;
  shippingCost?: number;
  items: PlatformReturnItem[];
  requestDate: string;
  resolvedDate?: string;
  trackingNo?: string;
  buyerName?: string;
  raw?: any;
}

export interface PlatformReturnItem {
  sku: string;
  name: string;
  quantity: number;
  amount: number;
  platformItemId?: string;
}

export interface PlatformSettlement {
  settlementId: string;
  period: string;
  settlementDate: string;
  totalOrders: number;
  grossSales: number;
  totalCommission: number;
  totalServiceFee: number;
  totalPaymentFee: number;
  totalShippingCost: number;
  totalRefund: number;
  totalOtherFees: number;
  netAmount: number;
  currency: string;
  items: PlatformSettlementItem[];
  raw?: any;
}

export interface PlatformSettlementItem {
  orderId: string;
  orderNo: string;
  grossAmount: number;
  commission: number;
  serviceFee: number;
  paymentFee: number;
  shippingCost: number;
  refundAmount: number;
  otherFees: number;
  netAmount: number;
  settledDate: string;
}

export interface PlatformLogistics {
  orderId: string;
  orderNo: string;
  trackingNo: string;
  logisticsProvider: string;
  status: string;
  statusDetail?: string;
  estimatedDelivery?: string;
  actualDelivery?: string;
  senderAddress?: string;
  receiverAddress?: string;
  events: LogisticsEvent[];
  raw?: any;
}

export interface LogisticsEvent {
  timestamp: string;
  status: string;
  description: string;
  location?: string;
}

export interface PlatformFinanceReport {
  reportType: string;
  period: string;
  totalSales: number;
  totalFees: number;
  totalRefunds: number;
  totalAdjustments: number;
  netIncome: number;
  breakdown: FinanceBreakdownItem[];
  raw?: any;
}

export interface FinanceBreakdownItem {
  category: string;
  description: string;
  amount: number;
  transactionCount: number;
}

export interface PlatformCancellation {
  platformCancelId: string;
  orderId: string;
  orderNo: string;
  reason: string;
  cancelledBy: "buyer" | "seller" | "platform" | "system";
  cancelDate: string;
  refundAmount: number;
  status: string;
  buyerName?: string;
  raw?: any;
}

export interface SyncOptions {
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
  status?: string;
  cursor?: string;
}

export interface SyncResult<T> {
  data: T[];
  total: number;
  hasMore: boolean;
  nextCursor?: string;
  nextPage?: number;
}

export interface PlatformAdapter {
  platform: string;
  displayName: string;
  supportsOAuth: boolean;
  supportsManualConnect: boolean;

  getAuthUrl(credentials: PlatformCredentials, state: string, shopId?: string): string;
  exchangeToken(credentials: PlatformCredentials, code: string, shopId?: string): Promise<OAuthTokenResult>;
  refreshToken(credentials: PlatformCredentials, refreshToken: string, shopId?: string): Promise<OAuthTokenResult>;

  getOrders(credentials: PlatformCredentials, accessToken: string, shopId: string, options: SyncOptions): Promise<SyncResult<PlatformOrder>>;
  getReturns(credentials: PlatformCredentials, accessToken: string, shopId: string, options: SyncOptions): Promise<SyncResult<PlatformReturn>>;
  getCancellations(credentials: PlatformCredentials, accessToken: string, shopId: string, options: SyncOptions): Promise<SyncResult<PlatformCancellation>>;
  getSettlements(credentials: PlatformCredentials, accessToken: string, shopId: string, options: SyncOptions): Promise<SyncResult<PlatformSettlement>>;
  getLogistics(credentials: PlatformCredentials, accessToken: string, shopId: string, orderId: string): Promise<PlatformLogistics | null>;
  getFinanceReport(credentials: PlatformCredentials, accessToken: string, shopId: string, options: SyncOptions): Promise<PlatformFinanceReport | null>;
}
