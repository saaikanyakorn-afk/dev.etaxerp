import Layout from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Printer } from "lucide-react";
import { useState, useRef } from "react";
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

export default function TaxAttachmentPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const companyId = useHrCompanyId();
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
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
  const lastDay = new Date(Number(year), Number(month), 0).getDate();
  const payDate = `${lastDay}/${month.padStart(2, "0")}/${yearBE}`;

  const handlePrint = () => {
    if (!printRef.current) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html><html><head><title>ใบแนบภาษี - ${monthLabel} ${yearBE}</title>
      <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap" rel="stylesheet">
      <style>* { margin: 0; padding: 0; box-sizing: border-box; } body { font-family: 'Sarabun', sans-serif; padding: 20px; }
      table { width: 100%; border-collapse: collapse; } th, td { border: 1px solid #333; padding: 4px 6px; font-size: 11px; }
      th { background: #f5f5f5; font-weight: bold; } .text-right { text-align: right; } .text-center { text-align: center; }
      @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }</style>
      </head><body>${printRef.current.innerHTML}</body></html>
    `);
    printWindow.document.close();
    printWindow.onload = () => { printWindow.print(); };
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <FileText className="h-6 w-6" style={{ color: "#fb9678" }} />
            <h1 className="text-2xl font-bold" data-testid="text-page-title">ใบแนบภาษี (แบบ ภงด.1)</h1>
          </div>
          <div className="flex items-center gap-2">
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
            <Button onClick={handlePrint} variant="outline" data-testid="button-print-attachment">
              <Printer className="h-4 w-4 mr-2" />พิมพ์ใบแนบ
            </Button>
          </div>
        </div>

        <Card className="shadow-sm border-none">
          <CardContent className="p-6">
            <div ref={printRef}>
              <div className="text-center mb-4">
                <h2 className="text-lg font-bold">ใบแนบ ภ.ง.ด.1</h2>
                <p className="text-sm text-gray-600">ประจำเดือน {monthLabel} พ.ศ. {yearBE}</p>
                <p className="text-sm mt-1"><span className="font-bold">ผู้จ่ายเงินได้:</span> {company?.name || "-"} | <span className="font-bold">เลขประจำตัว:</span> {company?.taxId || "-"}</p>
              </div>

              {records.length > 0 ? (
                <>
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="text-[10px] font-bold text-center w-10">ลำดับ</TableHead>
                        <TableHead className="text-[10px] font-bold">ชื่อ-นามสกุล</TableHead>
                        <TableHead className="text-[10px] font-bold">เลขบัตรประชาชน</TableHead>
                        <TableHead className="text-[10px] font-bold">ที่อยู่</TableHead>
                        <TableHead className="text-[10px] font-bold text-center">วัน เดือน ปี ที่จ่าย</TableHead>
                        <TableHead className="text-[10px] font-bold text-right">จำนวนเงินได้</TableHead>
                        <TableHead className="text-[10px] font-bold text-right">จำนวนภาษีที่หัก</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {records.map((r: any, i: number) => {
                        const emp = employees.find((e: any) => e.id === r.employeeId);
                        return (
                          <TableRow key={r.id || i} data-testid={`row-attach-${r.employeeId}`}>
                            <TableCell className="text-[11px] text-center">{i + 1}</TableCell>
                            <TableCell className="text-[11px]" data-testid={`text-attach-name-${r.employeeId}`}>{emp?.fullName || "-"}</TableCell>
                            <TableCell className="text-[11px]" data-testid={`text-attach-id-${r.employeeId}`}>{emp?.idCardNumber || "-"}</TableCell>
                            <TableCell className="text-[11px]" data-testid={`text-attach-addr-${r.employeeId}`}>{emp?.address || "-"}</TableCell>
                            <TableCell className="text-[11px] text-center">{payDate}</TableCell>
                            <TableCell className="text-[11px] text-right" data-testid={`text-attach-income-${r.employeeId}`}>{fmt(Number(r.totalEarnings))}</TableCell>
                            <TableCell className="text-[11px] text-right" data-testid={`text-attach-tax-${r.employeeId}`}>{fmt(Number(r.withholdingTax))}</TableCell>
                          </TableRow>
                        );
                      })}
                      <TableRow className="bg-slate-100 font-bold">
                        <TableCell colSpan={5} className="text-[11px]">รวม ({records.length} ราย)</TableCell>
                        <TableCell className="text-[11px] text-right" style={{ color: "#05b187" }} data-testid="text-attach-total-income">{fmt(totalEarnings)}</TableCell>
                        <TableCell className="text-[11px] text-right" style={{ color: "#f94d4d" }} data-testid="text-attach-total-tax">{fmt(totalTax)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </>
              ) : (
                <p className="text-center py-12 text-muted-foreground">ยังไม่มีข้อมูลเงินเดือนสำหรับเดือนนี้</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
