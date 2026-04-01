import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import Layout from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Upload, FileSpreadsheet, Download, Printer, Check, AlertTriangle,
  RefreshCw, Trash2, ChevronDown, ChevronRight, ChevronUp, Plus, GripVertical,
  Save, FolderOpen, FileText
} from "lucide-react";
import * as XLSX from "xlsx";

function fmtRaw(val: number): string {
  if (val === 0) return "-";
  if (val < 0) return `(${Math.abs(val).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
  return val.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmt(val: number) {
  if (val === 0) return <span className="fs-num-pad">-</span>;
  if (val < 0) return <span>{`(${Math.abs(val).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`}</span>;
  return <span className="fs-num-pad">{val.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>;
}

interface ParsedRow {
  code: string;
  name: string;
  debit: number;
  credit: number;
}

interface ReportRow {
  code: string;
  name: string;
  current: number;
  previous: number;
  noteRef?: number;
  indent?: number;
}

interface DBDLineItem {
  id: string;
  label: string;
  prefixes: string[];
  indent: number;
}

const OLD_TO_NEW_HEADER_MAP: Record<string, string> = {
  "100": "100", "101": "101", "102": "102", "103": "103", "104": "104",
  "110": "120", "111": "124", "112": "123",
  "120": "130",
  "130": "170", "131": "171",
  "140": "170", "141": "170", "142": "170", "143": "170", "144": "170", "145": "170", "146": "170",
  "150": "180",
  "160": "190",
  "200": "210",
  "210": "231",
  "220": "234", "221": "234", "222": "234",
  "230": "239",
  "240": "240",
  "300": "301",
  "310": "303",
  "320": "320",
  "330": "330",
  "400": "400", "401": "401", "402": "412", "403": "413", "404": "414", "405": "415",
  "410": "420",
  "500": "510",
  "510": "520", "511": "523", "512": "524", "513": "525", "514": "526", "515": "527", "516": "528", "517": "529",
  "520": "530", "521": "531", "522": "532",
  "530": "530", "540": "540",
  "550": "550", "560": "560", "570": "570",
};

function migrateCodeToNew(code: string): string {
  const prefix3 = code.substring(0, 3);
  if (OLD_TO_NEW_HEADER_MAP[prefix3] && OLD_TO_NEW_HEADER_MAP[prefix3] !== prefix3) {
    const newPrefix = OLD_TO_NEW_HEADER_MAP[prefix3];
    const suffix = code.substring(3);
    const targetLen = 7;
    const combined = newPrefix + suffix;
    if (combined.length >= targetLen) return combined.substring(0, targetLen);
    return combined.padEnd(targetLen, "0");
  }
  return code;
}

function needsMigration(rows: ParsedRow[]): boolean {
  const has4digit = rows.some(r => /^\d{3,4}$/.test(r.code));
  if (has4digit) return true;
  const expRows = rows.filter(r => r.code.charAt(0) === "5");
  if (expRows.length === 0) return false;
  const hasOldCostSales = expRows.some(r => r.code.startsWith("500"));
  const hasOldSelling = expRows.some(r => r.code.startsWith("510") && !r.code.startsWith("5100"));
  const hasOldAdmin = expRows.some(r => r.code.startsWith("520") && !r.code.startsWith("5200"));
  if (hasOldCostSales || hasOldSelling || hasOldAdmin) return true;
  const liabRows = rows.filter(r => r.code.charAt(0) === "2");
  const hasOld200AP = liabRows.some(r => r.code.startsWith("200") && !r.code.startsWith("2000"));
  const hasOld210Accrued = liabRows.some(r => r.code.startsWith("210") && !r.code.startsWith("2100"));
  const hasOld220Tax = liabRows.some(r => r.code.startsWith("220") && !r.code.startsWith("2200"));
  if (hasOld200AP || hasOld210Accrued || hasOld220Tax) return true;
  return false;
}

const DBD_BS_CURRENT_ASSETS: DBDLineItem[] = [
  { id: "cash", label: "เงินสดและรายการเทียบเท่าเงินสด", prefixes: ["100", "101", "102", "103", "104"], indent: 2 },
  { id: "st_invest", label: "เงินลงทุนระยะสั้น", prefixes: ["110"], indent: 2 },
  { id: "trade_ar", label: "ลูกหนี้การค้าและลูกหนี้หมุนเวียนอื่น", prefixes: ["120", "121", "122", "129"], indent: 2 },
  { id: "inventory", label: "สินค้าคงเหลือ", prefixes: ["130"], indent: 2 },
  { id: "other_ca", label: "สินทรัพย์หมุนเวียนอื่น", prefixes: ["140", "141", "142", "143"], indent: 2 },
];

const DBD_BS_NONCURRENT_ASSETS: DBDLineItem[] = [
  { id: "lt_invest", label: "เงินลงทุนระยะยาว", prefixes: ["160", "161"], indent: 2 },
  { id: "ppe", label: "ที่ดิน อาคารและอุปกรณ์ - สุทธิ", prefixes: ["170", "171"], indent: 2 },
  { id: "intangible", label: "สินทรัพย์ไม่มีตัวตน", prefixes: ["180", "181"], indent: 2 },
  { id: "other_nca", label: "สินทรัพย์ไม่หมุนเวียนอื่น", prefixes: ["150", "190"], indent: 2 },
];

const DBD_BS_CURRENT_LIAB: DBDLineItem[] = [
  { id: "bank_od", label: "เงินเบิกเกินบัญชีและเงินกู้ยืมระยะสั้นจากสถาบันการเงิน", prefixes: ["200"], indent: 2 },
  { id: "trade_ap", label: "เจ้าหนี้การค้าและเจ้าหนี้หมุนเวียนอื่น", prefixes: ["210", "231", "232", "233", "234", "238", "239"], indent: 2 },
  { id: "lt_due_1yr", label: "ส่วนของหนี้สินระยะยาวที่ถึงกำหนดชำระภายในหนึ่งปี", prefixes: ["220"], indent: 2 },
  { id: "st_loan", label: "เงินกู้ยืมระยะสั้น", prefixes: ["2300"], indent: 2 },
];

const DBD_BS_NONCURRENT_LIAB: DBDLineItem[] = [
  { id: "lt_loan", label: "เงินกู้ยืมระยะยาว", prefixes: ["240"], indent: 2 },
  { id: "deferred_tax_l", label: "หนี้สินภาษีเงินได้รอตัดบัญชี", prefixes: ["241"], indent: 2 },
  { id: "lt_employee", label: "ผลประโยชน์พนักงานระยะยาว", prefixes: ["242"], indent: 2 },
  { id: "lt_provision", label: "ประมาณการหนี้สินระยะยาว", prefixes: ["243"], indent: 2 },
  { id: "other_ncl", label: "หนี้สินไม่หมุนเวียนอื่น", prefixes: ["249"], indent: 2 },
];

const DBD_IS_REVENUE: DBDLineItem[] = [
  { id: "sales_rev", label: "รายได้จากการขายหรือการให้บริการ", prefixes: ["400", "401", "410"], indent: 1 },
  { id: "other_income", label: "รายได้อื่น", prefixes: ["420"], indent: 1 },
];

const DBD_IS_EXPENSE: DBDLineItem[] = [
  { id: "cost_of_sales", label: "ต้นทุนขายหรือต้นทุนการให้บริการ", prefixes: ["510"], indent: 1 },
  { id: "selling_exp", label: "ค่าใช้จ่ายในการขาย", prefixes: ["520", "523", "524", "525", "526", "527", "528", "529"], indent: 1 },
  { id: "admin_exp", label: "ค่าใช้จ่ายในการบริหาร", prefixes: ["521", "522", "530", "540"], indent: 1 },
];

function aggregateByDBDLine(
  items: DBDLineItem[],
  currentRows: ParsedRow[],
  previousRows: ParsedRow[],
): ReportRow[] {
  return items
    .map(item => {
      const matchesCurrent = currentRows.filter(r =>
        item.prefixes.some(p => r.code.startsWith(p))
      );
      const matchesPrevious = previousRows.filter(r =>
        item.prefixes.some(p => r.code.startsWith(p))
      );
      const current = matchesCurrent.reduce((s, r) => s + calcBalance(r), 0);
      const previous = matchesPrevious.reduce((s, r) => s + calcBalance(r), 0);
      return { code: item.prefixes[0], name: item.label, current, previous, indent: item.indent };
    })
    .filter(r => r.current !== 0 || r.previous !== 0);
}

interface NoteTableRow {
  name: string;
  current: number;
  previous: number;
}

interface AssetMovementRow {
  name: string;
  beginBalance: number;
  additions: number;
  disposals: number;
  endBalance: number;
}

interface NoteSection {
  id: string;
  noteNo: number;
  title: string;
  type: "text" | "table" | "asset_movement";
  content: string;
  tableRows: NoteTableRow[];
  costRows: AssetMovementRow[];
  depreciationRows: AssetMovementRow[];
  expanded: boolean;
  fixed: boolean;
}

function getAccountType(code: string): string {
  const c = code.charAt(0);
  if (c === "1") return "asset";
  if (c === "2") return "liability";
  if (c === "3") return "equity";
  if (c === "4") return "revenue";
  if (c === "5") return "expense";
  return "other";
}

function calcBalance(row: ParsedRow): number {
  const type = getAccountType(row.code);
  if (type === "asset" || type === "expense") return row.debit - row.credit;
  return row.credit - row.debit;
}

function parseTrialBalanceExcel(file: File): Promise<ParsedRow[]> {
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
            if (cell.includes("รหัส") || cell.includes("code") || cell === "เลขที่" || cell.includes("account") && cell.includes("no")) { codeCol = j; headerIdx = i; }
            if (cell.includes("ชื่อบัญชี") || cell.includes("account") && !cell.includes("no") || cell.includes("name") || cell.includes("รายการ")) { nameCol = j; headerIdx = i; }
            if (cell.includes("เดบิต") || cell.includes("debit") || cell === "dr") { allDebitCols.push(j); headerIdx = i; }
            if (cell.includes("เครดิต") || cell.includes("credit") || cell === "cr") { allCreditCols.push(j); headerIdx = i; }
          }
          if (codeCol >= 0 && allDebitCols.length > 0) {
            const sampleData = jsonData.slice(i + 1, Math.min(jsonData.length, i + 30));
            let bestDrIdx = allDebitCols.length - 1;
            let bestCrIdx = allCreditCols.length - 1;
            if (allDebitCols.length > 1) {
              for (let pi = allDebitCols.length - 1; pi >= 0; pi--) {
                const drC = allDebitCols[pi];
                const crC = pi < allCreditCols.length ? allCreditCols[pi] : -1;
                const hasValues = sampleData.filter((sr: any) => {
                  const arr = sr as any[];
                  if (!arr) return false;
                  const dv = parseFloat(String(arr[drC] ?? "0").replace(/,/g, "")) || 0;
                  const cv = crC >= 0 ? (parseFloat(String(arr[crC] ?? "0").replace(/,/g, "")) || 0) : 0;
                  return dv !== 0 || cv !== 0;
                }).length;
                if (hasValues >= 2) { bestDrIdx = pi; bestCrIdx = pi; break; }
              }
            }
            debitCol = allDebitCols[bestDrIdx];
            creditCol = allCreditCols.length > bestCrIdx && bestCrIdx >= 0 ? allCreditCols[bestCrIdx] : (allCreditCols.length > 0 ? allCreditCols[allCreditCols.length - 1] : -1);
            break;
          }
        }

        if (headerIdx < 0 || codeCol < 0 || debitCol < 0) {
          reject(new Error("ไม่สามารถอ่านไฟล์ได้ — ต้องมีคอลัมน์: รหัสบัญชี, ชื่อบัญชี, เดบิต, เครดิต"));
          return;
        }
        console.log(`[FS Parser] Header row=${headerIdx}, codeCol=${codeCol}, nameCol=${nameCol}, debitCol=${debitCol}, creditCol=${creditCol}`);
        console.log(`[FS Parser] Header cells:`, jsonData[headerIdx]);
        console.log(`[FS Parser] Total data rows:`, jsonData.length - headerIdx - 1);
        let skippedNoCode = 0, skippedZero = 0;
        const debugSkipped: string[] = [];

        const actualNameCol = (nameCol >= 0 && nameCol !== codeCol) ? nameCol : -1;
        if (actualNameCol < 0) {
          for (let j = 0; j < (jsonData[headerIdx] as any[] || []).length; j++) {
            if (j === codeCol || j === debitCol || j === creditCol) continue;
            const sample = jsonData.slice(headerIdx + 1, headerIdx + 6);
            const hasText = sample.some((r: any) => {
              const v = String((r as any[])?.[j] ?? "").trim();
              return v.length > 0 && !/^\d/.test(v);
            });
            if (hasText) { nameCol = j; break; }
          }
        }

        const rows: ParsedRow[] = [];
        for (let i = headerIdx + 1; i < jsonData.length; i++) {
          const row = jsonData[i] as any[];
          if (!row) continue;
          const rawCodeCell = String(row[codeCol] ?? "").trim();
          const cleaned = rawCodeCell.replace(/[,\s]/g, "").replace(/\.0+$/, "").replace(/[-–—.:：]/g, "");
          const leadingDigits = cleaned.match(/^(\d{4,})/);
          const rawCode = leadingDigits ? leadingDigits[1] : "";
          if (!rawCode) { skippedNoCode++; continue; }
          const rawName = nameCol >= 0 && nameCol !== codeCol
            ? String(row[nameCol] ?? "").trim()
            : rawCodeCell.replace(/^\d+[.:：]?\s*/, "").trim() || rawCode;
          const rawDebit = parseFloat(String(row[debitCol] ?? "0").replace(/,/g, "")) || 0;
          const rawCredit = creditCol >= 0 ? (parseFloat(String(row[creditCol] ?? "0").replace(/,/g, "")) || 0) : 0;
          if (rawDebit === 0 && rawCredit === 0) { skippedZero++; debugSkipped.push(`${rawCode} (${rawName})`); continue; }
          rows.push({ code: rawCode, name: rawName || rawCode, debit: rawDebit, credit: rawCredit });
        }
        const deduped = rows.filter(r => {
          if (r.code.length >= 5) return true;
          const has7digitChild = rows.some(o => o.code.length >= 7 && o.code.startsWith(r.code));
          return !has7digitChild;
        });
        const removedParents = rows.length - deduped.length;
        if (removedParents > 0) console.log(`[FS Parser] Removed ${removedParents} parent group rows to avoid double counting`);
        rows.length = 0;
        rows.push(...deduped);
        console.log(`[FS Parser] Final: ${rows.length}, skippedNoCode: ${skippedNoCode}, skippedZero: ${skippedZero}`, debugSkipped);
        console.log(`[FS Parser] Header: row=${headerIdx} code=${codeCol} name=${nameCol} dr=${debitCol} cr=${creditCol}`);
        if (rows.length === 0) { reject(new Error("ไม่พบรายการบัญชีที่มียอดในไฟล์")); return; }
        if (needsMigration(rows)) {
          const migrated = rows.map(r => ({ ...r, code: migrateCodeToNew(r.code) }));
          resolve(migrated);
        } else {
          resolve(rows);
        }
      } catch { reject(new Error("ไม่สามารถอ่านไฟล์ได้ กรุณาตรวจสอบรูปแบบ")); }
    };
    reader.readAsBinaryString(file);
  });
}

function buildReportData(currentRows: ParsedRow[], previousRows: ParsedRow[]) {
  const sumRows = (rows: ReportRow[]) => ({
    current: rows.reduce((s, r) => s + r.current, 0),
    previous: rows.reduce((s, r) => s + r.previous, 0),
  });

  const currentAssets = aggregateByDBDLine(DBD_BS_CURRENT_ASSETS, currentRows, previousRows);
  const nonCurrentAssets = aggregateByDBDLine(DBD_BS_NONCURRENT_ASSETS, currentRows, previousRows);
  const allAssets = [...currentAssets, ...nonCurrentAssets];
  const currentLiabilities = aggregateByDBDLine(DBD_BS_CURRENT_LIAB, currentRows, previousRows);
  const nonCurrentLiabilities = aggregateByDBDLine(DBD_BS_NONCURRENT_LIAB, currentRows, previousRows);
  const allLiabilities = [...currentLiabilities, ...nonCurrentLiabilities];

  const equityRowsRaw = currentRows.filter(r => getAccountType(r.code) === "equity");
  const equityRowsPrev = previousRows.filter(r => getAccountType(r.code) === "equity");
  const equityCodes = Array.from(new Set([...equityRowsRaw.map(r => r.code), ...equityRowsPrev.map(r => r.code)])).sort();
  const equityRows = equityCodes
    .map(code => {
      const cr = equityRowsRaw.find(r => r.code === code);
      const pr = equityRowsPrev.find(r => r.code === code);
      return { code, name: cr?.name || pr?.name || code, current: cr ? calcBalance(cr) : 0, previous: pr ? calcBalance(pr) : 0 };
    })
    .filter(r => r.current !== 0 || r.previous !== 0);

  const salesRevenue = aggregateByDBDLine(DBD_IS_REVENUE.filter(i => i.id === "sales_rev"), currentRows, previousRows);
  const otherIncome = aggregateByDBDLine(DBD_IS_REVENUE.filter(i => i.id === "other_income"), currentRows, previousRows);
  const revenues = [...salesRevenue, ...otherIncome];

  const isFinanceOrTax = (r: ParsedRow) =>
    r.code.startsWith("550") || r.code.startsWith("560") || r.code.startsWith("570") || r.code.startsWith("590") ||
    r.name.includes("ดอกเบี้ย") || r.name.includes("ภาษีเงินได้");

  const costOfSales = aggregateByDBDLine(DBD_IS_EXPENSE.filter(i => i.id === "cost_of_sales"), currentRows, previousRows);
  const sellingExpenses = aggregateByDBDLine(DBD_IS_EXPENSE.filter(i => i.id === "selling_exp"), currentRows, previousRows);
  const adminExpenses = aggregateByDBDLine(DBD_IS_EXPENSE.filter(i => i.id === "admin_exp"), currentRows, previousRows);

  const financeRows = currentRows.filter(r => getAccountType(r.code) === "expense" && (r.code.startsWith("550") || r.code.startsWith("560") || r.name.includes("ดอกเบี้ย")));
  const financePrev = previousRows.filter(r => getAccountType(r.code) === "expense" && (r.code.startsWith("550") || r.code.startsWith("560") || r.name.includes("ดอกเบี้ย")));
  const financeCostsArr: ReportRow[] = (financeRows.length > 0 || financePrev.length > 0)
    ? [{ code: "550", name: "ต้นทุนทางการเงิน", current: financeRows.reduce((s, r) => s + calcBalance(r), 0), previous: financePrev.reduce((s, r) => s + calcBalance(r), 0), indent: 1 }]
    : [];

  const taxRows = currentRows.filter(r => getAccountType(r.code) === "expense" && (r.name.includes("ภาษีเงินได้") || r.code.startsWith("570") || r.code.startsWith("590")));
  const taxPrev = previousRows.filter(r => getAccountType(r.code) === "expense" && (r.name.includes("ภาษีเงินได้") || r.code.startsWith("570") || r.code.startsWith("590")));
  const incomeTaxExpense: ReportRow[] = (taxRows.length > 0 || taxPrev.length > 0)
    ? [{ code: "570", name: "ค่าใช้จ่ายภาษีเงินได้", current: taxRows.reduce((s, r) => s + calcBalance(r), 0), previous: taxPrev.reduce((s, r) => s + calcBalance(r), 0), indent: 1 }]
    : [];

  const expenses: ReportRow[] = [
    ...costOfSales, ...sellingExpenses, ...adminExpenses,
    ...financeCostsArr, ...incomeTaxExpense,
  ];

  const totalCurrentAssets = sumRows(currentAssets);
  const totalNonCurrentAssets = sumRows(nonCurrentAssets);
  const totalAssets = sumRows(allAssets);
  const totalCurrentLiabilities = sumRows(currentLiabilities);
  const totalNonCurrentLiabilities = sumRows(nonCurrentLiabilities);
  const totalLiabilities = sumRows(allLiabilities);
  const totalEquity = sumRows(equityRows);
  const totalSalesRevenue = sumRows(salesRevenue);
  const totalOtherIncome = sumRows(otherIncome);
  const totalRevenue = sumRows(revenues);
  const totalCostOfSales = sumRows(costOfSales);
  const totalSellingExpenses = sumRows(sellingExpenses);
  const totalAdminExpenses = sumRows(adminExpenses);
  const totalFinanceCosts = sumRows(financeCostsArr);
  const totalIncomeTax = sumRows(incomeTaxExpense);
  const totalExpense = sumRows(expenses);
  const profitBeforeFinanceAndTax = {
    current: totalRevenue.current - (totalCostOfSales.current + totalSellingExpenses.current + totalAdminExpenses.current),
    previous: totalRevenue.previous - (totalCostOfSales.previous + totalSellingExpenses.previous + totalAdminExpenses.previous),
  };
  const profitBeforeTax = {
    current: profitBeforeFinanceAndTax.current - totalFinanceCosts.current,
    previous: profitBeforeFinanceAndTax.previous - totalFinanceCosts.previous,
  };
  const netIncome = {
    current: profitBeforeTax.current - totalIncomeTax.current,
    previous: profitBeforeTax.previous - totalIncomeTax.previous,
  };
  const totalLiabilitiesAndEquity = {
    current: totalLiabilities.current + totalEquity.current,
    previous: totalLiabilities.previous + totalEquity.previous,
  };

  return {
    currentAssets, nonCurrentAssets, allAssets,
    currentLiabilities, nonCurrentLiabilities, allLiabilities,
    equityRows, salesRevenue, otherIncome, revenues,
    costOfSales, sellingExpenses, adminExpenses, financeCosts: financeCostsArr, incomeTaxExpense, expenses,
    totalCurrentAssets, totalNonCurrentAssets, totalAssets,
    totalCurrentLiabilities, totalNonCurrentLiabilities, totalLiabilities,
    totalEquity, totalSalesRevenue, totalOtherIncome, totalRevenue,
    totalCostOfSales, totalSellingExpenses, totalAdminExpenses,
    totalFinanceCosts, totalIncomeTax, totalExpense,
    profitBeforeFinanceAndTax, profitBeforeTax, netIncome, totalLiabilitiesAndEquity,
  };
}

function buildAccountTableRows(
  currentRows: ParsedRow[],
  previousRows: ParsedRow[],
  prefixFilter: (code: string) => boolean
): NoteTableRow[] {
  const curFiltered = currentRows.filter(r => prefixFilter(r.code));
  const prevFiltered = previousRows.filter(r => prefixFilter(r.code));
  const allCodes = Array.from(new Set([...curFiltered.map(r => r.code), ...prevFiltered.map(r => r.code)])).sort();
  return allCodes
    .map(code => {
      const cr = curFiltered.find(r => r.code === code);
      const pr = prevFiltered.find(r => r.code === code);
      const name = cr?.name || pr?.name || code;
      const current = cr ? calcBalance(cr) : 0;
      const previous = pr ? calcBalance(pr) : 0;
      return { name, current, previous };
    })
    .filter(r => r.current !== 0 || r.previous !== 0);
}

function buildAssetMovement(
  currentRows: ParsedRow[],
  previousRows: ParsedRow[],
  costFilter: (code: string) => boolean,
  depFilter: (code: string) => boolean
): { costRows: AssetMovementRow[]; depreciationRows: AssetMovementRow[] } {
  const buildMovement = (filter: (code: string) => boolean): AssetMovementRow[] => {
    const curFiltered = currentRows.filter(r => filter(r.code));
    const prevFiltered = previousRows.filter(r => filter(r.code));
    const allCodes = Array.from(new Set([...curFiltered.map(r => r.code), ...prevFiltered.map(r => r.code)])).sort();
    return allCodes
      .map(code => {
        const cr = curFiltered.find(r => r.code === code);
        const pr = prevFiltered.find(r => r.code === code);
        const name = cr?.name || pr?.name || code;
        const beginBalance = pr ? Math.abs(calcBalance(pr)) : 0;
        const endBalance = cr ? Math.abs(calcBalance(cr)) : 0;
        const change = endBalance - beginBalance;
        const additions = change > 0 ? change : 0;
        const disposals = change < 0 ? Math.abs(change) : 0;
        return { name, beginBalance, additions, disposals, endBalance };
      })
      .filter(r => r.beginBalance !== 0 || r.endBalance !== 0);
  };

  return {
    costRows: buildMovement(costFilter),
    depreciationRows: buildMovement(depFilter),
  };
}

const FIXED_NOTES: Omit<NoteSection, "noteNo">[] = [
  {
    id: "general_info", title: "ข้อมูลทั่วไป", type: "text", fixed: true, expanded: false,
    content: "[ชื่อบริษัท]\nจัดตั้งขึ้นในประเทศไทยและจดทะเบียนเมื่อวันที่ [ระบุ] ทะเบียนนิติบุคคลเลขที่ [ระบุ]\nมีสำนักงานใหญ่ตั้งอยู่เลขที่ [ระบุ]\nบริษัทประกอบธุรกิจหลักเกี่ยวกับ [ระบุ]",
    tableRows: [], costRows: [], depreciationRows: [],
  },
  {
    id: "accounting_basis", title: "เกณฑ์ในการจัดทำงบการเงิน", type: "text", fixed: true, expanded: false,
    content: "งบการเงินนี้จัดทำขึ้นตามมาตรฐานการรายงานทางการเงินสำหรับกิจการที่ไม่มีส่วนได้เสียสาธารณะ (ปรับปรุง 2565) ซึ่งออกและประกาศโดยสภาวิชาชีพบัญชีฯ (\"สภาวิชาชีพบัญชี\") ในระหว่างปี 2565 ทั้งนี้การถือปฏิบัติตามมาตรฐานการรายงานทางการเงินสำหรับกิจการที่ไม่มีส่วนได้เสียสาธารณะ (ปรับปรุง 2565) (\"มาตรฐานการรายงานทางการเงินสำหรับกิจการที่ไม่มีส่วนได้เสียสาธารณะ\") ไม่มีผลกระทบอย่างมีสาระสำคัญต่องบการเงิน\n\nงบการเงินนี้จัดทำและนำเสนอเป็นเงินบาท นโยบายการบัญชีที่เปิดเผยในหมายเหตุข้อ 3 ได้ถือปฏิบัติโดยสม่ำเสมอสำหรับงบการเงินทุกรอบระยะเวลาที่รายงาน\n\nในการจัดทำงบการเงินให้เป็นไปตามมาตรฐานการรายงานทางการเงินสำหรับกิจการที่ไม่มีส่วนได้เสียสาธารณะ ผู้บริหารใช้วิจารณญาณ การประมาณการและข้อสมมติหลายประการ ซึ่งมีผลกระทบต่อการปฏิบัติตามนโยบายการบัญชีของบริษัท ทั้งนี้ ผลที่เกิดขึ้นจริงอาจแตกต่างจากที่ประมาณไว้ ประมาณการและข้อสมมติฐานที่ใช้ในการจัดทำงบการเงินจะได้รับการทบทวนอย่างต่อเนื่อง การปรับประมาณการทางบัญชีจะบันทึกโดยวิธีเปลี่ยนทันทีเป็นต้นไป",
    tableRows: [], costRows: [], depreciationRows: [],
  },
  {
    id: "accounting_policies", title: "สรุปนโยบายการบัญชีที่สำคัญ", type: "text", fixed: true, expanded: false,
    content: "3.1 เงินสดและรายการเทียบเท่าเงินสด\n     เงินสดและรายการเทียบเท่าเงินสดหมายรวมถึงเงินสดในมือ และเงินฝากสถาบันการเงิน และเงินลงทุนระยะสั้นที่มีสภาพคล่องสูงซึ่งถึงกำหนดจ่ายคืนภายในไม่เกินสามเดือนนับจากวันที่ได้มา และไม่มีข้อจำกัดในการเบิกใช้\n\n3.2 การรับรู้รายได้ และรายจ่าย\n     รายได้จากการขายรับรู้เมื่อกิจการได้โอนความเสี่ยงและผลตอบแทนที่มีนัยสำคัญของความเป็นเจ้าของสินค้าให้กับผู้ซื้อแล้ว\n     บริษัทฯรับรู้รายได้และค่าใช้จ่ายตามเกณฑ์คงค้าง\n\n3.3 ภาษีเงินได้\n     บริษัทคำนวณภาษีเงินได้ตามเกณฑ์ที่กำหนดไว้ในประมวลรัษฎากรและบันทึกภาษีเงินได้ตามเกณฑ์คงค้าง\n\n3.4 ประมาณการหนี้สิน\n     ประมาณการหนี้สินจะรับรู้ในงบแสดงฐานะการเงินก็ต่อเมื่อ บริษัทฯมีภาระหนี้สินเกิดขึ้นจากข้อพิพาททางกฎหมายหรือภาระผูกพัน ซึ่งเป็นผลมาจากเหตุการณ์ในอดีต และมีความเป็นไปได้ค่อนข้างแน่นอนว่าประโยชน์เชิงเศรษฐกิจจะต้องถูกจ่ายไปเพื่อชำระภาระหนี้สินดังกล่าว โดยจำนวนภาระหนี้สินดังกล่าวสามารถประมาณจำนวนเงินได้อย่างน่าเชื่อถือ",
    tableRows: [], costRows: [], depreciationRows: [],
  },
];

function createFixedNotes(companyName: string): NoteSection[] {
  return FIXED_NOTES.map((n, i) => ({
    ...n,
    noteNo: i + 1,
    content: n.id === "general_info" ? n.content.replace("[ชื่อบริษัท]", companyName || "บริษัท [ระบุชื่อ] จำกัด") : n.content,
  }));
}

const ALL_BS_NOTE_ITEMS: DBDLineItem[] = [
  ...DBD_BS_CURRENT_ASSETS,
  ...DBD_BS_NONCURRENT_ASSETS,
  ...DBD_BS_CURRENT_LIAB,
  ...DBD_BS_NONCURRENT_LIAB,
];

const PPE_IDS = new Set(["ppe", "intangible"]);
const PPE_COST_PREFIXES = ["170", "180"];
const PPE_DEP_PREFIXES = ["171", "181"];

function generateDynamicNotes(
  currentRows: ParsedRow[],
  previousRows: ParsedRow[],
  startNo: number
): NoteSection[] {
  const tableNote = (id: string, noteNo: number, title: string, rows: NoteTableRow[]): NoteSection => ({
    id, noteNo, title, type: "table", content: "", tableRows: rows, costRows: [], depreciationRows: [], expanded: false, fixed: false,
  });

  const dynamic: NoteSection[] = [];
  let no = startNo;

  for (const item of ALL_BS_NOTE_ITEMS) {
    const prefixFilter = (c: string) => item.prefixes.some(p => c.startsWith(p));

    if (PPE_IDS.has(item.id)) {
      continue;
    }

    const rows = buildAccountTableRows(currentRows, previousRows, prefixFilter);
    if (rows.length > 0) {
      dynamic.push(tableNote(item.id, no++, item.label, rows));
    }
  }

  const hasPPE = currentRows.some(r => PPE_COST_PREFIXES.some(p => r.code.startsWith(p)) || PPE_DEP_PREFIXES.some(p => r.code.startsWith(p))) ||
                 previousRows.some(r => PPE_COST_PREFIXES.some(p => r.code.startsWith(p)) || PPE_DEP_PREFIXES.some(p => r.code.startsWith(p)));

  if (hasPPE) {
    const assetMovement = buildAssetMovement(
      currentRows, previousRows,
      c => PPE_COST_PREFIXES.some(p => c.startsWith(p)),
      c => PPE_DEP_PREFIXES.some(p => c.startsWith(p))
    );
    if (assetMovement.costRows.length > 0 || assetMovement.depreciationRows.length > 0) {
      dynamic.push({
        id: "ppe", noteNo: no++, title: "ที่ดิน อาคารและอุปกรณ์ - สุทธิ", type: "asset_movement",
        content: "", tableRows: [], costRows: assetMovement.costRows, depreciationRows: assetMovement.depreciationRows,
        expanded: false, fixed: false,
      });
    }
  }

  dynamic.push({
    id: "approval", noteNo: no++, title: "การอนุมัติงบการเงิน", type: "text",
    content: "งบการเงินนี้ได้รับอนุมัติให้ออกโดยกรรมการผู้มีอำนาจของบริษัทฯแล้ว",
    tableRows: [], costRows: [], depreciationRows: [], expanded: false, fixed: false,
  });

  return dynamic;
}

function getNoteRefMap(notes: NoteSection[]): Record<string, number> {
  const map: Record<string, number> = {};
  notes.forEach((note) => {
    const item = ALL_BS_NOTE_ITEMS.find(i => i.id === note.id);
    if (item) map[note.id] = note.noteNo;
    if (note.id === "ppe") map["ppe"] = note.noteNo;
  });
  return map;
}

function getRowNoteRef(code: string, noteRefMap: Record<string, number>): number | undefined {
  for (const item of ALL_BS_NOTE_ITEMS) {
    if (PPE_IDS.has(item.id)) continue;
    if (item.prefixes.some(p => code.startsWith(p))) {
      return noteRefMap[item.id];
    }
  }
  if (PPE_COST_PREFIXES.some(p => code.startsWith(p)) || PPE_DEP_PREFIXES.some(p => code.startsWith(p))) {
    return noteRefMap["ppe"];
  }
  return undefined;
}

function SignatureLine({ signerName, signerTitle }: { signerName: string; signerTitle: string }) {
  const title = signerTitle || "กรรมการ";
  const name = signerName || "..................................................";
  return (
    <div className="fs-signature-block mt-16 print:mt-20 flex justify-center">
      <div className="inline-block">
        <div className="flex items-end gap-2">
          <span className="text-sm whitespace-nowrap">{title}</span>
          <div className="w-72 border-b border-gray-600 mb-0.5"></div>
        </div>
        <p className="text-sm text-center mt-1">( {name} )</p>
      </div>
    </div>
  );
}

function StatementFooter({ signerName, signerTitle, showNoteRef = true, showQualification = true }: {
  signerName: string; signerTitle: string; showNoteRef?: boolean; showQualification?: boolean;
}) {
  return (
    <div className="fs-statement-footer mt-8 print:mt-6">
      {showNoteRef && (
        <div className="text-center text-sm text-muted-foreground">
          หมายเหตุประกอบงบการเงินเป็นส่วนหนึ่งของงบการเงินนี้
        </div>
      )}
      {showQualification && (
        <>
          <div className="text-center text-sm text-muted-foreground mt-4 leading-loose">
            ข้อมูลในงบการเงินนี้ได้จัดทำขึ้นอย่างถูกต้องครบถ้วนตามความเป็นจริง และตามมาตรฐานการบัญชี
          </div>
          <div className="text-center text-sm text-muted-foreground leading-loose">
            งบการเงินนี้ได้รับอนุมัติจากที่ประชุมสามัญผู้ถือหุ้น ครั้งที่.......................เมื่อวันที่..................................
          </div>
        </>
      )}
      <SignatureLine signerName={signerName} signerTitle={signerTitle} />
    </div>
  );
}

function UnitLabel() {
  return <p className="text-right text-xs text-muted-foreground mb-1">หน่วย : บาท</p>;
}

export default function FinancialStatementsGenerator() {
  const { toast } = useToast();
  const currentYear = new Date().getFullYear();

  const [companyName, setCompanyName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [incorporationDate, setIncorporationDate] = useState("");
  const [registrationNo, setRegistrationNo] = useState("");
  const [headOfficeAddress, setHeadOfficeAddress] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [signerName, setSignerName] = useState("");
  const [signerTitle, setSignerTitle] = useState("กรรมการ");
  const [yearCurrent, setYearCurrent] = useState(String(currentYear));
  const [yearPrevious, setYearPrevious] = useState(String(currentYear - 1));
  const [isFirstYear, setIsFirstYear] = useState(false);
  const [registeredCapitalShares, setRegisteredCapitalShares] = useState("10,000");
  const [registeredCapitalPerShare, setRegisteredCapitalPerShare] = useState("100");
  const [paidUpShares, setPaidUpShares] = useState("10,000");
  const [paidUpPerShare, setPaidUpPerShare] = useState("25");

  const [currentRows, setCurrentRows] = useState<ParsedRow[]>([]);
  const [previousRows, setPreviousRows] = useState<ParsedRow[]>([]);
  const [activeTab, setActiveTab] = useState("import");
  const [printAllMode, setPrintAllMode] = useState(false);
  const [previewMode, setPreviewMode] = useState<"bs" | "is" | "eq" | "notes" | "all" | null>(null);
  const [notes, setNotes] = useState<NoteSection[]>(() => createFixedNotes(""));
  const [noteRefOverrides, setNoteRefOverrides] = useState<Record<string, string>>({});

  const [currentDraftId, setCurrentDraftId] = useState<number | null>(null);
  const [currentDraftName, setCurrentDraftName] = useState("");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [saveDraftName, setSaveDraftName] = useState("");

  const queryClient = useQueryClient();

  const { data: draftsList = [] } = useQuery<any[]>({
    queryKey: ["/api/financial-statement-drafts"],
    queryFn: async () => { const r = await fetch("/api/financial-statement-drafts", { credentials: "include" }); if (!r.ok) return []; return r.json(); },
  });

  const collectDraftData = useCallback(() => ({
    companyName, taxId, incorporationDate, registrationNo, headOfficeAddress, businessType,
    signerName, signerTitle, yearCurrent, yearPrevious, isFirstYear,
    registeredCapitalShares, registeredCapitalPerShare, paidUpShares, paidUpPerShare,
    currentRows, previousRows, notes, noteRefOverrides,
  }), [companyName, taxId, incorporationDate, registrationNo, headOfficeAddress, businessType,
    signerName, signerTitle, yearCurrent, yearPrevious, isFirstYear,
    registeredCapitalShares, registeredCapitalPerShare, paidUpShares, paidUpPerShare,
    currentRows, previousRows, notes, noteRefOverrides]);

  const loadDraftData = useCallback((data: any) => {
    if (data.companyName !== undefined) setCompanyName(data.companyName);
    if (data.taxId !== undefined) setTaxId(data.taxId);
    if (data.incorporationDate !== undefined) setIncorporationDate(data.incorporationDate);
    if (data.registrationNo !== undefined) setRegistrationNo(data.registrationNo);
    if (data.headOfficeAddress !== undefined) setHeadOfficeAddress(data.headOfficeAddress);
    if (data.businessType !== undefined) setBusinessType(data.businessType);
    if (data.signerName !== undefined) setSignerName(data.signerName);
    if (data.signerTitle !== undefined) setSignerTitle(data.signerTitle);
    if (data.yearCurrent !== undefined) setYearCurrent(data.yearCurrent);
    if (data.yearPrevious !== undefined) setYearPrevious(data.yearPrevious);
    if (data.isFirstYear !== undefined) setIsFirstYear(data.isFirstYear);
    if (data.registeredCapitalShares !== undefined) setRegisteredCapitalShares(data.registeredCapitalShares);
    if (data.registeredCapitalPerShare !== undefined) setRegisteredCapitalPerShare(data.registeredCapitalPerShare);
    if (data.paidUpShares !== undefined) setPaidUpShares(data.paidUpShares);
    if (data.paidUpPerShare !== undefined) setPaidUpPerShare(data.paidUpPerShare);
    if (data.currentRows !== undefined) setCurrentRows(data.currentRows);
    if (data.previousRows !== undefined) setPreviousRows(data.previousRows);
    if (data.notes !== undefined) setNotes(data.notes);
    if (data.noteRefOverrides !== undefined) setNoteRefOverrides(data.noteRefOverrides);
  }, []);

  const saveDraftMutation = useMutation({
    mutationFn: async ({ name, id }: { name: string; id?: number }) => {
      const data = collectDraftData();
      if (id) {
        const res = await apiRequest("PUT", `/api/financial-statement-drafts/${id}`, { name, data });
        return res.json();
      } else {
        const res = await apiRequest("POST", "/api/financial-statement-drafts", { name, data });
        return res.json();
      }
    },
    onSuccess: (result) => {
      setCurrentDraftId(result.id);
      setCurrentDraftName(result.name);
      setShowSaveDialog(false);
      queryClient.invalidateQueries({ queryKey: ["/api/financial-statement-drafts"] });
      toast({ title: "บันทึกสำเร็จ", description: `บันทึกร่าง "${result.name}" แล้ว` });
    },
    onError: () => {
      toast({ title: "เกิดข้อผิดพลาด", description: "ไม่สามารถบันทึกได้", variant: "destructive" });
    },
  });

  const deleteDraftMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/financial-statement-drafts/${id}`);
    },
    onSuccess: (_, deletedId) => {
      if (currentDraftId === deletedId) {
        setCurrentDraftId(null);
        setCurrentDraftName("");
      }
      queryClient.invalidateQueries({ queryKey: ["/api/financial-statement-drafts"] });
      toast({ title: "ลบร่างแล้ว" });
    },
  });

  const handleLoadDraft = async (draftId: number) => {
    try {
      const res = await fetch(`/api/financial-statement-drafts/${draftId}`, { credentials: "include" });
      if (!res.ok) throw new Error("fetch failed");
      const draft = await res.json();
      if (draft && draft.data) {
        loadDraftData(draft.data);
        setCurrentDraftId(draft.id);
        setCurrentDraftName(draft.name);
        setShowLoadDialog(false);
        toast({ title: "โหลดร่างแล้ว", description: `โหลด "${draft.name}" สำเร็จ` });
      }
    } catch {
      toast({ title: "เกิดข้อผิดพลาด", description: "ไม่สามารถโหลดได้", variant: "destructive" });
    }
  };

  const handleSave = () => {
    if (currentDraftId) {
      saveDraftMutation.mutate({ name: currentDraftName, id: currentDraftId });
    } else {
      setSaveDraftName(companyName || `งบการเงิน ${yearCurrent}`);
      setShowSaveDialog(true);
    }
  };

  const handleSaveAs = () => {
    setSaveDraftName(companyName || `งบการเงิน ${yearCurrent}`);
    setShowSaveDialog(true);
  };

  const fileRef1 = useRef<HTMLInputElement>(null);
  const fileRef2 = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setNotes(prev => prev.map(n => {
      if (n.id !== "general_info") return n;
      const nameStr = companyName || "[ชื่อบริษัท]";
      const dateStr = incorporationDate || "[ระบุวันที่]";
      const regStr = registrationNo || taxId || "[ระบุ]";
      const addrStr = headOfficeAddress || "[ระบุ]";
      const bizStr = businessType || "[ระบุ]";
      return {
        ...n,
        content: `${nameStr}\nจัดตั้งขึ้นในประเทศไทยและจดทะเบียนเมื่อวันที่ ${dateStr} ทะเบียนนิติบุคคลเลขที่ ${regStr}\nมีสำนักงานใหญ่ตั้งอยู่เลขที่ ${addrStr}\nบริษัทประกอบธุรกิจหลักเกี่ยวกับ ${bizStr}`,
      };
    }));
  }, [companyName, incorporationDate, registrationNo, taxId, headOfficeAddress, businessType]);

  const buddhYearCurrent = Number(yearCurrent) + 543;
  const buddhYearPrevious = Number(yearPrevious) + 543;

  const handleUpload = async (target: "current" | "previous", e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = await parseTrialBalanceExcel(file);
      if (target === "current") setCurrentRows(parsed);
      else setPreviousRows(parsed);
      const codeList = parsed.map(r => `${r.code} ${r.name} D:${r.debit} C:${r.credit}`);
      console.log(`[FS Parser] ${target}:`, codeList);
      toast({
        title: `อ่านไฟล์ปี ${target === "current" ? yearCurrent : yearPrevious} สำเร็จ — ${parsed.length} รายการ`,
        description: parsed.map(r => `${r.code} ${r.name}`).join("\n"),
        duration: 10000,
      });
    } catch (err: any) {
      toast({ title: "ผิดพลาด", description: err.message, variant: "destructive" });
    }
    if (target === "current" && fileRef1.current) fileRef1.current.value = "";
    if (target === "previous" && fileRef2.current) fileRef2.current.value = "";
  };

  const reportData = useMemo(() => {
    if (currentRows.length === 0 || previousRows.length === 0) return null;
    return buildReportData(currentRows, previousRows);
  }, [currentRows, previousRows]);

  const canGenerate = currentRows.length > 0 && previousRows.length > 0;

  const noteRefMap = useMemo(() => getNoteRefMap(notes), [notes]);

  const handleGenerateNotes = () => {
    if (!currentRows.length || !previousRows.length) return;
    const fixed = notes.filter(n => n.fixed);
    const dynamic = generateDynamicNotes(currentRows, previousRows, fixed.length + 1)
      .map(n => ({ ...n, expanded: true }));
    setNotes([...fixed, ...dynamic]);
    toast({ title: "สร้างหมายเหตุ ข้อ 4+ จากข้อมูลงบทดลอง", description: `ข้อ 1-3 คงเดิม, เพิ่ม ${dynamic.length} หัวข้อ` });
  };

  const toggleNote = (id: string) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, expanded: !n.expanded } : n));
  };

  const updateNote = (id: string, field: keyof NoteSection, value: any) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, [field]: value } : n));
  };

  const renumberNotes = (list: NoteSection[]): NoteSection[] =>
    list.map((n, i) => ({ ...n, noteNo: i + 1 }));

  const removeNote = (id: string) => {
    setNotes(prev => renumberNotes(prev.filter(n => n.id !== id)));
  };

  const addNote = (type: "text" | "table" | "asset_movement" = "text") => {
    const newNote: NoteSection = {
      id: `custom_${Date.now()}`,
      noteNo: notes.length + 1,
      title: "หัวข้อใหม่",
      type,
      content: type === "text" ? "" : "",
      tableRows: type === "table" ? [{ name: "รายการ", current: 0, previous: 0 }] : [],
      costRows: type === "asset_movement" ? [{ name: "รายการ", beginBalance: 0, additions: 0, disposals: 0, endBalance: 0 }] : [],
      depreciationRows: type === "asset_movement" ? [{ name: "รายการ", beginBalance: 0, additions: 0, disposals: 0, endBalance: 0 }] : [],
      expanded: true,
      fixed: false,
    };
    setNotes(prev => renumberNotes([...prev, newNote]));
  };

  const insertNoteAfter = (afterId: string) => {
    setNotes(prev => {
      const idx = prev.findIndex(n => n.id === afterId);
      if (idx < 0) return prev;
      const newNote: NoteSection = {
        id: `custom_${Date.now()}`,
        noteNo: 0, title: "หัวข้อใหม่", type: "text",
        content: "", tableRows: [], costRows: [], depreciationRows: [],
        expanded: true, fixed: false,
      };
      const next = [...prev];
      next.splice(idx + 1, 0, newNote);
      return renumberNotes(next);
    });
  };

  const moveNote = (id: string, direction: "up" | "down") => {
    setNotes(prev => {
      const idx = prev.findIndex(n => n.id === id);
      if (idx < 0) return prev;
      const targetIdx = direction === "up" ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;
      if (prev[targetIdx].fixed) return prev;
      const next = [...prev];
      [next[idx], next[targetIdx]] = [next[targetIdx], next[idx]];
      return renumberNotes(next);
    });
  };

  const setNoteRef = (code: string, value: string) => {
    setNoteRefOverrides(prev => ({ ...prev, [code]: value }));
  };

  const handleReset = () => {
    setCurrentRows([]);
    setPreviousRows([]);
    setNotes(createFixedNotes(""));
    setNoteRefOverrides({});
    setCompanyName("");
    setTaxId("");
    setIncorporationDate("");
    setRegistrationNo("");
    setHeadOfficeAddress("");
    setBusinessType("");
    setSignerName("");
    setSignerTitle("กรรมการ");
    setRegisteredCapitalShares("10,000");
    setRegisteredCapitalPerShare("100");
    setPaidUpShares("10,000");
    setPaidUpPerShare("25");
    setActiveTab("import");
    setCurrentDraftId(null);
    setCurrentDraftName("");
    toast({ title: "เคลียร์ข้อมูลแล้ว", description: "พร้อมทำรายถัดไป" });
  };

  const exportExcel = () => {
    if (!reportData) return;
    const wb = XLSX.utils.book_new();
    const name = companyName || "บริษัท";

    const paidUpValEx = paidUpVal;
    const retainedCurEx = retainedCur;
    const retainedPrevEx = retainedPrev;

    const excelNoteRef = (code: string): string | number => {
      if (noteRefOverrides[code] !== undefined) return noteRefOverrides[code];
      const auto = getRowNoteRef(code, noteRefMap);
      return auto || "";
    };

    const bsRows: any[][] = [
      [name], ["งบแสดงฐานะการเงิน"], [`ณ วันที่ 31 ธันวาคม ${buddhYearCurrent}`], [],
      ["รายการ", "หมายเหตุ", `พ.ศ. ${buddhYearCurrent}`, `พ.ศ. ${buddhYearPrevious}`],
      ["สินทรัพย์"], ["สินทรัพย์หมุนเวียน"],
    ];
    reportData.currentAssets.forEach((r: ReportRow) => {
      bsRows.push([`  ${r.name}`, excelNoteRef(r.code), r.current, r.previous]);
    });
    bsRows.push(["รวมสินทรัพย์หมุนเวียน", "", reportData.totalCurrentAssets.current, reportData.totalCurrentAssets.previous]);
    if (reportData.nonCurrentAssets.length > 0) {
      bsRows.push(["สินทรัพย์ไม่หมุนเวียน"]);
      reportData.nonCurrentAssets.forEach((r: ReportRow) => {
        bsRows.push([`  ${r.name}`, excelNoteRef(r.code), r.current, r.previous]);
      });
      bsRows.push(["รวมสินทรัพย์ไม่หมุนเวียน", "", reportData.totalNonCurrentAssets.current, reportData.totalNonCurrentAssets.previous]);
    }
    bsRows.push(["รวมสินทรัพย์", "", reportData.totalAssets.current, reportData.totalAssets.previous]);
    bsRows.push([]);
    bsRows.push(["หนี้สินและส่วนของผู้ถือหุ้น"], ["หนี้สินหมุนเวียน"]);
    reportData.currentLiabilities.forEach((r: ReportRow) => {
      bsRows.push([`  ${r.name}`, excelNoteRef(r.code), r.current, r.previous]);
    });
    bsRows.push(["รวมหนี้สินหมุนเวียน", "", reportData.totalCurrentLiabilities.current, reportData.totalCurrentLiabilities.previous]);
    bsRows.push(["รวมหนี้สิน", "", reportData.totalLiabilities.current, reportData.totalLiabilities.previous]);
    bsRows.push([]);
    bsRows.push(["ส่วนของผู้ถือหุ้น"]);
    const regCapVal = parseFloat(registeredCapitalShares.replace(/,/g, "")) * parseFloat(registeredCapitalPerShare.replace(/,/g, ""));
    bsRows.push([`  ทุนจดทะเบียน หุ้นสามัญ ${registeredCapitalShares} หุ้น มูลค่าหุ้นละ ${registeredCapitalPerShare} บาท`, "", regCapVal, regCapVal]);
    bsRows.push([`  ทุนที่ชำระแล้ว หุ้นสามัญ ${paidUpShares} หุ้น มูลค่าหุ้นละ ${paidUpPerShare} บาท`, "", paidUpValEx, paidUpValEx]);
    bsRows.push(["  กำไร(ขาดทุน)สะสมยังไม่ได้จัดสรร", "", retainedCurEx, retainedPrevEx]);
    const eqTotalCur = paidUpValEx + retainedCurEx;
    const eqTotalPrev = paidUpValEx + retainedPrevEx;
    bsRows.push(["รวมส่วนของผู้ถือหุ้น", "", eqTotalCur, eqTotalPrev]);
    bsRows.push(["รวมหนี้สินและส่วนของผู้ถือหุ้น", "", reportData.totalLiabilities.current + eqTotalCur, reportData.totalLiabilities.previous + eqTotalPrev]);

    const bsSheet = XLSX.utils.aoa_to_sheet(bsRows);
    bsSheet["!cols"] = [{ wch: 45 }, { wch: 10 }, { wch: 20 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, bsSheet, "งบฐานะการเงิน");

    const isRows: any[][] = [
      [name], ["งบกำไรขาดทุน"], [`สำหรับปีสิ้นสุดวันที่ 31 ธันวาคม ${buddhYearCurrent}`], [],
      ["รายการ", "", `พ.ศ. ${buddhYearCurrent}`, `พ.ศ. ${buddhYearPrevious}`],
      ["รายได้"],
    ];
    const isRowPush = (r: ReportRow) => isRows.push([`  ${r.name}`, excelNoteRef(r.code), r.current, r.previous]);
    if (reportData.salesRevenue.length > 0) reportData.salesRevenue.forEach(isRowPush);
    if (reportData.otherIncome.length > 0) reportData.otherIncome.forEach(isRowPush);
    isRows.push(["รวมรายได้", "", reportData.totalRevenue.current, reportData.totalRevenue.previous]);
    isRows.push([], ["ค่าใช้จ่าย"]);
    if (reportData.costOfSales.length > 0) reportData.costOfSales.forEach(isRowPush);
    if (reportData.sellingExpenses.length > 0) reportData.sellingExpenses.forEach(isRowPush);
    if (reportData.adminExpenses.length > 0) reportData.adminExpenses.forEach(isRowPush);
    isRows.push(["รวมค่าใช้จ่าย", "", reportData.totalExpense.current - reportData.totalFinanceCosts.current - reportData.totalIncomeTax.current, reportData.totalExpense.previous - reportData.totalFinanceCosts.previous - reportData.totalIncomeTax.previous]);
    isRows.push([]);
    isRows.push(["กำไร (ขาดทุน) ก่อนต้นทุนทางการเงินและภาษีเงินได้", "", reportData.profitBeforeFinanceAndTax.current, reportData.profitBeforeFinanceAndTax.previous]);
    isRows.push(["ต้นทุนทางการเงิน", "", reportData.totalFinanceCosts.current, reportData.totalFinanceCosts.previous]);
    isRows.push(["กำไร(ขาดทุน)ก่อนภาษีเงินได้", "", reportData.profitBeforeTax.current, reportData.profitBeforeTax.previous]);
    isRows.push(["ภาษีเงินได้", "", reportData.totalIncomeTax.current, reportData.totalIncomeTax.previous]);
    isRows.push(["กำไร(ขาดทุน)สุทธิ", "", reportData.netIncome.current, reportData.netIncome.previous]);

    const isSheet = XLSX.utils.aoa_to_sheet(isRows);
    isSheet["!cols"] = [{ wch: 55 }, { wch: 10 }, { wch: 20 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, isSheet, "งบกำไรขาดทุน");

    const beginRetainedPrevYear = retainedPrevEx - reportData.netIncome.previous;
    const eqRows: any[][] = [
      [name], ["งบการเปลี่ยนแปลงส่วนของผู้ถือหุ้น"], [`สำหรับปีสิ้นสุดวันที่ 31 ธันวาคม ${buddhYearCurrent}`], [],
      ["", "ทุนที่ออกและชำระแล้ว", "กำไร(ขาดทุน)สะสม", "รวม"],
      [`ยอดยกมาต้นงวด วันที่ 1 มกราคม ${buddhYearPrevious}`, paidUpValEx, beginRetainedPrevYear, paidUpValEx + beginRetainedPrevYear],
      ["กำไร(ขาดทุน)สุทธิ", "-", reportData.netIncome.previous, reportData.netIncome.previous],
      [`ยอดคงเหลือปลายงวด วันที่ 31 ธันวาคม ${buddhYearPrevious}`, paidUpValEx, retainedPrevEx, paidUpValEx + retainedPrevEx],
      ["กำไร(ขาดทุน)สุทธิ", "-", reportData.netIncome.current, reportData.netIncome.current],
      [`ยอดคงเหลือปลายงวด วันที่ 31 ธันวาคม ${buddhYearCurrent}`, paidUpValEx, retainedCurEx, paidUpValEx + retainedCurEx],
    ];
    const eqSheet = XLSX.utils.aoa_to_sheet(eqRows);
    eqSheet["!cols"] = [{ wch: 50 }, { wch: 22 }, { wch: 22 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(wb, eqSheet, "งบเปลี่ยนแปลงส่วนของผู้ถือหุ้น");

    if (notes.length > 0) {
      const noteRows: any[][] = [
        [name], ["หมายเหตุประกอบงบการเงิน"], [`สำหรับปีสิ้นสุดวันที่ 31 ธันวาคม พ.ศ. ${buddhYearCurrent}`], [],
      ];
      notes.forEach(n => {
        noteRows.push([`${n.noteNo}. ${n.title}`]);
        if (n.type === "text") {
          n.content.split("\n").forEach(line => noteRows.push([`  ${line}`]));
        } else if (n.type === "table") {
          noteRows.push(["", `${buddhYearCurrent}`, `${buddhYearPrevious}`]);
          n.tableRows.forEach(tr => noteRows.push([`  ${tr.name}`, tr.current, tr.previous]));
          const totalCur = n.tableRows.reduce((s, r) => s + r.current, 0);
          const totalPrev = n.tableRows.reduce((s, r) => s + r.previous, 0);
          noteRows.push(["  รวม", totalCur, totalPrev]);
        } else if (n.type === "asset_movement") {
          noteRows.push(["", `31 ธ.ค. ${buddhYearPrevious}`, "เพิ่มขึ้น", "จำหน่าย", `31 ธ.ค. ${buddhYearCurrent}`]);
          noteRows.push(["ราคาทุน"]);
          n.costRows.forEach(r => noteRows.push([`  ${r.name}`, r.beginBalance, r.additions, r.disposals, r.endBalance]));
          noteRows.push(["ค่าเสื่อมราคาสะสม"]);
          n.depreciationRows.forEach(r => noteRows.push([`  ${r.name}`, r.beginBalance, r.additions, r.disposals, r.endBalance]));
          const costEnd = n.costRows.reduce((s, r) => s + r.endBalance, 0);
          const depEnd = n.depreciationRows.reduce((s, r) => s + r.endBalance, 0);
          noteRows.push(["  สุทธิ", "", "", "", costEnd - depEnd]);
        }
        noteRows.push([]);
      });
      const noteSheet = XLSX.utils.aoa_to_sheet(noteRows);
      noteSheet["!cols"] = [{ wch: 45 }, { wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(wb, noteSheet, "หมายเหตุประกอบงบการเงิน");
    }

    XLSX.writeFile(wb, `งบการเงิน_${companyName || "company"}_${yearCurrent}.xlsx`);
  };

  const handlePrint = () => { window.print(); };
  const handlePrintAll = () => {
    setPrintAllMode(true);
    setTimeout(() => {
      window.print();
      setPrintAllMode(false);
    }, 300);
  };
  const handlePreviewPrint = () => {
    const prevMode = previewMode;
    setPreviewMode(null);
    if (prevMode === "all") {
      setPrintAllMode(true);
      setTimeout(() => {
        window.print();
        setPrintAllMode(false);
      }, 100);
    } else {
      setTimeout(() => {
        window.print();
      }, 200);
    }
  };

  const getEditableNoteRef = (code: string): string => {
    if (noteRefOverrides[code] !== undefined) return noteRefOverrides[code];
    const auto = getRowNoteRef(code, noteRefMap);
    return auto ? String(auto) : "";
  };

  const renderBSRow = (r: ReportRow) => {
    const refVal = getEditableNoteRef(r.code);
    const pl = r.indent === 3 ? "pl-12" : r.indent === 2 ? "pl-8" : "pl-4";
    return (
      <tr key={r.code}>
        <td className={`py-1 ${pl} text-sm`}>{r.name}</td>
        <td className="py-1 text-center w-16">
          <input
            type="text"
            value={refVal}
            onChange={(e) => setNoteRef(r.code, e.target.value)}
            className="w-10 text-center text-sm text-blue-600 border-0 border-b border-transparent hover:border-blue-300 focus:border-blue-500 focus:outline-none bg-transparent"
            data-testid={`input-note-ref-bs-${r.code}`}
          />
        </td>
        <td className="py-1 text-right text-sm font-mono pr-4">{fmt(r.current)}</td>
        <td className="w-2"></td>
        <td className="py-1 text-right text-sm font-mono pr-4">{fmt(r.previous)}</td>
      </tr>
    );
  };

  const renderBSTotal = (label: string, current: number, previous: number, bold = false, doubleLine = false) => {
    const numBorder = doubleLine ? "border-t-2 border-b-4 border-double border-gray-800" : "border-t border-gray-400";
    return (
      <tr className={bold ? "font-bold" : "font-semibold"}>
        <td className="py-1 pl-4 text-sm">{label}</td>
        <td className="w-16"></td>
        <td className={`py-1 text-right text-sm font-mono pr-4 ${numBorder}`}>{fmt(current)}</td>
        <td className="w-2"></td>
        <td className={`py-1 text-right text-sm font-mono pr-4 ${numBorder}`}>{fmt(previous)}</td>
      </tr>
    );
  };

  const renderISRow = (r: ReportRow) => {
    const refVal = getEditableNoteRef(r.code);
    const pl = r.indent === 2 ? "pl-8" : "pl-4";
    return (
      <tr key={r.code}>
        <td className={`py-1 ${pl} text-sm`}>{r.name}</td>
        <td className="py-1 text-center w-16">
          <input
            type="text"
            value={refVal}
            onChange={(e) => setNoteRef(r.code, e.target.value)}
            className="w-10 text-center text-sm text-blue-600 border-0 border-b border-transparent hover:border-blue-300 focus:border-blue-500 focus:outline-none bg-transparent"
            data-testid={`input-note-ref-is-${r.code}`}
          />
        </td>
        <td className="py-1 text-right text-sm font-mono pr-4">{fmt(r.current)}</td>
        <td className="w-2"></td>
        <td className="py-1 text-right text-sm font-mono pr-4">{fmt(r.previous)}</td>
      </tr>
    );
  };

  const renderISTotal = (label: string, current: number, previous: number, bold = false, doubleLine = false) => {
    const numBorder = doubleLine ? "border-t-2 border-b-4 border-double border-gray-800" : "border-t border-gray-400";
    return (
      <tr className={bold ? "font-bold" : "font-semibold"}>
        <td className="py-1 pl-4 text-sm">{label}</td>
        <td className="w-16"></td>
        <td className={`py-1 text-right text-sm font-mono pr-4 ${numBorder}`}>{fmt(current)}</td>
        <td className="w-2"></td>
        <td className={`py-1 text-right text-sm font-mono pr-4 ${numBorder}`}>{fmt(previous)}</td>
      </tr>
    );
  };

  const renderNoteTableEditor = (note: NoteSection) => (
    <div className="space-y-2">
      <table className="w-full text-sm border">
        <thead>
          <tr className="bg-gray-50">
            <th className="text-left p-2 border-b">รายการ</th>
            <th className="text-right p-2 border-b w-32">พ.ศ. {buddhYearCurrent}</th>
            <th className="text-right p-2 border-b w-32">พ.ศ. {buddhYearPrevious}</th>
            <th className="w-10 border-b"></th>
          </tr>
        </thead>
        <tbody>
          {note.tableRows.map((row, idx) => (
            <tr key={idx}>
              <td className="p-1 border-b">
                <Input value={row.name} className="h-8 text-sm" onChange={(e) => {
                  const updated = [...note.tableRows];
                  updated[idx] = { ...updated[idx], name: e.target.value };
                  updateNote(note.id, "tableRows", updated);
                }} />
              </td>
              <td className="p-1 border-b">
                <Input type="number" value={row.current || ""} className="h-8 text-sm text-right" onChange={(e) => {
                  const updated = [...note.tableRows];
                  updated[idx] = { ...updated[idx], current: parseFloat(e.target.value) || 0 };
                  updateNote(note.id, "tableRows", updated);
                }} />
              </td>
              <td className="p-1 border-b">
                <Input type="number" value={row.previous || ""} className="h-8 text-sm text-right" onChange={(e) => {
                  const updated = [...note.tableRows];
                  updated[idx] = { ...updated[idx], previous: parseFloat(e.target.value) || 0 };
                  updateNote(note.id, "tableRows", updated);
                }} />
              </td>
              <td className="p-1 border-b text-center">
                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400" onClick={() => {
                  const updated = note.tableRows.filter((_, i) => i !== idx);
                  updateNote(note.id, "tableRows", updated);
                }}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-semibold bg-gray-50">
            <td className="p-2">รวม</td>
            <td className="p-2 text-right font-mono">{fmt(note.tableRows.reduce((s, r) => s + r.current, 0))}</td>
            <td className="p-2 text-right font-mono">{fmt(note.tableRows.reduce((s, r) => s + r.previous, 0))}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
      <Button variant="outline" size="sm" onClick={() => {
        updateNote(note.id, "tableRows", [...note.tableRows, { name: "", current: 0, previous: 0 }]);
      }}>
        <Plus className="w-3 h-3 mr-1" /> เพิ่มรายการ
      </Button>
    </div>
  );

  const renderAssetMovementEditor = (note: NoteSection, field: "costRows" | "depreciationRows", label: string) => (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-gray-700">{label}</h4>
      <table className="w-full text-sm border">
        <thead>
          <tr className="bg-gray-50">
            <th className="text-left p-2 border-b">รายการ</th>
            <th className="text-right p-2 border-b w-28">31 ธ.ค. {buddhYearPrevious}</th>
            <th className="text-right p-2 border-b w-28">เพิ่มขึ้น/ปรับปรุง</th>
            <th className="text-right p-2 border-b w-28">จำหน่าย/ปรับปรุง</th>
            <th className="text-right p-2 border-b w-28">31 ธ.ค. {buddhYearCurrent}</th>
            <th className="w-10 border-b"></th>
          </tr>
        </thead>
        <tbody>
          {note[field].map((row, idx) => (
            <tr key={idx}>
              <td className="p-1 border-b">
                <Input value={row.name} className="h-8 text-sm" onChange={(e) => {
                  const updated = [...note[field]];
                  updated[idx] = { ...updated[idx], name: e.target.value };
                  updateNote(note.id, field, updated);
                }} />
              </td>
              {(["beginBalance", "additions", "disposals", "endBalance"] as const).map(key => (
                <td key={key} className="p-1 border-b">
                  <Input type="number" value={row[key] || ""} className="h-8 text-sm text-right" onChange={(e) => {
                    const updated = [...note[field]];
                    updated[idx] = { ...updated[idx], [key]: parseFloat(e.target.value) || 0 };
                    updateNote(note.id, field, updated);
                  }} />
                </td>
              ))}
              <td className="p-1 border-b text-center">
                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400" onClick={() => {
                  updateNote(note.id, field, note[field].filter((_, i) => i !== idx));
                }}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-semibold bg-gray-50">
            <td className="p-2">รวม</td>
            <td className="p-2 text-right font-mono">{fmt(note[field].reduce((s, r) => s + r.beginBalance, 0))}</td>
            <td className="p-2 text-right font-mono">{fmt(note[field].reduce((s, r) => s + r.additions, 0))}</td>
            <td className="p-2 text-right font-mono">{fmt(note[field].reduce((s, r) => s + r.disposals, 0))}</td>
            <td className="p-2 text-right font-mono">{fmt(note[field].reduce((s, r) => s + r.endBalance, 0))}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
      <Button variant="outline" size="sm" onClick={() => {
        updateNote(note.id, field, [...note[field], { name: "", beginBalance: 0, additions: 0, disposals: 0, endBalance: 0 }]);
      }}>
        <Plus className="w-3 h-3 mr-1" /> เพิ่มรายการ
      </Button>
    </div>
  );

  const renderNotePrint = (note: NoteSection) => {
    if (note.type === "text") {
      return <div className="whitespace-pre-wrap text-sm leading-relaxed pl-6">{note.content}</div>;
    }
    if (note.type === "table") {
      return (
        <div className="pl-6">
          <UnitLabel />
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left py-1"></th>
                <th className="text-right py-1 w-[22%] pr-4 border-b border-gray-800">{buddhYearCurrent}</th>
                <th className="w-2"></th>
                <th className="text-right py-1 w-[22%] pr-4 border-b border-gray-800">{buddhYearPrevious}</th>
              </tr>
            </thead>
            <tbody>
              {note.tableRows.map((r, i) => (
                <tr key={i}><td className="py-1 pl-2">{r.name}</td><td className="py-1 text-right font-mono pr-4">{fmt(r.current)}</td><td className="w-2"></td><td className="py-1 text-right font-mono pr-4">{fmt(r.previous)}</td></tr>
              ))}
              <tr className="font-semibold">
                <td className="py-1 pl-6">รวม</td>
                <td className="py-1 text-right font-mono pr-4 border-t border-b-2 border-double border-gray-800">{fmt(note.tableRows.reduce((s, r) => s + r.current, 0))}</td>
                <td className="w-2"></td>
                <td className="py-1 text-right font-mono pr-4 border-t border-b-2 border-double border-gray-800">{fmt(note.tableRows.reduce((s, r) => s + r.previous, 0))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      );
    }
    if (note.type === "asset_movement") {
      const costTotal = { begin: note.costRows.reduce((s, r) => s + r.beginBalance, 0), add: note.costRows.reduce((s, r) => s + r.additions, 0), disp: note.costRows.reduce((s, r) => s + r.disposals, 0), end: note.costRows.reduce((s, r) => s + r.endBalance, 0) };
      const depTotal = { begin: note.depreciationRows.reduce((s, r) => s + r.beginBalance, 0), add: note.depreciationRows.reduce((s, r) => s + r.additions, 0), disp: note.depreciationRows.reduce((s, r) => s + r.disposals, 0), end: note.depreciationRows.reduce((s, r) => s + r.endBalance, 0) };
      return (
        <div className="pl-4">
          <UnitLabel />
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left py-1 w-[30%]"></th>
                <th className="text-right py-1 pr-3 border-b border-gray-800">31 ธ.ค. {buddhYearPrevious}</th>
                <th className="w-2"></th>
                <th className="text-right py-1 pr-3 border-b border-gray-800">เพิ่มขึ้น/ปรับปรุง</th>
                <th className="w-2"></th>
                <th className="text-right py-1 pr-3 border-b border-gray-800">จำหน่าย/ปรับปรุง</th>
                <th className="w-2"></th>
                <th className="text-right py-1 pr-3 border-b border-gray-800">31 ธ.ค. {buddhYearCurrent}</th>
              </tr>
            </thead>
            <tbody>
              <tr><td colSpan={8} className="py-1 font-semibold">ราคาทุน</td></tr>
              {note.costRows.map((r, i) => (
                <tr key={`c${i}`}><td className="py-1 pl-4">{r.name}</td><td className="py-1 text-right font-mono pr-3">{fmt(r.beginBalance)}</td><td className="w-2"></td><td className="py-1 text-right font-mono pr-3">{fmt(r.additions)}</td><td className="w-2"></td><td className="py-1 text-right font-mono pr-3">{fmt(r.disposals)}</td><td className="w-2"></td><td className="py-1 text-right font-mono pr-3">{fmt(r.endBalance)}</td></tr>
              ))}
              <tr className="font-semibold"><td className="py-1 pl-8">รวม</td><td className="py-1 text-right font-mono pr-3 border-t border-b-2 border-double border-gray-800">{fmt(costTotal.begin)}</td><td className="w-2"></td><td className="py-1 text-right font-mono pr-3 border-t border-b-2 border-double border-gray-800">{fmt(costTotal.add)}</td><td className="w-2"></td><td className="py-1 text-right font-mono pr-3 border-t border-b-2 border-double border-gray-800">{fmt(costTotal.disp)}</td><td className="w-2"></td><td className="py-1 text-right font-mono pr-3 border-t border-b-2 border-double border-gray-800">{fmt(costTotal.end)}</td></tr>
              <tr><td colSpan={8} className="py-1 font-semibold pt-2">ค่าเสื่อมราคาสะสม</td></tr>
              {note.depreciationRows.map((r, i) => (
                <tr key={`d${i}`}><td className="py-1 pl-4">{r.name}</td><td className="py-1 text-right font-mono pr-3">{fmt(r.beginBalance)}</td><td className="w-2"></td><td className="py-1 text-right font-mono pr-3">{fmt(r.additions)}</td><td className="w-2"></td><td className="py-1 text-right font-mono pr-3">{fmt(r.disposals)}</td><td className="w-2"></td><td className="py-1 text-right font-mono pr-3">{fmt(r.endBalance)}</td></tr>
              ))}
              <tr className="font-semibold"><td className="py-1 pl-8">รวม</td><td className="py-1 text-right font-mono pr-3 border-t border-b-2 border-double border-gray-800">{fmt(depTotal.begin)}</td><td className="w-2"></td><td className="py-1 text-right font-mono pr-3 border-t border-b-2 border-double border-gray-800">{fmt(depTotal.add)}</td><td className="w-2"></td><td className="py-1 text-right font-mono pr-3 border-t border-b-2 border-double border-gray-800">{fmt(depTotal.disp)}</td><td className="w-2"></td><td className="py-1 text-right font-mono pr-3 border-t border-b-2 border-double border-gray-800">{fmt(depTotal.end)}</td></tr>
              <tr className="font-bold"><td className="py-1 pl-8">สุทธิ</td><td className="py-1 text-right font-mono pr-3 border-t-2 border-double border-gray-800">{fmt(costTotal.begin - depTotal.begin)}</td><td className="w-2"></td><td></td><td className="w-2"></td><td></td><td className="w-2"></td><td className="py-1 text-right font-mono pr-3 border-t-2 border-double border-gray-800">{fmt(costTotal.end - depTotal.end)}</td></tr>
            </tbody>
          </table>
        </div>
      );
    }
    return null;
  };

  const retainedEarningsFromTB = reportData?.equityRows.find(r => r.code.startsWith("303") || r.code.startsWith("320") || r.name.includes("สะสม") || r.name.includes("กำไร"));
  const paidUpCapital = reportData?.equityRows.find(r => (r.code.startsWith("301") || r.code.startsWith("302")) && (r.name.includes("ชำระ") || r.name.includes("ทุนที่") || r.name.includes("หุ้น")));
  const paidUpVal = paidUpCapital?.current ?? 250000;
  const retainedBeginCur = retainedEarningsFromTB?.current ?? 0;
  const retainedBeginPrev = isFirstYear ? 0 : (retainedEarningsFromTB?.previous ?? 0);
  const retainedPrev = retainedBeginPrev + (reportData?.netIncome.previous ?? 0);
  const retainedCur = isFirstYear
    ? (reportData?.netIncome.previous ?? 0) + (reportData?.netIncome.current ?? 0)
    : retainedBeginCur + (reportData?.netIncome.current ?? 0);
  const beginRetainedPrevYear = isFirstYear ? 0 : retainedBeginPrev;

  const prevYearOpenLabel = isFirstYear && incorporationDate
    ? `ยอดคงเหลือต้นงวด วันที่ ${incorporationDate}`
    : `ยอดคงเหลือต้นงวด วันที่ 1 มกราคม ${buddhYearPrevious}`;

  const totalAssetsCur = reportData?.totalAssets.current ?? 0;
  const totalAssetsPrev = reportData?.totalAssets.previous ?? 0;
  const totalLiabEqCur = (reportData?.totalLiabilities.current ?? 0) + paidUpVal + retainedCur;
  const totalLiabEqPrev = (reportData?.totalLiabilities.previous ?? 0) + paidUpVal + retainedPrev;
  const isBalancedCur = Math.abs(totalAssetsCur - totalLiabEqCur) < 0.01;
  const isBalancedPrev = Math.abs(totalAssetsPrev - totalLiabEqPrev) < 0.01;
  const [showBalanceCheck, setShowBalanceCheck] = useState(false);
  const [showImportCheck, setShowImportCheck] = useState(false);
  const prevReportDataRef = useRef<typeof reportData>(null);

  useEffect(() => {
    if (reportData && !prevReportDataRef.current) {
      setShowImportCheck(true);
    }
    prevReportDataRef.current = reportData;
  }, [reportData]);

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2 no-print">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-[#fb9678]" />
            <h1 className="text-xl font-bold text-gray-800" data-testid="text-page-title">
              งบการเงิน (ส่งราชการ)
            </h1>
          </div>
          <div className="flex gap-2 flex-wrap">
            {currentDraftName && (
              <span className="flex items-center text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                <FileText className="h-3 w-3 mr-1" /> {currentDraftName}
              </span>
            )}
            <Button variant="outline" size="sm" className="text-blue-600 border-blue-300 hover:bg-blue-50" onClick={() => setShowLoadDialog(true)} data-testid="button-load-draft">
              <FolderOpen className="h-4 w-4 mr-1" /> โหลดร่าง
            </Button>
            <Button variant="outline" size="sm" className="text-green-600 border-green-300 hover:bg-green-50" onClick={handleSave} data-testid="button-save-draft">
              <Save className="h-4 w-4 mr-1" /> {currentDraftId ? "บันทึก" : "บันทึกร่าง"}
            </Button>
            {currentDraftId && (
              <Button variant="outline" size="sm" className="text-amber-600 border-amber-300 hover:bg-amber-50" onClick={handleSaveAs} data-testid="button-save-as-draft">
                <Save className="h-4 w-4 mr-1" /> บันทึกเป็น...
              </Button>
            )}
            <Button variant="outline" size="sm" className="text-red-500 border-red-300 hover:bg-red-50" onClick={handleReset} data-testid="button-reset">
              <Trash2 className="h-4 w-4 mr-1" /> เคลียร์ / ทำรายใหม่
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className={printAllMode ? "print:hidden" : ""}>
          <TabsList className="mb-4 no-print flex-wrap">
            <TabsTrigger value="import" data-testid="tab-import" className="data-[state=active]:bg-[#fb9678] data-[state=active]:text-white">
              <Upload className="h-4 w-4 mr-1" /> 1. นำเข้าข้อมูล
            </TabsTrigger>
            <TabsTrigger value="balance-sheet" data-testid="tab-balance-sheet" disabled={!canGenerate} className="data-[state=active]:bg-[#fb9678] data-[state=active]:text-white">
              งบฐานะการเงิน
            </TabsTrigger>
            <TabsTrigger value="income-statement" data-testid="tab-income-statement" disabled={!canGenerate} className="data-[state=active]:bg-[#fb9678] data-[state=active]:text-white">
              งบกำไรขาดทุน
            </TabsTrigger>
            <TabsTrigger value="equity-changes" data-testid="tab-equity-changes" disabled={!canGenerate} className="data-[state=active]:bg-[#fb9678] data-[state=active]:text-white">
              งบเปลี่ยนแปลงส่วนของผู้ถือหุ้น
            </TabsTrigger>
            <TabsTrigger value="notes" data-testid="tab-notes" disabled={!canGenerate} className="data-[state=active]:bg-[#fb9678] data-[state=active]:text-white">
              หมายเหตุประกอบ
            </TabsTrigger>
          </TabsList>

          {/* ===== TAB: IMPORT ===== */}
          <TabsContent value="import">
            <div className="space-y-4">
              <Card className="border-0 shadow-md">
                <CardContent className="p-6">
                  <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#fb9678]" />
                    ข้อมูลกิจการ
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <Label className="text-xs font-bold">ชื่อบริษัท</Label>
                      <Input placeholder="บริษัท ... จำกัด" value={companyName} onChange={e => setCompanyName(e.target.value)} data-testid="input-company-name" />
                    </div>
                    <div>
                      <Label className="text-xs font-bold">เลขประจำตัวผู้เสียภาษี</Label>
                      <Input placeholder="0-0000-00000-00-0" value={taxId} onChange={e => setTaxId(e.target.value)} data-testid="input-tax-id" />
                    </div>
                    <div>
                      <Label className="text-xs font-bold">วันที่จัดตั้งบริษัท</Label>
                      <Input placeholder="เช่น 1 มกราคม 2555" value={incorporationDate} onChange={e => setIncorporationDate(e.target.value)} data-testid="input-incorporation-date" />
                      <label className="flex items-center gap-2 mt-2 cursor-pointer">
                        <input type="checkbox" checked={isFirstYear} onChange={e => setIsFirstYear(e.target.checked)} className="rounded border-gray-300" data-testid="checkbox-first-year" />
                        <span className="text-xs text-gray-600">ปีแรกของกิจการ (กำไรสะสมต้นงวด = 0)</span>
                      </label>
                    </div>
                    <div>
                      <Label className="text-xs font-bold">เลขทะเบียนนิติบุคคล</Label>
                      <Input placeholder="0105XXXXXXXXX" value={registrationNo} onChange={e => setRegistrationNo(e.target.value)} data-testid="input-registration-no" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div>
                      <Label className="text-xs font-bold">ที่อยู่สำนักงานใหญ่</Label>
                      <Input placeholder="เลขที่ ... ถนน ... แขวง/ตำบล ... เขต/อำเภอ ... จังหวัด ..." value={headOfficeAddress} onChange={e => setHeadOfficeAddress(e.target.value)} data-testid="input-head-office-address" />
                    </div>
                    <div>
                      <Label className="text-xs font-bold">ประเภทธุรกิจ</Label>
                      <Input placeholder="เช่น จำหน่ายสินค้าออนไลน์" value={businessType} onChange={e => setBusinessType(e.target.value)} data-testid="input-business-type" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                    <div>
                      <Label className="text-xs font-bold">ผู้ลงนาม</Label>
                      <Input placeholder="ชื่อ-นามสกุล" value={signerName} onChange={e => setSignerName(e.target.value)} data-testid="input-signer-name" />
                    </div>
                    <div>
                      <Label className="text-xs font-bold">ตำแหน่ง</Label>
                      <Input placeholder="กรรมการ" value={signerTitle} onChange={e => setSignerTitle(e.target.value)} data-testid="input-signer-title" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                    <div>
                      <Label className="text-xs font-bold">ทุนจดทะเบียน (หุ้น)</Label>
                      <Input placeholder="10,000" value={registeredCapitalShares} onChange={e => setRegisteredCapitalShares(e.target.value)} data-testid="input-reg-shares" />
                    </div>
                    <div>
                      <Label className="text-xs font-bold">มูลค่าหุ้นละ (บาท)</Label>
                      <Input placeholder="100" value={registeredCapitalPerShare} onChange={e => setRegisteredCapitalPerShare(e.target.value)} data-testid="input-reg-per-share" />
                    </div>
                    <div>
                      <Label className="text-xs font-bold">ทุนชำระแล้ว (หุ้น)</Label>
                      <Input placeholder="10,000" value={paidUpShares} onChange={e => setPaidUpShares(e.target.value)} data-testid="input-paid-shares" />
                    </div>
                    <div>
                      <Label className="text-xs font-bold">ชำระหุ้นละ (บาท)</Label>
                      <Input placeholder="25" value={paidUpPerShare} onChange={e => setPaidUpPerShare(e.target.value)} data-testid="input-paid-per-share" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border-0 shadow-md">
                  <CardContent className="p-6">
                    <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#05b187]" />
                      งบทดลองปีปัจจุบัน (พ.ศ. {buddhYearCurrent})
                    </h3>
                    <div className="flex items-center gap-3 mb-3">
                      <Label className="text-xs font-bold whitespace-nowrap">ปี ค.ศ.</Label>
                      <Input type="number" value={yearCurrent} onChange={e => setYearCurrent(e.target.value)} className="w-24" data-testid="input-year-current" />
                      <span className="text-xs text-muted-foreground">พ.ศ. {buddhYearCurrent}</span>
                    </div>
                    <input ref={fileRef1} type="file" accept=".xls,.xlsx,.csv" onChange={(e) => handleUpload("current", e)}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-600 hover:file:bg-green-100"
                      data-testid="input-file-current" />
                    {currentRows.length > 0 && (
                      <div className="flex items-center gap-2 mt-3 text-sm text-green-600">
                        <Check className="h-4 w-4" /> อ่านได้ {currentRows.length} รายการ
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-md">
                  <CardContent className="p-6">
                    <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--theme-primary)]" />
                      งบทดลองปีก่อน (พ.ศ. {buddhYearPrevious})
                    </h3>
                    <div className="flex items-center gap-3 mb-3">
                      <Label className="text-xs font-bold whitespace-nowrap">ปี ค.ศ.</Label>
                      <Input type="number" value={yearPrevious} onChange={e => setYearPrevious(e.target.value)} className="w-24" data-testid="input-year-previous" />
                      <span className="text-xs text-muted-foreground">พ.ศ. {buddhYearPrevious}</span>
                    </div>
                    <input ref={fileRef2} type="file" accept=".xls,.xlsx,.csv" onChange={(e) => handleUpload("previous", e)}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-600 hover:file:bg-blue-100"
                      data-testid="input-file-previous" />
                    {previousRows.length > 0 && (
                      <div className="flex items-center gap-2 mt-3 text-sm text-blue-600">
                        <Check className="h-4 w-4" /> อ่านได้ {previousRows.length} รายการ
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {canGenerate && (
                <Card className="border-0 shadow-md bg-green-50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div className="flex items-center gap-2 text-green-700">
                        <Check className="h-5 w-5" />
                        <span className="font-semibold text-sm">พร้อมสร้างงบการเงิน — คลิก tab ด้านบนเพื่อดูรายงาน</span>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" className="bg-[#05b187] hover:bg-[#049a76]" onClick={() => setActiveTab("balance-sheet")} data-testid="button-goto-bs">
                          ดูงบฐานะการเงิน
                        </Button>
                        <Button size="sm" variant="outline" className="border-green-400 text-green-700 hover:bg-green-100" onClick={exportExcel} data-testid="button-export-all-excel">
                          <Download className="h-4 w-4 mr-1" /> Excel ทั้งหมด
                        </Button>
                        <Button size="sm" className="bg-[#fb9678] hover:bg-[#e8876a] text-white" onClick={() => setPreviewMode("all")} data-testid="button-print-all">
                          <Printer className="h-4 w-4 mr-1" /> พิมพ์ทั้งหมด / PDF
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {!canGenerate && (currentRows.length > 0 || previousRows.length > 0) && (
                <div className="flex items-center gap-2 text-sm text-amber-600">
                  <AlertTriangle className="h-4 w-4" /> กรุณานำเข้างบทดลองทั้ง 2 ปี เพื่อสร้างงบการเงิน
                </div>
              )}
            </div>
          </TabsContent>

          {/* ===== TAB: BALANCE SHEET ===== */}
          <TabsContent value="balance-sheet">
            {reportData && (
              <div className="space-y-4 fs-statement-page">
                <div className="flex gap-2 no-print flex-wrap">
                  <Button size="sm" className={`${isBalancedCur && isBalancedPrev ? 'bg-[#05b187] hover:bg-[#049a75]' : 'bg-[#f94d4d] hover:bg-[#e03e3e]'} text-white`} onClick={() => setShowBalanceCheck(true)} data-testid="button-balance-check">
                    {isBalancedCur && isBalancedPrev ? <Check className="h-4 w-4 mr-1" /> : <AlertTriangle className="h-4 w-4 mr-1" />}
                    ตรวจสอบงบดุล
                  </Button>
                  <Button size="sm" className="bg-[#fb9678] hover:bg-[#e8876a]" onClick={() => setPreviewMode("bs")} data-testid="button-print-bs">
                    <Printer className="h-4 w-4 mr-1" /> พิมพ์ / PDF
                  </Button>
                  <Button size="sm" className="bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] text-white" onClick={() => setPreviewMode("all")} data-testid="button-print-all-from-bs">
                    <Printer className="h-4 w-4 mr-1" /> ดาวน์โหลดทุกไฟล์ / PDF
                  </Button>
                  <Button size="sm" variant="outline" onClick={exportExcel} data-testid="button-excel-bs">
                    <Download className="h-4 w-4 mr-1" /> Excel
                  </Button>
                </div>
                <Card className="border-0 shadow-md print:shadow-none">
                  <CardContent className="p-6">
                    <div className="text-center mb-4 space-y-1">
                      <h2 className="text-base font-bold">{companyName || "[ชื่อบริษัท]"}</h2>
                      <h3 className="text-sm font-bold">งบฐานะการเงิน</h3>
                      <p className="text-sm text-muted-foreground">ณ วันที่ 31 ธันวาคม {buddhYearCurrent}</p>
                    </div>
                    <UnitLabel />
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-800">
                          <th className="py-1 text-left w-[45%]"></th>
                          <th className="text-center text-sm font-bold py-1 w-16">หมายเหตุ</th>
                          <th className="text-right text-sm font-bold py-1 w-[22%] pr-4">{buddhYearCurrent}</th>
                          <th className="w-2"></th>
                          <th className="text-right text-sm font-bold py-1 w-[22%] pr-4">{buddhYearPrevious}</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        <tr><td colSpan={5} className="pt-3 pb-1 font-bold">สินทรัพย์</td></tr>
                        <tr><td colSpan={5} className="pl-2 pb-1 font-semibold text-gray-600">สินทรัพย์หมุนเวียน</td></tr>
                        {reportData.currentAssets.map(renderBSRow)}
                        {renderBSTotal("รวมสินทรัพย์หมุนเวียน", reportData.totalCurrentAssets.current, reportData.totalCurrentAssets.previous)}
                        {reportData.nonCurrentAssets.length > 0 && (
                          <>
                            <tr><td colSpan={5} className="pl-2 pt-2 pb-1 font-semibold text-gray-600">สินทรัพย์ไม่หมุนเวียน</td></tr>
                            {reportData.nonCurrentAssets.map(renderBSRow)}
                            {renderBSTotal("รวมสินทรัพย์ไม่หมุนเวียน", reportData.totalNonCurrentAssets.current, reportData.totalNonCurrentAssets.previous)}
                          </>
                        )}
                        {renderBSTotal("รวมสินทรัพย์", reportData.totalAssets.current, reportData.totalAssets.previous, true, true)}

                        <tr><td colSpan={5} className="pt-4 pb-1 font-bold">หนี้สินและส่วนของผู้ถือหุ้น</td></tr>
                        <tr><td colSpan={5} className="pl-2 pb-1 font-semibold text-gray-600">หนี้สินหมุนเวียน</td></tr>
                        {reportData.currentLiabilities.map(renderBSRow)}
                        {renderBSTotal("รวมหนี้สินหมุนเวียน", reportData.totalCurrentLiabilities.current, reportData.totalCurrentLiabilities.previous)}
                        {reportData.nonCurrentLiabilities.length > 0 && (
                          <>
                            <tr><td colSpan={5} className="pl-2 pt-2 pb-1 font-semibold text-gray-600">หนี้สินไม่หมุนเวียน</td></tr>
                            {reportData.nonCurrentLiabilities.map(renderBSRow)}
                            {renderBSTotal("รวมหนี้สินไม่หมุนเวียน", reportData.totalNonCurrentLiabilities.current, reportData.totalNonCurrentLiabilities.previous)}
                          </>
                        )}
                        {renderBSTotal("รวมหนี้สิน", reportData.totalLiabilities.current, reportData.totalLiabilities.previous, true)}

                        <tr><td colSpan={5} className="pl-2 pt-3 pb-1 font-semibold text-gray-600">ส่วนของผู้ถือหุ้น</td></tr>
                        <tr><td colSpan={5} className="pl-4 text-sm font-semibold text-gray-500">ทุนเรือนหุ้น</td></tr>
                        <tr>
                          <td className="py-1 pl-8 text-sm" colSpan={2}>ทุนจดทะเบียน หุ้นสามัญ {registeredCapitalShares} หุ้น มูลค่าหุ้นละ {registeredCapitalPerShare} บาท</td>
                          <td className="py-1 text-right text-sm font-mono pr-4">{fmt(parseFloat(registeredCapitalShares.replace(/,/g, "")) * parseFloat(registeredCapitalPerShare.replace(/,/g, "")))}</td>
                          <td className="w-2"></td>
                          <td className="py-1 text-right text-sm font-mono pr-4">{fmt(parseFloat(registeredCapitalShares.replace(/,/g, "")) * parseFloat(registeredCapitalPerShare.replace(/,/g, "")))}</td>
                        </tr>
                        <tr>
                          <td className="py-1 pl-8 text-sm" colSpan={2}>ทุนที่ชำระแล้ว หุ้นสามัญ {paidUpShares} หุ้น มูลค่าหุ้นละ {paidUpPerShare} บาท</td>
                          <td className="py-1 text-right text-sm font-mono pr-4">{fmt(paidUpVal)}</td>
                          <td className="w-2"></td>
                          <td className="py-1 text-right text-sm font-mono pr-4">{fmt(paidUpVal)}</td>
                        </tr>
                        <tr>
                          <td className="py-1 pl-8 text-sm" colSpan={2}>กำไร (ขาดทุน) สะสมยังไม่ได้จัดสรร</td>
                          <td className="py-1 text-right text-sm font-mono pr-4">{fmt(retainedCur)}</td>
                          <td className="w-2"></td>
                          <td className="py-1 text-right text-sm font-mono pr-4">{fmt(retainedPrev)}</td>
                        </tr>
                        {renderBSTotal("รวมส่วนของผู้ถือหุ้น", paidUpVal + retainedCur, paidUpVal + retainedPrev)}
                        {renderBSTotal("รวมหนี้สินและส่วนของผู้ถือหุ้น", reportData.totalLiabilities.current + paidUpVal + retainedCur, reportData.totalLiabilities.previous + paidUpVal + retainedPrev, true, true)}
                      </tbody>
                    </table>
                    <StatementFooter signerName={signerName} signerTitle={signerTitle} showQualification={false} />
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* ===== TAB: INCOME STATEMENT ===== */}
          <TabsContent value="income-statement">
            {reportData && (
              <div className="space-y-4 fs-statement-page">
                <div className="flex gap-2 no-print">
                  <Button size="sm" className="bg-[#fb9678] hover:bg-[#e8876a]" onClick={() => setPreviewMode("is")} data-testid="button-print-is">
                    <Printer className="h-4 w-4 mr-1" /> พิมพ์ / PDF
                  </Button>
                  <Button size="sm" className="bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] text-white" onClick={() => setPreviewMode("all")} data-testid="button-print-all-from-is">
                    <Printer className="h-4 w-4 mr-1" /> ดาวน์โหลดทุกไฟล์ / PDF
                  </Button>
                  <Button size="sm" variant="outline" onClick={exportExcel} data-testid="button-excel-is">
                    <Download className="h-4 w-4 mr-1" /> Excel
                  </Button>
                </div>
                <Card className="border-0 shadow-md print:shadow-none">
                  <CardContent className="p-6">
                    <div className="text-center mb-4 space-y-1">
                      <h2 className="text-base font-bold">{companyName || "[ชื่อบริษัท]"}</h2>
                      <h3 className="text-sm font-bold">งบกำไรขาดทุน</h3>
                      <p className="text-sm text-muted-foreground">สำหรับปีสิ้นสุดวันที่ 31 ธันวาคม {buddhYearCurrent}</p>
                    </div>
                    <UnitLabel />
                    <table className="w-full">
                      <thead>
                        <tr>
                          <th className="py-1 text-left w-[45%]"></th>
                          <th className="py-1 w-16"></th>
                          <th className="text-right text-sm font-bold py-1 w-[22%] pr-4 border-b border-gray-800">{buddhYearCurrent}</th>
                          <th className="w-2"></th>
                          <th className="text-right text-sm font-bold py-1 w-[22%] pr-4 border-b border-gray-800">{buddhYearPrevious}</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        <tr><td colSpan={5} className="pt-3 pb-1 font-bold">รายได้</td></tr>
                        {reportData.salesRevenue.length > 0 && reportData.salesRevenue.map(renderISRow)}
                        {reportData.otherIncome.length > 0 ? reportData.otherIncome.map(renderISRow) : (
                          <tr><td className="py-1 pl-4 text-sm">รายได้อื่น</td><td className="w-16"></td><td className="py-1 text-right text-sm font-mono pr-4">{fmt(0)}</td><td className="w-2"></td><td className="py-1 text-right text-sm font-mono pr-4">{fmt(0)}</td></tr>
                        )}
                        {reportData.salesRevenue.length === 0 && reportData.otherIncome.length === 0 && reportData.revenues.map(renderISRow)}
                        {renderISTotal("รวมรายได้", reportData.totalRevenue.current, reportData.totalRevenue.previous)}

                        <tr><td colSpan={5} className="pt-4 pb-1 font-bold">ค่าใช้จ่าย</td></tr>
                        {reportData.costOfSales.length > 0 && reportData.costOfSales.map(renderISRow)}
                        {reportData.sellingExpenses.length > 0 && reportData.sellingExpenses.map(renderISRow)}
                        {reportData.adminExpenses.length > 0 && reportData.adminExpenses.map(renderISRow)}
                        {renderISTotal("รวมค่าใช้จ่าย",
                          reportData.totalCostOfSales.current + reportData.totalSellingExpenses.current + reportData.totalAdminExpenses.current,
                          reportData.totalCostOfSales.previous + reportData.totalSellingExpenses.previous + reportData.totalAdminExpenses.previous
                        )}

                        {renderISTotal("กำไร (ขาดทุน) ก่อนต้นทุนทางการเงินและภาษีเงินได้", reportData.profitBeforeFinanceAndTax.current, reportData.profitBeforeFinanceAndTax.previous)}
                        <tr>
                          <td className="py-1 pl-4 text-sm">ต้นทุนทางการเงิน</td>
                          <td className="w-16"></td>
                          <td className="py-1 text-right text-sm font-mono pr-4">{fmt(reportData.totalFinanceCosts.current)}</td>
                          <td className="w-2"></td>
                          <td className="py-1 text-right text-sm font-mono pr-4">{fmt(reportData.totalFinanceCosts.previous)}</td>
                        </tr>
                        {renderISTotal("กำไร(ขาดทุน)ก่อนภาษีเงินได้", reportData.profitBeforeTax.current, reportData.profitBeforeTax.previous)}
                        <tr>
                          <td className="py-1 pl-4 text-sm">ค่าใช้จ่ายภาษีเงินได้</td>
                          <td className="w-16"></td>
                          <td className="py-1 text-right text-sm font-mono pr-4">{fmt(reportData.totalIncomeTax.current)}</td>
                          <td className="w-2"></td>
                          <td className="py-1 text-right text-sm font-mono pr-4">{fmt(reportData.totalIncomeTax.previous)}</td>
                        </tr>
                        {renderISTotal("กำไร(ขาดทุน)สุทธิ", reportData.netIncome.current, reportData.netIncome.previous, true, true)}
                      </tbody>
                    </table>
                    <StatementFooter signerName={signerName} signerTitle={signerTitle} />
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* ===== TAB: EQUITY CHANGES ===== */}
          <TabsContent value="equity-changes">
            {reportData && (
              <div className="space-y-4 fs-statement-page">
                <div className="flex gap-2 no-print">
                  <Button size="sm" className="bg-[#fb9678] hover:bg-[#e8876a]" onClick={() => setPreviewMode("eq")} data-testid="button-print-eq">
                    <Printer className="h-4 w-4 mr-1" /> พิมพ์ / PDF
                  </Button>
                  <Button size="sm" variant="outline" onClick={exportExcel} data-testid="button-excel-eq">
                    <Download className="h-4 w-4 mr-1" /> Excel
                  </Button>
                </div>
                <Card className="border-0 shadow-md print:shadow-none">
                  <CardContent className="p-6">
                    <div className="text-center mb-4 space-y-1">
                      <h2 className="text-base font-bold">{companyName || "[ชื่อบริษัท]"}</h2>
                      <h3 className="text-sm font-bold">งบการเปลี่ยนแปลงส่วนของผู้ถือหุ้น</h3>
                      <p className="text-sm text-muted-foreground">สำหรับปีสิ้นสุดวันที่ 31 ธันวาคม {buddhYearCurrent}</p>
                    </div>
                    <UnitLabel />
                    <table className="w-full text-sm">
                      <thead>
                        <tr>
                          <th className="py-1 text-left w-[40%]"></th>
                          <th className="text-center font-bold py-1">ทุนที่ออกและ</th>
                          <th className="w-2"></th>
                          <th className="text-center font-bold py-1">กำไร</th>
                          <th className="w-2"></th>
                          <th className="py-1"></th>
                        </tr>
                        <tr>
                          <th className="py-1 text-left"></th>
                          <th className="text-center font-bold py-1 border-b border-gray-800">ชำระแล้ว</th>
                          <th className="w-2"></th>
                          <th className="text-center font-bold py-1 border-b border-gray-800">(ขาดทุน) สะสม</th>
                          <th className="w-2"></th>
                          <th className="text-center font-bold py-1 border-b border-gray-800">รวม</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="font-bold">
                          <td className="py-2">{prevYearOpenLabel}</td>
                          <td className="py-2 text-right font-mono pr-4">{fmt(paidUpVal)}</td>
                          <td className="w-2"></td>
                          <td className="py-2 text-right font-mono pr-4">{isFirstYear ? "-" : fmt(beginRetainedPrevYear)}</td>
                          <td className="w-2"></td>
                          <td className="py-2 text-right font-mono pr-4">{fmt(paidUpVal + beginRetainedPrevYear)}</td>
                        </tr>
                        <tr>
                          <td className="py-2">กำไร (ขาดทุน) สุทธิ{isFirstYear ? ` ประจำปี ${buddhYearPrevious}` : ""}</td>
                          <td className="py-2 text-right font-mono pr-4">-</td>
                          <td className="w-2"></td>
                          <td className="py-2 text-right font-mono pr-4">{fmt(reportData.netIncome.previous)}</td>
                          <td className="w-2"></td>
                          <td className="py-2 text-right font-mono pr-4">{fmt(reportData.netIncome.previous)}</td>
                        </tr>
                        <tr className="font-bold">
                          <td className="py-2">ยอดคงเหลือปลายงวด วันที่ 31 ธันวาคม {buddhYearPrevious}</td>
                          <td className="py-2 text-right font-mono pr-4 border-t border-gray-400">{fmt(paidUpVal)}</td>
                          <td className="w-2"></td>
                          <td className="py-2 text-right font-mono pr-4 border-t border-gray-400">{fmt(retainedPrev)}</td>
                          <td className="w-2"></td>
                          <td className="py-2 text-right font-mono pr-4 border-t border-gray-400">{fmt(paidUpVal + retainedPrev)}</td>
                        </tr>
                        <tr>
                          <td className="py-2">กำไร (ขาดทุน) สุทธิ{isFirstYear ? ` ประจำปี ${buddhYearCurrent}` : ""}</td>
                          <td className="py-2 text-right font-mono pr-4">-</td>
                          <td className="w-2"></td>
                          <td className="py-2 text-right font-mono pr-4">{fmt(reportData.netIncome.current)}</td>
                          <td className="w-2"></td>
                          <td className="py-2 text-right font-mono pr-4">{fmt(reportData.netIncome.current)}</td>
                        </tr>
                        <tr className="font-bold">
                          <td className="py-2">ยอดคงเหลือปลายงวด วันที่ 31 ธันวาคม {buddhYearCurrent}</td>
                          <td className="py-2 text-right font-mono pr-4 border-t border-b-2 border-double border-gray-800">{fmt(paidUpVal)}</td>
                          <td className="w-2"></td>
                          <td className="py-2 text-right font-mono pr-4 border-t border-b-2 border-double border-gray-800">{fmt(retainedCur)}</td>
                          <td className="w-2"></td>
                          <td className="py-2 text-right font-mono pr-4 border-t border-b-2 border-double border-gray-800">{fmt(paidUpVal + retainedCur)}</td>
                        </tr>
                      </tbody>
                    </table>
                    <StatementFooter signerName={signerName} signerTitle={signerTitle} showQualification={false} />
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* ===== TAB: NOTES ===== */}
          <TabsContent value="notes">
            <div className="space-y-4 fs-statement-page">
              <div className="flex gap-2 flex-wrap no-print">
                <Button size="sm" className="bg-[#fb9678] hover:bg-[#e8876a]" onClick={() => setPreviewMode("notes")} data-testid="button-print-notes">
                  <Printer className="h-4 w-4 mr-1" /> พิมพ์ / PDF
                </Button>
                <Button size="sm" variant="outline" onClick={exportExcel} data-testid="button-excel-notes">
                  <Download className="h-4 w-4 mr-1" /> Excel
                </Button>
                {canGenerate && (
                  <Button size="sm" variant="outline" className="border-[var(--theme-primary)] text-[var(--theme-primary)] hover:bg-blue-50" onClick={handleGenerateNotes} data-testid="button-generate-notes">
                    <RefreshCw className="h-4 w-4 mr-1" /> สร้างข้อ 4+ จากงบทดลอง
                  </Button>
                )}
              </div>

              <Card className="border-0 shadow-md print:shadow-none">
                <CardContent className="p-6">
                  <div className="text-center mb-6 space-y-1 print:mb-4">
                    <h2 className="text-base font-bold">{companyName || "[ชื่อบริษัท]"}</h2>
                    <h3 className="text-sm font-bold">หมายเหตุประกอบงบการเงิน</h3>
                    <p className="text-sm text-muted-foreground">สำหรับปีสิ้นสุดวันที่ 31 ธันวาคม {buddhYearCurrent}</p>
                  </div>

                  <div className="space-y-4">
                    {notes.length > 0 && notes.filter(n => n.fixed).length > 0 && (
                      <div className="no-print text-xs text-muted-foreground bg-blue-50 border border-blue-100 rounded px-3 py-1.5 flex items-center gap-1">
                        <span>📌</span> ข้อ 1-3 เป็นค่า default (แก้ไขเนื้อหาได้) | ข้อ 4+ สร้างจากงบทดลองหรือเพิ่มเอง — สลับ/แทรก/ลบได้อิสระ
                      </div>
                    )}

                    {notes.map((note, noteIdx) => (
                      <div key={note.id} className={`border rounded-lg overflow-hidden fs-note-section ${note.fixed ? "border-blue-200" : ""}`}>
                        <div
                          className="cursor-pointer py-3 px-4 hover:bg-gray-50 flex items-center gap-2 no-print"
                          onClick={() => toggleNote(note.id)}
                        >
                          {note.expanded ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                          <span className="bg-gray-100 text-gray-600 rounded px-1.5 py-0.5 text-xs font-mono min-w-[2rem] text-center">
                            {note.noteNo}
                          </span>
                          <span className="text-sm font-semibold flex-1" data-testid={`text-note-title-${note.id}`}>
                            {note.title}
                          </span>
                          <span className="text-xs text-muted-foreground mr-1">
                            {note.type === "text" ? "ข้อความ" : note.type === "table" ? "ตาราง" : "ทรัพย์สิน"}
                          </span>
                          {note.fixed && <span className="text-[10px] bg-blue-100 text-blue-600 rounded px-1.5 py-0.5 mr-1">default</span>}
                          {!note.fixed && (
                            <>
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-gray-700"
                                onClick={(e) => { e.stopPropagation(); moveNote(note.id, "up"); }}
                                disabled={noteIdx === 0 || notes[noteIdx - 1]?.fixed}
                                data-testid={`button-move-up-${note.id}`}>
                                <ChevronUp className="w-3.5 h-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-gray-700"
                                onClick={(e) => { e.stopPropagation(); moveNote(note.id, "down"); }}
                                disabled={noteIdx === notes.length - 1}
                                data-testid={`button-move-down-${note.id}`}>
                                <ChevronDown className="w-3.5 h-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-green-400 hover:text-green-700"
                                onClick={(e) => { e.stopPropagation(); insertNoteAfter(note.id); }}
                                data-testid={`button-insert-after-${note.id}`}>
                                <Plus className="w-3.5 h-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400 hover:text-red-600"
                                onClick={(e) => { e.stopPropagation(); removeNote(note.id); }}
                                data-testid={`button-remove-note-${note.id}`}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          )}
                        </div>

                        {note.expanded && (
                          <div className="px-4 pb-4 space-y-3 print:hidden">
                            <div className="no-print space-y-2">
                              <div className="flex gap-2 items-center">
                                <Input value={note.title} onChange={(e) => updateNote(note.id, "title", e.target.value)}
                                  className="font-semibold text-sm flex-1" data-testid={`input-note-title-${note.id}`} />
                                {!note.fixed && (
                                  <Select value={note.type} onValueChange={(v) => updateNote(note.id, "type", v)}>
                                    <SelectTrigger className="w-32 h-9">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="text">ข้อความ</SelectItem>
                                      <SelectItem value="table">ตาราง</SelectItem>
                                      <SelectItem value="asset_movement">ทรัพย์สิน</SelectItem>
                                    </SelectContent>
                                  </Select>
                                )}
                              </div>

                              {note.type === "text" && (
                                <Textarea value={note.content} onChange={(e) => updateNote(note.id, "content", e.target.value)}
                                  className="min-h-[120px] text-sm leading-relaxed" data-testid={`textarea-note-content-${note.id}`} />
                              )}
                              {note.type === "table" && renderNoteTableEditor(note)}
                              {note.type === "asset_movement" && (
                                <div className="space-y-4">
                                  {renderAssetMovementEditor(note, "costRows", "ราคาทุน")}
                                  {renderAssetMovementEditor(note, "depreciationRows", "ค่าเสื่อมราคาสะสม")}
                                  <div className="bg-gray-50 p-3 rounded text-sm">
                                    <span className="font-semibold">สุทธิ: </span>
                                    <span className="font-mono">
                                      {fmt(note.costRows.reduce((s, r) => s + r.endBalance, 0) - note.depreciationRows.reduce((s, r) => s + r.endBalance, 0))}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {!note.expanded && (
                          <div className="no-print print:hidden px-4 pb-3">
                            <div className="bg-gray-50 rounded p-3 text-sm text-gray-600">
                              {note.type === "text" && (
                                <p className="whitespace-pre-wrap line-clamp-3">{note.content}</p>
                              )}
                              {note.type === "table" && note.tableRows.length > 0 && (
                                <p>{note.tableRows.length} รายการ | รวมปีปัจจุบัน: {fmt(note.tableRows.reduce((s, r) => s + r.current, 0))} | ปีก่อน: {fmt(note.tableRows.reduce((s, r) => s + r.previous, 0))}</p>
                              )}
                              {note.type === "asset_movement" && (
                                <p>ราคาทุน {note.costRows.length} รายการ | ค่าเสื่อม {note.depreciationRows.length} รายการ | สุทธิ: {fmt(note.costRows.reduce((s, r) => s + r.endBalance, 0) - note.depreciationRows.reduce((s, r) => s + r.endBalance, 0))}</p>
                              )}
                              {note.type === "table" && note.tableRows.length === 0 && note.type !== "text" && (
                                <p className="text-muted-foreground italic">ยังไม่มีข้อมูล</p>
                              )}
                            </div>
                          </div>
                        )}

                        <div className="print-only hidden print:block px-4 pb-4">
                          <h4 className="font-semibold text-sm mb-2">{note.noteNo}. {note.title}</h4>
                          {renderNotePrint(note)}
                        </div>
                      </div>
                    ))}
                  </div>

                  <StatementFooter signerName={signerName} signerTitle={signerTitle} showNoteRef={false} showQualification={false} />
                </CardContent>
              </Card>

              <div className="flex gap-2 flex-wrap no-print">
                <Button variant="outline" onClick={() => addNote("text")} data-testid="button-add-note-text">
                  <Plus className="w-4 h-4 mr-2" /> เพิ่มข้อ (ข้อความ)
                </Button>
                <Button variant="outline" onClick={() => addNote("table")} data-testid="button-add-note-table">
                  <Plus className="w-4 h-4 mr-2" /> เพิ่มข้อ (ตาราง)
                </Button>
                <Button variant="outline" onClick={() => addNote("asset_movement")} data-testid="button-add-note-asset">
                  <Plus className="w-4 h-4 mr-2" /> เพิ่มข้อ (ทรัพย์สิน/ค่าเสื่อม)
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {reportData && (
          <div className={`fs-print-all-container ${printAllMode ? 'fs-print-active' : ''}`} style={{ position: 'absolute', left: '-9999px', top: 0, width: '210mm' }}>
            {/* === PAGE 1: BALANCE SHEET === */}
            <div className="fs-print-page fs-print-page-fixed">
              <div className="text-center mb-4 space-y-1">
                <h2 className="text-base font-bold">{companyName || "[ชื่อบริษัท]"}</h2>
                <h3 className="text-sm font-bold">งบฐานะการเงิน</h3>
                <p className="text-sm text-muted-foreground">ณ วันที่ 31 ธันวาคม {buddhYearCurrent}</p>
              </div>
              <UnitLabel />
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="py-1 text-left w-[45%]"></th>
                    <th className="text-center text-sm font-bold py-1 w-16">หมายเหตุ</th>
                    <th className="text-right text-sm font-bold py-1 w-[22%] pr-4">{buddhYearCurrent}</th>
                    <th className="w-2"></th>
                    <th className="text-right text-sm font-bold py-1 w-[22%] pr-4">{buddhYearPrevious}</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  <tr><td colSpan={5} className="pt-3 pb-1 font-bold">สินทรัพย์</td></tr>
                  <tr><td colSpan={5} className="pl-2 pb-1 font-semibold text-gray-600">สินทรัพย์หมุนเวียน</td></tr>
                  {reportData.currentAssets.map(renderBSRow)}
                  {renderBSTotal("รวมสินทรัพย์หมุนเวียน", reportData.totalCurrentAssets.current, reportData.totalCurrentAssets.previous)}
                  {reportData.nonCurrentAssets.length > 0 && (
                    <>
                      <tr><td colSpan={5} className="pl-2 pt-2 pb-1 font-semibold text-gray-600">สินทรัพย์ไม่หมุนเวียน</td></tr>
                      {reportData.nonCurrentAssets.map(renderBSRow)}
                      {renderBSTotal("รวมสินทรัพย์ไม่หมุนเวียน", reportData.totalNonCurrentAssets.current, reportData.totalNonCurrentAssets.previous)}
                    </>
                  )}
                  {renderBSTotal("รวมสินทรัพย์", reportData.totalAssets.current, reportData.totalAssets.previous, true, true)}
                  <tr><td colSpan={5} className="pt-4 pb-1 font-bold">หนี้สินและส่วนของผู้ถือหุ้น</td></tr>
                  <tr><td colSpan={5} className="pl-2 pb-1 font-semibold text-gray-600">หนี้สินหมุนเวียน</td></tr>
                  {reportData.currentLiabilities.map(renderBSRow)}
                  {renderBSTotal("รวมหนี้สินหมุนเวียน", reportData.totalCurrentLiabilities.current, reportData.totalCurrentLiabilities.previous)}
                  {reportData.nonCurrentLiabilities.length > 0 && (
                    <>
                      <tr><td colSpan={5} className="pl-2 pt-2 pb-1 font-semibold text-gray-600">หนี้สินไม่หมุนเวียน</td></tr>
                      {reportData.nonCurrentLiabilities.map(renderBSRow)}
                      {renderBSTotal("รวมหนี้สินไม่หมุนเวียน", reportData.totalNonCurrentLiabilities.current, reportData.totalNonCurrentLiabilities.previous)}
                    </>
                  )}
                  {renderBSTotal("รวมหนี้สิน", reportData.totalLiabilities.current, reportData.totalLiabilities.previous)}
                  <tr><td colSpan={5} className="pl-2 pt-2 pb-1 font-semibold text-gray-600">ส่วนของผู้ถือหุ้น</td></tr>
                  <tr>
                    <td className="py-1 pl-8 text-sm" colSpan={2}>ทุนจดทะเบียน หุ้นสามัญ {registeredCapitalShares} หุ้น มูลค่าหุ้นละ {registeredCapitalPerShare} บาท</td>
                    <td className="py-1 text-right text-sm font-mono pr-4">{fmt(parseFloat(registeredCapitalShares.replace(/,/g, "")) * parseFloat(registeredCapitalPerShare.replace(/,/g, "")))}</td>
                    <td className="w-2"></td>
                    <td className="py-1 text-right text-sm font-mono pr-4">{fmt(parseFloat(registeredCapitalShares.replace(/,/g, "")) * parseFloat(registeredCapitalPerShare.replace(/,/g, "")))}</td>
                  </tr>
                  <tr>
                    <td className="py-1 pl-8 text-sm" colSpan={2}>ทุนที่ชำระแล้ว หุ้นสามัญ {paidUpShares} หุ้น มูลค่าหุ้นละ {paidUpPerShare} บาท</td>
                    <td className="py-1 text-right text-sm font-mono pr-4">{fmt(paidUpVal)}</td>
                    <td className="w-2"></td>
                    <td className="py-1 text-right text-sm font-mono pr-4">{fmt(paidUpVal)}</td>
                  </tr>
                  <tr>
                    <td className="py-1 pl-8 text-sm" colSpan={2}>กำไร (ขาดทุน) สะสมยังไม่ได้จัดสรร</td>
                    <td className="py-1 text-right text-sm font-mono pr-4">{fmt(retainedCur)}</td>
                    <td className="w-2"></td>
                    <td className="py-1 text-right text-sm font-mono pr-4">{fmt(retainedPrev)}</td>
                  </tr>
                  {renderBSTotal("รวมส่วนของผู้ถือหุ้น", paidUpVal + retainedCur, paidUpVal + retainedPrev)}
                  {renderBSTotal("รวมหนี้สินและส่วนของผู้ถือหุ้น", reportData.totalLiabilities.current + paidUpVal + retainedCur, reportData.totalLiabilities.previous + paidUpVal + retainedPrev, true, true)}
                </tbody>
              </table>
              <StatementFooter signerName={signerName} signerTitle={signerTitle} showQualification={false} />
            </div>

            {/* === PAGE 2: INCOME STATEMENT === */}
            <div className="fs-print-page fs-print-page-fixed" style={{ pageBreakBefore: "always" }}>
              <div className="text-center mb-4 space-y-1">
                <h2 className="text-base font-bold">{companyName || "[ชื่อบริษัท]"}</h2>
                <h3 className="text-sm font-bold">งบกำไรขาดทุน</h3>
                <p className="text-sm text-muted-foreground">สำหรับปีสิ้นสุดวันที่ 31 ธันวาคม {buddhYearCurrent}</p>
              </div>
              <UnitLabel />
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="py-1 text-left"></th>
                    <th className="py-1 w-16"></th>
                    <th className="text-right text-sm font-bold py-1 w-[22%] pr-4 border-b border-gray-800">{buddhYearCurrent}</th>
                    <th className="w-2"></th>
                    <th className="text-right text-sm font-bold py-1 w-[22%] pr-4 border-b border-gray-800">{buddhYearPrevious}</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  <tr><td colSpan={5} className="pt-3 pb-1 font-bold">รายได้</td></tr>
                  {reportData.salesRevenue.length > 0 && reportData.salesRevenue.map(renderISRow)}
                  {reportData.otherIncome.length > 0 ? reportData.otherIncome.map(renderISRow) : (
                          <tr><td className="py-1 pl-4 text-sm">รายได้อื่น</td><td className="w-16"></td><td className="py-1 text-right text-sm font-mono pr-4">{fmt(0)}</td><td className="w-2"></td><td className="py-1 text-right text-sm font-mono pr-4">{fmt(0)}</td></tr>
                        )}
                  {reportData.salesRevenue.length === 0 && reportData.otherIncome.length === 0 && reportData.revenues.map(renderISRow)}
                  {renderISTotal("รวมรายได้", reportData.totalRevenue.current, reportData.totalRevenue.previous)}

                  <tr><td colSpan={5} className="pt-4 pb-1 font-bold">ค่าใช้จ่าย</td></tr>
                  {reportData.costOfSales.length > 0 && reportData.costOfSales.map(renderISRow)}
                  {reportData.sellingExpenses.length > 0 && reportData.sellingExpenses.map(renderISRow)}
                  {reportData.adminExpenses.length > 0 && reportData.adminExpenses.map(renderISRow)}
                  {renderISTotal("รวมค่าใช้จ่าย",
                    reportData.totalCostOfSales.current + reportData.totalSellingExpenses.current + reportData.totalAdminExpenses.current,
                    reportData.totalCostOfSales.previous + reportData.totalSellingExpenses.previous + reportData.totalAdminExpenses.previous
                  )}

                  {renderISTotal("กำไร (ขาดทุน) ก่อนต้นทุนทางการเงินและภาษีเงินได้", reportData.profitBeforeFinanceAndTax.current, reportData.profitBeforeFinanceAndTax.previous)}
                  <tr>
                    <td className="py-1 pl-4 text-sm">ต้นทุนทางการเงิน</td>
                    <td className="w-16"></td>
                    <td className="py-1 text-right text-sm font-mono pr-4">{fmt(reportData.totalFinanceCosts.current)}</td>
                    <td className="w-2"></td>
                    <td className="py-1 text-right text-sm font-mono pr-4">{fmt(reportData.totalFinanceCosts.previous)}</td>
                  </tr>
                  {renderISTotal("กำไร(ขาดทุน)ก่อนภาษีเงินได้", reportData.profitBeforeTax.current, reportData.profitBeforeTax.previous)}
                  <tr>
                    <td className="py-1 pl-4 text-sm">ค่าใช้จ่ายภาษีเงินได้</td>
                    <td className="w-16"></td>
                    <td className="py-1 text-right text-sm font-mono pr-4">{fmt(reportData.totalIncomeTax.current)}</td>
                    <td className="w-2"></td>
                    <td className="py-1 text-right text-sm font-mono pr-4">{fmt(reportData.totalIncomeTax.previous)}</td>
                  </tr>
                  {renderISTotal("กำไร(ขาดทุน)สุทธิ", reportData.netIncome.current, reportData.netIncome.previous, true, true)}
                </tbody>
              </table>
              <StatementFooter signerName={signerName} signerTitle={signerTitle} />
            </div>

            {/* === PAGE 3: EQUITY CHANGES === */}
            <div className="fs-print-page fs-print-page-fixed" style={{ pageBreakBefore: "always" }}>
              <div className="text-center mb-4 space-y-1">
                <h2 className="text-base font-bold">{companyName || "[ชื่อบริษัท]"}</h2>
                <h3 className="text-sm font-bold">งบแสดงการเปลี่ยนแปลงส่วนของผู้ถือหุ้น</h3>
                <p className="text-sm text-muted-foreground">สำหรับปีสิ้นสุดวันที่ 31 ธันวาคม {buddhYearCurrent}</p>
              </div>
              <UnitLabel />
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="py-1 text-left text-sm w-[40%]"></th>
                    <th className="text-center text-sm font-bold py-1">ทุนที่ออกและ</th>
                    <th className="w-2"></th>
                    <th className="text-center text-sm font-bold py-1">กำไร</th>
                    <th className="w-2"></th>
                    <th className="py-1"></th>
                  </tr>
                  <tr>
                    <th className="py-1 text-left text-sm"></th>
                    <th className="text-center text-sm font-bold py-1 border-b border-gray-800">ชำระแล้ว</th>
                    <th className="w-2"></th>
                    <th className="text-center text-sm font-bold py-1 border-b border-gray-800">(ขาดทุน) สะสม</th>
                    <th className="w-2"></th>
                    <th className="text-center text-sm font-bold py-1 border-b border-gray-800">รวม</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  <tr className="font-bold">
                    <td className="py-2">{prevYearOpenLabel}</td>
                    <td className="py-2 text-right font-mono pr-4">{fmt(paidUpVal)}</td>
                    <td className="w-2"></td>
                    <td className="py-2 text-right font-mono pr-4">{isFirstYear ? "-" : fmt(beginRetainedPrevYear)}</td>
                    <td className="w-2"></td>
                    <td className="py-2 text-right font-mono pr-4">{fmt(paidUpVal + beginRetainedPrevYear)}</td>
                  </tr>
                  <tr>
                    <td className="py-2">กำไร (ขาดทุน) สุทธิ{isFirstYear ? ` ประจำปี ${buddhYearPrevious}` : ""}</td>
                    <td className="py-2 text-right font-mono pr-4">-</td>
                    <td className="w-2"></td>
                    <td className="py-2 text-right font-mono pr-4">{fmt(reportData.netIncome.previous)}</td>
                    <td className="w-2"></td>
                    <td className="py-2 text-right font-mono pr-4">{fmt(reportData.netIncome.previous)}</td>
                  </tr>
                  <tr className="font-bold">
                    <td className="py-2">ยอดคงเหลือปลายงวด วันที่ 31 ธันวาคม {buddhYearPrevious}</td>
                    <td className="py-2 text-right font-mono pr-4 border-t border-gray-400">{fmt(paidUpVal)}</td>
                    <td className="w-2"></td>
                    <td className="py-2 text-right font-mono pr-4 border-t border-gray-400">{fmt(retainedPrev)}</td>
                    <td className="w-2"></td>
                    <td className="py-2 text-right font-mono pr-4 border-t border-gray-400">{fmt(paidUpVal + retainedPrev)}</td>
                  </tr>
                  <tr>
                    <td className="py-2">กำไร (ขาดทุน) สุทธิ{isFirstYear ? ` ประจำปี ${buddhYearCurrent}` : ""}</td>
                    <td className="py-2 text-right font-mono pr-4">-</td>
                    <td className="w-2"></td>
                    <td className="py-2 text-right font-mono pr-4">{fmt(reportData.netIncome.current)}</td>
                    <td className="w-2"></td>
                    <td className="py-2 text-right font-mono pr-4">{fmt(reportData.netIncome.current)}</td>
                  </tr>
                  <tr className="font-bold">
                    <td className="py-2">ยอดคงเหลือปลายงวด วันที่ 31 ธันวาคม {buddhYearCurrent}</td>
                    <td className="py-2 text-right font-mono pr-4 border-t border-b-2 border-double border-gray-800">{fmt(paidUpVal)}</td>
                    <td className="w-2"></td>
                    <td className="py-2 text-right font-mono pr-4 border-t border-b-2 border-double border-gray-800">{fmt(retainedCur)}</td>
                    <td className="w-2"></td>
                    <td className="py-2 text-right font-mono pr-4 border-t border-b-2 border-double border-gray-800">{fmt(paidUpVal + retainedCur)}</td>
                  </tr>
                </tbody>
              </table>
              <StatementFooter signerName={signerName} signerTitle={signerTitle} showQualification={false} />
            </div>

            {/* === PAGE 4: NOTES (fixed notes 1-3) === */}
            <div className="fs-print-page fs-print-page-fixed" style={{ pageBreakBefore: "always" }}>
              <div className="text-center mb-6 space-y-1">
                <h2 className="text-base font-bold">{companyName || "[ชื่อบริษัท]"}</h2>
                <h3 className="text-sm font-bold">หมายเหตุประกอบงบการเงิน</h3>
                <p className="text-sm text-muted-foreground">สำหรับปีสิ้นสุดวันที่ 31 ธันวาคม {buddhYearCurrent}</p>
              </div>
              <div className="space-y-3">
                {notes.filter(n => n.fixed).map(note => (
                  <div key={note.id} className="fs-note-section">
                    <h4 className="font-semibold text-sm mb-2">{note.noteNo}. {note.title}</h4>
                    {renderNotePrint(note)}
                  </div>
                ))}
              </div>
              <StatementFooter signerName={signerName} signerTitle={signerTitle} showNoteRef={false} showQualification={false} />
            </div>

            {/* === PAGE 5+: NOTES (dynamic notes 4+) === */}
            {notes.filter(n => !n.fixed).length > 0 && (
              <div className="fs-print-page" style={{ pageBreakBefore: "always" }}>
                <div className="text-center mb-6 space-y-1">
                  <h2 className="text-base font-bold">{companyName || "[ชื่อบริษัท]"}</h2>
                  <h3 className="text-sm font-bold">หมายเหตุประกอบงบการเงิน (ต่อ)</h3>
                  <p className="text-sm text-muted-foreground">สำหรับปีสิ้นสุดวันที่ 31 ธันวาคม {buddhYearCurrent}</p>
                </div>
                <div className="space-y-3">
                  {notes.filter(n => !n.fixed).map(note => (
                    <div key={note.id} className="fs-note-section">
                      <h4 className="font-semibold text-sm mb-2">{note.noteNo}. {note.title}</h4>
                      {renderNotePrint(note)}
                    </div>
                  ))}
                </div>
                <StatementFooter signerName={signerName} signerTitle={signerTitle} showNoteRef={false} showQualification={false} />
              </div>
            )}
          </div>
        )}

        {showBalanceCheck && reportData && createPortal(
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center no-print" style={{ zIndex: 9999 }} onClick={() => setShowBalanceCheck(false)}>
            <div className="bg-white rounded-lg shadow-xl p-6 w-[500px] max-w-[90vw]" onClick={e => e.stopPropagation()}>
              <h3 className="text-base font-bold mb-4 flex items-center gap-2">
                {isBalancedCur && isBalancedPrev
                  ? <Check className="h-5 w-5 text-green-500" />
                  : <AlertTriangle className="h-5 w-5 text-red-500" />}
                ตรวจสอบงบดุล (Balance Check)
              </h3>
              <table className="w-full text-sm border mb-4">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left p-2 border-b">รายการ</th>
                    <th className="text-right p-2 border-b">ปี {buddhYearCurrent}</th>
                    <th className="text-right p-2 border-b">ปี {buddhYearPrevious}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td className="p-2 border-b">รวมสินทรัพย์</td><td className="p-2 text-right font-mono border-b">{fmt(totalAssetsCur)}</td><td className="p-2 text-right font-mono border-b">{fmt(totalAssetsPrev)}</td></tr>
                  <tr><td className="p-2 border-b">รวมหนี้สิน</td><td className="p-2 text-right font-mono border-b">{fmt(reportData.totalLiabilities.current)}</td><td className="p-2 text-right font-mono border-b">{fmt(reportData.totalLiabilities.previous)}</td></tr>
                  <tr><td className="p-2 border-b">ทุนที่ชำระแล้ว</td><td className="p-2 text-right font-mono border-b">{fmt(paidUpVal)}</td><td className="p-2 text-right font-mono border-b">{fmt(paidUpVal)}</td></tr>
                  <tr><td className="p-2 border-b">กำไร(ขาดทุน)สะสม</td><td className="p-2 text-right font-mono border-b">{fmt(retainedCur)}</td><td className="p-2 text-right font-mono border-b">{fmt(retainedPrev)}</td></tr>
                  <tr className="font-semibold"><td className="p-2 border-b">รวมหนี้สินและส่วนของผู้ถือหุ้น</td><td className="p-2 text-right font-mono border-b">{fmt(totalLiabEqCur)}</td><td className="p-2 text-right font-mono border-b">{fmt(totalLiabEqPrev)}</td></tr>
                  <tr className={`font-bold ${isBalancedCur && isBalancedPrev ? 'text-green-600' : 'text-red-600'}`}>
                    <td className="p-2">ผลต่าง (สินทรัพย์ − หนี้สินฯ)</td>
                    <td className="p-2 text-right font-mono">{fmt(totalAssetsCur - totalLiabEqCur)}</td>
                    <td className="p-2 text-right font-mono">{fmt(totalAssetsPrev - totalLiabEqPrev)}</td>
                  </tr>
                </tbody>
              </table>
              {isBalancedCur && isBalancedPrev ? (
                <div className="text-center">
                  <p className="text-green-600 font-bold mb-3">✓ งบดุลถูกต้อง — สินทรัพย์ = หนี้สินและส่วนของผู้ถือหุ้น</p>
                  <div className="flex gap-2 justify-center">
                    <Button size="sm" className="bg-[#05b187] hover:bg-[#049a75] text-white" onClick={() => { setShowBalanceCheck(false); handlePrint(); }}>
                      <Printer className="h-4 w-4 mr-1" /> ยืนยัน พิมพ์ / PDF
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setShowBalanceCheck(false); exportExcel(); }}>
                      <Download className="h-4 w-4 mr-1" /> ยืนยัน Excel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-red-600 font-bold mb-2">✗ งบไม่ดุล — กรุณาตรวจสอบข้อมูล</p>
                  <p className="text-xs text-gray-500 mb-3">กำไรสะสมปีนี้ = กำไรสะสมยกมาจาก TB ({fmtRaw(retainedBeginCur)}) + กำไรสุทธิปีนี้ ({fmtRaw(reportData.netIncome.current)}) = {fmtRaw(retainedCur)}</p>
                  <div className="flex gap-2 justify-center">
                    <Button size="sm" variant="outline" className="text-amber-600 border-amber-300" onClick={() => { setShowBalanceCheck(false); handlePrint(); }}>
                      <AlertTriangle className="h-4 w-4 mr-1" /> พิมพ์ต่อ (ทั้งที่ไม่ดุล)
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setShowBalanceCheck(false)}>
                      กลับไปแก้ไข
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
        {showImportCheck && reportData && createPortal(
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center" style={{ zIndex: 9999 }} onClick={() => setShowImportCheck(false)}>
            <div className="bg-white rounded-lg shadow-xl p-6 w-[560px] max-w-[95vw] max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <h3 className="text-base font-bold mb-2 flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-[#fb9678]" />
                ผลการนำเข้างบทดลอง — ตรวจสอบสมการบัญชี
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                สมการบัญชี: <span className="font-semibold">สินทรัพย์ = หนี้สิน + ส่วนของผู้ถือหุ้น</span> — หากไม่ดุล แสดงว่าข้อมูลผิดพลาด ควรแก้ไขก่อนสร้างงบการเงิน
              </p>
              <table className="w-full text-sm border mb-3">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="text-left p-2 border-b font-semibold">รายการ</th>
                    <th className="text-right p-2 border-b font-semibold">ปี {buddhYearCurrent}</th>
                    <th className="text-right p-2 border-b font-semibold">ปี {buddhYearPrevious}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-blue-50">
                    <td className="p-2 border-b font-semibold">รวมสินทรัพย์ (A)</td>
                    <td className="p-2 text-right font-mono border-b">{fmt(totalAssetsCur)}</td>
                    <td className="p-2 text-right font-mono border-b">{fmt(totalAssetsPrev)}</td>
                  </tr>
                  <tr>
                    <td className="p-2 border-b pl-4">รวมหนี้สิน</td>
                    <td className="p-2 text-right font-mono border-b">{fmt(reportData.totalLiabilities.current)}</td>
                    <td className="p-2 text-right font-mono border-b">{fmt(reportData.totalLiabilities.previous)}</td>
                  </tr>
                  <tr>
                    <td className="p-2 border-b pl-4">ทุนที่ชำระแล้ว</td>
                    <td className="p-2 text-right font-mono border-b">{fmt(paidUpVal)}</td>
                    <td className="p-2 text-right font-mono border-b">{fmt(paidUpVal)}</td>
                  </tr>
                  <tr>
                    <td className="p-2 border-b pl-4">กำไร(ขาดทุน)สะสม (ยกมา+กำไรสุทธิ)</td>
                    <td className="p-2 text-right font-mono border-b">{fmt(retainedCur)}</td>
                    <td className="p-2 text-right font-mono border-b">{fmt(retainedPrev)}</td>
                  </tr>
                  <tr className="bg-blue-50">
                    <td className="p-2 border-b font-semibold">รวมหนี้สิน + ส่วนของผู้ถือหุ้น (L+E)</td>
                    <td className="p-2 text-right font-mono border-b font-semibold">{fmt(totalLiabEqCur)}</td>
                    <td className="p-2 text-right font-mono border-b font-semibold">{fmt(totalLiabEqPrev)}</td>
                  </tr>
                  <tr className={`font-bold ${isBalancedCur && isBalancedPrev ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    <td className="p-2">ผลต่าง A − (L+E)</td>
                    <td className="p-2 text-right font-mono">{fmt(totalAssetsCur - totalLiabEqCur)}</td>
                    <td className="p-2 text-right font-mono">{fmt(totalAssetsPrev - totalLiabEqPrev)}</td>
                  </tr>
                </tbody>
              </table>

              {isBalancedCur && isBalancedPrev ? (
                <div className="text-center space-y-3">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-green-700 font-bold flex items-center justify-center gap-2">
                      <Check className="h-5 w-5" /> งบดุลถูกต้อง — สินทรัพย์ = หนี้สิน + ส่วนของผู้ถือหุ้น ทั้ง 2 ปี
                    </p>
                    <p className="text-green-600 text-xs mt-1">พร้อมสร้างงบการเงิน</p>
                  </div>
                  <Button className="bg-[#05b187] hover:bg-[#049a75] text-white" onClick={() => { setShowImportCheck(false); setActiveTab("balance-sheet"); }}>
                    <Check className="h-4 w-4 mr-1" /> ดำเนินการต่อ — ดูงบฐานะการเงิน
                  </Button>
                </div>
              ) : (
                <div className="text-center space-y-3">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-red-700 font-bold flex items-center justify-center gap-2">
                      <AlertTriangle className="h-5 w-5" /> งบไม่ดุล — ข้อมูลไม่ถูกต้อง
                    </p>
                    <p className="text-red-600 text-xs mt-1">
                      {!isBalancedCur && `ปี ${buddhYearCurrent}: ผลต่าง ${fmtRaw(totalAssetsCur - totalLiabEqCur)}`}
                      {!isBalancedCur && !isBalancedPrev && " | "}
                      {!isBalancedPrev && `ปี ${buddhYearPrevious}: ผลต่าง ${fmtRaw(totalAssetsPrev - totalLiabEqPrev)}`}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">กรุณาตรวจสอบไฟล์ Excel และแก้ไขข้อมูลก่อนสร้างงบการเงิน</p>
                  </div>
                  <div className="flex gap-2 justify-center">
                    <Button variant="outline" onClick={() => setShowImportCheck(false)}>
                      กลับไปแก้ไขข้อมูล
                    </Button>
                    <Button variant="outline" className="text-amber-600 border-amber-300" onClick={() => { setShowImportCheck(false); setActiveTab("balance-sheet"); }}>
                      <AlertTriangle className="h-4 w-4 mr-1" /> ดำเนินการต่อ (ทั้งที่ไม่ดุล)
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
        {previewMode && reportData && createPortal(
          <div className="fixed inset-0 bg-gray-100 flex flex-col no-print" style={{ zIndex: 9999 }}>
            <div className="bg-white border-b shadow-sm px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h3 className="font-bold text-sm">
                  ตัวอย่างก่อนพิมพ์ —{" "}
                  {previewMode === "bs" && "งบฐานะการเงิน"}
                  {previewMode === "is" && "งบกำไรขาดทุน"}
                  {previewMode === "eq" && "งบเปลี่ยนแปลงส่วนของผู้ถือหุ้น"}
                  {previewMode === "notes" && "หมายเหตุประกอบงบการเงิน"}
                  {previewMode === "all" && "งบการเงินทั้งหมด (4 หน้า)"}
                                  </h3>
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="bg-[#fb9678] hover:bg-[#e8876a] text-white" onClick={handlePreviewPrint}>
                  <Printer className="h-4 w-4 mr-1" /> พิมพ์ / ดาวน์โหลด PDF
                </Button>
                <Button size="sm" variant="outline" onClick={() => setPreviewMode(null)}>
                  ปิด
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-6">
              <div className="max-w-[210mm] mx-auto bg-white shadow-lg rounded-lg">
                {(previewMode === "bs" || previewMode === "all") && (
                  <div className="p-8 border-b-2 border-dashed border-gray-300 last:border-b-0">
                    <div className="text-center mb-4 space-y-1">
                      <h2 className="text-base font-bold">{companyName || "[ชื่อบริษัท]"}</h2>
                      <h3 className="text-sm font-bold">งบฐานะการเงิน</h3>
                      <p className="text-sm text-muted-foreground">ณ วันที่ 31 ธันวาคม {buddhYearCurrent}</p>
                    </div>
                    <UnitLabel />
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-800">
                          <th className="py-1 text-left w-[45%]"></th>
                          <th className="text-center text-sm font-bold py-1 w-16">หมายเหตุ</th>
                          <th className="text-right text-sm font-bold py-1 w-[22%] pr-4">{buddhYearCurrent}</th>
                          <th className="w-2"></th>
                          <th className="text-right text-sm font-bold py-1 w-[22%] pr-4">{buddhYearPrevious}</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        <tr><td colSpan={5} className="pt-3 pb-1 font-bold">สินทรัพย์</td></tr>
                        <tr><td colSpan={5} className="pl-2 pb-1 font-semibold text-gray-600">สินทรัพย์หมุนเวียน</td></tr>
                        {reportData.currentAssets.map(renderBSRow)}
                        {renderBSTotal("รวมสินทรัพย์หมุนเวียน", reportData.totalCurrentAssets.current, reportData.totalCurrentAssets.previous)}
                        {reportData.nonCurrentAssets.length > 0 && (
                          <>
                            <tr><td colSpan={5} className="pl-2 pt-2 pb-1 font-semibold text-gray-600">สินทรัพย์ไม่หมุนเวียน</td></tr>
                            {reportData.nonCurrentAssets.map(renderBSRow)}
                            {renderBSTotal("รวมสินทรัพย์ไม่หมุนเวียน", reportData.totalNonCurrentAssets.current, reportData.totalNonCurrentAssets.previous)}
                          </>
                        )}
                        {renderBSTotal("รวมสินทรัพย์", reportData.totalAssets.current, reportData.totalAssets.previous, true, true)}
                        <tr><td colSpan={5} className="pt-4 pb-1 font-bold">หนี้สินและส่วนของผู้ถือหุ้น</td></tr>
                        <tr><td colSpan={5} className="pl-2 pb-1 font-semibold text-gray-600">หนี้สินหมุนเวียน</td></tr>
                        {reportData.currentLiabilities.map(renderBSRow)}
                        {renderBSTotal("รวมหนี้สินหมุนเวียน", reportData.totalCurrentLiabilities.current, reportData.totalCurrentLiabilities.previous)}
                        {reportData.nonCurrentLiabilities.length > 0 && (
                          <>
                            <tr><td colSpan={5} className="pl-2 pt-2 pb-1 font-semibold text-gray-600">หนี้สินไม่หมุนเวียน</td></tr>
                            {reportData.nonCurrentLiabilities.map(renderBSRow)}
                            {renderBSTotal("รวมหนี้สินไม่หมุนเวียน", reportData.totalNonCurrentLiabilities.current, reportData.totalNonCurrentLiabilities.previous)}
                          </>
                        )}
                        {renderBSTotal("รวมหนี้สิน", reportData.totalLiabilities.current, reportData.totalLiabilities.previous)}
                        <tr><td colSpan={5} className="pl-2 pt-2 pb-1 font-semibold text-gray-600">ส่วนของผู้ถือหุ้น</td></tr>
                        <tr>
                          <td className="py-1 pl-8 text-sm" colSpan={2}>ทุนจดทะเบียน หุ้นสามัญ {registeredCapitalShares} หุ้น มูลค่าหุ้นละ {registeredCapitalPerShare} บาท</td>
                          <td className="py-1 text-right text-sm font-mono pr-4">{fmt(parseFloat(registeredCapitalShares.replace(/,/g, "")) * parseFloat(registeredCapitalPerShare.replace(/,/g, "")))}</td>
                          <td className="w-2"></td>
                          <td className="py-1 text-right text-sm font-mono pr-4">{fmt(parseFloat(registeredCapitalShares.replace(/,/g, "")) * parseFloat(registeredCapitalPerShare.replace(/,/g, "")))}</td>
                        </tr>
                        <tr>
                          <td className="py-1 pl-8 text-sm" colSpan={2}>ทุนที่ชำระแล้ว หุ้นสามัญ {paidUpShares} หุ้น มูลค่าหุ้นละ {paidUpPerShare} บาท</td>
                          <td className="py-1 text-right text-sm font-mono pr-4">{fmt(paidUpVal)}</td>
                          <td className="w-2"></td>
                          <td className="py-1 text-right text-sm font-mono pr-4">{fmt(paidUpVal)}</td>
                        </tr>
                        <tr>
                          <td className="py-1 pl-8 text-sm" colSpan={2}>กำไร (ขาดทุน) สะสมยังไม่ได้จัดสรร</td>
                          <td className="py-1 text-right text-sm font-mono pr-4">{fmt(retainedCur)}</td>
                          <td className="w-2"></td>
                          <td className="py-1 text-right text-sm font-mono pr-4">{fmt(retainedPrev)}</td>
                        </tr>
                        {renderBSTotal("รวมส่วนของผู้ถือหุ้น", paidUpVal + retainedCur, paidUpVal + retainedPrev)}
                        {renderBSTotal("รวมหนี้สินและส่วนของผู้ถือหุ้น", reportData.totalLiabilities.current + paidUpVal + retainedCur, reportData.totalLiabilities.previous + paidUpVal + retainedPrev, true, true)}
                      </tbody>
                    </table>
                    <StatementFooter signerName={signerName} signerTitle={signerTitle} showQualification={false} />
                  </div>
                )}

                {(previewMode === "is" || previewMode === "all") && (
                  <div className="p-8 border-b-2 border-dashed border-gray-300 last:border-b-0">
                    <div className="text-center mb-4 space-y-1">
                      <h2 className="text-base font-bold">{companyName || "[ชื่อบริษัท]"}</h2>
                      <h3 className="text-sm font-bold">งบกำไรขาดทุน</h3>
                      <p className="text-sm text-muted-foreground">สำหรับปีสิ้นสุดวันที่ 31 ธันวาคม {buddhYearCurrent}</p>
                    </div>
                    <UnitLabel />
                    <table className="w-full">
                      <thead>
                        <tr>
                          <th className="py-1 text-left"></th>
                          <th className="py-1 w-16"></th>
                          <th className="text-right text-sm font-bold py-1 w-[22%] pr-4 border-b border-gray-800">{buddhYearCurrent}</th>
                          <th className="w-2"></th>
                          <th className="text-right text-sm font-bold py-1 w-[22%] pr-4 border-b border-gray-800">{buddhYearPrevious}</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        <tr><td colSpan={5} className="pt-3 pb-1 font-bold">รายได้</td></tr>
                        {reportData.salesRevenue.length > 0 && reportData.salesRevenue.map(renderISRow)}
                        {reportData.otherIncome.length > 0 ? reportData.otherIncome.map(renderISRow) : (
                          <tr><td className="py-1 pl-4 text-sm">รายได้อื่น</td><td className="w-16"></td><td className="py-1 text-right text-sm font-mono pr-4">{fmt(0)}</td><td className="w-2"></td><td className="py-1 text-right text-sm font-mono pr-4">{fmt(0)}</td></tr>
                        )}
                        {reportData.salesRevenue.length === 0 && reportData.otherIncome.length === 0 && reportData.revenues.map(renderISRow)}
                        {renderISTotal("รวมรายได้", reportData.totalRevenue.current, reportData.totalRevenue.previous)}

                        <tr><td colSpan={5} className="pt-4 pb-1 font-bold">ค่าใช้จ่าย</td></tr>
                        {reportData.costOfSales.length > 0 && reportData.costOfSales.map(renderISRow)}
                        {reportData.sellingExpenses.length > 0 && reportData.sellingExpenses.map(renderISRow)}
                        {reportData.adminExpenses.length > 0 && reportData.adminExpenses.map(renderISRow)}
                        {renderISTotal("รวมค่าใช้จ่าย",
                          reportData.totalCostOfSales.current + reportData.totalSellingExpenses.current + reportData.totalAdminExpenses.current,
                          reportData.totalCostOfSales.previous + reportData.totalSellingExpenses.previous + reportData.totalAdminExpenses.previous
                        )}

                        {renderISTotal("กำไร (ขาดทุน) ก่อนต้นทุนทางการเงินและภาษีเงินได้", reportData.profitBeforeFinanceAndTax.current, reportData.profitBeforeFinanceAndTax.previous)}
                        <tr>
                          <td className="py-1 pl-4 text-sm">ต้นทุนทางการเงิน</td>
                          <td className="w-16"></td>
                          <td className="py-1 text-right text-sm font-mono pr-4">{fmt(reportData.totalFinanceCosts.current)}</td>
                          <td className="w-2"></td>
                          <td className="py-1 text-right text-sm font-mono pr-4">{fmt(reportData.totalFinanceCosts.previous)}</td>
                        </tr>
                        {renderISTotal("กำไร(ขาดทุน)ก่อนภาษีเงินได้", reportData.profitBeforeTax.current, reportData.profitBeforeTax.previous)}
                        <tr>
                          <td className="py-1 pl-4 text-sm">ค่าใช้จ่ายภาษีเงินได้</td>
                          <td className="w-16"></td>
                          <td className="py-1 text-right text-sm font-mono pr-4">{fmt(reportData.totalIncomeTax.current)}</td>
                          <td className="w-2"></td>
                          <td className="py-1 text-right text-sm font-mono pr-4">{fmt(reportData.totalIncomeTax.previous)}</td>
                        </tr>
                        {renderISTotal("กำไร(ขาดทุน)สุทธิ", reportData.netIncome.current, reportData.netIncome.previous, true, true)}
                      </tbody>
                    </table>
                    <StatementFooter signerName={signerName} signerTitle={signerTitle} />
                  </div>
                )}

                {(previewMode === "eq" || previewMode === "all") && (
                  <div className="p-8 border-b-2 border-dashed border-gray-300 last:border-b-0">
                    <div className="text-center mb-4 space-y-1">
                      <h2 className="text-base font-bold">{companyName || "[ชื่อบริษัท]"}</h2>
                      <h3 className="text-sm font-bold">งบแสดงการเปลี่ยนแปลงส่วนของผู้ถือหุ้น</h3>
                      <p className="text-sm text-muted-foreground">สำหรับปีสิ้นสุดวันที่ 31 ธันวาคม {buddhYearCurrent}</p>
                    </div>
                    <UnitLabel />
                    <table className="w-full">
                      <thead>
                        <tr>
                          <th className="py-1 text-left text-sm w-[40%]"></th>
                          <th className="text-center text-sm font-bold py-1">ทุนที่ออกและ</th>
                          <th className="w-2"></th>
                          <th className="text-center text-sm font-bold py-1">กำไร</th>
                          <th className="w-2"></th>
                          <th className="py-1"></th>
                        </tr>
                        <tr>
                          <th className="py-1 text-left text-sm"></th>
                          <th className="text-center text-sm font-bold py-1 border-b border-gray-800">ชำระแล้ว</th>
                          <th className="w-2"></th>
                          <th className="text-center text-sm font-bold py-1 border-b border-gray-800">(ขาดทุน) สะสม</th>
                          <th className="w-2"></th>
                          <th className="text-center text-sm font-bold py-1 border-b border-gray-800">รวม</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        <tr className="font-bold">
                          <td className="py-2">{prevYearOpenLabel}</td>
                          <td className="py-2 text-right font-mono pr-4">{fmt(paidUpVal)}</td>
                          <td className="w-2"></td>
                          <td className="py-2 text-right font-mono pr-4">{isFirstYear ? "-" : fmt(beginRetainedPrevYear)}</td>
                          <td className="w-2"></td>
                          <td className="py-2 text-right font-mono pr-4">{fmt(paidUpVal + beginRetainedPrevYear)}</td>
                        </tr>
                        <tr>
                          <td className="py-2">กำไร (ขาดทุน) สุทธิ{isFirstYear ? ` ประจำปี ${buddhYearPrevious}` : ""}</td>
                          <td className="py-2 text-right font-mono pr-4">-</td>
                          <td className="w-2"></td>
                          <td className="py-2 text-right font-mono pr-4">{fmt(reportData.netIncome.previous)}</td>
                          <td className="w-2"></td>
                          <td className="py-2 text-right font-mono pr-4">{fmt(reportData.netIncome.previous)}</td>
                        </tr>
                        <tr className="font-bold">
                          <td className="py-2">ยอดคงเหลือปลายงวด วันที่ 31 ธันวาคม {buddhYearPrevious}</td>
                          <td className="py-2 text-right font-mono pr-4 border-t border-gray-400">{fmt(paidUpVal)}</td>
                          <td className="w-2"></td>
                          <td className="py-2 text-right font-mono pr-4 border-t border-gray-400">{fmt(retainedPrev)}</td>
                          <td className="w-2"></td>
                          <td className="py-2 text-right font-mono pr-4 border-t border-gray-400">{fmt(paidUpVal + retainedPrev)}</td>
                        </tr>
                        <tr>
                          <td className="py-2">กำไร (ขาดทุน) สุทธิ{isFirstYear ? ` ประจำปี ${buddhYearCurrent}` : ""}</td>
                          <td className="py-2 text-right font-mono pr-4">-</td>
                          <td className="w-2"></td>
                          <td className="py-2 text-right font-mono pr-4">{fmt(reportData.netIncome.current)}</td>
                          <td className="w-2"></td>
                          <td className="py-2 text-right font-mono pr-4">{fmt(reportData.netIncome.current)}</td>
                        </tr>
                        <tr className="font-bold">
                          <td className="py-2">ยอดคงเหลือปลายงวด วันที่ 31 ธันวาคม {buddhYearCurrent}</td>
                          <td className="py-2 text-right font-mono pr-4 border-t border-b-2 border-double border-gray-800">{fmt(paidUpVal)}</td>
                          <td className="w-2"></td>
                          <td className="py-2 text-right font-mono pr-4 border-t border-b-2 border-double border-gray-800">{fmt(retainedCur)}</td>
                          <td className="w-2"></td>
                          <td className="py-2 text-right font-mono pr-4 border-t border-b-2 border-double border-gray-800">{fmt(paidUpVal + retainedCur)}</td>
                        </tr>
                      </tbody>
                    </table>
                    <StatementFooter signerName={signerName} signerTitle={signerTitle} showQualification={false} />
                  </div>
                )}

                {(previewMode === "notes" || previewMode === "all") && (
                  <div className="p-8">
                    <div className="text-center mb-6 space-y-1">
                      <h2 className="text-base font-bold">{companyName || "[ชื่อบริษัท]"}</h2>
                      <h3 className="text-sm font-bold">หมายเหตุประกอบงบการเงิน</h3>
                      <p className="text-sm text-muted-foreground">สำหรับปีสิ้นสุดวันที่ 31 ธันวาคม {buddhYearCurrent}</p>
                    </div>
                    <div className="space-y-3">
                      {notes.map(note => (
                        <div key={note.id}>
                          <h4 className="font-semibold text-sm mb-2">{note.noteNo}. {note.title}</h4>
                          {renderNotePrint(note)}
                        </div>
                      ))}
                    </div>
                    <StatementFooter signerName={signerName} signerTitle={signerTitle} showNoteRef={false} showQualification={false} />
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>

      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>บันทึกร่างงบการเงิน</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>ชื่อร่าง</Label>
              <Input value={saveDraftName} onChange={e => setSaveDraftName(e.target.value)} placeholder="เช่น บริษัท ABC งบ 2567" data-testid="input-draft-name" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>ยกเลิก</Button>
            <Button className="bg-green-600 hover:bg-green-700 text-white" disabled={!saveDraftName.trim() || saveDraftMutation.isPending} onClick={() => saveDraftMutation.mutate({ name: saveDraftName.trim() })} data-testid="button-confirm-save-draft">
              <Save className="h-4 w-4 mr-1" /> บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showLoadDialog} onOpenChange={setShowLoadDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>โหลดร่างงบการเงิน</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {draftsList.length === 0 && (
              <p className="text-sm text-gray-500 py-4 text-center">ยังไม่มีร่างที่บันทึกไว้</p>
            )}
            {draftsList.map((d: any) => (
              <div key={d.id} className={`flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 cursor-pointer ${currentDraftId === d.id ? "border-green-400 bg-green-50" : "border-gray-200"}`} data-testid={`draft-item-${d.id}`}>
                <div className="flex-1 min-w-0" onClick={() => handleLoadDraft(d.id)}>
                  <p className="font-medium text-sm truncate">{d.name}</p>
                  <p className="text-xs text-gray-400">แก้ไขล่าสุด: {d.updatedAt ? new Date(d.updatedAt).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "-"}</p>
                </div>
                <div className="flex gap-1 ml-2">
                  <Button size="sm" variant="ghost" className="text-blue-600 h-8 px-2" onClick={() => handleLoadDraft(d.id)} data-testid={`button-load-${d.id}`}>
                    <FolderOpen className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" className="text-red-500 h-8 px-2" onClick={(e) => { e.stopPropagation(); deleteDraftMutation.mutate(d.id); }} data-testid={`button-delete-${d.id}`}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
