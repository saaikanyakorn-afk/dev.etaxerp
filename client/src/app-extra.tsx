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
 *
 * Strategy: use manual useLocation() path matching instead of wouter <Route> to avoid
 * differences between wouter <Route> outside <Switch> in dev vs production compiled bundle.
 * Extract id/token from the path string directly and pass as props — no useParams() needed.
 */

import { lazy, Suspense, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";

const CreditNotePdf = lazy(() => import("@/pages/sales/credit-note-pdf"));
const CreditNoteShare = lazy(() => import("@/pages/sales/credit-note-share"));
const WhtCertShare = lazy(() => import("@/pages/purchases/wht-cert-share"));
const BillingNoteShare = lazy(() => import("@/pages/finance/billing-note-share"));
// [sys-k7x9] Machines sub-page — route /sys-k7x9/infra/machines cannot be added to App.tsx
// (App.tsx = production source of truth, never modify). Registered here via matchInfraMachines().
const InfraMachines = lazy(() => import("@/pages/sysadmin/infra-machines"));
// [exchange-rate] /settings/exchange-rate — super_admin BOT API key management
// Cannot be added to App.tsx (production source of truth). Registered here.
const ExchangeRateSettings = lazy(() => import("@/pages/settings/exchange-rate-settings"));

function FullPageOverlay({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "white", zIndex: 9999, overflow: "auto" }}>
      {children}
    </div>
  );
}

/** Extract id from /sales/credit-note/pdf/:id (ignores query string) */
function matchCreditNotePdf(location: string): string | null {
  const m = location.replace(/\?.*$/, "").match(/^\/sales\/credit-note\/pdf\/([^/]+)$/);
  return m ? m[1] : null;
}

/** Extract token from /share/credit-note/:token (ignores query string) */
function matchCreditNoteShare(location: string): string | null {
  const m = location.replace(/\?.*$/, "").match(/^\/share\/credit-note\/([^/]+)$/);
  return m ? m[1] : null;
}

/** Extract token from /share/wht-cert/:token (ignores query string) */
function matchWhtCertShare(location: string): string | null {
  const m = location.replace(/\?.*$/, "").match(/^\/share\/wht-cert\/([^/]+)$/);
  return m ? m[1] : null;
}

/** Extract token from /share/billing-note/:token (ignores query string) */
function matchBillingNoteShare(location: string): string | null {
  const m = location.replace(/\?.*$/, "").match(/^\/share\/billing-note\/([^/]+)$/);
  return m ? m[1] : null;
}

// [sys-k7x9] Exact match for /sys-k7x9/infra/machines — no param needed, just presence check
function matchInfraMachines(location: string): boolean {
  return location.replace(/\?.*$/, "") === "/sys-k7x9/infra/machines";
}

// [exchange-rate] Exact match for /settings/exchange-rate
function matchExchangeRate(location: string): boolean {
  return location.replace(/\?.*$/, "") === "/settings/exchange-rate";
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

  const pdfId = matchCreditNotePdf(location);
  const shareToken = matchCreditNoteShare(location);
  const whtShareToken = matchWhtCertShare(location);
  const bnShareToken = matchBillingNoteShare(location);
  const isMachines = matchInfraMachines(location);
  const isExchangeRate = matchExchangeRate(location);

  if (pdfId) {
    return (
      <FullPageOverlay>
        <Suspense fallback={null}>
          <CreditNotePdf idProp={pdfId} />
        </Suspense>
      </FullPageOverlay>
    );
  }

  if (shareToken) {
    return (
      <FullPageOverlay>
        <Suspense fallback={null}>
          <CreditNoteShare tokenProp={shareToken} />
        </Suspense>
      </FullPageOverlay>
    );
  }

  if (whtShareToken) {
    return (
      <FullPageOverlay>
        <Suspense fallback={null}>
          <WhtCertShare tokenProp={whtShareToken} />
        </Suspense>
      </FullPageOverlay>
    );
  }

  if (bnShareToken) {
    return (
      <FullPageOverlay>
        <Suspense fallback={null}>
          <BillingNoteShare tokenProp={bnShareToken} />
        </Suspense>
      </FullPageOverlay>
    );
  }

  // [sys-k7x9] Render dedicated Machines page — InfraMachinesPage manages SysAdminLayout internally
  if (isMachines) {
    return (
      <FullPageOverlay>
        <Suspense fallback={null}>
          <InfraMachines />
        </Suspense>
      </FullPageOverlay>
    );
  }

  // [exchange-rate] Render exchange rate settings — ExchangeRateSettings manages Layout internally
  if (isExchangeRate) {
    return (
      <FullPageOverlay>
        <Suspense fallback={null}>
          <ExchangeRateSettings />
        </Suspense>
      </FullPageOverlay>
    );
  }

  return null;
}
