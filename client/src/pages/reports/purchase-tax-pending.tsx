import { useState } from "react";
import Layout from "@/components/layout";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText } from "lucide-react";
import { useLocation } from "wouter";
import { formatDate } from "@/lib/format";
import { useDateSettings } from "@/hooks/use-date-settings";
import ThaiDateInput from "@/components/thai-date-input";

function fmt(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PurchaseTaxPendingPage() {
  const [, navigate] = useLocation();
  const { dateEra, dateFmt } = useDateSettings();
  const params = new URLSearchParams(window.location.search);
  const companyId = params.get("companyId") || "";
  const today = new Date();
  const [asOfDate, setAsOfDate] = useState(today.toISOString().slice(0, 10));

  const { data, isLoading } = useQuery<any[]>({
    queryKey: ["/api/reports/purchase-tax-pending", companyId, asOfDate],
    queryFn: async () => {
      const p = new URLSearchParams({ companyId, asOfDate });
      const r = await fetch(`/api/reports/purchase-tax-pending?${p}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!companyId,
  });

  const totalBase = (data || []).reduce((s, r) => s + (Number(r.baseAmount) || 0), 0);
  const totalVat = (data || []).reduce((s, r) => s + (Number(r.vatAmount) || 0), 0);

  return (
    <Layout>
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/reports/general")} data-testid="btn-back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2" style={{ color: "#03c9d7" }}>
            <FileText className="h-5 w-5" /> T2a: รายงานภาษีซื้อยังไม่ถึงกำหนด
          </h1>
          <p className="text-sm text-gray-500">รายการใบกำกับภาษีซื้อที่ยังไม่ถึงกำหนดนำส่ง ณ วันที่กำหนด</p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="text-xs text-gray-500">ณ วันที่</label>
              <ThaiDateInput value={asOfDate} onChange={setAsOfDate} dateEra={dateEra} dateFmt={dateFmt} data-testid="input-as-of-date" />
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <Card><CardContent className="py-12 text-center text-gray-400">กำลังโหลด...</CardContent></Card>
      ) : !data || data.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-gray-400">ไม่มีรายการภาษีซื้อค้าง</CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="purchase-tax-pending-table">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left px-3 py-2 w-12">#</th>
                    <th className="text-left px-3 py-2 w-28">วันที่เอกสาร</th>
                    <th className="text-left px-3 py-2 w-32">เลขที่เอกสาร</th>
                    <th className="text-left px-3 py-2">ผู้ขาย</th>
                    <th className="text-left px-3 py-2 w-36">เลขประจำตัวผู้เสียภาษี</th>
                    <th className="text-right px-3 py-2 w-28">มูลค่าสินค้า</th>
                    <th className="text-right px-3 py-2 w-28">ภาษีซื้อ</th>
                    <th className="text-left px-3 py-2 w-28">กำหนดนำส่ง</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((r: any, i: number) => (
                    <tr key={i} className="border-b hover:bg-gray-50" data-testid={`row-${i}`}>
                      <td className="px-3 py-2 text-xs text-gray-400">{i + 1}</td>
                      <td className="px-3 py-2 text-xs font-mono">{formatDate(r.invoiceDate, dateEra, dateFmt)}</td>
                      <td className="px-3 py-2 text-xs font-mono">{r.invoiceNumber || "-"}</td>
                      <td className="px-3 py-2 text-xs">{r.vendorName || "-"}</td>
                      <td className="px-3 py-2 text-xs font-mono">{r.taxId || "-"}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs">{fmt(Number(r.baseAmount) || 0)}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs">{fmt(Number(r.vatAmount) || 0)}</td>
                      <td className="px-3 py-2 text-xs font-mono">{r.dueDate ? formatDate(r.dueDate, dateEra, dateFmt) : "-"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 bg-gray-50 font-semibold">
                    <td colSpan={5} className="px-3 py-2 text-xs">รวมทั้งหมด ({data.length} รายการ)</td>
                    <td className="px-3 py-2 text-right font-mono text-xs">{fmt(totalBase)}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs">{fmt(totalVat)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
    </Layout>
  );
}
