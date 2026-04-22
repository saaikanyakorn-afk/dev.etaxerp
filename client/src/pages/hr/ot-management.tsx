import HRLayout from "@/components/hr-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, Plus, CheckCircle, XCircle, DollarSign, Timer, AlertCircle, Settings, Trash2, CalendarDays, ChevronDown, ChevronRight, Zap, Filter, Pencil } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import ThaiDateInput from "@/components/thai-date-input";
import { useDateSettings } from "@/hooks/use-date-settings";
import { useState, useMemo, useEffect, Fragment } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useHrCompanyId } from "@/lib/company-context";

interface OTBreakdownItem {
  otType: string;
  label: string;
  hours: number;
  rate: number;
}

interface OTCalcResult {
  date: string;
  isDayOff: boolean;
  isHoliday: boolean;
  holidayName: string | null;
  workStart: string;
  workEnd: string;
  breakdown: OTBreakdownItem[];
}

function calcHours(start: string, end: string): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const diff = (eh * 60 + em) - (sh * 60 + sm);
  return diff > 0 ? +(diff / 60).toFixed(2) : 0;
}

export default function OTManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const companyId = useHrCompanyId();
  const { dateEra, dateFmt } = useDateSettings();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [cutoffDialogOpen, setCutoffDialogOpen] = useState(false);
  const [cutoffDay, setCutoffDay] = useState(0);
  const [form, setForm] = useState({ date: "", otType: "regular", startTime: "", endTime: "" });
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [expandedOtRows, setExpandedOtRows] = useState<Set<number>>(new Set());
  const [calcResult, setCalcResult] = useState<OTCalcResult | null>(null);
  const [calcLoading, setCalcLoading] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<"all" | "manual" | "auto">("all");
  const now = new Date();
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [editDialog, setEditDialog] = useState<{ open: boolean; ot: any | null }>({ open: false, ot: null });
  const [editForm, setEditForm] = useState({ hours: "", status: "" });
  const [adminSelectedEmployeeId, setAdminSelectedEmployeeId] = useState<number | null>(null);

  const isAdmin = user?.role === "admin" || user?.role === "owner" || user?.role === "super_admin" || user?.role === "manager";

  const { data: employees = [] } = useQuery<any[]>({
    queryKey: ["/api/employees", companyId, "active"],
    queryFn: async () => {
      const r = await fetch(`/api/employees?status=active&companyId=${companyId}`, { credentials: "include" });
      if (!r.ok) return [];
      const data = await r.json();
      return Array.isArray(data) ? data : (data.data || []);
    },
    enabled: !!user && !!companyId,
  });

  const myEmployee = employees.find((e: any) => e.userId === user?.id);

  const { data: otSettingsData = [] } = useQuery<any[]>({
    queryKey: ["/api/ot-settings", companyId],
    queryFn: async () => {
      const url = companyId ? `/api/ot-settings?companyId=${companyId}` : "/api/ot-settings";
      const r = await fetch(url, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!user,
  });

  const { data: workSchedulesList = [] } = useQuery<any[]>({
    queryKey: ["/api/work-schedules", companyId],
    queryFn: async () => {
      const r = await fetch(`/api/work-schedules?companyId=${companyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!companyId,
  });

  const defaultSchedule = workSchedulesList.find((ws: any) => ws.isDefault) || workSchedulesList[0];
  const currentCutoffDay = defaultSchedule?.otCutoffDay || 0;

  useEffect(() => {
    if (defaultSchedule) setCutoffDay(defaultSchedule.otCutoffDay || 0);
  }, [defaultSchedule?.id, defaultSchedule?.otCutoffDay]);

  const cutoffMutation = useMutation({
    mutationFn: async (day: number) => {
      if (!defaultSchedule) throw new Error("ไม่พบตารางเวลาทำงาน");
      const r = await fetch(`/api/work-schedules/${defaultSchedule.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...defaultSchedule, otCutoffDay: day }),
        credentials: "include",
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.message); }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-schedules", companyId] });
      setCutoffDialogOpen(false);
      toast({ title: "บันทึกวันตัดรอบ OT สำเร็จ" });
    },
    onError: (err: any) => toast({ title: "ไม่สำเร็จ", description: err.message, variant: "destructive" }),
  });

  const activeSettings = otSettingsData.filter((s: any) => s.active);

  const getRateForType = (otType: string) => {
    const setting = activeSettings.find((s: any) => s.otType === otType);
    return setting ? Number(setting.rate) : (otType === "holiday" ? 3 : otType === "holiday_regular" ? 1 : 1.5);
  };

  const getLabelForType = (otType: string) => {
    const setting = otSettingsData.find((s: any) => s.otType === otType);
    return setting?.label || (otType === "holiday" ? "วันหยุด (ล่วงเวลา)" : otType === "holiday_regular" ? "วันหยุด (ในเวลาปกติ)" : otType === "special_holiday" ? "วันหยุดนักขัตฤกษ์" : "วันปกติ");
  };

  const { data: allOt = [] } = useQuery<any[]>({
    queryKey: ["/api/ot", companyId],
    queryFn: async () => {
      const r = await fetch(`/api/ot?companyId=${companyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!user && isAdmin && !!companyId,
  });

  const { data: myOt = [] } = useQuery<any[]>({
    queryKey: ["/api/ot", myEmployee?.id],
    queryFn: async () => {
      const r = await fetch(`/api/ot/${myEmployee!.id}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!myEmployee && !isAdmin,
  });

  const otRecordsRaw = isAdmin ? allOt : myOt;
  const otRecordsSource = sourceFilter === "all" ? otRecordsRaw : otRecordsRaw.filter((r: any) => (r.source || "manual") === sourceFilter);

  const cutoff = currentCutoffDay;
  const otPeriod = useMemo(() => {
    const m = filterMonth;
    const y = filterYear;
    if (cutoff > 0) {
      const pm = m === 1 ? 12 : m - 1;
      const py = m === 1 ? y - 1 : y;
      return {
        start: `${py}-${String(pm).padStart(2, "0")}-${String(cutoff + 1).padStart(2, "0")}`,
        end: `${y}-${String(m).padStart(2, "0")}-${String(cutoff).padStart(2, "0")}`,
        label: `${cutoff + 1}/${pm} - ${cutoff}/${m}`,
      };
    }
    const lastDay = new Date(y, m, 0).getDate();
    return {
      start: `${y}-${String(m).padStart(2, "0")}-01`,
      end: `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
      label: `1/${m} - ${lastDay}/${m}`,
    };
  }, [filterMonth, filterYear, cutoff]);

  const otRecords = useMemo(() => {
    return otRecordsSource.filter((r: any) => {
      const d = r.date?.slice(0, 10);
      return d >= otPeriod.start && d <= otPeriod.end;
    });
  }, [otRecordsSource, otPeriod]);

  const hours = calcHours(form.startTime, form.endTime);
  const rate = getRateForType(form.otType);
  const selectedEmp = isAdmin && adminSelectedEmployeeId
    ? employees.find((e: any) => e.id === adminSelectedEmployeeId)
    : myEmployee;
  const baseSalary = Number(selectedEmp?.baseSalary || 0);
  const hourlyRate = baseSalary / 30 / 8;
  const amount = +(hourlyRate * hours * rate).toFixed(2);

  const totalBreakdownAmount = calcResult?.breakdown.reduce((s, b) => s + +(hourlyRate * b.hours * b.rate).toFixed(2), 0) || 0;

  useEffect(() => {
    if (!form.date || !form.startTime || !form.endTime || hours <= 0) {
      setCalcResult(null);
      return;
    }
    let cancelled = false;
    setCalcLoading(true);
    fetch("/api/ot/calculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: form.date, startTime: form.startTime, endTime: form.endTime, companyId }),
      credentials: "include",
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (!cancelled) { setCalcResult(data); setCalcLoading(false); } })
      .catch(() => { if (!cancelled) { setCalcResult(null); setCalcLoading(false); } });
    return () => { cancelled = true; };
  }, [form.date, form.startTime, form.endTime, companyId, hours]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch("/api/ot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.message); }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ot"] });
      toast({ title: isAdmin ? "เพิ่ม OT สำเร็จ" : "ส่งคำขอ OT สำเร็จ" });
      setDialogOpen(false);
      setForm({ date: "", otType: "regular", startTime: "", endTime: "" });
      setAdminSelectedEmployeeId(null);
    },
    onError: (err: any) => {
      toast({ title: "ไม่สำเร็จ", description: err.message, variant: "destructive" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/ot/${id}/approve`, { method: "PATCH", credentials: "include" });
      if (!r.ok) { const d = await r.json(); throw new Error(d.message); }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ot"] });
      queryClient.refetchQueries({ queryKey: ["/api/ot"] });
      toast({ title: "อนุมัติ OT สำเร็จ" });
    },
    onError: (err: any) => {
      toast({ title: "อนุมัติไม่สำเร็จ", description: err.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/ot/${id}/reject`, { method: "PATCH", credentials: "include" });
      if (!r.ok) { const d = await r.json(); throw new Error(d.message); }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ot"] });
      queryClient.refetchQueries({ queryKey: ["/api/ot"] });
      toast({ title: "ปฏิเสธ OT สำเร็จ" });
    },
    onError: (err: any) => {
      toast({ title: "ปฏิเสธไม่สำเร็จ", description: err.message, variant: "destructive" });
    },
  });

  const batchMutation = useMutation({
    mutationFn: async ({ ids, status }: { ids: number[]; status: string }) => {
      const r = await fetch("/api/ot/batch", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, status }),
        credentials: "include",
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.message); }
      return r.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ot"] });
      queryClient.refetchQueries({ queryKey: ["/api/ot"] });
      setSelectedIds(new Set());
      const label = variables.status === "approved" ? "อนุมัติ" : "ปฏิเสธ";
      toast({ title: `${label} ${data.updated} รายการสำเร็จ` });
      if (data.skipped?.length > 0) {
        toast({ title: `ข้ามรายการซ้ำ ${data.skipped.length} รายการ`, description: data.skipped.join(", "), variant: "destructive" });
      }
    },
    onError: (err: any) => {
      toast({ title: "ดำเนินการไม่สำเร็จ", description: err.message, variant: "destructive" });
    },
  });

  const updateOtMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const r = await fetch(`/api/ot/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.message); }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ot"] });
      setEditDialog({ open: false, ot: null });
      toast({ title: "แก้ไข OT สำเร็จ" });
    },
    onError: (err: any) => toast({ title: "แก้ไขไม่สำเร็จ", description: err.message, variant: "destructive" }),
  });

  const deleteOtMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/ot/${id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) { const d = await r.json(); throw new Error(d.message); }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ot"] });
      toast({ title: "ลบรายการ OT สำเร็จ" });
    },
    onError: (err: any) => toast({ title: "ลบไม่สำเร็จ", description: err.message, variant: "destructive" }),
  });

  const openEditDialog = (ot: any) => {
    setEditForm({ hours: String(Number(ot.hours)), status: ot.status });
    setEditDialog({ open: true, ot });
  };

  const pendingRecords = otRecords.filter((r: any) => r.status === "pending");
  const processedRecords = otRecords.filter((r: any) => r.status !== "pending");
  const [showProcessed, setShowProcessed] = useState(false);
  const allPendingSelected = pendingRecords.length > 0 && pendingRecords.every((r: any) => selectedIds.has(r.id));

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allPendingSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingRecords.map((r: any) => r.id)));
    }
  };

  const handleSubmit = async () => {
    const targetEmpId = isAdmin ? adminSelectedEmployeeId : myEmployee?.id;
    const targetEmp = employees.find((e: any) => e.id === targetEmpId);
    if (!targetEmpId || !targetEmp) {
      toast({ title: isAdmin ? "กรุณาเลือกพนักงาน" : "ไม่พบข้อมูลพนักงานของคุณ กรุณาติดต่อผู้ดูแลระบบ", variant: "destructive" });
      return;
    }
    const targetHourlyRate = Number(targetEmp.baseSalary || 0) / 30 / 8;
    const startTime = new Date(`${form.date}T${form.startTime}:00`);
    const endTime = new Date(`${form.date}T${form.endTime}:00`);

    if (calcResult && calcResult.isDayOff && calcResult.breakdown.length > 0) {
      let currentStart = new Date(startTime);
      for (const b of calcResult.breakdown) {
        const bEndMs = currentStart.getTime() + b.hours * 60 * 60 * 1000;
        const bEnd = new Date(bEndMs);
        const bAmount = +(targetHourlyRate * b.hours * b.rate).toFixed(2);
        await createMutation.mutateAsync({
          employeeId: targetEmpId,
          date: form.date,
          otType: b.otType,
          startTime: currentStart.toISOString(),
          endTime: bEnd.toISOString(),
          hours: String(b.hours),
          rate: String(b.rate),
          amount: String(bAmount),
          status: isAdmin ? "approved" : "pending",
        });
        currentStart = bEnd;
      }
      queryClient.invalidateQueries({ queryKey: ["/api/ot"] });
      toast({ title: `${isAdmin ? "เพิ่ม" : "ส่งคำขอ"} OT ${calcResult.breakdown.length} รายการสำเร็จ` });
      setDialogOpen(false);
      setForm({ date: "", otType: "regular", startTime: "", endTime: "" });
      setCalcResult(null);
      setAdminSelectedEmployeeId(null);
    } else {
      const submitAmount = isAdmin ? +(targetHourlyRate * hours * rate).toFixed(2) : amount;
      createMutation.mutate({
        employeeId: targetEmpId,
        date: form.date,
        otType: form.otType,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        hours: String(hours),
        rate: String(rate),
        amount: String(submitAmount),
        status: isAdmin ? "approved" : "pending",
      });
    }
  };

  const empMap = useMemo(() => {
    const map: Record<number, string> = {};
    employees.forEach((e: any) => { map[e.id] = e.fullName; });
    const allRecords = isAdmin ? allOt : myOt;
    allRecords.forEach((r: any) => {
      if (r.employeeName && !map[r.employeeId]) {
        map[r.employeeId] = r.employeeName;
      }
    });
    return map;
  }, [employees, allOt, myOt, isAdmin]);

  const approvedRecords = otRecords.filter((r: any) => r.status === "approved");
  const noAttRecords = approvedRecords.filter((r: any) => r.hasAttendance === false);
  const countedRecords = approvedRecords.filter((r: any) => r.hasAttendance !== false);

  const totalHours = otRecords.reduce((s: number, r: any) => s + Number(r.hours || 0), 0);
  const totalAmount = otRecords.reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
  const countedHours = countedRecords.reduce((s: number, r: any) => s + Number(r.hours || 0), 0);
  const countedAmount = countedRecords.reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
  const skippedHours = noAttRecords.reduce((s: number, r: any) => s + Number(r.hours || 0), 0);
  const skippedAmount = noAttRecords.reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
  const pendingCount = otRecordsRaw.filter((r: any) => r.status === "pending").length;

  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  const hoursByEmployee = useMemo(() => {
    const map: Record<number, { name: string; hours: number; amount: number; count: number; skippedHours: number; skippedAmount: number; skippedCount: number }> = {};
    otRecords.forEach((r: any) => {
      const eid = r.employeeId;
      if (!map[eid]) map[eid] = { name: empMap[eid] || `#${eid}`, hours: 0, amount: 0, count: 0, skippedHours: 0, skippedAmount: 0, skippedCount: 0 };
      map[eid].hours += Number(r.hours || 0);
      map[eid].amount += Number(r.amount || 0);
      map[eid].count += 1;
      if (r.status === "approved" && r.hasAttendance === false) {
        map[eid].skippedHours += Number(r.hours || 0);
        map[eid].skippedAmount += Number(r.amount || 0);
        map[eid].skippedCount += 1;
      }
    });
    return Object.values(map).sort((a, b) => b.hours - a.hours);
  }, [otRecords, empMap]);

  const hoursByType = useMemo(() => {
    const map: Record<string, { label: string; hours: number; amount: number; count: number; rate: number }> = {};
    otRecords.forEach((r: any) => {
      const t = r.otType || "regular";
      if (!map[t]) map[t] = { label: getLabelForType(t), hours: 0, amount: 0, count: 0, rate: Number(r.rate || 1) };
      map[t].hours += Number(r.hours || 0);
      map[t].amount += Number(r.amount || 0);
      map[t].count += 1;
    });
    return Object.values(map).sort((a, b) => b.amount - a.amount);
  }, [otRecords]);

  return (
    <HRLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-6 w-6" style={{ color: "#fb9678" }} />
            <h1 className="text-2xl font-bold" data-testid="text-page-title">จัดการทำงานล่วงเวลา (OT)</h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {isAdmin && (
              <Button variant="outline" onClick={() => setCutoffDialogOpen(true)} className="border-[#03c9d7] text-[#03c9d7] hover:bg-cyan-50" data-testid="button-ot-cutoff">
                <CalendarDays className="mr-2 h-4 w-4" />
                ตัดรอบ OT {currentCutoffDay > 0 ? `วันที่ ${currentCutoffDay}` : "(ปฏิทิน)"}
              </Button>
            )}
            {isAdmin && (
              <Button variant="outline" onClick={() => setSettingsOpen(true)} className="border-[#fb9678] text-[#fb9678] hover:bg-[#fff3ef]" data-testid="button-ot-settings">
                <Settings className="mr-2 h-4 w-4" /> ตั้งค่าสูตร OT
              </Button>
            )}
            {isAdmin && (
              <Button onClick={() => { setAdminSelectedEmployeeId(null); setDialogOpen(true); }} style={{ background: "#05b187" }} className="text-white hover:opacity-90" data-testid="button-admin-add-ot">
                <Plus className="mr-2 h-4 w-4" /> เพิ่ม OT ให้พนักงาน
              </Button>
            )}
            {!isAdmin && (
              <Button onClick={() => setDialogOpen(true)} style={{ background: "#fb9678" }} className="text-white hover:opacity-90" disabled={!myEmployee} data-testid="button-request-ot">
                <Plus className="mr-2 h-4 w-4" /> ขอทำ OT
              </Button>
            )}
          </div>
        </div>

        {!isAdmin && !myEmployee && (
          <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm" data-testid="warning-no-employee">
            ยังไม่มีข้อมูลพนักงานของคุณในระบบ กรุณาติดต่อผู้ดูแลระบบเพื่อเพิ่มข้อมูลพนักงาน
          </div>
        )}

        <div className="flex items-center gap-3 flex-wrap" data-testid="filter-month-year">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">รอบเดือน:</span>
          </div>
          <Select value={String(filterMonth)} onValueChange={(v) => setFilterMonth(Number(v))}>
            <SelectTrigger className="w-[130px] h-9" data-testid="select-filter-month">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"].map((name, i) => (
                <SelectItem key={i + 1} value={String(i + 1)}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(filterYear)} onValueChange={(v) => setFilterYear(Number(v))}>
            <SelectTrigger className="w-[90px] h-9" data-testid="select-filter-year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[filterYear - 1, filterYear, filterYear + 1].map((y) => (
                <SelectItem key={y} value={String(y)}>{y + 543}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-md text-xs text-muted-foreground">
            <span>ช่วง: {otPeriod.label}</span>
            {cutoff > 0 && <span className="text-[10px]">(ตัดรอบวันที่ {cutoff})</span>}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-none shadow-sm" data-testid="card-total-hours">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium" data-testid="label-total-ot-hours">OT ที่นับจริง (ชม.)</p>
                  <p className="text-3xl font-bold" style={{ color: "#03c9d7" }} data-testid="text-total-ot-hours">{countedHours.toFixed(1)}</p>
                  {skippedHours > 0 && (
                    <p className="text-[11px] text-red-500 mt-0.5" data-testid="text-skipped-hours">ไม่นับ (ไม่ลงเวลา): {skippedHours.toFixed(1)} ชม.</p>
                  )}
                  {(totalHours - countedHours - skippedHours) > 0.01 && (
                    <p className="text-[11px] text-amber-500 mt-0.5">รอ/ปฏิเสธ: {(totalHours - countedHours - skippedHours).toFixed(1)} ชม.</p>
                  )}
                </div>
                <div className="h-12 w-12 rounded-full flex items-center justify-center" style={{ background: "#e5f9fa" }}>
                  <Timer className="h-6 w-6" style={{ color: "#03c9d7" }} />
                </div>
              </div>
              <Button variant="ghost" size="sm" className="mt-2 h-auto py-1 px-2 text-[11px] text-[#03c9d7] hover:text-[#03c9d7] hover:bg-[#e5f9fa]" onClick={() => setExpandedCard(expandedCard === "hours" ? null : "hours")} data-testid="button-toggle-hours-detail">
                {expandedCard === "hours" ? <ChevronDown className="h-3 w-3 mr-1" /> : <ChevronRight className="h-3 w-3 mr-1" />}
                {expandedCard === "hours" ? "ซ่อนรายละเอียด" : "ดูรายละเอียด"}
              </Button>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm" data-testid="card-total-amount">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium" data-testid="label-total-ot-amount">ค่า OT ที่นับจริง</p>
                  <p className="text-3xl font-bold" style={{ color: "#fb9678" }} data-testid="text-total-ot-amount">฿{countedAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</p>
                  {skippedAmount > 0 && (
                    <p className="text-[11px] text-red-500 mt-0.5" data-testid="text-skipped-amount">ไม่นับ (ไม่ลงเวลา): ฿{skippedAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</p>
                  )}
                  {(totalAmount - countedAmount - skippedAmount) > 0.01 && (
                    <p className="text-[11px] text-amber-500 mt-0.5">รอ/ปฏิเสธ: ฿{(totalAmount - countedAmount - skippedAmount).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</p>
                  )}
                </div>
                <div className="h-12 w-12 rounded-full flex items-center justify-center" style={{ background: "#fff3ef" }}>
                  <DollarSign className="h-6 w-6" style={{ color: "#fb9678" }} />
                </div>
              </div>
              <Button variant="ghost" size="sm" className="mt-2 h-auto py-1 px-2 text-[11px] text-[#fb9678] hover:text-[#fb9678] hover:bg-[#fff3ef]" onClick={() => setExpandedCard(expandedCard === "amount" ? null : "amount")} data-testid="button-toggle-amount-detail">
                {expandedCard === "amount" ? <ChevronDown className="h-3 w-3 mr-1" /> : <ChevronRight className="h-3 w-3 mr-1" />}
                {expandedCard === "amount" ? "ซ่อนรายละเอียด" : "ดูรายละเอียด"}
              </Button>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium" data-testid="label-pending-ot">รออนุมัติ</p>
                  <p className="text-3xl font-bold text-amber-500" data-testid="text-pending-ot-count">{pendingCount}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-amber-50 flex items-center justify-center">
                  <AlertCircle className="h-6 w-6 text-amber-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {expandedCard === "hours" && (
          <Card className="shadow-sm border-[#03c9d7]/20" data-testid="card-hours-breakdown">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold" style={{ color: "#03c9d7" }}>รายละเอียด OT สะสม — แยกตามพนักงาน</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {hoursByEmployee.map((emp, idx) => (
                  <div key={idx} className="py-2 px-3 rounded-lg bg-slate-50 text-sm" data-testid={`breakdown-emp-${idx}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-6">{idx + 1}.</span>
                        <span className="font-medium">{emp.name}</span>
                        <span className="text-xs text-muted-foreground">({emp.count} รายการ)</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-bold" style={{ color: "#03c9d7" }}>{emp.hours.toFixed(1)} ชม.</span>
                        <span className="text-xs text-muted-foreground">฿{emp.amount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                    {emp.skippedCount > 0 && (
                      <div className="flex items-center justify-between mt-1 pl-9">
                        <span className="text-[11px] text-red-500">ไม่นับ (ไม่ลงเวลา {emp.skippedCount} รายการ)</span>
                        <div className="flex items-center gap-4">
                          <span className="text-[11px] text-red-500 font-medium">-{emp.skippedHours.toFixed(1)} ชม.</span>
                          <span className="text-[11px] text-red-500">-฿{emp.skippedAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {hoursByEmployee.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">ยังไม่มีข้อมูล OT</p>}
                <div className="flex justify-between pt-3 border-t mt-2 text-sm font-bold">
                  <span>รวมทั้งหมด ({otRecords.length} รายการ)</span>
                  <span style={{ color: "#03c9d7" }}>{totalHours.toFixed(1)} ชม.</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {expandedCard === "amount" && (
          <Card className="shadow-sm border-[#fb9678]/20" data-testid="card-amount-breakdown">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold" style={{ color: "#fb9678" }}>รายละเอียดค่า OT — แยกตามประเภท</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {hoursByType.map((t, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-50 text-sm" data-testid={`breakdown-type-${idx}`}>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="text-xs">{t.rate}x</Badge>
                      <span className="font-medium">{t.label}</span>
                      <span className="text-xs text-muted-foreground">({t.count} รายการ, {t.hours.toFixed(1)} ชม.)</span>
                    </div>
                    <span className="font-bold" style={{ color: "#fb9678" }}>฿{t.amount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span>
                  </div>
                ))}
                {hoursByType.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">ยังไม่มีข้อมูล OT</p>}
                <div className="flex justify-between pt-3 border-t mt-2 text-sm font-bold">
                  <span>รวมทั้งหมด ({otRecords.length} รายการ, {totalHours.toFixed(1)} ชม.)</span>
                  <span style={{ color: "#fb9678" }}>฿{totalAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              {isAdmin && hoursByEmployee.length > 1 && (
                <div className="mt-4 pt-3 border-t">
                  <p className="text-xs font-bold text-muted-foreground mb-2">แยกตามพนักงาน</p>
                  <div className="space-y-1.5">
                    {hoursByEmployee.map((emp, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs py-1 px-2" data-testid={`amount-by-emp-${idx}`}>
                        <span>{emp.name}</span>
                        <span className="font-medium" style={{ color: "#fb9678" }}>฿{emp.amount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CardTitle className="text-lg" data-testid="text-ot-table-title">รายการ OT</CardTitle>
                <div className="flex items-center gap-1 ml-2">
                  <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                  <Select value={sourceFilter} onValueChange={(v: any) => setSourceFilter(v)}>
                    <SelectTrigger className="h-7 w-[130px] text-xs" data-testid="select-source-filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">ทั้งหมด</SelectItem>
                      <SelectItem value="manual">ขอเอง (Manual)</SelectItem>
                      <SelectItem value="auto">อัตโนมัติ (Auto)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {isAdmin && selectedIds.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">เลือก {selectedIds.size} รายการ</span>
                  <Button size="sm" onClick={() => batchMutation.mutate({ ids: Array.from(selectedIds), status: "approved" })} disabled={batchMutation.isPending} className="bg-emerald-500 hover:bg-emerald-600 text-white h-8" data-testid="button-batch-approve">
                    <CheckCircle className="h-3.5 w-3.5 mr-1" /> อนุมัติทั้งหมด
                  </Button>
                  <Button size="sm" onClick={() => batchMutation.mutate({ ids: Array.from(selectedIds), status: "rejected" })} disabled={batchMutation.isPending} variant="outline" className="border-red-300 text-red-600 hover:bg-red-50 h-8" data-testid="button-batch-reject">
                    <XCircle className="h-3.5 w-3.5 mr-1" /> ปฏิเสธทั้งหมด
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="w-8 px-2"></TableHead>
                  {isAdmin && <TableHead className="w-10 text-center"><input type="checkbox" checked={allPendingSelected} onChange={toggleSelectAll} disabled={pendingRecords.length === 0} data-testid="checkbox-select-all-ot" className="w-4 h-4 accent-[#fb9678] cursor-pointer" /></TableHead>}
                  {isAdmin && <TableHead className="text-xs font-bold">พนักงาน</TableHead>}
                  <TableHead className="text-xs font-bold">วันที่</TableHead>
                  <TableHead className="text-xs font-bold">ประเภท</TableHead>
                  <TableHead className="text-xs font-bold text-center">เวลา</TableHead>
                  <TableHead className="text-xs font-bold text-right">จำนวนชม.</TableHead>
                  <TableHead className="text-xs font-bold text-right">อัตรา</TableHead>
                  <TableHead className="text-xs font-bold text-right">จำนวนเงิน</TableHead>
                  <TableHead className="text-xs font-bold text-center">สถานะ</TableHead>
                  {isAdmin && <TableHead className="text-xs font-bold text-center">จัดการ</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {otRecords.length > 0 ? (
                  <>
                    {pendingRecords.map((ot: any) => {
                      const isExpanded = expandedOtRows.has(ot.id);
                      const toggleExpand = () => {
                        setExpandedOtRows(prev => {
                          const next = new Set(prev);
                          if (next.has(ot.id)) next.delete(ot.id);
                          else next.add(ot.id);
                          return next;
                        });
                      };
                      const startT = ot.startTime ? new Date(ot.startTime) : null;
                      const endT = ot.endTime ? new Date(ot.endTime) : null;
                      const fmtTime = (d: Date | null) => d ? `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` : "-";
                      const totalCols = (isAdmin ? 10 : 8) + 1;
                      return (
                        <Fragment key={ot.id}>
                          <TableRow data-testid={`row-ot-${ot.id}`} className={`cursor-pointer ${selectedIds.has(ot.id) ? "bg-blue-50" : isExpanded ? "bg-slate-50" : ""}`} onClick={toggleExpand}>
                            <TableCell className="w-8 px-2">
                              {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                            </TableCell>
                            {isAdmin && <TableCell className="text-center" onClick={e => e.stopPropagation()}><input type="checkbox" checked={selectedIds.has(ot.id)} onChange={() => toggleSelect(ot.id)} data-testid={`checkbox-ot-${ot.id}`} className="w-4 h-4 accent-[#fb9678] cursor-pointer" /></TableCell>}
                            {isAdmin && <TableCell className="text-xs font-medium" data-testid={`text-ot-emp-${ot.id}`}>{empMap[ot.employeeId] || `#${ot.employeeId}`}</TableCell>}
                            <TableCell className="text-xs" data-testid={`text-ot-date-${ot.id}`}>{ot.date}</TableCell>
                            <TableCell className="text-xs" data-testid={`text-ot-type-${ot.id}`}>
                              <span className="flex items-center gap-1">
                                {getLabelForType(ot.otType)}
                                {(ot.source === "auto") && <Badge variant="outline" className="bg-violet-50 text-violet-600 border-violet-200 text-[10px] px-1.5 py-0" data-testid={`badge-ot-auto-${ot.id}`}><Zap className="h-2.5 w-2.5 mr-0.5" />Auto</Badge>}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs text-center font-mono" data-testid={`text-ot-time-${ot.id}`}>{fmtTime(startT)} - {fmtTime(endT)}</TableCell>
                            <TableCell className="text-xs text-right font-medium" data-testid={`text-ot-hours-${ot.id}`}>{Number(ot.hours).toFixed(1)}</TableCell>
                            <TableCell className="text-xs text-right" data-testid={`text-ot-rate-${ot.id}`}>{Number(ot.rate)}x</TableCell>
                            <TableCell className="text-xs text-right font-medium" style={{ color: "#fb9678" }} data-testid={`text-ot-amount-${ot.id}`}>
                              ฿{Number(ot.amount).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell className="text-center" data-testid={`badge-ot-status-${ot.id}`}>
                              <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200">รออนุมัติ</Badge>
                            </TableCell>
                            {isAdmin && (
                              <TableCell className="text-center" onClick={e => e.stopPropagation()}>
                                <div className="flex items-center justify-center gap-1">
                                  <Button size="sm" variant="ghost" className="text-emerald-600 hover:bg-emerald-50 h-7 px-2" onClick={() => approveMutation.mutate(ot.id)} data-testid={`button-approve-ot-${ot.id}`}>
                                    <CheckCircle className="h-3.5 w-3.5 mr-1" /> อนุมัติ
                                  </Button>
                                  <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50 h-7 px-2" onClick={() => rejectMutation.mutate(ot.id)} data-testid={`button-reject-ot-${ot.id}`}>
                                    <XCircle className="h-3.5 w-3.5 mr-1" /> ปฏิเสธ
                                  </Button>
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                          {isExpanded && (
                            <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                              <TableCell colSpan={totalCols} className="py-3 px-6">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                                  <div><span className="text-muted-foreground">เวลาเริ่ม:</span><span className="ml-2 font-medium" data-testid={`text-ot-start-${ot.id}`}>{fmtTime(startT)}</span></div>
                                  <div><span className="text-muted-foreground">เวลาสิ้นสุด:</span><span className="ml-2 font-medium" data-testid={`text-ot-end-${ot.id}`}>{fmtTime(endT)}</span></div>
                                  <div><span className="text-muted-foreground">ชั่วโมงรวม:</span><span className="ml-2 font-medium" data-testid={`text-ot-total-${ot.id}`}>{Number(ot.hours).toFixed(2)} ชม.</span></div>
                                  <div>
                                    <span className="text-muted-foreground">แหล่งที่มา:</span>
                                    <span className="ml-2 font-medium" data-testid={`text-ot-source-${ot.id}`}>{ot.source === "auto" ? "ระบบสร้างอัตโนมัติ" : "พนักงานขอเอง"}</span>
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      );
                    })}

                    {processedRecords.length > 0 && !showProcessed && (
                      <TableRow>
                        <TableCell colSpan={isAdmin ? 11 : 9} className="text-center py-3">
                          <button
                            onClick={() => setShowProcessed(true)}
                            className="text-sm text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                            data-testid="button-show-processed"
                          >
                            แสดงเพิ่มเติม ({processedRecords.length} รายการที่ดำเนินการแล้ว)
                          </button>
                        </TableCell>
                      </TableRow>
                    )}

                    {showProcessed && processedRecords.map((ot: any) => {
                      const isExpanded = expandedOtRows.has(ot.id);
                      const toggleExpand = () => {
                        setExpandedOtRows(prev => {
                          const next = new Set(prev);
                          if (next.has(ot.id)) next.delete(ot.id);
                          else next.add(ot.id);
                          return next;
                        });
                      };
                      const startT = ot.startTime ? new Date(ot.startTime) : null;
                      const endT = ot.endTime ? new Date(ot.endTime) : null;
                      const fmtTime = (d: Date | null) => d ? `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` : "-";
                      const totalCols = (isAdmin ? 10 : 8) + 1;
                      return (
                        <Fragment key={ot.id}>
                          <TableRow data-testid={`row-ot-${ot.id}`} className={`cursor-pointer ${ot.status === "approved" && ot.hasAttendance === false ? "bg-red-50/40" : isExpanded ? "bg-slate-50" : ""}`} onClick={toggleExpand}>
                            <TableCell className="w-8 px-2">
                              {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                            </TableCell>
                            {isAdmin && <TableCell className="text-center"></TableCell>}
                            {isAdmin && <TableCell className="text-xs font-medium" data-testid={`text-ot-emp-${ot.id}`}>{empMap[ot.employeeId] || `#${ot.employeeId}`}</TableCell>}
                            <TableCell className="text-xs" data-testid={`text-ot-date-${ot.id}`}>{ot.date}</TableCell>
                            <TableCell className="text-xs" data-testid={`text-ot-type-${ot.id}`}>
                              <span className="flex items-center gap-1">
                                {getLabelForType(ot.otType)}
                                {(ot.source === "auto") && <Badge variant="outline" className="bg-violet-50 text-violet-600 border-violet-200 text-[10px] px-1.5 py-0" data-testid={`badge-ot-auto-${ot.id}`}><Zap className="h-2.5 w-2.5 mr-0.5" />Auto</Badge>}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs text-center font-mono" data-testid={`text-ot-time-${ot.id}`}>{fmtTime(startT)} - {fmtTime(endT)}</TableCell>
                            <TableCell className={`text-xs text-right font-medium ${ot.status === "approved" && ot.hasAttendance === false ? "text-red-400 line-through" : ""}`} data-testid={`text-ot-hours-${ot.id}`}>{Number(ot.hours).toFixed(1)}</TableCell>
                            <TableCell className="text-xs text-right" data-testid={`text-ot-rate-${ot.id}`}>{Number(ot.rate)}x</TableCell>
                            <TableCell className={`text-xs text-right font-medium ${ot.status === "approved" && ot.hasAttendance === false ? "text-red-400 line-through" : ""}`} style={ot.status === "approved" && ot.hasAttendance === false ? {} : { color: "#fb9678" }} data-testid={`text-ot-amount-${ot.id}`}>
                              ฿{Number(ot.amount).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell className="text-center" data-testid={`badge-ot-status-${ot.id}`}>
                              <div className="flex flex-col items-center gap-0.5">
                                <Badge variant="outline" className={
                                  ot.status === "approved" ? "bg-emerald-50 text-emerald-600 border-emerald-200" :
                                  ot.status === "cancelled" ? "bg-gray-50 text-gray-500 border-gray-200" :
                                  "bg-red-50 text-red-600 border-red-200"
                                }>
                                  {ot.status === "approved" ? "อนุมัติ" : ot.status === "cancelled" ? "ยกเลิกแล้ว" : "ไม่อนุมัติ"}
                                </Badge>
                                {ot.status === "approved" && ot.hasAttendance === false && (
                                  <span className="text-[10px] text-red-500 font-medium">ไม่ลงเวลา</span>
                                )}
                              </div>
                            </TableCell>
                            {isAdmin && (
                              <TableCell className="text-center" onClick={e => e.stopPropagation()}>
                                <div className="flex items-center justify-center gap-1">
                                  <Button size="sm" variant="ghost" className="text-blue-600 hover:bg-blue-50 h-7 px-2" onClick={() => openEditDialog(ot)} data-testid={`button-edit-ot-${ot.id}`}>
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50 h-7 px-2" onClick={() => { if (confirm("ต้องการลบรายการ OT นี้?")) deleteOtMutation.mutate(ot.id); }} data-testid={`button-delete-ot-${ot.id}`}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                          {isExpanded && (
                            <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                              <TableCell colSpan={totalCols} className="py-3 px-6">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                                  <div><span className="text-muted-foreground">เวลาเริ่ม:</span><span className="ml-2 font-medium" data-testid={`text-ot-start-${ot.id}`}>{fmtTime(startT)}</span></div>
                                  <div><span className="text-muted-foreground">เวลาสิ้นสุด:</span><span className="ml-2 font-medium" data-testid={`text-ot-end-${ot.id}`}>{fmtTime(endT)}</span></div>
                                  <div><span className="text-muted-foreground">ชั่วโมงรวม:</span><span className="ml-2 font-medium" data-testid={`text-ot-total-${ot.id}`}>{Number(ot.hours).toFixed(2)} ชม.</span></div>
                                  <div>
                                    <span className="text-muted-foreground">แหล่งที่มา:</span>
                                    <span className="ml-2 font-medium" data-testid={`text-ot-source-${ot.id}`}>{ot.source === "auto" ? "ระบบสร้างอัตโนมัติ" : "พนักงานขอเอง"}</span>
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      );
                    })}

                    {showProcessed && processedRecords.length > 0 && (
                      <TableRow>
                        <TableCell colSpan={isAdmin ? 11 : 9} className="text-center py-3">
                          <button
                            onClick={() => setShowProcessed(false)}
                            className="text-sm text-gray-500 hover:text-gray-700 hover:underline cursor-pointer"
                            data-testid="button-hide-processed"
                          >
                            ซ่อนรายการที่ดำเนินการแล้ว
                          </button>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ) : (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 11 : 9} className="text-center py-8 text-muted-foreground text-xs" data-testid="text-no-ot">
                      ยังไม่มีรายการ OT
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) setAdminSelectedEmployeeId(null); }}>
          <DialogContent className="max-w-md" data-testid="dialog-ot-form">
            <DialogHeader>
              <DialogTitle data-testid="text-dialog-title">{isAdmin ? "เพิ่ม OT ให้พนักงาน" : "ขอทำงานล่วงเวลา (OT)"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {isAdmin && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground">พนักงาน *</label>
                  <Select value={adminSelectedEmployeeId ? String(adminSelectedEmployeeId) : ""} onValueChange={v => setAdminSelectedEmployeeId(Number(v))}>
                    <SelectTrigger data-testid="select-ot-employee">
                      <SelectValue placeholder="เลือกพนักงาน" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((e: any) => (
                        <SelectItem key={e.id} value={String(e.id)} data-testid={`option-emp-${e.id}`}>
                          {e.fullName} ({e.employeeCode})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-muted-foreground">วันที่ *</label>
                <ThaiDateInput value={form.date} onChange={(v: string) => setForm(f => ({ ...f, date: v }))} dateEra={dateEra} dateFmt={dateFmt} data-testid="input-ot-date" />
              </div>
              {calcResult && calcResult.isDayOff ? (
                <div className="p-2 bg-cyan-50 border border-cyan-200 rounded text-xs text-cyan-700" data-testid="text-auto-type">
                  ระบบจะแบ่งประเภท OT อัตโนมัติตามเวลาทำการ ({calcResult.workStart} - {calcResult.workEnd})
                </div>
              ) : (
                <div>
                  <label className="text-xs font-medium text-muted-foreground">ประเภท OT *</label>
                  <Select value={form.otType} onValueChange={v => setForm(f => ({ ...f, otType: v }))}>
                    <SelectTrigger data-testid="select-ot-type">
                      <SelectValue placeholder="เลือกประเภท" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeSettings.length > 0 ? activeSettings.map((s: any) => (
                        <SelectItem key={s.otType} value={s.otType} data-testid={`option-ot-${s.otType}`}>
                          {s.label} ({Number(s.rate)} เท่า)
                        </SelectItem>
                      )) : (
                        <>
                          <SelectItem value="regular" data-testid="option-ot-regular">วันปกติ (1.5 เท่า)</SelectItem>
                          <SelectItem value="holiday_regular" data-testid="option-ot-holiday-regular">วันหยุด ในเวลาปกติ (1 เท่า)</SelectItem>
                          <SelectItem value="holiday" data-testid="option-ot-holiday">วันหยุด ล่วงเวลา (3 เท่า)</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">เวลาเริ่ม *</label>
                  <Input type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} data-testid="input-ot-start-time" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">เวลาสิ้นสุด *</label>
                  <Input type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} data-testid="input-ot-end-time" />
                </div>
              </div>
              {calcLoading ? (
                <div className="p-4 bg-slate-50 rounded-lg text-center text-xs text-muted-foreground">กำลังคำนวณ...</div>
              ) : calcResult && calcResult.isDayOff && calcResult.breakdown.length > 0 ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-3" data-testid="div-ot-breakdown">
                  <div className="flex items-center gap-2 text-xs font-medium text-amber-700">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {calcResult.isHoliday ? `วันหยุดนักขัตฤกษ์: ${calcResult.holidayName}` : "วันหยุด (เสาร์-อาทิตย์)"}
                    <span className="ml-auto text-muted-foreground">เวลาปกติ {calcResult.workStart} - {calcResult.workEnd}</span>
                  </div>
                  {calcResult.breakdown.map((b, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs bg-white rounded p-2 border" data-testid={`row-breakdown-${idx}`}>
                      <div>
                        <span className="font-medium">{b.label}</span>
                        <span className="text-muted-foreground ml-2">({b.hours.toFixed(1)} ชม. × {b.rate} เท่า)</span>
                      </div>
                      <span className="font-bold" style={{ color: b.rate >= 3 ? "#f94d4d" : "#fb9678" }}>
                        ฿{(hourlyRate * b.hours * b.rate).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm border-t border-amber-200 pt-2 mt-1">
                    <span className="font-medium">ค่า OT รวม ({calcResult.breakdown.length} รายการ)</span>
                    <span className="font-bold text-lg" style={{ color: "#fb9678" }} data-testid="text-calc-amount">
                      ฿{totalBreakdownAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-slate-50 rounded-lg space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">จำนวนชั่วโมง</span>
                    <span className="font-bold" data-testid="text-calc-hours">{hours.toFixed(1)} ชม.</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">อัตราค่าจ้าง</span>
                    <span className="font-bold" data-testid="text-calc-rate">{rate}x</span>
                  </div>
                  <div className="flex justify-between text-sm border-t pt-2 mt-2">
                    <span className="font-medium">ค่า OT โดยประมาณ</span>
                    <span className="font-bold text-lg" style={{ color: "#fb9678" }} data-testid="text-calc-amount">฿{amount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)} data-testid="button-cancel-ot">ยกเลิก</Button>
                <Button
                  onClick={handleSubmit}
                  disabled={createMutation.isPending || !form.date || !form.startTime || !form.endTime || hours <= 0 || (isAdmin && !adminSelectedEmployeeId)}
                  style={{ background: isAdmin ? "#05b187" : "#fb9678" }}
                  className="text-white hover:opacity-90"
                  data-testid="button-submit-ot"
                >
                  {createMutation.isPending ? "กำลังบันทึก..." : isAdmin ? "เพิ่ม OT (อนุมัติทันที)" : "ส่งคำขอ OT"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <OTSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} companyId={companyId} />

        <Dialog open={editDialog.open} onOpenChange={(v) => setEditDialog({ open: v, ot: v ? editDialog.ot : null })}>
          <DialogContent className="max-w-sm" data-testid="dialog-edit-ot">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="h-5 w-5 text-blue-600" />
                แก้ไขรายการ OT
              </DialogTitle>
            </DialogHeader>
            {editDialog.ot && (
              <div className="space-y-4">
                <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-1">
                  <div><span className="text-muted-foreground">พนักงาน:</span> <span className="font-medium">{empMap[editDialog.ot.employeeId] || `#${editDialog.ot.employeeId}`}</span></div>
                  <div><span className="text-muted-foreground">วันที่:</span> <span className="font-medium">{editDialog.ot.date}</span></div>
                  <div><span className="text-muted-foreground">ประเภท:</span> <span className="font-medium">{getLabelForType(editDialog.ot.otType)}</span></div>
                  <div><span className="text-muted-foreground">อัตรา:</span> <span className="font-medium">{Number(editDialog.ot.rate)}x</span></div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">จำนวนชั่วโมง OT</label>
                  <Input
                    type="number"
                    step="0.5"
                    min="0"
                    value={editForm.hours}
                    onChange={e => setEditForm(f => ({ ...f, hours: e.target.value }))}
                    data-testid="input-edit-ot-hours"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">สถานะ</label>
                  <Select value={editForm.status} onValueChange={v => setEditForm(f => ({ ...f, status: v }))}>
                    <SelectTrigger data-testid="select-edit-ot-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">รออนุมัติ</SelectItem>
                      <SelectItem value="approved">อนุมัติ</SelectItem>
                      <SelectItem value="rejected">ไม่อนุมัติ</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setEditDialog({ open: false, ot: null })} data-testid="button-cancel-edit-ot">ยกเลิก</Button>
                  <Button
                    onClick={() => updateOtMutation.mutate({ id: editDialog.ot.id, data: { hours: Number(editForm.hours), status: editForm.status } })}
                    disabled={updateOtMutation.isPending}
                    style={{ background: "#fb9678" }}
                    className="text-white hover:opacity-90"
                    data-testid="button-save-edit-ot"
                  >
                    {updateOtMutation.isPending ? "กำลังบันทึก..." : "บันทึก"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={cutoffDialogOpen} onOpenChange={setCutoffDialogOpen}>
          <DialogContent className="max-w-sm" data-testid="dialog-ot-cutoff">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5" style={{ color: "#03c9d7" }} />
                ตั้งค่าวันตัดรอบ OT
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">วันตัดรอบ OT</label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    type="number"
                    min="0"
                    max="28"
                    value={cutoffDay}
                    onChange={e => setCutoffDay(Number(e.target.value))}
                    className="w-24"
                    data-testid="input-cutoff-day"
                  />
                  <span className="text-sm text-muted-foreground">ของเดือน</span>
                </div>
              </div>
              <div className="p-3 bg-cyan-50 border border-cyan-200 rounded-lg text-xs text-cyan-700 space-y-1">
                {cutoffDay > 0 ? (
                  <>
                    <p>OT วันที่ 1 - {cutoffDay} จะคิดเข้าเงินเดือน <b>เดือนนั้น</b></p>
                    <p>OT วันที่ {cutoffDay + 1} - สิ้นเดือน จะคิดเข้าเงินเดือน <b>เดือนถัดไป</b></p>
                  </>
                ) : (
                  <p>0 = ใช้เดือนปฏิทินปกติ (วันที่ 1 - สิ้นเดือน)</p>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setCutoffDialogOpen(false)}>ยกเลิก</Button>
                <Button
                  onClick={() => cutoffMutation.mutate(cutoffDay)}
                  disabled={cutoffMutation.isPending}
                  style={{ background: "#03c9d7" }}
                  className="text-white hover:opacity-90"
                  data-testid="button-save-cutoff"
                >
                  {cutoffMutation.isPending ? "กำลังบันทึก..." : "บันทึก"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </HRLayout>
  );
}

function OTSettingsDialog({ open, onOpenChange, companyId }: { open: boolean; onOpenChange: (v: boolean) => void; companyId: number | null }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [items, setItems] = useState<any[]>([]);
  const [newType, setNewType] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newRate, setNewRate] = useState("");
  const [autoOtEnabled, setAutoOtEnabled] = useState(false);
  const [minOtMinutes, setMinOtMinutes] = useState(30);
  const [otRoundingMinutes, setOtRoundingMinutes] = useState(30);

  const { data: autoOtConfigData } = useQuery<any>({
    queryKey: ["/api/auto-ot-config", companyId],
    queryFn: async () => {
      const r = await fetch(`/api/auto-ot-config?companyId=${companyId}`, { credentials: "include" });
      if (!r.ok) return null;
      return r.json();
    },
    enabled: open && !!companyId,
  });

  useEffect(() => {
    if (autoOtConfigData) {
      setAutoOtEnabled(autoOtConfigData.autoOtEnabled || false);
      setMinOtMinutes(autoOtConfigData.minOtMinutes || 30);
      setOtRoundingMinutes(autoOtConfigData.otRoundingMinutes || 30);
    }
  }, [autoOtConfigData]);

  const autoOtMutation = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch("/api/auto-ot-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.message); }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auto-ot-config", companyId] });
      toast({ title: "บันทึกตั้งค่า Auto OT สำเร็จ" });
    },
    onError: (err: any) => {
      toast({ title: "ไม่สำเร็จ", description: err.message, variant: "destructive" });
    },
  });

  const { data: settings = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/ot-settings", companyId],
    queryFn: async () => {
      const url = companyId ? `/api/ot-settings?companyId=${companyId}` : "/api/ot-settings";
      const r = await fetch(url, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: open,
  });

  useEffect(() => {
    if (settings.length > 0) {
      setItems(settings.map((s: any) => ({ ...s, rate: String(s.rate) })));
    } else if (!isLoading && open) {
      setItems([
        { otType: "regular", label: "OT วันปกติ (หลังเลิกงาน)", rate: "1.5", active: true, companyId },
        { otType: "holiday_regular", label: "วันหยุด (ในเวลาปกติ)", rate: "1", active: true, companyId },
        { otType: "holiday", label: "วันหยุด (เกินเวลาปกติ)", rate: "3", active: true, companyId },
        { otType: "special_holiday", label: "วันหยุดนักขัตฤกษ์ (เกินเวลาปกติ)", rate: "3", active: true, companyId },
      ]);
    }
  }, [settings, isLoading, open]);

  const saveMutation = useMutation({
    mutationFn: async (data: any[]) => {
      const r = await fetch("/api/ot-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.message); }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ot-settings"] });
      toast({ title: "บันทึกสูตร OT สำเร็จ" });
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast({ title: "ไม่สำเร็จ", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/ot-settings/${id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) { const d = await r.json(); throw new Error(d.message); }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ot-settings"] });
      toast({ title: "ลบสำเร็จ" });
    },
  });

  const handleSave = () => {
    saveMutation.mutate(items);
    if (companyId) {
      autoOtMutation.mutate({ companyId, autoOtEnabled, minOtMinutes, otRoundingMinutes });
    }
  };

  const handleAddNew = () => {
    if (!newType || !newLabel || !newRate) {
      toast({ title: "กรุณากรอกข้อมูลให้ครบ", variant: "destructive" });
      return;
    }
    setItems(prev => [...prev, { otType: newType, label: newLabel, rate: newRate, active: true, companyId }]);
    setNewType("");
    setNewLabel("");
    setNewRate("");
  };

  const handleDeleteItem = (index: number) => {
    const item = items[index];
    if (item.id) {
      deleteMutation.mutate(item.id);
    }
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="dialog-ot-settings">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" data-testid="text-settings-title">
            <Settings className="h-5 w-5" style={{ color: "#fb9678" }} />
            ตั้งค่าสูตร OT
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">กำหนดประเภทและอัตราค่า OT ที่ใช้คำนวณค่าล่วงเวลาของพนักงาน (ตามกฎหมายแรงงานไทย)</p>

          <div className="border rounded-lg p-4 space-y-3" data-testid="section-auto-ot-config">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-violet-500" />
                <div>
                  <p className="text-sm font-medium">คิด OT อัตโนมัติ (Auto OT)</p>
                  <p className="text-[11px] text-muted-foreground">ระบบจะสร้างรายการ OT อัตโนมัติเมื่อพนักงานเช็คเอาท์หลังเวลาเลิกงาน</p>
                </div>
              </div>
              <Switch checked={autoOtEnabled} onCheckedChange={setAutoOtEnabled} data-testid="switch-auto-ot-enabled" />
            </div>
            {autoOtEnabled && (
              <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground">OT ขั้นต่ำ (นาที)</label>
                  <Input type="number" min={1} max={120} value={minOtMinutes} onChange={e => setMinOtMinutes(Number(e.target.value))} className="h-8 text-sm mt-1" data-testid="input-min-ot-minutes" />
                  <p className="text-[10px] text-muted-foreground mt-0.5">ต้องทำงานเกินกี่นาทีถึงจะนับเป็น OT</p>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground">ปัดเศษ OT (นาที)</label>
                  <Input type="number" min={1} max={60} value={otRoundingMinutes} onChange={e => setOtRoundingMinutes(Number(e.target.value))} className="h-8 text-sm mt-1" data-testid="input-ot-rounding-minutes" />
                  <p className="text-[10px] text-muted-foreground mt-0.5">ปัดเศษลงทุกกี่นาที (เช่น 30 = ปัดลงทุก 30 นาที)</p>
                </div>
              </div>
            )}
          </div>

          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="text-xs font-bold">รหัส</TableHead>
                <TableHead className="text-xs font-bold">ชื่อประเภท</TableHead>
                <TableHead className="text-xs font-bold text-center">อัตรา (เท่า)</TableHead>
                <TableHead className="text-xs font-bold text-center">เปิดใช้</TableHead>
                <TableHead className="text-xs font-bold text-center w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, idx) => (
                <TableRow key={idx} data-testid={`row-ot-setting-${idx}`}>
                  <TableCell className="text-xs font-mono">{item.otType}</TableCell>
                  <TableCell>
                    <Input
                      value={item.label}
                      onChange={e => {
                        const v = e.target.value;
                        setItems(prev => prev.map((p, i) => i === idx ? { ...p, label: v } : p));
                      }}
                      className="h-8 text-sm"
                      data-testid={`input-ot-setting-label-${idx}`}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Input
                      type="number"
                      step="0.5"
                      min="0"
                      value={item.rate}
                      onChange={e => {
                        const v = e.target.value;
                        setItems(prev => prev.map((p, i) => i === idx ? { ...p, rate: v } : p));
                      }}
                      className="h-8 text-sm text-center w-20 mx-auto"
                      data-testid={`input-ot-setting-rate-${idx}`}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <input
                      type="checkbox"
                      checked={item.active}
                      onChange={e => {
                        const v = e.target.checked;
                        setItems(prev => prev.map((p, i) => i === idx ? { ...p, active: v } : p));
                      }}
                      className="h-4 w-4"
                      data-testid={`checkbox-ot-setting-active-${idx}`}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:bg-red-50" onClick={() => handleDeleteItem(idx)} data-testid={`button-delete-ot-setting-${idx}`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="border rounded-lg p-3 space-y-3 bg-slate-50">
            <p className="text-xs font-medium text-muted-foreground">เพิ่มประเภท OT ใหม่</p>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-muted-foreground">รหัส (ภาษาอังกฤษ)</label>
                <Input value={newType} onChange={e => setNewType(e.target.value)} placeholder="เช่น night" className="h-8 text-sm" data-testid="input-new-ot-type" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">ชื่อแสดง</label>
                <Input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="เช่น OT กลางคืน" className="h-8 text-sm" data-testid="input-new-ot-label" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">อัตรา (เท่า)</label>
                <Input type="number" step="0.5" min="0" value={newRate} onChange={e => setNewRate(e.target.value)} placeholder="เช่น 2" className="h-8 text-sm" data-testid="input-new-ot-rate" />
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleAddNew} className="w-full border-dashed" data-testid="button-add-ot-type">
              <Plus className="mr-2 h-3.5 w-3.5" /> เพิ่มประเภท OT
            </Button>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-settings">ยกเลิก</Button>
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              style={{ background: "#fb9678" }}
              className="text-white hover:opacity-90"
              data-testid="button-save-settings"
            >
              {saveMutation.isPending ? "กำลังบันทึก..." : "บันทึก"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
