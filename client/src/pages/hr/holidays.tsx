import HRLayout from "@/components/hr-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarDays, Plus, Trash2, Pencil, ChevronLeft, ChevronRight } from "lucide-react";
import ThaiDateInput from "@/components/thai-date-input";
import { useDateSettings } from "@/hooks/use-date-settings";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useHrCompanyId } from "@/lib/company-context";
import { formatDate } from "@/lib/format";
import { toLocalDateStr } from "@/lib/utils";

const MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

const WEEKDAYS = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];

const HOLIDAY_TYPES = [
  { value: "national", label: "วันหยุดราชการ", color: "#f94d4d" },
  { value: "company", label: "วันหยุดบริษัท", color: "#fb9678" },
  { value: "special", label: "วันหยุดพิเศษ", color: "var(--theme-primary)" },
  { value: "religious", label: "วันสำคัญทางศาสนา", color: "#05b187" },
];

const THAI_NATIONAL_HOLIDAYS = [
  { name: "วันขึ้นปีใหม่", date: "01-01", type: "national" },
  { name: "วันมาฆบูชา", date: "02-26", type: "religious" },
  { name: "วันจักรี", date: "04-06", type: "national" },
  { name: "วันสงกรานต์", date: "04-13", type: "national" },
  { name: "วันสงกรานต์", date: "04-14", type: "national" },
  { name: "วันสงกรานต์", date: "04-15", type: "national" },
  { name: "วันแรงงานแห่งชาติ", date: "05-01", type: "national" },
  { name: "วันฉัตรมงคล", date: "05-04", type: "national" },
  { name: "วันวิสาขบูชา", date: "05-22", type: "religious" },
  { name: "วันเฉลิมพระชนมพรรษา สมเด็จพระนางเจ้าฯ", date: "06-03", type: "national" },
  { name: "วันอาสาฬหบูชา", date: "07-20", type: "religious" },
  { name: "วันเข้าพรรษา", date: "07-21", type: "religious" },
  { name: "วันเฉลิมพระชนมพรรษา ร.10", date: "07-28", type: "national" },
  { name: "วันแม่แห่งชาติ", date: "08-12", type: "national" },
  { name: "วันคล้ายวันสวรรคต ร.9", date: "10-13", type: "national" },
  { name: "วันปิยมหาราช", date: "10-23", type: "national" },
  { name: "วันพ่อแห่งชาติ", date: "12-05", type: "national" },
  { name: "วันรัฐธรรมนูญ", date: "12-10", type: "national" },
  { name: "วันสิ้นปี", date: "12-31", type: "national" },
];

interface HolidayForm {
  name: string;
  date: string;
  holidayType: string;
  description: string;
  year: string;
}

const emptyForm: HolidayForm = {
  name: "",
  date: "",
  holidayType: "national",
  description: "",
  year: String(new Date().getFullYear()),
};

