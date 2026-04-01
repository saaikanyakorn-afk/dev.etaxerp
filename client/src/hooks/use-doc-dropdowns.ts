import { useQuery } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { useLanguage } from "@/hooks/use-language";

export function useDocDropdowns() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;

  const { data: employeeNames = [] } = useQuery<{ id: number; name: string; position: string }[]>({
    queryKey: ["/api/employee-names", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const res = await fetch(`/api/employee-names?companyId=${companyId}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: departmentList = [] } = useQuery<{ id: number; name: string }[]>({
    queryKey: ["/api/departments", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const res = await fetch(`/api/departments?companyId=${companyId}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: branchList = [] } = useQuery<{ id: number; code: string; name: string; address?: string }[]>({
    queryKey: ["/api/branches", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const res = await fetch(`/api/branches?companyId=${companyId}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
  });

  const { acctName } = useLanguage();

  return { employeeNames, departmentList, branchList, acctName };
}
