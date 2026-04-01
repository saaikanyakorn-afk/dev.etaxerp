import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import ReportLayout from "@/components/report-layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCompany } from "@/lib/company-context";
import { TrendingUp, BarChart3, Printer, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import ListExportButton from "@/components/list-export-button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const DOC_TYPES = [
  { value: "taxInvoice", label: "ใบกำกับภาษี" },
  { value: "invoice", label: "ใบแจ้งหนี้" },
  { value: "quotation", label: "ใบเสนอราคา" },
  { value: "salesOrder", label: "ใบสั่งขาย" },
];

const MONTH_NAMES = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

function fmt(val: number | string | null | undefined): string {
  const n = parseFloat(String(val || "0"));
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function SalesMonthlyComparison() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;

  const now = new Date();
  const [year, setYear] = useState(String(now.getFullYear()));
  const [docType, setDocType] = useState("taxInvoice");

  const yearNum = parseInt(year);
  const years = Array.from({ length: 5 }, (_, i) => String(now.getFullYear() - i));

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/reports/sales-monthly-comparison", companyId, yearNum, docType],
    queryFn: async () => {
      if (!companyId) return null;
      const params = new URLSearchParams({ companyId: String(companyId), year, docType });
      const res = await fetch(`/api/reports/sales-monthly-comparison?${params}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!companyId,
  });

  const months = data?.months || [];

  const chartData = useMemo(() => {
    return months.map((m: any) => ({
      name: MONTH_NAMES[m.month - 1],
      current: m.currentAmount,
      previous: m.previousAmount,
    }));
  }, [months]);

  const totalCurrent = months.reduce((s: number, m: any) => s + m.currentAmount, 0);
  const totalPrevious = months.reduce((s: number, m: any) => s + m.previousAmount, 0);
  const totalChange = totalPrevious > 0 ? ((totalCurrent - totalPrevious) / totalPrevious) * 100 : totalCurrent > 0 ? 100 : 0;

  const exportData = useMemo(() => {
    return months.map((m: any) => ({
      month: MONTH_NAMES[m.month - 1],
      currentAmount: m.currentAmount, currentCount: m.currentCount,
      previousAmount: m.previousAmount, previousCount: m.previousCount,
      changePercent: m.changePercent,
    }));
  }, [months]);

  const exportColumns = [
    { header: "เดือน", key: "month", width: 12 },
    { header: `ยอดปี ${yearNum + 543}`, key: "currentAmount", width: 16, format: "number" as const },
    { header: `เอกสารปี ${yearNum + 543}`, key: "currentCount", width: 14 },
    { header: `ยอดปี ${yearNum + 542}`, key: "previousAmount", width: 16, format: "number" as const },
    { header: `เอกสารปี ${yearNum + 542}`, key: "previousCount", width: 14 },
    { header: "เปลี่ยนแปลง %", key: "changePercent", width: 14, format: "number" as const },
  ];

  return (
    <ReportLayout title="R14: ยอดขายเปรียบเทียบรายเดือน" icon={<TrendingUp className="h-5 w-5" />}>
      <div className="flex justify-end mb-2 gap-2">
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => window.print()} data-testid="button-print"><Printer className="h-3.5 w-3.5" /> พิมพ์</Button>
        <ListExportButton data={exportData} columns={exportColumns} fileName="R14-ยอดขายเปรียบเทียบรายเดือน" />
      </div>

      <Card className="rounded border shadow-sm bg-white">
        <CardHeader className="p-3 border-b">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">ประเภท:</span>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger className="w-40 h-8 text-xs bg-white border rounded-lg" data-testid="select-doc-type"><SelectValue /></SelectTrigger>
                <SelectContent>{DOC_TYPES.map(dt => <SelectItem key={dt.value} value={dt.value}>{dt.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">ปี (พ.ศ.):</span>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger className="w-28 h-8 text-xs bg-white border rounded-lg" data-testid="select-year"><SelectValue /></SelectTrigger>
                <SelectContent>{years.map(y => <SelectItem key={y} value={y}>{parseInt(y) + 543}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="rounded border shadow-sm bg-white">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">ยอดรวมปี {yearNum + 543}</p>
            <p className="text-xl font-bold text-[#03c9d7]" data-testid="text-total-current">{fmt(totalCurrent)}</p>
          </CardContent>
        </Card>
        <Card className="rounded border shadow-sm bg-white">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">ยอดรวมปี {yearNum + 542}</p>
            <p className="text-xl font-bold text-[#fb9678]" data-testid="text-total-previous">{fmt(totalPrevious)}</p>
          </CardContent>
        </Card>
        <Card className="rounded border shadow-sm bg-white">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">เปลี่ยนแปลง</p>
            <div className="flex items-center gap-2">
              <p className={`text-xl font-bold ${totalChange > 0 ? "text-[#05b187]" : totalChange < 0 ? "text-[#f94d4d]" : "text-slate-500"}`} data-testid="text-total-change">
                {totalChange > 0 ? "+" : ""}{totalChange.toFixed(2)}%
              </p>
              {totalChange > 0 ? <ArrowUpRight className="h-5 w-5 text-[#05b187]" /> : totalChange < 0 ? <ArrowDownRight className="h-5 w-5 text-[#f94d4d]" /> : <Minus className="h-5 w-5 text-slate-400" />}
            </div>
          </CardContent>
        </Card>
      </div>

      {chartData.length > 0 && (
        <Card className="rounded border shadow-sm bg-white">
          <CardHeader className="p-3 border-b">
            <span className="text-sm font-medium text-slate-700">กราฟเปรียบเทียบยอดขายรายเดือน</span>
          </CardHeader>
          <CardContent className="p-4">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => (v / 1000).toFixed(0) + "K"} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Legend />
                <Bar dataKey="current" fill="#03c9d7" name={`ปี ${yearNum + 543}`} radius={[4, 4, 0, 0]} />
                <Bar dataKey="previous" fill="#fb9678" name={`ปี ${yearNum + 542}`} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card className="rounded border shadow-sm bg-white">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">กำลังโหลด...</div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-100">
                <TableRow className="hover:bg-transparent h-11">
                  <TableHead className="text-sm font-medium text-slate-700">เดือน</TableHead>
                  <TableHead className="text-right text-sm font-medium text-slate-700">ยอดปี {yearNum + 543}</TableHead>
                  <TableHead className="text-center text-sm font-medium text-slate-700 w-[80px]">เอกสาร</TableHead>
                  <TableHead className="text-right text-sm font-medium text-slate-700">ยอดปี {yearNum + 542}</TableHead>
                  <TableHead className="text-center text-sm font-medium text-slate-700 w-[80px]">เอกสาร</TableHead>
                  <TableHead className="text-center text-sm font-medium text-slate-700 w-[120px]">เปลี่ยนแปลง</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {months.map((m: any, idx: number) => (
                  <TableRow key={idx} className="hover:bg-slate-50/50" data-testid={`row-month-${idx}`}>
                    <TableCell className="text-sm font-medium">{MONTH_NAMES[m.month - 1]}</TableCell>
                    <TableCell className="text-sm text-right tabular-nums font-medium">{fmt(m.currentAmount)}</TableCell>
                    <TableCell className="text-sm text-center">{m.currentCount}</TableCell>
                    <TableCell className="text-sm text-right tabular-nums">{fmt(m.previousAmount)}</TableCell>
                    <TableCell className="text-sm text-center">{m.previousCount}</TableCell>
                    <TableCell className="text-center">
                      <Badge className={`border-0 text-xs ${m.changePercent > 0 ? "bg-[#05b18715] text-[#05b187]" : m.changePercent < 0 ? "bg-[#f94d4d15] text-[#f94d4d]" : "bg-slate-100 text-slate-500"}`}>
                        {m.changePercent > 0 ? "+" : ""}{m.changePercent.toFixed(1)}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-slate-100 font-bold">
                  <TableCell className="text-sm">รวมทั้งปี</TableCell>
                  <TableCell className="text-sm text-right tabular-nums">{fmt(totalCurrent)}</TableCell>
                  <TableCell className="text-sm text-center">{months.reduce((s: number, m: any) => s + m.currentCount, 0)}</TableCell>
                  <TableCell className="text-sm text-right tabular-nums">{fmt(totalPrevious)}</TableCell>
                  <TableCell className="text-sm text-center">{months.reduce((s: number, m: any) => s + m.previousCount, 0)}</TableCell>
                  <TableCell className="text-center">
                    <Badge className={`border-0 text-xs font-bold ${totalChange > 0 ? "bg-[#05b18715] text-[#05b187]" : totalChange < 0 ? "bg-[#f94d4d15] text-[#f94d4d]" : "bg-slate-100 text-slate-500"}`}>
                      {totalChange > 0 ? "+" : ""}{totalChange.toFixed(1)}%
                    </Badge>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </ReportLayout>
  );
}
