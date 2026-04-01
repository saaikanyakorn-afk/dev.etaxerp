import { th, type TranslationKeys } from "./th";
import { en } from "./en";
import { zh } from "./zh";
import { zhTW } from "./zh-TW";
import type { SupportedLanguage } from "@shared/i18n";

const translations: Record<SupportedLanguage, TranslationKeys> = { th, en, zh, "zh-TW": zhTW };

type NestedKeyOf<T, Prefix extends string = ""> = T extends object
  ? { [K in keyof T & string]: NestedKeyOf<T[K], Prefix extends "" ? K : `${Prefix}.${K}`> }[keyof T & string]
  : Prefix;

export type TranslationKey = NestedKeyOf<TranslationKeys>;

function getNestedValue(obj: any, path: string): string | undefined {
  const val = path.split(".").reduce((acc, key) => acc?.[key], obj);
  return typeof val === "string" ? val : undefined;
}

export function getTranslation(lang: SupportedLanguage, key: string): string {
  return getNestedValue(translations[lang], key) ?? getNestedValue(translations.th, key) ?? key;
}

export { translations };
