import FoodDeliveryLayout from "@/components/food-delivery-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useCompany } from "@/lib/company-context";
import {
  Settings, RefreshCw, FileText, Bell, Clock,
} from "lucide-react";

export default function FoodSettings() {
  const { selectedCompany } = useCompany();

  return (
    <FoodDeliveryLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-bold text-gray-800" data-testid="text-page-title">ตั้งค่า Food Delivery</h1>
          <p className="text-sm text-gray-500">ตั้งค่าการทำงานของระบบ Food Delivery</p>
        </div>

        <div className="grid gap-4">
          <Card className="flexy-card">
            <CardContent className="p-5">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <RefreshCw className="h-5 w-5" style={{ color: "#05b187" }} />
                การซิงค์ออเดอร์
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700">ซิงค์อัตโนมัติ</p>
                    <p className="text-xs text-gray-500">ดึงออเดอร์ใหม่จากแพลตฟอร์มโดยอัตโนมัติ</p>
                  </div>
                  <Switch data-testid="switch-auto-sync" />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700">ความถี่ในการซิงค์</p>
                    <p className="text-xs text-gray-500">กำหนดระยะเวลาในการดึงออเดอร์</p>
                  </div>
                  <span className="text-sm text-gray-600 flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />ทุก 5 นาที
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="flexy-card">
            <CardContent className="p-5">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5" style={{ color: "#05b187" }} />
                เอกสารภาษี
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700">ออกใบกำกับภาษีอัตโนมัติ</p>
                    <p className="text-xs text-gray-500">สร้างใบกำกับภาษีอัตโนมัติเมื่อออเดอร์เสร็จสิ้น</p>
                  </div>
                  <Switch data-testid="switch-auto-tax" />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700">ประเภทเอกสารเริ่มต้น</p>
                    <p className="text-xs text-gray-500">ประเภทเอกสารที่จะสร้างอัตโนมัติ</p>
                  </div>
                  <span className="text-sm text-gray-600">ใบกำกับภาษี (TIV)</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="flexy-card">
            <CardContent className="p-5">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Bell className="h-5 w-5" style={{ color: "#05b187" }} />
                การแจ้งเตือน
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700">แจ้งเตือนออเดอร์ใหม่</p>
                    <p className="text-xs text-gray-500">รับการแจ้งเตือนเมื่อมีออเดอร์ใหม่เข้ามา</p>
                  </div>
                  <Switch data-testid="switch-notify-new" />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700">แจ้งเตือนออเดอร์ยกเลิก</p>
                    <p className="text-xs text-gray-500">รับการแจ้งเตือนเมื่อออเดอร์ถูกยกเลิก</p>
                  </div>
                  <Switch data-testid="switch-notify-cancel" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </FoodDeliveryLayout>
  );
}
