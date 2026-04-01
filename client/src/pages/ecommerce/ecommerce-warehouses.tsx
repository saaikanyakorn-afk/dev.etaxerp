import { useState } from "react";
import EcommerceLayout from "@/components/ecommerce-layout";
import { useCompany } from "@/lib/company-context";
import { formatDate } from "@/lib/format";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { useDateSettings } from "@/hooks/use-date-settings";
import {
  Warehouse, Plus, Pencil, Trash2, ChevronDown, ChevronRight,
  ArrowRightLeft, Check, Loader2, Package
} from "lucide-react";

type WarehouseItem = {
  id: number;
  companyId: number;
  code: string;
  name: string;
  address?: string;
  contactName?: string;
  contactPhone?: string;
  isDefault?: boolean;
  isActive?: boolean;
};

type StockItem = {
  productId: number;
  productCode: string;
  productName: string;
  quantity: number;
  unit: string;
};

type StockTransfer = {
  id: number;
  companyId: number;
  transferNo: string;
  fromWarehouseId: number;
  toWarehouseId: number;
  fromWarehouseName?: string;
  toWarehouseName?: string;
  status: string;
  createdAt?: string;
  items?: TransferItem[];
};

type TransferItem = {
  productId: number;
  productCode: string;
  productName: string;
  quantity: number;
  unit: string;
};

type Product = {
  id: number;
  code?: string;
  name: string;
  unit?: string;
};

