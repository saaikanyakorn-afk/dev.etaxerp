import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import Layout from "@/components/layout";
import ThaiDateInput from "@/components/thai-date-input";
import { useDateSettings } from "@/hooks/use-date-settings";
import {
  ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, Trash2, Edit, AlertTriangle, Bell
} from "lucide-react";

interface CalendarEvent {
  id: number;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string;
  allDay: boolean;
  color: string;
  category: string;
  userId: number;
  creatorName: string;
  source?: "calendar" | "hr_holiday" | "tax_deadline";
}

const THAI_MONTHS = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
const THAI_DAYS = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
const EN_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const EVENT_COLORS = [
  { value: "#fb9678", label: "ส้ม", bg: "bg-[#fb9678]" },
  { value: "#03c9d7", label: "ฟ้า", bg: "bg-[#03c9d7]" },
  { value: "#05b187", label: "เขียว", bg: "bg-[#05b187]" },
  { value: "#fec90f", label: "เหลือง", bg: "bg-[#fec90f]" },
  { value: "#f94d4d", label: "แดง", bg: "bg-[#f94d4d]" },
  { value: "#539BFF", label: "น้ำเงิน", bg: "bg-[#539BFF]" },
  { value: "#7c3aed", label: "ม่วง", bg: "bg-[#7c3aed]" },
];

const CATEGORIES = [
  { value: "general", label: "ทั่วไป" },
  { value: "meeting", label: "ประชุม" },
  { value: "deadline", label: "กำหนดส่ง" },
  { value: "holiday", label: "วันหยุด" },
  { value: "tax", label: "ภาษี" },
  { value: "live", label: "ไลฟ์สด" },
];

type ViewMode = "month" | "week" | "day";

