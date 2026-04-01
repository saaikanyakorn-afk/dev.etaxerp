import HRLayout from "@/components/hr-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Clock, Plus, Pencil, Trash2, CalendarDays, Settings, MapPin, Navigation } from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useHrCompanyId } from "@/lib/company-context";
import { useLocation } from "wouter";

const DAY_OPTIONS = [
  { value: "mon", label: "จันทร์", short: "จ." },
  { value: "tue", label: "อังคาร", short: "อ." },
  { value: "wed", label: "พุธ", short: "พ." },
  { value: "thu", label: "พฤหัสบดี", short: "พฤ." },
  { value: "fri", label: "ศุกร์", short: "ศ." },
  { value: "sat", label: "เสาร์", short: "ส." },
  { value: "sun", label: "อาทิตย์", short: "อา." },
];

interface ScheduleForm {
  name: string;
  startTime: string;
  endTime: string;
  breakStartTime: string;
  breakEndTime: string;
  workDays: string[];
  lateThresholdMinutes: number;
  otCutoffDay: number;
}

const defaultForm: ScheduleForm = {
  name: "ตารางเวลาทำงานหลัก",
  startTime: "08:30",
  endTime: "17:30",
  breakStartTime: "12:00",
  breakEndTime: "13:00",
  workDays: ["mon", "tue", "wed", "thu", "fri"],
  lateThresholdMinutes: 15,
  otCutoffDay: 0,
};

