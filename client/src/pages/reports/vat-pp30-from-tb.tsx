import { useState } from "react";
import Layout from "@/components/layout";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, GraduationCap } from "lucide-react";
import { useLocation } from "wouter";
import { useDateSettings } from "@/hooks/use-date-settings";
import ThaiDateInput from "@/components/thai-date-input";

function fmt(n: number) {
  if (n === 0) return "-";
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function VatPp30FromTbPage() {
  const [, navigate] = useLocation();
  const { dateEra, dateFmt } = useDateSettings();
  const params = new URLSearchParams(window.location.search);
  const companyId = params.get("companyId") || "";
  const today = new Date();
  const [startDate, setStartDate] = useState(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`);
  const [endDate, setEndDate] = useState(today.toISOString().slice(0, 10));

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/reports/vat-pp30-from-tb", companyId, startDate, endDate],
    queryFn: async () => {
      const p = new URLSearchParams({ companyId });
      if (startDate) p.set("startDate", startDate);
      if (endDate) p.set("endDate", endDate);
      const r = await fetch(`/api/reports/vat-pp30-from-tb?${p}`, { credentials: "include" });
      if (!r.ok) return null;
      return r.json();
    },
    enabled: !!companyId,
  });

  return (
    <Layout>
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/reports/general")} data-testid="btn-back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2" style={{ color: "#03c9d7" }}>
            <GraduationCap className="h-5 w-5" /> T9: รายงานภาษี ภพ 30 - จากงบทดลอง
          </h1>
          <p className="text-sm text-gray-500">คำนวณ ภ.พ.30 จากยอดภาษีขาย/ภาษีซื้อในงบทดลอง</p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="text-xs text-gray-500">วันที่เริ่ม</label>
              <ThaiDateInput value={startDate} onChange={setStartDate} dateEra={dateEra} dateFmt={dateFmt} data-testid="input-start-date" />
            </div>
            <div>
              <label className="text-xs text-gray-500">วันที่สิ้นสุด</label>
              <ThaiDateInput value={endDate} onChange={setEndDate} dateEra={dateEra} dateFmt={dateFmt} data-testid="input-end-date" />
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <Card><CardContent className="py-12 text-center text-gray-400">กำลังโหลด...</CardContent></Card>
      ) : !data ? (
        <Card><CardContent className="py-12 text-center text-gray-400">ไม่พบข้อมูล</CardContent></Card>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm" data-testid="vat-pp30-tb-table">
                <thead>
                  <tr className="border-b bg-[#03c9d7] text-white">
                    <th className="text-left px-4 py-3">รายการ</th>
                    <th className="text-left px-4 py-3 w-28">รหัสบัญชี</th>
                    <th className="text-right px-4 py-3 w-36">ฐานภาษี</th>
                    <th className="text-right px-4 py-3 w-36">ภาษี</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b bg-blue-50/50">
                    <td className="px-4 py-3 font-semibold" colSpan={4}>ภาษีขาย</td>
                  </tr>
                  {(data.salesAccounts || []).map((a: any, i: number) => (
                    <tr key={`s-${i}`} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-2 text-xs pl-8">{a.accountNameTh || a.accountName}</td>
                      <td className="px-4 py-2 text-xs font-mono">{a.accountCode}</td>
                      <td className="px-4 py-2 text-right font-mono text-xs">{fmt(a.baseAmount)}</td>
                      <td className="px-4 py-2 text-right font-mono text-xs">{fmt(a.vatAmount)}</td>
                    </tr>
                  ))}
                  <tr className="border-b bg-gray-50 font-semibold">
                    <td className="px-4 py-2 text-xs" colSpan={2}>รวมภาษีขาย</td>
                    <td className="px-4 py-2 text-right font-mono text-xs">{fmt(data.totalSalesBase || 0)}</td>
                    <td className="px-4 py-2 text-right font-mono text-xs">{fmt(data.totalSalesVat || 0)}</td>
                  </tr>

                  <tr className="border-b bg-green-50/50">
                    <td className="px-4 py-3 font-semibold" colSpan={4}>ภาษีซื้อ</td>
                  </tr>
                  {(data.purchaseAccounts || []).map((a: any, i: number) => (
                    <tr key={`p-${i}`} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-2 text-xs pl-8">{a.accountNameTh || a.accountName}</td>
                      <td className="px-4 py-2 text-xs font-mono">{a.accountCode}</td>
                      <td className="px-4 py-2 text-right font-mono text-xs">{fmt(a.baseAmount)}</td>
                      <td className="px-4 py-2 text-right font-mono text-xs">{fmt(a.vatAmount)}</td>
                    </tr>
                  ))}
                  <tr className="border-b bg-gray-50 font-semibold">
                    <td className="px-4 py-2 text-xs" colSpan={2}>รวมภาษีซื้อ</td>
                    <td className="px-4 py-2 text-right font-mono text-xs">{fmt(data.totalPurchaseBase || 0)}</td>
                    <td className="px-4 py-2 text-right font-mono text-xs">{fmt(data.totalPurchaseVat || 0)}</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr className={`border-t-2 font-bold text-sm ${(data.netVat || 0) >= 0 ? "bg-red-50" : "bg-green-50"}`}>
                    <td className="px-4 py-3" colSpan={3}>
                      {(data.netVat || 0) >= 0 ? "ภาษีที่ต้องชำระ" : "ภาษีที่ชำระเกิน (ขอคืน)"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{fmt(Math.abs(data.netVat || 0))}</td>
                  </tr>
                </tfoot>
              </table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
    </Layout>
  );
}
