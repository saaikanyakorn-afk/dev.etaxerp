import { useState, useRef, useMemo } from "react";
import Layout from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/use-language";
import { useLocation } from "wouter";
import * as XLSX from "xlsx";
import { getAccountName, type SupportedLanguage } from "@shared/i18n";
import {
  ArrowLeft, Upload, FileSpreadsheet, Download, Printer,
  ArrowUp, ArrowDown, Search, Check, AlertTriangle, X, TrendingUp, Scale
} from "lucide-react";

function fmt(val: number): string {
  if (val === 0) return "-";
  return val.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function pctFmt(val: number): string {
  if (!isFinite(val) || val === 0) return "-";
  return val.toFixed(1) + "%";
}
function currentLang(): SupportedLanguage { return (localStorage.getItem("app-language") as SupportedLanguage) || "th"; }
function normalizeStr(s: string) { return s.replace(/\s+/g, " ").trim().toLowerCase(); }

type ImportedRow = {
  excelCode: string;
  excelName: string;
  debit: number;
  credit: number;
  matchedAccountId: number | null;
  matchedCode: string;
  matchedName: string;
  matchStatus: "exact" | "fuzzy" | "unmatched";
};

function matchAccount(code: string, name: string, accounts: any[]): { accountId: number | null; code: string; name: string; status: "exact" | "fuzzy" | "unmatched" } {
  const cleanCode = code?.toString().trim();
  const cleanName = normalizeStr(name || "");
  if (cleanCode) {
    const byCode = accounts.find((a: any) => a.code === cleanCode);
    if (byCode) return { accountId: byCode.id, code: byCode.code, name: getAccountName(byCode, currentLang()), status: "exact" };
  }
  if (cleanName) {
    const byNameTh = accounts.find((a: any) => normalizeStr(a.nameTh || "") === cleanName);
    if (byNameTh) return { accountId: byNameTh.id, code: byNameTh.code, name: getAccountName(byNameTh, currentLang()), status: "exact" };
    const byNameEn = accounts.find((a: any) => normalizeStr(a.name || "") === cleanName);
    if (byNameEn) return { accountId: byNameEn.id, code: byNameEn.code, name: getAccountName(byNameEn, currentLang()), status: "exact" };
    const fuzzy = accounts.find((a: any) => {
      const th = normalizeStr(a.nameTh || "");
      const en = normalizeStr(a.name || "");
      return (th && (th.includes(cleanName) || cleanName.includes(th))) || (en && (en.includes(cleanName) || cleanName.includes(en)));
    });
    if (fuzzy) return { accountId: fuzzy.id, code: fuzzy.code, name: getAccountName(fuzzy, currentLang()), status: "fuzzy" };
  }
  return { accountId: null, code: "", name: "", status: "unmatched" };
}

function parseExcelFile(file: File, accounts: any[]): Promise<ImportedRow[]> {
  return new Promise((resolve, reject) => {
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
            if (cell.includes("รหัส") || cell.includes("code") || cell === "เลขที่") { codeCol = j; headerIdx = i; }
            if (cell.includes("ชื่อบัญชี") || cell.includes("account") || cell.includes("name") || cell.includes("รายการ")) { nameCol = j; headerIdx = i; }
            if (cell.includes("เดบิต") || cell.includes("debit") || cell.includes("dr")) { allDebitCols.push(j); headerIdx = i; }
            if (cell.includes("เครดิต") || cell.includes("credit") || cell.includes("cr")) { allCreditCols.push(j); headerIdx = i; }
          }
          if (codeCol >= 0 && allDebitCols.length > 0) {
            debitCol = allDebitCols[allDebitCols.length - 1];
            creditCol = allCreditCols.length > 0 ? allCreditCols[allCreditCols.length - 1] : -1;
            break;
          }
        }

        if (headerIdx < 0 || (codeCol < 0 && nameCol < 0) || (debitCol < 0 && creditCol < 0)) {
          reject(new Error("ไม่สามารถอ่านไฟล์ได้ — กรุณาตรวจสอบว่ามีคอลัมน์: รหัสบัญชี, ชื่อบัญชี, เดบิต, เครดิต"));
          return;
        }

        const rows: ImportedRow[] = [];
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
          const match = matchAccount(rawCode, rawName, accounts);
          rows.push({ excelCode: rawCode, excelName: rawName, debit: rawDebit, credit: rawCredit, matchedAccountId: match.accountId, matchedCode: match.code, matchedName: match.name, matchStatus: match.status });
        }
        if (rows.length === 0) { reject(new Error("ไม่พบรายการบัญชีที่มียอดในไฟล์")); return; }
        resolve(rows);
      } catch { reject(new Error("ไม่สามารถอ่านไฟล์ได้ กรุณาตรวจสอบรูปแบบ")); }
    };
    reader.readAsBinaryString(file);
  });
}

