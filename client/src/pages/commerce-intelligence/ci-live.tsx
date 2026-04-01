import { useState, useMemo } from "react";
import ThaiDateInput from "@/components/thai-date-input";
import { useDateSettings } from "@/hooks/use-date-settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import CILayout from "@/components/ci-layout";
import { useCompany } from "@/lib/company-context";
import { useQuery } from "@tanstack/react-query";
import CIExportButton from "./ci-export-button";
import {
  BrainCircuit,
  Video,
  DollarSign,
  ShoppingCart,
  Clock,
  TrendingUp,
  Users,
  MessageSquare,
  Eye,
  Trophy,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

interface LiveSession {
  id: number;
  title: string;
  platform: string;
  hostName: string;
  status: string;
  startedAt: string;
  endedAt: string;
  durationMinutes: number;
  gmv: number;
  totalOrders: number;
  paidOrders: number;
  totalItemsSold: number;
  revenuePerMin: number;
  conversionRate: number;
  peakViewers: number;
  avgViewers: number;
  totalComments: number;
  adSpend: number;
}

interface HostComparison {
  hostName: string;
  sessions: number;
  totalGmv: number;
  totalOrders: number;
  avgGmvPerSession: number;
  avgRevenuePerMin: number;
}

interface TimeSlot {
  hour: number;
  sessions: number;
  avgGmv: number;
}

interface LiveStatsData {
  sessions: LiveSession[];
  hostComparison: HostComparison[];
  timeSlotAnalysis: TimeSlot[];
}

function formatNumber(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return n.toLocaleString("th-TH", { maximumFractionDigits: 2 });
}

function formatCurrency(n: number): string {
  return "฿" + n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatHour(hour: number): string {
  return `${hour.toString().padStart(2, "0")}:00`;
}

function getPlatformColor(platform: string): string {
  const colors: Record<string, string> = {
    shopee: "bg-orange-100 text-orange-700",
    lazada: "bg-blue-100 text-blue-700",
    tiktok: "bg-pink-100 text-pink-700",
    facebook: "bg-indigo-100 text-indigo-700",
    instagram: "bg-purple-100 text-purple-700",
    line: "bg-green-100 text-green-700",
  };
  return colors[platform?.toLowerCase()] || "bg-gray-100 text-gray-700";
}

function getStatusBadge(status: string) {
  if (status === "live" || status === "active") return <Badge className="bg-green-500 text-white" data-testid="badge-status-live">LIVE</Badge>;
  if (status === "ended" || status === "completed") return <Badge variant="secondary" data-testid="badge-status-ended">จบแล้ว</Badge>;
  return <Badge variant="outline" data-testid="badge-status-other">{status}</Badge>;
}

function getHeatmapColor(value: number, max: number): string {
  if (max === 0) return "bg-gray-100 dark:bg-gray-800";
  const ratio = value / max;
  if (ratio >= 0.8) return "bg-emerald-500 text-white";
  if (ratio >= 0.6) return "bg-emerald-400 text-white";
  if (ratio >= 0.4) return "bg-emerald-300 text-emerald-900";
  if (ratio >= 0.2) return "bg-emerald-200 text-emerald-800";
  if (ratio > 0) return "bg-emerald-100 text-emerald-700";
  return "bg-gray-100 dark:bg-gray-800 text-gray-400";
}

export default function CILive() {
  const { selectedCompanyId } = useCompany();
  const { dateEra, dateFmt } = useDateSettings();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all");

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedCompanyId) params.set("companyId", String(selectedCompanyId));
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    return params.toString();
  }, [selectedCompanyId, dateFrom, dateTo]);

  const { data, isLoading } = useQuery<LiveStatsData>({
    queryKey: ["/api/ci/live-stats", queryParams],
    queryFn: async () => {
      const r = await fetch(`/api/ci/live-stats?${queryParams}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch live stats");
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const sessions = data?.sessions || [];
  const hostComparison = data?.hostComparison || [];
  const timeSlotAnalysis = data?.timeSlotAnalysis || [];

  const filteredSessions = useMemo(() => {
    if (platformFilter === "all") return sessions;
    return sessions.filter(s => s.platform?.toLowerCase() === platformFilter.toLowerCase());
  }, [sessions, platformFilter]);

  const platforms = useMemo(() => {
    const set = new Set(sessions.map(s => s.platform?.toLowerCase()).filter(Boolean));
    return Array.from(set);
  }, [sessions]);

  const totalGmv = filteredSessions.reduce((sum, s) => sum + s.gmv, 0);
  const totalOrders = filteredSessions.reduce((sum, s) => sum + s.totalOrders, 0);
  const totalMinutes = filteredSessions.reduce((sum, s) => sum + s.durationMinutes, 0);
  const avgRevenuePerMin = totalMinutes > 0 ? totalGmv / totalMinutes : 0;
  const avgConversion = filteredSessions.length > 0
    ? filteredSessions.reduce((sum, s) => sum + s.conversionRate, 0) / filteredSessions.length
    : 0;
  const totalAdSpend = filteredSessions.reduce((sum, s) => sum + s.adSpend, 0);

  const maxSlotGmv = Math.max(...timeSlotAnalysis.map(t => t.avgGmv), 0);
  const bestSlot = timeSlotAnalysis.reduce<TimeSlot | null>((best, slot) => {
    if (!best || slot.avgGmv > best.avgGmv) return slot;
    return best;
  }, null);

  const sortedHosts = [...hostComparison].sort((a, b) => b.totalGmv - a.totalGmv);

  return (
    <CILayout>
      <div className="space-y-6" data-testid="ci-live-page">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-2">
          <div className="flex items-center gap-3">
            <BrainCircuit className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold" data-testid="text-page-title">Live Commerce Dashboard</h1>
              <p className="text-muted-foreground" data-testid="text-page-subtitle">วิเคราะห์ Live Selling — GMV, Revenue/min, Host comparison</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <CIExportButton
              fileName={`CI-Live-Commerce${dateFrom ? `-${dateFrom}` : ""}${dateTo ? `-${dateTo}` : ""}`}
              pdfTitle="Live Commerce Dashboard"
              kpis={[
                { label: "Total GMV", value: formatCurrency(totalGmv) },
                { label: "Total Orders", value: formatNumber(totalOrders) },
                { label: "Revenue/Min", value: formatCurrency(avgRevenuePerMin) },
                { label: "Avg Conversion", value: `${avgConversion.toFixed(1)}%` },
                { label: "Sessions", value: String(filteredSessions.length) },
                { label: "Ad Spend", value: formatCurrency(totalAdSpend) },
              ]}
              tables={[
                {
                  title: "Live Sessions",
                  sheetName: "Sessions",
                  columns: [
                    { header: "Title", key: "title", width: 25 },
                    { header: "Host", key: "hostName", width: 15 },
                    { header: "Platform", key: "platform", width: 12 },
                    { header: "GMV", key: "gmv", format: "money", width: 14 },
                    { header: "Orders", key: "totalOrders", format: "number", width: 10 },
                    { header: "Viewers", key: "peakViewers", format: "number", width: 10 },
                    { header: "Duration (min)", key: "durationMinutes", format: "number", width: 14 },
                    { header: "Conversion %", key: "conversionRate", format: "percent", width: 12 },
                    { header: "Ad Spend", key: "adSpend", format: "money", width: 12 },
                  ],
                  data: filteredSessions,
                },
                {
                  title: "Host Comparison",
                  sheetName: "Hosts",
                  columns: [
                    { header: "Host", key: "hostName", width: 20 },
                    { header: "Sessions", key: "sessions", format: "number", width: 10 },
                    { header: "Total GMV", key: "totalGmv", format: "money", width: 15 },
                    { header: "Total Orders", key: "totalOrders", format: "number", width: 12 },
                    { header: "Avg GMV/Session", key: "avgGmvPerSession", format: "money", width: 16 },
                    { header: "Revenue/Min", key: "avgRevenuePerMin", format: "money", width: 14 },
                  ],
                  data: sortedHosts,
                },
              ]}
            />
            <ThaiDateInput
              value={dateFrom}
              onChange={setDateFrom}
              dateEra={dateEra} dateFmt={dateFmt}
              className="w-[160px] h-9"
              data-testid="input-date-from"
            />
            <span className="text-muted-foreground text-sm">ถึง</span>
            <ThaiDateInput
              value={dateTo}
              onChange={setDateTo}
              dateEra={dateEra} dateFmt={dateFmt}
              className="w-[160px] h-9"
              data-testid="input-date-to"
            />
            <Select value={platformFilter} onValueChange={setPlatformFilter}>
              <SelectTrigger className="w-[140px] h-9" data-testid="select-platform-filter">
                <SelectValue placeholder="ทุกแพลตฟอร์ม" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกแพลตฟอร์ม</SelectItem>
                {platforms.map(p => (
                  <SelectItem key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}><CardContent className="p-4"><div className="animate-pulse space-y-2"><div className="h-4 bg-gray-200 rounded w-20" /><div className="h-8 bg-gray-200 rounded w-24" /></div></CardContent></Card>
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <Card data-testid="card-kpi-sessions">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                    <Video className="h-4 w-4" />
                    <span>Sessions</span>
                  </div>
                  <div className="text-2xl font-bold" data-testid="text-total-sessions">{filteredSessions.length}</div>
                </CardContent>
              </Card>
              <Card data-testid="card-kpi-gmv">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                    <DollarSign className="h-4 w-4" />
                    <span>Total GMV</span>
                  </div>
                  <div className="text-2xl font-bold" data-testid="text-total-gmv">{formatCurrency(totalGmv)}</div>
                </CardContent>
              </Card>
              <Card data-testid="card-kpi-orders">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                    <ShoppingCart className="h-4 w-4" />
                    <span>Orders</span>
                  </div>
                  <div className="text-2xl font-bold" data-testid="text-total-orders">{formatNumber(totalOrders)}</div>
                </CardContent>
              </Card>
              <Card data-testid="card-kpi-rpm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                    <TrendingUp className="h-4 w-4" />
                    <span>Revenue/min</span>
                  </div>
                  <div className="text-2xl font-bold" data-testid="text-avg-rpm">{formatCurrency(avgRevenuePerMin)}</div>
                </CardContent>
              </Card>
              <Card data-testid="card-kpi-conversion">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                    <Users className="h-4 w-4" />
                    <span>Conversion</span>
                  </div>
                  <div className="text-2xl font-bold" data-testid="text-avg-conversion">{avgConversion.toFixed(1)}%</div>
                </CardContent>
              </Card>
              <Card data-testid="card-kpi-adspend">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                    <DollarSign className="h-4 w-4 text-red-500" />
                    <span>Ad Spend</span>
                  </div>
                  <div className="text-2xl font-bold" data-testid="text-total-adspend">{formatCurrency(totalAdSpend)}</div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card data-testid="card-host-comparison">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-amber-500" />
                    Host Comparison
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {sortedHosts.length === 0 ? (
                    <p className="text-muted-foreground text-sm text-center py-8">ไม่มีข้อมูล Host</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>#</TableHead>
                          <TableHead>Host</TableHead>
                          <TableHead className="text-right">Sessions</TableHead>
                          <TableHead className="text-right">Total GMV</TableHead>
                          <TableHead className="text-right">Avg GMV/Session</TableHead>
                          <TableHead className="text-right">Avg ฿/min</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedHosts.map((host, i) => (
                          <TableRow key={host.hostName} data-testid={`row-host-${i}`}>
                            <TableCell>
                              {i === 0 ? <Trophy className="h-4 w-4 text-amber-500" /> : <span className="text-muted-foreground">{i + 1}</span>}
                            </TableCell>
                            <TableCell className="font-medium" data-testid={`text-host-name-${i}`}>{host.hostName}</TableCell>
                            <TableCell className="text-right">{host.sessions}</TableCell>
                            <TableCell className="text-right font-medium" data-testid={`text-host-gmv-${i}`}>{formatCurrency(host.totalGmv)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(host.avgGmvPerSession)}</TableCell>
                            <TableCell className="text-right">
                              <span className="text-emerald-600 font-medium">{formatCurrency(host.avgRevenuePerMin)}</span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              <Card data-testid="card-timeslot-analysis">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-blue-500" />
                    Best Time Slot Analysis
                  </CardTitle>
                  {bestSlot && (
                    <p className="text-sm text-muted-foreground">
                      ช่วงเวลาที่ดีที่สุด: <span className="font-medium text-emerald-600">{formatHour(bestSlot.hour)}</span> (Avg GMV: {formatCurrency(bestSlot.avgGmv)})
                    </p>
                  )}
                </CardHeader>
                <CardContent>
                  {timeSlotAnalysis.length === 0 ? (
                    <p className="text-muted-foreground text-sm text-center py-8">ไม่มีข้อมูลช่วงเวลา</p>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-6 gap-1.5" data-testid="heatmap-timeslots">
                        {Array.from({ length: 24 }).map((_, hour) => {
                          const slot = timeSlotAnalysis.find(t => t.hour === hour);
                          const avgGmv = slot?.avgGmv || 0;
                          const sessionCount = slot?.sessions || 0;
                          return (
                            <div
                              key={hour}
                              className={`rounded-md p-2 text-center text-xs transition-colors ${getHeatmapColor(avgGmv, maxSlotGmv)}`}
                              title={`${formatHour(hour)} — ${sessionCount} sessions, Avg GMV: ${formatCurrency(avgGmv)}`}
                              data-testid={`timeslot-${hour}`}
                            >
                              <div className="font-medium">{formatHour(hour)}</div>
                              {sessionCount > 0 && (
                                <div className="text-[10px] mt-0.5">{sessionCount}x</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                        <span>น้อย</span>
                        <div className="flex gap-0.5">
                          <div className="w-4 h-3 rounded bg-gray-100" />
                          <div className="w-4 h-3 rounded bg-emerald-100" />
                          <div className="w-4 h-3 rounded bg-emerald-200" />
                          <div className="w-4 h-3 rounded bg-emerald-300" />
                          <div className="w-4 h-3 rounded bg-emerald-400" />
                          <div className="w-4 h-3 rounded bg-emerald-500" />
                        </div>
                        <span>มาก</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card data-testid="card-session-history">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Video className="h-5 w-5 text-primary" />
                  Live Session History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {filteredSessions.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-8">ไม่มีข้อมูล Live Session</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Session</TableHead>
                          <TableHead>Platform</TableHead>
                          <TableHead>Host</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Duration</TableHead>
                          <TableHead className="text-right">GMV</TableHead>
                          <TableHead className="text-right">Orders</TableHead>
                          <TableHead className="text-right">฿/min</TableHead>
                          <TableHead className="text-right">Conversion</TableHead>
                          <TableHead className="text-right">Peak Viewers</TableHead>
                          <TableHead className="text-right">Comments</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredSessions.map((session, i) => (
                          <TableRow key={session.id} data-testid={`row-session-${session.id}`}>
                            <TableCell>
                              <div>
                                <div className="font-medium text-sm" data-testid={`text-session-title-${session.id}`}>{session.title || `Session #${session.id}`}</div>
                                <div className="text-xs text-muted-foreground">
                                  {session.startedAt ? new Date(session.startedAt).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" }) : "-"}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={getPlatformColor(session.platform)} data-testid={`badge-platform-${session.id}`}>
                                {session.platform || "-"}
                              </Badge>
                            </TableCell>
                            <TableCell data-testid={`text-host-${session.id}`}>{session.hostName || "-"}</TableCell>
                            <TableCell>{getStatusBadge(session.status)}</TableCell>
                            <TableCell className="text-right">{session.durationMinutes} min</TableCell>
                            <TableCell className="text-right font-medium" data-testid={`text-gmv-${session.id}`}>{formatCurrency(session.gmv)}</TableCell>
                            <TableCell className="text-right">{session.totalOrders}</TableCell>
                            <TableCell className="text-right">
                              <span className={session.revenuePerMin > avgRevenuePerMin ? "text-emerald-600 font-medium" : ""}>
                                {formatCurrency(session.revenuePerMin)}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">{session.conversionRate.toFixed(1)}%</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Eye className="h-3 w-3 text-muted-foreground" />
                                {formatNumber(session.peakViewers)}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <MessageSquare className="h-3 w-3 text-muted-foreground" />
                                {formatNumber(session.totalComments)}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {filteredSessions.length > 0 && (
              <Card data-testid="card-product-performance">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5 text-violet-500" />
                    Product Performance in Live Sessions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="rounded-lg border p-4" data-testid="card-top-session">
                      <div className="text-sm text-muted-foreground mb-2">Top Session by GMV</div>
                      {(() => {
                        const top = [...filteredSessions].sort((a, b) => b.gmv - a.gmv)[0];
                        return top ? (
                          <div>
                            <div className="font-semibold text-lg">{formatCurrency(top.gmv)}</div>
                            <div className="text-sm text-muted-foreground">{top.title || `Session #${top.id}`}</div>
                            <div className="text-xs text-muted-foreground mt-1">{top.totalItemsSold} items sold • {top.totalOrders} orders</div>
                          </div>
                        ) : null;
                      })()}
                    </div>
                    <div className="rounded-lg border p-4" data-testid="card-top-rpm-session">
                      <div className="text-sm text-muted-foreground mb-2">Top Session by Revenue/min</div>
                      {(() => {
                        const top = [...filteredSessions].sort((a, b) => b.revenuePerMin - a.revenuePerMin)[0];
                        return top ? (
                          <div>
                            <div className="font-semibold text-lg">{formatCurrency(top.revenuePerMin)}<span className="text-sm text-muted-foreground">/min</span></div>
                            <div className="text-sm text-muted-foreground">{top.title || `Session #${top.id}`}</div>
                            <div className="text-xs text-muted-foreground mt-1">{top.durationMinutes} min • GMV {formatCurrency(top.gmv)}</div>
                          </div>
                        ) : null;
                      })()}
                    </div>
                    <div className="rounded-lg border p-4" data-testid="card-top-conversion-session">
                      <div className="text-sm text-muted-foreground mb-2">Top Session by Conversion</div>
                      {(() => {
                        const top = [...filteredSessions].sort((a, b) => b.conversionRate - a.conversionRate)[0];
                        return top ? (
                          <div>
                            <div className="font-semibold text-lg">{top.conversionRate.toFixed(1)}%</div>
                            <div className="text-sm text-muted-foreground">{top.title || `Session #${top.id}`}</div>
                            <div className="text-xs text-muted-foreground mt-1">{top.paidOrders}/{top.totalComments} comments converted</div>
                          </div>
                        ) : null;
                      })()}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </CILayout>
  );
}
