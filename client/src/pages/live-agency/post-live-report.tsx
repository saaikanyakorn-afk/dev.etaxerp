import { useState } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  Clock,
  Users,
  ShoppingCart,
  DollarSign,
  TrendingUp,
  Target,
  Percent,
  Receipt,
  Brain,
  Lightbulb,
  FileText,
  Loader2,
  RefreshCw,
  ChevronRight,
  Home,
  ArrowUp,
  ArrowDown,
  Minus,
} from "lucide-react";

const PLATFORMS: Record<string, { label: string; className: string }> = {
  facebook: { label: "Facebook", className: "bg-[#e5f9fa] text-[#03c9d7] hover:bg-[#e5f9fa]" },
  tiktok: { label: "TikTok", className: "bg-pink-100 text-pink-700 hover:bg-pink-100" },
  instagram: { label: "Instagram", className: "bg-purple-100 text-purple-700 hover:bg-purple-100" },
  shopee: { label: "Shopee", className: "bg-orange-100 text-orange-700 hover:bg-orange-100" },
  lazada: { label: "Lazada", className: "bg-blue-100 text-blue-700 hover:bg-blue-100" },
  line: { label: "LINE", className: "bg-green-100 text-green-700 hover:bg-green-100" },
};

function formatCurrency(v: string | number | null | undefined): string {
  return Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "-";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "-";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function platformBadge(platform: string) {
  const p = PLATFORMS[platform];
  if (!p) return <Badge data-testid={`badge-platform-${platform}`} className="bg-gray-100 text-gray-700 hover:bg-gray-100">{platform}</Badge>;
  return <Badge data-testid={`badge-platform-${platform}`} className={p.className}>{p.label}</Badge>;
}

function ComparisonArrow({ current, previous }: { current: number; previous: number }) {
  if (current > previous) return <ArrowUp className="h-4 w-4 text-green-500" />;
  if (current < previous) return <ArrowDown className="h-4 w-4 text-red-500" />;
  return <Minus className="h-4 w-4 text-gray-400" />;
}

export default function PostLiveReport() {
  const [, params] = useRoute("/ecommerce/live-agency/report/:id");
  const sessionId = params?.id;
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: report, isLoading: reportLoading } = useQuery<any>({
    queryKey: ["/api/live-agency/sessions", sessionId, "report"],
    queryFn: async () => {
      const r = await apiRequest("GET", `/api/live-agency/sessions/${sessionId}/report`);
      return r.json();
    },
    enabled: !!sessionId,
  });

  const { data: dashboard } = useQuery<any>({
    queryKey: ["/api/live-agency/sessions", sessionId, "dashboard"],
    queryFn: async () => {
      const r = await apiRequest("GET", `/api/live-agency/sessions/${sessionId}/dashboard`);
      return r.json();
    },
    enabled: !!sessionId,
  });

  const generateReport = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", `/api/live-agency/sessions/${sessionId}/report`);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/live-agency/sessions", sessionId, "report"] });
      toast({ title: "สร้างรายงานสำเร็จ" });
    },
    onError: (err: any) => {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    },
  });

  const session = dashboard?.session || dashboard || {};
  const data = report || {};

  let topProducts: any[] = [];
  try {
    if (typeof data.top_products === "string") topProducts = JSON.parse(data.top_products);
    else if (Array.isArray(data.top_products)) topProducts = data.top_products;
    else if (typeof data.topProducts === "string") topProducts = JSON.parse(data.topProducts);
    else if (Array.isArray(data.topProducts)) topProducts = data.topProducts;
  } catch {}

  let comparison: any = null;
  try {
    if (typeof data.comparison_json === "string") comparison = JSON.parse(data.comparison_json);
    else if (data.comparison_json && typeof data.comparison_json === "object") comparison = data.comparison_json;
    else if (typeof data.comparisonJson === "string") comparison = JSON.parse(data.comparisonJson);
    else if (data.comparisonJson && typeof data.comparisonJson === "object") comparison = data.comparisonJson;
  } catch {}

  const summaryCards = [
    { title: "ระยะเวลาไลฟ์", value: data.duration || session.duration || "-", icon: Clock, color: "var(--theme-primary)", bgColor: "#eef4ff" },
    { title: "คนดูสูงสุด / เฉลี่ย", value: `${Number(data.peakViewers || data.peak_viewers || session.peakViewers || 0).toLocaleString()} / ${Number(data.avgViewers || data.avg_viewers || session.avgViewers || 0).toLocaleString()}`, icon: Users, color: "#03c9d7", bgColor: "#e5f9fa" },
    { title: "ออเดอร์ทั้งหมด", value: Number(data.totalOrders || data.total_orders || session.orders || 0).toLocaleString(), icon: ShoppingCart, color: "#fec90f", bgColor: "#fff8e1" },
    { title: "ยอดขายรวม", value: `฿${formatCurrency(data.totalRevenue || data.total_revenue || session.revenue)}`, icon: DollarSign, color: "#05b187", bgColor: "#e6f7f2" },
    { title: "ค่าโฆษณารวม", value: `฿${formatCurrency(data.totalAdSpend || data.total_ad_spend || session.adSpend)}`, icon: Target, color: "#f94d4d", bgColor: "#fef2f2" },
    { title: "ROAS", value: `${Number(data.roas || session.roas || 0).toFixed(2)}x`, icon: TrendingUp, color: "#fb9678", bgColor: "#fff3ef" },
    { title: "Conversion Rate", value: `${Number(data.conversionRate || data.conversion_rate || 0).toFixed(2)}%`, icon: Percent, color: "#7c3aed", bgColor: "#f3e8ff" },
    { title: "ค่าบริการ", value: `฿${formatCurrency(data.serviceFee || data.service_fee || 0)}`, icon: Receipt, color: "#059669", bgColor: "#ecfdf5" },
  ];

  const aiSummary = data.ai_summary || data.aiSummary || "";
  const aiRecommendations = data.ai_recommendations || data.aiRecommendations || [];
  const recommendations = typeof aiRecommendations === "string"
    ? aiRecommendations.split("\n").filter((r: string) => r.trim())
    : Array.isArray(aiRecommendations) ? aiRecommendations : [];

  if (!sessionId) {
    return (
      <div className="p-6 text-center text-gray-500" data-testid="text-no-session">
        ไม่พบเซสชัน
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-1" data-testid="breadcrumb">
            <Home className="h-3.5 w-3.5" />
            <span>หน้าหลัก</span>
            <ChevronRight className="h-3.5 w-3.5" />
            <span>AI Live Agency</span>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-gray-800 font-medium">รายงานหลังไลฟ์</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold" style={{ color: "#fb9678" }} data-testid="text-page-title">
              รายงานหลังไลฟ์
            </h1>
            {session.platform && platformBadge(session.platform)}
          </div>
          <p className="text-sm text-gray-500 mt-1" data-testid="text-session-info">
            {session.title || `เซสชัน #${sessionId}`} • {formatDateTime(session.scheduledAt || session.startTime || session.createdAt)}
          </p>
        </div>
        <Button
          onClick={() => generateReport.mutate()}
          disabled={generateReport.isPending}
          className="text-white"
          style={{ background: "#fb9678" }}
          data-testid="button-generate-report"
        >
          {generateReport.isPending ? (
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-1.5" />
          )}
          {report ? "สร้างรายงานใหม่" : "สร้างรายงาน"}
        </Button>
      </div>

      {reportLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {summaryCards.map((card, idx) => (
              <Card key={idx} className="shadow-sm" data-testid={`card-summary-${idx}`}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">{card.title}</p>
                      <p className="text-xl font-bold" data-testid={`value-summary-${idx}`}>{card.value}</p>
                    </div>
                    <div
                      className="h-10 w-10 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: card.bgColor }}
                    >
                      <card.icon className="h-5 w-5" style={{ color: card.color }} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {aiSummary && (
            <Card className="shadow-sm overflow-hidden" data-testid="card-ai-summary">
              <div
                className="p-5"
                style={{ background: "#e0f7fa" }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-8 w-8 rounded-full bg-white/80 flex items-center justify-center">
                    <Brain className="h-5 w-5 text-cyan-600" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-800">AI Summary</h3>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap" data-testid="text-ai-summary">
                  {aiSummary}
                </p>
              </div>
            </Card>
          )}

          {recommendations.length > 0 && (
            <Card className="shadow-sm overflow-hidden" data-testid="card-ai-recommendations">
              <div
                className="p-5"
                style={{ background: "#e0f2fe" }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-8 w-8 rounded-full bg-white/80 flex items-center justify-center">
                    <Lightbulb className="h-5 w-5 text-amber-500" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-800">AI Recommendations</h3>
                </div>
                <ul className="space-y-2">
                  {recommendations.map((rec: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-gray-700" data-testid={`text-recommendation-${idx}`}>
                      <span className="mt-0.5 h-5 w-5 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: "#fb9678", flexShrink: 0 }}>
                        {idx + 1}
                      </span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Card>
          )}

          {topProducts.length > 0 && (
            <Card className="shadow-sm" data-testid="card-top-products">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5" style={{ color: "#fb9678" }} />
                  สินค้าขายดี
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>สินค้า</TableHead>
                        <TableHead className="text-right">จำนวน</TableHead>
                        <TableHead className="text-right">ยอดขาย</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topProducts.map((product: any, idx: number) => (
                        <TableRow key={idx} data-testid={`row-product-${idx}`}>
                          <TableCell className="font-medium">{idx + 1}</TableCell>
                          <TableCell className="font-medium text-sm">{product.name || product.productName || "-"}</TableCell>
                          <TableCell className="text-right text-sm">{Number(product.qty || product.qtySold || product.quantity || 0).toLocaleString()}</TableCell>
                          <TableCell className="text-right text-sm">฿{formatCurrency(product.revenue || product.totalRevenue || 0)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {comparison && (
            <Card className="shadow-sm" data-testid="card-comparison">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" style={{ color: "#fb9678" }} />
                  เปรียบเทียบกับไลฟ์ก่อนหน้า
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ตัวชี้วัด</TableHead>
                        <TableHead className="text-right">ครั้งนี้</TableHead>
                        <TableHead className="text-right">ครั้งก่อน</TableHead>
                        <TableHead className="text-center">เปลี่ยนแปลง</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[
                        { label: "คนดูสูงสุด", key: "peakViewers", prefix: "" },
                        { label: "ออเดอร์", key: "orders", prefix: "" },
                        { label: "ยอดขาย", key: "revenue", prefix: "฿" },
                        { label: "ROAS", key: "roas", prefix: "", suffix: "x" },
                        { label: "Conversion Rate", key: "conversionRate", prefix: "", suffix: "%" },
                      ].map((metric) => {
                        const current = Number(comparison.current?.[metric.key] || 0);
                        const previous = Number(comparison.previous?.[metric.key] || 0);
                        const diff = previous > 0 ? ((current - previous) / previous * 100).toFixed(1) : "-";
                        return (
                          <TableRow key={metric.key} data-testid={`row-compare-${metric.key}`}>
                            <TableCell className="font-medium text-sm">{metric.label}</TableCell>
                            <TableCell className="text-right text-sm">
                              {metric.prefix}{metric.key === "revenue" ? formatCurrency(current) : current.toLocaleString()}{metric.suffix || ""}
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              {metric.prefix}{metric.key === "revenue" ? formatCurrency(previous) : previous.toLocaleString()}{metric.suffix || ""}
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-1">
                                <ComparisonArrow current={current} previous={previous} />
                                <span className={`text-sm ${current > previous ? "text-green-600" : current < previous ? "text-red-600" : "text-gray-400"}`}>
                                  {diff !== "-" ? `${diff}%` : "-"}
                                </span>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}