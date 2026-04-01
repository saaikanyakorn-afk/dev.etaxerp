import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowUpRight, ArrowDownRight, DollarSign, Activity, ExternalLink, Users, Clock, ShoppingCart, FileText, Package, TrendingUp, Truck, CheckCircle2, XCircle, RotateCcw, Store, Percent, Minus, Wallet, CalendarDays } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { useAuth } from "@/lib/auth";
import ThaiDateInput from "@/components/thai-date-input";
import { useDateSettings } from "@/hooks/use-date-settings";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";

export { DashboardContent };

function formatMoney(v: number) {
  return `฿${v.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`;
}

function AutoSizeMoney({ value, baseClass }: { value: number; baseClass: string }) {
  const text = formatMoney(value);
  const len = text.length;
  const sizeMap: Record<string, string> = {
    "text-xl": len > 14 ? "text-sm" : len > 11 ? "text-base" : "text-xl",
    "text-base": len > 14 ? "text-xs" : len > 11 ? "text-sm" : "text-base",
    "text-sm": len > 14 ? "text-[11px]" : "text-sm",
  };
  const fontSize = sizeMap[baseClass] || baseClass;
  return <span className={fontSize}>{text}</span>;
}

function GrowthBadge({ value }: { value: number }) {
  if (value === 0) return <span className="text-xs text-muted-foreground">- ไม่มีข้อมูลเทียบ</span>;
  const up = value > 0;
  return (
    <span className={`text-xs font-medium flex items-center gap-0.5 ${up ? "text-emerald-600" : "text-red-500"}`}>
      {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {up ? "+" : ""}{value.toFixed(1)}%
      <span className="text-muted-foreground ml-1 font-normal">vs เดือนที่แล้ว</span>
    </span>
  );
}

const PRODUCT_COLORS = ["#fec90f", "#fb9678", "#03c9d7", "#05b187", "#539BFF"];

const THAI_MONTHS: Record<string, string> = {
  "01": "ม.ค.", "02": "ก.พ.", "03": "มี.ค.", "04": "เม.ย.",
  "05": "พ.ค.", "06": "มิ.ย.", "07": "ก.ค.", "08": "ส.ค.",
  "09": "ก.ย.", "10": "ต.ค.", "11": "พ.ย.", "12": "ธ.ค.",
};

const PLATFORM_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  shopee: { label: "Shopee", color: "#F26522", bg: "#FFF0EC" },
  lazada: { label: "Lazada", color: "#1E71FF", bg: "#EBF2FF" },
  tiktok: { label: "TikTok Shop", color: "#000000", bg: "#F0F0F0" },
  live: { label: "Live Selling", color: "#03c9d7", bg: "#E0F7FA" },
  amazon: { label: "Amazon", color: "#FF9900", bg: "#FFF8EC" },
};

const ORDER_STATUS_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  pending: { label: "รอยืนยัน", icon: Clock, color: "#fec90f" },
  confirmed: { label: "ยืนยันแล้ว", icon: CheckCircle2, color: "#05b187" },
  shipping: { label: "กำลังจัดส่ง", icon: Truck, color: "#539BFF" },
  delivered: { label: "ส่งสำเร็จ", icon: CheckCircle2, color: "#03c9d7" },
  cancelled: { label: "ยกเลิก", icon: XCircle, color: "#f94d4d" },
  returned: { label: "คืนสินค้า", icon: RotateCcw, color: "#fb9678" },
};

