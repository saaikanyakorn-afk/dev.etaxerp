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

export default function Pnd53Page() {
  const [, navigate] = useLocation();
  const { dateEra, dateFmt } = useDateSettings();
  const params = new URLSearchParams(window.location.search);
  const companyId = params.get("companyId") || "";
  const today = new Date();
  const [startDate, setStartDate] = useState(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`);
  const [endDate, setEndDate] = useState(today.toISOString().slice(0, 10));

  const { data, isLoading } = useQuery<any[]>({
    queryKey: ["/api/reports/pnd53", companyId, startDate, endDate],
    queryFn: async () => {
      const p = new URLSearchParams({ companyId });
      if (startDate) p.set("startDate", startDate);
      if (endDate) p.set("endDate", endDate);
      const r = await fetch(`/api/reports/wht-summary?${p}&pndType=53`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!companyId,
  });

  const totalPaid = (data || []).reduce((s, r) => s + (Number(r.paidAmount) || 0), 0);
  const totalWht = (data || []).reduce((s, r) => s + (Number(r.whtAmount) || 0), 0);

  return (
    <Layout>
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/reports/general")} data-testid="btn-back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2" style={{ color: "#03c9d7" }}>
            <FileText className="h-5 w-5" /> T6: รายงาน ภงด 53
          </h1>
          <p className="text-sm text-gray-500">รายงานสรุปภาษีหัก ณ ที่จ่าย ภงด.53 (นิติบุคคล)</p>
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
      ) : !data || data.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-gray-400">ไม่พบรายการ ภงด.53 ในช่วงเวลาที่เลือก</CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="pnd53-table">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left px-3 py-2 w-12">#</th>
                    <th className="text-left px-3 py-2 w-28">วันที่จ่าย</th>
                    <th className="text-left px-3 py-2">ผู้ถูกหักภาษี</th>
                    <th className="text-left px-3 py-2 w-36">เลขประจำตัว</th>
                    <th className="text-left px-3 py-2 w-32">ประเภทเงินได้</th>
                    <th className="text-center px-3 py-2 w-16">อัตรา%</th>
                    <th className="text-right px-3 py-2 w-28">จำนวนเงินจ่าย</th>
                    <th className="text-right px-3 py-2 w-28">ภาษีหัก</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((r: any, i: number) => (
                    <tr key={i} className="border-b hover:bg-gray-50" data-testid={`pnd53-row-${i}`}>
                      <td className="px-3 py-2 text-xs text-gray-400">{i + 1}</td>
                      <td className="px-3 py-2 text-xs font-mono">{formatDate(r.payDate || r.certDate, dateEra, dateFmt)}</td>
                      <td className="px-3 py-2 text-xs">{r.payeeName || "-"}</td>
                      <td className="px-3 py-2 text-xs font-mono">{r.payeeTaxId || "-"}</td>
                      <td className="px-3 py-2 text-xs">{r.incomeType || "-"}</td>
                      <td className="px-3 py-2 text-xs text-center">{r.whtRate || "-"}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs">{fmt(Number(r.paidAmount) || 0)}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs">{fmt(Number(r.whtAmount) || 0)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 bg-gray-50 font-semibold">
                    <td colSpan={6} className="px-3 py-2 text-xs">รวม ({data.length} รายการ)</td>
                    <td className="px-3 py-2 text-right font-mono text-xs">{fmt(totalPaid)}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs">{fmt(totalWht)}</td>
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
