import { useState, useMemo, useRef } from "react";
import DeliveryLayout from "@/components/delivery-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Printer, Search, Loader2, Package, Info, X } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { useToast } from "@/hooks/use-toast";
import type { EcommerceOrder } from "@shared/schema";
import ThaiDateInput from "@/components/thai-date-input";
import { useDateSettings } from "@/hooks/use-date-settings";
import { toLocalDateStr } from "@/lib/utils";

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
  { value: "grab_food", label: "Grab Food", hex: "#00B14F", bgLight: "bg-green-100", textColor: "text-green-700" },
  { value: "line_man", label: "LINE MAN", hex: "#2DA157", bgLight: "bg-emerald-100", textColor: "text-emerald-700" },
  { value: "robinhood", label: "Robinhood", hex: "#7B2D8E", bgLight: "bg-purple-100", textColor: "text-purple-700" },
  { value: "amazon", label: "Amazon", hex: "#FF9900", bgLight: "bg-amber-100", textColor: "text-amber-700" },
];

function platformBadge(platform: string) {
  const p = PLATFORMS.find(pl => pl.value === platform);
  if (!p) return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">{platform}</Badge>;
  return <Badge className={`${p.bgLight} ${p.textColor} hover:${p.bgLight}`}>{p.label}</Badge>;
}

function statusBadge(status: string) {
  switch (status) {
    case "confirmed":
      return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">ยืนยันแล้ว</Badge>;
    case "shipping":
      return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">กำลังจัดส่ง</Badge>;
    default:
      return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">{status}</Badge>;
  }
}

