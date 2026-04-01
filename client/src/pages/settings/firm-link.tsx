import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Copy, Link2, Unlink, Clock, CheckCircle, XCircle, Shield, ShieldCheck } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/format";

export default function FirmLinkPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [inviteResult, setInviteResult] = useState<{ inviteCode: string; expiresAt: string } | null>(null);
  const [acceptCode, setAcceptCode] = useState("");

  const { data: companies = [] } = useQuery<any[]>({
    queryKey: ["/api/companies"],
  });

  const { data: myLinks = [] } = useQuery<any[]>({
    queryKey: ["/api/firm-links/my-links"],
  });

  const { data: linkedClients = [] } = useQuery<any[]>({
    queryKey: ["/api/firm-links/linked-clients"],
  });

  const { data: authData } = useQuery<any>({
    queryKey: ["/api/auth/me"],
  });
  const tenantType = authData?.tenant?.tenantType;
  const isAccountingFirm = tenantType === "accounting_firm";

  const generateMutation = useMutation({
    mutationFn: async (companyId: number) => {
      const res = await apiRequest("POST", "/api/firm-links/generate", { companyId });
      return res.json();
    },
    onSuccess: (data) => {
      setInviteResult({ inviteCode: data.inviteCode, expiresAt: data.expiresAt });
      queryClient.invalidateQueries({ queryKey: ["/api/firm-links/my-links"] });
      toast({ title: data.existing ? "ใช้รหัสเดิมที่ยังไม่หมดอายุ" : "สร้างรหัสเชิญสำเร็จ" });
    },
    onError: () => toast({ title: "เกิดข้อผิดพลาด", variant: "destructive" }),
  });

  const acceptMutation = useMutation({
    mutationFn: async (inviteCode: string) => {
      const res = await apiRequest("POST", "/api/firm-links/accept", { inviteCode });
      return res.json();
    },
    onSuccess: (data) => {
      setAcceptCode("");
      queryClient.invalidateQueries({ queryKey: ["/api/firm-links/linked-clients"] });
      toast({ title: `เชื่อมต่อกับ "${data.companyName}" สำเร็จ` });
    },
    onError: (err: any) => toast({ title: err.message || "รหัสไม่ถูกต้อง", variant: "destructive" }),
  });

  const revokeMutation = useMutation({
    mutationFn: async (linkId: number) => {
      const res = await apiRequest("POST", `/api/firm-links/${linkId}/revoke`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/firm-links/my-links"] });
      queryClient.invalidateQueries({ queryKey: ["/api/firm-links/linked-clients"] });
      toast({ title: "ยกเลิกการเชื่อมต่อแล้ว" });
    },
  });

  const accessMutation = useMutation({
    mutationFn: async ({ linkId, accessLevel }: { linkId: number; accessLevel: string }) => {
      const res = await apiRequest("POST", `/api/firm-links/${linkId}/access-level`, { accessLevel });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/firm-links/my-links"] });
      toast({ title: "อัปเดตสิทธิ์สำเร็จ" });
    },
  });

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "คัดลอกรหัสแล้ว" });
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "pending": return <Badge variant="outline" className="text-amber-600 border-amber-400"><Clock className="w-3 h-3 mr-1" />รอรับ</Badge>;
      case "linked": return <Badge className="bg-green-100 text-green-700"><CheckCircle className="w-3 h-3 mr-1" />เชื่อมแล้ว</Badge>;
      case "expired": return <Badge variant="secondary"><XCircle className="w-3 h-3 mr-1" />หมดอายุ</Badge>;
      case "revoked": return <Badge variant="destructive"><Unlink className="w-3 h-3 mr-1" />ยกเลิก</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <Link2 className="w-7 h-7 text-[#fb9678]" />
        <h1 className="text-2xl font-bold">เชื่อมสำนักงานบัญชี</h1>
      </div>
      <p className="text-gray-500 text-sm">เชื่อมต่อกิจการของคุณกับสำนักงานบัญชี เพื่อให้ดูแลงานบัญชีให้ได้</p>

      {!isAccountingFirm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              สร้างรหัสเชิญ
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-500">เลือกบริษัทที่ต้องการเชื่อมกับสำนักงานบัญชี แล้วส่งรหัสเชิญให้ทางสำนักงาน</p>
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="text-sm font-medium mb-1 block">เลือกบริษัท</label>
                <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                  <SelectTrigger data-testid="select-company">
                    <SelectValue placeholder="เลือกบริษัท..." />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((c: any) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                data-testid="btn-generate-invite"
                onClick={() => generateMutation.mutate(Number(selectedCompanyId))}
                disabled={!selectedCompanyId || generateMutation.isPending}
                className="bg-[#fb9678] hover:bg-[#e8856a]"
              >
                สร้างรหัสเชิญ
              </Button>
            </div>

            {inviteResult && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-3">
                <p className="text-sm text-amber-800 mb-2">ส่งรหัสนี้ให้สำนักงานบัญชีของคุณ (หมดอายุ {formatDate(inviteResult.expiresAt)})</p>
                <div className="flex items-center gap-2">
                  <code className="text-2xl font-mono font-bold tracking-widest bg-white px-4 py-2 rounded border" data-testid="text-invite-code">
                    {inviteResult.inviteCode}
                  </code>
                  <Button variant="outline" size="icon" onClick={() => copyCode(inviteResult.inviteCode)} data-testid="btn-copy-code">
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {isAccountingFirm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Link2 className="w-5 h-5" />
              รับลูกค้าใหม่
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-500">กรอกรหัสเชิญ 8 หลักที่ลูกค้าส่งมา เพื่อเชื่อมต่อและดูแลงานบัญชี</p>
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="text-sm font-medium mb-1 block">รหัสเชิญ</label>
                <Input
                  data-testid="input-invite-code"
                  value={acceptCode}
                  onChange={(e) => setAcceptCode(e.target.value.toUpperCase())}
                  placeholder="เช่น A1B2C3D4"
                  maxLength={8}
                  className="font-mono text-lg tracking-widest"
                />
              </div>
              <Button
                data-testid="btn-accept-invite"
                onClick={() => acceptMutation.mutate(acceptCode)}
                disabled={acceptCode.length < 8 || acceptMutation.isPending}
                className="bg-[#05b187] hover:bg-[#049a76]"
              >
                เชื่อมต่อ
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isAccountingFirm && linkedClients.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              ลูกค้าที่เชื่อมแล้ว ({linkedClients.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {linkedClients.map((link: any) => (
                <div key={link.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border" data-testid={`linked-client-${link.id}`}>
                  <div>
                    <p className="font-medium">{link.companyName || "ไม่ทราบชื่อ"}</p>
                    <p className="text-xs text-gray-500">
                      เลขประจำตัว: {link.companyTaxId || "-"} | เชื่อมเมื่อ {formatDate(link.linkedAt)}
                    </p>
                    <p className="text-xs text-gray-400">Tenant: {link.clientTenantName}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={link.accessLevel === "full" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}>
                      {link.accessLevel === "full" ? <><ShieldCheck className="w-3 h-3 mr-1" />เต็ม</> : <><Shield className="w-3 h-3 mr-1" />ดูอย่างเดียว</>}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-500 border-red-300 hover:bg-red-50"
                      onClick={() => revokeMutation.mutate(link.id)}
                      data-testid={`btn-revoke-${link.id}`}
                    >
                      <Unlink className="w-3 h-3 mr-1" />ยกเลิก
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!isAccountingFirm && myLinks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">ประวัติรหัสเชิญ</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {myLinks.map((link: any) => (
                <div key={link.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border" data-testid={`link-history-${link.id}`}>
                  <div>
                    <p className="font-medium">{link.companyName}</p>
                    <p className="text-xs text-gray-500">
                      รหัส: <code className="font-mono">{link.inviteCode}</code> | สร้างเมื่อ {formatDate(link.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {statusBadge(link.status)}
                    {link.status === "linked" && (
                      <Select
                        value={link.accessLevel || "readonly"}
                        onValueChange={(val) => accessMutation.mutate({ linkId: link.id, accessLevel: val })}
                      >
                        <SelectTrigger className="w-36 h-8 text-xs" data-testid={`select-access-${link.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="readonly">ดูอย่างเดียว</SelectItem>
                          <SelectItem value="full">เต็ม (แก้ไขได้)</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    {(link.status === "pending" || link.status === "linked") && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-500 border-red-300 hover:bg-red-50"
                        onClick={() => revokeMutation.mutate(link.id)}
                        data-testid={`btn-revoke-${link.id}`}
                      >
                        <Unlink className="w-3 h-3 mr-1" />ยกเลิก
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
