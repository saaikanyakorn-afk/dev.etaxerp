import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import PosLayout from "@/components/pos-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Store, Trophy } from "lucide-react";

const COLORS = ["#03c9d7", "#fb9678", "#05b187", "#fec90f", "#539BFF", "#f94d4d"];

function fmt(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PosHubBestSellers() {
  const { selectedCompanyId } = useCompany();
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const [from, setFrom] = useState(firstDay.toISOString().split("T")[0]);
  const [to, setTo] = useState(today.toISOString().split("T")[0]);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/pos/reports/best-sellers", selectedCompanyId, from, to],
    queryFn: async () => {
      const r = await fetch(`/api/pos/reports/best-sellers?companyId=${selectedCompanyId}&from=${from}&to=${to}&limit=50`, { credentials: "include" });
      if (!r.ok) throw new Error();
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const items = data || [];
  const branchNames = [...new Set(items.map((i: any) => i.branchName || "สำนักงานใหญ่"))];
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);

  const filtered = selectedBranch
    ? items.filter((i: any) => (i.branchName || "สำนักงานใหญ่") === selectedBranch)
    : items;

  const grouped = branchNames.map((bn, idx) => ({
    name: bn,
    color: COLORS[idx % COLORS.length],
    products: items.filter((i: any) => (i.branchName || "สำนักงานใหญ่") === bn).slice(0, 10),
  }));

  return (
    <PosLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-800" data-testid="text-best-sellers-title">สินค้าขายดี</h1>
            <p className="text-sm text-gray-500">สินค้าที่มียอดขายสูงสุดแยกตามสาขา</p>
          </div>
          <div className="flex items-center gap-2">
            <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-9 w-36 text-sm" data-testid="input-from" />
            <span className="text-gray-400">—</span>
            <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-9 w-36 text-sm" data-testid="input-to" />
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-20 text-gray-400">กำลังโหลดข้อมูล...</div>
        ) : items.length === 0 ? (
          <Card><CardContent className="py-16 text-center text-gray-400">ไม่มีข้อมูลในช่วงที่เลือก</CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {grouped.map((branch, bi) => (
              <Card key={bi} className="border-t-4" style={{ borderTopColor: branch.color }} data-testid={`card-branch-bestsellers-${bi}`}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Store className="h-4 w-4" style={{ color: branch.color }} />
                    {branch.name}
                    <Badge variant="outline" className="text-[10px] ml-auto">{branch.products.length} สินค้า</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {branch.products.length === 0 ? (
                    <div className="text-center py-6 text-gray-400 text-sm">ไม่มีข้อมูล</div>
                  ) : (
                    <div className="space-y-2">
                      {branch.products.map((p: any, pi: number) => {
                        const revenue = parseFloat(p.totalRevenue);
                        const qty = parseFloat(p.totalQty);
                        const maxRevenue = parseFloat(branch.products[0]?.totalRevenue || "1");
                        const pct = (revenue / maxRevenue) * 100;
                        return (
                          <div key={pi} className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-6">
                              {pi < 3 ? (
                                <Trophy className="h-4 w-4" style={{ color: pi === 0 ? "#fec90f" : pi === 1 ? "#c0c0c0" : "#cd7f32" }} />
                              ) : (
                                <span className="text-[10px] text-gray-400 font-bold">{pi + 1}</span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-0.5">
                                <p className="text-xs font-medium text-gray-800 truncate">{p.productName}</p>
                                <p className="text-xs font-bold shrink-0 ml-2" style={{ color: branch.color }}>฿{fmt(revenue)}</p>
                              </div>
                              <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: branch.color, opacity: 0.7 }} />
                              </div>
                              <p className="text-[10px] text-gray-400 mt-0.5">{qty.toLocaleString()} ชิ้น · {p.productCode}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PosLayout>
  );
}
