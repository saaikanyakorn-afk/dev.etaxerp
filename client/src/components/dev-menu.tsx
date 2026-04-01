import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Database, CheckCircle2, XCircle, Loader2, AlertTriangle, HardDriveDownload, GitBranch, RefreshCw, ArrowDownToLine, Monitor, Cloud, CloudDownload } from "lucide-react";

interface DbStatus {
  devMode: boolean;
  target: "usa" | "thailand";
  label: string;
  connected: boolean;
  dbName: string;
  dbHost: string;
  testDbConfigured: boolean;
  testDbOnline: boolean;
}

interface GitVersionInfo {
  branch: string;
  hash: string;
  fullHash?: string;
  date: string;
  message: string;
}

interface GitStatus {
  local: GitVersionInfo;
  remote: GitVersionInfo | null;
  behind: number;
  hasRemote: boolean;
  upToDate: boolean;
}

const DB_SWITCH_SIGNAL = "etax-db-switched";
const BAR_HEIGHT = 32;

function formatThaiDate(dateStr: string): string {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    const day = d.getDate();
    const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
    const month = months[d.getMonth()];
    const year = d.getFullYear() + 543;
    const hours = String(d.getHours()).padStart(2, "0");
    const mins = String(d.getMinutes()).padStart(2, "0");
    return `${day} ${month} ${year} ${hours}:${mins}`;
  } catch {
    return dateStr.slice(0, 16);
  }
}

