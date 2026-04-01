import EcommerceLayout from "@/components/ecommerce-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bell, Package, AlertTriangle, XCircle, CheckCircle, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface LowStockProduct {
  id: number;
  code: string;
  name: string;
  unit: string;
  currentStock: number;
  lowStockThreshold: number;
}

interface StockSummary {
  products: Array<{
    id: number;
    code: string;
    name: string;
    unit: string;
    currentStock: number;
    lowStockThreshold: number;
  }>;
  lowStockCount: number;
  outOfStockCount: number;
  totalProducts: number;
}

export default function EcommerceStockAlerts() {
  const { selectedCompanyId } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [editingThresholds, setEditingThresholds] = useState<Record<number, string>>({});

  const { data: lowStockProducts = [], isLoading: lowStockLoading } = useQuery<LowStockProduct[]>({
    queryKey: ["/api/ecommerce/low-stock", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/ecommerce/low-stock?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const { data: stockSummary, isLoading: summaryLoading } = useQuery<StockSummary>({
    queryKey: ["/api/ecommerce/stock-summary", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/ecommerce/stock-summary?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return { products: [], lowStockCount: 0, outOfStockCount: 0, totalProducts: 0 };
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const updateThresholdMutation = useMutation({
    mutationFn: async ({ productId, threshold }: { productId: number; threshold: number }) => {
      const r = await fetch(`/api/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ lowStockThreshold: threshold }),
      });
      if (!r.ok) throw new Error((await r.json()).message || "Failed to update");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/low-stock"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/stock-summary"] });
      toast({ title: "อัปเดตเกณฑ์แจ้งเตือนสำเร็จ", variant: "success" as any });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const totalProducts = stockSummary?.totalProducts || 0;
  const lowStockCount = stockSummary?.lowStockCount || 0;
  const outOfStockCount = stockSummary?.outOfStockCount || 0;
  const normalCount = totalProducts - lowStockCount - outOfStockCount;

  const allProducts = stockSummary?.products || [];
  const filteredProducts = allProducts.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isLoading = lowStockLoading || summaryLoading;

  function handleThresholdChange(productId: number, value: string) {
    setEditingThresholds(prev => ({ ...prev, [productId]: value }));
  }

  function handleThresholdBlur(productId: number, originalThreshold: number) {
    const val = editingThresholds[productId];
    if (val === undefined) return;
    const num = parseInt(val, 10);
    if (isNaN(num) || num < 0 || num === originalThreshold) {
      setEditingThresholds(prev => {
        const next = { ...prev };
        delete next[productId];
        return next;
      });
      return;
    }
    updateThresholdMutation.mutate({ productId, threshold: num });
    setEditingThresholds(prev => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  }

  function handleThresholdKeyDown(e: React.KeyboardEvent, productId: number, originalThreshold: number) {
    if (e.key === "Enter") {
      handleThresholdBlur(productId, originalThreshold);
    }
  }

  return (
    <EcommerceLayout>
      <div className="space-y-4" data-testid="page-ecommerce-stock-alerts">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: "#fff3ef" }}>
            <Bell className="h-5 w-5" style={{ color: "#fb9678" }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800" data-testid="text-page-title">แจ้งเตือนสต๊อกสินค้า</h1>
            <p className="text-sm text-muted-foreground mt-0.5">ตรวจสอบสถานะสต๊อกสินค้าและตั้งค่าเกณฑ์แจ้งเตือน</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="rounded-xl shadow-sm border" data-testid="card-total-products">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: "#e5f9fa" }}>
                      <Package className="h-5 w-5" style={{ color: "#03c9d7" }} />
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">สินค้าทั้งหมด</div>
                      <div className="text-xl font-bold" style={{ color: "#03c9d7" }} data-testid="text-total-products">{totalProducts}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="rounded-xl shadow-sm border" data-testid="card-low-stock">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: "#fffbef" }}>
                      <AlertTriangle className="h-5 w-5" style={{ color: "#fec90f" }} />
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">สินค้าสต๊อกต่ำ</div>
                      <div className="text-xl font-bold" style={{ color: "#fec90f" }} data-testid="text-low-stock-count">{lowStockCount}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="rounded-xl shadow-sm border" data-testid="card-out-of-stock">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: "#fef2f2" }}>
                      <XCircle className="h-5 w-5" style={{ color: "#f94d4d" }} />
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">สินค้าหมดสต๊อก</div>
                      <div className="text-xl font-bold" style={{ color: "#f94d4d" }} data-testid="text-out-of-stock-count">{outOfStockCount}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="rounded-xl shadow-sm border" data-testid="card-normal-stock">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: "#eefbf5" }}>
                      <CheckCircle className="h-5 w-5" style={{ color: "#05b187" }} />
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">ปกติ</div>
                      <div className="text-xl font-bold" style={{ color: "#05b187" }} data-testid="text-normal-stock-count">{normalCount}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="low-stock" className="space-y-4">
              <TabsList data-testid="tabs-stock-alerts">
                <TabsTrigger value="low-stock" data-testid="tab-low-stock">สินค้าสต๊อกต่ำ</TabsTrigger>
                <TabsTrigger value="all-products" data-testid="tab-all-products">สินค้าทั้งหมด</TabsTrigger>
              </TabsList>

              <TabsContent value="low-stock">
                <Card className="rounded-xl shadow-sm border">
                  <CardContent className="p-0">
                    {lowStockProducts.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground" data-testid="text-no-low-stock">
                        <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-400" />
                        <p className="text-sm">ไม่มีสินค้าที่สต๊อกต่ำ</p>
                      </div>
                    ) : (
                      <Table data-testid="table-low-stock">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[50px]"></TableHead>
                            <TableHead>รหัสสินค้า</TableHead>
                            <TableHead>ชื่อสินค้า</TableHead>
                            <TableHead>หน่วย</TableHead>
                            <TableHead className="text-right">สต๊อกปัจจุบัน</TableHead>
                            <TableHead className="text-right">Threshold</TableHead>
                            <TableHead>สถานะ</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {lowStockProducts.map((product) => {
                            const isOutOfStock = product.currentStock === 0;
                            return (
                              <TableRow key={product.id} data-testid={`row-low-stock-${product.id}`}>
                                <TableCell>
                                  <div
                                    className="w-3 h-3 rounded-full"
                                    style={{ background: isOutOfStock ? "#f94d4d" : "#fec90f" }}
                                    data-testid={`indicator-stock-${product.id}`}
                                  />
                                </TableCell>
                                <TableCell className="font-mono text-sm" data-testid={`text-product-code-${product.id}`}>{product.code}</TableCell>
                                <TableCell data-testid={`text-product-name-${product.id}`}>{product.name}</TableCell>
                                <TableCell data-testid={`text-product-unit-${product.id}`}>{product.unit}</TableCell>
                                <TableCell className="text-right font-medium" data-testid={`text-current-stock-${product.id}`}>
                                  <span style={{ color: isOutOfStock ? "#f94d4d" : "#fec90f" }}>
                                    {product.currentStock}
                                  </span>
                                </TableCell>
                                <TableCell className="text-right" data-testid={`text-threshold-${product.id}`}>{product.lowStockThreshold}</TableCell>
                                <TableCell>
                                  {isOutOfStock ? (
                                    <Badge className="bg-red-100 text-red-800 hover:bg-red-100" data-testid={`badge-status-${product.id}`}>หมดสต๊อก</Badge>
                                  ) : (
                                    <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100" data-testid={`badge-status-${product.id}`}>สต๊อกต่ำ</Badge>
                                  )}
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

              <TabsContent value="all-products">
                <Card className="rounded-xl shadow-sm border">
                  <CardContent className="p-4 space-y-4">
                    <Input
                      placeholder="ค้นหาสินค้าตามชื่อหรือรหัส..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="max-w-sm"
                      data-testid="input-search-products"
                    />
                    {filteredProducts.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground" data-testid="text-no-products">
                        <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                        <p className="text-sm">ไม่พบสินค้า</p>
                      </div>
                    ) : (
                      <Table data-testid="table-all-products">
                        <TableHeader>
                          <TableRow>
                            <TableHead>รหัสสินค้า</TableHead>
                            <TableHead>ชื่อสินค้า</TableHead>
                            <TableHead>หน่วย</TableHead>
                            <TableHead className="text-right">สต๊อกปัจจุบัน</TableHead>
                            <TableHead className="text-right w-[140px]">เกณฑ์แจ้งเตือน</TableHead>
                            <TableHead>สถานะ</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredProducts.map((product) => {
                            const isOutOfStock = product.currentStock === 0;
                            const isLowStock = product.currentStock > 0 && product.currentStock < product.lowStockThreshold;
                            const thresholdValue = editingThresholds[product.id] !== undefined
                              ? editingThresholds[product.id]
                              : String(product.lowStockThreshold);
                            return (
                              <TableRow key={product.id} data-testid={`row-all-product-${product.id}`}>
                                <TableCell className="font-mono text-sm" data-testid={`text-all-product-code-${product.id}`}>{product.code}</TableCell>
                                <TableCell data-testid={`text-all-product-name-${product.id}`}>{product.name}</TableCell>
                                <TableCell data-testid={`text-all-product-unit-${product.id}`}>{product.unit}</TableCell>
                                <TableCell className="text-right font-medium" data-testid={`text-all-current-stock-${product.id}`}>
                                  <span style={{ color: isOutOfStock ? "#f94d4d" : isLowStock ? "#fec90f" : "#05b187" }}>
                                    {product.currentStock}
                                  </span>
                                </TableCell>
                                <TableCell className="text-right">
                                  <Input
                                    type="number"
                                    min={0}
                                    value={thresholdValue}
                                    onChange={e => handleThresholdChange(product.id, e.target.value)}
                                    onBlur={() => handleThresholdBlur(product.id, product.lowStockThreshold)}
                                    onKeyDown={e => handleThresholdKeyDown(e, product.id, product.lowStockThreshold)}
                                    className="h-8 w-20 text-right ml-auto"
                                    data-testid={`input-threshold-${product.id}`}
                                  />
                                </TableCell>
                                <TableCell>
                                  {isOutOfStock ? (
                                    <Badge className="bg-red-100 text-red-800 hover:bg-red-100" data-testid={`badge-all-status-${product.id}`}>หมดสต๊อก</Badge>
                                  ) : isLowStock ? (
                                    <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100" data-testid={`badge-all-status-${product.id}`}>สต๊อกต่ำ</Badge>
                                  ) : (
                                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100" data-testid={`badge-all-status-${product.id}`}>ปกติ</Badge>
                                  )}
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
          </>
        )}
      </div>
    </EcommerceLayout>
  );
}
