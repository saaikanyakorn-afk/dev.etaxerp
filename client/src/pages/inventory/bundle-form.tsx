import Layout from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Save, Plus, X, Package, Layers, Star } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useLocation, useParams } from "wouter";
import type { Product } from "@shared/schema";

const UNITS = ["ชิ้น", "กล่อง", "ถุง", "แพ็ค", "ขวด", "กก.", "ลิตร", "เมตร", "ชุด"];

type SlotItem = {
  componentProductId: number | "";
  quantity: string;
  unit: string;
  slotGroup: string;
  isDefault: boolean;
};

export default function BundleFormPage(props: { Wrapper?: React.ComponentType<{ children: React.ReactNode }>; basePath?: string } & Record<string, any>) {
  const LayoutComponent = props.Wrapper || Layout;
  const bundlesPath = props.basePath ? `${props.basePath}/bundles` : "/inventory/bundles";
  const { selectedCompanyId } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const params = useParams<{ id: string }>();
  const productId = params.id ? Number(params.id) : null;

  const [items, setItems] = useState<SlotItem[]>([]);

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/products?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const editingProduct = products.find(p => p.id === productId);

  useEffect(() => {
    if (productId) {
      fetch(`/api/product-bundles/${productId}`, { credentials: "include" })
        .then(r => { if (r.ok) return r.json(); throw new Error(); })
        .then(data => {
          const arr = Array.isArray(data) ? data : (data.items || []);
          const existing: SlotItem[] = arr.map((i: any) => ({
            componentProductId: i.componentProductId,
            quantity: String(i.qty || i.quantity || "1"),
            unit: i.unit || "ชิ้น",
            slotGroup: i.slotGroup || "",
            isDefault: i.isDefault !== false,
          }));
          setItems(existing.length > 0 ? existing : []);
        })
        .catch(() => setItems([]));
    }
  }, [productId]);

  const saveMutation = useMutation({
    mutationFn: async ({ pid, data }: { pid: number; data: any }) => {
      const r = await fetch(`/api/product-bundles/${pid}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/product-bundles"] });
      toast({ title: "บันทึกรายการชุดสินค้าสำเร็จ", variant: "success" as any });
      navigate(bundlesPath);
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  function handleSave() {
    if (!productId) return;
    const validItems = items
      .filter(i => i.componentProductId !== "")
      .map(i => ({
        componentProductId: Number(i.componentProductId),
        quantity: i.quantity,
        unit: i.unit,
        slotGroup: i.slotGroup || null,
        isDefault: i.isDefault,
      }));
    if (validItems.length === 0) {
      toast({ title: "กรุณาเพิ่มสินค้าในชุดอย่างน้อย 1 รายการ", variant: "destructive" });
      return;
    }

    const slotGroups = new Set(validItems.filter(i => i.slotGroup).map(i => i.slotGroup));
    for (const sg of slotGroups) {
      const slotItems = validItems.filter(i => i.slotGroup === sg);
      const prices = slotItems.map(i => {
        const p = products.find(pp => pp.id === Number(i.componentProductId));
        return p ? parseFloat(p.price || "0") : 0;
      });
      const uniquePrices = new Set(prices);
      if (uniquePrices.size > 1) {
        toast({
          title: `ช่อง "${sg}" มีสินค้าราคาไม่เท่ากัน`,
          description: "สินค้าในช่องเดียวกันต้องมีราคาเท่ากัน เพื่อให้ลูกค้าสลับเปลี่ยนได้",
          variant: "destructive",
        });
        return;
      }
      const defaultCount = slotItems.filter(i => i.isDefault).length;
      if (defaultCount === 0) {
        toast({ title: `ช่อง "${sg}" ต้องมีสินค้าเริ่มต้นอย่างน้อย 1 รายการ`, variant: "destructive" });
        return;
      }
    }
    saveMutation.mutate({ pid: productId, data: { items: validItems } });
  }

  function addItem(slotGroup?: string) {
    setItems(prev => [...prev, {
      componentProductId: "",
      quantity: "1",
      unit: "ชิ้น",
      slotGroup: slotGroup || "",
      isDefault: !slotGroup || !prev.some(i => i.slotGroup === slotGroup),
    }]);
  }

  function addSlot() {
    const existingSlots = new Set(items.filter(i => i.slotGroup).map(i => i.slotGroup));
    let num = existingSlots.size + 1;
    while (existingSlots.has(`ช่อง ${num}`)) num++;
    const slotName = `ช่อง ${num}`;
    setItems(prev => [...prev, {
      componentProductId: "",
      quantity: "1",
      unit: "ชิ้น",
      slotGroup: slotName,
      isDefault: true,
    }]);
  }

  function removeItem(idx: number) { setItems(prev => prev.filter((_, i) => i !== idx)); }

  function updateItem(idx: number, field: keyof SlotItem, value: any) {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [field]: value };
      if (field === "isDefault" && value === true && item.slotGroup) {
        return updated;
      }
      return updated;
    }));
  }

  function updateSlotGroupName(oldName: string, newName: string) {
    if (!newName.trim()) return;
    setItems(prev => prev.map(item =>
      item.slotGroup === oldName ? { ...item, slotGroup: newName } : item
    ));
  }

  const componentProducts = products.filter(p => p.active && p.id !== productId);

  const fixedItems = items.filter(i => !i.slotGroup);
  const slotGroups = [...new Set(items.filter(i => i.slotGroup).map(i => i.slotGroup))];

  const getProductPrice = (pid: number | "") => {
    if (!pid) return "";
    const p = products.find(pp => pp.id === Number(pid));
    return p ? Number(p.price).toLocaleString("th-TH", { minimumFractionDigits: 2 }) : "-";
  };

  return (
    <LayoutComponent>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button data-testid="button-back" variant="ghost" size="icon" onClick={() => navigate(bundlesPath)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Package className="h-5 w-5 text-primary" />
            <h1 data-testid="text-page-title" className="text-xl font-heading font-bold">
              แก้ไขชุดสินค้า{editingProduct ? `: ${editingProduct.name}` : ""}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button data-testid="button-cancel" variant="outline" onClick={() => navigate(bundlesPath)}>ยกเลิก</Button>
            <Button data-testid="button-save" className="gap-2" onClick={handleSave} disabled={saveMutation.isPending}>
              <Save className="h-4 w-4" />
              บันทึก
            </Button>
          </div>
        </div>

        {editingProduct && (
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">ข้อมูลสินค้า</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div><span className="text-muted-foreground">รหัส:</span> <span className="font-medium">{editingProduct.code}</span></div>
                <div><span className="text-muted-foreground">หน่วย:</span> <span className="font-medium">{editingProduct.unit}</span></div>
                <div><span className="text-muted-foreground">ราคา:</span> <span className="font-medium">{Number(editingProduct.price).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span></div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">รายการสินค้าตายตัว (ไม่สามารถเปลี่ยนได้)</CardTitle>
              <Button variant="outline" size="sm" data-testid="button-add-fixed" onClick={() => addItem()}>
                <Plus className="h-4 w-4 mr-1" /> เพิ่มสินค้า
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {fixedItems.length === 0 ? (
              <div className="text-center py-6 text-gray-400 border rounded-md bg-gray-50" data-testid="text-no-fixed">
                <p className="text-sm">ยังไม่มีสินค้าตายตัว — เพิ่มได้หรือใช้เฉพาะช่องเลือกด้านล่าง</p>
              </div>
            ) : (
              <Table data-testid="table-fixed-items">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[45%]">สินค้า</TableHead>
                    <TableHead>ราคา</TableHead>
                    <TableHead>จำนวน</TableHead>
                    <TableHead>หน่วย</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, idx) => {
                    if (item.slotGroup) return null;
                    return (
                      <TableRow key={idx} data-testid={`row-fixed-${idx}`}>
                        <TableCell>
                          <Select value={String(item.componentProductId)} onValueChange={v => updateItem(idx, "componentProductId", Number(v))}>
                            <SelectTrigger data-testid={`select-fixed-${idx}`}><SelectValue placeholder="เลือกสินค้า" /></SelectTrigger>
                            <SelectContent>
                              {componentProducts.map(p => (
                                <SelectItem key={p.id} value={String(p.id)}>{p.code} - {p.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-sm text-slate-600">{getProductPrice(item.componentProductId)}</TableCell>
                        <TableCell>
                          <Input data-testid={`input-qty-fixed-${idx}`} type="number" min="1" value={item.quantity} onChange={e => updateItem(idx, "quantity", e.target.value)} className="w-20" />
                        </TableCell>
                        <TableCell>
                          <Select value={item.unit} onValueChange={v => updateItem(idx, "unit", v)}>
                            <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => removeItem(idx)}>
                            <X className="h-4 w-4 text-red-500" />
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

        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Layers className="h-4 w-4 text-blue-500" />
                  ช่องเลือกสินค้า (ลูกค้าเปลี่ยนได้)
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">สินค้าในช่องเดียวกันต้องราคาเท่ากัน ลูกค้าเลือกสลับได้ตอนซื้อ</p>
              </div>
              <Button variant="outline" size="sm" data-testid="button-add-slot" onClick={addSlot}>
                <Layers className="h-4 w-4 mr-1" /> เพิ่มช่องเลือก
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {slotGroups.length === 0 ? (
              <div className="text-center py-6 text-gray-400 border rounded-md bg-gray-50">
                <p className="text-sm">ยังไม่มีช่องเลือก — กดปุ่ม "เพิ่มช่องเลือก" เพื่อให้ลูกค้าสามารถเปลี่ยนสินค้าได้</p>
              </div>
            ) : (
              slotGroups.map(sg => {
                const slotItems = items
                  .map((item, idx) => ({ ...item, originalIndex: idx }))
                  .filter(i => i.slotGroup === sg);
                return (
                  <div key={sg} className="border rounded-lg p-3 bg-blue-50/50">
                    <div className="flex items-center gap-2 mb-3">
                      <Layers className="h-4 w-4 text-blue-500" />
                      <Input
                        data-testid={`input-slot-name-${sg}`}
                        value={sg}
                        onChange={e => updateSlotGroupName(sg, e.target.value)}
                        className="h-8 text-sm font-semibold border-blue-200 bg-white w-48"
                        placeholder="ชื่อช่อง"
                      />
                      <span className="text-xs text-muted-foreground">({slotItems.length} ตัวเลือก)</span>
                      <div className="flex-1" />
                      <Button variant="outline" size="sm" onClick={() => addItem(sg)} className="h-7 text-xs">
                        <Plus className="h-3 w-3 mr-1" /> เพิ่มตัวเลือก
                      </Button>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[40%]">สินค้า</TableHead>
                          <TableHead>ราคา</TableHead>
                          <TableHead>จำนวน</TableHead>
                          <TableHead>หน่วย</TableHead>
                          <TableHead className="text-center">ค่าเริ่มต้น</TableHead>
                          <TableHead className="w-10"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {slotItems.map(item => (
                          <TableRow key={item.originalIndex}>
                            <TableCell>
                              <Select value={String(item.componentProductId)} onValueChange={v => updateItem(item.originalIndex, "componentProductId", Number(v))}>
                                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="เลือกสินค้า" /></SelectTrigger>
                                <SelectContent>
                                  {componentProducts.map(p => (
                                    <SelectItem key={p.id} value={String(p.id)}>{p.code} - {p.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="text-xs text-slate-600">{getProductPrice(item.componentProductId)}</TableCell>
                            <TableCell>
                              <Input type="number" min="1" value={item.quantity} onChange={e => updateItem(item.originalIndex, "quantity", e.target.value)} className="w-16 h-8 text-xs" />
                            </TableCell>
                            <TableCell>
                              <Select value={item.unit} onValueChange={v => updateItem(item.originalIndex, "unit", v)}>
                                <SelectTrigger className="w-16 h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="text-center">
                              <button
                                data-testid={`btn-default-${item.originalIndex}`}
                                onClick={() => updateItem(item.originalIndex, "isDefault", !item.isDefault)}
                                className={`inline-flex items-center justify-center w-7 h-7 rounded-full transition ${item.isDefault ? "bg-yellow-400 text-white" : "bg-gray-200 text-gray-400 hover:bg-gray-300"}`}
                              >
                                <Star className="h-3.5 w-3.5" fill={item.isDefault ? "currentColor" : "none"} />
                              </button>
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="sm" onClick={() => removeItem(item.originalIndex)}>
                                <X className="h-4 w-4 text-red-500" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-2 pb-4">
          <Button data-testid="button-cancel-bottom" variant="outline" onClick={() => navigate("/inventory/bundles")}>ยกเลิก</Button>
          <Button data-testid="button-save-bottom" className="gap-2" onClick={handleSave} disabled={saveMutation.isPending}>
            <Save className="h-4 w-4" /> บันทึก
          </Button>
        </div>
      </div>
    </LayoutComponent>
  );
}
