import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import PlatformLayout from "@/components/platform-layout";
import ThaiDateInput from "@/components/thai-date-input";
import { useDateSettings } from "@/hooks/use-date-settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Crown, Users, FileText, Store, Package, Zap, CheckCircle2, XCircle,
  Building2, TrendingUp, Shield, Star, ArrowUpRight, Pencil, Save, Loader2,
  MoreVertical, PlayCircle, PauseCircle, Clock, CalendarPlus, Image, Eye, X,
  Truck, Briefcase, Plus,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";

interface Plan {
  id: number;
  code: string;
  name: string;
  nameEn: string;
  description: string;
  monthlyPrice: string;
  yearlyPrice: string;
  maxUsers: number;
  maxDocumentsPerMonth: number;
  maxCompanies: number;
  maxEcommerceConnections: number;
  maxProducts: number;
  hasAiFeatures: boolean;
  hasHrModule: boolean;
  hasPosModule: boolean;
  hasApiAccess: boolean;
  hasWhiteLabel: boolean;
  targetGroup: string;
  setupFee: string;
  features: string[] | null;
  maxBranches: number;
  hasFirmModule: boolean;
  hasDeliveryModule: boolean;
  enabledModules: string[] | null;
  landingFeatures: string[] | null;
  landingCta: string | null;
  landingLink: string | null;
  popular: boolean;
}

interface Addon {
  id: number;
  code: string;
  name: string;
  nameEn: string | null;
  description: string | null;
  monthlyPrice: string;
  yearlyPrice: string | null;
  featureFlag: string;
  icon: string | null;
  active: boolean;
  sortOrder: number;
}

const ALL_MODULES = [
  { key: "dashboard", label: "แผงควบคุม" },
  { key: "accounting", label: "การบัญชี" },
  { key: "petty-cash", label: "เงินสดย่อย" },
  { key: "sales", label: "การขาย & รายได้" },
  { key: "purchases", label: "การซื้อ & รายจ่าย" },
  { key: "finance", label: "การเงิน" },
  { key: "contacts", label: "ประวัติคู่ค้า" },
  { key: "inventory", label: "คลังสินค้า" },
  { key: "assets", label: "ทะเบียนสินทรัพย์" },
  { key: "reports", label: "รายงาน" },
  { key: "firm-mgmt", label: "บริหารสำนักงาน" },
  { key: "hr", label: "HR & เวลาทำงาน" },
  { key: "ecommerce", label: "eCommerce Hub" },
  { key: "pos", label: "POS ขายหน้าร้าน" },
  { key: "commerce-intelligence", label: "Commerce Intelligence" },
  { key: "etax-hub", label: "eTax Center" },
  { key: "gas-station", label: "ปั๊มน้ำมัน" },
  { key: "job-costing", label: "ต้นทุนงานก่อสร้าง" },
  { key: "settings", label: "ตั้งค่า" },
];

interface Subscription {
  id: number;
  tenantId: number;
  planId: number;
  status: string;
  billingCycle: string;
  startDate: string;
  endDate: string | null;
  trialEndsAt: string | null;
  plan?: Plan;
  tenant?: { id: number; name: string; tenantType: string; status: string };
}

interface SubscriptionPayment {
  id: number;
  tenantId: number;
  subscriptionId: number;
  planId: number;
  amount: string;
  billingCycle: string;
  slipImageUrl: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  tenant?: { id: number; name: string };
  plan?: { id: number; name: string; code: string };
}

const planColors: Record<string, string> = {
  free: "#9ca3af",
  starter: "#03c9d7",
  pro: "#fb9678",
  enterprise: "#8b5cf6",
};

const planIcons: Record<string, any> = {
  free: Star,
  starter: Zap,
  pro: Crown,
  enterprise: Shield,
};

const targetGroupLabels: Record<string, string> = {
  general: "ธุรกิจทั่วไป",
  ecommerce: "ร้านค้าออนไลน์",
  firm: "สำนักงานบัญชี",
};

const targetGroupIcons: Record<string, any> = {
  general: Building2,
  ecommerce: Store,
  firm: Briefcase,
};

function formatPrice(price: string) {
  const num = parseFloat(price);
  if (num === 0) return "ฟรี";
  return `฿${num.toLocaleString()}`;
}

type TabKey = "plans" | "members" | "payments" | "addons";

