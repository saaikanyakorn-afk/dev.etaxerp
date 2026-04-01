import FoodDeliveryLayout from "@/components/food-delivery-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCompany } from "@/lib/company-context";
import {
  Link2, ExternalLink, CheckCircle2, Settings,
} from "lucide-react";

const FOOD_PLATFORMS = [
  {
    id: "grab_food",
    name: "Grab Food",
    icon: "🏍️",
    color: "#00B14F",
    description: "เชื่อมต่อ Grab Food Partner API เพื่อรับออเดอร์อัตโนมัติ",
    website: "https://developer.grab.com",
    features: ["ดึงออเดอร์อัตโนมัติ", "อัพเดทสถานะเมนู", "รายงานยอดขาย"],
  },
  {
    id: "line_man",
    name: "LINE MAN",
    icon: "🟢",
    color: "#06C755",
    description: "เชื่อมต่อ LINE MAN Merchant API เพื่อรับออเดอร์จาก LINE MAN",
    website: "https://merchant.lineman.line.me",
    features: ["ดึงออเดอร์อัตโนมัติ", "จัดการเมนูออนไลน์", "ติดตามสถานะจัดส่ง"],
  },
  {
    id: "shopee_food",
    name: "Shopee Food",
    icon: "🍊",
    color: "#EE4D2D",
    description: "เชื่อมต่อ Shopee Food ผ่าน Shopee Open Platform เพื่อรับออเดอร์อาหาร",
    website: "https://seller.shopee.co.th",
    features: ["ดึงออเดอร์อัตโนมัติ", "จัดการเมนูผ่าน Seller Centre", "รายงานยอดขาย"],
  },
  {
    id: "robinhood",
    name: "Robinhood",
    icon: "🟣",
    color: "#6B21A8",
    description: "เชื่อมต่อ Robinhood Merchant เพื่อรับออเดอร์จาก Robinhood",
    website: "https://merchant.robinhood.in.th",
    features: ["ดึงออเดอร์อัตโนมัติ", "จัดการร้านค้า", "โปรโมชั่น"],
  },
];

export default function FoodConnections() {
  const { selectedCompany } = useCompany();

  return (
    <FoodDeliveryLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-bold text-gray-800" data-testid="text-page-title">เชื่อมต่อแพลตฟอร์ม</h1>
          <p className="text-sm text-gray-500">เชื่อมต่อแพลตฟอร์มสั่งอาหารเพื่อรับออเดอร์อัตโนมัติ</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FOOD_PLATFORMS.map((p) => (
            <Card key={p.id} className="flexy-card" data-testid={`card-platform-${p.id}`}>
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-12 w-12 rounded-xl flex items-center justify-center text-2xl" style={{ background: `${p.color}15` }}>
                    {p.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-800">{p.name}</h3>
                    <Badge variant="outline" className="text-xs mt-0.5">ยังไม่เชื่อมต่อ</Badge>
                  </div>
                </div>
                <p className="text-sm text-gray-500 mb-4">{p.description}</p>
                <div className="space-y-1.5 mb-4">
                  {p.features.map((f) => (
                    <div key={f} className="flex items-center gap-2 text-xs text-gray-600">
                      <CheckCircle2 className="h-3.5 w-3.5" style={{ color: p.color }} />
                      {f}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 text-white hover:opacity-90"
                    style={{ background: p.color }}
                    data-testid={`btn-connect-${p.id}`}
                  >
                    <Link2 className="h-4 w-4 mr-1.5" />เชื่อมต่อ
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <a href={p.website} target="_blank" rel="noopener noreferrer" data-testid={`link-website-${p.id}`}>
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="flexy-card">
          <CardContent className="p-5">
            <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <Settings className="h-5 w-5" style={{ color: "#05b187" }} />
              การตั้งค่าทั่วไป
            </h3>
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="font-medium text-gray-700 mb-1">ซิงค์ออเดอร์อัตโนมัติ</p>
                <p className="text-gray-500 text-xs">ดึงออเดอร์ใหม่จากแพลตฟอร์มทุก 5 นาที</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="font-medium text-gray-700 mb-1">สร้างเอกสารภาษีอัตโนมัติ</p>
                <p className="text-gray-500 text-xs">ออกใบกำกับภาษีอัตโนมัติเมื่อออเดอร์เสร็จสิ้น</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </FoodDeliveryLayout>
  );
}
