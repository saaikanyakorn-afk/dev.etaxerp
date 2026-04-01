import Layout from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle, Plus, Trash2, Clock, Timer, AlertCircle, XCircle, Settings, CheckCheck, ChevronDown, ChevronRight } from "lucide-react";
import ThaiDateInput from "@/components/thai-date-input";
import { useDateSettings } from "@/hooks/use-date-settings";
import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useHrCompanyId } from "@/lib/company-context";

const MONTHS = [
  { value: "1", label: "มกราคม" }, { value: "2", label: "กุมภาพันธ์" },
  { value: "3", label: "มีนาคม" }, { value: "4", label: "เมษายน" },
  { value: "5", label: "พฤษภาคม" }, { value: "6", label: "มิถุนายน" },
  { value: "7", label: "กรกฎาคม" }, { value: "8", label: "สิงหาคม" },
  { value: "9", label: "กันยายน" }, { value: "10", label: "ตุลาคม" },
  { value: "11", label: "พฤศจิกายน" }, { value: "12", label: "ธันวาคม" },
];

function getYearOptions() {
  const current = new Date().getFullYear();
  return [current - 1, current, current + 1].map(y => ({ value: String(y), label: String(y) }));
}

function calcHours(start: string, end: string): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const diff = (eh * 60 + em) - (sh * 60 + sm);
  return diff > 0 ? +(diff / 60).toFixed(2) : 0;
}

