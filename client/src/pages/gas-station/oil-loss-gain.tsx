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
import { TrendingDown, TrendingUp, Activity } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

function fmt(n: number | string) {
  return Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function OilLossGain() {
  const { selectedCompanyId } = useCompany();
  const { dateEra, dateFmt } = useDateSettings();
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

  const { data: dippings = [] } = useQuery({
    queryKey: ["/api/gas-station/tank-dippings", selectedCompanyId, startDate, endDate],
    queryFn: () => apiRequest("GET", `/api/gas-station/tank-dippings?companyId=${selectedCompanyId}&startDate=${startDate}&endDate=${endDate}`).then(r => r.json()),
    enabled: !!selectedCompanyId,
  });

  const tankSummary = tanks.map((tank: any) => {
    const fuelName = products.find((p: any) => p.id === tank.fuelProductId)?.nameTh || "-";
    const unitPrice = Number(products.find((p: any) => p.id === tank.fuelProductId)?.unitPrice || 0);
    const tankDips = dippings.filter((d: any) => d.tankId === tank.id);
    const totalDiff = tankDips.reduce((s: number, d: any) => s + Number(d.difference || 0), 0);
    const dipCount = tankDips.length;
    return {
      ...tank,
      fuelName,
      unitPrice,
      totalDiff,
      lossAmount: totalDiff < 0 ? Math.abs(totalDiff) * unitPrice : 0,
      gainAmount: totalDiff > 0 ? totalDiff * unitPrice : 0,
      dipCount,
    };
  });

  const totalLoss = tankSummary.reduce((s, t) => s + (t.totalDiff < 0 ? Math.abs(t.totalDiff) : 0), 0);
  const totalGain = tankSummary.reduce((s, t) => s + (t.totalDiff > 0 ? t.totalDiff : 0), 0);
  const totalLossAmt = tankSummary.reduce((s, t) => s + t.lossAmount, 0);
  const totalGainAmt = tankSummary.reduce((s, t) => s + t.gainAmount, 0);

  return (
    <GasStationLayout>
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
          <Activity className="h-7 w-7 text-[#fb9678]" />
          Oil Loss/Gain — การสูญเสียน้ำมัน
        </h1>
        <div className="flex items-center gap-2">
          <Label className="text-sm whitespace-nowrap">ช่วงเวลา:</Label>
          <ThaiDateInput value={startDate} onChange={setStartDate} dateEra={dateEra} dateFmt={dateFmt} className="w-[170px]" data-testid="input-start-date" />
          <span>—</span>
          <ThaiDateInput value={endDate} onChange={setEndDate} dateEra={dateEra} dateFmt={dateFmt} className="w-[170px]" data-testid="input-end-date" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-red-200 bg-red-50/30">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-red-700">น้ำมันสูญเสีย (Loss)</span>
              <TrendingDown className="h-4 w-4 text-red-500" />
            </div>
            <div className="text-xl font-bold text-red-700 tabular-nums">{fmt(totalLoss)} ลิตร</div>
            <div className="text-xs text-red-500 tabular-nums">มูลค่า: ฿{fmt(totalLossAmt)}</div>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50/30">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-green-700">น้ำมันเกิน (Gain)</span>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </div>
            <div className="text-xl font-bold text-green-700 tabular-nums">{fmt(totalGain)} ลิตร</div>
            <div className="text-xs text-green-500 tabular-nums">มูลค่า: ฿{fmt(totalGainAmt)}</div>
          </CardContent>
        </Card>
        <Card className="border-blue-200 bg-blue-50/30">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-blue-700">ผลต่างสุทธิ</span>
              <Activity className="h-4 w-4 text-blue-500" />
            </div>
            <div className={`text-xl font-bold tabular-nums ${(totalGain - totalLoss) < 0 ? "text-red-700" : "text-green-700"}`}>
              {(totalGain - totalLoss) > 0 ? "+" : ""}{fmt(totalGain - totalLoss)} ลิตร
            </div>
            <div className="text-xs text-muted-foreground tabular-nums">มูลค่า: ฿{fmt(totalGainAmt - totalLossAmt)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium">จำนวนครั้งจุ่มถัง</span>
            </div>
            <div className="text-xl font-bold tabular-nums">{dippings.length} ครั้ง</div>
            <div className="text-xs text-muted-foreground">{tanks.length} ถัง</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">สรุป Loss/Gain รายถัง</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow style={{ background: "var(--theme-table-header)" }}>
                <TableHead className="text-white font-bold">ถัง</TableHead>
                <TableHead className="text-white font-bold">ชนิดน้ำมัน</TableHead>
                <TableHead className="text-white font-bold text-center">จุ่มถัง (ครั้ง)</TableHead>
                <TableHead className="text-white font-bold text-right">ผลต่างรวม (ล.)</TableHead>
                <TableHead className="text-white font-bold text-right">มูลค่า Loss</TableHead>
                <TableHead className="text-white font-bold text-right">มูลค่า Gain</TableHead>
                <TableHead className="text-white font-bold text-center">สถานะ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tankSummary.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">ยังไม่มีข้อมูล</TableCell></TableRow>
              ) : tankSummary.map((t: any) => (
                <TableRow key={t.id} data-testid={`row-loss-gain-${t.id}`}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell>{t.fuelName}</TableCell>
                  <TableCell className="text-center tabular-nums">{t.dipCount}</TableCell>
                  <TableCell className={`text-right tabular-nums font-bold ${t.totalDiff < 0 ? "text-red-600" : t.totalDiff > 0 ? "text-green-600" : ""}`}>
                    {t.totalDiff > 0 ? "+" : ""}{fmt(t.totalDiff)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-red-600">{t.lossAmount > 0 ? fmt(t.lossAmount) : "-"}</TableCell>
                  <TableCell className="text-right tabular-nums text-green-600">{t.gainAmount > 0 ? fmt(t.gainAmount) : "-"}</TableCell>
                  <TableCell className="text-center">
                    {t.totalDiff < 0 ? <Badge variant="destructive">Loss</Badge> : t.totalDiff > 0 ? <Badge className="bg-green-600">Gain</Badge> : <Badge variant="secondary">ปกติ</Badge>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
    </GasStationLayout>
  );
}
