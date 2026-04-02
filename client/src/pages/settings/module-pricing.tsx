import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Layout from "@/components/layout";
import SettingsTabs from "@/components/settings-tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import {
  Calculator, Users, ShoppingCart, Store, UtensilsCrossed, Building2, Warehouse,
  Check, Crown, Zap, ArrowUpRight, Clock, Calendar, RefreshCw, Shield,
  Package, ChevronRight, Sparkles, AlertTriangle
} from "lucide-react";

const MODULE_META: Record<string, { label: string; icon: any; color: string; bgColor: string }> = {
  accounting:  { label: "บัญชี",           icon: Calculator,        color: "#fb9678", bgColor: "bg-[#fb9678]/10" },
  hr:          { label: "HR & เงินเดือน",  icon: Users,             color: "#05b187", bgColor: "bg-[#05b187]/10" },
  ecommerce:   { label: "E-Commerce",      icon: ShoppingCart,      color: "#03c9d7", bgColor: "bg-[#03c9d7]/10" },
  pos:         { label: "POS ค้าปลีก",     icon: Store,             color: "#539BFF", bgColor: "bg-[#539BFF]/10" },
  restaurant:  { label: "POS ร้านอาหาร",   icon: UtensilsCrossed,   color: "#fec90f", bgColor: "bg-[#fec90f]/10" },
  "firm-mgmt": { label: "สนง.บัญชี",      icon: Building2,         color: "#7c3aed", bgColor: "bg-[#7c3aed]/10" },
  warehouse:   { label: "คลังสินค้า",      icon: Warehouse,         color: "#f97316", bgColor: "bg-[#f97316]/10" },
};

const TIER_BADGE: Record<string, { label: string; color: string }> = {
  free:    { label: "Free",         color: "bg-gray-100 text-gray-600" },
  starter: { label: "Starter",     color: "bg-blue-100 text-blue-700" },
  pro:     { label: "Professional", color: "bg-purple-100 text-purple-700" },
};

const STATUS_BADGE: Record<string, { label: string; color: string; icon: any }> = {
  active:    { label: "ใช้งาน",     color: "bg-green-100 text-green-700",  icon: Check },
  trial:     { label: "ทดลองใช้",   color: "bg-amber-100 text-amber-700",  icon: Clock },
  expired:   { label: "หมดอายุ",    color: "bg-red-100 text-red-700",      icon: AlertTriangle },
  cancelled: { label: "ยกเลิก",     color: "bg-gray-100 text-gray-500",    icon: AlertTriangle },
};

interface ModulePlan {
  id: number;
  moduleKey: string;
  tier: string;
  name: string;
  nameEn: string | null;
  description: string | null;
  monthlyPrice: string;
  yearlyPrice: string | null;
  maxUsers: number;
  maxDocuments: number;
  maxCompanies: number;
  features: string[] | null;
  popular: boolean;
}

interface ModuleSub {
  id: number;
  moduleKey: string;
  modulePlanId: number;
  tier: string;
  status: string;
  billingCycle: string;
  startDate: string;
  endDate: string | null;
  trialEndsAt: string | null;
  autoRenew: boolean;
  planName: string;
  monthlyPrice: string;
  yearlyPrice: string | null;
  maxUsers: number;
  maxDocuments: number;
  features: string[] | null;
  daysRemaining: number | null;
  isExpiring: boolean;
}

function formatPrice(price: string | number) {
  const num = typeof price === "string" ? parseFloat(price) : price;
  if (num === 0) return "ฟรี";
  return `฿${num.toLocaleString()}`;
}

