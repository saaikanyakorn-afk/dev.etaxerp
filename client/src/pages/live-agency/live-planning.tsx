import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Home,
  Radio,
  Clock,
  Users,
  Target,
  Bell,
  Play,
  Plus,
  Loader2,
  Package,
  Monitor,
  MessageSquare,
} from "lucide-react";

const PLATFORMS: Record<string, { label: string; className: string }> = {
  facebook: { label: "Facebook", className: "bg-[#e5f9fa] text-[#03c9d7] hover:bg-[#e5f9fa]" },
  tiktok: { label: "TikTok", className: "bg-pink-100 text-pink-700 hover:bg-pink-100" },
  instagram: { label: "Instagram", className: "bg-purple-100 text-purple-700 hover:bg-purple-100" },
  shopee: { label: "Shopee", className: "bg-orange-100 text-orange-700 hover:bg-orange-100" },
  lazada: { label: "Lazada", className: "bg-blue-100 text-blue-700 hover:bg-blue-100" },
  line: { label: "LINE", className: "bg-green-100 text-green-700 hover:bg-green-100" },
};

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

const THAI_DAYS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

function formatTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "-";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "-";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function platformBadge(platform: string) {
  const p = PLATFORMS[platform];
  if (!p) return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">{platform}</Badge>;
  return <Badge className={p.className}>{p.label}</Badge>;
}

