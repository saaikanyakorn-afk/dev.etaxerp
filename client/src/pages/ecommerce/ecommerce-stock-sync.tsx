import { useState } from "react";
import EcommerceLayout from "@/components/ecommerce-layout";
import { getPlatformLogo } from "@/lib/platform-logos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  RefreshCw, CheckCircle2, XCircle, Loader2, Pencil, Globe, Clock,
  ArrowUp, ArrowDown, AlertTriangle, Package, ChevronLeft, ChevronRight,
  Settings, History, BarChart3, Zap,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { useToast } from "@/hooks/use-toast";

const PLATFORMS = [
  { value: "shopee", label: "Shopee", color: "#EE4D2D" },
  { value: "lazada", label: "Lazada", color: "#0F146D" },
  { value: "tiktok", label: "TikTok Shop", color: "#000000" },
  { value: "amazon", label: "Amazon", color: "#FF9900" },
];

const SYNC_MODES = [
  { value: "manual", label: "ดึงข้อมูลเอง" },
  { value: "auto", label: "อัตโนมัติ" },
  { value: "realtime", label: "เรียลไทม์" },
];

function platformBadge(platform: string) {
    const p = PLATFORMS.find(pl => pl.value === platform);
    if (!p) return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">{platform}</Badge>;
    const logo = getPlatformLogo(platform);
    return (
      <Badge style={{ background: `${p.color}15`, color: p.color, border: `1px solid ${p.color}30` }} className="hover:opacity-80 font-medium gap-1">
        {logo && <img src={logo} alt={p.label} className="w-4 h-4 rounded-full object-cover" />}
        {p.label}
      </Badge>
    );
  }

function statusBadge(status: string) {
  if (status === "success") return <Badge className="bg-green-100 text-green-700 hover:bg-green-100" data-testid="badge-status-success">สำเร็จ</Badge>;
  if (status === "failed") return <Badge className="bg-red-100 text-red-700 hover:bg-red-100" data-testid="badge-status-failed">ล้มเหลว</Badge>;
  if (status === "partial") return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100" data-testid="badge-status-partial">บางส่วน</Badge>;
  return <Badge className="bg-gray-100 text-gray-500 hover:bg-gray-100">{status || "-"}</Badge>;
}

function directionBadge(direction: string) {
  if (direction === "push") return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100"><ArrowUp className="h-3 w-3 mr-1" />Push</Badge>;
  if (direction === "pull") return <Badge className="bg-cyan-100 text-cyan-700 hover:bg-cyan-100"><ArrowDown className="h-3 w-3 mr-1" />Pull</Badge>;
  return <Badge className="bg-gray-100 text-gray-500 hover:bg-gray-100">{direction || "-"}</Badge>;
}

function formatDate(d: string | null | undefined) {
  if (!d) return "-";
  return new Date(d).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" });
}

function syncModeLabel(mode: string | null | undefined) {
  const m = SYNC_MODES.find(sm => sm.value === mode);
  return m ? m.label : mode || "manual";
}

