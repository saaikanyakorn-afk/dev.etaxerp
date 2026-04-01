import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import PosLayout from "@/components/pos-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Store, TrendingUp } from "lucide-react";

const COLORS = ["#03c9d7", "#fb9678", "#05b187", "#fec90f", "#539BFF", "#f94d4d", "#9b59b6", "#e67e22"];

function fmt(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PosHubSalesByBranch() {
  const { selectedCompanyId } = useCompany();
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const [from, setFrom] = useState(firstDay.toISOString().split("T")[0]);
  const [to, setTo] = useState(today.toISOString().split("T")[0]);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/pos/reports/sales-by-branch", selectedCompanyId, from, to],
    queryFn: async () => {
      const r = await fetch(`/api/pos/reports/sales-by-branch?companyId=${selectedCompanyId}&from=${from}&to=${to}`, { credentials: "include" });
      if (!r.ok) throw new Error();
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const branches = data?.branches || [];
  const dailyByBranch = data?.dailyByBranch || [];
  const totalAllBranches = branches.reduce((s: number, b: any) => s + parseFloat(b.totalSales), 0) || 1;

  return (
    <PosLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-800" data-testid="text-branch-report-title">ยอดขายแยกสาขา</h1>
            <p className="text-sm text-gray-500">เปรียบเทียบยอดขายระหว่างสาขา</p>
          </div>
          <div className="flex items-center gap-2">
            <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-9 w-36 text-sm" data-testid="input-from" />
            <span className="text-gray-400">—</span>
            <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-9 w-36 text-sm" data-testid="input-to" />
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-20 text-gray-400">กำลังโหลดข้อมูล...</div>
        ) : branches.length === 0 ? (
          <Card><CardContent className="py-16 text-center text-gray-400">ไม่มีข้อมูลยอดขายในช่วงที่เลือก</CardContent></Card>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {branches.map((branch: any, i: number) => {
                const sales = parseFloat(branch.totalSales);
                const pct = (sales / totalAllBranches) * 100;
                const color = COLORS[i % COLORS.length];
                return (
                  <Card key={i} className="border-l-4" style={{ borderLeftColor: color }} data-testid={`card-branch-${i}`}>
                    <CardContent className="pt-5 pb-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ background: color + "15" }}>
                          <Store className="h-5 w-5" style={{ color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-800 truncate">{branch.branchName || "สำนักงานใหญ่"}</p>
                          <Badge variant="outline" className="text-[10px]">{pct.toFixed(1)}% ของทั้งหมด</Badge>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-[10px] text-gray-400">ยอดขาย</p>
                          <p className="text-lg font-bold" style={{ color }}>฿{fmt(sales)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-400">จำนวนบิล</p>
                          <p className="text-lg font-bold text-gray-700">{parseInt(branch.totalTransactions).toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-400">เฉลี่ย/บิล</p>
                          <p className="text-sm font-medium text-gray-600">฿{fmt(parseFloat(branch.avgTicket))}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-400">ส่วนลด</p>
                          <p className="text-sm font-medium text-red-500">฿{fmt(parseFloat(branch.totalDiscount))}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-[#03c9d7]" />
                  ยอดขายรายวัน (แยกสาขา)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-gray-500">
                        <th className="text-left py-2 px-2 font-medium">วันที่</th>
                        <th className="text-left py-2 px-2 font-medium">สาขา</th>
                        <th className="text-right py-2 px-2 font-medium">ยอดขาย</th>
                        <th className="text-right py-2 px-2 font-medium">บิล</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailyByBranch.slice(0, 50).map((row: any, i: number) => (
                        <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                          <td className="py-1.5 px-2 text-xs text-gray-500">{new Date(row.date).toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "2-digit" })}</td>
                          <td className="py-1.5 px-2 text-xs font-medium">{row.branchName || "สำนักงานใหญ่"}</td>
                          <td className="py-1.5 px-2 text-xs text-right font-bold text-[#03c9d7]">฿{fmt(parseFloat(row.total))}</td>
                          <td className="py-1.5 px-2 text-xs text-right text-gray-500">{row.count}</td>
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