export default function EcommerceShippingLabels() {
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { toast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);
  const { dateEra, dateFmt } = useDateSettings();

  const [carrier, setCarrier] = useState("kerry");
  const [platformFilter, setPlatformFilter] = useState("all");
  const now = new Date();
  const yearStart = `${now.getFullYear()}-01-01`;
  const todayStr = toLocalDateStr(now);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showPreview, setShowPreview] = useState(false);

  const { data: orders = [], isLoading } = useQuery<EcommerceOrder[]>({
    queryKey: ["/api/ecommerce/shipping-labels/orders", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/ecommerce/shipping-labels/orders?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const generateMutation = useMutation({
    mutationFn: async (params: { orderIds: number[]; carrier: string }) => {
      const r = await fetch("/api/ecommerce/shipping-labels/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(params),
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: (result) => {
      toast({ title: result.message });
      setShowPreview(true);
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const filteredOrders = useMemo(() => {
    let result = orders;
    if (platformFilter !== "all") {
      result = result.filter(o => o.platform === platformFilter);
    }
    if (startDate) {
      const start = new Date(startDate);
      result = result.filter(o => o.placedAt && new Date(o.placedAt) >= start);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      result = result.filter(o => o.placedAt && new Date(o.placedAt) <= end);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(o =>
        (o.orderNo || "").toLowerCase().includes(q) ||
        (o.platformOrderId || "").toLowerCase().includes(q) ||
        (o.trackingNo || "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [orders, platformFilter, startDate, endDate, searchQuery]);

  const selectedOrders = useMemo(() =>
    filteredOrders.filter(o => selectedIds.has(o.id)),
    [filteredOrders, selectedIds]
  );

  const allSelected = filteredOrders.length > 0 && filteredOrders.every(o => selectedIds.has(o.id));

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredOrders.map(o => o.id)));
    }
  };

  const handlePrint = () => {
    if (selectedIds.size === 0) {
      toast({ title: "กรุณาเลือกออเดอร์ที่ต้องการพิมพ์ใบปะหน้า", variant: "destructive" });
      return;
    }
    generateMutation.mutate({ orderIds: Array.from(selectedIds), carrier });
  };

  const doPrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>ใบปะหน้าพัสดุ</title>
      <style>
        body { font-family: 'Sarabun', sans-serif; margin: 0; padding: 0; }
        .label { page-break-after: always; border: 2px solid #000; padding: 16px; margin: 8px; width: 380px; min-height: 540px; box-sizing: border-box; }
        .label:last-child { page-break-after: auto; }
        .carrier-header { text-align: center; font-size: 20px; font-weight: bold; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px; }
        .section { margin-bottom: 10px; }
        .section-title { font-size: 11px; font-weight: bold; color: #666; text-transform: uppercase; margin-bottom: 4px; }
        .recipient { font-size: 14px; font-weight: bold; }
        .address { font-size: 12px; line-height: 1.4; }
        .barcode { text-align: center; font-family: monospace; font-size: 28px; letter-spacing: 4px; padding: 12px 0; }
        .tracking { text-align: center; font-size: 13px; font-weight: bold; margin-top: 4px; }
        .order-info { display: flex; justify-content: space-between; font-size: 11px; border-top: 1px dashed #999; padding-top: 8px; }
        .platform-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; color: white; }
        @media print { body { margin: 0; } .label { border: 2px solid #000; } }
      </style></head><body>
      ${printContent.innerHTML}
      </body></html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 300);
  };

  const carrierLabel = CARRIERS.find(c => c.value === carrier)?.label || carrier;

  return (
    <DeliveryLayout>
      <div className="space-y-5" data-testid="page-shipping-labels">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-800" data-testid="text-shipping-labels-title">พิมพ์ใบปะหน้าพัสดุ</h1>
            <p className="text-sm text-muted-foreground mt-1">เลือกออเดอร์และพิมพ์ใบปะหน้าพัสดุสำหรับจัดส่ง</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground whitespace-nowrap">ขนส่ง:</label>
            <Select value={carrier} onValueChange={setCarrier}>
              <SelectTrigger className="w-[180px] h-9 text-sm rounded-lg" data-testid="select-carrier">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CARRIERS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Card className="rounded-xl shadow-sm border bg-blue-50 border-blue-200">
          <CardContent className="py-3 px-4">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
              <p className="text-xs text-blue-700" data-testid="text-api-info">
                เมื่อเชื่อมต่อ API กับแพลตฟอร์มแล้ว ระบบจะดึงใบปะหน้าพัสดุจากแพลตฟอร์มโดยตรง ขณะนี้ใช้ Template ของระบบ
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl shadow-sm border">
          <CardContent className="py-3 px-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground whitespace-nowrap">แพลตฟอร์ม:</label>
                <Select value={platformFilter} onValueChange={setPlatformFilter}>
                  <SelectTrigger className="w-[140px] h-8 text-sm rounded-lg" data-testid="select-platform-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทั้งหมด</SelectItem>
                    {PLATFORMS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground whitespace-nowrap">วันที่:</label>
                <ThaiDateInput value={startDate} onChange={setStartDate} dateEra={dateEra} dateFmt={dateFmt} className="w-[160px]" data-testid="input-start-date" />
                <span className="text-xs text-muted-foreground">ถึง</span>
                <ThaiDateInput value={endDate} onChange={setEndDate} dateEra={dateEra} dateFmt={dateFmt} className="w-[160px]" data-testid="input-end-date" />
              </div>
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="ค้นหาเลขออเดอร์ / tracking..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-8 h-8 text-sm rounded-lg"
                    data-testid="input-search-order"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl border border-blue-200" data-testid="batch-action-bar">
            <span className="text-sm font-medium text-blue-700">เลือก {selectedIds.size} รายการ</span>
            <Button
              size="sm"
              className="bg-[#fb9678] hover:bg-[#e8856a] text-white"
              onClick={handlePrint}
              disabled={generateMutation.isPending}
              data-testid="button-print-labels"
            >
              {generateMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Printer className="h-4 w-4 mr-1" />}
              พิมพ์ใบปะหน้า {selectedIds.size} ใบ
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setSelectedIds(new Set()); setShowPreview(false); }} data-testid="button-clear-selection">
              <X className="h-4 w-4 mr-1" />ยกเลิก
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : filteredOrders.length === 0 ? (
          <Card className="rounded-xl shadow-sm border">
            <CardContent className="py-12 text-center text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-sm" data-testid="text-empty-state">ไม่พบออเดอร์ที่พร้อมจัดส่ง</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-xl shadow-sm border overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs">
                      <TableHead className="w-10 px-2">
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={toggleAll}
                          data-testid="checkbox-select-all"
                        />
                      </TableHead>
                      <TableHead className="text-xs">เลขออเดอร์</TableHead>
                      <TableHead className="text-xs">แพลตฟอร์ม</TableHead>
                      <TableHead className="text-xs">ผู้รับ</TableHead>
                      <TableHead className="text-xs">ที่อยู่จัดส่ง</TableHead>
                      <TableHead className="text-xs">เบอร์โทร</TableHead>
                      <TableHead className="text-xs">สถานะ</TableHead>
                      <TableHead className="text-xs">เลข tracking</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map(order => (
                      <TableRow
                        key={order.id}
                        className={`text-sm ${selectedIds.has(order.id) ? "bg-blue-50/50" : ""}`}
                        data-testid={`row-order-${order.id}`}
                      >
                        <TableCell className="px-2">
                          <Checkbox
                            checked={selectedIds.has(order.id)}
                            onCheckedChange={() => toggleSelect(order.id)}
                            data-testid={`checkbox-order-${order.id}`}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-xs" data-testid={`text-order-no-${order.id}`}>
                          {order.orderNo || order.platformOrderId}
                        </TableCell>
                        <TableCell data-testid={`text-platform-${order.id}`}>
                          {platformBadge(order.platform)}
                        </TableCell>
                        <TableCell className="text-xs" data-testid={`text-buyer-${order.id}`}>
                          {order.buyerName || "-"}
                        </TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate" data-testid={`text-address-${order.id}`}>
                          {order.buyerAddress || "-"}
                        </TableCell>
                        <TableCell className="text-xs" data-testid={`text-phone-${order.id}`}>
                          {order.buyerPhone || "-"}
                        </TableCell>
                        <TableCell data-testid={`text-status-${order.id}`}>
                          {statusBadge(order.status)}
                        </TableCell>
                        <TableCell className="font-mono text-xs" data-testid={`text-tracking-${order.id}`}>
                          {order.trackingNo || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {showPreview && selectedOrders.length > 0 && (
          <Card className="rounded-xl shadow-sm border overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-800" data-testid="text-preview-title">ตัวอย่างใบปะหน้าพัสดุ</h2>
                <div className="flex gap-2">
                  <Button size="sm" onClick={doPrint} className="bg-[#fb9678] hover:bg-[#e8856a] text-white" data-testid="button-do-print">
                    <Printer className="h-4 w-4 mr-1" />พิมพ์
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowPreview(false)} data-testid="button-close-preview">
                    ปิด
                  </Button>
                </div>
              </div>
              <div ref={printRef} className="flex flex-wrap gap-4 justify-center" data-testid="print-preview-area">
                {selectedOrders.map(order => {
                  const p = PLATFORMS.find(pl => pl.value === order.platform);
                  const trackingDisplay = order.trackingNo || "PENDING";
                  const codAmount = order.paymentMethod === "cod" ? Number(order.totalAmount || 0) : 0;
                  return (
                    <div key={order.id} className="label border-2 border-black p-4 w-[400px] bg-white" data-testid={`label-${order.id}`}>
                      <div className="text-center text-xl font-bold border-b-2 border-black pb-2 mb-3">
                        {carrierLabel}
                      </div>

                      <div className="mb-3">
                        <div className="text-[11px] font-bold text-gray-500 mb-1">ผู้ส่ง / SENDER</div>
                        <div className="text-sm font-bold">{selectedCompany?.name || "บริษัท"}</div>
                        <div className="text-xs text-gray-600">{selectedCompany?.address || "ที่อยู่บริษัท"}</div>
                      </div>

                      <div className="mb-3 p-2 bg-gray-50 border border-gray-200 rounded">
                        <div className="text-[11px] font-bold text-gray-500 mb-1">ผู้รับ / RECIPIENT</div>
                        <div className="text-base font-bold">{order.buyerName || "-"}</div>
                        <div className="text-xs leading-relaxed">{order.buyerAddress || "-"}</div>
                        <div className="text-xs font-medium mt-1">โทร: {order.buyerPhone || "-"}</div>
                      </div>

                      <div className="text-center py-3">
                        <div className="font-mono text-3xl tracking-[6px]">|||||||||||||||</div>
                        <div className="text-sm font-bold mt-1">{trackingDisplay}</div>
                      </div>

                      <div className="flex justify-between text-[11px] border-t border-dashed border-gray-400 pt-2 mt-2">
                        <div>
                          <span className="text-gray-500">Order: </span>
                          <span className="font-medium">{order.orderNo || order.platformOrderId}</span>
                        </div>
                        <div
                          className="px-2 py-0.5 rounded text-white text-[10px] font-bold"
                          style={{ backgroundColor: p?.hex || "#666" }}
                        >
                          {p?.label || order.platform}
                        </div>
                      </div>

                      <div className="flex justify-between text-[11px] mt-2">
                        {codAmount > 0 && (
                          <div className="font-bold text-red-600">
                            COD: ฿{codAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                          </div>
                        )}
                        {order.shippingFee && Number(order.shippingFee) > 0 && (
                          <div className="text-gray-500">
                            น้ำหนัก: - กก.
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DeliveryLayout>
  );
}
