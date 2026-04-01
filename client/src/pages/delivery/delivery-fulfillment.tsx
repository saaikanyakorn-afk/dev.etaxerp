import { useState, useRef, useEffect, useCallback } from "react";
import DeliveryLayout from "@/components/delivery-layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Package, Loader2, Plus, ChevronDown, ChevronRight, Barcode,
  CheckCircle2, Truck, BoxIcon, ClipboardList, ScanLine
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { formatDate } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";

import { useDateSettings } from "@/hooks/use-date-settings";
const PLATFORMS = [
  { value: "shopee", label: "Shopee", bgLight: "bg-orange-100", textColor: "text-orange-700" },
  { value: "lazada", label: "Lazada", bgLight: "bg-indigo-100", textColor: "text-indigo-700" },
  { value: "tiktok", label: "TikTok Shop", bgLight: "bg-gray-100", textColor: "text-gray-900" },
  { value: "grab_food", label: "Grab Food", bgLight: "bg-green-100", textColor: "text-green-700" },
  { value: "line_man", label: "LINE MAN", bgLight: "bg-emerald-100", textColor: "text-emerald-700" },
  { value: "robinhood", label: "Robinhood", bgLight: "bg-purple-100", textColor: "text-purple-700" },
  { value: "amazon", label: "Amazon", bgLight: "bg-amber-100", textColor: "text-amber-700" },
];

function platformBadge(platform: string) {
  const p = PLATFORMS.find(pl => pl.value === platform);
  if (!p) return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">{platform}</Badge>;
  return <Badge className={`${p.bgLight} ${p.textColor} hover:${p.bgLight}`}>{p.label}</Badge>;
}

function statusBadge(status: string) {
  switch (status) {
    case "pending": return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">รอดำเนินการ</Badge>;
    case "picking": return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">กำลังหยิบ</Badge>;
    case "packing": return <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100">กำลังแพ็ค</Badge>;
    case "shipping": return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">กำลังจัดส่ง</Badge>;
    case "completed": return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">เสร็จสิ้น</Badge>;
    default: return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">{status}</Badge>;
  }
}

function itemStatusBadge(status: string) {
  switch (status) {
    case "pending": return <Badge variant="outline" className="text-yellow-600 border-yellow-300">รอหยิบ</Badge>;
    case "picked": return <Badge variant="outline" className="text-blue-600 border-blue-300">หยิบแล้ว</Badge>;
    case "packed": return <Badge variant="outline" className="text-purple-600 border-purple-300">แพ็คแล้ว</Badge>;
    case "shipped": return <Badge variant="outline" className="text-green-600 border-green-300">จัดส่งแล้ว</Badge>;
    default: return <Badge variant="outline">{status}</Badge>;
  }
}

type FulfillmentBatch = {
  id: number;
  batchNo: string;
  status: string;
  totalOrders: number;
  pickedCount: number;
  packedCount: number;
  shippedCount: number;
  createdAt: string;
  warehouseId?: number | null;
};

type FulfillmentItem = {
  id: number;
  batchId: number;
  orderId: number;
  status: string;
  trackingNo?: string | null;
  shippingProvider?: string | null;
  order?: {
    orderNo?: string;
    platformOrderId?: string;
    platform: string;
    buyerName?: string;
  };
};

type BatchDetail = FulfillmentBatch & { items: FulfillmentItem[] };

