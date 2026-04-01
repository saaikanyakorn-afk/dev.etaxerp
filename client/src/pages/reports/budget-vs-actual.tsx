import { useState, useMemo } from "react";
import ReportLayout from "@/components/report-layout";
import { useCompany } from "@/lib/company-context";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart3, FileDown, RefreshCw, AlertTriangle, Printer } from "lucide-react";
import * as XLSX from "xlsx";
import { useLanguage } from "@/hooks/use-language";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
  ReferenceLine,
} from "recharts";

const MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const QUARTERS = ["Q1", "Q2", "Q3", "Q4"];

function fmt(val: number): string {
  if (val === 0) return "-";
  return val.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(val: number): string {
  if (val === 0) return "-";
  return val.toFixed(1) + "%";
}

function varianceColor(variance: number, type: string): string {
  if (variance === 0) return "";
  if (type === "expense") {
    return variance > 0 ? "text-green-600" : "text-red-600";
  }
  return variance >= 0 ? "text-green-600" : "text-red-600";
}

interface MonthlyData {
  month: number;
  budget: number;
  actual: number;
  variance: number;
  variancePct: number;
}

interface ReportLine {
  accountCode: string;
  accountName: string;
  accountNameTh: string | null;
  accountType: string;
  monthly: MonthlyData[];
  totalBudget: number;
  totalActual: number;
  totalVariance: number;
  totalVariancePct: number;
}

interface BudgetReport {
  revenues: ReportLine[];
  expenses: ReportLine[];
  alerts: {
    level: string;
    accountCode: string;
    accountName: string;
    month: number;
    budget: number;
    actual: number;
    usagePct: number;
    message: string;
  }[];
  year: number;
}

function aggregateQuarterly(monthly: MonthlyData[]): { label: string; budget: number; actual: number; variance: number; variancePct: number }[] {
  return QUARTERS.map((label, qi) => {
    const start = qi * 3;
    const months = monthly.slice(start, start + 3);
    const budget = months.reduce((s, m) => s + m.budget, 0);
    const actual = months.reduce((s, m) => s + m.actual, 0);
    const variance = budget - actual;
    const variancePct = budget !== 0 ? (variance / Math.abs(budget)) * 100 : 0;
    return { label, budget, actual, variance, variancePct };
  });
}

export default function BudgetVsActual() {
  const { selectedCompany } = useCompany();
  const { acctName } = useLanguage();
  const companyId = selectedCompany?.id;
  const params = new URLSearchParams(window.location.search);
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(Number(params.get("year")) || currentYear);
  const [viewMode, setViewMode] = useState<"monthly" | "quarterly" | "yearly">("yearly");
  const [chartSection, setChartSection] = useState<"expense" | "revenue">("expense");

  const { data, isLoading, refetch } = useQuery<BudgetReport>({
    queryKey: ["/api/reports/budget-vs-actual", companyId, year],
    queryFn: async () => {
      const res = await fetch(
        `/api/reports/budget-vs-actual?companyId=${companyId}&year=${year}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to fetch budget report");
      return res.json();
    },
    enabled: !!companyId,
  });

  const revenues = data?.revenues || [];
  const expenses = data?.expenses || [];
  const alerts = data?.alerts || [];

  const dangerAlerts = alerts.filter(a => a.level === "danger");
  const warningAlerts = alerts.filter(a => a.level === "warning");

  const chartData = useMemo(() => {
    const section = chartSection === "expense" ? expenses : revenues;
    return section.map(line => ({
      name: (line.accountNameTh || line.accountName).substring(0, 20),
      code: line.accountCode,
      budget: line.totalBudget,
      actual: line.totalActual,
      variance: line.totalVariance,
    })).filter(d => d.budget > 0 || d.actual > 0).slice(0, 15);
  }, [expenses, revenues, chartSection]);

  const monthlyChartData = useMemo(() => {
    const section = chartSection === "expense" ? expenses : revenues;
    return MONTHS.map((name, idx) => {
      const budget = section.reduce((s, l) => s + (l.monthly[idx]?.budget || 0), 0);
      const actual = section.reduce((s, l) => s + (l.monthly[idx]?.actual || 0), 0);
      return { name, budget, actual, variance: budget - actual };
    });
  }, [expenses, revenues, chartSection]);

  const waterfallData = useMemo(() => {
    const section = chartSection === "expense" ? expenses : revenues;
    const items = section
      .filter(l => l.totalVariance !== 0)
      .sort((a, b) => Math.abs(b.totalVariance) - Math.abs(a.totalVariance))
      .slice(0, 12);

    let cumulative = 0;
    return items.map(line => {
      const v = line.totalVariance;
      const start = cumulative;
      cumulative += v;
      return {
        name: (line.accountNameTh || line.accountName).substring(0, 18),
        positive: v > 0 ? v : 0,
        negative: v < 0 ? Math.abs(v) : 0,
        base: v > 0 ? start : start + v,
        variance: v,
      };
    });
  }, [expenses, revenues, chartSection]);

  const handleExcel = () => {
    const rows: (string | number)[][] = [];
    rows.push(["รายงานงบประมาณเปรียบเทียบยอดจริง", `ปี ${year + 543}`]);
    rows.push([]);

    if (viewMode === "monthly") {
      const header = ["รหัสบัญชี", "ชื่อบัญชี"];
      MONTHS.forEach(m => { header.push(`${m} งบ`, `${m} จริง`, `${m} ผลต่าง`); });
      header.push("รวมงบ", "รวมจริง", "ผลต่าง", "%");
      rows.push(header);
    } else if (viewMode === "quarterly") {
      const header = ["รหัสบัญชี", "ชื่อบัญชี"];
      QUARTERS.forEach(q => { header.push(`${q} งบ`, `${q} จริง`, `${q} ผลต่าง`); });
      header.push("รวมงบ", "รวมจริง", "ผลต่าง", "%");
      rows.push(header);
    } else {
      rows.push(["รหัสบัญชี", "ชื่อบัญชี", "งบประมาณ", "ยอดจริง", "ผลต่าง", "ผลต่าง %"]);
    }

    const addSection = (label: string, lines: ReportLine[]) => {
      rows.push(["", `=== ${label} ===`]);
      for (const line of lines) {
        const row: (string | number)[] = [line.accountCode, line.accountNameTh || line.accountName];
        if (viewMode === "monthly") {
          line.monthly.forEach(md => { row.push(md.budget, md.actual, md.variance); });
        } else if (viewMode === "quarterly") {
          aggregateQuarterly(line.monthly).forEach(qd => { row.push(qd.budget, qd.actual, qd.variance); });
        }
        row.push(line.totalBudget, line.totalActual, line.totalVariance, line.totalVariancePct);
        rows.push(row);
      }
    };

    addSection("รายได้", revenues);
    rows.push([]);
    addSection("ค่าใช้จ่าย", expenses);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "BudgetVsActual");
    XLSX.writeFile(wb, `budget-vs-actual-${year}.xlsx`);
  };

  const yearOptions = [];
  for (let y = currentYear - 3; y <= currentYear + 1; y++) {
    yearOptions.push(y);
  }

  const renderPeriodCells = (line: ReportLine, type: string) => {
    if (viewMode === "monthly") {
      return line.monthly.map((md, i) => (
        <td key={i} className="px-1 py-1.5 text-right" colSpan={1}>
          <div className="text-[10px] text-muted-foreground tabular-nums">{fmt(md.budget)}</div>
          <div className="text-[10px] tabular-nums font-medium">{fmt(md.actual)}</div>
          <div className={`text-[10px] tabular-nums ${varianceColor(md.variance, type)}`}>{fmt(md.variance)}</div>
        </td>
      ));
    }
    if (viewMode === "quarterly") {
      return aggregateQuarterly(line.monthly).map((qd, i) => (
        <td key={i} className="px-1 py-1.5 text-right" colSpan={1}>
          <div className="text-[10px] text-muted-foreground tabular-nums">{fmt(qd.budget)}</div>
          <div className="text-[10px] tabular-nums font-medium">{fmt(qd.actual)}</div>
          <div className={`text-[10px] tabular-nums ${varianceColor(qd.variance, type)}`}>{fmt(qd.variance)}</div>
        </td>
      ));
    }
    return null;
  };

  const renderPeriodHeaders = () => {
    if (viewMode === "monthly") {
      return MONTHS.map((m, i) => (
        <TableHead key={i} className="text-[10px] font-semibold text-center border-l min-w-[80px]">
          <div>{m}</div>
          <div className="text-[8px] text-muted-foreground font-normal">งบ / จริง / ต่าง</div>
        </TableHead>
      ));
    }
    if (viewMode === "quarterly") {
      return QUARTERS.map((q, i) => (
        <TableHead key={i} className="text-[10px] font-semibold text-center border-l min-w-[100px]">
          <div>{q}</div>
          <div className="text-[8px] text-muted-foreground font-normal">งบ / จริง / ต่าง</div>
        </TableHead>
      ));
    }
    return null;
  };

  const renderPeriodTotalCells = (lines: ReportLine[], type: string) => {
    if (viewMode === "monthly") {
      return MONTHS.map((_, i) => {
        const budget = lines.reduce((s, l) => s + (l.monthly[i]?.budget || 0), 0);
        const actual = lines.reduce((s, l) => s + (l.monthly[i]?.actual || 0), 0);
        const variance = budget - actual;
        return (
          <td key={i} className="px-1 py-1.5 text-right bg-blue-50/70">
            <div className="text-[10px] text-muted-foreground tabular-nums font-bold">{fmt(budget)}</div>
            <div className="text-[10px] tabular-nums font-bold">{fmt(actual)}</div>
            <div className={`text-[10px] tabular-nums font-bold ${varianceColor(variance, type)}`}>{fmt(variance)}</div>
          </td>
        );
      });
    }
    if (viewMode === "quarterly") {
      return QUARTERS.map((_, qi) => {
        const start = qi * 3;
        const budget = lines.reduce((s, l) => s + l.monthly.slice(start, start + 3).reduce((ss, m) => ss + m.budget, 0), 0);
        const actual = lines.reduce((s, l) => s + l.monthly.slice(start, start + 3).reduce((ss, m) => ss + m.actual, 0), 0);
        const variance = budget - actual;
        return (
          <td key={qi} className="px-1 py-1.5 text-right bg-blue-50/70">
            <div className="text-[10px] text-muted-foreground tabular-nums font-bold">{fmt(budget)}</div>
            <div className="text-[10px] tabular-nums font-bold">{fmt(actual)}</div>
            <div className={`text-[10px] tabular-nums font-bold ${varianceColor(variance, type)}`}>{fmt(variance)}</div>
          </td>
        );
      });
    }
    return null;
  };

  const periodColCount = viewMode === "monthly" ? 12 : viewMode === "quarterly" ? 4 : 0;
  const totalColCount = 2 + periodColCount + 4;

  const renderSection = (title: string, lines: ReportLine[], type: string) => (
    <div>
      <div className="px-4 py-2 font-bold text-white text-sm" style={{ background: "var(--theme-table-header)" }} data-testid={`header-bva-${type}`}>
        {title}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-blue-50/50">
              <th className="text-left text-xs font-semibold px-2 py-1.5 w-[80px]">รหัส</th>
              <th className="text-left text-xs font-semibold px-2 py-1.5 min-w-[150px]">ชื่อบัญชี</th>
              {renderPeriodHeaders()}
              <th className="text-right text-xs font-semibold px-2 py-1.5 border-l w-[90px]">งบประมาณ</th>
              <th className="text-right text-xs font-semibold px-2 py-1.5 w-[90px]">ยอดจริง</th>
              <th className="text-right text-xs font-semibold px-2 py-1.5 w-[90px]">ผลต่าง</th>
              <th className="text-right text-xs font-semibold px-2 py-1.5 w-[60px]">%</th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr>
                <td colSpan={totalColCount} className="text-center text-sm text-muted-foreground py-6">
                  ไม่มีข้อมูล
                </td>
              </tr>
            ) : (
              lines.map(line => (
                <tr key={line.accountCode} className="hover:bg-blue-50/30 border-b border-gray-100" data-testid={`row-bva-${line.accountCode}`}>
                  <td className="text-xs tabular-nums px-2 py-1.5">{line.accountCode}</td>
                  <td className="text-xs px-2 py-1.5 max-w-[200px] truncate" title={acctName(line)}>{acctName(line)}</td>
                  {renderPeriodCells(line, type)}
                  <td className="text-xs text-right tabular-nums px-2 py-1.5 border-l">{fmt(line.totalBudget)}</td>
                  <td className="text-xs text-right tabular-nums px-2 py-1.5">{fmt(line.totalActual)}</td>
                  <td className={`text-xs text-right tabular-nums font-medium px-2 py-1.5 ${varianceColor(line.totalVariance, type)}`}>
                    {fmt(line.totalVariance)}
                  </td>
                  <td className={`text-xs text-right tabular-nums px-2 py-1.5 ${varianceColor(line.totalVariance, type)}`}>
                    {fmtPct(line.totalVariancePct)}
                  </td>
                </tr>
              ))
            )}
            {lines.length > 0 && (
              <tr className="bg-blue-50/70 font-bold border-t-2 border-blue-200">
                <td colSpan={2} className="text-xs text-right pr-4 px-2 py-1.5">รวม{title}</td>
                {renderPeriodTotalCells(lines, type)}
                <td className="text-xs text-right font-bold tabular-nums px-2 py-1.5 border-l">
                  {fmt(lines.reduce((s, l) => s + l.totalBudget, 0))}
                </td>
                <td className="text-xs text-right font-bold tabular-nums px-2 py-1.5">
                  {fmt(lines.reduce((s, l) => s + l.totalActual, 0))}
                </td>
                <td className={`text-xs text-right font-bold tabular-nums px-2 py-1.5 ${varianceColor(lines.reduce((s, l) => s + l.totalVariance, 0), type)}`}>
                  {fmt(lines.reduce((s, l) => s + l.totalVariance, 0))}
                </td>
                <td className="text-xs text-right font-bold tabular-nums px-2 py-1.5">
                  {(() => {
                    const tb = lines.reduce((s, l) => s + l.totalBudget, 0);
                    const tv = lines.reduce((s, l) => s + l.totalVariance, 0);
                    return tb !== 0 ? fmtPct((tv / Math.abs(tb)) * 100) : "-";
                  })()}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <ReportLayout title="งบประมาณ vs ยอดจริง" icon={<BarChart3 className="h-5 w-5" />}>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
        <div className="flex items-center gap-2">
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-[120px] h-8 text-sm" data-testid="select-bva-year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map(y => (
                <SelectItem key={y} value={String(y)}>ปี {y + 543}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={viewMode} onValueChange={(v: any) => setViewMode(v)}>
            <SelectTrigger className="w-[110px] h-8 text-sm" data-testid="select-view-mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="yearly">รายปี</SelectItem>
              <SelectItem value="quarterly">รายไตรมาส</SelectItem>
              <SelectItem value="monthly">รายเดือน</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-8 text-xs border-green-400 text-green-600 hover:bg-green-50"
            onClick={() => refetch()}
            disabled={isLoading}
            data-testid="button-refresh-bva"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            รีเฟรช
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-8 text-xs border-blue-300 text-blue-600 hover:bg-blue-50"
            onClick={() => window.print()}
            data-testid="button-print-bva"
          >
            <Printer className="h-3.5 w-3.5" />
            พิมพ์
          </Button>
          <Button
            size="sm"
            className="h-8 gap-1.5 text-xs bg-[#05b187] text-white hover:bg-[#049a75] border-none"
            onClick={handleExcel}
            data-testid="button-excel-bva"
          >
            <FileDown className="h-3.5 w-3.5" />
            Excel
          </Button>
        </div>
      </div>

      {(dangerAlerts.length > 0 || warningAlerts.length > 0) && (
        <div className="space-y-2" data-testid="section-alerts">
          {dangerAlerts.length > 0 && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md" data-testid="alert-danger">
              <div className="flex items-center gap-2 font-semibold text-red-700 text-sm mb-1">
                <AlertTriangle className="h-4 w-4" />
                ค่าใช้จ่ายเกินงบประมาณ ({dangerAlerts.length} รายการ)
              </div>
              <ul className="text-xs text-red-600 space-y-0.5 ml-6">
                {dangerAlerts.slice(0, 5).map((a, i) => (
                  <li key={i}>{a.message}</li>
                ))}
                {dangerAlerts.length > 5 && <li>...และอีก {dangerAlerts.length - 5} รายการ</li>}
              </ul>
            </div>
          )}
          {warningAlerts.length > 0 && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md" data-testid="alert-warning">
              <div className="flex items-center gap-2 font-semibold text-yellow-700 text-sm mb-1">
                <AlertTriangle className="h-4 w-4" />
                ค่าใช้จ่ายใกล้เต็มงบ (&gt;80%) ({warningAlerts.length} รายการ)
              </div>
              <ul className="text-xs text-yellow-600 space-y-0.5 ml-6">
                {warningAlerts.slice(0, 5).map((a, i) => (
                  <li key={i}>{a.message}</li>
                ))}
                {warningAlerts.length > 5 && <li>...และอีก {warningAlerts.length - 5} รายการ</li>}
              </ul>
            </div>
          )}
        </div>
      )}

      {chartData.length > 0 && (
        <Card className="border shadow-sm print:hidden" data-testid="section-chart">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">กราฟเปรียบเทียบ งบประมาณ vs ยอดจริง</h3>
              <Select value={chartSection} onValueChange={(v: any) => setChartSection(v)}>
                <SelectTrigger className="w-[120px] h-7 text-xs" data-testid="select-chart-section">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">ค่าใช้จ่าย</SelectItem>
                  <SelectItem value="revenue">รายได้</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-2 text-center">ตามบัญชี</p>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tickFormatter={(v) => (v / 1000).toFixed(0) + "k"} />
                    <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Legend />
                    <Bar dataKey="budget" fill="#93c5fd" name="งบประมาณ" barSize={12} />
                    <Bar dataKey="actual" name="ยอดจริง" barSize={12}>
                      {chartData.map((entry, index) => (
                        <Cell
                          key={index}
                          fill={
                            chartSection === "expense"
                              ? (entry.actual > entry.budget ? "#ef4444" : "#22c55e")
                              : (entry.actual >= entry.budget ? "#22c55e" : "#f59e0b")
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-2 text-center">ตามเดือน</p>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={monthlyChartData} margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tickFormatter={(v) => (v / 1000).toFixed(0) + "k"} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Legend />
                    <Bar dataKey="budget" fill="#93c5fd" name="งบประมาณ" />
                    <Bar dataKey="actual" name="ยอดจริง">
                      {monthlyChartData.map((entry, index) => (
                        <Cell
                          key={index}
                          fill={
                            chartSection === "expense"
                              ? (entry.actual > entry.budget ? "#ef4444" : "#22c55e")
                              : (entry.actual >= entry.budget ? "#22c55e" : "#f59e0b")
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {waterfallData.length > 0 && (
              <div className="mt-4">
                <p className="text-xs text-muted-foreground mb-2 text-center">Variance Waterfall (ผลต่างสะสม)</p>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={waterfallData} margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={-20} textAnchor="end" height={50} />
                    <YAxis tickFormatter={(v) => (v / 1000).toFixed(0) + "k"} />
                    <Tooltip
                      formatter={(value: number, name: string) => {
                        if (name === "base") return [null, null];
                        return [fmt(value), name === "positive" ? "เหลืองบ (Under)" : "เกินงบ (Over)"];
                      }}
                      itemStyle={{ fontSize: 11 }}
                    />
                    <ReferenceLine y={0} stroke="#666" />
                    <Bar dataKey="base" stackId="waterfall" fill="transparent" />
                    <Bar dataKey="positive" stackId="waterfall" fill="#22c55e" name="เหลืองบ (Under)" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="negative" stackId="waterfall" fill="#ef4444" name="เกินงบ (Over)" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="border shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-16 text-center text-muted-foreground" data-testid="text-loading">กำลังโหลด...</div>
          ) : (
            <div className="divide-y">
              {renderSection("รายได้", revenues, "revenue")}
              {renderSection("ค่าใช้จ่าย", expenses, "expense")}

              <div className="px-4 py-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold" data-testid="text-net-variance-label">กำไร(ขาดทุน)สุทธิ</span>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-[10px] text-muted-foreground">งบประมาณ</div>
                      <div className="text-sm font-semibold tabular-nums" data-testid="text-net-budget">
                        {fmt(
                          revenues.reduce((s, r) => s + r.totalBudget, 0) -
                          expenses.reduce((s, r) => s + r.totalBudget, 0)
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-muted-foreground">ยอดจริง</div>
                      <div className={`text-sm font-bold tabular-nums ${
                        (revenues.reduce((s, r) => s + r.totalActual, 0) - expenses.reduce((s, r) => s + r.totalActual, 0)) >= 0
                          ? "text-green-600" : "text-red-600"
                      }`} data-testid="text-net-actual">
                        {fmt(
                          revenues.reduce((s, r) => s + r.totalActual, 0) -
                          expenses.reduce((s, r) => s + r.totalActual, 0)
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </ReportLayout>
  );
}