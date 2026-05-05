import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  Shield,
  LogOut,
  UserCog,
  Network,
  ArrowLeftRight,
  Database,
  Wrench,
  Download,
  Key,
  Eye,
  EyeOff,
  AlertTriangle,
  Lock,
  ChevronDown,
  ChevronRight,
  MapPin,
  Router,
  Globe,
  Server,
  LayoutDashboard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface NavChild {
  label: string;
  href: string;
  icon: React.ElementType;
}

interface NavItem {
  icon: React.ElementType;
  label: string;
  href: string;
  children?: NavChild[];
}

const SYSADMIN_NAV: NavItem[] = [
  { icon: UserCog, label: "SysAdmin Users", href: "/sys-k7x9/users" },
  {
    icon: Network,
    label: "Infrastructure",
    href: "/sys-k7x9/infrastructure",
    children: [
      { icon: LayoutDashboard, label: "Overview", href: "/sys-k7x9/infrastructure" },
      { icon: Server,   label: "Machines",   href: "/sys-k7x9/infra/machines" },
      { icon: MapPin,   label: "Locations",  href: "/sys-k7x9/infra/locations" },
      { icon: Router,   label: "Routers",    href: "/sys-k7x9/infra/routers" },
      { icon: Globe,    label: "Domains",    href: "/sys-k7x9/infra/domains" },
    ],
  },
  { icon: ArrowLeftRight, label: "Database Switch",      href: "/sys-k7x9/db-switch" },
  { icon: Database,       label: "Clone Data",           href: "/sys-k7x9/clone-data" },
  { icon: Wrench,         label: "Maintenance Schedule", href: "/sys-k7x9/maintenance" },
  { icon: Download,       label: "Github Push & Pull",   href: "/sys-k7x9/github" },
];

interface SysAdminMe {
  id: number;
  username: string;
  fullName: string;
  isMaster: boolean;
  mustChangePassword: boolean;
  sessionTimeoutMinutes?: number;
}

