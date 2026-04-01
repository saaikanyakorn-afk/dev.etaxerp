import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useCompany } from "@/lib/company-context";
import { formatNumber } from "@/lib/format";
import { BarChart3, Package, TrendingDown, DollarSign, AlertTriangle } from "lucide-react";

const CATEGORY_NAMES: Record<string, string> = {
  "1401": "ที่ดิน", "1411": "อาคาร", "1421": "ส่วนต่อเติมอาคาร",
  "1422": "ส่วนต่อเติมอาคารระหว่างทำ",
  "1431": "เครื่องตกแต่งและติดตั้ง", "1441": "อุปกรณ์สำนักงาน",
  "1451": "ยานพาหนะ", "1461": "อุปกรณ์คอมพิวเตอร์",
  "1501": "สินทรัพย์ไม่มีตัวตน", "1402": "งานระหว่างก่อสร้าง",
};

export default function AssetSummary() {
  const { selectedCompanyId } = useCompany();

  const { data: assets = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/fixed-assets", selectedCompanyId],
    queryFn: async () => {
      const res = await fetch(`/api/fixed-assets?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedCompanyId,
  });

  const activeAssets = assets.filter((a: any) => a.status === "active");
  const disposedAssets = assets.filter((a: any) => a.status === "disposed");

  const totalCost = activeAssets.reduce((s: number, a: any) => s + parseFloat(a.cost || "0"), 0);
  const totalAccumDep = activeAssets.reduce((s: number, a: any) => s + parseFloat(a.accumDepreciation || "0"), 0);
  const totalNBV = activeAssets.reduce((s: number, a: any) => s + parseFloat(a.netBookValue || "0"), 0);

  const categoryGroups = useMemo(() => {
    const groups: Record<string, { count: number; cost: number; accumDep: number; nbv: number }> = {};
    activeAssets.forEach((a: any) => {
      const cat = a.categoryAccountCode || "other";
      if (!groups[cat]) groups[cat] = { count: 0, cost: 0, accumDep: 0, nbv: 0 };
      groups[cat].count++;
      groups[cat].cost += parseFloat(a.cost || "0");
      groups[cat].accumDep += parseFloat(a.accumDepreciation || "0");
      groups[cat].nbv += parseFloat(a.netBookValue || "0");
    });
    return Object.entries(groups).sort((a, b) => b[1].cost - a[1].cost);
  }, [activeAssets]);

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-[var(--theme-primary)]" />
          <h1 className="text-xl font-bold text-gray-800" data-testid="text-page-title">สรุปรายการทรัพย์สิน</h1>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Package className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">ทรัพย์สินทั้งหมด</span>
            </div>
            <p className="text-2xl font-bold" data-testid="text-total-count">{activeAssets.length}</p>
            <p className="text-xs text-muted-foreground">จำหน่ายแล้ว {disposedAssets.length} รายการ</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">ราคาทุนรวม</span>
            </div>
            <p className="text-2xl font-bold" data-testid="text-total-cost">{formatNumber(totalCost)}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="h-4 w-4 text-amber-500" />
              <span className="text-sm text-muted-foreground">ค่าเสื่อมสะสม</span>
            </div>
            <p className="text-2xl font-bold" data-testid="text-total-dep">{formatNumber(totalAccumDep)}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="h-4 w-4 text-[var(--theme-primary)]" />
              <span className="text-sm text-muted-foreground">มูลค่าตามบัญชี</span>
            </div>
            <p className="text-2xl font-bold" data-testid="text-total-nbv">{formatNumber(totalNBV)}</p>
          </Card>
        </div>

        <Card className="rounded-xl border shadow-sm bg-white">
          <CardHeader className="p-4 border-b bg-white">
            <CardTitle className="text-base font-semibold">สรุปตามหมวดหมู่</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">กำลังโหลด...</div>
            ) : categoryGroups.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">ไม่พบข้อมูลทรัพย์สิน</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="text-sm font-semibold">รหัสหมวด</TableHead>
                      <TableHead className="text-sm font-semibold">หมวดหมู่</TableHead>
                      <TableHead className="text-sm font-semibold text-center">จำนวน</TableHead>
                      <TableHead className="text-sm font-semibold text-right">ราคาทุน</TableHead>
                      <TableHead className="text-sm font-semibold text-right">ค่าเสื่อมสะสม</TableHead>
                      <TableHead className="text-sm font-semibold text-right">มูลค่าตามบัญชี</TableHead>
                      <TableHead className="text-sm font-semibold text-right">% ของทุนทั้งหมด</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categoryGroups.map(([cat, data]) => (
                      <TableRow key={cat} data-testid={`row-category-${cat}`}>
                        <TableCell className="text-sm font-mono">{cat}</TableCell>
                        <TableCell className="text-sm">{CATEGORY_NAMES[cat] || cat}</TableCell>
                        <TableCell className="text-sm text-center">{data.count}</TableCell>
                        <TableCell className="text-sm text-right">{formatNumber(data.cost)}</TableCell>
                        <TableCell className="text-sm text-right">{formatNumber(data.accumDep)}</TableCell>
                        <TableCell className="text-sm text-right">{formatNumber(data.nbv)}</TableCell>
                        <TableCell className="text-sm text-right">
                          <Badge variant="outline" className="text-xs">
                            {totalCost > 0 ? ((data.cost / totalCost) * 100).toFixed(1) : "0.0"}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-gray-50 font-semibold">
                      <TableCell colSpan={2} className="text-sm">รวมทั้งสิ้น</TableCell>
                      <TableCell className="text-sm text-center">{activeAssets.length}</TableCell>
                      <TableCell className="text-sm text-right">{formatNumber(totalCost)}</TableCell>
                      <TableCell className="text-sm text-right">{formatNumber(totalAccumDep)}</TableCell>
                      <TableCell className="text-sm text-right">{formatNumber(totalNBV)}</TableCell>
                      <TableCell className="text-sm text-right">
                        <Badge variant="outline" className="text-xs">100%</Badge>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {disposedAssets.length > 0 && (
          <Card className="rounded-xl border shadow-sm bg-white">
            <CardHeader className="p-4 border-b bg-white">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                ทรัพย์สินที่จำหน่ายแล้ว ({disposedAssets.length} รายการ)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs text-muted-foreground">ราคาทุนรวม</p>
                  <p className="text-lg font-bold">{formatNumber(disposedAssets.reduce((s: number, a: any) => s + parseFloat(a.cost || "0"), 0))}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">ราคาขายรวม</p>
                  <p className="text-lg font-bold">{formatNumber(disposedAssets.reduce((s: number, a: any) => s + parseFloat(a.disposalPrice || "0"), 0))}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">กำไร/ขาดทุนรวม</p>
                  <p className="text-lg font-bold">
                    {formatNumber(disposedAssets.reduce((s: number, a: any) => s + parseFloat(a.disposalGainLoss || "0"), 0))}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
