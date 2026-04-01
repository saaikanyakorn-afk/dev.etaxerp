import type {
  PlatformAdapter, PlatformCredentials, OAuthTokenResult, SyncOptions,
  SyncResult, PlatformOrder, PlatformReturn, PlatformCancellation,
  PlatformSettlement, PlatformLogistics, PlatformFinanceReport,
} from "./types";

function createManualAdapter(platform: string, displayName: string): PlatformAdapter {
  return {
    platform,
    displayName,
    supportsOAuth: false,
    supportsManualConnect: true,

    getAuthUrl() { return ""; },

    async exchangeToken(_creds, _code) {
      return {
        accessToken: "",
        refreshToken: "",
        expiresIn: 0,
      };
    },

    async refreshToken(_creds, _refreshTk) {
      return {
        accessToken: "",
        refreshToken: "",
        expiresIn: 0,
      };
    },

    async getOrders(_creds, _accessToken, _shopId, _options) {
      return { data: [], total: 0, hasMore: false };
    },

    async getReturns(_creds, _accessToken, _shopId, _options) {
      return { data: [], total: 0, hasMore: false };
    },

    async getCancellations(_creds, _accessToken, _shopId, _options) {
      return { data: [], total: 0, hasMore: false };
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
}

export const lineManAdapter = createManualAdapter("line_man", "LINE MAN");
export const robinhoodAdapter = createManualAdapter("robinhood", "Robinhood");
