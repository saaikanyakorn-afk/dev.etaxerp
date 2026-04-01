import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import PosLayout from "@/components/pos-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  Receipt,
  CreditCard,
  Package,
  DollarSign,
  Percent,
} from "lucide-react";

const COLORS = ["#03c9d7", "#fb9678", "#05b187", "#fec90f", "#539BFF", "#f94d4d"];

function fmt(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pctChange(curr: number, prev: number) {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return ((curr - prev) / prev) * 100;
}

export default function PosHubDashboard() {
  const { selectedCompanyId } = useCompany();
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const [from, setFrom] = useState(firstDay.toISOString().split("T")[0]);
  const [to, setTo] = useState(today.toISOString().split("T")[0]);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/pos/reports/dashboard", selectedCompanyId, from, to],
    queryFn: async () => {
      const r = await fetch(`/api/pos/reports/dashboard?companyId=${selectedCompanyId}&from=${from}&to=${to}`, { credentials: "include" });
      if (!r.ok) throw new Error();
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const summary = data?.summary;
  const prev = data?.previousPeriod;
  const dailySales = data?.dailySales || [];
  const topProducts = data?.topProducts || [];
  const paymentBreakdown = data?.paymentBreakdown || [];

  const totalSales = parseFloat(summary?.totalSales || "0");
  const totalTx = parseInt(summary?.totalTransactions || "0");
  const avgTicket = parseFloat(summary?.avgTicket || "0");
  const totalDiscount = parseFloat(summary?.totalDiscount || "0");
  const prevSales = parseFloat(prev?.totalSales || "0");
  const prevTx = parseInt(prev?.totalTransactions || "0");
  const salesChange = pctChange(totalSales, prevSales);
  const txChange = pctChange(totalTx, prevTx);

  const maxDaily = Math.max(...dailySales.map((d: any) => parseFloat(d.total)), 1);
  const totalPayments = paymentBreakdown.reduce((s: number, p: any) => s + parseFloat(p.total), 0) || 1;

  return (
    <PosLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-800" data-testid="text-pos-dashboard-title">แดชบอร์ดยอดขาย POS</h1>
            <p className="text-sm text-gray-500">สรุปภาพรวมการขายหน้าร้าน</p>
          </div>
          <div className="flex items-center gap-2">
            <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-9 w-36 text-sm" data-testid="input-from-date" />
            <span className="text-gray-400">—</span>
            <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-9 w-36 text-sm" data-testid="input-to-date" />
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-20 text-gray-400">กำลังโหลดข้อมูล...</div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="border-l-4 border-l-[#03c9d7]">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500 font-medium">ยอดขายรวม</p>
                      <p className="text-2xl font-bold text-gray-800 mt-1" data-testid="text-total-sales">฿{fmt(totalSales)}</p>
                    </div>
                    <div className="h-12 w-12 rounded-xl bg-[#03c9d7]/10 flex items-center justify-center">
                      <DollarSign className="h-6 w-6 text-[#03c9d7]" />
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-1">
                    {salesChange >= 0 ? <TrendingUp className="h-3 w-3 text-green-500" /> : <TrendingDown className="h-3 w-3 text-red-500" />}
                    <span className={`text-xs font-medium ${salesChange >= 0 ? "text-green-500" : "text-red-500"}`}>{salesChange >= 0 ? "+" : ""}{salesChange.toFixed(1)}%</span>
                    <span className="text-xs text-gray-400 ml-1">เทียบช่วงก่อนหน้า</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-[#fb9678]">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500 font-medium">จำนวนรายการ</p>
                      <p className="text-2xl font-bold text-gray-800 mt-1" data-testid="text-total-transactions">{totalTx.toLocaleString()}</p>
                    </div>
                    <div className="h-12 w-12 rounded-xl bg-[#fb9678]/10 flex items-center justify-center">
                      <Receipt className="h-6 w-6 text-[#fb9678]" />
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-1">
                    {txChange >= 0 ? <TrendingUp className="h-3 w-3 text-green-500" /> : <TrendingDown className="h-3 w-3 text-red-500" />}
                    <span className={`text-xs font-medium ${txChange >= 0 ? "text-green-500" : "text-red-500"}`}>{txChange >= 0 ? "+" : ""}{txChange.toFixed(1)}%</span>
                    <span className="text-xs text-gray-400 ml-1">เทียบช่วงก่อนหน้า</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-[#05b187]">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500 font-medium">ค่าเฉลี่ย/บิล</p>
                      <p className="text-2xl font-bold text-gray-800 mt-1" data-testid="text-avg-ticket">฿{fmt(avgTicket)}</p>
                    </div>
                    <div className="h-12 w-12 rounded-xl bg-[#05b187]/10 flex items-center justify-center">
                      <ShoppingCart className="h-6 w-6 text-[#05b187]" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-[#fec90f]">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500 font-medium">ส่วนลดรวม</p>
                      <p className="text-2xl font-bold text-gray-800 mt-1" data-testid="text-total-discount">฿{fmt(totalDiscount)}</p>
                    </div>
                    <div className="h-12 w-12 rounded-xl bg-[#fec90f]/10 flex items-center justify-center">
                      <Percent className="h-6 w-6 text-[#fec90f]" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="lg:col-span-2">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-[#03c9d7]" />
                    ยอดขายรายวัน
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {dailySales.length === 0 ? (
                    <div className="text-center py-12 text-gray-400 text-sm">ไม่มีข้อมูลในช่วงที่เลือก</div>
                  ) : (
                    <div className="space-y-1.5">
                      {dailySales.map((day: any, i: number) => {
                        const val = parseFloat(day.total);
                        const pct = (val / maxDaily) * 100;
                        return (
                          <div key={i} className="flex items-center gap-3">
                            <span className="text-[10px] text-gray-500 w-20 shrink-0">{new Date(day.date).toLocaleDateString("th-TH", { day: "2-digit", month: "short" })}</span>
                            <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                              <div className="h-full rounded-full flex items-center px-2" style={{ width: `${Math.max(pct, 3)}%`, background: "#03c9d7" }}>
                                {pct > 25 && <span className="text-[9px] text-white font-bold whitespace-nowrap">฿{fmt(val)}</span>}
                              </div>
                            </div>
                            {pct <= 25 && <span className="text-[10px] text-gray-500 shrink-0">฿{fmt(val)}</span>}
                            <span className="text-[10px] text-gray-400 w-12 text-right shrink-0">{day.count} บิล</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-[#fb9678]" />
                    ช่องทางชำระเงิน
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {paymentBreakdown.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 text-sm">ไม่มีข้อมูล</div>
                  ) : (
                    <div className="space-y-3">
                      {paymentBreakdown.map((pm: any, i: number) => {
                        const val = parseFloat(pm.total);
                        const pct = (val / totalPayments) * 100;
                        return (
                          <div key={i}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-gray-700">{pm.method}</span>
                              <span className="text-xs text-gray-500">{pct.toFixed(1)}%</span>
                            </div>
                            <div className="bg-gray-100 rounded-full h-3 overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }} />
                            </div>
                            <div className="flex items-center justify-between mt-0.5">
                              <span className="text-[10px] text-gray-400">{pm.count} รายการ</span>
                              <span className="text-[10px] font-medium text-gray-600">฿{fmt(val)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Package className="h-4 w-4 text-[#05b187]" />
                  สินค้าขายดี Top 10
                </CardTitle>
              </CardHeader>
              <CardContent>
                {topProducts.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-sm">ไม่มีข้อมูล</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-gray-500">
                          <th className="text-left py-2 px-2 font-medium">#</th>
                          <th className="text-left py-2 px-2 font-medium">สินค้า</th>
                          <th className="text-right py-2 px-2 font-medium">จำนวน</th>
                          <th className="text-right py-2 px-2 font-medium">ยอดขาย</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topProducts.map((p: any, i: number) => (
                          <tr key={p.productId} className="border-b last:border-0 hover:bg-gray-50" data-testid={`row-top-product-${i}`}>
                            <td className="py-2 px-2">
                              <Badge variant="outline" className={`text-[10px] ${i < 3 ? "border-[#fec90f] text-[#fec90f]" : "border-gray-300 text-gray-400"}`}>
                                {i + 1}
                              </Badge>
                            </td>
                            <td className="py-2 px-2">
                              <p className="font-medium text-gray-800">{p.productName}</p>
                              <p className="text-[10px] text-gray-400">{p.productCode}</p>
                            </td>
                            <td className="py-2 px-2 text-right font-medium">{parseFloat(p.totalQty).toLocaleString()}</td>
                            <td className="py-2 px-2 text-right font-bold text-[#03c9d7]">฿{fmt(parseFloat(p.totalRevenue))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </PosLayout>
  );
}
