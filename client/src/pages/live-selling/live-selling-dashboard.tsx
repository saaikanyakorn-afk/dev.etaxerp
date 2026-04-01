import { useState, useMemo } from "react";
import EcommerceLayout from "@/components/ecommerce-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Radio, Plus, Pencil, Play, Square, ShoppingCart, Package, Users, MessageSquare, TrendingUp, DollarSign, BarChart3, PieChart, Search, Loader2, ArrowLeft, Clock } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { useToast } from "@/hooks/use-toast";
import { formatDateTime } from "@/lib/format";
import { PieChart as RPieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar } from "recharts";
import type { Product } from "@shared/schema";
import { Link } from "wouter";

const PLATFORMS = [
  { value: "facebook", label: "Facebook", color: "#1877F2" },
  { value: "tiktok", label: "TikTok", color: "#000000" },
  { value: "instagram", label: "Instagram", color: "#E4405F" },
  { value: "other", label: "อื่นๆ", color: "#666" },
];

const PAYMENT_COLORS: Record<string, string> = {
  bank_transfer: "var(--theme-primary)",
  promptpay: "#05b187",
  cod: "#fb9678",
  qr: "#fec90f",
  credit_card: "#f94d4d",
  other: "#999",
};

const PAYMENT_LABELS: Record<string, string> = {
  bank_transfer: "โอนธนาคาร",
  promptpay: "พร้อมเพย์",
  cod: "COD",
  qr: "QR Code",
  credit_card: "บัตรเครดิต",
  other: "อื่นๆ",
};

function formatCurrency(v: number | string | null | undefined) {
  return Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  draft: { label: "แบบร่าง", cls: "bg-gray-100 text-gray-700" },
  live: { label: "🔴 กำลังไลฟ์", cls: "bg-red-100 text-red-600 animate-pulse" },
  ended: { label: "จบแล้ว", cls: "bg-green-100 text-green-700" },
};

