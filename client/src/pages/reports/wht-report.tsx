import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDate } from "@/lib/format";
import ReportLayout from "@/components/report-layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/lib/company-context";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileText, Search, Printer, RefreshCw, Upload } from "lucide-react";

import { useDateSettings } from "@/hooks/use-date-settings";
const MONTHS = [
  { value: "01", label: "มกราคม" },
  { value: "02", label: "กุมภาพันธ์" },
  { value: "03", label: "มีนาคม" },
  { value: "04", label: "เมษายน" },
  { value: "05", label: "พฤษภาคม" },
  { value: "06", label: "มิถุนายน" },
  { value: "07", label: "กรกฎาคม" },
  { value: "08", label: "สิงหาคม" },
  { value: "09", label: "กันยายน" },
  { value: "10", label: "ตุลาคม" },
  { value: "11", label: "พฤศจิกายน" },
  { value: "12", label: "ธันวาคม" },
];

const FORM_TYPES = [
  { value: "all", label: "ทั้งหมด" },
  { value: "pnd1a", label: "ภ.ง.ด.1ก" },
  { value: "pnd1a_special", label: "ภ.ง.ด.1ก พิเศษ" },
  { value: "pnd2", label: "ภ.ง.ด.2" },
  { value: "pnd3", label: "ภ.ง.ด.3" },
  { value: "pnd2a", label: "ภ.ง.ด.2ก" },
  { value: "pnd3a", label: "ภ.ง.ด.3ก" },
  { value: "pnd53", label: "ภ.ง.ด.53" },
];

const FORM_TYPE_MAP: Record<string, string> = {
  pnd1a: "ภ.ง.ด.1ก",
  pnd1a_special: "ภ.ง.ด.1ก พิเศษ",
  pnd2: "ภ.ง.ด.2",
  pnd3: "ภ.ง.ด.3",
  pnd2a: "ภ.ง.ด.2ก",
  pnd3a: "ภ.ง.ด.3ก",
  pnd53: "ภ.ง.ด.53",
  pnd1: "ภ.ง.ด.1",
};

function fmt(val: string | number | null | undefined): string {
  const n = parseFloat(String(val || "0"));
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}


function getDefaultYear(): string {
  return String(new Date().getFullYear() + 543);
}

function getDefaultMonth(): string {
  return String(new Date().getMonth() + 1).padStart(2, "0");
}