export default function EcommerceFulfillment() {
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
  const [expandedBatchId, setExpandedBatchId] = useState<number | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<number>>(new Set());
  const [warehouseId, setWarehouseId] = useState<string>("");
  const [shipDialogOpen, setShipDialogOpen] = useState(false);
  const [shipItemId, setShipItemId] = useState<number | null>(null);
  const [trackingNo, setTrackingNo] = useState("");
  const [shippingProvider, setShippingProvider] = useState("");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [scanFeedback, setScanFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const barcodeRef = useRef<HTMLInputElement>(null);

  const { data: batches, isLoading: batchesLoading } = useQuery<FulfillmentBatch[]>({
    queryKey: ["/api/fulfillment/batches", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/fulfillment/batches?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const { data: batchDetail, isLoading: detailLoading } = useQuery<BatchDetail>({
    queryKey: ["/api/fulfillment/batches", expandedBatchId],
    queryFn: async () => {
      const r = await fetch(`/api/fulfillment/batches/${expandedBatchId}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    enabled: !!expandedBatchId,
  });

  const { data: unfulfilledOrders, isLoading: ordersLoading } = useQuery<any[]>({
    queryKey: ["/api/ecommerce/orders", selectedCompanyId, "unfulfilled"],
    queryFn: async () => {
      const r = await fetch(`/api/ecommerce/orders?companyId=${selectedCompanyId}&status=confirmed`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      const data = await r.json();
      return Array.isArray(data) ? data : data.orders || [];
    },
    enabled: createDialogOpen && !!selectedCompanyId,
  });

  const createBatchMutation = useMutation({
    mutationFn: async (body: { companyId: number; orderIds: number[]; warehouseId?: number }) => {
      const r = await fetch("/api/fulfillment/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error((await r.json()).message || "Failed");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fulfillment/batches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/orders"] });
      setCreateDialogOpen(false);
      setSelectedOrderIds(new Set());
      setWarehouseId("");
      toast({ title: "สร้างแบทช์สำเร็จ" });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const pickMutation = useMutation({
    mutationFn: async (itemId: number) => {
      const r = await fetch(`/api/fulfillment/items/${itemId}/pick`, { method: "PATCH", credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fulfillment/batches"] });
      toast({ title: "หยิบสินค้าแล้ว" });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const packMutation = useMutation({
    mutationFn: async (itemId: number) => {
      const r = await fetch(`/api/fulfillment/items/${itemId}/pack`, { method: "PATCH", credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fulfillment/batches"] });
      toast({ title: "แพ็คสินค้าแล้ว" });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const shipMutation = useMutation({
    mutationFn: async ({ itemId, trackingNo, shippingProvider }: { itemId: number; trackingNo: string; shippingProvider: string }) => {
      const r = await fetch(`/api/fulfillment/items/${itemId}/ship`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ trackingNo, shippingProvider }),
      });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fulfillment/batches"] });
      setShipDialogOpen(false);
      setShipItemId(null);
      setTrackingNo("");
      setShippingProvider("");
      toast({ title: "จัดส่งสินค้าแล้ว" });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const handleBarcodeScan = useCallback((value: string) => {
    if (!batchDetail?.items) return;
    const trimmed = value.trim();
    if (!trimmed) return;

    const item = batchDetail.items.find(
      i => i.status === "pending" && (
        i.order?.orderNo?.toLowerCase() === trimmed.toLowerCase() ||
        i.order?.platformOrderId?.toLowerCase() === trimmed.toLowerCase()
      )
    );

    if (item) {
      pickMutation.mutate(item.id);
      setScanFeedback({ type: "success", message: `หยิบ ${trimmed} สำเร็จ` });
    } else {
      setScanFeedback({ type: "error", message: `ไม่พบออเดอร์ ${trimmed} ในแบทช์นี้` });
    }
    setBarcodeInput("");
    setTimeout(() => setScanFeedback(null), 3000);
  }, [batchDetail, pickMutation]);

  useEffect(() => {
    if (expandedBatchId && barcodeRef.current) {
      barcodeRef.current.focus();
    }
  }, [expandedBatchId, batchDetail]);

  const batchList = batches || [];
  const inProgressCount = batchList.filter(b => ["picking", "packing", "shipping"].includes(b.status)).length;
  const today = new Date().toDateString();
  const completedTodayCount = batchList.filter(b => b.status === "completed" && new Date(b.createdAt).toDateString() === today).length;

  const toggleOrderSelect = (id: number) => {
    setSelectedOrderIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <DeliveryLayout>
      <div className="space-y-5" data-testid="page-fulfillment">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800" data-testid="text-fulfillment-title">จัดส่งสินค้า (Pick-Pack-Ship)</h1>
            <p className="text-sm text-muted-foreground mt-1">จัดการขั้นตอนการจัดส่งสินค้าแบบแบทช์ ตั้งแต่หยิบ แพ็ค จนถึงส่ง</p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-create-batch">
            <Plus className="h-4 w-4 mr-1" />
            สร้างแบทช์ใหม่
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card className="rounded-xl shadow-sm border" data-testid="card-kpi-total">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-blue-50">
                  <ClipboardList className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">แบทช์ทั้งหมด</div>
                  <div className="text-xl font-bold text-blue-600" data-testid="text-kpi-total">{batchList.length}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl shadow-sm border" data-testid="card-kpi-inprogress">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-orange-50">
                  <Package className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">กำลังดำเนินการ</div>
                  <div className="text-xl font-bold text-orange-600" data-testid="text-kpi-inprogress">{inProgressCount}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl shadow-sm border" data-testid="card-kpi-completed">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-green-50">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">เสร็จวันนี้</div>
                  <div className="text-xl font-bold text-green-600" data-testid="text-kpi-completed">{completedTodayCount}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {batchesLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : batchList.length === 0 ? (
          <Card className="rounded-xl shadow-sm border">
            <CardContent className="py-12 text-center text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-sm">ยังไม่มีแบทช์การจัดส่ง</p>
              <p className="text-xs mt-1">คลิก "สร้างแบทช์ใหม่" เพื่อเริ่มต้น</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {batchList.map(batch => {
              const isExpanded = expandedBatchId === batch.id;
              return (
                <Card key={batch.id} className="rounded-xl shadow-sm border overflow-hidden" data-testid={`card-batch-${batch.id}`}>
                  <div
                    className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50/50 transition-colors"
                    onClick={() => setExpandedBatchId(isExpanded ? null : batch.id)}
                    data-testid={`button-expand-batch-${batch.id}`}
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      <span className="font-mono font-medium text-sm" data-testid={`text-batch-no-${batch.id}`}>{batch.batchNo}</span>
                      {statusBadge(batch.status)}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span data-testid={`text-batch-orders-${batch.id}`}>{batch.totalOrders} ออเดอร์</span>
                      <span className="text-blue-600">หยิบ: {batch.pickedCount}</span>
                      <span className="text-purple-600">แพ็ค: {batch.packedCount}</span>
                      <span className="text-green-600">ส่ง: {batch.shippedCount}</span>
                      <span>{formatDate(batch.createdAt, dateEra, dateFmt)}</span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t px-4 py-3 bg-gray-50/30">
                      {detailLoading ? (
                        <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <ScanLine className="h-4 w-4 text-muted-foreground" />
                            <Input
                              ref={barcodeRef}
                              value={barcodeInput}
                              onChange={e => setBarcodeInput(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === "Enter") {
                                  handleBarcodeScan(barcodeInput);
                                }
                              }}
                              placeholder="สแกนบาร์โค้ดหรือพิมพ์เลขออเดอร์..."
                              className="max-w-md h-9 text-sm"
                              data-testid="input-barcode"
                            />
                            {scanFeedback && (
                              <span
                                className={`text-sm font-medium ${scanFeedback.type === "success" ? "text-green-600" : "text-red-600"}`}
                                data-testid="text-scan-feedback"
                              >
                                {scanFeedback.message}
                              </span>
                            )}
                          </div>

                          <div className="space-y-2">
                            {(batchDetail?.items || []).map(item => (
                              <div
                                key={item.id}
                                className={`flex items-center justify-between p-3 rounded-lg border bg-white ${
                                  item.status === "shipped" ? "border-green-200 bg-green-50/30" : "border-gray-200"
                                }`}
                                data-testid={`item-fulfillment-${item.id}`}
                              >
                                <div className="flex items-center gap-3">
                                  <span className="font-mono text-sm" data-testid={`text-item-order-${item.id}`}>
                                    {item.order?.orderNo || item.order?.platformOrderId || `#${item.orderId}`}
                                  </span>
                                  {item.order?.platform && platformBadge(item.order.platform)}
                                  <span className="text-sm text-muted-foreground" data-testid={`text-item-buyer-${item.id}`}>
                                    {item.order?.buyerName || "-"}
                                  </span>
                                  {itemStatusBadge(item.status)}
                                </div>

                                <div className="flex items-center gap-2">
                                  {item.status === "pending" && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-blue-600 border-blue-300 hover:bg-blue-50"
                                      onClick={() => pickMutation.mutate(item.id)}
                                      disabled={pickMutation.isPending}
                                      data-testid={`button-pick-${item.id}`}
                                    >
                                      <BoxIcon className="h-3.5 w-3.5 mr-1" />
                                      หยิบ
                                    </Button>
                                  )}
                                  {item.status === "picked" && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-purple-600 border-purple-300 hover:bg-purple-50"
                                      onClick={() => packMutation.mutate(item.id)}
                                      disabled={packMutation.isPending}
                                      data-testid={`button-pack-${item.id}`}
                                    >
                                      <Package className="h-3.5 w-3.5 mr-1" />
                                      แพ็ค
                                    </Button>
                                  )}
                                  {item.status === "packed" && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-orange-600 border-orange-300 hover:bg-orange-50"
                                      onClick={() => {
                                        setShipItemId(item.id);
                                        setShipDialogOpen(true);
                                      }}
                                      data-testid={`button-ship-${item.id}`}
                                    >
                                      <Truck className="h-3.5 w-3.5 mr-1" />
                                      จัดส่ง
                                    </Button>
                                  )}
                                  {item.status === "shipped" && (
                                    <div className="text-xs text-muted-foreground text-right" data-testid={`text-tracking-${item.id}`}>
                                      <div className="font-medium text-green-700">{item.shippingProvider}</div>
                                      <div className="font-mono">{item.trackingNo}</div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle data-testid="text-create-batch-title">สร้างแบทช์ใหม่</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">คลังสินค้า (ไม่บังคับ)</label>
                <Select value={warehouseId} onValueChange={setWarehouseId}>
                  <SelectTrigger className="mt-1" data-testid="select-warehouse">
                    <SelectValue placeholder="เลือกคลังสินค้า" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">ไม่ระบุ</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">ออเดอร์ที่ยังไม่ได้จัดส่ง</label>
                  <span className="text-xs text-muted-foreground" data-testid="text-selected-count">
                    เลือกแล้ว {selectedOrderIds.size} รายการ
                  </span>
                </div>

                {ordersLoading ? (
                  <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                ) : !unfulfilledOrders || unfulfilledOrders.length === 0 ? (
                  <div className="text-center py-6 text-sm text-muted-foreground">ไม่มีออเดอร์ที่ยังไม่ได้จัดส่ง</div>
                ) : (
                  <div className="space-y-1 max-h-60 overflow-y-auto border rounded-lg p-2">
                    {unfulfilledOrders.map((order: any) => (
                      <div
                        key={order.id}
                        className={`flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-gray-50 ${
                          selectedOrderIds.has(order.id) ? "bg-blue-50 border border-blue-200" : ""
                        }`}
                        onClick={() => toggleOrderSelect(order.id)}
                        data-testid={`order-select-${order.id}`}
                      >
                        <Checkbox
                          checked={selectedOrderIds.has(order.id)}
                          onCheckedChange={() => toggleOrderSelect(order.id)}
                          data-testid={`checkbox-order-${order.id}`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm">{order.orderNo || order.platformOrderId}</span>
                            {platformBadge(order.platform)}
                          </div>
                          <div className="text-xs text-muted-foreground">{order.buyerName || "-"}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Button
                className="w-full"
                disabled={selectedOrderIds.size === 0 || createBatchMutation.isPending}
                onClick={() => {
                  if (!selectedCompanyId) return;
                  createBatchMutation.mutate({
                    companyId: selectedCompanyId,
                    orderIds: Array.from(selectedOrderIds),
                    ...(warehouseId && warehouseId !== "none" ? { warehouseId: parseInt(warehouseId) } : {}),
                  });
                }}
                data-testid="button-confirm-create-batch"
              >
                {createBatchMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Plus className="h-4 w-4 mr-1" />
                )}
                สร้างแบทช์ ({selectedOrderIds.size} ออเดอร์)
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={shipDialogOpen} onOpenChange={(open) => { setShipDialogOpen(open); if (!open) { setShipItemId(null); setTrackingNo(""); setShippingProvider(""); } }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle data-testid="text-ship-dialog-title">กรอกข้อมูลการจัดส่ง</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">ผู้ให้บริการขนส่ง</label>
                <Input
                  value={shippingProvider}
                  onChange={e => setShippingProvider(e.target.value)}
                  placeholder="เช่น Kerry, Flash, J&T"
                  className="mt-1"
                  data-testid="input-shipping-provider"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">เลขพัสดุ (Tracking No.)</label>
                <Input
                  value={trackingNo}
                  onChange={e => setTrackingNo(e.target.value)}
                  placeholder="เลขพัสดุ"
                  className="mt-1"
                  data-testid="input-tracking-no"
                />
              </div>
              <Button
                className="w-full"
                disabled={!trackingNo || !shippingProvider || shipMutation.isPending}
                onClick={() => {
                  if (shipItemId) {
                    shipMutation.mutate({ itemId: shipItemId, trackingNo, shippingProvider });
                  }
                }}
                data-testid="button-confirm-ship"
              >
                {shipMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Truck className="h-4 w-4 mr-1" />}
                ยืนยันจัดส่ง
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DeliveryLayout>
  );
}
