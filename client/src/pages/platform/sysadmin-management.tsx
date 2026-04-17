import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import SysAdminLayout from "@/components/sysadmin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Shield, Plus, Eye, EyeOff, Pencil, Trash2, Check, X,
  Lock, Unlock, Key, AlertTriangle, Crown, UserCog,
  RefreshCw, Clock, Ban, CheckCircle2, Settings,
} from "lucide-react";

interface SysAdminUser {
  id: number;
  username: string;
  fullName: string;
  email: string | null;
  isMaster: boolean;
  active: boolean;
  mustChangePassword: boolean;
  passwordChangedAt: string | null;
  passwordExpiryDays: number;
  failedLoginAttempts: number;
  lockedUntil: string | null;
  lastLoginAt: string | null;
  lastLoginIp: string | null;
  createdAt: string;
  createdBy: number | null;
}

interface PasswordPolicy {
  id: number;
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecial: boolean;
  expiryDays: number;
  historyCount: number;
  maxFailedAttempts: number;
  lockoutMinutes: number;
  sessionTimeoutMinutes: number;
  require2fa: boolean;
  ipWhitelistEnabled: boolean;
  ipWhitelist: string[] | null;
}

interface AuditLogEntry {
  id: number;
  sysAdminId: number;
  sysAdminUsername: string;
  action: string;
  targetType: string | null;
  targetId: number | null;
  targetName: string | null;
  details: string | null;
  ipAddress: string | null;
  createdAt: string;
}

const BANNED_PASSWORDS_CLIENT = new Set([
  "password", "p@ssw0rd", "p@ssword", "passw0rd", "p@ss1234",
  "qwerty123", "qwerty1!", "qwerty12", "admin123", "admin@123",
  "admin1234", "letmein1", "welcome1", "changeme", "ch@ngeme",
  "12345678", "123456789", "abcd1234", "iloveyou", "trustno1",
  "sunshine", "master12", "superman", "test1234", "test@123",
  "root1234", "sysadmin", "sys@dm1n", "system12", "etaxcenter",
]);

function isCommonPasswordClient(pw: string): boolean {
  const lower = pw.toLowerCase();
  if (BANNED_PASSWORDS_CLIENT.has(lower)) return true;
  const norm = lower.replace(/@/g,"a").replace(/0/g,"o").replace(/1/g,"i").replace(/3/g,"e").replace(/\$/g,"s");
  if (BANNED_PASSWORDS_CLIENT.has(norm)) return true;
  if (/^(.)\1{5,}$/.test(lower)) return true;
  return false;
}

function PasswordStrengthBar({ password, policy }: { password: string; policy: PasswordPolicy | null }) {
  if (!policy || !password) return null;
  const isBanned = isCommonPasswordClient(password);
  let score = 0;
  const total = 6;
  if (password.length >= policy.minLength) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) score++;
  if (!isBanned) score++;
  const pct = (score / total) * 100;
  const color = isBanned ? "bg-red-500" : pct <= 33 ? "bg-red-500" : pct <= 50 ? "bg-orange-500" : pct <= 83 ? "bg-yellow-500" : "bg-green-500";
  const label = isBanned ? "รหัสที่ห้ามใช้" : pct <= 33 ? "อ่อน" : pct <= 50 ? "ปานกลาง" : pct <= 83 ? "ดี" : "แข็งแกร่ง";

  return (
    <div className="mt-1">
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-gray-400">ความแข็งแกร่ง</span>
        <span className={isBanned || pct <= 33 ? "text-red-500" : pct <= 83 ? "text-yellow-600" : "text-green-600"}>{label}</span>
      </div>
      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      {isBanned && (
        <p className="text-[10px] text-red-500 mt-1 flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" /> รหัสนี้อยู่ในรายการ "รหัสที่คาดเดาง่าย" ไม่สามารถใช้ได้
        </p>
      )}
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-[10px]">
        <span className={password.length >= policy.minLength ? "text-green-600" : "text-gray-400"}>
          {password.length >= policy.minLength ? "✓" : "✗"} {policy.minLength}+ ตัวอักษร
        </span>
        {policy.requireUppercase && (
          <span className={/[A-Z]/.test(password) ? "text-green-600" : "text-gray-400"}>
            {/[A-Z]/.test(password) ? "✓" : "✗"} A-Z
          </span>
        )}
        {policy.requireLowercase && (
          <span className={/[a-z]/.test(password) ? "text-green-600" : "text-gray-400"}>
            {/[a-z]/.test(password) ? "✓" : "✗"} a-z
          </span>
        )}
        {policy.requireNumbers && (
          <span className={/[0-9]/.test(password) ? "text-green-600" : "text-gray-400"}>
            {/[0-9]/.test(password) ? "✓" : "✗"} 0-9
          </span>
        )}
        {policy.requireSpecial && (
          <span className={/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password) ? "text-green-600" : "text-gray-400"}>
            {/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password) ? "✓" : "✗"} !@#$
          </span>
        )}
      </div>
    </div>
  );
}

