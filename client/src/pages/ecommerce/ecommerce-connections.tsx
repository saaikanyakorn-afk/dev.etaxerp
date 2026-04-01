import EcommerceLayout from "@/components/ecommerce-layout";
import { getPlatformLogo } from "@/lib/platform-logos";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, RefreshCw, Store, ExternalLink, Key, Link2, Tag } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import type { EcommerceConnection } from "@shared/schema";
import { formatDateTime } from "@/lib/format";

import { useDateSettings } from "@/hooks/use-date-settings";
const PLATFORMS = [
  { value: "shopee", label: "Shopee", color: "bg-orange-500", textColor: "text-orange-700", bgLight: "bg-orange-100", hex: "#ee4d2d", defaultPrefix: "SH" },
  { value: "lazada", label: "Lazada", color: "bg-purple-600", textColor: "text-purple-700", bgLight: "bg-purple-100", hex: "#0f146d", defaultPrefix: "LZ" },
  { value: "tiktok", label: "TikTok Shop", color: "bg-gray-900", textColor: "text-pink-700", bgLight: "bg-pink-100", hex: "#000000", defaultPrefix: "TK" },
  { value: "amazon", label: "Amazon", color: "bg-yellow-500", textColor: "text-yellow-700", bgLight: "bg-yellow-100", hex: "#ff9900", defaultPrefix: "AZ" },
  { value: "live", label: "Facebook", color: "bg-blue-600", textColor: "text-blue-700", bgLight: "bg-blue-100", hex: "#1877f2", defaultPrefix: "FB" },
];

const CONNECTION_STATUSES: Record<string, { label: string; className: string }> = {
  connected: { label: "เชื่อมต่อแล้ว", className: "bg-green-100 text-green-700 hover:bg-green-100" },
  pending: { label: "รอเชื่อมต่อ", className: "bg-yellow-100 text-yellow-700 hover:bg-yellow-100" },
  disconnected: { label: "ยกเลิกเชื่อมต่อ", className: "bg-red-100 text-red-700 hover:bg-red-100" },
  error: { label: "ข้อผิดพลาด", className: "bg-red-100 text-red-700 hover:bg-red-100" },
};

type ConnectionForm = { platform: string; shopName: string; shopId: string; docPrefix: string };
const emptyConnectionForm: ConnectionForm = { platform: "", shopName: "", shopId: "", docPrefix: "" };

function connectionStatusBadge(status: string) {
  const s = CONNECTION_STATUSES[status];
  if (!s) return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">{status}</Badge>;
  return <Badge data-testid={`badge-conn-status-${status}`} className={s.className}>{s.label}</Badge>;
}

function suggestPrefix(platformValue: string, existingPrefixes: string[]): string {
  const p = PLATFORMS.find(pl => pl.value === platformValue);
  const base = p?.defaultPrefix || platformValue.substring(0, 2).toUpperCase();
  for (let i = 1; i <= 99; i++) {
    const candidate = `${base}${String(i).padStart(2, "0")}`;
    if (!existingPrefixes.includes(candidate)) return candidate;
  }
  return `${base}01`;
}

