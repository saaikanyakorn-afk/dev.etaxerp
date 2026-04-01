import { useState } from "react";
import { useLocation } from "wouter";
import MobileLayout from "@/components/mobile-layout";
import { useQuery } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { useAuth } from "@/lib/auth";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Wallet,
  BadgeDollarSign,
  ReceiptText,
  Camera,
  ChevronRight,
  RefreshCw,
} from "lucide-react";

function formatMoney(v: number) {
  if (Math.abs(v) >= 1_000_000) {
    return `฿${(v / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(v) >= 1_000) {
    return `฿${(v / 1_000).toFixed(1)}K`;
  }
  return `฿${v.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatMoneyFull(v: number) {
  return `฿${v.toLocaleString("th-TH", { minimumFractionDigits: 2 })}`;
}

function Sparkline({ data, color, height = 32 }: { data: number[]; color: string; height?: number }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 100;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(" ");
  const lastY = height - ((data[data.length - 1] - min) / range) * (height - 4) - 2;

  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={w} cy={lastY} r="2.5" fill={color} />
    </svg>
  );
}

type TrendPeriod = "7d" | "30d" | "ytd";

function getRangeStart(period: TrendPeriod): string {
  const d = new Date();
  if (period === "7d") {
    d.setDate(d.getDate() - 7);
  } else if (period === "30d") {
    d.setDate(d.getDate() - 30);
  } else {
    return `${d.getFullYear()}-01-01`;
  }
  return d.toISOString().split("T")[0];
}
function getToday() {
  return new Date().toISOString().split("T")[0];
}

export default function MobileExecutiveDashboard() {
  const { user } = useAuth();
  const { selectedCompany } = useCompany();
  const [, setLocation] = useLocation();
  const companyId = selectedCompany?.id;
  const [trendPeriod, setTrendPeriod] = useState<TrendPeriod>("30d");
  const rangeFrom = getRangeStart(trendPeriod);
  const rangeTo = getToday();

  const { data: stats, isLoading, refetch, isFetching } = useQuery<any>({
    queryKey: ["/api/dashboard/stats", companyId, rangeFrom, rangeTo],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (companyId) params.set("companyId", String(companyId));
      params.set("rangeFrom", rangeFrom);
      params.set("rangeTo", rangeTo);
      const r = await fetch(`/api/dashboard/stats?${params}`, { credentials: "include" });
      if (!r.ok) return {};
      return r.json();
    },
    enabled: !!companyId,
  });

  const revenue = stats?.revenueThisMonth || 0;
  const expense = stats?.expenseThisMonth || 0;
  const profit = stats?.profitLossThisMonth || 0;
  const receivables = stats?.outstandingReceivables || 0;
  const payables = stats?.outstandingPayables || 0;
  const cashBalance = receivables - payables;
  const monthlyPL: any[] = stats?.monthlyPL || [];

  const revenueData = monthlyPL.map((m: any) => m.revenue || 0);
  const expenseData = monthlyPL.map((m: any) => m.expense || 0);
  const profitData = monthlyPL.map((m: any) => (m.revenue || 0) - (m.expense || 0));

  const profitMargin = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : "0.0";

  return (
    <MobileLayout title="Executive Dashboard">
      <div className="px-4 py-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400" data-testid="text-greeting">
              สวัสดี, {user?.fullName || user?.username || "ผู้บริหาร"}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500" data-testid="text-company-name">
              {selectedCompany?.name || "บริษัท"}
            </p>
          </div>
          <button
            onClick={() => refetch()}
            className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 active:scale-95 transition-all"
            data-testid="button-refresh-dashboard"
            disabled={isFetching}
          >
            <RefreshCw className={`h-4 w-4 text-gray-500 ${isFetching ? "animate-spin" : ""}`} />
          </button>
        </div>

        <div className="flex gap-1.5 bg-gray-100 dark:bg-gray-800 rounded-xl p-1" data-testid="trend-period-selector">
          {([
            { key: "7d" as TrendPeriod, label: "7 วัน" },
            { key: "30d" as TrendPeriod, label: "30 วัน" },
            { key: "ytd" as TrendPeriod, label: "ปีนี้" },
          ]).map((opt) => (
            <button
              key={opt.key}
              onClick={() => setTrendPeriod(opt.key)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
                trendPeriod === opt.key
                  ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
                  : "text-gray-500 dark:text-gray-400"
              }`}
              data-testid={`button-period-${opt.key}`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-gray-200 dark:bg-gray-800 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3" data-testid="kpi-cards">
              <KpiCard
                title="รายได้"
                value={formatMoney(revenue)}
                fullValue={formatMoneyFull(revenue)}
                icon={<DollarSign className="h-4 w-4" />}
                color="#03c9d7"
                bgColor="#e5f9fa"
                sparkData={revenueData}
                testId="kpi-revenue"
              />
              <KpiCard
                title="ค่าใช้จ่าย"
                value={formatMoney(expense)}
                fullValue={formatMoneyFull(expense)}
                icon={<ReceiptText className="h-4 w-4" />}
                color="#fb9678"
                bgColor="#fff3ee"
                sparkData={expenseData}
                testId="kpi-expense"
              />
              <KpiCard
                title="กำไร(ขาดทุน)"
                value={formatMoney(profit)}
                fullValue={formatMoneyFull(profit)}
                icon={profit >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                color={profit >= 0 ? "#05b187" : "#f94d4d"}
                bgColor={profit >= 0 ? "#e8f8f0" : "#fef2f2"}
                sparkData={profitData}
                testId="kpi-profit"
              />
              <KpiCard
                title="อัตรากำไร"
                value={`${profitMargin}%`}
                icon={<TrendingUp className="h-4 w-4" />}
                color={profit >= 0 ? "#05b187" : "#f94d4d"}
                bgColor={profit >= 0 ? "#e8f8f0" : "#fef2f2"}
                testId="kpi-margin"
              />
              <KpiCard
                title="ลูกหนี้ (AR)"
                value={formatMoney(receivables)}
                fullValue={formatMoneyFull(receivables)}
                icon={<BadgeDollarSign className="h-4 w-4" />}
                color={receivables > 0 ? "#fb9678" : "#03c9d7"}
                bgColor={receivables > 0 ? "#fff3ee" : "#e5f9fa"}
                testId="kpi-ar"
              />
              <KpiCard
                title="เจ้าหนี้ (AP)"
                value={formatMoney(payables)}
                fullValue={formatMoneyFull(payables)}
                icon={<Wallet className="h-4 w-4" />}
                color={payables > 0 ? "#fec90f" : "#03c9d7"}
                bgColor={payables > 0 ? "#fef3cd" : "#e5f9fa"}
                testId="kpi-ap"
              />
            </div>

            {monthlyPL.length > 0 && (
              <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-800" data-testid="card-monthly-trend">
                <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">
                  รายได้ vs ค่าใช้จ่าย (รายเดือน)
                </h3>
                <MiniBarChart data={monthlyPL} />
              </div>
            )}

            <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-800" data-testid="card-cash-position">
              <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">สุทธิ ลูกหนี้ - เจ้าหนี้</h3>
              <div className="flex items-baseline gap-2">
                <span
                  className="text-2xl font-bold"
                  style={{ color: cashBalance >= 0 ? "#05b187" : "#f94d4d" }}
                  data-testid="text-cash-balance"
                >
                  {cashBalance >= 0 ? "+" : ""}{formatMoneyFull(cashBalance)}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {cashBalance >= 0 ? "ค้างรับมากกว่าค้างจ่าย" : "ค้างจ่ายมากกว่าค้างรับ"}
              </p>
            </div>

            <button
              onClick={() => setLocation("/m/expense-snap")}
              className="w-full flex items-center justify-between bg-gradient-to-r from-[#03c9d7] to-[#05b187] text-white rounded-2xl p-4 shadow-lg active:scale-[0.98] transition-all"
              data-testid="button-go-expense-snap"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl">
                  <Camera className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-sm">Expense Snap</p>
                  <p className="text-xs text-white/80">ถ่ายรูปใบเสร็จ → บันทึกอัตโนมัติ</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-white/60" />
            </button>
          </>
        )}
      </div>
    </MobileLayout>
  );
}

function KpiCard({
  title,
  value,
  fullValue,
  icon,
  color,
  bgColor,
  sparkData,
  testId,
}: {
  title: string;
  value: string;
  fullValue?: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  sparkData?: number[];
  testId: string;
}) {
  const [showFull, setShowFull] = useState(false);

  return (
    <div
      className="bg-white dark:bg-gray-900 rounded-2xl p-3 shadow-sm border border-gray-100 dark:border-gray-800 active:scale-[0.98] transition-all"
      onClick={() => fullValue && setShowFull(!showFull)}
      data-testid={testId}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded-lg" style={{ background: bgColor }}>
          <div style={{ color }}>{icon}</div>
        </div>
        <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 leading-tight">{title}</span>
      </div>
      <p className="text-lg font-bold text-gray-900 dark:text-gray-100 leading-none" style={{ color }}>
        {showFull && fullValue ? fullValue : value}
      </p>
      {sparkData && sparkData.length >= 2 && (
        <div className="mt-2 opacity-60">
          <Sparkline data={sparkData} color={color} height={24} />
        </div>
      )}
    </div>
  );
}

const THAI_MONTHS: Record<string, string> = {
  "01": "ม.ค.", "02": "ก.พ.", "03": "มี.ค.", "04": "เม.ย.",
  "05": "พ.ค.", "06": "มิ.ย.", "07": "ก.ค.", "08": "ส.ค.",
  "09": "ก.ย.", "10": "ต.ค.", "11": "พ.ย.", "12": "ธ.ค.",
};

function MiniBarChart({ data }: { data: any[] }) {
  const maxVal = Math.max(...data.map((d: any) => Math.max(d.revenue || 0, d.expense || 0)), 1);

  return (
    <div className="flex items-end gap-1.5 h-28 overflow-x-auto">
      {data.map((d: any, i: number) => {
        const monthNum = d.month?.split("-")[1] || "";
        const label = THAI_MONTHS[monthNum] || d.month;
        const revPct = ((d.revenue || 0) / maxVal) * 100;
        const expPct = ((d.expense || 0) / maxVal) * 100;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-0.5 min-w-[32px]" data-testid={`mini-bar-${i}`}>
            <div className="w-full flex gap-0.5 items-end justify-center" style={{ height: 80 }}>
              <div
                className="w-3 rounded-t-sm"
                style={{ background: "#03c9d7", height: `${Math.max(revPct, 3)}%` }}
              />
              <div
                className="w-3 rounded-t-sm"
                style={{ background: "#fb9678", height: `${Math.max(expPct, 3)}%` }}
              />
            </div>
            <span className="text-[9px] text-gray-400">{label}</span>
          </div>
        );
      })}
    </div>
  );
}
