import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import Layout from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/format";
import { useDateSettings } from "@/hooks/use-date-settings";
import {
  Truck, MapPin, PenTool, ClipboardCheck, Search, Package,
  FileText, ShoppingBag, ArrowRight, ExternalLink, CheckCircle2
} from "lucide-react";

function SignaturePad({ onSave, onCancel }: { onSave: (dataUrl: string) => void; onCancel: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    isDrawing.current = true;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };
  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.lineTo(getPos(e).x, getPos(e).y);
    ctx.stroke();
  };
  const endDraw = () => { isDrawing.current = false; };
  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">กรุณาลงลายเซ็นในกรอบด้านล่าง</p>
      <div className="border-2 border-dashed border-gray-300 rounded-lg overflow-hidden" style={{ touchAction: "none" }}>
        <canvas ref={canvasRef} width={400} height={200} className="w-full cursor-crosshair bg-white"
          onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
          onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw} />
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={clear} data-testid="btn-clear-sig">ล้าง</Button>
        <Button variant="outline" size="sm" onClick={onCancel}>ยกเลิก</Button>
        <Button size="sm" className="bg-green-600 hover:bg-green-700" data-testid="btn-save-sig"
          onClick={() => { const data = canvasRef.current?.toDataURL("image/png"); if (data) onSave(data); }}>
          <PenTool className="h-3 w-3 mr-1" /> ยืนยันลายเซ็น
        </Button>
      </div>
    </div>
  );
}

function useGps() {
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestGps = useCallback(() => {
    if (!navigator.geolocation) { setError("เบราว์เซอร์ไม่รองรับ GPS"); return; }
    setLoading(true); setError(null); setGps(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLoading(false); },
      (err) => { setError("ไม่สามารถดึงตำแหน่งได้: " + err.message); setLoading(false); },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }, []);
  return { gps, loading, error, requestGps };
}

const MODULE_ICON: Record<string, any> = {
  accounting: FileText,
  pos: Package,
  ecommerce: ShoppingBag,
};
const MODULE_LABEL: Record<string, string> = {
  accounting: "บัญชี",
  pos: "POS/คลัง",
  ecommerce: "อีคอมเมิร์ซ",
};
const MODULE_COLOR: Record<string, string> = {
  accounting: "bg-blue-100 text-blue-700",
  pos: "bg-amber-100 text-amber-700",
  ecommerce: "bg-purple-100 text-purple-700",
};

function statusBadge(status: string) {
  switch (status) {
    case "delivered": return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">รับแล้ว ✓</Badge>;
    case "shipped": case "shipping": case "delivering": return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">กำลังจัดส่ง</Badge>;
    case "approved": case "confirmed": return <Badge className="bg-cyan-100 text-cyan-700 hover:bg-cyan-100">พร้อมจัดส่ง</Badge>;
    case "draft": return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">ร่าง</Badge>;
    default: return <Badge variant="outline">{status}</Badge>;
  }
}