export default function FullCalendar() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { dateEra, dateFmt } = useDateSettings();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [formData, setFormData] = useState({
    title: "", description: "", startDate: "", endDate: "",
    startTime: "09:00", endTime: "10:00",
    allDay: false, color: "#fb9678", category: "general",
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const dateRange = useMemo(() => {
    if (viewMode === "month") {
      const start = new Date(year, month, 1);
      start.setDate(start.getDate() - start.getDay());
      const end = new Date(year, month + 1, 0);
      end.setDate(end.getDate() + (6 - end.getDay()));
      return { start, end };
    } else if (viewMode === "week") {
      const start = new Date(currentDate);
      start.setDate(start.getDate() - start.getDay());
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return { start, end };
    } else {
      return { start: new Date(currentDate), end: new Date(currentDate) };
    }
  }, [year, month, viewMode, currentDate]);

  const { data: calendarEvents = [] } = useQuery<CalendarEvent[]>({
    queryKey: ["/api/calendar/events", dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: () => fetch(`/api/calendar/events?start=${dateRange.start.toISOString()}&end=${dateRange.end.toISOString()}`, { credentials: "include" }).then(r => r.json()),
  });

  const { data: taxData } = useQuery<{ deadlines: { date: string; title: string; forms: string[]; type: string }[] }>({
    queryKey: ["/api/calendar/tax-deadlines", year, month + 1],
    queryFn: () => fetch(`/api/calendar/tax-deadlines?year=${year}&month=${month + 1}`, { credentials: "include" }).then(r => r.json()),
  });

  const { data: upcomingTaxData } = useQuery<{ deadlines: { date: string; title: string; forms: string[]; type: string }[] }>({
    queryKey: ["/api/calendar/tax-deadlines/upcoming"],
    queryFn: () => fetch("/api/calendar/tax-deadlines/upcoming?days=7", { credentials: "include" }).then(r => r.json()),
  });

  const upcomingAlerts = useMemo(() => {
    const allDeadlines = upcomingTaxData?.deadlines || [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return allDeadlines
      .map(d => {
        const deadlineDate = new Date(d.date + "T00:00:00");
        const diffMs = deadlineDate.getTime() - today.getTime();
        const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        return { ...d, daysLeft, deadlineDate };
      })
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }, [upcomingTaxData]);

  const events: CalendarEvent[] = useMemo(() => {
    const taxEvents: CalendarEvent[] = (taxData?.deadlines || []).map((td, i) => ({
      id: -(10000 + i),
      title: `📋 ${td.title}`,
      description: `แบบ: ${td.forms.join(", ")}`,
      startDate: td.date,
      endDate: td.date,
      allDay: true,
      color: td.type === "e-filing" ? "#539BFF" : "#7c3aed",
      category: "tax",
      userId: 0,
      creatorName: "กรมสรรพากร",
      source: "tax_deadline" as const,
    }));
    return [...calendarEvents, ...taxEvents];
  }, [calendarEvents, taxData]);

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/calendar/events", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/calendar/events"] }); closeForm(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => apiRequest("PATCH", `/api/calendar/events/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/calendar/events"] }); closeForm(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/calendar/events/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/calendar/events"] }); closeForm(); },
  });

  const navigate = (dir: number) => {
    const d = new Date(currentDate);
    if (viewMode === "month") d.setMonth(d.getMonth() + dir);
    else if (viewMode === "week") d.setDate(d.getDate() + dir * 7);
    else d.setDate(d.getDate() + dir);
    setCurrentDate(d);
  };

  const goToday = () => setCurrentDate(new Date());

  const toISODate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const toTimeStr = (d: Date) => `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;

  const openNewEvent = (date?: Date) => {
    const d = date || new Date();
    const endD = new Date(d);
    endD.setHours(endD.getHours() + 1);
    setFormData({
      title: "", description: "",
      startDate: toISODate(d), endDate: toISODate(endD),
      startTime: toTimeStr(d), endTime: toTimeStr(endD),
      allDay: false, color: "#fb9678", category: "general",
    });
    setEditingEvent(null);
    setShowEventForm(true);
  };

  const openEditEvent = (ev: CalendarEvent) => {
    if (ev.source === "hr_holiday" || ev.source === "tax_deadline") return;
    const sd = new Date(ev.startDate);
    const ed = new Date(ev.endDate);
    setFormData({
      title: ev.title,
      description: ev.description || "",
      startDate: toISODate(sd), endDate: toISODate(ed),
      startTime: toTimeStr(sd), endTime: toTimeStr(ed),
      allDay: ev.allDay,
      color: ev.color,
      category: ev.category,
    });
    setEditingEvent(ev);
    setShowEventForm(true);
  };

  const closeForm = () => {
    setShowEventForm(false);
    setEditingEvent(null);
  };

  const handleSubmit = () => {
    if (!formData.title || !formData.startDate || !formData.endDate) return;
    const startDateTime = formData.allDay ? formData.startDate : `${formData.startDate}T${formData.startTime}`;
    const endDateTime = formData.allDay ? formData.endDate : `${formData.endDate}T${formData.endTime}`;
    const payload = { ...formData, startDate: startDateTime, endDate: endDateTime };
    if (editingEvent) {
      updateMutation.mutate({ id: editingEvent.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const monthDays = useMemo(() => {
    const days: Date[] = [];
    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      days.push(new Date(d));
    }
    return days;
  }, [dateRange]);

  const getEventsForDate = (date: Date) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    const dayStr = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    return events.filter(ev => {
      const evStartStr = typeof ev.startDate === "string" ? ev.startDate.slice(0, 10) : new Date(ev.startDate).toLocaleDateString("en-CA");
      const evEndStr = typeof ev.endDate === "string" ? ev.endDate.slice(0, 10) : new Date(ev.endDate).toLocaleDateString("en-CA");
      return evStartStr <= dayStr && evEndStr >= dayStr;
    });
  };

  const isToday = (date: Date) => {
    const now = new Date();
    return date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  };

  const isCurrentMonth = (date: Date) => date.getMonth() === month;

  const headerTitle = useMemo(() => {
    if (viewMode === "month") return `${THAI_MONTHS[month]} ${year + 543}`;
    if (viewMode === "week") {
      const s = dateRange.start;
      const e = dateRange.end;
      return `${s.getDate()} - ${e.getDate()} ${THAI_MONTHS[e.getMonth()]} ${e.getFullYear() + 543}`;
    }
    return `${currentDate.getDate()} ${THAI_MONTHS[month]} ${year + 543}`;
  }, [viewMode, month, year, currentDate, dateRange]);

  return (
    <Layout>
    <div className="min-h-screen bg-gray-50 p-4 md:p-6" data-testid="full-calendar-page">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
          {upcomingAlerts.length > 0 && (
            <div className="mx-4 md:mx-6 mt-4" data-testid="tax-alert-banner">
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Bell className="h-5 w-5 text-amber-600 animate-pulse" />
                  <span className="font-bold text-amber-800">แจ้งเตือนกำหนดยื่นภาษี</span>
                </div>
                <div className="space-y-2">
                  {upcomingAlerts.map((alert, i) => {
                    const isUrgent = alert.daysLeft <= 2;
                    const isWarning = alert.daysLeft <= 5;
                    return (
                      <div
                        key={i}
                        className={cn(
                          "flex items-start gap-3 rounded-lg px-3 py-2.5 text-sm",
                          isUrgent
                            ? "bg-red-100 border border-red-300"
                            : isWarning
                            ? "bg-amber-100 border border-amber-300"
                            : "bg-white border border-gray-200"
                        )}
                        data-testid={`tax-alert-item-${i}`}
                      >
                        <AlertTriangle
                          className={cn(
                            "h-4 w-4 mt-0.5 shrink-0",
                            isUrgent ? "text-red-600" : isWarning ? "text-amber-600" : "text-gray-500"
                          )}
                        />
                        <div className="flex-1 min-w-0">
                          <div className={cn("font-medium", isUrgent ? "text-red-800" : isWarning ? "text-amber-800" : "text-gray-800")}>
                            {alert.title.replace("📋 ", "")}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            แบบ: {alert.forms.join(", ")} • {alert.type === "e-filing" ? "ยื่นทางอินเทอร์เน็ต" : "ยื่นแบบกระดาษ"}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className={cn(
                            "text-xs font-bold px-2 py-1 rounded-full",
                            isUrgent
                              ? "bg-red-600 text-white"
                              : isWarning
                              ? "bg-amber-500 text-white"
                              : "bg-gray-200 text-gray-700"
                          )}>
                            {alert.daysLeft === 0
                              ? "วันนี้!"
                              : alert.daysLeft === 1
                              ? "พรุ่งนี้"
                              : `อีก ${alert.daysLeft} วัน`}
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            {alert.deadlineDate.getDate()}/{alert.deadlineDate.getMonth() + 1}/{alert.deadlineDate.getFullYear() + 543}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          <div className="p-4 md:p-6 border-b">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <CalendarIcon className="h-6 w-6 text-[#fb9678]" />
                ปฏิทินสำนักงาน
              </h1>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center border rounded-lg overflow-hidden">
                  <button
                    className="px-3 py-2 hover:bg-gray-50 transition-colors text-gray-600"
                    onClick={() => navigate(-1)}
                    data-testid="btn-prev"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    className="px-3 py-2 hover:bg-gray-50 transition-colors text-gray-600"
                    onClick={() => navigate(1)}
                    data-testid="btn-next"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-[#fb9678] text-[#fb9678] hover:bg-orange-50"
                  onClick={goToday}
                  data-testid="btn-today"
                >
                  วันนี้
                </Button>
                <h2 className="text-lg font-bold text-gray-800 min-w-[200px] text-center">{headerTitle}</h2>
                <div className="flex border rounded-lg overflow-hidden">
                  {(["month", "week", "day"] as ViewMode[]).map(mode => (
                    <button
                      key={mode}
                      className={cn(
                        "px-3 py-1.5 text-sm font-medium transition-colors",
                        viewMode === mode
                          ? "bg-[#fb9678] text-white"
                          : "text-gray-600 hover:bg-gray-50"
                      )}
                      onClick={() => setViewMode(mode)}
                      data-testid={`btn-view-${mode}`}
                    >
                      {mode === "month" ? "เดือน" : mode === "week" ? "สัปดาห์" : "วัน"}
                    </button>
                  ))}
                </div>
                <Button
                  size="sm"
                  className="bg-[#fb9678] hover:bg-[#e8856a] text-white"
                  onClick={() => openNewEvent()}
                  data-testid="btn-new-event"
                >
                  <Plus className="h-4 w-4 mr-1" /> เพิ่มกิจกรรม
                </Button>
              </div>
            </div>
          </div>

          {viewMode === "month" && (
            <div>
              <div className="grid grid-cols-7 border-b">
                {EN_DAYS.map((day, i) => (
                  <div key={day} className="py-3 text-center text-sm font-semibold text-gray-500 border-r last:border-r-0">
                    <span className="hidden sm:inline">{day}</span>
                    <span className="sm:hidden">{THAI_DAYS[i]}</span>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {monthDays.map((date, idx) => {
                  const dayEvents = getEventsForDate(date);
                  const today = isToday(date);
                  const inMonth = isCurrentMonth(date);
                  return (
                    <div
                      key={idx}
                      className={cn(
                        "min-h-[100px] md:min-h-[120px] border-b border-r p-1 md:p-2 cursor-pointer hover:bg-gray-50 transition-colors",
                        !inMonth && "bg-gray-50/50",
                        idx % 7 === 6 && "border-r-0"
                      )}
                      onClick={() => openNewEvent(date)}
                      data-testid={`cal-day-${date.getDate()}-${date.getMonth()}`}
                    >
                      <div className="flex justify-end">
                        <span className={cn(
                          "text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full",
                          today && "bg-[#fb9678] text-white",
                          !today && inMonth && "text-gray-700",
                          !today && !inMonth && "text-gray-300"
                        )}>
                          {date.getDate()}
                        </span>
                      </div>
                      <div className="space-y-1 mt-1">
                        {dayEvents.slice(0, 3).map(ev => (
                          <div
                            key={ev.id}
                            className="px-2 py-0.5 rounded text-xs text-white truncate cursor-pointer hover:opacity-80"
                            style={{ backgroundColor: ev.color }}
                            onClick={(e) => { e.stopPropagation(); openEditEvent(ev); }}
                            data-testid={`event-${ev.id}`}
                            title={ev.title}
                          >
                            {ev.title}
                          </div>
                        ))}
                        {dayEvents.length > 3 && (
                          <p className="text-xs text-gray-400 pl-1">+{dayEvents.length - 3} อื่นๆ</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {viewMode === "week" && (
            <div>
              <div className="grid grid-cols-7 border-b">
                {monthDays.slice(0, 7).map((date, i) => (
                  <div key={i} className={cn("py-3 text-center border-r last:border-r-0", isToday(date) && "bg-orange-50")}>
                    <div className="text-xs text-gray-500">{EN_DAYS[i]}</div>
                    <div className={cn(
                      "text-lg font-bold mt-1",
                      isToday(date) ? "text-[#fb9678]" : "text-gray-700"
                    )}>
                      {date.getDate()}
                    </div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {monthDays.slice(0, 7).map((date, i) => {
                  const dayEvents = getEventsForDate(date);
                  return (
                    <div
                      key={i}
                      className="min-h-[300px] border-r last:border-r-0 p-2 cursor-pointer hover:bg-gray-50"
                      onClick={() => openNewEvent(date)}
                    >
                      <div className="space-y-1">
                        {dayEvents.map(ev => (
                          <div
                            key={ev.id}
                            className="px-2 py-1 rounded text-xs text-white truncate cursor-pointer hover:opacity-80"
                            style={{ backgroundColor: ev.color }}
                            onClick={(e) => { e.stopPropagation(); openEditEvent(ev); }}
                          >
                            {ev.title}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {viewMode === "day" && (
            <div className="p-4">
              <div className="space-y-2">
                {Array.from({ length: 24 }, (_, hour) => {
                  const hourEvents = events.filter(ev => {
                    const evStart = new Date(ev.startDate);
                    const evEnd = new Date(ev.endDate);
                    const hourStart = new Date(currentDate);
                    hourStart.setHours(hour, 0, 0);
                    const hourEnd = new Date(currentDate);
                    hourEnd.setHours(hour + 1, 0, 0);
                    return evStart < hourEnd && evEnd > hourStart;
                  });
                  return (
                    <div key={hour} className="flex border-b border-gray-100 min-h-[48px]">
                      <div className="w-16 shrink-0 text-xs text-gray-400 pt-1 text-right pr-3">
                        {hour.toString().padStart(2, "0")}:00
                      </div>
                      <div
                        className="flex-1 pl-3 border-l cursor-pointer hover:bg-gray-50 py-1"
                        onClick={() => {
                          const d = new Date(currentDate);
                          d.setHours(hour, 0, 0);
                          openNewEvent(d);
                        }}
                      >
                        {hourEvents.map(ev => (
                          <div
                            key={ev.id}
                            className="px-2 py-1 rounded text-xs text-white mb-1 cursor-pointer hover:opacity-80"
                            style={{ backgroundColor: ev.color }}
                            onClick={(e) => { e.stopPropagation(); openEditEvent(ev); }}
                          >
                            {ev.title}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog open={showEventForm} onOpenChange={setShowEventForm}>
        <DialogContent className="max-w-md overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingEvent ? <Edit className="h-5 w-5 text-[#fb9678]" /> : <Plus className="h-5 w-5 text-[#fb9678]" />}
              {editingEvent ? "แก้ไขกิจกรรม" : "เพิ่มกิจกรรมใหม่"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>ชื่อกิจกรรม</Label>
              <Input
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                placeholder="เช่น ประชุมทีม"
                data-testid="input-event-title"
              />
            </div>
            <div>
              <Label>รายละเอียด</Label>
              <Textarea
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder="รายละเอียดเพิ่มเติม"
                rows={2}
              />
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="min-w-0">
                  <Label>วันเริ่มต้น</Label>
                  <ThaiDateInput
                    value={formData.startDate}
                    onChange={v => setFormData({ ...formData, startDate: v })}
                    dateEra={dateEra}
                    dateFmt={dateFmt}
                    className="w-full"
                    data-testid="input-start-date"
                  />
                </div>
                <div className="min-w-0">
                  <Label>วันสิ้นสุด</Label>
                  <ThaiDateInput
                    value={formData.endDate}
                    onChange={v => setFormData({ ...formData, endDate: v })}
                    dateEra={dateEra}
                    dateFmt={dateFmt}
                    className="w-full"
                    data-testid="input-end-date"
                  />
                </div>
              </div>
              {!formData.allDay && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="min-w-0">
                    <Label>เวลาเริ่ม</Label>
                    <Input
                      type="time"
                      value={formData.startTime}
                      onChange={e => setFormData({ ...formData, startTime: e.target.value })}
                      className="w-full text-sm"
                      data-testid="input-start-time"
                    />
                  </div>
                  <div className="min-w-0">
                    <Label>เวลาสิ้นสุด</Label>
                    <Input
                      type="time"
                      value={formData.endTime}
                      onChange={e => setFormData({ ...formData, endTime: e.target.value })}
                      className="w-full text-sm"
                      data-testid="input-end-time"
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.allDay}
                onCheckedChange={v => setFormData({ ...formData, allDay: v })}
              />
              <Label>ทั้งวัน</Label>
            </div>
            <div>
              <Label>หมวดหมู่</Label>
              <Select value={formData.category} onValueChange={v => setFormData({ ...formData, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>สี</Label>
              <div className="flex gap-2 mt-1">
                {EVENT_COLORS.map(c => (
                  <button
                    key={c.value}
                    className={cn(
                      "w-8 h-8 rounded-full transition-all",
                      formData.color === c.value ? "ring-2 ring-offset-2 ring-gray-400 scale-110" : "hover:scale-105"
                    )}
                    style={{ backgroundColor: c.value }}
                    onClick={() => setFormData({ ...formData, color: c.value })}
                    title={c.label}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            {editingEvent && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => deleteMutation.mutate(editingEvent.id)}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="h-4 w-4 mr-1" /> ลบ
              </Button>
            )}
            <div className="flex-1" />
            <Button variant="outline" onClick={closeForm}>ยกเลิก</Button>
            <Button
              className="bg-[#fb9678] hover:bg-[#e8856a] text-white"
              onClick={handleSubmit}
              disabled={!formData.title || createMutation.isPending || updateMutation.isPending}
              data-testid="btn-save-event"
            >
              {editingEvent ? "บันทึก" : "สร้าง"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </Layout>
  );
}
