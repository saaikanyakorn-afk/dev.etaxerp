import DeliveryLayout from "@/components/delivery-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { Settings, Truck, MessageCircle, Bell, Save, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function DeliverySettings() {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [autoNotify, setAutoNotify] = useState(true);
  const [autoUpdateStatus, setAutoUpdateStatus] = useState(true);
  const [defaultCarrier, setDefaultCarrier] = useState("kerry");
  const [lineTemplate, setLineTemplate] = useState(
    "สวัสดีค่ะ คุณ {customerName}\nออเดอร์ {orderNo} ถูกจัดส่งแล้ว\nเลข Tracking: {trackingNo}\nขนส่ง: {carrier}\nขอบคุณที่ใช้บริการค่ะ"
  );

  const handleSave = async () => {
    setSaving(true);
    await new Promise(r => setTimeout(r, 800));
    setSaving(false);
    toast({ title: "บันทึกสำเร็จ", description: "ตั้งค่าการจัดส่งถูกบันทึกแล้ว" });
  };

  return (
    <DeliveryLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900" data-testid="text-delivery-settings-title">ตั้งค่าการจัดส่ง</h1>
            <p className="text-gray-500 mt-1">กำหนดค่าเริ่มต้นสำหรับระบบจัดส่ง</p>
          </div>
          <Button
            style={{ background: "#03c9d7" }}
            className="text-white hover:opacity-90"
            onClick={handleSave}
            disabled={saving}
            data-testid="button-save-settings"
          >
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            บันทึก
          </Button>
        </div>

        <Card className="flexy-card border-0 shadow-sm">
          <CardContent className="p-6 space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b">
              <Truck className="h-5 w-5" style={{ color: "#03c9d7" }} />
              <h3 className="font-semibold text-gray-800">ตั้งค่าทั่วไป</h3>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">อัพเดทสถานะอัตโนมัติ</Label>
                <p className="text-xs text-gray-500 mt-0.5">เมื่อสแกนพัสดุ ระบบจะเปลี่ยนสถานะออเดอร์เป็น "กำลังจัดส่ง" อัตโนมัติ</p>
              </div>
              <Switch
                checked={autoUpdateStatus}
                onCheckedChange={setAutoUpdateStatus}
                data-testid="switch-auto-update"
              />
            </div>

            <div>
              <Label className="text-sm font-medium">ขนส่งเริ่มต้น</Label>
              <select
                value={defaultCarrier}
                onChange={e => setDefaultCarrier(e.target.value)}
                className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                data-testid="select-default-carrier"
              >
                <option value="kerry">Kerry Express</option>
                <option value="flash">Flash Express</option>
                <option value="jt">J&T Express</option>
                <option value="thaipost">Thailand Post</option>
                <option value="ninjavan">Ninja Van</option>
                <option value="dhl">DHL</option>
                <option value="best">Best Express</option>
                <option value="scg">SCG Express</option>
              </select>
            </div>
          </CardContent>
        </Card>

        <Card className="flexy-card border-0 shadow-sm">
          <CardContent className="p-6 space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b">
              <MessageCircle className="h-5 w-5" style={{ color: "#05b187" }} />
              <h3 className="font-semibold text-gray-800">ตั้งค่า LINE แจ้ง Tracking</h3>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">แจ้งเตือนอัตโนมัติ</Label>
                <p className="text-xs text-gray-500 mt-0.5">ส่ง LINE แจ้ง tracking อัตโนมัติเมื่อมีการอัพเดทเลข tracking</p>
              </div>
              <Switch
                checked={autoNotify}
                onCheckedChange={setAutoNotify}
                data-testid="switch-auto-notify"
              />
            </div>

            <div>
              <Label className="text-sm font-medium">ข้อความแจ้งเตือน</Label>
              <p className="text-xs text-gray-500 mt-0.5 mb-2">ตัวแปร: {"{customerName}"}, {"{orderNo}"}, {"{trackingNo}"}, {"{carrier}"}</p>
              <textarea
                value={lineTemplate}
                onChange={e => setLineTemplate(e.target.value)}
                rows={5}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                data-testid="textarea-line-template"
              />
            </div>

            <div className="p-4 rounded-lg bg-green-50 border border-green-200">
              <p className="text-sm font-medium text-green-800 mb-2">ตัวอย่างข้อความ:</p>
              <p className="text-sm text-green-700 whitespace-pre-line">
                {lineTemplate
                  .replace("{customerName}", "คุณสมชาย")
                  .replace("{orderNo}", "SH-2025-001")
                  .replace("{trackingNo}", "KERR1234567890")
                  .replace("{carrier}", "Kerry Express")}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="flexy-card border-0 shadow-sm">
          <CardContent className="p-6 space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b">
              <Bell className="h-5 w-5" style={{ color: "#fec90f" }} />
              <h3 className="font-semibold text-gray-800">การแจ้งเตือน</h3>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium">แจ้งเมื่อมีออเดอร์ใหม่รอจัดส่ง</p>
                </div>
                <Switch defaultChecked data-testid="switch-notify-new-order" />
              </div>
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium">แจ้งเมื่อพัสดุถูกตีกลับ</p>
                </div>
                <Switch defaultChecked data-testid="switch-notify-returned" />
              </div>
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium">สรุปยอดจัดส่งประจำวัน</p>
                </div>
                <Switch data-testid="switch-notify-daily" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DeliveryLayout>
  );
}
