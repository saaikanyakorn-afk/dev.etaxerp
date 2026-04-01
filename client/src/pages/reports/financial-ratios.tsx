import { useState } from "react";
import ReportLayout from "@/components/report-layout";
import { useCompany } from "@/lib/company-context";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Activity, TrendingUp, DollarSign, BarChart3, RefreshCw,
  AlertTriangle, CheckCircle2, Info, ShieldAlert, Lightbulb, FileDown,
  Loader2, Sparkles, Droplets, Scale, Target, Zap,
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend,
} from "recharts";
import ThaiDateInput from "@/components/thai-date-input";
import { toLocalDateStr } from "@/lib/utils";
import { useDateSettings } from "@/hooks/use-date-settings";
import { apiRequest } from "@/lib/queryClient";

interface RatioCardProps {
  label: string;
  labelEn: string;
  value: number | null;
  unit?: string;
  benchMin?: number;
  benchMax?: number;
  benchIdeal?: number;
  inverse?: boolean;
  testId: string;
}

function RatioCard({ label, labelEn, value, unit = "", benchMin, benchMax, benchIdeal, inverse, testId }: RatioCardProps) {
  let statusColor = "text-gray-400";
  let statusIcon = <Info className="h-4 w-4" />;
  let statusBg = "bg-gray-50";

  if (value !== null && benchMin !== undefined && benchMax !== undefined) {
    if (inverse) {
      if (value <= (benchIdeal ?? benchMin)) { statusColor = "text-green-600"; statusIcon = <CheckCircle2 className="h-4 w-4" />; statusBg = "bg-green-50"; }
      else if (value <= benchMax) { statusColor = "text-amber-500"; statusIcon = <AlertTriangle className="h-4 w-4" />; statusBg = "bg-amber-50"; }
      else { statusColor = "text-red-500"; statusIcon = <ShieldAlert className="h-4 w-4" />; statusBg = "bg-red-50"; }
    } else {
      if (value >= (benchIdeal ?? benchMax)) { statusColor = "text-green-600"; statusIcon = <CheckCircle2 className="h-4 w-4" />; statusBg = "bg-green-50"; }
      else if (value >= benchMin) { statusColor = "text-amber-500"; statusIcon = <AlertTriangle className="h-4 w-4" />; statusBg = "bg-amber-50"; }
      else { statusColor = "text-red-500"; statusIcon = <ShieldAlert className="h-4 w-4" />; statusBg = "bg-red-50"; }
    }
  }

  return (
    <div className={`rounded-lg border p-3 ${statusBg}`} data-testid={testId}>
      <div className="flex items-center justify-between mb-1">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{labelEn}</p>
          <p className="text-sm font-semibold">{label}</p>
        </div>
        <span className={statusColor}>{statusIcon}</span>
      </div>
      <p className={`text-2xl font-bold tabular-nums ${statusColor}`} data-testid={`${testId}-value`}>
        {value !== null ? value.toFixed(2) : "N/A"}
        {value !== null && <span className="text-xs font-normal ml-1">{unit}</span>}
      </p>
      {benchMin !== undefined && benchIdeal !== undefined && (
        <p className="text-[10px] text-muted-foreground mt-1">
          มาตรฐาน: {benchMin.toFixed(1)} - {(benchMax ?? benchIdeal).toFixed(1)} (เหมาะสม: {benchIdeal.toFixed(1)})
        </p>
      )}
    </div>
  );
}

function HealthGauge({ score, label, color }: { score: number; label: string; color: string }) {
  const radius = 80;
  const circumference = Math.PI * radius;
  const progress = (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center" data-testid="gauge-health-score">
      <svg width="200" height="120" viewBox="0 0 200 120">
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="16"
          strokeLinecap="round"
        />
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke={color}
          strokeWidth="16"
          strokeLinecap="round"
          strokeDasharray={`${progress} ${circumference}`}
          style={{ transition: "stroke-dasharray 0.8s ease" }}
        />
        <text x="100" y="85" textAnchor="middle" className="text-3xl font-bold" fill={color} fontSize="36">
          {score}
        </text>
        <text x="100" y="110" textAnchor="middle" fill="#6b7280" fontSize="13">
          {label}
        </text>
      </svg>
    </div>
  );
}

