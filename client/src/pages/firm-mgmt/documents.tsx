import { useState, useMemo, useRef, useEffect } from "react";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  FolderOpen, Upload, Download, Trash2, Plus, FileText, Link as LinkIcon,
  ExternalLink, Search, Pencil, X, File, FileSpreadsheet, FileImage,
  Loader2, Globe, ChevronRight, FolderPlus, ArrowLeft, Folder, MoreVertical,
  Copy, Eye, EyeOff, Share2, Users, Calendar, Clock, CheckCircle2,
  ChevronLeft, Maximize2, Minimize2, MessageCircle, ChevronDown, ChevronUp,
  ClipboardList, Building2, Paperclip,
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { objectPathToUrl } from "@/lib/utils";
import { useCompany } from "@/lib/company-context";

function AuthImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch(src, { credentials: "include" })
      .then(r => { if (!r.ok) throw new Error("Failed"); return r.blob(); })
      .then(blob => { if (!cancelled) setBlobUrl(URL.createObjectURL(blob)); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; if (blobUrl) URL.revokeObjectURL(blobUrl); };
  }, [src]);
  if (error) return <div className="text-white text-center"><File className="w-16 h-16 mx-auto mb-2 text-gray-400" /><p>ไม่สามารถโหลดรูปได้</p></div>;
  if (!blobUrl) return <Loader2 className="w-8 h-8 animate-spin text-gray-400" />;
  return <img src={blobUrl} alt={alt} className={className} />;
}

const FOLDER_COLORS = [
  "var(--theme-primary)", "#05b187", "#fb9678", "#fec90f", "#03c9d7",
  "#f94d4d", "#9c27b0", "#607d8b", "#ff5722", "#795548",
];

const THAI_MONTHS = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];

function getFileIcon(mimeType?: string | null) {
  if (!mimeType) return File;
  if (mimeType.includes("pdf")) return FileText;
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel") || mimeType.includes("csv")) return FileSpreadsheet;
  if (mimeType.includes("image")) return FileImage;
  return File;
}

