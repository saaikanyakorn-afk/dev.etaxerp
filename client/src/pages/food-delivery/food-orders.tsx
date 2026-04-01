import FoodDeliveryLayout from "@/components/food-delivery-layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Eye, ShoppingCart, TrendingUp, Wallet, DollarSign,
  CheckSquare, Loader2, UtensilsCrossed,
  ChevronDown, ChevronUp, Percent, X, FileDown,
  Search, Clock, Truck, CheckCircle2, XCircle, Calendar, SlidersHorizontal,
  Phone, CreditCard, Tag, ArrowUpDown, ArrowUp, ArrowDown,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight
} from "lucide-react";
import * as XLSX from "xlsx";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { formatDate } from "@/lib/format";
import { useState, useMemo, useCallback, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import type { EcommerceOrder, EcommerceOrderItem } from "@shared/schema";
import ThaiDateInput from "@/components/thai-date-input";
import { toLocalDateStr } from "@/lib/utils";

import { useDateSettings } from "@/hooks/use-date-settings";
type FoodOrderWithItems = EcommerceOrder & { itemCount?: number; itemNames?: string[] };

const FOOD_PLATFORMS = [
  { value: "grab_food", label: "Grab Food", hex: "#00B14F", bgLight: "bg-green-100", textColor: "text-green-700" },
  { value: "line_man", label: "LINE MAN", hex: "#06C755", bgLight: "bg-emerald-100", textColor: "text-emerald-700" },
  { value: "robinhood", label: "Robinhood", hex: "#6B21A8", bgLight: "bg-purple-100", textColor: "text-purple-700" },
];

const FOOD_PLATFORM_VALUES = FOOD_PLATFORMS.map(p => p.value);

const ORDER_STATUSES = [
  { value: "pending", label: "รอดำเนินการ", icon: Clock, color: "#fec90f", bgColor: "bg-yellow-100", textColor: "text-yellow-800" },
  { value: "confirmed", label: "กำลังเตรียม", icon: CheckCircle2, color: "var(--theme-primary)", bgColor: "bg-blue-100", textColor: "text-blue-800" },
  { value: "shipping", label: "กำลังจัดส่ง", icon: Truck, color: "#7c3aed", bgColor: "bg-purple-100", textColor: "text-purple-800" },
  { value: "delivered", label: "เสร็จสิ้น", icon: CheckCircle2, color: "#05b187", bgColor: "bg-green-100", textColor: "text-green-800" },
  { value: "cancelled", label: "ยกเลิก", icon: XCircle, color: "#f94d4d", bgColor: "bg-red-100", textColor: "text-red-800" },
];

function platformBadge(platform: string) {
  const p = FOOD_PLATFORMS.find(pl => pl.value === platform);
  if (!p) return <Badge data-testid={`badge-platform-${platform}`} className="bg-gray-100 text-gray-700 hover:bg-gray-100">{platform}</Badge>;
  return <Badge data-testid={`badge-platform-${platform}`} className={`${p.bgLight} ${p.textColor} hover:${p.bgLight}`}>{p.label}</Badge>;
}

function orderStatusBadge(status: string) {
  const s = ORDER_STATUSES.find(os => os.value === status);
  if (!s) return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">{status}</Badge>;
  return <Badge data-testid={`badge-order-status-${status}`} className={`${s.bgColor} ${s.textColor} hover:${s.bgColor}`}>{s.label}</Badge>;
}

function formatCurrency(v: string | number | null | undefined) {
  return Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function FoodOrders() {
  const { selectedCompanyId } = useCompany();
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
  const [searchText, setSearchText] = useState("");
  const now = new Date();
  const yearStart = `${now.getFullYear()}-01-01`;
  const todayStr = toLocalDateStr(now);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
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
  const [bulkStatusValue, setBulkStatusValue] = useState("");

  const { data: connections = [] } = useQuery<any[]>({
    queryKey: ["/api/ecommerce/connections", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/ecommerce/connections?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const foodConnections = useMemo(() =>
    connections.filter((c: any) => FOOD_PLATFORM_VALUES.includes(c.platform)),
    [connections]
  );

  const { data: rawOrders = [], isLoading } = useQuery<FoodOrderWithItems[]>({
    queryKey: ["/api/ecommerce/orders", selectedCompanyId, "food-delivery", startDate, endDate],
    queryFn: async () => {
      let url = `/api/ecommerce/orders?companyId=${selectedCompanyId}`;
      if (startDate) url += `&startDate=${startDate}`;
      if (endDate) url += `&endDate=${endDate}`;
      const r = await fetch(url, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const allOrdersUnfiltered = useMemo(() => {
    let filtered = rawOrders.filter(o => FOOD_PLATFORM_VALUES.includes(o.platform));
    if (platformFilter !== "all") filtered = filtered.filter(o => o.platform === platformFilter);
    if (storeFilter !== "all") filtered = filtered.filter(o => String(o.connectionId) === storeFilter);
    return filtered;
  }, [rawOrders, platformFilter, storeFilter]);

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

  const orders = useMemo(() => {
    let filtered = allOrders;
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
        (o.buyerPhone || "").toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [allOrders, codFilter, notesFilter, searchText]);

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
        case "commission":
          cmp = Number(a.commissionFee || 0) - Number(b.commissionFee || 0);
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
  }, [statusTab, platformFilter, searchText, codFilter, notesFilter, startDate, endDate, sortField, sortDir]);

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

  const summary = useMemo(() => {
    let totalRevenue = 0, totalFees = 0, totalNetIncome = 0;
    orders.forEach(o => {
      totalRevenue += Number(o.totalAmount || 0);
      totalFees += Number(o.commissionFee || 0) + Number(o.serviceFee || 0) + Number(o.paymentFee || 0) + Number(o.shippingCost || 0);
      totalNetIncome += Number(o.netIncome || 0);
    });
    const profitMargin = totalRevenue > 0 ? (totalNetIncome / totalRevenue * 100) : 0;
    return { count: orders.length, totalRevenue, totalFees, totalNetIncome, profitMargin };
  }, [orders]);

  const feesData = useMemo(() => {
    const byPlatform: Record<string, { sales: number; commission: number; serviceFee: number; paymentFee: number; shippingCost: number; netIncome: number; count: number }> = {};
    orders.forEach(o => {
      if (!byPlatform[o.platform]) {
        byPlatform[o.platform] = { sales: 0, commission: 0, serviceFee: 0, paymentFee: 0, shippingCost: 0, netIncome: 0, count: 0 };
      }
      const d = byPlatform[o.platform];
      d.sales += Number(o.totalAmount || 0);
      d.commission += Number(o.commissionFee || 0);
      d.serviceFee += Number(o.serviceFee || 0);
      d.paymentFee += Number(o.paymentFee || 0);
      d.shippingCost += Number(o.shippingCost || 0);
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
      const totalFees = Number(o.commissionFee || 0) + Number(o.serviceFee || 0) + Number(o.paymentFee || 0) + Number(o.shippingCost || 0);
      const totalAmt = Number(o.totalAmount || 0);
      const net = Number(o.netIncome || 0);
      const margin = totalAmt > 0 ? (net / totalAmt * 100).toFixed(1) + "%" : "0%";
      const statusLabel = ORDER_STATUSES.find(s => s.value === o.status)?.label || o.status;
      return {
        "เลขที่ออเดอร์": o.orderNo || o.platformOrderId || "",
        "แพลตฟอร์ม": FOOD_PLATFORMS.find(p => p.value === o.platform)?.label || o.platform,
        "ลูกค้า": o.buyerName || "",
        "เบอร์โทร": o.buyerPhone || "",
        "มูลค่ารวม": totalAmt,
        "ค่าคอมมิชชั่น": Number(o.commissionFee || 0),
        "ค่าธรรมเนียมรวม": totalFees,
        "รายได้สุทธิ": net,
        "กำไร %": margin,
        "ชำระเงิน": o.paymentMethod || "",
        "COD": o.isCod ? "ใช่" : "ไม่",
        "สถานะ": statusLabel,
        "วันที่": formatDate(o.createdAt as any, dateEra, dateFmt),
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "FoodOrders");
    XLSX.writeFile(wb, `ออเดอร์_Food_Delivery_${dateStr}.xlsx`);
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
    if (codFilter !== "all") count++;
    if (notesFilter !== "all") count++;
    return count;
  }, [codFilter, notesFilter]);

  function clearAllFilters() {
    setStatusTab("all");
    setPlatformFilter("all");
    setStoreFilter("all");
    setSearchText("");
    setStartDate(yearStart);
    setEndDate(todayStr);
    setCodFilter("all");
    setNotesFilter("all");
    setSelectedIds(new Set());
    setCurrentPage(1);
  }

  return (
    <FoodDeliveryLayout>
      <div className="space-y-4" data-testid="page-food-orders">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800" data-testid="text-page-title">ออเดอร์อาหาร</h1>
            <p className="text-muted-foreground text-sm">รายการออเดอร์จากแพลตฟอร์มสั่งอาหาร</p>
          </div>
          <Button
            size="sm"
            className="h-9 text-xs gap-1.5 text-white"
            style={{ background: "#03c9d7" }}
            onClick={handleExcel}
            disabled={orders.length === 0}
            data-testid="button-excel"
          >
            <FileDown className="h-4 w-4" />
            ส่งออก Excel
          </Button>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto pb-1" data-testid="status-tabs">
          <button
            onClick={() => { setStatusTab("all"); setSelectedIds(new Set()); setCurrentPage(1); }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${statusTab === "all" ? "text-white shadow-md" : "text-gray-600 bg-gray-50 hover:bg-gray-100"}`}
            style={statusTab === "all" ? { background: "#03c9d7" } : {}}
            data-testid="tab-status-all"
          >
            <UtensilsCrossed className="h-4 w-4" />
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

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="rounded-xl shadow-sm border" data-testid="card-total-orders">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: "#e5f9fa" }}>
                  <UtensilsCrossed className="h-5 w-5" style={{ color: "#03c9d7" }} />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">ออเดอร์</div>
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
                  <div className="text-xs text-muted-foreground">ค่าคอมมิชชั่น</div>
                  <div className="text-xl font-bold" style={{ color: "#fb9678" }} data-testid="text-total-fees">฿{formatCurrency(summary.totalFees)}</div>
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

        {Object.keys(feesData).length > 0 && (
          <div>
            <button
              onClick={() => setFeesExpanded(prev => !prev)}
              className="flex items-center gap-2 w-full text-left mb-3 group"
              data-testid="button-toggle-fees"
            >
              <h2 className="text-base font-semibold">สรุปค่าคอมมิชชั่นแยกตามแพลตฟอร์ม</h2>
              <span className="text-muted-foreground text-xs">({Object.keys(feesData).length} แพลตฟอร์ม)</span>
              {feesExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>
            {feesExpanded && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(feesData).map(([platform, data]) => {
                  const p = FOOD_PLATFORMS.find(pl => pl.value === platform);
                  return (
                    <Card key={platform} className="rounded-xl shadow-sm border overflow-hidden" data-testid={`card-fees-${platform}`}>
                      <div className="h-1" style={{ background: p?.hex || "#ccc" }} />
                      <CardHeader className="pb-3">
                        <div className="flex items-center gap-2">
                          {platformBadge(platform)}
                          <span className="text-sm text-muted-foreground">({data.count} ออเดอร์)</span>
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

        <Card className="rounded-xl shadow-sm border">
          <CardContent className="py-3 px-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[220px] max-w-[350px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="ค้นหา เลขออเดอร์, ชื่อลูกค้า, เบอร์โทร..."
                  className="pl-9 h-9 text-sm"
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                  data-testid="input-search"
                />
              </div>

              <Select value={platformFilter} onValueChange={v => { setPlatformFilter(v); setStoreFilter("all"); setSelectedIds(new Set()); setCurrentPage(1); }}>
                <SelectTrigger className="w-[140px] h-9 text-xs" data-testid="trigger-platform-filter">
                  <SelectValue placeholder="แพลตฟอร์ม" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" data-testid="option-platform-all">ทุกแพลตฟอร์ม</SelectItem>
                  {FOOD_PLATFORMS.map(p => (
                    <SelectItem key={p.value} value={p.value} data-testid={`option-platform-${p.value}`}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={storeFilter} onValueChange={v => { setStoreFilter(v); setSelectedIds(new Set()); setCurrentPage(1); }}>
                <SelectTrigger className="w-[200px] h-9 text-xs" data-testid="trigger-store-filter">
                  <SelectValue placeholder="ร้านค้า" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" data-testid="option-store-all">ทุกร้านค้า</SelectItem>
                  {foodConnections
                    .filter((c: any) => platformFilter === "all" || c.platform === platformFilter)
                    .map((c: any) => {
                      const pl = FOOD_PLATFORMS.find(p => p.value === c.platform);
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
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <ThaiDateInput value={startDate} onChange={setStartDate} dateEra={dateEra} dateFmt={dateFmt} className="w-[135px] h-9 text-xs" data-testid="input-start-date" />
                  <span className="text-xs text-muted-foreground">-</span>
                  <ThaiDateInput value={endDate} onChange={setEndDate} dateEra={dateEra} dateFmt={dateFmt} className="w-[135px] h-9 text-xs" data-testid="input-end-date" />
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

            {showAdvancedFilters && (
              <div className="mt-3 pt-3 border-t grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
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
              </div>
            )}
          </CardContent>
        </Card>

        {selectedIds.size > 0 && (
          <div className="sticky top-0 z-20">
            <Card className="rounded-xl shadow-lg border-2" style={{ borderColor: "var(--theme-primary)", background: "var(--theme-primary)" }}>
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-white">
                    <CheckSquare className="h-5 w-5" />
                    <span className="text-sm font-medium">
                      เลือก {selectedIds.size} รายการ
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={bulkStatusValue} onValueChange={v => {
                      if (v && selectedIds.size > 0) {
                        bulkStatusMutation.mutate({ orderIds: Array.from(selectedIds), status: v });
                      }
                    }}>
                      <SelectTrigger className="h-8 w-[140px] text-xs bg-white/10 text-white border-white/30" data-testid="trigger-bulk-status">
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
                      variant="ghost"
                      className="h-8 text-xs text-white/80 hover:text-white hover:bg-white/10"
                      onClick={clearSelection}
                      data-testid="button-clear-selection"
                    >
                      <X className="h-3.5 w-3.5 mr-1" />
                      ยกเลิก
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <Card className="rounded-xl shadow-sm border">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="text-center py-16">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">กำลังโหลดออเดอร์...</p>
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-16">
                <UtensilsCrossed className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-sm font-medium text-muted-foreground">ไม่พบออเดอร์อาหาร</p>
                <p className="text-sm text-muted-foreground/70">ลองเปลี่ยนตัวกรองหรือช่วงเวลาใหม่</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table data-testid="table-orders">
                  <TableHeader>
                    <TableRow className="bg-gray-50/50">
                      <TableHead className="text-xs w-10 text-center">
                        <Checkbox
                          checked={allOrdersSelected}
                          onCheckedChange={() => allOrdersSelected ? clearSelection() : selectAllOrders()}
                          data-testid="checkbox-select-all"
                        />
                      </TableHead>
                      <TableHead className="text-xs font-semibold cursor-pointer select-none hover:text-cyan-700" onClick={() => handleSort("orderNo")} data-testid="sort-orderNo">
                        <span className="flex items-center">เลขออเดอร์<SortIcon field="orderNo" /></span>
                      </TableHead>
                      <TableHead className="text-xs font-semibold cursor-pointer select-none hover:text-cyan-700" onClick={() => handleSort("platform")} data-testid="sort-platform">
                        <span className="flex items-center">แพลตฟอร์ม<SortIcon field="platform" /></span>
                      </TableHead>
                      <TableHead className="text-xs font-semibold cursor-pointer select-none hover:text-cyan-700" onClick={() => handleSort("buyer")} data-testid="sort-buyer">
                        <span className="flex items-center">ลูกค้า<SortIcon field="buyer" /></span>
                      </TableHead>
                      <TableHead className="text-xs font-semibold text-center cursor-pointer select-none hover:text-cyan-700" onClick={() => handleSort("items")} data-testid="sort-items">
                        <span className="flex items-center justify-center">รายการ<SortIcon field="items" /></span>
                      </TableHead>
                      <TableHead className="text-xs font-semibold cursor-pointer select-none hover:text-cyan-700" onClick={() => handleSort("status")} data-testid="sort-status">
                        <span className="flex items-center">สถานะ<SortIcon field="status" /></span>
                      </TableHead>
                      <TableHead className="text-xs font-semibold text-right cursor-pointer select-none hover:text-cyan-700" onClick={() => handleSort("total")} data-testid="sort-total">
                        <span className="flex items-center justify-end">ยอดรวม<SortIcon field="total" /></span>
                      </TableHead>
                      <TableHead className="text-xs font-semibold text-right cursor-pointer select-none hover:text-cyan-700" onClick={() => handleSort("commission")} data-testid="sort-commission">
                        <span className="flex items-center justify-end">ค่าคอม<SortIcon field="commission" /></span>
                      </TableHead>
                      <TableHead className="text-xs font-semibold text-right cursor-pointer select-none hover:text-cyan-700" onClick={() => handleSort("net")} data-testid="sort-net">
                        <span className="flex items-center justify-end">สุทธิ<SortIcon field="net" /></span>
                      </TableHead>
                      <TableHead className="text-xs font-semibold cursor-pointer select-none hover:text-cyan-700" onClick={() => handleSort("date")} data-testid="sort-date">
                        <span className="flex items-center">วันที่<SortIcon field="date" /></span>
                      </TableHead>
                      <TableHead className="text-xs w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedOrders.map((o) => {
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
                            <TableCell className="py-2.5">
                              <div className="font-mono text-xs font-medium">{o.orderNo || o.platformOrderId}</div>
                            </TableCell>
                            <TableCell className="py-2.5">{platformBadge(o.platform)}</TableCell>
                            <TableCell className="py-2.5">
                              <div className="font-medium text-sm">{o.buyerName || "-"}</div>
                              {o.buyerPhone && (
                                <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                  <Phone className="h-3 w-3" />
                                  {o.buyerPhone}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-center py-2.5">
                              <Badge className={`${(o.itemCount || 0) > 1 ? "bg-amber-100 text-amber-800 hover:bg-amber-100" : "bg-gray-100 text-gray-700 hover:bg-gray-100"}`} data-testid={`text-item-count-${o.id}`}>
                                {o.itemCount || 0}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-2.5">{orderStatusBadge(o.status)}</TableCell>
                            <TableCell className="text-right py-2.5">
                              <div className="font-semibold">฿{formatCurrency(o.totalAmount)}</div>
                            </TableCell>
                            <TableCell className="text-right py-2.5">
                              {Number(o.commissionFee || 0) > 0 ? (
                                <div className="text-red-600 text-xs">-฿{formatCurrency(o.commissionFee)}</div>
                              ) : (
                                <span className="text-muted-foreground text-xs">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right py-2.5">
                              <div className="font-semibold text-green-700">฿{formatCurrency(o.netIncome)}</div>
                            </TableCell>
                            <TableCell className="py-2.5 text-xs text-muted-foreground">{formatDate(o.placedAt || o.createdAt as any, dateEra, dateFmt)}</TableCell>
                            <TableCell className="py-2.5" onClick={e => e.stopPropagation()}>
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleViewOrder(o.id)} data-testid={`button-view-order-${o.id}`}>
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                              </div>
                            </TableCell>
                          </TableRow>

                          {isExpanded && (
                            <TableRow key={`expanded-${o.id}`} className="bg-gray-50/80" data-testid={`row-expanded-${o.id}`}>
                              <TableCell colSpan={11} className="py-0">
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
                                      <span className="text-xs text-muted-foreground block">แพลตฟอร์ม</span>
                                      <span className="text-sm">{platformBadge(o.platform)}</span>
                                    </div>
                                    <div>
                                      <span className="text-xs text-muted-foreground block">หมายเหตุ</span>
                                      <span className="text-sm">{o.notes || "-"}</span>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-5 gap-3 text-sm bg-white rounded-lg p-3 border">
                                    <div className="text-center">
                                      <span className="text-xs text-muted-foreground block">ยอดสินค้า</span>
                                      <span className="font-medium">฿{formatCurrency(o.subtotal)}</span>
                                    </div>
                                    <div className="text-center">
                                      <span className="text-xs text-muted-foreground block">ค่าคอมมิชชั่น</span>
                                      <span className="text-red-600">-฿{formatCurrency(o.commissionFee)}</span>
                                    </div>
                                    <div className="text-center">
                                      <span className="text-xs text-muted-foreground block">ค่าบริการ</span>
                                      <span className="text-red-600">-฿{formatCurrency(o.serviceFee)}</span>
                                    </div>
                                    <div className="text-center">
                                      <span className="text-xs text-muted-foreground block">ค่าชำระเงิน</span>
                                      <span className="text-red-600">-฿{formatCurrency(o.paymentFee)}</span>
                                    </div>
                                    <div className="text-center border-l">
                                      <span className="text-xs text-muted-foreground block">รายได้สุทธิ</span>
                                      <span className="font-bold text-green-700">฿{formatCurrency(o.netIncome)}</span>
                                    </div>
                                  </div>

                                  {orderItems.length > 0 && selectedOrderId === o.id && (
                                    <div>
                                      <span className="text-xs font-medium text-muted-foreground mb-1.5 block">รายการอาหาร</span>
                                      <div className="bg-white rounded-lg border overflow-hidden">
                                        <Table>
                                          <TableHeader>
                                            <TableRow className="bg-gray-50/50">
                                              <TableHead className="text-xs">SKU</TableHead>
                                              <TableHead className="text-xs">ชื่อรายการ</TableHead>
                                              <TableHead className="text-xs text-right">จำนวน</TableHead>
                                              <TableHead className="text-xs text-right">ราคา/ชิ้น</TableHead>
                                              <TableHead className="text-xs text-right">ส่วนลด</TableHead>
                                              <TableHead className="text-xs text-right">รวม</TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {orderItems.map((item, idx) => (
                                              <TableRow key={item.id || idx} data-testid={`row-item-${item.id || idx}`}>
                                                <TableCell className="text-xs text-muted-foreground font-mono">{item.platformSku || "-"}</TableCell>
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

        {!isLoading && orders.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground px-1">
            <div className="flex items-center gap-3">
              <span>
                แสดง {Math.min((safePage - 1) * pageSize + 1, sortedOrders.length)}-{Math.min(safePage * pageSize, sortedOrders.length)} จาก {sortedOrders.length} รายการ
                {statusTab !== "all" && ` (สถานะ: ${ORDER_STATUSES.find(s => s.value === statusTab)?.label})`}
                {activeFilterCount > 0 && ` — ตัวกรอง ${activeFilterCount} รายการ`}
              </span>
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

        <Dialog open={orderDetailOpen} onOpenChange={setOrderDetailOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UtensilsCrossed className="h-5 w-5" style={{ color: "#03c9d7" }} />
                รายละเอียดออเดอร์
              </DialogTitle>
            </DialogHeader>
            {selectedOrder && (
              <div className="space-y-4" data-testid="dialog-order-detail">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs text-muted-foreground block">เลขออเดอร์</span>
                    <span className="font-mono font-medium" data-testid="text-detail-order-no">{selectedOrder.orderNo || selectedOrder.platformOrderId}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block">แพลตฟอร์ม</span>
                    {platformBadge(selectedOrder.platform)}
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block">ลูกค้า</span>
                    <span className="font-medium" data-testid="text-detail-buyer">{selectedOrder.buyerName || "-"}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block">เบอร์โทร</span>
                    <span>{selectedOrder.buyerPhone || "-"}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block">สถานะ</span>
                    {orderStatusBadge(selectedOrder.status)}
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block">วันที่สั่ง</span>
                    <span>{formatDate(selectedOrder.placedAt || selectedOrder.createdAt as any, dateEra, dateFmt)}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-xs text-muted-foreground block">ที่อยู่จัดส่ง</span>
                    <span>{selectedOrder.buyerAddress || "-"}</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 bg-gray-50 rounded-lg p-3">
                  <div className="text-center">
                    <span className="text-xs text-muted-foreground block">ยอดรวม</span>
                    <span className="text-lg font-bold" style={{ color: "#03c9d7" }}>฿{formatCurrency(selectedOrder.totalAmount)}</span>
                  </div>
                  <div className="text-center">
                    <span className="text-xs text-muted-foreground block">ค่าคอมมิชชั่น</span>
                    <span className="text-lg font-bold text-red-600">-฿{formatCurrency(Number(selectedOrder.commissionFee || 0) + Number(selectedOrder.serviceFee || 0) + Number(selectedOrder.paymentFee || 0))}</span>
                  </div>
                  <div className="text-center">
                    <span className="text-xs text-muted-foreground block">รายได้สุทธิ</span>
                    <span className="text-lg font-bold text-green-700">฿{formatCurrency(selectedOrder.netIncome)}</span>
                  </div>
                </div>

                {selectedOrder.notes && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2.5 text-sm">
                    <span className="text-xs font-medium text-yellow-700 block mb-0.5">หมายเหตุ:</span>
                    <span className="text-yellow-900">{selectedOrder.notes}</span>
                  </div>
                )}

                {orderItems.length > 0 && (
                  <div>
                    <span className="text-sm font-medium mb-2 block">รายการอาหาร ({orderItems.length} รายการ)</span>
                    <div className="bg-white rounded-lg border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50/50">
                            <TableHead className="text-xs">SKU</TableHead>
                            <TableHead className="text-xs">ชื่อรายการ</TableHead>
                            <TableHead className="text-xs text-right">จำนวน</TableHead>
                            <TableHead className="text-xs text-right">ราคา/ชิ้น</TableHead>
                            <TableHead className="text-xs text-right">ส่วนลด</TableHead>
                            <TableHead className="text-xs text-right">รวม</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {orderItems.map((item, idx) => (
                            <TableRow key={item.id || idx} data-testid={`row-dialog-item-${item.id || idx}`}>
                              <TableCell className="text-xs text-muted-foreground font-mono">{item.platformSku || "-"}</TableCell>
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
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </FoodDeliveryLayout>
  );
}