export default function EcommerceWarehouses() {
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
  const [activeTab, setActiveTab] = useState("warehouses");

  const [warehouseDialogOpen, setWarehouseDialogOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<WarehouseItem | null>(null);
  const [whForm, setWhForm] = useState({ code: "", name: "", address: "", contactName: "", contactPhone: "", isDefault: false });

  const [expandedWhId, setExpandedWhId] = useState<number | null>(null);

  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [tfForm, setTfForm] = useState({ transferNo: "", fromWarehouseId: "", toWarehouseId: "" });
  const [tfItems, setTfItems] = useState<TransferItem[]>([]);
  const [addProductId, setAddProductId] = useState("");
  const [addQty, setAddQty] = useState("1");

  const { data: warehouses = [], isLoading: whLoading } = useQuery<WarehouseItem[]>({
    queryKey: ["/api/warehouses", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/warehouses?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const { data: stockData } = useQuery<StockItem[]>({
    queryKey: ["/api/warehouses", expandedWhId, "stock"],
    queryFn: async () => {
      const r = await fetch(`/api/warehouses/${expandedWhId}/stock`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!expandedWhId,
  });

  const { data: transfers = [], isLoading: tfLoading } = useQuery<StockTransfer[]>({
    queryKey: ["/api/stock-transfers", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/stock-transfers?companyId=${selectedCompanyId}`, { credentials: "include" });
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

  const saveWarehouseMutation = useMutation({
    mutationFn: async (data: any) => {
      const isEdit = !!editingWarehouse;
      const url = isEdit ? `/api/warehouses/${editingWarehouse!.id}` : "/api/warehouses";
      const method = isEdit ? "PATCH" : "POST";
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...data, companyId: selectedCompanyId }),
      });
      if (!r.ok) throw new Error((await r.json()).message || "บันทึกไม่สำเร็จ");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warehouses"] });
      setWarehouseDialogOpen(false);
      setEditingWarehouse(null);
      toast({ title: "บันทึกคลังสินค้าสำเร็จ" });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const deleteWarehouseMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/warehouses/${id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) throw new Error((await r.json()).message || "ลบไม่สำเร็จ");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warehouses"] });
      toast({ title: "ลบคลังสินค้าสำเร็จ" });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const createTransferMutation = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch("/api/stock-transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!r.ok) throw new Error((await r.json()).message || "สร้างไม่สำเร็จ");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stock-transfers"] });
      setTransferDialogOpen(false);
      resetTfForm();
      toast({ title: "สร้างใบโอนสต๊อกสำเร็จ" });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const approveTransferMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/stock-transfers/${id}/approve`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!r.ok) throw new Error((await r.json()).message || "อนุมัติไม่สำเร็จ");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stock-transfers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouses"] });
      toast({ title: "อนุมัติการโอนสต๊อกสำเร็จ" });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  function openAddWarehouse() {
    setEditingWarehouse(null);
    setWhForm({ code: "", name: "", address: "", contactName: "", contactPhone: "", isDefault: false });
    setWarehouseDialogOpen(true);
  }

  function openEditWarehouse(wh: WarehouseItem) {
    setEditingWarehouse(wh);
    setWhForm({
      code: wh.code || "",
      name: wh.name || "",
      address: wh.address || "",
      contactName: wh.contactName || "",
      contactPhone: wh.contactPhone || "",
      isDefault: !!wh.isDefault,
    });
    setWarehouseDialogOpen(true);
  }

  function resetTfForm() {
    setTfForm({ transferNo: "", fromWarehouseId: "", toWarehouseId: "" });
    setTfItems([]);
    setAddProductId("");
    setAddQty("1");
  }

  function handleAddTransferItem() {
    const product = products.find(p => String(p.id) === addProductId);
    if (!product) return;
    const qty = parseInt(addQty) || 1;
    if (tfItems.some(i => i.productId === product.id)) {
      setTfItems(prev => prev.map(i => i.productId === product.id ? { ...i, quantity: i.quantity + qty } : i));
    } else {
      setTfItems(prev => [...prev, {
        productId: product.id,
        productCode: product.code || "",
        productName: product.name,
        quantity: qty,
        unit: product.unit || "ชิ้น",
      }]);
    }
    setAddProductId("");
    setAddQty("1");
  }

  function getWarehouseName(id: number) {
    return warehouses.find(w => w.id === id)?.name || "-";
  }

  return (
    <EcommerceLayout>
      <div className="space-y-5" data-testid="page-warehouses">
        <div>
          <h1 className="text-2xl font-bold text-gray-800" data-testid="text-warehouses-title">จัดการคลังสินค้า</h1>
          <p className="text-sm text-muted-foreground mt-1">จัดการคลังสินค้าหลายแห่งและโอนสต๊อกระหว่างคลัง</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList data-testid="tabs-warehouses">
            <TabsTrigger value="warehouses" data-testid="tab-warehouses">
              <Warehouse className="h-4 w-4 mr-1.5" />คลังสินค้า
            </TabsTrigger>
            <TabsTrigger value="transfers" data-testid="tab-transfers">
              <ArrowRightLeft className="h-4 w-4 mr-1.5" />โอนสต๊อก
            </TabsTrigger>
          </TabsList>

          <TabsContent value="warehouses" className="mt-4 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">{warehouses.length} คลังสินค้า</span>
              <Button size="sm" onClick={openAddWarehouse} data-testid="button-add-warehouse">
                <Plus className="h-4 w-4 mr-1" />เพิ่มคลังสินค้า
              </Button>
            </div>

            <Card className="rounded-xl shadow-sm border">
              <CardContent className="p-0">
                {whLoading ? (
                  <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
                ) : warehouses.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <Warehouse className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
                    <p className="text-sm">ยังไม่มีคลังสินค้า</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10"></TableHead>
                        <TableHead className="text-xs">รหัส</TableHead>
                        <TableHead className="text-xs">ชื่อคลัง</TableHead>
                        <TableHead className="text-xs">ที่อยู่</TableHead>
                        <TableHead className="text-xs text-center">ค่าเริ่มต้น</TableHead>
                        <TableHead className="text-xs text-center">สถานะ</TableHead>
                        <TableHead className="text-xs text-center">จัดการ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {warehouses.map(wh => (
                        <>
                          <TableRow
                            key={wh.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => setExpandedWhId(prev => prev === wh.id ? null : wh.id)}
                            data-testid={`row-warehouse-${wh.id}`}
                          >
                            <TableCell className="px-2">
                              {expandedWhId === wh.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </TableCell>
                            <TableCell className="font-mono text-xs" data-testid={`text-wh-code-${wh.id}`}>{wh.code}</TableCell>
                            <TableCell className="text-sm font-medium" data-testid={`text-wh-name-${wh.id}`}>{wh.name}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{wh.address || "-"}</TableCell>
                            <TableCell className="text-center">
                              {wh.isDefault && <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100" data-testid={`badge-default-${wh.id}`}>ค่าเริ่มต้น</Badge>}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge
                                className={wh.isActive !== false ? "bg-green-100 text-green-700 hover:bg-green-100" : "bg-gray-100 text-gray-500 hover:bg-gray-100"}
                                data-testid={`badge-status-${wh.id}`}
                              >
                                {wh.isActive !== false ? "ใช้งาน" : "ปิดใช้งาน"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-1" onClick={e => e.stopPropagation()}>
                                <Button variant="ghost" size="sm" onClick={() => openEditWarehouse(wh)} data-testid={`button-edit-wh-${wh.id}`}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-500 hover:text-red-700"
                                  onClick={() => {
                                    if (confirm("ต้องการลบคลังสินค้านี้หรือไม่?")) deleteWarehouseMutation.mutate(wh.id);
                                  }}
                                  data-testid={`button-delete-wh-${wh.id}`}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                          {expandedWhId === wh.id && (
                            <TableRow key={`stock-${wh.id}`}>
                              <TableCell colSpan={7} className="bg-muted/30 p-4">
                                <div className="text-xs font-medium mb-2 text-muted-foreground">สต๊อกในคลัง: {wh.name}</div>
                                {!stockData || stockData.length === 0 ? (
                                  <p className="text-xs text-muted-foreground">ไม่มีสินค้าในคลังนี้</p>
                                ) : (
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead className="text-xs">รหัสสินค้า</TableHead>
                                        <TableHead className="text-xs">ชื่อสินค้า</TableHead>
                                        <TableHead className="text-xs text-right">จำนวน</TableHead>
                                        <TableHead className="text-xs">หน่วย</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {stockData.map((s, idx) => (
                                        <TableRow key={idx} data-testid={`row-stock-${s.productId}`}>
                                          <TableCell className="font-mono text-xs">{s.productCode}</TableCell>
                                          <TableCell className="text-xs">{s.productName}</TableCell>
                                          <TableCell className="text-xs text-right font-medium">{s.quantity}</TableCell>
                                          <TableCell className="text-xs">{s.unit}</TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                )}
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="transfers" className="mt-4 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">{transfers.length} รายการโอน</span>
              <Button size="sm" onClick={() => { resetTfForm(); setTransferDialogOpen(true); }} data-testid="button-create-transfer">
                <Plus className="h-4 w-4 mr-1" />สร้างใบโอนสต๊อก
              </Button>
            </div>

            <Card className="rounded-xl shadow-sm border">
              <CardContent className="p-0">
                {tfLoading ? (
                  <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
                ) : transfers.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <ArrowRightLeft className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
                    <p className="text-sm">ยังไม่มีรายการโอนสต๊อก</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">เลขที่โอน</TableHead>
                        <TableHead className="text-xs">จากคลัง</TableHead>
                        <TableHead className="text-xs">ไปคลัง</TableHead>
                        <TableHead className="text-xs text-center">สถานะ</TableHead>
                        <TableHead className="text-xs">วันที่</TableHead>
                        <TableHead className="text-xs text-center">จัดการ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transfers.map(tf => (
                        <TableRow key={tf.id} data-testid={`row-transfer-${tf.id}`}>
                          <TableCell className="font-mono text-xs" data-testid={`text-transfer-no-${tf.id}`}>{tf.transferNo}</TableCell>
                          <TableCell className="text-xs" data-testid={`text-from-wh-${tf.id}`}>{tf.fromWarehouseName || getWarehouseName(tf.fromWarehouseId)}</TableCell>
                          <TableCell className="text-xs" data-testid={`text-to-wh-${tf.id}`}>{tf.toWarehouseName || getWarehouseName(tf.toWarehouseId)}</TableCell>
                          <TableCell className="text-center">
                            <Badge
                              className={
                                tf.status === "completed"
                                  ? "bg-green-100 text-green-700 hover:bg-green-100"
                                  : "bg-yellow-100 text-yellow-700 hover:bg-yellow-100"
                              }
                              data-testid={`badge-transfer-status-${tf.id}`}
                            >
                              {tf.status === "completed" ? "เสร็จสิ้น" : "แบบร่าง"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">{formatDate(tf.createdAt, dateEra, dateFmt)}</TableCell>
                          <TableCell className="text-center">
                            {tf.status === "draft" && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-green-600 border-green-300 hover:bg-green-50"
                                onClick={() => {
                                  if (confirm("ต้องการอนุมัติการโอนสต๊อกนี้หรือไม่?")) approveTransferMutation.mutate(tf.id);
                                }}
                                data-testid={`button-approve-transfer-${tf.id}`}
                              >
                                <Check className="h-3.5 w-3.5 mr-1" />อนุมัติ
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={warehouseDialogOpen} onOpenChange={setWarehouseDialogOpen}>
          <DialogContent data-testid="dialog-warehouse">
            <DialogHeader>
              <DialogTitle>{editingWarehouse ? "แก้ไขคลังสินค้า" : "เพิ่มคลังสินค้า"}</DialogTitle>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={e => {
                e.preventDefault();
                saveWarehouseMutation.mutate(whForm);
              }}
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">รหัสคลัง</label>
                  <Input
                    value={whForm.code}
                    onChange={e => setWhForm(p => ({ ...p, code: e.target.value }))}
                    required
                    data-testid="input-wh-code"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">ชื่อคลัง</label>
                  <Input
                    value={whForm.name}
                    onChange={e => setWhForm(p => ({ ...p, name: e.target.value }))}
                    required
                    data-testid="input-wh-name"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">ที่อยู่</label>
                <Input
                  value={whForm.address}
                  onChange={e => setWhForm(p => ({ ...p, address: e.target.value }))}
                  data-testid="input-wh-address"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">ชื่อผู้ติดต่อ</label>
                  <Input
                    value={whForm.contactName}
                    onChange={e => setWhForm(p => ({ ...p, contactName: e.target.value }))}
                    data-testid="input-wh-contact-name"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">เบอร์โทร</label>
                  <Input
                    value={whForm.contactPhone}
                    onChange={e => setWhForm(p => ({ ...p, contactPhone: e.target.value }))}
                    data-testid="input-wh-contact-phone"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={whForm.isDefault}
                  onCheckedChange={(v) => setWhForm(p => ({ ...p, isDefault: !!v }))}
                  data-testid="checkbox-wh-default"
                />
                <label className="text-sm">ตั้งเป็นคลังเริ่มต้น</label>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setWarehouseDialogOpen(false)} data-testid="button-cancel-wh">ยกเลิก</Button>
                <Button type="submit" disabled={saveWarehouseMutation.isPending} data-testid="button-save-wh">
                  {saveWarehouseMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  บันทึก
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
          <DialogContent className="max-w-2xl" data-testid="dialog-transfer">
            <DialogHeader>
              <DialogTitle>สร้างใบโอนสต๊อก</DialogTitle>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={e => {
                e.preventDefault();
                if (tfItems.length === 0) {
                  toast({ title: "กรุณาเพิ่มสินค้าอย่างน้อย 1 รายการ", variant: "destructive" });
                  return;
                }
                createTransferMutation.mutate({
                  companyId: selectedCompanyId,
                  transferNo: tfForm.transferNo,
                  fromWarehouseId: parseInt(tfForm.fromWarehouseId),
                  toWarehouseId: parseInt(tfForm.toWarehouseId),
                  items: tfItems,
                });
              }}
            >
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">เลขที่โอน</label>
                  <Input
                    value={tfForm.transferNo}
                    onChange={e => setTfForm(p => ({ ...p, transferNo: e.target.value }))}
                    required
                    data-testid="input-transfer-no"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">จากคลัง</label>
                  <Select value={tfForm.fromWarehouseId} onValueChange={v => setTfForm(p => ({ ...p, fromWarehouseId: v }))}>
                    <SelectTrigger data-testid="select-from-warehouse">
                      <SelectValue placeholder="เลือกคลังต้นทาง" />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouses.map(wh => (
                        <SelectItem key={wh.id} value={String(wh.id)}>{wh.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">ไปคลัง</label>
                  <Select value={tfForm.toWarehouseId} onValueChange={v => setTfForm(p => ({ ...p, toWarehouseId: v }))}>
                    <SelectTrigger data-testid="select-to-warehouse">
                      <SelectValue placeholder="เลือกคลังปลายทาง" />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouses.map(wh => (
                        <SelectItem key={wh.id} value={String(wh.id)}>{wh.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">รายการสินค้า</label>
                <div className="flex items-end gap-2 mb-3">
                  <div className="flex-1">
                    <Select value={addProductId} onValueChange={setAddProductId}>
                      <SelectTrigger data-testid="select-transfer-product">
                        <SelectValue placeholder="เลือกสินค้า" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map(p => (
                          <SelectItem key={p.id} value={String(p.id)}>{p.code ? `[${p.code}] ` : ""}{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-24">
                    <Input
                      type="number"
                      min="1"
                      value={addQty}
                      onChange={e => setAddQty(e.target.value)}
                      data-testid="input-transfer-qty"
                    />
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={handleAddTransferItem} disabled={!addProductId} data-testid="button-add-transfer-item">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {tfItems.length > 0 && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">รหัส</TableHead>
                        <TableHead className="text-xs">ชื่อสินค้า</TableHead>
                        <TableHead className="text-xs text-right">จำนวน</TableHead>
                        <TableHead className="text-xs">หน่วย</TableHead>
                        <TableHead className="text-xs w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tfItems.map((item, idx) => (
                        <TableRow key={idx} data-testid={`row-transfer-item-${idx}`}>
                          <TableCell className="font-mono text-xs">{item.productCode}</TableCell>
                          <TableCell className="text-xs">{item.productName}</TableCell>
                          <TableCell className="text-xs text-right">{item.quantity}</TableCell>
                          <TableCell className="text-xs">{item.unit}</TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-red-500 h-6 w-6 p-0"
                              onClick={() => setTfItems(prev => prev.filter((_, i) => i !== idx))}
                              data-testid={`button-remove-item-${idx}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setTransferDialogOpen(false)} data-testid="button-cancel-transfer">ยกเลิก</Button>
                <Button type="submit" disabled={createTransferMutation.isPending} data-testid="button-save-transfer">
                  {createTransferMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  สร้างใบโอน
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </EcommerceLayout>
  );
}
