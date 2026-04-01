import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import ReportLayout from "@/components/report-layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCompany } from "@/lib/company-context";
import { BookOpen, Calendar as CalendarIcon, BarChart3, Printer } from "lucide-react";
import ThaiDateInput from "@/components/thai-date-input";
import { useDateSettings } from "@/hooks/use-date-settings";
import { toLocalDateStr } from "@/lib/utils";
import ListExportButton from "@/components/list-export-button";

function fmt(val: number | string | null | undefined): string {
  const n = parseFloat(String(val || "0"));
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function SalesByAccount() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const { dateEra, dateFmt } = useDateSettings();

  const now = new Date();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState(toLocalDateStr(now));

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/reports/general-ledger", companyId, dateFrom, dateTo, "sales-accounts"],
    queryFn: async () => {
      if (!companyId) return null;
      const params = new URLSearchParams({ companyId: String(companyId), dateFrom, dateTo });
      const res = await fetch(`/api/reports/general-ledger?${params}`, { credentials: "include" });
      if (!res.ok) return null;
      const result = await res.json();
      const salesAccounts = (result.accounts || []).filter((a: any) => {
        const code = a.accountCode || "";
        return code.startsWith("4") || code.startsWith("5");
      });
      return salesAccounts;
    },
    enabled: !!companyId,
  });

  const accounts = data || [];

  const totalDebit = useMemo(() => accounts.reduce((s: number, a: any) => s + parseFloat(a.totalDebit || "0"), 0), [accounts]);
  const totalCredit = useMemo(() => accounts.reduce((s: number, a: any) => s + parseFloat(a.totalCredit || "0"), 0), [accounts]);

  const exportData = useMemo(() => {
    return accounts.map((a: any) => ({
      accountCode: a.accountCode, accountName: a.accountName,
      totalDebit: parseFloat(a.totalDebit || "0"),
      totalCredit: parseFloat(a.totalCredit || "0"),
      balance: parseFloat(a.balance || "0"),
    }));
  }, [accounts]);

  const exportColumns = [
    { header: "รหัสบัญชี", key: "accountCode", width: 15 },
    { header: "ชื่อบัญชี", key: "accountName", width: 30 },
    { header: "เดบิต", key: "totalDebit", width: 16, format: "number" as const },
    { header: "เครดิต", key: "totalCredit", width: 16, format: "number" as const },
    { header: "ยอดคงเหลือ", key: "balance", width: 16, format: "number" as const },
  ];

  return (
    <ReportLayout title="R9: ยอดขาย - ตามรหัสบัญชี" icon={<BookOpen className="h-5 w-5" />}>
      <div className="flex justify-end mb-2 gap-2">
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => window.print()} data-testid="button-print"><Printer className="h-3.5 w-3.5" /> พิมพ์</Button>
        <ListExportButton data={exportData} columns={exportColumns} fileName="R9-ยอดขาย-ตามรหัสบัญชี" />
      </div>

      <Card className="rounded border shadow-sm bg-white">
        <CardHeader className="p-3 border-b">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">ช่วงวันที่:</span>
              <ThaiDateInput value={dateFrom} onChange={setDateFrom} dateEra={dateEra} dateFmt={dateFmt} className="w-[160px]" data-testid="input-date-from" />
              <span className="text-xs text-gray-500">ถึง</span>
              <ThaiDateInput value={dateTo} onChange={setDateTo} dateEra={dateEra} dateFmt={dateFmt} className="w-[160px]" data-testid="input-date-to" />
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "จำนวนบัญชี", value: accounts.length.toLocaleString("th-TH"), color: "#fb9678", icon: BookOpen },
          { label: "รวมเดบิต", value: fmt(totalDebit), color: "#03c9d7", icon: BarChart3 },
          { label: "รวมเครดิต", value: fmt(totalCredit), color: "#05b187", icon: BarChart3 },
        ].map((stat, i) => (
          <Card key={i} className="rounded border shadow-sm bg-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: stat.color + "15" }}>
                  <stat.icon className="h-5 w-5" style={{ color: stat.color }} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="text-xl font-bold" style={{ color: stat.color }} data-testid={`text-stat-${i}`}>{stat.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded border shadow-sm bg-white">
        <CardHeader className="p-3 border-b">
          <span className="text-sm text-slate-500">บัญชีรายได้และต้นทุน (หมวด 4-5)</span>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">กำลังโหลด...</div>
          ) : accounts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <BookOpen className="h-12 w-12 mx-auto mb-3 text-slate-300" />
              <p className="text-sm" data-testid="text-empty-state">ไม่พบข้อมูล</p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-100">
                <TableRow className="hover:bg-transparent h-11">
                  <TableHead className="w-[120px] text-sm font-medium text-slate-700">รหัสบัญชี</TableHead>
                  <TableHead className="text-sm font-medium text-slate-700">ชื่อบัญชี</TableHead>
                  <TableHead className="w-[150px] text-right text-sm font-medium text-slate-700">เดบิต</TableHead>
                  <TableHead className="w-[150px] text-right text-sm font-medium text-slate-700">เครดิต</TableHead>
                  <TableHead className="w-[150px] text-right text-sm font-medium text-slate-700">ยอดคงเหลือ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((a: any, idx: number) => (
                  <TableRow key={idx} className="hover:bg-slate-50/50" data-testid={`row-account-${idx}`}>
                    <TableCell className="text-sm font-mono text-[#fb9678]">{a.accountCode}</TableCell>
                    <TableCell className="text-sm">{a.accountName}</TableCell>
                    <TableCell className="text-sm text-right tabular-nums">{fmt(a.totalDebit)}</TableCell>
                    <TableCell className="text-sm text-right tabular-nums">{fmt(a.totalCredit)}</TableCell>
                    <TableCell className="text-sm text-right font-medium tabular-nums">{fmt(a.balance)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-slate-100 font-bold">
                  <TableCell colSpan={2} className="text-sm">รวมทั้งหมด</TableCell>
                  <TableCell className="text-sm text-right tabular-nums">{fmt(totalDebit)}</TableCell>
                  <TableCell className="text-sm text-right tabular-nums">{fmt(totalCredit)}</TableCell>
                  <TableCell className="text-sm text-right tabular-nums">{fmt(totalCredit - totalDebit)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </ReportLayout>
  );
}
