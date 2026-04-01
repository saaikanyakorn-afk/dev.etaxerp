import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import GasStationLayout from "@/components/gas-station-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, Fuel, Container, Gauge, Users } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const FUEL_GROUPS = [
  { value: "gasoline", label: "เบนซิน" },
  { value: "gasohol", label: "แก๊สโซฮอล์" },
  { value: "diesel", label: "ดีเซล" },
  { value: "lpg", label: "LPG" },
  { value: "other", label: "อื่นๆ" },
];

const DEFAULT_FUEL_PRODUCTS = [
  { code: "BZ91", name: "Gasoline 91", nameTh: "เบนซิน 91", fuelGroup: "gasoline", exciseTaxRate: "6.5000", municipalTaxRate: "0.6500" },
  { code: "GS95", name: "Gasohol 95", nameTh: "แก๊สโซฮอล์ 95", fuelGroup: "gasohol", exciseTaxRate: "5.8500", municipalTaxRate: "0.5850" },
  { code: "E20", name: "Gasohol E20", nameTh: "แก๊สโซฮอล์ E20", fuelGroup: "gasohol", exciseTaxRate: "3.5000", municipalTaxRate: "0.3500" },
  { code: "E85", name: "Gasohol E85", nameTh: "แก๊สโซฮอล์ E85", fuelGroup: "gasohol", exciseTaxRate: "0.9750", municipalTaxRate: "0.0975" },
  { code: "DB7", name: "Diesel B7", nameTh: "ดีเซล B7", fuelGroup: "diesel", exciseTaxRate: "5.9900", municipalTaxRate: "0.5990" },
  { code: "DB20", name: "Diesel B20", nameTh: "ดีเซล B20", fuelGroup: "diesel", exciseTaxRate: "5.2000", municipalTaxRate: "0.5200" },
  { code: "PDZ", name: "Premium Diesel", nameTh: "ดีเซลพรีเมี่ยม", fuelGroup: "diesel", exciseTaxRate: "5.9900", municipalTaxRate: "0.5990" },
  { code: "LPG", name: "LPG", nameTh: "ก๊าซ LPG", fuelGroup: "lpg", exciseTaxRate: "2.1700", municipalTaxRate: "0.2170" },
];

