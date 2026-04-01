import Layout from "@/components/layout";
import { objectPathToUrl } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Printer, Eye, DollarSign, Briefcase } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
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

function SalaryCertPreview({ employee, company, month, year, dateEra, dateFmt, logoUrl, signerName, signerPosition }: { employee: any; company: any; month: string; year: string; dateEra: string; dateFmt: string; logoUrl?: string; signerName?: string; signerPosition?: string }) {
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
          {signerName ? (
            <>
              <p style={{ fontSize: "13px", fontWeight: "bold" }}>({signerName})</p>
              {signerPosition && <p style={{ fontSize: "12px", color: "#555", marginTop: "2px" }}>{signerPosition}</p>}
              <p style={{ fontSize: "12px", color: "#888", marginTop: "2px" }}>ผู้มีอำนาจลงนาม</p>
            </>
          ) : (
            <p style={{ fontSize: "13px" }}>ลงชื่อ ผู้มีอำนาจลงนาม</p>
          )}
          <p style={{ fontSize: "12px", color: "#888", marginTop: "4px" }}>(ตราประทับบริษัท)</p>
        </div>
      </div>
    </div>
  );
}

function WorkCertPreview({ employee, company, purpose, isCurrentEmployee, dateEra, dateFmt, logoUrl, signerName, signerPosition }: { employee: any; company: any; purpose: string; isCurrentEmployee: boolean; dateEra: string; dateFmt: string; logoUrl?: string; signerName?: string; signerPosition?: string }) {
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
          {signerName ? (
            <>
              <p style={{ fontSize: "13px", fontWeight: "bold" }}>({signerName})</p>
              {signerPosition && <p style={{ fontSize: "12px", color: "#555", marginTop: "2px" }}>{signerPosition}</p>}
              <p style={{ fontSize: "12px", color: "#888", marginTop: "2px" }}>ผู้มีอำนาจลงนาม</p>
            </>
          ) : (
            <p style={{ fontSize: "13px" }}>ลงชื่อ ผู้มีอำนาจลงนาม</p>
          )}
          <p style={{ fontSize: "12px", color: "#888", marginTop: "4px" }}>(ตราประทับบริษัท)</p>
        </div>
      </div>
    </div>
  );
}

