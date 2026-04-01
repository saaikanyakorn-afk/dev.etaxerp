import { useCallback } from "react";
import { useLanguage } from "./use-language";
import { getTranslation } from "@/i18n";

export function useTranslation() {
  const { lang, acctName } = useLanguage();

  const t = useCallback(
    (key: string) => getTranslation(lang, key),
    [lang]
  );

  return { t, lang, acctName };
}
