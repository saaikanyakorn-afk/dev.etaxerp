import { useState, useMemo, Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import ReportLayout from "@/components/report-layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCompany } from "@/lib/company-context";
import { PieChart, Download, ChevronDown, ChevronRight, FileText, Calendar as CalendarIcon, Users, Package, Building, BarChart3, Printer } from "lucide-react";
import ThaiDateInput from "@/components/thai-date-input";
import { useDateSettings } from "@/hooks/use-date-settings";
import { toLocalDateStr } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import ListExportButton from "@/components/list-export-button";

const DOC_TYPES = [
  { value: "quotation", label: "ใบเสนอราคา" },
  { value: "salesOrder", label: "ใบสั่งขาย" },
  { value: "taxInvoice", label: "ใบกำกับภาษี" },
  { value: "invoice", label: "ใบแจ้งหนี้" },
];

const GROUP_BY_OPTIONS = [
  { value: "employee", label: "พนักงานขาย", icon: Users },
  { value: "product", label: "สินค้า", icon: Package },
  { value: "customer", label: "ลูกค้า", icon: Users },
  { value: "branch", label: "สาขา", icon: Building },
];

function fmt(val: number | string | null | undefined): string {
  const n = parseFloat(String(val || "0"));
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function SalesReport() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const [, navigate] = useLocation();
  const { dateEra, dateFmt } = useDateSettings();

  const now = new Date();
  const yearStart = `${now.getFullYear()}-01-01`;
  const todayStr = toLocalDateStr(now);

  const [docType, setDocType] = useState("taxInvoice");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [groupBy, setGroupBy] = useState("employee");
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());

  const { data: reportData, isLoading } = useQuery<any>({
    queryKey: ["/api/reports/sales-summary", companyId, docType, dateFrom, dateTo, groupBy],
    queryFn: async () => {
      if (!companyId) return null;
      const params = new URLSearchParams({
        companyId: String(companyId),
        docType,
        dateFrom,
        dateTo,
        groupBy,
      });
      const res = await fetch(`/api/reports/sales-summary?${params}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!companyId && !!dateFrom && !!dateTo,
  });

  const groups: any[] = reportData?.groups || [];
  const summary = reportData?.summary || { totalDocs: 0, totalAmount: 0, avgAmount: 0 };

  function toggleGroup(idx: number) {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  const exportData = useMemo(() => {
    const rows: any[] = [];
    groups.forEach((g: any) => {
      (g.items || []).forEach((item: any) => {
        rows.push({
          groupName: g.name,
          docNo: item.docNo,
          docDate: item.docDate,
          customerName: item.customerName,
          subtotal: parseFloat(item.subtotal || "0"),
          vatAmount: parseFloat(item.vatAmount || "0"),
          totalAmount: parseFloat(item.totalAmount || "0"),
          salesperson: item.salesperson || "-",
        });
      });
    });
    return rows;
  }, [groups]);

  const exportColumns = [
    { header: "กลุ่ม", key: "groupName", width: 20 },
    { header: "เลขที่เอกสาร", key: "docNo", width: 18 },
    { header: "วันที่", key: "docDate", width: 14 },
    { header: "ลูกค้า", key: "customerName", width: 25 },
    { header: "ยอดก่อนภาษี", key: "subtotal", width: 16, format: "number" as const },
    { header: "ภาษี", key: "vatAmount", width: 14, format: "number" as const },
    { header: "ยอดรวม", key: "totalAmount", width: 16, format: "number" as const },
    { header: "พนักงานขาย", key: "salesperson", width: 18 },
  ];

  return (
    <ReportLayout title="รายงานยอดขาย" icon={<PieChart className="h-5 w-5" />}>
        <div className="flex justify-end mb-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => window.print()}
            data-testid="button-print"
          >
            <Printer className="h-3.5 w-3.5" />
            พิมพ์
          </Button>
          <ListExportButton data={exportData} columns={exportColumns} fileName="รายงานยอดขาย" />
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
                    {DOC_TYPES.map(dt => (
                      <SelectItem key={dt.value} value={dt.value}>{dt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">ช่วงวันที่:</span>
                <ThaiDateInput value={dateFrom} onChange={setDateFrom} dateEra={dateEra} dateFmt={dateFmt} className="w-[160px]" data-testid="input-date-from" />
                <span className="text-xs text-gray-500">ถึง</span>
                <ThaiDateInput value={dateTo} onChange={setDateTo} dateEra={dateEra} dateFmt={dateFmt} className="w-[160px]" data-testid="input-date-to" />
              </div>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">จัดกลุ่มตาม:</span>
                <Select value={groupBy} onValueChange={setGroupBy}>
                  <SelectTrigger className="w-36 h-8 text-xs bg-white border rounded-lg" data-testid="select-group-by">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GROUP_BY_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="rounded border shadow-sm bg-white" data-testid="card-total-docs">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#fb967815" }}>
                  <FileText className="h-5 w-5" style={{ color: "#fb9678" }} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">จำนวนเอกสาร</p>
                  <p className="text-xl font-bold" style={{ color: "#fb9678" }} data-testid="text-total-docs">
                    {summary.totalDocs.toLocaleString("th-TH")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded border shadow-sm bg-white" data-testid="card-total-amount">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#03c9d715" }}>
                  <BarChart3 className="h-5 w-5" style={{ color: "#03c9d7" }} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">ยอดรวม</p>
                  <p className="text-xl font-bold" style={{ color: "#03c9d7" }} data-testid="text-total-amount">
                    {fmt(summary.totalAmount)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded border shadow-sm bg-white" data-testid="card-avg-amount">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#05b18715" }}>
                  <PieChart className="h-5 w-5" style={{ color: "#05b187" }} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">เฉลี่ย</p>
                  <p className="text-xl font-bold" style={{ color: "#05b187" }} data-testid="text-avg-amount">
                    {fmt(summary.avgAmount)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded border shadow-sm bg-white">
          <CardHeader className="p-3 border-b">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">ข้อมูลแยกตามกลุ่ม - {groups.length} กลุ่ม</span>
              <Badge className="bg-slate-100 text-slate-600 border-0 text-xs">{summary.totalDocs} รายการ</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">กำลังโหลด...</div>
            ) : groups.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <PieChart className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                <p className="text-sm" data-testid="text-empty-state">ไม่พบข้อมูล</p>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-slate-100">
                  <TableRow className="hover:bg-transparent h-11">
                    <TableHead className="w-10 text-center text-sm font-medium text-slate-700"></TableHead>
                    <TableHead className="text-sm font-medium text-slate-700">กลุ่ม</TableHead>
                    <TableHead className="w-28 text-center text-sm font-medium text-slate-700">จำนวน</TableHead>
                    <TableHead className="w-40 text-right text-sm font-medium text-slate-700">ยอดรวม</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groups.map((group: any, gIdx: number) => {
                    const isExpanded = expandedGroups.has(gIdx);
                    const items: any[] = group.items || [];
                    return (
                      <Fragment key={gIdx}>
                        <TableRow
                          data-testid={`row-group-${gIdx}`}
                          className="hover:bg-slate-50/50 border-b cursor-pointer"
                          onClick={() => toggleGroup(gIdx)}
                        >
                          <TableCell className="text-center py-3">
                            <button data-testid={`button-expand-group-${gIdx}`} className="w-6 h-6 rounded flex items-center justify-center text-slate-500 hover:bg-slate-200">
                              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </button>
                          </TableCell>
                          <TableCell className="text-sm font-medium" data-testid={`text-group-name-${gIdx}`}>{group.name || "(ไม่ระบุ)"}</TableCell>
                          <TableCell className="text-center text-sm">
                            <Badge className="bg-[#fb967815] text-[#fb9678] border-0 text-xs">{group.count}</Badge>
                          </TableCell>
                          <TableCell className="text-right text-sm font-medium tabular-nums">{fmt(group.totalAmount)}</TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow className="bg-slate-50/30">
                            <TableCell colSpan={4} className="p-0">
                              <Table>
                                <TableHeader>
                                  <TableRow className="hover:bg-transparent bg-slate-50">
                                    <TableHead className="text-xs font-medium text-slate-500 w-[60px]">#</TableHead>
                                    <TableHead className="text-xs font-medium text-slate-500 w-[150px]">เลขที่เอกสาร</TableHead>
                                    <TableHead className="text-xs font-medium text-slate-500 w-[110px]">วันที่</TableHead>
                                    <TableHead className="text-xs font-medium text-slate-500">ลูกค้า</TableHead>
                                    <TableHead className="text-xs font-medium text-slate-500 w-[120px] text-right">ยอดก่อนภาษี</TableHead>
                                    <TableHead className="text-xs font-medium text-slate-500 w-[100px] text-right">ภาษี</TableHead>
                                    <TableHead className="text-xs font-medium text-slate-500 w-[120px] text-right">ยอดรวม</TableHead>
                                    <TableHead className="text-xs font-medium text-slate-500 w-[120px]">พนักงานขาย</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {items.map((item: any, idx: number) => (
                                    <TableRow key={idx} className="hover:bg-slate-100/50" data-testid={`row-item-${gIdx}-${idx}`}>
                                      <TableCell className="text-xs py-2 text-muted-foreground">{idx + 1}</TableCell>
                                      <TableCell className="text-xs py-2 font-medium text-[#fb9678]">{item.docNo}</TableCell>
                                      <TableCell className="text-xs py-2 tabular-nums">{formatDate(item.docDate, dateEra, dateFmt)}</TableCell>
                                      <TableCell className="text-xs py-2">{item.customerName || "-"}</TableCell>
                                      <TableCell className="text-xs py-2 text-right tabular-nums">{fmt(item.subtotal)}</TableCell>
                                      <TableCell className="text-xs py-2 text-right tabular-nums">{fmt(item.vatAmount)}</TableCell>
                                      <TableCell className="text-xs py-2 text-right font-medium tabular-nums">{fmt(item.totalAmount)}</TableCell>
                                      <TableCell className="text-xs py-2">{item.salesperson || "-"}</TableCell>
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