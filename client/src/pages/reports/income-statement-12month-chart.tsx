import { useState } from "react";
import ReportLayout from "@/components/report-layout";
import { useCompany } from "@/lib/company-context";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3, Printer, RefreshCw, FileDown } from "lucide-react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
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

export default function IncomeStatement12MonthChart() {
  const [, navigate] = useLocation();
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear));
  const [chartType, setChartType] = useState<"bar" | "line">("bar");

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/reports/income-statement-monthly", companyId, year],
    queryFn: async () => {
      const res = await fetch(`/api/reports/income-statement-monthly?companyId=${companyId}&year=${year}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!companyId,
  });

  const chartData = data?.months?.map((m: any) => ({
    name: THAI_MONTHS_SHORT[m.month - 1],
    รายได้: m.totalRevenue,
    ค่าใช้จ่าย: m.totalExpense,
    กำไรสุทธิ: m.netIncome,
  })) || [];

  const handleExcel = () => {
    if (!data?.months) return;
    const rows: any[][] = [["เดือน", "รายได้", "ค่าใช้จ่าย", "กำไร(ขาดทุน)สุทธิ"]];
    data.months.forEach((m: any) => rows.push([THAI_MONTHS_SHORT[m.month - 1], m.totalRevenue, m.totalExpense, m.netIncome]));
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "PL-12Month-Chart");
    XLSX.writeFile(wb, `income-statement-12month-chart-${year}.xlsx`);
  };

  return (
    <ReportLayout fullWidth title="งบกำไร/ขาดทุนเปรียบเทียบ 12 เดือน (Plot)" icon={<BarChart3 className="h-5 w-5" />}>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
        <div className="flex items-center gap-2">
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-28" data-testid="select-year"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Array.from({ length: 5 }, (_, i) => currentYear - i).map(y => (
                <SelectItem key={y} value={String(y)}>{y + 543}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant={chartType === "bar" ? "default" : "outline"} size="sm" onClick={() => setChartType("bar")} data-testid="btn-chart-bar">แท่ง</Button>
          <Button variant={chartType === "line" ? "default" : "outline"} size="sm" onClick={() => setChartType("line")} data-testid="btn-chart-line">เส้น</Button>
        </div>
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
        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="text-center mb-4">
              <h2 className="text-lg font-bold">{selectedCompany?.name}</h2>
              <p className="text-sm text-muted-foreground">งบกำไร/ขาดทุนเปรียบเทียบ 12 เดือน — ปี {Number(year) + 543}</p>
            </div>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                {chartType === "bar" ? (
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={fmtM} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Legend />
                    <Bar dataKey="รายได้" fill="#03c9d7" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="ค่าใช้จ่าย" fill="#fb9678" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="กำไรสุทธิ" fill="#05b187" radius={[4, 4, 0, 0]} />
                  </BarChart>
                ) : (
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={fmtM} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Legend />
                    <Line type="monotone" dataKey="รายได้" stroke="#03c9d7" strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="ค่าใช้จ่าย" stroke="#fb9678" strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="กำไรสุทธิ" stroke="#05b187" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="text-center py-12 text-muted-foreground">กรุณาเลือกปี</div>
      )}
    </ReportLayout>
  );
}