function getTypeInfo(type: string) {
  return HOLIDAY_TYPES.find(t => t.value === type) || HOLIDAY_TYPES[0];
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

export default function HolidaysPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const selectedCompanyId = useHrCompanyId();
  const { dateEra, dateFmt } = useDateSettings();
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<HolidayForm>(emptyForm);
  const isAdmin = user?.role === "admin" || user?.role === "manager";

  const { data: holidays = [] } = useQuery<any[]>({
    queryKey: ["/api/holidays", selectedYear, selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/holidays?year=${selectedYear}&companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!user && !!selectedCompanyId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch("/api/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, companyId: selectedCompanyId }),
        credentials: "include",
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.message); }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/holidays"] });
      setDialogOpen(false);
      toast({ title: "เพิ่มวันหยุดสำเร็จ" });
    },
    onError: (e: any) => toast({ title: "เกิดข้อผิดพลาด", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const r = await fetch(`/api/holidays/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.message); }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/holidays"] });
      setDialogOpen(false);
      toast({ title: "แก้ไขวันหยุดสำเร็จ" });
    },
    onError: (e: any) => toast({ title: "เกิดข้อผิดพลาด", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/holidays/${id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) { const d = await r.json(); throw new Error(d.message); }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/holidays"] });
      toast({ title: "ลบวันหยุดสำเร็จ" });
    },
    onError: (e: any) => toast({ title: "เกิดข้อผิดพลาด", description: e.message, variant: "destructive" }),
  });

  const holidaysByDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    holidays.forEach((h: any) => {
      const key = h.date;
      if (!map[key]) map[key] = [];
      map[key].push(h);
    });
    return map;
  }, [holidays]);

  const calendarDays = useMemo(() => {
    const daysInMonth = getDaysInMonth(selectedYear, calMonth);
    const firstDay = getFirstDayOfMonth(selectedYear, calMonth);
    const days: { day: number; inMonth: boolean; dateStr: string; holidays: any[] }[] = [];

    for (let i = 0; i < firstDay; i++) {
      days.push({ day: 0, inMonth: false, dateStr: "", holidays: [] });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${selectedYear}-${String(calMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      days.push({
        day: d,
        inMonth: true,
        dateStr,
        holidays: holidaysByDate[dateStr] || [],
      });
    }

    return days;
  }, [selectedYear, calMonth, holidaysByDate]);

  function openAdd() {
    setEditId(null);
    setForm({ ...emptyForm, year: String(selectedYear) });
    setDialogOpen(true);
  }

  function openEdit(h: any) {
    setEditId(h.id);
    setForm({
      name: h.name,
      date: h.date,
      holidayType: h.holidayType,
      description: h.description || "",
      year: String(h.year),
    });
    setDialogOpen(true);
  }

  function handleSave() {
    const data = {
      name: form.name,
      date: form.date,
      holidayType: form.holidayType,
      description: form.description || null,
      year: Number(form.year),
    };
    if (editId) {
      updateMutation.mutate({ id: editId, data });
    } else {
      createMutation.mutate(data);
    }
  }

  function handleBulkImport() {
    const existing = new Set(holidays.map((h: any) => h.date));
    let count = 0;
    THAI_NATIONAL_HOLIDAYS.forEach(h => {
      const fullDate = `${selectedYear}-${h.date}`;
      if (!existing.has(fullDate)) {
        createMutation.mutate({
          name: h.name,
          date: fullDate,
          holidayType: h.type,
          description: "",
          year: selectedYear,
        });
        count++;
      }
    });
    if (count === 0) {
      toast({ title: "วันหยุดราชการทั้งหมดถูกเพิ่มแล้ว" });
    }
  }

  const isToday = (dateStr: string) => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    return dateStr === todayStr;
  };

  const upcomingHolidays = useMemo(() => {
    const today = toLocalDateStr(new Date());
    return holidays
      .filter((h: any) => h.date >= today)
      .sort((a: any, b: any) => a.date.localeCompare(b.date))
      .slice(0, 5);
  }, [holidays]);

  return (
    <HRLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <CalendarDays className="w-6 h-6" style={{ color: "#fb9678" }} />
            <h1 className="text-xl font-bold" data-testid="page-title-holidays">ปฏิทินวันหยุดประจำปี {selectedYear + 543}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(Number(v))} data-testid="select-year-holidays">
              <SelectTrigger className="w-32" data-testid="trigger-year-holidays">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => (
                  <SelectItem key={y} value={String(y)}>{y + 543}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isAdmin && (
              <>
                <Button
                  onClick={handleBulkImport}
                  variant="outline"
                  style={{ borderColor: "#05b187", color: "#05b187" }}
                  data-testid="btn-import-holidays"
                >
                  นำเข้าวันหยุดราชการ
                </Button>
                <Button
                  onClick={openAdd}
                  className="text-white"
                  style={{ backgroundColor: "#fb9678" }}
                  data-testid="btn-add-holiday"
                >
                  <Plus className="w-4 h-4 mr-1" /> เพิ่มวันหยุด
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card className="flexy-card">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Button variant="ghost" size="sm" onClick={() => { if (calMonth === 0) { setCalMonth(11); setSelectedYear(selectedYear - 1); } else setCalMonth(calMonth - 1); }} data-testid="btn-prev-month">
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <CardTitle className="text-base" data-testid="text-current-month">
                    {MONTHS[calMonth]} {selectedYear + 543}
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => { if (calMonth === 11) { setCalMonth(0); setSelectedYear(selectedYear + 1); } else setCalMonth(calMonth + 1); }} data-testid="btn-next-month">
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-px bg-gray-200 border border-gray-200 rounded-lg overflow-hidden">
                  {WEEKDAYS.map((wd, i) => (
                    <div key={wd} className={`text-center text-xs font-medium py-2 ${i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-gray-600"} bg-gray-50`}>
                      {wd}
                    </div>
                  ))}
                  {calendarDays.map((cell, idx) => {
                    const dayOfWeek = idx % 7;
                    const isSunday = dayOfWeek === 0;
                    const isSaturday = dayOfWeek === 6;
                    const hasHoliday = cell.holidays.length > 0;

                    return (
                      <div
                        key={idx}
                        className={`min-h-[72px] p-1 bg-white relative ${!cell.inMonth ? "bg-gray-50" : ""} ${isToday(cell.dateStr) ? "ring-2 ring-inset ring-[#fb9678]" : ""}`}
                        data-testid={cell.inMonth ? `calendar-day-${cell.day}` : undefined}
                      >
                        {cell.inMonth && (
                          <>
                            <span className={`text-xs font-medium ${hasHoliday || isSunday ? "text-red-500" : isSaturday ? "text-blue-500" : "text-gray-700"} ${isToday(cell.dateStr) ? "font-bold" : ""}`}>
                              {cell.day}
                            </span>
                            {cell.holidays.map((h: any, hi: number) => (
                              <div
                                key={hi}
                                className="text-[10px] leading-tight mt-0.5 px-1 py-0.5 rounded truncate text-white"
                                style={{ backgroundColor: getTypeInfo(h.holidayType).color }}
                                title={h.name}
                                data-testid={`holiday-badge-${h.id}`}
                              >
                                {h.name}
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-wrap gap-4 mt-4">
                  {HOLIDAY_TYPES.map(t => (
                    <div key={t.value} className="flex items-center gap-1.5 text-xs">
                      <div className="w-3 h-3 rounded" style={{ backgroundColor: t.color }} />
                      <span>{t.label}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            {upcomingHolidays.length > 0 && (
              <Card className="flexy-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">วันหยุดที่กำลังจะมาถึง</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {upcomingHolidays.map((h: any) => {
                      const typeInfo = getTypeInfo(h.holidayType);
                      const dateObj = new Date(h.date + "T00:00:00");
                      const daysUntil = Math.ceil((dateObj.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                      return (
                        <div key={h.id} className="flex items-start gap-3 p-2 rounded-lg bg-gray-50" data-testid={`upcoming-holiday-${h.id}`}>
                          <div className="text-center min-w-[44px]">
                            <div className="text-lg font-bold" style={{ color: typeInfo.color }}>{dateObj.getDate()}</div>
                            <div className="text-[10px] text-gray-500">{MONTHS[dateObj.getMonth()]?.slice(0, 3)}</div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{h.name}</p>
                            <Badge variant="outline" className="text-[10px] mt-0.5" style={{ borderColor: typeInfo.color, color: typeInfo.color }}>
                              {typeInfo.label}
                            </Badge>
                          </div>
                          {daysUntil >= 0 && (
                            <span className="text-xs text-gray-400 whitespace-nowrap">
                              {daysUntil === 0 ? "วันนี้" : `อีก ${daysUntil} วัน`}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="flexy-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">สรุปวันหยุดปี {selectedYear + 543}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {HOLIDAY_TYPES.map(t => {
                    const count = holidays.filter((h: any) => h.holidayType === t.value).length;
                    return (
                      <div key={t.value} className="flex justify-between items-center text-sm" data-testid={`summary-${t.value}`}>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }} />
                          <span>{t.label}</span>
                        </div>
                        <span className="font-medium">{count} วัน</span>
                      </div>
                    );
                  })}
                  <div className="border-t pt-2 mt-2 flex justify-between text-sm font-bold" data-testid="summary-total">
                    <span>รวมทั้งหมด</span>
                    <span>{holidays.length} วัน</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card className="flexy-card">
          <CardHeader>
            <CardTitle className="text-base">รายการวันหยุดทั้งหมด ปี {selectedYear + 543}</CardTitle>
          </CardHeader>
          <CardContent>
            {holidays.length === 0 ? (
              <div className="text-center py-8 text-gray-400" data-testid="empty-holidays">
                <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>ยังไม่มีวันหยุดในปีนี้</p>
                {isAdmin && <p className="text-xs mt-1">กดปุ่ม "นำเข้าวันหยุดราชการ" เพื่อเพิ่มวันหยุดราชการไทย</p>}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>วันที่</TableHead>
                    <TableHead>ชื่อวันหยุด</TableHead>
                    <TableHead>ประเภท</TableHead>
                    <TableHead>หมายเหตุ</TableHead>
                    {isAdmin && <TableHead className="w-24 text-center">จัดการ</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {holidays
                    .sort((a: any, b: any) => a.date.localeCompare(b.date))
                    .map((h: any, idx: number) => {
                      const typeInfo = getTypeInfo(h.holidayType);
                      return (
                        <TableRow key={h.id} data-testid={`row-holiday-${h.id}`}>
                          <TableCell className="text-gray-400">{idx + 1}</TableCell>
                          <TableCell className="font-medium">{formatDate(h.date, dateEra, dateFmt)}</TableCell>
                          <TableCell>{h.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline" style={{ borderColor: typeInfo.color, color: typeInfo.color }}>
                              {typeInfo.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-gray-500 text-xs">{h.description || "-"}</TableCell>
                          {isAdmin && (
                            <TableCell className="text-center">
                              <div className="flex justify-center gap-1">
                                <Button variant="ghost" size="sm" onClick={() => openEdit(h)} data-testid={`btn-edit-holiday-${h.id}`}>
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-500 hover:text-red-700"
                                  onClick={() => { if (confirm("ต้องการลบวันหยุดนี้?")) deleteMutation.mutate(h.id); }}
                                  data-testid={`btn-delete-holiday-${h.id}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md" data-testid="dialog-holiday-form">
            <DialogHeader>
              <DialogTitle>{editId ? "แก้ไขวันหยุด" : "เพิ่มวันหยุด"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">ชื่อวันหยุด *</label>
                <Input
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="เช่น วันขึ้นปีใหม่"
                  data-testid="input-holiday-name"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">วันที่ *</label>
                <ThaiDateInput value={form.date} onChange={(v: string) => setForm({ ...form, date: v, year: v ? String(new Date(v).getFullYear()) : form.year })} dateEra={dateEra} dateFmt={dateFmt} data-testid="input-holiday-date" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">ประเภท</label>
                <Select value={form.holidayType} onValueChange={v => setForm({ ...form, holidayType: v })} data-testid="select-holiday-type">
                  <SelectTrigger data-testid="trigger-holiday-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HOLIDAY_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">หมายเหตุ</label>
                <Input
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="รายละเอียดเพิ่มเติม (ไม่บังคับ)"
                  data-testid="input-holiday-description"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)} data-testid="btn-cancel-holiday">
                  ยกเลิก
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={!form.name || !form.date}
                  className="text-white"
                  style={{ backgroundColor: "#fb9678" }}
                  data-testid="btn-save-holiday"
                >
                  {editId ? "บันทึก" : "เพิ่มวันหยุด"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </HRLayout>
  );
}
