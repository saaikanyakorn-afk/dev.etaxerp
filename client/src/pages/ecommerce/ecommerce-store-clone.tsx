import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Copy, ArrowRight, Search, CheckSquare, Package, Store, ChevronDown, ChevronUp, Loader2 } from "lucide-react";

const platformLabels: Record<string, string> = {
  shopee: "Shopee", lazada: "Lazada", tiktok: "TikTok Shop",
  amazon: "Amazon",
};
const platformColors: Record<string, string> = {
  shopee: "bg-orange-100 text-orange-700", lazada: "bg-blue-100 text-blue-700",
  tiktok: "bg-gray-800 text-white",
  amazon: "bg-amber-100 text-amber-700",
};

export default function EcommerceStoreClone() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const selectedCompanyId = parseInt(localStorage.getItem("selectedCompanyId") || "0");

  const [sourceConnectionId, setSourceConnectionId] = useState<string>("");
  const [targetConnectionId, setTargetConnectionId] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [editingProduct, setEditingProduct] = useState<number | null>(null);
  const [editedProducts, setEditedProducts] = useState<Record<number, any>>({});
  const [mode, setMode] = useState<"mapped" | "all">("all");
  const [step, setStep] = useState(1);

  const { data: connections = [] } = useQuery({
    queryKey: [`/api/ecommerce/clone/connections`, selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/ecommerce/clone/connections?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const { data: productsData, isLoading: loadingProducts } = useQuery({
    queryKey: [`/api/ecommerce/clone/products`, selectedCompanyId, sourceConnectionId],
    queryFn: async () => {
      const r = await fetch(`/api/ecommerce/clone/products?companyId=${selectedCompanyId}&connectionId=${sourceConnectionId}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    enabled: !!selectedCompanyId && !!sourceConnectionId,
  });

  const cloneMutation = useMutation({
    mutationFn: async () => {
      const productList = mode === "mapped" ? productsData?.mappedProducts : productsData?.allProducts;
      const selectedProducts = (productList || [])
        .filter((p: any) => selectedIds.has(p.productId))
        .map((p: any) => {
          const edited = editedProducts[p.productId];
          return {
            productId: p.productId,
            code: edited?.code || p.productCode,
            name: edited?.name || p.productName || p.platformProductName,
            price: edited?.price || p.productPrice,
            cost: edited?.cost || p.productCost,
            description: edited?.description || p.productDescription,
            category: p.productCategory || "product",
            unit: p.productUnit || "ชิ้น",
            vatType: p.productVatType || "vat7",
            platformSku: edited?.platformSku || p.platformSku || p.productCode,
            platformProductId: p.platformProductId,
          };
        });

      const r = await fetch("/api/ecommerce/clone", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: selectedCompanyId,
          sourceConnectionId: sourceConnectionId ? parseInt(sourceConnectionId) : null,
          targetConnectionId: parseInt(targetConnectionId),
          selectedProducts,
        }),
      });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: (data) => {
      toast({
        title: "โคลนสำเร็จ!",
        description: `โคลน ${data.cloned} รายการ, ข้าม ${data.skipped} (ซ้ำ)`,
      });
      setSelectedIds(new Set());
      setEditedProducts({});
      setStep(1);
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.startsWith("/api/ecommerce") });
    },
    onError: () => toast({ title: "เกิดข้อผิดพลาด", variant: "destructive" }),
  });

  const productList = mode === "mapped" ? (productsData?.mappedProducts || []) : (productsData?.allProducts || []);
  const filteredProducts = productList.filter((p: any) => {
    const name = (p.productName || p.platformProductName || "").toLowerCase();
    const code = (p.productCode || "").toLowerCase();
    const sku = (p.platformSku || "").toLowerCase();
    const term = searchTerm.toLowerCase();
    return !term || name.includes(term) || code.includes(term) || sku.includes(term);
  });

  const toggleAll = () => {
    if (selectedIds.size === filteredProducts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProducts.map((p: any) => p.productId)));
    }
  };

  const toggleOne = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const updateEdited = (productId: number, field: string, value: string) => {
    setEditedProducts(prev => ({
      ...prev,
      [productId]: { ...prev[productId], [field]: value },
    }));
  };

  const sourceConn = connections.find((c: any) => c.id === parseInt(sourceConnectionId));
  const targetConn = connections.find((c: any) => c.id === parseInt(targetConnectionId));

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <Copy className="w-6 h-6 text-[#fb9678]" />
        <h1 className="text-xl font-bold" data-testid="text-page-title">โคลนร้านค้า / สินค้า</h1>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${step >= 1 ? "bg-[#fb9678] text-white" : "bg-gray-200 text-gray-500"}`}>1</div>
        <span className={`text-sm ${step >= 1 ? "font-semibold" : "text-gray-400"}`}>เลือกร้านค้า</span>
        <ArrowRight className="w-4 h-4 text-gray-400" />
        <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${step >= 2 ? "bg-[#fb9678] text-white" : "bg-gray-200 text-gray-500"}`}>2</div>
        <span className={`text-sm ${step >= 2 ? "font-semibold" : "text-gray-400"}`}>เลือกสินค้า</span>
        <ArrowRight className="w-4 h-4 text-gray-400" />
        <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${step >= 3 ? "bg-[#fb9678] text-white" : "bg-gray-200 text-gray-500"}`}>3</div>
        <span className={`text-sm ${step >= 3 ? "font-semibold" : "text-gray-400"}`}>ตรวจสอบ & โคลน</span>
      </div>

      {step === 1 && (
        <Card className="flexy-card">
          <CardHeader><CardTitle className="text-base">ขั้นตอนที่ 1: เลือกร้านค้าต้นทางและปลายทาง</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {connections.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Store className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>ยังไม่มีร้านค้าที่เชื่อมต่อ</p>
                <p className="text-sm">กรุณาเชื่อมต่อร้านค้าก่อนใช้งานโคลน</p>
              </div>
            ) : (
              <>
                <div>
                  <label className="text-sm font-medium mb-1 block">ร้านค้าต้นทาง (คัดลอกจาก)</label>
                  <Select value={sourceConnectionId} onValueChange={(v) => { setSourceConnectionId(v); setSelectedIds(new Set()); setMode("all"); }}>
                    <SelectTrigger data-testid="select-source-connection"><SelectValue placeholder="เลือกร้านค้าต้นทาง" /></SelectTrigger>
                    <SelectContent>
                      {connections.map((c: any) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          <span className="flex items-center gap-2">
                            <Badge className={`text-xs ${platformColors[c.platform] || "bg-gray-100"}`}>{platformLabels[c.platform] || c.platform}</Badge>
                            {c.shopName}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-center">
                  <ArrowRight className="w-6 h-6 text-[#fb9678]" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">ร้านค้าปลายทาง (โคลนไปยัง)</label>
                  <Select value={targetConnectionId} onValueChange={setTargetConnectionId}>
                    <SelectTrigger data-testid="select-target-connection"><SelectValue placeholder="เลือกร้านค้าปลายทาง" /></SelectTrigger>
                    <SelectContent>
                      {connections.filter((c: any) => String(c.id) !== sourceConnectionId).map((c: any) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          <span className="flex items-center gap-2">
                            <Badge className={`text-xs ${platformColors[c.platform] || "bg-gray-100"}`}>{platformLabels[c.platform] || c.platform}</Badge>
                            {c.shopName}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  className="w-full bg-[#fb9678] hover:bg-[#fb9678]/90 text-white"
                  disabled={!sourceConnectionId || !targetConnectionId}
                  onClick={() => setStep(2)}
                  data-testid="button-next-step2"
                >
                  ถัดไป — เลือกสินค้า
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card className="flexy-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">ขั้นตอนที่ 2: เลือกสินค้าที่ต้องการโคลน</CardTitle>
              <Button variant="outline" size="sm" onClick={() => { setStep(1); setSelectedIds(new Set()); }} data-testid="button-back-step1">ย้อนกลับ</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg text-sm">
              <Store className="w-4 h-4 text-blue-600" />
              <span>
                {sourceConn && <Badge className={`text-xs mr-1 ${platformColors[sourceConn.platform]}`}>{platformLabels[sourceConn.platform]}</Badge>}
                <strong>{sourceConn?.shopName}</strong>
              </span>
              <ArrowRight className="w-4 h-4 text-blue-600" />
              <span>
                {targetConn && <Badge className={`text-xs mr-1 ${platformColors[targetConn.platform]}`}>{platformLabels[targetConn.platform]}</Badge>}
                <strong>{targetConn?.shopName}</strong>
              </span>
            </div>

            <div className="flex gap-2">
              <Button
                variant={mode === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => { setMode("all"); setSelectedIds(new Set()); }}
                className={mode === "all" ? "bg-[#fb9678] hover:bg-[#fb9678]/90" : ""}
                data-testid="button-mode-all"
              >
                สินค้าทั้งหมด ({productsData?.allProducts?.length || 0})
              </Button>
              <Button
                variant={mode === "mapped" ? "default" : "outline"}
                size="sm"
                onClick={() => { setMode("mapped"); setSelectedIds(new Set()); }}
                className={mode === "mapped" ? "bg-[#fb9678] hover:bg-[#fb9678]/90" : ""}
                data-testid="button-mode-mapped"
              >
                สินค้าที่ผูกร้านต้นทาง ({productsData?.mappedProducts?.length || 0})
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="ค้นหาชื่อสินค้า, รหัส, SKU..."
                  className="pl-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  data-testid="input-search-products"
                />
              </div>
              <Button variant="outline" size="sm" onClick={toggleAll} data-testid="button-select-all">
                <CheckSquare className="w-4 h-4 mr-1" />
                {selectedIds.size === filteredProducts.length ? "ยกเลิกทั้งหมด" : "เลือกทั้งหมด"}
              </Button>
            </div>

            {loadingProducts ? (
              <div className="text-center py-8">
                <Loader2 className="w-6 h-6 mx-auto animate-spin text-[#fb9678]" />
                <p className="text-sm text-gray-500 mt-2">กำลังโหลดสินค้า...</p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Package className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>ไม่พบสินค้า</p>
              </div>
            ) : (
              <div className="border rounded-lg divide-y max-h-[500px] overflow-y-auto">
                {filteredProducts.map((p: any) => {
                  const isSelected = selectedIds.has(p.productId);
                  const isEditing = editingProduct === p.productId;
                  const edited = editedProducts[p.productId];
                  return (
                    <div key={p.productId} className={`p-3 ${isSelected ? "bg-orange-50" : "hover:bg-gray-50"}`}>
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleOne(p.productId)}
                          data-testid={`checkbox-product-${p.productId}`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">{edited?.name || p.productName || p.platformProductName}</span>
                            {p.platformSku && <Badge variant="outline" className="text-xs">SKU: {p.platformSku}</Badge>}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                            <span>รหัส: {edited?.code || p.productCode}</span>
                            <span>ราคา: ฿{parseFloat(edited?.price || p.productPrice || "0").toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span>
                            <span>ต้นทุน: ฿{parseFloat(edited?.cost || p.productCost || "0").toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span>
                          </div>
                        </div>
                        {isSelected && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingProduct(isEditing ? null : p.productId)}
                            data-testid={`button-edit-product-${p.productId}`}
                          >
                            {isEditing ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            <span className="ml-1 text-xs">แก้ไข</span>
                          </Button>
                        )}
                      </div>
                      {isEditing && isSelected && (
                        <div className="mt-3 pl-8 grid grid-cols-1 md:grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs text-gray-500">ชื่อสินค้า</label>
                            <Input
                              value={edited?.name || p.productName || p.platformProductName || ""}
                              onChange={(e) => updateEdited(p.productId, "name", e.target.value)}
                              className="text-sm"
                              data-testid={`input-edit-name-${p.productId}`}
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500">รหัสสินค้า</label>
                            <Input
                              value={edited?.code || p.productCode || ""}
                              onChange={(e) => updateEdited(p.productId, "code", e.target.value)}
                              className="text-sm"
                              data-testid={`input-edit-code-${p.productId}`}
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500">ราคาขาย</label>
                            <Input
                              type="number"
                              value={edited?.price || p.productPrice || "0"}
                              onChange={(e) => updateEdited(p.productId, "price", e.target.value)}
                              className="text-sm"
                              data-testid={`input-edit-price-${p.productId}`}
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500">ต้นทุน</label>
                            <Input
                              type="number"
                              value={edited?.cost || p.productCost || "0"}
                              onChange={(e) => updateEdited(p.productId, "cost", e.target.value)}
                              className="text-sm"
                              data-testid={`input-edit-cost-${p.productId}`}
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="text-xs text-gray-500">Platform SKU (ปลายทาง)</label>
                            <Input
                              value={edited?.platformSku || p.platformSku || p.productCode || ""}
                              onChange={(e) => updateEdited(p.productId, "platformSku", e.target.value)}
                              className="text-sm"
                              data-testid={`input-edit-sku-${p.productId}`}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <span className="text-sm text-gray-500">เลือกแล้ว {selectedIds.size} จาก {filteredProducts.length} รายการ</span>
              <Button
                className="bg-[#fb9678] hover:bg-[#fb9678]/90 text-white"
                disabled={selectedIds.size === 0}
                onClick={() => setStep(3)}
                data-testid="button-next-step3"
              >
                ถัดไป — ตรวจสอบ & โคลน
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card className="flexy-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">ขั้นตอนที่ 3: ตรวจสอบและยืนยันการโคลน</CardTitle>
              <Button variant="outline" size="sm" onClick={() => setStep(2)} data-testid="button-back-step2">ย้อนกลับ</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3 bg-blue-50 rounded-lg text-center">
                <div className="text-2xl font-bold text-blue-700">{selectedIds.size}</div>
                <div className="text-xs text-blue-600">สินค้าที่จะโคลน</div>
              </div>
              <div className="p-3 bg-orange-50 rounded-lg text-center">
                <div className="text-sm font-medium text-orange-700">
                  {sourceConn && <Badge className={`text-xs ${platformColors[sourceConn.platform]}`}>{platformLabels[sourceConn.platform]}</Badge>}
                  <div className="mt-1">{sourceConn?.shopName}</div>
                </div>
                <div className="text-xs text-orange-500">ต้นทาง</div>
              </div>
              <div className="p-3 bg-green-50 rounded-lg text-center">
                <div className="text-sm font-medium text-green-700">
                  {targetConn && <Badge className={`text-xs ${platformColors[targetConn.platform]}`}>{platformLabels[targetConn.platform]}</Badge>}
                  <div className="mt-1">{targetConn?.shopName}</div>
                </div>
                <div className="text-xs text-green-500">ปลายทาง</div>
              </div>
            </div>

            <div className="border rounded-lg divide-y max-h-[300px] overflow-y-auto">
              {productList.filter((p: any) => selectedIds.has(p.productId)).map((p: any) => {
                const edited = editedProducts[p.productId];
                return (
                  <div key={p.productId} className="p-2 px-3 flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium">{edited?.name || p.productName || p.platformProductName}</span>
                      <span className="text-xs text-gray-500 ml-2">({edited?.code || p.productCode})</span>
                    </div>
                    <span className="text-sm font-medium text-green-600">
                      ฿{parseFloat(edited?.price || p.productPrice || "0").toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="p-3 bg-yellow-50 rounded-lg text-sm text-yellow-700">
              <strong>หมายเหตุ:</strong> สินค้าที่มี mapping อยู่แล้วในร้านปลายทางจะถูกข้ามโดยอัตโนมัติ (ไม่สร้างซ้ำ)
            </div>

            <Button
              className="w-full bg-[#05b187] hover:bg-[#05b187]/90 text-white text-base py-5"
              onClick={() => cloneMutation.mutate()}
              disabled={cloneMutation.isPending}
              data-testid="button-confirm-clone"
            >
              {cloneMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />กำลังโคลน...</>
              ) : (
                <><Copy className="w-4 h-4 mr-2" />ยืนยันโคลนสินค้า {selectedIds.size} รายการ</>
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
