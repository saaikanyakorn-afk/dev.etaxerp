import Layout from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Settings, Plus, Pencil, Trash2, CalendarDays, RefreshCw, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useHrCompanyId } from "@/lib/company-context";

const LEAVE_TYPE_OPTIONS = [
  { value: "sick", label: "ลาป่วย" },
  { value: "vacation", label: "ลาพักร้อน" },
  { value: "personal", label: "ลากิจ" },
  { value: "maternity", label: "ลาคลอด" },
  { value: "ordination", label: "ลาบวช" },
  { value: "military", label: "ลาทหาร" },
  { value: "other", label: "ลาอื่นๆ" },
];

const MONTH_OPTIONS = [
  { value: "1", label: "มกราคม" }, { value: "2", label: "กุมภาพันธ์" },
  { value: "3", label: "มีนาคม" }, { value: "4", label: "เมษายน" },
  { value: "5", label: "พฤษภาคม" }, { value: "6", label: "มิถุนายน" },
  { value: "7", label: "กรกฎาคม" }, { value: "8", label: "สิงหาคม" },
  { value: "9", label: "กันยายน" }, { value: "10", label: "ตุลาคม" },
  { value: "11", label: "พฤศจิกายน" }, { value: "12", label: "ธันวาคม" },
];

function getLeaveTypeLabel(val: string) {
  return LEAVE_TYPE_OPTIONS.find(t => t.value === val)?.label || val;
}

interface PolicyForm {
  leaveType: string;
  annualQuota: number;
  carryOverEnabled: boolean;
  maxCarryOverDays: number;
  carryOverExpiryMonth: number;
  carryOverExpiryDay: number;
}

const defaultForm: PolicyForm = {
  leaveType: "",
  annualQuota: 0,
  carryOverEnabled: false,
  maxCarryOverDays: 0,
  carryOverExpiryMonth: 3,
  carryOverExpiryDay: 31,
};

