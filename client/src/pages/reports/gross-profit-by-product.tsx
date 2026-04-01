import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import ReportLayout from "@/components/report-layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCompany } from "@/lib/company-context";
import { TrendingUp, Calendar as CalendarIcon, DollarSign, Percent, Printer, Package } from "lucide-react";
import ThaiDateInput from "@/components/thai-date-input";
import { useDateSettings } from "@/hooks/use-date-settings";
import { toLocalDateStr } from "@/lib/utils";
import ListExportButton from "@/components/list-export-button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

function fmt(val: number | string | null | undefined): string {
  const n = parseFloat(String(val || "0"));
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function GrossProfitByProduct() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const { dateEra, dateFmt } = useDateSettings();

  const now = new Date();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState(toLocalDateStr(now));

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/reports/gross-profit-by-product", companyId, dateFrom, dateTo],
    queryFn: async () => {
      if (!companyId) return null;
      const params = new URLSearchParams({ companyId: String(companyId), dateFrom, dateTo });
      const res = await fetch(`/api/reports/gross-profit-by-product?${params}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!companyId,
  });

  const products = data?.products || [];
  const summary = data?.summary || { totalRevenue: 0, totalCost: 0, totalProfit: 0, avgMargin: 0 };

  const chartData = useMemo(() => {
    return products.slice(0, 10).map((p: any) => ({
      name: (p.productName || "").substring(0, 20),
      revenue: p.revenue,
      cost: p.totalCost,
      profit: p.profit,
    }));
  }, [products]);

  const exportData = useMemo(() => {
    return products.map((p: any, idx: number) => ({
      no: idx + 1, productCode: p.productCode || "-", productName: p.productName,
      qty: p.qty, revenue: p.revenue, costPerUnit: p.costPerUnit,
      totalCost: p.totalCost, profit: p.profit, margin: p.margin,
    }));
  }, [products]);

  const exportColumns = [
    { header: "#", key: "no", width: 8 },
    { header: "รหัสสินค้า", key: "productCode", width: 15 },
    { header: "ชื่อสินค้า", key: "productName", width: 30 },
    { header: "จำนวน", key: "qty", width: 12, format: "number" as const },
    { header: "ยอดขาย", key: "revenue", width: 16, format: "number" as const },
    { header: "ต้นทุน/หน่วย", key: "costPerUnit", width: 14, format: "number" as const },
    { header: "ต้นทุนรวม", key: "totalCost", width: 16, format: "number" as const },
    { header: "กำไรขั้นต้น", key: "profit", width: 16, format: "number" as const },
    { header: "Margin %", key: "margin", width: 12, format: "number" as const },
  ];

  return (
    <ReportLayout title="R15: กำไรขั้นต้น - ตามสินค้า" icon={<TrendingUp className="h-5 w-5" />}>
      <div className="flex justify-end mb-2 gap-2">
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => window.print()} data-testid="button-print"><Printer className="h-3.5 w-3.5" /> พิมพ์</Button>
        <ListExportButton data={exportData} columns={exportColumns} fileName="R15-กำไรขั้นต้นตามสินค้า" />
      </div>

      <Card className="rounded border shadow-sm bg-white">
        <CardHeader className="p-3 border-b">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">ช่วงวันที่:</span>
              <ThaiDateInput value={dateFrom} onChange={setDateFrom} dateEra={dateEra} dateFmt={dateFmt} className="w-[160px]" data-testid="input-date-from" />
              <span className="text-xs text-gray-500">ถึง</span>
              <ThaiDateInput value={dateTo} onChange={setDateTo} dateEra={dateEra} dateFmt={dateFmt} className="w-[160px]" data-testid="input-date-to" />
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "ยอดขายรวม", value: fmt(summary.totalRevenue), color: "#03c9d7", icon: DollarSign },
          { label: "ต้นทุนรวม", value: fmt(summary.totalCost), color: "#fb9678", icon: Package },
          { label: "กำไรขั้นต้นรวม", value: fmt(summary.totalProfit), color: "#05b187", icon: TrendingUp },
          { label: "Margin เฉลี่ย", value: `${summary.avgMargin}%`, color: "#fec90f", icon: Percent },
        ].map((stat, i) => (
          <Card key={i} className="rounded border shadow-sm bg-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: stat.color + "15" }}>
                  <stat.icon className="h-5 w-5" style={{ color: stat.color }} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="text-xl font-bold" style={{ color: stat.color }} data-testid={`text-stat-${i}`}>{stat.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {chartData.length > 0 && (
        <Card className="rounded border shadow-sm bg-white">
          <CardHeader className="p-3 border-b">
            <span className="text-sm font-medium text-slate-700">Top 10 กำไรขั้นต้นตามสินค้า</span>
          </CardHeader>
          <CardContent className="p-4">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v: number) => (v / 1000).toFixed(0) + "K"} />
                <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Bar dataKey="revenue" fill="#03c9d7" name="ยอดขาย" stackId="a" />
                <Bar dataKey="profit" fill="#05b187" name="กำไร" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card className="rounded border shadow-sm bg-white">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">กำลังโหลด...</div>
          ) : products.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <TrendingUp className="h-12 w-12 mx-auto mb-3 text-slate-300" />
              <p className="text-sm" data-testid="text-empty-state">ไม่พบข้อมูล</p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-100">
                <TableRow className="hover:bg-transparent h-11">
                  <TableHead className="w-[50px] text-sm font-medium text-slate-700">#</TableHead>
                  <TableHead className="w-[110px] text-sm font-medium text-slate-700">รหัสสินค้า</TableHead>
                  <TableHead className="text-sm font-medium text-slate-700">ชื่อสินค้า</TableHead>
                  <TableHead className="w-[80px] text-right text-sm font-medium text-slate-700">จำนวน</TableHead>
                  <TableHead className="w-[120px] text-right text-sm font-medium text-slate-700">ยอดขาย</TableHead>
                  <TableHead className="w-[100px] text-right text-sm font-medium text-slate-700">ต้นทุน/หน่วย</TableHead>
                  <TableHead className="w-[120px] text-right text-sm font-medium text-slate-700">ต้นทุนรวม</TableHead>
                  <TableHead className="w-[120px] text-right text-sm font-medium text-slate-700">กำไรขั้นต้น</TableHead>
                  <TableHead className="w-[90px] text-center text-sm font-medium text-slate-700">Margin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p: any, idx: number) => (
                  <TableRow key={idx} className="hover:bg-slate-50/50" data-testid={`row-product-${idx}`}>
                    <TableCell className="text-xs py-2 text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell className="text-xs py-2 font-mono">{p.productCode || "-"}</TableCell>
                    <TableCell className="text-sm py-2 font-medium">{p.productName}</TableCell>
                    <TableCell className="text-sm py-2 text-right tabular-nums">{fmt(p.qty)}</TableCell>
                    <TableCell className="text-sm py-2 text-right tabular-nums">{fmt(p.revenue)}</TableCell>
                    <TableCell className="text-sm py-2 text-right tabular-nums">{fmt(p.costPerUnit)}</TableCell>
                    <TableCell className="text-sm py-2 text-right tabular-nums">{fmt(p.totalCost)}</TableCell>
                    <TableCell className={`text-sm py-2 text-right font-medium tabular-nums ${p.profit >= 0 ? "text-[#05b187]" : "text-[#f94d4d]"}`}>{fmt(p.profit)}</TableCell>
                    <TableCell className="text-center py-2">
                      <Badge className={`border-0 text-xs ${p.margin >= 20 ? "bg-[#05b18715] text-[#05b187]" : p.margin >= 0 ? "bg-[#fec90f15] text-[#b8860b]" : "bg-[#f94d4d15] text-[#f94d4d]"}`}>
                        {p.margin.toFixed(1)}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-slate-100 font-bold">
                  <TableCell colSpan={4} className="text-sm">รวมทั้งหมด</TableCell>
                  <TableCell className="text-sm text-right tabular-nums">{fmt(summary.totalRevenue)}</TableCell>
                  <TableCell></TableCell>
                  <TableCell className="text-sm text-right tabular-nums">{fmt(summary.totalCost)}</TableCell>
                  <TableCell className={`text-sm text-right tabular-nums ${summary.totalProfit >= 0 ? "text-[#05b187]" : "text-[#f94d4d]"}`}>{fmt(summary.totalProfit)}</TableCell>
                  <TableCell className="text-center">
                    <Badge className={`border-0 text-xs font-bold ${summary.avgMargin >= 20 ? "bg-[#05b18715] text-[#05b187]" : "bg-[#fec90f15] text-[#b8860b]"}`}>
                      {summary.avgMargin}%
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
