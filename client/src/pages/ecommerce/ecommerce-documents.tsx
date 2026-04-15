import EcommerceLayout from "@/components/ecommerce-layout";
import { useCompany } from "@/lib/company-context";
import { formatDate } from "@/lib/format";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  Eye, Printer, FileText, BookOpen, BarChart3, DollarSign, ArrowUpRight, Download, FileDown,
  Search, Plus, Minus, MoreHorizontal, Copy, CheckCircle2, Clock, AlertCircle, Link2,
  MessageSquare, Edit2, FileOutput, ExternalLink, Calendar as CalendarIcon, FileCode, Loader2, Send
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState, useMemo, useCallback, useEffect, Fragment } from "react";
import { apiRequest, getShareBaseUrl } from "@/lib/queryClient";
import type { TaxInvoice } from "@shared/schema";
import * as XLSX from "xlsx";
import LineSendDialog from "@/components/line-send-dialog";
import JournalViewDialog from "@/components/journal-view-dialog";
import RelatedDocsDialog from "@/components/related-docs-dialog";
import ThaiDateInput from "@/components/thai-date-input";
import { toLocalDateStr } from "@/lib/utils";

import { useDateSettings } from "@/hooks/use-date-settings";
const ECOMMERCE_PLATFORMS = [
  { refPrefix: "SHOPEE #", docPrefix: "SH", name: "Shopee", color: "#EE4D2D" },
  { refPrefix: "LAZADA #", docPrefix: "LZ", name: "Lazada", color: "#0F146D" },
  { refPrefix: "TIKTOK #", docPrefix: "TT", name: "TikTok", color: "#000000" },
  { refPrefix: "GRAB #", docPrefix: "GR", name: "Grab", color: "#00B14F" },
  { refPrefix: "LINEMAN #", docPrefix: "LM", name: "LINEMAN", color: "#2DA157" },
  { refPrefix: "ROBINHOOD #", docPrefix: "RH", name: "Robinhood", color: "#7B2D8E" },
  { refPrefix: "AMAZON #", docPrefix: "AZ", name: "Amazon", color: "#FF9900" },
];

