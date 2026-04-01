import { useState } from "react";
import Layout from "@/components/layout";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, History } from "lucide-react";
import { useLocation } from "wouter";
import { formatDateTime } from "@/lib/format";
import { useDateSettings } from "@/hooks/use-date-settings";
import ThaiDateInput from "@/components/thai-date-input";

function fmt(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: { label: "แบบร่าง", color: "bg-gray-100 text-gray-600" },
  posted: { label: "ผ่านรายการ", color: "bg-green-100 text-green-700" },
  approved: { label: "อนุมัติ", color: "bg-blue-100 text-blue-700" },
  voided: { label: "ยกเลิก", color: "bg-red-100 text-red-600" },
};

const BOOK_MAP: Record<string, string> = {
  general: "ทั่วไป", receive: "รับเงิน", payment: "จ่ายเงิน", sales: "ขาย", purchase: "ซื้อ",
};

export default function AccountingLogPage() {
  const [, navigate] = useLocation();
  const { dateEra, dateFmt } = useDateSettings();
  const params = new URLSearchParams(window.location.search);
  const companyId = params.get("companyId") || "";
  const today = new Date();
  const firstDay = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
  const lastDay = today.toISOString().slice(0, 10);

  const [startDate, setStartDate] = useState(firstDay);
  const [endDate, setEndDate] = useState(lastDay);

  const { data: entries, isLoading } = useQuery<any[]>({
    queryKey: ["/api/journal-entries", companyId, startDate, endDate, "accounting-log"],
    queryFn: async () => {
      const p = new URLSearchParams({ companyId });
      if (startDate) p.set("startDate", startDate);
      if (endDate) p.set("endDate", endDate);
      const r = await fetch(`/api/journal-entries?${p}`, { credentials: "include" });
      if (!r.ok) return [];
      const data = await r.json();
      return Array.isArray(data) ? data : data.data || [];
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
            <History className="h-5 w-5" /> O3: Log การบันทึกบัญชี
          </h1>
          <p className="text-sm text-gray-500">รายการบันทึกบัญชีทั้งหมด พร้อมสถานะ สมุดบัญชี และเอกสารอ้างอิง</p>
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
      ) : !entries || entries.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-gray-400">ไม่พบข้อมูล</CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="accounting-log-table">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left px-3 py-2 w-16">#</th>
                    <th className="text-left px-3 py-2 w-28">เลขที่</th>
                    <th className="text-left px-3 py-2 w-28">วันที่</th>
                    <th className="text-left px-3 py-2 w-24">สมุดบัญชี</th>
                    <th className="text-left px-3 py-2">รายละเอียด</th>
                    <th className="text-left px-3 py-2 w-28">อ้างอิง</th>
                    <th className="text-left px-3 py-2 w-32">เอกสารต้นทาง</th>
                    <th className="text-center px-3 py-2 w-24">สถานะ</th>
                    <th className="text-left px-3 py-2 w-36">สร้างเมื่อ</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e: any, i: number) => {
                    const st = STATUS_MAP[e.status] || { label: e.status, color: "bg-gray-100" };
                    return (
                      <tr key={e.id} className="border-b hover:bg-gray-50" data-testid={`log-row-${e.id}`}>
                        <td className="px-3 py-2 text-xs text-gray-400">{i + 1}</td>
                        <td className="px-3 py-2 text-xs font-mono">{e.entryNo || "-"}</td>
                        <td className="px-3 py-2 text-xs font-mono">{formatDateTime(e.entryDate, dateEra, dateFmt)}</td>
                        <td className="px-3 py-2 text-xs">{BOOK_MAP[e.journalBook] || e.journalBook || "-"}</td>
                        <td className="px-3 py-2 text-xs truncate max-w-[250px]">{e.description || "-"}</td>
                        <td className="px-3 py-2 text-xs text-gray-500">{e.reference || "-"}</td>
                        <td className="px-3 py-2 text-xs text-gray-500">{e.sourceDocType ? `${e.sourceDocType} #${e.sourceDocId}` : "-"}</td>
                        <td className="px-3 py-2 text-center"><Badge className={`text-[10px] ${st.color} border-0`}>{st.label}</Badge></td>
                        <td className="px-3 py-2 text-xs text-gray-400">{e.createdAt ? formatDateTime(e.createdAt, dateEra, dateFmt) : "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="text-xs text-gray-400 text-right">
        แสดง {entries?.length || 0} รายการ
      </div>
    </div>
    </Layout>
  );
}
