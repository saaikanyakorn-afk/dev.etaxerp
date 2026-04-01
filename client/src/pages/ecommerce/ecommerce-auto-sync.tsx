import { useState } from "react";
import EcommerceLayout from "@/components/ecommerce-layout";
import { getPlatformLogo } from "@/lib/platform-logos";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  RefreshCw, Settings, Loader2, Info, Store, Link2, ShoppingCart, Package, BarChart3, CheckCircle2, XCircle, Clock
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { useToast } from "@/hooks/use-toast";
import { formatDateTime } from "@/lib/format";
import type { EcommerceConnection, SyncLog } from "@shared/schema";
import { useDateSettings } from "@/hooks/use-date-settings";

const PLATFORMS = [
  { value: "shopee", label: "Shopee", hex: "#EE4D2D", bgLight: "bg-orange-100", textColor: "text-orange-700" },
  { value: "lazada", label: "Lazada", hex: "#0F146D", bgLight: "bg-indigo-100", textColor: "text-indigo-700" },
  { value: "tiktok", label: "TikTok Shop", hex: "#000000", bgLight: "bg-gray-100", textColor: "text-gray-900" },
  { value: "amazon", label: "Amazon", hex: "#FF9900", bgLight: "bg-amber-100", textColor: "text-amber-700" },
];

const OAUTH_PLATFORMS = [
  { value: "shopee", label: "Shopee Open Platform" },
  { value: "lazada", label: "Lazada Open Platform" },
  { value: "tiktok", label: "TikTok Shop Open API" },
  { value: "amazon", label: "Amazon SP-API" },
];

const SYNC_INTERVALS = [
  { value: "15", label: "ทุก 15 นาที" },
  { value: "30", label: "ทุก 30 นาที" },
  { value: "60", label: "ทุก 1 ชั่วโมง" },
  { value: "120", label: "ทุก 2 ชั่วโมง" },
  { value: "360", label: "ทุก 6 ชั่วโมง" },
  { value: "720", label: "ทุก 12 ชั่วโมง" },
  { value: "1440", label: "ทุก 24 ชั่วโมง" },
];

const CONNECTION_STATUSES: Record<string, { label: string; className: string }> = {
  connected: { label: "เชื่อมต่อแล้ว", className: "bg-green-100 text-green-700 hover:bg-green-100" },
  pending: { label: "รอเชื่อมต่อ", className: "bg-yellow-100 text-yellow-700 hover:bg-yellow-100" },
  disconnected: { label: "ยกเลิกเชื่อมต่อ", className: "bg-red-100 text-red-700 hover:bg-red-100" },
  error: { label: "ข้อผิดพลาด", className: "bg-red-100 text-red-700 hover:bg-red-100" },
};

function platformBadge(platform: string) {
    const p = PLATFORMS.find(pl => pl.value === platform);
    if (!p) return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">{platform}</Badge>;
    const logo = getPlatformLogo(platform);
    return (
      <Badge className={`${p.bgLight} ${p.textColor} hover:${p.bgLight}`}>
        {logo && <img src={logo} alt={p.label} className="w-4 h-4 rounded-full object-cover" />}
        {p.label}
      </Badge>
    );
  }

function statusBadge(status: string) {
  const s = CONNECTION_STATUSES[status];
  if (!s) return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">{status}</Badge>;
  return <Badge data-testid={`badge-conn-status-${status}`} className={s.className}>{s.label}</Badge>;
}

function parseSyncSettings(settings: string | null | undefined) {
  if (!settings) return { autoSync: false, interval: "60", syncTypes: ["orders"] };
  try {
    const parsed = JSON.parse(settings);
    return {
      autoSync: parsed.autoSync ?? false,
      interval: String(parsed.interval ?? "60"),
      syncTypes: parsed.syncTypes ?? ["orders"],
    };
  } catch {
    return { autoSync: false, interval: "60", syncTypes: ["orders"] };
  }
}

