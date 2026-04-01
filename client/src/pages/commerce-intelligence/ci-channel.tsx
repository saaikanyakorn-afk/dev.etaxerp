import { useState, useMemo } from "react";
import ThaiDateInput from "@/components/thai-date-input";
import { useDateSettings } from "@/hooks/use-date-settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import CILayout from "@/components/ci-layout";
import { useQuery } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Cell
} from "recharts";
import {
  BrainCircuit, Store, TrendingUp, TrendingDown, ShoppingCart,
  DollarSign, BarChart3, Percent, ArrowUpRight, ArrowDownRight, Minus, Package
} from "lucide-react";
import CIExportButton from "./ci-export-button";

const CHANNEL_COLORS: Record<string, string> = {
  shopee: "#EE4D2D",
  lazada: "#0F146D",
  tiktok: "#000000",
  line: "#06C755",
  facebook: "#1877F2",
  website: "#6366F1",
  other: "#94A3B8",
};

const CHART_COLORS = ["#EE4D2D", "#0F146D", "#25F4EE", "#06C755", "#1877F2", "#6366F1", "#F59E0B", "#EC4899"];

function formatCurrency(value: number): string {
  if (value >= 1000000) return `฿${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `฿${(value / 1000).toFixed(1)}K`;
  return `฿${value.toFixed(0)}`;
}

function formatNumber(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toFixed(0);
}

interface ChannelData {
  platform: string;
  connectionId: number;
  storeName: string;
  revenue: number;
  orders: number;
  aov: number;
  fees: number;
  shipping: number;
  netIncome: number;
  margin: number;
  refundRate: number;
}

interface DailyTrend {
  date: string;
  platform: string;
  revenue: number;
  orders: number;
}

export default function CIChannel() {
  const { selectedCompanyId } = useCompany();
  const { dateEra, dateFmt } = useDateSettings();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState("all");

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedCompanyId) params.set("companyId", String(selectedCompanyId));
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (selectedPlatform !== "all") params.set("platform", selectedPlatform);
    return params.toString();
  }, [selectedCompanyId, dateFrom, dateTo, selectedPlatform]);

  const { data, isLoading } = useQuery<{ channels: ChannelData[]; dailyTrend: DailyTrend[] }>({
    queryKey: ["/api/ci/channel-stats", queryParams],
    queryFn: async () => {
      const res = await fetch(`/api/ci/channel-stats?${queryParams}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch channel stats");
      return res.json();
    },
    enabled: !!selectedCompanyId,
  });

  const channels = data?.channels || [];
  const dailyTrend = data?.dailyTrend || [];

  const totalRevenue = channels.reduce((sum, c) => sum + c.revenue, 0);
  const totalOrders = channels.reduce((sum, c) => sum + c.orders, 0);
  const avgMargin = channels.length > 0 ? channels.reduce((sum, c) => sum + c.margin, 0) / channels.length : 0;

  const platforms = useMemo(() => {
    const set = new Set(channels.map(c => c.platform));
    return Array.from(set);
  }, [channels]);

  const stackedBarData = useMemo(() => {
    const dateMap: Record<string, Record<string, number>> = {};
    for (const d of dailyTrend) {
      if (!dateMap[d.date]) dateMap[d.date] = {};
      dateMap[d.date][d.platform] = (dateMap[d.date][d.platform] || 0) + d.revenue;
    }
    return Object.entries(dateMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, platforms]) => ({
        date: date.slice(5),
        ...platforms,
      }));
  }, [dailyTrend]);

  const trendLineData = useMemo(() => {
    const dateMap: Record<string, Record<string, number>> = {};
    for (const d of dailyTrend) {
      if (!dateMap[d.date]) dateMap[d.date] = {};
      dateMap[d.date][d.platform] = (dateMap[d.date][d.platform] || 0) + d.orders;
    }
    return Object.entries(dateMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, platforms]) => ({
        date: date.slice(5),
        ...platforms,
      }));
  }, [dailyTrend]);

  const allPlatformsInTrend = useMemo(() => {
    const set = new Set(dailyTrend.map(d => d.platform));
    return Array.from(set);
  }, [dailyTrend]);

  const channelGrowth = useMemo(() => {
    if (dailyTrend.length === 0) return {};
    const dates = [...new Set(dailyTrend.map(d => d.date))].sort();
    if (dates.length < 2) return {};
    const mid = Math.floor(dates.length / 2);
    const firstHalf = dates.slice(0, mid);
    const secondHalf = dates.slice(mid);

    const growth: Record<string, number> = {};
    for (const platform of allPlatformsInTrend) {
      const firstRev = dailyTrend
        .filter(d => d.platform === platform && firstHalf.includes(d.date))
        .reduce((s, d) => s + d.revenue, 0);
      const secondRev = dailyTrend
        .filter(d => d.platform === platform && secondHalf.includes(d.date))
        .reduce((s, d) => s + d.revenue, 0);
      growth[platform] = firstRev > 0 ? ((secondRev - firstRev) / firstRev) * 100 : (secondRev > 0 ? 100 : 0);
    }
    return growth;
  }, [dailyTrend, allPlatformsInTrend]);

  const sortedChannels = useMemo(() => {
    return [...channels].sort((a, b) => b.revenue - a.revenue);
  }, [channels]);

  return (
    <CILayout>
      <div className="space-y-6" data-testid="ci-channel-page">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-2">
          <div className="flex items-center gap-3">
            <BrainCircuit className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold" data-testid="text-page-title">Channel Dashboard</h1>
              <p className="text-muted-foreground" data-testid="text-page-subtitle">วิเคราะห์ยอดขายตามช่องทาง</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <CIExportButton
              fileName={`CI-Channel-${dateFrom}-${dateTo}`}
              pdfTitle="Channel Dashboard"
              kpis={sortedChannels.length > 0 ? [
                { label: "Total Revenue", value: formatCurrency(sortedChannels.reduce((s, c) => s + c.revenue, 0)) },
                { label: "Total Orders", value: String(sortedChannels.reduce((s, c) => s + c.orders, 0)) },
                { label: "Channels", value: String(sortedChannels.length) },
              ] : []}
              tables={[{
                title: "Channel Performance",
                sheetName: "Channels",
                columns: [
                  { header: "Platform", key: "platform", width: 15 },
                  { header: "Store", key: "storeName", width: 25 },
                  { header: "Revenue", key: "revenue", format: "money", width: 15 },
                  { header: "Orders", key: "orders", format: "number", width: 10 },
                  { header: "AOV", key: "aov", format: "money", width: 12 },
                  { header: "Fees", key: "fees", format: "money", width: 12 },
                  { header: "Net Income", key: "netIncome", format: "money", width: 15 },
                  { header: "Margin %", key: "margin", format: "percent", width: 10 },
                  { header: "Refund %", key: "refundRate", format: "percent", width: 10 },
                ],
                data: sortedChannels,
              }]}
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
            <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
              <SelectTrigger className="w-[130px] h-9" data-testid="select-platform-filter">
                <SelectValue placeholder="ทุกช่องทาง" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกช่องทาง</SelectItem>
                {platforms.map(p => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-4 bg-muted rounded w-1/3 mb-3" />
                  <div className="h-8 bg-muted rounded w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card data-testid="card-total-revenue">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">รายรับรวม</p>
                      <p className="text-2xl font-bold mt-1" data-testid="text-total-revenue">{formatCurrency(totalRevenue)}</p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                      <DollarSign className="h-6 w-6 text-green-600" />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">{channels.length} ช่องทาง</p>
                </CardContent>
              </Card>

              <Card data-testid="card-total-orders">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">ออเดอร์รวม</p>
                      <p className="text-2xl font-bold mt-1" data-testid="text-total-orders">{formatNumber(totalOrders)}</p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                      <ShoppingCart className="h-6 w-6 text-blue-600" />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">AOV เฉลี่ย {totalOrders > 0 ? formatCurrency(totalRevenue / totalOrders) : "฿0"}</p>
                </CardContent>
              </Card>

              <Card data-testid="card-avg-margin">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Margin เฉลี่ย</p>
                      <p className="text-2xl font-bold mt-1" data-testid="text-avg-margin">{avgMargin.toFixed(1)}%</p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
                      <Percent className="h-6 w-6 text-purple-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {sortedChannels.map((channel, idx) => {
                const growth = channelGrowth[channel.platform];
                const revenueShare = totalRevenue > 0 ? (channel.revenue / totalRevenue) * 100 : 0;
                const color = CHANNEL_COLORS[channel.platform?.toLowerCase()] || CHANNEL_COLORS.other;

                return (
                  <Card key={`${channel.platform}-${channel.connectionId}`} data-testid={`card-channel-${channel.platform}-${channel.connectionId}`}>
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
                          <span className="font-semibold text-sm capitalize">{channel.storeName || channel.platform}</span>
                        </div>
                        <Badge variant="outline" className="text-xs capitalize" data-testid={`badge-platform-${channel.connectionId}`}>
                          {channel.platform}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-muted-foreground text-xs">Revenue</p>
                          <p className="font-semibold" data-testid={`text-channel-revenue-${channel.connectionId}`}>{formatCurrency(channel.revenue)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Orders</p>
                          <p className="font-semibold" data-testid={`text-channel-orders-${channel.connectionId}`}>{formatNumber(channel.orders)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">AOV</p>
                          <p className="font-semibold">{formatCurrency(channel.aov)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Margin</p>
                          <p className={`font-semibold ${channel.margin >= 0 ? "text-green-600" : "text-red-600"}`}>{channel.margin.toFixed(1)}%</p>
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">Share:</span>
                          <span className="font-medium">{revenueShare.toFixed(1)}%</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">Refund:</span>
                          <span className={channel.refundRate > 5 ? "text-red-500 font-medium" : ""}>{channel.refundRate.toFixed(1)}%</span>
                        </div>
                        {growth !== undefined && (
                          <div className="flex items-center gap-0.5">
                            {growth > 5 ? (
                              <ArrowUpRight className="h-3 w-3 text-green-500" />
                            ) : growth < -5 ? (
                              <ArrowDownRight className="h-3 w-3 text-red-500" />
                            ) : (
                              <Minus className="h-3 w-3 text-gray-400" />
                            )}
                            <span className={`font-medium ${growth > 5 ? "text-green-500" : growth < -5 ? "text-red-500" : "text-gray-400"}`}>
                              {growth > 0 ? "+" : ""}{growth.toFixed(0)}%
                            </span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {sortedChannels.length === 0 && (
                <Card className="col-span-full">
                  <CardContent className="p-8 text-center text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>ยังไม่มีข้อมูลช่องทางขาย</p>
                    <p className="text-xs mt-1">เชื่อมต่อร้านค้าออนไลน์เพื่อเริ่มวิเคราะห์</p>
                  </CardContent>
                </Card>
              )}
            </div>

            {stackedBarData.length > 0 && (
              <Card data-testid="card-revenue-by-channel">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Revenue by Channel (Stacked)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stackedBarData}>
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCurrency(v)} />
                        <Tooltip
                          formatter={(value: number, name: string) => [formatCurrency(value), name]}
                          labelFormatter={(label) => `วันที่ ${label}`}
                        />
                        <Legend />
                        {allPlatformsInTrend.map((platform, idx) => (
                          <Bar
                            key={platform}
                            dataKey={platform}
                            stackId="revenue"
                            fill={CHART_COLORS[idx % CHART_COLORS.length]}
                            name={platform}
                          />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {trendLineData.length > 0 && (
              <Card data-testid="card-growth-trend">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Growth Trend per Channel (Orders)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trendLineData}>
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip
                          formatter={(value: number, name: string) => [formatNumber(value), name]}
                          labelFormatter={(label) => `วันที่ ${label}`}
                        />
                        <Legend />
                        {allPlatformsInTrend.map((platform, idx) => (
                          <Line
                            key={platform}
                            type="monotone"
                            dataKey={platform}
                            stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                            strokeWidth={2}
                            dot={false}
                            name={platform}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {sortedChannels.length > 0 && (
              <Card data-testid="card-channel-metrics-table">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Store className="h-5 w-5" />
                    Channel Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="pb-3 font-medium text-muted-foreground">Channel</th>
                          <th className="pb-3 font-medium text-muted-foreground text-right">Revenue</th>
                          <th className="pb-3 font-medium text-muted-foreground text-right">Orders</th>
                          <th className="pb-3 font-medium text-muted-foreground text-right">AOV</th>
                          <th className="pb-3 font-medium text-muted-foreground text-right">Net Income</th>
                          <th className="pb-3 font-medium text-muted-foreground text-right">Margin</th>
                          <th className="pb-3 font-medium text-muted-foreground text-right">Refund Rate</th>
                          <th className="pb-3 font-medium text-muted-foreground text-right">Trend</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedChannels.map((channel) => {
                          const growth = channelGrowth[channel.platform];
                          const color = CHANNEL_COLORS[channel.platform?.toLowerCase()] || CHANNEL_COLORS.other;
                          return (
                            <tr
                              key={`${channel.platform}-${channel.connectionId}`}
                              className="border-b last:border-0 hover:bg-muted/50 transition-colors"
                              data-testid={`row-channel-${channel.connectionId}`}
                            >
                              <td className="py-3">
                                <div className="flex items-center gap-2">
                                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                                  <span className="font-medium">{channel.storeName || channel.platform}</span>
                                  <Badge variant="secondary" className="text-[10px] capitalize">{channel.platform}</Badge>
                                </div>
                              </td>
                              <td className="py-3 text-right font-medium">{formatCurrency(channel.revenue)}</td>
                              <td className="py-3 text-right">{formatNumber(channel.orders)}</td>
                              <td className="py-3 text-right">{formatCurrency(channel.aov)}</td>
                              <td className="py-3 text-right font-medium">{formatCurrency(channel.netIncome)}</td>
                              <td className="py-3 text-right">
                                <span className={channel.margin >= 0 ? "text-green-600" : "text-red-600"}>
                                  {channel.margin.toFixed(1)}%
                                </span>
                              </td>
                              <td className="py-3 text-right">
                                <span className={channel.refundRate > 5 ? "text-red-500 font-medium" : ""}>
                                  {channel.refundRate.toFixed(1)}%
                                </span>
                              </td>
                              <td className="py-3 text-right">
                                {growth !== undefined ? (
                                  <div className="flex items-center justify-end gap-1">
                                    {growth > 5 ? (
                                      <Badge variant="default" className="bg-green-100 text-green-700 hover:bg-green-100 text-xs">
                                        <ArrowUpRight className="h-3 w-3 mr-0.5" />
                                        +{growth.toFixed(0)}%
                                      </Badge>
                                    ) : growth < -5 ? (
                                      <Badge variant="default" className="bg-red-100 text-red-700 hover:bg-red-100 text-xs">
                                        <ArrowDownRight className="h-3 w-3 mr-0.5" />
                                        {growth.toFixed(0)}%
                                      </Badge>
                                    ) : (
                                      <Badge variant="secondary" className="text-xs">
                                        <Minus className="h-3 w-3 mr-0.5" />
                                        Stable
                                      </Badge>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {Object.keys(channelGrowth).length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card data-testid="card-growing-channels">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-green-600">
                      <TrendingUp className="h-5 w-5" />
                      ช่องทางที่กำลังเติบโต
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {Object.entries(channelGrowth)
                      .filter(([, g]) => g > 5)
                      .sort(([, a], [, b]) => b - a)
                      .map(([platform, growth]) => (
                        <div key={platform} className="flex items-center justify-between py-2 border-b last:border-0">
                          <div className="flex items-center gap-2">
                            <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CHANNEL_COLORS[platform?.toLowerCase()] || CHANNEL_COLORS.other }} />
                            <span className="font-medium capitalize">{platform}</span>
                          </div>
                          <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                            <ArrowUpRight className="h-3 w-3 mr-0.5" />
                            +{growth.toFixed(0)}%
                          </Badge>
                        </div>
                      )) || null}
                    {Object.entries(channelGrowth).filter(([, g]) => g > 5).length === 0 && (
                      <p className="text-muted-foreground text-sm">ยังไม่มีช่องทางที่เติบโตชัดเจน</p>
                    )}
                  </CardContent>
                </Card>

                <Card data-testid="card-declining-channels">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-red-600">
                      <TrendingDown className="h-5 w-5" />
                      ช่องทางที่ลดลง
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {Object.entries(channelGrowth)
                      .filter(([, g]) => g < -5)
                      .sort(([, a], [, b]) => a - b)
                      .map(([platform, growth]) => (
                        <div key={platform} className="flex items-center justify-between py-2 border-b last:border-0">
                          <div className="flex items-center gap-2">
                            <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CHANNEL_COLORS[platform?.toLowerCase()] || CHANNEL_COLORS.other }} />
                            <span className="font-medium capitalize">{platform}</span>
                          </div>
                          <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
                            <ArrowDownRight className="h-3 w-3 mr-0.5" />
                            {growth.toFixed(0)}%
                          </Badge>
                        </div>
                      )) || null}
                    {Object.entries(channelGrowth).filter(([, g]) => g < -5).length === 0 && (
                      <p className="text-muted-foreground text-sm">ไม่มีช่องทางที่ลดลง</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </>
        )}
      </div>
    </CILayout>
  );
}
