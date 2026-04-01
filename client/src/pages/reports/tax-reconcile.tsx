import { useState } from "react";
import Layout from "@/components/layout";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Scale } from "lucide-react";
import { useLocation } from "wouter";
import { useDateSettings } from "@/hooks/use-date-settings";
import ThaiDateInput from "@/components/thai-date-input";

function fmt(n: number) {
  if (n === 0) return "-";
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function TaxReconcilePage({ type }: { type: "sales" | "purchase" }) {
  const [, navigate] = useLocation();
  const { dateEra, dateFmt } = useDateSettings();
  const params = new URLSearchParams(window.location.search);
  const companyId = params.get("companyId") || "";
  const today = new Date();
  const [startDate, setStartDate] = useState(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`);
  const [endDate, setEndDate] = useState(today.toISOString().slice(0, 10));

  const isSales = type === "sales";
  const title = isSales ? "T7: รายงานกระทบยอดภาษีขาย - งบทดลอง" : "T8: รายงานกระทบยอดภาษีซื้อ - งบทดลอง";
  const subtitle = isSales ? "เปรียบเทียบยอดภาษีขายจากรายงานภาษี กับยอดในงบทดลอง" : "เปรียบเทียบยอดภาษีซื้อจากรายงานภาษี กับยอดในงบทดลอง";
  const vatAccountCode = isSales ? "2341" : "1432";

  const { data: taxData, isLoading: loadingTax } = useQuery<any>({
    queryKey: ["/api/reports/tax-reconcile-tax", companyId, startDate, endDate, type],
    queryFn: async () => {
      const endpoint = isSales ? "/api/tax-invoices" : "/api/purchase-invoices";
      const p = new URLSearchParams({ companyId });
      if (startDate) p.set("startDate", startDate);
      if (endDate) p.set("endDate", endDate);
      const r = await fetch(`${endpoint}?${p}`, { credentials: "include" });
      if (!r.ok) return { items: [], totalVat: 0 };
      const items = await r.json();
      const arr = Array.isArray(items) ? items : items.data || [];
      const totalVat = arr.reduce((s: number, item: any) => s + (Number(item.vatAmount) || 0), 0);
      const totalBase = arr.reduce((s: number, item: any) => s + (Number(item.subtotal) || Number(item.totalBeforeVat) || 0), 0);
      return { count: arr.length, totalVat, totalBase };
    },
    enabled: !!companyId,
  });

  const { data: tbData, isLoading: loadingTb } = useQuery<any>({
    queryKey: ["/api/reports/tax-reconcile-tb", companyId, startDate, endDate, vatAccountCode],
    queryFn: async () => {
      const p = new URLSearchParams({ companyId });
      if (startDate) p.set("startDate", startDate);
      if (endDate) p.set("endDate", endDate);
      const r = await fetch(`/api/reports/trial-balance?${p}`, { credentials: "include" });
      if (!r.ok) return { vatBalance: 0 };
      const data = await r.json();
      const rows = data.accounts || data || [];
      const vatRows = rows.filter((a: any) => a.accountCode?.startsWith(vatAccountCode) || a.code?.startsWith(vatAccountCode));
      const vatBalance = vatRows.reduce((s: number, a: any) => {
        const d = Number(a.totalDebit || a.debit || 0);
        const c = Number(a.totalCredit || a.credit || 0);
        return s + (isSales ? c - d : d - c);
      }, 0);
      return { vatBalance, accounts: vatRows };
    },
    enabled: !!companyId,
  });

  const isLoading = loadingTax || loadingTb;
  const taxVat = taxData?.totalVat || 0;
  const tbVat = tbData?.vatBalance || 0;
  const diff = taxVat - tbVat;

  return (
    <Layout>
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/reports/general")} data-testid="btn-back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2" style={{ color: "#03c9d7" }}>
            <Scale className="h-5 w-5" /> {title}
          </h1>
          <p className="text-sm text-gray-500">{subtitle}</p>
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
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-xs text-gray-500 mb-1">ยอด{isSales ? "ภาษีขาย" : "ภาษีซื้อ"}จากรายงานภาษี</p>
                <p className="text-2xl font-bold font-mono" style={{ color: "#03c9d7" }}>{fmt(taxVat)}</p>
                <p className="text-xs text-gray-400 mt-1">{taxData?.count || 0} รายการ</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-xs text-gray-500 mb-1">ยอด{isSales ? "ภาษีขาย" : "ภาษีซื้อ"}จากงบทดลอง</p>
                <p className="text-2xl font-bold font-mono" style={{ color: "#03c9d7" }}>{fmt(tbVat)}</p>
                <p className="text-xs text-gray-400 mt-1">รหัสบัญชี {vatAccountCode}*</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-xs text-gray-500 mb-1">ผลต่าง</p>
                <p className={`text-2xl font-bold font-mono ${Math.abs(diff) < 0.01 ? "text-green-600" : "text-red-500"}`}>
                  {fmt(diff)}
                </p>
                <p className="text-xs mt-1">{Math.abs(diff) < 0.01 ? "ตรงกัน" : "ไม่ตรงกัน - ต้องตรวจสอบ"}</p>
              </CardContent>
            </Card>
          </div>

          {tbData?.accounts && tbData.accounts.length > 0 && (
            <Card>
              <CardContent className="p-0">
                <div className="px-4 py-3 bg-gray-50 border-b font-semibold text-sm">รายละเอียดบัญชีภาษีจากงบทดลอง</div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left px-3 py-2 w-28">รหัสบัญชี</th>
                      <th className="text-left px-3 py-2">ชื่อบัญชี</th>
                      <th className="text-right px-3 py-2 w-32">เดบิต</th>
                      <th className="text-right px-3 py-2 w-32">เครดิต</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tbData.accounts.map((a: any, i: number) => (
                      <tr key={i} className="border-b hover:bg-gray-50">
                        <td className="px-3 py-2 text-xs font-mono">{a.accountCode || a.code}</td>
                        <td className="px-3 py-2 text-xs">{a.accountNameTh || a.accountName || a.nameTh || a.name}</td>
                        <td className="px-3 py-2 text-right font-mono text-xs">{fmt(Number(a.totalDebit || a.debit || 0))}</td>
                        <td className="px-3 py-2 text-right font-mono text-xs">{fmt(Number(a.totalCredit || a.credit || 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
    </Layout>
  );
}
