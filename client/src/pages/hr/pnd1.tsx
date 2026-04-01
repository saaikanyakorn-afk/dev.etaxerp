import Layout from "@/components/layout";
import ThaiDateInput from "@/components/thai-date-input";
import { useDateSettings } from "@/hooks/use-date-settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText, Printer, Download } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useHrCompanyId } from "@/lib/company-context";

const MONTHS = [
  { value: "1", label: "มกราคม" }, { value: "2", label: "กุมภาพันธ์" },
  { value: "3", label: "มีนาคม" }, { value: "4", label: "เมษายน" },
  { value: "5", label: "พฤษภาคม" }, { value: "6", label: "มิถุนายน" },
  { value: "7", label: "กรกฎาคม" }, { value: "8", label: "สิงหาคม" },
  { value: "9", label: "กันยายน" }, { value: "10", label: "ตุลาคม" },
  { value: "11", label: "พฤศจิกายน" }, { value: "12", label: "ธันวาคม" },
];

function getYearOptions() {
  const current = new Date().getFullYear();
  return [current - 1, current, current + 1].map(y => ({ value: String(y), label: String(y) }));
}

function fmt(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PND1Page() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { dateEra, dateFmt } = useDateSettings();
  const companyId = useHrCompanyId();
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [payDate, setPayDate] = useState("");
  const printRef = useRef<HTMLDivElement>(null);

  const { data: company } = useQuery<any>({
    queryKey: ["/api/companies", companyId],
    queryFn: async () => {
      const r = await fetch(`/api/companies/${companyId}`, { credentials: "include" });
      if (!r.ok) return null;
      return r.json();
    },
    enabled: !!companyId,
  });

  const { data: employees = [] } = useQuery<any[]>({
    queryKey: ["/api/employees", companyId],
    queryFn: async () => {
      const r = await fetch(`/api/employees?companyId=${companyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!user && !!companyId,
  });

  const { data: records = [] } = useQuery<any[]>({
    queryKey: ["/api/payroll-records", companyId, month, year],
    queryFn: async () => {
      const r = await fetch(`/api/payroll-records?companyId=${companyId}&month=${month}&year=${year}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!companyId,
  });

  const totalEarnings = records.reduce((s: number, r: any) => s + Number(r.totalEarnings || 0), 0);
  const totalTax = records.reduce((s: number, r: any) => s + Number(r.withholdingTax || 0), 0);
  const yearBE = Number(year) + 543;
  const monthLabel = MONTHS.find(m => m.value === month)?.label || "";

  const handlePrint = () => {
    if (!printRef.current) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html><html><head><title>ภงด.1 - ${monthLabel} ${yearBE}</title>
      <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap" rel="stylesheet">
      <style>* { margin: 0; padding: 0; box-sizing: border-box; } body { font-family: 'Sarabun', sans-serif; padding: 20px; }
      table { width: 100%; border-collapse: collapse; } th, td { border: 1px solid #333; padding: 6px 8px; font-size: 12px; }
      th { background: #f5f5f5; font-weight: bold; } .text-right { text-align: right; } .text-center { text-align: center; }
      @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }</style>
      </head><body>${printRef.current.innerHTML}</body></html>
    `);
    printWindow.document.close();
    printWindow.onload = () => { printWindow.print(); };
  };

  const handleDownloadRDPrep = async () => {
    try {
      const params = new URLSearchParams({ companyId: String(companyId), month, year, type: "pnd1" });
      if (payDate) params.set("payDate", payDate);
      const r = await fetch(`/api/payroll-records/rd-prep?${params}`, { credentials: "include" });
      if (!r.ok) { toast({ title: "ดาวน์โหลดไม่สำเร็จ", variant: "destructive" }); return; }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `PND1_${year}_${month}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "ดาวน์โหลดไม่สำเร็จ", variant: "destructive" });
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <FileText className="h-6 w-6" style={{ color: "#fb9678" }} />
            <h1 className="text-2xl font-bold" data-testid="text-page-title">ภงด.1 แบบยื่นภาษีหัก ณ ที่จ่ายรายเดือน</h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="w-36" data-testid="select-month">
                <SelectValue placeholder="เดือน" />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map(m => (
                  <SelectItem key={m.value} value={m.value} data-testid={`option-month-${m.value}`}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="w-24" data-testid="select-year">
                <SelectValue placeholder="ปี" />
              </SelectTrigger>
              <SelectContent>
                {getYearOptions().map(y => (
                  <SelectItem key={y.value} value={y.value} data-testid={`option-year-${y.value}`}>{y.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1">
              <Label className="text-sm whitespace-nowrap">วันจ่าย:</Label>
              <ThaiDateInput value={payDate} onChange={setPayDate} dateEra={dateEra} dateFmt={dateFmt} className="w-44" data-testid="input-pay-date" />
            </div>
            <Button onClick={handlePrint} variant="outline" data-testid="button-print-pnd1">
              <Printer className="h-4 w-4 mr-2" />พิมพ์ ภงด.1
            </Button>
            <Button onClick={handleDownloadRDPrep} variant="outline" style={{ borderColor: "var(--theme-primary)", color: "var(--theme-primary)" }} data-testid="button-download-rdprep">
              <Download className="h-4 w-4 mr-2" />ดาวน์โหลด RD Prep
            </Button>
          </div>
        </div>

        <Card className="shadow-sm border-none">
          <CardContent className="p-6">
            <div ref={printRef}>
              <div className="text-center mb-6">
                <h2 className="text-xl font-bold">แบบยื่นรายการภาษีเงินได้หัก ณ ที่จ่าย</h2>
                <h3 className="text-lg font-bold mt-1" style={{ color: "#fb9678" }}>ภ.ง.ด.1</h3>
                <p className="text-sm text-gray-600 mt-1">ตามมาตรา 59 แห่งประมวลรัษฎากร</p>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6 text-sm border rounded-lg p-4 bg-gray-50">
                <div className="space-y-1">
                  <p><span className="font-bold">ผู้มีหน้าที่หักภาษี ณ ที่จ่าย:</span></p>
                  <p>{company?.name || "-"}</p>
                  <p><span className="font-bold">เลขประจำตัวผู้เสียภาษี:</span> {company?.taxId || "-"}</p>
                </div>
                <div className="space-y-1">
                  <p><span className="font-bold">ที่อยู่:</span> {company?.address || "-"}</p>
                  <p><span className="font-bold">เดือนภาษี:</span> {monthLabel} พ.ศ. {yearBE}</p>
                  <p><span className="font-bold">ประเภทเงินได้:</span> เงินเดือน ค่าจ้าง (ม.40(1))</p>
                </div>
              </div>

              {records.length > 0 ? (
                <>
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="text-xs font-bold text-center w-16">ลำดับ</TableHead>
                        <TableHead className="text-xs font-bold">ชื่อ-นามสกุล</TableHead>
                        <TableHead className="text-xs font-bold">เลขประจำตัวผู้เสียภาษี</TableHead>
                        <TableHead className="text-xs font-bold text-right">เงินได้ (บาท)</TableHead>
                        <TableHead className="text-xs font-bold text-right">ภาษีหัก ณ ที่จ่าย (บาท)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {records.map((r: any, i: number) => {
                        const emp = employees.find((e: any) => e.id === r.employeeId);
                        return (
                          <TableRow key={r.id || i} data-testid={`row-pnd1-${r.employeeId}`}>
                            <TableCell className="text-sm text-center">{i + 1}</TableCell>
                            <TableCell className="text-sm" data-testid={`text-pnd1-name-${r.employeeId}`}>{emp?.fullName || "-"}</TableCell>
                            <TableCell className="text-sm" data-testid={`text-pnd1-taxid-${r.employeeId}`}>{emp?.taxId || emp?.idCardNumber || "-"}</TableCell>
                            <TableCell className="text-sm text-right" data-testid={`text-pnd1-income-${r.employeeId}`}>{fmt(Number(r.totalEarnings))}</TableCell>
                            <TableCell className="text-sm text-right" data-testid={`text-pnd1-tax-${r.employeeId}`}>{fmt(Number(r.withholdingTax))}</TableCell>
                          </TableRow>
                        );
                      })}
                      <TableRow className="bg-slate-100 font-bold">
                        <TableCell colSpan={3} className="text-sm">
                          รวม ({records.length} ราย)
                        </TableCell>
                        <TableCell className="text-sm text-right" data-testid="text-pnd1-total-income" style={{ color: "#05b187" }}>{fmt(totalEarnings)}</TableCell>
                        <TableCell className="text-sm text-right" data-testid="text-pnd1-total-tax" style={{ color: "#f94d4d" }}>{fmt(totalTax)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>

                  <div className="mt-6 grid grid-cols-3 gap-4 text-sm">
                    <div className="border rounded-lg p-3 text-center">
                      <p className="text-muted-foreground text-xs">จำนวนราย</p>
                      <p className="text-xl font-bold" style={{ color: "#fb9678" }} data-testid="text-pnd1-count">{records.length}</p>
                    </div>
                    <div className="border rounded-lg p-3 text-center">
                      <p className="text-muted-foreground text-xs">รวมเงินได้</p>
                      <p className="text-xl font-bold" style={{ color: "#05b187" }}>฿{fmt(totalEarnings)}</p>
                    </div>
                    <div className="border rounded-lg p-3 text-center">
                      <p className="text-muted-foreground text-xs">รวมภาษี</p>
                      <p className="text-xl font-bold" style={{ color: "#f94d4d" }}>฿{fmt(totalTax)}</p>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-center py-12 text-muted-foreground">ยังไม่มีข้อมูลเงินเดือนสำหรับเดือนนี้ กรุณาคำนวณและบันทึกข้อมูลเงินเดือนก่อน</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
