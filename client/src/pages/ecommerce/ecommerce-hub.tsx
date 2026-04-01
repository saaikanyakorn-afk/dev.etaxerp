import EcommerceLayout from "@/components/ecommerce-layout";
import { getPlatformLogo } from "@/lib/platform-logos";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Link2, Package, Store,
  AlertTriangle, CheckCircle2, ExternalLink, Boxes, Plus
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import type { EcommerceConnection, EcommerceProductMapping } from "@shared/schema";

const PLATFORMS = [
  { value: "shopee", label: "Shopee", color: "bg-orange-500", textColor: "text-orange-700", bgLight: "bg-orange-100", hex: "#ee4d2d" },
  { value: "lazada", label: "Lazada", color: "bg-purple-600", textColor: "text-purple-700", bgLight: "bg-purple-100", hex: "#0f146d" },
  { value: "tiktok", label: "TikTok Shop", color: "bg-gray-900", textColor: "text-pink-700", bgLight: "bg-pink-100", hex: "#000000" },
  { value: "live", label: "Live Selling", color: "bg-cyan-500", textColor: "text-cyan-700", bgLight: "bg-cyan-100", hex: "#03c9d7" },
  { value: "amazon", label: "Amazon", color: "bg-yellow-500", textColor: "text-yellow-700", bgLight: "bg-yellow-100", hex: "#ff9900" },
];

function platformBadge(platform: string) {
  const p = PLATFORMS.find(pl => pl.value === platform);
  if (!p) return <Badge data-testid={`badge-platform-${platform}`} className="bg-gray-100 text-gray-700 hover:bg-gray-100">{platform}</Badge>;
  const logo = getPlatformLogo(platform);
  return (
    <Badge data-testid={`badge-platform-${platform}`} className={`${p.bgLight} ${p.textColor} hover:${p.bgLight} gap-1`}>
      {logo && <img src={logo} alt={p.label} className="w-4 h-4 rounded-full object-cover" />}
      {p.label}
    </Badge>
  );
}

function syncStatusBadge(status: string | null) {
  if (status === "synced") return <Badge data-testid="badge-sync-synced" className="bg-green-100 text-green-700 hover:bg-green-100">ซิงค์แล้ว</Badge>;
  if (status === "error") return <Badge data-testid="badge-sync-error" className="bg-red-100 text-red-700 hover:bg-red-100">ข้อผิดพลาด</Badge>;
  return <Badge data-testid="badge-sync-pending" className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">รอซิงค์</Badge>;
}

