import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Shield, Users, UserCheck, Save } from "lucide-react";

const DOC_TYPES = [
  { value: "QO", label: "ใบเสนอราคา", group: "sales" },
  { value: "SO", label: "ใบสั่งขาย", group: "sales" },
  { value: "IV", label: "ใบแจ้งหนี้", group: "sales" },
  { value: "TIV", label: "ใบกำกับภาษี", group: "sales" },
  { value: "RE", label: "ใบเสร็จรับเงิน", group: "sales" },
  { value: "BN", label: "ใบวางบิล", group: "sales" },
  { value: "PR", label: "ใบขอซื้อ", group: "purchase" },
  { value: "PO", label: "ใบสั่งซื้อ", group: "purchase" },
  { value: "AP", label: "ใบกำกับซื้อ", group: "purchase" },
  { value: "EXP", label: "ค่าใช้จ่าย", group: "purchase" },
  { value: "PV", label: "ใบสำคัญจ่าย", group: "purchase" },
];

const ROLES = [
  { value: "super_admin", label: "Super Admin" },
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "accountant", label: "นักบัญชี" },
];

interface ApprovalSettingRow {
  id?: number;
  documentType: string;
  enabled: boolean;
  approverMode: string;
  approverRoles: string[];
  approverUserIds: number[];
}

