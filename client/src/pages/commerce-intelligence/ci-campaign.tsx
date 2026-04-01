import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import CILayout from "@/components/ci-layout";
import CIExportButton from "./ci-export-button";
import {
  BrainCircuit,
  DollarSign,
  TrendingUp,
  Target,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Megaphone,
  Eye,
  MousePointer,
  Zap,
  Lightbulb,
  BarChart3,
  Loader2,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function fmt(n: number): string {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function fmtCurrency(n: number): string {
  return "฿" + fmt(n);
}

function fmtPct(n: number): string {
  return n.toFixed(2) + "%";
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-green-100 text-green-700",
    paused: "bg-yellow-100 text-yellow-700",
    completed: "bg-blue-100 text-blue-700",
    draft: "bg-gray-100 text-gray-600",
  };
  return (
    <Badge className={map[status] || "bg-gray-100 text-gray-600"} data-testid={`badge-status-${status}`}>
      {status}
    </Badge>
  );
}

function PlatformBadge({ platform }: { platform: string }) {
  const map: Record<string, string> = {
    facebook: "bg-blue-100 text-blue-700",
    google: "bg-red-100 text-red-700",
    tiktok: "bg-gray-800 text-white",
    line: "bg-green-100 text-green-700",
    shopee: "bg-orange-100 text-orange-700",
    lazada: "bg-purple-100 text-purple-700",
    instagram: "bg-pink-100 text-pink-700",
  };
  return (
    <Badge className={map[platform] || "bg-gray-100 text-gray-600"} data-testid={`badge-platform-${platform}`}>
      {platform}
    </Badge>
  );
}

export default function CICampaign() {
  const { selectedCompanyId } = useCompany();
  const [sortField, setSortField] = useState<string>("spend");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const { data, isLoading } = useQuery({
    queryKey: ["/api/ci/campaign-stats", selectedCompanyId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCompanyId) params.set("companyId", String(selectedCompanyId));
      const r = await fetch(`/api/ci/campaign-stats?${params}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch campaign stats");
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const sortedCampaigns = useMemo(() => {
    if (!data?.campaigns) return [];
    return [...data.campaigns].sort((a: any, b: any) => {
      const aVal = a[sortField] ?? 0;
      const bVal = b[sortField] ?? 0;
      return sortDir === "desc" ? bVal - aVal : aVal - bVal;
    });
  }, [data?.campaigns, sortField, sortDir]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(d => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const summary = data?.summary || { totalSpend: 0, totalRevenue: 0, overallRoas: 0, profitAfterAds: 0 };
  const highlights = data?.highlights || { highRoasLowProfit: [], goodProfitLowRoas: [] };

  return (
    <CILayout>
      <div className="space-y-6" data-testid="ci-campaign-page">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <BrainCircuit className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold" data-testid="text-page-title">Campaign Dashboard</h1>
              <p className="text-muted-foreground" data-testid="text-page-subtitle">วิเคราะห์ประสิทธิภาพแคมเปญโฆษณา</p>
            </div>
          </div>
          <CIExportButton
            fileName="CI-Campaign-Report"
            pdfTitle="Campaign Dashboard"
            kpis={[
              { label: "Total Spend", value: `B${summary.totalSpend.toLocaleString()}` },
              { label: "Total Revenue", value: `B${summary.totalRevenue.toLocaleString()}` },
              { label: "Overall ROAS", value: `${summary.overallRoas.toFixed(2)}x` },
              { label: "Profit After Ads", value: `B${summary.profitAfterAds.toLocaleString()}` },
            ]}
            tables={[{
              title: "Campaign Performance",
              sheetName: "Campaigns",
              columns: [
                { header: "Campaign", key: "name", width: 30 },
                { header: "Platform", key: "platform", width: 12 },
                { header: "Status", key: "status", width: 10 },
                { header: "Impressions", key: "impressions", format: "number", width: 14 },
                { header: "Clicks", key: "clicks", format: "number", width: 10 },
                { header: "CTR %", key: "ctr", format: "percent", width: 8 },
                { header: "CPC", key: "cpc", format: "money", width: 10 },
                { header: "Spend", key: "spend", format: "money", width: 14 },
                { header: "Revenue", key: "revenue", format: "money", width: 14 },
                { header: "ROAS", key: "roas", format: "number", width: 8 },
                { header: "Profit After Ads", key: "profitAfterAds", format: "money", width: 16 },
              ],
              data: sortedCampaigns,
            }]}
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20" data-testid="loading-spinner">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card data-testid="card-kpi-total-spend">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">ค่าโฆษณารวม</p>
                      <p className="text-2xl font-bold" data-testid="text-total-spend">{fmtCurrency(summary.totalSpend)}</p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                      <DollarSign className="h-6 w-6 text-red-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-kpi-total-revenue">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">รายได้จากโฆษณา</p>
                      <p className="text-2xl font-bold" data-testid="text-total-revenue">{fmtCurrency(summary.totalRevenue)}</p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                      <TrendingUp className="h-6 w-6 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-kpi-roas">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">ROAS รวม</p>
                      <p className="text-2xl font-bold" data-testid="text-overall-roas">{summary.overallRoas.toFixed(2)}x</p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                      <Target className="h-6 w-6 text-blue-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-kpi-profit-after-ads">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">กำไรหลังหักค่าโฆษณา</p>
                      <p className={`text-2xl font-bold ${summary.profitAfterAds >= 0 ? "text-green-600" : "text-red-600"}`} data-testid="text-profit-after-ads">
                        {fmtCurrency(summary.profitAfterAds)}
                      </p>
                    </div>
                    <div className={`h-12 w-12 rounded-full ${summary.profitAfterAds >= 0 ? "bg-green-100" : "bg-red-100"} flex items-center justify-center`}>
                      {summary.profitAfterAds >= 0 ? (
                        <ArrowUpRight className="h-6 w-6 text-green-600" />
                      ) : (
                        <ArrowDownRight className="h-6 w-6 text-red-600" />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card data-testid="card-campaign-table">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Megaphone className="h-5 w-5" />
                  รายละเอียดแคมเปญ ({sortedCampaigns.length} แคมเปญ)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {sortedCampaigns.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground" data-testid="text-no-campaigns">
                    <Megaphone className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>ยังไม่มีข้อมูลแคมเปญ</p>
                    <p className="text-sm mt-1">เพิ่มแคมเปญโฆษณาได้ที่เมนู Ads Tracking</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>แคมเปญ</TableHead>
                          <TableHead>แพลตฟอร์ม</TableHead>
                          <TableHead>สถานะ</TableHead>
                          <TableHead className="cursor-pointer select-none text-right" onClick={() => handleSort("impressions")} data-testid="sort-impressions">
                            <div className="flex items-center justify-end gap-1">
                              <Eye className="h-3 w-3" /> Impressions
                              {sortField === "impressions" && <span>{sortDir === "desc" ? "↓" : "↑"}</span>}
                            </div>
                          </TableHead>
                          <TableHead className="cursor-pointer select-none text-right" onClick={() => handleSort("clicks")} data-testid="sort-clicks">
                            <div className="flex items-center justify-end gap-1">
                              <MousePointer className="h-3 w-3" /> Clicks
                              {sortField === "clicks" && <span>{sortDir === "desc" ? "↓" : "↑"}</span>}
                            </div>
                          </TableHead>
                          <TableHead className="cursor-pointer select-none text-right" onClick={() => handleSort("ctr")} data-testid="sort-ctr">
                            <div className="flex items-center justify-end gap-1">
                              CTR
                              {sortField === "ctr" && <span>{sortDir === "desc" ? "↓" : "↑"}</span>}
                            </div>
                          </TableHead>
                          <TableHead className="cursor-pointer select-none text-right" onClick={() => handleSort("cpc")} data-testid="sort-cpc">
                            <div className="flex items-center justify-end gap-1">
                              CPC
                              {sortField === "cpc" && <span>{sortDir === "desc" ? "↓" : "↑"}</span>}
                            </div>
                          </TableHead>
                          <TableHead className="cursor-pointer select-none text-right" onClick={() => handleSort("spend")} data-testid="sort-spend">
                            <div className="flex items-center justify-end gap-1">
                              <DollarSign className="h-3 w-3" /> Spend
                              {sortField === "spend" && <span>{sortDir === "desc" ? "↓" : "↑"}</span>}
                            </div>
                          </TableHead>
                          <TableHead className="cursor-pointer select-none text-right" onClick={() => handleSort("revenue")} data-testid="sort-revenue">
                            <div className="flex items-center justify-end gap-1">
                              Revenue
                              {sortField === "revenue" && <span>{sortDir === "desc" ? "↓" : "↑"}</span>}
                            </div>
                          </TableHead>
                          <TableHead className="cursor-pointer select-none text-right" onClick={() => handleSort("roas")} data-testid="sort-roas">
                            <div className="flex items-center justify-end gap-1">
                              <Target className="h-3 w-3" /> ROAS
                              {sortField === "roas" && <span>{sortDir === "desc" ? "↓" : "↑"}</span>}
                            </div>
                          </TableHead>
                          <TableHead className="cursor-pointer select-none text-right" onClick={() => handleSort("profitAfterAds")} data-testid="sort-profit">
                            <div className="flex items-center justify-end gap-1">
                              Profit
                              {sortField === "profitAfterAds" && <span>{sortDir === "desc" ? "↓" : "↑"}</span>}
                            </div>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedCampaigns.map((c: any) => (
                          <TableRow key={c.id} data-testid={`row-campaign-${c.id}`}>
                            <TableCell className="font-medium" data-testid={`text-campaign-name-${c.id}`}>{c.name}</TableCell>
                            <TableCell><PlatformBadge platform={c.platform} /></TableCell>
                            <TableCell><StatusBadge status={c.status} /></TableCell>
                            <TableCell className="text-right" data-testid={`text-impressions-${c.id}`}>{fmt(c.impressions)}</TableCell>
                            <TableCell className="text-right" data-testid={`text-clicks-${c.id}`}>{fmt(c.clicks)}</TableCell>
                            <TableCell className="text-right" data-testid={`text-ctr-${c.id}`}>{fmtPct(c.ctr)}</TableCell>
                            <TableCell className="text-right" data-testid={`text-cpc-${c.id}`}>{fmtCurrency(c.cpc)}</TableCell>
                            <TableCell className="text-right" data-testid={`text-spend-${c.id}`}>{fmtCurrency(c.spend)}</TableCell>
                            <TableCell className="text-right" data-testid={`text-revenue-${c.id}`}>{fmtCurrency(c.revenue)}</TableCell>
                            <TableCell className="text-right" data-testid={`text-roas-${c.id}`}>
                              <span className={c.roas >= 3 ? "text-green-600 font-semibold" : c.roas >= 1 ? "text-blue-600" : "text-red-600"}>
                                {c.roas.toFixed(2)}x
                              </span>
                            </TableCell>
                            <TableCell className="text-right" data-testid={`text-profit-${c.id}`}>
                              <span className={c.profitAfterAds >= 0 ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
                                {fmtCurrency(c.profitAfterAds)}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card data-testid="card-high-roas-low-profit">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-amber-600">
                    <AlertTriangle className="h-5 w-5" />
                    ROAS สูง แต่กำไรต่ำ
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {highlights.highRoasLowProfit.length === 0 ? (
                    <p className="text-muted-foreground text-sm py-4 text-center" data-testid="text-no-high-roas-low-profit">ไม่พบแคมเปญในกลุ่มนี้</p>
                  ) : (
                    <div className="space-y-3">
                      {highlights.highRoasLowProfit.map((c: any) => (
                        <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-amber-50 border border-amber-200" data-testid={`highlight-high-roas-${c.id}`}>
                          <div>
                            <p className="font-medium text-sm">{c.name}</p>
                            <p className="text-xs text-muted-foreground">
                              ROAS: {c.roas.toFixed(2)}x · Spend: {fmtCurrency(c.spend)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-amber-700">{fmtCurrency(c.profitAfterAds)}</p>
                            <p className="text-xs text-muted-foreground">กำไร</p>
                          </div>
                        </div>
                      ))}
                      <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50/50 border border-dashed border-amber-200">
                        <Lightbulb className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                        <p className="text-xs text-amber-700">
                          แคมเปญเหล่านี้มี ROAS สูง ({">"} 3x) แต่กำไรจริงต่ำ อาจเป็นเพราะ margin สินค้าน้อย พิจารณาปรับสินค้าที่โปรโมท หรือเพิ่มราคาขาย
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card data-testid="card-good-profit-low-roas">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-blue-600">
                    <BarChart3 className="h-5 w-5" />
                    กำไรดี แต่ ROAS ต่ำ
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {highlights.goodProfitLowRoas.length === 0 ? (
                    <p className="text-muted-foreground text-sm py-4 text-center" data-testid="text-no-good-profit-low-roas">ไม่พบแคมเปญในกลุ่มนี้</p>
                  ) : (
                    <div className="space-y-3">
                      {highlights.goodProfitLowRoas.map((c: any) => (
                        <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-blue-50 border border-blue-200" data-testid={`highlight-good-profit-${c.id}`}>
                          <div>
                            <p className="font-medium text-sm">{c.name}</p>
                            <p className="text-xs text-muted-foreground">
                              ROAS: {c.roas.toFixed(2)}x · Spend: {fmtCurrency(c.spend)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-green-600">{fmtCurrency(c.profitAfterAds)}</p>
                            <p className="text-xs text-muted-foreground">กำไร</p>
                          </div>
                        </div>
                      ))}
                      <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50/50 border border-dashed border-blue-200">
                        <Lightbulb className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                        <p className="text-xs text-blue-700">
                          แคมเปญเหล่านี้ทำกำไรได้ดี ({">"} ฿500) แต่ ROAS ต่ำกว่า 2x พิจารณาลดค่าโฆษณาหรือ optimize targeting เพื่อเพิ่ม ROAS
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card data-testid="card-budget-recommendations">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-purple-600">
                  <Zap className="h-5 w-5" />
                  คำแนะนำการจัดสรรงบโฆษณา
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg bg-green-50 border border-green-200" data-testid="card-recommendation-increase">
                    <div className="flex items-center gap-2 mb-2">
                      <ArrowUpRight className="h-5 w-5 text-green-600" />
                      <h4 className="font-semibold text-green-700 text-sm">เพิ่มงบ</h4>
                    </div>
                    {sortedCampaigns.filter((c: any) => c.roas >= 3 && c.profitAfterAds > 100).length > 0 ? (
                      <ul className="space-y-1">
                        {sortedCampaigns
                          .filter((c: any) => c.roas >= 3 && c.profitAfterAds > 100)
                          .slice(0, 3)
                          .map((c: any) => (
                            <li key={c.id} className="text-xs text-green-700" data-testid={`rec-increase-${c.id}`}>
                              • {c.name} (ROAS {c.roas.toFixed(1)}x, กำไร {fmtCurrency(c.profitAfterAds)})
                            </li>
                          ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-green-600">ยังไม่มีแคมเปญที่แนะนำเพิ่มงบ</p>
                    )}
                  </div>

                  <div className="p-4 rounded-lg bg-yellow-50 border border-yellow-200" data-testid="card-recommendation-optimize">
                    <div className="flex items-center gap-2 mb-2">
                      <Target className="h-5 w-5 text-yellow-600" />
                      <h4 className="font-semibold text-yellow-700 text-sm">ปรับปรุง</h4>
                    </div>
                    {sortedCampaigns.filter((c: any) => c.roas >= 1 && c.roas < 3).length > 0 ? (
                      <ul className="space-y-1">
                        {sortedCampaigns
                          .filter((c: any) => c.roas >= 1 && c.roas < 3)
                          .slice(0, 3)
                          .map((c: any) => (
                            <li key={c.id} className="text-xs text-yellow-700" data-testid={`rec-optimize-${c.id}`}>
                              • {c.name} (ROAS {c.roas.toFixed(1)}x)
                            </li>
                          ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-yellow-600">ยังไม่มีแคมเปญที่ต้องปรับปรุง</p>
                    )}
                  </div>

                  <div className="p-4 rounded-lg bg-red-50 border border-red-200" data-testid="card-recommendation-stop">
                    <div className="flex items-center gap-2 mb-2">
                      <ArrowDownRight className="h-5 w-5 text-red-600" />
                      <h4 className="font-semibold text-red-700 text-sm">พิจารณาหยุด</h4>
                    </div>
                    {sortedCampaigns.filter((c: any) => c.roas < 1 && c.spend > 0).length > 0 ? (
                      <ul className="space-y-1">
                        {sortedCampaigns
                          .filter((c: any) => c.roas < 1 && c.spend > 0)
                          .slice(0, 3)
                          .map((c: any) => (
                            <li key={c.id} className="text-xs text-red-700" data-testid={`rec-stop-${c.id}`}>
                              • {c.name} (ROAS {c.roas.toFixed(1)}x, ขาดทุน {fmtCurrency(Math.abs(c.profitAfterAds))})
                            </li>
                          ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-red-600">ไม่มีแคมเปญที่ขาดทุน</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </CILayout>
  );
}
