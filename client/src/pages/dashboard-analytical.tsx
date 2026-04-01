import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DollarSign, TrendingUp, TrendingDown, Info, Wallet, BadgeDollarSign, ReceiptText, Scale, BarChart3, ShoppingCart, LayoutDashboard, PiggyBank } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { useAuth } from "@/lib/auth";
import ThaiDateInput from "@/components/thai-date-input";
import { toLocalDateStr } from "@/lib/utils";
import FinancialManagementContent from "./reports/financial-management-content";

import { useDateSettings } from "@/hooks/use-date-settings";
function getToday() {
  return toLocalDateStr(new Date());
}
function getFirstOfYear() {
  const d = new Date();
  return `${d.getFullYear()}-01-01`;
}

function formatMoney(v: number) {
  return `฿${v.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`;
}

const THAI_MONTHS: Record<string, string> = {
  "01": "ม.ค.", "02": "ก.พ.", "03": "มี.ค.", "04": "เม.ย.",
  "05": "พ.ค.", "06": "มิ.ย.", "07": "ก.ค.", "08": "ส.ค.",
  "09": "ก.ย.", "10": "ต.ค.", "11": "พ.ย.", "12": "ธ.ค.",
};

export default function DashboardAnalytical() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;

  const [activeTab, setActiveTab] = useState<"overview" | "financial">("overview");
  const { dateEra, dateFmt } = useDateSettings();
  const { data: docSettings } = useQuery<any>({
    queryKey: ["/api/document-settings", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const res = await fetch(`/api/document-settings?companyId=${companyId}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!companyId,
  });
  const [asOfDate, setAsOfDate] = useState(getToday);
  const [rangeFrom, setRangeFrom] = useState(getFirstOfYear);
  const [rangeTo, setRangeTo] = useState(getToday);

  useEffect(() => {
    if (user?.role === "super_admin") setLocation("/platform");
  }, [user, setLocation]);

  const { data: stats } = useQuery<any>({
    queryKey: ["/api/dashboard/stats", selectedCompany?.id, rangeFrom, rangeTo],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCompany?.id) params.set("companyId", String(selectedCompany.id));
      if (rangeFrom) params.set("rangeFrom", rangeFrom);
      if (rangeTo) params.set("rangeTo", rangeTo);
      const r = await fetch(`/api/dashboard/stats?${params}`, { credentials: "include" });
      if (!r.ok) return {};
      return r.json();
    },
  });

  const revenueThisMonth = stats?.revenueThisMonth || 0;
  const expenseThisMonth = stats?.expenseThisMonth || 0;
  const profitLoss = stats?.profitLossThisMonth || 0;
  const outstandingReceivables = stats?.outstandingReceivables || 0;
  const outstandingPayables = stats?.outstandingPayables || 0;
  const monthlyPL: any[] = stats?.monthlyPL || [];

  const maxPLValue = monthlyPL.length > 0
    ? Math.max(...monthlyPL.map(m => Math.max(m.revenue, m.expense)), 1)
    : 1;

  const netReceivablePayable = outstandingReceivables - outstandingPayables;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight text-foreground" data-testid="text-analytical-title">Hi! {user?.fullName || user?.username || "ผู้ใช้"}</h1>
              <p className="text-muted-foreground mt-1 text-sm sm:text-base truncate max-w-[280px] sm:max-w-none">
                วิเคราะห์การเงิน <span className="font-medium text-foreground">{selectedCompany?.name || "ระบบบัญชีออนไลน์"}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1 w-fit" data-testid="dashboard-tabs">
            <button
              onClick={() => setActiveTab("overview")}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === "overview"
                  ? "bg-white shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/50"
              }`}
              data-testid="tab-overview"
            >
              <LayoutDashboard className="h-4 w-4" />
              ภาพรวม
            </button>
            <button
              onClick={() => setActiveTab("financial")}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === "financial"
                  ? "bg-white shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/50"
              }`}
              data-testid="tab-financial-management"
            >
              <PiggyBank className="h-4 w-4" />
              Financial Management
            </button>
          </div>
        </div>

        {activeTab === "financial" ? (
          <FinancialManagementContent />
        ) : (
        <>
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-2 sm:gap-3 justify-between" data-testid="analytical-date-filter">
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">As of :</span>
                <ThaiDateInput value={asOfDate} onChange={setAsOfDate} dateEra={dateEra} dateFmt={dateFmt} data-testid="input-analytical-as-of-date" />
                <span title="วันที่แสดงยอดคงเหลือ ณ วันที่เลือก"><Info className="h-3.5 w-3.5 text-[#03c9d7] cursor-help" /></span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Range :</span>
                <ThaiDateInput value={rangeFrom} onChange={setRangeFrom} dateEra={dateEra} dateFmt={dateFmt} data-testid="input-analytical-range-from" />
                <span className="text-xs text-muted-foreground">-</span>
                <ThaiDateInput value={rangeTo} onChange={setRangeTo} dateEra={dateEra} dateFmt={dateFmt} data-testid="input-analytical-range-to" />
                <span title="ช่วงวันที่สำหรับกรองข้อมูลรายงาน"><Info className="h-3.5 w-3.5 text-[#03c9d7] cursor-help" /></span>
              </div>
            </div>
          </div>

        <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
          <Card className="shadow-lg border-none text-white overflow-hidden relative rounded-xl cursor-pointer hover:opacity-90 transition-opacity" style={{ background: "#03c9d7" }} onClick={() => setLocation("/reports/income-statement")}>
            <div className="absolute -bottom-6 -right-6 opacity-10">
              <DollarSign className="h-24 sm:h-32 w-24 sm:w-32" />
            </div>
            <CardHeader className="pb-2 p-4 sm:p-6">
              <CardTitle className="text-sm sm:text-base font-medium text-white/80">รายได้ปีนี้ (จากบัญชี)</CardTitle>
              <div className="text-2xl sm:text-3xl font-bold mt-1" data-testid="text-revenue">
                {formatMoney(revenueThisMonth)}
              </div>
              <p className="text-xs sm:text-sm text-white/70 mt-1">จากสมุดบัญชีรายได้ทั้งหมด</p>
            </CardHeader>
          </Card>

          <Card className="shadow-lg border-none text-white overflow-hidden relative rounded-xl cursor-pointer hover:opacity-90 transition-opacity" style={{ background: "#fb9678" }} onClick={() => setLocation("/reports/income-statement")}>
            <div className="absolute -bottom-6 -right-6 opacity-10">
              <ReceiptText className="h-24 sm:h-32 w-24 sm:w-32" />
            </div>
            <CardHeader className="pb-2 p-4 sm:p-6">
              <CardTitle className="text-sm sm:text-base font-medium text-white/80">ค่าใช้จ่ายปีนี้</CardTitle>
              <div className="text-2xl sm:text-3xl font-bold mt-1" data-testid="text-expense">
                {formatMoney(expenseThisMonth)}
              </div>
              <p className="text-xs sm:text-sm text-white/70 mt-1">รวมเงินเดือน, ค่าใช้จ่าย, ซื้อสินค้า</p>
            </CardHeader>
          </Card>

          <Card className="shadow-lg border-none text-white overflow-hidden relative rounded-xl sm:col-span-2 md:col-span-1 cursor-pointer hover:opacity-90 transition-opacity" style={{ background: profitLoss >= 0 ? "#fec90f" : "#f94d4d" }} onClick={() => setLocation("/reports/income-statement")}>
            <div className="absolute -bottom-6 -right-6 opacity-10">
              {profitLoss >= 0 ? <TrendingUp className="h-24 sm:h-32 w-24 sm:w-32" /> : <TrendingDown className="h-24 sm:h-32 w-24 sm:w-32" />}
            </div>
            <CardHeader className="pb-2 p-4 sm:p-6">
              <CardTitle className="text-sm sm:text-base font-medium text-white/80">กำไร(ขาดทุน)ปีนี้</CardTitle>
              <div className="text-2xl sm:text-3xl font-bold mt-1" data-testid="text-profit-loss">
                {formatMoney(profitLoss)}
              </div>
              <p className="text-xs sm:text-sm text-white/70 mt-1">
                {profitLoss >= 0 ? "กำไรสุทธิ" : "ขาดทุนสุทธิ"} (รายได้ - ค่าใช้จ่าย)
              </p>
            </CardHeader>
          </Card>
        </div>

        <div className="grid gap-3 sm:gap-4 grid-cols-1 min-[400px]:grid-cols-2 lg:grid-cols-4">
          <Card className="shadow-sm border-slate-200 rounded-xl hover:shadow-md transition-all cursor-pointer" onClick={() => setLocation("/invoices")} data-testid="card-receivables">
            <CardContent className="p-3 sm:p-5">
              <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                <div className="p-2 sm:p-2.5 rounded-full" style={{ background: outstandingReceivables > 0 ? "#fff3ee" : "#e5f9fa" }}>
                  <BadgeDollarSign className="h-4 sm:h-5 w-4 sm:w-5" style={{ color: outstandingReceivables > 0 ? "#fb9678" : "#03c9d7" }} />
                </div>
                <p className="text-xs sm:text-sm font-medium text-muted-foreground">ลูกหนี้คงค้าง</p>
              </div>
              <p className="text-lg sm:text-2xl font-bold" style={{ color: outstandingReceivables > 0 ? "#fb9678" : undefined }} data-testid="text-receivables">{formatMoney(outstandingReceivables)}</p>
              <p className="text-xs text-muted-foreground mt-1 hidden sm:block">ยอดค้างรับจากลูกค้า</p>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-slate-200 rounded-xl hover:shadow-md transition-all cursor-pointer" onClick={() => setLocation("/expenses")} data-testid="card-payables">
            <CardContent className="p-3 sm:p-5">
              <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                <div className="p-2 sm:p-2.5 rounded-full" style={{ background: outstandingPayables > 0 ? "#fef3cd" : "#e5f9fa" }}>
                  <Wallet className="h-4 sm:h-5 w-4 sm:w-5" style={{ color: outstandingPayables > 0 ? "#fec90f" : "#03c9d7" }} />
                </div>
                <p className="text-xs sm:text-sm font-medium text-muted-foreground">เจ้าหนี้คงค้าง</p>
              </div>
              <p className="text-lg sm:text-2xl font-bold" style={{ color: outstandingPayables > 0 ? "#fec90f" : undefined }} data-testid="text-payables">{formatMoney(outstandingPayables)}</p>
              <p className="text-xs text-muted-foreground mt-1 hidden sm:block">ยอดค้างจ่ายให้ผู้ขาย</p>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-slate-200 rounded-xl hover:shadow-md transition-all cursor-pointer" onClick={() => setLocation("/journal")} data-testid="card-net-position">
            <CardContent className="p-3 sm:p-5">
              <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                <div className="p-2 sm:p-2.5 rounded-full" style={{ background: netReceivablePayable >= 0 ? "#e8f8f0" : "#fef2f2" }}>
                  <Scale className="h-4 sm:h-5 w-4 sm:w-5" style={{ color: netReceivablePayable >= 0 ? "#05b187" : "#f94d4d" }} />
                </div>
                <p className="text-xs sm:text-sm font-medium text-muted-foreground">สุทธิ ลูกหนี้-เจ้าหนี้</p>
              </div>
              <p className="text-lg sm:text-2xl font-bold" style={{ color: netReceivablePayable >= 0 ? "#05b187" : "#f94d4d" }} data-testid="text-net-position">
                {netReceivablePayable >= 0 ? "+" : ""}{formatMoney(netReceivablePayable)}
              </p>
              <p className="text-xs text-muted-foreground mt-1 hidden sm:block">
                {netReceivablePayable >= 0 ? "ค้างรับมากกว่าค้างจ่าย" : "ค้างจ่ายมากกว่าค้างรับ"}
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-slate-200 rounded-xl hover:shadow-md transition-all cursor-pointer" onClick={() => setLocation("/reports/income-statement")} data-testid="card-margin">
            <CardContent className="p-3 sm:p-5">
              <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                <div className="p-2 sm:p-2.5 rounded-full" style={{ background: "#e5f9fa" }}>
                  <BarChart3 className="h-4 sm:h-5 w-4 sm:w-5" style={{ color: "#03c9d7" }} />
                </div>
                <p className="text-xs sm:text-sm font-medium text-muted-foreground">อัตรากำไร</p>
              </div>
              <p className="text-lg sm:text-2xl font-bold" style={{ color: profitLoss >= 0 ? "#05b187" : "#f94d4d" }} data-testid="text-margin">
                {revenueThisMonth > 0 ? ((profitLoss / revenueThisMonth) * 100).toFixed(1) : "0.0"}%
              </p>
              <p className="text-xs text-muted-foreground mt-1 hidden sm:block">กำไรสุทธิ / รายได้ปีนี้</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="shadow-sm border-slate-200 rounded-xl">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                <div>
                  <CardTitle className="text-sm sm:text-base font-bold">เปรียบเทียบรายได้ vs ค่าใช้จ่าย</CardTitle>
                  <CardDescription className="text-xs">ข้อมูลจากสมุดบัญชี 6 เดือนล่าสุด</CardDescription>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm" style={{ background: "#03c9d7" }} />
                    <span className="text-muted-foreground">รายได้</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm" style={{ background: "#fb9678" }} />
                    <span className="text-muted-foreground">ค่าใช้จ่าย</span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {monthlyPL.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">ยังไม่มีข้อมูลรายได้/ค่าใช้จ่ายจากบัญชี</p>
                  <p className="text-xs mt-1">เมื่อมีการบันทึกบัญชี ข้อมูลจะแสดงที่นี่</p>
                </div>
              ) : (
                <div className="flex items-end gap-2 sm:gap-3 h-40 sm:h-52 overflow-x-auto">
                  {monthlyPL.map((d: any, i: number) => {
                    const monthNum = d.month?.split("-")[1] || "";
                    const label = THAI_MONTHS[monthNum] || d.month;
                    const revPct = maxPLValue > 0 ? (d.revenue / maxPLValue) * 100 : 0;
                    const expPct = maxPLValue > 0 ? (d.expense / maxPLValue) * 100 : 0;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1" data-testid={`bar-pl-${i}`}>
                        <div className="w-full flex gap-1 items-end justify-center" style={{ height: "180px" }}>
                          <div
                            className="w-4 rounded-t-sm transition-all"
                            style={{ background: "#03c9d7", height: `${Math.max(revPct, 2)}%` }}
                            title={`รายได้: ${formatMoney(d.revenue)}`}
                          />
                          <div
                            className="w-4 rounded-t-sm transition-all"
                            style={{ background: "#fb9678", height: `${Math.max(expPct, 2)}%` }}
                            title={`ค่าใช้จ่าย: ${formatMoney(d.expense)}`}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground mt-1">{label}</span>
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
                  <CardTitle className="text-base font-bold">กำไร(ขาดทุน)รายเดือน</CardTitle>
                  <CardDescription>สรุปผลกำไรขาดทุน 6 เดือนล่าสุด</CardDescription>
                </div>
              </div>
              {monthlyPL.length > 0 && (() => {
                const totalRevenue = monthlyPL.reduce((s: number, m: any) => s + (m.revenue || 0), 0);
                const totalExpense = monthlyPL.reduce((s: number, m: any) => s + (m.expense || 0), 0);
                const totalProfit = totalRevenue - totalExpense;
                return (
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-sm text-muted-foreground">กำไร(ขาดทุน)รวม</span>
                    <span className="text-2xl font-bold" style={{ color: totalProfit >= 0 ? "#05b187" : "#f94d4d" }}>
                      {formatMoney(totalProfit)}
                    </span>
                  </div>
                );
              })()}
            </CardHeader>
            <CardContent>
              {monthlyPL.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">ยังไม่มีข้อมูล</p>
                </div>
              ) : (() => {
                const DONUT_COLORS = ["#03c9d7", "#fb9678", "#fec90f", "#05b187", "#539BFF", "#a855f7"];
                const monthNames: Record<string, string> = {
                  "01": "ม.ค.", "02": "ก.พ.", "03": "มี.ค.", "04": "เม.ย.",
                  "05": "พ.ค.", "06": "มิ.ย.", "07": "ก.ค.", "08": "ส.ค.",
                  "09": "ก.ย.", "10": "ต.ค.", "11": "พ.ย.", "12": "ธ.ค.",
                };
                const chartData = monthlyPL.map((item: any, i: number) => {
                  const monthNum = item.month?.split("-")[1] || "";
                  return {
                    name: monthNames[monthNum] || item.month,
                    value: Math.abs(item.expense || 0),
                    revenue: item.revenue || 0,
                    expense: item.expense || 0,
                    profit: item.profit || 0,
                    color: DONUT_COLORS[i % DONUT_COLORS.length],
                  };
                }).filter((d: any) => d.value > 0);
                const totalValue = chartData.reduce((s: number, d: any) => s + d.value, 0);
                return (
                  <div>
                    <div className="relative mx-auto" style={{ width: 220, height: 220 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={78}
                            outerRadius={100}
                            paddingAngle={2}
                            dataKey="value"
                            stroke="none"
                          >
                            {chartData.map((entry: any, index: number) => (
                              <Cell key={index} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            content={({ active, payload }: any) => {
                              if (!active || !payload?.[0]) return null;
                              const d = payload[0].payload;
                              return (
                                <div className="bg-white shadow-lg rounded-lg p-3 border text-xs">
                                  <p className="font-bold mb-1">{d.name}</p>
                                  <p>รายได้: <span className="text-[#03c9d7]">{formatMoney(d.revenue)}</span></p>
                                  <p>ค่าใช้จ่าย: <span className="text-[#fb9678]">{formatMoney(d.expense)}</span></p>
                                  <p className="mt-1 font-bold" style={{ color: d.profit >= 0 ? "#05b187" : "#f94d4d" }}>
                                    กำไร: {d.profit >= 0 ? "+" : ""}{formatMoney(d.profit)}
                                  </p>
                                </div>
                              );
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="text-center">
                          <DollarSign className="h-6 w-6 mx-auto text-muted-foreground/40 mb-1" />
                          <p className="text-xs text-muted-foreground">{monthlyPL.length} เดือน</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-4">
                      {chartData.map((d: any, i: number) => (
                        <div key={i} className="flex items-center gap-1.5 text-xs" data-testid={`legend-pl-${i}`}>
                          <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: d.color }} />
                          <span className="text-muted-foreground">{d.name}</span>
                          <span className="font-medium">{totalValue > 0 ? ((d.value / totalValue) * 100).toFixed(0) : 0}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-sm border-slate-200 rounded-xl">
          <CardHeader>
            <CardTitle className="text-base font-bold">สรุปฐานะทางการเงิน</CardTitle>
            <CardDescription>ลูกหนี้ vs เจ้าหนี้คงค้าง</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:gap-6 grid-cols-1 sm:grid-cols-3">
              <div className="text-center p-3 sm:p-4 rounded-xl" style={{ background: "#e5f9fa" }}>
                <p className="text-sm text-muted-foreground mb-1 sm:mb-2">ลูกหนี้คงค้าง</p>
                <p className="text-xl sm:text-2xl font-bold" style={{ color: "#03c9d7" }}>{formatMoney(outstandingReceivables)}</p>
                <p className="text-xs text-muted-foreground mt-1">เงินที่ลูกค้าค้างจ่าย</p>
              </div>
              <div className="text-center p-3 sm:p-4 rounded-xl" style={{ background: "#fff3ee" }}>
                <p className="text-sm text-muted-foreground mb-1 sm:mb-2">เจ้าหนี้คงค้าง</p>
                <p className="text-xl sm:text-2xl font-bold" style={{ color: "#fb9678" }}>{formatMoney(outstandingPayables)}</p>
                <p className="text-xs text-muted-foreground mt-1">เงินที่ค้างจ่ายผู้ขาย</p>
              </div>
              <div className="text-center p-3 sm:p-4 rounded-xl" style={{ background: netReceivablePayable >= 0 ? "#e8f8f0" : "#fef2f2" }}>
                <p className="text-sm text-muted-foreground mb-1 sm:mb-2">สุทธิ (ลูกหนี้ - เจ้าหนี้)</p>
                <p className="text-xl sm:text-2xl font-bold" style={{ color: netReceivablePayable >= 0 ? "#05b187" : "#f94d4d" }}>
                  {netReceivablePayable >= 0 ? "+" : ""}{formatMoney(netReceivablePayable)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {netReceivablePayable >= 0 ? "มีเงินค้างรับมากกว่าค้างจ่าย" : "มีเงินค้างจ่ายมากกว่าค้างรับ"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        </>
        )}
      </div>
    </Layout>
  );
}
