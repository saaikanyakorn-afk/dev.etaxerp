import { useState } from "react";
import ReportLayout from "@/components/report-layout";
import { useCompany } from "@/lib/company-context";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Scale, Printer, CheckCircle2, AlertTriangle, RefreshCw, FileDown } from "lucide-react";
import * as XLSX from "xlsx";
import { formatDate, formatNumber } from "@/lib/format";
import ThaiDateInput from "@/components/thai-date-input";
import { useLocation } from "wouter";
import { toLocalDateStr } from "@/lib/utils";
import { useLanguage } from "@/hooks/use-language";

import { useDateSettings } from "@/hooks/use-date-settings";
interface AccountLine {
  code: string;
  name: string;
  nameTh?: string;
  balance: number;
}

interface BalanceSheetData {
  assets: AccountLine[];
  liabilities: AccountLine[];
  equity: AccountLine[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  totalLiabilitiesAndEquity: number;
}

function fmt(val: number | string | null | undefined): string {
  const n = parseFloat(String(val || "0"));
  if (n === 0) return "-";
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function BalanceSheet() {
  const [, navigate] = useLocation();
  const { selectedCompany } = useCompany();
  const { acctName } = useLanguage();
  const companyId = selectedCompany?.id;

  const today = toLocalDateStr(new Date());
  const [asOfDate, setAsOfDate] = useState(today);

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
  const { data, isLoading, refetch } = useQuery<BalanceSheetData>({
    queryKey: ["/api/reports/balance-sheet", companyId, asOfDate],
    queryFn: async () => {
      const res = await fetch(
        `/api/reports/balance-sheet?companyId=${companyId}&asOfDate=${asOfDate}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to fetch balance sheet");
      return res.json();
    },
    enabled: !!companyId && !!asOfDate,
    placeholderData: keepPreviousData,
  });

  const assets = data?.assets || [];
  const liabilities = data?.liabilities || [];
  const equity = data?.equity || [];
  const totalAssets = data?.totalAssets || 0;
  const totalLiabilities = data?.totalLiabilities || 0;
  const totalEquity = data?.totalEquity || 0;
  const totalLiabilitiesAndEquity = data?.totalLiabilitiesAndEquity || 0;

  const isBalanced = Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01;

  const handleExcel = () => {
    const rows: (string | number)[][] = [];
    rows.push(["รหัสบัญชี", "ชื่อบัญชี", "จำนวนเงิน"]);

    rows.push(["", "สินทรัพย์", ""]);
    assets.forEach((item) => {
      rows.push([item.code, acctName(item), item.balance]);
    });
    rows.push(["", "รวมสินทรัพย์", totalAssets]);

    rows.push(["", "", ""]);

    rows.push(["", "หนี้สิน", ""]);
    liabilities.forEach((item) => {
      rows.push([item.code, acctName(item), item.balance]);
    });
    rows.push(["", "รวมหนี้สิน", totalLiabilities]);

    rows.push(["", "", ""]);

    rows.push(["", "ส่วนของผู้ถือหุ้น", ""]);
    equity.forEach((item) => {
      rows.push([item.code, acctName(item), item.balance]);
    });
    rows.push(["", "รวมส่วนของผู้ถือหุ้น", totalEquity]);

    rows.push(["", "", ""]);
    rows.push(["", "รวมหนี้สินและส่วนของผู้ถือหุ้น", totalLiabilitiesAndEquity]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "BalanceSheet");
    XLSX.writeFile(wb, "balance-sheet.xlsx");
  };

  const displayName = (item: AccountLine) => acctName(item);

  const renderSection = (
    title: string,
    items: AccountLine[],
    totalLabel: string,
    totalValue: number,
    testIdPrefix: string
  ) => (
    <div className="mb-6" data-testid={`section-${testIdPrefix}`}>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent" style={{ background: "var(--theme-table-header)" }}>
            <TableHead className="text-sm font-bold text-white w-[120px]">รหัสบัญชี</TableHead>
            <TableHead className="text-sm font-bold text-white">ชื่อบัญชี</TableHead>
            <TableHead className="text-sm font-bold text-white w-[160px] text-right">ยอดคงเหลือ</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow className="hover:bg-transparent bg-blue-50/50">
            <TableCell colSpan={3} className="font-bold text-sm py-2" style={{ color: "var(--theme-table-header)" }}>
              {title}
            </TableCell>
          </TableRow>
          {items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} className="text-center text-muted-foreground text-sm py-4">
                ไม่มีรายการ
              </TableCell>
            </TableRow>
          ) : (
            items.map((item, idx) => (
              <TableRow
                key={item.code || idx}
                data-testid={`row-${testIdPrefix}-${idx}`}
                className="cursor-pointer group hover:bg-blue-50/30"
                onClick={() => {
                  const y = new Date(asOfDate + "T00:00:00").getFullYear();
                  window.open(`/reports/general-ledger?accountCode=${item.code}&startDate=${y}-01-01&endDate=${asOfDate}`, '_blank');
                }}
              >
                <TableCell className="text-sm tabular-nums py-2 group-hover:text-blue-600" data-testid={`text-code-${testIdPrefix}-${idx}`}>
                  {item.code}
                </TableCell>
                <TableCell className="text-sm py-2 group-hover:text-blue-600" data-testid={`text-name-${testIdPrefix}-${idx}`}>
                  {displayName(item)}
                </TableCell>
                <TableCell className="text-sm text-right font-medium py-2 tabular-nums" data-testid={`text-balance-${testIdPrefix}-${idx}`}>
                  {fmt(item.balance)}
                </TableCell>
              </TableRow>
            ))
          )}
          <TableRow className="hover:bg-transparent" style={{ borderTop: "2px solid var(--theme-table-header)", background: "var(--theme-table-stripe)" }}>
            <TableCell colSpan={2} className="text-sm font-bold py-2.5">
              {totalLabel}
            </TableCell>
            <TableCell className="text-sm font-bold text-right py-2.5 tabular-nums" data-testid={`text-total-${testIdPrefix}`}>
              {fmt(totalValue)}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );

  return (
    <ReportLayout title="งบแสดงฐานะทางการเงิน (รายบัญชี)" icon={<Scale className="h-5 w-5" />} showNavTabs>
        <div className="flex items-center justify-end flex-wrap gap-2 mb-2">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-green-400 text-green-600 hover:bg-green-50"
              onClick={() => refetch()}
              disabled={isLoading}
              data-testid="button-generate"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              สร้างรายงาน
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-blue-300 text-blue-600 hover:bg-blue-50"
              onClick={() => window.print()}
              data-testid="button-print"
            >
              <Printer className="h-4 w-4" />
              พิมพ์
            </Button>
            <Button
              size="sm"
              className="h-8 gap-1.5 text-xs bg-[#05b187] text-white hover:bg-[#049a75] border-none"
              onClick={handleExcel}
              data-testid="button-excel"
            >
              <FileDown className="h-4 w-4" />
              Excel
            </Button>
          </div>
        </div>

        <div className="flex items-end gap-3 flex-wrap print:hidden">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">ณ วันที่</label>
            <ThaiDateInput
              value={asOfDate}
              onChange={setAsOfDate}
              dateEra={dateEra}
              dateFmt={dateFmt}
              data-testid="input-as-of-date"
            />
          </div>
        </div>

        {!companyId ? (
          <div className="text-center py-12 text-muted-foreground" data-testid="text-no-company">
            กรุณาเลือกบริษัท
          </div>
        ) : isLoading ? (
          <div className="text-center py-12 text-muted-foreground" data-testid="text-loading">
            กำลังโหลดข้อมูล...
          </div>
        ) : (
          <div className="bg-white border rounded-xl shadow-sm p-4 sm:p-6">
            <div className="text-center mb-6 print:mb-4">
              <h2 className="text-lg font-bold" data-testid="text-company-name-report">
                {selectedCompany?.name}
              </h2>
              <p className="text-sm text-muted-foreground">งบแสดงฐานะทางการเงิน</p>
              <p className="text-sm text-muted-foreground" data-testid="text-report-date">
                ณ วันที่ {formatDate(asOfDate, dateEra, dateFmt)}
              </p>
            </div>

            {renderSection("สินทรัพย์ (Assets)", assets, "รวมสินทรัพย์", totalAssets, "assets")}
            {renderSection("หนี้สิน (Liabilities)", liabilities, "รวมหนี้สิน", totalLiabilities, "liabilities")}
            {renderSection("ส่วนของเจ้าของ (Equity)", equity, "รวมส่วนของเจ้าของ", totalEquity, "equity")}

            <div className="pt-3 mt-2" style={{ borderTop: "2px solid var(--theme-table-header)" }}>
              <div className="flex justify-between items-center px-2">
                <span className="text-sm font-bold" style={{ color: "var(--theme-table-header)" }}>
                  รวมหนี้สินและส่วนของเจ้าของ
                </span>
                <span className="text-sm font-bold tabular-nums" data-testid="text-total-liabilities-and-equity">
                  {fmt(totalLiabilitiesAndEquity)}
                </span>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2 justify-center" data-testid="text-balance-status">
              {isBalanced ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span className="text-sm font-medium text-green-600">
                    งบดุล: สินทรัพย์ = หนี้สิน + ส่วนของเจ้าของ (สมดุล)
                  </span>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  <span className="text-sm font-medium text-amber-500">
                    งบดุล: ไม่สมดุล (ผลต่าง {fmt(Math.abs(totalAssets - totalLiabilitiesAndEquity))})
                  </span>
                </>
              )}
            </div>
          </div>
        )}
    </ReportLayout>
  );
}
