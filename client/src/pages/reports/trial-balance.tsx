import React, { useState, useMemo } from "react";
import Layout from "@/components/layout";
import { Button } from "@/components/ui/button";
import ThaiDateInput from "@/components/thai-date-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { FileDown, FileSpreadsheet, Printer, RefreshCw, ChevronRight, ChevronDown } from "lucide-react";
import * as XLSX from "xlsx";
import { useLocation } from "wouter";
import { toLocalDateStr } from "@/lib/utils";
import { useDateSettings } from "@/hooks/use-date-settings";
import ReportNavTabs from "@/components/report-nav-tabs";

function fmt(val: string | number | null | undefined): string {
  const n = parseFloat(String(val || "0"));
  if (n === 0) return "-";
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtSigned(val: number | null | undefined): string {
  if (val === null || val === undefined || val === 0) return "";
  return val.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface TrialBalanceRow {
  accountCode: string;
  accountName: string;
  accountNameTh?: string;
  accountType?: string;
  openingDebit: number;
  openingCredit: number;
  movementDebit: number;
  movementCredit: number;
  closingDebit: number;
  closingCredit: number;
}

interface TrialBalanceTotals {
  openingDebit: number;
  openingCredit: number;
  movementDebit: number;
  movementCredit: number;
  closingDebit: number;
  closingCredit: number;
}

interface HeaderAccount {
  code: string;
  name: string;
  nameTh: string;
  parentCode: string | null;
}

interface TrialBalanceData {
  rows: TrialBalanceRow[];
  totals: TrialBalanceTotals;
  headerAccounts?: Record<string, HeaderAccount>;
}

interface TwelveMonthRow {
  accountCode: string;
  accountName: string;
  accountNameTh?: string;
  accountType?: string;
  months: (number | null)[];
}

type ViewMode = "tree" | "plain" | "12month";

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  asset: "สินทรัพย์",
  liability: "หนี้สิน",
  equity: "ส่วนของผู้ถือหุ้น",
  revenue: "รายได้",
  expense: "ค่าใช้จ่าย",
};

const ACCOUNT_TYPE_ORDER = ["asset", "liability", "equity", "revenue", "expense"];

const THAI_MONTHS_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

function findParentHeader(code: string, headers: Record<string, HeaderAccount>): string {
  if (code.length <= 3) return code;
  const h3 = code.slice(0, 3);
  if (headers[h3]) return h3;
  for (let len = 3; len >= 1; len--) {
    const prefix = code.slice(0, len);
    for (const [hCode] of Object.entries(headers)) {
      if (hCode === prefix) return hCode;
    }
  }
  return h3;
}

interface TreeNode {
  headerCode: string;
  headerName: string;
  level: number;
  children: TrialBalanceRow[];
  subGroups: TreeNode[];
  totals: TrialBalanceTotals;
}

export default function TrialBalance() {
  const [, navigate] = useLocation();
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const [viewMode, setViewMode] = useState<ViewMode>("tree");
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-01-01`;
  });
  const [endDate, setEndDate] = useState(() => {
    const now = new Date();
    return toLocalDateStr(now);
  });
  const [tbYear, setTbYear] = useState(() => new Date().getFullYear());
  const [collapsedHeaders, setCollapsedHeaders] = useState<Set<string>>(new Set());

  const { dateEra, dateFmt } = useDateSettings();

  const canFetch = !!companyId && !!startDate && !!endDate;

  const { data, isLoading, refetch } = useQuery<TrialBalanceData>({
    queryKey: ["/api/reports/trial-balance", companyId, startDate, endDate],
    queryFn: async () => {
      const res = await fetch(
        `/api/reports/trial-balance?companyId=${companyId}&startDate=${startDate}&endDate=${endDate}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to fetch trial balance");
      return res.json();
    },
    enabled: canFetch,
    placeholderData: keepPreviousData,
  });

  const { data: monthData, isLoading: isLoadingMonth } = useQuery<{ rows: TwelveMonthRow[]; year: number }>({
    queryKey: ["/api/reports/trial-balance-12month", companyId, tbYear],
    queryFn: async () => {
      const res = await fetch(
        `/api/reports/trial-balance-12month?companyId=${companyId}&year=${tbYear}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to fetch 12-month trial balance");
      return res.json();
    },
    enabled: !!companyId,
    placeholderData: keepPreviousData,
  });

  const rows = data?.rows || [];
  const totals = data?.totals;
  const headerAccounts = data?.headerAccounts || {};

  const treeData = useMemo(() => {
    if (viewMode !== "tree" || rows.length === 0) return [];
    const headers = headerAccounts;

    const nodeMap = new Map<string, TreeNode>();
    const rootNodes: TreeNode[] = [];

    for (const [code, h] of Object.entries(headers)) {
      nodeMap.set(code, {
        headerCode: code,
        headerName: h.nameTh || h.name,
        level: 1,
        children: [],
        subGroups: [],
        totals: { openingDebit: 0, openingCredit: 0, movementDebit: 0, movementCredit: 0, closingDebit: 0, closingCredit: 0 },
      });
    }

    for (const [code, h] of Object.entries(headers)) {
      const node = nodeMap.get(code)!;
      if (h.parentCode && nodeMap.has(h.parentCode)) {
        const parent = nodeMap.get(h.parentCode)!;
        parent.subGroups.push(node);
        node.level = parent.level + 1;
      } else {
        rootNodes.push(node);
      }
    }

    for (const row of rows) {
      const hCode = findParentHeader(row.accountCode, headers);
      const node = nodeMap.get(hCode);
      if (node) {
        node.children.push(row);
      } else {
        if (!nodeMap.has(hCode)) {
          const fallback: TreeNode = {
            headerCode: hCode,
            headerName: hCode,
            level: 1,
            children: [row],
            subGroups: [],
            totals: { openingDebit: 0, openingCredit: 0, movementDebit: 0, movementCredit: 0, closingDebit: 0, closingCredit: 0 },
          };
          nodeMap.set(hCode, fallback);
          rootNodes.push(fallback);
        } else {
          nodeMap.get(hCode)!.children.push(row);
        }
      }
    }

    const calcTotals = (node: TreeNode): TrialBalanceTotals => {
      const t = { openingDebit: 0, openingCredit: 0, movementDebit: 0, movementCredit: 0, closingDebit: 0, closingCredit: 0 };
      for (const r of node.children) {
        t.openingDebit += r.openingDebit; t.openingCredit += r.openingCredit;
        t.movementDebit += r.movementDebit; t.movementCredit += r.movementCredit;
        t.closingDebit += r.closingDebit; t.closingCredit += r.closingCredit;
      }
      for (const sub of node.subGroups) {
        const st = calcTotals(sub);
        t.openingDebit += st.openingDebit; t.openingCredit += st.openingCredit;
        t.movementDebit += st.movementDebit; t.movementCredit += st.movementCredit;
        t.closingDebit += st.closingDebit; t.closingCredit += st.closingCredit;
      }
      node.totals = t;
      return t;
    };

    rootNodes.forEach(n => {
      n.subGroups.sort((a, b) => a.headerCode.localeCompare(b.headerCode));
      calcTotals(n);
    });

    return rootNodes.filter(n => {
      const t = n.totals;
      return t.openingDebit || t.openingCredit || t.movementDebit || t.movementCredit || t.closingDebit || t.closingCredit;
    }).sort((a, b) => a.headerCode.localeCompare(b.headerCode));
  }, [rows, viewMode, headerAccounts]);

  const plainGrouped = useMemo(() => {
    if (viewMode !== "plain" || rows.length === 0) return [];
    const groups: { type: string; label: string; rows: TrialBalanceRow[]; totals: TrialBalanceTotals }[] = [];
    const calcGroupTotals = (gRows: TrialBalanceRow[]): TrialBalanceTotals => gRows.reduce((t, r) => ({
      openingDebit: t.openingDebit + r.openingDebit,
      openingCredit: t.openingCredit + r.openingCredit,
      movementDebit: t.movementDebit + r.movementDebit,
      movementCredit: t.movementCredit + r.movementCredit,
      closingDebit: t.closingDebit + r.closingDebit,
      closingCredit: t.closingCredit + r.closingCredit,
    }), { openingDebit: 0, openingCredit: 0, movementDebit: 0, movementCredit: 0, closingDebit: 0, closingCredit: 0 });

    for (const type of ACCOUNT_TYPE_ORDER) {
      const typeRows = rows.filter(r => r.accountType === type);
      if (typeRows.length > 0) {
        groups.push({ type, label: ACCOUNT_TYPE_LABELS[type] || type, rows: typeRows, totals: calcGroupTotals(typeRows) });
      }
    }
    const unmatched = rows.filter(r => !ACCOUNT_TYPE_ORDER.includes(r.accountType || ""));
    if (unmatched.length > 0) {
      groups.push({ type: "other", label: "อื่นๆ", rows: unmatched, totals: calcGroupTotals(unmatched) });
    }
    return groups;
  }, [rows, viewMode]);

  const toggleHeader = (code: string) => {
    setCollapsedHeaders(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const handlePrint = () => window.print();

  const handleExcel = () => {
    if (viewMode === "12month") {
      const header = ["รหัสบัญชี", "ชื่อบัญชี", ...THAI_MONTHS_SHORT.map((m, i) => `${m} ${tbYear + 543}`)];
      const aoa: (string | number)[][] = [header];
      (monthData?.rows || []).forEach((row) => {
        aoa.push([
          row.accountCode,
          row.accountNameTh || row.accountName,
          ...row.months.map(v => v ?? 0),
        ]);
      });
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "งบทดลอง 12 เดือน");
      XLSX.writeFile(wb, `trial-balance-12month-${tbYear}.xlsx`);
    } else {
      const header = ["รหัสบัญชี", "ชื่อบัญชี", "ยอดยกมา(เดบิต)", "ยอดยกมา(เครดิต)", "เคลื่อนไหว(เดบิต)", "เคลื่อนไหว(เครดิต)", "ยอดคงเหลือ(เดบิต)", "ยอดคงเหลือ(เครดิต)"];
      const aoa: (string | number)[][] = [header];
      rows.forEach((row) => {
        aoa.push([row.accountCode, row.accountNameTh || row.accountName, row.openingDebit, row.openingCredit, row.movementDebit, row.movementCredit, row.closingDebit, row.closingCredit]);
      });
      if (totals) {
        aoa.push(["", "รวมทั้งสิ้น", totals.openingDebit, totals.openingCredit, totals.movementDebit, totals.movementCredit, totals.closingDebit, totals.closingCredit]);
      }
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "งบทดลอง");
      XLSX.writeFile(wb, "trial-balance.xlsx");
    }
  };

  const isActive = viewMode !== "12month" ? isLoading : isLoadingMonth;

  const yearOptions = [];
  const curYear = new Date().getFullYear();
  for (let y = curYear - 3; y <= curYear + 1; y++) yearOptions.push(y);

  const renderTabs = () => (
    <div className="flex border-b">
      {([
        { key: "tree" as ViewMode, label: "TREE" },
        { key: "plain" as ViewMode, label: "PLAIN" },
        { key: "12month" as ViewMode, label: "12 MONTH" },
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

  const renderFilters = () => (
    <div className="p-4 border-b flex items-center gap-3 flex-wrap">
      {viewMode === "12month" ? (
        <>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium whitespace-nowrap">ปี</label>
            <Select value={String(tbYear)} onValueChange={(v) => setTbYear(Number(v))}>
              <SelectTrigger className="w-[130px]" data-testid="select-year">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map(y => (
                  <SelectItem key={y} value={String(y)}>{y + 543}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <span className="text-xs text-gray-400">Condition: [1,5 = dr - cr] [2,3,4 = cr - dr]</span>
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
    </div>
  );

  const renderTreeNode = (node: TreeNode): React.ReactNode => {
    const isCollapsed = collapsedHeaders.has(node.headerCode);
    const t = node.totals;
    const hasContent = t.openingDebit || t.openingCredit || t.movementDebit || t.movementCredit || t.closingDebit || t.closingCredit;
    if (!hasContent) return null;
    const indent = (node.level - 1) * 20 + 8;
    const bgLevel = node.level === 1 ? "bg-slate-100" : node.level === 2 ? "bg-slate-50" : "bg-white";

    return (
      <React.Fragment key={`node-${node.headerCode}`}>
        <TableRow
          className={`${bgLevel} hover:bg-slate-200 cursor-pointer border-b border-slate-200`}
          onClick={() => toggleHeader(node.headerCode)}
          data-testid={`row-header-${node.headerCode}`}
        >
          <TableCell className="text-sm py-2.5 font-bold text-slate-700 border-r border-slate-200" style={{ paddingLeft: indent }}>
            <div className="flex items-center gap-1.5">
              {isCollapsed ? <ChevronRight className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
              <span>{node.headerCode}: {node.headerName}</span>
            </div>
          </TableCell>
          <TableCell className="text-sm py-2.5 text-right font-bold tabular-nums border-r border-slate-200 text-slate-600">{fmt(t.openingDebit)}</TableCell>
          <TableCell className="text-sm py-2.5 text-right font-bold tabular-nums border-r border-slate-300 text-slate-600">{fmt(t.openingCredit)}</TableCell>
          <TableCell className="text-sm py-2.5 text-right font-bold tabular-nums border-r border-slate-200 text-slate-700">{fmt(t.movementDebit)}</TableCell>
          <TableCell className="text-sm py-2.5 text-right font-bold tabular-nums border-r border-slate-300 text-slate-700">{fmt(t.movementCredit)}</TableCell>
          <TableCell className="text-sm py-2.5 text-right font-bold tabular-nums border-r border-slate-200 text-slate-900">{fmt(t.closingDebit)}</TableCell>
          <TableCell className="text-sm py-2.5 text-right font-bold tabular-nums text-slate-900">{fmt(t.closingCredit)}</TableCell>
        </TableRow>
        {!isCollapsed && (
          <>
            {node.subGroups.filter(sg => {
              const st = sg.totals;
              return st.openingDebit || st.openingCredit || st.movementDebit || st.movementCredit || st.closingDebit || st.closingCredit;
            }).map(sg => renderTreeNode(sg))}
            {node.children.map((row, idx) => (
              <TableRow
                key={row.accountCode}
                className="border-b border-slate-100 cursor-pointer group transition-colors hover:bg-blue-50/30"
                style={{ ...(idx % 2 !== 0 ? { background: "var(--theme-table-stripe)" } : {}) }}
                onClick={() => {
                  if (startDate && endDate) navigate(`/reports/general-ledger?accountCode=${row.accountCode}&startDate=${startDate}&endDate=${endDate}`);
                }}
                data-testid={`row-account-${row.accountCode}`}
              >
                <TableCell className="text-sm tabular-nums py-2 border-r border-slate-200 text-slate-700 group-hover:text-blue-600" style={{ paddingLeft: indent + 24 }}>
                  {row.accountCode} : {row.accountNameTh || row.accountName}
                </TableCell>
                <TableCell className="text-sm py-2 text-right tabular-nums border-r border-slate-200 text-slate-600">{fmt(row.openingDebit)}</TableCell>
                <TableCell className="text-sm py-2 text-right tabular-nums border-r border-slate-300 text-slate-600">{fmt(row.openingCredit)}</TableCell>
                <TableCell className="text-sm py-2 text-right tabular-nums border-r border-slate-200 text-slate-700">{fmt(row.movementDebit)}</TableCell>
                <TableCell className="text-sm py-2 text-right tabular-nums border-r border-slate-300 text-slate-700">{fmt(row.movementCredit)}</TableCell>
                <TableCell className="text-sm py-2 text-right font-medium tabular-nums border-r border-slate-200 text-slate-900">{fmt(row.closingDebit)}</TableCell>
                <TableCell className="text-sm py-2 text-right font-medium tabular-nums text-slate-900">{fmt(row.closingCredit)}</TableCell>
              </TableRow>
            ))}
          </>
        )}
      </React.Fragment>
    );
  };

  const renderTreeView = () => (
    <Table className="border-collapse">
      <TableHeader>
        <TableRow className="hover:bg-transparent border-b border-white/20" style={{ background: "var(--theme-table-header)" }}>
          <TableHead rowSpan={2} className="text-sm font-bold text-white border-r border-white/20 align-middle text-center w-[280px]">รหัสบัญชี - ชื่อบัญชี</TableHead>
          <TableHead colSpan={2} className="text-sm font-bold text-white border-r border-white/20 text-center py-2 border-b border-white/20" style={{ background: "var(--theme-table-header-dark)" }}>ยอดยกมา</TableHead>
          <TableHead colSpan={2} className="text-sm font-bold text-white border-r border-white/20 text-center py-2 border-b border-white/20" style={{ background: "var(--theme-table-header-darker)" }}>เปลี่ยนแปลง</TableHead>
          <TableHead colSpan={2} className="text-sm font-bold text-white text-center py-2 border-b border-white/20" style={{ background: "var(--theme-primary-hover)" }}>ยอดยกไป</TableHead>
        </TableRow>
        <TableRow className="hover:bg-transparent" style={{ background: "var(--theme-table-header)" }}>
          <TableHead className="text-xs font-bold text-white border-r border-white/20 text-center py-2 w-[100px]">เดบิต</TableHead>
          <TableHead className="text-xs font-bold text-white border-r border-white/20 text-center py-2 w-[100px]">เครดิต</TableHead>
          <TableHead className="text-xs font-bold text-white border-r border-white/20 text-center py-2 w-[100px]">เดบิต</TableHead>
          <TableHead className="text-xs font-bold text-white border-r border-white/20 text-center py-2 w-[100px]">เครดิต</TableHead>
          <TableHead className="text-xs font-bold text-white border-r border-white/20 text-center py-2 w-[100px]">เดบิต</TableHead>
          <TableHead className="text-xs font-bold text-white text-center py-2 w-[100px]">เครดิต</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ? (
          <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">กำลังโหลด...</TableCell></TableRow>
        ) : treeData.length === 0 ? (
          <TableRow><TableCell colSpan={7} className="py-12 text-center">
            <FileSpreadsheet className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
            <p className="text-muted-foreground text-sm">ไม่พบข้อมูลในช่วงวันที่ที่เลือก</p>
          </TableCell></TableRow>
        ) : (
          <>
            {treeData.map(node => renderTreeNode(node))}
            {totals && (
              <TableRow className="bg-slate-200 font-bold border-t-2 border-slate-400 hover:bg-slate-200" data-testid="row-totals">
                <TableCell className="text-sm py-3 text-center font-bold text-slate-800 border-r border-slate-300">รวมทั้งสิ้น</TableCell>
                <TableCell className="text-sm py-3 text-right tabular-nums font-bold border-r border-slate-300 text-slate-700">{fmt(totals.openingDebit)}</TableCell>
                <TableCell className="text-sm py-3 text-right tabular-nums font-bold border-r border-slate-400 text-slate-700">{fmt(totals.openingCredit)}</TableCell>
                <TableCell className="text-sm py-3 text-right tabular-nums font-bold border-r border-slate-300 text-slate-800">{fmt(totals.movementDebit)}</TableCell>
                <TableCell className="text-sm py-3 text-right tabular-nums font-bold border-r border-slate-400 text-slate-800">{fmt(totals.movementCredit)}</TableCell>
                <TableCell className="text-sm py-3 text-right tabular-nums font-bold border-r border-slate-300 text-blue-800">{fmt(totals.closingDebit)}</TableCell>
                <TableCell className="text-sm py-3 text-right tabular-nums font-bold text-blue-800">{fmt(totals.closingCredit)}</TableCell>
              </TableRow>
            )}
          </>
        )}
      </TableBody>
    </Table>
  );

  const renderPlainView = () => (
    <Table className="border-collapse">
      <TableHeader>
        <TableRow className="hover:bg-transparent border-b border-white/20" style={{ background: "var(--theme-table-header)" }}>
          <TableHead rowSpan={2} className="text-sm font-bold text-white border-r border-white/20 align-middle text-center w-[100px]">รหัสบัญชี</TableHead>
          <TableHead rowSpan={2} className="text-sm font-bold text-white border-r border-white/20 align-middle text-center min-w-[180px]">ชื่อบัญชี</TableHead>
          <TableHead colSpan={2} className="text-sm font-bold text-white border-r border-white/20 text-center py-2 border-b border-white/20" style={{ background: "var(--theme-table-header-dark)" }}>ยอดยกมา</TableHead>
          <TableHead colSpan={2} className="text-sm font-bold text-white border-r border-white/20 text-center py-2 border-b border-white/20" style={{ background: "var(--theme-table-header-darker)" }}>เปลี่ยนแปลง</TableHead>
          <TableHead colSpan={2} className="text-sm font-bold text-white text-center py-2 border-b border-white/20" style={{ background: "var(--theme-primary-hover)" }}>ยอดยกไป</TableHead>
        </TableRow>
        <TableRow className="hover:bg-transparent" style={{ background: "var(--theme-table-header)" }}>
          <TableHead className="text-xs font-bold text-white border-r border-white/20 text-center py-2">เดบิต</TableHead>
          <TableHead className="text-xs font-bold text-white border-r border-white/20 text-center py-2">เครดิต</TableHead>
          <TableHead className="text-xs font-bold text-white border-r border-white/20 text-center py-2">เดบิต</TableHead>
          <TableHead className="text-xs font-bold text-white border-r border-white/20 text-center py-2">เครดิต</TableHead>
          <TableHead className="text-xs font-bold text-white border-r border-white/20 text-center py-2">เดบิต</TableHead>
          <TableHead className="text-xs font-bold text-white text-center py-2">เครดิต</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ? (
          <TableRow><TableCell colSpan={8} className="py-8 text-center text-muted-foreground">กำลังโหลด...</TableCell></TableRow>
        ) : plainGrouped.length === 0 ? (
          <TableRow><TableCell colSpan={8} className="py-12 text-center">
            <FileSpreadsheet className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
            <p className="text-muted-foreground text-sm">ไม่พบข้อมูลในช่วงวันที่ที่เลือก</p>
          </TableCell></TableRow>
        ) : (
          <>
            {plainGrouped.map((group) => (
              <React.Fragment key={`type-${group.type}`}>
                <TableRow className="bg-slate-100 border-b border-slate-200">
                  <TableCell colSpan={8} className="text-sm py-2 font-bold text-slate-700">{group.label}</TableCell>
                </TableRow>
                {group.rows.map((row, idx) => (
                  <TableRow
                    key={row.accountCode}
                    className="border-b border-slate-100 cursor-pointer group transition-colors hover:bg-blue-50/30"
                    style={idx % 2 !== 0 ? { background: "var(--theme-table-stripe)" } : undefined}
                    onClick={() => {
                      if (startDate && endDate) navigate(`/reports/general-ledger?accountCode=${row.accountCode}&startDate=${startDate}&endDate=${endDate}`);
                    }}
                    data-testid={`row-account-${row.accountCode}`}
                  >
                    <TableCell className="text-sm tabular-nums py-2.5 text-center border-r border-slate-200 font-medium text-slate-700 group-hover:text-blue-600">{row.accountCode}</TableCell>
                    <TableCell className="text-sm py-2.5 border-r border-slate-200 text-slate-800 group-hover:text-blue-600">{row.accountNameTh || row.accountName}</TableCell>
                    <TableCell className="text-sm py-2.5 text-right font-medium tabular-nums border-r border-slate-200 text-slate-600">{fmt(row.openingDebit)}</TableCell>
                    <TableCell className="text-sm py-2.5 text-right font-medium tabular-nums border-r border-slate-300 text-slate-600">{fmt(row.openingCredit)}</TableCell>
                    <TableCell className="text-sm py-2.5 text-right font-medium tabular-nums border-r border-slate-200 text-slate-700">{fmt(row.movementDebit)}</TableCell>
                    <TableCell className="text-sm py-2.5 text-right font-medium tabular-nums border-r border-slate-300 text-slate-700">{fmt(row.movementCredit)}</TableCell>
                    <TableCell className="text-sm py-2.5 text-right font-bold tabular-nums border-r border-slate-200 text-slate-900">{fmt(row.closingDebit)}</TableCell>
                    <TableCell className="text-sm py-2.5 text-right font-bold tabular-nums text-slate-900">{fmt(row.closingCredit)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-blue-50/70 border-b border-slate-300 hover:bg-blue-50/70" data-testid={`row-total-${group.type}`}>
                  <TableCell className="text-sm py-2.5 text-center border-r border-slate-200"></TableCell>
                  <TableCell className="text-sm py-2.5 border-r border-slate-200 font-bold text-slate-800">Total</TableCell>
                  <TableCell className="text-sm py-2.5 text-right font-bold tabular-nums border-r border-slate-200 border-t border-slate-300 text-slate-700">{fmt(group.totals.openingDebit)}</TableCell>
                  <TableCell className="text-sm py-2.5 text-right font-bold tabular-nums border-r border-slate-300 border-t border-slate-300 text-slate-700">{fmt(group.totals.openingCredit)}</TableCell>
                  <TableCell className="text-sm py-2.5 text-right font-bold tabular-nums border-r border-slate-200 border-t border-slate-300 text-slate-800">{fmt(group.totals.movementDebit)}</TableCell>
                  <TableCell className="text-sm py-2.5 text-right font-bold tabular-nums border-r border-slate-300 border-t border-slate-300 text-slate-800">{fmt(group.totals.movementCredit)}</TableCell>
                  <TableCell className="text-sm py-2.5 text-right font-bold tabular-nums border-r border-slate-200 border-t border-slate-300 text-slate-900">{fmt(group.totals.closingDebit)}</TableCell>
                  <TableCell className="text-sm py-2.5 text-right font-bold tabular-nums border-t border-slate-300 text-slate-900">{fmt(group.totals.closingCredit)}</TableCell>
                </TableRow>
              </React.Fragment>
            ))}
            {totals && (
              <TableRow className="bg-slate-200 font-bold border-t-2 border-slate-400 hover:bg-slate-200" data-testid="row-totals">
                <TableCell colSpan={2} className="text-sm py-3 text-center font-bold text-slate-800 border-r border-slate-300">รวมทั้งสิ้น</TableCell>
                <TableCell className="text-sm py-3 text-right tabular-nums font-bold border-r border-slate-300 text-slate-700">{fmt(totals.openingDebit)}</TableCell>
                <TableCell className="text-sm py-3 text-right tabular-nums font-bold border-r border-slate-400 text-slate-700">{fmt(totals.openingCredit)}</TableCell>
                <TableCell className="text-sm py-3 text-right tabular-nums font-bold border-r border-slate-300 text-slate-800">{fmt(totals.movementDebit)}</TableCell>
                <TableCell className="text-sm py-3 text-right tabular-nums font-bold border-r border-slate-400 text-slate-800">{fmt(totals.movementCredit)}</TableCell>
                <TableCell className="text-sm py-3 text-right tabular-nums font-bold border-r border-slate-300 text-blue-800">{fmt(totals.closingDebit)}</TableCell>
                <TableCell className="text-sm py-3 text-right tabular-nums font-bold text-blue-800">{fmt(totals.closingCredit)}</TableCell>
              </TableRow>
            )}
          </>
        )}
      </TableBody>
    </Table>
  );

  const render12MonthView = () => {
    const monthRows = monthData?.rows || [];
    return (
      <div className="relative">
        <style>{`
          .tb12m-sticky-code, .tb12m-sticky-name {
            position: sticky !important;
            z-index: 10 !important;
          }
          .tb12m-sticky-code { left: 0 !important; }
          .tb12m-sticky-name { left: 90px !important; box-shadow: 2px 0 4px rgba(0,0,0,0.06); }
          .tb12m-row-even .tb12m-sticky-code,
          .tb12m-row-even .tb12m-sticky-name { background: #ffffff !important; }
          .tb12m-row-odd .tb12m-sticky-code,
          .tb12m-row-odd .tb12m-sticky-name { background: #f8fafc !important; }
          .tb12m-row-even:hover .tb12m-sticky-code,
          .tb12m-row-even:hover .tb12m-sticky-name,
          .tb12m-row-odd:hover .tb12m-sticky-code,
          .tb12m-row-odd:hover .tb12m-sticky-name { background: #eff6ff !important; }
        `}</style>
        <Table className="border-collapse" style={{ minWidth: "1600px" }}>
          <TableHeader>
            <TableRow className="hover:bg-transparent" style={{ background: "var(--theme-table-header)" }}>
              <TableHead className="text-xs font-bold text-white border-r border-white/20 text-center py-2 w-[90px] sticky left-0 z-20" style={{ background: "var(--theme-table-header)" }}>รหัสบัญชี</TableHead>
              <TableHead className="text-xs font-bold text-white border-r border-white/20 text-center py-2 w-[220px] sticky left-[90px] z-20" style={{ background: "var(--theme-table-header)", boxShadow: "2px 0 4px rgba(0,0,0,0.15)" }}>ชื่อบัญชี</TableHead>
              {THAI_MONTHS_SHORT.map((m, i) => (
                <TableHead key={i} className="text-xs font-bold text-white border-r border-white/20 text-center py-2 w-[100px]">
                  {`${i + 1}/${tbYear + 543}`}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoadingMonth ? (
              <TableRow><TableCell colSpan={14} className="py-8 text-center text-muted-foreground">กำลังโหลด...</TableCell></TableRow>
            ) : monthRows.length === 0 ? (
              <TableRow><TableCell colSpan={14} className="py-12 text-center">
                <FileSpreadsheet className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
                <p className="text-muted-foreground text-sm">ไม่พบข้อมูลในปีที่เลือก</p>
              </TableCell></TableRow>
            ) : (
              monthRows.map((row, idx) => (
                <TableRow
                  key={row.accountCode}
                  className={`border-b border-slate-100 ${idx % 2 !== 0 ? "tb12m-row-odd" : "tb12m-row-even"}`}
                  data-testid={`row-12m-${row.accountCode}`}
                >
                  <TableCell className="tb12m-sticky-code text-xs tabular-nums py-2 text-center border-r border-slate-200 font-medium text-slate-700">{row.accountCode}</TableCell>
                  <TableCell className="tb12m-sticky-name text-xs py-2 border-r border-slate-200 text-slate-800 truncate w-[220px] max-w-[220px]">{row.accountNameTh || row.accountName}</TableCell>
                  {row.months.map((val, mi) => (
                    <TableCell
                      key={mi}
                      className={`text-xs py-2 text-right tabular-nums border-r border-slate-200 ${
                        val !== null && val < 0 ? "text-red-600" : "text-slate-700"
                      }`}
                    >
                      {fmtSigned(val)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <Layout>
      <ReportNavTabs />
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg text-white" style={{ background: "#fb9678" }}>
          <FileSpreadsheet className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold" data-testid="text-trial-balance-title">งบทดลอง</h1>
          <p className="text-sm text-muted-foreground">รายงาน</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs border-green-400 text-green-600 hover:bg-green-50"
            onClick={() => viewMode === "12month" ? undefined : refetch()}
            disabled={isActive}
            data-testid="button-generate"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isActive ? "animate-spin" : ""}`} />
            สร้างรายงาน
          </Button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs border-blue-300 text-blue-600 hover:bg-blue-50" onClick={handlePrint} data-testid="button-print">
            <Printer className="h-3.5 w-3.5" />
            พิมพ์
          </Button>
          <Button size="sm" className="h-8 gap-1.5 text-xs bg-[#05b187] text-white hover:bg-[#049a75] border-none" onClick={handleExcel} data-testid="button-excel">
            <FileDown className="h-3.5 w-3.5" />
            Excel
          </Button>
        </div>
      </div>

      <div className="bg-white border rounded-xl shadow-sm">
        {renderTabs()}
        {renderFilters()}
        <div className="overflow-x-auto">
          {viewMode === "tree" && renderTreeView()}
          {viewMode === "plain" && renderPlainView()}
          {viewMode === "12month" && render12MonthView()}
        </div>
      </div>
    </Layout>
  );
}