export default function FuelSetup() {
  const { selectedCompanyId } = useCompany();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("products");

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

  const { data: pumps = [] } = useQuery({
    queryKey: ["/api/gas-station/fuel-pumps", selectedCompanyId],
    queryFn: () => apiRequest("GET", `/api/gas-station/fuel-pumps?companyId=${selectedCompanyId}`).then(r => r.json()),
    enabled: !!selectedCompanyId,
  });

  const { data: creditCustomers = [] } = useQuery({
    queryKey: ["/api/gas-station/credit-customers", selectedCompanyId],
    queryFn: () => apiRequest("GET", `/api/gas-station/credit-customers?companyId=${selectedCompanyId}`).then(r => r.json()),
    enabled: !!selectedCompanyId,
  });

  const [showProductForm, setShowProductForm] = useState(false);
  const [editProduct, setEditProduct] = useState<any>(null);
  const [productForm, setProductForm] = useState({ code: "", name: "", nameTh: "", fuelGroup: "gasoline", unitPrice: "0", vatRate: "7", exciseTaxRate: "0", municipalTaxRate: "0" });

  const [showTankForm, setShowTankForm] = useState(false);
  const [tankForm, setTankForm] = useState({ tankNo: "", name: "", fuelProductId: "", capacity: "0" });

  const [showPumpForm, setShowPumpForm] = useState(false);
  const [pumpForm, setPumpForm] = useState({ pumpNo: "", name: "", nozzles: [{ nozzleNo: "1", fuelProductId: "", tankId: "" }] as any[] });

  const saveProduct = useMutation({
    mutationFn: (data: any) => {
      if (editProduct) {
        return apiRequest("PATCH", `/api/gas-station/fuel-products/${editProduct.id}?companyId=${selectedCompanyId}`, data);
      }
      return apiRequest("POST", `/api/gas-station/fuel-products?companyId=${selectedCompanyId}`, data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/gas-station/fuel-products"] });
      setShowProductForm(false);
      setEditProduct(null);
      toast({ title: "บันทึกสำเร็จ" });
    },
  });

  const saveTank = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/gas-station/fuel-tanks?companyId=${selectedCompanyId}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/gas-station/fuel-tanks"] });
      setShowTankForm(false);
      toast({ title: "บันทึกถังสำเร็จ" });
    },
  });

  const savePump = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/gas-station/fuel-pumps?companyId=${selectedCompanyId}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/gas-station/fuel-pumps"] });
      setShowPumpForm(false);
      toast({ title: "บันทึกตู้จ่ายสำเร็จ" });
    },
  });

  const seedDefaults = useMutation({
    mutationFn: () => apiRequest("POST", `/api/gas-station/fuel-products/seed?companyId=${selectedCompanyId}`, { products: DEFAULT_FUEL_PRODUCTS }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/gas-station/fuel-products"] });
      toast({ title: "สร้างรายการน้ำมันมาตรฐานสำเร็จ" });
    },
  });

  const [showCreditForm, setShowCreditForm] = useState(false);
  const [creditForm, setCreditForm] = useState({ customerName: "", taxId: "", address: "", phone: "", creditLimit: "0", contactPerson: "", fleetCardNo: "", notes: "" });

  const saveCreditCustomer = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/gas-station/credit-customers?companyId=${selectedCompanyId}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/gas-station/credit-customers"] });
      setShowCreditForm(false);
      setCreditForm({ customerName: "", taxId: "", address: "", phone: "", creditLimit: "0", contactPerson: "", fleetCardNo: "", notes: "" });
      toast({ title: "บันทึกลูกค้าเชื่อสำเร็จ" });
    },
  });

  const deleteCreditCustomer = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/gas-station/credit-customers/${id}?companyId=${selectedCompanyId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/gas-station/credit-customers"] });
      toast({ title: "ลบลูกค้าเชื่อสำเร็จ" });
    },
  });

  return (
    <GasStationLayout>
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
          <Fuel className="h-7 w-7 text-[#fb9678]" />
          ตั้งค่าปั๊มน้ำมัน
        </h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="products" className="flex items-center gap-1.5" data-testid="tab-products">
            <Fuel className="h-4 w-4" /> น้ำมัน ({products.length})
          </TabsTrigger>
          <TabsTrigger value="tanks" className="flex items-center gap-1.5" data-testid="tab-tanks">
            <Container className="h-4 w-4" /> ถัง ({tanks.length})
          </TabsTrigger>
          <TabsTrigger value="pumps" className="flex items-center gap-1.5" data-testid="tab-pumps">
            <Gauge className="h-4 w-4" /> ตู้จ่าย ({pumps.length})
          </TabsTrigger>
          <TabsTrigger value="credit" className="flex items-center gap-1.5" data-testid="tab-credit">
            <Users className="h-4 w-4" /> ลูกค้าเชื่อ ({creditCustomers.length})
          </TabsTrigger>
        </TabsList>

        {/* ===== FUEL PRODUCTS TAB ===== */}
        <TabsContent value="products">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-lg">รายการน้ำมัน</CardTitle>
              <div className="flex gap-2">
                {products.length === 0 && (
                  <Button variant="outline" size="sm" onClick={() => seedDefaults.mutate()} data-testid="btn-seed-defaults">
                    สร้างรายการมาตรฐาน
                  </Button>
                )}
                <Button size="sm" onClick={() => { setEditProduct(null); setProductForm({ code: "", name: "", nameTh: "", fuelGroup: "gasoline", unitPrice: "0", vatRate: "7", exciseTaxRate: "0", municipalTaxRate: "0" }); setShowProductForm(true); }} data-testid="btn-add-product">
                  <Plus className="h-4 w-4 mr-1" /> เพิ่มน้ำมัน
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow style={{ background: "var(--theme-table-header)" }}>
                    <TableHead className="text-white font-bold">รหัส</TableHead>
                    <TableHead className="text-white font-bold">ชื่อน้ำมัน</TableHead>
                    <TableHead className="text-white font-bold">กลุ่ม</TableHead>
                    <TableHead className="text-white font-bold text-right">ราคา/ลิตร</TableHead>
                    <TableHead className="text-white font-bold text-right">VAT%</TableHead>
                    <TableHead className="text-white font-bold text-right">สรรพสามิต</TableHead>
                    <TableHead className="text-white font-bold text-right">ภาษีท้องถิ่น</TableHead>
                    <TableHead className="text-white font-bold text-center">สถานะ</TableHead>
                    <TableHead className="text-white font-bold w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">ยังไม่มีรายการน้ำมัน กด "สร้างรายการมาตรฐาน" เพื่อเริ่มต้น</TableCell></TableRow>
                  ) : products.map((p: any) => (
                    <TableRow key={p.id} data-testid={`row-product-${p.id}`}>
                      <TableCell className="font-mono text-sm">{p.code}</TableCell>
                      <TableCell>
                        <div className="font-medium">{p.nameTh}</div>
                        <div className="text-xs text-muted-foreground">{p.name}</div>
                      </TableCell>
                      <TableCell><Badge variant="outline">{FUEL_GROUPS.find(g => g.value === p.fuelGroup)?.label || p.fuelGroup}</Badge></TableCell>
                      <TableCell className="text-right tabular-nums">{Number(p.unitPrice).toFixed(2)}</TableCell>
                      <TableCell className="text-right tabular-nums">{p.vatRate}%</TableCell>
                      <TableCell className="text-right tabular-nums">{Number(p.exciseTaxRate).toFixed(4)}</TableCell>
                      <TableCell className="text-right tabular-nums">{Number(p.municipalTaxRate).toFixed(4)}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={p.isActive ? "default" : "secondary"}>{p.isActive ? "ใช้งาน" : "ปิด"}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => {
                          setEditProduct(p);
                          setProductForm({ code: p.code, name: p.name, nameTh: p.nameTh, fuelGroup: p.fuelGroup, unitPrice: p.unitPrice, vatRate: p.vatRate, exciseTaxRate: p.exciseTaxRate, municipalTaxRate: p.municipalTaxRate });
                          setShowProductForm(true);
                        }} data-testid={`btn-edit-product-${p.id}`}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== TANKS TAB ===== */}
        <TabsContent value="tanks">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-lg">ถังน้ำมัน</CardTitle>
              <Button size="sm" onClick={() => { setTankForm({ tankNo: "", name: "", fuelProductId: "", capacity: "0" }); setShowTankForm(true); }} data-testid="btn-add-tank">
                <Plus className="h-4 w-4 mr-1" /> เพิ่มถัง
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow style={{ background: "var(--theme-table-header)" }}>
                    <TableHead className="text-white font-bold">ถังที่</TableHead>
                    <TableHead className="text-white font-bold">ชื่อถัง</TableHead>
                    <TableHead className="text-white font-bold">ชนิดน้ำมัน</TableHead>
                    <TableHead className="text-white font-bold text-right">ความจุ (ลิตร)</TableHead>
                    <TableHead className="text-white font-bold text-right">คงเหลือ (ลิตร)</TableHead>
                    <TableHead className="text-white font-bold text-center">% เต็ม</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tanks.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">ยังไม่มีถังน้ำมัน</TableCell></TableRow>
                  ) : tanks.map((t: any) => {
                    const pct = t.capacity > 0 ? (Number(t.currentVolume) / Number(t.capacity) * 100) : 0;
                    const fuelName = products.find((p: any) => p.id === t.fuelProductId)?.nameTh || "-";
                    return (
                      <TableRow key={t.id} data-testid={`row-tank-${t.id}`}>
                        <TableCell className="font-mono">{t.tankNo}</TableCell>
                        <TableCell className="font-medium">{t.name}</TableCell>
                        <TableCell>{fuelName}</TableCell>
                        <TableCell className="text-right tabular-nums">{Number(t.capacity).toLocaleString()}</TableCell>
                        <TableCell className="text-right tabular-nums">{Number(t.currentVolume).toLocaleString()}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center gap-2 justify-center">
                            <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: pct > 75 ? "#05b187" : pct > 30 ? "#fec90f" : "#f94d4d" }} />
                            </div>
                            <span className="text-xs tabular-nums">{pct.toFixed(0)}%</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== PUMPS TAB ===== */}
        <TabsContent value="pumps">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-lg">ตู้จ่ายน้ำมัน & หัวจ่าย</CardTitle>
              <Button size="sm" onClick={() => { setPumpForm({ pumpNo: "", name: "", nozzles: [{ nozzleNo: "1", fuelProductId: "", tankId: "" }] }); setShowPumpForm(true); }} data-testid="btn-add-pump">
                <Plus className="h-4 w-4 mr-1" /> เพิ่มตู้จ่าย
              </Button>
            </CardHeader>
            <CardContent>
              {pumps.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">ยังไม่มีตู้จ่าย</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {pumps.map((pump: any) => (
                    <Card key={pump.id} className="border-2" data-testid={`card-pump-${pump.id}`}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Gauge className="h-5 w-5 text-[#fb9678]" />
                          ตู้ {pump.pumpNo} — {pump.name}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-1">
                          {(pump.nozzles || []).map((n: any) => {
                            const fuelName = products.find((p: any) => p.id === n.fuelProductId)?.nameTh || "-";
                            const tankName = tanks.find((t: any) => t.id === n.tankId)?.name || "-";
                            return (
                              <div key={n.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded text-sm">
                                <Badge variant="outline" className="min-w-[40px] justify-center">#{n.nozzleNo}</Badge>
                                <span className="font-medium">{fuelName}</span>
                                <span className="text-xs text-muted-foreground ml-auto">← {tankName}</span>
                              </div>
                            );
                          })}
                          {(!pump.nozzles || pump.nozzles.length === 0) && (
                            <div className="text-xs text-muted-foreground">ยังไม่มีหัวจ่าย</div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== CREDIT CUSTOMERS TAB ===== */}
        <TabsContent value="credit">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-lg">ลูกค้าเชื่อ / Fleet Card</CardTitle>
              <Button size="sm" onClick={() => { setCreditForm({ customerName: "", taxId: "", address: "", phone: "", creditLimit: "0", contactPerson: "", fleetCardNo: "", notes: "" }); setShowCreditForm(true); }} data-testid="btn-add-credit-customer">
                <Plus className="h-4 w-4 mr-1" /> เพิ่มลูกค้าเชื่อ
              </Button>
            </CardHeader>
            <CardContent>
              {creditCustomers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p>ยังไม่มีลูกค้าเชื่อ</p>
                  <p className="text-xs">ลูกค้าเชื่อใช้สำหรับออกใบกำกับเต็มรูป เมื่อขายน้ำมันแบบ "เชื่อ (AR)"</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow style={{ background: "var(--theme-table-header)" }}>
                      <TableHead className="text-white font-bold">ชื่อลูกค้า</TableHead>
                      <TableHead className="text-white font-bold">เลขผู้เสียภาษี</TableHead>
                      <TableHead className="text-white font-bold">เบอร์โทร</TableHead>
                      <TableHead className="text-white font-bold">Fleet Card</TableHead>
                      <TableHead className="text-white font-bold text-right">วงเงินเชื่อ</TableHead>
                      <TableHead className="text-white font-bold w-[60px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {creditCustomers.map((c: any) => (
                      <TableRow key={c.id} data-testid={`row-credit-${c.id}`}>
                        <TableCell className="font-medium">{c.customerName}</TableCell>
                        <TableCell className="text-sm">{c.taxId || "-"}</TableCell>
                        <TableCell className="text-sm">{c.phone || "-"}</TableCell>
                        <TableCell className="text-sm">{c.fleetCardNo || "-"}</TableCell>
                        <TableCell className="text-right tabular-nums">{Number(c.creditLimit || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => deleteCreditCustomer.mutate(c.id)} data-testid={`btn-delete-credit-${c.id}`}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Product Dialog */}
      <Dialog open={showProductForm} onOpenChange={setShowProductForm}>
        <DialogContent className="max-w-[500px]">
          <DialogHeader><DialogTitle>{editProduct ? "แก้ไขน้ำมัน" : "เพิ่มชนิดน้ำมัน"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>รหัส</Label><Input value={productForm.code} onChange={e => setProductForm(f => ({ ...f, code: e.target.value }))} data-testid="input-product-code" /></div>
              <div><Label>กลุ่ม</Label>
                <Select value={productForm.fuelGroup} onValueChange={v => setProductForm(f => ({ ...f, fuelGroup: v }))}>
                  <SelectTrigger data-testid="select-fuel-group"><SelectValue /></SelectTrigger>
                  <SelectContent>{FUEL_GROUPS.map(g => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>ชื่อ (ไทย)</Label><Input value={productForm.nameTh} onChange={e => setProductForm(f => ({ ...f, nameTh: e.target.value }))} data-testid="input-product-name-th" /></div>
            <div><Label>ชื่อ (EN)</Label><Input value={productForm.name} onChange={e => setProductForm(f => ({ ...f, name: e.target.value }))} data-testid="input-product-name" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>ราคา/ลิตร</Label><Input type="number" step="0.01" value={productForm.unitPrice} onChange={e => setProductForm(f => ({ ...f, unitPrice: e.target.value }))} data-testid="input-unit-price" /></div>
              <div><Label>VAT%</Label><Input type="number" step="0.01" value={productForm.vatRate} onChange={e => setProductForm(f => ({ ...f, vatRate: e.target.value }))} data-testid="input-vat-rate" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>อัตราภาษีสรรพสามิต (บาท/ลิตร)</Label><Input type="number" step="0.0001" value={productForm.exciseTaxRate} onChange={e => setProductForm(f => ({ ...f, exciseTaxRate: e.target.value }))} data-testid="input-excise-rate" /></div>
              <div><Label>อัตราภาษีท้องถิ่น (บาท/ลิตร)</Label><Input type="number" step="0.0001" value={productForm.municipalTaxRate} onChange={e => setProductForm(f => ({ ...f, municipalTaxRate: e.target.value }))} data-testid="input-municipal-rate" /></div>
            </div>
            <Button className="w-full" onClick={() => saveProduct.mutate({ ...productForm, companyId: selectedCompanyId })} disabled={saveProduct.isPending} data-testid="btn-save-product">
              {saveProduct.isPending ? "กำลังบันทึก..." : "บันทึก"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Tank Dialog */}
      <Dialog open={showTankForm} onOpenChange={setShowTankForm}>
        <DialogContent className="max-w-[450px]">
          <DialogHeader><DialogTitle>เพิ่มถังน้ำมัน</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>เลขถัง</Label><Input value={tankForm.tankNo} onChange={e => setTankForm(f => ({ ...f, tankNo: e.target.value }))} data-testid="input-tank-no" /></div>
              <div><Label>ชื่อถัง</Label><Input value={tankForm.name} onChange={e => setTankForm(f => ({ ...f, name: e.target.value }))} data-testid="input-tank-name" /></div>
            </div>
            <div><Label>ชนิดน้ำมัน</Label>
              <Select value={tankForm.fuelProductId} onValueChange={v => setTankForm(f => ({ ...f, fuelProductId: v }))}>
                <SelectTrigger data-testid="select-tank-fuel"><SelectValue placeholder="เลือกชนิดน้ำมัน" /></SelectTrigger>
                <SelectContent>{products.map((p: any) => <SelectItem key={p.id} value={String(p.id)}>{p.nameTh}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>ความจุ (ลิตร)</Label><Input type="number" value={tankForm.capacity} onChange={e => setTankForm(f => ({ ...f, capacity: e.target.value }))} data-testid="input-tank-capacity" /></div>
            <Button className="w-full" onClick={() => saveTank.mutate({ ...tankForm, fuelProductId: Number(tankForm.fuelProductId), companyId: selectedCompanyId })} disabled={saveTank.isPending} data-testid="btn-save-tank">
              {saveTank.isPending ? "กำลังบันทึก..." : "บันทึก"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pump Dialog */}
      <Dialog open={showPumpForm} onOpenChange={setShowPumpForm}>
        <DialogContent className="max-w-[550px]">
          <DialogHeader><DialogTitle>เพิ่มตู้จ่ายน้ำมัน</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>เลขตู้จ่าย</Label><Input value={pumpForm.pumpNo} onChange={e => setPumpForm(f => ({ ...f, pumpNo: e.target.value }))} data-testid="input-pump-no" /></div>
              <div><Label>ชื่อ</Label><Input value={pumpForm.name} onChange={e => setPumpForm(f => ({ ...f, name: e.target.value }))} data-testid="input-pump-name" /></div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium">หัวจ่าย (Nozzles)</Label>
                <Button variant="outline" size="sm" onClick={() => setPumpForm(f => ({ ...f, nozzles: [...f.nozzles, { nozzleNo: String(f.nozzles.length + 1), fuelProductId: "", tankId: "" }] }))} data-testid="btn-add-nozzle">
                  <Plus className="h-3 w-3 mr-1" /> เพิ่มหัว
                </Button>
              </div>
              {pumpForm.nozzles.map((n: any, i: number) => (
                <div key={i} className="grid grid-cols-[60px_1fr_1fr_40px] gap-2 mb-2 items-end">
                  <div><Label className="text-xs">หัว#</Label><Input value={n.nozzleNo} onChange={e => { const nz = [...pumpForm.nozzles]; nz[i] = { ...nz[i], nozzleNo: e.target.value }; setPumpForm(f => ({ ...f, nozzles: nz })); }} /></div>
                  <div><Label className="text-xs">ชนิดน้ำมัน</Label>
                    <Select value={n.fuelProductId} onValueChange={v => { const nz = [...pumpForm.nozzles]; nz[i] = { ...nz[i], fuelProductId: v }; setPumpForm(f => ({ ...f, nozzles: nz })); }}>
                      <SelectTrigger><SelectValue placeholder="เลือก" /></SelectTrigger>
                      <SelectContent>{products.map((p: any) => <SelectItem key={p.id} value={String(p.id)}>{p.nameTh}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label className="text-xs">ถัง</Label>
                    <Select value={n.tankId} onValueChange={v => { const nz = [...pumpForm.nozzles]; nz[i] = { ...nz[i], tankId: v }; setPumpForm(f => ({ ...f, nozzles: nz })); }}>
                      <SelectTrigger><SelectValue placeholder="เลือก" /></SelectTrigger>
                      <SelectContent>{tanks.map((t: any) => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <Button variant="ghost" size="icon" className="text-red-500" onClick={() => setPumpForm(f => ({ ...f, nozzles: f.nozzles.filter((_: any, j: number) => j !== i) }))} data-testid={`btn-remove-nozzle-${i}`}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button className="w-full" onClick={() => savePump.mutate({
              ...pumpForm,
              companyId: selectedCompanyId,
              nozzles: pumpForm.nozzles.map((n: any) => ({ ...n, fuelProductId: Number(n.fuelProductId), tankId: n.tankId ? Number(n.tankId) : null })),
            })} disabled={savePump.isPending} data-testid="btn-save-pump">
              {savePump.isPending ? "กำลังบันทึก..." : "บันทึก"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Credit Customer Dialog */}
      <Dialog open={showCreditForm} onOpenChange={setShowCreditForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-[#05b187]" /> เพิ่มลูกค้าเชื่อ</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>ชื่อลูกค้า / บริษัท *</Label><Input value={creditForm.customerName} onChange={e => setCreditForm(f => ({ ...f, customerName: e.target.value }))} data-testid="input-credit-name" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>เลขผู้เสียภาษี</Label><Input value={creditForm.taxId} onChange={e => setCreditForm(f => ({ ...f, taxId: e.target.value }))} data-testid="input-credit-tax-id" /></div>
              <div><Label>เบอร์โทร</Label><Input value={creditForm.phone} onChange={e => setCreditForm(f => ({ ...f, phone: e.target.value }))} data-testid="input-credit-phone" /></div>
            </div>
            <div><Label>ที่อยู่</Label><Input value={creditForm.address} onChange={e => setCreditForm(f => ({ ...f, address: e.target.value }))} data-testid="input-credit-address" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>ผู้ติดต่อ</Label><Input value={creditForm.contactPerson} onChange={e => setCreditForm(f => ({ ...f, contactPerson: e.target.value }))} data-testid="input-credit-contact" /></div>
              <div><Label>Fleet Card No.</Label><Input value={creditForm.fleetCardNo} onChange={e => setCreditForm(f => ({ ...f, fleetCardNo: e.target.value }))} data-testid="input-credit-fleet" /></div>
            </div>
            <div><Label>วงเงินเชื่อ (บาท)</Label><Input type="number" value={creditForm.creditLimit} onChange={e => setCreditForm(f => ({ ...f, creditLimit: e.target.value }))} data-testid="input-credit-limit" /></div>
            <div><Label>หมายเหตุ</Label><Input value={creditForm.notes} onChange={e => setCreditForm(f => ({ ...f, notes: e.target.value }))} data-testid="input-credit-notes" /></div>
            <Button className="w-full bg-[#05b187] hover:bg-[#05b187]/90" onClick={() => saveCreditCustomer.mutate(creditForm)} disabled={!creditForm.customerName || saveCreditCustomer.isPending} data-testid="btn-save-credit">
              {saveCreditCustomer.isPending ? "กำลังบันทึก..." : "บันทึก"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </GasStationLayout>
  );
}
