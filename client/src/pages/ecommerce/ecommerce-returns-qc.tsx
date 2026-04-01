import EcommerceLayout from "@/components/ecommerce-layout";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ClipboardCheck, ArrowLeft, Loader2, Check, Package, AlertTriangle, CheckCircle2, XCircle, Wrench } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const QC_CONDITIONS = [
  { value: "normal", label: "ปกติ — สมบูรณ์ พร้อมขาย", color: "text-green-600", bg: "bg-green-50 border-green-200", icon: <CheckCircle2 className="h-8 w-8 text-green-500" />, disposition: "restock", zone: "ready_for_sale" },
  { value: "minor_damage", label: "ชำรุดเล็กน้อย — ส่งซ่อมได้", color: "text-yellow-600", bg: "bg-yellow-50 border-yellow-200", icon: <AlertTriangle className="h-8 w-8 text-yellow-500" />, disposition: "repair", zone: "damaged" },
  { value: "major_damage", label: "ชำรุดมาก — ต้องซ่อมใหญ่", color: "text-orange-600", bg: "bg-orange-50 border-orange-200", icon: <Wrench className="h-8 w-8 text-orange-500" />, disposition: "repair", zone: "damaged" },
  { value: "unsellable", label: "ขายต่อไม่ได้ — ตัดจำหน่าย", color: "text-red-600", bg: "bg-red-50 border-red-200", icon: <XCircle className="h-8 w-8 text-red-500" />, disposition: "writeoff", zone: "damaged" },
];

const ZONE_LABELS: Record<string, { label: string; color: string }> = {
  receiving: { label: "โซนรับคืน", color: "bg-blue-100 text-blue-700" },
  qc: { label: "โซน QC", color: "bg-yellow-100 text-yellow-700" },
  ready_for_sale: { label: "พร้อมขาย", color: "bg-green-100 text-green-700" },
  damaged: { label: "โซนชำรุด", color: "bg-red-100 text-red-700" },
};

