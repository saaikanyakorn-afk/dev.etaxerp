import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import EcommerceLayout from "@/components/ecommerce-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Users, Plus, Pencil, Trash2, Shield, ShoppingCart, Package, Truck, BarChart3, Settings, CreditCard, RotateCcw, Store, UserCheck, UserX, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";

const ECOM_ROLES: Record<string, { label: string; color: string }> = {
  manager: { label: "ผู้จัดการ", color: "bg-blue-100 text-blue-700" },
  operator: { label: "ปฏิบัติการ", color: "bg-green-100 text-green-700" },
  viewer: { label: "ดูอย่างเดียว", color: "bg-gray-100 text-gray-600" },
};

const ECOM_PERMISSIONS = [
  { key: "orders", label: "จัดการออเดอร์", icon: ShoppingCart, description: "ดู/แก้ไข/อัพเดทสถานะออเดอร์" },
  { key: "fulfillment", label: "จัดส่งสินค้า", icon: Truck, description: "Pick-Pack-Ship, พิมพ์ใบจัดส่ง" },
  { key: "inventory", label: "คลังสินค้า", icon: Package, description: "ดู/แก้ไขสต๊อก, สินค้า" },
  { key: "returns", label: "คืนสินค้า", icon: RotateCcw, description: "รับคืน, QC, ออกใบลดหนี้" },
  { key: "analytics", label: "ดูยอดขาย", icon: BarChart3, description: "แดชบอร์ด, รายงาน, วิเคราะห์" },
  { key: "settlements", label: "การเงิน", icon: CreditCard, description: "ตรวจสอบการรับเงิน, Settlement" },
  { key: "settings", label: "ตั้งค่า", icon: Settings, description: "เชื่อมต่อแพลตฟอร์ม, ตั้งค่า" },
];

interface TeamMember {
  id: number;
  companyId: number;
  userId: number;
  role: string;
  permissions: string[] | null;
  assignedStoreIds: number[] | null;
  nickname: string | null;
  active: boolean;
  createdAt: string;
  userFullName: string;
  username: string;
  userRole: string;
}

interface StoreInfo {
  id: number;
  storeName: string;
  platform: string;
}

interface AvailableUser {
  id: number;
  fullName: string;
  username: string;
  role: string;
}

