import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import PlatformLayout from "@/components/platform-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, CheckCircle, XCircle, Briefcase, Store, AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function PlatformDashboard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: stats, isLoading } = useQuery({
    queryKey: ["/api/platform/stats"],
    queryFn: async () => {
      const r = await fetch("/api/platform/stats", { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });

  const deleteOrphan = useMutation({
    mutationFn: async (userId: number) => {
      const r = await fetch(`/api/platform/orphan-users/${userId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!r.ok) {
        const data = await r.json();
        throw new Error(data.message || "ลบไม่สำเร็จ");
      }
      return r.json();
    },
    onSuccess: (data) => {
      toast({ title: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/platform/stats"] });
    },
    onError: (err: Error) => {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    },
  });

  return (
    <PlatformLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" data-testid="text-platform-title">ภาพรวมแพลตฟอร์ม</h1>
          <p className="text-gray-500 mt-1">จัดการลูกค้าทั้งหมดของ E-Tax Center</p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6"><div className="h-16 bg-gray-200 rounded" /></CardContent>
              </Card>
            ))}
          </div>
        ) : stats ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card className="border-l-4" style={{ borderLeftColor: "var(--theme-primary)" }} data-testid="card-total-tenants">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Tenant ทั้งหมด</p>
                      <p className="text-3xl font-bold text-gray-900 mt-1">{stats.totalTenants}</p>
                    </div>
                    <div className="h-12 w-12 rounded-xl flex items-center justify-center" style={{ background: "var(--theme-primary-light)" }}>
                      <Building2 className="h-6 w-6" style={{ color: "var(--theme-primary)" }} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-green-500" data-testid="card-active-tenants">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Active</p>
                      <p className="text-3xl font-bold text-green-600 mt-1">{stats.activeTenants}</p>
                    </div>
                    <div className="h-12 w-12 rounded-xl bg-green-50 flex items-center justify-center">
                      <CheckCircle className="h-6 w-6 text-green-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-red-500" data-testid="card-inactive-tenants">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Inactive</p>
                      <p className="text-3xl font-bold text-red-600 mt-1">{stats.inactiveTenants}</p>
                    </div>
                    <div className="h-12 w-12 rounded-xl bg-red-50 flex items-center justify-center">
                      <XCircle className="h-6 w-6 text-red-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4" style={{ borderLeftColor: "var(--theme-primary)" }} data-testid="card-accounting-firms">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">สำนักงานบัญชี</p>
                      <p className="text-3xl font-bold mt-1" style={{ color: "var(--theme-primary)" }}>{stats.accountingFirms}</p>
                    </div>
                    <div className="h-12 w-12 rounded-xl flex items-center justify-center" style={{ background: "var(--theme-primary-light)" }}>
                      <Briefcase className="h-6 w-6" style={{ color: "var(--theme-primary)" }} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-amber-500" data-testid="card-general-business">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">บริษัททั่วไป</p>
                      <p className="text-3xl font-bold text-amber-600 mt-1">{stats.generalBusiness}</p>
                    </div>
                    <div className="h-12 w-12 rounded-xl bg-amber-50 flex items-center justify-center">
                      <Store className="h-6 w-6 text-amber-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-purple-500" data-testid="card-total-users">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">ผู้ใช้งานทั้งหมด</p>
                      <p className="text-3xl font-bold text-purple-600 mt-1">{stats.totalUsers}</p>
                    </div>
                    <div className="h-12 w-12 rounded-xl bg-purple-50 flex items-center justify-center">
                      <Users className="h-6 w-6 text-purple-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {stats.orphanUsers?.length > 0 && (
              <Card className="border-l-4 border-l-red-500 bg-red-50/50" data-testid="card-orphan-users">
                <CardHeader>
                  <CardTitle className="text-lg text-red-700 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    ผู้ใช้ไม่มี Tenant ({stats.orphanUsers.length} คน)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-red-600 mb-3">ผู้ใช้เหล่านี้ไม่ได้สังกัด Tenant ใดๆ อาจสมัครเข้ามาเอง หรือถูกสร้างโดยไม่ระบุ Tenant</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-red-500">
                          <th className="pb-2 font-medium">ID</th>
                          <th className="pb-2 font-medium">ชื่อผู้ใช้</th>
                          <th className="pb-2 font-medium">ชื่อ-สกุล</th>
                          <th className="pb-2 font-medium">อีเมล</th>
                          <th className="pb-2 font-medium">จัดการ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.orphanUsers.map((u: any) => (
                          <tr key={u.id} className="border-b last:border-0" data-testid={`row-orphan-${u.id}`}>
                            <td className="py-2 text-gray-600">{u.id}</td>
                            <td className="py-2 font-medium text-gray-900">{u.username}</td>
                            <td className="py-2 text-gray-700">{u.fullName}</td>
                            <td className="py-2 text-gray-500">{u.email || "-"}</td>
                            <td className="py-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 px-2"
                                data-testid={`btn-delete-orphan-${u.id}`}
                                disabled={deleteOrphan.isPending}
                                onClick={() => {
                                  if (confirm(`ยืนยันลบผู้ใช้ "${u.username}"?`)) {
                                    deleteOrphan.mutate(u.id);
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">รายชื่อ Tenant ล่าสุด</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-gray-500">
                        <th className="pb-3 font-medium">ชื่อ</th>
                        <th className="pb-3 font-medium">ประเภท</th>
                        <th className="pb-3 font-medium">สถานะ</th>
                        <th className="pb-3 font-medium">ผู้ใช้</th>
                        <th className="pb-3 font-medium">วันที่สร้าง</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.tenants?.slice(0, 10).map((t: any) => (
                        <tr key={t.id} className="border-b last:border-0 hover:bg-gray-50" data-testid={`row-tenant-${t.id}`}>
                          <td className="py-3 font-medium text-gray-900">{t.name}</td>
                          <td className="py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              t.tenantType === "accounting_firm" 
                                ? "" 
                                : "bg-amber-100 text-amber-700"
                            }`} style={t.tenantType === "accounting_firm" ? { background: "var(--theme-primary-light)", color: "var(--theme-primary)" } : undefined}>
                              {t.tenantType === "accounting_firm" ? "สำนักงานบัญชี" : "บริษัททั่วไป"}
                            </span>
                          </td>
                          <td className="py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              t.status === "active"
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }`}>
                              {t.status === "active" ? "ใช้งาน" : "ปิดใช้งาน"}
                            </span>
                          </td>
                          <td className="py-3 text-gray-600">{t.userCount} คน</td>
                          <td className="py-3 text-gray-500">
                            {t.createdAt ? new Date(t.createdAt).toLocaleDateString("th-TH") : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </PlatformLayout>
  );
}
