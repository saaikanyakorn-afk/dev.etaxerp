import { useState, useMemo, Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import ReportLayout from "@/components/report-layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCompany } from "@/lib/company-context";
import { Building2, FileText, Calendar as CalendarIcon, ChevronDown, ChevronRight, BarChart3, Printer } from "lucide-react";
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

export default function SalesByDepartment() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const { dateEra, dateFmt } = useDateSettings();

  const now = new Date();
  const [docType, setDocType] = useState("taxInvoice");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState(toLocalDateStr(now));
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/reports/sales-summary", companyId, docType, dateFrom, dateTo, "department"],
    queryFn: async () => {
      if (!companyId) return null;
      const params = new URLSearchParams({ companyId: String(companyId), docType, dateFrom, dateTo, groupBy: "department" });
      const res = await fetch(`/api/reports/sales-summary?${params}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!companyId,
  });

  const groups: any[] = data?.groups || [];
  const summary = data?.summary || { totalDocs: 0, totalAmount: 0, avgAmount: 0 };

  function toggleGroup(idx: number) {
    setExpandedGroups(prev => { const n = new Set(prev); if (n.has(idx)) n.delete(idx); else n.add(idx); return n; });
  }

  const exportData = useMemo(() => {
    const rows: any[] = [];
    groups.forEach((g: any) => {
      (g.items || []).forEach((item: any) => {
        rows.push({ department: g.name, docNo: item.docNo, docDate: item.docDate, customerName: item.customerName, subtotal: parseFloat(item.subtotal || "0"), vatAmount: parseFloat(item.vatAmount || "0"), totalAmount: parseFloat(item.totalAmount || "0") });
      });
    });
    return rows;
  }, [groups]);

  const exportColumns = [
    { header: "แผนก", key: "department", width: 20 },
    { header: "เลขที่เอกสาร", key: "docNo", width: 18 },
    { header: "วันที่", key: "docDate", width: 14 },
    { header: "ลูกค้า", key: "customerName", width: 25 },
    { header: "ยอดก่อนภาษี", key: "subtotal", width: 16, format: "number" as const },
    { header: "ภาษี", key: "vatAmount", width: 14, format: "number" as const },
    { header: "ยอดรวม", key: "totalAmount", width: 16, format: "number" as const },
  ];

  return (
    <ReportLayout title="R7: ยอดขาย - ตามแผนก/เอกสาร" icon={<Building2 className="h-5 w-5" />}>
      <div className="flex justify-end mb-2 gap-2">
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => window.print()} data-testid="button-print"><Printer className="h-3.5 w-3.5" /> พิมพ์</Button>
        <ListExportButton data={exportData} columns={exportColumns} fileName="R7-ยอดขาย-ตามแผนก" />
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
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "จำนวนเอกสาร", value: summary.totalDocs.toLocaleString("th-TH"), color: "#fb9678", icon: FileText },
          { label: "ยอดรวม", value: fmt(summary.totalAmount), color: "#03c9d7", icon: BarChart3 },
          { label: "จำนวนแผนก", value: groups.length.toLocaleString("th-TH"), color: "#05b187", icon: Building2 },
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
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">กำลังโหลด...</div>
          ) : groups.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-3 text-slate-300" />
              <p className="text-sm" data-testid="text-empty-state">ไม่พบข้อมูล</p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-100">
                <TableRow className="hover:bg-transparent h-11">
                  <TableHead className="w-10"></TableHead>
                  <TableHead className="text-sm font-medium text-slate-700">แผนก</TableHead>
                  <TableHead className="w-28 text-center text-sm font-medium text-slate-700">จำนวน</TableHead>
                  <TableHead className="w-40 text-right text-sm font-medium text-slate-700">ยอดรวม</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((g: any, gIdx: number) => {
                  const isExpanded = expandedGroups.has(gIdx);
                  return (
                    <Fragment key={gIdx}>
                      <TableRow className="hover:bg-slate-50/50 border-b cursor-pointer" onClick={() => toggleGroup(gIdx)} data-testid={`row-group-${gIdx}`}>
                        <TableCell className="text-center py-3">
                          <button className="w-6 h-6 rounded flex items-center justify-center text-slate-500 hover:bg-slate-200">
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                        </TableCell>
                        <TableCell className="text-sm font-medium">{g.name}</TableCell>
                        <TableCell className="text-center"><Badge className="bg-[#fb967815] text-[#fb9678] border-0 text-xs">{g.count}</Badge></TableCell>
                        <TableCell className="text-right text-sm font-medium tabular-nums">{fmt(g.totalAmount)}</TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow className="bg-slate-50/30">
                          <TableCell colSpan={4} className="p-0">
                            <Table>
                              <TableHeader><TableRow className="hover:bg-transparent bg-slate-50">
                                <TableHead className="text-xs w-[60px]">#</TableHead>
                                <TableHead className="text-xs w-[150px]">เลขที่เอกสาร</TableHead>
                                <TableHead className="text-xs w-[110px]">วันที่</TableHead>
                                <TableHead className="text-xs">ลูกค้า</TableHead>
                                <TableHead className="text-xs w-[120px] text-right">ยอดก่อนภาษี</TableHead>
                                <TableHead className="text-xs w-[100px] text-right">ภาษี</TableHead>
                                <TableHead className="text-xs w-[120px] text-right">ยอดรวม</TableHead>
                              </TableRow></TableHeader>
                              <TableBody>
                                {(g.items || []).map((item: any, idx: number) => (
                                  <TableRow key={idx} className="hover:bg-slate-100/50">
                                    <TableCell className="text-xs py-2">{idx + 1}</TableCell>
                                    <TableCell className="text-xs py-2 font-medium text-[#fb9678]">{item.docNo}</TableCell>
                                    <TableCell className="text-xs py-2 tabular-nums">{formatDate(item.docDate, dateEra, dateFmt)}</TableCell>
                                    <TableCell className="text-xs py-2">{item.customerName || "-"}</TableCell>
                                    <TableCell className="text-xs py-2 text-right tabular-nums">{fmt(item.subtotal)}</TableCell>
                                    <TableCell className="text-xs py-2 text-right tabular-nums">{fmt(item.vatAmount)}</TableCell>
                                    <TableCell className="text-xs py-2 text-right font-medium tabular-nums">{fmt(item.totalAmount)}</TableCell>
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
