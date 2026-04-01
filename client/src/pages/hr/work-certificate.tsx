import HRLayout from "@/components/hr-layout";
import { objectPathToUrl } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
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

function calcYearsMonths(startDate: string): string {
  if (!startDate) return "-";
  const start = new Date(startDate);
  const now = new Date();
  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();
  if (months < 0) { years--; months += 12; }
  if (years > 0 && months > 0) return `${years} ปี ${months} เดือน`;
  if (years > 0) return `${years} ปี`;
  return `${months} เดือน`;
}

function CertificatePreview({ employee, company, purpose, isCurrentEmployee, dateEra, dateFmt, logoUrl }: { employee: any; company: any; purpose: string; isCurrentEmployee: boolean; dateEra: string; dateFmt: string; logoUrl?: string }) {
  const today = new Date();
  const todayStr = `${today.getDate()} ${MONTHS[today.getMonth()]?.label || ""} ${today.getFullYear() + 543}`;

  return (
    <div className="work-cert-page" style={{ width: "210mm", minHeight: "297mm", fontFamily: "'Sarabun', sans-serif", fontSize: "14px", padding: "15mm 20mm", lineHeight: 1.8, background: "white", color: "black", position: "relative", boxSizing: "border-box", margin: "0 auto" }}>
      <style>{`@media print { @page { size: A4 portrait; margin: 10mm; } body { background: white !important; } .work-cert-page { width: 100% !important; min-height: auto !important; padding: 10mm 15mm !important; border: none !important; } }`}</style>
      <div style={{ textAlign: "center", marginBottom: "24px" }}>
        {logoUrl && <img src={logoUrl} alt="Company Logo" style={{ maxHeight: "70px", objectFit: "contain", marginBottom: "8px" }} />}
        <h2 style={{ fontSize: "20px", fontWeight: "bold", color: "#1a365d" }}>{company?.name || "บริษัท"}</h2>
        {company?.address && <p style={{ fontSize: "13px", color: "#555", marginTop: "4px" }}>{company.address}</p>}
        {company?.taxId && <p style={{ fontSize: "13px", color: "#555" }}>เลขประจำตัวผู้เสียภาษี: {company.taxId}</p>}
      </div>
      <div style={{ textAlign: "center", marginBottom: "32px" }}>
        <h3 style={{ fontSize: "18px", fontWeight: "bold", textDecoration: "underline" }}>หนังสือรับรองการทำงาน</h3>
        <p style={{ fontSize: "13px", color: "#666", marginTop: "4px" }}>Employment Certificate</p>
      </div>
      <div style={{ fontSize: "14px", lineHeight: 2 }}>
        <p style={{ textIndent: "4em" }}>
          หนังสือฉบับนี้ออกให้เพื่อรับรองว่า <strong>{employee.fullName}</strong>{" "}
          รหัสพนักงาน <strong>{employee.employeeCode}</strong>{" "}
          {isCurrentEmployee ? "เป็นพนักงาน" : "เคยเป็นพนักงาน"}ของ <strong>{company?.name || "บริษัท"}</strong>{" "}
          ตั้งแต่วันที่ <strong>{formatDate(employee.startDate, dateEra, dateFmt)}</strong>{" "}
          {isCurrentEmployee ? "จนถึงปัจจุบัน" : ""}
          {isCurrentEmployee && employee.startDate && (
            <> รวมระยะเวลาทำงาน <strong>{calcYearsMonths(employee.startDate)}</strong></>
          )}
        </p>
        <p style={{ textIndent: "4em", marginTop: "8px" }}>
          ปัจจุบันดำรงตำแหน่ง <strong>{employee.position || "-"}</strong>{" "}
          สังกัดแผนก <strong>{employee.department || "-"}</strong>
        </p>
        {employee.startDate && (
          <p style={{ textIndent: "4em", marginTop: "8px" }}>
            ตลอดระยะเวลาที่ปฏิบัติงาน {employee.fullName} เป็นพนักงานที่มีความประพฤติเรียบร้อยดี ปฏิบัติหน้าที่ด้วยความรับผิดชอบ ซื่อสัตย์สุจริต
          </p>
        )}
        <p style={{ textIndent: "4em", marginTop: "8px" }}>
          หนังสือฉบับนี้ออกให้เพื่อ{purpose || "ใช้ในกิจธุระส่วนตัว"} โดยบริษัทไม่รับผิดชอบในหนี้สินหรือภาระผูกพันใดๆ ที่พนักงานผู้นี้อาจก่อขึ้น
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

export default function WorkCertificate() {
  const { user } = useAuth();
  const companyId = useHrCompanyId();
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [purpose, setPurpose] = useState("ใช้ในกิจธุระส่วนตัว");
  const [isCurrentEmployee, setIsCurrentEmployee] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

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
      <html><head><title>หนังสือรับรองการทำงาน - ${emp?.fullName || ""}</title>
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
    <HRLayout>
      <div className="space-y-6">
        <Card className="flexy-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2" data-testid="page-title-work-cert">
              <FileText className="w-5 h-5" style={{ color: "#fb9678" }} />
              หนังสือรับรองการทำงาน (Employment Certificate)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
              <div>
                <label className="text-sm font-medium mb-1 block">เลือกพนักงาน</label>
                <Select value={selectedEmployee} onValueChange={setSelectedEmployee} data-testid="select-employee-work-cert">
                  <SelectTrigger data-testid="trigger-employee-work-cert">
                    <SelectValue placeholder="-- เลือกพนักงาน --" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((e: any) => (
                      <SelectItem key={e.id} value={String(e.id)} data-testid={`option-employee-work-${e.id}`}>
                        {e.employeeCode} - {e.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">สถานะพนักงาน</label>
                <Select value={isCurrentEmployee ? "current" : "former"} onValueChange={v => setIsCurrentEmployee(v === "current")} data-testid="select-status-work-cert">
                  <SelectTrigger data-testid="trigger-status-work-cert">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="current">พนักงานปัจจุบัน</SelectItem>
                    <SelectItem value="former">พนักงานเก่า (ลาออกแล้ว)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">วัตถุประสงค์</label>
                <Input
                  value={purpose}
                  onChange={e => setPurpose(e.target.value)}
                  placeholder="เช่น สมัครงาน, ขอวีซ่า"
                  data-testid="input-purpose-work-cert"
                />
              </div>
              <div className="flex items-end gap-2 lg:col-span-2">
                <Button
                  onClick={() => setPreviewOpen(true)}
                  disabled={!emp}
                  className="text-white"
                  style={{ backgroundColor: "#fb9678" }}
                  data-testid="btn-preview-work-cert"
                >
                  <Eye className="w-4 h-4 mr-1" /> ดูตัวอย่าง
                </Button>
                <Button
                  onClick={handlePrint}
                  disabled={!emp}
                  variant="outline"
                  style={{ borderColor: "#fb9678", color: "#fb9678" }}
                  data-testid="btn-print-work-cert"
                >
                  <Printer className="w-4 h-4 mr-1" /> พิมพ์
                </Button>
              </div>
            </div>

            {!emp && (
              <div className="text-center py-12 text-gray-400" data-testid="empty-state-work-cert">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>กรุณาเลือกพนักงานเพื่อออกหนังสือรับรองการทำงาน</p>
              </div>
            )}

            {emp && (
              <div ref={printRef}>
                <CertificatePreview employee={emp} company={company} purpose={purpose} isCurrentEmployee={isCurrentEmployee} dateEra={dateEra} dateFmt={dateFmt} logoUrl={docSettings?.showLogo !== false ? objectPathToUrl(docSettings?.logoUrl) || undefined : undefined} />
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="dialog-preview-work-cert">
            <DialogHeader>
              <DialogTitle>ตัวอย่างหนังสือรับรองการทำงาน</DialogTitle>
            </DialogHeader>
            {emp && <CertificatePreview employee={emp} company={company} purpose={purpose} isCurrentEmployee={isCurrentEmployee} dateEra={dateEra} dateFmt={dateFmt} logoUrl={docSettings?.showLogo !== false ? objectPathToUrl(docSettings?.logoUrl) || undefined : undefined} />}
            <div className="flex justify-end gap-2 mt-4">
              <Button
                onClick={handlePrint}
                className="text-white"
                style={{ backgroundColor: "#fb9678" }}
                data-testid="btn-print-preview-work-cert"
              >
                <Printer className="w-4 h-4 mr-1" /> พิมพ์
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </HRLayout>
  );
}