export default function WorkSchedulePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const companyId = useHrCompanyId();
  const [, navigate] = useLocation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<ScheduleForm>({ ...defaultForm });

  const isAdmin = user?.role === "admin" || user?.role === "owner" || user?.role === "super_admin";

  const { data: companyData } = useQuery<any>({
    queryKey: ["/api/companies", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const r = await fetch(`/api/companies/${companyId}`, { credentials: "include" });
      if (!r.ok) return null;
      return r.json();
    },
    enabled: !!companyId,
  });

  const [gpsForm, setGpsForm] = useState({ gpsRequired: false, officeLat: "", officeLng: "", gpsRadiusMeters: 200 });
  useEffect(() => {
    if (companyData) {
      setGpsForm({
        gpsRequired: companyData.gpsRequired || false,
        officeLat: companyData.officeLat || "",
        officeLng: companyData.officeLng || "",
        gpsRadiusMeters: companyData.gpsRadiusMeters || 200,
      });
    }
  }, [companyData]);

  const gpsMutation = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch(`/api/companies/${companyId}/gps-settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.message); }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies", companyId] });
      toast({ title: "บันทึกตั้งค่า GPS สำเร็จ" });
    },
    onError: (err: any) => {
      toast({ title: "ไม่สำเร็จ", description: err.message, variant: "destructive" });
    },
  });

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: "เบราว์เซอร์ไม่รองรับ GPS", variant: "destructive" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsForm(f => ({ ...f, officeLat: pos.coords.latitude.toFixed(7), officeLng: pos.coords.longitude.toFixed(7) }));
        toast({ title: "ดึงพิกัดสำเร็จ" });
      },
      () => { toast({ title: "ไม่สามารถดึงพิกัดได้ กรุณาอนุญาตการเข้าถึง GPS", variant: "destructive" }); }
    );
  };

  const { data: workLocationsList = [] } = useQuery<any[]>({
    queryKey: ["/api/work-locations", companyId],
    queryFn: async () => {
      const r = await fetch(`/api/work-locations?companyId=${companyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!companyId,
  });

  const [locDialogOpen, setLocDialogOpen] = useState(false);
  const [editLocId, setEditLocId] = useState<number | null>(null);
  const [locForm, setLocForm] = useState({ name: "", address: "", lat: "", lng: "", radiusMeters: 200 });

  const resetLocForm = () => { setLocForm({ name: "", address: "", lat: "", lng: "", radiusMeters: 200 }); setEditLocId(null); };

  const createLocMutation = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch("/api/work-locations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data), credentials: "include" });
      if (!r.ok) { const d = await r.json(); throw new Error(d.message); }
      return r.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/work-locations", companyId] }); setLocDialogOpen(false); resetLocForm(); toast({ title: "เพิ่มสถานที่สำเร็จ" }); },
    onError: (err: any) => toast({ title: "ไม่สำเร็จ", description: err.message, variant: "destructive" }),
  });

  const updateLocMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const r = await fetch(`/api/work-locations/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data), credentials: "include" });
      if (!r.ok) { const d = await r.json(); throw new Error(d.message); }
      return r.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/work-locations", companyId] }); setLocDialogOpen(false); resetLocForm(); toast({ title: "แก้ไขสถานที่สำเร็จ" }); },
    onError: (err: any) => toast({ title: "ไม่สำเร็จ", description: err.message, variant: "destructive" }),
  });

  const deleteLocMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/work-locations/${id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) { const d = await r.json(); throw new Error(d.message); }
      return r.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/work-locations", companyId] }); toast({ title: "ลบสถานที่สำเร็จ" }); },
    onError: (err: any) => toast({ title: "ไม่สำเร็จ", description: err.message, variant: "destructive" }),
  });

  const handleLocSubmit = () => {
    const payload = { name: locForm.name, address: locForm.address, lat: locForm.lat, lng: locForm.lng, radiusMeters: locForm.radiusMeters, companyId };
    if (editLocId) updateLocMutation.mutate({ id: editLocId, data: payload });
    else createLocMutation.mutate(payload);
  };

  const openEditLoc = (loc: any) => {
    setEditLocId(loc.id);
    setLocForm({ name: loc.name, address: loc.address || "", lat: String(loc.lat), lng: String(loc.lng), radiusMeters: loc.radiusMeters || 200 });
    setLocDialogOpen(true);
  };

  const handleGetLocCurrentPosition = () => {
    if (!navigator.geolocation) { toast({ title: "เบราว์เซอร์ไม่รองรับ GPS", variant: "destructive" }); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLocForm(f => ({ ...f, lat: pos.coords.latitude.toFixed(7), lng: pos.coords.longitude.toFixed(7) })); toast({ title: "ดึงพิกัดสำเร็จ" }); },
      () => { toast({ title: "ไม่สามารถดึงพิกัดได้", variant: "destructive" }); }
    );
  };

  const { data: schedules = [] } = useQuery<any[]>({
    queryKey: ["/api/work-schedules", companyId],
    queryFn: async () => {
      const url = companyId ? `/api/work-schedules?companyId=${companyId}` : "/api/work-schedules";
      const r = await fetch(url, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch("/api/work-schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, companyId }),
        credentials: "include",
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.message); }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-schedules"] });
      toast({ title: "บันทึกตารางเวลาทำงานสำเร็จ" });
      setDialogOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast({ title: "ไม่สำเร็จ", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const r = await fetch(`/api/work-schedules/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.message); }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-schedules"] });
      toast({ title: "แก้ไขตารางเวลาทำงานสำเร็จ" });
      setDialogOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast({ title: "ไม่สำเร็จ", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/work-schedules/${id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) { const d = await r.json(); throw new Error(d.message); }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-schedules"] });
      toast({ title: "ลบตารางเวลาทำงานสำเร็จ" });
    },
  });

  const resetForm = () => {
    setForm({ ...defaultForm });
    setEditId(null);
  };

  const openEdit = (schedule: any) => {
    setEditId(schedule.id);
    setForm({
      name: schedule.name || "",
      startTime: schedule.startTime || "08:30",
      endTime: schedule.endTime || "17:30",
      breakStartTime: schedule.breakStartTime || "12:00",
      breakEndTime: schedule.breakEndTime || "13:00",
      workDays: schedule.workDays || ["mon", "tue", "wed", "thu", "fri"],
      lateThresholdMinutes: schedule.lateThresholdMinutes ?? 15,
      otCutoffDay: schedule.otCutoffDay ?? 0,
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (editId) {
      updateMutation.mutate({ id: editId, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const toggleDay = (day: string) => {
    setForm(f => ({
      ...f,
      workDays: f.workDays.includes(day) ? f.workDays.filter(d => d !== day) : [...f.workDays, day],
    }));
  };

  const getDayLabel = (day: string) => DAY_OPTIONS.find(d => d.value === day)?.short || day;

  const calcWorkHours = (start: string, end: string, bStart: string, bEnd: string) => {
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    const [bsh, bsm] = bStart.split(":").map(Number);
    const [beh, bem] = bEnd.split(":").map(Number);
    const total = (eh * 60 + em) - (sh * 60 + sm);
    const breakMins = (beh * 60 + bem) - (bsh * 60 + bsm);
    return ((total - breakMins) / 60).toFixed(1);
  };

  return (
    <HRLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-6 w-6" style={{ color: "#fb9678" }} />
            <h1 className="text-2xl font-bold" data-testid="text-page-title">ตั้งค่าเวลาทำงานและวันหยุด</h1>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="shadow-sm border-none md:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2" data-testid="text-schedule-title">
                  <Settings className="h-5 w-5" style={{ color: "#fb9678" }} />
                  ตารางเวลาทำงาน
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">กำหนดเวลาเข้า-ออกงาน พักเที่ยง และวันทำงานประจำสัปดาห์</p>
              </div>
              {isAdmin && (
                <Button onClick={() => { resetForm(); setDialogOpen(true); }} style={{ background: "#fb9678" }} className="text-white hover:opacity-90" data-testid="button-add-schedule">
                  <Plus className="mr-2 h-4 w-4" /> เพิ่มตารางเวลา
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {schedules.length > 0 ? (
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="text-xs font-bold">ชื่อตาราง</TableHead>
                      <TableHead className="text-xs font-bold text-center">เข้างาน</TableHead>
                      <TableHead className="text-xs font-bold text-center">เลิกงาน</TableHead>
                      <TableHead className="text-xs font-bold text-center">พักเที่ยง</TableHead>
                      <TableHead className="text-xs font-bold text-center">ชม.ทำงาน/วัน</TableHead>
                      <TableHead className="text-xs font-bold">วันทำงาน</TableHead>
                      <TableHead className="text-xs font-bold text-center">สายได้ (นาที)</TableHead>
                      <TableHead className="text-xs font-bold text-center">ตัดรอบ OT</TableHead>
                      <TableHead className="text-xs font-bold text-center">สถานะ</TableHead>
                      {isAdmin && <TableHead className="text-xs font-bold text-center w-20">จัดการ</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {schedules.map((s: any) => (
                      <TableRow key={s.id} data-testid={`row-schedule-${s.id}`}>
                        <TableCell className="text-sm font-medium" data-testid={`text-schedule-name-${s.id}`}>
                          {s.name}
                          {s.isDefault && <Badge variant="outline" className="ml-2 text-[10px] bg-emerald-50 text-emerald-600 border-emerald-200">ค่าเริ่มต้น</Badge>}
                        </TableCell>
                        <TableCell className="text-sm text-center font-mono" data-testid={`text-schedule-start-${s.id}`}>{s.startTime}</TableCell>
                        <TableCell className="text-sm text-center font-mono" data-testid={`text-schedule-end-${s.id}`}>{s.endTime}</TableCell>
                        <TableCell className="text-sm text-center font-mono" data-testid={`text-schedule-break-${s.id}`}>
                          {s.breakStartTime} - {s.breakEndTime}
                        </TableCell>
                        <TableCell className="text-sm text-center font-bold" style={{ color: "#03c9d7" }} data-testid={`text-schedule-hours-${s.id}`}>
                          {calcWorkHours(s.startTime, s.endTime, s.breakStartTime || "12:00", s.breakEndTime || "13:00")} ชม.
                        </TableCell>
                        <TableCell data-testid={`text-schedule-days-${s.id}`}>
                          <div className="flex gap-1 flex-wrap">
                            {DAY_OPTIONS.map(d => (
                              <span key={d.value} className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-[10px] font-bold ${
                                (s.workDays || []).includes(d.value)
                                  ? "bg-[#fb9678] text-white"
                                  : "bg-gray-100 text-gray-400"
                              }`}>
                                {d.short}
                              </span>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-center" data-testid={`text-schedule-late-${s.id}`}>{s.lateThresholdMinutes} นาที</TableCell>
                        <TableCell className="text-sm text-center" data-testid={`text-schedule-cutoff-${s.id}`}>
                          {s.otCutoffDay > 0 ? `วันที่ ${s.otCutoffDay}` : <span className="text-gray-400">ปฏิทิน</span>}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={s.active ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-gray-50 text-gray-400 border-gray-200"}>
                            {s.active ? "เปิดใช้" : "ปิด"}
                          </Badge>
                        </TableCell>
                        {isAdmin && (
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(s)} data-testid={`button-edit-schedule-${s.id}`}>
                                <Pencil className="h-3.5 w-3.5 text-blue-500" />
                              </Button>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { if (confirm("ต้องการลบตารางนี้?")) deleteMutation.mutate(s.id); }} data-testid={`button-delete-schedule-${s.id}`}>
                                <Trash2 className="h-3.5 w-3.5 text-red-500" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12 space-y-3">
                  <Clock className="h-12 w-12 mx-auto text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground" data-testid="text-no-schedule">ยังไม่ได้ตั้งค่าเวลาทำงาน</p>
                  {isAdmin && (
                    <Button onClick={() => { resetForm(); setDialogOpen(true); }} variant="outline" className="border-[#fb9678] text-[#fb9678]" data-testid="button-add-schedule-empty">
                      <Plus className="mr-2 h-4 w-4" /> เพิ่มตารางเวลาทำงาน
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm border-none cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/hr/holidays")} data-testid="card-holidays-link">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full flex items-center justify-center" style={{ background: "#fde8e8" }}>
                  <CalendarDays className="h-6 w-6" style={{ color: "#f94d4d" }} />
                </div>
                <div>
                  <h3 className="font-bold text-base">ปฏิทินวันหยุด</h3>
                  <p className="text-xs text-muted-foreground">จัดการวันหยุดนักขัตฤกษ์และวันหยุดบริษัท</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-none cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/hr/shift-settings")} data-testid="card-shift-link">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full flex items-center justify-center" style={{ background: "#e5f9fa" }}>
                  <Clock className="h-6 w-6" style={{ color: "#03c9d7" }} />
                </div>
                <div>
                  <h3 className="font-bold text-base">จัดการกะทำงาน</h3>
                  <p className="text-xs text-muted-foreground">สร้างกะเช้า/บ่าย/ดึก และจัดพนักงานลงกะ</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-none cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/hr/ot")} data-testid="card-ot-link">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full flex items-center justify-center" style={{ background: "#fff3ef" }}>
                  <Clock className="h-6 w-6" style={{ color: "#fb9678" }} />
                </div>
                <div>
                  <h3 className="font-bold text-base">ตั้งค่าสูตร OT</h3>
                  <p className="text-xs text-muted-foreground">กำหนดประเภทและอัตราค่าล่วงเวลา</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) resetForm(); }}>
          <DialogContent className="max-w-lg max-h-[90vh] flex flex-col" data-testid="dialog-schedule-form">
            <DialogHeader>
              <DialogTitle data-testid="text-dialog-title">{editId ? "แก้ไขตารางเวลาทำงาน" : "เพิ่มตารางเวลาทำงาน"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 overflow-y-auto flex-1 pr-1">
              <div>
                <label className="text-xs font-medium text-muted-foreground">ชื่อตาราง *</label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="เช่น ตารางเวลาทำงานหลัก" data-testid="input-schedule-name" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">เวลาเข้างาน *</label>
                  <Input type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} data-testid="input-schedule-start" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">เวลาเลิกงาน *</label>
                  <Input type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} data-testid="input-schedule-end" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">เริ่มพักเที่ยง</label>
                  <Input type="time" value={form.breakStartTime} onChange={e => setForm(f => ({ ...f, breakStartTime: e.target.value }))} data-testid="input-schedule-break-start" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">สิ้นสุดพักเที่ยง</label>
                  <Input type="time" value={form.breakEndTime} onChange={e => setForm(f => ({ ...f, breakEndTime: e.target.value }))} data-testid="input-schedule-break-end" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">วันทำงานในสัปดาห์ *</label>
                <div className="flex gap-2 mt-2">
                  {DAY_OPTIONS.map(d => (
                    <button
                      key={d.value}
                      type="button"
                      className={`flex items-center justify-center w-10 h-10 rounded-full text-xs font-bold transition-colors ${
                        form.workDays.includes(d.value)
                          ? "bg-[#fb9678] text-white shadow-sm"
                          : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                      }`}
                      onClick={() => toggleDay(d.value)}
                      data-testid={`toggle-day-${d.value}`}
                    >
                      {d.short}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">คลิกเพื่อเปิด/ปิดวันทำงาน</p>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">สายได้ไม่เกิน (นาที)</label>
                <Input
                  type="number"
                  min="0"
                  max="120"
                  value={form.lateThresholdMinutes}
                  onChange={e => setForm(f => ({ ...f, lateThresholdMinutes: Number(e.target.value) }))}
                  className="w-32"
                  data-testid="input-schedule-late-threshold"
                />
                <p className="text-[10px] text-muted-foreground mt-1">ถ้าเข้างานหลังเวลา + นาทีที่กำหนด จะนับว่า "สาย"</p>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">วันตัดรอบ OT</label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    max="28"
                    value={form.otCutoffDay}
                    onChange={e => setForm(f => ({ ...f, otCutoffDay: Number(e.target.value) }))}
                    className="w-32"
                    data-testid="input-schedule-ot-cutoff"
                  />
                  <span className="text-xs text-muted-foreground">ของเดือน</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {form.otCutoffDay > 0
                    ? `OT วันที่ ${form.otCutoffDay + 1} ถึง ${form.otCutoffDay} ของเดือนถัดไป จะคิดเข้าเงินเดือนเดือนถัดไป`
                    : "0 = ใช้เดือนปฏิทินปกติ (วันที่ 1 - สิ้นเดือน)"}
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-lg space-y-2">
                <p className="text-xs font-medium text-muted-foreground">สรุป</p>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">เวลาทำงาน</span>
                  <span className="font-bold">{form.startTime} - {form.endTime}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">พักเที่ยง</span>
                  <span className="font-bold">{form.breakStartTime} - {form.breakEndTime}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">ชั่วโมงทำงาน/วัน</span>
                  <span className="font-bold" style={{ color: "#03c9d7" }}>{calcWorkHours(form.startTime, form.endTime, form.breakStartTime, form.breakEndTime)} ชม.</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">วันทำงาน/สัปดาห์</span>
                  <span className="font-bold">{form.workDays.length} วัน ({form.workDays.map(d => getDayLabel(d)).join(", ")})</span>
                </div>
                <div className="flex justify-between text-xs border-t pt-2 mt-2">
                  <span className="font-medium">สายเกิน</span>
                  <span className="font-bold text-amber-600">หลัง {form.startTime} + {form.lateThresholdMinutes} นาที</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="font-medium">ตัดรอบ OT</span>
                  <span className="font-bold" style={{ color: "#03c9d7" }}>
                    {form.otCutoffDay > 0 ? `วันที่ ${form.otCutoffDay} ของเดือน` : "ตามเดือนปฏิทิน"}
                  </span>
                </div>
              </div>

            </div>
            <div className="flex justify-end gap-2 pt-3 border-t flex-shrink-0">
              <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }} data-testid="button-cancel-schedule">ยกเลิก</Button>
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending || !form.name || !form.startTime || !form.endTime || form.workDays.length === 0}
                style={{ background: "#fb9678" }}
                className="text-white hover:opacity-90"
                data-testid="button-save-schedule"
              >
                {(createMutation.isPending || updateMutation.isPending) ? "กำลังบันทึก..." : "บันทึก"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {isAdmin && (
          <Card className="shadow-sm border-none" data-testid="card-work-locations">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MapPin className="h-5 w-5" style={{ color: "#05b187" }} />
                    สถานที่ลงเวลา (สาขา)
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">กำหนดสถานที่ลงเวลาหลายจุด สำหรับสำนักงานหลายสาขา</p>
                </div>
                <Button size="sm" onClick={() => { resetLocForm(); setLocDialogOpen(true); }} style={{ background: "#05b187" }} className="text-white hover:opacity-90" data-testid="button-add-location">
                  <Plus className="h-4 w-4 mr-1" /> เพิ่มสถานที่
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {workLocationsList.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MapPin className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">ยังไม่มีสถานที่ลงเวลา</p>
                  <p className="text-xs">เพิ่มสถานที่เพื่อรองรับการลงเวลาหลายสาขา</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs font-bold">ชื่อสถานที่</TableHead>
                      <TableHead className="text-xs font-bold">ที่อยู่</TableHead>
                      <TableHead className="text-xs font-bold text-center">พิกัด</TableHead>
                      <TableHead className="text-xs font-bold text-center">รัศมี (ม.)</TableHead>
                      <TableHead className="text-xs font-bold text-center">สถานะ</TableHead>
                      <TableHead className="text-xs font-bold text-center w-20">จัดการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {workLocationsList.map((loc: any) => (
                      <TableRow key={loc.id} data-testid={`row-location-${loc.id}`}>
                        <TableCell className="text-sm font-medium">{loc.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{loc.address || "-"}</TableCell>
                        <TableCell className="text-xs text-center font-mono">{Number(loc.lat).toFixed(4)}, {Number(loc.lng).toFixed(4)}</TableCell>
                        <TableCell className="text-sm text-center">{loc.radiusMeters}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={loc.active ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-gray-50 text-gray-400 border-gray-200"}>
                            {loc.active ? "เปิดใช้" : "ปิด"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEditLoc(loc)} data-testid={`button-edit-location-${loc.id}`}>
                              <Pencil className="h-3.5 w-3.5 text-blue-500" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { if (confirm("ต้องการลบสถานที่นี้?")) deleteLocMutation.mutate(loc.id); }} data-testid={`button-delete-location-${loc.id}`}>
                              <Trash2 className="h-3.5 w-3.5 text-red-400" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        <Dialog open={locDialogOpen} onOpenChange={(v) => { setLocDialogOpen(v); if (!v) resetLocForm(); }}>
          <DialogContent className="max-w-md" data-testid="dialog-location-form">
            <DialogHeader>
              <DialogTitle>{editLocId ? "แก้ไขสถานที่ลงเวลา" : "เพิ่มสถานที่ลงเวลา"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">ชื่อสถานที่ *</label>
                <Input value={locForm.name} onChange={e => setLocForm(f => ({ ...f, name: e.target.value }))} placeholder="เช่น สำนักงานใหญ่, สาขารังสิต" data-testid="input-location-name" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">ที่อยู่</label>
                <Input value={locForm.address} onChange={e => setLocForm(f => ({ ...f, address: e.target.value }))} placeholder="ที่อยู่สาขา (ไม่บังคับ)" data-testid="input-location-address" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">ละติจูด *</label>
                  <Input type="number" step="any" value={locForm.lat} onChange={e => setLocForm(f => ({ ...f, lat: e.target.value }))} placeholder="13.7563309" data-testid="input-location-lat" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">ลองจิจูด *</label>
                  <Input type="number" step="any" value={locForm.lng} onChange={e => setLocForm(f => ({ ...f, lng: e.target.value }))} placeholder="100.5017651" data-testid="input-location-lng" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">รัศมีอนุญาต (เมตร)</label>
                <Input type="number" min="50" max="5000" value={locForm.radiusMeters} onChange={e => setLocForm(f => ({ ...f, radiusMeters: Number(e.target.value) }))} data-testid="input-location-radius" />
              </div>
              <Button variant="outline" size="sm" onClick={handleGetLocCurrentPosition} className="w-full" data-testid="button-get-loc-position">
                <Navigation className="mr-2 h-4 w-4" /> ใช้ตำแหน่งปัจจุบัน
              </Button>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" onClick={() => { setLocDialogOpen(false); resetLocForm(); }}>ยกเลิก</Button>
              <Button
                onClick={handleLocSubmit}
                disabled={!locForm.name || !locForm.lat || !locForm.lng || createLocMutation.isPending || updateLocMutation.isPending}
                style={{ background: "#05b187" }}
                className="text-white hover:opacity-90"
                data-testid="button-save-location"
              >
                {(createLocMutation.isPending || updateLocMutation.isPending) ? "กำลังบันทึก..." : "บันทึก"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {isAdmin && (
          <Card className="shadow-sm border-none">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2" data-testid="text-gps-title">
                <MapPin className="h-5 w-5" style={{ color: "#03c9d7" }} />
                ตั้งค่า GPS ลงเวลา
              </CardTitle>
              <p className="text-xs text-muted-foreground">กำหนดให้พนักงานต้องอยู่ในรัศมีสำนักงานถึงจะลงเวลาได้</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border">
                <div>
                  <p className="text-sm font-medium">บังคับตรวจสอบ GPS</p>
                  <p className="text-xs text-muted-foreground">เปิดใช้งานจะบังคับให้พนักงานต้องอยู่ในรัศมีที่กำหนดถึงจะลงเวลาเข้า-ออกงานได้</p>
                </div>
                <Switch
                  checked={gpsForm.gpsRequired}
                  onCheckedChange={(v) => setGpsForm(f => ({ ...f, gpsRequired: v }))}
                  data-testid="switch-gps-required"
                />
              </div>

              {gpsForm.gpsRequired && (
                <div className="space-y-4 p-4 border rounded-lg">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">ละติจูด (Latitude)</label>
                      <Input
                        type="number"
                        step="any"
                        placeholder="13.7563309"
                        value={gpsForm.officeLat}
                        onChange={e => setGpsForm(f => ({ ...f, officeLat: e.target.value }))}
                        data-testid="input-office-lat"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">ลองจิจูด (Longitude)</label>
                      <Input
                        type="number"
                        step="any"
                        placeholder="100.5017651"
                        value={gpsForm.officeLng}
                        onChange={e => setGpsForm(f => ({ ...f, officeLng: e.target.value }))}
                        data-testid="input-office-lng"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">รัศมีอนุญาต (เมตร)</label>
                      <Input
                        type="number"
                        min="50"
                        max="5000"
                        value={gpsForm.gpsRadiusMeters}
                        onChange={e => setGpsForm(f => ({ ...f, gpsRadiusMeters: Number(e.target.value) }))}
                        data-testid="input-gps-radius"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleGetCurrentLocation} data-testid="button-get-location">
                      <Navigation className="mr-2 h-4 w-4" /> ใช้ตำแหน่งปัจจุบัน
                    </Button>
                    <p className="text-[10px] text-muted-foreground">กดเพื่อดึงพิกัด GPS ปัจจุบันของคุณมาเป็นพิกัดสำนักงาน</p>
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <Button
                  onClick={() => gpsMutation.mutate({
                    gpsRequired: gpsForm.gpsRequired,
                    officeLat: gpsForm.officeLat ? String(gpsForm.officeLat) : null,
                    officeLng: gpsForm.officeLng ? String(gpsForm.officeLng) : null,
                    gpsRadiusMeters: gpsForm.gpsRadiusMeters,
                  })}
                  disabled={gpsMutation.isPending}
                  style={{ background: "#03c9d7" }}
                  className="text-white hover:opacity-90"
                  data-testid="button-save-gps"
                >
                  {gpsMutation.isPending ? "กำลังบันทึก..." : "บันทึกตั้งค่า GPS"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </HRLayout>
  );
}
