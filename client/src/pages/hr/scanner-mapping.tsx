import HRLayout from "@/components/hr-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Fingerprint, Plus, Trash2, Edit2, Link2 } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useHrCompanyId } from "@/lib/company-context";

export default function ScannerMapping() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const companyId = useHrCompanyId();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ scannerDeviceId: "", scannerEmployeeCode: "", employeeId: "" });

  const { data: mappings = [] } = useQuery<any[]>({
    queryKey: ["/api/scanner-mappings", companyId],
    queryFn: async () => {
      const r = await fetch("/api/scanner-mappings", { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!companyId,
  });

  const { data: employees = [] } = useQuery<any[]>({
    queryKey: ["/api/employees", companyId],
    queryFn: async () => {
      const r = await fetch(`/api/employees?companyId=${companyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!companyId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const url = editId ? `/api/scanner-mappings/${editId}` : "/api/scanner-mappings";
      const method = editId ? "PUT" : "POST";
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.message); }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scanner-mappings", companyId] });
      toast({ title: editId ? "แก้ไขสำเร็จ" : "เพิ่มการจับคู่สำเร็จ", variant: "success" as any });
      setOpen(false);
      setEditId(null);
      setForm({ scannerDeviceId: "", scannerEmployeeCode: "", employeeId: "" });
    },
    onError: (err: any) => {
      toast({ title: "ไม่สำเร็จ", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/scanner-mappings/${id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) throw new Error("ลบไม่สำเร็จ");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scanner-mappings", companyId] });
      toast({ title: "ลบสำเร็จ", variant: "success" as any });
    },
  });

  const handleEdit = (mapping: any) => {
    setEditId(mapping.id);
    setForm({
      scannerDeviceId: mapping.scannerDeviceId,
      scannerEmployeeCode: mapping.scannerEmployeeCode,
      employeeId: String(mapping.employeeId),
    });
    setOpen(true);
  };

  const getEmployeeName = (employeeId: number) => {
    const emp = employees.find((e: any) => e.id === employeeId);
    return emp ? `${emp.fullName} (${emp.employeeCode})` : `ID: ${employeeId}`;
  };

  return (
    <HRLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Fingerprint className="h-6 w-6" style={{ color: "#03c9d7" }} />
            <h1 className="text-2xl font-bold text-foreground" data-testid="text-scanner-mapping-title">จับคู่รหัสเครื่องสแกน</h1>
          </div>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditId(null); setForm({ scannerDeviceId: "", scannerEmployeeCode: "", employeeId: "" }); } }}>
            <DialogTrigger asChild>
              <Button style={{ backgroundColor: "#03c9d7" }} className="text-white" data-testid="button-add-mapping">
                <Plus className="mr-2 h-4 w-4" /> เพิ่มการจับคู่
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editId ? "แก้ไขการจับคู่" : "เพิ่มการจับคู่รหัสเครื่องสแกน"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label>รหัสเครื่องสแกน (Device ID)</Label>
                  <Input
                    value={form.scannerDeviceId}
                    onChange={(e) => setForm({ ...form, scannerDeviceId: e.target.value })}
                    placeholder="เช่น ZK-001, HK-MAIN"
                    data-testid="input-scanner-device-id"
                  />
                </div>
                <div>
                  <Label>รหัสพนักงานในเครื่องสแกน</Label>
                  <Input
                    value={form.scannerEmployeeCode}
                    onChange={(e) => setForm({ ...form, scannerEmployeeCode: e.target.value })}
                    placeholder="เช่น 001, EMP001"
                    data-testid="input-scanner-employee-code"
                  />
                </div>
                <div>
                  <Label>พนักงานในระบบ</Label>
                  <Select value={form.employeeId} onValueChange={(v) => setForm({ ...form, employeeId: v })}>
                    <SelectTrigger data-testid="select-employee">
                      <SelectValue placeholder="เลือกพนักงาน" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((emp: any) => (
                        <SelectItem key={emp.id} value={String(emp.id)}>
                          {emp.fullName} ({emp.employeeCode})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={() => createMutation.mutate({
                    scannerDeviceId: form.scannerDeviceId,
                    scannerEmployeeCode: form.scannerEmployeeCode,
                    employeeId: Number(form.employeeId),
                  })}
                  disabled={createMutation.isPending || !form.scannerDeviceId || !form.scannerEmployeeCode || !form.employeeId}
                  className="w-full"
                  style={{ backgroundColor: "#03c9d7" }}
                  data-testid="button-save-mapping"
                >
                  {createMutation.isPending ? "กำลังบันทึก..." : editId ? "บันทึกการแก้ไข" : "บันทึก"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="shadow-sm border-slate-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Link2 className="h-5 w-5 text-slate-400" /> รายการจับคู่ทั้งหมด
            </CardTitle>
            <p className="text-xs text-muted-foreground">จับคู่รหัสพนักงานในเครื่องสแกนลายนิ้วมือกับพนักงานในระบบ</p>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="text-xs">รหัสเครื่องสแกน</TableHead>
                  <TableHead className="text-xs">รหัสพนักงาน (สแกน)</TableHead>
                  <TableHead className="text-xs">พนักงานในระบบ</TableHead>
                  <TableHead className="text-xs text-center">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mappings.length > 0 ? mappings.map((m: any) => (
                  <TableRow key={m.id} data-testid={`row-mapping-${m.id}`}>
                    <TableCell className="text-sm font-mono">{m.scannerDeviceId}</TableCell>
                    <TableCell className="text-sm font-mono">{m.scannerEmployeeCode}</TableCell>
                    <TableCell className="text-sm">{getEmployeeName(m.employeeId)}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(m)} data-testid={`button-edit-mapping-${m.id}`}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => deleteMutation.mutate(m.id)} data-testid={`button-delete-mapping-${m.id}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground text-sm">
                      ยังไม่มีการจับคู่ กดปุ่ม "เพิ่มการจับคู่" เพื่อเริ่มต้น
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </HRLayout>
  );
}