export default function EcommerceAutoSync() {
  const { selectedCompanyId } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [settingsConnectionId, setSettingsConnectionId] = useState<number | null>(null);
  const [autoSync, setAutoSync] = useState(false);
  const [syncInterval, setSyncInterval] = useState("60");
  const [syncTypes, setSyncTypes] = useState<string[]>(["orders"]);

  const { data: connections = [], isLoading: connLoading } = useQuery<EcommerceConnection[]>({
    queryKey: ["/api/ecommerce/connections", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/ecommerce/connections?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const { data: syncLogs = [], isLoading: logsLoading } = useQuery<SyncLog[]>({
    queryKey: ["/api/ecommerce/sync-logs", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/ecommerce/sync-logs?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const triggerSyncMutation = useMutation({
    mutationFn: async ({ connectionId, platform }: { connectionId: number; platform: string }) => {
      const r = await fetch("/api/ecommerce/sync/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ companyId: selectedCompanyId, connectionId, platform }),
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/sync-logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/connections"] });
      toast({ title: "เริ่มซิงค์ข้อมูลแล้ว", variant: "success" as any });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const saveSyncSettingsMutation = useMutation({
    mutationFn: async ({ id, settings }: { id: number; settings: any }) => {
      const r = await fetch(`/api/ecommerce/connections/${id}/sync-settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ settings }),
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/connections"] });
      setSettingsDialogOpen(false);
      toast({ title: "บันทึกการตั้งค่าสำเร็จ", variant: "success" as any });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const openSettingsDialog = (conn: EcommerceConnection) => {
    const parsed = parseSyncSettings(conn.settings);
    setSettingsConnectionId(conn.id);
    setAutoSync(parsed.autoSync);
    setSyncInterval(parsed.interval);
    setSyncTypes(parsed.syncTypes);
    setSettingsDialogOpen(true);
  };

  const handleSaveSettings = () => {
    if (!settingsConnectionId) return;
    saveSyncSettingsMutation.mutate({
      id: settingsConnectionId,
      settings: { autoSync, interval: syncInterval, syncTypes },
    });
  };

  const toggleSyncType = (type: string) => {
    setSyncTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const connectedPlatforms = connections.map(c => c.platform);
  const unconnectedOAuthPlatforms = OAUTH_PLATFORMS.filter(p => !connectedPlatforms.includes(p.value));

  return (
    <EcommerceLayout>
      <div className="space-y-6" data-testid="page-auto-sync">
        <div>
          <h1 className="text-2xl font-bold text-gray-800" data-testid="text-auto-sync-title">ซิงค์ออเดอร์อัตโนมัติ</h1>
          <p className="text-sm text-muted-foreground mt-1">เชื่อมต่อแพลตฟอร์ม e-Commerce เพื่อดึงออเดอร์อัตโนมัติ ตั้งค่าช่วงเวลาซิงค์และติดตามประวัติการซิงค์</p>
        </div>

        {connLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            {connections.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-gray-700 mb-3" data-testid="text-connected-platforms-header">แพลตฟอร์มที่เชื่อมต่อ</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {connections.map(conn => {
                    const p = PLATFORMS.find(pl => pl.value === conn.platform);
                    const parsed = parseSyncSettings(conn.settings);
                    return (
                      <Card key={conn.id} className="rounded-xl shadow-sm border overflow-hidden" data-testid={`card-connection-${conn.id}`}>
                        <div className="h-1.5" style={{ background: p?.hex || "#ccc" }} />
                        <CardContent className="pt-4 pb-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div
                                className="h-8 w-8 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                                style={{ background: p?.hex || "#888" }}
                                data-testid={`badge-platform-logo-${conn.id}`}
                              >
                                {(p?.label || conn.platform).charAt(0).toUpperCase()}
                              </div>
                              {platformBadge(conn.platform)}
                            </div>
                            {statusBadge(conn.status)}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-800" data-testid={`text-shop-name-${conn.id}`}>
                              <Store className="h-3.5 w-3.5 inline mr-1 text-muted-foreground" />
                              {conn.shopName}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1" data-testid={`text-last-sync-${conn.id}`}>
                              <Clock className="h-3 w-3 inline mr-1" />
                              ซิงค์ล่าสุด: {formatDateTime(conn.lastSyncAt as string, dateEra, dateFmt)}
                            </p>
                            {parsed.autoSync && (
                              <p className="text-xs text-green-600 mt-0.5">
                                <RefreshCw className="h-3 w-3 inline mr-1" />
                                ซิงค์อัตโนมัติ: {SYNC_INTERVALS.find(i => i.value === parsed.interval)?.label || parsed.interval + " นาที"}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 pt-1">
                            <Button
                              size="sm"
                              className="flex-1"
                              onClick={() => triggerSyncMutation.mutate({ connectionId: conn.id, platform: conn.platform })}
                              disabled={triggerSyncMutation.isPending}
                              data-testid={`button-sync-now-${conn.id}`}
                            >
                              {triggerSyncMutation.isPending ? (
                                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                              ) : (
                                <RefreshCw className="h-4 w-4 mr-1" />
                              )}
                              ซิงค์เดี๋ยวนี้
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openSettingsDialog(conn)}
                              data-testid={`button-settings-${conn.id}`}
                            >
                              <Settings className="h-4 w-4" />
                              <span className="ml-1">ตั้งค่า</span>
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {unconnectedOAuthPlatforms.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-gray-700 mb-3" data-testid="text-oauth-section-header">เชื่อมต่อแพลตฟอร์มเพิ่มเติม</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {unconnectedOAuthPlatforms.map(op => {
                    const p = PLATFORMS.find(pl => pl.value === op.value);
                    return (
                      <Card key={op.value} className="rounded-xl shadow-sm border" data-testid={`card-oauth-${op.value}`}>
                        <CardContent className="pt-5 pb-5 space-y-4">
                          <div className="flex items-center gap-3">
                            <div
                              className="h-10 w-10 rounded-xl flex items-center justify-center text-white font-bold"
                              style={{ background: p?.hex || "#888" }}
                            >
                              {op.label.charAt(0)}
                            </div>
                            <div>
                              <p className="font-medium text-gray-800">{op.label}</p>
                              <p className="text-xs text-muted-foreground">ยังไม่ได้เชื่อมต่อ</p>
                            </div>
                          </div>

                          <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                            <p className="text-xs font-medium text-gray-600">ขั้นตอนการเชื่อมต่อ:</p>
                            <div className="space-y-1.5">
                              <div className="flex items-start gap-2 text-xs text-gray-600">
                                <span className="h-5 w-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold shrink-0">1</span>
                                <span>กรุณาสมัคร API Partner กับ {op.label.split(" ").slice(0, -1).join(" ") || op.label}</span>
                              </div>
                              <div className="flex items-start gap-2 text-xs text-gray-600">
                                <span className="h-5 w-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold shrink-0">2</span>
                                <span>นำ App ID / App Secret มาใส่ในระบบ</span>
                              </div>
                              <div className="flex items-start gap-2 text-xs text-gray-600">
                                <span className="h-5 w-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold shrink-0">3</span>
                                <span>ระบบจะเชื่อมต่อและดึงข้อมูลอัตโนมัติ</span>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div>
                              <Label className="text-xs text-muted-foreground">App ID</Label>
                              <Input
                                disabled
                                placeholder="จะเปิดใช้งานเมื่อได้รับ credentials"
                                className="h-8 text-sm"
                                data-testid={`input-app-id-${op.value}`}
                              />
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">App Secret</Label>
                              <Input
                                disabled
                                placeholder="จะเปิดใช้งานเมื่อได้รับ credentials"
                                className="h-8 text-sm"
                                data-testid={`input-app-secret-${op.value}`}
                              />
                            </div>
                          </div>

                          <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg border border-blue-100">
                            <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                            <p className="text-xs text-blue-700">ระบบพร้อมรองรับ API เมื่อได้รับ credentials จากแพลตฟอร์ม</p>
                          </div>

                          <Button variant="outline" className="w-full" disabled data-testid={`button-connect-${op.value}`}>
                            <Link2 className="h-4 w-4 mr-1" />
                            เชื่อมต่อ
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        <div>
          <h2 className="text-lg font-semibold text-gray-700 mb-3" data-testid="text-sync-logs-header">ประวัติการซิงค์</h2>
          <Card className="rounded-xl shadow-sm border">
            <CardContent className="p-0">
              {logsLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : syncLogs.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground" data-testid="text-sync-logs-empty">
                  <RefreshCw className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
                  <p className="text-sm">ยังไม่มีประวัติการซิงค์</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="text-xs">
                        <TableHead className="text-xs">วันที่</TableHead>
                        <TableHead className="text-xs">แพลตฟอร์ม</TableHead>
                        <TableHead className="text-xs">ประเภท</TableHead>
                        <TableHead className="text-xs text-center">สถานะ</TableHead>
                        <TableHead className="text-xs text-right">รายการทั้งหมด</TableHead>
                        <TableHead className="text-xs text-right">ใหม่</TableHead>
                        <TableHead className="text-xs text-right">อัปเดต</TableHead>
                        <TableHead className="text-xs text-right">ข้อผิดพลาด</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {syncLogs.map(log => (
                        <TableRow key={log.id} data-testid={`row-sync-log-${log.id}`}>
                          <TableCell className="text-xs" data-testid={`text-log-date-${log.id}`}>{formatDateTime(log.startedAt as string, dateEra, dateFmt)}</TableCell>
                          <TableCell>{platformBadge(log.platform)}</TableCell>
                          <TableCell className="text-xs" data-testid={`text-log-type-${log.id}`}>
                            {log.syncType === "orders" ? "ออเดอร์" : log.syncType === "products" ? "สินค้า" : log.syncType === "stock" ? "สต๊อก" : log.syncType}
                          </TableCell>
                          <TableCell className="text-center" data-testid={`badge-log-status-${log.id}`}>
                            {log.status === "running" ? (
                              <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />กำลังซิงค์
                              </Badge>
                            ) : log.status === "completed" ? (
                              <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                                <CheckCircle2 className="h-3 w-3 mr-1" />สำเร็จ
                              </Badge>
                            ) : (
                              <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
                                <XCircle className="h-3 w-3 mr-1" />ผิดพลาด
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-right" data-testid={`text-log-total-${log.id}`}>{log.totalRecords ?? 0}</TableCell>
                          <TableCell className="text-xs text-right text-green-600" data-testid={`text-log-new-${log.id}`}>{log.newRecords ?? 0}</TableCell>
                          <TableCell className="text-xs text-right text-blue-600" data-testid={`text-log-updated-${log.id}`}>{log.updatedRecords ?? 0}</TableCell>
                          <TableCell className="text-xs text-right text-red-600" data-testid={`text-log-errors-${log.id}`}>{log.errorCount ?? 0}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
          <DialogContent className="max-w-md" data-testid="dialog-sync-settings">
            <DialogHeader>
              <DialogTitle>ตั้งค่าการซิงค์อัตโนมัติ</DialogTitle>
            </DialogHeader>
            <div className="space-y-5 pt-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">เปิดซิงค์อัตโนมัติ</Label>
                <Switch
                  checked={autoSync}
                  onCheckedChange={setAutoSync}
                  data-testid="switch-auto-sync"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm text-muted-foreground">ช่วงเวลาซิงค์</Label>
                <Select value={syncInterval} onValueChange={setSyncInterval} disabled={!autoSync}>
                  <SelectTrigger className="h-9" data-testid="select-sync-interval">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SYNC_INTERVALS.map(i => (
                      <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">ประเภทข้อมูลที่ซิงค์</Label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="sync-orders"
                      checked={syncTypes.includes("orders")}
                      onCheckedChange={() => toggleSyncType("orders")}
                      data-testid="checkbox-sync-orders"
                    />
                    <label htmlFor="sync-orders" className="text-sm flex items-center gap-1.5 cursor-pointer">
                      <ShoppingCart className="h-3.5 w-3.5 text-muted-foreground" />
                      ออเดอร์ (Orders)
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="sync-products"
                      checked={syncTypes.includes("products")}
                      onCheckedChange={() => toggleSyncType("products")}
                      data-testid="checkbox-sync-products"
                    />
                    <label htmlFor="sync-products" className="text-sm flex items-center gap-1.5 cursor-pointer">
                      <Package className="h-3.5 w-3.5 text-muted-foreground" />
                      สินค้า (Products)
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="sync-stock"
                      checked={syncTypes.includes("stock")}
                      onCheckedChange={() => toggleSyncType("stock")}
                      data-testid="checkbox-sync-stock"
                    />
                    <label htmlFor="sync-stock" className="text-sm flex items-center gap-1.5 cursor-pointer">
                      <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                      สต๊อก (Stock)
                    </label>
                  </div>
                </div>
              </div>

              <Button
                className="w-full"
                onClick={handleSaveSettings}
                disabled={saveSyncSettingsMutation.isPending}
                data-testid="button-save-sync-settings"
              >
                {saveSyncSettingsMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : null}
                บันทึกการตั้งค่า
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </EcommerceLayout>
  );
}
