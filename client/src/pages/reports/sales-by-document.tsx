import { useState, useMemo, Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import ReportLayout from "@/components/report-layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCompany } from "@/lib/company-context";
import { FileText, Calendar as CalendarIcon, ChevronDown, ChevronRight, Package, Printer } from "lucide-react";
import ThaiDateInput from "@/components/thai-date-input";
import { useDateSettings } from "@/hooks/use-date-settings";
import { toLocalDateStr } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import ListExportButton from "@/components/list-export-button";

const DOC_TYPES = [
  { value: "taxInvoice", label: "ใบกำกับภาษี" },
  { value: "invoice", label: "ใบแจ้งหนี้" },
  { value: "quotation", label: "ใบเสนอราคา" },
  { value: "salesOrder", label: "ใบสั่งขาย" },
];

function fmt(val: number | string | null | undefined): string {
  const n = parseFloat(String(val || "0"));
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function SalesByDocument() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const { dateEra, dateFmt } = useDateSettings();

  const now = new Date();
  const yearStart = `${now.getFullYear()}-01-01`;
  const todayStr = toLocalDateStr(now);

  const [docType, setDocType] = useState("taxInvoice");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [expandedDocs, setExpandedDocs] = useState<Set<number>>(new Set());

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/reports/sales-line-items", companyId, docType, dateFrom, dateTo],
    queryFn: async () => {
      if (!companyId) return null;
      const params = new URLSearchParams({ companyId: String(companyId), docType, dateFrom, dateTo });
      const res = await fetch(`/api/reports/sales-line-items?${params}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!companyId,
  });

  const items = data?.items || [];
  const summary = data?.summary || { totalItems: 0, totalDocs: 0, totalQty: 0, totalAmount: 0 };

  const docGroups = useMemo(() => {
    const map = new Map<string, { docNo: string; docDate: string; customerName: string; total: number; items: any[] }>();
    for (const item of items) {
      if (!map.has(item.docNo)) {
        map.set(item.docNo, { docNo: item.docNo, docDate: item.docDate, customerName: item.customerName, total: 0, items: [] });
      }
      const g = map.get(item.docNo)!;
      g.total += parseFloat(item.total || "0");
      g.items.push(item);
    }
    return Array.from(map.values());
  }, [items]);

  const exportData = useMemo(() => {
    return items.map((i: any) => ({
      docNo: i.docNo, docDate: i.docDate, customerName: i.customerName,
      productCode: i.productCode, productName: i.productName, qty: parseFloat(i.qty || "0"),
      unit: i.unit, unitPrice: parseFloat(i.unitPrice || "0"), discount: parseFloat(i.discount || "0"),
      total: parseFloat(i.total || "0"),
    }));
  }, [items]);

  const exportColumns = [
    { header: "เลขที่เอกสาร", key: "docNo", width: 18 },
    { header: "วันที่", key: "docDate", width: 14 },
    { header: "ลูกค้า", key: "customerName", width: 25 },
    { header: "รหัสสินค้า", key: "productCode", width: 15 },
    { header: "ชื่อสินค้า", key: "productName", width: 25 },
    { header: "จำนวน", key: "qty", width: 12, format: "number" as const },
    { header: "หน่วย", key: "unit", width: 10 },
    { header: "ราคา/หน่วย", key: "unitPrice", width: 14, format: "number" as const },
    { header: "ส่วนลด", key: "discount", width: 12, format: "number" as const },
    { header: "รวม", key: "total", width: 14, format: "number" as const },
  ];

  function toggleDoc(idx: number) {
    setExpandedDocs(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }

  return (
    <ReportLayout title="R5: ยอดขาย - ตามเอกสาร/สินค้า" icon={<FileText className="h-5 w-5" />}>
      <div className="flex justify-end mb-2 gap-2">
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => window.print()} data-testid="button-print">
          <Printer className="h-3.5 w-3.5" /> พิมพ์
        </Button>
        <ListExportButton data={exportData} columns={exportColumns} fileName="R5-ยอดขาย-ตามเอกสาร" />
      </div>

      <Card className="rounded border shadow-sm bg-white">
        <CardHeader className="p-3 border-b">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">ประเภท:</span>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger className="w-40 h-8 text-xs bg-white border rounded-lg" data-testid="select-doc-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOC_TYPES.map(dt => <SelectItem key={dt.value} value={dt.value}>{dt.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
              <ThaiDateInput value={dateFrom} onChange={setDateFrom} dateEra={dateEra} dateFmt={dateFmt} className="w-[160px]" data-testid="input-date-from" />
              <span className="text-xs text-gray-500">ถึง</span>
              <ThaiDateInput value={dateTo} onChange={setDateTo} dateEra={dateEra} dateFmt={dateFmt} className="w-[160px]" data-testid="input-date-to" />
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "จำนวนเอกสาร", value: summary.totalDocs.toLocaleString("th-TH"), color: "#fb9678", icon: FileText },
          { label: "รายการสินค้า", value: summary.totalItems.toLocaleString("th-TH"), color: "#03c9d7", icon: Package },
          { label: "จำนวนรวม", value: fmt(summary.totalQty), color: "#fec90f", icon: Package },
          { label: "ยอดรวม", value: fmt(summary.totalAmount), color: "#05b187", icon: FileText },
        ].map((stat, i) => (
          <Card key={i} className="rounded border shadow-sm bg-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: stat.color + "15" }}>
                  <stat.icon className="h-5 w-5" style={{ color: stat.color }} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="text-xl font-bold" style={{ color: stat.color }} data-testid={`text-stat-${i}`}>{stat.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded border shadow-sm bg-white">
        <CardHeader className="p-3 border-b">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">รายการเอกสาร - {docGroups.length} เอกสาร</span>
            <Badge className="bg-slate-100 text-slate-600 border-0 text-xs">{summary.totalItems} รายการสินค้า</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">กำลังโหลด...</div>
          ) : docGroups.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 text-slate-300" />
              <p className="text-sm" data-testid="text-empty-state">ไม่พบข้อมูล</p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-100">
                <TableRow className="hover:bg-transparent h-11">
                  <TableHead className="w-10 text-center text-sm font-medium text-slate-700"></TableHead>
                  <TableHead className="text-sm font-medium text-slate-700">เลขที่เอกสาร</TableHead>
                  <TableHead className="w-28 text-sm font-medium text-slate-700">วันที่</TableHead>
                  <TableHead className="text-sm font-medium text-slate-700">ลูกค้า</TableHead>
                  <TableHead className="w-24 text-center text-sm font-medium text-slate-700">รายการ</TableHead>
                  <TableHead className="w-40 text-right text-sm font-medium text-slate-700">ยอดรวม</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {docGroups.map((doc, idx) => {
                  const isExpanded = expandedDocs.has(idx);
                  return (
                    <Fragment key={idx}>
                      <TableRow className="hover:bg-slate-50/50 border-b cursor-pointer" onClick={() => toggleDoc(idx)} data-testid={`row-doc-${idx}`}>
                        <TableCell className="text-center py-3">
                          <button className="w-6 h-6 rounded flex items-center justify-center text-slate-500 hover:bg-slate-200">
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                        </TableCell>
                        <TableCell className="text-sm font-medium text-[#fb9678]">{doc.docNo}</TableCell>
                        <TableCell className="text-sm tabular-nums">{formatDate(doc.docDate, dateEra, dateFmt)}</TableCell>
                        <TableCell className="text-sm">{doc.customerName}</TableCell>
                        <TableCell className="text-center"><Badge className="bg-[#03c9d715] text-[#03c9d7] border-0 text-xs">{doc.items.length}</Badge></TableCell>
                        <TableCell className="text-right text-sm font-medium tabular-nums">{fmt(doc.total)}</TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow className="bg-slate-50/30">
                          <TableCell colSpan={6} className="p-0">
                            <Table>
                              <TableHeader>
                                <TableRow className="hover:bg-transparent bg-slate-50">
                                  <TableHead className="text-xs font-medium text-slate-500 w-[60px]">#</TableHead>
                                  <TableHead className="text-xs font-medium text-slate-500 w-[120px]">รหัส</TableHead>
                                  <TableHead className="text-xs font-medium text-slate-500">สินค้า</TableHead>
                                  <TableHead className="text-xs font-medium text-slate-500 w-[90px] text-right">จำนวน</TableHead>
                                  <TableHead className="text-xs font-medium text-slate-500 w-[80px]">หน่วย</TableHead>
                                  <TableHead className="text-xs font-medium text-slate-500 w-[120px] text-right">ราคา/หน่วย</TableHead>
                                  <TableHead className="text-xs font-medium text-slate-500 w-[120px] text-right">รวม</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {doc.items.map((item: any, iIdx: number) => (
                                  <TableRow key={iIdx} className="hover:bg-slate-100/50" data-testid={`row-item-${idx}-${iIdx}`}>
                                    <TableCell className="text-xs py-2 text-muted-foreground">{iIdx + 1}</TableCell>
                                    <TableCell className="text-xs py-2 font-mono">{item.productCode}</TableCell>
                                    <TableCell className="text-xs py-2">{item.productName}</TableCell>
                                    <TableCell className="text-xs py-2 text-right tabular-nums">{fmt(item.qty)}</TableCell>
                                    <TableCell className="text-xs py-2">{item.unit}</TableCell>
                                    <TableCell className="text-xs py-2 text-right tabular-nums">{fmt(item.unitPrice)}</TableCell>
                                    <TableCell className="text-xs py-2 text-right font-medium tabular-nums">{fmt(item.total)}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </ReportLayout>
  );
}
