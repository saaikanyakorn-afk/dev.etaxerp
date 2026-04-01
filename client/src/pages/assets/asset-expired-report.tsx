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
import { Search, AlertTriangle, Clock } from "lucide-react";

const CATEGORY_NAMES: Record<string, string> = {
  "1401": "ที่ดิน", "1411": "อาคาร", "1421": "ส่วนต่อเติมอาคาร",
  "1422": "ส่วนต่อเติมอาคารระหว่างทำ",
  "1431": "เครื่องตกแต่งและติดตั้ง", "1441": "อุปกรณ์สำนักงาน",
  "1451": "ยานพาหนะ", "1461": "อุปกรณ์คอมพิวเตอร์",
  "1501": "สินทรัพย์ไม่มีตัวตน", "1402": "งานระหว่างก่อสร้าง",
};

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

export default function AssetExpiredReport() {
  const { selectedCompanyId } = useCompany();
  const { dateEra, dateFmt } = useDateSettings();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showMode, setShowMode] = useState<"expired" | "expiring_soon" | "all">("all");

  const { data: assets = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/fixed-assets", selectedCompanyId],
    queryFn: async () => {
      const res = await fetch(`/api/fixed-assets?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedCompanyId,
  });

  const todayStr = new Date().toISOString().slice(0, 10);
  const threeMonthsLater = addMonths(todayStr, 3);

  const filtered = useMemo(() => {
    return assets.filter((a: any) => {
      if (a.status === "disposed") return false;
      const endDate = addMonths(a.startDepreciationDate, a.usefulLifeMonths);
      const isExpired = endDate <= todayStr;
      const isExpiringSoon = !isExpired && endDate <= threeMonthsLater;

      if (showMode === "expired" && !isExpired) return false;
      if (showMode === "expiring_soon" && !isExpiringSoon) return false;
      if (showMode === "all" && !isExpired && !isExpiringSoon) return false;

      if (categoryFilter !== "all" && a.categoryAccountCode !== categoryFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!a.name?.toLowerCase().includes(s) && !a.assetCode?.toLowerCase().includes(s)) return false;
      }
      return true;
    }).map((a: any) => ({
      ...a,
      endDate: addMonths(a.startDepreciationDate, a.usefulLifeMonths),
      isExpired: addMonths(a.startDepreciationDate, a.usefulLifeMonths) <= todayStr,
    }));
  }, [assets, search, categoryFilter, showMode, todayStr, threeMonthsLater]);

  const categories = useMemo(() => {
    const cats = new Set(assets.filter((a: any) => a.status !== "disposed").map((a: any) => a.categoryAccountCode));
    return Array.from(cats).sort();
  }, [assets]);

  const expiredCount = filtered.filter(a => a.isExpired).length;
  const expiringCount = filtered.filter(a => !a.isExpired).length;

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <h1 className="text-xl font-bold text-gray-800" data-testid="text-page-title">รายงานทรัพย์สินหมดอายุ</h1>
          <Badge variant="outline" className="text-xs">{filtered.length} รายการ</Badge>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Card className="p-3 border-red-200 bg-red-50">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="text-sm font-medium text-red-700">หมดอายุแล้ว</span>
              <span className="ml-auto text-lg font-bold text-red-600" data-testid="text-expired-count">{expiredCount}</span>
            </div>
          </Card>
          <Card className="p-3 border-amber-200 bg-amber-50">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-medium text-amber-700">ใกล้หมดอายุ (3 เดือน)</span>
              <span className="ml-auto text-lg font-bold text-amber-600" data-testid="text-expiring-count">{expiringCount}</span>
            </div>
          </Card>
        </div>

        <Card className="rounded-xl border shadow-sm bg-white">
          <CardHeader className="p-4 border-b bg-white">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="ค้นหารหัส / ชื่อ..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" data-testid="input-search" />
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
              <Select value={showMode} onValueChange={(v: any) => setShowMode(v)}>
                <SelectTrigger className="w-40 h-9" data-testid="select-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  <SelectItem value="expired">หมดอายุแล้ว</SelectItem>
                  <SelectItem value="expiring_soon">ใกล้หมดอายุ</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">กำลังโหลด...</div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">ไม่พบทรัพย์สินที่หมดอายุหรือใกล้หมดอายุ</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="text-sm font-semibold">#</TableHead>
                      <TableHead className="text-sm font-semibold">รหัส</TableHead>
                      <TableHead className="text-sm font-semibold">ชื่อทรัพย์สิน</TableHead>
                      <TableHead className="text-sm font-semibold">หมวด</TableHead>
                      <TableHead className="text-sm font-semibold">วันที่เริ่มคิดค่าเสื่อม</TableHead>
                      <TableHead className="text-sm font-semibold">อายุ (เดือน)</TableHead>
                      <TableHead className="text-sm font-semibold">วันที่หมดอายุ</TableHead>
                      <TableHead className="text-sm font-semibold text-right">ราคาทุน</TableHead>
                      <TableHead className="text-sm font-semibold text-right">ค่าเสื่อมสะสม</TableHead>
                      <TableHead className="text-sm font-semibold text-right">มูลค่าตามบัญชี</TableHead>
                      <TableHead className="text-sm font-semibold">สถานะ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((a: any, i: number) => (
                      <TableRow key={a.id} data-testid={`row-asset-${a.id}`}>
                        <TableCell className="text-sm">{i + 1}</TableCell>
                        <TableCell className="text-sm font-mono">{a.assetCode}</TableCell>
                        <TableCell className="text-sm">{a.name}</TableCell>
                        <TableCell className="text-sm">{CATEGORY_NAMES[a.categoryAccountCode] || a.categoryAccountCode}</TableCell>
                        <TableCell className="text-sm">{formatDate(a.startDepreciationDate, dateFmt, dateEra)}</TableCell>
                        <TableCell className="text-sm text-center">{a.usefulLifeMonths}</TableCell>
                        <TableCell className="text-sm">{formatDate(a.endDate, dateFmt, dateEra)}</TableCell>
                        <TableCell className="text-sm text-right">{formatNumber(parseFloat(a.cost || "0"))}</TableCell>
                        <TableCell className="text-sm text-right">{formatNumber(parseFloat(a.accumDepreciation || "0"))}</TableCell>
                        <TableCell className="text-sm text-right">{formatNumber(parseFloat(a.netBookValue || "0"))}</TableCell>
                        <TableCell>
                          {a.isExpired ? (
                            <Badge variant="destructive" className="text-xs">หมดอายุ</Badge>
                          ) : (
                            <Badge className="text-xs bg-amber-100 text-amber-700 border-amber-300">ใกล้หมดอายุ</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
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
