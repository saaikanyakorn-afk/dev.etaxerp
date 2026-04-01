import { useState, useMemo, useRef, useCallback } from "react";
import EcommerceLayout from "@/components/ecommerce-layout";
import { getPlatformLogo } from "@/lib/platform-logos";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Printer, Search, Loader2, Package, X, Truck, Eye, ClipboardList,
  Send, RefreshCw, AlertTriangle, Clock, ChevronLeft, ChevronRight,
  FileText, ScanLine, Star
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { useToast } from "@/hooks/use-toast";
import type { EcommerceOrder } from "@shared/schema";
type EcommerceOrderWithItems = EcommerceOrder & { itemCount?: number; itemNames?: string[] };
import ThaiDateInput from "@/components/thai-date-input";
import { useDateSettings } from "@/hooks/use-date-settings";
import { toLocalDateStr } from "@/lib/utils";
import { formatDate } from "@/lib/format";

const CARRIERS = [
  { value: "kerry", label: "Kerry Express" },
  { value: "flash", label: "Flash Express" },
  { value: "jt", label: "J&T Express" },
  { value: "thaipost", label: "Thailand Post" },
  { value: "ninjavan", label: "Ninja Van" },
  { value: "dhl", label: "DHL" },
  { value: "best", label: "Best Express" },
  { value: "scg", label: "SCG Express" },
];

const PLATFORMS = [
  { value: "shopee", label: "Shopee", hex: "#EE4D2D", bgLight: "bg-orange-100", textColor: "text-orange-700" },
  { value: "lazada", label: "Lazada", hex: "#0F146D", bgLight: "bg-indigo-100", textColor: "text-indigo-700" },
  { value: "tiktok", label: "TikTok Shop", hex: "#000000", bgLight: "bg-gray-100", textColor: "text-gray-900" },
  { value: "amazon", label: "Amazon", hex: "#FF9900", bgLight: "bg-amber-100", textColor: "text-amber-700" },
];

function platformBadge(platform: string) {
    const p = PLATFORMS.find(pl => pl.value === platform);
    if (!p) return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">{platform}</Badge>;
    const logo = getPlatformLogo(platform);
    return (
      <Badge className={`${p.bgLight} ${p.textColor} hover:${p.bgLight}`}>
        {logo && <img src={logo} alt={p.label} className="w-4 h-4 rounded-full object-cover" />}
        {p.label}
      </Badge>
    );
  }

function statusBadge(status: string) {
  switch (status) {
    case "pending": return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">รอดำเนินการ</Badge>;
    case "confirmed": return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">รอจัดส่ง</Badge>;
    case "shipping": return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">กำลังจัดส่ง</Badge>;
    case "shipped": return <Badge className="bg-pink-100 text-pink-700 hover:bg-pink-100 font-semibold">จัดส่ง</Badge>;
    case "delivered": return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">สำเร็จ</Badge>;
    default: return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">{status}</Badge>;
  }
}

function labelStatusBadge(status: string) {
  if (status === "printed") return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-xs">ใช่</Badge>;
  return <Badge className="bg-gray-100 text-gray-600 hover:bg-gray-100 text-xs">ไม่ใช่</Badge>;
}

