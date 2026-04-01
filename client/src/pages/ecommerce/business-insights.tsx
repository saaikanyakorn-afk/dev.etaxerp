import { useState, useMemo, useRef } from "react";
import EcommerceLayout from "@/components/ecommerce-layout";
import { useCompany } from "@/lib/company-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Upload, TrendingUp, TrendingDown, ShoppingCart, Eye, MousePointerClick,
  DollarSign, BarChart3, Loader2, ArrowUpRight, ArrowDownRight, Percent,
  XCircle, RotateCcw, Trash2, FileSpreadsheet, CalendarDays, ChevronLeft, ChevronRight,
  Zap, RefreshCw,
} from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";

const PLATFORM_COLORS: Record<string, { hex: string; label: string; bg: string }> = {
  shopee: { hex: "#EE4D2D", label: "Shopee", bg: "bg-orange-50" },
  lazada: { hex: "#0F146D", label: "Lazada", bg: "bg-indigo-50" },
  tiktok: { hex: "#000000", label: "TikTok Shop", bg: "bg-gray-50" },
  amazon: { hex: "#FF9900", label: "Amazon", bg: "bg-amber-50" },
  grab: { hex: "#00B14F", label: "Grab", bg: "bg-green-50" },
  lineman: { hex: "#2FC866", label: "LINE MAN", bg: "bg-emerald-50" },
};

