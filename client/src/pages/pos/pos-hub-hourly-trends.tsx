import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import PosLayout from "@/components/pos-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Clock, Calendar } from "lucide-react";

const DAY_NAMES = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัส", "ศุกร์", "เสาร์"];

function fmt(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PosHubHourlyTrends() {
  const { selectedCompanyId } = useCompany();
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const [from, setFrom] = useState(firstDay.toISOString().split("T")[0]);
  const [to, setTo] = useState(today.toISOString().split("T")[0]);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/pos/reports/hourly-trends", selectedCompanyId, from, to],
    queryFn: async () => {
      const r = await fetch(`/api/pos/reports/hourly-trends?companyId=${selectedCompanyId}&from=${from}&to=${to}`, { credentials: "include" });
      if (!r.ok) throw new Error();
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const hourly = data?.hourly || [];
  const dayOfWeek = data?.dayOfWeek || [];
  const maxHourly = Math.max(...hourly.map((h: any) => parseFloat(h.total)), 1);
  const maxDay = Math.max(...dayOfWeek.map((d: any) => parseFloat(d.total)), 1);

  return (
    <PosLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-800" data-testid="text-hourly-title">ช่วงเวลาขายดี</h1>
            <p className="text-sm text-gray-500">วิเคราะห์ยอดขายตามช่วงเวลาและวันในสัปดาห์</p>
          </div>
          <div className="flex items-center gap-2">
            <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-9 w-36 text-sm" data-testid="input-from" />
            <span className="text-gray-400">—</span>
            <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-9 w-36 text-sm" data-testid="input-to" />
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-20 text-gray-400">กำลังโหลดข้อมูล...</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Clock className="h-4 w-4 text-[#03c9d7]" />
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
                      const isActive = total > 0;
                      const isPeak = pct > 70;
                      return (
                        <div key={h} className="flex items-center gap-2" data-testid={`hourly-row-${h}`}>
                          <span className={`text-[10px] w-10 text-right shrink-0 font-mono ${isActive ? "text-gray-600" : "text-gray-300"}`}>
                            {String(h).padStart(2, "0")}:00
                          </span>
                          <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                            {total > 0 && (
                              <div
                                className="h-full rounded-full flex items-center px-1.5"
                                style={{
                                  width: `${Math.max(pct, 3)}%`,
                                  background: isPeak ? "#fb9678" : "#03c9d7",
                                }}
                              >
                                {pct > 20 && <span className="text-[8px] text-white font-bold whitespace-nowrap">฿{fmt(total)}</span>}
                              </div>
                            )}
                          </div>
                          {total > 0 && pct <= 20 && (
                            <span className="text-[9px] text-gray-400 shrink-0">฿{fmt(total)}</span>
                          )}
                          <span className={`text-[9px] w-10 text-right shrink-0 ${isActive ? "text-gray-400" : "text-gray-200"}`}>
                            {count > 0 ? `${count} บิล` : "-"}
                          </span>
                        </div>
                      );
                    })}
                    <div className="flex items-center gap-3 mt-3 pt-2 border-t justify-center">
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-sm bg-[#03c9d7]" />
                        <span className="text-[10px] text-gray-500">ปกติ</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-sm bg-[#fb9678]" />
                        <span className="text-[10px] text-gray-500">ชั่วโมงขายดี (Peak)</span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-[#fb9678]" />
                  ยอดขายแยกวัน
                </CardTitle>
              </CardHeader>
              <CardContent>
                {dayOfWeek.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-sm">ไม่มีข้อมูล</div>
                ) : (
                  <div className="space-y-3">
                    {Array.from({ length: 7 }, (_, d) => {
                      const entry = dayOfWeek.find((e: any) => parseInt(e.day) === d);
                      const total = entry ? parseFloat(entry.total) : 0;
                      const count = entry ? parseInt(entry.count) : 0;
                      const pct = (total / maxDay) * 100;
                      const isWeekend = d === 0 || d === 6;
                      return (
                        <div key={d} data-testid={`day-row-${d}`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-sm font-medium ${isWeekend ? "text-[#fb9678]" : "text-gray-700"}`}>
                              {DAY_NAMES[d]}
                            </span>
                            <div className="flex items-center gap-3">
                              <span className="text-[10px] text-gray-400">{count} บิล</span>
                              <span className="text-sm font-bold text-[#03c9d7]">฿{fmt(total)}</span>
                            </div>
                          </div>
                          <div className="bg-gray-100 rounded-full h-6 overflow-hidden">
                            <div
                              className="h-full rounded-full flex items-center justify-end px-2"
                              style={{
                                width: `${Math.max(pct, 2)}%`,
                                background: isWeekend ? "#fb9678" : "#03c9d7",
                              }}
                            >
                              {pct > 30 && <span className="text-[10px] text-white font-bold">{pct.toFixed(0)}%</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </PosLayout>
  );
}
