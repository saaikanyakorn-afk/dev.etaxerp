import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useCompany } from "@/lib/company-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  RadialBarChart, RadialBar,
  ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend,
} from "recharts";
import {
  TrendingUp, TrendingDown, PiggyBank, BarChart3,
  Shield, Activity, Target, Save, Loader2,
  Wallet, Receipt, ArrowUpRight, ArrowDownRight,
  Heart, Droplets, Scale, Rocket,
} from "lucide-react";

const THAI_MONTHS: Record<string, string> = {
  "01": "ม.ค.", "02": "ก.พ.", "03": "มี.ค.", "04": "เม.ย.",
  "05": "พ.ค.", "06": "มิ.ย.", "07": "ก.ค.", "08": "ส.ค.",
  "09": "ก.ย.", "10": "ต.ค.", "11": "พ.ย.", "12": "ธ.ค.",
};

const PERIOD_OPTIONS = [
  { value: "month", label: "เดือนนี้" },
  { value: "quarter", label: "ไตรมาสนี้" },
  { value: "year", label: "ปีนี้" },
  { value: "compare", label: "เปรียบเทียบปีที่แล้ว" },
];

const BUFFER_LABELS: Record<string, { th: string; en: string; icon: any; color: string }> = {
  survival: { th: "เงินสำรองดำเนินธุรกิจ", en: "Survival Buffer", icon: Shield, color: "#f94d4d" },
  development: { th: "เงินพัฒนาธุรกิจ", en: "Development Buffer", icon: Rocket, color: "#539BFF" },
  expansion: { th: "เงินขยายธุรกิจ", en: "Expansion Buffer", icon: TrendingUp, color: "#05b187" },
  protection: { th: "เงินสำรองความเสี่ยง", en: "Protection Buffer", icon: PiggyBank, color: "#fec90f" },
};

const HEALTH_LABELS: Record<string, { th: string; en: string; icon: any; color: string }> = {
  profitability: { th: "ความสามารถทำกำไร", en: "Profitability", icon: Heart, color: "#fb9678" },
  liquidity: { th: "สภาพคล่อง", en: "Liquidity", icon: Droplets, color: "#539BFF" },
  costDiscipline: { th: "วินัยค่าใช้จ่าย", en: "Cost Discipline", icon: Scale, color: "#05b187" },
  growthReadiness: { th: "ความพร้อมเติบโต", en: "Growth Readiness", icon: Rocket, color: "#fec90f" },
};

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string; fill: string }> = {
  good: { bg: "bg-green-50", text: "text-green-700", label: "ดี", fill: "#05b187" },
  caution: { bg: "bg-yellow-50", text: "text-yellow-700", label: "ควรระวัง", fill: "#fec90f" },
  risk: { bg: "bg-red-50", text: "text-red-700", label: "เสี่ยง", fill: "#f94d4d" },
  nodata: { bg: "bg-gray-50", text: "text-gray-400", label: "ข้อมูลยังไม่พอ", fill: "#d1d5db" },
};

function fmt(n: number): string {
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return n.toLocaleString("th-TH", { maximumFractionDigits: 0 });
}

function fmtFull(n: number): string {
  return n.toLocaleString("th-TH", { maximumFractionDigits: 2 });
}

function pct(n: number): string {
  return (n * 100).toFixed(1) + "%";
}