function DashboardContent() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const { dateEra, dateFmt } = useDateSettings();

  const now = new Date();
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const today = now.toISOString().split("T")[0];
  const [dateFrom, setDateFrom] = useState(firstOfMonth);
  const [dateTo, setDateTo] = useState(today);

  useEffect(() => {
    if (user?.role === "super_admin") setLocation("/platform");
  }, [user, setLocation]);

  const { data: stats } = useQuery<any>({
    queryKey: ["/api/dashboard/stats", selectedCompany?.id],
    queryFn: async () => {
      const url = selectedCompany?.id ? `/api/dashboard/stats?companyId=${selectedCompany.id}` : "/api/dashboard/stats";
      const r = await fetch(url, { credentials: "include" });
      if (!r.ok) return {};
      return r.json();
    },
    staleTime: 30000,
  });

  const { data: ecomStats } = useQuery<any>({
    queryKey: ["/api/dashboard/ecommerce-stats", companyId, dateFrom, dateTo],
    queryFn: async () => {
      if (!companyId) return null;
      const params = new URLSearchParams({ companyId: String(companyId) });
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      const r = await fetch(`/api/dashboard/ecommerce-stats?${params}`, { credentials: "include" });
      if (!r.ok) return null;
      return r.json();
    },
    enabled: !!companyId,
  });

  const totalSales = stats?.totalSalesThisMonth || 0;
  const salesGrowth = stats?.salesGrowth || 0;
  const totalReceipts = stats?.totalReceiptsThisMonth || 0;
  const receiptsGrowth = stats?.receiptsGrowth || 0;
  const pendingCount = stats?.pendingCount || 0;
  const topProducts: any[] = stats?.topProducts || [];
  const monthlyRevenue: any[] = stats?.monthlyRevenue || [];
  const maxMonthlyRevenue = monthlyRevenue.length > 0 ? Math.max(...monthlyRevenue.map(m => m.revenue)) : 1;

  const platformSales: any[] = ecomStats?.platformSales || [];
  const orderStatusCounts: any = ecomStats?.orderStatusCounts || {};
  const totalEcomOrders = ecomStats?.totalOrdersThisMonth || 0;
  const totalEcomSales = ecomStats?.totalEcomSalesThisMonth || 0;
  const ordersToday = ecomStats?.ordersToday || 0;
  const salesToday = ecomStats?.salesToday || 0;
  const monthlyByPlatform: any[] = ecomStats?.monthlyByPlatform || [];
  const hasEcomData = platformSales.length > 0 || totalEcomOrders > 0;

  const maxPlatformMonthly = monthlyByPlatform.length > 0
    ? Math.max(...monthlyByPlatform.map(m => Math.max(m.shopee || 0, m.lazada || 0, m.tiktok || 0, m.live || 0)), 1)
    : 1;

  return (
      <div className="space-y-8">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-3xl font-heading font-bold tracking-tight text-foreground" data-testid="text-dashboard-title">E-Commerce Hub</h1>
                </div>
                <p className="text-muted-foreground mt-1">
                  ภาพรวมการขายออนไลน์ <span className="font-medium text-foreground">{selectedCompany?.name || "ระบบบัญชีออนไลน์"}</span>
                </p>
                <div className="flex items-center gap-2 flex-wrap mt-2">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">ช่วงเวลา:</span>
                  <ThaiDateInput value={dateFrom} onChange={setDateFrom} dateEra={dateEra} dateFmt={dateFmt} data-testid="input-date-from" />
                  <span className="text-sm text-muted-foreground">-</span>
                  <ThaiDateInput value={dateTo} onChange={setDateTo} dateEra={dateEra} dateFmt={dateFmt} data-testid="input-date-to" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="shadow-lg border-none text-white overflow-hidden relative rounded-xl" style={{ background: "#03c9d7" }}>
            <div className="absolute -bottom-4 -right-4 opacity-10">
              <ShoppingCart className="h-24 w-24" />
            </div>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-white/80 uppercase tracking-wider">ยอดขายเดือนนี้</CardTitle>
              <div className="font-bold mt-1 whitespace-nowrap" data-testid="text-total-sales"><AutoSizeMoney value={totalSales} baseClass="text-xl" /></div>
              <GrowthBadge value={salesGrowth} />
            </CardHeader>
          </Card>

          <Card className="shadow-lg border-none text-white overflow-hidden relative rounded-xl" style={{ background: "#fb9678" }}>
            <div className="absolute -bottom-4 -right-4 opacity-10">
              <Store className="h-24 w-24" />
            </div>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-white/80 uppercase tracking-wider">ยอด E-Commerce</CardTitle>
              <div className="font-bold mt-1 whitespace-nowrap" data-testid="text-ecom-sales"><AutoSizeMoney value={totalEcomSales} baseClass="text-xl" /></div>
              <p className="text-sm text-white/70">{totalEcomOrders} ออเดอร์</p>
            </CardHeader>
          </Card>

          <Card className="shadow-lg border-none text-white overflow-hidden relative rounded-xl" style={{ background: "#fec90f" }}>
            <div className="absolute -bottom-4 -right-4 opacity-10">
              <Package className="h-24 w-24" />
            </div>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-white/80 uppercase tracking-wider">ออเดอร์วันนี้</CardTitle>
              <div className="text-3xl font-bold mt-1" data-testid="text-orders-today">{ordersToday} <span className="text-lg font-normal text-white/70">ออเดอร์</span></div>
              <p className="text-sm text-white/70">{formatMoney(salesToday)}</p>
            </CardHeader>
          </Card>

          <Card className="shadow-lg border-none text-white overflow-hidden relative rounded-xl" style={{ background: (orderStatusCounts.returned || 0) > 0 ? "#f94d4d" : "#05b187" }}>
            <div className="absolute -bottom-4 -right-4 opacity-10">
              <RotateCcw className="h-24 w-24" />
            </div>
            <CardHeader className="pb-2 cursor-pointer" onClick={() => setLocation("/ecommerce/returns")}>
              <CardTitle className="text-sm font-medium text-white/80 uppercase tracking-wider">สินค้าตีกลับ</CardTitle>
              <div className="text-3xl font-bold mt-1" data-testid="text-returned-count">{orderStatusCounts.returned || 0}</div>
              <p className="text-sm text-white/70">ออเดอร์คืนสินค้าเดือนนี้</p>
            </CardHeader>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {(["shopee", "lazada", "tiktok", "live"] as const).map((platform) => {
            const config = PLATFORM_CONFIG[platform];
            const pData = platformSales.find((p: any) => p.platform === platform);
            const orders = pData?.orderCount || 0;
            const sales = pData?.totalSales || 0;
            const fees = pData?.totalFees || 0;
            const net = pData?.netIncome || 0;
            return (
              <Card key={platform} className="shadow-sm border-slate-200 rounded-xl hover:shadow-md transition-all cursor-pointer overflow-hidden" onClick={() => setLocation("/ecommerce/orders")} data-testid={`card-platform-${platform}`}>
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2.5 rounded-full shrink-0" style={{ background: config.bg }}>
                      <Store className="h-5 w-5" style={{ color: config.color }} />
                    </div>
                    <div>
                      <p className="font-bold text-sm" style={{ color: config.color }}>{config.label}</p>
                      <p className="text-[11px] text-muted-foreground">เดือนนี้</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">ออเดอร์</p>
                      <p className="text-xl font-bold mt-0.5" data-testid={`text-orders-${platform}`}>{orders}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">ยอดขาย</p>
                      <p className="font-bold mt-0.5 whitespace-nowrap" data-testid={`text-sales-${platform}`}><AutoSizeMoney value={sales} baseClass="text-base" /></p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">ค่าธรรมเนียม</p>
                      <p className="font-semibold mt-0.5 text-red-500 whitespace-nowrap" data-testid={`text-fees-${platform}`}>-<AutoSizeMoney value={fees} baseClass="text-sm" /></p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">รายได้สุทธิ</p>
                      <p className="font-semibold mt-0.5 whitespace-nowrap" style={{ color: "#05b187" }} data-testid={`text-net-${platform}`}><AutoSizeMoney value={net} baseClass="text-sm" /></p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="shadow-sm border-slate-200 rounded-xl">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold">สรุปค่าธรรมเนียมแพลตฟอร์ม</CardTitle>
                <CardDescription>ค่าคอมมิชชัน ค่าบริการ และค่าธรรมเนียมที่ถูกหักเดือนนี้</CardDescription>
              </div>
              <div className="p-2.5 rounded-full" style={{ background: "#FFF0EC" }}>
                <Percent className="h-5 w-5" style={{ color: "#fb9678" }} />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {(() => {
              const totalCommission = platformSales.reduce((s: number, p: any) => s + (p.commissionFee || 0), 0);
              const totalService = platformSales.reduce((s: number, p: any) => s + (p.serviceFee || 0), 0);
              const totalTransaction = platformSales.reduce((s: number, p: any) => s + (p.transactionFee || 0), 0);
              const totalPayment = platformSales.reduce((s: number, p: any) => s + (p.paymentFee || 0), 0);
              const totalShipping = platformSales.reduce((s: number, p: any) => s + (p.shippingCost || 0), 0);
              const grandTotalFees = totalCommission + totalService + totalTransaction + totalPayment + totalShipping;
              const totalNet = platformSales.reduce((s: number, p: any) => s + (p.netIncome || 0), 0);

              if (grandTotalFees === 0 && platformSales.length === 0) {
                return (
                  <div className="text-center py-8 text-muted-foreground">
                    <Wallet className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">ยังไม่มีข้อมูลค่าธรรมเนียม</p>
                    <p className="text-xs mt-1">ข้อมูลจะแสดงเมื่อมีออเดอร์จากแพลตฟอร์ม</p>
                  </div>
                );
              }

              const FEE_ITEMS = [
                { label: "ค่าคอมมิชชัน", value: totalCommission, color: "#f94d4d", desc: "ส่วนแบ่งที่แพลตฟอร์มหัก" },
                { label: "ค่าบริการ", value: totalService, color: "#fb9678", desc: "ค่าธรรมเนียมบริการ" },
                { label: "ค่าธรรมเนียมธุรกรรม", value: totalTransaction, color: "#05b187", desc: "Transaction Fee" },
                { label: "ค่าธรรมเนียมชำระเงิน", value: totalPayment, color: "#fec90f", desc: "ค่าธรรมเนียมการรับชำระ" },
                { label: "ค่าขนส่ง", value: totalShipping, color: "#539BFF", desc: "ค่าจัดส่งที่แพลตฟอร์มหัก" },
              ];

              const maxFee = Math.max(...FEE_ITEMS.map(f => f.value), 1);

              return (
                <div className="space-y-5">
                  <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
                    {FEE_ITEMS.map((item, i) => (
                      <div key={i} className="p-4 rounded-xl bg-slate-50" data-testid={`fee-item-${i}`}>
                        <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                        <p className="text-lg font-bold" style={{ color: item.color }}>-{formatMoney(item.value)}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{item.desc}</p>
                        <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${(item.value / maxFee) * 100}%`, background: item.color }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border-2 border-dashed border-slate-200">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">ยอดขายรวม</span>
                        <span className="text-lg font-bold" style={{ color: "#03c9d7" }}>{formatMoney(totalEcomSales)}</span>
                      </div>
                      <Minus className="h-4 w-4 text-muted-foreground" />
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">ค่าธรรมเนียมรวม</span>
                        <span className="text-lg font-bold text-red-500">-{formatMoney(grandTotalFees)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">=</span>
                      <div className="px-4 py-2 rounded-lg" style={{ background: "#E8FBF5" }}>
                        <span className="text-sm text-muted-foreground mr-2">รายได้สุทธิ</span>
                        <span className="text-xl font-bold" style={{ color: "#05b187" }} data-testid="text-total-net-income">{formatMoney(totalNet)}</span>
                      </div>
                    </div>
                  </div>

                  {platformSales.length > 1 && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-muted-foreground">
                            <th className="text-left py-2 font-medium">แพลตฟอร์ม</th>
                            <th className="text-right py-2 font-medium">ค่าคอม</th>
                            <th className="text-right py-2 font-medium">ค่าบริการ</th>
                            <th className="text-right py-2 font-medium">ค่าธุรกรรม</th>
                            <th className="text-right py-2 font-medium">ค่าชำระเงิน</th>
                            <th className="text-right py-2 font-medium">ค่าขนส่ง</th>
                            <th className="text-right py-2 font-medium">รวมหัก</th>
                            <th className="text-right py-2 font-medium">สุทธิ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {platformSales.map((p: any) => {
                            const cfg = PLATFORM_CONFIG[p.platform] || { label: p.platform, color: "#666" };
                            return (
                              <tr key={p.platform} className="border-b last:border-0 hover:bg-slate-50" data-testid={`fee-row-${p.platform}`}>
                                <td className="py-2.5 font-medium" style={{ color: cfg.color }}>{cfg.label}</td>
                                <td className="py-2.5 text-right text-red-500">-{formatMoney(p.commissionFee || 0)}</td>
                                <td className="py-2.5 text-right text-red-500">-{formatMoney(p.serviceFee || 0)}</td>
                                <td className="py-2.5 text-right text-red-500">-{formatMoney(p.transactionFee || 0)}</td>
                                <td className="py-2.5 text-right text-red-500">-{formatMoney(p.paymentFee || 0)}</td>
                                <td className="py-2.5 text-right text-red-500">-{formatMoney(p.shippingCost || 0)}</td>
                                <td className="py-2.5 text-right font-semibold text-red-500">-{formatMoney((p.totalFees || 0) + (p.shippingCost || 0))}</td>
                                <td className="py-2.5 text-right font-semibold" style={{ color: "#05b187" }}>{formatMoney(p.netIncome || 0)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })()}
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="shadow-sm border-slate-200 rounded-xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold">สถานะออเดอร์</CardTitle>
                  <CardDescription>สรุปสถานะออเดอร์ทุกแพลตฟอร์ม</CardDescription>
                </div>
                <Button variant="outline" size="sm" className="text-xs" style={{ borderColor: "#fb9678", color: "#fb9678" }} onClick={() => setLocation("/ecommerce/orders")} data-testid="button-view-orders">
                  ดูทั้งหมด
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {!hasEcomData ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Truck className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">ยังไม่มีออเดอร์จากแพลตฟอร์ม</p>
                  <p className="text-xs mt-1">เชื่อมต่อ Shopee, Lazada, TikTok หรือ Live Selling เพื่อเริ่มต้น</p>
                  <Button variant="outline" size="sm" className="mt-3 text-xs" style={{ borderColor: "#03c9d7", color: "#03c9d7" }} onClick={() => setLocation("/ecommerce/connections")} data-testid="button-connect-platform">
                    เชื่อมต่อแพลตฟอร์ม
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {Object.entries(ORDER_STATUS_CONFIG).map(([key, cfg]) => {
                    const count = orderStatusCounts[key] || 0;
                    const Icon = cfg.icon;
                    return (
                      <div key={key} className="text-center p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer" onClick={() => setLocation(`/ecommerce/orders?status=${key}`)} data-testid={`status-${key}`}>
                        <Icon className="h-5 w-5 mx-auto mb-1.5" style={{ color: cfg.color }} />
                        <p className="text-lg font-bold" style={{ color: count > 0 ? cfg.color : undefined }}>{count}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{cfg.label}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm border-slate-200 rounded-xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold">ยอดขายแยกแพลตฟอร์ม</CardTitle>
                  <CardDescription>เปรียบเทียบ 6 เดือนล่าสุด</CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[10px]">
                  {Object.entries(PLATFORM_CONFIG).map(([key, cfg]) => (
                    <div key={key} className="flex items-center gap-1">
                      <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: cfg.color }} />
                      <span className="text-muted-foreground whitespace-nowrap">{cfg.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {monthlyByPlatform.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">ยังไม่มีข้อมูลยอดขายแยกแพลตฟอร์ม</p>
                  <p className="text-xs mt-1">เมื่อมีออเดอร์จาก Shopee, Lazada, TikTok หรือ Live Selling จะแสดงที่นี่</p>
                </div>
              ) : (
                <div className="flex items-end gap-2 h-48">
                  {monthlyByPlatform.map((d: any, i: number) => {
                    const monthNum = d.month?.split("-")[1] || "";
                    const label = THAI_MONTHS[monthNum] || d.month;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1" data-testid={`bar-platform-${i}`}>
                        <div className="w-full flex gap-0.5 items-end justify-center" style={{ height: "160px" }}>
                          {Object.entries(PLATFORM_CONFIG).map(([pKey, pCfg]) => {
                            const val = d[pKey] || 0;
                            const pct = maxPlatformMonthly > 0 ? (val / maxPlatformMonthly) * 100 : 0;
                            return (
                              <div
                                key={pKey}
                                className="w-3 rounded-t-sm transition-all"
                                style={{ background: pCfg.color, height: `${Math.max(pct, 2)}%` }}
                                title={`${pCfg.label}: ${formatMoney(val)}`}
                              />
                            );
                          })}
                        </div>
                        <span className="text-[10px] text-muted-foreground">{label}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Card className="col-span-4 shadow-sm">
            <CardHeader>
              <CardTitle>สินค้าขายดี (Top Products)</CardTitle>
              <CardDescription>รายการสินค้าที่ทำยอดขายสูงสุด (ทุกช่องทาง)</CardDescription>
            </CardHeader>
            <CardContent>
              {topProducts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">ยังไม่มีข้อมูลยอดขายสินค้า</p>
                  <p className="text-xs mt-1">เมื่อมีเอกสารขายในระบบ ข้อมูลจะแสดงที่นี่</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {topProducts.map((item: any, i: number) => (
                    <div key={i} className="flex items-center" data-testid={`row-product-${i}`}>
                      <div className="h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-sm" style={{ background: PRODUCT_COLORS[i % PRODUCT_COLORS.length] }}>
                        {i + 1}
                      </div>
                      <div className="ml-4 flex-1 space-y-1">
                        <p className="text-sm leading-none">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.code ? `${item.code} · ` : ""}{Number(item.qty).toLocaleString()} ชิ้น
                        </p>
                      </div>
                      <div className="ml-auto font-bold text-sm">{formatMoney(item.revenue)}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="col-span-3 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" style={{ color: "#03c9d7" }} />
                ยอดขายรายเดือน
              </CardTitle>
              <CardDescription>เทรนด์ยอดขาย 6 เดือนล่าสุด</CardDescription>
            </CardHeader>
            <CardContent>
              {monthlyRevenue.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">ยังไม่มีข้อมูลยอดขาย</p>
                </div>
              ) : (
                <div data-testid="chart-monthly-sales-line">
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={monthlyRevenue.map((item: any) => {
                      const monthNum = item.month?.split("-")[1] || "";
                      return { name: THAI_MONTHS[monthNum] || item.month, revenue: item.revenue };
                    })} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#03c9d7" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#03c9d7" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#888" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "#888" }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v.toString()} width={50} />
                      <Tooltip
                        contentStyle={{ borderRadius: "10px", border: "1px solid #e5e7eb", boxShadow: "0 4px 12px rgba(0,0,0,0.08)", fontSize: "13px" }}
                        formatter={(value: number) => [formatMoney(value), "ยอดขาย"]}
                        labelStyle={{ fontWeight: 600, color: "#333" }}
                      />
                      <Area type="monotone" dataKey="revenue" stroke="#03c9d7" strokeWidth={3} fill="url(#colorRevenue)" dot={{ r: 5, fill: "#03c9d7", stroke: "#fff", strokeWidth: 2 }} activeDot={{ r: 7, fill: "#03c9d7", stroke: "#fff", strokeWidth: 3 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
  );
}

export default function Dashboard() {
  return (
    <Layout>
      <DashboardContent />
    </Layout>
  );
}
