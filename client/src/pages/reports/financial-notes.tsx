import { useState, useRef, useEffect } from "react";
import ReportLayout from "@/components/report-layout";
import { useCompany } from "@/lib/company-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { FileText, Save, Printer, RefreshCw, ChevronDown, ChevronRight, Plus, Trash2, GripVertical, Check, Upload, Sparkles, FileUp, Loader2, FileDown } from "lucide-react";
import * as XLSX from "xlsx";
import { apiRequest } from "@/lib/queryClient";

interface NoteSection {
  id: string;
  title: string;
  content: string;
}

export default function FinancialNotes() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const printRef = useRef<HTMLDivElement>(null);

  const currentYear = new Date().getFullYear();
  const [fiscalYear, setFiscalYear] = useState(currentYear);
  const [sections, setSections] = useState<NoteSection[]>([]);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [hasChanges, setHasChanges] = useState(false);
  const [isPrintMode, setIsPrintMode] = useState(false);
  const [showPdfImport, setShowPdfImport] = useState(false);
  const [pdfImporting, setPdfImporting] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const { data: savedNotes, isLoading } = useQuery<any>({
    queryKey: ["/api/financial-notes", companyId, fiscalYear],
    queryFn: async () => {
      const res = await fetch(`/api/financial-notes?companyId=${companyId}&fiscalYear=${fiscalYear}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!companyId && !!fiscalYear,
  });

  const loadDefaultsMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/financial-notes/defaults?companyId=${companyId}&fiscalYear=${fiscalYear}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: (data) => {
      setSections(data.sections);
      setExpandedSections(new Set(data.sections.map((s: NoteSection) => s.id)));
      setHasChanges(true);
      toast({ title: "โหลดข้อมูลเริ่มต้นสำเร็จ" });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (status?: string) => {
      const res = await apiRequest("POST", "/api/financial-notes", {
        companyId, fiscalYear, sections, status,
      });
      return res.json();
    },
    onSuccess: () => {
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ["/api/financial-notes", companyId, fiscalYear] });
      toast({ title: "บันทึกสำเร็จ" });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  useEffect(() => {
    if (savedNotes?.sections && Array.isArray(savedNotes.sections)) {
      setSections(savedNotes.sections as NoteSection[]);
      const ids = (savedNotes.sections as NoteSection[]).map(s => s.id);
      setExpandedSections(new Set(ids));
      setHasChanges(false);
    }
  }, [savedNotes]);

  const loadSaved = () => {
    if (savedNotes?.sections && Array.isArray(savedNotes.sections)) {
      setSections(savedNotes.sections as NoteSection[]);
      setExpandedSections(new Set((savedNotes.sections as NoteSection[]).map(s => s.id)));
      setHasChanges(false);
    }
  };

  const toggleSection = (id: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const updateSection = (id: string, field: "title" | "content", value: string) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
    setHasChanges(true);
  };

  const addSection = () => {
    const newId = `custom_${Date.now()}`;
    const num = sections.length + 1;
    setSections(prev => [...prev, { id: newId, title: `${num}. หัวข้อใหม่`, content: "" }]);
    setExpandedSections(prev => { const n = new Set(Array.from(prev)); n.add(newId); return n; });
    setHasChanges(true);
  };

  const removeSection = (id: string) => {
    setSections(prev => prev.filter(s => s.id !== id));
    setHasChanges(true);
  };

  const handlePdfImport = async (useAi: boolean) => {
    const file = pdfInputRef.current?.files?.[0];
    if (!file) {
      toast({ title: "กรุณาเลือกไฟล์ PDF", variant: "destructive" });
      return;
    }
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast({ title: "กรุณาเลือกไฟล์ PDF เท่านั้น", variant: "destructive" });
      return;
    }
    setPdfImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("useAi", String(useAi));
      const res = await fetch("/api/financial-notes/import-pdf", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "เกิดข้อผิดพลาด");
      }
      const data = await res.json();
      if (data.sections && Array.isArray(data.sections) && data.sections.length > 0) {
        setSections(data.sections);
        setExpandedSections(new Set(data.sections.map((s: NoteSection) => s.id)));
        setHasChanges(true);
        setShowPdfImport(false);
        if (pdfInputRef.current) pdfInputRef.current.value = "";
        toast({
          title: "นำเข้าสำเร็จ",
          description: `อ่านได้ ${data.sections.length} หัวข้อ จาก ${data.pageCount} หน้า${useAi ? " (ใช้ AI วิเคราะห์)" : ""}`,
        });
      } else {
        toast({ title: "ไม่พบข้อมูลหมายเหตุใน PDF", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    } finally {
      setPdfImporting(false);
    }
  };

  const handleExcel = () => {
    const rows: (string | number)[][] = [
      ["หมายเหตุประกอบงบการเงิน"],
      [selectedCompany?.name || ""],
      [`สำหรับปีสิ้นสุดวันที่ 31 ธันวาคม ${fiscalYear + 543}`],
      [],
    ];
    sections.forEach((section) => {
      rows.push([section.title]);
      if (section.content) {
        section.content.split("\n").forEach((line) => {
          rows.push(["", line]);
        });
      }
      rows.push([]);
    });
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "หมายเหตุ");
    XLSX.writeFile(wb, "financial-notes.xlsx");
  };

  const handlePrint = () => {
    setIsPrintMode(true);
    setTimeout(() => {
      window.print();
      setIsPrintMode(false);
    }, 300);
  };

  const yearOptions = [];
  for (let y = currentYear + 1; y >= currentYear - 5; y--) {
    yearOptions.push(y);
  }

  if (isPrintMode) {
    return (
      <div className="p-8 max-w-4xl mx-auto bg-white print:p-0" ref={printRef}>
        <style>{`@media print { body * { visibility: hidden; } #print-content, #print-content * { visibility: visible; } #print-content { position: absolute; left: 0; top: 0; width: 100%; } }`}</style>
        <div id="print-content">
          <div className="text-center mb-8">
            <h1 className="text-xl font-bold">หมายเหตุประกอบงบการเงิน</h1>
            <h2 className="text-lg font-semibold mt-1">{selectedCompany?.name}</h2>
            <p className="text-sm text-gray-600">สำหรับปีสิ้นสุดวันที่ 31 ธันวาคม {fiscalYear + 543}</p>
          </div>
          {sections.map((section) => (
            <div key={section.id} className="mb-6">
              <h3 className="font-bold text-base mb-2">{section.title}</h3>
              <div className="whitespace-pre-wrap text-sm leading-relaxed pl-4">{section.content}</div>
            </div>
          ))}
        </div>
        <div className="print:hidden mt-8 text-center">
          <Button variant="outline" onClick={() => setIsPrintMode(false)} data-testid="button-close-print">
            ปิดตัวอย่างก่อนพิมพ์
          </Button>
        </div>
      </div>
    );
  }

  return (
    <ReportLayout title="หมายเหตุประกอบงบการเงิน" icon={<FileText className="h-5 w-5" />}>
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[150px]">
            <label className="text-sm text-gray-500 block mb-1">ปีบัญชี (พ.ศ.)</label>
            <Select value={String(fiscalYear)} onValueChange={(v) => { setFiscalYear(Number(v)); setHasChanges(false); }}>
              <SelectTrigger data-testid="select-fiscal-year">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map(y => (
                  <SelectItem key={y} value={String(y)}>{y + 543}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            variant="outline"
            onClick={() => loadDefaultsMutation.mutate()}
            disabled={loadDefaultsMutation.isPending}
            data-testid="button-load-defaults"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loadDefaultsMutation.isPending ? "animate-spin" : ""}`} />
            สร้างจากข้อมูลจริง
          </Button>

          <Button
            variant="outline"
            className="border-[var(--theme-primary)] text-[var(--theme-primary)] hover:bg-[var(--theme-primary)]/10"
            onClick={() => setShowPdfImport(true)}
            data-testid="button-import-pdf"
          >
            <Upload className="w-4 h-4 mr-2" />
            นำเข้าจาก PDF ปีเก่า
          </Button>

          {savedNotes && (
            <Button variant="outline" onClick={loadSaved} data-testid="button-load-saved">
              โหลดที่บันทึกไว้
            </Button>
          )}

          <div className="flex-1" />

          {hasChanges && (
            <Badge variant="outline" className="text-amber-600 border-amber-300">
              มีการแก้ไข (ยังไม่บันทึก)
            </Badge>
          )}

          <Button
            onClick={() => saveMutation.mutate("draft")}
            disabled={saveMutation.isPending || sections.length === 0}
            className="bg-[#05b187] hover:bg-[#049a76]"
            data-testid="button-save-notes"
          >
            <Save className="w-4 h-4 mr-2" />
            บันทึก
          </Button>

          <Button
            variant="outline"
            onClick={handlePrint}
            disabled={sections.length === 0}
            data-testid="button-print-notes"
          >
            <Printer className="w-4 h-4 mr-2" />
            พิมพ์
          </Button>

          <Button
            className="bg-[#05b187] text-white hover:bg-[#049a75] border-none gap-1.5"
            onClick={handleExcel}
            disabled={sections.length === 0}
            data-testid="button-excel"
          >
            <FileDown className="w-4 h-4" />
            Excel
          </Button>
        </div>

        {savedNotes && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Check className="w-4 h-4 text-green-500" />
            มีข้อมูลที่บันทึกไว้แล้ว (สถานะ: {savedNotes.status === "draft" ? "แบบร่าง" : savedNotes.status === "finalized" ? "สมบูรณ์" : savedNotes.status})
          </div>
        )}

        {isLoading && <div className="text-center py-8 text-gray-500">กำลังโหลด...</div>}

        {!isLoading && sections.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">ยังไม่มีหมายเหตุประกอบงบการเงินสำหรับปี {fiscalYear + 543}</p>
              <Button
                onClick={() => loadDefaultsMutation.mutate()}
                disabled={loadDefaultsMutation.isPending}
                className="bg-[var(--theme-primary)] hover:bg-[#4389e6]"
                data-testid="button-create-defaults"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loadDefaultsMutation.isPending ? "animate-spin" : ""}`} />
                สร้างหมายเหตุจากข้อมูลจริง
              </Button>
            </CardContent>
          </Card>
        )}

        {sections.map((section, idx) => (
          <Card key={section.id} className="border">
            <CardHeader
              className="cursor-pointer py-3 px-4 hover:bg-gray-50"
              onClick={() => toggleSection(section.id)}
            >
              <div className="flex items-center gap-2">
                <GripVertical className="w-4 h-4 text-gray-300" />
                {expandedSections.has(section.id)
                  ? <ChevronDown className="w-4 h-4 text-gray-500" />
                  : <ChevronRight className="w-4 h-4 text-gray-500" />
                }
                <CardTitle className="text-sm font-semibold flex-1" data-testid={`text-section-title-${section.id}`}>
                  {section.title}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-red-400 hover:text-red-600"
                  onClick={(e) => { e.stopPropagation(); removeSection(section.id); }}
                  data-testid={`button-remove-section-${section.id}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </CardHeader>
            {expandedSections.has(section.id) && (
              <CardContent className="pt-0 px-4 pb-4">
                <div className="space-y-2">
                  <Input
                    value={section.title}
                    onChange={(e) => updateSection(section.id, "title", e.target.value)}
                    className="font-semibold text-sm"
                    placeholder="หัวข้อ"
                    data-testid={`input-section-title-${section.id}`}
                  />
                  <Textarea
                    value={section.content}
                    onChange={(e) => updateSection(section.id, "content", e.target.value)}
                    className="min-h-[150px] text-sm leading-relaxed"
                    placeholder="เนื้อหาหมายเหตุ..."
                    data-testid={`textarea-section-content-${section.id}`}
                  />
                </div>
              </CardContent>
            )}
          </Card>
        ))}

        {sections.length > 0 && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={addSection} data-testid="button-add-section">
              <Plus className="w-4 h-4 mr-2" />
              เพิ่มหัวข้อ
            </Button>
          </div>
        )}

        <Dialog open={showPdfImport} onOpenChange={setShowPdfImport}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileUp className="w-5 h-5 text-[var(--theme-primary)]" />
                นำเข้าหมายเหตุจาก PDF ปีเก่า
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                อัพโหลดไฟล์ PDF หมายเหตุประกอบงบการเงินของปีก่อน ระบบจะอ่านและแยกหัวข้อ/เนื้อหาให้อัตโนมัติ เพื่อใช้เป็นต้นแบบสำหรับปีใหม่
              </p>
              <div>
                <input
                  ref={pdfInputRef}
                  type="file"
                  accept=".pdf"
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-[var(--theme-primary)]/10 file:text-[var(--theme-primary)] hover:file:bg-[var(--theme-primary)]/20"
                  data-testid="input-pdf-file"
                />
              </div>
              {pdfImporting && (
                <div className="flex items-center gap-2 text-sm text-[var(--theme-primary)]">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  กำลังอ่านไฟล์ PDF...
                </div>
              )}
              <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500">
                <p className="font-semibold mb-1">รองรับ:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>ไฟล์ PDF ที่มีข้อความ (text-based PDF)</li>
                  <li>ไม่รองรับ PDF ที่เป็นภาพสแกน</li>
                  <li>ขนาดไฟล์ไม่เกิน 20 MB</li>
                </ul>
              </div>
            </div>
            <DialogFooter className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => handlePdfImport(false)}
                disabled={pdfImporting}
                className="flex-1"
                data-testid="button-import-free"
              >
                <FileUp className="w-4 h-4 mr-2" />
                อ่าน PDF (ฟรี)
              </Button>
              <Button
                onClick={() => handlePdfImport(true)}
                disabled={pdfImporting}
                className="flex-1 hover:opacity-90" style={{ background: "var(--theme-primary)" }}
                data-testid="button-import-ai"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                วิเคราะห์ด้วย AI (แม่นยำกว่า)
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </ReportLayout>
  );
}
