import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import PlatformLayout from "@/components/platform-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Save, Loader2, CreditCard, QrCode, BrainCircuit, Building2 } from "lucide-react";

interface PaymentConfig {
  promptpayId: string;
  accountName: string;
  bankName: string;
  aiAutoVerify: boolean;
}

export default function PlatformPaymentSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<PaymentConfig>({
    promptpayId: "",
    accountName: "",
    bankName: "",
    aiAutoVerify: true,
  });
  const [loaded, setLoaded] = useState(false);

  const { data: configData, isLoading } = useQuery<PaymentConfig>({
    queryKey: ["/api/platform/payment-config"],
    queryFn: async () => {
      const r = await fetch("/api/platform/payment-config", { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });

  useEffect(() => {
    if (configData && !loaded) {
      setForm(configData);
      setLoaded(true);
    }
  }, [configData, loaded]);

  const saveMutation = useMutation({
    mutationFn: async (data: PaymentConfig) => {
      const r = await fetch("/api/platform/payment-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!r.ok) throw new Error("บันทึกไม่สำเร็จ");
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "บันทึกสำเร็จ", description: "การตั้งค่าการชำระเงินถูกบันทึกแล้ว" });
      queryClient.invalidateQueries({ queryKey: ["/api/platform/payment-config"] });
    },
    onError: (err: Error) => {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    },
  });

  return (
    <PlatformLayout>
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" data-testid="text-page-title">
            ตั้งค่าการชำระเงิน
          </h1>
          <p className="text-gray-500 mt-1">กำหนดข้อมูลบัญชีรับเงินค่าแพ็คเกจ และระบบ AI ตรวจสลิปอัตโนมัติ</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin h-8 w-8 border-4 border-amber-500 border-t-transparent rounded-full" />
          </div>
        ) : (
          <>
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <QrCode className="h-5 w-5 text-amber-500" />
                  PromptPay / บัญชีรับเงิน
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="promptpayId">เลขพร้อมเพย์ (เบอร์โทรศัพท์ หรือ เลขบัตรประชาชน)</Label>
                  <Input
                    id="promptpayId"
                    value={form.promptpayId}
                    onChange={(e) => setForm({ ...form, promptpayId: e.target.value })}
                    placeholder="เช่น 0891234567 หรือ 1234567890123"
                    data-testid="input-promptpay-id"
                  />
                  <p className="text-xs text-gray-400">ใช้สร้าง QR Code สำหรับลูกค้าชำระเงินค่าแพ็คเกจ</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="accountName">ชื่อบัญชีผู้รับเงิน</Label>
                  <Input
                    id="accountName"
                    value={form.accountName}
                    onChange={(e) => setForm({ ...form, accountName: e.target.value })}
                    placeholder="เช่น บริษัท อีแท็กซ์ เซ็นเตอร์ จำกัด"
                    data-testid="input-account-name"
                  />
                  <p className="text-xs text-gray-400">AI จะตรวจสอบว่าชื่อผู้รับในสลิปตรงกับชื่อนี้</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bankName">ธนาคาร</Label>
                  <Input
                    id="bankName"
                    value={form.bankName}
                    onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                    placeholder="เช่น กสิกรไทย, กรุงเทพ, ไทยพาณิชย์"
                    data-testid="input-bank-name"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BrainCircuit className="h-5 w-5 text-amber-500" />
                  AI ตรวจสลิปอัตโนมัติ
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-800">เปิดใช้ AI ตรวจสลิปอัตโนมัติ</p>
                    <p className="text-sm text-gray-500 mt-0.5">
                      เมื่อเปิด: ลูกค้าแนบสลิป → AI ตรวจ → เปิดแพ็คเกจทันทีถ้าผ่าน
                    </p>
                    <p className="text-sm text-gray-500">
                      เมื่อปิด: ลูกค้าแนบสลิป → รอแอดมินตรวจสอบด้วยตนเอง
                    </p>
                  </div>
                  <Switch
                    checked={form.aiAutoVerify}
                    onCheckedChange={(v) => setForm({ ...form, aiAutoVerify: v })}
                    data-testid="switch-ai-auto-verify"
                  />
                </div>

                {form.aiAutoVerify && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <p className="text-sm font-medium text-amber-800">AI จะตรวจสอบ 3 เงื่อนไข:</p>
                    <ul className="text-sm text-amber-700 mt-2 space-y-1 list-disc list-inside">
                      <li>ยอดเงินในสลิปตรงกับราคาแพ็คเกจ (±2%)</li>
                      <li>ชื่อผู้รับเงินตรงกับที่ตั้งค่า</li>
                      <li>ระดับความเชื่อมั่นไม่ต่ำ</li>
                    </ul>
                    <p className="text-xs text-amber-600 mt-2">
                      หาก AI ไม่ผ่าน → ส่งให้แอดมินตรวจสอบด้วยตนเองอัตโนมัติ
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button
                onClick={() => saveMutation.mutate(form)}
                disabled={saveMutation.isPending}
                className="bg-amber-500 hover:bg-amber-600 text-white px-8"
                data-testid="btn-save-payment-config"
              >
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                บันทึกการตั้งค่า
              </Button>
            </div>
          </>
        )}
      </div>
    </PlatformLayout>
  );
}
