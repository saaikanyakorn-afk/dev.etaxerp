import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import PlatformLayout from "@/components/platform-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Shield, Loader2, AlertCircle, CheckCircle2, AlertTriangle,
  Send, History, HardDrive, Zap, XCircle,
  ChevronDown, ChevronRight, ArrowLeft, ArrowRight,
  Database, Table2, Clock, Lock, SkipForward,
  Circle, MinusCircle, ShieldAlert,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";

interface CompletedTable {
  tableName: string;
  status: string;
  rowCount: number;
  durationMs: number;
  errorMessage?: string;
  dumpFileSize?: number;
  dumpSpeed?: number;
  restoreSpeed?: number;
}

interface CloneProgress {
  status: string;
  percent: number;
  error?: string;
  step?: string;
  startedAt?: number;
  currentTable?: string;
  tableIndex?: number;
  totalTables?: number;
  tableElapsedSec?: number;
  autoTimeoutSec?: number;
  rowCount?: number;
  totalBatches?: number;
  batchPhase?: string;
  completedTables?: CompletedTable[];
  cloneType?: string;
  transferSpeed?: number;
  avgTransferSpeed?: number;
  transferredBytes?: number;
  dumpFileSize?: number;
  dumpSpeed?: number;
  restoreElapsedSec?: number;
}

interface TableMeta {
  pgName: string;
  displayName: string;
  rowCount: number;
}

interface CloneEstimate {
  tableName: string;
  avgMs: number | null;
  records: number;
}

interface SpaceCheck {
  ok: boolean;
  source: {
    totalSelectedBytes: number;
    totalSelectedMB: string;
    totalSelectedGB: string;
    largestTableName: string;
    largestTableBytes: number;
    largestTableMB: string;
    largestTableGB: string;
    tableCount: number;
  };
  target: {
    dbSizeBytes: number;
    dbSizeGB: string;
    freeBytes: number;
    freeGB: string;
    hasDiskInfo: boolean;
    diskCheckMethod: string;
    targetOS?: string;
  };
  swap: {
    requiredBytes: number;
    requiredMB: string;
    requiredGB: string;
    explanation: string;
  };
  message: string;
}

interface CloneSession {
  sessionId: string;
  cloneType: string;
  startedAt: string;
  completedAt: string | null;
  status: string;
  tables: { tableName: string; rowCount: number; hostDurationMs: number; remoteDurationMs: number; status: string; errorMessage: string | null }[];
}

type WizardStep = "select-target" | "select-type" | "select-tables" | "confirm" | "cloning" | "recovery";
type CloneTarget = "dev" | "pdt" | "";
const CLONE_TARGETS = [
  { key: "dev" as const, label: "Dev (Thailand)", db: "db_rp_dev", desc: "ฐานข้อมูลพัฒนา — สำหรับทดสอบระบบ", color: "border-blue-400 bg-blue-50" },
  { key: "pdt" as const, label: "Production (Thailand)", db: "db_rp_pdt", desc: "ฐานข้อมูลจริง — สำหรับใช้งานจริง", color: "border-green-400 bg-green-50" },
];

interface LastFailedInfo {
  hasFailedTable: boolean;
  hasMissingTables?: boolean;
  sessionId?: string;
  tableName?: string;
  missingTables?: string[];
  errorMessage?: string;
  failedAt?: string;
  totalFailed?: number;
  totalTables?: number;
}

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec} วินาที`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m} นาที ${s} วินาที`;
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return formatDuration(Math.round(ms / 1000));
}

