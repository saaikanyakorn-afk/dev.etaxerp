import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import PosLayout from "@/components/pos-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Receipt, Clock, DollarSign, AlertTriangle } from "lucide-react";

function fmt(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PosHubDailySummary() {
  const { selectedCompanyId } = useCompany();
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/pos/reports/daily-summary", selectedCompanyId, date],
    queryFn: async () => {
      const r = await fetch(`/api/pos/reports/daily-summary?companyId=${selectedCompanyId}&date=${date}`, { credentials: "include" });
      if (!r.ok) throw new Error();
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const summary = data?.summary;
  const sessions = data?.sessions || [];
  const hourly = data?.hourly || [];
  const maxHourly = Math.max(...hourly.map((h: any) => parseFloat(h.total)), 1);

  return (
    <PosLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-800" data-testid="text-daily-title">สรุปรายวัน</h1>
            <p className="text-sm text-gray-500">สรุปยอดขายและกะขายในวันที่เลือก</p>
          </div>
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-9 w-40 text-sm" data-testid="input-date" />
        </div>

        {isLoading ? (
          <div className="text-center py-20 text-gray-400">กำลังโหลดข้อมูล...</div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="border-l-4 border-l-[#03c9d7]">
                <CardContent className="pt-5 pb-4">
                  <p className="text-xs text-gray-500">ยอดขายรวม</p>
                  <p className="text-2xl font-bold text-gray-800 mt-1" data-testid="text-daily-sales">฿{fmt(parseFloat(summary?.totalSales || "0"))}</p>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-[#fb9678]">
                <CardContent className="pt-5 pb-4">
                  <p className="text-xs text-gray-500">จำนวนบิล</p>
                  <p className="text-2xl font-bold text-gray-800 mt-1">{parseInt(summary?.totalTransactions || "0").toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-[#fec90f]">
                <CardContent className="pt-5 pb-4">
                  <p className="text-xs text-gray-500">ส่วนลดรวม</p>
                  <p className="text-2xl font-bold text-red-500 mt-1">฿{fmt(parseFloat(summary?.totalDiscount || "0"))}</p>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-[#f94d4d]">
                <CardContent className="pt-5 pb-4">
                  <p className="text-xs text-gray-500">บิลยกเลิก (Void)</p>
                  <p className="text-2xl font-bold text-gray-800 mt-1">{parseInt(summary?.voidCount || "0")}</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Clock className="h-4 w-4 text-[#03c9d7]" />
                    กะขาย ({sessions.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {sessions.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 text-sm">ไม่มีกะขายในวันนี้</div>
                  ) : (
                    <div className="space-y-3">
                      {sessions.map((s: any) => {
                        const variance = parseFloat(s.cashVariance || "0");
                        return (
                          <div key={s.id} className="p-3 rounded-lg border bg-gray-50/50" data-testid={`session-${s.id}`}>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-bold text-gray-800">{s.branchName || "สำนักงานใหญ่"}</p>
                                {s.terminalName && <span className="text-[10px] text-gray-400">({s.terminalName})</span>}
                              </div>
                              <Badge className={`text-[10px] ${s.status === "open" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                                {s.status === "open" ? "กำลังเปิด" : "ปิดแล้ว"}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-3 gap-3 text-center">
                              <div>
                                <p className="text-[10px] text-gray-400">ยอดขาย</p>
                                <p className="text-sm font-bold text-[#03c9d7]">฿{fmt(parseFloat(s.totalSales || "0"))}</p>
                              </div>
                              <div>
                                <p className="text-[10px] text-gray-400">บิล</p>
                                <p className="text-sm font-bold text-gray-700">{parseInt(s.totalTransactions || "0")}</p>
                              </div>
                              <div>
                                <p className="text-[10px] text-gray-400">ผลต่างเงินสด</p>
                                <p className={`text-sm font-bold ${variance === 0 ? "text-green-500" : variance < 0 ? "text-red-500" : "text-yellow-500"}`}>
                                  ฿{fmt(variance)}
                                </p>
                              </div>
                            </div>
                            <div className="mt-2 flex items-center gap-1 text-[10px] text-gray-400">
                              <Clock className="h-3 w-3" />
                              {s.openedAt ? new Date(s.openedAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) : "-"}
                              {s.closedAt && ` → ${new Date(s.closedAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}`}
                            </div>
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
                    <Receipt className="h-4 w-4 text-[#fb9678]" />
                    ยอดขายรายชั่วโมง
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {hourly.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 text-sm">ไม่มีข้อมูล</div>
                  ) : (
                    <div className="space-y-1">
                      {Array.from({ length: 24 }, (_, h) => {
                        const entry = hourly.find((e: any) => parseInt(e.hour) === h);
                        const total = entry ? parseFloat(entry.total) : 0;
                        const count = entry ? parseInt(entry.count) : 0;
                        const pct = (total / maxHourly) * 100;
                        if (total === 0) return null;
                        return (
                          <div key={h} className="flex items-center gap-2">
                            <span className="text-[10px] w-10 text-right text-gray-500 font-mono">{String(h).padStart(2, "0")}:00</span>
                            <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                              <div className="h-full rounded-full flex items-center px-1.5" style={{ width: `${Math.max(pct, 5)}%`, background: pct > 70 ? "#fb9678" : "#03c9d7" }}>
                                {pct > 25 && <span className="text-[8px] text-white font-bold">฿{fmt(total)}</span>}
                              </div>
                            </div>
                            <span className="text-[9px] text-gray-400 w-10 text-right">{count} บิล</span>
                          </div>
                        );
                      }).filter(Boolean)}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </PosLayout>
  );
}
