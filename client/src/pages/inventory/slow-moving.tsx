import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/lib/company-context";
import { formatDate } from "@/lib/format";
import {
  ArrowLeft, Printer, Download, Package, AlertTriangle, Clock, DollarSign, Layers
} from "lucide-react";
import { toLocalDateStr } from "@/lib/utils";

import { useDateSettings } from "@/hooks/use-date-settings";
const DAYS_OPTIONS = [
  { value: "7", label: "7 วัน" },
  { value: "14", label: "14 วัน" },
  { value: "30", label: "30 วัน" },
  { value: "60", label: "60 วัน" },
  { value: "90", label: "90 วัน" },
  { value: "180", label: "180 วัน" },
  { value: "365", label: "365 วัน" },
];

function formatCurrency(val: string | number | null | undefined): string {
  const n = parseFloat(String(val || "0"));
  if (n === 0) return "-";
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatNumber(val: string | number | null | undefined, decimals = 0): string {
  const n = parseFloat(String(val || "0"));
  return n.toLocaleString("th-TH", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function getDaysColor(days: number): { row: string; badge: string; badgeBg: string } {
  if (days > 180) return { row: "bg-red-50", badge: "text-red-700", badgeBg: "bg-red-100" };
  if (days > 90) return { row: "bg-orange-50", badge: "text-orange-700", badgeBg: "bg-orange-100" };
  if (days > 30) return { row: "bg-yellow-50", badge: "text-yellow-700", badgeBg: "bg-yellow-100" };
  return { row: "", badge: "text-slate-700", badgeBg: "bg-slate-100" };
}

interface SlowMovingItem {
  productId: number;
  productCode: string;
  productName: string;
  category: string;
  unit: string;
  currentQty: number;
  unitCost: number;
  totalValue: number;
  lastMovementDate: string | null;
  daysSinceLastMovement: number;
}

interface SlowMovingResponse {
  daysThreshold: number;
  items: SlowMovingItem[];
}

export default function SlowMovingPage(props: { Wrapper?: React.ComponentType<{ children: React.ReactNode }> } & Record<string, any>) {
  const LayoutComponent = props.Wrapper || Layout;
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [daysThreshold, setDaysThreshold] = useState("30");

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
  const { data, isLoading } = useQuery<SlowMovingResponse>({
    queryKey: ["/api/inventory-reports/slow-moving", companyId, daysThreshold],
    queryFn: async () => {
      const res = await fetch(
        `/api/inventory-reports/slow-moving?companyId=${companyId}&days=${daysThreshold}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!companyId,
  });

  const items = data?.items || [];
  const totalValueAtRisk = items.reduce((s, i) => s + (i.totalValue || 0), 0);

  const handlePrint = () => window.print();

  const handleExportCSV = () => {
    if (items.length === 0) return;
    const headers = ["ลำดับ", "รหัส", "ชื่อสินค้า", "หมวด", "หน่วย", "คงเหลือ", "มูลค่า", "เคลื่อนไหวล่าสุด", "จำนวนวัน"];
    const rows = items.map((item, i) => [
      String(i + 1),
      item.productCode || "",
      item.productName,
      item.category || "",
      item.unit || "",
      formatNumber(item.currentQty, 2),
      formatCurrency(item.totalValue),
      formatDate(item.lastMovementDate, dateEra, dateFmt),
      String(item.daysSinceLastMovement),
    ]);
    const BOM = "\uFEFF";
    const header1 = `สินค้าเคลื่อนไหวช้า (ไม่เคลื่อนไหวเกิน ${daysThreshold} วัน)`;
    const csvContent = BOM + [header1, headers.join(","), ...rows.map(r => r.map(c => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `slow_moving_${daysThreshold}days_${toLocalDateStr(new Date())}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: "ส่งออกสำเร็จ", description: `ส่งออก ${items.length} รายการ`, variant: "success" as any });
  };

  return (
    <LayoutComponent>
      <div className="space-y-4" data-testid="slow-moving-page">
        <div className="rounded-lg p-6 shadow-sm border print:shadow-none" style={{ background: "#ffedd5" }}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
                <AlertTriangle className="h-7 w-7" />
                สินค้าเคลื่อนไหวช้า
              </h1>
              <p className="mt-1 text-orange-800/60 text-sm">รายงานสินค้าที่ไม่มีการเคลื่อนไหวเกิน {daysThreshold} วัน</p>
            </div>
            <Button
              variant="outline"
              className="bg-white/60 border-orange-300 text-orange-700 hover:bg-white h-9"
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
                <Label className="text-xs text-muted-foreground mb-1 block">ไม่เคลื่อนไหวเกิน</Label>
                <Select value={daysThreshold} onValueChange={setDaysThreshold}>
                  <SelectTrigger className="h-9 text-sm w-44" data-testid="select-days-threshold">
                    <Clock className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
          <Card className="border shadow-sm bg-orange-50">
            <CardContent className="p-4">
              <p className="text-xs text-orange-700/70 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> สินค้าเคลื่อนไหวช้า</p>
              <p className="text-2xl font-bold text-orange-700" data-testid="text-total-slow-items">
                {formatNumber(items.length)}
              </p>
              <p className="text-xs text-orange-700/70">รายการ</p>
            </CardContent>
          </Card>
          <Card className="border shadow-sm bg-rose-50">
            <CardContent className="p-4">
              <p className="text-xs text-rose-700/70 flex items-center gap-1"><DollarSign className="h-3 w-3" /> มูลค่าเสี่ยง</p>
              <p className="text-2xl font-bold text-rose-700 truncate" data-testid="text-total-value-at-risk" title={`฿${formatCurrency(totalValueAtRisk)}`}>
                ฿{formatCurrency(totalValueAtRisk)}
              </p>
              <p className="text-xs text-rose-700/70">บาท</p>
            </CardContent>
          </Card>
          <Card className="border shadow-sm bg-amber-50">
            <CardContent className="p-4">
              <p className="text-xs text-amber-700/70">เกณฑ์</p>
              <p className="text-2xl font-bold text-amber-700" data-testid="text-threshold">
                {daysThreshold} วัน
              </p>
              <p className="text-xs text-amber-700/70">ไม่มีการเคลื่อนไหว</p>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap gap-2 text-xs print:hidden">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100 border border-red-300"></span> &gt;180 วัน (วิกฤต)</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-100 border border-orange-300"></span> &gt;90 วัน (เตือน)</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-100 border border-yellow-300"></span> &gt;30 วัน (สังเกต)</span>
        </div>

        <Card className="border shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Layers className="h-4 w-4 text-[#fec90f]" />
                รายการสินค้าเคลื่อนไหวช้า
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
                <p className="font-medium text-sm" data-testid="text-empty-state">ไม่พบสินค้าที่เคลื่อนไหวช้า</p>
                <p className="text-xs text-muted-foreground">สินค้าทั้งหมดมีการเคลื่อนไหวภายใน {daysThreshold} วัน</p>
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
                      <TableHead className="text-xs text-right">มูลค่า</TableHead>
                      <TableHead className="text-xs">เคลื่อนไหวล่าสุด</TableHead>
                      <TableHead className="text-xs text-right">จำนวนวัน</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, i) => {
                      const color = getDaysColor(item.daysSinceLastMovement);
                      return (
                        <TableRow key={item.productId} className={color.row} data-testid={`row-slow-${item.productId}`}>
                          <TableCell className="text-xs text-center text-muted-foreground">{i + 1}</TableCell>
                          <TableCell className="text-xs font-mono" data-testid={`text-code-${item.productId}`}>{item.productCode || "-"}</TableCell>
                          <TableCell className="text-xs font-medium" data-testid={`text-name-${item.productId}`}>{item.productName}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{item.category || "-"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{item.unit || "-"}</TableCell>
                          <TableCell className="text-xs text-right font-medium" data-testid={`text-qty-${item.productId}`}>{formatNumber(item.currentQty, 2)}</TableCell>
                          <TableCell className="text-xs text-right" data-testid={`text-value-${item.productId}`}>฿{formatCurrency(item.totalValue)}</TableCell>
                          <TableCell className="text-xs" data-testid={`text-last-movement-${item.productId}`}>{formatDate(item.lastMovementDate, dateEra, dateFmt)}</TableCell>
                          <TableCell className="text-xs text-right" data-testid={`text-days-${item.productId}`}>
                            <Badge variant="outline" className={`text-[10px] ${color.badge} ${color.badgeBg}`}>
                              {item.daysSinceLastMovement} วัน
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
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