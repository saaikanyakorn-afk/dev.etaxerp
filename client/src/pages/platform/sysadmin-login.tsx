import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Shield, Eye, EyeOff, LogIn, AlertTriangle, UserPlus,
  Smartphone, MessageCircle, Mail, ChevronRight, ChevronLeft,
  CheckCircle2, Key, Copy, Check, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type TwoFAMethod = "totp" | "line" | "email";
type BootstrapStep = "info" | "2fa-select" | "2fa-verify";

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

  const handleBootstrapCreate = async () => {
    if (!username.trim() || !password || !fullName.trim() || !twoFAMethod) return;
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
          lineUserId: lineUserId.trim() || undefined,
          twoFactorMethod: twoFAMethod,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "สร้าง Master ไม่สำเร็จ");
        if (data.errors) setErrors(data.errors);
        return;
      }
      if (data.totpUri) setTotpUri(data.totpUri);
      setBootstrapStep("2fa-verify");
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    setOtpSending(true);
    setError("");
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

  const TWO_FA_OPTIONS: { value: TwoFAMethod; icon: typeof Smartphone; label: string; desc: string }[] = [
    { value: "totp", icon: Smartphone, label: "Authenticator App", desc: "Google Authenticator / Authy — สแกน QR Code" },
    { value: "line", icon: MessageCircle, label: "LINE OTP", desc: "ส่งรหัส OTP ไปที่ LINE — ยืนยันทันที" },
    { value: "email", icon: Mail, label: "Email OTP", desc: "บันทึก Email ไว้ — ยืนยันภายหลัง" },
  ];

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
              ? bootstrapStep === "info" ? "ขั้นตอนที่ 1/3 — ข้อมูลพื้นฐาน"
                : bootstrapStep === "2fa-select" ? "ขั้นตอนที่ 2/3 — เลือกวิธียืนยันตัวตน"
                : "ขั้นตอนที่ 3/3 — ยืนยัน 2FA"
              : "Authorized personnel only"
            }
          </p>
          {bootstrapMode && (
            <div className="flex justify-center gap-1.5 mt-3">
              {["info", "2fa-select", "2fa-verify"].map((s, i) => (
                <div key={s} className={`h-1.5 rounded-full transition-all ${
                  s === bootstrapStep ? "w-8 bg-amber-500" :
                  ["info", "2fa-select", "2fa-verify"].indexOf(bootstrapStep) > i ? "w-4 bg-amber-500/50" : "w-4 bg-gray-700"
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
                  <Label className="text-gray-300 text-sm">LINE User ID</Label>
                  <Input
                    value={lineUserId}
                    onChange={e => setLineUserId(e.target.value)}
                    className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-500 mt-1 font-mono"
                    placeholder="U1234567890abcdef..."
                    data-testid="input-bootstrap-line-id"
                  />
                  <p className="text-[10px] text-gray-500 mt-1">จำเป็นถ้าเลือก 2FA ผ่าน LINE</p>
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

                <Button
                  onClick={() => { setError(""); setBootstrapStep("2fa-select"); }}
                  disabled={!username.trim() || !password || !fullName.trim()}
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                  data-testid="btn-bootstrap-next-2fa"
                >
                  <span className="flex items-center gap-2">ถัดไป — เลือก 2FA <ChevronRight className="h-4 w-4" /></span>
                </Button>
              </div>
            )}

            {bootstrapStep === "2fa-select" && (
              <div className="bg-gray-800 border border-amber-700/50 rounded-xl p-6 space-y-4 shadow-2xl" data-testid="form-bootstrap-2fa-select">
                {errorBox}

                <p className="text-sm text-gray-400">เลือกวิธียืนยันตัวตน 2 ขั้นตอน (2FA)</p>

                <div className="space-y-2">
                  {TWO_FA_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => { setTwoFAMethod(opt.value); setError(""); }}
                      className={`w-full text-left p-3 rounded-lg border transition-all ${
                        twoFAMethod === opt.value
                          ? "border-amber-500 bg-amber-900/30 ring-1 ring-amber-500/50"
                          : "border-gray-600 bg-gray-700/50 hover:border-gray-500"
                      }`}
                      data-testid={`btn-2fa-${opt.value}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                          twoFAMethod === opt.value ? "bg-amber-600" : "bg-gray-600"
                        }`}>
                          <opt.icon className="h-4 w-4 text-white" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-white">{opt.label}</div>
                          <div className="text-xs text-gray-400">{opt.desc}</div>
                        </div>
                        {twoFAMethod === opt.value && (
                          <CheckCircle2 className="h-5 w-5 text-amber-500 ml-auto" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>

                {twoFAMethod === "email" && (
                  <div className="bg-amber-900/20 border border-amber-700/40 rounded-lg p-3 text-xs text-amber-300">
                    <AlertTriangle className="h-3.5 w-3.5 inline mr-1" />
                    Email 2FA จะบันทึกไว้แต่ <span className="font-semibold">ยังไม่ verified</span> ในขั้นตอนนี้
                  </div>
                )}

                {twoFAMethod === "line" && !lineUserId.trim() && (
                  <div className="bg-red-900/20 border border-red-700/40 rounded-lg p-3 text-xs text-red-300">
                    <AlertTriangle className="h-3.5 w-3.5 inline mr-1" />
                    กรุณาย้อนกลับไปกรอก LINE User ID ก่อน
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => { setBootstrapStep("info"); setError(""); }}
                    className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white"
                    data-testid="btn-bootstrap-back-info"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" /> ย้อนกลับ
                  </Button>
                  <Button
                    onClick={handleBootstrapCreate}
                    disabled={loading || !twoFAMethod || (twoFAMethod === "line" && !lineUserId.trim()) || (twoFAMethod === "email" && !email.trim())}
                    className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
                    data-testid="btn-bootstrap-create"
                  >
                    {loading ? (
                      <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> กำลังสร้าง...</span>
                    ) : (
                      <span className="flex items-center gap-2"><UserPlus className="h-4 w-4" /> สร้าง Master</span>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {bootstrapStep === "2fa-verify" && !verified && (
              <div className="bg-gray-800 border border-amber-700/50 rounded-xl p-6 space-y-4 shadow-2xl" data-testid="form-bootstrap-2fa-verify">
                {errorBox}

                {twoFAMethod === "totp" && (
                  <>
                    <div className="text-center">
                      <p className="text-sm text-gray-300 mb-3">สแกน QR Code ด้วย Google Authenticator หรือ Authy</p>
                      {totpUri && (
                        <div className="bg-white p-4 rounded-xl inline-block">
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(totpUri)}`}
                            alt="TOTP QR Code"
                            className="w-48 h-48"
                            data-testid="img-totp-qr"
                          />
                        </div>
                      )}
                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={handleCopyUri}
                          className="text-xs text-gray-400 hover:text-white flex items-center gap-1 mx-auto"
                          data-testid="btn-copy-totp-uri"
                        >
                          {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                          {copied ? "คัดลอกแล้ว" : "คัดลอก URI สำหรับเพิ่มด้วยตนเอง"}
                        </button>
                      </div>
                    </div>
                    <div>
                      <Label className="text-gray-300 text-sm">กรอกรหัส 6 หลักจาก Authenticator App</Label>
                      <Input
                        value={otpCode}
                        onChange={e => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        className="bg-gray-700 border-gray-600 text-white text-center text-2xl tracking-[0.5em] font-mono mt-1"
                        placeholder="000000"
                        maxLength={6}
                        autoFocus
                        data-testid="input-totp-code"
                      />
                    </div>
                    <Button
                      onClick={handleVerify2FA}
                      disabled={loading || otpCode.length !== 6}
                      className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                      data-testid="btn-verify-totp"
                    >
                      {loading ? (
                        <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> กำลังตรวจสอบ...</span>
                      ) : (
                        <span className="flex items-center gap-2"><Key className="h-4 w-4" /> ยืนยันรหัส</span>
                      )}
                    </Button>
                  </>
                )}

                {twoFAMethod === "line" && (
                  <>
                    <div className="text-center">
                      <div className="w-14 h-14 rounded-2xl bg-green-600 flex items-center justify-center mx-auto mb-3">
                        <MessageCircle className="h-7 w-7 text-white" />
                      </div>
                      <p className="text-sm text-gray-300">ส่ง OTP ไปที่ LINE ของคุณ</p>
                      <p className="text-xs text-gray-500 mt-1 font-mono">ID: {lineUserId}</p>
                    </div>
                    {!otpSent ? (
                      <Button
                        onClick={handleSendOtp}
                        disabled={otpSending}
                        className="w-full bg-green-600 hover:bg-green-700 text-white"
                        data-testid="btn-send-line-otp"
                      >
                        {otpSending ? (
                          <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> กำลังส่ง...</span>
                        ) : (
                          <span className="flex items-center gap-2"><MessageCircle className="h-4 w-4" /> ส่ง OTP ไป LINE</span>
                        )}
                      </Button>
                    ) : (
                      <>
                        <div className="bg-green-900/20 border border-green-700/40 rounded-lg p-3 text-xs text-green-300 text-center">
                          <CheckCircle2 className="h-3.5 w-3.5 inline mr-1" /> ส่ง OTP ไป LINE แล้ว (หมดอายุ 5 นาที)
                        </div>
                        <div>
                          <Label className="text-gray-300 text-sm">กรอกรหัส OTP 6 หลัก</Label>
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
                            onClick={() => { setOtpSent(false); setOtpCode(""); setError(""); }}
                            className="border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white"
                            data-testid="btn-resend-line-otp"
                          >
                            ส่งใหม่
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
                              <span className="flex items-center gap-2"><Key className="h-4 w-4" /> ยืนยันรหัส</span>
                            )}
                          </Button>
                        </div>
                      </>
                    )}
                  </>
                )}

                {twoFAMethod === "email" && (
                  <>
                    <div className="text-center">
                      <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center mx-auto mb-3">
                        <Mail className="h-7 w-7 text-white" />
                      </div>
                      <p className="text-sm text-gray-300">Email 2FA</p>
                      <p className="text-xs text-gray-500 mt-1">{email}</p>
                    </div>
                    <div className="bg-amber-900/20 border border-amber-700/40 rounded-lg p-3 text-sm text-amber-300">
                      <AlertTriangle className="h-4 w-4 inline mr-1" />
                      Email verification ยังไม่พร้อมใช้งานในขณะนี้ — ระบบจะบันทึก Email ไว้และยืนยันภายหลัง
                    </div>
                    <Button
                      onClick={handleSkipEmail}
                      disabled={loading}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                      data-testid="btn-skip-email-2fa"
                    >
                      {loading ? (
                        <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> กำลังบันทึก...</span>
                      ) : (
                        <span className="flex items-center gap-2"><Mail className="h-4 w-4" /> บันทึก Email — ยืนยันภายหลัง</span>
                      )}
                    </Button>
                  </>
                )}
              </div>
            )}

            {bootstrapStep === "2fa-verify" && verified && (
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
