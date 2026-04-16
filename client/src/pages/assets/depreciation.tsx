import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/lib/company-context";
import { apiRequest } from "@/lib/queryClient";
import { formatNumber, formatDate } from "@/lib/format";
import { Calculator, BookOpen, Search, FileSpreadsheet, Loader2, Download } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";

import { useDateSettings } from "@/hooks/use-date-settings";
const CATEGORY_NAMES: Record<string, string> = {
  "1401": "ที่ดิน", "1411": "อาคาร", "1421": "ส่วนต่อเติมอาคาร",
  "1422": "ส่วนต่อเติมอาคารระหว่างทำ",
  "1431": "เครื่องตกแต่งและติดตั้ง", "1441": "อุปกรณ์สำนักงาน",
  "1451": "ยานพาหนะ", "1461": "อุปกรณ์คอมพิวเตอร์",
  "1501": "สินทรัพย์ไม่มีตัวตน", "1402": "งานระหว่างก่อสร้าง",
};


export default function DepreciationPage() {
  const { selectedCompanyId } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const now = new Date();
  const yearStart = `${now.getFullYear()}-01-01`;
  const yearEnd = `${now.getFullYear()}-12-31`;
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState(yearEnd);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDept, setFilterDept] = useState("__all__");
  const [filterCategory, setFilterCategory] = useState("__all__");
  const [calcResult, setCalcResult] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [showPostDialog, setShowPostDialog] = useState(false);
  const [postEntryDate, setPostEntryDate] = useState(toDate);
  const pageSize = 50;

  const { dateEra, dateFmt } = useDateSettings();
  const { data: docSettings, error: docSettingsError } = useQuery<any>({
    queryKey: ["/api/document-settings", selectedCompanyId],
    queryFn: async () => {
      if (!selectedCompanyId) throw new Error("ไม่พบ companyId");
      const res = await fetch(`/api/document-settings?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!res.ok) {
        const errText = await res.text().catch(() => res.statusText);
        throw new Error(`โหลด document-settings ล้มเหลว (${res.status}): ${errText}`);
      }
      return res.json();
    },
    enabled: !!selectedCompanyId,
    retry: false,
  });
  const { data: assetCategories = [], error: assetCategoriesError } = useQuery<any[]>({
    queryKey: ["/api/asset-categories", selectedCompanyId],
    queryFn: async () => {
      if (!selectedCompanyId) throw new Error("ไม่พบ companyId");
      const res = await fetch(`/api/asset-categories?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!res.ok) {
        const errText = await res.text().catch(() => res.statusText);
        throw new Error(`โหลด asset-categories ล้มเหลว (${res.status}): ${errText}`);
      }
      return res.json();
    },
    enabled: !!selectedCompanyId,
    retry: false,
  });

  if (docSettingsError || assetCategoriesError) {
    const err = docSettingsError || assetCategoriesError;
    return (
      <Layout>
        <div className="min-h-[60vh] flex items-center justify-center p-6">
          <Card className="max-w-2xl w-full border-red-300 bg-red-50">
            <CardHeader>
              <CardTitle className="text-red-700 text-lg">⚠️ เกิดข้อผิดพลาด — ระบบจะออกจากระบบเพื่อความปลอดภัย</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-white p-3 rounded border border-red-200">
                <div className="text-xs text-muted-foreground mb-1">รายละเอียด error (กรุณาแคปหน้าจอนี้แล้วแจ้งทีมพัฒนา):</div>
                <div className="font-mono text-xs text-red-800 break-all" data-testid="text-error-detail">
                  {(err as any)?.message || String(err)}
                </div>
              </div>
              <div className="text-sm text-gray-700">
                หน้าคำนวณค่าเสื่อมไม่สามารถโหลดข้อมูลตั้งต้นได้ — กรุณาแจ้งทีมพัฒนาทันทีเพื่อตรวจสอบสาเหตุที่แท้จริง
              </div>
              <Button
                variant="destructive"
                className="w-full"
                onClick={async () => {
                  await fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => {});
                  window.location.href = "/login";
                }}
                data-testid="button-force-logout"
              >
                ออกจากระบบทันที
              </Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  const calculateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/fixed-assets/batch/calculate", {
        companyId: selectedCompanyId, fromDate, toDate,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setCalcResult(data);
      setCurrentPage(1);
    },
    onError: (err: any) => {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    },
  });

  const postMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/fixed-assets/batch/post-journal", {
        companyId: selectedCompanyId, fromDate, toDate, entryDate: postEntryDate,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setShowPostDialog(false);
      if (data.message && (data.postedCount || 0) === 0) {
        toast({ title: "แจ้งเตือน", description: data.message });
      } else {
        const skipped = data.skippedItems?.length || 0;
        const skippedZero = data.skippedZero || 0;
        let desc = `สร้างสมุดรายวัน ${data.journalEntryIds?.length || 0} รายการ (${data.postedCount || 0} สินทรัพย์)`;
        if (skipped > 0) desc += ` | ข้ามไป ${skipped} รายการ`;
        if (skippedZero > 0) desc += ` | ข้ามทรัพย์สินหมดอายุ ${skippedZero} รายการ`;
        toast({ title: "ลงบัญชีค่าเสื่อมราคาสำเร็จ", description: desc, ...(skipped > 0 ? { variant: "destructive" as const } : {}) });
      }
      calculateMutation.mutate();
    },
    onError: (err: any) => {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    },
  });

  const results: any[] = calcResult?.results || [];

  const departments = useMemo(() => {
    const depts = new Set<string>();
    results.forEach((r: any) => { if (r.department) depts.add(r.department); });
    return Array.from(depts).sort();
  }, [results]);

  const categoriesUsed = useMemo(() => {
    const cats = new Set<string>();
    results.forEach((r: any) => { if (r.categoryAccountCode) cats.add(r.categoryAccountCode); });
    return Array.from(cats).sort();
  }, [results]);

  const filteredResults = useMemo(() => {
    let filtered = results;
    if (filterDept !== "__all__") filtered = filtered.filter((r: any) => r.department === filterDept);
    if (filterCategory !== "__all__") filtered = filtered.filter((r: any) => r.categoryAccountCode === filterCategory);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter((r: any) =>
        (r.assetCode || "").toLowerCase().includes(term) ||
        (r.assetName || "").toLowerCase().includes(term)
      );
    }
    return filtered;
  }, [results, filterDept, filterCategory, searchTerm]);

  const totals = useMemo(() => {
    let totalCost = 0, totalAccumBF = 0, totalDep = 0, totalAccum = 0, totalNBV = 0, totalMonthly = 0;
    for (const r of filteredResults) {
      totalCost += r.cost || 0;
      totalAccumBF += r.accumDepreciationBF || 0;
      totalDep += r.depreciationInRange || 0;
      totalAccum += r.accumDepreciation || 0;
      totalNBV += r.netBookValue || 0;
      totalMonthly += r.monthlyDepreciation || 0;
    }
    return { totalCost, totalAccumBF, totalDep, totalAccum, totalNBV, totalMonthly };
  }, [filteredResults]);

  const journalPreview = useMemo(() => {
    const grouped: Record<string, { debit: string; debitName: string; credit: string; creditName: string; total: number; count: number }> = {};
    for (const r of results) {
      if (!r.depreciationInRange) continue;
      const depExpCode = r.depExpCode || assetCategories.find((c: any) => c.accountCode === r.categoryAccountCode)?.depExpCode;
      const accumCode = r.accumCode || assetCategories.find((c: any) => c.accountCode === r.categoryAccountCode)?.accumCode;
      if (!depExpCode || !accumCode) continue;
      const key = r.categoryAccountCode;
      if (!grouped[key]) {
        grouped[key] = {
          debit: depExpCode,
          debitName: `ค่าเสื่อมราคา - ${r.categoryName || CATEGORY_NAMES[key] || key}`,
          credit: accumCode,
          creditName: `ค่าเสื่อมราคาสะสม - ${r.categoryName || CATEGORY_NAMES[key] || key}`,
          total: 0,
          count: 0,
        };
      }
      grouped[key].total += r.depreciationInRange;
      grouped[key].count += 1;
    }
    return Object.entries(grouped).map(([cat, data]) => ({
      category: CATEGORY_NAMES[cat] || cat,
      ...data,
    }));
  }, [results, assetCategories]);

  const totalPages = Math.ceil(filteredResults.length / pageSize);
  const paginatedResults = filteredResults.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleExportExcel = () => {
    const link = document.createElement("a");
    link.href = `/api/fixed-assets/batch/export-excel?companyId=${selectedCompanyId}&fromDate=${fromDate}&toDate=${toDate}`;
    link.download = `depreciation_report_${fromDate}_${toDate}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Layout>
      <div className="space-y-4">
        <h1 className="text-xl font-heading font-bold" data-testid="text-page-title">รายงานค่าเสื่อมราคา</h1>

        <Card className="flexy-card">
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-end gap-3 flex-wrap">
              <div>
                <label className="text-sm font-medium mb-1 block">วันที่คำนวณ</label>
                <div className="flex items-center gap-2">
                  <DatePicker
                    value={fromDate}
                    onChange={setFromDate}
                    dateFormat={dateFmt}
                    dateEra={dateEra}
                    className="w-[160px] rounded-lg h-9 text-sm"
                    data-testid="input-from-date"
                  />
                  <span className="text-sm text-muted-foreground">ถึง</span>
                  <DatePicker
                    value={toDate}
                    onChange={setToDate}
                    dateFormat={dateFmt}
                    dateEra={dateEra}
                    className="w-[160px] rounded-lg h-9 text-sm"
                    data-testid="input-to-date"
                  />
                </div>
              </div>
              <Button
                style={{ background: "var(--theme-primary)" }} className="hover:opacity-90 text-white rounded-lg"
                onClick={() => calculateMutation.mutate()}
                disabled={calculateMutation.isPending || !selectedCompanyId}
                data-testid="button-search"
              >
                {calculateMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Search className="h-4 w-4 mr-1" />}
                ค้นหา
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">แผนก</label>
                <Select value={filterDept} onValueChange={setFilterDept}>
                  <SelectTrigger className="rounded-lg" data-testid="select-department">
                    <SelectValue placeholder="ทั้งหมด" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">ทั้งหมด</SelectItem>
                    {departments.map(d => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">หมวดหมู่สินทรัพย์</label>
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="rounded-lg" data-testid="select-category">
                    <SelectValue placeholder="ทั้งหมด" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">ทั้งหมด</SelectItem>
                    {categoriesUsed.map(code => (
                      <SelectItem key={code} value={code}>{CATEGORY_NAMES[code] || code}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">คำค้นหา</label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9 rounded-lg"
                    placeholder="ค้นหา..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    data-testid="input-search"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {calcResult && (
          <Card className="flexy-card">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="text-sm text-muted-foreground" data-testid="text-total-count">
                  Total: <strong>{filteredResults.length}</strong> items
                  {totalPages > 1 && <span className="ml-3">หน้า: {currentPage} / {totalPages}</span>}
                </div>
                <div className="flex gap-2">
                  <Button
                    className="rounded-lg text-sm text-white"
                    style={{ background: "var(--theme-primary)" }}
                    onClick={() => setShowPostDialog(true)}
                    disabled={filteredResults.length === 0}
                    data-testid="button-post-journal"
                  >
                    <BookOpen className="h-4 w-4 mr-1" />
                    ลงบัญชีค่าเสื่อมราคา
                  </Button>
                  <Button
                    variant="outline"
                    className="border-[#05b187] text-[#05b187] rounded-lg text-sm"
                    onClick={handleExportExcel}
                    data-testid="button-export-excel"
                  >
                    <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow style={{ background: "var(--theme-table-header)" }}>
                      <TableHead className="text-white text-xs text-center w-[40px]">#</TableHead>
                      <TableHead className="text-white text-xs">แผนก</TableHead>
                      <TableHead className="text-white text-xs">รายการ</TableHead>
                      <TableHead className="text-white text-xs">หมวดหมู่สินทรัพย์</TableHead>
                      <TableHead className="text-white text-xs text-center">วันที่ซื้อ</TableHead>
                      <TableHead className="text-white text-xs text-center">วันสิ้นสุด</TableHead>
                      <TableHead className="text-white text-xs text-center">วันที่เริ่มค่าเสื่อม</TableHead>
                      <TableHead className="text-white text-xs text-right">มูลค่าสินทรัพย์</TableHead>
                      <TableHead className="text-white text-xs text-right">ค่าเสื่อมสะสมยกมา</TableHead>
                      <TableHead className="text-white text-xs text-right">มูลค่าค่าตัดจำหน่าย</TableHead>
                      <TableHead className="text-white text-xs text-right">ค่าเสื่อมสะสม</TableHead>
                      <TableHead className="text-white text-xs text-right">มูลค่าสุทธิ</TableHead>
                      <TableHead className="text-white text-xs text-right">ค่าเสื่อมเฉลี่ยต่อเดือน</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedResults.map((r: any, idx: number) => (
                      <TableRow key={r.assetId} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        <TableCell className="text-sm text-center" data-testid={`text-row-num-${r.assetId}`}>{(currentPage - 1) * pageSize + idx + 1}</TableCell>
                        <TableCell className="text-sm" data-testid={`text-dept-${r.assetId}`}>{r.department || "-"}</TableCell>
                        <TableCell className="text-sm" data-testid={`text-name-${r.assetId}`}>
                          <span className="text-blue-600">{r.assetCode}</span> / {r.assetName}
                        </TableCell>
                        <TableCell className="text-sm" data-testid={`text-category-${r.assetId}`}>{r.categoryName || CATEGORY_NAMES[r.categoryAccountCode] || r.categoryAccountCode}</TableCell>
                        <TableCell className="text-sm text-center" data-testid={`text-purchase-date-${r.assetId}`}>{formatDate(r.purchaseDate, dateEra, dateFmt)}</TableCell>
                        <TableCell className="text-sm text-center" data-testid={`text-end-date-${r.assetId}`}>{formatDate(r.endDepreciationDate, dateEra, dateFmt)}</TableCell>
                        <TableCell className="text-sm text-center" data-testid={`text-start-date-${r.assetId}`}>{formatDate(r.startDepreciationDate, dateEra, dateFmt)}</TableCell>
                        <TableCell className="text-sm text-right" data-testid={`text-cost-${r.assetId}`}>{formatNumber(r.cost)}</TableCell>
                        <TableCell className="text-sm text-right" data-testid={`text-accum-bf-${r.assetId}`}>{formatNumber(r.accumDepreciationBF)}</TableCell>
                        <TableCell className="text-sm text-right font-medium text-[var(--theme-primary)]" data-testid={`text-dep-${r.assetId}`}>{formatNumber(r.depreciationInRange)}</TableCell>
                        <TableCell className="text-sm text-right" data-testid={`text-accum-${r.assetId}`}>{formatNumber(r.accumDepreciation)}</TableCell>
                        <TableCell className="text-sm text-right font-medium text-[#05b187]" data-testid={`text-nbv-${r.assetId}`}>{formatNumber(r.netBookValue)}</TableCell>
                        <TableCell className="text-sm text-right" data-testid={`text-monthly-${r.assetId}`}>{formatNumber(r.monthlyDepreciation)}</TableCell>
                      </TableRow>
                    ))}
                    {filteredResults.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={13} className="text-center py-8 text-sm text-muted-foreground" data-testid="text-no-data">
                          {calcResult ? "ไม่พบรายการค่าเสื่อมราคาในช่วงที่เลือก" : "กรุณากดค้นหาเพื่อคำนวณค่าเสื่อมราคา"}
                        </TableCell>
                      </TableRow>
                    )}
                    {filteredResults.length > 0 && (
                      <TableRow className="bg-amber-50 font-bold border-t-2 border-[var(--theme-primary)] hover:bg-amber-50">
                        <TableCell colSpan={7} className="text-sm text-right" data-testid="text-total-label">รวม</TableCell>
                        <TableCell className="text-sm text-right" data-testid="text-total-cost">{formatNumber(totals.totalCost)}</TableCell>
                        <TableCell className="text-sm text-right" data-testid="text-total-accum-bf">{formatNumber(totals.totalAccumBF)}</TableCell>
                        <TableCell className="text-sm text-right" data-testid="text-total-dep">{formatNumber(totals.totalDep)}</TableCell>
                        <TableCell className="text-sm text-right" data-testid="text-total-accum">{formatNumber(totals.totalAccum)}</TableCell>
                        <TableCell className="text-sm text-right" data-testid="text-total-nbv">{formatNumber(totals.totalNBV)}</TableCell>
                        <TableCell className="text-sm text-right" data-testid="text-total-monthly">{formatNumber(totals.totalMonthly)}</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4" data-testid="pagination">
                  <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)} data-testid="button-prev-page">ก่อนหน้า</Button>
                  <span className="text-sm">หน้า {currentPage} / {totalPages}</span>
                  <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)} data-testid="button-next-page">ถัดไป</Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={showPostDialog} onOpenChange={setShowPostDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg">ตรวจสอบการลงบัญชีค่าเสื่อมราคา</DialogTitle>
            <DialogDescription>
              ช่วงวันที่ {formatDate(fromDate, dateEra, dateFmt)} ถึง {formatDate(toDate, dateEra, dateFmt)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="text-sm text-muted-foreground">
                สินทรัพย์ทั้งหมด <strong>{results.length}</strong> รายการ
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <label className="text-sm font-medium whitespace-nowrap">วันที่บันทึกบัญชี</label>
                <DatePicker
                  value={postEntryDate}
                  onChange={setPostEntryDate}
                  dateFormat={dateFmt}
                  dateEra={dateEra}
                  className="w-[160px] rounded-lg h-9 text-sm"
                  data-testid="input-post-entry-date"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow style={{ background: "var(--theme-table-header)" }}>
                    <TableHead className="text-white text-xs">หมวดหมู่</TableHead>
                    <TableHead className="text-white text-xs text-center">จำนวน</TableHead>
                    <TableHead className="text-white text-xs">เดบิต (ค่าใช้จ่าย)</TableHead>
                    <TableHead className="text-white text-xs">เครดิต (ค่าเสื่อมสะสม)</TableHead>
                    <TableHead className="text-white text-xs text-right">จำนวนเงิน</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {journalPreview.map((jp, idx) => (
                    <TableRow key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <TableCell className="text-sm">{jp.category}</TableCell>
                      <TableCell className="text-sm text-center">{jp.count}</TableCell>
                      <TableCell className="text-sm">
                        <span className="text-red-600 font-medium">{jp.debit}</span> {jp.debitName}
                      </TableCell>
                      <TableCell className="text-sm">
                        <span className="text-blue-600 font-medium">{jp.credit}</span> {jp.creditName}
                      </TableCell>
                      <TableCell className="text-sm text-right font-medium">{formatNumber(jp.total)}</TableCell>
                    </TableRow>
                  ))}
                  {journalPreview.length > 0 && (
                    <TableRow className="bg-amber-50 font-bold hover:bg-amber-50">
                      <TableCell colSpan={4} className="text-sm text-right">รวมทั้งหมด</TableCell>
                      <TableCell className="text-sm text-right">{formatNumber(journalPreview.reduce((s, j) => s + j.total, 0))}</TableCell>
                    </TableRow>
                  )}
                  {journalPreview.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-4 text-sm text-muted-foreground">ไม่มีรายการที่ต้องลงบัญชี</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowPostDialog(false)} data-testid="button-cancel-post">
              ยกเลิก
            </Button>
            <Button
              className="text-white"
              style={{ background: "var(--theme-primary)" }}
              onClick={() => postMutation.mutate()}
              disabled={postMutation.isPending || journalPreview.length === 0}
              data-testid="button-confirm-post"
            >
              {postMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <BookOpen className="h-4 w-4 mr-1" />}
              ยืนยันลงบัญชี
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
