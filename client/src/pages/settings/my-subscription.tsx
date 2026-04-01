import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { formatDate } from "@/lib/format";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import {
  Crown, Users, FileText, Store, Package, Zap,
  CheckCircle2, XCircle, AlertTriangle, ArrowUpRight,
  Building2, ShoppingCart, Calendar, Clock,
  CreditCard, Upload, QrCode, RefreshCw, Loader2, History, ImageIcon, Printer,
} from "lucide-react";

interface SubscriptionInfo {
  subscription: {
    id: number;
    tenantId: number;
    planId: number;
    status: string;
    billingCycle: string;
    startDate: string;
    endDate: string | null;
    trialEndsAt: string | null;
    plan?: Plan;
  } | null;
  usage: { users: number; companies: number; products: number; documents: number; ecommerceConnections: number } | null;
  plan: Plan | null;
  daysRemaining: number | null;
  isExpiringSoon: boolean;
}

interface Plan {
  id: number;
  code: string;
  name: string;
  nameEn: string;
  description: string;
  targetGroup: string;
  setupFee: string;
  monthlyPrice: string;
  yearlyPrice: string;
  maxUsers: number;
  maxDocumentsPerMonth: number;
  maxCompanies: number;
  maxBranches: number;
  maxEcommerceConnections: number;
  maxProducts: number;
  features: string[] | null;
  hasAiFeatures: boolean;
  hasHrModule: boolean;
  hasPosModule: boolean;
  hasApiAccess: boolean;
  hasWhiteLabel: boolean;
  hasFirmModule: boolean;
}

interface PaymentOrder {
  id: number;
  tenantId: number;
  planId: number;
  amount: string;
  setupFeeAmount: string;
  billingCycle: string;
  status: string;
  orderType: string;
  promptpayRef: string | null;
  slipImageUrl: string | null;
  invoiceNumber: string | null;
  taxInvoiceId: number | null;
  notes: string | null;
  createdAt: string;
  plan?: Plan;
}

const planColors: Record<string, string> = {
  "general-starter": "#9ca3af",
  "general-business": "#03c9d7",
  "general-plus": "#fb9678",
  "ecom-lite": "var(--theme-primary)",
  "ecom-hub": "#03c9d7",
  "ecom-pro": "#fb9678",
  "firm-starter": "#03c9d7",
  "firm-pro": "#fb9678",
  "firm-enterprise": "#05b187",
  free: "#9ca3af",
  starter: "#03c9d7",
  pro: "#fb9678",
  enterprise: "#05b187",
};

