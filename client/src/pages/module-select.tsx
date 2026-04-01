import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import {
  Building2, Calculator, ShoppingCart, Monitor, Users,
  LayoutGrid, Fuel, BarChart3, Truck, Lock, Sparkles
} from "lucide-react";

interface ModuleCard {
  key: string;
  label: string;
  labelEn: string;
  icon: any;
  color: string;
  bgColor: string;
  href: string;
  requiredModule: string;
  firmOnly?: boolean;
}

const MODULE_CARDS: ModuleCard[] = [
  { key: "firm", label: "สำนักงานบัญชี", labelEn: "Accounting Office", icon: Building2, color: "#05b187", bgColor: "bg-green-50", href: "/firm-mgmt/dashboard", requiredModule: "firm-mgmt", firmOnly: true },
  { key: "accounting", label: "ระบบบัญชี", labelEn: "Accounting", icon: Calculator, color: "#539BFF", bgColor: "bg-blue-50", href: "/dashboard/analytical", requiredModule: "accounting" },
  { key: "ecommerce", label: "อีคอมเมิร์ซ", labelEn: "E-Commerce", icon: ShoppingCart, color: "#fb9678", bgColor: "bg-orange-50", href: "/ecommerce/dashboard", requiredModule: "ecommerce" },
  { key: "pos", label: "ขายหน้าร้าน", labelEn: "POS", icon: Monitor, color: "#03c9d7", bgColor: "bg-cyan-50", href: "/pos-hub/dashboard", requiredModule: "pos" },
  { key: "hr", label: "ทรัพยากรบุคคล", labelEn: "HR", icon: Users, color: "#7c3aed", bgColor: "bg-violet-50", href: "/hr/employees", requiredModule: "hr" },
  { key: "gas-station", label: "ปั๊มน้ำมัน", labelEn: "Gas Station", icon: Fuel, color: "#f59e0b", bgColor: "bg-amber-50", href: "/gas-station/daily-sales", requiredModule: "gas-station" },
  { key: "ci", label: "วิเคราะห์ข้อมูล", labelEn: "Intelligence", icon: BarChart3, color: "#6366f1", bgColor: "bg-indigo-50", href: "/ci/executive", requiredModule: "ci" },
  { key: "delivery", label: "ระบบจัดส่ง", labelEn: "Delivery", icon: Truck, color: "#10b981", bgColor: "bg-emerald-50", href: "/ecommerce/delivery", requiredModule: "delivery" },
];

export default function ModuleSelectPage() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();

  const { data: permData, isLoading: permLoading } = useQuery<{ modules: string[]; subModules: string[] }>({
    queryKey: ["/api/permissions/me"],
    queryFn: async () => {
      const r = await fetch("/api/permissions/me", { credentials: "include" });
      if (!r.ok) return { modules: [], subModules: [] };
      const data = await r.json();
      return Array.isArray(data) ? { modules: data, subModules: [] } : data;
    },
    enabled: !!user,
  });

  const { data: authData } = useQuery<any>({
    queryKey: ["/api/auth/me"],
    enabled: !!user,
  });

  const modules = permData?.modules || [];
  const tenantType = authData?.tenant?.tenantType;

  const visibleCards = MODULE_CARDS.filter(card => {
    if (card.firmOnly && tenantType !== "accounting_firm") return false;
    return true;
  });

  const ownedCards = visibleCards.filter(c => modules.includes(c.requiredModule));
  const lockedCards = visibleCards.filter(c => !modules.includes(c.requiredModule));

  useEffect(() => {
    if (authLoading || permLoading) return;
    if (!user) { setLocation("/login"); return; }
    if ((user as any).role === "employee") { setLocation("/ess"); return; }
    if ((user as any).role === "client_external") { setLocation("/etax-hub/board"); return; }
    if ((user as any).role === "super_admin") { setLocation("/platform"); return; }
    if (ownedCards.length === 1 && lockedCards.length === 0) {
      setLocation(ownedCards[0].href);
      return;
    }
  }, [authLoading, permLoading, user, ownedCards.length, lockedCards.length]);

  if (authLoading || permLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#fb9678]" />
      </div>
    );
  }

  if (ownedCards.length === 1 && lockedCards.length === 0) return null;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-3xl w-full mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <LayoutGrid className="w-7 h-7 text-[#fb9678] mx-auto mb-2" />
          <h1 className="text-2xl font-bold text-gray-800">เลือกโมดูล</h1>
          <p className="text-sm text-gray-400 mt-1">คุณมีสิทธิ์เข้าถึง {ownedCards.length} โมดูล</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {ownedCards.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.key}
                data-testid={`module-card-${card.key}`}
                onClick={() => setLocation(card.href)}
                className="bg-white rounded-xl border border-gray-200 p-4 text-center hover:shadow-lg hover:border-gray-300 hover:-translate-y-0.5 transition-all duration-200 group"
              >
                <div className={`w-11 h-11 ${card.bgColor} rounded-xl flex items-center justify-center mx-auto mb-2.5`}>
                  <Icon className="w-5 h-5" style={{ color: card.color }} />
                </div>
                <p className="text-sm font-semibold text-gray-800 leading-tight">{card.label}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{card.labelEn}</p>
              </button>
            );
          })}

          {lockedCards.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.key}
                data-testid={`module-card-locked-${card.key}`}
                onClick={() => setLocation("/settings/upgrade")}
                className="bg-white rounded-xl border border-dashed border-gray-200 p-4 text-center hover:border-[#fb9678] hover:shadow-md transition-all duration-200 group opacity-60 hover:opacity-100 relative"
              >
                <div className="absolute top-1.5 right-1.5">
                  <Lock className="w-3 h-3 text-gray-300" />
                </div>
                <div className="w-11 h-11 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-2.5">
                  <Icon className="w-5 h-5 text-gray-400" />
                </div>
                <p className="text-sm font-semibold text-gray-400 leading-tight">{card.label}</p>
                <p className="text-[10px] text-[#fb9678] mt-1 font-medium flex items-center justify-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Sparkles className="w-3 h-3" />สมัคร
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
