import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/lib/company-context";
import { apiRequest } from "@/lib/queryClient";
import ThaiDateInput from "@/components/thai-date-input";
import { useDateSettings } from "@/hooks/use-date-settings";
import { formatDate, formatNumber } from "@/lib/format";
import {
  Plus,
  FileText,
  CreditCard,
  Trash2,
  Eye,
  ArrowLeft,
  CheckCircle,
  Clock,
  AlertTriangle,
  Banknote,
  Info,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function getVatMessage(contractType: string, vehicleType: string) {
  if (contractType === "hire_purchase") {
    if (vehicleType === "passenger_car") {
      return { reclaimable: false, message: "VAT ตอนซื้อใช้ไม่ได้ → รวมเป็นต้นทุนทรัพย์สิน, ค่างวดไม่มี VAT" };
    }
    return { reclaimable: true, message: "VAT ตอนซื้อใช้ได้ → เป็นภาษีซื้อ, ค่างวดไม่มี VAT" };
  }
  if (vehicleType === "passenger_car") {
    return { reclaimable: false, message: "VAT ทุกงวดใช้ไม่ได้ → รวมเป็นค่าใช้จ่าย" };
  }
  return { reclaimable: true, message: "VAT ทุกงวดใช้ได้ → ใช้เป็นภาษีซื้อ" };
}

function computeAmortization(financeAmount: number, interestRate: number, totalInstallments: number, startDate: string, vatRate: number, contractType: string, vatReclaimable: boolean) {
  if (totalInstallments <= 0 || financeAmount <= 0) return [];
  const totalInterest = financeAmount * (interestRate / 100) * (totalInstallments / 12);
  const monthlyInterest = totalInstallments > 0 ? totalInterest / totalInstallments : 0;
  const monthlyPrincipal = financeAmount / totalInstallments;
  const monthlyPaymentBase = monthlyPrincipal + monthlyInterest;

  const schedules = [];
  const start = new Date(startDate + "T00:00:00");

  for (let i = 1; i <= totalInstallments; i++) {
    const dueDate = new Date(start);
    dueDate.setMonth(dueDate.getMonth() + i);
    const dueDateStr = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, "0")}-${String(dueDate.getDate()).padStart(2, "0")}`;

    let vatAmount = 0;
    if (contractType === "leasing") {
      vatAmount = monthlyPaymentBase * (vatRate / 100);
    }

    schedules.push({
      installmentNo: i,
      dueDate: dueDateStr,
      principal: Math.round(monthlyPrincipal * 100) / 100,
      interest: Math.round(monthlyInterest * 100) / 100,
      vatAmount: Math.round(vatAmount * 100) / 100,
      totalAmount: Math.round((monthlyPaymentBase + vatAmount) * 100) / 100,
    });
  }
  return schedules;
}

export default function InstallmentContracts() {
  const [, navigate] = useLocation();
  const { selectedCompanyId } = useCompany();
  const { dateEra, dateFmt } = useDateSettings();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedContract, setSelectedContract] = useState<any>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [payingScheduleId, setPayingScheduleId] = useState<number | null>(null);

  const [form, setForm] = useState({
    assetId: "",
    contractNo: "",
    contractType: "hire_purchase",
    vehicleType: "other",
    financeCompany: "",
    totalPrice: "",
    downPayment: "0",
    interestRate: "0",
    totalInstallments: "12",
    vatRate: "7",
    startDate: "",
    paymentAccountCode: "1001000",
    liabilityAccountCode: "2103400",
    interestAccountCode: "5901000",
    notes: "",
  });

  const { data: contracts = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/asset-installments", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/asset-installments?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return [];
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!selectedCompanyId,
  });

  const { data: assets = [] } = useQuery<any[]>({
    queryKey: ["/api/fixed-assets", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/fixed-assets?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return [];
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!selectedCompanyId,
  });

  const { data: contractDetail } = useQuery<any>({
    queryKey: ["/api/asset-installments", selectedContract?.id],
    queryFn: async () => {
      const r = await fetch(`/api/asset-installments/${selectedContract?.id}`, { credentials: "include" });
      if (!r.ok) return null;
      return r.json();
    },
    enabled: !!selectedContract?.id && showDetailDialog,
  });

  const vatInfo = useMemo(() => getVatMessage(form.contractType, form.vehicleType), [form.contractType, form.vehicleType]);

  const financeAmount = useMemo(() => {
    const total = parseFloat(form.totalPrice) || 0;
    const down = parseFloat(form.downPayment) || 0;
    return total - down;
  }, [form.totalPrice, form.downPayment]);

  const previewSchedules = useMemo(() => {
    if (!form.startDate || financeAmount <= 0) return [];
    return computeAmortization(
      financeAmount,
      parseFloat(form.interestRate) || 0,
      parseInt(form.totalInstallments) || 0,
      form.startDate,
      parseFloat(form.vatRate) || 7,
      form.contractType,
      vatInfo.reclaimable,
    );
  }, [financeAmount, form.interestRate, form.totalInstallments, form.startDate, form.vatRate, form.contractType, vatInfo.reclaimable]);

  const monthlyPayment = useMemo(() => {
    if (previewSchedules.length === 0) return 0;
    return previewSchedules[0].totalAmount;
  }, [previewSchedules]);

  function updateField(field: string, value: string) {
    setForm(prev => {
      const next = { ...prev, [field]: value };
      if (field === "contractType") {
        next.liabilityAccountCode = value === "leasing" ? "2103500" : "2103400";
      }
      return next;
    });
  }

  function resetForm() {
    setForm({
      assetId: "",
      contractNo: "",
      contractType: "hire_purchase",
      vehicleType: "other",
      financeCompany: "",
      totalPrice: "",
      downPayment: "0",
      interestRate: "0",
      totalInstallments: "12",
      vatRate: "7",
      startDate: "",
      paymentAccountCode: "1001000",
      liabilityAccountCode: "2103400",
      interestAccountCode: "5901000",
      notes: "",
    });
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      const body = {
        companyId: selectedCompanyId,
        assetId: form.assetId ? parseInt(form.assetId) : null,
        contractNo: form.contractNo,
        contractType: form.contractType,
        vehicleType: form.vehicleType,
        financeCompany: form.financeCompany,
        totalPrice: form.totalPrice,
        downPayment: form.downPayment,
        financeAmount: String(financeAmount),
        interestRate: form.interestRate,
        totalInstallments: parseInt(form.totalInstallments),
        monthlyPayment: String(monthlyPayment),
        vatRate: form.vatRate,
        vatReclaimable: vatInfo.reclaimable,
        startDate: form.startDate,
        paymentAccountCode: form.paymentAccountCode,
        liabilityAccountCode: form.liabilityAccountCode,
        interestAccountCode: form.interestAccountCode,
        notes: form.notes,
        status: "active",
      };
      const res = await apiRequest("POST", "/api/asset-installments", body);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "สร้างสัญญาผ่อนชำระสำเร็จ" });
      queryClient.invalidateQueries({ queryKey: ["/api/asset-installments"] });
      setShowCreateDialog(false);
      resetForm();
    },
    onError: (err: any) => {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    },
  });

  const payMutation = useMutation({
    mutationFn: async ({ contractId, scheduleId }: { contractId: number; scheduleId: number }) => {
      const res = await apiRequest("POST", `/api/asset-installments/${contractId}/pay/${scheduleId}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "จ่ายค่างวดสำเร็จ" });
      queryClient.invalidateQueries({ queryKey: ["/api/asset-installments"] });
      setPayingScheduleId(null);
    },
    onError: (err: any) => {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
      setPayingScheduleId(null);
    },
  });

  const batchPayMutation = useMutation({
    mutationFn: async (contractId: number) => {
      const res = await apiRequest("POST", `/api/asset-installments/${contractId}/pay-batch`);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: `จ่ายค่างวดสำเร็จ ${data?.paidCount || 0} งวด` });
      queryClient.invalidateQueries({ queryKey: ["/api/asset-installments"] });
    },
    onError: (err: any) => {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/asset-installments/${id}`);
    },
    onSuccess: () => {
      toast({ title: "ลบสัญญาสำเร็จ" });
      queryClient.invalidateQueries({ queryKey: ["/api/asset-installments"] });
      setShowDeleteDialog(false);
      setDeleteId(null);
      if (showDetailDialog) {
        setShowDetailDialog(false);
        setSelectedContract(null);
      }
    },
    onError: (err: any) => {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    },
  });

  function getStatusBadge(status: string) {
    switch (status) {
      case "active":
        return <Badge className="bg-lime-500 text-white hover:bg-lime-600 text-[9px] font-normal px-2 py-0" data-testid="badge-status-active">ใช้งาน</Badge>;
      case "completed":
        return <Badge className="bg-sky-500 text-white hover:bg-sky-600 text-[9px] font-normal px-2 py-0" data-testid="badge-status-completed">เสร็จสิ้น</Badge>;
      case "cancelled":
        return <Badge className="bg-gray-400 text-white hover:bg-gray-500 text-[9px] font-normal px-2 py-0" data-testid="badge-status-cancelled">ยกเลิก</Badge>;
      default:
        return <Badge variant="outline" className="text-[9px]">{status}</Badge>;
    }
  }

  function getScheduleStatusBadge(status: string) {
    switch (status) {
      case "paid":
        return <Badge className="bg-lime-500 text-white text-[9px] px-2 py-0"><CheckCircle className="h-3 w-3 mr-0.5" />จ่ายแล้ว</Badge>;
      case "overdue":
        return <Badge className="bg-red-500 text-white text-[9px] px-2 py-0"><AlertTriangle className="h-3 w-3 mr-0.5" />เกินกำหนด</Badge>;
      default:
        return <Badge className="bg-amber-400 text-white text-[9px] px-2 py-0"><Clock className="h-3 w-3 mr-0.5" />รอจ่าย</Badge>;
    }
  }

  const detail = contractDetail || selectedContract;
  const schedules = contractDetail?.schedules || [];

  const todayStr = new Date().toISOString().split("T")[0];
  const dueSchedules = schedules.filter((s: any) => s.status === "pending" && s.dueDate <= todayStr);

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-[var(--theme-primary)]" />
            <h1 className="text-xl font-heading font-bold" data-testid="text-page-title">สัญญาผ่อนชำระทรัพย์สิน</h1>
          </div>
          <Button
            size="sm"
            style={{ background: "var(--theme-primary)" }} className="hover:opacity-90 text-white h-8 text-xs"
            onClick={() => { resetForm(); setShowCreateDialog(true); }}
            data-testid="button-create-contract"
          >
            <Plus className="h-4 w-4 mr-1" /> สร้างสัญญาใหม่
          </Button>
        </div>

        <Card className="rounded-none shadow-sm border-t-4 border-t-[var(--theme-primary)]">
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader style={{ background: "var(--theme-table-header)" }}>
                <TableRow className="hover:bg-transparent border-none h-10">
                  <TableHead className="text-white text-[11px] font-normal text-center">เลขที่สัญญา</TableHead>
                  <TableHead className="text-white text-[11px] font-normal">ประเภท</TableHead>
                  <TableHead className="text-white text-[11px] font-normal">บริษัทไฟแนนซ์</TableHead>
                  <TableHead className="text-white text-[11px] font-normal text-right">ราคารวม</TableHead>
                  <TableHead className="text-white text-[11px] font-normal text-right">ยอดคงเหลือ</TableHead>
                  <TableHead className="text-white text-[11px] font-normal text-center">งวดที่จ่าย/ทั้งหมด</TableHead>
                  <TableHead className="text-white text-[11px] font-normal text-center">สถานะ</TableHead>
                  <TableHead className="text-white text-[11px] font-normal text-center">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-sm text-muted-foreground">กำลังโหลด...</TableCell>
                  </TableRow>
                ) : contracts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-sm text-muted-foreground" data-testid="text-empty-state">
                      ยังไม่มีสัญญาผ่อนชำระ กดปุ่ม "สร้างสัญญาใหม่" เพื่อเริ่มต้น
                    </TableCell>
                  </TableRow>
                ) : (
                  contracts.map((c: any) => (
                    <TableRow key={c.id} className="hover:bg-slate-50 border-b h-12" data-testid={`row-contract-${c.id}`}>
                      <TableCell className="text-[11px] text-center font-medium" style={{ color: "var(--theme-primary)" }} data-testid={`text-contract-no-${c.id}`}>
                        {c.contractNo}
                      </TableCell>
                      <TableCell className="text-[11px]" data-testid={`text-type-${c.id}`}>
                        {c.contractType === "hire_purchase" ? "เช่าซื้อ (HP)" : "ลิสซิ่ง"}
                        {c.vehicleType === "passenger_car" && <span className="text-amber-600 ml-1">(รถยนต์นั่ง)</span>}
                      </TableCell>
                      <TableCell className="text-[11px]" data-testid={`text-finance-${c.id}`}>{c.financeCompany || "-"}</TableCell>
                      <TableCell className="text-[11px] text-right" data-testid={`text-total-${c.id}`}>{formatNumber(c.totalPrice)}</TableCell>
                      <TableCell className="text-[11px] text-right" data-testid={`text-remaining-${c.id}`}>{formatNumber(c.remainingBalance)}</TableCell>
                      <TableCell className="text-[11px] text-center" data-testid={`text-installments-${c.id}`}>
                        {c.paidInstallments || 0}/{c.totalInstallments}
                      </TableCell>
                      <TableCell className="text-center" data-testid={`text-status-${c.id}`}>
                        {getStatusBadge(c.status)}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() => { setSelectedContract(c); setShowDetailDialog(true); }}
                            data-testid={`button-view-${c.id}`}
                          >
                            <Eye className="h-3.5 w-3.5 text-sky-600" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() => { setDeleteId(c.id); setShowDeleteDialog(true); }}
                            data-testid={`button-delete-${c.id}`}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-[var(--theme-primary)]" />
              สร้างสัญญาผ่อนชำระใหม่
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>เลขที่สัญญา *</Label>
                <Input value={form.contractNo} onChange={e => updateField("contractNo", e.target.value)} data-testid="input-contract-no" />
              </div>
              <div>
                <Label>ประเภทสัญญา *</Label>
                <Select value={form.contractType} onValueChange={v => updateField("contractType", v)}>
                  <SelectTrigger data-testid="select-contract-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hire_purchase">เช่าซื้อ (Hire Purchase)</SelectItem>
                    <SelectItem value="leasing">ลิสซิ่ง (Leasing)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>ประเภทยานพาหนะ</Label>
                <Select value={form.vehicleType} onValueChange={v => updateField("vehicleType", v)}>
                  <SelectTrigger data-testid="select-vehicle-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="other">อื่นๆ / ไม่ใช่ยานพาหนะ</SelectItem>
                    <SelectItem value="passenger_car">รถยนต์นั่ง ≤ 10 ที่นั่ง</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className={`p-3 rounded-md border text-sm flex items-start gap-2 ${vatInfo.reclaimable ? "bg-green-50 border-green-200 text-green-800" : "bg-amber-50 border-amber-200 text-amber-800"}`} data-testid="text-vat-info">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <span className="font-semibold">VAT: </span>
                {vatInfo.reclaimable ? "ใช้ภาษีซื้อได้" : "ใช้ภาษีซื้อไม่ได้"} — {vatInfo.message}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>ทรัพย์สิน (เลือกจากทะเบียน)</Label>
                <Select value={form.assetId} onValueChange={v => updateField("assetId", v)}>
                  <SelectTrigger data-testid="select-asset">
                    <SelectValue placeholder="เลือกทรัพย์สิน (ถ้ามี)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">ไม่เลือก</SelectItem>
                    {assets.map((a: any) => (
                      <SelectItem key={a.id} value={String(a.id)}>{a.assetCode} - {a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>บริษัทไฟแนนซ์</Label>
                <Input value={form.financeCompany} onChange={e => updateField("financeCompany", e.target.value)} data-testid="input-finance-company" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label>ราคารวม (รวม VAT) *</Label>
                <Input type="number" step="0.01" value={form.totalPrice} onChange={e => updateField("totalPrice", e.target.value)} data-testid="input-total-price" />
              </div>
              <div>
                <Label>เงินดาวน์</Label>
                <Input type="number" step="0.01" value={form.downPayment} onChange={e => updateField("downPayment", e.target.value)} data-testid="input-down-payment" />
              </div>
              <div>
                <Label>ยอดจัดไฟแนนซ์</Label>
                <Input value={formatNumber(financeAmount)} readOnly className="bg-slate-50" data-testid="text-finance-amount" />
              </div>
              <div>
                <Label>อัตราดอกเบี้ย (%/ปี)</Label>
                <Input type="number" step="0.01" value={form.interestRate} onChange={e => updateField("interestRate", e.target.value)} data-testid="input-interest-rate" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label>จำนวนงวด *</Label>
                <Input type="number" value={form.totalInstallments} onChange={e => updateField("totalInstallments", e.target.value)} data-testid="input-total-installments" />
              </div>
              <div>
                <Label>อัตรา VAT (%)</Label>
                <Input type="number" step="0.01" value={form.vatRate} onChange={e => updateField("vatRate", e.target.value)} data-testid="input-vat-rate" />
              </div>
              <div>
                <Label>วันที่เริ่มสัญญา *</Label>
                <ThaiDateInput value={form.startDate} onChange={(v: string) => updateField("startDate", v)} dateEra={dateEra} dateFmt={dateFmt} data-testid="input-start-date" />
              </div>
              <div>
                <Label>ค่างวดต่อเดือน</Label>
                <Input value={formatNumber(monthlyPayment)} readOnly className="bg-slate-50 font-semibold" data-testid="text-monthly-payment" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>บัญชีจ่ายเงิน</Label>
                <Input value={form.paymentAccountCode} onChange={e => updateField("paymentAccountCode", e.target.value)} data-testid="input-payment-account" />
              </div>
              <div>
                <Label>บัญชีเจ้าหนี้/หนี้สิน</Label>
                <Input value={form.liabilityAccountCode} onChange={e => updateField("liabilityAccountCode", e.target.value)} data-testid="input-liability-account" />
              </div>
              <div>
                <Label>บัญชีดอกเบี้ยจ่าย</Label>
                <Input value={form.interestAccountCode} onChange={e => updateField("interestAccountCode", e.target.value)} data-testid="input-interest-account" />
              </div>
            </div>

            <div>
              <Label>หมายเหตุ</Label>
              <Textarea value={form.notes} onChange={e => updateField("notes", e.target.value)} rows={2} data-testid="input-notes" />
            </div>

            {previewSchedules.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-1">
                  <Banknote className="h-4 w-4 text-sky-600" />
                  ตาราง Amortization (Preview)
                </h3>
                <div className="max-h-64 overflow-y-auto border rounded">
                  <Table>
                    <TableHeader className="bg-slate-100 sticky top-0">
                      <TableRow>
                        <TableHead className="text-[10px] text-center">งวดที่</TableHead>
                        <TableHead className="text-[10px] text-center">วันครบกำหนด</TableHead>
                        <TableHead className="text-[10px] text-right">เงินต้น</TableHead>
                        <TableHead className="text-[10px] text-right">ดอกเบี้ย</TableHead>
                        <TableHead className="text-[10px] text-right">VAT</TableHead>
                        <TableHead className="text-[10px] text-right">ยอดรวม</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewSchedules.map((s) => (
                        <TableRow key={s.installmentNo} className="h-8">
                          <TableCell className="text-[10px] text-center">{s.installmentNo}</TableCell>
                          <TableCell className="text-[10px] text-center">{formatDate(s.dueDate, dateEra, dateFmt)}</TableCell>
                          <TableCell className="text-[10px] text-right">{formatNumber(s.principal)}</TableCell>
                          <TableCell className="text-[10px] text-right">{formatNumber(s.interest)}</TableCell>
                          <TableCell className="text-[10px] text-right">{formatNumber(s.vatAmount)}</TableCell>
                          <TableCell className="text-[10px] text-right font-medium">{formatNumber(s.totalAmount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} data-testid="button-cancel-create">ยกเลิก</Button>
            <Button
              style={{ background: "var(--theme-primary)" }} className="hover:opacity-90 text-white"
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !form.contractNo || !form.totalPrice || !form.startDate}
              data-testid="button-save-contract"
            >
              {createMutation.isPending ? "กำลังบันทึก..." : "บันทึกสัญญา"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDetailDialog} onOpenChange={(open) => { setShowDetailDialog(open); if (!open) setSelectedContract(null); }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-sky-600" />
              รายละเอียดสัญญา: {detail?.contractNo}
            </DialogTitle>
          </DialogHeader>

          {detail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <span className="text-xs text-muted-foreground">ประเภทสัญญา</span>
                  <p className="text-sm font-medium" data-testid="text-detail-type">
                    {detail.contractType === "hire_purchase" ? "เช่าซื้อ (HP)" : "ลิสซิ่ง"}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">ประเภทรถ</span>
                  <p className="text-sm font-medium" data-testid="text-detail-vehicle">
                    {detail.vehicleType === "passenger_car" ? "รถยนต์นั่ง" : "อื่นๆ"}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">บริษัทไฟแนนซ์</span>
                  <p className="text-sm font-medium" data-testid="text-detail-finance">{detail.financeCompany || "-"}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">สถานะ</span>
                  <div data-testid="text-detail-status">{getStatusBadge(detail.status)}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div>
                  <span className="text-xs text-muted-foreground">ราคารวม</span>
                  <p className="text-sm font-semibold" data-testid="text-detail-total">{formatNumber(detail.totalPrice)}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">เงินดาวน์</span>
                  <p className="text-sm font-medium" data-testid="text-detail-down">{formatNumber(detail.downPayment)}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">ยอดจัดไฟแนนซ์</span>
                  <p className="text-sm font-medium" data-testid="text-detail-finance-amount">{formatNumber(detail.financeAmount)}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">ดอกเบี้ย (%)</span>
                  <p className="text-sm font-medium" data-testid="text-detail-rate">{detail.interestRate}%</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">ยอดคงเหลือ</span>
                  <p className="text-sm font-semibold text-red-600" data-testid="text-detail-remaining">{formatNumber(detail.remainingBalance)}</p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-1">
                  <Banknote className="h-4 w-4 text-sky-600" />
                  ตารางค่างวด ({detail.paidInstallments || 0}/{detail.totalInstallments} งวด)
                </h3>
                <div className="flex gap-2">
                  {dueSchedules.length > 0 && detail.status === "active" && (
                    <Button
                      size="sm"
                      className="bg-sky-500 hover:bg-sky-600 h-7 text-xs"
                      onClick={() => batchPayMutation.mutate(detail.id)}
                      disabled={batchPayMutation.isPending}
                      data-testid="button-batch-pay"
                    >
                      <CheckCircle className="h-3 w-3 mr-1" />
                      {batchPayMutation.isPending ? "กำลังจ่าย..." : `จ่ายค่างวดที่ถึงกำหนด (${dueSchedules.length} งวด)`}
                    </Button>
                  )}
                </div>
              </div>

              <div className="max-h-96 overflow-y-auto border rounded">
                <Table>
                  <TableHeader className="bg-slate-100 sticky top-0">
                    <TableRow>
                      <TableHead className="text-[10px] text-center">งวดที่</TableHead>
                      <TableHead className="text-[10px] text-center">วันครบกำหนด</TableHead>
                      <TableHead className="text-[10px] text-right">เงินต้น</TableHead>
                      <TableHead className="text-[10px] text-right">ดอกเบี้ย</TableHead>
                      <TableHead className="text-[10px] text-right">VAT</TableHead>
                      <TableHead className="text-[10px] text-right">ยอดรวม</TableHead>
                      <TableHead className="text-[10px] text-center">สถานะ</TableHead>
                      <TableHead className="text-[10px] text-center">วันที่จ่าย</TableHead>
                      <TableHead className="text-[10px] text-center">จัดการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {schedules.map((s: any) => {
                      const isOverdue = s.status === "pending" && s.dueDate < todayStr;
                      return (
                        <TableRow
                          key={s.id}
                          className={`h-8 ${s.status === "paid" ? "bg-green-50" : isOverdue ? "bg-red-50" : ""}`}
                          data-testid={`row-schedule-${s.id}`}
                        >
                          <TableCell className="text-[10px] text-center">{s.installmentNo}</TableCell>
                          <TableCell className="text-[10px] text-center">{formatDate(s.dueDate, dateEra, dateFmt)}</TableCell>
                          <TableCell className="text-[10px] text-right">{formatNumber(s.principal)}</TableCell>
                          <TableCell className="text-[10px] text-right">{formatNumber(s.interest)}</TableCell>
                          <TableCell className="text-[10px] text-right">{formatNumber(s.vatAmount)}</TableCell>
                          <TableCell className="text-[10px] text-right font-medium">{formatNumber(s.totalAmount)}</TableCell>
                          <TableCell className="text-center">
                            {getScheduleStatusBadge(isOverdue ? "overdue" : s.status)}
                          </TableCell>
                          <TableCell className="text-[10px] text-center">{s.paidDate ? formatDate(s.paidDate, dateEra, dateFmt) : "-"}</TableCell>
                          <TableCell className="text-center">
                            {s.status === "pending" && detail.status === "active" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 text-[10px] px-2 border-sky-400 text-sky-600 hover:bg-sky-50"
                                onClick={() => {
                                  setPayingScheduleId(s.id);
                                  payMutation.mutate({ contractId: detail.id, scheduleId: s.id });
                                }}
                                disabled={payMutation.isPending && payingScheduleId === s.id}
                                data-testid={`button-pay-${s.id}`}
                              >
                                {payMutation.isPending && payingScheduleId === s.id ? "..." : "จ่าย"}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDetailDialog(false); setSelectedContract(null); }} data-testid="button-close-detail">
              ปิด
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบสัญญา</AlertDialogTitle>
            <AlertDialogDescription>
              คุณต้องการลบสัญญาผ่อนชำระนี้หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "กำลังลบ..." : "ลบสัญญา"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
