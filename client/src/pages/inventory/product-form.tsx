import Layout from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ArrowLeft, Save, AlertTriangle, Package, ChevronsUpDown, Check, Wand2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { useState, useEffect, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/use-language";
import { useLocation, useParams } from "wouter";
import type { Product, Account } from "@shared/schema";

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

const CATEGORIES = [
  { value: "product", label: "สินค้า" },
  { value: "service", label: "บริการ" },
  { value: "raw_material", label: "วัตถุดิบ" },
  { value: "consumable", label: "วัสดุสิ้นเปลือง" },
];

const DEFAULT_UNITS = ["ชิ้น", "กล่อง", "ถุง", "แพ็ค", "ขวด", "กก.", "กรัม", "ลิตร", "มล.", "เมตร", "ซม.", "ตร.ม.", "ม้วน", "แผ่น", "ใบ", "คู่", "โหล", "ลัง", "พาเลท", "ถัง", "หลอด", "ซอง", "กระป๋อง", "ขวด", "ชั่วโมง", "วัน", "เดือน", "ครั้ง", "งาน", "ชุด", "เส้น", "ตัว", "ผืน", "คัน", "เล่ม"];

const VAT_TYPES = [
  { value: "vat7", label: "VAT 7%" },
  { value: "non_vat", label: "ไม่มี VAT" },
  { value: "zero_rated", label: "VAT 0% (ส่งออก)" },
];

const PRODUCT_TYPES = [
  { value: "simple", label: "สินค้าทั่วไป" },
  { value: "bundle", label: "สินค้าจัดชุด (Bundle)" },
  { value: "manufactured", label: "สินค้าผลิต (BOM)" },
];

export default function ProductForm() {
  const { selectedCompanyId } = useCompany();
  const { toast } = useToast();
  const { acctName } = useLanguage();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const params = useParams<{ id: string }>();
  const editingId = params.id ? Number(params.id) : null;

  const [form, setForm] = useState({
    code: "",
    barcode: "",
    name: "",
    nameEn: "",
    nameZh: "",
    description: "",
    category: "product",
    unit: "ชิ้น",
    price: "0",
    cost: "0",
    priceRetail: "0",
    priceWholesale: "0",
    priceAgent: "0",
    priceSpecial: "0",
    priceVip: "0",
    vatIncluded: false,
    accountCode: "",
    vatType: "vat7",
    productType: "simple",
    trackLots: false,
    imageUrl: "",
  });

  const [unitSearch, setUnitSearch] = useState("");
  const [unitOpen, setUnitOpen] = useState(false);

  const debouncedCode = useDebouncedValue(form.code, 400);
  const debouncedName = useDebouncedValue(form.name, 400);

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/products?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  useEffect(() => {
    if (editingId) {
      const product = products.find(p => p.id === editingId);
      if (product) {
        setForm({
          code: product.code,
          barcode: (product as any).barcode || "",
          name: product.name,
          nameEn: product.nameEn || "",
          nameZh: product.nameZh || "",
          description: product.description || "",
          category: product.category,
          unit: product.unit,
          price: product.price,
          cost: product.cost || "0",
          priceRetail: (product as any).priceRetail || "0",
          priceWholesale: (product as any).priceWholesale || "0",
          priceAgent: (product as any).priceAgent || "0",
          priceSpecial: (product as any).priceSpecial || "0",
          priceVip: (product as any).priceVip || "0",
          vatIncluded: product.vatIncluded,
          accountCode: product.accountCode || "",
          vatType: (product as any).vatType || "vat7",
          productType: (product as any).productType || "simple",
          trackLots: (product as any).trackLots || false,
          imageUrl: (product as any).imageUrl || "",
        });
      }
    }
  }, [editingId, products]);

  const { data: duplicates = [] } = useQuery<Product[]>({
    queryKey: ["/api/products/check-duplicates", selectedCompanyId, debouncedCode, debouncedName, editingId],
    queryFn: async () => {
      const params = new URLSearchParams({ companyId: String(selectedCompanyId) });
      if (debouncedCode) params.set("code", debouncedCode);
      if (debouncedName && debouncedName.length >= 2) params.set("name", debouncedName);
      if (editingId) params.set("excludeId", String(editingId));
      const r = await fetch(`/api/products/check-duplicates?${params}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId && (!!debouncedCode || (!!debouncedName && debouncedName.length >= 2)),
  });

  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ["/api/accounts", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/accounts?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const codeDup = duplicates.filter(d => d.code === form.code.trim());
  const nameDup = duplicates.filter(d => !codeDup.includes(d));

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...data, companyId: selectedCompanyId }),
      });
      if (!r.ok) {
        const body = await r.json();
        throw new Error(body.message);
      }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "เพิ่มสินค้าสำเร็จ", variant: "success" as any });
      navigate("/inventory/list");
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const r = await fetch(`/api/products/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "แก้ไขสินค้าสำเร็จ", variant: "success" as any });
      navigate("/inventory/list");
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const generateBarcodeMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/products/generate-barcode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ companyId: selectedCompanyId }),
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: (data: { barcode: string }) => {
      setForm(f => ({ ...f, barcode: data.barcode }));
      toast({ title: "สร้างบาร์โค้ดสำเร็จ", variant: "success" as any });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  function handleSubmit() {
    if (!form.code || !form.name) {
      toast({ title: "กรุณากรอกรหัสและชื่อสินค้า", variant: "destructive" });
      return;
    }
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: form });
    } else {
      createMutation.mutate(form);
    }
  }

  const revenueAccounts = accounts.filter(a => a.code.startsWith("4"));
  const purchaseAccounts = useMemo(() => {
    if (form.category === "raw_material") return accounts.filter(a => a.code.startsWith("130") || a.code.startsWith("5"));
    if (form.category === "consumable") return accounts.filter(a => a.code.startsWith("5") || a.code.startsWith("130"));
    if (form.category === "product") return accounts.filter(a => a.code.startsWith("130") || a.code.startsWith("5") || a.code.startsWith("4"));
    return accounts.filter(a => a.code.startsWith("4") || a.code.startsWith("5"));
  }, [accounts, form.category]);
  const accountLabel = form.category === "raw_material" ? "บัญชีวัตถุดิบ/ต้นทุน" : form.category === "consumable" ? "บัญชีวัสดุสิ้นเปลือง" : form.category === "product" ? "บัญชีสินค้า/รายได้" : "บัญชีรายได้";

  const allUnits = useMemo(() => {
    const custom = products.map(p => p.unit).filter(u => u && !DEFAULT_UNITS.includes(u));
    return Array.from(new Set([...DEFAULT_UNITS, ...custom]));
  }, [products]);

  const filteredUnits = unitSearch
    ? allUnits.filter(u => u.toLowerCase().includes(unitSearch.toLowerCase()))
    : allUnits;

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button data-testid="button-back" variant="ghost" size="icon" onClick={() => navigate("/inventory/list")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Package className="h-5 w-5 text-primary" />
            <h1 data-testid="text-page-title" className="text-xl font-heading font-bold">
              {editingId ? "แก้ไขสินค้า/บริการ" : "เพิ่มสินค้า/บริการใหม่"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button data-testid="button-cancel" variant="outline" onClick={() => navigate("/inventory/list")}>ยกเลิก</Button>
            <Button data-testid="button-save" className="gap-2" onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending || (!editingId && codeDup.length > 0)}>
              <Save className="h-4 w-4" />
              {editingId ? "บันทึก" : "เพิ่มสินค้า"}
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">ข้อมูลทั่วไป</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>รหัสสินค้า *</Label>
                <Input data-testid="input-code" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="P001"
                  className={codeDup.length > 0 ? "border-red-500 focus-visible:ring-red-500" : ""} />
                {codeDup.length > 0 && (
                  <p data-testid="text-code-duplicate" className="text-xs text-red-600 mt-1 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> รหัสนี้ถูกใช้แล้ว: {codeDup[0].name} ({codeDup[0].code})
                  </p>
                )}
              </div>
              <div>
                <Label>บาร์โค้ด</Label>
                <div className="flex gap-2">
                  <Input data-testid="input-barcode" value={form.barcode} onChange={e => setForm(f => ({ ...f, barcode: e.target.value }))} placeholder="8850000000000" className="flex-1" />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    data-testid="button-generate-barcode"
                    className="h-9 px-3 gap-1 text-xs whitespace-nowrap"
                    onClick={() => generateBarcodeMutation.mutate()}
                    disabled={generateBarcodeMutation.isPending}
                  >
                    <Wand2 className="h-3.5 w-3.5" />
                    สร้างอัตโนมัติ
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">EAN-13 (13 หลัก) กรอกเองหรือกดสร้างอัตโนมัติ</p>
              </div>
              <div>
                <Label>รูปสินค้า (URL)</Label>
                <Input data-testid="input-image-url" value={form.imageUrl} onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))} placeholder="https://example.com/image.jpg" />
                {form.imageUrl && (
                  <div className="mt-2 flex items-center gap-3">
                    <img src={form.imageUrl} alt="preview" className="w-16 h-16 object-cover rounded border" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    <Button type="button" variant="ghost" size="sm" className="text-xs text-red-500" onClick={() => setForm(f => ({ ...f, imageUrl: "" }))}>ลบรูป</Button>
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-1">ใส่ URL รูปภาพ หรือว่างไว้ก็ได้</p>
              </div>
              <div>
                <Label>หมวดหมู่</Label>
                <Select value={form.category} onValueChange={v => {
                  const defaultAccMap: Record<string, string> = { raw_material: "1302000", consumable: "5401000", product: "1301000", service: "4101000" };
                  const allDefaults = Object.values(defaultAccMap);
                  const suggestedCode = defaultAccMap[v] || "";
                  setForm(f => {
                    const shouldUpdate = !f.accountCode || allDefaults.includes(f.accountCode);
                    return { ...f, category: v, accountCode: shouldUpdate ? suggestedCode : f.accountCode };
                  });
                }}>
                  <SelectTrigger data-testid="select-category"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>🇹🇭 ชื่อสินค้า *</Label>
              <Input data-testid="input-name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="สินค้าตัวอย่าง" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>🇬🇧 Name (EN)</Label>
                <Input data-testid="input-name-en" value={form.nameEn} onChange={e => setForm(f => ({ ...f, nameEn: e.target.value }))} placeholder="Sample Product" />
              </div>
              <div>
                <Label>🇨🇳 名称 (ZH)</Label>
                <Input data-testid="input-name-zh" value={form.nameZh} onChange={e => setForm(f => ({ ...f, nameZh: e.target.value }))} />
              </div>
            </div>

            <div>
              <Label>รายละเอียด</Label>
              <Textarea data-testid="input-description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
            </div>

            {nameDup.length > 0 && (
              <div data-testid="text-name-similar" className="rounded-md border border-amber-300 bg-amber-50 p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-amber-800 mb-2">
                  <AlertTriangle className="h-4 w-4" /> พบสินค้าที่มีชื่อคล้ายกัน
                </div>
                <div className="space-y-1">
                  {nameDup.slice(0, 5).map(d => (
                    <div key={d.id} className="text-xs text-amber-700 flex items-center gap-2">
                      <span>{d.code}</span>
                      <span>{d.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">ราคาและหน่วย</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>ราคาขาย (ทั่วไป)</Label>
                <Input data-testid="input-price" type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
              </div>
              <div>
                <Label>ต้นทุน</Label>
                <Input data-testid="input-cost" type="number" value={form.cost} onChange={e => setForm(f => ({ ...f, cost: e.target.value }))} />
              </div>
              <div>
                <Label>หน่วย</Label>
                <Popover open={unitOpen} onOpenChange={setUnitOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between font-normal" data-testid="select-unit">
                      {form.unit || "เลือกหน่วย"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-2" align="start">
                    <Input placeholder="ค้นหาหรือพิมพ์หน่วยใหม่..." value={unitSearch} onChange={e => setUnitSearch(e.target.value)} className="mb-2" data-testid="input-unit-search" />
                    <div className="max-h-48 overflow-y-auto space-y-0.5">
                      {filteredUnits.map(u => (
                        <button key={u} className={`w-full text-left px-2 py-1.5 rounded text-sm hover:bg-accent flex items-center gap-2 ${form.unit === u ? "bg-accent" : ""}`}
                          onClick={() => { setForm(f => ({ ...f, unit: u })); setUnitOpen(false); setUnitSearch(""); }}>
                          {form.unit === u && <Check className="h-3.5 w-3.5" />}
                          <span className={form.unit === u ? "" : "ml-5"}>{u}</span>
                        </button>
                      ))}
                      {unitSearch && !allUnits.includes(unitSearch) && (
                        <button className="w-full text-left px-2 py-1.5 rounded text-sm hover:bg-accent text-[#fec90f] font-medium"
                          data-testid="button-add-unit"
                          onClick={() => { setForm(f => ({ ...f, unit: unitSearch })); setUnitOpen(false); setUnitSearch(""); }}>
                          เพิ่ม "{unitSearch}" เป็นหน่วยใหม่
                        </button>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="mt-4 border-t pt-4">
              <p className="text-sm font-medium text-muted-foreground mb-3">ราคาขายหลายระดับ (Multi-level Pricing)</p>
              <div className="grid grid-cols-5 gap-3">
                <div>
                  <Label className="text-xs">ราคาขายปลีก</Label>
                  <Input data-testid="input-price-retail" type="number" value={form.priceRetail} onChange={e => setForm(f => ({ ...f, priceRetail: e.target.value }))} placeholder="0" />
                </div>
                <div>
                  <Label className="text-xs">ราคาขายส่ง</Label>
                  <Input data-testid="input-price-wholesale" type="number" value={form.priceWholesale} onChange={e => setForm(f => ({ ...f, priceWholesale: e.target.value }))} placeholder="0" />
                </div>
                <div>
                  <Label className="text-xs">ราคาตัวแทน</Label>
                  <Input data-testid="input-price-agent" type="number" value={form.priceAgent} onChange={e => setForm(f => ({ ...f, priceAgent: e.target.value }))} placeholder="0" />
                </div>
                <div>
                  <Label className="text-xs">ราคาพิเศษ</Label>
                  <Input data-testid="input-price-special" type="number" value={form.priceSpecial} onChange={e => setForm(f => ({ ...f, priceSpecial: e.target.value }))} placeholder="0" />
                </div>
                <div>
                  <Label className="text-xs">ราคา VIP</Label>
                  <Input data-testid="input-price-vip" type="number" value={form.priceVip} onChange={e => setForm(f => ({ ...f, priceVip: e.target.value }))} placeholder="0" />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox data-testid="checkbox-vat-included" checked={form.vatIncluded} onCheckedChange={c => setForm(f => ({ ...f, vatIncluded: !!c }))} />
                <Label className="text-sm cursor-pointer">ราคารวม VAT แล้ว</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox data-testid="checkbox-track-lots" checked={form.trackLots} onCheckedChange={c => setForm(f => ({ ...f, trackLots: !!c }))} />
                <Label className="text-sm cursor-pointer">ติดตามล็อตการผลิต / วันหมดอายุ</Label>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">ประเภทและบัญชี</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>ประเภท VAT</Label>
                <Select value={form.vatType} onValueChange={v => setForm(f => ({ ...f, vatType: v }))}>
                  <SelectTrigger data-testid="select-vat-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {VAT_TYPES.map(v => <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>ประเภทสินค้า</Label>
                <Select value={form.productType} onValueChange={v => setForm(f => ({ ...f, productType: v }))}>
                  <SelectTrigger data-testid="select-product-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRODUCT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{accountLabel}</Label>
                <Select value={form.accountCode || "__none__"} onValueChange={v => setForm(f => ({ ...f, accountCode: v === "__none__" ? "" : v }))}>
                  <SelectTrigger data-testid="select-account"><SelectValue placeholder="เลือกบัญชี" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">ไม่ระบุ</SelectItem>
                    {purchaseAccounts.map(a => <SelectItem key={a.code} value={a.code}>{a.code} - {acctName(a)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-2 pb-4">
          <Button data-testid="button-cancel-bottom" variant="outline" onClick={() => navigate("/inventory/list")}>ยกเลิก</Button>
          <Button data-testid="button-save-bottom" className="gap-2" onClick={handleSubmit}
            disabled={createMutation.isPending || updateMutation.isPending}>
            <Save className="h-4 w-4" />
            {editingId ? "บันทึก" : "เพิ่มสินค้า"}
          </Button>
        </div>
      </div>
    </Layout>
  );
}
