import type { PlatformAdapter, PlatformCredentials } from "./types";
import { shopeeAdapter } from "./shopee";
import { lazadaAdapter } from "./lazada";
import { tiktokAdapter } from "./tiktok";
import { amazonAdapter } from "./amazon";
import { grabFoodAdapter } from "./grab-food";
import { lineManAdapter, robinhoodAdapter } from "./manual";

export type { PlatformAdapter, PlatformCredentials } from "./types";
export type {
  OAuthStartResult, OAuthTokenResult,
  PlatformOrder, PlatformOrderItem,
  PlatformReturn, PlatformReturnItem,
  PlatformCancellation,
  PlatformSettlement, PlatformSettlementItem,
  PlatformLogistics, LogisticsEvent,
  PlatformFinanceReport, FinanceBreakdownItem,
  SyncOptions, SyncResult,
} from "./types";

const adapters: Record<string, PlatformAdapter> = {
  shopee: shopeeAdapter,
  lazada: lazadaAdapter,
  tiktok: tiktokAdapter,
  amazon: amazonAdapter,
  grab_food: grabFoodAdapter,
  line_man: lineManAdapter,
  robinhood: robinhoodAdapter,
};

export function getAdapter(platform: string): PlatformAdapter | null {
  return adapters[platform] || null;
}

export function getAllAdapters(): PlatformAdapter[] {
  return Object.values(adapters);
}

export function getOAuthPlatforms(): PlatformAdapter[] {
  return Object.values(adapters).filter(a => a.supportsOAuth);
}

export function getManualPlatforms(): PlatformAdapter[] {
  return Object.values(adapters).filter(a => a.supportsManualConnect && !a.supportsOAuth);
}

export const PLATFORM_INFO: Record<string, { name: string; nameTh: string; color: string; oauthRequired: string[] }> = {
  shopee: {
    name: "Shopee",
    nameTh: "Shopee",
    color: "#EE4D2D",
    oauthRequired: ["Partner ID", "Partner Key"],
  },
  lazada: {
    name: "Lazada",
    nameTh: "Lazada",
    color: "#0F146D",
    oauthRequired: ["App Key", "App Secret"],
  },
  tiktok: {
    name: "TikTok Shop",
    nameTh: "TikTok Shop",
    color: "#000000",
    oauthRequired: ["App Key", "App Secret"],
  },
  amazon: {
    name: "Amazon",
    nameTh: "Amazon",
    color: "#FF9900",
    oauthRequired: ["App ID (LWA Client ID)", "App Secret (LWA Client Secret)"],
  },
  grab_food: {
    name: "Grab Food",
    nameTh: "Grab Food",
    color: "#00B14F",
    oauthRequired: [],
  },
  line_man: {
    name: "LINE MAN",
    nameTh: "LINE MAN",
    color: "#06C755",
    oauthRequired: [],
  },
  robinhood: {
    name: "Robinhood",
    nameTh: "Robinhood",
    color: "#7B2D8E",
    oauthRequired: [],
  },
};
