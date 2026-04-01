import { useState, useRef, useMemo } from "react";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { Wand2, Loader2, ArrowLeft, CheckCircle2, PenLine, Calculator, FileSpreadsheet, Upload, AlertTriangle, Check, Search, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/use-language";
import { useLocation } from "wouter";
import * as XLSX from "xlsx";
import { getAccountName, type SupportedLanguage } from "@shared/i18n";

function fmt(val: number) { return val.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function currentLang(): SupportedLanguage { return (localStorage.getItem("app-language") as SupportedLanguage) || "th"; }

type ExcelRow = {
  excelCode: string;
  excelName: string;
  debit: number;
  credit: number;
  matchedAccountId: number | null;
  matchedCode: string;
  matchedName: string;
  matchStatus: "exact" | "fuzzy" | "unmatched";
};

function normalizeStr(s: string) {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

function matchAccount(code: string, name: string, accounts: any[]): { accountId: number | null; code: string; name: string; status: "exact" | "fuzzy" | "unmatched" } {
  const cleanCode = code?.toString().trim();
  const cleanName = normalizeStr(name || "");

  if (cleanCode) {
    const byCode = accounts.find(a => a.code === cleanCode);
    if (byCode) return { accountId: byCode.id, code: byCode.code, name: getAccountName(byCode, currentLang()), status: "exact" };
  }

  if (cleanName) {
    const byNameTh = accounts.find(a => normalizeStr(a.nameTh || "") === cleanName);
    if (byNameTh) return { accountId: byNameTh.id, code: byNameTh.code, name: getAccountName(byNameTh, currentLang()), status: "exact" };

    const byNameEn = accounts.find(a => normalizeStr(a.name || "") === cleanName);
    if (byNameEn) return { accountId: byNameEn.id, code: byNameEn.code, name: getAccountName(byNameEn, currentLang()), status: "exact" };

    const fuzzy = accounts.find(a => {
      const th = normalizeStr(a.nameTh || "");
      const en = normalizeStr(a.name || "");
      return (th && (th.includes(cleanName) || cleanName.includes(th))) ||
             (en && (en.includes(cleanName) || cleanName.includes(en)));
    });
    if (fuzzy) return { accountId: fuzzy.id, code: fuzzy.code, name: getAccountName(fuzzy, currentLang()), status: "fuzzy" };
  }

  return { accountId: null, code: "", name: "", status: "unmatched" };
}

export default function BalanceCarryForward() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { acctName } = useLanguage();
  const currentYear = new Date().getFullYear();
  const [fromYear, setFromYear] = useState(String(currentYear - 1));
  const [manualYear, setManualYear] = useState(String(currentYear - 1));
  const [manualBalances, setManualBalances] = useState<{ accountId: number; code: string; name: string; debit: string; credit: string }[]>([]);

  const [excelYear, setExcelYear] = useState(String(currentYear - 1));
  const [excelRows, setExcelRows] = useState<ExcelRow[]>([]);
  const [showMappingDialog, setShowMappingDialog] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [mappingSearch, setMappingSearch] = useState<Record<number, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: allAccounts } = useQuery<any[]>({
    queryKey: ["/api/accounts", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/accounts?companyId=${companyId}`, { credentials: "include" });
      return res.json();
    },
    enabled: !!companyId,
  });

  const bsAccounts = (allAccounts || []).filter((a: any) => a.active && !a.isHeader && ["1", "2", "3"].includes(a.code?.charAt(0)));
  const allDetailAccounts = (allAccounts || []).filter((a: any) => a.active && !a.isHeader);

  const initManualBalances = () => {
    setManualBalances(bsAccounts.map((a: any) => ({
      accountId: a.id, code: a.code, name: acctName(a), debit: "", credit: "",
    })));
  };

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/accounting-mgmt/balance-carry-forward/preview", companyId, fromYear],
    queryFn: async () => {
      if (!companyId) return null;
      const res = await fetch(`/api/accounting-mgmt/balance-carry-forward/preview?companyId=${companyId}&fromYear=${fromYear}`, { credentials: "include" });
      return res.json();
    },
    enabled: !!companyId,
  });

  const executeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/accounting-mgmt/balance-carry-forward/execute", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ companyId, fromYear: Number(fromYear), balances: data?.balances }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message); }
      return res.json();
    },
    onSuccess: (result) => {
      toast({ title: "สำเร็จ", description: result.message });
      refetch();
    },
    onError: (err: any) => { toast({ title: "ผิดพลาด", description: err.message, variant: "destructive" }); },
  });

  const manualExecuteMutation = useMutation({
    mutationFn: async () => {
      const filledBalances = manualBalances
        .filter(b => (parseFloat(b.debit) || 0) > 0 || (parseFloat(b.credit) || 0) > 0)
        .map(b => ({
          accountId: b.accountId, code: b.code, name: b.name,
          debit: parseFloat(b.debit) || 0,
          credit: parseFloat(b.credit) || 0,
        }));
      if (filledBalances.length === 0) throw new Error("กรุณากรอกยอดอย่างน้อย 1 บัญชี");
      const totalDebit = filledBalances.reduce((s, b) => s + b.debit, 0);
      const totalCredit = filledBalances.reduce((s, b) => s + b.credit, 0);
      if (Math.abs(totalDebit - totalCredit) > 0.02) throw new Error(`ยอดเดบิต (${fmt(totalDebit)}) ไม่เท่ากับเครดิต (${fmt(totalCredit)}) กรุณาตรวจสอบ`);
      const res = await fetch("/api/accounting-mgmt/balance-carry-forward/execute", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ companyId, fromYear: Number(manualYear), balances: filledBalances }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message); }
      return res.json();
    },
    onSuccess: (result) => {
      toast({ title: "สำเร็จ", description: result.message });
    },
    onError: (err: any) => { toast({ title: "ผิดพลาด", description: err.message, variant: "destructive" }); },
  });

  const excelExecuteMutation = useMutation({
    mutationFn: async () => {
      const mapped = excelRows.filter(r => r.matchedAccountId && (r.debit > 0 || r.credit > 0));
      if (mapped.length === 0) throw new Error("ไม่มีรายการที่จับคู่บัญชีได้");
      const totalDebit = mapped.reduce((s, r) => s + r.debit, 0);
      const totalCredit = mapped.reduce((s, r) => s + r.credit, 0);
      if (Math.abs(totalDebit - totalCredit) > 0.02) throw new Error(`ยอดเดบิต (${fmt(totalDebit)}) ไม่เท่ากับเครดิต (${fmt(totalCredit)}) กรุณาตรวจสอบ`);
      const balances = mapped.map(r => ({
        accountId: r.matchedAccountId,
        code: r.matchedCode,
        name: r.matchedName,
        debit: r.debit,
        credit: r.credit,
      }));
      const res = await fetch("/api/accounting-mgmt/balance-carry-forward/execute", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ companyId, fromYear: Number(excelYear), balances }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message); }
      return res.json();
    },
    onSuccess: (result) => {
      toast({ title: "สำเร็จ", description: result.message });
      setShowConfirmDialog(false);
      setExcelRows([]);
    },
    onError: (err: any) => { toast({ title: "ผิดพลาด", description: err.message, variant: "destructive" }); },
  });

  const updateManualBalance = (idx: number, field: "debit" | "credit", value: string) => {
    setManualBalances(manualBalances.map((b, i) => i === idx ? { ...b, [field]: value } : b));
  };

  const manualTotalDebit = manualBalances.reduce((s, b) => s + (parseFloat(b.debit) || 0), 0);
  const manualTotalCredit = manualBalances.reduce((s, b) => s + (parseFloat(b.credit) || 0), 0);
  const manualDiff = Math.abs(manualTotalDebit - manualTotalCredit);

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !allDetailAccounts.length) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json<any>(ws, { header: 1 });

        let headerIdx = -1;
        let codeCol = -1, nameCol = -1, debitCol = -1, creditCol = -1;

        for (let i = 0; i < Math.min(jsonData.length, 15); i++) {
          const row = jsonData[i] as any[];
          if (!row) continue;
          const allDebitCols: number[] = [];
          const allCreditCols: number[] = [];
          for (let j = 0; j < row.length; j++) {
            const cell = String(row[j] || "").toLowerCase().trim();
            if (cell.includes("รหัส") || cell.includes("code") || cell === "เลขที่") {
              codeCol = j; headerIdx = i;
            }
            if (cell.includes("ชื่อบัญชี") || cell.includes("account") || cell.includes("name") || cell.includes("รายการ")) {
              nameCol = j; headerIdx = i;
            }
            if (cell.includes("เดบิต") || cell.includes("debit") || cell.includes("dr")) {
              allDebitCols.push(j); headerIdx = i;
            }
            if (cell.includes("เครดิต") || cell.includes("credit") || cell.includes("cr")) {
              allCreditCols.push(j); headerIdx = i;
            }
          }
          if (codeCol >= 0 && allDebitCols.length > 0) {
            debitCol = allDebitCols[allDebitCols.length - 1];
            creditCol = allCreditCols.length > 0 ? allCreditCols[allCreditCols.length - 1] : -1;
            break;
          }
        }

        if (headerIdx < 0 || (codeCol < 0 && nameCol < 0) || (debitCol < 0 && creditCol < 0)) {
          toast({ title: "ไม่สามารถอ่านไฟล์ได้", description: "กรุณาตรวจสอบว่าไฟล์ Excel มีคอลัมน์: รหัสบัญชี, ชื่อบัญชี, เดบิต, เครดิต", variant: "destructive" });
          return;
        }

        const rows: ExcelRow[] = [];
        const skipPatterns = /^(รวม|total|sum|ยอดรวม|สินทรัพย์|หนี้สิน|ส่วนของ|ทุน|รายได้|ค่าใช้จ่าย|assets|liabilities|equity|revenue|expense)/i;
        for (let i = headerIdx + 1; i < jsonData.length; i++) {
          const row = jsonData[i] as any[];
          if (!row) continue;
          const rawCode = String(row[codeCol] ?? "").replace(/[-–—.]/g, "").trim();
          const rawName = String(row[nameCol >= 0 ? nameCol : codeCol] ?? "").trim();
          const rawDebit = parseFloat(String(row[debitCol] ?? "0").replace(/,/g, "")) || 0;
          const rawCredit = creditCol >= 0 ? (parseFloat(String(row[creditCol] ?? "0").replace(/,/g, "")) || 0) : 0;

          if (!rawCode && !rawName) continue;
          if (rawDebit === 0 && rawCredit === 0) continue;
          if (!rawCode && skipPatterns.test(rawName)) continue;

          const match = matchAccount(rawCode, rawName, allDetailAccounts);
          rows.push({
            excelCode: rawCode,
            excelName: rawName,
            debit: rawDebit,
            credit: rawCredit,
            matchedAccountId: match.accountId,
            matchedCode: match.code,
            matchedName: match.name,
            matchStatus: match.status,
          });
        }

        if (rows.length === 0) {
          toast({ title: "ไม่พบข้อมูล", description: "ไม่พบรายการบัญชีที่มียอดเดบิตหรือเครดิตในไฟล์", variant: "destructive" });
          return;
        }

        setExcelRows(rows);

        const unmatchedCount = rows.filter(r => r.matchStatus === "unmatched" || r.matchStatus === "fuzzy").length;
        if (unmatchedCount > 0) {
          setShowMappingDialog(true);
        }
        toast({ title: "อ่านไฟล์สำเร็จ", description: `พบ ${rows.length} รายการ, จับคู่ได้ ${rows.length - unmatchedCount} รายการ${unmatchedCount > 0 ? `, ต้องจับคู่เพิ่ม ${unmatchedCount} รายการ` : ""}` });
      } catch {
        toast({ title: "ผิดพลาด", description: "ไม่สามารถอ่านไฟล์ได้ กรุณาตรวจสอบรูปแบบไฟล์", variant: "destructive" });
      }
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const updateMapping = (idx: number, account: any) => {
    setExcelRows(prev => prev.map((r, i) => i === idx ? {
      ...r,
      matchedAccountId: account.id,
      matchedCode: account.code,
      matchedName: acctName(account),
      matchStatus: "exact" as const,
    } : r));
  };

  const clearMapping = (idx: number) => {
    setExcelRows(prev => prev.map((r, i) => i === idx ? {
      ...r,
      matchedAccountId: null,
      matchedCode: "",
      matchedName: "",
      matchStatus: "unmatched" as const,
    } : r));
  };

  const unmatchedRows = useMemo(() => excelRows.filter(r => r.matchStatus !== "exact"), [excelRows]);
  const excelMapped = excelRows.filter(r => r.matchedAccountId && (r.debit > 0 || r.credit > 0));
  const excelTotalDebit = excelMapped.reduce((s, r) => s + r.debit, 0);
  const excelTotalCredit = excelMapped.reduce((s, r) => s + r.credit, 0);
  const excelDiff = Math.abs(excelTotalDebit - excelTotalCredit);

  const getFilteredAccounts = (idx: number) => {
    const q = normalizeStr(mappingSearch[idx] || "");
    if (!q) return allDetailAccounts.slice(0, 30);
    return allDetailAccounts.filter((a: any) => {
      const code = (a.code || "").toLowerCase();
      const th = normalizeStr(a.nameTh || "");
      const en = normalizeStr(a.name || "");
      return code.includes(q) || th.includes(q) || en.includes(q);
    }).slice(0, 30);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/accounting-mgmt")} data-testid="btn-back">
            <ArrowLeft className="h-4 w-4 mr-1" /> กลับ
          </Button>
          <Wand2 className="h-5 w-5 text-[#03c9d7]" />
          <h1 className="text-xl font-heading font-bold">ยกยอดงบการเงิน</h1>
        </div>

        <Tabs defaultValue="manual">
          <TabsList>
            <TabsTrigger value="manual" data-testid="tab-manual">
              <PenLine className="h-4 w-4 mr-1" /> กรอกยอดเอง
            </TabsTrigger>
            <TabsTrigger value="excel" data-testid="tab-excel">
              <FileSpreadsheet className="h-4 w-4 mr-1" /> นำเข้าจาก Excel
            </TabsTrigger>
            <TabsTrigger value="auto" data-testid="tab-auto">
              <Calculator className="h-4 w-4 mr-1" /> คำนวณจากระบบ
            </TabsTrigger>
          </TabsList>

          {/* Tab: กรอกยอดเอง */}
          <TabsContent value="manual">
            <Card>
              <CardHeader>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    สำหรับกิจการที่เพิ่งเริ่มใช้โปรแกรม ให้กรอกยอดคงเหลือจากงบการเงินเดิม (งบทดลอง / งบดุล) เพื่อนำเข้าเป็นยอดเปิดในระบบ
                  </p>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium">ยอดคงเหลือ ณ สิ้นปี</span>
                    <Select value={manualYear} onValueChange={setManualYear}>
                      <SelectTrigger className="w-40" data-testid="select-manual-year"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 5 }, (_, i) => currentYear - i + 1).map(y => (
                          <SelectItem key={y} value={String(y)}>{y + 543}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {manualBalances.length === 0 && (
                      <Button onClick={initManualBalances} data-testid="btn-load-accounts">
                        โหลดผังบัญชี
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {manualBalances.length > 0 ? (
                  <>
                    <div className="overflow-auto max-h-[500px]">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-white z-10">
                          <tr className="border-b">
                            <th className="text-left p-2 w-24">รหัส</th>
                            <th className="text-left p-2">ชื่อบัญชี</th>
                            <th className="text-right p-2 w-40">เดบิต</th>
                            <th className="text-right p-2 w-40">เครดิต</th>
                          </tr>
                        </thead>
                        <tbody>
                          {manualBalances.map((b, idx) => (
                            <tr key={b.accountId} className="border-b hover:bg-slate-50" data-testid={`row-${b.code}`}>
                              <td className="p-2 font-mono text-xs">{b.code}</td>
                              <td className="p-2 text-sm">{b.name}</td>
                              <td className="p-1">
                                <Input
                                  type="number" step="0.01" min="0"
                                  value={b.debit} onChange={e => updateManualBalance(idx, "debit", e.target.value)}
                                  className="h-8 text-right text-sm"
                                  placeholder="0.00"
                                  data-testid={`input-debit-${b.code}`}
                                />
                              </td>
                              <td className="p-1">
                                <Input
                                  type="number" step="0.01" min="0"
                                  value={b.credit} onChange={e => updateManualBalance(idx, "credit", e.target.value)}
                                  className="h-8 text-right text-sm"
                                  placeholder="0.00"
                                  data-testid={`input-credit-${b.code}`}
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="sticky bottom-0 bg-white">
                          <tr className="font-bold border-t-2">
                            <td colSpan={2} className="p-2">รวม</td>
                            <td className="p-2 text-right">{fmt(manualTotalDebit)}</td>
                            <td className="p-2 text-right">{fmt(manualTotalCredit)}</td>
                          </tr>
                          {manualDiff > 0.02 && (
                            <tr className="text-red-600">
                              <td colSpan={2} className="p-2">ผลต่าง (เดบิต - เครดิต)</td>
                              <td colSpan={2} className="p-2 text-right font-bold">{fmt(manualTotalDebit - manualTotalCredit)}</td>
                            </tr>
                          )}
                        </tfoot>
                      </table>
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        กรอกเฉพาะบัญชีที่มียอดคงเหลือ ยอดเดบิตกับเครดิตต้องเท่ากัน
                      </p>
                      <Button
                        onClick={() => manualExecuteMutation.mutate()}
                        disabled={manualExecuteMutation.isPending || manualDiff > 0.02}
                        className="bg-[#03c9d7] hover:bg-[#02b0bc]"
                        data-testid="btn-manual-execute"
                      >
                        {manualExecuteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                        ยืนยันบันทึกยอดยกมา
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <PenLine className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p>กดปุ่ม "โหลดผังบัญชี" เพื่อเริ่มกรอกยอดยกมา</p>
                    <p className="text-xs mt-1">ระบบจะแสดงบัญชีหมวด 1 (สินทรัพย์), 2 (หนี้สิน), 3 (ส่วนของเจ้าของ) ให้กรอก</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: นำเข้าจาก Excel */}
          <TabsContent value="excel">
            <Card>
              <CardHeader>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    นำเข้างบทดลองจากไฟล์ Excel (.xlsx, .xls) ระบบจะจับคู่รหัส/ชื่อบัญชีอัตโนมัติ หากไม่ตรงจะให้เลือกบัญชีที่ถูกต้อง
                  </p>
                  <div className="flex items-center gap-4 flex-wrap">
                    <span className="text-sm font-medium">ยอดคงเหลือ ณ สิ้นปี</span>
                    <Select value={excelYear} onValueChange={setExcelYear}>
                      <SelectTrigger className="w-40" data-testid="select-excel-year"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 5 }, (_, i) => currentYear - i + 1).map(y => (
                          <SelectItem key={y} value={String(y)}>{y + 543}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      className="hidden"
                      onChange={handleExcelUpload}
                      data-testid="input-excel-file"
                    />
                    <Button onClick={() => fileInputRef.current?.click()} data-testid="btn-upload-excel">
                      <Upload className="h-4 w-4 mr-1" /> เลือกไฟล์ Excel
                    </Button>
                    {excelRows.length > 0 && unmatchedRows.length > 0 && (
                      <Button variant="outline" onClick={() => setShowMappingDialog(true)} className="border-amber-400 text-amber-600" data-testid="btn-open-mapping">
                        <AlertTriangle className="h-4 w-4 mr-1" /> จับคู่บัญชี ({unmatchedRows.length})
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    รูปแบบ Excel: คอลัมน์ รหัสบัญชี | ชื่อบัญชี | เดบิต | เครดิต (แถวแรกเป็นหัวตาราง) · รองรับงบทดลองที่มีหลายคู่เดบิต/เครดิต (ยกมา, เปลี่ยนแปลง, ยกไป) — ระบบจะใช้คู่สุดท้ายอัตโนมัติ
                  </p>
                </div>
              </CardHeader>
              <CardContent>
                {excelRows.length > 0 ? (
                  <>
                    <div className="overflow-auto max-h-[500px]">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-white z-10">
                          <tr className="border-b">
                            <th className="text-left p-2 w-10">#</th>
                            <th className="text-left p-2">จาก Excel</th>
                            <th className="text-center p-2 w-10">→</th>
                            <th className="text-left p-2">บัญชีในระบบ</th>
                            <th className="text-right p-2 w-32">เดบิต</th>
                            <th className="text-right p-2 w-32">เครดิต</th>
                          </tr>
                        </thead>
                        <tbody>
                          {excelRows.map((r, idx) => (
                            <tr key={idx} className={`border-b ${r.matchStatus === "unmatched" ? "bg-red-50" : r.matchStatus === "fuzzy" ? "bg-amber-50" : "hover:bg-slate-50"}`} data-testid={`excel-row-${idx}`}>
                              <td className="p-2 text-xs text-muted-foreground">{idx + 1}</td>
                              <td className="p-2">
                                <div className="font-mono text-xs text-muted-foreground">{r.excelCode}</div>
                                <div className="text-sm">{r.excelName}</div>
                              </td>
                              <td className="p-2 text-center">
                                {r.matchStatus === "exact" && <Check className="h-4 w-4 text-green-500 mx-auto" />}
                                {r.matchStatus === "fuzzy" && <AlertTriangle className="h-4 w-4 text-amber-500 mx-auto" />}
                                {r.matchStatus === "unmatched" && <X className="h-4 w-4 text-red-400 mx-auto" />}
                              </td>
                              <td className="p-2">
                                {r.matchedAccountId ? (
                                  <div>
                                    <div className="font-mono text-xs text-muted-foreground">{r.matchedCode}</div>
                                    <div className="text-sm">{r.matchedName}</div>
                                  </div>
                                ) : (
                                  <span className="text-xs text-red-500">ยังไม่ได้จับคู่</span>
                                )}
                              </td>
                              <td className="p-2 text-right font-mono">{r.debit > 0 ? fmt(r.debit) : "-"}</td>
                              <td className="p-2 text-right font-mono">{r.credit > 0 ? fmt(r.credit) : "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="sticky bottom-0 bg-white">
                          <tr className="font-bold border-t-2">
                            <td colSpan={4} className="p-2">
                              รวม ({excelMapped.length}/{excelRows.length} รายการ)
                              {unmatchedRows.length > 0 && (
                                <span className="ml-2 text-xs font-normal text-amber-600">
                                  ⚠ {unmatchedRows.length} รายการยังไม่ได้จับคู่
                                </span>
                              )}
                            </td>
                            <td className="p-2 text-right">{fmt(excelTotalDebit)}</td>
                            <td className="p-2 text-right">{fmt(excelTotalCredit)}</td>
                          </tr>
                          {excelDiff > 0.02 && (
                            <tr className="text-red-600">
                              <td colSpan={4} className="p-2">ผลต่าง</td>
                              <td colSpan={2} className="p-2 text-right font-bold">{fmt(excelTotalDebit - excelTotalCredit)}</td>
                            </tr>
                          )}
                        </tfoot>
                      </table>
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Check className="h-3 w-3 text-green-500" /> ตรงกัน</span>
                        <span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-amber-500" /> คล้ายกัน</span>
                        <span className="flex items-center gap-1"><X className="h-3 w-3 text-red-400" /> ไม่พบ</span>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => { setExcelRows([]); }} data-testid="btn-clear-excel">
                          ล้างข้อมูล
                        </Button>
                        <Button
                          onClick={() => setShowConfirmDialog(true)}
                          disabled={excelMapped.length === 0}
                          className="bg-[#03c9d7] hover:bg-[#02b0bc]"
                          data-testid="btn-excel-confirm"
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          ยืนยันนำเข้า ({excelMapped.length} รายการ)
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 opacity-40" />
                    <p className="text-base">กดปุ่ม "เลือกไฟล์ Excel" เพื่อนำเข้างบทดลอง</p>
                    <p className="text-xs mt-2">รองรับไฟล์ .xlsx, .xls, .csv<br />ระบบจะจับคู่รหัสบัญชีและชื่อบัญชีให้อัตโนมัติ</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: คำนวณจากระบบ */}
          <TabsContent value="auto">
            <Card>
              <CardHeader>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    สำหรับกิจการที่ใช้โปรแกรมอยู่แล้ว ระบบจะคำนวณยอดคงเหลือจากข้อมูลบัญชีที่มีในระบบอัตโนมัติ
                  </p>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium">ยกยอดจากปี</span>
                    <Select value={fromYear} onValueChange={setFromYear}>
                      <SelectTrigger className="w-40" data-testid="select-from-year"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 5 }, (_, i) => currentYear - i).map(y => (
                          <SelectItem key={y} value={String(y)}>{y + 543}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-sm">→ ปี {Number(fromYear) + 544}</span>
                    <Button onClick={() => refetch()} disabled={isLoading} data-testid="btn-preview">
                      {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null} ดูตัวอย่าง
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {data?.balances?.length > 0 ? (
                  <>
                    <div className="overflow-auto max-h-[500px]">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-white">
                          <tr className="border-b">
                            <th className="text-left p-2">รหัส</th>
                            <th className="text-left p-2">ชื่อบัญชี</th>
                            <th className="text-right p-2">เดบิต</th>
                            <th className="text-right p-2">เครดิต</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.balances.map((b: any) => (
                            <tr key={b.accountId} className="border-b hover:bg-slate-50">
                              <td className="p-2 font-mono">{b.code}</td>
                              <td className="p-2">{b.name}</td>
                              <td className="p-2 text-right">{b.debit > 0 ? fmt(b.debit) : "-"}</td>
                              <td className="p-2 text-right">{b.credit > 0 ? fmt(b.credit) : "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="font-bold border-t-2">
                            <td colSpan={2} className="p-2">รวม ({data.totalAccounts} บัญชี)</td>
                            <td className="p-2 text-right">{fmt(data.balances.reduce((s: number, b: any) => s + b.debit, 0))}</td>
                            <td className="p-2 text-right">{fmt(data.balances.reduce((s: number, b: any) => s + b.credit, 0))}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    <div className="mt-4 flex justify-end">
                      <Button onClick={() => executeMutation.mutate()} disabled={executeMutation.isPending} className="bg-[#03c9d7] hover:bg-[#02b0bc]" data-testid="btn-execute">
                        {executeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                        ยืนยันยกยอด
                      </Button>
                    </div>
                  </>
                ) : data ? (
                  <p className="text-center text-muted-foreground py-8">ไม่พบยอดคงเหลือที่ต้องยกไป</p>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Mapping Dialog */}
      <Dialog open={showMappingDialog} onOpenChange={setShowMappingDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              จับคู่บัญชี — มี {unmatchedRows.length} รายการที่ต้องตรวจสอบ
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            รายการด้านล่างไม่สามารถจับคู่อัตโนมัติได้ กรุณาเลือกบัญชีที่ถูกต้องจากผังบัญชีของบริษัท หรือข้ามรายการที่ไม่ต้องการนำเข้า
          </p>
          <div className="flex-1 overflow-auto space-y-3 pr-1">
            {excelRows.map((row, idx) => {
              if (row.matchStatus === "exact") return null;
              const filtered = getFilteredAccounts(idx);
              return (
                <div key={idx} className={`border rounded-lg p-3 ${row.matchStatus === "unmatched" ? "border-red-200 bg-red-50/50" : "border-amber-200 bg-amber-50/50"}`} data-testid={`mapping-row-${idx}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{row.excelCode}</span>
                        <span className="text-sm font-medium">{row.excelName}</span>
                        <span className="text-xs text-muted-foreground ml-auto">
                          Dr {fmt(row.debit)} / Cr {fmt(row.credit)}
                        </span>
                      </div>
                      {row.matchedAccountId && (
                        <div className="flex items-center gap-1 text-xs text-amber-700 mb-1">
                          → คล้าย: {row.matchedCode} {row.matchedName}
                          <button onClick={() => updateMapping(idx, { id: row.matchedAccountId, code: row.matchedCode, name: row.matchedName, nameTh: row.matchedName })} className="ml-1 text-green-600 hover:underline" data-testid={`btn-accept-fuzzy-${idx}`}>ยืนยัน</button>
                          <button onClick={() => clearMapping(idx)} className="ml-1 text-red-500 hover:underline" data-testid={`btn-reject-fuzzy-${idx}`}>ไม่ใช่</button>
                        </div>
                      )}
                      <div className="relative">
                        <Search className="h-3.5 w-3.5 absolute left-2 top-2 text-muted-foreground" />
                        <Input
                          placeholder="ค้นหารหัสหรือชื่อบัญชี..."
                          className="h-8 text-sm pl-7"
                          value={mappingSearch[idx] || ""}
                          onChange={e => setMappingSearch(prev => ({ ...prev, [idx]: e.target.value }))}
                          data-testid={`input-mapping-search-${idx}`}
                        />
                      </div>
                      {(mappingSearch[idx] || "").length > 0 && (
                        <div className="mt-1 max-h-32 overflow-auto border rounded bg-white">
                          {filtered.length > 0 ? filtered.map((a: any) => (
                            <button
                              key={a.id}
                              className="w-full text-left px-2 py-1.5 text-sm hover:bg-slate-100 flex items-center gap-2 border-b last:border-b-0"
                              onClick={() => {
                                updateMapping(idx, a);
                                setMappingSearch(prev => ({ ...prev, [idx]: "" }));
                              }}
                              data-testid={`btn-select-account-${a.code}`}
                            >
                              <span className="font-mono text-xs text-muted-foreground w-20 shrink-0">{a.code}</span>
                              <span>{acctName(a)}</span>
                            </button>
                          )) : (
                            <div className="px-2 py-2 text-xs text-muted-foreground">ไม่พบบัญชี</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMappingDialog(false)}>
              ปิด
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-[#03c9d7]" />
              ยืนยันนำเข้ายอดยกมา — ณ 31/12/{Number(excelYear) + 543}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            ระบบจะสร้าง Journal Entry ยกยอดจำนวน {excelMapped.length} รายการ กรุณาตรวจสอบความถูกต้องก่อนยืนยัน
          </p>
          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white z-10">
                <tr className="border-b">
                  <th className="text-left p-2">รหัส</th>
                  <th className="text-left p-2">ชื่อบัญชี</th>
                  <th className="text-right p-2 w-32">เดบิต</th>
                  <th className="text-right p-2 w-32">เครดิต</th>
                </tr>
              </thead>
              <tbody>
                {excelMapped.map((r, i) => (
                  <tr key={i} className="border-b">
                    <td className="p-2 font-mono text-xs">{r.matchedCode}</td>
                    <td className="p-2">{r.matchedName}</td>
                    <td className="p-2 text-right font-mono">{r.debit > 0 ? fmt(r.debit) : "-"}</td>
                    <td className="p-2 text-right font-mono">{r.credit > 0 ? fmt(r.credit) : "-"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="sticky bottom-0 bg-white">
                <tr className="font-bold border-t-2">
                  <td colSpan={2} className="p-2">รวม</td>
                  <td className="p-2 text-right">{fmt(excelTotalDebit)}</td>
                  <td className="p-2 text-right">{fmt(excelTotalCredit)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          {excelDiff > 0.02 && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 rounded-lg p-3">
              <AlertTriangle className="h-4 w-4" />
              ยอดเดบิต-เครดิตไม่เท่ากัน ผลต่าง {fmt(excelTotalDebit - excelTotalCredit)} บาท
            </div>
          )}
          {unmatchedRows.length > 0 && (
            <div className="flex items-center gap-2 text-amber-600 text-sm bg-amber-50 rounded-lg p-3">
              <AlertTriangle className="h-4 w-4" />
              มี {unmatchedRows.length} รายการที่ยังไม่ได้จับคู่ (จะไม่ถูกนำเข้า)
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              ยกเลิก
            </Button>
            <Button
              onClick={() => excelExecuteMutation.mutate()}
              disabled={excelExecuteMutation.isPending || excelDiff > 0.02 || excelMapped.length === 0}
              className="bg-[#03c9d7] hover:bg-[#02b0bc]"
              data-testid="btn-excel-execute"
            >
              {excelExecuteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
              ยืนยันบันทึกยอดยกมา
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
