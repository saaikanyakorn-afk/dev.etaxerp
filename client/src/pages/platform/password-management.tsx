import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import PlatformLayout from "@/components/platform-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  KeyRound,
  Save,
  Loader2,
  Eye,
  EyeOff,
  Shield,
  Users,
  Search,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function PasswordManagement() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [resetUser, setResetUser] = useState<any>(null);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetPwValue, setResetPwValue] = useState("");
  const [showResetPw, setShowResetPw] = useState(false);

  const { data: allUsers } = useQuery<any[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const r = await fetch("/api/users", { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
  });

  const filteredUsers = (allUsers || []).filter((u: any) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (u.fullName || "").toLowerCase().includes(q) ||
      (u.username || "").toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q)
    );
  });

  const changeMyPassword = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      const r = await fetch("/api/auth/me/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({ message: "เกิดข้อผิดพลาด" }));
        throw new Error(d.message);
      }
      return r.json();
    },
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast({ title: "เปลี่ยนรหัสผ่านสำเร็จ", variant: "success" as any });
    },
    onError: (err: any) => {
      toast({ title: err.message || "เกิดข้อผิดพลาด", variant: "destructive" });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ userId, newPassword }: { userId: number; newPassword: string }) => {
      const r = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId, newPassword }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({ message: "เกิดข้อผิดพลาด" }));
        throw new Error(d.message);
      }
      return r.json();
    },
    onSuccess: () => {
      setResetDialogOpen(false);
      setResetPwValue("");
      setResetUser(null);
      toast({ title: "รีเซ็ตรหัสผ่านสำเร็จ", variant: "success" as any });
    },
    onError: (err: any) => {
      toast({ title: err.message || "เกิดข้อผิดพลาด", variant: "destructive" });
    },
  });

  const handleChangeMyPassword = () => {
    if (newPassword !== confirmPassword) {
      toast({ title: "รหัสผ่านใหม่ไม่ตรงกัน", variant: "destructive" });
      return;
    }
    if (newPassword.length < 4) {
      toast({ title: "รหัสผ่านใหม่ต้องมีอย่างน้อย 4 ตัวอักษร", variant: "destructive" });
      return;
    }
    changeMyPassword.mutate({ currentPassword, newPassword });
  };

  const roleLabel = (role: string) => {
    switch (role) {
      case "super_admin": return "Super Admin";
      case "admin": return "Admin";
      case "manager": return "Manager";
      case "accountant": return "Accountant";
      case "employee": return "Employee";
      default: return role;
    }
  };

  return (
    <PlatformLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" data-testid="text-page-title">
            จัดการรหัสผ่าน
          </h1>
          <p className="text-sm text-gray-500 mt-1">เปลี่ยนรหัสผ่านของตัวเอง หรือรีเซ็ตรหัสผ่านให้ผู้ใช้คนอื่น</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-t-4 border-t-amber-500">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="h-5 w-5 text-amber-500" />
                เปลี่ยนรหัสผ่านของฉัน
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800">
                  ผู้ใช้: <span className="font-semibold">{user?.fullName}</span> ({user?.username})
                </p>
              </div>

              <div className="space-y-1">
                <Label className="text-sm">รหัสผ่านปัจจุบัน</Label>
                <div className="relative">
                  <Input
                    type={showCurrent ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="กรอกรหัสผ่านปัจจุบัน"
                    data-testid="input-current-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-sm">รหัสผ่านใหม่</Label>
                <div className="relative">
                  <Input
                    type={showNew ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="กรอกรหัสผ่านใหม่ (อย่างน้อย 4 ตัวอักษร)"
                    data-testid="input-new-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-sm">ยืนยันรหัสผ่านใหม่</Label>
                <div className="relative">
                  <Input
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
                    data-testid="input-confirm-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {newPassword && confirmPassword && newPassword !== confirmPassword && (
                <p className="text-sm text-red-500">รหัสผ่านใหม่ไม่ตรงกัน</p>
              )}

              <Button
                onClick={handleChangeMyPassword}
                disabled={changeMyPassword.isPending || !currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword}
                className="w-full bg-amber-500 hover:bg-amber-600 text-white"
                data-testid="button-change-my-password"
              >
                {changeMyPassword.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                เปลี่ยนรหัสผ่าน
              </Button>
            </CardContent>
          </Card>

          <Card className="border-t-4 border-t-blue-500">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-500" />
                รีเซ็ตรหัสผ่านผู้ใช้
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="ค้นหาผู้ใช้ (ชื่อ, username, email)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-user"
                />
              </div>

              <div className="border rounded-lg overflow-hidden max-h-[400px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-gray-600">ผู้ใช้</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-600">บทบาท</th>
                      <th className="text-right px-3 py-2 font-medium text-gray-600"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredUsers.map((u: any) => (
                      <tr key={u.id} className="hover:bg-gray-50" data-testid={`row-user-${u.id}`}>
                        <td className="px-3 py-2">
                          <p className="font-medium text-gray-900">{u.fullName}</p>
                          <p className="text-xs text-gray-500">{u.username}</p>
                        </td>
                        <td className="px-3 py-2">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                            {roleLabel(u.role)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-blue-600 border-blue-300 hover:bg-blue-50"
                            onClick={() => {
                              setResetUser(u);
                              setResetPwValue("");
                              setShowResetPw(false);
                              setResetDialogOpen(true);
                            }}
                            data-testid={`button-reset-pw-${u.id}`}
                          >
                            <KeyRound className="h-3.5 w-3.5 mr-1" />
                            รีเซ็ต
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {filteredUsers.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-3 py-8 text-center text-gray-400">
                          ไม่พบผู้ใช้
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-blue-500" />
              รีเซ็ตรหัสผ่าน
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                ตั้งรหัสผ่านใหม่ให้ <span className="font-semibold">{resetUser?.fullName}</span> ({resetUser?.username})
              </p>
            </div>

            <div className="space-y-1">
              <Label className="text-sm">รหัสผ่านใหม่</Label>
              <div className="relative">
                <Input
                  type={showResetPw ? "text" : "password"}
                  value={resetPwValue}
                  onChange={(e) => setResetPwValue(e.target.value)}
                  placeholder="กรอกรหัสผ่านใหม่ (อย่างน้อย 4 ตัวอักษร)"
                  data-testid="input-reset-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowResetPw(!showResetPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showResetPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setResetDialogOpen(false)} data-testid="button-cancel-reset">
                ยกเลิก
              </Button>
              <Button
                onClick={() => resetUser && resetPasswordMutation.mutate({ userId: resetUser.id, newPassword: resetPwValue })}
                disabled={resetPasswordMutation.isPending || resetPwValue.length < 4}
                className="bg-blue-600 hover:bg-blue-700 text-white"
                data-testid="button-confirm-reset"
              >
                {resetPasswordMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <KeyRound className="h-4 w-4 mr-2" />
                )}
                รีเซ็ตรหัสผ่าน
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </PlatformLayout>
  );
}
