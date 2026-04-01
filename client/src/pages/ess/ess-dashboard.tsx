import Layout from "@/components/layout";
import { objectPathToUrl } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ThaiDateInput from "@/components/thai-date-input";
import { useDateSettings } from "@/hooks/use-date-settings";
import {
  User, CalendarDays, Clock, FileText, Plus, CheckCircle, XCircle,
  Palmtree, Briefcase, Heart, Timer, Printer, Download, AlertCircle
} from "lucide-react";
import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/lib/company-context";
import { formatDate } from "@/lib/format";

const MONTHS = [
  { value: "1", label: "มกราคม" }, { value: "2", label: "กุมภาพันธ์" },
  { value: "3", label: "มีนาคม" }, { value: "4", label: "เมษายน" },
  { value: "5", label: "พฤษภาคม" }, { value: "6", label: "มิถุนายน" },
  { value: "7", label: "กรกฎาคม" }, { value: "8", label: "สิงหาคม" },
  { value: "9", label: "กันยายน" }, { value: "10", label: "ตุลาคม" },
  { value: "11", label: "พฤศจิกายน" }, { value: "12", label: "ธันวาคม" },
];

const LEAVE_TYPES = [
  { value: "sick", label: "ลาป่วย", icon: Heart, color: "#f94d4d" },
  { value: "personal", label: "ลากิจ", icon: Briefcase, color: "var(--theme-primary)" },
  { value: "vacation", label: "ลาพักร้อน", icon: Palmtree, color: "#05b187" },
  { value: "maternity", label: "ลาคลอด", icon: User, color: "#fec90f" },
  { value: "other", label: "ลาอื่นๆ", icon: CalendarDays, color: "#03c9d7" },
];

function getLeaveTypeLabel(val: string) {
  return LEAVE_TYPES.find(t => t.value === val)?.label || val;
}

const DAY_MAP_ESS: Record<number, string> = { 0: "sun", 1: "mon", 2: "tue", 3: "wed", 4: "thu", 5: "fri", 6: "sat" };

