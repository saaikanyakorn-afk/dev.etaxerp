import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import PosLayout from "@/components/pos-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Users, Trophy, AlertTriangle } from "lucide-react";

const COLORS = ["#03c9d7", "#fb9678", "#05b187", "#fec90f", "#539BFF"];

function fmt(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PosHubCashierPerformance() {
  const { selectedCompanyId } = useCompany();
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const [from, setFrom] = useState(firstDay.toISOString().split("T")[0]);
  const [to, setTo] = useState(today.toISOString().split("T")[0]);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/pos/reports/cashier-performance", selectedCompanyId, from, to],
    queryFn: async () => {
      const r = await fetch(`/api/pos/reports/cashier-performance?companyId=${selectedCompanyId}&from=${from}&to=${to}`, { credentials: "include" });
      if (!r.ok) throw new Error();
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const cashiers = data || [];
  const maxSales = Math.max(...cashiers.map((c: any) => parseFloat(c.totalSales)), 1);

  return (
    <PosLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-800" data-testid="text-cashier-title">ผลงานพนักงาน</h1>
            <p className="text-sm text-gray-500">ยอดขายและประสิทธิภาพของพนักงานขาย</p>
          </div>
          <div className="flex items-center gap-2">
            <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-9 w-36 text-sm" data-testid="input-from" />
            <span className="text-gray-400">—</span>
            <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-9 w-36 text-sm" data-testid="input-to" />
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-20 text-gray-400">กำลังโหลดข้อมูล...</div>
        ) : cashiers.length === 0 ? (
          <Card><CardContent className="py-16 text-center text-gray-400">ไม่มีข้อมูลพนักงานในช่วงที่เลือก</CardContent></Card>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {cashiers.map((cashier: any, i: number) => {
                const sales = parseFloat(cashier.totalSales);
                const pct = (sales / maxSales) * 100;
                const color = COLORS[i % COLORS.length];
                const variance = parseFloat(cashier.totalCashVariance);
                return (
                  <Card key={i} className="border-l-4" style={{ borderLeftColor: color }} data-testid={`card-cashier-${i}`}>
                    <CardContent className="pt-5 pb-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ background: color }}>
                          {cashier.userName?.charAt(0) || "?"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-gray-800 truncate">{cashier.userName}</p>
                            {i === 0 && <Trophy className="h-4 w-4 text-[#fec90f]" />}
                          </div>
                          <p className="text-[10px] text-gray-400">{parseInt(cashier.sessionCount)} กะ</p>
                        </div>
                      </div>

                      <div className="bg-gray-100 rounded-full h-3 overflow-hidden mb-3">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                      </div>

                      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        <div>
                          <p className="text-[10px] text-gray-400">ยอดขาย</p>
                          <p className="text-sm font-bold" style={{ color }}>฿{fmt(sales)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-400">จำนวนบิล</p>
                          <p className="text-sm font-bold text-gray-700">{parseInt(cashier.totalTransactions).toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-400">เฉลี่ย/บิล</p>
                          <p className="text-sm font-medium text-gray-600">฿{fmt(parseFloat(cashier.avgTicket))}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-400">ส่วนลดรวม</p>
                          <p className="text-sm font-medium text-red-500">฿{fmt(parseFloat(cashier.totalDiscount))}</p>
                        </div>
                      </div>

                      {variance !== 0 && (
                        <div className={`mt-3 flex items-center gap-1.5 px-2 py-1 rounded text-xs ${variance < 0 ? "bg-red-50 text-red-600" : "bg-yellow-50 text-yellow-600"}`}>
                          <AlertTriangle className="h-3 w-3" />
                          ผลต่างเงินสด: ฿{fmt(variance)}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4 text-[#03c9d7]" />
                  ตารางเปรียบเทียบ
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-gray-500">
                        <th className="text-left py-2 px-2 font-medium">#</th>
                        <th className="text-left py-2 px-2 font-medium">พนักงาน</th>
                        <th className="text-right py-2 px-2 font-medium">กะ</th>
                        <th className="text-right py-2 px-2 font-medium">บิล</th>
                        <th className="text-right py-2 px-2 font-medium">ยอดขาย</th>
                        <th className="text-right py-2 px-2 font-medium">เฉลี่ย/บิล</th>
                        <th className="text-right py-2 px-2 font-medium">ผลต่างเงินสด</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cashiers.map((c: any, i: number) => (
                        <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                          <td className="py-2 px-2">
                            <Badge variant="outline" className={`text-[10px] ${i < 3 ? "border-[#fec90f] text-[#fec90f]" : "border-gray-300 text-gray-400"}`}>{i + 1}</Badge>
                          </td>
                          <td className="py-2 px-2 font-medium text-gray-800">{c.userName}</td>
                          <td className="py-2 px-2 text-right text-gray-500">{parseInt(c.sessionCount)}</td>
                          <td className="py-2 px-2 text-right">{parseInt(c.totalTransactions).toLocaleString()}</td>
                          <td className="py-2 px-2 text-right font-bold text-[#03c9d7]">฿{fmt(parseFloat(c.totalSales))}</td>
                          <td className="py-2 px-2 text-right text-gray-600">฿{fmt(parseFloat(c.avgTicket))}</td>
                          <td className={`py-2 px-2 text-right font-medium ${parseFloat(c.totalCashVariance) < 0 ? "text-red-500" : parseFloat(c.totalCashVariance) > 0 ? "text-yellow-500" : "text-gray-400"}`}>
                            ฿{fmt(parseFloat(c.totalCashVariance))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </PosLayout>
  );
}
