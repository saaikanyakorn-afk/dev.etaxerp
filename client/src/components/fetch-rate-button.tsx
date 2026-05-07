import { useState } from "react";
import { RotateCcw, Loader2, AlertTriangle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface FetchRateButtonProps {
  currency: string;
  date: string;
  onRate: (rate: number) => void;
  rateType?: "selling" | "buying_transfer";
}

const STALE_WARN_DAYS = 3;

export function FetchRateButton({ currency, date, onRate, rateType = "selling" }: FetchRateButtonProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const [staleDialog, setStaleDialog] = useState<{
    rate: number;
    rateLabel: string;
    rateDate: string;
    daysOld: number;
  } | null>(null);

  const handleFetch = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ currency });
      if (date) params.set("date", date);
      const res = await fetch(`/api/exchange-rate?${params}`, { credentials: "include", cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      const rate = rateType === "buying_transfer"
        ? (data.buying_transfer ?? data.thb)
        : (data.selling ?? data.thb);

      const rateLabel = rateType === "buying_transfer" && data.buying_transfer
        ? `ซื้อ ${data.buying_transfer}`
        : data.selling
          ? `ขาย ${data.selling}`
          : `${rate}`;

      const daysOld: number = data.daysOld ?? 0;

      if (daysOld > STALE_WARN_DAYS) {
        setStaleDialog({ rate, rateLabel, rateDate: data.date, daysOld });
      } else {
        onRate(rate);
        toast({
          title: `อัตราแลกเปลี่ยน ${currency}/THB (ธปท.)`,
          description: `1 ${currency} = ${rateLabel} บาท (${data.date})`,
          variant: "success" as any,
        });
      }
    } catch (e: any) {
      const msg: string = e.message || "";
      const isNotConfigured = msg.includes("BOT_API_KEY_NOT_CONFIGURED") || msg.includes("ยังไม่ได้ตั้งค่า BOT API Key");
      toast({
        title: "ดึงอัตราแลกเปลี่ยนไม่สำเร็จ",
        description: isNotConfigured
          ? "ยังไม่ได้ตั้งค่า BOT API Key — กรุณาติดต่อ Super Admin เพื่อตั้งค่าที่เมนู ตั้งค่า > อัตราแลกเปลี่ยน"
          : msg,
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  const handleUseStale = () => {
    if (!staleDialog) return;
    onRate(staleDialog.rate);
    toast({
      title: `อัตราแลกเปลี่ยน ${currency}/THB (ธปท.)`,
      description: `1 ${currency} = ${staleDialog.rateLabel} บาท (${staleDialog.rateDate}) — ข้อมูลเก่า ${staleDialog.daysOld} วัน`,
      variant: "success" as any,
    });
    setStaleDialog(null);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleFetch}
        disabled={loading}
        data-testid="button-fetch-rate"
        className="h-7 px-2 text-[10px] rounded border border-blue-300 bg-blue-50 text-blue-600 hover:bg-blue-100 disabled:opacity-50 flex items-center gap-1 whitespace-nowrap"
      >
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
        ดึงอัตรา
      </button>

      {staleDialog && (
        <Dialog open onOpenChange={(open) => { if (!open) setStaleDialog(null); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-amber-700">
                <AlertTriangle className="h-5 w-5" />
                ข้อมูลอัตราแลกเปลี่ยนเก่า
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-1">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                <p className="font-medium mb-1">
                  อัตราล่าสุดที่มีจาก ธปท. เก่า <span className="font-bold">{staleDialog.daysOld} วัน</span>
                </p>
                <p className="text-xs text-amber-700">
                  อาจเกิดจากวันหยุดยาว (เช่น สงกรานต์ ปีใหม่ หรือวันหยุดติดต่อกันหลายวัน)
                  ธปท. ไม่เผยแพร่อัตราในวันหยุดราชการ
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500">สกุลเงิน:</span>
                  <span className="font-semibold">{currency}/THB</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">อัตรา:</span>
                  <span className="font-semibold">{staleDialog.rateLabel} บาท</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">วันที่ของข้อมูล:</span>
                  <span className="font-semibold">{staleDialog.rateDate}</span>
                </div>
              </div>
              <div className="flex items-start gap-2 text-xs text-gray-600 bg-blue-50 border border-blue-100 rounded-lg p-3">
                <Clock className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-blue-500" />
                <p>ถ้าต้องการอัตราวันที่เป็นปัจจุบัน สามารถรอแล้วดึงใหม่ในวันทำการถัดไป (ธปท. อัปเดตทุกวันทำการ)</p>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-2 flex-col sm:flex-row">
              <Button
                variant="outline"
                onClick={() => setStaleDialog(null)}
                className="w-full sm:w-auto"
                data-testid="btn-stale-rate-wait"
              >
                รอก่อน (ดึงใหม่ภายหลัง)
              </Button>
              <Button
                onClick={handleUseStale}
                className="bg-amber-500 hover:bg-amber-600 text-white w-full sm:w-auto"
                data-testid="btn-stale-rate-use"
              >
                ใช้อัตรานี้ได้เลย
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
