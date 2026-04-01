import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useCompany } from "@/lib/company-context";
import EtaxCenterLayout from "@/components/etax-center-layout";
import { apiRequest } from "@/lib/queryClient";
import {
  ChevronLeft, ChevronRight, Calendar as CalendarIcon,
  Plus, X, Pencil, Trash2, Clock,
} from "lucide-react";
import ThaiDateInput from "@/components/thai-date-input";

const MONTHS = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
const DAYS = ["อา","จ","อ","พ","พฤ","ศ","ส"];
const COLORS = [
  { value: "#fb9678", label: "ส้ม" },
  { value: "#03c9d7", label: "ฟ้า" },
  { value: "#05b187", label: "เขียว" },
  { value: "#539BFF", label: "น้ำเงิน" },
  { value: "#fec90f", label: "เหลือง" },
  { value: "#f94d4d", label: "แดง" },
  { value: "#9b59b6", label: "ม่วง" },
];
const CATEGORIES = [
  { value: "general", label: "ทั่วไป" },
  { value: "meeting", label: "ประชุม" },
  { value: "deadline", label: "กำหนดส่ง" },
  { value: "reminder", label: "เตือนความจำ" },
  { value: "holiday", label: "วันหยุด" },
];

function toBE(year: number) { return year + 543; }

interface CalendarEvent {
  id: number;
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  allDay: boolean;
  color: string;
  category: string;
  userId: number;
  creatorName?: string;
  companyId: number;
  source?: string;
}

interface EventForm {
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  color: string;
  category: string;
}

const emptyForm = (date?: string): EventForm => ({
  title: "",
  description: "",
  startDate: date || new Date().toISOString().slice(0, 10),
  endDate: date || new Date().toISOString().slice(0, 10),
  startTime: "09:00",
  endTime: "10:00",
  allDay: true,
  color: "#fb9678",
  category: "general",
});

