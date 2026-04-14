import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCompany } from "@/lib/company-context";
import { formatDate, formatNumber } from "@/lib/format";
import { useDateSettings } from "@/hooks/use-date-settings";
import ThaiDateInput from "@/components/thai-date-input";
import { Search, TrendingDown, TrendingUp, Minus, DollarSign } from "lucide-react";

const CATEGORY_NAMES: Record<string, string> = {
  "1401": "ที่ดิน", "1411": "อาคาร", "1421": "ส่วนต่อเติมอาคาร",
  "1422": "ส่วนต่อเติมอาคารระหว่างทำ",
  "1431": "เครื่องตกแต่งและติดตั้ง", "1441": "อุปกรณ์สำนักงาน",
  "1451": "ยานพาหนะ", "1461": "อุปกรณ์คอมพิวเตอร์",
  "1501": "สินทรัพย์ไม่มีตัวตน", "1402": "งานระหว่างก่อสร้าง",
};

export default function AssetSalesReport() {
  const { selectedCompanyId } = useCompany();
  const { dateEra, dateFmt } = useDateSettings();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const now = new Date();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState(now.toISOString().slice(0, 10));

  const { data: assets = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/fixed-assets", selectedCompanyId],
    queryFn: async () => {
      const res = await fetch(`/api/fixed-assets?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedCompanyId,
  });

  const disposed = useMemo(() => {
    return assets.filter((a: any) => {
      if (a.status !== "disposed" || !a.disposalDate) return false;
      if (a.disposalDate < dateFrom || a.disposalDate > dateTo) return false;
      if (categoryFilter !== "all" && a.categoryAccountCode !== categoryFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!a.name?.toLowerCase().includes(s) && !a.assetCode?.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [assets, search, categoryFilter, dateFrom, dateTo]);

  const totalCost = disposed.reduce((s: number, a: any) => s + parseFloat(a.cost || "0"), 0);
  const totalSalePrice = disposed.reduce((s: number, a: any) => s + parseFloat(a.disposalPrice || "0"), 0);
  const totalGainLoss = disposed.reduce((s: number, a: any) => s + parseFloat(a.disposalGainLoss || "0"), 0);

  const categories = useMemo(() => {
    const cats = new Set(assets.map((a: any) => a.categoryAccountCode));
    return Array.from(cats).sort();
  }, [assets]);

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-[var(--theme-primary)]" />
          <h1 className="text-xl font-bold text-gray-800" data-testid="text-page-title">รายงานการขายทรัพย์สิน</h1>
          <Badge variant="outline" className="text-xs">{disposed.length} รายการ</Badge>
        </div>

        <Card className="rounded-xl border shadow-sm bg-white">
          <CardHeader className="p-4 border-b bg-white">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="ค้นหารหัส / ชื่อ..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9 h-9"
                  data-testid="input-search"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-44 h-9" data-testid="select-category">
                  <SelectValue placeholder="หมวดหมู่" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกหมวด</SelectItem>
                  {categories.map(c => (
                    <SelectItem key={c} value={c}>{CATEGORY_NAMES[c] || c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">จาก</span>
                <ThaiDateInput value={dateFrom} onChange={setDateFrom} dateEra={dateEra} dateFmt={dateFmt} className="h-9 w-[160px]" data-testid="input-date-from" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">ถึง</span>
                <ThaiDateInput value={dateTo} onChange={setDateTo} dateEra={dateEra} dateFmt={dateFmt} className="h-9 w-[160px]" data-testid="input-date-to" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">กำลังโหลด...</div>
            ) : disposed.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">ไม่พบรายการขาย/จำหน่ายทรัพย์สินในช่วงเวลาที่เลือก</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="text-sm font-semibold">#</TableHead>
                      <TableHead className="text-sm font-semibold">รหัส</TableHead>
                      <TableHead className="text-sm font-semibold">ชื่อทรัพย์สิน</TableHead>
                      <TableHead className="text-sm font-semibold">หมวด</TableHead>
                      <TableHead className="text-sm font-semibold">วันที่จำหน่าย</TableHead>
                      <TableHead className="text-sm font-semibold text-right">ราคาทุน</TableHead>
                      <TableHead className="text-sm font-semibold text-right">ค่าเสื่อมสะสม</TableHead>
                      <TableHead className="text-sm font-semibold text-right">มูลค่าตามบัญชี</TableHead>
                      <TableHead className="text-sm font-semibold text-right">ราคาขาย</TableHead>
                      <TableHead className="text-sm font-semibold text-right">กำไร/ขาดทุน</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {disposed.map((a: any, i: number) => {
                      const gl = parseFloat(a.disposalGainLoss || "0");
                      return (
                        <TableRow key={a.id} data-testid={`row-asset-${a.id}`}>
                          <TableCell className="text-sm">{i + 1}</TableCell>
                          <TableCell className="text-sm font-mono">{a.assetCode}</TableCell>
                          <TableCell className="text-sm">{a.name}</TableCell>
                          <TableCell className="text-sm">{CATEGORY_NAMES[a.categoryAccountCode] || a.categoryAccountCode}</TableCell>
                          <TableCell className="text-sm">{formatDate(a.disposalDate, dateEra, dateFmt)}</TableCell>
                          <TableCell className="text-sm text-right">{formatNumber(parseFloat(a.cost || "0"))}</TableCell>
                          <TableCell className="text-sm text-right">{formatNumber(parseFloat(a.accumDepreciation || "0"))}</TableCell>
                          <TableCell className="text-sm text-right">{formatNumber(parseFloat(a.netBookValue || "0"))}</TableCell>
                          <TableCell className="text-sm text-right">{formatNumber(parseFloat(a.disposalPrice || "0"))}</TableCell>
                          <TableCell className="text-sm text-right">
                            <span className={`inline-flex items-center gap-1 ${gl > 0 ? "text-green-600" : gl < 0 ? "text-red-600" : "text-gray-500"}`}>
                              {gl > 0 ? <TrendingUp className="h-3 w-3" /> : gl < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                              {formatNumber(Math.abs(gl))}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow className="bg-gray-50 font-semibold">
                      <TableCell colSpan={5} className="text-sm text-right">รวมทั้งสิ้น</TableCell>
                      <TableCell className="text-sm text-right">{formatNumber(totalCost)}</TableCell>
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                      <TableCell className="text-sm text-right">{formatNumber(totalSalePrice)}</TableCell>
                      <TableCell className="text-sm text-right">
                        <span className={totalGainLoss > 0 ? "text-green-600" : totalGainLoss < 0 ? "text-red-600" : ""}>
                          {formatNumber(Math.abs(totalGainLoss))}
                          {totalGainLoss > 0 ? " (กำไร)" : totalGainLoss < 0 ? " (ขาดทุน)" : ""}
                        </span>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
