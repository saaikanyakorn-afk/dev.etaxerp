import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Shield, Eye, EyeOff, LogIn, AlertTriangle, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SysAdminLogin() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [bootstrapMode, setBootstrapMode] = useState(false);
  const [bootstrapChecked, setBootstrapChecked] = useState(false);

  const { data: me, isLoading: checkingSession } = useQuery<{ id: number }>({
    queryKey: ["/api/sysadmin/me"],
    retry: false,
  });

  useEffect(() => {
    if (me?.id) {
      setLocation("/sys-k7x9/users");
    }
  }, [me, setLocation]);

  useEffect(() => {
    if (!checkingSession && !me) {
      fetch("/api/sysadmin/users-count", { credentials: "include" })
        .then(r => r.json())
        .then(data => {
          if (data.count === 0) setBootstrapMode(true);
          setBootstrapChecked(true);
        })
        .catch(() => setBootstrapChecked(true));
    }
  }, [checkingSession, me]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setError("");
    setErrors([]);
    setLoading(true);
    try {
      const res = await fetch("/api/sysadmin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "เข้าสู่ระบบไม่สำเร็จ");
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/sysadmin/me"] });
      setLocation("/sys-k7x9/users");
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    } finally {
      setLoading(false);
    }
  };

  const handleBootstrap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password || !fullName.trim()) return;
    setError("");
    setErrors([]);
    setLoading(true);
    try {
      const res = await fetch("/api/sysadmin/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          username: username.trim(),
          password,
          fullName: fullName.trim(),
          email: email.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "สร้าง Master ไม่สำเร็จ");
        if (data.errors) setErrors(data.errors);
        return;
      }
      const loginRes = await fetch("/api/sysadmin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: username.trim(), password }),
      });
      if (loginRes.ok) {
        await queryClient.invalidateQueries({ queryKey: ["/api/sysadmin/me"] });
        setLocation("/sys-k7x9/users");
      } else {
        setBootstrapMode(false);
        setError("");
        setPassword("");
      }
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession || !bootstrapChecked) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-500 text-sm">กำลังตรวจสอบ...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4" data-testid="page-sysadmin-login">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl ${bootstrapMode ? "bg-amber-600 shadow-amber-900/30" : "bg-red-600 shadow-red-900/30"}`}>
            {bootstrapMode ? <UserPlus className="h-8 w-8 text-white" /> : <Shield className="h-8 w-8 text-white" />}
          </div>
          <h1 className="text-xl font-bold text-white">
            {bootstrapMode ? "สร้าง Master SysAdmin" : "System Admin"}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {bootstrapMode ? "ยังไม่มี SysAdmin ในระบบ สร้างคนแรกเพื่อเริ่มต้น" : "Authorized personnel only"}
          </p>
        </div>

        {bootstrapMode ? (
          <form onSubmit={handleBootstrap} className="bg-gray-800 border border-amber-700/50 rounded-xl p-6 space-y-4 shadow-2xl" data-testid="form-bootstrap">
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
              <Label className="text-gray-300 text-sm">ชื่อ-นามสกุล</Label>
              <Input
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-500 mt-1"
                placeholder="ชื่อเต็ม"
                autoFocus
                data-testid="input-bootstrap-fullname"
              />
            </div>

            <div>
              <Label className="text-gray-300 text-sm">Username</Label>
              <Input
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-500 mt-1"
                placeholder="username"
                autoComplete="off"
                data-testid="input-bootstrap-username"
              />
            </div>

            <div>
              <Label className="text-gray-300 text-sm">Email (ไม่บังคับ)</Label>
              <Input
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-500 mt-1"
                placeholder="email@example.com"
                data-testid="input-bootstrap-email"
              />
            </div>

            <div>
              <Label className="text-gray-300 text-sm">Password</Label>
              <div className="relative mt-1">
                <Input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-500 pr-10"
                  placeholder="••••••••"
                  autoComplete="off"
                  data-testid="input-bootstrap-password"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  onClick={() => setShowPw(!showPw)}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-[10px] text-gray-500 mt-1.5">8+ ตัวอักษร, A-Z, a-z, 0-9, อักขระพิเศษ</p>
            </div>

            <Button
              type="submit"
              disabled={loading || !username.trim() || !password || !fullName.trim()}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white"
              data-testid="btn-bootstrap-create"
            >
              {loading ? (
                <span className="flex items-center gap-2">กำลังสร้าง...</span>
              ) : (
                <span className="flex items-center gap-2"><UserPlus className="h-4 w-4" /> สร้าง Master SysAdmin</span>
              )}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="bg-gray-800 border border-gray-700 rounded-xl p-6 space-y-4 shadow-2xl">
            {error && (
              <div className="flex items-start gap-2 bg-red-900/30 border border-red-700/50 rounded-lg p-3 text-sm text-red-300">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <Label className="text-gray-300 text-sm">Username</Label>
              <Input
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-500 mt-1"
                placeholder="username"
                autoFocus
                autoComplete="off"
                data-testid="input-sysadmin-username"
              />
            </div>

            <div>
              <Label className="text-gray-300 text-sm">Password</Label>
              <div className="relative mt-1">
                <Input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-500 pr-10"
                  placeholder="••••••••"
                  autoComplete="off"
                  data-testid="input-sysadmin-password"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  onClick={() => setShowPw(!showPw)}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading || !username.trim() || !password}
              className="w-full bg-red-600 hover:bg-red-700 text-white"
              data-testid="btn-sysadmin-login"
            >
              {loading ? (
                <span className="flex items-center gap-2">กำลังเข้าสู่ระบบ...</span>
              ) : (
                <span className="flex items-center gap-2"><LogIn className="h-4 w-4" /> เข้าสู่ระบบ</span>
              )}
            </Button>
          </form>
        )}

        <div className="text-center mt-6">
          <p className="text-[10px] text-gray-600 font-mono">E-Tax Center — System Administration Console</p>
        </div>
      </div>
    </div>
  );
}