export default function DeliveryHub() {
  const { selectedCompanyId } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { dateEra, dateFmt } = useDateSettings();
  const [tab, setTab] = useState("pending");
  const [search, setSearch] = useState("");
  const [confirmItem, setConfirmItem] = useState<any>(null);
  const [receiverName, setReceiverName] = useState("");
  const [detailItem, setDetailItem] = useState<any>(null);
  const gps = useGps();

  const { data: deliveries = [], isLoading } = useQuery({
    queryKey: ["/api/delivery-hub", selectedCompanyId, tab],
    queryFn: async () => {
      const status = tab === "all" ? "all" : tab;
      const r = await fetch(`/api/delivery-hub?companyId=${selectedCompanyId}&status=${status}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const confirmStockTransfer = useMutation({
    mutationFn: async ({ id, lat, lng, signature, name }: any) => {
      const r = await fetch(`/api/inventory/stock-transfers/${id}/receive`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ lat, lng, signature, receiverName: name }),
      });
      if (!r.ok) { const err = await r.json(); throw new Error(err.message); }
      return r.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/delivery-hub"] }); setConfirmItem(null); toast({ title: "รับสินค้าสำเร็จ ✓" }); },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const confirmFulfillment = useMutation({
    mutationFn: async ({ id, lat, lng, signature, name }: any) => {
      const r = await fetch(`/api/fulfillment/items/${id}/deliver`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ lat, lng, signature, receiverName: name }),
      });
      if (!r.ok) { const err = await r.json(); throw new Error(err.message); }
      return r.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/delivery-hub"] }); setConfirmItem(null); toast({ title: "รับสินค้าสำเร็จ ✓" }); },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const confirmDeliveryNote = useMutation({
    mutationFn: async ({ id, lat, lng, signature, name }: any) => {
      const r = await fetch(`/api/delivery-notes/${id}/sign`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ lat, lng, signatureDataUrl: signature, signedByName: name }),
      });
      if (!r.ok) { const err = await r.json(); throw new Error(err.message); }
      return r.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/delivery-hub"] }); setConfirmItem(null); toast({ title: "รับสินค้าสำเร็จ ✓" }); },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  function handleConfirm(sig: string) {
    if (!confirmItem) return;
    const data = { id: confirmItem.id, lat: gps.gps?.lat, lng: gps.gps?.lng, signature: sig, name: receiverName };
    if (confirmItem.type === "stock_transfer") confirmStockTransfer.mutate(data);
    else if (confirmItem.type === "fulfillment") confirmFulfillment.mutate(data);
    else if (confirmItem.type === "delivery_note") confirmDeliveryNote.mutate(data);
  }

  const filtered = deliveries.filter((d: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (d.docNo || "").toLowerCase().includes(s) || (d.to || "").toLowerCase().includes(s) || (d.from || "").toLowerCase().includes(s);
  });

  const pendingCount = deliveries.filter((d: any) => !["delivered"].includes(d.status)).length;
  const deliveredCount = deliveries.filter((d: any) => d.status === "delivered").length;

  const canConfirm = (d: any) => {
    if (d.type === "stock_transfer" && d.status === "shipped") return true;
    if (d.type === "fulfillment" && d.status === "shipped") return true;
    if (d.type === "delivery_note" && ["confirmed", "delivering"].includes(d.status)) return true;
    return false;
  };

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Truck className="h-5 w-5 text-primary" />
            <div>
              <h1 data-testid="text-page-title" className="text-xl font-heading font-bold">ศูนย์จัดส่ง & รับสินค้า</h1>
              <p className="text-sm text-muted-foreground">รวมทุกการจัดส่งจาก บัญชี / POS / อีคอมเมิร์ซ — GPS + ลายเซ็นรับ</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <div data-testid="text-total" className="text-2xl font-bold text-primary">{deliveries.length}</div>
              <div className="text-xs text-muted-foreground">ทั้งหมด</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <div className="text-2xl font-bold text-blue-600">{pendingCount}</div>
              <div className="text-xs text-muted-foreground">รอจัดส่ง/รับ</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <div className="text-2xl font-bold" style={{ color: "#05b187" }}>{deliveredCount}</div>
              <div className="text-xs text-muted-foreground">รับแล้ว</div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="pending" data-testid="tab-pending">รอดำเนินการ</TabsTrigger>
              <TabsTrigger value="delivered" data-testid="tab-delivered">รับแล้ว</TabsTrigger>
              <TabsTrigger value="all" data-testid="tab-all">ทั้งหมด</TabsTrigger>
            </TabsList>
            <div className="relative w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหาเลขที่/ชื่อ..."
                className="pl-10 h-9" data-testid="input-search" />
            </div>
          </div>

          <TabsContent value={tab} className="mt-4">
            <Card>
              <CardContent className="p-0">
                {filtered.length === 0 ? (
                  <div className="text-center py-12">
                    <Truck className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground">ไม่มีรายการจัดส่ง</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-24">โมดูล</TableHead>
                        <TableHead className="w-32">เลขที่</TableHead>
                        <TableHead>จาก</TableHead>
                        <TableHead className="w-8"></TableHead>
                        <TableHead>ถึง</TableHead>
                        <TableHead className="w-24">สถานะ</TableHead>
                        <TableHead className="w-16 text-center">GPS</TableHead>
                        <TableHead className="w-16 text-center">เซ็น</TableHead>
                        <TableHead className="w-28 text-right">จัดการ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((d: any, idx: number) => {
                        const Icon = MODULE_ICON[d.module] || Package;
                        return (
                          <TableRow key={`${d.type}-${d.id}`} data-testid={`row-delivery-${idx}`}>
                            <TableCell>
                              <Badge className={`${MODULE_COLOR[d.module]} text-xs hover:opacity-80`}>
                                <Icon className="h-3 w-3 mr-1" />{MODULE_LABEL[d.module]}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono text-sm">{d.docNo}</TableCell>
                            <TableCell className="text-sm">{d.from}</TableCell>
                            <TableCell><ArrowRight className="h-3 w-3 text-muted-foreground" /></TableCell>
                            <TableCell className="text-sm">{d.to}</TableCell>
                            <TableCell>{statusBadge(d.status)}</TableCell>
                            <TableCell className="text-center">
                              {d.hasGps ? <MapPin className="h-4 w-4 text-blue-500 mx-auto" /> : <span className="text-xs text-muted-foreground">-</span>}
                            </TableCell>
                            <TableCell className="text-center">
                              {d.hasSignature ? <PenTool className="h-4 w-4 text-green-500 mx-auto" /> : <span className="text-xs text-muted-foreground">-</span>}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                {d.hasGps && d.gpsLat && (
                                  <a href={`https://www.google.com/maps?q=${d.gpsLat},${d.gpsLng}`} target="_blank" rel="noopener noreferrer">
                                    <Button variant="ghost" size="sm" data-testid={`btn-map-${idx}`}>
                                      <ExternalLink className="h-3 w-3" />
                                    </Button>
                                  </a>
                                )}
                                {d.hasSignature && (
                                  <Button variant="ghost" size="sm" onClick={() => setDetailItem(d)} data-testid={`btn-detail-${idx}`}>
                                    <PenTool className="h-3 w-3" />
                                  </Button>
                                )}
                                {canConfirm(d) && (
                                  <Button size="sm" className="bg-green-600 hover:bg-green-700 h-7 text-xs gap-1"
                                    onClick={() => { setConfirmItem(d); setReceiverName(""); gps.requestGps(); }}
                                    data-testid={`btn-confirm-${idx}`}>
                                    <ClipboardCheck className="h-3 w-3" /> รับของ
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Confirm Delivery Dialog */}
      <Dialog open={confirmItem !== null} onOpenChange={(open) => { if (!open) setConfirmItem(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" data-testid="dialog-confirm-delivery">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-green-600" />
              ยืนยันรับสินค้า — {confirmItem?.docNo}
            </DialogTitle>
          </DialogHeader>
          {confirmItem && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
                <div><span className="text-muted-foreground">โมดูล:</span> <Badge className={`${MODULE_COLOR[confirmItem.module]} text-xs ml-1`}>{MODULE_LABEL[confirmItem.module]}</Badge></div>
                <div><span className="text-muted-foreground">จาก:</span> <span className="ml-1 font-medium">{confirmItem.from}</span></div>
                <div><span className="text-muted-foreground">ถึง:</span> <span className="ml-1 font-medium">{confirmItem.to}</span></div>
                {confirmItem.address && <div><span className="text-muted-foreground">ที่อยู่:</span> <span className="ml-1">{confirmItem.address}</span></div>}
                {confirmItem.trackingNo && <div><span className="text-muted-foreground">เลขพัสดุ:</span> <span className="ml-1 font-mono">{confirmItem.trackingNo}</span></div>}
              </div>

              <div className="bg-blue-50 rounded-lg p-3">
                {gps.loading ? (
                  <div className="text-sm text-blue-600 flex items-center gap-2"><MapPin className="h-4 w-4 animate-pulse" /> กำลังดึงตำแหน่ง GPS...</div>
                ) : gps.gps ? (
                  <div className="text-sm text-blue-700">
                    <div className="flex items-center gap-1 font-medium"><MapPin className="h-4 w-4" /> ตำแหน่งรับสินค้า</div>
                    <div className="mt-1 font-mono text-xs">{gps.gps.lat.toFixed(6)}, {gps.gps.lng.toFixed(6)}</div>
                  </div>
                ) : gps.error ? (
                  <div className="text-sm text-amber-600">{gps.error}</div>
                ) : (
                  <Button variant="outline" size="sm" onClick={gps.requestGps}><MapPin className="h-4 w-4 mr-1" /> ดึงตำแหน่ง GPS</Button>
                )}
              </div>

              <div>
                <label className="text-sm font-medium">ชื่อผู้รับสินค้า</label>
                <Input value={receiverName} onChange={(e) => setReceiverName(e.target.value)}
                  placeholder="ระบุชื่อผู้รับ" data-testid="input-receiver-name" className="mt-1" />
              </div>

              <div>
                <label className="text-sm font-medium">ลายเซ็นผู้รับสินค้า *</label>
                <SignaturePad onCancel={() => setConfirmItem(null)} onSave={(sig) => handleConfirm(sig)} />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Detail Dialog (View Signature/GPS) */}
      <Dialog open={detailItem !== null} onOpenChange={(open) => { if (!open) setDetailItem(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto" data-testid="dialog-detail">
          <DialogHeader>
            <DialogTitle>หลักฐานการรับ — {detailItem?.docNo}</DialogTitle>
          </DialogHeader>
          {detailItem && (
            <div className="space-y-4">
              {detailItem.gpsLat && (
                <div className="bg-blue-50 rounded-lg p-3">
                  <div className="text-sm font-medium text-blue-800 flex items-center gap-1 mb-1"><MapPin className="h-4 w-4" /> ตำแหน่ง GPS</div>
                  <div className="text-xs text-blue-700 font-mono">{Number(detailItem.gpsLat).toFixed(5)}, {Number(detailItem.gpsLng).toFixed(5)}</div>
                  <a href={`https://www.google.com/maps?q=${detailItem.gpsLat},${detailItem.gpsLng}`}
                    target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline mt-1 inline-block">ดูบน Google Maps</a>
                </div>
              )}
              {detailItem.signature && (
                <div className="bg-green-50 rounded-lg p-3">
                  <div className="text-sm font-medium text-green-800 flex items-center gap-1 mb-2"><PenTool className="h-4 w-4" /> ลายเซ็นผู้รับ</div>
                  {detailItem.receiverName && <div className="text-xs text-green-700 mb-1">ชื่อผู้รับ: {detailItem.receiverName}</div>}
                  <img src={detailItem.signature} alt="ลายเซ็นผู้รับ" className="border rounded bg-white max-h-32" />
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
