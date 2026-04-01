interface CacheEntry {
  data: any;
  expiresAt: number;
  createdAt: number;
}

interface ReportTimingEntry {
  endpoint: string;
  companyId: number;
  executionMs: number;
  rowCount: number | null;
  cached: boolean;
  timestamp: string;
  params: Record<string, string | undefined>;
}

const timingLog: ReportTimingEntry[] = [];
const MAX_TIMING_LOG = 500;

export function logReportTiming(endpoint: string, companyId: number, executionMs: number, rowCount: number | null, cached: boolean, params: Record<string, string | undefined> = {}) {
  if (timingLog.length >= MAX_TIMING_LOG) timingLog.shift();
  timingLog.push({
    endpoint,
    companyId,
    executionMs: Math.round(executionMs * 100) / 100,
    rowCount,
    cached,
    timestamp: new Date().toISOString(),
    params,
  });
  const tag = cached ? "[CACHE]" : executionMs > 1000 ? "[SLOW]" : "[OK]";
  console.log(`${tag} ${endpoint} companyId=${companyId} ${executionMs.toFixed(1)}ms rows=${rowCount ?? "?"}`);
}

export function getTimingLog() { return [...timingLog]; }

export function getTimingSummary() {
  const byEndpoint = new Map<string, { count: number; totalMs: number; maxMs: number; minMs: number; avgMs: number; cachedCount: number }>();
  for (const entry of timingLog) {
    if (entry.cached) {
      const existing = byEndpoint.get(entry.endpoint);
      if (existing) existing.cachedCount++;
      else byEndpoint.set(entry.endpoint, { count: 0, totalMs: 0, maxMs: 0, minMs: Infinity, avgMs: 0, cachedCount: 1 });
      continue;
    }
    const existing = byEndpoint.get(entry.endpoint);
    if (existing) {
      existing.count++;
      existing.totalMs += entry.executionMs;
      existing.maxMs = Math.max(existing.maxMs, entry.executionMs);
      existing.minMs = Math.min(existing.minMs, entry.executionMs);
      existing.avgMs = existing.totalMs / existing.count;
    } else {
      byEndpoint.set(entry.endpoint, { count: 1, totalMs: entry.executionMs, maxMs: entry.executionMs, minMs: entry.executionMs, avgMs: entry.executionMs, cachedCount: 0 });
    }
  }
  return Object.fromEntries(
    Array.from(byEndpoint.entries())
      .sort((a, b) => b[1].maxMs - a[1].maxMs)
      .map(([k, v]) => [k, { ...v, avgMs: Math.round(v.avgMs * 100) / 100, minMs: v.minMs === Infinity ? 0 : v.minMs }])
  );
}

export function clearTimingLog() { timingLog.length = 0; }

const cache = new Map<string, CacheEntry>();
const DEFAULT_TTL_MS = 5 * 60 * 1000;
const MAX_CACHE_SIZE = 200;

function buildKey(reportType: string, companyId: number, params: Record<string, string | undefined>): string {
  const sortedParams = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  return `${reportType}:${companyId}:${sortedParams}`;
}

function evictOldest() {
  if (cache.size <= MAX_CACHE_SIZE) return;
  let oldestKey: string | null = null;
  let oldestTime = Infinity;
  const entries = Array.from(cache.entries());
  for (const [key, entry] of entries) {
    if (entry.createdAt < oldestTime) {
      oldestTime = entry.createdAt;
      oldestKey = key;
    }
  }
  if (oldestKey) cache.delete(oldestKey);
}

export function getCachedReport(reportType: string, companyId: number, params: Record<string, string | undefined>): any | null {
  const key = buildKey(reportType, companyId, params);
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

export function setCachedReport(reportType: string, companyId: number, params: Record<string, string | undefined>, data: any, ttlMs: number = DEFAULT_TTL_MS) {
  const key = buildKey(reportType, companyId, params);
  evictOldest();
  cache.set(key, {
    data,
    expiresAt: Date.now() + ttlMs,
    createdAt: Date.now(),
  });
}

export function invalidateCompanyReports(companyId: number) {
  const prefix = `:${companyId}:`;
  const keys = Array.from(cache.keys());
  for (const key of keys) {
    if (key.includes(prefix)) {
      cache.delete(key);
    }
  }
}

export function invalidateAllReports() {
  cache.clear();
}

export function getCacheStats() {
  let validCount = 0;
  let expiredCount = 0;
  const now = Date.now();
  const values = Array.from(cache.values());
  for (const entry of values) {
    if (now > entry.expiresAt) expiredCount++;
    else validCount++;
  }
  return { total: cache.size, valid: validCount, expired: expiredCount };
}