export default function ApprovalSettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: meData } = useQuery<any>({
    queryKey: ["/api/auth/me"],
    queryFn: () => fetch("/api/auth/me", { credentials: "include" }).then((r) => r.json()),
  });
  const selectedCompanyId = meData?.selectedCompanyId;

  const { data: settings = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/approval-settings", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/approval-settings?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return [];
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!selectedCompanyId,
  });

  const { data: companyUsers = [] } = useQuery<any[]>({
    queryKey: ["/api/users", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/users?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return [];
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!selectedCompanyId,
  });

  const [localSettings, setLocalSettings] = useState<Record<string, ApprovalSettingRow>>({});
  const [dirty, setDirty] = useState(false);

  const mergedSettings = useMemo(() => {
    const map: Record<string, ApprovalSettingRow> = {};
    for (const dt of DOC_TYPES) {
      const existing = settings.find((s: any) => s.documentType === dt.value);
      map[dt.value] = localSettings[dt.value] || {
        id: existing?.id,
        documentType: dt.value,
        enabled: existing?.enabled ?? false,
        approverMode: existing?.approverMode || "role",
        approverRoles: existing?.approverRoles || [],
        approverUserIds: existing?.approverUserIds || [],
      };
    }
    return map;
  }, [settings, localSettings]);

  const updateSetting = (docType: string, changes: Partial<ApprovalSettingRow>) => {
    setLocalSettings((prev) => ({
      ...prev,
      [docType]: { ...mergedSettings[docType], ...changes },
    }));
    setDirty(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const toSave = Object.values(localSettings);
      for (const setting of toSave) {
        const res = await fetch("/api/approval-settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            companyId: selectedCompanyId,
            documentType: setting.documentType,
            enabled: setting.enabled,
            approverMode: setting.approverMode,
            approverRoles: setting.approverRoles,
            approverUserIds: setting.approverUserIds,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ message: "บันทึกล้มเหลว" }));
          throw new Error(err.message || "บันทึกล้มเหลว");
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/approval-settings"] });
      setLocalSettings({});
      setDirty(false);
      toast({ title: "บันทึกสำเร็จ", description: "ตั้งค่าการอนุมัติเรียบร้อยแล้ว" });
    },
    onError: (err: any) => {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    },
  });

  const toggleRole = (docType: string, role: string) => {
    const current = mergedSettings[docType].approverRoles || [];
    const updated = current.includes(role) ? current.filter((r) => r !== role) : [...current, role];
    updateSetting(docType, { approverRoles: updated });
  };

  const toggleUser = (docType: string, userId: number) => {
    const current = mergedSettings[docType].approverUserIds || [];
    const updated = current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId];
    updateSetting(docType, { approverUserIds: updated });
  };

  const salesDocs = DOC_TYPES.filter((d) => d.group === "sales");
  const purchaseDocs = DOC_TYPES.filter((d) => d.group === "purchase");

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  const renderDocTypeRow = (dt: (typeof DOC_TYPES)[0]) => {
    const s = mergedSettings[dt.value];
    return (
      <div key={dt.value} className="border rounded-lg p-4 space-y-3" data-testid={`approval-setting-${dt.value}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Switch
              checked={s.enabled}
              onCheckedChange={(checked) => updateSetting(dt.value, { enabled: checked })}
              data-testid={`toggle-${dt.value}`}
            />
            <span className="font-medium text-sm">{dt.label}</span>
            <Badge variant="outline" className="text-xs">
              {dt.value}
            </Badge>
          </div>
          {s.enabled && (
            <Select
              value={s.approverMode}
              onValueChange={(v) => updateSetting(dt.value, { approverMode: v })}
            >
              <SelectTrigger className="w-[180px] h-8 text-xs" data-testid={`mode-${dt.value}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="role">ตาม Role</SelectItem>
                <SelectItem value="person">รายบุคคล</SelectItem>
                <SelectItem value="both">ทั้ง Role และรายบุคคล</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        {s.enabled && (s.approverMode === "role" || s.approverMode === "both") && (
          <div className="ml-8">
            <p className="text-xs text-gray-500 mb-2">Role ที่อนุมัติได้:</p>
            <div className="flex flex-wrap gap-2">
              {ROLES.map((role) => (
                <Badge
                  key={role.value}
                  variant={s.approverRoles?.includes(role.value) ? "default" : "outline"}
                  className={`cursor-pointer text-xs ${
                    s.approverRoles?.includes(role.value)
                      ? "bg-[#fb9678] hover:bg-[#e8855a]"
                      : "hover:bg-gray-100"
                  }`}
                  onClick={() => toggleRole(dt.value, role.value)}
                  data-testid={`role-${dt.value}-${role.value}`}
                >
                  {role.label}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {s.enabled && (s.approverMode === "person" || s.approverMode === "both") && (
          <div className="ml-8">
            <p className="text-xs text-gray-500 mb-2">ผู้อนุมัติ:</p>
            <div className="flex flex-wrap gap-2">
              {companyUsers.map((user: any) => (
                <Badge
                  key={user.id}
                  variant={s.approverUserIds?.includes(user.id) ? "default" : "outline"}
                  className={`cursor-pointer text-xs ${
                    s.approverUserIds?.includes(user.id)
                      ? "bg-[#03c9d7] hover:bg-[#02a8b5]"
                      : "hover:bg-gray-100"
                  }`}
                  onClick={() => toggleUser(dt.value, user.id)}
                  data-testid={`user-${dt.value}-${user.id}`}
                >
                  <UserCheck className="w-3 h-3 mr-1" />
                  {user.fullName || user.username}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-[#fb9678]" />
          <h1 className="text-xl font-bold">ตั้งค่าการอนุมัติเอกสาร</h1>
        </div>
        {dirty && (
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="bg-[#fb9678] hover:bg-[#e8855a]"
            data-testid="btn-save-approval"
          >
            <Save className="w-4 h-4 mr-2" />
            {saveMutation.isPending ? "กำลังบันทึก..." : "บันทึก"}
          </Button>
        )}
      </div>

      <p className="text-sm text-gray-500">
        เลือกเปิดการอนุมัติสำหรับเอกสารแต่ละประเภท และกำหนดผู้อนุมัติ 
        เมื่อผู้ใช้กด "ขออนุมัติ" ระบบจะส่งแจ้งเตือนทาง LINE พร้อมลิงก์ให้ผู้อนุมัติกดอนุมัติได้ทันที
      </p>

      <Card>
        <CardHeader className="bg-green-50 py-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="w-4 h-4 text-green-600" />
            เอกสารฝ่ายขาย
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          {salesDocs.map(renderDocTypeRow)}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="bg-blue-50 py-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600" />
            เอกสารฝ่ายจัดซื้อ / ค่าใช้จ่าย
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          {purchaseDocs.map(renderDocTypeRow)}
        </CardContent>
      </Card>
    </div>
  );
}
