import Layout from "@/components/layout";
import { objectPathToUrl } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, Printer, Eye } from "lucide-react";
import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useHrCompanyId } from "@/lib/company-context";
import { formatDate } from "@/lib/format";

import { useDateSettings } from "@/hooks/use-date-settings";
const MONTHS = [
  { value: "1", label: "มกราคม" }, { value: "2", label: "กุมภาพันธ์" },
  { value: "3", label: "มีนาคม" }, { value: "4", label: "เมษายน" },
  { value: "5", label: "พฤษภาคม" }, { value: "6", label: "มิถุนายน" },
  { value: "7", label: "กรกฎาคม" }, { value: "8", label: "สิงหาคม" },
  { value: "9", label: "กันยายน" }, { value: "10", label: "ตุลาคม" },
  { value: "11", label: "พฤศจิกายน" }, { value: "12", label: "ธันวาคม" },
];

function fmt(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function numberToThaiText(num: number): string {
  const units = ["", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
  const positions = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน", "ล้าน"];
  if (num === 0) return "ศูนย์บาทถ้วน";
  const intPart = Math.floor(num);
  const decPart = Math.round((num - intPart) * 100);
  let result = "";
  const str = String(intPart);
  const len = str.length;
  for (let i = 0; i < len; i++) {
    const digit = parseInt(str[i]);
    const pos = len - i - 1;
    if (digit === 0) continue;
    if (pos === 1 && digit === 1) { result += "สิบ"; continue; }
    if (pos === 1 && digit === 2) { result += "ยี่สิบ"; continue; }
    if (pos === 0 && digit === 1 && len > 1) { result += "เอ็ด"; continue; }
    result += units[digit] + positions[pos];
  }
  result += "บาท";
  if (decPart === 0) {
    result += "ถ้วน";
  } else {
    const decStr = String(decPart).padStart(2, "0");
    const d1 = parseInt(decStr[0]);
    const d2 = parseInt(decStr[1]);
    if (d1 === 1) result += "สิบ";
    else if (d1 === 2) result += "ยี่สิบ";
    else if (d1 > 0) result += units[d1] + "สิบ";
    if (d2 === 1 && d1 > 0) result += "เอ็ด";
    else if (d2 > 0) result += units[d2];
    result += "สตางค์";
  }
  return result;
}

function CertificatePreview({ employee, company, month, year, dateEra, dateFmt, logoUrl }: { employee: any; company: any; month: string; year: string; dateEra: string; dateFmt: string; logoUrl?: string }) {
  const monthLabel = MONTHS.find(m => m.value === month)?.label || "";
  const yearBE = Number(year) + 543;
  const today = new Date();
  const todayStr = `${today.getDate()} ${MONTHS[today.getMonth()]?.label || ""} ${today.getFullYear() + 543}`;
  const salary = Number(employee.baseSalary) || 0;

  return (
    <div className="salary-cert-page" style={{ width: "210mm", minHeight: "297mm", fontFamily: "'Sarabun', sans-serif", fontSize: "14px", padding: "15mm 20mm", lineHeight: 1.8, background: "white", color: "black", position: "relative", boxSizing: "border-box", margin: "0 auto" }}>
      <style>{`@media print { @page { size: A4 portrait; margin: 10mm; } body { background: white !important; } .salary-cert-page { width: 100% !important; min-height: auto !important; padding: 10mm 15mm !important; border: none !important; } }`}</style>
      <div style={{ textAlign: "center", marginBottom: "24px" }}>
        {logoUrl && <img src={logoUrl} alt="Company Logo" style={{ maxHeight: "70px", objectFit: "contain", marginBottom: "8px" }} />}
        <h2 style={{ fontSize: "20px", fontWeight: "bold", color: "#1a365d" }}>{company?.name || "บริษัท"}</h2>
        {company?.address && <p style={{ fontSize: "13px", color: "#555", marginTop: "4px" }}>{company.address}</p>}
        {company?.taxId && <p style={{ fontSize: "13px", color: "#555" }}>เลขประจำตัวผู้เสียภาษี: {company.taxId}</p>}
      </div>
      <div style={{ textAlign: "center", marginBottom: "32px" }}>
        <h3 style={{ fontSize: "18px", fontWeight: "bold", textDecoration: "underline" }}>หนังสือรับรองเงินเดือน</h3>
        <p style={{ fontSize: "13px", color: "#666", marginTop: "4px" }}>Salary Certificate</p>
      </div>
      <div style={{ fontSize: "14px", lineHeight: 2 }}>
        <p style={{ textIndent: "4em" }}>
          หนังสือฉบับนี้ออกให้เพื่อรับรองว่า <strong>{employee.fullName}</strong>{" "}
          รหัสพนักงาน <strong>{employee.employeeCode}</strong>{" "}
          ตำแหน่ง <strong>{employee.position || "-"}</strong>{" "}
          แผนก <strong>{employee.department || "-"}</strong>{" "}
          เป็นพนักงานของ <strong>{company?.name || "บริษัท"}</strong>{" "}
          ตั้งแต่วันที่ <strong>{formatDate(employee.startDate, dateEra, dateFmt)}</strong> - จนถึงปัจจุบัน
        </p>
        <p style={{ textIndent: "4em", marginTop: "8px" }}>
          ณ เดือน{monthLabel} พ.ศ. {yearBE} ได้รับเงินเดือน เดือนละ <strong>{fmt(salary)}</strong> บาท ({numberToThaiText(salary)})
        </p>
        <p style={{ textIndent: "4em", marginTop: "8px" }}>
          หนังสือฉบับนี้ออกให้เพื่อใช้ในการติดต่อธุรกรรมทั่วไป โดยบริษัทไม่รับผิดชอบในหนี้สินหรือภาระผูกพันใดๆ ที่พนักงานผู้นี้อาจก่อขึ้น
        </p>
      </div>
      <div style={{ marginTop: "48px", textAlign: "right", paddingRight: "20px" }}>
        <p>ออกให้ ณ วันที่ {todayStr}</p>
        <div style={{ marginTop: "60px", textAlign: "center", display: "inline-block", width: "200px" }}>
          <div style={{ borderBottom: "1px solid #666", width: "100%", marginBottom: "8px" }}></div>
          <p style={{ fontSize: "13px" }}>ลงชื่อ ผู้มีอำนาจลงนาม</p>
          <p style={{ fontSize: "12px", color: "#888", marginTop: "4px" }}>(ตราประทับบริษัท)</p>
        </div>
      </div>
    </div>
  );
}

export default function SalaryCertificate() {
  const { user } = useAuth();
  const companyId = useHrCompanyId();
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));

  const { data: employees = [] } = useQuery<any[]>({
    queryKey: ["/api/employees", companyId],
    queryFn: async () => {
      const r = await fetch(`/api/employees?companyId=${companyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!user && !!companyId,
  });

  const { data: companies = [] } = useQuery<any[]>({
    queryKey: ["/api/companies"],
    queryFn: async () => {
      const r = await fetch("/api/companies", { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!user,
  });

  const { dateEra, dateFmt } = useDateSettings();
  const { data: docSettings } = useQuery<any>({
    queryKey: ["/api/document-settings", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const res = await fetch(`/api/document-settings?companyId=${companyId}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!companyId,
  });
  const company = companies.find((c: any) => c.id === companyId) || companies[0];
  const emp = employees.find((e: any) => String(e.id) === selectedEmployee);

  function handlePrint() {
    if (!printRef.current) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html><head><title>หนังสือรับรองเงินเดือน - ${emp?.fullName || ""}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Sarabun', 'Noto Sans Thai', sans-serif; }
        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      </style></head><body>
      ${printRef.current.innerHTML}
      </body></html>
    `);
    win.document.close();
    win.print();
  }

  return (
    <Layout>
      <div className="space-y-6">
        <Card className="flexy-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2" data-testid="page-title-salary-cert">
              <FileText className="w-5 h-5" style={{ color: "#fb9678" }} />
              หนังสือรับรองเงินเดือน (Salary Certificate)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div>
                <label className="text-sm font-medium mb-1 block">เลือกพนักงาน</label>
                <Select value={selectedEmployee} onValueChange={setSelectedEmployee} data-testid="select-employee-salary-cert">
                  <SelectTrigger data-testid="trigger-employee-salary-cert">
                    <SelectValue placeholder="-- เลือกพนักงาน --" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((e: any) => (
                      <SelectItem key={e.id} value={String(e.id)} data-testid={`option-employee-${e.id}`}>
                        {e.employeeCode} - {e.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">เดือน</label>
                <Select value={month} onValueChange={setMonth} data-testid="select-month-salary-cert">
                  <SelectTrigger data-testid="trigger-month-salary-cert">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map(m => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">ปี</label>
                <Select value={year} onValueChange={setYear} data-testid="select-year-salary-cert">
                  <SelectTrigger data-testid="trigger-year-salary-cert">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => (
                      <SelectItem key={y} value={String(y)}>{y + 543}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2">
                <Button
                  onClick={() => setPreviewOpen(true)}
                  disabled={!emp}
                  className="text-white"
                  style={{ backgroundColor: "#fb9678" }}
                  data-testid="btn-preview-salary-cert"
                >
                  <Eye className="w-4 h-4 mr-1" /> ดูตัวอย่าง
                </Button>
                <Button
                  onClick={handlePrint}
                  disabled={!emp}
                  variant="outline"
                  style={{ borderColor: "#fb9678", color: "#fb9678" }}
                  data-testid="btn-print-salary-cert"
                >
                  <Printer className="w-4 h-4 mr-1" /> พิมพ์
                </Button>
              </div>
            </div>

            {!emp && (
              <div className="text-center py-12 text-gray-400" data-testid="empty-state-salary-cert">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>กรุณาเลือกพนักงานเพื่อออกหนังสือรับรองเงินเดือน</p>
              </div>
            )}

            {emp && (
              <div ref={printRef}>
                <CertificatePreview employee={emp} company={company} month={month} year={year} dateEra={dateEra} dateFmt={dateFmt} logoUrl={docSettings?.showLogo !== false ? objectPathToUrl(docSettings?.logoUrl) || undefined : undefined} />
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="dialog-preview-salary-cert">
            <DialogHeader>
              <DialogTitle>ตัวอย่างหนังสือรับรองเงินเดือน</DialogTitle>
            </DialogHeader>
            {emp && <CertificatePreview employee={emp} company={company} month={month} year={year} dateEra={dateEra} dateFmt={dateFmt} logoUrl={docSettings?.showLogo !== false ? objectPathToUrl(docSettings?.logoUrl) || undefined : undefined} />}
            <div className="flex justify-end gap-2 mt-4">
              <Button
                onClick={handlePrint}
                className="text-white"
                style={{ backgroundColor: "#fb9678" }}
                data-testid="btn-print-preview-salary-cert"
              >
                <Printer className="w-4 h-4 mr-1" /> พิมพ์
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
