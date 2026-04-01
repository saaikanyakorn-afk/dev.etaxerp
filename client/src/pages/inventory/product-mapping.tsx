import Layout from "@/components/layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, ArrowRightLeft, Package, History, ArrowUpDown, RefreshCw } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { formatDate } from "@/lib/format";
import type { Product } from "@shared/schema";
import { useDateSettings } from "@/hooks/use-date-settings";

const MOVEMENT_TYPES = [
  { value: "purchase_in", label: "รับซื้อ" },
  { value: "sale_deduct", label: "ขายออก" },
  { value: "adjustment_in", label: "ปรับเพิ่ม" },
  { value: "adjustment_out", label: "ปรับลด" },
  { value: "return_in", label: "รับคืน" },
];

export default function ProductMapping() {
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
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [adjustProductId, setAdjustProductId] = useState<number | null>(null);
  const [adjustForm, setAdjustForm] = useState({ movementType: "purchase_in", quantity: "", notes: "" });

  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historyProductId, setHistoryProductId] = useState<number | null>(null);

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/products?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const { data: mappings = [], isLoading: mappingsLoading } = useQuery<any[]>({
    queryKey: ["/api/product-mappings", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/product-mappings?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const { data: stockData = [], isLoading: stockLoading } = useQuery<any[]>({
    queryKey: ["/api/product-stock", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/product-stock?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const { data: movements = [] } = useQuery<any[]>({
    queryKey: ["/api/stock-movements", selectedCompanyId, historyProductId],
    queryFn: async () => {
      const r = await fetch(`/api/stock-movements?companyId=${selectedCompanyId}&productId=${historyProductId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId && !!historyProductId && historyDialogOpen,
  });

  const recalcMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/inventory/recalculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ companyId: selectedCompanyId, type: "mapping" }),
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/product-stock"] });
      const r = data.result;
      toast({ title: "คำนวณสต็อกย้อนหลังสำเร็จ", description: `ลบ ${r.deleted} รายการเก่า, สร้าง ${r.created} รายการใหม่`, variant: "success" as any });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const deleteMapping = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/product-mappings/${id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/product-mappings"] }); toast({ title: "ลบการเชื่อมโยงสำเร็จ", variant: "success" as any }); },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const adjustStock = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch("/api/product-stock/adjust", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ ...data, companyId: selectedCompanyId }) });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/product-stock"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stock-movements"] });
      toast({ title: "ปรับสต๊อกสำเร็จ", variant: "success" as any });
      setAdjustDialogOpen(false);
      setAdjustForm({ movementType: "purchase_in", quantity: "", notes: "" });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  function handleAdjustStock(productId: number) {
    setAdjustProductId(productId);
    setAdjustForm({ movementType: "purchase_in", quantity: "", notes: "" });
    setAdjustDialogOpen(true);
  }

  function handleSubmitAdjust() {
    if (!adjustForm.quantity || Number(adjustForm.quantity) <= 0) {
      toast({ title: "กรุณากรอกจำนวน", variant: "destructive" });
      return;
    }
    adjustStock.mutate({ productId: adjustProductId, movementType: adjustForm.movementType, quantity: adjustForm.quantity, notes: adjustForm.notes });
  }

  function handleShowHistory(productId: number) {
    setHistoryProductId(productId);
    setHistoryDialogOpen(true);
  }

  const productName = (id: number) => products.find(p => p.id === id)?.name || "-";

  const stockBadge = (qty: number) => {
    if (qty <= 0) return <Badge data-testid="badge-stock-red" className="bg-red-100 text-red-700 hover:bg-red-100">หมด</Badge>;
    if (qty < 10) return <Badge data-testid="badge-stock-amber" className="bg-amber-100 text-amber-700 hover:bg-amber-100">เหลือน้อย</Badge>;
    return <Badge data-testid="badge-stock-green" className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">ปกติ</Badge>;
  };

  return (
    <Layout>
      <div className="space-y-6" data-testid="page-product-mapping">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">เชื่อมโยงสินค้า & สต๊อก</h1>
            <p className="text-muted-foreground text-sm">จัดการการเชื่อมโยงสินค้าซื้อ-ขายและสต๊อกสินค้า</p>
          </div>
          <Button
            variant="outline"
            data-testid="button-recalc-mapping"
            onClick={() => { if (confirm("คำนวณสต็อกย้อนหลังจากการเชื่อมโยง (Mapping) ทั้งหมด?")) recalcMutation.mutate(); }}
            disabled={recalcMutation.isPending}
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${recalcMutation.isPending ? "animate-spin" : ""}`} />
            {recalcMutation.isPending ? "กำลังคำนวณ..." : "คำนวณสต็อกย้อนหลัง"}
          </Button>
        </div>

        <Tabs defaultValue="mapping" data-testid="tabs-main">
          <TabsList data-testid="tabs-list">
            <TabsTrigger value="mapping" data-testid="tab-mapping"><ArrowRightLeft className="h-4 w-4 mr-1.5" />เชื่อมโยงสินค้า</TabsTrigger>
            <TabsTrigger value="stock" data-testid="tab-stock"><Package className="h-4 w-4 mr-1.5" />สต๊อกสินค้า</TabsTrigger>
          </TabsList>

          <TabsContent value="mapping">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-4">
                <h2 className="text-lg font-semibold" data-testid="text-mapping-title">รายการเชื่อมโยงสินค้า</h2>
                <Button onClick={() => navigate("/inventory/product-mapping/new")} data-testid="button-add-mapping"><Plus className="h-4 w-4 mr-1" />เพิ่มการเชื่อมโยง</Button>
              </CardHeader>
              <CardContent>
                {mappingsLoading ? (
                  <p className="text-center py-8 text-muted-foreground">กำลังโหลด...</p>
                ) : mappings.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground" data-testid="text-no-mappings">ยังไม่มีการเชื่อมโยงสินค้า</p>
                ) : (
                  <Table data-testid="table-mappings">
                    <TableHeader>
                      <TableRow>
                        <TableHead>สินค้าขาย</TableHead>
                        <TableHead>สินค้าซื้อ (ตัดสต๊อก)</TableHead>
                        <TableHead>อัตราแปลง</TableHead>
                        <TableHead>หน่วยขาย</TableHead>
                        <TableHead>หน่วยซื้อ</TableHead>
                        <TableHead>หมายเหตุ</TableHead>
                        <TableHead className="w-24">จัดการ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mappings.map((m: any) => (
                        <TableRow key={m.id} data-testid={`row-mapping-${m.id}`}>
                          <TableCell className="font-medium">{productName(m.sellProductId)}</TableCell>
                          <TableCell>{productName(m.buyProductId)}</TableCell>
                          <TableCell>{m.conversionRate}</TableCell>
                          <TableCell>{m.sellUnit}</TableCell>
                          <TableCell>{m.buyUnit}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{m.notes || "-"}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" onClick={() => navigate(`/inventory/product-mapping/edit/${m.id}`)} data-testid={`button-edit-mapping-${m.id}`}><Pencil className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => { if (confirm("ต้องการลบการเชื่อมโยงนี้?")) deleteMapping.mutate(m.id); }} data-testid={`button-delete-mapping-${m.id}`}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stock">
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold" data-testid="text-stock-title">สต๊อกสินค้าปัจจุบัน</h2>
              </CardHeader>
              <CardContent>
                {stockLoading ? (
                  <p className="text-center py-8 text-muted-foreground">กำลังโหลด...</p>
                ) : stockData.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground" data-testid="text-no-stock">ยังไม่มีข้อมูลสต๊อก</p>
                ) : (
                  <Table data-testid="table-stock">
                    <TableHeader>
                      <TableRow>
                        <TableHead>รหัสสินค้า</TableHead>
                        <TableHead>ชื่อสินค้า</TableHead>
                        <TableHead className="text-right">คงเหลือ</TableHead>
                        <TableHead className="text-right">จอง</TableHead>
                        <TableHead className="text-right">พร้อมใช้</TableHead>
                        <TableHead>สถานะ</TableHead>
                        <TableHead className="w-32">จัดการ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stockData.map((s: any) => {
                        const available = Number(s.quantity || 0) - Number(s.reserved || 0);
                        return (
                          <TableRow key={s.productId} data-testid={`row-stock-${s.productId}`}>
                            <TableCell className="text-sm">{s.productCode || "-"}</TableCell>
                            <TableCell className="font-medium">{s.productName}</TableCell>
                            <TableCell className="text-right">{Number(s.quantity || 0).toLocaleString("th-TH")}</TableCell>
                            <TableCell className="text-right">{Number(s.reserved || 0).toLocaleString("th-TH")}</TableCell>
                            <TableCell className="text-right font-medium">{available.toLocaleString("th-TH")}</TableCell>
                            <TableCell>{stockBadge(Number(s.quantity || 0))}</TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button variant="outline" size="sm" onClick={() => handleAdjustStock(s.productId)} data-testid={`button-adjust-stock-${s.productId}`}><ArrowUpDown className="h-3.5 w-3.5 mr-1" />ปรับสต๊อก</Button>
                                <Button variant="ghost" size="icon" onClick={() => handleShowHistory(s.productId)} data-testid={`button-history-${s.productId}`}><History className="h-4 w-4" /></Button>
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

        <Dialog open={adjustDialogOpen} onOpenChange={setAdjustDialogOpen}>
          <DialogContent className="max-w-md" data-testid="dialog-adjust-stock">
            <DialogHeader>
              <DialogTitle>ปรับสต๊อกสินค้า</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                สินค้า: <span className="font-medium text-foreground">{adjustProductId ? productName(adjustProductId) : "-"}</span>
              </div>
              <div>
                <Label>ประเภทการเคลื่อนไหว</Label>
                <Select value={adjustForm.movementType} onValueChange={v => setAdjustForm(f => ({ ...f, movementType: v }))}>
                  <SelectTrigger data-testid="select-movement-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MOVEMENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>จำนวน</Label>
                <Input type="number" min="0" step="1" value={adjustForm.quantity} onChange={e => setAdjustForm(f => ({ ...f, quantity: e.target.value }))} placeholder="กรอกจำนวน" data-testid="input-adjust-quantity" />
              </div>
              <div>
                <Label>หมายเหตุ</Label>
                <Textarea value={adjustForm.notes} onChange={e => setAdjustForm(f => ({ ...f, notes: e.target.value }))} placeholder="หมายเหตุ (ถ้ามี)" data-testid="input-adjust-notes" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setAdjustDialogOpen(false)} data-testid="button-cancel-adjust">ยกเลิก</Button>
                <Button onClick={handleSubmitAdjust} disabled={adjustStock.isPending} data-testid="button-save-adjust">บันทึก</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
          <DialogContent className="max-w-2xl" data-testid="dialog-stock-history">
            <DialogHeader>
              <DialogTitle>ประวัติการเคลื่อนไหวสต๊อก</DialogTitle>
            </DialogHeader>
            <div className="text-sm text-muted-foreground mb-3">
              สินค้า: <span className="font-medium text-foreground">{historyProductId ? productName(historyProductId) : "-"}</span>
            </div>
            {movements.length === 0 ? (
              <p className="text-center py-6 text-muted-foreground" data-testid="text-no-history">ยังไม่มีประวัติการเคลื่อนไหว</p>
            ) : (
              <div className="max-h-80 overflow-y-auto">
                <Table data-testid="table-stock-history">
                  <TableHeader>
                    <TableRow>
                      <TableHead>วันที่</TableHead>
                      <TableHead>ประเภท</TableHead>
                      <TableHead className="text-right">จำนวน</TableHead>
                      <TableHead>หมายเหตุ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movements.map((mv: any, idx: number) => (
                      <TableRow key={mv.id || idx} data-testid={`row-movement-${mv.id || idx}`}>
                        <TableCell className="text-sm">{mv.createdAt ? formatDate(mv.createdAt, dateEra, dateFmt) : "-"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" data-testid={`badge-movement-type-${mv.id || idx}`}>
                            {MOVEMENT_TYPES.find(t => t.value === mv.movementType)?.label || mv.movementType}
                          </Badge>
                        </TableCell>
                        <TableCell className={`text-right font-medium ${["sale_deduct", "adjustment_out"].includes(mv.movementType) ? "text-red-600" : "text-emerald-600"}`}>
                          {["sale_deduct", "adjustment_out"].includes(mv.movementType) ? "-" : "+"}{Number(mv.quantity).toLocaleString("th-TH")}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{mv.notes || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}