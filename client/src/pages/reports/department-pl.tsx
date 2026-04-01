import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ReportLayout from "@/components/report-layout";
import { useCompany } from "@/lib/company-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Building2, Printer, FileDown, RefreshCw } from "lucide-react";
import ThaiDateInput from "@/components/thai-date-input";
import { useDateSettings } from "@/hooks/use-date-settings";
import { toLocalDateStr } from "@/lib/utils";
import * as XLSX from "xlsx";

function fmt(val: number | string | null | undefined): string {
  const n = parseFloat(String(val || "0"));
  if (n === 0) return "-";
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function DepartmentPLReport() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const { dateEra, dateFmt } = useDateSettings();

  const today = new Date();
  const firstDay = new Date(today.getFullYear(), 0, 1);
  const [startDate, setStartDate] = useState(toLocalDateStr(firstDay));
  const [endDate, setEndDate] = useState(toLocalDateStr(today));

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/reports/department-pl", companyId, startDate, endDate],
    queryFn: async () => {
      const res = await fetch(
        `/api/reports/department-pl?companyId=${companyId}&startDate=${startDate}&endDate=${endDate}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to fetch department P&L data");
      return res.json();
    },
    enabled: !!companyId && !!startDate && !!endDate,
  });

  const deptList: string[] = data?.departments || [];
  const revenueAccounts: any[] = data?.revenueAccounts || [];
  const expenseAccounts: any[] = data?.expenseAccounts || [];
  const deptTotals: Record<string, { revenue: number; expense: number; netIncome: number }> = data?.deptTotals || {};

  const grandRevenue = Object.values(deptTotals).reduce((s, d) => s + d.revenue, 0);
  const grandExpense = Object.values(deptTotals).reduce((s, d) => s + d.expense, 0);
  const grandNet = grandRevenue - grandExpense;

  const accountRowTotal = (acct: any) => deptList.reduce((s, d) => s + (acct.departments[d] || 0), 0);

  const handleExcel = () => {
    const rows: (string | number)[][] = [];
    rows.push(["งบกำไรขาดทุนแยกตามแผนก"]);
    rows.push([]);
    const header = ["รหัส", "ชื่อบัญชี", ...deptList, "รวม"];
    rows.push(header);
    rows.push(["", "--- รายได้ ---", ...deptList.map(() => ""), ""]);
    revenueAccounts.forEach(a => {
      const total = accountRowTotal(a);
      rows.push([a.code, a.nameTh || a.name, ...deptList.map(d => a.departments[d] || 0), total]);
    });
    rows.push(["", "รวมรายได้", ...deptList.map(d => deptTotals[d]?.revenue || 0), grandRevenue]);
    rows.push([]);
    rows.push(["", "--- ค่าใช้จ่าย ---", ...deptList.map(() => ""), ""]);
    expenseAccounts.forEach(a => {
      const total = accountRowTotal(a);
      rows.push([a.code, a.nameTh || a.name, ...deptList.map(d => a.departments[d] || 0), total]);
    });
    rows.push(["", "รวมค่าใช้จ่าย", ...deptList.map(d => deptTotals[d]?.expense || 0), grandExpense]);
    rows.push([]);
    rows.push(["", "กำไร(ขาดทุน)สุทธิ", ...deptList.map(d => deptTotals[d]?.netIncome || 0), grandNet]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DeptPL");
    XLSX.writeFile(wb, "department-pl.xlsx");
  };

  return (
    <ReportLayout title="งบกำไรขาดทุนแยกตามแผนก" subtitle="Department P&L" icon={<Building2 className="h-5 w-5" />}>
      <div className="flex items-center justify-end flex-wrap gap-2 mb-2">
        <Button variant="outline" size="sm" className="gap-1.5 border-green-400 text-green-600 hover:bg-green-50" onClick={() => refetch()} disabled={isLoading} data-testid="button-generate">
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} /> สร้างรายงาน
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5 border-blue-300 text-blue-600 hover:bg-blue-50" onClick={() => window.print()} data-testid="button-print">
          <Printer className="h-4 w-4" /> พิมพ์
        </Button>
        <Button size="sm" className="h-8 gap-1.5 text-xs bg-[#05b187] text-white hover:bg-[#049a75] border-none" onClick={handleExcel} data-testid="button-excel">
          <FileDown className="h-4 w-4" /> Excel
        </Button>
      </div>

      <div className="flex items-end gap-3 flex-wrap print:hidden">
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">วันที่เริ่มต้น</label>
          <ThaiDateInput value={startDate} onChange={setStartDate} dateEra={dateEra} dateFmt={dateFmt} data-testid="input-start-date" />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">วันที่สิ้นสุด</label>
          <ThaiDateInput value={endDate} onChange={setEndDate} dateEra={dateEra} dateFmt={dateFmt} data-testid="input-end-date" />
        </div>
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-muted-foreground" data-testid="text-loading">กำลังโหลด...</div>
      ) : deptList.length === 0 ? (
        <Card className="border shadow-sm">
          <CardContent className="py-16 text-center text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-3 text-slate-300" />
            <p className="text-sm" data-testid="text-empty-state">ไม่พบข้อมูล — กรุณาตั้ง cost center ใน journal entries เพื่อแยกตามแผนก</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {deptList.slice(0, 8).map((dept, idx) => {
              const t = deptTotals[dept] || { revenue: 0, expense: 0, netIncome: 0 };
              const margin = t.revenue > 0 ? (t.netIncome / t.revenue) * 100 : 0;
              return (
                <Card key={dept} className="border shadow-sm" data-testid={`card-dept-${idx}`}>
                  <CardContent className="p-4">
                    <div className="text-xs text-muted-foreground mb-1 truncate">{dept}</div>
                    <div className={`text-lg font-bold tabular-nums ${t.netIncome >= 0 ? "text-green-600" : "text-red-500"}`}>
                      {fmt(t.netIncome)}
                    </div>
                    <div className="text-xs text-muted-foreground">Margin {margin.toFixed(1)}%</div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card className="border shadow-sm" data-testid="card-dept-matrix">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Matrix P&L ({deptList.length} แผนก)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-100">
                      <TableHead className="text-xs font-semibold w-[80px] sticky left-0 bg-slate-100 z-10">รหัส</TableHead>
                      <TableHead className="text-xs font-semibold w-[200px] sticky left-[80px] bg-slate-100 z-10">ชื่อบัญชี</TableHead>
                      {deptList.map(d => (
                        <TableHead key={d} className="text-xs text-right font-semibold min-w-[120px]">{d}</TableHead>
                      ))}
                      <TableHead className="text-xs text-right font-semibold min-w-[120px] bg-slate-200">รวม</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow className="bg-blue-50/50">
                      <TableCell colSpan={2 + deptList.length + 1} className="text-sm font-bold text-blue-700 sticky left-0" data-testid="header-revenue-section">
                        รายได้
                      </TableCell>
                    </TableRow>
                    {revenueAccounts.map((a, idx) => {
                      const total = accountRowTotal(a);
                      return (
                        <TableRow key={a.code} data-testid={`row-rev-${idx}`}>
                          <TableCell className="text-xs tabular-nums sticky left-0 bg-white">{a.code}</TableCell>
                          <TableCell className="text-xs sticky left-[80px] bg-white">{a.nameTh || a.name}</TableCell>
                          {deptList.map(d => (
                            <TableCell key={d} className="text-xs text-right tabular-nums">{fmt(a.departments[d])}</TableCell>
                          ))}
                          <TableCell className="text-xs text-right tabular-nums font-medium bg-slate-50">{fmt(total)}</TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow className="bg-blue-50/70 font-bold border-t">
                      <TableCell colSpan={2} className="text-xs text-right sticky left-0 bg-blue-50/70">รวมรายได้</TableCell>
                      {deptList.map(d => (
                        <TableCell key={d} className="text-xs text-right tabular-nums font-bold">{fmt(deptTotals[d]?.revenue)}</TableCell>
                      ))}
                      <TableCell className="text-xs text-right tabular-nums font-bold bg-blue-100" data-testid="text-grand-revenue">{fmt(grandRevenue)}</TableCell>
                    </TableRow>

                    <TableRow className="bg-orange-50/50">
                      <TableCell colSpan={2 + deptList.length + 1} className="text-sm font-bold text-orange-700 sticky left-0" data-testid="header-expense-section">
                        ค่าใช้จ่าย
                      </TableCell>
                    </TableRow>
                    {expenseAccounts.map((a, idx) => {
                      const total = accountRowTotal(a);
                      return (
                        <TableRow key={a.code} data-testid={`row-exp-${idx}`}>
                          <TableCell className="text-xs tabular-nums sticky left-0 bg-white">{a.code}</TableCell>
                          <TableCell className="text-xs sticky left-[80px] bg-white">{a.nameTh || a.name}</TableCell>
                          {deptList.map(d => (
                            <TableCell key={d} className="text-xs text-right tabular-nums">{fmt(a.departments[d])}</TableCell>
                          ))}
                          <TableCell className="text-xs text-right tabular-nums font-medium bg-slate-50">{fmt(total)}</TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow className="bg-orange-50/70 font-bold border-t">
                      <TableCell colSpan={2} className="text-xs text-right sticky left-0 bg-orange-50/70">รวมค่าใช้จ่าย</TableCell>
                      {deptList.map(d => (
                        <TableCell key={d} className="text-xs text-right tabular-nums font-bold">{fmt(deptTotals[d]?.expense)}</TableCell>
                      ))}
                      <TableCell className="text-xs text-right tabular-nums font-bold bg-orange-100" data-testid="text-grand-expense">{fmt(grandExpense)}</TableCell>
                    </TableRow>

                    <TableRow className="bg-emerald-50/70 font-bold border-t-2" data-testid="row-net-income">
                      <TableCell colSpan={2} className="text-sm text-right font-bold sticky left-0 bg-emerald-50/70">กำไร(ขาดทุน)สุทธิ</TableCell>
                      {deptList.map(d => {
                        const ni = deptTotals[d]?.netIncome || 0;
                        return (
                          <TableCell key={d} className={`text-sm text-right tabular-nums font-bold ${ni >= 0 ? "text-green-600" : "text-red-500"}`}>
                            {fmt(ni)}
                          </TableCell>
                        );
                      })}
                      <TableCell className={`text-sm text-right tabular-nums font-bold bg-emerald-100 ${grandNet >= 0 ? "text-green-700" : "text-red-600"}`} data-testid="text-grand-net">
                        {fmt(grandNet)}
                      </TableCell>
                    </TableRow>

                    <TableRow className="bg-gray-50 border-t">
                      <TableCell colSpan={2} className="text-xs text-right font-medium sticky left-0 bg-gray-50">Contribution Margin %</TableCell>
                      {deptList.map(d => {
                        const t = deptTotals[d] || { revenue: 0, netIncome: 0 };
                        const margin = t.revenue > 0 ? (t.netIncome / t.revenue) * 100 : 0;
                        return (
                          <TableCell key={d} className={`text-xs text-right tabular-nums ${margin >= 0 ? "text-green-600" : "text-red-500"}`}>
                            {margin.toFixed(1)}%
                          </TableCell>
                        );
                      })}
                      <TableCell className={`text-xs text-right tabular-nums font-bold bg-gray-100 ${grandRevenue > 0 && grandNet >= 0 ? "text-green-700" : "text-red-600"}`}>
                        {grandRevenue > 0 ? ((grandNet / grandRevenue) * 100).toFixed(1) : "0.0"}%
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </ReportLayout>
  );
}
