import { useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/lib/company-context";
import ImportBatchHistory from "@/components/import-batch-history";
import {
  Upload, FileImage, CheckCircle2, XCircle,
  AlertCircle, ArrowLeft, FileText, Loader2, ChevronDown, ChevronUp,
  Sparkles, File, ImageIcon, Building2, Paperclip, Edit,
  Eye, Zap, X, PenLine,
} from "lucide-react";

interface PreviewItem {
  rowNum: number;
  productCode: string;
  productName: string;
  description: string;
  qty: number;
  unit: string;
  unitPrice: number;
  discount: number;
  total: number;
  vatType: string;
  productId: number | null;
  productMatched: boolean;
  errors: string[];
}

interface PreviewDoc {
  key: string;
  apNo: string;
  apDate: string;
  dueDate: string;
  vendorName: string;
  vendorTaxId: string;
  vendorAddress: string;
  branch: string;
  taxInvoiceRef: string;
  notes: string;
  refDoc: string;
  priceMode: string;
  withholdingTax: number;
  subtotal: number;
  vatAmount: number;
  totalAmount: number;
  vendorId: number | null;
  vendorMatchName: string | null;
  dbdLookup?: boolean;
  attachedUrl?: string;
  items: PreviewItem[];
  errors: string[];
  warnings?: string[];
  hasErrors: boolean;
  isDuplicate: boolean;
  confidence: string;
  fileName: string;
}

interface ExtractResult {
  totalFiles: number;
  successFiles: number;
  failedFiles: number;
  documents: PreviewDoc[];
  errors: { fileName: string; error: string }[];
}

interface CreateResult {
  created: { apNo: string; id: number }[];
  skipped: { apNo: string; reason: string }[];
  errors: { apNo: string; error: string }[];
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

export default function PurchasePdfImport() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<"upload" | "staged" | "preview" | "result">("upload");
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [viewingFileUrl, setViewingFileUrl] = useState<string | null>(null);
  const [viewingFileName, setViewingFileName] = useState("");
  const [extractResult, setExtractResult] = useState<ExtractResult | null>(null);
  const [createResult, setCreateResult] = useState<CreateResult | null>(null);
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set());
  const [autoJournal, setAutoJournal] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [fileCount, setFileCount] = useState(0);

  const { data: companyPaymentMethods = [] } = useQuery<any[]>({
    queryKey: ["/api/payment-methods", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/payment-methods?companyId=${companyId}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!companyId,
  });

  // ═══════════════════════════════════════════════════════════════════════
  // ⚠️ AI API CALL — Purchase PDF Extract (calls OpenAI GPT-4o Vision)
  // This mutation sends uploaded files to /api/pdf-import/extract which
  // calls OpenAI API with real cost. To disable AI: remove or comment out
  // the <Button> with data-testid="button-ai-extract" in the JSX below,
  // and the startAiExtract() function. The FREE "กรอกเอง" button will
  // still work as the manual fallback path.
  // ═══════════════════════════════════════════════════════════════════════
  const extractMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await fetch("/api/pdf-import/extract", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "ไม่สามารถอ่านไฟล์ได้");
      }
      return res.json() as Promise<ExtractResult>;
    },
    onSuccess: (data) => {
      setExtractResult(data);
      const validKeys = new Set(data.documents.filter(d => !d.hasErrors).map(d => d.key));
      setSelectedDocs(validKeys);
      setStep("preview");
      if (data.failedFiles > 0) {
        toast({
          title: `อ่านไม่ได้ ${data.failedFiles} ไฟล์`,
          description: data.errors.map(e => e.fileName).join(", "),
          variant: "destructive",
        });
      }
    },
    onError: (err: any) => {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!extractResult) throw new Error("ไม่มีข้อมูล");
      const docs = extractResult.documents.filter(d => selectedDocs.has(d.key) && !d.hasErrors);
      const res = await fetch("/api/pdf-import/create-purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ companyId, documents: docs, autoJournal, paymentMethod }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "ไม่สามารถนำเข้าได้");
      }
      return res.json() as Promise<CreateResult>;
    },
    onSuccess: (data) => {
      setCreateResult(data);
      setStep("result");
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-invoices"] });
    },
    onError: (err: any) => {
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

  // ⚠️ AI TRIGGER — called when user clicks "AI อ่านให้" button
  const startAiExtract = () => {
    if (stagedFiles.length === 0) return;
    setFileCount(stagedFiles.length);
    const formData = new FormData();
    for (let i = 0; i < stagedFiles.length; i++) {
      formData.append("files", stagedFiles[i]);
    }
    formData.append("companyId", String(companyId));
    formData.append("docType", "purchase");
    extractMutation.mutate(formData);
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

  const toggleDoc = (key: string) => {
    setSelectedDocs(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleExpand = (key: string) => {
    setExpandedDocs(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const selectAll = () => {
    if (!extractResult) return;
    setSelectedDocs(new Set(extractResult.documents.filter(d => !d.hasErrors).map(d => d.key)));
  };
  const selectNone = () => setSelectedDocs(new Set());

  const resetAll = () => {
    setStep("upload");
    setStagedFiles([]);
    closeViewer();
    setExtractResult(null);
    setCreateResult(null);
    setSelectedDocs(new Set());
    setExpandedDocs(new Set());
    setFileCount(0);
  };

  const selectedCount = extractResult ? extractResult.documents.filter(d => selectedDocs.has(d.key) && !d.hasErrors).length : 0;

  return (
    <Layout>
      <div className="max-w-6xl mx-auto p-4 md:p-6">
        <div className="flex items-center gap-3 mb-4">
          <Button variant="outline" size="sm" onClick={() => navigate("/purchases/invoice")} data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-1" /> กลับ
          </Button>
          <h1 className="text-xl font-semibold">สร้างเอกสารซื้อจาก PDF / รูปภาพ</h1>
          <Badge className="bg-purple-100 text-purple-700">
            <Sparkles className="h-3 w-3 mr-1" /> AI
          </Badge>
        </div>

        <ImportBatchHistory docType="purchase_invoice" invalidateKeys={[["purchase-invoices"]]} />

        {step === "upload" && (
          <Card className="flexy-card">
            <CardHeader className="bg-purple-50 border-b px-5 py-3">
              <div className="flex items-center gap-2">
                <FileImage className="h-5 w-5 text-purple-600" />
                <span className="font-semibold text-sm">อัพโหลดใบกำกับภาษี / ใบแจ้งหนี้</span>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="text-center py-8">
                <FileImage className="h-16 w-16 text-purple-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">เลือกไฟล์เอกสาร</h3>
                <p className="text-sm text-muted-foreground mb-6 max-w-lg mx-auto">
                  เลือกไฟล์ PDF หรือรูปภาพของใบกำกับภาษี/ใบแจ้งหนี้ เพื่อดูตัวอย่างก่อน
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
              }} data-testid="input-file-add" />

              {extractMutation.isPending ? (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
                  <p className="text-sm text-purple-700 font-medium">AI กำลังอ่าน {fileCount} ไฟล์...</p>
                </div>
              ) : (
                <>
                  <div className="space-y-1 mb-4 max-h-64 overflow-y-auto">
                    {stagedFiles.map((file, idx) => {
                      const isImage = file.type.startsWith("image/");
                      return (
                        <div key={idx} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 group">
                          <div className="flex-shrink-0">
                            {isImage ? <ImageIcon className="h-5 w-5 text-blue-500" /> : <FileText className="h-5 w-5 text-red-500" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm truncate">{file.name}</p>
                            <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>
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
                          onClick={() => navigate("/purchases/ap/new")}
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
          <div className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-4" onClick={closeViewer}>
            <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-4 border-b">
                <div className="flex items-center gap-2">
                  <Eye className="h-5 w-5 text-blue-500" />
                  <span className="font-medium text-sm">{viewingFileName}</span>
                </div>
                <Button variant="ghost" size="sm" onClick={closeViewer} data-testid="button-close-viewer">
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex-1 overflow-auto p-2 bg-gray-100">
                {viewingFileName.toLowerCase().endsWith(".pdf") ? (
                  <iframe src={viewingFileUrl} className="w-full h-[70vh] rounded" title="PDF Preview" />
                ) : (
                  <img src={viewingFileUrl} alt={viewingFileName} className="max-w-full max-h-[70vh] mx-auto rounded" />
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
                    <Badge className="bg-blue-100 text-blue-700">
                      {extractResult.totalFiles} ไฟล์
                    </Badge>
                    <Badge className="bg-emerald-100 text-emerald-700">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> {extractResult.successFiles} อ่านได้
                    </Badge>
                    {extractResult.failedFiles > 0 && (
                      <Badge className="bg-red-100 text-red-700">
                        <XCircle className="h-3 w-3 mr-1" /> {extractResult.failedFiles} อ่านไม่ได้
                      </Badge>
                    )}
                  </div>
                  <div className="ml-auto flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Checkbox checked={autoJournal} onCheckedChange={(v) => setAutoJournal(!!v)} data-testid="checkbox-auto-journal" />
                      <label className="text-sm">บันทึกบัญชีอัตโนมัติ</label>
                    </div>
                    <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="text-sm border rounded-lg px-2 py-1 bg-amber-50 border-amber-300 text-amber-700 font-semibold" data-testid="select-payment-method">
                      {companyPaymentMethods.length > 0 ? (
                        companyPaymentMethods.map((m: any) => (
                          <option key={m.id} value={m.code || m.name}>{m.name}</option>
                        ))
                      ) : (
                        <>
                          <option value="cash">เงินสด</option>
                          <option value="transfer">โอนเงิน</option>
                          <option value="cheque">เช็ค</option>
                          <option value="credit_card">บัตรเครดิต</option>
                          <option value="promptpay">พร้อมเพย์</option>
                          <option value="ewallet">E-Wallet</option>
                        </>
                      )}
                    </select>
                    <Button variant="outline" size="sm" onClick={selectAll} data-testid="button-select-all">เลือกทั้งหมด</Button>
                    <Button variant="outline" size="sm" onClick={selectNone} data-testid="button-select-none">ไม่เลือก</Button>
                    <Button variant="outline" size="sm" onClick={resetAll} data-testid="button-reset">อัพโหลดใหม่</Button>
                    <Button
                      onClick={() => createMutation.mutate()}
                      disabled={selectedCount === 0 || createMutation.isPending}
                      className="bg-[#05b187] hover:bg-[#049973] text-white rounded-full"
                      data-testid="button-import"
                    >
                      {createMutation.isPending ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> กำลังสร้าง...</>
                      ) : (
                        <><FileText className="h-4 w-4 mr-2" /> สร้าง {selectedCount} เอกสาร</>
                      )}
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
                    <div key={idx} className="text-xs text-red-600 flex items-center gap-1 mb-1">
                      <XCircle className="h-3 w-3" /> {e.fileName}: {e.error}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <div className="space-y-2">
              {extractResult.documents.map((doc) => (
                <Card key={doc.key} className={`flexy-card ${doc.hasErrors ? "border-red-300 bg-red-50/30" : doc.isDuplicate ? "border-yellow-300 bg-yellow-50/30" : ""}`}>
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      {!doc.hasErrors && (
                        <Checkbox checked={selectedDocs.has(doc.key)} onCheckedChange={() => toggleDoc(doc.key)} data-testid={`checkbox-doc-${doc.key}`} />
                      )}
                      {doc.hasErrors && <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-xs border-purple-300 text-purple-600">
                            <Sparkles className="h-3 w-3 mr-1" /> {doc.fileName}
                          </Badge>
                          <Badge className={`text-xs ${CONFIDENCE_COLORS[doc.confidence] || CONFIDENCE_COLORS.medium}`}>
                            ความมั่นใจ: {CONFIDENCE_LABELS[doc.confidence] || "ปานกลาง"}
                          </Badge>
                          <span className="text-sm text-muted-foreground">{doc.apDate}</span>
                          <span className="text-sm font-medium">{doc.vendorName}</span>
                          {doc.vendorTaxId && <span className="text-xs text-muted-foreground">({doc.vendorTaxId})</span>}
                          {doc.vendorMatchName && (
                            <Badge variant="outline" className="text-xs border-emerald-300 text-emerald-600">
                              จับคู่: {doc.vendorMatchName}
                            </Badge>
                          )}
                          {doc.taxInvoiceRef && (
                            <span className="text-xs text-muted-foreground">เลขที่: {doc.taxInvoiceRef}</span>
                          )}
                          {doc.dbdLookup && <Badge className="text-xs bg-teal-100 text-teal-700"><Building2 className="h-3 w-3 mr-1" /> DBD</Badge>}
                          {doc.attachedUrl && <Badge variant="outline" className="text-xs border-blue-300 text-blue-600"><Paperclip className="h-3 w-3 mr-1" /> แนบไฟล์</Badge>}
                          {(doc as any).timing && <Badge variant="outline" className="text-xs border-gray-300 text-gray-500" data-testid={`badge-timing-${doc.key}`}>⏱ {((doc as any).timing.totalMs / 1000).toFixed(1)}s (AI {((doc as any).timing.aiMs / 1000).toFixed(1)}s)</Badge>}
                          {(doc as any).aiProvider && <Badge variant="outline" className={`text-xs ${(doc as any).aiProvider === "Gemini" ? "border-blue-300 text-blue-600" : "border-green-300 text-green-600"}`} data-testid={`badge-ai-${doc.key}`}>🤖 {(doc as any).aiProvider}</Badge>}
                          <Badge className="bg-slate-100 text-slate-700 text-xs">{doc.items.length} รายการ</Badge>
                        </div>

                        {doc.errors.length > 0 && (
                          <div className="mt-1 space-y-0.5">
                            {doc.errors.map((err, i) => (
                              <div key={i} className="text-xs text-red-600 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" /> {err}
                              </div>
                            ))}
                          </div>
                        )}
                        {doc.warnings && doc.warnings.length > 0 && (
                          <div className="mt-1 space-y-0.5">
                            {doc.warnings.map((w, i) => (
                              <div key={i} className="text-xs text-yellow-600 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" /> {w}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="text-right">
                        <div className="text-sm font-semibold">{fmt(doc.totalAmount)}</div>
                        {doc.vatAmount > 0 && <div className="text-xs text-muted-foreground">VAT {fmt(doc.vatAmount)}</div>}
                        {doc.withholdingTax > 0 && <div className="text-xs text-muted-foreground">หัก ณ ที่จ่าย {fmt(doc.withholdingTax)}</div>}
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
                              <TableHead className="text-xs">ชื่อสินค้า/บริการ</TableHead>
                              <TableHead className="text-xs text-right">จำนวน</TableHead>
                              <TableHead className="text-xs">หน่วย</TableHead>
                              <TableHead className="text-xs text-right">ราคา/หน่วย</TableHead>
                              <TableHead className="text-xs text-right">ส่วนลด</TableHead>
                              <TableHead className="text-xs">VAT</TableHead>
                              <TableHead className="text-xs text-right">รวม</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {doc.items.map((item, idx) => (
                              <TableRow key={idx}>
                                <TableCell className="text-xs">{idx + 1}</TableCell>
                                <TableCell className="text-xs">
                                  {item.productName || item.description}
                                  {item.productMatched && <CheckCircle2 className="h-3 w-3 text-emerald-500 inline ml-1" />}
                                </TableCell>
                                <TableCell className="text-xs text-right font-mono">{item.qty}</TableCell>
                                <TableCell className="text-xs">{item.unit}</TableCell>
                                <TableCell className="text-xs text-right font-mono">{fmt(item.unitPrice)}</TableCell>
                                <TableCell className="text-xs text-right font-mono">{item.discount > 0 ? fmt(item.discount) : "-"}</TableCell>
                                <TableCell className="text-xs">{VAT_LABELS[item.vatType] || item.vatType}</TableCell>
                                <TableCell className="text-xs text-right font-mono">{fmt(item.total)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        {doc.vendorAddress && <div className="text-xs text-muted-foreground mt-1">ที่อยู่: {doc.vendorAddress}</div>}
                        {doc.branch && <div className="text-xs text-muted-foreground">สาขา: {doc.branch}</div>}
                        {doc.notes && <div className="text-xs text-muted-foreground">หมายเหตุ: {doc.notes}</div>}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {step === "result" && createResult && (
          <div className="space-y-4">
            <Card className="flexy-card">
              <CardHeader className="bg-emerald-50 border-b px-5 py-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  <span className="font-semibold text-sm">สร้างเอกสารเสร็จสิ้น</span>
                </div>
              </CardHeader>
              <CardContent className="p-5">
                <div className="flex items-center gap-4 mb-4">
                  <Badge className="bg-emerald-100 text-emerald-700 text-sm px-3 py-1">
                    <CheckCircle2 className="h-4 w-4 mr-1" /> สร้างสำเร็จ {createResult.created.length} เอกสาร
                  </Badge>
                  {createResult.skipped.length > 0 && (
                    <Badge className="bg-yellow-100 text-yellow-700 text-sm px-3 py-1">
                      <AlertCircle className="h-4 w-4 mr-1" /> ข้าม {createResult.skipped.length}
                    </Badge>
                  )}
                  {createResult.errors.length > 0 && (
                    <Badge className="bg-red-100 text-red-700 text-sm px-3 py-1">
                      <XCircle className="h-4 w-4 mr-1" /> ผิดพลาด {createResult.errors.length}
                    </Badge>
                  )}
                </div>

                {createResult.created.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-sm font-medium text-emerald-700 mb-2">สร้างสำเร็จ - คลิกเพื่อตรวจสอบและแก้ไข:</h3>
                    <div className="space-y-1">
                      {createResult.created.map((c) => (
                        <div key={c.id} className="flex items-center gap-2 text-sm bg-emerald-50 rounded-lg p-2 cursor-pointer hover:bg-emerald-100 transition-colors" onClick={() => navigate(`/purchases/ap/edit/${c.id}`)}>
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                          <span className="font-mono">{c.apNo}</span>
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
                          <span className="font-mono">{s.apNo}</span>
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
                          <span className="font-mono">{e.apNo}</span>
                          <span className="text-red-600">{e.error}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 mt-4">
                  <Button onClick={resetAll} variant="outline" className="rounded-full" data-testid="button-import-more">
                    <Upload className="h-4 w-4 mr-1" /> อัพโหลดเพิ่ม
                  </Button>
                  <Button onClick={() => navigate("/purchases/invoice")} className="rounded-full bg-[var(--theme-primary)] hover:bg-[#e8856a]" data-testid="button-go-list">
                    <FileText className="h-4 w-4 mr-1" /> ไปหน้ารายการ
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
}
