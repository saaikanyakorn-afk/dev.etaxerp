import { useState, useRef } from "react";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Plus, Pencil, Trash2, FileText, Play, Upload, Loader2, ChevronDown, ChevronUp,
  Copy, Settings, ArrowLeft, Eye, X, CheckCircle2, XCircle, AlertTriangle,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const FIELD_LABELS: Record<string, string> = {
  invoiceNo: "เลขที่เอกสาร",
  date: "วันที่",
  dueDate: "วันครบกำหนด",
  vendorName: "ชื่อผู้ขาย",
  vendorTaxId: "เลขประจำตัวผู้เสียภาษี",
  vendorAddress: "ที่อยู่ผู้ขาย",
  vendorBranch: "สาขา",
  subtotal: "ยอดก่อนภาษี",
  vatAmount: "ภาษีมูลค่าเพิ่ม",
  totalAmount: "ยอดรวมทั้งสิ้น",
  withholdingTax: "หัก ณ ที่จ่าย",
  lineItems: "รายการสินค้า/บริการ",
};

const EXTRACTION_TYPES = [
  { value: "afterKeyword", label: "หลัง Keyword (ข้อความ/Pattern)" },
  { value: "lastNumberOnLine", label: "ตัวเลขสุดท้ายในบรรทัด" },
  { value: "firstNumberOnLine", label: "ตัวเลขแรกในบรรทัด" },
  { value: "fullLine", label: "ทั้งบรรทัด" },
  { value: "nextLine", label: "บรรทัดถัดไป" },
  { value: "tableRows", label: "ตาราง (header → footer)" },
  { value: "sectionUntil", label: "ส่วนข้อความ (จนถึง keyword)" },
];

interface FieldRule {
  keyword: string;
  pattern?: string;
  extractionType: string;
  stopKeyword?: string;
  headerKeyword?: string;
  footerKeyword?: string;
}

interface Template {
  id: number;
  companyId: number | null;
  name: string;
  description: string | null;
  detectKeywords: string[];
  fieldRules: Record<string, FieldRule>;
  dateFormat: string;
  defaultVatType: string;
  active: boolean;
  priority: number;
  isBuiltIn: boolean;
  createdAt: string;
}

const EMPTY_RULE: FieldRule = { keyword: "", extractionType: "afterKeyword" };

function getDefaultFieldRules(): Record<string, FieldRule> {
  return {
    invoiceNo: { keyword: "เลขที่|Invoice No|No.", extractionType: "afterKeyword", pattern: "([A-Za-z0-9\\-\\/_.]+)" },
    date: { keyword: "วันที่|Date", extractionType: "afterKeyword", pattern: "(\\d{1,2}[/\\-.]\\d{1,2}[/\\-.]\\d{2,4})" },
    vendorName: { keyword: "บริษัท|Company", extractionType: "afterKeyword" },
    vendorTaxId: { keyword: "เลขประจำตัวผู้เสียภาษี|Tax ID", extractionType: "afterKeyword", pattern: "(\\d{13})" },
    subtotal: { keyword: "รวมเป็นเงิน|Subtotal|มูลค่าก่อนภาษี", extractionType: "lastNumberOnLine" },
    vatAmount: { keyword: "ภาษีมูลค่าเพิ่ม|VAT 7%", extractionType: "lastNumberOnLine" },
    totalAmount: { keyword: "รวมทั้งสิ้น|Grand Total|ยอดรวมสุทธิ", extractionType: "lastNumberOnLine" },
  };
}