function thaiMonth(m: string): string {
  const parts = m.split("-");
  return THAI_MONTHS[parts[1]] || m;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/95 backdrop-blur-sm shadow-xl rounded-xl p-3 border border-gray-100 text-xs">
      <p className="font-bold text-gray-700 mb-1.5">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2 py-0.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }} />
          <span className="text-gray-500">{p.name}:</span>
          <span className="font-bold" style={{ color: p.color }}>฿{fmtFull(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

function ProgressBar({ value, color, label }: { value: number; color: string; label: string }) {
  const clamped = Math.min(Math.max(value, 0), 100);
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-gray-500">{label}</span>
        <span className="font-bold" style={{ color }}>{clamped.toFixed(0)}%</span>
      </div>
      <div className="h-3.5 bg-gray-100 rounded-full overflow-hidden relative">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out relative overflow-hidden"
          style={{ width: `${clamped}%`, backgroundColor: color }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        </div>
      </div>
    </div>
  );
}

function GaugeChart({ value, maxValue, color, label, displayValue }: { value: number; maxValue: number; color: string; label: string; displayValue?: string }) {
  const pctVal = maxValue > 0 ? Math.min((value / maxValue) * 100, 100) : 0;
  const data = [
    { name: label, value: pctVal, fill: color },
  ];
  return (
    <div className="relative w-full" style={{ height: 130 }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          cx="50%" cy="90%"
          innerRadius="65%"
          outerRadius="95%"
          startAngle={180}
          endAngle={0}
          data={data}
          barSize={18}
        >
          <RadialBar background={{ fill: "#f3f4f6" }} dataKey="value" cornerRadius={8} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-center">
        <div className="text-sm font-bold" style={{ color }}>{displayValue || `${pctVal.toFixed(0)}%`}</div>
      </div>
    </div>
  );
}

export default function FinancialManagementContent() {
  const { selectedCompanyId } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState("month");
  const [editingBuffers, setEditingBuffers] = useState(false);
  const [bufferTargets, setBufferTargets] = useState<Record<string, string>>({
    survival: "0", development: "0", expansion: "0", protection: "0",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["/api/finance/management-dashboard", selectedCompanyId, period],
    queryFn: async () => {
      const r = await fetch(`/api/finance/management-dashboard?companyId=${selectedCompanyId}&period=${period}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to load");
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  useEffect(() => {
    if (data?.financialBuffer) {
      const targets: Record<string, string> = {};
      for (const b of data.financialBuffer) {
        targets[b.type] = String(b.targetAmount || 0);
      }
      setBufferTargets(targets);
    }
  }, [data]);

  const saveBuffers = useMutation({
    mutationFn: async () => {
      const buffers = Object.entries(bufferTargets).map(([bufferType, targetAmount]) => ({
        bufferType,
        targetAmount: Number(targetAmount) || 0,
      }));
      await apiRequest("PUT", "/api/finance/buffers", { companyId: selectedCompanyId, buffers });
    },
    onSuccess: () => {
      toast({ title: "บันทึกสำเร็จ" });
      setEditingBuffers(false);
      queryClient.invalidateQueries({ queryKey: ["/api/finance/management-dashboard"] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const tm = data?.topMetrics || {};
  const fp = data?.financialPosition || {};
  const cfo = data?.cfoMetrics || {};
  const hi = data?.healthIndicators || {};
  const fb = data?.financialBuffer || [];
  const compare = data?.compareData;

  const trendData = (tm.trend || []).map((t: any) => ({
    ...t,
    monthLabel: thaiMonth(t.month),
    profit: (t.revenue || 0) - (t.expense || 0),
  }));

  const positionPieData = [
    { name: "รายได้", value: Math.abs(fp.revenue || 0), color: "#03c9d7" },
    { name: "ค่าใช้จ่าย", value: Math.abs(fp.expenses || 0), color: "#fb9678" },
    { name: "ลูกหนี้", value: Math.abs(fp.accountsReceivable || 0), color: "#539BFF" },
    { name: "เจ้าหนี้", value: Math.abs(fp.accountsPayable || 0), color: "#fec90f" },
  ].filter(d => d.value > 0);

  const healthRadialData = Object.entries(hi).map(([key, indicator]: [string, any]) => {
    const info = HEALTH_LABELS[key];
    const st = STATUS_COLORS[indicator?.status || "nodata"];
    const rawVal = typeof indicator?.value === "number" ? indicator.value : 0;

    let gaugePercent = 0;
    if (key === "profitability") {
      gaugePercent = rawVal <= 0 ? 0 : rawVal >= 0.2 ? 100 : (rawVal / 0.2) * 100;
    } else if (key === "liquidity") {
      gaugePercent = rawVal <= 0 ? 0 : rawVal >= 3 ? 100 : (rawVal / 3) * 100;
    } else if (key === "costDiscipline") {
      gaugePercent = rawVal <= 0 ? 100 : rawVal >= 1 ? 0 : (1 - rawVal) * 100;
    } else if (key === "growthReadiness") {
      gaugePercent = rawVal <= -0.5 ? 0 : rawVal >= 0.3 ? 100 : ((rawVal + 0.5) / 0.8) * 100;
    } else {
      gaugePercent = Math.min(Math.abs(rawVal) * 100, 100);
    }
    gaugePercent = Math.max(0, Math.min(gaugePercent, 100));

    const displayValue = key === "costDiscipline"
      ? `${(rawVal * 100).toFixed(0)}%`
      : key === "profitability"
        ? `${(rawVal * 100).toFixed(1)}%`
        : key === "liquidity"
          ? rawVal > 0 ? `${rawVal.toFixed(2)}x` : "-"
          : `${(rawVal * 100).toFixed(0)}%`;

    return {
      name: info?.en || key,
      th: info?.th || key,
      value: gaugePercent,
      fill: st.fill,
      status: indicator?.status || "nodata",
      statusLabel: st.label,
      icon: info?.icon,
      displayValue,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900" data-testid="text-fm-title">Financial Management</h2>
          <p className="text-sm text-gray-500 mt-0.5">สถานะทางการเงินของธุรกิจ</p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[200px]" data-testid="select-fm-period">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map(p => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            label: "Business Cash Position",
            th: "สถานะเงินของธุรกิจ",
            value: tm.cashPosition || 0,
            key: "cashPosition",
            color: "#05b187",
            icon: Wallet,
          },
          {
            label: "Net Profit",
            th: "กำไรสุทธิ",
            value: tm.netProfit || 0,
            key: "netProfit",
            color: "#fb9678",
            icon: TrendingUp,
          },
          {
            label: "Operating Profit (EBITDA)",
            th: "กำไรจากการดำเนินงาน",
            value: tm.ebitda || 0,
            key: "ebitda",
            color: "#539BFF",
            icon: BarChart3,
          },
        ].map((metric) => (
          <Card key={metric.key} className="overflow-hidden border-0 shadow-md" data-testid={`card-fm-${metric.key}`}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{metric.label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{metric.th}</div>
                </div>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: metric.color + "15" }}>
                  <metric.icon className="w-5 h-5" style={{ color: metric.color }} />
                </div>
              </div>
              <div className="text-2xl font-bold mb-3" style={{ color: metric.value >= 0 ? metric.color : "#f94d4d" }}>
                ฿{fmtFull(metric.value)}
              </div>
              {trendData.length >= 2 && (
                <div className="h-16 -mx-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData}>
                      <defs>
                        <linearGradient id={`grad-${metric.key}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={metric.color} stopOpacity={0.3} />
                          <stop offset="100%" stopColor={metric.color} stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <Area
                        type="monotone"
                        dataKey={metric.key}
                        stroke={metric.color}
                        strokeWidth={2}
                        fill={`url(#grad-${metric.key})`}
                        dot={{ r: 2.5, fill: metric.color, strokeWidth: 0 }}
                        activeDot={{ r: 4, fill: metric.color, strokeWidth: 2, stroke: "#fff" }}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.[0]) return null;
                          return (
                            <div className="bg-white/95 backdrop-blur-sm shadow-lg rounded-lg px-3 py-1.5 text-xs border">
                              <span className="font-bold" style={{ color: metric.color }}>
                                ฿{fmtFull(payload[0].value as number)}
                              </span>
                            </div>
                          );
                        }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 border-0 shadow-md" data-testid="card-fm-revenue-expense-chart">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[#03c9d7]" />
              รายได้ vs ค่าใช้จ่าย
              <span className="text-sm font-normal text-gray-400 ml-1">· แนวโน้ม 6 เดือน</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {trendData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trendData} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={(v) => fmt(v)} width={50} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                    />
                    <Bar dataKey="revenue" name="รายได้" fill="#03c9d7" radius={[6, 6, 0, 0]} maxBarSize={32} />
                    <Bar dataKey="expense" name="ค่าใช้จ่าย" fill="#fb9678" radius={[6, 6, 0, 0]} maxBarSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
                <div className="text-center">
                  <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-20" />
                  <p>ยังไม่มีข้อมูลสำหรับช่วงเวลานี้</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md" data-testid="card-fm-position-pie">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt className="w-5 h-5 text-[#03c9d7]" />
              Financial Position
            </CardTitle>
          </CardHeader>
          <CardContent>
            {positionPieData.length > 0 ? (
              <>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={positionPieData}
                        cx="50%" cy="50%"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                        stroke="none"
                      >
                        {positionPieData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.[0]) return null;
                          const d = payload[0].payload;
                          return (
                            <div className="bg-white/95 backdrop-blur-sm shadow-lg rounded-lg px-3 py-2 text-xs border">
                              <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                                <span className="text-gray-600">{d.name}</span>
                              </div>
                              <div className="font-bold mt-0.5" style={{ color: d.color }}>
                                ฿{fmtFull(d.value)}
                              </div>
                            </div>
                          );
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2 mt-1">
                  {positionPieData.map((d, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ background: d.color }} />
                        <span className="text-gray-600">{d.name}</span>
                      </div>
                      <span className="font-bold" style={{ color: d.color }}>฿{fmt(d.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
                ยังไม่มีข้อมูล
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {trendData.length >= 2 && (
        <Card className="border-0 shadow-md" data-testid="card-fm-profit-trend">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#03c9d7]" />
              กำไรสุทธิรายเดือน
              <span className="text-sm font-normal text-gray-400 ml-1">· Net Profit Trend</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#03c9d7" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#03c9d7" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={(v) => fmt(v)} width={50} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="profit"
                    name="กำไรสุทธิ"
                    stroke="#03c9d7"
                    strokeWidth={2.5}
                    fill="url(#profitGrad)"
                    dot={{ r: 4, fill: "#03c9d7", strokeWidth: 2, stroke: "#fff" }}
                    activeDot={{ r: 6, fill: "#03c9d7", strokeWidth: 2, stroke: "#fff" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {compare && (
        <Card className="border-0 shadow-md" data-testid="card-fm-compare">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowUpRight className="w-5 h-5 text-[#539BFF]" />
              เปรียบเทียบปีที่แล้ว
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-4 rounded-xl bg-green-50/60">
                <div className="text-xs text-gray-500 mb-1">รายได้ปีก่อน</div>
                <div className="text-lg font-bold text-gray-700">฿{fmt(compare.prevRevenue)}</div>
                <div className={`text-xs font-bold flex items-center justify-center gap-0.5 mt-1 ${compare.revenueChange >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {compare.revenueChange >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {pct(compare.revenueChange)}
                </div>
              </div>
              <div className="p-4 rounded-xl bg-orange-50/60">
                <div className="text-xs text-gray-500 mb-1">ค่าใช้จ่ายปีก่อน</div>
                <div className="text-lg font-bold text-gray-700">฿{fmt(compare.prevExpense)}</div>
              </div>
              <div className="p-4 rounded-xl bg-blue-50/60">
                <div className="text-xs text-gray-500 mb-1">กำไรปีก่อน</div>
                <div className="text-lg font-bold text-gray-700">฿{fmt(compare.prevNetProfit)}</div>
                <div className={`text-xs font-bold flex items-center justify-center gap-0.5 mt-1 ${compare.profitChange >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {compare.profitChange >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {pct(compare.profitChange)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-0 shadow-md" data-testid="card-fm-cfo-metrics">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-5 h-5 text-[#fb9678]" />
              CFO Metrics
              <span className="text-sm font-normal text-gray-400 ml-1">· ตัวเลขบริหารธุรกิจ</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              {
                label: "ROA",
                th: "ผลตอบแทนต่อสินทรัพย์",
                formula: "Net Profit ÷ Total Assets",
                value: pct(cfo.roa || 0),
                rawPct: Math.abs((cfo.roa || 0) * 100),
                color: "#fb9678",
              },
              {
                label: "OPEX Ratio",
                th: "สัดส่วนค่าใช้จ่ายดำเนินงาน",
                formula: "OPEX ÷ Revenue",
                value: pct(cfo.opexRatio || 0),
                rawPct: Math.abs((cfo.opexRatio || 0) * 100),
                color: "#539BFF",
              },
              {
                label: "CAPEX",
                th: "เงินลงทุนในสินทรัพย์",
                formula: "เครื่องจักร · ระบบ IT · อุปกรณ์",
                value: `฿${fmt(cfo.capex || 0)}`,
                rawPct: null,
                color: "#05b187",
              },
              {
                label: "Break Even Revenue",
                th: "จุดคุ้มทุน — ยอดขายที่ทำให้ไม่ขาดทุน",
                formula: "Fixed Cost ÷ Contribution Margin",
                value: `฿${fmt(cfo.breakEvenRevenue || 0)}`,
                rawPct: null,
                color: "#fec90f",
              },
            ].map((m) => (
              <div key={m.label} className="flex items-center justify-between p-3.5 rounded-xl bg-gray-50/80 hover:bg-gray-100/80 transition-colors" data-testid={`fm-cfo-${m.label.toLowerCase().replace(/\s/g, "-")}`}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: m.color + "15" }}>
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: m.color }} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-800">{m.label}</div>
                    <div className="text-[11px] text-gray-500">{m.th}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5 font-mono">{m.formula}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold" style={{ color: m.color }}>{m.value}</div>
                  {m.rawPct !== null && (
                    <div className="w-20 h-1.5 bg-gray-200 rounded-full mt-1.5 overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(m.rawPct, 100)}%`, backgroundColor: m.color }} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md" data-testid="card-fm-health-indicators">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="w-5 h-5 text-[#05b187]" />
              Business Health Indicators
              <span className="text-sm font-normal text-gray-400 ml-1">· สุขภาพธุรกิจ</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {healthRadialData.map((item) => {
                const IconComp = item.icon;
                return (
                  <div key={item.name} className="text-center p-3 rounded-xl bg-gray-50/60" data-testid={`fm-health-${item.name.toLowerCase().replace(/\s/g, "-")}`}>
                    <GaugeChart
                      value={item.value}
                      maxValue={100}
                      color={item.fill}
                      label={item.name}
                      displayValue={item.displayValue}
                    />
                    <div className="mt-1">
                      <div className="text-xs font-semibold text-gray-700">{item.name}</div>
                      <div className="text-[11px] text-gray-500">{item.th}</div>
                      <div className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: item.fill + "18", color: item.fill }}>
                        {item.statusLabel}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-md" data-testid="card-fm-financial-buffer">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <PiggyBank className="w-5 h-5 text-[#fec90f]" />
              Financial Buffer
              <span className="text-sm font-normal text-gray-400 ml-1">· เงินสำรองธุรกิจ</span>
            </CardTitle>
            {editingBuffers ? (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditingBuffers(false)} data-testid="btn-fm-cancel-buffer">ยกเลิก</Button>
                <Button size="sm" onClick={() => saveBuffers.mutate()} disabled={saveBuffers.isPending} className="bg-[#fb9678] hover:bg-[#e8876a]" data-testid="btn-fm-save-buffer">
                  {saveBuffers.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
                  บันทึก
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setEditingBuffers(true)} data-testid="btn-fm-edit-buffer">
                ตั้งเป้าหมาย
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {(["survival", "development", "expansion", "protection"] as const).map((type) => {
              const info = BUFFER_LABELS[type];
              const bufferItem = fb.find((b: any) => b.type === type);
              const target = Number(bufferTargets[type]) || 0;
              const current = bufferItem?.currentAmount || 0;
              const percentage = bufferItem?.percentage || 0;

              return (
                <div key={type} className="p-4 rounded-xl border border-gray-100 bg-white hover:shadow-sm transition-shadow" data-testid={`fm-buffer-${type}`}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: info.color + "15" }}>
                      <info.icon className="w-5 h-5" style={{ color: info.color }} />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-gray-800">{info.en}</div>
                      <div className="text-xs text-gray-500">{info.th}</div>
                    </div>
                  </div>

                  {editingBuffers ? (
                    <div className="space-y-2">
                      <label className="text-xs text-gray-500">เป้าหมาย (บาท)</label>
                      <Input
                        type="number"
                        value={bufferTargets[type]}
                        onChange={(e) => setBufferTargets(prev => ({ ...prev, [type]: e.target.value }))}
                        className="text-sm"
                        data-testid={`input-fm-buffer-${type}`}
                      />
                    </div>
                  ) : (
                    <>
                      {target > 0 ? (
                        <>
                          <ProgressBar value={percentage} color={info.color} label={`฿${fmtFull(current)} / ฿${fmtFull(target)}`} />
                        </>
                      ) : (
                        <div className="text-xs text-gray-400 text-center py-4 rounded-lg bg-gray-50">ยังไม่ได้ตั้งเป้าหมาย</div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
