import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import ThaiDateInput from "@/components/thai-date-input";
import { useDateSettings } from "@/hooks/use-date-settings";
import GasStationLayout from "@/components/gas-station-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Truck, Droplets, Container, Thermometer } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

function fmt(n: number | string) {
  return Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function FuelStock() {
  const { selectedCompanyId } = useCompany();
  const { toast } = useToast();
  const { dateEra, dateFmt } = useDateSettings();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("receiving");
  const [showReceiveForm, setShowReceiveForm] = useState(false);
  const [showDipForm, setShowDipForm] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

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

  const { data: receivings = [] } = useQuery({
    queryKey: ["/api/gas-station/fuel-receivings", selectedCompanyId],
    queryFn: () => apiRequest("GET", `/api/gas-station/fuel-receivings?companyId=${selectedCompanyId}`).then(r => r.json()),
    enabled: !!selectedCompanyId,
  });

  const { data: dippings = [] } = useQuery({
    queryKey: ["/api/gas-station/tank-dippings", selectedCompanyId],
    queryFn: () => apiRequest("GET", `/api/gas-station/tank-dippings?companyId=${selectedCompanyId}`).then(r => r.json()),
    enabled: !!selectedCompanyId,
  });

  const [receiveForm, setReceiveForm] = useState({
    receiveDate: today, tankId: "", fuelProductId: "", supplierName: "",
    documentNo: "", volumeReceived: "", unitCost: "", notes: "",
  });

  const [dipForm, setDipForm] = useState({
    dipDate: today, tankId: "", measuredVolume: "", temperature: "", waterLevel: "", notes: "",
  });

  const saveReceiving = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/gas-station/fuel-receivings?companyId=${selectedCompanyId}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/gas-station/fuel-receivings"] });
      qc.invalidateQueries({ queryKey: ["/api/gas-station/fuel-tanks"] });
      setShowReceiveForm(false);
      toast({ title: "บันทึกรับน้ำมันสำเร็จ" });
    },
  });

  const saveDipping = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/gas-station/tank-dippings?companyId=${selectedCompanyId}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/gas-station/tank-dippings"] });
      setShowDipForm(false);
      toast({ title: "บันทึกจุ่มถังสำเร็จ" });
    },
  });

  const selectedTankForReceive = tanks.find((t: any) => t.id === Number(receiveForm.tankId));

  return (
    <GasStationLayout>
    <div className="space-y-4">
      <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
        <Container className="h-7 w-7 text-[#fb9678]" />
        สต็อกน้ำมัน
      </h1>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="receiving" className="flex items-center gap-1.5" data-testid="tab-receiving">
            <Truck className="h-4 w-4" /> รับน้ำมัน ({receivings.length})
          </TabsTrigger>
          <TabsTrigger value="dipping" className="flex items-center gap-1.5" data-testid="tab-dipping">
            <Droplets className="h-4 w-4" /> จุ่มถัง ({dippings.length})
          </TabsTrigger>
          <TabsTrigger value="stock" className="flex items-center gap-1.5" data-testid="tab-stock">
            <Container className="h-4 w-4" /> ยอดคงเหลือ
          </TabsTrigger>
        </TabsList>

        {/* ===== RECEIVING ===== */}
        <TabsContent value="receiving">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-lg">ประวัติรับน้ำมันเข้าถัง</CardTitle>
              <Button size="sm" onClick={() => { setReceiveForm({ receiveDate: today, tankId: "", fuelProductId: "", supplierName: "", documentNo: "", volumeReceived: "", unitCost: "", notes: "" }); setShowReceiveForm(true); }} data-testid="btn-add-receiving">
                <Plus className="h-4 w-4 mr-1" /> รับน้ำมัน
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow style={{ background: "var(--theme-table-header)" }}>
                    <TableHead className="text-white font-bold">วันที่</TableHead>
                    <TableHead className="text-white font-bold">เลขเอกสาร</TableHead>
                    <TableHead className="text-white font-bold">ถัง</TableHead>
                    <TableHead className="text-white font-bold">ชนิดน้ำมัน</TableHead>
                    <TableHead className="text-white font-bold">ผู้จัดส่ง</TableHead>
                    <TableHead className="text-white font-bold text-right">ปริมาณ (ล.)</TableHead>
                    <TableHead className="text-white font-bold text-right">ราคา/ลิตร</TableHead>
                    <TableHead className="text-white font-bold text-right">มูลค่ารวม</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receivings.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">ยังไม่มีรายการรับน้ำมัน</TableCell></TableRow>
                  ) : receivings.map((r: any) => (
                    <TableRow key={r.id} data-testid={`row-receiving-${r.id}`}>
                      <TableCell className="tabular-nums">{r.receiveDate}</TableCell>
                      <TableCell className="font-mono">{r.documentNo || "-"}</TableCell>
                      <TableCell>{tanks.find((t: any) => t.id === r.tankId)?.name || "-"}</TableCell>
                      <TableCell>{products.find((p: any) => p.id === r.fuelProductId)?.nameTh || "-"}</TableCell>
                      <TableCell>{r.supplierName || "-"}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{fmt(r.volumeReceived)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(r.unitCost)}</TableCell>
                      <TableCell className="text-right tabular-nums font-bold">{fmt(r.totalCost)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== DIPPING ===== */}
        <TabsContent value="dipping">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-lg">ประวัติจุ่มถัง (Tank Dipping)</CardTitle>
              <Button size="sm" onClick={() => { setDipForm({ dipDate: today, tankId: "", measuredVolume: "", temperature: "", waterLevel: "", notes: "" }); setShowDipForm(true); }} data-testid="btn-add-dipping">
                <Plus className="h-4 w-4 mr-1" /> จุ่มถัง
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow style={{ background: "var(--theme-table-header)" }}>
                    <TableHead className="text-white font-bold">วันที่</TableHead>
                    <TableHead className="text-white font-bold">ถัง</TableHead>
                    <TableHead className="text-white font-bold">ชนิดน้ำมัน</TableHead>
                    <TableHead className="text-white font-bold text-right">วัดได้ (ล.)</TableHead>
                    <TableHead className="text-white font-bold text-right">ตามบัญชี (ล.)</TableHead>
                    <TableHead className="text-white font-bold text-right">ผลต่าง</TableHead>
                    <TableHead className="text-white font-bold text-right">อุณหภูมิ°C</TableHead>
                    <TableHead className="text-white font-bold text-right">ระดับน้ำ</TableHead>
                    <TableHead className="text-white font-bold">หมายเหตุ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dippings.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">ยังไม่มีรายการจุ่มถัง</TableCell></TableRow>
                  ) : dippings.map((d: any) => {
                    const diff = Number(d.difference || 0);
                    return (
                      <TableRow key={d.id} data-testid={`row-dipping-${d.id}`}>
                        <TableCell className="tabular-nums">{d.dipDate}</TableCell>
                        <TableCell>{tanks.find((t: any) => t.id === d.tankId)?.name || "-"}</TableCell>
                        <TableCell>{products.find((p: any) => p.id === d.fuelProductId)?.nameTh || "-"}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmt(d.measuredVolume)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmt(d.bookVolume)}</TableCell>
                        <TableCell className={`text-right tabular-nums font-bold ${diff < 0 ? "text-red-600" : diff > 0 ? "text-green-600" : ""}`}>
                          {diff > 0 ? "+" : ""}{fmt(diff)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{d.temperature || "-"}</TableCell>
                        <TableCell className="text-right tabular-nums">{d.waterLevel || "-"}</TableCell>
                        <TableCell className="text-xs">{d.notes || "-"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== STOCK OVERVIEW ===== */}
        <TabsContent value="stock">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tanks.length === 0 ? (
              <Card className="col-span-full"><CardContent className="py-8 text-center text-muted-foreground">ยังไม่มีถังน้ำมัน</CardContent></Card>
            ) : tanks.map((tank: any) => {
              const pct = Number(tank.capacity) > 0 ? (Number(tank.currentVolume) / Number(tank.capacity) * 100) : 0;
              const fuelName = products.find((p: any) => p.id === tank.fuelProductId)?.nameTh || "-";
              const color = pct > 75 ? "#05b187" : pct > 30 ? "#fec90f" : "#f94d4d";
              return (
                <Card key={tank.id} className="border-2" data-testid={`card-stock-${tank.id}`}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Container className="h-5 w-5" style={{ color }} />
                        {tank.name}
                      </span>
                      <Badge variant="outline">{fuelName}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="h-32 bg-gray-100 rounded-lg flex items-end overflow-hidden relative">
                        <div className="w-full rounded-b-lg transition-all duration-500" style={{ height: `${Math.min(pct, 100)}%`, background: `linear-gradient(180deg, ${color}88, ${color})` }} />
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-2xl font-bold">{pct.toFixed(0)}%</span>
                          <span className="text-xs text-muted-foreground">{fmt(tank.currentVolume)} / {fmt(tank.capacity)} ล.</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="bg-gray-50 p-2 rounded text-center">
                          <div className="text-xs text-muted-foreground">คงเหลือ</div>
                          <div className="font-bold tabular-nums">{fmt(tank.currentVolume)}</div>
                        </div>
                        <div className="bg-gray-50 p-2 rounded text-center">
                          <div className="text-xs text-muted-foreground">ว่าง</div>
                          <div className="font-bold tabular-nums">{fmt(Number(tank.capacity) - Number(tank.currentVolume))}</div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Receive Fuel Dialog */}
      <Dialog open={showReceiveForm} onOpenChange={setShowReceiveForm}>
        <DialogContent className="max-w-[500px]">
          <DialogHeader><DialogTitle>รับน้ำมันเข้าถัง</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>วันที่รับ</Label><ThaiDateInput value={receiveForm.receiveDate} onChange={(v: string) => setReceiveForm(f => ({ ...f, receiveDate: v }))} dateEra={dateEra} dateFmt={dateFmt} data-testid="input-receive-date" /></div>
              <div><Label>เลขเอกสาร</Label><Input value={receiveForm.documentNo} onChange={e => setReceiveForm(f => ({ ...f, documentNo: e.target.value }))} data-testid="input-receive-doc-no" /></div>
            </div>
            <div><Label>ถังที่รับ</Label>
              <Select value={receiveForm.tankId} onValueChange={v => {
                const tank = tanks.find((t: any) => t.id === Number(v));
                setReceiveForm(f => ({ ...f, tankId: v, fuelProductId: tank?.fuelProductId ? String(tank.fuelProductId) : "" }));
              }}>
                <SelectTrigger data-testid="select-receive-tank"><SelectValue placeholder="เลือกถัง" /></SelectTrigger>
                <SelectContent>{tanks.map((t: any) => <SelectItem key={t.id} value={String(t.id)}>{t.name} ({products.find((p: any) => p.id === t.fuelProductId)?.nameTh || "-"})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>ผู้จัดส่ง</Label><Input value={receiveForm.supplierName} onChange={e => setReceiveForm(f => ({ ...f, supplierName: e.target.value }))} placeholder="เช่น ปตท., บางจาก" data-testid="input-supplier" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>ปริมาณ (ลิตร)</Label><Input type="number" step="0.01" value={receiveForm.volumeReceived} onChange={e => setReceiveForm(f => ({ ...f, volumeReceived: e.target.value }))} data-testid="input-volume-received" /></div>
              <div><Label>ราคา/ลิตร</Label><Input type="number" step="0.0001" value={receiveForm.unitCost} onChange={e => setReceiveForm(f => ({ ...f, unitCost: e.target.value }))} data-testid="input-unit-cost" /></div>
            </div>
            {selectedTankForReceive && (
              <div className="bg-blue-50 p-3 rounded text-sm">
                <span className="text-muted-foreground">ปัจจุบันในถัง:</span> <strong className="tabular-nums">{fmt(selectedTankForReceive.currentVolume)}</strong> ลิตร
                → หลังรับ: <strong className="tabular-nums">{fmt(Number(selectedTankForReceive.currentVolume) + Number(receiveForm.volumeReceived || 0))}</strong> ลิตร
              </div>
            )}
            <div><Label>หมายเหตุ</Label><Textarea value={receiveForm.notes} onChange={e => setReceiveForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
            <Button className="w-full" onClick={() => saveReceiving.mutate({
              ...receiveForm,
              tankId: Number(receiveForm.tankId),
              fuelProductId: Number(receiveForm.fuelProductId),
              totalCost: String((Number(receiveForm.volumeReceived) * Number(receiveForm.unitCost)).toFixed(2)),
              companyId: selectedCompanyId,
            })} disabled={saveReceiving.isPending} data-testid="btn-save-receiving">
              {saveReceiving.isPending ? "กำลังบันทึก..." : "บันทึกรับน้ำมัน"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Tank Dipping Dialog */}
      <Dialog open={showDipForm} onOpenChange={setShowDipForm}>
        <DialogContent className="max-w-[450px]">
          <DialogHeader><DialogTitle>จุ่มถังน้ำมัน (Tank Dipping)</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>วันที่จุ่ม</Label><ThaiDateInput value={dipForm.dipDate} onChange={(v: string) => setDipForm(f => ({ ...f, dipDate: v }))} dateEra={dateEra} dateFmt={dateFmt} data-testid="input-dip-date" /></div>
            <div><Label>ถัง</Label>
              <Select value={dipForm.tankId} onValueChange={v => setDipForm(f => ({ ...f, tankId: v }))}>
                <SelectTrigger data-testid="select-dip-tank"><SelectValue placeholder="เลือกถัง" /></SelectTrigger>
                <SelectContent>{tanks.map((t: any) => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>ปริมาณที่วัดได้จริง (ลิตร)</Label><Input type="number" step="0.01" value={dipForm.measuredVolume} onChange={e => setDipForm(f => ({ ...f, measuredVolume: e.target.value }))} data-testid="input-measured-volume" /></div>
            {dipForm.tankId && (
              <div className="bg-blue-50 p-3 rounded text-sm">
                <span className="text-muted-foreground">ตามบัญชี:</span> <strong className="tabular-nums">{fmt(tanks.find((t: any) => t.id === Number(dipForm.tankId))?.currentVolume || 0)}</strong> ลิตร
                <br />
                <span className="text-muted-foreground">ผลต่าง:</span> <strong className={`tabular-nums ${Number(dipForm.measuredVolume || 0) - Number(tanks.find((t: any) => t.id === Number(dipForm.tankId))?.currentVolume || 0) < 0 ? "text-red-600" : "text-green-600"}`}>
                  {fmt(Number(dipForm.measuredVolume || 0) - Number(tanks.find((t: any) => t.id === Number(dipForm.tankId))?.currentVolume || 0))}
                </strong> ลิตร
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div><Label>อุณหภูมิ (°C)</Label><Input type="number" step="0.1" value={dipForm.temperature} onChange={e => setDipForm(f => ({ ...f, temperature: e.target.value }))} data-testid="input-temperature" /></div>
              <div><Label>ระดับน้ำ (มม.)</Label><Input type="number" step="0.01" value={dipForm.waterLevel} onChange={e => setDipForm(f => ({ ...f, waterLevel: e.target.value }))} data-testid="input-water-level" /></div>
            </div>
            <div><Label>หมายเหตุ</Label><Textarea value={dipForm.notes} onChange={e => setDipForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
            <Button className="w-full" onClick={() => saveDipping.mutate({
              ...dipForm,
              tankId: Number(dipForm.tankId),
              fuelProductId: tanks.find((t: any) => t.id === Number(dipForm.tankId))?.fuelProductId || null,
              bookVolume: String(tanks.find((t: any) => t.id === Number(dipForm.tankId))?.currentVolume || "0"),
              difference: String((Number(dipForm.measuredVolume || 0) - Number(tanks.find((t: any) => t.id === Number(dipForm.tankId))?.currentVolume || 0)).toFixed(2)),
              companyId: selectedCompanyId,
            })} disabled={saveDipping.isPending} data-testid="btn-save-dipping">
              {saveDipping.isPending ? "กำลังบันทึก..." : "บันทึกผลจุ่มถัง"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </GasStationLayout>
  );
}