function isSameDay(d1: Date, d2: Date): boolean {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

const CHECKLIST_ITEMS = [
  { id: "products", label: "สินค้าพร้อม", icon: Package },
  { id: "test", label: "ทดสอบไลฟ์", icon: Monitor },
  { id: "notify", label: "แจ้งเตือนลูกค้า", icon: MessageSquare },
];

export default function LivePlanning() {
  const { selectedCompanyId } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [checkedItems, setCheckedItems] = useState<Record<string, Record<string, boolean>>>({});

  const { data: calendarSessions = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/live-agency/calendar", selectedCompanyId],
    queryFn: async () => {
      if (!selectedCompanyId) return [];
      const res = await apiRequest("GET", `/api/live-agency/calendar?companyId=${selectedCompanyId}`);
      return res.json();
    },
    enabled: !!selectedCompanyId,
  });

  const notifyMutation = useMutation({
    mutationFn: async (id: number | string) => {
      const r = await apiRequest("POST", `/api/live-agency/sessions/${id}/notify`);
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "ส่งแจ้งเตือนสำเร็จ" });
    },
    onError: (err: any) => {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    },
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const calendarGrid = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDow = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const days: { date: Date | null; day: number; isCurrentMonth: boolean }[] = [];

    for (let i = 0; i < startDow; i++) {
      const d = new Date(year, month, -startDow + i + 1);
      days.push({ date: d, day: d.getDate(), isCurrentMonth: false });
    }

    for (let i = 1; i <= totalDays; i++) {
      days.push({ date: new Date(year, month, i), day: i, isCurrentMonth: true });
    }

    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      days.push({ date: d, day: d.getDate(), isCurrentMonth: false });
    }

    return days;
  }, [year, month]);

  const sessionsMap = useMemo(() => {
    const map: Record<string, any[]> = {};
    calendarSessions.forEach((s: any) => {
      const dateStr = s.scheduledAt || s.startTime;
      if (!dateStr) return;
      const d = new Date(dateStr);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map[key]) map[key] = [];
      map[key].push(s);
    });
    return map;
  }, [calendarSessions]);

  const now = new Date();
  const upcomingSessions = calendarSessions.filter((s: any) => {
    const d = new Date(s.scheduledAt || s.startTime || "");
    return d >= now || s.status === "scheduled" || s.status === "draft";
  });

  const thisWeekCount = calendarSessions.filter((s: any) => {
    const d = new Date(s.scheduledAt || s.startTime || "");
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);
    return d >= startOfWeek && d < endOfWeek;
  }).length;

  const thisMonthCount = calendarSessions.filter((s: any) => {
    const d = new Date(s.scheduledAt || s.startTime || "");
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  function prevMonth() {
    setCurrentDate(new Date(year, month - 1, 1));
  }

  function nextMonth() {
    setCurrentDate(new Date(year, month + 1, 1));
  }

  function toggleCheck(sessionId: string, itemId: string) {
    setCheckedItems(prev => ({
      ...prev,
      [sessionId]: {
        ...prev[sessionId],
        [itemId]: !prev[sessionId]?.[itemId],
      },
    }));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-1" data-testid="breadcrumb">
            <Home className="h-3.5 w-3.5" />
            <span>หน้าหลัก</span>
            <ChevronRight className="h-3.5 w-3.5" />
            <span>AI Live Agency</span>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-gray-800 font-medium">วางแผนไลฟ์</span>
          </div>
          <h1 className="text-2xl font-bold" style={{ color: "#fb9678" }} data-testid="text-page-title">
            วางแผนไลฟ์
          </h1>
        </div>
        <Button
          className="text-white"
          style={{ background: "#fb9678" }}
          data-testid="button-create-schedule"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          สร้างตารางไลฟ์
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="shadow-sm" data-testid="card-stat-week">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 mb-1">ไลฟ์สัปดาห์นี้</p>
                <p className="text-2xl font-bold" data-testid="value-week-count">{thisWeekCount}</p>
              </div>
              <div className="h-10 w-10 rounded-full flex items-center justify-center" style={{ backgroundColor: "#fff3ef" }}>
                <CalendarIcon className="h-5 w-5" style={{ color: "#fb9678" }} />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm" data-testid="card-stat-month">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 mb-1">ไลฟ์เดือนนี้</p>
                <p className="text-2xl font-bold" data-testid="value-month-count">{thisMonthCount}</p>
              </div>
              <div className="h-10 w-10 rounded-full flex items-center justify-center" style={{ backgroundColor: "#e5f9fa" }}>
                <Radio className="h-5 w-5" style={{ color: "#03c9d7" }} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm" data-testid="card-calendar">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" style={{ color: "#fb9678" }} />
              ปฏิทินไลฟ์
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={prevMonth} data-testid="button-prev-month">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[140px] text-center" data-testid="text-current-month">
                {THAI_MONTHS[month]} {year + 543}
              </span>
              <Button variant="outline" size="icon" onClick={nextMonth} data-testid="button-next-month">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden">
            {THAI_DAYS.map((d) => (
              <div key={d} className="bg-gray-50 p-2 text-center text-xs font-medium text-gray-500">
                {d}
              </div>
            ))}
            {calendarGrid.map((cell, idx) => {
              const key = cell.date ? `${cell.date.getFullYear()}-${cell.date.getMonth()}-${cell.date.getDate()}` : "";
              const daySessions = key ? sessionsMap[key] || [] : [];
              const isToday = cell.date ? isSameDay(cell.date, now) : false;

              return (
                <div
                  key={idx}
                  className={`bg-white p-1.5 min-h-[80px] ${!cell.isCurrentMonth ? "opacity-40" : ""}`}
                  data-testid={`calendar-cell-${idx}`}
                >
                  <div className={`text-xs font-medium mb-0.5 ${isToday ? "bg-[#fb9678] text-white rounded-full w-6 h-6 flex items-center justify-center" : "text-gray-700"}`}>
                    {cell.day}
                  </div>
                  {daySessions.slice(0, 2).map((s: any, i: number) => (
                    <div
                      key={i}
                      className="text-[10px] leading-tight p-0.5 rounded mb-0.5 truncate"
                      style={{ backgroundColor: "#fff3ef", color: "#fb9678" }}
                      title={`${formatTime(s.scheduledAt || s.startTime)} ${s.clientName || ""} ${s.platform || ""}`}
                    >
                      {formatTime(s.scheduledAt || s.startTime)} {s.clientName || s.title || ""}
                    </div>
                  ))}
                  {daySessions.length > 2 && (
                    <div className="text-[10px] text-gray-400">+{daySessions.length - 2} อื่นๆ</div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm" data-testid="card-upcoming-list">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" style={{ color: "#fb9678" }} />
            ไลฟ์ที่กำลังจะมาถึง
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : upcomingSessions.length === 0 ? (
            <div className="text-center py-8 text-gray-400" data-testid="text-no-upcoming">
              ยังไม่มีไลฟ์ที่กำลังจะมาถึง
            </div>
          ) : (
            <div className="space-y-4">
              {upcomingSessions.map((session: any, idx: number) => (
                <div
                  key={session.id || idx}
                  className="p-4 rounded-xl border bg-white hover:shadow-md transition-shadow"
                  data-testid={`card-upcoming-${session.id || idx}`}
                >
                  <div className="flex items-start justify-between flex-wrap gap-2 mb-3">
                    <div>
                      <h3 className="font-semibold text-sm mb-1">{session.title || `ไลฟ์ #${session.id}`}</h3>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Clock className="h-3.5 w-3.5" />
                        <span>{formatDateTime(session.scheduledAt || session.startTime)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {platformBadge(session.platform)}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-4 text-xs text-gray-600 mb-3">
                    {session.clientName && (
                      <div className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        <span>{session.clientName}</span>
                      </div>
                    )}
                    {(session.targetRevenue || session.goals) && (
                      <div className="flex items-center gap-1">
                        <Target className="h-3.5 w-3.5" />
                        <span>{session.goals || `เป้า ฿${Number(session.targetRevenue || 0).toLocaleString()}`}</span>
                      </div>
                    )}
                  </div>

                  <div className="mb-3">
                    <p className="text-xs font-medium text-gray-500 mb-2">Pre-live Checklist</p>
                    <div className="flex flex-wrap gap-3">
                      {CHECKLIST_ITEMS.map((item) => (
                        <label
                          key={item.id}
                          className="flex items-center gap-1.5 text-xs cursor-pointer"
                          data-testid={`checkbox-${item.id}-${session.id || idx}`}
                        >
                          <Checkbox
                            checked={checkedItems[String(session.id)]?.[item.id] || false}
                            onCheckedChange={() => toggleCheck(String(session.id), item.id)}
                          />
                          <item.icon className="h-3.5 w-3.5 text-gray-400" />
                          <span>{item.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => notifyMutation.mutate(session.id)}
                      disabled={notifyMutation.isPending}
                      data-testid={`button-notify-${session.id || idx}`}
                    >
                      {notifyMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                      ) : (
                        <Bell className="h-3.5 w-3.5 mr-1" />
                      )}
                      ส่งแจ้งเตือน
                    </Button>
                    <Button
                      size="sm"
                      className="text-white"
                      style={{ background: "#fb9678" }}
                      onClick={() => navigate(`/ecommerce/live-agency/monitor/${session.id}`)}
                      data-testid={`button-start-live-${session.id || idx}`}
                    >
                      <Play className="h-3.5 w-3.5 mr-1" />
                      เริ่มไลฟ์
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}