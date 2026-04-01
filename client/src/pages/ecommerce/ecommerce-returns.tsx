import EcommerceLayout from "@/components/ecommerce-layout";
import { getPlatformLogo } from "@/lib/platform-logos";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RefreshCw, Package, Clock, DollarSign, Loader2, Plus, Check, X, Ban, FileDown, Truck, Warehouse, PackageCheck, Eye, ChevronDown, ChevronUp, BarChart3 } from "lucide-react";
import * as XLSX from "xlsx";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { formatDate } from "@/lib/format";
import { useState, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";

import { useDateSettings } from "@/hooks/use-date-settings";
const PLATFORMS = [
  { value: "shopee", label: "Shopee", bgLight: "bg-orange-100", textColor: "text-orange-700" },
  { value: "lazada", label: "Lazada", bgLight: "bg-indigo-100", textColor: "text-indigo-700" },
  { value: "tiktok", label: "TikTok Shop", bgLight: "bg-gray-100", textColor: "text-gray-900" },
  { value: "amazon", label: "Amazon", bgLight: "bg-amber-100", textColor: "text-amber-700" },
  { value: "live", label: "Live Selling", bgLight: "bg-pink-100", textColor: "text-pink-700" },
];

const RETURN_REASONS = [
  { value: "สินค้าชำรุด", label: "สินค้าชำรุด" },
  { value: "สินค้าไม่ตรงตามสั่ง", label: "สินค้าไม่ตรงตามสั่ง" },
  { value: "เปลี่ยนใจ", label: "เปลี่ยนใจ" },
  { value: "สินค้าหมดอายุ", label: "สินค้าหมดอายุ" },
  { value: "สินค้ามีตำหนิ", label: "สินค้ามีตำหนิ" },
  { value: "อื่นๆ", label: "อื่นๆ" },
];

const REFUND_STATUSES: Record<string, { label: string; className: string }> = {
  requested: { label: "ร้องขอคืน", className: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100" },
  approved: { label: "อนุมัติแล้ว", className: "bg-blue-100 text-blue-800 hover:bg-blue-100" },
  completed: { label: "คืนเงินแล้ว", className: "bg-green-100 text-green-800 hover:bg-green-100" },
  rejected: { label: "ปฏิเสธ", className: "bg-red-100 text-red-800 hover:bg-red-100" },
};

const RETURN_STATUS_MAP: Record<string, { label: string; className: string; icon: any }> = {
  pending: { label: "รอส่งคืน", className: "bg-amber-100 text-amber-800 hover:bg-amber-100", icon: Clock },
  in_transit: { label: "กำลังส่งกลับ", className: "bg-blue-100 text-blue-800 hover:bg-blue-100", icon: Truck },
  received: { label: "รับแล้ว", className: "bg-green-100 text-green-800 hover:bg-green-100", icon: PackageCheck },
};

const DISPOSITIONS: Record<string, { label: string; color: string }> = {
  restock: { label: "คืนสต็อก", color: "text-green-700" },
  repair: { label: "ส่งซ่อม", color: "text-blue-700" },
  writeoff: { label: "ตัดจำหน่าย", color: "text-red-700" },
};

const SHIPPERS = ["Kerry Express", "Flash Express", "J&T Express", "Thailand Post", "DHL", "Ninja Van", "Best Express", "อื่นๆ"];

function platformBadge(platform: string) {
    const p = PLATFORMS.find(pl => pl.value === platform);
    if (!p) return <Badge data-testid={`badge-platform-${platform}`} className="bg-gray-100 text-gray-700 hover:bg-gray-100">{platform}</Badge>;
    const logo = getPlatformLogo(platform);
    return (
      <Badge data-testid={`badge-platform-${platform}`} className={`${p.bgLight} ${p.textColor} hover:${p.bgLight}`}>
        {logo && <img src={logo} alt={p.label} className="w-4 h-4 rounded-full object-cover" />}
        {p.label}
      </Badge>
    );
  }

function refundStatusBadge(status: string) {
  const s = REFUND_STATUSES[status];
  if (!s) return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">{status}</Badge>;
  return <Badge data-testid={`badge-refund-status-${status}`} className={s.className}>{s.label}</Badge>;
}

function returnStatusBadge(returnStatus: string) {
  const s = RETURN_STATUS_MAP[returnStatus];
  if (!s) return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">{returnStatus}</Badge>;
  const Icon = s.icon;
  return <Badge data-testid={`badge-return-status-${returnStatus}`} className={s.className}><Icon className="h-3 w-3 mr-1" />{s.label}</Badge>;
}

function formatCurrency(v: string | number | null | undefined) {
  return Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type ReturnRow = {
  id: number;
  returnNo: string;
  orderId: number;
  platform: string;
  buyerName: string | null;
  reason: string;
  reasonDetail: string | null;
  refundAmount: string | number;
  status: string;
  returnStatus: string;
  returnTrackingNo: string | null;
  returnShipper: string | null;
  receivingWarehouseId: number | null;
  shippedAt: string | null;
  receivedAt: string | null;
  notes: string | null;
  notesInternal: string | null;
  createdAt: string;
  items?: ReturnItemRow[];
};

type ReturnItemRow = {
  id: number;
  productName: string;
  sku: string | null;
  productId: number | null;
  qty: string | number;
  receivedQty: string | number;
  refundAmount: string | number;
  condition: string | null;
  receivedCondition: string | null;
  disposition: string | null;
  warehouseId: number | null;
  stockUpdated: boolean;
};

type WarehouseOption = {
  id: number;
  code: string;
  name: string;
};

export default function EcommerceReturns() {
  const { selectedCompanyId } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

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
  const [statusFilter, setStatusFilter] = useState("all");
  const [returnStatusFilter, setReturnStatusFilter] = useState("all");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [shipDialogOpen, setShipDialogOpen] = useState(false);
  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState<ReturnRow | null>(null);
  const [shipForm, setShipForm] = useState({ trackingNo: "", shipper: "" });
  const [receiveWarehouseId, setReceiveWarehouseId] = useState("");
  const [receiveNotes, setReceiveNotes] = useState("");
  const [receiveItems, setReceiveItems] = useState<{ itemId: number; receivedQty: number; receivedCondition: string; disposition: string; itemWarehouseId?: number }[]>([]);
  const [newReturn, setNewReturn] = useState({ orderId: "", reason: "", reasonDetail: "", refundAmount: "", items: "" });

  const { data: returns = [], isLoading } = useQuery<ReturnRow[]>({
    queryKey: ["/api/ecommerce/returns", selectedCompanyId, statusFilter, platformFilter],
    queryFn: async () => {
      let url = `/api/ecommerce/returns?companyId=${selectedCompanyId}`;
      if (statusFilter !== "all") url += `&status=${statusFilter}`;
      if (platformFilter !== "all") url += `&platform=${platformFilter}`;
      const r = await fetch(url, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const { data: warehouses = [] } = useQuery<WarehouseOption[]>({
    queryKey: ["/api/warehouses", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/warehouses?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const { data: returnDetail } = useQuery<ReturnRow>({
    queryKey: ["/api/ecommerce/returns", expandedRow],
    queryFn: async () => {
      const r = await fetch(`/api/ecommerce/returns/${expandedRow}`, { credentials: "include" });
      if (!r.ok) return null;
      return r.json();
    },
    enabled: !!expandedRow,
  });

  const { data: orders = [] } = useQuery<any[]>({
    queryKey: ["/api/ecommerce/orders", selectedCompanyId, "for-returns"],
    queryFn: async () => {
      const r = await fetch(`/api/ecommerce/orders?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId && createDialogOpen,
  });

  const { data: summary } = useQuery<any>({
    queryKey: ["/api/ecommerce/returns/summary", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/ecommerce/returns/summary?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return { pending: 0, in_transit: 0, received: 0, total: 0, totalRefund: "0" };
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const filteredReturns = useMemo(() => {
    if (returnStatusFilter === "all") return returns;
    return returns.filter(r => r.returnStatus === returnStatusFilter);
  }, [returns, returnStatusFilter]);

  const createMutation = useMutation({
    mutationFn: async (body: any) => {
      const r = await fetch("/api/ecommerce/returns", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error((await r.json()).message || "เกิดข้อผิดพลาด");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/returns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/returns/summary"] });
      setCreateDialogOpen(false);
      setNewReturn({ orderId: "", reason: "", reasonDetail: "", refundAmount: "", items: "" });
      toast({ title: "สร้างรายการคืนสินค้าสำเร็จ", variant: "success" as any });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: number; status: string; notes?: string }) => {
      const r = await fetch(`/api/ecommerce/returns/${id}/status`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ status, notes }),
      });
      if (!r.ok) throw new Error((await r.json()).message || "เกิดข้อผิดพลาด");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/returns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/returns/summary"] });
      toast({ title: "อัปเดตสถานะสำเร็จ", variant: "success" as any });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const shipMutation = useMutation({
    mutationFn: async ({ id, trackingNo, shipper }: { id: number; trackingNo: string; shipper: string }) => {
      const r = await fetch(`/api/ecommerce/returns/${id}/ship`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ trackingNo, shipper }),
      });
      if (!r.ok) throw new Error((await r.json()).message || "เกิดข้อผิดพลาด");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/returns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/returns/summary"] });
      setShipDialogOpen(false);
      setShipForm({ trackingNo: "", shipper: "" });
      toast({ title: "บันทึกข้อมูลการส่งคืนสำเร็จ", variant: "success" as any });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const receiveMutation = useMutation({
    mutationFn: async ({ id, warehouseId, items, notesInternal }: any) => {
      const r = await fetch(`/api/ecommerce/returns/${id}/receive`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ warehouseId, items, notesInternal }),
      });
      if (!r.ok) throw new Error((await r.json()).message || "เกิดข้อผิดพลาด");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/returns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/returns/summary"] });
      setReceiveDialogOpen(false);
      setReceiveItems([]);
      setReceiveWarehouseId("");
      setReceiveNotes("");
      toast({ title: "รับของเข้าคลังสำเร็จ สต็อกอัปเดตแล้ว", variant: "success" as any });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  function openShipDialog(ret: ReturnRow) {
    setSelectedReturn(ret);
    setShipForm({ trackingNo: ret.returnTrackingNo || "", shipper: ret.returnShipper || "" });
    setShipDialogOpen(true);
  }

  async function openReceiveDialog(ret: ReturnRow) {
    setSelectedReturn(ret);
    setReceiveWarehouseId(ret.receivingWarehouseId ? String(ret.receivingWarehouseId) : warehouses[0]?.id ? String(warehouses[0].id) : "");
    setReceiveNotes("");
    try {
      const r = await fetch(`/api/ecommerce/returns/${ret.id}`, { credentials: "include" });
      if (r.ok) {
        const detail = await r.json();
        if (detail.items && detail.items.length > 0) {
          setReceiveItems(detail.items.map((item: ReturnItemRow) => ({
            itemId: item.id,
            receivedQty: Number(item.qty),
            receivedCondition: "good",
            disposition: "restock",
          })));
        }
        setExpandedRow(ret.id);
      }
    } catch {}
    setReceiveDialogOpen(true);
  }

  function handleExcel() {
    if (filteredReturns.length === 0) return;
    const today = new Date();
    const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
    const rows = filteredReturns.map(ret => ({
      "เลขที่คืน": ret.returnNo || "",
      "แพลตฟอร์ม": PLATFORMS.find(p => p.value === ret.platform)?.label || ret.platform,
      "ลูกค้า": ret.buyerName || "-",
      "เหตุผล": ret.reason,
      "ยอดคืนเงิน": Number(ret.refundAmount || 0),
      "สถานะคืนเงิน": REFUND_STATUSES[ret.status]?.label || ret.status,
      "สถานะของคืน": RETURN_STATUS_MAP[ret.returnStatus]?.label || ret.returnStatus,
      "เลข Tracking": ret.returnTrackingNo || "-",
      "ขนส่ง": ret.returnShipper || "-",
      "วันที่": formatDate(ret.createdAt, dateEra, dateFmt),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Returns");
    XLSX.writeFile(wb, `คืนสินค้า_${dateStr}.xlsx`);
  }

  function handleCreateReturn() {
    const selectedOrder = orders.find((o: any) => String(o.id) === newReturn.orderId);
    if (!selectedOrder) { toast({ title: "กรุณาเลือกคำสั่งซื้อ", variant: "destructive" }); return; }
    if (!newReturn.reason) { toast({ title: "กรุณาเลือกเหตุผลการคืน", variant: "destructive" }); return; }
    const refundAmount = parseFloat(newReturn.refundAmount);
    if (isNaN(refundAmount) || refundAmount <= 0) { toast({ title: "กรุณาระบุยอดคืนเงิน", variant: "destructive" }); return; }
    createMutation.mutate({
      companyId: selectedCompanyId, orderId: selectedOrder.id, platform: selectedOrder.platform,
      reason: newReturn.reason, reasonDetail: newReturn.reasonDetail || null, refundAmount,
      buyerName: selectedOrder.buyerName || "", items: newReturn.items ? newReturn.items.split(",").map((s: string) => s.trim()).filter(Boolean) : [],
    });
  }

  const summaryData = summary || { pending: 0, in_transit: 0, received: 0, total: 0, totalRefund: "0" };

  return (
    <EcommerceLayout>
      <div className="space-y-4" data-testid="page-ecommerce-returns">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <RefreshCw className="h-6 w-6" style={{ color: "#fb9678" }} />
              <h1 className="text-2xl font-bold text-gray-800" data-testid="text-returns-title">คืนสินค้า / คืนเงิน</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">จัดการรายการคืนสินค้า ติดตามการส่งคืน และควบคุมสต็อกสินค้าคืน</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5" style={{ borderColor: "#03c9d7", color: "#03c9d7" }} onClick={() => navigate("/ecommerce/returns-scan")} data-testid="button-scan-receive">
              <PackageCheck className="h-4 w-4" />รับคืน (Scan)
            </Button>
            <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5" style={{ borderColor: "#03c9d7", color: "#03c9d7" }} onClick={() => navigate("/ecommerce/returns-qc")} data-testid="button-qc">
              <Eye className="h-4 w-4" />QC
            </Button>
            <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5" style={{ borderColor: "#fb9678", color: "#fb9678" }} onClick={() => navigate("/ecommerce/returns-report")} data-testid="button-report">
              <BarChart3 className="h-4 w-4" />รายงาน
            </Button>
            <Button onClick={() => setCreateDialogOpen(true)} className="text-white" style={{ background: "#fb9678" }} data-testid="button-create-return">
              <Plus className="h-4 w-4 mr-1" />สร้างรายการคืน
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="rounded-xl shadow-sm border cursor-pointer hover:shadow-md transition-shadow" onClick={() => setReturnStatusFilter("pending")} data-testid="card-pending">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-amber-50">
                  <Clock className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">รอส่งคืน</div>
                  <div className="text-xl font-bold text-amber-600" data-testid="text-pending-count">{summaryData.pending}</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-xl shadow-sm border cursor-pointer hover:shadow-md transition-shadow" onClick={() => setReturnStatusFilter("in_transit")} data-testid="card-in-transit">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-blue-50">
                  <Truck className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">กำลังส่งกลับ</div>
                  <div className="text-xl font-bold text-blue-600" data-testid="text-transit-count">{summaryData.in_transit}</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-xl shadow-sm border cursor-pointer hover:shadow-md transition-shadow" onClick={() => setReturnStatusFilter("received")} data-testid="card-received">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-green-50">
                  <PackageCheck className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">รับเข้าคลังแล้ว</div>
                  <div className="text-xl font-bold text-green-600" data-testid="text-received-count">{summaryData.received}</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-xl shadow-sm border" data-testid="card-total-refund">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: "#fff3ef" }}>
                  <DollarSign className="h-5 w-5" style={{ color: "#fb9678" }} />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">ยอดคืนเงินรวม</div>
                  <div className="text-lg font-bold" style={{ color: "#fb9678" }} data-testid="text-total-refund">฿{formatCurrency(summaryData.totalRefund)}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-xl shadow-sm border">
          <CardContent className="py-3 px-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground whitespace-nowrap">สถานะคืนเงิน:</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px] h-8 text-xs" data-testid="select-status-filter">
                    <SelectValue placeholder="สถานะ" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทุกสถานะ</SelectItem>
                    {Object.entries(REFUND_STATUSES).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground whitespace-nowrap">สถานะของคืน:</label>
                <Select value={returnStatusFilter} onValueChange={setReturnStatusFilter}>
                  <SelectTrigger className="w-[150px] h-8 text-xs" data-testid="select-return-status-filter">
                    <SelectValue placeholder="สถานะ" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทุกสถานะ</SelectItem>
                    {Object.entries(RETURN_STATUS_MAP).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground whitespace-nowrap">แพลตฟอร์ม:</label>
                <Select value={platformFilter} onValueChange={setPlatformFilter}>
                  <SelectTrigger className="w-[140px] h-8 text-xs" data-testid="select-platform-filter">
                    <SelectValue placeholder="แพลตฟอร์ม" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทุกแพลตฟอร์ม</SelectItem>
                    {PLATFORMS.map(p => (<SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <Button size="sm" className="h-8 text-xs gap-1.5 text-white ml-auto" style={{ background: "#03c9d7" }} onClick={handleExcel} disabled={filteredReturns.length === 0} data-testid="button-excel">
                <FileDown className="h-3.5 w-3.5" />Excel
              </Button>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : filteredReturns.length === 0 ? (
          <Card className="rounded-xl shadow-sm border">
            <CardContent className="py-12 text-center text-muted-foreground">
              <RefreshCw className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-sm">ไม่พบรายการคืนสินค้า</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-xl shadow-sm border">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs">
                      <TableHead className="text-xs w-8"></TableHead>
                      <TableHead className="text-xs">เลขที่คืน</TableHead>
                      <TableHead className="text-xs">แพลตฟอร์ม</TableHead>
                      <TableHead className="text-xs">ผู้ซื้อ</TableHead>
                      <TableHead className="text-xs">เหตุผล</TableHead>
                      <TableHead className="text-xs text-right">ยอดคืนเงิน</TableHead>
                      <TableHead className="text-xs text-center">สถานะคืนเงิน</TableHead>
                      <TableHead className="text-xs text-center">สถานะของคืน</TableHead>
                      <TableHead className="text-xs">Tracking</TableHead>
                      <TableHead className="text-xs text-center">จัดการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReturns.map((ret) => (
                      <>
                        <TableRow key={ret.id} className="text-sm cursor-pointer hover:bg-gray-50" data-testid={`row-return-${ret.id}`} onClick={() => setExpandedRow(expandedRow === ret.id ? null : ret.id)}>
                          <TableCell className="w-8 px-2">
                            {expandedRow === ret.id ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                          </TableCell>
                          <TableCell className="font-mono text-xs font-semibold" style={{ color: "#03c9d7" }}>{ret.returnNo}</TableCell>
                          <TableCell>{platformBadge(ret.platform)}</TableCell>
                          <TableCell className="text-xs">{ret.buyerName || "-"}</TableCell>
                          <TableCell className="text-xs">{ret.reason}</TableCell>
                          <TableCell className="text-right text-xs font-medium" style={{ color: "#fb9678" }}>฿{formatCurrency(ret.refundAmount)}</TableCell>
                          <TableCell className="text-center">{refundStatusBadge(ret.status)}</TableCell>
                          <TableCell className="text-center">{returnStatusBadge(ret.returnStatus)}</TableCell>
                          <TableCell className="text-xs font-mono">{ret.returnTrackingNo || <span className="text-gray-400">—</span>}</TableCell>
                          <TableCell className="text-center" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1">
                              {ret.status === "requested" && (
                                <>
                                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-blue-600 hover:bg-blue-50"
                                    onClick={() => updateStatusMutation.mutate({ id: ret.id, status: "approved" })} data-testid={`button-approve-${ret.id}`}>
                                    <Check className="h-3.5 w-3.5 mr-1" />อนุมัติ
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-red-600 hover:bg-red-50"
                                    onClick={() => updateStatusMutation.mutate({ id: ret.id, status: "rejected" })} data-testid={`button-reject-${ret.id}`}>
                                    <Ban className="h-3.5 w-3.5 mr-1" />ปฏิเสธ
                                  </Button>
                                </>
                              )}
                              {ret.returnStatus === "pending" && ret.status === "approved" && (
                                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-blue-600 hover:bg-blue-50"
                                  onClick={() => openShipDialog(ret)} data-testid={`button-ship-${ret.id}`}>
                                  <Truck className="h-3.5 w-3.5 mr-1" />ส่งคืน
                                </Button>
                              )}
                              {ret.returnStatus === "in_transit" && (
                                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-green-600 hover:bg-green-50"
                                  onClick={() => openReceiveDialog(ret)} data-testid={`button-receive-${ret.id}`}>
                                  <PackageCheck className="h-3.5 w-3.5 mr-1" />รับเข้าคลัง
                                </Button>
                              )}
                              {ret.status === "approved" && ret.returnStatus === "received" && (
                                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-green-600 hover:bg-green-50"
                                  onClick={() => updateStatusMutation.mutate({ id: ret.id, status: "completed" })} data-testid={`button-refund-${ret.id}`}>
                                  <DollarSign className="h-3.5 w-3.5 mr-1" />คืนเงิน
                                </Button>
                              )}
                              {ret.status === "completed" && (
                                <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium"><Check className="h-3.5 w-3.5" />เสร็จสิ้น</span>
                              )}
                              {ret.status === "rejected" && (
                                <span className="inline-flex items-center gap-1 text-xs text-red-500 font-medium"><Ban className="h-3.5 w-3.5" />ปฏิเสธแล้ว</span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                        {expandedRow === ret.id && returnDetail && (
                          <TableRow key={`detail-${ret.id}`}>
                            <TableCell colSpan={10} className="bg-gray-50/50 p-4">
                              <div className="space-y-3">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                                  <div><span className="text-muted-foreground">ขนส่ง:</span> <span className="font-medium">{ret.returnShipper || "-"}</span></div>
                                  <div><span className="text-muted-foreground">วันที่ส่งคืน:</span> <span className="font-medium">{ret.shippedAt ? formatDate(ret.shippedAt, dateEra, dateFmt) : "-"}</span></div>
                                  <div><span className="text-muted-foreground">วันที่รับเข้าคลัง:</span> <span className="font-medium">{ret.receivedAt ? formatDate(ret.receivedAt, dateEra, dateFmt) : "-"}</span></div>
                                  <div><span className="text-muted-foreground">คลังปลายทาง:</span> <span className="font-medium">{warehouses.find(w => w.id === ret.receivingWarehouseId)?.name || "-"}</span></div>
                                </div>
                                {ret.notesInternal && (
                                  <div className="text-xs"><span className="text-muted-foreground">หมายเหตุภายใน:</span> <span>{ret.notesInternal}</span></div>
                                )}
                                {returnDetail.items && returnDetail.items.length > 0 && (
                                  <div>
                                    <div className="text-xs font-semibold text-gray-700 mb-2">รายการสินค้าที่คืน</div>
                                    <Table>
                                      <TableHeader>
                                        <TableRow className="text-xs">
                                          <TableHead className="text-xs">สินค้า</TableHead>
                                          <TableHead className="text-xs">SKU</TableHead>
                                          <TableHead className="text-xs text-right">จำนวนคืน</TableHead>
                                          <TableHead className="text-xs text-right">รับจริง</TableHead>
                                          <TableHead className="text-xs text-center">สภาพ</TableHead>
                                          <TableHead className="text-xs text-center">การจัดการ</TableHead>
                                          <TableHead className="text-xs">คลังที่เก็บ</TableHead>
                                          <TableHead className="text-xs text-center">สต็อก</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {returnDetail.items.map((item: ReturnItemRow) => (
                                          <TableRow key={item.id} className="text-xs">
                                            <TableCell className="text-xs font-medium">{item.productName}</TableCell>
                                            <TableCell className="text-xs font-mono text-gray-500">{item.sku || "-"}</TableCell>
                                            <TableCell className="text-xs text-right">{Number(item.qty)}</TableCell>
                                            <TableCell className="text-xs text-right font-medium">{Number(item.receivedQty) > 0 ? Number(item.receivedQty) : "-"}</TableCell>
                                            <TableCell className="text-xs text-center">
                                              {item.receivedCondition === "good" ? <Badge className="bg-green-100 text-green-700 hover:bg-green-100">สภาพดี</Badge>
                                                : item.receivedCondition === "damaged" ? <Badge className="bg-red-100 text-red-700 hover:bg-red-100">ชำรุด</Badge>
                                                : <span className="text-gray-400">—</span>}
                                            </TableCell>
                                            <TableCell className="text-xs text-center">
                                              {item.disposition ? <span className={DISPOSITIONS[item.disposition]?.color || ""}>{DISPOSITIONS[item.disposition]?.label || item.disposition}</span> : <span className="text-gray-400">—</span>}
                                            </TableCell>
                                            <TableCell className="text-xs">{warehouses.find(w => w.id === item.warehouseId)?.name || "-"}</TableCell>
                                            <TableCell className="text-xs text-center">
                                              {item.stockUpdated ? <Badge className="bg-green-100 text-green-700 hover:bg-green-100">อัปเดตแล้ว</Badge> : <span className="text-gray-400">—</span>}
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Dialog: Create Return */}
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent className="max-w-lg" data-testid="dialog-create-return">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5" style={{ color: "#fb9678" }} />สร้างรายการคืนสินค้า
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">คำสั่งซื้อ</label>
                <Select value={newReturn.orderId} onValueChange={v => setNewReturn(prev => ({ ...prev, orderId: v }))}>
                  <SelectTrigger className="h-9 text-sm" data-testid="select-order"><SelectValue placeholder="เลือกคำสั่งซื้อ" /></SelectTrigger>
                  <SelectContent>
                    {orders.filter((o: any) => !['grab_food','line_man','robinhood'].includes(o.platform)).map((o: any) => (
                      <SelectItem key={o.id} value={String(o.id)}>
                        {o.platformOrderId} - {o.buyerName || "ไม่ระบุ"} (฿{formatCurrency(o.totalAmount)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">เหตุผลการคืน</label>
                <Select value={newReturn.reason} onValueChange={v => setNewReturn(prev => ({ ...prev, reason: v }))}>
                  <SelectTrigger className="h-9 text-sm" data-testid="select-reason"><SelectValue placeholder="เลือกเหตุผล" /></SelectTrigger>
                  <SelectContent>
                    {RETURN_REASONS.map(r => (<SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">รายละเอียดเพิ่มเติม</label>
                <Textarea className="text-sm" rows={2} placeholder="รายละเอียดเหตุผลการคืน" value={newReturn.reasonDetail} onChange={e => setNewReturn(prev => ({ ...prev, reasonDetail: e.target.value }))} data-testid="input-reason-detail" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">ยอดคืนเงิน (฿)</label>
                <Input type="number" step="0.01" className="h-9 text-sm" placeholder="0.00" value={newReturn.refundAmount} onChange={e => setNewReturn(prev => ({ ...prev, refundAmount: e.target.value }))} data-testid="input-refund-amount" />
              </div>
              <Button className="w-full text-white" style={{ background: "#fb9678" }} onClick={handleCreateReturn} disabled={createMutation.isPending} data-testid="button-submit-return">
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}สร้างรายการคืน
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog: Ship Return */}
        <Dialog open={shipDialogOpen} onOpenChange={setShipDialogOpen}>
          <DialogContent className="max-w-md" data-testid="dialog-ship-return">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-blue-600" />บันทึกข้อมูลส่งคืน
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700">
                รายการคืน: <span className="font-semibold">{selectedReturn?.returnNo}</span> — {selectedReturn?.buyerName}
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">หมายเลขพัสดุ (Tracking No.)</label>
                <Input className="h-9 text-sm" placeholder="TH12345678901" value={shipForm.trackingNo} onChange={e => setShipForm(prev => ({ ...prev, trackingNo: e.target.value }))} data-testid="input-tracking-no" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">บริษัทขนส่ง</label>
                <Select value={shipForm.shipper} onValueChange={v => setShipForm(prev => ({ ...prev, shipper: v }))}>
                  <SelectTrigger className="h-9 text-sm" data-testid="select-shipper"><SelectValue placeholder="เลือกบริษัทขนส่ง" /></SelectTrigger>
                  <SelectContent>
                    {SHIPPERS.map(s => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full text-white" style={{ background: "#539BFF" }} disabled={!shipForm.trackingNo || shipMutation.isPending}
                onClick={() => selectedReturn && shipMutation.mutate({ id: selectedReturn.id, trackingNo: shipForm.trackingNo, shipper: shipForm.shipper })} data-testid="button-submit-ship">
                {shipMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Truck className="h-4 w-4 mr-2" />}บันทึกการส่งคืน
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog: Receive Return */}
        <Dialog open={receiveDialogOpen} onOpenChange={setReceiveDialogOpen}>
          <DialogContent className="max-w-2xl" data-testid="dialog-receive-return">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <PackageCheck className="h-5 w-5 text-green-600" />รับสินค้าคืนเข้าคลัง
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-green-50 rounded-lg p-3 text-xs text-green-700">
                รายการคืน: <span className="font-semibold">{selectedReturn?.returnNo}</span> — {selectedReturn?.buyerName}
                {selectedReturn?.returnTrackingNo && <span className="ml-2">| Tracking: {selectedReturn.returnTrackingNo}</span>}
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">คลังสินค้าปลายทาง (ค่าเริ่มต้น)</label>
                <Select value={receiveWarehouseId} onValueChange={setReceiveWarehouseId}>
                  <SelectTrigger className="h-9 text-sm" data-testid="select-receive-warehouse"><SelectValue placeholder="เลือกคลังสินค้า" /></SelectTrigger>
                  <SelectContent>
                    {warehouses.map(w => (<SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>

              {returnDetail?.items && returnDetail.items.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="text-xs bg-gray-50">
                        <TableHead className="text-xs">สินค้า</TableHead>
                        <TableHead className="text-xs text-center w-20">จำนวนคืน</TableHead>
                        <TableHead className="text-xs text-center w-20">รับจริง</TableHead>
                        <TableHead className="text-xs text-center w-28">สภาพ</TableHead>
                        <TableHead className="text-xs text-center w-32">การจัดการ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {returnDetail.items.map((item: ReturnItemRow, idx: number) => {
                        const ri = receiveItems.find(r => r.itemId === item.id) || { receivedQty: Number(item.qty), receivedCondition: "good", disposition: "restock" };
                        return (
                          <TableRow key={item.id} className="text-xs">
                            <TableCell>
                              <div className="font-medium">{item.productName}</div>
                              {item.sku && <div className="text-xs text-gray-400 font-mono">{item.sku}</div>}
                            </TableCell>
                            <TableCell className="text-center">{Number(item.qty)}</TableCell>
                            <TableCell className="text-center">
                              <Input type="number" min={0} max={Number(item.qty)} className="h-7 text-xs text-center w-16 mx-auto" value={ri.receivedQty}
                                onChange={e => {
                                  const val = Number(e.target.value);
                                  setReceiveItems(prev => {
                                    const updated = [...prev];
                                    const existing = updated.findIndex(r => r.itemId === item.id);
                                    if (existing >= 0) updated[existing] = { ...updated[existing], receivedQty: val };
                                    else updated.push({ itemId: item.id, receivedQty: val, receivedCondition: "good", disposition: "restock" });
                                    return updated;
                                  });
                                }} data-testid={`input-received-qty-${item.id}`} />
                            </TableCell>
                            <TableCell className="text-center">
                              <Select value={ri.receivedCondition} onValueChange={v => {
                                setReceiveItems(prev => {
                                  const updated = [...prev];
                                  const existing = updated.findIndex(r => r.itemId === item.id);
                                  if (existing >= 0) updated[existing] = { ...updated[existing], receivedCondition: v };
                                  else updated.push({ itemId: item.id, receivedQty: Number(item.qty), receivedCondition: v, disposition: "restock" });
                                  return updated;
                                });
                              }}>
                                <SelectTrigger className="h-7 text-xs w-24 mx-auto"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="good">สภาพดี</SelectItem>
                                  <SelectItem value="damaged">ชำรุด</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="text-center">
                              <Select value={ri.disposition} onValueChange={v => {
                                setReceiveItems(prev => {
                                  const updated = [...prev];
                                  const existing = updated.findIndex(r => r.itemId === item.id);
                                  if (existing >= 0) updated[existing] = { ...updated[existing], disposition: v };
                                  else updated.push({ itemId: item.id, receivedQty: Number(item.qty), receivedCondition: "good", disposition: v });
                                  return updated;
                                });
                              }}>
                                <SelectTrigger className="h-7 text-xs w-28 mx-auto"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="restock">คืนสต็อก</SelectItem>
                                  <SelectItem value="repair">ส่งซ่อม</SelectItem>
                                  <SelectItem value="writeoff">ตัดจำหน่าย</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">หมายเหตุภายใน</label>
                <Textarea className="text-sm" rows={2} placeholder="หมายเหตุสำหรับทีมงาน..." value={receiveNotes} onChange={e => setReceiveNotes(e.target.value)} data-testid="input-receive-notes" />
              </div>

              <div className="bg-amber-50 rounded-lg p-3 text-xs text-amber-700">
                <strong>สินค้าที่เลือก "คืนสต็อก"</strong> จะถูกเพิ่มสต็อกในคลังปลายทางอัตโนมัติ | <strong>"ส่งซ่อม"</strong> และ <strong>"ตัดจำหน่าย"</strong> จะไม่เข้าสต็อก
              </div>

              <Button className="w-full text-white" style={{ background: "#05b187" }} disabled={!receiveWarehouseId || receiveMutation.isPending}
                onClick={() => {
                  if (!selectedReturn) return;
                  const items = receiveItems.length > 0 ? receiveItems : (returnDetail?.items || []).map((item: ReturnItemRow) => ({
                    itemId: item.id, receivedQty: Number(item.qty), receivedCondition: "good", disposition: "restock",
                  }));
                  receiveMutation.mutate({ id: selectedReturn.id, warehouseId: Number(receiveWarehouseId), items, notesInternal: receiveNotes });
                }} data-testid="button-submit-receive">
                {receiveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PackageCheck className="h-4 w-4 mr-2" />}
                รับของเข้าคลังและอัปเดตสต็อก
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </EcommerceLayout>
  );
}
