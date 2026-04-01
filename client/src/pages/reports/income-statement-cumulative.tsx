import { useState } from "react";
import ReportLayout from "@/components/report-layout";
import { useCompany } from "@/lib/company-context";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, Printer, RefreshCw, FileDown } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import * as XLSX from "xlsx";
import { useLocation } from "wouter";

const THAI_MONTHS_SHORT = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];

function fmt(val: number): string {
  if (val === 0) return "-";
  return val.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtM(val: number): string {
  if (Math.abs(val) >= 1_000_000) return (val / 1_000_000).toFixed(1) + "M";
  if (Math.abs(val) >= 1_000) return (val / 1_000).toFixed(0) + "K";
  return val.toFixed(0);
}

export default function IncomeStatementCumulative() {
  const [, navigate] = useLocation();
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear));

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/reports/income-statement-monthly", companyId, year],
    queryFn: async () => {
      const res = await fetch(`/api/reports/income-statement-monthly?companyId=${companyId}&year=${year}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!companyId,
  });

  let cumRevenue = 0, cumExpense = 0;
  const cumData = data?.months?.map((m: any) => {
    cumRevenue += m.totalRevenue;
    cumExpense += m.totalExpense;
    return {
      name: THAI_MONTHS_SHORT[m.month - 1],
      month: m.month,
      revenue: m.totalRevenue,
      expense: m.totalExpense,
      netIncome: m.netIncome,
      cumRevenue,
      cumExpense,
      cumNetIncome: cumRevenue - cumExpense,
    };
  }) || [];

  const handleExcel = () => {
    const rows: any[][] = [["เดือน", "รายได้เดือน", "ค่าใช้จ่ายเดือน", "กำไรเดือน", "รายได้สะสม", "ค่าใช้จ่ายสะสม", "กำไรสะสม"]];
    cumData.forEach((m: any) => rows.push([m.name, m.revenue, m.expense, m.netIncome, m.cumRevenue, m.cumExpense, m.cumNetIncome]));
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "PL-Cumulative");
    XLSX.writeFile(wb, `income-statement-cumulative-${year}.xlsx`);
  };

  return (
    <ReportLayout fullWidth title="งบกำไร/ขาดทุนเปรียบเทียบเดือน (สะสม)" icon={<TrendingUp className="h-5 w-5" />}>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-28" data-testid="select-year"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Array.from({ length: 5 }, (_, i) => currentYear - i).map(y => (
              <SelectItem key={y} value={String(y)}>{y + 543}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate("/reports/general")} data-testid="button-back">กลับรายงาน</Button>
          <Button variant="outline" size="sm" className="border-green-400 text-green-600 hover:bg-green-50" onClick={() => refetch()} disabled={isLoading} data-testid="button-generate">
            <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? "animate-spin" : ""}`} /> สร้างรายงาน
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()} data-testid="button-print"><Printer className="h-4 w-4 mr-1" /> พิมพ์</Button>
          <Button size="sm" className="h-8 gap-1.5 text-xs bg-[#05b187] text-white hover:bg-[#049a75] border-none" onClick={handleExcel} data-testid="button-excel"><FileDown className="h-4 w-4" /> Excel</Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">กำลังโหลด...</div>
      ) : data ? (
        <>
          <Card className="border-0 shadow-md">
            <CardContent className="p-4">
              <div className="text-center mb-4">
                <h2 className="text-lg font-bold">{selectedCompany?.name}</h2>
                <p className="text-sm text-muted-foreground">งบกำไร/ขาดทุนสะสม — ปี {Number(year) + 543}</p>
              </div>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={cumData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={fmtM} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Legend />
                    <Area type="monotone" dataKey="cumRevenue" name="รายได้สะสม" stroke="#03c9d7" fill="#03c9d7" fillOpacity={0.2} strokeWidth={2} />
                    <Area type="monotone" dataKey="cumExpense" name="ค่าใช้จ่ายสะสม" stroke="#fb9678" fill="#fb9678" fillOpacity={0.2} strokeWidth={2} />
                    <Area type="monotone" dataKey="cumNetIncome" name="กำไรสะสม" stroke="#05b187" fill="#05b187" fillOpacity={0.3} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-2 text-xs">เดือน</th>
                      <th className="text-right p-2 text-xs">รายได้</th>
                      <th className="text-right p-2 text-xs">ค่าใช้จ่าย</th>
                      <th className="text-right p-2 text-xs">กำไร/ขาดทุน</th>
                      <th className="text-right p-2 text-xs bg-blue-50">รายได้สะสม</th>
                      <th className="text-right p-2 text-xs bg-blue-50">ค่าใช้จ่ายสะสม</th>
                      <th className="text-right p-2 text-xs bg-blue-50">กำไรสะสม</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cumData.map((m: any) => (
                      <tr key={m.month} className="border-t hover:bg-slate-50">
                        <td className="p-2">{m.name}</td>
                        <td className="p-2 text-right font-mono text-xs">{fmt(m.revenue)}</td>
                        <td className="p-2 text-right font-mono text-xs">{fmt(m.expense)}</td>
                        <td className={`p-2 text-right font-mono text-xs ${m.netIncome >= 0 ? "text-green-600" : "text-red-500"}`}>{fmt(m.netIncome)}</td>
                        <td className="p-2 text-right font-mono text-xs bg-blue-50">{fmt(m.cumRevenue)}</td>
                        <td className="p-2 text-right font-mono text-xs bg-blue-50">{fmt(m.cumExpense)}</td>
                        <td className={`p-2 text-right font-mono text-xs bg-blue-50 font-bold ${m.cumNetIncome >= 0 ? "text-green-600" : "text-red-500"}`}>{fmt(m.cumNetIncome)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <div className="text-center py-12 text-muted-foreground">กรุณาเลือกปี</div>
      )}
    </ReportLayout>
  );
}