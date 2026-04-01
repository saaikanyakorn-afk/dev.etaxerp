import { useState } from "react";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import {
  TrendingUp, TrendingDown, AlertTriangle, Activity,
  BarChart3, Wallet, ArrowRightLeft, RefreshCw, FileDown, Clock, Target, Printer
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend
} from "recharts";
import * as XLSX from "xlsx";

function fmt(val: number): string {
  return val.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtShort(val: number): string {
  if (Math.abs(val) >= 1000000) return (val / 1000000).toFixed(1) + "M";
  if (Math.abs(val) >= 1000) return (val / 1000).toFixed(1) + "K";
  return val.toFixed(0);
}

interface ForecastPoint {
  day: number;
  date: string;
  bestCase: number;
  expected: number;
  worstCase: number;
}

interface ForecastData {
  currentCash: number;
  totalAR: number;
  totalAP: number;
  forecast: ForecastPoint[];
  snapshots: {
    day30: ForecastPoint | null;
    day60: ForecastPoint | null;
    day90: ForecastPoint | null;
  };
  workingCapital: {
    currentAssets: number;
    currentLiabilities: number;
    netWorkingCapital: number;
    workingCapitalRatio: number;
    cashConversionCycle: number;
    dso: number;
    dpo: number;
    dio: number;
    monthlyTrend: { month: string; ratio: number; nwc: number; ccc: number }[];
  };
  alerts: { date: string; projectedBalance: number; scenario: string }[];
}

export default function CashFlowForecast() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const [threshold, setThreshold] = useState<number>(100000);
  const [thresholdInput, setThresholdInput] = useState("100000");

  const { data, isLoading, refetch } = useQuery<ForecastData>({
    queryKey: ["/api/finance/cash-flow-forecast", companyId, threshold],
    queryFn: async () => {
      const res = await fetch(
        `/api/finance/cash-flow-forecast?companyId=${companyId}&threshold=${threshold}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to fetch forecast");
      return res.json();
    },
    enabled: !!companyId,
  });

  const handleThresholdApply = () => {
    const val = parseFloat(thresholdInput);
    if (!isNaN(val) && val >= 0) {
      setThreshold(val);
    }
  };

  const handleExcel = () => {
    if (!data) return;
    const wb = XLSX.utils.book_new();

    const forecastRows = [
      ["Cash Flow Forecast - " + (selectedCompany?.name || "")],
      [""],
      ["Day", "Date", "Best Case", "Expected", "Worst Case"],
      ...data.forecast.filter((_, i) => i % 5 === 0 || i === data.forecast.length - 1).map(f => [
        f.day, f.date, f.bestCase, f.expected, f.worstCase,
      ]),
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(forecastRows);
    XLSX.utils.book_append_sheet(wb, ws1, "Forecast");

    const wcRows = [
      ["Working Capital Monitor"],
      [""],
      ["Metric", "Value"],
      ["Current Assets", data.workingCapital.currentAssets],
      ["Current Liabilities", data.workingCapital.currentLiabilities],
      ["Net Working Capital", data.workingCapital.netWorkingCapital],
      ["Working Capital Ratio", data.workingCapital.workingCapitalRatio],
      ["DSO (Days Sales Outstanding)", data.workingCapital.dso],
      ["DIO (Days Inventory Outstanding)", data.workingCapital.dio],
      ["DPO (Days Payable Outstanding)", data.workingCapital.dpo],
      ["Cash Conversion Cycle", data.workingCapital.cashConversionCycle],
      [""],
      ["Monthly Trend"],
      ["Month", "WC Ratio", "Net Working Capital", "CCC (วัน)"],
      ...data.workingCapital.monthlyTrend.map(t => [t.month, t.ratio, t.nwc, t.ccc]),
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(wcRows);
    XLSX.utils.book_append_sheet(wb, ws2, "Working Capital");

    XLSX.writeFile(wb, `cash-flow-forecast-${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const chartData = data?.forecast.filter((_, i) => i % 3 === 0 || i === (data?.forecast.length ?? 0) - 1).map(f => ({
    ...f,
    label: f.day === 0 ? "Today" : f.day === 30 ? "30d" : f.day === 60 ? "60d" : f.day === 90 ? "90d" : `${f.day}d`,
    dateLabel: f.date.slice(5),
  })) || [];

  const wcTrendData = data?.workingCapital.monthlyTrend.map(t => ({
    ...t,
    monthLabel: t.month.slice(5) + "/" + t.month.slice(2, 4),
  })) || [];

  const barData = data ? [
    { name: "Current Assets", value: data.workingCapital.currentAssets, fill: "#03c9d7" },
    { name: "Current Liabilities", value: data.workingCapital.currentLiabilities, fill: "#fb9678" },
  ] : [];

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-[#03c9d7]" />
            <h1 className="text-xl font-bold text-gray-800" data-testid="text-page-title">
              Cash Flow Forecast & Working Capital
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs border-green-400 text-green-600 hover:bg-green-50"
              onClick={() => refetch()}
              disabled={isLoading}
              data-testid="button-refresh"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
              รีเฟรช
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => window.print()}
              disabled={!data}
              data-testid="button-print"
            >
              <Printer className="h-3.5 w-3.5" />
              PDF/พิมพ์
            </Button>
            <Button
              size="sm"
              className="h-8 gap-1.5 text-xs bg-[#05b187] text-white hover:bg-[#049a75] border-none"
              onClick={handleExcel}
              disabled={!data}
              data-testid="button-excel"
            >
              <FileDown className="h-3.5 w-3.5" />
              Excel
            </Button>
          </div>
        </div>

        {!companyId ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-8 text-center text-muted-foreground">
              กรุณาเลือกบริษัทเพื่อดูพยากรณ์เงินสด
            </CardContent>
          </Card>
        ) : isLoading ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-8 text-center text-muted-foreground">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
              กำลังคำนวณพยากรณ์...
            </CardContent>
          </Card>
        ) : data ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="border-0 shadow-sm" data-testid="card-current-cash">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Wallet className="h-4 w-4 text-[#03c9d7]" />
                    <span className="text-xs text-muted-foreground">เงินสดปัจจุบัน</span>
                  </div>
                  <div className="text-lg font-bold text-[#03c9d7]" data-testid="text-current-cash">
                    ฿{fmt(data.currentCash)}
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm" data-testid="card-total-ar">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    <span className="text-xs text-muted-foreground">ลูกหนี้ค้างรับ (AR)</span>
                  </div>
                  <div className="text-lg font-bold text-green-600" data-testid="text-total-ar">
                    ฿{fmt(data.totalAR)}
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm" data-testid="card-total-ap">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingDown className="h-4 w-4 text-[#fb9678]" />
                    <span className="text-xs text-muted-foreground">เจ้าหนี้ค้างจ่าย (AP)</span>
                  </div>
                  <div className="text-lg font-bold text-[#fb9678]" data-testid="text-total-ap">
                    ฿{fmt(data.totalAP)}
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm" data-testid="card-net-wc">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Activity className="h-4 w-4 text-purple-500" />
                    <span className="text-xs text-muted-foreground">Net Working Capital</span>
                  </div>
                  <div className={`text-lg font-bold ${data.workingCapital.netWorkingCapital >= 0 ? "text-green-600" : "text-red-500"}`} data-testid="text-net-wc">
                    ฿{fmt(data.workingCapital.netWorkingCapital)}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              {[
                { label: "30 วัน", snap: data.snapshots.day30, testId: "card-snapshot-30" },
                { label: "60 วัน", snap: data.snapshots.day60, testId: "card-snapshot-60" },
                { label: "90 วัน", snap: data.snapshots.day90, testId: "card-snapshot-90" },
              ].map(({ label, snap, testId }) => (
                <Card key={label} className="border-0 shadow-sm" data-testid={testId}>
                  <CardContent className="p-4">
                    <div className="text-xs text-muted-foreground mb-2 font-medium">Projection {label}</div>
                    {snap ? (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-green-600">Best Case</span>
                          <span className="font-mono font-medium text-green-600">฿{fmt(snap.bestCase)}</span>
                        </div>
                        <div className="flex justify-between text-sm font-bold">
                          <span className="text-blue-600">Expected</span>
                          <span className="font-mono text-blue-600">฿{fmt(snap.expected)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-red-500">Worst Case</span>
                          <span className="font-mono font-medium text-red-500">฿{fmt(snap.worstCase)}</span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="border-0 shadow-md" data-testid="card-forecast-chart">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-[#03c9d7]" />
                  Cash Flow Projection (90 วัน)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="dateLabel" tick={{ fontSize: 10 }} />
                      <YAxis tickFormatter={fmtShort} tick={{ fontSize: 10 }} />
                      <Tooltip
                        formatter={(value: number, name: string) => [
                          `฿${fmt(value)}`,
                          name === "bestCase" ? "Best Case" : name === "expected" ? "Expected" : "Worst Case",
                        ]}
                        labelFormatter={(label) => `Date: ${label}`}
                      />
                      <Legend
                        formatter={(value) =>
                          value === "bestCase" ? "Best Case" : value === "expected" ? "Expected" : "Worst Case"
                        }
                      />
                      {threshold > 0 && (
                        <ReferenceLine
                          y={threshold}
                          stroke="#ef4444"
                          strokeDasharray="5 5"
                          label={{ value: `Threshold: ฿${fmtShort(threshold)}`, position: "right", fontSize: 10, fill: "#ef4444" }}
                        />
                      )}
                      <Area
                        type="monotone"
                        dataKey="bestCase"
                        stroke="#22c55e"
                        fill="#22c55e"
                        fillOpacity={0.1}
                        strokeWidth={1}
                        dot={false}
                      />
                      <Area
                        type="monotone"
                        dataKey="expected"
                        stroke="#3b82f6"
                        fill="#3b82f6"
                        fillOpacity={0.2}
                        strokeWidth={2}
                        dot={false}
                      />
                      <Area
                        type="monotone"
                        dataKey="worstCase"
                        stroke="#ef4444"
                        fill="#ef4444"
                        fillOpacity={0.1}
                        strokeWidth={1}
                        dot={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-5">
                <Card className="border-0 shadow-md" data-testid="card-threshold">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <Target className="h-4 w-4 text-red-500" />
                      Alert Threshold
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Input
                        type="number"
                        value={thresholdInput}
                        onChange={(e) => setThresholdInput(e.target.value)}
                        className="h-8 text-sm"
                        placeholder="Minimum cash balance"
                        data-testid="input-threshold"
                      />
                      <Button
                        size="sm"
                        className="h-8 text-xs"
                        onClick={handleThresholdApply}
                        data-testid="button-apply-threshold"
                      >
                        ตั้งค่า
                      </Button>
                    </div>
                    <div className="text-xs text-muted-foreground mb-2">
                      Threshold: ฿{fmt(threshold)}
                    </div>
                    {data.alerts.length > 0 ? (
                      <div className="space-y-2 max-h-[200px] overflow-y-auto">
                        {data.alerts.slice(0, 10).map((alert, idx) => (
                          <div
                            key={idx}
                            className="flex items-start gap-2 p-2 bg-red-50 rounded-lg border border-red-100"
                            data-testid={`alert-item-${idx}`}
                          >
                            <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                            <div className="text-xs">
                              <div className="font-medium text-red-700">
                                {alert.date} ({alert.scenario === "expected" ? "Expected" : "Worst Case"})
                              </div>
                              <div className="text-red-500">
                                Projected: ฿{fmt(alert.projectedBalance)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-green-600 flex items-center gap-1">
                        <Activity className="h-3.5 w-3.5" />
                        ไม่มีการแจ้งเตือน - สภาพคล่องอยู่ในเกณฑ์ดี
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="lg:col-span-7">
                <Card className="border-0 shadow-md" data-testid="card-wc-bar">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-purple-500" />
                      Current Assets vs Current Liabilities
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    <div className="h-[220px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={barData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                          <YAxis tickFormatter={fmtShort} tick={{ fontSize: 10 }} />
                          <Tooltip formatter={(value: number) => [`฿${fmt(value)}`, ""]} />
                          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                            {barData.map((entry, idx) => (
                              <Cell key={idx} fill={entry.fill} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="border-0 shadow-sm" data-testid="card-wc-ratio">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <ArrowRightLeft className="h-4 w-4 text-purple-500" />
                    <span className="text-xs text-muted-foreground">WC Ratio</span>
                  </div>
                  <div className={`text-lg font-bold ${data.workingCapital.workingCapitalRatio >= 1.5 ? "text-green-600" : data.workingCapital.workingCapitalRatio >= 1 ? "text-amber-500" : "text-red-500"}`} data-testid="text-wc-ratio">
                    {data.workingCapital.workingCapitalRatio.toFixed(2)}x
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {data.workingCapital.workingCapitalRatio >= 1.5 ? "สภาพคล่องดี" : data.workingCapital.workingCapitalRatio >= 1 ? "ควรระวัง" : "สภาพคล่องต่ำ"}
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm" data-testid="card-dso">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="h-4 w-4 text-blue-500" />
                    <span className="text-xs text-muted-foreground">DSO</span>
                  </div>
                  <div className="text-lg font-bold text-blue-600" data-testid="text-dso">
                    {data.workingCapital.dso} วัน
                  </div>
                  <div className="text-[10px] text-muted-foreground">Days Sales Outstanding</div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm" data-testid="card-dpo">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="h-4 w-4 text-[#fb9678]" />
                    <span className="text-xs text-muted-foreground">DPO</span>
                  </div>
                  <div className="text-lg font-bold text-[#fb9678]" data-testid="text-dpo">
                    {data.workingCapital.dpo} วัน
                  </div>
                  <div className="text-[10px] text-muted-foreground">Days Payable Outstanding</div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm" data-testid="card-ccc">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Activity className="h-4 w-4 text-[#03c9d7]" />
                    <span className="text-xs text-muted-foreground">Cash Conversion Cycle</span>
                  </div>
                  <div className={`text-lg font-bold ${data.workingCapital.cashConversionCycle <= 30 ? "text-green-600" : data.workingCapital.cashConversionCycle <= 60 ? "text-amber-500" : "text-red-500"}`} data-testid="text-ccc">
                    {data.workingCapital.cashConversionCycle} วัน
                  </div>
                  <div className="text-[10px] text-muted-foreground">DIO + DSO - DPO = {data.workingCapital.dio} + {data.workingCapital.dso} - {data.workingCapital.dpo}</div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="border-0 shadow-md" data-testid="card-wc-trend">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-[#03c9d7]" />
                    Working Capital Ratio Trend (12 เดือน)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={wcTrendData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="monthLabel" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip
                          formatter={(value: number, name: string) => [
                            name === "ratio" ? `${value.toFixed(2)}x` : `฿${fmt(value)}`,
                            name === "ratio" ? "WC Ratio" : "Net WC",
                          ]}
                        />
                        <Legend formatter={(value) => (value === "ratio" ? "WC Ratio" : "Net WC")} />
                        <ReferenceLine y={1} stroke="#ef4444" strokeDasharray="5 5" label={{ value: "1.0x", position: "left", fontSize: 10, fill: "#ef4444" }} />
                        <Line
                          type="monotone"
                          dataKey="ratio"
                          stroke="#03c9d7"
                          strokeWidth={2}
                          dot={{ fill: "#03c9d7", r: 3 }}
                          activeDot={{ r: 5 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-md" data-testid="card-ccc-trend">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Activity className="h-4 w-4 text-purple-500" />
                    Cash Conversion Cycle Trend (12 เดือน)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={wcTrendData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="monthLabel" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} unit=" วัน" />
                        <Tooltip
                          formatter={(value: number) => [`${value} วัน`, "CCC"]}
                        />
                        <Legend formatter={() => "Cash Conversion Cycle (วัน)"} />
                        <Line
                          type="monotone"
                          dataKey="ccc"
                          stroke="#8b5cf6"
                          strokeWidth={2}
                          dot={{ fill: "#8b5cf6", r: 3 }}
                          activeDot={{ r: 5 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        ) : null}
      </div>
    </Layout>
  );
}
