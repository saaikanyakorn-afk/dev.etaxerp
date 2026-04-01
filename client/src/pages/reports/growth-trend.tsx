import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ReportLayout from "@/components/report-layout";
import { useCompany } from "@/lib/company-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, Printer, FileDown, RefreshCw, ArrowUp, ArrowDown, Minus } from "lucide-react";
import * as XLSX from "xlsx";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";

function fmt(val: number | string | null | undefined): string {
  const n = parseFloat(String(val || "0"));
  if (n === 0) return "-";
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(val: number | null): string {
  if (val == null) return "-";
  return val.toFixed(2) + "%";
}

const LINE_COLORS = {
  revenueGrowth: "#539BFF",
  profitGrowth: "#05b187",
  assetGrowth: "#fb9678",
  equityGrowth: "#03c9d7",
};

const LINE_LABELS: Record<string, string> = {
  revenueGrowth: "Revenue Growth %",
  profitGrowth: "Net Profit Growth %",
  assetGrowth: "Asset Growth %",
  equityGrowth: "Equity Growth %",
};

export default function GrowthTrendReport() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const [mode, setMode] = useState("quarterly");
  const [periods, setPeriods] = useState("8");

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/reports/growth-trend", companyId, mode, periods],
    queryFn: async () => {
      const res = await fetch(
        `/api/reports/growth-trend?companyId=${companyId}&mode=${mode}&periods=${periods}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to fetch growth trend data");
      return res.json();
    },
    enabled: !!companyId,
  });

  const periodData = data?.periods || [];

  const GrowthIcon = ({ val }: { val: number | null }) => {
    if (val == null) return <Minus className="h-3 w-3 text-gray-400 inline" />;
    if (val > 0) return <ArrowUp className="h-3 w-3 text-green-500 inline" />;
    if (val < 0) return <ArrowDown className="h-3 w-3 text-red-500 inline" />;
    return <Minus className="h-3 w-3 text-gray-400 inline" />;
  };

  const growthColor = (val: number | null) => {
    if (val == null) return "text-gray-400";
    if (val > 0) return "text-green-600";
    if (val < 0) return "text-red-500";
    return "text-gray-600";
  };

  const handleExcel = () => {
    const rows: (string | number | null)[][] = [];
    rows.push(["Growth Trend Analysis"]);
    rows.push([]);
    rows.push(["งวด", "รายได้", "กำไรสุทธิ", "สินทรัพย์", "ส่วนผู้ถือหุ้น", "Revenue Growth %", "Profit Growth %", "Asset Growth %", "Equity Growth %"]);
    periodData.forEach((p: any) => {
      rows.push([p.label, p.revenue, p.netProfit, p.assets, p.equity, p.revenueGrowth, p.profitGrowth, p.assetGrowth, p.equityGrowth]);
    });
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "GrowthTrend");
    XLSX.writeFile(wb, "growth-trend-analysis.xlsx");
  };

  return (
    <ReportLayout title="Growth Trend Analysis" subtitle="วิเคราะห์แนวโน้มการเติบโต" icon={<TrendingUp className="h-5 w-5" />}>
      <div className="flex items-center justify-end flex-wrap gap-2 mb-2">
        <Button variant="outline" size="sm" className="gap-1.5 border-green-400 text-green-600 hover:bg-green-50" onClick={() => refetch()} disabled={isLoading} data-testid="button-generate">
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} /> สร้างรายงาน
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5 border-blue-300 text-blue-600 hover:bg-blue-50" onClick={() => window.print()} data-testid="button-print">
          <Printer className="h-4 w-4" /> พิมพ์
        </Button>
        <Button size="sm" className="h-8 gap-1.5 text-xs bg-[#05b187] text-white hover:bg-[#049a75] border-none" onClick={handleExcel} data-testid="button-excel">
          <FileDown className="h-4 w-4" /> Excel
        </Button>
      </div>

      <div className="flex items-end gap-3 flex-wrap print:hidden">
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">ช่วงเวลา</label>
          <Select value={mode} onValueChange={setMode}>
            <SelectTrigger className="w-[160px] h-9" data-testid="select-mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="quarterly">รายไตรมาส</SelectItem>
              <SelectItem value="yearly">รายปี</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">จำนวนงวด</label>
          <Select value={periods} onValueChange={setPeriods}>
            <SelectTrigger className="w-[120px] h-9" data-testid="select-periods">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="4">4 งวด</SelectItem>
              <SelectItem value="6">6 งวด</SelectItem>
              <SelectItem value="8">8 งวด</SelectItem>
              <SelectItem value="12">12 งวด</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-muted-foreground" data-testid="text-loading">กำลังโหลด...</div>
      ) : (
        <>
          <Card className="border shadow-sm" data-testid="card-growth-chart">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">แนวโน้มอัตราการเติบโต (%)</CardTitle>
            </CardHeader>
            <CardContent>
              {periodData.length > 1 ? (
                <ResponsiveContainer width="100%" height={380}>
                  <LineChart data={periodData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v: number) => `${v.toFixed(0)}%`} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: any) => v != null ? `${Number(v).toFixed(2)}%` : "-"} />
                    <Legend />
                    {Object.entries(LINE_COLORS).map(([key, color]) => (
                      <Line
                        key={key}
                        type="monotone"
                        dataKey={key}
                        name={LINE_LABELS[key]}
                        stroke={color}
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="py-12 text-center text-muted-foreground text-sm">ต้องการข้อมูลอย่างน้อย 2 งวดเพื่อแสดงกราฟ</div>
              )}
            </CardContent>
          </Card>

          <Card className="border shadow-sm" data-testid="card-growth-table">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">ข้อมูลรายงวด</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-100">
                      <TableHead className="text-xs font-semibold">งวด</TableHead>
                      <TableHead className="text-xs text-right font-semibold">รายได้</TableHead>
                      <TableHead className="text-xs text-right font-semibold">กำไรสุทธิ</TableHead>
                      <TableHead className="text-xs text-right font-semibold">สินทรัพย์</TableHead>
                      <TableHead className="text-xs text-right font-semibold">ส่วนผู้ถือหุ้น</TableHead>
                      <TableHead className="text-xs text-right font-semibold">Revenue Growth</TableHead>
                      <TableHead className="text-xs text-right font-semibold">Profit Growth</TableHead>
                      <TableHead className="text-xs text-right font-semibold">Asset Growth</TableHead>
                      <TableHead className="text-xs text-right font-semibold">Equity Growth</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {periodData.length === 0 ? (
                      <TableRow><TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-6">ไม่มีข้อมูล</TableCell></TableRow>
                    ) : periodData.map((p: any, idx: number) => (
                      <TableRow key={idx} data-testid={`row-period-${idx}`}>
                        <TableCell className="text-sm font-medium">{p.label}</TableCell>
                        <TableCell className="text-sm text-right tabular-nums">{fmt(p.revenue)}</TableCell>
                        <TableCell className={`text-sm text-right tabular-nums ${p.netProfit >= 0 ? "text-green-600" : "text-red-500"}`}>{fmt(p.netProfit)}</TableCell>
                        <TableCell className="text-sm text-right tabular-nums">{fmt(p.assets)}</TableCell>
                        <TableCell className="text-sm text-right tabular-nums">{fmt(p.equity)}</TableCell>
                        <TableCell className={`text-sm text-right tabular-nums ${growthColor(p.revenueGrowth)}`}>
                          <GrowthIcon val={p.revenueGrowth} /> {fmtPct(p.revenueGrowth)}
                        </TableCell>
                        <TableCell className={`text-sm text-right tabular-nums ${growthColor(p.profitGrowth)}`}>
                          <GrowthIcon val={p.profitGrowth} /> {fmtPct(p.profitGrowth)}
                        </TableCell>
                        <TableCell className={`text-sm text-right tabular-nums ${growthColor(p.assetGrowth)}`}>
                          <GrowthIcon val={p.assetGrowth} /> {fmtPct(p.assetGrowth)}
                        </TableCell>
                        <TableCell className={`text-sm text-right tabular-nums ${growthColor(p.equityGrowth)}`}>
                          <GrowthIcon val={p.equityGrowth} /> {fmtPct(p.equityGrowth)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </ReportLayout>
  );
}
