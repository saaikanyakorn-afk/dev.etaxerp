import { useState } from "react";
import { RotateCcw, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface FetchRateButtonProps {
  currency: string;
  date: string;
  onRate: (rate: number) => void;
  rateType?: "selling" | "buying_transfer";
}

export function FetchRateButton({ currency, date, onRate, rateType = "selling" }: FetchRateButtonProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

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

      onRate(rate);

      const sourceLabel = "ธปท.";
      const rateLabel = rateType === "buying_transfer" && data.buying_transfer
        ? `ซื้อ ${data.buying_transfer}`
        : data.selling
          ? `ขาย ${data.selling}`
          : `${rate}`;

      toast({
        title: `อัตราแลกเปลี่ยน ${currency}/THB (${sourceLabel})`,
        description: `1 ${currency} = ${rateLabel} บาท (${data.date})`,
        variant: "success" as any,
      });
    } catch (e: any) {
      toast({ title: "ดึงอัตราแลกเปลี่ยนไม่สำเร็จ", description: e.message, variant: "destructive" });
    }
    setLoading(false);
  };

  return (
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
  );
}
