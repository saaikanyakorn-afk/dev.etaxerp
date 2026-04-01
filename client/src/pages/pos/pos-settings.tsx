import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import PosLayout from "@/components/pos-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Settings, CreditCard, Receipt, Store, Printer, Plus, Pencil, Trash2, Save,
  Banknote, QrCode, Smartphone, Wallet
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const PM_ICONS: Record<string, any> = {
  cash: Banknote, credit_card: CreditCard, promptpay: QrCode, transfer: Smartphone, ewallet: Wallet,
};

export default function PosSettings() {
  const { selectedCompanyId } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pmDialogOpen, setPmDialogOpen] = useState(false);
  const [editPm, setEditPm] = useState<any>(null);
  const [deletePmId, setDeletePmId] = useState<number | null>(null);
  const [pmForm, setPmForm] = useState({ name: "", type: "cash", isActive: true });

  const { data: paymentMethods = [], isLoading: pmLoading } = useQuery({
    queryKey: ["/api/payment-methods", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/payment-methods?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const { data: branches = [] } = useQuery({
    queryKey: ["/api/pos/branches", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/pos/branches?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const createPmMutation = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch("/api/payment-methods", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ ...data, companyId: selectedCompanyId }),
      });
      if (!r.ok) throw new Error((await r.json()).message || "Error");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-methods"] });
      setPmDialogOpen(false);
      toast({ title: "เพิ่มช่องทางชำระเงินแล้ว" });
    },
    onError: (e: any) => toast({ title: "เกิดข้อผิดพลาด", description: e.message, variant: "destructive" }),
  });

  const updatePmMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const r = await fetch(`/api/payment-methods/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ ...data, companyId: selectedCompanyId }),
      });
      if (!r.ok) throw new Error((await r.json()).message || "Error");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-methods"] });
      setPmDialogOpen(false);
      setEditPm(null);
      toast({ title: "อัปเดตแล้ว" });
    },
    onError: (e: any) => toast({ title: "เกิดข้อผิดพลาด", description: e.message, variant: "destructive" }),
  });

  const deletePmMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/payment-methods/${id}?companyId=${selectedCompanyId}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) throw new Error("Error");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-methods"] });
      setDeletePmId(null);
      toast({ title: "ลบแล้ว" });
    },
  });

  const openCreatePm = () => {
    setEditPm(null);
    setPmForm({ name: "", type: "cash", isActive: true });
    setPmDialogOpen(true);
  };

  const openEditPm = (pm: any) => {
    setEditPm(pm);
    setPmForm({ name: pm.name || "", type: pm.type || "cash", isActive: pm.isActive !== false });
    setPmDialogOpen(true);
  };

  const savePm = () => {
    if (!pmForm.name.trim()) return toast({ title: "กรุณากรอกชื่อ", variant: "destructive" });
    if (editPm) updatePmMutation.mutate({ id: editPm.id, data: pmForm });
    else createPmMutation.mutate(pmForm);
  };

  const PM_TYPES = [
    { value: "cash", label: "เงินสด" },
    { value: "credit_card", label: "บัตรเครดิต" },
    { value: "promptpay", label: "พร้อมเพย์" },
    { value: "transfer", label: "โอนเงิน" },
    { value: "ewallet", label: "E-Wallet" },
  ];

  return (
    <PosLayout>
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2" data-testid="text-page-title">
            <Settings className="w-6 h-6 text-[#03c9d7]" /> ตั้งค่า POS
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">จัดการช่องทางชำระเงิน สาขา และการตั้งค่าทั่วไป</p>
        </div>

        <Card className="border-none shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-[#03c9d7]" /> ช่องทางชำระเงิน
              </CardTitle>
              <Button size="sm" onClick={openCreatePm} className="bg-[#03c9d7] hover:bg-[#02b5c2] text-white" data-testid="button-add-payment">
                <Plus className="w-4 h-4 mr-1" /> เพิ่มช่องทาง
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {pmLoading ? (
              <div className="text-center py-8 text-slate-400">กำลังโหลด...</div>
            ) : paymentMethods.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <CreditCard className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                <p>ยังไม่มีช่องทางชำระเงิน</p>
                <Button variant="outline" size="sm" className="mt-2" onClick={openCreatePm}>เพิ่มช่องทาง</Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ชื่อ</TableHead>
                    <TableHead>ประเภท</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead className="text-right">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paymentMethods.map((pm: any) => {
                    const Icon = PM_ICONS[pm.type] || CreditCard;
                    return (
                      <TableRow key={pm.id} data-testid={`row-pm-${pm.id}`}>
                        <TableCell className="font-medium flex items-center gap-2">
                          <Icon className="w-4 h-4 text-slate-500" /> {pm.name}
                        </TableCell>
                        <TableCell className="text-sm">{PM_TYPES.find(t => t.value === pm.type)?.label || pm.type}</TableCell>
                        <TableCell>
                          {pm.isActive !== false
                            ? <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">เปิดใช้งาน</Badge>
                            : <Badge className="bg-slate-100 text-slate-500 border-slate-200 text-xs">ปิดใช้งาน</Badge>
                          }
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openEditPm(pm)} data-testid={`button-edit-pm-${pm.id}`}>
                              <Pencil className="w-4 h-4 text-slate-500" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setDeletePmId(pm.id)} data-testid={`button-delete-pm-${pm.id}`}>
                              <Trash2 className="w-4 h-4 text-red-400" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Store className="w-5 h-5 text-[#03c9d7]" /> สาขาที่เปิดใช้งาน
            </CardTitle>
          </CardHeader>
          <CardContent>
            {branches.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-sm">ยังไม่มีสาขา</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {branches.map((b: any) => (
                  <div key={b.id} className="flex items-center justify-between p-3 rounded-lg border bg-white" data-testid={`card-branch-${b.id}`}>
                    <div>
                      <div className="font-medium text-slate-800">{b.name}</div>
                      <div className="text-xs text-slate-400">{b.code || ""} {b.address ? `• ${b.address}` : ""}</div>
                    </div>
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">เปิดใช้งาน</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt className="w-5 h-5 text-[#03c9d7]" /> การตั้งค่าใบเสร็จ
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <div className="font-medium text-sm text-slate-800">ออกใบกำกับภาษีอัตโนมัติ</div>
                <div className="text-xs text-slate-400">ออกใบกำกับภาษีทุกครั้งเมื่อปิดกะขาย</div>
              </div>
              <Switch defaultChecked data-testid="switch-auto-invoice" />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <div className="font-medium text-sm text-slate-800">พิมพ์ใบเสร็จอัตโนมัติ</div>
                <div className="text-xs text-slate-400">พิมพ์ใบเสร็จทันทีหลังจากชำระเงินสำเร็จ</div>
              </div>
              <Switch data-testid="switch-auto-print" />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <div className="font-medium text-sm text-slate-800">แสดง QR PromptPay</div>
                <div className="text-xs text-slate-400">แสดง QR Code พร้อมเพย์ในหน้าชำระเงิน</div>
              </div>
              <Switch defaultChecked data-testid="switch-promptpay-qr" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={pmDialogOpen} onOpenChange={setPmDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editPm ? "แก้ไขช่องทางชำระเงิน" : "เพิ่มช่องทางชำระเงิน"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>ชื่อ</Label>
              <Input value={pmForm.name} onChange={e => setPmForm(f => ({ ...f, name: e.target.value }))} placeholder="เช่น เงินสด, บัตรเครดิต" data-testid="input-pm-name" />
            </div>
            <div>
              <Label>ประเภท</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {PM_TYPES.map(t => {
                  const Icon = PM_ICONS[t.value] || CreditCard;
                  return (
                    <button key={t.value} type="button"
                      className={`flex items-center gap-2 p-2.5 rounded-lg border text-sm transition-colors ${pmForm.type === t.value ? "border-[#03c9d7] bg-cyan-50 text-[#03c9d7] font-medium" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                      onClick={() => setPmForm(f => ({ ...f, type: t.value }))}
                      data-testid={`button-pm-type-${t.value}`}
                    >
                      <Icon className="w-4 h-4" /> {t.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={pmForm.isActive} onCheckedChange={v => setPmForm(f => ({ ...f, isActive: v }))} data-testid="switch-pm-active" />
              <Label>เปิดใช้งาน</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPmDialogOpen(false)}>ยกเลิก</Button>
            <Button onClick={savePm} className="bg-[#03c9d7] hover:bg-[#02b5c2] text-white" data-testid="button-save-pm">
              <Save className="w-4 h-4 mr-1" /> บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletePmId} onOpenChange={() => setDeletePmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ลบช่องทางชำระเงิน?</AlertDialogTitle>
            <AlertDialogDescription>การลบจะไม่สามารถย้อนกลับได้</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction className="bg-red-500 hover:bg-red-600" onClick={() => deletePmId && deletePmMutation.mutate(deletePmId)} data-testid="button-confirm-delete">ลบ</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PosLayout>
  );
}