export default function LeavePolicySettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const companyId = useHrCompanyId();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<PolicyForm>(defaultForm);
  const [carryOverDialogOpen, setCarryOverDialogOpen] = useState(false);
  const [carryOverYear, setCarryOverYear] = useState(String(new Date().getFullYear() - 1));

  const { data: policies = [] } = useQuery<any[]>({
    queryKey: ["/api/leave-policies", companyId],
    queryFn: async () => {
      const r = await fetch(`/api/leave-policies?companyId=${companyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!user && !!companyId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch("/api/leave-policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leave-policies"] });
      toast({ title: "สร้างนโยบายลาสำเร็จ" });
      closeDialog();
    },
    onError: (err: any) => toast({ title: "ไม่สำเร็จ", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const r = await fetch(`/api/leave-policies/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leave-policies"] });
      toast({ title: "อัปเดตนโยบายลาสำเร็จ" });
      closeDialog();
    },
    onError: (err: any) => toast({ title: "ไม่สำเร็จ", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/leave-policies/${id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leave-policies"] });
      toast({ title: "ลบนโยบายลาสำเร็จ" });
    },
    onError: (err: any) => toast({ title: "ไม่สำเร็จ", description: err.message, variant: "destructive" }),
  });

  const expiryNotifyMutation = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch("/api/leave-balances/check-expiry-notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: (data) => {
      toast({ title: "ตรวจสอบเสร็จสิ้น", description: `ส่งแจ้งเตือน ${data.notified} รายการ (พบ ${data.expiringCount} รายการใกล้หมดอายุ)` });
    },
    onError: (err: any) => toast({ title: "ไม่สำเร็จ", description: err.message, variant: "destructive" }),
  });

  const carryOverMutation = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch("/api/leave-balances/carry-over", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: (data) => {
      toast({ title: "ยกยอดวันลาสำเร็จ", description: `ประมวลผล ${data.processed} รายการ` });
      setCarryOverDialogOpen(false);
    },
    onError: (err: any) => toast({ title: "ไม่สำเร็จ", description: err.message, variant: "destructive" }),
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    setForm(defaultForm);
  };

  const openEdit = (policy: any) => {
    setEditingId(policy.id);
    setForm({
      leaveType: policy.leaveType,
      annualQuota: policy.annualQuota,
      carryOverEnabled: policy.carryOverEnabled,
      maxCarryOverDays: policy.maxCarryOverDays || 0,
      carryOverExpiryMonth: policy.carryOverExpiryMonth || 3,
      carryOverExpiryDay: policy.carryOverExpiryDay || 31,
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!form.leaveType) return;
    const payload = { ...form, companyId, active: true };
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const yearOptions = [new Date().getFullYear() - 2, new Date().getFullYear() - 1, new Date().getFullYear()].map(y => ({
    value: String(y), label: String(y),
  }));

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <Settings className="h-6 w-6" style={{ color: "#fb9678" }} />
            <h1 className="text-2xl font-bold" data-testid="text-page-title">ตั้งค่านโยบายวันลา</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => expiryNotifyMutation.mutate({ companyId })} disabled={expiryNotifyMutation.isPending} className="border-amber-500 text-amber-500 hover:bg-amber-50" data-testid="button-check-expiry">
              <AlertTriangle className="mr-2 h-4 w-4" /> {expiryNotifyMutation.isPending ? "กำลังตรวจ..." : "แจ้งเตือนวันลาใกล้หมดอายุ"}
            </Button>
            <Button variant="outline" onClick={() => setCarryOverDialogOpen(true)} className="border-[#03c9d7] text-[#03c9d7] hover:bg-[#e5f9fa]" data-testid="button-carry-over">
              <RefreshCw className="mr-2 h-4 w-4" /> ยกยอดวันลาข้ามปี
            </Button>
            <Button onClick={() => { setForm(defaultForm); setEditingId(null); setDialogOpen(true); }} style={{ background: "#fb9678" }} className="text-white hover:opacity-90" data-testid="button-add-policy">
              <Plus className="mr-2 h-4 w-4" /> เพิ่มนโยบายลา
            </Button>
          </div>
        </div>

        {policies.length === 0 && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="py-6">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                <div>
                  <p className="text-sm font-medium text-amber-700" data-testid="text-no-policies-warning">ยังไม่ได้ตั้งค่านโยบายวันลา</p>
                  <p className="text-xs text-amber-600">ระบบจะใช้ค่าเริ่มต้น: ลาป่วย 30 วัน, ลาพักร้อน 6 วัน, ลากิจ 3 วัน</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg" data-testid="text-policies-title">นโยบายวันลาของบริษัท</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="text-xs font-bold">ประเภทลา</TableHead>
                  <TableHead className="text-xs font-bold text-right">โควต้า/ปี (วัน)</TableHead>
                  <TableHead className="text-xs font-bold text-center">ยกข้ามปี</TableHead>
                  <TableHead className="text-xs font-bold text-right">ยกได้สูงสุด (วัน)</TableHead>
                  <TableHead className="text-xs font-bold">วันหมดอายุยกมา</TableHead>
                  <TableHead className="text-xs font-bold text-center">สถานะ</TableHead>
                  <TableHead className="text-xs font-bold text-center">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {policies.length > 0 ? policies.map((p: any) => (
                  <TableRow key={p.id} data-testid={`row-policy-${p.id}`}>
                    <TableCell className="text-sm font-medium" data-testid={`text-policy-type-${p.id}`}>{getLeaveTypeLabel(p.leaveType)}</TableCell>
                    <TableCell className="text-sm text-right" data-testid={`text-policy-quota-${p.id}`}>{p.annualQuota}</TableCell>
                    <TableCell className="text-center" data-testid={`text-policy-carry-${p.id}`}>
                      {p.carryOverEnabled ? (
                        <Badge className="bg-emerald-100 text-emerald-700">เปิด</Badge>
                      ) : (
                        <Badge variant="outline" className="text-gray-400">ปิด</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-right" data-testid={`text-policy-max-carry-${p.id}`}>
                      {p.carryOverEnabled ? p.maxCarryOverDays : "-"}
                    </TableCell>
                    <TableCell className="text-sm" data-testid={`text-policy-expiry-${p.id}`}>
                      {p.carryOverEnabled ? `${p.carryOverExpiryDay} ${MONTH_OPTIONS.find(m => m.value === String(p.carryOverExpiryMonth))?.label || ""}` : "-"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={p.active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}>
                        {p.active ? "ใช้งาน" : "ปิดใช้"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => openEdit(p)} data-testid={`button-edit-policy-${p.id}`}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-red-500 hover:text-red-700" onClick={() => deleteMutation.mutate(p.id)} data-testid={`button-delete-policy-${p.id}`}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-sm" data-testid="text-no-policies">
                      ยังไม่มีนโยบายวันลา — ระบบจะใช้ค่าเริ่มต้น
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={v => { if (!v) closeDialog(); }}>
          <DialogContent className="max-w-md" data-testid="dialog-policy-form">
            <DialogHeader>
              <DialogTitle data-testid="text-dialog-title">{editingId ? "แก้ไขนโยบายลา" : "เพิ่มนโยบายลา"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">ประเภทลา *</label>
                <Select value={form.leaveType} onValueChange={v => setForm(f => ({ ...f, leaveType: v }))}>
                  <SelectTrigger data-testid="select-leave-type">
                    <SelectValue placeholder="เลือกประเภทลา" />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAVE_TYPE_OPTIONS.map(lt => (
                      <SelectItem key={lt.value} value={lt.value} data-testid={`option-type-${lt.value}`}>{lt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">โควต้าต่อปี (วัน) *</label>
                <Input
                  type="number"
                  min={0}
                  value={form.annualQuota}
                  onChange={e => setForm(f => ({ ...f, annualQuota: Number(e.target.value) }))}
                  data-testid="input-annual-quota"
                />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                <div>
                  <p className="text-sm font-medium">เปิดยกวันลาข้ามปี</p>
                  <p className="text-xs text-muted-foreground">อนุญาตให้ยกวันลาที่เหลือไปปีถัดไป</p>
                </div>
                <Switch
                  checked={form.carryOverEnabled}
                  onCheckedChange={v => setForm(f => ({ ...f, carryOverEnabled: v }))}
                  data-testid="switch-carry-over"
                />
              </div>
              {form.carryOverEnabled && (
                <>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">ยกได้สูงสุด (วัน)</label>
                    <Input
                      type="number"
                      min={0}
                      value={form.maxCarryOverDays}
                      onChange={e => setForm(f => ({ ...f, maxCarryOverDays: Number(e.target.value) }))}
                      data-testid="input-max-carry-over"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">เดือนหมดอายุ</label>
                      <Select value={String(form.carryOverExpiryMonth)} onValueChange={v => setForm(f => ({ ...f, carryOverExpiryMonth: Number(v) }))}>
                        <SelectTrigger data-testid="select-expiry-month">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MONTH_OPTIONS.map(m => (
                            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">วันหมดอายุ</label>
                      <Input
                        type="number"
                        min={1}
                        max={31}
                        value={form.carryOverExpiryDay}
                        onChange={e => setForm(f => ({ ...f, carryOverExpiryDay: Number(e.target.value) }))}
                        data-testid="input-expiry-day"
                      />
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                    <p className="text-xs text-blue-700">
                      วันลาที่ยกข้ามปีจะหมดอายุวันที่ {form.carryOverExpiryDay} {MONTH_OPTIONS.find(m => m.value === String(form.carryOverExpiryMonth))?.label} ของปีถัดไป
                    </p>
                  </div>
                </>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={closeDialog} data-testid="button-cancel-policy">ยกเลิก</Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!form.leaveType || form.annualQuota <= 0 || createMutation.isPending || updateMutation.isPending}
                  style={{ background: "#fb9678" }}
                  className="text-white hover:opacity-90"
                  data-testid="button-save-policy"
                >
                  {createMutation.isPending || updateMutation.isPending ? "กำลังบันทึก..." : "บันทึก"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={carryOverDialogOpen} onOpenChange={setCarryOverDialogOpen}>
          <DialogContent className="max-w-sm" data-testid="dialog-carry-over">
            <DialogHeader>
              <DialogTitle data-testid="text-carry-over-title">ยกยอดวันลาข้ามปี</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">ยกยอดจากปี</label>
                <Select value={carryOverYear} onValueChange={setCarryOverYear}>
                  <SelectTrigger data-testid="select-carry-over-year">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map(y => (
                      <SelectItem key={y.value} value={y.value}>{y.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                <div className="flex gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-700">
                    <p className="font-medium">ระบบจะประมวลผลดังนี้:</p>
                    <ul className="mt-1 space-y-0.5 list-disc list-inside">
                      <li>คำนวณวันลาคงเหลือของปี {carryOverYear}</li>
                      <li>ยกยอดไปปี {Number(carryOverYear) + 1} ตามนโยบายที่ตั้งไว้</li>
                      <li>กำหนดวันหมดอายุตามที่ตั้งค่า</li>
                    </ul>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setCarryOverDialogOpen(false)} data-testid="button-cancel-carry-over">ยกเลิก</Button>
                <Button
                  onClick={() => carryOverMutation.mutate({ companyId, fromYear: Number(carryOverYear) })}
                  disabled={carryOverMutation.isPending}
                  style={{ background: "#03c9d7" }}
                  className="text-white hover:opacity-90"
                  data-testid="button-confirm-carry-over"
                >
                  {carryOverMutation.isPending ? "กำลังประมวลผล..." : "ยืนยันยกยอด"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
