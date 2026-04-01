import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { useLocation } from "wouter";
import PosLayout from "@/components/pos-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ShoppingCart, Clock, ArrowRight, Monitor, CalendarDays,
  Eye, Banknote, CreditCard, QrCode, Receipt, TrendingUp, AlertTriangle, CheckCircle2, XCircle, Store
} from "lucide-react";
import ThaiDateInput from "@/components/thai-date-input";
import { useDateSettings } from "@/hooks/use-date-settings";
import { toLocalDateStr } from "@/lib/utils";

const fmt = (val: any) => parseFloat(String(val || "0")).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function PosSessions() {
  const { selectedCompanyId } = useCompany();
  const [, setLocation] = useLocation();
  const { dateEra, dateFmt } = useDateSettings();
  const [dateFilter, setDateFilter] = useState(toLocalDateStr(new Date()));
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);

  const { data: sessions } = useQuery({
    queryKey: ["/api/pos/sessions", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/pos/sessions?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const { data: dailySummary } = useQuery({
    queryKey: ["/api/pos/daily-summary", selectedCompanyId, dateFilter],
    queryFn: async () => {
      const r = await fetch(`/api/pos/daily-summary?companyId=${selectedCompanyId}&date=${dateFilter}`, { credentials: "include" });
      if (!r.ok) return null;
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const { data: sessionDetail } = useQuery({
    queryKey: ["/api/pos/sessions", selectedSessionId, "summary"],
    queryFn: async () => {
      const r = await fetch(`/api/pos/sessions/${selectedSessionId}/summary`, { credentials: "include" });
      if (!r.ok) return null;
      return r.json();
    },
    enabled: !!selectedSessionId,
  });

  const sessionList = Array.isArray(sessions) ? sessions : [];

  const formatDateTime = (dt: string | null) => {
    if (!dt) return "-";
    const d = new Date(dt);
    return d.toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" });
  };

  const formatTime = (dt: string | null) => {
    if (!dt) return "-";
    return new Date(dt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
  };

  const paymentIcon = (method: string) => {
    if (method === "เงินสด") return <Banknote className="h-4 w-4 text-green-600" />;
    if (method === "โอนเงิน") return <QrCode className="h-4 w-4 text-blue-600" />;
    if (method === "บัตรเครดิต") return <CreditCard className="h-4 w-4 text-cyan-600" />;
    return <Receipt className="h-4 w-4 text-gray-500" />;
  };

  const sd = sessionDetail;
  const sdSession = sd?.session;
  const cashVariance = sdSession ? parseFloat(String(sdSession.cashVariance || "0")) : 0;

  return (
    <PosLayout>
    <div data-testid="pos-sessions-page">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingCart className="h-6 w-6 text-[#fb9678]" />
            POS - จุดขาย
          </h1>
          <p className="text-gray-500 text-sm mt-1">จัดการกะขาย และเปิดหน้าจอขาย</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="border-[#fb9678] text-[#fb9678] h-12" onClick={() => setLocation("/pos/branches")} data-testid="btn-manage-branches">
            <Store className="h-5 w-5 mr-2" />
            จัดการสาขา
          </Button>
          <Button className="bg-[#fb9678] hover:bg-[#fb9678]/90 h-12 px-6 text-lg" onClick={() => setLocation("/pos/terminal")} data-testid="btn-open-terminal">
            <Monitor className="h-5 w-5 mr-2" />
            เปิดหน้าจอขาย
          </Button>
        </div>
      </div>

      <div className="mb-6">
        <div className="flex items-center gap-3 mb-3">
          <CalendarDays className="h-5 w-5 text-gray-500" />
          <ThaiDateInput value={dateFilter} onChange={setDateFilter} dateEra={dateEra} dateFmt={dateFmt} className="w-[160px]" data-testid="input-date-filter" />
        </div>
        {dailySummary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card data-testid="card-total-sessions">
              <CardContent className="pt-6">
                <p className="text-sm text-gray-500">จำนวนกะ</p>
                <p className="text-3xl font-bold">{dailySummary.totalSessions}</p>
              </CardContent>
            </Card>
            <Card data-testid="card-total-transactions">
              <CardContent className="pt-6">
                <p className="text-sm text-gray-500">จำนวนรายการ</p>
                <p className="text-3xl font-bold">{dailySummary.totalTransactions}</p>
              </CardContent>
            </Card>
            <Card data-testid="card-total-sales">
              <CardContent className="pt-6">
                <p className="text-sm text-gray-500">ยอดขายรวม</p>
                <p className="text-3xl font-bold text-[#fb9678]">฿{fmt(dailySummary.totalSales)}</p>
              </CardContent>
            </Card>
            <Card data-testid="card-payment-breakdown">
              <CardContent className="pt-6">
                <p className="text-sm text-gray-500 mb-2">แยกตามช่องทาง</p>
                {dailySummary.paymentBreakdown && Object.entries(dailySummary.paymentBreakdown).map(([method, data]: [string, any]) => (
                  <div key={method} className="flex justify-between text-sm">
                    <span>{method} ({data.count})</span>
                    <span className="font-medium">฿{data.total.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span>
                  </div>
                ))}
                {(!dailySummary.paymentBreakdown || Object.keys(dailySummary.paymentBreakdown).length === 0) && (
                  <p className="text-gray-400 text-sm">ยังไม่มีข้อมูล</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">ประวัติกะขาย</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-3 font-medium">กะ #</th>
                  <th className="pb-3 font-medium">สาขา / เครื่อง</th>
                  <th className="pb-3 font-medium">เวลาเปิด</th>
                  <th className="pb-3 font-medium">เวลาปิด</th>
                  <th className="pb-3 font-medium text-right">เงินเปิดกะ</th>
                  <th className="pb-3 font-medium text-right">ยอดขาย</th>
                  <th className="pb-3 font-medium text-right">รายการ</th>
                  <th className="pb-3 font-medium text-center">สถานะ</th>
                  <th className="pb-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {sessionList.map((s: any) => (
                  <tr
                    key={s.id}
                    className="border-b hover:bg-gray-50 cursor-pointer"
                    onClick={() => setSelectedSessionId(s.id)}
                    data-testid={`session-row-${s.id}`}
                  >
                    <td className="py-3 font-medium">#{s.id}</td>
                    <td className="py-3">{s.branchName} - {s.terminalName}</td>
                    <td className="py-3">{formatDateTime(s.openedAt)}</td>
                    <td className="py-3">{formatDateTime(s.closedAt)}</td>
                    <td className="py-3 text-right">฿{fmt(s.openingCash)}</td>
                    <td className="py-3 text-right font-medium">฿{fmt(s.totalSales)}</td>
                    <td className="py-3 text-right">{s.totalTransactions || 0}</td>
                    <td className="py-3 text-center">
                      {s.status === "open" ? (
                        <Badge className="bg-green-100 text-green-700">เปิดอยู่</Badge>
                      ) : (
                        <Badge variant="outline" className="text-gray-500">ปิดแล้ว</Badge>
                      )}
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        {s.status === "open" && (
                          <Button variant="ghost" size="sm" className="text-[#fb9678]" onClick={(e) => { e.stopPropagation(); setLocation("/pos/terminal"); }} data-testid={`btn-goto-terminal-${s.id}`}>
                            เข้าหน้าขาย <ArrowRight className="h-4 w-4 ml-1" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="text-[var(--theme-primary)]" onClick={(e) => { e.stopPropagation(); setSelectedSessionId(s.id); }} data-testid={`btn-view-session-${s.id}`}>
                          <Eye className="h-4 w-4 mr-1" /> ดูรายละเอียด
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {sessionList.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-gray-400">ยังไม่มีประวัติกะขาย</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>

    <Dialog open={!!selectedSessionId} onOpenChange={(open) => { if (!open) setSelectedSessionId(null); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto" data-testid="dialog-session-detail">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <Receipt className="h-5 w-5 text-[#fb9678]" />
            รายละเอียดกะ #{selectedSessionId}
          </DialogTitle>
        </DialogHeader>

        {sd ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">สาขา / เครื่อง</p>
                <p className="font-medium text-sm">{sdSession?.branchName} - {sdSession?.terminalName}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">เวลาเปิด - ปิด</p>
                <p className="font-medium text-sm">{formatTime(sdSession?.openedAt)} - {formatTime(sdSession?.closedAt)}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">จำนวนรายการ</p>
                <p className="font-medium text-lg">{sd.totalTransactions}</p>
              </div>
              <div className="p-3 bg-[#fb9678]/10 rounded-lg">
                <p className="text-xs text-[#fb9678]">ยอดขายรวม</p>
                <p className="font-bold text-lg text-[#fb9678]">฿{fmt(sd.totalSales)}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-[#05b187]" /> แยกตามช่องทางชำระเงิน
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {sd.paymentBreakdown && Object.keys(sd.paymentBreakdown).length > 0 ? (
                    <div className="space-y-2">
                      {Object.entries(sd.paymentBreakdown).map(([method, data]: [string, any]) => (
                        <div key={method} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <div className="flex items-center gap-2">
                            {paymentIcon(method)}
                            <span className="text-sm font-medium">{method}</span>
                            <Badge variant="outline" className="text-xs">{data.count} รายการ</Badge>
                          </div>
                          <span className="font-bold text-sm">฿{fmt(data.total)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-400 text-sm py-4 text-center">ไม่มีรายการ</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Banknote className="h-4 w-4 text-green-600" /> สรุปเงินสด
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between p-2 bg-gray-50 rounded">
                      <span className="text-gray-500">เงินสดเปิดกะ</span>
                      <span className="font-medium">฿{fmt(sdSession?.openingCash)}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-gray-50 rounded">
                      <span className="text-gray-500">ขายเงินสด</span>
                      <span className="font-medium">฿{fmt(sd.paymentBreakdown?.["เงินสด"]?.total)}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-blue-50 rounded font-medium">
                      <span className="text-blue-700">เงินสดที่ควรมี</span>
                      <span className="text-blue-700">฿{fmt(sdSession?.expectedCash)}</span>
                    </div>
                    {sdSession?.closingCash !== null && sdSession?.closingCash !== undefined && (
                      <>
                        <div className="flex justify-between p-2 bg-gray-50 rounded">
                          <span className="text-gray-500">นับเงินสดจริง</span>
                          <span className="font-medium">฿{fmt(sdSession?.closingCash)}</span>
                        </div>
                        <div className={`flex justify-between p-2 rounded font-bold ${cashVariance === 0 ? "bg-green-50" : "bg-red-50"}`}>
                          <span className="flex items-center gap-1">
                            {cashVariance === 0 ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <AlertTriangle className="h-4 w-4 text-red-500" />}
                            <span className={cashVariance === 0 ? "text-green-700" : "text-red-700"}>ส่วนต่าง</span>
                          </span>
                          <span className={cashVariance === 0 ? "text-green-700" : "text-red-700"}>
                            {cashVariance >= 0 ? "+" : ""}฿{fmt(cashVariance)}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">รายการขายทั้งหมด</CardTitle>
              </CardHeader>
              <CardContent>
                {sd.transactions && sd.transactions.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-gray-500">
                          <th className="pb-2 text-left font-medium">#</th>
                          <th className="pb-2 text-left font-medium">เลขที่</th>
                          <th className="pb-2 text-left font-medium">เวลา</th>
                          <th className="pb-2 text-left font-medium">ลูกค้า</th>
                          <th className="pb-2 text-left font-medium">ชำระโดย</th>
                          <th className="pb-2 text-center font-medium">สถานะ</th>
                          <th className="pb-2 text-right font-medium">ยอดรวม</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sd.transactions.map((t: any, idx: number) => (
                          <tr key={t.id} className="border-b hover:bg-gray-50" data-testid={`session-txn-${t.id}`}>
                            <td className="py-2 text-gray-400">{idx + 1}</td>
                            <td className="py-2 font-medium text-[#fb9678]">{t.transactionNo}</td>
                            <td className="py-2">{formatTime(t.createdAt)}</td>
                            <td className="py-2">{t.customerName || "ลูกค้าทั่วไป"}</td>
                            <td className="py-2">
                              <div className="flex items-center gap-1">
                                {paymentIcon(t.paymentMethod)}
                                <span>{t.paymentMethod}</span>
                              </div>
                            </td>
                            <td className="py-2 text-center">
                              {t.status === "completed" ? (
                                <Badge className="bg-green-100 text-green-700 text-xs">สำเร็จ</Badge>
                              ) : t.status === "voided" ? (
                                <Badge className="bg-red-100 text-red-700 text-xs">ยกเลิก</Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs">{t.status}</Badge>
                              )}
                            </td>
                            <td className="py-2 text-right font-medium">
                              {t.status === "voided" ? (
                                <span className="line-through text-gray-400">฿{fmt(t.total)}</span>
                              ) : (
                                <span>฿{fmt(t.total)}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm py-6 text-center">ไม่มีรายการขายในกะนี้</p>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#fb9678] mx-auto mb-3"></div>
            กำลังโหลดรายละเอียด...
          </div>
        )}
      </DialogContent>
    </Dialog>

    </PosLayout>
  );
}
