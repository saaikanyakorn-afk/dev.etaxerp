import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Table2 } from "lucide-react";
import { useLocation } from "wouter";
import { useDateSettings } from "@/hooks/use-date-settings";
import ThaiDateInput from "@/components/thai-date-input";
import ReportLayout from "@/components/report-layout";

function fmt(n: number) {
  if (n === 0) return "-";
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function WorksheetPage() {
  const [, navigate] = useLocation();
  const { dateEra, dateFmt } = useDateSettings();
  const params = new URLSearchParams(window.location.search);
  const companyId = params.get("companyId") || "";
  const today = new Date();
  const firstDay = `${today.getFullYear()}-01-01`;
  const lastDay = today.toISOString().slice(0, 10);

  const [startDate, setStartDate] = useState(firstDay);
  const [endDate, setEndDate] = useState(lastDay);

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/reports/worksheet", companyId, startDate, endDate],
    queryFn: async () => {
      const p = new URLSearchParams({ companyId });
      if (startDate) p.set("startDate", startDate);
      if (endDate) p.set("endDate", endDate);
      const r = await fetch(`/api/reports/worksheet?${p}`, { credentials: "include" });
      if (!r.ok) return null;
      return r.json();
    },
    enabled: !!companyId,
    placeholderData: keepPreviousData,
  });

  const rows = data?.rows || [];
  const totals = data?.totals;
  const netIncome = data?.netIncome ?? 0;

  const colPairs = [
    { key: "trialBalance", label: "งบทดลอง" },
    { key: "adjustments", label: "รายการปรับปรุง" },
    { key: "adjustedTrialBalance", label: "งบทดลองหลังปรับปรุง" },
    { key: "incomeStatement", label: "งบกำไรขาดทุน" },
    { key: "balanceSheet", label: "งบแสดงฐานะทางการเงิน" },
  ];

  return (
    <ReportLayout fullWidth title="กระดาษทำการ" icon={<Table2 className="h-5 w-5" />} showNavTabs>
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/reports/general")} data-testid="btn-back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2" style={{ color: "#03c9d7" }}>
            <Table2 className="h-5 w-5" /> A10: กระดาษทำการ
          </h1>
          <p className="text-sm text-gray-500">กระดาษทำการ 10 ช่อง (Worksheet) — งบทดลอง ปรับปรุง งบกำไรขาดทุน งบแสดงฐานะทางการเงิน</p>
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
      ) : rows.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-gray-400">ไม่พบข้อมูล</CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs" data-testid="worksheet-table">
                <thead>
                  <tr className="bg-[#03c9d7] text-white">
                    <th className="px-2 py-2 text-left sticky left-0 bg-[#03c9d7] z-10 w-20">รหัส</th>
                    <th className="px-2 py-2 text-left sticky left-20 bg-[#03c9d7] z-10 w-40">ชื่อบัญชี</th>
                    {colPairs.map(cp => (
                      <th key={cp.key} colSpan={2} className="px-2 py-2 text-center border-l border-white/30">{cp.label}</th>
                    ))}
                  </tr>
                  <tr className="bg-gray-100">
                    <th className="sticky left-0 bg-gray-100 z-10"></th>
                    <th className="sticky left-20 bg-gray-100 z-10"></th>
                    {colPairs.map(cp => (
                      <>
                        <th key={`${cp.key}-d`} className="px-2 py-1 text-right border-l w-24">เดบิต</th>
                        <th key={`${cp.key}-c`} className="px-2 py-1 text-right w-24">เครดิต</th>
                      </>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r: any, i: number) => (
                    <tr key={i} className="border-b hover:bg-gray-50" data-testid={`worksheet-row-${r.accountCode}`}>
                      <td className="px-2 py-1 font-mono sticky left-0 bg-white z-10">{r.accountCode}</td>
                      <td className="px-2 py-1 sticky left-20 bg-white z-10 truncate max-w-[160px]">{r.accountNameTh || r.accountName}</td>
                      {colPairs.map(cp => {
                        const pair = r[cp.key];
                        return (
                          <>
                            <td key={`${cp.key}-d`} className="px-2 py-1 text-right font-mono border-l">{fmt(pair.debit)}</td>
                            <td key={`${cp.key}-c`} className="px-2 py-1 text-right font-mono">{fmt(pair.credit)}</td>
                          </>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
                {totals && (
                  <tfoot>
                    <tr className="border-t-2 bg-gray-50 font-semibold">
                      <td className="px-2 py-2 sticky left-0 bg-gray-50 z-10" colSpan={2}>รวม</td>
                      {colPairs.map(cp => {
                        const pair = totals[cp.key];
                        return (
                          <>
                            <td key={`${cp.key}-d`} className="px-2 py-2 text-right font-mono border-l">{fmt(pair.debit)}</td>
                            <td key={`${cp.key}-c`} className="px-2 py-2 text-right font-mono">{fmt(pair.credit)}</td>
                          </>
                        );
                      })}
                    </tr>
                    <tr className="bg-[#03c9d7]/10 font-bold">
                      <td colSpan={2} className="px-2 py-2 sticky left-0 bg-[#03c9d7]/10 z-10">กำไร(ขาดทุน)สุทธิ</td>
                      <td colSpan={6}></td>
                      <td colSpan={2} className="px-2 py-2 text-right font-mono border-l" style={{ color: netIncome >= 0 ? "#05b187" : "#f94d4d" }}>
                        {fmt(Math.abs(netIncome))} {netIncome < 0 ? "(ขาดทุน)" : ""}
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </ReportLayout>
  );
}
