import FoodDeliveryLayout from "@/components/food-delivery-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCompany } from "@/lib/company-context";
import { Store, Plus, MapPin } from "lucide-react";

export default function FoodStores() {
  const { selectedCompany } = useCompany();

  return (
    <FoodDeliveryLayout>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-800" data-testid="text-page-title">รายการร้าน</h1>
            <p className="text-sm text-gray-500">จัดการข้อมูลร้านค้าที่เชื่อมต่อกับแพลตฟอร์มสั่งอาหาร</p>
          </div>
          <Button size="sm" style={{ background: "#05b187" }} className="text-white hover:opacity-90" data-testid="btn-add-store">
            <Plus className="h-4 w-4 mr-1.5" />เพิ่มร้าน
          </Button>
        </div>

        <Card className="flexy-card">
          <CardContent className="text-center py-16">
            <Store className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <h3 className="font-semibold text-gray-600 text-lg mb-2">ยังไม่มีร้านค้า</h3>
            <p className="text-sm text-gray-400 mb-4 max-w-md mx-auto">
              เพิ่มข้อมูลร้านอาหารเพื่อเชื่อมต่อกับ Grab Food, LINE MAN หรือ Robinhood
            </p>
            <Button style={{ background: "#05b187" }} className="text-white hover:opacity-90" data-testid="btn-create-store">
              <Plus className="h-4 w-4 mr-1.5" />เพิ่มร้านใหม่
            </Button>
          </CardContent>
        </Card>
      </div>
    </FoodDeliveryLayout>
  );
}