export default function EcomTeam() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<TeamMember | null>(null);

  const [formUserId, setFormUserId] = useState<number | null>(null);
  const [formRole, setFormRole] = useState("operator");
  const [formPermissions, setFormPermissions] = useState<string[]>(["orders", "fulfillment"]);
  const [formStoreIds, setFormStoreIds] = useState<number[]>([]);
  const [formNickname, setFormNickname] = useState("");
  const [formAllStores, setFormAllStores] = useState(true);

  const { data, isLoading } = useQuery<{ members: TeamMember[]; stores: StoreInfo[] }>({
    queryKey: ["/api/ecommerce/team", companyId],
    queryFn: () => fetch(`/api/ecommerce/team?companyId=${companyId}`).then(r => r.json()),
    enabled: !!companyId,
  });

  const { data: availableUsers } = useQuery<AvailableUser[]>({
    queryKey: ["/api/ecommerce/team/available-users", companyId],
    queryFn: () => fetch(`/api/ecommerce/team/available-users?companyId=${companyId}`).then(r => r.json()),
    enabled: !!companyId && dialogOpen && !editingMember,
  });

  const addMember = useMutation({
    mutationFn: (body: any) => apiRequest("POST", "/api/ecommerce/team", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/team"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/team/available-users"] });
      setDialogOpen(false);
      toast({ title: "เพิ่มสมาชิกเรียบร้อย" });
    },
    onError: (err: any) => toast({ title: "ผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const updateMember = useMutation({
    mutationFn: ({ id, ...body }: any) => apiRequest("PATCH", `/api/ecommerce/team/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/team"] });
      setDialogOpen(false);
      setEditingMember(null);
      toast({ title: "อัพเดทเรียบร้อย" });
    },
    onError: (err: any) => toast({ title: "ผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const removeMember = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/ecommerce/team/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/team"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/team/available-users"] });
      setDeleteConfirm(null);
      toast({ title: "ลบสมาชิกเรียบร้อย" });
    },
  });

  const openAdd = () => {
    setEditingMember(null);
    setFormUserId(null);
    setFormRole("operator");
    setFormPermissions(["orders", "fulfillment"]);
    setFormStoreIds([]);
    setFormNickname("");
    setFormAllStores(true);
    setDialogOpen(true);
  };

  const openEdit = (m: TeamMember) => {
    setEditingMember(m);
    setFormUserId(m.userId);
    setFormRole(m.role);
    setFormPermissions(m.permissions || []);
    setFormStoreIds(m.assignedStoreIds || []);
    setFormNickname(m.nickname || "");
    setFormAllStores(!m.assignedStoreIds || m.assignedStoreIds.length === 0);
    setDialogOpen(true);
  };

  const handleSave = () => {
    const storeIds = formAllStores ? null : formStoreIds;
    if (editingMember) {
      updateMember.mutate({ id: editingMember.id, role: formRole, permissions: formPermissions, assignedStoreIds: storeIds, nickname: formNickname || null });
    } else {
      if (!formUserId) return toast({ title: "กรุณาเลือกผู้ใช้งาน", variant: "destructive" });
      addMember.mutate({ companyId, userId: formUserId, role: formRole, permissions: formPermissions, assignedStoreIds: storeIds, nickname: formNickname || null });
    }
  };

  const togglePermission = (key: string) => {
    setFormPermissions(prev => prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key]);
  };

  const toggleStore = (storeId: number) => {
    setFormStoreIds(prev => prev.includes(storeId) ? prev.filter(s => s !== storeId) : [...prev, storeId]);
  };

  const members = data?.members || [];
  const stores = data?.stores || [];
  const storeMap = new Map(stores.map(s => [s.id, s]));

  if (!companyId) return <EcommerceLayout><div className="p-6 text-center text-muted-foreground">กรุณาเลือกบริษัท</div></EcommerceLayout>;

  return (
    <EcommerceLayout>
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Users className="h-6 w-6 text-[#03c9d7]" />
            ทีมงาน E-Commerce
          </h1>
          <p className="text-sm text-muted-foreground">กำหนดว่าใครดูแลร้านไหน มีสิทธิ์ทำอะไรได้บ้าง</p>
        </div>
        <div className="flex gap-2">
          <Link href="/settings/users">
            <Button variant="outline" size="sm" className="gap-1" data-testid="link-central-users">
              <ExternalLink className="h-3.5 w-3.5" />
              จัดการผู้ใช้กลาง
            </Button>
          </Link>
          <Button onClick={openAdd} className="gap-1 bg-[#03c9d7] hover:bg-[#03c9d7]/90" data-testid="button-add-member">
            <Plus className="h-4 w-4" />
            เพิ่มสมาชิก
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center text-muted-foreground py-12">กำลังโหลด...</div>
      ) : members.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto text-gray-300 mb-3" />
            <p className="text-lg font-medium text-gray-500">ยังไม่มีทีมงาน E-Commerce</p>
            <p className="text-sm text-muted-foreground mb-4">เพิ่มสมาชิกเพื่อกำหนดสิทธิ์และร้านที่ดูแล</p>
            <Button onClick={openAdd} className="gap-1 bg-[#03c9d7] hover:bg-[#03c9d7]/90" data-testid="button-add-first">
              <Plus className="h-4 w-4" />
              เพิ่มสมาชิกคนแรก
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {members.map(m => (
            <Card key={m.id} className={`transition-opacity ${!m.active ? "opacity-50" : ""}`} data-testid={`card-member-${m.id}`}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#03c9d7]/10 flex items-center justify-center">
                      {m.active ? <UserCheck className="h-5 w-5 text-[#03c9d7]" /> : <UserX className="h-5 w-5 text-gray-400" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{m.nickname || m.userFullName}</span>
                        {m.nickname && <span className="text-xs text-muted-foreground">({m.userFullName})</span>}
                        <Badge variant="outline" className={ECOM_ROLES[m.role]?.color || "bg-gray-100"}>
                          {ECOM_ROLES[m.role]?.label || m.role}
                        </Badge>
                        {!m.active && <Badge variant="outline" className="bg-red-50 text-red-500">ปิดใช้งาน</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">@{m.username} | บทบาทในระบบ: {m.userRole}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(m)} data-testid={`button-edit-${m.id}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm(m)} data-testid={`button-delete-${m.id}`}>
                      <Trash2 className="h-4 w-4 text-red-400" />
                    </Button>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-4">
                  <div>
                    <span className="text-xs font-medium text-muted-foreground block mb-1">สิทธิ์</span>
                    <div className="flex flex-wrap gap-1">
                      {(m.permissions || []).map(p => {
                        const perm = ECOM_PERMISSIONS.find(ep => ep.key === p);
                        return (
                          <Badge key={p} variant="outline" className="text-xs gap-1 bg-[#05b187]/5 text-[#05b187] border-[#05b187]/20">
                            {perm ? <perm.icon className="h-3 w-3" /> : null}
                            {perm?.label || p}
                          </Badge>
                        );
                      })}
                      {(!m.permissions || m.permissions.length === 0) && <span className="text-xs text-gray-400">ไม่มีสิทธิ์</span>}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-muted-foreground block mb-1">ร้านที่ดูแล</span>
                    <div className="flex flex-wrap gap-1">
                      {(!m.assignedStoreIds || m.assignedStoreIds.length === 0) ? (
                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-600">ทุกร้าน</Badge>
                      ) : (
                        m.assignedStoreIds.map(sid => {
                          const store = storeMap.get(sid);
                          return (
                            <Badge key={sid} variant="outline" className="text-xs gap-1">
                              <Store className="h-3 w-3" />
                              {store ? `${store.storeName} (${store.platform})` : `#${sid}`}
                            </Badge>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingMember ? "แก้ไขสมาชิก" : "เพิ่มสมาชิกทีม E-Commerce"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!editingMember && (
              <div>
                <Label>เลือกผู้ใช้งาน</Label>
                <Select value={formUserId ? String(formUserId) : ""} onValueChange={v => setFormUserId(Number(v))}>
                  <SelectTrigger data-testid="select-user">
                    <SelectValue placeholder="เลือกผู้ใช้..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(availableUsers || []).map(u => (
                      <SelectItem key={u.id} value={String(u.id)}>
                        {u.fullName} (@{u.username}) - {u.role}
                      </SelectItem>
                    ))}
                    {availableUsers?.length === 0 && (
                      <div className="px-3 py-2 text-sm text-muted-foreground">ไม่มีผู้ใช้ที่ยังไม่ได้เพิ่ม</div>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>ชื่อเล่น (ไม่บังคับ)</Label>
              <Input value={formNickname} onChange={e => setFormNickname(e.target.value)} placeholder="ชื่อเล่นในทีม" data-testid="input-nickname" />
            </div>

            <div>
              <Label>บทบาทใน E-Commerce</Label>
              <Select value={formRole} onValueChange={setFormRole}>
                <SelectTrigger data-testid="select-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manager">ผู้จัดการ — ดูและจัดการได้ทุกอย่าง</SelectItem>
                  <SelectItem value="operator">ปฏิบัติการ — ทำงานตามสิทธิ์ที่กำหนด</SelectItem>
                  <SelectItem value="viewer">ดูอย่างเดียว — ดูข้อมูลได้ ไม่แก้ไข</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div>
              <Label className="flex items-center gap-1 mb-2">
                <Shield className="h-4 w-4" />
                สิทธิ์การเข้าถึง
              </Label>
              {formRole === "manager" ? (
                <p className="text-sm text-muted-foreground">ผู้จัดการมีสิทธิ์ทุกอย่างอัตโนมัติ</p>
              ) : formRole === "viewer" ? (
                <p className="text-sm text-muted-foreground">ดูข้อมูลได้ทั้งหมด แต่ไม่สามารถแก้ไขได้</p>
              ) : (
                <div className="grid gap-2">
                  {ECOM_PERMISSIONS.map(perm => (
                    <label key={perm.key} className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer" data-testid={`checkbox-perm-${perm.key}`}>
                      <Checkbox checked={formPermissions.includes(perm.key)} onCheckedChange={() => togglePermission(perm.key)} className="mt-0.5" />
                      <div>
                        <div className="flex items-center gap-1.5 text-sm font-medium">
                          <perm.icon className="h-3.5 w-3.5 text-[#03c9d7]" />
                          {perm.label}
                        </div>
                        <p className="text-xs text-muted-foreground">{perm.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            <div>
              <Label className="flex items-center gap-1 mb-2">
                <Store className="h-4 w-4" />
                ร้านที่ดูแล
              </Label>
              <label className="flex items-center gap-2 mb-2 cursor-pointer" data-testid="checkbox-all-stores">
                <Checkbox checked={formAllStores} onCheckedChange={(v) => setFormAllStores(!!v)} />
                <span className="text-sm">ทุกร้าน</span>
              </label>
              {!formAllStores && stores.length > 0 && (
                <div className="grid gap-1.5 ml-6">
                  {stores.map(s => (
                    <label key={s.id} className="flex items-center gap-2 cursor-pointer" data-testid={`checkbox-store-${s.id}`}>
                      <Checkbox checked={formStoreIds.includes(s.id)} onCheckedChange={() => toggleStore(s.id)} />
                      <span className="text-sm">{s.storeName} ({s.platform})</span>
                    </label>
                  ))}
                </div>
              )}
              {!formAllStores && stores.length === 0 && (
                <p className="text-sm text-muted-foreground ml-6">ยังไม่มีร้านที่เชื่อมต่อ</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>ยกเลิก</Button>
            <Button onClick={handleSave} className="bg-[#03c9d7] hover:bg-[#03c9d7]/90" disabled={addMember.isPending || updateMember.isPending} data-testid="button-save">
              {editingMember ? "บันทึก" : "เพิ่มสมาชิก"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>ยืนยันการลบสมาชิก</DialogTitle>
          </DialogHeader>
          <p className="text-sm">ต้องการลบ <strong>{deleteConfirm?.nickname || deleteConfirm?.userFullName}</strong> ออกจากทีม E-Commerce?</p>
          <p className="text-xs text-muted-foreground">ผู้ใช้งานจะยังอยู่ในระบบกลาง แต่จะถูกเอาออกจากทีม E-Commerce</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>ยกเลิก</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && removeMember.mutate(deleteConfirm.id)} data-testid="button-confirm-delete">
              ลบออกจากทีม
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </EcommerceLayout>
  );
}
