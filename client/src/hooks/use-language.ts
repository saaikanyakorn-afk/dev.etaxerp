import { useState, useEffect, useCallback } from "react";
import type { SupportedLanguage } from "@shared/i18n";
import { getAccountName } from "@shared/i18n";

export function useLanguage() {
  const [lang, setLang] = useState<SupportedLanguage>(
    () => (localStorage.getItem("app-language") as SupportedLanguage) || "th"
  );

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as SupportedLanguage;
      if (detail) setLang(detail);
    };
    window.addEventListener("language-change", handler);
    return () => window.removeEventListener("language-change", handler);
  }, []);

  const acctName = useCallback(
    (account: { name: string; nameTh?: string | null; nameZh?: string | null }) =>
      getAccountName(account, lang),
    [lang]
  );

  return { lang, acctName };
}