function formatFileSize(bytes?: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const LINE_ICON = (props: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={props.className}><path d="M12 2C6.48 2 2 5.81 2 10.5c0 2.49 1.29 4.72 3.33 6.3-.13.47-.74 2.66-.77 2.84 0 0-.02.15.07.21s.2.02.2.02c.27-.04 3.12-2.04 3.62-2.39.48.07.98.12 1.55.12 5.52 0 10-3.81 10-8.5S17.52 2 12 2z"/></svg>
);

const SOURCE_TABS = [
  { key: "link" as const, label: "จากลิงก์", icon: LinkIcon, color: "#fb9678" },
  { key: "line" as const, label: "จาก LINE", icon: MessageCircle, color: "#06C755" },
  { key: "staff" as const, label: "พนักงานอัปโหลด", icon: Upload, color: "#03c9d7" },
];

function ClientDocumentsTab({ companyId }: { companyId: number | null }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [filterClient, setFilterClient] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState<{ month: number; year: number } | null>(null);
  const [sourceTab, setSourceTab] = useState<"link" | "line" | "staff">("link");
  const [activeLinkId, setActiveLinkId] = useState<number | null>(null);
  const [formClientId, setFormClientId] = useState("");
  const [formMonth, setFormMonth] = useState(String(new Date().getMonth() + 1));
  const [formYear, setFormYear] = useState(String(new Date().getFullYear() + 543));
  const [formMaxFiles, setFormMaxFiles] = useState("50");
  const [copySuccess, setCopySuccess] = useState<number | null>(null);
  const [viewerFileIndex, setViewerFileIndex] = useState<number | null>(null);
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const staffFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSelectedMonth(null);
    setFilterClient("all");
    setSourceTab("link");
    setActiveLinkId(null);
  }, [companyId]);

  const { data: clients = [] } = useQuery<any[]>({
    queryKey: ["/api/firm-clients", companyId],
    queryFn: async () => { const r = await fetch("/api/firm-clients", { credentials: "include" }); return r.ok ? r.json() : []; },
  });

  const companyClients = useMemo(() => {
    if (!companyId) return clients;
    return clients.filter((c: any) => c.companyId === companyId);
  }, [clients, companyId]);

  useEffect(() => {
    if (companyClients.length === 1) {
      setFilterClient(String(companyClients[0].id));
    }
  }, [companyClients]);

  useEffect(() => {
    if (createOpen && companyClients.length > 0 && !formClientId) {
      setFormClientId(String(companyClients[0].id));
    }
  }, [createOpen, companyClients]);

  const firmClientIdForQuery = filterClient !== "all" ? Number(filterClient) : undefined;

  const { data: monthSummary = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/client-documents/monthly-summary", companyId, firmClientIdForQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (companyId) params.set("companyId", String(companyId));
      if (firmClientIdForQuery) params.set("firmClientId", String(firmClientIdForQuery));
      const r = await fetch(`/api/client-documents/monthly-summary?${params}`, { credentials: "include" });
      return r.ok ? r.json() : [];
    },
    refetchInterval: 30000,
  });

  const { data: monthFiles = [], isLoading: filesLoading } = useQuery<any[]>({
    queryKey: ["/api/client-documents/month-files", companyId, firmClientIdForQuery, selectedMonth?.month, selectedMonth?.year, sourceTab],
    queryFn: async () => {
      if (!selectedMonth) return [];
      const params = new URLSearchParams();
      if (companyId) params.set("companyId", String(companyId));
      if (firmClientIdForQuery) params.set("firmClientId", String(firmClientIdForQuery));
      params.set("month", String(selectedMonth.month));
      params.set("year", String(selectedMonth.year));
      params.set("source", sourceTab);
      const r = await fetch(`/api/client-documents/month-files?${params}`, { credentials: "include" });
      return r.ok ? r.json() : [];
    },
    enabled: !!selectedMonth,
  });

  const { data: monthLinks = [] } = useQuery<any[]>({
    queryKey: ["/api/client-documents/month-links", companyId, firmClientIdForQuery, selectedMonth?.month, selectedMonth?.year],
    queryFn: async () => {
      if (!selectedMonth) return [];
      const params = new URLSearchParams();
      if (companyId) params.set("companyId", String(companyId));
      if (firmClientIdForQuery) params.set("firmClientId", String(firmClientIdForQuery));
      params.set("month", String(selectedMonth.month));
      params.set("year", String(selectedMonth.year));
      const r = await fetch(`/api/client-documents/month-links?${params}`, { credentials: "include" });
      return r.ok ? r.json() : [];
    },
    enabled: !!selectedMonth && sourceTab === "link",
  });

  const createLink = useMutation({
    mutationFn: async (data: any) => {
      const r = await apiRequest("POST", "/api/client-upload-links", data);
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "สร้างลิงก์สำเร็จ" });
      qc.invalidateQueries({ queryKey: ["/api/client-documents/monthly-summary"] });
      qc.invalidateQueries({ queryKey: ["/api/client-documents/month-links"] });
      setCreateOpen(false);
      setFormClientId("");
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const toggleLink = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const r = await apiRequest("PATCH", `/api/client-upload-links/${id}`, { isActive });
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/client-documents/month-links"] }),
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const markRead = useMutation({
    mutationFn: async (fileId: number) => {
      await apiRequest("PATCH", `/api/client-upload-files/${fileId}/read`, {});
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/client-documents/month-files"] });
      qc.invalidateQueries({ queryKey: ["/api/client-documents/monthly-summary"] });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const activeLink = useMemo(() => monthLinks.find((l: any) => l.id === activeLinkId) || monthLinks[0] || null, [monthLinks, activeLinkId]);

  useEffect(() => {
    if (monthLinks.length > 0 && !monthLinks.find((l: any) => l.id === activeLinkId)) {
      setActiveLinkId(monthLinks[0].id);
    }
  }, [monthLinks]);

  const deleteLink = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/client-upload-links/${id}`); },
    onSuccess: () => {
      toast({ title: "ลบลิงก์แล้ว" });
      qc.invalidateQueries({ queryKey: ["/api/client-documents"] });
      setActiveLinkId(null);
    },
    onError: (err: any) => toast({ title: "ลบไม่สำเร็จ", description: err.message, variant: "destructive" }),
  });

  const deleteFile = useMutation({
    mutationFn: async ({ id, source }: { id: number; source: string }) => {
      const endpoint = source === "line" ? `/api/line-documents/${id}` : `/api/client-upload-files/${id}`;
      await apiRequest("DELETE", endpoint);
    },
    onSuccess: () => {
      toast({ title: "ลบไฟล์แล้ว" });
      qc.invalidateQueries({ queryKey: ["/api/client-documents"] });
    },
    onError: (err: any) => toast({ title: "ลบไม่สำเร็จ", description: err.message, variant: "destructive" }),
  });

  const batchDelete = useMutation({
    mutationFn: async (items: { id: number; source: string }[]) => {
      const r = await apiRequest("POST", "/api/client-documents/batch-delete", { items });
      return r.json();
    },
    onSuccess: (data) => {
      toast({ title: `ลบแล้ว ${data.deleted} ไฟล์` });
      setSelectedFileIds(new Set());
      qc.invalidateQueries({ queryKey: ["/api/client-documents"] });
    },
    onError: (err: any) => toast({ title: "ลบไม่สำเร็จ", description: err.message, variant: "destructive" }),
  });

  const staffUpload = useMutation({
    mutationFn: async (files: FileList) => {
      if (!selectedMonth) throw new Error("กรุณาเลือกเดือน");
      const formData = new FormData();
      Array.from(files).forEach(f => formData.append("files", f));
      formData.append("month", String(selectedMonth.month));
      formData.append("year", String(selectedMonth.year));
      const r = await fetch("/api/client-documents/staff-direct-upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!r.ok) { const err = await r.json(); throw new Error(err.message); }
      return r.json();
    },
    onSuccess: (data) => {
      toast({ title: `อัปโหลดสำเร็จ ${data.count} ไฟล์` });
      qc.invalidateQueries({ queryKey: ["/api/client-documents/month-files"] });
      qc.invalidateQueries({ queryKey: ["/api/client-documents/monthly-summary"] });
      if (staffFileRef.current) staffFileRef.current.value = "";
    },
    onError: (err: any) => toast({ title: "อัปโหลดไม่สำเร็จ", description: err.message, variant: "destructive" }),
  });

  const toggleFileSelection = (fileKey: string) => {
    setSelectedFileIds(prev => {
      const next = new Set(prev);
      if (next.has(fileKey)) next.delete(fileKey); else next.add(fileKey);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (!monthFiles || monthFiles.length === 0) return;
    const allKeys = monthFiles.filter((f: any) => f.objectPath).map((f: any) => `${f.source}-${f.id}`);
    if (allKeys.every((k: string) => selectedFileIds.has(k))) {
      setSelectedFileIds(new Set());
    } else {
      setSelectedFileIds(new Set(allKeys));
    }
  };
  const downloadSelected = async () => {
    const selected = (monthFiles || []).filter((f: any) => selectedFileIds.has(`${f.source}-${f.id}`) && f.objectPath);
    if (selected.length === 0) return;
    if (selected.length === 1) {
      const f = selected[0];
      const a = document.createElement("a");
      a.href = f.source === "line" ? `/api/line-documents/${f.id}/download` : objectPathToUrl(f.objectPath);
      a.download = f.fileName;
      a.click();
      return;
    }
    setIsDownloadingZip(true);
    try {
      const resp = await fetch("/api/client-documents/batch-download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ items: selected.map((f: any) => ({ id: f.id, objectPath: f.objectPath, fileName: f.fileName })) }),
      });
      if (!resp.ok) throw new Error("ดาวน์โหลดไม่สำเร็จ");
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `documents-${Date.now()}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({ title: "ดาวน์โหลดไม่สำเร็จ", description: err.message, variant: "destructive" });
    } finally {
      setIsDownloadingZip(false);
    }
  };

  const sendLine = useMutation({
    mutationFn: async (linkId: number) => {
      const r = await apiRequest("POST", `/api/client-upload-links/${linkId}/send-line`, {});
      return r.json();
    },
    onSuccess: (data) => toast({ title: data.message || "ส่ง LINE สำเร็จ" }),
    onError: (err: any) => toast({ title: "ส่ง LINE ไม่สำเร็จ", description: err.message, variant: "destructive" }),
  });

  useEffect(() => {
    if (viewerFileIndex === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setViewerFileIndex(null);
      if (e.key === "ArrowRight" && viewerFileIndex < monthFiles.length - 1) {
        const next = viewerFileIndex + 1;
        setViewerFileIndex(next);
        const f = monthFiles[next];
        if (f?.source !== "line" && !f?.isRead) markRead.mutate(f.id);
      }
      if (e.key === "ArrowLeft" && viewerFileIndex > 0) {
        const prev = viewerFileIndex - 1;
        setViewerFileIndex(prev);
        const f = monthFiles[prev];
        if (f?.source !== "line" && !f?.isRead) markRead.mutate(f.id);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [viewerFileIndex, monthFiles]);

  const handleCreate = () => {
    const adYear = Number(formYear) - 543;
    const client = companyClients.find((c: any) => String(c.id) === formClientId);
    const monthLabel = THAI_MONTHS[Number(formMonth) - 1];
    createLink.mutate({
      firmClientId: formClientId ? Number(formClientId) : null,
      label: client ? `${client.name} — ${monthLabel} ${formYear}` : `เอกสาร ${monthLabel} ${formYear}`,
      month: Number(formMonth),
      year: adYear,
      maxFiles: Number(formMaxFiles) || 50,
    });
  };

  const copyLink = (token: string, id: number) => {
    const url = `${window.location.origin}/upload/${token}`;
    navigator.clipboard.writeText(url);
    setCopySuccess(id);
    setTimeout(() => setCopySuccess(null), 2000);
    toast({ title: "คัดลอกลิงก์แล้ว" });
  };

  const currentSummary = selectedMonth ? monthSummary.find((m: any) => m.month === selectedMonth.month && m.year === selectedMonth.year) : null;

  if (isLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;

  return (
    <div className="flex gap-4 h-full" style={{ minHeight: 500 }}>
      <div className="w-[340px] flex-shrink-0 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <Select value={filterClient} onValueChange={v => { setFilterClient(v); setSelectedMonth(null); }}>
            <SelectTrigger className="h-8 text-xs w-[180px]">
              <SelectValue placeholder="ลูกค้าทั้งหมด" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ลูกค้าทั้งหมด</SelectItem>
              {companyClients.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" className="h-8 bg-[#fb9678] hover:bg-[#e8856a] text-white" onClick={() => { setFormClientId(companyClients.length > 0 ? String(companyClients[0].id) : ""); setCreateOpen(true); }} data-testid="btn-create-upload-link">
            <Plus className="w-4 h-4 mr-1" /> สร้างลิงก์
          </Button>
        </div>

        <div className="space-y-1.5 overflow-y-auto flex-1">
          {monthSummary.length === 0 && (
            <div className="text-center py-10 text-gray-400 text-sm">
              <Folder className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              ยังไม่มีเอกสาร
            </div>
          )}
          {monthSummary.map((m: any) => {
            const isSelected = selectedMonth?.month === m.month && selectedMonth?.year === m.year;
            return (
              <div
                key={`${m.year}-${m.month}`}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${isSelected ? "border-[#fb9678] bg-[#fb9678]/5" : "border-border hover:border-muted-foreground/30 bg-card"}`}
                onClick={() => {
                  setSelectedMonth({ month: m.month, year: m.year });
                  const bestTab = m.linkCount > 0 ? "link" : m.lineCount > 0 ? "line" : m.staffCount > 0 ? "staff" : "link";
                  setSourceTab(bestTab);
                  setViewerFileIndex(null);
                  setSelectedFileIds(new Set());
                }}
                data-testid={`month-folder-${m.year}-${m.month}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#fb9678]/10 flex-shrink-0">
                    <Folder className="w-4.5 h-4.5 text-[#fb9678]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-foreground">{m.monthLabel} {m.yearBE}</span>
                    <div className="flex items-center gap-2 mt-1">
                      {m.linkCount > 0 && (
                        <span className="flex items-center gap-0.5 text-[11px] text-[#fb9678]">
                          <LinkIcon className="w-3 h-3" />{m.linkCount}
                        </span>
                      )}
                      {m.lineCount > 0 && (
                        <span className="flex items-center gap-0.5 text-[11px] text-[#06C755]">
                          <LINE_ICON className="w-3 h-3" />{m.lineCount}
                        </span>
                      )}
                      {m.staffCount > 0 && (
                        <span className="flex items-center gap-0.5 text-[11px] text-[#03c9d7]">
                          <Upload className="w-3 h-3" />{m.staffCount}
                        </span>
                      )}
                      {(m as any).boardCount > 0 && (
                        <span className="flex items-center gap-0.5 text-[11px] text-purple-500">
                          <ClipboardList className="w-3 h-3" />{(m as any).boardCount}
                        </span>
                      )}
                      <span className="text-[11px] text-gray-400">รวม {m.totalCount}</span>
                    </div>
                  </div>
                  {m.unreadCount > 0 && (
                    <Badge className="bg-[#fb9678] text-white text-[10px] px-1.5 py-0">{m.unreadCount} ใหม่</Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        {!selectedMonth ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <FolderOpen className="w-16 h-16 mb-3 text-gray-300" />
            <p className="text-sm">เลือกโฟลเดอร์เพื่อดูเอกสาร</p>
          </div>
        ) : (
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-base font-semibold text-gray-800">
                  {THAI_MONTHS[selectedMonth.month - 1]} {selectedMonth.year + 543}
                </h3>
                <p className="text-xs text-gray-400">{currentSummary?.totalCount || 0} ไฟล์ทั้งหมด</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  ref={staffFileRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={e => { if (e.target.files?.length) staffUpload.mutate(e.target.files); }}
                  data-testid="staff-upload-input"
                />
                {(sourceTab === "staff" || (sourceTab === "link" && activeLink)) && (
                  <Button size="sm" variant="outline" className="h-8 text-xs border-[#03c9d7] text-[#03c9d7]" onClick={() => staffFileRef.current?.click()} disabled={staffUpload.isPending}>
                    {staffUpload.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Upload className="w-3.5 h-3.5 mr-1" />}
                    เพิ่มไฟล์
                  </Button>
                )}
                {sourceTab === "link" && activeLink?.firmClientId && (
                  <Button size="sm" variant="outline" className="h-8 text-xs border-green-500 text-green-600" onClick={() => sendLine.mutate(activeLink.id)} disabled={sendLine.isPending}>
                    {sendLine.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <LINE_ICON className="w-3.5 h-3.5 mr-1" />}
                    ส่ง LINE
                  </Button>
                )}
                {sourceTab === "link" && activeLink && (
                  <Button size="sm" variant="outline" className="h-8 text-xs border-[#fb9678] text-[#fb9678]" onClick={() => copyLink(activeLink.token, activeLink.id)}>
                    <Share2 className="w-3.5 h-3.5 mr-1" /> แชร์ลิงก์
                  </Button>
                )}
              </div>
            </div>

            <div className="flex border-b border-gray-200 mb-3">
              {SOURCE_TABS.map(tab => {
                const count = currentSummary ? (tab.key === "link" ? currentSummary.linkCount : tab.key === "line" ? currentSummary.lineCount : tab.key === "board" ? currentSummary.boardCount : currentSummary.staffCount) : 0;
                return (
                  <button
                    key={tab.key}
                    className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${sourceTab === tab.key ? `border-current` : "border-transparent text-gray-400 hover:text-gray-600"}`}
                    style={sourceTab === tab.key ? { color: tab.color, borderColor: tab.color } : undefined}
                    onClick={() => { setSourceTab(tab.key); setViewerFileIndex(null); setSelectedFileIds(new Set()); }}
                    data-testid={`source-tab-${tab.key}`}
                  >
                    <tab.icon className="w-3.5 h-3.5" />
                    {tab.label}
                    {count > 0 && (
                      <span className={`text-[10px] px-1.5 py-0 rounded-full ${sourceTab === tab.key ? "bg-current/10" : "bg-gray-100"}`} style={sourceTab === tab.key ? { backgroundColor: `${tab.color}20`, color: tab.color } : undefined}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {sourceTab === "link" && monthLinks.length > 0 && (
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                {monthLinks.map((link: any) => {
                  const isActive = activeLinkId === link.id;
                  return (
                    <div
                      key={link.id}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs cursor-pointer transition-colors ${isActive ? "border-[#fb9678] bg-[#fb9678]/10 text-[#fb9678]" : "border-border bg-muted text-muted-foreground hover:border-muted-foreground/30"}`}
                      onClick={() => setActiveLinkId(link.id)}
                    >
                      <LinkIcon className="w-3 h-3" />
                      <span className="truncate max-w-[160px]">{link.firmClientName || link.label || "ลิงก์"}</span>
                      <span className="text-[10px] text-gray-400">({link._fileCount || 0})</span>
                      {link.isActive ? (
                        <Badge className="bg-green-100 text-green-700 text-[9px] px-1 py-0">เปิด</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[9px] px-1 py-0">ปิด</Badge>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-0.5 rounded hover:bg-gray-200" onClick={e => e.stopPropagation()}><MoreVertical className="w-3 h-3 text-gray-400" /></button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => copyLink(link.token, link.id)}>
                            <Copy className="w-3.5 h-3.5 mr-2" /> คัดลอกลิงก์
                          </DropdownMenuItem>
                          {link.firmClientId && (
                            <DropdownMenuItem onClick={() => sendLine.mutate(link.id)} disabled={sendLine.isPending}>
                              <LINE_ICON className="w-3.5 h-3.5 mr-2 text-green-500" /> ส่งทาง LINE
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => toggleLink.mutate({ id: link.id, isActive: !link.isActive })}>
                            {link.isActive ? <><EyeOff className="w-3.5 h-3.5 mr-2" /> ปิดลิงก์</> : <><Eye className="w-3.5 h-3.5 mr-2" /> เปิดลิงก์</>}
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-red-500" onClick={() => { if (confirm("ลบลิงก์นี้?")) deleteLink.mutate(link.id); }}>
                            <Trash2 className="w-3.5 h-3.5 mr-2" /> ลบ
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      {copySuccess === link.id && <span className="text-green-600 text-[10px]">คัดลอกแล้ว!</span>}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex-1 overflow-y-auto">
              {filesLoading ? (
                <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
              ) : monthFiles.length === 0 ? (
                <div className="text-center py-16 text-gray-400 text-sm">
                  <Clock className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                  {sourceTab === "link" && monthLinks.length === 0 ? (
                    <>ยังไม่มีลิงก์สำหรับเดือนนี้<br/><span className="text-xs">กด "สร้างลิงก์" เพื่อเริ่มรับเอกสาร</span></>
                  ) : sourceTab === "line" ? (
                    <>ยังไม่มีเอกสารจาก LINE ในเดือนนี้</>
                  ) : sourceTab === "staff" ? (
                    <>ยังไม่มีไฟล์ที่พนักงานอัปโหลดในเดือนนี้</>
                  ) : (
                    <>ยังไม่มีไฟล์ในเดือนนี้</>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {(() => {
                    const downloadableFiles = monthFiles.filter((f: any) => f.objectPath);
                    const allSelected = downloadableFiles.length > 0 && downloadableFiles.every((f: any) => selectedFileIds.has(`${f.source}-${f.id}`));
                    const someSelected = downloadableFiles.some((f: any) => selectedFileIds.has(`${f.source}-${f.id}`));
                    return (
                      <div className="flex items-center justify-between px-1 py-1.5">
                        <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-500">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                            onChange={toggleSelectAll}
                            className="w-4 h-4 rounded border-gray-300 accent-[#fb9678]"
                            data-testid="select-all-files"
                          />
                          เลือกทั้งหมด ({downloadableFiles.length})
                        </label>
                        {someSelected && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={downloadSelected}
                              disabled={isDownloadingZip}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[#03c9d7] text-white rounded-lg hover:bg-[#03c9d7]/90 disabled:opacity-50"
                              data-testid="btn-download-selected"
                            >
                              {isDownloadingZip ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                              ดาวน์โหลด {selectedFileIds.size} ไฟล์
                            </button>
                            <button
                              onClick={() => {
                                const selected = (monthFiles || []).filter((f: any) => selectedFileIds.has(`${f.source}-${f.id}`));
                                if (selected.length === 0) return;
                                if (!confirm(`ลบ ${selected.length} ไฟล์ที่เลือก?`)) return;
                                batchDelete.mutate(selected.map((f: any) => ({ id: f.id, source: f.source })));
                              }}
                              disabled={batchDelete.isPending}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
                              data-testid="btn-delete-selected"
                            >
                              {batchDelete.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                              ลบ {selectedFileIds.size} ไฟล์
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  {monthFiles.map((f: any, idx: number) => {
                    const Icon = getFileIcon(f.mimeType);
                    const isLine = f.source === "line";
                    const fileKey = `${f.source}-${f.id}`;
                    const isChecked = selectedFileIds.has(fileKey);
                    return (
                      <div key={fileKey} className={`flex items-center gap-3 p-3 rounded-lg border ${isChecked ? "border-[#03c9d7]/40 bg-[#03c9d7]/5" : !isLine && !f.isRead ? "border-[#fb9678]/30 bg-[#fb9678]/5" : "border-border bg-card"}`}>
                        {f.objectPath && (
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleFileSelection(fileKey)}
                            className="w-4 h-4 rounded border-gray-300 accent-[#03c9d7] flex-shrink-0"
                            data-testid={`checkbox-file-${fileKey}`}
                          />
                        )}
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-gray-100 flex-shrink-0">
                          <Icon className="w-4.5 h-4.5 text-gray-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-800 truncate">{f.fileName}</span>
                            {!isLine && !f.isRead && <Badge className="bg-[#fb9678] text-white text-[9px] px-1 py-0">ใหม่</Badge>}
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-gray-400 mt-0.5 flex-wrap">
                            <span>{formatFileSize(f.fileSize)}</span>
                            {isLine && f.senderName && <span className="text-[#06C755]">จาก: {f.senderName}</span>}
                            {!isLine && f.uploaderName && <span>จาก: {f.uploaderName}</span>}
                            {f.createdAt && <span>{new Date(f.createdAt).toLocaleDateString("th-TH")}</span>}
                            {!isLine && f.folderPath && (
                              <span className="text-[#03c9d7] flex items-center gap-0.5">📁 {f.folderPath}</span>
                            )}
                            {!isLine && f.category && f.category !== "อื่นๆ" && f.category !== "พนักงานอัปโหลด" && !f.folderPath && (
                              <Badge variant="secondary" className="text-[10px] px-1 py-0">{f.category}</Badge>
                            )}
                          </div>
                          {!isLine && f.uploaderNote && <p className="text-xs text-gray-500 mt-1">{f.uploaderNote}</p>}
                        </div>
                        <div className="flex items-center gap-1">
                          {!isLine && !f.isRead && (
                            <button className="p-1.5 rounded hover:bg-green-50" title="ทำเครื่องหมายอ่านแล้ว" onClick={() => markRead.mutate(f.id)}>
                              <CheckCircle2 className="w-4 h-4 text-green-500" />
                            </button>
                          )}
                          {f.objectPath && (
                            <button className="p-1.5 rounded hover:bg-blue-50" title="ดูเอกสาร" onClick={() => {
                              setViewerFileIndex(idx);
                              if (!isLine && !f.isRead) markRead.mutate(f.id);
                            }}>
                              <Eye className="w-4 h-4 text-blue-500" />
                            </button>
                          )}
                          {f.objectPath && (
                            <button className="p-1.5 rounded hover:bg-gray-100" title="ดาวน์โหลด" onClick={async () => {
                              const dlUrl = isLine ? `/api/line-documents/${f.id}/download` : objectPathToUrl(f.objectPath);
                              try {
                                const r = await fetch(dlUrl, { credentials: "include" });
                                if (!r.ok) throw new Error("Download failed");
                                const blob = await r.blob();
                                const a = document.createElement("a");
                                a.href = URL.createObjectURL(blob);
                                a.download = f.fileName;
                                a.click();
                                URL.revokeObjectURL(a.href);
                              } catch { window.open(dlUrl, "_blank"); }
                            }}>
                              <Download className="w-4 h-4 text-gray-500" />
                            </button>
                          )}
                          <button
                            className="p-1.5 rounded hover:bg-red-50"
                            title="ลบ"
                            onClick={() => { if (confirm("ลบไฟล์นี้?")) deleteFile.mutate({ id: f.id, source: f.source }); }}
                          >
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {viewerFileIndex !== null && monthFiles[viewerFileIndex] && (() => {
        const file = monthFiles[viewerFileIndex];
        const url = file.source === "line" ? `/api/line-documents/${file.id}/download` : objectPathToUrl(file.objectPath);
        const canPreview = file.mimeType?.includes("pdf") || file.mimeType?.includes("image");
        const total = monthFiles.length;
        return (
          <div className="fixed inset-0 z-50 bg-black/60 flex flex-col" data-testid="document-viewer">
            <div className="flex items-center justify-between px-4 py-2 bg-gray-900 text-white">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <span className="text-sm font-medium truncate">{file.fileName}</span>
                <span className="text-xs text-gray-400 flex-shrink-0">{viewerFileIndex + 1} / {total}</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  className="p-2 rounded hover:bg-gray-700 disabled:opacity-30"
                  disabled={viewerFileIndex <= 0}
                  onClick={() => {
                    const prev = viewerFileIndex - 1;
                    setViewerFileIndex(prev);
                    const f = monthFiles[prev];
                    if (f?.source !== "line" && !f?.isRead) markRead.mutate(f.id);
                  }}
                  title="ก่อนหน้า"
                  data-testid="viewer-prev"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  className="p-2 rounded hover:bg-gray-700 disabled:opacity-30"
                  disabled={viewerFileIndex >= total - 1}
                  onClick={() => {
                    const next = viewerFileIndex + 1;
                    setViewerFileIndex(next);
                    const f = monthFiles[next];
                    if (f?.source !== "line" && !f?.isRead) markRead.mutate(f.id);
                  }}
                  title="ถัดไป"
                  data-testid="viewer-next"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
                <a href={url} target="_blank" rel="noopener noreferrer" className="p-2 rounded hover:bg-gray-700" title="เปิดในแท็บใหม่">
                  <ExternalLink className="w-5 h-5" />
                </a>
                <a href={url} download={file.fileName} className="p-2 rounded hover:bg-gray-700" title="ดาวน์โหลด">
                  <Download className="w-5 h-5" />
                </a>
                <button className="p-2 rounded hover:bg-gray-700" onClick={() => setViewerFileIndex(null)} title="ปิด" data-testid="viewer-close">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 flex items-center justify-center overflow-hidden bg-gray-800">
              {canPreview ? (
                file.mimeType?.includes("image") ? (
                  <AuthImage src={url} alt={file.fileName} className="max-w-full max-h-full object-contain" />
                ) : (
                  <iframe src={url} className="w-full h-full border-0 bg-white" title={file.fileName} />
                )
              ) : (
                <div className="text-center text-white">
                  <File className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                  <p className="text-lg font-medium mb-2">{file.fileName}</p>
                  <p className="text-sm text-gray-400 mb-4">{formatFileSize(file.fileSize)}</p>
                  <a href={url} download={file.fileName} className="inline-flex items-center gap-2 px-4 py-2 bg-[#fb9678] text-white rounded-lg hover:bg-[#e8856a]">
                    <Download className="w-4 h-4" /> ดาวน์โหลดไฟล์
                  </a>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>สร้างลิงก์อัปโหลดเอกสาร</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">ลูกค้า</Label>
              <Select value={formClientId} onValueChange={setFormClientId}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="เลือกลูกค้า (ไม่บังคับ)" />
                </SelectTrigger>
                <SelectContent>
                  {companyClients.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">เดือน</Label>
                <Select value={formMonth} onValueChange={setFormMonth}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-52">
                    {THAI_MONTHS.map((m, i) => <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">ปี (พ.ศ.)</Label>
                <Input className="h-9 text-sm" type="number" value={formYear} onChange={e => setFormYear(e.target.value)} data-testid="input-year" />
              </div>
            </div>
            <div>
              <Label className="text-xs">จำนวนไฟล์สูงสุด</Label>
              <Input className="h-9 text-sm" type="number" value={formMaxFiles} onChange={e => setFormMaxFiles(e.target.value)} data-testid="input-max-files" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>ยกเลิก</Button>
            <Button className="bg-[#fb9678] hover:bg-[#e8856a]" onClick={handleCreate} disabled={createLink.isPending}>
              {createLink.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Share2 className="w-4 h-4 mr-1" />}
              สร้างลิงก์
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OfficeDocumentsTab({ companyId }: { companyId: number | null }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentFolderId, setCurrentFolderId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [addDocOpen, setAddDocOpen] = useState(false);
  const [addType, setAddType] = useState<"file" | "link">("file");
  const [editDoc, setEditDoc] = useState<any>(null);
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formLinkUrl, setFormLinkUrl] = useState("");
  const [formFile, setFormFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [viewerDoc, setViewerDoc] = useState<any>(null);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [editFolder, setEditFolder] = useState<any>(null);
  const [folderName, setFolderName] = useState("");
  const [folderColor, setFolderColor] = useState(FOLDER_COLORS[0]);

  useEffect(() => {
    setCurrentFolderId(null);
  }, [companyId]);

  const { data: allFolders = [], isLoading: foldersLoading } = useQuery<any[]>({
    queryKey: ["/api/firm-folders", companyId],
    queryFn: async () => { const r = await fetch(`/api/firm-folders?companyId=${companyId}`, { credentials: "include" }); return r.ok ? r.json() : []; },
    enabled: !!companyId,
  });

  const { data: documents = [], isLoading: docsLoading } = useQuery<any[]>({
    queryKey: ["/api/firm-documents", currentFolderId, companyId],
    queryFn: async () => {
      const fid = currentFolderId === null ? "null" : currentFolderId;
      const r = await fetch(`/api/firm-documents?folderId=${fid}&companyId=${companyId}`, { credentials: "include" });
      return r.ok ? r.json() : [];
    },
    enabled: !!companyId,
  });

  const childFolders = useMemo(() => allFolders.filter((f: any) => currentFolderId === null ? !f.parentId : f.parentId === currentFolderId), [allFolders, currentFolderId]);
  const breadcrumbs = useMemo(() => {
    const crumbs: any[] = [];
    let id = currentFolderId;
    while (id) { const folder = allFolders.find((f: any) => f.id === id); if (!folder) break; crumbs.unshift(folder); id = folder.parentId; }
    return crumbs;
  }, [allFolders, currentFolderId]);
  const currentFolder = currentFolderId ? allFolders.find((f: any) => f.id === currentFolderId) : null;

  const createFolder = useMutation({
    mutationFn: async (data: any) => { const r = await apiRequest("POST", "/api/firm-folders", { ...data, companyId }); return r.json(); },
    onSuccess: () => { toast({ title: "สร้างโฟลเดอร์สำเร็จ" }); queryClient.invalidateQueries({ queryKey: ["/api/firm-folders", companyId] }); closeFolderDialog(); },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });
  const updateFolder = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => { const r = await apiRequest("PATCH", `/api/firm-folders/${id}`, data); return r.json(); },
    onSuccess: () => { toast({ title: "แก้ไขโฟลเดอร์สำเร็จ" }); queryClient.invalidateQueries({ queryKey: ["/api/firm-folders", companyId] }); closeFolderDialog(); },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });
  const deleteFolder = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/firm-folders/${id}`); },
    onSuccess: () => { toast({ title: "ลบโฟลเดอร์สำเร็จ" }); queryClient.invalidateQueries({ queryKey: ["/api/firm-folders", companyId] }); queryClient.invalidateQueries({ queryKey: ["/api/firm-documents"] }); if (currentFolderId) { const parent = allFolders.find((f: any) => f.id === currentFolderId); setCurrentFolderId(parent?.parentId || null); } },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });
  const createDoc = useMutation({
    mutationFn: async (formData: FormData) => { const r = await fetch("/api/firm-documents", { method: "POST", body: formData, credentials: "include" }); if (!r.ok) throw new Error("เกิดข้อผิดพลาด"); return r.json(); },
    onSuccess: () => { toast({ title: "เพิ่มเอกสารสำเร็จ" }); queryClient.invalidateQueries({ queryKey: ["/api/firm-documents"] }); closeDocDialog(); },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });
  const updateDoc = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => { const r = await apiRequest("PATCH", `/api/firm-documents/${id}`, data); return r.json(); },
    onSuccess: () => { toast({ title: "แก้ไขเรียบร้อย" }); queryClient.invalidateQueries({ queryKey: ["/api/firm-documents"] }); closeDocDialog(); },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });
  const deleteDoc = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/firm-documents/${id}`); },
    onSuccess: () => { toast({ title: "ลบเอกสารแล้ว" }); queryClient.invalidateQueries({ queryKey: ["/api/firm-documents"] }); },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const closeDocDialog = () => { setAddDocOpen(false); setEditDoc(null); setFormName(""); setFormDesc(""); setFormLinkUrl(""); setFormFile(null); setAddType("file"); };
  const closeFolderDialog = () => { setFolderDialogOpen(false); setEditFolder(null); setFolderName(""); setFolderColor(FOLDER_COLORS[0]); };
  const openAddDoc = (type: "file" | "link") => { setAddType(type); setEditDoc(null); setFormName(""); setFormDesc(""); setFormLinkUrl(""); setFormFile(null); setAddDocOpen(true); };
  const openEditDoc = (doc: any) => { setEditDoc(doc); setFormName(doc.name); setFormDesc(doc.description || ""); setFormLinkUrl(doc.linkUrl || ""); setAddType(doc.linkUrl ? "link" : "file"); setAddDocOpen(true); };
  const openAddFolder = () => { setEditFolder(null); setFolderName(""); setFolderColor(FOLDER_COLORS[Math.floor(Math.random() * FOLDER_COLORS.length)]); setFolderDialogOpen(true); };
  const openEditFolder = (folder: any) => { setEditFolder(folder); setFolderName(folder.name); setFolderColor(folder.color || FOLDER_COLORS[0]); setFolderDialogOpen(true); };

  const handleSaveDoc = () => {
    if (!formName.trim()) { toast({ title: "กรุณาระบุชื่อ", variant: "destructive" }); return; }
    if (editDoc) { updateDoc.mutate({ id: editDoc.id, data: { name: formName, description: formDesc || null, linkUrl: formLinkUrl || null } }); return; }
    const fd = new FormData();
    fd.append("category", "general");
    fd.append("name", formName);
    if (companyId) fd.append("companyId", String(companyId));
    if (formDesc) fd.append("description", formDesc);
    if (currentFolderId) fd.append("folderId", String(currentFolderId));
    if (addType === "link") {
      if (!formLinkUrl.trim()) { toast({ title: "กรุณาระบุ URL", variant: "destructive" }); return; }
      fd.append("linkUrl", formLinkUrl); fd.append("linkType", "website");
    } else {
      if (!formFile) { toast({ title: "กรุณาเลือกไฟล์", variant: "destructive" }); return; }
      fd.append("file", formFile);
    }
    createDoc.mutate(fd);
  };
  const handleSaveFolder = () => {
    if (!folderName.trim()) { toast({ title: "กรุณาระบุชื่อโฟลเดอร์", variant: "destructive" }); return; }
    if (editFolder) updateFolder.mutate({ id: editFolder.id, data: { name: folderName, color: folderColor } });
    else createFolder.mutate({ name: folderName, parentId: currentFolderId, color: folderColor });
  };
  const handleDownload = async (doc: any) => {
    try {
      const r = await fetch(`/api/firm-documents/download/${doc.id}`, { credentials: "include" });
      if (!r.ok) throw new Error("fail");
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = doc.fileName || doc.name; a.click(); URL.revokeObjectURL(url);
    } catch { toast({ title: "ดาวน์โหลดล้มเหลว", variant: "destructive" }); }
  };

  const filteredDocs = useMemo(() => { if (!search) return documents; const s = search.toLowerCase(); return documents.filter((d: any) => (d.name || "").toLowerCase().includes(s) || (d.description || "").toLowerCase().includes(s)); }, [documents, search]);
  const filteredFolders = useMemo(() => { if (!search) return childFolders; const s = search.toLowerCase(); return childFolders.filter((f: any) => (f.name || "").toLowerCase().includes(s)); }, [childFolders, search]);
  const isLoading = foldersLoading || docsLoading;

  return (
    <div>
      <div className="flex items-center gap-1 text-sm flex-wrap mb-3">
        <button onClick={() => setCurrentFolderId(null)} className={`px-2 py-1 rounded hover:bg-gray-100 ${!currentFolderId ? "font-semibold text-gray-800" : "text-gray-500"}`} data-testid="breadcrumb-root">
          <span className="flex items-center gap-1"><FolderOpen className="h-4 w-4" /> หน้าหลัก</span>
        </button>
        {breadcrumbs.map((bc: any, i: number) => (
          <span key={bc.id} className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3 text-gray-400" />
            <button onClick={() => setCurrentFolderId(bc.id)} className={`px-2 py-1 rounded hover:bg-gray-100 ${i === breadcrumbs.length - 1 ? "font-semibold text-gray-800" : "text-gray-500"}`}>{bc.name}</button>
          </span>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {currentFolder && <Button size="sm" variant="ghost" onClick={() => setCurrentFolderId(currentFolder.parentId || null)} data-testid="button-back"><ArrowLeft className="h-4 w-4" /></Button>}
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${currentFolder?.color || "#fb9678"}20` }}>
                <Folder className="h-4 w-4" style={{ color: currentFolder?.color || "#fb9678" }} />
              </div>
              <div>
                <CardTitle className="text-lg">{currentFolder?.name || "เอกสารทั้งหมด"}</CardTitle>
                <p className="text-xs text-gray-400">{filteredFolders.length} โฟลเดอร์, {filteredDocs.length} ไฟล์</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative"><Search className="absolute left-2.5 top-2 h-4 w-4 text-gray-400" /><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหา..." className="pl-8 h-8 text-xs w-48" data-testid="input-search-docs" /></div>
              <Button size="sm" variant="outline" className="h-8 text-xs border-[#fb9678] text-[#fb9678]" onClick={openAddFolder} data-testid="btn-add-folder"><FolderPlus className="h-3.5 w-3.5 mr-1" /> โฟลเดอร์</Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button size="sm" className="h-8 text-xs bg-[#fb9678] hover:bg-[#e8856a]" data-testid="btn-add-doc"><Plus className="h-3.5 w-3.5 mr-1" /> เพิ่มเอกสาร</Button></DropdownMenuTrigger>
                <DropdownMenuContent><DropdownMenuItem onClick={() => openAddDoc("file")}><Upload className="h-3.5 w-3.5 mr-2" /> อัปโหลดไฟล์</DropdownMenuItem><DropdownMenuItem onClick={() => openAddDoc("link")}><Globe className="h-3.5 w-3.5 mr-2" /> เพิ่มลิงก์</DropdownMenuItem></DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div> : (
            <>
              {filteredFolders.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
                  {filteredFolders.map((folder: any) => (
                    <div key={folder.id} className="group relative p-3 rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-sm cursor-pointer transition-all" onClick={() => setCurrentFolderId(folder.id)} data-testid={`folder-${folder.id}`}>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${folder.color || "#fb9678"}20` }}>
                          <Folder className="h-4 w-4" style={{ color: folder.color || "#fb9678" }} />
                        </div>
                        <span className="text-sm font-medium text-gray-700 truncate flex-1">{folder.name}</span>
                      </div>
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><button className="p-1 rounded hover:bg-gray-100" onClick={e => e.stopPropagation()}><MoreVertical className="w-3.5 h-3.5 text-gray-400" /></button></DropdownMenuTrigger>
                          <DropdownMenuContent><DropdownMenuItem onClick={e => { e.stopPropagation(); openEditFolder(folder); }}><Pencil className="w-3.5 h-3.5 mr-2" /> แก้ไข</DropdownMenuItem><DropdownMenuItem className="text-red-500" onClick={e => { e.stopPropagation(); if (confirm("ลบโฟลเดอร์?")) deleteFolder.mutate(folder.id); }}><Trash2 className="w-3.5 h-3.5 mr-2" /> ลบ</DropdownMenuItem></DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {filteredDocs.length === 0 && filteredFolders.length === 0 && (
                <div className="text-center py-12 text-gray-400"><FolderOpen className="w-12 h-12 mx-auto mb-2 text-gray-300" /><p className="text-sm">ยังไม่มีเอกสาร</p></div>
              )}
              {filteredDocs.length > 0 && (
                <div className="space-y-2">
                  {filteredDocs.map((doc: any) => {
                    const Icon = doc.linkUrl ? Globe : getFileIcon(doc.mimeType);
                    return (
                      <div key={doc.id} className="group flex items-center gap-3 p-3 rounded-lg border border-border hover:border-muted-foreground/30 hover:bg-muted/50 transition-colors" data-testid={`doc-${doc.id}`}>
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center bg-muted flex-shrink-0 ${!doc.linkUrl ? "cursor-pointer hover:bg-muted/80" : ""}`} onClick={() => !doc.linkUrl && setViewerDoc(doc)}><Icon className="w-4.5 h-4.5 text-muted-foreground" /></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{doc.name}</p>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">{doc.fileName && <span>{doc.fileName}</span>}{doc.fileSize && <span>{formatFileSize(doc.fileSize)}</span>}{doc.createdAt && <span>{new Date(doc.createdAt).toLocaleDateString("th-TH")}</span>}</div>
                          {doc.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{doc.description}</p>}
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                          {doc.linkUrl ? (
                            <a href={doc.linkUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded hover:bg-gray-100"><ExternalLink className="w-4 h-4 text-gray-500" /></a>
                          ) : (
                            <>
                              <button onClick={() => setViewerDoc(doc)} className="p-1.5 rounded hover:bg-blue-50" title="ดูเอกสาร" data-testid={`btn-preview-doc-${doc.id}`}><Eye className="w-4 h-4 text-blue-500" /></button>
                              <button onClick={() => handleDownload(doc)} className="p-1.5 rounded hover:bg-gray-100" title="ดาวน์โหลด"><Download className="w-4 h-4 text-gray-500" /></button>
                            </>
                          )}
                          <button onClick={() => openEditDoc(doc)} className="p-1.5 rounded hover:bg-gray-100"><Pencil className="w-4 h-4 text-gray-500" /></button>
                          <button onClick={() => { if (confirm("ลบเอกสารนี้?")) deleteDoc.mutate(doc.id); }} className="p-1.5 rounded hover:bg-red-50"><Trash2 className="w-4 h-4 text-red-400" /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={addDocOpen} onOpenChange={v => !v && closeDocDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editDoc ? "แก้ไขเอกสาร" : addType === "file" ? "อัปโหลดไฟล์" : "เพิ่มลิงก์"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">ชื่อ</Label><Input value={formName} onChange={e => setFormName(e.target.value)} data-testid="input-doc-name" /></div>
            <div><Label className="text-xs">รายละเอียด</Label><Textarea value={formDesc} onChange={e => setFormDesc(e.target.value)} rows={2} data-testid="input-doc-desc" /></div>
            {addType === "link" ? (
              <div><Label className="text-xs">URL</Label><Input value={formLinkUrl} onChange={e => setFormLinkUrl(e.target.value)} placeholder="https://..." data-testid="input-doc-url" /></div>
            ) : !editDoc ? (
              <div><Label className="text-xs">ไฟล์</Label><input ref={fileInputRef} type="file" onChange={e => { const f = e.target.files?.[0]; if (f) { setFormFile(f); if (!formName) setFormName(f.name); } }} className="text-sm" data-testid="input-doc-file" /></div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDocDialog}>ยกเลิก</Button>
            <Button className="bg-[#fb9678] hover:bg-[#e8856a]" onClick={handleSaveDoc}>{editDoc ? "บันทึก" : "เพิ่ม"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={folderDialogOpen} onOpenChange={v => !v && closeFolderDialog()}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editFolder ? "แก้ไขโฟลเดอร์" : "สร้างโฟลเดอร์ใหม่"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">ชื่อโฟลเดอร์</Label><Input value={folderName} onChange={e => setFolderName(e.target.value)} data-testid="input-folder-name" /></div>
            <div><Label className="text-xs">สี</Label>
              <div className="flex gap-2 mt-1">{FOLDER_COLORS.map(c => (<button key={c} className={`w-7 h-7 rounded-full border-2 ${folderColor === c ? "border-gray-800" : "border-transparent"}`} style={{ backgroundColor: c }} onClick={() => setFolderColor(c)} />))}</div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeFolderDialog}>ยกเลิก</Button>
            <Button className="bg-[#fb9678] hover:bg-[#e8856a]" onClick={handleSaveFolder}>{editFolder ? "บันทึก" : "สร้าง"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {viewerDoc && (() => {
        const previewUrl = `/api/firm-documents/download/${viewerDoc.id}?inline=1`;
        const fileName = viewerDoc.fileName || viewerDoc.name || "";
        const isPdf = fileName.toLowerCase().endsWith(".pdf") || (viewerDoc.mimeType || "").includes("pdf");
        const isImage = /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(fileName) || (viewerDoc.mimeType || "").startsWith("image/");
        return (
          <div className="fixed inset-0 z-50 bg-black/80 flex flex-col" onClick={() => setViewerDoc(null)}>
            <div className="flex items-center gap-3 px-4 py-3 bg-black/60 text-white" onClick={e => e.stopPropagation()}>
              <FileText className="w-5 h-5 text-[#fb9678] flex-shrink-0" />
              <span className="text-sm font-medium truncate flex-1">{fileName}</span>
              <button onClick={() => handleDownload(viewerDoc)} className="p-2 rounded hover:bg-gray-700" title="ดาวน์โหลด">
                <Download className="w-4 h-4" />
              </button>
              <button onClick={() => setViewerDoc(null)} className="p-2 rounded hover:bg-gray-700" title="ปิด">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 flex items-center justify-center p-4 overflow-auto" onClick={e => e.stopPropagation()}>
              {isImage ? (
                <img src={previewUrl} alt={fileName} className="max-w-full max-h-full object-contain" />
              ) : isPdf ? (
                <iframe src={previewUrl} className="w-full h-full border-0 bg-white rounded" title={fileName} />
              ) : (
                <div className="text-center text-white">
                  <File className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                  <p className="text-lg font-medium mb-2">{fileName}</p>
                  <p className="text-sm text-gray-400 mb-4">ไม่สามารถแสดงตัวอย่างไฟล์ประเภทนี้ได้</p>
                  <button onClick={() => handleDownload(viewerDoc)} className="inline-flex items-center gap-2 px-4 py-2 bg-[#fb9678] text-white rounded-lg hover:bg-[#e8856a]">
                    <Download className="w-4 h-4" /> ดาวน์โหลด
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

interface AttachmentDoc {
  id: number;
  companyId: number;
  docNo: string;
  docDate: string;
  vendorName: string;
  totalAmount: string;
  attachedUrl: string;
  status: string;
  docType: "ap" | "expense";
  createdAt: string;
}

function BoardDocumentsTab() {
  const { selectedCompanyId } = useCompany();
  const [selectedBoardId, setSelectedBoardId] = useState<number | null>(null);
  const [openFolderKey, setOpenFolderKey] = useState<string | null>(null);
  const [viewerFile, setViewerFile] = useState<{ name: string; url: string } | null>(null);

  useEffect(() => {
    setSelectedBoardId(null);
    setOpenFolderKey(null);
    setViewerFile(null);
  }, [selectedCompanyId]);

  const { data: boards = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/board-files-summary", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/board-files-summary?companyId=${selectedCompanyId}`, { credentials: "include" });
      return r.ok ? r.json() : [];
    },
    enabled: !!selectedCompanyId,
  });

  const selectedBoard = boards.find((b: any) => b.boardId === selectedBoardId);
  const openFolder = selectedBoard?.folders?.find((f: any) => `${selectedBoardId}-${f.columnId}` === openFolderKey);

  const FOLDER_COLORS: Record<string, string> = {
    "เอกสารหัก ณ ที่จ่าย": "#fec90f",
    "เอกสาร VAT": "#539BFF",
    "เอกสารประกันสังคม": "#05b187",
    "เอกสารDBD": "#fb9678",
    "เอกสารจัดตั้ง": "#03c9d7",
  };

  const resolveFileUrl = (url: string) => {
    if (!url) return "";
    if (url.startsWith("http")) return url;
    if (url.startsWith("/objects/")) return objectPathToUrl(url);
    if (url.startsWith("/")) return url;
    return objectPathToUrl(url);
  };

  const getFileExt = (name: string) => (name.split(".").pop()?.toLowerCase() || "");

  const getFileColor = (name: string) => {
    const ext = getFileExt(name);
    if (["pdf"].includes(ext)) return "#e74c3c";
    if (["xls", "xlsx", "csv"].includes(ext)) return "#27ae60";
    if (["doc", "docx"].includes(ext)) return "#2980b9";
    if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) return "#8e44ad";
    return "#7c5cfc";
  };

  if (viewerFile) {
    const url = resolveFileUrl(viewerFile.url);
    const isPdf = viewerFile.name?.toLowerCase().endsWith(".pdf");
    const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(viewerFile.name || "");
    return (
      <div className="fixed inset-0 z-50 bg-black/60 flex flex-col" data-testid="board-document-viewer">
        <div className="flex items-center justify-between px-4 py-2 bg-gray-900 text-white">
          <span className="text-sm font-medium truncate flex-1">{viewerFile.name}</span>
          <div className="flex items-center gap-1">
            <a href={url} target="_blank" rel="noopener noreferrer" className="p-2 rounded hover:bg-gray-700" title="เปิดในแท็บใหม่">
              <ExternalLink className="w-5 h-5" />
            </a>
            <a href={url} download={viewerFile.name} className="p-2 rounded hover:bg-gray-700" title="ดาวน์โหลด">
              <Download className="w-5 h-5" />
            </a>
            <button className="p-2 rounded hover:bg-gray-700" onClick={() => setViewerFile(null)} title="ปิด">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center overflow-hidden bg-gray-800">
          {isImage ? (
            <img src={url} alt={viewerFile.name} className="max-w-full max-h-full object-contain" />
          ) : isPdf ? (
            <iframe src={url} className="w-full h-full border-0 bg-white" title={viewerFile.name} />
          ) : (
            <div className="text-center text-white">
              <File className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <p className="text-lg font-medium mb-2">{viewerFile.name}</p>
              <a href={url} download={viewerFile.name} className="inline-flex items-center gap-2 px-4 py-2 bg-[#fb9678] text-white rounded-lg hover:bg-[#e8856a]">
                <Download className="w-4 h-4" /> ดาวน์โหลดไฟล์
              </a>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-4 h-full" style={{ minHeight: 500 }}>
      <div className="w-[300px] flex-shrink-0 flex flex-col">
        <div className="space-y-1.5 overflow-y-auto flex-1">
          {isLoading && (
            <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
          )}
          {!isLoading && boards.length === 0 && (
            <div className="text-center py-10 text-gray-400 text-sm">
              <ClipboardList className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              <p>ยังไม่มีไฟล์ในบอร์ด</p>
              <p className="text-xs mt-1">แนบไฟล์ในบอร์ดงานเพื่อเริ่มต้น</p>
            </div>
          )}
          {boards.map((board: any) => {
            const isSelected = selectedBoardId === board.boardId;
            return (
              <div
                key={board.boardId}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${isSelected ? "border-[#fb9678] bg-[#fb9678]/5" : "border-border hover:border-muted-foreground/30 bg-card"}`}
                onClick={() => { setSelectedBoardId(board.boardId); setOpenFolderKey(null); }}
                data-testid={`board-nav-${board.boardId}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: (board.boardColor || "#fb9678") + "18" }}>
                    <ClipboardList className="w-4 h-4" style={{ color: board.boardColor || "#fb9678" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-foreground truncate block">{board.boardName}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-gray-400">
                        {board.folders.length} โฟลเดอร์ • {board.totalFiles} ไฟล์
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        {!selectedBoard ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <FolderOpen className="w-16 h-16 mb-3 text-gray-300" />
            <p className="text-sm">เลือกบอร์ดเพื่อดูเอกสาร</p>
          </div>
        ) : !openFolder ? (
          <div className="h-full flex flex-col">
            <div className="mb-3">
              <h3 className="text-base font-semibold text-gray-800">{selectedBoard.boardName}</h3>
              <p className="text-xs text-gray-400">{selectedBoard.totalFiles} ไฟล์ • {selectedBoard.folders.length} โฟลเดอร์</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {selectedBoard.folders.map((folder: any) => {
                const color = FOLDER_COLORS[folder.columnName] || "#03c9d7";
                const itemCount = new Set(folder.files.map((f: any) => f.itemId)).size;
                return (
                  <button
                    key={folder.columnId}
                    className="flex flex-col items-center p-5 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all cursor-pointer"
                    onClick={() => setOpenFolderKey(`${selectedBoardId}-${folder.columnId}`)}
                    data-testid={`board-folder-${folder.columnId}`}
                  >
                    <div className="relative mb-2">
                      <Folder className="w-14 h-14" style={{ color }} fill={color + "30"} />
                      <span className="absolute bottom-1 right-0 text-white text-[9px] rounded-full w-5 h-5 flex items-center justify-center font-bold" style={{ backgroundColor: color }}>{folder.files.length}</span>
                    </div>
                    <span className="text-xs font-medium text-gray-700 text-center leading-tight line-clamp-2">{folder.columnName}</span>
                    <span className="text-[10px] text-gray-400 mt-0.5">{folder.files.length} ไฟล์ • {itemCount} รายการ</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <button
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100"
                onClick={() => setOpenFolderKey(null)}
                data-testid="btn-back-folders"
              >
                <ArrowLeft className="w-4 h-4" /> กลับ
              </button>
              <div className="flex items-center gap-1.5">
                <Folder className="w-4 h-4" style={{ color: FOLDER_COLORS[openFolder.columnName] || "#03c9d7" }} />
                <span className="text-sm font-semibold text-gray-800">{openFolder.columnName}</span>
                <Badge variant="secondary" className="text-[10px] px-1.5">{openFolder.files.length} ไฟล์</Badge>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2">
              {openFolder.files.map((f: any, idx: number) => {
                const url = resolveFileUrl(f.url);
                const fileKey = `${f.itemId}-${f.name}-${f.url}`;
                return (
                  <div key={fileKey} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:border-gray-300 transition-colors" data-testid={`board-file-${idx}`}>
                    <div
                      className="w-9 h-11 rounded flex items-center justify-center flex-shrink-0 relative cursor-pointer hover:opacity-80"
                      onClick={() => setViewerFile(f)}
                    >
                      <svg viewBox="0 0 24 30" className="w-full h-full" fill="none">
                        <path d="M2 2C2 0.9 2.9 0 4 0H16L22 6V28C22 29.1 21.1 30 20 30H4C2.9 30 2 29.1 2 28V2Z" fill={getFileColor(f.name) + "22"} stroke={getFileColor(f.name)} strokeWidth="1.2"/>
                        <path d="M16 0L22 6H18C16.9 6 16 5.1 16 4V0Z" fill={getFileColor(f.name) + "40"}/>
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-[7px] font-bold uppercase pt-1.5" style={{ color: getFileColor(f.name) }}>{getFileExt(f.name).slice(0, 4)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-gray-800 truncate block">{f.name}</span>
                      <div className="flex items-center gap-3 text-[11px] text-gray-400 mt-0.5">
                        <span className="text-[#03c9d7]"><Building2 className="w-3 h-3 inline mr-0.5" />{f.itemName}</span>
                        {f.groupName && (
                          <span className="flex items-center gap-0.5">
                            <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: f.groupColor || "#ccc" }} />
                            {f.groupName}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button className="p-1.5 rounded hover:bg-blue-50" title="ดูเอกสาร" onClick={() => setViewerFile(f)} data-testid={`btn-view-file-${idx}`}>
                        <Eye className="w-4 h-4 text-blue-500" />
                      </button>
                      <a href={url} download={f.name} className="p-1.5 rounded hover:bg-gray-100" title="ดาวน์โหลด" data-testid={`btn-download-file-${idx}`}>
                        <Download className="w-4 h-4 text-gray-500" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const DOC_TYPE_FILTERS = [
  { key: "all" as const, label: "ทั้งหมด" },
  { key: "ap" as const, label: "ใบซื้อ (AP)" },
  { key: "expense" as const, label: "ค่าใช้จ่าย (EXP)" },
];

function AccountingAttachmentsTab({ companyId }: { companyId: number | null }) {
  const [filterDocType, setFilterDocType] = useState<"all" | "ap" | "expense">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerName, setViewerName] = useState("");

  const params = new URLSearchParams();
  if (companyId) params.set("companyId", String(companyId));
  if (filterDocType !== "all") params.set("docType", filterDocType);

  const { data: attachments = [], isLoading } = useQuery<AttachmentDoc[]>({
    queryKey: ["/api/accounting-attachments", companyId, filterDocType],
    queryFn: async () => {
      const r = await fetch(`/api/accounting-attachments?${params.toString()}`, { credentials: "include" });
      return r.ok ? r.json() : [];
    },
    enabled: !!companyId,
  });

  const grouped = useMemo(() => {
    const filtered = searchTerm
      ? attachments.filter(a =>
          a.docNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
          a.vendorName.toLowerCase().includes(searchTerm.toLowerCase())
        )
      : attachments;

    const map = new Map<string, AttachmentDoc[]>();
    filtered.forEach(a => {
      if (!a.docDate) return;
      const d = new Date(a.docDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    });

    return Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, docs]) => {
        const [y, m] = key.split("-").map(Number);
        return { key, label: `${THAI_MONTHS[m - 1]} ${y + 543}`, docs };
      });
  }, [attachments, searchTerm]);

  const totalCount = attachments.length;

  const resolveUrl = (url: string) => {
    if (url.startsWith("http")) return url;
    if (url.startsWith("/")) return url;
    return objectPathToUrl(url);
  };

  const getMimeGuess = (url: string) => {
    const lower = url.toLowerCase();
    if (lower.includes(".pdf")) return "pdf";
    if (lower.includes(".jpg") || lower.includes(".jpeg") || lower.includes(".png") || lower.includes(".webp")) return "image";
    return "other";
  };

  if (viewerUrl) {
    const mime = getMimeGuess(viewerUrl);
    const canPreview = mime === "pdf" || mime === "image";
    return (
      <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 bg-gray-800 text-white">
          <span className="text-sm truncate max-w-[60%]">{viewerName}</span>
          <div className="flex items-center gap-1">
            <a href={viewerUrl} target="_blank" rel="noopener noreferrer" className="p-2 rounded hover:bg-gray-700" title="เปิดในแท็บใหม่">
              <ExternalLink className="w-5 h-5" />
            </a>
            <a href={viewerUrl} download className="p-2 rounded hover:bg-gray-700" title="ดาวน์โหลด">
              <Download className="w-5 h-5" />
            </a>
            <button className="p-2 rounded hover:bg-gray-700" onClick={() => setViewerUrl(null)} title="ปิด" data-testid="viewer-close-accounting">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center overflow-hidden bg-gray-800">
          {canPreview ? (
            mime === "image" ? (
              <img src={viewerUrl} alt={viewerName} className="max-w-full max-h-full object-contain" />
            ) : (
              <iframe src={viewerUrl} className="w-full h-full border-0 bg-white" title={viewerName} />
            )
          ) : (
            <div className="text-center text-white">
              <File className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <p className="text-lg font-medium mb-2">{viewerName}</p>
              <a href={viewerUrl} download className="inline-flex items-center gap-2 px-4 py-2 bg-[#fb9678] text-white rounded-lg hover:bg-[#e8856a]">
                <Download className="w-4 h-4" /> ดาวน์โหลดไฟล์
              </a>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2">
          {DOC_TYPE_FILTERS.map(f => (
            <button
              key={f.key}
              className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${filterDocType === f.key ? "bg-[#fb9678] text-white border-[#fb9678]" : "border-gray-300 text-gray-600 hover:border-[#fb9678] hover:text-[#fb9678]"}`}
              onClick={() => setFilterDocType(f.key)}
              data-testid={`filter-doctype-${f.key}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">{totalCount} ไฟล์</Badge>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <Input
              className="h-8 text-xs pl-8 w-48"
              placeholder="ค้นหาเลขที่/ผู้ขาย..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              data-testid="input-search-accounting-attachments"
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-[#fb9678]" />
        </div>
      ) : grouped.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm text-gray-500">ไม่พบเอกสารแนบ</p>
            <p className="text-xs text-gray-400 mt-1">เอกสาร AP และค่าใช้จ่ายที่มีไฟล์แนบจะแสดงที่นี่อัตโนมัติ</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {grouped.map(g => (
            <Card key={g.key}>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#fb9678]" />
                  {g.label}
                  <Badge variant="secondary" className="text-[10px] ml-1">{g.docs.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <div className="divide-y">
                  {g.docs.map(doc => {
                    const url = resolveUrl(doc.attachedUrl);
                    const mime = getMimeGuess(doc.attachedUrl);
                    const FileIcon = mime === "pdf" ? FileText : mime === "image" ? FileImage : File;
                    const docDate = new Date(doc.docDate);
                    const dayStr = `${docDate.getDate()}/${docDate.getMonth() + 1}/${docDate.getFullYear() + 543}`;

                    return (
                      <div key={`${doc.docType}-${doc.id}`} className="flex items-center gap-3 py-2.5 group" data-testid={`attachment-row-${doc.docType}-${doc.id}`}>
                        <button
                          className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-colors hover:opacity-80"
                          style={{ background: doc.docType === "ap" ? "#e8f5e9" : "#fff3e0" }}
                          onClick={() => { setViewerUrl(url); setViewerName(`${doc.docNo} - ${doc.vendorName}`); }}
                          data-testid={`btn-view-${doc.docType}-${doc.id}`}
                        >
                          <FileIcon className="w-4 h-4" style={{ color: doc.docType === "ap" ? "#05b187" : "#fb9678" }} />
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-800 truncate">{doc.docNo}</span>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0" style={{ borderColor: doc.docType === "ap" ? "#05b187" : "#fb9678", color: doc.docType === "ap" ? "#05b187" : "#fb9678" }}>
                              {doc.docType === "ap" ? "AP" : "EXP"}
                            </Badge>
                          </div>
                          <div className="text-xs text-gray-500 truncate">{doc.vendorName} • {dayStr}</div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-sm font-medium text-gray-700">฿{Number(doc.totalAmount).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            className="p-1.5 rounded hover:bg-gray-100"
                            onClick={() => { setViewerUrl(url); setViewerName(`${doc.docNo} - ${doc.vendorName}`); }}
                            title="ดูไฟล์"
                          >
                            <Eye className="w-3.5 h-3.5 text-gray-500" />
                          </button>
                          <a href={url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded hover:bg-gray-100" title="เปิดในแท็บใหม่">
                            <ExternalLink className="w-3.5 h-3.5 text-gray-500" />
                          </a>
                          <a href={url} download className="p-1.5 rounded hover:bg-gray-100" title="ดาวน์โหลด">
                            <Download className="w-3.5 h-3.5 text-gray-500" />
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FirmDocuments() {
  const [tab, setTab] = useState<"client" | "office" | "board" | "accounting">("client");
  const { selectedCompanyId } = useCompany();

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FolderOpen className="h-7 w-7" style={{ color: "#fb9678" }} />
            <div>
              <h1 className="text-2xl font-bold text-gray-800" data-testid="text-page-title">คลังเอกสาร</h1>
              <p className="text-sm text-gray-500">จัดเก็บและรับเอกสารจากลูกค้า</p>
            </div>
          </div>
        </div>

        <div className="flex border-b border-gray-200">
          <button
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === "client" ? "border-[#fb9678] text-[#fb9678]" : "border-transparent text-gray-500 hover:text-gray-700"}`}
            onClick={() => setTab("client")}
            data-testid="tab-client-docs"
          >
            <span className="flex items-center gap-1.5"><Users className="w-4 h-4" /> เอกสารลูกค้า</span>
          </button>
          <button
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === "office" ? "border-[#fb9678] text-[#fb9678]" : "border-transparent text-gray-500 hover:text-gray-700"}`}
            onClick={() => setTab("office")}
            data-testid="tab-office-docs"
          >
            <span className="flex items-center gap-1.5"><Folder className="w-4 h-4" /> เอกสารสำนักงาน</span>
          </button>
          <button
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === "board" ? "border-[#fb9678] text-[#fb9678]" : "border-transparent text-gray-500 hover:text-gray-700"}`}
            onClick={() => setTab("board")}
            data-testid="tab-board-docs"
          >
            <span className="flex items-center gap-1.5"><ClipboardList className="w-4 h-4" /> เอกสารจากบอร์ด</span>
          </button>
          <button
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === "accounting" ? "border-[#fb9678] text-[#fb9678]" : "border-transparent text-gray-500 hover:text-gray-700"}`}
            onClick={() => setTab("accounting")}
            data-testid="tab-accounting-docs"
          >
            <span className="flex items-center gap-1.5"><FileText className="w-4 h-4" /> เอกสารแนบบัญชี</span>
          </button>
        </div>

        {tab === "client" && <ClientDocumentsTab companyId={selectedCompanyId} />}
        {tab === "office" && <OfficeDocumentsTab companyId={selectedCompanyId} />}
        {tab === "board" && <BoardDocumentsTab />}
        {tab === "accounting" && <AccountingAttachmentsTab companyId={selectedCompanyId} />}
      </div>
    </Layout>
  );
}
