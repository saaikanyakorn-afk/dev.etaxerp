import { useState } from "react";
import ThaiDateInput from "@/components/thai-date-input";
import { useDateSettings } from "@/hooks/use-date-settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import CILayout from "@/components/ci-layout";
import { useQuery } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import {
  BrainCircuit,
  DollarSign,
  TrendingUp,
  Megaphone,
  Percent,
  ShoppingCart,
  Receipt,
  AlertTriangle,
  Package,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import CIExportButton from "./ci-export-button";

function formatMoney(v: number) {
  if (v >= 1_000_000) return `฿${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `฿${(v / 1_000).toFixed(1)}K`;
  return `฿${v.toLocaleString("th-TH", { minimumFractionDigits: 2 })}`;
}

function formatNumber(v: number) {
  return v.toLocaleString("th-TH");
}

const CHANNEL_COLORS: Record<string, string> = {
  shopee: "#F26522",
  lazada: "#1E71FF",
  tiktok: "#000000",
  line: "#06C755",
  facebook: "#1877F2",
  amazon: "#FF9900",
  website: "#8B5CF6",
};

const SKU_COLORS = ["#F26522", "#1E71FF", "#06C755", "#8B5CF6", "#FF9900", "#03c9d7", "#f43f5e", "#fec90f", "#14b8a6", "#6366f1"];

const SEVERITY_CONFIG = {
  red: { bg: "bg-red-50 border-red-200", text: "text-red-700", badge: "bg-red-100 text-red-800" },
  yellow: { bg: "bg-yellow-50 border-yellow-200", text: "text-yellow-700", badge: "bg-yellow-100 text-yellow-800" },
  blue: { bg: "bg-blue-50 border-blue-200", text: "text-blue-700", badge: "bg-blue-100 text-blue-800" },
};

export default function CIExecutive() {
  const { selectedCompany } = useCompany();
  const { dateEra, dateFmt } = useDateSettings();
  const companyId = selectedCompany?.id;

  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const [dateFrom, setDateFrom] = useState(firstDay.toISOString().split("T")[0]);
  const [dateTo, setDateTo] = useState(today.toISOString().split("T")[0]);
  const [channelFilter, setChannelFilter] = useState("");

  const buildParams = () => {
    const params = new URLSearchParams();
    if (companyId) params.set("companyId", String(companyId));
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (channelFilter) params.set("platform", channelFilter);
    return params.toString();
  };

  const { data: execData, isLoading } = useQuery<any>({
    queryKey: ["/api/ci/executive-stats", companyId, dateFrom, dateTo, channelFilter],
    queryFn: async () => {
      const r = await fetch(`/api/ci/executive-stats?${buildParams()}`, { credentials: "include" });
      if (!r.ok) return null;
      return r.json();
    },
    enabled: !!companyId,
  });

  const { data: channelData } = useQuery<any>({
    queryKey: ["/api/ci/channel-stats", companyId, dateFrom, dateTo, channelFilter],
    queryFn: async () => {
      const r = await fetch(`/api/ci/channel-stats?${buildParams()}`, { credentials: "include" });
      if (!r.ok) return null;
      return r.json();
    },
    enabled: !!companyId,
  });

  const { data: alertData } = useQuery<any>({
    queryKey: ["/api/ci/alerts", companyId, dateFrom, dateTo],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (companyId) params.set("companyId", String(companyId));
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      const r = await fetch(`/api/ci/alerts?${params.toString()}`, { credentials: "include" });
      if (!r.ok) return null;
      return r.json();
    },
    enabled: !!companyId,
  });

  const kpi = execData?.kpi || { revenue: 0, profit: 0, adSpend: 0, margin: 0, orderCount: 0, aov: 0 };
  const topChannels: any[] = execData?.topChannels || [];
  const topSkus: any[] = execData?.topSkus || [];
  const stockRisks: any[] = execData?.stockRisks || [];
  const alerts: any[] = alertData?.alerts || [];

  const dailyTrend: any[] = channelData?.dailyTrend || [];

  const trendByDate: Record<string, number> = {};
  dailyTrend.forEach((d: any) => {
    trendByDate[d.date] = (trendByDate[d.date] || 0) + d.revenue;
  });
  const revenueTrendData = Object.entries(trendByDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, revenue]) => ({
      date: date.slice(5),
      revenue: Math.round(revenue),
    }));

  const channelBarData = topChannels.map((c: any) => ({
    name: c.platform || "unknown",
    revenue: Math.round(c.revenue),
    orders: c.orders,
  }));

  const skuBarData = [...topSkus]
    .sort((a, b) => a.revenue - b.revenue)
    .map((s: any) => ({
      name: (s.name || s.sku || "N/A").slice(0, 25),
      revenue: Math.round(s.revenue),
      sku: s.sku,
    }));

  const availableChannels = topChannels.map((c: any) => c.platform).filter(Boolean);

  const kpiCards = [
    { label: "รายได้", value: formatMoney(kpi.revenue), icon: DollarSign, color: "#05b187" },
    { label: "กำไร", value: formatMoney(kpi.profit), icon: TrendingUp, color: kpi.profit >= 0 ? "#05b187" : "#f43f5e" },
    { label: "ค่าโฆษณา", value: formatMoney(kpi.adSpend), icon: Megaphone, color: "#F26522" },
    { label: "Margin %", value: `${kpi.margin}%`, icon: Percent, color: kpi.margin >= 20 ? "#05b187" : kpi.margin >= 10 ? "#fec90f" : "#f43f5e" },
    { label: "จำนวนออเดอร์", value: formatNumber(kpi.orderCount), icon: ShoppingCart, color: "#539BFF" },
    { label: "AOV", value: formatMoney(kpi.aov), icon: Receipt, color: "#8B5CF6" },
  ];

  return (
    <CILayout>
      <div className="space-y-6" data-testid="ci-executive-page">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl" style={{ background: "#667eea" }}>
              <BrainCircuit className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold" data-testid="text-page-title">Executive Dashboard</h1>
              <p className="text-muted-foreground text-sm" data-testid="text-page-subtitle">ภาพรวมธุรกิจ Commerce Intelligence</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap" data-testid="filter-section">
            <CIExportButton
              fileName={`CI-Executive-${dateFrom}-${dateTo}`}
              pdfTitle="Executive Dashboard"
              kpis={kpiCards.map(k => ({ label: k.label, value: k.value }))}
              tables={[
                {
                  title: "Channel Revenue",
                  sheetName: "Channels",
                  columns: [
                    { header: "Platform", key: "name" },
                    { header: "Revenue", key: "revenue", format: "money" },
                    { header: "Orders", key: "orders", format: "number" },
                  ],
                  data: channelBarData,
                },
                {
                  title: "Top SKUs",
                  sheetName: "Top SKUs",
                  columns: [
                    { header: "SKU", key: "sku" },
                    { header: "Name", key: "name" },
                    { header: "Qty", key: "qty", format: "number" },
                    { header: "Revenue", key: "revenue", format: "money" },
                  ],
                  data: topSkus,
                },
                {
                  title: "Stock Risks",
                  sheetName: "Stock Risks",
                  columns: [
                    { header: "Name", key: "name" },
                    { header: "Code", key: "code" },
                    { header: "Current Stock", key: "currentStock", format: "number" },
                    { header: "Threshold", key: "threshold", format: "number" },
                  ],
                  data: stockRisks,
                },
              ]}
            />
            <ThaiDateInput
              value={dateFrom}
              onChange={setDateFrom}
              dateEra={dateEra} dateFmt={dateFmt}
              className="w-[160px] h-9 text-sm"
              data-testid="input-date-from"
            />
            <span className="text-muted-foreground text-sm">ถึง</span>
            <ThaiDateInput
              value={dateTo}
              onChange={setDateTo}
              dateEra={dateEra} dateFmt={dateFmt}
              className="w-[160px] h-9 text-sm"
              data-testid="input-date-to"
            />
            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              className="h-9 px-3 text-sm border rounded-md bg-background"
              data-testid="select-channel-filter"
            >
              <option value="">ทุกช่องทาง</option>
              {availableChannels.map((ch: string) => (
                <option key={ch} value={ch}>{ch}</option>
              ))}
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4">
                  <div className="h-4 bg-muted rounded w-16 mb-2" />
                  <div className="h-6 bg-muted rounded w-24" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4" data-testid="kpi-cards">
              {kpiCards.map((card) => (
                <Card key={card.label} className="hover:shadow-md transition-shadow" data-testid={`card-kpi-${card.label}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-muted-foreground font-medium">{card.label}</span>
                      <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${card.color}15` }}>
                        <card.icon className="h-4 w-4" style={{ color: card.color }} />
                      </div>
                    </div>
                    <div className="text-lg font-bold tracking-tight" data-testid={`text-kpi-${card.label}`}>{card.value}</div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {alerts.length > 0 && (
              <div className="space-y-2" data-testid="alert-panel">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  แจ้งเตือน ({alerts.length})
                </h3>
                <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                  {alerts.map((alert: any, idx: number) => {
                    const config = SEVERITY_CONFIG[alert.severity as keyof typeof SEVERITY_CONFIG] || SEVERITY_CONFIG.blue;
                    return (
                      <div
                        key={idx}
                        className={`p-3 rounded-lg border ${config.bg}`}
                        data-testid={`alert-item-${idx}`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={`text-[10px] ${config.badge}`} data-testid={`badge-alert-severity-${idx}`}>
                            {alert.severity === "red" ? "วิกฤต" : alert.severity === "yellow" ? "เตือน" : "แนะนำ"}
                          </Badge>
                          <span className={`text-xs font-semibold ${config.text}`}>{alert.title}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{alert.message}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid lg:grid-cols-2 gap-6">
              <Card data-testid="card-revenue-trend">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Revenue Trend</CardTitle>
                </CardHeader>
                <CardContent>
                  {revenueTrendData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <LineChart data={revenueTrendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
                        <Tooltip
                          formatter={(value: number) => [`฿${value.toLocaleString()}`, "Revenue"]}
                          labelStyle={{ fontWeight: "bold" }}
                        />
                        <Line
                          type="monotone"
                          dataKey="revenue"
                          stroke="#667eea"
                          strokeWidth={2}
                          dot={{ r: 3 }}
                          activeDot={{ r: 5 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground" data-testid="text-no-trend-data">
                      ไม่มีข้อมูล Revenue Trend
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card data-testid="card-channel-comparison">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Channel Comparison</CardTitle>
                </CardHeader>
                <CardContent>
                  {channelBarData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={channelBarData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
                        <Tooltip
                          formatter={(value: number) => [`฿${value.toLocaleString()}`, "Revenue"]}
                        />
                        <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                          {channelBarData.map((entry, index) => (
                            <Cell key={index} fill={CHANNEL_COLORS[entry.name] || "#8884d8"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground" data-testid="text-no-channel-data">
                      ไม่มีข้อมูลช่องทาง
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card data-testid="card-top-skus">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Top 10 SKUs by Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                {skuBarData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={Math.max(300, skuBarData.length * 35)}>
                    <BarChart data={skuBarData} layout="vertical" margin={{ left: 120, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={110} />
                      <Tooltip
                        formatter={(value: number) => [`฿${value.toLocaleString()}`, "Revenue"]}
                      />
                      <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                        {skuBarData.map((_, index) => (
                          <Cell key={index} fill={SKU_COLORS[index % SKU_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground" data-testid="text-no-sku-data">
                    ไม่มีข้อมูล SKU
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid lg:grid-cols-2 gap-6">
              <Card data-testid="card-top-products-table">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                    สินค้าขายดี (Top Revenue)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {topSkus.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm" data-testid="table-top-products">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 px-2 text-xs text-muted-foreground font-medium">#</th>
                            <th className="text-left py-2 px-2 text-xs text-muted-foreground font-medium">สินค้า</th>
                            <th className="text-right py-2 px-2 text-xs text-muted-foreground font-medium">จำนวน</th>
                            <th className="text-right py-2 px-2 text-xs text-muted-foreground font-medium">รายได้</th>
                          </tr>
                        </thead>
                        <tbody>
                          {topSkus.map((s: any, idx: number) => (
                            <tr key={idx} className="border-b last:border-0 hover:bg-muted/30" data-testid={`row-product-${idx}`}>
                              <td className="py-2 px-2 text-muted-foreground">{idx + 1}</td>
                              <td className="py-2 px-2">
                                <div className="font-medium text-xs truncate max-w-[180px]">{s.name || s.sku}</div>
                                {s.sku && <div className="text-[10px] text-muted-foreground">{s.sku}</div>}
                              </td>
                              <td className="py-2 px-2 text-right tabular-nums">{formatNumber(s.qty)}</td>
                              <td className="py-2 px-2 text-right tabular-nums font-medium">{formatMoney(s.revenue)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="py-8 text-center text-sm text-muted-foreground" data-testid="text-no-products">
                      ไม่มีข้อมูลสินค้า
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card data-testid="card-stock-risks">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Package className="h-4 w-4 text-amber-500" />
                    สต็อกใกล้หมด ({stockRisks.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {stockRisks.length > 0 ? (
                    <div className="space-y-2 max-h-[320px] overflow-y-auto">
                      {stockRisks.map((s: any, idx: number) => (
                        <div
                          key={idx}
                          className={`flex items-center justify-between p-2.5 rounded-lg border ${s.currentStock <= 0 ? "bg-red-50 border-red-200" : "bg-yellow-50 border-yellow-200"}`}
                          data-testid={`stock-risk-${idx}`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium truncate">{s.name}</div>
                            <div className="text-[10px] text-muted-foreground">{s.code}</div>
                          </div>
                          <div className="text-right ml-3">
                            <div className={`text-sm font-bold ${s.currentStock <= 0 ? "text-red-600" : "text-amber-600"}`}>
                              {s.currentStock} ชิ้น
                            </div>
                            <div className="text-[10px] text-muted-foreground">ขั้นต่ำ: {s.threshold}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 text-center text-sm text-muted-foreground" data-testid="text-no-stock-risks">
                      ไม่มีสินค้าที่สต็อกใกล้หมด
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </CILayout>
  );
}
