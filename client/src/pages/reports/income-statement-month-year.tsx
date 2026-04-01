import { useState } from "react";
import ReportLayout from "@/components/report-layout";
import { useCompany } from "@/lib/company-context";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, Printer, ArrowUp, ArrowDown, RefreshCw, FileDown } from "lucide-react";
import * as XLSX from "xlsx";
import { useLocation } from "wouter";
import { useLanguage } from "@/hooks/use-language";
import { apiRequest } from "@/lib/queryClient";

const THAI_MONTHS = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];

function fmt(val: number): string {
  if (val === 0) return "-";
  return val.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pct(val: number): string {
  if (val === 0) return "-";
  return val.toFixed(1) + "%";
}

export default function IncomeStatementMonthYear() {
  const [, navigate] = useLocation();
  const { selectedCompany } = useCompany();
  const { acctName } = useLanguage();
  const companyId = selectedCompany?.id;
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const [year, setYear] = useState(String(currentYear));
  const [month, setMonth] = useState(String(currentMonth));

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/reports/income-statement-month-year", companyId, year, month],
    queryFn: async () => {
      const startMonth = `${year}-${String(month).padStart(2, "0")}-01`;
      const lastDay = new Date(Number(year), Number(month), 0).getDate();
      const endMonth = `${year}-${String(month).padStart(2, "0")}-${lastDay}`;
      const startYear = `${year}-01-01`;
      const endYear = `${year}-12-31`;
      const res = await fetch(`/api/reports/income-statement-compare?companyId=${companyId}&startDate1=${startMonth}&endDate1=${endMonth}&startDate2=${startYear}&endDate2=${endYear}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!companyId,
  });

  const handleExcel = () => {
    if (!data) return;
    const rows: any[][] = [["รหัส", "ชื่อบัญชี", `${THAI_MONTHS[Number(month) - 1]}`, "ทั้งปี", "ผลต่าง"]];
    data.revenues?.forEach((r: any) => rows.push([r.code, acctName(r), r.period1, r.period2, r.change]));
    rows.push(["", "รวมรายได้", data.totalRevenue?.period1, data.totalRevenue?.period2, data.totalRevenue?.change]);
    data.expenses?.forEach((r: any) => rows.push([r.code, acctName(r), r.period1, r.period2, r.change]));
    rows.push(["", "รวมค่าใช้จ่าย", data.totalExpense?.period1, data.totalExpense?.period2, data.totalExpense?.change]);
    rows.push(["", "กำไรสุทธิ", data.netIncome?.period1, data.netIncome?.period2, data.netIncome?.change]);
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "MonthVsYear");
    XLSX.writeFile(wb, `income-statement-month-year-${year}-${month}.xlsx`);
  };

  const icon = (val: number) => {
    if (val > 0) return <ArrowUp className="h-3 w-3 text-green-500 inline" />;
    if (val < 0) return <ArrowDown className="h-3 w-3 text-red-500 inline" />;
    return null;
  };

  const periodLabel = `${THAI_MONTHS[Number(month) - 1]} ${Number(year) + 543}`;

  return (
    <ReportLayout fullWidth title="งบกำไร/ขาดทุนเปรียบเทียบ เดือน/ปี" icon={<TrendingUp className="h-5 w-5" />}>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
        <div className="flex items-center gap-2">
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-32" data-testid="select-month"><SelectValue /></SelectTrigger>
            <SelectContent>
              {THAI_MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
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
        <Card className="border-0 shadow-md">
          <CardContent className="p-0">
            <div className="text-center py-4">
              <h2 className="text-lg font-bold">{selectedCompany?.name}</h2>
              <p className="text-sm text-muted-foreground">งบกำไร/ขาดทุนเปรียบเทียบ เดือน {periodLabel} vs ทั้งปี {Number(year) + 543}</p>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="w-[60px] text-xs">รหัส</TableHead>
                  <TableHead className="text-xs">รายการ</TableHead>
                  <TableHead className="text-right text-xs">เดือน {THAI_MONTHS[Number(month) - 1].slice(0, 3)}.</TableHead>
                  <TableHead className="text-right text-xs">ทั้งปี {Number(year) + 543}</TableHead>
                  <TableHead className="text-right text-xs">% ของปี</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow><TableCell colSpan={5} className="bg-[#03c9d7] text-white font-bold text-sm py-1">รายได้</TableCell></TableRow>
                {data.revenues?.map((r: any) => (
                  <TableRow key={r.code}>
                    <TableCell className="text-xs font-mono text-gray-400">{r.code}</TableCell>
                    <TableCell className="text-sm">{acctName(r)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{fmt(r.period1)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{fmt(r.period2)}</TableCell>
                    <TableCell className="text-right font-mono text-sm text-muted-foreground">{r.period2 !== 0 ? pct((r.period1 / Math.abs(r.period2)) * 100) : "-"}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-gray-50 font-semibold">
                  <TableCell></TableCell>
                  <TableCell>รวมรายได้</TableCell>
                  <TableCell className="text-right font-mono text-sm">{fmt(data.totalRevenue?.period1)}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{fmt(data.totalRevenue?.period2)}</TableCell>
                  <TableCell className="text-right font-mono text-sm text-muted-foreground">{data.totalRevenue?.period2 !== 0 ? pct((data.totalRevenue.period1 / Math.abs(data.totalRevenue.period2)) * 100) : "-"}</TableCell>
                </TableRow>
                <TableRow><TableCell colSpan={5} className="bg-[#fb9678] text-white font-bold text-sm py-1">ค่าใช้จ่าย</TableCell></TableRow>
                {data.expenses?.map((r: any) => (
                  <TableRow key={r.code}>
                    <TableCell className="text-xs font-mono text-gray-400">{r.code}</TableCell>
                    <TableCell className="text-sm">{acctName(r)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{fmt(r.period1)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{fmt(r.period2)}</TableCell>
                    <TableCell className="text-right font-mono text-sm text-muted-foreground">{r.period2 !== 0 ? pct((r.period1 / Math.abs(r.period2)) * 100) : "-"}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-gray-50 font-semibold">
                  <TableCell></TableCell>
                  <TableCell>รวมค่าใช้จ่าย</TableCell>
                  <TableCell className="text-right font-mono text-sm">{fmt(data.totalExpense?.period1)}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{fmt(data.totalExpense?.period2)}</TableCell>
                  <TableCell className="text-right font-mono text-sm text-muted-foreground">{data.totalExpense?.period2 !== 0 ? pct((data.totalExpense.period1 / Math.abs(data.totalExpense.period2)) * 100) : "-"}</TableCell>
                </TableRow>
                <TableRow className="bg-gray-100 font-bold">
                  <TableCell></TableCell>
                  <TableCell>กำไร(ขาดทุน)สุทธิ</TableCell>
                  <TableCell className={`text-right font-mono text-sm ${data.netIncome?.period1 >= 0 ? "text-green-600" : "text-red-500"}`}>{fmt(data.netIncome?.period1)}</TableCell>
                  <TableCell className={`text-right font-mono text-sm ${data.netIncome?.period2 >= 0 ? "text-green-600" : "text-red-500"}`}>{fmt(data.netIncome?.period2)}</TableCell>
                  <TableCell className="text-right font-mono text-sm text-muted-foreground">{data.netIncome?.period2 !== 0 ? pct((data.netIncome.period1 / Math.abs(data.netIncome.period2)) * 100) : "-"}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <div className="text-center py-12 text-muted-foreground">กรุณาเลือกเดือนและปี</div>
      )}
    </ReportLayout>
  );
}