export default function PayslipPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const companyId = useHrCompanyId();
  const { dateEra, dateFmt } = useDateSettings();
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));

  const [otDialogOpen, setOtDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [otForm, setOtForm] = useState({ date: "", otType: "regular", startTime: "", endTime: "" });
  const [selectedOtIds, setSelectedOtIds] = useState<number[]>([]);

  const isAdmin = user?.role === "admin" || user?.role === "owner" || user?.role === "super_admin";

  const queryClient = useQueryClient();

  const { data: employees = [] } = useQuery<any[]>({
    queryKey: ["/api/employees", companyId, "active"],
    queryFn: async () => {
      const r = await fetch(`/api/employees?status=active&companyId=${companyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
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

  const activeSettings = otSettingsData.filter((s: any) => s.active);

  const getRateForType = (otType: string) => {
    const setting = activeSettings.find((s: any) => s.otType === otType);
    return setting ? Number(setting.rate) : (otType === "holiday" ? 3 : otType === "holiday_regular" ? 1 : 1.5);
  };

  const getLabelForType = (otType: string) => {
    const setting = otSettingsData.find((s: any) => s.otType === otType);
    return setting?.label || (otType === "holiday" ? "วันหยุด (ล่วงเวลา)" : otType === "holiday_regular" ? "วันหยุด (ในเวลาปกติ)" : otType === "special_holiday" ? "วันหยุดนักขัตฤกษ์" : "วันปกติ");
  };

  const { data: allOtFlat = [] } = useQuery<any[]>({
    queryKey: ["/api/ot"],
    queryFn: async () => {
      const r = await fetch("/api/ot", { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!user && isAdmin,
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

  const otRecords = isAdmin ? allOtFlat : myOt;

  const otFormHours = calcHours(otForm.startTime, otForm.endTime);
  const otFormRate = getRateForType(otForm.otType);
  const otFormBaseSalary = Number(myEmployee?.baseSalary || 0);
  const otFormHourlyRate = otFormBaseSalary / 30 / 8;
  const otFormAmount = +(otFormHourlyRate * otFormHours * otFormRate).toFixed(2);

  const createOtMutation = useMutation({
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
      toast({ title: "ส่งคำขอ OT สำเร็จ" });
      setOtDialogOpen(false);
      setOtForm({ date: "", otType: "regular", startTime: "", endTime: "" });
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
      setSelectedOtIds([]);
      const action = variables.status === "approved" ? "อนุมัติ" : "ปฏิเสธ";
      toast({ title: `${action} OT สำเร็จ ${data.updated} รายการ` });
    },
    onError: (err: any) => {
      toast({ title: "ไม่สำเร็จ", description: err.message, variant: "destructive" });
    },
  });

  const handleOtSubmit = () => {
    if (!myEmployee) {
      toast({ title: "ไม่พบข้อมูลพนักงานของคุณ กรุณาติดต่อผู้ดูแลระบบ", variant: "destructive" });
      return;
    }
    const startTime = new Date(`${otForm.date}T${otForm.startTime}:00`);
    const endTime = new Date(`${otForm.date}T${otForm.endTime}:00`);
    createOtMutation.mutate({
      employeeId: myEmployee.id,
      date: otForm.date,
      otType: otForm.otType,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      hours: String(otFormHours),
      rate: String(otFormRate),
      amount: String(otFormAmount),
      status: "pending",
    });
  };

  const empMap = useMemo(() => {
    const map: Record<number, string> = {};
    employees.forEach((e: any) => { map[e.id] = e.fullName; });
    return map;
  }, [employees]);

  const otTotalHours = otRecords.reduce((s: number, r: any) => s + Number(r.hours || 0), 0);
  const otTotalAmount = otRecords.reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
  const otSkippedRecords = otRecords.filter((r: any) => r.status === "approved" && r.hasAttendance === false);
  const otSkippedHours = otSkippedRecords.reduce((s: number, r: any) => s + Number(r.hours || 0), 0);
  const otSkippedAmount = otSkippedRecords.reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
  const pendingOtRecords = otRecords.filter((r: any) => r.status === "pending");
  const otPendingCount = pendingOtRecords.length;
  const pendingOtIds = pendingOtRecords.map((r: any) => r.id as number);
  const allPendingSelected = pendingOtIds.length > 0 && pendingOtIds.every((id: number) => selectedOtIds.includes(id));

  const toggleSelectOt = (id: number) => {
    setSelectedOtIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const toggleSelectAll = () => {
    if (allPendingSelected) {
      setSelectedOtIds([]);
    } else {
      setSelectedOtIds(pendingOtIds);
    }
  };

  const otByDate = useMemo(() => {
    const groups: Record<string, any[]> = {};
    otRecords.forEach((ot: any) => {
      const d = ot.date || "ไม่ระบุ";
      if (!groups[d]) groups[d] = [];
      groups[d].push(ot);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [otRecords]);

  const today = new Date().toISOString().slice(0, 10);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  useEffect(() => {
    const autoExpand = new Set<string>();
    otByDate.forEach(([date, records]) => {
      if (date === today || records.some((r: any) => r.status === "pending")) {
        autoExpand.add(date);
      }
    });
    if (autoExpand.size === 0 && otByDate.length > 0) {
      autoExpand.add(otByDate[0][0]);
    }
    setExpandedDates(autoExpand);
  }, [otByDate.length]);

  const toggleDate = (date: string) => {
    setExpandedDates(prev => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date); else next.add(date);
      return next;
    });
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <Clock className="h-6 w-6" style={{ color: "#fb9678" }} />
            <h1 className="text-2xl font-bold" data-testid="text-page-title">จัดการ OT</h1>
          </div>
          <div className="flex items-center gap-2">
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="w-36" data-testid="select-month">
                <SelectValue placeholder="เดือน" />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map(m => (
                  <SelectItem key={m.value} value={m.value} data-testid={`option-month-${m.value}`}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="w-24" data-testid="select-year">
                <SelectValue placeholder="ปี" />
              </SelectTrigger>
              <SelectContent>
                {getYearOptions().map(y => (
                  <SelectItem key={y.value} value={y.value} data-testid={`option-year-${y.value}`}>{y.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          {isAdmin && (
            <Button variant="outline" onClick={() => setSettingsOpen(true)} className="border-[#fb9678] text-[#fb9678] hover:bg-[#fff3ef]" data-testid="button-ot-settings">
              <Settings className="mr-2 h-4 w-4" /> ตั้งค่าสูตร OT
            </Button>
          )}
          {!isAdmin && (
            <Button onClick={() => setOtDialogOpen(true)} style={{ background: "#fb9678" }} className="text-white hover:opacity-90" disabled={!myEmployee} data-testid="button-request-ot">
              <Plus className="mr-2 h-4 w-4" /> ขอทำ OT
            </Button>
          )}
        </div>

        {!isAdmin && !myEmployee && (
          <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm" data-testid="warning-no-employee">
            ยังไม่มีข้อมูลพนักงานของคุณในระบบ กรุณาติดต่อผู้ดูแลระบบเพื่อเพิ่มข้อมูลพนักงาน
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-none shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium" data-testid="label-total-ot-hours">OT ที่นับจริง (ชม.)</p>
                  <p className="text-3xl font-bold" style={{ color: "#03c9d7" }} data-testid="text-total-ot-hours">{(otTotalHours - otSkippedHours).toFixed(1)}</p>
                  {otSkippedHours > 0 && (
                    <p className="text-[11px] text-red-500 mt-0.5">ไม่นับ (ไม่ลงเวลา): {otSkippedHours.toFixed(1)} ชม.</p>
                  )}
                </div>
                <div className="h-12 w-12 rounded-full flex items-center justify-center" style={{ background: "#e5f9fa" }}>
                  <Timer className="h-6 w-6" style={{ color: "#03c9d7" }} />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium" data-testid="label-total-ot-amount">ค่า OT ที่นับจริง</p>
                  <p className="text-3xl font-bold" style={{ color: "#fb9678" }} data-testid="text-total-ot-amount">฿{(otTotalAmount - otSkippedAmount).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</p>
                  {otSkippedAmount > 0 && (
                    <p className="text-[11px] text-red-500 mt-0.5">ไม่นับ (ไม่ลงเวลา): ฿{otSkippedAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</p>
                  )}
                </div>
                <div className="h-12 w-12 rounded-full flex items-center justify-center" style={{ background: "#fff3ef" }}>
                  <Clock className="h-6 w-6" style={{ color: "#fb9678" }} />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium" data-testid="label-pending-ot">รออนุมัติ</p>
                  <p className="text-3xl font-bold text-amber-500" data-testid="text-pending-ot-count">{otPendingCount}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-amber-50 flex items-center justify-center">
                  <AlertCircle className="h-6 w-6 text-amber-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {isAdmin && otPendingCount > 0 && selectedOtIds.length === 0 && (
          <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700" data-testid="info-auto-approve">
            <Clock className="h-4 w-4 shrink-0" />
            <span>รายการ OT ที่รออนุมัติเกิน 24 ชม. จะถูกอนุมัติอัตโนมัติ — เลือก checkbox เพื่ออนุมัติ/ปฏิเสธหลายรายการพร้อมกัน</span>
          </div>
        )}

        {isAdmin && selectedOtIds.length > 0 && (
          <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg" data-testid="bar-bulk-actions">
            <CheckCheck className="h-5 w-5 text-blue-600" />
            <span className="text-sm font-medium text-blue-800">เลือก {selectedOtIds.length} รายการ</span>
            <div className="flex-1" />
            <Button
              size="sm"
              className="bg-emerald-500 hover:bg-emerald-600 text-white"
              disabled={batchMutation.isPending}
              onClick={() => batchMutation.mutate({ ids: selectedOtIds, status: "approved" })}
              data-testid="button-bulk-approve"
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              อนุมัติทั้งหมด ({selectedOtIds.length})
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-red-300 text-red-600 hover:bg-red-50"
              disabled={batchMutation.isPending}
              onClick={() => batchMutation.mutate({ ids: selectedOtIds, status: "rejected" })}
              data-testid="button-bulk-reject"
            >
              <XCircle className="h-4 w-4 mr-1" />
              ปฏิเสธทั้งหมด
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-gray-500"
              onClick={() => setSelectedOtIds([])}
              data-testid="button-clear-selection"
            >
              ยกเลิกเลือก
            </Button>
          </div>
        )}

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg" data-testid="text-ot-table-title">รายการ OT</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  {isAdmin && (
                    <TableHead className="w-10 text-center">
                      <Checkbox
                        checked={allPendingSelected}
                        onCheckedChange={toggleSelectAll}
                        disabled={pendingOtIds.length === 0}
                        data-testid="checkbox-select-all-ot"
                      />
                    </TableHead>
                  )}
                  {isAdmin && <TableHead className="text-xs font-bold">พนักงาน</TableHead>}
                  <TableHead className="text-xs font-bold">วันที่</TableHead>
                  <TableHead className="text-xs font-bold">ประเภท</TableHead>
                  <TableHead className="text-xs font-bold text-right">จำนวนชม.</TableHead>
                  <TableHead className="text-xs font-bold text-right">อัตรา</TableHead>
                  <TableHead className="text-xs font-bold text-right">จำนวนเงิน</TableHead>
                  <TableHead className="text-xs font-bold text-center">สถานะ</TableHead>
                  {isAdmin && <TableHead className="text-xs font-bold text-center">จัดการ</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {otRecords.length > 0 ? otRecords.map((ot: any) => (
                  <TableRow key={ot.id} data-testid={`row-ot-${ot.id}`} className={ot.status === "approved" && ot.hasAttendance === false ? "bg-red-50/40" : selectedOtIds.includes(ot.id) ? "bg-blue-50" : ""}>
                    {isAdmin && (
                      <TableCell className="text-center">
                        {ot.status === "pending" ? (
                          <Checkbox
                            checked={selectedOtIds.includes(ot.id)}
                            onCheckedChange={() => toggleSelectOt(ot.id)}
                            data-testid={`checkbox-ot-${ot.id}`}
                          />
                        ) : <span className="text-xs text-gray-300">—</span>}
                      </TableCell>
                    )}
                    {isAdmin && <TableCell className="text-xs font-medium" data-testid={`text-ot-emp-${ot.id}`}>{empMap[ot.employeeId] || `#${ot.employeeId}`}</TableCell>}
                    <TableCell className="text-xs" data-testid={`text-ot-date-${ot.id}`}>{ot.date}</TableCell>
                    <TableCell className="text-xs" data-testid={`text-ot-type-${ot.id}`}>{getLabelForType(ot.otType)}</TableCell>
                    <TableCell className={`text-xs text-right ${ot.status === "approved" && ot.hasAttendance === false ? "text-red-400 line-through" : ""}`} data-testid={`text-ot-hours-${ot.id}`}>{Number(ot.hours || 0).toFixed(1)}</TableCell>
                    <TableCell className="text-xs text-right" data-testid={`text-ot-rate-${ot.id}`}>{Number(ot.rate || 0)}x</TableCell>
                    <TableCell className={`text-xs text-right font-medium ${ot.status === "approved" && ot.hasAttendance === false ? "text-red-400 line-through" : ""}`} style={ot.status === "approved" && ot.hasAttendance === false ? {} : { color: "#fb9678" }} data-testid={`text-ot-amount-${ot.id}`}>
                      ฿{Number(ot.amount || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-center" data-testid={`text-ot-status-${ot.id}`}>
                      <div className="flex flex-col items-center gap-0.5">
                        {ot.status === "approved" && <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">อนุมัติ</Badge>}
                        {ot.status === "pending" && <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">รออนุมัติ</Badge>}
                        {ot.status === "rejected" && <Badge className="bg-red-100 text-red-700 hover:bg-red-100">ปฏิเสธ</Badge>}
                        {ot.status === "approved" && ot.hasAttendance === false && (
                          <span className="text-[10px] text-red-500 font-medium">ไม่ลงเวลา</span>
                        )}
                      </div>
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-center">
                        {ot.status === "pending" && (
                          <div className="flex items-center justify-center gap-1">
                            <Button size="sm" variant="ghost" className="text-emerald-600 hover:bg-emerald-50 h-7 px-2" onClick={() => approveMutation.mutate(ot.id)} data-testid={`button-approve-ot-${ot.id}`}>
                              <CheckCircle className="h-3.5 w-3.5 mr-1" /> อนุมัติ
                            </Button>
                            <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50 h-7 px-2" onClick={() => rejectMutation.mutate(ot.id)} data-testid={`button-reject-ot-${ot.id}`}>
                              <XCircle className="h-3.5 w-3.5 mr-1" /> ปฏิเสธ
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 9 : 7} className="text-center py-8 text-muted-foreground text-xs" data-testid="text-no-ot">
                      ยังไม่มีรายการ OT
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={otDialogOpen} onOpenChange={setOtDialogOpen}>
          <DialogContent className="max-w-md" data-testid="dialog-ot-form">
            <DialogHeader>
              <DialogTitle data-testid="text-dialog-title">ขอทำงานล่วงเวลา (OT)</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">วันที่ *</label>
                <ThaiDateInput value={otForm.date} onChange={(v: string) => setOtForm(f => ({ ...f, date: v }))} dateEra={dateEra} dateFmt={dateFmt} data-testid="input-ot-date" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">ประเภท OT *</label>
                <Select value={otForm.otType} onValueChange={v => setOtForm(f => ({ ...f, otType: v }))}>
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">เวลาเริ่ม *</label>
                  <Input type="time" value={otForm.startTime} onChange={e => setOtForm(f => ({ ...f, startTime: e.target.value }))} data-testid="input-ot-start-time" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">เวลาสิ้นสุด *</label>
                  <Input type="time" value={otForm.endTime} onChange={e => setOtForm(f => ({ ...f, endTime: e.target.value }))} data-testid="input-ot-end-time" />
                </div>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">จำนวนชั่วโมง</span>
                  <span className="font-bold" data-testid="text-calc-hours">{otFormHours.toFixed(1)} ชม.</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">อัตราค่าจ้าง</span>
                  <span className="font-bold" data-testid="text-calc-rate">{otFormRate}x</span>
                </div>
                <div className="flex justify-between text-sm border-t pt-2 mt-2">
                  <span className="font-medium">ค่า OT โดยประมาณ</span>
                  <span className="font-bold text-lg" style={{ color: "#fb9678" }} data-testid="text-calc-amount">฿{otFormAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setOtDialogOpen(false)} data-testid="button-cancel-ot">ยกเลิก</Button>
                <Button
                  onClick={handleOtSubmit}
                  disabled={createOtMutation.isPending || !otForm.date || !otForm.startTime || !otForm.endTime || otFormHours <= 0}
                  style={{ background: "#fb9678" }}
                  className="text-white hover:opacity-90"
                  data-testid="button-submit-ot"
                >
                  {createOtMutation.isPending ? "กำลังส่ง..." : "ส่งคำขอ OT"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <OTSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} companyId={companyId} />
      </div>
    </Layout>
  );
}

function OTSettingsDialog({ open, onOpenChange, companyId }: { open: boolean; onOpenChange: (v: boolean) => void; companyId: number | null }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [items, setItems] = useState<any[]>([]);
  const [newType, setNewType] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newRate, setNewRate] = useState("");

  const { data: settings = [] } = useQuery<any[]>({
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
    }
  }, [settings]);

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
