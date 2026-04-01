import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import EcommerceLayout from "@/components/ecommerce-layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Key, Shield, CheckCircle2, XCircle, Eye, EyeOff, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface PlatformCredential {
  id: number;
  tenantId: number;
  platform: string;
  appId: string;
  redirectUrl: string | null;
  region: string;
  sandbox: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface PlatformInfo {
  name: string;
  nameTh: string;
  color: string;
  oauthRequired: string[];
}

const PLATFORM_COLORS: Record<string, string> = {
  shopee: "bg-orange-100 text-orange-700",
  lazada: "bg-indigo-100 text-indigo-700",
  tiktok: "bg-gray-100 text-gray-900",
  amazon: "bg-amber-100 text-amber-700",
};

const PLATFORM_LABELS: Record<string, string> = {
  shopee: "Shopee",
  lazada: "Lazada",
  tiktok: "TikTok Shop",
  amazon: "Amazon",
};

export default function PlatformCredentials() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [form, setForm] = useState({
    platform: "",
    appId: "",
    appSecret: "",
    redirectUrl: "",
    region: "TH",
    sandbox: false,
  });

  const { data, isLoading } = useQuery<{ credentials: PlatformCredential[]; platformInfo: Record<string, PlatformInfo> }>({
    queryKey: ["/api/platform-credentials"],
    queryFn: async () => {
      const r = await fetch("/api/platform-credentials", { credentials: "include" });
      if (!r.ok) throw new Error("Failed to load");
      return r.json();
    },
  });

  const credentials = data?.credentials || [];
  const platformInfo = data?.platformInfo || {};
  const configuredPlatforms = new Set(credentials.map(c => c.platform));

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingId) {
        await apiRequest("PATCH", `/api/platform-credentials/${editingId}`, data);
      } else {
        await apiRequest("POST", "/api/platform-credentials", data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/platform-credentials"] });
      setDialogOpen(false);
      resetForm();
      toast({ title: editingId ? "แก้ไขเรียบร้อย" : "เพิ่มเรียบร้อย" });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/platform-credentials/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/platform-credentials"] });
      toast({ title: "ลบเรียบร้อย" });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  function resetForm() {
    setEditingId(null);
    setForm({ platform: "", appId: "", appSecret: "", redirectUrl: "", region: "TH", sandbox: false });
    setShowSecret(false);
  }

  function openCreate() {
    resetForm();
    setDialogOpen(true);
  }

  function openEdit(cred: PlatformCredential) {
    setEditingId(cred.id);
    setForm({
      platform: cred.platform,
      appId: cred.appId,
      appSecret: "",
      redirectUrl: cred.redirectUrl || "",
      region: cred.region || "TH",
      sandbox: cred.sandbox,
    });
    setDialogOpen(true);
  }

  const availablePlatforms = Object.keys(platformInfo).filter(p => !configuredPlatforms.has(p) && platformInfo[p]?.oauthRequired?.length > 0);

  return (
    <EcommerceLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Key className="h-5 w-5 text-[#fb9678]" />
              ตั้งค่า API Credentials แพลตฟอร์ม
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              กรอก App ID และ Secret Key ของแต่ละแพลตฟอร์มเพื่อเชื่อมต่อดึงข้อมูลอัตโนมัติ
            </p>
          </div>
          {availablePlatforms.length > 0 && (
            <Button data-testid="btn-add-credential" onClick={openCreate} className="bg-[#fb9678] hover:bg-[#e8856a]">
              <Plus className="h-4 w-4 mr-1" /> เพิ่มแพลตฟอร์ม
            </Button>
          )}
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>แพลตฟอร์ม</TableHead>
                  <TableHead>App ID / Partner ID</TableHead>
                  <TableHead>Redirect URL</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead>โหมด</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead className="w-[100px]">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">กำลังโหลด...</TableCell></TableRow>
                ) : credentials.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    ยังไม่มี credentials กรุณาเพิ่มแพลตฟอร์มที่ต้องการเชื่อมต่อ
                  </TableCell></TableRow>
                ) : credentials.map(cred => (
                  <TableRow key={cred.id} data-testid={`row-credential-${cred.id}`}>
                    <TableCell>
                      <Badge className={`${PLATFORM_COLORS[cred.platform] || "bg-gray-100 text-gray-700"} hover:${PLATFORM_COLORS[cred.platform]}`}>
                        {PLATFORM_LABELS[cred.platform] || cred.platform}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{cred.appId}</TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate">{cred.redirectUrl || "-"}</TableCell>
                    <TableCell>{cred.region}</TableCell>
                    <TableCell>
                      {cred.sandbox ? (
                        <Badge variant="outline" className="border-yellow-500 text-yellow-600">Sandbox</Badge>
                      ) : (
                        <Badge variant="outline" className="border-green-500 text-green-600">Production</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {cred.active ? (
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100"><CheckCircle2 className="h-3 w-3 mr-1" />เปิดใช้งาน</Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-700 hover:bg-red-100"><XCircle className="h-3 w-3 mr-1" />ปิดใช้งาน</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button data-testid={`btn-edit-credential-${cred.id}`} size="icon" variant="ghost" onClick={() => openEdit(cred)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button data-testid={`btn-delete-credential-${cred.id}`} size="icon" variant="ghost" className="text-red-500"
                          onClick={() => { if (confirm("ต้องการลบ credentials นี้?")) deleteMutation.mutate(cred.id); }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Shield className="h-4 w-4 text-[#03c9d7]" />
              คำแนะนำเรื่องความปลอดภัย
            </h3>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <span>App Secret จะถูกเข้ารหัสและไม่แสดงผลหลังจากบันทึก เมื่อแก้ไขจะต้องกรอกใหม่</span>
            </div>
            <p>Credentials จะถูกใช้ร่วมกันทุกบริษัทภายใน Tenant เดียวกัน</p>
            <p>แต่ละแพลตฟอร์มสามารถเพิ่มได้ 1 ชุด credentials ต่อ Tenant</p>
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setDialogOpen(open); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "แก้ไข Credentials" : "เพิ่มแพลตฟอร์ม"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!editingId && (
              <div>
                <Label>แพลตฟอร์ม</Label>
                <Select value={form.platform} onValueChange={(v) => setForm({ ...form, platform: v })}>
                  <SelectTrigger data-testid="select-platform"><SelectValue placeholder="เลือกแพลตฟอร์ม" /></SelectTrigger>
                  <SelectContent>
                    {availablePlatforms.map(p => (
                      <SelectItem key={p} value={p}>{PLATFORM_LABELS[p] || p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.platform && platformInfo[form.platform] && (
                  <p className="text-xs text-muted-foreground mt-1">
                    ต้องการ: {platformInfo[form.platform].oauthRequired.join(", ")}
                  </p>
                )}
              </div>
            )}

            <div>
              <Label>App ID / Partner ID</Label>
              <Input data-testid="input-app-id" value={form.appId} onChange={(e) => setForm({ ...form, appId: e.target.value })} placeholder="เช่น 12345678" />
            </div>

            <div>
              <Label>App Secret / Partner Key</Label>
              <div className="relative">
                <Input
                  data-testid="input-app-secret"
                  type={showSecret ? "text" : "password"}
                  value={form.appSecret}
                  onChange={(e) => setForm({ ...form, appSecret: e.target.value })}
                  placeholder={editingId ? "กรอกใหม่หากต้องการเปลี่ยน" : ""}
                />
                <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full"
                  onClick={() => setShowSecret(!showSecret)}>
                  {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div>
              <Label>Redirect URL (ไม่บังคับ)</Label>
              <Input data-testid="input-redirect-url" value={form.redirectUrl} onChange={(e) => setForm({ ...form, redirectUrl: e.target.value })}
                placeholder="ระบบจะสร้างอัตโนมัติถ้าไม่กรอก" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Region</Label>
                <Select value={form.region} onValueChange={(v) => setForm({ ...form, region: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TH">Thailand</SelectItem>
                    <SelectItem value="VN">Vietnam</SelectItem>
                    <SelectItem value="MY">Malaysia</SelectItem>
                    <SelectItem value="SG">Singapore</SelectItem>
                    <SelectItem value="ID">Indonesia</SelectItem>
                    <SelectItem value="PH">Philippines</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch checked={form.sandbox} onCheckedChange={(v) => setForm({ ...form, sandbox: v })} />
                <Label>Sandbox Mode</Label>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { resetForm(); setDialogOpen(false); }}>ยกเลิก</Button>
              <Button
                data-testid="btn-save-credential"
                className="bg-[#fb9678] hover:bg-[#e8856a]"
                disabled={saveMutation.isPending || (!editingId && !form.platform) || !form.appId || (!editingId && !form.appSecret)}
                onClick={() => {
                  const payload: any = { ...form };
                  if (editingId && !payload.appSecret) delete payload.appSecret;
                  saveMutation.mutate(payload);
                }}
              >
                {saveMutation.isPending ? "กำลังบันทึก..." : "บันทึก"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </EcommerceLayout>
  );
}
