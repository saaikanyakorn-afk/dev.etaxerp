import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import PosLayout from "@/components/pos-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Plus, Store, Pencil, Trash2, ArrowLeft, Warehouse, MapPin } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function PosBranches() {
  const { selectedCompanyId } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editBranch, setEditBranch] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", code: "", address: "", phone: "", manager: "" });

  const { data: branches = [], isLoading } = useQuery({
    queryKey: ["/api/pos/branches", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/pos/branches?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch("/api/pos/branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...data, companyId: selectedCompanyId }),
      });
      if (!r.ok) { const err = await r.json(); throw new Error(err.message); }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pos/branches"] });
      setDialogOpen(false);
      resetForm();
      toast({ title: "สร้างสาขาสำเร็จ" });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch(`/api/pos/branches/${editBranch.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!r.ok) { const err = await r.json(); throw new Error(err.message); }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pos/branches"] });
      setDialogOpen(false);
      setEditBranch(null);
      resetForm();
      toast({ title: "แก้ไขสาขาสำเร็จ" });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/pos/branches/${id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) { const err = await r.json(); throw new Error(err.message); }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pos/branches"] });
      setDeleteId(null);
      toast({ title: "ลบสาขาสำเร็จ" });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  function resetForm() {
    setForm({ name: "", code: "", address: "", phone: "", manager: "" });
  }

  function openEdit(branch: any) {
    setEditBranch(branch);
    setForm({
      name: branch.name || "",
      code: branch.code || "",
      address: branch.address || "",
      phone: branch.phone || "",
      manager: branch.manager || "",
    });
    setDialogOpen(true);
  }

  function openCreate() {
    setEditBranch(null);
    resetForm();
    setDialogOpen(true);
  }

  function handleSubmit() {
    if (!form.name.trim()) {
      toast({ title: "กรุณาระบุชื่อสาขา", variant: "destructive" });
      return;
    }
    if (editBranch) {
      updateMutation.mutate(form);
    } else {
      createMutation.mutate(form);
    }
  }

  return (
    <PosLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setLocation("/pos/sessions")} data-testid="btn-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Store className="h-5 w-5 text-primary" />
            <h1 data-testid="text-page-title" className="text-xl font-heading font-bold">จัดการสาขา POS</h1>
          </div>
          <Button data-testid="btn-add-branch" className="gap-2" onClick={openCreate}>
            <Plus className="h-4 w-4" /> เพิ่มสาขา
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <div data-testid="text-stat-total" className="text-2xl font-bold text-primary">{branches.length}</div>
              <div className="text-xs text-muted-foreground">สาขาทั้งหมด</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <div className="text-2xl font-bold" style={{ color: "#03c9d7" }}>{branches.filter((b: any) => b.warehouse).length}</div>
              <div className="text-xs text-muted-foreground">มีคลังสินค้า</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <div className="text-2xl font-bold text-amber-600">{branches.filter((b: any) => !b.warehouse).length}</div>
              <div className="text-xs text-muted-foreground">ยังไม่มีคลัง</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-0">
            {branches.length === 0 ? (
              <div className="text-center py-12">
                <Store className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">ยังไม่มีสาขา</p>
                <p className="text-sm text-muted-foreground mt-1">กดปุ่ม "เพิ่มสาขา" เพื่อสร้างสาขาแรก</p>
                <Button className="mt-4" onClick={openCreate}>
                  <Plus className="h-4 w-4 mr-2" /> เพิ่มสาขา
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">รหัส</TableHead>
                    <TableHead>ชื่อสาขา</TableHead>
                    <TableHead>ที่อยู่</TableHead>
                    <TableHead>โทร</TableHead>
                    <TableHead>ผู้จัดการ</TableHead>
                    <TableHead>คลังสินค้า</TableHead>
                    <TableHead className="w-24 text-right">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {branches.map((b: any) => (
                    <TableRow key={b.id} data-testid={`row-branch-${b.id}`}>
                      <TableCell className="font-mono text-sm">{b.code}</TableCell>
                      <TableCell className="font-medium">{b.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{b.address || "-"}</TableCell>
                      <TableCell className="text-sm">{b.phone || "-"}</TableCell>
                      <TableCell className="text-sm">{b.manager || "-"}</TableCell>
                      <TableCell>
                        {b.warehouse ? (
                          <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                            <Warehouse className="h-3 w-3 mr-1" /> {b.warehouse.name}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">ไม่มี</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(b)} data-testid={`btn-edit-${b.id}`}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setDeleteId(b.id)} data-testid={`btn-delete-${b.id}`}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md" data-testid="dialog-branch-form">
          <DialogHeader>
            <DialogTitle>{editBranch ? "แก้ไขสาขา" : "เพิ่มสาขาใหม่"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">รหัสสาขา</label>
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="เช่น B001" data-testid="input-code" />
            </div>
            <div>
              <label className="text-sm font-medium">ชื่อสาขา *</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="เช่น สาขาเซ็นทรัล ระยอง" data-testid="input-name" />
            </div>
            <div>
              <label className="text-sm font-medium">ที่อยู่</label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="ที่อยู่สาขา" data-testid="input-address" />
            </div>
            <div>
              <label className="text-sm font-medium">โทรศัพท์</label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="เบอร์โทรสาขา" data-testid="input-phone" />
            </div>
            <div>
              <label className="text-sm font-medium">ผู้จัดการสาขา</label>
              <Input value={form.manager} onChange={(e) => setForm({ ...form, manager: e.target.value })} placeholder="ชื่อผู้จัดการ" data-testid="input-manager" />
            </div>
            {!editBranch && (
              <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
                <Warehouse className="h-4 w-4 inline mr-1" />
                ระบบจะสร้างคลังสินค้าให้อัตโนมัติเมื่อสร้างสาขา
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); setEditBranch(null); resetForm(); }}>ยกเลิก</Button>
            <Button className="bg-[#fb9678] hover:bg-[#fb9678]/90" onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending} data-testid="btn-submit-branch">
              {(createMutation.isPending || updateMutation.isPending) ? "กำลังบันทึก..." : editBranch ? "บันทึก" : "สร้างสาขา"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบสาขา</AlertDialogTitle>
            <AlertDialogDescription>ต้องการลบสาขานี้หรือไม่? การลบจะไม่สามารถกู้คืนได้</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => { if (deleteId) deleteMutation.mutate(deleteId); }}
              disabled={deleteMutation.isPending} data-testid="btn-confirm-delete">
              {deleteMutation.isPending ? "กำลังลบ..." : "ยืนยันลบ"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PosLayout>
  );
}