function UsageBar({ label, icon: Icon, current, limit, color }: { label: string; icon: any; current: number; limit: number; color: string }) {
  const pct = limit > 0 ? Math.min(100, (current / limit) * 100) : 0;
  const isNearLimit = pct >= 80;
  const isAtLimit = pct >= 100;
  return (
    <div className="space-y-2" data-testid={`usage-${label}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" style={{ color }} />
          <span className="text-sm font-medium text-gray-700">{label}</span>
        </div>
        <span className={`text-sm font-semibold ${isAtLimit ? "text-red-500" : isNearLimit ? "text-amber-500" : "text-gray-600"}`}>
          {current.toLocaleString()} / {limit >= 999999 ? "ไม่จำกัด" : limit.toLocaleString()}
        </span>
      </div>
      {limit < 999999 && (
        <div className="relative">
          <Progress value={pct} className="h-2.5 bg-gray-100" />
          <div
            className="absolute top-0 left-0 h-2.5 rounded-full transition-all"
            style={{ width: `${pct}%`, background: isAtLimit ? "#f94d4d" : isNearLimit ? "#fec90f" : color }}
          />
        </div>
      )}
    </div>
  );
}

function formatThaiDate(dateStr: string | null) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return d.toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
}

export default function MySubscription() {
  const { selectedCompanyId } = useCompany();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [renewDialog, setRenewDialog] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [billingCycle, setBillingCycle] = useState<string>("monthly");
  const [qrData, setQrData] = useState<string | null>(null);
  const [currentOrderId, setCurrentOrderId] = useState<number | null>(null);
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [slipPreview, setSlipPreview] = useState<string | null>(null);

  const { data, isLoading } = useQuery<SubscriptionInfo>({
    queryKey: ["/api/my-subscription-info"],
    queryFn: async () => {
      const r = await fetch("/api/my-subscription-info", { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });

  const { data: docSettings } = useQuery<any>({
    queryKey: ["/api/document-settings", selectedCompanyId],
    queryFn: async () => {
      if (!selectedCompanyId) return null;
      const res = await fetch(`/api/document-settings?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!selectedCompanyId,
  });

  const { data: allPlans = [] } = useQuery<Plan[]>({
    queryKey: ["/api/subscription-plans"],
    queryFn: async () => {
      const r = await fetch("/api/subscription-plans", { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });

  const { data: myPayments = [] } = useQuery<PaymentOrder[]>({
    queryKey: ["/api/subscription/my-payments"],
    queryFn: async () => {
      const r = await fetch("/api/subscription/my-payments", { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
  });

  const createPayment = useMutation({
    mutationFn: async (params: { planId: number; billingCycle: string; orderType: string }) => {
      const r = await fetch("/api/subscription/create-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(params),
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: (data) => {
      setQrData(data.qrData);
      setCurrentOrderId(data.order.id);
      setTotalAmount(data.totalAmount);
      queryClient.invalidateQueries({ queryKey: ["/api/subscription/my-payments"] });
    },
    onError: (err: any) => {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    },
  });

  const uploadSlip = useMutation({
    mutationFn: async ({ orderId, slipUrl }: { orderId: number; slipUrl: string }) => {
      const r = await fetch(`/api/subscription/upload-slip/${orderId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ slipImageUrl: slipUrl }),
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "อัพโหลดสลิปสำเร็จ", description: "กรุณารอการตรวจสอบจากทีมงาน" });
      queryClient.invalidateQueries({ queryKey: ["/api/subscription/my-payments"] });
      setRenewDialog(false);
      setQrData(null);
      setCurrentOrderId(null);
      setSlipFile(null);
    },
    onError: (err: any) => {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    },
  });

  const handleCreatePayment = () => {
    if (!selectedPlanId) {
      toast({ title: "กรุณาเลือกแพ็คเกจ", variant: "destructive" });
      return;
    }
    createPayment.mutate({
      planId: Number(selectedPlanId),
      billingCycle,
      orderType: data?.subscription ? "renewal" : "new",
    });
  };

  const handleSlipUpload = async () => {
    if (!slipFile || !currentOrderId) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      uploadSlip.mutate({ orderId: currentOrderId, slipUrl: base64 });
    };
    reader.readAsDataURL(slipFile);
  };

  if (isLoading) return <Layout><div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-[#03c9d7] border-t-transparent rounded-full" /></div></Layout>;

  const plan = data?.plan;
  const sub = data?.subscription;
  const usage = data?.usage;
  const planCode = plan?.code || "free";
  const color = planColors[planCode] || "#03c9d7";

  const statusPaymentBadge = (status: string) => {
    const map: Record<string, { label: string; color: string }> = {
      pending: { label: "รอตรวจสอบ", color: "#fec90f" },
      confirmed: { label: "ยืนยันแล้ว", color: "#05b187" },
      rejected: { label: "ปฏิเสธ", color: "#f94d4d" },
    };
    const s = map[status] || map.pending;
    return <Badge style={{ backgroundColor: s.color + "18", color: s.color, border: `1px solid ${s.color}30` }} className="font-semibold text-xs">{s.label}</Badge>;
  };

  const selectedPlan = allPlans.find(p => p.id === Number(selectedPlanId));
  const selectedPrice = selectedPlan ? (billingCycle === "yearly" ? Number(selectedPlan.yearlyPrice || selectedPlan.monthlyPrice) : Number(selectedPlan.monthlyPrice)) : 0;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-800" data-testid="text-page-title">แพ็คเกจของฉัน</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowHistory(true)} data-testid="btn-payment-history">
              <History className="w-4 h-4 mr-1" />
              ประวัติการชำระ
            </Button>
          </div>
        </div>

        {data?.isExpiringSoon && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4" data-testid="alert-expiring-soon">
            <AlertTriangle className="h-6 w-6 text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold text-amber-700">แพ็คเกจใกล้หมดอายุ!</p>
              <p className="text-sm text-amber-600 mt-0.5">เหลืออีก {data.daysRemaining} วัน กรุณาต่ออายุเพื่อใช้งานต่อเนื่อง</p>
            </div>
            <Button
              size="sm"
              className="shrink-0"
              style={{ background: "#fb9678" }}
              onClick={() => { setSelectedPlanId(String(sub?.planId || "")); setRenewDialog(true); }}
              data-testid="btn-renew-now"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              ต่ออายุ
            </Button>
          </div>
        )}

        {sub?.status === "expired" && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4" data-testid="alert-expired">
            <XCircle className="h-6 w-6 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold text-red-700">แพ็คเกจหมดอายุแล้ว</p>
              <p className="text-sm text-red-600 mt-0.5">กรุณาต่ออายุเพื่อใช้งานระบบต่อ</p>
            </div>
            <Button
              size="sm"
              className="shrink-0 bg-red-500 hover:bg-red-600 text-white"
              onClick={() => { setSelectedPlanId(String(sub?.planId || "")); setRenewDialog(true); }}
              data-testid="btn-renew-expired"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              ต่ออายุ
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1 border-0 shadow-md overflow-hidden" data-testid="card-current-plan">
            <div className="h-2" style={{ background: color }} />
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-gray-600">แพ็คเกจปัจจุบัน</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 rounded-2xl flex items-center justify-center" style={{ background: `${color}15` }}>
                  <Crown className="h-7 w-7" style={{ color }} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold" style={{ color }} data-testid="text-plan-name">{plan?.name || "ฟรี"}</h2>
                  <p className="text-sm text-gray-500">{plan?.description}</p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">สถานะ</span>
                  <Badge
                    className="text-xs"
                    style={{
                      background: sub?.status === "active" ? "#05b18720" : sub?.status === "expired" ? "#f94d4d20" : "#fec90f20",
                      color: sub?.status === "active" ? "#05b187" : sub?.status === "expired" ? "#f94d4d" : "#fec90f",
                      border: "none",
                    }}
                    data-testid="badge-status"
                  >
                    {sub?.status === "active" ? "ใช้งานอยู่" : sub?.status === "trial" ? "ทดลองใช้" : sub?.status === "expired" ? "หมดอายุ" : sub?.status || "ใช้งานอยู่"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">รอบชำระ</span>
                  <span className="text-sm font-medium" data-testid="text-billing-cycle">
                    {sub?.billingCycle === "yearly" ? "รายปี" : "รายเดือน"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">ราคา</span>
                  <span className="text-sm font-bold" style={{ color }} data-testid="text-price">
                    {plan ? `฿${Number(sub?.billingCycle === "yearly" ? plan.yearlyPrice : plan.monthlyPrice).toLocaleString()}/${sub?.billingCycle === "yearly" ? "ปี" : "เดือน"}` : "ฟรี"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">เริ่มใช้งาน</span>
                  <span className="text-sm font-medium" data-testid="text-start-date">
                    {formatThaiDate(sub?.startDate || null)}
                  </span>
                </div>
                {sub?.endDate && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">หมดอายุ</span>
                    <span className={`text-sm font-medium ${data?.isExpiringSoon ? "text-red-500" : ""}`} data-testid="text-end-date">
                      {formatThaiDate(sub.endDate)}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  className="flex-1 rounded-xl h-11 font-semibold"
                  style={{ background: "#fb9678", color: "#fff" }}
                  onClick={() => { setSelectedPlanId(String(sub?.planId || "")); setQrData(null); setCurrentOrderId(null); setRenewDialog(true); }}
                  data-testid="btn-renew"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  ต่ออายุ
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl h-11 font-semibold"
                  style={{ borderColor: "#03c9d7", color: "#03c9d7" }}
                  onClick={() => setLocation("/settings/upgrade")}
                  data-testid="btn-upgrade-plan"
                >
                  <ArrowUpRight className="h-4 w-4 mr-2" />
                  อัพเกรด
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2 border-0 shadow-md" data-testid="card-usage">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-gray-600 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                การใช้งานเดือนนี้
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {usage && plan && (
                <>
                  <UsageBar label="ผู้ใช้งาน" icon={Users} current={usage.users} limit={plan.maxUsers} color="#03c9d7" />
                  <UsageBar label="บริษัท" icon={Building2} current={usage.companies} limit={plan.maxCompanies} color="#fb9678" />
                  <UsageBar label="สินค้า" icon={Package} current={usage.products} limit={plan.maxProducts} color="#05b187" />
                  <UsageBar label="เอกสาร/เดือน" icon={FileText} current={usage.documents} limit={plan.maxDocumentsPerMonth} color="var(--theme-primary)" />
                  <UsageBar label="เชื่อมต่อ E-Commerce" icon={ShoppingCart} current={usage.ecommerceConnections} limit={plan.maxEcommerceConnections} color="#fec90f" />
                </>
              )}

              {plan?.features && plan.features.length > 0 && (
                <div className="border-t pt-4 mt-4">
                  <h3 className="text-sm font-semibold text-gray-600 mb-3">ฟีเจอร์ที่รวมอยู่ในแพ็คเกจ</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {plan.features.map((feat, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-gray-600">
                        <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color }} />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t pt-4 mt-4">
                <h3 className="text-sm font-semibold text-gray-600 mb-3">โมดูลที่เปิดใช้งาน</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "AI อัจฉริยะ", enabled: plan?.hasAiFeatures },
                    { label: "HR & เงินเดือน", enabled: plan?.hasHrModule },
                    { label: "POS ขายหน้าร้าน", enabled: plan?.hasPosModule },
                    { label: "Open API", enabled: plan?.hasApiAccess },
                    { label: "White Label", enabled: plan?.hasWhiteLabel },
                    { label: "จัดการสำนักงาน", enabled: (plan as any)?.hasFirmModule },
                  ].map((feat) => (
                    <div
                      key={feat.label}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${feat.enabled ? "bg-green-50 text-green-700" : "bg-gray-50 text-gray-400"}`}
                      data-testid={`feature-${feat.label}`}
                    >
                      {feat.enabled ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                      {feat.label}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {myPayments.length > 0 && (
          <Card className="border-0 shadow-md" data-testid="card-recent-payments">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-gray-600 flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-[#fb9678]" />
                รายการชำระเงินล่าสุด
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {myPayments.slice(0, 3).map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-xl" data-testid={`payment-${payment.id}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[#fb9678]/10 flex items-center justify-center">
                        <CreditCard className="w-5 h-5 text-[#fb9678]" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-gray-800">{payment.plan?.name || "แพ็คเกจ"}</p>
                        <p className="text-xs text-gray-400">{formatThaiDate(payment.createdAt)} • {payment.billingCycle === "yearly" ? "รายปี" : "รายเดือน"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-sm">฿{Number(payment.amount).toLocaleString()}</span>
                      {statusPaymentBadge(payment.status)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={renewDialog} onOpenChange={setRenewDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-[#fb9678]" />
              {qrData ? "ชำระเงิน PromptPay" : "ต่ออายุแพ็คเกจ"}
            </DialogTitle>
          </DialogHeader>

          {!qrData ? (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">เลือกแพ็คเกจ</label>
                <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                  <SelectTrigger data-testid="select-plan">
                    <SelectValue placeholder="เลือกแพ็คเกจ" />
                  </SelectTrigger>
                  <SelectContent>
                    {allPlans.map(p => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name} - ฿{Number(p.monthlyPrice).toLocaleString()}/เดือน
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">รอบชำระเงิน</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setBillingCycle("monthly")}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${billingCycle === "monthly" ? "border-[#fb9678] bg-[#fb9678]/5 text-[#fb9678]" : "border-gray-200 text-gray-500"}`}
                    data-testid="btn-monthly"
                  >
                    รายเดือน
                  </button>
                  <button
                    onClick={() => setBillingCycle("yearly")}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${billingCycle === "yearly" ? "border-[#fb9678] bg-[#fb9678]/5 text-[#fb9678]" : "border-gray-200 text-gray-500"}`}
                    data-testid="btn-yearly"
                  >
                    รายปี (ประหยัด)
                  </button>
                </div>
              </div>

              {selectedPlan && (
                <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">แพ็คเกจ</span>
                    <span className="font-semibold">{selectedPlan.name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">รอบ</span>
                    <span className="font-medium">{billingCycle === "yearly" ? "รายปี" : "รายเดือน"}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">ค่าบริการ</span>
                    <span className="font-bold text-[#fb9678]">฿{selectedPrice.toLocaleString()}</span>
                  </div>
                  {Number(selectedPlan.setupFee) > 0 && !data?.subscription && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">ค่าติดตั้ง (ครั้งเดียว)</span>
                      <span className="font-medium">฿{Number(selectedPlan.setupFee).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="border-t pt-2 flex justify-between">
                    <span className="font-semibold">รวมทั้งสิ้น</span>
                    <span className="font-bold text-lg text-[#fb9678]">
                      ฿{(selectedPrice + ((!data?.subscription && Number(selectedPlan.setupFee) > 0) ? Number(selectedPlan.setupFee) : 0)).toLocaleString()}
                    </span>
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setRenewDialog(false)}>ยกเลิก</Button>
                <Button
                  style={{ background: "#fb9678" }}
                  onClick={handleCreatePayment}
                  disabled={!selectedPlanId || createPayment.isPending}
                  data-testid="btn-generate-qr"
                >
                  {createPayment.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <QrCode className="w-4 h-4 mr-2" />}
                  สร้าง QR ชำระเงิน
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-center">
                <div className="bg-white border-2 border-gray-100 rounded-2xl p-6 inline-block mb-3">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrData)}`}
                    alt="PromptPay QR Code"
                    className="w-[250px] h-[250px]"
                    data-testid="img-qr-code"
                  />
                </div>
                <p className="text-2xl font-bold text-[#fb9678]">฿{totalAmount.toLocaleString()}</p>
                <p className="text-sm text-gray-500 mt-1">สแกนจ่ายผ่าน PromptPay</p>
              </div>

              <div className="border-t pt-4">
                <label className="text-sm font-medium text-gray-700 mb-2 block">อัพโหลดสลิปการโอนเงิน</label>
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center hover:border-[#fb9678]/50 transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    id="slip-upload"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setSlipFile(file);
                        const reader = new FileReader();
                        reader.onload = () => setSlipPreview(reader.result as string);
                        reader.readAsDataURL(file);
                      }
                    }}
                    data-testid="input-slip-upload"
                  />
                  {slipPreview ? (
                    <div className="space-y-2">
                      <img src={slipPreview} alt="Slip preview" className="max-h-40 mx-auto rounded-lg" />
                      <p className="text-xs text-gray-500">{slipFile?.name}</p>
                    </div>
                  ) : (
                    <label htmlFor="slip-upload" className="cursor-pointer">
                      <Upload className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                      <p className="text-sm text-gray-500">คลิกเพื่อเลือกไฟล์สลิป</p>
                      <p className="text-xs text-gray-400 mt-1">รองรับ JPG, PNG</p>
                    </label>
                  )}
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => { setQrData(null); setSlipFile(null); setSlipPreview(null); }}>
                  กลับ
                </Button>
                <Button
                  style={{ background: "#05b187" }}
                  onClick={handleSlipUpload}
                  disabled={!slipFile || uploadSlip.isPending}
                  data-testid="btn-submit-slip"
                >
                  {uploadSlip.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                  ส่งสลิป
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-[#03c9d7]" />
              ประวัติการชำระเงิน
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {myPayments.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <CreditCard className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p>ยังไม่มีประวัติการชำระเงิน</p>
              </div>
            ) : (
              myPayments.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-xl" data-testid={`history-payment-${payment.id}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#fb9678]/10 flex items-center justify-center">
                      {payment.slipImageUrl ? <ImageIcon className="w-5 h-5 text-[#fb9678]" /> : <CreditCard className="w-5 h-5 text-[#fb9678]" />}
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-gray-800">{payment.plan?.name || "แพ็คเกจ"}</p>
                      <p className="text-xs text-gray-400">
                        {formatThaiDate(payment.createdAt)} • {payment.billingCycle === "yearly" ? "รายปี" : "รายเดือน"}
                        {payment.orderType === "new" ? " • สมัครใหม่" : " • ต่ออายุ"}
                      </p>
                      {payment.invoiceNumber && (
                        <p className="text-xs text-blue-500 mt-0.5">เลขที่ใบเสร็จ: {payment.invoiceNumber}</p>
                      )}
                      {payment.notes && payment.status === "rejected" && (
                        <p className="text-xs text-red-400 mt-0.5">หมายเหตุ: {payment.notes}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="font-bold text-sm block">฿{Number(payment.amount).toLocaleString()}</span>
                      {Number(payment.setupFeeAmount) > 0 && (
                        <span className="text-xs text-gray-400">+ ค่าติดตั้ง ฿{Number(payment.setupFeeAmount).toLocaleString()}</span>
                      )}
                    </div>
                    {statusPaymentBadge(payment.status)}
                    {payment.status === "confirmed" && payment.taxInvoiceId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 px-2"
                        onClick={() => window.open(`/api/subscription/tax-invoice/${payment.id}/pdf`, "_blank")}
                        data-testid={`btn-print-invoice-${payment.id}`}
                      >
                        <Printer className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
