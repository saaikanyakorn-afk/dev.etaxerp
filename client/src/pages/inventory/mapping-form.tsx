import Layout from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save, ArrowRightLeft } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useLocation, useParams } from "wouter";
import type { Product } from "@shared/schema";

type MappingForm = { sellProductId: number | ""; buyProductId: number | ""; conversionRate: string; sellUnit: string; buyUnit: string; notes: string };
const emptyMapping: MappingForm = { sellProductId: "", buyProductId: "", conversionRate: "1", sellUnit: "ชิ้น", buyUnit: "ชิ้น", notes: "" };

export default function MappingFormPage() {
  const { selectedCompanyId } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const params = useParams<{ id: string }>();
  const editingId = params.id ? Number(params.id) : null;

  const [form, setForm] = useState<MappingForm>({ ...emptyMapping });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/products?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const { data: mappings = [] } = useQuery<any[]>({
    queryKey: ["/api/product-mappings", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/product-mappings?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId && !!editingId,
  });

  useEffect(() => {
    if (editingId && mappings.length > 0) {
      const m = mappings.find((m: any) => m.id === editingId);
      if (m) {
        setForm({
          sellProductId: m.sellProductId,
          buyProductId: m.buyProductId,
          conversionRate: String(m.conversionRate),
          sellUnit: m.sellUnit,
          buyUnit: m.buyUnit,
          notes: m.notes || "",
        });
      }
    }
  }, [editingId, mappings]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch("/api/product-mappings", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ ...data, companyId: selectedCompanyId }) });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/product-mappings"] });
      toast({ title: "เพิ่มการเชื่อมโยงสำเร็จ", variant: "success" as any });
      navigate("/inventory/product-mapping");
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const r = await fetch(`/api/product-mappings/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(data) });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/product-mappings"] });
      toast({ title: "แก้ไขการเชื่อมโยงสำเร็จ", variant: "success" as any });
      navigate("/inventory/product-mapping");
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  function handleSubmit() {
    if (!form.sellProductId || !form.buyProductId) {
      toast({ title: "กรุณาเลือกสินค้าขายและสินค้าซื้อ", variant: "destructive" });
      return;
    }
    const payload = {
      sellProductId: Number(form.sellProductId),
      buyProductId: Number(form.buyProductId),
      conversionRate: form.conversionRate,
      sellUnit: form.sellUnit,
      buyUnit: form.buyUnit,
      notes: form.notes,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const activeProducts = products.filter(p => p.active);
  const sellProduct = products.find(p => p.id === Number(form.sellProductId));
  const buyProduct = products.find(p => p.id === Number(form.buyProductId));

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button data-testid="button-back" variant="ghost" size="icon" onClick={() => navigate("/inventory/product-mapping")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <ArrowRightLeft className="h-5 w-5 text-primary" />
            <h1 data-testid="text-page-title" className="text-xl font-heading font-bold">
              {editingId ? "แก้ไขการเชื่อมโยง" : "เพิ่มการเชื่อมโยงสินค้า"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button data-testid="button-cancel" variant="outline" onClick={() => navigate("/inventory/product-mapping")}>ยกเลิก</Button>
            <Button data-testid="button-save" className="gap-2" onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}>
              <Save className="h-4 w-4" />
              {editingId ? "บันทึก" : "เพิ่ม"}
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">ข้อมูลการเชื่อมโยง</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>สินค้าขาย *</Label>
                <Select value={String(form.sellProductId)} onValueChange={v => setForm(f => ({ ...f, sellProductId: Number(v) }))}>
                  <SelectTrigger data-testid="select-sell-product"><SelectValue placeholder="เลือกสินค้าขาย" /></SelectTrigger>
                  <SelectContent>
                    {activeProducts.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.code} - {p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>สินค้าซื้อ (ตัดสต๊อก) *</Label>
                <Select value={String(form.buyProductId)} onValueChange={v => setForm(f => ({ ...f, buyProductId: Number(v) }))}>
                  <SelectTrigger data-testid="select-buy-product"><SelectValue placeholder="เลือกสินค้าซื้อ" /></SelectTrigger>
                  <SelectContent>
                    {activeProducts.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.code} - {p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>อัตราแปลง</Label>
                <Input type="number" step="0.01" min="0" value={form.conversionRate} onChange={e => setForm(f => ({ ...f, conversionRate: e.target.value }))} data-testid="input-conversion-rate" />
              </div>
              <div>
                <Label>หน่วยขาย</Label>
                <Input value={form.sellUnit} onChange={e => setForm(f => ({ ...f, sellUnit: e.target.value }))} data-testid="input-sell-unit" />
              </div>
              <div>
                <Label>หน่วยซื้อ</Label>
                <Input value={form.buyUnit} onChange={e => setForm(f => ({ ...f, buyUnit: e.target.value }))} data-testid="input-buy-unit" />
              </div>
            </div>
            <div>
              <Label>หมายเหตุ</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)" data-testid="input-mapping-notes" />
            </div>

            {sellProduct && buyProduct && (
              <div className="bg-[#fffcf0] border border-[#fec90f]/20 rounded-md p-3 text-sm" data-testid="text-mapping-preview">
                <span className="font-medium text-[#fec90f]">ตัวอย่าง:</span>{" "}
                <span className="text-[#fec90f]">
                  ขาย "{sellProduct.name}" 1 {form.sellUnit} → ตัดสต๊อก {form.conversionRate} {form.buyUnit} ของ "{buyProduct.name}"
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-2 pb-4">
          <Button data-testid="button-cancel-bottom" variant="outline" onClick={() => navigate("/inventory/product-mapping")}>ยกเลิก</Button>
          <Button data-testid="button-save-bottom" className="gap-2" onClick={handleSubmit}
            disabled={createMutation.isPending || updateMutation.isPending}>
            <Save className="h-4 w-4" /> บันทึก
          </Button>
        </div>
      </div>
    </Layout>
  );
}
