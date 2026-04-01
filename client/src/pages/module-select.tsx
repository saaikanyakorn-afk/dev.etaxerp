import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import {
  Building2, Calculator, ShoppingCart, Monitor, Users,
  ChevronRight, LayoutGrid, Fuel, BarChart3, Truck
} from "lucide-react";

interface ModuleCard {
  key: string;
  label: string;
  labelEn: string;
  icon: any;
  color: string;
  bgColor: string;
  href: string;
  description: string;
  features: string[];
  requiredModule: string;
}

const MODULE_CARDS: ModuleCard[] = [
  {
    key: "firm",
    label: "สำนักงานบัญชี",
    labelEn: "Accounting Office",
    icon: Building2,
    color: "#05b187",
    bgColor: "bg-green-50",
    href: "/firm-mgmt/dashboard",
    description: "บริหารสำนักงานบัญชี จัดการบริษัทลูกค้า ทีมนักบัญชี และกำหนดการงาน",
    features: ["จัดการบริษัทลูกค้า", "มอบหมายนักบัญชี", "ติดตามกำหนดการ", "ภาพรวมสำนักงาน"],
    requiredModule: "firm-mgmt",
  },
  {
    key: "accounting",
    label: "ระบบบัญชี",
    labelEn: "Accounting System",
    icon: Calculator,
    color: "#539BFF",
    bgColor: "bg-blue-50",
    href: "/dashboard/analytical",
    description: "บันทึกบัญชีคู่ ออกใบกำกับภาษี ผังบัญชี และรายงานการเงินตามมาตรฐานไทย",
    features: ["สมุดรายวัน", "ใบกำกับภาษี", "งบการเงิน", "รายงาน VAT ภ.พ.30"],
    requiredModule: "accounting",
  },
  {
    key: "ecommerce",
    label: "อีคอมเมิร์ซ",
    labelEn: "E-Commerce",
    icon: ShoppingCart,
    color: "#fb9678",
    bgColor: "bg-orange-50",
    href: "/ecommerce/dashboard",
    description: "นำเข้าออเดอร์ Shopee / Lazada / TikTok ตรวจสอบ SKU และออกใบกำกับภาษีอัตโนมัติ",
    features: ["นำเข้าออเดอร์", "ออกบิลหน้าร้าน", "จัดการคลังสินค้า", "กระทบยอด Settlement"],
    requiredModule: "ecommerce",
  },
  {
    key: "pos",
    label: "ระบบขายหน้าร้าน",
    labelEn: "Point of Sale",
    icon: Monitor,
    color: "#03c9d7",
    bgColor: "bg-cyan-50",
    href: "/pos-hub/dashboard",
    description: "บริหารการขายหน้าร้าน รายการขาย สต็อกสินค้า แคชเชียร์ และรายงานยอดขายรายวัน",
    features: ["ขายหน้าร้าน / Barcode", "ออกใบกำกับภาษี", "จัดการสต็อก", "รายงานยอดขาย"],
    requiredModule: "pos",
  },
  {
    key: "hr",
    label: "ทรัพยากรบุคคล",
    labelEn: "Human Resources",
    icon: Users,
    color: "#7c3aed",
    bgColor: "bg-violet-50",
    href: "/hr/employees",
    description: "บริหารพนักงาน บันทึกเวลาทำงาน คำนวณเงินเดือน จัดการวันลา และประกันสังคม",
    features: ["ข้อมูลพนักงาน", "ลงเวลา / OT", "คำนวณเงินเดือน", "ภงด.1 / 50 ทวิ"],
    requiredModule: "hr",
  },
  {
    key: "gas-station",
    label: "ปั๊มน้ำมัน",
    labelEn: "Gas Station",
    icon: Fuel,
    color: "#f59e0b",
    bgColor: "bg-amber-50",
    href: "/gas-station/daily-sales",
    description: "บริหารยอดขายปั๊มน้ำมัน จัดการหัวจ่าย มิเตอร์ และรายงานรายวัน",
    features: ["ยอดขายรายวัน", "จัดการหัวจ่าย", "ตั้งค่ามิเตอร์", "รายงาน"],
    requiredModule: "gas-station",
  },
  {
    key: "ci",
    label: "Commerce Intelligence",
    labelEn: "Analytics & Insights",
    icon: BarChart3,
    color: "#6366f1",
    bgColor: "bg-indigo-50",
    href: "/ci/executive",
    description: "วิเคราะห์ข้อมูลการขายข้ามแพลตฟอร์ม KPI ย้อนหลัง และ AI Forecasting",
    features: ["Executive Dashboard", "Cross-platform Analytics", "AI Demand Forecast", "Profit Analysis"],
    requiredModule: "ci",
  },
  {
    key: "delivery",
    label: "ระบบจัดส่ง",
    labelEn: "Delivery Hub",
    icon: Truck,
    color: "#10b981",
    bgColor: "bg-emerald-50",
    href: "/ecommerce/delivery",
    description: "จัดการพัสดุ พิมพ์ใบปะหน้า ติดตามสถานะ และแจ้งเตือนทาง LINE",
    features: ["Pick-Pack-Ship", "พิมพ์ใบปะหน้า", "ติดตามพัสดุ", "LINE แจ้งเตือน"],
    requiredModule: "delivery",
  },
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

  const availableCards = MODULE_CARDS.filter(card => {
    if (card.key === "firm" && tenantType !== "accounting_firm") return false;
    return modules.includes(card.requiredModule);
  });

  useEffect(() => {
    if (authLoading || permLoading) return;
    if (!user) { setLocation("/login"); return; }
    if ((user as any).role === "employee") { setLocation("/ess"); return; }
    if ((user as any).role === "client_external") { setLocation("/etax-hub/board"); return; }
    if ((user as any).role === "super_admin") { setLocation("/platform"); return; }
    if (availableCards.length === 1) {
      setLocation(availableCards[0].href);
      return;
    }
  }, [authLoading, permLoading, user, availableCards.length]);

  if (authLoading || permLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#fb9678]" />
      </div>
    );
  }

  if (availableCards.length <= 1) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-2 mb-3">
            <LayoutGrid className="w-8 h-8 text-[#fb9678]" />
            <h1 className="text-3xl font-bold text-gray-800">เลือกโมดูล</h1>
          </div>
          <p className="text-gray-500">
            เลือกระบบที่ต้องการใช้งาน · คุณมีสิทธิ์เข้าถึง {availableCards.length} โมดูล
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {availableCards.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.key}
                data-testid={`module-card-${card.key}`}
                onClick={() => setLocation(card.href)}
                className="bg-white rounded-xl border border-gray-200 p-6 text-left hover:shadow-lg hover:border-gray-300 transition-all duration-200 group relative"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-12 h-12 ${card.bgColor} rounded-xl flex items-center justify-center`}>
                    <Icon className="w-6 h-6" style={{ color: card.color }} />
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-gray-500 transition-colors mt-1" />
                </div>

                <h3 className="text-lg font-bold text-gray-800 mb-0.5">{card.label}</h3>
                <p className="text-xs text-gray-400 mb-3">{card.labelEn}</p>
                <p className="text-sm text-gray-500 mb-4 leading-relaxed">{card.description}</p>

                <ul className="space-y-1.5">
                  {card.features.map((f, i) => (
                    <li key={i} className="text-sm text-gray-600 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: card.color }} />
                      {f}
                    </li>
                  ))}
                </ul>

                <div className="mt-5 pt-4 border-t border-gray-100">
                  <span className="text-sm font-medium group-hover:underline" style={{ color: card.color }}>
                    เข้าใช้งาน →
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
