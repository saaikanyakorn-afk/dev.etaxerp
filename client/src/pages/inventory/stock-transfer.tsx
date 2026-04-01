import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import Layout from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Plus, ArrowRight, ArrowLeft, Warehouse, Package, Search, CheckCircle2, Trash2, Send, Eye } from "lucide-react";
import { useDateSettings } from "@/hooks/use-date-settings";
import { formatDate } from "@/lib/format";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Product } from "@shared/schema";

export default function StockTransfer(props: { Wrapper?: React.ComponentType<{ children: React.ReactNode }> } & Record<string, any>) {
  const LayoutComponent = props.Wrapper || Layout;
  const { selectedCompanyId } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { dateEra, dateFmt } = useDateSettings();
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [approveId, setApproveId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [fromWarehouseId, setFromWarehouseId] = useState("");
  const [toWarehouseId, setToWarehouseId] = useState("");
  const [notes, setNotes] = useState("");
  const [transferItems, setTransferItems] = useState<any[]>([]);
  const [productSearch, setProductSearch] = useState("");

  const { data: warehouseList = [] } = useQuery({
    queryKey: ["/api/inventory/warehouses", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/inventory/warehouses?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const { data: transfers = [], isLoading } = useQuery({
    queryKey: ["/api/inventory/stock-transfers", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/inventory/stock-transfers?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/products?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const { data: fromStock = {} } = useQuery<Record<number, number>>({
    queryKey: ["/api/inventory/warehouse-stock", fromWarehouseId],
    queryFn: async () => {
      const r = await fetch(`/api/inventory/warehouse-stock/${fromWarehouseId}`, { credentials: "include" });
      if (!r.ok) return {};
      return r.json();
    },
    enabled: !!fromWarehouseId,
  });

  const { data: transferDetail } = useQuery({
    queryKey: ["/api/inventory/stock-transfers", detailId],
    queryFn: async () => {
      const r = await fetch(`/api/inventory/stock-transfers/${detailId}`, { credentials: "include" });
      if (!r.ok) return null;
      return r.json();
    },
    enabled: !!detailId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch("/api/inventory/stock-transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!r.ok) { const err = await r.json(); throw new Error(err.message); }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/stock-transfers"] });
      setCreateOpen(false);
      resetForm();
      toast({ title: "สร้างรายการโอนสินค้าสำเร็จ" });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/inventory/stock-transfers/${id}/approve`, { method: "PATCH", credentials: "include" });
      if (!r.ok) { const err = await r.json(); throw new Error(err.message); }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/stock-transfers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/warehouse-stock"] });
      setApproveId(null);
      setDetailId(null);
      toast({ title: "อนุมัติโอนสินค้าสำเร็จ สต๊อกถูกปรับแล้ว" });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/inventory/stock-transfers/${id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) { const err = await r.json(); throw new Error(err.message); }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/stock-transfers"] });
      setDeleteId(null);
      toast({ title: "ลบรายการโอนสำเร็จ" });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  function resetForm() {
    setFromWarehouseId("");
    setToWarehouseId("");
    setNotes("");
    setTransferItems([]);
    setProductSearch("");
  }

  const activeProducts = products.filter(p => p.active);
  const filteredProducts = activeProducts.filter(p => {
    if (!productSearch) return false;
    const s = productSearch.toLowerCase();
    return p.name.toLowerCase().includes(s) || p.code.toLowerCase().includes(s) || (p.barcode || "").toLowerCase().includes(s);
  });

  function addItem(product: Product) {
    if (transferItems.some(i => i.productId === product.id)) return;
    setTransferItems([...transferItems, {
      productId: product.id,
      productCode: product.code,
      productName: product.name,
      quantity: "1",
      unit: product.unit || "ชิ้น",
      available: fromStock[product.id] || 0,
    }]);
    setProductSearch("");
  }

  function updateItemQty(productId: number, qty: string) {
    setTransferItems(transferItems.map(i => i.productId === productId ? { ...i, quantity: qty } : i));
  }

  function removeItem(productId: number) {
    setTransferItems(transferItems.filter(i => i.productId !== productId));
  }

  function handleCreate() {
    if (!fromWarehouseId || !toWarehouseId) {
      toast({ title: "กรุณาเลือกคลังต้นทางและปลายทาง", variant: "destructive" });
      return;
    }
    if (transferItems.length === 0) {
      toast({ title: "กรุณาเพิ่มรายการสินค้า", variant: "destructive" });
      return;
    }
    const invalidItems = transferItems.filter(i => !i.quantity || Number(i.quantity) <= 0);
    if (invalidItems.length > 0) {
      toast({ title: "กรุณาระบุจำนวนสินค้าให้ถูกต้อง", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      companyId: selectedCompanyId,
      fromWarehouseId: Number(fromWarehouseId),
      toWarehouseId: Number(toWarehouseId),
      notes: notes || undefined,
      items: transferItems.map(i => ({
        productId: i.productId,
        productCode: i.productCode,
        productName: i.productName,
        quantity: String(i.quantity),
        unit: i.unit,
      })),
    });
  }

  const statusBadge = (status: string) => {
    if (status === "completed") return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">โอนแล้ว</Badge>;
    if (status === "cancelled") return <Badge variant="outline" className="text-red-600">ยกเลิก</Badge>;
    return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">รอดำเนินการ</Badge>;
  };

  const draftCount = transfers.filter((t: any) => t.status === "draft").length;
  const completedCount = transfers.filter((t: any) => t.status === "completed").length;

  return (
    <LayoutComponent>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setLocation("/inventory")} data-testid="btn-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Send className="h-5 w-5 text-primary" />
            <div>
              <h1 data-testid="text-page-title" className="text-xl font-heading font-bold">กระจายสินค้าไปสาขา</h1>
              <p className="text-sm text-muted-foreground">โอนสินค้าจากคลังกลางไปยังคลังสาขา</p>
            </div>
          </div>
          <Button data-testid="btn-create-transfer" className="gap-2 bg-[#fb9678] hover:bg-[#fb9678]/90" onClick={() => { resetForm(); setCreateOpen(true); }}>
            <Plus className="h-4 w-4" /> สร้างรายการโอน
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <div data-testid="text-stat-total" className="text-2xl font-bold text-primary">{transfers.length}</div>
              <div className="text-xs text-muted-foreground">รายการทั้งหมด</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <div className="text-2xl font-bold text-amber-600">{draftCount}</div>
              <div className="text-xs text-muted-foreground">รอดำเนินการ</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <div className="text-2xl font-bold" style={{ color: "#05b187" }}>{completedCount}</div>
              <div className="text-xs text-muted-foreground">โอนสำเร็จ</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-0">
            {transfers.length === 0 ? (
              <div className="text-center py-12">
                <Send className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">ยังไม่มีรายการโอนสินค้า</p>
                <p className="text-sm text-muted-foreground mt-1">กดปุ่ม "สร้างรายการโอน" เพื่อกระจายสินค้าไปสาขา</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-28">เลขที่</TableHead>
                    <TableHead>จาก</TableHead>
                    <TableHead className="w-8 text-center"></TableHead>
                    <TableHead>ไป</TableHead>
                    <TableHead className="w-28">วันที่</TableHead>
                    <TableHead className="w-28">สถานะ</TableHead>
                    <TableHead className="w-28 text-center">หมายเหตุ</TableHead>
                    <TableHead className="w-28 text-right">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transfers.map((tf: any) => (
                    <TableRow key={tf.id} data-testid={`row-transfer-${tf.id}`}>
                      <TableCell className="font-mono text-sm">{tf.transferNo}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Warehouse className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">{tf.fromWarehouseName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center"><ArrowRight className="h-4 w-4 text-muted-foreground mx-auto" /></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Warehouse className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">{tf.toWarehouseName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{tf.createdAt ? formatDate(tf.createdAt, dateEra, dateFmt) : "-"}</TableCell>
                      <TableCell>{statusBadge(tf.status)}</TableCell>
                      <TableCell className="text-sm text-center text-muted-foreground">{tf.notes || "-"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setDetailId(tf.id)} data-testid={`btn-view-${tf.id}`}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          {tf.status === "draft" && (
                            <>
                              <Button variant="ghost" size="sm" className="text-green-600" onClick={() => setApproveId(tf.id)} data-testid={`btn-approve-${tf.id}`}>
                                <CheckCircle2 className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setDeleteId(tf.id)} data-testid={`btn-delete-${tf.id}`}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="dialog-create-transfer">
          <DialogHeader>
            <DialogTitle>สร้างรายการโอนสินค้า</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">คลังต้นทาง (ส่งออก) *</label>
                <Select value={fromWarehouseId} onValueChange={(v) => { setFromWarehouseId(v); setTransferItems([]); }}>
                  <SelectTrigger data-testid="select-from-warehouse"><SelectValue placeholder="เลือกคลังต้นทาง" /></SelectTrigger>
                  <SelectContent>
                    {warehouseList.filter((w: any) => String(w.id) !== toWarehouseId).map((w: any) => (
                      <SelectItem key={w.id} value={String(w.id)}>
                        {w.name} {w.branchName ? `(${w.branchName})` : w.isDefault ? "(คลังกลาง)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">คลังปลายทาง (รับเข้า) *</label>
                <Select value={toWarehouseId} onValueChange={setToWarehouseId}>
                  <SelectTrigger data-testid="select-to-warehouse"><SelectValue placeholder="เลือกคลังปลายทาง" /></SelectTrigger>
                  <SelectContent>
                    {warehouseList.filter((w: any) => String(w.id) !== fromWarehouseId).map((w: any) => (
                      <SelectItem key={w.id} value={String(w.id)}>
                        {w.name} {w.branchName ? `(${w.branchName})` : w.isDefault ? "(คลังกลาง)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">หมายเหตุ</label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="หมายเหตุ (ไม่บังคับ)" rows={2} data-testid="input-notes" />
            </div>

            <div className="border-t pt-4">
              <label className="text-sm font-medium">เพิ่มสินค้า</label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input value={productSearch} onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="ค้นหาชื่อ, รหัส, หรือบาร์โค้ดสินค้า..." className="pl-10" data-testid="input-product-search" />
              </div>
              {filteredProducts.length > 0 && (
                <div className="mt-1 border rounded-md max-h-40 overflow-y-auto">
                  {filteredProducts.slice(0, 10).map(p => (
                    <button key={p.id} className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center justify-between text-sm"
                      onClick={() => addItem(p)} data-testid={`btn-add-product-${p.id}`}>
                      <div>
                        <span className="font-mono text-xs text-muted-foreground mr-2">{p.code}</span>
                        <span>{p.name}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        คงเหลือ: {fromWarehouseId ? (fromStock[p.id] || 0) : "-"}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {transferItems.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">รหัส</TableHead>
                    <TableHead>สินค้า</TableHead>
                    <TableHead className="w-24 text-right">คงเหลือ</TableHead>
                    <TableHead className="w-28">จำนวนโอน</TableHead>
                    <TableHead className="w-16">หน่วย</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transferItems.map(item => (
                    <TableRow key={item.productId}>
                      <TableCell className="font-mono text-xs">{item.productCode}</TableCell>
                      <TableCell className="text-sm">{item.productName}</TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">{fromWarehouseId ? (fromStock[item.productId] || 0) : "-"}</TableCell>
                      <TableCell>
                        <Input type="number" min="1" value={item.quantity}
                          onChange={(e) => updateItemQty(item.productId, e.target.value)}
                          className="w-24 h-8 text-sm" data-testid={`input-qty-${item.productId}`} />
                      </TableCell>
                      <TableCell className="text-sm">{item.unit}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="text-red-600 h-8 w-8 p-0" onClick={() => removeItem(item.productId)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>ยกเลิก</Button>
            <Button className="bg-[#fb9678] hover:bg-[#fb9678]/90 gap-2" onClick={handleCreate}
              disabled={createMutation.isPending} data-testid="btn-submit-transfer">
              <Send className="h-4 w-4" />
              {createMutation.isPending ? "กำลังสร้าง..." : "สร้างรายการโอน"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detailId !== null} onOpenChange={(open) => { if (!open) setDetailId(null); }}>
        <DialogContent className="max-w-2xl" data-testid="dialog-transfer-detail">
          <DialogHeader>
            <DialogTitle>รายละเอียดการโอน {transferDetail?.transferNo}</DialogTitle>
          </DialogHeader>
          {transferDetail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">จาก:</span>
                  <span className="ml-2 font-medium">{transferDetail.fromWarehouseName}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">ไป:</span>
                  <span className="ml-2 font-medium">{transferDetail.toWarehouseName}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">สถานะ:</span>
                  <span className="ml-2">{statusBadge(transferDetail.status)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">วันที่:</span>
                  <span className="ml-2">{transferDetail.createdAt ? formatDate(transferDetail.createdAt, dateEra, dateFmt) : "-"}</span>
                </div>
                {transferDetail.notes && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">หมายเหตุ:</span>
                    <span className="ml-2">{transferDetail.notes}</span>
                  </div>
                )}
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">รหัส</TableHead>
                    <TableHead>สินค้า</TableHead>
                    <TableHead className="text-right w-24">จำนวน</TableHead>
                    <TableHead className="w-16">หน่วย</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(transferDetail.items || []).map((item: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell className="font-mono text-xs">{item.productCode}</TableCell>
                      <TableCell className="text-sm">{item.productName}</TableCell>
                      <TableCell className="text-right text-sm font-medium">{Number(item.quantity).toLocaleString()}</TableCell>
                      <TableCell className="text-sm">{item.unit}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {transferDetail.status === "draft" && (
                <div className="flex justify-end gap-2">
                  <Button variant="outline" className="text-red-600 border-red-200" onClick={() => { setDeleteId(transferDetail.id); setDetailId(null); }}>
                    <Trash2 className="h-4 w-4 mr-2" /> ลบ
                  </Button>
                  <Button className="bg-green-600 hover:bg-green-700 gap-2" onClick={() => { setApproveId(transferDetail.id); }}>
                    <CheckCircle2 className="h-4 w-4" /> อนุมัติโอนสินค้า
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={approveId !== null} onOpenChange={(open) => { if (!open) setApproveId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการอนุมัติโอนสินค้า</AlertDialogTitle>
            <AlertDialogDescription>
              เมื่ออนุมัติแล้ว ระบบจะตัดสต๊อกจากคลังต้นทางและเพิ่มสต๊อกในคลังปลายทางอัตโนมัติ ไม่สามารถยกเลิกได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction className="bg-green-600 hover:bg-green-700" onClick={() => { if (approveId) approveMutation.mutate(approveId); }}
              disabled={approveMutation.isPending} data-testid="btn-confirm-approve">
              {approveMutation.isPending ? "กำลังอนุมัติ..." : "ยืนยันอนุมัติ"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteId !== null} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบรายการโอน</AlertDialogTitle>
            <AlertDialogDescription>ต้องการลบรายการโอนนี้หรือไม่?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => { if (deleteId) deleteMutation.mutate(deleteId); }}
              disabled={deleteMutation.isPending} data-testid="btn-confirm-delete">
              {deleteMutation.isPending ? "กำลังลบ..." : "ยืนยันลบ"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </LayoutComponent>
  );
}
