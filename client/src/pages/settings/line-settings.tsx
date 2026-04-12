import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Layout from "@/components/layout";
import SettingsTabs from "@/components/settings-tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { useCompany } from "@/lib/company-context";
import { apiRequest } from "@/lib/queryClient";
import {
  ArrowLeft, MessageCircle, Key, Shield, CheckCircle2,
  AlertTriangle, Loader2, Info, Bot, Eye, EyeOff, Plus,
  Trash2, Wifi, WifiOff, Link2, FileText, Sparkles, Copy, ExternalLink,
  Building2, Settings2, Globe, RefreshCw, Server
} from "lucide-react";
import { useLocation } from "wouter";

const DOC_TYPE_OPTIONS = [
  { value: "auto", label: "อัตโนมัติ (AI จัดประเภท)" },
  { value: "receipt", label: "ใบเสร็จรับเงิน" },
  { value: "invoice", label: "ใบแจ้งหนี้/ใบกำกับภาษี" },
  { value: "expense", label: "ค่าใช้จ่าย" },
  { value: "quotation", label: "ใบเสนอราคา" },
  { value: "other", label: "อื่นๆ" },
];

const CONDITION_OPTIONS = [
  { value: "file_type", label: "ประเภทไฟล์ (image/document/video)" },
  { value: "filename_contains", label: "ชื่อไฟล์มีคำว่า..." },
  { value: "sender_name", label: "ชื่อผู้ส่ง" },
  { value: "mime_type", label: "MIME Type" },
];

const CATEGORY_OPTIONS = [
  { value: "receipt", label: "ใบเสร็จ" },
  { value: "invoice", label: "ใบแจ้งหนี้" },
  { value: "expense", label: "ค่าใช้จ่าย" },
  { value: "quotation", label: "ใบเสนอราคา" },
  { value: "image", label: "รูปภาพ" },
  { value: "document", label: "เอกสาร" },
  { value: "other", label: "อื่นๆ" },
];