export default function WhtReport() {
  const { selectedCompany, selectedCompanyId } = useCompany();
  const companyId = selectedCompany?.id;
  const { toast } = useToast();

  const { dateEra, dateFmt } = useDateSettings();
  const { data: docSettings } = useQuery<any>({
    queryKey: ["/api/document-settings", selectedCompanyId],
    queryFn: async () => {
      if (!selectedCompanyId) return null;
      const res = await fetch(`/api/document-settings?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!selectedCompanyId,
  });
  const [month, setMonth] = useState(getDefaultMonth());
  const [year, setYear] = useState(getDefaultYear());
  const [formType, setFormType] = useState("all");
  const [searched, setSearched] = useState(false);

  const currentBEYear = new Date().getFullYear() + 543;
  const yearOptions = Array.from({ length: 5 }, (_, i) => String(currentBEYear - i));

  const { data: rows, isLoading, refetch } = useQuery<any[]>({
    queryKey: ["/api/reports/wht/summary", companyId, month, year, formType, searched],
    queryFn: async () => {
      if (!companyId || !searched) return [];
      const res = await fetch(`/api/reports/wht/summary?companyId=${companyId}&month=${month}&year=${year}&formType=${formType}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!companyId && searched,
  });

  const handleSearch = () => {
    setSearched(true);
    refetch();
  };

  const handleExport = async () => {
    if (!companyId) return;
    try {
      const res = await fetch(`/api/reports/wht/export?companyId=${companyId}&month=${month}&year=${year}&formType=${formType}`, { credentials: "include" });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: "ไม่สามารถดาวน์โหลดได้", description: err.message, variant: "destructive" });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const disposition = res.headers.get("content-disposition") || "";
      const match = disposition.match(/filename="(.+)"/);
      a.download = match ? match[1] : `WHT_${formType}_${year}_${month}.txt`;
      a.href = url;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "ดาวน์โหลดไฟล์สำเร็จ", description: "ไฟล์ .txt พร้อมนำเข้าโปรแกรม RD Prep" });
    } catch (err: any) {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    }
  };

  const handleRdDirectExport = async (exportFormType: string) => {
    if (!companyId) return;
    try {
      const endpoint = exportFormType === "pnd3" ? "pnd3" : exportFormType === "pnd53" ? "pnd53" : "pp36";
      const params = new URLSearchParams({ companyId: String(companyId), month, year });
      const res = await fetch(`/api/rd-direct/${endpoint}?${params}`, { credentials: "include" });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: "ไม่สามารถส่งออกได้", description: err.message, variant: "destructive" });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const disposition = res.headers.get("content-disposition") || "";
      const match = disposition.match(/filename="(.+)"/);
      a.download = match ? match[1] : `${endpoint.toUpperCase()}_${year}_${month}.txt`;
      a.href = url;
      a.click();
      URL.revokeObjectURL(url);
      const formLabel = exportFormType === "pnd3" ? "ภ.ง.ด.3" : exportFormType === "pnd53" ? "ภ.ง.ด.53" : "ภ.พ.36";
      toast({ title: "ส่งออกสำเร็จ", description: `ไฟล์ ${formLabel} (.txt) TIS-620 พร้อมนำเข้า RD Direct` });
    } catch (err: any) {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    }
  };

  const totalAmountPaid = (rows || []).reduce((sum, r) => sum + Number(r.amountPaid || 0), 0);
  const totalTaxWithheld = (rows || []).reduce((sum, r) => sum + Number(r.taxWithheld || 0), 0);
  const countPnd3 = (rows || []).filter(r => r.formType === "pnd3").length;
  const countPnd53 = (rows || []).filter(r => r.formType === "pnd53").length;

  const selectedMonthLabel = MONTHS.find(m => m.value === month)?.label || month;

  return (
    <ReportLayout title="รายงานภาษีหัก ณ ที่จ่าย" icon={<FileText className="h-5 w-5" />}>

        <Card className="flexy-card">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">เดือน</label>
                <Select value={month} onValueChange={setMonth}>
                  <SelectTrigger className="w-[160px] rounded-full" data-testid="select-month">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map(m => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">ปี พ.ศ.</label>
                <Select value={year} onValueChange={setYear}>
                  <SelectTrigger className="w-[120px] rounded-full" data-testid="select-year">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map(y => (
                      <SelectItem key={y} value={y}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">ประเภทแบบ</label>
                <Select value={formType} onValueChange={setFormType}>
                  <SelectTrigger className="w-[220px] rounded-full" data-testid="select-form-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FORM_TYPES.map(ft => (
                      <SelectItem key={ft.value} value={ft.value}>{ft.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleSearch} className="rounded-full bg-[#03c9d7] hover:bg-[#02b0bd] text-white" data-testid="button-search">
                <Search className="h-4 w-4 mr-1" /> ค้นหา
              </Button>
              {searched && rows && rows.length > 0 && (
                <>
                  <Button onClick={handleExport} className="rounded-full bg-[#05b187] hover:bg-[#049973] text-white ml-auto" data-testid="button-export-txt">
                    <Download className="h-4 w-4 mr-1" /> ดาวน์โหลด .txt (RD Prep)
                  </Button>
                  {(formType === "all" || formType === "pnd3") && countPnd3 > 0 && (
                    <Button onClick={() => handleRdDirectExport("pnd3")} className="rounded-full bg-[#e65100] hover:bg-[#bf4400] text-white" data-testid="button-rd-direct-pnd3">
                      <Upload className="h-4 w-4 mr-1" /> RD Direct ภ.ง.ด.3
                    </Button>
                  )}
                  {(formType === "all" || formType === "pnd53") && countPnd53 > 0 && (
                    <Button onClick={() => handleRdDirectExport("pnd53")} className="rounded-full bg-[#e65100] hover:bg-[#bf4400] text-white" data-testid="button-rd-direct-pnd53">
                      <Upload className="h-4 w-4 mr-1" /> RD Direct ภ.ง.ด.53
                    </Button>
                  )}
                </>
              )}
              {searched && (
                <Button onClick={() => handleRdDirectExport("pp36")} className="rounded-full bg-[#7b1fa2] hover:bg-[#6a1b9a] text-white" data-testid="button-rd-direct-pp36">
                  <Upload className="h-4 w-4 mr-1" /> RD Direct ภ.พ.36
                </Button>
              )}
            </div>
          </CardHeader>
        </Card>

        {searched && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="flexy-card">
                <CardContent className="pt-4 pb-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">จำนวนรายการ</p>
                  <p className="text-2xl font-bold text-[var(--theme-primary)]" data-testid="text-total-count">{(rows || []).length}</p>
                </CardContent>
              </Card>
              <Card className="flexy-card">
                <CardContent className="pt-4 pb-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">ภ.ง.ด.3 / ภ.ง.ด.53</p>
                  <p className="text-2xl font-bold" data-testid="text-form-count">
                    <span className="text-[#fb9678]">{countPnd3}</span>
                    <span className="text-muted-foreground mx-1">/</span>
                    <span className="text-[#03c9d7]">{countPnd53}</span>
                  </p>
                </CardContent>
              </Card>
              <Card className="flexy-card">
                <CardContent className="pt-4 pb-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">ยอดเงินที่จ่าย</p>
                  <p className="text-2xl font-bold text-[#fec90f]" data-testid="text-total-paid">{fmt(totalAmountPaid)}</p>
                </CardContent>
              </Card>
              <Card className="flexy-card">
                <CardContent className="pt-4 pb-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">ภาษีหัก ณ ที่จ่าย</p>
                  <p className="text-2xl font-bold text-[#f94d4d]" data-testid="text-total-tax">{fmt(totalTaxWithheld)}</p>
                </CardContent>
              </Card>
            </div>

            <Card className="flexy-card">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">รายการหนังสือรับรองหัก ณ ที่จ่าย - {selectedMonthLabel} {year}</p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="rounded-full text-xs border-green-400 text-green-600 hover:bg-green-50" onClick={() => refetch()} disabled={isLoading} data-testid="button-generate">
                      <RefreshCw className={`h-3.5 w-3.5 mr-1 ${isLoading ? "animate-spin" : ""}`} /> สร้างรายงาน
                    </Button>
                    {rows && rows.length > 0 && (
                      <Button variant="outline" size="sm" className="rounded-full text-xs" onClick={() => window.print()} data-testid="button-print">
                        <Printer className="h-3.5 w-3.5 mr-1" /> พิมพ์
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">กำลังโหลด...</div>
                ) : !rows || rows.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">
                    ไม่พบรายการหัก ณ ที่จ่ายในเดือน {selectedMonthLabel} {year}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead className="text-xs font-semibold w-10 text-center">#</TableHead>
                          <TableHead className="text-xs font-semibold">เลขที่</TableHead>
                          <TableHead className="text-xs font-semibold">วันที่จ่าย</TableHead>
                          <TableHead className="text-xs font-semibold">ประเภท</TableHead>
                          <TableHead className="text-xs font-semibold">ผู้รับเงิน</TableHead>
                          <TableHead className="text-xs font-semibold">เลขประจำตัวผู้เสียภาษี</TableHead>
                          <TableHead className="text-xs font-semibold">ประเภทเงินได้</TableHead>
                          <TableHead className="text-xs font-semibold text-right">อัตรา (%)</TableHead>
                          <TableHead className="text-xs font-semibold text-right">จำนวนเงินที่จ่าย</TableHead>
                          <TableHead className="text-xs font-semibold text-right">ภาษีที่หัก</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((cert: any, idx: number) => (
                          <TableRow key={cert.id} data-testid={`row-wht-${cert.id}`}>
                            <TableCell className="text-xs text-center text-muted-foreground">{idx + 1}</TableCell>
                            <TableCell className="text-sm font-medium">{cert.certNo}</TableCell>
                            <TableCell className="text-sm">{formatDate(cert.paidDate, dateEra, dateFmt)}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={cert.formType === "pnd53" ? "border-[#03c9d7] text-[#03c9d7]" : "border-[#fb9678] text-[#fb9678]"}>
                                {FORM_TYPE_MAP[cert.formType] || cert.formType}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">{cert.payeeName}</TableCell>
                            <TableCell className="text-sm font-mono text-muted-foreground">{cert.payeeTaxId || "-"}</TableCell>
                            <TableCell className="text-sm">{cert.incomeDescription || cert.incomeType || "-"}</TableCell>
                            <TableCell className="text-sm text-right">{Number(cert.taxRate || 0).toFixed(2)}</TableCell>
                            <TableCell className="text-sm text-right font-medium">{fmt(cert.amountPaid)}</TableCell>
                            <TableCell className="text-sm text-right font-medium text-[#f94d4d]">{fmt(cert.taxWithheld)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-slate-50 font-semibold">
                          <TableCell colSpan={8} className="text-sm text-right">รวมทั้งสิ้น</TableCell>
                          <TableCell className="text-sm text-right">{fmt(totalAmountPaid)}</TableCell>
                          <TableCell className="text-sm text-right text-[#f94d4d]">{fmt(totalTaxWithheld)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {rows && rows.length > 0 && (
              <Card className="flexy-card border-dashed border-[#05b187]">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#05b187]/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Download className="h-4 w-4 text-[#05b187]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold mb-1">วิธีใช้ไฟล์ .txt ยื่นภาษี</p>
                      <ol className="text-xs text-muted-foreground space-y-1 list-decimal pl-4">
                        <li>กดปุ่ม <span className="font-semibold text-[#e65100]">"RD Direct ภ.ง.ด.3/53"</span> หรือ <span className="font-semibold text-[#05b187]">"ดาวน์โหลด .txt (RD Prep)"</span> ด้านบน</li>
                        <li><span className="font-semibold text-[#e65100]">RD Direct:</span> ไฟล์ .txt เข้ารหัส TIS-620 พร้อม upload โดยตรงที่ rdirect.rd.go.th</li>
                        <li><span className="font-semibold text-[#05b187]">RD Prep:</span> เปิดโปรแกรม RD Prep จากเว็บกรมสรรพากร (efiling.rd.go.th)</li>
                        <li>เลือกรูปแบบตัวคั่น <span className="font-semibold">"|" (Pipe)</span> แล้วอัพโหลดไฟล์ .txt</li>
                        <li>จับคู่ข้อมูลแล้วกด "โอนย้าย" → ได้ไฟล์ .rdx สำหรับยื่นภาษี</li>
                      </ol>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
    </ReportLayout>
  );
}
