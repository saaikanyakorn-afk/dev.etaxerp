/**
 * app-extra.tsx
 * Called AFTER App.tsx renders — same pattern as schema-extra.ts extends schema.ts.
 * Injected as a global guard inside the Router in App.tsx.
 * App.tsx on production = SOURCE OF TRUTH — never modify it on dev and push.
 * All new routes must be added here, not in App.tsx.
 *
 * Purpose 1: employees who land on /hr/attendance but have access to more than one
 * module (e.g. inventory) should see the module-select page instead of being
 * silently locked to HR.  module-select.tsx is protected so we intercept here.
 *
 * Purpose 2: New routes that cannot be added to App.tsx (production is source of truth)
 * are registered here — CreditNotePdf, CreditNoteShare.
 */

import { lazy, Suspense, useEffect } from "react";
import { Route, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";

const CreditNotePdf = lazy(() => import("@/pages/sales/credit-note-pdf"));
const CreditNoteShare = lazy(() => import("@/pages/sales/credit-note-share"));

export default function AppExtra() {
  const { user, loading } = useAuth();
  const [location, setLocation] = useLocation();

  const isEmployee =
    !loading &&
    user &&
    ((user as any).role === "employee" || (user as any).role === "cashier");

  const onAttendance =
    location === "/hr/attendance" ||
    location.startsWith("/hr/attendance?") ||
    location.startsWith("/hr/attendance/");

  // Only fire the query when an employee is on /hr/attendance
  const { data: roleData } = useQuery<{ modules: string[] }>({
    queryKey: ["/api/my-role-modules"],
    queryFn: async () => {
      const r = await fetch("/api/my-role-modules", { credentials: "include" });
      if (!r.ok) return { modules: [] };
      return r.json();
    },
    enabled: !!isEmployee && onAttendance,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!isEmployee || !onAttendance || !roleData) return;

    const flagKey = `app-extra-redirected-${(user as any).id}`;
    if (sessionStorage.getItem(flagKey)) return;

    // If user has access to more than just HR → show module selector
    const modules = roleData.modules ?? [];
    const nonHrModules = modules.filter((m: string) => m !== "hr" && m !== "settings");
    if (nonHrModules.length > 0) {
      sessionStorage.setItem(flagKey, "1");
      setLocation("/module-select");
    }
  }, [isEmployee, onAttendance, roleData, user, setLocation]);

  return (
    <Suspense fallback={null}>
      <Route path="/sales/credit-note/pdf/:id" component={CreditNotePdf} />
      <Route path="/share/credit-note/:token" component={CreditNoteShare} />
    </Suspense>
  );
}
