import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Layout from "@/components/layout";
import SettingsTabs from "@/components/settings-tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/lib/company-context";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import {
  TrendingUp, Key, CheckCircle2, AlertTriangle, Loader2,
  Eye, EyeOff, ExternalLink, RotateCcw, Shield, Trash2,
  Info, Lock, ChevronRight
} from "lucide-react";
import ThaiDateInput from "@/components/thai-date-input";
import { toLocalDateStr } from "@/lib/utils";

const CURRENCY_OPTIONS = [
  { value: "USD", label: "USD — ดอลลาร์สหรัฐ" },
  { value: "EUR", label: "EUR — ยูโร" },
  { value: "GBP", label: "GBP — ปอนด์อังกฤษ" },
  { value: "JPY", label: "JPY — เยนญี่ปุ่น" },
  { value: "CNY", label: "CNY — หยวนจีน" },
  { value: "SGD", label: "SGD — ดอลลาร์สิงคโปร์" },
  { value: "AUD", label: "AUD — ดอลลาร์ออสเตรเลีย" },
  { value: "HKD", label: "HKD — ดอลลาร์ฮ่องกง" },
];

export default function ExchangeRateSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedCompany } = useCompany();
  const { user } = useAuth();
  const isSuperAdmin = (user as any)?.role === "super_admin";

  const [keyVisible, setKeyVisible] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [testCurrency, setTestCurrency] = useState("USD");
  const [testDate, setTestDate] = useState(() => toLocalDateStr(new Date()));
  const [testResult, setTestResult] = useState<any>(null);
  const [testLoading, setTestLoading] = useState(false);

  const { data: settings, isLoading } = useQuery<any>({
    queryKey: ["/api/settings/exchange-rate"],
    queryFn: async () => {
      const r = await fetch(`/api/settings/exchange-rate`, { credentials: "include" });
      if (!r.ok) return null;
      return r.json();
    },
    enabled: isSuperAdmin,
  });

  const saveMutation = useMutation({
    mutationFn: async (key: string | null) => {
      const r = await apiRequest("POST", `/api/settings/exchange-rate`, { botApiKey: key || "" });
      return r.json();
    },
    onSuccess: (data) => {
      toast({
        title: data.cleared ? "ลบ API Key สำเร็จ" : "บันทึก API Key สำเร็จ",
        description: data.cleared
          ? "ระบบได้ลบ API Key ออกแล้ว ปุ่มดึงอัตราจะไม่ทำงานจนกว่าจะตั้งค่าใหม่"
          : "API Key ถูกบันทึกแล้ว ระบบพร้อมดึงอัตราแลกเปลี่ยนจาก BOT",
        variant: "success" as any,
      });
      setNewKey("");
      queryClient.invalidateQueries({ queryKey: ["/api/settings/exchange-rate"] });
    },
    onError: (err: any) => {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    },
  });

  const handleTest = async () => {
    setTestLoading(true);
    setTestResult(null);
    try {
      const params = new URLSearchParams({ currency: testCurrency });
      if (testDate) params.set("date", testDate);
      const r = await fetch(`/api/exchange-rate?${params}`, { credentials: "include", cache: "no-store" });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message);
      setTestResult({ success: true, data });
    } catch (e: any) {
      setTestResult({ success: false, message: e.message });
    }
    setTestLoading(false);
  };

  if (!isSuperAdmin) {
    return (
      <Layout>
        <SettingsTabs />
        <div className="max-w-3xl mx-auto px-6 py-12 flex flex-col items-center gap-4 text-center">
          <div className="p-4 rounded-full bg-slate-100">
            <Lock className="h-8 w-8 text-slate-400" />
          </div>
          <h2 className="text-base font-semibold">ไม่มีสิทธิ์เข้าถึงหน้านี้</h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            การตั้งค่า BOT API Key เป็นการตั้งค่าระดับ Platform สำหรับ Super Admin เท่านั้น
            <br />หากต้องการเปลี่ยนแปลง กรุณาติดต่อ Super Admin ของระบบ
          </p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <SettingsTabs />
      <div className="max-w-3xl mx-auto px-6 py-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-50">
            <TrendingUp className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">อัตราแลกเปลี่ยน — BOT API Key</h1>
            <p className="text-xs text-muted-foreground">การตั้งค่าระดับ Platform — ใช้ร่วมกันทุกบริษัทในระบบ (Super Admin เท่านั้น)</p>
          </div>
        </div>

        {/* Status Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Shield className="h-4 w-4 text-slate-500" />
              สถานะการเชื่อมต่อ BOT API
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                กำลังโหลด...
              </div>
            ) : (
              <div className="flex items-center gap-3">
                {settings?.isConfigured ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                )}
                <div>
                  <div className="text-sm font-medium">
                    {settings?.isConfigured ? "พร้อมใช้งาน" : "ยังไม่ได้ตั้งค่า"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {settings?.isConfigured
                      ? "ปุ่ม 'ดึงอัตรา' ในทุกฟอร์มเอกสารพร้อมทำงาน"
                      : "ปุ่ม 'ดึงอัตรา' จะแสดง error และไม่สามารถดึงข้อมูลได้"}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* API Key Management */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Key className="h-4 w-4 text-slate-500" />
              จัดการ API Key
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {settings?.botApiKey && (
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-md border">
                <div>
                  <div className="text-xs text-muted-foreground mb-0.5">Key ที่บันทึกไว้</div>
                  <div className="text-sm font-mono font-medium tracking-wider" data-testid="text-masked-key">
                    {settings.botApiKey}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-500 hover:text-red-600 hover:bg-red-50 text-xs"
                  data-testid="button-clear-key"
                  onClick={() => {
                    if (confirm("ยืนยันลบ BOT API Key?\n\nปุ่ม 'ดึงอัตรา' ทั้งระบบจะหยุดทำงานทันที จนกว่าจะตั้งค่าใหม่")) {
                      saveMutation.mutate(null);
                    }
                  }}
                  disabled={saveMutation.isPending}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> ลบ Key
                </Button>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-xs">
                {settings?.botApiKey ? "เปลี่ยน API Key" : "กรอก API Key"}{" "}
                <span className="text-muted-foreground font-normal">(Bearer Token จาก BOT API Portal)</span>
              </Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={keyVisible ? "text" : "password"}
                    value={newKey}
                    onChange={e => setNewKey(e.target.value)}
                    placeholder="วาง Bearer Token ที่นี่..."
                    className="text-sm pr-9"
                    data-testid="input-bot-api-key"
                  />
                  <button
                    type="button"
                    onClick={() => setKeyVisible(v => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    data-testid="button-toggle-key-visibility"
                  >
                    {keyVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Button
                  onClick={() => saveMutation.mutate(newKey)}
                  disabled={!newKey.trim() || saveMutation.isPending}
                  data-testid="button-save-key"
                  className="shrink-0"
                >
                  {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "บันทึก"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Test Connection */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-slate-500" />
              ทดสอบการเชื่อมต่อ
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="space-y-1.5">
                <Label className="text-xs">สกุลเงิน</Label>
                <select
                  value={testCurrency}
                  onChange={e => setTestCurrency(e.target.value)}
                  className="h-9 text-sm border rounded-md px-2 bg-background"
                  data-testid="select-test-currency"
                >
                  {CURRENCY_OPTIONS.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">วันที่ (ว/ด/ป)</Label>
                <ThaiDateInput
                  value={testDate}
                  onChange={setTestDate}
                  className="h-9 text-sm w-36"
                  data-testid="input-test-date"
                />
              </div>
              <Button
                onClick={handleTest}
                disabled={testLoading || !settings?.isConfigured}
                variant="outline"
                data-testid="button-test-connection"
                className="gap-1.5"
              >
                {testLoading
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <RotateCcw className="h-3.5 w-3.5" />}
                ทดสอบ
              </Button>
            </div>

            {!settings?.isConfigured && (
              <p className="text-xs text-muted-foreground">กรุณาบันทึก API Key ก่อนทดสอบ</p>
            )}

            {testResult && (
              <div
                className={`rounded-md p-3 border text-sm ${
                  testResult.success
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                    : "bg-red-50 border-red-200 text-red-800"
                }`}
                data-testid="text-test-result"
              >
                {testResult.success ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 font-medium">
                      <CheckCircle2 className="h-4 w-4" />
                      เชื่อมต่อสำเร็จ — {testResult.data.currency}/THB วันที่ {testResult.data.date}
                    </div>
                    <div className="text-xs space-y-0.5 pl-5">
                      <div>Mid Rate: <strong>{testResult.data.thb}</strong> บาท</div>
                      {testResult.data.buying_transfer && (
                        <div>ซื้อ (โอน): <strong>{testResult.data.buying_transfer}</strong> บาท</div>
                      )}
                      {testResult.data.selling && (
                        <div>ขาย: <strong>{testResult.data.selling}</strong> บาท</div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    {testResult.message}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* How to get a new key — detailed guideline */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Info className="h-4 w-4 text-slate-500" />
              วิธีขอ API Key จาก BOT (ธนาคารแห่งประเทศไทย)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="text-xs text-muted-foreground space-y-3 list-none pl-0">
              <li className="flex gap-3">
                <span className="shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold text-[10px]">1</span>
                <span>
                  เปิดเบราว์เซอร์ไปที่{" "}
                  <a href="https://apiportal.bot.or.th" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline font-medium">
                    apiportal.bot.or.th
                  </a>
                  {" "}แล้วคลิก <strong>"Sign Up"</strong> เพื่อสมัครบัญชี (ฟรี) หรือ <strong>"Sign In"</strong> ถ้ามีบัญชีแล้ว
                </span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold text-[10px]">2</span>
                <span>
                  หลัง Sign In ไปที่เมนู <strong>"APIs"</strong> แล้วค้นหา <strong>"Stat-ExchangeRate"</strong>
                </span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold text-[10px]">3</span>
                <span>
                  คลิกเข้าไปใน <strong>Stat-ExchangeRate</strong> แล้วคลิกปุ่ม <strong>"Subscribe"</strong> เพื่อสมัครใช้งาน API นี้
                </span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold text-[10px]">4</span>
                <span>
                  ไปที่เมนู <strong>"My Subscriptions"</strong> หรือ <strong>"Applications"</strong> ในหน้า Profile แล้วเลือก Application ที่สร้างไว้
                </span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold text-[10px]">5</span>
                <span>
                  คัดลอก <strong>"Consumer Key"</strong> หรือ <strong>"Bearer Token"</strong> — นำมาวางในช่อง "กรอก API Key" ด้านบน แล้วกด <strong>"บันทึก"</strong>
                </span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold text-[10px]">6</span>
                <span>
                  กดปุ่ม <strong>"ทดสอบ"</strong> ด้านบนเพื่อยืนยันว่า Key ใช้งานได้จริง ก่อนแจ้งให้ทีมทราบ
                </span>
              </li>
            </ol>

            <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-xs text-amber-800 space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                ข้อควรระวัง
              </div>
              <ul className="pl-5 space-y-1 list-disc">
                <li>Key นี้ใช้ร่วมกันทุกบริษัทในระบบ — อย่าแชร์ให้บุคคลภายนอก</li>
                <li>ถ้า Key หมดอายุหรือถูก revoke — ปุ่ม "ดึงอัตรา" ทั้งระบบจะหยุดทำงานทันที</li>
                <li>แนะนำให้ทดสอบทุกครั้งหลังบันทึก Key ใหม่</li>
                <li>BOT อาจ revoke Key ถ้าใช้งานเกิน rate limit หรือไม่ได้ใช้นานเกินไป</li>
              </ul>
            </div>

            <a
              href="https://apiportal.bot.or.th"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline"
              data-testid="link-bot-portal"
            >
              <ExternalLink className="h-3 w-3" />
              เปิด BOT API Portal
              <ChevronRight className="h-3 w-3" />
            </a>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
