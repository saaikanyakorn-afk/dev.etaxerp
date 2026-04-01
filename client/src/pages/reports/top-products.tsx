import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import ReportLayout from "@/components/report-layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCompany } from "@/lib/company-context";
import { Trophy, Calendar as CalendarIcon, BarChart3, Printer, Package } from "lucide-react";
import ThaiDateInput from "@/components/thai-date-input";
import { useDateSettings } from "@/hooks/use-date-settings";
import { toLocalDateStr } from "@/lib/utils";
import ListExportButton from "@/components/list-export-button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

function fmt(val: number | string | null | undefined): string {
  const n = parseFloat(String(val || "0"));
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function TopProducts() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const { dateEra, dateFmt } = useDateSettings();

  const now = new Date();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState(toLocalDateStr(now));
  const [sortBy, setSortBy] = useState("revenue");
  const [limit, setLimit] = useState("20");

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/reports/top-products", companyId, dateFrom, dateTo, sortBy, limit],
    queryFn: async () => {
      if (!companyId) return null;
      const params = new URLSearchParams({ companyId: String(companyId), dateFrom, dateTo, sortBy, limit });
      const res = await fetch(`/api/reports/top-products?${params}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!companyId,
  });

  const products = data?.products || [];
  const summary = data?.summary || { totalRevenue: 0, totalQty: 0, totalProducts: 0 };

  const chartData = useMemo(() => {
    return products.slice(0, 10).map((p: any) => ({
      name: (p.productName || "").substring(0, 20),
      revenue: parseFloat(p.totalRevenue || "0"),
      qty: parseFloat(p.totalQty || "0"),
    }));
  }, [products]);

  const exportData = useMemo(() => {
    return products.map((p: any, idx: number) => ({
      rank: idx + 1, productCode: p.productCode || "-", productName: p.productName,
      unit: p.unit || "-", totalQty: parseFloat(p.totalQty || "0"),
      totalRevenue: parseFloat(p.totalRevenue || "0"), docCount: p.docCount,
    }));
  }, [products]);

  const exportColumns = [
    { header: "อันดับ", key: "rank", width: 10 },
    { header: "รหัสสินค้า", key: "productCode", width: 15 },
    { header: "ชื่อสินค้า", key: "productName", width: 30 },
    { header: "หน่วย", key: "unit", width: 10 },
    { header: "จำนวน", key: "totalQty", width: 14, format: "number" as const },
    { header: "ยอดขาย", key: "totalRevenue", width: 16, format: "number" as const },
    { header: "จำนวนเอกสาร", key: "docCount", width: 14 },
  ];

  const medalColors = ["#FFD700", "#C0C0C0", "#CD7F32"];

  return (
    <ReportLayout title="R13: Top สินค้าขายดี" icon={<Trophy className="h-5 w-5" />}>
      <div className="flex justify-end mb-2 gap-2">
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => window.print()} data-testid="button-print"><Printer className="h-3.5 w-3.5" /> พิมพ์</Button>
        <ListExportButton data={exportData} columns={exportColumns} fileName="R13-สินค้าขายดี" />
      </div>

      <Card className="rounded border shadow-sm bg-white">
        <CardHeader className="p-3 border-b">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
              <ThaiDateInput value={dateFrom} onChange={setDateFrom} dateEra={dateEra} dateFmt={dateFmt} className="w-[160px]" data-testid="input-date-from" />
              <span className="text-xs text-gray-500">ถึง</span>
              <ThaiDateInput value={dateTo} onChange={setDateTo} dateEra={dateEra} dateFmt={dateFmt} className="w-[160px]" data-testid="input-date-to" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">เรียงตาม:</span>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-32 h-8 text-xs bg-white border rounded-lg" data-testid="select-sort-by"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="revenue">ยอดขาย</SelectItem>
                  <SelectItem value="qty">จำนวน</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">แสดง:</span>
              <Select value={limit} onValueChange={setLimit}>
                <SelectTrigger className="w-24 h-8 text-xs bg-white border rounded-lg" data-testid="select-limit"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">Top 10</SelectItem>
                  <SelectItem value="20">Top 20</SelectItem>
                  <SelectItem value="50">Top 50</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "จำนวนสินค้า", value: summary.totalProducts.toLocaleString("th-TH"), color: "#fb9678", icon: Package },
          { label: "จำนวนรวม", value: fmt(summary.totalQty), color: "#03c9d7", icon: BarChart3 },
          { label: "ยอดขายรวม", value: fmt(summary.totalRevenue), color: "#05b187", icon: Trophy },
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
            <span className="text-sm font-medium text-slate-700">Top 10 สินค้าขายดี ({sortBy === "revenue" ? "ยอดขาย" : "จำนวน"})</span>
          </CardHeader>
          <CardContent className="p-4">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v: number) => sortBy === "revenue" ? (v / 1000).toFixed(0) + "K" : String(v)} />
                <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => sortBy === "revenue" ? fmt(v) : v.toLocaleString("th-TH")} />
                <Bar dataKey={sortBy === "revenue" ? "revenue" : "qty"} fill="#fec90f" radius={[0, 4, 4, 0]} name={sortBy === "revenue" ? "ยอดขาย" : "จำนวน"} />
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
              <Trophy className="h-12 w-12 mx-auto mb-3 text-slate-300" />
              <p className="text-sm" data-testid="text-empty-state">ไม่พบข้อมูล</p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-100">
                <TableRow className="hover:bg-transparent h-11">
                  <TableHead className="w-[60px] text-center text-sm font-medium text-slate-700">อันดับ</TableHead>
                  <TableHead className="w-[110px] text-sm font-medium text-slate-700">รหัสสินค้า</TableHead>
                  <TableHead className="text-sm font-medium text-slate-700">ชื่อสินค้า</TableHead>
                  <TableHead className="w-[80px] text-sm font-medium text-slate-700">หน่วย</TableHead>
                  <TableHead className="w-[110px] text-right text-sm font-medium text-slate-700">จำนวน</TableHead>
                  <TableHead className="w-[140px] text-right text-sm font-medium text-slate-700">ยอดขาย</TableHead>
                  <TableHead className="w-[100px] text-center text-sm font-medium text-slate-700">เอกสาร</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p: any, idx: number) => (
                  <TableRow key={idx} className="hover:bg-slate-50/50" data-testid={`row-product-${idx}`}>
                    <TableCell className="text-center py-2">
                      {idx < 3 ? (
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full text-white text-xs font-bold" style={{ backgroundColor: medalColors[idx] }}>{idx + 1}</span>
                      ) : (
                        <span className="text-sm text-muted-foreground">{idx + 1}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm py-2 font-mono">{p.productCode || "-"}</TableCell>
                    <TableCell className="text-sm py-2 font-medium">{p.productName}</TableCell>
                    <TableCell className="text-sm py-2">{p.unit || "-"}</TableCell>
                    <TableCell className="text-sm py-2 text-right tabular-nums">{fmt(p.totalQty)}</TableCell>
                    <TableCell className="text-sm py-2 text-right font-medium tabular-nums">{fmt(p.totalRevenue)}</TableCell>
                    <TableCell className="text-center py-2"><Badge className="bg-slate-100 text-slate-600 border-0 text-xs">{p.docCount}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </ReportLayout>
  );
}
