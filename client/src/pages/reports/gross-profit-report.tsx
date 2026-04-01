import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ReportLayout from "@/components/report-layout";
import { useCompany } from "@/lib/company-context";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, Download, FileText, Calendar as CalendarIcon, DollarSign, Percent, BarChart3, Printer } from "lucide-react";
import ThaiDateInput from "@/components/thai-date-input";
import { useDateSettings } from "@/hooks/use-date-settings";
import { formatDate } from "@/lib/format";
import { toLocalDateStr } from "@/lib/utils";
import ListExportButton from "@/components/list-export-button";

function fmt(val: string | number | null | undefined): string {
  const n = parseFloat(String(val || "0"));
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const DOC_TYPE_MAP: Record<string, string> = {
  tax_invoice: "ใบกำกับภาษี",
  invoice: "ใบแจ้งหนี้",
};

export default function GrossProfitReport() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const { dateEra, dateFmt } = useDateSettings();

  const now = new Date();
  const yearStart = `${now.getFullYear()}-01-01`;
  const todayStr = toLocalDateStr(now);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [filterBranch, setFilterBranch] = useState("all");

  const { data, isLoading } = useQuery<{
    items: any[];
    summary: { totalRevenue: number; totalCost: number; totalProfit: number; avgMargin: number };
  }>({
    queryKey: ["/api/reports/gross-profit", companyId, dateFrom, dateTo],
    queryFn: async () => {
      if (!companyId) return { items: [], summary: { totalRevenue: 0, totalCost: 0, totalProfit: 0, avgMargin: 0 } };
      const params = new URLSearchParams({ companyId: String(companyId) });
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      const res = await fetch(`/api/reports/gross-profit?${params}`, { credentials: "include" });
      if (!res.ok) return { items: [], summary: { totalRevenue: 0, totalCost: 0, totalProfit: 0, avgMargin: 0 } };
      return res.json();
    },
    enabled: !!companyId,
  });

  const items = data?.items || [];
  const summary = data?.summary || { totalRevenue: 0, totalCost: 0, totalProfit: 0, avgMargin: 0 };

  const branchOptions = Array.from(new Set(items.map((it: any) => it.sellerBranchId).filter(Boolean))) as string[];

  const filtered = items.filter((it: any) => {
    if (filterBranch !== "all" && it.sellerBranchId !== filterBranch) return false;
    if (customerSearch) {
      const s = customerSearch.toLowerCase();
      if (!(it.customer || "").toLowerCase().includes(s)) return false;
    }
    return true;
  });

  const filteredTotalRevenue = filtered.reduce((sum: number, it: any) => sum + (parseFloat(it.revenue) || 0), 0);
  const filteredTotalCost = filtered.reduce((sum: number, it: any) => sum + (parseFloat(it.cost) || 0), 0);
  const filteredTotalProfit = filtered.reduce((sum: number, it: any) => sum + (parseFloat(it.profit) || 0), 0);
  const filteredAvgMargin = filteredTotalRevenue > 0 ? (filteredTotalProfit / filteredTotalRevenue) * 100 : 0;

  const displaySummary = (customerSearch || filterBranch !== "all")
    ? { totalRevenue: filteredTotalRevenue, totalCost: filteredTotalCost, totalProfit: filteredTotalProfit, avgMargin: filteredAvgMargin }
    : summary;

  const exportColumns = [
    { header: "#", key: "_index", width: 6 },
    { header: "ประเภท", key: "_docTypeLabel", width: 16 },
    { header: "เลขที่", key: "docNo", width: 20 },
    { header: "วันที่", key: "date", width: 14 },
    { header: "ลูกค้า", key: "customer", width: 25 },
    { header: "ยอดขาย", key: "revenue", width: 16, format: "number" as const },
    { header: "ต้นทุน", key: "cost", width: 16, format: "number" as const },
    { header: "กำไรขั้นต้น", key: "profit", width: 16, format: "number" as const },
    { header: "% กำไร", key: "marginPct", width: 10, format: "number" as const },
  ];

  const exportData = filtered.map((it: any, idx: number) => ({
    ...it,
    _index: idx + 1,
    _docTypeLabel: DOC_TYPE_MAP[it.docType] || it.docType,
  }));

  const summaryCards = [
    { label: "ยอดขายรวม", value: displaySummary.totalRevenue, color: "text-blue-600", bg: "bg-blue-50", icon: DollarSign, borderColor: "border-blue-200" },
    { label: "ต้นทุนรวม", value: displaySummary.totalCost, color: "text-[#fb9678]", bg: "bg-orange-50", icon: BarChart3, borderColor: "border-orange-200" },
    { label: "กำไรรวม", value: displaySummary.totalProfit, color: "text-[#05b187]", bg: "bg-emerald-50", icon: TrendingUp, borderColor: "border-emerald-200" },
    { label: "% กำไรเฉลี่ย", value: displaySummary.avgMargin, color: "text-[#03c9d7]", bg: "bg-cyan-50", icon: Percent, borderColor: "border-cyan-200", suffix: "%" },
  ];

  return (
    <ReportLayout title="รายงานกำไรขั้นต้น" icon={<TrendingUp className="h-5 w-5" />}>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {summaryCards.map((card, idx) => (
            <Card key={idx} className={`rounded border shadow-sm bg-white ${card.borderColor}`} data-testid={`card-summary-${idx}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">{card.label}</span>
                  <div className={`w-8 h-8 rounded-full ${card.bg} flex items-center justify-center`}>
                    <card.icon className={`h-4 w-4 ${card.color}`} />
                  </div>
                </div>
                <div className={`text-xl font-bold tabular-nums ${card.color}`} data-testid={`text-summary-value-${idx}`}>
                  {fmt(card.value)}{card.suffix || ""}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="rounded border shadow-sm bg-white">
          <CardHeader className="p-3 border-b space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <FileText className="h-4 w-4" />
                <span>รายละเอียด - {filtered.length} รายการ</span>
              </div>
              <div className="flex items-center gap-2">
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
                <ListExportButton data={exportData} columns={exportColumns} fileName="รายงานกำไรขั้นต้น" />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">ช่วงวันที่:</span>
                <ThaiDateInput value={dateFrom} onChange={setDateFrom} dateEra={dateEra} dateFmt={dateFmt} className="w-[160px]" data-testid="input-date-from" />
                <span className="text-xs text-gray-500">ถึง</span>
                <ThaiDateInput value={dateTo} onChange={setDateTo} dateEra={dateEra} dateFmt={dateFmt} className="w-[160px]" data-testid="input-date-to" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">ลูกค้า:</span>
                <Input
                  data-testid="input-customer-search"
                  placeholder="ค้นหาลูกค้า..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="h-8 w-40 text-xs"
                />
              </div>
              {branchOptions.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">สาขา:</span>
                  <Select value={filterBranch} onValueChange={setFilterBranch}>
                    <SelectTrigger className="w-36 h-8 text-xs bg-white border rounded-lg" data-testid="select-filter-branch">
                      <SelectValue placeholder="ทั้งหมด" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">ทั้งหมด</SelectItem>
                      {branchOptions.map((b) => (
                        <SelectItem key={b} value={b}>{b}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {(customerSearch || filterBranch !== "all") && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-muted-foreground"
                  onClick={() => { setCustomerSearch(""); setFilterBranch("all"); }}
                  data-testid="button-clear-filters"
                >
                  ล้างตัวกรอง
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">กำลังโหลด...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                <p className="text-sm" data-testid="text-empty-state">ไม่พบข้อมูล</p>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-slate-100">
                  <TableRow className="hover:bg-transparent h-11">
                    <TableHead className="w-10 text-center text-sm font-medium text-slate-700">#</TableHead>
                    <TableHead className="w-28 text-sm font-medium text-slate-700">ประเภท</TableHead>
                    <TableHead className="w-36 text-sm font-medium text-slate-700">เลขที่</TableHead>
                    <TableHead className="w-28 text-sm font-medium text-slate-700">วันที่</TableHead>
                    <TableHead className="text-sm font-medium text-slate-700">ลูกค้า</TableHead>
                    <TableHead className="w-32 text-right text-sm font-medium text-slate-700">ยอดขาย</TableHead>
                    <TableHead className="w-32 text-right text-sm font-medium text-slate-700">ต้นทุน</TableHead>
                    <TableHead className="w-32 text-right text-sm font-medium text-slate-700">กำไรขั้นต้น</TableHead>
                    <TableHead className="w-20 text-right text-sm font-medium text-slate-700">% กำไร</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((it: any, idx: number) => {
                    const profit = parseFloat(it.profit) || 0;
                    return (
                      <TableRow key={idx} data-testid={`row-item-${idx}`} className="hover:bg-slate-50/50 border-b">
                        <TableCell className="text-center text-sm text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="text-sm">
                          <Badge variant="outline" className="text-xs font-normal">
                            {DOC_TYPE_MAP[it.docType] || it.docType}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm font-medium" data-testid={`text-docno-${idx}`}>{it.docNo}</TableCell>
                        <TableCell className="text-sm tabular-nums">{formatDate(it.date, dateEra, dateFmt)}</TableCell>
                        <TableCell className="text-sm">{it.customer}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums">{fmt(it.revenue)}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums">{fmt(it.cost)}</TableCell>
                        <TableCell className={`text-right text-sm tabular-nums font-medium ${profit >= 0 ? "text-[#05b187]" : "text-red-500"}`}>
                          {fmt(it.profit)}
                        </TableCell>
                        <TableCell className={`text-right text-sm tabular-nums ${profit >= 0 ? "text-[#05b187]" : "text-red-500"}`}>
                          {fmt(it.marginPct)}%
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className="bg-slate-50 font-bold border-t-2" data-testid="row-totals">
                    <TableCell colSpan={5} className="text-sm text-right pr-4">รวมทั้งหมด</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{fmt(displaySummary.totalRevenue)}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{fmt(displaySummary.totalCost)}</TableCell>
                    <TableCell className={`text-right text-sm tabular-nums ${displaySummary.totalProfit >= 0 ? "text-[#05b187]" : "text-red-500"}`}>
                      {fmt(displaySummary.totalProfit)}
                    </TableCell>
                    <TableCell className={`text-right text-sm tabular-nums ${displaySummary.avgMargin >= 0 ? "text-[#05b187]" : "text-red-500"}`}>
                      {fmt(displaySummary.avgMargin)}%
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
    </ReportLayout>
  );
}