function daysBetween(dateStr1: string, dateStr2: string): number {
  try {
    const d1 = new Date(dateStr1);
    const d2 = new Date(dateStr2);
    return Math.floor(Math.abs(d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
  } catch { return 0; }
}

function GitStatusPanel({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [pulling, setPulling] = useState(false);
  const [pullResult, setPullResult] = useState<{ success: boolean; message?: string } | null>(null);

  const { data: gitStatus, isLoading, refetch } = useQuery<GitStatus>({
    queryKey: ["/api/dev/git-status"],
    queryFn: async () => {
      const res = await fetch("/api/dev/git-status");
      if (!res.ok) throw new Error("ไม่สามารถตรวจสอบเวอร์ชันได้");
      return res.json();
    },
    retry: false,
  });

  const handlePull = useCallback(async () => {
    if (pulling) return;
    setPulling(true);
    setPullResult(null);
    try {
      const res = await fetch("/api/dev/git-pull", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) {
        setPullResult({ success: true, message: `อัปเดตสำเร็จ — ${data.newVersion?.hash || ""}` });
        queryClient.invalidateQueries({ queryKey: ["/api/dev/git-status"] });
        queryClient.invalidateQueries({ queryKey: ["/api/version"] });
      } else {
        setPullResult({ success: false, message: data.message || "เกิดข้อผิดพลาด" });
      }
    } catch (err: any) {
      setPullResult({ success: false, message: err.message || "ไม่สามารถเชื่อมต่อ GitHub ได้" });
    } finally {
      setPulling(false);
    }
  }, [pulling, queryClient]);

  const behind = gitStatus?.behind || 0;
  const isUpToDate = gitStatus?.upToDate;
  const daysOld = gitStatus?.local && gitStatus?.remote ? daysBetween(gitStatus.local.date, gitStatus.remote.date) : 0;

  return (
    <div className="fixed inset-0 z-[10000] bg-black/50 flex items-center justify-center" data-testid="git-status-dialog">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden">
        <div className="bg-slate-800 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GitBranch className="h-5 w-5" />
            <h3 className="text-lg font-bold">เวอร์ชันโค้ด</h3>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white text-xl leading-none cursor-pointer" data-testid="btn-git-close">&times;</button>
        </div>

        {isLoading ? (
          <div className="p-8 flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            <p className="text-sm text-gray-500">กำลังตรวจสอบ GitHub...</p>
          </div>
        ) : !gitStatus ? (
          <div className="p-8 text-center">
            <XCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
            <p className="text-sm text-gray-600">ไม่สามารถตรวจสอบเวอร์ชันได้</p>
          </div>
        ) : (
          <div className="p-6">
            {isUpToDate ? (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-5 flex items-center gap-3" data-testid="git-status-uptodate">
                <CheckCircle2 className="h-6 w-6 text-green-500 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-green-800">เวอร์ชันเดียวกัน</p>
                  <p className="text-sm text-green-600">โค้ดบนเครื่องตรงกับ GitHub แล้ว</p>
                </div>
              </div>
            ) : !gitStatus.hasRemote ? (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-5 flex items-center gap-3" data-testid="git-status-no-remote">
                <AlertTriangle className="h-6 w-6 text-gray-400 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-gray-700">ไม่พบ GitHub Remote</p>
                  <p className="text-sm text-gray-500">ไม่สามารถเชื่อมต่อ GitHub ได้ ตรวจสอบ internet</p>
                </div>
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5 flex items-center gap-3" data-testid="git-status-behind">
                <AlertTriangle className="h-6 w-6 text-amber-500 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-amber-800">โค้ดบนเครื่องเก่ากว่า</p>
                  <p className="text-sm text-amber-600">
                    ห่าง {behind} commit{behind > 1 ? "s" : ""}{daysOld > 0 ? ` (${daysOld} วัน)` : ""}
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 mb-5">
              <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                <div className="flex items-center gap-2 mb-3">
                  <Monitor className="h-4 w-4 text-blue-500" />
                  <span className="font-semibold text-sm text-gray-700">เครื่องของฉัน</span>
                </div>
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="text-gray-400 text-xs">Branch:</span>
                    <p className="font-medium text-gray-800" data-testid="git-local-branch">{gitStatus.local.branch}</p>
                  </div>
                  <div>
                    <span className="text-gray-400 text-xs">วันที่อัปเดต:</span>
                    <p className="font-semibold text-gray-900 text-base" data-testid="git-local-date">{formatThaiDate(gitStatus.local.date)}</p>
                  </div>
                  <div>
                    <span className="text-gray-400 text-xs">รายละเอียดการแก้ไข:</span>
                    <p className="text-sm text-gray-700 bg-white border border-gray-100 rounded-lg px-3 py-2 mt-1 min-h-[48px]" data-testid="git-local-message">{gitStatus.local.message || "-"}</p>
                  </div>
                  <div>
                    <span className="text-gray-400 text-xs">รหัส:</span>
                    <span className="font-mono text-[11px] text-gray-400 ml-1" data-testid="git-local-hash">{gitStatus.local.hash}</span>
                  </div>
                </div>
              </div>

              <div className="border border-gray-200 rounded-xl p-4 bg-blue-50/50">
                <div className="flex items-center gap-2 mb-3">
                  <Cloud className="h-4 w-4 text-cyan-500" />
                  <span className="font-semibold text-sm text-gray-700">GitHub (ล่าสุด)</span>
                </div>
                {gitStatus.remote ? (
                  <div className="space-y-3 text-sm">
                    <div>
                      <span className="text-gray-400 text-xs">Branch:</span>
                      <p className="font-medium text-gray-800" data-testid="git-remote-branch">{gitStatus.remote.branch}</p>
                    </div>
                    <div>
                      <span className="text-gray-400 text-xs">วันที่อัปเดต:</span>
                      <p className="font-semibold text-gray-900 text-base" data-testid="git-remote-date">{formatThaiDate(gitStatus.remote.date)}</p>
                    </div>
                    <div>
                      <span className="text-gray-400 text-xs">รายละเอียดการแก้ไข:</span>
                      <p className="text-sm text-gray-700 bg-white border border-gray-100 rounded-lg px-3 py-2 mt-1 min-h-[48px]" data-testid="git-remote-message">{gitStatus.remote.message || "-"}</p>
                    </div>
                    <div>
                      <span className="text-gray-400 text-xs">รหัส:</span>
                      <span className="font-mono text-[11px] text-gray-400 ml-1" data-testid="git-remote-hash">{gitStatus.remote.hash}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic">ไม่สามารถดึงข้อมูลได้</p>
                )}
              </div>
            </div>

            {pullResult && (
              <div className={`rounded-lg p-3 mb-4 text-sm ${pullResult.success ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-700"}`} data-testid="git-pull-result">
                {pullResult.success ? <CheckCircle2 className="h-4 w-4 inline mr-1" /> : <XCircle className="h-4 w-4 inline mr-1" />}
                {pullResult.message}
                {pullResult.success && <span className="block text-xs mt-1 opacity-70">รีเฟรชหน้าเพื่อใช้เวอร์ชันใหม่</span>}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer transition-all"
                data-testid="btn-git-keep"
              >
                ใช้เวอร์ชันปัจจุบัน
              </button>
              {gitStatus.hasRemote && !isUpToDate && (
                <button
                  onClick={handlePull}
                  disabled={pulling}
                  className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2 cursor-pointer transition-all"
                  data-testid="btn-git-update"
                >
                  {pulling ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> กำลังอัปเดต...</>
                  ) : (
                    <><ArrowDownToLine className="h-4 w-4" /> อัปเดตเป็นเวอร์ชันล่าสุด</>
                  )}
                </button>
              )}
              <button
                onClick={() => refetch()}
                className="px-3 py-2.5 border border-gray-300 rounded-xl text-gray-500 hover:bg-gray-50 cursor-pointer transition-all"
                title="ตรวจสอบอีกครั้ง"
                data-testid="btn-git-refresh"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface SyncComparison {
  table: string;
  devCount: number; devMaxId: number;
  prodCount: number; prodMaxId: number;
  diff: number;
}

interface SyncTableResult {
  table: string;
  devCount: number;
  prodCount: number;
  newRows: number;
  status: string;
  error?: string;
}

interface SyncProgressData {
  status: "idle" | "running" | "complete" | "error";
  currentTable: string;
  tables: SyncTableResult[];
  error?: string;
  startedAt?: number;
}

const TABLE_LABELS: Record<string, string> = {
  tenants: "Tenants (ผู้เช่า)",
  users: "Users (ผู้ใช้)",
  companies: "Companies (บริษัท)",
  contacts: "Contacts (ผู้ติดต่อ)",
  firm_clients: "Firm Clients (ลูกค้าสำนักงาน)",
  branches: "Branches (สาขา)",
  employees: "Employees (พนักงาน)",
  attendance_records: "Attendance (ลงเวลา)",
  leave_requests: "Leave Requests (ลาหยุด)",
  ot_records: "OT Records (ล่วงเวลา)",
  payroll_records: "Payroll (เงินเดือน)",
  journal_entries: "Journal Entries (สมุดบัญชี)",
  journal_lines: "Journal Lines (รายการบัญชี)",
  accounts: "Accounts (ผังบัญชี)",
  accounting_formulas: "Formulas (สูตรบัญชี)",
  accounting_formula_lines: "Formula Lines (รายการสูตร)",
  payment_methods: "Payment Methods (วิธีชำระ)",
  products: "Products (สินค้า)",
  work_schedules: "Work Schedules (ตารางงาน)",
  work_locations: "Work Locations (สถานที่)",
  ot_settings: "OT Settings (ตั้งค่า OT)",
  holidays: "Holidays (วันหยุด)",
  departments: "Departments (แผนก)",
  general_settings: "General Settings (ตั้งค่าทั่วไป)",
  document_settings: "Document Settings (ตั้งค่าเอกสาร)",
  vat_product_dictionary: "VAT Dictionary (พจนานุกรม VAT)",
  ecommerce_connections: "E-Commerce Connections",
  ecommerce_orders: "E-Commerce Orders",
  subscription_plans: "Subscription Plans",
};

function SyncPanel({ onClose }: { onClose: () => void }) {
  const [comparing, setComparing] = useState(false);
  const [comparison, setComparison] = useState<SyncComparison[] | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());
  const [elapsed, setElapsed] = useState(0);

  const { data: syncProgress, refetch: refetchProgress } = useQuery<SyncProgressData>({
    queryKey: ["/api/dev/sync-progress"],
    queryFn: async () => {
      const res = await fetch("/api/dev/sync-progress");
      return res.json();
    },
    refetchInterval: syncing ? 2000 : false,
  });

  useEffect(() => {
    if (syncProgress?.status === "running" && !syncing) setSyncing(true);
    if (syncProgress && syncProgress.status !== "running" && syncing) setSyncing(false);
  }, [syncProgress, syncing]);

  useEffect(() => {
    if (!syncing) { setElapsed(0); return; }
    const t = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [syncing]);

  const loadComparison = useCallback(async () => {
    setComparing(true);
    setConfigError(null);
    try {
      const res = await fetch("/api/dev/sync-compare", { credentials: "include" });
      const data = await res.json();
      if (!res.ok || data.configured === false) {
        setConfigError(data.message || "ไม่สามารถเปรียบเทียบได้");
        return;
      }
      setComparison(data.comparison);
      const withDiff = (data.comparison as SyncComparison[]).filter(c => c.diff > 0).map(c => c.table);
      setSelectedTables(new Set(withDiff));
    } catch (err: any) {
      setConfigError(err.message);
    } finally {
      setComparing(false);
    }
  }, []);

  useEffect(() => { loadComparison(); }, [loadComparison]);

  const handleSync = useCallback(async () => {
    if (syncing || selectedTables.size === 0) return;
    setSyncing(true);
    setElapsed(0);
    try {
      await fetch("/api/dev/sync-from-prod", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ tables: Array.from(selectedTables) }),
      });
    } catch {
      setSyncing(false);
    }
  }, [syncing, selectedTables]);

  const toggleTable = (t: string) => {
    setSelectedTables(prev => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t); else next.add(t);
      return next;
    });
  };

  const selectAll = () => {
    if (comparison) setSelectedTables(new Set(comparison.filter(c => c.diff > 0).map(c => c.table)));
  };
  const selectNone = () => setSelectedTables(new Set());

  const isComplete = syncProgress?.status === "complete";
  const isError = syncProgress?.status === "error";

  return (
    <div className="fixed inset-0 z-[10000] bg-black/50 flex items-center justify-center" data-testid="sync-dialog">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 overflow-hidden max-h-[90vh] flex flex-col">
        <div className="bg-emerald-700 text-white px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <CloudDownload className="h-5 w-5" />
            <h3 className="text-lg font-bold">Sync จาก Production</h3>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white text-xl leading-none cursor-pointer" data-testid="btn-sync-close">&times;</button>
        </div>

        <div className="overflow-y-auto flex-1 p-6">
          {configError ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
              <XCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
              <p className="text-sm text-red-700 font-medium">{configError}</p>
              <p className="text-xs text-red-500 mt-2">ตั้งค่า PRODUCTION_APP_URL และ SYNC_API_KEY ใน Secrets</p>
            </div>
          ) : comparing ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
              <p className="text-sm text-gray-500">กำลังเปรียบเทียบข้อมูล Dev ↔ Production...</p>
            </div>
          ) : syncing ? (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-600 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-emerald-800">กำลัง Sync...</p>
                  <p className="text-sm text-emerald-600">
                    {syncProgress?.currentTable && `ตาราง: ${TABLE_LABELS[syncProgress.currentTable] || syncProgress.currentTable}`}
                    {` (${elapsed}s)`}
                  </p>
                </div>
              </div>
              {syncProgress?.tables && syncProgress.tables.length > 0 && (
                <div className="space-y-1">
                  {syncProgress.tables.map(t => (
                    <div key={t.table} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${
                      t.status === "error" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
                    }`}>
                      {t.status === "error" ? <XCircle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                      <span className="font-medium">{TABLE_LABELS[t.table] || t.table}</span>
                      <span className="text-xs opacity-70 ml-auto">
                        {t.status === "error" ? t.error : `+${t.newRows} rows`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : isComplete || isError ? (
            <div className="space-y-4">
              <div className={`rounded-xl p-4 flex items-center gap-3 ${isComplete ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
                {isComplete ? <CheckCircle2 className="h-6 w-6 text-green-500" /> : <XCircle className="h-6 w-6 text-red-500" />}
                <div>
                  <p className={`font-semibold ${isComplete ? "text-green-800" : "text-red-800"}`}>
                    {isComplete ? "Sync เสร็จสมบูรณ์!" : "Sync ผิดพลาด"}
                  </p>
                  {syncProgress?.error && <p className="text-sm text-red-600">{syncProgress.error}</p>}
                </div>
              </div>
              {syncProgress?.tables && syncProgress.tables.length > 0 && (
                <div className="space-y-1 max-h-60 overflow-y-auto">
                  {syncProgress.tables.map(t => (
                    <div key={t.table} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${
                      t.status === "error" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
                    }`}>
                      {t.status === "error" ? <XCircle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                      <span className="font-medium">{TABLE_LABELS[t.table] || t.table}</span>
                      <span className="text-xs opacity-70 ml-auto">
                        {t.status === "error" ? t.error : `+${t.newRows} rows`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={() => { loadComparison(); }}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer"
                data-testid="btn-sync-reload"
              >
                <RefreshCw className="h-4 w-4 inline mr-2" />เปรียบเทียบอีกครั้ง
              </button>
            </div>
          ) : comparison ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-sm">
                <span className="text-gray-500">เลือกตาราง:</span>
                <button onClick={selectAll} className="text-emerald-600 hover:underline cursor-pointer text-xs" data-testid="btn-sync-select-all">เลือกที่ต่างกัน</button>
                <button onClick={selectNone} className="text-gray-400 hover:underline cursor-pointer text-xs" data-testid="btn-sync-select-none">ไม่เลือก</button>
                <span className="ml-auto text-xs text-gray-400">เลือก {selectedTables.size} ตาราง</span>
              </div>

              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left text-xs text-gray-500">
                      <th className="px-3 py-2 w-8"></th>
                      <th className="px-3 py-2">ตาราง</th>
                      <th className="px-3 py-2 text-right">Dev</th>
                      <th className="px-3 py-2 text-right">Prod</th>
                      <th className="px-3 py-2 text-right">ต่าง</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparison.map(c => {
                      const hasDiff = c.diff > 0;
                      return (
                        <tr
                          key={c.table}
                          className={`border-t border-gray-100 ${hasDiff ? "hover:bg-emerald-50/50" : "opacity-50"} ${selectedTables.has(c.table) ? "bg-emerald-50/30" : ""}`}
                          onClick={() => hasDiff && toggleTable(c.table)}
                          style={{ cursor: hasDiff ? "pointer" : "default" }}
                        >
                          <td className="px-3 py-1.5">
                            {hasDiff && (
                              <input
                                type="checkbox"
                                checked={selectedTables.has(c.table)}
                                onChange={() => toggleTable(c.table)}
                                className="accent-emerald-600"
                                data-testid={`sync-check-${c.table}`}
                              />
                            )}
                          </td>
                          <td className="px-3 py-1.5 font-medium text-gray-700">
                            {TABLE_LABELS[c.table] || c.table}
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono text-xs">{c.devCount >= 0 ? c.devCount.toLocaleString() : "—"}</td>
                          <td className="px-3 py-1.5 text-right font-mono text-xs">{c.prodCount >= 0 ? c.prodCount.toLocaleString() : "—"}</td>
                          <td className={`px-3 py-1.5 text-right font-mono text-xs font-bold ${hasDiff ? "text-emerald-600" : "text-gray-300"}`}>
                            {c.diff > 0 ? `+${c.diff.toLocaleString()}` : c.diff === 0 ? "=" : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer transition-all"
            data-testid="btn-sync-cancel"
          >
            ปิด
          </button>
          {comparison && !syncing && !isComplete && !isError && (
            <button
              onClick={handleSync}
              disabled={selectedTables.size === 0}
              className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2 cursor-pointer transition-all"
              data-testid="btn-sync-start"
            >
              <CloudDownload className="h-4 w-4" />
              Sync {selectedTables.size} ตาราง
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const IS_PROD = import.meta.env.PROD;

export default function DevMenu() {
  const [switching, setSwitching] = useState(false);
  const [showGitStatus, setShowGitStatus] = useState(false);
  const [showSyncPanel, setShowSyncPanel] = useState(false);

  const { data: status, isError } = useQuery<DbStatus>({
    queryKey: ["/api/dev/db-status"],
    queryFn: async () => {
      const res = await fetch("/api/dev/db-status");
      if (!res.ok) throw new Error("Not available");
      return res.json();
    },
    retry: false,
    staleTime: 300_000,
    refetchInterval: IS_PROD ? false : 300_000,
    refetchOnWindowFocus: false,
    enabled: !IS_PROD,
  });

  const { data: ver } = useQuery<{ shortHash: string; date: string; message: string }>({
    queryKey: ["/api/version"],
    queryFn: async () => {
      const res = await fetch("/api/version");
      if (!res.ok) return { shortHash: "?", date: "", message: "" };
      return res.json();
    },
    staleTime: Infinity,
  });

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === DB_SWITCH_SIGNAL) window.location.href = "/landing";
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  useEffect(() => {
    const channel = new BroadcastChannel(DB_SWITCH_SIGNAL);
    const handler = () => { window.location.href = "/landing"; };
    channel.addEventListener("message", handler);
    return () => { channel.removeEventListener("message", handler); channel.close(); };
  }, []);

  useEffect(() => {
    if (!isError && status?.devMode) {
      document.documentElement.style.setProperty("--dev-bar-h", `${BAR_HEIGHT}px`);
    } else {
      document.documentElement.style.setProperty("--dev-bar-h", "0px");
    }
    return () => { document.documentElement.style.setProperty("--dev-bar-h", "0px"); };
  }, [status, isError]);

  const handleSwitch = useCallback(async (target: "usa" | "thailand") => {
    if (switching) return;
    setSwitching(true);
    try {
      const res = await fetch("/api/dev/switch-db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ target }),
      });
      const data = await res.json();
      if (res.ok) {
        notifyDbSwitch();
        setTimeout(() => { window.location.href = "/landing"; }, 1000);
      } else {
        alert(data.message || "ไม่สามารถสลับฐานข้อมูลได้");
        setSwitching(false);
      }
    } catch {
      setSwitching(false);
      alert("เกิดข้อผิดพลาดในการสลับฐานข้อมูล");
    }
  }, [switching]);

  if (isError || !status?.devMode) return null;

  const isUsa = status.target === "usa";
  const canSwitchToTh = status.testDbConfigured && status.testDbOnline;
  const oppositeTarget = isUsa ? "thailand" : "usa";
  const oppositeLabel = isUsa ? "TH" : "USA";

  return (
    <>
      <div
        className={`fixed top-0 left-0 right-0 ${
          isUsa
            ? "bg-blue-600"
            : "bg-amber-500"
        } text-white px-3 flex items-center gap-2 text-xs shadow-md z-[9999] print:hidden select-none`}
        style={{ height: `${BAR_HEIGHT}px` }}
        data-testid="dev-db-indicator"
      >
        <Database className="h-3.5 w-3.5 flex-shrink-0" />
        <span className="font-bold tracking-wide">DEV</span>
        <span className="mx-0.5 opacity-40">|</span>

        {status.connected ? (
          <CheckCircle2 className="h-3 w-3 text-green-300 flex-shrink-0" />
        ) : (
          <XCircle className="h-3 w-3 text-red-300 flex-shrink-0" />
        )}
        <span className="font-medium">
          {isUsa ? "ฐานข้อมูล: USA (หลัก)" : "ฐานข้อมูล: TH (ทดสอบ)"}
        </span>
        {status.dbName && (
          <span className="opacity-50 hidden sm:inline">[{status.dbName}]</span>
        )}

        {ver && ver.shortHash !== "?" && (
          <>
            <span className="opacity-30 mx-0.5 hidden sm:inline">|</span>
            <button
              onClick={() => setShowGitStatus(true)}
              className="hidden sm:flex items-center gap-1 text-[11px] opacity-70 hover:opacity-100 cursor-pointer transition-opacity bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded-full"
              title="ตรวจสอบเวอร์ชัน"
              data-testid="btn-dev-version"
            >
              <GitBranch className="h-3 w-3" />
              v.{ver.shortHash}
            </button>
          </>
        )}

        <div className="flex-1" />

        {!canSwitchToTh && isUsa && (
          <span className="text-[10px] opacity-70 hidden sm:inline">TH ออฟไลน์</span>
        )}

        <button
          onClick={() => {
            if (isUsa && !canSwitchToTh) return;
            handleSwitch(oppositeTarget);
          }}
          disabled={switching || (isUsa && !canSwitchToTh)}
          className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition-all ${
            switching
              ? "bg-white/20 cursor-wait"
              : isUsa && !canSwitchToTh
                ? "bg-white/10 opacity-50 cursor-not-allowed"
                : "bg-white/25 hover:bg-white/40 cursor-pointer"
          }`}
          data-testid="btn-dev-switch"
        >
          {switching ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <span>สลับไป {oppositeLabel}</span>
          )}
        </button>

        <span className="opacity-30 mx-0.5">|</span>

        <button
          onClick={() => window.open(import.meta.env.PROD ? "/api/platform/export-db" : "/api/dev/export-db", "_blank")}
          className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-white/20 hover:bg-white/35 cursor-pointer transition-all"
          title="ดาวน์โหลด backup ฐานข้อมูล (.sql)"
          data-testid="btn-dev-export"
        >
          <HardDriveDownload className="h-3 w-3" />
          <span className="hidden sm:inline">Backup</span>
        </button>

        <button
          onClick={() => setShowSyncPanel(true)}
          className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/30 hover:bg-emerald-500/50 cursor-pointer transition-all"
          title="Sync ข้อมูลจาก Production"
          data-testid="btn-dev-sync"
        >
          <CloudDownload className="h-3 w-3" />
          <span className="hidden sm:inline">Sync</span>
        </button>

      </div>
      <div style={{ height: `${BAR_HEIGHT}px` }} className="print:hidden" />

      {switching && (
        <div className="fixed inset-0 z-[10000] bg-black/50 flex items-center justify-center" data-testid="switching-overlay">
          <div className="bg-white rounded-2xl p-8 shadow-2xl flex flex-col items-center gap-4 max-w-sm mx-4">
            <Loader2 className="h-10 w-10 animate-spin text-[#fb9678]" />
            <p className="text-lg font-semibold text-gray-800">กำลังสลับฐานข้อมูล...</p>
            <p className="text-sm text-gray-500 text-center">ระบบกำลังเปลี่ยนการเชื่อมต่อ กรุณารอสักครู่</p>
          </div>
        </div>
      )}

      {showGitStatus && (
        <GitStatusPanel onClose={() => setShowGitStatus(false)} />
      )}

      {showSyncPanel && (
        <SyncPanel onClose={() => setShowSyncPanel(false)} />
      )}
    </>
  );
}

export function notifyDbSwitch() {
  try {
    localStorage.setItem(DB_SWITCH_SIGNAL, Date.now().toString());
    localStorage.removeItem(DB_SWITCH_SIGNAL);
  } catch {}
  try {
    const channel = new BroadcastChannel(DB_SWITCH_SIGNAL);
    channel.postMessage("switched");
    channel.close();
  } catch {}
}
