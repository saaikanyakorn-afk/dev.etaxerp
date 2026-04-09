import Layout from "@/components/layout";
import SettingsTabs from "@/components/settings-tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, UserPlus, Pencil, UserCheck, UserX, Users, Lock, ChevronRight, Settings2, KeyRound, Eye, EyeOff, ShoppingCart, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useCompany } from "@/lib/company-context";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { PERMISSION_MODULES, ROLE_LABELS, SUB_MODULES, getSubModulesForModule, type Role } from "@shared/permissions";

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-100 text-red-700 border-red-200",
  manager: "bg-[#eef4ff] text-[var(--theme-primary)] border-[var(--theme-primary)]/20",
  accountant: "bg-emerald-100 text-emerald-700 border-emerald-200",
  employee: "bg-slate-100 text-slate-700 border-slate-200",
  client: "bg-amber-100 text-amber-700 border-amber-200",
};

interface UserForm {
  username: string;
  password: string;
  fullName: string;
  role: string;
  email: string;
  employeeId: string;
  lineId: string;
}

const emptyForm: UserForm = { username: "", password: "", fullName: "", role: "employee", email: "", employeeId: "", lineId: "" };

const ALL_ROLES: Role[] = ["admin", "manager", "accountant", "employee", "client"];
const MANAGER_ALLOWED_ROLES: Role[] = ["employee", "cashier"];

