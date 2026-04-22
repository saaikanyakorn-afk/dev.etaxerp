import HRLayout from "@/components/hr-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CalendarDays, Plus, CheckCircle, XCircle, Clock, Palmtree, Briefcase, Heart, Settings, RefreshCw } from "lucide-react";
import { useLocation } from "wouter";
import ThaiDateInput from "@/components/thai-date-input";
import { useDateSettings } from "@/hooks/use-date-settings";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useHrCompanyId } from "@/lib/company-context";
import { useTranslation } from "@/hooks/use-translation";

function getLeaveTypes(t: (k: string) => string) {
  return [
    { value: "sick", label: t("hr.sickLeave") },
    { value: "personal", label: t("hr.personalLeave") },
    { value: "vacation", label: t("hr.annualLeave") },
    { value: "maternity", label: t("hr.maternityLeave") },
    { value: "other", label: t("hr.otherLeave") },
  ];
}

function getLeaveTypeLabel(val: string, t: (k: string) => string) {
  return getLeaveTypes(t).find(lt => lt.value === val)?.label || val;
}

const DAY_MAP: Record<number, string> = { 0: "sun", 1: "mon", 2: "tue", 3: "wed", 4: "thu", 5: "fri", 6: "sat" };

function calcDays(start: string, end: string, workDays: string[] = ["mon","tue","wed","thu","fri"], holidayDates: Set<string> = new Set()): number {
  if (!start || !end) return 0;
  const s = new Date(start);
  const e = new Date(end);
  if (e < s) return 0;
  let count = 0;
  const cur = new Date(s);
  while (cur <= e) {
    const dayKey = DAY_MAP[cur.getDay()];
    const dateStr = cur.toISOString().slice(0, 10);
    if (workDays.includes(dayKey) && !holidayDates.has(dateStr)) {
      count++;
    }
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

export default function LeaveManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const companyId = useHrCompanyId();
  const [, navigate] = useLocation();
  const { dateEra, dateFmt } = useDateSettings();
  const { t, lang } = useTranslation();
  const LEAVE_TYPES = getLeaveTypes(t);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ leaveType: "", startDate: "", endDate: "", reason: "", halfDay: "" as "" | "morning" | "afternoon" });

  const isAdmin = user?.role === "admin" || user?.role === "owner" || user?.role === "super_admin" || user?.role === "manager";

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

  const { data: allLeaves = [] } = useQuery<any[]>({
    queryKey: ["/api/leaves", companyId],
    queryFn: async () => {
      const url = companyId ? `/api/leaves?companyId=${companyId}` : "/api/leaves";
      const r = await fetch(url, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!user && isAdmin,
  });

  const { data: myLeaves = [] } = useQuery<any[]>({
    queryKey: ["/api/leaves", myEmployee?.id],
    queryFn: async () => {
      const r = await fetch(`/api/leaves/${myEmployee!.id}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!myEmployee && !isAdmin,
  });

  const { data: hrBalanceSummary = [] } = useQuery({
    queryKey: ["/api/leave-balances/summary", companyId],
    queryFn: async () => {
      const r = await fetch(`/api/leave-balances/summary?companyId=${companyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: isAdmin && !!companyId,
  });

  const { data: workSchedule } = useQuery<any>({
    queryKey: ["/api/work-schedules", companyId],
    queryFn: async () => {
      const r = await fetch(`/api/work-schedules?companyId=${companyId}`, { credentials: "include" });
      if (!r.ok) return null;
      const list = await r.json();
      return Array.isArray(list) ? list[0] : list;
    },
    enabled: !!companyId,
  });

  const { data: companyHolidays = [] } = useQuery<any[]>({
    queryKey: ["/api/holidays", companyId],
    queryFn: async () => {
      const r = await fetch(`/api/holidays?companyId=${companyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!companyId,
  });

  const workDays = workSchedule?.workDays || ["mon","tue","wed","thu","fri"];
  const holidayDates = useMemo(() => {
    const set = new Set<string>();
    companyHolidays.forEach((h: any) => { if (h.date) set.add(h.date); });
    return set;
  }, [companyHolidays]);

  const leaves = isAdmin ? allLeaves : myLeaves;

  const days = form.halfDay ? 0.5 : calcDays(form.startDate, form.endDate, workDays, holidayDates);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch("/api/leaves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.message); }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leaves"] });
      toast({ title: t("toast.saveSuccess") });
      setDialogOpen(false);
      setForm({ leaveType: "", startDate: "", endDate: "", reason: "", halfDay: "" });
    },
    onError: (err: any) => {
      toast({ title: t("toast.saveFailed"), description: err.message, variant: "destructive" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/leaves/${id}/approve`, { method: "PATCH", credentials: "include" });
      if (!r.ok) { const d = await r.json(); throw new Error(d.message); }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leaves"] });
      toast({ title: t("approval.approvedSuccess") });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/leaves/${id}/reject`, { method: "PATCH", credentials: "include" });
      if (!r.ok) { const d = await r.json(); throw new Error(d.message); }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leaves"] });
      toast({ title: t("approval.rejectedSuccess") });
    },
  });

  const recalcMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/leaves/recalculate-days?companyId=${companyId}`, { method: "POST", credentials: "include" });
      if (!r.ok) { const d = await r.json(); throw new Error(d.message); }
      return r.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/leaves"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leave-balances/summary"] });
      toast({ title: "สำเร็จ", description: data.message || "คำนวณวันลาใหม่เรียบร้อย" });
    },
    onError: (err: any) => {
      toast({ title: "ไม่สำเร็จ", description: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!myEmployee) {
      toast({ title: lang === "en" ? "Employee record not found" : lang.startsWith("zh") ? "未找到员工记录" : "ไม่พบข้อมูลพนักงานของคุณ", variant: "destructive" });
      return;
    }
    const endDate = form.halfDay ? form.startDate : form.endDate;
    const halfDayNote = form.halfDay ? (form.halfDay === "morning" ? " (ครึ่งวันเช้า)" : " (ครึ่งวันบ่าย)") : "";
    createMutation.mutate({
      employeeId: myEmployee.id,
      leaveType: form.leaveType,
      startDate: form.startDate,
      endDate,
      days: String(days),
      reason: (form.reason || "") + halfDayNote || null,
      status: "pending",
    });
  };

  const empMap = useMemo(() => {
    const map: Record<number, string> = {};
    employees.forEach((e: any) => { map[e.id] = e.fullName; });
    return map;
  }, [employees]);

  const pendingCount = leaves.filter((l: any) => l.status === "pending").length;
  const approvedCount = leaves.filter((l: any) => l.status === "approved").length;
  const totalDays = leaves.filter((l: any) => l.status === "approved").reduce((s: number, l: any) => s + Number(l.days || 0), 0);

  return (
    <HRLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-6 w-6" style={{ color: "#fb9678" }} />
            <h1 className="text-2xl font-bold" data-testid="text-page-title">{t("nav.leaveManagement")}</h1>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <>
                <Button variant="outline" size="sm" disabled={recalcMutation.isPending} onClick={() => recalcMutation.mutate()} className="border-[#03c9d7] text-[#03c9d7] hover:bg-[#e6fafb]" data-testid="button-recalculate-leave">
                  <RefreshCw className={`mr-2 h-4 w-4 ${recalcMutation.isPending ? "animate-spin" : ""}`} /> คำนวณวันลาใหม่
                </Button>
                <Button variant="outline" onClick={() => navigate("/hr/leave-policy")} className="border-[#fb9678] text-[#fb9678] hover:bg-[#fff3ef]" data-testid="button-leave-policy-settings">
                  <Settings className="mr-2 h-4 w-4" /> ตั้งค่านโยบายลา
                </Button>
              </>
            )}
            {!isAdmin && (
              <Button onClick={() => setDialogOpen(true)} style={{ background: "#fb9678" }} className="text-white hover:opacity-90" disabled={!myEmployee} data-testid="button-request-leave">
                <Plus className="mr-2 h-4 w-4" /> {t("hr.leaveRequest")}
              </Button>
            )}
          </div>
        </div>

        {!isAdmin && !myEmployee && (
          <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm" data-testid="warning-no-employee">
            {lang === "en" ? "Your employee record is not found. Please contact your admin." : lang.startsWith("zh") ? "未找到您的员工记录，请联系管理员。" : "ยังไม่มีข้อมูลพนักงานของคุณในระบบ กรุณาติดต่อผู้ดูแลระบบเพื่อเพิ่มข้อมูลพนักงาน"}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-none shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium" data-testid="label-pending">{t("common.pending")}</p>
                  <p className="text-3xl font-bold text-amber-500" data-testid="text-pending-count">{pendingCount}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-amber-50 flex items-center justify-center">
                  <Clock className="h-6 w-6 text-amber-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium" data-testid="label-approved">{t("common.approved")}</p>
                  <p className="text-3xl font-bold text-emerald-500" data-testid="text-approved-count">{approvedCount}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-emerald-50 flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-emerald-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium" data-testid="label-total-days">{lang === "en" ? "Days Used" : lang.startsWith("zh") ? "已用天数" : "วันลาที่ใช้ไป"}</p>
                  <p className="text-3xl font-bold" style={{ color: "#03c9d7" }} data-testid="text-total-leave-days">{totalDays}</p>
                </div>
                <div className="h-12 w-12 rounded-full flex items-center justify-center" style={{ background: "#e5f9fa" }}>
                  <Palmtree className="h-6 w-6" style={{ color: "#03c9d7" }} />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium" data-testid="label-total-requests">{lang === "en" ? "Total Requests" : lang.startsWith("zh") ? "总申请数" : "คำขอทั้งหมด"}</p>
                  <p className="text-3xl font-bold" style={{ color: "#fb9678" }} data-testid="text-total-requests">{leaves.length}</p>
                </div>
                <div className="h-12 w-12 rounded-full flex items-center justify-center" style={{ background: "#fff3ef" }}>
                  <Briefcase className="h-6 w-6" style={{ color: "#fb9678" }} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {isAdmin && hrBalanceSummary.length > 0 && (
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg" data-testid="text-hr-balance-title">{lang === "en" ? "Employee Leave Balances" : lang.startsWith("zh") ? "员工假期余额" : "สรุปวันลาพนักงาน"}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead data-testid="th-emp-name">{lang === "en" ? "Employee" : "พนักงาน"}</TableHead>
                      <TableHead data-testid="th-leave-type">{lang === "en" ? "Leave Type" : "ประเภทลา"}</TableHead>
                      <TableHead className="text-center" data-testid="th-quota">{lang === "en" ? "Quota" : "โควต้า"}</TableHead>
                      <TableHead className="text-center" data-testid="th-carried">{lang === "en" ? "Carried Over" : "ยกมา"}</TableHead>
                      <TableHead className="text-center" data-testid="th-used">{lang === "en" ? "Used" : "ใช้ไป"}</TableHead>
                      <TableHead className="text-center" data-testid="th-expired">{lang === "en" ? "Expired" : "หมดอายุ"}</TableHead>
                      <TableHead className="text-center" data-testid="th-remaining">{lang === "en" ? "Remaining" : "คงเหลือ"}</TableHead>
                      <TableHead data-testid="th-expiry-date">{lang === "en" ? "Carry-over Expiry" : "วันหมดอายุยกมา"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {hrBalanceSummary.map((b: any, i: number) => {
                      const lt = getLeaveTypes(t).find(lt => lt.value === b.leaveType);
                      const remaining = b.remaining != null ? Number(b.remaining) : Math.max(0, Number(b.quota || 0) + Number(b.effectiveCarriedOver || 0) - Number(b.used || 0) - Number(b.expired || 0));
                      const isExpiring = b.carryOverExpiryDate && Number(b.carriedOver) > 0 && !b.carryOverExpired && (() => {
                        const d = Math.ceil((new Date(b.carryOverExpiryDate).getTime() - Date.now()) / (1000*60*60*24));
                        return d > 0 && d <= 30;
                      })();
                      return (
                        <TableRow key={i} className={isExpiring ? "bg-amber-50" : ""} data-testid={`row-balance-${i}`}>
                          <TableCell data-testid={`text-balance-emp-${i}`}>{empMap[b.employeeId] || `#${b.employeeId}`}</TableCell>
                          <TableCell data-testid={`text-balance-type-${i}`}>{lt?.label || b.leaveType}</TableCell>
                          <TableCell className="text-center" data-testid={`text-balance-quota-${i}`}>{b.quota}</TableCell>
                          <TableCell className="text-center" data-testid={`text-balance-carried-${i}`}>{b.carriedOver || 0}</TableCell>
                          <TableCell className="text-center" data-testid={`text-balance-used-${i}`}>{b.used || 0}</TableCell>
                          <TableCell className="text-center" data-testid={`text-balance-expired-${i}`}>{b.expired || 0}</TableCell>
                          <TableCell className="text-center font-semibold" data-testid={`text-balance-remaining-${i}`}>{remaining}</TableCell>
                          <TableCell data-testid={`text-balance-expiry-${i}`}>
                            {b.carryOverExpiryDate ? (
                              <span className={isExpiring ? "text-amber-600 font-medium" : ""}>
                                {b.carryOverExpiryDate} {isExpiring && "⚠️"}
                              </span>
                            ) : "-"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg" data-testid="text-leave-table-title">{lang === "en" ? "Leave Records" : lang.startsWith("zh") ? "请假记录" : "รายการลา"}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  {isAdmin && <TableHead className="text-xs font-bold">{t("common.employee")}</TableHead>}
                  <TableHead className="text-xs font-bold">{t("hr.leaveType")}</TableHead>
                  <TableHead className="text-xs font-bold">{t("hr.startDate")}</TableHead>
                  <TableHead className="text-xs font-bold">{t("hr.endDate")}</TableHead>
                  <TableHead className="text-xs font-bold text-right">{t("hr.days")}</TableHead>
                  <TableHead className="text-xs font-bold">{t("hr.reason")}</TableHead>
                  <TableHead className="text-xs font-bold text-center">{t("common.status")}</TableHead>
                  {isAdmin && <TableHead className="text-xs font-bold text-center">{t("common.actions")}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaves.length > 0 ? leaves.map((lv: any) => (
                  <TableRow key={lv.id} data-testid={`row-leave-${lv.id}`}>
                    {isAdmin && <TableCell className="text-xs font-medium" data-testid={`text-leave-emp-${lv.id}`}>{empMap[lv.employeeId] || `#${lv.employeeId}`}</TableCell>}
                    <TableCell className="text-xs" data-testid={`text-leave-type-${lv.id}`}>{getLeaveTypeLabel(lv.leaveType, t)}</TableCell>
                    <TableCell className="text-xs" data-testid={`text-leave-start-${lv.id}`}>{lv.startDate}</TableCell>
                    <TableCell className="text-xs" data-testid={`text-leave-end-${lv.id}`}>{lv.endDate}</TableCell>
                    <TableCell className="text-xs text-right font-medium" data-testid={`text-leave-days-${lv.id}`}>{Number(lv.days) % 1 !== 0 ? Number(lv.days).toFixed(1) : Number(lv.days).toFixed(0)}</TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate" data-testid={`text-leave-reason-${lv.id}`}>{lv.reason || "-"}</TableCell>
                    <TableCell className="text-center" data-testid={`badge-leave-status-${lv.id}`}>
                      <Badge variant="outline" className={
                        lv.status === "approved" ? "bg-emerald-50 text-emerald-600 border-emerald-200" :
                        lv.status === "rejected" ? "bg-red-50 text-red-600 border-red-200" :
                        "bg-amber-50 text-amber-600 border-amber-200"
                      }>
                        {lv.status === "approved" ? t("common.approved") : lv.status === "rejected" ? t("common.rejected") : t("common.pending")}
                      </Badge>
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-center">
                        {lv.status === "pending" && (
                          <div className="flex items-center justify-center gap-1">
                            <Button size="sm" variant="ghost" className="text-emerald-600 hover:bg-emerald-50 h-7 px-2" onClick={() => approveMutation.mutate(lv.id)} data-testid={`button-approve-leave-${lv.id}`}>
                              <CheckCircle className="h-3.5 w-3.5 mr-1" /> {t("common.approve")}
                            </Button>
                            <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50 h-7 px-2" onClick={() => rejectMutation.mutate(lv.id)} data-testid={`button-reject-leave-${lv.id}`}>
                              <XCircle className="h-3.5 w-3.5 mr-1" /> {t("common.reject")}
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 8 : 7} className="text-center py-8 text-muted-foreground text-xs" data-testid="text-no-leaves">
                      {t("common.noData")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md" data-testid="dialog-leave-form">
            <DialogHeader>
              <DialogTitle data-testid="text-dialog-title">{t("hr.leaveRequest")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">{t("hr.leaveType")} *</label>
                <Select value={form.leaveType} onValueChange={v => setForm(f => ({ ...f, leaveType: v }))}>
                  <SelectTrigger data-testid="select-leave-type">
                    <SelectValue placeholder={t("hr.leaveType")} />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAVE_TYPES.map(lt => (
                      <SelectItem key={lt.value} value={lt.value} data-testid={`option-leave-${lt.value}`}>{lt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">{lang === "en" ? "Duration" : lang.startsWith("zh") ? "时长" : "ระยะเวลา"}</label>
                <div className="flex gap-2 mt-1">
                  <Button
                    type="button"
                    variant={!form.halfDay ? "default" : "outline"}
                    size="sm"
                    className={!form.halfDay ? "flex-1 text-white" : "flex-1"}
                    style={!form.halfDay ? { background: "#fb9678" } : {}}
                    onClick={() => setForm(f => ({ ...f, halfDay: "" }))}
                    data-testid="btn-fullday"
                  >
                    {lang === "en" ? "Full Day" : lang.startsWith("zh") ? "全天" : "เต็มวัน"}
                  </Button>
                  <Button
                    type="button"
                    variant={form.halfDay === "morning" ? "default" : "outline"}
                    size="sm"
                    className={form.halfDay === "morning" ? "flex-1 text-white" : "flex-1"}
                    style={form.halfDay === "morning" ? { background: "#03c9d7" } : {}}
                    onClick={() => setForm(f => ({ ...f, halfDay: "morning", endDate: f.startDate }))}
                    data-testid="btn-halfday-morning"
                  >
                    {lang === "en" ? "Half Day (AM)" : lang.startsWith("zh") ? "半天（上午）" : "ครึ่งวันเช้า"}
                  </Button>
                  <Button
                    type="button"
                    variant={form.halfDay === "afternoon" ? "default" : "outline"}
                    size="sm"
                    className={form.halfDay === "afternoon" ? "flex-1 text-white" : "flex-1"}
                    style={form.halfDay === "afternoon" ? { background: "#03c9d7" } : {}}
                    onClick={() => setForm(f => ({ ...f, halfDay: "afternoon", endDate: f.startDate }))}
                    data-testid="btn-halfday-afternoon"
                  >
                    {lang === "en" ? "Half Day (PM)" : lang.startsWith("zh") ? "半天（下午）" : "ครึ่งวันบ่าย"}
                  </Button>
                </div>
              </div>
              <div className={form.halfDay ? "grid grid-cols-1 gap-4" : "grid grid-cols-2 gap-4"}>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">{form.halfDay ? (lang === "en" ? "Date" : lang.startsWith("zh") ? "日期" : "วันที่ลา") : t("hr.startDate")} *</label>
                  <ThaiDateInput value={form.startDate} onChange={(v: string) => setForm(f => ({ ...f, startDate: v, ...(f.halfDay ? { endDate: v } : {}) }))} dateEra={dateEra} dateFmt={dateFmt} data-testid="input-leave-start" />
                </div>
                {!form.halfDay && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">{t("hr.endDate")} *</label>
                    <ThaiDateInput value={form.endDate} onChange={(v: string) => setForm(f => ({ ...f, endDate: v }))} dateEra={dateEra} dateFmt={dateFmt} data-testid="input-leave-end" />
                  </div>
                )}
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-xs text-muted-foreground">{t("hr.days")}</p>
                <p className="text-2xl font-bold" style={{ color: "#fb9678" }} data-testid="text-calc-days">
                  {days} {lang === "en" ? "days" : lang.startsWith("zh") ? "天" : "วัน"}
                  {form.halfDay && <span className="text-sm font-normal ml-2" style={{ color: "#03c9d7" }}>({form.halfDay === "morning" ? (lang === "en" ? "Morning" : "เช้า") : (lang === "en" ? "Afternoon" : "บ่าย")})</span>}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">{t("hr.reason")}</label>
                <Textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder={lang === "en" ? "Reason (optional)" : lang.startsWith("zh") ? "原因（可选）" : "ระบุเหตุผล (ไม่บังคับ)"} data-testid="input-leave-reason" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)} data-testid="button-cancel-leave">{t("common.cancel")}</Button>
                <Button
                  onClick={handleSubmit}
                  disabled={createMutation.isPending || !form.leaveType || !form.startDate || (!form.halfDay && !form.endDate) || days <= 0}
                  style={{ background: "#fb9678" }}
                  className="text-white hover:opacity-90"
                  data-testid="button-submit-leave"
                >
                  {createMutation.isPending ? t("common.saving") : t("hr.leaveRequest")}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </HRLayout>
  );
}
