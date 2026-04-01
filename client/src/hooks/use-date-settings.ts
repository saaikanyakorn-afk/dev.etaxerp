import { createContext, useContext, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { createElement } from "react";

interface DateSettingsContextType {
  dateEra: string;
  dateFmt: string;
}

const DateSettingsContext = createContext<DateSettingsContextType>({
  dateEra: "BE",
  dateFmt: "DD/MM/YYYY",
});

export function DateSettingsProvider({ children }: { children: ReactNode }) {
  const { selectedCompanyId } = useCompany();

  const { data: docSettings } = useQuery<any>({
    queryKey: ["/api/document-settings", selectedCompanyId],
    queryFn: async () => {
      if (!selectedCompanyId) return null;
      const res = await fetch(`/api/document-settings?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!selectedCompanyId,
    staleTime: 5 * 60 * 1000,
  });

  const dateEra = docSettings?.dateEra || "BE";
  const dateFmt = docSettings?.dateFormat || "DD/MM/YYYY";

  return createElement(DateSettingsContext.Provider, { value: { dateEra, dateFmt } }, children);
}

export function useDateSettings() {
  return useContext(DateSettingsContext);
}