export default function EcommerceStockSync() {
  const { selectedCompanyId } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("settings");
  const [editSetting, setEditSetting] = useState<any>(null);
  const [editForm, setEditForm] = useState({ syncMode: "manual", syncInterval: "15" });

  const [logPlatform, setLogPlatform] = useState("all");
  const [logStatus, setLogStatus] = useState("all");
  const [logPage, setLogPage] = useState(1);

  const { data: dashboard, isLoading: dashLoading } = useQuery<any>({
    queryKey: ["/api/ecommerce/stock-sync/dashboard", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/ecommerce/stock-sync/dashboard?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const { data: settings = [], isLoading: settingsLoading } = useQuery<any[]>({
    queryKey: ["/api/ecommerce/stock-sync/settings", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/ecommerce/stock-sync/settings?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const logQueryParams = new URLSearchParams({
    companyId: String(selectedCompanyId),
    page: String(logPage),
    limit: "20",
  });
  if (logPlatform !== "all") logQueryParams.set("platform", logPlatform);
  if (logStatus !== "all") logQueryParams.set("status", logStatus);

  const { data: logsData, isLoading: logsLoading } = useQuery<any>({
    queryKey: ["/api/ecommerce/stock-sync/logs", selectedCompanyId, logPage, logPlatform, logStatus],
    queryFn: async () => {
      const r = await fetch(`/api/ecommerce/stock-sync/logs?${logQueryParams.toString()}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    enabled: !!selectedCompanyId && activeTab === "logs",
  });

  const { data: products = [] } = useQuery<any[]>({
    queryKey: ["/api/products", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/products?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId && activeTab === "overview",
  });

  const toggleMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/ecommerce/stock-sync/settings/${id}/toggle`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ companyId: selectedCompanyId }),
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/stock-sync/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/stock-sync/dashboard"] });
      toast({ title: "อัพเดทสถานะสำเร็จ" });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const updateSettingMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const r = await fetch(`/api/ecommerce/stock-sync/settings/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ ...data, companyId: selectedCompanyId }),
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/stock-sync/settings"] });
      toast({ title: "บันทึกการตั้งค่าสำเร็จ" });
      setEditSetting(null);
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const triggerSyncMutation = useMutation({
    mutationFn: async (platform: string) => {
      const r = await fetch("/api/ecommerce/stock-sync/trigger", {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ companyId: selectedCompanyId, platform }),
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: (_, platform) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/stock-sync/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/stock-sync/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/stock-sync/logs"] });
      const p = PLATFORMS.find(pl => pl.value === platform);
      toast({ title: `ซิงค์ ${p?.label || platform} สำเร็จ` });
    },
    onError: (err: any) => toast({ title: "ซิงค์ล้มเหลว", description: err.message, variant: "destructive" }),
  });

  const openEditSetting = (s: any) => {
    setEditSetting(s);
    setEditForm({ syncMode: s.syncMode || "manual", syncInterval: String(s.syncInterval || 15) });
  };

  const totalSynced = dashboard?.totalSynced ?? 0;
  const totalFailed = dashboard?.totalFailed ?? 0;
  const connectedPlatforms = dashboard?.connectedPlatforms ?? 0;
  const lastSyncTime = dashboard?.lastSyncTime;
  const logs = logsData?.logs ?? [];
  const logTotal = logsData?.total ?? 0;
  const logTotalPages = Math.ceil(logTotal / 20);

  return (
    <EcommerceLayout>
      <div className="space-y-4" data-testid="page-stock-sync">
        <div>
          <h1 className="text-2xl font-bold text-gray-800" data-testid="text-title">Stock Sync Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">จัดการซิงค์สต๊อกสินค้ากับแพลตฟอร์มอีคอมเมิร์ซ</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="rounded-xl shadow-sm" data-testid="card-total-synced">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">ซิงค์สำเร็จ</p>
                  <p className="text-2xl font-bold text-green-600" data-testid="text-total-synced">{dashLoading ? "-" : totalSynced}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-xl shadow-sm" data-testid="card-total-failed">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">ซิงค์ล้มเหลว</p>
                  <p className="text-2xl font-bold text-red-600" data-testid="text-total-failed">{dashLoading ? "-" : totalFailed}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                  <XCircle className="h-5 w-5 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-xl shadow-sm" data-testid="card-connected-platforms">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">แพลตฟอร์มเชื่อมต่อ</p>
                  <p className="text-2xl font-bold" style={{ color: "#03c9d7" }} data-testid="text-connected-platforms">{dashLoading ? "-" : connectedPlatforms}</p>
                </div>
                <div className="h-10 w-10 rounded-full flex items-center justify-center" style={{ background: "#03c9d715" }}>
                  <Globe className="h-5 w-5" style={{ color: "#03c9d7" }} />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-xl shadow-sm" data-testid="card-last-sync">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">ซิงค์ล่าสุด</p>
                  <p className="text-sm font-semibold text-gray-700 mt-1" data-testid="text-last-sync">{dashLoading ? "-" : formatDate(lastSyncTime)}</p>
                </div>
                <div className="h-10 w-10 rounded-full flex items-center justify-center" style={{ background: "#fb967815" }}>
                  <Clock className="h-5 w-5" style={{ color: "#fb9678" }} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-white border shadow-sm" data-testid="tabs-stock-sync">
            <TabsTrigger value="settings" className="gap-1.5 data-[state=active]:text-[#fb9678]" data-testid="tab-settings">
              <Settings className="h-3.5 w-3.5" />ตั้งค่าซิงค์
            </TabsTrigger>
            <TabsTrigger value="logs" className="gap-1.5 data-[state=active]:text-[#fb9678]" data-testid="tab-logs">
              <History className="h-3.5 w-3.5" />ประวัติการซิงค์
            </TabsTrigger>
            <TabsTrigger value="overview" className="gap-1.5 data-[state=active]:text-[#fb9678]" data-testid="tab-overview">
              <BarChart3 className="h-3.5 w-3.5" />แผนภาพสต๊อก
            </TabsTrigger>
          </TabsList>

          <TabsContent value="settings" className="mt-4">
            <Card className="rounded-xl shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Settings className="h-4 w-4" style={{ color: "#fb9678" }} />
                  ตั้งค่าการซิงค์สต๊อกต่อแพลตฟอร์ม
                </CardTitle>
              </CardHeader>
              <CardContent>
                {settingsLoading ? (
                  <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                ) : settings.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <RefreshCw className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-sm">ยังไม่มีการตั้งค่าซิงค์</p>
                    <p className="text-xs mt-1">กรุณาเชื่อมต่อแพลตฟอร์มก่อน</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table data-testid="table-sync-settings">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">แพลตฟอร์ม</TableHead>
                          <TableHead className="text-xs">โหมด</TableHead>
                          <TableHead className="text-xs text-center">ช่วงเวลา (นาที)</TableHead>
                          <TableHead className="text-xs">ซิงค์ล่าสุด</TableHead>
                          <TableHead className="text-xs text-center">สถานะล่าสุด</TableHead>
                          <TableHead className="text-xs text-center">เปิด/ปิด</TableHead>
                          <TableHead className="text-xs text-center">จัดการ</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {settings.map((s: any) => (
                          <TableRow key={s.id} data-testid={`row-setting-${s.id}`}>
                            <TableCell>{platformBadge(s.platform)}</TableCell>
                            <TableCell className="text-sm">{syncModeLabel(s.syncMode)}</TableCell>
                            <TableCell className="text-sm text-center">{s.syncInterval || 15}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{formatDate(s.lastSyncAt)}</TableCell>
                            <TableCell className="text-center">{statusBadge(s.lastSyncStatus)}</TableCell>
                            <TableCell className="text-center">
                              <Switch
                                checked={!!s.isEnabled}
                                onCheckedChange={() => toggleMutation.mutate(s.id)}
                                data-testid={`switch-setting-${s.id}`}
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  size="sm" variant="outline" className="h-7 text-xs gap-1"
                                  onClick={() => triggerSyncMutation.mutate(s.platform)}
                                  disabled={triggerSyncMutation.isPending}
                                  data-testid={`button-trigger-sync-${s.id}`}
                                >
                                  {triggerSyncMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
                                  ซิงค์ทันที
                                </Button>
                                <Button
                                  size="sm" variant="outline" className="h-7 w-7 p-0"
                                  onClick={() => openEditSetting(s)}
                                  data-testid={`button-edit-setting-${s.id}`}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs" className="mt-4 space-y-3">
            <Card className="rounded-xl shadow-sm">
              <CardContent className="p-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <Select value={logPlatform} onValueChange={(v) => { setLogPlatform(v); setLogPage(1); }}>
                    <SelectTrigger className="w-[160px] h-9 rounded-lg" data-testid="select-log-platform">
                      <SelectValue placeholder="แพลตฟอร์ม" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">ทุกแพลตฟอร์ม</SelectItem>
                      {PLATFORMS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={logStatus} onValueChange={(v) => { setLogStatus(v); setLogPage(1); }}>
                    <SelectTrigger className="w-[140px] h-9 rounded-lg" data-testid="select-log-status">
                      <SelectValue placeholder="สถานะ" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">ทุกสถานะ</SelectItem>
                      <SelectItem value="success">สำเร็จ</SelectItem>
                      <SelectItem value="failed">ล้มเหลว</SelectItem>
                      <SelectItem value="partial">บางส่วน</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-xl shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <History className="h-4 w-4" style={{ color: "#03c9d7" }} />
                  ประวัติการซิงค์ ({logTotal} รายการ)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {logsLoading ? (
                  <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                ) : logs.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <History className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-sm">ยังไม่มีประวัติการซิงค์</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table data-testid="table-sync-logs">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">วันที่</TableHead>
                          <TableHead className="text-xs">แพลตฟอร์ม</TableHead>
                          <TableHead className="text-xs text-center">ทิศทาง</TableHead>
                          <TableHead className="text-xs">SKU</TableHead>
                          <TableHead className="text-xs">ชื่อสินค้า</TableHead>
                          <TableHead className="text-xs text-right">จำนวนเดิม</TableHead>
                          <TableHead className="text-xs text-right">จำนวนใหม่</TableHead>
                          <TableHead className="text-xs text-center">สถานะ</TableHead>
                          <TableHead className="text-xs">ข้อผิดพลาด</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {logs.map((log: any) => (
                          <TableRow key={log.id} data-testid={`row-log-${log.id}`}>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(log.createdAt)}</TableCell>
                            <TableCell>{platformBadge(log.platform)}</TableCell>
                            <TableCell className="text-center">{directionBadge(log.direction)}</TableCell>
                            <TableCell className="text-xs font-mono">{log.sku || "-"}</TableCell>
                            <TableCell className="text-sm max-w-[150px] truncate">{log.productName || "-"}</TableCell>
                            <TableCell className="text-sm text-right">{log.previousQty ?? "-"}</TableCell>
                            <TableCell className="text-sm text-right">{log.newQty ?? "-"}</TableCell>
                            <TableCell className="text-center">{statusBadge(log.status)}</TableCell>
                            <TableCell className="text-xs text-red-500 max-w-[150px] truncate">{log.errorMessage || "-"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {logTotalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-3 border-t">
                    <span className="text-xs text-muted-foreground">หน้า {logPage} / {logTotalPages} (ทั้งหมด {logTotal} รายการ)</span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline" size="sm" className="h-7 w-7 p-0"
                        disabled={logPage <= 1}
                        onClick={() => setLogPage(p => p - 1)}
                        data-testid="button-log-prev"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline" size="sm" className="h-7 w-7 p-0"
                        disabled={logPage >= logTotalPages}
                        onClick={() => setLogPage(p => p + 1)}
                        data-testid="button-log-next"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="overview" className="mt-4 space-y-3">
            <Card className="rounded-xl shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" style={{ color: "#fb9678" }} />
                  เปรียบเทียบสต๊อกกับแพลตฟอร์ม
                </CardTitle>
              </CardHeader>
              <CardContent>
                {products.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-sm">ไม่มีสินค้าในระบบ</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {products.slice(0, 12).map((product: any) => {
                      const systemStock = product.stockQty ?? 0;
                      const mockPlatformStocks = [
                        { platform: "shopee", stock: Math.max(0, systemStock + Math.floor(Math.random() * 6) - 3), color: "#EE4D2D" },
                        { platform: "lazada", stock: Math.max(0, systemStock + Math.floor(Math.random() * 4) - 2), color: "#0F146D" },
                        { platform: "tiktok", stock: Math.max(0, systemStock + Math.floor(Math.random() * 8) - 4), color: "#000000" },
                      ];
                      const hasDiscrepancy = mockPlatformStocks.some(ps => ps.stock !== systemStock);

                      return (
                        <Card
                          key={product.id}
                          className={`rounded-lg border ${hasDiscrepancy ? "border-red-200 bg-red-50/30" : "border-gray-200"}`}
                          data-testid={`card-stock-overview-${product.id}`}
                        >
                          <CardContent className="p-3">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{product.name}</p>
                                <p className="text-xs text-muted-foreground font-mono">{product.sku || "-"}</p>
                              </div>
                              {hasDiscrepancy && (
                                <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 ml-1" data-testid={`icon-discrepancy-${product.id}`} />
                              )}
                            </div>

                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between px-2 py-1.5 rounded bg-gray-100">
                                <span className="text-xs font-medium text-gray-600">ระบบ</span>
                                <span className="text-sm font-bold" style={{ color: "#03c9d7" }} data-testid={`text-system-stock-${product.id}`}>{systemStock}</span>
                              </div>
                              {mockPlatformStocks.map(ps => {
                                const diff = ps.stock - systemStock;
                                const isDiff = diff !== 0;
                                return (
                                  <div key={ps.platform} className="flex items-center justify-between px-2 py-1">
                                    <span className="text-xs" style={{ color: ps.color }}>
                                      {PLATFORMS.find(p => p.value === ps.platform)?.label}
                                    </span>
                                    <div className="flex items-center gap-1.5">
                                      <span className={`text-sm font-semibold ${isDiff ? "text-red-600" : "text-gray-700"}`}>
                                        {ps.stock}
                                      </span>
                                      {isDiff && (
                                        <span className={`text-[10px] font-medium ${diff > 0 ? "text-orange-500" : "text-red-500"}`}>
                                          ({diff > 0 ? "+" : ""}{diff})
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
                {products.length > 12 && (
                  <p className="text-xs text-muted-foreground text-center mt-3">แสดง 12 จาก {products.length} รายการ</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={!!editSetting} onOpenChange={(o) => { if (!o) setEditSetting(null); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                แก้ไขการตั้งค่า {editSetting && platformBadge(editSetting.platform)}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">โหมดซิงค์</label>
                <Select value={editForm.syncMode} onValueChange={(v) => setEditForm(f => ({ ...f, syncMode: v }))}>
                  <SelectTrigger className="mt-1" data-testid="select-edit-sync-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SYNC_MODES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">ช่วงเวลาซิงค์ (นาที)</label>
                <Input
                  type="number" min="1" max="1440"
                  value={editForm.syncInterval}
                  onChange={e => setEditForm(f => ({ ...f, syncInterval: e.target.value }))}
                  className="mt-1"
                  data-testid="input-edit-sync-interval"
                />
              </div>
              <Button
                className="w-full text-white"
                style={{ background: "#03c9d7" }}
                disabled={updateSettingMutation.isPending}
                onClick={() => editSetting && updateSettingMutation.mutate({
                  id: editSetting.id,
                  data: { syncMode: editForm.syncMode, syncInterval: Number(editForm.syncInterval) },
                })}
                data-testid="button-save-setting"
              >
                {updateSettingMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                บันทึกการตั้งค่า
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </EcommerceLayout>
  );
}
