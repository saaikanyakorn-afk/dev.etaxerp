import { useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";

export default function HrModuleRedirect() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const { data } = useQuery<{ modules: string[] }>({
    queryKey: ["/api/permissions/me", user?.id, "redirect-check"],
    queryFn: async () => {
      const r = await fetch("/api/permissions/me", { credentials: "include" });
      if (!r.ok) return { modules: [] };
      const d = await r.json();
      return { modules: Array.isArray(d) ? d : (d.modules || []) };
    },
    enabled: !!user,
    staleTime: 300_000,
  });

  useEffect(() => {
    if (!user || !data) return;
    const sessionKey = `hr-module-redirected-${user.id}`;
    if (sessionStorage.getItem(sessionKey)) return;
    const otherModules = (data.modules || []).filter((m: string) => m !== "hr");
    if (otherModules.length > 0) {
      sessionStorage.setItem(sessionKey, "1");
      setLocation("/module-select");
    }
  }, [user, data]);

  return null;
}