export default function MyCalendarPage() {
  const { user } = useAuth();
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [form, setForm] = useState<EventForm>(emptyForm());

  const startRange = `${year}-${String(month).padStart(2, "0")}-01`;
  const endRange = `${month === 12 ? year + 1 : year}-${String(month === 12 ? 1 : month + 1).padStart(2, "0")}-01`;

  const { data: workboardEvents = [] } = useQuery({
    queryKey: ["/api/etax-hub/my-calendar", selectedCompanyId, month, year],
    queryFn: () => fetch(`/api/etax-hub/my-calendar?companyId=${selectedCompanyId}&month=${month}&year=${year}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!selectedCompanyId,
  });

  const { data: calendarEvents = [] } = useQuery<CalendarEvent[]>({
    queryKey: ["/api/calendar/events", selectedCompanyId, startRange, endRange],
    queryFn: async () => {
      const r = await fetch(`/api/calendar/events?companyId=${selectedCompanyId}&start=${startRange}&end=${endRange}`, { credentials: "include" });
      if (!r.ok) return [];
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!selectedCompanyId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/calendar/events"] });
  };

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/calendar/events", data),
    onSuccess: () => { invalidate(); setShowForm(false); setEditingEvent(null); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => apiRequest("PATCH", `/api/calendar/events/${id}`, data),
    onSuccess: () => { invalidate(); setShowForm(false); setEditingEvent(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/calendar/events/${id}`),
    onSuccess: () => { invalidate(); },
  });

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const startDow = firstDay.getDay();
    const totalDays = lastDay.getDate();
    const days: { date: string; day: number; inMonth: boolean }[] = [];
    const prevLast = new Date(year, month - 1, 0).getDate();
    for (let i = startDow - 1; i >= 0; i--) {
      const d = prevLast - i;
      const m = month - 1 <= 0 ? 12 : month - 1;
      const y = month - 1 <= 0 ? year - 1 : year;
      days.push({ date: `${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`, day: d, inMonth: false });
    }
    for (let d = 1; d <= totalDays; d++) {
      days.push({ date: `${year}-${String(month).padStart(2,"0")}-${String(d).padStart(2,"0")}`, day: d, inMonth: true });
    }
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      const m = month + 1 > 12 ? 1 : month + 1;
      const y = month + 1 > 12 ? year + 1 : year;
      days.push({ date: `${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`, day: d, inMonth: false });
    }
    return days;
  }, [month, year]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const ev of workboardEvents) {
      const d = ev.date?.slice(0, 10);
      if (d) (map[d] ||= []).push({ ...ev, source: "workboard" });
    }
    for (const ev of calendarEvents) {
      const start = typeof ev.startDate === "string" ? ev.startDate.slice(0, 10) : new Date(ev.startDate).toISOString().slice(0, 10);
      const end = typeof ev.endDate === "string" ? ev.endDate.slice(0, 10) : new Date(ev.endDate).toISOString().slice(0, 10);
      let cur = new Date(start + "T12:00:00");
      const endD = new Date(end + "T12:00:00");
      while (cur <= endD) {
        const y = cur.getFullYear();
        const m = String(cur.getMonth() + 1).padStart(2, "0");
        const dd = String(cur.getDate()).padStart(2, "0");
        const d = `${y}-${m}-${dd}`;
        (map[d] ||= []).push({ ...ev, displayDate: d, source: ev.source || "calendar" });
        cur.setDate(cur.getDate() + 1);
      }
    }
    return map;
  }, [workboardEvents, calendarEvents]);

  const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const selectedEvents = selectedDate ? (eventsByDate[selectedDate] || []) : [];

  const openAddForm = (date: string) => {
    setForm(emptyForm(date));
    setEditingEvent(null);
    setShowForm(true);
  };

  const openEditForm = (ev: CalendarEvent) => {
    const startD = typeof ev.startDate === "string" ? ev.startDate.slice(0, 10) : new Date(ev.startDate).toISOString().slice(0, 10);
    const endD = typeof ev.endDate === "string" ? ev.endDate.slice(0, 10) : new Date(ev.endDate).toISOString().slice(0, 10);
    const startT = typeof ev.startDate === "string" && ev.startDate.length > 10 ? ev.startDate.slice(11, 16) : "09:00";
    const endT = typeof ev.endDate === "string" && ev.endDate.length > 10 ? ev.endDate.slice(11, 16) : "10:00";
    setForm({
      title: ev.title,
      description: ev.description || "",
      startDate: startD,
      endDate: endD,
      startTime: startT,
      endTime: endT,
      allDay: ev.allDay,
      color: ev.color,
      category: ev.category,
    });
    setEditingEvent(ev);
    setShowForm(true);
  };

  const handleSubmit = () => {
    if (!form.title.trim()) return;
    const startDate = form.allDay ? `${form.startDate}T00:00:00` : `${form.startDate}T${form.startTime}:00`;
    const endDate = form.allDay ? `${form.endDate}T23:59:59` : `${form.endDate}T${form.endTime}:00`;
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      startDate,
      endDate,
      allDay: form.allDay,
      color: form.color,
      category: form.category,
      companyId: selectedCompanyId,
    };
    if (editingEvent) {
      updateMutation.mutate({ id: editingEvent.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleDelete = (ev: CalendarEvent) => {
    if (confirm(`ลบกิจกรรม "${ev.title}" หรือไม่?`)) {
      deleteMutation.mutate(ev.id);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <EtaxCenterLayout>
      <div>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <CalendarIcon className="w-6 h-6 text-[#fb9678]" />
            <h1 className="text-2xl font-bold text-gray-900" data-testid="text-calendar-title">ปฏิทินของฉัน</h1>
          </div>
          <button
            onClick={() => openAddForm(todayStr)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors"
            style={{ backgroundColor: "#fb9678" }}
            data-testid="btn-add-event"
          >
            <Plus className="w-4 h-4" />
            เพิ่มกิจกรรม
          </button>
        </div>

        <div className="bg-white rounded-xl border shadow-sm">
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-lg" data-testid="btn-prev-month">
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <h2 className="text-lg font-bold text-gray-900" data-testid="text-month-year">
              {MONTHS[month - 1]} {toBE(year)}
            </h2>
            <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-lg" data-testid="btn-next-month">
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          <div className="grid grid-cols-7">
            {DAYS.map(d => (
              <div key={d} className="text-center py-2 text-xs font-semibold text-gray-400 border-b">
                {d}
              </div>
            ))}
            {calendarDays.map((cell, i) => {
              const dayEvents = eventsByDate[cell.date] || [];
              const isToday = cell.date === todayStr;
              const isSelected = cell.date === selectedDate;
              return (
                <div
                  key={i}
                  className={`min-h-[90px] p-1 border-b border-r cursor-pointer transition-colors group ${
                    !cell.inMonth ? "bg-gray-50" : isSelected ? "bg-[#fb9678]/5" : "hover:bg-gray-50"
                  }`}
                  onClick={() => setSelectedDate(cell.date === selectedDate ? null : cell.date)}
                  data-testid={`cell-day-${cell.date}`}
                >
                  <div className="flex items-center justify-between">
                    <div className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${
                      isToday ? "bg-[#fb9678] text-white" : !cell.inMonth ? "text-gray-300" : "text-gray-700"
                    }`}>
                      {cell.day}
                    </div>
                    {cell.inMonth && (
                      <button
                        onClick={(e) => { e.stopPropagation(); openAddForm(cell.date); }}
                        className="w-5 h-5 flex items-center justify-center rounded-full text-gray-300 hover:text-[#fb9678] hover:bg-[#fb9678]/10 opacity-0 group-hover:opacity-100 transition-opacity"
                        data-testid={`btn-add-${cell.date}`}
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <div className="space-y-0.5 mt-0.5">
                    {dayEvents.slice(0, 3).map((ev: any, j: number) => (
                      <div
                        key={`${ev.source}-${ev.id}-${j}`}
                        className="text-[10px] leading-tight px-1 py-0.5 rounded truncate text-white font-medium cursor-pointer hover:opacity-80"
                        style={{ backgroundColor: ev.color || ev.boardColor || "#539BFF" }}
                        title={ev.title || ev.itemName}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (ev.source === "calendar") openEditForm(ev);
                        }}
                      >
                        {ev.title || ev.itemName}
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-[10px] text-gray-400 px-1">+{dayEvents.length - 3} อื่นๆ</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {selectedDate && (
          <div className="mt-4 bg-white rounded-xl border shadow-sm">
            <div className="px-6 py-3 border-b flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-sm" data-testid="text-selected-date">
                งานวันที่ {parseInt(selectedDate.split("-")[2])} {MONTHS[parseInt(selectedDate.split("-")[1]) - 1]} {toBE(parseInt(selectedDate.split("-")[0]))}
              </h3>
              <button
                onClick={() => openAddForm(selectedDate)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
                style={{ borderColor: "#fb9678", color: "#fb9678" }}
                data-testid="btn-add-event-selected"
              >
                <Plus className="w-3.5 h-3.5" />
                เพิ่มกิจกรรม
              </button>
            </div>
            {selectedEvents.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-gray-400">ไม่มีงานในวันนี้</div>
            ) : (
              <div className="divide-y">
                {selectedEvents.map((ev: any, i: number) => (
                  <div key={`${ev.source}-${ev.id}-${i}`} className="px-6 py-3 flex items-center gap-3 hover:bg-gray-50" data-testid={`event-${ev.id}`}>
                    <div className="w-1 h-10 rounded-full shrink-0" style={{ backgroundColor: ev.color || ev.boardColor || "#539BFF" }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{ev.title || ev.itemName}</div>
                      <div className="text-xs text-gray-400 flex items-center gap-1">
                        {ev.source === "calendar" && !ev.allDay && (
                          <>
                            <Clock className="w-3 h-3" />
                            {new Date(ev.startDate).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}
                            {" - "}
                            {new Date(ev.endDate).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}
                            {" · "}
                          </>
                        )}
                        {ev.source === "workboard" ? `${ev.boardName} · ${ev.columnName}` :
                         ev.source === "hr_holiday" ? "วันหยุด" :
                         CATEGORIES.find(c => c.value === ev.category)?.label || ev.category}
                        {ev.creatorName && ` · ${ev.creatorName}`}
                      </div>
                      {ev.description && <div className="text-xs text-gray-500 mt-0.5 truncate">{ev.description}</div>}
                    </div>
                    {ev.source === "calendar" && ev.userId === (user as any)?.id && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => openEditForm(ev)}
                          className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-[#fb9678] transition-colors"
                          data-testid={`btn-edit-${ev.id}`}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(ev)}
                          className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-red-500 transition-colors"
                          data-testid={`btn-delete-${ev.id}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {showForm && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-4 border-b">
                <h3 className="font-bold text-gray-900" data-testid="text-form-title">
                  {editingEvent ? "แก้ไขกิจกรรม" : "เพิ่มกิจกรรมใหม่"}
                </h3>
                <button onClick={() => setShowForm(false)} className="p-1 rounded hover:bg-gray-100 text-gray-400" data-testid="btn-close-form">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="px-5 py-4 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">ชื่อกิจกรรม *</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="เช่น ประชุมลูกค้า"
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#fb9678]/30 focus:border-[#fb9678]"
                    autoFocus
                    data-testid="input-title"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">รายละเอียด</label>
                  <textarea
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="รายละเอียดเพิ่มเติม..."
                    rows={2}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#fb9678]/30 focus:border-[#fb9678] resize-none"
                    data-testid="input-description"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="allDay"
                    checked={form.allDay}
                    onChange={e => setForm(f => ({ ...f, allDay: e.target.checked }))}
                    className="rounded border-gray-300"
                    data-testid="checkbox-allday"
                  />
                  <label htmlFor="allDay" className="text-sm text-gray-700">ทั้งวัน</label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">วันเริ่มต้น</label>
                    <ThaiDateInput
                      value={form.startDate}
                      onChange={(v) => setForm(f => ({ ...f, startDate: v, endDate: v > f.endDate ? v : f.endDate }))}
                      data-testid="input-start-date"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">วันสิ้นสุด</label>
                    <ThaiDateInput
                      value={form.endDate}
                      onChange={(v) => setForm(f => ({ ...f, endDate: v }))}
                      data-testid="input-end-date"
                    />
                  </div>
                </div>

                {!form.allDay && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">เวลาเริ่ม</label>
                      <input
                        type="time"
                        value={form.startTime}
                        onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#fb9678]/30 focus:border-[#fb9678]"
                        data-testid="input-start-time"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">เวลาสิ้นสุด</label>
                      <input
                        type="time"
                        value={form.endTime}
                        onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#fb9678]/30 focus:border-[#fb9678]"
                        data-testid="input-end-time"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">ประเภท</label>
                  <select
                    value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#fb9678]/30 focus:border-[#fb9678]"
                    data-testid="select-category"
                  >
                    {CATEGORIES.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">สี</label>
                  <div className="flex items-center gap-2">
                    {COLORS.map(c => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, color: c.value }))}
                        className={`w-7 h-7 rounded-full transition-all ${
                          form.color === c.value ? "ring-2 ring-offset-2 scale-110" : "hover:scale-105"
                        }`}
                        style={{ backgroundColor: c.value, ringColor: c.value }}
                        title={c.label}
                        data-testid={`color-${c.value}`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 px-5 py-4 border-t bg-gray-50 rounded-b-xl">
                <button
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                  data-testid="btn-cancel"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!form.title.trim() || isSaving}
                  className="px-5 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
                  style={{ backgroundColor: "#fb9678" }}
                  data-testid="btn-save-event"
                >
                  {isSaving ? "กำลังบันทึก..." : editingEvent ? "บันทึก" : "เพิ่มกิจกรรม"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </EtaxCenterLayout>
  );
}
