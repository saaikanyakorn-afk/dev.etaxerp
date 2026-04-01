import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Plus, Trash2, ClipboardList, Save } from "lucide-react";
import ThaiDateInput from "@/components/thai-date-input";
import { useDateSettings } from "@/hooks/use-date-settings";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/lib/company-context";
import { apiRequest } from "@/lib/queryClient";
import type { Product } from "@shared/schema";
import { toLocalDateStr } from "@/lib/utils";

interface GIQItemForm {
  productId?: number;
  productCode: string;
  productName: string;
  unit: string;
  quantity: string;
  unitCost: string;
}

function fmt(val: string | number | null | undefined): string {
  const n = parseFloat(String(val || "0"));
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const emptyItem = (): GIQItemForm => ({
  productCode: "",
  productName: "",
  unit: "ชิ้น",
  quantity: "1",
  unitCost: "0",
});

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: { label: "ร่าง", color: "bg-slate-100 text-slate-700 border-slate-200" },
  approved: { label: "อนุมัติ", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
};

export default function GoodsRequisitionForm(props: { Wrapper?: React.ComponentType<{ children: React.ReactNode }>; basePath?: string } & Record<string, any>) {
  const LayoutComponent = props.Wrapper || Layout;
  const reqBasePath = props.basePath ? `${props.basePath}/requisition` : "/inventory/requisition";
  const [, navigate] = useLocation();
  const [matchCreate] = useRoute(`${reqBasePath}/form`);
  const [matchEdit, paramsEdit] = useRoute(`${reqBasePath}/form/:id`);
  const editingId = matchEdit ? Number(paramsEdit?.id) : null;
  const isNew = !!matchCreate && !editingId;

  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const { dateEra, dateFmt } = useDateSettings();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    giqNo: "",
    giqDate: toLocalDateStr(new Date()),
    departmentName: "",
    requestedBy: "",
    purpose: "",
    notes: "",
    status: "draft",
  });

  const [items, setItems] = useState<GIQItemForm[]>([emptyItem()]);
  const [loaded, setLoaded] = useState(false);

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const res = await fetch(`/api/products?companyId=${companyId}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!companyId,
  });

  useEffect(() => {
    if (loaded) return;
    if (isNew) {
      setLoaded(true);
    } else if (editingId) {
      (async () => {
        try {
          const res = await fetch(`/api/goods-requisitions/${editingId}`, { credentials: "include" });
          if (res.ok) {
            const data = await res.json();
            setForm({
              giqNo: data.giqNo || data.documentNo || "",
              giqDate: data.giqDate || data.requisitionDate || data.date || "",
              departmentName: data.departmentName || "",
              requestedBy: data.requestedBy || "",
              purpose: data.purpose || "",
              notes: data.notes || "",
              status: data.status || "draft",
            });
            if (data.items && data.items.length > 0) {
              setItems(data.items.map((it: any) => ({
                productId: it.productId,
                productCode: it.productCode || "",
                productName: it.productName || "",
                unit: it.unit || "ชิ้น",
                quantity: String(it.quantity || it.qty || "1"),
                unitCost: String(it.unitCost || it.unitPrice || "0"),
              })));
            }
          }
        } catch {}
        setLoaded(true);
      })();
    } else {
      setLoaded(true);
    }
  }, [isNew, editingId, companyId, loaded]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/goods-requisitions", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/goods-requisitions"] });
      toast({ title: "สร้างใบเบิกสินค้าสำเร็จ", variant: "success" as any });
      navigate(reqBasePath);
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PATCH", `/api/goods-requisitions/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/goods-requisitions"] });
      toast({ title: "อัพเดทใบเบิกสินค้าสำเร็จ", variant: "success" as any });
      navigate(reqBasePath);
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  function handleProductSelect(idx: number, productId: string) {
    const p = products.find(pr => pr.id === Number(productId));
    if (p) {
      const newItems = [...items];
      newItems[idx] = {
        ...newItems[idx],
        productId: p.id,
        productCode: p.code || "",
        productName: p.name,
        unit: p.unit || "ชิ้น",
        unitCost: String(p.cost || "0"),
      };
      setItems(newItems);
    }
  }

  function updateItem(idx: number, field: keyof GIQItemForm, value: string) {
    const newItems = [...items];
    (newItems[idx] as any)[field] = value;
    setItems(newItems);
  }

  function addItem() {
    setItems([...items, emptyItem()]);
  }

  function removeItem(idx: number) {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== idx));
  }

  function calcItemTotal(item: GIQItemForm): number {
    return (parseFloat(item.quantity) || 0) * (parseFloat(item.unitCost) || 0);
  }

  function calcGrandTotal(): number {
    return items.reduce((s, it) => s + calcItemTotal(it), 0);
  }

  function handleSubmit() {
    const validItems = items.filter(it => it.productName);
    if (validItems.length === 0) {
      toast({ title: "กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ", variant: "destructive" });
      return;
    }

    const payload = {
      companyId,
      giqDate: form.giqDate,
      departmentName: form.departmentName,
      requestedBy: form.requestedBy,
      purpose: form.purpose,
      notes: form.notes,
      status: form.status,
      totalAmount: calcGrandTotal().toFixed(2),
      items: validItems.map(it => ({
        productId: it.productId || null,
        productName: it.productName,
        productCode: it.productCode,
        unit: it.unit,
        quantity: it.quantity,
        unitCost: it.unitCost,
      })),
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const statusInfo = STATUS_MAP[form.status] || STATUS_MAP.draft;

  return (
    <LayoutComponent>
      <div className="space-y-4" data-testid="goods-requisition-form-page">
        <div className="flex items-center gap-3 mb-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => navigate(reqBasePath)}
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 flex-1">
            <ClipboardList className="h-5 w-5 text-[#fb9678]" />
            <h1 className="text-lg font-bold text-slate-800" data-testid="text-page-title">
              {editingId ? "แก้ไขใบเบิกสินค้า" : "สร้างใบเบิกสินค้า"}
            </h1>
            {editingId && (
              <Badge data-testid="badge-status" className={`${statusInfo.color} border text-xs ml-2`}>
                {statusInfo.label}
              </Badge>
            )}
          </div>
        </div>

        <Card className="border shadow-sm">
          <CardHeader className="pb-3 pt-4 px-4 border-b">
            <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-[#fb9678]" />
              ข้อมูลใบเบิกสินค้า
            </h2>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <Label className="text-sm text-slate-600">เลขที่ GIQ</Label>
                <Input
                  data-testid="input-giq-no"
                  value={form.giqNo}
                  onChange={e => setForm(prev => ({ ...prev, giqNo: e.target.value }))}
                  placeholder="auto"
                  readOnly={isNew}
                  className="mt-1 h-9 text-sm bg-white"
                />
              </div>

              <div>
                <Label className="text-sm text-slate-600">วันที่เบิก</Label>
                <ThaiDateInput value={form.giqDate} onChange={(v: string) => setForm(prev => ({ ...prev, giqDate: v }))} dateEra={dateEra} dateFmt={dateFmt} className="mt-1" data-testid="input-giq-date" />
              </div>

              <div>
                <Label className="text-sm text-slate-600">แผนก/หน่วยงาน</Label>
                <Input
                  data-testid="input-department-name"
                  value={form.departmentName}
                  onChange={e => setForm(prev => ({ ...prev, departmentName: e.target.value }))}
                  placeholder="ระบุแผนก/หน่วยงาน"
                  className="mt-1 h-9 text-sm bg-white"
                />
              </div>

              <div>
                <Label className="text-sm text-slate-600">ผู้เบิก</Label>
                <Input
                  data-testid="input-requested-by"
                  value={form.requestedBy}
                  onChange={e => setForm(prev => ({ ...prev, requestedBy: e.target.value }))}
                  placeholder="ระบุชื่อผู้เบิก"
                  className="mt-1 h-9 text-sm bg-white"
                />
              </div>

              <div>
                <Label className="text-sm text-slate-600">วัตถุประสงค์</Label>
                <Input
                  data-testid="input-purpose"
                  value={form.purpose}
                  onChange={e => setForm(prev => ({ ...prev, purpose: e.target.value }))}
                  placeholder="ระบุวัตถุประสงค์การเบิก"
                  className="mt-1 h-9 text-sm bg-white"
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-1">
                <Label className="text-sm text-slate-600">หมายเหตุ</Label>
                <Textarea
                  data-testid="input-notes"
                  value={form.notes}
                  onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="หมายเหตุเพิ่มเติม"
                  className="mt-1 text-sm bg-white min-h-[60px]"
                  rows={2}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardHeader className="pb-3 pt-4 px-4 border-b flex flex-row items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-[#fb9678]" />
              รายการสินค้า
            </h2>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-sm gap-1"
              onClick={addItem}
              data-testid="button-add-item"
            >
              <Plus className="h-3.5 w-3.5" />
              เพิ่มรายการ
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow className="hover:bg-transparent h-10">
                    <TableHead className="w-12 text-center text-xs font-medium text-slate-600">ลำดับ</TableHead>
                    <TableHead className="w-32 text-xs font-medium text-slate-600">รหัสสินค้า</TableHead>
                    <TableHead className="min-w-[200px] text-xs font-medium text-slate-600">ชื่อสินค้า</TableHead>
                    <TableHead className="w-20 text-xs font-medium text-slate-600">หน่วย</TableHead>
                    <TableHead className="w-24 text-xs font-medium text-slate-600">จำนวน</TableHead>
                    <TableHead className="w-28 text-xs font-medium text-slate-600">ราคาต่อหน่วย</TableHead>
                    <TableHead className="w-28 text-right text-xs font-medium text-slate-600">รวม</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, idx) => (
                    <TableRow key={idx} data-testid={`row-item-${idx}`} className="hover:bg-slate-50/50 border-b">
                      <TableCell className="text-center text-sm text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell>
                        <Input
                          data-testid={`input-product-code-${idx}`}
                          value={item.productCode}
                          onChange={e => updateItem(idx, "productCode", e.target.value)}
                          className="h-8 text-sm"
                          placeholder="รหัส"
                          readOnly
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={item.productId ? String(item.productId) : ""}
                          onValueChange={val => handleProductSelect(idx, val)}
                        >
                          <SelectTrigger className="h-8 text-sm" data-testid={`select-product-${idx}`}>
                            <SelectValue placeholder="เลือกสินค้า">
                              {item.productName || "เลือกสินค้า"}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {products.map(p => (
                              <SelectItem key={p.id} value={String(p.id)}>
                                {p.code ? `[${p.code}] ` : ""}{p.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          data-testid={`input-unit-${idx}`}
                          value={item.unit}
                          onChange={e => updateItem(idx, "unit", e.target.value)}
                          className="h-8 text-sm"
                          placeholder="หน่วย"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          data-testid={`input-quantity-${idx}`}
                          type="number"
                          value={item.quantity}
                          onChange={e => updateItem(idx, "quantity", e.target.value)}
                          className="h-8 text-sm"
                          min="0"
                          step="1"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          data-testid={`input-unit-cost-${idx}`}
                          type="number"
                          value={item.unitCost}
                          onChange={e => updateItem(idx, "unitCost", e.target.value)}
                          className="h-8 text-sm"
                          min="0"
                          step="0.01"
                        />
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm" data-testid={`text-item-total-${idx}`}>
                        {fmt(calcItemTotal(item))}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50"
                          onClick={() => removeItem(idx)}
                          disabled={items.length === 1}
                          data-testid={`button-remove-item-${idx}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-slate-50 font-semibold hover:bg-slate-50">
                    <TableCell colSpan={6} className="text-right text-sm text-slate-700">
                      รวมทั้งสิ้น
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm text-[#fb9678]" data-testid="text-grand-total">
                      {fmt(calcGrandTotal())}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-3 pt-2 pb-4">
          <Button
            variant="outline"
            className="h-9 text-sm"
            onClick={() => navigate(reqBasePath)}
            data-testid="button-cancel"
          >
            ยกเลิก
          </Button>
          <Button
            className="h-9 text-sm text-white gap-1.5"
            style={{ background: "#fb9678" }}
            onClick={handleSubmit}
            disabled={isSaving}
            data-testid="button-save"
          >
            <Save className="h-4 w-4" />
            {isSaving ? "กำลังบันทึก..." : "บันทึก"}
          </Button>
        </div>
      </div>
    </LayoutComponent>
  );
}
