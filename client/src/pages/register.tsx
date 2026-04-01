import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { User, Lock, Building2, Mail, Phone, ArrowLeft, CheckCircle2, Loader2, Eye, EyeOff } from "lucide-react";

declare global {
  interface Window {
    grecaptcha?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => number;
      reset: (widgetId: number) => void;
      getResponse: (widgetId: number) => string;
    };
  }
}

function ReCaptchaWidget({ onToken }: { onToken: (token: string | null) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<number | null>(null);
  const [siteKey, setSiteKey] = useState<string>("");

  useEffect(() => {
    fetch("/api/public-config").then(r => r.json()).then(d => {
      if (d.recaptchaSiteKey) setSiteKey(d.recaptchaSiteKey);
    }).catch(() => {});
  }, []);

  const renderWidget = useCallback(() => {
    if (!containerRef.current || !window.grecaptcha || !siteKey) return;
    if (widgetIdRef.current !== null) return;
    widgetIdRef.current = window.grecaptcha.render(containerRef.current, {
      sitekey: siteKey,
      callback: (token: string) => onToken(token),
      "expired-callback": () => onToken(null),
      "error-callback": () => onToken(null),
      theme: "light",
      hl: "th",
    });
  }, [onToken, siteKey]);

  useEffect(() => {
    if (!siteKey) return;
    if (window.grecaptcha?.render) {
      renderWidget();
    } else {
      const interval = setInterval(() => {
        if (window.grecaptcha?.render) {
          clearInterval(interval);
          renderWidget();
        }
      }, 200);
      return () => clearInterval(interval);
    }
  }, [renderWidget, siteKey]);

  if (!siteKey) return null;
  return <div ref={containerRef} data-testid="recaptcha-widget" className="flex justify-center" />;
}

export default function RegisterPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const [form, setForm] = useState({
    companyName: "",
    tenantType: "general_business",
    businessType: "",
    contactName: "",
    email: "",
    phone: "",
    username: "",
    password: "",
    confirmPassword: "",
  });

  const updateField = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (form.password !== form.confirmPassword) {
      toast({ title: "รหัสผ่านไม่ตรงกัน", description: "กรุณากรอกรหัสผ่านให้ตรงกันทั้งสองช่อง", variant: "destructive" });
      return;
    }
    if (form.password.length < 6) {
      toast({ title: "รหัสผ่านสั้นเกินไป", description: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร", variant: "destructive" });
      return;
    }

    if (!recaptchaToken) {
      toast({ title: "กรุณายืนยันตัวตน", description: "กรุณากดยืนยันว่าคุณไม่ใช่บอท", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: form.companyName,
          tenantType: form.tenantType,
          businessType: form.businessType || "mixed",
          contactName: form.contactName,
          contactEmail: form.email,
          contactPhone: form.phone,
          adminUsername: form.username,
          adminPassword: form.password,
          recaptchaToken,
        }),
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "สมัครไม่สำเร็จ");
      }

      toast({ title: "สมัครสำเร็จ!", description: "ระบบจะนำคุณไปยังหน้าเข้าสู่ระบบ" });
      navigate("/login");
    } catch (err: any) {
      toast({ title: "สมัครไม่สำเร็จ", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const canProceedStep1 = form.companyName && form.tenantType && form.contactName && (form.tenantType === "accounting_firm" || form.businessType);
  const canSubmit = form.username && form.password && form.confirmPassword;

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden py-12 px-4" style={{ background: "#f6f6f6" }}>
      <div className="absolute inset-0" style={{ background: "#fff5f2" }} />

      <div className="w-full max-w-lg relative z-10">
        <button
          onClick={() => navigate("/landing")}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-[#fb9678] transition-colors mb-6"
          data-testid="btn-back-landing"
        >
          <ArrowLeft className="w-4 h-4" /> กลับหน้าแรก
        </button>

        <Card className="shadow-2xl border-none rounded-2xl bg-white">
          <CardHeader className="space-y-1 text-center pb-4 pt-0 px-0">
            <div className="rounded-t-2xl px-8 py-6 relative overflow-hidden" style={{ background: "#fb9678" }}>
              <img src="/etax-logo-white.png" alt="E-Tax Center" className="h-12 w-auto mx-auto relative z-10" data-testid="img-register-logo" />
            </div>
            <div className="pt-4 px-6">
              <h2 className="text-lg font-bold text-foreground">สมัครใช้งาน E-Tax Center</h2>
              <CardDescription className="text-muted-foreground mt-1">
                เริ่มต้นใช้งานฟรี ไม่ต้องใช้บัตรเครดิต
              </CardDescription>
            </div>
          </CardHeader>

          {/* Step indicator */}
          <div className="px-8 pb-4">
            <div className="flex items-center gap-3">
              <div className={`flex items-center gap-2 flex-1 ${step >= 1 ? "text-[#fb9678]" : "text-gray-300"}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= 1 ? "bg-[#fb9678] text-white" : "bg-gray-200 text-gray-400"}`}>
                  {step > 1 ? <CheckCircle2 className="w-5 h-5" /> : "1"}
                </div>
                <span className="text-xs font-medium hidden sm:block">ข้อมูลบริษัท</span>
              </div>
              <div className={`h-0.5 flex-1 rounded ${step >= 2 ? "bg-[#fb9678]" : "bg-gray-200"}`} />
              <div className={`flex items-center gap-2 flex-1 ${step >= 2 ? "text-[#fb9678]" : "text-gray-300"}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= 2 ? "bg-[#fb9678] text-white" : "bg-gray-200 text-gray-400"}`}>2</div>
                <span className="text-xs font-medium hidden sm:block">บัญชีผู้ใช้</span>
              </div>
            </div>
          </div>

          <CardContent className="px-8 pb-8">
            <form onSubmit={handleRegister}>
              {step === 1 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="companyName" className="text-gray-600 text-sm font-medium">ชื่อบริษัท / ร้านค้า *</Label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                      <Input
                        id="companyName"
                        data-testid="input-company-name"
                        placeholder="เช่น บริษัท ABC จำกัด"
                        value={form.companyName}
                        onChange={(e) => updateField("companyName", e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-gray-600 text-sm font-medium">ประเภทผู้ใช้งาน *</Label>
                    <Select value={form.tenantType} onValueChange={(v) => { updateField("tenantType", v); if (v === "accounting_firm") updateField("businessType", "accounting"); }}>
                      <SelectTrigger data-testid="select-tenant-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general_business">ธุรกิจทั่วไป / ร้านค้า</SelectItem>
                        <SelectItem value="accounting_firm">สำนักงานบัญชี</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {form.tenantType === "general_business" && (
                    <div className="space-y-2">
                      <Label className="text-gray-600 text-sm font-medium">ประเภทธุรกิจ *</Label>
                      <Select value={form.businessType} onValueChange={(v) => updateField("businessType", v)}>
                        <SelectTrigger data-testid="select-business-type">
                          <SelectValue placeholder="เลือกประเภทธุรกิจ" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="online_shop">ร้านค้าออนไลน์ / E-Commerce</SelectItem>
                          <SelectItem value="trading">ซื้อมาขายไป</SelectItem>
                          <SelectItem value="service">ธุรกิจบริการ</SelectItem>
                          <SelectItem value="manufacturing">ธุรกิจผลิต / โรงงาน</SelectItem>
                          <SelectItem value="restaurant">ร้านอาหาร / คาเฟ่</SelectItem>
                          <SelectItem value="retail">ขายปลีก / หน้าร้าน</SelectItem>
                          <SelectItem value="mixed">อื่นๆ / ผสม</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="contactName" className="text-gray-600 text-sm font-medium">ชื่อ-นามสกุล ผู้ติดต่อ *</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                      <Input
                        id="contactName"
                        data-testid="input-contact-name"
                        placeholder="ชื่อ-นามสกุล"
                        value={form.contactName}
                        onChange={(e) => updateField("contactName", e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-gray-600 text-sm font-medium">อีเมล</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        <Input
                          id="email"
                          type="email"
                          data-testid="input-email"
                          placeholder="email@example.com"
                          value={form.email}
                          onChange={(e) => updateField("email", e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-gray-600 text-sm font-medium">เบอร์โทรศัพท์</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        <Input
                          id="phone"
                          data-testid="input-phone"
                          placeholder="08x-xxx-xxxx"
                          value={form.phone}
                          onChange={(e) => updateField("phone", e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>
                  </div>

                  <Button
                    type="button"
                    className="w-full mt-2 py-6 text-base font-bold rounded-xl"
                    style={{ background: canProceedStep1 ? "#fb9678" : undefined }}
                    disabled={!canProceedStep1}
                    onClick={() => setStep(2)}
                    data-testid="btn-next-step"
                  >
                    ถัดไป
                  </Button>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="username" className="text-gray-600 text-sm font-medium">ชื่อผู้ใช้ (Username) *</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                      <Input
                        id="username"
                        data-testid="input-username"
                        placeholder="เช่น admin"
                        value={form.username}
                        onChange={(e) => updateField("username", e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-gray-600 text-sm font-medium">รหัสผ่าน *</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        data-testid="input-password"
                        placeholder="อย่างน้อย 6 ตัวอักษร"
                        value={form.password}
                        onChange={(e) => updateField("password", e.target.value)}
                        className="pl-10 pr-10"
                        required
                      />
                      <button type="button" tabIndex={-1} onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600" data-testid="btn-toggle-password">
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-gray-600 text-sm font-medium">ยืนยันรหัสผ่าน *</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        data-testid="input-confirm-password"
                        placeholder="กรอกรหัสผ่านอีกครั้ง"
                        value={form.confirmPassword}
                        onChange={(e) => updateField("confirmPassword", e.target.value)}
                        className="pl-10 pr-10"
                        required
                      />
                      <button type="button" tabIndex={-1} onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600" data-testid="btn-toggle-confirm-password">
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="mt-3">
                    <ReCaptchaWidget onToken={setRecaptchaToken} />
                  </div>

                  <div className="flex gap-3 mt-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 py-6 text-base font-semibold rounded-xl border-gray-200"
                      onClick={() => setStep(1)}
                      data-testid="btn-prev-step"
                    >
                      ย้อนกลับ
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1 py-6 text-base font-bold rounded-xl text-white"
                      style={{ background: canSubmit && recaptchaToken ? "#fb9678" : undefined }}
                      disabled={!canSubmit || !recaptchaToken || isLoading}
                      data-testid="btn-register"
                    >
                      {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "สมัครใช้งาน"}
                    </Button>
                  </div>
                </div>
              )}
            </form>

            <div className="text-center mt-6 pt-4 border-t border-gray-100">
              <span className="text-sm text-gray-500">มีบัญชีอยู่แล้ว? </span>
              <button
                onClick={() => navigate("/login")}
                className="text-sm font-semibold text-[#fb9678] hover:underline"
                data-testid="link-login"
              >
                เข้าสู่ระบบ
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
