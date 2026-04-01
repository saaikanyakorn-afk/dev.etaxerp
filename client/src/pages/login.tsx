import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { User, Lock, Eye, EyeOff, Wrench } from "lucide-react";
import DevMenu from "@/components/dev-menu";
import { useTranslation } from "@/hooks/use-translation";

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

export default function Login() {
  const [, navigate] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  const { t, lang } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const [maintenance, setMaintenance] = useState<{ enabled: boolean; message: string; scheduledEnd: string | null } | null>(null);

  useEffect(() => {
    if (sessionStorage.getItem("session_kicked") === "1") {
      sessionStorage.removeItem("session_kicked");
      toast({
        title: lang === "en" ? "Auto logout" : lang.startsWith("zh") ? "自动退出" : "ออกจากระบบอัตโนมัติ",
        description: lang === "en" ? "You were logged out because another device logged in" : lang.startsWith("zh") ? "由于其他设备登录，您已被自动退出" : "คุณถูกออกจากระบบเนื่องจากมีการเข้าสู่ระบบจากอุปกรณ์อื่น",
        variant: "destructive",
        duration: 8000,
      });
    }
  }, []);

  useEffect(() => {
    fetch("/api/maintenance/status")
      .then(r => r.json())
      .then(data => setMaintenance(data))
      .catch(() => {});
    const interval = setInterval(() => {
      fetch("/api/maintenance/status")
        .then(r => r.json())
        .then(data => setMaintenance(data))
        .catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recaptchaToken) {
      toast({
        title: lang === "en" ? "Please verify" : lang.startsWith("zh") ? "请验证" : "กรุณายืนยันตัวตน",
        description: lang === "en" ? "Please complete the CAPTCHA" : lang.startsWith("zh") ? "请完成验证码" : "กรุณากดยืนยันว่าคุณไม่ใช่บอท",
        variant: "destructive",
      });
      return;
    }
    setIsLoading(true);
    try {
      await login(username, password, rememberMe, recaptchaToken);
    } catch (err: any) {
      toast({
        title: lang === "en" ? "Login failed" : lang.startsWith("zh") ? "登录失败" : "เข้าสู่ระบบไม่สำเร็จ",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const isUnderMaintenance = maintenance?.enabled === true;

  return (
    <div className="h-screen flex flex-col relative overflow-hidden" style={{ background: "#f6f6f6" }}>
      <DevMenu />
      <div className="flex-1 flex items-center justify-center py-2">
      <Card className="w-full max-w-md relative z-10 shadow-2xl border-none rounded-2xl bg-white">
        <CardHeader className="space-y-0 text-center pb-2 pt-0 px-0">
          <div className="rounded-t-2xl px-8 py-3 relative overflow-hidden" style={{ background: "var(--theme-primary)" }}>
            <img src="/etax-logo-white.png" alt="E-Tax Center" className="h-10 w-auto mx-auto relative z-10" data-testid="img-login-logo" />
          </div>
          <div className="pt-2 px-6">
            <h2 className="text-base font-heading font-bold text-foreground">{lang === "en" ? "Welcome" : lang.startsWith("zh") ? "欢迎" : "ยินดีต้อนรับ"}</h2>
            <CardDescription className="text-muted-foreground text-xs mt-0.5">
              {t("auth.loginSubtitle")}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="px-8 pt-0 pb-3">
          {isUnderMaintenance && (
            <div className="mb-3 p-3 rounded-xl border-2 border-amber-400 bg-amber-50" data-testid="maintenance-banner">
              <div className="flex items-start gap-2">
                <Wrench className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-amber-800">{lang === "en" ? "System under maintenance" : lang.startsWith("zh") ? "系统维护中" : "ระบบอยู่ระหว่างการปรับปรุง"}</p>
                  <p className="text-xs text-amber-700 mt-0.5">{maintenance?.message}</p>
                  {maintenance?.scheduledEnd && (
                    <p className="text-xs text-amber-600 mt-1">
                      {lang === "en" ? "Expected completion:" : lang.startsWith("zh") ? "预计完成时间:" : "คาดว่าจะเสร็จ:"} {new Date(maintenance.scheduledEnd).toLocaleString(lang === "en" ? "en-US" : lang.startsWith("zh") ? "zh-CN" : "th-TH", { dateStyle: "long", timeStyle: "short" })}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
          <form onSubmit={handleLogin} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="username" className="text-gray-600 text-sm font-medium">{t("auth.username")}</Label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <Input 
                  id="username" 
                  data-testid="input-username"
                  placeholder="admin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="pl-10 h-9 bg-gray-50 border-gray-200 rounded-lg text-gray-800 placeholder:text-gray-400" style={{ "--tw-ring-color": "var(--theme-primary)" } as any}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="password" className="text-gray-600 text-sm font-medium">{t("auth.password")}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <Input 
                  id="password"
                  data-testid="input-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pl-10 pr-10 h-9 bg-gray-50 border-gray-200 rounded-lg text-gray-800" style={{ "--tw-ring-color": "var(--theme-primary)" } as any}
                />
                <button
                  type="button"
                  data-testid="button-toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="remember" checked={rememberMe} onCheckedChange={(v) => setRememberMe(!!v)} className="border-gray-300 rounded" style={{ "--theme-check": "var(--theme-primary)" } as any} data-theme-checkbox />
              <label htmlFor="remember" className="text-sm font-medium leading-none text-gray-500">
                {t("auth.rememberMe")}
              </label>
            </div>
            <div className="flex justify-center">
              <ReCaptchaWidget onToken={setRecaptchaToken} />
            </div>
            <Button 
              type="submit"
              data-testid="button-login"
              className="w-full h-10 text-white font-semibold rounded-lg shadow-lg transition-all active:scale-[0.98] hover:shadow-xl hover:opacity-95"
              style={{ background: "var(--theme-primary)" }}
              disabled={isLoading}
            >
              {isLoading ? t("common.loading") : t("auth.login")}
            </Button>
          </form>
          {!isUnderMaintenance && (
            <div className="mt-3 p-2 rounded-lg border" style={{ background: "#fffbf0", borderColor: "#fec90f33" }}>
              <p className="text-xs text-gray-500 text-center">
                <span className="inline-flex items-center gap-1">{lang === "en" ? "Demo:" : lang.startsWith("zh") ? "演示:" : "ทดสอบ:"}</span> {lang === "en" ? "User" : lang.startsWith("zh") ? "用户" : "ผู้ใช้"} <span className="font-semibold" style={{ color: "var(--theme-primary)" }}>test</span> / {lang === "en" ? "Pass" : lang.startsWith("zh") ? "密码" : "รหัส"} <span className="font-semibold" style={{ color: "var(--theme-primary)" }}>test123</span>
              </p>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col items-center border-t border-gray-100 pt-2 pb-3 px-8 gap-1">
          <div className="text-sm text-gray-500">
            {lang === "en" ? "No account yet?" : lang.startsWith("zh") ? "还没有账号？" : "ยังไม่มีบัญชี?"} <button onClick={() => navigate("/register")} className="font-semibold hover:underline" style={{ color: "var(--theme-primary)" }} data-testid="link-register">{lang === "en" ? "Register free" : lang.startsWith("zh") ? "免费注册" : "สมัครใช้งานฟรี"}</button>
          </div>
          <button onClick={() => navigate("/landing")} className="text-xs text-[#03c9d7] hover:underline font-medium" data-testid="link-landing">
            {lang === "en" ? "View services →" : lang.startsWith("zh") ? "查看服务 →" : "ดูรายละเอียดบริการ →"}
          </button>
          <p className="text-[11px] text-gray-400">
            E-Tax Center &copy; 2026 Digital Accounting Platform
          </p>
        </CardFooter>
      </Card>
      </div>
    </div>
  );
}
