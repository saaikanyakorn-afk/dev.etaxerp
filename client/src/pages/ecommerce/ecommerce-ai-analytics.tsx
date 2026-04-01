import { useState, useMemo } from "react";
import EcommerceLayout from "@/components/ecommerce-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  BarChart3, TrendingUp, TrendingDown, Package, Loader2, Brain, RefreshCw,
  ShoppingCart, DollarSign, ArrowUp, ArrowDown, AlertTriangle, CheckCircle2,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { useToast } from "@/hooks/use-toast";

const PLATFORM_COLORS: Record<string, { hex: string; label: string }> = {
  shopee: { hex: "#EE4D2D", label: "Shopee" },
  lazada: { hex: "#0F146D", label: "Lazada" },
  tiktok: { hex: "#000000", label: "TikTok" },
  amazon: { hex: "#FF9900", label: "Amazon" },
};

function getAccuracyColor(accuracy: number) {
  if (accuracy >= 90) return "bg-green-100 text-green-700 hover:bg-green-100";
  if (accuracy >= 70) return "bg-yellow-100 text-yellow-700 hover:bg-yellow-100";
  return "bg-red-100 text-red-700 hover:bg-red-100";
}

function getUrgencyColor(daysLeft: number) {
  if (daysLeft < 7) return "bg-red-100 text-red-700 hover:bg-red-100";
  if (daysLeft <= 14) return "bg-yellow-100 text-yellow-700 hover:bg-yellow-100";
  return "bg-green-100 text-green-700 hover:bg-green-100";
}

function getUrgencyLabel(daysLeft: number) {
  if (daysLeft < 7) return "เร่งด่วน";
  if (daysLeft <= 14) return "เตือน";
  return "ปกติ";
}

