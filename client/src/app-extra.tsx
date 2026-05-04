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
 * Because AppExtra renders OUTSIDE the <Switch>, the Switch catch-all <Route component={NotFound}>
 * will also render for these paths. We work around this by rendering our pages in a
 * position:fixed full-screen overlay (z-index 9999) so they visually cover the NotFound page.
 */

import { lazy, Suspense, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";

const CreditNotePdf = lazy(() => import("@/pages/sales/credit-note-pdf"));
const CreditNoteShare = lazy(() => import("@/pages/sales/credit-note-share"));

function matchPath(pattern: string, location: string): Record<string, string> | null {
  const patternParts = pattern.split("/");
  const locationParts = location.split("?")[0].split("/");
  if (patternParts.length !== locationParts.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(":")) {
      params[patternParts[i].slice(1)] = locationParts[i];
    } else if (patternParts[i] !== locationParts[i]) {
      return null;
    }
  }
  return params;
}

function FullPageOverlay({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "white", zIndex: 9999, overflow: "auto" }}>
      {children}
    </div>
  );
}

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
    const modules = roleData.modules ?? [];
    const nonHrModules = modules.filter((m: string) => m !== "hr" && m !== "settings");
    if (nonHrModules.length > 0) {
      sessionStorage.setItem(flagKey, "1");
      setLocation("/module-select");
    }
  }, [isEmployee, onAttendance, roleData, user, setLocation]);

  const creditNotePdfMatch = matchPath("/sales/credit-note/pdf/:id", location);
  const creditNoteShareMatch = matchPath("/share/credit-note/:token", location);

  if (creditNotePdfMatch) {
    const { id } = creditNotePdfMatch;
    return (
      <FullPageOverlay>
        <Suspense fallback={null}>
          <CreditNotePdf key={id} />
        </Suspense>
      </FullPageOverlay>
    );
  }

  if (creditNoteShareMatch) {
    const { token } = creditNoteShareMatch;
    return (
      <FullPageOverlay>
        <Suspense fallback={null}>
          <CreditNoteShare key={token} />
        </Suspense>
      </FullPageOverlay>
    );
  }

  return null;
}
