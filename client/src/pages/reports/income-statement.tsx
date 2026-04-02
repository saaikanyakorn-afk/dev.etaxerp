import { useState, useMemo, useEffect } from "react";
import ReportLayout from "@/components/report-layout";
import { useCompany } from "@/lib/company-context";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, Printer, RefreshCw, FileDown, Plus, Minus } from "lucide-react";
import * as XLSX from "xlsx";
import ThaiDateInput from "@/components/thai-date-input";
import { useLocation } from "wouter";
import { toLocalDateStr } from "@/lib/utils";
import { useLanguage } from "@/hooks/use-language";
import { useDateSettings } from "@/hooks/use-date-settings";

interface AccountLine {
  code: string;
  name: string;
  nameTh?: string;
  balance: number;
  totalDebit?: number;
  totalCredit?: number;
  accountType?: string;
}

interface IncomeStatementData {
  revenues: AccountLine[];
  expenses: AccountLine[];
  totalRevenue: number;
  totalExpense: number;
  netIncome: number;
  headerAccounts?: Record<string, { code: string; name: string; nameTh: string; parentCode: string | null }>;
}

type ViewMode = "basic" | "technical" | "simplify";

const THAI_MONTHS = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];

function fmt(val: number | string | null | undefined): string {
  const n = parseFloat(String(val || "0"));
  if (n === 0) return "-";
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pct(val: number, total: number): string {
  if (total === 0) return "0.00%";
  return (val / total * 100).toFixed(2) + "%";
}

function changePct(cur: number, prev: number): string {
  if (prev === 0 && cur === 0) return "0.00%";
  if (prev === 0) return cur > 0 ? "+100.00%" : "-100.00%";
  const change = ((cur - prev) / Math.abs(prev)) * 100;
  const sign = change >= 0 ? "+" : "";
  return `${sign}${change.toFixed(2)}%`;
}

function findParentHeader(code: string, headers: Record<string, any>): string {
  if (code.length <= 3) return code;
  const h3 = code.slice(0, 3);
  if (headers[h3]) return h3;
  for (let len = 3; len >= 1; len--) {
    const prefix = code.slice(0, len);
    if (headers[prefix]) return prefix;
  }
  return h3;
}

export default function IncomeStatement() {
  const [, navigate] = useLocation();
  const { selectedCompany } = useCompany();
  const { acctName } = useLanguage();
  const companyId = selectedCompany?.id;
  const [viewMode, setViewMode] = useState<ViewMode>("technical");

  const today = new Date();
  const [startDate, setStartDate] = useState(toLocalDateStr(new Date(today.getFullYear(), 0, 1)));
  const [endDate, setEndDate] = useState(toLocalDateStr(today));

  const [basicMonth, setBasicMonth] = useState(today.getMonth() + 1);
  const [basicYear, setBasicYear] = useState(today.getFullYear());

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [autoExpanded, setAutoExpanded] = useState(false);

  const { dateEra, dateFmt } = useDateSettings();

  const { data, isLoading, refetch } = useQuery<IncomeStatementData>({
    queryKey: ["/api/reports/income-statement", companyId, startDate, endDate],
    queryFn: async () => {
      const res = await fetch(
        `/api/reports/income-statement?companyId=${companyId}&startDate=${startDate}&endDate=${endDate}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to fetch income statement");
      return res.json();
    },
    enabled: !!companyId && !!startDate && !!endDate && viewMode !== "basic",
    placeholderData: keepPreviousData,
  });

  const basicStartDate = `${basicYear}-${String(basicMonth).padStart(2, "0")}-01`;
  const basicEndDate = `${basicYear}-${String(basicMonth).padStart(2, "0")}-${new Date(basicYear, basicMonth, 0).getDate()}`;
  const prevStartDate = `${basicYear - 1}-${String(basicMonth).padStart(2, "0")}-01`;
  const prevEndDate = `${basicYear - 1}-${String(basicMonth).padStart(2, "0")}-${new Date(basicYear - 1, basicMonth, 0).getDate()}`;

  const { data: curData, isLoading: isLoadingCur } = useQuery<IncomeStatementData>({
    queryKey: ["/api/reports/income-statement", companyId, basicStartDate, basicEndDate],
    queryFn: async () => {
      const res = await fetch(
        `/api/reports/income-statement?companyId=${companyId}&startDate=${basicStartDate}&endDate=${basicEndDate}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!companyId && viewMode === "basic",
    placeholderData: keepPreviousData,
  });

  const { data: prevData, isLoading: isLoadingPrev } = useQuery<IncomeStatementData>({
    queryKey: ["/api/reports/income-statement", companyId, prevStartDate, prevEndDate],
    queryFn: async () => {
      const res = await fetch(
        `/api/reports/income-statement?companyId=${companyId}&startDate=${prevStartDate}&endDate=${prevEndDate}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!companyId && viewMode === "basic",
    placeholderData: keepPreviousData,
  });

  const revenues = data?.revenues || [];
  const expenses = data?.expenses || [];
  const totalRevenue = data?.totalRevenue || 0;
  const totalExpense = data?.totalExpense || 0;
  const netIncome = data?.netIncome || 0;
  const headerAccounts = data?.headerAccounts || curData?.headerAccounts || {};

  const getGroupName = (code3: string, fallback?: string) => {
    const h = headerAccounts[code3];
    if (h) return h.nameTh || h.name;
    return fallback || `หมวด ${code3}`;
  };

  const toggleGroup = (code: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const expandAll = () => {
    const allCodes = new Set<string>();
    [...revenues, ...expenses].forEach(r => allCodes.add(findParentHeader(r.code, headerAccounts)));
    setExpandedGroups(allCodes);
  };

  const collapseAll = () => setExpandedGroups(new Set());

  const technicalTree = useMemo(() => {
    if (viewMode !== "technical") return { revenueGroups: [], expenseGroups: [] };

    const buildGroups = (items: AccountLine[]) => {
      const map = new Map<string, { headerCode: string; items: AccountLine[]; total: { debit: number; credit: number } }>();
      for (const item of items) {
        const hCode = findParentHeader(item.code, headerAccounts);
        if (!map.has(hCode)) {
          map.set(hCode, { headerCode: hCode, items: [], total: { debit: 0, credit: 0 } });
        }
        const g = map.get(hCode)!;
        g.items.push(item);
        g.total.debit += item.totalDebit || 0;
        g.total.credit += item.totalCredit || 0;
      }
      return Array.from(map.values()).sort((a, b) => a.headerCode.localeCompare(b.headerCode));
    };

    return {
      revenueGroups: buildGroups(revenues),
      expenseGroups: buildGroups(expenses),
    };
  }, [revenues, expenses, viewMode]);

  useEffect(() => {
    if (viewMode === "technical" && !autoExpanded && (technicalTree.revenueGroups.length > 0 || technicalTree.expenseGroups.length > 0)) {
      const allCodes = new Set<string>();
      [...technicalTree.revenueGroups, ...technicalTree.expenseGroups].forEach(g => allCodes.add(g.headerCode));
      setExpandedGroups(allCodes);
      setAutoExpanded(true);
    }
  }, [viewMode, technicalTree, autoExpanded]);

  const simplifyData = useMemo(() => {
    if (viewMode !== "simplify") return null;
    const costOfRevenue = expenses.filter(e => e.code.startsWith("51")).reduce((s, e) => s + e.balance, 0);
    const sgaExpenses = expenses.filter(e => e.code.startsWith("52") || e.code.startsWith("53") || e.code.startsWith("54")).reduce((s, e) => s + e.balance, 0);
    const depreciationAmort = expenses.filter(e => {
      const n = acctName(e).toLowerCase();
      return n.includes("เสื่อมราคา") || n.includes("depreciation") || n.includes("ตัดจำหน่าย") || n.includes("amortization");
    }).reduce((s, e) => s + e.balance, 0);
    const otherIncome = revenues.filter(r => r.code.startsWith("42")).reduce((s, r) => s + r.balance, 0);
    const salesRevenue = totalRevenue - otherIncome;
    const grossProfit = salesRevenue - costOfRevenue;
    const interestExp = expenses.filter(e => e.code.startsWith("59")).reduce((s, e) => s + e.balance, 0);
    const otherExp = expenses.filter(e => e.code.startsWith("58") || e.code.startsWith("57")).reduce((s, e) => s + e.balance, 0);
    const otherOpExp = totalExpense - costOfRevenue - sgaExpenses - interestExp - otherExp;
    const ebit = grossProfit - sgaExpenses - depreciationAmort - (otherOpExp > 0 ? otherOpExp : 0);
    const ebitda = ebit + depreciationAmort;
    const ebt = ebit + otherIncome - interestExp - otherExp;
    const incomeTax = expenses.filter(e => e.code.startsWith("56")).reduce((s, e) => s + e.balance, 0);

    return {
      salesRevenue, costOfRevenue, grossProfit,
      sgaExpenses, depreciationAmort, otherOpExp: otherOpExp > 0 ? otherOpExp : 0,
      ebit, ebitda, otherIncome, interestExp, otherExp, ebt, incomeTax, netIncome,
    };
  }, [revenues, expenses, totalRevenue, totalExpense, netIncome, viewMode, acctName]);

  const basicComparison = useMemo(() => {
    if (viewMode !== "basic" || !curData) return null;
    const cur = curData;
    const prev = prevData || { revenues: [], expenses: [], totalRevenue: 0, totalExpense: 0, netIncome: 0 };

    const allCodes = new Set<string>();
    [...cur.revenues, ...cur.expenses, ...prev.revenues, ...prev.expenses].forEach(r => allCodes.add(findParentHeader(r.code, headerAccounts)));

    const buildCompare = (curItems: AccountLine[], prevItems: AccountLine[]) => {
      const map = new Map<string, { headerCode: string; curItems: AccountLine[]; prevItems: AccountLine[]; curTotal: number; prevTotal: number }>();
      const process = (items: AccountLine[], key: "curItems" | "prevItems", totalKey: "curTotal" | "prevTotal") => {
        for (const item of items) {
          const hCode = findParentHeader(item.code, headerAccounts);
          if (!map.has(hCode)) map.set(hCode, { headerCode: hCode, curItems: [], prevItems: [], curTotal: 0, prevTotal: 0 });
          const g = map.get(hCode)!;
          g[key].push(item);
          g[totalKey] += item.balance;
        }
      };
      process(curItems, "curItems", "curTotal");
      process(prevItems, "prevItems", "prevTotal");
      return Array.from(map.values()).sort((a, b) => a.headerCode.localeCompare(b.headerCode));
    };

    return {
      revenueGroups: buildCompare(cur.revenues, prev.revenues),
      expenseGroups: buildCompare(cur.expenses, prev.expenses),
      curTotalRevenue: cur.totalRevenue,
      prevTotalRevenue: prev.totalRevenue,
      curTotalExpense: cur.totalExpense,
      prevTotalExpense: prev.totalExpense,
      curNetIncome: cur.netIncome,
      prevNetIncome: prev.netIncome,
    };
  }, [curData, prevData, viewMode]);

  const handleExcel = () => {
    const aoa: (string | number)[][] = [];
    if (viewMode === "simplify" && simplifyData) {
      aoa.push(["รายการ", "จำนวนเงิน", "%"]);
      const s = simplifyData;
      const lines = [
        ["ยอดขายสุทธิ", s.salesRevenue], ["ต้นทุนขาย (cost of revenue)", s.costOfRevenue],
        ["กำไรขั้นต้น", s.grossProfit], ["ค่าใช้จ่ายในขายและบริหาร (sga)", s.sgaExpenses],
        ["ค่าเสื่อมราคา & ค่าตัดจำหน่าย (da)", s.depreciationAmort],
        ["รายได้จากการดำเนินการ (EBIT)", s.ebit], ["EBITDA", s.ebitda],
        ["รายได้อื่น (other income)", s.otherIncome], ["ดอกเบี้ยจ่าย (interest exp)", s.interestExp],
        ["กำไรก่อนภาษี (EBT)", s.ebt], ["ภาษีเงินได้ (income tax)", s.incomeTax],
        ["กำไรสุทธิ", s.netIncome],
      ];
      lines.forEach(([label, val]) => aoa.push([label as string, val as number, s.salesRevenue ? ((val as number) / s.salesRevenue * 100).toFixed(2) + "%" : "0%"]));
    } else {
      aoa.push(["รหัสบัญชี", "ชื่อบัญชี", "จำนวนเงิน"]);
      aoa.push(["", "รายได้", ""]);
      revenues.forEach(r => aoa.push([r.code, acctName(r), r.balance]));
      aoa.push(["", "รวมรายได้", totalRevenue]);
      aoa.push([]);
      aoa.push(["", "ค่าใช้จ่าย", ""]);
      expenses.forEach(r => aoa.push([r.code, acctName(r), r.balance]));
      aoa.push(["", "รวมค่าใช้จ่าย", totalExpense]);
      aoa.push([]);
      aoa.push(["", "กำไร(ขาดทุน)สุทธิ", netIncome]);
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "งบกำไรขาดทุน");
    XLSX.writeFile(wb, "income-statement.xlsx");
  };

  const curYear = new Date().getFullYear();
  const yearOptions = [];
  for (let y = curYear - 3; y <= curYear + 1; y++) yearOptions.push(y);

  const isActive = viewMode === "basic" ? (isLoadingCur || isLoadingPrev) : isLoading;

  const renderTabs = () => (
    <div className="flex border-b mb-0">
      {([
        { key: "technical" as ViewMode, label: "TECHNICAL" },
        { key: "basic" as ViewMode, label: "BASIC" },
        { key: "simplify" as ViewMode, label: "SIMPLIFY" },
      ]).map(tab => (
        <button
          key={tab.key}
          onClick={() => setViewMode(tab.key)}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            viewMode === tab.key
              ? "border-[#fb9678] text-[#fb9678] bg-orange-50/50"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
          }`}
          data-testid={`tab-${tab.key}`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );

  const renderBasicView = () => {
    if (!basicComparison) return <div className="py-16 text-center text-muted-foreground">กำลังโหลด...</div>;
    const c = basicComparison;
    const curLabel = `${basicMonth}/${basicYear + 543}`;
    const prevLabel = `${basicMonth}/${basicYear - 1 + 543}`;

    const renderGroupRows = (groups: typeof c.revenueGroups, baseRevenue: number) => groups.map(g => {
      const isExpanded = expandedGroups.has(g.headerCode);
      return (
        <>{/* Group header */}
          <TableRow
            key={`h-${g.headerCode}`}
            className="bg-slate-50 hover:bg-slate-100 cursor-pointer border-b"
            onClick={() => toggleGroup(g.headerCode)}
          >
            <TableCell className="text-sm py-2 font-bold text-slate-700">
              <div className="flex items-center gap-1">
                {isExpanded ? <Minus className="h-3.5 w-3.5 text-slate-400" /> : <Plus className="h-3.5 w-3.5 text-slate-400" />}
                {g.headerCode}: {getGroupName(g.headerCode)}
              </div>
            </TableCell>
            <TableCell className="text-sm py-2 text-right tabular-nums font-bold">{fmt(g.curTotal)}</TableCell>
            <TableCell className="text-xs py-2 text-right tabular-nums text-slate-500">{baseRevenue ? pct(g.curTotal, baseRevenue) : "-"}</TableCell>
            <TableCell className="text-sm py-2 text-right tabular-nums font-bold">{fmt(g.prevTotal)}</TableCell>
            <TableCell className="text-xs py-2 text-right tabular-nums text-slate-500">{baseRevenue ? pct(g.prevTotal, baseRevenue) : "-"}</TableCell>
            <TableCell className={`text-xs py-2 text-right tabular-nums font-medium ${g.curTotal - g.prevTotal >= 0 ? "text-green-600" : "text-red-600"}`}>
              {changePct(g.curTotal, g.prevTotal)}
            </TableCell>
          </TableRow>
          {isExpanded && g.curItems.map((item, idx) => {
            const prevItem = g.prevItems.find(p => p.code === item.code);
            const prevBal = prevItem?.balance || 0;
            return (
              <TableRow key={item.code} className="border-b border-slate-100 hover:bg-blue-50/30 cursor-pointer" style={idx % 2 !== 0 ? { background: "var(--theme-table-stripe)" } : undefined}
                onClick={() => navigate(`/reports/general-ledger?accountCode=${item.code}&startDate=${basicStartDate}&endDate=${basicEndDate}`)}>
                <TableCell className="text-sm py-1.5 pl-10 text-slate-700">{item.code} : {acctName(item)}</TableCell>
                <TableCell className="text-sm py-1.5 text-right tabular-nums">{fmt(item.balance)}</TableCell>
                <TableCell className="text-xs py-1.5 text-right tabular-nums text-slate-400">{baseRevenue ? pct(item.balance, baseRevenue) : "-"}</TableCell>
                <TableCell className="text-sm py-1.5 text-right tabular-nums">{fmt(prevBal)}</TableCell>
                <TableCell className="text-xs py-1.5 text-right tabular-nums text-slate-400">{baseRevenue ? pct(prevBal, baseRevenue) : "-"}</TableCell>
                <TableCell className={`text-xs py-1.5 text-right tabular-nums ${item.balance - prevBal >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {item.balance !== 0 || prevBal !== 0 ? changePct(item.balance, prevBal) : "-"}
                </TableCell>
              </TableRow>
            );
          })}
        </>
      );
    });

    return (
      <Table className="border-collapse">
        <TableHeader>
          <TableRow className="hover:bg-transparent" style={{ background: "var(--theme-table-header)" }}>
            <TableHead className="text-sm font-bold text-white border-r border-white/20 min-w-[250px]">รหัสบัญชี - ชื่อบัญชี</TableHead>
            <TableHead className="text-sm font-bold text-white border-r border-white/20 text-center w-[120px]">{curLabel}</TableHead>
            <TableHead className="text-xs font-bold text-white border-r border-white/20 text-center w-[60px]">%</TableHead>
            <TableHead className="text-sm font-bold text-white border-r border-white/20 text-center w-[120px]">{prevLabel}</TableHead>
            <TableHead className="text-xs font-bold text-white border-r border-white/20 text-center w-[60px]">%</TableHead>
            <TableHead className="text-xs font-bold text-white text-center w-[80px]">+/-</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isActive ? (
            <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">กำลังโหลด...</TableCell></TableRow>
          ) : (
            <>
              <TableRow className="bg-slate-200"><TableCell colSpan={6} className="text-sm py-2 font-bold text-slate-700">รายได้</TableCell></TableRow>
              {renderGroupRows(c.revenueGroups, c.curTotalRevenue)}
              <TableRow className="bg-blue-50/70 font-bold border-t border-slate-300">
                <TableCell className="text-sm py-2 font-bold">รวม - รายได้ Baseline</TableCell>
                <TableCell className="text-sm py-2 text-right tabular-nums font-bold">{fmt(c.curTotalRevenue)}</TableCell>
                <TableCell className="text-xs py-2 text-right">100.00%</TableCell>
                <TableCell className="text-sm py-2 text-right tabular-nums font-bold">{fmt(c.prevTotalRevenue)}</TableCell>
                <TableCell className="text-xs py-2 text-right">100.00%</TableCell>
                <TableCell className={`text-xs py-2 text-right font-bold ${c.curTotalRevenue - c.prevTotalRevenue >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {changePct(c.curTotalRevenue, c.prevTotalRevenue)}
                </TableCell>
              </TableRow>

              <TableRow className="bg-slate-200 border-t-2"><TableCell colSpan={6} className="text-sm py-2 font-bold text-slate-700">ค่าใช้จ่าย</TableCell></TableRow>
              {renderGroupRows(c.expenseGroups, c.curTotalRevenue)}
              <TableRow className="bg-blue-50/70 font-bold border-t border-slate-300">
                <TableCell className="text-sm py-2 font-bold">รวม - ค่าใช้จ่าย</TableCell>
                <TableCell className="text-sm py-2 text-right tabular-nums font-bold">{fmt(c.curTotalExpense)}</TableCell>
                <TableCell className="text-xs py-2 text-right">{pct(c.curTotalExpense, c.curTotalRevenue)}</TableCell>
                <TableCell className="text-sm py-2 text-right tabular-nums font-bold">{fmt(c.prevTotalExpense)}</TableCell>
                <TableCell className="text-xs py-2 text-right">{pct(c.prevTotalExpense, c.prevTotalRevenue)}</TableCell>
                <TableCell className={`text-xs py-2 text-right font-bold ${c.curTotalExpense - c.prevTotalExpense >= 0 ? "text-red-600" : "text-green-600"}`}>
                  {changePct(c.curTotalExpense, c.prevTotalExpense)}
                </TableCell>
              </TableRow>

              <TableRow className="bg-slate-300 font-bold border-t-2 border-slate-500">
                <TableCell className="text-sm py-3 font-bold text-slate-900">กำไรสุทธิ</TableCell>
                <TableCell className={`text-sm py-3 text-right tabular-nums font-bold ${c.curNetIncome >= 0 ? "text-green-700" : "text-red-700"}`}>{fmt(c.curNetIncome)}</TableCell>
                <TableCell className="text-xs py-3 text-right">{pct(c.curNetIncome, c.curTotalRevenue)}</TableCell>
                <TableCell className={`text-sm py-3 text-right tabular-nums font-bold ${c.prevNetIncome >= 0 ? "text-green-700" : "text-red-700"}`}>{fmt(c.prevNetIncome)}</TableCell>
                <TableCell className="text-xs py-3 text-right">{pct(c.prevNetIncome, c.prevTotalRevenue)}</TableCell>
                <TableCell className={`text-xs py-3 text-right font-bold ${c.curNetIncome - c.prevNetIncome >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {changePct(c.curNetIncome, c.prevNetIncome)}
                </TableCell>
              </TableRow>
            </>
          )}
        </TableBody>
      </Table>
    );
  };

  const renderTechnicalView = () => {
    const { revenueGroups, expenseGroups } = technicalTree;
    const renderSection = (label: string, groups: typeof revenueGroups, sectionTotal: number) => (
      <>
        <TableRow className="bg-slate-200"><TableCell colSpan={5} className="text-sm py-2 font-bold">{label}</TableCell></TableRow>
        {groups.map(g => {
          const isExpanded = expandedGroups.has(g.headerCode);
          return (
            <>
              <TableRow key={`h-${g.headerCode}`} className="bg-slate-50 hover:bg-slate-100 cursor-pointer" onClick={() => toggleGroup(g.headerCode)}>
                <TableCell colSpan={2} className="text-sm py-2 font-semibold">
                  <div className="flex items-center gap-1 pl-4">
                    {isExpanded ? <Minus className="h-3 w-3 text-slate-400" /> : <Plus className="h-3 w-3 text-slate-400" />}
                    {getGroupName(g.headerCode)}
                  </div>
                </TableCell>
                <TableCell className="text-sm py-2 text-right tabular-nums font-bold">{fmt(g.total.debit)}</TableCell>
                <TableCell className="text-sm py-2 text-right tabular-nums font-bold">{fmt(g.total.credit)}</TableCell>
                <TableCell className="text-xs py-2 text-right tabular-nums text-slate-500">{totalRevenue ? pct(label === "รายได้" ? g.total.credit - g.total.debit : g.total.debit - g.total.credit, totalRevenue) : "-"}</TableCell>
              </TableRow>
              {isExpanded && g.items.map((item, idx) => (
                <TableRow key={item.code} className="border-b border-slate-100 hover:bg-blue-50/30 cursor-pointer"
                  style={idx % 2 !== 0 ? { background: "var(--theme-table-stripe)" } : undefined}
                  onClick={() => navigate(`/reports/general-ledger?accountCode=${item.code}&startDate=${startDate}&endDate=${endDate}`)}>
                  <TableCell className="text-sm py-1.5 pl-4 text-slate-500 w-[90px]">{item.code}</TableCell>
                  <TableCell className="text-sm py-1.5 text-slate-700">{acctName(item)}</TableCell>
                  <TableCell className="text-sm py-1.5 text-right tabular-nums">{fmt(item.totalDebit)}</TableCell>
                  <TableCell className="text-sm py-1.5 text-right tabular-nums">{fmt(item.totalCredit)}</TableCell>
                  <TableCell className="text-xs py-1.5 text-right tabular-nums text-slate-400">{totalRevenue ? pct(item.balance, totalRevenue) : "-"}</TableCell>
                </TableRow>
              ))}
              <TableRow className="border-b border-slate-200">
                <TableCell colSpan={2} className="text-sm py-1.5 text-right font-semibold pr-2">รวม - {getGroupName(g.headerCode)}</TableCell>
                <TableCell className="text-sm py-1.5 text-right tabular-nums font-semibold border-t border-slate-300">{fmt(g.total.debit)}</TableCell>
                <TableCell className="text-sm py-1.5 text-right tabular-nums font-semibold border-t border-slate-300">{fmt(g.total.credit)}</TableCell>
                <TableCell className="text-xs py-1.5 text-right tabular-nums font-semibold">{totalRevenue ? pct(label === "รายได้" ? g.total.credit - g.total.debit : g.total.debit - g.total.credit, totalRevenue) : "-"}</TableCell>
              </TableRow>
            </>
          );
        })}
        <TableRow className="bg-blue-50/70 font-bold border-t border-slate-300">
          <TableCell colSpan={2} className="text-sm py-2 font-bold">รวม - {label} Baseline</TableCell>
          <TableCell colSpan={2} className="text-sm py-2 text-right tabular-nums font-bold">{fmt(sectionTotal)}</TableCell>
          <TableCell className="text-xs py-2 text-right font-bold">{totalRevenue ? pct(sectionTotal, totalRevenue) : "100.00%"}</TableCell>
        </TableRow>
      </>
    );

    return (
      <Table className="border-collapse">
        <TableHeader>
          <TableRow className="hover:bg-transparent" style={{ background: "var(--theme-table-header)" }}>
            <TableHead className="text-sm font-bold text-white border-r border-white/20 w-[90px]">รหัสบัญชี</TableHead>
            <TableHead className="text-sm font-bold text-white border-r border-white/20 min-w-[180px]">ชื่อบัญชี</TableHead>
            <TableHead className="text-sm font-bold text-white border-r border-white/20 text-center w-[110px]">เดบิต</TableHead>
            <TableHead className="text-sm font-bold text-white border-r border-white/20 text-center w-[110px]">เครดิต</TableHead>
            <TableHead className="text-sm font-bold text-white text-center w-[70px]">%</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">กำลังโหลด...</TableCell></TableRow>
          ) : (
            <>
              {renderSection("รายได้", revenueGroups, totalRevenue)}
              {renderSection("ค่าใช้จ่าย", expenseGroups, totalExpense)}
              <TableRow className="bg-slate-300 font-bold border-t-2 border-slate-500">
                <TableCell colSpan={2} className="text-sm py-3 font-bold text-slate-900">กำไรสุทธิ</TableCell>
                <TableCell colSpan={2} className={`text-sm py-3 text-right tabular-nums font-bold ${netIncome >= 0 ? "text-green-700" : "text-red-700"}`}>{fmt(netIncome)}</TableCell>
                <TableCell className="text-xs py-3 text-right font-bold">{pct(netIncome, totalRevenue)}</TableCell>
              </TableRow>
            </>
          )}
        </TableBody>
      </Table>
    );
  };

  const renderSimplifyView = () => {
    if (!simplifyData && !isLoading) return <div className="py-16 text-center text-muted-foreground">ไม่พบข้อมูล</div>;
    if (isLoading) return <div className="py-16 text-center text-muted-foreground">กำลังโหลด...</div>;
    const s = simplifyData!;
    const base = s.salesRevenue || 1;

    const lines: { label: string; value: number; isBold?: boolean; isSection?: boolean; indent?: boolean; showExpandable?: boolean }[] = [
      { label: "ยอดขายสุทธิ", value: s.salesRevenue, isBold: true },
      { label: "ต้นทุนขาย (cost of revenue)", value: s.costOfRevenue, indent: true, showExpandable: true },
      { label: "กำไรขั้นต้น", value: s.grossProfit, isBold: true, isSection: true },
      { label: "ค่าใช้จ่ายในขายและบริหาร (sga)", value: s.sgaExpenses, indent: true, showExpandable: true },
      { label: "ค่าเสื่อมราคา & ค่าตัดจำหน่าย (da)", value: s.depreciationAmort, indent: true, showExpandable: true },
      { label: "ค่าใช้จ่ายในการดำเนินงานอื่นๆ (other ope)", value: s.otherOpExp, indent: true, showExpandable: true },
      { label: "รายได้จากการดำเนินการ (EBIT)", value: s.ebit, isBold: true, isSection: true },
      { label: "EBITDA", value: s.ebitda, isBold: true },
      { label: "รายได้อื่น (other income)", value: s.otherIncome, indent: true, showExpandable: true },
      { label: "ดอกเบี้ยจ่าย (interest exp)", value: s.interestExp, indent: true, showExpandable: true },
      { label: "รายจ่ายอื่น (other expense)", value: s.otherExp, indent: true, showExpandable: true },
      { label: "กำไรก่อนภาษี (EBT)", value: s.ebt, isBold: true, isSection: true },
      { label: "ภาษีเงินได้ (income tax)", value: s.incomeTax, indent: true, showExpandable: true },
      { label: "กำไรสุทธิ", value: s.netIncome, isBold: true, isSection: true },
    ];

    return (
      <Table className="border-collapse">
        <TableHeader>
          <TableRow className="hover:bg-transparent" style={{ background: "var(--theme-table-header)" }}>
            <TableHead className="text-sm font-bold text-white border-r border-white/20 min-w-[350px]">รายการ</TableHead>
            <TableHead className="text-sm font-bold text-white border-r border-white/20 text-center w-[140px]">จำนวนเงิน</TableHead>
            <TableHead className="text-sm font-bold text-white text-center w-[80px]">%</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.map((line, idx) => (
            <TableRow
              key={idx}
              className={`border-b ${line.isSection ? "bg-slate-100 border-t border-slate-300" : ""} ${line.label === "กำไรสุทธิ" ? "bg-slate-300 border-t-2 border-slate-500" : ""}`}
            >
              <TableCell className={`text-sm py-2.5 ${line.indent ? "pl-8" : ""} ${line.isBold ? "font-bold text-slate-900" : "text-slate-700"}`}>
                {line.showExpandable && <Plus className="h-3 w-3 inline mr-1 text-slate-400" />}
                {line.label}
              </TableCell>
              <TableCell className={`text-sm py-2.5 text-right tabular-nums ${line.isBold ? "font-bold" : ""} ${
                line.label === "กำไรสุทธิ" ? (line.value >= 0 ? "text-green-700" : "text-red-700") : ""
              }`}>
                {fmt(line.value)}
              </TableCell>
              <TableCell className="text-xs py-2.5 text-right tabular-nums text-slate-500">
                {pct(line.value, base)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  return (
    <ReportLayout title="งบกำไรขาดทุน (รายบัญชี)" icon={<TrendingUp className="h-5 w-5" />} showNavTabs>
      <div className="flex items-center justify-end flex-wrap gap-2 mb-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 border-green-400 text-green-600 hover:bg-green-50" onClick={() => refetch()} disabled={isActive} data-testid="button-generate">
            <RefreshCw className={`h-4 w-4 ${isActive ? "animate-spin" : ""}`} />
            สร้างรายงาน
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 border-blue-300 text-blue-600 hover:bg-blue-50" onClick={() => window.print()} data-testid="button-print">
            <Printer className="h-4 w-4" />
            พิมพ์
          </Button>
          <Button size="sm" className="h-8 gap-1.5 text-xs bg-[#05b187] text-white hover:bg-[#049a75] border-none" onClick={handleExcel} data-testid="button-excel">
            <FileDown className="h-4 w-4" />
            Excel
          </Button>
        </div>
      </div>

      <Card className="border shadow-sm">
        <CardContent className="p-0">
          {renderTabs()}

          <div className="p-4 border-b flex items-center gap-3 flex-wrap print:hidden">
            {viewMode === "basic" ? (
              <>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium whitespace-nowrap">เดือน</label>
                  <Select value={String(basicMonth)} onValueChange={v => setBasicMonth(Number(v))}>
                    <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {THAI_MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{i + 1} - {m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium whitespace-nowrap">ปี</label>
                  <Select value={String(basicYear)} onValueChange={v => setBasicYear(Number(v))}>
                    <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {yearOptions.map(y => <SelectItem key={y} value={String(y)}>{y + 543}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium whitespace-nowrap">วันที่เริ่มต้น</label>
                  <ThaiDateInput value={startDate} onChange={setStartDate} dateEra={dateEra} dateFmt={dateFmt} data-testid="input-start-date" />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium whitespace-nowrap">วันที่สิ้นสุด</label>
                  <ThaiDateInput value={endDate} onChange={setEndDate} dateEra={dateEra} dateFmt={dateFmt} data-testid="input-end-date" />
                </div>
              </>
            )}
            {(viewMode === "basic" || viewMode === "technical") && (
              <div className="flex items-center gap-2 ml-auto">
                <button onClick={expandAll} className="text-xs text-blue-600 hover:underline">+ Show All</button>
                <span className="text-slate-300">|</span>
                <button onClick={collapseAll} className="text-xs text-blue-600 hover:underline">- Hide All</button>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            {viewMode === "basic" && renderBasicView()}
            {viewMode === "technical" && renderTechnicalView()}
            {viewMode === "simplify" && renderSimplifyView()}
          </div>
        </CardContent>
      </Card>
    </ReportLayout>
  );
}
