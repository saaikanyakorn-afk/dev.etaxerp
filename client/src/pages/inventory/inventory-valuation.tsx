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
  Package, ArrowLeft, Printer, Download, Filter, RotateCcw, Calculator, BarChart3, DollarSign, Layers
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

interface ValuationItem {
  productId: number;
  productCode: string;
  productName: string;
  category: string;
  unit: string;
  currentQty: number;
  unitCost: number;
  totalValue: number;
  lastMovementDate: string | null;
}

interface ValuationResponse {
  method: string;
  asOfDate: string;
  items: ValuationItem[];
  totalValue: number;
}

export default function InventoryValuationPage(props: { Wrapper?: React.ComponentType<{ children: React.ReactNode }> } & Record<string, any>) {
  const LayoutComponent = props.Wrapper || Layout;
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const companyCostingMethod = (selectedCompany as any)?.inventoryCostingMethod || "moving_average";
  const { dateEra, dateFmt } = useDateSettings();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const today = toLocalDateStr(new Date());
  const [asOfDate, setAsOfDate] = useState(today);
  const [costingMethod, setCostingMethod] = useState("");
  const [appliedDate, setAppliedDate] = useState(today);
  const [appliedMethod, setAppliedMethod] = useState("");

  const activeMethod = appliedMethod || companyCostingMethod;

  const { data, isLoading } = useQuery<ValuationResponse>({
    queryKey: ["/api/inventory-reports/valuation", companyId, activeMethod, appliedDate],
    queryFn: async () => {
      const res = await fetch(
        `/api/inventory-reports/valuation?companyId=${companyId}&method=${activeMethod}&asOfDate=${appliedDate}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!companyId,
  });

  const items = data?.items || [];
  const totalValue = data?.totalValue || 0;

  const handleFilter = () => {
    setAppliedDate(asOfDate);
    setAppliedMethod(costingMethod || companyCostingMethod);
  };

  const handleClearFilter = () => {
    setAsOfDate(today);
    setCostingMethod("");
    setAppliedDate(today);
    setAppliedMethod("");
  };

  const handlePrint = () => window.print();

  const handleExportCSV = () => {
    if (items.length === 0) return;
    const headers = ["ลำดับ", "รหัส", "ชื่อสินค้า", "หมวด", "หน่วย", "คงเหลือ", "ต้นทุน/หน่วย", "มูลค่ารวม", "เคลื่อนไหวล่าสุด"];
    const rows = items.map((item, i) => [
      String(i + 1),
      item.productCode || "",
      item.productName,
      item.category || "",
      item.unit || "",
      formatNumber(item.currentQty, 2),
      formatCurrency(item.unitCost),
      formatCurrency(item.totalValue),
      formatDate(item.lastMovementDate, dateEra, dateFmt),
    ]);
    const BOM = "\uFEFF";
    const header1 = `มูลค่าสินค้าคงเหลือ ณ วันที่ ${formatDate(appliedDate, dateEra, dateFmt)} (${COSTING_METHODS[activeMethod]})`;
    const csvContent = BOM + [header1, headers.join(","), ...rows.map(r => r.map(c => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `inventory_valuation_${appliedDate}_${activeMethod}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: "ส่งออกสำเร็จ", description: `ส่งออก ${items.length} รายการ`, variant: "success" as any });
  };

  return (
    <LayoutComponent>
      <div className="space-y-4" data-testid="inventory-valuation-page">
        <div className="rounded-lg p-6 shadow-sm border print:shadow-none" style={{ background: "#fce7f3" }}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
                <BarChart3 className="h-7 w-7" />
                มูลค่าสินค้าคงเหลือ
              </h1>
              <p className="mt-1 text-pink-800/60 text-sm">รายงานมูลค่าสินค้าคงเหลือ คำนวณตาม {COSTING_METHODS[activeMethod]}</p>
            </div>
            <Button
              variant="outline"
              className="bg-white/60 border-pink-300 text-pink-700 hover:bg-white h-9"
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
                <Label className="text-xs text-muted-foreground mb-1 block">ณ วันที่</Label>
                <ThaiDateInput value={asOfDate} onChange={setAsOfDate} dateEra={dateEra} dateFmt={dateFmt} className="w-44" data-testid="input-as-of-date" />
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

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Card className="border shadow-sm bg-sky-50">
            <CardContent className="p-4">
              <p className="text-xs text-sky-700/70">จำนวนรายการ</p>
              <p className="text-2xl font-bold text-sky-700" data-testid="text-total-items">
                {formatNumber(items.length)}
              </p>
              <p className="text-xs text-sky-700/70">รายการ</p>
            </CardContent>
          </Card>
          <Card className="border shadow-sm bg-emerald-50">
            <CardContent className="p-4">
              <p className="text-xs text-emerald-700/70">มูลค่ารวมทั้งหมด</p>
              <p className="text-2xl font-bold text-emerald-700 truncate" data-testid="text-total-value" title={`฿${formatCurrency(totalValue)}`}>
                ฿{formatCurrency(totalValue)}
              </p>
              <p className="text-xs text-emerald-700/70">บาท</p>
            </CardContent>
          </Card>
          <Card className="border shadow-sm bg-amber-50">
            <CardContent className="p-4">
              <p className="text-xs text-amber-700/70">วิธีคำนวณ</p>
              <p className="text-lg font-bold text-amber-700" data-testid="text-method">
                {COSTING_METHODS[activeMethod]}
              </p>
              <p className="text-xs text-amber-700/70">ณ {formatDate(appliedDate, dateEra, dateFmt)}</p>
            </CardContent>
          </Card>
        </div>

        <Card className="border shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Layers className="h-4 w-4 text-[#fec90f]" />
                รายการสินค้าคงเหลือ
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
                <p className="font-medium text-sm" data-testid="text-empty-state">ไม่พบข้อมูลสินค้าคงเหลือ</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="text-xs w-10 text-center">#</TableHead>
                      <TableHead className="text-xs">รหัส</TableHead>
                      <TableHead className="text-xs">ชื่อสินค้า</TableHead>
                      <TableHead className="text-xs">หมวด</TableHead>
                      <TableHead className="text-xs">หน่วย</TableHead>
                      <TableHead className="text-xs text-right">คงเหลือ</TableHead>
                      <TableHead className="text-xs text-right">ต้นทุน/หน่วย</TableHead>
                      <TableHead className="text-xs text-right">มูลค่ารวม</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, i) => (
                      <TableRow key={item.productId} data-testid={`row-valuation-${item.productId}`}>
                        <TableCell className="text-xs text-center text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="text-xs font-mono" data-testid={`text-code-${item.productId}`}>{item.productCode || "-"}</TableCell>
                        <TableCell className="text-xs font-medium" data-testid={`text-name-${item.productId}`}>{item.productName}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{item.category || "-"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{item.unit || "-"}</TableCell>
                        <TableCell className="text-xs text-right font-medium" data-testid={`text-qty-${item.productId}`}>{formatNumber(item.currentQty, 2)}</TableCell>
                        <TableCell className="text-xs text-right" data-testid={`text-unit-cost-${item.productId}`}>฿{formatCurrency(item.unitCost)}</TableCell>
                        <TableCell className="text-xs text-right font-semibold text-emerald-700" data-testid={`text-total-value-${item.productId}`}>฿{formatCurrency(item.totalValue)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-amber-50 border-t-2 border-amber-200">
                      <TableCell colSpan={7} className="text-xs font-bold text-right">รวมมูลค่าทั้งหมด</TableCell>
                      <TableCell className="text-sm text-right font-bold text-amber-700" data-testid="text-grand-total">
                        ฿{formatCurrency(totalValue)}
                      </TableCell>
                    </TableRow>
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