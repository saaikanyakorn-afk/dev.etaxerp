import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import ReportLayout from "@/components/report-layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useCompany } from "@/lib/company-context";
import { Calendar as CalendarIcon, FileText, BarChart3, Printer, TrendingUp } from "lucide-react";
import ThaiDateInput from "@/components/thai-date-input";
import { useDateSettings } from "@/hooks/use-date-settings";
import { toLocalDateStr } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import ListExportButton from "@/components/list-export-button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const DOC_TYPES = [
  { value: "taxInvoice", label: "ใบกำกับภาษี" },
  { value: "invoice", label: "ใบแจ้งหนี้" },
  { value: "quotation", label: "ใบเสนอราคา" },
  { value: "salesOrder", label: "ใบสั่งขาย" },
];

function fmt(val: number | string | null | undefined): string {
  const n = parseFloat(String(val || "0"));
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function DailySalesSummary() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const { dateEra, dateFmt } = useDateSettings();

  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const [docType, setDocType] = useState("taxInvoice");
  const [dateFrom, setDateFrom] = useState(monthStart);
  const [dateTo, setDateTo] = useState(toLocalDateStr(now));

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/reports/daily-sales-summary", companyId, docType, dateFrom, dateTo],
    queryFn: async () => {
      if (!companyId) return null;
      const params = new URLSearchParams({ companyId: String(companyId), docType, dateFrom, dateTo });
      const res = await fetch(`/api/reports/daily-sales-summary?${params}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!companyId,
  });

  const days = data?.days || [];
  const summary = data?.summary || { totalDocs: 0, totalAmount: 0 };

  const chartData = useMemo(() => {
    return days.map((d: any) => ({
      date: d.day,
      amount: parseFloat(d.totalAmount || "0"),
      count: d.count,
    }));
  }, [days]);

  const maxDay = useMemo(() => {
    if (days.length === 0) return null;
    return days.reduce((max: any, d: any) => parseFloat(d.totalAmount || "0") > parseFloat(max.totalAmount || "0") ? d : max, days[0]);
  }, [days]);

  const avgPerDay = summary.totalDocs > 0 && days.length > 0 ? summary.totalAmount / days.length : 0;

  const exportData = useMemo(() => {
    return days.map((d: any) => ({
      date: d.day, count: d.count, subtotal: parseFloat(d.totalSubtotal || "0"),
      vat: parseFloat(d.totalVat || "0"), total: parseFloat(d.totalAmount || "0"),
    }));
  }, [days]);

  const exportColumns = [
    { header: "วันที่", key: "date", width: 14 },
    { header: "จำนวนเอกสาร", key: "count", width: 14 },
    { header: "ยอดก่อนภาษี", key: "subtotal", width: 16, format: "number" as const },
    { header: "ภาษี", key: "vat", width: 14, format: "number" as const },
    { header: "ยอดรวม", key: "total", width: 16, format: "number" as const },
  ];

  return (
    <ReportLayout title="R12: ยอดขายรายวัน" icon={<CalendarIcon className="h-5 w-5" />}>
      <div className="flex justify-end mb-2 gap-2">
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => window.print()} data-testid="button-print"><Printer className="h-3.5 w-3.5" /> พิมพ์</Button>
        <ListExportButton data={exportData} columns={exportColumns} fileName="R12-ยอดขายรายวัน" />
      </div>

      <Card className="rounded border shadow-sm bg-white">
        <CardHeader className="p-3 border-b">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger className="w-40 h-8 text-xs bg-white border rounded-lg" data-testid="select-doc-type"><SelectValue /></SelectTrigger>
                <SelectContent>{DOC_TYPES.map(dt => <SelectItem key={dt.value} value={dt.value}>{dt.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
              <ThaiDateInput value={dateFrom} onChange={setDateFrom} dateEra={dateEra} dateFmt={dateFmt} className="w-[160px]" data-testid="input-date-from" />
              <span className="text-xs text-gray-500">ถึง</span>
              <ThaiDateInput value={dateTo} onChange={setDateTo} dateEra={dateEra} dateFmt={dateFmt} className="w-[160px]" data-testid="input-date-to" />
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "จำนวนเอกสาร", value: summary.totalDocs.toLocaleString("th-TH"), color: "#fb9678" },
          { label: "ยอดรวม", value: fmt(summary.totalAmount), color: "#03c9d7" },
          { label: "เฉลี่ย/วัน", value: fmt(avgPerDay), color: "#05b187" },
          { label: "วันที่ขายสูงสุด", value: maxDay ? formatDate(maxDay.day, dateEra, dateFmt) : "-", color: "#fec90f" },
        ].map((stat, i) => (
          <Card key={i} className="rounded border shadow-sm bg-white">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className="text-xl font-bold" style={{ color: stat.color }} data-testid={`text-stat-${i}`}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {chartData.length > 0 && (
        <Card className="rounded border shadow-sm bg-white">
          <CardHeader className="p-3 border-b">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[#03c9d7]" />
              <span className="text-sm font-medium text-slate-700">กราฟยอดขายรายวัน</span>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => (v / 1000).toFixed(0) + "K"} />
                <Tooltip formatter={(v: number) => fmt(v)} labelFormatter={(l: string) => `วันที่: ${l}`} />
                <Bar dataKey="amount" fill="#03c9d7" radius={[4, 4, 0, 0]} name="ยอดขาย" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card className="rounded border shadow-sm bg-white">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">กำลังโหลด...</div>
          ) : days.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CalendarIcon className="h-12 w-12 mx-auto mb-3 text-slate-300" />
              <p className="text-sm" data-testid="text-empty-state">ไม่พบข้อมูล</p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-100">
                <TableRow className="hover:bg-transparent h-11">
                  <TableHead className="w-[50px] text-sm font-medium text-slate-700">#</TableHead>
                  <TableHead className="text-sm font-medium text-slate-700">วันที่</TableHead>
                  <TableHead className="w-[120px] text-center text-sm font-medium text-slate-700">จำนวนเอกสาร</TableHead>
                  <TableHead className="w-[150px] text-right text-sm font-medium text-slate-700">ยอดก่อนภาษี</TableHead>
                  <TableHead className="w-[130px] text-right text-sm font-medium text-slate-700">ภาษี</TableHead>
                  <TableHead className="w-[150px] text-right text-sm font-medium text-slate-700">ยอดรวม</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {days.map((d: any, idx: number) => (
                  <TableRow key={idx} className="hover:bg-slate-50/50" data-testid={`row-day-${idx}`}>
                    <TableCell className="text-xs py-2 text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell className="text-sm py-2 font-medium">{formatDate(d.day, dateEra, dateFmt)}</TableCell>
                    <TableCell className="text-sm py-2 text-center">{d.count}</TableCell>
                    <TableCell className="text-sm py-2 text-right tabular-nums">{fmt(d.totalSubtotal)}</TableCell>
                    <TableCell className="text-sm py-2 text-right tabular-nums">{fmt(d.totalVat)}</TableCell>
                    <TableCell className="text-sm py-2 text-right font-medium tabular-nums">{fmt(d.totalAmount)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-slate-100 font-bold">
                  <TableCell colSpan={2} className="text-sm">รวมทั้งหมด</TableCell>
                  <TableCell className="text-sm text-center">{summary.totalDocs}</TableCell>
                  <TableCell className="text-sm text-right tabular-nums">{fmt(days.reduce((s: number, d: any) => s + parseFloat(d.totalSubtotal || "0"), 0))}</TableCell>
                  <TableCell className="text-sm text-right tabular-nums">{fmt(days.reduce((s: number, d: any) => s + parseFloat(d.totalVat || "0"), 0))}</TableCell>
                  <TableCell className="text-sm text-right tabular-nums">{fmt(summary.totalAmount)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </ReportLayout>
  );
}
