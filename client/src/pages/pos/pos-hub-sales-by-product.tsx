import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import PosLayout from "@/components/pos-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Package, Search, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";

function fmt(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PosHubSalesByProduct() {
  const { selectedCompanyId } = useCompany();
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const [from, setFrom] = useState(firstDay.toISOString().split("T")[0]);
  const [to, setTo] = useState(today.toISOString().split("T")[0]);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"revenue" | "qty">("revenue");

  const { data, isLoading } = useQuery({
    queryKey: ["/api/pos/reports/sales-by-product", selectedCompanyId, from, to],
    queryFn: async () => {
      const r = await fetch(`/api/pos/reports/sales-by-product?companyId=${selectedCompanyId}&from=${from}&to=${to}`, { credentials: "include" });
      if (!r.ok) throw new Error();
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const products = (data || [])
    .filter((p: any) => !search || p.productName?.toLowerCase().includes(search.toLowerCase()) || p.productCode?.toLowerCase().includes(search.toLowerCase()))
    .sort((a: any, b: any) => sortBy === "revenue" ? parseFloat(b.totalRevenue) - parseFloat(a.totalRevenue) : parseFloat(b.totalQty) - parseFloat(a.totalQty));

  const totalRevenue = products.reduce((s: number, p: any) => s + parseFloat(p.totalRevenue), 0);

  return (
    <PosLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-800" data-testid="text-product-report-title">ยอดขายแยกสินค้า</h1>
            <p className="text-sm text-gray-500">วิเคราะห์ยอดขายรายสินค้า</p>
          </div>
          <div className="flex items-center gap-2">
            <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-9 w-36 text-sm" data-testid="input-from" />
            <span className="text-gray-400">—</span>
            <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-9 w-36 text-sm" data-testid="input-to" />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <Input placeholder="ค้นหาสินค้า..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" data-testid="input-search-product" />
          </div>
          <Button variant="outline" size="sm" className="h-9 text-xs gap-1" onClick={() => setSortBy(sortBy === "revenue" ? "qty" : "revenue")} data-testid="btn-sort">
            <ArrowUpDown className="h-3 w-3" />
            {sortBy === "revenue" ? "เรียงตามยอดขาย" : "เรียงตามจำนวน"}
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-20 text-gray-400">กำลังโหลดข้อมูล...</div>
        ) : products.length === 0 ? (
          <Card><CardContent className="py-16 text-center text-gray-400">ไม่มีข้อมูลสินค้าในช่วงที่เลือก</CardContent></Card>
        ) : (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Package className="h-4 w-4 text-[#03c9d7]" />
                สินค้าทั้งหมด ({products.length} รายการ)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-gray-500">
                      <th className="text-left py-2 px-2 font-medium">#</th>
                      <th className="text-left py-2 px-2 font-medium">รหัส</th>
                      <th className="text-left py-2 px-2 font-medium">สินค้า</th>
                      <th className="text-right py-2 px-2 font-medium">จำนวน</th>
                      <th className="text-right py-2 px-2 font-medium">ราคาเฉลี่ย</th>
                      <th className="text-right py-2 px-2 font-medium">ส่วนลด</th>
                      <th className="text-right py-2 px-2 font-medium">ยอดขาย</th>
                      <th className="text-right py-2 px-2 font-medium">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p: any, i: number) => {
                      const revenue = parseFloat(p.totalRevenue);
                      const pct = totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0;
                      return (
                        <tr key={p.productId} className="border-b last:border-0 hover:bg-gray-50" data-testid={`row-product-${i}`}>
                          <td className="py-2 px-2">
                            <Badge variant="outline" className={`text-[10px] ${i < 3 ? "border-[#fec90f] text-[#fec90f]" : "border-gray-300 text-gray-400"}`}>{i + 1}</Badge>
                          </td>
                          <td className="py-2 px-2 text-xs text-gray-400 font-mono">{p.productCode}</td>
                          <td className="py-2 px-2 font-medium text-gray-800">{p.productName}</td>
                          <td className="py-2 px-2 text-right font-medium">{parseFloat(p.totalQty).toLocaleString()}</td>
                          <td className="py-2 px-2 text-right text-gray-500">฿{fmt(parseFloat(p.avgPrice))}</td>
                          <td className="py-2 px-2 text-right text-red-500">฿{fmt(parseFloat(p.totalDiscount))}</td>
                          <td className="py-2 px-2 text-right font-bold text-[#03c9d7]">฿{fmt(revenue)}</td>
                          <td className="py-2 px-2 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <div className="w-12 bg-gray-100 rounded-full h-1.5">
                                <div className="h-full rounded-full bg-[#03c9d7]" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-[10px] text-gray-400 w-10 text-right">{pct.toFixed(1)}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 bg-gray-50 font-bold">
                      <td colSpan={6} className="py-2 px-2 text-right text-gray-600">รวมทั้งหมด</td>
                      <td className="py-2 px-2 text-right text-[#03c9d7]">฿{fmt(totalRevenue)}</td>
                      <td className="py-2 px-2 text-right text-gray-400 text-xs">100%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PosLayout>
  );
}
