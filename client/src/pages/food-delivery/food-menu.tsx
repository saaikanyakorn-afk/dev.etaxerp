import FoodDeliveryLayout from "@/components/food-delivery-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCompany } from "@/lib/company-context";
import { useState } from "react";
import {
  Search, Plus, UtensilsCrossed, Link2, Upload,
} from "lucide-react";

export default function FoodMenu() {
  const { selectedCompany } = useCompany();
  const [search, setSearch] = useState("");

  return (
    <FoodDeliveryLayout>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-800" data-testid="text-page-title">จัดการเมนู</h1>
            <p className="text-sm text-gray-500">จัดการเมนูอาหารและเชื่อมโยงกับแพลตฟอร์ม</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" data-testid="btn-import-menu">
              <Upload className="h-4 w-4 mr-1.5" />นำเข้าเมนู
            </Button>
            <Button size="sm" style={{ background: "#05b187" }} className="text-white hover:opacity-90" data-testid="btn-add-menu">
              <Plus className="h-4 w-4 mr-1.5" />เพิ่มเมนู
            </Button>
          </div>
        </div>

        <Card className="flexy-card">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                placeholder="ค้นหาชื่อเมนู, หมวดหมู่..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
                data-testid="input-search"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="flexy-card">
          <CardContent className="text-center py-16">
            <UtensilsCrossed className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <h3 className="font-semibold text-gray-600 text-lg mb-2">ยังไม่มีเมนูอาหาร</h3>
            <p className="text-sm text-gray-400 mb-4 max-w-md mx-auto">
              เพิ่มเมนูอาหารเพื่อเชื่อมโยงกับรายการสินค้าจากแพลตฟอร์ม Grab Food, LINE MAN, Robinhood
            </p>
            <div className="flex justify-center gap-3">
              <Button variant="outline" data-testid="btn-link-products">
                <Link2 className="h-4 w-4 mr-1.5" />เชื่อมโยงจากสินค้า
              </Button>
              <Button style={{ background: "#05b187" }} className="text-white hover:opacity-90" data-testid="btn-create-menu">
                <Plus className="h-4 w-4 mr-1.5" />สร้างเมนูใหม่
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </FoodDeliveryLayout>
  );
}
