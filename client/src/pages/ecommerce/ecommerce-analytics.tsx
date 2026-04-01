import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import EcommerceLayout from "@/components/ecommerce-layout";
import { useCompany } from "@/lib/company-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DollarSign, TrendingUp, ShoppingCart, Receipt, BarChart3, Loader2, Package, Percent,
} from "lucide-react";

const PLATFORM_COLORS: Record<string, { hex: string; label: string }> = {
  shopee: { hex: "#EE4D2D", label: "Shopee" },
  lazada: { hex: "#0F146D", label: "Lazada" },
  tiktok: { hex: "#000000", label: "TikTok Shop" },
  amazon: { hex: "#FF9900", label: "Amazon" },
};

const PERIODS = [
  { value: "7d", label: "7 วัน" },
  { value: "30d", label: "30 วัน" },
  { value: "90d", label: "90 วัน" },
  { value: "365d", label: "365 วัน" },
];

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  pending: { label: "รอดำเนินการ", className: "bg-amber-100 text-amber-700 hover:bg-amber-100" },
  confirmed: { label: "ยืนยันแล้ว", className: "bg-blue-100 text-blue-700 hover:bg-blue-100" },
  delivered: { label: "จัดส่งแล้ว", className: "bg-green-100 text-green-700 hover:bg-green-100" },
  cancelled: { label: "ยกเลิก", className: "bg-red-100 text-red-700 hover:bg-red-100" },
};