export default function LineSettingsPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;

  const [activeTab, setActiveTab] = useState<"token" | "groups" | "rules" | "webhook" | "gateway">("token");
  const [tokenVisible, setTokenVisible] = useState(false);
  const [secretVisible, setSecretVisible] = useState(false);
  const [form, setForm] = useState({
    lineChannelAccessToken: "",
    lineChannelSecret: "",
    lineId: "",
  });

  const [showGroupDialog, setShowGroupDialog] = useState(false);
  const [editingGroup, setEditingGroup] = useState<any>(null);
  const [groupForm, setGroupForm] = useState({ lineGroupId: "", groupName: "", firmClientId: "", defaultDocumentType: "auto" });

  const [showRuleDialog, setShowRuleDialog] = useState(false);
  const [ruleForm, setRuleForm] = useState({ name: "", condition: "file_type", conditionValue: "", targetCategory: "receipt", priority: 0 });

  const { user } = useAuth();
  const isSysAdmin = user?.role === "super_admin";
  const [gatewayUrl, setGatewayUrl] = useState("https://www.apc-tech.com/line-gateway.php");
  const [drainInterval, setDrainInterval] = useState<string>("");
  const [drainSaving, setDrainSaving] = useState(false);

  const { data: drainConfig } = useQuery<any>({
    queryKey: ["/api/line/gateway-drain-config"],
    queryFn: async () => {
      const res = await fetch("/api/line/gateway-drain-config", { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: activeTab === "gateway" && isSysAdmin,
  });

  useEffect(() => {
    if (drainConfig?.intervalMin !== undefined) {
      setDrainInterval(String(drainConfig.intervalMin));
    }
  }, [drainConfig]);

  const { data: gatewayInfo, isLoading: gatewayLoading, refetch: refetchGateway } = useQuery<any>({
    queryKey: ["/line-gateway-info", gatewayUrl],
    queryFn: async () => {
      try {
        const r = await fetch(`${gatewayUrl}?action=info`, { signal: AbortSignal.timeout(8000) });
        if (!r.ok) return { error: `HTTP ${r.status}` };
        return r.json();
      } catch (e: any) {
        return { error: e.message || "ไม่สามารถเชื่อมต่อ gateway ได้" };
      }
    },
    enabled: activeTab === "gateway",
    refetchInterval: activeTab === "gateway" ? 30000 : false,
  });

  const [claimClientId, setClaimClientId] = useState<Record<number, string>>({});

  const { data: settings, isLoading } = useQuery({
    queryKey: ["/api/line/settings", companyId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/line/settings?companyId=${companyId}`);
      return res.json();
    },
    enabled: !!companyId,
  });

  const { data: groups = [] } = useQuery<any[]>({
    queryKey: ["/api/line-documents/groups"],
    queryFn: async () => {
      const r = await fetch(`/api/line-documents/groups`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
  });

  const { data: pendingGroups = [] } = useQuery<any[]>({
    queryKey: ["/api/line-documents/groups/pending"],
    queryFn: async () => {
      const r = await fetch("/api/line-documents/groups/pending", { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
  });

  const { data: firmClients = [] } = useQuery<any[]>({
    queryKey: ["/api/firm-clients"],
    queryFn: async () => {
      const r = await fetch("/api/firm-clients", { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
  });

  const { data: classifyRules = [] } = useQuery<any[]>({
    queryKey: ["/api/line-documents/classify-rules"],
    queryFn: async () => {
      const r = await fetch("/api/line-documents/classify-rules", { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
  });

  useEffect(() => {
    if (settings) {
      setForm({
        lineChannelAccessToken: settings.lineChannelAccessToken || "",
        lineChannelSecret: settings.lineChannelSecret || "",
        lineId: settings.lineId || "",
      });
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await apiRequest("POST", "/api/line/settings", { ...data, companyId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/line/settings"] });
      toast({ title: "บันทึกการตั้งค่า LINE สำเร็จ" });
    },
    onError: (err: any) => {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    },
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/line/test", { companyId });
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "เชื่อมต่อ LINE สำเร็จ",
        description: `Bot: ${data.botName || "ไม่ทราบชื่อ"}`,
      });
    },
    onError: (err: any) => {
      toast({ title: "เชื่อมต่อไม่สำเร็จ", description: err.message, variant: "destructive" });
    },
  });

  const webhookTestMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/line/webhook-test", { companyId });
      return res.json();
    },
  });

  const createGroupMutation = useMutation({
    mutationFn: async (data: any) => {
      const r = await apiRequest("POST", "/api/line-documents/groups", data);
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "เพิ่มกลุ่มสำเร็จ" });
      setShowGroupDialog(false);
      setGroupForm({ lineGroupId: "", groupName: "", firmClientId: "", defaultDocumentType: "auto" });
      queryClient.invalidateQueries({ queryKey: ["/api/line-documents/groups"] });
    },
    onError: (err: any) => {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    },
  });

  const toggleGroupMutation = useMutation({
    mutationFn: async ({ id, active }: { id: number; active: boolean }) => {
      const r = await apiRequest("PATCH", `/api/line-documents/groups/${id}`, { active });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/line-documents/groups"] });
    },
  });

  const updateGroupMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const r = await apiRequest("PATCH", `/api/line-documents/groups/${id}`, data);
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "อัปเดตกลุ่มสำเร็จ" });
      setEditingGroup(null);
      queryClient.invalidateQueries({ queryKey: ["/api/line-documents/groups"] });
    },
    onError: (err: any) => {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await apiRequest("DELETE", `/api/line-documents/groups/${id}`);
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "ลบกลุ่มสำเร็จ" });
      queryClient.invalidateQueries({ queryKey: ["/api/line-documents/groups"] });
    },
  });

  const claimGroupMutation = useMutation({
    mutationFn: async ({ id, firmClientId }: { id: number; firmClientId: string }) => {
      const r = await apiRequest("POST", `/api/line-documents/groups/${id}/claim`, {
        firmClientId: firmClientId && firmClientId !== "none" ? Number(firmClientId) : null,
      });
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "เชื่อมโยงกลุ่มสำเร็จ" });
      queryClient.invalidateQueries({ queryKey: ["/api/line-documents/groups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/line-documents/groups/pending"] });
    },
    onError: (err: any) => {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    },
  });

  const createRuleMutation = useMutation({
    mutationFn: async (data: any) => {
      const r = await apiRequest("POST", "/api/line-documents/classify-rules", data);
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "เพิ่มกฎสำเร็จ" });
      setShowRuleDialog(false);
      setRuleForm({ name: "", condition: "file_type", conditionValue: "", targetCategory: "receipt", priority: 0 });
      queryClient.invalidateQueries({ queryKey: ["/api/line-documents/classify-rules"] });
    },
    onError: (err: any) => {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    },
  });

  const toggleRuleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: number; active: boolean }) => {
      const r = await apiRequest("PATCH", `/api/line-documents/classify-rules/${id}`, { active });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/line-documents/classify-rules"] });
    },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await apiRequest("DELETE", `/api/line-documents/classify-rules/${id}`);
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "ลบกฎสำเร็จ" });
      queryClient.invalidateQueries({ queryKey: ["/api/line-documents/classify-rules"] });
    },
  });

  const webhookUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/line/webhook`
    : "";

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "คัดลอกแล้ว" });
  };

  if (isLoading) {
    return (
      <Layout>
        <SettingsTabs />
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </Layout>
    );
  }

  const tabs = [
    { id: "token" as const, label: "API Token", icon: Key },
    { id: "groups" as const, label: "กลุ่ม LINE", icon: MessageCircle, badge: pendingGroups.length || undefined },
    { id: "rules" as const, label: "จัดประเภทอัตโนมัติ", icon: Sparkles },
    { id: "webhook" as const, label: "Webhook", icon: Wifi },
    { id: "gateway" as const, label: "Gateway", icon: Globe },
  ];

  return (
    <Layout>
      <SettingsTabs />
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/settings")} data-testid="btn-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-gray-800" data-testid="text-page-title">
              ตั้งค่า LINE & รับเอกสารอัตโนมัติ
            </h1>
            <p className="text-sm text-gray-500">
              เชื่อมต่อ LINE, จัดการกลุ่ม, ตั้งกฎจัดประเภทเอกสาร และทดสอบ Webhook
            </p>
          </div>
        </div>

        <div className="flex gap-1 border-b overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? "border-[#06C755] text-[#06C755]"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
              data-testid={`tab-${tab.id}`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
              {tab.badge && (
                <Badge className="bg-yellow-500 text-white text-xs h-5 min-w-5 flex items-center justify-center">{tab.badge}</Badge>
              )}
            </button>
          ))}
        </div>

        {activeTab === "token" && (
          <div className="space-y-6">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4" data-testid="info-line-overview">
              <div className="flex gap-3">
                <Info className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-green-700 space-y-1">
                  <p className="font-medium">วิธีสร้าง LINE Channel Access Token</p>
                  <ol className="list-decimal ml-4 space-y-0.5">
                    <li>ไปที่ <a href="https://developers.line.biz/" target="_blank" rel="noopener noreferrer" className="underline text-green-800 hover:text-green-900">LINE Developers Console</a></li>
                    <li>สร้าง Provider &rarr; สร้าง Messaging API Channel</li>
                    <li>ไปที่ tab "Messaging API" &rarr; กด Issue ที่ Channel Access Token</li>
                    <li>คัดลอก Token มาวางในช่องด้านล่าง</li>
                  </ol>
                </div>
              </div>
            </div>

            {settings?.hasPlatformToken && !settings?.hasCompanyToken && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4" data-testid="info-platform-token">
                <div className="flex gap-3">
                  <Shield className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-700">
                    <p className="font-medium">ใช้ Token ส่วนกลางอยู่</p>
                    <p>ขณะนี้ระบบใช้ LINE Token ส่วนกลาง (Platform) ในการส่งข้อความ หากต้องการใช้ LINE Official Account ของบริษัทนี้เอง ให้ตั้งค่า Token ด้านล่าง</p>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl border shadow-sm divide-y">
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Key className="h-4 w-4 text-gray-500" />
                  <h3 className="font-semibold text-gray-800">Channel Access Token</h3>
                </div>
                <div className="relative">
                  <Input
                    type={tokenVisible ? "text" : "password"}
                    placeholder="ใส่ LINE Channel Access Token ของบริษัทนี้"
                    value={form.lineChannelAccessToken}
                    onChange={(e) => setForm({ ...form, lineChannelAccessToken: e.target.value })}
                    className="pr-10 font-mono text-sm"
                    data-testid="input-line-token"
                  />
                  <button
                    type="button"
                    onClick={() => setTokenVisible(!tokenVisible)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {tokenVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-gray-400">Token จาก LINE Developers Console &rarr; Messaging API &rarr; Channel Access Token (Long-lived)</p>
              </div>

              <div className="p-5 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="h-4 w-4 text-gray-500" />
                  <h3 className="font-semibold text-gray-800">Channel Secret</h3>
                  <span className="text-xs text-gray-400">(ไม่บังคับ)</span>
                </div>
                <div className="relative">
                  <Input
                    type={secretVisible ? "text" : "password"}
                    placeholder="ใส่ Channel Secret (ไม่บังคับ — ใช้สำหรับ Webhook verification)"
                    value={form.lineChannelSecret}
                    onChange={(e) => setForm({ ...form, lineChannelSecret: e.target.value })}
                    className="pr-10 font-mono text-sm"
                    data-testid="input-line-secret"
                  />
                  <button
                    type="button"
                    onClick={() => setSecretVisible(!secretVisible)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {secretVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="p-5 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <MessageCircle className="h-4 w-4 text-gray-500" />
                  <h3 className="font-semibold text-gray-800">LINE ID</h3>
                  <span className="text-xs text-gray-400">(ไม่บังคับ)</span>
                </div>
                <Input
                  placeholder="เช่น @yourcompany"
                  value={form.lineId}
                  onChange={(e) => setForm({ ...form, lineId: e.target.value })}
                  className="text-sm"
                  data-testid="input-line-id"
                />
                <p className="text-xs text-gray-400">LINE ID ของ Official Account สำหรับแสดงในเอกสาร</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() => saveMutation.mutate(form)}
                disabled={saveMutation.isPending}
                className="bg-[#06C755] hover:bg-[#05a748] text-white"
                data-testid="button-save-line"
              >
                {saveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <MessageCircle className="h-4 w-4 mr-2" />
                )}
                บันทึกการตั้งค่า LINE
              </Button>

              <Button
                variant="outline"
                onClick={() => testMutation.mutate()}
                disabled={testMutation.isPending}
                className="border-[#06C755] text-[#06C755] hover:bg-green-50"
                data-testid="button-test-line"
              >
                {testMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Bot className="h-4 w-4 mr-2" />
                )}
                ทดสอบการเชื่อมต่อ
              </Button>

              {form.lineChannelAccessToken && form.lineChannelAccessToken !== "" && !form.lineChannelAccessToken.startsWith("••••") && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setForm({ ...form, lineChannelAccessToken: "", lineChannelSecret: "" });
                  }}
                  className="border-red-300 text-red-600 hover:bg-red-50"
                  data-testid="button-clear-line-token"
                >
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  ล้าง Token
                </Button>
              )}
            </div>

            {settings?.hasCompanyToken && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2" data-testid="status-company-token">
                <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                <span className="text-sm text-green-700 font-medium">บริษัทนี้ใช้ LINE Token ของตัวเอง</span>
              </div>
            )}

            {!settings?.hasCompanyToken && !settings?.hasPlatformToken && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2" data-testid="status-no-token">
                <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
                <span className="text-sm text-amber-700 font-medium">ยังไม่ได้ตั้งค่า LINE Token — ฟีเจอร์ส่ง LINE จะใช้งานไม่ได้</span>
              </div>
            )}
          </div>
        )}

        {activeTab === "groups" && (
          <div className="space-y-4">
            {pendingGroups.length > 0 && (
              <Card className="border-2 border-yellow-300 bg-yellow-50">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                    <CardTitle className="text-base text-yellow-800">กลุ่มใหม่ที่รอเชื่อมโยง ({pendingGroups.length})</CardTitle>
                  </div>
                  <p className="text-xs text-yellow-600 mt-1">Bot ถูกเชิญเข้ากลุ่มเหล่านี้แล้ว กรุณาเลือกลูกค้าที่ต้องการเชื่อมโยง</p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {pendingGroups.map((g: any) => (
                      <div key={g.id} className="flex items-center justify-between p-3 border border-yellow-200 rounded-lg bg-white" data-testid={`pending-group-${g.id}`}>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center bg-yellow-100">
                            <MessageCircle className="w-5 h-5 text-yellow-600" />
                          </div>
                          <div>
                            <div className="font-medium text-sm">{g.groupName || "กลุ่มไม่มีชื่อ"}</div>
                            <div className="text-xs text-gray-400 font-mono">{g.lineGroupId}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Select
                            value={claimClientId[g.id] || ""}
                            onValueChange={v => setClaimClientId(prev => ({ ...prev, [g.id]: v }))}
                          >
                            <SelectTrigger className="w-[180px] h-8 text-xs" data-testid={`select-claim-client-${g.id}`}>
                              <SelectValue placeholder="เลือกลูกค้า..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">ไม่ระบุลูกค้า</SelectItem>
                              {firmClients.map((fc: any) => (
                                <SelectItem key={fc.id} value={String(fc.id)}>{fc.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            size="sm"
                            className="bg-[#05b187] hover:bg-[#049a76] h-8 text-xs"
                            onClick={() => claimGroupMutation.mutate({ id: g.id, firmClientId: claimClientId[g.id] || "" })}
                            disabled={claimGroupMutation.isPending}
                            data-testid={`button-claim-${g.id}`}
                          >
                            {claimGroupMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "เชื่อมโยง"}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">กลุ่ม LINE ที่เชื่อมโยง ({groups.length})</CardTitle>
                  <Dialog open={showGroupDialog} onOpenChange={(open) => {
                    setShowGroupDialog(open);
                    if (!open) setGroupForm({ lineGroupId: "", groupName: "", firmClientId: "", defaultDocumentType: "auto" });
                  }}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="bg-[#05b187] hover:bg-[#049a76]" data-testid="button-add-group">
                        <Plus className="w-4 h-4 mr-1" /> เพิ่มกลุ่ม
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>เชื่อมโยงกลุ่ม LINE</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 mt-2">
                        <div>
                          <Label>LINE Group ID *</Label>
                          <Input
                            value={groupForm.lineGroupId}
                            onChange={e => setGroupForm(f => ({ ...f, lineGroupId: e.target.value }))}
                            placeholder="C1234..."
                            data-testid="input-group-id"
                          />
                          <p className="text-xs text-gray-400 mt-1">ได้จากการเชิญ Bot เข้ากลุ่ม (ดูใน webhook event)</p>
                        </div>
                        <div>
                          <Label>ชื่อกลุ่ม</Label>
                          <Input
                            value={groupForm.groupName}
                            onChange={e => setGroupForm(f => ({ ...f, groupName: e.target.value }))}
                            placeholder="กลุ่มลูกค้า ABC"
                            data-testid="input-group-name"
                          />
                        </div>
                        <div>
                          <Label>เชื่อมกับลูกค้า (ไม่บังคับ)</Label>
                          <Select
                            value={groupForm.firmClientId}
                            onValueChange={v => setGroupForm(f => ({ ...f, firmClientId: v }))}
                          >
                            <SelectTrigger data-testid="select-firm-client">
                              <SelectValue placeholder="เลือกลูกค้า..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">ไม่ระบุ</SelectItem>
                              {firmClients.map((fc: any) => (
                                <SelectItem key={fc.id} value={String(fc.id)}>{fc.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>ประเภทเอกสารเริ่มต้น</Label>
                          <Select
                            value={groupForm.defaultDocumentType}
                            onValueChange={v => setGroupForm(f => ({ ...f, defaultDocumentType: v }))}
                          >
                            <SelectTrigger data-testid="select-doc-type">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {DOC_TYPE_OPTIONS.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          onClick={() => {
                            createGroupMutation.mutate({
                              lineGroupId: groupForm.lineGroupId,
                              groupName: groupForm.groupName || null,
                              firmClientId: groupForm.firmClientId && groupForm.firmClientId !== "none" ? Number(groupForm.firmClientId) : null,
                              defaultDocumentType: groupForm.defaultDocumentType,
                            });
                          }}
                          disabled={!groupForm.lineGroupId || createGroupMutation.isPending}
                          className="w-full bg-[#05b187] hover:bg-[#049a76]"
                          data-testid="button-save-group"
                        >
                          {createGroupMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <MessageCircle className="w-4 h-4 mr-1" />}
                          บันทึก
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {groups.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <MessageCircle className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p>ยังไม่มีกลุ่มที่เชื่อมโยง</p>
                    <p className="text-xs mt-1">เพิ่มกลุ่ม LINE หรือเชิญ Bot เข้ากลุ่มเพื่อเริ่มบันทึกเอกสารอัตโนมัติ</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {groups.map((g: any) => {
                      const client = firmClients.find((fc: any) => fc.id === g.firmClientId);
                      const isEditing = editingGroup?.id === g.id;
                      const docTypeLabel = DOC_TYPE_OPTIONS.find(o => o.value === (g.defaultDocumentType || "auto"))?.label || "อัตโนมัติ";
                      return (
                        <div key={g.id} className={`p-4 border rounded-lg transition-colors ${g.active ? "bg-white" : "bg-gray-50 border-gray-200"}`} data-testid={`group-item-${g.id}`}>
                          {isEditing ? (
                            <div className="space-y-3">
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <Label className="text-xs">ชื่อกลุ่ม</Label>
                                  <Input
                                    value={editingGroup.groupName || ""}
                                    onChange={e => setEditingGroup({ ...editingGroup, groupName: e.target.value })}
                                    className="h-8 text-sm"
                                    data-testid="input-edit-group-name"
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">ลูกค้า</Label>
                                  <Select
                                    value={String(editingGroup.firmClientId || "none")}
                                    onValueChange={v => setEditingGroup({ ...editingGroup, firmClientId: v !== "none" ? Number(v) : null })}
                                  >
                                    <SelectTrigger className="h-8 text-sm" data-testid="select-edit-firm-client">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="none">ไม่ระบุ</SelectItem>
                                      {firmClients.map((fc: any) => (
                                        <SelectItem key={fc.id} value={String(fc.id)}>{fc.name}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                              <div>
                                <Label className="text-xs">ประเภทเอกสารเริ่มต้น</Label>
                                <Select
                                  value={editingGroup.defaultDocumentType || "auto"}
                                  onValueChange={v => setEditingGroup({ ...editingGroup, defaultDocumentType: v })}
                                >
                                  <SelectTrigger className="h-8 text-sm" data-testid="select-edit-doc-type">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {DOC_TYPE_OPTIONS.map(opt => (
                                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  className="bg-[#05b187] hover:bg-[#049a76] h-7 text-xs"
                                  onClick={() => updateGroupMutation.mutate({
                                    id: editingGroup.id,
                                    groupName: editingGroup.groupName,
                                    firmClientId: editingGroup.firmClientId,
                                    defaultDocumentType: editingGroup.defaultDocumentType,
                                  })}
                                  disabled={updateGroupMutation.isPending}
                                  data-testid="button-save-edit-group"
                                >
                                  {updateGroupMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "บันทึก"}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => setEditingGroup(null)}
                                  data-testid="button-cancel-edit-group"
                                >
                                  ยกเลิก
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${g.active ? "bg-green-100" : "bg-gray-100"}`}>
                                  <MessageCircle className={`w-5 h-5 ${g.active ? "text-green-600" : "text-gray-400"}`} />
                                </div>
                                <div>
                                  <div className="font-medium text-sm">{g.groupName || "กลุ่มไม่มีชื่อ"}</div>
                                  <div className="text-xs text-gray-400 font-mono">{g.lineGroupId}</div>
                                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    {client && (
                                      <Badge variant="outline" className="text-xs">
                                        <Building2 className="w-3 h-3 mr-1" />
                                        {client.name}
                                      </Badge>
                                    )}
                                    <Badge variant="outline" className="text-xs bg-blue-50 border-blue-200 text-blue-700">
                                      <FileText className="w-3 h-3 mr-1" />
                                      {docTypeLabel}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-gray-500">{g.active ? "เปิด" : "ปิด"}</span>
                                  <Switch
                                    checked={g.active}
                                    onCheckedChange={(checked) => toggleGroupMutation.mutate({ id: g.id, active: checked })}
                                    data-testid={`switch-active-${g.id}`}
                                  />
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-gray-500"
                                  onClick={() => setEditingGroup({ ...g })}
                                  data-testid={`button-edit-group-${g.id}`}
                                >
                                  <Settings2 className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-red-500"
                                  onClick={() => { if (confirm("ลบการเชื่อมโยงกลุ่มนี้?")) deleteGroupMutation.mutate(g.id); }}
                                  data-testid={`button-delete-group-${g.id}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="font-medium text-sm text-blue-800 mb-2">วิธีใช้งาน</h4>
                  <ol className="text-xs text-blue-700 space-y-1 list-decimal pl-4">
                    <li>เชิญ LINE Bot เข้ากลุ่มที่ต้องการบันทึกเอกสาร</li>
                    <li>เมื่อ Bot เข้ากลุ่ม ระบบจะจับ Group ID อัตโนมัติ และแสดงเป็น "กลุ่มรอเชื่อมโยง" ด้านบน</li>
                    <li>เลือกลูกค้าที่ต้องการเชื่อมโยง แล้วกด "เชื่อมโยง" เพื่อเปิดใช้งาน</li>
                    <li>เมื่อมีคนส่งรูป ไฟล์ วิดีโอ หรือเสียงในกลุ่ม ระบบจะบันทึกอัตโนมัติ</li>
                    <li>เอกสารจะถูกเก็บอย่างถาวร ไม่หมดอายุเหมือนใน LINE</li>
                  </ol>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "rules" && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">กฎจัดประเภทเอกสารอัตโนมัติ</CardTitle>
                    <p className="text-xs text-gray-500 mt-1">ตั้งกฎให้ระบบจัดประเภทเอกสารที่รับจาก LINE โดยอัตโนมัติ เช่น ภาพถ่ายใบเสร็จ &rarr; ค่าใช้จ่าย</p>
                  </div>
                  <Dialog open={showRuleDialog} onOpenChange={(open) => {
                    setShowRuleDialog(open);
                    if (!open) setRuleForm({ name: "", condition: "file_type", conditionValue: "", targetCategory: "receipt", priority: 0 });
                  }}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="bg-[#05b187] hover:bg-[#049a76]" data-testid="button-add-rule">
                        <Plus className="w-4 h-4 mr-1" /> เพิ่มกฎ
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>เพิ่มกฎจัดประเภทเอกสาร</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 mt-2">
                        <div>
                          <Label>ชื่อกฎ *</Label>
                          <Input
                            value={ruleForm.name}
                            onChange={e => setRuleForm(f => ({ ...f, name: e.target.value }))}
                            placeholder="เช่น ภาพถ่าย = ใบเสร็จ"
                            data-testid="input-rule-name"
                          />
                        </div>
                        <div>
                          <Label>เงื่อนไข *</Label>
                          <Select
                            value={ruleForm.condition}
                            onValueChange={v => setRuleForm(f => ({ ...f, condition: v }))}
                          >
                            <SelectTrigger data-testid="select-rule-condition">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {CONDITION_OPTIONS.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>ค่าเงื่อนไข</Label>
                          <Input
                            value={ruleForm.conditionValue}
                            onChange={e => setRuleForm(f => ({ ...f, conditionValue: e.target.value }))}
                            placeholder={ruleForm.condition === "file_type" ? "image, document, video" : "คำค้น..."}
                            data-testid="input-rule-condition-value"
                          />
                          <p className="text-xs text-gray-400 mt-1">
                            {ruleForm.condition === "file_type" && "เช่น image, document, video, audio, file"}
                            {ruleForm.condition === "filename_contains" && "เช่น ใบเสร็จ, invoice, receipt"}
                            {ruleForm.condition === "sender_name" && "ชื่อผู้ส่ง LINE"}
                            {ruleForm.condition === "mime_type" && "เช่น image/jpeg, application/pdf"}
                          </p>
                        </div>
                        <div>
                          <Label>จัดเป็นประเภท *</Label>
                          <Select
                            value={ruleForm.targetCategory}
                            onValueChange={v => setRuleForm(f => ({ ...f, targetCategory: v }))}
                          >
                            <SelectTrigger data-testid="select-rule-target">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {CATEGORY_OPTIONS.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>ลำดับความสำคัญ</Label>
                          <Input
                            type="number"
                            value={ruleForm.priority}
                            onChange={e => setRuleForm(f => ({ ...f, priority: Number(e.target.value) }))}
                            placeholder="0"
                            data-testid="input-rule-priority"
                          />
                          <p className="text-xs text-gray-400 mt-1">ตัวเลขน้อย = สำคัญกว่า (ตรวจก่อน)</p>
                        </div>
                        <Button
                          onClick={() => createRuleMutation.mutate(ruleForm)}
                          disabled={!ruleForm.name || !ruleForm.condition || !ruleForm.targetCategory || createRuleMutation.isPending}
                          className="w-full bg-[#05b187] hover:bg-[#049a76]"
                          data-testid="button-save-rule"
                        >
                          {createRuleMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Sparkles className="w-4 h-4 mr-1" />}
                          บันทึก
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {classifyRules.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <Sparkles className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p>ยังไม่มีกฎจัดประเภทอัตโนมัติ</p>
                    <p className="text-xs mt-1">เพิ่มกฎเพื่อให้ระบบจัดประเภทเอกสารจาก LINE โดยอัตโนมัติ</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {classifyRules.map((rule: any) => {
                      const condLabel = CONDITION_OPTIONS.find(c => c.value === rule.condition)?.label || rule.condition;
                      const catLabel = CATEGORY_OPTIONS.find(c => c.value === rule.targetCategory)?.label || rule.targetCategory;
                      return (
                        <div key={rule.id} className={`flex items-center justify-between p-3 border rounded-lg ${rule.active ? "bg-white" : "bg-gray-50"}`} data-testid={`rule-item-${rule.id}`}>
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${rule.active ? "bg-purple-100" : "bg-gray-100"}`}>
                              <Sparkles className={`w-4 h-4 ${rule.active ? "text-purple-600" : "text-gray-400"}`} />
                            </div>
                            <div>
                              <div className="font-medium text-sm">{rule.name}</div>
                              <div className="text-xs text-gray-500 mt-0.5">
                                {condLabel} {rule.conditionValue ? `= "${rule.conditionValue}"` : ""} &rarr; <span className="font-medium text-purple-700">{catLabel}</span>
                              </div>
                              <div className="text-xs text-gray-400">ลำดับ: {rule.priority}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={rule.active}
                              onCheckedChange={(checked) => toggleRuleMutation.mutate({ id: rule.id, active: checked })}
                              data-testid={`switch-rule-${rule.id}`}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-500"
                              onClick={() => { if (confirm("ลบกฎนี้?")) deleteRuleMutation.mutate(rule.id); }}
                              data-testid={`button-delete-rule-${rule.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="mt-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <h4 className="font-medium text-sm text-purple-800 mb-2">ตัวอย่างกฎ</h4>
                  <ul className="text-xs text-purple-700 space-y-1 list-disc pl-4">
                    <li>ประเภทไฟล์ = "image" &rarr; ใบเสร็จ (ภาพถ่ายทั้งหมดจัดเป็นใบเสร็จ)</li>
                    <li>ชื่อไฟล์มีคำว่า "invoice" &rarr; ใบแจ้งหนี้</li>
                    <li>MIME Type = "application/pdf" &rarr; เอกสาร</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "webhook" && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Link2 className="h-5 w-5" />
                  Webhook URL
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-xs text-gray-500">Webhook URL สำหรับตั้งค่าใน LINE Developers Console</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      readOnly
                      value={webhookUrl}
                      className="font-mono text-sm bg-gray-50"
                      data-testid="input-webhook-url"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyToClipboard(webhookUrl)}
                      data-testid="button-copy-webhook"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    คัดลอก URL นี้ไปวางใน LINE Developers Console &rarr; Messaging API &rarr; Webhook URL แล้วกด "Verify"
                  </p>
                </div>

                <div className="flex gap-3 items-center">
                  <Button
                    onClick={() => webhookTestMutation.mutate()}
                    disabled={webhookTestMutation.isPending}
                    className="bg-[#06C755] hover:bg-[#05a748] text-white"
                    data-testid="button-test-webhook"
                  >
                    {webhookTestMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Wifi className="h-4 w-4 mr-2" />
                    )}
                    ทดสอบ Webhook Connection
                  </Button>
                  <a
                    href="https://developers.line.biz/console/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    <ExternalLink className="h-3 w-3" />
                    LINE Developers Console
                  </a>
                </div>

                {webhookTestMutation.data && (
                  <div className={`rounded-xl p-4 border ${
                    webhookTestMutation.data.success
                      ? "bg-green-50 border-green-200"
                      : "bg-red-50 border-red-200"
                  }`} data-testid="webhook-test-result">
                    <div className="flex items-start gap-3">
                      {webhookTestMutation.data.success ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                      ) : (
                        <WifiOff className="h-5 w-5 text-red-600 mt-0.5" />
                      )}
                      <div className="space-y-2">
                        <p className={`font-medium text-sm ${webhookTestMutation.data.success ? "text-green-700" : "text-red-700"}`}>
                          {webhookTestMutation.data.message}
                        </p>
                        {webhookTestMutation.data.success && (
                          <div className="text-xs space-y-1 text-green-700">
                            {webhookTestMutation.data.botName && (
                              <p>Bot: <span className="font-medium">{webhookTestMutation.data.botName}</span></p>
                            )}
                            <p>กลุ่มที่เชื่อมโยง: <span className="font-medium">{webhookTestMutation.data.groupCount}</span> กลุ่ม</p>
                            <p>เอกสารที่บันทึก: <span className="font-medium">{webhookTestMutation.data.documentCount}</span> รายการ</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">ขั้นตอนการตั้งค่า Webhook</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="text-sm text-gray-700 space-y-3 list-decimal pl-4">
                  <li>
                    <span className="font-medium">ตั้งค่า LINE Token</span>
                    <p className="text-xs text-gray-500 mt-0.5">ไปที่แท็บ "API Token" แล้วใส่ Channel Access Token</p>
                  </li>
                  <li>
                    <span className="font-medium">ตั้งค่า Webhook URL ใน LINE Developers Console</span>
                    <p className="text-xs text-gray-500 mt-0.5">คัดลอก Webhook URL ด้านบน ไปวางใน LINE Developers Console &rarr; Messaging API &rarr; Webhook URL</p>
                  </li>
                  <li>
                    <span className="font-medium">เปิดใช้งาน Webhook</span>
                    <p className="text-xs text-gray-500 mt-0.5">กด "Use webhook" ให้เป็นสีเขียวใน LINE Developers Console</p>
                  </li>
                  <li>
                    <span className="font-medium">เชิญ Bot เข้ากลุ่ม LINE</span>
                    <p className="text-xs text-gray-500 mt-0.5">เชิญ LINE Official Account ของคุณเข้ากลุ่ม LINE ที่ต้องการรับเอกสาร</p>
                  </li>
                  <li>
                    <span className="font-medium">เชื่อมโยงกลุ่มกับลูกค้า</span>
                    <p className="text-xs text-gray-500 mt-0.5">ไปที่แท็บ "กลุ่ม LINE" แล้วเชื่อมโยงกลุ่มที่ Bot เข้าร่วมกับลูกค้า</p>
                  </li>
                </ol>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "gateway" && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    LINE Gateway Server
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetchGateway()}
                    disabled={gatewayLoading}
                    data-testid="button-refresh-gateway"
                  >
                    <RefreshCw className={`h-4 w-4 mr-1 ${gatewayLoading ? "animate-spin" : ""}`} />
                    รีเฟรช
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-xs text-gray-500">Gateway URL</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      value={gatewayUrl}
                      onChange={e => setGatewayUrl(e.target.value)}
                      placeholder="https://your-server.com/line-gateway.php"
                      className="font-mono text-sm"
                      data-testid="input-gateway-url"
                    />
                  </div>
                </div>

                {gatewayLoading && (
                  <div className="flex items-center gap-2 text-gray-500 py-4">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="text-sm">กำลังตรวจสอบ gateway...</span>
                  </div>
                )}

                {gatewayInfo && !gatewayInfo.error && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle2 className="h-5 w-5" />
                      <span className="font-medium text-sm">Gateway ออนไลน์</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="text-xs text-gray-500">เซิร์ฟเวอร์</div>
                        <div className="text-sm font-medium mt-0.5">{gatewayInfo.server}</div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="text-xs text-gray-500">PHP Version</div>
                        <div className="text-sm font-medium mt-0.5">{gatewayInfo.php_version}</div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="text-xs text-gray-500">App Target</div>
                        <div className="text-sm font-medium mt-0.5 truncate" title={gatewayInfo.app_target}>{gatewayInfo.app_target}</div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="text-xs text-gray-500">Log ขนาด</div>
                        <div className="text-sm font-medium mt-0.5">{gatewayInfo.log_size_kb} KB</div>
                      </div>
                    </div>

                    {gatewayInfo.today && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <div className="text-xs text-blue-600 font-medium mb-1">สถิติวันนี้</div>
                        <div className="grid grid-cols-3 gap-2 text-sm">
                          <div>
                            <span className="text-gray-500">Requests:</span>{" "}
                            <span className="font-medium">{gatewayInfo.today.requests}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Errors:</span>{" "}
                            <span className={`font-medium ${gatewayInfo.today.errors > 0 ? "text-red-600" : "text-green-600"}`}>{gatewayInfo.today.errors}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Bandwidth:</span>{" "}
                            <span className="font-medium">{gatewayInfo.today.bandwidth}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {gatewayInfo.queue && !gatewayInfo.queue.error && (
                      <div className={`rounded-lg p-3 border text-sm ${
                        (gatewayInfo.queue.pending || 0) > 0 ? "bg-amber-50 border-amber-200" : "bg-gray-50 border-gray-200"
                      }`} data-testid="queue-status">
                        <div className="text-xs font-medium mb-1 flex items-center gap-1">
                          {(gatewayInfo.queue.pending || 0) > 0 ? (
                            <><AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> Webhook Queue</>
                          ) : (
                            <>Webhook Queue</>
                          )}
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                          <div>
                            <span className="text-gray-500">Pending:</span>{" "}
                            <span className={`font-medium ${(gatewayInfo.queue.pending || 0) > 0 ? "text-amber-600" : ""}`}>{gatewayInfo.queue.pending || 0}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Delivered:</span>{" "}
                            <span className="font-medium text-green-600">{gatewayInfo.queue.delivered || 0}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Failed:</span>{" "}
                            <span className={`font-medium ${(gatewayInfo.queue.failed || 0) > 0 ? "text-red-600" : ""}`}>{gatewayInfo.queue.failed || 0}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Processing:</span>{" "}
                            <span className="font-medium">{gatewayInfo.queue.processing || 0}</span>
                          </div>
                        </div>
                        {gatewayInfo.queue.oldest_pending && (
                          <div className="text-xs text-amber-600 mt-1">
                            รอตั้งแต่: {gatewayInfo.queue.oldest_pending}
                          </div>
                        )}
                      </div>
                    )}

                    {gatewayInfo.php_eol_warning && (
                      <div className={`rounded-lg p-4 border ${
                        gatewayInfo.php_eol_warning.includes("⛔")
                          ? "bg-red-50 border-red-300"
                          : "bg-amber-50 border-amber-300"
                      }`} data-testid="php-version-warning">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className={`h-5 w-5 mt-0.5 flex-shrink-0 ${
                            gatewayInfo.php_eol_warning.includes("⛔") ? "text-red-600" : "text-amber-600"
                          }`} />
                          <div>
                            <p className={`font-medium text-sm ${
                              gatewayInfo.php_eol_warning.includes("⛔") ? "text-red-700" : "text-amber-700"
                            }`}>
                              {gatewayInfo.php_eol_warning}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              PHP ที่หมดอายุจะไม่ได้รับ security patches — ควรอัปเกรดเป็นเวอร์ชันล่าสุดที่ hosting รองรับ
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {!gatewayInfo.php_eol_warning && gatewayInfo.php_eol && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700" data-testid="php-version-ok">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4" />
                          PHP {gatewayInfo.php_version} — รองรับจนถึง {gatewayInfo.php_eol}
                        </div>
                      </div>
                    )}

                    {gatewayInfo.disk && gatewayInfo.disk.used_pct !== null && (
                      <div className={`rounded-lg p-3 border text-sm ${
                        gatewayInfo.disk.used_pct > 80 ? "bg-red-50 border-red-200 text-red-700" : "bg-gray-50 border-gray-200 text-gray-700"
                      }`}>
                        <div className="flex items-center gap-2">
                          <Server className="h-4 w-4" />
                          Disk: {gatewayInfo.disk.used_gb} / {gatewayInfo.disk.total_gb} GB ({gatewayInfo.disk.used_pct}%)
                          {gatewayInfo.disk.used_pct > 80 && <Badge variant="destructive" className="text-xs ml-2">เต็มเกือบเต็ม!</Badge>}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {gatewayInfo && gatewayInfo.error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4" data-testid="gateway-error">
                    <div className="flex items-start gap-3">
                      <WifiOff className="h-5 w-5 text-red-600 mt-0.5" />
                      <div>
                        <p className="font-medium text-sm text-red-700">ไม่สามารถเชื่อมต่อ Gateway ได้</p>
                        <p className="text-xs text-red-600 mt-1">{gatewayInfo.error}</p>
                        <p className="text-xs text-gray-500 mt-2">ตรวจสอบว่า gateway URL ถูกต้อง และเซิร์ฟเวอร์ออนไลน์อยู่</p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">เกี่ยวกับ LINE Gateway</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-gray-700 space-y-3">
                  <p>
                    LINE Gateway เป็นตัวกลางระหว่าง LINE กับระบบ e-Tax Center — ทำหน้าที่รับ webhook จาก LINE แล้วส่งต่อให้ระบบประมวลผล
                  </p>
                  <div className="bg-gray-50 rounded-lg p-3 font-mono text-xs space-y-1">
                    <p>LINE → Gateway (PHP) → e-Tax Center</p>
                    <p>e-Tax Center → Gateway (PHP) → LINE API (push/reply)</p>
                  </div>
                  <div className="space-y-2">
                    <p className="font-medium text-gray-800">ข้อกำหนดเซิร์ฟเวอร์</p>
                    <ul className="list-disc pl-4 text-xs text-gray-600 space-y-1">
                      <li>PHP 8.2+ (แนะนำ 8.4)</li>
                      <li>MySQL / MariaDB (สำหรับ webhook queue)</li>
                      <li>HTTPS (SSL Certificate)</li>
                      <li>cURL + PDO_MySQL extensions</li>
                      <li>สิทธิ์เขียนไฟล์ log/stats ในโฟลเดอร์เดียวกัน</li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <p className="font-medium text-gray-800">Webhook Queue (Pull-based)</p>
                    <p className="text-xs text-gray-600">
                      เมื่อ etaxerp ล่ม — Gateway เก็บ webhook ไว้ใน MySQL → เมื่อ etaxerp กลับมาออนไลน์ จะดึง (pull) webhook ที่ค้างมาประมวลผลเองอัตโนมัติ ไม่ต้องตั้ง cron
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {isSysAdmin && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Settings2 className="h-4 w-4" />
                    ตั้งค่า Queue Drain (sysAdmin)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <p className="text-xs text-gray-600">
                      กำหนดความถี่ในการดึง webhook ที่ค้างจาก Gateway — ค่า 0 = ปิด, สูงสุด 1440 นาที (1 วัน)
                    </p>
                    <div className="flex items-end gap-3">
                      <div className="flex-1">
                        <Label className="text-sm">รอบดึง (นาที)</Label>
                        <Input
                          type="number"
                          min="0"
                          max="1440"
                          value={drainInterval}
                          onChange={(e) => setDrainInterval(e.target.value)}
                          placeholder="10"
                          className="mt-1"
                          data-testid="input-drain-interval"
                        />
                      </div>
                      <Button
                        onClick={async () => {
                          const val = parseInt(drainInterval, 10);
                          if (isNaN(val) || val < 0 || val > 1440) {
                            toast({ title: "ระบุ 0-1440 นาที", variant: "destructive" });
                            return;
                          }
                          setDrainSaving(true);
                          try {
                            const res = await fetch("/api/line/gateway-drain-config", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              credentials: "include",
                              body: JSON.stringify({ intervalMin: val }),
                            });
                            const data = await res.json();
                            if (res.ok) {
                              toast({ title: data.message || "บันทึกแล้ว" });
                            } else {
                              toast({ title: data.message || "เกิดข้อผิดพลาด", variant: "destructive" });
                            }
                          } catch {
                            toast({ title: "เกิดข้อผิดพลาด", variant: "destructive" });
                          } finally {
                            setDrainSaving(false);
                          }
                        }}
                        disabled={drainSaving}
                        className="bg-[#fb9678] hover:bg-[#e8856a]"
                        data-testid="button-save-drain-interval"
                      >
                        {drainSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "บันทึก"}
                      </Button>
                    </div>
                    <div className="text-xs text-gray-500">
                      สถานะปัจจุบัน: {drainConfig ? (drainConfig.intervalMin === 0 ? "ปิด" : `ทุก ${drainConfig.intervalMin} นาที`) : "กำลังโหลด..."}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
