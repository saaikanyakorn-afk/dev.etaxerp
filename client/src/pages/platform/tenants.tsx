import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import PlatformLayout from "@/components/platform-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Plus, Building2, Power, PowerOff, Search, LogIn, User, Crown } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

function ImpersonateButton({ tenantId, tenantName }: { tenantId: number; tenantName: string }) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const { data: tenantUsers, isLoading } = useQuery<any[]>({
    queryKey: [`/api/platform/tenants/${tenantId}/users`],
    queryFn: async () => {
      const r = await fetch(`/api/platform/tenants/${tenantId}/users`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
  });

  const impersonateMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await apiRequest("POST", `/api/platform/impersonate/${userId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.clear();
      toast({ title: `เข้าสู่ระบบในฐานะลูกค้า "${tenantName}" สำเร็จ` });
      window.location.href = "/dashboard";
    },
    onError: (err: any) => {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    },
  });

  const adminUsers = tenantUsers?.filter((u: any) => u.role === "admin") || [];
  const allUsers = tenantUsers || [];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="text-[#03c9d7] hover:text-[#02b5c2] hover:bg-[#e5f9fa]" data-testid={`btn-impersonate-${tenantId}`}>
          <LogIn className="h-3.5 w-3.5 mr-1" /> เข้าระบบ
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="end">
        <div className="text-xs font-medium text-gray-500 px-2 py-1.5 mb-1">เข้าสู่ระบบในฐานะ</div>
        {isLoading ? (
          <div className="text-xs text-gray-400 px-2 py-3 text-center">กำลังโหลด...</div>
        ) : allUsers.length === 0 ? (
          <div className="text-xs text-gray-400 px-2 py-3 text-center">ไม่พบผู้ใช้</div>
        ) : (
          <div className="space-y-0.5 max-h-48 overflow-y-auto">
            {(adminUsers.length > 0 ? adminUsers : allUsers).map((u: any) => (
              <button
                key={u.id}
                onClick={() => impersonateMutation.mutate(u.id)}
                disabled={impersonateMutation.isPending}
                className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-left hover:bg-gray-50 transition-colors text-sm disabled:opacity-50"
                data-testid={`btn-impersonate-user-${u.id}`}
              >
                <div className="w-7 h-7 rounded-full bg-[#03c9d7]/10 flex items-center justify-center flex-shrink-0">
                  <User className="w-3.5 h-3.5 text-[#03c9d7]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-800 truncate text-xs">{u.fullName}</div>
                  <div className="text-[10px] text-gray-400">{u.username} ({u.role})</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default function PlatformTenants() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const [form, setForm] = useState({
    name: "",
    tenantType: "accounting_firm",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    adminUsername: "",
    adminPassword: "",
    notes: "",
  });

  const { data: tenants, isLoading } = useQuery<any[]>({
    queryKey: ["/api/platform/tenants"],
    queryFn: async () => {
      const r = await fetch("/api/platform/tenants", { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const r = await fetch("/api/platform/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.message);
      }
      return r.json();
    },
    onSuccess: (data) => {
      toast({ title: "สำเร็จ", description: data.message, variant: "success" as any });
      queryClient.invalidateQueries({ queryKey: ["/api/platform/tenants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/platform/stats"] });
      setDialogOpen(false);
      setForm({ name: "", tenantType: "accounting_firm", contactName: "", contactEmail: "", contactPhone: "", adminUsername: "", adminPassword: "", notes: "" });
    },
    onError: (err: Error) => {
      toast({ title: "ผิดพลาด", description: err.message, variant: "destructive" });
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const r = await fetch(`/api/platform/tenants/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/platform/tenants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/platform/stats"] });
      toast({ title: "อัปเดตสถานะสำเร็จ", variant: "success" as any });
    },
  });

  const filteredTenants = (tenants || []).filter((t: any) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <PlatformLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900" data-testid="text-tenants-title">จัดการ Tenant</h1>
            <p className="text-gray-500 mt-1">สร้างและจัดการลูกค้าทั้งหมดบนแพลตฟอร์ม</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-amber-500 hover:bg-amber-600 text-white" data-testid="button-create-tenant">
                <Plus className="h-4 w-4 mr-2" />
                สร้าง Tenant ใหม่
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>สร้าง Tenant ใหม่</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  createMutation.mutate(form);
                }}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label>ชื่อบริษัท / สำนักงาน *</Label>
                    <Input
                      data-testid="input-tenant-name"
                      value={form.name}
                      onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="บริษัท ตัวอย่าง จำกัด"
                      required
                    />
                  </div>
                  <div className="col-span-2">
                    <Label>ประเภท *</Label>
                    <Select value={form.tenantType} onValueChange={(v) => setForm(f => ({ ...f, tenantType: v }))}>
                      <SelectTrigger data-testid="select-tenant-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="accounting_firm">สำนักงานบัญชี</SelectItem>
                        <SelectItem value="general_business">บริษัททั่วไป</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>ชื่อผู้ติดต่อ</Label>
                    <Input
                      data-testid="input-contact-name"
                      value={form.contactName}
                      onChange={(e) => setForm(f => ({ ...f, contactName: e.target.value }))}
                      placeholder="คุณสมชาย"
                    />
                  </div>
                  <div>
                    <Label>อีเมล</Label>
                    <Input
                      data-testid="input-contact-email"
                      type="email"
                      value={form.contactEmail}
                      onChange={(e) => setForm(f => ({ ...f, contactEmail: e.target.value }))}
                      placeholder="contact@example.com"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label>เบอร์โทร</Label>
                    <Input
                      data-testid="input-contact-phone"
                      value={form.contactPhone}
                      onChange={(e) => setForm(f => ({ ...f, contactPhone: e.target.value }))}
                      placeholder="02-xxx-xxxx"
                    />
                  </div>
                </div>

                <div className="border-t pt-4">
                  <p className="text-sm font-medium text-gray-700 mb-3">บัญชีผู้ดูแลระบบ (Admin) ของ Tenant</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>ชื่อผู้ใช้ *</Label>
                      <Input
                        data-testid="input-admin-username"
                        value={form.adminUsername}
                        onChange={(e) => setForm(f => ({ ...f, adminUsername: e.target.value }))}
                        placeholder="admin_company"
                        required
                      />
                    </div>
                    <div>
                      <Label>รหัสผ่าน *</Label>
                      <Input
                        data-testid="input-admin-password"
                        type="password"
                        value={form.adminPassword}
                        onChange={(e) => setForm(f => ({ ...f, adminPassword: e.target.value }))}
                        placeholder="••••••••"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <Label>หมายเหตุ</Label>
                  <Input
                    data-testid="input-notes"
                    value={form.notes}
                    onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="หมายเหตุเพิ่มเติม..."
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>ยกเลิก</Button>
                  <Button
                    type="submit"
                    className="bg-amber-500 hover:bg-amber-600"
                    disabled={createMutation.isPending}
                    data-testid="button-submit-tenant"
                  >
                    {createMutation.isPending ? "กำลังสร้าง..." : "สร้าง Tenant"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            data-testid="input-search-tenant"
            placeholder="ค้นหา tenant..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-gray-500">กำลังโหลด...</div>
            ) : filteredTenants.length === 0 ? (
              <div className="p-8 text-center text-gray-500">ไม่พบ Tenant</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50/50 text-left text-gray-500">
                      <th className="px-4 py-3 font-medium">ชื่อ</th>
                      <th className="px-4 py-3 font-medium">ประเภท</th>
                      <th className="px-4 py-3 font-medium">แพ็คเกจ</th>
                      <th className="px-4 py-3 font-medium">สถานะ</th>
                      <th className="px-4 py-3 font-medium">ผู้ติดต่อ</th>
                      <th className="px-4 py-3 font-medium">ผู้ใช้</th>
                      <th className="px-4 py-3 font-medium">วันที่สร้าง</th>
                      <th className="px-4 py-3 font-medium text-center">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTenants.map((t: any) => (
                      <tr key={t.id} className="border-b last:border-0 hover:bg-gray-50/50 transition-colors" data-testid={`row-tenant-${t.id}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-gray-400" />
                            <span className="font-medium text-gray-900">{t.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            t.tenantType === "accounting_firm"
                              ? "bg-[#e5f9fa] text-[#03c9d7]"
                              : "bg-amber-100 text-amber-700"
                          }`}>
                            {t.tenantType === "accounting_firm" ? "สำนักงานบัญชี" : "บริษัททั่วไป"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {t.planName ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                              <Crown className="h-3 w-3" />
                              {t.planName}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">ทดลองใช้</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            t.status === "active"
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${t.status === "active" ? "bg-green-500" : "bg-red-500"}`} />
                            {t.status === "active" ? "ใช้งาน" : "ปิดใช้งาน"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          <div>
                            {t.contactName && <div>{t.contactName}</div>}
                            {t.contactEmail && <div className="text-xs text-gray-400">{t.contactEmail}</div>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{t.userCount} คน</td>
                        <td className="px-4 py-3 text-gray-500">
                          {t.createdAt ? new Date(t.createdAt).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" }) : "-"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <ImpersonateButton tenantId={t.id} tenantName={t.name} />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleStatusMutation.mutate({
                                id: t.id,
                                status: t.status === "active" ? "inactive" : "active"
                              })}
                              className={t.status === "active" ? "text-red-500 hover:text-red-700 hover:bg-red-50" : "text-green-500 hover:text-green-700 hover:bg-green-50"}
                              data-testid={`button-toggle-${t.id}`}
                            >
                              {t.status === "active" ? (
                                <><PowerOff className="h-3.5 w-3.5 mr-1" /> ปิด</>
                              ) : (
                                <><Power className="h-3.5 w-3.5 mr-1" /> เปิด</>
                              )}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PlatformLayout>
  );
}
