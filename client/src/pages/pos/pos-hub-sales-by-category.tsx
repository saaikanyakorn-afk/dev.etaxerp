import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import PosLayout from "@/components/pos-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tag } from "lucide-react";

const COLORS = ["#03c9d7", "#fb9678", "#05b187", "#fec90f", "#539BFF", "#f94d4d", "#9b59b6", "#e67e22", "#1abc9c", "#34495e"];

function fmt(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PosHubSalesByCategory() {
  const { selectedCompanyId } = useCompany();
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const [from, setFrom] = useState(firstDay.toISOString().split("T")[0]);
  const [to, setTo] = useState(today.toISOString().split("T")[0]);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/pos/reports/sales-by-category", selectedCompanyId, from, to],
    queryFn: async () => {
      const r = await fetch(`/api/pos/reports/sales-by-category?companyId=${selectedCompanyId}&from=${from}&to=${to}`, { credentials: "include" });
      if (!r.ok) throw new Error();
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const categories = data || [];
  const totalRevenue = categories.reduce((s: number, c: any) => s + parseFloat(c.totalRevenue), 0) || 1;

  return (
    <PosLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-800" data-testid="text-category-report-title">ยอดขายแยกหมวดหมู่</h1>
            <p className="text-sm text-gray-500">วิเคราะห์ยอดขายตามหมวดหมู่สินค้า</p>
          </div>
          <div className="flex items-center gap-2">
            <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-9 w-36 text-sm" data-testid="input-from" />
            <span className="text-gray-400">—</span>
            <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-9 w-36 text-sm" data-testid="input-to" />
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-20 text-gray-400">กำลังโหลดข้อมูล...</div>
        ) : categories.length === 0 ? (
          <Card><CardContent className="py-16 text-center text-gray-400">ไม่มีข้อมูลในช่วงที่เลือก</CardContent></Card>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Tag className="h-4 w-4 text-[#03c9d7]" />
                    สัดส่วนยอดขาย
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {categories.map((cat: any, i: number) => {
                      const revenue = parseFloat(cat.totalRevenue);
                      const pct = (revenue / totalRevenue) * 100;
                      const color = COLORS[i % COLORS.length];
                      return (
                        <div key={i} data-testid={`category-bar-${i}`}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-sm" style={{ background: color }} />
                              <span className="text-sm font-medium text-gray-700">{cat.category}</span>
                            </div>
                            <span className="text-sm font-bold" style={{ color }}>฿{fmt(revenue)}</span>
                          </div>
                          <div className="bg-gray-100 rounded-full h-4 overflow-hidden">
                            <div className="h-full rounded-full flex items-center px-2" style={{ width: `${Math.max(pct, 2)}%`, background: color }}>
                              {pct > 15 && <span className="text-[9px] text-white font-bold">{pct.toFixed(1)}%</span>}
                            </div>
                          </div>
                          <div className="flex items-center justify-between mt-0.5">
                            <span className="text-[10px] text-gray-400">{parseFloat(cat.productCount)} สินค้า</span>
                            <span className="text-[10px] text-gray-400">{parseFloat(cat.totalQty).toLocaleString()} ชิ้น | {parseFloat(cat.transactionCount).toLocaleString()} บิล</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">รายละเอียด</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-gray-500">
                          <th className="text-left py-2 px-2 font-medium">หมวดหมู่</th>
                          <th className="text-right py-2 px-2 font-medium">สินค้า</th>
                          <th className="text-right py-2 px-2 font-medium">จำนวน</th>
                          <th className="text-right py-2 px-2 font-medium">ยอดขาย</th>
                          <th className="text-right py-2 px-2 font-medium">%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {categories.map((cat: any, i: number) => {
                          const revenue = parseFloat(cat.totalRevenue);
                          const pct = (revenue / totalRevenue) * 100;
                          return (
                            <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                              <td className="py-2 px-2 font-medium text-gray-800">
                                <div className="flex items-center gap-2">
                                  <div className="w-2.5 h-2.5 rounded-sm" style={{ background: COLORS[i % COLORS.length] }} />
                                  {cat.category}
                                </div>
                              </td>
                              <td className="py-2 px-2 text-right text-gray-500">{parseFloat(cat.productCount)}</td>
                              <td className="py-2 px-2 text-right">{parseFloat(cat.totalQty).toLocaleString()}</td>
                              <td className="py-2 px-2 text-right font-bold text-[#03c9d7]">฿{fmt(revenue)}</td>
                              <td className="py-2 px-2 text-right text-gray-500">{pct.toFixed(1)}%</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 bg-gray-50 font-bold">
                          <td className="py-2 px-2">รวม</td>
                          <td className="py-2 px-2 text-right">{categories.reduce((s: number, c: any) => s + parseFloat(c.productCount), 0)}</td>
                          <td className="py-2 px-2 text-right">{categories.reduce((s: number, c: any) => s + parseFloat(c.totalQty), 0).toLocaleString()}</td>
                          <td className="py-2 px-2 text-right text-[#03c9d7]">฿{fmt(totalRevenue)}</td>
                          <td className="py-2 px-2 text-right">100%</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </PosLayout>
  );
}
