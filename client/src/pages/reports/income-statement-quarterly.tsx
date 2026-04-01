import { useState } from "react";
import ReportLayout from "@/components/report-layout";
import { useCompany } from "@/lib/company-context";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, Printer, RefreshCw, FileDown } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import * as XLSX from "xlsx";
import { useLocation } from "wouter";
import { useLanguage } from "@/hooks/use-language";

function fmt(val: number): string {
  if (val === 0) return "-";
  return val.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtM(val: number): string {
  if (Math.abs(val) >= 1_000_000) return (val / 1_000_000).toFixed(1) + "M";
  if (Math.abs(val) >= 1_000) return (val / 1_000).toFixed(0) + "K";
  return val.toFixed(0);
}

export default function IncomeStatementQuarterly() {
  const [, navigate] = useLocation();
  const { selectedCompany } = useCompany();
  const { acctName } = useLanguage();
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

  const quarters = [
    { label: "Q1 (ม.ค.-มี.ค.)", months: [1, 2, 3] },
    { label: "Q2 (เม.ย.-มิ.ย.)", months: [4, 5, 6] },
    { label: "Q3 (ก.ค.-ก.ย.)", months: [7, 8, 9] },
    { label: "Q4 (ต.ค.-ธ.ค.)", months: [10, 11, 12] },
  ];

  const quarterData = quarters.map(q => {
    const qMonths = data?.months?.filter((m: any) => q.months.includes(m.month)) || [];
    return {
      label: q.label,
      revenue: qMonths.reduce((s: number, m: any) => s + m.totalRevenue, 0),
      expense: qMonths.reduce((s: number, m: any) => s + m.totalExpense, 0),
      netIncome: qMonths.reduce((s: number, m: any) => s + m.netIncome, 0),
    };
  });

  const totalYear = {
    revenue: quarterData.reduce((s, q) => s + q.revenue, 0),
    expense: quarterData.reduce((s, q) => s + q.expense, 0),
    netIncome: quarterData.reduce((s, q) => s + q.netIncome, 0),
  };

  const chartData = quarterData.map(q => ({
    name: q.label.split(" ")[0],
    รายได้: q.revenue,
    ค่าใช้จ่าย: q.expense,
    กำไรสุทธิ: q.netIncome,
  }));

  const accountQuarters = data?.accountDetails?.map((a: any) => {
    const qVals = quarters.map(q => {
      const qm = q.months.map(m => m - 1);
      return qm.reduce((s: number, mi: number) => s + (a.months[mi] || 0), 0);
    });
    return { ...a, qVals, total: qVals.reduce((s: number, v: number) => s + v, 0) };
  }) || [];

  const handleExcel = () => {
    const rows: any[][] = [["รายการ", "Q1", "Q2", "Q3", "Q4", "รวมทั้งปี"]];
    rows.push(["รายได้รวม", ...quarterData.map(q => q.revenue), totalYear.revenue]);
    rows.push(["ค่าใช้จ่ายรวม", ...quarterData.map(q => q.expense), totalYear.expense]);
    rows.push(["กำไร(ขาดทุน)สุทธิ", ...quarterData.map(q => q.netIncome), totalYear.netIncome]);
    if (accountQuarters.length > 0) {
      rows.push([]);
      rows.push(["รหัส-ชื่อบัญชี", "Q1", "Q2", "Q3", "Q4", "รวม"]);
      accountQuarters.forEach((a: any) => rows.push([`${a.code} ${a.name}`, ...a.qVals, a.total]));
    }
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "PL-Quarterly");
    XLSX.writeFile(wb, `income-statement-quarterly-${year}.xlsx`);
  };

  return (
    <ReportLayout fullWidth title="งบกำไร/ขาดทุนเปรียบเทียบรายไตรมาส" icon={<TrendingUp className="h-5 w-5" />}>
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
        <>
          <Card className="border-0 shadow-md">
            <CardContent className="p-4">
              <div className="text-center mb-4">
                <h2 className="text-lg font-bold">{selectedCompany?.name}</h2>
                <p className="text-sm text-muted-foreground">งบกำไร/ขาดทุนเปรียบเทียบรายไตรมาส — ปี {Number(year) + 543}</p>
              </div>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
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
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="text-xs">รายการ</TableHead>
                    {quarters.map(q => <TableHead key={q.label} className="text-right text-xs">{q.label.split(" ")[0]}</TableHead>)}
                    <TableHead className="text-right text-xs bg-blue-50 font-bold">รวมทั้งปี</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow className="bg-[#03c9d7]/10 font-semibold">
                    <TableCell>รายได้รวม</TableCell>
                    {quarterData.map((q, i) => <TableCell key={i} className="text-right font-mono text-sm">{fmt(q.revenue)}</TableCell>)}
                    <TableCell className="text-right font-mono text-sm font-bold bg-blue-50">{fmt(totalYear.revenue)}</TableCell>
                  </TableRow>
                  <TableRow className="bg-[#fb9678]/10 font-semibold">
                    <TableCell>ค่าใช้จ่ายรวม</TableCell>
                    {quarterData.map((q, i) => <TableCell key={i} className="text-right font-mono text-sm">{fmt(q.expense)}</TableCell>)}
                    <TableCell className="text-right font-mono text-sm font-bold bg-blue-50">{fmt(totalYear.expense)}</TableCell>
                  </TableRow>
                  <TableRow className="bg-gray-100 font-bold border-t-2">
                    <TableCell>กำไร(ขาดทุน)สุทธิ</TableCell>
                    {quarterData.map((q, i) => (
                      <TableCell key={i} className={`text-right font-mono text-sm ${q.netIncome >= 0 ? "text-green-600" : "text-red-500"}`}>{fmt(q.netIncome)}</TableCell>
                    ))}
                    <TableCell className={`text-right font-mono text-sm font-bold bg-blue-50 ${totalYear.netIncome >= 0 ? "text-green-600" : "text-red-500"}`}>{fmt(totalYear.netIncome)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>

              {accountQuarters.length > 0 && (
                <div className="border-t mt-4">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="text-xs">รหัส — ชื่อบัญชี</TableHead>
                        <TableHead className="text-right text-xs">Q1</TableHead>
                        <TableHead className="text-right text-xs">Q2</TableHead>
                        <TableHead className="text-right text-xs">Q3</TableHead>
                        <TableHead className="text-right text-xs">Q4</TableHead>
                        <TableHead className="text-right text-xs bg-blue-50 font-bold">รวม</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {accountQuarters.filter((a: any) => a.type === "revenue").length > 0 && (
                        <TableRow><TableCell colSpan={6} className="bg-[#03c9d7] text-white font-bold text-xs py-1">รายได้</TableCell></TableRow>
                      )}
                      {accountQuarters.filter((a: any) => a.type === "revenue").map((a: any) => (
                        <TableRow key={a.code}>
                          <TableCell className="text-xs">{a.code} {acctName(a)}</TableCell>
                          {a.qVals.map((v: number, i: number) => <TableCell key={i} className="text-right font-mono text-xs">{fmt(v)}</TableCell>)}
                          <TableCell className="text-right font-mono text-xs font-bold bg-blue-50">{fmt(a.total)}</TableCell>
                        </TableRow>
                      ))}
                      {accountQuarters.filter((a: any) => a.type === "expense").length > 0 && (
                        <TableRow><TableCell colSpan={6} className="bg-[#fb9678] text-white font-bold text-xs py-1">ค่าใช้จ่าย</TableCell></TableRow>
                      )}
                      {accountQuarters.filter((a: any) => a.type === "expense").map((a: any) => (
                        <TableRow key={a.code}>
                          <TableCell className="text-xs">{a.code} {acctName(a)}</TableCell>
                          {a.qVals.map((v: number, i: number) => <TableCell key={i} className="text-right font-mono text-xs">{fmt(v)}</TableCell>)}
                          <TableCell className="text-right font-mono text-xs font-bold bg-blue-50">{fmt(a.total)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <div className="text-center py-12 text-muted-foreground">กรุณาเลือกปี</div>
      )}
    </ReportLayout>
  );
}