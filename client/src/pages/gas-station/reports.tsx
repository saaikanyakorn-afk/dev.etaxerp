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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BarChart3, Fuel, TrendingDown, Landmark, Printer } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

function fmt(n: number | string) {
  return Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function GasStationReports() {
  const { selectedCompanyId } = useCompany();
  const { dateEra, dateFmt } = useDateSettings();
  const [activeTab, setActiveTab] = useState("sales-summary");
  const today = new Date();
  const [startDate, setStartDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(today.toISOString().slice(0, 10));

  const { data: products = [] } = useQuery({
    queryKey: ["/api/gas-station/fuel-products", selectedCompanyId],
    queryFn: () => apiRequest("GET", `/api/gas-station/fuel-products?companyId=${selectedCompanyId}`).then(r => r.json()),
    enabled: !!selectedCompanyId,
  });

  const { data: tanks = [] } = useQuery({
    queryKey: ["/api/gas-station/fuel-tanks", selectedCompanyId],
    queryFn: () => apiRequest("GET", `/api/gas-station/fuel-tanks?companyId=${selectedCompanyId}`).then(r => r.json()),
    enabled: !!selectedCompanyId,
  });

  const { data: salesData = [] } = useQuery({
    queryKey: ["/api/gas-station/daily-sales/summary", selectedCompanyId, startDate, endDate],
    queryFn: () => apiRequest("GET", `/api/gas-station/daily-sales/summary?companyId=${selectedCompanyId}&startDate=${startDate}&endDate=${endDate}`).then(r => r.json()),
    enabled: !!selectedCompanyId,
  });

  const { data: dippings = [] } = useQuery({
    queryKey: ["/api/gas-station/tank-dippings", selectedCompanyId, startDate, endDate],
    queryFn: () => apiRequest("GET", `/api/gas-station/tank-dippings?companyId=${selectedCompanyId}&startDate=${startDate}&endDate=${endDate}`).then(r => r.json()),
    enabled: !!selectedCompanyId,
  });

  const { data: taxRecords = [] } = useQuery({
    queryKey: ["/api/gas-station/local-tax", selectedCompanyId],
    queryFn: () => apiRequest("GET", `/api/gas-station/local-tax?companyId=${selectedCompanyId}`).then(r => r.json()),
    enabled: !!selectedCompanyId,
  });

  const salesByProduct = new Map<number, { name: string; liters: number; amount: number; days: number }>();
  salesData.forEach((s: any) => {
    const existing = salesByProduct.get(s.fuelProductId) || { name: products.find((p: any) => p.id === s.fuelProductId)?.nameTh || "-", liters: 0, amount: 0, days: 0 };
    existing.liters += Number(s.totalLiters || 0);
    existing.amount += Number(s.totalAmount || 0);
    existing.days += 1;
    salesByProduct.set(s.fuelProductId, existing);
  });

  const totalSalesLiters = Array.from(salesByProduct.values()).reduce((s, v) => s + v.liters, 0);
  const totalSalesAmount = Array.from(salesByProduct.values()).reduce((s, v) => s + v.amount, 0);

  return (
    <GasStationLayout>
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
          <BarChart3 className="h-7 w-7 text-[#fb9678]" />
          รายงานปั๊มน้ำมัน
        </h1>
        <div className="flex items-center gap-2">
          <Label className="text-sm whitespace-nowrap">ช่วงเวลา:</Label>
          <ThaiDateInput value={startDate} onChange={setStartDate} dateEra={dateEra} dateFmt={dateFmt} className="w-[170px]" data-testid="input-start-date" />
          <span>—</span>
          <ThaiDateInput value={endDate} onChange={setEndDate} dateEra={dateEra} dateFmt={dateFmt} className="w-[170px]" data-testid="input-end-date" />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="sales-summary" className="flex items-center gap-1.5" data-testid="tab-sales-summary">
            <Fuel className="h-4 w-4" /> สรุปยอดขาย
          </TabsTrigger>
          <TabsTrigger value="loss-gain" className="flex items-center gap-1.5" data-testid="tab-loss-gain-report">
            <TrendingDown className="h-4 w-4" /> Loss/Gain
          </TabsTrigger>
          <TabsTrigger value="tax-summary" className="flex items-center gap-1.5" data-testid="tab-tax-summary">
            <Landmark className="h-4 w-4" /> ภาษีท้องถิ่น
          </TabsTrigger>
        </TabsList>

        {/* ===== SALES SUMMARY ===== */}
        <TabsContent value="sales-summary">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-lg">สรุปยอดขายน้ำมันตามชนิด</CardTitle>
              <Button variant="outline" size="sm" onClick={() => window.print()} data-testid="btn-print-sales"><Printer className="h-4 w-4 mr-1" />พิมพ์</Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow style={{ background: "var(--theme-table-header)" }}>
                    <TableHead className="text-white font-bold">ชนิดน้ำมัน</TableHead>
                    <TableHead className="text-white font-bold text-right">ลิตรรวม</TableHead>
                    <TableHead className="text-white font-bold text-right">ยอดเงินรวม</TableHead>
                    <TableHead className="text-white font-bold text-right">เฉลี่ย/วัน (ล.)</TableHead>
                    <TableHead className="text-white font-bold text-right">% สัดส่วน</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salesByProduct.size === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">ยังไม่มีข้อมูลยอดขาย</TableCell></TableRow>
                  ) : Array.from(salesByProduct.entries()).map(([id, v]) => (
                    <TableRow key={id}>
                      <TableCell className="font-medium">{v.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(v.liters)}</TableCell>
                      <TableCell className="text-right tabular-nums font-bold">{fmt(v.amount)}</TableCell>
                      <TableCell className="text-right tabular-nums">{v.days > 0 ? fmt(v.liters / v.days) : "-"}</TableCell>
                      <TableCell className="text-right tabular-nums">{totalSalesLiters > 0 ? (v.liters / totalSalesLiters * 100).toFixed(1) + "%" : "-"}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-gray-50 border-t-2 font-bold">
                    <TableCell>รวมทั้งหมด</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(totalSalesLiters)}</TableCell>
                    <TableCell className="text-right tabular-nums text-lg">{fmt(totalSalesAmount)}</TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-right">100%</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== LOSS/GAIN REPORT ===== */}
        <TabsContent value="loss-gain">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">สรุป Oil Loss/Gain ตามถัง</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow style={{ background: "var(--theme-table-header)" }}>
                    <TableHead className="text-white font-bold">ถัง</TableHead>
                    <TableHead className="text-white font-bold">ชนิดน้ำมัน</TableHead>
                    <TableHead className="text-white font-bold text-center">จุ่มถัง</TableHead>
                    <TableHead className="text-white font-bold text-right">ผลต่างรวม (ล.)</TableHead>
                    <TableHead className="text-white font-bold text-center">สถานะ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tanks.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">ยังไม่มีข้อมูล</TableCell></TableRow>
                  ) : tanks.map((tank: any) => {
                    const tankDips = dippings.filter((d: any) => d.tankId === tank.id);
                    const totalDiff = tankDips.reduce((s: number, d: any) => s + Number(d.difference || 0), 0);
                    return (
                      <TableRow key={tank.id}>
                        <TableCell className="font-medium">{tank.name}</TableCell>
                        <TableCell>{products.find((p: any) => p.id === tank.fuelProductId)?.nameTh || "-"}</TableCell>
                        <TableCell className="text-center tabular-nums">{tankDips.length}</TableCell>
                        <TableCell className={`text-right tabular-nums font-bold ${totalDiff < 0 ? "text-red-600" : totalDiff > 0 ? "text-green-600" : ""}`}>
                          {totalDiff > 0 ? "+" : ""}{fmt(totalDiff)}
                        </TableCell>
                        <TableCell className="text-center">
                          {totalDiff < 0 ? <Badge variant="destructive">Loss</Badge> : totalDiff > 0 ? <Badge className="bg-green-600">Gain</Badge> : <Badge variant="secondary">ปกติ</Badge>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== TAX SUMMARY ===== */}
        <TabsContent value="tax-summary">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">สรุปภาษีท้องถิ่น</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow style={{ background: "var(--theme-table-header)" }}>
                    <TableHead className="text-white font-bold">งวด</TableHead>
                    <TableHead className="text-white font-bold">ประเภท</TableHead>
                    <TableHead className="text-white font-bold">หน่วยงาน</TableHead>
                    <TableHead className="text-white font-bold text-right">ภาษี</TableHead>
                    <TableHead className="text-white font-bold text-right">เงินเพิ่ม</TableHead>
                    <TableHead className="text-white font-bold text-right">รวมจ่าย</TableHead>
                    <TableHead className="text-white font-bold text-center">สถานะ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {taxRecords.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">ยังไม่มีข้อมูล</TableCell></TableRow>
                  ) : taxRecords.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.taxPeriod}</TableCell>
                      <TableCell>{r.taxType === "municipal" ? "เทศบาล" : r.taxType === "sao" ? "อบต." : r.taxType}</TableCell>
                      <TableCell>{r.localAuthority || "-"}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(r.taxAmount)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(r.surcharge)}</TableCell>
                      <TableCell className="text-right tabular-nums font-bold">{fmt(r.totalPayable)}</TableCell>
                      <TableCell className="text-center">
                        <Badge className={r.status === "paid" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}>
                          {r.status === "paid" ? "ชำระแล้ว" : "รอชำระ"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {taxRecords.length > 0 && (
                    <TableRow className="bg-gray-50 border-t-2 font-bold">
                      <TableCell colSpan={3} className="text-right">รวม</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(taxRecords.reduce((s: number, r: any) => s + Number(r.taxAmount || 0), 0))}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(taxRecords.reduce((s: number, r: any) => s + Number(r.surcharge || 0), 0))}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(taxRecords.reduce((s: number, r: any) => s + Number(r.totalPayable || 0), 0))}</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
    </GasStationLayout>
  );
}
