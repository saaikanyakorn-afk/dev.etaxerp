import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Shield, Eye, EyeOff, LogIn, AlertTriangle, UserPlus,
  Smartphone, MessageCircle, Mail, ChevronRight, ChevronLeft,
  CheckCircle2, Key, Copy, Check, Loader2, Search, X,
} from "lucide-react";

type ForestLineEntry = {
  lineUserId: string;
  displayName: string;
  source?: string;
  lastSeenAt?: string | null;
};
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type TwoFAMethod = "totp" | "line" | "email";
type BootstrapStep = "info" | "line-verify";

export default function SysAdminLogin() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [lineUserId, setLineUserId] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [bootstrapMode, setBootstrapMode] = useState(false);
  const [bootstrapChecked, setBootstrapChecked] = useState(false);

  const [bootstrapStep, setBootstrapStep] = useState<BootstrapStep>("info");
  const [twoFAMethod, setTwoFAMethod] = useState<TwoFAMethod | "">("");

  const [lineSearch, setLineSearch] = useState("");
  const [lineSearchDebounced, setLineSearchDebounced] = useState("");
  const [linePickerOpen, setLinePickerOpen] = useState(false);
  const [selectedLineDisplayName, setSelectedLineDisplayName] = useState("");
  const linePickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setLineSearchDebounced(lineSearch.trim()), 250);
    return () => clearTimeout(t);
  }, [lineSearch]);

  const { data: forestLineResults = [], isFetching: forestLineFetching } = useQuery<ForestLineEntry[]>({
    queryKey: ["/api/sysadmin/forest-line-directory", lineSearchDebounced],
    enabled: bootstrapMode && linePickerOpen && lineSearchDebounced.length >= 1 && !lineUserId,
    queryFn: async () => {
      const res = await fetch(`/api/sysadmin/forest-line-directory?q=${encodeURIComponent(lineSearchDebounced)}`, { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : (data.items || []);
    },
    retry: false,
  });

  useEffect(() => {
    if (!linePickerOpen) return;
    const onClickAway = (e: MouseEvent) => {
      if (linePickerRef.current && !linePickerRef.current.contains(e.target as Node)) {
        setLinePickerOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickAway);
    return () => document.removeEventListener("mousedown", onClickAway);
  }, [linePickerOpen]);

  const handlePickLine = (entry: ForestLineEntry) => {
    setLineUserId(entry.lineUserId);
    setSelectedLineDisplayName(entry.displayName);
    setLineSearch(entry.displayName);
    setLinePickerOpen(false);
  };

  const handleClearLine = () => {
    setLineUserId("");
    setSelectedLineDisplayName("");
    setLineSearch("");
    setLinePickerOpen(false);
  };

  const [totpUri, setTotpUri] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [verified, setVerified] = useState(false);
  const [copied, setCopied] = useState(false);

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

  const [loginPhase, setLoginPhase] = useState<"credentials" | "2fa">("credentials");
  const [login2faMethod, setLogin2faMethod] = useState<TwoFAMethod | "">("");
  const [loginOtpCode, setLoginOtpCode] = useState("");
  const [loginOtpSent, setLoginOtpSent] = useState(false);
  const [loginOtpSending, setLoginOtpSending] = useState(false);

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
      if (data.requires2FA) {
        setLogin2faMethod(data.twoFactorMethod);
        setLoginPhase("2fa");
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

  const handleLoginSendOtp = async () => {
    setLoginOtpSending(true);
    setError("");
    try {
      const res = await fetch("/api/sysadmin/login/send-otp", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message); return; }
      setLoginOtpSent(true);
    } catch { setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้"); }
    finally { setLoginOtpSending(false); }
  };

  const handleLoginVerify2FA = async () => {
    if (!loginOtpCode.trim()) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/sysadmin/login/verify-2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code: loginOtpCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "ยืนยันไม่สำเร็จ");
        if (res.status === 429) {
          setLoginPhase("credentials");
          setLoginOtpCode("");
          setLoginOtpSent(false);
          setPassword("");
        }
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/sysadmin/me"] });
      setLocation("/sys-k7x9/users");
    } catch { setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้"); }
    finally { setLoading(false); }
  };

  const [resendCountdown, setResendCountdown] = useState(0);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const t = setTimeout(() => setResendCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCountdown]);

  const handleBootstrapCreate = async () => {
    if (!username.trim() || !password || !fullName.trim() || !lineUserId) return;
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
          lineUserId,
          twoFactorMethod: "line",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "สร้าง Master ไม่สำเร็จ");
        if (data.errors) setErrors(data.errors);
        return;
      }
      setBootstrapStep("line-verify");
      void handleSendOtp(true);
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (silent = false) => {
    setOtpSending(true);
    if (!silent) setError("");
    try {
      const res = await fetch("/api/sysadmin/bootstrap/send-otp", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "ส่ง OTP ไม่สำเร็จ");
        return;
      }
      setOtpSent(true);
      setResendCountdown(60);
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    } finally {
      setOtpSending(false);
    }
  };

  const handleVerify2FA = async () => {
    if (!otpCode.trim()) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/sysadmin/bootstrap/verify-2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code: otpCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "ยืนยันไม่สำเร็จ");
        return;
      }
      setVerified(true);
      await handleFinishBootstrap();
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    } finally {
      setLoading(false);
    }
  };

  const handleSkipEmail = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/sysadmin/bootstrap/skip-email-2fa", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "บันทึกไม่สำเร็จ");
        return;
      }
      setVerified(true);
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    } finally {
      setLoading(false);
    }
  };

  const handleFinishBootstrap = async () => {
    setLoading(true);
    try {
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

  const handleCopyUri = () => {
    navigator.clipboard.writeText(totpUri);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const passwordChecks = password ? [
    { ok: password.length >= 8, label: "8+ ตัวอักษร" },
    { ok: /[A-Z]/.test(password), label: "A-Z" },
    { ok: /[a-z]/.test(password), label: "a-z" },
    { ok: /[0-9]/.test(password), label: "0-9" },
    { ok: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password), label: "อักขระพิเศษ" },
  ] : [];

  if (checkingSession || !bootstrapChecked) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-500 text-sm">กำลังตรวจสอบ...</div>
      </div>
    );
  }

  const errorBox = error ? (
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
  ) : null;

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4" data-testid="page-sysadmin-login">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl ${bootstrapMode ? "bg-amber-600 shadow-amber-900/30" : "bg-red-600 shadow-red-900/30"}`}>
            {bootstrapMode ? <UserPlus className="h-8 w-8 text-white" /> : <Shield className="h-8 w-8 text-white" />}
          </div>
          <h1 className="text-xl font-bold text-white">
            {bootstrapMode ? "สร้าง Master SysAdmin" : "System Admin"}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {bootstrapMode
              ? bootstrapStep === "info" ? "ขั้นตอนที่ 1/2 — ข้อมูลพื้นฐาน"
                : "ขั้นตอนที่ 2/2 — ยืนยันรหัส LINE"
              : "Authorized personnel only"
            }
          </p>
          {bootstrapMode && (
            <div className="flex justify-center gap-1.5 mt-3">
              {["info", "line-verify"].map((s, i) => (
                <div key={s} className={`h-1.5 rounded-full transition-all ${
                  s === bootstrapStep ? "w-8 bg-amber-500" :
                  ["info", "line-verify"].indexOf(bootstrapStep) > i ? "w-4 bg-amber-500/50" : "w-4 bg-gray-700"
                }`} />
              ))}
            </div>
          )}
        </div>

        {bootstrapMode ? (
          <>
            {bootstrapStep === "info" && (
              <div className="bg-gray-800 border border-amber-700/50 rounded-xl p-6 space-y-4 shadow-2xl" data-testid="form-bootstrap-info">
                {errorBox}

                <div>
                  <Label className="text-gray-300 text-sm">ชื่อ-นามสกุล *</Label>
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
                  <Label className="text-gray-300 text-sm">Username *</Label>
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
                  <Label className="text-gray-300 text-sm">Email</Label>
                  <Input
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-500 mt-1"
                    placeholder="email@example.com"
                    data-testid="input-bootstrap-email"
                  />
                </div>

                <div>
                  <Label className="text-gray-300 text-sm">Password *</Label>
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

                <div ref={linePickerRef} className="relative">
                  <Label className="text-gray-300 text-sm">LINE *</Label>
                  <div className="relative mt-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
                    <Input
                      value={lineSearch}
                      onChange={e => {
                        setLineSearch(e.target.value);
                        if (lineUserId) {
                          setLineUserId("");
                          setSelectedLineDisplayName("");
                        }
                        setLinePickerOpen(true);
                      }}
                      onFocus={() => setLinePickerOpen(true)}
                      className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-500 pl-9 pr-9"
                      placeholder="ค้นหาด้วยชื่อ / ชื่อบัญชี LINE"
                      autoComplete="off"
                      data-testid="input-bootstrap-line-search"
                    />
                    {lineSearch && (
                      <button
                        type="button"
                        onClick={handleClearLine}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                        data-testid="btn-clear-line"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {lineUserId && selectedLineDisplayName && !linePickerOpen && (
                    <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-green-400" data-testid="badge-line-verified">
                      <CheckCircle2 className="h-3 w-3" />
                      ทราบจาก Forest — {selectedLineDisplayName}
                    </div>
                  )}

                  {linePickerOpen && !lineUserId && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-2xl max-h-64 overflow-y-auto z-50" data-testid="dropdown-line-picker">
                      {lineSearchDebounced.length < 1 ? (
                        <div className="p-3 text-xs text-gray-500 text-center">
                          พิมพ์ชื่อเพื่อค้นหา LINE ที่รู้จักใน Forest
                        </div>
                      ) : forestLineFetching ? (
                        <div className="p-3 text-xs text-gray-500 text-center flex items-center justify-center gap-2">
                          <Loader2 className="h-3 w-3 animate-spin" /> กำลังค้นหา...
                        </div>
                      ) : forestLineResults.length === 0 ? (
                        <div className="p-3 text-xs text-amber-300 text-center">
                          <AlertTriangle className="h-3.5 w-3.5 inline mr-1" />
                          ยังไม่พบใน Forest — เพิ่ม LINE Friend ของบอทก่อน แล้วค่อยกลับมาเลือก
                        </div>
                      ) : (
                        <ul className="py-1">
                          {forestLineResults.map((entry, i) => (
                            <li key={`${entry.lineUserId}-${i}`}>
                              <button
                                type="button"
                                onClick={() => handlePickLine(entry)}
                                className="w-full text-left px-3 py-2 hover:bg-gray-700 transition-colors flex items-start gap-2"
                                data-testid={`option-line-${i}`}
                              >
                                <MessageCircle className="h-4 w-4 text-green-400 mt-0.5 shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm text-white truncate">{entry.displayName}</div>
                                  {(entry.source || entry.lastSeenAt) && (
                                    <div className="text-[10px] text-gray-400 truncate">
                                      {entry.source && <span>{entry.source}</span>}
                                      {entry.source && entry.lastSeenAt && <span> · </span>}
                                      {entry.lastSeenAt && <span>เห็นล่าสุด {new Date(entry.lastSeenAt).toLocaleDateString("th-TH")}</span>}
                                    </div>
                                  )}
                                </div>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  <p className="text-[10px] text-gray-500 mt-1">
                    เลือกจากรายชื่อที่ Forest รู้จักเท่านั้น — ระบบจะส่งรหัสยืนยันไปที่ LINE นี้ทันทีเมื่อกดถัดไป
                  </p>
                </div>

                <Button
                  onClick={handleBootstrapCreate}
                  disabled={loading || !username.trim() || !password || !fullName.trim() || !lineUserId}
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                  data-testid="btn-bootstrap-create"
                >
                  {loading ? (
                    <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> กำลังสร้าง & ส่งรหัส...</span>
                  ) : (
                    <span className="flex items-center gap-2">ถัดไป — ส่งรหัสไปที่ LINE <ChevronRight className="h-4 w-4" /></span>
                  )}
                </Button>
              </div>
            )}

            {bootstrapStep === "line-verify" && !verified && (
              <div className="bg-gray-800 border border-amber-700/50 rounded-xl p-6 space-y-4 shadow-2xl" data-testid="form-bootstrap-line-verify">
                {errorBox}

                <div className="text-center">
                  <div className="w-14 h-14 rounded-2xl bg-green-600 flex items-center justify-center mx-auto mb-3">
                    <MessageCircle className="h-7 w-7 text-white" />
                  </div>
                  <p className="text-sm text-gray-300">ส่งรหัสยืนยันไปที่ LINE แล้ว</p>
                  {selectedLineDisplayName && (
                    <p className="text-xs text-green-400 mt-1" data-testid="text-line-target">
                      <CheckCircle2 className="h-3 w-3 inline mr-1" />
                      {selectedLineDisplayName}
                    </p>
                  )}
                </div>

                <div className="bg-green-900/20 border border-green-700/40 rounded-lg p-3 text-xs text-green-300 text-center">
                  เปิดแอป LINE ของคุณเพื่อรับรหัส 6 หลัก (หมดอายุ 5 นาที)
                </div>

                <div>
                  <Label className="text-gray-300 text-sm">กรอกรหัสยืนยัน 6 หลัก</Label>
                  <Input
                    value={otpCode}
                    onChange={e => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="bg-gray-700 border-gray-600 text-white text-center text-2xl tracking-[0.5em] font-mono mt-1"
                    placeholder="000000"
                    maxLength={6}
                    autoFocus
                    data-testid="input-line-otp-code"
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => { setOtpCode(""); setError(""); void handleSendOtp(); }}
                    disabled={otpSending || resendCountdown > 0}
                    className="border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white"
                    data-testid="btn-resend-line-otp"
                  >
                    {otpSending
                      ? <span className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> กำลังส่ง...</span>
                      : resendCountdown > 0
                        ? `ส่งใหม่ (${resendCountdown}s)`
                        : "ส่งใหม่"}
                  </Button>
                  <Button
                    onClick={handleVerify2FA}
                    disabled={loading || otpCode.length !== 6}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                    data-testid="btn-verify-line-otp"
                  >
                    {loading ? (
                      <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> กำลังตรวจสอบ...</span>
                    ) : (
                      <span className="flex items-center gap-2"><Key className="h-4 w-4" /> ยืนยัน & สร้าง Master</span>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {bootstrapStep === "line-verify" && verified && (
              <div className="bg-gray-800 border border-green-700/50 rounded-xl p-6 space-y-4 shadow-2xl text-center" data-testid="bootstrap-complete">
                <div className="w-16 h-16 rounded-2xl bg-green-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-8 w-8 text-white" />
                </div>
                <h2 className="text-lg font-bold text-white">สร้าง Master SysAdmin สำเร็จ!</h2>
                <div className="text-sm text-gray-400 space-y-1">
                  <p>ชื่อ: <span className="text-white">{fullName}</span></p>
                  <p>Username: <span className="text-white font-mono">@{username}</span></p>
                  <p>2FA: <span className="text-white">{twoFAMethod === "totp" ? "Authenticator App" : twoFAMethod === "line" ? "LINE OTP" : "Email (ยังไม่ verified)"}</span>
                    {twoFAMethod !== "email" && <span className="text-green-400 ml-1">✓ Verified</span>}
                    {twoFAMethod === "email" && <span className="text-amber-400 ml-1">⏳ Pending</span>}
                  </p>
                </div>
                <Button
                  onClick={handleFinishBootstrap}
                  disabled={loading}
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                  data-testid="btn-finish-bootstrap"
                >
                  {loading ? (
                    <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> กำลังเข้าสู่ระบบ...</span>
                  ) : (
                    <span className="flex items-center gap-2"><LogIn className="h-4 w-4" /> เข้าสู่ระบบ</span>
                  )}
                </Button>
              </div>
            )}
          </>
        ) : loginPhase === "credentials" ? (
          <form onSubmit={handleLogin} className="bg-gray-800 border border-gray-700 rounded-xl p-6 space-y-4 shadow-2xl">
            {errorBox}

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
        ) : (
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 space-y-4 shadow-2xl" data-testid="form-login-2fa">
            {errorBox}

            <div className="text-center">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 ${
                login2faMethod === "totp" ? "bg-purple-600" : "bg-green-600"
              }`}>
                {login2faMethod === "totp" ? <Smartphone className="h-7 w-7 text-white" /> : <MessageCircle className="h-7 w-7 text-white" />}
              </div>
              <p className="text-sm text-gray-300">
                {login2faMethod === "totp" ? "กรอกรหัสจาก Authenticator App" : "ยืนยันตัวตนผ่าน LINE OTP"}
              </p>
            </div>

            {login2faMethod === "line" && !loginOtpSent && (
              <Button
                onClick={handleLoginSendOtp}
                disabled={loginOtpSending}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
                data-testid="btn-login-send-otp"
              >
                {loginOtpSending ? (
                  <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> กำลังส่ง...</span>
                ) : (
                  <span className="flex items-center gap-2"><MessageCircle className="h-4 w-4" /> ส่ง OTP ไป LINE</span>
                )}
              </Button>
            )}

            {login2faMethod === "line" && loginOtpSent && (
              <div className="bg-green-900/20 border border-green-700/40 rounded-lg p-3 text-xs text-green-300 text-center">
                <CheckCircle2 className="h-3.5 w-3.5 inline mr-1" /> ส่ง OTP แล้ว (หมดอายุ 5 นาที)
              </div>
            )}

            {(login2faMethod === "totp" || loginOtpSent) && (
              <>
                <div>
                  <Label className="text-gray-300 text-sm">รหัส OTP 6 หลัก</Label>
                  <Input
                    value={loginOtpCode}
                    onChange={e => setLoginOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="bg-gray-700 border-gray-600 text-white text-center text-2xl tracking-[0.5em] font-mono mt-1"
                    placeholder="000000"
                    maxLength={6}
                    autoFocus
                    data-testid="input-login-otp-code"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setLoginPhase("credentials");
                      setLoginOtpCode("");
                      setLoginOtpSent(false);
                      setError("");
                      setPassword("");
                    }}
                    className="border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white"
                    data-testid="btn-login-2fa-back"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" /> กลับ
                  </Button>
                  <Button
                    onClick={handleLoginVerify2FA}
                    disabled={loading || loginOtpCode.length !== 6}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                    data-testid="btn-login-verify-2fa"
                  >
                    {loading ? (
                      <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> กำลังตรวจสอบ...</span>
                    ) : (
                      <span className="flex items-center gap-2"><Key className="h-4 w-4" /> ยืนยัน</span>
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        <div className="text-center mt-6">
          <p className="text-[10px] text-gray-600 font-mono">E-Tax Center — System Administration Console</p>
        </div>
      </div>
    </div>
  );
}
