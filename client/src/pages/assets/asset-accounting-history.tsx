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
import { Search, BookOpen, CheckCircle, Clock } from "lucide-react";

const CATEGORY_NAMES: Record<string, string> = {
  "1701000": "ที่ดิน", "1702000": "อาคาร", "1702100": "ส่วนต่อเติมอาคาร",
  "1702200": "ส่วนต่อเติมอาคารระหว่างทำ",
  "1707000": "เครื่องตกแต่งและติดตั้ง", "1704000": "อุปกรณ์สำนักงาน",
  "1706000": "ยานพาหนะ", "1705000": "อุปกรณ์คอมพิวเตอร์",
  "1801000": "สินทรัพย์ไม่มีตัวตน", "1703000": "งานระหว่างก่อสร้าง",
  "1401": "ที่ดิน", "1411": "อาคาร", "1421": "ส่วนต่อเติมอาคาร",
  "1422": "ส่วนต่อเติมอาคารระหว่างทำ",
  "1431": "เครื่องตกแต่งและติดตั้ง", "1441": "อุปกรณ์สำนักงาน",
  "1451": "ยานพาหนะ", "1461": "อุปกรณ์คอมพิวเตอร์",
  "1501": "สินทรัพย์ไม่มีตัวตน", "1402": "งานระหว่างก่อสร้าง",
};

export default function AssetAccountingHistory() {
  const { selectedCompanyId } = useCompany();
  const { dateEra, dateFmt } = useDateSettings();
  const [search, setSearch] = useState("");
  const [filterPosted, setFilterPosted] = useState("all");
  const now = new Date();
  const [dateFrom, setDateFrom] = useState(`${now.getFullYear()}-01-01`);
  const [dateTo, setDateTo] = useState(`${now.getFullYear()}-12-31`);

  const { data: depreciations = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/fixed-assets/depreciations/by-company", selectedCompanyId],
    queryFn: async () => {
      const res = await fetch(`/api/fixed-assets/depreciations/by-company?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedCompanyId,
  });

  const filtered = useMemo(() => {
    return depreciations.filter((d: any) => {
      if (dateFrom && d.periodDate < dateFrom) return false;
      if (dateTo && d.periodDate > dateTo) return false;
      if (filterPosted === "posted" && !d.posted) return false;
      if (filterPosted === "unposted" && d.posted) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!d.assetName?.toLowerCase().includes(s) && !d.assetCode?.toLowerCase().includes(s)) return false;
      }
      return true;
    }).sort((a: any, b: any) => a.periodDate.localeCompare(b.periodDate));
  }, [depreciations, search, filterPosted, dateFrom, dateTo]);

  const totalDepAmount = filtered.reduce((s: number, d: any) => s + parseFloat(d.depreciationAmount || "0"), 0);
  const postedCount = filtered.filter((d: any) => d.posted).length;
  const unpostedCount = filtered.filter((d: any) => !d.posted).length;

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5" style={{ color: "var(--theme-primary)" }} />
          <h1 className="text-xl font-bold text-gray-800" data-testid="text-page-title">ประวัติการลงบัญชี</h1>
          <Badge variant="outline" className="text-xs">{filtered.length} รายการ</Badge>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" style={{ color: "var(--theme-primary)" }} />
              <span className="text-sm text-muted-foreground">รวมค่าเสื่อมราคา</span>
            </div>
            <p className="text-xl font-bold mt-1" data-testid="text-total-dep">{formatNumber(totalDepAmount)}</p>
          </Card>
          <Card className="p-3 border-green-200 bg-green-50">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">ลงบัญชีแล้ว</span>
              <span className="ml-auto text-lg font-bold text-green-600" data-testid="text-posted-count">{postedCount}</span>
            </div>
          </Card>
          <Card className="p-3 border-amber-200 bg-amber-50">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              <span className="text-sm text-muted-foreground">ยังไม่ลงบัญชี</span>
              <span className="ml-auto text-lg font-bold text-amber-600" data-testid="text-unposted-count">{unpostedCount}</span>
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
              <Select value={filterPosted} onValueChange={setFilterPosted}>
                <SelectTrigger className="w-40 h-9" data-testid="select-posted">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  <SelectItem value="posted">ลงบัญชีแล้ว</SelectItem>
                  <SelectItem value="unposted">ยังไม่ลงบัญชี</SelectItem>
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
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">ไม่พบประวัติการลงบัญชีในช่วงเวลาที่เลือก</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="text-sm font-semibold">#</TableHead>
                      <TableHead className="text-sm font-semibold">งวด</TableHead>
                      <TableHead className="text-sm font-semibold">วันที่</TableHead>
                      <TableHead className="text-sm font-semibold">รหัสทรัพย์สิน</TableHead>
                      <TableHead className="text-sm font-semibold">ชื่อทรัพย์สิน</TableHead>
                      <TableHead className="text-sm font-semibold">หมวด</TableHead>
                      <TableHead className="text-sm font-semibold text-right">ค่าเสื่อมราคา</TableHead>
                      <TableHead className="text-sm font-semibold text-right">ค่าเสื่อมสะสม</TableHead>
                      <TableHead className="text-sm font-semibold text-right">มูลค่าตามบัญชี</TableHead>
                      <TableHead className="text-sm font-semibold">สถานะ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((d: any, i: number) => (
                      <TableRow key={d.id} data-testid={`row-dep-${d.id}`}>
                        <TableCell className="text-sm">{i + 1}</TableCell>
                        <TableCell className="text-sm">{d.period}</TableCell>
                        <TableCell className="text-sm">{formatDate(d.periodDate, dateFmt, dateEra)}</TableCell>
                        <TableCell className="text-sm font-mono">{d.assetCode || "-"}</TableCell>
                        <TableCell className="text-sm">{d.assetName || "-"}</TableCell>
                        <TableCell className="text-sm">{CATEGORY_NAMES[d.categoryAccountCode] || d.categoryAccountCode || "-"}</TableCell>
                        <TableCell className="text-sm text-right">{formatNumber(parseFloat(d.depreciationAmount || "0"))}</TableCell>
                        <TableCell className="text-sm text-right">{formatNumber(parseFloat(d.accumDepreciation || "0"))}</TableCell>
                        <TableCell className="text-sm text-right">{formatNumber(parseFloat(d.netBookValue || "0"))}</TableCell>
                        <TableCell>
                          {d.posted ? (
                            <Badge className="text-xs bg-green-100 text-green-700 border-green-300">
                              <CheckCircle className="h-3 w-3 mr-1" />ลงบัญชีแล้ว
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                              <Clock className="h-3 w-3 mr-1" />รอลงบัญชี
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-gray-50 font-semibold">
                      <TableCell colSpan={6} className="text-sm text-right">รวมทั้งสิ้น</TableCell>
                      <TableCell className="text-sm text-right">{formatNumber(totalDepAmount)}</TableCell>
                      <TableCell colSpan={3}></TableCell>
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