export default function PlatformSubscriptions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { dateEra, dateFmt } = useDateSettings();
  const [activeTab, setActiveTab] = useState<TabKey>("plans");
  const [changePlanDialog, setChangePlanDialog] = useState<Subscription | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [selectedBillingCycle, setSelectedBillingCycle] = useState<string>("monthly");
  const [editPlan, setEditPlan] = useState<Plan | null>(null);
  const [editForm, setEditForm] = useState<Partial<Plan & { featuresText: string; landingFeaturesText: string; enabledModules: string[] }>>({});
  const [manageDialog, setManageDialog] = useState<{ sub: Subscription; action: "activate" | "extend" | "suspend" | "set-end-date" } | null>(null);
  const [editAddon, setEditAddon] = useState<Addon | null>(null);
  const [addonForm, setAddonForm] = useState<Partial<Addon>>({});
  const [extendDays, setExtendDays] = useState("30");
  const [endDateInput, setEndDateInput] = useState("");
  const [slipPreview, setSlipPreview] = useState<string | null>(null);
  const [rejectDialog, setRejectDialog] = useState<SubscriptionPayment | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");

  const { data: plans = [] } = useQuery<Plan[]>({
    queryKey: ["/api/subscription-plans"],
    queryFn: async () => {
      const r = await fetch("/api/subscription-plans", { credentials: "include" });
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
    staleTime: 0,
    refetchOnMount: "always",
  });

  const { data: subscriptions = [], isLoading } = useQuery<Subscription[]>({
    queryKey: ["/api/tenant-subscriptions"],
    queryFn: async () => {
      const r = await fetch("/api/tenant-subscriptions", { credentials: "include" });
      if (!r.ok) throw new Error(`API error: ${r.status}`);
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
    staleTime: 0,
    refetchOnMount: "always",
  });

  const { data: payments = [], isLoading: paymentsLoading } = useQuery<SubscriptionPayment[]>({
    queryKey: ["/api/admin/subscription-payments"],
    queryFn: async () => {
      const r = await fetch("/api/admin/subscription-payments", { credentials: "include" });
      if (!r.ok) return [];
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
    staleTime: 0,
    refetchOnMount: "always",
    enabled: activeTab === "payments",
  });

  const { data: addons = [] } = useQuery<Addon[]>({
    queryKey: ["/api/admin/subscription-addons"],
    queryFn: async () => {
      const r = await fetch("/api/admin/subscription-addons", { credentials: "include" });
      if (!r.ok) return [];
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
    staleTime: 0,
    refetchOnMount: "always",
    enabled: activeTab === "addons",
  });

  const updateAddon = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Addon> }) => {
      const r = await fetch(`/api/admin/subscription-addons/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subscription-addons"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subscription-addons"] });
      toast({ title: "บันทึก Add-on สำเร็จ" });
      setEditAddon(null);
    },
    onError: () => toast({ title: "เกิดข้อผิดพลาด", variant: "destructive" }),
  });

  const createAddon = useMutation({
    mutationFn: async (data: Partial<Addon>) => {
      const r = await fetch("/api/admin/subscription-addons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subscription-addons"] });
      toast({ title: "สร้าง Add-on สำเร็จ" });
      setEditAddon(null);
    },
    onError: () => toast({ title: "เกิดข้อผิดพลาด", variant: "destructive" }),
  });

  const changePlan = useMutation({
    mutationFn: async ({ subId, planId, billingCycle }: { subId: number; planId: number; billingCycle: string }) => {
      const now = new Date();
      const endDate = new Date(now);
      if (billingCycle === "yearly") {
        endDate.setFullYear(endDate.getFullYear() + 1);
      } else {
        endDate.setMonth(endDate.getMonth() + 1);
      }
      const r = await fetch(`/api/tenant-subscriptions/${subId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ planId, billingCycle, status: "active", startDate: now.toISOString(), endDate: endDate.toISOString() }),
      });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenant-subscriptions"] });
      toast({ title: "เปลี่ยนแพ็คเกจสำเร็จ" });
      setChangePlanDialog(null);
    },
  });

  const updatePlan = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Plan> }) => {
      const r = await fetch(`/api/subscription-plans/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscription-plans"] });
      toast({ title: "บันทึกแพ็คเกจสำเร็จ" });
      setEditPlan(null);
    },
    onError: () => {
      toast({ title: "เกิดข้อผิดพลาด", variant: "destructive" });
    },
  });

  const manageSub = useMutation({
    mutationFn: async ({ subId, data }: { subId: number; data: Record<string, any> }) => {
      const r = await fetch(`/api/tenant-subscriptions/${subId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!r.ok) { const err = await r.json(); throw new Error(err.message || "Failed"); }
      return r.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenant-subscriptions"] });
      const action = manageDialog?.action;
      const msg = action === "activate" ? "เปิดใช้งานสำเร็จ" : action === "extend" ? "ต่ออายุสำเร็จ" : action === "set-end-date" ? "กำหนดวันหมดอายุสำเร็จ" : "ระงับสำเร็จ";
      toast({ title: msg });
      setManageDialog(null);
    },
    onError: (err: any) => {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    },
  });

  const confirmPayment = useMutation({
    mutationFn: async (paymentId: number) => {
      const r = await fetch(`/api/admin/subscription-payments/${paymentId}/confirm`, {
        method: "POST",
        credentials: "include",
      });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subscription-payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tenant-subscriptions"] });
      toast({ title: "ยืนยันการชำระเงินสำเร็จ" });
    },
    onError: () => {
      toast({ title: "เกิดข้อผิดพลาด", variant: "destructive" });
    },
  });

  const rejectPayment = useMutation({
    mutationFn: async ({ paymentId, notes }: { paymentId: number; notes: string }) => {
      const r = await fetch(`/api/admin/subscription-payments/${paymentId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ notes }),
      });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subscription-payments"] });
      toast({ title: "ปฏิเสธการชำระเงินแล้ว" });
      setRejectDialog(null);
      setRejectNotes("");
    },
    onError: () => {
      toast({ title: "เกิดข้อผิดพลาด", variant: "destructive" });
    },
  });

  const handleManageConfirm = () => {
    if (!manageDialog) return;
    const { sub, action } = manageDialog;
    if (action === "activate") {
      const now = new Date();
      const endDate = new Date(now);
      if (sub.billingCycle === "yearly") {
        endDate.setFullYear(endDate.getFullYear() + 1);
      } else {
        endDate.setMonth(endDate.getMonth() + 1);
      }
      manageSub.mutate({ subId: sub.id, data: { status: "active", trialEndsAt: null, startDate: now.toISOString(), endDate: endDate.toISOString() } });
    } else if (action === "extend") {
      const days = parseInt(extendDays) || 30;
      const effectiveDate = sub.endDate || sub.trialEndsAt;
      const base = effectiveDate ? new Date(effectiveDate) : new Date();
      if (base < new Date()) base.setTime(Date.now());
      base.setDate(base.getDate() + days);
      if (sub.status === "trial") {
        manageSub.mutate({ subId: sub.id, data: { trialEndsAt: base.toISOString() } });
      } else {
        manageSub.mutate({ subId: sub.id, data: { status: "active", endDate: base.toISOString() } });
      }
    } else if (action === "set-end-date") {
      if (!endDateInput) return;
      const endDate = new Date(endDateInput + "T23:59:59");
      manageSub.mutate({ subId: sub.id, data: { status: "active", endDate: endDate.toISOString() } });
    } else if (action === "suspend") {
      manageSub.mutate({ subId: sub.id, data: { status: "cancelled" } });
    }
  };

  const openEditPlan = (plan: Plan) => {
    setEditPlan(plan);
    setEditForm({
      ...plan,
      featuresText: plan.features ? plan.features.join(", ") : "",
      landingFeaturesText: plan.landingFeatures ? plan.landingFeatures.join("\n") : "",
      enabledModules: plan.enabledModules || [],
    });
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; color: string }> = {
      active: { label: "ใช้งาน", color: "#05b187" },
      trial: { label: "ทดลองใช้", color: "#fec90f" },
      expired: { label: "หมดอายุ", color: "#f94d4d" },
      cancelled: { label: "ยกเลิก", color: "#9ca3af" },
    };
    const s = map[status] || map.active;
    return <Badge style={{ backgroundColor: s.color + "18", color: s.color, border: `1px solid ${s.color}30` }} className="font-semibold">{s.label}</Badge>;
  };

  const paymentStatusBadge = (status: string) => {
    const map: Record<string, { label: string; color: string }> = {
      pending: { label: "รอยืนยัน", color: "#fec90f" },
      confirmed: { label: "ยืนยันแล้ว", color: "#05b187" },
      rejected: { label: "ปฏิเสธ", color: "#f94d4d" },
    };
    const s = map[status] || map.pending;
    return <Badge style={{ backgroundColor: s.color + "18", color: s.color, border: `1px solid ${s.color}30` }} className="font-semibold">{s.label}</Badge>;
  };

  const pendingPaymentsCount = payments.filter(p => p.status === "pending").length;

  const groupedPlans = plans.reduce<Record<string, Plan[]>>((acc, plan) => {
    const group = plan.targetGroup || "general";
    if (!acc[group]) acc[group] = [];
    acc[group].push(plan);
    return acc;
  }, {});

  const targetGroupOrder = ["general", "ecommerce", "firm"];

  const tabs: { key: TabKey; label: string; badge?: number }[] = [
    { key: "plans", label: "แพ็คเกจ" },
    { key: "addons", label: "Add-on Module" },
    { key: "members", label: "สมาชิก" },
    { key: "payments", label: "รอยืนยันชำระเงิน", badge: pendingPaymentsCount },
  ];

  return (
    <PlatformLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900" data-testid="text-subscriptions-title">จัดการแพ็คเกจสมาชิก</h1>
            <p className="text-gray-500 mt-1">ดูและจัดการแพ็คเกจของลูกค้าทั้งหมด</p>
          </div>
        </div>

        <div className="flex gap-1 border-b border-gray-200" data-testid="tabs-subscriptions">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors relative ${
                activeTab === tab.key
                  ? "border-[#fb9678] text-[#fb9678]"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
              data-testid={`tab-${tab.key}`}
            >
              {tab.label}
              {tab.badge && tab.badge > 0 ? (
                <span className="ml-1.5 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-[#f94d4d] text-white min-w-[18px]">
                  {tab.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {activeTab === "plans" && (
          <>
            {targetGroupOrder.map((groupKey) => {
              const groupPlans = groupedPlans[groupKey];
              if (!groupPlans || groupPlans.length === 0) return null;
              const GroupIcon = targetGroupIcons[groupKey] || Building2;
              return (
                <div key={groupKey} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <GroupIcon className="w-5 h-5 text-[#03c9d7]" />
                    <h2 className="text-lg font-bold text-gray-800" data-testid={`text-group-${groupKey}`}>
                      {targetGroupLabels[groupKey] || groupKey}
                    </h2>
                    <Badge variant="secondary" className="text-xs">{groupPlans.length} แพ็คเกจ</Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {groupPlans.map((plan) => {
                      const Icon = planIcons[plan.code] || Star;
                      const color = planColors[plan.code] || "#9ca3af";
                      const count = subscriptions.filter((s) => s.planId === plan.id).length;
                      return (
                        <Card key={plan.id} className="border-t-4" style={{ borderTopColor: color }} data-testid={`card-plan-${plan.code}`}>
                          <CardContent className="p-5">
                            <div className="flex items-center gap-3 mb-3">
                              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: color + "15" }}>
                                <Icon className="w-5 h-5" style={{ color }} />
                              </div>
                              <div>
                                <p className="font-bold text-gray-900">{plan.name}</p>
                                <p className="text-sm text-gray-500">{formatPrice(plan.monthlyPrice)}/เดือน</p>
                              </div>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-500">สมาชิก</span>
                              <span className="text-xl font-bold" style={{ color }}>{count}</span>
                            </div>
                            <div className="mt-3 space-y-1 text-xs text-gray-500">
                              <div className="flex justify-between"><span>ผู้ใช้สูงสุด</span><span className="font-medium text-gray-700">{plan.maxUsers >= 999 ? "ไม่จำกัด" : plan.maxUsers}</span></div>
                              <div className="flex justify-between"><span>เอกสาร/เดือน</span><span className="font-medium text-gray-700">{plan.maxDocumentsPerMonth >= 999999 ? "ไม่จำกัด" : plan.maxDocumentsPerMonth.toLocaleString()}</span></div>
                              <div className="flex justify-between"><span>บริษัท</span><span className="font-medium text-gray-700">{plan.maxCompanies >= 999 ? "ไม่จำกัด" : plan.maxCompanies}</span></div>
                              {plan.maxBranches > 0 && (
                                <div className="flex justify-between"><span>สาขาสูงสุด</span><span className="font-medium text-gray-700">{plan.maxBranches >= 999 ? "ไม่จำกัด" : plan.maxBranches}</span></div>
                              )}
                              {plan.setupFee && parseFloat(plan.setupFee) > 0 && (
                                <div className="flex justify-between"><span>ค่าติดตั้ง</span><span className="font-medium text-gray-700">{formatPrice(plan.setupFee)}</span></div>
                              )}
                            </div>
                            {plan.features && plan.features.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {plan.features.slice(0, 3).map((f, i) => (
                                  <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">{f}</span>
                                ))}
                                {plan.features.length > 3 && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400">+{plan.features.length - 3}</span>
                                )}
                              </div>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full mt-3 text-xs"
                              style={{ borderColor: color + "50", color }}
                              onClick={() => openEditPlan(plan)}
                              data-testid={`btn-edit-plan-${plan.code}`}
                            >
                              <Pencil className="w-3 h-3 mr-1" />
                              แก้ไขแพ็คเกจ
                            </Button>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="w-5 h-5 text-[#fb9678]" />
                  ฟีเจอร์ตามแพ็คเกจ
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="table-plan-features">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-3 px-4 font-semibold text-gray-600">ฟีเจอร์</th>
                        {plans.map((p) => (
                          <th key={p.id} className="text-center py-3 px-4 font-semibold" style={{ color: planColors[p.code] || "#333" }}>{p.name}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: "จำนวนผู้ใช้", key: "maxUsers" },
                        { label: "เอกสาร/เดือน", key: "maxDocumentsPerMonth" },
                        { label: "จำนวนบริษัท", key: "maxCompanies" },
                        { label: "สาขาสูงสุด", key: "maxBranches" },
                        { label: "เชื่อมต่อ E-Commerce", key: "maxEcommerceConnections" },
                        { label: "จำนวนสินค้า", key: "maxProducts" },
                        { label: "AI Features", key: "hasAiFeatures" },
                        { label: "HR Module", key: "hasHrModule" },
                        { label: "POS Module", key: "hasPosModule" },
                        { label: "Firm Module", key: "hasFirmModule" },
                        { label: "Delivery Module", key: "hasDeliveryModule" },
                        { label: "API Access", key: "hasApiAccess" },
                        { label: "White Label", key: "hasWhiteLabel" },
                      ].map((feat) => (
                        <tr key={feat.key} className="border-b border-gray-50">
                          <td className="py-2.5 px-4 text-gray-700 font-medium">{feat.label}</td>
                          {plans.map((p) => {
                            const val = (p as any)[feat.key];
                            return (
                              <td key={p.id} className="py-2.5 px-4 text-center">
                                {typeof val === "boolean" ? (
                                  val ? <CheckCircle2 className="w-5 h-5 text-green-500 mx-auto" /> : <XCircle className="w-5 h-5 text-gray-300 mx-auto" />
                                ) : (
                                  <span className="font-semibold text-gray-800">{val >= 999 ? "ไม่จำกัด" : val?.toLocaleString()}</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                      <tr className="border-b border-gray-50 bg-gray-50/50">
                        <td className="py-2.5 px-4 text-gray-700 font-bold">ราคา/เดือน</td>
                        {plans.map((p) => (
                          <td key={p.id} className="py-2.5 px-4 text-center font-bold" style={{ color: planColors[p.code] }}>{formatPrice(p.monthlyPrice)}</td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {activeTab === "members" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#03c9d7]" />
                รายชื่อสมาชิกทั้งหมด
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : subscriptions.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>ยังไม่มีสมาชิก</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full" data-testid="table-subscriptions">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">ลูกค้า</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">แพ็คเกจ</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">สถานะ</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">รอบบิล</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">วันเริ่ม</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">หมดอายุ</th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600">จัดการ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subscriptions.map((sub) => {
                        const color = planColors[sub.plan?.code || "free"] || "#9ca3af";
                        const Icon = planIcons[sub.plan?.code || "free"] || Star;
                        return (
                          <tr key={sub.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors" data-testid={`row-subscription-${sub.id}`}>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-[#03c9d7]/10 flex items-center justify-center">
                                  <Building2 className="w-4 h-4 text-[#03c9d7]" />
                                </div>
                                <div>
                                  <p className="font-semibold text-gray-900 text-sm">{sub.tenant?.name || `Tenant #${sub.tenantId}`}</p>
                                  <p className="text-xs text-gray-400">{sub.tenant?.tenantType === "accounting_firm" ? "สำนักงานบัญชี" : "ธุรกิจทั่วไป"}</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <Icon className="w-4 h-4" style={{ color }} />
                                <span className="font-semibold text-sm" style={{ color }}>{sub.plan?.name || "-"}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4">{statusBadge(sub.status)}</td>
                            <td className="py-3 px-4 text-sm text-gray-600">{sub.billingCycle === "monthly" ? "รายเดือน" : "รายปี"}</td>
                            <td className="py-3 px-4 text-sm text-gray-600">
                              {sub.startDate ? new Date(sub.startDate).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" }) : "-"}
                            </td>
                            <td className="py-3 px-4">
                              {(() => {
                                const effectiveEnd = sub.status === "trial" ? sub.trialEndsAt : sub.endDate;
                                if (!effectiveEnd) return <span className="text-xs text-gray-300">ไม่จำกัด</span>;
                                const endDt = new Date(effectiveEnd);
                                const now = new Date();
                                const daysLeft = Math.ceil((endDt.getTime() - now.getTime()) / 86400000);
                                const isExpired = daysLeft < 0;
                                const isExpiring = daysLeft >= 0 && daysLeft <= 14;
                                return (
                                  <div className="space-y-0.5">
                                    <span className={`text-sm font-medium ${isExpired ? "text-red-500" : isExpiring ? "text-amber-600" : "text-gray-700"}`}>
                                      {endDt.toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" })}
                                    </span>
                                    <div className={`text-[11px] flex items-center gap-1 ${isExpired ? "text-red-400" : isExpiring ? "text-amber-500" : "text-gray-400"}`}>
                                      <Clock className="w-3 h-3" />
                                      {isExpired ? `หมดอายุแล้ว ${Math.abs(daysLeft)} วัน` : `เหลือ ${daysLeft} วัน`}
                                    </div>
                                  </div>
                                );
                              })()}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center gap-1 justify-end">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-[#03c9d7] border-[#03c9d7]/30 hover:bg-[#03c9d7]/5"
                                  onClick={() => { setChangePlanDialog(sub); setSelectedPlanId(String(sub.planId)); setSelectedBillingCycle(sub.billingCycle || "monthly"); }}
                                  data-testid={`button-change-plan-${sub.id}`}
                                >
                                  <ArrowUpRight className="w-3.5 h-3.5 mr-1" />
                                  เปลี่ยนแพ็คเกจ
                                </Button>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" data-testid={`btn-manage-sub-${sub.id}`}>
                                      <MoreVertical className="w-4 h-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    {sub.status !== "active" && (
                                      <DropdownMenuItem onClick={() => setManageDialog({ sub, action: "activate" })} data-testid={`btn-activate-${sub.id}`}>
                                        <PlayCircle className="w-4 h-4 mr-2 text-green-600" />
                                        <span>เปิดใช้งาน (Active)</span>
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem onClick={() => { setExtendDays("30"); setManageDialog({ sub, action: "extend" }); }} data-testid={`btn-extend-${sub.id}`}>
                                      <CalendarPlus className="w-4 h-4 mr-2 text-blue-600" />
                                      <span>ต่ออายุ (+วัน)</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => { setEndDateInput(sub.endDate ? new Date(sub.endDate).toISOString().split("T")[0] : ""); setManageDialog({ sub, action: "set-end-date" }); }} data-testid={`btn-set-end-date-${sub.id}`}>
                                      <Clock className="w-4 h-4 mr-2 text-amber-600" />
                                      <span>กำหนดวันหมดอายุ</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    {sub.status !== "cancelled" && (
                                      <DropdownMenuItem onClick={() => setManageDialog({ sub, action: "suspend" })} className="text-red-600" data-testid={`btn-suspend-${sub.id}`}>
                                        <PauseCircle className="w-4 h-4 mr-2" />
                                        <span>ระงับการใช้งาน</span>
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === "addons" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Package className="w-5 h-5 text-[#03c9d7]" />
                จัดการ Add-on Module
              </h2>
              <Button
                size="sm"
                className="bg-[#fb9678] hover:bg-[#f88565]"
                onClick={() => {
                  setEditAddon({ id: 0, code: "", name: "", nameEn: null, description: null, monthlyPrice: "0", yearlyPrice: null, featureFlag: "", icon: null, active: true, sortOrder: 0 });
                  setAddonForm({ code: "", name: "", nameEn: "", description: "", monthlyPrice: "0", yearlyPrice: "", featureFlag: "", active: true, sortOrder: 0 });
                }}
                data-testid="btn-create-addon"
              >
                <Plus className="w-4 h-4 mr-1" />
                สร้าง Add-on ใหม่
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {addons.map((addon) => (
                <Card key={addon.id} className={`border-t-4 ${addon.active ? "border-t-[#03c9d7]" : "border-t-gray-300 opacity-60"}`} data-testid={`card-addon-${addon.code}`}>
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-bold text-gray-900">{addon.name}</p>
                        <p className="text-xs text-gray-500">{addon.nameEn || addon.code}</p>
                      </div>
                      <Badge style={{ backgroundColor: addon.active ? "#05b18718" : "#9ca3af18", color: addon.active ? "#05b187" : "#9ca3af" }}>
                        {addon.active ? "เปิด" : "ปิด"}
                      </Badge>
                    </div>
                    {addon.description && <p className="text-xs text-gray-500 mb-3">{addon.description}</p>}
                    <div className="space-y-1 text-xs text-gray-600 mb-3">
                      <div className="flex justify-between"><span>ราคา/เดือน</span><span className="font-semibold">{formatPrice(addon.monthlyPrice)}</span></div>
                      {addon.yearlyPrice && <div className="flex justify-between"><span>ราคา/ปี</span><span className="font-semibold">{formatPrice(addon.yearlyPrice)}</span></div>}
                      <div className="flex justify-between"><span>Feature Flag</span><span className="font-mono text-[10px] bg-gray-100 px-1 rounded">{addon.featureFlag}</span></div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs"
                      style={{ borderColor: "#03c9d750", color: "#03c9d7" }}
                      onClick={() => {
                        setEditAddon(addon);
                        setAddonForm({ ...addon });
                      }}
                      data-testid={`btn-edit-addon-${addon.code}`}
                    >
                      <Pencil className="w-3 h-3 mr-1" /> แก้ไข Add-on
                    </Button>
                  </CardContent>
                </Card>
              ))}
              {addons.length === 0 && (
                <div className="col-span-3 text-center py-12 text-gray-400">ยังไม่มี Add-on</div>
              )}
            </div>
          </div>
        )}

        {activeTab === "payments" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#fec90f]" />
                รอยืนยันชำระเงิน
              </CardTitle>
            </CardHeader>
            <CardContent>
              {paymentsLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : payments.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>ยังไม่มีรายการชำระเงิน</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full" data-testid="table-payments">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">ลูกค้า</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">แพ็คเกจ</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">จำนวนเงิน</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">รอบบิล</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">สลิป</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">สถานะ</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">วันที่</th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600">จัดการ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((payment) => (
                        <tr key={payment.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors" data-testid={`row-payment-${payment.id}`}>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-lg bg-[#03c9d7]/10 flex items-center justify-center">
                                <Building2 className="w-4 h-4 text-[#03c9d7]" />
                              </div>
                              <p className="font-semibold text-gray-900 text-sm">{payment.tenant?.name || `Tenant #${payment.tenantId}`}</p>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              {(() => {
                                const Icon = planIcons[payment.plan?.code || "free"] || Star;
                                const color = planColors[payment.plan?.code || "free"] || "#9ca3af";
                                return (
                                  <>
                                    <Icon className="w-4 h-4" style={{ color }} />
                                    <span className="font-semibold text-sm" style={{ color }}>{payment.plan?.name || "-"}</span>
                                  </>
                                );
                              })()}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-sm font-semibold text-gray-900">{formatPrice(payment.amount)}</td>
                          <td className="py-3 px-4 text-sm text-gray-600">{payment.billingCycle === "monthly" ? "รายเดือน" : "รายปี"}</td>
                          <td className="py-3 px-4">
                            {payment.slipImageUrl ? (
                              <button
                                onClick={() => setSlipPreview(payment.slipImageUrl)}
                                className="w-12 h-12 rounded-lg border border-gray-200 overflow-hidden hover:border-[#03c9d7] hover:shadow-md transition-all cursor-pointer relative group"
                                data-testid={`btn-view-slip-${payment.id}`}
                              >
                                <img src={payment.slipImageUrl} alt="สลิป" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <Eye className="w-4 h-4 text-white" />
                                </div>
                              </button>
                            ) : (
                              <span className="text-xs text-gray-300">ไม่มีสลิป</span>
                            )}
                          </td>
                          <td className="py-3 px-4">{paymentStatusBadge(payment.status)}</td>
                          <td className="py-3 px-4 text-sm text-gray-600">
                            {payment.createdAt ? new Date(payment.createdAt).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" }) : "-"}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {payment.status === "pending" ? (
                              <div className="flex items-center gap-2 justify-end">
                                <Button
                                  size="sm"
                                  className="bg-[#05b187] hover:bg-[#049b76] text-white text-xs"
                                  onClick={() => confirmPayment.mutate(payment.id)}
                                  disabled={confirmPayment.isPending}
                                  data-testid={`btn-confirm-payment-${payment.id}`}
                                >
                                  {confirmPayment.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <CheckCircle2 className="w-3 h-3 mr-1" />}
                                  ยืนยัน
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-[#f94d4d]/30 text-[#f94d4d] hover:bg-[#f94d4d]/5 text-xs"
                                  onClick={() => { setRejectDialog(payment); setRejectNotes(""); }}
                                  data-testid={`btn-reject-payment-${payment.id}`}
                                >
                                  <XCircle className="w-3 h-3 mr-1" />
                                  ปฏิเสธ
                                </Button>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">
                                {payment.notes && <span className="block text-[11px] text-gray-400 mt-0.5">หมายเหตุ: {payment.notes}</span>}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={!!changePlanDialog} onOpenChange={() => setChangePlanDialog(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>เปลี่ยนแพ็คเกจ — {changePlanDialog?.tenant?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">เลือกแพ็คเกจใหม่</label>
              <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                <SelectTrigger data-testid="select-new-plan">
                  <SelectValue placeholder="เลือกแพ็คเกจ" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name} — {formatPrice(p.monthlyPrice)}/เดือน
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">รอบบิล</label>
              <Select value={selectedBillingCycle} onValueChange={setSelectedBillingCycle}>
                <SelectTrigger data-testid="select-billing-cycle">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">รายเดือน (หมดอายุใน 1 เดือน)</SelectItem>
                  <SelectItem value="yearly">รายปี (หมดอายุใน 1 ปี)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {selectedPlanId && plans.find((p) => p.id === Number(selectedPlanId)) && (
              <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                <p className="font-semibold text-gray-700">รายละเอียดแพ็คเกจ:</p>
                {(() => {
                  const p = plans.find((p) => p.id === Number(selectedPlanId))!;
                  return (
                    <>
                      <div className="flex justify-between"><span className="text-gray-500">ผู้ใช้สูงสุด</span><span className="font-medium">{p.maxUsers >= 999 ? "ไม่จำกัด" : p.maxUsers}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">เอกสาร/เดือน</span><span className="font-medium">{p.maxDocumentsPerMonth >= 999999 ? "ไม่จำกัด" : p.maxDocumentsPerMonth.toLocaleString()}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">บริษัท</span><span className="font-medium">{p.maxCompanies >= 999 ? "ไม่จำกัด" : p.maxCompanies}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">E-Commerce</span><span className="font-medium">{p.maxEcommerceConnections >= 999 ? "ไม่จำกัด" : p.maxEcommerceConnections}</span></div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangePlanDialog(null)} data-testid="button-cancel-plan-change">ยกเลิก</Button>
            <Button
              className="bg-[#03c9d7] hover:bg-[#02b5c2]"
              onClick={() => {
                if (changePlanDialog && selectedPlanId) {
                  changePlan.mutate({ subId: changePlanDialog.id, planId: Number(selectedPlanId), billingCycle: selectedBillingCycle });
                }
              }}
              disabled={changePlan.isPending || !selectedPlanId}
              data-testid="button-confirm-plan-change"
            >
              {changePlan.isPending ? "กำลังบันทึก..." : "ยืนยันเปลี่ยนแพ็คเกจ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!editPlan} onOpenChange={() => setEditPlan(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-[#fb9678]" />
              แก้ไขแพ็คเกจ: {editPlan?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-700">ชื่อแพ็คเกจ (ไทย)</Label>
                <Input
                  value={editForm.name || ""}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="mt-1"
                  data-testid="input-edit-plan-name"
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700">ชื่อแพ็คเกจ (EN)</Label>
                <Input
                  value={editForm.nameEn || ""}
                  onChange={(e) => setEditForm({ ...editForm, nameEn: e.target.value })}
                  className="mt-1"
                  data-testid="input-edit-plan-name-en"
                />
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-700">คำอธิบาย</Label>
              <Input
                value={editForm.description || ""}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                className="mt-1"
                data-testid="input-edit-plan-desc"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-700">กลุ่มเป้าหมาย</Label>
                <Select
                  value={editForm.targetGroup || "general"}
                  onValueChange={(v) => setEditForm({ ...editForm, targetGroup: v })}
                >
                  <SelectTrigger className="mt-1" data-testid="select-edit-target-group">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">ธุรกิจทั่วไป</SelectItem>
                    <SelectItem value="ecommerce">ร้านค้าออนไลน์</SelectItem>
                    <SelectItem value="firm">สำนักงานบัญชี</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700">ค่าติดตั้ง (บาท)</Label>
                <Input
                  type="number"
                  value={editForm.setupFee || ""}
                  onChange={(e) => setEditForm({ ...editForm, setupFee: e.target.value })}
                  className="mt-1"
                  placeholder="0"
                  data-testid="input-edit-setup-fee"
                />
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium text-gray-700">ฟีเจอร์เด่น (คั่นด้วยเครื่องหมาย ,)</Label>
              <Input
                value={editForm.featuresText || ""}
                onChange={(e) => setEditForm({ ...editForm, featuresText: e.target.value })}
                className="mt-1"
                placeholder="เช่น ออกใบกำกับภาษี, รายงานอัตโนมัติ, AI วิเคราะห์"
                data-testid="input-edit-features"
              />
              <p className="text-[10px] text-gray-400 mt-0.5">ใส่ฟีเจอร์คั่นด้วยเครื่องหมายจุลภาค (,)</p>
            </div>

            <div className="border-t pt-4">
              <h3 className="text-sm font-bold text-gray-700 mb-3">ราคา</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-gray-600">ราคารายเดือน (บาท)</Label>
                  <Input
                    type="number"
                    value={editForm.monthlyPrice || ""}
                    onChange={(e) => setEditForm({ ...editForm, monthlyPrice: e.target.value })}
                    className="mt-1"
                    data-testid="input-edit-monthly-price"
                  />
                </div>
                <div>
                  <Label className="text-sm text-gray-600">ราคารายปี (บาท)</Label>
                  <Input
                    type="number"
                    value={editForm.yearlyPrice || ""}
                    onChange={(e) => setEditForm({ ...editForm, yearlyPrice: e.target.value })}
                    className="mt-1"
                    data-testid="input-edit-yearly-price"
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="text-sm font-bold text-gray-700 mb-3">ข้อจำกัดการใช้งาน</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {[
                  { key: "maxUsers", label: "ผู้ใช้สูงสุด" },
                  { key: "maxCompanies", label: "บริษัทสูงสุด" },
                  { key: "maxDocumentsPerMonth", label: "เอกสาร/เดือน" },
                  { key: "maxProducts", label: "สินค้าสูงสุด" },
                  { key: "maxEcommerceConnections", label: "ร้านค้า E-Commerce" },
                  { key: "maxBranches", label: "สาขาสูงสุด" },
                ].map((field) => (
                  <div key={field.key}>
                    <Label className="text-sm text-gray-600">{field.label}</Label>
                    <Input
                      type="number"
                      value={(editForm as any)[field.key] ?? ""}
                      onChange={(e) => setEditForm({ ...editForm, [field.key]: Number(e.target.value) })}
                      className="mt-1"
                      data-testid={`input-edit-${field.key}`}
                    />
                    <p className="text-[10px] text-gray-400 mt-0.5">ใส่ 999+ = ไม่จำกัด</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="text-sm font-bold text-gray-700 mb-3">ฟีเจอร์เปิด/ปิด</h3>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { key: "hasAiFeatures", label: "AI อัจฉริยะ", desc: "ตรวจสอบสลิป, AI วิเคราะห์" },
                  { key: "hasHrModule", label: "HR & เงินเดือน", desc: "พนักงาน, เงินเดือน, ภาษี" },
                  { key: "hasPosModule", label: "POS ขายหน้าร้าน", desc: "ระบบขายหน้าร้าน, บาร์โค้ด" },
                  { key: "hasFirmModule", label: "Firm Module", desc: "ระบบจัดการสำนักงานบัญชี" },
                  { key: "hasDeliveryModule", label: "Delivery Module", desc: "ระบบจัดส่งสินค้า" },
                  { key: "hasApiAccess", label: "Open API", desc: "เชื่อมต่อระบบภายนอก" },
                  { key: "hasWhiteLabel", label: "White Label", desc: "ใช้แบรนด์ของคุณเอง, โลโก้, สี" },
                ].map((feat) => (
                  <div key={feat.key} className="flex items-center justify-between bg-gray-50 rounded-xl p-3">
                    <div>
                      <p className="text-sm font-medium text-gray-700">{feat.label}</p>
                      <p className="text-[11px] text-gray-400">{feat.desc}</p>
                    </div>
                    <Switch
                      checked={(editForm as any)[feat.key] ?? false}
                      onCheckedChange={(v) => setEditForm({ ...editForm, [feat.key]: v })}
                      data-testid={`switch-edit-${feat.key}`}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="text-sm font-bold text-gray-700 mb-3">เมนูที่เปิดให้ใช้งาน</h3>
              <p className="text-[11px] text-gray-400 mb-3">เลือกเมนูที่ลูกค้าแพ็คเกจนี้สามารถเข้าถึงได้ (ว่าง = เปิดทั้งหมด)</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {ALL_MODULES.map((mod) => {
                  const enabled = (editForm as any).enabledModules || [];
                  const isOn = enabled.includes(mod.key);
                  return (
                    <div
                      key={mod.key}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                        isOn ? "bg-orange-50 border-[#fb9678]" : "bg-gray-50 border-gray-200 hover:bg-gray-100"
                      }`}
                      onClick={() => {
                        const current = [...(enabled as string[])];
                        if (isOn) {
                          setEditForm({ ...editForm, enabledModules: current.filter(k => k !== mod.key) });
                        } else {
                          setEditForm({ ...editForm, enabledModules: [...current, mod.key] });
                        }
                      }}
                      data-testid={`module-toggle-${mod.key}`}
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center ${isOn ? "bg-[#fb9678] border-[#fb9678] text-white" : "border-gray-300"}`}>
                        {isOn && <CheckCircle2 className="w-3 h-3" />}
                      </div>
                      <span className={`text-xs font-medium ${isOn ? "text-[#fb9678]" : "text-gray-600"}`}>{mod.label}</span>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  className="text-[11px] text-blue-600 hover:underline"
                  onClick={() => setEditForm({ ...editForm, enabledModules: ALL_MODULES.map(m => m.key) })}
                >
                  เลือกทั้งหมด
                </button>
                <button
                  type="button"
                  className="text-[11px] text-gray-500 hover:underline"
                  onClick={() => setEditForm({ ...editForm, enabledModules: [] })}
                >
                  ล้างทั้งหมด
                </button>
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="text-sm font-bold text-gray-700 mb-3">ตั้งค่าหน้าแลนดิ้งเพจ</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3">
                  <div>
                    <p className="text-sm font-medium text-gray-700">แพ็คเกจยอดนิยม</p>
                    <p className="text-[11px] text-gray-400">แสดง badge "POPULAR" ในหน้าแลนดิ้งเพจ</p>
                  </div>
                  <Switch
                    checked={(editForm as any).popular ?? false}
                    onCheckedChange={(v) => setEditForm({ ...editForm, popular: v })}
                    data-testid="switch-edit-popular"
                  />
                </div>
                <div>
                  <Label className="text-sm text-gray-600">ลิงก์ปุ่ม CTA</Label>
                  <Input
                    value={(editForm as any).landingLink || ""}
                    onChange={(e) => setEditForm({ ...editForm, landingLink: e.target.value })}
                    className="mt-1"
                    placeholder="/register?plan=starter"
                    data-testid="input-edit-landing-link"
                  />
                </div>
              </div>
              <div className="mt-3">
                <Label className="text-sm text-gray-600">ข้อความปุ่ม CTA</Label>
                <Input
                  value={(editForm as any).landingCta || ""}
                  onChange={(e) => setEditForm({ ...editForm, landingCta: e.target.value })}
                  className="mt-1"
                  placeholder="เริ่มต้นใช้งาน"
                  data-testid="input-edit-landing-cta"
                />
              </div>
              <div className="mt-3">
                <Label className="text-sm text-gray-600">รายการฟีเจอร์ในหน้าแลนดิ้งเพจ (บรรทัดละ 1 รายการ)</Label>
                <Textarea
                  value={(editForm as any).landingFeaturesText || ""}
                  onChange={(e) => setEditForm({ ...editForm, landingFeaturesText: e.target.value })}
                  className="mt-1 text-sm"
                  rows={5}
                  placeholder={"ออกใบกำกับภาษี\nรายงานอัตโนมัติ\nAI วิเคราะห์ยอดขาย"}
                  data-testid="input-edit-landing-features"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPlan(null)} data-testid="btn-cancel-edit-plan">ยกเลิก</Button>
            <Button
              className="bg-[#fb9678] hover:bg-[#f88565]"
              onClick={() => {
                if (editPlan) {
                  const { id, code, featuresText, landingFeaturesText, ...rest } = editForm as any;
                  const features = featuresText
                    ? featuresText.split(",").map((f: string) => f.trim()).filter((f: string) => f.length > 0)
                    : null;
                  const landingFeatures = landingFeaturesText
                    ? landingFeaturesText.split("\n").map((f: string) => f.trim()).filter((f: string) => f.length > 0)
                    : null;
                  const enabledModules = rest.enabledModules && rest.enabledModules.length > 0 ? rest.enabledModules : null;
                  updatePlan.mutate({ id: editPlan.id, data: { ...rest, features, landingFeatures, enabledModules } });
                }
              }}
              disabled={updatePlan.isPending}
              data-testid="btn-save-edit-plan"
            >
              {updatePlan.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              บันทึกแพ็คเกจ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!manageDialog} onOpenChange={() => setManageDialog(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {manageDialog?.action === "activate" && <><PlayCircle className="w-5 h-5 text-green-600" />เปิดใช้งาน</>}
              {manageDialog?.action === "extend" && <><CalendarPlus className="w-5 h-5 text-blue-600" />ต่ออายุ</>}
              {manageDialog?.action === "set-end-date" && <><Clock className="w-5 h-5 text-amber-600" />กำหนดวันหมดอายุ</>}
              {manageDialog?.action === "suspend" && <><PauseCircle className="w-5 h-5 text-red-600" />ระงับการใช้งาน</>}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-gray-600">
              ลูกค้า: <strong>{manageDialog?.sub?.tenant?.name || `Tenant #${manageDialog?.sub?.tenantId}`}</strong>
            </p>
            {manageDialog?.action === "activate" && (
              <div className="space-y-3">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-sm text-green-800">เปลี่ยนสถานะเป็น <strong>Active</strong> พร้อมคำนวณวันหมดอายุอัตโนมัติตามรอบบิล</p>
                  <p className="text-xs text-green-600 mt-1">
                    รอบบิล: <strong>{manageDialog.sub.billingCycle === "yearly" ? "รายปี (+1 ปี)" : "รายเดือน (+1 เดือน)"}</strong>
                  </p>
                </div>
              </div>
            )}
            {manageDialog?.action === "extend" && (
              <div className="space-y-3">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">ต่ออายุโดยเพิ่มจำนวนวันจากวันหมดอายุปัจจุบัน (หรือจากวันนี้ถ้าหมดอายุแล้ว)</p>
                  {(() => {
                    const effectiveEnd = manageDialog.sub.endDate || manageDialog.sub.trialEndsAt;
                    if (effectiveEnd) {
                      return <p className="text-xs text-blue-600 mt-1">หมดอายุปัจจุบัน: {new Date(effectiveEnd).toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" })}</p>;
                    }
                    return null;
                  })()}
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">จำนวนวันที่ต่อ</Label>
                  <Input
                    type="number"
                    value={extendDays}
                    onChange={(e) => setExtendDays(e.target.value)}
                    min="1"
                    max="365"
                    className="mt-1 w-32"
                    data-testid="input-extend-days"
                  />
                </div>
              </div>
            )}
            {manageDialog?.action === "set-end-date" && (
              <div className="space-y-3">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-sm text-amber-800">กำหนดวันหมดอายุโดยตรง — เมื่อถึงวันที่กำหนด ระบบจะตัดการใช้งานอัตโนมัติ</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">วันหมดอายุ</Label>
                  <ThaiDateInput
                    value={endDateInput}
                    onChange={setEndDateInput}
                    dateEra={dateEra} dateFmt={dateFmt}
                    className="mt-1 w-52"
                    data-testid="input-end-date"
                  />
                  {endDateInput && (
                    <p className="text-xs text-gray-500 mt-1">
                      = {new Date(endDateInput).toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}
                    </p>
                  )}
                </div>
              </div>
            )}
            {manageDialog?.action === "suspend" && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800">ระงับการใช้งาน — ลูกค้าจะไม่สามารถเข้าสู่ระบบได้จนกว่าจะเปิดใช้งานอีกครั้ง</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManageDialog(null)} data-testid="btn-manage-cancel">ยกเลิก</Button>
            <Button
              className={manageDialog?.action === "suspend" ? "bg-red-500 hover:bg-red-600" : manageDialog?.action === "activate" ? "bg-green-600 hover:bg-green-700" : manageDialog?.action === "set-end-date" ? "bg-amber-500 hover:bg-amber-600" : "bg-blue-600 hover:bg-blue-700"}
              onClick={handleManageConfirm}
              disabled={manageSub.isPending || (manageDialog?.action === "set-end-date" && !endDateInput)}
              data-testid="btn-manage-confirm"
            >
              {manageSub.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {manageDialog?.action === "activate" ? "ยืนยันเปิดใช้งาน" : manageDialog?.action === "extend" ? "ยืนยันต่ออายุ" : manageDialog?.action === "set-end-date" ? "ยืนยันกำหนดวันหมดอายุ" : "ยืนยันระงับ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!slipPreview} onOpenChange={() => setSlipPreview(null)}>
        <DialogContent className="max-w-lg p-2">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Image className="w-5 h-5 text-[#03c9d7]" />
                สลิปการชำระเงิน
              </span>
            </DialogTitle>
          </DialogHeader>
          {slipPreview && (
            <div className="flex items-center justify-center p-2">
              <img src={slipPreview} alt="สลิปการชำระเงิน" className="max-w-full max-h-[70vh] object-contain rounded-lg" data-testid="img-slip-preview" />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejectDialog} onOpenChange={() => setRejectDialog(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-[#f94d4d]" />
              ปฏิเสธการชำระเงิน
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-gray-600">
              ลูกค้า: <strong>{rejectDialog?.tenant?.name || `Tenant #${rejectDialog?.tenantId}`}</strong>
            </p>
            <p className="text-sm text-gray-600">
              จำนวนเงิน: <strong>{rejectDialog ? formatPrice(rejectDialog.amount) : "-"}</strong>
            </p>
            <div>
              <Label className="text-sm font-medium text-gray-700">หมายเหตุ (เหตุผลที่ปฏิเสธ)</Label>
              <Textarea
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
                className="mt-1"
                placeholder="ระบุเหตุผลที่ปฏิเสธ..."
                rows={3}
                data-testid="input-reject-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog(null)} data-testid="btn-cancel-reject">ยกเลิก</Button>
            <Button
              className="bg-[#f94d4d] hover:bg-[#e63c3c] text-white"
              onClick={() => {
                if (rejectDialog) {
                  rejectPayment.mutate({ paymentId: rejectDialog.id, notes: rejectNotes });
                }
              }}
              disabled={rejectPayment.isPending}
              data-testid="btn-confirm-reject"
            >
              {rejectPayment.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
              ยืนยันปฏิเสธ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!editAddon} onOpenChange={() => setEditAddon(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-[#03c9d7]" />
              {editAddon?.id === 0 ? "สร้าง Add-on ใหม่" : "แก้ไข Add-on"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-gray-600">รหัส (code)</Label>
                <Input
                  value={addonForm.code || ""}
                  onChange={(e) => setAddonForm({ ...addonForm, code: e.target.value })}
                  className="mt-1"
                  placeholder="extra-users"
                  disabled={editAddon?.id !== 0}
                  data-testid="input-addon-code"
                />
              </div>
              <div>
                <Label className="text-sm text-gray-600">Feature Flag</Label>
                <Input
                  value={addonForm.featureFlag || ""}
                  onChange={(e) => setAddonForm({ ...addonForm, featureFlag: e.target.value })}
                  className="mt-1"
                  placeholder="extra_users"
                  data-testid="input-addon-flag"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-gray-600">ชื่อ (ไทย)</Label>
                <Input
                  value={addonForm.name || ""}
                  onChange={(e) => setAddonForm({ ...addonForm, name: e.target.value })}
                  className="mt-1"
                  placeholder="เพิ่มผู้ใช้งาน 5 คน"
                  data-testid="input-addon-name"
                />
              </div>
              <div>
                <Label className="text-sm text-gray-600">ชื่อ (EN)</Label>
                <Input
                  value={addonForm.nameEn || ""}
                  onChange={(e) => setAddonForm({ ...addonForm, nameEn: e.target.value })}
                  className="mt-1"
                  placeholder="Extra 5 Users"
                  data-testid="input-addon-name-en"
                />
              </div>
            </div>
            <div>
              <Label className="text-sm text-gray-600">คำอธิบาย</Label>
              <Input
                value={addonForm.description || ""}
                onChange={(e) => setAddonForm({ ...addonForm, description: e.target.value })}
                className="mt-1"
                placeholder="เพิ่มจำนวนผู้ใช้งานในระบบ"
                data-testid="input-addon-desc"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-gray-600">ราคา/เดือน (฿)</Label>
                <Input
                  type="number"
                  value={addonForm.monthlyPrice || ""}
                  onChange={(e) => setAddonForm({ ...addonForm, monthlyPrice: e.target.value })}
                  className="mt-1"
                  placeholder="290"
                  data-testid="input-addon-monthly"
                />
              </div>
              <div>
                <Label className="text-sm text-gray-600">ราคา/ปี (฿)</Label>
                <Input
                  type="number"
                  value={addonForm.yearlyPrice || ""}
                  onChange={(e) => setAddonForm({ ...addonForm, yearlyPrice: e.target.value })}
                  className="mt-1"
                  placeholder="2900"
                  data-testid="input-addon-yearly"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-gray-600">ลำดับการแสดง</Label>
                <Input
                  type="number"
                  value={addonForm.sortOrder ?? 0}
                  onChange={(e) => setAddonForm({ ...addonForm, sortOrder: parseInt(e.target.value) || 0 })}
                  className="mt-1"
                  data-testid="input-addon-sort"
                />
              </div>
              <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3 mt-6">
                <div>
                  <p className="text-sm font-medium text-gray-700">เปิดใช้งาน</p>
                </div>
                <Switch
                  checked={addonForm.active ?? true}
                  onCheckedChange={(v) => setAddonForm({ ...addonForm, active: v })}
                  data-testid="switch-addon-active"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditAddon(null)} data-testid="btn-cancel-addon">ยกเลิก</Button>
            <Button
              className="bg-[#03c9d7] hover:bg-[#02b3c0] text-white"
              onClick={() => {
                if (!editAddon) return;
                const payload = {
                  code: addonForm.code,
                  name: addonForm.name,
                  nameEn: addonForm.nameEn || null,
                  description: addonForm.description || null,
                  monthlyPrice: addonForm.monthlyPrice || "0",
                  yearlyPrice: addonForm.yearlyPrice || null,
                  featureFlag: addonForm.featureFlag || "",
                  active: addonForm.active ?? true,
                  sortOrder: addonForm.sortOrder ?? 0,
                };
                if (editAddon.id === 0) {
                  createAddon.mutate(payload);
                } else {
                  updateAddon.mutate({ id: editAddon.id, data: payload });
                }
              }}
              disabled={createAddon.isPending || updateAddon.isPending}
              data-testid="btn-save-addon"
            >
              {(createAddon.isPending || updateAddon.isPending) ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              {editAddon?.id === 0 ? "สร้าง Add-on" : "บันทึก Add-on"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PlatformLayout>
  );
}
