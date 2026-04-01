import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useCompany } from "@/lib/company-context";
import EcommerceLayout from "@/components/ecommerce-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Package, Link2, Search, Plus, CheckCircle2, AlertCircle, Zap, ShoppingBag, ArrowRight, Sparkles, RefreshCw } from "lucide-react";

interface UnmappedSku {
  platformSku: string;
  platformName: string;
  platform: string;
  orderCount: number;
  totalQty: number;
  totalRevenue: number;
  firstSeen: string;
  lastSeen: string;
  suggestedProducts: { id: number; code: string; name: string; score: number }[];
}

interface InternalProduct {
  id: number;
  code: string;
  name: string;
  category: string;
  unit: string;
  cost: string;
  barcode: string | null;
}

export default function SkuSmartMapping() {
  const { selectedCompanyId } = useCompany();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [searchFilter, setSearchFilter] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [mappingDialog, setMappingDialog] = useState<UnmappedSku | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [createDialog, setCreateDialog] = useState<UnmappedSku | null>(null);
  const [newProduct, setNewProduct] = useState({ code: "", name: "", unit: "ชิ้น", category: "product", cost: "0" });
  const [selectedMapping, setSelectedMapping] = useState<{ productId: number; conversionRate: string } | null>(null);

  const { data: unmappedData, isLoading } = useQuery({
    queryKey: ["/api/ecommerce/sku-mapping/unmapped", selectedCompanyId, platformFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ companyId: String(selectedCompanyId) });
      if (platformFilter !== "all") params.set("platform", platformFilter);
      const r = await fetch(`/api/ecommerce/sku-mapping/unmapped?${params}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch");
      return r.json() as Promise<{ unmapped: UnmappedSku[]; stats: { totalUnmapped: number; totalMapped: number; totalOrders: number; totalRevenue: number } }>;
    },
    enabled: !!selectedCompanyId,
  });

  const { data: productsData } = useQuery({
    queryKey: ["/api/products", selectedCompanyId, "for-mapping"],
    queryFn: async () => {
      const r = await fetch(`/api/products?companyId=${selectedCompanyId}&limit=5000`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json() as Promise<{ id: number; code: string; name: string; category: string; unit: string; cost: string; barcode: string | null }[]>;
    },
    enabled: !!selectedCompanyId,
  });

  const allProducts: InternalProduct[] = Array.isArray(productsData) ? productsData : [];

  const saveMappingMut = useMutation({
    mutationFn: async (data: { platformSku: string; productId: number; conversionRate?: number; platform?: string }) =>
      apiRequest("POST", "/api/ecommerce/sku-mapping/save", { ...data, companyId: selectedCompanyId }),
    onSuccess: (_, vars) => {
      toast({ title: "จับคู่สำเร็จ!", description: `SKU "${vars.platformSku}" เชื่อมโยงแล้ว` });
      qc.invalidateQueries({ queryKey: ["/api/ecommerce/sku-mapping/unmapped"] });
      setMappingDialog(null);
      setSelectedMapping(null);
    },
    onError: (e: any) => toast({ title: "เกิดข้อผิดพลาด", description: e.message, variant: "destructive" }),
  });

  const createAndMapMut = useMutation({
    mutationFn: async (data: { platformSku: string; platform: string; product: typeof newProduct }) =>
      apiRequest("POST", "/api/ecommerce/sku-mapping/create-and-map", { ...data, companyId: selectedCompanyId }),
    onSuccess: (_, vars) => {
      toast({ title: "สร้างสินค้าและจับคู่สำเร็จ!", description: `สร้างสินค้าจาก "${vars.platformSku}" แล้ว` });
      qc.invalidateQueries({ queryKey: ["/api/ecommerce/sku-mapping/unmapped"] });
      qc.invalidateQueries({ queryKey: ["/api/products"] });
      setCreateDialog(null);
      setNewProduct({ code: "", name: "", unit: "ชิ้น", category: "product", cost: "0" });
    },
    onError: (e: any) => toast({ title: "เกิดข้อผิดพลาด", description: e.message, variant: "destructive" }),
  });

  const autoMatchMut = useMutation({
    mutationFn: async () =>
      apiRequest("POST", "/api/ecommerce/sku-mapping/auto-match", { companyId: selectedCompanyId }),
    onSuccess: (res: any) => {
      toast({ title: "จับคู่อัตโนมัติเสร็จ!", description: `จับคู่ได้ ${res.matched || 0} รายการ` });
      qc.invalidateQueries({ queryKey: ["/api/ecommerce/sku-mapping/unmapped"] });
    },
    onError: (e: any) => toast({ title: "เกิดข้อผิดพลาด", description: e.message, variant: "destructive" }),
  });

  const stats = unmappedData?.stats;
  const unmapped = (unmappedData?.unmapped || []).filter(s => {
    if (!searchFilter) return true;
    const q = searchFilter.toLowerCase();
    return s.platformSku.toLowerCase().includes(q) || s.platformName.toLowerCase().includes(q);
  });

  const filteredProducts = allProducts.filter(p => {
    if (!productSearch) return true;
    const q = productSearch.toLowerCase();
    return p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q) || (p.barcode || "").toLowerCase().includes(q);
  }).slice(0, 50);

  const openCreateDialog = (sku: UnmappedSku) => {
    const suggestedCode = sku.platformSku.replace(/[^a-zA-Z0-9]/g, "").substring(0, 20).toUpperCase();
    setNewProduct({
      code: suggestedCode || "NEW",
      name: sku.platformName,
      unit: "ชิ้น",
      category: "product",
      cost: "0",
    });
    setCreateDialog(sku);
  };

  const getPlatformColor = (p: string) => {
    const colors: Record<string, string> = { shopee: "text-orange-600 bg-orange-50", lazada: "text-blue-600 bg-blue-50", tiktok: "text-gray-800 bg-gray-100" };
    return colors[p?.toLowerCase()] || "text-gray-600 bg-gray-50";
  };
  const getPlatformLabel = (p: string) => {
    const labels: Record<string, string> = { shopee: "Shopee", lazada: "Lazada", tiktok: "TikTok" };
    return labels[p?.toLowerCase()] || p;
  };

  return (
    <EcommerceLayout>
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-sku-mapping-title">
            <Sparkles className="h-6 w-6 text-amber-500" />
            จับคู่ SKU อัจฉริยะ
          </h1>
          <p className="text-gray-500 text-sm mt-1">จับคู่รหัสสินค้าแพลตฟอร์มกับสินค้าในระบบ — ทำครั้งเดียว ใช้ได้ตลอด</p>
        </div>
        <Button
          onClick={() => autoMatchMut.mutate()}
          disabled={autoMatchMut.isPending}
          className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white gap-2"
          data-testid="btn-auto-match"
        >
          <Zap className="h-4 w-4" />
          {autoMatchMut.isPending ? "กำลังจับคู่..." : "จับคู่อัตโนมัติ"}
        </Button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-red-200 bg-red-50/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg"><AlertCircle className="h-5 w-5 text-red-600" /></div>
              <div>
                <p className="text-2xl font-bold text-red-700" data-testid="text-unmapped-count">{stats.totalUnmapped}</p>
                <p className="text-xs text-red-500">SKU ยังไม่จับคู่</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-green-200 bg-green-50/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg"><CheckCircle2 className="h-5 w-5 text-green-600" /></div>
              <div>
                <p className="text-2xl font-bold text-green-700" data-testid="text-mapped-count">{stats.totalMapped}</p>
                <p className="text-xs text-green-500">SKU จับคู่แล้ว</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg"><ShoppingBag className="h-5 w-5 text-blue-600" /></div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-affected-orders">{stats.totalOrders.toLocaleString()}</p>
                <p className="text-xs text-gray-500">ออเดอร์ที่เกี่ยวข้อง</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg"><Package className="h-5 w-5 text-amber-600" /></div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-total-revenue">฿{stats.totalRevenue.toLocaleString()}</p>
                <p className="text-xs text-gray-500">ยอดขายที่ยังไม่ตัดสต๊อก</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <CardTitle className="text-base">SKU ที่ยังไม่จับคู่</CardTitle>
            <div className="flex gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="ค้นหา SKU หรือชื่อสินค้า..."
                  value={searchFilter}
                  onChange={e => setSearchFilter(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-sku"
                />
              </div>
              <Select value={platformFilter} onValueChange={setPlatformFilter}>
                <SelectTrigger className="w-32" data-testid="select-platform-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกแพลตฟอร์ม</SelectItem>
                  <SelectItem value="shopee">Shopee</SelectItem>
                  <SelectItem value="lazada">Lazada</SelectItem>
                  <SelectItem value="tiktok">TikTok</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12 text-gray-400">กำลังโหลด...</div>
          ) : unmapped.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle2 className="h-12 w-12 mx-auto text-green-400 mb-3" />
              <p className="text-gray-500 font-medium">จับคู่ SKU ครบทุกรายการแล้ว!</p>
              <p className="text-gray-400 text-sm mt-1">สินค้าทุกตัวเชื่อมโยงกับระบบเรียบร้อย</p>
            </div>
          ) : (
            <div className="space-y-2">
              {unmapped.map((sku, idx) => (
                <div
                  key={`${sku.platformSku}-${sku.platform}-${idx}`}
                  className="flex items-center gap-4 p-3 rounded-lg border hover:border-amber-300 hover:bg-amber-50/30 transition-all group"
                  data-testid={`row-unmapped-sku-${idx}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getPlatformColor(sku.platform)}`}>
                        {getPlatformLabel(sku.platform)}
                      </span>
                      <code className="text-sm font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-700 truncate max-w-[200px]" title={sku.platformSku}>
                        {sku.platformSku}
                      </code>
                    </div>
                    <p className="text-sm text-gray-600 truncate" title={sku.platformName}>{sku.platformName}</p>
                  </div>

                  <div className="hidden md:flex items-center gap-6 text-sm text-gray-500">
                    <div className="text-center">
                      <p className="font-semibold text-gray-700">{sku.orderCount}</p>
                      <p className="text-xs">ออเดอร์</p>
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-gray-700">{Number(sku.totalQty).toLocaleString()}</p>
                      <p className="text-xs">ชิ้นขาย</p>
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-amber-600">฿{Number(sku.totalRevenue).toLocaleString()}</p>
                      <p className="text-xs">ยอดขาย</p>
                    </div>
                  </div>

                  {sku.suggestedProducts.length > 0 && (
                    <div className="hidden lg:block">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-green-400 text-green-700 hover:bg-green-50 gap-1"
                        onClick={() => {
                          const best = sku.suggestedProducts[0];
                          saveMappingMut.mutate({ platformSku: sku.platformSku, productId: best.id, platform: sku.platform });
                        }}
                        data-testid={`btn-quick-match-${idx}`}
                      >
                        <Zap className="h-3 w-3" />
                        จับคู่ "{sku.suggestedProducts[0].code}"
                      </Button>
                    </div>
                  )}

                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-blue-400 text-blue-700 hover:bg-blue-50 gap-1"
                      onClick={() => { setMappingDialog(sku); setProductSearch(""); setSelectedMapping(null); }}
                      data-testid={`btn-map-${idx}`}
                    >
                      <Link2 className="h-3 w-3" />
                      <span className="hidden sm:inline">เลือกสินค้า</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-amber-400 text-amber-700 hover:bg-amber-50 gap-1"
                      onClick={() => openCreateDialog(sku)}
                      data-testid={`btn-create-${idx}`}
                    >
                      <Plus className="h-3 w-3" />
                      <span className="hidden sm:inline">สร้างใหม่</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!mappingDialog} onOpenChange={() => setMappingDialog(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-blue-500" />
              เชื่อมโยง SKU กับสินค้า
            </DialogTitle>
          </DialogHeader>
          {mappingDialog && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">SKU แพลตฟอร์ม</p>
                <code className="font-mono text-sm font-semibold">{mappingDialog.platformSku}</code>
                <p className="text-sm text-gray-600 mt-1">{mappingDialog.platformName}</p>
                <p className="text-xs text-gray-400 mt-1">{mappingDialog.orderCount} ออเดอร์ | {Number(mappingDialog.totalQty).toLocaleString()} ชิ้น</p>
              </div>

              <div className="flex items-center justify-center">
                <ArrowRight className="h-5 w-5 text-gray-400" />
              </div>

              <div>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="ค้นหาสินค้า (รหัส / ชื่อ / บาร์โค้ด)..."
                    value={productSearch}
                    onChange={e => setProductSearch(e.target.value)}
                    className="pl-9"
                    data-testid="input-search-product"
                  />
                </div>
                <div className="max-h-[280px] overflow-y-auto space-y-1 border rounded-lg p-2">
                  {filteredProducts.length === 0 ? (
                    <p className="text-center text-gray-400 py-4 text-sm">ไม่พบสินค้า</p>
                  ) : filteredProducts.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedMapping({ productId: p.id, conversionRate: "1" })}
                      className={`w-full text-left p-2 rounded-lg transition-all flex items-center gap-3 ${selectedMapping?.productId === p.id ? "bg-blue-50 border border-blue-300 ring-1 ring-blue-200" : "hover:bg-gray-50 border border-transparent"}`}
                      data-testid={`btn-select-product-${p.id}`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">[{p.code}] {p.name}</p>
                        <p className="text-xs text-gray-400">{p.category === "raw_material" ? "วัตถุดิบ" : p.category === "product" ? "สินค้า" : p.category} | {p.unit}</p>
                      </div>
                      {selectedMapping?.productId === p.id && <CheckCircle2 className="h-5 w-5 text-blue-500 shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>

              {selectedMapping && (
                <div className="bg-blue-50 rounded-lg p-3 space-y-2">
                  <label className="text-xs font-medium text-blue-700">อัตราแปลงหน่วย (Conversion Rate)</label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">ขาย 1 ชิ้น = ตัดสต๊อก</span>
                    <Input
                      type="number"
                      value={selectedMapping.conversionRate}
                      onChange={e => setSelectedMapping(prev => prev ? { ...prev, conversionRate: e.target.value } : null)}
                      className="w-24 text-center"
                      step="0.01"
                      min="0.001"
                      data-testid="input-conversion-rate"
                    />
                    <span className="text-sm">{allProducts.find(p => p.id === selectedMapping.productId)?.unit || "หน่วย"}</span>
                  </div>
                  <p className="text-xs text-blue-500">ปกติ = 1 (1 ชิ้นขาย ตัด 1 ชิ้นสต๊อก) | ถ้าแบ่งบรรจุ เช่น 1 กก. ทำ 10 ซอง ให้ใส่ 0.1</p>
                </div>
              )}

              <Button
                className="w-full bg-blue-600 hover:bg-blue-700 text-white gap-2"
                disabled={!selectedMapping || saveMappingMut.isPending}
                onClick={() => {
                  if (!selectedMapping) return;
                  saveMappingMut.mutate({
                    platformSku: mappingDialog.platformSku,
                    productId: selectedMapping.productId,
                    conversionRate: parseFloat(selectedMapping.conversionRate) || 1,
                    platform: mappingDialog.platform,
                  });
                }}
                data-testid="btn-confirm-mapping"
              >
                <CheckCircle2 className="h-4 w-4" />
                {saveMappingMut.isPending ? "กำลังบันทึก..." : "ยืนยันจับคู่ + อัพเดทย้อนหลัง"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!createDialog} onOpenChange={() => setCreateDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-amber-500" />
              สร้างสินค้าใหม่จาก SKU
            </DialogTitle>
          </DialogHeader>
          {createDialog && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">จาก SKU แพลตฟอร์ม</p>
                <code className="font-mono text-sm">{createDialog.platformSku}</code>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">รหัสสินค้า</label>
                  <Input value={newProduct.code} onChange={e => setNewProduct(p => ({ ...p, code: e.target.value }))} data-testid="input-new-code" />
                </div>
                <div>
                  <label className="text-sm font-medium">ชื่อสินค้า</label>
                  <Input value={newProduct.name} onChange={e => setNewProduct(p => ({ ...p, name: e.target.value }))} data-testid="input-new-name" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium">ประเภท</label>
                    <Select value={newProduct.category} onValueChange={v => setNewProduct(p => ({ ...p, category: v }))}>
                      <SelectTrigger data-testid="select-new-category"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="product">สินค้า</SelectItem>
                        <SelectItem value="raw_material">วัตถุดิบ</SelectItem>
                        <SelectItem value="consumable">วัสดุสิ้นเปลือง</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">หน่วย</label>
                    <Input value={newProduct.unit} onChange={e => setNewProduct(p => ({ ...p, unit: e.target.value }))} data-testid="input-new-unit" />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">ราคาทุน (บาท)</label>
                  <Input type="number" value={newProduct.cost} onChange={e => setNewProduct(p => ({ ...p, cost: e.target.value }))} data-testid="input-new-cost" />
                </div>
              </div>
              <Button
                className="w-full bg-amber-500 hover:bg-amber-600 text-white gap-2"
                disabled={!newProduct.code || !newProduct.name || createAndMapMut.isPending}
                onClick={() => {
                  createAndMapMut.mutate({
                    platformSku: createDialog.platformSku,
                    platform: createDialog.platform,
                    product: newProduct,
                  });
                }}
                data-testid="btn-confirm-create"
              >
                <Plus className="h-4 w-4" />
                {createAndMapMut.isPending ? "กำลังสร้าง..." : "สร้างสินค้า + จับคู่ทันที"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
    </EcommerceLayout>
  );
}
