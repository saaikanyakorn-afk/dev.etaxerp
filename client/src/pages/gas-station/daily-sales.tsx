import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import ThaiDateInput from "@/components/thai-date-input";
import { useDateSettings } from "@/hooks/use-date-settings";
import GasStationLayout from "@/components/gas-station-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CalendarDays, Save, Fuel, TrendingUp, Plus, Trash2, Banknote, CreditCard, Wallet, QrCode, Gift, DollarSign, FileText, CheckCircle, Users } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const PAYMENT_OPTIONS = [
  { value: "cash", label: "เงินสด", icon: Banknote },
  { value: "transfer", label: "เงินโอน", icon: Wallet },
  { value: "credit_card", label: "บัตรเครดิต", icon: CreditCard },
  { value: "debit_card", label: "บัตรเดบิต", icon: CreditCard },
  { value: "qr_payment", label: "QR Payment", icon: QrCode },
  { value: "fleet_card", label: "Fleet Card", icon: CreditCard },
  { value: "points", label: "ตัดแต้ม", icon: Gift },
  { value: "credit", label: "เชื่อ (AR)", icon: DollarSign },
];

type PaymentLine = { method: string; amount: string };

function fmt(n: number | string) {
  return Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getPaymentLabel(method: string) {
  return PAYMENT_OPTIONS.find(o => o.value === method)?.label || method;
}

export default function DailySales() {
  const { selectedCompanyId } = useCompany();
  const { toast } = useToast();
  const { dateEra, dateFmt } = useDateSettings();
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [saleDate, setSaleDate] = useState(today);
  const [paymentDialog, setPaymentDialog] = useState<{ nozzleId: number; amount: number } | null>(null);
  const [invoiceDialog, setInvoiceDialog] = useState(false);

  const { data: pumps = [] } = useQuery({
    queryKey: ["/api/gas-station/fuel-pumps", selectedCompanyId],
    queryFn: () => apiRequest("GET", `/api/gas-station/fuel-pumps?companyId=${selectedCompanyId}`).then(r => r.json()),
    enabled: !!selectedCompanyId,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["/api/gas-station/fuel-products", selectedCompanyId],
    queryFn: () => apiRequest("GET", `/api/gas-station/fuel-products?companyId=${selectedCompanyId}`).then(r => r.json()),
    enabled: !!selectedCompanyId,
  });

  const { data: existingSales = [] } = useQuery({
    queryKey: ["/api/gas-station/daily-sales", selectedCompanyId, saleDate],
    queryFn: () => apiRequest("GET", `/api/gas-station/daily-sales?companyId=${selectedCompanyId}&date=${saleDate}`).then(r => r.json()),
    enabled: !!selectedCompanyId,
  });

  const { data: creditCustomers = [] } = useQuery({
    queryKey: ["/api/gas-station/credit-customers", selectedCompanyId],
    queryFn: () => apiRequest("GET", `/api/gas-station/credit-customers?companyId=${selectedCompanyId}`).then(r => r.json()),
    enabled: !!selectedCompanyId,
  });

  const allNozzles: any[] = [];
  pumps.forEach((pump: any) => {
    (pump.nozzles || []).forEach((nozzle: any) => {
      const product = products.find((p: any) => p.id === nozzle.fuelProductId);
      const existing = existingSales.find((s: any) => s.nozzleId === nozzle.id);
      let existingPayments: PaymentLine[] = [];
      if (existing?.payments) {
        try { existingPayments = JSON.parse(existing.payments); } catch {}
      }
      if (existingPayments.length === 0 && existing?.paymentMethod) {
        existingPayments = [{ method: existing.paymentMethod, amount: existing.totalAmount || "0" }];
      }
      allNozzles.push({
        nozzleId: nozzle.id,
        nozzleNo: nozzle.nozzleNo,
        pumpNo: pump.pumpNo,
        pumpName: pump.name,
        fuelProductId: nozzle.fuelProductId,
        fuelName: product?.nameTh || "-",
        unitPrice: product?.unitPrice || "0",
        meterOpen: existing?.meterOpen || "",
        meterClose: existing?.meterClose || "",
        testLiters: existing?.testLiters || "0",
        existingPayments,
        creditCustomerId: existing?.creditCustomerId || null,
        existingId: existing?.id || null,
      });
    });
  });

  const [readings, setReadings] = useState<Record<number, { meterOpen: string; meterClose: string; testLiters: string }>>({});
  const [nozzlePayments, setNozzlePayments] = useState<Record<number, PaymentLine[]>>({});
  const [nozzleCreditCustomers, setNozzleCreditCustomers] = useState<Record<number, number | null>>({});

  const getReading = (nozzleId: number, field: string, fallback: string) => {
    return (readings[nozzleId] as any)?.[field] ?? fallback;
  };

  const setReading = (nozzleId: number, field: string, value: string) => {
    setReadings(prev => ({
      ...prev,
      [nozzleId]: { ...(prev[nozzleId] || {}), [field]: value },
    }));
  };

  const getPayments = (nozzleId: number, fallback: PaymentLine[]): PaymentLine[] => {
    return nozzlePayments[nozzleId] ?? fallback;
  };

  const setPayments = (nozzleId: number, payments: PaymentLine[]) => {
    setNozzlePayments(prev => ({ ...prev, [nozzleId]: payments }));
  };

  const getCreditCustomerId = (nozzleId: number, fallback: number | null): number | null => {
    return nozzleCreditCustomers[nozzleId] ?? fallback;
  };

  const calcLiters = (nozzle: any) => {
    const open = Number(getReading(nozzle.nozzleId, "meterOpen", nozzle.meterOpen) || 0);
    const close = Number(getReading(nozzle.nozzleId, "meterClose", nozzle.meterClose) || 0);
    const test = Number(getReading(nozzle.nozzleId, "testLiters", nozzle.testLiters) || 0);
    return Math.max(0, close - open - test);
  };

  const calcAmount = (nozzle: any) => {
    return calcLiters(nozzle) * Number(nozzle.unitPrice);
  };

  const totalLiters = allNozzles.reduce((s, n) => s + calcLiters(n), 0);
  const totalAmount = allNozzles.reduce((s, n) => s + calcAmount(n), 0);

  const productSummary = new Map<string, { name: string; liters: number; amount: number }>();
  allNozzles.forEach(n => {
    const existing = productSummary.get(n.fuelName) || { name: n.fuelName, liters: 0, amount: 0 };
    existing.liters += calcLiters(n);
    existing.amount += calcAmount(n);
    productSummary.set(n.fuelName, existing);
  });

  const saveMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/gas-station/daily-sales?companyId=${selectedCompanyId}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/gas-station/daily-sales"] });
      toast({ title: "บันทึกยอดขายสำเร็จ" });
    },
    onError: (e: any) => toast({ title: "เกิดข้อผิดพลาด", description: e.message, variant: "destructive" }),
  });

  const invoiceMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/gas-station/generate-invoices?companyId=${selectedCompanyId}`, { saleDate }),
    onSuccess: (res) => res.json().then((data: any) => {
      setInvoiceDialog(false);
      toast({ title: `สร้างใบกำกับสำเร็จ ${data.invoiceCount} ใบ` });
    }),
    onError: (e: any) => toast({ title: "เกิดข้อผิดพลาด", description: e.message, variant: "destructive" }),
  });

  const handleSave = () => {
    const lines = allNozzles.map(n => {
      const amount = calcAmount(n);
      const payments = getPayments(n.nozzleId, n.existingPayments);
      const finalPayments = payments.length > 0 ? payments : [{ method: "cash", amount: String(amount.toFixed(2)) }];
      const creditCustId = getCreditCustomerId(n.nozzleId, n.creditCustomerId);
      return {
        nozzleId: n.nozzleId,
        fuelProductId: n.fuelProductId,
        saleDate,
        meterOpen: getReading(n.nozzleId, "meterOpen", n.meterOpen),
        meterClose: getReading(n.nozzleId, "meterClose", n.meterClose),
        testLiters: getReading(n.nozzleId, "testLiters", n.testLiters),
        litersSold: String(calcLiters(n).toFixed(2)),
        unitPrice: n.unitPrice,
        totalAmount: String(amount.toFixed(2)),
        paymentMethod: finalPayments[0]?.method || "cash",
        payments: finalPayments,
        creditCustomerId: creditCustId,
      };
    });
    saveMutation.mutate({ saleDate, lines });
  };

  const [dialogPayments, setDialogPayments] = useState<PaymentLine[]>([]);

  const openPaymentDialog = (nozzleId: number, amount: number, existingPmts: PaymentLine[]) => {
    const pmts = existingPmts.length > 0
      ? existingPmts.map(p => ({ ...p, amount: String(p.amount) }))
      : [{ method: "cash", amount: String(amount.toFixed(2)) }];
    setDialogPayments(pmts);
    setPaymentDialog({ nozzleId, amount });
  };

  const addPaymentLine = () => {
    setDialogPayments(prev => [...prev, { method: "cash", amount: "" }]);
  };

  const removePaymentLine = (idx: number) => {
    setDialogPayments(prev => prev.filter((_, i) => i !== idx));
  };

  const updatePaymentLine = (idx: number, field: keyof PaymentLine, value: string) => {
    setDialogPayments(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p));
  };

  const savePaymentDialog = () => {
    if (!paymentDialog) return;
    const validPayments = dialogPayments.filter(p => Number(p.amount) > 0);
    setPayments(paymentDialog.nozzleId, validPayments);

    const hasCreditMethod = validPayments.some(p => p.method === "credit");
    if (!hasCreditMethod) {
      setNozzleCreditCustomers(prev => ({ ...prev, [paymentDialog.nozzleId]: null }));
    }
    setPaymentDialog(null);
  };

  const dialogTotal = dialogPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const dialogHasCredit = dialogPayments.some(p => p.method === "credit");

  const hasSalesData = existingSales.length > 0;

  // Invoice preview data
  const cashSalesTotal = allNozzles
    .filter(n => {
      const pmts = getPayments(n.nozzleId, n.existingPayments);
      return !pmts.some(p => p.method === "credit") || !getCreditCustomerId(n.nozzleId, n.creditCustomerId);
    })
    .reduce((s, n) => s + calcAmount(n), 0);

  const creditGroups = new Map<number, { name: string; total: number; items: any[] }>();
  allNozzles.forEach(n => {
    const pmts = getPayments(n.nozzleId, n.existingPayments);
    const custId = getCreditCustomerId(n.nozzleId, n.creditCustomerId);
    if (pmts.some(p => p.method === "credit") && custId) {
      const cust = creditCustomers.find((c: any) => c.id === custId);
      if (cust) {
        const existing = creditGroups.get(custId) || { name: (cust as any).customerName, total: 0, items: [] };
        existing.total += calcAmount(n);
        existing.items.push(n);
        creditGroups.set(custId, existing);
      }
    }
  });

  return (
    <GasStationLayout>
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
          <Fuel className="h-7 w-7 text-[#05b187]" />
          ยอดขายน้ำมันรายวัน
        </h1>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <ThaiDateInput value={saleDate} onChange={setSaleDate} dateEra={dateEra} dateFmt={dateFmt} className="w-[180px]" data-testid="input-sale-date" />
          </div>
          <Button onClick={handleSave} disabled={saveMutation.isPending || allNozzles.length === 0} className="bg-[#05b187] hover:bg-[#05b187]/90" data-testid="btn-save-sales">
            <Save className="h-4 w-4 mr-1" />
            {saveMutation.isPending ? "กำลังบันทึก..." : "บันทึกยอดขาย"}
          </Button>
          {hasSalesData && (
            <Button onClick={() => setInvoiceDialog(true)} variant="outline" className="border-blue-500 text-blue-600 hover:bg-blue-50" data-testid="btn-generate-invoice">
              <FileText className="h-4 w-4 mr-1" />
              สร้างใบกำกับภาษี
            </Button>
          )}
        </div>
      </div>

      {allNozzles.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Fuel className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg">ยังไม่มีตู้จ่ายน้ำมัน</p>
            <p className="text-sm">กรุณาตั้งค่าตู้จ่ายและหัวจ่ายในหน้า "ตั้งค่า" ก่อน</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow style={{ background: "var(--theme-table-header)" }}>
                    <TableHead className="text-white font-bold w-[50px]">ตู้</TableHead>
                    <TableHead className="text-white font-bold w-[40px]">หัว</TableHead>
                    <TableHead className="text-white font-bold">ชนิดน้ำมัน</TableHead>
                    <TableHead className="text-white font-bold text-right w-[120px]">มิเตอร์เปิด</TableHead>
                    <TableHead className="text-white font-bold text-right w-[120px]">มิเตอร์ปิด</TableHead>
                    <TableHead className="text-white font-bold text-right w-[80px]">ทดสอบ (ล.)</TableHead>
                    <TableHead className="text-white font-bold text-right w-[100px]">ลิตรขาย</TableHead>
                    <TableHead className="text-white font-bold text-right w-[80px]">ราคา/ลิตร</TableHead>
                    <TableHead className="text-white font-bold text-right w-[110px]">ยอดเงิน</TableHead>
                    <TableHead className="text-white font-bold w-[200px]">ช่องทางชำระ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allNozzles.map((n) => {
                    const liters = calcLiters(n);
                    const amount = calcAmount(n);
                    const payments = getPayments(n.nozzleId, n.existingPayments);
                    const hasCreditPmt = payments.some(p => p.method === "credit");
                    const custId = getCreditCustomerId(n.nozzleId, n.creditCustomerId);
                    return (
                      <TableRow key={n.nozzleId} className="hover:bg-blue-50/30" data-testid={`row-nozzle-${n.nozzleId}`}>
                        <TableCell className="font-mono font-medium">{n.pumpNo}</TableCell>
                        <TableCell className="font-mono">#{n.nozzleNo}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-medium">{n.fuelName}</Badge>
                        </TableCell>
                        <TableCell>
                          <Input type="number" step="0.01" className="text-right tabular-nums h-8"
                            value={getReading(n.nozzleId, "meterOpen", n.meterOpen)}
                            onChange={e => setReading(n.nozzleId, "meterOpen", e.target.value)}
                            data-testid={`input-meter-open-${n.nozzleId}`}
                          />
                        </TableCell>
                        <TableCell>
                          <Input type="number" step="0.01" className="text-right tabular-nums h-8"
                            value={getReading(n.nozzleId, "meterClose", n.meterClose)}
                            onChange={e => setReading(n.nozzleId, "meterClose", e.target.value)}
                            data-testid={`input-meter-close-${n.nozzleId}`}
                          />
                        </TableCell>
                        <TableCell>
                          <Input type="number" step="0.01" className="text-right tabular-nums h-8"
                            value={getReading(n.nozzleId, "testLiters", n.testLiters)}
                            onChange={e => setReading(n.nozzleId, "testLiters", e.target.value)}
                            data-testid={`input-test-liters-${n.nozzleId}`}
                          />
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium text-blue-700">{fmt(liters)}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">{fmt(n.unitPrice)}</TableCell>
                        <TableCell className="text-right tabular-nums font-bold">{fmt(amount)}</TableCell>
                        <TableCell>
                          {payments.length > 0 && amount > 0 ? (
                            <div className="space-y-0.5">
                              {payments.map((p, i) => (
                                <div key={i} className="flex items-center gap-1 text-xs">
                                  <Badge variant="secondary" className="text-[10px] px-1 py-0">{getPaymentLabel(p.method)}</Badge>
                                  <span className="tabular-nums">{fmt(p.amount)}</span>
                                </div>
                              ))}
                              {hasCreditPmt && (
                                <div className="mt-0.5">
                                  <Select
                                    value={custId ? String(custId) : ""}
                                    onValueChange={v => setNozzleCreditCustomers(prev => ({ ...prev, [n.nozzleId]: v ? Number(v) : null }))}
                                  >
                                    <SelectTrigger className="h-6 text-[10px] w-full" data-testid={`select-credit-customer-${n.nozzleId}`}>
                                      <SelectValue placeholder="เลือกลูกค้าเชื่อ" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {creditCustomers.map((c: any) => (
                                        <SelectItem key={c.id} value={String(c.id)}>{c.customerName}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                              <Button variant="ghost" size="sm" className="h-5 text-[10px] text-[#05b187] px-1"
                                onClick={() => openPaymentDialog(n.nozzleId, amount, payments)}
                                data-testid={`btn-edit-payment-${n.nozzleId}`}>
                                แก้ไข
                              </Button>
                            </div>
                          ) : amount > 0 ? (
                            <Button variant="outline" size="sm" className="h-7 text-xs"
                              onClick={() => openPaymentDialog(n.nozzleId, amount, [])}
                              data-testid={`btn-add-payment-${n.nozzleId}`}>
                              <Banknote className="h-3 w-3 mr-1" /> ระบุช่องทาง
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className="bg-gray-50 border-t-2 font-bold">
                    <TableCell colSpan={6} className="text-right pr-4 text-sm">รวมทั้งหมด</TableCell>
                    <TableCell className="text-right tabular-nums text-blue-700">{fmt(totalLiters)}</TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-right tabular-nums text-lg">{fmt(totalAmount)}</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from(productSummary.values()).map(ps => (
              <Card key={ps.name}>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{ps.name}</span>
                    <TrendingUp className="h-4 w-4 text-[#05b187]" />
                  </div>
                  <div className="text-xl font-bold tabular-nums">{fmt(ps.amount)}</div>
                  <div className="text-xs text-muted-foreground tabular-nums">{fmt(ps.liters)} ลิตร</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Payment Split Dialog */}
      <Dialog open={!!paymentDialog} onOpenChange={(open) => { if (!open) setPaymentDialog(null); }}>
        <DialogContent className="max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-[#05b187]" />
              แยกช่องทางชำระเงิน
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="bg-blue-50 p-3 rounded-lg flex justify-between items-center">
              <span className="text-sm">ยอดเงินรวม</span>
              <span className="text-lg font-bold tabular-nums">฿{fmt(paymentDialog?.amount || 0)}</span>
            </div>

            <div className="space-y-2">
              {dialogPayments.map((p, idx) => (
                <div key={idx} className="flex items-center gap-2" data-testid={`payment-line-${idx}`}>
                  <Select value={p.method} onValueChange={v => updatePaymentLine(idx, "method", v)}>
                    <SelectTrigger className="w-[150px] h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number" step="0.01" className="flex-1 h-9 text-right tabular-nums"
                    placeholder="จำนวนเงิน"
                    value={p.amount}
                    onChange={e => updatePaymentLine(idx, "amount", e.target.value)}
                    data-testid={`input-payment-amount-${idx}`}
                  />
                  {dialogPayments.length > 1 && (
                    <Button variant="ghost" size="sm" className="h-9 w-9 p-0 text-red-400 hover:text-red-600"
                      onClick={() => removePaymentLine(idx)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {dialogHasCredit && creditCustomers.length > 0 && (
              <div className="bg-orange-50 p-3 rounded-lg">
                <div className="flex items-center gap-1 text-xs text-orange-600 mb-1">
                  <Users className="h-3 w-3" /> ลูกค้าเชื่อจะเลือกได้ที่ตารางหลังจากยืนยัน
                </div>
              </div>
            )}

            <Button variant="outline" size="sm" className="w-full" onClick={addPaymentLine} data-testid="btn-add-payment-line">
              <Plus className="h-4 w-4 mr-1" /> เพิ่มช่องทาง
            </Button>

            <div className={`p-3 rounded-lg flex justify-between items-center ${Math.abs(dialogTotal - (paymentDialog?.amount || 0)) < 0.01 ? "bg-green-50" : "bg-red-50"}`}>
              <span className="text-sm">รวมที่ระบุ</span>
              <div className="text-right">
                <span className="text-lg font-bold tabular-nums">฿{fmt(dialogTotal)}</span>
                {Math.abs(dialogTotal - (paymentDialog?.amount || 0)) >= 0.01 && (
                  <p className="text-xs text-red-500">
                    ต่าง ฿{fmt(Math.abs(dialogTotal - (paymentDialog?.amount || 0)))}
                  </p>
                )}
              </div>
            </div>

            <Button className="w-full bg-[#05b187] hover:bg-[#05b187]/90" onClick={savePaymentDialog} data-testid="btn-save-payments">
              ยืนยัน
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Invoice Generation Dialog */}
      <Dialog open={invoiceDialog} onOpenChange={setInvoiceDialog}>
        <DialogContent className="max-w-[560px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              สร้างใบกำกับภาษีจากยอดขาย
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-blue-50 p-3 rounded-lg">
              <div className="text-sm text-blue-700 mb-1">วันที่ขาย: <strong>{saleDate}</strong></div>
              <div className="text-sm text-blue-700">ยอดขายรวม: <strong>฿{fmt(totalAmount)}</strong></div>
            </div>

            <div className="space-y-3">
              <div className="border rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Banknote className="h-4 w-4 text-green-600" />
                  <span className="font-medium text-sm">ใบกำกับอย่างย่อ (เงินสด/ลูกค้าทั่วไป)</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">รวมยอด</span>
                  <span className="font-bold tabular-nums">฿{fmt(cashSalesTotal)}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">สรุปรายวัน 1 ใบ → ใบกำกับภาษี</div>
              </div>

              {Array.from(creditGroups.entries()).map(([custId, group]) => (
                <div key={custId} className="border rounded-lg p-3 border-orange-200 bg-orange-50/30">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-4 w-4 text-orange-600" />
                    <span className="font-medium text-sm">{group.name}</span>
                    <Badge variant="outline" className="text-[10px] border-orange-300 text-orange-600">ลูกค้าเชื่อ</Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">ยอดเชื่อ {group.items.length} รายการ</span>
                    <span className="font-bold tabular-nums">฿{fmt(group.total)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">ออกใบกำกับเต็มรูปแยกรายลูกค้า</div>
                </div>
              ))}

              {creditGroups.size === 0 && creditCustomers.length === 0 && (
                <div className="text-xs text-muted-foreground bg-gray-50 p-2 rounded">
                  ยังไม่มีลูกค้าเชื่อ — เพิ่มได้ที่หน้า "ตั้งค่า" แท็บ "ลูกค้าเชื่อ"
                </div>
              )}
            </div>

            <div className="bg-gray-50 p-3 rounded-lg flex justify-between items-center">
              <span className="text-sm font-medium">รวมใบกำกับทั้งหมด</span>
              <span className="font-bold">{1 + creditGroups.size} ใบ</span>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setInvoiceDialog(false)}>
                ยกเลิก
              </Button>
              <Button
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                onClick={() => invoiceMutation.mutate()}
                disabled={invoiceMutation.isPending || totalAmount <= 0}
                data-testid="btn-confirm-invoice"
              >
                {invoiceMutation.isPending ? (
                  "กำลังสร้าง..."
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-1" /> ยืนยันสร้างใบกำกับ
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </GasStationLayout>
  );
}
