import logoShopee from "@assets/F970CF53-2774-4A42-9D59-8930C2203BC1_1774716502545.png";
import logoLine from "@assets/EC38BA9F-C795-4046-8BB9-B4C76EADA1BD_1774716502547.png";
import logoLazada from "@assets/F35B9646-1693-4462-B498-E90BC1D6C463_1774716502548.png";
import logoTiktok from "@assets/DA95597F-099B-4F78-86D8-93B38970AB71_1774716502548.jpg";
import logoFacebook from "@assets/Face_b_1774716502550.jpg";
import logoInstagram from "@assets/md_5b37de3263964_1774716502551.jpg";
import logoAmazon from "@assets/Amazon_C_1774716502551.png";

export const PLATFORM_LOGOS: Record<string, string> = {
  shopee: logoShopee,
  lazada: logoLazada,
  tiktok: logoTiktok,
  "tiktok shop": logoTiktok,
  tiktok_shop: logoTiktok,
  amazon: logoAmazon,
  line: logoLine,
  "line shopping": logoLine,
  line_shopping: logoLine,
  facebook: logoFacebook,
  instagram: logoInstagram,
};

export const PLATFORM_COLORS: Record<string, string> = {
  shopee: "#EE4D2D",
  lazada: "#0F146D",
  tiktok: "#000000",
  "tiktok shop": "#000000",
  tiktok_shop: "#000000",
  amazon: "#232F3E",
  line: "#06C755",
  "line shopping": "#06C755",
  line_shopping: "#06C755",
  facebook: "#1877F2",
  instagram: "#E4405F",
};

export function getPlatformLogo(platform: string | null | undefined): string | undefined {
  if (!platform) return undefined;
  return PLATFORM_LOGOS[platform.toLowerCase()] || PLATFORM_LOGOS[platform.toLowerCase().replace(/\s+/g, "_")];
}

export function getPlatformColor(platform: string | null | undefined): string {
  if (!platform) return "#6B7280";
  return PLATFORM_COLORS[platform.toLowerCase()] || PLATFORM_COLORS[platform.toLowerCase().replace(/\s+/g, "_")] || "#6B7280";
}

export { logoShopee, logoLazada, logoTiktok, logoAmazon, logoLine, logoFacebook, logoInstagram };
