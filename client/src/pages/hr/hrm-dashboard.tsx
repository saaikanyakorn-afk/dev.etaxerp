import HRLayout from "@/components/hr-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users, CalendarDays, Bell, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useHrCompanyId } from "@/lib/company-context";

const THAI_MONTHS = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
const DAY_NAMES = ["อา.","จ.","อ.","พ.","พฤ.","ศ.","ส."];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export default function HRMDashboard() {
  const companyId = useHrCompanyId();
  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [viewMode, setViewMode] = useState<"Month"|"Week"|"Day">("Month");

  const { data: dashData } = useQuery<any>({
    queryKey: ["/api/hrm-dashboard", companyId],
    queryFn: async () => {
      const r = await fetch(`/api/hrm-dashboard?companyId=${companyId}`, { credentials: "include" });
      if (!r.ok) return { totalEmployees: 0, totalLeaves: 0, totalEvents: 0, notClockedIn: [], holidays: [] };
      return r.json();
    },
    enabled: !!companyId,
  });

  const { data: calHolidays } = useQuery<any[]>({
    queryKey: ["/api/holidays", calYear, companyId],
    queryFn: async () => {
      const r = await fetch(`/api/holidays?year=${calYear}&companyId=${companyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!companyId,
  });

  const totalEmployees = dashData?.totalEmployees ?? 0;
  const totalLeaves = dashData?.totalLeaves ?? 0;
  const totalEvents = dashData?.totalEvents ?? 0;
  const notClockedIn = dashData?.notClockedIn ?? [];
  const holidays: any[] = calHolidays ?? [];

  const prevMonth = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1); }
    else setCalMonth(calMonth - 1);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1); }
    else setCalMonth(calMonth + 1);
  };
  const goToday = () => { setCalYear(today.getFullYear()); setCalMonth(today.getMonth()); };

  const daysInMonth = getDaysInMonth(calYear, calMonth);
  const firstDay = getFirstDayOfMonth(calYear, calMonth);
  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);

  const holidayDates = new Map<string, string>();
  holidays.forEach((h: any) => {
    const d = new Date(h.date);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    holidayDates.set(key, h.name);
  });

  return (
    <HRLayout>
      <div className="space-y-6">
        <div className="rounded-2xl overflow-hidden relative" style={{ background: "var(--theme-primary)" }}>
          <div className="flex items-center justify-between px-8 py-6">
            <div className="text-white z-10">
              <h2 className="text-2xl font-bold" data-testid="text-company-name">E-Tax Center</h2>
              <p className="text-white/80 mt-1 text-sm">ระบบบริหารทรัพยากรบุคคล จัดการงาน HR<br/>ได้อย่างราบรื่น ครบถ้วน และมีประสิทธิภาพ</p>
            </div>
            <div className="hidden md:block z-10">
              <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'%3E%3Ccircle cx='60' cy='45' r='25' fill='%23fff' opacity='0.3'/%3E%3Ccircle cx='40' cy='75' r='20' fill='%23fff' opacity='0.2'/%3E%3Ccircle cx='80' cy='75' r='20' fill='%23fff' opacity='0.2'/%3E%3Cpath d='M50 40 L60 30 L70 40' stroke='%23fff' stroke-width='3' fill='none' opacity='0.5'/%3E%3C/svg%3E" alt="" className="h-28 w-28 opacity-80" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 -mt-4 relative z-10">
          <Card className="border-0 shadow-md" data-testid="card-total-employees">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="h-12 w-12 rounded-full flex items-center justify-center" style={{ background: "rgba(249,77,77,0.15)" }}>
                <Users className="h-6 w-6" style={{ color: "#f94d4d" }} />
              </div>
              <div>
                <p className="text-3xl font-bold" style={{ color: "#f94d4d" }}>{totalEmployees}</p>
                <p className="text-sm text-muted-foreground">พนักงานทั้งหมด</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md" data-testid="card-total-leaves">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="h-12 w-12 rounded-full flex items-center justify-center" style={{ background: "rgba(5,177,135,0.15)" }}>
                <CalendarDays className="h-6 w-6" style={{ color: "#05b187" }} />
              </div>
              <div>
                <p className="text-3xl font-bold" style={{ color: "#05b187" }}>{totalLeaves}</p>
                <p className="text-sm text-muted-foreground">การลาทั้งหมด</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md" data-testid="card-total-events">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="h-12 w-12 rounded-full flex items-center justify-center" style={{ background: "rgba(251,150,120,0.15)" }}>
                <Bell className="h-6 w-6" style={{ color: "#fb9678" }} />
              </div>
              <div>
                <p className="text-3xl font-bold" style={{ color: "#fb9678" }}>{totalEvents}</p>
                <p className="text-sm text-muted-foreground">กิจกรรม / วันหยุด</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-0 shadow-md" data-testid="card-not-clocked-in">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">พนักงานที่ยังไม่ลงเวลาวันนี้</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-semibold">ชื่อ</TableHead>
                    <TableHead className="font-semibold">สถานะ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notClockedIn.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center text-muted-foreground py-8">
                        พนักงานทุกคนลงเวลาเรียบร้อยแล้ว
                      </TableCell>
                    </TableRow>
                  ) : (
                    notClockedIn.map((emp: any) => (
                      <TableRow key={emp.id} data-testid={`row-notclockedin-${emp.id}`}>
                        <TableCell className="font-medium">{emp.fullName}</TableCell>
                        <TableCell>
                          <Badge variant={emp.status === "ลา" ? "secondary" : "destructive"} className="text-xs">
                            {emp.status === "ลา" ? "ลา" : "ขาด"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md" data-testid="card-holidays-events">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">วันหยุด & กิจกรรม</h3>
              
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-9 w-9 p-0 rounded-full"
                    style={{ background: "var(--theme-primary)", color: "white" }}
                    onClick={prevMonth}
                    data-testid="button-prev-month"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-9 w-9 p-0 rounded-full"
                    style={{ background: "var(--theme-primary)", color: "white" }}
                    onClick={nextMonth}
                    data-testid="button-next-month"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 rounded-full px-4"
                    style={{ background: "var(--theme-primary)", color: "white", border: "none" }}
                    onClick={goToday}
                    data-testid="button-today"
                  >
                    วันนี้
                  </Button>
                </div>

                <div className="text-center">
                  <span className="text-lg font-bold">
                    {THAI_MONTHS[calMonth]} {calYear + 543}
                  </span>
                </div>

                <div className="flex bg-muted rounded-full overflow-hidden">
                  {([{key: "Month", label: "เดือน"}, {key: "Week", label: "สัปดาห์"}, {key: "Day", label: "วัน"}] as const).map((m) => (
                    <button
                      key={m.key}
                      className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === m.key ? "text-white" : "text-muted-foreground hover:text-foreground"}`}
                      style={viewMode === m.key ? { background: "var(--theme-primary)" } : undefined}
                      onClick={() => setViewMode(m.key as any)}
                      data-testid={`button-view-${m.key.toLowerCase()}`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-7 gap-0">
                {DAY_NAMES.map((d) => (
                  <div key={d} className="text-center py-2 text-sm font-semibold text-muted-foreground">
                    {d}
                  </div>
                ))}
                {calendarDays.map((day, idx) => {
                  const isToday = day === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();
                  const holidayKey = day ? `${calYear}-${calMonth}-${day}` : "";
                  const holidayName = day ? holidayDates.get(holidayKey) : undefined;
                  return (
                    <div
                      key={idx}
                      className={`relative text-center py-2 text-sm min-h-[40px] ${!day ? "" : "cursor-default"} ${isToday ? "font-bold" : ""}`}
                      title={holidayName || ""}
                    >
                      {day && (
                        <>
                          <span
                            className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${isToday ? "text-white" : ""}`}
                            style={isToday ? { background: "var(--theme-primary)" } : undefined}
                          >
                            {day}
                          </span>
                          {holidayName && (
                            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full" style={{ background: "#f94d4d" }} />
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>

              {holidays.filter((h: any) => {
                const d = new Date(h.date);
                return d.getFullYear() === calYear && d.getMonth() === calMonth;
              }).length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">กิจกรรมเดือนนี้:</p>
                  {holidays
                    .filter((h: any) => {
                      const d = new Date(h.date);
                      return d.getFullYear() === calYear && d.getMonth() === calMonth;
                    })
                    .map((h: any) => {
                      const d = new Date(h.date);
                      return (
                        <div key={h.id} className="flex items-center gap-2 text-sm" data-testid={`event-${h.id}`}>
                          <div className="w-2 h-2 rounded-full" style={{ background: "#f94d4d" }} />
                          <span className="text-muted-foreground">{d.getDate()} {THAI_MONTHS[d.getMonth()].substring(0, 3)}</span>
                          <span className="font-medium">{h.name}</span>
                        </div>
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </HRLayout>
  );
}
