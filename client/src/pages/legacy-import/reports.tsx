import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import LegacyLayout from "@/components/legacy-layout";
import { useLegacyCompany } from "@/lib/legacy-company-context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BookOpen, FileSpreadsheet, Scale, TrendingUp, Receipt, FileDown, Printer, RefreshCw, Search, X, ChevronDown, ChevronRight } from "lucide-react";
import { useThemeColor } from "@/hooks/use-theme-color";
import * as XLSX from "xlsx";

function esc(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmt(val: number | string | null | undefined): string {
  const n = parseFloat(String(val || "0"));
  if (n === 0) return "-";
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function openPrint(html: string) {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 300);
}

async function downloadPdf(html: string, filename: string) {
  const { default: html2pdf } = await import("html2pdf.js");
  const container = document.createElement("div");
  container.innerHTML = html;
  container.style.position = "absolute";
  container.style.left = "-9999px";
  document.body.appendChild(container);
  try {
    await html2pdf().set({
      margin: 10,
      filename: filename.endsWith(".pdf") ? filename : `${filename}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    }).from(container).save();
  } finally {
    document.body.removeChild(container);
  }
}

function getToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getYearStart() {
  return `${new Date().getFullYear()}-01-01`;
}

function TrialBalancePage() {
  const { selectedId, selectedCompany } = useLegacyCompany();
  const { colors: themeColors } = useThemeColor();
  const [startDate, setStartDate] = useState(getYearStart);
  const [endDate, setEndDate] = useState(getToday);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/legacy-import/reports/trial-balance", selectedId, startDate, endDate],
    queryFn: async () => {
      const res = await fetch(`/api/legacy-import/reports/trial-balance?legacyCompanyId=${selectedId}&startDate=${startDate}&endDate=${endDate}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!selectedId,
  });

  const rows = data?.rows || [];
  const totals = data?.totals;

  const grouped = useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const r of rows) {
      const prefix = r.accountCode?.slice(0, 1) || "?";
      if (!groups[prefix]) groups[prefix] = [];
      groups[prefix].push(r);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [rows]);

  const toggleGroup = (key: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const groupLabels: Record<string, string> = { "1": "สินทรัพย์", "2": "หนี้สิน", "3": "ส่วนของผู้ถือหุ้น", "4": "รายได้", "5": "ค่าใช้จ่าย" };

  const handleExcel = () => {
    const header = ["รหัสบัญชี", "ชื่อบัญชี", "ยอดยกมา(เดบิต)", "ยอดยกมา(เครดิต)", "เคลื่อนไหว(เดบิต)", "เคลื่อนไหว(เครดิต)", "ยอดคงเหลือ(เดบิต)", "ยอดคงเหลือ(เครดิต)"];
    const aoa: any[][] = [[`งบทดลอง — ${selectedCompany?.name || ""}`], [`${startDate} ถึง ${endDate}`], [], header];
    rows.forEach((r: any) => aoa.push([r.accountCode, r.accountName, r.openingDebit, r.openingCredit, r.movementDebit, r.movementCredit, r.closingDebit, r.closingCredit]));
    if (totals) aoa.push(["", "รวมทั้งสิ้น", totals.openingDebit, totals.openingCredit, totals.movementDebit, totals.movementCredit, totals.closingDebit, totals.closingCredit]);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "งบทดลอง");
    XLSX.writeFile(wb, `งบทดลอง_${selectedCompany?.name || ""}.xlsx`);
  };

  const buildTrialBalanceHtml = () => {
    const tRows = rows.map((r: any) => `<tr><td>${esc(r.accountCode)}</td><td>${esc(r.accountName)}</td><td style="text-align:right">${fmt(r.openingDebit)}</td><td style="text-align:right">${fmt(r.openingCredit)}</td><td style="text-align:right">${fmt(r.movementDebit)}</td><td style="text-align:right">${fmt(r.movementCredit)}</td><td style="text-align:right">${fmt(r.closingDebit)}</td><td style="text-align:right">${fmt(r.closingCredit)}</td></tr>`).join("");
    const totalRow = totals ? `<tr style="background:#f1f5f9;font-weight:bold"><td colspan="2" style="text-align:center">รวมทั้งสิ้น</td><td style="text-align:right">${fmt(totals.openingDebit)}</td><td style="text-align:right">${fmt(totals.openingCredit)}</td><td style="text-align:right">${fmt(totals.movementDebit)}</td><td style="text-align:right">${fmt(totals.movementCredit)}</td><td style="text-align:right">${fmt(totals.closingDebit)}</td><td style="text-align:right">${fmt(totals.closingCredit)}</td></tr>` : "";
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>งบทดลอง</title><style>body{font-family:'Sarabun',sans-serif;font-size:12px;padding:20px}h2{text-align:center;margin-bottom:4px}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #ccc;padding:3px 6px}th{background:#334155;color:white}@media print{@page{size:landscape}}</style></head><body><h2>งบทดลอง</h2><p style="text-align:center">${esc(selectedCompany?.name)} — ${esc(startDate)} ถึง ${esc(endDate)}</p><table><thead><tr><th rowspan="2">รหัส</th><th rowspan="2">ชื่อบัญชี</th><th colspan="2">ยอดยกมา</th><th colspan="2">เคลื่อนไหว</th><th colspan="2">ยอดคงเหลือ</th></tr><tr><th>เดบิต</th><th>เครดิต</th><th>เดบิต</th><th>เครดิต</th><th>เดบิต</th><th>เครดิต</th></tr></thead><tbody>${tRows}${totalRow}</tbody></table></body></html>`;
  };
  const handlePrint = () => openPrint(buildTrialBalanceHtml());
  const handlePdf = () => downloadPdf(buildTrialBalanceHtml(), `งบทดลอง_${selectedCompany?.name || "report"}`);

  return (
    <LegacyLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <FileSpreadsheet className="h-6 w-6" style={{ color: themeColors.primary }} />
          <h1 className="text-xl font-bold">งบทดลอง (Trial Balance)</h1>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">เริ่ม</label>
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-9 w-[160px]" data-testid="input-tb-start" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">สิ้นสุด</label>
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-9 w-[160px]" data-testid="input-tb-end" />
          </div>
          <Button variant="outline" size="sm" className="h-9 gap-1.5 border-green-400 text-green-600" onClick={() => refetch()} disabled={isLoading} data-testid="button-tb-refresh">
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} /> สร้างรายงาน
          </Button>
          <Button variant="outline" size="sm" className="h-9 gap-1.5 border-blue-300 text-blue-600" onClick={handlePrint} data-testid="button-tb-print"><Printer className="h-4 w-4" /> พิมพ์</Button>
          <Button variant="outline" size="sm" className="h-9 gap-1.5 border-red-300 text-red-600" onClick={handlePdf} data-testid="button-tb-pdf"><FileDown className="h-4 w-4" /> PDF</Button>
          <Button size="sm" className="h-9 gap-1.5 text-white" style={{ background: "#03c9d7" }} onClick={handleExcel} data-testid="button-tb-excel"><FileDown className="h-4 w-4" /> Excel</Button>
        </div>

        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="py-16 text-center text-muted-foreground">กำลังโหลด...</div>
          ) : rows.length === 0 ? (
            <div className="py-16 text-center">
              <FileSpreadsheet className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">ไม่พบข้อมูล</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent" style={{ background: themeColors.primary }}>
                  <TableHead rowSpan={2} className="text-sm font-bold text-white border-r border-white/20 w-[100px]">รหัส</TableHead>
                  <TableHead rowSpan={2} className="text-sm font-bold text-white border-r border-white/20 min-w-[180px]">ชื่อบัญชี</TableHead>
                  <TableHead colSpan={2} className="text-sm font-bold text-white border-r border-white/20 text-center border-b border-white/20">ยอดยกมา</TableHead>
                  <TableHead colSpan={2} className="text-sm font-bold text-white border-r border-white/20 text-center border-b border-white/20">เคลื่อนไหว</TableHead>
                  <TableHead colSpan={2} className="text-sm font-bold text-white text-center border-b border-white/20">ยอดคงเหลือ</TableHead>
                </TableRow>
                <TableRow className="hover:bg-transparent" style={{ background: themeColors.primary }}>
                  <TableHead className="text-xs font-bold text-white border-r border-white/20 text-center w-[100px]">เดบิต</TableHead>
                  <TableHead className="text-xs font-bold text-white border-r border-white/20 text-center w-[100px]">เครดิต</TableHead>
                  <TableHead className="text-xs font-bold text-white border-r border-white/20 text-center w-[100px]">เดบิต</TableHead>
                  <TableHead className="text-xs font-bold text-white border-r border-white/20 text-center w-[100px]">เครดิต</TableHead>
                  <TableHead className="text-xs font-bold text-white border-r border-white/20 text-center w-[100px]">เดบิต</TableHead>
                  <TableHead className="text-xs font-bold text-white text-center w-[100px]">เครดิต</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grouped.map(([prefix, groupRows]) => {
                  const isCollapsed = collapsed.has(prefix);
                  const gTotals = groupRows.reduce((t: any, r: any) => ({
                    openingDebit: t.openingDebit + r.openingDebit, openingCredit: t.openingCredit + r.openingCredit,
                    movementDebit: t.movementDebit + r.movementDebit, movementCredit: t.movementCredit + r.movementCredit,
                    closingDebit: t.closingDebit + r.closingDebit, closingCredit: t.closingCredit + r.closingCredit,
                  }), { openingDebit: 0, openingCredit: 0, movementDebit: 0, movementCredit: 0, closingDebit: 0, closingCredit: 0 });

                  return (
                    <>{/* group */}
                      <TableRow key={`g-${prefix}`} className="bg-slate-100 hover:bg-slate-200 cursor-pointer border-b" onClick={() => toggleGroup(prefix)} data-testid={`row-tb-group-${prefix}`}>
                        <TableCell colSpan={2} className="text-sm py-2 font-bold">
                          <div className="flex items-center gap-1">
                            {isCollapsed ? <ChevronRight className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                            {prefix}: {groupLabels[prefix] || "อื่นๆ"}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm py-2 text-right tabular-nums font-bold">{fmt(gTotals.openingDebit)}</TableCell>
                        <TableCell className="text-sm py-2 text-right tabular-nums font-bold">{fmt(gTotals.openingCredit)}</TableCell>
                        <TableCell className="text-sm py-2 text-right tabular-nums font-bold">{fmt(gTotals.movementDebit)}</TableCell>
                        <TableCell className="text-sm py-2 text-right tabular-nums font-bold">{fmt(gTotals.movementCredit)}</TableCell>
                        <TableCell className="text-sm py-2 text-right tabular-nums font-bold">{fmt(gTotals.closingDebit)}</TableCell>
                        <TableCell className="text-sm py-2 text-right tabular-nums font-bold">{fmt(gTotals.closingCredit)}</TableCell>
                      </TableRow>
                      {!isCollapsed && groupRows.map((r: any, idx: number) => (
                        <TableRow key={r.accountCode} className="hover:bg-blue-50/30" style={idx % 2 !== 0 ? { background: "rgba(0,0,0,0.02)" } : undefined} data-testid={`row-tb-${r.accountCode}`}>
                          <TableCell className="text-sm tabular-nums pl-6">{r.accountCode}</TableCell>
                          <TableCell className="text-sm">{r.accountName}</TableCell>
                          <TableCell className="text-sm text-right tabular-nums">{fmt(r.openingDebit)}</TableCell>
                          <TableCell className="text-sm text-right tabular-nums">{fmt(r.openingCredit)}</TableCell>
                          <TableCell className="text-sm text-right tabular-nums">{fmt(r.movementDebit)}</TableCell>
                          <TableCell className="text-sm text-right tabular-nums">{fmt(r.movementCredit)}</TableCell>
                          <TableCell className="text-sm text-right tabular-nums font-medium">{fmt(r.closingDebit)}</TableCell>
                          <TableCell className="text-sm text-right tabular-nums font-medium">{fmt(r.closingCredit)}</TableCell>
                        </TableRow>
                      ))}
                    </>
                  );
                })}
                {totals && (
                  <TableRow className="bg-slate-200 font-bold border-t-2" data-testid="row-tb-totals">
                    <TableCell colSpan={2} className="text-sm py-3 text-center font-bold">รวมทั้งสิ้น</TableCell>
                    <TableCell className="text-sm py-3 text-right tabular-nums font-bold">{fmt(totals.openingDebit)}</TableCell>
                    <TableCell className="text-sm py-3 text-right tabular-nums font-bold">{fmt(totals.openingCredit)}</TableCell>
                    <TableCell className="text-sm py-3 text-right tabular-nums font-bold">{fmt(totals.movementDebit)}</TableCell>
                    <TableCell className="text-sm py-3 text-right tabular-nums font-bold">{fmt(totals.movementCredit)}</TableCell>
                    <TableCell className="text-sm py-3 text-right tabular-nums font-bold text-blue-800">{fmt(totals.closingDebit)}</TableCell>
                    <TableCell className="text-sm py-3 text-right tabular-nums font-bold text-blue-800">{fmt(totals.closingCredit)}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </LegacyLayout>
  );
}

function GeneralLedgerPage() {
  const { selectedId, selectedCompany } = useLegacyCompany();
  const { colors: themeColors } = useThemeColor();
  const [startDate, setStartDate] = useState(getYearStart);
  const [endDate, setEndDate] = useState(getToday);
  const [accountCode, setAccountCode] = useState("");

  const { data: accounts = [] } = useQuery<any[]>({
    queryKey: ["/api/legacy-import/chart-of-accounts-list", selectedId],
    queryFn: async () => {
      const res = await fetch(`/api/legacy-import/chart-of-accounts?legacyCompanyId=${selectedId}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedId,
  });

  const { data: reportData, isLoading, refetch } = useQuery<any[]>({
    queryKey: ["/api/legacy-import/reports/general-ledger", selectedId, startDate, endDate, accountCode],
    queryFn: async () => {
      const params = new URLSearchParams({ legacyCompanyId: String(selectedId), startDate, endDate });
      if (accountCode) params.set("accountCode", accountCode);
      const res = await fetch(`/api/legacy-import/reports/general-ledger?${params}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!selectedId,
  });

  const glAccounts = reportData || [];

  const handleExcel = () => {
    const aoa: any[][] = [[`บัญชีแยกประเภท — ${selectedCompany?.name || ""}`], [`${startDate} ถึง ${endDate}`], []];
    glAccounts.forEach((acct: any) => {
      aoa.push([`${acct.accountCode} — ${acct.accountName}`]);
      aoa.push(["วันที่", "อ้างอิง", "รายละเอียด", "สมุดบัญชี", "เดบิต", "เครดิต", "ยอดคงเหลือ"]);
      if (acct.beginBalance) aoa.push(["", "", "ยอดยกมา", "", "", "", acct.beginBalance]);
      (acct.lines || []).forEach((l: any) => aoa.push([l.entryDate, l.reference, l.entryDescription, l.journalBook, l.debit, l.credit, l.balance]));
      aoa.push([]);
    });
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "บัญชีแยกประเภท");
    XLSX.writeFile(wb, `บัญชีแยกประเภท_${selectedCompany?.name || ""}.xlsx`);
  };

  const buildGlHtml = () => {
    const sections = glAccounts.map((acct: any) => {
      const lineRows = (acct.lines || []).map((l: any) => `<tr><td>${esc(l.entryDate)}</td><td>${esc(l.reference) || "-"}</td><td>${esc(l.entryDescription) || "-"}</td><td>${esc(l.journalBook) || "-"}</td><td style="text-align:right">${fmt(l.debit)}</td><td style="text-align:right">${fmt(l.credit)}</td><td style="text-align:right">${fmt(l.balance)}</td></tr>`).join("");
      return `<div style="margin-bottom:16px;page-break-inside:avoid"><div style="background:#f1f5f9;padding:6px 10px;font-weight:700;border:1px solid #ddd;border-bottom:none">${esc(acct.accountCode)} — ${esc(acct.accountName)}</div><table><thead><tr><th>วันที่</th><th>อ้างอิง</th><th>รายละเอียด</th><th>สมุดบัญชี</th><th style="text-align:right">เดบิต</th><th style="text-align:right">เครดิต</th><th style="text-align:right">ยอดคงเหลือ</th></tr></thead><tbody>${acct.beginBalance ? `<tr style="background:#eef6ff"><td colspan="4" style="text-align:right;font-weight:500">ยอดยกมา</td><td>-</td><td>-</td><td style="text-align:right;font-weight:700">${fmt(acct.beginBalance)}</td></tr>` : ""}${lineRows}</tbody></table></div>`;
    }).join("");
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>บัญชีแยกประเภท</title><style>body{font-family:'Sarabun',sans-serif;font-size:12px;padding:20px}h2{text-align:center}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:3px 6px;font-size:11px}th{background:#334155;color:white}@media print{@page{size:landscape}}</style></head><body><h2>บัญชีแยกประเภท</h2><p style="text-align:center">${esc(selectedCompany?.name)} — ${esc(startDate)} ถึง ${esc(endDate)}</p>${sections}</body></html>`;
  };
  const handlePrint = () => openPrint(buildGlHtml());
  const handlePdf = () => downloadPdf(buildGlHtml(), `บัญชีแยกประเภท_${selectedCompany?.name || "report"}`);

  return (
    <LegacyLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <BookOpen className="h-6 w-6" style={{ color: themeColors.primary }} />
          <h1 className="text-xl font-bold">บัญชีแยกประเภท (General Ledger)</h1>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">เริ่ม</label>
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-9 w-[160px]" data-testid="input-gl-start" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">สิ้นสุด</label>
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-9 w-[160px]" data-testid="input-gl-end" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">บัญชี</label>
            <select value={accountCode} onChange={e => setAccountCode(e.target.value)} className="h-9 border rounded-lg px-2 text-sm min-w-[200px]" data-testid="select-gl-account">
              <option value="">ทุกบัญชี</option>
              {accounts.map((a: any) => <option key={a.id} value={a.accountCode}>{a.accountCode} {a.accountName}</option>)}
            </select>
          </div>
          <Button variant="outline" size="sm" className="h-9 gap-1.5 border-green-400 text-green-600" onClick={() => refetch()} disabled={isLoading} data-testid="button-gl-refresh">
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} /> สร้างรายงาน
          </Button>
          <Button variant="outline" size="sm" className="h-9 gap-1.5 border-blue-300 text-blue-600" onClick={handlePrint} data-testid="button-gl-print"><Printer className="h-4 w-4" /> พิมพ์</Button>
          <Button variant="outline" size="sm" className="h-9 gap-1.5 border-red-300 text-red-600" onClick={handlePdf} data-testid="button-gl-pdf"><FileDown className="h-4 w-4" /> PDF</Button>
          <Button size="sm" className="h-9 gap-1.5 text-white" style={{ background: "#03c9d7" }} onClick={handleExcel} data-testid="button-gl-excel"><FileDown className="h-4 w-4" /> Excel</Button>
        </div>

        <div className="space-y-4">
          {isLoading ? (
            <div className="py-16 text-center text-muted-foreground bg-white border rounded-xl">กำลังโหลด...</div>
          ) : glAccounts.length === 0 ? (
            <div className="py-16 text-center bg-white border rounded-xl">
              <BookOpen className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">ไม่พบข้อมูล</p>
            </div>
          ) : glAccounts.map((acct: any) => (
            <div key={acct.accountCode} className="bg-white border rounded-xl shadow-sm overflow-hidden" data-testid={`section-gl-${acct.accountCode}`}>
              <div className="px-4 py-2.5 bg-slate-50 border-b font-semibold text-sm">
                {acct.accountCode} — {acct.accountName}
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent" style={{ background: themeColors.primary }}>
                    <TableHead className="text-sm font-bold text-white w-[100px]">วันที่</TableHead>
                    <TableHead className="text-sm font-bold text-white w-[130px]">อ้างอิง</TableHead>
                    <TableHead className="text-sm font-bold text-white">รายละเอียด</TableHead>
                    <TableHead className="text-sm font-bold text-white w-[90px]">สมุดบัญชี</TableHead>
                    <TableHead className="text-sm font-bold text-white w-[110px] text-right">เดบิต</TableHead>
                    <TableHead className="text-sm font-bold text-white w-[110px] text-right">เครดิต</TableHead>
                    <TableHead className="text-sm font-bold text-white w-[120px] text-right">ยอดคงเหลือ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {acct.beginBalance !== 0 && acct.beginBalance !== undefined && (
                    <TableRow className="bg-blue-50/40">
                      <TableCell colSpan={4} className="text-sm text-right font-medium text-blue-700">ยอดยกมา</TableCell>
                      <TableCell className="text-sm text-right">-</TableCell>
                      <TableCell className="text-sm text-right">-</TableCell>
                      <TableCell className="text-sm text-right font-bold text-blue-700 tabular-nums">{fmt(acct.beginBalance)}</TableCell>
                    </TableRow>
                  )}
                  {(acct.lines || []).map((line: any, idx: number) => (
                    <TableRow key={idx} style={idx % 2 !== 0 ? { background: "rgba(0,0,0,0.02)" } : undefined}>
                      <TableCell className="text-sm tabular-nums">{line.entryDate}</TableCell>
                      <TableCell className="text-sm font-medium text-blue-600">{line.reference || "-"}</TableCell>
                      <TableCell className="text-sm">{line.entryDescription || "-"}</TableCell>
                      <TableCell className="text-sm">{line.journalBook || "-"}</TableCell>
                      <TableCell className="text-sm text-right tabular-nums">{fmt(line.debit)}</TableCell>
                      <TableCell className="text-sm text-right tabular-nums">{fmt(line.credit)}</TableCell>
                      <TableCell className="text-sm text-right tabular-nums font-medium">{fmt(line.balance)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-slate-100 font-bold border-t-2">
                    <TableCell colSpan={4} className="text-sm text-right font-bold">[{acct.accountCode}] ยอดคงเหลือ</TableCell>
                    <TableCell className="text-sm text-right tabular-nums font-bold">{fmt((acct.lines || []).reduce((s: number, l: any) => s + l.debit, 0))}</TableCell>
                    <TableCell className="text-sm text-right tabular-nums font-bold">{fmt((acct.lines || []).reduce((s: number, l: any) => s + l.credit, 0))}</TableCell>
                    <TableCell className="text-sm text-right tabular-nums font-bold">{fmt(acct.endBalance)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          ))}
        </div>
      </div>
    </LegacyLayout>
  );
}

function IncomeStatementPage() {
  const { selectedId, selectedCompany } = useLegacyCompany();
  const { colors: themeColors } = useThemeColor();
  const [startDate, setStartDate] = useState(getYearStart);
  const [endDate, setEndDate] = useState(getToday);

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/legacy-import/reports/income-statement", selectedId, startDate, endDate],
    queryFn: async () => {
      const res = await fetch(`/api/legacy-import/reports/income-statement?legacyCompanyId=${selectedId}&startDate=${startDate}&endDate=${endDate}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!selectedId,
  });

  const revenues = data?.revenues || [];
  const expenses = data?.expenses || [];
  const totalRevenue = data?.totalRevenue || 0;
  const totalExpense = data?.totalExpense || 0;
  const netIncome = data?.netIncome || 0;

  const handleExcel = () => {
    const aoa: any[][] = [[`งบกำไรขาดทุน — ${selectedCompany?.name || ""}`], [`${startDate} ถึง ${endDate}`], [], ["รหัส", "ชื่อบัญชี", "จำนวนเงิน"]];
    aoa.push(["", "รายได้", ""]);
    revenues.forEach((r: any) => aoa.push([r.code, r.name, r.balance]));
    aoa.push(["", "รวมรายได้", totalRevenue]);
    aoa.push([]);
    aoa.push(["", "ค่าใช้จ่าย", ""]);
    expenses.forEach((r: any) => aoa.push([r.code, r.name, r.balance]));
    aoa.push(["", "รวมค่าใช้จ่าย", totalExpense]);
    aoa.push([]);
    aoa.push(["", "กำไร(ขาดทุน)สุทธิ", netIncome]);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "งบกำไรขาดทุน");
    XLSX.writeFile(wb, `งบกำไรขาดทุน_${selectedCompany?.name || ""}.xlsx`);
  };

  const buildIncomeHtml = () => {
    const revRows = revenues.map((r: any) => `<tr><td>${esc(r.code)}</td><td>${esc(r.name)}</td><td style="text-align:right">${fmt(r.balance)}</td></tr>`).join("");
    const expRows = expenses.map((r: any) => `<tr><td>${esc(r.code)}</td><td>${esc(r.name)}</td><td style="text-align:right">${fmt(r.balance)}</td></tr>`).join("");
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>งบกำไรขาดทุน</title><style>body{font-family:'Sarabun',sans-serif;font-size:12px;padding:20px}h2{text-align:center}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:3px 8px;font-size:11px}th{background:#334155;color:white}.total{background:#f1f5f9;font-weight:bold}@media print{@page{size:portrait}}</style></head><body><h2>งบกำไรขาดทุน</h2><p style="text-align:center">${esc(selectedCompany?.name)} — ${esc(startDate)} ถึง ${esc(endDate)}</p><table><thead><tr><th>รหัส</th><th>ชื่อบัญชี</th><th style="text-align:right">จำนวนเงิน</th></tr></thead><tbody><tr class="total"><td colspan="3">รายได้</td></tr>${revRows}<tr class="total"><td colspan="2">รวมรายได้</td><td style="text-align:right">${fmt(totalRevenue)}</td></tr><tr><td colspan="3"></td></tr><tr class="total"><td colspan="3">ค่าใช้จ่าย</td></tr>${expRows}<tr class="total"><td colspan="2">รวมค่าใช้จ่าย</td><td style="text-align:right">${fmt(totalExpense)}</td></tr><tr style="background:#cbd5e1;font-weight:bold;border-top:2px solid #333"><td colspan="2">กำไร(ขาดทุน)สุทธิ</td><td style="text-align:right;color:${netIncome >= 0 ? '#16a34a' : '#dc2626'}">${fmt(netIncome)}</td></tr></tbody></table></body></html>`;
  };
  const handlePrint = () => openPrint(buildIncomeHtml());
  const handlePdf = () => downloadPdf(buildIncomeHtml(), `งบกำไรขาดทุน_${selectedCompany?.name || "report"}`);

  const renderSection = (title: string, items: any[], total: number, testId: string, color: string) => (
    <div className="mb-4" data-testid={`section-${testId}`}>
      <div className="bg-slate-100 px-4 py-2 font-bold text-sm border-b" style={{ color }}>{title}</div>
      {items.map((item: any, idx: number) => (
        <div key={item.code} className="flex items-center px-4 py-1.5 border-b hover:bg-blue-50/30" style={idx % 2 !== 0 ? { background: "rgba(0,0,0,0.02)" } : undefined} data-testid={`row-${testId}-${item.code}`}>
          <span className="text-sm tabular-nums w-[90px] text-muted-foreground">{item.code}</span>
          <span className="text-sm flex-1">{item.name}</span>
          <span className="text-sm tabular-nums font-medium w-[120px] text-right">{fmt(item.balance)}</span>
        </div>
      ))}
      <div className="flex items-center px-4 py-2 bg-slate-50 border-b font-bold">
        <span className="text-sm flex-1">รวม{title}</span>
        <span className="text-sm tabular-nums font-bold w-[120px] text-right">{fmt(total)}</span>
      </div>
    </div>
  );

  return (
    <LegacyLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <TrendingUp className="h-6 w-6" style={{ color: themeColors.primary }} />
          <h1 className="text-xl font-bold">งบกำไรขาดทุน (Income Statement)</h1>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">เริ่ม</label>
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-9 w-[160px]" data-testid="input-is-start" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">สิ้นสุด</label>
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-9 w-[160px]" data-testid="input-is-end" />
          </div>
          <Button variant="outline" size="sm" className="h-9 gap-1.5 border-green-400 text-green-600" onClick={() => refetch()} disabled={isLoading} data-testid="button-is-refresh">
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} /> สร้างรายงาน
          </Button>
          <Button variant="outline" size="sm" className="h-9 gap-1.5 border-blue-300 text-blue-600" onClick={handlePrint} data-testid="button-is-print"><Printer className="h-4 w-4" /> พิมพ์</Button>
          <Button variant="outline" size="sm" className="h-9 gap-1.5 border-red-300 text-red-600" onClick={handlePdf} data-testid="button-is-pdf"><FileDown className="h-4 w-4" /> PDF</Button>
          <Button size="sm" className="h-9 gap-1.5 text-white" style={{ background: "#03c9d7" }} onClick={handleExcel} data-testid="button-is-excel"><FileDown className="h-4 w-4" /> Excel</Button>
        </div>

        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="py-16 text-center text-muted-foreground">กำลังโหลด...</div>
          ) : revenues.length === 0 && expenses.length === 0 ? (
            <div className="py-16 text-center">
              <TrendingUp className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">ไม่พบข้อมูล</p>
            </div>
          ) : (
            <>
              <div className="text-center py-4 border-b">
                <h2 className="text-lg font-bold">{selectedCompany?.name}</h2>
                <p className="text-sm text-muted-foreground">งบกำไรขาดทุน — {startDate} ถึง {endDate}</p>
              </div>
              {renderSection("รายได้", revenues, totalRevenue, "revenue", "#16a34a")}
              {renderSection("ค่าใช้จ่าย", expenses, totalExpense, "expense", "#dc2626")}
              <div className="flex items-center px-4 py-3 bg-slate-200 font-bold border-t-2" data-testid="row-net-income">
                <span className="text-sm flex-1 font-bold">กำไร(ขาดทุน)สุทธิ</span>
                <span className={`text-sm tabular-nums font-bold w-[120px] text-right ${netIncome >= 0 ? "text-green-700" : "text-red-700"}`}>{fmt(netIncome)}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </LegacyLayout>
  );
}

function BalanceSheetPage() {
  const { selectedId, selectedCompany } = useLegacyCompany();
  const { colors: themeColors } = useThemeColor();
  const [asOfDate, setAsOfDate] = useState(getToday);

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/legacy-import/reports/balance-sheet", selectedId, asOfDate],
    queryFn: async () => {
      const res = await fetch(`/api/legacy-import/reports/balance-sheet?legacyCompanyId=${selectedId}&asOfDate=${asOfDate}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!selectedId,
  });

  const assets = data?.assets || [];
  const liabilities = data?.liabilities || [];
  const equity = data?.equity || [];
  const totalAssets = data?.totalAssets || 0;
  const totalLiabilities = data?.totalLiabilities || 0;
  const totalEquity = data?.totalEquity || 0;
  const totalLE = data?.totalLiabilitiesAndEquity || 0;
  const isBalanced = Math.abs(totalAssets - totalLE) < 0.01;

  const handleExcel = () => {
    const aoa: any[][] = [[`งบแสดงฐานะทางการเงิน — ${selectedCompany?.name || ""}`], [`ณ วันที่ ${asOfDate}`], [], ["รหัส", "ชื่อบัญชี", "ยอดคงเหลือ"]];
    aoa.push(["", "สินทรัพย์", ""]); assets.forEach((a: any) => aoa.push([a.code, a.name, a.balance])); aoa.push(["", "รวมสินทรัพย์", totalAssets]); aoa.push([]);
    aoa.push(["", "หนี้สิน", ""]); liabilities.forEach((a: any) => aoa.push([a.code, a.name, a.balance])); aoa.push(["", "รวมหนี้สิน", totalLiabilities]); aoa.push([]);
    aoa.push(["", "ส่วนของเจ้าของ", ""]); equity.forEach((a: any) => aoa.push([a.code, a.name, a.balance])); aoa.push(["", "รวมส่วนของเจ้าของ", totalEquity]); aoa.push([]);
    aoa.push(["", "รวมหนี้สินและส่วนของเจ้าของ", totalLE]);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "งบดุล");
    XLSX.writeFile(wb, `งบดุล_${selectedCompany?.name || ""}.xlsx`);
  };

  const buildBsHtml = () => {
    const renderItems = (items: any[]) => items.map(i => `<tr><td>${esc(i.code)}</td><td>${esc(i.name)}</td><td style="text-align:right">${fmt(i.balance)}</td></tr>`).join("");
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>งบแสดงฐานะทางการเงิน</title><style>body{font-family:'Sarabun',sans-serif;font-size:12px;padding:20px}h2{text-align:center}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:3px 8px;font-size:11px}th{background:#334155;color:white}.section{background:#f1f5f9;font-weight:bold}.total{background:#e2e8f0;font-weight:bold}@media print{@page{size:portrait}}</style></head><body><h2>งบแสดงฐานะทางการเงิน</h2><p style="text-align:center">${esc(selectedCompany?.name)} ณ วันที่ ${esc(asOfDate)}</p><table><thead><tr><th>รหัส</th><th>ชื่อบัญชี</th><th style="text-align:right">ยอดคงเหลือ</th></tr></thead><tbody><tr class="section"><td colspan="3">สินทรัพย์</td></tr>${renderItems(assets)}<tr class="total"><td colspan="2">รวมสินทรัพย์</td><td style="text-align:right">${fmt(totalAssets)}</td></tr><tr><td colspan="3"></td></tr><tr class="section"><td colspan="3">หนี้สิน</td></tr>${renderItems(liabilities)}<tr class="total"><td colspan="2">รวมหนี้สิน</td><td style="text-align:right">${fmt(totalLiabilities)}</td></tr><tr><td colspan="3"></td></tr><tr class="section"><td colspan="3">ส่วนของเจ้าของ</td></tr>${renderItems(equity)}<tr class="total"><td colspan="2">รวมส่วนของเจ้าของ</td><td style="text-align:right">${fmt(totalEquity)}</td></tr><tr style="background:#cbd5e1;font-weight:bold;border-top:2px solid #333"><td colspan="2">รวมหนี้สินและส่วนของเจ้าของ</td><td style="text-align:right">${fmt(totalLE)}</td></tr></tbody></table></body></html>`;
  };
  const handlePrint = () => openPrint(buildBsHtml());
  const handlePdf = () => downloadPdf(buildBsHtml(), `งบดุล_${selectedCompany?.name || "report"}`);

  const renderSection = (title: string, items: any[], total: number, label: string, testId: string) => (
    <div className="mb-4" data-testid={`section-${testId}`}>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent" style={{ background: themeColors.primary }}>
            <TableHead className="text-sm font-bold text-white w-[100px]">รหัส</TableHead>
            <TableHead className="text-sm font-bold text-white">ชื่อบัญชี</TableHead>
            <TableHead className="text-sm font-bold text-white w-[140px] text-right">ยอดคงเหลือ</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow className="bg-blue-50/50"><TableCell colSpan={3} className="font-bold text-sm" style={{ color: themeColors.primary }}>{title}</TableCell></TableRow>
          {items.length === 0 ? (
            <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground text-sm py-4">ไม่มีรายการ</TableCell></TableRow>
          ) : items.map((item: any, idx: number) => (
            <TableRow key={item.code} style={idx % 2 !== 0 ? { background: "rgba(0,0,0,0.02)" } : undefined} data-testid={`row-${testId}-${idx}`}>
              <TableCell className="text-sm tabular-nums">{item.code}</TableCell>
              <TableCell className="text-sm">{item.name}</TableCell>
              <TableCell className="text-sm text-right tabular-nums font-medium">{fmt(item.balance)}</TableCell>
            </TableRow>
          ))}
          <TableRow className="bg-slate-100 border-t-2">
            <TableCell colSpan={2} className="text-sm font-bold">{label}</TableCell>
            <TableCell className="text-sm font-bold text-right tabular-nums" data-testid={`total-${testId}`}>{fmt(total)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );

  return (
    <LegacyLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Scale className="h-6 w-6" style={{ color: themeColors.primary }} />
          <h1 className="text-xl font-bold">งบแสดงฐานะทางการเงิน (Balance Sheet)</h1>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">ณ วันที่</label>
            <Input type="date" value={asOfDate} onChange={e => setAsOfDate(e.target.value)} className="h-9 w-[160px]" data-testid="input-bs-date" />
          </div>
          <Button variant="outline" size="sm" className="h-9 gap-1.5 border-green-400 text-green-600" onClick={() => refetch()} disabled={isLoading} data-testid="button-bs-refresh">
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} /> สร้างรายงาน
          </Button>
          <Button variant="outline" size="sm" className="h-9 gap-1.5 border-blue-300 text-blue-600" onClick={handlePrint} data-testid="button-bs-print"><Printer className="h-4 w-4" /> พิมพ์</Button>
          <Button variant="outline" size="sm" className="h-9 gap-1.5 border-red-300 text-red-600" onClick={handlePdf} data-testid="button-bs-pdf"><FileDown className="h-4 w-4" /> PDF</Button>
          <Button size="sm" className="h-9 gap-1.5 text-white" style={{ background: "#03c9d7" }} onClick={handleExcel} data-testid="button-bs-excel"><FileDown className="h-4 w-4" /> Excel</Button>
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-muted-foreground bg-white border rounded-xl">กำลังโหลด...</div>
        ) : (
          <div className="bg-white border rounded-xl shadow-sm p-4">
            <div className="text-center mb-4">
              <h2 className="text-lg font-bold">{selectedCompany?.name}</h2>
              <p className="text-sm text-muted-foreground">งบแสดงฐานะทางการเงิน ณ วันที่ {asOfDate}</p>
            </div>
            {renderSection("สินทรัพย์ (Assets)", assets, totalAssets, "รวมสินทรัพย์", "assets")}
            {renderSection("หนี้สิน (Liabilities)", liabilities, totalLiabilities, "รวมหนี้สิน", "liabilities")}
            {renderSection("ส่วนของเจ้าของ (Equity)", equity, totalEquity, "รวมส่วนของเจ้าของ", "equity")}

            <div className="pt-3 mt-2 border-t-2 flex justify-between items-center px-2" style={{ borderColor: themeColors.primary }}>
              <span className="text-sm font-bold" style={{ color: themeColors.primary }}>รวมหนี้สินและส่วนของเจ้าของ</span>
              <span className="text-sm font-bold tabular-nums" data-testid="total-le">{fmt(totalLE)}</span>
            </div>

            <div className="mt-4 flex items-center gap-2 justify-center" data-testid="balance-status">
              {isBalanced ? (
                <span className="text-sm font-medium text-green-600">✓ งบดุล: สินทรัพย์ = หนี้สิน + ส่วนของเจ้าของ (สมดุล)</span>
              ) : (
                <span className="text-sm font-medium text-amber-500">⚠ งบดุล: ไม่สมดุล (ผลต่าง {fmt(Math.abs(totalAssets - totalLE))})</span>
              )}
            </div>
          </div>
        )}
      </div>
    </LegacyLayout>
  );
}

function TaxSummaryPage() {
  const { selectedId, selectedCompany } = useLegacyCompany();
  const { colors: themeColors } = useThemeColor();
  const [startDate, setStartDate] = useState(getYearStart);
  const [endDate, setEndDate] = useState(getToday);

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/legacy-import/reports/tax-summary", selectedId, startDate, endDate],
    queryFn: async () => {
      const res = await fetch(`/api/legacy-import/reports/tax-summary?legacyCompanyId=${selectedId}&startDate=${startDate}&endDate=${endDate}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!selectedId,
  });

  const vatOutput = data?.vatOutput || { total: 0, lines: [] };
  const vatInput = data?.vatInput || { total: 0, lines: [] };
  const wht = data?.wht || { total: 0, lines: [] };
  const netVat = data?.netVat || 0;

  const handleExcel = () => {
    const aoa: any[][] = [[`สรุปภาษี — ${selectedCompany?.name || ""}`], [`${startDate} ถึง ${endDate}`], []];
    aoa.push(["ประเภท", "จำนวนเงิน"]);
    aoa.push(["ภาษีขาย (Output VAT)", vatOutput.total]);
    aoa.push(["ภาษีซื้อ (Input VAT)", vatInput.total]);
    aoa.push(["ภาษีมูลค่าเพิ่มสุทธิ", netVat]);
    aoa.push(["ภาษีหัก ณ ที่จ่าย (WHT)", wht.total]);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "สรุปภาษี");
    XLSX.writeFile(wb, `สรุปภาษี_${selectedCompany?.name || ""}.xlsx`);
  };

  const buildTaxHtml = () => {
    const renderLines = (lines: any[]) => lines.slice(0, 100).map((l: any) => `<tr><td>${esc(l.glDate)}</td><td>${esc(l.glNo)}</td><td>${esc(l.accountCode)}</td><td>${esc(l.description || l.accountName)}</td><td style="text-align:right">${fmt(l.debit)}</td><td style="text-align:right">${fmt(l.credit)}</td></tr>`).join("");
    const thStyle = 'style="border:1px solid #ccc;padding:3px 6px;font-size:11px;background:#334155;color:white"';
    const renderSection = (title: string, total: number, lines: any[], color: string) => `<div style="margin-bottom:12px"><div style="background:${color};color:white;padding:6px 12px;font-weight:bold;display:flex;justify-content:space-between"><span>${esc(title)}</span><span>${fmt(total)}</span></div>${lines.length ? `<table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr><th ${thStyle}>วันที่</th><th ${thStyle}>เลขที่</th><th ${thStyle}>รหัส</th><th ${thStyle}>คำอธิบาย</th><th ${thStyle} style="text-align:right">เดบิต</th><th ${thStyle} style="text-align:right">เครดิต</th></tr></thead><tbody>${renderLines(lines)}</tbody></table>` : ""}</div>`;
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>สรุปภาษี</title><style>body{font-family:'Sarabun',sans-serif;font-size:12px;padding:20px}h2{text-align:center}table{width:100%;border-collapse:collapse}td{border:1px solid #ccc;padding:3px 6px}@media print{@page{size:portrait}}</style></head><body><h2>สรุปภาษี</h2><p style="text-align:center">${esc(selectedCompany?.name)} — ${esc(startDate)} ถึง ${esc(endDate)}</p>${renderSection("ภาษีขาย (Output VAT)", vatOutput.total, vatOutput.lines, "#16a34a")}${renderSection("ภาษีซื้อ (Input VAT)", vatInput.total, vatInput.lines, "#2563eb")}<div style="margin:8px 0;padding:8px 12px;border:2px solid #ccc;display:flex;justify-content:space-between;font-weight:bold"><span>ภาษีมูลค่าเพิ่มสุทธิ</span><span style="color:${netVat >= 0 ? '#dc2626' : '#16a34a'}">${fmt(netVat)}</span></div>${renderSection("ภาษีหัก ณ ที่จ่าย (WHT)", wht.total, wht.lines, "#9333ea")}</body></html>`;
  };
  const handlePrint = () => openPrint(buildTaxHtml());
  const handlePdf = () => downloadPdf(buildTaxHtml(), `สรุปภาษี_${selectedCompany?.name || "report"}`);

  const renderTaxSection = (title: string, total: number, lines: any[], color: string, testId: string) => (
    <div className="mb-6" data-testid={`section-${testId}`}>
      <div className="flex items-center justify-between px-4 py-3 rounded-t-lg" style={{ background: color, color: "white" }}>
        <span className="text-sm font-bold">{title}</span>
        <span className="text-sm font-bold tabular-nums">{fmt(total)}</span>
      </div>
      {lines.length > 0 && (
        <div className="border border-t-0 rounded-b-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent bg-slate-50">
                <TableHead className="text-xs w-[90px]">วันที่</TableHead>
                <TableHead className="text-xs w-[120px]">เลขที่</TableHead>
                <TableHead className="text-xs w-[100px]">รหัสบัญชี</TableHead>
                <TableHead className="text-xs">คำอธิบาย</TableHead>
                <TableHead className="text-xs w-[100px] text-right">เดบิต</TableHead>
                <TableHead className="text-xs w-[100px] text-right">เครดิต</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.slice(0, 50).map((l: any, idx: number) => (
                <TableRow key={idx} style={idx % 2 !== 0 ? { background: "rgba(0,0,0,0.02)" } : undefined}>
                  <TableCell className="text-xs tabular-nums">{l.glDate || "-"}</TableCell>
                  <TableCell className="text-xs">{l.glNo || "-"}</TableCell>
                  <TableCell className="text-xs font-mono">{l.accountCode || "-"}</TableCell>
                  <TableCell className="text-xs">{l.description || l.accountName || "-"}</TableCell>
                  <TableCell className="text-xs text-right tabular-nums">{fmt(l.debit)}</TableCell>
                  <TableCell className="text-xs text-right tabular-nums">{fmt(l.credit)}</TableCell>
                </TableRow>
              ))}
              {lines.length > 50 && (
                <TableRow><TableCell colSpan={6} className="text-xs text-center text-muted-foreground py-2">...แสดง 50 จาก {lines.length} รายการ</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );

  return (
    <LegacyLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Receipt className="h-6 w-6" style={{ color: themeColors.primary }} />
          <h1 className="text-xl font-bold">สรุปภาษี (Tax Summary)</h1>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">เริ่ม</label>
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-9 w-[160px]" data-testid="input-tax-start" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">สิ้นสุด</label>
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-9 w-[160px]" data-testid="input-tax-end" />
          </div>
          <Button variant="outline" size="sm" className="h-9 gap-1.5 border-green-400 text-green-600" onClick={() => refetch()} disabled={isLoading} data-testid="button-tax-refresh">
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} /> สร้างรายงาน
          </Button>
          <Button variant="outline" size="sm" className="h-9 gap-1.5 border-blue-300 text-blue-600" onClick={handlePrint} data-testid="button-tax-print"><Printer className="h-4 w-4" /> พิมพ์</Button>
          <Button variant="outline" size="sm" className="h-9 gap-1.5 border-red-300 text-red-600" onClick={handlePdf} data-testid="button-tax-pdf"><FileDown className="h-4 w-4" /> PDF</Button>
          <Button size="sm" className="h-9 gap-1.5 text-white" style={{ background: "#03c9d7" }} onClick={handleExcel} data-testid="button-tax-excel"><FileDown className="h-4 w-4" /> Excel</Button>
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-muted-foreground bg-white border rounded-xl">กำลังโหลด...</div>
        ) : (
          <div className="space-y-2">
            {renderTaxSection("ภาษีขาย (Output VAT)", vatOutput.total, vatOutput.lines, "#16a34a", "vat-output")}
            {renderTaxSection("ภาษีซื้อ (Input VAT)", vatInput.total, vatInput.lines, "#2563eb", "vat-input")}

            <div className="bg-white border rounded-xl shadow-sm p-4 flex items-center justify-between" data-testid="net-vat">
              <span className="text-sm font-bold">ภาษีมูลค่าเพิ่มสุทธิ (Net VAT)</span>
              <span className={`text-lg font-bold tabular-nums ${netVat >= 0 ? "text-red-600" : "text-green-600"}`}>{fmt(netVat)}</span>
            </div>

            {renderTaxSection("ภาษีหัก ณ ที่จ่าย (WHT)", wht.total, wht.lines, "#9333ea", "wht")}
          </div>
        )}
      </div>
    </LegacyLayout>
  );
}

export default function LegacyReportsPage() {
  const [matchTB] = useRoute("/legacy-import/reports/trial-balance");
  const [matchGL] = useRoute("/legacy-import/reports/general-ledger");
  const [matchIS] = useRoute("/legacy-import/reports/income-statement");
  const [matchBS] = useRoute("/legacy-import/reports/balance-sheet");
  const [matchTax] = useRoute("/legacy-import/reports/tax-summary");

  if (matchTB) return <TrialBalancePage />;
  if (matchGL) return <GeneralLedgerPage />;
  if (matchIS) return <IncomeStatementPage />;
  if (matchBS) return <BalanceSheetPage />;
  if (matchTax) return <TaxSummaryPage />;

  return <TrialBalancePage />;
}