function ForceChangePasswordScreen({ me, onChanged }: { me: SysAdminMe; onChanged: () => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) return;
    if (newPassword !== confirmPassword) {
      setError("รหัสผ่านใหม่ไม่ตรงกัน");
      return;
    }
    setError("");
    setErrors([]);
    setLoading(true);
    try {
      const res = await fetch("/api/sysadmin/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "เปลี่ยนรหัสผ่านไม่สำเร็จ");
        if (data.errors) setErrors(data.errors);
        return;
      }
      onChanged();
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    } finally {
      setLoading(false);
    }
  };

  const passwordChecks = newPassword ? [
    { ok: newPassword.length >= 8, label: "8+ ตัวอักษร" },
    { ok: /[A-Z]/.test(newPassword), label: "A-Z" },
    { ok: /[a-z]/.test(newPassword), label: "a-z" },
    { ok: /[0-9]/.test(newPassword), label: "0-9" },
    { ok: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(newPassword), label: "อักขระพิเศษ" },
  ] : [];

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4" data-testid="screen-force-change-password">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-amber-600 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-amber-900/30">
            <Lock className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white">เปลี่ยนรหัสผ่าน</h1>
          <p className="text-sm text-gray-400 mt-1">
            {me.fullName} — กรุณาเปลี่ยนรหัสผ่านก่อนเข้าใช้งาน
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-gray-800 border border-amber-700/50 rounded-xl p-6 space-y-4 shadow-2xl">
          {error && (
            <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-3 text-sm text-red-300">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  <span>{error}</span>
                  {errors.length > 0 && (
                    <ul className="mt-1 space-y-0.5 text-xs text-red-400">
                      {errors.map((e, i) => <li key={i}>• {e}</li>)}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}

          <div>
            <Label className="text-gray-300 text-sm">รหัสผ่านปัจจุบัน</Label>
            <div className="relative mt-1">
              <Input
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-500 pr-10"
                placeholder="••••••••"
                autoFocus
                autoComplete="off"
                data-testid="input-current-password"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                onClick={() => setShowCurrent(!showCurrent)}
              >
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <Label className="text-gray-300 text-sm">รหัสผ่านใหม่</Label>
            <div className="relative mt-1">
              <Input
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-500 pr-10"
                placeholder="••••••••"
                autoComplete="off"
                data-testid="input-new-password"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                onClick={() => setShowNew(!showNew)}
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {passwordChecks.length > 0 && (
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-[10px]">
                {passwordChecks.map((c, i) => (
                  <span key={i} className={c.ok ? "text-green-400" : "text-gray-500"}>
                    {c.ok ? "✓" : "✗"} {c.label}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label className="text-gray-300 text-sm">ยืนยันรหัสผ่านใหม่</Label>
            <div className="relative mt-1">
              <Input
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-500 pr-10"
                placeholder="••••••••"
                autoComplete="off"
                data-testid="input-confirm-password"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                onClick={() => setShowConfirm(!showConfirm)}
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="text-[10px] text-red-400 mt-1">รหัสผ่านไม่ตรงกัน</p>
            )}
          </div>

          <Button
            type="submit"
            disabled={loading || !currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword}
            className="w-full bg-amber-600 hover:bg-amber-700 text-white"
            data-testid="btn-change-password"
          >
            {loading ? "กำลังเปลี่ยน..." : (
              <span className="flex items-center gap-2"><Key className="h-4 w-4" /> เปลี่ยนรหัสผ่าน</span>
            )}
          </Button>
        </form>

        <div className="text-center mt-4">
          <p className="text-[10px] text-gray-600 font-mono">E-Tax Center — System Administration Console</p>
        </div>
      </div>
    </div>
  );
}

function NavGroup({ item, location }: { item: NavItem; location: string }) {
  const isChildActive = item.children?.some(c => location === c.href || location.startsWith(c.href + "/"));
  const isParentActive = location === item.href;
  const isAnyActive = isParentActive || isChildActive;
  const [open, setOpen] = useState(isAnyActive);

  useEffect(() => {
    if (isAnyActive) setOpen(true);
  }, [isAnyActive]);

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
          isAnyActive
            ? "bg-red-600/20 text-red-300 border border-red-500/30"
            : "text-gray-300 hover:bg-gray-700/50 hover:text-white"
        )}
        data-testid="nav-sys-infrastructure-toggle"
      >
        <item.icon className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left">{item.label}</span>
        {open
          ? <ChevronDown className="h-3 w-3 text-gray-400" />
          : <ChevronRight className="h-3 w-3 text-gray-400" />
        }
      </button>

      {open && item.children && (
        <div className="mt-0.5 ml-3 pl-3 border-l border-gray-700 space-y-0.5">
          {item.children.map((child) => {
            const childActive = location === child.href;
            return (
              <Link key={child.href} href={child.href}>
                <span
                  className={cn(
                    "flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer",
                    childActive
                      ? "bg-red-600/15 text-red-300"
                      : "text-gray-400 hover:bg-gray-700/40 hover:text-gray-200"
                  )}
                  data-testid={`nav-sys-${child.href.split("/").pop()}`}
                >
                  <child.icon className="h-3.5 w-3.5 shrink-0" />
                  {child.label}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function SysAdminLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: me, isLoading, isError } = useQuery<SysAdminMe>({
    queryKey: ["/api/sysadmin/me"],
    retry: false,
  });

  useEffect(() => {
    if (!isLoading && (isError || !me)) {
      setLocation("/sys-k7x9");
    }
  }, [isLoading, isError, me, setLocation]);

  const handleSessionExpired = useCallback(() => {
    queryClient.removeQueries({ queryKey: ["/api/sysadmin/me"] });
    toast({
      title: "Session หมดอายุ",
      description: "ไม่มีการใช้งานเกินกำหนด — กรุณาเข้าสู่ระบบใหม่",
      variant: "destructive",
      duration: 5000,
    });
    setTimeout(() => setLocation("/sys-k7x9"), 1500);
  }, [queryClient, setLocation, toast]);

  useEffect(() => {
    const interceptor = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      if (reason?.status === 440 || reason?.sessionExpired) {
        handleSessionExpired();
      }
    };
    window.addEventListener("unhandledrejection", interceptor);
    return () => window.removeEventListener("unhandledrejection", interceptor);
  }, [handleSessionExpired]);

  const handleLogout = async () => {
    await fetch("/api/sysadmin/logout", { method: "POST", credentials: "include" });
    queryClient.removeQueries({ queryKey: ["/api/sysadmin/me"] });
    setLocation("/sys-k7x9");
  };

  const handlePasswordChanged = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/sysadmin/me"] });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400">กำลังตรวจสอบสิทธิ์...</div>
      </div>
    );
  }

  if (!me) return null;

  if (me.mustChangePassword) {
    return <ForceChangePasswordScreen me={me} onChanged={handlePasswordChanged} />;
  }

  return (
    <div className="min-h-screen bg-gray-50/50 flex font-sans">
      <aside className="w-64 bg-gray-900 text-white border-r border-gray-700 hidden md:flex flex-col fixed h-full z-10 overflow-y-auto">
        <div className="h-16 flex items-center px-6 border-b border-gray-700 shrink-0">
          <div className="flex items-center gap-3 font-semibold text-lg">
            <div className="w-9 h-9 rounded-xl bg-red-600 flex items-center justify-center text-white shadow-lg shadow-red-900/30">
              <Shield className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-heading tracking-tight text-white leading-none">System Admin</span>
              <span className="text-[9px] font-medium text-red-400 uppercase tracking-widest mt-1">
                {me.isMaster ? "Master" : "Technician"}
              </span>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {SYSADMIN_NAV.map((item) => {
            if (item.children) {
              return <NavGroup key={item.href} item={item} location={location} />;
            }
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <span
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer",
                    isActive
                      ? "bg-red-600/20 text-red-300 border border-red-500/30"
                      : "text-gray-300 hover:bg-gray-700/50 hover:text-white"
                  )}
                  data-testid={`nav-sys-${item.href.split("/").pop()}`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-700 shrink-0">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="h-8 w-8 rounded-full bg-red-600/20 flex items-center justify-center">
              <UserCog className="h-5 w-5 text-red-400" />
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium truncate" data-testid="text-sysadmin-user">{me.fullName}</p>
              <p className="text-xs text-red-400/70 truncate font-mono">@{me.username}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="text-gray-400 hover:text-white hover:bg-gray-700"
              data-testid="btn-sysadmin-logout"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      <main className="flex-1 md:ml-64 flex flex-col min-h-screen">
        <div className="flex-1 p-4 w-full animate-in fade-in duration-500 overflow-x-hidden">
          {children}
        </div>
      </main>
    </div>
  );
}
