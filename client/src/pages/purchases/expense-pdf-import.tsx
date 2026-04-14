import { useState, useRef, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/lib/company-context";
import ImportBatchHistory from "@/components/import-batch-history";
import {
  Upload, FileImage, CheckCircle2, XCircle,
  AlertCircle, ArrowLeft, FileText, Loader2, ChevronDown, ChevronUp,
  Sparkles, File, ImageIcon, AlertTriangle, Building2, Paperclip, Edit, Pencil,
  Eye, Zap, X, PenLine,
} from "lucide-react";

interface PreviewItem {
  rowNum: number;
  description: string;
  amount: number;
  vatType: string;
  accountCode: string;
  accountName: string;
  accountConfidence: string;
  accountMatched: boolean;
  errors: string[];
}

interface PreviewDoc {
  key: string;
  expNo: string;
  expDate: string;
  dueDate: string;
  vendorName: string;
  vendorTaxId: string;
  vendorAddress: string;
  branch: string;
  taxInvoiceRef: string;
  notes: string;
  priceMode: string;
  withholdingTax: number;
  whtRate: number;
  whtType: string;
  subtotal: number;
  vatAmount: number;
  totalAmount: number;
  vendorId: number | null;
  vendorMatchName: string | null;
  dbdLookup: boolean;
  items: PreviewItem[];
  errors: string[];
  warnings: string[];
  hasErrors: boolean;
  isDuplicate: boolean;
  confidence: string;
  fileName: string;
  attachedUrl: string;
  paymentMethod?: string;
}

interface ExtractResult {
  totalFiles: number;
  successFiles: number;
  failedFiles: number;
  documents: PreviewDoc[];
  errors: { fileName: string; error: string }[];
}

interface CreateResult {
  created: { expNo: string; id: number }[];
  skipped: { expNo: string; reason: string }[];
  errors: { expNo: string; error: string }[];
  total: number;
}

function fmt(val: number): string {
  return val.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const VAT_LABELS: Record<string, string> = { vat7: "VAT 7%", non_vat: "ไม่มี VAT", zero_rated: "VAT 0%" };
const CONFIDENCE_COLORS: Record<string, string> = {
  high: "bg-emerald-100 text-emerald-700",
  medium: "bg-yellow-100 text-yellow-700",
  low: "bg-red-100 text-red-700",
};
const CONFIDENCE_LABELS: Record<string, string> = { high: "สูง", medium: "ปานกลาง", low: "ต่ำ" };
const ACCT_CONFIDENCE_ICONS: Record<string, any> = {
  high: { icon: CheckCircle2, color: "text-emerald-500", label: "มั่นใจ" },
  medium: { icon: AlertTriangle, color: "text-yellow-500", label: "ปานกลาง" },
  low: { icon: AlertCircle, color: "text-red-500", label: "ไม่มั่นใจ - ตรวจสอบ" },
};
const FALLBACK_PAYMENT_METHODS = [
  { value: "cash", label: "เงินสด" },
  { value: "transfer", label: "โอนเงิน" },
  { value: "cheque", label: "เช็ค" },
  { value: "credit_card", label: "บัตรเครดิต" },
  { value: "promptpay", label: "พร้อมเพย์" },
  { value: "ewallet", label: "E-Wallet" },
];
const WHT_RATES = [
  { value: "0", label: "ไม่หัก ณ ที่จ่าย" },
  { value: "1", label: "1% - ขนส่ง" },
  { value: "2", label: "2% - โฆษณา" },
  { value: "3", label: "3% - บริการ" },
  { value: "5", label: "5% - ค่าเช่า" },
];
const WHT_TYPES = [
  { value: "pnd3", label: "ภ.ง.ด.3 (บุคคลธรรมดา)" },
  { value: "pnd53", label: "ภ.ง.ด.53 (นิติบุคคล)" },
];

export default function ExpensePdfImport() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: companyPaymentMethods = [] } = useQuery<any[]>({
    queryKey: ["/api/payment-methods", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/payment-methods?companyId=${companyId}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!companyId,
  });
  const PAYMENT_METHODS = companyPaymentMethods.length > 0
    ? companyPaymentMethods.map((m: any) => ({ value: m.code || m.name, label: m.name }))
    : FALLBACK_PAYMENT_METHODS;

  const [step, setStep] = useState<"upload" | "staged" | "preview" | "result">("upload");
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [viewingFileUrl, setViewingFileUrl] = useState<string | null>(null);
  const [viewingFileName, setViewingFileName] = useState("");
  const [extractResult, setExtractResult] = useState<ExtractResult | null>(null);
  const [createResult, setCreateResult] = useState<CreateResult | null>(null);
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set());
  const [autoJournal, setAutoJournal] = useState(true);
  const [autoWht, setAutoWht] = useState(true);
  const [fileCount, setFileCount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [globalWhtRate, setGlobalWhtRate] = useState("3");
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState(0);
  const [extractDoneCount, setExtractDoneCount] = useState(0);
  const [extractElapsed, setExtractElapsed] = useState(0);
  const [extractCurrentFile, setExtractCurrentFile] = useState("");
  const [extractErrors, setExtractErrors] = useState<{ fileName: string; error: string }[]>([]);

  const [previewPage, setPreviewPage] = useState(0);
  const PREVIEW_PAGE_SIZE = 50;
  const addMoreInputRef = useRef<HTMLInputElement>(null);

  // ═══════════════════════════════════════════════════════════════════════
  // ⚠️ AI API CALL — Expense PDF Extract (calls OpenAI GPT-4o Vision)
  // This function sends files to /api/pdf-import/extract which calls
  // OpenAI API with real cost. To disable AI: remove or comment out
  // the <Button> with data-testid="button-ai-extract" in the JSX below,
  // and the startAiExtract() function. The FREE "กรอกเอง" button will
  // still work as the manual fallback path.
  // ═══════════════════════════════════════════════════════════════════════
  const processFiles = async (files: File[], append = false) => {
    setIsExtracting(true);
    setExtractProgress(0);
    setExtractDoneCount(0);
    setExtractElapsed(0);
    setExtractCurrentFile("");
    if (!append) setExtractErrors([]);
    const total = files.length;
    setFileCount(append && extractResult ? extractResult.totalFiles + total : total);

    const startTime = Date.now();
    const elapsedInterval = setInterval(() => {
      setExtractElapsed(Math.round((Date.now() - startTime) / 1000));
    }, 500);

    const documents: PreviewDoc[] = [];
    const errors: { fileName: string; error: string }[] = [];
    let successCount = 0;
    let doneCount = 0;

    const BATCH_SIZE = 10;
    for (let batchStart = 0; batchStart < total; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, total);
      const batchFiles = files.slice(batchStart, batchEnd);
      setExtractCurrentFile(total === 1 ? files[0].name : `${batchStart + 1}-${batchEnd} / ${total}`);

      const batchPromises = batchFiles.map(async (file) => {
        try {
          const formData = new FormData();
          formData.append("files", file);
          formData.append("companyId", String(companyId));
          formData.append("docType", "expense");
          const res = await fetch("/api/pdf-import/extract", {
            method: "POST",
            body: formData,
            credentials: "include",
          });
          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.message || "ไม่สามารถอ่านไฟล์ได้");
          }
          const result = await res.json() as ExtractResult;
          doneCount++;
          setExtractDoneCount(doneCount);
          setExtractProgress(Math.round((doneCount / total) * 100));
          return result;
        } catch (err: any) {
          doneCount++;
          setExtractDoneCount(doneCount);
          setExtractProgress(Math.round((doneCount / total) * 100));
          return { error: true, fileName: file.name, message: err.message } as any;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      for (const result of batchResults) {
        if (result.error) {
          errors.push({ fileName: result.fileName, error: result.message });
        } else {
          documents.push(...(result.documents || []));
          errors.push(...(result.errors || []));
          successCount += result.successFiles || 0;
        }
      }
    }
    clearInterval(elapsedInterval);

    const rate = parseFloat(globalWhtRate);
    const finalDocs = rate > 0 ? documents.map(d => {
      if (d.hasErrors) return d;
      const whtAmt = rate > 0 ? Math.round(d.subtotal * rate) / 100 : 0;
      return { ...d, whtRate: rate, withholdingTax: whtAmt };
    }) : documents;

    if (append && extractResult) {
      const prevDocs = extractResult.documents;
      const prevErrors = extractResult.errors;
      const combined: ExtractResult = {
        totalFiles: extractResult.totalFiles + total,
        successFiles: extractResult.successFiles + successCount,
        failedFiles: extractResult.failedFiles + errors.length,
        documents: [...prevDocs, ...finalDocs],
        errors: [...prevErrors, ...errors],
      };
      setExtractResult(combined);
      setExtractErrors(combined.errors);
      setSelectedDocs(prev => {
        const n = new Set(prev);
        finalDocs.filter(d => !d.hasErrors).forEach(d => n.add(d.key));
        return n;
      });
    } else {
      const data: ExtractResult = {
        totalFiles: total,
        successFiles: successCount,
        failedFiles: errors.length,
        documents: finalDocs,
        errors,
      };
      setExtractResult(data);
      setExtractErrors(errors);
      setSelectedDocs(new Set(finalDocs.filter(d => !d.hasErrors).map(d => d.key)));
    }

    if (!append) setPreviewPage(0);
    setStep("preview");
    setIsExtracting(false);
    if (errors.length > 0) {
      toast({ title: `อ่านไม่ได้ ${errors.length} ไฟล์`, description: errors.map(e => e.fileName).join(", "), variant: "destructive" });
    }
  };

  const [createProgress, setCreateProgress] = useState(0);
  const CREATE_BATCH_SIZE = 50;

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!extractResult) throw new Error("ไม่มีข้อมูล");
      const allDocs = extractResult.documents
        .filter(d => selectedDocs.has(d.key) && !d.hasErrors)
        .map(d => ({ ...d, paymentMethod: d.paymentMethod || paymentMethod }));

      const combinedResult: CreateResult = { created: [], skipped: [], errors: [], total: allDocs.length };
      setCreateProgress(0);

      for (let i = 0; i < allDocs.length; i += CREATE_BATCH_SIZE) {
        const batch = allDocs.slice(i, i + CREATE_BATCH_SIZE);
        const res = await fetch("/api/pdf-import/create-expense", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ companyId, documents: batch, autoJournal, autoWht }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.message || "ไม่สามารถนำเข้าได้");
        }
        const batchResult = await res.json() as CreateResult;
        combinedResult.created.push(...batchResult.created);
        combinedResult.skipped.push(...batchResult.skipped);
        combinedResult.errors.push(...batchResult.errors);
        setCreateProgress(Math.round(Math.min(i + CREATE_BATCH_SIZE, allDocs.length) / allDocs.length * 100));
      }
      return combinedResult;
    },
    onSuccess: (data) => {
      setCreateResult(data);
      setStep("result");
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
    },
    onError: (err: any) => {
      setCreateProgress(0);
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const fileArray = Array.from(files);
      e.target.value = "";
      setStagedFiles(fileArray);
      setStep("staged");
    }
  };

  const viewFile = (file: File) => {
    if (viewingFileUrl) URL.revokeObjectURL(viewingFileUrl);
    const url = URL.createObjectURL(file);
    setViewingFileUrl(url);
    setViewingFileName(file.name);
  };

  const closeViewer = () => {
    if (viewingFileUrl) URL.revokeObjectURL(viewingFileUrl);
    setViewingFileUrl(null);
    setViewingFileName("");
  };

  const removeStagedFile = (idx: number) => {
    setStagedFiles(prev => prev.filter((_, i) => i !== idx));
  };

  // ⚠️ AI TRIGGER — called when user clicks "AI อ่านให้" button
  const startAiExtract = () => {
    if (stagedFiles.length > 0) processFiles(stagedFiles);
  };
  const handleAddMore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const fileArray = Array.from(files);
      e.target.value = "";
      processFiles(fileArray, true);
    }
  };

  const toggleDoc = (key: string) => {
    setSelectedDocs(prev => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  };
  const toggleExpand = (key: string) => {
    setExpandedDocs(prev => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  };
  const selectAll = () => { if (extractResult) setSelectedDocs(new Set(extractResult.documents.filter(d => !d.hasErrors).map(d => d.key))); };
  const selectNone = () => setSelectedDocs(new Set());
  const resetAll = () => { setStep("upload"); setStagedFiles([]); closeViewer(); setExtractResult(null); setCreateResult(null); setSelectedDocs(new Set()); setExpandedDocs(new Set()); setFileCount(0); setIsExtracting(false); setExtractProgress(0); setExtractDoneCount(0); setExtractElapsed(0); setExtractCurrentFile(""); setExtractErrors([]); };

  const updateDocField = useCallback((docKey: string, field: keyof PreviewDoc, value: any) => {
    setExtractResult(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        documents: prev.documents.map(d =>
          d.key === docKey ? { ...d, [field]: value } : d
        ),
      };
    });
  }, []);

  const selectedCount = extractResult ? extractResult.documents.filter(d => selectedDocs.has(d.key) && !d.hasErrors).length : 0;

  return (
    <Layout>
      <div className="max-w-6xl mx-auto p-4 md:p-6">
        <div className="flex items-center gap-3 mb-4">
          <Button variant="outline" size="sm" onClick={() => navigate("/purchases/expense")} data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-1" /> กลับ
          </Button>
          <h1 className="text-xl font-semibold">สร้างรายจ่ายอื่นจาก PDF / รูปภาพ</h1>
          <Badge className="bg-purple-100 text-purple-700"><Sparkles className="h-3 w-3 mr-1" /> AI</Badge>
        </div>

        <ImportBatchHistory docType="expense" invalidateKeys={[["expenses"]]} />

        {step === "upload" && (
          <Card className="flexy-card">
            <CardHeader className="bg-purple-50 border-b px-5 py-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-600" />
                <span className="font-semibold text-sm">สร้างรายจ่ายอื่นจาก PDF / รูปภาพ</span>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="text-center py-8">
                <FileImage className="h-16 w-16 text-purple-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">เลือกไฟล์เอกสาร</h3>
                <p className="text-sm text-muted-foreground mb-6 max-w-lg mx-auto">
                  เลือกไฟล์ PDF หรือรูปภาพของใบเสร็จ/บิลค่าใช้จ่าย เพื่อดูตัวอย่างก่อน
                  จากนั้นเลือกว่าจะดูด้วยตาเองหรือให้ AI ช่วยอ่าน
                </p>
                <input ref={fileInputRef} type="file" accept="application/pdf,.pdf,.jpg,.jpeg,.png,.webp,.gif,image/*" multiple className="hidden" onChange={handleFileSelect} data-testid="input-file" />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-purple-600 hover:bg-purple-700 text-white rounded-full px-8"
                  disabled={!companyId}
                  data-testid="button-upload"
                >
                  <Upload className="h-4 w-4 mr-2" /> เลือกไฟล์ PDF / รูปภาพ
                </Button>
                {!companyId && <p className="text-sm text-red-500 mt-3">กรุณาเลือกบริษัทก่อน</p>}
              </div>
            </CardContent>
          </Card>
        )}

        {step === "staged" && (
          <Card className="flexy-card">
            <CardHeader className="bg-purple-50 border-b px-5 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileImage className="h-5 w-5 text-purple-600" />
                  <span className="font-semibold text-sm">ไฟล์ที่เลือก ({stagedFiles.length} ไฟล์)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} data-testid="button-add-staged">
                    <Upload className="h-3.5 w-3.5 mr-1" /> เพิ่มไฟล์
                  </Button>
                  <Button variant="outline" size="sm" onClick={resetAll} data-testid="button-clear-staged">เลือกใหม่</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <input ref={fileInputRef} type="file" accept="application/pdf,.pdf,.jpg,.jpeg,.png,.webp,.gif,image/*" multiple className="hidden" onChange={(e) => {
                const files = e.target.files;
                if (files && files.length > 0) {
                  setStagedFiles(prev => [...prev, ...Array.from(files)]);
                  e.target.value = "";
                }
              }} data-testid="input-file" />

              {isExtracting ? (
                <div className="w-full max-w-md mx-auto space-y-3 py-6">
                  <div className="flex items-center justify-center gap-2 text-purple-700 font-medium">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>AI กำลังอ่านไฟล์ {extractCurrentFile}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500 ease-out" style={{ width: `${Math.max(extractProgress, extractProgress === 0 ? 5 : 0)}%`, background: "#9333ea" }} />
                  </div>
                  <p className="text-sm text-muted-foreground text-center">
                    {extractDoneCount}/{fileCount} ไฟล์ ({extractProgress}%) — ⏱ {extractElapsed} วินาที
                    {extractDoneCount > 0 && fileCount > extractDoneCount && (
                      <span className="ml-1">(เหลือ ~{Math.round((extractElapsed / extractDoneCount) * (fileCount - extractDoneCount))}s)</span>
                    )}
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-1 mb-4 max-h-64 overflow-y-auto">
                    {stagedFiles.map((file, idx) => {
                      const isImage = file.type.startsWith("image/");
                      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
                      return (
                        <div key={idx} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 group">
                          <div className="flex-shrink-0">
                            {isImage ? <ImageIcon className="h-5 w-5 text-blue-500" /> : <FileText className="h-5 w-5 text-red-500" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm truncate">{file.name}</p>
                            <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB • {isImage ? "รูปภาพ" : "PDF"}</p>
                          </div>
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-blue-600 hover:text-blue-800" onClick={() => viewFile(file)} data-testid={`button-view-file-${idx}`}>
                            <Eye className="h-3.5 w-3.5 mr-1" /> ดูไฟล์
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100" onClick={() => removeStagedFile(idx)} data-testid={`button-remove-file-${idx}`}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>

                  {stagedFiles.length > 0 && (
                    <div className="border-t pt-4">
                      <div className="flex items-center justify-center gap-4">
                        <Button
                          variant="outline"
                          onClick={() => navigate("/purchases/exp/new")}
                          className="rounded-full px-6 border-[#05b187] text-[#05b187] hover:bg-emerald-50"
                          data-testid="button-manual-entry"
                        >
                          <PenLine className="h-4 w-4 mr-2" /> กรอกเอง
                        </Button>
                        {/* ⚠️ AI CALL BUTTON — Remove/comment this <Button> to disable AI.
                            The "กรอกเอง (ฟรี)" button above still works as manual fallback. */}
                        <Button
                          onClick={startAiExtract}
                          className="bg-purple-600 hover:bg-purple-700 text-white rounded-full px-6"
                          disabled={!companyId}
                          data-testid="button-ai-extract"
                        >
                          <Zap className="h-4 w-4 mr-2" /> AI อ่านให้ ({stagedFiles.length} ไฟล์)
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground text-center mt-3">
                        AI จะอ่านข้อมูลจากเอกสาร (มีค่าใช้จ่าย API) หรือกด "กรอกเอง" เพื่อคีย์ข้อมูลด้วยตนเอง
                      </p>
                    </div>
                  )}
                  {stagedFiles.length === 0 && (
                    <div className="text-center py-6">
                      <p className="text-sm text-muted-foreground mb-3">ไม่มีไฟล์ที่เลือก</p>
                      <Button onClick={() => setStep("upload")} variant="outline" className="rounded-full" data-testid="button-back-upload">
                        <ArrowLeft className="h-4 w-4 mr-1" /> กลับ
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}

        {viewingFileUrl && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={closeViewer}>
            <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-4 border-b">
                <div className="flex items-center gap-2">
                  <Eye className="h-5 w-5 text-blue-500" />
                  <span className="font-medium text-sm">{viewingFileName}</span>
                  <Badge variant="outline" className="text-xs">ดูด้วยตา — ไม่เรียก AI</Badge>
                </div>
                <Button variant="ghost" size="sm" onClick={closeViewer} data-testid="button-close-viewer"><X className="h-4 w-4" /></Button>
              </div>
              <div className="flex-1 overflow-auto p-2 bg-gray-100">
                {viewingFileName.match(/\.(jpg|jpeg|png|webp|gif)$/i) ? (
                  <img src={viewingFileUrl} alt={viewingFileName} className="max-w-full mx-auto" />
                ) : (
                  <iframe src={viewingFileUrl} className="w-full h-full min-h-[70vh]" title={viewingFileName} />
                )}
              </div>
            </div>
          </div>
        )}

        {step === "preview" && extractResult && (
          <div className="space-y-4">
            <Card className="flexy-card">
              <CardContent className="p-4">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-blue-100 text-blue-700">{extractResult.totalFiles} ไฟล์</Badge>
                    <Badge className="bg-emerald-100 text-emerald-700"><CheckCircle2 className="h-3 w-3 mr-1" /> {extractResult.successFiles} อ่านได้</Badge>
                    {extractResult.failedFiles > 0 && <Badge className="bg-red-100 text-red-700"><XCircle className="h-3 w-3 mr-1" /> {extractResult.failedFiles} อ่านไม่ได้</Badge>}
                  </div>
                  <div className="ml-auto flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Checkbox checked={autoJournal} onCheckedChange={(v) => setAutoJournal(!!v)} data-testid="checkbox-auto-journal" />
                      <label className="text-sm">บันทึกบัญชี</label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox checked={autoWht} onCheckedChange={(v) => setAutoWht(!!v)} data-testid="checkbox-auto-wht" />
                      <label className="text-sm">สร้าง 50 ทวิ</label>
                    </div>
                    <Select value={globalWhtRate} onValueChange={(v) => {
                      setGlobalWhtRate(v);
                      if (extractResult) {
                        const rate = parseFloat(v);
                        const updated = { ...extractResult, documents: extractResult.documents.map(d => {
                          if (!selectedDocs.has(d.key)) return d;
                          const whtAmt = rate > 0 ? Math.round(d.subtotal * rate) / 100 : 0;
                          return { ...d, whtRate: rate, withholdingTax: whtAmt };
                        })};
                        setExtractResult(updated);
                      }
                    }}>
                      <SelectTrigger className="w-[160px] h-8 text-sm" data-testid="select-global-wht-rate">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {WHT_RATES.map(r => (
                          <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger className="w-[140px] h-8 text-sm bg-amber-50 border-amber-300" data-testid="select-payment-method">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYMENT_METHODS.map(m => (
                          <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <input ref={addMoreInputRef} type="file" accept="application/pdf,.pdf,.jpg,.jpeg,.png,.webp,.gif,image/*" multiple className="hidden" onChange={handleAddMore} data-testid="input-add-more" />
                    <Button variant="outline" size="sm" onClick={() => addMoreInputRef.current?.click()} disabled={isExtracting} data-testid="button-add-more">
                      <Upload className="h-3.5 w-3.5 mr-1" /> เพิ่มไฟล์
                    </Button>
                    <Button variant="outline" size="sm" onClick={selectAll} data-testid="button-select-all">เลือกทั้งหมด</Button>
                    <Button variant="outline" size="sm" onClick={selectNone} data-testid="button-select-none">ไม่เลือก</Button>
                    <Button variant="outline" size="sm" onClick={resetAll} data-testid="button-reset">อัพโหลดใหม่</Button>
                    <Button onClick={() => createMutation.mutate()} disabled={selectedCount === 0 || createMutation.isPending || isExtracting} className="bg-[#05b187] hover:bg-[#049973] text-white rounded-full" data-testid="button-import">
                      {createMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> กำลังสร้าง {createProgress}%</> : <><FileText className="h-4 w-4 mr-2" /> สร้าง {selectedCount} เอกสาร</>}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {extractResult.errors.length > 0 && (
              <Card className="flexy-card border-red-300 bg-red-50/30">
                <CardContent className="p-3">
                  <h3 className="text-sm font-medium text-red-700 mb-2">ไฟล์ที่อ่านไม่ได้:</h3>
                  {extractResult.errors.map((e, idx) => (
                    <div key={idx} className="text-xs text-red-600 flex items-center gap-1 mb-1"><XCircle className="h-3 w-3" /> {e.fileName}: {e.error}</div>
                  ))}
                </CardContent>
              </Card>
            )}

            {isExtracting && (
              <Card className="flexy-card border-purple-300 bg-purple-50/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-5 w-5 text-purple-600 animate-spin" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">กำลังอ่านไฟล์เพิ่มเติม... {extractDoneCount}/{fileCount} ไฟล์ ({extractProgress}%) — ⏱ {extractElapsed}s</p>
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-1"><div className="bg-purple-600 h-2 rounded-full transition-all" style={{ width: `${extractProgress}%` }} /></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {(() => {
              const allDocs = extractResult.documents;
              const totalPages = Math.max(1, Math.ceil(allDocs.length / PREVIEW_PAGE_SIZE));
              const safePage = Math.min(previewPage, totalPages - 1);
              const pagedDocs = allDocs.slice(safePage * PREVIEW_PAGE_SIZE, (safePage + 1) * PREVIEW_PAGE_SIZE);
              return (<>
              {totalPages > 1 && (
                <div className="flex items-center justify-between bg-white rounded-lg px-4 py-2 border">
                  <span className="text-sm text-muted-foreground">แสดง {safePage * PREVIEW_PAGE_SIZE + 1}-{Math.min((safePage + 1) * PREVIEW_PAGE_SIZE, allDocs.length)} จาก {allDocs.length} เอกสาร</span>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" disabled={safePage === 0} onClick={() => setPreviewPage(0)} data-testid="button-page-first">«</Button>
                    <Button variant="outline" size="sm" disabled={safePage === 0} onClick={() => setPreviewPage(p => p - 1)} data-testid="button-page-prev">‹</Button>
                    <span className="text-sm px-3">หน้า {safePage + 1} / {totalPages}</span>
                    <Button variant="outline" size="sm" disabled={safePage >= totalPages - 1} onClick={() => setPreviewPage(p => p + 1)} data-testid="button-page-next">›</Button>
                    <Button variant="outline" size="sm" disabled={safePage >= totalPages - 1} onClick={() => setPreviewPage(totalPages - 1)} data-testid="button-page-last">»</Button>
                  </div>
                </div>
              )}

            <div className="space-y-2">
              {pagedDocs.map((doc) => (
                <Card key={doc.key} className={`flexy-card ${doc.hasErrors ? "border-red-300 bg-red-50/30" : doc.isDuplicate ? "border-yellow-300 bg-yellow-50/30" : ""}`}>
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      {!doc.hasErrors && <Checkbox checked={selectedDocs.has(doc.key)} onCheckedChange={() => toggleDoc(doc.key)} data-testid={`checkbox-doc-${doc.key}`} />}
                      {doc.hasErrors && <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-xs border-purple-300 text-purple-600"><Sparkles className="h-3 w-3 mr-1" /> {doc.fileName}</Badge>
                          <Badge className={`text-xs ${CONFIDENCE_COLORS[doc.confidence] || CONFIDENCE_COLORS.medium}`}>ความมั่นใจ: {CONFIDENCE_LABELS[doc.confidence] || "ปานกลาง"}</Badge>
                          {doc.dbdLookup && <Badge className="text-xs bg-teal-100 text-teal-700"><Building2 className="h-3 w-3 mr-1" /> DBD</Badge>}
                          {doc.attachedUrl && <Badge variant="outline" className="text-xs border-blue-300 text-blue-600"><Paperclip className="h-3 w-3 mr-1" /> แนบไฟล์แล้ว</Badge>}
                          <span className="text-sm text-muted-foreground">{doc.expDate}</span>
                          <Input
                            value={doc.vendorName}
                            onChange={(e) => updateDocField(doc.key, "vendorName", e.target.value)}
                            className="h-7 text-sm font-medium w-[200px] inline-flex"
                            placeholder="ชื่อคู่ค้า"
                            data-testid={`input-vendor-name-${doc.key}`}
                          />
                          {doc.vendorTaxId && <span className="text-xs text-muted-foreground">({doc.vendorTaxId})</span>}
                          {doc.vendorMatchName && <Badge variant="outline" className="text-xs border-emerald-300 text-emerald-600">จับคู่: {doc.vendorMatchName}</Badge>}
                          {(doc as any).timing && <Badge variant="outline" className="text-xs border-gray-300 text-gray-500" data-testid={`badge-timing-${doc.key}`}>⏱ {((doc as any).timing.totalMs / 1000).toFixed(1)}s (AI {((doc as any).timing.aiMs / 1000).toFixed(1)}s)</Badge>}
                          {(doc as any).aiProvider && <Badge variant="outline" className={`text-xs ${(doc as any).aiProvider === "Gemini" ? "border-blue-300 text-blue-600" : "border-green-300 text-green-600"}`} data-testid={`badge-ai-${doc.key}`}>🤖 {(doc as any).aiProvider}</Badge>}
                          {doc.taxInvoiceRef && <span className="text-xs text-muted-foreground">เลขที่: {doc.taxInvoiceRef}</span>}
                          <Select value={doc.paymentMethod || paymentMethod} onValueChange={(v) => updateDocField(doc.key, "paymentMethod", v)}>
                            <SelectTrigger className="w-[120px] h-7 text-xs" data-testid={`select-payment-${doc.key}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {PAYMENT_METHODS.map(m => (
                                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Badge className="bg-slate-100 text-slate-700 text-xs">{doc.items.length} รายการ</Badge>
                        </div>
                        {doc.errors.length > 0 && (
                          <div className="mt-1 space-y-0.5">
                            {doc.errors.map((err, i) => <div key={i} className="text-xs text-red-600 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> {err}</div>)}
                          </div>
                        )}
                        {doc.warnings && doc.warnings.length > 0 && (
                          <div className="mt-1 space-y-0.5">
                            {doc.warnings.map((w, i) => <div key={i} className="text-xs text-yellow-600 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> {w}</div>)}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold">{fmt(doc.totalAmount)}</div>
                        {doc.vatAmount > 0 && <div className="text-xs text-muted-foreground">VAT {fmt(doc.vatAmount)}</div>}
                        {autoWht && doc.withholdingTax > 0 && <div className="text-xs text-muted-foreground">หัก ณ ที่จ่าย {fmt(doc.withholdingTax)}</div>}
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => toggleExpand(doc.key)} data-testid={`button-expand-${doc.key}`}>
                        {expandedDocs.has(doc.key) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </div>
                    {expandedDocs.has(doc.key) && (
                      <div className="mt-3 border-t pt-2">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-10 text-xs">#</TableHead>
                              <TableHead className="text-xs">รายละเอียด</TableHead>
                              <TableHead className="text-xs">บัญชี</TableHead>
                              <TableHead className="text-xs">ความมั่นใจ</TableHead>
                              <TableHead className="text-xs">VAT</TableHead>
                              <TableHead className="text-xs text-right">จำนวนเงิน</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {doc.items.map((item, idx) => {
                              const conf = ACCT_CONFIDENCE_ICONS[item.accountConfidence] || ACCT_CONFIDENCE_ICONS.low;
                              const ConfIcon = conf.icon;
                              return (
                                <TableRow key={idx} className={item.accountConfidence === "low" ? "bg-yellow-50/50" : ""}>
                                  <TableCell className="text-xs">{idx + 1}</TableCell>
                                  <TableCell className="text-xs">{item.description || item.accountName}</TableCell>
                                  <TableCell className="text-xs">
                                    <div className="flex items-center gap-1">
                                      <span className="font-mono text-[11px]">{item.accountCode || "-"}</span>
                                      {item.accountCode && <span className="text-muted-foreground">({item.accountName})</span>}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-xs">
                                    <div className="flex items-center gap-1">
                                      <ConfIcon className={`h-3.5 w-3.5 ${conf.color}`} />
                                      <span className={conf.color}>{conf.label}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-xs">{VAT_LABELS[item.vatType] || item.vatType}</TableCell>
                                  <TableCell className="text-xs text-right font-mono">{fmt(item.amount)}</TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs text-muted-foreground">ชื่อคู่ค้า</label>
                            <Input value={doc.vendorName} onChange={(e) => updateDocField(doc.key, "vendorName", e.target.value)} className="h-7 text-xs" data-testid={`input-vendor-name-detail-${doc.key}`} />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">เลขภาษี</label>
                            <Input value={doc.vendorTaxId || ""} onChange={(e) => updateDocField(doc.key, "vendorTaxId", e.target.value)} className="h-7 text-xs" data-testid={`input-vendor-taxid-${doc.key}`} />
                          </div>
                          <div className="col-span-2">
                            <label className="text-xs text-muted-foreground">ที่อยู่</label>
                            <Input value={doc.vendorAddress || ""} onChange={(e) => updateDocField(doc.key, "vendorAddress", e.target.value)} className="h-7 text-xs" data-testid={`input-vendor-address-${doc.key}`} />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">สาขา</label>
                            <Input value={doc.branch || ""} onChange={(e) => updateDocField(doc.key, "branch", e.target.value)} className="h-7 text-xs" data-testid={`input-vendor-branch-${doc.key}`} />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">เลขที่ใบกำกับภาษี</label>
                            <Input value={doc.taxInvoiceRef || ""} onChange={(e) => updateDocField(doc.key, "taxInvoiceRef", e.target.value)} className="h-7 text-xs" data-testid={`input-tax-ref-${doc.key}`} />
                          </div>
                        </div>
                        {autoWht && (
                        <div className="mt-2 p-2 bg-orange-50/50 border border-orange-200 rounded-lg">
                          <div className="text-xs font-medium text-orange-700 mb-1.5">ภาษีหัก ณ ที่จ่าย</div>
                          <div className="grid grid-cols-4 gap-2">
                            <div>
                              <label className="text-xs text-muted-foreground">อัตรา WHT</label>
                              <Select value={String(doc.whtRate || 0)} onValueChange={(v) => {
                                const rate = parseFloat(v);
                                const whtAmt = rate > 0 ? Math.round(doc.subtotal * rate) / 100 : 0;
                                updateDocField(doc.key, "whtRate", rate);
                                updateDocField(doc.key, "withholdingTax", whtAmt);
                              }}>
                                <SelectTrigger className="h-7 text-xs" data-testid={`select-wht-rate-${doc.key}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {WHT_RATES.map(r => (
                                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground">ยอดหัก ณ ที่จ่าย</label>
                              <Input
                                type="number"
                                step="0.01"
                                value={doc.withholdingTax || 0}
                                onChange={(e) => updateDocField(doc.key, "withholdingTax", parseFloat(e.target.value) || 0)}
                                className="h-7 text-xs"
                                data-testid={`input-wht-amount-${doc.key}`}
                              />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground">ประเภท</label>
                              <Select value={doc.whtType || "pnd53"} onValueChange={(v) => updateDocField(doc.key, "whtType", v)}>
                                <SelectTrigger className="h-7 text-xs" data-testid={`select-wht-type-${doc.key}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {WHT_TYPES.map(t => (
                                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex items-end">
                              <div className="text-xs text-muted-foreground">
                                จ่ายสุทธิ: <span className="font-semibold text-foreground">{fmt(doc.totalAmount - (doc.withholdingTax || 0))}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        )}
                        {doc.notes && <div className="text-xs text-muted-foreground mt-1">หมายเหตุ: {doc.notes}</div>}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between bg-white rounded-lg px-4 py-2 border">
                  <span className="text-sm text-muted-foreground">แสดง {safePage * PREVIEW_PAGE_SIZE + 1}-{Math.min((safePage + 1) * PREVIEW_PAGE_SIZE, allDocs.length)} จาก {allDocs.length} เอกสาร</span>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" disabled={safePage === 0} onClick={() => setPreviewPage(0)}>«</Button>
                    <Button variant="outline" size="sm" disabled={safePage === 0} onClick={() => setPreviewPage(p => p - 1)}>‹</Button>
                    <span className="text-sm px-3">หน้า {safePage + 1} / {totalPages}</span>
                    <Button variant="outline" size="sm" disabled={safePage >= totalPages - 1} onClick={() => setPreviewPage(p => p + 1)}>›</Button>
                    <Button variant="outline" size="sm" disabled={safePage >= totalPages - 1} onClick={() => setPreviewPage(totalPages - 1)}>»</Button>
                  </div>
                </div>
              )}
              </>);
            })()}
          </div>
        )}

        {step === "result" && createResult && (
          <div className="space-y-4">
            <Card className="flexy-card">
              <CardHeader className="bg-emerald-50 border-b px-5 py-3">
                <div className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-600" /><span className="font-semibold text-sm">สร้างเอกสารเสร็จสิ้น</span></div>
              </CardHeader>
              <CardContent className="p-5">
                <div className="flex items-center gap-4 mb-4">
                  <Badge className="bg-emerald-100 text-emerald-700 text-sm px-3 py-1"><CheckCircle2 className="h-4 w-4 mr-1" /> สร้างสำเร็จ {createResult.created.length}</Badge>
                  {createResult.skipped.length > 0 && <Badge className="bg-yellow-100 text-yellow-700 text-sm px-3 py-1"><AlertCircle className="h-4 w-4 mr-1" /> ข้าม {createResult.skipped.length}</Badge>}
                  {createResult.errors.length > 0 && <Badge className="bg-red-100 text-red-700 text-sm px-3 py-1"><XCircle className="h-4 w-4 mr-1" /> ผิดพลาด {createResult.errors.length}</Badge>}
                </div>
                {createResult.created.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-sm font-medium text-emerald-700 mb-2">สร้างสำเร็จ - คลิกเพื่อตรวจสอบและแก้ไข:</h3>
                    <div className="space-y-1">
                      {createResult.created.map((c) => (
                        <div key={c.id} className="flex items-center gap-2 text-sm bg-emerald-50 rounded-lg p-2 cursor-pointer hover:bg-emerald-100 transition-colors" onClick={() => navigate(`/purchases/exp/edit/${c.id}`)}>
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                          <span className="font-mono">{c.expNo}</span>
                          <div className="ml-auto flex items-center gap-1 text-xs text-emerald-600">
                            <Edit className="h-3 w-3" /> ตรวจสอบ/แก้ไข
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {createResult.skipped.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-sm font-medium text-yellow-700 mb-2">รายการที่ข้าม:</h3>
                    <div className="space-y-1">
                      {createResult.skipped.map((s, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm bg-yellow-50 rounded-lg p-2">
                          <AlertCircle className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                          <span className="font-mono">{s.expNo}</span>
                          <span className="text-yellow-600">{s.reason}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {createResult.errors.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-sm font-medium text-red-700 mb-2">ข้อผิดพลาด:</h3>
                    <div className="space-y-1">
                      {createResult.errors.map((e, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm bg-red-50 rounded-lg p-2">
                          <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                          <span className="font-mono">{e.expNo}</span>
                          <span className="text-red-600">{e.error}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3 mt-4">
                  <Button onClick={resetAll} variant="outline" className="rounded-full" data-testid="button-import-more"><Upload className="h-4 w-4 mr-1" /> อัพโหลดเพิ่ม</Button>
                  <Button onClick={() => navigate("/purchases/expense")} className="rounded-full bg-[var(--theme-primary)] hover:bg-[#e8856a]" data-testid="button-go-list"><FileText className="h-4 w-4 mr-1" /> ไปหน้ารายการ</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
}
