import { useState, useRef, useCallback } from "react";
import ReportLayout from "@/components/report-layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PieChart, Printer, Calendar as CalendarIcon, Loader2, X, RefreshCw, FileDown, Upload } from "lucide-react";
import * as XLSX from "xlsx";
import { useQuery } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { useToast } from "@/hooks/use-toast";

import { useDateSettings } from "@/hooks/use-date-settings";
const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

function fmt(val: number): string {
  if (val === 0) return "0.00";
  return Math.abs(val).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function VatPP30Report() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const today = new Date();
  const [month, setMonth] = useState(String(today.getMonth() + 1));
  const [year, setYear] = useState(String(today.getFullYear()));
  const [showPreview, setShowPreview] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { toast } = useToast();

  const [line2, setLine2] = useState(0);
  const [line3, setLine3] = useState(0);

  const { dateEra } = useDateSettings();
  const { data: reportData, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/reports/vat-pp30", companyId, month, year],
    queryFn: async () => {
      if (!companyId) return null;
      const params = new URLSearchParams({ companyId: String(companyId), month, year });
      const res = await fetch(`/api/reports/vat-pp30?${params}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!companyId,
  });

  const line1 = reportData?.salesTaxBase || 0;
  const line4 = line1 - line2 - line3;
  const line5 = reportData?.salesVat || 0;
  const line6 = reportData?.purchaseTaxBase || 0;
  const line7 = reportData?.purchaseVat || 0;
  const line8 = Math.max(0, line5 - line7);
  const line9 = Math.max(0, line7 - line5);
  const line10 = reportData?.carryForwardOverpaid || 0;
  const line11 = line8 > 0 ? Math.max(0, line8 - line10) : 0;
  const line12 = line9 > 0 ? line9 + line10 : line10 > line8 ? line10 - line8 : 0;

  const currentYear = today.getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => String(currentYear - 2 + i));

  const displayYear = dateEra === "BE" ? String(Number(year) + 543) : year;
  const monthName = THAI_MONTHS[Number(month) - 1] || "";
  const companyName = selectedCompany?.name || "";
  const companyTaxId = selectedCompany?.taxId || "";
  const companyAddress = selectedCompany?.address || "";
  const companyBranch = selectedCompany?.branch || "";
  const isHeadOffice = !companyBranch || companyBranch === "สำนักงานใหญ่" || companyBranch === "00000";
  const branchDisplay = isHeadOffice ? "สำนักงานใหญ่" : companyBranch;

  const buildReportHtml = useCallback(() => {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>ภ.พ.30</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;600;700&display=swap');
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family: 'Sarabun', 'TH SarabunPSK', sans-serif; font-size:14px; padding:30px 40px; color:#333; }
        .form-title { text-align:center; font-size:22px; font-weight:700; margin-bottom:4px; }
        .form-subtitle { text-align:center; font-size:14px; margin-bottom:20px; color:#666; }
        .company-info { margin-bottom:20px; border:1px solid #ccc; padding:12px 16px; border-radius:4px; }
        .company-info .row { display:flex; margin-bottom:4px; font-size:13px; }
        .company-info .label { min-width:160px; font-weight:600; }
        table { width:100%; border-collapse:collapse; }
        th, td { border:1px solid #ccc; padding:8px 12px; font-size:13px; }
        th { background:#5B9BD5; color:white; text-align:center; font-weight:600; }
        td.num { text-align:right; font-family:'Sarabun',sans-serif; font-variant-numeric:tabular-nums; font-size:14px; }
        td.label-col { }
        td.line-no { text-align:center; width:40px; background:#f5f5f5; font-weight:600; }
        tr.highlight { background:#fffde7; }
        tr.total { background:#e8f5e9; font-weight:700; }
        @media print { body { padding:15px 20px; } @page { size:A4; margin:15mm; } }
      </style>
    </head><body>
      <div class="form-title">แบบ ภ.พ.30</div>
      <div class="form-subtitle">แบบแสดงรายการภาษีมูลค่าเพิ่ม — ประจำเดือน ${monthName} ${displayYear}</div>
      <div class="company-info">
        <div class="row"><span class="label">ชื่อผู้ประกอบการ:</span> <span>${companyName}</span></div>
        <div class="row"><span class="label">เลขประจำตัวผู้เสียภาษี:</span> <span style="letter-spacing:0.05em">${companyTaxId || "-"}</span></div>
        <div class="row"><span class="label">สาขา:</span> <span>${branchDisplay}</span></div>
      </div>
      <table>
        <thead><tr><th colspan="2" style="text-align:center">การคำนวณภาษี</th><th style="width:160px">จำนวนเงิน</th><th style="width:40px">ข้อ</th></tr></thead>
        <tbody>
          <tr><td>1.</td><td class="label-col">รายได้ในเดือนนี้</td><td class="num">${fmt(line1)}</td><td class="line-no">1</td></tr>
          <tr><td>2.</td><td class="label-col">ลบ ยอดขายที่เสียภาษีในอัตราร้อยละ 0</td><td class="num">${fmt(line2)}</td><td class="line-no">2</td></tr>
          <tr><td>3.</td><td class="label-col">ลบ ยอดขายที่ได้รับยกเว้น</td><td class="num">${fmt(line3)}</td><td class="line-no">3</td></tr>
          <tr class="highlight"><td>4.</td><td class="label-col">ยอดขายที่ต้องเสียภาษี</td><td class="num">${fmt(line4)}</td><td class="line-no">4</td></tr>
          <tr><td>5.</td><td class="label-col">ภาษีขายในเดือนนี้</td><td class="num">${fmt(line5)}</td><td class="line-no">5</td></tr>
          <tr><td>6.</td><td class="label-col">ยอดซื้อที่มีสิทธิ์ภาษีซื้อ</td><td class="num">${fmt(line6)}</td><td class="line-no">6</td></tr>
          <tr><td>7.</td><td class="label-col">ภาษีซื้อในเดือนนี้</td><td class="num">${fmt(line7)}</td><td class="line-no">7</td></tr>
          <tr class="highlight"><td>8.</td><td class="label-col">ภาษีที่ต้องชำระ</td><td class="num">${fmt(line8)}</td><td class="line-no">8</td></tr>
          <tr><td>9.</td><td class="label-col">ภาษีที่ชำระเกิน</td><td class="num">${fmt(line9)}</td><td class="line-no">9</td></tr>
          <tr><td>10.</td><td class="label-col">ภาษีที่ชำระเกินยกมา</td><td class="num">${fmt(line10)}</td><td class="line-no">10</td></tr>
          <tr class="highlight"><td>11.</td><td class="label-col">ต้องชำระ</td><td class="num">${fmt(line11)}</td><td class="line-no">11</td></tr>
          <tr class="total"><td>12.</td><td class="label-col">ชำระเกิน</td><td class="num">${fmt(line12)}</td><td class="line-no">12</td></tr>
        </tbody>
      </table>
    </body></html>`;
  }, [line1, line2, line3, line4, line5, line6, line7, line8, line9, line10, line11, line12, companyName, companyTaxId, branchDisplay, monthName, displayYear]);

  function handleExcel() {
    const rows: (string | number)[][] = [
      [`แบบ ภ.พ.30 — ประจำเดือน ${monthName} ${displayYear}`],
      [`ผู้ประกอบการ: ${companyName}`],
      [],
      ["ข้อ", "รายการ", "จำนวนเงิน"],
      ["1", "รายได้ในเดือนนี้", line1],
      ["2", "ลบ ยอดขายที่เสียภาษีในอัตราร้อยละ 0", line2],
      ["3", "ลบ ยอดขายที่ได้รับยกเว้น", line3],
      ["4", "ยอดขายที่ต้องเสียภาษี", line4],
      ["5", "ภาษีขายในเดือนนี้", line5],
      ["6", "ยอดซื้อที่มีสิทธิ์ภาษีซื้อ", line6],
      ["7", "ภาษีซื้อในเดือนนี้", line7],
      ["8", "ภาษีที่ต้องชำระ", line8],
      ["9", "ภาษีที่ชำระเกิน", line9],
      ["10", "ภาษีที่ชำระเกินยกมา", line10],
      ["11", "ต้องชำระ", line11],
      ["12", "ชำระเกิน", line12],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ภ.พ.30");
    XLSX.writeFile(wb, "vat-pp30.xlsx");
  }

  function handlePrint() {
    setShowPreview(true);
  }

  async function handleRdDirect() {
    if (!companyId) return;
    try {
      const params = new URLSearchParams({ companyId: String(companyId), month, year });
      const res = await fetch(`/api/rd-direct/pp30?${params}`, { credentials: "include" });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: "ไม่สามารถส่งออกได้", description: err.message, variant: "destructive" });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const disposition = res.headers.get("content-disposition") || "";
      const match = disposition.match(/filename="(.+)"/);
      a.download = match ? match[1] : `PP30_${year}_${month}.txt`;
      a.href = url;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "ส่งออกสำเร็จ", description: "ไฟล์ ภ.พ.30 (.txt) พร้อมนำเข้า RD Direct" });
    } catch (err: any) {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    }
  }

  function handlePrintFromPreview() {
    const iframe = iframeRef.current;
    if (iframe?.contentWindow) {
      iframe.contentWindow.print();
    }
  }

  const ROW_STYLE = "flex items-center border-b border-gray-100 hover:bg-gray-50/50 min-h-[48px]";
  const LABEL_STYLE = "flex-1 text-sm py-2 px-3";
  const VALUE_STYLE = "w-[160px] text-right font-mono text-sm py-2 px-3 font-semibold";
  const LINE_NO_STYLE = "w-[40px] text-center text-xs text-gray-400 bg-gray-50 py-2 font-bold";
  const HIGHLIGHT_ROW = "flex items-center border-b border-gray-100 hover:bg-yellow-50/50 min-h-[48px] bg-[#fffde7]";

  return (
    <ReportLayout title="ภ.พ.30 สรุปภาษีมูลค่าเพิ่ม" icon={<PieChart className="h-5 w-5" />}>

        <Card className="rounded-xl border shadow-sm bg-white">
          <CardHeader className="p-4 border-b space-y-4 bg-white">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex gap-2 items-center">
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                <Select value={month} onValueChange={setMonth}>
                  <SelectTrigger className="w-36 h-9 bg-white border rounded-lg" data-testid="select-month">
                    <SelectValue placeholder="เลือกเดือน" />
                  </SelectTrigger>
                  <SelectContent>
                    {THAI_MONTHS.map((m, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={year} onValueChange={setYear}>
                  <SelectTrigger className="w-24 h-9 bg-white border rounded-lg" data-testid="select-year">
                    <SelectValue placeholder="ปี" />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map(y => (
                      <SelectItem key={y} value={y}>
                        {dateEra === "BE" ? String(Number(y) + 543) : y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" className="h-8 text-xs border-green-400 text-green-600 hover:bg-green-50" onClick={() => refetch()} disabled={isLoading} data-testid="button-generate">
                  <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} /> สร้างรายงาน
                </Button>
                <Button size="sm" className="h-8 text-xs text-white hover:opacity-90" style={{ background: "var(--theme-table-header-dark)" }} onClick={handlePrint} data-testid="button-print">
                  <Printer className="h-3.5 w-3.5 mr-1.5" /> พิมพ์
                </Button>
                <Button size="sm" className="h-8 gap-1.5 text-xs bg-[#05b187] text-white hover:bg-[#049a75] border-none" onClick={handleExcel} data-testid="button-excel">
                  <FileDown className="h-3.5 w-3.5" /> Excel
                </Button>
                <Button size="sm" className="h-8 gap-1.5 text-xs bg-[#e65100] text-white hover:bg-[#bf4400] border-none" onClick={handleRdDirect} data-testid="button-rd-direct">
                  <Upload className="h-3.5 w-3.5" /> ส่งออก RD Direct
                </Button>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <div className="flex justify-between gap-6 flex-wrap">
                <div className="space-y-1 text-sm leading-relaxed">
                  <div><span className="text-muted-foreground w-40 inline-block">ชื่อผู้ประกอบการ:</span> <span className="font-semibold">{companyName}</span></div>
                  <div><span className="text-muted-foreground w-40 inline-block">เลขประจำตัวผู้เสียภาษี:</span> <span className="font-semibold font-mono">{companyTaxId || "-"}</span></div>
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1">
                      <span className={`inline-block w-4 h-4 border-2 rounded-sm text-center leading-[14px] text-[10px] font-bold ${isHeadOffice ? "bg-foreground text-white border-foreground" : "border-muted-foreground"}`}>
                        {isHeadOffice ? "X" : ""}
                      </span>
                      <span className="text-sm">สำนักงานใหญ่</span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className={`inline-block w-4 h-4 border-2 rounded-sm text-center leading-[14px] text-[10px] font-bold ${!isHeadOffice ? "bg-foreground text-white border-foreground" : "border-muted-foreground"}`}>
                        {!isHeadOffice ? "X" : ""}
                      </span>
                      <span className="text-sm">สาขา</span>
                    </span>
                  </div>
                  <div><span className="text-muted-foreground w-40 inline-block">สาขา:</span> <span className="font-semibold">{branchDisplay}</span></div>
                  <div><span className="text-muted-foreground w-40 inline-block">ที่อยู่:</span> <span className="font-semibold">{companyAddress || "-"}</span></div>
                </div>
                <div className="text-right space-y-1">
                  <div className="text-lg font-bold" style={{ color: "#fb9678" }}>แบบ ภ.พ.30</div>
                  <div className="text-sm text-muted-foreground">ประจำเดือน: <span className="font-semibold text-foreground">{monthName} {displayYear}</span></div>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div>
                <div className="px-4 py-2.5 text-center font-semibold text-white text-sm" style={{ background: "#5B9BD5" }}>
                  การคำนวณภาษี
                </div>

                <div className={ROW_STYLE}>
                  <div className={LABEL_STYLE}>
                    <span className="font-bold text-gray-500 mr-2">1.</span>
                    รายได้ในเดือนนี้
                  </div>
                  <div className={VALUE_STYLE} data-testid="text-line1">{fmt(line1)}</div>
                  <div className={LINE_NO_STYLE}>1</div>
                </div>

                <div className={ROW_STYLE}>
                  <div className={LABEL_STYLE}>
                    <span className="font-bold text-gray-500 mr-2">2.</span>
                    ลบ ยอดขายที่เสียภาษีในอัตราร้อยละ 0
                  </div>
                  <div className="w-[160px] py-1 px-2">
                    <Input
                      type="number"
                      value={line2 || ""}
                      onChange={e => setLine2(Number(e.target.value) || 0)}
                      className="h-8 text-right font-mono text-sm"
                      placeholder="0.00"
                      data-testid="input-line2"
                    />
                  </div>
                  <div className={LINE_NO_STYLE}>2</div>
                </div>

                <div className={ROW_STYLE}>
                  <div className={LABEL_STYLE}>
                    <span className="font-bold text-gray-500 mr-2">3.</span>
                    ลบ ยอดขายที่ได้รับยกเว้น
                  </div>
                  <div className="w-[160px] py-1 px-2">
                    <Input
                      type="number"
                      value={line3 || ""}
                      onChange={e => setLine3(Number(e.target.value) || 0)}
                      className="h-8 text-right font-mono text-sm"
                      placeholder="0.00"
                      data-testid="input-line3"
                    />
                  </div>
                  <div className={LINE_NO_STYLE}>3</div>
                </div>

                <div className={HIGHLIGHT_ROW}>
                  <div className={LABEL_STYLE}>
                    <span className="font-bold text-gray-500 mr-2">4.</span>
                    <span className="font-semibold">ยอดขายที่ต้องเสียภาษี</span>
                  </div>
                  <div className={VALUE_STYLE} data-testid="text-line4">{fmt(line4)}</div>
                  <div className={LINE_NO_STYLE}>4</div>
                </div>

                <div className={ROW_STYLE}>
                  <div className={LABEL_STYLE}>
                    <span className="font-bold text-gray-500 mr-2">5.</span>
                    ภาษีขายในเดือนนี้
                  </div>
                  <div className={VALUE_STYLE} data-testid="text-line5">{fmt(line5)}</div>
                  <div className={LINE_NO_STYLE}>5</div>
                </div>

                <div className={ROW_STYLE}>
                  <div className={LABEL_STYLE}>
                    <span className="font-bold text-gray-500 mr-2">6.</span>
                    ยอดซื้อที่มีสิทธิ์ภาษีซื้อ
                  </div>
                  <div className={VALUE_STYLE} data-testid="text-line6">{fmt(line6)}</div>
                  <div className={LINE_NO_STYLE}>6</div>
                </div>

                <div className={ROW_STYLE}>
                  <div className={LABEL_STYLE}>
                    <span className="font-bold text-gray-500 mr-2">7.</span>
                    ภาษีซื้อในเดือนนี้
                  </div>
                  <div className={VALUE_STYLE} data-testid="text-line7">{fmt(line7)}</div>
                  <div className={LINE_NO_STYLE}>7</div>
                </div>

                <div className={HIGHLIGHT_ROW}>
                  <div className={LABEL_STYLE}>
                    <span className="font-bold text-gray-500 mr-2">8.</span>
                    <span className="font-semibold">ภาษีที่ต้องชำระ</span>
                  </div>
                  <div className={`${VALUE_STYLE} ${line8 > 0 ? "text-red-500" : ""}`} data-testid="text-line8">{fmt(line8)}</div>
                  <div className={LINE_NO_STYLE}>8</div>
                </div>

                <div className={ROW_STYLE}>
                  <div className={LABEL_STYLE}>
                    <span className="font-bold text-gray-500 mr-2">9.</span>
                    ภาษีที่ชำระเกิน
                  </div>
                  <div className={`${VALUE_STYLE} ${line9 > 0 ? "text-green-600" : ""}`} data-testid="text-line9">{fmt(line9)}</div>
                  <div className={LINE_NO_STYLE}>9</div>
                </div>

                <div className={ROW_STYLE}>
                  <div className={LABEL_STYLE}>
                    <span className="font-bold text-gray-500 mr-2">10.</span>
                    ภาษีที่ชำระเกินยกมา
                  </div>
                  <div className={VALUE_STYLE} data-testid="text-line10">{fmt(line10)}</div>
                  <div className={LINE_NO_STYLE}>10</div>
                </div>

                <div className={HIGHLIGHT_ROW}>
                  <div className={LABEL_STYLE}>
                    <span className="font-bold text-gray-500 mr-2">11.</span>
                    <span className="font-semibold">ต้องชำระ</span>
                  </div>
                  <div className={`${VALUE_STYLE} ${line11 > 0 ? "text-red-600 font-bold" : ""}`} data-testid="text-line11">
                    {fmt(line11)}
                  </div>
                  <div className={LINE_NO_STYLE}>11</div>
                </div>

                <div className="flex items-center min-h-[52px] bg-[#e8f5e9] border-t-2 border-green-300">
                  <div className={LABEL_STYLE}>
                    <span className="font-bold text-gray-500 mr-2">12.</span>
                    <span className="font-bold text-base">ชำระเกิน</span>
                  </div>
                  <div className={`w-[160px] text-right font-mono text-base py-2 px-3 font-bold ${line12 > 0 ? "text-green-700" : ""}`} data-testid="text-line12">
                    {fmt(line12)}
                  </div>
                  <div className={`${LINE_NO_STYLE} font-bold`}>12</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

      {showPreview && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-sm">ตัวอย่าง ภ.พ.30</h3>
              <div className="flex gap-2">
                <Button size="sm" className="h-8 text-xs text-white" style={{ background: "var(--theme-table-header-dark)" }} onClick={handlePrintFromPreview} data-testid="button-print-preview">
                  <Printer className="h-3.5 w-3.5 mr-1.5" /> พิมพ์
                </Button>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setShowPreview(false)} data-testid="button-close-preview">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-2">
              <iframe
                ref={iframeRef}
                srcDoc={buildReportHtml()}
                className="w-full border rounded"
                style={{ height: "600px" }}
                title="ภ.พ.30 Preview"
              />
            </div>
          </div>
        </div>
      )}
    </ReportLayout>
  );
}
