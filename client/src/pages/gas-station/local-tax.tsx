import { useState, useRef } from "react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Landmark, CheckCircle2, Clock, AlertCircle, Printer, FileText, Calculator } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

function fmt(n: number | string) {
  return Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtInt(n: number | string) {
  return Math.floor(Number(n || 0)).toLocaleString("th-TH");
}

const THAI_MONTHS = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];

const TAX_TYPES = [
  { value: "pao", label: "ภาษี อบจ. (องค์การบริหารส่วนจังหวัด)" },
  { value: "municipal", label: "ภาษีเทศบาล" },
  { value: "sao", label: "ภาษี อบต." },
  { value: "other", label: "อื่นๆ" },
];

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "รอชำระ", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  paid: { label: "ชำระแล้ว", color: "bg-green-100 text-green-800", icon: CheckCircle2 },
  overdue: { label: "เกินกำหนด", color: "bg-red-100 text-red-800", icon: AlertCircle },
};

function numberToThaiText(n: number): string {
  const units = ["", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
  const pos = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน", "ล้าน"];
  if (n === 0) return "ศูนย์";
  const intPart = Math.floor(n);
  const decPart = Math.round((n - intPart) * 100);
  let result = "";
  const str = intPart.toString();
  const len = str.length;
  for (let i = 0; i < len; i++) {
    const d = Number(str[i]);
    const p = len - i - 1;
    if (d === 0) continue;
    if (p === 1 && d === 1) result += "สิบ";
    else if (p === 1 && d === 2) result += "ยี่สิบ";
    else if (p === 0 && d === 1 && len > 1) result += "เอ็ด";
    else result += units[d] + pos[p];
  }
  result += "บาท";
  if (decPart > 0) {
    const s2 = decPart.toString().padStart(2, "0");
    const d1 = Number(s2[0]), d2 = Number(s2[1]);
    if (d1 === 0) { result += units[d2] + "สตางค์"; }
    else if (d1 === 1) { result += "สิบ" + (d2 === 1 ? "เอ็ด" : d2 === 0 ? "" : units[d2]) + "สตางค์"; }
    else if (d1 === 2) { result += "ยี่สิบ" + (d2 === 1 ? "เอ็ด" : d2 === 0 ? "" : units[d2]) + "สตางค์"; }
    else { result += units[d1] + "สิบ" + (d2 === 1 ? "เอ็ด" : d2 === 0 ? "" : units[d2]) + "สตางค์"; }
  } else {
    result += "ถ้วน";
  }
  return result;
}

export default function LocalTax() {
  const { selectedCompanyId } = useCompany();
  const { toast } = useToast();
  const { dateEra, dateFmt } = useDateSettings();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const printRef014 = useRef<HTMLDivElement>(null);
  const printRef016 = useRef<HTMLDivElement>(null);

  const now = new Date();
  const [formMonth, setFormMonth] = useState(String(now.getMonth() + 1));
  const [formYear, setFormYear] = useState(String(now.getFullYear()));
  const [taxRate, setTaxRate] = useState("0.0454");
  const [companyInfo, setCompanyInfo] = useState({
    companyName: "", stationName: "", taxId: "", address: "", province: "", localAuthority: "องค์การบริหารส่วนจังหวัด",
    signerName: "",
  });

  const { data: records = [] } = useQuery({
    queryKey: ["/api/gas-station/local-tax", selectedCompanyId],
    queryFn: () => apiRequest("GET", `/api/gas-station/local-tax?companyId=${selectedCompanyId}`).then(r => r.json()),
    enabled: !!selectedCompanyId,
  });

  const { data: taxFormData } = useQuery({
    queryKey: ["/api/gas-station/tax-form-data", selectedCompanyId, formMonth, formYear],
    queryFn: () => apiRequest("GET", `/api/gas-station/tax-form-data?companyId=${selectedCompanyId}&month=${formMonth}&year=${formYear}`).then(r => r.json()),
    enabled: !!selectedCompanyId,
  });

  const [form, setForm] = useState({
    taxPeriod: "", taxType: "pao", localAuthority: "",
    totalLitersSold: "", taxRatePerLiter: "0.0454", surcharge: "0",
    dueDate: "", notes: "",
  });

  const taxAmount = Number(form.totalLitersSold || 0) * Number(form.taxRatePerLiter || 0);
  const totalPayable = taxAmount + Number(form.surcharge || 0);

  const saveMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/gas-station/local-tax?companyId=${selectedCompanyId}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/gas-station/local-tax"] });
      setShowForm(false);
      toast({ title: "บันทึกภาษีท้องถิ่นสำเร็จ" });
    },
  });

  const markPaid = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/gas-station/local-tax/${id}?companyId=${selectedCompanyId}`, { status: "paid", paidDate: today }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/gas-station/local-tax"] });
      toast({ title: "อัปเดตสถานะชำระเรียบร้อย" });
    },
  });

  const totalTax = records.reduce((s: number, r: any) => s + Number(r.taxAmount || 0), 0);
  const totalPaid = records.filter((r: any) => r.status === "paid").reduce((s: number, r: any) => s + Number(r.totalPayable || 0), 0);
  const totalPending = records.filter((r: any) => r.status !== "paid").reduce((s: number, r: any) => s + Number(r.totalPayable || 0), 0);

  const { salesByProduct = [], products = [], tanks = [], receivingsByProduct = [] } = taxFormData || {};
  const productMap: Record<number, any> = {};
  products.forEach((p: any) => { productMap[p.id] = p; });

  const formLines = salesByProduct.map((row: any) => {
    const product = productMap[row.fuelProductId];
    const liters = Number(row.totalLiters || 0);
    const rate = Number(taxRate);
    const tax = Math.floor(liters * rate);
    const satang = Math.round((liters * rate - tax) * 100);
    return {
      name: product?.nameTh || product?.name || `สินค้า #${row.fuelProductId}`,
      liters,
      rate,
      taxBaht: tax,
      taxSatang: satang,
      totalTax: liters * rate,
    };
  });

  const grandTotalTax014 = formLines.reduce((s, l) => s + l.totalTax, 0);
  const thaiYear = Number(formYear) + 543;
  const monthName = THAI_MONTHS[Number(formMonth) - 1] || "";

  const receivingMap: Record<number, number> = {};
  receivingsByProduct.forEach((r: any) => { receivingMap[r.fuelProductId] = Number(r.totalLiters || 0); });

  const handlePrint = (ref: React.RefObject<HTMLDivElement>) => {
    if (!ref.current) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`<html><head><title>พิมพ์แบบฟอร์ม</title>
      <style>
        @page { size: A4 landscape; margin: 15mm; }
        body { font-family: 'TH Sarabun New', 'Sarabun', sans-serif; font-size: 14px; color: #000; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #333; padding: 4px 8px; text-align: center; }
        .no-border { border: none !important; }
        .text-left { text-align: left; }
        .text-right { text-align: right; }
        .bold { font-weight: bold; }
        h2, h3 { margin: 4px 0; }
        .header-section { margin-bottom: 10px; }
      </style></head><body>`);
    printWindow.document.write(ref.current.innerHTML);
    printWindow.document.write("</body></html>");
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 500);
  };

  return (
    <GasStationLayout>
    <div className="space-y-4">
      <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
        <Landmark className="h-7 w-7 text-[#05b187]" />
        ภาษีท้องถิ่น
      </h1>

      <Tabs defaultValue="records">
        <TabsList>
          <TabsTrigger value="records" data-testid="tab-records">รายการภาษี</TabsTrigger>
          <TabsTrigger value="form014" data-testid="tab-form014">อบจ.01-4 (แบบรายการภาษี)</TabsTrigger>
          <TabsTrigger value="form016" data-testid="tab-form016">อบจ.01-6 (งบรับ-จ่าย)</TabsTrigger>
        </TabsList>

        <TabsContent value="records" className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => { setForm({ taxPeriod: "", taxType: "pao", localAuthority: "", totalLitersSold: "", taxRatePerLiter: "0.0454", surcharge: "0", dueDate: "", notes: "" }); setShowForm(true); }} data-testid="btn-add-tax">
              <Plus className="h-4 w-4 mr-1" /> บันทึกภาษี
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="text-sm text-muted-foreground mb-1">ภาษีรวมทั้งหมด</div>
                <div className="text-xl font-bold tabular-nums">฿{fmt(totalTax)}</div>
              </CardContent>
            </Card>
            <Card className="border-green-200">
              <CardContent className="pt-4 pb-3">
                <div className="text-sm text-green-700 mb-1">ชำระแล้ว</div>
                <div className="text-xl font-bold text-green-700 tabular-nums">฿{fmt(totalPaid)}</div>
              </CardContent>
            </Card>
            <Card className="border-yellow-200">
              <CardContent className="pt-4 pb-3">
                <div className="text-sm text-yellow-700 mb-1">รอชำระ</div>
                <div className="text-xl font-bold text-yellow-700 tabular-nums">฿{fmt(totalPending)}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow style={{ background: "var(--theme-table-header)" }}>
                    <TableHead className="text-white font-bold">งวด</TableHead>
                    <TableHead className="text-white font-bold">ประเภท</TableHead>
                    <TableHead className="text-white font-bold">หน่วยงาน</TableHead>
                    <TableHead className="text-white font-bold text-right">ลิตรรวม</TableHead>
                    <TableHead className="text-white font-bold text-right">อัตรา/ลิตร</TableHead>
                    <TableHead className="text-white font-bold text-right">ภาษี</TableHead>
                    <TableHead className="text-white font-bold text-right">เงินเพิ่ม</TableHead>
                    <TableHead className="text-white font-bold text-right">รวมจ่าย</TableHead>
                    <TableHead className="text-white font-bold">กำหนดจ่าย</TableHead>
                    <TableHead className="text-white font-bold text-center">สถานะ</TableHead>
                    <TableHead className="text-white font-bold w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.length === 0 ? (
                    <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">ยังไม่มีรายการภาษีท้องถิ่น</TableCell></TableRow>
                  ) : records.map((r: any) => {
                    const st = STATUS_MAP[r.status] || STATUS_MAP.pending;
                    const StIcon = st.icon;
                    return (
                      <TableRow key={r.id} data-testid={`row-tax-${r.id}`}>
                        <TableCell className="font-medium">{r.taxPeriod}</TableCell>
                        <TableCell>{TAX_TYPES.find(t => t.value === r.taxType)?.label || r.taxType}</TableCell>
                        <TableCell>{r.localAuthority || "-"}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmt(r.totalLitersSold)}</TableCell>
                        <TableCell className="text-right tabular-nums">{Number(r.taxRatePerLiter).toFixed(4)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmt(r.taxAmount)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmt(r.surcharge)}</TableCell>
                        <TableCell className="text-right tabular-nums font-bold">{fmt(r.totalPayable)}</TableCell>
                        <TableCell className="tabular-nums text-sm">{r.dueDate || "-"}</TableCell>
                        <TableCell className="text-center">
                          <Badge className={`${st.color} gap-1`}><StIcon className="h-3 w-3" />{st.label}</Badge>
                        </TableCell>
                        <TableCell>
                          {r.status !== "paid" && (
                            <Button variant="outline" size="sm" onClick={() => markPaid.mutate(r.id)} data-testid={`btn-mark-paid-${r.id}`}>ชำระ</Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="form014" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                ตั้งค่าแบบฟอร์ม อบจ.01-4
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <Label>เดือน</Label>
                  <Select value={formMonth} onValueChange={setFormMonth}>
                    <SelectTrigger data-testid="select-form-month"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {THAI_MONTHS.map((m, i) => <SelectItem key={i+1} value={String(i+1)}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>ปี ค.ศ.</Label>
                  <Input type="number" value={formYear} onChange={e => setFormYear(e.target.value)} data-testid="input-form-year" />
                  <span className="text-xs text-muted-foreground">พ.ศ. {thaiYear}</span>
                </div>
                <div>
                  <Label>อัตราภาษี (บาท/ลิตร)</Label>
                  <Input type="number" step="0.0001" value={taxRate} onChange={e => setTaxRate(e.target.value)} data-testid="input-form-tax-rate" />
                </div>
                <div className="flex items-end">
                  <Button onClick={() => handlePrint(printRef014)} className="bg-[#05b187] hover:bg-[#05b187]/90" data-testid="btn-print-014">
                    <Printer className="h-4 w-4 mr-2" /> พิมพ์ อบจ.01-4
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><Label>ชื่อผู้ประกอบการ</Label><Input value={companyInfo.companyName} onChange={e => setCompanyInfo(c => ({...c, companyName: e.target.value}))} placeholder="เช่น บริษัท อยุธยา โอทอป อินเตอร์เทรดเดอร์ จำกัด" data-testid="input-company-name" /></div>
                <div><Label>ชื่อสถานการค้า</Label><Input value={companyInfo.stationName} onChange={e => setCompanyInfo(c => ({...c, stationName: e.target.value}))} placeholder="เช่น สถานีบริการน้ำมันคาลเท็กซ์ อยุธยา" data-testid="input-station-name" /></div>
                <div><Label>เลขประจำตัวผู้เสียภาษี</Label><Input value={companyInfo.taxId} onChange={e => setCompanyInfo(c => ({...c, taxId: e.target.value}))} placeholder="เช่น 0145559002673" data-testid="input-tax-id" /></div>
                <div><Label>หน่วยงานท้องถิ่น</Label><Input value={companyInfo.localAuthority} onChange={e => setCompanyInfo(c => ({...c, localAuthority: e.target.value}))} placeholder="เช่น องค์การบริหารส่วนจังหวัดพระนครศรีอยุธยา" data-testid="input-local-authority" /></div>
                <div><Label>ที่อยู่</Label><Input value={companyInfo.address} onChange={e => setCompanyInfo(c => ({...c, address: e.target.value}))} placeholder="เช่น 115 หมู่ที่ 4 ต.บ้านใหม่ อ.เมือง" data-testid="input-address" /></div>
                <div><Label>จังหวัด</Label><Input value={companyInfo.province} onChange={e => setCompanyInfo(c => ({...c, province: e.target.value}))} placeholder="เช่น พระนครศรีอยุธยา" data-testid="input-province" /></div>
                <div><Label>ผู้ลงนาม</Label><Input value={companyInfo.signerName} onChange={e => setCompanyInfo(c => ({...c, signerName: e.target.value}))} placeholder="เช่น นายสหัสวรรษ ระดมสิทธิพัฒน์" data-testid="input-signer" /></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">ตัวอย่าง อบจ.01-4 — ประจำเดือน{monthName} {thaiYear}</CardTitle>
            </CardHeader>
            <CardContent>
              <div ref={printRef014} className="bg-white p-6 border rounded text-sm" style={{ fontFamily: "'TH Sarabun New', 'Sarabun', serif" }}>
                <div className="text-center mb-4">
                  <p className="font-bold text-base">{companyInfo.localAuthority || "องค์การบริหารส่วนจังหวัด.................."}</p>
                  <p className="font-bold">แบบรายการภาษีบำรุงองค์การบริหารส่วนจังหวัด</p>
                  <p><strong>อบจ. 01-4</strong></p>
                  <p>ตามข้อบัญญัติองค์การบริหารส่วนจังหวัด (น้ำมัน / ก๊าซ)</p>
                </div>

                <div className="grid grid-cols-2 gap-x-8 mb-4 text-xs">
                  <div>
                    <p>ชื่อผู้ประกอบการ <strong>{companyInfo.companyName || "................................................"}</strong></p>
                    <p>ชื่อสถานการค้า <strong>{companyInfo.stationName || "................................................"}</strong></p>
                    <p>เลขประจำตัวผู้เสียภาษีอากร <strong>{companyInfo.taxId || "................................................"}</strong></p>
                    <p>สถานที่ตั้ง {companyInfo.address || "................................................"}</p>
                    <p>จังหวัด {companyInfo.province || "................................................"}</p>
                  </div>
                  <div className="text-right">
                    <p>ชำระภาษีบำรุงองค์การบริหารส่วนจังหวัด</p>
                    <p><strong>ประจำเดือน{monthName} {thaiYear}</strong></p>
                  </div>
                </div>

                <table className="w-full border-collapse border border-gray-400 text-xs">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-400 p-1 w-[60px]">รายการที่</th>
                      <th className="border border-gray-400 p-1">น้ำมัน / ก๊าซ (ชนิด)</th>
                      <th className="border border-gray-400 p-1 text-right w-[100px]">จำนวน (ลิตร)</th>
                      <th className="border border-gray-400 p-1 text-right w-[90px]">อัตราภาษี ลิตรละ</th>
                      <th className="border border-gray-400 p-1 text-right w-[80px]">บาท</th>
                      <th className="border border-gray-400 p-1 text-right w-[60px]">สตางค์</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formLines.length === 0 ? (
                      <tr><td colSpan={6} className="border border-gray-400 p-4 text-center text-gray-400">ไม่มีข้อมูลยอดขายในเดือนนี้</td></tr>
                    ) : formLines.map((line, idx) => (
                      <tr key={idx}>
                        <td className="border border-gray-400 p-1 text-center">{idx + 1}</td>
                        <td className="border border-gray-400 p-1 text-center">{line.name}</td>
                        <td className="border border-gray-400 p-1 text-right tabular-nums">{fmt(line.liters)}</td>
                        <td className="border border-gray-400 p-1 text-right tabular-nums">{Number(taxRate).toFixed(4)}</td>
                        <td className="border border-gray-400 p-1 text-right tabular-nums">{fmtInt(line.taxBaht)}</td>
                        <td className="border border-gray-400 p-1 text-right tabular-nums">{line.taxSatang}</td>
                      </tr>
                    ))}
                    <tr className="font-bold bg-gray-50">
                      <td colSpan={4} className="border border-gray-400 p-1 text-right">รวม</td>
                      <td className="border border-gray-400 p-1 text-right tabular-nums">{fmtInt(Math.floor(grandTotalTax014))}</td>
                      <td className="border border-gray-400 p-1 text-right tabular-nums">{Math.round((grandTotalTax014 - Math.floor(grandTotalTax014)) * 100)}</td>
                    </tr>
                  </tbody>
                </table>

                <div className="mt-4 grid grid-cols-2 gap-8 text-xs">
                  <div>
                    <p>ข้าพเจ้าขอรับรองว่ารายการที่แสดงในแบบรายการ</p>
                    <p>ภาษีบำรุงองค์การบริหารส่วนจังหวัดนี้ถูกต้องครบถ้วน</p>
                    <p>ตามความเป็นจริง</p>
                    <br />
                    <p>ลงชื่อ.......................................................................</p>
                    <p className="text-center">({companyInfo.signerName || "........................................"})</p>
                    <p className="text-center">ผู้ประกอบการสถานการค้าปลีก</p>
                    <p>วันที่.............เดือน.....{monthName}.....ปี...{thaiYear}...........</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">ยอดเงินภาษีที่ต้องชำระทั้งสิ้น {fmt(grandTotalTax014)} บาท</p>
                    <p className="italic">{numberToThaiText(grandTotalTax014)}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="form016" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                งบแสดงการรับ-จ่าย น้ำมัน/ก๊าซ (อบจ.01-6) — ประจำเดือน{monthName} {thaiYear}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                <div>
                  <Label>เดือน</Label>
                  <Select value={formMonth} onValueChange={setFormMonth}>
                    <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {THAI_MONTHS.map((m, i) => <SelectItem key={i+1} value={String(i+1)}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>ปี ค.ศ.</Label>
                  <Input type="number" value={formYear} onChange={e => setFormYear(e.target.value)} className="w-[100px]" />
                </div>
                <div className="flex items-end">
                  <Button onClick={() => handlePrint(printRef016)} className="bg-[#05b187] hover:bg-[#05b187]/90" data-testid="btn-print-016">
                    <Printer className="h-4 w-4 mr-2" /> พิมพ์ อบจ.01-6
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <div ref={printRef016} className="bg-white p-6 min-w-[800px]" style={{ fontFamily: "'TH Sarabun New', 'Sarabun', serif" }}>
                <div className="text-center mb-3">
                  <p className="font-bold text-base">งบแสดงการรับ - จ่าย น้ำมัน/ก๊าซ</p>
                  <p><strong>อบจ.01-6</strong></p>
                  <p className="text-sm">ชื่อสถานการค้า {companyInfo.stationName || "................................................"}</p>
                  <p className="text-sm">ประจำเดือน {monthName} {thaiYear}</p>
                </div>

                <table className="w-full border-collapse border border-gray-400 text-xs">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-400 p-1 text-left w-[200px]" rowSpan={2}>รายการ</th>
                      <th className="border border-gray-400 p-1" colSpan={products.length || 1}>น้ำมัน / ก๊าซ (ลิตร)</th>
                    </tr>
                    <tr className="bg-gray-50">
                      {products.length === 0 ? (
                        <th className="border border-gray-400 p-1">-</th>
                      ) : products.map((p: any) => (
                        <th key={p.id} className="border border-gray-400 p-1 text-right w-[100px]">{p.nameTh || p.name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-gray-400 p-1 font-medium">คงเหลือยกมา</td>
                      {products.map((p: any) => {
                        const tank = tanks.find((t: any) => t.fuelProductId === p.id);
                        return <td key={p.id} className="border border-gray-400 p-1 text-right tabular-nums">{fmt(tank?.currentVolume || 0)}</td>;
                      })}
                      {products.length === 0 && <td className="border border-gray-400 p-1 text-center">-</td>}
                    </tr>
                    <tr>
                      <td className="border border-gray-400 p-1 font-medium">ปริมาณการรับเข้า</td>
                      {products.map((p: any) => (
                        <td key={p.id} className="border border-gray-400 p-1 text-right tabular-nums">{fmt(receivingMap[p.id] || 0)}</td>
                      ))}
                      {products.length === 0 && <td className="border border-gray-400 p-1 text-center">-</td>}
                    </tr>
                    <tr className="bg-blue-50/50 font-medium">
                      <td className="border border-gray-400 p-1">รวมรับ</td>
                      {products.map((p: any) => {
                        const tank = tanks.find((t: any) => t.fuelProductId === p.id);
                        const openBal = Number(tank?.currentVolume || 0);
                        const received = receivingMap[p.id] || 0;
                        return <td key={p.id} className="border border-gray-400 p-1 text-right tabular-nums">{fmt(openBal + received)}</td>;
                      })}
                      {products.length === 0 && <td className="border border-gray-400 p-1 text-center">-</td>}
                    </tr>
                    <tr>
                      <td className="border border-gray-400 p-1 font-medium">ปริมาณการจำหน่ายภายในจังหวัด</td>
                      {products.map((p: any) => {
                        const sale = salesByProduct.find((s: any) => s.fuelProductId === p.id);
                        return <td key={p.id} className="border border-gray-400 p-1 text-right tabular-nums">{fmt(sale?.totalLiters || 0)}</td>;
                      })}
                      {products.length === 0 && <td className="border border-gray-400 p-1 text-center">-</td>}
                    </tr>
                    <tr>
                      <td className="border border-gray-400 p-1 font-medium">ผลต่างน้ำมันเพิ่มขึ้น / ลดลง</td>
                      {products.map((p: any) => (
                        <td key={p.id} className="border border-gray-400 p-1 text-right tabular-nums text-gray-500">-</td>
                      ))}
                      {products.length === 0 && <td className="border border-gray-400 p-1 text-center">-</td>}
                    </tr>
                    <tr className="bg-blue-50/50 font-medium">
                      <td className="border border-gray-400 p-1">รวมจ่าย</td>
                      {products.map((p: any) => {
                        const sale = salesByProduct.find((s: any) => s.fuelProductId === p.id);
                        return <td key={p.id} className="border border-gray-400 p-1 text-right tabular-nums">{fmt(sale?.totalLiters || 0)}</td>;
                      })}
                      {products.length === 0 && <td className="border border-gray-400 p-1 text-center">-</td>}
                    </tr>
                    <tr className="font-bold bg-green-50/50">
                      <td className="border border-gray-400 p-1">คงเหลือยกไป</td>
                      {products.map((p: any) => {
                        const tank = tanks.find((t: any) => t.fuelProductId === p.id);
                        const openBal = Number(tank?.currentVolume || 0);
                        const received = receivingMap[p.id] || 0;
                        const sale = salesByProduct.find((s: any) => s.fuelProductId === p.id);
                        const sold = Number(sale?.totalLiters || 0);
                        return <td key={p.id} className="border border-gray-400 p-1 text-right tabular-nums">{fmt(openBal + received - sold)}</td>;
                      })}
                      {products.length === 0 && <td className="border border-gray-400 p-1 text-center">-</td>}
                    </tr>
                  </tbody>
                </table>

                <div className="mt-4 text-right text-xs">
                  <p>ข้าพเจ้าขอรับรองว่ารายการที่แสดงไว้เป็นความจริงทุกประการ</p>
                  <p>(ลงชื่อ)..................................................ผู้ประกอบการ</p>
                  <p>({companyInfo.signerName || "........................................"})</p>
                  <p>วันที่............................................................</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-[500px]">
          <DialogHeader><DialogTitle>บันทึกภาษีท้องถิ่น</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>งวดภาษี</Label><Input placeholder="เช่น ก.พ. 2569" value={form.taxPeriod} onChange={e => setForm(f => ({ ...f, taxPeriod: e.target.value }))} data-testid="input-tax-period" /></div>
              <div><Label>ประเภท</Label>
                <Select value={form.taxType} onValueChange={v => setForm(f => ({ ...f, taxType: v }))}>
                  <SelectTrigger data-testid="select-tax-type"><SelectValue /></SelectTrigger>
                  <SelectContent>{TAX_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>หน่วยงานท้องถิ่น</Label><Input placeholder="เช่น อบจ.พระนครศรีอยุธยา" value={form.localAuthority} onChange={e => setForm(f => ({ ...f, localAuthority: e.target.value }))} data-testid="input-authority" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>ปริมาณขายรวม (ลิตร)</Label><Input type="number" step="0.01" value={form.totalLitersSold} onChange={e => setForm(f => ({ ...f, totalLitersSold: e.target.value }))} data-testid="input-liters-sold" /></div>
              <div><Label>อัตราภาษี (บาท/ลิตร)</Label><Input type="number" step="0.0001" value={form.taxRatePerLiter} onChange={e => setForm(f => ({ ...f, taxRatePerLiter: e.target.value }))} data-testid="input-tax-rate" /></div>
            </div>
            <div className="bg-blue-50 p-3 rounded">
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div><span className="text-muted-foreground">ภาษี:</span> <strong className="tabular-nums">฿{fmt(taxAmount)}</strong></div>
                <div><span className="text-muted-foreground">เงินเพิ่ม:</span>
                  <Input type="number" step="0.01" className="h-6 mt-0.5" value={form.surcharge} onChange={e => setForm(f => ({ ...f, surcharge: e.target.value }))} />
                </div>
                <div><span className="text-muted-foreground">รวมจ่าย:</span> <strong className="text-lg tabular-nums">฿{fmt(totalPayable)}</strong></div>
              </div>
            </div>
            <div><Label>กำหนดชำระ</Label><ThaiDateInput value={form.dueDate} onChange={(v: string) => setForm(f => ({ ...f, dueDate: v }))} dateEra={dateEra} dateFmt={dateFmt} data-testid="input-due-date" /></div>
            <div><Label>หมายเหตุ</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
            <Button className="w-full bg-[#05b187] hover:bg-[#05b187]/90" onClick={() => saveMutation.mutate({
              ...form,
              taxAmount: String(taxAmount.toFixed(2)),
              totalPayable: String(totalPayable.toFixed(2)),
              companyId: selectedCompanyId,
            })} disabled={saveMutation.isPending} data-testid="btn-save-tax">
              {saveMutation.isPending ? "กำลังบันทึก..." : "บันทึก"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </GasStationLayout>
  );
}
