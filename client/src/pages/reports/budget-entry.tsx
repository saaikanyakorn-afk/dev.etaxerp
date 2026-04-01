import { useState, useEffect, useMemo, useCallback } from "react";
import ReportLayout from "@/components/report-layout";
import { useCompany } from "@/lib/company-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DollarSign, Save, Copy, RefreshCw, AlertTriangle, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/use-language";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

const MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

function fmt(val: number): string {
  if (val === 0) return "-";
  return val.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface BudgetRow {
  accountCode: string;
  accountName: string;
  accountNameTh: string | null;
  accountType: string;
  months: number[];
  total: number;
}

export default function BudgetEntry() {
  const { selectedCompany } = useCompany();
  const { acctName } = useLanguage();
  const companyId = selectedCompany?.id;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [filter, setFilter] = useState<"all" | "revenue" | "expense">("all");
  const [budgetData, setBudgetData] = useState<BudgetRow[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const [sourceYear, setSourceYear] = useState(currentYear - 1);
  const [adjustPercent, setAdjustPercent] = useState("0");

  const { data: accountsList } = useQuery<any[]>({
    queryKey: ["/api/accounts", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/accounts?companyId=${companyId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!companyId,
  });

  const { data: existingBudgets, isLoading } = useQuery<any[]>({
    queryKey: ["/api/budgets", companyId, year],
    queryFn: async () => {
      const res = await fetch(`/api/budgets?companyId=${companyId}&year=${year}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!companyId,
  });

  const { data: existingYears } = useQuery<number[]>({
    queryKey: ["/api/budgets/years", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/budgets/years?companyId=${companyId}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!companyId,
  });

  useEffect(() => {
    if (!accountsList) return;

    const relevantAccounts = accountsList.filter((a: any) =>
      (a.type === "revenue" || a.type === "expense") && !a.isHeader
    ).sort((a: any, b: any) => a.code.localeCompare(b.code));

    const budgetMap = new Map<string, number[]>();
    if (existingBudgets) {
      for (const b of existingBudgets) {
        if (!budgetMap.has(b.accountCode)) budgetMap.set(b.accountCode, new Array(12).fill(0));
        budgetMap.get(b.accountCode)![b.month - 1] = parseFloat(b.amount);
      }
    }

    const rows: BudgetRow[] = relevantAccounts.map((acct: any) => {
      const months = budgetMap.get(acct.code) || new Array(12).fill(0);
      return {
        accountCode: acct.code,
        accountName: acct.name,
        accountNameTh: acct.nameTh,
        accountType: acct.type,
        months: [...months],
        total: months.reduce((s: number, v: number) => s + v, 0),
      };
    });

    setBudgetData(rows);
    setHasChanges(false);
  }, [accountsList, existingBudgets]);

  const handleCellChange = useCallback((rowIndex: number, monthIndex: number, value: string) => {
    setBudgetData(prev => {
      const next = [...prev];
      const row = { ...next[rowIndex] };
      row.months = [...row.months];
      row.months[monthIndex] = parseFloat(value) || 0;
      row.total = row.months.reduce((s, v) => s + v, 0);
      next[rowIndex] = row;
      return next;
    });
    setHasChanges(true);
  }, []);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const items: any[] = [];
      for (const row of budgetData) {
        for (let m = 0; m < 12; m++) {
          if (row.months[m] !== 0) {
            items.push({
              accountCode: row.accountCode,
              accountName: row.accountNameTh || row.accountName,
              accountType: row.accountType,
              month: m + 1,
              amount: row.months[m],
            });
          }
        }
      }

      const res = await fetch("/api/budgets/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ companyId, year, items }),
      });
      if (!res.ok) throw new Error("Save failed");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "บันทึกสำเร็จ", description: `บันทึกงบประมาณปี ${year} เรียบร้อยแล้ว` });
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/budgets/years"] });
    },
    onError: (err: any) => {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    },
  });

  const copyMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/budgets/copy-year", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ companyId, sourceYear, targetYear: year, adjustPercent }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "คัดลอกสำเร็จ", description: `คัดลอกงบประมาณ ${data.count} รายการ` });
      setShowCopyDialog(false);
      queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
    },
    onError: (err: any) => {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    },
  });

  const filteredData = useMemo(() => {
    if (filter === "all") return budgetData;
    return budgetData.filter(r => r.accountType === filter);
  }, [budgetData, filter]);

  const revenueRows = filteredData.filter(r => r.accountType === "revenue");
  const expenseRows = filteredData.filter(r => r.accountType === "expense");

  const totalRevenueBudget = revenueRows.reduce((s, r) => s + r.total, 0);
  const totalExpenseBudget = expenseRows.reduce((s, r) => s + r.total, 0);

  const yearOptions = [];
  for (let y = currentYear - 2; y <= currentYear + 2; y++) {
    yearOptions.push(y);
  }

  const renderSection = (title: string, rows: BudgetRow[], type: string) => {
    const globalStartIdx = budgetData.findIndex(r => r.accountCode === rows[0]?.accountCode);

    return (
      <div key={type}>
        <div className="px-4 py-2 font-bold text-white text-sm" style={{ background: "var(--theme-table-header)" }} data-testid={`header-budget-${type}`}>
          {title}
        </div>
        {rows.length === 0 ? (
          <div className="px-4 py-4 text-center text-muted-foreground text-sm">ไม่มีบัญชี{title}</div>
        ) : (
          rows.map((row, idx) => {
            const actualIdx = budgetData.indexOf(row);
            return (
              <TableRow key={row.accountCode} className="hover:bg-blue-50/30" data-testid={`row-budget-${row.accountCode}`}>
                <TableCell className="text-xs tabular-nums sticky left-0 bg-white z-10 min-w-[80px]">{row.accountCode}</TableCell>
                <TableCell className="text-xs sticky left-[80px] bg-white z-10 min-w-[180px] max-w-[200px] truncate" title={acctName(row)}>
                  {acctName(row)}
                </TableCell>
                {row.months.map((val, m) => (
                  <TableCell key={m} className="p-0.5 min-w-[90px]">
                    <Input
                      type="number"
                      value={val || ""}
                      onChange={(e) => handleCellChange(actualIdx, m, e.target.value)}
                      className="h-7 text-xs text-right tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      data-testid={`input-budget-${row.accountCode}-${m + 1}`}
                    />
                  </TableCell>
                ))}
                <TableCell className="text-xs text-right font-medium tabular-nums bg-gray-50 min-w-[100px]" data-testid={`text-total-${row.accountCode}`}>
                  {fmt(row.total)}
                </TableCell>
              </TableRow>
            );
          })
        )}
        {rows.length > 0 && (
          <TableRow className="bg-blue-50/70 font-bold hover:bg-blue-50/70">
            <TableCell colSpan={2} className="text-xs text-right pr-4 sticky left-0 bg-blue-50/70 z-10">
              รวม{title}
            </TableCell>
            {Array.from({ length: 12 }, (_, m) => {
              const monthTotal = rows.reduce((s, r) => s + r.months[m], 0);
              return (
                <TableCell key={m} className="text-xs text-right font-bold tabular-nums">{fmt(monthTotal)}</TableCell>
              );
            })}
            <TableCell className="text-xs text-right font-bold tabular-nums bg-gray-100">
              {fmt(rows.reduce((s, r) => s + r.total, 0))}
            </TableCell>
          </TableRow>
        )}
      </div>
    );
  };

  return (
    <ReportLayout title="ตั้งงบประมาณ" icon={<DollarSign className="h-5 w-5" />}>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
        <div className="flex items-center gap-2">
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-[120px] h-8 text-sm" data-testid="select-year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map(y => (
                <SelectItem key={y} value={String(y)}>ปี {y + 543}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
            <SelectTrigger className="w-[130px] h-8 text-sm" data-testid="select-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทั้งหมด</SelectItem>
              <SelectItem value="revenue">รายได้</SelectItem>
              <SelectItem value="expense">ค่าใช้จ่าย</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-8 text-xs"
            onClick={() => setShowCopyDialog(true)}
            data-testid="button-copy-budget"
          >
            <Copy className="h-3.5 w-3.5" />
            คัดลอกจากปีก่อน
          </Button>

          <Button
            size="sm"
            className="gap-1.5 h-8 text-xs bg-green-600 hover:bg-green-700"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !hasChanges}
            data-testid="button-save-budget"
          >
            {saveMutation.isPending ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            บันทึก
          </Button>
        </div>
      </div>

      {hasChanges && (
        <div className="flex items-center gap-2 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded text-yellow-800 text-xs" data-testid="text-unsaved-warning">
          <AlertTriangle className="h-4 w-4" />
          มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก
        </div>
      )}

      <Card className="border shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-16 text-center text-muted-foreground" data-testid="text-loading">กำลังโหลด...</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-100/80">
                    <TableHead className="text-xs font-semibold sticky left-0 bg-gray-100/80 z-10 min-w-[80px]">รหัส</TableHead>
                    <TableHead className="text-xs font-semibold sticky left-[80px] bg-gray-100/80 z-10 min-w-[180px]">ชื่อบัญชี</TableHead>
                    {MONTHS.map((m, i) => (
                      <TableHead key={i} className="text-xs font-semibold text-center min-w-[90px]">{m}</TableHead>
                    ))}
                    <TableHead className="text-xs font-semibold text-right bg-gray-100 min-w-[100px]">รวมทั้งปี</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(filter === "all" || filter === "revenue") && revenueRows.length > 0 && (
                    renderSection("รายได้", revenueRows, "revenue")
                  )}
                  {(filter === "all" || filter === "expense") && expenseRows.length > 0 && (
                    renderSection("ค่าใช้จ่าย", expenseRows, "expense")
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showCopyDialog} onOpenChange={setShowCopyDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>คัดลอกงบประมาณจากปีก่อน</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>ปีต้นทาง</Label>
              <Select value={String(sourceYear)} onValueChange={(v) => setSourceYear(Number(v))}>
                <SelectTrigger data-testid="select-source-year">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map(y => (
                    <SelectItem key={y} value={String(y)}>ปี {y + 543}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>ปรับ % (เช่น 5 = เพิ่ม 5%, -10 = ลด 10%)</Label>
              <Input
                type="number"
                value={adjustPercent}
                onChange={(e) => setAdjustPercent(e.target.value)}
                data-testid="input-adjust-percent"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCopyDialog(false)}>ยกเลิก</Button>
            <Button
              onClick={() => copyMutation.mutate()}
              disabled={copyMutation.isPending}
              data-testid="button-confirm-copy"
            >
              {copyMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
              คัดลอก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ReportLayout>
  );
}