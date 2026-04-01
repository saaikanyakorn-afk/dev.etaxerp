import Layout from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Printer, Download } from "lucide-react";
import { useState, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useHrCompanyId } from "@/lib/company-context";

function getYearOptions() {
  const current = new Date().getFullYear();
  return [current - 1, current, current + 1].map(y => ({ value: String(y), label: String(y) }));
}

function fmt(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PND1APage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const companyId = useHrCompanyId();
  const [year, setYear] = useState(String(new Date().getFullYear()));
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

  const { data: yearRecords = [] } = useQuery<any[]>({
    queryKey: ["/api/payroll-records/year", companyId, year],
    queryFn: async () => {
      const r = await fetch(`/api/payroll-records/year?companyId=${companyId}&year=${year}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!companyId,
  });

  const annualSummary = useMemo(() => {
    const grouped: Record<number, { employeeId: number; totalEarnings: number; totalTax: number }> = {};
    for (const r of yearRecords) {
      const eid = r.employeeId;
      if (!grouped[eid]) grouped[eid] = { employeeId: eid, totalEarnings: 0, totalTax: 0 };
      grouped[eid].totalEarnings += Number(r.totalEarnings || 0);
      grouped[eid].totalTax += Number(r.withholdingTax || 0);
    }
    return Object.values(grouped);
  }, [yearRecords]);

  const grandTotalEarnings = annualSummary.reduce((s, r) => s + r.totalEarnings, 0);
  const grandTotalTax = annualSummary.reduce((s, r) => s + r.totalTax, 0);
  const yearBE = Number(year) + 543;

  const handlePrint = () => {
    if (!printRef.current) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html><html><head><title>ภงด.1ก - ปี ${yearBE}</title>
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
      const r = await fetch(`/api/payroll-records/rd-prep?companyId=${companyId}&year=${year}&type=pnd1a`, { credentials: "include" });
      if (!r.ok) { toast({ title: "ดาวน์โหลดไม่สำเร็จ", variant: "destructive" }); return; }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `PND1A_${year}.txt`;
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
            <h1 className="text-2xl font-bold" data-testid="text-page-title">ภงด.1ก แบบยื่นภาษีหัก ณ ที่จ่ายรายปี</h1>
          </div>
          <div className="flex items-center gap-2">
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
            <Button onClick={handlePrint} variant="outline" data-testid="button-print-pnd1a">
              <Printer className="h-4 w-4 mr-2" />พิมพ์ ภงด.1ก
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
                <h3 className="text-lg font-bold mt-1" style={{ color: "#fb9678" }}>ภ.ง.ด.1ก</h3>
                <p className="text-sm text-gray-600 mt-1">สำหรับปีภาษี พ.ศ. {yearBE}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6 text-sm border rounded-lg p-4 bg-gray-50">
                <div className="space-y-1">
                  <p><span className="font-bold">ผู้มีหน้าที่หักภาษี ณ ที่จ่าย:</span></p>
                  <p>{company?.name || "-"}</p>
                  <p><span className="font-bold">เลขประจำตัวผู้เสียภาษี:</span> {company?.taxId || "-"}</p>
                </div>
                <div className="space-y-1">
                  <p><span className="font-bold">ที่อยู่:</span> {company?.address || "-"}</p>
                  <p><span className="font-bold">ปีภาษี:</span> พ.ศ. {yearBE}</p>
                  <p><span className="font-bold">ประเภทเงินได้:</span> เงินเดือน ค่าจ้าง (ม.40(1))</p>
                </div>
              </div>

              {annualSummary.length > 0 ? (
                <>
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="text-xs font-bold text-center w-16">ลำดับ</TableHead>
                        <TableHead className="text-xs font-bold">ชื่อ-นามสกุล</TableHead>
                        <TableHead className="text-xs font-bold">เลขประจำตัวผู้เสียภาษี</TableHead>
                        <TableHead className="text-xs font-bold text-right">เงินได้ทั้งปี (บาท)</TableHead>
                        <TableHead className="text-xs font-bold text-right">ภาษีหัก ณ ที่จ่ายทั้งปี (บาท)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {annualSummary.map((r, i) => {
                        const emp = employees.find((e: any) => e.id === r.employeeId);
                        return (
                          <TableRow key={r.employeeId} data-testid={`row-pnd1a-${r.employeeId}`}>
                            <TableCell className="text-sm text-center">{i + 1}</TableCell>
                            <TableCell className="text-sm" data-testid={`text-pnd1a-name-${r.employeeId}`}>{emp?.fullName || "-"}</TableCell>
                            <TableCell className="text-sm" data-testid={`text-pnd1a-taxid-${r.employeeId}`}>{emp?.taxId || emp?.idCardNumber || "-"}</TableCell>
                            <TableCell className="text-sm text-right" data-testid={`text-pnd1a-income-${r.employeeId}`}>{fmt(r.totalEarnings)}</TableCell>
                            <TableCell className="text-sm text-right" data-testid={`text-pnd1a-tax-${r.employeeId}`}>{fmt(r.totalTax)}</TableCell>
                          </TableRow>
                        );
                      })}
                      <TableRow className="bg-slate-100 font-bold">
                        <TableCell colSpan={3} className="text-sm">รวม ({annualSummary.length} ราย)</TableCell>
                        <TableCell className="text-sm text-right" style={{ color: "#05b187" }} data-testid="text-pnd1a-total-income">{fmt(grandTotalEarnings)}</TableCell>
                        <TableCell className="text-sm text-right" style={{ color: "#f94d4d" }} data-testid="text-pnd1a-total-tax">{fmt(grandTotalTax)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>

                  <div className="mt-6 grid grid-cols-3 gap-4 text-sm">
                    <div className="border rounded-lg p-3 text-center">
                      <p className="text-muted-foreground text-xs">จำนวนราย</p>
                      <p className="text-xl font-bold" style={{ color: "#fb9678" }} data-testid="text-pnd1a-count">{annualSummary.length}</p>
                    </div>
                    <div className="border rounded-lg p-3 text-center">
                      <p className="text-muted-foreground text-xs">รวมเงินได้ทั้งปี</p>
                      <p className="text-xl font-bold" style={{ color: "#05b187" }}>฿{fmt(grandTotalEarnings)}</p>
                    </div>
                    <div className="border rounded-lg p-3 text-center">
                      <p className="text-muted-foreground text-xs">รวมภาษีทั้งปี</p>
                      <p className="text-xl font-bold" style={{ color: "#f94d4d" }}>฿{fmt(grandTotalTax)}</p>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-center py-12 text-muted-foreground">ยังไม่มีข้อมูลเงินเดือนสำหรับปีนี้</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
