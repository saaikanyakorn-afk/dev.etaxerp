import { useState, useMemo } from "react";
import Layout from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { BookOpen, Printer, FileDown, RefreshCw, Loader2 } from "lucide-react";
import ThaiDateInput from "@/components/thai-date-input";
import { formatDate, formatNumber } from "@/lib/format";
import { toLocalDateStr } from "@/lib/utils";
import { useDateSettings } from "@/hooks/use-date-settings";
import * as XLSX from "xlsx";

const JOURNAL_BOOKS = [
  { key: "all", num: "", label: "ทั้งหมด" },
  { key: "general", num: "1", label: "1 - สมุดรายวันทั่วไป" },
  { key: "receive", num: "2", label: "2 - สมุดรายวันรับเงิน" },
  { key: "payment", num: "3", label: "3 - สมุดรายวันจ่ายเงิน" },
  { key: "sales", num: "4", label: "4 - สมุดรายวันขาย" },
  { key: "purchase", num: "5", label: "5 - สมุดรายวันซื้อ" },
];

const BOOK_MAP: Record<string, string> = {
  general: "1", receive: "2", payment: "3", sales: "4", purchase: "5",
};

function fmt(val: string | number | null | undefined): string {
  const n = parseFloat(String(val || "0"));
  if (n === 0) return "-";
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function JournalBookReport() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const { dateEra, dateFmt } = useDateSettings();

  const now = new Date();
  const yearStart = `${now.getFullYear()}-01-01`;
  const todayStr = toLocalDateStr(now);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [bookFilter, setBookFilter] = useState("all");

  const { data: rawEntries = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["/api/journal-entries", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const res = await fetch(`/api/journal-entries?companyId=${companyId}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!companyId,
  });

  const { data: allLines = [] } = useQuery<any[]>({
    queryKey: ["/api/journal-book-report-lines", companyId, startDate, endDate],
    queryFn: async () => {
      if (!companyId) return [];
      const params = new URLSearchParams({ companyId: String(companyId), startDate, endDate });
      const res = await fetch(`/api/reports/journal-book?${params}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!companyId && !!startDate && !!endDate,
  });

  const groupedEntries = useMemo(() => {
    const filtered = allLines.filter((line: any) => {
      if (bookFilter !== "all" && (line.journalBook || "general") !== bookFilter) return false;
      return true;
    });

    const groups: Record<number, { entry: any; lines: any[] }> = {};
    filtered.forEach((line: any) => {
      const eid = line.journalEntryId;
      if (!groups[eid]) {
        groups[eid] = {
          entry: {
            id: eid,
            entryDate: line.entryDate,
            entryNo: line.entryNo,
            reference: line.reference,
            description: line.entryDescription,
            journalBook: line.journalBook,
          },
          lines: [],
        };
      }
      groups[eid].lines.push(line);
    });

    return Object.values(groups).sort((a, b) => {
      const da = new Date(a.entry.entryDate).getTime();
      const db_val = new Date(b.entry.entryDate).getTime();
      if (da !== db_val) return da - db_val;
      return (a.entry.id || 0) - (b.entry.id || 0);
    });
  }, [allLines, bookFilter]);

  const totals = useMemo(() => {
    let debit = 0, credit = 0;
    groupedEntries.forEach(g => {
      g.lines.forEach(l => {
        debit += parseFloat(l.debit) || 0;
        credit += parseFloat(l.credit) || 0;
      });
    });
    return { debit, credit };
  }, [groupedEntries]);

  const bookLabel = JOURNAL_BOOKS.find(b => b.key === bookFilter)?.label || "ทั้งหมด";
  const companyName = selectedCompany?.name || "";

  function handlePrint() {
    if (groupedEntries.length === 0) return;
    const sections = groupedEntries.map(g => {
      const e = g.entry;
      const bookNum = BOOK_MAP[e.journalBook || "general"] || "1";
      const bookName = JOURNAL_BOOKS.find(b => b.key === (e.journalBook || "general"))?.label || "";
      const lineRows = g.lines.map(l =>
        `<tr>
          <td>${l.accountCode || "-"}</td>
          <td>${l.accountName || "-"}</td>
          <td>${l.lineDescription || "-"}</td>
          <td style="text-align:right;font-family:'Sarabun',sans-serif;font-variant-numeric:tabular-nums">${fmt(l.debit)}</td>
          <td style="text-align:right;font-family:'Sarabun',sans-serif;font-variant-numeric:tabular-nums">${fmt(l.credit)}</td>
        </tr>`
      ).join("");
      const totalDebit = g.lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
      const totalCredit = g.lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
      return `<div class="entry-section">
        <div class="entry-header">
          <span>${formatDate(e.entryDate, dateEra, dateFmt)}</span>
          <span>[${bookNum}-${bookName.replace(/^\d+ - /, "")}]</span>
          <span style="color:#3b82f6;font-weight:600">${e.reference || e.entryNo || "-"}</span>
          <span>${e.description || "-"}</span>
        </div>
        <table><thead><tr>
          <th style="width:100px">รหัสบัญชี</th>
          <th>ชื่อบัญชี</th>
          <th>รายละเอียด</th>
          <th style="width:110px;text-align:right">เดบิต</th>
          <th style="width:110px;text-align:right">เครดิต</th>
        </tr></thead><tbody>
          ${lineRows}
          <tr class="total-row">
            <td colspan="3" style="text-align:right;font-weight:700">รวม</td>
            <td style="text-align:right;font-family:'Sarabun',sans-serif;font-variant-numeric:tabular-nums;font-weight:700">${fmt(totalDebit)}</td>
            <td style="text-align:right;font-family:'Sarabun',sans-serif;font-variant-numeric:tabular-nums;font-weight:700">${fmt(totalCredit)}</td>
          </tr>
        </tbody></table>
      </div>`;
    }).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>รายงานสมุดบัญชีรายวัน</title>
      <style>
        body { font-family:'Sarabun','Inter',sans-serif; font-size:12px; padding:20px; }
        h2 { text-align:center; margin-bottom:4px; font-size:16px; }
        .subtitle { text-align:center; margin-bottom:16px; font-size:13px; color:#555; }
        .entry-section { margin-bottom:12px; page-break-inside:avoid; }
        .entry-header { background:#f1f5f9; padding:6px 10px; font-weight:600; font-size:11px; border:1px solid #ddd; border-bottom:none; display:flex; gap:12px; align-items:center; }
        table { width:100%; border-collapse:collapse; table-layout:fixed; }
        th, td { border:1px solid #ccc; padding:3px 6px; font-size:11px; }
        th { background:#fb9678; color:white; font-weight:600; }
        .total-row td { background:#f1f5f9; border-top:2px solid #333; }
        @media print { body { padding:10px; } .entry-section { page-break-inside:avoid; } }
      </style></head><body>
      <h2>${companyName}</h2>
      <div class="subtitle">รายงานสมุดบัญชีรายวัน: ${bookLabel}<br/>
      ตั้งแต่ ${formatDate(startDate, dateEra, dateFmt)} ถึง ${formatDate(endDate, dateEra, dateFmt)}</div>
      ${sections}
      <div style="margin-top:16px; border-top:2px solid #333; padding-top:8px; display:flex; justify-content:flex-end; gap:40px; font-weight:700; font-size:13px;">
        <span>รวมทั้งสิ้น เดบิต: ${fmt(totals.debit)}</span>
        <span>เครดิต: ${fmt(totals.credit)}</span>
      </div>
    </body></html>`;

    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  }

  function handleExcel() {
    if (groupedEntries.length === 0) return;
    const rows: any[] = [];
    rows.push(["วันที่", "สมุดบัญชี", "อ้างอิง", "รายละเอียด", "รหัสบัญชี", "ชื่อบัญชี", "Note", "เดบิต", "เครดิต"]);
    groupedEntries.forEach(g => {
      const e = g.entry;
      const bookNum = BOOK_MAP[e.journalBook || "general"] || "1";
      g.lines.forEach(l => {
        rows.push([
          formatDate(e.entryDate, dateEra, dateFmt),
          bookNum,
          e.reference || e.entryNo || "-",
          e.description || "-",
          l.accountCode || "-",
          l.accountName || "-",
          l.lineDescription || "-",
          parseFloat(l.debit) || 0,
          parseFloat(l.credit) || 0,
        ]);
      });
    });
    rows.push(["", "", "", "", "", "", "รวมทั้งสิ้น", totals.debit, totals.credit]);
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "สมุดบัญชีรายวัน");
    XLSX.writeFile(wb, `journal-book-report-${bookFilter}.xlsx`);
  }

  return (
    <Layout>
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg text-white" style={{ background: "#fb9678" }}>
          <BookOpen className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-journal-book-report-title">รายงานสมุดบัญชีรายวัน</h1>
          <p className="text-sm text-muted-foreground">รายงาน</p>
        </div>
      </div>

      <div className="bg-white border rounded-xl shadow-sm">
        <div className="p-3 border-b flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground whitespace-nowrap">จาก</span>
            <ThaiDateInput value={startDate} onChange={setStartDate} dateEra={dateEra} dateFmt={dateFmt} className="w-[160px]" data-testid="input-date-from" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground whitespace-nowrap">ถึง</span>
            <ThaiDateInput value={endDate} onChange={setEndDate} dateEra={dateEra} dateFmt={dateFmt} className="w-[160px]" data-testid="input-date-to" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground whitespace-nowrap">สมุดบัญชี</span>
            <Select value={bookFilter} onValueChange={setBookFilter}>
              <SelectTrigger className="h-9 w-[220px]" data-testid="select-book-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {JOURNAL_BOOKS.map(b => (
                  <SelectItem key={b.key} value={b.key} data-testid={`option-book-${b.key}`}>{b.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1.5 ml-auto">
            <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={() => refetch()} disabled={isLoading} data-testid="button-generate">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              สร้างรายงาน
            </Button>
            <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={handlePrint} disabled={groupedEntries.length === 0} data-testid="button-print">
              <Printer className="h-4 w-4" /> พิมพ์
            </Button>
            <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs bg-[#05b187] text-white hover:bg-[#049a75] border-none" onClick={handleExcel} disabled={groupedEntries.length === 0} data-testid="button-excel">
              <FileDown className="h-4 w-4" /> Excel
            </Button>
          </div>
        </div>

        <div className="p-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">กำลังโหลดข้อมูล...</span>
            </div>
          ) : groupedEntries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm" data-testid="text-no-data">
              ไม่พบรายการ
            </div>
          ) : (
            <div className="space-y-4">
              {groupedEntries.map(g => {
                const e = g.entry;
                const bookNum = BOOK_MAP[e.journalBook || "general"] || "1";
                const bookName = JOURNAL_BOOKS.find(b => b.key === (e.journalBook || "general"))?.label || "";
                const totalDebit = g.lines.reduce((s: number, l: any) => s + (parseFloat(l.debit) || 0), 0);
                const totalCredit = g.lines.reduce((s: number, l: any) => s + (parseFloat(l.credit) || 0), 0);
                return (
                  <div key={e.id} className="border rounded-lg overflow-hidden">
                    <div className="bg-slate-50 px-3 py-2 flex items-center gap-3 text-sm border-b">
                      <span className="font-semibold">{formatDate(e.entryDate, dateEra, dateFmt)}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[#fb9678]/15 text-[#fb9678] font-medium">[{bookNum}-{bookName.replace(/^\d+ - /, "")}]</span>
                      <span className="text-blue-600 font-semibold">{e.reference || e.entryNo || "-"}</span>
                      <span className="text-muted-foreground">{e.description || ""}</span>
                    </div>
                    <Table className="table-fixed w-full">
                      <colgroup>
                        <col style={{ width: "100px" }} />
                        <col />
                        <col />
                        <col style={{ width: "110px" }} />
                        <col style={{ width: "110px" }} />
                      </colgroup>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent" style={{ background: "var(--theme-table-header)" }}>
                          <TableHead className="text-sm font-bold text-white">รหัสบัญชี</TableHead>
                          <TableHead className="text-sm font-bold text-white">ชื่อบัญชี</TableHead>
                          <TableHead className="text-sm font-bold text-white">รายละเอียด</TableHead>
                          <TableHead className="text-sm font-bold text-white text-right">เดบิต</TableHead>
                          <TableHead className="text-sm font-bold text-white text-right">เครดิต</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {g.lines.map((l: any, i: number) => (
                          <TableRow key={i}>
                            <TableCell className="text-sm font-mono">{l.accountCode || "-"}</TableCell>
                            <TableCell className="text-sm">{l.accountName || "-"}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{l.lineDescription || "-"}</TableCell>
                            <TableCell className="text-sm text-right tabular-nums">{fmt(l.debit)}</TableCell>
                            <TableCell className="text-sm text-right tabular-nums">{fmt(l.credit)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-slate-50 font-bold">
                          <TableCell colSpan={3} className="text-sm text-right">รวม</TableCell>
                          <TableCell className="text-sm text-right tabular-nums">{fmt(totalDebit)}</TableCell>
                          <TableCell className="text-sm text-right tabular-nums">{fmt(totalCredit)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                );
              })}
              <div className="flex justify-end gap-6 pt-3 border-t-2 border-gray-800 font-bold text-sm">
                <span>รวมทั้งสิ้น เดบิต: {fmt(totals.debit)}</span>
                <span>เครดิต: {fmt(totals.credit)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