function formatCurrency(v: string | number | null | undefined) {
  return Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function EcommerceHub() {
  const { selectedCompanyId } = useCompany();
  const [, navigate] = useLocation();

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: myPermissions } = useQuery<{ modules: string[]; subModules: string[] }>({
    queryKey: ["/api/permissions/me", selectedCompanyId],
    queryFn: async () => {
      const params = selectedCompanyId ? `?companyId=${selectedCompanyId}` : "";
      const r = await fetch(`/api/permissions/me${params}`, { credentials: "include" });
      if (!r.ok) return { modules: [], subModules: [] };
      const data = await r.json();
      if (Array.isArray(data)) return { modules: data, subModules: [] };
      return data;
    },
    enabled: !!selectedCompanyId,
  });
  const hasAccounting = myPermissions?.modules?.includes("accounting") ?? false;

  const { data: connections = [] } = useQuery<EcommerceConnection[]>({
    queryKey: ["/api/ecommerce/connections", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/ecommerce/connections?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const { data: mappingStats } = useQuery<{
    totalProducts: number;
    totalMappings: number;
    mappedProducts: number;
    unmappedCount: number;
    unmappedProducts: { id: number; code: string; name: string; unit: string; price: string }[];
    platformStats: { connectionId: number; platform: string; shopName: string; status: string; totalMappings: number; lastSyncAt: string | null }[];
    mappedWithStock: (EcommerceProductMapping & { productCode: string; productName: string; stockOnHand: number | null })[];
  }>({
    queryKey: ["/api/ecommerce/mapping-stats", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/ecommerce/mapping-stats?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return null;
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const deleteProductMapping = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/ecommerce/product-mappings/${id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/product-mappings"] }); queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/mapping-stats"] }); toast({ title: "ลบการเชื่อมโยงสำเร็จ", variant: "success" as any }); },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  return (
    <EcommerceLayout>
      <div className="space-y-6" data-testid="page-ecommerce-hub">

        {/* ========== Product & Stock (สินค้า & สต๊อก) ========== */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Boxes className="h-5 w-5" style={{ color: "#03c9d7" }} />
              <h2 className="text-lg font-semibold" data-testid="text-product-stock-title">สินค้า & สต๊อก</h2>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="text-xs" onClick={() => navigate("/inventory/product-mapping")} data-testid="button-goto-mapping-page">
                <ExternalLink className="h-3 w-3 mr-1" />จัดการเชื่อมโยงทั้งหมด
              </Button>
              <Button variant="outline" size="sm" className="text-xs" onClick={() => navigate("/inventory/list")} data-testid="button-goto-product-list">
                <Package className="h-3 w-3 mr-1" />จัดการสินค้า
              </Button>
            </div>
          </div>

          {/* Mapping Coverage KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <Card className="rounded-xl shadow-sm border" data-testid="card-kpi-total-products">
              <CardContent className="pt-4 pb-3 px-4">
                <div className="text-xs text-muted-foreground mb-1">สินค้าทั้งหมด</div>
                <div className="text-xl font-bold" style={{ color: "#03c9d7" }}>{mappingStats?.totalProducts ?? 0}</div>
              </CardContent>
            </Card>
            <Card className="rounded-xl shadow-sm border" data-testid="card-kpi-mapped-products">
              <CardContent className="pt-4 pb-3 px-4">
                <div className="text-xs text-muted-foreground mb-1">เชื่อมโยงแล้ว</div>
                <div className="text-xl font-bold text-green-600">{mappingStats?.mappedProducts ?? 0}</div>
              </CardContent>
            </Card>
            <Card className="rounded-xl shadow-sm border" data-testid="card-kpi-unmapped-products">
              <CardContent className="pt-4 pb-3 px-4">
                <div className="text-xs text-muted-foreground mb-1">ยังไม่เชื่อมโยง</div>
                <div className="text-xl font-bold" style={{ color: mappingStats?.unmappedCount ? "#f94d4d" : "#05b187" }}>{mappingStats?.unmappedCount ?? 0}</div>
              </CardContent>
            </Card>
            <Card className="rounded-xl shadow-sm border" data-testid="card-kpi-coverage">
              <CardContent className="pt-4 pb-3 px-4">
                <div className="text-xs text-muted-foreground mb-1">ความครอบคลุม</div>
                <div className="text-xl font-bold" style={{ color: "#fb9678" }}>
                  {mappingStats && mappingStats.totalProducts > 0
                    ? `${Math.round((mappingStats.mappedProducts / mappingStats.totalProducts) * 100)}%`
                    : "0%"}
                </div>
                {mappingStats && mappingStats.totalProducts > 0 && (
                  <div className="mt-1.5 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.round((mappingStats.mappedProducts / mappingStats.totalProducts) * 100)}%`,
                        background: mappingStats.mappedProducts === mappingStats.totalProducts ? "#05b187" : "#fb9678",
                      }}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Mapping by Platform */}
          {mappingStats && mappingStats.platformStats.length > 0 && (
            <Card className="rounded-xl shadow-sm border mb-4" data-testid="card-platform-mapping-stats">
              <CardHeader className="pb-3">
                <h3 className="text-sm font-semibold">การเชื่อมโยงแยกตามแพลตฟอร์ม</h3>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {mappingStats.platformStats.map((ps) => {
                    const p = PLATFORMS.find(pl => pl.value === ps.platform);
                    return (
                      <div key={ps.connectionId} className="flex items-center gap-3 p-3 rounded-lg border" data-testid={`stat-platform-${ps.platform}-${ps.connectionId}`}>
                        <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: `${p?.hex || "#ccc"}15` }}>
                          <Store className="h-4 w-4" style={{ color: p?.hex || "#666" }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium truncate">{p?.label || ps.platform} - {ps.shopName}</div>
                          <div className="text-xs text-muted-foreground">{ps.totalMappings} สินค้าเชื่อมโยง</div>
                        </div>
                        {ps.totalMappings > 0 ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Unmapped Products Alert */}
          {mappingStats && mappingStats.unmappedCount > 0 && (
            <Card className="rounded-xl shadow-sm border border-amber-200 bg-amber-50/50 mb-4" data-testid="card-unmapped-products">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <h3 className="text-sm font-semibold text-amber-800">สินค้าที่ยังไม่เชื่อมโยงกับแพลตฟอร์ม ({mappingStats.unmappedCount})</h3>
                </div>
                <p className="text-xs text-amber-700 mt-1">สินค้าเหล่านี้ยังไม่ถูกเชื่อมโยงกับ SKU บนแพลตฟอร์ม เมื่อนำเข้าออเดอร์ ระบบจะไม่สามารถจับคู่สินค้าอัตโนมัติ</p>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table data-testid="table-unmapped-products">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">รหัส</TableHead>
                        <TableHead className="text-xs">ชื่อสินค้า</TableHead>
                        <TableHead className="text-xs">หน่วย</TableHead>
                        <TableHead className="text-xs text-right">ราคา</TableHead>
                        <TableHead className="text-xs w-24">เชื่อมโยง</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mappingStats.unmappedProducts.map((p) => (
                        <TableRow key={p.id} data-testid={`row-unmapped-${p.id}`} className="text-xs">
                          <TableCell className="py-1.5">{p.code}</TableCell>
                          <TableCell className="py-1.5 font-medium">{p.name}</TableCell>
                          <TableCell className="py-1.5">{p.unit}</TableCell>
                          <TableCell className="py-1.5 text-right">฿{formatCurrency(p.price)}</TableCell>
                          <TableCell className="py-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 px-2 text-xs"
                              style={{ borderColor: "#03c9d7", color: "#03c9d7" }}
                              onClick={() => navigate("/inventory/product-mapping")}
                              data-testid={`button-map-product-${p.id}`}
                            >
                              <Link2 className="h-3 w-3 mr-1" />เชื่อมโยง
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {mappingStats.unmappedCount > 20 && (
                  <p className="text-xs text-amber-700 mt-2 text-center">
                    แสดง 20 จาก {mappingStats.unmappedCount} รายการ —{" "}
                    <button className="underline hover:no-underline" onClick={() => navigate("/inventory/product-mapping")} data-testid="link-view-all-unmapped">ดูทั้งหมด</button>
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Mapped Products with Stock (Full Accounting only) */}
          {hasAccounting && mappingStats && mappingStats.mappedWithStock.length > 0 && (
            <Card className="rounded-xl shadow-sm border" data-testid="card-mapped-stock">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Boxes className="h-4 w-4 text-green-600" />
                    <h3 className="text-sm font-semibold">สินค้าที่เชื่อมโยง & สต๊อกคงเหลือ</h3>
                  </div>
                  <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-xs">{mappingStats.mappedWithStock.length} รายการ</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table data-testid="table-mapped-stock">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">รหัส</TableHead>
                        <TableHead className="text-xs">ชื่อสินค้า</TableHead>
                        <TableHead className="text-xs">แพลตฟอร์ม</TableHead>
                        <TableHead className="text-xs">Platform SKU</TableHead>
                        <TableHead className="text-xs text-right">สต๊อกคงเหลือ</TableHead>
                        <TableHead className="text-xs">สถานะซิงค์</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mappingStats.mappedWithStock.slice(0, 20).map((m) => {
                        const conn = connections.find(c => c.id === m.connectionId);
                        return (
                          <TableRow key={m.id} data-testid={`row-mapped-stock-${m.id}`} className="text-xs">
                            <TableCell className="py-1.5">{m.productCode}</TableCell>
                            <TableCell className="py-1.5 font-medium">{m.productName}</TableCell>
                            <TableCell className="py-1.5">{conn ? platformBadge(conn.platform) : "-"}</TableCell>
                            <TableCell className="py-1.5">{m.platformSku}</TableCell>
                            <TableCell className="py-1.5 text-right">
                              {m.stockOnHand !== null ? (
                                <span className={m.stockOnHand <= 0 ? "text-red-600 font-medium" : m.stockOnHand <= 5 ? "text-amber-600 font-medium" : "text-green-700 font-medium"}>
                                  {m.stockOnHand.toLocaleString()}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="py-1.5">{syncStatusBadge(m.syncStatus)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Document-only user: guide card */}
          {!hasAccounting && (
            <Card className="rounded-xl shadow-sm border border-blue-200 bg-blue-50/30" data-testid="card-product-guide">
              <CardContent className="py-5 px-5">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-blue-100 shrink-0">
                    <Package className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-blue-900 mb-1">สินค้าสำหรับออกเอกสาร</h3>
                    <p className="text-xs text-blue-700 leading-relaxed">
                      เพิ่มสินค้าในระบบแล้วเชื่อมโยงกับ SKU บนแพลตฟอร์ม เพื่อให้เมื่อนำเข้าออเดอร์ ระบบจะจับคู่สินค้าอัตโนมัติและออกใบกำกับภาษีได้ถูกต้อง
                    </p>
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" className="h-7 text-xs text-white hover:opacity-90" style={{ background: "#03c9d7" }} onClick={() => navigate("/inventory/list/new")} data-testid="button-add-product-guide">
                        <Plus className="h-3 w-3 mr-1" />เพิ่มสินค้า
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => navigate("/inventory/product-mapping")} data-testid="button-map-product-guide">
                        <Link2 className="h-3 w-3 mr-1" />เชื่อมโยงสินค้า
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

      </div>
    </EcommerceLayout>
  );
}