function formatThaiDate(isoStr: string): string {
  const d = new Date(isoStr);
  const day = d.getDate();
  const month = d.getMonth() + 1;
  const year = d.getFullYear() + 543;
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${h}:${min}`;
}

export default function DatabaseBackup() {
  const [step, setStep] = useState<WizardStep>("select-target");
  const [targetDb, setTargetDb] = useState<CloneTarget>("");
  const [cloneDirection, setCloneDirection] = useState<"us_to_th" | "th_to_us">("us_to_th");
  const [cloneType, setCloneType] = useState<"static" | "transaction" | "manual" | "">("");
  const [staticChecked, setStaticChecked] = useState(true);
  const [transactionChecked, setTransactionChecked] = useState(true);
  const [staticExpanded, setStaticExpanded] = useState(false);
  const [transactionExpanded, setTransactionExpanded] = useState(false);
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());
  const [selectionLocked, setSelectionLocked] = useState(false);

  const [cloning, setCloning] = useState(false);
  const [cloneElapsed, setCloneElapsed] = useState(0);
  const [cloneProgress, setCloneProgress] = useState<CloneProgress>({ status: "idle", percent: 0 });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [screenLockError, setScreenLockError] = useState("");
  const [navWarningVisible, setNavWarningVisible] = useState(false);
  const navWarningTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [recoveryInfo, setRecoveryInfo] = useState<LastFailedInfo | null>(null);
  const [recoveryChecked, setRecoveryChecked] = useState(false);
  const [spaceCheck, setSpaceCheck] = useState<SpaceCheck | null>(null);
  const [spaceCheckLoading, setSpaceCheckLoading] = useState(false);
  const [tableListExpanded, setTableListExpanded] = useState(false);
  const [syncingConfig, setSyncingConfig] = useState(false);
  const [syncConfigResult, setSyncConfigResult] = useState<{ ok: boolean; message: string; keys?: string[] } | null>(null);

  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const queryClient = useQueryClient();
  const hasEnteredRef = useRef(false);
  const cloningRef = useRef(false);
  const [, setLocation] = useLocation();
  const [autoResumeRunning, setAutoResumeRunning] = useState(false);

  const { data: tableData, isLoading: tablesLoading } = useQuery<{ static: TableMeta[]; transaction: TableMeta[]; unregistered?: TableMeta[] }>({
    queryKey: ["/api/platform/clone-tables"],
    queryFn: async () => {
      const res = await fetch("/api/platform/clone-tables", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load tables");
      return res.json();
    },
    staleTime: 60000,
  });

  const unregisteredNames = useMemo(() => 
    (tableData?.unregistered || []).map(t => t.pgName), [tableData]);

  const selectedTableNames = useCallback((): string[] => {
    const extra = unregisteredNames;
    if (cloneType === "static") return [...(tableData?.static.map(t => t.pgName) || []), ...extra];
    if (cloneType === "transaction") return [...(tableData?.transaction.map(t => t.pgName) || []), ...extra];
    if (cloneType === "manual") return [...Array.from(selectedTables), ...extra];
    return [];
  }, [cloneType, tableData, selectedTables, unregisteredNames]);

  const { data: estimateData, isLoading: estimateLoading, refetch: refetchEstimate } = useQuery<{
    estimates: CloneEstimate[];
    totalMs: number;
    hasEnoughData: boolean;
  }>({
    queryKey: ["/api/platform/clone-estimate", selectedTableNames(), cloneType],
    queryFn: async () => {
      const tables = selectedTableNames();
      if (!tables.length) return { estimates: [], totalMs: 0, hasEnoughData: false };
      const res = await fetch(`/api/platform/clone-estimate?tables=${tables.join(",")}&cloneType=${cloneType}`, { credentials: "include" });
      if (!res.ok) return { estimates: [], totalMs: 0, hasEnoughData: false };
      return res.json();
    },
    enabled: selectionLocked || cloneType === "static" || cloneType === "transaction",
    staleTime: 30000,
  });

  const { data: maintenanceStatus } = useQuery<{ enabled: boolean; cloneInProgress: boolean; source: string | null }>({
    queryKey: ["/api/maintenance/status"],
    queryFn: async () => {
      const res = await fetch("/api/maintenance/status", { credentials: "include" });
      if (!res.ok) return { enabled: false, cloneInProgress: false, source: null };
      return res.json();
    },
    refetchInterval: cloning ? 3000 : 10000,
  });

  const { data: cloneHistoryData, refetch: refetchHistory } = useQuery<{ source: string; sessions: CloneSession[] }>({
    queryKey: ["/api/platform/clone-history"],
    queryFn: async () => {
      const res = await fetch("/api/platform/clone-history", { credentials: "include" });
      if (!res.ok) return { source: "local", sessions: [] };
      const data = await res.json();
      if (Array.isArray(data)) return { source: "local", sessions: data };
      return data;
    },
  });
  const cloneHistory = cloneHistoryData?.sessions || [];
  const cloneHistorySource = cloneHistoryData?.source || "local";

  useEffect(() => {
    if (!hasEnteredRef.current) {
      hasEnteredRef.current = true;
      fetch("/api/platform/clone-screen-enter", { method: "POST", credentials: "include" })
        .then(r => { if (!r.ok) return r.json().then(d => { setScreenLockError(d.message || ""); }); })
        .catch(() => {});

      fetch("/api/platform/clone-progress", { credentials: "include", cache: "no-store" })
        .then(r => r.ok ? r.json() : null)
        .then((prog: CloneProgress | null) => {
          if (prog && prog.status !== "idle" && prog.status !== "complete" && prog.status !== "error") {
            setCloneProgress(prog);
            setCloning(true);
            setStep("cloning");
            if (prog.step?.includes("Auto-Resume")) {
              setAutoResumeRunning(true);
            }
            if (prog.startedAt) {
              setCloneElapsed(Math.round((Date.now() - prog.startedAt) / 1000));
            }
            startPolling();
          } else {
            fetch("/api/platform/clone-last-failed", { credentials: "include" })
              .then(r => r.ok ? r.json() : null)
              .then((data: LastFailedInfo | null) => {
                setRecoveryChecked(true);
                if (data && data.hasFailedTable && !data.hasMissingTables) {
                  setRecoveryInfo(data);
                  setStep("recovery");
                }
              })
              .catch(() => { setRecoveryChecked(true); });
          }
        })
        .catch(() => {
          fetch("/api/platform/clone-last-failed", { credentials: "include" })
            .then(r => r.ok ? r.json() : null)
            .then((data: LastFailedInfo | null) => {
              setRecoveryChecked(true);
              if (data && data.hasFailedTable && !data.hasMissingTables) {
                setRecoveryInfo(data);
                setStep("recovery");
              }
            })
            .catch(() => { setRecoveryChecked(true); });
        });
    }
    heartbeatTimerRef.current = setInterval(() => {
      fetch("/api/platform/clone-screen-heartbeat", { method: "POST", credentials: "include" }).catch(() => {});
    }, 30000);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
      if (!cloningRef.current) {
        fetch("/api/platform/clone-screen-leave", { method: "POST", credentials: "include" }).catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    if (tableData && cloneType === "manual" && selectedTables.size === 0) {
      const all = new Set<string>();
      tableData.static.forEach(t => all.add(t.pgName));
      tableData.transaction.forEach(t => all.add(t.pgName));
      setSelectedTables(all);
    }
  }, [tableData, cloneType]);

  useEffect(() => {
    if (cloneType === "manual" && tableData) {
      const staticAll = tableData.static.every(t => selectedTables.has(t.pgName));
      const transAll = tableData.transaction.every(t => selectedTables.has(t.pgName));
      setStaticChecked(staticAll);
      setTransactionChecked(transAll);
    }
  }, [selectedTables, cloneType, tableData]);

  useEffect(() => { cloningRef.current = cloning; }, [cloning]);

  useEffect(() => {
    if (!cloning) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
      return e.returnValue;
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [cloning]);

  useEffect(() => {
    if (!cloning) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest("a[href]") as HTMLAnchorElement | null;
      if (link && !link.href.includes("clone-data") && !link.href.includes("clone")) {
        e.preventDefault();
        e.stopPropagation();
        if (navWarningTimer.current) clearTimeout(navWarningTimer.current);
        setNavWarningVisible(true);
        navWarningTimer.current = setTimeout(() => setNavWarningVisible(false), 6000);
      }
    };
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [cloning]);

  const stopPolling = () => {
    if (pollTimerRef.current) { clearInterval(pollTimerRef.current); pollTimerRef.current = null; }
    if (elapsedTimerRef.current) { clearInterval(elapsedTimerRef.current); elapsedTimerRef.current = null; }
  };

  const startPolling = () => {
    stopPolling();
    elapsedTimerRef.current = setInterval(() => setCloneElapsed(e => e + 1), 1000);
    pollTimerRef.current = setInterval(async () => {
      try {
        const r = await fetch("/api/platform/clone-progress?t=" + Date.now(), { credentials: "include", cache: "no-store" });
        if (!r.ok) return;
        const d: CloneProgress = await r.json();
        setCloneProgress(d);

        if (d.step?.includes("Auto-Resume")) {
          setAutoResumeRunning(true);
        }

        if (d.status === "complete") {
          stopPolling();
          setCloning(false);
          setAutoResumeRunning(false);
          if (recoveryInfo) {
            const count = recoveryInfo.missingTables?.length || 1;
            setSuccess(recoveryInfo.hasMissingTables
              ? `Clone ${count} ตารางที่ขาดสำเร็จ! ข้อมูลปลายทางสมบูรณ์แล้ว`
              : `ซ่อมตาราง ${recoveryInfo.tableName} สำเร็จ! ข้อมูลสมบูรณ์แล้ว`);
            setRecoveryInfo(null);
          } else if (autoResumeRunning) {
            setSuccess("Auto-Resume Clone สำเร็จ! ตารางที่ขาดถูก Clone ไปปลายทางเรียบร้อยแล้ว");
          } else {
            setSuccess("Clone สำเร็จ! ข้อมูลถูกส่งไปเซิร์ฟเวอร์ไทยเรียบร้อย ระบบกลับสู่โหมดปกติแล้ว");
          }
          setError("");
          refetchHistory();
          queryClient.invalidateQueries({ queryKey: ["/api/maintenance/status"] });
        } else if (d.status === "error") {
          stopPolling();
          setCloning(false);
          setAutoResumeRunning(false);
          setError(d.error || "Clone failed");
          setSuccess("");
          refetchHistory();
          queryClient.invalidateQueries({ queryKey: ["/api/maintenance/status"] });
          if (recoveryInfo) {
            setStep("recovery");
          }
        }
      } catch {}
    }, 2000);
  };

  const toggleTableCategory = (category: "static" | "transaction", checked: boolean) => {
    if (!tableData) return;
    const tables = category === "static" ? tableData.static : tableData.transaction;
    const next = new Set(selectedTables);
    tables.forEach(t => {
      if (checked) next.add(t.pgName);
      else next.delete(t.pgName);
    });
    setSelectedTables(next);
    if (category === "static") {
      setStaticChecked(checked);
      setStaticExpanded(!checked);
    } else {
      setTransactionChecked(checked);
      setTransactionExpanded(!checked);
    }
  };

  const toggleSingleTable = (pgName: string) => {
    const next = new Set(selectedTables);
    if (next.has(pgName)) next.delete(pgName);
    else next.add(pgName);
    setSelectedTables(next);
  };

  const handleDoneSelecting = () => {
    setSelectionLocked(true);
    refetchEstimate();
  };

  const handleReselect = () => {
    setSelectionLocked(false);
  };

  const handleRecoveryClone = async () => {
    const tables = recoveryInfo?.hasMissingTables && recoveryInfo.missingTables
      ? recoveryInfo.missingTables
      : recoveryInfo?.tableName ? [recoveryInfo.tableName] : [];
    if (!tables.length) return;
    setError("");
    setSuccess("");
    setCloneProgress({ status: "idle", percent: 0 });
    setCloneElapsed(0);

    try {
      await fetch("/api/platform/clone-reset", { method: "POST", credentials: "include" });
    } catch {}

    setCloning(true);
    setStep("cloning");

    try {
      const res = await apiRequest("POST", "/api/platform/clone-db", {
        cloneType: "manual",
        tables,
        targetDb,
        direction: cloneDirection,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ message: "เกิดข้อผิดพลาด" }));
        throw new Error(data.message || "เกิดข้อผิดพลาด");
      }
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance/status"] });
      startPolling();
    } catch (err: any) {
      setCloning(false);
      setError(err.message || "ไม่สามารถเริ่ม Recovery Clone ได้");
      setStep("recovery");
    }
  };

  const handleSyncConfig = async () => {
    setSyncingConfig(true);
    setSyncConfigResult(null);
    try {
      const res = await fetch("/api/platform/sync-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ targetDb, direction: cloneDirection }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSyncConfigResult({ ok: false, message: data.message || "เกิดข้อผิดพลาด" });
      } else {
        setSyncConfigResult({ ok: true, message: data.message || `Sync สำเร็จ ${data.synced} รายการ`, keys: data.keys });
      }
    } catch (err: any) {
      setSyncConfigResult({ ok: false, message: err.message || "เกิดข้อผิดพลาด" });
    } finally {
      setSyncingConfig(false);
    }
  };

  const handleStartClone = async () => {
    setError("");
    setSuccess("");
    setCloneProgress({ status: "idle", percent: 0 });
    setCloneElapsed(0);

    try {
      await fetch("/api/platform/clone-reset", { method: "POST", credentials: "include" });
    } catch {}

    setCloning(true);
    setStep("cloning");

    try {
      const body: any = { cloneType: cloneType || "static", targetDb, direction: cloneDirection };
      if (cloneType === "manual") {
        body.tables = Array.from(selectedTables);
      }
      const res = await fetch("/api/platform/clone-db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ message: "เกิดข้อผิดพลาด" }));
        throw new Error(data.message || `HTTP ${res.status}`);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance/status"] });
      startPolling();
    } catch (err: any) {
      setCloning(false);
      setError(err.message || "ไม่สามารถเริ่ม Clone ได้");
      setStep("confirm");
    }
  };

  const fetchSpaceCheck = async (tables: string[]) => {
    if (!tables.length) return;
    setSpaceCheckLoading(true);
    setSpaceCheck(null);
    try {
      const res = await fetch(`/api/platform/clone-space-check?tables=${tables.join(",")}&targetDb=${targetDb}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setSpaceCheck(data);
      }
    } catch {}
    setSpaceCheckLoading(false);
  };

  const goToConfirm = (tables?: string[]) => {
    const t = tables || selectedTableNames();
    setStep("confirm");
    fetchSpaceCheck(t);
  };

  const handleTypeSelect = (type: "static" | "transaction" | "manual") => {
    setCloneType(type);
    setSelectionLocked(false);
    setError("");
    setSuccess("");
    if (type === "manual") {
      setStep("select-tables");
    } else {
      const t = type === "static"
        ? tableData?.static.map(tb => tb.pgName) || []
        : tableData?.transaction.map(tb => tb.pgName) || [];
      goToConfirm(t);
    }
  };

  const goBackToTypeSelect = () => {
    setStep("select-type");
    setCloneType("");
    setSelectionLocked(false);
    setError("");
    setSuccess("");
  };

  const goBackToTableSelect = () => {
    if (cloneType === "manual") {
      setStep("select-tables");
      setSelectionLocked(false);
    } else {
      goBackToTypeSelect();
    }
  };

  const isCloneBlocked = maintenanceStatus?.enabled && maintenanceStatus?.source !== "clone_database" && !cloning;
  const totalSelectedTables = selectedTableNames().length;
  const totalSelectedRows = selectedTableNames().reduce((sum, name) => {
    const s = tableData?.static.find(t => t.pgName === name);
    const t2 = tableData?.transaction.find(t => t.pgName === name);
    return sum + ((s?.rowCount ?? t2?.rowCount) || 0);
  }, 0);

  const completedTables = cloneProgress.completedTables || [];
  const successCount = completedTables.filter(t => t.status === "success").length;
  const errorCount = completedTables.filter(t => t.status === "error").length;
  const droppedCount = completedTables.filter(t => t.status === "dropped").length;
  const totalRows = completedTables.reduce((s, t) => s + (t.rowCount || 0), 0);
  const totalDurationMs = completedTables.reduce((s, t) => s + (t.durationMs || 0), 0);
  const totalDumpBytes = completedTables.reduce((s, t) => s + (t.dumpFileSize || 0), 0);
  const tablesWithSpeed = completedTables.filter(t => t.restoreSpeed && t.restoreSpeed > 0);
  const avgOutboundSpeed = tablesWithSpeed.length > 0 ? Math.round(tablesWithSpeed.reduce((s, t) => s + (t.restoreSpeed || 0), 0) / tablesWithSpeed.length) : 0;
  const fmtSpeed = (b: number) => b < 1024 ? `${b} B/s` : b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB/s` : `${(b / (1024 * 1024)).toFixed(2)} MB/s`;
  const fmtSize = (b: number) => b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / (1024 * 1024)).toFixed(1)} MB`;

  if (screenLockError) {
    return (
      <PlatformLayout>
        <div className="space-y-6">
          <h1 className="text-2xl font-bold text-gray-900">Clone ข้อมูล</h1>
          <Card className="border-red-300 bg-red-50">
            <CardContent className="p-8 text-center">
              <Lock className="h-12 w-12 text-red-400 mx-auto mb-4" />
              <p className="text-lg font-semibold text-red-800">{screenLockError}</p>
              <p className="text-sm text-red-600 mt-2">กรุณารอให้ผู้ดูแลระบบท่านอื่นเสร็จสิ้นก่อน</p>
            </CardContent>
          </Card>
        </div>
      </PlatformLayout>
    );
  }

  return (
    <PlatformLayout>
      {navWarningVisible && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] animate-in fade-in slide-in-from-top-2 duration-300 max-w-lg w-full" data-testid="nav-warning-overlay">
          <div className="bg-white border-2 border-red-400 rounded-xl shadow-2xl overflow-hidden">
            <div className="bg-red-600 text-white px-4 py-2.5 flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 shrink-0" />
              <span className="font-semibold">ไม่สามารถออกจากหน้านี้ได้</span>
              <button onClick={() => setNavWarningVisible(false)} className="ml-auto text-white/80 hover:text-white">
                <XCircle className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-sm text-gray-700">ระบบกำลัง Clone ข้อมูลอยู่ กรุณารอให้เสร็จก่อน</p>
              {cloneProgress.currentTable && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-blue-900">{cloneProgress.currentTable}</span>
                    <span className="font-mono text-xs bg-blue-100 px-2 py-0.5 rounded text-blue-700">
                      {cloneProgress.tableIndex}/{cloneProgress.totalTables}
                    </span>
                  </div>
                  <div className="w-full bg-blue-200 rounded-full h-2">
                    <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${Math.max(cloneProgress.percent, 2)}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-xs text-blue-700">
                    <span>{cloneProgress.percent}% สำเร็จ</span>
                    <span>{formatDuration(cloneElapsed)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" data-testid="text-clone-title">Clone ข้อมูล</h1>
          <p className="text-gray-500 mt-1">
            {cloneDirection === "th_to_us"
              ? <>ส่งข้อมูลจาก <span className="font-bold text-orange-600">Thailand Server</span> กลับมายัง <span className="font-bold text-blue-600">Replit (US)</span></>
              : <>ส่งข้อมูลจาก <span className="font-bold text-blue-600">Replit (US)</span> ไปยัง <span className="font-bold text-orange-600">Thailand Server</span></>}
          </p>
        </div>

        {isCloneBlocked && (
          <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-300 rounded-lg">
            <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-800">ระบบอยู่ในโหมดปรับปรุง</p>
              <p className="text-xs text-amber-700 mt-1">กรุณาปิดโหมดปรับปรุงก่อนใช้งาน Clone</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {step === "recovery" ? (
              <div className="flex items-center gap-2 text-sm" data-testid="step-indicator">
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-600 text-white">
                  ซ่อมข้อมูล (Recovery)
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm" data-testid="step-indicator">
                {[
                  { key: "select-target", label: "1. เลือกปลายทาง" },
                  { key: "select-type", label: "2. เลือกประเภท" },
                  { key: "select-tables", label: "3. เลือกตาราง" },
                  { key: "confirm", label: "4. ยืนยัน" },
                  { key: "cloning", label: "5. กำลัง Clone" },
                ].map((s, i) => (
                  <div key={s.key} className="flex items-center gap-1">
                    {i > 0 && <ArrowRight className="h-3 w-3 text-gray-300" />}
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${step === s.key ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500"}`}>
                      {s.label}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {step === "recovery" && recoveryInfo && (
              <Card className="border-t-4 border-t-red-500">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-red-500" />
                    {recoveryInfo.hasMissingTables ? "ตรวจพบตารางที่ยังไม่ได้ Clone" : "ต้องซ่อมข้อมูลก่อนดำเนินการ"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className={`p-4 border rounded-lg space-y-3 ${recoveryInfo.hasMissingTables ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200"}`}>
                    <p className={`text-sm font-semibold ${recoveryInfo.hasMissingTables ? "text-amber-800" : "text-red-800"}`}>
                      {recoveryInfo.hasMissingTables
                        ? `การ Clone ครั้งก่อนถูกขัดจังหวะ — มี ${recoveryInfo.missingTables?.length || 0} ตารางที่ยังไม่ได้ Clone`
                        : "การ Clone ครั้งก่อนมีตารางที่ล้มเหลว — ข้อมูลในเซิร์ฟเวอร์ปลายทางอาจว่างเปล่า"}
                    </p>
                    <p className={`text-sm ${recoveryInfo.hasMissingTables ? "text-amber-700" : "text-red-700"}`}>
                      {recoveryInfo.hasMissingTables
                        ? "ระบบจะ Clone เฉพาะตารางที่ขาดหายไปให้อัตโนมัติ เพื่อให้ข้อมูลปลายทางสมบูรณ์"
                        : "ระบบจะ Clone เฉพาะตารางที่ล้มเหลวใหม่อัตโนมัติ เพื่อให้แน่ใจว่าข้อมูลปลายทางไม่มีสถานะ \"ข้อมูลไม่สมบูรณ์\" เหลืออยู่"}
                    </p>
                  </div>

                  {recoveryInfo.hasMissingTables && recoveryInfo.missingTables ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-gray-50 rounded-lg">
                          <p className="text-xs text-gray-500">จำนวนตารางที่ขาด</p>
                          <p className="text-2xl font-bold text-amber-600 mt-1">{recoveryInfo.missingTables.length}</p>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-lg">
                          <p className="text-xs text-gray-500">เซสชันที่ถูกขัดจังหวะ</p>
                          <p className="text-base font-semibold text-gray-900 mt-1">
                            {recoveryInfo.failedAt ? formatThaiDate(recoveryInfo.failedAt) : "—"}
                          </p>
                        </div>
                      </div>
                      <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                        <p className="text-xs text-gray-500 font-semibold mb-2">ตารางที่ต้อง Clone:</p>
                        <div className="flex flex-wrap gap-1">
                          {recoveryInfo.missingTables.map(t => (
                            <span key={t} className="px-2 py-0.5 bg-amber-100 text-amber-800 text-xs rounded font-mono">{t}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-500">ตารางที่ต้องซ่อม</p>
                        <p className="text-base font-semibold text-gray-900 mt-1 font-mono">{recoveryInfo.tableName}</p>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-500">ล้มเหลวเมื่อ</p>
                        <p className="text-base font-semibold text-gray-900 mt-1">
                          {recoveryInfo.failedAt ? formatThaiDate(recoveryInfo.failedAt) : "—"}
                        </p>
                      </div>
                    </div>
                  )}

                  {recoveryInfo.errorMessage && !recoveryInfo.hasMissingTables && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-xs text-amber-600 font-semibold">สาเหตุที่ล้มเหลว:</p>
                      <p className="text-xs text-amber-800 mt-1 font-mono break-all">{recoveryInfo.errorMessage}</p>
                    </div>
                  )}

                  {error && (
                    <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <XCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
                      <p className="text-sm text-red-700">{error}</p>
                    </div>
                  )}

                  <Button
                    onClick={handleRecoveryClone}
                    disabled={cloning || !!isCloneBlocked}
                    className={`w-full text-white text-base py-6 ${recoveryInfo.hasMissingTables ? "bg-amber-600 hover:bg-amber-700" : "bg-red-600 hover:bg-red-700"}`}
                    data-testid="button-recovery-clone"
                  >
                    <Zap className="h-5 w-5 mr-2" />
                    {recoveryInfo.hasMissingTables
                      ? `Clone ${recoveryInfo.missingTables?.length || 0} ตารางที่ขาดทันที`
                      : `ซ่อมตาราง ${recoveryInfo.tableName} ทันที`}
                  </Button>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => { setRecoveryInfo(null); setStep("select-target"); }}
                      className="flex-1 text-sm"
                      data-testid="button-skip-recovery"
                    >
                      ข้าม — เริ่ม Clone ใหม่ทั้งหมด
                    </Button>
                  </div>

                  <p className="text-xs text-gray-400 text-center">
                    {recoveryInfo.hasMissingTables
                      ? "แนะนำให้ Clone ตารางที่ขาดก่อน — หรือข้ามไปเริ่ม Clone ใหม่ทั้งหมดก็ได้"
                      : "ไม่สามารถข้ามขั้นตอนนี้ได้ — ต้องซ่อมข้อมูลให้สมบูรณ์ก่อนเริ่ม Clone ใหม่"}
                  </p>
                </CardContent>
              </Card>
            )}

            {step === "select-target" && (
              <Card className="border-t-4 border-t-[#fb9678]">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Send className="h-5 w-5 text-[#fb9678]" />
                    เลือกฐานข้อมูลปลายทาง
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-2 mb-3">
                    <button
                      onClick={() => setCloneDirection("us_to_th")}
                      className={`flex-1 p-3 rounded-lg border-2 text-sm font-semibold transition-all ${cloneDirection === "us_to_th" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-500 hover:border-gray-300"}`}
                      data-testid="button-direction-us-to-th"
                    >
                      🇺🇸 US → TH 🇹🇭
                      <p className="text-xs font-normal mt-1">Replit → Thailand</p>
                    </button>
                    <button
                      onClick={() => setCloneDirection("th_to_us")}
                      className={`flex-1 p-3 rounded-lg border-2 text-sm font-semibold transition-all ${cloneDirection === "th_to_us" ? "border-orange-500 bg-orange-50 text-orange-700" : "border-gray-200 text-gray-500 hover:border-gray-300"}`}
                      data-testid="button-direction-th-to-us"
                    >
                      🇹🇭 TH → US 🇺🇸
                      <p className="text-xs font-normal mt-1">Thailand → Replit</p>
                    </button>
                  </div>

                  <p className="text-sm text-gray-500">
                    {cloneDirection === "us_to_th"
                      ? "Clone จาก Replit (US) ไปยัง Thailand Server"
                      : "Clone จาก Thailand Server กลับมายัง Replit (US)"}
                  </p>
                  <p className="text-xs text-gray-400">
                    {cloneDirection === "us_to_th"
                      ? "Source: 🇺🇸 Replit (US) → Target: 🇹🇭 Thailand Server"
                      : "Source: 🇹🇭 Thailand Server → Target: 🇺🇸 Replit (US)"}
                  </p>

                  {CLONE_TARGETS.map(t => (
                    <button
                      key={t.key}
                      onClick={() => {
                        setTargetDb(t.key);
                        fetch(`/api/platform/clone-last-failed?checkMissing=true&targetDb=${t.key}`, { credentials: "include" })
                          .then(r => r.ok ? r.json() : null)
                          .then((data: LastFailedInfo | null) => {
                            if (data && data.hasFailedTable) {
                              setRecoveryInfo(data);
                              setStep("recovery");
                            } else {
                              setStep("select-type");
                            }
                          })
                          .catch(() => { setStep("select-type"); });
                      }}
                      disabled={!!isCloneBlocked}
                      className={`w-full text-left p-4 rounded-lg border-2 transition-all hover:shadow-md disabled:opacity-50 ${t.color}`}
                      data-testid={`button-target-${t.key}`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-900">{t.label}</p>
                          <p className="text-xs text-gray-600 mt-1">{t.desc}</p>
                        </div>
                        <span className="text-xs bg-white px-2 py-1 rounded font-mono">{t.db}</span>
                      </div>
                    </button>
                  ))}
                </CardContent>
              </Card>
            )}

            {step === "select-type" && (
              <Card className="border-t-4 border-t-blue-500">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Database className="h-5 w-5 text-blue-500" />
                    เลือกประเภทการ Clone
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-gray-500">
                    {cloneDirection === "us_to_th"
                      ? <>Clone ไปยัง <span className="font-semibold text-blue-600">{CLONE_TARGETS.find(t => t.key === targetDb)?.label}</span></>
                      : <>Clone จาก <span className="font-semibold text-orange-600">{CLONE_TARGETS.find(t => t.key === targetDb)?.label}</span> กลับมายัง <span className="font-semibold text-blue-600">Replit (US)</span></>}
                  </p>

                  <Button variant="outline" size="sm" onClick={() => { setStep("select-target"); setTargetDb(""); }} data-testid="button-back-to-target" className="mb-2">
                    <ArrowLeft className="h-4 w-4 mr-1" /> กลับ
                  </Button>

                  {[
                    { value: "static" as const, label: "Static Data Only", desc: "ข้อมูลหลัก เช่น บริษัท, สินค้า, ลูกค้า, ผังบัญชี, ตั้งค่าต่างๆ", count: tableData?.static.length || 0, color: "border-blue-500 bg-blue-50" },
                    { value: "transaction" as const, label: "Transaction Data Only", desc: "ข้อมูลรายการ เช่น ใบเสนอราคา, ใบกำกับภาษี, สมุดรายวัน, เงินเดือน", count: (tableData?.transaction.length || 0) + (tableData?.unregistered?.length || 0), color: "border-emerald-500 bg-emerald-50" },
                    { value: "manual" as const, label: "Manual Selection", desc: "เลือกตารางที่ต้องการเอง ทีละตาราง", count: null, color: "border-amber-500 bg-amber-50" },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => handleTypeSelect(opt.value)}
                      disabled={!!isCloneBlocked || tablesLoading}
                      className={`w-full text-left p-4 rounded-lg border-2 transition-all hover:shadow-md disabled:opacity-50 ${opt.color}`}
                      data-testid={`button-type-${opt.value}`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-900">{opt.label}</p>
                          <p className="text-xs text-gray-600 mt-1">{opt.desc}</p>
                        </div>
                        {opt.count !== null && (
                          <span className="text-xs bg-white px-2 py-1 rounded font-mono">{opt.count} ตาราง</span>
                        )}
                      </div>
                    </button>
                  ))}

                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="p-4 rounded-lg border-2 border-purple-300 bg-purple-50">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-900 flex items-center gap-2">
                            <Shield className="h-4 w-4 text-purple-500" />
                            Sync Config
                          </p>
                          <p className="text-xs text-gray-600 mt-1">
                            Copy system_config (DB URLs, Labels) ไปยังปลายทาง — ไม่เกี่ยวกับ Clone ตาราง
                          </p>
                        </div>
                        <Button
                          onClick={handleSyncConfig}
                          disabled={syncingConfig || !!isCloneBlocked}
                          size="sm"
                          className="bg-purple-600 hover:bg-purple-700 text-white"
                          data-testid="button-sync-config"
                        >
                          {syncingConfig ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                          {syncingConfig ? "กำลัง Sync..." : "Sync Config"}
                        </Button>
                      </div>
                      {syncConfigResult && (
                        <div className={`mt-2 p-2 rounded text-sm ${syncConfigResult.ok ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                          {syncConfigResult.ok ? <CheckCircle2 className="h-4 w-4 inline mr-1" /> : <XCircle className="h-4 w-4 inline mr-1" />}
                          {syncConfigResult.message}
                          {syncConfigResult.ok && syncConfigResult.keys && syncConfigResult.keys.length > 0 && (
                            <div className="mt-1 text-xs text-green-600 font-mono">
                              {syncConfigResult.keys.map(k => (
                                <span key={k} className="inline-block bg-green-200 px-1.5 py-0.5 rounded mr-1 mb-1">{k}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {step === "select-tables" && (
              <Card className="border-t-4 border-t-amber-500">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Table2 className="h-5 w-5 text-amber-500" />
                    เลือกตารางที่ต้องการ Clone
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {tablesLoading ? (
                    <div className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                      <p className="text-sm text-gray-500 mt-2">กำลังโหลดรายการตาราง...</p>
                    </div>
                  ) : (
                    <>
                      <div className="border rounded-lg overflow-hidden">
                        <div className="flex items-center gap-3 p-3 bg-blue-50">
                          <div onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={staticChecked}
                              onCheckedChange={(v) => !selectionLocked && toggleTableCategory("static", !!v)}
                              disabled={selectionLocked}
                              data-testid="checkbox-static-all"
                            />
                          </div>
                          <div
                            className="flex items-center gap-2 flex-1 cursor-pointer select-none"
                            onClick={() => !selectionLocked && setStaticExpanded(!staticExpanded)}
                          >
                            {staticExpanded ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronRight className="h-4 w-4 text-gray-500" />}
                            <span className="font-semibold text-sm text-gray-800">Static Data</span>
                            <span className="text-xs text-gray-500">({tableData?.static.length} ตาราง)</span>
                          </div>
                        </div>
                        {staticExpanded && (
                          <div className="max-h-64 overflow-y-auto border-t divide-y">
                            {tableData?.static.map(t => (
                              <label key={t.pgName} className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 cursor-pointer text-sm">
                                <Checkbox
                                  checked={selectedTables.has(t.pgName)}
                                  onCheckedChange={() => !selectionLocked && toggleSingleTable(t.pgName)}
                                  disabled={selectionLocked}
                                />
                                <span className="text-gray-700 flex-1">{t.displayName}</span>
                                <span className="text-xs text-gray-400 font-mono">{t.rowCount >= 0 ? t.rowCount.toLocaleString() : "—"} rows</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="border rounded-lg overflow-hidden">
                        <div className="flex items-center gap-3 p-3 bg-emerald-50">
                          <div onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={transactionChecked}
                              onCheckedChange={(v) => !selectionLocked && toggleTableCategory("transaction", !!v)}
                              disabled={selectionLocked}
                              data-testid="checkbox-transaction-all"
                            />
                          </div>
                          <div
                            className="flex items-center gap-2 flex-1 cursor-pointer select-none"
                            onClick={() => !selectionLocked && setTransactionExpanded(!transactionExpanded)}
                          >
                            {transactionExpanded ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronRight className="h-4 w-4 text-gray-500" />}
                            <span className="font-semibold text-sm text-gray-800">Transaction Data</span>
                            <span className="text-xs text-gray-500">({tableData?.transaction.length} ตาราง)</span>
                          </div>
                        </div>
                        {transactionExpanded && (
                          <div className="max-h-64 overflow-y-auto border-t divide-y">
                            {tableData?.transaction.map(t => (
                              <label key={t.pgName} className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 cursor-pointer text-sm">
                                <Checkbox
                                  checked={selectedTables.has(t.pgName)}
                                  onCheckedChange={() => !selectionLocked && toggleSingleTable(t.pgName)}
                                  disabled={selectionLocked}
                                />
                                <span className="text-gray-700 flex-1">{t.displayName}</span>
                                <span className="text-xs text-gray-400 font-mono">{t.rowCount >= 0 ? t.rowCount.toLocaleString() : "—"} rows</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>

                      {(tableData?.unregistered?.length ?? 0) > 0 && (
                        <div className="border rounded-lg overflow-hidden border-amber-300 bg-amber-50">
                          <div className="flex items-center gap-2 p-3">
                            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                            <span className="font-semibold text-sm text-amber-800">ตารางใหม่ (ยังไม่จัดหมวด)</span>
                            <span className="text-xs text-amber-600">({tableData?.unregistered?.length} ตาราง — จะ Clone ไปด้วยอัตโนมัติ)</span>
                          </div>
                          <div className="max-h-40 overflow-y-auto border-t border-amber-200 divide-y divide-amber-100">
                            {tableData?.unregistered?.map(t => (
                              <div key={t.pgName} className="flex items-center gap-3 px-4 py-2 text-sm">
                                <span className="text-amber-700 flex-1 font-mono">{t.pgName}</span>
                                <span className="text-xs text-amber-500">{t.rowCount >= 0 ? t.rowCount.toLocaleString() : "—"} rows</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-2">
                        <div className="text-sm text-gray-500">
                          เลือกแล้ว: <span className="font-semibold text-gray-800">{selectedTables.size}{unregisteredNames.length > 0 ? ` + ${unregisteredNames.length} ตารางใหม่` : ""}</span> ตาราง
                        </div>
                        <div className="flex items-center gap-3">
                          <Button variant="outline" onClick={goBackToTypeSelect} data-testid="button-back-to-type">
                            <ArrowLeft className="h-4 w-4 mr-1" /> กลับ
                          </Button>

                          {!selectionLocked ? (
                            <Button
                              onClick={handleDoneSelecting}
                              disabled={selectedTables.size === 0}
                              className="bg-blue-600 hover:bg-blue-700"
                              data-testid="button-done-selecting"
                            >
                              เลือกเสร็จแล้ว
                            </Button>
                          ) : (
                            <>
                              <Button variant="outline" onClick={handleReselect} data-testid="button-reselect">
                                เลือกใหม่
                              </Button>
                              <Button
                                onClick={() => goToConfirm()}
                                className="bg-emerald-600 hover:bg-emerald-700"
                                data-testid="button-proceed"
                              >
                                ดำเนินการต่อ <ArrowRight className="h-4 w-4 ml-1" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>

                      {selectionLocked && (
                        <div className="p-3 bg-gray-50 border rounded-lg">
                          <div className="flex items-center gap-2 text-sm">
                            <Checkbox checked={false} disabled />
                            <span className="text-gray-400">Auto roll back (เร็วๆนี้)</span>
                          </div>
                        </div>
                      )}

                      {selectionLocked && estimateData && (
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <Clock className="h-4 w-4 text-blue-600" />
                            <span className="text-sm font-semibold text-blue-800">เวลาที่ประมาณ</span>
                          </div>
                          {estimateLoading ? (
                            <div className="flex items-center gap-2 text-sm text-blue-600">
                              <Loader2 className="h-4 w-4 animate-spin" /> กำลังคำนวณ...
                            </div>
                          ) : estimateData.hasEnoughData ? (
                            <p className="text-lg font-bold text-blue-900">{formatMs(estimateData.totalMs)}</p>
                          ) : (
                            <p className="text-sm text-blue-700">ไม่ทราบ — ยังไม่มีข้อมูลการ Clone ที่เพียงพอ (ต้องมีอย่างน้อย 5 ครั้ง)</p>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {step === "confirm" && (
              <Card className="border-t-4 border-t-emerald-500">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    ยืนยันการ Clone
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500">ประเภท Clone</p>
                      <p className="text-base font-semibold text-gray-900 mt-1">
                        {cloneType === "static" ? "Static Data Only" : cloneType === "transaction" ? "Transaction Data Only" : "Manual Selection"}
                      </p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500">ทิศทาง</p>
                      <p className={`text-base font-semibold mt-1 ${cloneDirection === "th_to_us" ? "text-orange-600" : "text-blue-600"}`}>
                        {cloneDirection === "us_to_th" ? "US → TH" : "TH → US"}
                      </p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500">จำนวนตาราง</p>
                      <p className="text-base font-semibold text-gray-900 mt-1">{totalSelectedTables} ตาราง</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500">จำนวนข้อมูลโดยประมาณ</p>
                      <p className="text-base font-semibold text-gray-900 mt-1">{totalSelectedRows.toLocaleString()} rows</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500">เวลาที่ประมาณ</p>
                      <p className="text-base font-semibold text-gray-900 mt-1">
                        {estimateData?.hasEnoughData ? formatMs(estimateData.totalMs) : "ไม่ทราบ"}
                      </p>
                    </div>
                  </div>

                  {spaceCheckLoading ? (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-3">
                      <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                      <div>
                        <p className="text-sm font-medium text-blue-800">กำลังตรวจสอบพื้นที่เซิร์ฟเวอร์ปลายทาง...</p>
                        <p className="text-xs text-blue-600 mt-0.5">ตรวจสอบขนาดตาราง + พื้นที่ว่าง</p>
                      </div>
                    </div>
                  ) : spaceCheck ? (
                    <div className={`p-4 border rounded-lg space-y-3 ${
                      spaceCheck.ok ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"
                    }`}>
                      <div className="flex items-center gap-2">
                        {spaceCheck.ok ? (
                          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600" />
                        )}
                        <p className={`text-sm font-semibold ${spaceCheck.ok ? "text-emerald-800" : "text-red-800"}`}>
                          {spaceCheck.message}
                        </p>
                      </div>

                      {spaceCheck.source && spaceCheck.source.tableCount > 0 && (
                        <div className="grid grid-cols-3 gap-3">
                          <div className="p-3 bg-white/70 rounded-lg">
                            <p className="text-xs text-gray-500">ข้อมูลที่เลือกทั้งหมด</p>
                            <p className="text-sm font-semibold text-gray-900 mt-1">
                              {parseFloat(spaceCheck.source.totalSelectedGB) > 1
                                ? `${spaceCheck.source.totalSelectedGB} GB`
                                : `${spaceCheck.source.totalSelectedMB} MB`}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">{spaceCheck.source.tableCount} ตาราง</p>
                          </div>
                          <div className="p-3 bg-white/70 rounded-lg">
                            <p className="text-xs text-gray-500">ตารางที่ใหญ่ที่สุด</p>
                            <p className="text-sm font-semibold text-gray-900 mt-1 font-mono truncate" title={spaceCheck.source.largestTableName}>
                              {spaceCheck.source.largestTableName}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {parseFloat(spaceCheck.source.largestTableGB) > 1
                                ? `${spaceCheck.source.largestTableGB} GB`
                                : `${spaceCheck.source.largestTableMB} MB`}
                            </p>
                          </div>
                          <div className="p-3 bg-white/70 rounded-lg">
                            <p className="text-xs text-gray-500">พื้นที่ชั่วคราวที่ต้องการ</p>
                            <p className="text-sm font-semibold text-gray-900 mt-1">
                              {parseFloat(spaceCheck.swap.requiredGB) > 1
                                ? `${spaceCheck.swap.requiredGB} GB`
                                : `${spaceCheck.swap.requiredMB} MB`}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">สำหรับ Swap Strategy</p>
                          </div>
                        </div>
                      )}

                      {spaceCheck.target && spaceCheck.target.dbSizeBytes > 0 && (
                        <div className="flex items-center gap-4 text-xs text-gray-600 pt-1 border-t border-gray-200">
                          <span>DB ปลายทาง: {spaceCheck.target.dbSizeGB} GB</span>
                          {spaceCheck.target.hasDiskInfo && (
                            <span className="font-semibold text-emerald-700">
                              พื้นที่ว่าง: {parseFloat(spaceCheck.target.freeGB) > 1 ? `${spaceCheck.target.freeGB} GB` : `${(spaceCheck.target.freeBytes / 1024 / 1024).toFixed(0)} MB`}
                            </span>
                          )}
                          {spaceCheck.target.targetOS && (
                            <span className="text-gray-400">OS: {spaceCheck.target.targetOS}</span>
                          )}
                          {!spaceCheck.target.hasDiskInfo && (
                            <span className="text-gray-400 italic">ไม่สามารถตรวจสอบพื้นที่ว่างของดิสก์ได้</span>
                          )}
                        </div>
                      )}

                      {!spaceCheck.ok && (
                        <div className="p-3 bg-red-100 rounded-lg">
                          <p className="text-xs text-red-800 font-semibold">
                            {spaceCheck.target?.hasDiskInfo
                              ? "พื้นที่ว่างไม่เพียงพอ — Swap Strategy ต้องการพื้นที่ชั่วคราวสำหรับตารางที่ใหญ่ที่สุด กรุณาเพิ่มพื้นที่ดิสก์หรือลดจำนวนตารางที่เลือก"
                              : "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ปลายทางได้ — กรุณาตรวจสอบว่าเซิร์ฟเวอร์ออนไลน์อยู่"
                            }
                          </p>
                        </div>
                      )}
                    </div>
                  ) : null}

                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                      <div className="text-xs text-amber-700">
                        <p className="font-semibold">เมื่อเริ่ม Clone:</p>
                        <ul className="mt-1 space-y-0.5">
                          <li>• ระบบจะเปิดโหมดปรับปรุงอัตโนมัติ — ผู้ใช้ทุกคนจะถูกล็อคออก</li>
                          <li>• Clone จะทำงานทีละตาราง จนครบทุกตารางที่เลือก</li>
                          <li>• ถ้า Clone ล้มเหลว → ระบบจะปลดล็อคอัตโนมัติ</li>
                          <li>• ถ้า Clone สำเร็จ → กำหนดการปรับปรุงวันนี้จะถูกยกเลิก</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg opacity-50">
                    <Checkbox disabled checked={false} data-testid="checkbox-auto-rollback" />
                    <div>
                      <p className="text-sm text-gray-500">Auto Roll Back (เร็วๆนี้)</p>
                      <p className="text-[10px] text-gray-400">สำรองข้อมูลปลายทางก่อน Clone — ถ้าล้มเหลวจะกู้คืนอัตโนมัติ</p>
                    </div>
                  </div>

                  {error && (
                    <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <XCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-red-800">Clone ไม่สำเร็จ</p>
                        <p className="text-xs text-red-700 mt-1">{error}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2">
                    <Button variant="outline" onClick={goBackToTableSelect} data-testid="button-back">
                      <ArrowLeft className="h-4 w-4 mr-1" /> กลับ
                    </Button>
                    <Button
                      onClick={handleStartClone}
                      disabled={cloning || !!isCloneBlocked || spaceCheckLoading || (spaceCheck !== null && !spaceCheck.ok)}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-5 text-base"
                      data-testid="button-start-clone"
                    >
                      <Zap className="h-5 w-5 mr-2" />
                      {spaceCheck !== null && !spaceCheck.ok ? "พื้นที่ไม่เพียงพอ" : "Start Cloning"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {step === "cloning" && (
              <Card className="border-t-4 border-t-blue-500">
                {cloning && (
                  <div className="bg-red-600 text-white px-4 py-2 flex items-center gap-2 text-sm font-medium rounded-t-lg">
                    <ShieldAlert className="h-4 w-4" />
                    <span>ห้ามออกจากหน้านี้ — {autoResumeRunning ? "ระบบกำลัง Auto-Resume Clone" : "กำลัง Clone ข้อมูล"}</span>
                    <Lock className="h-3 w-3 ml-auto" />
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    {cloneProgress.status === "complete" ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : cloneProgress.status === "error" ? (
                      <XCircle className="h-5 w-5 text-red-500" />
                    ) : (
                      <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                    )}
                    {cloneProgress.status === "complete"
                      ? (autoResumeRunning ? "Auto-Resume Clone เสร็จสมบูรณ์!" : "Clone เสร็จสมบูรณ์!")
                      : cloneProgress.status === "error"
                        ? (autoResumeRunning ? "Auto-Resume Clone ล้มเหลว" : "Clone ล้มเหลว")
                        : (autoResumeRunning ? "ระบบกำลัง Auto-Resume Clone..." : "กำลัง Clone...")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3 p-4 bg-gray-50 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-800">
                        {cloneProgress.step || "กำลังดำเนินการ..."}
                      </span>
                      <span className="text-sm font-mono text-gray-500">
                        {cloneProgress.percent}% | {formatDuration(cloneElapsed)}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full transition-all duration-700 ease-out ${cloneProgress.status === "complete" ? "bg-green-500" : cloneProgress.status === "error" ? "bg-red-500" : "bg-blue-600"}`}
                        style={{ width: `${Math.max(cloneProgress.percent, 2)}%` }}
                      />
                    </div>

                    {cloning && cloneProgress.currentTable && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2" data-testid="table-detail-panel">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-blue-900">
                            ตาราง: {cloneProgress.currentTable}
                          </span>
                          <span className="text-xs font-mono bg-blue-100 px-2 py-0.5 rounded text-blue-700">
                            {cloneProgress.tableIndex}/{cloneProgress.totalTables}
                          </span>
                        </div>
                        <div className="grid grid-cols-4 gap-2 text-xs">
                          <div className="bg-white p-2 rounded border">
                            <p className="text-gray-500">ข้อมูล</p>
                            <p className="font-semibold text-gray-800">{(cloneProgress.rowCount ?? 0).toLocaleString()} rows</p>
                          </div>
                          <div className="bg-white p-2 rounded border">
                            <p className="text-gray-500">ขนาดไฟล์</p>
                            <p className="font-semibold text-gray-800">
                              {cloneProgress.transferredBytes || cloneProgress.dumpFileSize
                                ? `${((cloneProgress.transferredBytes || cloneProgress.dumpFileSize || 0) / 1024).toFixed(0)} KB`
                                : "-"}
                            </p>
                          </div>
                          <div className="bg-white p-2 rounded border">
                            <p className="text-gray-500">ความเร็ว</p>
                            <p className={`font-semibold ${(cloneProgress.transferSpeed ?? 0) > 0 ? "text-green-700" : "text-gray-800"}`}>
                              {cloneProgress.transferSpeed
                                ? cloneProgress.transferSpeed < 1024
                                  ? `${cloneProgress.transferSpeed} B/s`
                                  : cloneProgress.transferSpeed < 1024 * 1024
                                    ? `${(cloneProgress.transferSpeed / 1024).toFixed(1)} KB/s`
                                    : `${(cloneProgress.transferSpeed / (1024 * 1024)).toFixed(2)} MB/s`
                                : "-"}
                            </p>
                          </div>
                          <div className="bg-white p-2 rounded border">
                            <p className="text-gray-500">ใช้เวลาแล้ว</p>
                            <p className="font-semibold text-gray-800">{formatDuration(cloneProgress.tableElapsedSec ?? 0)}</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 text-blue-700">
                            {cloneProgress.batchPhase === "dump" ? (
                              <><HardDrive className="h-3 w-3" /> กำลังอ่านจากต้นทาง...</>
                            ) : cloneProgress.batchPhase === "restore" ? (
                              <><Send className="h-3 w-3" /> กำลังเขียนไปปลายทาง...</>
                            ) : (
                              <><Database className="h-3 w-3" /> กำลังเตรียมข้อมูล...</>
                            )}
                          </div>
                          {(cloneProgress.autoTimeoutSec ?? 300) < 300 && (
                            <span className={`text-xs ${(cloneProgress.autoTimeoutSec ?? 300) < 60 ? "text-red-600 font-semibold" : "text-gray-500"}`}>
                              Timeout: {formatDuration(cloneProgress.autoTimeoutSec ?? 300)}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {cloning && (
                      <div className="flex items-center gap-2 text-xs text-amber-600">
                        <Shield className="h-3 w-3" />
                        ระบบอยู่ในโหมดปรับปรุง — ผู้ใช้งานจะเห็นหน้าแจ้งปรับปรุง
                      </div>
                    )}
                  </div>

                  {completedTables.length > 0 && (
                    <div className="border rounded-lg overflow-hidden">
                      <button
                        onClick={() => setTableListExpanded(!tableListExpanded)}
                        className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                        data-testid="button-toggle-table-list"
                      >
                        <div className="flex items-center gap-2">
                          {tableListExpanded ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronRight className="h-4 w-4 text-gray-500" />}
                          <span className="text-sm font-semibold text-gray-800">สถานะรายตาราง</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          {successCount > 0 && (
                            <span className="flex items-center gap-1 text-green-700">
                              <CheckCircle2 className="h-3 w-3" /> {successCount}
                            </span>
                          )}
                          {errorCount > 0 && (
                            <span className="flex items-center gap-1 text-red-600">
                              <XCircle className="h-3 w-3" /> {errorCount}
                            </span>
                          )}
                          {droppedCount > 0 && (
                            <span className="flex items-center gap-1 text-gray-500">
                              <SkipForward className="h-3 w-3" /> {droppedCount}
                            </span>
                          )}
                          {cloneProgress.totalTables && (
                            <span className="text-gray-400">
                              {completedTables.length}/{cloneProgress.totalTables}
                            </span>
                          )}
                        </div>
                      </button>
                      {tableListExpanded && (
                        <div className="max-h-72 overflow-y-auto border-t divide-y">
                          {completedTables.map((t, i) => (
                            <div key={`${t.tableName}-${i}`} className="flex items-center gap-3 px-4 py-2 text-xs">
                              {t.status === "success" ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                              ) : t.status === "error" ? (
                                <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                              ) : t.status === "dropped" ? (
                                <MinusCircle className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                              ) : (
                                <Circle className="h-3.5 w-3.5 text-gray-300 shrink-0" />
                              )}
                              <span className={`flex-1 font-mono ${t.status === "error" ? "text-red-700" : t.status === "dropped" ? "text-gray-400" : "text-gray-700"}`}>
                                {t.tableName}
                              </span>
                              <span className="text-gray-400">
                                {t.rowCount > 0 ? `${t.rowCount.toLocaleString()} rows` : t.status === "dropped" ? "ไม่มี" : "—"}
                              </span>
                              {t.dumpFileSize && t.dumpFileSize > 0 ? (
                                <span className="text-gray-400 w-16 text-right" title="ขนาดไฟล์ dump">
                                  {t.dumpFileSize < 1024 ? `${t.dumpFileSize} B` : t.dumpFileSize < 1024 * 1024 ? `${(t.dumpFileSize / 1024).toFixed(0)} KB` : `${(t.dumpFileSize / (1024 * 1024)).toFixed(1)} MB`}
                                </span>
                              ) : (
                                <span className="text-gray-400 w-16 text-right">—</span>
                              )}
                              {t.restoreSpeed && t.restoreSpeed > 0 ? (
                                <span className={`w-20 text-right font-mono ${t.restoreSpeed > 512 * 1024 ? "text-green-600" : t.restoreSpeed > 50 * 1024 ? "text-blue-600" : "text-amber-600"}`} title="Outbound → TH">
                                  {t.restoreSpeed < 1024 ? `${t.restoreSpeed} B/s` : t.restoreSpeed < 1024 * 1024 ? `${(t.restoreSpeed / 1024).toFixed(1)} KB/s` : `${(t.restoreSpeed / (1024 * 1024)).toFixed(2)} MB/s`}
                                </span>
                              ) : (
                                <span className="text-gray-400 w-20 text-right">—</span>
                              )}
                              <span className="text-gray-400 w-16 text-right">
                                {t.durationMs > 0 ? formatMs(t.durationMs) : "—"}
                              </span>
                              {t.errorMessage && (
                                <span className="text-red-500 truncate max-w-[120px]" title={t.errorMessage}>
                                  {t.errorMessage}
                                </span>
                              )}
                            </div>
                          ))}
                          {cloning && cloneProgress.currentTable && (
                            <div className="flex items-center gap-3 px-4 py-2 text-xs bg-blue-50">
                              <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin shrink-0" />
                              <span className="flex-1 font-mono text-blue-700">{cloneProgress.currentTable}</span>
                              <span className="text-blue-500">กำลังทำงาน...</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {cloneProgress.status === "complete" && completedTables.length > 0 && (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                        <span className="text-sm font-semibold text-green-800">สรุปผล Clone</span>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="p-3 bg-white/70 rounded-lg text-center">
                          <p className="text-xs text-gray-500">สำเร็จ / ล้มเหลว</p>
                          <p className="text-lg font-bold">
                            <span className="text-green-700">{successCount}</span>
                            {errorCount > 0 && <span className="text-red-600"> / {errorCount}</span>}
                          </p>
                        </div>
                        <div className="p-3 bg-white/70 rounded-lg text-center">
                          <p className="text-xs text-gray-500">ข้อมูล / ขนาด</p>
                          <p className="text-lg font-bold text-gray-800">{totalRows.toLocaleString()} <span className="text-sm font-normal text-gray-500">({fmtSize(totalDumpBytes)})</span></p>
                        </div>
                        <div className="p-3 bg-white/70 rounded-lg text-center">
                          <p className="text-xs text-gray-500">ใช้เวลา</p>
                          <p className="text-lg font-bold text-gray-800">{formatDuration(cloneElapsed)}</p>
                        </div>
                      </div>
                      {avgOutboundSpeed > 0 && (
                        <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-blue-800 font-medium">Outbound → TH (เฉลี่ย)</span>
                            <span className="font-mono font-bold text-blue-700">{fmtSpeed(avgOutboundSpeed)}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs text-blue-600 mt-1">
                            <span>Min: {fmtSpeed(Math.min(...tablesWithSpeed.map(t => t.restoreSpeed!)))}</span>
                            <span>Max: {fmtSpeed(Math.max(...tablesWithSpeed.map(t => t.restoreSpeed!)))}</span>
                            <span>{tablesWithSpeed.length} ตาราง</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {error && (
                    <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <XCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-red-800">Clone ไม่สำเร็จ</p>
                        <p className="text-xs text-red-700 mt-1">{error}</p>
                        <p className="text-xs text-gray-500 mt-1">ระบบปิดโหมดปรับปรุงอัตโนมัติแล้ว</p>
                      </div>
                    </div>
                  )}

                  {success && !cloning && !error && (
                    <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                      <p className="text-sm text-green-700">{success}</p>
                    </div>
                  )}

                  {!cloning && (
                    <Button variant="outline" onClick={goBackToTypeSelect} data-testid="button-new-clone">
                      <ArrowLeft className="h-4 w-4 mr-1" /> เริ่มใหม่
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-4">
            <Card className="border-l-4 border-l-blue-500">
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <Zap className="h-5 w-5 text-blue-500 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm">Clone ทำอะไรบ้าง?</h3>
                    <ol className="mt-2 text-xs text-gray-600 space-y-1.5 list-decimal list-inside">
                      <li>เปิดโหมดปรับปรุงอัตโนมัติ</li>
                      <li>ทดสอบเชื่อมต่อเซิร์ฟเวอร์ปลายทาง</li>
                      <li>ตรวจสอบพื้นที่ดิสก์ปลายทาง</li>
                      <li>Dump ข้อมูลจากต้นทาง (แบบ Batch)</li>
                      <li>Restore ข้อมูลไปปลายทาง (แบบ Batch)</li>
                      <li>บันทึกประวัติ Clone ทุกตาราง</li>
                      <li>ปิดโหมดปรับปรุงอัตโนมัติ</li>
                    </ol>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-amber-500">
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 text-amber-500 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm">การป้องกัน</h3>
                    <ul className="mt-2 text-xs text-gray-600 space-y-1.5">
                      <li>• ระบบล็อคผู้ใช้ระหว่าง Clone</li>
                      <li>• ไม่สามารถปิดโหมดปรับปรุงด้วยมือ</li>
                      <li>• ถ้า Clone ล้มเหลว → ปลดล็อคอัตโนมัติ</li>
                      <li>• มีเพียง 1 ผู้ดูแลใช้หน้านี้ได้ต่อครั้ง</li>
                      <li>• Timer ถูก Freeze ขณะอยู่ในหน้านี้</li>
                      <li>• ตารางที่ล้มเหลวจะถูก wipe ป้องกันข้อมูลครึ่งๆ</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            {cloneHistory.length > 0 && (
              <Card className="border-l-4 border-l-gray-300">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <History className="h-4 w-4 text-gray-500" />
                    <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                      ประวัติ Clone
                      {cloneHistorySource === "central" && (
                        <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded" data-testid="badge-clone-source-central">จาก Central DB</span>
                      )}
                      {cloneHistorySource === "local" && cloneHistory.length > 0 && (
                        <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded" data-testid="badge-clone-source-local">จาก Local DB</span>
                      )}
                    </h3>
                  </div>
                  <div className="space-y-3">
                    {cloneHistory.slice(0, 5).map((h) => {
                      const startTimes = h.tables.map(t => t.startedAt ? new Date(t.startedAt).getTime() : Infinity);
                      const endTimes = h.tables.map(t => t.completedAt ? new Date(t.completedAt).getTime() : 0);
                      const wallClockMs = Math.max(...endTimes) - Math.min(...startTimes);
                      const totalDuration = wallClockMs > 0 && wallClockMs < 86400000 ? wallClockMs : h.tables.reduce((s, t) => s + (t.hostDurationMs || 0) + (t.remoteDurationMs || 0), 0);
                      const sCount = h.tables.filter(t => t.status === "success").length;
                      const eCount = h.tables.filter(t => t.status === "error").length;
                      return (
                        <div key={h.sessionId} className="flex items-start gap-2 text-xs">
                          {h.status === "success" || eCount === 0 ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="text-gray-700">
                              {h.startedAt ? formatThaiDate(h.startedAt) : "—"}
                            </p>
                            <p className="text-gray-500">
                              {h.cloneType === "static" ? "Static" : h.cloneType === "transaction" ? "Transaction" : "Manual"}
                              {" — "}{sCount} สำเร็จ
                              {eCount > 0 && `, ${eCount} ล้มเหลว`}
                            </p>
                            <p className="text-gray-400">
                              {h.direction === "th_to_us" ? "🇹🇭 TH → US 🇺🇸" : "🇺🇸 US → TH 🇹🇭"}
                              {totalDuration > 0 && ` (${formatMs(totalDuration)})`}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </PlatformLayout>
  );
}
