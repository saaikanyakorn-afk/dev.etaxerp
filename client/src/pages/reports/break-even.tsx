import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import ReportLayout from "@/components/report-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Target, Calculator, Printer, FileDown, DollarSign, TrendingUp, Shield, BarChart3 } from "lucide-react";
import * as XLSX from "xlsx";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ReferenceLine, Area, ComposedChart
} from "recharts";

function fmt(val: number | string | null | undefined): string {
  const n = parseFloat(String(val || "0"));
  if (n === 0) return "-";
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtInt(val: number | null | undefined): string {
  if (val == null) return "-";
  return Math.round(val).toLocaleString("th-TH");
}

export default function BreakEvenReport() {
  const [fixedCosts, setFixedCosts] = useState("100000");
  const [variableCostPerUnit, setVariableCostPerUnit] = useState("50");
  const [sellingPricePerUnit, setSellingPricePerUnit] = useState("100");
  const [currentSalesUnits, setCurrentSalesUnits] = useState("3000");

  const mutation = useMutation({
    mutationFn: async (params: any) => {
      const res = await fetch("/api/reports/break-even", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(params),
      });
      if (!res.ok) throw new Error("Failed to calculate break-even");
      return res.json();
    },
  });

  const handleCalculate = () => {
    mutation.mutate({
      fixedCosts: Number(fixedCosts),
      variableCostPerUnit: Number(variableCostPerUnit),
      sellingPricePerUnit: Number(sellingPricePerUnit),
      currentSalesUnits: Number(currentSalesUnits),
    });
  };

  const result = mutation.data;

  const handleExcel = () => {
    if (!result) return;
    const rows: (string | number)[][] = [];
    rows.push(["Break-Even Analysis"]);
    rows.push([]);
    rows.push(["ต้นทุนคงที่", Number(fixedCosts)]);
    rows.push(["ต้นทุนผันแปรต่อหน่วย", Number(variableCostPerUnit)]);
    rows.push(["ราคาขายต่อหน่วย", Number(sellingPricePerUnit)]);
    rows.push(["ยอดขายปัจจุบัน (หน่วย)", Number(currentSalesUnits)]);
    rows.push([]);
    rows.push(["จุดคุ้มทุน (หน่วย)", result.bepUnits || 0]);
    rows.push(["จุดคุ้มทุน (มูลค่า)", result.bepValue || 0]);
    rows.push(["Contribution Margin", result.contributionMargin || 0]);
    rows.push(["Contribution Margin Ratio %", result.contributionMarginRatio || 0]);
    rows.push(["Margin of Safety", result.marginOfSafety || 0]);
    rows.push(["Margin of Safety %", result.marginOfSafetyRatio || 0]);
    rows.push([]);
    rows.push(["หน่วย", "รายได้", "ต้นทุนรวม", "ต้นทุนคงที่"]);
    (result.chartData || []).forEach((d: any) => rows.push([d.units, d.revenue, d.totalCost, d.fixedCost]));
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "BreakEven");
    XLSX.writeFile(wb, "break-even-analysis.xlsx");
  };

  const summaryCards = result ? [
    { label: "จุดคุ้มทุน (หน่วย)", value: fmtInt(result.bepUnits), icon: Target, color: "text-[#539BFF]", bg: "bg-blue-50" },
    { label: "จุดคุ้มทุน (มูลค่า)", value: fmt(result.bepValue), icon: DollarSign, color: "text-[#05b187]", bg: "bg-emerald-50" },
    { label: "Contribution Margin / หน่วย", value: fmt(result.contributionMargin), icon: TrendingUp, color: "text-[#fb9678]", bg: "bg-orange-50" },
    { label: "CM Ratio", value: `${(result.contributionMarginRatio || 0).toFixed(1)}%`, icon: BarChart3, color: "text-[#03c9d7]", bg: "bg-cyan-50" },
    { label: "Margin of Safety", value: fmt(result.marginOfSafety), icon: Shield, color: "text-purple-600", bg: "bg-purple-50" },
    { label: "Margin of Safety %", value: `${(result.marginOfSafetyRatio || 0).toFixed(1)}%`, icon: Shield, color: "text-indigo-600", bg: "bg-indigo-50" },
  ] : [];

  return (
    <ReportLayout title="Break-Even Analysis" subtitle="วิเคราะห์จุดคุ้มทุน" icon={<Target className="h-5 w-5" />}>
      <div className="flex items-center justify-end flex-wrap gap-2 mb-2">
        <Button variant="outline" size="sm" className="gap-1.5 border-blue-300 text-blue-600 hover:bg-blue-50" onClick={() => window.print()} data-testid="button-print">
          <Printer className="h-4 w-4" /> พิมพ์
        </Button>
        {result && (
          <Button size="sm" className="h-8 gap-1.5 text-xs bg-[#05b187] text-white hover:bg-[#049a75] border-none" onClick={handleExcel} data-testid="button-excel">
            <FileDown className="h-4 w-4" /> Excel
          </Button>
        )}
      </div>

      <Card className="border shadow-sm print:hidden" data-testid="card-input-form">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Calculator className="h-4 w-4" /> กำหนดข้อมูลสำหรับคำนวณ
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">ต้นทุนคงที่ (Fixed Costs)</label>
              <Input
                type="number"
                value={fixedCosts}
                onChange={e => setFixedCosts(e.target.value)}
                placeholder="100,000"
                data-testid="input-fixed-costs"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">ต้นทุนผันแปร / หน่วย</label>
              <Input
                type="number"
                value={variableCostPerUnit}
                onChange={e => setVariableCostPerUnit(e.target.value)}
                placeholder="50"
                data-testid="input-variable-cost"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">ราคาขาย / หน่วย</label>
              <Input
                type="number"
                value={sellingPricePerUnit}
                onChange={e => setSellingPricePerUnit(e.target.value)}
                placeholder="100"
                data-testid="input-selling-price"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">ยอดขายปัจจุบัน (หน่วย)</label>
              <Input
                type="number"
                value={currentSalesUnits}
                onChange={e => setCurrentSalesUnits(e.target.value)}
                placeholder="3,000"
                data-testid="input-current-sales"
              />
            </div>
          </div>
          <div className="mt-4">
            <Button
              onClick={handleCalculate}
              disabled={mutation.isPending}
              className="gap-2 bg-[var(--theme-primary)] hover:bg-[var(--theme-primary)]/90"
              data-testid="button-calculate"
            >
              <Calculator className="h-4 w-4" />
              {mutation.isPending ? "กำลังคำนวณ..." : "คำนวณจุดคุ้มทุน"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {result?.error && (
        <Card className="border border-red-200 bg-red-50" data-testid="card-error">
          <CardContent className="py-4 text-center text-red-600 text-sm">{result.error}</CardContent>
        </Card>
      )}

      {result && !result.error && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {summaryCards.map((card, idx) => (
              <Card key={idx} className="border shadow-sm" data-testid={`card-summary-${idx}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-muted-foreground leading-tight">{card.label}</span>
                    <div className={`w-7 h-7 rounded-full ${card.bg} flex items-center justify-center`}>
                      <card.icon className={`h-3.5 w-3.5 ${card.color}`} />
                    </div>
                  </div>
                  <div className={`text-lg font-bold tabular-nums ${card.color}`}>{card.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="border shadow-sm" data-testid="card-bep-chart">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">กราฟจุดคุ้มทุน (Break-Even Point)</CardTitle>
            </CardHeader>
            <CardContent>
              {result.chartData && result.chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <ComposedChart data={result.chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="units"
                      tick={{ fontSize: 11 }}
                      label={{ value: "จำนวนหน่วย", position: "insideBottom", offset: -5, fontSize: 12 }}
                    />
                    <YAxis
                      tickFormatter={(v: number) => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : String(v)}
                      tick={{ fontSize: 11 }}
                      label={{ value: "จำนวนเงิน (บาท)", angle: -90, position: "insideLeft", fontSize: 12 }}
                    />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Legend />
                    <Line type="monotone" dataKey="revenue" name="รายได้" stroke="#05b187" strokeWidth={2.5} dot={false} />
                    <Line type="monotone" dataKey="totalCost" name="ต้นทุนรวม" stroke="#fb9678" strokeWidth={2.5} dot={false} />
                    <Line type="monotone" dataKey="fixedCost" name="ต้นทุนคงที่" stroke="#539BFF" strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
                    {result.bepUnits && (
                      <ReferenceLine x={result.bepUnits} stroke="#e74c3c" strokeDasharray="3 3" label={{ value: `BEP: ${fmtInt(result.bepUnits)} หน่วย`, position: "top", fontSize: 11 }} />
                    )}
                    {result.currentSalesUnits > 0 && (
                      <ReferenceLine x={result.currentSalesUnits} stroke="#8b5cf6" strokeDasharray="3 3" label={{ value: `ปัจจุบัน: ${fmtInt(result.currentSalesUnits)}`, position: "top", fontSize: 11 }} />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="py-12 text-center text-muted-foreground text-sm">ไม่มีข้อมูลกราฟ</div>
              )}
            </CardContent>
          </Card>

          {result.currentSalesUnits > 0 && (
            <Card className="border shadow-sm" data-testid="card-current-analysis">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">วิเคราะห์สถานะปัจจุบัน</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground text-xs mb-1">ยอดขายปัจจุบัน</div>
                    <div className="font-bold tabular-nums">{fmtInt(result.currentSalesUnits)} หน่วย</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs mb-1">รายได้</div>
                    <div className="font-bold tabular-nums text-green-600">{fmt(result.currentRevenue)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs mb-1">ต้นทุนรวม</div>
                    <div className="font-bold tabular-nums text-orange-600">{fmt(result.currentTotalCost)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs mb-1">กำไร(ขาดทุน)</div>
                    <div className={`font-bold tabular-nums ${result.currentProfit >= 0 ? "text-green-600" : "text-red-500"}`}>
                      {fmt(result.currentProfit)}
                    </div>
                  </div>
                </div>
                <div className="mt-3 p-3 rounded bg-slate-50 text-sm">
                  {result.currentSalesUnits > result.bepUnits ? (
                    <span className="text-green-700">
                      ยอดขายปัจจุบันสูงกว่าจุดคุ้มทุน {fmtInt(result.currentSalesUnits - result.bepUnits)} หน่วย — ธุรกิจมีกำไร
                    </span>
                  ) : result.currentSalesUnits === result.bepUnits ? (
                    <span className="text-amber-700">ยอดขายปัจจุบันอยู่ที่จุดคุ้มทุนพอดี</span>
                  ) : (
                    <span className="text-red-700">
                      ยอดขายปัจจุบันต่ำกว่าจุดคุ้มทุน {fmtInt(result.bepUnits - result.currentSalesUnits)} หน่วย — ธุรกิจขาดทุน
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </ReportLayout>
  );
}
