import { useState } from "react";
import Layout from "@/components/layout";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Scale } from "lucide-react";
import { useLocation } from "wouter";
import { useDateSettings } from "@/hooks/use-date-settings";
import ThaiDateInput from "@/components/thai-date-input";

function fmt(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  asset: "สินทรัพย์", liability: "หนี้สิน", equity: "ส่วนของผู้ถือหุ้น",
  revenue: "รายได้", expense: "ค่าใช้จ่าย",
};

export default function ReconcileAccountTypePage() {
  const [, navigate] = useLocation();
  const { dateEra, dateFmt } = useDateSettings();
  const params = new URLSearchParams(window.location.search);
  const companyId = params.get("companyId") || "";
  const today = new Date();
  const firstDay = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
  const lastDay = today.toISOString().slice(0, 10);

  const [startDate, setStartDate] = useState(firstDay);
  const [endDate, setEndDate] = useState(lastDay);
  const [accountType, setAccountType] = useState("");
  const [contactId, setContactId] = useState("");

  const { data: contactsList } = useQuery<any[]>({
    queryKey: ["/api/contacts", companyId],
    queryFn: async () => {
      const r = await fetch(`/api/contacts?companyId=${companyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!companyId,
  });

  const { data: result, isLoading } = useQuery<any[]>({
    queryKey: ["/api/reports/reconcile-by-account-type", companyId, startDate, endDate, accountType, contactId],
    queryFn: async () => {
      const p = new URLSearchParams({ companyId });
      if (startDate) p.set("startDate", startDate);
      if (endDate) p.set("endDate", endDate);
      if (accountType && accountType !== "all") p.set("accountType", accountType);
      if (contactId && contactId !== "all") p.set("contactId", contactId);
      const r = await fetch(`/api/reports/reconcile-by-account-type?${p}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!companyId,
  });

  const grandDebit = (result || []).reduce((s, g) => s + g.totalDebit, 0);
  const grandCredit = (result || []).reduce((s, g) => s + g.totalCredit, 0);

  return (
    <Layout>
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/reports/general")} data-testid="btn-back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2" style={{ color: "#03c9d7" }}>
            <Scale className="h-5 w-5" /> A9: Reconcile - ตามคู่ค้า/ประเภทบัญชี
          </h1>
          <p className="text-sm text-gray-500">กระทบยอดรายการบัญชี จัดกลุ่มตามคู่ค้าและกรองตามประเภทบัญชี</p>
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
            <div>
              <label className="text-xs text-gray-500">ประเภทบัญชี</label>
              <Select value={accountType} onValueChange={setAccountType}>
                <SelectTrigger className="w-48" data-testid="select-account-type">
                  <SelectValue placeholder="ทุกประเภท" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกประเภท</SelectItem>
                  {Object.entries(ACCOUNT_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-gray-500">คู่ค้า</label>
              <Select value={contactId} onValueChange={setContactId}>
                <SelectTrigger className="w-56" data-testid="select-contact">
                  <SelectValue placeholder="ทุกคู่ค้า" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกคู่ค้า</SelectItem>
                  {(contactsList || []).map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <Card><CardContent className="py-12 text-center text-gray-400">กำลังโหลด...</CardContent></Card>
      ) : !result || result.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-gray-400">ไม่พบข้อมูล</CardContent></Card>
      ) : (
        <>
          {result.map((group: any, idx: number) => (
            <Card key={idx} data-testid={`reconcile-group-${idx}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold" style={{ color: "#03c9d7" }}>
                  {group.contactName}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left px-2 py-1.5 w-28">รหัสบัญชี</th>
                        <th className="text-left px-2 py-1.5">ชื่อบัญชี</th>
                        <th className="text-center px-2 py-1.5 w-24">ประเภท</th>
                        <th className="text-right px-2 py-1.5 w-32">เดบิต</th>
                        <th className="text-right px-2 py-1.5 w-32">เครดิต</th>
                        <th className="text-right px-2 py-1.5 w-32">ยอดคงเหลือ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.accounts.map((a: any, ai: number) => (
                        <tr key={ai} className="border-b hover:bg-gray-50">
                          <td className="px-2 py-1.5 text-xs font-mono">{a.accountCode}</td>
                          <td className="px-2 py-1.5 text-xs">{a.accountNameTh || a.accountName}</td>
                          <td className="px-2 py-1.5 text-xs text-center">{ACCOUNT_TYPE_LABELS[a.accountType] || a.accountType}</td>
                          <td className="px-2 py-1.5 text-right font-mono text-xs">{fmt(a.totalDebit)}</td>
                          <td className="px-2 py-1.5 text-right font-mono text-xs">{fmt(a.totalCredit)}</td>
                          <td className="px-2 py-1.5 text-right font-mono text-xs font-semibold">{fmt(a.balance)}</td>
                        </tr>
                      ))}
                      <tr className="border-t-2 bg-gray-50 font-semibold">
                        <td colSpan={3} className="px-2 py-2 text-xs">รวม {group.contactName}</td>
                        <td className="px-2 py-2 text-right font-mono text-xs">{fmt(group.totalDebit)}</td>
                        <td className="px-2 py-2 text-right font-mono text-xs">{fmt(group.totalCredit)}</td>
                        <td className="px-2 py-2 text-right font-mono text-xs">{fmt(group.balance)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))}
          <Card>
            <CardContent className="py-3">
              <div className="flex justify-between items-center font-semibold text-sm">
                <span>รวมทั้งหมด</span>
                <div className="flex gap-8">
                  <span className="font-mono">เดบิต: {fmt(grandDebit)}</span>
                  <span className="font-mono">เครดิต: {fmt(grandCredit)}</span>
                  <span className="font-mono" style={{ color: "#03c9d7" }}>ยอดคงเหลือ: {fmt(grandDebit - grandCredit)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
    </Layout>
  );
}
