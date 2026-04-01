import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import PosLayout from "@/components/pos-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CreditCard, Banknote, QrCode, Wallet } from "lucide-react";

const COLORS = ["#03c9d7", "#fb9678", "#05b187", "#fec90f", "#539BFF", "#f94d4d"];
const METHOD_ICONS: Record<string, any> = { "เงินสด": Banknote, "โอนเงิน": Wallet, "QR Code": QrCode, "บัตรเครดิต": CreditCard };

function fmt(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PosHubPaymentAnalysis() {
  const { selectedCompanyId } = useCompany();
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const [from, setFrom] = useState(firstDay.toISOString().split("T")[0]);
  const [to, setTo] = useState(today.toISOString().split("T")[0]);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/pos/reports/payment-analysis", selectedCompanyId, from, to],
    queryFn: async () => {
      const r = await fetch(`/api/pos/reports/payment-analysis?companyId=${selectedCompanyId}&from=${from}&to=${to}`, { credentials: "include" });
      if (!r.ok) throw new Error();
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const summary = data?.summary || [];
  const daily = data?.daily || [];
  const totalAll = summary.reduce((s: number, p: any) => s + parseFloat(p.total), 0) || 1;

  return (
    <PosLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-800" data-testid="text-payment-title">วิเคราะห์ช่องทางชำระเงิน</h1>
            <p className="text-sm text-gray-500">สัดส่วนการชำระเงินแต่ละช่องทาง</p>
          </div>
          <div className="flex items-center gap-2">
            <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-9 w-36 text-sm" data-testid="input-from" />
            <span className="text-gray-400">—</span>
            <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-9 w-36 text-sm" data-testid="input-to" />
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-20 text-gray-400">กำลังโหลดข้อมูล...</div>
        ) : summary.length === 0 ? (
          <Card><CardContent className="py-16 text-center text-gray-400">ไม่มีข้อมูลในช่วงที่เลือก</CardContent></Card>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {summary.map((pm: any, i: number) => {
                const total = parseFloat(pm.total);
                const pct = (total / totalAll) * 100;
                const color = COLORS[i % COLORS.length];
                const Icon = METHOD_ICONS[pm.method] || CreditCard;
                return (
                  <Card key={i} className="border-l-4" style={{ borderLeftColor: color }} data-testid={`card-payment-${i}`}>
                    <CardContent className="pt-5 pb-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ background: color + "15" }}>
                          <Icon className="h-5 w-5" style={{ color }} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-800">{pm.method}</p>
                          <p className="text-[10px] text-gray-400">{pct.toFixed(1)}% ของทั้งหมด</p>
                        </div>
                      </div>
                      <p className="text-xl font-bold" style={{ color }}>฿{fmt(total)}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[10px] text-gray-400">{parseInt(pm.count).toLocaleString()} รายการ</span>
                        <span className="text-[10px] text-gray-400">เฉลี่ย ฿{fmt(parseFloat(pm.avgAmount))}/บิล</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">สัดส่วนรวม</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex rounded-full h-8 overflow-hidden mb-4">
                  {summary.map((pm: any, i: number) => {
                    const pct = (parseFloat(pm.total) / totalAll) * 100;
                    return (
                      <div
                        key={i}
                        className="h-full flex items-center justify-center"
                        style={{ width: `${Math.max(pct, 1)}%`, background: COLORS[i % COLORS.length] }}
                        title={`${pm.method}: ${pct.toFixed(1)}%`}
                      >
                        {pct > 8 && <span className="text-[10px] text-white font-bold">{pct.toFixed(0)}%</span>}
                      </div>
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-3 justify-center">
                  {summary.map((pm: any, i: number) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-sm" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="text-xs text-gray-600">{pm.method}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </PosLayout>
  );
}
