import { useState } from "react";
import ReportLayout from "@/components/report-layout";
import { useCompany } from "@/lib/company-context";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, Printer, RefreshCw, FileDown } from "lucide-react";
import * as XLSX from "xlsx";
import { useLocation } from "wouter";

const THAI_MONTHS_SHORT = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];

function fmt(val: number): string {
  if (val === 0) return "-";
  return val.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function IncomeStatement12Month() {
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

  const handleExcel = () => {
    if (!data?.months) return;
    const rows: any[][] = [["รายการ", ...THAI_MONTHS_SHORT, "รวมทั้งปี"]];
    const totalRev = data.months.reduce((s: number, m: any) => s + m.totalRevenue, 0);
    const totalExp = data.months.reduce((s: number, m: any) => s + m.totalExpense, 0);
    rows.push(["รายได้รวม", ...data.months.map((m: any) => m.totalRevenue), totalRev]);
    rows.push(["ค่าใช้จ่ายรวม", ...data.months.map((m: any) => m.totalExpense), totalExp]);
    rows.push(["กำไร(ขาดทุน)สุทธิ", ...data.months.map((m: any) => m.netIncome), totalRev - totalExp]);
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "PL-12Month");
    XLSX.writeFile(wb, `income-statement-12month-${year}.xlsx`);
  };

  const totalRev = data?.months?.reduce((s: number, m: any) => s + m.totalRevenue, 0) || 0;
  const totalExp = data?.months?.reduce((s: number, m: any) => s + m.totalExpense, 0) || 0;

  return (
    <ReportLayout fullWidth title="งบกำไร/ขาดทุนเปรียบเทียบ 12 เดือน" icon={<TrendingUp className="h-5 w-5" />}>
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
        <Card className="border-0 shadow-md">
          <CardContent className="p-0">
            <div className="text-center py-4">
              <h2 className="text-lg font-bold">{selectedCompany?.name}</h2>
              <p className="text-sm text-muted-foreground">งบกำไร/ขาดทุนเปรียบเทียบ 12 เดือน — ปี {Number(year) + 543}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[900px]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-2 text-xs sticky left-0 bg-gray-50 z-10">รายการ</th>
                    {THAI_MONTHS_SHORT.map(m => <th key={m} className="text-right p-2 text-xs whitespace-nowrap">{m}</th>)}
                    <th className="text-right p-2 text-xs font-bold bg-blue-50">รวม</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-[#03c9d7]/10 font-semibold">
                    <td className="p-2 sticky left-0 bg-[#03c9d7]/10 z-10">รายได้รวม</td>
                    {data.months?.map((m: any, i: number) => (
                      <td key={i} className="p-2 text-right font-mono text-xs">{fmt(m.totalRevenue)}</td>
                    ))}
                    <td className="p-2 text-right font-mono text-xs font-bold bg-blue-50">{fmt(totalRev)}</td>
                  </tr>
                  <tr className="bg-[#fb9678]/10 font-semibold">
                    <td className="p-2 sticky left-0 bg-[#fb9678]/10 z-10">ค่าใช้จ่ายรวม</td>
                    {data.months?.map((m: any, i: number) => (
                      <td key={i} className="p-2 text-right font-mono text-xs">{fmt(m.totalExpense)}</td>
                    ))}
                    <td className="p-2 text-right font-mono text-xs font-bold bg-blue-50">{fmt(totalExp)}</td>
                  </tr>
                  <tr className="bg-gray-100 font-bold border-t-2">
                    <td className="p-2 sticky left-0 bg-gray-100 z-10">กำไร(ขาดทุน)สุทธิ</td>
                    {data.months?.map((m: any, i: number) => (
                      <td key={i} className={`p-2 text-right font-mono text-xs ${m.netIncome >= 0 ? "text-green-600" : "text-red-500"}`}>{fmt(m.netIncome)}</td>
                    ))}
                    <td className={`p-2 text-right font-mono text-xs font-bold bg-blue-50 ${totalRev - totalExp >= 0 ? "text-green-600" : "text-red-500"}`}>{fmt(totalRev - totalExp)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {data.accountDetails && (
              <div className="overflow-x-auto border-t mt-4">
                <table className="w-full text-sm min-w-[900px]">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-2 text-xs sticky left-0 bg-gray-50 z-10">รหัส — ชื่อบัญชี</th>
                      {THAI_MONTHS_SHORT.map(m => <th key={m} className="text-right p-2 text-xs whitespace-nowrap">{m}</th>)}
                      <th className="text-right p-2 text-xs font-bold bg-blue-50">รวม</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td colSpan={14} className="bg-[#03c9d7] text-white font-bold text-xs p-1">รายได้</td></tr>
                    {data.accountDetails.filter((a: any) => a.type === "revenue").map((a: any) => (
                      <tr key={a.code} className="border-t hover:bg-slate-50">
                        <td className="p-1.5 text-xs sticky left-0 bg-white z-10">{a.code} {a.name}</td>
                        {a.months.map((v: number, i: number) => <td key={i} className="p-1.5 text-right font-mono text-xs">{fmt(v)}</td>)}
                        <td className="p-1.5 text-right font-mono text-xs font-bold bg-blue-50">{fmt(a.total)}</td>
                      </tr>
                    ))}
                    <tr><td colSpan={14} className="bg-[#fb9678] text-white font-bold text-xs p-1">ค่าใช้จ่าย</td></tr>
                    {data.accountDetails.filter((a: any) => a.type === "expense").map((a: any) => (
                      <tr key={a.code} className="border-t hover:bg-slate-50">
                        <td className="p-1.5 text-xs sticky left-0 bg-white z-10">{a.code} {a.name}</td>
                        {a.months.map((v: number, i: number) => <td key={i} className="p-1.5 text-right font-mono text-xs">{fmt(v)}</td>)}
                        <td className="p-1.5 text-right font-mono text-xs font-bold bg-blue-50">{fmt(a.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="text-center py-12 text-muted-foreground">กรุณาเลือกปี</div>
      )}
    </ReportLayout>
  );
}