export default function EcommerceReturnsQC() {
  const { selectedCompanyId } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const [qcDialogOpen, setQcDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [qcCondition, setQcCondition] = useState("");
  const [qcNotes, setQcNotes] = useState("");
  const [overrideDisposition, setOverrideDisposition] = useState("");

  const { data: pendingItems, isLoading } = useQuery<any[]>({
    queryKey: ["/api/ecommerce/returns/qc-pending", selectedCompanyId],
    queryFn: async () => {
      const res = await fetch(`/api/ecommerce/returns/qc-pending?companyId=${selectedCompanyId}`);
      return res.json();
    },
    enabled: !!selectedCompanyId,
  });

  const { data: zoneSummary } = useQuery<Record<string, any>>({
    queryKey: ["/api/ecommerce/returns/zone-summary", selectedCompanyId],
    queryFn: async () => {
      const res = await fetch(`/api/ecommerce/returns/zone-summary?companyId=${selectedCompanyId}`);
      return res.json();
    },
    enabled: !!selectedCompanyId,
  });

  const qcMutation = useMutation({
    mutationFn: async ({ itemId, data }: { itemId: number; data: any }) => {
      const res = await fetch(`/api/ecommerce/returns/items/${itemId}/qc`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "ตรวจสอบ QC สำเร็จ" });
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/returns/qc-pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/returns/zone-summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/returns/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/returns"] });
      setQcDialogOpen(false);
      setSelectedItem(null);
      setQcCondition("");
      setQcNotes("");
      setOverrideDisposition("");
    },
    onError: (err: any) => toast({ title: err.message, variant: "destructive" }),
  });

  const openQcDialog = (item: any) => {
    setSelectedItem(item);
    setQcCondition("");
    setQcNotes("");
    setOverrideDisposition("");
    setQcDialogOpen(true);
  };

  const handleQcSubmit = () => {
    if (!selectedItem || !qcCondition) {
      toast({ title: "กรุณาเลือกสภาพสินค้า", variant: "destructive" });
      return;
    }
    const selected = QC_CONDITIONS.find(c => c.value === qcCondition);
    qcMutation.mutate({
      itemId: selectedItem.item.id,
      data: {
        qcCondition,
        qcNotes,
        disposition: overrideDisposition || selected?.disposition,
        zone: overrideDisposition
          ? (overrideDisposition === "restock" ? "ready_for_sale" : "damaged")
          : selected?.zone,
      },
    });
  };

  const zoneKeys = ["receiving", "qc", "ready_for_sale", "damaged"];
  const totalZoneItems = zoneKeys.reduce((s, k) => s + (zoneSummary?.[k]?.items || 0), 0);

  return (
    <EcommerceLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => navigate("/ecommerce/returns")} data-testid="button-back">
                <ArrowLeft className="h-4 w-4 mr-1" />กลับ
              </Button>
              <ClipboardCheck className="h-6 w-6" style={{ color: "#03c9d7" }} />
              <h1 className="text-2xl font-bold text-gray-800" data-testid="text-qc-title">ตรวจสอบคุณภาพ (QC)</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1 ml-10">ตรวจสอบสภาพสินค้าคืน กำหนด disposition และย้ายโซน</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {zoneKeys.map(z => {
            const zInfo = ZONE_LABELS[z];
            const data = zoneSummary?.[z];
            return (
              <Card key={z} className="rounded-xl shadow-sm border" data-testid={`card-zone-${z}`}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <Badge className={`text-[10px] ${zInfo.color}`}>{zInfo.label}</Badge>
                    <span className="text-lg font-bold text-gray-800">{data?.items || 0}</span>
                  </div>
                  <div className="text-[10px] text-gray-500 mt-1">
                    {data?.pendingQc || 0} รอ QC | {data?.completedQc || 0} QC แล้ว
                  </div>
                  {totalZoneItems > 0 && (
                    <div className="w-full h-1.5 bg-gray-100 rounded-full mt-2 overflow-hidden">
                      <div className="h-full rounded-full" style={{
                        width: `${((data?.items || 0) / totalZoneItems) * 100}%`,
                        background: z === "receiving" ? "#539BFF" : z === "qc" ? "#fec90f" : z === "ready_for_sale" ? "#05b187" : "#f94d4d",
                      }} />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="rounded-xl shadow-sm border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Package className="h-4 w-4" style={{ color: "#03c9d7" }} />
              สินค้ารอตรวจ QC ({pendingItems?.length || 0} รายการ)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
            ) : !pendingItems || pendingItems.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-300" />
                ไม่มีสินค้ารอตรวจ QC
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="text-xs w-8 text-center">#</TableHead>
                    <TableHead className="text-xs">เลขที่คืน</TableHead>
                    <TableHead className="text-xs">แพลตฟอร์ม</TableHead>
                    <TableHead className="text-xs">สินค้า</TableHead>
                    <TableHead className="text-xs">SKU</TableHead>
                    <TableHead className="text-xs text-center">จำนวน</TableHead>
                    <TableHead className="text-xs">สภาพที่รับ</TableHead>
                    <TableHead className="text-xs">โซน</TableHead>
                    <TableHead className="text-xs text-center">ดำเนินการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingItems.map((row: any, idx: number) => {
                    const item = row.item;
                    const zInfo = ZONE_LABELS[item.zone || "qc"];
                    return (
                      <TableRow key={item.id} data-testid={`row-qc-${item.id}`}>
                        <TableCell className="text-center text-xs text-gray-500">{idx + 1}</TableCell>
                        <TableCell className="text-sm font-medium" style={{ color: "#fb9678" }}>{row.returnNo}</TableCell>
                        <TableCell className="text-sm">{row.platform}</TableCell>
                        <TableCell>
                          <div className="text-sm font-medium">{item.productName}</div>
                          {row.buyerName && <div className="text-[10px] text-gray-400">ผู้ซื้อ: {row.buyerName}</div>}
                        </TableCell>
                        <TableCell className="text-xs text-gray-600">{item.sku || "-"}</TableCell>
                        <TableCell className="text-center text-sm">{Number(item.receivedQty || item.qty || 0)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">{item.receivedCondition || "-"}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={`text-[10px] ${zInfo?.color || "bg-gray-100 text-gray-700"}`}>{zInfo?.label || item.zone}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button size="sm" onClick={() => openQcDialog(row)} className="text-xs text-white" style={{ background: "#03c9d7" }} data-testid={`button-qc-${item.id}`}>
                            <ClipboardCheck className="h-3 w-3 mr-1" />ตรวจ QC
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={qcDialogOpen} onOpenChange={setQcDialogOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5" style={{ color: "#03c9d7" }} />
                ตรวจสอบคุณภาพ (QC)
              </DialogTitle>
            </DialogHeader>
            {selectedItem && (
              <div className="space-y-4 overflow-y-auto flex-1 pr-1">
                <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                  <div className="text-sm"><span className="text-gray-500">เลขที่คืน:</span> <span className="font-medium" style={{ color: "#fb9678" }}>{selectedItem.returnNo}</span></div>
                  <div className="text-sm"><span className="text-gray-500">สินค้า:</span> <span className="font-medium">{selectedItem.item.productName}</span></div>
                  <div className="text-sm"><span className="text-gray-500">SKU:</span> {selectedItem.item.sku || "-"}</div>
                  <div className="text-sm"><span className="text-gray-500">จำนวน:</span> {Number(selectedItem.item.receivedQty || selectedItem.item.qty || 0)} ชิ้น</div>
                  <div className="text-sm"><span className="text-gray-500">สภาพที่รับ:</span> {selectedItem.item.receivedCondition || "-"}</div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">ผลตรวจสอบสภาพ *</label>
                  <div className="grid grid-cols-1 gap-2">
                    {QC_CONDITIONS.map(c => (
                      <div
                        key={c.value}
                        onClick={() => setQcCondition(c.value)}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${qcCondition === c.value ? c.bg + " border-2 shadow-sm" : "hover:bg-gray-50"}`}
                        data-testid={`qc-option-${c.value}`}
                      >
                        {c.icon}
                        <div>
                          <div className={`text-sm font-medium ${c.color}`}>{c.label}</div>
                          <div className="text-[10px] text-gray-400">→ {c.disposition === "restock" ? "คืนสต็อก" : c.disposition === "repair" ? "ส่งซ่อม" : "ตัดจำหน่าย"} | {c.zone === "ready_for_sale" ? "โซนพร้อมขาย" : "โซนชำรุด"}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {qcCondition && (
                  <div>
                    <label className="text-sm font-medium mb-1 block">เปลี่ยน Disposition (ไม่บังคับ)</label>
                    <Select value={overrideDisposition} onValueChange={setOverrideDisposition}>
                      <SelectTrigger className="h-8 text-xs" data-testid="select-override-disposition">
                        <SelectValue placeholder="ใช้ค่าเริ่มต้น" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="restock">คืนสต็อก</SelectItem>
                        <SelectItem value="repair">ส่งซ่อม</SelectItem>
                        <SelectItem value="writeoff">ตัดจำหน่าย</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium mb-1 block">หมายเหตุ QC</label>
                  <Textarea
                    value={qcNotes}
                    onChange={e => setQcNotes(e.target.value)}
                    placeholder="บันทึกรายละเอียดเพิ่มเติม..."
                    rows={2}
                    className="text-sm"
                    data-testid="input-qc-notes"
                  />
                </div>

              </div>
            )}
            {selectedItem && (
              <div className="flex justify-end gap-2 pt-2 border-t flex-shrink-0">
                <Button variant="outline" onClick={() => setQcDialogOpen(false)}>ยกเลิก</Button>
                <Button
                  onClick={handleQcSubmit}
                  disabled={!qcCondition || qcMutation.isPending}
                  className="text-white"
                  style={{ background: "#03c9d7" }}
                  data-testid="button-submit-qc"
                >
                  {qcMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
                  บันทึกผล QC
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </EcommerceLayout>
  );
}