export default function EcommerceConnections() {
  const { selectedCompanyId } = useCompany();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [connDialogOpen, setConnDialogOpen] = useState(false);
  const [editingConnId, setEditingConnId] = useState<number | null>(null);
  const [connForm, setConnForm] = useState<ConnectionForm>({ ...emptyConnectionForm });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthResult = params.get("oauth");
    const platform = params.get("platform");
    if (oauthResult === "success") {
      toast({ title: `เชื่อมต่อ ${platform || ""} สำเร็จ!`, variant: "success" as any });
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/connections"] });
      window.history.replaceState({}, "", "/ecommerce/connections");
    } else if (oauthResult === "error") {
      const msg = params.get("message");
      toast({ title: "เชื่อมต่อไม่สำเร็จ", description: msg || "โปรดลองอีกครั้ง", variant: "destructive" });
      window.history.replaceState({}, "", "/ecommerce/connections");
    }
  }, []);

  const oauthStartMutation = useMutation({
    mutationFn: async ({ platform, connectionId }: { platform: string; connectionId?: number }) => {
      const params = new URLSearchParams({ companyId: String(selectedCompanyId) });
      if (connectionId) params.set("connectionId", String(connectionId));
      const r = await fetch(`/api/ecommerce/oauth/${platform}/start?${params}`, { credentials: "include" });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: (data) => {
      if (data.authUrl) window.location.href = data.authUrl;
    },
    onError: (err: any) => toast({ title: "ไม่สามารถเริ่ม OAuth ได้", description: err.message, variant: "destructive" }),
  });

  const refreshTokenMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/ecommerce/connections/${id}/refresh-token`, { method: "POST", credentials: "include" });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/connections"] }); toast({ title: "รีเฟรช Token สำเร็จ" }); },
    onError: (err: any) => toast({ title: "รีเฟรช Token ไม่สำเร็จ", description: err.message, variant: "destructive" }),
  });

  const { data: platformInfoData = [] } = useQuery<any[]>({
    queryKey: ["/api/ecommerce/platform-info"],
    queryFn: async () => {
      const r = await fetch("/api/ecommerce/platform-info", { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
  });

  const oauthPlatforms = new Set(platformInfoData.filter(p => p.supportsOAuth).map(p => p.platform));

  const { dateEra, dateFmt } = useDateSettings();
  const { data: docSettings } = useQuery<any>({
    queryKey: ["/api/document-settings", selectedCompanyId],
    queryFn: async () => {
      if (!selectedCompanyId) return null;
      const res = await fetch(`/api/document-settings?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!selectedCompanyId,
  });
  const { data: connections = [], isLoading: connLoading } = useQuery<EcommerceConnection[]>({
    queryKey: ["/api/ecommerce/connections", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/ecommerce/connections?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const existingPrefixes = connections.map(c => c.docPrefix).filter(Boolean) as string[];

  const createConnection = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch("/api/ecommerce/connections", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ ...data, companyId: selectedCompanyId }) });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/connections"] }); toast({ title: "เพิ่มการเชื่อมต่อสำเร็จ", variant: "success" as any }); resetConnForm(); },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const updateConnection = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const r = await fetch(`/api/ecommerce/connections/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(data) });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/connections"] }); toast({ title: "แก้ไขการเชื่อมต่อสำเร็จ", variant: "success" as any }); resetConnForm(); },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const deleteConnection = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/ecommerce/connections/${id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/connections"] }); toast({ title: "ลบการเชื่อมต่อสำเร็จ", variant: "success" as any }); },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  function resetConnForm() {
    setConnForm({ ...emptyConnectionForm });
    setEditingConnId(null);
    setConnDialogOpen(false);
  }

  function handleEditConnection(c: EcommerceConnection) {
    setEditingConnId(c.id);
    setConnForm({ platform: c.platform, shopName: c.shopName, shopId: c.shopId || "", docPrefix: c.docPrefix || "" });
    setConnDialogOpen(true);
  }

  function handleOpenNewConnection(platformValue: string) {
    const suggested = platformValue ? suggestPrefix(platformValue, existingPrefixes) : "";
    setConnForm({ platform: platformValue, shopName: "", shopId: "", docPrefix: suggested });
    setEditingConnId(null);
    setConnDialogOpen(true);
  }

  function handleSubmitConnection() {
    if (!connForm.platform || !connForm.shopName) {
      toast({ title: "กรุณากรอกข้อมูลให้ครบ", variant: "destructive" });
      return;
    }
    if (!connForm.docPrefix || connForm.docPrefix.length < 2) {
      toast({ title: "กรุณาระบุ Prefix เอกสารอย่างน้อย 2 ตัวอักษร", variant: "destructive" });
      return;
    }
    const prefixUpper = connForm.docPrefix.toUpperCase();
    const duplicate = connections.find(c => c.docPrefix === prefixUpper && c.id !== editingConnId);
    if (duplicate) {
      toast({ title: `Prefix "${prefixUpper}" ถูกใช้แล้วโดยร้าน "${duplicate.shopName}"`, variant: "destructive" });
      return;
    }
    const submitData = { ...connForm, docPrefix: prefixUpper };
    if (editingConnId) {
      updateConnection.mutate({ id: editingConnId, data: submitData });
    } else {
      createConnection.mutate(submitData);
    }
  }

  const connectedCount = connections.filter(c => c.status === "connected").length;

  return (
    <EcommerceLayout>
      <div className="space-y-6" data-testid="page-ecommerce-connections">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">เชื่อมต่อแพลตฟอร์ม</h1>
            <p className="text-muted-foreground text-sm">จัดการการเชื่อมต่อร้านค้าบน Shopee, Lazada, TikTok Shop, Grab Food, LINE MAN, Robinhood, Amazon</p>
          </div>
          <Button onClick={() => handleOpenNewConnection("")} data-testid="button-add-connection" style={{ background: "#03c9d7" }} className="text-white hover:opacity-90">
            <Plus className="h-4 w-4 mr-1" />เพิ่มการเชื่อมต่อ
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="rounded-xl shadow-sm border" data-testid="card-kpi-total-platforms">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="text-xs text-muted-foreground mb-1">แพลตฟอร์มทั้งหมด</div>
              <div className="text-xl font-bold" style={{ color: "#03c9d7" }}>{PLATFORMS.length}</div>
            </CardContent>
          </Card>
          <Card className="rounded-xl shadow-sm border" data-testid="card-kpi-connected">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="text-xs text-muted-foreground mb-1">เชื่อมต่อแล้ว</div>
              <div className="text-xl font-bold text-green-600">{connectedCount}</div>
            </CardContent>
          </Card>
          <Card className="rounded-xl shadow-sm border" data-testid="card-kpi-total-connections">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="text-xs text-muted-foreground mb-1">การเชื่อมต่อทั้งหมด</div>
              <div className="text-xl font-bold" style={{ color: "#fb9678" }}>{connections.length}</div>
            </CardContent>
          </Card>
          <Card className="rounded-xl shadow-sm border" data-testid="card-kpi-not-connected">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="text-xs text-muted-foreground mb-1">ยังไม่เชื่อมต่อ</div>
              <div className="text-xl font-bold text-gray-400">{PLATFORMS.length - new Set(connections.map(c => c.platform)).size}</div>
            </CardContent>
          </Card>
        </div>

        {connLoading ? (
          <p className="text-center py-8 text-muted-foreground">กำลังโหลด...</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {PLATFORMS.map(platform => {
              const platformConns = connections.filter(c => c.platform === platform.value);
              return (
                <Card key={platform.value} className="rounded-xl shadow-sm border overflow-hidden" data-testid={`card-platform-${platform.value}`}>
                  <div className="h-1.5" style={{ background: platform.hex }} />
                  <CardContent className="pt-4 pb-4 px-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getPlatformLogo(platform.value) && (
                          <img src={getPlatformLogo(platform.value)} alt={platform.label} className="w-6 h-6 rounded-full object-cover" />
                        )}
                        <span className="font-semibold text-sm">{platform.label}</span>
                      </div>
                      {platformConns.length > 0 ? (
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-xs">{platformConns.length} ร้าน</Badge>
                      ) : (
                        <Badge className="bg-gray-100 text-gray-500 hover:bg-gray-100 text-xs">ยังไม่เชื่อมต่อ</Badge>
                      )}
                    </div>

                    {platformConns.length > 0 ? (
                      <div className="space-y-3">
                        {platformConns.map(conn => (
                          <div key={conn.id} className="border rounded-lg p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5 text-sm">
                                <Store className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="font-medium">{conn.shopName}</span>
                              </div>
                              {connectionStatusBadge(conn.status)}
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              {conn.docPrefix && (
                                <Badge variant="outline" className="text-xs border-blue-300 text-blue-700 bg-blue-50" data-testid={`badge-prefix-${conn.id}`}>
                                  <Tag className="h-3 w-3 mr-1" />
                                  Prefix: {conn.docPrefix}
                                </Badge>
                              )}
                              {conn.shopId && (
                                <span className="text-xs text-muted-foreground">
                                  Shop ID: {conn.shopId}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <RefreshCw className="h-3 w-3" />
                              <span>ซิงค์ล่าสุด: {formatDateTime(conn.lastSyncAt as any, dateEra, dateFmt) || "-"}</span>
                            </div>
                            <div className="flex flex-wrap gap-1 pt-1">
                              {oauthPlatforms.has(conn.platform) && (
                                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" style={{ color: "#03c9d7" }}
                                  onClick={() => oauthStartMutation.mutate({ platform: conn.platform, connectionId: conn.id })}
                                  disabled={oauthStartMutation.isPending}
                                  data-testid={`button-oauth-conn-${conn.id}`}>
                                  <ExternalLink className="h-3 w-3 mr-1" />OAuth
                                </Button>
                              )}
                              {conn.status === "connected" && conn.refreshToken && (
                                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs"
                                  onClick={() => refreshTokenMutation.mutate(conn.id)}
                                  disabled={refreshTokenMutation.isPending}
                                  data-testid={`button-refresh-token-${conn.id}`}>
                                  <Key className="h-3 w-3 mr-1" />Refresh
                                </Button>
                              )}
                              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => handleEditConnection(conn)} data-testid={`button-edit-conn-${conn.id}`}>
                                <Pencil className="h-3 w-3 mr-1" />แก้ไข
                              </Button>
                              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-red-500 hover:text-red-600" onClick={() => { if (confirm("ต้องการลบการเชื่อมต่อนี้?")) deleteConnection.mutate(conn.id); }} data-testid={`button-delete-conn-${conn.id}`}>
                                <Trash2 className="h-3 w-3 mr-1" />ลบ
                              </Button>
                              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" style={{ color: "#03c9d7" }} data-testid={`button-sync-conn-${conn.id}`}
                                onClick={() => {
                                    toast({ title: "ใช้การนำเข้าจาก Excel/CSV", description: `ไปที่ "นำเข้าจาก Excel" เพื่อนำเข้าออเดอร์จาก ${platform.label}` });
                                }}
                              >
                                <RefreshCw className="h-3 w-3 mr-1" />ซิงค์
                              </Button>
                            </div>
                          </div>
                        ))}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full h-7 text-xs text-muted-foreground"
                          onClick={() => handleOpenNewConnection(platform.value)}
                          data-testid={`button-add-more-${platform.value}`}
                        >
                          <Plus className="h-3 w-3 mr-1" />เพิ่มร้านอีก
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2 mt-2">
                        {oauthPlatforms.has(platform.value) && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full h-8 text-xs border-[#03c9d7] text-[#03c9d7] hover:bg-[#03c9d7]/10"
                            onClick={() => oauthStartMutation.mutate({ platform: platform.value })}
                            disabled={oauthStartMutation.isPending}
                            data-testid={`button-oauth-connect-${platform.value}`}
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />เชื่อมต่อ OAuth
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full h-8 text-xs"
                          onClick={() => handleOpenNewConnection(platform.value)}
                          data-testid={`button-connect-${platform.value}`}
                        >
                          <Plus className="h-3 w-3 mr-1" />เพิ่มด้วยตนเอง
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <Dialog open={connDialogOpen} onOpenChange={(open) => { if (!open) resetConnForm(); else setConnDialogOpen(true); }}>
          <DialogContent className="max-w-md" data-testid="dialog-connection">
            <DialogHeader>
              <DialogTitle>{editingConnId ? "แก้ไขการเชื่อมต่อ" : "เพิ่มการเชื่อมต่อแพลตฟอร์ม"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>แพลตฟอร์ม</Label>
                <Select value={connForm.platform} onValueChange={v => {
                  const suggested = suggestPrefix(v, existingPrefixes);
                  setConnForm(f => ({ ...f, platform: v, docPrefix: suggested }));
                }}>
                  <SelectTrigger data-testid="select-conn-platform"><SelectValue placeholder="เลือกแพลตฟอร์ม" /></SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>ชื่อร้าน</Label>
                <Input value={connForm.shopName} onChange={e => setConnForm(f => ({ ...f, shopName: e.target.value }))} placeholder="เช่น อุดมสุข Lazada" data-testid="input-conn-shop-name" />
              </div>
              <div>
                <Label>Prefix เอกสาร</Label>
                <Input
                  value={connForm.docPrefix}
                  onChange={e => setConnForm(f => ({ ...f, docPrefix: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) }))}
                  placeholder="เช่น SH01, LZ01"
                  maxLength={6}
                  data-testid="input-conn-prefix"
                />
                <p className="text-xs text-muted-foreground mt-1">ใช้เป็น prefix ในเลขใบกำกับภาษี เช่น {connForm.docPrefix || "XX01"}-0001</p>
              </div>
              <div>
                <Label>Shop ID</Label>
                <Input value={connForm.shopId} onChange={e => setConnForm(f => ({ ...f, shopId: e.target.value }))} placeholder="รหัสร้านค้าบนแพลตฟอร์ม" data-testid="input-conn-shop-id" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={resetConnForm} data-testid="button-cancel-conn">ยกเลิก</Button>
                <Button onClick={handleSubmitConnection} disabled={createConnection.isPending || updateConnection.isPending} data-testid="button-save-conn" style={{ background: "#03c9d7" }} className="text-white hover:opacity-90">
                  {editingConnId ? "บันทึก" : "เพิ่ม"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </EcommerceLayout>
  );
}
