import { useState } from "react";
import ReportLayout from "@/components/report-layout";
import { useCompany } from "@/lib/company-context";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Scale, Printer, ArrowUp, ArrowDown, RefreshCw, FileDown } from "lucide-react";
import * as XLSX from "xlsx";
import ThaiDateInput from "@/components/thai-date-input";
import { useLocation } from "wouter";
import { toLocalDateStr } from "@/lib/utils";
import { useLanguage } from "@/hooks/use-language";
import { useDateSettings } from "@/hooks/use-date-settings";

interface CompareRow { code: string; name: string; nameTh?: string; period1: number; period2: number; change: number; }
interface TotalRow { period1: number; period2: number; change: number; }
interface CompareData { assets: CompareRow[]; liabilities: CompareRow[]; equity: CompareRow[]; totalAssets: TotalRow; totalLiabilities: TotalRow; totalEquity: TotalRow; }

function fmt(val: number | string | null | undefined): string {
  const n = parseFloat(String(val || "0"));
  if (n === 0) return "-";
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function BalanceSheetCompareAmount() {
  const [, navigate] = useLocation();
  const { selectedCompany } = useCompany();
  const { acctName } = useLanguage();
  const companyId = selectedCompany?.id;
  const today = new Date();
  const lastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
  const [asOfDate1, setAsOfDate1] = useState(toLocalDateStr(today));
  const [asOfDate2, setAsOfDate2] = useState(toLocalDateStr(lastMonth));
  const { dateEra, dateFmt } = useDateSettings();

  const { data, isLoading, refetch } = useQuery<CompareData>({
    queryKey: ["/api/reports/balance-sheet-compare", companyId, asOfDate1, asOfDate2],
    queryFn: async () => {
      const res = await fetch(`/api/reports/balance-sheet-compare?companyId=${companyId}&asOfDate1=${asOfDate1}&asOfDate2=${asOfDate2}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!companyId && !!asOfDate1 && !!asOfDate2,
  });

  const handleExcel = () => {
    if (!data) return;
    const rows: (string | number)[][] = [["รหัสบัญชี", "ชื่อบัญชี", "ณ วันที่ 1", "ณ วันที่ 2", "ผลต่าง"]];
    rows.push(["", "สินทรัพย์", "", "", ""]);
    data.assets.forEach(r => rows.push([r.code, acctName(r), r.period1, r.period2, r.change]));
    rows.push(["", "รวมสินทรัพย์", data.totalAssets.period1, data.totalAssets.period2, data.totalAssets.change]);
    rows.push([]);
    rows.push(["", "หนี้สิน", "", "", ""]);
    data.liabilities.forEach(r => rows.push([r.code, acctName(r), r.period1, r.period2, r.change]));
    rows.push(["", "รวมหนี้สิน", data.totalLiabilities.period1, data.totalLiabilities.period2, data.totalLiabilities.change]);
    rows.push([]);
    rows.push(["", "ส่วนของผู้ถือหุ้น", "", "", ""]);
    data.equity.forEach(r => rows.push([r.code, acctName(r), r.period1, r.period2, r.change]));
    rows.push(["", "รวมส่วนของผู้ถือหุ้น", data.totalEquity.period1, data.totalEquity.period2, data.totalEquity.change]);
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "BS-Amount");
    XLSX.writeFile(wb, "balance-sheet-compare-amount.xlsx");
  };

  const icon = (val: number) => {
    if (val > 0) return <ArrowUp className="h-3 w-3 text-green-500 inline" />;
    if (val < 0) return <ArrowDown className="h-3 w-3 text-red-500 inline" />;
    return null;
  };

  const renderRow = (row: CompareRow) => (
    <TableRow key={row.code}>
      <TableCell className="text-xs font-mono text-gray-400">{row.code}</TableCell>
      <TableCell className="text-sm">{acctName(row)}</TableCell>
      <TableCell className="text-right font-mono text-sm">{fmt(row.period1)}</TableCell>
      <TableCell className="text-right font-mono text-sm">{fmt(row.period2)}</TableCell>
      <TableCell className={`text-right font-mono text-sm ${row.change > 0 ? "text-green-600" : row.change < 0 ? "text-red-500" : ""}`}>
        {icon(row.change)} {fmt(row.change)}
      </TableCell>
    </TableRow>
  );

  const renderTotal = (label: string, total: TotalRow) => (
    <TableRow className="bg-gray-50 font-bold">
      <TableCell></TableCell>
      <TableCell className="text-sm">{label}</TableCell>
      <TableCell className="text-right font-mono text-sm">{fmt(total.period1)}</TableCell>
      <TableCell className="text-right font-mono text-sm">{fmt(total.period2)}</TableCell>
      <TableCell className={`text-right font-mono text-sm ${total.change > 0 ? "text-green-600" : total.change < 0 ? "text-red-500" : ""}`}>
        {icon(total.change)} {fmt(total.change)}
      </TableCell>
    </TableRow>
  );

  return (
    <ReportLayout fullWidth title="งบดุลเปรียบเทียบ (จำนวนเงิน)" icon={<Scale className="h-5 w-5" />}>
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
              <h3 className="text-xs font-bold text-[#03c9d7]">ณ วันที่ 1 (ปัจจุบัน)</h3>
              <ThaiDateInput value={asOfDate1} onChange={setAsOfDate1} dateEra={dateEra} dateFmt={dateFmt} />
            </div>
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-[#fb9678]">ณ วันที่ 2 (เปรียบเทียบ)</h3>
              <ThaiDateInput value={asOfDate2} onChange={setAsOfDate2} dateEra={dateEra} dateFmt={dateFmt} />
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
              <p className="text-sm text-muted-foreground">งบแสดงฐานะทางการเงินเปรียบเทียบ (จำนวนเงิน)</p>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="w-[60px] text-xs">รหัส</TableHead>
                  <TableHead className="text-xs">รายการ</TableHead>
                  <TableHead className="text-right text-xs">ณ วันที่ 1</TableHead>
                  <TableHead className="text-right text-xs">ณ วันที่ 2</TableHead>
                  <TableHead className="text-right text-xs">ผลต่าง</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow><TableCell colSpan={5} className="bg-[#03c9d7] text-white font-bold text-sm py-1">สินทรัพย์</TableCell></TableRow>
                {data.assets.map(renderRow)}
                {renderTotal("รวมสินทรัพย์", data.totalAssets)}
                <TableRow><TableCell colSpan={5} className="bg-[#fb9678] text-white font-bold text-sm py-1">หนี้สิน</TableCell></TableRow>
                {data.liabilities.map(renderRow)}
                {renderTotal("รวมหนี้สิน", data.totalLiabilities)}
                <TableRow><TableCell colSpan={5} className="bg-[#05b187] text-white font-bold text-sm py-1">ส่วนของผู้ถือหุ้น</TableCell></TableRow>
                {data.equity.map(renderRow)}
                {renderTotal("รวมส่วนของผู้ถือหุ้น", data.totalEquity)}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <div className="text-center py-12 text-muted-foreground">กรุณาเลือกวันที่เปรียบเทียบ</div>
      )}
    </ReportLayout>
  );
}