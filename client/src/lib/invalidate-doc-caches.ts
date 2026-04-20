import type { QueryClient } from "@tanstack/react-query";

/**
 * Invalidate caches that are affected when any accounting document
 * (tax invoice, invoice, receipt, expense, purchase invoice, etc.) is
 * created/updated/deleted. Backend posts journal entries + stock movements
 * + dashboard aggregates from these docs, so the cross-cutting caches
 * must be invalidated too — not only the primary list cache.
 */
export function invalidateDocCaches(qc: QueryClient, primaryKeys: (string | string[])[] = []) {
  for (const k of primaryKeys) {
    qc.invalidateQueries({ queryKey: Array.isArray(k) ? k : [k] });
  }
  qc.invalidateQueries({ queryKey: ["/api/journal-entries"] });
  qc.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
  qc.invalidateQueries({ queryKey: ["/api/dashboard"] });
}
