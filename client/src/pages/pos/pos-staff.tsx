import PosLayout from "@/components/pos-layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Users, Plus, Pencil, Upload, Download, Search, UserCheck, UserX } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { useToast } from "@/hooks/use-toast";
import { useState, useRef } from "react";

interface StaffMember {
  id: number;
  username: string;
  fullName: string;
  role: string;
  active: boolean;
  allowedCompanyIds: number[] | null;
  allowedBranchIds: number[] | null;
  branchNames: string[];
}

interface Branch {
  id: number;
  name: string;
  code: string;
  companyId: number;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "ผู้ดูแลระบบ",
  manager: "ผู้จัดการ",
  branch_manager: "ผู้จัดการสาขา",
  staff: "พนักงาน",
  cashier: "แคชเชียร์",
  employee: "พนักงาน",
};

const STAFF_ROLES = [
  { value: "staff", label: "พนักงาน" },
  { value: "branch_manager", label: "ผู้จัดการสาขา" },
  { value: "cashier", label: "แคชเชียร์" },
];

export default function PosStaff() {
  const { selectedCompanyId } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [showImportResult, setShowImportResult] = useState<any>(null);

  const [form, setForm] = useState({
    fullName: "",
    username: "",
    password: "",
    role: "staff",
    selectedBranchIds: [] as number[],
  });

  const { data: staff = [], isLoading } = useQuery<StaffMember[]>({
    queryKey: ["/api/pos/staff"],
    queryFn: async () => {
      const r = await fetch("/api/pos/staff", { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
  });

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/branches?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch("/api/pos/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pos/staff"] });
      toast({ title: "สร้างพนักงานสำเร็จ", variant: "success" as any });
      resetForm();
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const r = await fetch(`/api/pos/staff/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pos/staff"] });
      toast({ title: "อัปเดตพนักงานสำเร็จ", variant: "success" as any });
      resetForm();
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("companyIds", JSON.stringify(selectedCompanyId ? [selectedCompanyId] : []));
      const r = await fetch("/api/pos/staff/import", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/pos/staff"] });
      setShowImportResult(data);
      toast({ title: "นำเข้าสำเร็จ", description: `สร้าง ${data.created} คน, ข้าม ${data.skipped} คน`, variant: "success" as any });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const resetForm = () => {
    setShowForm(false);
    setEditingStaff(null);
    setForm({ fullName: "", username: "", password: "", role: "staff", selectedBranchIds: [] });
  };

  const openEdit = (s: StaffMember) => {
    setEditingStaff(s);
    setForm({
      fullName: s.fullName,
      username: s.username,
      password: "",
      role: s.role,
      selectedBranchIds: s.allowedBranchIds || [],
    });
    setShowForm(true);
  };

  const handleSubmit = () => {
    if (!form.fullName || !form.username) {
      toast({ title: "กรุณากรอกข้อมูลให้ครบ", variant: "destructive" });
      return;
    }
    if (!editingStaff && !form.password) {
      toast({ title: "กรุณาตั้งรหัสผ่าน", variant: "destructive" });
      return;
    }

    const payload: any = {
      fullName: form.fullName,
      username: form.username,
      role: form.role,
      allowedCompanyIds: selectedCompanyId ? [selectedCompanyId] : [],
      allowedBranchIds: form.selectedBranchIds,
    };
    if (form.password) payload.password = form.password;

    if (editingStaff) {
      updateMutation.mutate({ id: editingStaff.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const toggleBranch = (branchId: number) => {
    setForm(prev => ({
      ...prev,
      selectedBranchIds: prev.selectedBranchIds.includes(branchId)
        ? prev.selectedBranchIds.filter(id => id !== branchId)
        : [...prev.selectedBranchIds, branchId],
    }));
  };

  const filtered = staff.filter(s =>
    !search || s.fullName.toLowerCase().includes(search.toLowerCase()) || s.username.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <PosLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900" data-testid="text-page-title">จัดการพนักงาน POS</h1>
            <p className="text-sm text-gray-500 mt-1">สร้าง แก้ไข และกำหนดสาขาให้พนักงาน</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <a href="/api/pos/staff/template" download data-testid="button-download-template">
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-1.5" />
                ดาวน์โหลดแม่แบบ Excel
              </Button>
            </a>
            <Button variant="outline" size="sm" data-testid="button-import-excel" onClick={() => fileInputRef.current?.click()} disabled={importMutation.isPending}>
              <Upload className="h-4 w-4 mr-1.5" />
              {importMutation.isPending ? "กำลังนำเข้า..." : "นำเข้าจาก Excel"}
            </Button>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={e => {
              const f = e.target.files?.[0];
              if (f) importMutation.mutate(f);
              e.target.value = "";
            }} />
            <Button data-testid="button-add-staff" onClick={() => { resetForm(); setShowForm(true); }}>
              <Plus className="h-4 w-4 mr-1.5" />
              เพิ่มพนักงาน
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <span className="font-semibold" data-testid="text-staff-count">พนักงานทั้งหมด ({staff.length})</span>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="ค้นหาชื่อ / username..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9 h-9"
                  data-testid="input-search-staff"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-gray-500">กำลังโหลด...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>ยังไม่มีพนักงาน</p>
                <p className="text-xs mt-1">กดปุ่ม "เพิ่มพนักงาน" หรือ "นำเข้าจาก Excel" เพื่อเริ่มต้น</p>
              </div>
            ) : (
              <Table data-testid="table-staff-list">
                <TableHeader>
                  <TableRow>
                    <TableHead>ชื่อ-นามสกุล</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>ตำแหน่ง</TableHead>
                    <TableHead>สาขา</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead className="text-right">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(s => (
                    <TableRow key={s.id} data-testid={`row-staff-${s.id}`}>
                      <TableCell className="font-medium" data-testid={`text-name-${s.id}`}>{s.fullName}</TableCell>
                      <TableCell className="text-sm text-gray-500">{s.username}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {ROLE_LABELS[s.role] || s.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {s.branchNames.length > 0 ? s.branchNames.map((name, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">{name}</Badge>
                          )) : <span className="text-xs text-gray-400">ทุกสาขา</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        {s.active ? (
                          <Badge className="bg-green-100 text-green-700 text-xs"><UserCheck className="h-3 w-3 mr-1" />ใช้งาน</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs"><UserX className="h-3 w-3 mr-1" />ปิดใช้งาน</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" data-testid={`button-edit-staff-${s.id}`} onClick={() => openEdit(s)}>
                          <Pencil className="h-4 w-4 mr-1" /> แก้ไข
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={showForm} onOpenChange={(open) => { if (!open) resetForm(); }}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingStaff ? "แก้ไขพนักงาน" : "เพิ่มพนักงานใหม่"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <Label>ชื่อ-นามสกุล *</Label>
                <Input value={form.fullName} onChange={e => setForm(p => ({ ...p, fullName: e.target.value }))} data-testid="input-staff-fullname" />
              </div>
              <div>
                <Label>ชื่อผู้ใช้ (Username) *</Label>
                <Input value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} disabled={!!editingStaff} data-testid="input-staff-username" />
              </div>
              <div>
                <Label>{editingStaff ? "รหัสผ่านใหม่ (เว้นว่างถ้าไม่เปลี่ยน)" : "รหัสผ่าน *"}</Label>
                <Input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} data-testid="input-staff-password" />
              </div>
              <div>
                <Label>ตำแหน่ง</Label>
                <Select value={form.role} onValueChange={v => setForm(p => ({ ...p, role: v }))}>
                  <SelectTrigger data-testid="select-staff-role"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STAFF_ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>สาขาที่เข้าถึงได้</Label>
                <p className="text-xs text-gray-400 mb-2">เลือกสาขาที่พนักงานคนนี้สามารถเห็นและทำงานได้</p>
                {branches.length === 0 ? (
                  <p className="text-sm text-gray-400">ยังไม่มีสาขา กรุณาสร้างสาขาก่อน</p>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto border rounded-lg p-3">
                    {branches.map(b => (
                      <label key={b.id} className="flex items-center gap-2 cursor-pointer" data-testid={`checkbox-branch-${b.id}`}>
                        <Checkbox
                          checked={form.selectedBranchIds.includes(b.id)}
                          onCheckedChange={() => toggleBranch(b.id)}
                        />
                        <span className="text-sm">{b.name} ({b.code})</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              {editingStaff && (
                <div className="flex items-center gap-2">
                  <Label>สถานะ:</Label>
                  <Button
                    variant={editingStaff.active ? "destructive" : "default"}
                    size="sm"
                    data-testid="button-toggle-active"
                    onClick={() => updateMutation.mutate({ id: editingStaff.id, active: !editingStaff.active })}
                  >
                    {editingStaff.active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                  </Button>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={resetForm} data-testid="button-cancel-staff">ยกเลิก</Button>
                <Button
                  onClick={handleSubmit}
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-save-staff"
                >
                  {(createMutation.isPending || updateMutation.isPending) ? "กำลังบันทึก..." : "บันทึก"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={!!showImportResult} onOpenChange={() => setShowImportResult(null)}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>ผลการนำเข้า</DialogTitle>
            </DialogHeader>
            {showImportResult && (
              <div className="space-y-3 mt-2">
                <div className="flex gap-4">
                  <div className="text-center p-3 bg-green-50 rounded-lg flex-1">
                    <div className="text-2xl font-bold text-green-600">{showImportResult.created}</div>
                    <div className="text-xs text-green-600">สร้างสำเร็จ</div>
                  </div>
                  <div className="text-center p-3 bg-yellow-50 rounded-lg flex-1">
                    <div className="text-2xl font-bold text-yellow-600">{showImportResult.skipped}</div>
                    <div className="text-xs text-yellow-600">ข้าม</div>
                  </div>
                </div>
                {showImportResult.errors?.length > 0 && (
                  <div className="bg-red-50 rounded-lg p-3">
                    <div className="text-sm font-semibold text-red-600 mb-1">ข้อผิดพลาด:</div>
                    {showImportResult.errors.map((e: string, i: number) => (
                      <div key={i} className="text-xs text-red-500">{e}</div>
                    ))}
                  </div>
                )}
                <Button className="w-full" onClick={() => setShowImportResult(null)} data-testid="button-close-import-result">ปิด</Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </PosLayout>
  );
}
