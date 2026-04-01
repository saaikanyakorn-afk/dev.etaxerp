import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import LegacyLayout from "@/components/legacy-layout";
import { useLegacyCompany } from "@/lib/legacy-company-context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Loader2, BookOpen, ChevronLeft, ChevronRight, ArrowLeft, FileDown, Printer } from "lucide-react";
import { useThemeColor } from "@/hooks/use-theme-color";
import * as XLSX from "xlsx";

function formatNum(val: string | null | undefined): string {
  if (!val) return "-";
  const n = parseFloat(val);
  if (isNaN(n) || n === 0) return "-";
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const PAGE_SIZE = 30;

function GlEntryList() {
  const { selectedId, selectedCompany } = useLegacyCompany();
  const { colors: themeColors } = useThemeColor();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery<{ entries: any[]; total: number; page: number; totalPages: number }>({
    queryKey: ["/api/legacy-import/gl-entries", selectedId, search, page],
    queryFn: async () => {
      if (!selectedId) return { entries: [], total: 0, page: 1, totalPages: 1 };
      const params = new URLSearchParams({ legacyCompanyId: String(selectedId), page: String(page) });
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(`/api/legacy-import/gl-entries?${params}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!selectedId,
  });

  const entries = data?.entries || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;

  const handleExcel = () => {
    if (entries.length === 0) return;
    const rows = entries.map(e => [e.glNo, e.glDate, e.journalBook || "-", e.description || "-", e.reference || "-", formatNum(e.totalDebit), formatNum(e.totalCredit), e.status || "-"]);
    const ws = XLSX.utils.aoa_to_sheet([["เลขที่", "วันที่", "สมุดบัญชี", "รายละเอียด", "อ้างอิง", "เดบิต", "เครดิต", "สถานะ"], ...rows]);
    ws["!cols"] = [{ wch: 15 }, { wch: 12 }, { wch: 10 }, { wch: 35 }, { wch: 15 }, { wch: 14 }, { wch: 14 }, { wch: 10 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "สมุดรายวัน");
    XLSX.writeFile(wb, `สมุดรายวัน_${selectedCompany?.name || ""}.xlsx`);
  };

  return (
    <LegacyLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <BookOpen className="h-6 w-6" style={{ color: themeColors.primary }} />
          <h1 className="text-xl font-bold">สมุดรายวัน (Journal Entries)</h1>
          <span className="text-sm text-muted-foreground ml-auto">{total} รายการ</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-[400px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="ค้นหาเลขที่, รายละเอียด, อ้างอิง..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-9 h-9" data-testid="input-search-gl" />
          </div>
          <Button variant="outline" size="sm" className="h-9 gap-1.5 border-green-400 text-green-600" onClick={handleExcel} data-testid="button-excel-gl">
            <FileDown className="h-4 w-4" /> Excel
          </Button>
        </div>

        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="py-16 text-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />กำลังโหลด...</div>
          ) : entries.length === 0 ? (
            <div className="py-16 text-center">
              <BookOpen className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-muted-foreground text-sm" data-testid="text-empty-gl">ไม่พบสมุดรายวัน</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent" style={{ background: themeColors.primary }}>
                    <TableHead className="text-sm font-bold text-white w-[140px]">เลขที่</TableHead>
                    <TableHead className="text-sm font-bold text-white w-[100px]">วันที่</TableHead>
                    <TableHead className="text-sm font-bold text-white w-[90px]">สมุดบัญชี</TableHead>
                    <TableHead className="text-sm font-bold text-white">รายละเอียด</TableHead>
                    <TableHead className="text-sm font-bold text-white w-[120px]">อ้างอิง</TableHead>
                    <TableHead className="text-sm font-bold text-white w-[110px] text-right">เดบิต</TableHead>
                    <TableHead className="text-sm font-bold text-white w-[110px] text-right">เครดิต</TableHead>
                    <TableHead className="text-sm font-bold text-white w-[80px] text-center">สถานะ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry: any, idx: number) => (
                    <TableRow key={entry.id} className="cursor-pointer hover:bg-blue-50/50" style={idx % 2 !== 0 ? { background: "rgba(0,0,0,0.02)" } : undefined} onClick={() => setLocation(`/legacy-import/gl-journal/${entry.id}`)} data-testid={`row-gl-${entry.id}`}>
                      <TableCell className="text-sm font-medium" style={{ color: themeColors.primary }}>{entry.glNo || "-"}</TableCell>
                      <TableCell className="text-sm tabular-nums">{entry.glDate || "-"}</TableCell>
                      <TableCell className="text-sm">{entry.journalBook || "-"}</TableCell>
                      <TableCell className="text-sm truncate max-w-[300px]">{entry.description || "-"}</TableCell>
                      <TableCell className="text-sm">{entry.reference || "-"}</TableCell>
                      <TableCell className="text-sm text-right tabular-nums font-medium">{formatNum(entry.totalDebit)}</TableCell>
                      <TableCell className="text-sm text-right tabular-nums font-medium">{formatNum(entry.totalCredit)}</TableCell>
                      <TableCell className="text-center">
                        {entry.status ? <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">{entry.status}</span> : <span className="text-xs text-muted-foreground">-</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <span className="text-sm text-muted-foreground">หน้า {page} / {totalPages} ({total} รายการ)</span>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} data-testid="button-prev-page"><ChevronLeft className="h-4 w-4" /></Button>
                    <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} data-testid="button-next-page"><ChevronRight className="h-4 w-4" /></Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </LegacyLayout>
  );
}

function GlEntryDetail({ id }: { id: number }) {
  const [, setLocation] = useLocation();
  const { selectedCompany } = useLegacyCompany();
  const { colors: themeColors } = useThemeColor();

  const companyId = selectedCompany?.id;
  const { data, isLoading } = useQuery<{ entry: any; lines: any[] }>({
    queryKey: ["/api/legacy-import/gl-entry", id, companyId],
    queryFn: async () => {
      const res = await fetch(`/api/legacy-import/gl-entry/${id}?legacyCompanyId=${companyId}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!companyId,
  });

  const entry = data?.entry;
  const lines = data?.lines || [];

  const buildJournalHtml = () => {
    if (!entry) return "";
    const esc = (s: string | null | undefined) => (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const lineRows = lines.map(l => `<tr><td>${esc(l.accountCode) || "-"}</td><td>${esc(l.accountName) || "-"}</td><td>${esc(l.description) || "-"}</td><td style="text-align:right">${formatNum(l.debit)}</td><td style="text-align:right">${formatNum(l.credit)}</td></tr>`).join("");
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>สมุดรายวัน ${esc(entry.glNo)}</title><style>body{font-family:'Sarabun',sans-serif;font-size:12px;padding:20px}h2{text-align:center}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:4px 8px;font-size:11px}th{background:#f1f5f9;font-weight:600}@media print{@page{size:portrait}}</style></head><body><h2>สมุดรายวัน</h2><p style="text-align:center">${esc(selectedCompany?.name)}</p><table><tr><td><b>เลขที่:</b> ${esc(entry.glNo)}</td><td><b>วันที่:</b> ${esc(entry.glDate)}</td><td><b>สมุดบัญชี:</b> ${esc(entry.journalBook) || "-"}</td></tr><tr><td colspan="3"><b>รายละเอียด:</b> ${esc(entry.description) || "-"}</td></tr></table><br/><table><thead><tr><th>รหัสบัญชี</th><th>ชื่อบัญชี</th><th>คำอธิบาย</th><th style="text-align:right">เดบิต</th><th style="text-align:right">เครดิต</th></tr></thead><tbody>${lineRows}<tr style="background:#f1f5f9;font-weight:bold"><td colspan="3" style="text-align:right">รวม</td><td style="text-align:right">${formatNum(entry.totalDebit)}</td><td style="text-align:right">${formatNum(entry.totalCredit)}</td></tr></tbody></table></body></html>`;
  };
  const openPrintWindow = (html: string) => { const w = window.open("", "_blank"); if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 300); } };
  const handlePrint = () => { const h = buildJournalHtml(); if (h) openPrintWindow(h); };
  const handlePdf = async () => {
    const h = buildJournalHtml();
    if (!h) return;
    const { default: html2pdf } = await import("html2pdf.js");
    const container = document.createElement("div");
    container.innerHTML = h;
    container.style.position = "absolute";
    container.style.left = "-9999px";
    document.body.appendChild(container);
    try {
      await html2pdf().set({ margin: 10, filename: `GL_${entry?.glNo || "entry"}.pdf`, image: { type: "jpeg", quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: "mm", format: "a4", orientation: "portrait" } }).from(container).save();
    } finally { document.body.removeChild(container); }
  };

  const handleExcel = () => {
    if (lines.length === 0) return;
    const rows = lines.map(l => [l.accountCode || "-", l.accountName || "-", l.description || "-", parseFloat(l.debit || "0") || 0, parseFloat(l.credit || "0") || 0]);
    const ws = XLSX.utils.aoa_to_sheet([["สมุดรายวัน: " + (entry?.glNo || "")], ["วันที่: " + (entry?.glDate || "")], [], ["รหัสบัญชี", "ชื่อบัญชี", "คำอธิบาย", "เดบิต", "เครดิต"], ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "รายการ");
    XLSX.writeFile(wb, `GL_${entry?.glNo || "entry"}.xlsx`);
  };

  return (
    <LegacyLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/legacy-import/gl-journal")} data-testid="button-back-gl">
            <ArrowLeft className="h-4 w-4 mr-1" /> กลับ
          </Button>
          <BookOpen className="h-5 w-5" style={{ color: themeColors.primary }} />
          <h1 className="text-lg font-bold">สมุดรายวัน: {entry?.glNo || "..."}</h1>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 border-blue-300 text-blue-600" onClick={handlePrint} data-testid="button-print-gl"><Printer className="h-4 w-4" /> พิมพ์</Button>
            <Button variant="outline" size="sm" className="gap-1.5 border-red-300 text-red-600" onClick={handlePdf} data-testid="button-pdf-gl"><FileDown className="h-4 w-4" /> PDF</Button>
            <Button variant="outline" size="sm" className="gap-1.5 border-green-400 text-green-600" onClick={handleExcel} data-testid="button-excel-gl-detail"><FileDown className="h-4 w-4" /> Excel</Button>
          </div>
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
        ) : !entry ? (
          <div className="py-16 text-center text-muted-foreground">ไม่พบข้อมูล</div>
        ) : (
          <>
            <div className="bg-white border rounded-xl shadow-sm p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div><span className="text-xs text-muted-foreground">เลขที่</span><p className="text-sm font-medium">{entry.glNo || "-"}</p></div>
              <div><span className="text-xs text-muted-foreground">วันที่</span><p className="text-sm font-medium">{entry.glDate || "-"}</p></div>
              <div><span className="text-xs text-muted-foreground">สมุดบัญชี</span><p className="text-sm font-medium">{entry.journalBook || "-"}</p></div>
              <div><span className="text-xs text-muted-foreground">สถานะ</span><p className="text-sm font-medium">{entry.status || "-"}</p></div>
              <div className="col-span-2"><span className="text-xs text-muted-foreground">รายละเอียด</span><p className="text-sm">{entry.description || "-"}</p></div>
              <div><span className="text-xs text-muted-foreground">อ้างอิง</span><p className="text-sm">{entry.reference || "-"}</p></div>
            </div>

            <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent" style={{ background: themeColors.primary }}>
                    <TableHead className="text-sm font-bold text-white w-[120px]">รหัสบัญชี</TableHead>
                    <TableHead className="text-sm font-bold text-white">ชื่อบัญชี</TableHead>
                    <TableHead className="text-sm font-bold text-white">คำอธิบาย</TableHead>
                    <TableHead className="text-sm font-bold text-white w-[120px] text-right">เดบิต</TableHead>
                    <TableHead className="text-sm font-bold text-white w-[120px] text-right">เครดิต</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">ไม่มีรายการ</TableCell></TableRow>
                  ) : (
                    <>
                      {lines.map((line: any, idx: number) => (
                        <TableRow key={line.id} style={idx % 2 !== 0 ? { background: "rgba(0,0,0,0.02)" } : undefined} data-testid={`row-gl-line-${idx}`}>
                          <TableCell className="text-sm font-mono">{line.accountCode || "-"}</TableCell>
                          <TableCell className="text-sm">{line.accountName || "-"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{line.description || "-"}</TableCell>
                          <TableCell className="text-sm text-right tabular-nums font-medium">{formatNum(line.debit)}</TableCell>
                          <TableCell className="text-sm text-right tabular-nums font-medium">{formatNum(line.credit)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-slate-100 font-bold border-t-2">
                        <TableCell colSpan={3} className="text-sm text-right font-bold">รวม</TableCell>
                        <TableCell className="text-sm text-right tabular-nums font-bold">{formatNum(entry.totalDebit)}</TableCell>
                        <TableCell className="text-sm text-right tabular-nums font-bold">{formatNum(entry.totalCredit)}</TableCell>
                      </TableRow>
                    </>
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>
    </LegacyLayout>
  );
}

export default function LegacyGlJournalPage() {
  const [matchDetail, paramsDetail] = useRoute("/legacy-import/gl-journal/:id");
  if (matchDetail && paramsDetail?.id) {
    return <GlEntryDetail id={parseInt(paramsDetail.id)} />;
  }
  return <GlEntryList />;
}
