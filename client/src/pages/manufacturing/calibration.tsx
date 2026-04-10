import ManufacturingLayout from "@/components/manufacturing-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Wrench, Pencil, Trash2, Loader2, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompanyContext } from "@/lib/company-context";
import { useToast } from "@/hooks/use-toast";

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const now = new Date();
  return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export default function CalibrationPage() {
  const { selectedCompany } = useCompanyContext();
  const companyId = selectedCompany?.id;
  const { toast } = useToast();
  const qc = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ code: "", name: "", description: "", location: "", nextDueDate: "", lastCalibratedDate: "", calibrationInterval: "365", notes: "" });

  const { data: instruments, isLoading } = useQuery({
    queryKey: ["/api/manufacturing-module/calibration", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/manufacturing-module/calibration?companyId=${companyId}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!companyId,
  });

  const saveMut = useMutation({
    mutationFn: async (body: any) => {
      const url = editId ? `/api/manufacturing-module/calibration/${editId}` : "/api/manufacturing-module/calibration";
      const method = editId ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, companyId }) });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message); }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: editId ? "แก้ไขสำเร็จ" : "เพิ่มเครื่องมือสำเร็จ" });
      qc.invalidateQueries({ queryKey: ["/api/manufacturing-module/calibration"] });
      setDialogOpen(false);
      resetForm();
    },
    onError: (err: any) => toast({ title: "ไม่สำเร็จ", description: err.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/manufacturing-module/calibration/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "ลบสำเร็จ" });
      qc.invalidateQueries({ queryKey: ["/api/manufacturing-module/calibration"] });
    },
    onError: (err: any) => toast({ title: "ไม่สำเร็จ", description: err.message, variant: "destructive" }),
  });

  const resetForm = () => {
    setForm({ code: "", name: "", description: "", location: "", nextDueDate: "", lastCalibratedDate: "", calibrationInterval: "365", notes: "" });
    setEditId(null);
  };

  const openEdit = (item: any) => {
    setForm({
      code: item.code, name: item.name, description: item.description || "", location: item.location || "",
      nextDueDate: item.nextDueDate || "", lastCalibratedDate: item.lastCalibratedDate || "",
      calibrationInterval: String(item.calibrationInterval || 365), notes: item.notes || "",
    });
    setEditId(item.id);
    setDialogOpen(true);
  };

  return (
    <ManufacturingLayout>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wrench className="w-6 h-6" style={{ color: "#03c9d7" }} />
            <h1 className="text-2xl font-bold" data-testid="text-page-title">เครื่องมือวัด (Calibration)</h1>
          </div>
          <Button onClick={() => { resetForm(); setDialogOpen(true); }} style={{ background: "#03c9d7" }} data-testid="btn-add-instrument">
            <Plus className="w-4 h-4 mr-1" /> เพิ่มเครื่องมือ
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>รหัส</TableHead>
                  <TableHead>ชื่อเครื่องมือ</TableHead>
                  <TableHead>ตำแหน่ง</TableHead>
                  <TableHead>สอบเทียบล่าสุด</TableHead>
                  <TableHead>ครบกำหนดถัดไป</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead className="w-24">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></TableCell></TableRow>
                ) : !instruments?.length ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-gray-400 py-8" data-testid="text-no-instruments">ยังไม่มีข้อมูลเครื่องมือวัด</TableCell></TableRow>
                ) : instruments.map((item: any) => {
                  const days = daysUntil(item.nextDueDate);
                  const isUrgent = days !== null && days <= 30;
                  const isOverdue = days !== null && days <= 0;
                  return (
                    <TableRow key={item.id} className={isOverdue ? "bg-red-50" : isUrgent ? "bg-amber-50" : ""} data-testid={`row-instrument-${item.id}`}>
                      <TableCell className="font-mono font-medium">{item.code}</TableCell>
                      <TableCell>{item.name}</TableCell>
                      <TableCell className="text-gray-500">{item.location || "-"}</TableCell>
                      <TableCell>{item.lastCalibratedDate || "-"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {isOverdue && <AlertTriangle className="w-4 h-4 text-red-500" />}
                          {isUrgent && !isOverdue && <AlertTriangle className="w-4 h-4 text-amber-500" />}
                          <span className={isOverdue ? "text-red-600 font-bold" : isUrgent ? "text-amber-600 font-medium" : ""}>
                            {item.nextDueDate || "-"}
                          </span>
                          {days !== null && (
                            <span className={`text-xs ml-1 ${isOverdue ? "text-red-500" : isUrgent ? "text-amber-500" : "text-gray-400"}`}>
                              ({isOverdue ? `เกิน ${Math.abs(days)} วัน` : `${days} วัน`})
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={item.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}>
                          {item.status === "active" ? "ใช้งาน" : "ระงับ"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(item)} data-testid={`btn-edit-${item.id}`}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => { if (confirm("ลบเครื่องมือนี้?")) deleteMut.mutate(item.id); }} data-testid={`btn-delete-${item.id}`}>
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle data-testid="text-dialog-title">{editId ? "แก้ไขเครื่องมือวัด" : "เพิ่มเครื่องมือวัด"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">รหัสเครื่องมือ</label>
                  <Input value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} data-testid="input-code" />
                </div>
                <div>
                  <label className="text-sm font-medium">ชื่อเครื่องมือ</label>
                  <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} data-testid="input-name" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">รายละเอียด</label>
                <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} data-testid="input-description" />
              </div>
              <div>
                <label className="text-sm font-medium">ตำแหน่ง/สถานที่</label>
                <Input value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} data-testid="input-location" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">สอบเทียบล่าสุด</label>
                  <Input type="date" value={form.lastCalibratedDate} onChange={e => setForm(p => ({ ...p, lastCalibratedDate: e.target.value }))} data-testid="input-last-calibrated" />
                </div>
                <div>
                  <label className="text-sm font-medium">ครบกำหนดถัดไป</label>
                  <Input type="date" value={form.nextDueDate} onChange={e => setForm(p => ({ ...p, nextDueDate: e.target.value }))} data-testid="input-next-due" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">รอบสอบเทียบ (วัน)</label>
                <Input type="number" value={form.calibrationInterval} onChange={e => setForm(p => ({ ...p, calibrationInterval: e.target.value }))} data-testid="input-interval" />
              </div>
              <div>
                <label className="text-sm font-medium">หมายเหตุ</label>
                <Input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} data-testid="input-notes" />
              </div>
              <Button
                className="w-full" style={{ background: "#03c9d7" }}
                disabled={!form.code || !form.name || saveMut.isPending}
                onClick={() => saveMut.mutate(form)}
                data-testid="btn-save-instrument"
              >
                {saveMut.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} บันทึก
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </ManufacturingLayout>
  );
}
