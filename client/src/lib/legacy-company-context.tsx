import { createContext, useContext, useState, useEffect, useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

interface LegacyCompany {
  id: number;
  name: string;
  sourceId: string | null;
  importedAt: string;
  tableCount: number;
  totalRows: number;
}

interface LegacyCompanyContextValue {
  companies: LegacyCompany[];
  selectedId: number | null;
  setSelectedId: (id: number | null) => void;
  selectedCompany: LegacyCompany | null;
}

const LegacyCompanyContext = createContext<LegacyCompanyContextValue>({
  companies: [],
  selectedId: null,
  setSelectedId: () => {},
  selectedCompany: null,
});

export function LegacyCompanyProvider({ children }: { children: ReactNode }) {
  const [selectedId, setSelectedId] = useState<number | null>(() => {
    try {
      const stored = localStorage.getItem("legacy-selected-company");
      return stored ? parseInt(stored) : null;
    } catch { return null; }
  });

  const { data: companies = [] } = useQuery<LegacyCompany[]>({
    queryKey: ["/api/legacy-import/companies"],
    queryFn: async () => {
      const r = await fetch("/api/legacy-import/companies", { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
  });

  useEffect(() => {
    if (companies.length > 0 && (!selectedId || !companies.find(c => c.id === selectedId))) {
      setSelectedId(companies[0].id);
    }
  }, [companies, selectedId]);

  useEffect(() => {
    if (selectedId !== null) {
      try { localStorage.setItem("legacy-selected-company", String(selectedId)); } catch {}
    }
  }, [selectedId]);

  const selectedCompany = useMemo(() => companies.find(c => c.id === selectedId) || null, [companies, selectedId]);

  return (
    <LegacyCompanyContext.Provider value={{ companies, selectedId, setSelectedId, selectedCompany }}>
      {children}
    </LegacyCompanyContext.Provider>
  );
}

export function useLegacyCompany() {
  return useContext(LegacyCompanyContext);
}