export default function UserManagement() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const { selectedCompanyId } = useCompany();
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [editForm, setEditForm] = useState<{ username: string; fullName: string; role: string; email: string; password: string; employeeId: string; lineId: string }>({ username: "", fullName: "", role: "", email: "", password: "", employeeId: "", lineId: "" });
  const [subPermUser, setSubPermUser] = useState<any>(null);
  const [subPermOpen, setSubPermOpen] = useState(false);
  const [resetPwUser, setResetPwUser] = useState<any>(null);
  const [resetPwOpen, setResetPwOpen] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showEditPw, setShowEditPw] = useState(false);
  const [showResetPw, setShowResetPw] = useState(false);
  const [resetPwValue, setResetPwValue] = useState("");
  const [allowedCompanyIds, setAllowedCompanyIds] = useState<number[]>([]);

  const { data: usersData } = useQuery<any[]>({
    queryKey: ["/api/users", selectedCompanyId],
    queryFn: async () => {
      const params = selectedCompanyId ? `?companyId=${selectedCompanyId}` : "";
      const r = await fetch(`/api/users${params}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
  });
  const users = Array.isArray(usersData) ? usersData : [];

  const { data: allCompaniesData } = useQuery<any[]>({
    queryKey: ["/api/companies"],
    queryFn: async () => {
      const r = await fetch("/api/companies", { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
  });
  const allCompanies = Array.isArray(allCompaniesData) ? allCompaniesData : [];

  const { data: unlinkedEmps } = useQuery<any[]>({
    queryKey: ["/api/users/unlinked-employees"],
    queryFn: async () => {
      const r = await fetch("/api/users/unlinked-employees", { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    staleTime: 0,
    refetchOnMount: "always",
  });
  const unlinkedEmployees = Array.isArray(unlinkedEmps) ? unlinkedEmps : [];

  const { data: permissionsData } = useQuery<any[]>({
    queryKey: ["/api/permissions"],
    queryFn: async () => {
      const r = await fetch("/api/permissions", { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
  });
  const permissions = Array.isArray(permissionsData) ? permissionsData : [];

  const { data: userSubPermsData, refetch: refetchSubPerms } = useQuery<any[]>({
    queryKey: ["/api/permissions/users/submodules", subPermUser?.id],
    queryFn: async () => {
      if (!subPermUser) return [];
      const r = await fetch(`/api/permissions/users/${subPermUser.id}/submodules`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!subPermUser,
  });
  const userSubPerms = Array.isArray(userSubPermsData) ? userSubPermsData : [];

  const isAllowed = (role: string, moduleKey: string): boolean => {
    if (role === "admin") return true;
    const perm = permissions.find(p => p.role === role && p.moduleKey === moduleKey);
    if (perm) return perm.allowed;
    const mod = PERMISSION_MODULES.find(m => m.key === moduleKey);
    if (mod) return mod.allowedRoles.includes(role as Role);
    const allSubs = SUB_MODULES;
    const sub = allSubs.find(s => s.key === moduleKey);
    if (sub) {
      return isAllowed(role, sub.parentModule);
    }
    return false;
  };

  const [localSubPerms, setLocalSubPerms] = useState<Map<string, boolean>>(new Map());
  const [subPermDirty, setSubPermDirty] = useState(false);

  useEffect(() => {
    if (subPermUser && userSubPerms.length > 0) {
      const map = new Map<string, boolean>();
      for (const p of userSubPerms) { map.set(p.subModuleKey, p.allowed); }
      setLocalSubPerms(map);
      setSubPermDirty(false);
    } else if (subPermUser) {
      setLocalSubPerms(new Map());
      setSubPermDirty(false);
    }
  }, [subPermUser?.id, userSubPerms]);

  const isSubModuleAllowed = (subKey: string): boolean => {
    if (!subPermUser) return true;
    if (subPermUser.role === "admin") return true;
    if (localSubPerms.has(subKey)) return localSubPerms.get(subKey)!;
    return true;
  };

  const toggleLocalSubPerm = (subKey: string, allowed: boolean) => {
    setLocalSubPerms(prev => {
      const next = new Map(prev);
      next.set(subKey, allowed);
      return next;
    });
    setSubPermDirty(true);
  };

  const togglePermMutation = useMutation({
    mutationFn: (data: { role: string; moduleKey: string; allowed: boolean }) =>
      fetch("/api/permissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      }).then(r => {
        if (!r.ok) return r.json().then(d => { throw new Error(d.message); });
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/permissions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/permissions/me"] });
      toast({ title: "บันทึกสิทธิ์สำเร็จ", variant: "success" as any });
    },
    onError: (err: any) => {
      toast({ title: "ไม่สำเร็จ", description: err.message, variant: "destructive" });
    },
  });

  const saveSubPermsMutation = useMutation({
    mutationFn: async () => {
      if (!subPermUser) throw new Error("No user selected");
      const newPerms = Array.from(localSubPerms.entries()).map(([subModuleKey, allowed]) => ({ subModuleKey, allowed }));
      const r = await fetch(`/api/permissions/users/${subPermUser.id}/submodules`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions: newPerms }),
        credentials: "include",
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.message); }
      return r.json();
    },
    onSuccess: () => {
      refetchSubPerms();
      queryClient.invalidateQueries({ queryKey: ["/api/permissions/me"] });
      setSubPermDirty(false);
      toast({ title: "บันทึกสิทธิ์เมนูย่อยสำเร็จ", variant: "success" as any });
    },
    onError: (err: any) => {
      toast({ title: "ไม่สำเร็จ", description: err.message, variant: "destructive" });
    },
  });

  const addUserMutation = useMutation({
    mutationFn: (data: UserForm) => fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      credentials: "include",
    }).then(r => {
      if (!r.ok) return r.json().then(d => { throw new Error(d.message); });
      return r.json();
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users/unlinked-employees"] });
      setAddOpen(false);
      setForm(emptyForm);
      toast({ title: "เพิ่มผู้ใช้สำเร็จ", variant: "success" as any });
    },
    onError: (err: any) => {
      toast({ title: "ไม่สำเร็จ", description: err.message, variant: "destructive" });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      credentials: "include",
    }).then(r => {
      if (!r.ok) return r.json().then(d => { throw new Error(d.message); });
      return r.json();
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users/unlinked-employees"] });
      setEditOpen(false);
      setEditingUser(null);
      toast({ title: "อัปเดตผู้ใช้สำเร็จ", variant: "success" as any });
    },
    onError: (err: any) => {
      toast({ title: "ไม่สำเร็จ", description: err.message, variant: "destructive" });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) => fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
      credentials: "include",
    }).then(r => {
      if (!r.ok) return r.json().then(d => { throw new Error(d.message); });
      return r.json();
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "อัปเดตสถานะสำเร็จ", variant: "success" as any });
    },
    onError: (err: any) => {
      toast({ title: "ไม่สำเร็จ", description: err.message, variant: "destructive" });
    },
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const { employeeId, lineId, ...rest } = form;
    const submitData: any = { ...rest, employeeId: employeeId && employeeId !== "none" ? Number(employeeId) : null, lineId: lineId || null };
    if (form.role === "client" || form.role === "accountant" || form.role === "employee" || form.role === "manager" || form.role === "cashier") {
      submitData.allowedCompanyIds = allowedCompanyIds.length > 0 ? allowedCompanyIds : null;
    }
    addUserMutation.mutate(submitData);
  };

  const handleEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    const data: any = {};
    if (editForm.username && editForm.username !== editingUser.username) data.username = editForm.username;
    if (editForm.fullName) data.fullName = editForm.fullName;
    if (editForm.role) data.role = editForm.role;
    if (editForm.email !== undefined) data.email = editForm.email;
    if (editForm.password) data.password = editForm.password;
    data.employeeId = editForm.employeeId && editForm.employeeId !== "none" ? Number(editForm.employeeId) : null;
    if (editForm.lineId !== undefined) data.lineId = editForm.lineId || null;
    if (editForm.role === "client" || editForm.role === "accountant" || editForm.role === "employee" || editForm.role === "manager" || editForm.role === "cashier") {
      data.allowedCompanyIds = allowedCompanyIds.length > 0 ? allowedCompanyIds : null;
    }
    updateUserMutation.mutate({ id: editingUser.id, data });
  };

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ userId, newPassword }: { userId: number; newPassword: string }) => {
      const r = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, newPassword }),
        credentials: "include",
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      setResetPwOpen(false);
      setResetPwUser(null);
      setResetPwValue("");
      toast({ title: "รีเซ็ตรหัสผ่านสำเร็จ", variant: "success" as any });
    },
    onError: (err: any) => {
      toast({ title: "ไม่สำเร็จ", description: err.message, variant: "destructive" });
    },
  });

  const openResetPw = (u: any) => {
    setResetPwUser(u);
    setResetPwValue("");
    setResetPwOpen(true);
  };

  const openEdit = (u: any) => {
    setEditingUser(u);
    setEditForm({ username: u.username, fullName: u.fullName, role: u.role, email: u.email || "", password: "", employeeId: u.linkedEmployee?.employeeId?.toString() || "", lineId: u.lineId || "" });
    setAllowedCompanyIds(u.allowedCompanyIds || []);
    setEditOpen(true);
  };

  const openSubPerms = (u: any) => {
    setSubPermUser(u);
    setSubPermOpen(true);
  };

  const activeCount = users.filter(u => u.active).length;
  const adminCount = users.filter(u => u.role === "admin").length;

  const modulesWithSubs = PERMISSION_MODULES.filter(m => {
    const subs = getSubModulesForModule(m.key);
    return subs.length > 0 && m.key !== "client-portal";
  });

  return (
    <Layout>
      <SettingsTabs />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6" style={{ color: "#03c9d7" }} />
            <h1 className="text-2xl font-bold" data-testid="text-user-mgmt-title">กำหนดสิทธิ์ผู้ใช้งาน</h1>
          </div>
          <Dialog open={addOpen} onOpenChange={(open) => {
            setAddOpen(open);
            if (open && selectedCompanyId) {
              setAllowedCompanyIds([selectedCompanyId]);
            }
          }}>
            <DialogTrigger asChild>
              <Button className="text-white hover:opacity-90" style={{ background: "#03c9d7" }} data-testid="button-add-user">
                <UserPlus className="mr-2 h-4 w-4" /> เพิ่มผู้ใช้ใหม่
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>เพิ่มผู้ใช้งานใหม่</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAdd} className="space-y-4">
                <div>
                  <Label>ชื่อผู้ใช้ (Username)</Label>
                  <Input data-testid="input-new-username" value={form.username} onChange={e => setForm({...form, username: e.target.value})} required />
                </div>
                <div>
                  <Label>รหัสผ่าน</Label>
                  <div className="relative">
                    <Input data-testid="input-new-password" type={showNewPw ? "text" : "password"} value={form.password} onChange={e => setForm({...form, password: e.target.value})} required className="pr-10" />
                    <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" data-testid="button-toggle-new-password" tabIndex={-1}>
                      {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <Label>ชื่อ-นามสกุล</Label>
                  <Input data-testid="input-new-fullname" value={form.fullName} onChange={e => setForm({...form, fullName: e.target.value})} required />
                </div>
                <div>
                  <Label>อีเมล</Label>
                  <Input data-testid="input-new-email" type="text" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
                </div>
                <div>
                  <Label>สิทธิ์การใช้งาน</Label>
                  <Select value={form.role} onValueChange={v => {
                    setForm({...form, role: v});
                    if ((v === "client" || v === "manager" || v === "cashier") && selectedCompanyId && allowedCompanyIds.length === 0) {
                      setAllowedCompanyIds([selectedCompanyId]);
                    }
                  }}>
                    <SelectTrigger data-testid="select-new-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(currentUser?.role === "manager" ? MANAGER_ALLOWED_ROLES : ALL_ROLES).map(r => (
                        <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>เชื่อมกับพนักงาน</Label>
                  <Select value={form.employeeId} onValueChange={v => setForm({...form, employeeId: v})}>
                    <SelectTrigger data-testid="select-new-employee">
                      <SelectValue placeholder="-- ไม่ระบุ (เชื่อมอัตโนมัติจากชื่อ) --" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">-- ไม่ระบุ --</SelectItem>
                      {unlinkedEmployees.map((emp: any) => (
                        <SelectItem key={emp.id} value={emp.id.toString()}>{emp.fullName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">หากไม่เลือก ระบบจะเชื่อมอัตโนมัติจากชื่อ-นามสกุลที่ตรงกัน</p>
                </div>
                <div>
                  <Label className="flex items-center gap-1.5">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#06C755" className="h-4 w-4"><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/></svg>
                    LINE User ID
                  </Label>
                  <Input
                    data-testid="input-new-lineid"
                    value={form.lineId}
                    onChange={e => setForm({...form, lineId: e.target.value})}
                    placeholder="U1234abcd..."
                  />
                  <p className="text-xs text-muted-foreground mt-1">สำหรับรับแจ้งเตือนอนุมัติใบลา/OT ผ่าน LINE</p>
                </div>
                {(form.role === "client" || form.role === "accountant" || form.role === "employee" || form.role === "manager" || form.role === "cashier") && (
                  <div>
                    <Label>บริษัทที่เข้าถึงได้</Label>
                    <div className="border rounded-md p-2 max-h-40 overflow-y-auto space-y-1 mt-1">
                      {[...allCompanies].sort((a: any, b: any) => {
                        if (a.id === selectedCompanyId) return -1;
                        if (b.id === selectedCompanyId) return 1;
                        return 0;
                      }).map((c: any) => (
                        <label key={c.id} className={`flex items-center gap-2 text-sm cursor-pointer rounded px-1 py-0.5 ${c.id === selectedCompanyId ? "bg-cyan-50 font-medium border border-cyan-200" : "hover:bg-muted/50"}`} data-testid={`checkbox-company-${c.id}`}>
                          <input type="checkbox" checked={allowedCompanyIds.includes(c.id)} onChange={e => {
                            if (e.target.checked) setAllowedCompanyIds([...allowedCompanyIds, c.id]);
                            else setAllowedCompanyIds(allowedCompanyIds.filter(id => id !== c.id));
                          }} className="rounded" />
                          {c.name}
                          {c.id === selectedCompanyId && <span className="text-xs text-cyan-600 ml-auto">(บริษัทปัจจุบัน)</span>}
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{form.role === "client" ? "เลือกบริษัทที่ผู้ใช้ลูกค้าสามารถเข้าถึงได้" : "เลือกบริษัทที่พนักงานสามารถเข้าถึงได้ (ไม่เลือก = เห็นตามที่ได้รับมอบหมาย)"}</p>
                  </div>
                )}
                <Button type="submit" className="w-full text-white hover:opacity-90" style={{ background: "#03c9d7" }} data-testid="button-submit-user" disabled={addUserMutation.isPending}>
                  {addUserMutation.isPending ? "กำลังบันทึก..." : "บันทึก"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border" style={{ background: "#e5f9fa", borderColor: "#03c9d7" }}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium" style={{ color: "#03c9d7" }}>ผู้ใช้งานทั้งหมด</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold flex items-center gap-2" data-testid="text-total-users" style={{ color: "#027a84" }}>
                <Users className="h-5 w-5" /> {users.length} คน
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">ใช้งานอยู่</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold flex items-center gap-2" data-testid="text-active-users" style={{ color: "#03c9d7" }}>
                <UserCheck className="h-5 w-5" /> {activeCount} คน
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">ผู้ดูแลระบบ</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600 flex items-center gap-2" data-testid="text-admin-count">
                <Shield className="h-5 w-5" /> {adminCount} คน
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-[#03c9d7]/5 border-[#03c9d7]/20">
          <CardContent className="py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <ShoppingCart className="h-4 w-4 text-[#03c9d7]" />
              <span>จัดการทีมงาน E-Commerce เฉพาะทาง — กำหนดร้าน/สิทธิ์แยกต่างหาก</span>
            </div>
            <Link href="/ecommerce/team">
              <Button variant="outline" size="sm" className="gap-1 border-[#03c9d7] text-[#03c9d7]" data-testid="link-ecom-team">
                <ExternalLink className="h-3.5 w-3.5" />
                ทีมงาน E-Commerce
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Tabs defaultValue="users">
          <TabsList>
            <TabsTrigger value="users" data-testid="tab-users">รายชื่อผู้ใช้งาน</TabsTrigger>
            <TabsTrigger value="permissions" data-testid="tab-permissions">สิทธิ์ตามระดับ</TabsTrigger>
            <TabsTrigger value="submodules" data-testid="tab-submodules">สิทธิ์เมนูย่อยรายบุคคล</TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>รายชื่อผู้ใช้งานและสิทธิ์</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ชื่อผู้ใช้</TableHead>
                      <TableHead>ชื่อ-นามสกุล</TableHead>
                      <TableHead>อีเมล</TableHead>
                      <TableHead>พนักงาน</TableHead>
                      <TableHead className="text-center">LINE</TableHead>
                      <TableHead className="text-center">สิทธิ์</TableHead>
                      <TableHead className="text-center">สถานะ</TableHead>
                      <TableHead className="text-center">จัดการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u: any) => (
                      <TableRow key={u.id} data-testid={`row-user-${u.id}`}>
                        <TableCell className="text-sm">{u.username}</TableCell>
                        <TableCell className="font-medium">{u.fullName}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{u.email || "-"}</TableCell>
                        <TableCell className="text-sm">
                          {u.linkedEmployee ? (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                              {u.linkedEmployee.employeeName}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {u.lineId ? (
                            <span title={u.lineId} className="inline-flex items-center gap-1">
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#06C755" className="h-4 w-4"><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/></svg>
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={ROLE_COLORS[u.role] || "bg-slate-100"}>
                            {ROLE_LABELS[u.role as Role] || u.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={u.active ? "default" : "secondary"} className={u.active ? "bg-[#05b187]" : "bg-slate-400"}>
                            {u.active ? "ใช้งาน" : "ระงับ"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 hover:opacity-80"
                              style={{ color: "#03c9d7" }}
                              onClick={() => openEdit(u)}
                              data-testid={`button-edit-user-${u.id}`}
                            >
                              <Pencil className="h-3.5 w-3.5 mr-1" /> แก้ไข
                            </Button>
                            {u.id !== currentUser?.id && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 hover:opacity-80"
                                  style={{ color: "#fb9678" }}
                                  onClick={() => openResetPw(u)}
                                  data-testid={`button-reset-pw-${u.id}`}
                                >
                                  <KeyRound className="h-3.5 w-3.5 mr-1" /> รีเซ็ตรหัส
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className={u.active ? "h-8 text-rose-500 hover:text-rose-700" : "h-8 hover:opacity-80"}
                                  style={!u.active ? { color: "#03c9d7" } : undefined}
                                  onClick={() => toggleActiveMutation.mutate({ id: u.id, active: !u.active })}
                                  data-testid={`button-toggle-user-${u.id}`}
                                >
                                  {u.active ? <><UserX className="h-3.5 w-3.5 mr-1" /> ระงับ</> : <><UserCheck className="h-3.5 w-3.5 mr-1" /> เปิดใช้</>}
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {users.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          ยังไม่มีข้อมูลผู้ใช้งาน
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="permissions">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" style={{ color: "#03c9d7" }} />
                  กำหนดสิทธิ์การเข้าถึงแต่ละเมนู (ตามระดับ)
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  กดเปิด/ปิด เพื่อกำหนดสิทธิ์ว่าแต่ละระดับสามารถเข้าถึงเมนูใดได้บ้าง (ผู้ดูแลระบบเข้าถึงได้ทุกเมนูเสมอ)
                </p>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[200px]">เมนู / ฟีเจอร์</TableHead>
                        <TableHead className="min-w-[140px]">รายละเอียด</TableHead>
                        {ALL_ROLES.map(role => (
                          <TableHead key={role} className="text-center min-w-[110px]">
                            <Badge variant="outline" className={ROLE_COLORS[role]}>
                              {ROLE_LABELS[role]}
                            </Badge>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {PERMISSION_MODULES.filter(m => m.key !== "client-portal").map(mod => {
                        const subs = getSubModulesForModule(mod.key);
                        return (
                          <>
                            <TableRow key={mod.key} data-testid={`row-perm-${mod.key}`} className="bg-gray-50/50">
                              <TableCell className="font-semibold">
                                <div className="flex items-center gap-1">
                                  {subs.length > 0 && <ChevronRight className="h-3.5 w-3.5 text-gray-400" />}
                                  {mod.label}
                                </div>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground max-w-[180px]">{mod.description}</TableCell>
                              {ALL_ROLES.map(role => {
                                const allowed = isAllowed(role, mod.key);
                                const isAdmin = role === "admin";
                                return (
                                  <TableCell key={role} className="text-center">
                                    {isAdmin ? (
                                      <div className="inline-flex items-center justify-center gap-1.5" title="ผู้ดูแลระบบเข้าถึงได้เสมอ">
                                        <Lock className="h-3.5 w-3.5 text-red-400" />
                                        <Switch checked={true} disabled className="data-[state=checked]:bg-red-500 opacity-60" />
                                      </div>
                                    ) : (
                                      <Switch
                                        checked={allowed}
                                        onCheckedChange={(checked) => {
                                          togglePermMutation.mutate({ role, moduleKey: mod.key, allowed: checked });
                                        }}
                                        data-testid={`switch-perm-${mod.key}-${role}`}
                                        className="data-[state=checked]:bg-[#05b187]"
                                      />
                                    )}
                                  </TableCell>
                                );
                              })}
                            </TableRow>
                            {subs.map(sub => (
                              <TableRow key={sub.key} data-testid={`row-perm-sub-${sub.key}`}>
                                <TableCell className="pl-10 text-sm text-gray-600">
                                  <span className="text-gray-300 mr-1">└</span> {sub.label}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">{sub.href}</TableCell>
                                {ALL_ROLES.map(role => {
                                  const parentAllowed = isAllowed(role, mod.key);
                                  const subAllowed = isAllowed(role, sub.key);
                                  const isAdmin = role === "admin";
                                  return (
                                    <TableCell key={role} className="text-center">
                                      {isAdmin ? (
                                        <Lock className="h-3.5 w-3.5 text-gray-300 mx-auto" />
                                      ) : !parentAllowed ? (
                                        <span className="text-xs text-gray-300">—</span>
                                      ) : (
                                        <Switch
                                          checked={subAllowed}
                                          onCheckedChange={(checked) => {
                                            togglePermMutation.mutate({ role, moduleKey: sub.key, allowed: checked });
                                          }}
                                          data-testid={`switch-perm-${sub.key}-${role}`}
                                          className="data-[state=checked]:bg-[#05b187]"
                                        />
                                      )}
                                    </TableCell>
                                  );
                                })}
                              </TableRow>
                            ))}
                          </>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="submodules">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings2 className="h-5 w-5" style={{ color: "#03c9d7" }} />
                  กำหนดสิทธิ์เมนูย่อยรายบุคคล
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  เลือกผู้ใช้เพื่อกำหนดว่าสามารถเข้าถึงเมนูย่อยใดได้บ้างภายในแต่ละโมดูล (ผู้ดูแลระบบเข้าถึงได้ทุกเมนูเสมอ)
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {users.filter(u => u.role !== "admin").map((u: any) => (
                    <div
                      key={u.id}
                      className="border rounded-lg p-4 hover:border-[var(--theme-primary)]/30 hover:bg-[#eef4ff]/30 transition-colors cursor-pointer group"
                      onClick={() => openSubPerms(u)}
                      data-testid={`card-subperm-user-${u.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{u.fullName}</p>
                          <p className="text-xs text-gray-500">{u.username}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`text-xs ${ROLE_COLORS[u.role] || ""}`}>
                            {ROLE_LABELS[u.role as Role] || u.role}
                          </Badge>
                          <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-[#03c9d7] transition-colors" />
                        </div>
                      </div>
                    </div>
                  ))}
                  {users.filter(u => u.role !== "admin").length === 0 && (
                    <div className="col-span-full text-center py-8 text-muted-foreground">
                      ไม่มีผู้ใช้ที่สามารถกำหนดสิทธิ์เมนูย่อยได้ (ผู้ดูแลระบบเข้าถึงทุกเมนูอยู่แล้ว)
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>แก้ไขผู้ใช้: {editingUser?.username}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleEdit} className="space-y-4">
              <div>
                <Label>ชื่อผู้ใช้ (Username)</Label>
                <Input data-testid="input-edit-username" value={editForm.username} onChange={e => setEditForm({...editForm, username: e.target.value})} />
              </div>
              <div>
                <Label>ชื่อ-นามสกุล</Label>
                <Input data-testid="input-edit-fullname" value={editForm.fullName} onChange={e => setEditForm({...editForm, fullName: e.target.value})} />
              </div>
              <div>
                <Label>อีเมล</Label>
                <Input data-testid="input-edit-email" type="text" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} />
              </div>
              <div>
                <Label>สิทธิ์การใช้งาน</Label>
                <Select value={editForm.role} onValueChange={v => setEditForm({...editForm, role: v})}>
                  <SelectTrigger data-testid="select-edit-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(currentUser?.role === "manager" ? MANAGER_ALLOWED_ROLES : ALL_ROLES).map(r => (
                      <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>เชื่อมกับพนักงาน</Label>
                <Select value={editForm.employeeId} onValueChange={v => setEditForm({...editForm, employeeId: v})}>
                  <SelectTrigger data-testid="select-edit-employee">
                    <SelectValue placeholder="-- ไม่เชื่อม --" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- ไม่เชื่อม --</SelectItem>
                    {editingUser?.linkedEmployee && (
                      <SelectItem value={editingUser.linkedEmployee.employeeId.toString()}>
                        {editingUser.linkedEmployee.employeeName} (เชื่อมอยู่)
                      </SelectItem>
                    )}
                    {unlinkedEmployees.map((emp: any) => (
                      <SelectItem key={emp.id} value={emp.id.toString()}>{emp.fullName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {(editForm.role === "client" || editForm.role === "accountant" || editForm.role === "employee" || editForm.role === "manager" || editForm.role === "cashier") && (
                <div>
                  <Label>บริษัทที่เข้าถึงได้</Label>
                  <div className="border rounded-md p-2 max-h-40 overflow-y-auto space-y-1 mt-1">
                    {[...allCompanies].sort((a: any, b: any) => {
                      if (a.id === selectedCompanyId) return -1;
                      if (b.id === selectedCompanyId) return 1;
                      return 0;
                    }).map((c: any) => (
                      <label key={c.id} className={`flex items-center gap-2 text-sm cursor-pointer rounded px-1 py-0.5 ${c.id === selectedCompanyId ? "bg-cyan-50 font-medium border border-cyan-200" : "hover:bg-muted/50"}`} data-testid={`checkbox-edit-company-${c.id}`}>
                        <input type="checkbox" checked={allowedCompanyIds.includes(c.id)} onChange={e => {
                          if (e.target.checked) setAllowedCompanyIds([...allowedCompanyIds, c.id]);
                          else setAllowedCompanyIds(allowedCompanyIds.filter(id => id !== c.id));
                        }} className="rounded" />
                        {c.name}
                        {c.id === selectedCompanyId && <span className="text-xs text-cyan-600 ml-auto">(บริษัทปัจจุบัน)</span>}
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{editForm.role === "client" ? "เลือกบริษัทที่ผู้ใช้ลูกค้าสามารถเข้าถึงได้" : "เลือกบริษัทที่พนักงานสามารถเข้าถึงได้ (ไม่เลือก = เห็นตามที่ได้รับมอบหมาย)"}</p>
                </div>
              )}
              <div>
                <Label className="flex items-center gap-1.5">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#06C755" className="h-4 w-4"><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/></svg>
                  LINE User ID
                </Label>
                <Input
                  data-testid="input-edit-lineid"
                  value={editForm.lineId}
                  onChange={e => setEditForm({...editForm, lineId: e.target.value})}
                  placeholder="U1234abcd..."
                />
                <p className="text-xs text-muted-foreground mt-1">สำหรับรับแจ้งเตือนอนุมัติใบลา/OT ผ่าน LINE</p>
              </div>
              <div>
                <Label>รหัสผ่านใหม่ (เว้นว่างถ้าไม่ต้องการเปลี่ยน)</Label>
                <div className="relative">
                  <Input data-testid="input-edit-password" type={showEditPw ? "text" : "password"} value={editForm.password} onChange={e => setEditForm({...editForm, password: e.target.value})} className="pr-10" />
                  <button type="button" onClick={() => setShowEditPw(!showEditPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" data-testid="button-toggle-edit-password" tabIndex={-1}>
                    {showEditPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full text-white hover:opacity-90" style={{ background: "#03c9d7" }} data-testid="button-submit-edit" disabled={updateUserMutation.isPending}>
                {updateUserMutation.isPending ? "กำลังบันทึก..." : "บันทึก"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={subPermOpen} onOpenChange={(open) => {
          if (!open && subPermDirty) {
            if (!confirm("คุณมีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก ต้องการปิดหน้าต่างนี้หรือไม่?")) return;
          }
          setSubPermOpen(open);
          if (!open) { setSubPermUser(null); setSubPermDirty(false); }
        }}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Settings2 className="h-5 w-5" style={{ color: "#03c9d7" }} />
                สิทธิ์เมนูย่อย: {subPermUser?.fullName}
                <Badge variant="outline" className={`ml-2 text-xs ${ROLE_COLORS[subPermUser?.role] || ""}`}>
                  {ROLE_LABELS[subPermUser?.role as Role] || subPermUser?.role}
                </Badge>
              </DialogTitle>
              <p className="text-sm text-muted-foreground">
                เปิด/ปิด เมนูย่อยที่ผู้ใช้สามารถเข้าถึงได้ — กดปุ่ม "บันทึก" เพื่อยืนยันการเปลี่ยนแปลง
              </p>
            </DialogHeader>

            {subPermUser && (
              <div className="space-y-4 mt-2">
                {modulesWithSubs.map(mod => {
                  const roleHasAccess = isAllowed(subPermUser.role, mod.key);
                  const subs = getSubModulesForModule(mod.key);

                  if (!roleHasAccess) return null;

                  return (
                    <div key={mod.key} className="border rounded-lg overflow-hidden">
                      <div className="bg-gray-50 px-4 py-2.5 border-b">
                        <h3 className="text-sm font-semibold text-gray-700">{mod.label}</h3>
                      </div>
                      <div className="divide-y">
                        {subs.map(sub => {
                          const allowed = isSubModuleAllowed(sub.key);
                          return (
                            <div key={sub.key} className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50/50" data-testid={`row-subperm-${sub.key}`}>
                              <span className="text-sm text-gray-700">{sub.label}</span>
                              <Switch
                                checked={allowed}
                                onCheckedChange={(checked) => {
                                  toggleLocalSubPerm(sub.key, checked);
                                }}
                                data-testid={`switch-subperm-${sub.key}`}
                                className="data-[state=checked]:bg-[#05b187]"
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                <div className="flex items-center justify-between pt-3 border-t">
                  {subPermDirty && (
                    <span className="text-sm text-amber-600 font-medium">* มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก</span>
                  )}
                  {!subPermDirty && <span />}
                  <Button
                    onClick={() => saveSubPermsMutation.mutate()}
                    disabled={!subPermDirty || saveSubPermsMutation.isPending}
                    className="text-white hover:opacity-90"
                    style={{ background: subPermDirty ? "#05b187" : "#ccc" }}
                    data-testid="button-save-subperms"
                  >
                    {saveSubPermsMutation.isPending ? "กำลังบันทึก..." : "บันทึก"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={resetPwOpen} onOpenChange={setResetPwOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5" style={{ color: "#fb9678" }} />
                รีเซ็ตรหัสผ่าน
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <p className="text-sm text-muted-foreground">
                ตั้งรหัสผ่านใหม่ให้ <span className="font-semibold text-foreground">{resetPwUser?.fullName}</span> ({resetPwUser?.username})
              </p>
              <div>
                <Label>รหัสผ่านใหม่</Label>
                <div className="relative mt-1">
                  <Input
                    type={showResetPw ? "text" : "password"}
                    value={resetPwValue}
                    onChange={e => setResetPwValue(e.target.value)}
                    placeholder="ระบุรหัสผ่านใหม่ (อย่างน้อย 4 ตัวอักษร)"
                    className="pr-10"
                    data-testid="input-reset-password"
                  />
                  <button type="button" onClick={() => setShowResetPw(!showResetPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" data-testid="button-toggle-reset-password" tabIndex={-1}>
                    {showResetPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setResetPwOpen(false)} data-testid="button-cancel-reset-pw">ยกเลิก</Button>
                <Button
                  className="text-white"
                  style={{ backgroundColor: "#fb9678" }}
                  onClick={() => resetPwUser && resetPasswordMutation.mutate({ userId: resetPwUser.id, newPassword: resetPwValue })}
                  disabled={resetPasswordMutation.isPending || resetPwValue.length < 4}
                  data-testid="button-confirm-reset-pw"
                >
                  {resetPasswordMutation.isPending ? "กำลังรีเซ็ต..." : "รีเซ็ตรหัสผ่าน"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
