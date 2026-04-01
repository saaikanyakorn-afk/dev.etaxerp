import { useState, useMemo } from "react";
import ThaiDateInput from "@/components/thai-date-input";
import { useDateSettings } from "@/hooks/use-date-settings";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CILayout from "@/components/ci-layout";
import { useQuery } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, Legend
} from "recharts";
import {
  BrainCircuit, TrendingUp, TrendingDown, DollarSign, Package, Search,
  ArrowUpRight, ArrowDownRight, AlertTriangle, Star, Ban, Rocket, Filter
} from "lucide-react";
import CIExportButton from "./ci-export-button";

interface ProductItem {
  productId: number | null;
  sku: string;
  name: string;
  category: string;
  qty: number;
  revenue: number;
  cogs: number;
  fees: number;
  adCost: number;
  shipping: number;
  netProfit: number;
  margin: number;
  orderCount: number;
}

interface ProductStatsResponse {
  products: ProductItem[];
  recommendations: {
    heroCandidates: ProductItem[];
    stopAds: ProductItem[];
    pushMore: ProductItem[];
  };
}

const PLATFORM_OPTIONS = [
  { value: "all", label: "ทุกแพลตฟอร์ม" },
  { value: "shopee", label: "Shopee" },
  { value: "lazada", label: "Lazada" },
  { value: "tiktok", label: "TikTok Shop" },
];

const MARGIN_COLORS: Record<string, string> = {
  high: "#05b187",
  medium: "#fec90f",
  low: "#fb9678",
  negative: "#ef4444",
};

function formatMoney(v: number) {
  return `฿${v.toLocaleString("th-TH", { minimumFractionDigits: 2 })}`;
}

