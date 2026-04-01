import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import ThaiDateInput from "@/components/thai-date-input";
import { useDateSettings } from "@/hooks/use-date-settings";
import GasStationLayout from "@/components/gas-station-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Fuel, TrendingUp, Banknote, CreditCard, Wallet, QrCode, Gift, DollarSign, Droplets, CalendarDays } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

function fmt(n: number | string) {
  return Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const PAYMENT_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  cash: { label: "เงินสด", icon: Banknote, color: "#05b187" },
  transfer: { label: "เงินโอน", icon: Wallet, color: "#539BFF" },
  credit_card: { label: "บัตรเครดิต", icon: CreditCard, color: "#fb9678" },
  debit_card: { label: "บัตรเดบิต", icon: CreditCard, color: "#03c9d7" },
  qr_payment: { label: "QR Payment", icon: QrCode, color: "#8b5cf6" },
  fleet_card: { label: "Fleet Card", icon: CreditCard, color: "#f59e0b" },
  points: { label: "ตัดแต้ม", icon: Gift, color: "#ec4899" },
  credit: { label: "เชื่อ (AR)", icon: DollarSign, color: "#ef4444" },
};

const FUEL_COLORS = ["#05b187", "#539BFF", "#fb9678", "#03c9d7", "#fec90f", "#8b5cf6", "#f59e0b", "#ec4899"];