export default function EcommerceAiAnalytics() {
  const { selectedCompanyId } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [forecastMethod, setForecastMethod] = useState("moving_average");
  const [periodType, setPeriodType] = useState("monthly");
  const [topProductDays, setTopProductDays] = useState("30");
  const [topProductPlatform, setTopProductPlatform] = useState("all");
  const [platformDays, setPlatformDays] = useState("30");

  const { data: forecasts = [], isLoading: forecastLoading } = useQuery<any[]>({
    queryKey: ["/api/ecommerce/analytics/demand-forecast", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/ecommerce/analytics/demand-forecast?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const { data: topProducts = [], isLoading: topProductsLoading } = useQuery<any[]>({
    queryKey: ["/api/ecommerce/analytics/top-products", selectedCompanyId, topProductDays, topProductPlatform],
    queryFn: async () => {
      const r = await fetch(`/api/ecommerce/analytics/top-products?companyId=${selectedCompanyId}&days=${topProductDays}&platform=${topProductPlatform}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const { data: platformComparison = [], isLoading: platformLoading } = useQuery<any[]>({
    queryKey: ["/api/ecommerce/analytics/platform-comparison", selectedCompanyId, platformDays],
    queryFn: async () => {
      const r = await fetch(`/api/ecommerce/analytics/platform-comparison?companyId=${selectedCompanyId}&days=${platformDays}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const generateForecastMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/ecommerce/analytics/demand-forecast/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ companyId: selectedCompanyId, periodType, method: forecastMethod }),
      });
      if (!r.ok) throw new Error((await r.json()).message || "Failed");
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "สร้างพยากรณ์สำเร็จ", description: "ข้อมูลพยากรณ์ถูกสร้างเรียบร้อยแล้ว" });
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/analytics/demand-forecast"] });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const restockSuggestions = useMemo(() => {
    if (!forecasts.length) return [];
    return forecasts
      .filter((f: any) => f.currentStock !== undefined && f.avgDailySales > 0)
      .map((f: any) => {
        const daysLeft = Math.round(f.currentStock / f.avgDailySales);
        const suggestedOrder = Math.max(0, Math.round(f.avgDailySales * 30 - f.currentStock));
        return { ...f, daysLeft, suggestedOrder };
      })
      .sort((a: any, b: any) => a.daysLeft - b.daysLeft);
  }, [forecasts]);

  const forecastMaxQty = useMemo(() => {
    if (!forecasts.length) return 1;
    return Math.max(...forecasts.map((f: any) => Math.max(f.forecastQty || 0, f.actualQty || 0)), 1);
  }, [forecasts]);

  const topProductMaxQty = useMemo(() => {
    if (!topProducts.length) return 1;
    return Math.max(...topProducts.map((p: any) => p.totalQty || 0), 1);
  }, [topProducts]);

  const platformMaxOrders = useMemo(() => {
    if (!platformComparison.length) return 1;
    return Math.max(...platformComparison.map((p: any) => p.totalOrders || 0), 1);
  }, [platformComparison]);

  const platformMaxRevenue = useMemo(() => {
    if (!platformComparison.length) return 1;
    return Math.max(...platformComparison.map((p: any) => p.totalRevenue || 0), 1);
  }, [platformComparison]);

  return (
    <EcommerceLayout>
      <div className="space-y-4" data-testid="page-ai-analytics">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800" data-testid="text-title">
              <Brain className="inline h-6 w-6 mr-2 text-[#fb9678]" />
              AI Analytics & Demand Forecasting
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">วิเคราะห์ข้อมูลและพยากรณ์ความต้องการสินค้าด้วย AI</p>
          </div>
        </div>

        <Tabs defaultValue="forecast" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4" data-testid="tabs-analytics">
            <TabsTrigger value="forecast" data-testid="tab-forecast">พยากรณ์ความต้องการ</TabsTrigger>
            <TabsTrigger value="top-products" data-testid="tab-top-products">สินค้าขายดี</TabsTrigger>
            <TabsTrigger value="platform" data-testid="tab-platform">เปรียบเทียบแพลตฟอร์ม</TabsTrigger>
            <TabsTrigger value="restock" data-testid="tab-restock">แนะนำเติมสต๊อก</TabsTrigger>
          </TabsList>

          {/* Tab 1: Demand Forecast */}
          <TabsContent value="forecast" className="space-y-4">
            <Card className="rounded-xl shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-[#fb9678]" />
                    พยากรณ์ความต้องการสินค้า
                  </CardTitle>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Select value={forecastMethod} onValueChange={setForecastMethod} data-testid="select-forecast-method">
                      <SelectTrigger className="w-[180px] h-8 text-xs" data-testid="select-forecast-method-trigger">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="moving_average" data-testid="option-moving-average">Moving Average</SelectItem>
                        <SelectItem value="exponential" data-testid="option-exponential">Exponential Smoothing</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={periodType} onValueChange={setPeriodType} data-testid="select-period-type">
                      <SelectTrigger className="w-[140px] h-8 text-xs" data-testid="select-period-type-trigger">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly" data-testid="option-weekly">รายสัปดาห์</SelectItem>
                        <SelectItem value="monthly" data-testid="option-monthly">รายเดือน</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      className="bg-[#fb9678] hover:bg-[#e8865a] text-white gap-1 h-8 text-xs"
                      onClick={() => generateForecastMutation.mutate()}
                      disabled={generateForecastMutation.isPending}
                      data-testid="button-generate-forecast"
                    >
                      {generateForecastMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                      สร้างพยากรณ์
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {forecastLoading ? (
                  <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                ) : forecasts.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Brain className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-sm">ยังไม่มีข้อมูลพยากรณ์</p>
                    <p className="text-xs mt-1">กดปุ่ม "สร้างพยากรณ์" เพื่อเริ่มวิเคราะห์</p>
                  </div>
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">SKU</TableHead>
                          <TableHead className="text-xs">ชื่อสินค้า</TableHead>
                          <TableHead className="text-xs">วันที่</TableHead>
                          <TableHead className="text-xs text-right">ปริมาณพยากรณ์</TableHead>
                          <TableHead className="text-xs text-right">ปริมาณจริง</TableHead>
                          <TableHead className="text-xs text-center">ความแม่นยำ</TableHead>
                          <TableHead className="text-xs">วิธีการ</TableHead>
                          <TableHead className="text-xs">แพลตฟอร์ม</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {forecasts.map((f: any, idx: number) => (
                          <TableRow key={f.id || idx} data-testid={`row-forecast-${f.id || idx}`}>
                            <TableCell className="text-xs font-mono">{f.sku || "-"}</TableCell>
                            <TableCell className="text-sm">{f.productName || "-"}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{f.forecastDate || "-"}</TableCell>
                            <TableCell className="text-sm text-right font-medium">{(f.forecastQty || 0).toLocaleString()}</TableCell>
                            <TableCell className="text-sm text-right">{f.actualQty != null ? f.actualQty.toLocaleString() : "-"}</TableCell>
                            <TableCell className="text-center">
                              <Badge className={`text-xs ${getAccuracyColor(f.accuracy || 0)}`} data-testid={`badge-accuracy-${f.id || idx}`}>
                                {f.accuracy != null ? `${f.accuracy.toFixed(1)}%` : "-"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">
                              {f.method === "moving_average" ? "Moving Avg" : f.method === "exponential" ? "Exp. Smoothing" : f.method || "-"}
                            </TableCell>
                            <TableCell>
                              {f.platform && PLATFORM_COLORS[f.platform] ? (
                                <Badge style={{ backgroundColor: PLATFORM_COLORS[f.platform].hex + "20", color: PLATFORM_COLORS[f.platform].hex, borderColor: PLATFORM_COLORS[f.platform].hex }} className="text-xs border" data-testid={`badge-platform-${f.id || idx}`}>
                                  {PLATFORM_COLORS[f.platform].label}
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">{f.platform || "ทั้งหมด"}</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    <div className="mt-6">
                      <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-[#03c9d7]" />
                        กราฟพยากรณ์ vs จริง
                      </h3>
                      <div className="space-y-3">
                        {forecasts.slice(0, 10).map((f: any, idx: number) => (
                          <div key={f.id || idx} className="space-y-1" data-testid={`chart-forecast-${f.id || idx}`}>
                            <div className="text-xs font-medium truncate max-w-xs">{f.productName || f.sku || `#${idx + 1}`}</div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-muted-foreground w-14 shrink-0 text-right">พยากรณ์</span>
                              <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{ width: `${Math.min(100, ((f.forecastQty || 0) / forecastMaxQty) * 100)}%`, backgroundColor: "#fb9678" }}
                                />
                              </div>
                              <span className="text-[10px] w-12 text-right">{(f.forecastQty || 0).toLocaleString()}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-muted-foreground w-14 shrink-0 text-right">จริง</span>
                              <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{ width: `${Math.min(100, ((f.actualQty || 0) / forecastMaxQty) * 100)}%`, backgroundColor: "#03c9d7" }}
                                />
                              </div>
                              <span className="text-[10px] w-12 text-right">{f.actualQty != null ? f.actualQty.toLocaleString() : "-"}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 2: Top Products */}
          <TabsContent value="top-products" className="space-y-4">
            <Card className="rounded-xl shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-[#fb9678]" />
                    สินค้าขายดี Top 10
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Select value={topProductDays} onValueChange={setTopProductDays}>
                      <SelectTrigger className="w-[120px] h-8 text-xs" data-testid="select-top-product-days">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7" data-testid="option-7days">7 วัน</SelectItem>
                        <SelectItem value="30" data-testid="option-30days">30 วัน</SelectItem>
                        <SelectItem value="90" data-testid="option-90days">90 วัน</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={topProductPlatform} onValueChange={setTopProductPlatform}>
                      <SelectTrigger className="w-[120px] h-8 text-xs" data-testid="select-top-product-platform">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all" data-testid="option-platform-all">ทั้งหมด</SelectItem>
                        <SelectItem value="shopee" data-testid="option-platform-shopee">Shopee</SelectItem>
                        <SelectItem value="lazada" data-testid="option-platform-lazada">Lazada</SelectItem>
                        <SelectItem value="tiktok" data-testid="option-platform-tiktok">TikTok</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {topProductsLoading ? (
                  <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                ) : topProducts.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-sm">ยังไม่มีข้อมูลสินค้าขายดี</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs w-12 text-center">#</TableHead>
                          <TableHead className="text-xs">ชื่อสินค้า</TableHead>
                          <TableHead className="text-xs">SKU</TableHead>
                          <TableHead className="text-xs text-right">จำนวนขาย</TableHead>
                          <TableHead className="text-xs text-right">ยอดขาย (฿)</TableHead>
                          <TableHead className="text-xs text-center">แนวโน้ม</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {topProducts.map((p: any, idx: number) => (
                          <TableRow key={p.id || idx} data-testid={`row-top-product-${p.id || idx}`}>
                            <TableCell className="text-center">
                              <span
                                className="inline-flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold text-white"
                                style={{ backgroundColor: idx < 3 ? "#fb9678" : "#cbd5e1" }}
                              >
                                {idx + 1}
                              </span>
                            </TableCell>
                            <TableCell className="text-sm font-medium">{p.productName || "-"}</TableCell>
                            <TableCell className="text-xs font-mono text-muted-foreground">{p.sku || "-"}</TableCell>
                            <TableCell className="text-sm text-right font-medium">{(p.totalQty || 0).toLocaleString()}</TableCell>
                            <TableCell className="text-sm text-right">฿{(p.totalRevenue || 0).toLocaleString()}</TableCell>
                            <TableCell className="text-center">
                              {p.trendPercent != null ? (
                                <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${p.trendPercent >= 0 ? "text-green-600" : "text-red-600"}`} data-testid={`trend-${p.id || idx}`}>
                                  {p.trendPercent >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                                  {Math.abs(p.trendPercent).toFixed(1)}%
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    <div className="mt-4">
                      <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-[#03c9d7]" />
                        จำนวนขาย
                      </h3>
                      <div className="space-y-2">
                        {topProducts.map((p: any, idx: number) => (
                          <div key={p.id || idx} className="flex items-center gap-2" data-testid={`chart-top-product-${p.id || idx}`}>
                            <span className="text-xs w-32 truncate text-right shrink-0">{p.productName || p.sku || `#${idx + 1}`}</span>
                            <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all flex items-center justify-end pr-2"
                                style={{
                                  width: `${Math.min(100, ((p.totalQty || 0) / topProductMaxQty) * 100)}%`,
                                  backgroundColor: idx < 3 ? "#fb9678" : "#03c9d7",
                                }}
                              >
                                <span className="text-[10px] text-white font-medium">{(p.totalQty || 0).toLocaleString()}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 3: Platform Comparison */}
          <TabsContent value="platform" className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-[#fb9678]" />
                เปรียบเทียบแพลตฟอร์ม
              </h3>
              <Select value={platformDays} onValueChange={setPlatformDays}>
                <SelectTrigger className="w-[120px] h-8 text-xs" data-testid="select-platform-days">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 วัน</SelectItem>
                  <SelectItem value="30">30 วัน</SelectItem>
                  <SelectItem value="90">90 วัน</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {platformLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : platformComparison.length === 0 ? (
              <Card className="rounded-xl shadow-sm">
                <CardContent className="py-12">
                  <div className="text-center text-muted-foreground">
                    <ShoppingCart className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-sm">ยังไม่มีข้อมูลแพลตฟอร์ม</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {platformComparison.map((p: any) => {
                    const color = PLATFORM_COLORS[p.platform]?.hex || "#6b7280";
                    const label = PLATFORM_COLORS[p.platform]?.label || p.platform;
                    return (
                      <Card key={p.platform} className="rounded-xl shadow-sm border-t-4" style={{ borderTopColor: color }} data-testid={`card-platform-${p.platform}`}>
                        <CardHeader className="pb-1 pt-3 px-4">
                          <CardTitle className="text-sm font-bold" style={{ color }}>{label}</CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 pb-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">จำนวนออเดอร์</span>
                            <span className="text-sm font-bold">{(p.totalOrders || 0).toLocaleString()}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">ยอดขาย</span>
                            <span className="text-sm font-bold">฿{(p.totalRevenue || 0).toLocaleString()}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">ออเดอร์เฉลี่ย/วัน</span>
                            <span className="text-sm font-medium">{(p.avgOrdersPerDay || 0).toFixed(1)}</span>
                          </div>
                          {p.growthPercent != null && (
                            <div className="flex items-center justify-end gap-1 mt-1">
                              <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${p.growthPercent >= 0 ? "text-green-600" : "text-red-600"}`} data-testid={`growth-${p.platform}`}>
                                {p.growthPercent >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                                {Math.abs(p.growthPercent).toFixed(1)}%
                              </span>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                <Card className="rounded-xl shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-[#03c9d7]" />
                      เปรียบเทียบออเดอร์ & ยอดขาย
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">จำนวนออเดอร์</p>
                        <div className="flex h-8 rounded-lg overflow-hidden bg-gray-100" data-testid="chart-orders-stacked">
                          {platformComparison.map((p: any) => {
                            const color = PLATFORM_COLORS[p.platform]?.hex || "#6b7280";
                            const pct = platformMaxOrders > 0 ? ((p.totalOrders || 0) / platformComparison.reduce((s: number, x: any) => s + (x.totalOrders || 0), 0)) * 100 : 0;
                            return (
                              <div
                                key={p.platform}
                                className="h-full flex items-center justify-center text-[10px] text-white font-medium transition-all"
                                style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: color }}
                                title={`${PLATFORM_COLORS[p.platform]?.label || p.platform}: ${(p.totalOrders || 0).toLocaleString()}`}
                              >
                                {pct > 10 ? (p.totalOrders || 0).toLocaleString() : ""}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">ยอดขาย (฿)</p>
                        <div className="flex h-8 rounded-lg overflow-hidden bg-gray-100" data-testid="chart-revenue-stacked">
                          {platformComparison.map((p: any) => {
                            const color = PLATFORM_COLORS[p.platform]?.hex || "#6b7280";
                            const totalRev = platformComparison.reduce((s: number, x: any) => s + (x.totalRevenue || 0), 0);
                            const pct = totalRev > 0 ? ((p.totalRevenue || 0) / totalRev) * 100 : 0;
                            return (
                              <div
                                key={p.platform}
                                className="h-full flex items-center justify-center text-[10px] text-white font-medium transition-all"
                                style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: color }}
                                title={`${PLATFORM_COLORS[p.platform]?.label || p.platform}: ฿${(p.totalRevenue || 0).toLocaleString()}`}
                              >
                                {pct > 10 ? `฿${(p.totalRevenue || 0).toLocaleString()}` : ""}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        {platformComparison.map((p: any) => (
                          <div key={p.platform} className="flex items-center gap-1.5">
                            <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: PLATFORM_COLORS[p.platform]?.hex || "#6b7280" }} />
                            <span className="text-xs text-muted-foreground">{PLATFORM_COLORS[p.platform]?.label || p.platform}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* Tab 4: Restock Suggestions */}
          <TabsContent value="restock" className="space-y-4">
            <Card className="rounded-xl shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-[#fb9678]" />
                  แนะนำเติมสต๊อก
                </CardTitle>
              </CardHeader>
              <CardContent>
                {forecastLoading ? (
                  <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                ) : restockSuggestions.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-300" />
                    <p className="text-sm">ไม่มีสินค้าที่ต้องเติมสต๊อกในขณะนี้</p>
                    <p className="text-xs mt-1">สร้างพยากรณ์ในแท็บแรกเพื่อรับคำแนะนำ</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">SKU</TableHead>
                        <TableHead className="text-xs">ชื่อสินค้า</TableHead>
                        <TableHead className="text-xs text-right">สต๊อกปัจจุบัน</TableHead>
                        <TableHead className="text-xs text-right">ยอดขายเฉลี่ย/วัน</TableHead>
                        <TableHead className="text-xs text-right">วันที่จะหมด</TableHead>
                        <TableHead className="text-xs text-right">แนะนำสั่งซื้อ</TableHead>
                        <TableHead className="text-xs text-center">ความเร่งด่วน</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {restockSuggestions.map((item: any, idx: number) => (
                        <TableRow key={item.id || idx} data-testid={`row-restock-${item.id || idx}`}>
                          <TableCell className="text-xs font-mono">{item.sku || "-"}</TableCell>
                          <TableCell className="text-sm">{item.productName || "-"}</TableCell>
                          <TableCell className="text-sm text-right">{(item.currentStock || 0).toLocaleString()}</TableCell>
                          <TableCell className="text-sm text-right">{(item.avgDailySales || 0).toFixed(1)}</TableCell>
                          <TableCell className="text-sm text-right font-medium">{item.daysLeft} วัน</TableCell>
                          <TableCell className="text-sm text-right font-bold" style={{ color: "#fb9678" }}>{(item.suggestedOrder || 0).toLocaleString()}</TableCell>
                          <TableCell className="text-center">
                            <Badge className={`text-xs ${getUrgencyColor(item.daysLeft)}`} data-testid={`badge-urgency-${item.id || idx}`}>
                              {getUrgencyLabel(item.daysLeft)}
                            </Badge>
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
      </div>
    </EcommerceLayout>
  );
}
