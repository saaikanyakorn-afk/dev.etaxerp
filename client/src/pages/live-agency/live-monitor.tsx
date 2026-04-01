import { useState, useEffect, useMemo } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users,
  ShoppingCart,
  DollarSign,
  TrendingUp,
  Eye,
  Zap,
  Target,
  Heart,
  MousePointerClick,
  Megaphone,
  BarChart3,
  Package,
  Clock,
  StopCircle,
  Loader2,
  CheckCircle,
  XCircle,
  Lightbulb,
  PlusCircle,
  ArrowUpRight,
} from "lucide-react";

const PLATFORMS: Record<string, { label: string; className: string }> = {
  facebook: { label: "Facebook", className: "bg-[#e5f9fa] text-[#03c9d7]" },
  tiktok: { label: "TikTok", className: "bg-pink-100 text-pink-700" },
  instagram: { label: "Instagram", className: "bg-purple-100 text-purple-700" },
  shopee: { label: "Shopee", className: "bg-orange-100 text-orange-700" },
  lazada: { label: "Lazada", className: "bg-blue-100 text-blue-700" },
  line: { label: "LINE", className: "bg-green-100 text-green-700" },
};

const AIDA_STAGES = [
  { key: "attention", label: "Attention", thLabel: "ดึงดูดความสนใจ", color: "var(--theme-primary)", icon: Megaphone },
  { key: "interest", label: "Interest", thLabel: "สร้างความสนใจ", color: "#fec90f", icon: Lightbulb },
  { key: "desire", label: "Desire", thLabel: "กระตุ้นความต้องการ", color: "#f94d4d", icon: Heart },
  { key: "action", label: "Action", thLabel: "กระตุ้นการซื้อ", color: "#05b187", icon: MousePointerClick },
];

