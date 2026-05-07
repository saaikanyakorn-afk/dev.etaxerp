import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Layout from "@/components/layout";
import SettingsTabs from "@/components/settings-tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/lib/company-context";
import { apiRequest } from "@/lib/queryClient";
import {
  TrendingUp, Key, CheckCircle2, AlertTriangle, Loader2,
  Eye, EyeOff, ExternalLink, RotateCcw, Shield, Building2,
  Globe, Trash2, Info
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
  const companyId = selectedCompany?.id;

  const [keyVisible, setKeyVisible] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [testCurrency, setTestCurrency] = useState("USD");
  const [testDate, setTestDate] = useState(() => toLocalDateStr(new Date()));
  const [testResult, setTestResult] = useState<any>(null);
  const [testLoading, setTestLoading] = useState(false);

  const { data: settings, isLoading } = useQuery<any>({
    queryKey: ["/api/settings/exchange-rate", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const r = await fetch(`/api/settings/exchange-rate?companyId=${companyId}`, { credentials: "include" });
      if (!r.ok) return null;
      return r.json();
    },
    enabled: !!companyId,
  });

  const saveMutation = useMutation({
    mutationFn: async (key: string | null) => {
      const r = await apiRequest("POST", `/api/settings/exchange-rate?companyId=${companyId}`, { botApiKey: key || "" });
      return r.json();
    },
    onSuccess: (data) => {
      toast({
        title: data.cleared ? "ล้าง API Key สำเร็จ" : "บันทึก API Key สำเร็จ",
        description: data.cleared
          ? "ระบบจะใช้ API Key ของ Platform แทน (ถ้ามี)"
          : "ระบบจะใช้ API Key ของบริษัทนี้ในการดึงอัตราแลกเปลี่ยน",
        variant: "success" as any,
      });
      setNewKey("");
      queryClient.invalidateQueries({ queryKey: ["/api/settings/exchange-rate", companyId] });
    },
    onError: (err: any) => {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    },
  });

  const handleTest = async () => {
    if (!companyId) return;
    setTestLoading(true);
    setTestResult(null);
    try {
      const params = new URLSearchParams({ currency: testCurrency, companyId: String(companyId) });
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

  const sourceLabel = {
    company: { text: "API Key บริษัทนี้", icon: Building2, color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    platform: { text: "API Key ของ Platform", icon: Globe, color: "bg-blue-100 text-blue-700 border-blue-200" },
    none: { text: "ไม่มี API Key", icon: AlertTriangle, color: "bg-red-100 text-red-700 border-red-200" },
  }[settings?.source || "none"];

  return (
    <Layout>
      <SettingsTabs />
      <div className="max-w-3xl mx-auto px-6 py-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-50">
            <TrendingUp className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">อัตราแลกเปลี่ยน</h1>
            <p className="text-xs text-muted-foreground">ตั้งค่า API Key สำหรับดึงอัตราแลกเปลี่ยนจากธนาคารแห่งประเทศไทย (BOT)</p>
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
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                กำลังโหลด...
              </div>
            ) : (
              <div className="flex items-center justify-between">
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
                        : "ปุ่ม 'ดึงอัตรา' จะไม่สามารถดึงข้อมูลได้"}
                    </div>
                  </div>
                </div>
                {settings?.source && (
                  <Badge
                    variant="outline"
                    className={`text-xs gap-1 ${sourceLabel?.color}`}
                    data-testid="badge-api-source"
                  >
                    {sourceLabel?.icon && <sourceLabel.icon className="h-3 w-3" />}
                    {sourceLabel?.text}
                  </Badge>
                )}
              </div>
            )}

            {settings?.source === "platform" && (
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-xs text-blue-700 flex gap-2">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>ขณะนี้ใช้ API Key ของ Platform (ใช้ร่วมกันทุกบริษัท) คุณสามารถตั้งค่า Key เฉพาะของบริษัทนี้ได้ด้านล่าง</span>
              </div>
            )}

            {settings?.source === "none" && (
              <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-xs text-amber-700 flex gap-2">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>ยังไม่มี API Key — กรุณาสมัครที่ <a href="https://apiportal.bot.or.th" target="_blank" rel="noopener noreferrer" className="underline font-medium">apiportal.bot.or.th</a> แล้วกรอก Key ด้านล่าง</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* API Key Management */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Key className="h-4 w-4 text-slate-500" />
              API Key เฉพาะบริษัทนี้
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {settings?.botApiKey && (
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-md border">
                <div>
                  <div className="text-xs text-muted-foreground mb-0.5">Key ที่บันทึกไว้</div>
                  <div className="text-sm font-mono font-medium tracking-wider" data-testid="text-masked-key">
                    {keyVisible ? settings.botApiKey : settings.botApiKey}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-500 hover:text-red-600 hover:bg-red-50 text-xs"
                  data-testid="button-clear-key"
                  onClick={() => {
                    if (confirm("ยืนยันลบ API Key ของบริษัทนี้?\n\nระบบจะ fallback ไปใช้ API Key ของ Platform แทน (ถ้ามี)")) {
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
                    placeholder="วาง API Key ที่นี่..."
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

            <div className="pt-1">
              <a
                href="https://apiportal.bot.or.th"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline"
                data-testid="link-bot-portal"
              >
                <ExternalLink className="h-3 w-3" />
                สมัคร / ดู API Key ที่ BOT API Portal
              </a>
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
                ดึงอัตรา
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
                      <div className="text-emerald-600">Source: {testResult.data.source}</div>
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

        {/* How it works */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Info className="h-4 w-4 text-slate-500" />
              วิธีการทำงาน
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="text-xs text-muted-foreground space-y-2 list-decimal pl-4">
              <li>สมัครรับ API Key จาก <a href="https://apiportal.bot.or.th" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">BOT API Portal</a> (ฟรี)</li>
              <li>เลือก Product <strong>"Stat-ExchangeRate"</strong> → Subscribe → คัดลอก Bearer Token</li>
              <li>วาง Token ในช่องด้านบน แล้วกด "บันทึก"</li>
              <li>ทดสอบด้วยปุ่ม "ดึงอัตรา" เพื่อตรวจสอบการเชื่อมต่อ</li>
              <li>หลังจากนี้ ปุ่ม <strong>"ดึงอัตรา"</strong> ในทุกฟอร์ม (ใบแจ้งหนี้, ใบสั่งซื้อ, ค่าใช้จ่าย ฯลฯ) จะดึงอัตราจาก BOT โดยอัตโนมัติ</li>
            </ol>
            <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
              <strong>ลำดับความสำคัญ API Key:</strong>{" "}
              API Key ของบริษัทนี้ (ถ้ามี) → API Key ของ Platform → ไม่สามารถดึงได้
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