function fmt(val: number | null | undefined): string {
  if (val === null || val === undefined) return "-";
  return val.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const INDUSTRY_OPTIONS = [
  { value: "sme", label: "SME ทั่วไป" },
  { value: "manufacturing", label: "ผลิต/โรงงาน" },
  { value: "service", label: "บริการ" },
  { value: "retail", label: "ค้าปลีก/ค้าส่ง" },
];

const SEVERITY_CONFIG: Record<string, { icon: any; color: string; bg: string }> = {
  danger: { icon: ShieldAlert, color: "text-red-600", bg: "bg-red-50 border-red-200" },
  warning: { icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
  info: { icon: Info, color: "text-blue-600", bg: "bg-blue-50 border-blue-200" },
  success: { icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50 border-green-200" },
};

export default function FinancialRatiosDashboard() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const today = toLocalDateStr(new Date());
  const [asOfDate, setAsOfDate] = useState(today);
  const [industry, setIndustry] = useState("sme");
  const { dateEra, dateFmt } = useDateSettings();

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/reports/financial-ratios", companyId, asOfDate, industry],
    queryFn: async () => {
      const res = await fetch(
        `/api/reports/financial-ratios?companyId=${companyId}&asOfDate=${asOfDate}&industry=${industry}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to fetch financial ratios");
      return res.json();
    },
    enabled: !!companyId && !!asOfDate,
  });

  const { data: trendData } = useQuery<any>({
    queryKey: ["/api/reports/financial-ratios/trend", companyId, asOfDate],
    queryFn: async () => {
      const res = await fetch(
        `/api/reports/financial-ratios/trend?companyId=${companyId}&endDate=${asOfDate}&months=12`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to fetch trend data");
      return res.json();
    },
    enabled: !!companyId && !!asOfDate,
  });

  const aiMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/reports/financial-ratios/ai-recommendations", {
        companyId,
        asOfDate,
        industry,
      });
      return res.json();
    },
  });

  const ratios = data?.ratios;
  const healthScore = data?.healthScore;
  const benchmark = data?.benchmark;
  const summary = data?.summary;
  const trend = trendData?.trend || [];

  const handleExportPdf = () => {
    window.print();
  };

  return (
    <ReportLayout title="วิเคราะห์อัตราส่วนทางการเงิน" icon={<Activity className="h-5 w-5" />}>
      <div className="flex items-center justify-end flex-wrap gap-2 mb-2 print:hidden">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-green-400 text-green-600 hover:bg-green-50"
            onClick={() => refetch()}
            disabled={isLoading}
            data-testid="button-generate"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            วิเคราะห์
          </Button>
          <Button
            size="sm"
            className="h-8 gap-1.5 text-xs bg-[#05b187] text-white hover:bg-[#049a75] border-none"
            onClick={handleExportPdf}
            data-testid="button-export-pdf"
          >
            <FileDown className="h-4 w-4" />
            PDF
          </Button>
        </div>
      </div>

      <div className="flex items-end gap-3 flex-wrap print:hidden mb-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">ณ วันที่</label>
          <ThaiDateInput
            value={asOfDate}
            onChange={setAsOfDate}
            dateEra={dateEra}
            dateFmt={dateFmt}
            data-testid="input-as-of-date"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">ประเภทอุตสาหกรรม</label>
          <Select value={industry} onValueChange={setIndustry}>
            <SelectTrigger className="w-[180px] h-9" data-testid="select-industry">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INDUSTRY_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!companyId ? (
        <div className="text-center py-12 text-muted-foreground" data-testid="text-no-company">กรุณาเลือกบริษัท</div>
      ) : isLoading ? (
        <div className="text-center py-12 text-muted-foreground" data-testid="text-loading">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
          กำลังวิเคราะห์อัตราส่วนทางการเงิน...
        </div>
      ) : !data ? (
        <div className="text-center py-12 text-muted-foreground">ไม่มีข้อมูล</div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="md:col-span-1" data-testid="card-health-score">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  สุขภาพงบการเงิน
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center pt-0">
                <HealthGauge score={healthScore?.score || 0} label={healthScore?.label || ""} color={healthScore?.color || "#6b7280"} />
                <Badge variant="outline" className="mt-2" style={{ borderColor: healthScore?.color, color: healthScore?.color }}>
                  {healthScore?.label || "N/A"}
                </Badge>
              </CardContent>
            </Card>

            <Card className="md:col-span-2" data-testid="card-summary">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  สรุปข้อมูลการเงิน
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { label: "สินทรัพย์รวม", value: summary?.totalAssets, testId: "text-total-assets" },
                    { label: "หนี้สินรวม", value: summary?.totalLiabilities, testId: "text-total-liabilities" },
                    { label: "ส่วนของเจ้าของ", value: summary?.totalEquity, testId: "text-total-equity" },
                    { label: "รายได้", value: summary?.totalRevenue, testId: "text-total-revenue" },
                    { label: "กำไรสุทธิ", value: summary?.netIncome, testId: "text-net-income" },
                    { label: "กำไรขั้นต้น", value: summary?.grossProfit, testId: "text-gross-profit" },
                  ].map(item => (
                    <div key={item.testId} className="bg-slate-50 rounded-lg p-2.5">
                      <p className="text-[11px] text-muted-foreground">{item.label}</p>
                      <p className={`text-sm font-bold tabular-nums ${(item.value ?? 0) < 0 ? 'text-red-600' : ''}`} data-testid={item.testId}>
                        {fmt(item.value)}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="ratios" className="w-full">
            <TabsList className="grid w-full grid-cols-3 print:hidden">
              <TabsTrigger value="ratios" data-testid="tab-ratios">อัตราส่วน</TabsTrigger>
              <TabsTrigger value="trend" data-testid="tab-trend">แนวโน้ม</TabsTrigger>
              <TabsTrigger value="ai" data-testid="tab-ai">AI คำแนะนำ</TabsTrigger>
            </TabsList>

            <TabsContent value="ratios" className="space-y-4 mt-4">
              <Card data-testid="card-liquidity">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Droplets className="h-4 w-4 text-blue-500" />
                    สภาพคล่อง (Liquidity)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <RatioCard label="อัตราส่วนเงินทุนหมุนเวียน" labelEn="Current Ratio" value={ratios?.liquidity?.currentRatio} unit="เท่า"
                      benchMin={benchmark?.currentRatio?.min} benchMax={benchmark?.currentRatio?.max} benchIdeal={benchmark?.currentRatio?.ideal} testId="ratio-current" />
                    <RatioCard label="อัตราส่วนสภาพคล่องเร็ว" labelEn="Quick Ratio" value={ratios?.liquidity?.quickRatio} unit="เท่า"
                      benchMin={benchmark?.quickRatio?.min} benchMax={benchmark?.quickRatio?.max} benchIdeal={benchmark?.quickRatio?.ideal} testId="ratio-quick" />
                    <RatioCard label="อัตราส่วนเงินสด" labelEn="Cash Ratio" value={ratios?.liquidity?.cashRatio} unit="เท่า" testId="ratio-cash" />
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-leverage">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Scale className="h-4 w-4 text-red-500" />
                    โครงสร้างหนี้สิน (Leverage)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <RatioCard label="หนี้สินต่อส่วนของเจ้าของ" labelEn="Debt-to-Equity" value={ratios?.leverage?.debtToEquity} unit="เท่า" inverse
                      benchMin={benchmark?.debtToEquity?.min} benchMax={benchmark?.debtToEquity?.max} benchIdeal={benchmark?.debtToEquity?.ideal} testId="ratio-de" />
                    <RatioCard label="อัตราส่วนหนี้สิน" labelEn="Debt Ratio" value={ratios?.leverage?.debtRatio} unit="" inverse
                      benchMin={benchmark?.debtRatio?.min} benchMax={benchmark?.debtRatio?.max} benchIdeal={benchmark?.debtRatio?.ideal} testId="ratio-debt" />
                    <RatioCard label="ความสามารถจ่ายดอกเบี้ย" labelEn="Interest Coverage" value={ratios?.leverage?.interestCoverage} unit="เท่า" testId="ratio-interest" />
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-profitability">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    ความสามารถในการทำกำไร (Profitability)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <RatioCard label="ผลตอบแทนต่อสินทรัพย์" labelEn="ROA" value={ratios?.profitability?.roa} unit="%"
                      benchMin={benchmark?.roa?.min} benchMax={benchmark?.roa?.max} benchIdeal={benchmark?.roa?.ideal} testId="ratio-roa" />
                    <RatioCard label="ผลตอบแทนต่อส่วนของเจ้าของ" labelEn="ROE" value={ratios?.profitability?.roe} unit="%"
                      benchMin={benchmark?.roe?.min} benchMax={benchmark?.roe?.max} benchIdeal={benchmark?.roe?.ideal} testId="ratio-roe" />
                    <RatioCard label="อัตรากำไรสุทธิ" labelEn="Net Profit Margin" value={ratios?.profitability?.netProfitMargin} unit="%"
                      benchMin={benchmark?.netProfitMargin?.min} benchMax={benchmark?.netProfitMargin?.max} benchIdeal={benchmark?.netProfitMargin?.ideal} testId="ratio-npm" />
                    <RatioCard label="อัตรากำไรขั้นต้น" labelEn="Gross Profit Margin" value={ratios?.profitability?.grossProfitMargin} unit="%"
                      benchMin={benchmark?.grossProfitMargin?.min} benchMax={benchmark?.grossProfitMargin?.max} benchIdeal={benchmark?.grossProfitMargin?.ideal} testId="ratio-gpm" />
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-efficiency">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Zap className="h-4 w-4 text-purple-500" />
                    ประสิทธิภาพ (Efficiency / DSO-DPO-DIO)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <RatioCard label="วันเก็บหนี้เฉลี่ย" labelEn="DSO (Days Sales Outstanding)" value={ratios?.efficiency?.dso} unit="วัน" inverse
                      benchMin={benchmark?.dso?.min} benchMax={benchmark?.dso?.max} benchIdeal={benchmark?.dso?.ideal} testId="ratio-dso" />
                    <RatioCard label="วันจ่ายหนี้เฉลี่ย" labelEn="DPO (Days Payable Outstanding)" value={ratios?.efficiency?.dpo} unit="วัน"
                      benchMin={benchmark?.dpo?.min} benchMax={benchmark?.dpo?.max} benchIdeal={benchmark?.dpo?.ideal} testId="ratio-dpo" />
                    <RatioCard label="วันหมุนเวียนสินค้า" labelEn="DIO (Days Inventory Outstanding)" value={ratios?.efficiency?.dio} unit="วัน" inverse
                      benchMin={benchmark?.dio?.min} benchMax={benchmark?.dio?.max} benchIdeal={benchmark?.dio?.ideal} testId="ratio-dio" />
                    <RatioCard label="อัตราหมุนเวียนสินทรัพย์" labelEn="Asset Turnover" value={ratios?.efficiency?.assetTurnover} unit="เท่า"
                      benchMin={benchmark?.assetTurnover?.min} benchMax={benchmark?.assetTurnover?.max} benchIdeal={benchmark?.assetTurnover?.ideal} testId="ratio-at" />
                  </div>
                </CardContent>
              </Card>

              {healthScore?.breakdown && healthScore.breakdown.length > 0 && (
                <Card data-testid="card-breakdown">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      รายละเอียดคะแนนสุขภาพ
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {healthScore.breakdown.map((item: any) => (
                        <div key={item.key} className="flex items-center gap-3">
                          <span className="text-xs w-[140px] truncate font-medium">{item.key}</span>
                          <div className="flex-1 bg-gray-200 rounded-full h-2">
                            <div
                              className="h-2 rounded-full transition-all"
                              style={{
                                width: `${item.score}%`,
                                backgroundColor: item.score >= 70 ? "#22c55e" : item.score >= 40 ? "#f59e0b" : "#ef4444",
                              }}
                            />
                          </div>
                          <span className="text-xs font-mono w-10 text-right">{item.score}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="trend" className="mt-4">
              <Card data-testid="card-trend">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    แนวโน้มอัตราส่วนย้อนหลัง 12 เดือน
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {trend.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground text-sm">ไม่มีข้อมูลแนวโน้ม</div>
                  ) : (
                    <div className="space-y-6">
                      <div data-testid="chart-trend-main">
                        <h4 className="text-xs font-semibold text-muted-foreground mb-2">Current Ratio & D/E Ratio</h4>
                        <ResponsiveContainer width="100%" height={250}>
                          <LineChart data={trend}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} />
                            <RechartsTooltip contentStyle={{ fontSize: 12 }} />
                            <Legend wrapperStyle={{ fontSize: 12 }} />
                            <Line type="monotone" dataKey="currentRatio" name="Current Ratio" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                            <Line type="monotone" dataKey="debtToEquity" name="D/E Ratio" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      <div data-testid="chart-trend-profitability">
                        <h4 className="text-xs font-semibold text-muted-foreground mb-2">Profitability (%)</h4>
                        <ResponsiveContainer width="100%" height={250}>
                          <LineChart data={trend}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} />
                            <RechartsTooltip contentStyle={{ fontSize: 12 }} />
                            <Legend wrapperStyle={{ fontSize: 12 }} />
                            <Line type="monotone" dataKey="netProfitMargin" name="Net Margin %" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                            <Line type="monotone" dataKey="grossProfitMargin" name="Gross Margin %" stroke="#06b6d4" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                            <Line type="monotone" dataKey="roe" name="ROE %" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                            <Line type="monotone" dataKey="roa" name="ROA %" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="ai" className="mt-4">
              <Card data-testid="card-ai-recommendations">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-purple-500" />
                    AI คำแนะนำวิเคราะห์งบการเงิน
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!aiMutation.data && !aiMutation.isPending && (
                    <div className="text-center py-8">
                      <Lightbulb className="h-10 w-10 mx-auto mb-3 text-amber-300" />
                      <p className="text-sm text-muted-foreground mb-4">กดปุ่มด้านล่างเพื่อให้ AI วิเคราะห์อัตราส่วนทางการเงินและให้คำแนะนำ</p>
                      <Button
                        onClick={() => aiMutation.mutate()}
                        disabled={!data}
                        className="gap-2"
                        data-testid="button-ai-analyze"
                      >
                        <Sparkles className="h-4 w-4" />
                        วิเคราะห์ด้วย AI
                      </Button>
                    </div>
                  )}
                  {aiMutation.isPending && (
                    <div className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">AI กำลังวิเคราะห์...</p>
                    </div>
                  )}
                  {aiMutation.isError && (
                    <div className="text-center py-4 text-red-500 text-sm">
                      เกิดข้อผิดพลาด: {(aiMutation.error as Error).message}
                    </div>
                  )}
                  {aiMutation.data?.recommendations && Array.isArray(aiMutation.data.recommendations) && (
                    <div className="space-y-3">
                      {aiMutation.data.recommendations.filter((rec: any) => rec && typeof rec.title === "string" && typeof rec.detail === "string").map((rec: any, idx: number) => {
                        const config = SEVERITY_CONFIG[rec.severity] || SEVERITY_CONFIG.info;
                        const Icon = config.icon;
                        return (
                          <div key={idx} className={`rounded-lg border p-3 ${config.bg}`} data-testid={`ai-rec-${idx}`}>
                            <div className="flex items-start gap-2">
                              <Icon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${config.color}`} />
                              <div>
                                <p className={`text-sm font-semibold ${config.color}`}>{rec.title}</p>
                                <p className="text-sm text-gray-700 mt-1">{rec.detail}</p>
                                {rec.ratioKey && (
                                  <Badge variant="outline" className="mt-2 text-[10px]">{rec.ratioKey}</Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <div className="flex justify-center pt-2">
                        <Button variant="outline" size="sm" onClick={() => aiMutation.mutate()} className="gap-1.5" data-testid="button-ai-reanalyze">
                          <RefreshCw className="h-3.5 w-3.5" />
                          วิเคราะห์ใหม่
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </ReportLayout>
  );
}
