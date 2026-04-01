export type SupportedLanguage = "th" | "en" | "zh" | "zh-TW";

export const LANGUAGES: { key: SupportedLanguage; label: string; flag: string }[] = [
  { key: "th", label: "ไทย", flag: "🇹🇭" },
  { key: "en", label: "English", flag: "🇬🇧" },
  { key: "zh", label: "简体中文", flag: "🇨🇳" },
  { key: "zh-TW", label: "繁體中文", flag: "🇹🇼" },
];

export function getLocalizedField<T extends Record<string, any>>(
  obj: T,
  fieldBase: string,
  lang: SupportedLanguage
): string {
  if (lang === "th") {
    const thField = `${fieldBase}` as keyof T;
    return (obj[thField] as string) || "";
  }
  if (lang === "en") {
    const enField = `${fieldBase}En` as keyof T;
    return (obj[enField] as string) || (obj[fieldBase as keyof T] as string) || "";
  }
  if (lang === "zh" || lang === "zh-TW") {
    const zhField = `${fieldBase}Zh` as keyof T;
    return (obj[zhField] as string) || (obj[fieldBase as keyof T] as string) || "";
  }
  return (obj[fieldBase as keyof T] as string) || "";
}

export function getAccountName(
  account: { name: string; nameTh?: string | null; nameZh?: string | null },
  lang: SupportedLanguage
): string {
  if (lang === "en") return account.name;
  if (lang === "zh" || lang === "zh-TW") return account.nameZh || account.name;
  return account.nameTh || account.name;
}