export default function ModulePricing() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [activeTab, setActiveTab] = useState("my-modules");

  const { data, isLoading } = useQuery<{ subscriptions: ModuleSub[]; plans: ModulePlan[] }>({
    queryKey: ["/api/my-modules"],
    queryFn: async () => {
      const r = await fetch("/api/my-modules", { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch modules");
      return r.json();
    },
  });

  const subscribeMutation = useMutation({
    mutationFn: (body: { modulePlanId: number; billingCycle: string }) =>
      apiRequest("POST", "/api/my-modules/subscribe", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-modules"] });
      toast({ title: "สมัครโมดูลเรียบร้อย" });
    },
    onError: (err: any) => toast({ title: "ผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const subscriptions = data?.subscriptions || [];
  const plans = data?.plans || [];
  const subMap = new Map(subscriptions.map(s => [s.moduleKey, s]));

  const moduleKeys = [...new Set(plans.map(p => p.moduleKey))];
  const plansByModule = new Map<string, ModulePlan[]>();
  plans.forEach(p => {
    if (!plansByModule.has(p.moduleKey)) plansByModule.set(p.moduleKey, []);
    plansByModule.get(p.moduleKey)!.push(p);
  });

  const totalMonthly = subscriptions.reduce((sum, s) => {
    if (s.status === "active" || s.status === "trial") {
      return sum + (s.billingCycle === "yearly" ? parseFloat(s.yearlyPrice || "0") / 12 : parseFloat(s.monthlyPrice || "0"));
    }
    return sum;
  }, 0);

  const isAdmin = user && ["admin", "manager", "super_admin"].includes(user.role);

  return (
    <Layout>
      <SettingsTabs />
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
              <Package className="h-6 w-6" style={{ color: "#fb9678" }} />
              แพ็คเกจโมดูล
            </h1>
            <p className="text-sm text-muted-foreground">เลือกซื้อเฉพาะโมดูลที่ต้องการ จ่ายเท่าที่ใช้</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs text-muted-foreground">ค่าใช้จ่ายรวม/เดือน</p>
              <p className="text-xl font-bold" style={{ color: "#fb9678" }} data-testid="text-total-monthly">
                ฿{Math.round(totalMonthly).toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="my-modules" data-testid="tab-my-modules">โมดูลของฉัน</TabsTrigger>
            <TabsTrigger value="all-modules" data-testid="tab-all-modules">แพ็คเกจทั้งหมด</TabsTrigger>
          </TabsList>

          <TabsContent value="my-modules" className="space-y-4">
            {subscriptions.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Package className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                  <p className="text-lg font-medium text-gray-500">ยังไม่ได้สมัครโมดูลใดๆ</p>
                  <p className="text-sm text-muted-foreground mb-4">เลือกแพ็คเกจที่เหมาะกับธุรกิจของคุณได้เลย</p>
                  <Button onClick={() => setActiveTab("all-modules")} className="gap-1" style={{ backgroundColor: "#fb9678" }} data-testid="button-browse-modules">
                    <Sparkles className="h-4 w-4" />
                    ดูแพ็คเกจทั้งหมด
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {subscriptions.map(sub => {
                  const meta = MODULE_META[sub.moduleKey] || { label: sub.moduleKey, icon: Package, color: "#666", bgColor: "bg-gray-100" };
                  const status = STATUS_BADGE[sub.status] || STATUS_BADGE.active;
                  const StatusIcon = status.icon;
                  const ModuleIcon = meta.icon;

                  return (
                    <Card key={sub.id} className="relative overflow-hidden" data-testid={`card-sub-${sub.moduleKey}`}>
                      <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: meta.color }} />
                      <CardContent className="pt-5 pb-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg ${meta.bgColor} flex items-center justify-center`}>
                              <ModuleIcon className="h-5 w-5" style={{ color: meta.color }} />
                            </div>
                            <div>
                              <h3 className="font-semibold text-sm">{meta.label}</h3>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <Badge variant="outline" className={TIER_BADGE[sub.tier]?.color || ""}>
                                  {TIER_BADGE[sub.tier]?.label || sub.tier}
                                </Badge>
                                <Badge variant="outline" className={status.color}>
                                  <StatusIcon className="h-3 w-3 mr-1" />
                                  {status.label}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-sm" style={{ color: meta.color }}>
                              {formatPrice(sub.billingCycle === "yearly" ? (sub.yearlyPrice || sub.monthlyPrice) : sub.monthlyPrice)}
                            </p>
                            <p className="text-xs text-muted-foreground">/{sub.billingCycle === "yearly" ? "ปี" : "เดือน"}</p>
                          </div>
                        </div>

                        {sub.status === "trial" && sub.daysRemaining !== null && (
                          <div className={`rounded-lg p-2.5 mb-3 ${sub.isExpiring ? "bg-red-50" : "bg-amber-50"}`}>
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className={sub.isExpiring ? "text-red-600 font-medium" : "text-amber-600"}>
                                <Clock className="h-3 w-3 inline mr-1" />
                                ทดลองใช้เหลือ {sub.daysRemaining} วัน
                              </span>
                              <span className="text-muted-foreground">{Math.round((15 - sub.daysRemaining) / 15 * 100)}%</span>
                            </div>
                            <Progress value={Math.round((15 - sub.daysRemaining) / 15 * 100)} className="h-1.5" />
                          </div>
                        )}

                        {sub.endDate && sub.status === "active" && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                            <Calendar className="h-3 w-3" />
                            ต่ออายุ: {new Date(sub.endDate).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}
                            {sub.autoRenew && <Badge variant="outline" className="text-[10px] py-0 bg-green-50 text-green-600">ต่ออัตโนมัติ</Badge>}
                          </div>
                        )}

                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Users className="h-3 w-3" />{sub.maxUsers} ผู้ใช้</span>
                          <span>|</span>
                          <span>{sub.maxDocuments >= 9999 ? "ไม่จำกัดเอกสาร" : `${sub.maxDocuments} เอกสาร/เดือน`}</span>
                        </div>

                        {isAdmin && (sub.status === "trial" || sub.status === "expired") && (
                          <Button size="sm" className="w-full mt-3 gap-1" style={{ backgroundColor: meta.color }}
                            onClick={() => setActiveTab("all-modules")}
                            data-testid={`button-upgrade-${sub.moduleKey}`}>
                            <ArrowUpRight className="h-3.5 w-3.5" />
                            {sub.status === "expired" ? "ต่ออายุ" : "อัพเกรดเป็นแพ็คเกจเต็ม"}
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="all-modules" className="space-y-4">
            <div className="flex items-center justify-center gap-2 mb-4">
              <span className={`text-sm font-medium ${billingCycle === "monthly" ? "text-foreground" : "text-muted-foreground"}`}>รายเดือน</span>
              <button
                onClick={() => setBillingCycle(prev => prev === "monthly" ? "yearly" : "monthly")}
                className={`relative w-14 h-7 rounded-full transition-colors ${billingCycle === "yearly" ? "bg-[#05b187]" : "bg-gray-200"}`}
                data-testid="toggle-billing"
              >
                <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${billingCycle === "yearly" ? "translate-x-7" : "translate-x-0.5"}`} />
              </button>
              <span className={`text-sm font-medium ${billingCycle === "yearly" ? "text-foreground" : "text-muted-foreground"}`}>
                รายปี
                <Badge className="ml-1 bg-[#05b187] text-white text-[10px] py-0">ประหยัด 17%</Badge>
              </span>
            </div>

            {moduleKeys.map(mk => {
              const meta = MODULE_META[mk] || { label: mk, icon: Package, color: "#666", bgColor: "bg-gray-100" };
              const ModuleIcon = meta.icon;
              const modulePlans = plansByModule.get(mk) || [];
              const currentSub = subMap.get(mk);

              return (
                <Card key={mk} className="overflow-hidden" data-testid={`module-section-${mk}`}>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <div className={`w-8 h-8 rounded-lg ${meta.bgColor} flex items-center justify-center`}>
                        <ModuleIcon className="h-4 w-4" style={{ color: meta.color }} />
                      </div>
                      {meta.label}
                      {currentSub && (
                        <Badge variant="outline" className={STATUS_BADGE[currentSub.status]?.color || ""}>
                          ใช้งานอยู่: {TIER_BADGE[currentSub.tier]?.label || currentSub.tier}
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={`grid gap-4 ${modulePlans.length === 3 ? "md:grid-cols-3" : modulePlans.length === 2 ? "md:grid-cols-2" : ""}`}>
                      {modulePlans.map(plan => {
                        const price = billingCycle === "yearly" ? (plan.yearlyPrice || plan.monthlyPrice) : plan.monthlyPrice;
                        const isCurrent = currentSub?.modulePlanId === plan.id;
                        const isUpgrade = currentSub && !isCurrent && plan.tier !== "free";

                        return (
                          <div key={plan.id} className={`rounded-xl border p-4 relative transition-shadow hover:shadow-md ${plan.popular ? "border-2" : ""} ${isCurrent ? "ring-2" : ""}`}
                            style={{
                              borderColor: plan.popular ? meta.color : undefined,
                              ...(isCurrent ? { ["--tw-ring-color" as any]: meta.color } : {}),
                            }}
                            data-testid={`plan-card-${plan.id}`}
                          >
                            {plan.popular && (
                              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                <Badge className="text-white text-[10px]" style={{ backgroundColor: meta.color }}>
                                  <Crown className="h-3 w-3 mr-0.5" />
                                  แนะนำ
                                </Badge>
                              </div>
                            )}
                            {isCurrent && (
                              <div className="absolute -top-3 right-3">
                                <Badge className="bg-green-500 text-white text-[10px]">
                                  <Check className="h-3 w-3 mr-0.5" />
                                  ใช้อยู่
                                </Badge>
                              </div>
                            )}

                            <div className="mb-3">
                              <Badge variant="outline" className={TIER_BADGE[plan.tier]?.color || ""}>
                                {TIER_BADGE[plan.tier]?.label || plan.tier}
                              </Badge>
                              <h4 className="font-semibold text-sm mt-2">{plan.name}</h4>
                              {plan.description && <p className="text-xs text-muted-foreground mt-0.5">{plan.description}</p>}
                            </div>

                            <div className="mb-3">
                              <span className="text-2xl font-bold" style={{ color: meta.color }}>
                                {formatPrice(price)}
                              </span>
                              {parseFloat(price) > 0 && (
                                <span className="text-xs text-muted-foreground">/{billingCycle === "yearly" ? "ปี" : "เดือน"}</span>
                              )}
                              {billingCycle === "yearly" && plan.yearlyPrice && parseFloat(plan.monthlyPrice) > 0 && (
                                <p className="text-xs text-muted-foreground">
                                  <span className="line-through">฿{(parseFloat(plan.monthlyPrice) * 12).toLocaleString()}</span>
                                  {" "}ประหยัด ฿{((parseFloat(plan.monthlyPrice) * 12) - parseFloat(plan.yearlyPrice)).toLocaleString()}
                                </p>
                              )}
                            </div>

                            <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                              <span><Users className="h-3 w-3 inline" /> {plan.maxUsers} ผู้ใช้</span>
                              <span>{plan.maxDocuments >= 9999 ? "ไม่จำกัด" : `${plan.maxDocuments}`} เอกสาร</span>
                            </div>

                            <Separator className="mb-3" />

                            <ul className="space-y-1.5 mb-4">
                              {(plan.features || []).map((f, i) => (
                                <li key={i} className="flex items-start gap-1.5 text-xs">
                                  <Check className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" style={{ color: meta.color }} />
                                  {f}
                                </li>
                              ))}
                            </ul>

                            {isAdmin && !isCurrent && (
                              <Button
                                size="sm"
                                className="w-full gap-1"
                                variant={plan.popular ? "default" : "outline"}
                                style={plan.popular ? { backgroundColor: meta.color } : { borderColor: meta.color, color: meta.color }}
                                disabled={subscribeMutation.isPending}
                                onClick={() => subscribeMutation.mutate({ modulePlanId: plan.id, billingCycle })}
                                data-testid={`button-subscribe-${plan.id}`}
                              >
                                {isUpgrade ? (
                                  <><ArrowUpRight className="h-3.5 w-3.5" />อัพเกรด</>
                                ) : parseFloat(plan.monthlyPrice) === 0 ? (
                                  <><Zap className="h-3.5 w-3.5" />เริ่มใช้ฟรี</>
                                ) : (
                                  <><Sparkles className="h-3.5 w-3.5" />ทดลอง 15 วัน</>
                                )}
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
