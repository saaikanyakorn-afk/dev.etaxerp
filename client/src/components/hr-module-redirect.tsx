/**
 * hr-module-redirect.tsx
 * Injected into attendance.tsx (not protected).
 * Uses /api/my-role-modules — queries user_sub_permissions directly,
 * bypassing the tenant subscription plan filter entirely.
 * If the employee has access to modules beyond HR → redirect to /module-select.
 */
import { useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";

export default function HrModuleRedirect() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const { data } = useQuery<{ modules: string[] }>({
    queryKey: ["/api/my-role-modules", user?.id],
    queryFn: async () => {
      const r = await fetch("/api/my-role-modules", { credentials: "include" });
      if (!r.ok) return { modules: [] };
      return r.json();
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!user || !data) return;
    const sessionKey = `hr-module-redirected-${(user as any).id}`;
    if (sessionStorage.getItem(sessionKey)) return;
    const nonHrModules = (data.modules || []).filter(
      (m: string) => m !== "hr" && m !== "settings"
    );
    if (nonHrModules.length > 0) {
      sessionStorage.setItem(sessionKey, "1");
      setLocation("/module-select");
    }
  }, [user, data, setLocation]);

  return null;
}