export default function GasStationDashboard() {
  const { selectedCompanyId } = useCompany();
  const { dateEra, dateFmt } = useDateSettings();
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = today.slice(0, 8) + "01";
  const [startDate, setStartDate] = useState(firstOfMonth);
  const [endDate, setEndDate] = useState(today);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/gas-station/dashboard", selectedCompanyId, startDate, endDate],
    queryFn: () => apiRequest("GET", `/api/gas-station/dashboard?companyId=${selectedCompanyId}&startDate=${startDate}&endDate=${endDate}`).then(r => r.json()),
    enabled: !!selectedCompanyId,
  });

  const { salesByProduct = [], salesByPayment = [], dailyTrend = [], products = [], tanks = [] } = data || {};

  const productMap: Record<number, any> = {};
  products.forEach((p: any) => { productMap[p.id] = p; });

  const grandTotalLiters = salesByProduct.reduce((s: number, r: any) => s + Number(r.totalLiters || 0), 0);
  const grandTotalAmount = salesByProduct.reduce((s: number, r: any) => s + Number(r.totalAmount || 0), 0);
  const paymentGrandTotal = salesByPayment.reduce((s: number, r: any) => s + Number(r.totalAmount || 0), 0);

  return (
    <GasStationLayout>
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
          <TrendingUp className="h-7 w-7 text-[#05b187]" />
          ภาพรวมปั๊มน้ำมัน
        </h1>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            <Label className="text-sm whitespace-nowrap">ตั้งแต่</Label>
            <ThaiDateInput value={startDate} onChange={setStartDate} dateEra={dateEra} dateFmt={dateFmt} className="w-[170px]" data-testid="input-start-date" />
          </div>
          <div className="flex items-center gap-1">
            <Label className="text-sm whitespace-nowrap">ถึง</Label>
            <ThaiDateInput value={endDate} onChange={setEndDate} dateEra={dateEra} dateFmt={dateFmt} className="w-[170px]" data-testid="input-end-date" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card data-testid="card-total-liters">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg" style={{ backgroundColor: "#05b18715" }}>
                <Droplets className="h-6 w-6 text-[#05b187]" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">ยอดขายรวม (ลิตร)</p>
                <p className="text-2xl font-bold">{fmt(grandTotalLiters)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-total-amount">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg" style={{ backgroundColor: "#539BFF15" }}>
                <Banknote className="h-6 w-6 text-[#539BFF]" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">ยอดขายรวม (บาท)</p>
                <p className="text-2xl font-bold">฿{fmt(grandTotalAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-total-tanks">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg" style={{ backgroundColor: "#fb967815" }}>
                <Fuel className="h-6 w-6 text-[#fb9678]" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">จำนวนถังน้ำมัน</p>
                <p className="text-2xl font-bold">{tanks.length} ถัง</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card data-testid="card-sales-by-product">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Fuel className="h-5 w-5 text-[#05b187]" />
              ยอดขายแยกตามชนิดน้ำมัน
            </CardTitle>
          </CardHeader>
          <CardContent>
            {salesByProduct.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Fuel className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p>ยังไม่มีข้อมูลยอดขายในช่วงเวลานี้</p>
              </div>
            ) : (
              <div className="space-y-3">
                {salesByProduct.map((row: any, idx: number) => {
                  const product = productMap[row.fuelProductId];
                  const pct = grandTotalAmount > 0 ? (Number(row.totalAmount) / grandTotalAmount) * 100 : 0;
                  const color = FUEL_COLORS[idx % FUEL_COLORS.length];
                  return (
                    <div key={row.fuelProductId} className="space-y-1" data-testid={`product-row-${row.fuelProductId}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                          <span className="font-medium text-sm">{product?.name || `สินค้า #${row.fuelProductId}`}</span>
                        </div>
                        <span className="font-semibold text-sm">฿{fmt(row.totalAmount)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-2.5">
                          <div className="h-2.5 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                        </div>
                        <span className="text-xs text-muted-foreground w-[80px] text-right">{fmt(row.totalLiters)} ลิตร</span>
                      </div>
                    </div>
                  );
                })}
                <div className="pt-2 border-t flex justify-between font-semibold text-sm">
                  <span>รวมทั้งหมด</span>
                  <span>฿{fmt(grandTotalAmount)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-sales-by-payment">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Banknote className="h-5 w-5 text-[#05b187]" />
              ยอดรับเงินแยกตามช่องทาง
            </CardTitle>
          </CardHeader>
          <CardContent>
            {salesByPayment.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Banknote className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p>ยังไม่มีข้อมูลการรับเงินในช่วงเวลานี้</p>
              </div>
            ) : (
              <div className="space-y-3">
                {salesByPayment.map((row: any) => {
                  const pm = PAYMENT_LABELS[row.paymentMethod] || { label: row.paymentMethod, icon: DollarSign, color: "#94a3b8" };
                  const Icon = pm.icon;
                  const pct = paymentGrandTotal > 0 ? (Number(row.totalAmount) / paymentGrandTotal) * 100 : 0;
                  return (
                    <div key={row.paymentMethod} className="space-y-1" data-testid={`payment-row-${row.paymentMethod}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-md" style={{ backgroundColor: pm.color + "18" }}>
                            <Icon className="h-4 w-4" style={{ color: pm.color }} />
                          </div>
                          <span className="font-medium text-sm">{pm.label}</span>
                          <Badge variant="outline" className="text-xs">{Number(row.count)} รายการ</Badge>
                        </div>
                        <span className="font-semibold text-sm">฿{fmt(row.totalAmount)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-2.5">
                          <div className="h-2.5 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: pm.color }} />
                        </div>
                        <span className="text-xs text-muted-foreground w-[50px] text-right">{pct.toFixed(1)}%</span>
                      </div>
                    </div>
                  );
                })}
                <div className="pt-2 border-t flex justify-between font-semibold text-sm">
                  <span>รวมทั้งหมด</span>
                  <span>฿{fmt(paymentGrandTotal)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {dailyTrend.length > 0 && (
        <Card data-testid="card-daily-trend">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-[#05b187]" />
              ยอดขายรายวัน
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">วันที่</TableHead>
                    <TableHead className="text-right">ลิตร</TableHead>
                    <TableHead className="text-right">ยอดขาย (บาท)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dailyTrend.map((row: any) => {
                    const d = new Date(row.saleDate);
                    const thaiDate = `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth()+1).toString().padStart(2, "0")}/${d.getFullYear() + 543}`;
                    return (
                      <TableRow key={row.saleDate} data-testid={`trend-row-${row.saleDate}`}>
                        <TableCell className="font-medium">{thaiDate}</TableCell>
                        <TableCell className="text-right">{fmt(row.totalLiters)}</TableCell>
                        <TableCell className="text-right font-semibold">฿{fmt(row.totalAmount)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {tanks.length > 0 && (
        <Card data-testid="card-tank-status">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Droplets className="h-5 w-5 text-[#05b187]" />
              สถานะถังน้ำมัน
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {tanks.map((tank: any, idx: number) => {
                const current = Number(tank.currentVolume || 0);
                const capacity = Number(tank.capacity || 1);
                const pct = Math.min((current / capacity) * 100, 100);
                const color = pct < 20 ? "#ef4444" : pct < 50 ? "#fec90f" : "#05b187";
                const product = productMap[tank.fuelProductId];
                return (
                  <div key={tank.id} className="border rounded-lg p-3 space-y-2" data-testid={`tank-card-${tank.id}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{tank.name}</span>
                      <Badge variant="outline" className="text-xs">{product?.name || "-"}</Badge>
                    </div>
                    <div className="bg-gray-100 rounded-full h-3">
                      <div className="h-3 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{fmt(current)} ลิตร</span>
                      <span>{pct.toFixed(0)}% ของ {fmt(capacity)} ลิตร</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
    </GasStationLayout>
  );
}