function formatCurrency(v: string | number | null | undefined) {
  return Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type TabValue = "all" | "confirmed" | "shipping" | "shipped" | "no_carrier" | "near_deadline";

const STATUS_TABS: { value: TabValue; label: string; icon?: any; color?: string }[] = [
  { value: "all", label: "ทั้งหมด" },
  { value: "confirmed", label: "รอจัดส่ง", color: "#539BFF" },
  { value: "shipping", label: "กำลังจัดส่ง", color: "#fec90f" },
  { value: "shipped", label: "จัดส่งแล้ว", color: "#fb9678" },
  { value: "no_carrier", label: "รอข้อมูลขนส่ง", icon: AlertTriangle, color: "#f94d4d" },
  { value: "near_deadline", label: "ใกล้หมดเวลาจัดส่ง", icon: Clock, color: "#f94d4d" },
];

const PAGE_SIZES = [25, 50, 100, 200];

type ApiResponse = {
  orders: EcommerceOrderWithItems[];
  total: number;
  tabCounts: {
    all: number;
    confirmed: number;
    shipping: number;
    shipped: number;
    noCarrier: number;
    nearDeadline: number;
  };
};

export default function EcommerceShippingLabels() {
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const printRef = useRef<HTMLDivElement>(null);
  const { dateEra, dateFmt } = useDateSettings();

  const [statusTab, setStatusTab] = useState<TabValue>("all");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [carrierFilter, setCarrierFilter] = useState("all");
  const [labelStatusFilter, setLabelStatusFilter] = useState("all");
  const now = new Date();
  const yearStart = `${now.getFullYear()}-01-01`;
  const todayStr = toLocalDateStr(now);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showPreview, setShowPreview] = useState(false);
  const [showPickList, setShowPickList] = useState(false);
  const [showBulkShip, setShowBulkShip] = useState(false);
  const [bulkCarrier, setBulkCarrier] = useState("kerry");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [printCarrier, setPrintCarrier] = useState("kerry");
  const [skuFilter, setSkuFilter] = useState("");
  const [skuFilterInput, setSkuFilterInput] = useState("");
  const [itemCountFilter, setItemCountFilter] = useState("all");
  const [showPopularSkus, setShowPopularSkus] = useState(false);
  const [popSkuMinQty, setPopSkuMinQty] = useState("");
  const [popSkuSearch, setPopSkuSearch] = useState("");
  const [popSkuSearchInput, setPopSkuSearchInput] = useState("");
  const [popSkuMinQtyInput, setPopSkuMinQtyInput] = useState("");
  const [popSkuPage, setPopSkuPage] = useState(1);
  const popSkuPageSize = 20;

  const queryParams = useMemo(() => {
    const p = new URLSearchParams();
    p.set("companyId", String(selectedCompanyId || ""));
    p.set("page", String(currentPage));
    p.set("pageSize", String(pageSize));
    if (statusTab !== "all") p.set("status", statusTab);
    if (platformFilter !== "all") p.set("platform", platformFilter);
    if (carrierFilter !== "all") p.set("carrier", carrierFilter);
    if (labelStatusFilter !== "all") p.set("labelStatus", labelStatusFilter);
    if (searchQuery) p.set("search", searchQuery);
    if (startDate) p.set("startDate", startDate);
    if (endDate) p.set("endDate", endDate);
    if (skuFilter) p.set("product", skuFilter);
    if (itemCountFilter !== "all") p.set("itemCount", itemCountFilter);
    return p.toString();
  }, [selectedCompanyId, currentPage, pageSize, statusTab, platformFilter, carrierFilter, labelStatusFilter, searchQuery, startDate, endDate, skuFilter, itemCountFilter]);

  const { data, isLoading } = useQuery<ApiResponse>({
    queryKey: ["/api/ecommerce/shipping-labels/orders", queryParams],
    queryFn: async () => {
      const r = await fetch(`/api/ecommerce/shipping-labels/orders?${queryParams}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    enabled: !!selectedCompanyId,
    placeholderData: (prev) => prev,
  });

  const orders = data?.orders || [];
  const totalCount = data?.total || 0;
  const tabCounts = data?.tabCounts || { all: 0, confirmed: 0, shipping: 0, shipped: 0, noCarrier: 0, nearDeadline: 0 };
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const popSkuParams = useMemo(() => {
    const p = new URLSearchParams();
    p.set("companyId", String(selectedCompanyId || ""));
    p.set("page", String(popSkuPage));
    p.set("pageSize", String(popSkuPageSize));
    if (popSkuMinQty) p.set("minQty", popSkuMinQty);
    if (popSkuSearch) p.set("sku", popSkuSearch);
    return p.toString();
  }, [selectedCompanyId, popSkuPage, popSkuMinQty, popSkuSearch]);

  const { data: popSkuData, isLoading: popSkuLoading } = useQuery<{ skus: { sku: string; orderCount: number }[]; total: number }>({
    queryKey: ["/api/ecommerce/shipping-labels/popular-skus", popSkuParams],
    queryFn: async () => {
      const r = await fetch(`/api/ecommerce/shipping-labels/popular-skus?${popSkuParams}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    enabled: !!selectedCompanyId && showPopularSkus,
  });

  const generateMutation = useMutation({
    mutationFn: async (params: { orderIds: number[]; carrier: string }) => {
      const r = await fetch("/api/ecommerce/shipping-labels/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify(params),
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: (result) => {
      toast({ title: result.message });
      setShowPreview(true);
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/shipping-labels/orders"] });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const bulkShipMutation = useMutation({
    mutationFn: async (params: { orderIds: number[]; shippingProvider: string }) => {
      const r = await fetch("/api/ecommerce/orders/bulk-status", {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ orderIds: params.orderIds, status: "shipping", shippingProvider: params.shippingProvider }),
      });
      if (!r.ok) throw new Error((await r.json()).message || "Failed");
      return r.json();
    },
    onSuccess: () => {
      toast({ title: `ส่งสินค้า ${selectedIds.size} รายการ สำเร็จ` });
      setShowBulkShip(false);
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/shipping-labels/orders"] });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const selectedOrders = useMemo(() =>
    orders.filter(o => selectedIds.has(o.id)),
    [orders, selectedIds]
  );

  type BundleItem = { name: string; sku: string; qty: number; isBundle: boolean; components: { name: string; code: string; qty: number }[] };
  type BundleData = Record<number, { orderId: number; items: BundleItem[] }>;

  const { data: bundleData } = useQuery<BundleData>({
    queryKey: ["/api/ecommerce/shipping-labels/expand-bundles", Array.from(selectedIds).sort().join(",")],
    queryFn: async () => {
      const r = await fetch("/api/ecommerce/shipping-labels/expand-bundles", {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ orderIds: Array.from(selectedIds), companyId: selectedCompanyId }),
      });
      if (!r.ok) return {};
      return r.json();
    },
    enabled: selectedIds.size > 0 && !!selectedCompanyId,
  });

  const allSelected = orders.length > 0 && orders.every(o => selectedIds.has(o.id));

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(orders.map(o => o.id)));
  };

  const handleSearch = useCallback(() => {
    setSearchQuery(searchInput);
    setSkuFilter(skuFilterInput);
    setCurrentPage(1);
  }, [searchInput, skuFilterInput]);

  const handleReset = () => {
    setSearchInput(""); setSearchQuery("");
    setPlatformFilter("all"); setCarrierFilter("all"); setLabelStatusFilter("all");
    setStartDate(yearStart); setEndDate(todayStr);
    setStatusTab("all"); setCurrentPage(1); setSelectedIds(new Set());
    setSkuFilterInput(""); setSkuFilter("");
    setItemCountFilter("all");
  };

  const handlePrint = () => {
    if (selectedIds.size === 0) {
      toast({ title: "กรุณาเลือกออเดอร์ที่ต้องการพิมพ์ใบปะหน้า", variant: "destructive" });
      return;
    }
    generateMutation.mutate({ orderIds: Array.from(selectedIds), carrier: printCarrier });
  };

  const doPrint = (ref: React.RefObject<HTMLDivElement | null>) => {
    const printContent = ref.current;
    if (!printContent) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>พิมพ์</title>
      <style>
        body { font-family: 'Sarabun', sans-serif; margin: 0; padding: 0; }
        .label { page-break-after: always; border: 2px solid #000; padding: 16px; margin: 8px; width: 380px; min-height: 540px; box-sizing: border-box; }
        .label:last-child { page-break-after: auto; }
        .pick-list { padding: 20px; }
        .pick-list table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        .pick-list th, .pick-list td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; font-size: 13px; }
        .pick-list th { background: #f5f5f5; font-weight: bold; }
        @media print { body { margin: 0; } .label { border: 2px solid #000; } }
      </style></head><body>
      ${printContent.innerHTML}
      </body></html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 300);
  };

  const pickListRef = useRef<HTMLDivElement>(null);

  const pickListData = useMemo(() => {
    const skuMap = new Map<string, { sku: string; name: string; totalQty: number; orders: string[]; isComponent?: boolean; parentBundles?: Set<string> }>();
    selectedOrders.forEach(order => {
      const orderRef = order.orderNo || order.platformOrderId || String(order.id);
      const bd = bundleData?.[order.id];
      if (bd && bd.items.length > 0) {
        bd.items.forEach(item => {
          if (item.isBundle && item.components.length > 0) {
            item.components.forEach(comp => {
              const key = comp.code || comp.name;
              const existing = skuMap.get(key);
              if (existing) {
                existing.totalQty += comp.qty;
                existing.orders.push(orderRef);
                existing.parentBundles?.add(item.name);
              } else {
                skuMap.set(key, { sku: key, name: `${comp.name}`, totalQty: comp.qty, orders: [orderRef], isComponent: true, parentBundles: new Set([item.name]) });
              }
            });
          } else {
            const key = item.sku || item.name;
            const existing = skuMap.get(key);
            if (existing) {
              existing.totalQty += item.qty;
              existing.orders.push(orderRef);
            } else {
              skuMap.set(key, { sku: key, name: item.name, totalQty: item.qty, orders: [orderRef] });
            }
          }
        });
      } else {
        const itemNames = (order as any).itemNames || [];
        itemNames.forEach((name: string) => {
          const match = name.match(/^(\S+?)(?:\*(\d+))?$/);
          const sku = match?.[1] || name;
          const qty = match?.[2] ? parseInt(match[2]) : 1;
          const existing = skuMap.get(sku);
          if (existing) {
            existing.totalQty += qty;
            existing.orders.push(orderRef);
          } else {
            skuMap.set(sku, { sku, name, totalQty: qty, orders: [orderRef] });
          }
        });
      }
    });
    return Array.from(skuMap.values()).sort((a, b) => b.totalQty - a.totalQty);
  }, [selectedOrders, bundleData]);

  const getTabCount = (tab: TabValue): number => {
    switch (tab) {
      case "all": return tabCounts.all;
      case "confirmed": return tabCounts.confirmed;
      case "shipping": return tabCounts.shipping;
      case "shipped": return tabCounts.shipped;
      case "no_carrier": return tabCounts.noCarrier;
      case "near_deadline": return tabCounts.nearDeadline;
      default: return 0;
    }
  };

  const carrierLabel = CARRIERS.find(c => c.value === printCarrier)?.label || printCarrier;

  return (
    <EcommerceLayout>
      <div className="space-y-3" data-testid="page-shipping-labels">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold text-gray-800" data-testid="text-shipping-labels-title">การจัดการในรายการจัดส่ง</h1>
            <p className="text-sm text-muted-foreground mt-0.5">จัดการออเดอร์ พิมพ์ใบปะหน้า หยิบสินค้า และจัดส่ง</p>
          </div>
        </div>

        {/* Status Tabs - JST Style */}
        <div className="flex gap-0.5 border-b overflow-x-auto" data-testid="status-tabs">
          {STATUS_TABS.map(tab => {
            const cnt = getTabCount(tab.value);
            const isActive = statusTab === tab.value;
            const Icon = tab.icon;
            return (
              <button
                key={tab.value}
                onClick={() => { setStatusTab(tab.value); setCurrentPage(1); setSelectedIds(new Set()); }}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${isActive ? "border-[#03c9d7] text-[#03c9d7]" : "border-transparent text-gray-500 hover:text-gray-700"}`}
                data-testid={`tab-${tab.value}`}
              >
                {Icon && <Icon className="h-3.5 w-3.5" />}
                {tab.label}
                <span className={`text-xs ${isActive ? "text-[#03c9d7]" : "text-gray-400"}`}>({cnt.toLocaleString()})</span>
              </button>
            );
          })}
        </div>

        {/* Filters - JST ERP Style (2 rows) */}
        <Card className="rounded-xl shadow-sm border">
          <CardContent className="py-3 px-4 space-y-2.5">
            {/* Filter Row 1 */}
            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="หมายเลขออเดอร์ภายนอก"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleSearch(); }}
                className="w-[170px] h-8 text-xs"
                data-testid="input-search-order"
              />
              <Input
                placeholder="หมายเลขออเดอร์ภายใน"
                className="w-[160px] h-8 text-xs"
                disabled
                data-testid="input-internal-order"
              />
              <Input
                placeholder="หมายเลขคำสั่งซื้อออนไลน์"
                className="w-[170px] h-8 text-xs"
                disabled
                data-testid="input-online-order"
              />
              <Select value={statusTab} onValueChange={v => { setStatusTab(v as TabValue); setCurrentPage(1); setSelectedIds(new Set()); }}>
                <SelectTrigger className="w-[130px] h-8 text-xs" data-testid="select-status-inline">
                  <SelectValue placeholder="สถานะ" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_TABS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1">
                <div className="relative min-w-[170px]">
                  <Package className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="กรองรายการสินค้า / SKU"
                    value={skuFilterInput}
                    onChange={e => setSkuFilterInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleSearch(); }}
                    className="pl-8 h-8 text-xs"
                    data-testid="input-sku-filter"
                  />
                </div>
                <Button
                  size="sm" variant="ghost"
                  className="h-8 w-8 p-0 text-[#539BFF] hover:bg-blue-50"
                  onClick={() => { setShowPopularSkus(true); setPopSkuPage(1); setPopSkuMinQtyInput(""); setPopSkuMinQty(""); setPopSkuSearchInput(""); setPopSkuSearch(""); }}
                  title="ตัวกรองยอดนิยม"
                  data-testid="button-popular-skus"
                >
                  <Star className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Select value="created" onValueChange={() => {}}>
                <SelectTrigger className="w-[110px] h-8 text-xs">
                  <SelectValue placeholder="วันที่สร้าง" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created">วันที่สร้าง</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1.5">
                <ThaiDateInput value={startDate} onChange={v => { setStartDate(v); setCurrentPage(1); }} dateEra={dateEra} dateFmt={dateFmt} className="w-[130px]" data-testid="input-start-date" />
                <span className="text-xs text-muted-foreground">-</span>
                <ThaiDateInput value={endDate} onChange={v => { setEndDate(v); setCurrentPage(1); }} dateEra={dateEra} dateFmt={dateFmt} className="w-[130px]" data-testid="input-end-date" />
              </div>
            </div>
            {/* Filter Row 2 */}
            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="หมายเลขพัสดุ"
                className="w-[150px] h-8 text-xs"
                disabled
                data-testid="input-tracking-no"
              />
              <Select value={carrierFilter} onValueChange={v => { setCarrierFilter(v); setCurrentPage(1); }}>
                <SelectTrigger className="w-[140px] h-8 text-xs" data-testid="select-carrier-filter">
                  <SelectValue placeholder="บริษัทขนส่ง" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกขนส่ง</SelectItem>
                  {CARRIERS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={platformFilter} onValueChange={v => { setPlatformFilter(v); setCurrentPage(1); }}>
                <SelectTrigger className="w-[130px] h-8 text-xs" data-testid="select-platform-filter">
                  <SelectValue placeholder="สถานะขนส่ง" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกแพลตฟอร์ม</SelectItem>
                  {PLATFORMS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={labelStatusFilter} onValueChange={v => { setLabelStatusFilter(v); setCurrentPage(1); }}>
                <SelectTrigger className="w-[160px] h-8 text-xs" data-testid="trigger-label-status-filter">
                  <SelectValue placeholder="สถานะพิมพ์ใบปะหน้า" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกสถานะพิมพ์</SelectItem>
                  <SelectItem value="not_printed">ยังไม่พิมพ์</SelectItem>
                  <SelectItem value="printed">พิมพ์แล้ว</SelectItem>
                </SelectContent>
              </Select>
              <Select value={itemCountFilter} onValueChange={v => { setItemCountFilter(v); setCurrentPage(1); }}>
                <SelectTrigger className="w-[140px] h-8 text-xs" data-testid="select-item-count-filter">
                  <SelectValue placeholder="ตัวเลขจำนวน" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกจำนวนชิ้น</SelectItem>
                  <SelectItem value="1">1 ชิ้น</SelectItem>
                  <SelectItem value="2">2 ชิ้น</SelectItem>
                  <SelectItem value="3">3 ชิ้น</SelectItem>
                  <SelectItem value="4">4 ชิ้น</SelectItem>
                  <SelectItem value="5">5 ชิ้น</SelectItem>
                  <SelectItem value="6">6+ ชิ้น</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" className="h-8 bg-[#539BFF] hover:bg-[#4488ee] text-white text-xs gap-1 px-4" onClick={handleSearch} data-testid="button-search">
                ค้นหา
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1 px-4" onClick={handleReset} data-testid="button-reset">
                รีเซ็ต
              </Button>
              <Button
                size="sm" variant="outline"
                className="h-8 text-xs gap-1 border-amber-300 text-amber-700 hover:bg-amber-50"
                onClick={() => { setLabelStatusFilter("not_printed"); setCurrentPage(1); }}
                data-testid="button-find-unprinted"
              >
                ค้นหารายการที่ยังไม่ถูกพิมพ์
              </Button>
              <Button
                size="sm" variant="outline"
                className="h-8 text-xs gap-1 border-gray-300 text-gray-600 hover:bg-gray-50"
                onClick={() => toast({ title: "บันทึกเงื่อนไขสำเร็จ" })}
                data-testid="button-save-filter"
              >
                บันทึกเงื่อนไขการค้นหา
              </Button>
            </div>
            {/* เพิ่มเติม dropdown */}
            <div className="flex items-center">
              <button className="text-xs text-[#539BFF] hover:underline flex items-center gap-1" onClick={() => {}} data-testid="button-more-filters">
                เพิ่มเติม <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Action Toolbar - JST Style */}
        <Card className="rounded-xl shadow-sm border bg-[#f0f9ff]">
          <CardContent className="py-2 px-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm" variant="outline"
                className="h-7 text-xs gap-1 bg-white border-blue-300 text-blue-700 hover:bg-blue-50"
                onClick={() => { if (selectedIds.size > 0) { handlePrint(); } else toast({ title: "กรุณาเลือกออเดอร์ก่อน", variant: "destructive" }); }}
                disabled={generateMutation.isPending}
                data-testid="button-preview-label"
              >
                {generateMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Eye className="h-3 w-3" />}
                ตัวอย่างก่อนพิมพ์ใบปะหน้า
              </Button>
              <Button
                size="sm" variant="outline"
                className="h-7 text-xs gap-1 bg-white border-purple-300 text-purple-700 hover:bg-purple-50"
                onClick={() => { if (selectedIds.size > 0) setShowPickList(true); else toast({ title: "กรุณาเลือกออเดอร์ก่อน", variant: "destructive" }); }}
                data-testid="button-print-pick-list"
              >
                <ClipboardList className="h-3 w-3" />พิมพ์รายการหยิบสินค้า
              </Button>
              <Button
                size="sm" variant="outline"
                className="h-7 text-xs gap-1 bg-white border-[#fb9678] text-[#fb9678] hover:bg-orange-50"
                onClick={() => { if (selectedIds.size > 0) { handlePrint(); } else toast({ title: "กรุณาเลือกออเดอร์ก่อน", variant: "destructive" }); }}
                disabled={generateMutation.isPending}
                data-testid="button-print-labels"
              >
                <Printer className="h-3 w-3" />พิมพ์ใบปะหน้า
              </Button>
              <Button
                size="sm" variant="outline"
                className="h-7 text-xs gap-1 bg-white border-teal-300 text-teal-700 hover:bg-teal-50"
                onClick={() => toast({ title: "พิมพ์ใบรายการจัดส่ง (เร็วๆ นี้)" })}
                data-testid="button-print-delivery-list"
              >
                <FileText className="h-3 w-3" />พิมพ์ใบรายการจัดส่ง
              </Button>
              <Button
                size="sm" variant="outline"
                className="h-7 text-xs gap-1 bg-white border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                onClick={() => toast({ title: "ส่งข้อมูลขนส่งจากแพลตฟอร์ม (เร็วๆ นี้)" })}
                data-testid="button-sync-platform-shipping"
              >
                <RefreshCw className="h-3 w-3" />ส่งข้อมูลขนส่งจากแพลตฟอร์ม
              </Button>
              <Button
                size="sm" variant="outline"
                className="h-7 text-xs gap-1 bg-white border-green-300 text-green-700 hover:bg-green-50"
                onClick={() => { if (selectedIds.size > 0) { toast({ title: "พิมพ์ใบแจ้งหนี้ยังไม่พร้อมใช้งาน" }); } else toast({ title: "กรุณาเลือกออเดอร์ก่อน", variant: "destructive" }); }}
                data-testid="button-print-invoice"
              >
                <FileText className="h-3 w-3" />พิมพ์ใบแจ้งหนี้/ใบกำกับภาษี
              </Button>
              <Button
                size="sm" variant="outline"
                className="h-7 text-xs gap-1 bg-white border-gray-400 text-gray-700 hover:bg-gray-50"
                onClick={() => toast({ title: "เปลี่ยนเป็นคำสั่งดังปกติ (เร็วๆ นี้)" })}
                data-testid="button-convert-normal"
              >
                <Package className="h-3 w-3" />เปลี่ยนเป็นคำสั่งดังปกติ
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs gap-1 bg-[#03c9d7] hover:bg-[#02b5c2] text-white"
                onClick={() => { if (selectedIds.size > 0) setShowBulkShip(true); else toast({ title: "กรุณาเลือกออเดอร์ก่อน", variant: "destructive" }); }}
                data-testid="button-bulk-ship"
              >
                <Send className="h-3 w-3" />ส่งสินค้า
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Selection Info Bar */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 p-2.5 rounded-xl border" style={{ background: "#e5f9fa", borderColor: "#03c9d7" }} data-testid="batch-action-bar">
            <span className="text-sm font-medium" style={{ color: "#03c9d7" }}>เลือก {selectedIds.size} รายการ</span>
            <Button size="sm" variant="ghost" className="text-xs gap-1 h-7" onClick={() => { setSelectedIds(new Set()); setShowPreview(false); }} data-testid="button-clear-selection">
              <X className="h-3.5 w-3.5" />ยกเลิกทั้งหมด
            </Button>
          </div>
        )}

        {/* Main Table */}
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : orders.length === 0 ? (
          <Card className="rounded-xl shadow-sm border">
            <CardContent className="py-12 text-center text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-sm" data-testid="text-empty-state">ไม่พบออเดอร์</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-xl shadow-sm border overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table className="min-w-[1400px]" data-testid="table-shipping-labels">
                  <TableHeader>
                    <TableRow className="text-xs bg-gray-50">
                      <TableHead className="w-10 px-2 sticky left-0 bg-gray-50 z-10">
                        <Checkbox checked={allSelected} onCheckedChange={toggleAll} data-testid="checkbox-select-all" />
                      </TableHead>
                      <TableHead className="text-xs font-semibold w-10 text-center">#</TableHead>
                      <TableHead className="text-xs font-semibold sticky left-10 bg-gray-50 z-10 min-w-[180px]">หมายเลขคำสั่งซื้อออนไลน์</TableHead>
                      <TableHead className="text-xs font-semibold min-w-[80px]">สถานะ</TableHead>
                      <TableHead className="text-xs font-semibold text-right min-w-[90px]">ยอดที่ชำระแล้ว</TableHead>
                      <TableHead className="text-xs font-semibold text-center min-w-[80px]">พิมพ์ใบปะหน้า</TableHead>
                      <TableHead className="text-xs font-semibold text-center min-w-[70px]">จำนวนการพิมพ์</TableHead>
                      <TableHead className="text-xs font-semibold text-center min-w-[70px]">จำนวนสินค้า</TableHead>
                      <TableHead className="text-xs font-semibold min-w-[250px]">ข้อมูลสินค้า</TableHead>
                      <TableHead className="text-xs font-semibold min-w-[120px]">บริษัทขนส่ง</TableHead>
                      <TableHead className="text-xs font-semibold min-w-[100px]">ผู้รับ</TableHead>
                      <TableHead className="text-xs font-semibold min-w-[100px]">เลข tracking</TableHead>
                      <TableHead className="text-xs font-semibold text-center min-w-[50px]">COD</TableHead>
                      <TableHead className="text-xs font-semibold min-w-[80px]">วันที่สั่ง</TableHead>
                      <TableHead className="text-xs font-semibold min-w-[80px]">กำหนดส่ง</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order, idx) => {
                      const isSelected = selectedIds.has(order.id);
                      const itemNames = (order as any).itemNames || [];
                      const itemCount = (order as any).itemCount || 0;
                      const productInfo = itemNames.length > 0 ? `${itemCount}.${itemNames.join(",")}` : "-";
                      const rowNum = (currentPage - 1) * pageSize + idx + 1;
                      const isNearDeadline = order.shipByDate && new Date(order.shipByDate).getTime() <= Date.now() + 24 * 3600 * 1000 && order.status === "confirmed";
                      return (
                        <TableRow
                          key={order.id}
                          className={`text-xs ${isSelected ? "bg-cyan-50/50" : ""} ${isNearDeadline ? "bg-red-50/40" : ""}`}
                          data-testid={`row-order-${order.id}`}
                        >
                          <TableCell className="px-2 sticky left-0 bg-white z-10">
                            <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(order.id)} data-testid={`checkbox-order-${order.id}`} />
                          </TableCell>
                          <TableCell className="text-center text-xs text-muted-foreground">{rowNum}</TableCell>
                          <TableCell className="font-mono text-xs sticky left-10 bg-white z-10" data-testid={`text-order-no-${order.id}`}>
                            <div className="flex items-center gap-1.5">
                              {platformBadge(order.platform)}
                              <span>{order.platformOrderId || order.orderNo}</span>
                            </div>
                          </TableCell>
                          <TableCell data-testid={`text-status-${order.id}`}>{statusBadge(order.status)}</TableCell>
                          <TableCell className="text-right text-xs font-medium" data-testid={`text-amount-${order.id}`}>
                            {formatCurrency(order.totalAmount)}
                          </TableCell>
                          <TableCell className="text-center" data-testid={`text-label-status-${order.id}`}>
                            {labelStatusBadge(order.labelStatus)}
                          </TableCell>
                          <TableCell className="text-center text-xs" data-testid={`text-print-count-${order.id}`}>
                            {order.labelPrintCount || 0}
                          </TableCell>
                          <TableCell className="text-center" data-testid={`text-item-count-${order.id}`}>
                            <span className={`inline-flex items-center justify-center min-w-[24px] h-5 px-1.5 rounded text-xs font-medium ${itemCount > 1 ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-600"}`}>
                              {itemCount}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs" data-testid={`text-items-${order.id}`}>
                            <span className="block max-w-[250px] truncate" title={itemNames.join(", ")}>{productInfo}</span>
                          </TableCell>
                          <TableCell className="text-xs" data-testid={`text-carrier-${order.id}`}>
                            {order.platformShippingProvider || order.shippingProvider || "-"}
                          </TableCell>
                          <TableCell className="text-xs font-medium" data-testid={`text-buyer-${order.id}`}>
                            {order.buyerName || "-"}
                          </TableCell>
                          <TableCell className="font-mono text-xs" data-testid={`text-tracking-${order.id}`}>
                            {order.trackingNo || "-"}
                          </TableCell>
                          <TableCell className="text-center" data-testid={`text-cod-${order.id}`}>
                            {order.isCod ? <Badge className="bg-red-100 text-red-700 hover:bg-red-100 text-[10px]">COD</Badge> : <span className="text-gray-400">-</span>}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground" data-testid={`text-placed-at-${order.id}`}>
                            {formatDate(order.placedAt as any, dateEra, dateFmt)}
                          </TableCell>
                          <TableCell className="text-xs" data-testid={`text-ship-by-${order.id}`}>
                            {order.shipByDate ? (
                              <span className={isNearDeadline ? "text-red-600 font-semibold" : "text-muted-foreground"}>
                                {formatDate(order.shipByDate as any, dateEra, dateFmt)}
                              </span>
                            ) : "-"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pagination - JST Style */}
        {!isLoading && totalCount > 0 && (
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <span data-testid="text-pagination-info">
              เลือกแล้ว {selectedIds.size} รายการ | ทั้งหมด {totalCount.toLocaleString()}
            </span>
            <div className="flex items-center gap-3">
              <Select value={String(pageSize)} onValueChange={v => { setPageSize(Number(v)); setCurrentPage(1); }}>
                <SelectTrigger className="w-[85px] h-7 text-xs" data-testid="select-page-size">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZES.map(s => <SelectItem key={s} value={String(s)}>{s}/หน้า</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)} data-testid="button-prev-page">
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let page: number;
                  if (totalPages <= 5) page = i + 1;
                  else if (currentPage <= 3) page = i + 1;
                  else if (currentPage >= totalPages - 2) page = totalPages - 4 + i;
                  else page = currentPage - 2 + i;
                  return (
                    <Button
                      key={page} variant={currentPage === page ? "default" : "outline"} size="sm"
                      className={`h-7 w-7 p-0 text-xs ${currentPage === page ? "bg-[#03c9d7] hover:bg-[#02b4c1] text-white" : ""}`}
                      onClick={() => setCurrentPage(page)} data-testid={`button-page-${page}`}
                    >{page}</Button>
                  );
                })}
                {totalPages > 5 && currentPage < totalPages - 2 && <span className="px-1">...</span>}
                {totalPages > 5 && currentPage < totalPages - 2 && (
                  <Button variant="outline" size="sm" className="h-7 w-7 p-0 text-xs" onClick={() => setCurrentPage(totalPages)} data-testid="button-last-page">{totalPages}</Button>
                )}
                <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)} data-testid="button-next-page">
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs">ไปที่</span>
                <Input
                  type="number" min={1} max={totalPages}
                  className="w-[50px] h-7 text-xs text-center"
                  onKeyDown={e => { if (e.key === "Enter") { const v = parseInt((e.target as HTMLInputElement).value); if (v >= 1 && v <= totalPages) setCurrentPage(v); } }}
                  data-testid="input-goto-page"
                />
              </div>
            </div>
          </div>
        )}

        {/* Print Preview - Labels */}
        {showPreview && selectedOrders.length > 0 && (
          <Card className="rounded-xl shadow-sm border overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-800" data-testid="text-preview-title">ตัวอย่างใบปะหน้าพัสดุ ({selectedOrders.length} ใบ)</h2>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => doPrint(printRef)} className="bg-[#fb9678] hover:bg-[#e8856a] text-white" data-testid="button-do-print">
                    <Printer className="h-4 w-4 mr-1" />พิมพ์
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowPreview(false)} data-testid="button-close-preview">ปิด</Button>
                </div>
              </div>
              <div ref={printRef} className="flex flex-wrap gap-4 justify-center" data-testid="print-preview-area">
                {selectedOrders.map(order => {
                  const p = PLATFORMS.find(pl => pl.value === order.platform);
                  const trackingDisplay = order.trackingNo || "PENDING";
                  const codAmount = order.isCod ? Number(order.codAmount || order.totalAmount || 0) : 0;
                  const itemNames = (order as any).itemNames || [];
                  const itemCount = (order as any).itemCount || 0;
                  return (
                    <div key={order.id} className="label border-2 border-black p-4 w-[400px] bg-white" data-testid={`label-${order.id}`}>
                      <div className="text-center text-xl font-bold border-b-2 border-black pb-2 mb-3">
                        {order.platformShippingProvider || order.shippingProvider || carrierLabel}
                      </div>
                      <div className="mb-3">
                        <div className="text-[11px] font-bold text-gray-500 mb-1">ผู้ส่ง / SENDER</div>
                        <div className="text-sm font-bold">{selectedCompany?.name || "บริษัท"}</div>
                        <div className="text-xs text-gray-600">{selectedCompany?.address || ""}</div>
                      </div>
                      <div className="mb-3 p-2 bg-gray-50 border border-gray-200 rounded">
                        <div className="text-[11px] font-bold text-gray-500 mb-1">ผู้รับ / RECIPIENT</div>
                        <div className="text-base font-bold">{order.buyerName || "-"}</div>
                        <div className="text-xs leading-relaxed">{order.buyerAddress || "-"}</div>
                        <div className="text-xs font-medium mt-1">โทร: {order.buyerPhone || "-"}</div>
                      </div>
                      <div className="text-center py-2">
                        <div className="font-mono text-3xl tracking-[6px]">|||||||||||||||</div>
                        <div className="text-sm font-bold mt-1">{trackingDisplay}</div>
                      </div>

                      {/* SKU/Item detail for picking - with bundle expansion */}
                      {(() => {
                        const bd = bundleData?.[order.id];
                        if (bd && bd.items.length > 0) {
                          const totalPick = bd.items.reduce((s, item) => {
                            if (item.isBundle && item.components.length > 0) {
                              return s + item.components.reduce((cs, c) => cs + c.qty, 0);
                            }
                            return s + item.qty;
                          }, 0);
                          return (
                            <div className="border-t border-dashed border-gray-400 pt-2 mb-2">
                              <div className="text-[11px] font-bold text-gray-600 mb-1">รายการหยิบสินค้า ({totalPick} ชิ้น):</div>
                              {bd.items.map((item, i) => (
                                <div key={i}>
                                  {item.isBundle && item.components.length > 0 ? (
                                    <div className="mb-1">
                                      <div className="text-[11px] font-bold text-blue-700 flex justify-between">
                                        <span>📦 {item.name} {item.sku ? `(${item.sku})` : ""} ×{item.qty}</span>
                                      </div>
                                      {item.components.map((comp, ci) => (
                                        <div key={ci} className="text-[10px] pl-3 flex justify-between text-gray-700">
                                          <span>↳ {comp.name} {comp.code ? `[${comp.code}]` : ""}</span>
                                          <span className="font-bold">×{comp.qty}</span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="text-[11px] flex justify-between">
                                      <span>{item.name} {item.sku ? `(${item.sku})` : ""}</span>
                                      <span className="font-medium">×{item.qty}</span>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          );
                        }
                        if (itemNames.length > 0) {
                          return (
                            <div className="border-t border-dashed border-gray-400 pt-2 mb-2">
                              <div className="text-[11px] font-bold text-gray-600 mb-1">รายการสินค้า ({itemCount} ชิ้น):</div>
                              {itemNames.map((name: string, ni: number) => (
                                <div key={ni} className="text-[11px] flex justify-between">
                                  <span>{name}</span>
                                </div>
                              ))}
                            </div>
                          );
                        }
                        return null;
                      })()}

                      <div className="flex justify-between text-[11px] border-t border-dashed border-gray-400 pt-2 mt-1">
                        <div>
                          <span className="text-gray-500">Order: </span>
                          <span className="font-medium">{order.orderNo || order.platformOrderId}</span>
                        </div>
                        <div className="px-2 py-0.5 rounded text-white text-[10px] font-bold" style={{ backgroundColor: p?.hex || "#666" }}>
                          {p?.label || order.platform}
                        </div>
                      </div>
                      {codAmount > 0 && (
                        <div className="text-[12px] font-bold text-red-600 mt-1 text-center border border-red-300 rounded py-1">
                          COD: ฿{codAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pick List Dialog */}
        <Dialog open={showPickList} onOpenChange={setShowPickList}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle data-testid="text-pick-list-title">
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-purple-600" />
                  ใบหยิบสินค้า (Pick List)
                </div>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  จัดกลุ่มตาม SKU/สินค้า จาก {selectedOrders.length} ออเดอร์ | {pickListData.length} รายการสินค้า
                </p>
                <Button size="sm" onClick={() => doPrint(pickListRef)} className="bg-purple-600 hover:bg-purple-700 text-white gap-1" data-testid="button-print-pick">
                  <Printer className="h-3.5 w-3.5" />พิมพ์ใบหยิบ
                </Button>
              </div>
              <div ref={pickListRef} className="pick-list">
                <div style={{ textAlign: "center", marginBottom: "12px" }}>
                  <div style={{ fontSize: "18px", fontWeight: "bold" }}>ใบหยิบสินค้า (Pick List)</div>
                  <div style={{ fontSize: "12px", color: "#666" }}>
                    วันที่: {formatDate(new Date().toISOString(), dateEra, dateFmt)} | จำนวน {selectedOrders.length} ออเดอร์ | {pickListData.reduce((s, d) => s + d.totalQty, 0)} ชิ้น
                  </div>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ border: "1px solid #ccc", padding: "6px 8px", background: "#f5f5f5", width: "40px" }}>#</th>
                      <th style={{ border: "1px solid #ccc", padding: "6px 8px", background: "#f5f5f5" }}>สินค้า/SKU</th>
                      <th style={{ border: "1px solid #ccc", padding: "6px 8px", background: "#f5f5f5", width: "80px", textAlign: "center" }}>จำนวนรวม</th>
                      <th style={{ border: "1px solid #ccc", padding: "6px 8px", background: "#f5f5f5", width: "80px", textAlign: "center" }}>หยิบแล้ว</th>
                      <th style={{ border: "1px solid #ccc", padding: "6px 8px", background: "#f5f5f5" }}>ออเดอร์</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pickListData.map((item, i) => (
                      <tr key={i}>
                        <td style={{ border: "1px solid #ccc", padding: "6px 8px", textAlign: "center" }}>{i + 1}</td>
                        <td style={{ border: "1px solid #ccc", padding: "6px 8px", fontWeight: "bold" }}>
                          {item.name}
                          {item.isComponent && item.parentBundles && item.parentBundles.size > 0 && (
                            <div style={{ fontSize: "10px", color: "#2563eb", fontWeight: "normal" }}>📦 จากชุด: {Array.from(item.parentBundles).join(", ")}</div>
                          )}
                        </td>
                        <td style={{ border: "1px solid #ccc", padding: "6px 8px", textAlign: "center", fontSize: "16px", fontWeight: "bold" }}>{item.totalQty}</td>
                        <td style={{ border: "1px solid #ccc", padding: "6px 8px", textAlign: "center" }}>☐</td>
                        <td style={{ border: "1px solid #ccc", padding: "6px 8px", fontSize: "11px", color: "#666" }}>
                          {item.orders.slice(0, 5).join(", ")}{item.orders.length > 5 ? ` +${item.orders.length - 5}` : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Bulk Ship Dialog */}
        <Dialog open={showBulkShip} onOpenChange={setShowBulkShip}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle data-testid="text-bulk-ship-title">
                <div className="flex items-center gap-2">
                  <Truck className="h-5 w-5 text-cyan-600" />
                  ส่งสินค้า ({selectedIds.size} รายการ)
                </div>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">บริษัทขนส่ง</label>
                <Select value={bulkCarrier} onValueChange={setBulkCarrier}>
                  <SelectTrigger className="mt-1" data-testid="select-bulk-carrier">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CARRIERS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                จะเปลี่ยนสถานะ {selectedIds.size} ออเดอร์เป็น "กำลังจัดส่ง"
              </p>
              <Button
                className="w-full bg-[#03c9d7] hover:bg-[#02b4c1] text-white"
                disabled={bulkShipMutation.isPending}
                onClick={() => {
                  const carrierName = CARRIERS.find(c => c.value === bulkCarrier)?.label || bulkCarrier;
                  bulkShipMutation.mutate({ orderIds: Array.from(selectedIds), shippingProvider: carrierName });
                }}
                data-testid="button-confirm-bulk-ship"
              >
                {bulkShipMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                ยืนยันส่งสินค้า
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* ตัวกรองยอดนิยม - Popular SKU Filter Dialog */}
        <Dialog open={showPopularSkus} onOpenChange={setShowPopularSkus}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle data-testid="text-popular-skus-title">ตัวกรองยอดนิยม</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 flex-1 overflow-hidden flex flex-col">
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  placeholder="จำนวนการสั่งข้อมูลสุด"
                  value={popSkuMinQtyInput}
                  onChange={e => setPopSkuMinQtyInput(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={e => { if (e.key === "Enter") { setPopSkuMinQty(popSkuMinQtyInput); setPopSkuSearch(popSkuSearchInput); setPopSkuPage(1); } }}
                  className="w-[180px] h-8 text-xs"
                  data-testid="input-pop-min-qty"
                />
                <Input
                  placeholder="รหัสสินค้า"
                  value={popSkuSearchInput}
                  onChange={e => setPopSkuSearchInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { setPopSkuMinQty(popSkuMinQtyInput); setPopSkuSearch(popSkuSearchInput); setPopSkuPage(1); } }}
                  className="w-[160px] h-8 text-xs"
                  data-testid="input-pop-sku-search"
                />
                <Button
                  size="sm" className="h-8 bg-[#539BFF] hover:bg-[#4488ee] text-white text-xs px-4"
                  onClick={() => { setPopSkuMinQty(popSkuMinQtyInput); setPopSkuSearch(popSkuSearchInput); setPopSkuPage(1); }}
                  data-testid="button-pop-search"
                >
                  ค้นหา
                </Button>
                <Button
                  size="sm" variant="outline" className="h-8 text-xs px-4"
                  onClick={() => { setPopSkuMinQtyInput(""); setPopSkuSearchInput(""); setPopSkuMinQty(""); setPopSkuSearch(""); setPopSkuPage(1); }}
                  data-testid="button-pop-reset"
                >
                  ใช้ซ้ำ
                </Button>
              </div>

              <div className="flex-1 overflow-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="w-12 text-center text-xs font-semibold">ลำดับ</TableHead>
                      <TableHead className="text-xs font-semibold">รหัสสินค้า</TableHead>
                      <TableHead className="w-24 text-center text-xs font-semibold">คำสั่งซื้อ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {popSkuLoading ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-8">
                          <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                        </TableCell>
                      </TableRow>
                    ) : !popSkuData?.skus?.length ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-8 text-sm text-muted-foreground">ไม่พบข้อมูล</TableCell>
                      </TableRow>
                    ) : (
                      popSkuData.skus.map((item, idx) => (
                        <TableRow
                          key={item.sku}
                          className="hover:bg-blue-50 cursor-pointer"
                          onClick={() => {
                            setSkuFilterInput(item.sku);
                            setSkuFilter(item.sku);
                            setShowPopularSkus(false);
                            setCurrentPage(1);
                          }}
                          data-testid={`row-pop-sku-${idx}`}
                        >
                          <TableCell className="text-center text-xs text-muted-foreground">{(popSkuPage - 1) * popSkuPageSize + idx + 1}</TableCell>
                          <TableCell className="text-xs font-medium">{item.sku}</TableCell>
                          <TableCell className="text-center text-xs">{item.orderCount.toLocaleString()}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                <span>เลือกแล้ว 0 รายการ &nbsp; ทั้งหมด {popSkuData?.total?.toLocaleString() || 0}</span>
                <div className="flex items-center gap-1">
                  <span>{popSkuPageSize} รายการ/หน้า</span>
                  <span className="mx-2">หน้าที่ {popSkuPage}</span>
                  <Button
                    size="sm" variant="outline" className="h-6 w-6 p-0"
                    disabled={popSkuPage <= 1}
                    onClick={() => setPopSkuPage(p => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-3 w-3" />
                  </Button>
                  {(() => {
                    const tp = Math.max(1, Math.ceil((popSkuData?.total || 0) / popSkuPageSize));
                    const pages: number[] = [];
                    for (let i = Math.max(1, popSkuPage - 2); i <= Math.min(tp, popSkuPage + 2); i++) pages.push(i);
                    return pages.map(pg => (
                      <Button
                        key={pg} size="sm" variant={pg === popSkuPage ? "default" : "outline"}
                        className={`h-6 w-6 p-0 text-xs ${pg === popSkuPage ? "bg-[#539BFF] text-white" : ""}`}
                        onClick={() => setPopSkuPage(pg)}
                      >
                        {pg}
                      </Button>
                    ));
                  })()}
                  <Button
                    size="sm" variant="outline" className="h-6 w-6 p-0"
                    disabled={popSkuPage >= Math.ceil((popSkuData?.total || 0) / popSkuPageSize)}
                    onClick={() => setPopSkuPage(p => p + 1)}
                  >
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                  <span className="ml-1">ไปที่</span>
                  <Input
                    className="w-12 h-6 text-xs text-center"
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        const v = Math.max(1, Math.min(Math.ceil((popSkuData?.total || 0) / popSkuPageSize), Number((e.target as HTMLInputElement).value) || 1));
                        setPopSkuPage(v);
                      }
                    }}
                    data-testid="input-pop-goto-page"
                  />
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </EcommerceLayout>
  );
}
