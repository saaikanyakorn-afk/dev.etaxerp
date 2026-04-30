import { useState, useRef, useCallback, useMemo } from "react";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PieChart, Printer, FileDown, Calendar as CalendarIcon, Loader2, Eye, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { useDocDropdowns } from "@/hooks/use-doc-dropdowns";
import { formatDate } from "@/lib/format";

import { useDateSettings } from "@/hooks/use-date-settings";
import ThaiDateInput from "@/components/thai-date-input";

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

function fmt(val: number): string {
  if (val === 0) return "0.00";
  return val.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getLastDayOfMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}

export default function SalesTaxReport() {
  const { selectedCompany } = useCompany();
  const { branchList } = useDocDropdowns();
  const companyId = selectedCompany?.id;
  const today = new Date();
  const [month, setMonth] = useState(String(today.getMonth() + 1));
  const [year, setYear] = useState(String(today.getFullYear()));
  const [sortBy, setSortBy] = useState("date");
  const [sellerBranch, setSellerBranch] = useState("");
  const [filterPrefix, setFilterPrefix] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [filterMode, setFilterMode] = useState<"month" | "range">("month");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));

  const { dateEra, dateFmt } = useDateSettings();
  const { data: docSettings } = useQuery<any>({
    queryKey: ["/api/document-settings", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const res = await fetch(`/api/document-settings?companyId=${companyId}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!companyId,
  });
  const { data: reportData, isLoading } = useQuery<any>({
    queryKey: ["/api/reports/sales-tax", companyId, month, year, sortBy, filterMode, startDate, endDate, sellerBranch],
    queryFn: async () => {
      if (!companyId) return null;
      const params = new URLSearchParams({ companyId: String(companyId), sortBy });
      if (filterMode === "range") {
        params.set("startDate", startDate);
        params.set("endDate", endDate);
      } else {
        params.set("month", month);
        params.set("year", year);
      }
      if (sellerBranch === "__hq__") {
        params.set("sellerBranch", "00000");
      } else if (sellerBranch) {
        params.set("sellerBranch", sellerBranch);
      }
      const res = await fetch(`/api/reports/sales-tax?${params}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!companyId,
  });

  const rawRows: any[] = reportData?.rows || [];

  const prefixList = useMemo(() => {
    const set = new Set<string>();
    rawRows.forEach((r: any) => {
      const ref = r.taxInvoiceNo || "";
      const m = ref.match(/^([A-Za-z]+)/);
      if (m) set.add(m[1]);
    });
    return [...set].sort();
  }, [rawRows]);

  const rows = useMemo(() => {
    if (!filterPrefix) return rawRows;
    return rawRows.filter((r: any) => {
      const ref = r.taxInvoiceNo || "";
      return ref.startsWith(filterPrefix);
    });
  }, [rawRows, filterPrefix]);

  const totalSubtotal = useMemo(() => rows.reduce((s: number, r: any) => s + (r.subtotal || 0), 0), [rows]);
  const totalVat = useMemo(() => rows.reduce((s: number, r: any) => s + (r.vatAmount || 0), 0), [rows]);
  const totalAmount = useMemo(() => totalSubtotal + totalVat, [totalSubtotal, totalVat]);

  const currentYear = today.getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => String(currentYear - 2 + i));

  const displayYear = dateEra === "BE" ? String(Number(year) + 543) : year;
  const monthName = THAI_MONTHS[Number(month) - 1] || "";
  const isHqFilter = sellerBranch === "__hq__";
  const selectedBranchObj = (sellerBranch && !isHqFilter) ? branchList.find(b => b.code === sellerBranch) : null;
  const companyName = selectedCompany?.name || "";
  const companyTaxId = selectedCompany?.taxId || "";
  const effectiveBranchName = selectedBranchObj ? `${selectedBranchObj.code} - ${selectedBranchObj.name}` : companyName;
  const effectiveAddress = selectedBranchObj?.address || selectedCompany?.address || "";
  const effectiveBranchCode = selectedBranchObj ? selectedBranchObj.code : (selectedCompany?.branch || "");
  const isHeadOffice = isHqFilter || !selectedBranchObj && (!effectiveBranchCode || effectiveBranchCode === "สำนักงานใหญ่" || effectiveBranchCode === "00000");
  const branchDisplay = isHeadOffice ? "00000" : effectiveBranchCode;

  const numMonth = Number(month);
  const numYear = Number(year);
  const lastDay = getLastDayOfMonth(numYear, numMonth);
  const dateRangeStr = `${String(1).padStart(2, "0")}/${String(numMonth).padStart(2, "0")}/${displayYear} - ${String(lastDay).padStart(2, "0")}/${String(numMonth).padStart(2, "0")}/${displayYear}`;
  const monthYearStr = `${numMonth}/${displayYear}`;

  function handleExcel() {
    if (rows.length === 0) return;
    const themeColor = getComputedStyle(document.documentElement).getPropertyValue('--theme-table-header').trim() || '#fb9678';
    const colCount = 10;
    const theadHtml = `<tr style="background:${themeColor};color:white;font-weight:bold;font-size:12pt;text-align:center">
      <td style="border:1px solid ${themeColor};padding:4px 6px">#</td>
      <td style="border:1px solid ${themeColor};padding:4px 6px">วัน เดือน ปี</td>
      <td style="border:1px solid ${themeColor};padding:4px 6px">เลขที่ใบกำกับภาษี</td>
      <td style="border:1px solid ${themeColor};padding:4px 6px">ชื่อผู้ซื้อสินค้า/ผู้รับบริการ</td>
      <td style="border:1px solid ${themeColor};padding:4px 6px">เลขประจำตัวผู้เสียภาษีอากร</td>
      <td style="border:1px solid ${themeColor};padding:4px 6px">สาขา</td>
      <td style="border:1px solid ${themeColor};padding:4px 6px">มูลค่าสินค้าหรือบริการ</td>
      <td style="border:1px solid ${themeColor};padding:4px 6px">มูลค่าสินค้าที่เสียภาษี</td>
      <td style="border:1px solid ${themeColor};padding:4px 6px">จำนวนเงินภาษีมูลค่าเพิ่ม</td>
      <td style="border:1px solid ${themeColor};padding:4px 6px">จำนวนเงินรวมทั้งสิ้น</td>
    </tr>`;
    const dataRows = rows.map((r: any) => {
      const cnStyle = r.isCreditNote ? "background:#fff5f5;color:#dc2626;font-weight:600" : "";
      const numStyle = r.isCreditNote ? "border:1px solid #ccc;padding:3px 6px;text-align:right;color:#dc2626;font-weight:600" : "border:1px solid #ccc;padding:3px 6px;text-align:right";
      return `<tr style="${cnStyle}">
      <td style="border:1px solid #ccc;padding:3px 6px;text-align:center">${r.no}</td>
      <td style="border:1px solid #ccc;padding:3px 6px">${formatDate(r.date, dateEra, dateFmt)}</td>
      <td style="border:1px solid #ccc;padding:3px 6px">${r.taxInvoiceNo}${r.isDebitNote ? " (เพิ่มหนี้)" : ""}</td>
      <td style="border:1px solid #ccc;padding:3px 6px">${r.customerName}</td>
      <td style="border:1px solid #ccc;padding:3px 6px">${r.customerTaxId ? "'" + r.customerTaxId : ""}</td>
      <td style="border:1px solid #ccc;padding:3px 6px;text-align:center">${r.branch ? "'" + r.branch : ""}</td>
      <td style="${numStyle}">${fmt(r.subtotal)}</td>
      <td style="${numStyle}">${fmt(r.subtotal)}</td>
      <td style="${numStyle}">${fmt(r.vatAmount)}</td>
      <td style="${numStyle}">${fmt(r.subtotal + r.vatAmount)}</td>
    </tr>`;
    }).join("");
    const totalRow = `<tr style="font-weight:bold;background:#f1f5f9">
      <td colspan="6" style="border:1px solid #ccc;padding:4px 8px;text-align:right;border-top:2px solid #333">รวมทั้งสิ้น</td>
      <td style="border:1px solid #ccc;padding:4px 8px;text-align:right;border-top:2px solid #333">${fmt(totalSubtotal)}</td>
      <td style="border:1px solid #ccc;padding:4px 8px;text-align:right;border-top:2px solid #333">${fmt(totalSubtotal)}</td>
      <td style="border:1px solid #ccc;padding:4px 8px;text-align:right;border-top:2px solid #333">${fmt(totalVat)}</td>
      <td style="border:1px solid #ccc;padding:4px 8px;text-align:right;border-top:2px solid #333">${fmt(totalAmount)}</td>
    </tr>`;
    const excelHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8">
      <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
      <x:Name>รายงานภาษีขาย</x:Name>
      <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
      </x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
      </head><body>
      <table style="font-family:'TH SarabunPSK','Sarabun',sans-serif;font-size:14pt;border-collapse:collapse">
        <tr><td colspan="${colCount}" style="font-size:20pt;font-weight:bold;padding:4px">รายงานภาษีขาย</td></tr>
        <tr><td colspan="${colCount}" style="padding:2px"></td></tr>
        <tr><td colspan="${colCount}" style="padding:2px 4px">องค์กร: ${companyName}</td></tr>
        <tr><td colspan="${colCount}" style="padding:2px 4px">สาขาประกอบการ: ${branchDisplay}</td></tr>
        <tr><td colspan="${colCount}" style="padding:2px 4px">ที่อยู่: ${effectiveAddress}</td></tr>
        <tr><td colspan="${colCount}" style="padding:2px 4px">เลขตัวผู้เสียภาษี: ${companyTaxId || "-"}</td></tr>
        <tr><td colspan="${colCount}" style="padding:2px 4px;font-weight:bold">ช่วงเวลา: ${dateRangeStr}</td></tr>
        <tr><td colspan="${colCount}" style="padding:2px"></td></tr>
        ${theadHtml}
        ${dataRows}
        ${totalRow}
      </table>
      </body></html>`;
    const blob = new Blob([excelHtml], { type: "application/vnd.ms-excel;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `รายงานภาษีขาย_${companyName}_${monthName}_${displayYear}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const buildReportHtml = useCallback(() => {
    const themeColor = getComputedStyle(document.documentElement).getPropertyValue('--theme-table-header').trim() || '#fb9678';
    const ROWS_PER_PAGE = 20;
    const totalPages = Math.max(1, Math.ceil(rows.length / ROWS_PER_PAGE));

    const headerHtml = `
      <div class="report-header">
        <div class="header-left">
          <div><span class="label">ชื่อผู้ประกอบการ:</span> <span class="value">${companyName}</span></div>
          <div><span class="label">ชื่อสถานประกอบการ:</span> <span class="value">${effectiveBranchName}</span></div>
          <div>
            <span class="branch-check"><span class="box ${isHeadOffice ? "checked" : ""}">${isHeadOffice ? "X" : ""}</span> สำนักงานใหญ่</span>
            <span class="branch-check"><span class="box ${!isHeadOffice ? "checked" : ""}">${!isHeadOffice ? "X" : ""}</span> สาขา</span>
          </div>
          <div><span class="label">สาขาผู้ประกอบการ:</span> <span class="value">${branchDisplay}</span></div>
          <div><span class="label">ที่ตั้งสถานประกอบการ:</span> <span class="value">${effectiveAddress}</span></div>
        </div>
        <div class="header-right">
          <div class="title">รายงานภาษีขาย</div>
          <div class="info">
            <div>เดือนภาษี: ${monthYearStr}</div>
            <div>วันที่: ${dateRangeStr}</div>
            <div>เลขประจำตัวผู้เสียภาษี: ${companyTaxId || "-"}</div>
          </div>
        </div>
      </div>`;

    const theadHtml = `<thead><tr>
      <th style="width:28px">#</th>
      <th style="width:90px;white-space:nowrap">ใบกำกับภาษี<br/>วัน เดือน ปี</th>
      <th style="width:110px">ใบกำกับภาษี<br/>เลขที่</th>
      <th>ชื่อผู้ซื้อสินค้า/ผู้รับบริการ</th>
      <th style="width:100px">เลขประจำตัว<br/>ผู้เสียภาษีอากร</th>
      <th style="width:70px">สาขา</th>
      <th style="width:85px;text-align:right">มูลค่าสินค้า<br/>หรือบริการ</th>
      <th style="width:85px;text-align:right">มูลค่าสินค้า<br/>ที่เสียภาษี</th>
      <th style="width:80px;text-align:right">จำนวนเงิน<br/>ภาษีมูลค่าเพิ่ม</th>
      <th style="width:80px;text-align:right">จำนวนเงิน<br/>รวมทั้งสิ้น</th>
    </tr></thead>`;

    let pagesHtml = "";
    let runningSubtotal = 0;
    let runningVat = 0;
    let runningTotal = 0;

    for (let page = 0; page < totalPages; page++) {
      const pageRows = rows.slice(page * ROWS_PER_PAGE, (page + 1) * ROWS_PER_PAGE);
      const isLastPage = page === totalPages - 1;

      let pageSubtotal = 0;
      let pageVat = 0;
      let pageTotal = 0;
      const dataRows = pageRows.map((r: any) => {
        pageSubtotal += r.subtotal || 0;
        pageVat += r.vatAmount || 0;
        pageTotal += (r.subtotal || 0) + (r.vatAmount || 0);
        const rowBg = r.isCreditNote ? "background:#fff5f5" : "";
        const numColor = r.isCreditNote ? "color:#dc2626;font-weight:600" : "";
        return `<tr style="${rowBg}">
          <td style="text-align:center;border:1px solid #ccc;padding:2px 4px;font-size:11px">${r.no}</td>
          <td style="border:1px solid #ccc;padding:2px 4px;font-size:11px;white-space:nowrap">${formatDate(r.date, dateEra, dateFmt)}</td>
          <td style="border:1px solid #ccc;padding:2px 4px;font-size:11px">${r.taxInvoiceNo}${r.isDebitNote ? ' <span style="color:#d97706;font-size:9px">(เพิ่มหนี้)</span>' : ""}</td>
          <td style="border:1px solid #ccc;padding:2px 4px;font-size:11px">${r.customerName}</td>
          <td style="border:1px solid #ccc;padding:2px 4px;font-size:11px">${r.customerTaxId || ""}</td>
          <td style="border:1px solid #ccc;padding:2px 4px;font-size:11px;text-align:center">${r.branch || ""}</td>
          <td style="text-align:right;border:1px solid #ccc;padding:2px 4px;font-size:11px;${numColor}">${fmt(r.subtotal)}</td>
          <td style="text-align:right;border:1px solid #ccc;padding:2px 4px;font-size:11px;${numColor}">${fmt(r.subtotal)}</td>
          <td style="text-align:right;border:1px solid #ccc;padding:2px 4px;font-size:11px;${numColor}">${fmt(r.vatAmount)}</td>
          <td style="text-align:right;border:1px solid #ccc;padding:2px 4px;font-size:11px;${numColor}">${fmt(r.subtotal + r.vatAmount)}</td>
        </tr>`;
      }).join("");

      runningSubtotal += pageSubtotal;
      runningVat += pageVat;
      runningTotal += pageTotal;

      let summaryRows = "";
      if (totalPages > 1) {
        summaryRows += `<tr class="page-total-row">
          <td colspan="6" style="text-align:right;border:1px solid #ccc;padding:2px 6px;font-size:11px;font-weight:600">รวมหน้านี้</td>
          <td style="text-align:right;border:1px solid #ccc;padding:2px 6px;font-size:11px;font-weight:600">${fmt(pageSubtotal)}</td>
          <td style="text-align:right;border:1px solid #ccc;padding:2px 6px;font-size:11px;font-weight:600">${fmt(pageSubtotal)}</td>
          <td style="text-align:right;border:1px solid #ccc;padding:2px 6px;font-size:11px;font-weight:600">${fmt(pageVat)}</td>
          <td style="text-align:right;border:1px solid #ccc;padding:2px 6px;font-size:11px;font-weight:600">${fmt(pageTotal)}</td>
        </tr>`;

        if (!isLastPage) {
          summaryRows += `<tr class="carry-row">
            <td colspan="6" style="text-align:right;border:1px solid #ccc;padding:2px 6px;font-size:11px;font-weight:600">ยอดยกไป</td>
            <td style="text-align:right;border:1px solid #ccc;padding:2px 6px;font-size:11px;font-weight:600">${fmt(runningSubtotal)}</td>
            <td style="text-align:right;border:1px solid #ccc;padding:2px 6px;font-size:11px;font-weight:600">${fmt(runningSubtotal)}</td>
            <td style="text-align:right;border:1px solid #ccc;padding:2px 6px;font-size:11px;font-weight:600">${fmt(runningVat)}</td>
            <td style="text-align:right;border:1px solid #ccc;padding:2px 6px;font-size:11px;font-weight:600">${fmt(runningTotal)}</td>
          </tr>`;
        }
      }

      if (isLastPage) {
        summaryRows += `<tr class="total-row">
          <td colspan="6" style="text-align:right;border:1px solid #ccc;padding:4px 8px;font-size:12px;font-weight:700">รวมทั้งสิ้น</td>
          <td style="text-align:right;border:1px solid #ccc;padding:4px 8px;font-size:12px;font-weight:700">${fmt(totalSubtotal)}</td>
          <td style="text-align:right;border:1px solid #ccc;padding:4px 8px;font-size:12px;font-weight:700">${fmt(totalSubtotal)}</td>
          <td style="text-align:right;border:1px solid #ccc;padding:4px 8px;font-size:12px;font-weight:700">${fmt(totalVat)}</td>
          <td style="text-align:right;border:1px solid #ccc;padding:4px 8px;font-size:12px;font-weight:700">${fmt(totalAmount)}</td>
        </tr>`;
      }

      const pageNumHtml = totalPages > 1 ? `<div class="page-number">หน้า ${page + 1} / ${totalPages}</div>` : "";

      pagesHtml += `
        <div class="page${!isLastPage ? " page-break" : ""}">
          ${headerHtml}
          ${pageNumHtml}
          <table>
            ${theadHtml}
            <tbody>
              ${dataRows}
              ${summaryRows}
            </tbody>
          </table>
        </div>`;
    }

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>รายงานภาษีขาย</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;600;700&display=swap');
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family: 'Sarabun', 'TH SarabunPSK', sans-serif; font-size:11px; padding:0; color:#333; }
        .page { width:277mm; min-height:190mm; padding:6mm 8mm; position:relative; }
        .report-header { display:flex; justify-content:space-between; margin-bottom:2px; }
        .header-left { font-size:11px; line-height:1.5; }
        .header-left .label { display:inline-block; min-width:130px; font-weight:400; }
        .header-left .value { font-weight:600; }
        .header-right { text-align:right; }
        .header-right .title { font-size:16px; font-weight:700; margin-bottom:2px; }
        .header-right .info { font-size:10px; line-height:1.5; }
        .branch-check { display:inline-flex; align-items:center; gap:3px; margin-right:10px; }
        .branch-check .box { display:inline-block; width:12px; height:12px; border:1.5px solid #333; text-align:center; line-height:12px; font-size:10px; font-weight:700; }
        .branch-check .box.checked { background:#333; color:white; }
        .page-number { text-align:right; font-size:9px; color:#666; margin-bottom:1px; }
        table { width:100%; border-collapse:collapse; margin-top:1px; }
        th { background:${themeColor}; color:white; font-weight:600; padding:3px 4px; font-size:9px; border:1px solid ${themeColor}; text-align:center; white-space:nowrap; }
        td { font-size:10px; }
        .page-total-row td { font-weight:600; background:#eef3f8; }
        .carry-row td { font-weight:600; background:#e8f0fe; font-style:italic; }
        .total-row td { font-weight:700; background:#f1f5f9; border-top:2px solid #333; }
        .page-break { border-bottom:2px dashed #ccc; margin-bottom:12px; }
        @media print {
          body { padding:0; margin:0; }
          @page { size: A4 landscape; margin:8mm; }
          .page { width:100%; min-height:auto; padding:2mm 0; page-break-after:always; page-break-inside:avoid; }
          .page:last-child { page-break-after:auto; }
          .page-break { border-bottom:none; margin-bottom:0; }
          table { font-size:9px; }
          td { padding:2px 3px !important; font-size:9px !important; }
          th { padding:2px 3px !important; font-size:8px !important; }
        }
      </style>
    </head><body>
      ${pagesHtml}
    </body></html>`;
  }, [rows, dateEra, dateFmt, companyName, companyTaxId, effectiveAddress, effectiveBranchName, isHeadOffice, branchDisplay, monthYearStr, dateRangeStr, totalSubtotal, totalVat, totalAmount]);

  function handlePreview() {
    if (rows.length === 0) return;
    setShowPreview(true);
  }

  function handlePrintFromPreview() {
    const pdfTitle = `รายงานภาษีขาย_${companyName}_${monthName}_${displayYear}`;
    const html = buildReportHtml().replace(/<title>[^<]*<\/title>/, `<title>${pdfTitle}</title>`);
    const printWindow = window.open("", "_blank", "width=1100,height=700");
    if (!printWindow) return;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      setTimeout(() => { printWindow.print(); }, 400);
    };
  }

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <PieChart className="h-4 w-4" />
          <h1 className="text-xl font-heading font-medium text-foreground" data-testid="text-page-title">รายงานภาษีขาย</h1>
          <span className="text-xs">รายงาน</span>
        </div>

        <Card className="rounded-xl border shadow-sm bg-white">
          <CardHeader className="p-4 border-b space-y-4 bg-white">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex gap-2 items-center flex-wrap">
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                <div className="flex h-9 rounded-lg border bg-muted p-0.5" data-testid="filter-mode-toggle">
                  <button
                    className={`px-3 text-xs rounded-md transition-colors ${filterMode === "month" ? "bg-white shadow-sm font-semibold" : "text-muted-foreground hover:text-foreground"}`}
                    onClick={() => setFilterMode("month")}
                    data-testid="btn-filter-month"
                  >รายเดือน</button>
                  <button
                    className={`px-3 text-xs rounded-md transition-colors ${filterMode === "range" ? "bg-white shadow-sm font-semibold" : "text-muted-foreground hover:text-foreground"}`}
                    onClick={() => setFilterMode("range")}
                    data-testid="btn-filter-range"
                  >ช่วงเวลา</button>
                </div>
                {filterMode === "month" ? (
                  <>
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
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">จาก</span>
                      <ThaiDateInput value={startDate} onChange={setStartDate} dateEra={dateEra} dateFmt={dateFmt} className="h-9 w-[160px]" data-testid="input-start-date" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">ถึง</span>
                      <ThaiDateInput value={endDate} onChange={setEndDate} dateEra={dateEra} dateFmt={dateFmt} className="h-9 w-[160px]" data-testid="input-end-date" />
                    </div>
                  </>
                )}
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="h-8 text-xs text-white hover:opacity-90" style={{ background: "var(--theme-primary)" }} onClick={handlePreview} disabled={rows.length === 0} data-testid="button-preview-pdf">
                  <Eye className="h-3.5 w-3.5 mr-1.5" /> PDF
                </Button>
                <Button size="sm" className="h-8 text-xs text-white hover:opacity-90" style={{ background: "#03c9d7" }} onClick={handleExcel} disabled={rows.length === 0} data-testid="button-excel">
                  <FileDown className="h-3.5 w-3.5 mr-1.5" /> Excel
                </Button>
              </div>
            </div>

            <div className="flex items-center flex-wrap gap-1.5 text-xs">
              <span className="text-muted-foreground text-[11px]">กรอง:</span>
              <select data-testid="select-seller-branch-filter" value={sellerBranch} onChange={e => setSellerBranch(e.target.value)} className="h-7 px-1.5 border rounded text-[11px] bg-white">
                <option value="">สาขา: รวม</option>
                <option value="__hq__">สำนักงานใหญ่</option>
                {branchList.map(b => <option key={b.id} value={b.code}>{b.code} - {b.name}</option>)}
              </select>
              <Select value={filterPrefix || "__all__"} onValueChange={(v) => setFilterPrefix(v === "__all__" ? "" : v)}>
                <SelectTrigger className="w-32 h-7 bg-white border rounded text-[11px]" data-testid="select-filter-prefix">
                  <SelectValue placeholder="Prefix: ทั้งหมด" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Prefix: ทั้งหมด</SelectItem>
                  {prefixList.map(p => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-muted-foreground text-[11px] ml-1">เรียง:</span>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-36 h-7 bg-white border rounded text-[11px]" data-testid="select-sort">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">ตามวันที่</SelectItem>
                  <SelectItem value="number">ตามเลขที่เอกสาร</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <div className="flex justify-between gap-6">
                <div className="space-y-1 text-sm leading-relaxed min-w-0 flex-1">
                  <div><span className="text-muted-foreground w-36 inline-block">ชื่อผู้ประกอบการ:</span> <span className="font-semibold">{companyName}</span></div>
                  <div><span className="text-muted-foreground w-36 inline-block">ชื่อสถานประกอบการ:</span> <span className="font-semibold">{effectiveBranchName}</span></div>
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
                  <div><span className="text-muted-foreground w-36 inline-block">สาขาผู้ประกอบการ:</span> <span className="font-semibold">{branchDisplay}</span></div>
                  <div><span className="text-muted-foreground w-36 inline-block">ที่ตั้งสถานประกอบการ:</span> <span className="font-semibold">{effectiveAddress || "-"}</span></div>
                </div>
                <div className="text-right space-y-1 flex-shrink-0">
                  <div className="text-lg font-bold" style={{ color: "var(--theme-table-header)" }}>รายงานภาษีขาย</div>
                  <div className="text-sm text-muted-foreground">เดือนภาษี: <span className="font-semibold text-foreground">{monthYearStr}</span></div>
                  <div className="text-sm text-muted-foreground">วันที่: <span className="font-semibold text-foreground">{dateRangeStr}</span></div>
                  <div className="text-sm text-muted-foreground">เลขประจำตัวผู้เสียภาษี: <span className="font-semibold text-foreground font-mono">{companyTaxId || "-"}</span></div>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="w-full overflow-x-auto">
              <Table>
                <TableHeader className="border-b" style={{ background: "var(--theme-table-header)" }}>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-10 text-center text-white text-[10px] font-semibold p-2">#</TableHead>
                    <TableHead className="w-[90px] min-w-[90px] text-white text-[10px] font-semibold text-center p-2">ใบกำกับภาษี<br/>วัน เดือน ปี</TableHead>
                    <TableHead className="text-white text-[10px] font-semibold text-center border-l border-white/30 p-2">ใบกำกับภาษี<br/>เลขที่</TableHead>
                    <TableHead className="text-white text-[10px] font-semibold text-center border-l border-white/30 p-2">ชื่อผู้ซื้อสินค้า/ผู้รับบริการ</TableHead>
                    <TableHead className="w-28 text-white text-[10px] font-semibold text-center border-l border-white/30 p-2">เลขประจำตัว<br/>ผู้เสียภาษีอากร</TableHead>
                    <TableHead className="w-20 text-white text-[10px] font-semibold text-center border-l border-white/30 p-2">สาขา</TableHead>
                    <TableHead className="w-28 text-right text-white text-[10px] font-semibold border-l border-white/30 p-2">มูลค่าสินค้า<br/>หรือบริการ</TableHead>
                    <TableHead className="w-28 text-right text-white text-[10px] font-semibold border-l border-white/30 p-2">มูลค่าสินค้า<br/>ที่เสียภาษี</TableHead>
                    <TableHead className="w-24 text-right text-white text-[10px] font-semibold border-l border-white/30 p-2">จำนวนเงิน<br/>ภาษีมูลค่าเพิ่ม</TableHead>
                    <TableHead className="w-24 text-right text-white text-[10px] font-semibold border-l border-white/30 p-2">จำนวนเงิน<br/>รวมทั้งสิ้น</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={10} className="h-24 text-center">
                        <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ) : rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="h-24 text-center text-muted-foreground text-sm bg-white">
                        ไม่มีข้อมูล
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row: any, idx: number) => (
                      <TableRow key={idx} className={`text-sm ${row.isCreditNote ? "bg-rose-50/50 hover:bg-rose-50" : "hover:bg-slate-50/50"}`} data-testid={`row-tax-${idx}`}>
                        <TableCell className="text-center text-xs text-muted-foreground">{row.no}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap min-w-[90px]">{formatDate(row.date, dateEra, dateFmt)}</TableCell>
                        <TableCell className="text-xs font-medium">
                          {row.taxInvoiceNo}
                          {row.isDebitNote && <span className="ml-1 text-[10px] text-amber-600 font-medium">(เพิ่มหนี้)</span>}
                        </TableCell>
                        <TableCell className="text-xs">{row.customerName}</TableCell>
                        <TableCell className="text-xs font-mono text-center">{row.customerTaxId}</TableCell>
                        <TableCell className="text-xs text-center">{row.branch}</TableCell>
                        <TableCell className={`text-right text-xs font-mono ${row.isCreditNote ? "text-rose-600 font-semibold" : ""}`}>{fmt(row.subtotal)}</TableCell>
                        <TableCell className={`text-right text-xs font-mono ${row.isCreditNote ? "text-rose-600 font-semibold" : ""}`}>{fmt(row.subtotal)}</TableCell>
                        <TableCell className={`text-right text-xs font-mono ${row.isCreditNote ? "text-rose-600 font-semibold" : ""}`}>{fmt(row.vatAmount)}</TableCell>
                        <TableCell className={`text-right text-xs font-mono ${row.isCreditNote ? "text-rose-600 font-semibold" : ""}`}>{fmt(row.subtotal + row.vatAmount)}</TableCell>
                      </TableRow>
                    ))
                  )}
                  <TableRow className="bg-slate-50 font-semibold border-t-2">
                    <TableCell colSpan={6} className="text-right py-3 text-sm">รวมทั้งสิ้น</TableCell>
                    <TableCell className="text-right py-3 text-sm font-mono">{fmt(totalSubtotal)}</TableCell>
                    <TableCell className="text-right py-3 text-sm font-mono">{fmt(totalSubtotal)}</TableCell>
                    <TableCell className="text-right py-3 text-sm font-mono">{fmt(totalVat)}</TableCell>
                    <TableCell className="text-right py-3 text-sm font-mono">{fmt(totalAmount)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {showPreview && (
        <div className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-4" data-testid="pdf-preview-modal">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-3 border-b bg-slate-50">
              <div className="flex items-center gap-3">
                <Eye className="h-5 w-5" style={{ color: "var(--theme-primary)" }} />
                <span className="font-semibold text-sm">พรีวิวรายงานภาษีขาย — {monthName} {displayYear}</span>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" className="h-8 text-xs text-white hover:opacity-90" style={{ background: "var(--theme-primary)" }} onClick={handlePrintFromPreview} data-testid="button-print">
                  <Printer className="h-3.5 w-3.5 mr-1.5" /> พิมพ์ / บันทึก PDF
                </Button>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setShowPreview(false)} data-testid="button-close-preview">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex-1 bg-gray-200 p-4 overflow-auto">
              <div className="bg-white shadow-lg mx-auto" style={{ maxWidth: "1100px", minHeight: "100%" }}>
                <iframe
                  ref={iframeRef}
                  srcDoc={buildReportHtml()}
                  className="w-full h-full border-0"
                  style={{ minHeight: "calc(90vh - 120px)" }}
                  title="PDF Preview"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