function calcDays(start: string, end: string, workDays: string[] = ["mon","tue","wed","thu","fri"], holidayDates: Set<string> = new Set()): number {
  if (!start || !end) return 0;
  const s = new Date(start);
  const e = new Date(end);
  if (e < s) return 0;
  let count = 0;
  const cur = new Date(s);
  while (cur <= e) {
    const dk = DAY_MAP_ESS[cur.getDay()];
    const ds = cur.toISOString().slice(0, 10);
    if (workDays.includes(dk) && !holidayDates.has(ds)) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

function calcOtHours(start: string, end: string): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const diff = (eh * 60 + em) - (sh * 60 + sm);
  return diff > 0 ? +(diff / 60).toFixed(2) : 0;
}

function fmt(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function statusBadge(status: string) {
  if (status === "approved") return <Badge className="bg-green-100 text-green-700" data-testid="badge-approved">อนุมัติแล้ว</Badge>;
  if (status === "rejected") return <Badge className="bg-red-100 text-red-700" data-testid="badge-rejected">ไม่อนุมัติ</Badge>;
  if (status === "cancelled") return <Badge className="bg-gray-100 text-gray-500" data-testid="badge-cancelled">ยกเลิกแล้ว</Badge>;
  return <Badge className="bg-yellow-100 text-yellow-700" data-testid="badge-pending">รออนุมัติ</Badge>;
}

function calcYearsMonths(startDate: string): string {
  if (!startDate) return "-";
  const start = new Date(startDate);
  const now = new Date();
  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();
  if (months < 0) { years--; months += 12; }
  if (years > 0 && months > 0) return `${years} ปี ${months} เดือน`;
  if (years > 0) return `${years} ปี`;
  return `${months} เดือน`;
}

function numberToThaiText(num: number): string {
  const units = ["", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
  const positions = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน", "ล้าน"];
  if (num === 0) return "ศูนย์บาทถ้วน";
  const intPart = Math.floor(num);
  const decPart = Math.round((num - intPart) * 100);
  let result = "";
  const str = String(intPart);
  const len = str.length;
  for (let i = 0; i < len; i++) {
    const digit = parseInt(str[i]);
    const pos = len - i - 1;
    if (digit === 0) continue;
    if (pos === 1 && digit === 1) { result += "สิบ"; continue; }
    if (pos === 1 && digit === 2) { result += "ยี่สิบ"; continue; }
    if (pos === 0 && digit === 1 && len > 1) { result += "เอ็ด"; continue; }
    result += units[digit] + positions[pos];
  }
  result += "บาท";
  if (decPart === 0) { result += "ถ้วน"; }
  else {
    const decStr = String(decPart).padStart(2, "0");
    const d1 = parseInt(decStr[0]);
    const d2 = parseInt(decStr[1]);
    if (d1 === 1) result += "สิบ";
    else if (d1 === 2) result += "ยี่สิบ";
    else if (d1 > 0) result += units[d1] + "สิบ";
    if (d2 === 1 && d1 > 0) result += "เอ็ด";
    else if (d2 > 0) result += units[d2];
    result += "สตางค์";
  }
  return result;
}

export default function EssDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedCompany, selectedCompanyId } = useCompany();
  const { dateEra, dateFmt } = useDateSettings();
  const [activeTab, setActiveTab] = useState("overview");
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [otDialogOpen, setOtDialogOpen] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ leaveType: "", startDate: "", endDate: "", reason: "", halfDay: "" as "" | "morning" | "afternoon" });
  const [otForm, setOtForm] = useState({ date: "", otType: "regular", startTime: "", endTime: "" });
  const [docType, setDocType] = useState<string | null>(null);
  const [docYear, setDocYear] = useState(String(new Date().getFullYear()));
  const [docMonth, setDocMonth] = useState(String(new Date().getMonth() + 1));
  const printRef = useRef<HTMLDivElement>(null);

  const { data: profileData } = useQuery<any>({
    queryKey: ["/api/ess/profile"],
    queryFn: async () => {
      const r = await fetch("/api/ess/profile", { credentials: "include" });
      if (!r.ok) return null;
      return r.json();
    },
    enabled: !!user,
  });

  const employee = profileData?.employee;
  const company = profileData?.company || selectedCompany;

  const { data: leaves = [] } = useQuery<any[]>({
    queryKey: ["/api/ess/leaves"],
    queryFn: async () => {
      const r = await fetch("/api/ess/leaves", { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!user,
  });

  const { data: otRecords = [] } = useQuery<any[]>({
    queryKey: ["/api/ess/ot"],
    queryFn: async () => {
      const r = await fetch("/api/ess/ot", { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!user,
  });

  const { data: payslips = [] } = useQuery<any[]>({
    queryKey: ["/api/ess/payslips", docYear],
    queryFn: async () => {
      const r = await fetch(`/api/ess/payslips?year=${docYear}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!user,
  });

  const companyId = company?.id || selectedCompanyId;

  const { data: essWorkSchedule } = useQuery<any>({
    queryKey: ["/api/work-schedules", companyId, "ess"],
    queryFn: async () => {
      const r = await fetch(`/api/work-schedules?companyId=${companyId}`, { credentials: "include" });
      if (!r.ok) return null;
      const list = await r.json();
      return Array.isArray(list) ? list[0] : list;
    },
    enabled: !!companyId,
  });

  const { data: essHolidays = [] } = useQuery<any[]>({
    queryKey: ["/api/holidays", companyId, "ess"],
    queryFn: async () => {
      const r = await fetch(`/api/holidays?companyId=${companyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!companyId,
  });

  const essWorkDays = essWorkSchedule?.workDays || ["mon","tue","wed","thu","fri"];
  const essHolidayDates = useMemo(() => {
    const set = new Set<string>();
    essHolidays.forEach((h: any) => { if (h.date) set.add(h.date); });
    return set;
  }, [essHolidays]);

  const { data: docSettings } = useQuery<any>({
    queryKey: ["/api/document-settings", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const res = await fetch(`/api/document-settings?companyId=${companyId}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!companyId,
  });

  const { data: fiftyTawiData } = useQuery<any>({
    queryKey: ["/api/ess/fifty-tawi", docYear],
    queryFn: async () => {
      const r = await fetch(`/api/ess/fifty-tawi?year=${docYear}`, { credentials: "include" });
      if (!r.ok) return null;
      return r.json();
    },
    enabled: !!user,
  });

  const leaveMutation = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch("/api/ess/leaves", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data), credentials: "include",
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "ส่งใบลาสำเร็จ", description: "รอผู้มีอำนาจอนุมัติ" });
      queryClient.invalidateQueries({ queryKey: ["/api/ess/leaves"] });
      setLeaveDialogOpen(false);
      setLeaveForm({ leaveType: "", startDate: "", endDate: "", reason: "", halfDay: "" });
    },
    onError: (err: any) => toast({ title: "ไม่สำเร็จ", description: err.message, variant: "destructive" }),
  });

  const otMutation = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch("/api/ess/ot", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data), credentials: "include",
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "ส่งคำขอ OT สำเร็จ", description: "รอผู้มีอำนาจอนุมัติ" });
      queryClient.invalidateQueries({ queryKey: ["/api/ess/ot"] });
      setOtDialogOpen(false);
      setOtForm({ date: "", otType: "regular", startTime: "", endTime: "" });
    },
    onError: (err: any) => toast({ title: "ไม่สำเร็จ", description: err.message, variant: "destructive" }),
  });

  const cancelOtMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/ess/ot/${id}/cancel`, {
        method: "PATCH", credentials: "include",
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "ยกเลิกคำขอ OT เรียบร้อย" });
      queryClient.invalidateQueries({ queryKey: ["/api/ess/ot"] });
    },
    onError: (err: any) => toast({ title: "ไม่สำเร็จ", description: err.message, variant: "destructive" }),
  });

  const leaveDays = leaveForm.halfDay ? 0.5 : calcDays(leaveForm.startDate, leaveForm.endDate, essWorkDays, essHolidayDates);
  const otHours = calcOtHours(otForm.startTime, otForm.endTime);
  const otRate = otForm.otType === "holiday" ? 3 : 1.5;
  const baseSalary = Number(employee?.baseSalary || 0);
  const hourlyRate = baseSalary / 30 / 8;
  const otAmount = +(hourlyRate * otHours * otRate).toFixed(2);

  const { data: leaveBalanceSummary = [] } = useQuery<any[]>({
    queryKey: ["/api/ess/leave-balance-summary"],
    queryFn: async () => {
      const r = await fetch("/api/ess/leave-balance-summary", { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!user,
  });

  const leaveStats = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const yearLeaves = leaves.filter((l: any) => new Date(l.startDate).getFullYear() === currentYear);
    const approved = yearLeaves.filter((l: any) => l.status === "approved");
    const totalUsed = approved.reduce((s: number, l: any) => s + Number(l.days || 0), 0);
    const byType: Record<string, number> = {};
    approved.forEach((l: any) => { byType[l.leaveType] = (byType[l.leaveType] || 0) + Number(l.days || 0); });
    return { totalUsed, byType, pending: yearLeaves.filter((l: any) => l.status === "pending").length };
  }, [leaves]);

  const handleLeaveSubmit = () => {
    if (!leaveForm.leaveType || !leaveForm.startDate || (!leaveForm.halfDay && !leaveForm.endDate)) return;
    const endDate = leaveForm.halfDay ? leaveForm.startDate : leaveForm.endDate;
    const halfDayNote = leaveForm.halfDay ? (leaveForm.halfDay === "morning" ? " (ครึ่งวันเช้า)" : " (ครึ่งวันบ่าย)") : "";
    leaveMutation.mutate({
      leaveType: leaveForm.leaveType,
      startDate: leaveForm.startDate,
      endDate,
      days: String(leaveDays),
      reason: (leaveForm.reason || "") + halfDayNote || null,
    });
  };

  const handleOtSubmit = () => {
    if (!otForm.date || !otForm.startTime || !otForm.endTime) return;
    otMutation.mutate({
      date: otForm.date,
      otType: otForm.otType,
      startTime: new Date(`${otForm.date}T${otForm.startTime}`).toISOString(),
      endTime: new Date(`${otForm.date}T${otForm.endTime}`).toISOString(),
      hours: otHours,
      rate: otRate,
    });
  };

  const handlePrint = () => {
    if (!printRef.current) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html><html><head><title>พิมพ์เอกสาร</title>
      <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;600;700&display=swap" rel="stylesheet">
      <style>body { font-family: 'Sarabun', sans-serif; margin: 0; padding: 20px; } @media print { body { padding: 0; } }</style>
      </head><body>${printRef.current.innerHTML}</body></html>`);
    printWindow.document.close();
    const images = printWindow.document.querySelectorAll("img");
    if (images.length === 0) {
      printWindow.onload = () => { printWindow.print(); };
      return;
    }
    let loaded = 0;
    const total = images.length;
    const doPrint = () => { loaded++; if (loaded >= total) setTimeout(() => printWindow.print(), 100); };
    images.forEach((img) => {
      if (img.complete) { doPrint(); } else {
        img.addEventListener("load", doPrint);
        img.addEventListener("error", doPrint);
      }
    });
    setTimeout(() => { if (loaded < total) printWindow.print(); }, 3000);
  };

  const yearOptions = [new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1].map(y => ({ value: String(y), label: String(y) }));

  if (!employee) {
    return (
      <Layout>
        <div>
          <Card>
            <CardContent className="py-12 text-center">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">ไม่พบข้อมูลพนักงาน</h3>
              <p className="text-sm text-muted-foreground">กรุณาติดต่อฝ่ายบุคคลเพื่อลงทะเบียนข้อมูลพนักงาน</p>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-4" data-testid="ess-dashboard">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold" style={{ background: "#fb9678" }}>
            {employee.fullName?.charAt(0) || "?"}
          </div>
          <div>
            <h1 className="text-lg font-bold" data-testid="text-ess-title">บริการตนเอง (ESS)</h1>
            <p className="text-sm text-muted-foreground">{employee.fullName} - {employee.position || "พนักงาน"} | {employee.department || "-"}</p>
          </div>
        </div>

        {leaveBalanceSummary.some((b: any) => b.carriedOver > 0 && !b.carryOverExpired && b.carryOverExpiryDate) && (() => {
          const expiringItems = leaveBalanceSummary.filter((b: any) => {
            if (b.carriedOver <= 0 || b.carryOverExpired || !b.carryOverExpiryDate) return false;
            const expiry = new Date(b.carryOverExpiryDate);
            const daysLeft = Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            return daysLeft <= 30 && daysLeft > 0;
          });
          if (expiringItems.length === 0) return null;
          return (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200" data-testid="alert-carry-over-expiry">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                <div className="text-xs text-amber-700">
                  <p className="font-medium">วันลาที่ยกมาใกล้หมดอายุ</p>
                  {expiringItems.map((b: any) => {
                    const lt = LEAVE_TYPES.find(t => t.value === b.leaveType);
                    const expiry = new Date(b.carryOverExpiryDate);
                    const daysLeft = Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                    return (
                      <p key={b.leaveType}>{lt?.label || b.leaveType}: {b.carriedOver} วัน จะหมดอายุอีก {daysLeft} วัน ({b.carryOverExpiryDate})</p>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })()}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full justify-start overflow-x-auto" data-testid="ess-tabs">
            <TabsTrigger value="overview" data-testid="tab-overview">ภาพรวม</TabsTrigger>
            <TabsTrigger value="leave" data-testid="tab-leave">วันลา</TabsTrigger>
            <TabsTrigger value="ot" data-testid="tab-ot">ขอ OT</TabsTrigger>
            <TabsTrigger value="documents" data-testid="tab-documents">เอกสาร</TabsTrigger>
          </TabsList>

          {/* ===== OVERVIEW TAB ===== */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card data-testid="card-profile">
                <CardHeader className="pb-2"><CardTitle className="text-sm">ข้อมูลส่วนตัว</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">รหัสพนักงาน</span><span className="font-medium">{employee.employeeCode}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">ชื่อ-นามสกุล</span><span className="font-medium">{employee.fullName}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">ตำแหน่ง</span><span className="font-medium">{employee.position || "-"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">แผนก</span><span className="font-medium">{employee.department || "-"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">วันเริ่มงาน</span><span className="font-medium">{employee.startDate ? formatDate(employee.startDate, dateEra, dateFmt) : "-"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">อายุงาน</span><span className="font-medium">{calcYearsMonths(employee.startDate)}</span></div>
                </CardContent>
              </Card>

              <Card data-testid="card-leave-summary">
                <CardHeader className="pb-2"><CardTitle className="text-sm">สรุปวันลาปีนี้</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">วันลาที่ใช้ไปแล้ว</span><span className="font-bold text-base" style={{ color: "#fb9678" }}>{leaveStats.totalUsed} วัน</span></div>
                  {leaveBalanceSummary.length > 0 ? leaveBalanceSummary.map((b: any) => {
                    const lt = LEAVE_TYPES.find(t => t.value === b.leaveType);
                    const Icon = lt?.icon || CalendarDays;
                    return (
                      <div key={b.leaveType} className="space-y-0.5" data-testid={`balance-row-${b.leaveType}`}>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground flex items-center gap-1"><Icon className="w-3 h-3" /> {lt?.label || b.leaveType}</span>
                          <span className="font-medium">{b.used}/{b.quota + b.effectiveCarriedOver} <span className="text-xs text-muted-foreground">(เหลือ {b.remaining})</span></span>
                        </div>
                        {b.carriedOver > 0 && (
                          <div className="text-xs pl-4">
                            <span className={b.carryOverExpired ? "text-red-500 line-through" : "text-blue-600"}>ยกมา {b.carriedOver} วัน</span>
                            {b.carryOverExpired && <span className="text-red-500 ml-1">(หมดอายุ)</span>}
                          </div>
                        )}
                      </div>
                    );
                  }) : LEAVE_TYPES.map(lt => (
                    <div key={lt.value} className="flex justify-between items-center">
                      <span className="text-muted-foreground flex items-center gap-1"><lt.icon className="w-3 h-3" /> {lt.label}</span>
                      <span>{leaveStats.byType[lt.value] || 0} วัน</span>
                    </div>
                  ))}
                  {leaveStats.pending > 0 && (
                    <div className="pt-1 border-t">
                      <Badge className="bg-yellow-100 text-yellow-700">{leaveStats.pending} รายการรออนุมัติ</Badge>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card data-testid="card-quick-actions">
                <CardHeader className="pb-2"><CardTitle className="text-sm">ดำเนินการด่วน</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <Button className="w-full text-white hover:opacity-90" style={{ background: "#05b187" }} onClick={() => { setActiveTab("leave"); setLeaveDialogOpen(true); }} data-testid="button-quick-leave">
                    <CalendarDays className="w-4 h-4 mr-2" /> ขอลา
                  </Button>
                  <Button className="w-full text-white hover:opacity-90" style={{ background: "#03c9d7" }} onClick={() => { setActiveTab("ot"); setOtDialogOpen(true); }} data-testid="button-quick-ot">
                    <Clock className="w-4 h-4 mr-2" /> ขอ OT
                  </Button>
                  <Button className="w-full text-white hover:opacity-90" style={{ background: "var(--theme-primary)" }} onClick={() => setActiveTab("documents")} data-testid="button-quick-docs">
                    <FileText className="w-4 h-4 mr-2" /> ดาวน์โหลดเอกสาร
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Recent Pending Items */}
            <Card data-testid="card-recent-pending">
              <CardHeader className="pb-2"><CardTitle className="text-sm">รายการรออนุมัติล่าสุด</CardTitle></CardHeader>
              <CardContent>
                {[...leaves.filter((l: any) => l.status === "pending").map((l: any) => ({ ...l, type: "leave" })),
                  ...otRecords.filter((o: any) => o.status === "pending").map((o: any) => ({ ...o, type: "ot" }))
                ].length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">ไม่มีรายการรออนุมัติ</p>
                ) : (
                  <div className="space-y-2">
                    {leaves.filter((l: any) => l.status === "pending").slice(0, 3).map((l: any) => (
                      <div key={`leave-${l.id}`} className="flex items-center justify-between p-2 rounded border">
                        <div className="flex items-center gap-2">
                          <CalendarDays className="w-4 h-4" style={{ color: "#05b187" }} />
                          <span className="text-sm">{getLeaveTypeLabel(l.leaveType)} ({formatDate(l.startDate, dateEra, dateFmt)} - {formatDate(l.endDate, dateEra, dateFmt)})</span>
                        </div>
                        {statusBadge(l.status)}
                      </div>
                    ))}
                    {otRecords.filter((o: any) => o.status === "pending").slice(0, 3).map((o: any) => (
                      <div key={`ot-${o.id}`} className="flex items-center justify-between p-2 rounded border">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4" style={{ color: "#03c9d7" }} />
                          <span className="text-sm">OT {formatDate(o.date, dateEra, dateFmt)} ({Number(o.hours || 0)} ชม.)</span>
                        </div>
                        {statusBadge(o.status)}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== LEAVE TAB ===== */}
          <TabsContent value="leave" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">ประวัติวันลา</h2>
              <Button style={{ background: "#05b187" }} className="text-white hover:opacity-90" onClick={() => setLeaveDialogOpen(true)} data-testid="button-new-leave">
                <Plus className="w-4 h-4 mr-1" /> ขอลา
              </Button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {leaveBalanceSummary.length > 0 ? leaveBalanceSummary.map((b: any) => {
                const lt = LEAVE_TYPES.find(t => t.value === b.leaveType);
                const Icon = lt?.icon || CalendarDays;
                const color = lt?.color || "#03c9d7";
                return (
                  <Card key={b.leaveType} className="text-center" data-testid={`card-balance-${b.leaveType}`}>
                    <CardContent className="py-3">
                      <Icon className="w-5 h-5 mx-auto mb-1" style={{ color }} />
                      <p className="text-xs text-muted-foreground">{lt?.label || b.leaveType}</p>
                      <p className="text-lg font-bold" style={{ color }}>{b.remaining}</p>
                      <p className="text-xs text-muted-foreground">เหลือ / {b.quota + b.effectiveCarriedOver} วัน</p>
                      <p className="text-xs text-muted-foreground">(ใช้ไป {b.used})</p>
                      {b.carriedOver > 0 && (
                        <p className={`text-xs mt-0.5 ${b.carryOverExpired ? "text-red-500" : "text-blue-500"}`}>
                          {b.carryOverExpired ? "ยกมาหมดอายุ" : `ยกมา ${b.carriedOver} วัน`}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              }) : LEAVE_TYPES.map(lt => (
                <Card key={lt.value} className="text-center">
                  <CardContent className="py-3">
                    <lt.icon className="w-5 h-5 mx-auto mb-1" style={{ color: lt.color }} />
                    <p className="text-xs text-muted-foreground">{lt.label}</p>
                    <p className="text-lg font-bold">{leaveStats.byType[lt.value] || 0}</p>
                    <p className="text-xs text-muted-foreground">วัน</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-sm">ประเภท</TableHead>
                      <TableHead className="text-sm">วันที่เริ่ม</TableHead>
                      <TableHead className="text-sm">วันที่สิ้นสุด</TableHead>
                      <TableHead className="text-sm text-center">จำนวนวัน</TableHead>
                      <TableHead className="text-sm">เหตุผล</TableHead>
                      <TableHead className="text-sm text-center">สถานะ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaves.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-8 text-sm text-muted-foreground">ยังไม่มีประวัติการลา</TableCell></TableRow>
                    ) : leaves.map((l: any) => (
                      <TableRow key={l.id} data-testid={`row-leave-${l.id}`}>
                        <TableCell className="text-sm">{getLeaveTypeLabel(l.leaveType)}</TableCell>
                        <TableCell className="text-sm">{formatDate(l.startDate, dateEra, dateFmt)}</TableCell>
                        <TableCell className="text-sm">{formatDate(l.endDate, dateEra, dateFmt)}</TableCell>
                        <TableCell className="text-sm text-center">{Number(l.days || 0)}</TableCell>
                        <TableCell className="text-sm">{l.reason || "-"}</TableCell>
                        <TableCell className="text-sm text-center">{statusBadge(l.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== OT TAB ===== */}
          <TabsContent value="ot" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">ประวัติการขอ OT</h2>
              <Button style={{ background: "#03c9d7" }} className="text-white hover:opacity-90" onClick={() => setOtDialogOpen(true)} data-testid="button-new-ot">
                <Plus className="w-4 h-4 mr-1" /> ขอ OT
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Card className="text-center">
                <CardContent className="py-3">
                  <Timer className="w-5 h-5 mx-auto mb-1" style={{ color: "#03c9d7" }} />
                  <p className="text-xs text-muted-foreground">OT ทั้งหมด (อนุมัติ)</p>
                  <p className="text-lg font-bold">{otRecords.filter((o: any) => o.status === "approved").reduce((s: number, o: any) => s + Number(o.hours || 0), 0)} ชม.</p>
                </CardContent>
              </Card>
              <Card className="text-center">
                <CardContent className="py-3">
                  <Clock className="w-5 h-5 mx-auto mb-1" style={{ color: "#fec90f" }} />
                  <p className="text-xs text-muted-foreground">รออนุมัติ</p>
                  <p className="text-lg font-bold">{otRecords.filter((o: any) => o.status === "pending").length} รายการ</p>
                </CardContent>
              </Card>
              <Card className="text-center">
                <CardContent className="py-3">
                  <CheckCircle className="w-5 h-5 mx-auto mb-1" style={{ color: "#05b187" }} />
                  <p className="text-xs text-muted-foreground">ค่า OT รวม (อนุมัติ)</p>
                  <p className="text-lg font-bold">{fmt(otRecords.filter((o: any) => o.status === "approved").reduce((s: number, o: any) => s + Number(o.amount || 0), 0))} ฿</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-sm">วันที่</TableHead>
                      <TableHead className="text-sm">ประเภท</TableHead>
                      <TableHead className="text-sm text-center">ชั่วโมง</TableHead>
                      <TableHead className="text-sm text-center">อัตรา</TableHead>
                      <TableHead className="text-sm text-right">จำนวนเงิน</TableHead>
                      <TableHead className="text-sm text-center">สถานะ</TableHead>
                      <TableHead className="text-sm text-center w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {otRecords.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-8 text-sm text-muted-foreground">ยังไม่มีประวัติ OT</TableCell></TableRow>
                    ) : otRecords.map((o: any) => (
                      <TableRow key={o.id} data-testid={`row-ot-${o.id}`}>
                        <TableCell className="text-sm">{formatDate(o.date, dateEra, dateFmt)}</TableCell>
                        <TableCell className="text-sm">{o.otType === "holiday" ? "วันหยุด (x3)" : "ปกติ (x1.5)"}</TableCell>
                        <TableCell className="text-sm text-center">{Number(o.hours || 0)}</TableCell>
                        <TableCell className="text-sm text-center">{Number(o.rate || 0)}x</TableCell>
                        <TableCell className="text-sm text-right">{fmt(Number(o.amount || 0))}</TableCell>
                        <TableCell className="text-sm text-center">{statusBadge(o.status)}</TableCell>
                        <TableCell className="text-sm text-center">
                          {o.status === "pending" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-red-500 hover:text-red-700 hover:bg-red-50"
                              onClick={() => { if (confirm("ต้องการยกเลิกคำขอ OT นี้?")) cancelOtMutation.mutate(o.id); }}
                              disabled={cancelOtMutation.isPending}
                              data-testid={`btn-cancel-ot-${o.id}`}
                            >
                              ยกเลิก
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== DOCUMENTS TAB ===== */}
          <TabsContent value="documents" className="space-y-4">
            <div className="flex items-center gap-4 mb-2">
              <h2 className="text-base font-semibold">เอกสารของฉัน</h2>
              <Select value={docYear} onValueChange={setDocYear}>
                <SelectTrigger className="w-32" data-testid="select-doc-year"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {yearOptions.map(y => <SelectItem key={y.value} value={y.value}>{y.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setDocType("payslip")} data-testid="card-payslip">
                <CardContent className="py-6 text-center">
                  <FileText className="w-8 h-8 mx-auto mb-2" style={{ color: "#fb9678" }} />
                  <p className="font-semibold text-sm">สลิปเงินเดือน</p>
                  <p className="text-xs text-muted-foreground mt-1">{payslips.length} รายการในปี {docYear}</p>
                </CardContent>
              </Card>
              <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setDocType("salary-cert")} data-testid="card-salary-cert">
                <CardContent className="py-6 text-center">
                  <FileText className="w-8 h-8 mx-auto mb-2" style={{ color: "#05b187" }} />
                  <p className="font-semibold text-sm">หนังสือรับรองเงินเดือน</p>
                  <p className="text-xs text-muted-foreground mt-1">ออกเอกสารได้ทันที</p>
                </CardContent>
              </Card>
              <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setDocType("work-cert")} data-testid="card-work-cert">
                <CardContent className="py-6 text-center">
                  <FileText className="w-8 h-8 mx-auto mb-2" style={{ color: "var(--theme-primary)" }} />
                  <p className="font-semibold text-sm">หนังสือรับรองการทำงาน</p>
                  <p className="text-xs text-muted-foreground mt-1">ออกเอกสารได้ทันที</p>
                </CardContent>
              </Card>
              <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setDocType("fifty-tawi")} data-testid="card-fifty-tawi">
                <CardContent className="py-6 text-center">
                  <FileText className="w-8 h-8 mx-auto mb-2" style={{ color: "#03c9d7" }} />
                  <p className="font-semibold text-sm">50 ทวิ</p>
                  <p className="text-xs text-muted-foreground mt-1">หนังสือรับรองการหักภาษี ณ ที่จ่าย</p>
                </CardContent>
              </Card>
            </div>

            {/* Payslip List */}
            {docType === "payslip" && (
              <Card data-testid="card-payslip-list">
                <CardHeader className="pb-2"><CardTitle className="text-sm">สลิปเงินเดือน ปี {docYear}</CardTitle></CardHeader>
                <CardContent>
                  {payslips.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">ยังไม่มีข้อมูลเงินเดือนในปีนี้</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-sm">เดือน</TableHead>
                          <TableHead className="text-sm text-right">เงินเดือน</TableHead>
                          <TableHead className="text-sm text-right">รายได้รวม</TableHead>
                          <TableHead className="text-sm text-right">หัก</TableHead>
                          <TableHead className="text-sm text-right">สุทธิ</TableHead>
                          <TableHead className="text-sm text-center">สถานะ</TableHead>
                          <TableHead className="text-sm text-center">ดู</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payslips.map((p: any) => (
                          <TableRow key={p.id} data-testid={`row-payslip-${p.id}`}>
                            <TableCell className="text-sm">{MONTHS.find(m => m.value === String(p.month))?.label || p.month}</TableCell>
                            <TableCell className="text-sm text-right">{fmt(Number(p.baseSalary || 0))}</TableCell>
                            <TableCell className="text-sm text-right">{fmt(Number(p.totalEarnings || 0))}</TableCell>
                            <TableCell className="text-sm text-right">{fmt(Number(p.totalDeductions || 0))}</TableCell>
                            <TableCell className="text-sm text-right font-bold">{fmt(Number(p.netPay || 0))}</TableCell>
                            <TableCell className="text-sm text-center">
                              {p.status === "approved" ? <Badge className="bg-green-100 text-green-700">อนุมัติ</Badge> :
                               p.status === "draft" ? <Badge className="bg-gray-100 text-gray-700">แบบร่าง</Badge> :
                               <Badge className="bg-blue-100 text-blue-700">{p.status}</Badge>}
                            </TableCell>
                            <TableCell className="text-sm text-center">
                              <Button size="sm" variant="outline" onClick={() => { setDocMonth(String(p.month)); setDocType("payslip-detail"); }} data-testid={`button-view-payslip-${p.id}`}>
                                <Printer className="w-3 h-3" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Payslip Detail / Print */}
            {docType === "payslip-detail" && (() => {
              const slip = payslips.find((p: any) => String(p.month) === docMonth);
              if (!slip) return <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">ไม่พบข้อมูลสลิป</CardContent></Card>;
              return (
                <Card data-testid="card-payslip-detail">
                  <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm">สลิปเงินเดือน {MONTHS.find(m => m.value === docMonth)?.label} {Number(docYear) + 543}</CardTitle>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setDocType("payslip")} data-testid="button-back-payslip">กลับ</Button>
                      <Button size="sm" style={{ background: "#fb9678" }} className="text-white hover:opacity-90" onClick={handlePrint} data-testid="button-print-payslip"><Printer className="w-3 h-3 mr-1" /> พิมพ์</Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div ref={printRef}>
                      <PayslipPreview employee={employee} company={company} slip={slip} month={docMonth} year={docYear} allPayslips={payslips} logoUrl={docSettings?.showLogo !== false ? objectPathToUrl(docSettings?.logoUrl) || undefined : undefined} />
                    </div>
                  </CardContent>
                </Card>
              );
            })()}

            {/* Salary Certificate */}
            {docType === "salary-cert" && (
              <Card data-testid="card-salary-cert-preview">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm">หนังสือรับรองเงินเดือน</CardTitle>
                  <Button size="sm" style={{ background: "#05b187" }} className="text-white hover:opacity-90" onClick={handlePrint} data-testid="button-print-salary-cert"><Printer className="w-3 h-3 mr-1" /> พิมพ์</Button>
                </CardHeader>
                <CardContent>
                  <div ref={printRef}>
                    <SalaryCertPreview employee={employee} company={company} dateEra={dateEra} dateFmt={dateFmt} signerName={docSettings?.certSignerName} signerPosition={docSettings?.certSignerPosition} />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Work Certificate */}
            {docType === "work-cert" && (
              <Card data-testid="card-work-cert-preview">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm">หนังสือรับรองการทำงาน</CardTitle>
                  <Button size="sm" style={{ background: "var(--theme-primary)" }} className="text-white hover:opacity-90" onClick={handlePrint} data-testid="button-print-work-cert"><Printer className="w-3 h-3 mr-1" /> พิมพ์</Button>
                </CardHeader>
                <CardContent>
                  <div ref={printRef}>
                    <WorkCertPreview employee={employee} company={company} dateEra={dateEra} dateFmt={dateFmt} signerName={docSettings?.certSignerName} signerPosition={docSettings?.certSignerPosition} />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 50 ทวิ */}
            {docType === "fifty-tawi" && (
              <Card data-testid="card-fifty-tawi-preview">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm">50 ทวิ - หนังสือรับรองการหักภาษี ณ ที่จ่าย ปี {Number(docYear) + 543}</CardTitle>
                  <Button size="sm" style={{ background: "#03c9d7" }} className="text-white hover:opacity-90" onClick={handlePrint} data-testid="button-print-fifty-tawi"><Printer className="w-3 h-3 mr-1" /> พิมพ์</Button>
                </CardHeader>
                <CardContent>
                  <div ref={printRef}>
                    <FiftyTawiPreview employee={employee} company={company} data={fiftyTawiData} year={docYear} />
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* ===== LEAVE REQUEST DIALOG ===== */}
        <Dialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
          <DialogContent className="max-w-md" data-testid="dialog-leave-request">
            <DialogHeader><DialogTitle>ขออนุมัติลา</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">ประเภทการลา *</label>
                <Select value={leaveForm.leaveType} onValueChange={v => setLeaveForm(f => ({ ...f, leaveType: v }))}>
                  <SelectTrigger data-testid="select-leave-type"><SelectValue placeholder="เลือกประเภท" /></SelectTrigger>
                  <SelectContent>
                    {LEAVE_TYPES.map(lt => <SelectItem key={lt.value} value={lt.value}>{lt.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">ระยะเวลา</label>
                <div className="flex gap-2 mt-1">
                  <Button type="button" variant={!leaveForm.halfDay ? "default" : "outline"} size="sm" className={!leaveForm.halfDay ? "flex-1 text-white" : "flex-1"} style={!leaveForm.halfDay ? { background: "#fb9678" } : {}} onClick={() => setLeaveForm(f => ({ ...f, halfDay: "" }))} data-testid="btn-fullday">
                    เต็มวัน
                  </Button>
                  <Button type="button" variant={leaveForm.halfDay === "morning" ? "default" : "outline"} size="sm" className={leaveForm.halfDay === "morning" ? "flex-1 text-white" : "flex-1"} style={leaveForm.halfDay === "morning" ? { background: "#03c9d7" } : {}} onClick={() => setLeaveForm(f => ({ ...f, halfDay: "morning", endDate: f.startDate }))} data-testid="btn-halfday-morning">
                    ครึ่งวันเช้า
                  </Button>
                  <Button type="button" variant={leaveForm.halfDay === "afternoon" ? "default" : "outline"} size="sm" className={leaveForm.halfDay === "afternoon" ? "flex-1 text-white" : "flex-1"} style={leaveForm.halfDay === "afternoon" ? { background: "#03c9d7" } : {}} onClick={() => setLeaveForm(f => ({ ...f, halfDay: "afternoon", endDate: f.startDate }))} data-testid="btn-halfday-afternoon">
                    ครึ่งวันบ่าย
                  </Button>
                </div>
              </div>
              <div className={leaveForm.halfDay ? "grid grid-cols-1 gap-4" : "grid grid-cols-2 gap-4"}>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">{leaveForm.halfDay ? "วันที่ลา" : "วันที่เริ่ม"} *</label>
                  <ThaiDateInput value={leaveForm.startDate} onChange={(v: string) => setLeaveForm(f => ({ ...f, startDate: v, ...(f.halfDay ? { endDate: v } : {}) }))} dateEra={dateEra} dateFmt={dateFmt} data-testid="input-leave-start" />
                </div>
                {!leaveForm.halfDay && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">วันที่สิ้นสุด *</label>
                    <ThaiDateInput value={leaveForm.endDate} onChange={(v: string) => setLeaveForm(f => ({ ...f, endDate: v }))} dateEra={dateEra} dateFmt={dateFmt} data-testid="input-leave-end" />
                  </div>
                )}
              </div>
              {leaveDays > 0 && (
                <p className="text-sm font-medium" style={{ color: "#fb9678" }}>
                  จำนวน {leaveDays} วัน
                  {leaveForm.halfDay && <span className="ml-1" style={{ color: "#03c9d7" }}>({leaveForm.halfDay === "morning" ? "เช้า" : "บ่าย"})</span>}
                </p>
              )}
              <div>
                <label className="text-xs font-medium text-muted-foreground">เหตุผล</label>
                <Textarea value={leaveForm.reason} onChange={e => setLeaveForm(f => ({ ...f, reason: e.target.value }))} placeholder="ระบุเหตุผล (ไม่บังคับ)" data-testid="input-leave-reason" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setLeaveDialogOpen(false)} data-testid="button-cancel-leave">ยกเลิก</Button>
                <Button
                  onClick={handleLeaveSubmit}
                  disabled={leaveMutation.isPending || !leaveForm.leaveType || !leaveForm.startDate || (!leaveForm.halfDay && !leaveForm.endDate) || leaveDays <= 0}
                  style={{ background: "#05b187" }}
                  className="text-white hover:opacity-90"
                  data-testid="button-submit-leave"
                >
                  {leaveMutation.isPending ? "กำลังส่ง..." : "ส่งใบลา"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* ===== OT REQUEST DIALOG ===== */}
        <Dialog open={otDialogOpen} onOpenChange={setOtDialogOpen}>
          <DialogContent className="max-w-md" data-testid="dialog-ot-request">
            <DialogHeader><DialogTitle>ขออนุมัติทำ OT</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">วันที่ *</label>
                <ThaiDateInput value={otForm.date} onChange={(v: string) => setOtForm(f => ({ ...f, date: v }))} dateEra={dateEra} dateFmt={dateFmt} data-testid="input-ot-date" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">ประเภท OT</label>
                <Select value={otForm.otType} onValueChange={v => setOtForm(f => ({ ...f, otType: v }))}>
                  <SelectTrigger data-testid="select-ot-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="regular">OT ปกติ (x1.5)</SelectItem>
                    <SelectItem value="holiday">OT วันหยุด (x3.0)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">เวลาเริ่ม *</label>
                  <Input type="time" value={otForm.startTime} onChange={e => setOtForm(f => ({ ...f, startTime: e.target.value }))} data-testid="input-ot-start" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">เวลาสิ้นสุด *</label>
                  <Input type="time" value={otForm.endTime} onChange={e => setOtForm(f => ({ ...f, endTime: e.target.value }))} data-testid="input-ot-end" />
                </div>
              </div>
              {otHours > 0 && (
                <div className="bg-gray-50 rounded p-3 space-y-1 text-sm">
                  <div className="flex justify-between"><span>จำนวน</span><span>{otHours} ชั่วโมง</span></div>
                  <div className="flex justify-between"><span>อัตรา</span><span>{otRate}x</span></div>
                  <div className="flex justify-between font-bold" style={{ color: "#03c9d7" }}><span>ค่า OT โดยประมาณ</span><span>{fmt(otAmount)} ฿</span></div>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setOtDialogOpen(false)} data-testid="button-cancel-ot">ยกเลิก</Button>
                <Button
                  onClick={handleOtSubmit}
                  disabled={otMutation.isPending || !otForm.date || !otForm.startTime || !otForm.endTime || otHours <= 0}
                  style={{ background: "#03c9d7" }}
                  className="text-white hover:opacity-90"
                  data-testid="button-submit-ot"
                >
                  {otMutation.isPending ? "กำลังส่ง..." : "ส่งคำขอ OT"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}

/* ===== Document Preview Components ===== */

function PayslipPreview({ employee, company, slip, month, year, allPayslips, logoUrl }: { employee: any; company: any; slip: any; month: string; year: string; allPayslips?: any[]; logoUrl?: string }) {
  const monthLabel = MONTHS.find(m => m.value === month)?.label || month;
  const yearBE = Number(year) + 543;
  let payDateStr: string;
  if (slip.paidDate) {
    const pd = new Date(slip.paidDate + "T00:00:00");
    payDateStr = `${String(pd.getDate()).padStart(2, "0")}/${String(pd.getMonth() + 1).padStart(2, "0")}/${pd.getFullYear() + 543}`;
  } else {
    const lastDay = new Date(Number(year), Number(month), 0);
    payDateStr = `${String(lastDay.getDate()).padStart(2, "0")}/${String(lastDay.getMonth() + 1).padStart(2, "0")}/${yearBE}`;
  }

  const priorSlips = (allPayslips || []).filter((p: any) => Number(p.month) <= Number(month));
  const ytdEarnings = priorSlips.reduce((s: number, p: any) => s + Number(p.totalEarnings || 0), 0) || Number(slip.totalEarnings || 0);
  const ytdTax = priorSlips.reduce((s: number, p: any) => s + Number(p.withholdingTax || 0), 0) || Number(slip.withholdingTax || 0);
  const ytdSocialSecurity = priorSlips.reduce((s: number, p: any) => s + Number(p.socialSecurity || 0), 0) || Number(slip.socialSecurity || 0);
  const ytdDeductions = ytdTax + ytdSocialSecurity;

  const extraEarnings: any[] = slip.extraEarnings || [];
  const extraDeductions: any[] = slip.extraDeductions || [];

  const baseSal = Number(slip.baseSalary || 0);
  const otAmt = Number(slip.otAmount || 0);
  const extraEarnArr = extraEarnings.map((item: any) => ({ label: item.label, amount: Number(item.amount || 0) }));
  const extraEarnSum = extraEarnArr.reduce((s: number, i: any) => s + i.amount, 0);
  const unaccounted = Number(slip.totalEarnings || 0) - baseSal - otAmt - extraEarnSum;
  const earningRows: { label: string; amount: number }[] = [
    { label: "อัตราเงินเดือน", amount: baseSal },
    ...(otAmt > 0 ? [{ label: "ค่าล่วงเวลา (OT)", amount: otAmt }] : []),
    ...extraEarnArr,
    ...(unaccounted > 0.5 ? [{ label: "รายได้อื่น", amount: unaccounted }] : []),
  ];
  const deductionRows: { label: string; amount: number }[] = [
    ...(Number(slip.socialSecurity || 0) > 0 ? [{ label: "ประกันสังคม", amount: Number(slip.socialSecurity || 0) }] : []),
    ...(Number(slip.withholdingTax || 0) > 0 ? [{ label: "ภาษีหัก ณ ที่จ่าย", amount: Number(slip.withholdingTax || 0) }] : []),
    ...extraDeductions.map((item: any) => ({ label: item.label, amount: Number(item.amount || 0) })),
  ];
  const maxRows = Math.max(earningRows.length, deductionRows.length, 3);
  const bdr = "1px solid #fb9678";
  const bdrLight = "1px solid #f5c4b3";
  const cellBase: React.CSSProperties = { padding: "5px 8px", fontSize: "12px", border: bdrLight };

  return (
    <div style={{ fontFamily: "'Sarabun', sans-serif", fontSize: "13px", padding: "24px", background: "#f3f4f6", color: "black", maxWidth: "640px", margin: "0 auto" }}>
      <div style={{ background: "white", border: bdr, overflow: "hidden" }}>

        <div style={{ display: "flex", alignItems: "center", padding: "16px 20px", borderBottom: bdr }}>
          {logoUrl && (
            <div style={{ width: "60px", height: "60px", borderRadius: "50%", overflow: "hidden", marginRight: "16px", flexShrink: 0, background: "#fb967815", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <img src={logoUrl} alt="" style={{ height: "48px", objectFit: "contain" }} />
            </div>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "14px", fontWeight: 600 }}>{company?.name || "บริษัท"}</div>
            {company?.address && <div style={{ fontSize: "11px", color: "#666" }}>{company.address}</div>}
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "22px", fontWeight: "bold", color: "#fb9678", lineHeight: 1.2 }}>Payroll Slip</div>
            <div style={{ fontSize: "14px", color: "#fb9678" }}>ใบแจ้งเงินเดือน</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: bdr }}>
          <div style={{ padding: "10px 16px", borderRight: bdr }}>
            <div style={{ fontSize: "11px", marginBottom: "6px" }}>
              <span style={{ fontWeight: 600 }}>รหัสพนักงาน :</span>
              <span style={{ color: "#444", marginLeft: "4px" }}>{employee.employeeCode || "-"}</span>
              <span style={{ display: "block", fontSize: "10px", color: "#999" }}>Employee ID</span>
            </div>
            <div style={{ fontSize: "11px", marginBottom: "6px" }}>
              <span style={{ fontWeight: 600 }}>ชื่อพนักงาน :</span>
              <span style={{ color: "#444", marginLeft: "4px" }}>{employee.fullName || "-"}</span>
              <span style={{ display: "block", fontSize: "10px", color: "#999" }}>Employee Name</span>
            </div>
            <div style={{ fontSize: "11px" }}>
              <span style={{ fontWeight: 600 }}>ตำแหน่งงาน :</span>
              <span style={{ color: "#444", marginLeft: "4px" }}>{employee.position || "-"}</span>
              <span style={{ display: "block", fontSize: "10px", color: "#999" }}>Position</span>
            </div>
          </div>
          <div style={{ padding: "10px 16px" }}>
            <div style={{ fontSize: "11px", marginBottom: "6px" }}>
              <span style={{ fontWeight: 600 }}>ประจำงวด :</span>
              <span style={{ color: "#444", marginLeft: "4px" }}>{monthLabel} {yearBE}</span>
              <span style={{ display: "block", fontSize: "10px", color: "#999" }}>For Period</span>
            </div>
            <div style={{ fontSize: "11px", marginBottom: "6px" }}>
              <span style={{ fontWeight: 600 }}>วันที่จ่าย :</span>
              <span style={{ color: "#444", marginLeft: "4px" }}>{payDateStr}</span>
              <span style={{ display: "block", fontSize: "10px", color: "#999" }}>Pay Date</span>
            </div>
            <div style={{ fontSize: "11px" }}>
              <span style={{ fontWeight: 600 }}>เลขบัญชี :</span>
              <span style={{ color: "#444", marginLeft: "4px" }}>{employee.bankAccountNumber || "-"}</span>
              <span style={{ display: "block", fontSize: "10px", color: "#999" }}>Acc. No.</span>
            </div>
          </div>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#fb9678", color: "white" }}>
              <th style={{ padding: "7px 8px", fontSize: "12px", fontWeight: 600, textAlign: "left", width: "35%", border: bdr, borderColor: "#e8856a" }}>รายการได้ (Income)</th>
              <th style={{ padding: "7px 8px", fontSize: "12px", fontWeight: 600, textAlign: "right", width: "15%", border: bdr, borderColor: "#e8856a" }}>บาท(THB)</th>
              <th style={{ padding: "7px 8px", fontSize: "12px", fontWeight: 600, textAlign: "left", width: "35%", border: bdr, borderColor: "#e8856a" }}>รายการหัก (Deduction)</th>
              <th style={{ padding: "7px 8px", fontSize: "12px", fontWeight: 600, textAlign: "right", width: "15%", border: bdr, borderColor: "#e8856a" }}>บาท(THB)</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: maxRows }).map((_, i) => (
              <tr key={i}>
                <td style={cellBase}>{earningRows[i]?.label || ""}</td>
                <td style={{ ...cellBase, textAlign: "right" }}>{earningRows[i] ? fmt(earningRows[i].amount) : ""}</td>
                <td style={cellBase}>{deductionRows[i]?.label || ""}</td>
                <td style={{ ...cellBase, textAlign: "right" }}>{deductionRows[i] ? fmt(deductionRows[i].amount) : ""}</td>
              </tr>
            ))}
            <tr style={{ fontWeight: 600, background: "#fff8f6" }}>
              <td style={{ ...cellBase, borderBottom: bdr }}>รวมรายได้</td>
              <td style={{ ...cellBase, textAlign: "right", borderBottom: bdr }}>{fmt(Number(slip.totalEarnings || 0))}</td>
              <td style={{ ...cellBase, borderBottom: bdr }}>รวมหัก</td>
              <td style={{ ...cellBase, textAlign: "right", borderBottom: bdr }}>{fmt(Number(slip.totalDeductions || 0))}</td>
            </tr>
          </tbody>
        </table>

        <div style={{ display: "flex", alignItems: "center", padding: "10px 16px", border: bdr, borderLeft: "none", borderRight: "none", background: "#fff5f2" }}>
          <div style={{ flex: 1 }}>
            <span style={{ fontWeight: 700, fontSize: "14px" }}>รวมรายได้สุทธิ ( Net Income)</span>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "20px", fontWeight: 700, color: "#fb9678" }}>฿{fmt(Number(slip.netPay || 0))}</div>
            <div style={{ fontSize: "10px", color: "#888" }}>({numberToThaiText(Number(slip.netPay || 0))})</div>
          </div>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#fb9678", color: "white" }}>
              <th style={{ padding: "7px 4px", fontSize: "11px", fontWeight: 600, textAlign: "center", width: "25%", border: "1px solid #e8856a" }}>
                <div>เงินได้สะสม</div><div style={{ fontSize: "10px", opacity: 0.85 }}>(YTD Income)</div>
              </th>
              <th style={{ padding: "7px 4px", fontSize: "11px", fontWeight: 600, textAlign: "center", width: "25%", border: "1px solid #e8856a" }}>
                <div>เงินหักสะสม</div><div style={{ fontSize: "10px", opacity: 0.85 }}>(YTD Deduction)</div>
              </th>
              <th style={{ padding: "7px 4px", fontSize: "11px", fontWeight: 600, textAlign: "center", width: "25%", border: "1px solid #e8856a" }}>
                <div>ภาษีสะสม</div><div style={{ fontSize: "10px", opacity: 0.85 }}>(YTD TAX)</div>
              </th>
              <th style={{ padding: "7px 4px", fontSize: "11px", fontWeight: 600, textAlign: "center", width: "25%", border: "1px solid #e8856a" }}>
                <div>ประกันสังคมสะสม</div><div style={{ fontSize: "10px", opacity: 0.85 }}>(YTD Social Security)</div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: "8px 4px", textAlign: "center", fontSize: "13px", fontWeight: 600, border: bdrLight }}>฿{fmt(ytdEarnings)}</td>
              <td style={{ padding: "8px 4px", textAlign: "center", fontSize: "13px", fontWeight: 600, border: bdrLight }}>฿{fmt(ytdDeductions)}</td>
              <td style={{ padding: "8px 4px", textAlign: "center", fontSize: "13px", fontWeight: 600, border: bdrLight }}>฿{fmt(ytdTax)}</td>
              <td style={{ padding: "8px 4px", textAlign: "center", fontSize: "13px", fontWeight: 600, border: bdrLight }}>฿{fmt(ytdSocialSecurity)}</td>
            </tr>
          </tbody>
        </table>

      </div>
    </div>
  );
}

function SalaryCertPreview({ employee, company, dateEra, dateFmt, signerName, signerPosition }: { employee: any; company: any; dateEra: string; dateFmt: string; signerName?: string; signerPosition?: string }) {
  const today = new Date();
  const thaiMonths = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
  const todayStr = `${today.getDate()} ${thaiMonths[today.getMonth()]} ${today.getFullYear() + 543}`;
  const salary = Number(employee.baseSalary || 0);
  const monthLabel = thaiMonths[today.getMonth()];
  const yearBE = today.getFullYear() + 543;

  return (
    <div className="salary-cert-page" style={{ width: "210mm", minHeight: "297mm", fontFamily: "'Sarabun', sans-serif", fontSize: "14px", padding: "15mm 20mm", lineHeight: 1.8, background: "white", color: "black", position: "relative", boxSizing: "border-box", margin: "0 auto" }}>
      <style>{`@media print { @page { size: A4 portrait; margin: 10mm; } body { background: white !important; } .salary-cert-page { width: 100% !important; min-height: auto !important; padding: 10mm 15mm !important; border: none !important; } }`}</style>
      <div style={{ textAlign: "center", marginBottom: "24px" }}>
        <h2 style={{ fontSize: "20px", fontWeight: "bold", color: "#1a365d" }}>{company?.name || "บริษัท"}</h2>
        {company?.address && <p style={{ fontSize: "13px", color: "#555", marginTop: "4px" }}>{company.address}</p>}
        {company?.taxId && <p style={{ fontSize: "13px", color: "#555" }}>เลขประจำตัวผู้เสียภาษี: {company.taxId}</p>}
      </div>
      <div style={{ textAlign: "center", marginBottom: "32px" }}>
        <h3 style={{ fontSize: "18px", fontWeight: "bold", textDecoration: "underline" }}>หนังสือรับรองเงินเดือน</h3>
        <p style={{ fontSize: "13px", color: "#666", marginTop: "4px" }}>Salary Certificate</p>
      </div>
      <div style={{ fontSize: "14px", lineHeight: 2 }}>
        <p style={{ textIndent: "4em" }}>
          หนังสือฉบับนี้ออกให้เพื่อรับรองว่า <strong>{employee.fullName}</strong>{" "}
          รหัสพนักงาน <strong>{employee.employeeCode}</strong>{" "}
          ตำแหน่ง <strong>{employee.position || "-"}</strong>{" "}
          แผนก <strong>{employee.department || "-"}</strong>{" "}
          เป็นพนักงานของ <strong>{company?.name || "บริษัท"}</strong>{" "}
          ตั้งแต่วันที่ <strong>{employee.startDate ? formatDate(employee.startDate, dateEra, dateFmt) : "-"}</strong> - จนถึงปัจจุบัน
        </p>
        <p style={{ textIndent: "4em", marginTop: "8px" }}>
          ณ เดือน{monthLabel} พ.ศ. {yearBE} ได้รับเงินเดือน เดือนละ <strong>{fmt(salary)}</strong> บาท ({numberToThaiText(salary)})
        </p>
        <p style={{ textIndent: "4em", marginTop: "8px" }}>
          หนังสือฉบับนี้ออกให้เพื่อใช้ในการติดต่อธุรกรรมทั่วไป โดยบริษัทไม่รับผิดชอบในหนี้สินหรือภาระผูกพันใดๆ ที่พนักงานผู้นี้อาจก่อขึ้น
        </p>
      </div>
      <div style={{ marginTop: "48px", textAlign: "right", paddingRight: "20px" }}>
        <p>ออกให้ ณ วันที่ {todayStr}</p>
        <div style={{ marginTop: "60px", textAlign: "center", display: "inline-block", width: "200px" }}>
          <div style={{ borderBottom: "1px solid #666", width: "100%", marginBottom: "8px" }}></div>
          {signerName ? (
            <>
              <p style={{ fontSize: "13px", fontWeight: "bold" }}>({signerName})</p>
              {signerPosition && <p style={{ fontSize: "12px", color: "#555", marginTop: "2px" }}>{signerPosition}</p>}
              <p style={{ fontSize: "12px", color: "#888", marginTop: "2px" }}>ผู้มีอำนาจลงนาม</p>
            </>
          ) : (
            <p style={{ fontSize: "13px" }}>ลงชื่อ ผู้มีอำนาจลงนาม</p>
          )}
          <p style={{ fontSize: "12px", color: "#888", marginTop: "4px" }}>(ตราประทับบริษัท)</p>
        </div>
      </div>
    </div>
  );
}

function WorkCertPreview({ employee, company, dateEra, dateFmt, signerName, signerPosition }: { employee: any; company: any; dateEra: string; dateFmt: string; signerName?: string; signerPosition?: string }) {
  const today = new Date();
  const thaiMonths = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
  const todayStr = `${today.getDate()} ${thaiMonths[today.getMonth()]} ${today.getFullYear() + 543}`;

  return (
    <div className="work-cert-page" style={{ width: "210mm", minHeight: "297mm", fontFamily: "'Sarabun', sans-serif", fontSize: "14px", padding: "15mm 20mm", lineHeight: 1.8, background: "white", color: "black", position: "relative", boxSizing: "border-box", margin: "0 auto" }}>
      <style>{`@media print { @page { size: A4 portrait; margin: 10mm; } body { background: white !important; } .work-cert-page { width: 100% !important; min-height: auto !important; padding: 10mm 15mm !important; border: none !important; } }`}</style>
      <div style={{ textAlign: "center", marginBottom: "24px" }}>
        <h2 style={{ fontSize: "20px", fontWeight: "bold", color: "#1a365d" }}>{company?.name || "บริษัท"}</h2>
        {company?.address && <p style={{ fontSize: "13px", color: "#555", marginTop: "4px" }}>{company.address}</p>}
        {company?.taxId && <p style={{ fontSize: "13px", color: "#555" }}>เลขประจำตัวผู้เสียภาษี: {company.taxId}</p>}
      </div>
      <div style={{ textAlign: "center", marginBottom: "32px" }}>
        <h3 style={{ fontSize: "18px", fontWeight: "bold", textDecoration: "underline" }}>หนังสือรับรองการทำงาน</h3>
        <p style={{ fontSize: "13px", color: "#666", marginTop: "4px" }}>Employment Certificate</p>
      </div>
      <div style={{ fontSize: "14px", lineHeight: 2 }}>
        <p style={{ textIndent: "4em" }}>
          หนังสือฉบับนี้ออกให้เพื่อรับรองว่า <strong>{employee.fullName}</strong>{" "}
          รหัสพนักงาน <strong>{employee.employeeCode}</strong>{" "}
          เป็นพนักงานของ <strong>{company?.name || "บริษัท"}</strong>{" "}
          ตำแหน่ง <strong>{employee.position || "-"}</strong>{" "}
          แผนก <strong>{employee.department || "-"}</strong>{" "}
          ตั้งแต่วันที่ <strong>{employee.startDate ? formatDate(employee.startDate, dateEra, dateFmt) : "-"}</strong> จนถึงปัจจุบัน
          {employee.startDate && <> รวมระยะเวลาทำงาน <strong>{calcYearsMonths(employee.startDate)}</strong></>}
        </p>
        <p style={{ textIndent: "4em", marginTop: "8px" }}>
          ตลอดระยะเวลาที่ทำงาน มีความประพฤติเรียบร้อย ขยันหมั่นเพียร ปฏิบัติหน้าที่ด้วยความรับผิดชอบ
        </p>
        <p style={{ textIndent: "4em", marginTop: "8px" }}>
          หนังสือฉบับนี้ออกให้เพื่อเป็นหลักฐานตามคำร้องขอ
        </p>
      </div>
      <div style={{ marginTop: "48px", textAlign: "right", paddingRight: "20px" }}>
        <p>ออกให้ ณ วันที่ {todayStr}</p>
        <div style={{ marginTop: "60px", textAlign: "center", display: "inline-block", width: "200px" }}>
          <div style={{ borderBottom: "1px solid #666", width: "100%", marginBottom: "8px" }}></div>
          {signerName ? (
            <>
              <p style={{ fontSize: "13px", fontWeight: "bold" }}>({signerName})</p>
              {signerPosition && <p style={{ fontSize: "12px", color: "#555", marginTop: "2px" }}>{signerPosition}</p>}
              <p style={{ fontSize: "12px", color: "#888", marginTop: "2px" }}>ผู้มีอำนาจลงนาม</p>
            </>
          ) : (
            <p style={{ fontSize: "13px" }}>ลงชื่อ ผู้มีอำนาจลงนาม</p>
          )}
          <p style={{ fontSize: "12px", color: "#888", marginTop: "4px" }}>(ตราประทับบริษัท)</p>
        </div>
      </div>
    </div>
  );
}

function TaxIdBoxesESS({ taxId }: { taxId: string }) {
  const digits = (taxId || "").replace(/\D/g, "").padEnd(13, " ").slice(0, 13).split("");
  const groups = [[digits[0]], [digits[1], digits[2], digits[3], digits[4]], [digits[5], digits[6], digits[7], digits[8], digits[9]], [digits[10], digits[11]], [digits[12]]];
  return (
    <span style={{ display: "inline-flex", alignItems: "center" }}>
      {groups.map((g, gi) => (
        <span key={gi} style={{ display: "inline-flex", alignItems: "center" }}>
          {gi > 0 && <span style={{ margin: "0 1px", fontSize: "9px", fontWeight: "bold" }}>-</span>}
          {g.map((d, di) => (
            <span key={di} style={{ display: "inline-block", width: "14px", height: "16px", border: "1px solid black", textAlign: "center", fontSize: "10px", lineHeight: "16px", fontWeight: 500 }}>{d.trim()}</span>
          ))}
        </span>
      ))}
    </span>
  );
}

function CBBox({ checked }: { checked: boolean }) {
  return (
    <span style={{ display: "inline-block", width: "11px", height: "11px", border: "1px solid black", textAlign: "center", lineHeight: "11px", fontSize: "9px", fontWeight: "bold", verticalAlign: "middle", marginRight: "2px" }}>
      {checked ? "✓" : "\u00A0"}
    </span>
  );
}

function numberToThaiWordsESS(n: number): string {
  if (n === 0) return "ศูนย์บาทถ้วน";
  const units = ["", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
  const positions = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน", "ล้าน"];
  const intPart = Math.floor(n);
  const decPart = Math.round((n - intPart) * 100);
  function convert(num: number): string {
    if (num === 0) return "";
    const s = String(num);
    let result = "";
    for (let i = 0; i < s.length; i++) {
      const digit = parseInt(s[i]);
      const pos = s.length - i - 1;
      if (digit === 0) continue;
      if (pos === 1 && digit === 1) { result += "สิบ"; continue; }
      if (pos === 1 && digit === 2) { result += "ยี่สิบ"; continue; }
      if (pos === 0 && digit === 1 && s.length > 1) { result += "เอ็ด"; continue; }
      result += units[digit] + positions[pos];
    }
    return result;
  }
  let result = convert(intPart) + "บาท";
  result += decPart > 0 ? convert(decPart) + "สตางค์" : "ถ้วน";
  return result;
}

function FiftyTawiPreview({ employee, company, data, year }: { employee: any; company: any; data: any; year: string }) {
  const yearBE = Number(year) + 543;
  const annualEarnings = Number(data?.annualEarnings || 0);
  const annualTax = Number(data?.annualTax || 0);
  const annualSso = Number(data?.annualSso || 0);
  const today = new Date();
  const thaiMonths = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
  const todayParts = { day: String(today.getDate()), month: thaiMonths[today.getMonth()], year: String(today.getFullYear() + 543) };
  const fmtN = (v: number) => v === 0 ? "" : v.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtA = (v: number) => v.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dot = { borderBottom: "1px dotted black", display: "inline" as const, paddingLeft: "2px", paddingRight: "2px" };
  const sec = { border: "1px solid black", padding: "4px 6px", marginBottom: "3px" };
  const tdL = "border border-black p-[2px] pl-[4px] text-left";
  const tdC = "border border-black p-[2px] text-center";
  const tdR = "border border-black p-[2px] pr-[4px] text-right";

  return (
    <div style={{ width: "210mm", minHeight: "297mm", fontFamily: "'Sarabun', sans-serif", fontSize: "11px", padding: "8mm 10mm", lineHeight: 1.4, background: "white", color: "black", position: "relative", boxSizing: "border-box" }} className="fifty-tawi-page">
      <style>{`@media print { @page { size: A4 portrait; margin: 5mm; } body { background: white !important; } .fifty-tawi-page { width: 100% !important; min-height: auto !important; padding: 4mm 6mm !important; border: none !important; } }`}</style>
      <div style={{ textAlign: "center", marginBottom: "2px" }}>
        <div style={{ fontSize: "16px", fontWeight: "bold" }}>หนังสือรับรองการหักภาษี ณ ที่จ่าย</div>
        <div style={{ fontSize: "12px" }}>ตามมาตรา 50 ทวิ แห่งประมวลรัษฎากร</div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "16px", fontSize: "11px", marginBottom: "4px" }}>
        <span>เล่มที่ <span style={{ ...dot, minWidth: "50px" }}></span></span>
        <span>เลขที่ <span style={{ ...dot, minWidth: "70px", fontWeight: 600 }}></span></span>
      </div>
      <div style={sec}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2px" }}>
          <b>ผู้มีหน้าที่หักภาษี ณ ที่จ่าย :-</b>
          <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "10px" }}>
            <span>เลขประจำตัวผู้เสียภาษีอากร (13 หลัก)*</span>
            <TaxIdBoxesESS taxId={company?.taxId || ""} />
          </div>
        </div>
        <div>ชื่อ <span style={{ ...dot, minWidth: "250px" }}>{company?.name || ""}</span> <span style={{ fontSize: "9px", color: "#666" }}>(ให้ระบุว่าเป็น บุคคล นิติบุคคล บริษัท สมาคม หรือคณะบุคคล)</span></div>
        <div>สาขา <span style={{ ...dot, minWidth: "200px" }}>{company?.branch || "สำนักงานใหญ่"}</span></div>
        <div>ที่อยู่ <span style={{ ...dot, minWidth: "500px" }}>{company?.address || ""}</span></div>
        <div style={{ fontSize: "9px", color: "#666", paddingLeft: "28px" }}>(ให้ระบุ ชื่ออาคาร/หมู่บ้าน ห้องเลขที่ ชั้นที่ เลขที่ ตรอก/ซอย หมู่ที่ ถนน ตำบล/แขวง อำเภอ/เขต จังหวัด)</div>
      </div>
      <div style={sec}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2px" }}>
          <b>ผู้ถูกหักภาษี ณ ที่จ่าย :-</b>
          <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "10px" }}>
            <span>เลขประจำตัวผู้เสียภาษีอากร (13 หลัก)*</span>
            <TaxIdBoxesESS taxId={employee?.taxId || employee?.idCardNumber || ""} />
          </div>
        </div>
        <div>ชื่อ <span style={{ ...dot, minWidth: "250px" }}>{employee?.fullName || ""}</span> <span style={{ fontSize: "9px", color: "#666" }}>(ให้ระบุว่าเป็น บุคคล นิติบุคคล บริษัท สมาคม หรือคณะบุคคล)</span></div>
        <div>สาขา <span style={{ ...dot, minWidth: "200px" }}></span></div>
        <div>ที่อยู่ <span style={{ ...dot, minWidth: "500px" }}>{employee?.address || ""}</span></div>
        <div style={{ fontSize: "9px", color: "#666", paddingLeft: "28px" }}>(ให้ระบุ ชื่ออาคาร/หมู่บ้าน ห้องเลขที่ ชั้นที่ เลขที่ ตรอก/ซอย หมู่ที่ ถนน ตำบล/แขวง อำเภอ/เขต จังหวัด)</div>
      </div>
      <div style={{ ...sec, display: "flex", alignItems: "flex-start", gap: "12px" }}>
        <div style={{ flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: "4px", marginBottom: "4px" }}>
            <b>ลำดับที่</b>
            <span style={{ ...dot, display: "inline-block", width: "50px", textAlign: "center" }}></span>
            <b>ในแบบ</b>
          </div>
          <div style={{ fontSize: "9px", color: "#666" }}>(ให้สามารถอ้างอิงหรือสอบยันกันได้ระหว่าง<br/>ลำดับที่ตามหนังสือรับรองฯ กับแบบยื่น<br/>รายการภาษีหัก ณ ที่จ่าย)</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, auto)", gap: "4px 16px", alignItems: "center" }}>
          <span><CBBox checked={true} /> ภ.ง.ด.1</span>
          <span><CBBox checked={false} /> ภ.ง.ด.1ก</span>
          <span><CBBox checked={false} /> ภ.ง.ด.1ก พิเศษ</span>
          <span><CBBox checked={false} /> ภ.ง.ด.2</span>
          <span><CBBox checked={false} /> ภ.ง.ด.3</span>
          <span><CBBox checked={false} /> ภ.ง.ด.2ก</span>
          <span><CBBox checked={false} /> ภ.ง.ด.3ก</span>
          <span><CBBox checked={false} /> ภ.ง.ด.53</span>
        </div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10.5px", marginBottom: "3px" }}>
        <thead>
          <tr>
            <th className={tdL} style={{ width: "54%" }}>ประเภทเงินได้พึงประเมินที่จ่าย</th>
            <th className={tdC} style={{ width: "14%" }}>วัน เดือน<br/>หรือปีภาษี ที่จ่าย</th>
            <th className={tdC} style={{ width: "16%" }}>จำนวนเงินที่จ่าย</th>
            <th className={tdC} style={{ width: "16%" }}>ภาษีที่หัก<br/>และนำส่งไว้</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={tdL}>1. เงินเดือน ค่าจ้าง เบี้ยเลี้ยง โบนัส ฯลฯ ตามมาตรา 40 (1)</td>
            <td className={tdC}>{yearBE}</td>
            <td className={tdR}>{fmtN(annualEarnings)}</td>
            <td className={tdR}>{fmtN(annualTax)}</td>
          </tr>
          <tr><td className={tdL}>2. ค่าธรรมเนียม ค่านายหน้า ฯลฯ ตามมาตรา 40 (2)</td><td className={tdC}></td><td className={tdR}></td><td className={tdR}></td></tr>
          <tr><td className={tdL}>3. ค่าแห่งลิขสิทธิ์ ฯลฯ ตามมาตรา 40 (3)</td><td className={tdC}></td><td className={tdR}></td><td className={tdR}></td></tr>
          <tr><td className={tdL}>4. (ก) ดอกเบี้ย ฯลฯ ตามมาตรา 40 (4) (ก)</td><td className={tdC}></td><td className={tdR}></td><td className={tdR}></td></tr>
          <tr><td className={tdL} style={{ paddingLeft: "12px" }}>(ข) เงินปันผล เงินส่วนแบ่งกำไร ฯลฯ ตามมาตรา 40 (4) (ข)</td><td className={tdC}></td><td className={tdR}></td><td className={tdR}></td></tr>
          <tr><td className={tdL} colSpan={4} style={{ fontSize: "10px", paddingLeft: "20px" }}>(1) กรณีผู้ได้รับเงินปันผลได้รับเครดิตภาษี โดยจ่ายจากกำไรสุทธิของกิจการที่ต้องเสียภาษีเงินได้นิติบุคคลในอัตราดังนี้</td></tr>
          <tr><td className={tdL} style={{ fontSize: "10px", paddingLeft: "40px" }}>(1.1) อัตราร้อยละ 30 ของกำไรสุทธิ</td><td className={tdC}></td><td className={tdR}></td><td className={tdR}></td></tr>
          <tr><td className={tdL} style={{ fontSize: "10px", paddingLeft: "40px" }}>(1.2) อัตราร้อยละ 25 ของกำไรสุทธิ</td><td className={tdC}></td><td className={tdR}></td><td className={tdR}></td></tr>
          <tr><td className={tdL} style={{ fontSize: "10px", paddingLeft: "40px" }}>(1.3) อัตราร้อยละ 20 ของกำไรสุทธิ</td><td className={tdC}></td><td className={tdR}></td><td className={tdR}></td></tr>
          <tr><td className={tdL} style={{ fontSize: "10px", paddingLeft: "40px" }}>(1.4) อัตราอื่นๆ (ระบุ) .................. ของกำไรสุทธิ</td><td className={tdC}></td><td className={tdR}></td><td className={tdR}></td></tr>
          <tr><td className={tdL} colSpan={4} style={{ fontSize: "10px", paddingLeft: "20px" }}>(2) กรณีผู้ได้รับเงินปันผลไม่ได้รับเครดิตภาษี เนื่องจากจ่ายจาก</td></tr>
          <tr><td className={tdL} style={{ fontSize: "10px", paddingLeft: "40px" }}>(2.1) กำไรสุทธิของกิจการที่ได้รับยกเว้นภาษีเงินได้นิติบุคคล</td><td className={tdC}></td><td className={tdR}></td><td className={tdR}></td></tr>
          <tr><td className={tdL} style={{ fontSize: "10px", paddingLeft: "40px" }}>(2.2) เงินปันผลหรือเงินส่วนแบ่งของกำไรที่ได้รับยกเว้นไม่ต้องนำมารวมคำนวณเป็นรายได้</td><td className={tdC}></td><td className={tdR}></td><td className={tdR}></td></tr>
          <tr><td className={tdL} style={{ fontSize: "10px", paddingLeft: "40px" }}>(2.3) กำไรสุทธิส่วนที่ได้หักผลขาดทุนสุทธิยกมาไม่เกิน 5 ปี</td><td className={tdC}></td><td className={tdR}></td><td className={tdR}></td></tr>
          <tr><td className={tdL} style={{ fontSize: "10px", paddingLeft: "40px" }}>(2.4) กำไรที่รับรู้ทางบัญชีโดยวิธีส่วนได้เสีย (equity method)</td><td className={tdC}></td><td className={tdR}></td><td className={tdR}></td></tr>
          <tr><td className={tdL} style={{ fontSize: "10px", paddingLeft: "40px" }}>(2.5) อื่นๆ (ระบุ) ......................................................</td><td className={tdC}></td><td className={tdR}></td><td className={tdR}></td></tr>
          <tr>
            <td className={tdL}>
              <div>5. การจ่ายเงินได้ที่ต้องหักภาษี ณ ที่จ่าย ตามคำสั่งกรมสรรพากรที่ออกตามมาตรา</div>
              <div style={{ paddingLeft: "12px", fontSize: "10px" }}>3 เตรส เช่น รางวัล ส่วนลด ค่าจ้างทำของ ค่าบริการ ฯลฯ</div>
            </td>
            <td className={tdC}></td><td className={tdR}></td><td className={tdR}></td>
          </tr>
          <tr><td className={tdL}>6. อื่นๆ (ระบุ) ...........................................................</td><td className={tdC}></td><td className={tdR}></td><td className={tdR}></td></tr>
          <tr style={{ fontWeight: "bold" }}>
            <td className={tdR} colSpan={2}>รวมเงินที่จ่ายและภาษีที่หักนำส่ง</td>
            <td className={tdR}>{fmtN(annualEarnings)}</td>
            <td className={tdR}>{fmtN(annualTax)}</td>
          </tr>
        </tbody>
      </table>
      <div style={{ fontSize: "11px", marginBottom: "2px" }}>
        <b>รวมเงินภาษีที่หักนำส่ง (ตัวอักษร)</b>
        <span style={{ ...dot, minWidth: "320px", marginLeft: "4px", fontWeight: 600 }}>{numberToThaiWordsESS(annualTax)}</span>
      </div>
      <div style={{ fontSize: "10px", marginBottom: "3px" }}>
        เงินที่จ่ายเข้า กบข./กสจ./กองทุนสงเคราะห์ครูโรงเรียนเอกชน <span style={{ ...dot, display: "inline-block", minWidth: "60px", textAlign: "center" }}></span> บาท
        {" "}กองทุนประกันสังคม <span style={{ ...dot, display: "inline-block", minWidth: "60px", textAlign: "center" }}>{annualSso ? fmtA(annualSso) : ""}</span> บาท
        {" "}กองทุนสำรองเลี้ยงชีพ <span style={{ ...dot, display: "inline-block", minWidth: "60px", textAlign: "center" }}></span> บาท
      </div>
      <div style={{ ...sec, display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px 10px", fontSize: "11px" }}>
        <b>ผู้จ่ายเงิน</b>
        <span><CBBox checked={true} /> (1) หัก ณ ที่จ่าย</span>
        <span><CBBox checked={false} /> (2) ออกให้ตลอดไป</span>
        <span><CBBox checked={false} /> (3) ออกให้ครั้งเดียว</span>
        <span><CBBox checked={false} /> (4) อื่นๆ (ระบุ) ..................</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", fontSize: "10px", marginTop: "4px" }}>
        <div style={{ ...sec, width: "44%", fontSize: "10px" }}>
          <b>คำเตือน</b>
          <div>ผู้มีหน้าที่ออกหนังสือรับรองการหักภาษี ณ ที่จ่าย ฝ่าฝืนไม่ปฏิบัติตามมาตรา 50 ทวิ แห่งประมวลรัษฎากร ต้องรับโทษทางอาญาตามมาตรา 35 แห่งประมวลรัษฎากร</div>
        </div>
        <div style={{ width: "52%", textAlign: "center", fontSize: "11px" }}>
          <div>ขอรับรองว่าข้อความและตัวเลขดังกล่าวข้างต้นถูกต้องตรงกับความจริงทุกประการ</div>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "16px" }}>
            <tbody>
              <tr>
                <td style={{ textAlign: "right", whiteSpace: "nowrap", paddingRight: "4px", border: "none" }}>ลงชื่อ</td>
                <td style={{ textAlign: "center", width: "170px", borderBottom: "1px dotted black", border: "none" }}>&nbsp;</td>
                <td style={{ textAlign: "left", whiteSpace: "nowrap", paddingLeft: "4px", border: "none" }}>ผู้จ่ายเงิน</td>
                <td style={{ textAlign: "left", whiteSpace: "nowrap", paddingLeft: "8px", fontSize: "10px", border: "none" }}>ประทับตรา</td>
              </tr>
              <tr>
                <td colSpan={4} style={{ textAlign: "center", border: "none", paddingTop: "4px" }}>
                  <span style={{ ...dot, minWidth: "140px" }}>{company?.name || ""}</span>
                </td>
              </tr>
              <tr>
                <td colSpan={4} style={{ textAlign: "center", border: "none", paddingTop: "2px", fontSize: "10px" }}>
                  วันที่ {todayParts.day} เดือน {todayParts.month} พ.ศ. {todayParts.year}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}