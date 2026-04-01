import { useQuery } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import PosLayout from "@/components/pos-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Store, ShoppingCart, Banknote, CreditCard, QrCode, TrendingUp,
  Clock, BarChart3, Users, Activity, CircleDollarSign
} from "lucide-react";

const fmt = (val: any) => parseFloat(String(val || "0")).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = (val: any) => parseInt(String(val || "0")).toLocaleString("th-TH");

const paymentIcon = (method: string) => {
  if (method === "เงินสด") return <Banknote className="w-4 h-4" />;
  if (method === "โอนเงิน") return <QrCode className="w-4 h-4" />;
  return <CreditCard className="w-4 h-4" />;
};

const paymentColor = (method: string) => {
  if (method === "เงินสด") return "bg-green-100 text-green-800";
  if (method === "โอนเงิน") return "bg-blue-100 text-blue-800";
  return "bg-purple-100 text-purple-800";
};

export default function PosDashboard() {
  const { selectedCompanyId } = useCompany();

  const { data, isLoading } = useQuery({
    queryKey: ["/api/pos/dashboard", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/pos/dashboard?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    enabled: !!selectedCompanyId,
    refetchInterval: 30000,
  });

  const overall = data?.overall;
  const branches = data?.branches || [];

  const hourlyData = overall?.hourlySales || {};
  const maxHourly = Math.max(...Object.values(hourlyData).map((v: any) => v || 0), 1);

  return (
    <PosLayout>
      <div className="p-4 w-full overflow-x-hidden space-y-4" data-testid="pos-dashboard-page">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold" data-testid="text-dashboard-title">แดชบอร์ดยอดขาย POS</h1>
            <p className="text-sm text-muted-foreground">ข้อมูลวันที่ {data?.date || "-"} (อัปเดตอัตโนมัติทุก 30 วินาที)</p>
          </div>
          <Badge variant="outline" className="flex items-center gap-1 text-green-600 border-green-300">
            <Activity className="w-3 h-3" /> เรียลไทม์
          </Badge>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">กำลังโหลดข้อมูล...</div>
        ) : !overall ? (
          <div className="text-center py-12 text-muted-foreground">ไม่มีข้อมูลขาย POS วันนี้</div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card data-testid="card-total-sales">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <CircleDollarSign className="w-4 h-4 text-[#fb9678]" /> ยอดขายรวม
                  </div>
                  <p className="text-2xl font-bold text-[#fb9678]">฿{fmt(overall.totalSales)}</p>
                </CardContent>
              </Card>
              <Card data-testid="card-total-transactions">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <ShoppingCart className="w-4 h-4 text-[#03c9d7]" /> จำนวนบิล
                  </div>
                  <p className="text-2xl font-bold text-[#03c9d7]">{fmtInt(overall.totalTransactions)}</p>
                </CardContent>
              </Card>
              <Card data-testid="card-avg-per-txn">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <TrendingUp className="w-4 h-4 text-[#05b187]" /> เฉลี่ย/บิล
                  </div>
                  <p className="text-2xl font-bold text-[#05b187]">฿{fmt(overall.avgPerTransaction)}</p>
                </CardContent>
              </Card>
              <Card data-testid="card-sessions">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Users className="w-4 h-4 text-[#539BFF]" /> กะเปิดอยู่
                  </div>
                  <p className="text-2xl font-bold text-[#539BFF]">{overall.openSessions} <span className="text-sm font-normal text-muted-foreground">/ {overall.totalSessions}</span></p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Card className="md:col-span-2" data-testid="card-hourly-chart">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" /> ยอดขายรายชั่วโมง
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end gap-1 h-32">
                    {Array.from({ length: 16 }, (_, i) => i + 7).map(hr => {
                      const val = hourlyData[hr] || 0;
                      const pct = val > 0 ? Math.max(4, (val / maxHourly) * 100) : 0;
                      return (
                        <div key={hr} className="flex-1 flex flex-col items-center gap-1">
                          <div className="w-full flex flex-col items-center justify-end h-24">
                            <div
                              className="w-full rounded-t bg-[#fb9678] transition-all"
                              style={{ height: `${pct}%`, minHeight: val > 0 ? 4 : 0 }}
                              title={`${hr}:00 - ฿${fmt(val)}`}
                            />
                          </div>
                          <span className="text-[10px] text-muted-foreground">{hr}</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-payment-breakdown">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Banknote className="w-4 h-4" /> วิธีชำระเงิน
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {Object.entries(overall.paymentBreakdown || {}).map(([method, data]: [string, any]) => (
                    <div key={method} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className={`${paymentColor(method)} text-xs`}>
                          {paymentIcon(method)} {method}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{data.count} บิล</span>
                      </div>
                      <span className="font-semibold text-sm">฿{fmt(data.total)}</span>
                    </div>
                  ))}
                  {Object.keys(overall.paymentBreakdown || {}).length === 0 && (
                    <p className="text-xs text-muted-foreground">ยังไม่มีรายการ</p>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card data-testid="card-branch-breakdown">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Store className="w-4 h-4" /> ยอดขายแยกตามสาขา
                </CardTitle>
              </CardHeader>
              <CardContent>
                {branches.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">ยังไม่มีข้อมูลขายวันนี้</p>
                ) : (
                  <div className="space-y-3">
                    {branches.map((branch: any, idx: number) => {
                      const salesPct = overall.totalSales > 0 ? (branch.totalSales / overall.totalSales) * 100 : 0;
                      return (
                        <div key={idx} className="border rounded-lg p-3" data-testid={`branch-card-${idx}`}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Store className="w-4 h-4 text-[#fb9678]" />
                              <span className="font-semibold text-sm">{branch.branchName}</span>
                              {branch.openSessions > 0 && (
                                <Badge className="bg-green-500 text-white text-[10px] px-1.5">
                                  <Clock className="w-3 h-3 mr-0.5" /> เปิดอยู่ {branch.openSessions} กะ
                                </Badge>
                              )}
                            </div>
                            <span className="text-lg font-bold text-[#fb9678]">฿{fmt(branch.totalSales)}</span>
                          </div>

                          <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
                            <div
                              className="bg-[#fb9678] h-2 rounded-full transition-all"
                              style={{ width: `${salesPct}%` }}
                            />
                          </div>

                          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                            <span>{branch.totalTransactions} บิล</span>
                            <span>เฉลี่ย ฿{branch.totalTransactions > 0 ? fmt(branch.totalSales / branch.totalTransactions) : "0.00"}/บิล</span>
                            <span>VAT ฿{fmt(branch.totalVat)}</span>
                            <span className="text-xs text-muted-foreground">
                              ({salesPct.toFixed(1)}% ของยอดรวม)
                            </span>
                          </div>

                          {Object.keys(branch.paymentBreakdown || {}).length > 0 && (
                            <div className="flex gap-2 mt-2 flex-wrap">
                              {Object.entries(branch.paymentBreakdown).map(([method, d]: [string, any]) => (
                                <Badge key={method} variant="outline" className="text-[10px] gap-1">
                                  {paymentIcon(method)} {method} ฿{fmt(d.total)}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
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
