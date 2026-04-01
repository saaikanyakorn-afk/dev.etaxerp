import { useState } from "react";
import ReportLayout from "@/components/report-layout";
import { useCompany } from "@/lib/company-context";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3, Printer, RefreshCw, FileDown } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
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

export default function BalanceSheet12MonthChart() {
  const [, navigate] = useLocation();
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear));

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/reports/balance-sheet-monthly", companyId, year],
    queryFn: async () => {
      const res = await fetch(`/api/reports/balance-sheet-monthly?companyId=${companyId}&year=${year}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!companyId,
  });

  const chartData = data?.months?.map((m: any) => ({
    name: THAI_MONTHS_SHORT[m.month - 1],
    สินทรัพย์: m.totalAssets,
    หนี้สิน: m.totalLiabilities,
    ส่วนของผู้ถือหุ้น: m.totalEquity,
  })) || [];

  const handleExcel = () => {
    if (!data?.months) return;
    const rows: any[][] = [["เดือน", "สินทรัพย์", "หนี้สิน", "ส่วนของผู้ถือหุ้น"]];
    data.months.forEach((m: any) => rows.push([THAI_MONTHS_SHORT[m.month - 1], m.totalAssets, m.totalLiabilities, m.totalEquity]));
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "BS-12Month");
    XLSX.writeFile(wb, `balance-sheet-12month-${year}.xlsx`);
  };

  return (
    <ReportLayout fullWidth title="งบดุลเปรียบเทียบ 12 เดือน (Plot)" icon={<BarChart3 className="h-5 w-5" />}>
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
        <>
          <Card className="border-0 shadow-md">
            <CardContent className="p-4">
              <div className="text-center mb-4">
                <h2 className="text-lg font-bold">{selectedCompany?.name}</h2>
                <p className="text-sm text-muted-foreground">งบแสดงฐานะทางการเงินเปรียบเทียบ 12 เดือน — ปี {Number(year) + 543}</p>
              </div>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={fmtM} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Legend />
                    <Line type="monotone" dataKey="สินทรัพย์" stroke="#03c9d7" strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="หนี้สิน" stroke="#fb9678" strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="ส่วนของผู้ถือหุ้น" stroke="#05b187" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-2 text-xs">เดือน</th>
                    <th className="text-right p-2 text-xs">สินทรัพย์</th>
                    <th className="text-right p-2 text-xs">หนี้สิน</th>
                    <th className="text-right p-2 text-xs">ส่วนของผู้ถือหุ้น</th>
                  </tr>
                </thead>
                <tbody>
                  {data.months?.map((m: any) => (
                    <tr key={m.month} className="border-t hover:bg-slate-50">
                      <td className="p-2">{THAI_MONTHS_SHORT[m.month - 1]}</td>
                      <td className="p-2 text-right font-mono">{fmt(m.totalAssets)}</td>
                      <td className="p-2 text-right font-mono">{fmt(m.totalLiabilities)}</td>
                      <td className="p-2 text-right font-mono">{fmt(m.totalEquity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      ) : (
        <div className="text-center py-12 text-muted-foreground">กรุณาเลือกปี</div>
      )}
    </ReportLayout>
  );
}