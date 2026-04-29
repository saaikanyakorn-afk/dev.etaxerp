import { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";

const STORAGE_KEY = "etax_selected_company";

interface CompanyContextType {
  companies: any[];
  selectedCompanyId: number | null;
  selectedCompany: any | null;
  setSelectedCompanyId: (id: number | null) => void;
  tenantType: string;
  isAccountingFirm: boolean;
  primaryCompanyId: number | null;
}

const CompanyContext = createContext<CompanyContextType>({
  companies: [],
  selectedCompanyId: null,
  selectedCompany: null,
  setSelectedCompanyId: () => {},
  tenantType: "accounting_firm",
  isAccountingFirm: true,
  primaryCompanyId: null,
});

function readSaved(): number | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v ? parseInt(v, 10) : null;
  } catch { return null; }
}

function writeSaved(id: number | null) {
  try {
    if (id != null) localStorage.setItem(STORAGE_KEY, String(id));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

function getUrlCompanyId(): number | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const v = params.get("companyId");
    return v ? parseInt(v, 10) : null;
  } catch { return null; }
}

function syncUrlCompanyId(id: number | null) {
  try {
    const url = new URL(window.location.href);
    if (id != null) {
      url.searchParams.set("companyId", String(id));
    } else {
      url.searchParams.delete("companyId");
    }
    window.history.replaceState({}, "", url.toString());
  } catch {}
}

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const prevUserRef = useRef<any>(undefined);
  const { data: companiesData, isFetched: companiesFetched } = useQuery<any[]>({
    queryKey: ["/api/companies"],
    queryFn: async () => {
      const r = await fetch("/api/companies", { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!user,
  });
  const companies = Array.isArray(companiesData) ? companiesData : [];

  const [selectedCompanyId, setRaw] = useState<number | null>(() => {
    const fromUrl = getUrlCompanyId();
    return fromUrl ?? readSaved();
  });
  const idRef = useRef(selectedCompanyId);

  const setSelectedCompanyId = useCallback((id: number | null) => {
    idRef.current = id;
    setRaw(id);
    writeSaved(id);
    syncUrlCompanyId(id);
  }, []);

  useEffect(() => {
    const wasLoggedIn = prevUserRef.current != null;
    prevUserRef.current = user;

    if (!user) {
      if (wasLoggedIn) {
        idRef.current = null;
        setRaw(null);
        writeSaved(null);
        syncUrlCompanyId(null);
      }
      return;
    }
    if (companies.length === 0) {
      if (!companiesFetched) return;
      if (idRef.current != null) {
        idRef.current = null;
        setRaw(null);
        syncUrlCompanyId(null);
      }
      return;
    }

    const cur = idRef.current;
    if (cur != null && companies.some(c => c.id === cur)) {
      syncUrlCompanyId(cur);
      return;
    }

    const fromUrl = getUrlCompanyId();
    if (fromUrl != null && companies.some(c => c.id === fromUrl)) {
      idRef.current = fromUrl;
      setRaw(fromUrl);
      writeSaved(fromUrl);
      syncUrlCompanyId(fromUrl);
      return;
    }

    const saved = readSaved();
    if (saved != null && companies.some(c => c.id === saved)) {
      idRef.current = saved;
      setRaw(saved);
      syncUrlCompanyId(saved);
      return;
    }

    if (user?.empCompanyId && companies.some(c => c.id === user.empCompanyId)) {
      idRef.current = user.empCompanyId;
      setRaw(user.empCompanyId);
      syncUrlCompanyId(user.empCompanyId);
      return;
    }

    const primary = companies.find(c => c.isPrimary);
    if (primary) {
      idRef.current = primary.id;
      setRaw(primary.id);
      syncUrlCompanyId(primary.id);
      return;
    }

    idRef.current = null;
    setRaw(null);
    syncUrlCompanyId(null);
  }, [user, companies, companiesFetched]);

  const selectedCompany = selectedCompanyId != null
    ? companies.find(c => c.id === selectedCompanyId) || null
    : null;
  const primaryCompany = companies.find(c => c.isPrimary);
  const tenantType = primaryCompany?.tenantType || "accounting_firm";
  const isAccountingFirm = tenantType === "accounting_firm";
  const primaryCompanyId = primaryCompany?.id ?? null;

  return (
    <CompanyContext.Provider value={{ companies, selectedCompanyId, selectedCompany, setSelectedCompanyId, tenantType, isAccountingFirm, primaryCompanyId }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  return useContext(CompanyContext);
}

export function useHrCompanyId(): number | null {
  const { selectedCompanyId } = useCompany();
  return selectedCompanyId;
}
