import { useState } from "react";
import ReportLayout from "@/components/report-layout";
import { useCompany } from "@/lib/company-context";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Banknote, Printer, ArrowUpCircle, ArrowDownCircle, Landmark, RefreshCw, FileDown } from "lucide-react";
import * as XLSX from "xlsx";
import ThaiDateInput from "@/components/thai-date-input";
import { useLocation } from "wouter";
import { toLocalDateStr } from "@/lib/utils";

import { useDateSettings } from "@/hooks/use-date-settings";
interface CashFlowItem {
  label: string;
  amount: number;
}

interface CashFlowData {
  operating: CashFlowItem[];
  totalOperating: number;
  investing: CashFlowItem[];
  totalInvesting: number;
  financing: CashFlowItem[];
  totalFinancing: number;
  netCashChange: number;
  beginningCash: number;
  endingCash: number;
}

function fmt(val: number | string | null | undefined): string {
  const n = parseFloat(String(val || "0"));
  if (n === 0) return "-";
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function CashFlowStatement() {
  const [, navigate] = useLocation();
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;

  const today = new Date();
  const firstDay = new Date(today.getFullYear(), 0, 1);
  const [startDate, setStartDate] = useState(toLocalDateStr(firstDay));
  const [endDate, setEndDate] = useState(toLocalDateStr(today));

  const { dateEra, dateFmt } = useDateSettings();
  const { data: docSettings } = useQuery<any>({
    queryKey: ["/api/document-settings", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const res = await fetch(`/api/document-settings?companyId=${companyId}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!companyId,
  });
  const { data, isLoading, refetch } = useQuery<CashFlowData>({
    queryKey: ["/api/reports/cash-flow", companyId, startDate, endDate],
    queryFn: async () => {
      const res = await fetch(
        `/api/reports/cash-flow?companyId=${companyId}&startDate=${startDate}&endDate=${endDate}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!companyId && !!startDate && !!endDate,
  });

  const handleExcel = () => {
    if (!data) return;
    const rows: (string | number)[][] = [];
    rows.push(["งบกระแสเงินสด (Cash Flow Statement)"]);
    rows.push(["รายการ", "จำนวนเงิน"]);

    rows.push([""]);
    rows.push(["กิจกรรมดำเนินงาน"]);
    data.operating.forEach((item) => rows.push([item.label, item.amount]));
    rows.push(["รวมกิจกรรมดำเนินงาน", data.totalOperating]);

    rows.push([""]);
    rows.push(["กิจกรรมลงทุน"]);
    data.investing.forEach((item) => rows.push([item.label, item.amount]));
    rows.push(["รวมกิจกรรมลงทุน", data.totalInvesting]);

    rows.push([""]);
    rows.push(["กิจกรรมจัดหาเงิน"]);
    data.financing.forEach((item) => rows.push([item.label, item.amount]));
    rows.push(["รวมกิจกรรมจัดหาเงิน", data.totalFinancing]);

    rows.push([""]);
    rows.push(["เงินสดเพิ่มขึ้น(ลดลง)สุทธิ", data.netCashChange]);
    rows.push(["เงินสดต้นงวด", data.beginningCash]);
    rows.push(["เงินสดปลายงวด", data.endingCash]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "CashFlow");
    XLSX.writeFile(wb, "cash-flow.xlsx");
  };

  const renderSection = (title: string, icon: React.ReactNode, items: CashFlowItem[], total: number, color: string) => (
    <div className="mb-6">
      <div className={`flex items-center gap-2 ${color} text-white px-4 py-2 rounded-t-lg`}>
        {icon}
        <span className="font-bold text-sm">{title}</span>
      </div>
      <Table>
        <TableBody>
          {items.map((item, i) => (
            <TableRow key={i}>
              <TableCell className="pl-8 text-sm">{item.label}</TableCell>
              <TableCell className={`text-right font-mono text-sm ${item.amount < 0 ? "text-red-500" : ""}`}>
                {fmt(item.amount)}
              </TableCell>
            </TableRow>
          ))}
          <TableRow className="bg-gray-50 font-bold">
            <TableCell className="pl-4 text-sm">รวม{title}</TableCell>
            <TableCell className={`text-right font-mono text-sm ${total < 0 ? "text-red-500" : "text-green-600"}`}>
              {fmt(total)}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );

  return (
    <ReportLayout title="งบกระแสเงินสด" icon={<Banknote className="h-5 w-5" />}>
        <div className="flex items-center justify-end flex-wrap gap-2 mb-2">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/reports/general")} data-testid="button-back">
              กลับรายงาน
            </Button>
            <Button variant="outline" size="sm" className="border-green-400 text-green-600 hover:bg-green-50" onClick={() => refetch()} disabled={isLoading} data-testid="button-generate">
              <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? "animate-spin" : ""}`} /> สร้างรายงาน
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()} data-testid="button-print">
              <Printer className="h-4 w-4 mr-1" /> พิมพ์
            </Button>
            <Button size="sm" className="h-8 gap-1.5 text-xs bg-[#05b187] text-white hover:bg-[#049a75] border-none" onClick={handleExcel} data-testid="button-excel">
              <FileDown className="h-4 w-4" /> Excel
            </Button>
          </div>
        </div>

        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-end gap-4 flex-wrap">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">จากวันที่</label>
                <ThaiDateInput value={startDate} onChange={setStartDate} dateEra={dateEra} dateFmt={dateFmt} data-testid="input-start-date" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">ถึงวันที่</label>
                <ThaiDateInput value={endDate} onChange={setEndDate} dateEra={dateEra} dateFmt={dateFmt} data-testid="input-end-date" />
              </div>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">กำลังโหลด...</div>
        ) : data ? (
          <Card className="border-0 shadow-md">
            <CardContent className="p-6">
              <div className="text-center mb-6">
                <h2 className="text-lg font-bold">{selectedCompany?.name}</h2>
                <p className="text-sm text-muted-foreground">งบกระแสเงินสด (Cash Flow Statement)</p>
              </div>

              {renderSection(
                "กิจกรรมดำเนินงาน",
                <ArrowUpCircle className="h-4 w-4" />,
                data.operating,
                data.totalOperating,
                "bg-[#03c9d7]"
              )}

              {renderSection(
                "กิจกรรมลงทุน",
                <ArrowDownCircle className="h-4 w-4" />,
                data.investing,
                data.totalInvesting,
                "bg-[var(--theme-primary)]"
              )}

              {renderSection(
                "กิจกรรมจัดหาเงิน",
                <Landmark className="h-4 w-4" />,
                data.financing,
                data.totalFinancing,
                "bg-[#fb9678]"
              )}

              <div className="border-t-2 border-gray-300 pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-bold">เงินสดเพิ่มขึ้น(ลดลง)สุทธิ</span>
                  <span className={`font-mono font-bold ${data.netCashChange < 0 ? "text-red-500" : "text-green-600"}`}>
                    {fmt(data.netCashChange)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>เงินสดต้นงวด</span>
                  <span className="font-mono">{fmt(data.beginningCash)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold border-t pt-2 border-double border-gray-400">
                  <span>เงินสดปลายงวด</span>
                  <span className={`font-mono ${data.endingCash < 0 ? "text-red-500" : "text-green-600"}`}>
                    {fmt(data.endingCash)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="text-center py-12 text-muted-foreground">กรุณาเลือกช่วงเวลา</div>
        )}
    </ReportLayout>
  );
}