function AddSysAdminDialog({ onClose, policy }: { onClose: () => void; policy: PasswordPolicy | null }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({ username: "", password: "", fullName: "", email: "", lineUserId: "" });
  const [showPw, setShowPw] = useState(false);

  const createMut = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await fetch("/api/sysadmin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...data, twoFactorMethod: "line" }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.errors?.join(", ") || err.message);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sysadmin/users"] });
      toast({ title: "เพิ่ม SysAdmin สำเร็จ" });
      onClose();
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" data-testid="dialog-add-sysadmin">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <UserCog className="h-5 w-5 text-[#fb9678]" /> เพิ่ม SysAdmin ใหม่
          </h2>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <Label className="text-sm font-medium">ชื่อ-นามสกุล *</Label>
            <Input value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} placeholder="ชื่อเต็ม" data-testid="input-sysadmin-fullname" />
          </div>
          <div>
            <Label className="text-sm font-medium">Username *</Label>
            <Input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} placeholder="sysadmin username" className="font-mono" data-testid="input-sysadmin-username" />
          </div>
          <div>
            <Label className="text-sm font-medium">Email</Label>
            <Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" data-testid="input-sysadmin-email" />
          </div>
          <div>
            <Label className="text-sm font-medium">LINE User ID * <span className="text-xs text-gray-400 font-normal">(2FA)</span></Label>
            <Input value={form.lineUserId} onChange={e => setForm({ ...form, lineUserId: e.target.value })} placeholder="Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" className="font-mono" data-testid="input-sysadmin-line-user-id" />
            <p className="text-xs text-gray-500 mt-1">ใช้ยืนยันตัวตน 2 ขั้นตอนผ่าน LINE OTP</p>
          </div>
          <div>
            <Label className="text-sm font-medium">รหัสผ่าน *</Label>
            <div className="flex gap-2">
              <Input
                className="font-mono flex-1"
                type={showPw ? "text" : "password"}
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                placeholder="รหัสผ่าน"
                data-testid="input-sysadmin-password"
              />
              <Button type="button" variant="outline" size="icon" onClick={() => setShowPw(!showPw)}>
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <PasswordStrengthBar password={form.password} policy={policy} />
            <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> ผู้ใช้จะถูกบังคับให้เปลี่ยนรหัสผ่านเมื่อ login ครั้งแรก
            </p>
          </div>
        </div>
        <div className="p-5 border-t flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} data-testid="btn-cancel-add-sysadmin">
            <X className="h-4 w-4 mr-1" /> ยกเลิก
          </Button>
          <Button
            className="bg-[#fb9678] hover:bg-[#e8855a] text-white"
            onClick={() => createMut.mutate(form)}
            disabled={createMut.isPending || !form.username || !form.password || !form.fullName || !form.lineUserId.trim()}
            data-testid="btn-save-sysadmin"
          >
            <Check className="h-4 w-4 mr-1" /> {createMut.isPending ? "กำลังบันทึก..." : "เพิ่ม SysAdmin"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ResetPasswordDialog({ admin, onClose, policy }: { admin: SysAdminUser; onClose: () => void; policy: PasswordPolicy | null }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [newPassword, setNewPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  const resetMut = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/sysadmin/users/${admin.id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ newPassword }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.errors?.join(", ") || err.message);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sysadmin/users"] });
      toast({ title: "รีเซ็ตรหัสผ่านสำเร็จ" });
      onClose();
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" data-testid="dialog-reset-password">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b">
          <h2 className="text-lg font-bold">รีเซ็ตรหัสผ่าน: {admin.fullName}</h2>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <Label className="text-sm font-medium">รหัสผ่านใหม่ *</Label>
            <div className="flex gap-2">
              <Input
                className="font-mono flex-1"
                type={showPw ? "text" : "password"}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="รหัสผ่านใหม่"
                data-testid="input-reset-password"
              />
              <Button type="button" variant="outline" size="icon" onClick={() => setShowPw(!showPw)}>
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <PasswordStrengthBar password={newPassword} policy={policy} />
            <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> ผู้ใช้จะถูกบังคับให้เปลี่ยนรหัสผ่านเมื่อ login ครั้งถัดไป
            </p>
          </div>
        </div>
        <div className="p-5 border-t flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            <X className="h-4 w-4 mr-1" /> ยกเลิก
          </Button>
          <Button
            className="bg-[#fb9678] hover:bg-[#e8855a] text-white"
            onClick={() => resetMut.mutate()}
            disabled={resetMut.isPending || !newPassword}
            data-testid="btn-confirm-reset-password"
          >
            <Key className="h-4 w-4 mr-1" /> {resetMut.isPending ? "กำลังรีเซ็ต..." : "รีเซ็ตรหัสผ่าน"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function PolicySettingsDialog({ policy, onClose }: { policy: PasswordPolicy; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({
    minLength: policy.minLength,
    requireUppercase: policy.requireUppercase,
    requireLowercase: policy.requireLowercase,
    requireNumbers: policy.requireNumbers,
    requireSpecial: policy.requireSpecial,
    expiryDays: policy.expiryDays,
    historyCount: policy.historyCount,
    maxFailedAttempts: policy.maxFailedAttempts,
    lockoutMinutes: policy.lockoutMinutes,
    sessionTimeoutMinutes: policy.sessionTimeoutMinutes,
    require2fa: policy.require2fa,
    ipWhitelistEnabled: policy.ipWhitelistEnabled,
    ipWhitelist: (policy.ipWhitelist || []).join("\n"),
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        ipWhitelist: form.ipWhitelist.split("\n").map(s => s.trim()).filter(Boolean),
      };
      const res = await fetch("/api/sysadmin/password-policy", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sysadmin/password-policy"] });
      toast({ title: "บันทึก Password Policy สำเร็จ" });
      onClose();
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" data-testid="dialog-password-policy">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Settings className="h-5 w-5 text-[#fb9678]" /> Password Policy
          </h2>
        </div>
        <div className="p-5 space-y-5">
          <div>
            <h3 className="text-sm font-semibold mb-3">ความแข็งแกร่งรหัสผ่าน</h3>
            <div className="space-y-3">
              <div>
                <Label className="text-sm">ความยาวขั้นต่ำ</Label>
                <Input type="number" min={6} max={32} value={form.minLength} onChange={e => setForm({ ...form, minLength: Number(e.target.value) })} data-testid="input-policy-min-length" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">ตัวพิมพ์ใหญ่ (A-Z)</Label>
                  <Switch checked={form.requireUppercase} onCheckedChange={v => setForm({ ...form, requireUppercase: v })} data-testid="switch-policy-uppercase" />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">ตัวพิมพ์เล็ก (a-z)</Label>
                  <Switch checked={form.requireLowercase} onCheckedChange={v => setForm({ ...form, requireLowercase: v })} data-testid="switch-policy-lowercase" />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">ตัวเลข (0-9)</Label>
                  <Switch checked={form.requireNumbers} onCheckedChange={v => setForm({ ...form, requireNumbers: v })} data-testid="switch-policy-numbers" />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">อักขระพิเศษ</Label>
                  <Switch checked={form.requireSpecial} onCheckedChange={v => setForm({ ...form, requireSpecial: v })} data-testid="switch-policy-special" />
                </div>
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold mb-3">อายุรหัสผ่านและประวัติ</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">หมดอายุทุกกี่วัน</Label>
                <Input type="number" min={0} max={365} value={form.expiryDays} onChange={e => setForm({ ...form, expiryDays: Number(e.target.value) })} data-testid="input-policy-expiry-days" />
              </div>
              <div>
                <Label className="text-sm">จำรหัสผ่านเก่ากี่ชุด</Label>
                <Input type="number" min={0} max={24} value={form.historyCount} onChange={e => setForm({ ...form, historyCount: Number(e.target.value) })} data-testid="input-policy-history-count" />
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold mb-3">การล็อคบัญชีและ Session</h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-sm">ล็อคหลังใส่ผิดกี่ครั้ง</Label>
                <Input type="number" min={1} max={20} value={form.maxFailedAttempts} onChange={e => setForm({ ...form, maxFailedAttempts: Number(e.target.value) })} data-testid="input-policy-max-attempts" />
              </div>
              <div>
                <Label className="text-sm">ล็อคกี่นาที</Label>
                <Input type="number" min={1} max={1440} value={form.lockoutMinutes} onChange={e => setForm({ ...form, lockoutMinutes: Number(e.target.value) })} data-testid="input-policy-lockout-minutes" />
              </div>
              <div>
                <Label className="text-sm">Session Timeout</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.sessionTimeoutMinutes}
                  onChange={e => setForm({ ...form, sessionTimeoutMinutes: Number(e.target.value) })}
                  data-testid="select-session-timeout"
                >
                  <option value={5}>5 นาที</option>
                  <option value={10}>10 นาที</option>
                  <option value={15}>15 นาที</option>
                </select>
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-1">ตัวเลือกเสริม <Badge variant="outline" className="text-[10px]">Optional</Badge></h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm">2FA (Two-Factor Authentication)</Label>
                  <p className="text-xs text-gray-400">บังคับยืนยันตัวตน 2 ขั้นตอน</p>
                </div>
                <Switch checked={form.require2fa} onCheckedChange={v => setForm({ ...form, require2fa: v })} data-testid="switch-policy-2fa" />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm">IP Whitelist</Label>
                  <p className="text-xs text-gray-400">จำกัดเฉพาะ IP ที่อนุญาต</p>
                </div>
                <Switch checked={form.ipWhitelistEnabled} onCheckedChange={v => setForm({ ...form, ipWhitelistEnabled: v })} data-testid="switch-policy-ip-whitelist" />
              </div>
              {form.ipWhitelistEnabled && (
                <div>
                  <Label className="text-sm">IP ที่อนุญาต (บรรทัดละ 1 IP)</Label>
                  <textarea
                    className="w-full font-mono text-sm border rounded-lg p-3 min-h-[80px] resize-y focus:outline-none focus:ring-2 focus:ring-[#fb9678]"
                    value={form.ipWhitelist}
                    onChange={e => setForm({ ...form, ipWhitelist: e.target.value })}
                    placeholder={"192.168.1.100\n10.0.0.1"}
                    data-testid="textarea-ip-whitelist"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="p-5 border-t flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            <X className="h-4 w-4 mr-1" /> ยกเลิก
          </Button>
          <Button
            className="bg-[#fb9678] hover:bg-[#e8855a] text-white"
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending}
            data-testid="btn-save-policy"
          >
            <Check className="h-4 w-4 mr-1" /> {saveMut.isPending ? "กำลังบันทึก..." : "บันทึก"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function formatDate(d: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  return dt.toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" }) + " " + dt.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

export default function SysAdminManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [showPolicy, setShowPolicy] = useState(false);
  const [resetTarget, setResetTarget] = useState<SysAdminUser | null>(null);
  const [activeTab, setActiveTab] = useState<"users" | "audit">("users");

  const { data: admins = [], isLoading } = useQuery<SysAdminUser[]>({
    queryKey: ["/api/sysadmin/users"],
  });

  const { data: policy } = useQuery<PasswordPolicy>({
    queryKey: ["/api/sysadmin/password-policy"],
  });

  const { data: auditData } = useQuery<{ logs: AuditLogEntry[]; total: number }>({
    queryKey: ["/api/sysadmin/audit-log"],
    enabled: activeTab === "audit",
  });

  const { data: meData } = useQuery<SysAdminUser & { mustChangePassword: boolean }>({
    queryKey: ["/api/sysadmin/me"],
  });

  const toggleActiveMut = useMutation({
    mutationFn: async ({ id, active }: { id: number; active: boolean }) => {
      const res = await fetch(`/api/sysadmin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ active }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sysadmin/users"] });
      toast({ title: "อัพเดทสถานะสำเร็จ" });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const forceChangeMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/sysadmin/users/${id}/force-change-password`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sysadmin/users"] });
      toast({ title: "บังคับเปลี่ยนรหัสผ่านสำเร็จ" });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const unlockMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/sysadmin/users/${id}/unlock`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sysadmin/users"] });
      toast({ title: "ปลดล็อคบัญชีสำเร็จ" });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/sysadmin/users/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sysadmin/users"] });
      toast({ title: "ลบ SysAdmin สำเร็จ" });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const isMasterCaller = meData?.isMaster;

  const getPasswordStatus = (admin: SysAdminUser) => {
    if (admin.mustChangePassword) return { label: "ต้องเปลี่ยนรหัส", color: "text-amber-600 bg-amber-50 border-amber-300" };
    if (!admin.passwordChangedAt) return { label: "ยังไม่เคยเปลี่ยน", color: "text-red-600 bg-red-50 border-red-300" };
    const daysSince = Math.floor((Date.now() - new Date(admin.passwordChangedAt).getTime()) / 86400000);
    if (daysSince >= admin.passwordExpiryDays) return { label: "หมดอายุ", color: "text-red-600 bg-red-50 border-red-300" };
    if (daysSince >= admin.passwordExpiryDays - 14) return { label: `หมดอายุใน ${admin.passwordExpiryDays - daysSince} วัน`, color: "text-amber-600 bg-amber-50 border-amber-300" };
    return { label: `เปลี่ยนล่าสุด ${daysSince} วันก่อน`, color: "text-green-600 bg-green-50 border-green-300" };
  };

  const isLocked = (admin: SysAdminUser) => admin.lockedUntil && new Date(admin.lockedUntil) > new Date();

  return (
    <SysAdminLayout>
      <div className="max-w-6xl mx-auto" data-testid="page-sysadmin-management">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Shield className="h-7 w-7 text-[#fb9678]" />
              จัดการ SysAdmin
              <Badge variant="outline" className="text-xs ml-1">{admins.length} คน</Badge>
            </h1>
            <p className="text-sm text-gray-500 mt-1">จัดการผู้ดูแลระบบ Password Policy และความปลอดภัย</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1 mr-2">
              <button
                onClick={() => setActiveTab("users")}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === "users" ? "bg-[#fb9678] text-white" : "text-gray-500 hover:bg-gray-100"}`}
                data-testid="tab-users"
              >
                <UserCog className="h-4 w-4 inline mr-1" /> ผู้ดูแล
              </button>
              <button
                onClick={() => setActiveTab("audit")}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === "audit" ? "bg-[#fb9678] text-white" : "text-gray-500 hover:bg-gray-100"}`}
                data-testid="tab-audit"
              >
                <Clock className="h-4 w-4 inline mr-1" /> Audit Log
              </button>
            </div>
            {isMasterCaller && (
              <Button size="sm" variant="outline" onClick={() => setShowPolicy(true)} className="h-9" data-testid="btn-open-policy">
                <Settings className="h-4 w-4 mr-1" /> Password Policy
              </Button>
            )}
            <Button size="sm" className="bg-[#fb9678] hover:bg-[#e8855a] text-white h-9" onClick={() => setShowAdd(true)} data-testid="btn-add-sysadmin">
              <Plus className="h-4 w-4 mr-1" /> เพิ่ม SysAdmin
            </Button>
          </div>
        </div>

        {activeTab === "users" && policy && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            <div className="bg-white border rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-[#fb9678]">{policy.minLength}</div>
              <div className="text-xs text-gray-500">ความยาวขั้นต่ำ</div>
            </div>
            <div className="bg-white border rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-[#fb9678]">{policy.expiryDays}</div>
              <div className="text-xs text-gray-500">วันหมดอายุ</div>
            </div>
            <div className="bg-white border rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-[#fb9678]">{policy.historyCount}</div>
              <div className="text-xs text-gray-500">จำรหัสเก่า</div>
            </div>
            <div className="bg-white border rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-[#fb9678]">{policy.maxFailedAttempts}</div>
              <div className="text-xs text-gray-500">ใส่ผิดก่อนล็อค</div>
            </div>
            <div className="bg-white border rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-[#fb9678]">{policy.lockoutMinutes}</div>
              <div className="text-xs text-gray-500">นาทีล็อค</div>
            </div>
          </div>
        )}

        {activeTab === "users" && (isLoading ? (
          <div className="text-center py-12 text-gray-400">กำลังโหลด...</div>
        ) : admins.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Shield className="h-16 w-16 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500">ยังไม่มี SysAdmin ในระบบ</p>
              <Button className="mt-4 bg-[#fb9678] hover:bg-[#e8855a] text-white" onClick={() => setShowAdd(true)}>
                <Plus className="h-4 w-4 mr-1" /> เพิ่ม SysAdmin คนแรก
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {admins.map(admin => {
              const pwStatus = getPasswordStatus(admin);
              const locked = isLocked(admin);
              const canManage = !admin.isMaster || meData?.id === admin.id;
              return (
                <div
                  key={admin.id}
                  className={`bg-white border rounded-xl p-4 transition-all hover:shadow-sm ${admin.isMaster ? "border-amber-400 ring-1 ring-amber-200" : ""} ${!admin.active ? "opacity-60" : ""}`}
                  data-testid={`card-sysadmin-${admin.id}`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${admin.isMaster ? "bg-amber-100" : "bg-gray-100"}`}>
                      {admin.isMaster ? <Crown className="h-5 w-5 text-amber-600" /> : <UserCog className="h-5 w-5 text-gray-500" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm">{admin.fullName}</span>
                        <span className="text-xs text-gray-400 font-mono">@{admin.username}</span>
                        {admin.isMaster && <Badge className="bg-amber-500 text-white text-[10px] px-1.5 py-0">Master</Badge>}
                        {!admin.active && <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-red-300 text-red-500">ระงับ</Badge>}
                        {locked && <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-red-300 text-red-500 flex items-center gap-0.5"><Lock className="h-2.5 w-2.5" /> ล็อค</Badge>}
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-gray-500">
                        {admin.email && <span>{admin.email}</span>}
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> เข้าสู่ระบบล่าสุด: {formatDate(admin.lastLoginAt)}
                        </span>
                        {admin.lastLoginIp && <span className="font-mono text-[10px]">IP: {admin.lastLoginIp}</span>}
                      </div>

                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${pwStatus.color}`}>
                          <Key className="h-2.5 w-2.5 mr-0.5" /> {pwStatus.label}
                        </Badge>
                        {admin.failedLoginAttempts > 0 && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-orange-300 text-orange-600">
                            ใส่ผิด {admin.failedLoginAttempts} ครั้ง
                          </Badge>
                        )}
                      </div>
                    </div>

                    {canManage && (
                      <div className="flex items-center gap-1 shrink-0">
                        {locked && (
                          <Button size="sm" variant="outline" className="h-7 text-xs border-green-400 text-green-700" onClick={() => unlockMut.mutate(admin.id)} data-testid={`btn-unlock-${admin.id}`}>
                            <Unlock className="h-3 w-3 mr-1" /> ปลดล็อค
                          </Button>
                        )}
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setResetTarget(admin)} data-testid={`btn-reset-pw-${admin.id}`}>
                          <Key className="h-3 w-3 mr-1" /> รีเซ็ตรหัส
                        </Button>
                        {!admin.mustChangePassword && (
                          <Button size="sm" variant="outline" className="h-7 text-xs border-amber-400 text-amber-700" onClick={() => forceChangeMut.mutate(admin.id)} data-testid={`btn-force-change-${admin.id}`}>
                            <RefreshCw className="h-3 w-3 mr-1" /> บังคับเปลี่ยนรหัส
                          </Button>
                        )}
                        {!admin.isMaster && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className={`h-7 text-xs ${admin.active ? "border-red-300 text-red-600" : "border-green-400 text-green-700"}`}
                              onClick={() => toggleActiveMut.mutate({ id: admin.id, active: !admin.active })}
                              data-testid={`btn-toggle-active-${admin.id}`}
                            >
                              {admin.active ? <><Ban className="h-3 w-3 mr-1" /> ระงับ</> : <><CheckCircle2 className="h-3 w-3 mr-1" /> เปิดใช้งาน</>}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-red-500 hover:text-red-700"
                              onClick={() => { if (confirm(`ยืนยันลบ ${admin.fullName}?`)) deleteMut.mutate(admin.id); }}
                              data-testid={`btn-delete-${admin.id}`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        {activeTab === "audit" && (
          <div className="bg-white border rounded-xl overflow-hidden" data-testid="audit-log-section">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="text-left px-4 py-3 font-medium text-gray-600">เวลา</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">ผู้ดำเนินการ</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">การกระทำ</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">เป้าหมาย</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">รายละเอียด</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {(!auditData?.logs || auditData.logs.length === 0) ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-gray-400">ยังไม่มี Audit Log</td>
                    </tr>
                  ) : auditData.logs.map(log => (
                    <tr key={log.id} className="border-b hover:bg-gray-50" data-testid={`audit-row-${log.id}`}>
                      <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">{formatDate(log.createdAt)}</td>
                      <td className="px-4 py-2.5 font-mono text-xs">{log.sysAdminUsername}</td>
                      <td className="px-4 py-2.5">
                        <Badge variant="outline" className="text-[10px]">{log.action}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-xs">{log.targetName || "—"}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-500 max-w-[200px] truncate">{log.details || "—"}</td>
                      <td className="px-4 py-2.5 font-mono text-[10px] text-gray-400">{log.ipAddress || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {auditData?.total && auditData.total > 0 && (
              <div className="px-4 py-2 border-t bg-gray-50 text-xs text-gray-500">
                แสดง {auditData.logs.length} จาก {auditData.total} รายการ
              </div>
            )}
          </div>
        )}
      </div>

      {showAdd && <AddSysAdminDialog onClose={() => setShowAdd(false)} policy={policy || null} />}
      {resetTarget && <ResetPasswordDialog admin={resetTarget} onClose={() => setResetTarget(null)} policy={policy || null} />}
      {showPolicy && policy && <PolicySettingsDialog policy={policy} onClose={() => setShowPolicy(false)} />}
    </SysAdminLayout>
  );
}
