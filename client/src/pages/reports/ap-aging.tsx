import { useState } from "react";
import ReportLayout from "@/components/report-layout";
import { Button } from "@/components/ui/button";
import ThaiDateInput from "@/components/thai-date-input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { FileSpreadsheet, Printer, Download, FileDown, ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import * as XLSX from "xlsx";
import { formatDate } from "@/lib/format";
import { toLocalDateStr } from "@/lib/utils";

import { useDateSettings } from "@/hooks/use-date-settings";
function fmt(val: number | null | undefined): string {
  const n = val || 0;
  if (n === 0) return "-";
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface APDocument {
  id: number;
  docNo: string;
  docDate: string;
  docType: string;
  totalAmount: string;
  daysOutstanding: number;
}

interface APVendor {
  vendorName: string;
  current: number;
  days31_60: number;
  days61_90: number;
  days91_120: number;
  over120: number;
  total: number;
  documents: APDocument[];
}

interface APAgingData {
  asOfDate: string;
  vendors: APVendor[];
  totals: {
    current: number;
    days31_60: number;
    days61_90: number;
    days91_120: number;
    over120: number;
    total: number;
  };
}

export default function APAgingReport() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const today = toLocalDateStr(new Date());
  const [asOfDate, setAsOfDate] = useState(today);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const { dateEra, dateFmt } = useDateSettings();
  const { data: docSettings } = useQuery<any>({
    queryKey: ["/api/document-settings", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const res = await fetch(`/api/document-settings/${companyId}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!companyId,
  });
  const { data, isLoading, refetch } = useQuery<APAgingData>({
    queryKey: ["/api/reports/ap-aging", companyId, asOfDate],
    queryFn: async () => {
      const res = await fetch(
        `/api/reports/ap-aging?companyId=${companyId}&asOfDate=${asOfDate}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to fetch AP aging report");
      return res.json();
    },
    enabled: !!companyId && !!asOfDate,
  });

  const vendors = data?.vendors || [];
  const totals = data?.totals;

  const toggleExpand = (name: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCsvExport = () => {
    if (vendors.length === 0) return;
    const esc = (v: string | number | null | undefined) => { const s = String(v ?? ""); return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s; };
    const header = ["ผู้จำหน่าย/เจ้าหนี้", "เลขที่เอกสาร", "ประเภท", "วันที่เอกสาร", "จำนวนวันค้าง", "ปัจจุบัน (0-30)", "31-60 วัน", "61-90 วัน", "91-120 วัน", "เกิน 120 วัน", "รวม"];
    const rows: string[][] = [];
    for (const v of vendors) {
      rows.push([
        esc(v.vendorName), "", "", "", "",
        v.current.toFixed(2), v.days31_60.toFixed(2), v.days61_90.toFixed(2),
        v.days91_120.toFixed(2), v.over120.toFixed(2), v.total.toFixed(2),
      ]);
      for (const doc of v.documents) {
        const amt = parseFloat(doc.totalAmount) || 0;
        const typeLabel = doc.docType === "purchase_invoice" ? "ใบแจ้งหนี้ซื้อ" : doc.docType === "expense" ? "ค่าใช้จ่าย" : doc.docType;
        const bucket = doc.daysOutstanding <= 30 ? [amt.toFixed(2), "", "", "", ""]
          : doc.daysOutstanding <= 60 ? ["", amt.toFixed(2), "", "", ""]
          : doc.daysOutstanding <= 90 ? ["", "", amt.toFixed(2), "", ""]
          : doc.daysOutstanding <= 120 ? ["", "", "", amt.toFixed(2), ""]
          : ["", "", "", "", amt.toFixed(2)];
        rows.push([
          "", esc(doc.docNo), esc(typeLabel), esc(doc.docDate), String(doc.daysOutstanding),
          ...bucket, amt.toFixed(2),
        ]);
      }
    }
    if (totals) {
      rows.push([
        "รวมทั้งสิ้น", "", "", "", "",
        totals.current.toFixed(2), totals.days31_60.toFixed(2), totals.days61_90.toFixed(2),
        totals.days91_120.toFixed(2), totals.over120.toFixed(2), totals.total.toFixed(2),
      ]);
    }
    const bom = "\uFEFF";
    const csv = bom + [header.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `รายงานเจ้าหนี้คงค้าง-${asOfDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExcel = () => {
    if (vendors.length === 0) return;
    const header = ["ผู้จำหน่าย/เจ้าหนี้", "เลขที่เอกสาร", "ประเภท", "วันที่เอกสาร", "จำนวนวันค้าง", "ปัจจุบัน (0-30)", "31-60 วัน", "61-90 วัน", "91-120 วัน", "เกิน 120 วัน", "รวม"];
    const rows: (string | number)[][] = [header];
    for (const v of vendors) {
      rows.push([v.vendorName, "", "", "", "", v.current, v.days31_60, v.days61_90, v.days91_120, v.over120, v.total]);
      for (const doc of v.documents) {
        const amt = parseFloat(doc.totalAmount) || 0;
        const typeLabel = doc.docType === "purchase_invoice" ? "ใบแจ้งหนี้ซื้อ" : doc.docType === "expense" ? "ค่าใช้จ่าย" : doc.docType;
        const bucket: (string | number)[] = doc.daysOutstanding <= 30 ? [amt, "", "", "", ""]
          : doc.daysOutstanding <= 60 ? ["", amt, "", "", ""]
          : doc.daysOutstanding <= 90 ? ["", "", amt, "", ""]
          : doc.daysOutstanding <= 120 ? ["", "", "", amt, ""]
          : ["", "", "", "", amt];
        rows.push(["", doc.docNo, typeLabel, doc.docDate, doc.daysOutstanding, ...bucket, amt]);
      }
    }
    if (totals) {
      rows.push(["รวมทั้งสิ้น", "", "", "", "", totals.current, totals.days31_60, totals.days61_90, totals.days91_120, totals.over120, totals.total]);
    }
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "AP Aging");
    XLSX.writeFile(wb, `ap-aging-${asOfDate}.xlsx`);
  };

  const docTypeLabel = (type: string) => {
    if (type === "purchase_invoice") return "ใบแจ้งหนี้ซื้อ";
    if (type === "expense") return "ค่าใช้จ่าย";
    return type;
  };

  const docTypeBadgeColor = (type: string) => {
    if (type === "purchase_invoice") return "bg-orange-100 text-orange-700";
    return "bg-purple-100 text-purple-700";
  };

  return (
    <ReportLayout title="เจ้าหนี้คงค้าง (AP Aging)" icon={<FileSpreadsheet className="h-5 w-5" />}>
        <div className="flex items-center justify-end flex-wrap gap-2 mb-2">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs border-green-400 text-green-600 hover:bg-green-50"
              onClick={() => refetch()}
              disabled={isLoading}
              data-testid="button-generate"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
              สร้างรายงาน
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs border-orange-300 text-orange-600 hover:bg-orange-50"
              onClick={handlePrint}
              data-testid="button-print"
            >
              <Printer className="h-3.5 w-3.5" />
              พิมพ์
            </Button>
            <Button
              size="sm"
              className="h-8 gap-1.5 text-xs text-white hover:opacity-90"
              style={{ background: "var(--theme-table-header)" }}
              onClick={handleCsvExport}
              data-testid="button-csv"
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </Button>
            <Button
              size="sm"
              className="h-8 gap-1.5 text-xs bg-[#05b187] text-white hover:bg-[#049a75] border-none"
              onClick={handleExcel}
              data-testid="button-excel"
            >
              <FileDown className="h-3.5 w-3.5" />
              Excel
            </Button>
          </div>
        </div>

        <div className="bg-white border rounded-xl shadow-sm">
          <div className="p-4 border-b flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium whitespace-nowrap">ณ วันที่</label>
              <ThaiDateInput
                value={asOfDate}
                onChange={setAsOfDate}
                dateEra={dateEra}
                dateFmt={dateFmt}
                data-testid="input-as-of-date"
              />
            </div>
            {!companyId && (
              <span className="text-xs text-muted-foreground">กรุณาเลือกบริษัท</span>
            )}
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-[var(--theme-primary)] bg-[var(--theme-primary)]">
                  <TableHead className="text-sm font-bold text-white w-8"></TableHead>
                  <TableHead className="text-sm font-bold text-white">ผู้จำหน่าย/เจ้าหนี้</TableHead>
                  <TableHead className="text-sm font-bold text-white text-right w-[130px]">ปัจจุบัน (0-30)</TableHead>
                  <TableHead className="text-sm font-bold text-white text-right w-[120px]">31-60 วัน</TableHead>
                  <TableHead className="text-sm font-bold text-white text-right w-[120px]">61-90 วัน</TableHead>
                  <TableHead className="text-sm font-bold text-white text-right w-[120px]">91-120 วัน</TableHead>
                  <TableHead className="text-sm font-bold text-white text-right w-[120px]">เกิน 120 วัน</TableHead>
                  <TableHead className="text-sm font-bold text-white text-right w-[130px]">รวม</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">กำลังโหลด...</TableCell>
                  </TableRow>
                ) : !companyId ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center">
                      <FileSpreadsheet className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
                      <p className="text-muted-foreground text-sm" data-testid="text-empty-state">กรุณาเลือกบริษัทเพื่อดูรายงาน</p>
                    </TableCell>
                  </TableRow>
                ) : vendors.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center">
                      <FileSpreadsheet className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
                      <p className="text-muted-foreground text-sm" data-testid="text-no-data">ไม่พบเจ้าหนี้คงค้าง</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {vendors.map((vendor, idx) => {
                      const isExpanded = expandedRows.has(vendor.vendorName);
                      return (
                        <>
                          <TableRow
                            key={`vendor-${idx}`}
                            className="hover:bg-orange-50/30 cursor-pointer group"
                            onClick={() => toggleExpand(vendor.vendorName)}
                            data-testid={`row-vendor-${idx}`}
                          >
                            <TableCell className="py-2.5 text-center">
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )}
                            </TableCell>
                            <TableCell className="text-sm py-2.5 font-medium group-hover:text-orange-600" data-testid={`text-vendor-name-${idx}`}>
                              {vendor.vendorName}
                            </TableCell>
                            <TableCell className="text-sm py-2.5 text-right font-medium tabular-nums" data-testid={`text-current-${idx}`}>{fmt(vendor.current)}</TableCell>
                            <TableCell className="text-sm py-2.5 text-right font-medium tabular-nums" data-testid={`text-31-60-${idx}`}>{fmt(vendor.days31_60)}</TableCell>
                            <TableCell className="text-sm py-2.5 text-right font-medium tabular-nums" data-testid={`text-61-90-${idx}`}>{fmt(vendor.days61_90)}</TableCell>
                            <TableCell className="text-sm py-2.5 text-right font-medium tabular-nums" data-testid={`text-91-120-${idx}`}>{fmt(vendor.days91_120)}</TableCell>
                            <TableCell className="text-sm py-2.5 text-right font-medium tabular-nums" data-testid={`text-over120-${idx}`}>{fmt(vendor.over120)}</TableCell>
                            <TableCell className="text-sm py-2.5 text-right font-bold tabular-nums" data-testid={`text-total-${idx}`}>{fmt(vendor.total)}</TableCell>
                          </TableRow>
                          {isExpanded && vendor.documents.map((doc, dIdx) => (
                            <TableRow
                              key={`doc-${idx}-${dIdx}`}
                              className="bg-gray-50/50 hover:bg-gray-100/50"
                              data-testid={`row-document-${idx}-${dIdx}`}
                            >
                              <TableCell></TableCell>
                              <TableCell className="text-xs py-1.5 pl-8 text-muted-foreground">
                                <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium mr-2 ${docTypeBadgeColor(doc.docType)}`}>
                                  {docTypeLabel(doc.docType)}
                                </span>
                                <span className="font-medium text-orange-600">{doc.docNo}</span>
                                <span className="mx-2">|</span>
                                <span>{formatDate(doc.docDate, dateEra, dateFmt)}</span>
                                <span className="mx-2">|</span>
                                <span>{doc.daysOutstanding} วัน</span>
                              </TableCell>
                              <TableCell colSpan={5}></TableCell>
                              <TableCell className="text-xs py-1.5 text-right tabular-nums font-medium">
                                {parseFloat(doc.totalAmount).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </TableCell>
                            </TableRow>
                          ))}
                        </>
                      );
                    })}
                    {totals && (
                      <TableRow className="bg-slate-100 font-bold border-t-2" data-testid="row-totals">
                        <TableCell></TableCell>
                        <TableCell className="text-sm py-2.5">รวมทั้งสิ้น</TableCell>
                        <TableCell className="text-sm py-2.5 text-right tabular-nums" data-testid="text-grand-current">{fmt(totals.current)}</TableCell>
                        <TableCell className="text-sm py-2.5 text-right tabular-nums" data-testid="text-grand-31-60">{fmt(totals.days31_60)}</TableCell>
                        <TableCell className="text-sm py-2.5 text-right tabular-nums" data-testid="text-grand-61-90">{fmt(totals.days61_90)}</TableCell>
                        <TableCell className="text-sm py-2.5 text-right tabular-nums" data-testid="text-grand-91-120">{fmt(totals.days91_120)}</TableCell>
                        <TableCell className="text-sm py-2.5 text-right tabular-nums" data-testid="text-grand-over120">{fmt(totals.over120)}</TableCell>
                        <TableCell className="text-sm py-2.5 text-right tabular-nums" data-testid="text-grand-total">{fmt(totals.total)}</TableCell>
                      </TableRow>
                    )}
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
    </ReportLayout>
  );
}