interface CompareRow {
  code: string;
  name: string;
  period1: number;
  period2: number;
  change: number;
  changePct: number;
}

interface TotalRow { period1: number; period2: number; change: number; changePct: number; }

function calcBalance(row: ImportedRow, type: string): number {
  if (type === "asset" || type === "expense") return row.debit - row.credit;
  return row.credit - row.debit;
}

export default function TrialBalanceCompare() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { acctName } = useLanguage();
  const currentYear = new Date().getFullYear();

  const [year1, setYear1] = useState(String(currentYear));
  const [year2, setYear2] = useState(String(currentYear - 1));
  const [rows1, setRows1] = useState<ImportedRow[]>([]);
  const [rows2, setRows2] = useState<ImportedRow[]>([]);
  const [activeTab, setActiveTab] = useState("import");

  const [mappingTarget, setMappingTarget] = useState<1 | 2 | null>(null);
  const [mappingSearch, setMappingSearch] = useState<Record<number, string>>({});

  const fileRef1 = useRef<HTMLInputElement>(null);
  const fileRef2 = useRef<HTMLInputElement>(null);

  const { data: allAccounts } = useQuery<any[]>({
    queryKey: ["/api/accounts", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/accounts?companyId=${companyId}`, { credentials: "include" });
      return res.json();
    },
    enabled: !!companyId,
  });
  const detailAccounts = (allAccounts || []).filter((a: any) => a.active && !a.isHeader);

  const handleUpload = async (target: 1 | 2, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !detailAccounts.length) return;
    try {
      const parsed = await parseExcelFile(file, detailAccounts);
      if (target === 1) setRows1(parsed); else setRows2(parsed);
      const unmatched = parsed.filter(r => r.matchStatus !== "exact").length;
      toast({ title: `อ่านไฟล์ปี ${target === 1 ? year1 : year2} สำเร็จ`, description: `พบ ${parsed.length} รายการ${unmatched > 0 ? ` (ต้องจับคู่เพิ่ม ${unmatched} รายการ)` : ""}` });
      if (unmatched > 0) setMappingTarget(target);
    } catch (err: any) {
      toast({ title: "ผิดพลาด", description: err.message, variant: "destructive" });
    }
    if (target === 1 && fileRef1.current) fileRef1.current.value = "";
    if (target === 2 && fileRef2.current) fileRef2.current.value = "";
  };

  const updateMapping = (target: 1 | 2, idx: number, account: any) => {
    const setter = target === 1 ? setRows1 : setRows2;
    setter(prev => prev.map((r, i) => i === idx ? { ...r, matchedAccountId: account.id, matchedCode: account.code, matchedName: acctName(account), matchStatus: "exact" as const } : r));
  };

  const accountTypeMap = useMemo(() => {
    const m: Record<string, string> = {};
    (allAccounts || []).forEach((a: any) => { if (a.code) m[a.code] = a.type || "other"; });
    return m;
  }, [allAccounts]);

  function getAccountType(code: string): string {
    if (accountTypeMap[code]) return accountTypeMap[code];
    const c = code.charAt(0);
    if (c === "1") return "asset";
    if (c === "2") return "liability";
    if (c === "3") return "equity";
    if (c === "4") return "revenue";
    if (c === "5") return "expense";
    return "other";
  }

  const hasUnmatched1 = rows1.some(r => r.matchStatus !== "exact");
  const hasUnmatched2 = rows2.some(r => r.matchStatus !== "exact");
  const hasUnmatched = hasUnmatched1 || hasUnmatched2;

  const comparativeData = useMemo(() => {
    if (!rows1.length || !rows2.length) return null;

    const matched1 = rows1.filter(r => r.matchedCode);
    const matched2 = rows2.filter(r => r.matchedCode);
    const allCodes = Array.from(new Set([...matched1.map(r => r.matchedCode), ...matched2.map(r => r.matchedCode)])).sort();

    const buildRows = (codes: string[], typeFilter: string[]): CompareRow[] => {
      return codes
        .filter(code => typeFilter.includes(getAccountType(code)))
        .map(code => {
          const r1 = matched1.find(r => r.matchedCode === code);
          const r2 = matched2.find(r => r.matchedCode === code);
          const type = getAccountType(code);
          const p1 = r1 ? calcBalance(r1, type) : 0;
          const p2 = r2 ? calcBalance(r2, type) : 0;
          const change = p1 - p2;
          const changePct = p2 !== 0 ? (change / Math.abs(p2)) * 100 : 0;
          const name = r1?.matchedName || r2?.matchedName || code;
          return { code, name, period1: p1, period2: p2, change, changePct };
        })
        .filter(r => r.period1 !== 0 || r.period2 !== 0);
    };

    const calcTotal = (rows: CompareRow[]): TotalRow => {
      const p1 = rows.reduce((s, r) => s + r.period1, 0);
      const p2 = rows.reduce((s, r) => s + r.period2, 0);
      const change = p1 - p2;
      const changePct = p2 !== 0 ? (change / Math.abs(p2)) * 100 : 0;
      return { period1: p1, period2: p2, change, changePct };
    };

    const revenues = buildRows(allCodes, ["revenue"]);
    const expenses = buildRows(allCodes, ["expense"]);
    const totalRevenue = calcTotal(revenues);
    const totalExpense = calcTotal(expenses);
    const netP1 = totalRevenue.period1 - totalExpense.period1;
    const netP2 = totalRevenue.period2 - totalExpense.period2;
    const netChange = netP1 - netP2;
    const netIncome: TotalRow = { period1: netP1, period2: netP2, change: netChange, changePct: netP2 !== 0 ? (netChange / Math.abs(netP2)) * 100 : 0 };

    const assets = buildRows(allCodes, ["asset"]);
    const liabilities = buildRows(allCodes, ["liability"]);
    const equity = buildRows(allCodes, ["equity"]);
    const totalAssets = calcTotal(assets);
    const totalLiabilities = calcTotal(liabilities);
    const totalEquity = calcTotal(equity);

    const unmatchedDr1 = rows1.filter(r => !r.matchedCode).reduce((s, r) => s + r.debit, 0);
    const unmatchedCr1 = rows1.filter(r => !r.matchedCode).reduce((s, r) => s + r.credit, 0);
    const unmatchedDr2 = rows2.filter(r => !r.matchedCode).reduce((s, r) => s + r.debit, 0);
    const unmatchedCr2 = rows2.filter(r => !r.matchedCode).reduce((s, r) => s + r.credit, 0);
    const unmatchedTotal = unmatchedDr1 + unmatchedCr1 + unmatchedDr2 + unmatchedCr2;

    return { revenues, expenses, totalRevenue, totalExpense, netIncome, assets, liabilities, equity, totalAssets, totalLiabilities, totalEquity, unmatchedTotal };
  }, [rows1, rows2, accountTypeMap]);

  const canGenerate = rows1.length > 0 && rows2.length > 0 && !hasUnmatched;

  const renderChangeIcon = (val: number) => {
    if (val > 0) return <ArrowUp className="h-3 w-3 text-green-500 inline" />;
    if (val < 0) return <ArrowDown className="h-3 w-3 text-red-500 inline" />;
    return null;
  };

  const renderRow = (row: CompareRow) => (
    <TableRow key={row.code}>
      <TableCell className="text-xs font-mono text-gray-400">{row.code}</TableCell>
      <TableCell className="text-sm">{row.name}</TableCell>
      <TableCell className="text-right font-mono text-sm">{fmt(row.period1)}</TableCell>
      <TableCell className="text-right font-mono text-sm">{fmt(row.period2)}</TableCell>
      <TableCell className={`text-right font-mono text-sm ${row.change > 0 ? "text-green-600" : row.change < 0 ? "text-red-500" : ""}`}>
        {renderChangeIcon(row.change)} {fmt(row.change)}
      </TableCell>
      <TableCell className={`text-right font-mono text-sm ${row.changePct > 0 ? "text-green-600" : row.changePct < 0 ? "text-red-500" : ""}`}>
        {pctFmt(row.changePct)}
      </TableCell>
    </TableRow>
  );

  const renderTotalRow = (label: string, total: TotalRow, bold = false) => (
    <TableRow className={bold ? "bg-gray-100 font-bold" : "bg-gray-50 font-semibold"}>
      <TableCell></TableCell>
      <TableCell className="text-sm">{label}</TableCell>
      <TableCell className="text-right font-mono text-sm">{fmt(total.period1)}</TableCell>
      <TableCell className="text-right font-mono text-sm">{fmt(total.period2)}</TableCell>
      <TableCell className={`text-right font-mono text-sm ${total.change > 0 ? "text-green-600" : total.change < 0 ? "text-red-500" : ""}`}>
        {renderChangeIcon(total.change)} {fmt(total.change)}
      </TableCell>
      <TableCell className={`text-right font-mono text-sm ${total.changePct > 0 ? "text-green-600" : total.changePct < 0 ? "text-red-500" : ""}`}>
        {pctFmt(total.changePct)}
      </TableCell>
    </TableRow>
  );

  const exportExcel = (type: "income" | "balance") => {
    if (!comparativeData) return;
    const XLSXM = XLSX;
    const sheetRows: any[][] = [];

    if (type === "income") {
      sheetRows.push(["รหัส", "รายการ", `ปี ${year1}`, `ปี ${year2}`, "ผลต่าง", "%"]);
      sheetRows.push(["", "รายได้", "", "", "", ""]);
      comparativeData.revenues.forEach(r => sheetRows.push([r.code, r.name, r.period1, r.period2, r.change, r.changePct]));
      sheetRows.push(["", "รวมรายได้", comparativeData.totalRevenue.period1, comparativeData.totalRevenue.period2, comparativeData.totalRevenue.change, comparativeData.totalRevenue.changePct]);
      sheetRows.push(["", "ค่าใช้จ่าย", "", "", "", ""]);
      comparativeData.expenses.forEach(r => sheetRows.push([r.code, r.name, r.period1, r.period2, r.change, r.changePct]));
      sheetRows.push(["", "รวมค่าใช้จ่าย", comparativeData.totalExpense.period1, comparativeData.totalExpense.period2, comparativeData.totalExpense.change, comparativeData.totalExpense.changePct]);
      sheetRows.push(["", "กำไร(ขาดทุน)สุทธิ", comparativeData.netIncome.period1, comparativeData.netIncome.period2, comparativeData.netIncome.change, comparativeData.netIncome.changePct]);
    } else {
      sheetRows.push(["รหัส", "รายการ", `ปี ${year1}`, `ปี ${year2}`, "ผลต่าง", "%"]);
      sheetRows.push(["", "สินทรัพย์", "", "", "", ""]);
      comparativeData.assets.forEach(r => sheetRows.push([r.code, r.name, r.period1, r.period2, r.change, r.changePct]));
      sheetRows.push(["", "รวมสินทรัพย์", comparativeData.totalAssets.period1, comparativeData.totalAssets.period2, comparativeData.totalAssets.change, comparativeData.totalAssets.changePct]);
      sheetRows.push(["", "หนี้สิน", "", "", "", ""]);
      comparativeData.liabilities.forEach(r => sheetRows.push([r.code, r.name, r.period1, r.period2, r.change, r.changePct]));
      sheetRows.push(["", "รวมหนี้สิน", comparativeData.totalLiabilities.period1, comparativeData.totalLiabilities.period2, comparativeData.totalLiabilities.change, comparativeData.totalLiabilities.changePct]);
      sheetRows.push(["", "ส่วนของผู้ถือหุ้น", "", "", "", ""]);
      comparativeData.equity.forEach(r => sheetRows.push([r.code, r.name, r.period1, r.period2, r.change, r.changePct]));
      sheetRows.push(["", "รวมส่วนของผู้ถือหุ้น", comparativeData.totalEquity.period1, comparativeData.totalEquity.period2, comparativeData.totalEquity.change, comparativeData.totalEquity.changePct]);
    }

    const ws = XLSXM.utils.aoa_to_sheet(sheetRows);
    ws["!cols"] = [{ wch: 10 }, { wch: 35 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 10 }];
    const wb = XLSXM.utils.book_new();
    const name = type === "income" ? "งบกำไรขาดทุนเปรียบเทียบ" : "งบแสดงฐานะการเงินเปรียบเทียบ";
    XLSXM.utils.book_append_sheet(wb, ws, name);
    XLSXM.writeFile(wb, `${name}_${year1}_vs_${year2}.xlsx`);
  };

  const mappingRows = mappingTarget === 1 ? rows1 : mappingTarget === 2 ? rows2 : [];
  const unmatchedRows = mappingRows.map((r, i) => ({ ...r, idx: i })).filter(r => r.matchStatus !== "exact");

  const years = Array.from({ length: 10 }, (_, i) => String(currentYear - i));

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/accounting-mgmt")} data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <FileSpreadsheet className="h-5 w-5 text-[var(--theme-primary)]" />
            <h1 className="text-xl font-bold text-gray-800" data-testid="text-page-title">นำเข้างบทดลองเปรียบเทียบ</h1>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-white border">
            <TabsTrigger value="import" className="text-sm" data-testid="tab-import">
              <Upload className="h-3.5 w-3.5 mr-1" /> นำเข้าข้อมูล
            </TabsTrigger>
            <TabsTrigger value="income" className="text-sm" disabled={!canGenerate} data-testid="tab-income">
              <TrendingUp className="h-3.5 w-3.5 mr-1" /> งบกำไรขาดทุน
            </TabsTrigger>
            <TabsTrigger value="balance" className="text-sm" disabled={!canGenerate} data-testid="tab-balance">
              <Scale className="h-3.5 w-3.5 mr-1" /> งบแสดงฐานะการเงิน
            </TabsTrigger>
          </TabsList>

          <TabsContent value="import" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[{ target: 1 as const, label: "ปีปัจจุบัน", year: year1, setYear: setYear1, rows: rows1, fileRef: fileRef1, color: "#03c9d7" },
                { target: 2 as const, label: "ปีเปรียบเทียบ", year: year2, setYear: setYear2, rows: rows2, fileRef: fileRef2, color: "#fb9678" }].map(cfg => (
                <Card key={cfg.target} className="border-0 shadow-md" data-testid={`card-import-year-${cfg.target}`}>
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full" style={{ background: cfg.color }} />
                      <h3 className="font-bold text-sm">{cfg.label}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">พ.ศ.</span>
                      <Select value={cfg.year} onValueChange={cfg.setYear}>
                        <SelectTrigger className="w-28 h-9 text-sm" data-testid={`select-year-${cfg.target}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {years.map(y => <SelectItem key={y} value={y}>{Number(y) + 543}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <input type="file" accept=".xlsx,.xls" ref={cfg.fileRef} className="hidden" onChange={(e) => handleUpload(cfg.target, e)} />
                    <Button variant="outline" className="w-full h-24 border-dashed border-2 flex-col gap-2 text-gray-400 hover:text-gray-600 hover:border-gray-400" onClick={() => cfg.fileRef.current?.click()} data-testid={`button-upload-${cfg.target}`}>
                      <Upload className="h-6 w-6" />
                      <span className="text-sm">อัพโหลดไฟล์งบทดลอง (Excel)</span>
                    </Button>
                    {cfg.rows.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-green-600 flex items-center gap-1">
                            <Check className="h-3.5 w-3.5" /> นำเข้า {cfg.rows.length} รายการ
                          </span>
                          {cfg.rows.some(r => r.matchStatus !== "exact") && (
                            <Button variant="link" size="sm" className="text-amber-600 text-xs h-auto p-0" onClick={() => setMappingTarget(cfg.target)} data-testid={`button-fix-mapping-${cfg.target}`}>
                              <AlertTriangle className="h-3 w-3 mr-1" /> จับคู่บัญชี ({cfg.rows.filter(r => r.matchStatus !== "exact").length})
                            </Button>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 space-y-0.5">
                          <div>เดบิตรวม: {fmt(cfg.rows.reduce((s, r) => s + r.debit, 0))}</div>
                          <div>เครดิตรวม: {fmt(cfg.rows.reduce((s, r) => s + r.credit, 0))}</div>
                        </div>
                        <Button variant="ghost" size="sm" className="text-xs text-red-400 h-auto p-0" onClick={() => cfg.target === 1 ? setRows1([]) : setRows2([])} data-testid={`button-clear-${cfg.target}`}>
                          <X className="h-3 w-3 mr-1" /> ล้างข้อมูล
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {rows1.length > 0 && rows2.length > 0 && (
              <div className="text-center space-y-3">
                {hasUnmatched && (
                  <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-sm text-amber-700" data-testid="warning-unmatched">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                    <span>กรุณาจับคู่บัญชีให้ครบทุกรายการก่อนดูรายงาน
                      {hasUnmatched1 && ` (ปี ${year1}: ${rows1.filter(r => r.matchStatus !== "exact").length} รายการ)`}
                      {hasUnmatched2 && ` (ปี ${year2}: ${rows2.filter(r => r.matchStatus !== "exact").length} รายการ)`}
                    </span>
                  </div>
                )}
                <div>
                  <Button className="bg-[var(--theme-primary)] hover:bg-[#4a6fd9] text-white px-8" onClick={() => setActiveTab("income")} disabled={!canGenerate} data-testid="button-view-reports">
                    <TrendingUp className="h-4 w-4 mr-2" /> ดูรายงานเปรียบเทียบ
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="income">
            {comparativeData && (
              <Card className="border-0 shadow-md">
                <CardContent className="p-0">
                  <div className="flex items-center justify-between px-4 pt-4">
                    <div />
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="border-green-400 text-green-600 hover:bg-green-50 text-xs" onClick={() => exportExcel("income")} data-testid="button-export-income">
                        <Download className="h-3.5 w-3.5 mr-1" /> Excel
                      </Button>
                      <Button variant="outline" size="sm" className="text-xs" onClick={() => window.print()} data-testid="button-print-income">
                        <Printer className="h-3.5 w-3.5 mr-1" /> พิมพ์
                      </Button>
                    </div>
                  </div>
                  <div className="text-center py-3">
                    <h2 className="text-lg font-bold">{selectedCompany?.name}</h2>
                    <p className="text-sm text-muted-foreground">งบกำไร/ขาดทุนเปรียบเทียบ</p>
                    <p className="text-xs text-gray-400">ปี พ.ศ. {Number(year1) + 543} เทียบกับ พ.ศ. {Number(year2) + 543}</p>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="w-[60px] text-xs">รหัส</TableHead>
                        <TableHead className="text-xs">รายการ</TableHead>
                        <TableHead className="text-right text-xs">ปี {Number(year1) + 543}</TableHead>
                        <TableHead className="text-right text-xs">ปี {Number(year2) + 543}</TableHead>
                        <TableHead className="text-right text-xs">ผลต่าง</TableHead>
                        <TableHead className="text-right text-xs">%</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow><TableCell colSpan={6} className="bg-[#03c9d7] text-white font-bold text-sm py-1">รายได้</TableCell></TableRow>
                      {comparativeData.revenues.map(renderRow)}
                      {renderTotalRow("รวมรายได้", comparativeData.totalRevenue)}
                      <TableRow><TableCell colSpan={6} className="bg-[#fb9678] text-white font-bold text-sm py-1">ค่าใช้จ่าย</TableCell></TableRow>
                      {comparativeData.expenses.map(renderRow)}
                      {renderTotalRow("รวมค่าใช้จ่าย", comparativeData.totalExpense)}
                      {renderTotalRow("กำไร(ขาดทุน)สุทธิ", comparativeData.netIncome, true)}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="balance">
            {comparativeData && (
              <Card className="border-0 shadow-md">
                <CardContent className="p-0">
                  <div className="flex items-center justify-between px-4 pt-4">
                    <div />
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="border-green-400 text-green-600 hover:bg-green-50 text-xs" onClick={() => exportExcel("balance")} data-testid="button-export-balance">
                        <Download className="h-3.5 w-3.5 mr-1" /> Excel
                      </Button>
                      <Button variant="outline" size="sm" className="text-xs" onClick={() => window.print()} data-testid="button-print-balance">
                        <Printer className="h-3.5 w-3.5 mr-1" /> พิมพ์
                      </Button>
                    </div>
                  </div>
                  <div className="text-center py-3">
                    <h2 className="text-lg font-bold">{selectedCompany?.name}</h2>
                    <p className="text-sm text-muted-foreground">งบแสดงฐานะทางการเงินเปรียบเทียบ</p>
                    <p className="text-xs text-gray-400">ปี พ.ศ. {Number(year1) + 543} เทียบกับ พ.ศ. {Number(year2) + 543}</p>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="w-[60px] text-xs">รหัส</TableHead>
                        <TableHead className="text-xs">รายการ</TableHead>
                        <TableHead className="text-right text-xs">ปี {Number(year1) + 543}</TableHead>
                        <TableHead className="text-right text-xs">ปี {Number(year2) + 543}</TableHead>
                        <TableHead className="text-right text-xs">ผลต่าง</TableHead>
                        <TableHead className="text-right text-xs">%</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow><TableCell colSpan={6} className="bg-[#03c9d7] text-white font-bold text-sm py-1">สินทรัพย์</TableCell></TableRow>
                      {comparativeData.assets.map(renderRow)}
                      {renderTotalRow("รวมสินทรัพย์", comparativeData.totalAssets)}
                      <TableRow><TableCell colSpan={6} className="bg-[#fb9678] text-white font-bold text-sm py-1">หนี้สิน</TableCell></TableRow>
                      {comparativeData.liabilities.map(renderRow)}
                      {renderTotalRow("รวมหนี้สิน", comparativeData.totalLiabilities)}
                      <TableRow><TableCell colSpan={6} className="bg-[#05b187] text-white font-bold text-sm py-1">ส่วนของผู้ถือหุ้น</TableCell></TableRow>
                      {comparativeData.equity.map(renderRow)}
                      {renderTotalRow("รวมส่วนของผู้ถือหุ้น", comparativeData.totalEquity)}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        <Dialog open={!!mappingTarget} onOpenChange={(open) => { if (!open) setMappingTarget(null); }}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base">จับคู่บัญชี — ปี {mappingTarget === 1 ? year1 : year2} ({unmatchedRows.length} รายการ)</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {unmatchedRows.map((row) => (
                <div key={row.idx} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-mono text-gray-400">{row.excelCode}</span>
                    <span>{row.excelName}</span>
                    <span className="text-xs text-gray-400 ml-auto">Dr {fmt(row.debit)} / Cr {fmt(row.credit)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Search className="h-3.5 w-3.5 text-gray-400" />
                    <Input
                      placeholder="ค้นหาบัญชี..."
                      className="h-8 text-xs"
                      value={mappingSearch[row.idx] || ""}
                      onChange={(e) => setMappingSearch(prev => ({ ...prev, [row.idx]: e.target.value }))}
                      data-testid={`input-mapping-search-${row.idx}`}
                    />
                  </div>
                  <div className="max-h-32 overflow-y-auto border rounded">
                    {detailAccounts
                      .filter((a: any) => {
                        const q = (mappingSearch[row.idx] || "").toLowerCase();
                        if (!q) return true;
                        return a.code.includes(q) || (a.nameTh || "").toLowerCase().includes(q) || (a.name || "").toLowerCase().includes(q);
                      })
                      .slice(0, 20)
                      .map((a: any) => (
                        <div
                          key={a.id}
                          className="px-2 py-1 text-xs hover:bg-blue-50 cursor-pointer flex items-center gap-2"
                          onClick={() => { updateMapping(mappingTarget!, row.idx, a); setMappingSearch(prev => ({ ...prev, [row.idx]: "" })); }}
                          data-testid={`mapping-option-${a.code}`}
                        >
                          <span className="font-mono text-gray-400 w-20">{a.code}</span>
                          <span>{acctName(a)}</span>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
              {unmatchedRows.length === 0 && (
                <div className="text-center py-8 text-green-600">
                  <Check className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-sm font-medium">จับคู่บัญชีครบทุกรายการแล้ว</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
