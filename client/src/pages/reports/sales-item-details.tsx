import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import ReportLayout from "@/components/report-layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useCompany } from "@/lib/company-context";
import { Package, FileText, Calendar as CalendarIcon, Search, Printer } from "lucide-react";
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

export default function SalesItemDetails() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const { dateEra, dateFmt } = useDateSettings();

  const now = new Date();
  const [docType, setDocType] = useState("taxInvoice");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState(toLocalDateStr(now));
  const [search, setSearch] = useState("");

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

  const allItems = data?.items || [];
  const summary = data?.summary || { totalItems: 0, totalDocs: 0, totalQty: 0, totalAmount: 0 };

  const filteredItems = useMemo(() => {
    if (!search) return allItems;
    const s = search.toLowerCase();
    return allItems.filter((i: any) =>
      (i.productName || "").toLowerCase().includes(s) ||
      (i.productCode || "").toLowerCase().includes(s) ||
      (i.docNo || "").toLowerCase().includes(s) ||
      (i.customerName || "").toLowerCase().includes(s)
    );
  }, [allItems, search]);

  const exportData = useMemo(() => {
    return filteredItems.map((i: any, idx: number) => ({
      no: idx + 1, docNo: i.docNo, docDate: i.docDate, customerName: i.customerName,
      productCode: i.productCode, productName: i.productName, qty: parseFloat(i.qty || "0"),
      unit: i.unit, unitPrice: parseFloat(i.unitPrice || "0"), discount: parseFloat(i.discount || "0"),
      total: parseFloat(i.total || "0"),
    }));
  }, [filteredItems]);

  const exportColumns = [
    { header: "#", key: "no", width: 8 },
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

  return (
    <ReportLayout title="R10: รายละเอียดสินค้าในใบกำกับขาย" icon={<Package className="h-5 w-5" />}>
      <div className="flex justify-end mb-2 gap-2">
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => window.print()} data-testid="button-print"><Printer className="h-3.5 w-3.5" /> พิมพ์</Button>
        <ListExportButton data={exportData} columns={exportColumns} fileName="R10-รายละเอียดสินค้า" />
      </div>

      <Card className="rounded border shadow-sm bg-white">
        <CardHeader className="p-3 border-b">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger className="w-40 h-8 text-xs bg-white border rounded-lg" data-testid="select-doc-type"><SelectValue /></SelectTrigger>
                <SelectContent>{DOC_TYPES.map(dt => <SelectItem key={dt.value} value={dt.value}>{dt.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
              <ThaiDateInput value={dateFrom} onChange={setDateFrom} dateEra={dateEra} dateFmt={dateFmt} className="w-[160px]" data-testid="input-date-from" />
              <span className="text-xs text-gray-500">ถึง</span>
              <ThaiDateInput value={dateTo} onChange={setDateTo} dateEra={dateEra} dateFmt={dateFmt} className="w-[160px]" data-testid="input-date-to" />
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="ค้นหาสินค้า/เอกสาร/ลูกค้า..." value={search} onChange={e => setSearch(e.target.value)} className="w-60 h-8 text-xs" data-testid="input-search" />
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "จำนวนเอกสาร", value: summary.totalDocs.toLocaleString("th-TH"), color: "#fb9678" },
          { label: "รายการสินค้า", value: filteredItems.length.toLocaleString("th-TH"), color: "#03c9d7" },
          { label: "จำนวนรวม", value: fmt(summary.totalQty), color: "#fec90f" },
          { label: "ยอดรวม", value: fmt(summary.totalAmount), color: "#05b187" },
        ].map((stat, i) => (
          <Card key={i} className="rounded border shadow-sm bg-white">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className="text-xl font-bold" style={{ color: stat.color }} data-testid={`text-stat-${i}`}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded border shadow-sm bg-white">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">กำลังโหลด...</div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 text-slate-300" />
              <p className="text-sm" data-testid="text-empty-state">ไม่พบข้อมูล</p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-100">
                <TableRow className="hover:bg-transparent h-11">
                  <TableHead className="w-[50px] text-sm font-medium text-slate-700">#</TableHead>
                  <TableHead className="w-[140px] text-sm font-medium text-slate-700">เลขที่เอกสาร</TableHead>
                  <TableHead className="w-[100px] text-sm font-medium text-slate-700">วันที่</TableHead>
                  <TableHead className="text-sm font-medium text-slate-700">ลูกค้า</TableHead>
                  <TableHead className="w-[100px] text-sm font-medium text-slate-700">รหัสสินค้า</TableHead>
                  <TableHead className="text-sm font-medium text-slate-700">สินค้า</TableHead>
                  <TableHead className="w-[80px] text-right text-sm font-medium text-slate-700">จำนวน</TableHead>
                  <TableHead className="w-[60px] text-sm font-medium text-slate-700">หน่วย</TableHead>
                  <TableHead className="w-[100px] text-right text-sm font-medium text-slate-700">ราคา/หน่วย</TableHead>
                  <TableHead className="w-[100px] text-right text-sm font-medium text-slate-700">รวม</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item: any, idx: number) => (
                  <TableRow key={idx} className="hover:bg-slate-50/50" data-testid={`row-item-${idx}`}>
                    <TableCell className="text-xs py-2 text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell className="text-xs py-2 font-medium text-[#fb9678]">{item.docNo}</TableCell>
                    <TableCell className="text-xs py-2 tabular-nums">{formatDate(item.docDate, dateEra, dateFmt)}</TableCell>
                    <TableCell className="text-xs py-2">{item.customerName}</TableCell>
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
          )}
        </CardContent>
      </Card>
    </ReportLayout>
  );
}