function formatCompact(v: number) {
  if (Math.abs(v) >= 1_000_000) return `฿${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `฿${(v / 1_000).toFixed(1)}K`;
  return `฿${v.toFixed(0)}`;
}

function getMarginColor(margin: number) {
  if (margin >= 20) return MARGIN_COLORS.high;
  if (margin >= 10) return MARGIN_COLORS.medium;
  if (margin >= 0) return MARGIN_COLORS.low;
  return MARGIN_COLORS.negative;
}

function getMarginBadge(margin: number) {
  if (margin >= 20) return { label: "High", variant: "default" as const, className: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" };
  if (margin >= 10) return { label: "Medium", variant: "default" as const, className: "bg-yellow-100 text-yellow-700 hover:bg-yellow-100" };
  if (margin >= 0) return { label: "Low", variant: "default" as const, className: "bg-orange-100 text-orange-700 hover:bg-orange-100" };
  return { label: "Loss", variant: "destructive" as const, className: "" };
}

export default function CIProduct() {
  const { selectedCompanyId } = useCompany();
  const { dateEra, dateFmt } = useDateSettings();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [platform, setPlatform] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<keyof ProductItem>("revenue");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedCompanyId) params.set("companyId", String(selectedCompanyId));
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (platform && platform !== "all") params.set("platform", platform);
    return params.toString();
  }, [selectedCompanyId, dateFrom, dateTo, platform]);

  const { data, isLoading } = useQuery<ProductStatsResponse>({
    queryKey: ["/api/ci/product-stats", queryParams],
    queryFn: async () => {
      const r = await fetch(`/api/ci/product-stats?${queryParams}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch product stats");
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const products = data?.products || [];
  const recommendations = data?.recommendations || { heroCandidates: [], stopAds: [], pushMore: [] };

  const filteredProducts = useMemo(() => {
    let items = [...products];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(p =>
        (p.name || "").toLowerCase().includes(q) ||
        (p.sku || "").toLowerCase().includes(q) ||
        (p.category || "").toLowerCase().includes(q)
      );
    }
    items.sort((a, b) => {
      const av = a[sortField] ?? 0;
      const bv = b[sortField] ?? 0;
      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "desc" ? bv - av : av - bv;
      }
      return sortDir === "desc"
        ? String(bv).localeCompare(String(av))
        : String(av).localeCompare(String(bv));
    });
    return items;
  }, [products, searchQuery, sortField, sortDir]);

  const totalRevenue = products.reduce((s, p) => s + p.revenue, 0);
  const totalProfit = products.reduce((s, p) => s + p.netProfit, 0);
  const totalCOGS = products.reduce((s, p) => s + p.cogs, 0);
  const totalFees = products.reduce((s, p) => s + p.fees, 0);
  const totalAdCost = products.reduce((s, p) => s + p.adCost, 0);
  const totalShipping = products.reduce((s, p) => s + p.shipping, 0);
  const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
  const profitableCount = products.filter(p => p.netProfit > 0).length;
  const lossCount = products.filter(p => p.netProfit < 0).length;

  const scatterData = products
    .filter(p => p.revenue > 0)
    .map(p => ({
      name: p.name || p.sku || "Unknown",
      revenue: p.revenue,
      margin: p.margin,
      profit: p.netProfit,
      fill: getMarginColor(p.margin),
    }));

  const top10ByProfit = [...products].sort((a, b) => b.netProfit - a.netProfit).slice(0, 10);
  const bottom5ByMargin = [...products]
    .filter(p => p.revenue > 0)
    .sort((a, b) => a.margin - b.margin)
    .slice(0, 5);

  const costBreakdownData = [
    { name: "COGS", value: totalCOGS, fill: "#539BFF" },
    { name: "Platform Fees", value: totalFees, fill: "#fb9678" },
    { name: "Ad Cost", value: totalAdCost, fill: "#fec90f" },
    { name: "Shipping", value: totalShipping, fill: "#03c9d7" },
    { name: "Net Profit", value: totalProfit, fill: "#05b187" },
  ];

  const handleSort = (field: keyof ProductItem) => {
    if (sortField === field) {
      setSortDir(d => d === "desc" ? "asc" : "desc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const SortIcon = ({ field }: { field: keyof ProductItem }) => {
    if (sortField !== field) return null;
    return sortDir === "desc"
      ? <ArrowDownRight className="h-3 w-3 inline ml-0.5" />
      : <ArrowUpRight className="h-3 w-3 inline ml-0.5" />;
  };

  return (
    <CILayout>
      <div className="space-y-6" data-testid="ci-product-page">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <BrainCircuit className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold" data-testid="text-page-title">Product & Profit Dashboard</h1>
              <p className="text-muted-foreground" data-testid="text-page-subtitle">วิเคราะห์กำไรตามสินค้า — Profit per SKU</p>
            </div>
          </div>
          <CIExportButton
            fileName={`CI-Product-Profit${dateFrom ? `-${dateFrom}` : ""}${dateTo ? `-${dateTo}` : ""}`}
            pdfTitle="Product & Profit Dashboard"
            kpis={[
              { label: "Total Revenue", value: formatMoney(totalRevenue) },
              { label: "Total Profit", value: formatMoney(totalProfit) },
              { label: "Avg Margin", value: `${avgMargin.toFixed(1)}%` },
              { label: "Products", value: `${profitableCount} profit / ${lossCount} loss` },
            ]}
            tables={[{
              title: "Product Profitability",
              sheetName: "Products",
              columns: [
                { header: "SKU", key: "sku", width: 18 },
                { header: "Name", key: "name", width: 30 },
                { header: "Category", key: "category", width: 15 },
                { header: "Qty", key: "qty", format: "number", width: 8 },
                { header: "Revenue", key: "revenue", format: "money", width: 14 },
                { header: "COGS", key: "cogs", format: "money", width: 14 },
                { header: "Fees", key: "fees", format: "money", width: 12 },
                { header: "Ad Cost", key: "adCost", format: "money", width: 12 },
                { header: "Shipping", key: "shipping", format: "money", width: 12 },
                { header: "Net Profit", key: "netProfit", format: "money", width: 14 },
                { header: "Margin %", key: "margin", format: "percent", width: 10 },
              ],
              data: filteredProducts,
            }]}
          />
        </div>

        <div className="flex flex-wrap gap-3 items-end" data-testid="product-filters">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">จาก</label>
            <ThaiDateInput
              value={dateFrom}
              onChange={setDateFrom}
              dateEra={dateEra} dateFmt={dateFmt}
              className="w-44"
              data-testid="input-date-from"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">ถึง</label>
            <ThaiDateInput
              value={dateTo}
              onChange={setDateTo}
              dateEra={dateEra} dateFmt={dateFmt}
              className="w-44"
              data-testid="input-date-to"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">แพลตฟอร์ม</label>
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger className="w-44" data-testid="select-platform">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLATFORM_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-muted-foreground mb-1 block">ค้นหาสินค้า</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="ชื่อสินค้า, SKU, หมวดหมู่..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-product"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4" data-testid="product-kpi-cards">
          <Card data-testid="card-total-revenue">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="h-4 w-4 text-blue-500" />
                <span className="text-xs text-muted-foreground">Total Revenue</span>
              </div>
              <p className="text-lg font-bold">{formatCompact(totalRevenue)}</p>
            </CardContent>
          </Card>
          <Card data-testid="card-total-profit">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                <span className="text-xs text-muted-foreground">Net Profit</span>
              </div>
              <p className={`text-lg font-bold ${totalProfit >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                {formatCompact(totalProfit)}
              </p>
            </CardContent>
          </Card>
          <Card data-testid="card-avg-margin">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4" style={{ color: getMarginColor(avgMargin) }} />
                <span className="text-xs text-muted-foreground">Avg Margin</span>
              </div>
              <p className="text-lg font-bold" style={{ color: getMarginColor(avgMargin) }}>
                {avgMargin.toFixed(1)}%
              </p>
            </CardContent>
          </Card>
          <Card data-testid="card-total-products">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 mb-1">
                <Package className="h-4 w-4 text-purple-500" />
                <span className="text-xs text-muted-foreground">Products</span>
              </div>
              <p className="text-lg font-bold">{products.length}</p>
            </CardContent>
          </Card>
          <Card data-testid="card-profitable-count">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 mb-1">
                <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                <span className="text-xs text-muted-foreground">Profitable</span>
              </div>
              <p className="text-lg font-bold text-emerald-600">{profitableCount}</p>
            </CardContent>
          </Card>
          <Card data-testid="card-loss-count">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 mb-1">
                <ArrowDownRight className="h-4 w-4 text-red-500" />
                <span className="text-xs text-muted-foreground">Loss</span>
              </div>
              <p className="text-lg font-bold text-red-500">{lossCount}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <Card data-testid="card-scatter-plot">
            <CardHeader>
              <CardTitle className="text-base">Revenue vs Margin — Product Matrix</CardTitle>
              <CardDescription>สินค้ามุมขวาบน = Revenue สูง, Margin สูง (Hero Products)</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">กำลังโหลด...</div>
              ) : scatterData.length === 0 ? (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">ไม่มีข้อมูล</div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <ScatterChart>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      dataKey="revenue"
                      name="Revenue"
                      tickFormatter={v => formatCompact(v)}
                      fontSize={11}
                    />
                    <YAxis
                      type="number"
                      dataKey="margin"
                      name="Margin %"
                      unit="%"
                      fontSize={11}
                    />
                    <Tooltip
                      content={({ payload }) => {
                        if (!payload || !payload.length) return null;
                        const d = payload[0].payload;
                        return (
                          <div className="bg-white border rounded-lg shadow-lg p-3 text-sm" data-testid="scatter-tooltip">
                            <p className="font-semibold mb-1">{d.name}</p>
                            <p>Revenue: {formatMoney(d.revenue)}</p>
                            <p>Margin: {d.margin.toFixed(1)}%</p>
                            <p>Profit: {formatMoney(d.profit)}</p>
                          </div>
                        );
                      }}
                    />
                    <Scatter data={scatterData} dataKey="margin">
                      {scatterData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-cost-breakdown">
            <CardHeader>
              <CardTitle className="text-base">Cost Breakdown</CardTitle>
              <CardDescription>สัดส่วนต้นทุนรวมทุกสินค้า</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">กำลังโหลด...</div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={costBreakdownData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tickFormatter={v => formatCompact(v)} fontSize={11} />
                    <YAxis type="category" dataKey="name" width={100} fontSize={11} />
                    <Tooltip formatter={(v: number) => formatMoney(v)} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {costBreakdownData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="all" data-testid="product-tabs">
          <TabsList>
            <TabsTrigger value="all" data-testid="tab-all-products">สินค้าทั้งหมด ({filteredProducts.length})</TabsTrigger>
            <TabsTrigger value="top-profit" data-testid="tab-top-profit">Top Profit ({top10ByProfit.length})</TabsTrigger>
            <TabsTrigger value="low-margin" data-testid="tab-low-margin">Low Margin ({bottom5ByMargin.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <Card data-testid="card-product-table">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[200px] cursor-pointer" onClick={() => handleSort("name")}>
                          สินค้า <SortIcon field="name" />
                        </TableHead>
                        <TableHead className="text-right cursor-pointer" onClick={() => handleSort("qty")}>
                          จำนวน <SortIcon field="qty" />
                        </TableHead>
                        <TableHead className="text-right cursor-pointer" onClick={() => handleSort("revenue")}>
                          Revenue <SortIcon field="revenue" />
                        </TableHead>
                        <TableHead className="text-right cursor-pointer" onClick={() => handleSort("cogs")}>
                          COGS <SortIcon field="cogs" />
                        </TableHead>
                        <TableHead className="text-right cursor-pointer" onClick={() => handleSort("fees")}>
                          Fees <SortIcon field="fees" />
                        </TableHead>
                        <TableHead className="text-right cursor-pointer" onClick={() => handleSort("adCost")}>
                          Ad Cost <SortIcon field="adCost" />
                        </TableHead>
                        <TableHead className="text-right cursor-pointer" onClick={() => handleSort("shipping")}>
                          Shipping <SortIcon field="shipping" />
                        </TableHead>
                        <TableHead className="text-right cursor-pointer" onClick={() => handleSort("netProfit")}>
                          Net Profit <SortIcon field="netProfit" />
                        </TableHead>
                        <TableHead className="text-right cursor-pointer" onClick={() => handleSort("margin")}>
                          Margin% <SortIcon field="margin" />
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                            กำลังโหลดข้อมูล...
                          </TableCell>
                        </TableRow>
                      ) : filteredProducts.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                            ไม่พบข้อมูลสินค้า
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredProducts.map((p, idx) => {
                          const marginBadge = getMarginBadge(p.margin);
                          return (
                            <TableRow key={`${p.sku}-${idx}`} data-testid={`row-product-${idx}`}>
                              <TableCell>
                                <div>
                                  <p className="font-medium text-sm truncate max-w-[200px]" data-testid={`text-product-name-${idx}`}>
                                    {p.name || "—"}
                                  </p>
                                  <p className="text-xs text-muted-foreground">{p.sku || "No SKU"} · {p.category}</p>
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-medium" data-testid={`text-product-qty-${idx}`}>
                                {p.qty.toLocaleString()}
                              </TableCell>
                              <TableCell className="text-right" data-testid={`text-product-revenue-${idx}`}>
                                {formatMoney(p.revenue)}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {formatMoney(p.cogs)}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {formatMoney(p.fees)}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {formatMoney(p.adCost)}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {formatMoney(p.shipping)}
                              </TableCell>
                              <TableCell className={`text-right font-semibold ${p.netProfit >= 0 ? "text-emerald-600" : "text-red-500"}`} data-testid={`text-product-profit-${idx}`}>
                                {formatMoney(p.netProfit)}
                              </TableCell>
                              <TableCell className="text-right" data-testid={`text-product-margin-${idx}`}>
                                <Badge className={marginBadge.className} variant={marginBadge.variant}>
                                  {p.margin.toFixed(1)}%
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="top-profit">
            <Card data-testid="card-top-profit-table">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-emerald-500" /> Top 10 สินค้ากำไรสูงสุด
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>สินค้า</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                        <TableHead className="text-right">Net Profit</TableHead>
                        <TableHead className="text-right">Margin%</TableHead>
                        <TableHead className="text-right">Orders</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {top10ByProfit.map((p, idx) => (
                        <TableRow key={idx} data-testid={`row-top-profit-${idx}`}>
                          <TableCell className="font-bold text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell>
                            <p className="font-medium text-sm">{p.name || p.sku || "—"}</p>
                            <p className="text-xs text-muted-foreground">{p.sku}</p>
                          </TableCell>
                          <TableCell className="text-right">{formatMoney(p.revenue)}</TableCell>
                          <TableCell className={`text-right font-semibold ${p.netProfit >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                            {formatMoney(p.netProfit)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge className={getMarginBadge(p.margin).className} variant={getMarginBadge(p.margin).variant}>
                              {p.margin.toFixed(1)}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{p.orderCount}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="low-margin">
            <Card data-testid="card-low-margin-table">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-500" /> สินค้า Margin ต่ำ — High Revenue, Low Margin
                </CardTitle>
                <CardDescription>สินค้าที่ยอดขายสูงแต่กำไรน้อย ควรพิจารณาปรับราคาหรือลดต้นทุน</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>สินค้า</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                        <TableHead className="text-right">COGS</TableHead>
                        <TableHead className="text-right">Net Profit</TableHead>
                        <TableHead className="text-right">Margin%</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bottom5ByMargin.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            ไม่พบข้อมูล
                          </TableCell>
                        </TableRow>
                      ) : (
                        bottom5ByMargin.map((p, idx) => (
                          <TableRow key={idx} data-testid={`row-low-margin-${idx}`}>
                            <TableCell>
                              <p className="font-medium text-sm">{p.name || p.sku || "—"}</p>
                              <p className="text-xs text-muted-foreground">{p.sku} · {p.category}</p>
                            </TableCell>
                            <TableCell className="text-right">{formatMoney(p.revenue)}</TableCell>
                            <TableCell className="text-right text-muted-foreground">{formatMoney(p.cogs)}</TableCell>
                            <TableCell className={`text-right font-semibold ${p.netProfit >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                              {formatMoney(p.netProfit)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge className={getMarginBadge(p.margin).className} variant={getMarginBadge(p.margin).variant}>
                                {p.margin.toFixed(1)}%
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="grid md:grid-cols-3 gap-4" data-testid="product-recommendations">
          <Card data-testid="card-hero-candidates">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Star className="h-5 w-5 text-amber-500" /> Hero Product Candidates
              </CardTitle>
              <CardDescription>Margin {">"} 20%, Revenue สูง — เหมาะโปรโมทเพิ่ม</CardDescription>
            </CardHeader>
            <CardContent>
              {recommendations.heroCandidates.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">ไม่พบสินค้าที่เข้าเกณฑ์</p>
              ) : (
                <div className="space-y-3">
                  {recommendations.heroCandidates.map((p, i) => (
                    <div key={i} className="flex items-center justify-between border-b last:border-0 pb-2" data-testid={`hero-candidate-${i}`}>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{p.name || p.sku}</p>
                        <p className="text-xs text-muted-foreground">{formatMoney(p.revenue)}</p>
                      </div>
                      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 shrink-0 ml-2">
                        {p.margin.toFixed(0)}%
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-push-more">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Rocket className="h-5 w-5 text-blue-500" /> Push More
              </CardTitle>
              <CardDescription>Margin {">"} 30% — ยิงโฆษณาเพิ่มได้</CardDescription>
            </CardHeader>
            <CardContent>
              {recommendations.pushMore.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">ไม่พบสินค้าที่เข้าเกณฑ์</p>
              ) : (
                <div className="space-y-3">
                  {recommendations.pushMore.map((p, i) => (
                    <div key={i} className="flex items-center justify-between border-b last:border-0 pb-2" data-testid={`push-more-${i}`}>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{p.name || p.sku}</p>
                        <p className="text-xs text-muted-foreground">{formatMoney(p.revenue)}</p>
                      </div>
                      <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 shrink-0 ml-2">
                        {p.margin.toFixed(0)}%
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-stop-ads">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Ban className="h-5 w-5 text-red-500" /> Stop Ads
              </CardTitle>
              <CardDescription>Margin {"<"} 5% แต่ยังยิงโฆษณา — ควรหยุด</CardDescription>
            </CardHeader>
            <CardContent>
              {recommendations.stopAds.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">ไม่พบสินค้าที่เข้าเกณฑ์</p>
              ) : (
                <div className="space-y-3">
                  {recommendations.stopAds.map((p, i) => (
                    <div key={i} className="flex items-center justify-between border-b last:border-0 pb-2" data-testid={`stop-ads-${i}`}>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{p.name || p.sku}</p>
                        <p className="text-xs text-muted-foreground">Ad: {formatMoney(p.adCost)}</p>
                      </div>
                      <Badge variant="destructive" className="shrink-0 ml-2">
                        {p.margin.toFixed(0)}%
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </CILayout>
  );
}