function formatCurrency(v: number | string | null | undefined) {
  return Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type AnalyticsData = {
  summary: {
    totalOrders: number;
    totalRevenue: number;
    totalFees: number;
    totalNetIncome: number;
    avgOrderValue: number;
  };
  platformStats: Record<string, { orders: number; revenue: number; fees: number; netIncome: number }>;
  dailySales: { date: string; revenue: number; orders: number; netIncome: number }[];
  topProducts: { name: string; qty: number; revenue: number; count: number }[];
  statusCounts: Record<string, number>;
};

export default function EcommerceAnalytics() {
  const { selectedCompanyId } = useCompany();
  const [period, setPeriod] = useState("30d");

  const { data, isLoading } = useQuery<AnalyticsData>({
    queryKey: ["/api/ecommerce/analytics", selectedCompanyId, period],
    queryFn: async () => {
      const r = await fetch(`/api/ecommerce/analytics?companyId=${selectedCompanyId}&period=${period}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const summary = data?.summary || { totalOrders: 0, totalRevenue: 0, totalFees: 0, totalNetIncome: 0, avgOrderValue: 0 };
  const platformStats = data?.platformStats || {};
  const dailySales = data?.dailySales || [];
  const topProducts = (data?.topProducts || []).slice(0, 20);
  const statusCounts = data?.statusCounts || {};

  const maxPlatformRevenue = Math.max(...Object.values(platformStats).map(s => s.revenue), 1);
  const maxPlatformOrders = Math.max(...Object.values(platformStats).map(s => s.orders), 1);
  const maxDailyRevenue = Math.max(...dailySales.map(d => d.revenue), 1);

  const kpis = [
    { label: "ยอดขายรวม", value: `฿${formatCurrency(summary.totalRevenue)}`, icon: DollarSign, color: "#fb9678", bgColor: "bg-orange-50" },
    { label: "ค่าธรรมเนียมรวม", value: `฿${formatCurrency(summary.totalFees)}`, icon: Receipt, color: "#f94d4d", bgColor: "bg-red-50" },
    { label: "รายได้สุทธิ", value: `฿${formatCurrency(summary.totalNetIncome)}`, icon: TrendingUp, color: "#03c9d7", bgColor: "bg-cyan-50" },
    { label: "ออเดอร์ทั้งหมด", value: summary.totalOrders.toLocaleString(), icon: ShoppingCart, color: "#fb9678", bgColor: "bg-orange-50" },
    { label: "เฉลี่ยต่อออเดอร์", value: `฿${formatCurrency(summary.avgOrderValue)}`, icon: BarChart3, color: "#03c9d7", bgColor: "bg-cyan-50" },
    { label: "อัตรากำไร", value: summary.totalRevenue > 0 ? (summary.totalNetIncome / summary.totalRevenue * 100).toFixed(1) + '%' : '0%', icon: Percent, color: "#05b187", bgColor: "bg-green-50" },
  ];

  return (
    <EcommerceLayout>
      <div className="space-y-6" data-testid="page-analytics">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-800" data-testid="text-analytics-title">วิเคราะห์ยอดขาย</h1>
            <p className="text-sm text-muted-foreground mt-1">สรุปยอดขายรวมทุกแพลตฟอร์ม</p>
          </div>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[140px] h-9 text-sm rounded-lg" data-testid="select-period">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map(p => (
                <SelectItem key={p.value} value={p.value} data-testid={`select-period-${p.value}`}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              {kpis.map((kpi, i) => (
                <Card key={i} className="rounded-xl shadow-sm border" data-testid={`card-kpi-${i}`}>
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${kpi.bgColor}`}>
                        <kpi.icon className="h-5 w-5" style={{ color: kpi.color }} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs text-muted-foreground truncate">{kpi.label}</div>
                        <div className="text-lg font-bold truncate" style={{ color: kpi.color }}>{kpi.value}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="rounded-xl shadow-sm border" data-testid="card-platform-comparison">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold text-gray-800">เปรียบเทียบแพลตฟอร์ม</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {Object.keys(platformStats).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">ไม่มีข้อมูล</p>
                  ) : (
                    Object.entries(platformStats).map(([platform, stats]) => {
                      const pc = PLATFORM_COLORS[platform];
                      const hex = pc?.hex || "#888";
                      const label = pc?.label || platform;
                      const revPct = (stats.revenue / maxPlatformRevenue) * 100;
                      const ordPct = (stats.orders / maxPlatformOrders) * 100;
                      return (
                        <div key={platform} className="space-y-1.5" data-testid={`platform-stat-${platform}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: hex }} />
                              <span className="text-sm font-medium">{label}</span>
                            </div>
                            <span className="text-xs text-muted-foreground">{stats.orders} ออเดอร์</span>
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-muted-foreground w-14 text-right">ยอดขาย</span>
                              <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{ width: `${revPct}%`, backgroundColor: hex }}
                                />
                              </div>
                              <span className="text-xs font-medium w-24 text-right">฿{formatCurrency(stats.revenue)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-muted-foreground w-14 text-right">ค่าธรรม</span>
                              <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-500 opacity-60"
                                  style={{ width: `${stats.revenue > 0 ? (stats.fees / stats.revenue) * 100 : 0}%`, backgroundColor: hex }}
                                />
                              </div>
                              <span className="text-xs text-red-500 w-24 text-right">-฿{formatCurrency(stats.fees)}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs pl-16">
                              <span className="text-muted-foreground">รายได้สุทธิ</span>
                              <span className="font-medium text-green-600">฿{formatCurrency(stats.netIncome)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-xl shadow-sm border" data-testid="card-order-status">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold text-gray-800">สถานะออเดอร์</CardTitle>
                </CardHeader>
                <CardContent>
                  {Object.keys(statusCounts).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">ไม่มีข้อมูล</p>
                  ) : (
                    <div className="space-y-3">
                      {Object.entries(statusCounts).map(([status, count]) => {
                        const sm = STATUS_MAP[status] || { label: status, className: "bg-gray-100 text-gray-700 hover:bg-gray-100" };
                        const totalOrders = Object.values(statusCounts).reduce((a, b) => a + b, 0);
                        const pct = totalOrders > 0 ? (count / totalOrders) * 100 : 0;
                        return (
                          <div key={status} className="flex items-center gap-3" data-testid={`status-${status}`}>
                            <Badge className={`${sm.className} min-w-[100px] justify-center`}>{sm.label}</Badge>
                            <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                                style={{
                                  width: `${Math.max(pct, 5)}%`,
                                  backgroundColor: status === "pending" ? "#f59e0b" : status === "confirmed" ? "#3b82f6" : status === "delivered" ? "#22c55e" : "#ef4444",
                                }}
                              >
                                {pct > 15 && <span className="text-[10px] text-white font-medium">{pct.toFixed(0)}%</span>}
                              </div>
                            </div>
                            <span className="text-sm font-semibold w-12 text-right">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="rounded-xl shadow-sm border" data-testid="card-daily-sales">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold text-gray-800">ยอดขายรายวัน</CardTitle>
              </CardHeader>
              <CardContent>
                {dailySales.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">ไม่มีข้อมูล</p>
                ) : (
                  <div className="overflow-x-auto">
                    <div className="flex items-end gap-[2px] min-w-[400px]" style={{ height: "180px" }}>
                      {dailySales.map((day, i) => {
                        const pct = (day.revenue / maxDailyRevenue) * 100;
                        const d = new Date(day.date);
                        const label = `${d.getDate()}/${d.getMonth() + 1}`;
                        return (
                          <div
                            key={i}
                            className="flex-1 flex flex-col items-center justify-end group relative"
                            style={{ minWidth: dailySales.length > 30 ? "8px" : "16px" }}
                            data-testid={`bar-daily-${i}`}
                          >
                            <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[9px] px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                              {label}: ฿{formatCurrency(day.revenue)} ({day.orders} ออเดอร์)
                            </div>
                            <div
                              className="w-full rounded-t transition-all duration-300 hover:opacity-80 cursor-pointer"
                              style={{
                                height: `${Math.max(pct, 2)}%`,
                                backgroundColor: "#fb9678",
                              }}
                            />
                            {dailySales.length <= 31 && (
                              <span className="text-[8px] text-muted-foreground mt-1 rotate-[-45deg] origin-top-left whitespace-nowrap">{label}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-xl shadow-sm border" data-testid="card-top-products">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5" style={{ color: "#fb9678" }} />
                  <CardTitle className="text-base font-semibold text-gray-800">สินค้าขายดี (Top 20)</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {topProducts.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">ไม่มีข้อมูล</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs w-10">#</TableHead>
                          <TableHead className="text-xs">ชื่อสินค้า</TableHead>
                          <TableHead className="text-xs text-right">จำนวนขาย</TableHead>
                          <TableHead className="text-xs text-right">จำนวนออเดอร์</TableHead>
                          <TableHead className="text-xs text-right">ยอดขาย</TableHead>
                          <TableHead className="text-xs w-40">สัดส่วน</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {topProducts.map((product, i) => {
                          const maxRev = topProducts[0]?.revenue || 1;
                          const pct = (product.revenue / maxRev) * 100;
                          return (
                            <TableRow key={i} data-testid={`row-product-${i}`}>
                              <TableCell className="text-xs font-medium text-muted-foreground">{i + 1}</TableCell>
                              <TableCell className="text-sm font-medium">{product.name}</TableCell>
                              <TableCell className="text-sm text-right">{product.qty.toLocaleString()}</TableCell>
                              <TableCell className="text-sm text-right">{product.count.toLocaleString()}</TableCell>
                              <TableCell className="text-sm text-right font-medium">฿{formatCurrency(product.revenue)}</TableCell>
                              <TableCell>
                                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full transition-all duration-500"
                                    style={{ width: `${pct}%`, backgroundColor: "#fb9678" }}
                                  />
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </EcommerceLayout>
  );
}