function formatCurrency(v: number | string | null | undefined): string {
  return Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function useDurationTimer(startedAt: string | null | undefined, status: string | undefined) {
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    if (!startedAt || status !== "live") {
      if (startedAt && status === "ended") {
        const start = new Date(startedAt).getTime();
        const diff = Date.now() - start;
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        setElapsed(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
      }
      return;
    }

    const update = () => {
      const start = new Date(startedAt).getTime();
      const diff = Date.now() - start;
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setElapsed(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [startedAt, status]);

  return elapsed;
}

export default function LiveMonitor() {
  const [, params] = useRoute("/ecommerce/live-agency/monitor/:id");
  const sessionId = params?.id;
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();

  const { data: dashboard, isLoading } = useQuery<any>({
    queryKey: ["/api/live-agency/sessions", sessionId, "dashboard"],
    queryFn: async () => {
      const r = await apiRequest("GET", `/api/live-agency/sessions/${sessionId}/dashboard`);
      return r.json();
    },
    enabled: !!sessionId,
    refetchInterval: 10000,
  });

  const { data: aidaActions = [] } = useQuery<any[]>({
    queryKey: ["/api/live-agency/sessions", sessionId, "aida-actions"],
    queryFn: async () => {
      const r = await apiRequest("GET", `/api/live-agency/sessions/${sessionId}/aida-actions`);
      return r.json();
    },
    enabled: !!sessionId,
    refetchInterval: 10000,
  });

  const { data: adBudgets } = useQuery<any>({
    queryKey: ["/api/live-agency/sessions", sessionId, "ad-budgets"],
    queryFn: async () => {
      const r = await apiRequest("GET", `/api/live-agency/sessions/${sessionId}/ad-budgets`);
      return r.json();
    },
    enabled: !!sessionId,
    refetchInterval: 10000,
  });

  const updateAidaAction = useMutation({
    mutationFn: async ({ actionId, status }: { actionId: number; status: string }) => {
      const r = await apiRequest("PATCH", `/api/live-agency/sessions/${sessionId}/aida-actions/${actionId}`, { status });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/live-agency/sessions", sessionId, "aida-actions"] });
    },
  });

  const endSession = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("PATCH", `/api/live-agency/sessions/${sessionId}`, { status: "ended" });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/live-agency/sessions", sessionId, "dashboard"] });
    },
  });

  const session = dashboard?.session;
  const metrics = dashboard?.metrics || [];
  const orders = dashboard?.orders || [];
  const elapsed = useDurationTimer(session?.startedAt, session?.status);

  const topProducts = useMemo(() => {
    if (!dashboard?.topProducts && !dashboard?.products) return [];
    const products = dashboard?.topProducts || dashboard?.products || [];
    return [...products].sort((a: any, b: any) => (b.soldQty || 0) - (a.soldQty || 0)).slice(0, 5);
  }, [dashboard]);

  const revenueChartData = useMemo(() => {
    if (!metrics || metrics.length === 0) return [];
    return metrics.map((m: any, i: number) => ({
      label: m.time || m.label || `${i + 1}`,
      value: Number(m.revenue || m.value || 0),
    }));
  }, [metrics]);

  const maxRevenue = useMemo(() => {
    return Math.max(...revenueChartData.map((d: any) => d.value), 1);
  }, [revenueChartData]);

  const totalRevenue = session?.totalRevenue || dashboard?.totalRevenue || 0;
  const totalOrders = session?.totalOrders || dashboard?.totalOrders || 0;
  const currentViewers = session?.currentViewers || dashboard?.currentViewers || 0;
  const peakViewers = session?.peakViewers || dashboard?.peakViewers || 0;
  const adSpend = session?.adSpend || dashboard?.adSpend || 0;
  const goalRevenue = session?.goalRevenue || dashboard?.goalRevenue || 0;
  const conversionRate = currentViewers > 0 ? ((totalOrders / currentViewers) * 100).toFixed(1) : "0.0";
  const roas = adSpend > 0 ? (Number(totalRevenue) / Number(adSpend)).toFixed(2) : "-";
  const revenueProgress = goalRevenue > 0 ? Math.min((Number(totalRevenue) / Number(goalRevenue)) * 100, 100) : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50" data-testid="loading-monitor">
        <Loader2 className="h-10 w-10 animate-spin text-[#03c9d7]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100" data-testid="page-live-monitor">
      {/* Top Bar */}
      <div className="bg-[#1e293b] text-white px-6 py-3 flex items-center justify-between" data-testid="topbar">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold" data-testid="text-session-title">
            {session?.title || "Live Session"}
          </h1>
          {session?.platform && (
            <Badge className={PLATFORMS[session.platform]?.className || "bg-gray-100 text-gray-700"} data-testid="badge-platform">
              {PLATFORMS[session.platform]?.label || session.platform}
            </Badge>
          )}
          {session?.status === "live" && (
            <div className="flex items-center gap-1.5" data-testid="live-indicator">
              <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
              <span className="text-sm font-semibold text-red-400">LIVE</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-4">
          {elapsed && (
            <div className="flex items-center gap-2 text-gray-300" data-testid="duration-timer">
              <Clock className="h-4 w-4" />
              <span className="font-mono text-lg">{elapsed}</span>
            </div>
          )}
          <Button
            variant="destructive"
            size="sm"
            className="bg-[#f94d4d] hover:bg-red-600 gap-1"
            onClick={() => endSession.mutate()}
            disabled={endSession.isPending || session?.status === "ended"}
            data-testid="button-end-live"
          >
            <StopCircle className="h-4 w-4" />
            สิ้นสุดไลฟ์
          </Button>
        </div>
      </div>

      {/* Main Metrics Row */}
      <div className="px-6 py-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="metrics-row">
          <Card className="border-l-4 border-l-[var(--theme-primary)]" data-testid="card-viewers">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                <Eye className="h-4 w-4 text-[var(--theme-primary)]" />
                คนดูปัจจุบัน
              </div>
              <div className="text-3xl font-bold text-gray-800" data-testid="text-current-viewers">
                {Number(currentViewers).toLocaleString()}
              </div>
              <div className="text-xs text-gray-400 mt-1" data-testid="text-peak-viewers">
                สูงสุด: {Number(peakViewers).toLocaleString()} คน
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-[#fb9678]" data-testid="card-orders">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                <ShoppingCart className="h-4 w-4 text-[#fb9678]" />
                ออเดอร์
              </div>
              <div className="text-3xl font-bold text-gray-800" data-testid="text-total-orders">
                {Number(totalOrders).toLocaleString()}
              </div>
              <div className="text-xs text-gray-400 mt-1" data-testid="text-conversion-rate">
                Conversion: {conversionRate}%
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-[#05b187]" data-testid="card-revenue">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                <DollarSign className="h-4 w-4 text-[#05b187]" />
                ยอดขาย
              </div>
              <div className="text-3xl font-bold text-gray-800" data-testid="text-total-revenue">
                ฿{formatCurrency(totalRevenue)}
              </div>
              {goalRevenue > 0 && (
                <div className="mt-2" data-testid="revenue-goal-progress">
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>เป้าหมาย</span>
                    <span>฿{formatCurrency(goalRevenue)}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-[#05b187] h-2 rounded-full transition-all"
                      style={{ width: `${revenueProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-[#fec90f]" data-testid="card-ad-spend">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                <Megaphone className="h-4 w-4 text-[#fec90f]" />
                ค่าโฆษณา
              </div>
              <div className="text-3xl font-bold text-gray-800" data-testid="text-ad-spend">
                ฿{formatCurrency(adSpend)}
              </div>
              <div className="text-xs text-gray-400 mt-1" data-testid="text-roas">
                ROAS: {roas}x
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Three Column Layout */}
      <div className="px-6 pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Left Column - AIDA Funnel */}
          <div className="lg:col-span-1 space-y-3" data-testid="aida-panel">
            <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
              <Target className="h-4 w-4 text-[#fb9678]" />
              AIDA Funnel
            </h3>
            {AIDA_STAGES.map((stage) => {
              const StageIcon = stage.icon;
              const stageActions = aidaActions.filter((a: any) => a.stage === stage.key && a.status === "pending");
              return (
                <Card key={stage.key} className="border-t-2" style={{ borderTopColor: stage.color }} data-testid={`aida-stage-${stage.key}`}>
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <StageIcon className="h-4 w-4" style={{ color: stage.color }} />
                      <span className="text-xs font-bold" style={{ color: stage.color }}>
                        {stage.label}
                      </span>
                      <span className="text-[10px] text-gray-400">({stage.thLabel})</span>
                    </div>
                    {stageActions.length === 0 ? (
                      <p className="text-xs text-gray-400">ไม่มีคำแนะนำ</p>
                    ) : (
                      <div className="space-y-2">
                        {stageActions.map((action: any) => (
                          <div key={action.id} className="bg-gray-50 rounded-lg p-2" data-testid={`aida-action-${action.id}`}>
                            <p className="text-xs text-gray-700 mb-2">{action.suggestion || action.content}</p>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                className="h-6 text-[10px] px-2 gap-1"
                                style={{ backgroundColor: stage.color, color: "white" }}
                                onClick={() => updateAidaAction.mutate({ actionId: action.id, status: "applied" })}
                                disabled={updateAidaAction.isPending}
                                data-testid={`button-apply-${action.id}`}
                              >
                                <CheckCircle className="h-3 w-3" />
                                ใช้
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 text-[10px] px-2 gap-1"
                                onClick={() => updateAidaAction.mutate({ actionId: action.id, status: "skipped" })}
                                disabled={updateAidaAction.isPending}
                                data-testid={`button-skip-${action.id}`}
                              >
                                <XCircle className="h-3 w-3" />
                                ข้าม
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Middle Column - Live Feed */}
          <div className="lg:col-span-2 space-y-4" data-testid="live-feed-panel">
            {/* Top Products */}
            <Card data-testid="card-top-products">
              <CardContent className="p-4">
                <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2 mb-3">
                  <Package className="h-4 w-4 text-[#fb9678]" />
                  สินค้าขายดี
                </h3>
                {topProducts.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">ยังไม่มีข้อมูล</p>
                ) : (
                  <div className="space-y-2">
                    {topProducts.map((p: any, i: number) => (
                      <div key={p.id || i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2" data-testid={`top-product-${p.id || i}`}>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold text-gray-400 w-5">#{i + 1}</span>
                          <div>
                            <p className="text-sm font-medium text-gray-800">{p.name || p.productName}</p>
                            <p className="text-xs text-gray-400">ขายแล้ว {Number(p.soldQty || 0).toLocaleString()} ชิ้น</p>
                          </div>
                        </div>
                        <span className="text-sm font-bold text-[#05b187]">
                          ฿{formatCurrency(p.revenue || (p.soldQty || 0) * (p.price || p.livePrice || 0))}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Revenue Chart */}
            <Card data-testid="card-revenue-chart">
              <CardContent className="p-4">
                <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2 mb-3">
                  <BarChart3 className="h-4 w-4 text-[#03c9d7]" />
                  กราฟยอดขาย
                </h3>
                {revenueChartData.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">ยังไม่มีข้อมูล</p>
                ) : (
                  <div className="flex items-end gap-1 h-32" data-testid="revenue-bar-chart">
                    {revenueChartData.map((d: any, i: number) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-[9px] text-gray-400">{d.value > 0 ? `฿${formatCurrency(d.value)}` : ""}</span>
                        <div
                          className="w-full rounded-t transition-all"
                          style={{ height: `${(d.value / maxRevenue) * 100}%`, minHeight: d.value > 0 ? "4px" : "0px", background: "var(--theme-primary)" }}
                          data-testid={`bar-${i}`}
                        />
                        <span className="text-[9px] text-gray-400 truncate max-w-full">{d.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Orders */}
            <Card data-testid="card-recent-orders">
              <CardContent className="p-4">
                <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2 mb-3">
                  <ShoppingCart className="h-4 w-4 text-[var(--theme-primary)]" />
                  ออเดอร์ล่าสุด
                </h3>
                {orders.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">ยังไม่มีออเดอร์</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {orders.slice(0, 10).map((order: any, i: number) => (
                      <div key={order.id || i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2" data-testid={`order-item-${order.id || i}`}>
                        <div>
                          <p className="text-sm font-medium text-gray-800">{order.customerName || "ลูกค้า"}</p>
                          <p className="text-xs text-gray-400">
                            {order.createdAt ? new Date(order.createdAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) : ""}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-gray-800">฿{formatCurrency(order.amount || order.totalAmount)}</p>
                          <Badge
                            className={`text-[10px] ${
                              order.status === "paid" ? "bg-green-100 text-green-700" :
                              order.status === "pending" ? "bg-yellow-100 text-yellow-700" :
                              "bg-gray-100 text-gray-600"
                            }`}
                            data-testid={`badge-order-status-${order.id || i}`}
                          >
                            {order.status === "paid" ? "ชำระแล้ว" : order.status === "pending" ? "รอชำระ" : order.status || "-"}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - AI Insights & Ad Budget */}
          <div className="lg:col-span-1 space-y-4" data-testid="ai-insights-panel">
            {/* AI Recommendations */}
            <Card data-testid="card-ai-recommendations">
              <CardContent className="p-4">
                <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2 mb-3">
                  <Zap className="h-4 w-4 text-[#fec90f]" />
                  AI แนะนำ
                </h3>
                {(!dashboard?.aiInsights || dashboard.aiInsights.length === 0) ? (
                  <div className="text-center py-4">
                    <Lightbulb className="h-8 w-8 mx-auto mb-2 text-gray-200" />
                    <p className="text-xs text-gray-400">AI กำลังวิเคราะห์ข้อมูล...</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {dashboard.aiInsights.map((insight: any, i: number) => (
                      <div key={i} className="bg-[#fef9e7] rounded-lg p-2 border border-[#fec90f]/30" data-testid={`ai-insight-${i}`}>
                        <p className="text-xs text-gray-700">{insight.message || insight.text || insight}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Ad Budget */}
            <Card data-testid="card-ad-budget">
              <CardContent className="p-4">
                <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2 mb-3">
                  <TrendingUp className="h-4 w-4 text-[#f94d4d]" />
                  งบโฆษณา
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">ใช้ไปแล้ว</span>
                    <span className="text-sm font-bold text-gray-800" data-testid="text-current-spend">
                      ฿{formatCurrency(adBudgets?.currentSpend || adSpend)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">แนะนำ</span>
                    <span className="text-sm font-bold text-[#05b187]" data-testid="text-suggested-budget">
                      ฿{formatCurrency(adBudgets?.suggestedBudget || 0)}
                    </span>
                  </div>
                  {adBudgets?.suggestedBudget && Number(adBudgets.suggestedBudget) > 0 && (
                    <div className="mt-2">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-[#f94d4d] h-2 rounded-full transition-all"
                          style={{
                            width: `${Math.min(
                              ((Number(adBudgets.currentSpend || adSpend) / Number(adBudgets.suggestedBudget)) * 100),
                              100
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                  <Button
                    size="sm"
                    className="w-full bg-[#fb9678] hover:bg-[#e8856a] text-white text-xs gap-1"
                    data-testid="button-increase-budget"
                  >
                    <PlusCircle className="h-3.5 w-3.5" />
                    เพิ่มงบ
                  </Button>
                </div>

                {adBudgets?.history && adBudgets.history.length > 0 && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-xs font-medium text-gray-500 mb-2">ประวัติการปรับงบ</p>
                    <div className="space-y-1">
                      {adBudgets.history.slice(0, 5).map((h: any, i: number) => (
                        <div key={i} className="flex justify-between text-[10px] text-gray-400" data-testid={`budget-history-${i}`}>
                          <span>{h.time || "-"}</span>
                          <span className="flex items-center gap-1">
                            <ArrowUpRight className="h-3 w-3 text-[#05b187]" />
                            ฿{formatCurrency(h.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
