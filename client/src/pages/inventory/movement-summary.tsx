import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/lib/company-context";
import { formatDate } from "@/lib/format";
import ThaiDateInput from "@/components/thai-date-input";
import { useDateSettings } from "@/hooks/use-date-settings";
import {
  ArrowLeft, Printer, Download, Filter, RotateCcw, Calculator,
  ArrowDownToLine, ArrowUpFromLine, TrendingUp, Package, Repeat
} from "lucide-react";
import { toLocalDateStr } from "@/lib/utils";

const COSTING_METHODS: Record<string, string> = {
  moving_average: "ถัวเฉลี่ยเคลื่อนที่",
  fifo: "FIFO (เข้าก่อนออกก่อน)",
  specific: "ระบุเฉพาะเจาะจง",
};

function formatCurrency(val: string | number | null | undefined): string {
  const n = parseFloat(String(val || "0"));
  if (n === 0) return "-";
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatNumber(val: string | number | null | undefined, decimals = 0): string {
  const n = parseFloat(String(val || "0"));
  return n.toLocaleString("th-TH", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

interface MovementItem {
  productId: number;
  productCode: string;
  productName: string;
  unit: string;
  inQty: number;
  inValue: number;
  outQty: number;
  outValue: number;
  netQty: number;
}

interface MovementResponse {
  method: string;
  startDate: string;
  endDate: string;
  items: MovementItem[];
}

export default function MovementSummaryPage(props: { Wrapper?: React.ComponentType<{ children: React.ReactNode }> } & Record<string, any>) {
  const LayoutComponent = props.Wrapper || Layout;
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const companyCostingMethod = (selectedCompany as any)?.inventoryCostingMethod || "moving_average";
  const { dateEra, dateFmt } = useDateSettings();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const today = toLocalDateStr(new Date());
  const yearStart = today.slice(0, 4) + "-01-01";
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState(today);
  const [costingMethod, setCostingMethod] = useState("");
  const [appliedStartDate, setAppliedStartDate] = useState("");
  const [appliedEndDate, setAppliedEndDate] = useState(today);
  const [appliedMethod, setAppliedMethod] = useState("");

  const activeMethod = appliedMethod || companyCostingMethod;

  const { data, isLoading } = useQuery<MovementResponse>({
    queryKey: ["/api/inventory-reports/movement-summary", companyId, activeMethod, appliedStartDate, appliedEndDate],
    queryFn: async () => {
      const res = await fetch(
        `/api/inventory-reports/movement-summary?companyId=${companyId}&method=${activeMethod}&startDate=${appliedStartDate}&endDate=${appliedEndDate}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!companyId,
  });

  const items = data?.items || [];

  const totalInQty = items.reduce((s, i) => s + (i.inQty || 0), 0);
  const totalInValue = items.reduce((s, i) => s + (i.inValue || 0), 0);
  const totalOutQty = items.reduce((s, i) => s + (i.outQty || 0), 0);
  const totalOutValue = items.reduce((s, i) => s + (i.outValue || 0), 0);
  const totalNetQty = items.reduce((s, i) => s + (i.netQty || 0), 0);

  const handleFilter = () => {
    setAppliedStartDate(startDate);
    setAppliedEndDate(endDate);
    setAppliedMethod(costingMethod || companyCostingMethod);
  };

  const handleClearFilter = () => {
    setStartDate(yearStart);
    setEndDate(today);
    setCostingMethod("");
    setAppliedStartDate(yearStart);
    setAppliedEndDate(today);
    setAppliedMethod("");
  };

  const handlePrint = () => window.print();

  const handleExportCSV = () => {
    if (items.length === 0) return;
    const headers = ["ลำดับ", "รหัส", "ชื่อสินค้า", "หน่วย", "รับเข้า(จำนวน)", "รับเข้า(มูลค่า)", "เบิกออก(จำนวน)", "เบิกออก(มูลค่า)", "คงเหลือสุทธิ"];
    const rows = items.map((item, i) => [
      String(i + 1),
      item.productCode || "",
      item.productName,
      item.unit || "",
      formatNumber(item.inQty, 2),
      formatCurrency(item.inValue),
      formatNumber(item.outQty, 2),
      formatCurrency(item.outValue),
      formatNumber(item.netQty, 2),
    ]);
    const BOM = "\uFEFF";
    const header1 = `สรุปการเคลื่อนไหวสินค้า ${formatDate(appliedStartDate, dateEra, dateFmt)} - ${formatDate(appliedEndDate, dateEra, dateFmt)} (${COSTING_METHODS[activeMethod]})`;
    const csvContent = BOM + [header1, headers.join(","), ...rows.map(r => r.map(c => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `movement_summary_${appliedStartDate}_${appliedEndDate}_${activeMethod}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: "ส่งออกสำเร็จ", description: `ส่งออก ${items.length} รายการ`, variant: "success" as any });
  };

  return (
    <LayoutComponent>
      <div className="space-y-4" data-testid="movement-summary-page">
        <div className="rounded-lg p-6 shadow-sm border print:shadow-none" style={{ background: "#ccfbf1" }}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
                <Repeat className="h-7 w-7" />
                สรุปการเคลื่อนไหวสินค้า
              </h1>
              <p className="mt-1 text-teal-800/60 text-sm">รายงานสรุปรับเข้า-เบิกออก คำนวณตาม {COSTING_METHODS[activeMethod]}</p>
            </div>
            <Button
              variant="outline"
              className="bg-white/60 border-teal-300 text-teal-700 hover:bg-white h-9"
              onClick={() => setLocation("/inventory/warehouse")}
              data-testid="button-back-warehouse"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              กลับคลังสินค้า
            </Button>
          </div>
        </div>

        <Card className="border shadow-sm print:hidden">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">วิธีต้นทุน</Label>
                <Select value={costingMethod || companyCostingMethod} onValueChange={setCostingMethod}>
                  <SelectTrigger className="h-9 text-sm w-56" data-testid="select-costing-method">
                    <Calculator className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="moving_average">ถัวเฉลี่ยเคลื่อนที่</SelectItem>
                    <SelectItem value="fifo">FIFO (เข้าก่อนออกก่อน)</SelectItem>
                    <SelectItem value="specific">ระบุเฉพาะเจาะจง</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">วันที่เริ่มต้น</Label>
                <ThaiDateInput value={startDate} onChange={setStartDate} dateEra={dateEra} dateFmt={dateFmt} className="w-44" data-testid="input-start-date" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">วันที่สิ้นสุด</Label>
                <ThaiDateInput value={endDate} onChange={setEndDate} dateEra={dateEra} dateFmt={dateFmt} className="w-44" data-testid="input-end-date" />
              </div>
              <Button size="sm" className="h-9" style={{ background: "#fec90f" }} onClick={handleFilter} data-testid="button-filter">
                <Filter className="h-4 w-4 mr-1" /> กรอง
              </Button>
              <Button size="sm" variant="outline" className="h-9" onClick={handleClearFilter} data-testid="button-clear-filter">
                <RotateCcw className="h-4 w-4 mr-1" /> ล้าง
              </Button>
              <div className="ml-auto flex gap-2">
                <Button size="sm" variant="outline" className="h-9" onClick={handlePrint} data-testid="button-print">
                  <Printer className="h-4 w-4 mr-1" /> พิมพ์
                </Button>
                <Button size="sm" variant="outline" className="h-9" onClick={handleExportCSV} data-testid="button-export-csv">
                  <Download className="h-4 w-4 mr-1" /> ส่งออก CSV
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border shadow-sm bg-emerald-50">
            <CardContent className="p-4">
              <p className="text-xs text-emerald-700/70 flex items-center gap-1"><ArrowDownToLine className="h-3 w-3" /> รับเข้ารวม</p>
              <p className="text-2xl font-bold text-emerald-700" data-testid="text-total-in-qty">
                {formatNumber(totalInQty, 2)}
              </p>
              <p className="text-xs text-emerald-700/70">มูลค่า ฿{formatCurrency(totalInValue)}</p>
            </CardContent>
          </Card>
          <Card className="border shadow-sm bg-rose-50">
            <CardContent className="p-4">
              <p className="text-xs text-rose-700/70 flex items-center gap-1"><ArrowUpFromLine className="h-3 w-3" /> เบิกออกรวม</p>
              <p className="text-2xl font-bold text-rose-700" data-testid="text-total-out-qty">
                {formatNumber(totalOutQty, 2)}
              </p>
              <p className="text-xs text-rose-700/70">มูลค่า ฿{formatCurrency(totalOutValue)}</p>
            </CardContent>
          </Card>
          <Card className="border shadow-sm bg-sky-50">
            <CardContent className="p-4">
              <p className="text-xs text-sky-700/70 flex items-center gap-1"><TrendingUp className="h-3 w-3" /> คงเหลือสุทธิ</p>
              <p className={`text-2xl font-bold ${totalNetQty >= 0 ? "text-sky-700" : "text-red-700"}`} data-testid="text-total-net-qty">
                {formatNumber(totalNetQty, 2)}
              </p>
              <p className="text-xs text-sky-700/70">หน่วย</p>
            </CardContent>
          </Card>
          <Card className="border shadow-sm bg-amber-50">
            <CardContent className="p-4">
              <p className="text-xs text-amber-700/70">จำนวนสินค้า</p>
              <p className="text-2xl font-bold text-amber-700" data-testid="text-total-products">
                {formatNumber(items.length)}
              </p>
              <p className="text-xs text-amber-700/70">รายการ</p>
            </CardContent>
          </Card>
        </div>

        <Card className="border shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Repeat className="h-4 w-4 text-[#fec90f]" />
                สรุปการเคลื่อนไหว
                <Badge variant="outline" className="text-[10px] ml-2 text-amber-700">
                  <Calculator className="h-3 w-3 mr-0.5" />
                  {COSTING_METHODS[activeMethod]}
                </Badge>
              </div>
              <Badge variant="outline" className="text-xs" data-testid="text-item-count">
                ทั้งหมด {items.length} รายการ
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="py-16 flex flex-col items-center gap-3 text-muted-foreground">
                <div className="animate-spin h-8 w-8 border-2 border-amber-500 border-t-transparent rounded-full" />
                <p className="text-sm">กำลังโหลดข้อมูล...</p>
              </div>
            ) : items.length === 0 ? (
              <div className="py-16 flex flex-col items-center gap-3 text-muted-foreground">
                <Package className="h-12 w-12 text-slate-300" />
                <p className="font-medium text-sm" data-testid="text-empty-state">ไม่พบข้อมูลการเคลื่อนไหวในช่วงเวลาที่เลือก</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="text-xs w-10 text-center">#</TableHead>
                      <TableHead className="text-xs">รหัส</TableHead>
                      <TableHead className="text-xs">ชื่อสินค้า</TableHead>
                      <TableHead className="text-xs">หน่วย</TableHead>
                      <TableHead className="text-xs text-right">
                        <span className="text-emerald-700">รับเข้า(จำนวน)</span>
                      </TableHead>
                      <TableHead className="text-xs text-right">
                        <span className="text-emerald-700">รับเข้า(มูลค่า)</span>
                      </TableHead>
                      <TableHead className="text-xs text-right">
                        <span className="text-red-700">เบิกออก(จำนวน)</span>
                      </TableHead>
                      <TableHead className="text-xs text-right">
                        <span className="text-red-700">เบิกออก(มูลค่า)</span>
                      </TableHead>
                      <TableHead className="text-xs text-right">
                        <span className="text-blue-700">คงเหลือสุทธิ</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, i) => (
                      <TableRow key={item.productId} data-testid={`row-movement-${item.productId}`}>
                        <TableCell className="text-xs text-center text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="text-xs font-mono" data-testid={`text-code-${item.productId}`}>{item.productCode || "-"}</TableCell>
                        <TableCell className="text-xs font-medium" data-testid={`text-name-${item.productId}`}>{item.productName}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{item.unit || "-"}</TableCell>
                        <TableCell className="text-xs text-right text-emerald-700 font-medium" data-testid={`text-in-qty-${item.productId}`}>{item.inQty > 0 ? formatNumber(item.inQty, 2) : "-"}</TableCell>
                        <TableCell className="text-xs text-right text-emerald-700" data-testid={`text-in-value-${item.productId}`}>{item.inValue > 0 ? `฿${formatCurrency(item.inValue)}` : "-"}</TableCell>
                        <TableCell className="text-xs text-right text-red-700 font-medium" data-testid={`text-out-qty-${item.productId}`}>{item.outQty > 0 ? formatNumber(item.outQty, 2) : "-"}</TableCell>
                        <TableCell className="text-xs text-right text-red-700" data-testid={`text-out-value-${item.productId}`}>{item.outValue > 0 ? `฿${formatCurrency(item.outValue)}` : "-"}</TableCell>
                        <TableCell className={`text-xs text-right font-semibold ${item.netQty >= 0 ? "text-blue-700" : "text-red-700"}`} data-testid={`text-net-qty-${item.productId}`}>
                          {formatNumber(item.netQty, 2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </LayoutComponent>
  );
}