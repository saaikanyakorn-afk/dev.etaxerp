import HRLayout from "@/components/hr-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Clock, Plus, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useHrCompanyId } from "@/lib/company-context";

const COLOR_OPTIONS = [
  "#03c9d7", "#fb9678", "#f94d4d", "#4e73df", "#1cc88a",
  "#e74a3b", "#f6c23e", "#858796", "#5a5c69", "#6f42c1",
];

interface ShiftForm {
  name: string;
  startTime: string;
  endTime: string;
  breakStartTime: string;
  breakEndTime: string;
  color: string;
  lateThresholdMinutes: number;
}

const defaultForm: ShiftForm = {
  name: "",
  startTime: "06:00",
  endTime: "14:00",
  breakStartTime: "10:00",
  breakEndTime: "10:30",
  color: "#03c9d7",
  lateThresholdMinutes: 15,
};

export default function ShiftSettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const companyId = useHrCompanyId();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<ShiftForm>({ ...defaultForm });

  const isAdmin = user?.role === "admin" || user?.role === "owner" || user?.role === "super_admin";

  const { data: shiftsList = [] } = useQuery<any[]>({
    queryKey: ["/api/shifts", companyId],
    queryFn: async () => {
      const r = await fetch(`/api/shifts?companyId=${companyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!companyId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch("/api/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, companyId }),
        credentials: "include",
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.message); }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shifts", companyId] });
      toast({ title: "เพิ่มกะทำงานสำเร็จ" });
      setDialogOpen(false);
      resetForm();
    },
    onError: (err: any) => toast({ title: "ไม่สำเร็จ", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const r = await fetch(`/api/shifts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.message); }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shifts", companyId] });
      toast({ title: "แก้ไขกะทำงานสำเร็จ" });
      setDialogOpen(false);
      resetForm();
    },
    onError: (err: any) => toast({ title: "ไม่สำเร็จ", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/shifts/${id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) { const d = await r.json(); throw new Error(d.message); }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shifts", companyId] });
      toast({ title: "ลบกะทำงานสำเร็จ" });
    },
    onError: (err: any) => toast({ title: "ไม่สำเร็จ", description: err.message, variant: "destructive" }),
  });

  const resetForm = () => { setForm({ ...defaultForm }); setEditId(null); };

  const openEdit = (shift: any) => {
    setEditId(shift.id);
    setForm({
      name: shift.name,
      startTime: shift.startTime,
      endTime: shift.endTime,
      breakStartTime: shift.breakStartTime || "12:00",
      breakEndTime: shift.breakEndTime || "13:00",
      color: shift.color || "#03c9d7",
      lateThresholdMinutes: shift.lateThresholdMinutes ?? 15,
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!form.name || !form.startTime || !form.endTime) {
      toast({ title: "กรุณากรอกข้อมูลให้ครบ", variant: "destructive" });
      return;
    }
    if (editId) {
      updateMutation.mutate({ id: editId, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const calcWorkHours = (start: string, end: string, bStart: string, bEnd: string) => {
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    const [bsh, bsm] = bStart.split(":").map(Number);
    const [beh, bem] = bEnd.split(":").map(Number);
    let total = (eh * 60 + em) - (sh * 60 + sm);
    if (total < 0) total += 24 * 60;
    const breakMins = (beh * 60 + bem) - (bsh * 60 + bsm);
    return ((total - Math.max(0, breakMins)) / 60).toFixed(1);
  };

  return (
    <HRLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-6 w-6" style={{ color: "#fb9678" }} />
            <h1 className="text-2xl font-bold" data-testid="text-page-title">ตั้งค่ากะทำงาน</h1>
          </div>
          {isAdmin && (
            <Button onClick={() => { resetForm(); setDialogOpen(true); }} style={{ background: "#fb9678" }} className="text-white hover:opacity-90" data-testid="button-add-shift">
              <Plus className="mr-2 h-4 w-4" /> เพิ่มกะทำงาน
            </Button>
          )}
        </div>

        <Card className="shadow-sm border-none">
          <CardHeader>
            <CardTitle className="text-lg" data-testid="text-shift-list-title">รายการกะทำงาน</CardTitle>
            <p className="text-xs text-muted-foreground">กำหนดกะทำงานเช่น กะเช้า กะบ่าย กะดึก พร้อมเวลาเริ่ม-สิ้นสุด</p>
          </CardHeader>
          <CardContent>
            {shiftsList.length > 0 ? (
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="text-xs font-bold">สี</TableHead>
                    <TableHead className="text-xs font-bold">ชื่อกะ</TableHead>
                    <TableHead className="text-xs font-bold text-center">เวลาเริ่ม</TableHead>
                    <TableHead className="text-xs font-bold text-center">เวลาสิ้นสุด</TableHead>
                    <TableHead className="text-xs font-bold text-center">พัก</TableHead>
                    <TableHead className="text-xs font-bold text-center">ชม.ทำงาน</TableHead>
                    <TableHead className="text-xs font-bold text-center">สายได้ (นาที)</TableHead>
                    <TableHead className="text-xs font-bold text-center">สถานะ</TableHead>
                    {isAdmin && <TableHead className="text-xs font-bold text-center w-20">จัดการ</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shiftsList.map((s: any) => (
                    <TableRow key={s.id} data-testid={`row-shift-${s.id}`}>
                      <TableCell>
                        <div className="w-6 h-6 rounded-full" style={{ backgroundColor: s.color || "#03c9d7" }} data-testid={`shift-color-${s.id}`} />
                      </TableCell>
                      <TableCell className="text-sm font-medium" data-testid={`text-shift-name-${s.id}`}>{s.name}</TableCell>
                      <TableCell className="text-sm text-center font-mono" data-testid={`text-shift-start-${s.id}`}>{s.startTime}</TableCell>
                      <TableCell className="text-sm text-center font-mono" data-testid={`text-shift-end-${s.id}`}>{s.endTime}</TableCell>
                      <TableCell className="text-sm text-center font-mono">{s.breakStartTime} - {s.breakEndTime}</TableCell>
                      <TableCell className="text-sm text-center font-bold" style={{ color: s.color || "#03c9d7" }}>
                        {calcWorkHours(s.startTime, s.endTime, s.breakStartTime || "12:00", s.breakEndTime || "13:00")} ชม.
                      </TableCell>
                      <TableCell className="text-sm text-center">{s.lateThresholdMinutes} นาที</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={s.active ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-gray-50 text-gray-400 border-gray-200"}>
                          {s.active ? "เปิดใช้" : "ปิด"}
                        </Badge>
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(s)} data-testid={`button-edit-shift-${s.id}`}>
                              <Pencil className="h-3.5 w-3.5 text-blue-500" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { if (confirm("ต้องการลบกะทำงานนี้?")) deleteMutation.mutate(s.id); }} data-testid={`button-delete-shift-${s.id}`}>
                              <Trash2 className="h-3.5 w-3.5 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12 space-y-3">
                <Clock className="h-12 w-12 mx-auto text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground" data-testid="text-no-shifts">ยังไม่ได้สร้างกะทำงาน</p>
                {isAdmin && (
                  <Button onClick={() => { resetForm(); setDialogOpen(true); }} variant="outline" className="border-[#fb9678] text-[#fb9678]" data-testid="button-add-shift-empty">
                    <Plus className="mr-2 h-4 w-4" /> เพิ่มกะทำงานใหม่
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) resetForm(); }}>
          <DialogContent className="max-w-lg" data-testid="dialog-shift-form">
            <DialogHeader>
              <DialogTitle data-testid="text-dialog-title">{editId ? "แก้ไขกะทำงาน" : "เพิ่มกะทำงาน"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">ชื่อกะ *</label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="เช่น กะเช้า, กะบ่าย, กะดึก" data-testid="input-shift-name" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">เวลาเริ่ม *</label>
                  <Input type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} data-testid="input-shift-start" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">เวลาสิ้นสุด *</label>
                  <Input type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} data-testid="input-shift-end" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">เริ่มพัก</label>
                  <Input type="time" value={form.breakStartTime} onChange={e => setForm(f => ({ ...f, breakStartTime: e.target.value }))} data-testid="input-shift-break-start" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">สิ้นสุดพัก</label>
                  <Input type="time" value={form.breakEndTime} onChange={e => setForm(f => ({ ...f, breakEndTime: e.target.value }))} data-testid="input-shift-break-end" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">สายได้ (นาที)</label>
                <Input type="number" value={form.lateThresholdMinutes} onChange={e => setForm(f => ({ ...f, lateThresholdMinutes: Number(e.target.value) }))} data-testid="input-shift-late-threshold" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">สีป้ายกะ</label>
                <div className="flex gap-2 flex-wrap">
                  {COLOR_OPTIONS.map(c => (
                    <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))} className={`w-8 h-8 rounded-full border-2 transition-all ${form.color === c ? "border-black scale-110" : "border-transparent"}`} style={{ backgroundColor: c }} data-testid={`color-option-${c}`} />
                  ))}
                </div>
              </div>
              <Button onClick={handleSubmit} className="w-full" style={{ background: "#fb9678" }} data-testid="button-submit-shift">
                {editId ? "บันทึกการแก้ไข" : "เพิ่มกะทำงาน"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </HRLayout>
  );
}
