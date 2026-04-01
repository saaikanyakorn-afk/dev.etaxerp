import FoodDeliveryLayout from "@/components/food-delivery-layout";
import { Card, CardContent } from "@/components/ui/card";
import { useCompany } from "@/lib/company-context";
import {
  ShoppingCart, TrendingUp, Store, Clock, UtensilsCrossed, CheckCircle2,
  XCircle, BarChart3,
} from "lucide-react";

const STATS = [
  { label: "ออเดอร์วันนี้", value: "0", icon: ShoppingCart, color: "#05b187", bg: "#e8f8f2" },
  { label: "ยอดขายวันนี้", value: "฿0.00", icon: TrendingUp, color: "var(--theme-primary)", bg: "#eef4ff" },
  { label: "ร้านค้าเชื่อมต่อ", value: "0", icon: Store, color: "#fec90f", bg: "#fffbf0" },
  { label: "รอดำเนินการ", value: "0", icon: Clock, color: "#f94d4d", bg: "#fef2f2" },
];

const PLATFORMS = [
  { name: "Grab Food", icon: "🏍️", color: "#00B14F", orders: 0, revenue: 0 },
  { name: "LINE MAN", icon: "🟢", color: "#06C755", orders: 0, revenue: 0 },
  { name: "Robinhood", icon: "🟣", color: "#6B21A8", orders: 0, revenue: 0 },
];

export default function FoodDashboard() {
  const { selectedCompany } = useCompany();

  return (
    <FoodDeliveryLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800" data-testid="text-page-title">Food Delivery Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">ภาพรวมออเดอร์อาหาร — {selectedCompany?.name || "บริษัท"}</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {STATS.map((s) => (
            <Card key={s.label} className="flexy-card" data-testid={`card-stat-${s.label}`}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: s.bg }}>
                  <s.icon className="h-6 w-6" style={{ color: s.color }} />
                </div>
                <div>
                  <p className="text-xs text-gray-500">{s.label}</p>
                  <p className="text-xl font-bold text-gray-800">{s.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          {PLATFORMS.map((p) => (
            <Card key={p.name} className="flexy-card" data-testid={`card-platform-${p.name}`}>
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl">{p.icon}</span>
                  <div>
                    <h3 className="font-semibold text-gray-800">{p.name}</h3>
                    <p className="text-xs text-gray-500">แพลตฟอร์มสั่งอาหาร</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500">ออเดอร์วันนี้</p>
                    <p className="text-lg font-bold" style={{ color: p.color }}>{p.orders}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500">ยอดขาย</p>
                    <p className="text-lg font-bold" style={{ color: p.color }}>฿{p.revenue.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <Card className="flexy-card">
            <CardContent className="p-5">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" style={{ color: "#05b187" }} />
                ออเดอร์ล่าสุด
              </h3>
              <div className="text-center py-8 text-gray-400">
                <UtensilsCrossed className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">ยังไม่มีออเดอร์อาหาร</p>
                <p className="text-xs mt-1">เชื่อมต่อแพลตฟอร์มเพื่อเริ่มรับออเดอร์</p>
              </div>
            </CardContent>
          </Card>
          <Card className="flexy-card">
            <CardContent className="p-5">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <BarChart3 className="h-5 w-5" style={{ color: "#05b187" }} />
                ยอดขายรายวัน (7 วัน)
              </h3>
              <div className="text-center py-8 text-gray-400">
                <BarChart3 className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">ยังไม่มีข้อมูลยอดขาย</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </FoodDeliveryLayout>
  );
}