export function ImportTemplatesContent() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Template | null>(null);
  const [creating, setCreating] = useState(false);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<any>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [extractText, setExtractText] = useState<string | null>(null);
  const [extractLoading, setExtractLoading] = useState(false);
  const testFileRef = useRef<HTMLInputElement>(null);
  const extractFileRef = useRef<HTMLInputElement>(null);

  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formKeywords, setFormKeywords] = useState("");
  const [formDateFormat, setFormDateFormat] = useState("DD/MM/YYYY");
  const [formVatType, setFormVatType] = useState("vat7");
  const [formPriority, setFormPriority] = useState(0);
  const [formActive, setFormActive] = useState(true);
  const [formRules, setFormRules] = useState<Record<string, FieldRule>>(getDefaultFieldRules());
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set(["invoiceNo", "date", "vendorName", "totalAmount"]));
  const [saving, setSaving] = useState(false);

  const { data: templates = [], isLoading } = useQuery<Template[]>({
    queryKey: ["/api/pdf-import-templates"],
    queryFn: async () => {
      const r = await fetch("/api/pdf-import-templates", { credentials: "include" });
      return r.ok ? r.json() : [];
    },
  });

  const openCreate = () => {
    setFormName("");
    setFormDesc("");
    setFormKeywords("");
    setFormDateFormat("DD/MM/YYYY");
    setFormVatType("vat7");
    setFormPriority(0);
    setFormActive(true);
    setFormRules(getDefaultFieldRules());
    setEditing(null);
    setCreating(true);
  };

  const openEdit = (t: Template) => {
    setFormName(t.name);
    setFormDesc(t.description || "");
    setFormKeywords(t.detectKeywords.join(", "));
    setFormDateFormat(t.dateFormat || "DD/MM/YYYY");
    setFormVatType(t.defaultVatType || "vat7");
    setFormPriority(t.priority || 0);
    setFormActive(t.active);
    setFormRules(t.fieldRules || getDefaultFieldRules());
    setCreating(false);
    setEditing(t);
  };

  const toggleField = (key: string) => setExpandedFields(prev => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  const updateRule = (fieldKey: string, updates: Partial<FieldRule>) => {
    setFormRules(prev => ({
      ...prev,
      [fieldKey]: { ...((prev[fieldKey] || EMPTY_RULE)), ...updates } as FieldRule,
    }));
  };

  const removeRule = (fieldKey: string) => {
    setFormRules(prev => {
      const next = { ...prev };
      delete next[fieldKey];
      return next;
    });
  };

  const handleSave = async () => {
    if (!formName.trim()) return toast({ title: "กรุณาระบุชื่อ Template", variant: "destructive" });
    if (!formKeywords.trim()) return toast({ title: "กรุณาระบุคำค้นหา (Detect Keywords)", variant: "destructive" });

    const keywords = formKeywords.split(",").map(k => k.trim()).filter(Boolean);
    const activeRules: Record<string, FieldRule> = {};
    for (const [key, rule] of Object.entries(formRules)) {
      if (rule.keyword.trim()) activeRules[key] = rule;
    }

    setSaving(true);
    try {
      const body = {
        name: formName.trim(),
        description: formDesc.trim() || null,
        detectKeywords: keywords,
        fieldRules: activeRules,
        dateFormat: formDateFormat,
        defaultVatType: formVatType,
        priority: formPriority,
        active: formActive,
      };

      const url = editing ? `/api/pdf-import-templates/${editing.id}` : "/api/pdf-import-templates";
      const method = editing ? "PATCH" : "POST";

      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.message || "บันทึกไม่สำเร็จ");
      }

      toast({ title: editing ? "อัปเดตสำเร็จ" : "สร้างสำเร็จ" });
      qc.invalidateQueries({ queryKey: ["/api/pdf-import-templates"] });
      setEditing(null);
      setCreating(false);
    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("ต้องการลบ Template นี้?")) return;
    const r = await fetch(`/api/pdf-import-templates/${id}`, { method: "DELETE", credentials: "include" });
    if (r.ok) {
      toast({ title: "ลบสำเร็จ" });
      qc.invalidateQueries({ queryKey: ["/api/pdf-import-templates"] });
    } else {
      const err = await r.json().catch(() => ({}));
      toast({ title: err.message || "ลบไม่สำเร็จ", variant: "destructive" });
    }
  };

  const handleToggleActive = async (t: Template) => {
    const r = await fetch(`/api/pdf-import-templates/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ active: !t.active }),
    });
    if (r.ok) qc.invalidateQueries({ queryKey: ["/api/pdf-import-templates"] });
  };

  const handleTest = async (id: number) => {
    setTestingId(id);
    setTestResult(null);
    testFileRef.current?.click();
  };

  const onTestFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !testingId) return;
    e.target.value = "";

    setTestLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch(`/api/pdf-import-templates/${testingId}/test`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const data = await r.json();
      setTestResult(data);
    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" });
    } finally {
      setTestLoading(false);
    }
  };

  const handleExtractText = () => {
    setExtractText(null);
    extractFileRef.current?.click();
  };

  const onExtractFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setExtractLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/pdf-import-templates/extract-text", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const data = await r.json();
      setExtractText(data.rawText || "ไม่พบข้อความ");
    } catch {
      toast({ title: "อ่าน PDF ไม่สำเร็จ", variant: "destructive" });
    } finally {
      setExtractLoading(false);
    }
  };

  const isFormOpen = creating || !!editing;

  if (isFormOpen) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => { setCreating(false); setEditing(null); }} data-testid="btn-back-templates">
            <ArrowLeft className="w-4 h-4 mr-1" /> กลับ
          </Button>
          <h1 className="text-lg font-bold text-gray-800">
            {editing ? `แก้ไข: ${editing.name}` : "สร้างรูปแบบนำเข้าใหม่"}
          </h1>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">ชื่อรูปแบบ *</Label>
                <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="เช่น Shopee Invoice 2026" data-testid="input-template-name" className="mt-1" />
              </div>
              <div>
                <Label className="text-sm font-medium">ลำดับความสำคัญ</Label>
                <Input type="number" value={formPriority} onChange={e => setFormPriority(Number(e.target.value))} className="mt-1" data-testid="input-priority" />
                <p className="text-[11px] text-gray-400 mt-0.5">เลขยิ่งมาก ยิ่งจับคู่ก่อน</p>
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium">คำอธิบาย</Label>
              <Textarea value={formDesc} onChange={e => setFormDesc(e.target.value)} rows={2} placeholder="อธิบายว่า template นี้ใช้กับเอกสารแบบไหน" className="mt-1" data-testid="input-template-desc" />
            </div>

            <div>
              <Label className="text-sm font-medium">คำค้นหาตรวจจับ (Detect Keywords) *</Label>
              <Input value={formKeywords} onChange={e => setFormKeywords(e.target.value)} placeholder="Shopee, SPX Express (คั่นด้วยเครื่องหมาย ,)" className="mt-1" data-testid="input-detect-keywords" />
              <p className="text-[11px] text-gray-400 mt-0.5">ใส่คำที่ต้องพบ "ทั้งหมด" ใน PDF ถึงจะใช้ Template นี้ (คั่นด้วย , = ต้องพบทุกคำ)</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-sm font-medium">รูปแบบวันที่</Label>
                <Select value={formDateFormat} onValueChange={setFormDateFormat}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                    <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                    <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium">VAT เริ่มต้น</Label>
                <Select value={formVatType} onValueChange={setFormVatType}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vat7">VAT 7%</SelectItem>
                    <SelectItem value="non_vat">ไม่มี VAT</SelectItem>
                    <SelectItem value="vat0">VAT 0%</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3 pt-6">
                <Switch checked={formActive} onCheckedChange={setFormActive} data-testid="switch-active" />
                <Label className="text-sm">เปิดใช้งาน</Label>
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-700">กฎการดึงข้อมูล (Field Rules)</h3>
                <Button size="sm" variant="outline" onClick={handleExtractText} disabled={extractLoading} data-testid="btn-extract-text">
                  {extractLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Eye className="w-3.5 h-3.5 mr-1" />}
                  ดูข้อความจาก PDF
                </Button>
              </div>
              <input type="file" accept=".pdf" ref={extractFileRef} className="hidden" onChange={onExtractFileSelected} />

              {extractText && (
                <div className="mb-4 border rounded-lg bg-gray-50 p-3 relative">
                  <button className="absolute top-2 right-2 p-1 hover:bg-gray-200 rounded" onClick={() => setExtractText(null)}>
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <p className="text-xs font-medium text-gray-600 mb-2">ข้อความที่อ่านได้จาก PDF (ใช้อ้างอิงในการตั้ง keyword):</p>
                  <pre className="text-[11px] text-gray-700 whitespace-pre-wrap max-h-60 overflow-y-auto font-mono bg-white p-2 rounded border">{extractText}</pre>
                </div>
              )}

              <div className="space-y-2">
                {Object.entries(FIELD_LABELS).map(([key, label]) => {
                  const rule = formRules[key];
                  const isExpanded = expandedFields.has(key);
                  const hasRule = !!rule?.keyword?.trim();

                  return (
                    <div key={key} className={`border rounded-lg transition-colors ${hasRule ? "border-green-200 bg-green-50/30" : "border-gray-200"}`}>
                      <button
                        className="flex items-center justify-between w-full px-3 py-2 text-left"
                        onClick={() => toggleField(key)}
                        data-testid={`field-toggle-${key}`}
                      >
                        <div className="flex items-center gap-2">
                          {hasRule ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <XCircle className="w-3.5 h-3.5 text-gray-300" />}
                          <span className="text-sm font-medium">{label}</span>
                          {hasRule && <Badge variant="secondary" className="text-[10px]">{rule.extractionType}</Badge>}
                        </div>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                      {isExpanded && (
                        <div className="px-3 pb-3 space-y-2 border-t">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                            <div>
                              <Label className="text-xs">Keyword (คำค้นหาในบรรทัด)</Label>
                              <Input
                                value={rule?.keyword || ""}
                                onChange={e => updateRule(key, { keyword: e.target.value })}
                                placeholder="เช่น เลขที่|Invoice No"
                                className="text-xs mt-0.5 h-8"
                                data-testid={`input-rule-keyword-${key}`}
                              />
                              <p className="text-[10px] text-gray-400 mt-0.5">ใช้ | คั่นเพื่อลองหลายคำ (OR)</p>
                            </div>
                            <div>
                              <Label className="text-xs">วิธีดึงค่า</Label>
                              <Select value={rule?.extractionType || "afterKeyword"} onValueChange={v => updateRule(key, { extractionType: v })}>
                                <SelectTrigger className="text-xs mt-0.5 h-8"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {EXTRACTION_TYPES.map(t => (
                                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {(rule?.extractionType === "afterKeyword" || rule?.extractionType === "nextLine") && (
                            <div>
                              <Label className="text-xs">Pattern (Regex) — ไม่บังคับ</Label>
                              <Input
                                value={rule?.pattern || ""}
                                onChange={e => updateRule(key, { pattern: e.target.value })}
                                placeholder="เช่น ([A-Z0-9\\-]+)"
                                className="text-xs mt-0.5 h-8 font-mono"
                                data-testid={`input-rule-pattern-${key}`}
                              />
                              <p className="text-[10px] text-gray-400 mt-0.5">ถ้าไม่ใส่ จะเอาข้อความทั้งหมดหลัง keyword</p>
                            </div>
                          )}

                          {rule?.extractionType === "tableRows" && (
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label className="text-xs">Header Keyword</Label>
                                <Input
                                  value={rule?.headerKeyword || rule?.keyword || ""}
                                  onChange={e => updateRule(key, { headerKeyword: e.target.value })}
                                  placeholder="เช่น รายการ|Description"
                                  className="text-xs mt-0.5 h-8"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Footer Keyword</Label>
                                <Input
                                  value={rule?.footerKeyword || ""}
                                  onChange={e => updateRule(key, { footerKeyword: e.target.value })}
                                  placeholder="เช่น รวมเป็นเงิน|Total"
                                  className="text-xs mt-0.5 h-8"
                                />
                              </div>
                            </div>
                          )}

                          {rule?.extractionType === "sectionUntil" && (
                            <div>
                              <Label className="text-xs">Stop Keyword</Label>
                              <Input
                                value={rule?.stopKeyword || ""}
                                onChange={e => updateRule(key, { stopKeyword: e.target.value })}
                                placeholder="หยุดเมื่อเจอคำนี้"
                                className="text-xs mt-0.5 h-8"
                              />
                            </div>
                          )}

                          {hasRule && (
                            <div className="text-right">
                              <Button variant="ghost" size="sm" className="text-xs text-red-500 hover:text-red-700" onClick={() => removeRule(key)}>
                                ล้างกฎ
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t pt-4">
              <Button variant="outline" onClick={() => { setCreating(false); setEditing(null); }} data-testid="btn-cancel-template">ยกเลิก</Button>
              <Button onClick={handleSave} disabled={saving} className="bg-[#fb9678] hover:bg-[#e8856a]" data-testid="btn-save-template">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                {editing ? "บันทึก" : "สร้าง Template"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-800" data-testid="text-page-title">รูปแบบนำเข้า PDF</h1>
          <p className="text-xs text-gray-500 mt-0.5">กำหนดวิธีอ่านข้อมูลจาก PDF ของแต่ละผู้ขาย/ระบบ</p>
        </div>
        <Button onClick={openCreate} className="bg-[#fb9678] hover:bg-[#e8856a]" data-testid="btn-create-template">
          <Plus className="w-4 h-4 mr-1" /> สร้างรูปแบบ
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <input type="file" accept=".pdf" ref={testFileRef} className="hidden" onChange={onTestFileSelected} />

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-[#fb9678]" />
            </div>
          ) : templates.length === 0 ? (
            <div className="py-16 text-center">
              <Settings className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-sm text-gray-500">ยังไม่มีรูปแบบนำเข้า</p>
              <p className="text-xs text-gray-400 mt-1">สร้างรูปแบบเพื่อกำหนดวิธีอ่าน PDF อัตโนมัติ</p>
            </div>
          ) : (
            <div className="divide-y">
              {templates.map(t => (
                <div key={t.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 group" data-testid={`template-row-${t.id}`}>
                  <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
                    <FileText className="w-4 h-4 text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-800">{t.name}</span>
                      {t.isBuiltIn && <Badge variant="secondary" className="text-[10px]">ระบบ</Badge>}
                      {!t.active && <Badge variant="outline" className="text-[10px] text-red-500 border-red-300">ปิดใช้งาน</Badge>}
                      <Badge variant="outline" className="text-[10px] text-gray-400">ลำดับ: {t.priority}</Badge>
                    </div>
                    <div className="text-xs text-gray-500 truncate mt-0.5">
                      Keywords: {t.detectKeywords.join(", ")}
                      {t.description && ` — ${t.description}`}
                    </div>
                    <div className="text-[10px] text-gray-400 mt-0.5">
                      กฎ: {Object.keys(t.fieldRules || {}).filter(k => (t.fieldRules as any)?.[k]?.keyword).length} field
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Switch checked={t.active} onCheckedChange={() => handleToggleActive(t)} data-testid={`switch-active-${t.id}`} />
                    <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => handleTest(t.id)} title="ทดสอบ" data-testid={`btn-test-${t.id}`}>
                      <Play className="w-3.5 h-3.5 text-green-600" />
                    </Button>
                    <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => openEdit(t)} title="แก้ไข" data-testid={`btn-edit-${t.id}`}>
                      <Pencil className="w-3.5 h-3.5 text-gray-500" />
                    </Button>
                    {!t.isBuiltIn && (
                      <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => handleDelete(t.id)} title="ลบ" data-testid={`btn-delete-${t.id}`}>
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {(testLoading || testResult) && (
        <Dialog open onOpenChange={() => { setTestResult(null); setTestLoading(false); setTestingId(null); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-sm">ผลทดสอบ Template</DialogTitle>
            </DialogHeader>
            {testLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-[#fb9678]" />
                <span className="ml-2 text-sm text-gray-500">กำลังอ่าน PDF...</span>
              </div>
            ) : testResult && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  {testResult.matched ? (
                    <Badge className="bg-green-100 text-green-700"><CheckCircle2 className="w-3 h-3 mr-1" />จับคู่สำเร็จ</Badge>
                  ) : (
                    <Badge className="bg-red-100 text-red-700"><AlertTriangle className="w-3 h-3 mr-1" />ไม่ตรง</Badge>
                  )}
                  <span className="text-xs text-gray-500">{testResult.message}</span>
                </div>

                {testResult.result && (
                  <div className="border rounded-lg p-3 bg-gray-50 space-y-2">
                    <h4 className="text-xs font-bold text-gray-700">ข้อมูลที่ดึงได้:</h4>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {[
                        ["เลขที่เอกสาร", testResult.result.invoiceNo],
                        ["วันที่", testResult.result.date],
                        ["ผู้ขาย", testResult.result.vendorName],
                        ["Tax ID", testResult.result.vendorTaxId],
                        ["ที่อยู่", testResult.result.vendorAddress],
                        ["สาขา", testResult.result.vendorBranch],
                        ["ยอดก่อนภาษี", testResult.result.subtotal?.toLocaleString("th-TH", { minimumFractionDigits: 2 })],
                        ["VAT", testResult.result.vatAmount?.toLocaleString("th-TH", { minimumFractionDigits: 2 })],
                        ["ยอดรวม", testResult.result.totalAmount?.toLocaleString("th-TH", { minimumFractionDigits: 2 })],
                        ["หัก ณ ที่จ่าย", testResult.result.withholdingTax?.toLocaleString("th-TH", { minimumFractionDigits: 2 })],
                      ].map(([label, value]) => (
                        <div key={label as string} className="flex gap-2">
                          <span className="text-gray-500 w-28 flex-shrink-0">{label}:</span>
                          <span className="font-medium text-gray-800">{value || "-"}</span>
                        </div>
                      ))}
                    </div>
                    {testResult.result.items?.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-medium text-gray-600 mb-1">รายการ ({testResult.result.items.length}):</p>
                        {testResult.result.items.map((it: any, idx: number) => (
                          <div key={idx} className="text-[11px] text-gray-600 py-0.5">
                            {idx + 1}. {it.description} — ฿{it.amount?.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {testResult.rawText && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-gray-500 hover:text-gray-700">ดูข้อความ PDF ทั้งหมด</summary>
                    <pre className="mt-1 p-2 bg-gray-100 rounded text-[11px] whitespace-pre-wrap max-h-40 overflow-y-auto font-mono">{testResult.rawText}</pre>
                  </details>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

export default function ImportTemplatesPage() {
  return (
    <Layout>
      <ImportTemplatesContent />
    </Layout>
  );
}
