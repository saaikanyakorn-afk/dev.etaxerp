import HRLayout from "@/components/hr-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2, Calculator } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useHrCompanyId } from "@/lib/company-context";

interface CommissionRule {
  id: number;
  companyId: number;
  name: string;
  type: "percentage" | "fixed";
  rate: number;
  basedOn: "revenue" | "profit" | "quantity";
  minTarget: number;
  active: boolean;
}

interface RuleForm {
  name: string;
  type: "percentage" | "fixed";
  rate: string;
  basedOn: "revenue" | "profit" | "quantity";
  minTarget: string;
  active: boolean;
}

const emptyForm: RuleForm = {
  name: "",
  type: "percentage",
  rate: "",
  basedOn: "revenue",
  minTarget: "0",
  active: true,
};

export default function CommissionRules() {
  const selectedCompanyId = useHrCompanyId();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<RuleForm>(emptyForm);

  const { data: rules = [], isLoading } = useQuery<CommissionRule[]>({
    queryKey: ["/api/commission-rules", selectedCompanyId],
    queryFn: async () => {
      if (!selectedCompanyId) return [];
      const r = await fetch(`/api/commission-rules?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch("/api/commission-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!r.ok) throw new Error("Failed to create");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/commission-rules"] });
      toast({ title: "สำเร็จ", description: "เพิ่มกฎค่าคอมมิชชั่นเรียบร้อย" });
      closeDialog();
    },
    onError: () => {
      toast({ title: "ผิดพลาด", description: "ไม่สามารถเพิ่มกฎได้", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const r = await fetch(`/api/commission-rules/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!r.ok) throw new Error("Failed to update");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/commission-rules"] });
      toast({ title: "สำเร็จ", description: "แก้ไขกฎค่าคอมมิชชั่นเรียบร้อย" });
      closeDialog();
    },
    onError: () => {
      toast({ title: "ผิดพลาด", description: "ไม่สามารถแก้ไขกฎได้", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/commission-rules/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!r.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/commission-rules"] });
      toast({ title: "สำเร็จ", description: "ลบกฎค่าคอมมิชชั่นเรียบร้อย" });
    },
    onError: () => {
      toast({ title: "ผิดพลาด", description: "ไม่สามารถลบกฎได้", variant: "destructive" });
    },
  });

  function closeDialog() {
    setDialogOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  function openCreate() {
    setForm(emptyForm);
    setEditingId(null);
    setDialogOpen(true);
  }

  function openEdit(rule: CommissionRule) {
    setForm({
      name: rule.name,
      type: rule.type,
      rate: String(rule.rate),
      basedOn: rule.basedOn,
      minTarget: String(rule.minTarget),
      active: rule.active,
    });
    setEditingId(rule.id);
    setDialogOpen(true);
  }

  function handleSubmit() {
    if (!form.name.trim() || !form.rate) {
      toast({ title: "กรุณากรอกข้อมูลให้ครบ", variant: "destructive" });
      return;
    }
    const payload = {
      companyId: selectedCompanyId,
      name: form.name.trim(),
      type: form.type,
      rate: parseFloat(form.rate),
      basedOn: form.basedOn,
      minTarget: parseFloat(form.minTarget) || 0,
      active: form.active,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  function getTypeLabel(type: string) {
    return type === "percentage" ? "เปอร์เซ็นต์" : "จำนวนคงที่";
  }

  function getBasedOnLabel(basedOn: string) {
    switch (basedOn) {
      case "revenue": return "รายได้";
      case "profit": return "กำไร";
      case "quantity": return "จำนวน";
      default: return basedOn;
    }
  }

  function fmt(n: number) {
    return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  return (
    <HRLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calculator className="h-6 w-6 text-[#fb9678]" />
            <h1 className="text-xl font-bold" data-testid="text-page-title">กฎค่าคอมมิชชั่น</h1>
          </div>
          <Button onClick={openCreate} data-testid="button-add-rule">
            <Plus className="h-4 w-4 mr-2" />
            เพิ่มกฎใหม่
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base" data-testid="text-rules-title">รายการกฎค่าคอมมิชชั่น</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground" data-testid="text-loading">กำลังโหลด...</div>
            ) : rules.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground" data-testid="text-empty">ยังไม่มีกฎค่าคอมมิชชั่น</div>
            ) : (
              <Table data-testid="table-rules">
                <TableHeader>
                  <TableRow>
                    <TableHead>ชื่อกฎ</TableHead>
                    <TableHead>ประเภท</TableHead>
                    <TableHead className="text-right">อัตรา</TableHead>
                    <TableHead>คำนวณจาก</TableHead>
                    <TableHead className="text-right">เป้าหมายขั้นต่ำ</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead className="text-right">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map((rule) => (
                    <TableRow key={rule.id} data-testid={`row-rule-${rule.id}`}>
                      <TableCell className="font-medium" data-testid={`text-rule-name-${rule.id}`}>{rule.name}</TableCell>
                      <TableCell data-testid={`text-rule-type-${rule.id}`}>{getTypeLabel(rule.type)}</TableCell>
                      <TableCell className="text-right" data-testid={`text-rule-rate-${rule.id}`}>
                        {rule.type === "percentage" ? `${fmt(rule.rate)}%` : fmt(rule.rate)}
                      </TableCell>
                      <TableCell data-testid={`text-rule-based-on-${rule.id}`}>{getBasedOnLabel(rule.basedOn)}</TableCell>
                      <TableCell className="text-right" data-testid={`text-rule-min-target-${rule.id}`}>{fmt(rule.minTarget)}</TableCell>
                      <TableCell>
                        {rule.active ? (
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100" data-testid={`badge-active-${rule.id}`}>ใช้งาน</Badge>
                        ) : (
                          <Badge className="bg-gray-100 text-gray-600 hover:bg-gray-100" data-testid={`badge-inactive-${rule.id}`}>ปิดใช้งาน</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(rule)} data-testid={`button-edit-rule-${rule.id}`}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(rule.id)} data-testid={`button-delete-rule-${rule.id}`}>
                            <Trash2 className="h-4 w-4 text-red-500" />
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

        <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
          <DialogContent className="max-w-md" data-testid="dialog-rule-form">
            <DialogHeader>
              <DialogTitle data-testid="text-dialog-title">{editingId ? "แก้ไขกฎค่าคอมมิชชั่น" : "เพิ่มกฎค่าคอมมิชชั่น"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">ชื่อกฎ</label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="เช่น คอมมิชชั่นพนักงานขาย"
                  data-testid="input-rule-name"
                />
              </div>
              <div>
                <label className="text-sm font-medium">ประเภท</label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as "percentage" | "fixed" })}>
                  <SelectTrigger data-testid="select-rule-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">เปอร์เซ็นต์</SelectItem>
                    <SelectItem value="fixed">จำนวนคงที่</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">อัตรา {form.type === "percentage" ? "(%)" : "(บาท)"}</label>
                <Input
                  type="number"
                  value={form.rate}
                  onChange={(e) => setForm({ ...form, rate: e.target.value })}
                  placeholder="0.00"
                  data-testid="input-rule-rate"
                />
              </div>
              <div>
                <label className="text-sm font-medium">คำนวณจาก</label>
                <Select value={form.basedOn} onValueChange={(v) => setForm({ ...form, basedOn: v as "revenue" | "profit" | "quantity" })}>
                  <SelectTrigger data-testid="select-rule-based-on">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="revenue">รายได้</SelectItem>
                    <SelectItem value="profit">กำไร</SelectItem>
                    <SelectItem value="quantity">จำนวน</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">เป้าหมายขั้นต่ำ</label>
                <Input
                  type="number"
                  value={form.minTarget}
                  onChange={(e) => setForm({ ...form, minTarget: e.target.value })}
                  placeholder="0"
                  data-testid="input-rule-min-target"
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">เปิดใช้งาน</label>
                <Switch
                  checked={form.active}
                  onCheckedChange={(checked) => setForm({ ...form, active: checked })}
                  data-testid="switch-rule-active"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={closeDialog} data-testid="button-cancel">ยกเลิก</Button>
                <Button onClick={handleSubmit} data-testid="button-save-rule">
                  {editingId ? "บันทึก" : "เพิ่ม"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </HRLayout>
  );
}