const ECOMMERCE_DOC_PREFIXES = new Set(ECOMMERCE_PLATFORMS.map(p => p.docPrefix));

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: "ร่าง", color: "bg-slate-100 text-slate-700 border-slate-200", icon: Clock },
  approved: { label: "อนุมัติ", color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  issued: { label: "ออกแล้ว", color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  cancelled: { label: "ยกเลิก", color: "bg-red-100 text-red-700 border-red-200", icon: AlertCircle },
  voided: { label: "ยกเลิก(ถูกต้อง)", color: "bg-amber-100 text-amber-700 border-amber-200", icon: AlertCircle },
};

function extractPlatform(inv: { refDoc?: string | null; docPrefix?: string | null; taxInvoiceNo?: string | null }) {
  if (inv.refDoc) {
    const match = ECOMMERCE_PLATFORMS.find(p => inv.refDoc!.toUpperCase().startsWith(p.refPrefix));
    if (match) return match;
  }
  if (inv.docPrefix && ECOMMERCE_DOC_PREFIXES.has(inv.docPrefix)) {
    return ECOMMERCE_PLATFORMS.find(p => p.docPrefix === inv.docPrefix) || null;
  }
  if (inv.taxInvoiceNo) {
    const match = ECOMMERCE_PLATFORMS.find(p => inv.taxInvoiceNo!.startsWith(p.docPrefix));
    if (match) return match;
  }
  return null;
}

function extractOrderNumber(refDoc: string | null) {
  if (!refDoc) return "";
  const idx = refDoc.indexOf("#");
  if (idx === -1) return "";
  return refDoc.substring(idx + 1).trim();
}

function isEcommerceInvoice(inv: { refDoc?: string | null; docPrefix?: string | null; taxInvoiceNo?: string | null }) {
  return extractPlatform(inv) !== null;
}

function fmt(val: string | number | null | undefined): string {
  const n = parseFloat(String(val || "0"));
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatAmount(v: string | number | null | undefined) {
  return "฿" + fmt(v);
}

function PlatformBadge({ inv }: { inv: { refDoc?: string | null; docPrefix?: string | null; taxInvoiceNo?: string | null } }) {
  const platform = extractPlatform(inv);
  if (!platform) return <span>-</span>;
  return (
    <Badge
      data-testid={`badge-platform-${platform.name.toLowerCase()}`}
      className="text-white hover:opacity-90"
      style={{ backgroundColor: platform.color }}
    >
      {platform.name}
    </Badge>
  );
}

function ExpandedDetail({ inv }: { inv: any }) {
  const [items, setItems] = useState<any[]>([]);
  const [detail, setDetail] = useState<any>(null);
  const [loadingItems, setLoadingItems] = useState(true);
  const [journalOpen, setJournalOpen] = useState(false);
  const [relatedOpen, setRelatedOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/tax-invoices/${inv.id}`, { credentials: "include" });
        if (res.ok && !cancelled) {
          const data = await res.json();
          setItems(data.items || []);
          setDetail(data);
        }
      } catch {}
      if (!cancelled) setLoadingItems(false);
    })();
    return () => { cancelled = true; };
  }, [inv.id]);

  return (
    <div className="space-y-3">
      <div className="flex gap-8 text-sm text-slate-600">
        {inv.customerTaxId && (
          <div><span className="text-slate-400">|||</span> {inv.customerTaxId}</div>
        )}
        {inv.customerAddress && (
          <div className="flex-1"><span className="text-slate-400">📍</span> {inv.customerAddress}</div>
        )}
        {inv.notes && (
          <div className="text-right">
            <span className="text-slate-500">หมายเหตุ:</span><br/>
            <span className="text-slate-500">{inv.notes}</span>
          </div>
        )}
      </div>

      {items.length > 0 && (
        <div className="border rounded overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-[var(--theme-primary)] hover:bg-[var(--theme-primary)] h-10">
                <TableHead className="text-white text-sm font-medium w-20">รหัส</TableHead>
                <TableHead className="text-white text-sm font-medium">สินค้า</TableHead>
                <TableHead className="text-white text-sm font-medium w-24 text-right">ราคา</TableHead>
                <TableHead className="text-white text-sm font-medium w-16 text-center">จำนวน</TableHead>
                <TableHead className="text-white text-sm font-medium w-16 text-center">ส่วนลด</TableHead>
                <TableHead className="text-white text-sm font-medium w-24 text-right">รวม</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it: any, i: number) => (
                <TableRow key={i} className="h-10">
                  <TableCell className="text-sm text-muted-foreground">{it.productCode || "-"}</TableCell>
                  <TableCell className="text-sm">{it.productName}</TableCell>
                  <TableCell className="text-sm text-right">{fmt(it.unitPrice)}</TableCell>
                  <TableCell className="text-sm text-center">{it.quantity}</TableCell>
                  <TableCell className="text-sm text-center">{it.discount || 0}%</TableCell>
                  <TableCell className="text-sm text-right font-medium">{fmt(it.totalPrice)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {loadingItems && <div className="text-center text-sm text-muted-foreground py-2">กำลังโหลดรายการ...</div>}

      {detail && (() => {
        const sub = Number(detail.subtotal || 0);
        const disc = Number(detail.discountAmount || 0);
        const vat = Number(detail.vatAmount || 0);
        const total = Number(detail.totalAmount || 0);
        const isIncluded = detail.priceMode === "included";
        const beforeVat = isIncluded ? sub - disc - vat : sub - disc;
        return (
          <div className="flex justify-end">
            <div className="text-sm space-y-1 text-right min-w-[200px]">
              <div className="flex justify-between"><span className="text-slate-500">ก่อน VAT:</span><span>{fmt(beforeVat)}</span></div>
              {disc > 0 && <div className="flex justify-between"><span className="text-slate-500">ส่วนลด:</span><span className="text-red-500">-{fmt(disc)}</span></div>}
              <div className="flex justify-between"><span className="text-slate-500">VAT 7%:</span><span>{fmt(vat)}</span></div>
              {Number(detail.withholdingTax || 0) > 0 && <div className="flex justify-between"><span className="text-slate-500">ภาษีหัก ณ ที่จ่าย:</span><span className="text-red-500">-{fmt(detail.withholdingTax)}</span></div>}
              <div className="flex justify-between font-medium border-t pt-1"><span>ยอดรวมสุทธิ:</span><span>{fmt(total)}</span></div>
            </div>
          </div>
        );
      })()}

      <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
        <button
          data-testid={`button-journal-${inv.id}`}
          onClick={() => setJournalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border border-[#fb9678]/30 text-[#fb9678] hover:bg-[#fb9678]/10 transition-colors"
        >
          <BookOpen className="w-3.5 h-3.5" />
          ดูบัญชี
        </button>
        <button
          data-testid={`button-related-${inv.id}`}
          onClick={() => setRelatedOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border border-[#03c9d7]/30 text-[#03c9d7] hover:bg-[#03c9d7]/10 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          เอกสารที่เกี่ยวข้อง
        </button>
      </div>

      <JournalViewDialog open={journalOpen} onOpenChange={setJournalOpen} docType="tax_invoice" docId={inv.id} />
      <RelatedDocsDialog open={relatedOpen} onOpenChange={setRelatedOpen} docType="tax_invoice" docId={inv.id} />
    </div>
  );
}

export default function EcommerceDocuments() {
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchText, setSearchText] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPlatform, setFilterPlatform] = useState("all");
  const now = new Date();
  const yearStart = `${now.getFullYear()}-01-01`;
  const todayStr = toLocalDateStr(now);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [activeTab, setActiveTab] = useState("invoices");
  const [lineDialog, setLineDialog] = useState<{ open: boolean; url: string; docNo: string; customerName: string }>({ open: false, url: "", docNo: "", customerName: "" });
  const [etaxLoading, setEtaxLoading] = useState<number | null>(null);

  const { dateEra, dateFmt } = useDateSettings();
  const { data: docSettings } = useQuery<any>({
    queryKey: ["/api/document-settings", selectedCompanyId],
    queryFn: async () => {
      if (!selectedCompanyId) return null;
      const res = await fetch(`/api/document-settings?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!selectedCompanyId,
  });
  const { data: etaxSettings } = useQuery<any>({
    queryKey: ["/api/etax/settings", selectedCompanyId],
    queryFn: async () => {
      if (!selectedCompanyId) return null;
      const res = await fetch(`/api/etax/settings?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!selectedCompanyId,
  });
  const etaxEnabled = !!etaxSettings?.etaxEnabled;

  const { data: allInvoices = [], isLoading } = useQuery<TaxInvoice[]>({
    queryKey: ["/api/tax-invoices", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/tax-invoices?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const ecommerceInvoices = useMemo(
    () => allInvoices.filter(inv => isEcommerceInvoice(inv)),
    [allInvoices]
  );

  const filtered = useMemo(() => {
    return ecommerceInvoices.filter((inv: any) => {
      if (filterStatus && filterStatus !== "all" && inv.status !== filterStatus) return false;
      if (filterPlatform && filterPlatform !== "all") {
        const p = extractPlatform(inv);
        if (!p || p.name !== filterPlatform) return false;
      }
      if (dateFrom && inv.taxInvoiceDate && inv.taxInvoiceDate < dateFrom) return false;
      if (dateTo && inv.taxInvoiceDate && inv.taxInvoiceDate > dateTo) return false;
      if (searchText) {
        const s = searchText.toLowerCase();
        if (
          !(inv.taxInvoiceNo || "").toLowerCase().includes(s) &&
          !(inv.customerName || "").toLowerCase().includes(s) &&
          !(inv.refDoc || "").toLowerCase().includes(s) &&
          !(inv.customerTaxId || "").toLowerCase().includes(s)
        ) return false;
      }
      return true;
    });
  }, [ecommerceInvoices, filterStatus, filterPlatform, dateFrom, dateTo, searchText]);

  const summary = useMemo(() => {
    const totalAmount = filtered.reduce((sum, inv) => sum + Number(inv.totalAmount || 0), 0);
    const vatAmount = filtered.reduce((sum, inv) => sum + Number(inv.vatAmount || 0), 0);
    const baseAmount = filtered.reduce((sum, inv) => {
      const sub = Number(inv.subtotal || 0);
      const vat = Number(inv.vatAmount || 0);
      const pm = (inv as any).priceMode || "excluded";
      return sum + (pm === "included" ? Math.round((sub - vat) * 100) / 100 : sub);
    }, 0);
    return { count: filtered.length, totalAmount, vatAmount, baseAmount };
  }, [filtered]);

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await apiRequest("PATCH", `/api/tax-invoices/${id}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tax-invoices"] });
      toast({ title: "เปลี่ยนสถานะสำเร็จ", variant: "success" as any });
    },
  });

  const cloneMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/tax-invoices/${id}/clone`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tax-invoices"] });
      toast({ title: "คัดลอกเอกสารสำเร็จ", variant: "success" as any });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/tax-invoices/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tax-invoices"] });
      toast({ title: "ลบเอกสารสำเร็จ", variant: "success" as any });
    },
  });

  function toggleExpand(id: number) {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelect(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === filtered.length && filtered.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((inv: any) => inv.id)));
    }
  }

  function handleBatchPrint() {
    if (selectedIds.size === 0) {
      toast({ title: "กรุณาเลือกเอกสารอย่างน้อย 1 รายการ", variant: "destructive" });
      return;
    }
    const ids = Array.from(selectedIds).join(",");
    window.open(`/sales/tax-invoice/batch-print?ids=${ids}`, "_blank");
  }

  const handleExportExcel = useCallback(() => {
    if (filtered.length === 0) {
      toast({ title: "ไม่มีข้อมูลสำหรับส่งออก", variant: "destructive" });
      return;
    }
    const rows = filtered.map(inv => {
      const platform = extractPlatform(inv);
      return {
        "เลขที่เอกสาร": inv.taxInvoiceNo || "",
        "วันที่": formatDate(inv.taxInvoiceDate, dateEra, dateFmt),
        "ลูกค้า": inv.customerName || "",
        "เลขผู้เสียภาษี": inv.customerTaxId || "",
        "แพลตฟอร์ม": platform?.name || "-",
        "เลขคำสั่งซื้อ": extractOrderNumber(inv.refDoc),
        "มูลค่าก่อน VAT": ((inv as any).priceMode === "included") ? Math.round((Number(inv.subtotal || 0) - Number(inv.vatAmount || 0)) * 100) / 100 : Number(inv.subtotal || 0),
        "VAT": Number(inv.vatAmount || 0),
        "ยอดรวม": Number(inv.totalAmount || 0),
        "สถานะ": STATUS_MAP[inv.status]?.label || inv.status,
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [
      { wch: 18 }, { wch: 14 }, { wch: 30 }, { wch: 16 }, { wch: 14 }, { wch: 20 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 10 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "เอกสารทางภาษี");
    XLSX.writeFile(wb, `เอกสารทางภาษี_eCommerce.xlsx`);
    toast({ title: "ส่งออก Excel สำเร็จ" });
  }, [filtered, dateEra, dateFmt, toast]);

  const handleEtaxPdfDownload = useCallback(async (invId: number) => {
    if (!selectedCompanyId) return;
    setEtaxLoading(invId);
    try {
      const res = await fetch("/api/etax/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ taxInvoiceId: invId, companyId: selectedCompanyId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "ไม่สามารถสร้าง PDF/A-3 ได้");
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="?([^"]+)"?/);
      a.download = match ? decodeURIComponent(match[1]) : "etax_PDFA3.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast({ title: "ดาวน์โหลด PDF/A-3 สำเร็จ" });
    } catch (err: any) {
      toast({ title: err.message || "ดาวน์โหลดไม่สำเร็จ", variant: "destructive" });
    } finally {
      setEtaxLoading(null);
    }
  }, [selectedCompanyId, toast]);

  const handleEtaxSendEmail = useCallback(async (invId: number, invNo: string) => {
    if (!selectedCompanyId) return;
    if (!confirm(`ยืนยันส่ง e-Tax Invoice "${invNo}" ทาง Email?\n\nระบบจะสร้าง PDF/A-3 พร้อม XML และส่งให้ผู้รับ`)) return;
    setEtaxLoading(invId);
    try {
      const res = await fetch("/api/etax/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ taxInvoiceId: invId, companyId: selectedCompanyId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "ส่ง Email ไม่สำเร็จ");
      toast({ title: "ส่ง e-Tax Invoice สำเร็จ", description: `ส่งถึง: ${data.to}` });
    } catch (err: any) {
      toast({ title: err.message || "ส่ง Email ไม่สำเร็จ", variant: "destructive" });
    } finally {
      setEtaxLoading(null);
    }
  }, [selectedCompanyId, toast]);

  const handleEtaxXmlDownload = useCallback(async (invId: number, invNo: string) => {
    if (!selectedCompanyId) return;
    setEtaxLoading(invId);
    try {
      const res = await fetch("/api/etax/generate-xml", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ taxInvoiceId: invId, companyId: selectedCompanyId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "ไม่สามารถสร้าง XML ได้");
      }
      const data = await res.json();
      const blob = new Blob([data.xml], { type: "application/xml" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename || `${invNo}.xml`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast({ title: "ดาวน์โหลด e-Tax XML สำเร็จ" });
    } catch (err: any) {
      toast({ title: err.message || "ดาวน์โหลดไม่สำเร็จ", variant: "destructive" });
    } finally {
      setEtaxLoading(null);
    }
  }, [selectedCompanyId, toast]);

  const taxReportData = useMemo(() => {
    const issuedInvoices = filtered
      .filter(inv => inv.status === "approved" || inv.status === "issued")
      .sort((a, b) => (a.taxInvoiceDate || "").localeCompare(b.taxInvoiceDate || ""));
    const totalBase = issuedInvoices.reduce((s, inv) => {
      const sub = Number(inv.subtotal || 0);
      const vat = Number(inv.vatAmount || 0);
      const pm = (inv as any).priceMode || "excluded";
      return s + (pm === "included" ? Math.round((sub - vat) * 100) / 100 : sub);
    }, 0);
    const totalVat = issuedInvoices.reduce((s, inv) => s + Number(inv.vatAmount || 0), 0);
    const totalAmount = issuedInvoices.reduce((s, inv) => s + Number(inv.totalAmount || 0), 0);
    return { invoices: issuedInvoices, totalBase, totalVat, totalAmount };
  }, [filtered]);

  const handlePrintTaxReport = useCallback(() => {
    if (taxReportData.invoices.length === 0) {
      toast({ title: "ไม่มีข้อมูลสำหรับพิมพ์", variant: "destructive" });
      return;
    }
    const companyName = selectedCompany?.name || "บริษัท";
    const companyTaxId = selectedCompany?.taxId || "";
    const companyAddress = selectedCompany?.address || "";
    const companyBranch = selectedCompany?.branch || "";
    const isHeadOffice = !companyBranch || companyBranch === "สำนักงานใหญ่" || companyBranch === "00000";
    const branchDisplay = isHeadOffice ? "00000" : companyBranch;
    const periodText = [dateFrom, dateTo].filter(Boolean).map(d => formatDate(d, dateEra, dateFmt)).join(" - ") || "ทั้งหมด";

    const tableRows = taxReportData.invoices.map((inv: any, idx: number) => {
      const platform = extractPlatform(inv);
      const baseAmount = ((inv as any).priceMode === "included") ? Math.round((Number(inv.subtotal || 0) - Number(inv.vatAmount || 0)) * 100) / 100 : Number(inv.subtotal || 0);
      const vatAmt = Number(inv.vatAmount || 0);
      return `<tr>
        <td style="text-align:center;border:1px solid #ccc;padding:3px 6px;font-size:11px">${idx + 1}</td>
        <td style="border:1px solid #ccc;padding:3px 6px;font-size:11px;white-space:nowrap">${formatDate(inv.taxInvoiceDate, dateEra, dateFmt)}</td>
        <td style="border:1px solid #ccc;padding:3px 6px;font-size:11px">${inv.taxInvoiceNo || ""}</td>
        <td style="border:1px solid #ccc;padding:3px 6px;font-size:11px">${inv.customerName || ""}</td>
        <td style="font-family:'Sarabun',sans-serif;font-variant-numeric:tabular-nums;border:1px solid #ccc;padding:3px 6px;font-size:11px">${inv.customerTaxId || "-"}</td>
        <td style="border:1px solid #ccc;padding:3px 6px;font-size:11px;text-align:center">${inv.branch || "00000"}</td>
        <td style="border:1px solid #ccc;padding:3px 6px;font-size:11px;text-align:center">${platform?.name || "-"}</td>
        <td style="text-align:right;font-family:'Sarabun',sans-serif;font-variant-numeric:tabular-nums;border:1px solid #ccc;padding:3px 6px;font-size:11px">${fmt(baseAmount)}</td>
        <td style="text-align:right;font-family:'Sarabun',sans-serif;font-variant-numeric:tabular-nums;border:1px solid #ccc;padding:3px 6px;font-size:11px">${fmt(baseAmount)}</td>
        <td style="text-align:right;font-family:'Sarabun',sans-serif;font-variant-numeric:tabular-nums;border:1px solid #ccc;padding:3px 6px;font-size:11px">${fmt(vatAmt)}</td>
        <td style="text-align:right;font-family:'Sarabun',sans-serif;font-variant-numeric:tabular-nums;border:1px solid #ccc;padding:3px 6px;font-size:11px">${fmt(baseAmount + vatAmt)}</td>
      </tr>`;
    }).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>รายงานภาษีขาย</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;600;700&display=swap');
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family: 'Sarabun', 'TH SarabunPSK', sans-serif; font-size:12px; padding:15px 20px; color:#333; }
        .report-header { display:flex; justify-content:space-between; margin-bottom:10px; }
        .header-left { font-size:12px; line-height:1.7; }
        .header-left .label { display:inline-block; min-width:140px; font-weight:400; }
        .header-left .value { font-weight:600; }
        .header-right { text-align:right; }
        .header-right .title { font-size:18px; font-weight:700; margin-bottom:4px; }
        .header-right .info { font-size:11px; line-height:1.6; }
        .branch-check { display:inline-flex; align-items:center; gap:4px; margin-right:12px; }
        .branch-check .box { display:inline-block; width:14px; height:14px; border:1.5px solid #333; text-align:center; line-height:14px; font-size:11px; font-weight:700; }
        .branch-check .box.checked { background:#333; color:white; }
        table { width:100%; border-collapse:collapse; margin-top:6px; }
        th { background:#5B9BD5; color:white; font-weight:600; padding:5px 6px; font-size:10px; border:1px solid #4a8bc4; text-align:center; white-space:nowrap; }
        .total-row td { font-weight:700; background:#f1f5f9; border-top:2px solid #333; }
        @media print { 
          body { padding:8px 12px; } 
          @page { size:landscape; margin:8mm; }
        }
      </style>
    </head><body>
      <div class="report-header">
        <div class="header-left">
          <div><span class="label">ชื่อผู้ประกอบการ:</span> <span class="value">${companyName}</span></div>
          <div><span class="label">ชื่อสถานประกอบการ:</span> <span class="value">${companyName}</span></div>
          <div>
            <span class="branch-check"><span class="box ${isHeadOffice ? "checked" : ""}">X</span> สำนักงานใหญ่</span>
            <span class="branch-check"><span class="box ${!isHeadOffice ? "checked" : ""}">X</span> สาขา</span>
          </div>
          <div><span class="label">สาขาผู้ประกอบการ:</span> <span class="value">${branchDisplay}</span></div>
          <div><span class="label">ที่ตั้งสถานประกอบการ:</span> <span class="value">${companyAddress}</span></div>
        </div>
        <div class="header-right">
          <div class="title">รายงานภาษีขาย</div>
          <div class="info">
            <div>ช่วงเวลา: ${periodText}</div>
            <div>เลขประจำตัวผู้เสียภาษี: ${companyTaxId || "-"}</div>
          </div>
        </div>
      </div>
      <table>
        <thead><tr>
          <th style="width:28px">#</th>
          <th style="width:90px;white-space:nowrap">ใบกำกับภาษี<br/>วัน เดือน ปี</th>
          <th style="width:110px">ใบกำกับภาษี<br/>เลขที่</th>
          <th>ชื่อผู้ซื้อสินค้า/ผู้รับบริการ</th>
          <th style="width:100px">เลขประจำตัว<br/>ผู้เสียภาษีอากร</th>
          <th style="width:60px">สาขา</th>
          <th style="width:70px">แพลตฟอร์ม</th>
          <th style="width:85px;text-align:right">มูลค่าสินค้า<br/>หรือบริการ</th>
          <th style="width:85px;text-align:right">มูลค่าสินค้า<br/>ที่เสียภาษี</th>
          <th style="width:80px;text-align:right">จำนวนเงิน<br/>ภาษีมูลค่าเพิ่ม</th>
          <th style="width:80px;text-align:right">จำนวนเงิน<br/>รวมทั้งสิ้น</th>
        </tr></thead>
        <tbody>${tableRows}</tbody>
        <tfoot>
          <tr class="total-row">
            <td colspan="7" style="text-align:right;border:1px solid #ccc;padding:4px 8px;font-size:12px">รวมทั้งสิ้น</td>
            <td style="text-align:right;font-family:'Sarabun',sans-serif;font-variant-numeric:tabular-nums;border:1px solid #ccc;padding:4px 8px;font-size:12px">${fmt(taxReportData.totalBase)}</td>
            <td style="text-align:right;font-family:'Sarabun',sans-serif;font-variant-numeric:tabular-nums;border:1px solid #ccc;padding:4px 8px;font-size:12px">${fmt(taxReportData.totalBase)}</td>
            <td style="text-align:right;font-family:'Sarabun',sans-serif;font-variant-numeric:tabular-nums;border:1px solid #ccc;padding:4px 8px;font-size:12px">${fmt(taxReportData.totalVat)}</td>
            <td style="text-align:right;font-family:'Sarabun',sans-serif;font-variant-numeric:tabular-nums;border:1px solid #ccc;padding:4px 8px;font-size:12px">${fmt(taxReportData.totalAmount)}</td>
          </tr>
        </tfoot>
      </table>
    <script>window.onload = function() { window.print(); }</script>
    </body></html>`;

    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); }
  }, [taxReportData, selectedCompany, dateFrom, dateTo, dateEra, dateFmt, toast]);

  const handleExportTaxReport = useCallback(() => {
    const issuedInvoices = filtered.filter(inv => inv.status === "approved" || inv.status === "issued");
    if (issuedInvoices.length === 0) {
      toast({ title: "ไม่มีข้อมูลสำหรับส่งออก", variant: "destructive" });
      return;
    }
    const rows = issuedInvoices.map((inv, idx) => {
      const platform = extractPlatform(inv);
      return {
        "ลำดับ": idx + 1,
        "วันที่": formatDate(inv.taxInvoiceDate, dateEra, dateFmt),
        "เลขที่ใบกำกับภาษี": inv.taxInvoiceNo || "",
        "ชื่อผู้ซื้อ": inv.customerName || "",
        "เลขผู้เสียภาษี": inv.customerTaxId || "",
        "สถานประกอบการ": inv.branch || "สำนักงานใหญ่",
        "แพลตฟอร์ม": platform?.name || "-",
        "มูลค่าสินค้า/บริการ": ((inv as any).priceMode === "included") ? Math.round((Number(inv.subtotal || 0) - Number(inv.vatAmount || 0)) * 100) / 100 : Number(inv.subtotal || 0),
        "จำนวนภาษี": Number(inv.vatAmount || 0),
        "หมายเหตุ": inv.notes || "",
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [
      { wch: 6 }, { wch: 14 }, { wch: 18 }, { wch: 30 }, { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 16 }, { wch: 14 }, { wch: 20 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "รายงานภาษีขาย");
    XLSX.writeFile(wb, `รายงานภาษีขาย_eCommerce.xlsx`);
    toast({ title: "ส่งออกรายงานภาษีขาย Excel สำเร็จ" });
  }, [filtered, dateEra, dateFmt, toast]);

  const hasFilters = dateFrom || dateTo || (filterStatus && filterStatus !== "all") || (filterPlatform && filterPlatform !== "all");

  return (
    <EcommerceLayout>
      <div className="space-y-4" data-testid="page-ecommerce-documents">
        <div className="flex items-center gap-2">
          <FileText className="h-6 w-6 text-[#fb9678]" />
          <h1 className="text-2xl font-heading font-medium" data-testid="text-page-title">เอกสารทางภาษี</h1>
          <span className="text-sm text-muted-foreground">eCommerce</span>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-slate-100">
            <TabsTrigger value="invoices" className="data-[state=active]:bg-white" data-testid="tab-invoices">
              <FileText className="h-4 w-4 mr-1.5" />
              ใบกำกับภาษี
            </TabsTrigger>
            <TabsTrigger value="tax-report" className="data-[state=active]:bg-white" data-testid="tab-tax-report">
              <BarChart3 className="h-4 w-4 mr-1.5" />
              รายงานภาษีขาย
            </TabsTrigger>
          </TabsList>

          <TabsContent value="invoices" className="space-y-4 mt-4">
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded px-3 py-1.5">
              <Badge className="bg-red-500 text-white text-sm">Analysis</Badge>
              <div className="relative flex-1">
                <Input
                  data-testid="input-search"
                  placeholder="ค้นหาเลขเอกสาร, ชื่อลูกค้า, เลขอ้างอิง, เลขผู้เสียภาษี..."
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                  className="h-9 text-sm pl-3 pr-8 border-0 bg-transparent shadow-none focus-visible:ring-0"
                />
              </div>
              <Button data-testid="button-search" variant="secondary" size="sm" className="h-9 text-sm px-4">
                <Search className="h-3.5 w-3.5 mr-1" /> ค้นหา
              </Button>
            </div>

            <Card className="rounded border shadow-sm bg-white">
              <CardHeader className="p-3 border-b space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <span>รายละเอียด - {filtered.length} รายการ</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedIds.size > 0 && (
                      <Button data-testid="button-batch-print" onClick={handleBatchPrint} variant="outline" className="h-9 text-sm px-4 border-purple-400 text-purple-600 hover:bg-purple-50">
                        <Printer className="h-3.5 w-3.5 mr-1" /> พิมพ์ที่เลือก ({selectedIds.size})
                      </Button>
                    )}
                    <Button
                      data-testid="btn-export-excel"
                      onClick={handleExportExcel}
                      variant="outline"
                      className="h-9 text-sm px-4 border-green-400 text-green-600 hover:bg-green-50"
                    >
                      <Download className="h-3.5 w-3.5 mr-1" /> ส่งออก Excel
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">ช่วงวันที่:</span>
                    <ThaiDateInput value={dateFrom} onChange={setDateFrom} dateEra={dateEra} dateFmt={dateFmt} className="w-[160px]" data-testid="input-date-from" />
                    <span className="text-xs text-muted-foreground">ถึง</span>
                    <ThaiDateInput value={dateTo} onChange={setDateTo} dateEra={dateEra} dateFmt={dateFmt} className="w-[160px]" data-testid="input-date-to" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">สถานะ:</span>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger className="w-32 h-8 text-xs bg-white border rounded-lg" data-testid="select-filter-status">
                        <SelectValue placeholder="ทั้งหมด" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">ทั้งหมด</SelectItem>
                        {Object.entries(STATUS_MAP).map(([key, val]) => (
                          <SelectItem key={key} value={key}>{val.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">แพลตฟอร์ม:</span>
                    <Select value={filterPlatform} onValueChange={setFilterPlatform}>
                      <SelectTrigger className="w-32 h-8 text-xs bg-white border rounded-lg" data-testid="select-filter-platform">
                        <SelectValue placeholder="ทั้งหมด" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">ทั้งหมด</SelectItem>
                        {ECOMMERCE_PLATFORMS.map(p => (
                          <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {hasFilters && (
                    <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground" onClick={() => { setDateFrom(""); setDateTo(""); setFilterStatus("all"); setFilterPlatform("all"); }} data-testid="button-clear-filters">
                      ล้างตัวกรอง
                    </Button>
                  )}
                </div>
              </CardHeader>

              <CardContent className="p-0">
                {isLoading ? (
                  <div className="text-center py-12 text-muted-foreground">กำลังโหลด...</div>
                ) : filtered.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                    <p className="text-sm" data-testid="text-empty-state">ยังไม่มีเอกสารที่ตรงกับเงื่อนไข</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader className="bg-slate-100">
                      <TableRow className="hover:bg-transparent h-11">
                        <TableHead className="w-10 text-center text-sm font-medium text-slate-700">
                          <Checkbox data-testid="checkbox-select-all" checked={filtered.length > 0 && selectedIds.size === filtered.length} onCheckedChange={toggleSelectAll} />
                        </TableHead>
                        <TableHead className="w-10 text-center text-sm font-medium text-slate-700"></TableHead>
                        <TableHead className="w-10 text-center text-sm font-medium text-slate-700">#</TableHead>
                        <TableHead className="w-28 text-sm font-medium text-slate-700">วันที่</TableHead>
                        <TableHead className="w-36 text-sm font-medium text-slate-700">เลขที่เอกสาร</TableHead>
                        <TableHead className="text-sm font-medium text-slate-700">ลูกค้า</TableHead>
                        <TableHead className="w-24 text-sm font-medium text-slate-700">แพลตฟอร์ม</TableHead>
                        <TableHead className="w-28 text-sm font-medium text-slate-700">สถานะ</TableHead>
                        <TableHead className="w-32 text-right text-sm font-medium text-slate-700">ยอดรวม</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((inv: any, idx: number) => {
                        const st = STATUS_MAP[inv.status] || STATUS_MAP.draft;
                        const StIcon = st.icon;
                        const isExpanded = expandedRows.has(inv.id);
                        return (
                          <Fragment key={inv.id}>
                            <TableRow data-testid={`row-invoice-${inv.id}`} className={`hover:bg-slate-50/50 border-b ${selectedIds.has(inv.id) ? "bg-purple-50/50" : ""}`}>
                              <TableCell className="text-center py-3">
                                <Checkbox data-testid={`checkbox-select-${inv.id}`} checked={selectedIds.has(inv.id)} onCheckedChange={() => toggleSelect(inv.id)} />
                              </TableCell>
                              <TableCell className="text-center py-3">
                                <button
                                  data-testid={`button-expand-${inv.id}`}
                                  onClick={() => toggleExpand(inv.id)}
                                  className={`w-7 h-7 rounded-full flex items-center justify-center text-white ${isExpanded ? "bg-gray-400" : "bg-[#539BFF]"}`}
                                >
                                  {isExpanded ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                                </button>
                              </TableCell>
                              <TableCell className="text-center text-sm text-muted-foreground">{idx + 1}</TableCell>
                              <TableCell className="text-sm">{formatDate(inv.taxInvoiceDate, dateEra, dateFmt)}</TableCell>
                              <TableCell>
                                <button
                                  data-testid={`link-doc-${inv.id}`}
                                  className="text-sm text-[#e8734e] hover:underline font-medium"
                                  onClick={() => window.open(`/sales/tax-invoice/edit/${inv.id}`, "_blank")}
                                >
                                  {inv.taxInvoiceNo}
                                </button>
                              </TableCell>
                              <TableCell>
                                <div className="text-sm font-normal">{inv.customerName}</div>
                              </TableCell>
                              <TableCell><PlatformBadge inv={inv} /></TableCell>
                              <TableCell>
                                <Badge data-testid={`badge-status-${inv.id}`} className={`${st.color} border text-xs py-0.5 px-2.5 font-normal h-6`}>
                                  <StIcon className="h-3 w-3 mr-1" />
                                  {st.label}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                <div className="text-sm font-normal">{fmt(inv.totalAmount)}</div>
                              </TableCell>
                              <TableCell>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button data-testid={`button-actions-${inv.id}`} variant="ghost" size="icon" className="h-7 w-7">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-56 text-sm">
                                    <DropdownMenuItem onClick={() => window.open(`/sales/tax-invoice/edit/${inv.id}`, "_blank")} className="flex gap-2">
                                      <Edit2 className="h-3.5 w-3.5" /> แก้ไข
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => window.open(`/sales/tax-invoice/pdf/${inv.id}`, "_blank")} className="flex gap-2">
                                      <Printer className="h-3.5 w-3.5 text-purple-500" /> ดูตัวอย่าง / สั่งพิมพ์
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={async () => {
                                      try {
                                        const res = await apiRequest("POST", `/api/tax-invoices/${inv.id}/share`);
                                        const data = await res.json();
                                        const base = await getShareBaseUrl();
                                        const url = `${base}/share/tax-invoice/${data.shareToken}`;
                                        await navigator.clipboard.writeText(url);
                                        toast({ title: "คัดลอกลิงก์แชร์แล้ว" });
                                      } catch {}
                                    }} className="flex gap-2">
                                      <Link2 className="h-3.5 w-3.5" /> ลิงก์สำหรับแชร์
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={async () => {
                                      try {
                                        const res = await apiRequest("POST", `/api/tax-invoices/${inv.id}/share`);
                                        const data = await res.json();
                                        const base = await getShareBaseUrl();
                                        const url = `${base}/share/tax-invoice/${data.shareToken}`;
                                        setTimeout(() => setLineDialog({ open: true, url, docNo: inv.taxInvoiceNo, customerName: inv.customerName || "" }), 150);
                                      } catch {}
                                    }} className="flex gap-2 text-green-600">
                                      <MessageSquare className="h-3.5 w-3.5" /> ส่งผ่าน LINE
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={async () => {
                                      try {
                                        const res = await fetch(`/api/documents/tax_invoice/${inv.id}/pdf`, { credentials: "include" });
                                        if (!res.ok) throw new Error();
                                        const blob = await res.blob();
                                        const url = window.URL.createObjectURL(blob);
                                        const a = document.createElement("a");
                                        a.href = url; a.download = `${inv.taxInvoiceNo}.pdf`;
                                        document.body.appendChild(a); a.click(); a.remove();
                                        window.URL.revokeObjectURL(url);
                                        toast({ title: "ดาวน์โหลด PDF สำเร็จ" });
                                      } catch { toast({ title: "ดาวน์โหลดไม่สำเร็จ", variant: "destructive" }); }
                                    }} className="flex gap-2">
                                      <Download className="h-3.5 w-3.5 text-emerald-600" /> ดาวน์โหลด PDF
                                    </DropdownMenuItem>
                                    {etaxEnabled && (inv.status === "issued" || inv.status === "approved") && (
                                      <>
                                        <DropdownMenuItem
                                          data-testid={`btn-etax-xml-${inv.id}`}
                                          onClick={() => handleEtaxXmlDownload(inv.id, inv.taxInvoiceNo || "")}
                                          disabled={etaxLoading === inv.id}
                                          className="flex gap-2 text-blue-600"
                                        >
                                          {etaxLoading === inv.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileCode className="h-3.5 w-3.5" />}
                                          ดาวน์โหลด e-Tax XML
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          data-testid={`btn-etax-pdf-${inv.id}`}
                                          onClick={() => handleEtaxPdfDownload(inv.id)}
                                          disabled={etaxLoading === inv.id}
                                          className="flex gap-2 text-indigo-600"
                                        >
                                          {etaxLoading === inv.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
                                          ดาวน์โหลด PDF/A-3
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          data-testid={`btn-etax-email-${inv.id}`}
                                          onClick={() => handleEtaxSendEmail(inv.id, inv.taxInvoiceNo || "")}
                                          disabled={etaxLoading === inv.id}
                                          className="flex gap-2 text-[#fb9678]"
                                        >
                                          {etaxLoading === inv.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                                          ส่ง e-Tax Invoice
                                        </DropdownMenuItem>
                                      </>
                                    )}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => cloneMutation.mutate(inv.id)} className="flex gap-2">
                                      <Copy className="h-3.5 w-3.5" /> คัดลอกเอกสาร
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    {inv.status === "draft" && (
                                      <DropdownMenuItem onClick={() => statusMutation.mutate({ id: inv.id, status: "issued" })} className="flex gap-2 text-emerald-600">
                                        <CheckCircle2 className="h-3.5 w-3.5" /> ออกใบกำกับภาษี
                                      </DropdownMenuItem>
                                    )}
                                    {(inv.status === "issued" || inv.status === "approved") && (
                                      <>
                                        <DropdownMenuItem onClick={() => statusMutation.mutate({ id: inv.id, status: "cancelled" })} className="flex gap-2 text-red-600">
                                          <AlertCircle className="h-3.5 w-3.5" /> ยกเลิก
                                        </DropdownMenuItem>
                                      </>
                                    )}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => window.open(`/sales/receipt/new?fromTaxInvoice=${inv.id}`, "_blank")} className="flex gap-2 text-[#fb9678]">
                                      <FileOutput className="h-3.5 w-3.5" /> ออกใบเสร็จรับเงิน
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => { if (confirm("ยืนยันลบเอกสารนี้?")) { deleteMutation.mutate(inv.id); } }}
                                      className="flex gap-2 text-red-500"
                                    >
                                      <AlertCircle className="h-3.5 w-3.5" /> ลบเอกสาร
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>

                            {isExpanded && (
                              <TableRow className="bg-slate-50/80">
                                <TableCell colSpan={10} className="p-4">
                                  <ExpandedDetail inv={inv} />
                                </TableCell>
                              </TableRow>
                            )}
                          </Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}

                {filtered.length > 0 && (
                  <div className="border-t p-3 flex justify-end">
                    <div className="text-sm space-y-1 min-w-[250px]">
                      <div className="flex justify-between"><span className="text-slate-500">จำนวนเอกสาร:</span><span className="font-medium">{filtered.length} รายการ</span></div>
                      <div className="flex justify-between font-semibold border-t pt-1"><span>ยอดรวมทั้งหมด:</span><span style={{ color: "#fb9678" }}>{formatAmount(summary.totalAmount)}</span></div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tax-report" className="space-y-4 mt-4">
            <Card className="rounded-xl border shadow-sm bg-white">
              <CardHeader className="p-4 border-b space-y-4 bg-white">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex gap-2 items-center">
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">ช่วงวันที่:</span>
                    <ThaiDateInput value={dateFrom} onChange={setDateFrom} dateEra={dateEra} dateFmt={dateFmt} className="w-[160px]" data-testid="input-tax-date-from" />
                    <span className="text-xs text-muted-foreground">ถึง</span>
                    <ThaiDateInput value={dateTo} onChange={setDateTo} dateEra={dateEra} dateFmt={dateFmt} className="w-[160px]" data-testid="input-tax-date-to" />
                    <Select value={filterPlatform} onValueChange={setFilterPlatform}>
                      <SelectTrigger className="w-32 h-9 text-xs bg-white border rounded-lg" data-testid="select-tax-filter-platform">
                        <SelectValue placeholder="ทั้งหมด" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">ทั้งหมด</SelectItem>
                        {ECOMMERCE_PLATFORMS.map(p => (
                          <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {hasFilters && (
                      <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground" onClick={() => { setDateFrom(""); setDateTo(""); setFilterStatus("all"); setFilterPlatform("all"); }}>
                        ล้างตัวกรอง
                      </Button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="h-8 text-xs text-white hover:opacity-90" style={{ background: "#fb9678" }} onClick={handlePrintTaxReport} disabled={taxReportData.invoices.length === 0} data-testid="btn-print-tax-report">
                      <Eye className="h-3.5 w-3.5 mr-1.5" /> PDF
                    </Button>
                    <Button size="sm" className="h-8 text-xs text-white hover:opacity-90" style={{ background: "#03c9d7" }} onClick={handleExportTaxReport} disabled={taxReportData.invoices.length === 0} data-testid="btn-export-tax-report">
                      <FileDown className="h-3.5 w-3.5 mr-1.5" /> Excel
                    </Button>
                  </div>
                </div>

                {(() => {
                  const companyName = selectedCompany?.name || "";
                  const companyTaxId = selectedCompany?.taxId || "";
                  const companyAddress = selectedCompany?.address || "";
                  const companyBranch = selectedCompany?.branch || "";
                  const isHeadOffice = !companyBranch || companyBranch === "สำนักงานใหญ่" || companyBranch === "00000";
                  const branchDisplay = isHeadOffice ? "00000" : companyBranch;
                  const periodText = [dateFrom, dateTo].filter(Boolean).map(d => formatDate(d, dateEra, dateFmt)).join(" - ") || "ทั้งหมด";
                  return (
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                      <div className="flex justify-between gap-6 flex-wrap">
                        <div className="space-y-1 text-sm leading-relaxed">
                          <div><span className="text-muted-foreground w-36 inline-block">ชื่อผู้ประกอบการ:</span> <span className="font-semibold">{companyName}</span></div>
                          <div><span className="text-muted-foreground w-36 inline-block">ชื่อสถานประกอบการ:</span> <span className="font-semibold">{companyName}</span></div>
                          <div className="flex items-center gap-3">
                            <span className="inline-flex items-center gap-1">
                              <span className={`inline-block w-4 h-4 border-2 rounded-sm text-center leading-[14px] text-[10px] font-bold ${isHeadOffice ? "bg-foreground text-white border-foreground" : "border-muted-foreground"}`}>
                                {isHeadOffice ? "X" : ""}
                              </span>
                              <span className="text-sm">สำนักงานใหญ่</span>
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <span className={`inline-block w-4 h-4 border-2 rounded-sm text-center leading-[14px] text-[10px] font-bold ${!isHeadOffice ? "bg-foreground text-white border-foreground" : "border-muted-foreground"}`}>
                                {!isHeadOffice ? "X" : ""}
                              </span>
                              <span className="text-sm">สาขา</span>
                            </span>
                          </div>
                          <div><span className="text-muted-foreground w-36 inline-block">สาขาผู้ประกอบการ:</span> <span className="font-semibold">{branchDisplay}</span></div>
                          <div><span className="text-muted-foreground w-36 inline-block">ที่ตั้งสถานประกอบการ:</span> <span className="font-semibold">{companyAddress || "-"}</span></div>
                        </div>
                        <div className="text-right space-y-1">
                          <div className="text-lg font-bold" style={{ color: "#5B9BD5" }}>รายงานภาษีขาย</div>
                          <div className="text-sm text-muted-foreground">ช่วงเวลา: <span className="font-semibold text-foreground">{periodText}</span></div>
                          <div className="text-sm text-muted-foreground">เลขประจำตัวผู้เสียภาษี: <span className="font-semibold text-foreground font-mono">{companyTaxId || "-"}</span></div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </CardHeader>

              <CardContent className="p-0">
                <div className="w-full overflow-x-auto">
                  {taxReportData.invoices.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <BarChart3 className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                      <p className="text-sm">ยังไม่มีเอกสารที่ออกแล้ว/อนุมัติในช่วงเวลาที่เลือก</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader className="border-b" style={{ background: "#5B9BD5" }}>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="w-10 text-center text-white text-[10px] font-semibold p-2">#</TableHead>
                          <TableHead className="w-[90px] min-w-[90px] text-white text-[10px] font-semibold text-center p-2">ใบกำกับภาษี<br/>วัน เดือน ปี</TableHead>
                          <TableHead className="text-white text-[10px] font-semibold text-center border-l border-white/30 p-2">ใบกำกับภาษี<br/>เลขที่</TableHead>
                          <TableHead className="text-white text-[10px] font-semibold text-center border-l border-white/30 p-2">ชื่อผู้ซื้อสินค้า/ผู้รับบริการ</TableHead>
                          <TableHead className="w-28 text-white text-[10px] font-semibold text-center border-l border-white/30 p-2">เลขประจำตัว<br/>ผู้เสียภาษีอากร</TableHead>
                          <TableHead className="w-20 text-white text-[10px] font-semibold text-center border-l border-white/30 p-2">สาขา</TableHead>
                          <TableHead className="w-24 text-white text-[10px] font-semibold text-center border-l border-white/30 p-2">แพลตฟอร์ม</TableHead>
                          <TableHead className="w-28 text-right text-white text-[10px] font-semibold border-l border-white/30 p-2">มูลค่าสินค้า<br/>หรือบริการ</TableHead>
                          <TableHead className="w-28 text-right text-white text-[10px] font-semibold border-l border-white/30 p-2">มูลค่าสินค้า<br/>ที่เสียภาษี</TableHead>
                          <TableHead className="w-24 text-right text-white text-[10px] font-semibold border-l border-white/30 p-2">จำนวนเงิน<br/>ภาษีมูลค่าเพิ่ม</TableHead>
                          <TableHead className="w-24 text-right text-white text-[10px] font-semibold border-l border-white/30 p-2">จำนวนเงิน<br/>รวมทั้งสิ้น</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {taxReportData.invoices.map((inv: any, idx: number) => {
                          const baseAmount = ((inv as any).priceMode === "included") ? Math.round((Number(inv.subtotal || 0) - Number(inv.vatAmount || 0)) * 100) / 100 : Number(inv.subtotal || 0);
                          const vatAmt = Number(inv.vatAmount || 0);
                          return (
                            <TableRow key={inv.id} data-testid={`row-tax-report-${inv.id}`} className="text-sm hover:bg-slate-50/50">
                              <TableCell className="text-center text-xs text-muted-foreground">{idx + 1}</TableCell>
                              <TableCell className="text-xs whitespace-nowrap min-w-[90px]">{formatDate(inv.taxInvoiceDate, dateEra, dateFmt)}</TableCell>
                              <TableCell className="text-xs font-medium">
                                <button
                                  className="text-[#e8734e] hover:underline font-medium"
                                  onClick={() => window.open(`/sales/tax-invoice/edit/${inv.id}`, "_blank")}
                                >
                                  {inv.taxInvoiceNo}
                                </button>
                              </TableCell>
                              <TableCell className="text-xs">{inv.customerName}</TableCell>
                              <TableCell className="text-xs font-mono text-center">{inv.customerTaxId || "-"}</TableCell>
                              <TableCell className="text-xs text-center">{inv.branch || "00000"}</TableCell>
                              <TableCell className="text-center"><PlatformBadge inv={inv} /></TableCell>
                              <TableCell className="text-right text-xs font-mono">{fmt(baseAmount)}</TableCell>
                              <TableCell className="text-right text-xs font-mono">{fmt(baseAmount)}</TableCell>
                              <TableCell className="text-right text-xs font-mono">{fmt(vatAmt)}</TableCell>
                              <TableCell className="text-right text-xs font-mono">{fmt(baseAmount + vatAmt)}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                      <tfoot>
                        <tr className="bg-slate-50 font-semibold border-t-2">
                          <td colSpan={7} className="text-right py-3 text-sm px-3">รวมทั้งสิ้น</td>
                          <td className="text-right py-3 text-sm font-mono px-3">{fmt(taxReportData.totalBase)}</td>
                          <td className="text-right py-3 text-sm font-mono px-3">{fmt(taxReportData.totalBase)}</td>
                          <td className="text-right py-3 text-sm font-mono px-3">{fmt(taxReportData.totalVat)}</td>
                          <td className="text-right py-3 text-sm font-mono px-3">{fmt(taxReportData.totalAmount)}</td>
                        </tr>
                      </tfoot>
                    </Table>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      <LineSendDialog
        open={lineDialog.open}
        onOpenChange={(open) => setLineDialog(prev => ({ ...prev, open }))}
        shareUrl={lineDialog.url}
        docType="ใบกำกับภาษี"
        docNo={lineDialog.docNo}
        customerName={lineDialog.customerName}
        companyId={selectedCompanyId}
      />
    </EcommerceLayout>
  );
}
