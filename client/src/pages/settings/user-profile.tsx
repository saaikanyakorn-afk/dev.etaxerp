import Layout from "@/components/layout";
import SettingsTabs from "@/components/settings-tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ThaiDateInput from "@/components/thai-date-input";
import { useDateSettings } from "@/hooks/use-date-settings";
import { useCompany } from "@/lib/company-context";
import { formatDate } from "@/lib/format";
import {
  User, UserCog, Signature, Save, Upload, X, Loader2, KeyRound, Pencil,
  CalendarDays, Clock, FileText, Plus, CheckCircle, XCircle,
  Palmtree, Briefcase, Heart, Timer, Printer, Download, AlertCircle
} from "lucide-react";
import { useState, useRef, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { useUpload } from "@/hooks/use-upload";
import { objectPathToUrl } from "@/lib/utils";

interface UserSig {
  signatureUrl?: string | null;
  signatureName?: string | null;
  signatureNameEn?: string | null;
  signatureNameZh?: string | null;
  signatureTitle?: string | null;
  signatureTitleEn?: string | null;
  signatureTitleZh?: string | null;
}

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

function calcDays(start: string, end: string): number {
  if (!start || !end) return 0;
  const s = new Date(start);
  const e = new Date(end);
  return Math.max((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24) + 1, 0);
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

export default function UserProfile() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user, refetchUser } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const { selectedCompany, selectedCompanyId } = useCompany();
  const { dateEra, dateFmt } = useDateSettings();

  const [activeTab, setActiveTab] = useState("personal");
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [changingUsername, setChangingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [usernamePassword, setUsernamePassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [otDialogOpen, setOtDialogOpen] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ leaveType: "", startDate: "", endDate: "", reason: "" });
  const [otForm, setOtForm] = useState({ date: "", otType: "regular", startTime: "", endTime: "" });
  const [docType, setDocType] = useState<string | null>(null);
  const [docYear, setDocYear] = useState(String(new Date().getFullYear()));
  const [docMonth, setDocMonth] = useState(String(new Date().getMonth() + 1));

  const startEditProfile = () => {
    setProfileName(user?.fullName || "");
    setProfileEmail(user?.email || "");
    setEditingProfile(true);
  };

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const { uploadFile: uploadAvatar, isUploading: isUploadingAvatar } = useUpload({
    onSuccess: (response: any) => {
      const path = typeof response === "string" ? response : response?.objectPath || response?.uploadURL || "";
      avatarMutation.mutate({ avatarUrl: path });
    },
    onError: (error: any) => {
      toast({ title: "อัปโหลดไม่สำเร็จ", description: error?.message || String(error), variant: "destructive" });
    },
  });

  const avatarMutation = useMutation({
    mutationFn: async (data: { avatarUrl: string | null }) => {
      const r = await fetch("/api/auth/me/avatar", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      if (refetchUser) refetchUser();
      toast({ title: "อัปเดตรูปโปรไฟล์สำเร็จ", variant: "success" as any });
    },
    onError: (err: any) => {
      toast({ title: "ไม่สำเร็จ", description: err.message, variant: "destructive" });
    },
  });

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "ไฟล์ใหญ่เกินไป", description: "ขนาดสูงสุด 5MB", variant: "destructive" });
      return;
    }
    uploadAvatar(file);
    if (avatarInputRef.current) avatarInputRef.current.value = "";
  };

  const profileMutation = useMutation({
    mutationFn: async (data: { fullName: string; email: string | null }) => {
      const r = await fetch("/api/auth/me/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      setEditingProfile(false);
      if (refetchUser) refetchUser();
      toast({ title: "บันทึกข้อมูลสำเร็จ", variant: "success" as any });
    },
    onError: (err: any) => {
      toast({ title: "ไม่สำเร็จ", description: err.message, variant: "destructive" });
    },
  });

  const usernameMutation = useMutation({
    mutationFn: async (data: { newUsername: string; currentPassword: string }) => {
      const r = await fetch("/api/auth/me/username", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      setChangingUsername(false);
      setNewUsername("");
      setUsernamePassword("");
      if (refetchUser) refetchUser();
      toast({ title: "เปลี่ยนชื่อผู้ใช้สำเร็จ", variant: "success" as any });
    },
    onError: (err: any) => {
      toast({ title: "ไม่สำเร็จ", description: err.message, variant: "destructive" });
    },
  });

  const handleChangeUsername = () => {
    if (!newUsername.trim() || !usernamePassword) return;
    usernameMutation.mutate({ newUsername: newUsername.trim(), currentPassword: usernamePassword });
  };

  const passwordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      const r = await fetch("/api/auth/me/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      setChangingPassword(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast({ title: "เปลี่ยนรหัสผ่านสำเร็จ", variant: "success" as any });
    },
    onError: (err: any) => {
      toast({ title: "ไม่สำเร็จ", description: err.message, variant: "destructive" });
    },
  });

  const handleSaveProfile = () => {
    profileMutation.mutate({ fullName: profileName, email: profileEmail || null });
  };

  const handleChangePassword = () => {
    if (newPassword !== confirmPassword) {
      toast({ title: "รหัสผ่านใหม่ไม่ตรงกัน", variant: "destructive" });
      return;
    }
    passwordMutation.mutate({ currentPassword, newPassword });
  };

  const { data: signature } = useQuery<UserSig>({
    queryKey: ["/api/auth/me/signature"],
    queryFn: async () => {
      const r = await fetch("/api/auth/me/signature", { credentials: "include" });
      if (!r.ok) return null;
      return r.json();
    },
  });

  const [localSig, setLocalSig] = useState<UserSig | null>(null);

  const currentSig: UserSig = localSig || signature || {
    signatureName: user?.fullName || "",
    signatureNameEn: "",
    signatureNameZh: "",
    signatureTitle: "",
    signatureTitleEn: "",
    signatureTitleZh: "",
    signatureUrl: null,
  };

  const updateLocal = (key: string, value: any) => {
    setLocalSig(prev => ({
      ...(prev || currentSig),
      [key]: value,
    }));
  };

  const hasChanges = localSig !== null;

  const { uploadFile, isUploading } = useUpload({
    onSuccess: (response) => {
      updateLocal("signatureUrl", response.objectPath);
    },
  });

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("ไฟล์ต้องมีขนาดไม่เกิน 5MB");
      return;
    }
    await uploadFile(file);
    if (fileRef.current) fileRef.current.value = "";
  }, [uploadFile]);

  const saveMutation = useMutation({
    mutationFn: async (data: UserSig) => {
      const r = await fetch("/api/auth/me/signature", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me/signature"] });
      setLocalSig(null);
      toast({ title: "บันทึกลายเซ็นสำเร็จ", variant: "success" as any });
    },
    onError: (err: any) => {
      toast({ title: "ไม่สำเร็จ", description: err.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    saveMutation.mutate({
      signatureUrl: currentSig.signatureUrl,
      signatureName: currentSig.signatureName,
      signatureNameEn: currentSig.signatureNameEn,
      signatureNameZh: currentSig.signatureNameZh,
      signatureTitle: currentSig.signatureTitle,
      signatureTitleEn: currentSig.signatureTitleEn,
      signatureTitleZh: currentSig.signatureTitleZh,
    });
  };

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

  const profileCompanyId = company?.id || selectedCompanyId;
  const { data: docSettings } = useQuery<any>({
    queryKey: ["/api/document-settings", profileCompanyId],
    queryFn: async () => {
      if (!profileCompanyId) return null;
      const res = await fetch(`/api/document-settings?companyId=${profileCompanyId}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!profileCompanyId,
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
      setLeaveForm({ leaveType: "", startDate: "", endDate: "", reason: "" });
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

  const leaveDays = calcDays(leaveForm.startDate, leaveForm.endDate);
  const otHours = calcOtHours(otForm.startTime, otForm.endTime);
  const otRate = otForm.otType === "holiday" ? 3 : 1.5;
  const baseSalary = Number(employee?.baseSalary || 0);
  const hourlyRate = baseSalary / 30 / 8;
  const otAmount = +(hourlyRate * otHours * otRate).toFixed(2);

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
    if (!leaveForm.leaveType || !leaveForm.startDate || !leaveForm.endDate) return;
    leaveMutation.mutate({
      leaveType: leaveForm.leaveType,
      startDate: leaveForm.startDate,
      endDate: leaveForm.endDate,
      days: String(leaveDays),
      reason: leaveForm.reason || null,
    });
  };

  const handleOtSubmit = () => {
    if (!otForm.date || !otForm.startTime || !otForm.endTime) return;
    otMutation.mutate({
      date: otForm.date,
      otType: otForm.otType,
      startTime: new Date(`${otForm.date}T${otForm.startTime}`).toISOString(),
      endTime: new Date(`${otForm.date}T${otForm.endTime}`).toISOString(),
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

  return (
    <Layout>
      <SettingsTabs />
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg text-white" style={{ background: "#03c9d7" }}>
            <User className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-profile-title">โปรไฟล์ผู้ใช้งาน</h1>
            <p className="text-sm text-muted-foreground mt-0.5">จัดการข้อมูลส่วนตัว รหัสผ่าน ลายเซ็น และบริการตนเอง</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full justify-start overflow-x-auto" data-testid="profile-tabs">
            <TabsTrigger value="personal" data-testid="tab-personal">ข้อมูลส่วนตัว</TabsTrigger>
            <TabsTrigger value="signature" data-testid="tab-signature">ลายเซ็น</TabsTrigger>
            {employee && <TabsTrigger value="leave-ot" data-testid="tab-leave-ot">ลา/OT</TabsTrigger>}
            {employee && <TabsTrigger value="documents" data-testid="tab-documents">เอกสาร</TabsTrigger>}
          </TabsList>

          {/* ===== PERSONAL INFO TAB ===== */}
          <TabsContent value="personal" className="space-y-4">
            <div className="max-w-2xl space-y-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-5">
                    <div className="relative group">
                      <div className="w-20 h-20 rounded-full border-2 border-gray-200 overflow-hidden bg-gray-100 flex items-center justify-center">
                        {user?.avatarUrl ? (
                          <img src={objectPathToUrl(user.avatarUrl) || user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; (e.target as HTMLImageElement).nextElementSibling && ((e.target as HTMLImageElement).parentElement!.querySelector(".avatar-fallback") as any)?.classList.remove("hidden"); }} />
                        ) : null}
                        <span className={`avatar-fallback text-2xl font-bold text-gray-400 ${user?.avatarUrl ? "hidden" : ""}`}>
                          {(user?.fullName || "U").charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <button
                        className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                        onClick={() => avatarInputRef.current?.click()}
                        disabled={isUploadingAvatar}
                        data-testid="button-change-avatar"
                      >
                        {isUploadingAvatar ? <Loader2 className="h-5 w-5 text-white animate-spin" /> : <Upload className="h-5 w-5 text-white" />}
                      </button>
                      <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} data-testid="input-avatar" />
                    </div>
                    <div className="flex-1">
                      <h2 className="text-lg font-semibold" data-testid="text-avatar-name">{user?.fullName}</h2>
                      <p className="text-sm text-muted-foreground">@{user?.username}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Button variant="outline" size="sm" onClick={() => avatarInputRef.current?.click()} disabled={isUploadingAvatar} data-testid="button-upload-avatar">
                          {isUploadingAvatar ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1.5" />}
                          เปลี่ยนรูป
                        </Button>
                        {user?.avatarUrl && (
                          <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => avatarMutation.mutate({ avatarUrl: null })} data-testid="button-remove-avatar">
                            <X className="h-3.5 w-3.5 mr-1.5" /> ลบรูป
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <User className="h-4 w-4" /> ข้อมูลผู้ใช้งาน
                    </CardTitle>
                    {!editingProfile && (
                      <Button variant="outline" size="sm" onClick={startEditProfile} data-testid="button-edit-profile">
                        <Pencil className="h-3.5 w-3.5 mr-1.5" /> แก้ไข
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {editingProfile ? (
                    <div className="space-y-4">
                      <div>
                        <Label>ชื่อเต็ม</Label>
                        <Input
                          value={profileName}
                          onChange={e => setProfileName(e.target.value)}
                          placeholder="ชื่อ-นามสกุล"
                          className="mt-1"
                          data-testid="input-profile-fullname"
                        />
                      </div>
                      <div>
                        <Label>อีเมล</Label>
                        <Input
                          value={profileEmail}
                          onChange={e => setProfileEmail(e.target.value)}
                          placeholder="email@example.com"
                          type="email"
                          className="mt-1"
                          data-testid="input-profile-email"
                        />
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" onClick={() => setEditingProfile(false)} data-testid="button-cancel-profile">ยกเลิก</Button>
                        <Button
                          className="text-white"
                          style={{ backgroundColor: "#03c9d7" }}
                          onClick={handleSaveProfile}
                          disabled={profileMutation.isPending || !profileName.trim()}
                          data-testid="button-save-profile"
                        >
                          {profileMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                          บันทึก
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs text-muted-foreground">ชื่อผู้ใช้</Label>
                        <p className="font-medium" data-testid="text-username">{user?.username}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">ชื่อเต็ม</Label>
                        <p className="font-medium" data-testid="text-fullname">{user?.fullName}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">บทบาท</Label>
                        <Badge variant="outline" className="mt-0.5" data-testid="text-role">{user?.role}</Badge>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">อีเมล</Label>
                        <p className="text-sm" data-testid="text-email">{user?.email || "-"}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <UserCog className="h-4 w-4" /> เปลี่ยนชื่อผู้ใช้ (Username)
                    </CardTitle>
                    {!changingUsername && (
                      <Button variant="outline" size="sm" onClick={() => { setChangingUsername(true); setNewUsername(user?.username || ""); }} data-testid="button-change-username">
                        <UserCog className="h-3.5 w-3.5 mr-1.5" /> เปลี่ยนชื่อผู้ใช้
                      </Button>
                    )}
                  </div>
                </CardHeader>
                {!changingUsername && (
                  <CardContent>
                    <p className="text-sm text-muted-foreground">ชื่อผู้ใช้ปัจจุบัน: <span className="font-medium text-foreground">{user?.username}</span></p>
                  </CardContent>
                )}
                {changingUsername && (
                  <CardContent className="space-y-4">
                    <div>
                      <Label>ชื่อผู้ใช้ใหม่</Label>
                      <Input
                        value={newUsername}
                        onChange={e => setNewUsername(e.target.value)}
                        placeholder="ระบุชื่อผู้ใช้ใหม่ (อย่างน้อย 3 ตัวอักษร)"
                        className="mt-1"
                        data-testid="input-new-username"
                      />
                    </div>
                    <div>
                      <Label>รหัสผ่านเพื่อยืนยัน</Label>
                      <Input
                        type="password"
                        value={usernamePassword}
                        onChange={e => setUsernamePassword(e.target.value)}
                        placeholder="ระบุรหัสผ่านปัจจุบันเพื่อยืนยัน"
                        className="mt-1"
                        data-testid="input-username-password"
                      />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" onClick={() => { setChangingUsername(false); setNewUsername(""); setUsernamePassword(""); }} data-testid="button-cancel-username">ยกเลิก</Button>
                      <Button
                        className="text-white"
                        style={{ backgroundColor: "#fb9678" }}
                        onClick={handleChangeUsername}
                        disabled={usernameMutation.isPending || !newUsername.trim() || !usernamePassword}
                        data-testid="button-save-username"
                      >
                        {usernameMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                        เปลี่ยนชื่อผู้ใช้
                      </Button>
                    </div>
                  </CardContent>
                )}
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <KeyRound className="h-4 w-4" /> เปลี่ยนรหัสผ่าน
                    </CardTitle>
                    {!changingPassword && (
                      <Button variant="outline" size="sm" onClick={() => setChangingPassword(true)} data-testid="button-change-password">
                        <KeyRound className="h-3.5 w-3.5 mr-1.5" /> เปลี่ยนรหัสผ่าน
                      </Button>
                    )}
                  </div>
                </CardHeader>
                {changingPassword && (
                  <CardContent className="space-y-4">
                    <div>
                      <Label>รหัสผ่านปัจจุบัน</Label>
                      <Input
                        type="password"
                        value={currentPassword}
                        onChange={e => setCurrentPassword(e.target.value)}
                        placeholder="ระบุรหัสผ่านปัจจุบัน"
                        className="mt-1"
                        data-testid="input-current-password"
                      />
                    </div>
                    <div>
                      <Label>รหัสผ่านใหม่</Label>
                      <Input
                        type="password"
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        placeholder="ระบุรหัสผ่านใหม่ (อย่างน้อย 4 ตัวอักษร)"
                        className="mt-1"
                        data-testid="input-new-password"
                      />
                    </div>
                    <div>
                      <Label>ยืนยันรหัสผ่านใหม่</Label>
                      <Input
                        type="password"
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        placeholder="ระบุรหัสผ่านใหม่อีกครั้ง"
                        className="mt-1"
                        data-testid="input-confirm-password"
                      />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" onClick={() => { setChangingPassword(false); setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); }} data-testid="button-cancel-password">ยกเลิก</Button>
                      <Button
                        className="text-white"
                        style={{ backgroundColor: "#fb9678" }}
                        onClick={handleChangePassword}
                        disabled={passwordMutation.isPending || !currentPassword || !newPassword || !confirmPassword}
                        data-testid="button-save-password"
                      >
                        {passwordMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                        เปลี่ยนรหัสผ่าน
                      </Button>
                    </div>
                  </CardContent>
                )}
              </Card>

              {employee && (
                <Card data-testid="card-profile">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">ข้อมูลพนักงาน</CardTitle></CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">รหัสพนักงาน</span><span className="font-medium">{employee.employeeCode}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">ชื่อ-นามสกุล</span><span className="font-medium">{employee.fullName}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">ตำแหน่ง</span><span className="font-medium">{employee.position || "-"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">แผนก</span><span className="font-medium">{employee.department || "-"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">วันเริ่มงาน</span><span className="font-medium">{employee.startDate ? formatDate(employee.startDate, dateEra, dateFmt) : "-"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">อายุงาน</span><span className="font-medium">{calcYearsMonths(employee.startDate)}</span></div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* ===== SIGNATURE TAB ===== */}
          <TabsContent value="signature" className="space-y-4">
            <div className="max-w-2xl space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Signature className="h-4 w-4" /> ลายเซ็นผู้ออกเอกสาร
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-xs text-muted-foreground">
                    ลายเซ็นนี้จะแสดงบนเอกสารที่คุณสร้าง โดยจะติดตามตัวผู้ใช้งาน ไม่ขึ้นกับบริษัท
                  </p>

                  <div>
                    <Label>ภาพลายเซ็น</Label>
                    <div className="mt-1.5">
                      {currentSig.signatureUrl ? (
                        <div className="relative border rounded-lg p-4 bg-muted/30 inline-block">
                          <img
                            src={objectPathToUrl(currentSig.signatureUrl) || currentSig.signatureUrl || ""}
                            alt="ลายเซ็น"
                            className="max-h-20 max-w-[200px] object-contain"
                            data-testid="img-user-signature"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="absolute top-1 right-1 h-6 w-6 p-0 text-muted-foreground hover:text-rose-500"
                            onClick={() => updateLocal("signatureUrl", null)}
                            data-testid="button-clear-signature"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <div
                          className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-[#03c9d7] hover:bg-[#e5f9fa]/50 transition-colors max-w-xs"
                          onClick={() => fileRef.current?.click()}
                          data-testid="dropzone-signature"
                        >
                          {isUploading ? (
                            <div className="flex flex-col items-center gap-2">
                              <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#03c9d7" }} />
                              <span className="text-xs text-muted-foreground">กำลังอัปโหลด...</span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-2">
                              <Upload className="h-8 w-8 text-muted-foreground/50" />
                              <span className="text-xs text-muted-foreground">คลิกเพื่ออัปโหลดภาพลายเซ็น</span>
                              <span className="text-[10px] text-muted-foreground/50">PNG (พื้นหลังโปร่งใส) แนะนำ, JPG ไม่เกิน 5MB</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={handleFileChange}
                      data-testid="input-file-signature"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>ชื่อผู้ลงนาม</Label>
                      <div className="space-y-1 mt-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs w-5 text-center">🇹🇭</span>
                          <Input data-testid="input-sig-name-th" value={currentSig.signatureName || ""} onChange={e => updateLocal("signatureName", e.target.value)} placeholder="เช่น นายสมชาย ใจดี" className="h-8 text-sm" />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs w-5 text-center">🇬🇧</span>
                          <Input data-testid="input-sig-name-en" value={currentSig.signatureNameEn || ""} onChange={e => updateLocal("signatureNameEn", e.target.value)} placeholder="e.g. Mr. Somchai Jaidi" className="h-8 text-sm" />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs w-5 text-center">🇨🇳</span>
                          <Input data-testid="input-sig-name-zh" value={currentSig.signatureNameZh || ""} onChange={e => updateLocal("signatureNameZh", e.target.value)} placeholder="例如 张三" className="h-8 text-sm" />
                        </div>
                      </div>
                    </div>
                    <div>
                      <Label>ตำแหน่ง</Label>
                      <div className="space-y-1 mt-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs w-5 text-center">🇹🇭</span>
                          <Input data-testid="input-sig-title-th" value={currentSig.signatureTitle || ""} onChange={e => updateLocal("signatureTitle", e.target.value)} placeholder="เช่น กรรมการผู้จัดการ" className="h-8 text-sm" />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs w-5 text-center">🇬🇧</span>
                          <Input data-testid="input-sig-title-en" value={currentSig.signatureTitleEn || ""} onChange={e => updateLocal("signatureTitleEn", e.target.value)} placeholder="e.g. Managing Director" className="h-8 text-sm" />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs w-5 text-center">🇨🇳</span>
                          <Input data-testid="input-sig-title-zh" value={currentSig.signatureTitleZh || ""} onChange={e => updateLocal("signatureTitleZh", e.target.value)} placeholder="例如 总经理" className="h-8 text-sm" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {currentSig.signatureUrl && (
                    <div className="border rounded-lg p-4 bg-gray-50/50">
                      <Label className="text-xs text-muted-foreground mb-2 block">ตัวอย่างลายเซ็นบนเอกสาร</Label>
                      <div className="text-center w-48 mx-auto">
                        <img src={objectPathToUrl(currentSig.signatureUrl) || currentSig.signatureUrl || ""} alt="Signature" className="h-12 mx-auto mb-1 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        <div className="border-t border-gray-400 pt-1">
                          <div className="text-xs font-medium">{currentSig.signatureName || "ผู้มีอำนาจลงนาม"}</div>
                          {currentSig.signatureTitle && (
                            <div className="text-[10px] text-gray-500">{currentSig.signatureTitle}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {hasChanges && (
                <div className="flex items-center gap-3 justify-end">
                  <Button variant="outline" onClick={() => setLocalSig(null)} data-testid="button-cancel-sig">
                    ยกเลิก
                  </Button>
                  <Button
                    className="text-white hover:opacity-90"
                    style={{ background: "#03c9d7" }}
                    onClick={handleSave}
                    disabled={saveMutation.isPending}
                    data-testid="button-save-sig"
                  >
                    {saveMutation.isPending ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> กำลังบันทึก...</>
                    ) : (
                      <><Save className="h-4 w-4 mr-2" /> บันทึกลายเซ็น</>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ===== LEAVE/OT TAB ===== */}
          {employee && (
            <TabsContent value="leave-ot" className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold">วันลา</h2>
                  <Button style={{ background: "#05b187" }} className="text-white hover:opacity-90" onClick={() => setLeaveDialogOpen(true)} data-testid="button-new-leave">
                    <Plus className="w-4 h-4 mr-1" /> ขอลา
                  </Button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {LEAVE_TYPES.map(lt => (
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
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold">ขอ OT</h2>
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
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {otRecords.length === 0 ? (
                          <TableRow><TableCell colSpan={6} className="text-center py-8 text-sm text-muted-foreground">ยังไม่มีประวัติ OT</TableCell></TableRow>
                        ) : otRecords.map((o: any) => (
                          <TableRow key={o.id} data-testid={`row-ot-${o.id}`}>
                            <TableCell className="text-sm">{formatDate(o.date, dateEra, dateFmt)}</TableCell>
                            <TableCell className="text-sm">{o.otType === "holiday" ? "วันหยุด (x3)" : "ปกติ (x1.5)"}</TableCell>
                            <TableCell className="text-sm text-center">{Number(o.hours || 0)}</TableCell>
                            <TableCell className="text-sm text-center">{Number(o.rate || 0)}x</TableCell>
                            <TableCell className="text-sm text-right">{fmt(Number(o.amount || 0))}</TableCell>
                            <TableCell className="text-sm text-center">{statusBadge(o.status)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          )}

          {/* ===== DOCUMENTS TAB ===== */}
          {employee && (
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
          )}
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">วันที่เริ่ม *</label>
                  <ThaiDateInput value={leaveForm.startDate} onChange={(v: string) => setLeaveForm(f => ({ ...f, startDate: v }))} dateEra={dateEra} dateFmt={dateFmt} data-testid="input-leave-start" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">วันที่สิ้นสุด *</label>
                  <ThaiDateInput value={leaveForm.endDate} onChange={(v: string) => setLeaveForm(f => ({ ...f, endDate: v }))} dateEra={dateEra} dateFmt={dateFmt} data-testid="input-leave-end" />
                </div>
              </div>
              {leaveDays > 0 && <p className="text-sm font-medium" style={{ color: "#fb9678" }}>จำนวน {leaveDays} วัน</p>}
              <div>
                <label className="text-xs font-medium text-muted-foreground">เหตุผล</label>
                <Textarea value={leaveForm.reason} onChange={e => setLeaveForm(f => ({ ...f, reason: e.target.value }))} placeholder="ระบุเหตุผล (ไม่บังคับ)" data-testid="input-leave-reason" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setLeaveDialogOpen(false)} data-testid="button-cancel-leave">ยกเลิก</Button>
                <Button
                  onClick={handleLeaveSubmit}
                  disabled={leaveMutation.isPending || !leaveForm.leaveType || !leaveForm.startDate || !leaveForm.endDate || leaveDays <= 0}
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

function TaxIdBoxesProfile({ taxId }: { taxId: string }) {
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

function CBBoxProfile({ checked }: { checked: boolean }) {
  return (
    <span style={{ display: "inline-block", width: "11px", height: "11px", border: "1px solid black", textAlign: "center", lineHeight: "11px", fontSize: "9px", fontWeight: "bold", verticalAlign: "middle", marginRight: "2px" }}>
      {checked ? "✓" : "\u00A0"}
    </span>
  );
}

function numberToThaiWordsProfile(n: number): string {
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
            <TaxIdBoxesProfile taxId={company?.taxId || ""} />
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
            <TaxIdBoxesProfile taxId={employee?.taxId || employee?.idCardNumber || ""} />
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
          <span><CBBoxProfile checked={true} /> ภ.ง.ด.1</span>
          <span><CBBoxProfile checked={false} /> ภ.ง.ด.1ก</span>
          <span><CBBoxProfile checked={false} /> ภ.ง.ด.1ก พิเศษ</span>
          <span><CBBoxProfile checked={false} /> ภ.ง.ด.2</span>
          <span><CBBoxProfile checked={false} /> ภ.ง.ด.3</span>
          <span><CBBoxProfile checked={false} /> ภ.ง.ด.2ก</span>
          <span><CBBoxProfile checked={false} /> ภ.ง.ด.3ก</span>
          <span><CBBoxProfile checked={false} /> ภ.ง.ด.53</span>
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
        <span style={{ ...dot, minWidth: "320px", marginLeft: "4px", fontWeight: 600 }}>{numberToThaiWordsProfile(annualTax)}</span>
      </div>
      <div style={{ fontSize: "10px", marginBottom: "3px" }}>
        เงินที่จ่ายเข้า กบข./กสจ./กองทุนสงเคราะห์ครูโรงเรียนเอกชน <span style={{ ...dot, display: "inline-block", minWidth: "60px", textAlign: "center" }}></span> บาท
        {" "}กองทุนประกันสังคม <span style={{ ...dot, display: "inline-block", minWidth: "60px", textAlign: "center" }}>{annualSso ? fmtA(annualSso) : ""}</span> บาท
        {" "}กองทุนสำรองเลี้ยงชีพ <span style={{ ...dot, display: "inline-block", minWidth: "60px", textAlign: "center" }}></span> บาท
      </div>
      <div style={{ ...sec, display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px 10px", fontSize: "11px" }}>
        <b>ผู้จ่ายเงิน</b>
        <span><CBBoxProfile checked={true} /> (1) หัก ณ ที่จ่าย</span>
        <span><CBBoxProfile checked={false} /> (2) ออกให้ตลอดไป</span>
        <span><CBBoxProfile checked={false} /> (3) ออกให้ครั้งเดียว</span>
        <span><CBBoxProfile checked={false} /> (4) อื่นๆ (ระบุ) ..................</span>
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
