import { useState } from "react";
import ReportLayout from "@/components/report-layout";
import { useCompany } from "@/lib/company-context";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, Printer, RefreshCw, FileDown } from "lucide-react";
import * as XLSX from "xlsx";
import ThaiDateInput from "@/components/thai-date-input";
import { useLocation } from "wouter";
import { toLocalDateStr } from "@/lib/utils";
import { useLanguage } from "@/hooks/use-language";
import { useDateSettings } from "@/hooks/use-date-settings";

interface CompareRow { code: string; name: string; nameTh?: string; period1: number; period2: number; change: number; changePct: number; }
interface TotalRow { period1: number; period2: number; change: number; changePct: number; }
interface CompareData { revenues: CompareRow[]; expenses: CompareRow[]; totalRevenue: TotalRow; totalExpense: TotalRow; netIncome: TotalRow; }

function fmt(val: number): string {
  if (val === 0) return "-";
  return val.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pctFmt(val: number): string {
  if (val === 0) return "-";
  return val.toFixed(1) + "%";
}

export default function IncomeStatementPct() {
  const [, navigate] = useLocation();
  const { selectedCompany } = useCompany();
  const { acctName } = useLanguage();
  const companyId = selectedCompany?.id;
  const today = new Date();
  const firstDayCurrent = new Date(today.getFullYear(), 0, 1);
  const firstDayPrev = new Date(today.getFullYear() - 1, 0, 1);
  const lastDayPrev = new Date(today.getFullYear() - 1, 11, 31);
  const [startDate1, setStartDate1] = useState(toLocalDateStr(firstDayCurrent));
  const [endDate1, setEndDate1] = useState(toLocalDateStr(today));
  const [startDate2, setStartDate2] = useState(toLocalDateStr(firstDayPrev));
  const [endDate2, setEndDate2] = useState(toLocalDateStr(lastDayPrev));
  const { dateEra, dateFmt } = useDateSettings();

  const { data, isLoading, refetch } = useQuery<CompareData>({
    queryKey: ["/api/reports/income-statement-compare", companyId, startDate1, endDate1, startDate2, endDate2],
    queryFn: async () => {
      const res = await fetch(`/api/reports/income-statement-compare?companyId=${companyId}&startDate1=${startDate1}&endDate1=${endDate1}&startDate2=${startDate2}&endDate2=${endDate2}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!companyId && !!startDate1 && !!endDate1 && !!startDate2 && !!endDate2,
  });

  const pctOfRevenue1 = (val: number) => data?.totalRevenue?.period1 ? ((val / Math.abs(data.totalRevenue.period1)) * 100) : 0;
  const pctOfRevenue2 = (val: number) => data?.totalRevenue?.period2 ? ((val / Math.abs(data.totalRevenue.period2)) * 100) : 0;

  const handleExcel = () => {
    if (!data) return;
    const rows: any[][] = [["รหัส", "ชื่อบัญชี", "งวด 1", "% รายได้", "งวด 2", "% รายได้", "ผลต่าง"]];
    data.revenues.forEach(r => rows.push([r.code, acctName(r), r.period1, pctOfRevenue1(r.period1).toFixed(1) + "%", r.period2, pctOfRevenue2(r.period2).toFixed(1) + "%", r.change]));
    rows.push(["", "รวมรายได้", data.totalRevenue.period1, "100%", data.totalRevenue.period2, "100%", data.totalRevenue.change]);
    data.expenses.forEach(r => rows.push([r.code, acctName(r), r.period1, pctOfRevenue1(r.period1).toFixed(1) + "%", r.period2, pctOfRevenue2(r.period2).toFixed(1) + "%", r.change]));
    rows.push(["", "รวมค่าใช้จ่าย", data.totalExpense.period1, pctFmt(pctOfRevenue1(data.totalExpense.period1)), data.totalExpense.period2, pctFmt(pctOfRevenue2(data.totalExpense.period2)), data.totalExpense.change]);
    rows.push(["", "กำไรสุทธิ", data.netIncome.period1, pctFmt(pctOfRevenue1(data.netIncome.period1)), data.netIncome.period2, pctFmt(pctOfRevenue2(data.netIncome.period2)), data.netIncome.change]);
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "PL-Pct");
    XLSX.writeFile(wb, "income-statement-pct.xlsx");
  };

  return (
    <ReportLayout title="งบกำไร/ขาดทุนเปรียบเทียบ (แสดง %)" icon={<TrendingUp className="h-5 w-5" />}>
      <div className="flex items-center justify-end flex-wrap gap-2 mb-2">
        <Button variant="outline" size="sm" onClick={() => navigate("/reports/general")} data-testid="button-back">กลับรายงาน</Button>
        <Button variant="outline" size="sm" className="border-green-400 text-green-600 hover:bg-green-50" onClick={() => refetch()} disabled={isLoading} data-testid="button-generate">
          <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? "animate-spin" : ""}`} /> สร้างรายงาน
        </Button>
        <Button variant="outline" size="sm" onClick={() => window.print()} data-testid="button-print"><Printer className="h-4 w-4 mr-1" /> พิมพ์</Button>
        <Button size="sm" className="h-8 gap-1.5 text-xs bg-[#05b187] text-white hover:bg-[#049a75] border-none" onClick={handleExcel} data-testid="button-excel"><FileDown className="h-4 w-4" /> Excel</Button>
      </div>
      <Card className="border-0 shadow-md">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-[#03c9d7]">งวดที่ 1 (ปัจจุบัน)</h3>
              <div className="flex gap-2">
                <ThaiDateInput value={startDate1} onChange={setStartDate1} dateEra={dateEra} dateFmt={dateFmt} />
                <span className="self-center text-xs">ถึง</span>
                <ThaiDateInput value={endDate1} onChange={setEndDate1} dateEra={dateEra} dateFmt={dateFmt} />
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-[#fb9678]">งวดที่ 2 (เปรียบเทียบ)</h3>
              <div className="flex gap-2">
                <ThaiDateInput value={startDate2} onChange={setStartDate2} dateEra={dateEra} dateFmt={dateFmt} />
                <span className="self-center text-xs">ถึง</span>
                <ThaiDateInput value={endDate2} onChange={setEndDate2} dateEra={dateEra} dateFmt={dateFmt} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">กำลังโหลด...</div>
      ) : data ? (
        <Card className="border-0 shadow-md">
          <CardContent className="p-0">
            <div className="text-center py-4">
              <h2 className="text-lg font-bold">{selectedCompany?.name}</h2>
              <p className="text-sm text-muted-foreground">งบกำไร/ขาดทุนเปรียบเทียบ (แสดง % ของรายได้)</p>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="w-[60px] text-xs">รหัส</TableHead>
                  <TableHead className="text-xs">รายการ</TableHead>
                  <TableHead className="text-right text-xs">งวด 1</TableHead>
                  <TableHead className="text-right text-xs">%</TableHead>
                  <TableHead className="text-right text-xs">งวด 2</TableHead>
                  <TableHead className="text-right text-xs">%</TableHead>
                  <TableHead className="text-right text-xs">ผลต่าง</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow><TableCell colSpan={7} className="bg-[#03c9d7] text-white font-bold text-sm py-1">รายได้</TableCell></TableRow>
                {data.revenues.map(r => (
                  <TableRow key={r.code}>
                    <TableCell className="text-xs font-mono text-gray-400">{r.code}</TableCell>
                    <TableCell className="text-sm">{acctName(r)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{fmt(r.period1)}</TableCell>
                    <TableCell className="text-right font-mono text-xs text-blue-500">{pctFmt(pctOfRevenue1(r.period1))}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{fmt(r.period2)}</TableCell>
                    <TableCell className="text-right font-mono text-xs text-blue-500">{pctFmt(pctOfRevenue2(r.period2))}</TableCell>
                    <TableCell className={`text-right font-mono text-sm ${r.change > 0 ? "text-green-600" : r.change < 0 ? "text-red-500" : ""}`}>{fmt(r.change)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-gray-50 font-semibold">
                  <TableCell></TableCell>
                  <TableCell>รวมรายได้</TableCell>
                  <TableCell className="text-right font-mono text-sm">{fmt(data.totalRevenue.period1)}</TableCell>
                  <TableCell className="text-right font-mono text-xs text-blue-500">100.0%</TableCell>
                  <TableCell className="text-right font-mono text-sm">{fmt(data.totalRevenue.period2)}</TableCell>
                  <TableCell className="text-right font-mono text-xs text-blue-500">100.0%</TableCell>
                  <TableCell className={`text-right font-mono text-sm ${data.totalRevenue.change > 0 ? "text-green-600" : data.totalRevenue.change < 0 ? "text-red-500" : ""}`}>{fmt(data.totalRevenue.change)}</TableCell>
                </TableRow>
                <TableRow><TableCell colSpan={7} className="bg-[#fb9678] text-white font-bold text-sm py-1">ค่าใช้จ่าย</TableCell></TableRow>
                {data.expenses.map(r => (
                  <TableRow key={r.code}>
                    <TableCell className="text-xs font-mono text-gray-400">{r.code}</TableCell>
                    <TableCell className="text-sm">{acctName(r)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{fmt(r.period1)}</TableCell>
                    <TableCell className="text-right font-mono text-xs text-blue-500">{pctFmt(pctOfRevenue1(r.period1))}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{fmt(r.period2)}</TableCell>
                    <TableCell className="text-right font-mono text-xs text-blue-500">{pctFmt(pctOfRevenue2(r.period2))}</TableCell>
                    <TableCell className={`text-right font-mono text-sm ${r.change > 0 ? "text-green-600" : r.change < 0 ? "text-red-500" : ""}`}>{fmt(r.change)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-gray-50 font-semibold">
                  <TableCell></TableCell>
                  <TableCell>รวมค่าใช้จ่าย</TableCell>
                  <TableCell className="text-right font-mono text-sm">{fmt(data.totalExpense.period1)}</TableCell>
                  <TableCell className="text-right font-mono text-xs text-blue-500">{pctFmt(pctOfRevenue1(data.totalExpense.period1))}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{fmt(data.totalExpense.period2)}</TableCell>
                  <TableCell className="text-right font-mono text-xs text-blue-500">{pctFmt(pctOfRevenue2(data.totalExpense.period2))}</TableCell>
                  <TableCell className={`text-right font-mono text-sm ${data.totalExpense.change > 0 ? "text-green-600" : data.totalExpense.change < 0 ? "text-red-500" : ""}`}>{fmt(data.totalExpense.change)}</TableCell>
                </TableRow>
                <TableRow className="bg-gray-100 font-bold">
                  <TableCell></TableCell>
                  <TableCell>กำไร(ขาดทุน)สุทธิ</TableCell>
                  <TableCell className={`text-right font-mono text-sm ${data.netIncome.period1 >= 0 ? "text-green-600" : "text-red-500"}`}>{fmt(data.netIncome.period1)}</TableCell>
                  <TableCell className="text-right font-mono text-xs text-blue-500">{pctFmt(pctOfRevenue1(data.netIncome.period1))}</TableCell>
                  <TableCell className={`text-right font-mono text-sm ${data.netIncome.period2 >= 0 ? "text-green-600" : "text-red-500"}`}>{fmt(data.netIncome.period2)}</TableCell>
                  <TableCell className="text-right font-mono text-xs text-blue-500">{pctFmt(pctOfRevenue2(data.netIncome.period2))}</TableCell>
                  <TableCell className={`text-right font-mono text-sm ${data.netIncome.change > 0 ? "text-green-600" : data.netIncome.change < 0 ? "text-red-500" : ""}`}>{fmt(data.netIncome.change)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <div className="text-center py-12 text-muted-foreground">กรุณาเลือกช่วงเวลาเปรียบเทียบ</div>
      )}
    </ReportLayout>
  );
}