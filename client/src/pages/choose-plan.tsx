import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useForceLightMode } from "@/hooks/use-force-light";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, Zap, Building2, Rocket, Loader2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Plan {
  id: number;
  code: string;
  name: string;
  nameEn?: string;
  description?: string;
  monthlyPrice: string;
  yearlyPrice?: string;
  maxUsers: number;
  maxDocumentsPerMonth: number;
  maxCompanies: number;
  maxEcommerceConnections: number;
  maxProducts: number;
  hasAiFeatures: boolean;
  hasHrModule: boolean;
  hasPosModule: boolean;
  hasDeliveryModule: boolean;
  hasApiAccess: boolean;
  hasWhiteLabel: boolean;
}

export default function ChoosePlanPage() {
  const { user, refetchUser, logout } = useAuth();
  const { toast } = useToast();
  useForceLightMode();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [selectedPlan, setSelectedPlan] = useState<number | null>(null);

  const { data: plans = [], isLoading } = useQuery<Plan[]>({
    queryKey: ["/api/subscription-plans"],
    queryFn: async () => {
      const res = await fetch("/api/subscription-plans");
      if (!res.ok) throw new Error("Failed to fetch plans");
      return res.json();
    },
  });

  const changePlanMutation = useMutation({
    mutationFn: async (planId: number) => {
      const res = await fetch("/api/my-subscription/change-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, billingCycle }),
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message);
      }
      return res.json();
    },
    onSuccess: async () => {
      toast({ title: "เลือกแพ็คเกจสำเร็จ!", description: "ระบบจะพาคุณเข้าสู่หน้าหลัก" });
      await refetchUser();
      window.location.href = "/";
    },
    onError: (err: any) => {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    },
  });

  const planIcons: Record<string, any> = {
    free: Zap,
    starter: Rocket,
    pro: Crown,
    enterprise: Building2,
  };

  const planColors: Record<string, string> = {
    free: "#05b187",
    starter: "#fb9678",
    pro: "#fb9678",
    enterprise: "#03c9d7",
  };

  const isTrialExpired = user?.subscription?.trialExpired;
  const daysRemaining = user?.subscription?.daysRemaining;

  return (
    <div className="min-h-screen py-12 px-4 force-light-mode" style={{ background: "#fff5f2" }}>
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8">
          {isTrialExpired ? (
            <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-full px-5 py-2 mb-4">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span className="text-sm font-medium text-amber-700">ช่วงทดลองใช้งานหมดอายุแล้ว</span>
            </div>
          ) : daysRemaining != null && daysRemaining > 0 ? (
            <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-full px-5 py-2 mb-4">
              <Zap className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-700">ทดลองใช้ฟรีอีก {daysRemaining} วัน</span>
            </div>
          ) : null}
          <h1 className="text-2xl font-bold mb-2" data-testid="text-choose-plan-title">เลือกแพ็คเกจที่เหมาะกับธุรกิจของคุณ</h1>
          <p className="text-muted-foreground">เปลี่ยนหรืออัพเกรดได้ทุกเมื่อ</p>
        </div>

        <div className="flex justify-center mb-10">
          <div className="flex items-center gap-3 relative">
            <span className={`text-sm font-semibold transition-colors ${billingCycle === "monthly" ? "text-gray-800" : "text-gray-400"}`}>รายเดือน</span>
            <button
              onClick={() => setBillingCycle(billingCycle === "monthly" ? "yearly" : "monthly")}
              className="relative w-14 h-7 rounded-full transition-colors duration-300 focus:outline-none"
              style={{ backgroundColor: billingCycle === "yearly" ? "#fb9678" : "#d1d5db" }}
              data-testid="btn-billing-toggle"
            >
              <span
                className="absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-300"
                style={{ transform: billingCycle === "yearly" ? "translateX(28px)" : "translateX(0)" }}
              />
            </button>
            <span className={`text-sm font-semibold transition-colors ${billingCycle === "yearly" ? "text-gray-800" : "text-gray-400"}`}>รายปี (ประหยัด)</span>

            <div className="absolute -right-44 top-1/2 -translate-y-1/2 flex items-center">
              <svg width="36" height="32" viewBox="0 0 36 32" fill="none" className="mr-0.5 flex-shrink-0">
                <path d="M4 28 C6 10, 18 4, 30 10" stroke="#fec90f" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                <path d="M26 6 L30 10 L25 12" stroke="#fec90f" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-[#e6a800] font-bold text-sm whitespace-nowrap relative">
                ประหยัดกว่า 17%
                <svg className="absolute -bottom-1.5 left-0 w-full" height="6" viewBox="0 0 100 6" preserveAspectRatio="none">
                  <path d="M2 4 Q25 1 50 3.5 Q75 5.5 98 2" stroke="#fec90f" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                </svg>
              </span>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[#fb9678]" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {plans.filter(p => p.code !== "free" || !isTrialExpired).map((plan) => {
              const Icon = planIcons[plan.code] || Zap;
              const color = planColors[plan.code] || "#fb9678";
              const price = billingCycle === "yearly" && plan.yearlyPrice
                ? (Number(plan.yearlyPrice) / 12).toFixed(0)
                : plan.monthlyPrice;
              const isPopular = plan.code === "pro";
              const isSelected = selectedPlan === plan.id;

              return (
                <Card
                  key={plan.id}
                  className={`relative cursor-pointer transition-all hover:shadow-lg ${isSelected ? "ring-2 shadow-lg" : "hover:scale-[1.02]"} ${isPopular ? "border-2" : ""}`}
                  style={{
                    borderColor: isSelected || isPopular ? color : undefined,
                    ringColor: isSelected ? color : undefined,
                  }}
                  onClick={() => setSelectedPlan(plan.id)}
                  data-testid={`card-plan-${plan.code}`}
                >
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="text-white text-xs" style={{ background: color }}>แนะนำ</Badge>
                    </div>
                  )}
                  <CardHeader className="text-center pb-2">
                    <div className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center" style={{ background: `${color}15` }}>
                      <Icon className="w-6 h-6" style={{ color }} />
                    </div>
                    <CardTitle className="text-lg">{plan.name}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">{plan.description}</p>
                  </CardHeader>
                  <CardContent className="text-center">
                    <div className="mb-4">
                      <span className="text-3xl font-bold" style={{ color }}>
                        ฿{Number(price).toLocaleString()}
                      </span>
                      <span className="text-sm text-muted-foreground">/เดือน</span>
                      {billingCycle === "yearly" && plan.yearlyPrice && (
                        <p className="text-xs text-muted-foreground mt-1">
                          ฿{Number(plan.yearlyPrice).toLocaleString()}/ปี
                        </p>
                      )}
                    </div>
                    <div className="space-y-2 text-left text-sm">
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 flex-shrink-0" style={{ color }} />
                        <span>ผู้ใช้งาน {plan.maxUsers >= 999 ? "ไม่จำกัด" : `${plan.maxUsers} คน`}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 flex-shrink-0" style={{ color }} />
                        <span>บริษัท {plan.maxCompanies >= 999 ? "ไม่จำกัด" : `${plan.maxCompanies} บริษัท`}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 flex-shrink-0" style={{ color }} />
                        <span>เอกสาร {plan.maxDocumentsPerMonth >= 999999 ? "ไม่จำกัด" : `${plan.maxDocumentsPerMonth.toLocaleString()}/เดือน`}</span>
                      </div>
                      {plan.maxEcommerceConnections > 0 && (
                        <div className="flex items-center gap-2">
                          <Check className="w-4 h-4 flex-shrink-0" style={{ color }} />
                          <span>E-Commerce {plan.maxEcommerceConnections >= 999 ? "ไม่จำกัด" : `${plan.maxEcommerceConnections} ร้าน`}</span>
                        </div>
                      )}
                      {plan.hasHrModule && (
                        <div className="flex items-center gap-2">
                          <Check className="w-4 h-4 flex-shrink-0" style={{ color }} />
                          <span>HR & เงินเดือน</span>
                        </div>
                      )}
                      {plan.hasPosModule && (
                        <div className="flex items-center gap-2">
                          <Check className="w-4 h-4 flex-shrink-0" style={{ color }} />
                          <span>POS ขายหน้าร้าน</span>
                        </div>
                      )}
                      {plan.hasAiFeatures && (
                        <div className="flex items-center gap-2">
                          <Check className="w-4 h-4 flex-shrink-0" style={{ color }} />
                          <span>AI อัจฉริยะ</span>
                        </div>
                      )}
                      {plan.hasWhiteLabel && (
                        <div className="flex items-center gap-2">
                          <Check className="w-4 h-4 flex-shrink-0" style={{ color }} />
                          <span>White Label</span>
                        </div>
                      )}
                    </div>
                    <Button
                      className="w-full mt-5 text-white"
                      style={{ background: isSelected ? color : undefined }}
                      variant={isSelected ? "default" : "outline"}
                      disabled={changePlanMutation.isPending}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPlan(plan.id);
                        changePlanMutation.mutate(plan.id);
                      }}
                      data-testid={`btn-select-${plan.code}`}
                    >
                      {changePlanMutation.isPending && selectedPlan === plan.id ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : null}
                      {plan.code === "free" ? "ใช้งานฟรี" : "เลือกแพ็คเกจนี้"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {!isTrialExpired && (
          <p className="text-center text-xs text-muted-foreground mt-6">
            คุณสามารถเลือกแพ็คเกจภายหลังได้ที่หน้าตั้งค่า
          </p>
        )}

        <div className="text-center mt-6">
          <button onClick={logout} className="text-xs text-gray-400 hover:text-gray-600 underline" data-testid="btn-logout">ออกจากระบบ</button>
        </div>
      </div>
    </div>
  );
}
