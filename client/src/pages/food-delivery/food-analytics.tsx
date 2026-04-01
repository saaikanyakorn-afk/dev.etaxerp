import FoodDeliveryLayout from "@/components/food-delivery-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCompany } from "@/lib/company-context";
import { useState } from "react";
import {
  BarChart3, TrendingUp, PieChart, Calendar,
} from "lucide-react";

export default function FoodAnalytics() {
  const { selectedCompany } = useCompany();
  const [period, setPeriod] = useState("7d");

  return (
    <FoodDeliveryLayout>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-800" data-testid="text-page-title">วิเคราะห์ยอดขาย</h1>
            <p className="text-sm text-gray-500">วิเคราะห์ยอดขายจากแพลตฟอร์มสั่งอาหาร</p>
          </div>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-40" data-testid="select-period">
              <Calendar className="h-4 w-4 mr-1.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">วันนี้</SelectItem>
              <SelectItem value="7d">7 วัน</SelectItem>
              <SelectItem value="30d">30 วัน</SelectItem>
              <SelectItem value="90d">90 วัน</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <Card className="flexy-card">
            <CardContent className="p-5 text-center">
              <TrendingUp className="h-8 w-8 mx-auto mb-2" style={{ color: "#05b187" }} />
              <p className="text-xs text-gray-500">ยอดขายรวม</p>
              <p className="text-2xl font-bold text-gray-800">฿0.00</p>
            </CardContent>
          </Card>
          <Card className="flexy-card">
            <CardContent className="p-5 text-center">
              <BarChart3 className="h-8 w-8 mx-auto mb-2" style={{ color: "var(--theme-primary)" }} />
              <p className="text-xs text-gray-500">จำนวนออเดอร์</p>
              <p className="text-2xl font-bold text-gray-800">0</p>
            </CardContent>
          </Card>
          <Card className="flexy-card">
            <CardContent className="p-5 text-center">
              <PieChart className="h-8 w-8 mx-auto mb-2" style={{ color: "#fec90f" }} />
              <p className="text-xs text-gray-500">ยอดเฉลี่ย/ออเดอร์</p>
              <p className="text-2xl font-bold text-gray-800">฿0.00</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <Card className="flexy-card">
            <CardContent className="p-5">
              <h3 className="font-semibold text-gray-800 mb-4">ยอดขายรายวัน</h3>
              <div className="text-center py-12 text-gray-400">
                <BarChart3 className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">ยังไม่มีข้อมูล</p>
              </div>
            </CardContent>
          </Card>
          <Card className="flexy-card">
            <CardContent className="p-5">
              <h3 className="font-semibold text-gray-800 mb-4">สัดส่วนแพลตฟอร์ม</h3>
              <div className="text-center py-12 text-gray-400">
                <PieChart className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">ยังไม่มีข้อมูล</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="flexy-card">
          <CardContent className="p-5">
            <h3 className="font-semibold text-gray-800 mb-4">เมนูขายดี (Top 10)</h3>
            <div className="text-center py-8 text-gray-400">
              <p className="text-sm">ยังไม่มีข้อมูลเมนูขายดี</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </FoodDeliveryLayout>
  );
}
