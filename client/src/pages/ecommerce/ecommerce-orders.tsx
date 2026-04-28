import EcommerceLayout from "@/components/ecommerce-layout";
import { getPlatformLogo } from "@/lib/platform-logos";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Eye, FileText, FileCheck, ShoppingCart, TrendingUp, Wallet, DollarSign,
  ExternalLink, CheckSquare, Loader2, AlertCircle, BookOpen, Printer,
  ChevronDown, ChevronUp, Percent, Send, X, FileDown, Package,
  Search, Filter, Clock, Truck, CheckCircle2, XCircle, RotateCcw, Calendar, SlidersHorizontal,
  MapPin, Phone, CreditCard, Tag, ArrowUpDown, ArrowUp, ArrowDown,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight
} from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { formatDate } from "@/lib/format";
import { useState, useMemo, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import type { EcommerceOrder, EcommerceOrderItem, Company } from "@shared/schema";
type EcommerceOrderWithItems = EcommerceOrder & { itemCount?: number; itemNames?: string[] };
import ThaiDateInput from "@/components/thai-date-input";
import TaxInvoiceHoverPreview from "@/components/tax-invoice-hover-preview";
import { toLocalDateStr } from "@/lib/utils";

import { useDateSettings } from "@/hooks/use-date-settings";
const PLATFORMS = [
  { value: "shopee", label: "Shopee", hex: "#EE4D2D", bgLight: "bg-orange-100", textColor: "text-orange-700" },
  { value: "lazada", label: "Lazada", hex: "#0F146D", bgLight: "bg-indigo-100", textColor: "text-indigo-700" },
  { value: "tiktok", label: "TikTok Shop", hex: "#000000", bgLight: "bg-gray-100", textColor: "text-gray-900" },
  { value: "live", label: "Live Selling", hex: "#03c9d7", bgLight: "bg-cyan-100", textColor: "text-cyan-700" },
  { value: "amazon", label: "Amazon", hex: "#FF9900", bgLight: "bg-amber-100", textColor: "text-amber-700" },
];

const ORDER_STATUSES = [
  { value: "pending", label: "รอดำเนินการ", icon: Clock, color: "#fec90f", bgColor: "bg-orange-100", textColor: "text-orange-800" },
  { value: "confirmed", label: "ยืนยันแล้ว", icon: CheckCircle2, color: "#539BFF", bgColor: "bg-blue-100", textColor: "text-blue-800" },
  { value: "shipping", label: "กำลังจัดส่ง", icon: Truck, color: "#7c3aed", bgColor: "bg-purple-100", textColor: "text-purple-800" },
  { value: "delivered", label: "สำเร็จ", icon: CheckCircle2, color: "#05b187", bgColor: "bg-green-100", textColor: "text-green-800" },
  { value: "returned", label: "ตีกลับ", icon: RotateCcw, color: "#fb9678", bgColor: "bg-orange-100", textColor: "text-orange-800" },
  { value: "cancelled", label: "ยกเลิก", icon: XCircle, color: "#f94d4d", bgColor: "bg-red-100", textColor: "text-red-800" },
];

function platformBadge(platform: string) {
  const p = PLATFORMS.find(pl => pl.value === platform);
  if (!p) return <Badge data-testid={`badge-platform-${platform}`} className="bg-gray-100 text-gray-700 hover:bg-gray-100">{platform}</Badge>;
  const logo = getPlatformLogo(platform);
  return (
    <Badge data-testid={`badge-platform-${platform}`} className={`${p.bgLight} ${p.textColor} hover:${p.bgLight} gap-1`}>
      {logo && <img src={logo} alt={p.label} className="w-4 h-4 rounded-full object-cover" />}
      {p.label}
    </Badge>
  );
}

function orderStatusBadge(status: string) {
  const s = ORDER_STATUSES.find(os => os.value === status);
  if (!s) return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">{status}</Badge>;
  return <Badge data-testid={`badge-order-status-${status}`} className={`${s.bgColor} ${s.textColor} hover:${s.bgColor}`}>{s.label}</Badge>;
}

function formatCurrency(v: string | number | null | undefined) {
  return Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function toISODateString(dateStr: string): string {
  if (!dateStr) return "";
  return dateStr;
}

export default function EcommerceOrders() {
  const { selectedCompanyId } = useCompany();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
  const [statusTab, setStatusTab] = useState("all");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [storeFilter, setStoreFilter] = useState("all");
  const [docFilter, setDocFilter] = useState("all");
  const [settlementFilter, setSettlementFilter] = useState("all");
  const [searchText, setSearchText] = useState("");
  const now = new Date();
  const yearStart = `${now.getFullYear()}-01-01`;
  const todayStr = toLocalDateStr(now);
  const [startDate, setStartDate] = useState(yearStart);
  const [endDate, setEndDate] = useState(todayStr);
  const [itemCountFilter, setItemCountFilter] = useState("all");
  const [productFilter, setProductFilter] = useState("all");
  const [shippingFilter, setShippingFilter] = useState("all");
  const [codFilter, setCodFilter] = useState("all");
  const [notesFilter, setNotesFilter] = useState("all");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [feesExpanded, setFeesExpanded] = useState(false);
  const [sortField, setSortField] = useState<string>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [orderDetailOpen, setOrderDetailOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [batchResultOpen, setBatchResultOpen] = useState(false);
  const [batchResult, setBatchResult] = useState<any>(null);
  const [lineDialogOpen, setLineDialogOpen] = useState(false);
  const [lineUserId, setLineUserId] = useState("");
  const [bulkStatusValue, setBulkStatusValue] = useState("");
  const [orderWarehouseMap, setOrderWarehouseMap] = useState<Record<number, string>>({});

  const { data: company } = useQuery<Company>({
    queryKey: ["/api/companies", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/companies`, { credentials: "include" });
      if (!r.ok) return null;
      const list = await r.json();
      return list.find((c: any) => c.id === selectedCompanyId) || null;
    },
    enabled: !!selectedCompanyId,
  });
  const isFullAccounting = company?.accountingMode === "full_accounting";

  const { data: warehouses = [] } = useQuery<any[]>({
    queryKey: ["/api/warehouses", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/warehouses?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const setOrderWarehouseMutation = useMutation({
    mutationFn: async ({ orderId, warehouseId }: { orderId: number; warehouseId: number | null }) => {
      const r = await fetch(`/api/ecommerce/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ warehouseId }),
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: (_, vars) => {
      setOrderWarehouseMap(prev => ({ ...prev, [vars.orderId]: vars.warehouseId ? String(vars.warehouseId) : "" }));
    },
  });

  const FOOD_PLATFORMS = ["grab_food", "line_man", "robinhood"];

  const { data: connections = [] } = useQuery<any[]>({
    queryKey: ["/api/ecommerce/connections", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/ecommerce/connections?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const ecomConnections = useMemo(() =>
    connections.filter((c: any) => !FOOD_PLATFORMS.includes(c.platform)),
    [connections]
  );

  const { data: ordersResponse } = useQuery<{ data: EcommerceOrderWithItems[]; settlementSummary: { status: string; count: number; totalAmount: string }[] }>({
    queryKey: ["/api/ecommerce/orders", selectedCompanyId, platformFilter, "all", startDate, endDate, docFilter, settlementFilter],
    queryFn: async () => {
      let url = `/api/ecommerce/orders?companyId=${selectedCompanyId}`;
      if (platformFilter !== "all") url += `&platform=${platformFilter}`;
      if (startDate) url += `&startDate=${toISODateString(startDate)}`;
      if (endDate) url += `&endDate=${toISODateString(endDate)}`;
      if (docFilter !== "all") url += `&hasDocument=${docFilter}`;
      if (settlementFilter !== "all") url += `&settlementStatus=${settlementFilter}`;
      const r = await fetch(url, { credentials: "include" });
      if (!r.ok) return { data: [], settlementSummary: [] };
      const json = await r.json();
      if (Array.isArray(json)) return { data: json, settlementSummary: [] };
      return { data: json.data || json, settlementSummary: json.settlementSummary || [] };
    },
    enabled: !!selectedCompanyId,
  });
  const allOrdersRaw = ordersResponse?.data || [];
  const settlementSummary = ordersResponse?.settlementSummary || [];

  const allOrdersUnfiltered = useMemo(() => {
    let filtered = allOrdersRaw.filter(o => !FOOD_PLATFORMS.includes(o.platform));
    if (storeFilter !== "all") filtered = filtered.filter(o => String(o.connectionId) === storeFilter);
    return filtered;
  }, [allOrdersRaw, storeFilter]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: allOrdersUnfiltered.length };
    ORDER_STATUSES.forEach(s => { counts[s.value] = 0; });
    allOrdersUnfiltered.forEach(o => { counts[o.status] = (counts[o.status] || 0) + 1; });
    return counts;
  }, [allOrdersUnfiltered]);

  const allOrders = useMemo(() => {
    if (statusTab === "all") return allOrdersUnfiltered;
    return allOrdersUnfiltered.filter(o => o.status === statusTab);
  }, [allOrdersUnfiltered, statusTab]);

  const isLoading = !allOrdersUnfiltered;

  const shippingProviders = useMemo(() => {
    const set = new Set<string>();
    allOrders.forEach(o => { if (o.shippingProvider) set.add(o.shippingProvider); });
    return Array.from(set).sort();
  }, [allOrders]);

  const itemCountOptions = useMemo(() => {
    const counts = new Set<number>();
    allOrders.forEach(o => counts.add(o.itemCount || 0));
    return Array.from(counts).sort((a, b) => a - b);
  }, [allOrders]);

  const productOptions = useMemo(() => {
    const names = new Map<string, number>();
    allOrders.forEach(o => {
      (o.itemNames || []).forEach(name => {
        const trimmed = name.trim();
        if (trimmed) names.set(trimmed, (names.get(trimmed) || 0) + 1);
      });
    });
    return Array.from(names.entries()).sort((a, b) => b[1] - a[1]);
  }, [allOrders]);

  const orders = useMemo(() => {
    let filtered = allOrders;
    if (statusTab !== "all") {
      filtered = filtered.filter(o => o.status === statusTab);
    }
    if (itemCountFilter !== "all") {
      const target = Number(itemCountFilter);
      filtered = filtered.filter(o => (o.itemCount || 0) === target);
    }
    if (productFilter !== "all") {
      filtered = filtered.filter(o => (o.itemNames || []).some(n => n.trim() === productFilter));
    }
    if (shippingFilter !== "all") {
      filtered = filtered.filter(o => o.shippingProvider === shippingFilter);
    }
    if (codFilter !== "all") {
      filtered = filtered.filter(o => codFilter === "cod" ? o.isCod : !o.isCod);
    }
    if (notesFilter !== "all") {
      filtered = filtered.filter(o => notesFilter === "has" ? !!o.notes : !o.notes);
    }
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      filtered = filtered.filter(o =>
        (o.orderNo || "").toLowerCase().includes(q) ||
        (o.platformOrderId || "").toLowerCase().includes(q) ||
        (o.buyerName || "").toLowerCase().includes(q) ||
        (o.buyerPhone || "").toLowerCase().includes(q) ||
        (o.trackingNo || "").toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [allOrders, statusTab, itemCountFilter, productFilter, shippingFilter, codFilter, notesFilter, searchText]);

  const sortedOrders = useMemo(() => {
    const sorted = [...orders];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "orderNo":
          cmp = (a.orderNo || a.platformOrderId || "").localeCompare(b.orderNo || b.platformOrderId || "");
          break;
        case "platform":
          cmp = a.platform.localeCompare(b.platform);
          break;
        case "buyer":
          cmp = (a.buyerName || "").localeCompare(b.buyerName || "");
          break;
        case "total":
          cmp = Number(a.totalAmount || 0) - Number(b.totalAmount || 0);
          break;
        case "net":
          cmp = Number(a.netIncome || 0) - Number(b.netIncome || 0);
          break;
        case "items":
          cmp = (a.itemCount || 0) - (b.itemCount || 0);
          break;
        case "shipping":
          cmp = (a.shippingProvider || "").localeCompare(b.shippingProvider || "");
          break;
        case "status":
          cmp = a.status.localeCompare(b.status);
          break;
        case "date":
        default:
          cmp = new Date(a.placedAt || a.createdAt || 0).getTime() - new Date(b.placedAt || b.createdAt || 0).getTime();
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [orders, sortField, sortDir]);

  useEffect(() => {
    setCurrentPage(1);
  }, [docFilter, itemCountFilter, productFilter, shippingFilter, codFilter, notesFilter, startDate, endDate]);

  const totalPages = Math.max(1, Math.ceil(sortedOrders.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedOrders = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return sortedOrders.slice(start, start + pageSize);
  }, [sortedOrders, safePage, pageSize]);

  function handleSort(field: string) {
    if (sortField === field) {
      setSortDir(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir(field === "date" ? "desc" : "asc");
    }
    setCurrentPage(1);
  }

  function SortIcon({ field }: { field: string }) {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-30" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3 ml-1 text-cyan-600" /> : <ArrowDown className="h-3 w-3 ml-1 text-cyan-600" />;
  }

  const { data: orderItems = [] } = useQuery<EcommerceOrderItem[]>({
    queryKey: ["/api/ecommerce/orders", selectedOrderId, "items"],
    queryFn: async () => {
      const r = await fetch(`/api/ecommerce/orders/${selectedOrderId}/items`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedOrderId && (orderDetailOpen || expandedRow === selectedOrderId),
  });

  const generateDocumentMutation = useMutation({
    mutationFn: async (orderId: number) => {
      const r = await fetch(`/api/ecommerce/orders/${orderId}/generate-document`, { method: "POST", credentials: "include" });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tax-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/journal-entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stock-movements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      const desc = data.taxInvoiceNo ? `เลขที่ ${data.taxInvoiceNo}` : undefined;
      const accMsg = data.accountingMode === "full_accounting" ? " (ลงบัญชีอัตโนมัติ)" : "";
      toast({ title: `ออกใบกำกับภาษีสำเร็จ${accMsg}`, description: desc, variant: "success" as any });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const batchGenerateMutation = useMutation({
    mutationFn: async (orderIds: number[]) => {
      const r = await fetch(`/api/ecommerce/orders/batch-generate-documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ orderIds, companyId: selectedCompanyId }),
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tax-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/journal-entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stock-movements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      setSelectedIds(new Set());
      setBatchResult(data);
      setBatchResultOpen(true);
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const sendTrackingMutation = useMutation({
    mutationFn: async ({ orderId, lineUserId }: { orderId: number; lineUserId: string }) => {
      const r = await fetch(`/api/ecommerce/orders/${orderId}/send-tracking`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ lineUserId }),
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: (data) => toast({ title: data.message, variant: "success" as any }),
    onError: (err: any) => toast({ title: "ส่ง LINE ไม่สำเร็จ", description: err.message, variant: "destructive" }),
  });

  const bulkStatusMutation = useMutation({
    mutationFn: async ({ orderIds, status }: { orderIds: number[]; status: string }) => {
      const r = await fetch(`/api/ecommerce/orders/bulk-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ orderIds, status, companyId: selectedCompanyId }),
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/orders"] });
      setSelectedIds(new Set());
      setBulkStatusValue("");
      toast({ title: `อัปเดตสถานะสำเร็จ ${data.updated} รายการ`, variant: "success" as any });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const bulkPrintTivMutation = useMutation({
    mutationFn: async (orderIds: number[]) => {
      const r = await fetch(`/api/ecommerce/orders/bulk-print-tiv`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ orderIds, companyId: selectedCompanyId }),
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: (data) => {
      if (data.taxInvoiceIds && data.taxInvoiceIds.length > 0) {
        const ids = data.taxInvoiceIds.join(",");
        window.open(`/sales/tax-invoice/batch-print?ids=${ids}`, "_blank");
      } else {
        toast({ title: "ไม่พบใบกำกับภาษีสำหรับคำสั่งซื้อที่เลือก", variant: "destructive" });
      }
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const eligibleOrders = useMemo(
    () => orders.filter(o => !o.taxInvoiceId && o.status !== "cancelled"),
    [orders]
  );

  const selectedEligible = useMemo(
    () => eligibleOrders.filter(o => selectedIds.has(o.id)),
    [eligibleOrders, selectedIds]
  );

  const summary = useMemo(() => {
    let totalRevenue = 0, totalFees = 0, totalShipping = 0, totalNetIncome = 0;
    orders.forEach(o => {
      const totalAmt = Number(o.totalAmount || 0);
      const comm = Number(o.commissionFee || 0);
      const svc = Number(o.serviceFee || 0);
      const pmt = Number(o.transactionFee || 0) || Number(o.paymentFee || 0);
      const ship = Number(o.shippingCost || 0);
      totalRevenue += totalAmt;
      totalFees += comm + svc + pmt;
      totalShipping += ship;
      totalNetIncome += Number(o.netIncome || 0);
    });
    const profitMargin = totalRevenue > 0 ? (totalNetIncome / totalRevenue * 100) : 0;
    return { count: orders.length, totalRevenue, totalFees, totalShipping, totalNetIncome, profitMargin };
  }, [orders]);

  const feesData = useMemo(() => {
    const byPlatform: Record<string, { sales: number; commission: number; serviceFee: number; paymentFee: number; shippingCost: number; netIncome: number; count: number }> = {};
    orders.forEach(o => {
      if (!byPlatform[o.platform]) {
        byPlatform[o.platform] = { sales: 0, commission: 0, serviceFee: 0, paymentFee: 0, shippingCost: 0, netIncome: 0, count: 0 };
      }
      const d = byPlatform[o.platform];
      const subtotal = Number(o.netSellingPrice || o.subtotal || 0);
      const comm = Number(o.commissionFee || 0);
      const svc = Number(o.serviceFee || 0);
      const pmt = Number(o.transactionFee || 0) || Number(o.paymentFee || 0);
      const ship = Number(o.shippingCost || 0);
      const buyerShip = Number(o.shippingFee || 0);
      const platformSubsidy = Number(o.platformShippingSubsidy || 0);
      const shipDiff = Math.max(0, ship - buyerShip - platformSubsidy);
      d.sales += subtotal;
      d.commission += comm;
      d.serviceFee += svc;
      d.paymentFee += pmt;
      d.shippingCost += shipDiff;
      d.netIncome += Number(o.netIncome || 0);
      d.count++;
    });
    return byPlatform;
  }, [orders]);

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const selectAllOrders = useCallback(() => {
    setSelectedIds(new Set(paginatedOrders.map(o => o.id)));
  }, [paginatedOrders]);

  const selectAllEligible = useCallback(() => {
    setSelectedIds(new Set(eligibleOrders.map(o => o.id)));
  }, [eligibleOrders]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const selectedOrder = orders.find(o => o.id === selectedOrderId);
  const allOrdersSelected = paginatedOrders.length > 0 && paginatedOrders.every(o => selectedIds.has(o.id));

  function handleViewOrder(orderId: number) {
    setSelectedOrderId(orderId);
    setOrderDetailOpen(true);
  }

  function handleExpandRow(orderId: number) {
    if (expandedRow === orderId) {
      setExpandedRow(null);
      setSelectedOrderId(null);
    } else {
      setExpandedRow(orderId);
      setSelectedOrderId(orderId);
    }
  }

  function handleExcel() {
    if (orders.length === 0) return;
    const today = new Date();
    const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
    const rows = orders.map(o => {
      const comm = Number(o.commissionFee || 0);
      const svc = Number(o.serviceFee || 0);
      const pmt = Number(o.transactionFee || 0) || Number(o.paymentFee || 0);
      const ship = Number(o.shippingCost || 0);
      const fees = comm + svc + pmt;
      const totalAmt = Number(o.totalAmount || 0);
      const net = Number(o.netIncome || 0);
      const margin = totalAmt > 0 ? (net / totalAmt * 100).toFixed(1) + "%" : "0%";
      const statusLabel = ORDER_STATUSES.find(s => s.value === o.status)?.label || o.status;
      return {
        "เลขที่ออเดอร์": o.orderNo || o.platformOrderId || "",
        "แพลตฟอร์ม": PLATFORMS.find(p => p.value === o.platform)?.label || o.platform,
        "ลูกค้า": (o as any).customerName || (o as any).buyerName || "",
        "เบอร์โทร": o.buyerPhone || "",
        "มูลค่ารวม": totalAmt,
        "ค่าธรรมเนียม": fees,
        "ค่าจัดส่งจริง": ship,
        "รายได้สุทธิ": net,
        "กำไร %": margin,
        "ขนส่ง": o.shippingProvider || "",
        "เลขพัสดุ": o.trackingNo || "",
        "ชำระเงิน": o.paymentMethod || "",
        "COD": o.isCod ? "ใช่" : "ไม่",
        "สถานะ": statusLabel,
        "วอลเลท": o.settlementStatus === "settled" ? "เข้าแล้ว" : o.settlementStatus === "discrepancy" ? "มีส่วนต่าง" : "รอ Settle",
        "วันที่": formatDate(o.createdAt as any, dateEra, dateFmt),
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Orders");
    XLSX.writeFile(wb, `ออเดอร์_E-Commerce_${dateStr}.xlsx`);
  }

  function handlePDF() {
    if (orders.length === 0) return;
    const today = new Date();
    const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    doc.addFont("/fonts/THSarabunNew.ttf", "THSarabun", "normal");
    doc.addFont("/fonts/THSarabunNew-Bold.ttf", "THSarabun", "bold");

    const hasThai = /[\u0E00-\u0E7F]/.test("ก");
    const fontName = hasThai ? "THSarabun" : "helvetica";

    try { doc.setFont(fontName, "bold"); } catch { doc.setFont("helvetica", "bold"); }
    doc.setFontSize(16);
    doc.text("รายงานคำสั่งซื้อ E-Commerce", 148.5, 12, { align: "center" });
    doc.setFontSize(10);
    try { doc.setFont(fontName, "normal"); } catch { doc.setFont("helvetica", "normal"); }
    const filterLabel = settlementFilter !== "all"
      ? ` | Settlement: ${settlementFilter === "pending" ? "ยังไม่ Settle" : settlementFilter === "settled" ? "Settle แล้ว" : "มีส่วนต่าง"}`
      : "";
    doc.text(`วันที่พิมพ์: ${formatDate(new Date().toISOString(), dateEra, dateFmt)} | ${orders.length} รายการ${filterLabel}`, 148.5, 18, { align: "center" });

    const head = [["#", "เลขออเดอร์", "แพลตฟอร์ม", "ลูกค้า", "มูลค่ารวม", "ค่าธรรมเนียม", "ค่าจัดส่งจริง", "รายได้สุทธิ", "กำไร%", "สถานะ", "วอลเลท", "วันที่"]];
    const body = orders.map((o, i) => {
      const comm = Number(o.commissionFee || 0);
      const svc = Number(o.serviceFee || 0);
      const pmt = Number(o.transactionFee || 0) || Number(o.paymentFee || 0);
      const fees = comm + svc + pmt;
      const totalAmt = Number(o.totalAmount || 0);
      const net = Number(o.netIncome || 0);
      const ship = Number(o.shippingCost || 0);
      const margin = totalAmt > 0 ? (net / totalAmt * 100).toFixed(1) + "%" : "0%";
      const statusLabel = ORDER_STATUSES.find(s => s.value === o.status)?.label || o.status;
      const settleLabel = o.settlementStatus === "settled" ? "เข้าแล้ว" : o.settlementStatus === "discrepancy" ? "มีส่วนต่าง" : "รอ Settle";
      return [
        i + 1,
        o.orderNo || o.platformOrderId || "",
        PLATFORMS.find(p => p.value === o.platform)?.label || o.platform,
        (o as any).customerName || (o as any).buyerName || "",
        totalAmt.toLocaleString("th-TH", { minimumFractionDigits: 2 }),
        fees.toLocaleString("th-TH", { minimumFractionDigits: 2 }),
        ship.toLocaleString("th-TH", { minimumFractionDigits: 2 }),
        net.toLocaleString("th-TH", { minimumFractionDigits: 2 }),
        margin,
        statusLabel,
        settleLabel,
        formatDate(o.createdAt as any, dateEra, dateFmt),
      ];
    });

    const totalAmt = orders.reduce((s, o) => s + Number(o.totalAmount || 0), 0);
    const totalFees = orders.reduce((s, o) => s + Number(o.commissionFee || 0) + Number(o.serviceFee || 0) + (Number(o.transactionFee || 0) || Number(o.paymentFee || 0)), 0);
    const totalShip = orders.reduce((s, o) => s + Number(o.shippingCost || 0), 0);
    const totalNet = orders.reduce((s, o) => s + Number(o.netIncome || 0), 0);
    const totalMargin = totalAmt > 0 ? (totalNet / totalAmt * 100).toFixed(1) + "%" : "0%";
    body.push([
      "", "รวมทั้งสิ้น", "", "",
      totalAmt.toLocaleString("th-TH", { minimumFractionDigits: 2 }),
      totalFees.toLocaleString("th-TH", { minimumFractionDigits: 2 }),
      totalShip.toLocaleString("th-TH", { minimumFractionDigits: 2 }),
      totalNet.toLocaleString("th-TH", { minimumFractionDigits: 2 }),
      totalMargin, "", "", "",
    ]);

    autoTable(doc, {
      head,
      body,
      startY: 22,
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [251, 150, 120], textColor: 255, fontSize: 8 },
      columnStyles: {
        0: { halign: "center", cellWidth: 8 },
        4: { halign: "right" },
        5: { halign: "right" },
        6: { halign: "right" },
        7: { halign: "right" },
        8: { halign: "center" },
        10: { halign: "center" },
      },
      didParseCell: (data: any) => {
        if (data.row.index === body.length - 1) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [255, 243, 224];
        }
        if (data.column.index === 10 && data.section === "body" && data.row.index < body.length - 1) {
          const val = data.cell.raw;
          if (val === "เข้าแล้ว") {
            data.cell.styles.textColor = [5, 150, 105];
          } else if (val === "มีส่วนต่าง") {
            data.cell.styles.textColor = [220, 38, 38];
          } else {
            data.cell.styles.textColor = [217, 119, 6];
          }
        }
      },
    });

    doc.save(`ออเดอร์_E-Commerce_${dateStr}.pdf`);
  }

  function handleBatchGenerate() {
    const ids = Array.from(selectedIds).filter(id => eligibleOrders.some(o => o.id === id));
    if (ids.length === 0) {
      toast({ title: "กรุณาเลือกคำสั่งซื้อ", variant: "destructive" });
      return;
    }
    batchGenerateMutation.mutate(ids);
  }

  function setQuickDate(days: number) {
    const end = new Date();
    const start = new Date();
    if (days === 0) {
      setStartDate(toLocalDateStr(end));
      setEndDate(toLocalDateStr(end));
    } else if (days === -1) {
      start.setDate(start.getDate() - 1);
      setStartDate(toLocalDateStr(start));
      setEndDate(toLocalDateStr(start));
    } else {
      start.setDate(start.getDate() - days);
      setStartDate(toLocalDateStr(start));
      setEndDate(toLocalDateStr(end));
    }
  }

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (itemCountFilter !== "all") count++;
    if (productFilter !== "all") count++;
    if (shippingFilter !== "all") count++;
    if (codFilter !== "all") count++;
    if (notesFilter !== "all") count++;
    if (docFilter !== "all") count++;
    if (settlementFilter !== "all") count++;
    return count;
  }, [itemCountFilter, productFilter, shippingFilter, codFilter, notesFilter, docFilter, settlementFilter]);

  function clearAllFilters() {
    setStatusTab("all");
    setPlatformFilter("all");
    setStoreFilter("all");
    setDocFilter("all");
    setSearchText("");
    setStartDate(yearStart);
    setEndDate(todayStr);
    setItemCountFilter("all");
    setProductFilter("all");
    setShippingFilter("all");
    setCodFilter("all");
    setNotesFilter("all");
    setSettlementFilter("all");
    setSelectedIds(new Set());
    setCurrentPage(1);
  }

  return (
    <EcommerceLayout>
      <div className="space-y-4" data-testid="page-ecommerce-orders">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800" data-testid="text-hub-title">จัดการคำสั่งซื้อ</h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-muted-foreground text-sm">รายการคำสั่งซื้อจากทุกแพลตฟอร์ม</p>
              {company && (
                <Badge className={isFullAccounting ? "bg-blue-100 text-blue-700 hover:bg-blue-100" : "bg-amber-100 text-amber-700 hover:bg-amber-100"} data-testid="badge-accounting-mode">
                  {isFullAccounting ? (
                    <><BookOpen className="h-3 w-3 mr-1" />ทำบัญชีเต็มรูปแบบ</>
                  ) : (
                    <><FileText className="h-3 w-3 mr-1" />เฉพาะเอกสาร</>
                  )}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex gap-1.5">
            <Button
              size="sm"
              className="h-9 text-xs gap-1.5 text-white"
              style={{ background: "#03c9d7" }}
              onClick={handleExcel}
              disabled={orders.length === 0}
              data-testid="button-excel"
            >
              <FileDown className="h-4 w-4" />
              Excel
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-9 text-xs gap-1.5 border-[#fb9678] text-[#fb9678] hover:bg-[#fb9678]/10"
              onClick={handlePDF}
              disabled={orders.length === 0}
              data-testid="button-pdf"
            >
              <FileText className="h-4 w-4" />
              PDF
            </Button>
          </div>
        </div>

        {/* Settlement Summary */}
        {settlementSummary.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-3" data-testid="settlement-summary">
            {(() => {
              const pending = settlementSummary.find(s => s.status === "pending");
              const settled = settlementSummary.find(s => s.status === "settled");
              const discrepancy = settlementSummary.find(s => s.status === "discrepancy");
              return (
                <>
                  <button
                    onClick={() => { setSettlementFilter(settlementFilter === "pending" ? "all" : "pending"); setCurrentPage(1); }}
                    className={`rounded-lg p-3 text-center border transition-all cursor-pointer ${settlementFilter === "pending" ? "ring-2 ring-amber-400 bg-amber-50 border-amber-300" : "bg-amber-50 border-amber-200 hover:border-amber-300"}`}
                    data-testid="card-unsettled"
                  >
                    <div className="text-xs text-amber-600 flex items-center justify-center gap-1"><Clock className="h-3 w-3" /> ยังไม่ Settle</div>
                    <div className="font-bold text-lg text-amber-700">{pending?.count || 0} <span className="text-xs font-normal">ออเดอร์</span></div>
                    <div className="text-xs text-amber-600">฿{Number(pending?.totalAmount || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</div>
                  </button>
                  <button
                    onClick={() => { setSettlementFilter(settlementFilter === "settled" ? "all" : "settled"); setCurrentPage(1); }}
                    className={`rounded-lg p-3 text-center border transition-all cursor-pointer ${settlementFilter === "settled" ? "ring-2 ring-emerald-400 bg-emerald-50 border-emerald-300" : "bg-emerald-50 border-emerald-200 hover:border-emerald-300"}`}
                    data-testid="card-settled"
                  >
                    <div className="text-xs text-emerald-600 flex items-center justify-center gap-1"><CheckCircle2 className="h-3 w-3" /> Settle แล้ว</div>
                    <div className="font-bold text-lg text-emerald-700">{settled?.count || 0} <span className="text-xs font-normal">ออเดอร์</span></div>
                    <div className="text-xs text-emerald-600">฿{Number(settled?.totalAmount || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</div>
                  </button>
                  <button
                    onClick={() => { setSettlementFilter(settlementFilter === "discrepancy" ? "all" : "discrepancy"); setCurrentPage(1); }}
                    className={`rounded-lg p-3 text-center border transition-all cursor-pointer ${settlementFilter === "discrepancy" ? "ring-2 ring-red-400 bg-red-50 border-red-300" : "bg-red-50 border-red-200 hover:border-red-300"}`}
                    data-testid="card-discrepancy"
                  >
                    <div className="text-xs text-red-600 flex items-center justify-center gap-1"><AlertCircle className="h-3 w-3" /> มีส่วนต่าง</div>
                    <div className="font-bold text-lg text-red-700">{discrepancy?.count || 0} <span className="text-xs font-normal">ออเดอร์</span></div>
                    <div className="text-xs text-red-600">฿{Number(discrepancy?.totalAmount || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</div>
                  </button>
                </>
              );
            })()}
          </div>
        )}

        {/* Status Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1" data-testid="status-tabs">
          <button
            onClick={() => { setStatusTab("all"); setSelectedIds(new Set()); setCurrentPage(1); }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${statusTab === "all" ? "text-white shadow-md" : "text-gray-600 bg-gray-50 hover:bg-gray-100"}`}
            style={statusTab === "all" ? { background: "#03c9d7" } : {}}
            data-testid="tab-status-all"
          >
            <ShoppingCart className="h-4 w-4" />
            ทั้งหมด
            <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${statusTab === "all" ? "bg-white/20 text-white" : "bg-gray-200 text-gray-600"}`}>
              {statusCounts.all}
            </span>
          </button>
          {ORDER_STATUSES.map(s => {
            const Icon = s.icon;
            const count = statusCounts[s.value] || 0;
            const isActive = statusTab === s.value;
            return (
              <button
                key={s.value}
                onClick={() => { setStatusTab(s.value); setSelectedIds(new Set()); setCurrentPage(1); }}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${isActive ? "text-white shadow-md" : "text-gray-600 bg-gray-50 hover:bg-gray-100"}`}
                style={isActive ? { background: s.color } : {}}
                data-testid={`tab-status-${s.value}`}
              >
                <Icon className="h-4 w-4" />
                {s.label}
                <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${isActive ? "bg-white/20 text-white" : count > 0 ? "bg-gray-200 text-gray-700" : "bg-gray-100 text-gray-400"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="rounded-xl shadow-sm border" data-testid="card-total-orders">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: "#e5f9fa" }}>
                  <ShoppingCart className="h-5 w-5" style={{ color: "#03c9d7" }} />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">คำสั่งซื้อ</div>
                  <div className="text-xl font-bold" style={{ color: "#03c9d7" }} data-testid="text-total-orders">{summary.count}</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-xl shadow-sm border" data-testid="card-total-revenue">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: "#e5f9fa" }}>
                  <TrendingUp className="h-5 w-5" style={{ color: "#03c9d7" }} />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">ยอดขายรวม</div>
                  <div className="text-xl font-bold" style={{ color: "#03c9d7" }} data-testid="text-total-revenue">฿{formatCurrency(summary.totalRevenue)}</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-xl shadow-sm border" data-testid="card-total-fees">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: "#fff3ef" }}>
                  <Wallet className="h-5 w-5" style={{ color: "#fb9678" }} />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">ค่าธรรมเนียมรวม</div>
                  <div className="text-xl font-bold" style={{ color: "#fb9678" }} data-testid="text-total-fees">฿{formatCurrency(summary.totalFees)}</div>
                  {summary.totalShipping > 0 && <div className="text-[10px] text-muted-foreground">ค่าจัดส่งจริง: ฿{formatCurrency(summary.totalShipping)}</div>}
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-xl shadow-sm border" data-testid="card-net-income">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-green-50">
                  <DollarSign className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">รายได้สุทธิ</div>
                  <div className="text-xl font-bold text-green-600" data-testid="text-net-income">฿{formatCurrency(summary.totalNetIncome)}</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-xl shadow-sm border" data-testid="card-profit-margin">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-green-50">
                  <Percent className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">อัตรากำไร</div>
                  <div className="text-xl font-bold text-green-600" data-testid="text-profit-margin">{summary.profitMargin.toFixed(1)}%</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Fees Breakdown by Platform */}
        {Object.keys(feesData).length > 0 && (
          <div>
            <button
              onClick={() => setFeesExpanded(prev => !prev)}
              className="flex items-center gap-2 w-full text-left mb-3 group"
              data-testid="button-toggle-fees"
            >
              <h2 className="text-base font-semibold">สรุปค่าธรรมเนียมแยกตามแพลตฟอร์ม</h2>
              <span className="text-muted-foreground text-xs">({Object.keys(feesData).length} แพลตฟอร์ม)</span>
              {feesExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>
            {feesExpanded && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(feesData).map(([platform, data]) => {
                  const p = PLATFORMS.find(pl => pl.value === platform);
                  return (
                    <Card key={platform} className="rounded-xl shadow-sm border overflow-hidden" data-testid={`card-fees-${platform}`}>
                      <div className="h-1" style={{ background: p?.hex || "#ccc" }} />
                      <CardHeader className="pb-3">
                        <div className="flex items-center gap-2">
                          {platformBadge(platform)}
                          <span className="text-sm text-muted-foreground">({data.count} คำสั่งซื้อ)</span>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">ยอดขาย</span>
                          <span className="font-medium">฿{formatCurrency(data.sales)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">ค่าคอมมิชชั่น</span>
                          <span className="text-red-600">-฿{formatCurrency(data.commission)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">ค่าบริการ</span>
                          <span className="text-red-600">-฿{formatCurrency(data.serviceFee)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">ค่าชำระเงิน</span>
                          <span className="text-red-600">-฿{formatCurrency(data.paymentFee)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">ค่าจัดส่ง</span>
                          <span className="text-red-600">-฿{formatCurrency(data.shippingCost)}</span>
                        </div>
                        <div className="border-t pt-2 flex justify-between font-medium">
                          <span>รายได้สุทธิ</span>
                          <span className="text-green-700">฿{formatCurrency(data.netIncome)}</span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Smart Filter Bar */}
        <Card className="rounded-xl shadow-sm border">
          <CardContent className="py-3 px-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[220px] max-w-[350px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="ค้นหา ชื่อลูกค้า, เลขออเดอร์, เลขพัสดุ, เบอร์โทร..."
                  className="pl-9 h-9 text-sm"
                  value={searchText}
                  onChange={e => { setSearchText(e.target.value); setCurrentPage(1); }}
                  data-testid="input-search"
                />
              </div>

              <Select value={platformFilter} onValueChange={v => { setPlatformFilter(v); setStoreFilter("all"); setSelectedIds(new Set()); setCurrentPage(1); }}>
                <SelectTrigger className="w-[140px] h-9 text-xs" data-testid="trigger-platform-filter">
                  <SelectValue placeholder="แพลตฟอร์ม" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" data-testid="option-platform-all">ทุกแพลตฟอร์ม</SelectItem>
                  {PLATFORMS.map(p => (
                    <SelectItem key={p.value} value={p.value} data-testid={`option-platform-${p.value}`}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={storeFilter} onValueChange={v => { setStoreFilter(v); setSelectedIds(new Set()); setCurrentPage(1); }}>
                <SelectTrigger className="w-[180px] h-9 text-xs" data-testid="trigger-store-filter">
                  <SelectValue placeholder="ร้านค้า" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" data-testid="option-store-all">ทุกร้านค้า</SelectItem>
                  {ecomConnections
                    .filter((c: any) => platformFilter === "all" || c.platform === platformFilter)
                    .map((c: any) => {
                      const pl = PLATFORMS.find(p => p.value === c.platform);
                      return (
                        <SelectItem key={c.id} value={String(c.id)} data-testid={`option-store-${c.id}`}>
                          {c.shopName}{pl ? ` (${pl.label})` : ''}
                        </SelectItem>
                      );
                    })}
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <ThaiDateInput value={startDate} onChange={setStartDate} dateEra={dateEra} dateFmt={dateFmt} className="w-[155px] h-9 text-xs" data-testid="input-start-date" />
                  <span className="text-xs text-muted-foreground">-</span>
                  <ThaiDateInput value={endDate} onChange={setEndDate} dateEra={dateEra} dateFmt={dateFmt} className="w-[155px] h-9 text-xs" data-testid="input-end-date" />
                </div>
                <div className="flex items-center gap-1">
                  {[
                    { label: "วันนี้", days: 0 },
                    { label: "เมื่อวาน", days: -1 },
                    { label: "7 วัน", days: 7 },
                    { label: "30 วัน", days: 30 },
                  ].map(q => (
                    <button
                      key={q.label}
                      onClick={() => setQuickDate(q.days)}
                      className="px-2.5 py-1 rounded-full text-xs font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors whitespace-nowrap"
                      data-testid={`button-quick-date-${q.days}`}
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setShowAdvancedFilters(prev => !prev)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${showAdvancedFilters || activeFilterCount > 0 ? "bg-cyan-50 text-cyan-700 border border-cyan-200" : "bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100"}`}
                data-testid="button-advanced-filters"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                ตัวกรองเพิ่มเติม
                {activeFilterCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-xs bg-cyan-500 text-white">{activeFilterCount}</span>
                )}
                {showAdvancedFilters ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>

              {(searchText || platformFilter !== "all" || storeFilter !== "all" || startDate !== yearStart || endDate !== todayStr || activeFilterCount > 0) && (
                <button
                  onClick={clearAllFilters}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-500 bg-red-50 hover:bg-red-100 transition-colors"
                  data-testid="button-clear-all-filters"
                >
                  <X className="h-3.5 w-3.5" />
                  ล้างตัวกรอง
                </button>
              )}
            </div>

            {/* Advanced Filters Panel */}
            {showAdvancedFilters && (
              <div className="mt-3 pt-3 border-t grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">ขนส่ง</label>
                  <Select value={shippingFilter} onValueChange={v => { setShippingFilter(v); setSelectedIds(new Set()); }}>
                    <SelectTrigger className="h-8 text-xs" data-testid="trigger-shipping-filter">
                      <Truck className="h-3 w-3 mr-1 text-muted-foreground" />
                      <SelectValue placeholder="ทั้งหมด" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">ทั้งหมด</SelectItem>
                      {shippingProviders.map(sp => (
                        <SelectItem key={sp} value={sp}>{sp}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">เอกสาร</label>
                  <Select value={docFilter} onValueChange={v => { setDocFilter(v); setSelectedIds(new Set()); }}>
                    <SelectTrigger className="h-8 text-xs" data-testid="trigger-doc-filter">
                      <FileText className="h-3 w-3 mr-1 text-muted-foreground" />
                      <SelectValue placeholder="ทั้งหมด" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" data-testid="option-doc-all">ทั้งหมด</SelectItem>
                      <SelectItem value="no" data-testid="option-doc-no">ยังไม่ออกเอกสาร</SelectItem>
                      <SelectItem value="yes" data-testid="option-doc-yes">ออกเอกสารแล้ว</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Settlement</label>
                  <Select value={settlementFilter} onValueChange={v => { setSettlementFilter(v); setSelectedIds(new Set()); setCurrentPage(1); }}>
                    <SelectTrigger className="h-8 text-xs" data-testid="trigger-settlement-filter">
                      <Wallet className="h-3 w-3 mr-1 text-muted-foreground" />
                      <SelectValue placeholder="ทั้งหมด" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" data-testid="option-settle-all">ทั้งหมด</SelectItem>
                      <SelectItem value="pending" data-testid="option-settle-pending">ยังไม่ Settle</SelectItem>
                      <SelectItem value="settled" data-testid="option-settle-settled">Settle แล้ว</SelectItem>
                      <SelectItem value="discrepancy" data-testid="option-settle-discrepancy">มีส่วนต่าง</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">จำนวนชิ้น</label>
                  <Select value={itemCountFilter} onValueChange={v => { setItemCountFilter(v); setSelectedIds(new Set()); }}>
                    <SelectTrigger className="h-8 text-xs" data-testid="trigger-item-count-filter">
                      <Package className="h-3 w-3 mr-1 text-muted-foreground" />
                      <SelectValue placeholder="ทุกจำนวน" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" data-testid="option-item-count-all">ทุกจำนวนชิ้น</SelectItem>
                      {itemCountOptions.map(c => (
                        <SelectItem key={c} value={String(c)} data-testid={`option-item-count-${c}`}>
                          {c} ชิ้น ({allOrders.filter(o => (o.itemCount || 0) === c).length})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">COD</label>
                  <Select value={codFilter} onValueChange={v => { setCodFilter(v); setSelectedIds(new Set()); }}>
                    <SelectTrigger className="h-8 text-xs" data-testid="trigger-cod-filter">
                      <CreditCard className="h-3 w-3 mr-1 text-muted-foreground" />
                      <SelectValue placeholder="ทั้งหมด" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">ทั้งหมด</SelectItem>
                      <SelectItem value="cod">เก็บเงินปลายทาง</SelectItem>
                      <SelectItem value="prepaid">ชำระแล้ว</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">หมายเหตุ</label>
                  <Select value={notesFilter} onValueChange={v => { setNotesFilter(v); setSelectedIds(new Set()); }}>
                    <SelectTrigger className="h-8 text-xs" data-testid="trigger-notes-filter">
                      <Tag className="h-3 w-3 mr-1 text-muted-foreground" />
                      <SelectValue placeholder="ทั้งหมด" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">ทั้งหมด</SelectItem>
                      <SelectItem value="has">มีหมายเหตุ</SelectItem>
                      <SelectItem value="none">ไม่มีหมายเหตุ</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {productOptions.length > 0 && (
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">สินค้า</label>
                    <Select value={productFilter} onValueChange={v => { setProductFilter(v); setSelectedIds(new Set()); }}>
                      <SelectTrigger className="h-8 text-xs" data-testid="trigger-product-filter">
                        <SelectValue placeholder="ทุกสินค้า" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all" data-testid="option-product-all">ทุกสินค้า</SelectItem>
                        {productOptions.map(([name, cnt]) => (
                          <SelectItem key={name} value={name} data-testid={`option-product-${name}`}>
                            <span className="truncate max-w-[140px] inline-block">{name}</span>
                            <span className="text-muted-foreground ml-1">({cnt})</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Floating Bulk Action Bar */}
        {selectedIds.size > 0 && (
          <div className="sticky top-0 z-20">
            <Card className="rounded-xl shadow-lg border-2" style={{ borderColor: "var(--theme-primary)", background: "var(--theme-primary)" }}>
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-white">
                    <CheckSquare className="h-5 w-5" />
                    <span className="text-sm font-medium">
                      เลือก {selectedIds.size} รายการ
                      {selectedEligible.length > 0 && (
                        <span className="ml-2 opacity-80">
                          (ยอดรวม ฿{formatCurrency(selectedEligible.reduce((s, o) => s + Number(o.totalAmount || 0), 0))})
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={bulkStatusValue} onValueChange={v => {
                      if (v && selectedIds.size > 0) {
                        bulkStatusMutation.mutate({ orderIds: Array.from(selectedIds), status: v });
                      }
                    }}>
                      <SelectTrigger className="h-8 w-[140px] text-xs bg-white/10 text-white border-white/30">
                        <SelectValue placeholder="เปลี่ยนสถานะ" />
                      </SelectTrigger>
                      <SelectContent>
                        {ORDER_STATUSES.map(s => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      className="h-8 text-xs gap-1.5 bg-white text-cyan-700 hover:bg-white/90"
                      onClick={handleBatchGenerate}
                      disabled={batchGenerateMutation.isPending || selectedEligible.length === 0}
                      data-testid="button-batch-generate"
                    >
                      {batchGenerateMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                      ออกเอกสาร ({selectedEligible.length})
                    </Button>
                    <Button
                      size="sm"
                      className="h-8 text-xs gap-1.5 bg-white/10 text-white hover:bg-white/20 border border-white/30"
                      onClick={() => bulkPrintTivMutation.mutate(Array.from(selectedIds))}
                      disabled={bulkPrintTivMutation.isPending}
                      data-testid="button-batch-print-tiv"
                    >
                      {bulkPrintTivMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
                      พิมพ์ใบกำกับภาษี
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs gap-1 text-white hover:bg-white/20"
                      onClick={clearSelection}
                      data-testid="button-clear-selection"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Orders Table */}
        <Card className="rounded-xl shadow-sm border">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>กำลังโหลด...</span>
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-16">
                <ShoppingCart className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
                <p className="text-lg font-medium text-muted-foreground mb-1" data-testid="text-no-orders">ไม่พบคำสั่งซื้อ</p>
                <p className="text-sm text-muted-foreground/70">ลองเปลี่ยนตัวกรองหรือช่วงเวลาใหม่</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table data-testid="table-orders" className="table-fixed">
                  <TableHeader>
                    <TableRow className="bg-gray-50/50">
                      <TableHead className="text-xs w-10 text-center">
                        <Checkbox
                          checked={allOrdersSelected}
                          onCheckedChange={() => allOrdersSelected ? clearSelection() : selectAllOrders()}
                          data-testid="checkbox-select-all"
                        />
                      </TableHead>
                      <TableHead className="text-xs font-semibold cursor-pointer select-none hover:text-cyan-700" style={{ width: "22%" }} onClick={() => handleSort("orderNo")} data-testid="sort-orderNo">
                        <span className="flex items-center">เลขคำสั่งซื้อ<SortIcon field="orderNo" /></span>
                      </TableHead>
                      <TableHead className="text-xs font-semibold cursor-pointer select-none hover:text-cyan-700 w-24" onClick={() => handleSort("platform")} data-testid="sort-platform">
                        <span className="flex items-center">แพลตฟอร์ม<SortIcon field="platform" /></span>
                      </TableHead>
                      <TableHead className="text-xs font-semibold cursor-pointer select-none hover:text-cyan-700" style={{ width: "14%" }} onClick={() => handleSort("buyer")} data-testid="sort-buyer">
                        <span className="flex items-center">ผู้ซื้อ<SortIcon field="buyer" /></span>
                      </TableHead>
                      <TableHead className="text-xs font-semibold text-right cursor-pointer select-none hover:text-cyan-700 w-24" onClick={() => handleSort("total")} data-testid="sort-total">
                        <span className="flex items-center justify-end">ยอดรวม<SortIcon field="total" /></span>
                      </TableHead>
                      <TableHead className="text-xs font-semibold text-right cursor-pointer select-none hover:text-cyan-700 w-24" onClick={() => handleSort("net")} data-testid="sort-net">
                        <span className="flex items-center justify-end">สุทธิ<SortIcon field="net" /></span>
                      </TableHead>
                      <TableHead className="text-xs font-semibold text-center cursor-pointer select-none hover:text-cyan-700 w-12" onClick={() => handleSort("items")} data-testid="sort-items">
                        <span className="flex items-center justify-center">ชิ้น<SortIcon field="items" /></span>
                      </TableHead>
                      <TableHead className="text-xs font-semibold cursor-pointer select-none hover:text-cyan-700 w-20" onClick={() => handleSort("shipping")} data-testid="sort-shipping">
                        <span className="flex items-center">ขนส่ง<SortIcon field="shipping" /></span>
                      </TableHead>
                      <TableHead className="text-xs font-semibold cursor-pointer select-none hover:text-cyan-700 w-20" onClick={() => handleSort("status")} data-testid="sort-status">
                        <span className="flex items-center">สถานะ<SortIcon field="status" /></span>
                      </TableHead>
                      <TableHead className="text-xs font-semibold cursor-pointer select-none hover:text-cyan-700 w-20" onClick={() => handleSort("date")} data-testid="sort-date">
                        <span className="flex items-center">วันที่<SortIcon field="date" /></span>
                      </TableHead>
                      <TableHead className="text-xs font-semibold text-center w-16">เอกสาร</TableHead>
                      <TableHead className="text-xs w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedOrders.map((o) => {
                      const totalFees = Number(o.commissionFee || 0) + Number(o.serviceFee || 0) + (Number(o.transactionFee || 0) || Number(o.paymentFee || 0));
                      const isSelected = selectedIds.has(o.id);
                      const isExpanded = expandedRow === o.id;
                      return (
                        <>
                          <TableRow
                            key={o.id}
                            data-testid={`row-order-${o.id}`}
                            className={`text-sm cursor-pointer transition-colors ${isSelected ? "bg-cyan-50/50" : "hover:bg-gray-50/50"} ${isExpanded ? "border-b-0" : ""}`}
                            onClick={() => handleExpandRow(o.id)}
                          >
                            <TableCell className="py-2.5 text-center" onClick={e => e.stopPropagation()}>
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleSelect(o.id)}
                                data-testid={`checkbox-order-${o.id}`}
                              />
                            </TableCell>
                            <TableCell className="py-2.5 overflow-hidden">
                              <div className="font-mono text-xs font-medium truncate">{o.orderNo || o.platformOrderId}</div>
                              {o.trackingNo && (
                                <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                                  <Package className="h-3 w-3 flex-shrink-0" />
                                  <span className="truncate">{o.trackingNo}</span>
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="py-2.5">{platformBadge(o.platform)}</TableCell>
                            <TableCell className="py-2.5 overflow-hidden">
                              <div className="font-medium text-sm truncate">{o.buyerName || "-"}</div>
                              {o.buyerPhone && (
                                <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                  <Phone className="h-3 w-3" />
                                  {o.buyerPhone}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-right py-2.5">
                              <div className="font-semibold">฿{formatCurrency(o.totalAmount)}</div>
                              {totalFees > 0 && (
                                <div className="text-[11px] text-red-500 mt-0.5">-฿{formatCurrency(totalFees)}</div>
                              )}
                            </TableCell>
                            <TableCell className="text-right py-2.5">
                              <div className="font-semibold text-green-700">฿{formatCurrency(o.netIncome)}</div>
                              {o.settlementStatus === "settled" ? (
                                <div className="text-[10px] text-emerald-600 flex items-center justify-end gap-0.5 mt-0.5">
                                  <Wallet className="h-3 w-3" />เข้าวอลเลทแล้ว
                                </div>
                              ) : o.settlementStatus === "discrepancy" ? (
                                <div className="text-[10px] text-red-500 flex items-center justify-end gap-0.5 mt-0.5">
                                  <AlertCircle className="h-3 w-3" />มีส่วนต่าง
                                </div>
                              ) : (
                                <div className="text-[10px] text-amber-500 flex items-center justify-end gap-0.5 mt-0.5">
                                  <Clock className="h-3 w-3" />รอ Settle
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-center py-2.5">
                              <Badge className={`${(o.itemCount || 0) > 1 ? "bg-amber-100 text-amber-800 hover:bg-amber-100" : "bg-gray-100 text-gray-700 hover:bg-gray-100"}`} data-testid={`text-item-count-${o.id}`}>
                                {o.itemCount || 0}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-2.5">
                              <div className="text-xs">
                                {o.shippingProvider ? (
                                  <span className="text-gray-700">{o.shippingProvider}</span>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </div>
                              {o.isCod && (
                                <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 text-[10px] mt-0.5">COD</Badge>
                              )}
                            </TableCell>
                            <TableCell className="py-2.5">{orderStatusBadge(o.status)}</TableCell>
                            <TableCell className="py-2.5 text-xs text-muted-foreground">{formatDate(o.placedAt || o.createdAt as any, dateEra, dateFmt)}</TableCell>
                            <TableCell className="py-2.5 text-center" onClick={e => e.stopPropagation()}>
                              {o.taxInvoiceId ? (
                                <TaxInvoiceHoverPreview taxInvoiceId={o.taxInvoiceId}>
                                  <a href={`/sales/tax-invoice/pdf/${o.taxInvoiceId}`} target="_blank" rel="noopener noreferrer">
                                    <Badge className="bg-green-100 text-green-700 hover:bg-green-200 gap-1 cursor-pointer" data-testid={`button-view-doc-${o.id}`}>
                                      <FileCheck className="h-3 w-3" />ดู
                                    </Badge>
                                  </a>
                                </TaxInvoiceHoverPreview>
                              ) : o.status === "cancelled" ? (
                                <span className="text-xs text-muted-foreground">-</span>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs gap-1"
                                  style={{ borderColor: "#03c9d7", color: "#03c9d7" }}
                                  onClick={() => generateDocumentMutation.mutate(o.id)}
                                  disabled={generateDocumentMutation.isPending}
                                  data-testid={`button-gen-doc-${o.id}`}
                                >
                                  <FileText className="h-3 w-3" />ออก
                                </Button>
                              )}
                            </TableCell>
                            <TableCell className="py-2.5" onClick={e => e.stopPropagation()}>
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleViewOrder(o.id)} data-testid={`button-view-order-${o.id}`}>
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                              </div>
                            </TableCell>
                          </TableRow>

                          {/* Expanded Row Details */}
                          {isExpanded && (
                            <TableRow key={`expanded-${o.id}`} className="bg-gray-50/80" data-testid={`row-expanded-${o.id}`}>
                              <TableCell colSpan={12} className="py-0">
                                <div className="py-4 px-4 space-y-3">
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                    <div>
                                      <span className="text-xs text-muted-foreground block">ที่อยู่จัดส่ง</span>
                                      <span className="text-sm">{o.buyerAddress || "-"}</span>
                                    </div>
                                    <div>
                                      <span className="text-xs text-muted-foreground block">ชำระเงิน</span>
                                      <span className="text-sm">{o.paymentMethod || "-"}</span>
                                      {o.isCod && <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 text-[10px] ml-1">COD ฿{formatCurrency(o.codAmount)}</Badge>}
                                    </div>
                                    <div>
                                      <span className="text-xs text-muted-foreground block">เลขพัสดุ</span>
                                      <span className="text-sm font-mono">{o.trackingNo || "-"}</span>
                                    </div>
                                    {warehouses.length > 0 && (
                                      <div>
                                        <span className="text-xs text-muted-foreground block">คลังสินค้า (หัก stock เมื่อส่ง)</span>
                                        <Select
                                          value={orderWarehouseMap[o.id] ?? ((o as any).warehouseId ? String((o as any).warehouseId) : "none")}
                                          onValueChange={v => setOrderWarehouseMutation.mutate({ orderId: o.id, warehouseId: v === "none" ? null : Number(v) })}
                                        >
                                          <SelectTrigger className="h-7 text-xs mt-0.5" data-testid={`select-order-warehouse-${o.id}`}>
                                            <SelectValue placeholder="-- ไม่ระบุ --" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="none">-- ไม่ระบุ --</SelectItem>
                                            {warehouses.map((w: any) => (
                                              <SelectItem key={w.id} value={String(w.id)}>{w.code} — {w.name}</SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    )}
                                  </div>

                                  {o.notes && (
                                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2.5 text-sm">
                                      <span className="text-xs font-medium text-yellow-700 block mb-0.5">หมายเหตุ:</span>
                                      <span className="text-yellow-900">{o.notes}</span>
                                    </div>
                                  )}

                                  <div className="grid grid-cols-6 gap-3 text-sm bg-white rounded-lg p-3 border">
                                    <div className="text-center">
                                      <span className="text-xs text-muted-foreground block">ยอดสินค้า</span>
                                      <span className="font-medium">฿{formatCurrency(o.subtotal)}</span>
                                    </div>
                                    <div className="text-center">
                                      <span className="text-xs text-muted-foreground block">ค่าคอม</span>
                                      <span className="text-red-600">-฿{formatCurrency(o.commissionFee)}</span>
                                    </div>
                                    <div className="text-center">
                                      <span className="text-xs text-muted-foreground block">ค่าบริการ</span>
                                      <span className="text-red-600">-฿{formatCurrency(o.serviceFee)}</span>
                                    </div>
                                    <div className="text-center">
                                      <span className="text-xs text-muted-foreground block">ค่าชำระเงิน</span>
                                      <span className="text-red-600">-฿{formatCurrency(Number(o.transactionFee || 0) || Number(o.paymentFee || 0))}</span>
                                    </div>
                                    <div className="text-center">
                                      <span className="text-xs text-muted-foreground block">ค่าจัดส่ง</span>
                                      <span className="text-red-600">-฿{formatCurrency(o.shippingCost)}</span>
                                    </div>
                                    <div className="text-center border-l">
                                      <span className="text-xs text-muted-foreground block">รายได้สุทธิ</span>
                                      <span className="font-bold text-green-700">฿{formatCurrency(Number(o.totalAmount || 0) - Number(o.commissionFee || 0) - Number(o.serviceFee || 0) - (Number(o.transactionFee || 0) || Number(o.paymentFee || 0)) - Number(o.shippingCost || 0))}</span>
                                    </div>
                                  </div>

                                  {orderItems.length > 0 && selectedOrderId === o.id && (
                                    <div>
                                      <span className="text-xs font-medium text-muted-foreground mb-1.5 block">รายการสินค้า</span>
                                      <div className="bg-white rounded-lg border overflow-hidden">
                                        <Table>
                                          <TableHeader>
                                            <TableRow className="bg-gray-50/50">
                                              <TableHead className="text-xs">สินค้า</TableHead>
                                              <TableHead className="text-xs text-right">จำนวน</TableHead>
                                              <TableHead className="text-xs text-right">ราคา/ชิ้น</TableHead>
                                              <TableHead className="text-xs text-right">ส่วนลด</TableHead>
                                              <TableHead className="text-xs text-right">รวม</TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {orderItems.map((item, idx) => (
                                              <TableRow key={item.id || idx}>
                                                <TableCell className="text-sm font-medium">{item.name}</TableCell>
                                                <TableCell className="text-sm text-right">{Number(item.qty)}</TableCell>
                                                <TableCell className="text-sm text-right">฿{formatCurrency(item.price)}</TableCell>
                                                <TableCell className="text-sm text-right text-red-600">{Number(item.discount || 0) > 0 ? `-฿${formatCurrency(item.discount)}` : "-"}</TableCell>
                                                <TableCell className="text-sm text-right font-medium">฿{formatCurrency(item.total)}</TableCell>
                                              </TableRow>
                                            ))}
                                          </TableBody>
                                        </Table>
                                      </div>
                                    </div>
                                  )}

                                  <div className="flex items-center gap-2 pt-1">
                                    {o.taxInvoiceId ? (
                                      <TaxInvoiceHoverPreview taxInvoiceId={o.taxInvoiceId}>
                                        <a href={`/sales/tax-invoice/pdf/${o.taxInvoiceId}`} target="_blank" rel="noopener noreferrer">
                                          <Button size="sm" variant="outline" className="gap-1.5 text-green-700 border-green-300 h-8 text-xs" data-testid={`button-expanded-view-doc-${o.id}`}>
                                            <ExternalLink className="h-3.5 w-3.5" />ดูใบกำกับภาษี
                                          </Button>
                                        </a>
                                      </TaxInvoiceHoverPreview>
                                    ) : o.status !== "cancelled" && (
                                      <Button
                                        size="sm"
                                        className="gap-1.5 text-white h-8 text-xs"
                                        style={{ background: "#03c9d7" }}
                                        onClick={() => generateDocumentMutation.mutate(o.id)}
                                        disabled={generateDocumentMutation.isPending}
                                        data-testid={`button-expanded-gen-doc-${o.id}`}
                                      >
                                        <FileText className="h-3.5 w-3.5" />ออกใบกำกับภาษี
                                      </Button>
                                    )}
                                    {o.trackingNo && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="gap-1.5 h-8 text-xs"
                                        style={{ borderColor: "#05b187", color: "#05b187" }}
                                        onClick={() => { setSelectedOrderId(o.id); setLineUserId(""); setLineDialogOpen(true); }}
                                        data-testid={`button-expanded-send-line-${o.id}`}
                                      >
                                        <Send className="h-3.5 w-3.5" />แจ้ง LINE
                                      </Button>
                                    )}
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="gap-1.5 h-8 text-xs text-muted-foreground"
                                      onClick={() => handleViewOrder(o.id)}
                                      data-testid={`button-expanded-full-detail-${o.id}`}
                                    >
                                      <Eye className="h-3.5 w-3.5" />ดูรายละเอียดเต็ม
                                    </Button>
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pagination Bar */}
        {!isLoading && orders.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground px-1">
            <div className="flex items-center gap-3">
              <span>
                แสดง {Math.min((safePage - 1) * pageSize + 1, sortedOrders.length)}-{Math.min(safePage * pageSize, sortedOrders.length)} จาก {sortedOrders.length} รายการ
                {statusTab !== "all" && ` (สถานะ: ${ORDER_STATUSES.find(s => s.value === statusTab)?.label})`}
                {activeFilterCount > 0 && ` — ตัวกรอง ${activeFilterCount} รายการ`}
              </span>
              {eligibleOrders.length > 0 && selectedIds.size === 0 && (
                <Button variant="link" size="sm" className="h-6 text-xs p-0" style={{ color: "#03c9d7" }} onClick={selectAllEligible} data-testid="button-select-all-link">
                  เลือกทั้งหมดที่ยังไม่ออกเอกสาร ({eligibleOrders.length})
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">แสดง</span>
              <Select value={String(pageSize)} onValueChange={v => { setPageSize(Number(v)); setCurrentPage(1); }}>
                <SelectTrigger className="h-7 w-[70px] text-xs" data-testid="trigger-page-size">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[25, 50, 100].map(n => (
                    <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">ต่อหน้า</span>

              <div className="flex items-center gap-1 ml-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setCurrentPage(1)}
                  disabled={safePage <= 1}
                  data-testid="button-page-first"
                >
                  <ChevronsLeft className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  data-testid="button-page-prev"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>

                <div className="flex items-center gap-1 mx-1">
                  {(() => {
                    const pages: number[] = [];
                    const maxVisible = 5;
                    let start = Math.max(1, safePage - Math.floor(maxVisible / 2));
                    let end = Math.min(totalPages, start + maxVisible - 1);
                    if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);
                    for (let i = start; i <= end; i++) pages.push(i);
                    return pages.map(p => (
                      <button
                        key={p}
                        onClick={() => setCurrentPage(p)}
                        className={`h-7 min-w-[28px] px-1.5 rounded text-xs font-medium transition-colors ${p === safePage ? "text-white shadow-sm" : "text-gray-600 hover:bg-gray-100"}`}
                        style={p === safePage ? { background: "#03c9d7" } : {}}
                        data-testid={`button-page-${p}`}
                      >
                        {p}
                      </button>
                    ));
                  })()}
                </div>

                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                  data-testid="button-page-next"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={safePage >= totalPages}
                  data-testid="button-page-last"
                >
                  <ChevronsRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Order Detail Dialog */}
        <Dialog open={orderDetailOpen} onOpenChange={setOrderDetailOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-order-detail">
            <DialogHeader>
              <DialogTitle>รายละเอียดคำสั่งซื้อ</DialogTitle>
            </DialogHeader>
            {selectedOrder && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">เลขคำสั่งซื้อ:</span>
                    <span className="ml-2 font-medium" data-testid="text-order-no">{selectedOrder.orderNo || selectedOrder.platformOrderId}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">แพลตฟอร์ม:</span>
                    <span className="ml-2">{platformBadge(selectedOrder.platform)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">ผู้ซื้อ:</span>
                    <span className="ml-2 font-medium" data-testid="text-order-buyer">{selectedOrder.buyerName || "-"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">สถานะ:</span>
                    <span className="ml-2">{orderStatusBadge(selectedOrder.status)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">เบอร์โทร:</span>
                    <span className="ml-2">{selectedOrder.buyerPhone || "-"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">วันที่สั่ง:</span>
                    <span className="ml-2">{formatDate(selectedOrder.placedAt as any, dateEra, dateFmt)}</span>
                  </div>
                  {selectedOrder.trackingNo && (
                    <div>
                      <span className="text-muted-foreground">เลขพัสดุ:</span>
                      <span className="ml-2 font-mono">{selectedOrder.trackingNo}</span>
                    </div>
                  )}
                  {selectedOrder.shippingProvider && (
                    <div>
                      <span className="text-muted-foreground">ขนส่ง:</span>
                      <span className="ml-2">{selectedOrder.shippingProvider}</span>
                    </div>
                  )}
                  {selectedOrder.paymentMethod && (
                    <div>
                      <span className="text-muted-foreground">ชำระเงิน:</span>
                      <span className="ml-2">{selectedOrder.paymentMethod}</span>
                    </div>
                  )}
                  {selectedOrder.isCod && (
                    <div>
                      <span className="text-muted-foreground">COD:</span>
                      <span className="ml-2">฿{formatCurrency(selectedOrder.codAmount)}</span>
                    </div>
                  )}
                </div>

                {selectedOrder.buyerAddress && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">ที่อยู่จัดส่ง:</span>
                    <p className="mt-1 text-sm bg-gray-50 p-2 rounded">{selectedOrder.buyerAddress}</p>
                  </div>
                )}

                {selectedOrder.notes && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm">
                    <span className="text-xs font-medium text-yellow-700 block mb-0.5">หมายเหตุ:</span>
                    <span className="text-yellow-900">{selectedOrder.notes}</span>
                  </div>
                )}

                <div className="border-t pt-3">
                  <h4 className="font-medium mb-2">รายการสินค้า</h4>
                  {orderItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-3 text-center">ไม่มีรายการสินค้า</p>
                  ) : (
                    <Table data-testid="table-order-items">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">สินค้า</TableHead>
                          <TableHead className="text-xs text-right">จำนวน</TableHead>
                          <TableHead className="text-xs text-right">ราคา/ชิ้น</TableHead>
                          <TableHead className="text-xs text-right">ส่วนลด</TableHead>
                          <TableHead className="text-xs text-right">รวม</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orderItems.map((item, idx) => (
                          <TableRow key={item.id || idx} data-testid={`row-order-item-${item.id || idx}`}>
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell className="text-right">{Number(item.qty)}</TableCell>
                            <TableCell className="text-right">฿{formatCurrency(item.price)}</TableCell>
                            <TableCell className="text-right text-red-600">{Number(item.discount || 0) > 0 ? `-฿${formatCurrency(item.discount)}` : "-"}</TableCell>
                            <TableCell className="text-right font-medium">฿{formatCurrency(item.total)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>

                <div className="border-t pt-3 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ยอดสินค้า</span>
                    <span>฿{formatCurrency(selectedOrder.subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ค่าจัดส่ง</span>
                    <span>฿{formatCurrency(selectedOrder.shippingFee)}</span>
                  </div>
                  {Number(selectedOrder.platformDiscount || 0) > 0 && (
                    <div className="flex justify-between text-red-600">
                      <span>ส่วนลดแพลตฟอร์ม</span>
                      <span>-฿{formatCurrency(selectedOrder.platformDiscount)}</span>
                    </div>
                  )}
                  {Number(selectedOrder.sellerDiscount || 0) > 0 && (
                    <div className="flex justify-between text-red-600">
                      <span>ส่วนลดผู้ขาย</span>
                      <span>-฿{formatCurrency(selectedOrder.sellerDiscount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-medium border-t pt-1">
                    <span>ยอดรวม</span>
                    <span>฿{formatCurrency(selectedOrder.totalAmount)}</span>
                  </div>
                  {(() => {
                    const totalAmt = Number(selectedOrder.totalAmount || 0);
                    const commission = Number(selectedOrder.commissionFee || 0);
                    const service = Number(selectedOrder.serviceFee || 0);
                    const payment = Number(selectedOrder.transactionFee || 0) || Number(selectedOrder.paymentFee || 0);
                    const shippingCost = Number(selectedOrder.shippingCost || 0);
                    const calcNet = totalAmt - commission - service - payment - shippingCost;
                    const margin = totalAmt > 0 ? (calcNet / totalAmt * 100) : 0;
                    return (
                      <>
                        <div className="flex justify-between text-red-600">
                          <span>ค่าคอมมิชชั่น</span>
                          <span>-฿{formatCurrency(commission)}</span>
                        </div>
                        <div className="flex justify-between text-red-600">
                          <span>ค่าบริการ</span>
                          <span>-฿{formatCurrency(service)}</span>
                        </div>
                        <div className="flex justify-between text-red-600">
                          <span>ค่าชำระเงิน</span>
                          <span>-฿{formatCurrency(payment)}</span>
                        </div>
                        <div className="flex justify-between text-red-600">
                          <span>ค่าจัดส่ง (ผู้ขาย)</span>
                          <span>-฿{formatCurrency(shippingCost)}</span>
                        </div>
                        <div className="flex justify-between font-bold text-green-700 border-t pt-1 text-base">
                          <span>รายได้สุทธิ</span>
                          <span>฿{formatCurrency(calcNet)}</span>
                        </div>
                        <div className="flex justify-between font-medium text-green-700" data-testid="text-dialog-profit-margin">
                          <span>อัตรากำไร</span>
                          <span>{margin.toFixed(1)}%</span>
                        </div>
                      </>
                    );
                  })()}
                </div>

                <div className="border-t pt-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {selectedOrder.taxInvoiceId ? (
                      <>
                        <Badge className="bg-green-100 text-green-700 gap-1"><FileCheck className="h-3 w-3" />ออกเอกสารแล้ว</Badge>
                        <TaxInvoiceHoverPreview taxInvoiceId={selectedOrder.taxInvoiceId}>
                          <a href={`/sales/tax-invoice/pdf/${selectedOrder.taxInvoiceId}`} target="_blank" rel="noopener noreferrer">
                            <Button size="sm" variant="outline" className="gap-1 text-green-700 border-green-300" data-testid="button-dialog-view-doc">
                              <ExternalLink className="h-3.5 w-3.5" />ดูใบกำกับภาษี
                            </Button>
                          </a>
                        </TaxInvoiceHoverPreview>
                      </>
                    ) : selectedOrder.status !== "cancelled" ? (
                      <Button
                        size="sm"
                        className="gap-1 text-white"
                        style={{ background: "#03c9d7" }}
                        onClick={() => { generateDocumentMutation.mutate(selectedOrder.id); setOrderDetailOpen(false); }}
                        disabled={generateDocumentMutation.isPending}
                        data-testid="button-dialog-gen-doc"
                      >
                        <FileText className="h-3.5 w-3.5" />ออกใบกำกับภาษี
                      </Button>
                    ) : (
                      <Badge className="bg-red-100 text-red-700">ยกเลิก</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedOrder.trackingNo && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        style={{ borderColor: "#05b187", color: "#05b187" }}
                        onClick={() => { setLineUserId(""); setLineDialogOpen(true); }}
                        data-testid="button-dialog-send-line"
                      >
                        <Send className="h-3.5 w-3.5" />แจ้ง LINE
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Batch Result Dialog */}
        <Dialog open={batchResultOpen} onOpenChange={setBatchResultOpen}>
          <DialogContent className="max-w-lg" data-testid="dialog-batch-result">
            <DialogHeader>
              <DialogTitle>ผลการออกเอกสาร</DialogTitle>
            </DialogHeader>
            {batchResult && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <Card className="rounded-lg border">
                    <CardContent className="p-3 text-center">
                      <div className="text-2xl font-bold" style={{ color: "#03c9d7" }}>{batchResult.summary?.total || 0}</div>
                      <div className="text-xs text-muted-foreground">ทั้งหมด</div>
                    </CardContent>
                  </Card>
                  <Card className="rounded-lg border">
                    <CardContent className="p-3 text-center">
                      <div className="text-2xl font-bold text-green-600">{batchResult.summary?.success || 0}</div>
                      <div className="text-xs text-muted-foreground">สำเร็จ</div>
                    </CardContent>
                  </Card>
                  <Card className="rounded-lg border">
                    <CardContent className="p-3 text-center">
                      <div className="text-2xl font-bold text-red-600">{batchResult.summary?.failed || 0}</div>
                      <div className="text-xs text-muted-foreground">ล้มเหลว</div>
                    </CardContent>
                  </Card>
                </div>

                {batchResult.accountingMode === "full_accounting" && (
                  <div className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 rounded-lg p-3">
                    <BookOpen className="h-4 w-4 flex-shrink-0" />
                    <span>ลงบันทึกบัญชีอัตโนมัติแล้ว - เอกสารจะแสดงในหน้าบัญชีด้วย</span>
                  </div>
                )}

                {batchResult.accountingMode === "document_only" && (
                  <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 rounded-lg p-3">
                    <FileText className="h-4 w-4 flex-shrink-0" />
                    <span>สร้างเอกสารเท่านั้น - ไม่ลงบัญชี</span>
                  </div>
                )}

                {(batchResult.summary?.failed || 0) > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium flex items-center gap-1 text-red-700">
                      <AlertCircle className="h-4 w-4" />
                      รายการที่ล้มเหลว
                    </h4>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {batchResult.results?.filter((r: any) => !r.success).map((r: any, i: number) => (
                        <div key={i} className="text-xs bg-red-50 p-2 rounded flex justify-between">
                          <span>Order #{r.orderId}</span>
                          <span className="text-red-600">{r.error}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Button className="w-full" onClick={() => setBatchResultOpen(false)} data-testid="button-close-batch-result">
                  ปิด
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* LINE Tracking Dialog */}
        <Dialog open={lineDialogOpen} onOpenChange={setLineDialogOpen}>
          <DialogContent className="max-w-sm" data-testid="dialog-line-tracking">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" style={{ color: "#05b187" }} />
                ส่งเลขพัสดุผ่าน LINE
              </DialogTitle>
            </DialogHeader>
            {selectedOrder && (
              <div className="space-y-4">
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">คำสั่งซื้อ:</span>
                    <span className="font-medium">{selectedOrder.orderNo || selectedOrder.platformOrderId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">เลขพัสดุ:</span>
                    <span className="font-mono">{selectedOrder.trackingNo}</span>
                  </div>
                  {selectedOrder.shippingProvider && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">ขนส่ง:</span>
                      <span>{selectedOrder.shippingProvider}</span>
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">LINE User ID ของผู้ซื้อ</label>
                  <Input
                    placeholder="U1234567890abcdef..."
                    value={lineUserId}
                    onChange={e => setLineUserId(e.target.value)}
                    data-testid="input-line-user-id"
                  />
                  <p className="text-xs text-muted-foreground mt-1">ใส่ LINE User ID ของผู้ซื้อเพื่อส่งแจ้งเตือนเลขพัสดุ</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setLineDialogOpen(false)} data-testid="button-cancel-line">
                    ยกเลิก
                  </Button>
                  <Button
                    className="flex-1 text-white gap-1"
                    style={{ background: "#05b187" }}
                    disabled={!lineUserId.trim() || sendTrackingMutation.isPending}
                    onClick={() => {
                      sendTrackingMutation.mutate({ orderId: selectedOrder.id, lineUserId: lineUserId.trim() });
                      setLineDialogOpen(false);
                    }}
                    data-testid="button-send-line-tracking"
                  >
                    {sendTrackingMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    ส่งแจ้งเตือน
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </EcommerceLayout>
  );
}