export default function LiveSellingDashboard() {
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"current" | "orders">("current");
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [selectedProductIds, setSelectedProductIds] = useState<Set<number>>(new Set());

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery<any[]>({
    queryKey: ["/api/live/sessions", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/live/sessions?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const { data: stats, isLoading: statsLoading } = useQuery<any>({
    queryKey: ["/api/live/sessions", selectedSessionId, "stats"],
    queryFn: async () => {
      const r = await fetch(`/api/live/sessions/${selectedSessionId}/stats`, { credentials: "include" });
      if (!r.ok) return null;
      return r.json();
    },
    enabled: !!selectedSessionId,
  });

  const { data: sessionProducts = [] } = useQuery<any[]>({
    queryKey: ["/api/live/sessions", selectedSessionId, "products"],
    queryFn: async () => {
      const r = await fetch(`/api/live/sessions/${selectedSessionId}/products`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedSessionId,
  });

  const { data: allProducts = [] } = useQuery<Product[]>({
    queryKey: ["/api/products", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/products?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId && showProductPicker,
  });

  const bulkAddProducts = useMutation({
    mutationFn: async (productIds: number[]) => {
      const r = await fetch(`/api/live/sessions/${selectedSessionId}/products/bulk`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ productIds }),
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/live/sessions", selectedSessionId, "products"] });
      toast({ title: result.message });
      setShowProductPicker(false);
      setSelectedProductIds(new Set());
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const filteredPickerProducts = useMemo(() => {
    if (!productSearch.trim()) return allProducts;
    const q = productSearch.toLowerCase();
    return allProducts.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.code || "").toLowerCase().includes(q) ||
      (p.barcode || "").toLowerCase().includes(q)
    );
  }, [allProducts, productSearch]);

  const paymentChartData = useMemo(() => {
    if (!stats?.paymentChannels) return [];
    return Object.entries(stats.paymentChannels).map(([method, data]: [string, any]) => ({
      name: PAYMENT_LABELS[method] || method,
      value: data.amount,
      count: data.count,
      color: PAYMENT_COLORS[method] || "#999",
    }));
  }, [stats]);

  const orderTimeData = useMemo(() => {
    if (!stats?.ordersByHour) return [];
    return Object.entries(stats.ordersByHour)
      .map(([time, count]) => ({ time, count: count as number }))
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [stats]);

  const selectedSession = sessions.find((s: any) => s.id === selectedSessionId);

  return (
    <EcommerceLayout>
      <div className="flex h-[calc(100vh-120px)]" data-testid="page-live-dashboard">
        {/* Left Sidebar - Session List */}
        <div className="w-[280px] border-r bg-white flex flex-col shrink-0">
          <div className="p-3 border-b">
            <div className="flex items-center gap-2 mb-2">
              <Link href="/ecommerce/live-selling">
                <Button variant="ghost" size="sm" className="gap-1 text-xs h-7 px-2" data-testid="button-back-to-hub">
                  <ArrowLeft className="h-3.5 w-3.5" />จัดการ
                </Button>
              </Link>
            </div>
            <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2" data-testid="text-sidebar-title">
              <Radio className="h-4 w-4 text-[#03c9d7]" />ไลฟ์สด
            </h2>
            <p className="text-xs text-muted-foreground">เชื่อมต่อกับระบบ Facebook/ IG</p>
          </div>

          <div className="flex-1 overflow-y-auto">
            {sessionsLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-8 text-xs text-muted-foreground">
                <Radio className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                <p>ยังไม่มีเซสชันไลฟ์</p>
                <Link href="/ecommerce/live-selling">
                  <Button size="sm" className="mt-2 bg-[#03c9d7] hover:bg-[#02b4c1] text-white text-xs gap-1" data-testid="button-create-session">
                    <Plus className="h-3.5 w-3.5" />สร้างไลฟ์ใหม่
                  </Button>
                </Link>
              </div>
            ) : (
              sessions.map((session: any) => {
                const isSelected = selectedSessionId === session.id;
                const st = STATUS_MAP[session.status] || STATUS_MAP.draft;
                return (
                  <div
                    key={session.id}
                    onClick={() => setSelectedSessionId(session.id)}
                    className={`px-3 py-3 border-b cursor-pointer transition-colors ${isSelected ? "bg-[#e5f9fa] border-l-4 border-l-[#03c9d7]" : "hover:bg-gray-50"}`}
                    data-testid={`session-item-${session.id}`}
                  >
                    <div className="flex items-center gap-2">
                      {session.status === "live" && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />}
                      <span className="text-sm font-medium truncate">{session.title}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className={`${st.cls} text-[10px] px-1.5 py-0`}>{st.label}</Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {session.startedAt ? formatDateTime(session.startedAt, "CE", "DD/MM/YYYY") : formatDateTime(session.createdAt, "CE", "DD/MM/YYYY")}
                      </span>
                    </div>
                    {session.hostName && (
                      <div className="text-[10px] text-muted-foreground mt-0.5">By {session.hostName}</div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto bg-gray-50 p-4">
          {!selectedSessionId ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <Radio className="h-16 w-16 mx-auto mb-4 text-muted-foreground/20" />
                <p className="text-lg font-medium" data-testid="text-select-session">เลือกเซสชันไลฟ์จากรายการด้านซ้าย</p>
                <p className="text-sm mt-1">หรือสร้างเซสชันใหม่เพื่อเริ่มขาย</p>
              </div>
            </div>
          ) : statsLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="space-y-4">
              {/* Header with session info + tabs */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-bold text-gray-800" data-testid="text-session-title">{selectedSession?.title}</h2>
                  {selectedSession && (
                    <Badge className={`${(STATUS_MAP[selectedSession.status] || STATUS_MAP.draft).cls} hover:${(STATUS_MAP[selectedSession.status] || STATUS_MAP.draft).cls}`}>
                      {(STATUS_MAP[selectedSession.status] || STATUS_MAP.draft).label}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  <span data-testid="text-session-time">
                    {selectedSession?.startedAt ? formatDateTime(selectedSession.startedAt, "CE", "DD/MM/YYYY") : "-"}
                  </span>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 border-b bg-white rounded-t-xl px-1" data-testid="dashboard-tabs">
                <button
                  onClick={() => setActiveTab("current")}
                  className={`px-6 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${activeTab === "current" ? "border-[#03c9d7] text-[#03c9d7] bg-[#e5f9fa]" : "border-transparent text-gray-500 hover:text-gray-700"}`}
                  data-testid="tab-current"
                >
                  ไลฟ์ครอบนี้
                </button>
                <button
                  onClick={() => setActiveTab("orders")}
                  className={`px-6 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${activeTab === "orders" ? "border-[#03c9d7] text-[#03c9d7] bg-[#e5f9fa]" : "border-transparent text-gray-500 hover:text-gray-700"}`}
                  data-testid="tab-orders"
                >
                  การสั่งคำสั่งซื้อ
                </button>
              </div>

              {/* Tab Content */}
              {activeTab === "current" ? (
                <CurrentSessionTab stats={stats} orderTimeData={orderTimeData} />
              ) : (
                <OrdersTab
                  stats={stats}
                  paymentChartData={paymentChartData}
                  orderTimeData={orderTimeData}
                />
              )}

              {/* Session Products */}
              <Card className="rounded-xl shadow-sm border">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-gray-800" data-testid="text-products-title">สินค้าในไลฟ์ ({sessionProducts.length})</h3>
                    <Button size="sm" className="bg-[#03c9d7] hover:bg-[#02b4c1] text-white text-xs gap-1" onClick={() => setShowProductPicker(true)} data-testid="button-add-products">
                      <Plus className="h-3.5 w-3.5" />เพิ่มสินค้า
                    </Button>
                  </div>
                  {sessionProducts.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      <Package className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                      ยังไม่มีสินค้าในเซสชันนี้
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table data-testid="table-session-products">
                        <TableHeader>
                          <TableRow className="text-xs bg-gray-50">
                            <TableHead className="text-xs w-10">#</TableHead>
                            <TableHead className="text-xs">รหัสสินค้า</TableHead>
                            <TableHead className="text-xs">บาร์โค้ด</TableHead>
                            <TableHead className="text-xs min-w-[200px]">ชื่อ</TableHead>
                            <TableHead className="text-xs">หมวดหมู่</TableHead>
                            <TableHead className="text-xs text-right">ราคาขาย</TableHead>
                            <TableHead className="text-xs text-right">จำนวน</TableHead>
                            <TableHead className="text-xs text-right">ขายแล้ว</TableHead>
                            <TableHead className="text-xs">CF Code</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sessionProducts.map((p: any, i: number) => (
                            <TableRow key={p.id} className="text-xs" data-testid={`row-product-${p.id}`}>
                              <TableCell className="text-xs">{i + 1}</TableCell>
                              <TableCell className="text-xs font-mono">{p.sku || "-"}</TableCell>
                              <TableCell className="text-xs font-mono">{p.barcode || "-"}</TableCell>
                              <TableCell className="text-xs font-medium">{p.name || "-"}</TableCell>
                              <TableCell className="text-xs">{p.category || "-"}</TableCell>
                              <TableCell className="text-xs text-right font-medium">฿{formatCurrency(p.livePrice)}</TableCell>
                              <TableCell className="text-xs text-right">{Number(p.availableQty || 0).toLocaleString()}</TableCell>
                              <TableCell className="text-xs text-right">{Number(p.soldQty || 0).toLocaleString()}</TableCell>
                              <TableCell className="text-xs">{p.cfCode || "-"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Product Picker Dialog */}
        <Dialog open={showProductPicker} onOpenChange={setShowProductPicker}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle data-testid="text-picker-title">เพิ่มสินค้า</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="ค้นหารหัสสินค้า, ชื่อสินค้า, บาร์โค้ด..."
                    value={productSearch}
                    onChange={e => setProductSearch(e.target.value)}
                    className="pl-8 h-8 text-xs"
                    data-testid="input-product-search"
                  />
                </div>
                <Button
                  size="sm"
                  className="bg-[#03c9d7] hover:bg-[#02b4c1] text-white text-xs"
                  disabled={selectedProductIds.size === 0 || bulkAddProducts.isPending}
                  onClick={() => bulkAddProducts.mutate(Array.from(selectedProductIds))}
                  data-testid="button-confirm-add-products"
                >
                  {bulkAddProducts.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                  ยืนยัน ({selectedProductIds.size})
                </Button>
              </div>
              <div className="overflow-x-auto max-h-[50vh]">
                <Table data-testid="table-product-picker">
                  <TableHeader>
                    <TableRow className="text-xs bg-gray-50">
                      <TableHead className="w-10 px-2">
                        <Checkbox
                          checked={filteredPickerProducts.length > 0 && filteredPickerProducts.every(p => selectedProductIds.has(p.id))}
                          onCheckedChange={(checked) => {
                            if (checked) setSelectedProductIds(new Set(filteredPickerProducts.map(p => p.id)));
                            else setSelectedProductIds(new Set());
                          }}
                        />
                      </TableHead>
                      <TableHead className="text-xs">รหัสสินค้า</TableHead>
                      <TableHead className="text-xs">บาร์โค้ด</TableHead>
                      <TableHead className="text-xs min-w-[200px]">ชื่อ</TableHead>
                      <TableHead className="text-xs">หมวดหมู่</TableHead>
                      <TableHead className="text-xs text-right">ราคาขาย</TableHead>
                      <TableHead className="text-xs text-right">จำนวน</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPickerProducts.slice(0, 200).map((p) => (
                      <TableRow key={p.id} className="text-xs" data-testid={`row-picker-${p.id}`}>
                        <TableCell className="px-2">
                          <Checkbox
                            checked={selectedProductIds.has(p.id)}
                            onCheckedChange={(checked) => {
                              setSelectedProductIds(prev => {
                                const next = new Set(prev);
                                if (checked) next.add(p.id); else next.delete(p.id);
                                return next;
                              });
                            }}
                          />
                        </TableCell>
                        <TableCell className="text-xs font-mono">{p.code || "-"}</TableCell>
                        <TableCell className="text-xs font-mono">{p.barcode || "-"}</TableCell>
                        <TableCell className="text-xs font-medium">{p.name}</TableCell>
                        <TableCell className="text-xs">{p.category || "-"}</TableCell>
                        <TableCell className="text-xs text-right">฿{formatCurrency(p.price)}</TableCell>
                        <TableCell className="text-xs text-right">-</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="text-xs text-muted-foreground">
                แสดง {Math.min(filteredPickerProducts.length, 200)} จาก {allProducts.length} รายการ
              </p>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </EcommerceLayout>
  );
}

function CurrentSessionTab({ stats, orderTimeData }: { stats: any; orderTimeData: any[] }) {
  if (!stats) return null;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" data-testid="tab-content-current">
      {/* Left - Main KPIs */}
      <div className="lg:col-span-2 space-y-4">
        <Card className="rounded-xl shadow-sm border">
          <CardContent className="p-5">
            <div className="text-3xl font-bold text-[#03c9d7]" data-testid="text-total-revenue">
              ฿ {formatCurrency(stats.totalRevenue)}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-5">
              <KpiItem icon={<ShoppingCart className="h-4 w-4 text-[var(--theme-primary)]" />} label="จำนวนคำสั่งซื้อ" value={stats.totalOrders} />
              <KpiItem icon={<Package className="h-4 w-4 text-[#05b187]" />} label="ประเภทSKUที่ขาย" value={stats.skuCount} />
              <KpiItem icon={<TrendingUp className="h-4 w-4 text-[#fb9678]" />} label="จำนวนสินค้าที่ขายทั้งหมด" value={stats.totalItemsSold?.toLocaleString()} />
              <KpiItem icon={<MessageSquare className="h-4 w-4 text-purple-500" />} label="ความคิดเห็นทั้งหมด" value={stats.totalComments?.toLocaleString()} />
              <KpiItem icon={<Users className="h-4 w-4 text-[#03c9d7]" />} label="จำนวนที่ดึงคำสั่งซื้อแล้ว" value={stats.pulledOrders?.toLocaleString()} />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl shadow-sm border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-600">จำนวนคำสั่งซื้อที่ชำระเงินแล้ว</span>
              <span className="text-lg font-bold text-[#03c9d7]" data-testid="text-paid-orders">{stats.paidOrders}</span>
            </div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-gray-600">ยอดเงินที่ชำระแล้ว</span>
              <span className="text-lg font-bold text-[#03c9d7]" data-testid="text-paid-revenue">฿{formatCurrency(stats.paidRevenue)}</span>
            </div>
            <Progress value={stats.paymentRate} className="h-2.5 mt-3" data-testid="progress-payment-rate" />
            <span className="text-xs text-muted-foreground mt-1 block text-right">{stats.paymentRate}%</span>
          </CardContent>
        </Card>
      </div>

      {/* Right - Comment Trend Chart */}
      <div className="space-y-4">
        <Card className="rounded-xl shadow-sm border">
          <CardContent className="p-4">
            <h3 className="text-xs font-bold text-gray-700 mb-3" data-testid="text-comment-trend-title">แนวโน้มความคิดเห็น</h3>
            {orderTimeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={orderTimeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="count" stroke="#03c9d7" strokeWidth={2} dot={{ r: 3 }} name="คำสั่งซื้อ" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-xs text-muted-foreground">ยังไม่มีข้อมูล</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function OrdersTab({ stats, paymentChartData, orderTimeData }: { stats: any; paymentChartData: any[]; orderTimeData: any[] }) {
  if (!stats) return null;
  const completionRate = stats.completionRate || 0;
  return (
    <div className="space-y-4" data-testid="tab-content-orders">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left - Donut + KPIs */}
        <div className="lg:col-span-2">
          <Card className="rounded-xl shadow-sm border">
            <CardContent className="p-5">
              <div className="flex items-start gap-8">
                {/* Donut chart */}
                <div className="shrink-0 relative" data-testid="chart-completion">
                  <ResponsiveContainer width={130} height={130}>
                    <RPieChart>
                      <Pie
                        data={[
                          { name: "ชำระแล้ว", value: completionRate },
                          { name: "ยังไม่ชำระ", value: 100 - completionRate },
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={60}
                        startAngle={90}
                        endAngle={-270}
                        dataKey="value"
                      >
                        <Cell fill="#fec90f" />
                        <Cell fill="#f0f0f0" />
                      </Pie>
                    </RPieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xl font-bold text-gray-800">{completionRate}%</span>
                  </div>
                </div>

                <div className="flex-1">
                  <div className="text-sm text-gray-500">ยอดขายรวม</div>
                  <div className="text-2xl font-bold text-[#05b187]" data-testid="text-order-total-revenue">฿ {formatCurrency(stats.totalRevenue)}</div>
                  <div className="text-sm text-gray-500 mt-1">CF</div>
                  <div className="text-lg font-bold text-gray-600" data-testid="text-cf-revenue">CF {formatCurrency(stats.cfRevenue)}</div>

                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <KpiRow label="จำนวนคำสั่งซื้อ" value={stats.totalOrders} />
                    <KpiRow label="จำนวนคำสั่งซื้อที่ชำระเงินแล้ว" value={stats.paidOrders} />
                    <KpiRow label="ประเภทSKUที่ขาย" value={stats.skuCount} />
                    <KpiRow label="จำนวนสินค้าที่ขายทั้งหมด" value={stats.totalItemsSold?.toLocaleString()} />
                  </div>
                </div>
              </div>

              {/* Progress bars */}
              <div className="mt-5 space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-600 w-[140px]">คำสั่งซื้อที่ชำระเงิน</span>
                  <div className="flex-1">
                    <Progress value={stats.paymentRate} className="h-4" />
                  </div>
                  <span className="text-xs font-medium text-gray-700 w-[40px] text-right">{stats.paymentRate}%</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-600 w-[140px]">การจัดส่งคำสั่งซื้อ</span>
                  <div className="flex-1">
                    <Progress value={stats.shippingRate} className="h-4" />
                  </div>
                  <span className="text-xs font-medium text-gray-700 w-[40px] text-right">{stats.shippingRate}%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right - Payment channels + Avg Price */}
        <div className="space-y-4">
          <Card className="rounded-xl shadow-sm border">
            <CardContent className="p-4">
              <h3 className="text-xs font-bold text-gray-700 mb-3" data-testid="text-payment-channels-title">วิเคราะห์ช่องทางชำระเงิน</h3>
              {paymentChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={160}>
                  <RPieChart>
                    <Pie
                      data={paymentChartData}
                      cx="50%"
                      cy="50%"
                      outerRadius={60}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {paymentChartData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val: number) => `฿${formatCurrency(val)}`} contentStyle={{ fontSize: 11 }} />
                  </RPieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[160px] text-xs text-muted-foreground">ยังไม่มีข้อมูล</div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-xl shadow-sm border">
            <CardContent className="p-4 text-center">
              <Users className="h-8 w-8 mx-auto text-[#03c9d7] mb-1" />
              <div className="text-2xl font-bold text-gray-800" data-testid="text-avg-order-value">
                {formatCurrency(stats.avgOrderValue)}
              </div>
              <div className="text-xs text-muted-foreground">ราคาเฉลี่ย/คำสั่งซื้อ</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Payment Timing Chart */}
      <Card className="rounded-xl shadow-sm border">
        <CardContent className="p-4">
          <h3 className="text-xs font-bold text-gray-700 mb-3" data-testid="text-timing-title">วิเคราะห์ระยะเวลาชำระเงิน</h3>
          {orderTimeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={orderTimeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Bar dataKey="count" fill="#03c9d7" radius={[4, 4, 0, 0]} name="คำสั่งซื้อ" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[200px] text-xs text-muted-foreground">ยังไม่มีข้อมูล</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="shrink-0">{icon}</div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-lg font-bold text-gray-800">{value}</div>
      </div>
    </div>
  );
}

function KpiRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 flex-1">{label}</span>
      <span className="text-sm font-bold text-gray-800">{value}</span>
    </div>
  );
}