function fmt(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtInt(n: number) {
  return n.toLocaleString("th-TH");
}

function fmtPct(n: number) {
  return n.toFixed(2) + "%";
}

function getMonthLabel(period: string) {
  const [, m] = period.split("-");
  const months = ["", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  return months[parseInt(m)] || m;
}

function prepareChartData(monthly: any[]) {
  const periodMap: Record<string, any> = {};
  const platforms = [...new Set(monthly.map((d: any) => d.platform))];
  for (const row of monthly) {
    if (!periodMap[row.period]) {
      periodMap[row.period] = { period: row.period, label: getMonthLabel(row.period) };
    }
    const p = row.platform;
    periodMap[row.period][`sales_${p}`] = row.totalSales;
    periodMap[row.period][`orders_${p}`] = row.totalOrders;
    periodMap[row.period][`visitors_${p}`] = row.totalVisitors;
    periodMap[row.period][`conversion_${p}`] = row.conversionRate;
    periodMap[row.period][`clicks_${p}`] = row.totalClicks;
    periodMap[row.period][`cancelled_${p}`] = row.cancelledOrders;
  }
  return { chartData: Object.values(periodMap).sort((a: any, b: any) => a.period.localeCompare(b.period)), platforms };
}

const CHART_TOOLTIP_STYLE = { contentStyle: { borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 } };

function CustomTooltipContent({ active, payload, label, prefix = "", suffix = "" }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-lg shadow-lg border p-3 text-xs">
      <p className="font-medium text-gray-700 mb-1">{label}</p>
      {payload.map((entry: any, i: number) => {
        const platform = entry.dataKey.split("_").slice(1).join("_");
        const info = PLATFORM_COLORS[platform];
        return (
          <div key={i} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-gray-500">{info?.label || platform}:</span>
            <span className="font-medium">{prefix}{typeof entry.value === "number" ? entry.value.toLocaleString("th-TH", { maximumFractionDigits: 2 }) : entry.value}{suffix}</span>
          </div>
        );
      })}
    </div>
  );
}

type PeriodPreset = "realtime" | "yesterday" | "7d" | "30d" | "custom_date" | "custom_week" | "custom_month" | "custom_year";

const PRESET_LABELS: Record<string, string> = {
  realtime: "Real-time",
  yesterday: "เมื่อวาน",
  "7d": "ย้อนหลัง 7 วัน",
  "30d": "ย้อนหลัง 30 วัน",
  custom_date: "ภายในวันที่",
  custom_week: "ภายในอาทิตย์",
  custom_month: "ภายในเดือน",
  custom_year: "ภายในปี",
};

const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

function formatDateRange(preset: PeriodPreset, year: number, month: number, date: string, weekStart: string) {
  const yBe = year + 543;
  switch (preset) {
    case "realtime": return "Real-time";
    case "yesterday": return "เมื่อวาน";
    case "7d": return "ย้อนหลัง 7 วัน";
    case "30d": return "ย้อนหลัง 30 วัน";
    case "custom_year": return `ภายในปี ${yBe}`;
    case "custom_month": return `${THAI_MONTHS[month]} ${yBe}`;
    case "custom_date": return date ? `${date.split("-").reverse().join("/")}` : "เลือกวันที่";
    case "custom_week": return weekStart ? `สัปดาห์ ${weekStart.split("-").reverse().join("/")}` : "เลือกสัปดาห์";
    default: return "";
  }
}

function PeriodPicker({ preset, onPresetChange, year, onYearChange, month, onMonthChange, customDate, onCustomDateChange }: {
  preset: PeriodPreset; onPresetChange: (p: PeriodPreset) => void;
  year: number; onYearChange: (y: number) => void;
  month: number; onMonthChange: (m: number) => void;
  customDate: string; onCustomDateChange: (d: string) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [subView, setSubView] = useState<"presets" | "year" | "month" | "date">("presets");
  const [decadeStart, setDecadeStart] = useState(Math.floor(new Date().getFullYear() / 10) * 10);

  const handlePreset = (p: PeriodPreset) => {
    if (p === "custom_year") {
      setSubView("year");
    } else if (p === "custom_month") {
      setSubView("month");
    } else if (p === "custom_date" || p === "custom_week") {
      setSubView("date");
      onPresetChange(p);
    } else {
      onPresetChange(p);
      setPickerOpen(false);
      setSubView("presets");
    }
  };

  const selectYear = (y: number) => {
    onYearChange(y);
    if (preset === "custom_month" || subView === "month") {
      setSubView("month");
    } else {
      onPresetChange("custom_year");
      setPickerOpen(false);
      setSubView("presets");
    }
  };

  const selectMonth = (m: number) => {
    onMonthChange(m);
    onPresetChange("custom_month");
    setPickerOpen(false);
    setSubView("presets");
  };

  const displayLabel = formatDateRange(preset, year, month, customDate, "");

  return (
    <Popover open={pickerOpen} onOpenChange={(open) => { setPickerOpen(open); if (!open) setSubView("presets"); }}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="min-w-[200px] justify-start gap-2" data-testid="btn-period-picker">
          <CalendarDays className="w-4 h-4 text-gray-500" />
          <span className="text-sm">{displayLabel}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <div className="flex">
          {/* Left: Presets */}
          <div className="w-[150px] border-r p-2 space-y-0.5">
            {(["realtime", "yesterday", "7d", "30d"] as PeriodPreset[]).map(p => (
              <button
                key={p}
                className={`w-full text-left px-3 py-1.5 rounded text-sm hover:bg-gray-100 ${preset === p ? "bg-orange-50 text-[#fb9678] font-medium" : "text-gray-700"}`}
                onClick={() => handlePreset(p)}
              >
                {p === "realtime" && <Zap className="w-3 h-3 inline mr-1" />}
                {PRESET_LABELS[p]}
              </button>
            ))}
            <div className="border-t my-2" />
            {(["custom_date", "custom_week", "custom_month", "custom_year"] as PeriodPreset[]).map(p => (
              <button
                key={p}
                className={`w-full text-left px-3 py-1.5 rounded text-sm hover:bg-gray-100 flex items-center justify-between ${preset === p || (p === "custom_year" && subView === "year") || (p === "custom_month" && subView === "month") ? "text-[#fb9678] font-medium" : "text-gray-700"}`}
                onClick={() => handlePreset(p)}
              >
                {PRESET_LABELS[p]}
                <ChevronRight className="w-3 h-3" />
              </button>
            ))}
          </div>

          {/* Right: Detail panel */}
          <div className="flex-1 p-3">
            {subView === "presets" && (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                เลือกประเภทช่วงเวลา
              </div>
            )}

            {subView === "year" && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <button onClick={() => setDecadeStart(d => d - 10)} className="p-1 hover:bg-gray-100 rounded">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm font-medium">{decadeStart} – {decadeStart + 9}</span>
                  <button onClick={() => setDecadeStart(d => d + 10)} className="p-1 hover:bg-gray-100 rounded">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {Array.from({ length: 10 }, (_, i) => decadeStart + i).map(y => (
                    <button
                      key={y}
                      className={`py-2 rounded text-sm hover:bg-gray-100 ${y === year ? "bg-[#fb9678] text-white hover:bg-[#fb9678]" : "text-gray-700"} ${y > new Date().getFullYear() ? "text-gray-300" : ""}`}
                      onClick={() => y <= new Date().getFullYear() && selectYear(y)}
                      disabled={y > new Date().getFullYear()}
                    >
                      {y}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {subView === "month" && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <button onClick={() => { onYearChange(year - 1); }} className="p-1 hover:bg-gray-100 rounded">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button onClick={() => setSubView("year")} className="text-sm font-medium hover:text-[#fb9678]">
                    {year + 543}
                  </button>
                  <button onClick={() => { onYearChange(year + 1); }} className="p-1 hover:bg-gray-100 rounded" disabled={year >= new Date().getFullYear()}>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {THAI_MONTHS.map((m, i) => {
                    const now = new Date();
                    const isFuture = year > now.getFullYear() || (year === now.getFullYear() && i > now.getMonth());
                    return (
                      <button
                        key={i}
                        className={`py-2 rounded text-sm hover:bg-gray-100 ${i === month && preset === "custom_month" ? "bg-[#fb9678] text-white hover:bg-[#fb9678]" : "text-gray-700"} ${isFuture ? "text-gray-300" : ""}`}
                        onClick={() => !isFuture && selectMonth(i)}
                        disabled={isFuture}
                      >
                        {m}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {subView === "date" && (
              <div className="space-y-3">
                <p className="text-sm text-gray-500">เลือกวันที่</p>
                <Input
                  type="date"
                  value={customDate}
                  max={new Date().toISOString().split("T")[0]}
                  onChange={(e) => {
                    onCustomDateChange(e.target.value);
                    onPresetChange("custom_date");
                    setPickerOpen(false);
                    setSubView("presets");
                  }}
                  data-testid="input-custom-date"
                />
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function BusinessInsights() {
  const { selectedCompanyId } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("custom_year");
  const [periodYear, setPeriodYear] = useState(new Date().getFullYear());
  const [periodMonth, setPeriodMonth] = useState(new Date().getMonth());
  const [customDate, setCustomDate] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [syncOpen, setSyncOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importPlatform, setImportPlatform] = useState("shopee");
  const [importStoreName, setImportStoreName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [syncPlatform, setSyncPlatform] = useState("");

  const { data: connectionsData } = useQuery<any>({
    queryKey: ["/api/business-insights/connections", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/business-insights/connections?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return { connections: [], supportedPlatforms: [] };
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const syncMutation = useMutation({
    mutationFn: async (body: any) => {
      const r = await fetch("/api/business-insights/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), credentials: "include" });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message);
      return data;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/business-insights/stats"] });
      toast({ title: "ซิงค์สำเร็จ", description: `อัปเดต ${result.periodsSynced} ช่วงเวลา` });
      setSyncOpen(false);
    },
    onError: (err: any) => {
      toast({ title: "ยังไม่สามารถซิงค์ได้", description: err.message, variant: "destructive" });
    },
  });

  const queryParams = useMemo(() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    let dateFrom = "", dateTo = "";

    switch (periodPreset) {
      case "realtime":
      case "yesterday": {
        const d = periodPreset === "yesterday" ? new Date(now.getTime() - 86400000) : now;
        dateFrom = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
        dateTo = dateFrom;
        break;
      }
      case "7d": {
        const from = new Date(now.getTime() - 7 * 86400000);
        dateFrom = `${from.getFullYear()}-${pad(from.getMonth() + 1)}`;
        dateTo = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
        break;
      }
      case "30d": {
        const from = new Date(now.getTime() - 30 * 86400000);
        dateFrom = `${from.getFullYear()}-${pad(from.getMonth() + 1)}`;
        dateTo = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
        break;
      }
      case "custom_year":
        dateFrom = `${periodYear}-01`;
        dateTo = `${periodYear}-12`;
        break;
      case "custom_month":
        dateFrom = `${periodYear}-${pad(periodMonth + 1)}`;
        dateTo = dateFrom;
        break;
      case "custom_date": {
        if (customDate) {
          const [y, m] = customDate.split("-");
          dateFrom = `${y}-${m}`;
          dateTo = dateFrom;
        }
        break;
      }
      case "custom_week": {
        if (customDate) {
          const d = new Date(customDate);
          const start = new Date(d.getTime() - d.getDay() * 86400000);
          const end = new Date(start.getTime() + 6 * 86400000);
          dateFrom = `${start.getFullYear()}-${pad(start.getMonth() + 1)}`;
          dateTo = `${end.getFullYear()}-${pad(end.getMonth() + 1)}`;
        }
        break;
      }
    }
    return { dateFrom, dateTo };
  }, [periodPreset, periodYear, periodMonth, customDate]);

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/business-insights/stats", selectedCompanyId, platformFilter, queryParams.dateFrom, queryParams.dateTo],
    queryFn: async () => {
      const r = await fetch(`/api/business-insights/stats?companyId=${selectedCompanyId}&platform=${platformFilter}&dateFrom=${queryParams.dateFrom}&dateTo=${queryParams.dateTo}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    enabled: !!selectedCompanyId && !!queryParams.dateFrom,
  });

  const importMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const r = await fetch("/api/business-insights/import", { method: "POST", body: formData, credentials: "include" });
      if (!r.ok) { const err = await r.json(); throw new Error(err.message); }
      return r.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/business-insights/stats"] });
      toast({ title: "นำเข้าสำเร็จ", description: `เพิ่ม ${result.inserted} เดือน, อัปเดต ${result.updated} เดือน` });
      setImportOpen(false);
      setSelectedFile(null);
      setImportStoreName("");
    },
    onError: (err: any) => {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    },
  });

  const handleImport = () => {
    if (!selectedFile) return;
    const fd = new FormData();
    fd.append("file", selectedFile);
    fd.append("companyId", String(selectedCompanyId));
    fd.append("platform", importPlatform);
    fd.append("storeName", importStoreName);
    importMutation.mutate(fd);
  };

  const summary = data?.summary || {};
  const byPlatform: any[] = data?.byPlatform || [];
  const monthly: any[] = data?.monthly || [];
  const availablePlatforms: string[] = data?.platforms || [];

  const colorMap: Record<string, string> = {};
  for (const p of byPlatform) {
    colorMap[p.platform] = PLATFORM_COLORS[p.platform]?.hex || "#999";
  }

  const bestPlatform = byPlatform.length > 0
    ? byPlatform.reduce((a, b) => a.totalSales > b.totalSales ? a : b)
    : null;

  const bestConversion = byPlatform.length > 0
    ? byPlatform.reduce((a, b) => a.avgConversion > b.avgConversion ? a : b)
    : null;

  return (
    <EcommerceLayout title="Business Insights" subtitle="วิเคราะห์สถิติร้านค้าแบบเทียบแพลตฟอร์ม">
      <div className="space-y-6">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          <PeriodPicker
            preset={periodPreset}
            onPresetChange={setPeriodPreset}
            year={periodYear}
            onYearChange={setPeriodYear}
            month={periodMonth}
            onMonthChange={setPeriodMonth}
            customDate={customDate}
            onCustomDateChange={setCustomDate}
          />

          <Select value={platformFilter} onValueChange={setPlatformFilter}>
            <SelectTrigger className="w-[160px]" data-testid="select-platform">
              <SelectValue placeholder="แพลตฟอร์ม" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกแพลตฟอร์ม</SelectItem>
              {availablePlatforms.map(p => (
                <SelectItem key={p} value={p}>{PLATFORM_COLORS[p]?.label || p}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {periodPreset === "realtime" && (
            <Badge className="bg-green-100 text-green-700 animate-pulse">
              <Zap className="w-3 h-3 mr-1" />
              API Live
            </Badge>
          )}

          <div className="ml-auto flex gap-2">
            <Button variant="outline" onClick={() => setSyncOpen(true)} data-testid="btn-sync" className="gap-2">
              <RefreshCw className="w-4 h-4" />
              ซิงค์จาก API
            </Button>
            <Button variant="outline" onClick={() => setImportOpen(true)} data-testid="btn-import">
              <Upload className="w-4 h-4 mr-2" />
              นำเข้าจาก Excel
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : monthly.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <FileSpreadsheet className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg mb-2">ยังไม่มีข้อมูลสถิติร้านค้า</p>
              <p className="text-gray-400 text-sm mb-6">เริ่มต้นโดยนำเข้าไฟล์ Shop Stats จากแพลตฟอร์มที่ต้องการ</p>
              <Button onClick={() => setImportOpen(true)} data-testid="btn-import-empty">
                <Upload className="w-4 h-4 mr-2" />
                นำเข้าจาก Excel
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                      <DollarSign className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">ยอดขายรวม</p>
                      <p className="text-lg font-bold text-gray-800" data-testid="text-total-sales">฿{fmt(summary.totalSales || 0)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                      <ShoppingCart className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">ออเดอร์ทั้งหมด</p>
                      <p className="text-lg font-bold text-gray-800" data-testid="text-total-orders">{fmtInt(summary.totalOrders || 0)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
                      <Eye className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">ผู้เยี่ยมชมรวม</p>
                      <p className="text-lg font-bold text-gray-800" data-testid="text-total-visitors">{fmtInt(summary.totalVisitors || 0)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-cyan-50 flex items-center justify-center">
                      <Percent className="w-5 h-5 text-cyan-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Conversion Rate เฉลี่ย</p>
                      <p className="text-lg font-bold text-gray-800" data-testid="text-avg-conversion">{fmtPct(summary.avgConversion || 0)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Platform Comparison Cards */}
            {byPlatform.length > 1 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {byPlatform.map((p) => {
                  const info = PLATFORM_COLORS[p.platform] || { hex: "#999", label: p.platform, bg: "bg-gray-50" };
                  const isBest = bestPlatform?.platform === p.platform;
                  const isBestConv = bestConversion?.platform === p.platform;
                  return (
                    <Card key={p.platform} className="relative overflow-hidden" data-testid={`card-platform-${p.platform}`}>
                      <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: info.hex }} />
                      <CardHeader className="pb-2">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-base" style={{ color: info.hex }}>{info.label}</CardTitle>
                          {isBest && <Badge className="bg-yellow-100 text-yellow-700 text-[10px]">ยอดขายสูงสุด</Badge>}
                          {isBestConv && <Badge className="bg-green-100 text-green-700 text-[10px]">Conversion ดีสุด</Badge>}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                          <div>
                            <span className="text-gray-500">ยอดขาย</span>
                            <p className="font-semibold">฿{fmt(p.totalSales)}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">ออเดอร์</span>
                            <p className="font-semibold">{fmtInt(p.totalOrders)}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">ผู้เยี่ยมชม</span>
                            <p className="font-semibold">{fmtInt(p.totalVisitors)}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Conversion</span>
                            <p className="font-semibold">{fmtPct(p.avgConversion)}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">ยกเลิก</span>
                            <p className="font-semibold text-red-500">{fmtInt(p.cancelledOrders)}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">คืนสินค้า</span>
                            <p className="font-semibold text-orange-500">{fmtInt(p.returnedOrders)}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Charts Row — 4 styles */}
            {(() => {
              const { chartData, platforms } = prepareChartData(monthly);
              if (!chartData.length) return null;
              const single = platforms.length === 1;
              const CHART_ACCENTS = { sales: "#fb9678", orders: "#03c9d7", visitors: "#539BFF", conversion: "#05b187" };
              const getColor = (p: string, accent: string) => single ? accent : (PLATFORM_COLORS[p]?.hex || "#999");
              return (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* 1) ยอดขาย — Bar Chart */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2" style={{ color: CHART_ACCENTS.sales }}>
                        <DollarSign className="w-4 h-4" />
                        ยอดขายรายเดือน
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={chartData} barGap={2}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
                          <Tooltip content={<CustomTooltipContent prefix="฿" />} />
                          {platforms.map(p => (
                            <Bar key={p} dataKey={`sales_${p}`} fill={getColor(p, CHART_ACCENTS.sales)} radius={[4, 4, 0, 0]} maxBarSize={32} name={PLATFORM_COLORS[p]?.label || p} />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  {/* 2) ออเดอร์ — Line Chart */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2" style={{ color: CHART_ACCENTS.orders }}>
                        <ShoppingCart className="w-4 h-4" />
                        จำนวนออเดอร์รายเดือน
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                          <Tooltip content={<CustomTooltipContent />} />
                          {platforms.map(p => {
                            const c = getColor(p, CHART_ACCENTS.orders);
                            return <Line key={p} type="monotone" dataKey={`orders_${p}`} stroke={c} strokeWidth={2.5} dot={{ r: 4, fill: c, strokeWidth: 2, stroke: "#fff" }} activeDot={{ r: 6 }} name={PLATFORM_COLORS[p]?.label || p} />;
                          })}
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  {/* 3) ผู้เยี่ยมชม — Area Chart */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2" style={{ color: CHART_ACCENTS.visitors }}>
                        <Eye className="w-4 h-4" />
                        ผู้เยี่ยมชมรายเดือน
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={200}>
                        <AreaChart data={chartData}>
                          <defs>
                            {platforms.map(p => {
                              const c = getColor(p, CHART_ACCENTS.visitors);
                              return (
                                <linearGradient key={p} id={`grad_vis_${p}`} x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor={c} stopOpacity={0.3} />
                                  <stop offset="95%" stopColor={c} stopOpacity={0.02} />
                                </linearGradient>
                              );
                            })}
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
                          <Tooltip content={<CustomTooltipContent />} />
                          {platforms.map(p => (
                            <Area key={p} type="monotone" dataKey={`visitors_${p}`} stroke={getColor(p, CHART_ACCENTS.visitors)} strokeWidth={2} fill={`url(#grad_vis_${p})`} name={PLATFORM_COLORS[p]?.label || p} />
                          ))}
                        </AreaChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  {/* 4) Conversion Rate — Line + Dots */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2" style={{ color: CHART_ACCENTS.conversion }}>
                        <Percent className="w-4 h-4" />
                        Conversion Rate รายเดือน
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v}%`} domain={[0, "auto"]} />
                          <Tooltip content={<CustomTooltipContent suffix="%" />} />
                          {platforms.map(p => {
                            const c = getColor(p, CHART_ACCENTS.conversion);
                            return <Line key={p} type="monotone" dataKey={`conversion_${p}`} stroke={c} strokeWidth={2} strokeDasharray="6 3" dot={{ r: 5, fill: "#fff", strokeWidth: 2.5, stroke: c }} activeDot={{ r: 7, fill: c }} name={PLATFORM_COLORS[p]?.label || p} />;
                          })}
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  {/* Platform Legend */}
                  {platforms.length > 1 && (
                    <div className="lg:col-span-2 flex justify-center gap-6">
                      {platforms.map(p => (
                        <div key={p} className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: PLATFORM_COLORS[p]?.hex || "#999" }} />
                          <span className="text-xs text-gray-500">{PLATFORM_COLORS[p]?.label || p}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Detail Table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  ข้อมูลรายเดือน
                </CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>เดือน</TableHead>
                      {byPlatform.length > 1 && <TableHead>แพลตฟอร์ม</TableHead>}
                      <TableHead className="text-right">ยอดขาย</TableHead>
                      <TableHead className="text-right">ออเดอร์</TableHead>
                      <TableHead className="text-right">เฉลี่ย/ออเดอร์</TableHead>
                      <TableHead className="text-right">คลิก</TableHead>
                      <TableHead className="text-right">ผู้เยี่ยมชม</TableHead>
                      <TableHead className="text-right">Conversion</TableHead>
                      <TableHead className="text-right">ยกเลิก</TableHead>
                      <TableHead className="text-right">คืนสินค้า</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthly.map((row: any, idx: number) => {
                      const info = PLATFORM_COLORS[row.platform];
                      return (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{getMonthLabel(row.period)} {parseInt(row.period) + 543}</TableCell>
                          {byPlatform.length > 1 && (
                            <TableCell>
                              <Badge className="text-[10px]" style={{ backgroundColor: info?.hex || "#999", color: "#fff" }}>
                                {info?.label || row.platform}
                              </Badge>
                            </TableCell>
                          )}
                          <TableCell className="text-right">฿{fmt(row.totalSales)}</TableCell>
                          <TableCell className="text-right">{fmtInt(row.totalOrders)}</TableCell>
                          <TableCell className="text-right">฿{fmt(row.avgOrderValue)}</TableCell>
                          <TableCell className="text-right">{fmtInt(row.totalClicks)}</TableCell>
                          <TableCell className="text-right">{fmtInt(row.totalVisitors)}</TableCell>
                          <TableCell className="text-right font-medium">{fmtPct(row.conversionRate)}</TableCell>
                          <TableCell className="text-right text-red-500">{fmtInt(row.cancelledOrders)}</TableCell>
                          <TableCell className="text-right text-orange-500">{fmtInt(row.returnedOrders)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Sync from API Dialog */}
      <Dialog open={syncOpen} onOpenChange={setSyncOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5" />
              ซิงค์ข้อมูลจาก API แพลตฟอร์ม
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {connectionsData?.connections?.length > 0 ? (
              <>
                <div>
                  <Label>เลือกร้านค้าที่เชื่อมต่อ</Label>
                  <Select value={syncPlatform} onValueChange={setSyncPlatform}>
                    <SelectTrigger data-testid="select-sync-connection">
                      <SelectValue placeholder="เลือกร้านค้า" />
                    </SelectTrigger>
                    <SelectContent>
                      {connectionsData.connections.map((c: any) => (
                        <SelectItem key={c.id} value={`${c.platform}:${c.id}`}>
                          {PLATFORM_COLORS[c.platform]?.label || c.platform} — {c.shopName || c.shopId}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="text-sm text-blue-700 font-medium">รองรับแพลตฟอร์ม</p>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {["shopee", "lazada", "tiktok"].map(p => (
                      <Badge key={p} className="text-[10px]" style={{ backgroundColor: PLATFORM_COLORS[p]?.hex, color: "#fff" }}>
                        {PLATFORM_COLORS[p]?.label}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-blue-500 mt-2">ดึงข้อมูลสถิติร้านค้าอัตโนมัติ (ผู้เยี่ยมชม, ออเดอร์, ยอดขาย, Conversion)</p>
                </div>
              </>
            ) : (
              <div className="text-center py-4">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                  <Zap className="w-6 h-6 text-gray-400" />
                </div>
                <p className="text-gray-500 font-medium">ยังไม่มีร้านค้าที่เชื่อมต่อ API</p>
                <p className="text-gray-400 text-sm mt-1">เชื่อมต่อร้านค้าที่เมนู "ช่องทาง & เชื่อมต่อ" ก่อน</p>
                <p className="text-gray-400 text-sm">หรือใช้ "นำเข้าจาก Excel" แทน</p>
                <div className="mt-4 bg-amber-50 rounded-lg p-3 text-left">
                  <p className="text-xs text-amber-700 font-medium">สถานะ API แพลตฟอร์ม:</p>
                  <div className="mt-1 space-y-1">
                    {["shopee", "lazada", "tiktok"].map(p => (
                      <div key={p} className="flex items-center gap-2 text-xs">
                        <div className="w-2 h-2 rounded-full bg-amber-400" />
                        <span className="text-gray-600">{PLATFORM_COLORS[p]?.label} — เตรียมพร้อม (รอเชื่อมต่อ)</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">ปิด</Button>
            </DialogClose>
            {connectionsData?.connections?.length > 0 && (
              <Button
                onClick={() => {
                  const [platform, connId] = syncPlatform.split(":");
                  syncMutation.mutate({ companyId: selectedCompanyId, platform, connectionId: Number(connId) });
                }}
                disabled={!syncPlatform || syncMutation.isPending}
                data-testid="btn-confirm-sync"
              >
                {syncMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                เริ่มซิงค์
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>นำเข้าสถิติร้านค้าจาก Excel</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>แพลตฟอร์ม *</Label>
              <Select value={importPlatform} onValueChange={setImportPlatform}>
                <SelectTrigger data-testid="select-import-platform">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="shopee">Shopee</SelectItem>
                  <SelectItem value="lazada">Lazada</SelectItem>
                  <SelectItem value="tiktok">TikTok Shop</SelectItem>
                  <SelectItem value="amazon">Amazon</SelectItem>
                  <SelectItem value="grab">Grab</SelectItem>
                  <SelectItem value="lineman">LINE MAN</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>ชื่อร้าน (ไม่บังคับ)</Label>
              <Input
                value={importStoreName}
                onChange={(e) => setImportStoreName(e.target.value)}
                placeholder="เช่น ร้านหลัก, ร้านสาขา 2"
                data-testid="input-store-name"
              />
            </div>
            <div>
              <Label>ไฟล์ Excel (Shop Stats) *</Label>
              <div className="mt-1">
                <Input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  data-testid="input-file"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">
                รองรับไฟล์ Shop Stats จาก Shopee, Lazada, TikTok Shop
              </p>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">ยกเลิก</Button>
            </DialogClose>
            <Button
              onClick={handleImport}
              disabled={!selectedFile || importMutation.isPending}
              data-testid="btn-confirm-import"
            >
              {importMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              นำเข้า
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </EcommerceLayout>
  );
}
