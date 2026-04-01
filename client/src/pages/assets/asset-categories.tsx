import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { FolderTree, Plus, Pencil, Trash2, GripVertical } from "lucide-react";
import { useCompany } from "@/lib/company-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface AssetCategory {
  id: number;
  companyId: number;
  accountCode: string;
  name: string;
  accumCode: string | null;
  depExpCode: string | null;
  usefulLifeMonths: number;
  depreciationRate: string;
  isDefault: boolean;
  sortOrder: number;
}

const EMPTY_FORM = {
  accountCode: "",
  name: "",
  accumCode: "",
  depExpCode: "",
  usefulLifeMonths: 60,
  depreciationRate: "20",
};

export default function AssetCategoriesPage() {
  const { selectedCompanyId } = useCompany();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<AssetCategory | null>(null);

  const { data: categories = [], isLoading } = useQuery<AssetCategory[]>({
    queryKey: ["/api/asset-categories", selectedCompanyId],
    queryFn: () => fetch(`/api/asset-categories?companyId=${selectedCompanyId}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!selectedCompanyId,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof EMPTY_FORM & { id?: number }) => {
      if (data.id) {
        return apiRequest("PATCH", `/api/asset-categories/${data.id}`, data);
      } else {
        return apiRequest("POST", "/api/asset-categories", { ...data, companyId: selectedCompanyId });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/asset-categories"] });
      toast({ title: editId ? "แก้ไขหมวดหมู่สำเร็จ" : "เพิ่มหมวดหมู่สำเร็จ" });
      closeDialog();
    },
    onError: (err: any) => {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/asset-categories/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/asset-categories"] });
      toast({ title: "ลบหมวดหมู่สำเร็จ" });
      setDeleteTarget(null);
    },
    onError: (err: any) => {
      toast({ title: "ไม่สามารถลบได้", description: err.message, variant: "destructive" });
      setDeleteTarget(null);
    },
  });

  function openAdd() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(cat: AssetCategory) {
    setEditId(cat.id);
    setForm({
      accountCode: cat.accountCode,
      name: cat.name,
      accumCode: cat.accumCode || "",
      depExpCode: cat.depExpCode || "",
      usefulLifeMonths: cat.usefulLifeMonths,
      depreciationRate: cat.depreciationRate,
    });
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditId(null);
    setForm(EMPTY_FORM);
  }

  function handleSave() {
    if (!form.accountCode.trim() || !form.name.trim()) {
      toast({ title: "กรุณากรอกรหัสบัญชีและชื่อหมวดหมู่", variant: "destructive" });
      return;
    }
    saveMutation.mutate(editId ? { ...form, id: editId } : form);
  }

  return (
    <Layout>
      <div className="space-y-4">
        <Card className="flexy-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderTree className="w-5 h-5 text-[#03c9d7]" />
                <h2 className="text-lg font-semibold">หมวดหมู่ทรัพย์สิน</h2>
              </div>
              <Button
                data-testid="button-add-category"
                onClick={openAdd}
                className="bg-[#03c9d7] hover:bg-[#02b0bd] text-white"
              >
                <Plus className="w-4 h-4 mr-1" />
                เพิ่มหมวดหมู่
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-gray-500">กำลังโหลด...</div>
            ) : categories.length === 0 ? (
              <div className="text-center py-8 text-gray-500">ยังไม่มีหมวดหมู่ทรัพย์สิน</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#03c9d7]">
                      <TableHead className="text-white text-sm font-normal w-10 text-center">#</TableHead>
                      <TableHead className="text-white text-sm font-normal">รหัสบัญชี</TableHead>
                      <TableHead className="text-white text-sm font-normal">ชื่อหมวดหมู่</TableHead>
                      <TableHead className="text-white text-sm font-normal">บัญชีค่าเสื่อมสะสม</TableHead>
                      <TableHead className="text-white text-sm font-normal">บัญชีค่าเสื่อม</TableHead>
                      <TableHead className="text-white text-sm font-normal text-right">อายุ (เดือน)</TableHead>
                      <TableHead className="text-white text-sm font-normal text-right">อัตรา (%)</TableHead>
                      <TableHead className="text-white text-sm font-normal text-center w-24">จัดการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categories.map((cat, idx) => (
                      <TableRow key={cat.id} className="hover:bg-gray-50" data-testid={`row-category-${cat.id}`}>
                        <TableCell className="text-center text-sm text-gray-500">{idx + 1}</TableCell>
                        <TableCell className="text-sm font-mono">{cat.accountCode}</TableCell>
                        <TableCell className="text-sm font-medium">{cat.name}</TableCell>
                        <TableCell className="text-sm font-mono text-gray-600">{cat.accumCode || "-"}</TableCell>
                        <TableCell className="text-sm font-mono text-gray-600">{cat.depExpCode || "-"}</TableCell>
                        <TableCell className="text-sm text-right">{cat.usefulLifeMonths}</TableCell>
                        <TableCell className="text-sm text-right">{parseFloat(cat.depreciationRate)}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              data-testid={`button-edit-${cat.id}`}
                              variant="ghost"
                              size="sm"
                              onClick={() => openEdit(cat)}
                              className="h-7 w-7 p-0 text-blue-600 hover:text-blue-800"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              data-testid={`button-delete-${cat.id}`}
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteTarget(cat)}
                              className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editId ? "แก้ไขหมวดหมู่ทรัพย์สิน" : "เพิ่มหมวดหมู่ทรัพย์สิน"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm">รหัสบัญชี *</Label>
                  <Input
                    data-testid="input-account-code"
                    value={form.accountCode}
                    onChange={e => setForm(f => ({ ...f, accountCode: e.target.value }))}
                    placeholder="เช่น 1701000"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm">ชื่อหมวดหมู่ *</Label>
                  <Input
                    data-testid="input-category-name"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="เช่น ที่ดิน"
                    className="mt-1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm">บัญชีค่าเสื่อมราคาสะสม</Label>
                  <Input
                    data-testid="input-accum-code"
                    value={form.accumCode}
                    onChange={e => setForm(f => ({ ...f, accumCode: e.target.value }))}
                    placeholder="เช่น 1712000"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm">บัญชีค่าเสื่อมราคา</Label>
                  <Input
                    data-testid="input-dep-exp-code"
                    value={form.depExpCode}
                    onChange={e => setForm(f => ({ ...f, depExpCode: e.target.value }))}
                    placeholder="เช่น 5301500"
                    className="mt-1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm">อายุการใช้งาน (เดือน)</Label>
                  <Input
                    data-testid="input-useful-life"
                    type="number"
                    value={form.usefulLifeMonths}
                    onChange={e => setForm(f => ({ ...f, usefulLifeMonths: Number(e.target.value) || 0 }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm">อัตราค่าเสื่อมราคา (%)</Label>
                  <Input
                    data-testid="input-dep-rate"
                    type="number"
                    step="0.01"
                    value={form.depreciationRate}
                    onChange={e => setForm(f => ({ ...f, depreciationRate: e.target.value }))}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeDialog}>ยกเลิก</Button>
              <Button
                data-testid="button-save-category"
                onClick={handleSave}
                disabled={saveMutation.isPending}
                className="bg-[#03c9d7] hover:bg-[#02b0bd] text-white"
              >
                {saveMutation.isPending ? "กำลังบันทึก..." : "บันทึก"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>ยืนยันการลบ</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-gray-600">
              ต้องการลบหมวดหมู่ "{deleteTarget?.name}" ({deleteTarget?.accountCode}) หรือไม่?
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>ยกเลิก</Button>
              <Button
                data-testid="button-confirm-delete"
                variant="destructive"
                onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? "กำลังลบ..." : "ลบ"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