export default function Certificates() {
  const { user } = useAuth();
  const companyId = useHrCompanyId();
  const urlParams = new URLSearchParams(window.location.search);
  const initialTab = urlParams.get("tab") === "work" ? "work" : "salary";
  const [activeTab, setActiveTab] = useState(initialTab);

  const [salaryEmployee, setSalaryEmployee] = useState<string>("");
  const [salaryPreviewOpen, setSalaryPreviewOpen] = useState(false);
  const salaryPrintRef = useRef<HTMLDivElement>(null);
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));

  const [signerName, setSignerName] = useState("");
  const [signerPosition, setSignerPosition] = useState("");

  const [workEmployee, setWorkEmployee] = useState<string>("");
  const [purpose, setPurpose] = useState("ใช้ในกิจธุระส่วนตัว");
  const [isCurrentEmployee, setIsCurrentEmployee] = useState(true);
  const [workPreviewOpen, setWorkPreviewOpen] = useState(false);
  const workPrintRef = useRef<HTMLDivElement>(null);

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
  const logoUrl = docSettings?.showLogo !== false ? objectPathToUrl(docSettings?.logoUrl) || undefined : undefined;

  useEffect(() => {
    if (docSettings) {
      setSignerName(docSettings.certSignerName || "");
      setSignerPosition(docSettings.certSignerPosition || "");
    }
  }, [docSettings]);

  const saveSignerDebounced = useCallback(
    (() => {
      let timer: ReturnType<typeof setTimeout>;
      return (name: string, position: string) => {
        clearTimeout(timer);
        timer = setTimeout(async () => {
          if (!companyId) return;
          try {
            await fetch(`/api/document-settings/${companyId}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ certSignerName: name || null, certSignerPosition: position || null }),
            });
          } catch {}
        }, 800);
      };
    })(),
    [companyId]
  );

  const handleSignerNameChange = (val: string) => {
    setSignerName(val);
    saveSignerDebounced(val, signerPosition);
  };

  const handleSignerPositionChange = (val: string) => {
    setSignerPosition(val);
    saveSignerDebounced(signerName, val);
  };

  const company = companies.find((c: any) => c.id === companyId) || companies[0];
  const salaryEmp = employees.find((e: any) => String(e.id) === salaryEmployee);
  const workEmp = employees.find((e: any) => String(e.id) === workEmployee);

  function openPrintWindow(title: string, content: string) {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html><head><title>${title}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Sarabun', 'Noto Sans Thai', sans-serif; }
        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      </style></head><body>
      ${content}
      </body></html>
    `);
    win.document.close();
    const images = win.document.querySelectorAll("img");
    if (images.length === 0) {
      win.print();
      return;
    }
    let loaded = 0;
    const total = images.length;
    const onReady = () => { loaded++; if (loaded >= total) win.print(); };
    images.forEach((img) => {
      if (img.complete) { onReady(); } else {
        img.addEventListener("load", onReady);
        img.addEventListener("error", onReady);
      }
    });
    setTimeout(() => { if (loaded < total) win.print(); }, 3000);
  }

  function handleSalaryPrint() {
    if (!salaryPrintRef.current) return;
    openPrintWindow(`หนังสือรับรองเงินเดือน - ${salaryEmp?.fullName || ""}`, salaryPrintRef.current.innerHTML);
  }

  function handleWorkPrint() {
    if (!workPrintRef.current) return;
    openPrintWindow(`หนังสือรับรองการทำงาน - ${workEmp?.fullName || ""}`, workPrintRef.current.innerHTML);
  }

  return (
    <Layout>
      <div className="space-y-6">
        <Card className="flexy-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2" data-testid="page-title-certificates">
              <FileText className="w-5 h-5" style={{ color: "#fb9678" }} />
              หนังสือรับรอง
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5 p-4 bg-slate-50 rounded-lg border">
              <div>
                <label className="text-sm font-medium mb-1 block">ชื่อผู้มีอำนาจลงนาม</label>
                <Input
                  value={signerName}
                  onChange={e => handleSignerNameChange(e.target.value)}
                  placeholder="เช่น นายสมชาย ใจดี"
                  data-testid="input-signer-name"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">ตำแหน่งผู้ลงนาม</label>
                <Input
                  value={signerPosition}
                  onChange={e => handleSignerPositionChange(e.target.value)}
                  placeholder="เช่น กรรมการผู้จัดการ"
                  data-testid="input-signer-position"
                />
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="salary" className="gap-1.5" data-testid="tab-salary-cert">
                  <DollarSign className="w-4 h-4" />
                  หนังสือรับรองเงินเดือน
                </TabsTrigger>
                <TabsTrigger value="work" className="gap-1.5" data-testid="tab-work-cert">
                  <Briefcase className="w-4 h-4" />
                  หนังสือรับรองการทำงาน
                </TabsTrigger>
              </TabsList>

              <TabsContent value="salary">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div>
                    <label className="text-sm font-medium mb-1 block">เลือกพนักงาน</label>
                    <Select value={salaryEmployee} onValueChange={setSalaryEmployee} data-testid="select-employee-salary-cert">
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
                      onClick={() => setSalaryPreviewOpen(true)}
                      disabled={!salaryEmp}
                      className="text-white"
                      style={{ backgroundColor: "#fb9678" }}
                      data-testid="btn-preview-salary-cert"
                    >
                      <Eye className="w-4 h-4 mr-1" /> ดูตัวอย่าง
                    </Button>
                    <Button
                      onClick={handleSalaryPrint}
                      disabled={!salaryEmp}
                      variant="outline"
                      style={{ borderColor: "#fb9678", color: "#fb9678" }}
                      data-testid="btn-print-salary-cert"
                    >
                      <Printer className="w-4 h-4 mr-1" /> พิมพ์
                    </Button>
                  </div>
                </div>

                {!salaryEmp && (
                  <div className="text-center py-12 text-gray-400" data-testid="empty-state-salary-cert">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>กรุณาเลือกพนักงานเพื่อออกหนังสือรับรองเงินเดือน</p>
                  </div>
                )}

                {salaryEmp && (
                  <div ref={salaryPrintRef}>
                    <SalaryCertPreview employee={salaryEmp} company={company} month={month} year={year} dateEra={dateEra} dateFmt={dateFmt} logoUrl={logoUrl} signerName={signerName} signerPosition={signerPosition} />
                  </div>
                )}
              </TabsContent>

              <TabsContent value="work">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                  <div>
                    <label className="text-sm font-medium mb-1 block">เลือกพนักงาน</label>
                    <Select value={workEmployee} onValueChange={setWorkEmployee} data-testid="select-employee-work-cert">
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
                      onClick={() => setWorkPreviewOpen(true)}
                      disabled={!workEmp}
                      className="text-white"
                      style={{ backgroundColor: "#fb9678" }}
                      data-testid="btn-preview-work-cert"
                    >
                      <Eye className="w-4 h-4 mr-1" /> ดูตัวอย่าง
                    </Button>
                    <Button
                      onClick={handleWorkPrint}
                      disabled={!workEmp}
                      variant="outline"
                      style={{ borderColor: "#fb9678", color: "#fb9678" }}
                      data-testid="btn-print-work-cert"
                    >
                      <Printer className="w-4 h-4 mr-1" /> พิมพ์
                    </Button>
                  </div>
                </div>

                {!workEmp && (
                  <div className="text-center py-12 text-gray-400" data-testid="empty-state-work-cert">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>กรุณาเลือกพนักงานเพื่อออกหนังสือรับรองการทำงาน</p>
                  </div>
                )}

                {workEmp && (
                  <div ref={workPrintRef}>
                    <WorkCertPreview employee={workEmp} company={company} purpose={purpose} isCurrentEmployee={isCurrentEmployee} dateEra={dateEra} dateFmt={dateFmt} logoUrl={logoUrl} signerName={signerName} signerPosition={signerPosition} />
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Dialog open={salaryPreviewOpen} onOpenChange={setSalaryPreviewOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="dialog-preview-salary-cert">
            <DialogHeader>
              <DialogTitle>ตัวอย่างหนังสือรับรองเงินเดือน</DialogTitle>
            </DialogHeader>
            {salaryEmp && <SalaryCertPreview employee={salaryEmp} company={company} month={month} year={year} dateEra={dateEra} dateFmt={dateFmt} logoUrl={logoUrl} signerName={signerName} signerPosition={signerPosition} />}
            <div className="flex justify-end gap-2 mt-4">
              <Button onClick={handleSalaryPrint} className="text-white" style={{ backgroundColor: "#fb9678" }} data-testid="btn-print-preview-salary-cert">
                <Printer className="w-4 h-4 mr-1" /> พิมพ์
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={workPreviewOpen} onOpenChange={setWorkPreviewOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="dialog-preview-work-cert">
            <DialogHeader>
              <DialogTitle>ตัวอย่างหนังสือรับรองการทำงาน</DialogTitle>
            </DialogHeader>
            {workEmp && <WorkCertPreview employee={workEmp} company={company} purpose={purpose} isCurrentEmployee={isCurrentEmployee} dateEra={dateEra} dateFmt={dateFmt} logoUrl={logoUrl} signerName={signerName} signerPosition={signerPosition} />}
            <div className="flex justify-end gap-2 mt-4">
              <Button onClick={handleWorkPrint} className="text-white" style={{ backgroundColor: "#fb9678" }} data-testid="btn-print-preview-work-cert">
                <Printer className="w-4 h-4 mr-1" /> พิมพ์
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
