import { useState, useRef, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import ReportLayout from "@/components/report-layout";
import { useCompany } from "@/lib/company-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useDateSettings } from "@/hooks/use-date-settings";
import ThaiDateInput from "@/components/thai-date-input";
import {
  FileSpreadsheet, Printer, Download, ArrowLeft, Settings, Save, RefreshCw,
  Check, AlertTriangle, Plus, Trash2, ChevronDown, ChevronRight, GripVertical
} from "lucide-react";
import { useLocation } from "wouter";

function fmt(val: number | null | undefined): string {
  const n = val ?? 0;
  if (n === 0) return "-";
  if (n < 0) return `(${Math.abs(n).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface Row { code: string; name: string; current: number; previous: number; }
interface Total { current: number; previous: number; }

const BUSINESS_TYPES = [
  { value: "individual", label: "บุคคลธรรมดา" },
  { value: "partnership", label: "ห้างหุ้นส่วนสามัญ" },
  { value: "limited_partnership", label: "ห้างหุ้นส่วนจำกัด" },
  { value: "limited_company", label: "บริษัทจำกัด" },
  { value: "public_company", label: "บริษัทมหาชนจำกัด" },
  { value: "cooperative", label: "สหกรณ์" },
  { value: "foundation", label: "มูลนิธิ" },
  { value: "association", label: "สมาคม" },
];

const FISCAL_MONTHS = [
  { value: 1, label: "มกราคม" }, { value: 2, label: "กุมภาพันธ์" }, { value: 3, label: "มีนาคม" },
  { value: 4, label: "เมษายน" }, { value: 5, label: "พฤษภาคม" }, { value: 6, label: "มิถุนายน" },
  { value: 7, label: "กรกฎาคม" }, { value: 8, label: "สิงหาคม" }, { value: 9, label: "กันยายน" },
  { value: 10, label: "ตุลาคม" }, { value: 11, label: "พฤศจิกายน" }, { value: 12, label: "ธันวาคม" },
];

interface NoteSection {
  code: string;
  id: string;
  noteNo: number;
  title: string;
  type: "text" | "table" | "asset_movement";
  content: string;
  tableRows: { name: string; current: number; previous: number }[];
  costRows: { name: string; beginBalance: number; additions: number; disposals: number; endBalance: number }[];
  depreciationRows: { name: string; beginBalance: number; additions: number; disposals: number; endBalance: number }[];
}

function SignatureLine({ signerName, signerTitle }: { signerName: string; signerTitle: string }) {
  const title = signerTitle || "กรรมการ";
  const name = signerName || "..................................................";
  return (
    <div className="fs-signature-block mt-16 print:mt-20 flex justify-center">
      <div className="inline-block">
        <div className="flex items-end gap-2">
          <span className="text-sm whitespace-nowrap">{title}</span>
          <div className="w-72 border-b border-gray-600 mb-0.5"></div>
        </div>
        <p className="text-sm text-center mt-1">( {name} )</p>
      </div>
    </div>
  );
}

function StatementFooter({ signerName, signerTitle, showNoteRef = true, showQualification = true }: {
  signerName: string; signerTitle: string; showNoteRef?: boolean; showQualification?: boolean;
}) {
  return (
    <div className="fs-statement-footer mt-8 print:mt-6">
      {showNoteRef && (
        <div className="text-center text-sm text-muted-foreground">
          หมายเหตุประกอบงบการเงินเป็นส่วนหนึ่งของงบการเงินนี้
        </div>
      )}
      {showQualification && (
        <>
          <div className="text-center text-sm text-muted-foreground mt-4 leading-loose">
            ข้อมูลในงบการเงินนี้ได้จัดทำขึ้นอย่างถูกต้องครบถ้วนตามความเป็นจริง และตามมาตรฐานการบัญชี
          </div>
          <div className="text-center text-sm text-muted-foreground leading-loose">
            งบการเงินนี้ได้รับอนุมัติจากที่ประชุมสามัญผู้ถือหุ้น ครั้งที่.......................เมื่อวันที่..................................
          </div>
        </>
      )}
      <SignatureLine signerName={signerName} signerTitle={signerTitle} />
    </div>
  );
}

function UnitLabel() {
  return <p className="text-right text-xs text-muted-foreground mb-1">หน่วย : บาท</p>;
}

function SettingsTab({ companyId }: { companyId: number }) {
  const { toast } = useToast();
  const { dateEra, dateFmt } = useDateSettings();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery<any>({
    queryKey: ["/api/financial-statement-settings", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/financial-statement-settings/${companyId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!companyId,
  });

  const [form, setForm] = useState<any>({});
  const initialized = useRef(false);

  if (settings && !initialized.current) {
    setForm(settings || {});
    initialized.current = true;
  }

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/financial-statement-settings/${companyId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "บันทึกสำเร็จ", description: "ตั้งค่างบการเงินถูกบันทึกแล้ว" });
      queryClient.invalidateQueries({ queryKey: ["/api/financial-statement-settings", companyId] });
    },
    onError: () => {
      toast({ title: "เกิดข้อผิดพลาด", variant: "destructive" });
    }
  });

  const handleSave = () => {
    const { id, companyId: _, updatedAt, ...rest } = form;
    mutation.mutate(rest);
  };

  const update = (key: string, val: any) => setForm((prev: any) => ({ ...prev, [key]: val }));

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">กำลังโหลด...</div>;

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-md">
        <CardContent className="p-6">
          <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#fb9678]" />
            ข้อมูลกิจการ
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-bold">ประเภทกิจการ</Label>
              <Select value={form.businessType || ""} onValueChange={v => update("businessType", v)}>
                <SelectTrigger data-testid="select-business-type"><SelectValue placeholder="เลือกประเภทกิจการ" /></SelectTrigger>
                <SelectContent>
                  {BUSINESS_TYPES.map(bt => (
                    <SelectItem key={bt.value} value={bt.value}>{bt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-bold">รายละเอียดประเภทกิจการ</Label>
              <Input placeholder="เช่น จำหน่ายสินค้าออนไลน์, ให้บริการบัญชี" value={form.businessTypeDetail || ""} onChange={e => update("businessTypeDetail", e.target.value)} data-testid="input-business-type-detail" />
            </div>
            <div>
              <Label className="text-xs font-bold">วันเริ่มประกอบกิจการ</Label>
              <ThaiDateInput value={form.businessStartDate || ""} onChange={(v) => update("businessStartDate", v)} dateEra={dateEra} dateFmt={dateFmt} data-testid="input-business-start-date" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-bold">เดือนสิ้นรอบงบการเงิน</Label>
                <Select value={String(form.fiscalYearEndMonth || 12)} onValueChange={v => update("fiscalYearEndMonth", Number(v))}>
                  <SelectTrigger data-testid="select-fiscal-month"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FISCAL_MONTHS.map(m => (
                      <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-bold">วันสิ้นรอบ</Label>
                <Input type="number" min={1} max={31} value={form.fiscalYearEndDay || 31} onChange={e => update("fiscalYearEndDay", Number(e.target.value))} data-testid="input-fiscal-day" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-md">
        <CardContent className="p-6">
          <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#fb9678]" />
            ทุนจดทะเบียน
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-bold">ทุนจดทะเบียน (บาท)</Label>
              <Input type="number" placeholder="0.00" value={form.registeredCapital || ""} onChange={e => update("registeredCapital", e.target.value)} data-testid="input-registered-capital" />
            </div>
            <div>
              <Label className="text-xs font-bold">ทุนที่ชำระแล้ว (บาท)</Label>
              <Input type="number" placeholder="0.00" value={form.paidUpCapital || ""} onChange={e => update("paidUpCapital", e.target.value)} data-testid="input-paid-up-capital" />
            </div>
            <div>
              <Label className="text-xs font-bold">มูลค่าหุ้นที่ตราไว้ (บาท/หุ้น)</Label>
              <Input type="number" placeholder="100" value={form.shareParValue || ""} onChange={e => update("shareParValue", e.target.value)} data-testid="input-share-par-value" />
            </div>
            <div>
              <Label className="text-xs font-bold">จำนวนหุ้น</Label>
              <Input type="number" placeholder="0" value={form.numberOfShares || ""} onChange={e => update("numberOfShares", Number(e.target.value))} data-testid="input-number-of-shares" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-md">
        <CardContent className="p-6">
          <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#fb9678]" />
            ผู้ลงนามในงบการเงิน
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-bold">ชื่อผู้ลงนาม คนที่ 1</Label>
              <Input placeholder="เช่น นายอภิโชติ โตบุญเลี้ยง" value={form.signerName1 || ""} onChange={e => update("signerName1", e.target.value)} data-testid="input-signer-name-1" />
            </div>
            <div>
              <Label className="text-xs font-bold">ตำแหน่ง คนที่ 1</Label>
              <Input placeholder="เช่น กรรมการ" value={form.signerTitle1 || ""} onChange={e => update("signerTitle1", e.target.value)} data-testid="input-signer-title-1" />
            </div>
            <div>
              <Label className="text-xs font-bold">ชื่อผู้ลงนาม คนที่ 2</Label>
              <Input placeholder="(ถ้ามี)" value={form.signerName2 || ""} onChange={e => update("signerName2", e.target.value)} data-testid="input-signer-name-2" />
            </div>
            <div>
              <Label className="text-xs font-bold">ตำแหน่ง คนที่ 2</Label>
              <Input placeholder="(ถ้ามี)" value={form.signerTitle2 || ""} onChange={e => update("signerTitle2", e.target.value)} data-testid="input-signer-title-2" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-md">
        <CardContent className="p-6">
          <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#fb9678]" />
            ผู้สอบบัญชี
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-bold">ชื่อผู้สอบบัญชี</Label>
              <Input placeholder="เช่น นายสมชาย ใจดี" value={form.auditorName || ""} onChange={e => update("auditorName", e.target.value)} data-testid="input-auditor-name" />
            </div>
            <div>
              <Label className="text-xs font-bold">เลขทะเบียนผู้สอบบัญชี</Label>
              <Input placeholder="เช่น 12345" value={form.auditorLicense || ""} onChange={e => update("auditorLicense", e.target.value)} data-testid="input-auditor-license" />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button className="bg-[#fb9678] hover:bg-[#e8876a]" onClick={handleSave} disabled={mutation.isPending} data-testid="button-save-settings">
          <Save className="h-4 w-4 mr-1" /> {mutation.isPending ? "กำลังบันทึก..." : "บันทึกตั้งค่า"}
        </Button>
      </div>
    </div>
  );
}

export default function FinancialStatementsPackage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const currentYear = new Date().getFullYear();
  const [fiscalYear, setFiscalYear] = useState(currentYear);
  const [activeTab, setActiveTab] = useState("report");
  const [printAllMode, setPrintAllMode] = useState(false);
  const [previewMode, setPreviewMode] = useState<"bs" | "is" | "eq" | "notes" | "all" | null>(null);
  const [reportTab, setReportTab] = useState("balance-sheet");

  const buddhYear = fiscalYear + 543;
  const prevBuddhYear = buddhYear - 1;

  const { data: settings } = useQuery<any>({
    queryKey: ["/api/financial-statement-settings", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/financial-statement-settings/${companyId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!companyId,
  });

  const signerName = settings?.signerName1 || "";
  const signerTitle = settings?.signerTitle1 || "กรรมการ";
  const regCap = parseFloat(settings?.registeredCapital || "0");
  const paidCap = parseFloat(settings?.paidUpCapital || "0");
  const numShares = settings?.numberOfShares || 0;
  const parValue = parseFloat(settings?.shareParValue || "0");
  const effectiveParValue = parValue > 0 ? parValue : (numShares > 0 && regCap > 0 ? regCap / numShares : 100);
  const paidUpVal = paidCap > 0 ? paidCap : regCap;

  const { data: notesData } = useQuery<any>({
    queryKey: ["/api/financial-notes", companyId, fiscalYear],
    queryFn: async () => {
      const res = await fetch(`/api/financial-notes?companyId=${companyId}&fiscalYear=${fiscalYear}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!companyId,
  });

  const notes: NoteSection[] = useMemo(() => {
    if (!notesData?.sections || !Array.isArray(notesData.sections)) return [];
    return notesData.sections.map((s: any, i: number) => ({
      code: s.id || `note-${i}`,
      id: s.id || `note-${i}`,
      noteNo: i + 1,
      title: s.title || "",
      type: s.type || "text",
      content: s.content || "",
      tableRows: s.tableRows || [],
      costRows: s.costRows || [],
      depreciationRows: s.depreciationRows || [],
    }));
  }, [notesData]);

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/reports/financial-statements-package", companyId, fiscalYear],
    queryFn: async () => {
      const res = await fetch(`/api/reports/financial-statements-package?companyId=${companyId}&fiscalYear=${fiscalYear}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!companyId,
  });

  const bs = data?.balanceSheet;
  const is_ = data?.incomeStatement;
  const ec = data?.equityChanges;
  const companyName = data?.company?.name || selectedCompany?.name || "";

  const handleExcel = () => {
    const url = `/api/reports/financial-statements-package/excel?companyId=${companyId}&fiscalYear=${fiscalYear}&signerName=${encodeURIComponent(signerName)}&signerTitle=${encodeURIComponent(signerTitle)}`;
    window.open(url, "_blank");
  };

  const handlePrintAll = () => {
    setPrintAllMode(true);
    setTimeout(() => {
      window.print();
      setPrintAllMode(false);
    }, 300);
  };

  const handlePreviewPrint = () => {
    const prevMode = previewMode;
    setPreviewMode(null);
    if (prevMode === "all") {
      setPrintAllMode(true);
      setTimeout(() => {
        window.print();
        setPrintAllMode(false);
      }, 100);
    } else {
      setTimeout(() => { window.print(); }, 200);
    }
  };

  const renderBSRow = (r: Row) => {
    const pl = "pl-4";
    return (
      <tr key={r.code}>
        <td className={`py-1 ${pl} text-sm`}>{r.name}</td>
        <td className="py-1 text-center w-16 text-sm text-muted-foreground"></td>
        <td className="py-1 text-right text-sm font-mono pr-4 w-[22%]">{fmt(r.current)}</td>
        <td className="w-2"></td>
        <td className="py-1 text-right text-sm font-mono pr-4 w-[22%]">{fmt(r.previous)}</td>
      </tr>
    );
  };

  const renderBSTotal = (label: string, cur: number, prev: number, bold = false, doubleLine = false) => (
    <tr key={`total-${label}`} className={bold ? "font-bold" : "font-semibold"}>
      <td className="py-1 pl-2 text-sm" colSpan={2}>{label}</td>
      <td className={`py-1 text-right text-sm font-mono pr-4 ${doubleLine ? "border-t border-b-2 border-double border-gray-800" : "border-t border-gray-400"}`}>{fmt(cur)}</td>
      <td className="w-2"></td>
      <td className={`py-1 text-right text-sm font-mono pr-4 ${doubleLine ? "border-t border-b-2 border-double border-gray-800" : "border-t border-gray-400"}`}>{fmt(prev)}</td>
    </tr>
  );

  const renderISRow = (r: Row) => (
    <tr key={r.code}>
      <td className="py-1 pl-4 text-sm">{r.name}</td>
      <td className="w-16"></td>
      <td className="py-1 text-right text-sm font-mono pr-4">{fmt(r.current)}</td>
      <td className="w-2"></td>
      <td className="py-1 text-right text-sm font-mono pr-4">{fmt(r.previous)}</td>
    </tr>
  );

  const renderISTotal = (label: string, cur: number, prev: number, bold = false, doubleLine = false) => (
    <tr key={`total-${label}`} className={bold ? "font-bold" : "font-semibold"}>
      <td className="py-1 text-sm" colSpan={2}>{label}</td>
      <td className={`py-1 text-right text-sm font-mono pr-4 ${doubleLine ? "border-t border-b-2 border-double border-gray-800" : "border-t border-gray-400"}`}>{fmt(cur)}</td>
      <td className="w-2"></td>
      <td className={`py-1 text-right text-sm font-mono pr-4 ${doubleLine ? "border-t border-b-2 border-double border-gray-800" : "border-t border-gray-400"}`}>{fmt(prev)}</td>
    </tr>
  );

  const renderNotePrint = (note: NoteSection) => {
    if (note.type === "text") {
      return <div className="whitespace-pre-wrap text-sm leading-relaxed pl-6">{note.content}</div>;
    }
    if (note.type === "table") {
      return (
        <div className="pl-6">
          <UnitLabel />
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left py-1"></th>
                <th className="text-right py-1 w-[22%] pr-4 border-b border-gray-800">{buddhYear}</th>
                <th className="w-2"></th>
                <th className="text-right py-1 w-[22%] pr-4 border-b border-gray-800">{prevBuddhYear}</th>
              </tr>
            </thead>
            <tbody>
              {note.tableRows.map((r, i) => (
                <tr key={i}><td className="py-1 pl-2">{r.name}</td><td className="py-1 text-right font-mono pr-4">{fmt(r.current)}</td><td className="w-2"></td><td className="py-1 text-right font-mono pr-4">{fmt(r.previous)}</td></tr>
              ))}
              <tr className="font-semibold">
                <td className="py-1 pl-6">รวม</td>
                <td className="py-1 text-right font-mono pr-4 border-t border-b-2 border-double border-gray-800">{fmt(note.tableRows.reduce((s, r) => s + r.current, 0))}</td>
                <td className="w-2"></td>
                <td className="py-1 text-right font-mono pr-4 border-t border-b-2 border-double border-gray-800">{fmt(note.tableRows.reduce((s, r) => s + r.previous, 0))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      );
    }
    if (note.type === "asset_movement") {
      const costTotal = { begin: note.costRows.reduce((s, r) => s + r.beginBalance, 0), add: note.costRows.reduce((s, r) => s + r.additions, 0), disp: note.costRows.reduce((s, r) => s + r.disposals, 0), end: note.costRows.reduce((s, r) => s + r.endBalance, 0) };
      const depTotal = { begin: note.depreciationRows.reduce((s, r) => s + r.beginBalance, 0), add: note.depreciationRows.reduce((s, r) => s + r.additions, 0), disp: note.depreciationRows.reduce((s, r) => s + r.disposals, 0), end: note.depreciationRows.reduce((s, r) => s + r.endBalance, 0) };
      return (
        <div className="pl-4">
          <UnitLabel />
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left py-1 w-[30%]"></th>
                <th className="text-right py-1 pr-3 border-b border-gray-800">31 ธ.ค. {prevBuddhYear}</th>
                <th className="w-2"></th>
                <th className="text-right py-1 pr-3 border-b border-gray-800">เพิ่มขึ้น/ปรับปรุง</th>
                <th className="w-2"></th>
                <th className="text-right py-1 pr-3 border-b border-gray-800">จำหน่าย/ปรับปรุง</th>
                <th className="w-2"></th>
                <th className="text-right py-1 pr-3 border-b border-gray-800">31 ธ.ค. {buddhYear}</th>
              </tr>
            </thead>
            <tbody>
              <tr><td colSpan={8} className="py-1 font-semibold">ราคาทุน</td></tr>
              {note.costRows.map((r, i) => (
                <tr key={`c${i}`}><td className="py-1 pl-4">{r.name}</td><td className="py-1 text-right font-mono pr-3">{fmt(r.beginBalance)}</td><td className="w-2"></td><td className="py-1 text-right font-mono pr-3">{fmt(r.additions)}</td><td className="w-2"></td><td className="py-1 text-right font-mono pr-3">{fmt(r.disposals)}</td><td className="w-2"></td><td className="py-1 text-right font-mono pr-3">{fmt(r.endBalance)}</td></tr>
              ))}
              <tr className="font-semibold"><td className="py-1 pl-8">รวม</td><td className="py-1 text-right font-mono pr-3 border-t border-b-2 border-double border-gray-800">{fmt(costTotal.begin)}</td><td className="w-2"></td><td className="py-1 text-right font-mono pr-3 border-t border-b-2 border-double border-gray-800">{fmt(costTotal.add)}</td><td className="w-2"></td><td className="py-1 text-right font-mono pr-3 border-t border-b-2 border-double border-gray-800">{fmt(costTotal.disp)}</td><td className="w-2"></td><td className="py-1 text-right font-mono pr-3 border-t border-b-2 border-double border-gray-800">{fmt(costTotal.end)}</td></tr>
              <tr><td colSpan={8} className="py-1 font-semibold pt-2">ค่าเสื่อมราคาสะสม</td></tr>
              {note.depreciationRows.map((r, i) => (
                <tr key={`d${i}`}><td className="py-1 pl-4">{r.name}</td><td className="py-1 text-right font-mono pr-3">{fmt(r.beginBalance)}</td><td className="w-2"></td><td className="py-1 text-right font-mono pr-3">{fmt(r.additions)}</td><td className="w-2"></td><td className="py-1 text-right font-mono pr-3">{fmt(r.disposals)}</td><td className="w-2"></td><td className="py-1 text-right font-mono pr-3">{fmt(r.endBalance)}</td></tr>
              ))}
              <tr className="font-semibold"><td className="py-1 pl-8">รวม</td><td className="py-1 text-right font-mono pr-3 border-t border-b-2 border-double border-gray-800">{fmt(depTotal.begin)}</td><td className="w-2"></td><td className="py-1 text-right font-mono pr-3 border-t border-b-2 border-double border-gray-800">{fmt(depTotal.add)}</td><td className="w-2"></td><td className="py-1 text-right font-mono pr-3 border-t border-b-2 border-double border-gray-800">{fmt(depTotal.disp)}</td><td className="w-2"></td><td className="py-1 text-right font-mono pr-3 border-t border-b-2 border-double border-gray-800">{fmt(depTotal.end)}</td></tr>
              <tr className="font-bold"><td className="py-1">มูลค่าสุทธิตามบัญชี</td><td className="py-1 text-right font-mono pr-3 border-t border-b-2 border-double border-gray-800">{fmt(costTotal.begin - depTotal.begin)}</td><td className="w-2"></td><td colSpan={3}></td><td className="w-2"></td><td className="py-1 text-right font-mono pr-3 border-t border-b-2 border-double border-gray-800">{fmt(costTotal.end - depTotal.end)}</td></tr>
            </tbody>
          </table>
        </div>
      );
    }
    return null;
  };

  const totalRevCur = is_?.totalRevenue?.current || 0;
  const totalRevPrev = is_?.totalRevenue?.previous || 0;
  const totalExpCur = is_?.totalExpenses?.current || 0;
  const totalExpPrev = is_?.totalExpenses?.previous || 0;
  const netProfitCur = is_?.netProfit?.current || 0;
  const netProfitPrev = is_?.netProfit?.previous || 0;

  const retainedRowData = bs?.equityRows?.find((r: Row) => r.code === "310" || r.name?.includes("กำไรสะสม"));
  const retainedBeginPrev = retainedRowData?.previous || 0;
  const retainedPrev = (retainedRowData?.previous || 0) + netProfitPrev;
  const retainedCur = retainedPrev + netProfitCur;

  const totalEquityCur = paidUpVal + retainedCur;
  const totalEquityPrev = paidUpVal + retainedPrev;
  const totalLiabCur = bs?.totalLiabilities?.current || 0;
  const totalLiabPrev = bs?.totalLiabilities?.previous || 0;
  const totalAssetsCur = bs?.totalAssets?.current || 0;
  const totalAssetsPrev = bs?.totalAssets?.previous || 0;

  const isBalancedCur = Math.abs(totalAssetsCur - (totalLiabCur + totalEquityCur)) < 0.01;
  const isBalancedPrev = Math.abs(totalAssetsPrev - (totalLiabPrev + totalEquityPrev)) < 0.01;

  const renderBSPage = () => (
    <>
      <div className="text-center mb-4 space-y-1">
        <h2 className="text-base font-bold">{companyName}</h2>
        <h3 className="text-sm font-bold">งบฐานะการเงิน</h3>
        <p className="text-sm text-muted-foreground">ณ วันที่ 31 ธันวาคม {buddhYear}</p>
      </div>
      <UnitLabel />
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-800">
            <th className="py-1 text-left w-[45%]"></th>
            <th className="text-center text-sm font-bold py-1 w-16">หมายเหตุ</th>
            <th className="text-right text-sm font-bold py-1 w-[22%] pr-4">{buddhYear}</th>
            <th className="w-2"></th>
            <th className="text-right text-sm font-bold py-1 w-[22%] pr-4">{prevBuddhYear}</th>
          </tr>
        </thead>
        <tbody className="text-sm">
          <tr><td colSpan={5} className="pt-3 pb-1 font-bold">สินทรัพย์</td></tr>
          <tr><td colSpan={5} className="pl-2 pb-1 font-semibold text-gray-600">สินทรัพย์หมุนเวียน</td></tr>
          {bs?.currentAssets?.rows?.map((r: Row) => renderBSRow(r))}
          {renderBSTotal("รวมสินทรัพย์หมุนเวียน", bs?.currentAssets?.total?.current || 0, bs?.currentAssets?.total?.previous || 0)}
          {bs?.nonCurrentAssets?.rows?.length > 0 && (
            <>
              <tr><td colSpan={5} className="pl-2 pt-2 pb-1 font-semibold text-gray-600">สินทรัพย์ไม่หมุนเวียน</td></tr>
              {bs?.nonCurrentAssets?.rows?.map((r: Row) => renderBSRow(r))}
              {renderBSTotal("รวมสินทรัพย์ไม่หมุนเวียน", bs?.nonCurrentAssets?.total?.current || 0, bs?.nonCurrentAssets?.total?.previous || 0)}
            </>
          )}
          {renderBSTotal("รวมสินทรัพย์", totalAssetsCur, totalAssetsPrev, true, true)}

          <tr><td colSpan={5} className="pt-4 pb-1 font-bold">หนี้สินและส่วนของผู้ถือหุ้น</td></tr>
          <tr><td colSpan={5} className="pl-2 pb-1 font-semibold text-gray-600">หนี้สินหมุนเวียน</td></tr>
          {bs?.currentLiabilities?.rows?.map((r: Row) => renderBSRow(r))}
          {renderBSTotal("รวมหนี้สินหมุนเวียน", bs?.currentLiabilities?.total?.current || 0, bs?.currentLiabilities?.total?.previous || 0)}
          {bs?.nonCurrentLiabilities?.rows?.length > 0 && (
            <>
              <tr><td colSpan={5} className="pl-2 pt-2 pb-1 font-semibold text-gray-600">หนี้สินไม่หมุนเวียน</td></tr>
              {bs?.nonCurrentLiabilities?.rows?.map((r: Row) => renderBSRow(r))}
              {renderBSTotal("รวมหนี้สินไม่หมุนเวียน", bs?.nonCurrentLiabilities?.total?.current || 0, bs?.nonCurrentLiabilities?.total?.previous || 0)}
            </>
          )}
          {renderBSTotal("รวมหนี้สิน", totalLiabCur, totalLiabPrev)}

          <tr><td colSpan={5} className="pl-2 pt-2 pb-1 font-semibold text-gray-600">ส่วนของผู้ถือหุ้น</td></tr>
          <tr>
            <td className="py-1 pl-8 text-sm" colSpan={2}>ทุนจดทะเบียน หุ้นสามัญ {numShares > 0 ? numShares.toLocaleString("th-TH") : "0"} หุ้น มูลค่าหุ้นละ {effectiveParValue.toLocaleString("th-TH")} บาท</td>
            <td className="py-1 text-right text-sm font-mono pr-4">{fmt(regCap)}</td>
            <td className="w-2"></td>
            <td className="py-1 text-right text-sm font-mono pr-4">{fmt(regCap)}</td>
          </tr>
          <tr>
            <td className="py-1 pl-8 text-sm" colSpan={2}>ทุนที่ชำระแล้ว หุ้นสามัญ {numShares > 0 ? numShares.toLocaleString("th-TH") : "0"} หุ้น มูลค่าหุ้นละ {effectiveParValue.toLocaleString("th-TH")} บาท</td>
            <td className="py-1 text-right text-sm font-mono pr-4">{fmt(paidUpVal)}</td>
            <td className="w-2"></td>
            <td className="py-1 text-right text-sm font-mono pr-4">{fmt(paidUpVal)}</td>
          </tr>
          <tr>
            <td className="py-1 pl-8 text-sm" colSpan={2}>กำไร (ขาดทุน) สะสมยังไม่ได้จัดสรร</td>
            <td className="py-1 text-right text-sm font-mono pr-4">{fmt(retainedCur)}</td>
            <td className="w-2"></td>
            <td className="py-1 text-right text-sm font-mono pr-4">{fmt(retainedPrev)}</td>
          </tr>
          {renderBSTotal("รวมส่วนของผู้ถือหุ้น", totalEquityCur, totalEquityPrev)}
          {renderBSTotal("รวมหนี้สินและส่วนของผู้ถือหุ้น", totalLiabCur + totalEquityCur, totalLiabPrev + totalEquityPrev, true, true)}
        </tbody>
      </table>
    </>
  );

  const renderISPage = () => (
    <>
      <div className="text-center mb-4 space-y-1">
        <h2 className="text-base font-bold">{companyName}</h2>
        <h3 className="text-sm font-bold">งบกำไรขาดทุน</h3>
        <p className="text-sm text-muted-foreground">สำหรับปีสิ้นสุดวันที่ 31 ธันวาคม {buddhYear}</p>
      </div>
      <UnitLabel />
      <table className="w-full">
        <thead>
          <tr>
            <th className="py-1 text-left w-[45%]"></th>
            <th className="py-1 w-16"></th>
            <th className="text-right text-sm font-bold py-1 w-[22%] pr-4 border-b border-gray-800">{buddhYear}</th>
            <th className="w-2"></th>
            <th className="text-right text-sm font-bold py-1 w-[22%] pr-4 border-b border-gray-800">{prevBuddhYear}</th>
          </tr>
        </thead>
        <tbody className="text-sm">
          <tr><td colSpan={5} className="pt-3 pb-1 font-bold">รายได้</td></tr>
          {is_?.serviceRevRows?.map((r: Row) => renderISRow(r))}
          {is_?.otherRevRows?.length > 0 ? is_?.otherRevRows?.map((r: Row) => renderISRow(r)) : (
            <tr><td className="py-1 pl-4 text-sm">รายได้อื่น</td><td className="w-16"></td><td className="py-1 text-right text-sm font-mono pr-4">-</td><td className="w-2"></td><td className="py-1 text-right text-sm font-mono pr-4">-</td></tr>
          )}
          {renderISTotal("รวมรายได้", totalRevCur, totalRevPrev)}

          <tr><td colSpan={5} className="pt-3 pb-1 font-bold">ค่าใช้จ่าย</td></tr>
          {is_?.costRows?.map((r: Row) => renderISRow(r))}
          {is_?.adminExpRows?.map((r: Row) => renderISRow(r))}
          {renderISTotal("รวมค่าใช้จ่าย", totalExpCur, totalExpPrev)}

          {renderISTotal("กำไร (ขาดทุน) ก่อนต้นทุนทางการเงินและภาษีเงินได้",
            is_?.profitBeforeFinance?.current || 0, is_?.profitBeforeFinance?.previous || 0, true)}

          {is_?.financeRows?.length > 0 && (
            <>
              <tr><td className="py-1 pl-4 text-sm">ต้นทุนทางการเงิน</td><td className="w-16"></td>
                <td className="py-1 text-right text-sm font-mono pr-4">{fmt(is_?.financeRows?.reduce((s: number, r: Row) => s + r.current, 0) || 0)}</td>
                <td className="w-2"></td>
                <td className="py-1 text-right text-sm font-mono pr-4">{fmt(is_?.financeRows?.reduce((s: number, r: Row) => s + r.previous, 0) || 0)}</td>
              </tr>
              {renderISTotal("กำไร (ขาดทุน) ก่อนภาษีเงินได้", is_?.profitBeforeTax?.current || 0, is_?.profitBeforeTax?.previous || 0, true)}
            </>
          )}

          {is_?.taxRows?.length > 0 && is_?.taxRows?.map((r: Row) => renderISRow(r))}

          {renderISTotal("กำไร (ขาดทุน) สุทธิ", netProfitCur, netProfitPrev, true, true)}
        </tbody>
      </table>
    </>
  );

  const renderEQPage = () => (
    <>
      <div className="text-center mb-4 space-y-1">
        <h2 className="text-base font-bold">{companyName}</h2>
        <h3 className="text-sm font-bold">งบแสดงการเปลี่ยนแปลงส่วนของผู้ถือหุ้น</h3>
        <p className="text-sm text-muted-foreground">สำหรับปีสิ้นสุดวันที่ 31 ธันวาคม {buddhYear}</p>
      </div>
      <UnitLabel />
      <table className="w-full">
        <thead>
          <tr>
            <th className="py-1 text-left text-sm w-[40%]"></th>
            <th className="text-center text-sm font-bold py-1">ทุนที่ออกและ</th>
            <th className="w-2"></th>
            <th className="text-center text-sm font-bold py-1">กำไร</th>
            <th className="w-2"></th>
            <th className="py-1"></th>
          </tr>
          <tr>
            <th className="py-1 text-left text-sm"></th>
            <th className="text-center text-sm font-bold py-1 border-b border-gray-800">ชำระแล้ว</th>
            <th className="w-2"></th>
            <th className="text-center text-sm font-bold py-1 border-b border-gray-800">(ขาดทุน) สะสม</th>
            <th className="w-2"></th>
            <th className="text-center text-sm font-bold py-1 border-b border-gray-800">รวม</th>
          </tr>
        </thead>
        <tbody className="text-sm">
          <tr className="font-bold">
            <td className="py-2">ยอดคงเหลือต้นงวด วันที่ 1 มกราคม {prevBuddhYear}</td>
            <td className="py-2 text-right font-mono pr-4">{fmt(paidUpVal)}</td>
            <td className="w-2"></td>
            <td className="py-2 text-right font-mono pr-4">{fmt(retainedBeginPrev)}</td>
            <td className="w-2"></td>
            <td className="py-2 text-right font-mono pr-4">{fmt(paidUpVal + retainedBeginPrev)}</td>
          </tr>
          <tr>
            <td className="py-2">กำไร (ขาดทุน) สุทธิ</td>
            <td className="py-2 text-right font-mono pr-4">-</td>
            <td className="w-2"></td>
            <td className="py-2 text-right font-mono pr-4">{fmt(netProfitPrev)}</td>
            <td className="w-2"></td>
            <td className="py-2 text-right font-mono pr-4">{fmt(netProfitPrev)}</td>
          </tr>
          <tr className="font-bold">
            <td className="py-2">ยอดคงเหลือปลายงวด วันที่ 31 ธันวาคม {prevBuddhYear}</td>
            <td className="py-2 text-right font-mono pr-4 border-t border-gray-400">{fmt(paidUpVal)}</td>
            <td className="w-2"></td>
            <td className="py-2 text-right font-mono pr-4 border-t border-gray-400">{fmt(retainedPrev)}</td>
            <td className="w-2"></td>
            <td className="py-2 text-right font-mono pr-4 border-t border-gray-400">{fmt(paidUpVal + retainedPrev)}</td>
          </tr>
          <tr>
            <td className="py-2">กำไร (ขาดทุน) สุทธิ</td>
            <td className="py-2 text-right font-mono pr-4">-</td>
            <td className="w-2"></td>
            <td className="py-2 text-right font-mono pr-4">{fmt(netProfitCur)}</td>
            <td className="w-2"></td>
            <td className="py-2 text-right font-mono pr-4">{fmt(netProfitCur)}</td>
          </tr>
          <tr className="font-bold">
            <td className="py-2">ยอดคงเหลือปลายงวด วันที่ 31 ธันวาคม {buddhYear}</td>
            <td className="py-2 text-right font-mono pr-4 border-t border-b-2 border-double border-gray-800">{fmt(paidUpVal)}</td>
            <td className="w-2"></td>
            <td className="py-2 text-right font-mono pr-4 border-t border-b-2 border-double border-gray-800">{fmt(retainedCur)}</td>
            <td className="w-2"></td>
            <td className="py-2 text-right font-mono pr-4 border-t border-b-2 border-double border-gray-800">{fmt(paidUpVal + retainedCur)}</td>
          </tr>
        </tbody>
      </table>
    </>
  );

  const renderNotesPage = () => (
    <>
      <div className="text-center mb-6 space-y-1">
        <h2 className="text-base font-bold">{companyName}</h2>
        <h3 className="text-sm font-bold">หมายเหตุประกอบงบการเงิน</h3>
        <p className="text-sm text-muted-foreground">สำหรับปีสิ้นสุดวันที่ 31 ธันวาคม {buddhYear}</p>
      </div>
      <div className="space-y-3">
        {notes.length > 0 ? notes.map(note => (
          <div key={note.code} className="fs-note-section">
            <h4 className="font-semibold text-sm mb-2">{note.noteNo}. {note.title}</h4>
            {renderNotePrint(note)}
          </div>
        )) : (
          <div className="text-center py-8 text-sm text-muted-foreground">
            ยังไม่มีหมายเหตุประกอบงบการเงิน —{" "}
            <button className="underline text-[#fb9678]" onClick={() => navigate("/reports/financial-notes")}>
              ไปจัดทำหมายเหตุ
            </button>
          </div>
        )}
      </div>
    </>
  );

  return (
    <ReportLayout fullWidth title="งบการเงิน (ฉบับเต็ม - ส่งราชการ)" icon={<FileSpreadsheet className="h-5 w-5" />}>
      <div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4 no-print">
            <TabsTrigger value="report" data-testid="tab-report" className="data-[state=active]:bg-[#fb9678] data-[state=active]:text-white">
              <FileSpreadsheet className="h-4 w-4 mr-1" /> รายงานงบการเงิน
            </TabsTrigger>
            <TabsTrigger value="settings" data-testid="tab-settings" className="data-[state=active]:bg-[#fb9678] data-[state=active]:text-white">
              <Settings className="h-4 w-4 mr-1" /> ตั้งค่างบการเงิน
            </TabsTrigger>
          </TabsList>

          <TabsContent value="settings">
            {companyId && <SettingsTab companyId={companyId} />}
          </TabsContent>

          <TabsContent value="report">
            <Card className="border-0 shadow-md mb-4 no-print">
              <CardContent className="p-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div>
                      <Label className="text-xs font-bold">ปีบัญชี (ค.ศ.)</Label>
                      <Input type="number" className="w-28" value={fiscalYear} onChange={e => setFiscalYear(Number(e.target.value))} data-testid="input-fiscal-year" />
                      <span className="text-xs text-muted-foreground">พ.ศ. {buddhYear}</span>
                    </div>
                    {signerName ? (
                      <span className="text-sm text-muted-foreground">ผู้ลงนาม: <strong>{signerName}</strong> ({signerTitle})</span>
                    ) : (
                      <span className="text-sm text-amber-500">ยังไม่ได้ตั้งค่าผู้ลงนาม — <button className="underline text-[#fb9678]" onClick={() => setActiveTab("settings")}>ไปตั้งค่า</button></span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="border-green-400 text-green-600 hover:bg-green-50" onClick={() => refetch()} disabled={isLoading} data-testid="button-generate">
                      <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? "animate-spin" : ""}`} /> สร้างรายงาน
                    </Button>
                    <Button size="sm" className="text-white" style={{ background: "var(--theme-primary)" }} onClick={handlePrintAll} data-testid="button-print-all">
                      <Printer className="h-4 w-4 mr-1" /> ดาวน์โหลดทุกไฟล์ / PDF
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleExcel} data-testid="button-excel">
                      <Download className="h-4 w-4 mr-1" /> Excel
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">กำลังโหลดข้อมูล...</div>
            ) : !data ? (
              <div className="text-center py-12 text-muted-foreground">ไม่พบข้อมูล — กรุณากดปุ่ม "สร้างรายงาน"</div>
            ) : (
              <Tabs value={reportTab} onValueChange={setReportTab} className={printAllMode ? "print:hidden" : ""}>
                <TabsList className="mb-4 no-print flex-wrap">
                  <TabsTrigger value="balance-sheet" data-testid="tab-bs" className="data-[state=active]:bg-[#fb9678] data-[state=active]:text-white">งบฐานะการเงิน</TabsTrigger>
                  <TabsTrigger value="income-statement" data-testid="tab-is" className="data-[state=active]:bg-[#fb9678] data-[state=active]:text-white">งบกำไรขาดทุน</TabsTrigger>
                  <TabsTrigger value="equity-changes" data-testid="tab-eq" className="data-[state=active]:bg-[#fb9678] data-[state=active]:text-white">งบเปลี่ยนแปลงส่วนของผู้ถือหุ้น</TabsTrigger>
                  <TabsTrigger value="notes" data-testid="tab-notes" className="data-[state=active]:bg-[#fb9678] data-[state=active]:text-white">หมายเหตุ</TabsTrigger>
                </TabsList>

                <TabsContent value="balance-sheet">
                  <div className="space-y-4 fs-statement-page">
                    <div className="flex gap-2 no-print">
                      <Button size="sm" className="bg-[#fb9678] hover:bg-[#e8876a]" onClick={() => setPreviewMode("bs")} data-testid="button-print-bs">
                        <Printer className="h-4 w-4 mr-1" /> พิมพ์ / PDF
                      </Button>
                      <Button size="sm" className="text-white" style={{ background: "var(--theme-primary)" }} onClick={() => setPreviewMode("all")} data-testid="button-print-all-bs">
                        <Printer className="h-4 w-4 mr-1" /> ดาวน์โหลดทุกไฟล์ / PDF
                      </Button>
                    </div>
                    <Card className="border-0 shadow-md print:shadow-none">
                      <CardContent className="p-6">
                        {renderBSPage()}
                        <StatementFooter signerName={signerName} signerTitle={signerTitle} />
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="income-statement">
                  <div className="space-y-4 fs-statement-page">
                    <div className="flex gap-2 no-print">
                      <Button size="sm" className="bg-[#fb9678] hover:bg-[#e8876a]" onClick={() => setPreviewMode("is")} data-testid="button-print-is">
                        <Printer className="h-4 w-4 mr-1" /> พิมพ์ / PDF
                      </Button>
                      <Button size="sm" className="text-white" style={{ background: "var(--theme-primary)" }} onClick={() => setPreviewMode("all")} data-testid="button-print-all-is">
                        <Printer className="h-4 w-4 mr-1" /> ดาวน์โหลดทุกไฟล์ / PDF
                      </Button>
                    </div>
                    <Card className="border-0 shadow-md print:shadow-none">
                      <CardContent className="p-6">
                        {renderISPage()}
                        <StatementFooter signerName={signerName} signerTitle={signerTitle} />
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="equity-changes">
                  <div className="space-y-4 fs-statement-page">
                    <div className="flex gap-2 no-print">
                      <Button size="sm" className="bg-[#fb9678] hover:bg-[#e8876a]" onClick={() => setPreviewMode("eq")} data-testid="button-print-eq">
                        <Printer className="h-4 w-4 mr-1" /> พิมพ์ / PDF
                      </Button>
                      <Button size="sm" className="text-white" style={{ background: "var(--theme-primary)" }} onClick={() => setPreviewMode("all")} data-testid="button-print-all-eq">
                        <Printer className="h-4 w-4 mr-1" /> ดาวน์โหลดทุกไฟล์ / PDF
                      </Button>
                    </div>
                    <Card className="border-0 shadow-md print:shadow-none">
                      <CardContent className="p-6">
                        {renderEQPage()}
                        <StatementFooter signerName={signerName} signerTitle={signerTitle} showQualification={false} />
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="notes">
                  <div className="space-y-4 fs-statement-page">
                    <div className="flex gap-2 no-print">
                      <Button size="sm" className="bg-[#fb9678] hover:bg-[#e8876a]" onClick={() => setPreviewMode("notes")} data-testid="button-print-notes">
                        <Printer className="h-4 w-4 mr-1" /> พิมพ์ / PDF
                      </Button>
                      <Button size="sm" className="text-white" style={{ background: "var(--theme-primary)" }} onClick={() => setPreviewMode("all")} data-testid="button-print-all-notes">
                        <Printer className="h-4 w-4 mr-1" /> ดาวน์โหลดทุกไฟล์ / PDF
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => navigate("/reports/financial-notes")} data-testid="button-edit-notes">
                        แก้ไขหมายเหตุ
                      </Button>
                    </div>
                    <Card className="border-0 shadow-md print:shadow-none">
                      <CardContent className="p-6">
                        {renderNotesPage()}
                        <StatementFooter signerName={signerName} signerTitle={signerTitle} showNoteRef={false} showQualification={false} />
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </TabsContent>
        </Tabs>

        {data && (
          <div className={`fs-print-all-container ${printAllMode ? 'fs-print-active' : ''}`} style={{ position: 'absolute', left: '-9999px', top: 0, width: '210mm' }}>
            <div className="fs-print-page">
              {renderBSPage()}
              <StatementFooter signerName={signerName} signerTitle={signerTitle} />
            </div>
            <div className="fs-print-page" style={{ pageBreakBefore: "always" }}>
              {renderISPage()}
              <StatementFooter signerName={signerName} signerTitle={signerTitle} />
            </div>
            <div className="fs-print-page" style={{ pageBreakBefore: "always" }}>
              {renderEQPage()}
              <StatementFooter signerName={signerName} signerTitle={signerTitle} showQualification={false} />
            </div>
            <div className="fs-print-page" style={{ pageBreakBefore: "always" }}>
              {renderNotesPage()}
              <StatementFooter signerName={signerName} signerTitle={signerTitle} showNoteRef={false} showQualification={false} />
            </div>
          </div>
        )}

        {previewMode && data && createPortal(
          <div className="fixed inset-0 bg-gray-100 flex flex-col no-print" style={{ zIndex: 9999 }}>
            <div className="bg-white border-b shadow-sm px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h3 className="font-bold text-sm">
                  ตัวอย่างก่อนพิมพ์ —{" "}
                  {previewMode === "bs" && "งบฐานะการเงิน"}
                  {previewMode === "is" && "งบกำไรขาดทุน"}
                  {previewMode === "eq" && "งบเปลี่ยนแปลงส่วนของผู้ถือหุ้น"}
                  {previewMode === "notes" && "หมายเหตุประกอบงบการเงิน"}
                  {previewMode === "all" && "งบการเงินทั้งหมด (4 หน้า)"}
                </h3>
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="bg-[#fb9678] hover:bg-[#e8876a] text-white" onClick={handlePreviewPrint}>
                  <Printer className="h-4 w-4 mr-1" /> พิมพ์ / ดาวน์โหลด PDF
                </Button>
                <Button size="sm" variant="outline" onClick={() => setPreviewMode(null)}>
                  ปิด
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-6">
              <div className="max-w-[210mm] mx-auto bg-white shadow-lg rounded-lg">
                {(previewMode === "bs" || previewMode === "all") && (
                  <div className="p-8 border-b-2 border-dashed border-gray-300 last:border-b-0">
                    {renderBSPage()}
                    <StatementFooter signerName={signerName} signerTitle={signerTitle} />
                  </div>
                )}
                {(previewMode === "is" || previewMode === "all") && (
                  <div className="p-8 border-b-2 border-dashed border-gray-300 last:border-b-0">
                    {renderISPage()}
                    <StatementFooter signerName={signerName} signerTitle={signerTitle} />
                  </div>
                )}
                {(previewMode === "eq" || previewMode === "all") && (
                  <div className="p-8 border-b-2 border-dashed border-gray-300 last:border-b-0">
                    {renderEQPage()}
                    <StatementFooter signerName={signerName} signerTitle={signerTitle} showQualification={false} />
                  </div>
                )}
                {(previewMode === "notes" || previewMode === "all") && (
                  <div className="p-8">
                    {renderNotesPage()}
                    <StatementFooter signerName={signerName} signerTitle={signerTitle} showNoteRef={false} showQualification={false} />
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    </ReportLayout>
  );
}
