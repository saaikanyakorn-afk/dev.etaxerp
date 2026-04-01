import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ReportLayout from "@/components/report-layout";
import { useCompany } from "@/lib/company-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { BarChart3, Printer, FileDown, RefreshCw } from "lucide-react";
import ThaiDateInput from "@/components/thai-date-input";
import { useDateSettings } from "@/hooks/use-date-settings";
import { toLocalDateStr } from "@/lib/utils";
import { useLanguage } from "@/hooks/use-language";
import * as XLSX from "xlsx";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";

function fmt(val: number | string | null | undefined): string {
  const n = parseFloat(String(val || "0"));
  if (n === 0) return "-";
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const COLORS = ["#539BFF", "#fb9678"];

export default function OpexCapexReport() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const { dateEra, dateFmt } = useDateSettings();

  const today = new Date();
  const firstDay = new Date(today.getFullYear(), 0, 1);
  const [startDate, setStartDate] = useState(toLocalDateStr(firstDay));
  const [endDate, setEndDate] = useState(toLocalDateStr(today));

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/reports/opex-capex", companyId, startDate, endDate],
    queryFn: async () => {
      const res = await fetch(
        `/api/reports/opex-capex?companyId=${companyId}&startDate=${startDate}&endDate=${endDate}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to fetch OPEX/CAPEX data");
      return res.json();
    },
    enabled: !!companyId && !!startDate && !!endDate,
  });

  const monthly = data?.monthly || [];
  const totalOpex = data?.totalOpex || 0;
  const totalCapex = data?.totalCapex || 0;
  const opexAccounts = data?.opexAccounts || [];
  const capexAccounts = data?.capexAccounts || [];
  const opexRatio = data?.opexRatio || 0;
  const capexRatio = data?.capexRatio || 0;

  const pieData = [
    { name: "OPEX", value: totalOpex },
    { name: "CAPEX", value: totalCapex },
  ].filter(d => d.value > 0);

  const handleExcel = () => {
    const rows: (string | number)[][] = [];
    rows.push(["OPEX/CAPEX Analysis"]);
    rows.push([]);
    rows.push(["เดือน", "OPEX", "CAPEX"]);
    monthly.forEach((m: any) => rows.push([m.month, m.opex, m.capex]));
    rows.push(["รวม", totalOpex, totalCapex]);
    rows.push([]);
    rows.push(["ค่าใช้จ่ายดำเนินงาน (OPEX)"]);
    rows.push(["รหัส", "ชื่อบัญชี", "จำนวนเงิน"]);
    opexAccounts.forEach((a: any) => rows.push([a.code, a.name, a.total]));
    rows.push([]);
    rows.push(["ค่าใช้จ่ายลงทุน (CAPEX)"]);
    rows.push(["รหัส", "ชื่อบัญชี", "จำนวนเงิน"]);
    capexAccounts.forEach((a: any) => rows.push([a.code, a.name, a.total]));

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "OPEX-CAPEX");
    XLSX.writeFile(wb, "opex-capex-analysis.xlsx");
  };

  return (
    <ReportLayout title="OPEX/CAPEX Analysis" subtitle="วิเคราะห์ค่าใช้จ่าย" icon={<BarChart3 className="h-5 w-5" />}>
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
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="border shadow-sm" data-testid="card-total-opex">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground mb-1">OPEX (ค่าใช้จ่ายดำเนินงาน)</div>
                <div className="text-xl font-bold text-[#539BFF] tabular-nums">{fmt(totalOpex)}</div>
                <div className="text-xs text-muted-foreground">{fmt(opexRatio)}%</div>
              </CardContent>
            </Card>
            <Card className="border shadow-sm" data-testid="card-total-capex">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground mb-1">CAPEX (ค่าใช้จ่ายลงทุน)</div>
                <div className="text-xl font-bold text-[#fb9678] tabular-nums">{fmt(totalCapex)}</div>
                <div className="text-xs text-muted-foreground">{fmt(capexRatio)}%</div>
              </CardContent>
            </Card>
            <Card className="border shadow-sm" data-testid="card-total-all">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground mb-1">รวมทั้งหมด</div>
                <div className="text-xl font-bold text-gray-800 tabular-nums">{fmt(totalOpex + totalCapex)}</div>
              </CardContent>
            </Card>
            <Card className="border shadow-sm" data-testid="card-ratio">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground mb-1">สัดส่วน OPEX:CAPEX</div>
                <div className="text-xl font-bold text-gray-800">{fmt(opexRatio)} : {fmt(capexRatio)}</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2 border shadow-sm" data-testid="card-bar-chart">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">OPEX vs CAPEX รายเดือน</CardTitle>
              </CardHeader>
              <CardContent>
                {monthly.length > 0 ? (
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={monthly}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={(v: number) => (v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : String(v))} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: number) => fmt(v)} />
                      <Legend />
                      <Bar dataKey="opex" name="OPEX" stackId="a" fill="#539BFF" />
                      <Bar dataKey="capex" name="CAPEX" stackId="a" fill="#fb9678" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="py-12 text-center text-muted-foreground text-sm">ไม่มีข้อมูล</div>
                )}
              </CardContent>
            </Card>

            <Card className="border shadow-sm" data-testid="card-pie-chart">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">สัดส่วน OPEX / CAPEX</CardTitle>
              </CardHeader>
              <CardContent>
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={320}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(1)}%`}>
                        {pieData.map((_, idx) => (
                          <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => fmt(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="py-12 text-center text-muted-foreground text-sm">ไม่มีข้อมูล</div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border shadow-sm" data-testid="card-opex-detail">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-[#539BFF]">รายละเอียด OPEX ({opexAccounts.length} บัญชี)</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-blue-50/50">
                      <TableHead className="text-xs w-[100px]">รหัส</TableHead>
                      <TableHead className="text-xs">ชื่อบัญชี</TableHead>
                      <TableHead className="text-xs text-right w-[140px]">จำนวนเงิน</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {opexAccounts.length === 0 ? (
                      <TableRow><TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-4">ไม่มีข้อมูล</TableCell></TableRow>
                    ) : opexAccounts.map((a: any, idx: number) => (
                      <TableRow key={a.code} data-testid={`row-opex-${idx}`}>
                        <TableCell className="text-sm tabular-nums">{a.code}</TableCell>
                        <TableCell className="text-sm">{a.nameTh || a.name}</TableCell>
                        <TableCell className="text-sm text-right tabular-nums font-medium">{fmt(a.total)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-blue-50/70 font-bold">
                      <TableCell colSpan={2} className="text-sm text-right">รวม OPEX</TableCell>
                      <TableCell className="text-sm text-right tabular-nums font-bold" data-testid="text-total-opex">{fmt(totalOpex)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="border shadow-sm" data-testid="card-capex-detail">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-[#fb9678]">รายละเอียด CAPEX ({capexAccounts.length} บัญชี)</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-orange-50/50">
                      <TableHead className="text-xs w-[100px]">รหัส</TableHead>
                      <TableHead className="text-xs">ชื่อบัญชี</TableHead>
                      <TableHead className="text-xs text-right w-[140px]">จำนวนเงิน</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {capexAccounts.length === 0 ? (
                      <TableRow><TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-4">ไม่มีข้อมูล</TableCell></TableRow>
                    ) : capexAccounts.map((a: any, idx: number) => (
                      <TableRow key={a.code} data-testid={`row-capex-${idx}`}>
                        <TableCell className="text-sm tabular-nums">{a.code}</TableCell>
                        <TableCell className="text-sm">{a.nameTh || a.name}</TableCell>
                        <TableCell className="text-sm text-right tabular-nums font-medium">{fmt(a.total)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-orange-50/70 font-bold">
                      <TableCell colSpan={2} className="text-sm text-right">รวม CAPEX</TableCell>
                      <TableCell className="text-sm text-right tabular-nums font-bold" data-testid="text-total-capex">{fmt(totalCapex)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </ReportLayout>
  );
}
