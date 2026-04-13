import { useState, useRef, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/lib/company-context";
import ImportBatchHistory from "@/components/import-batch-history";
import { useDateSettings } from "@/hooks/use-date-settings";
import { formatDate } from "@/lib/format";
import {
  Upload, CheckCircle2, XCircle, AlertCircle, ArrowLeft, FileText,
  Loader2, ChevronDown, ChevronUp, File, X, BookOpen, Trash2, FolderOpen,
} from "lucide-react";

interface ParsedItem {
  rowNum: number;
  description: string;
  productName: string;
  qty: number;
  unit: string;
  unitPrice: number;
  discount: number;
  total: number;
  amount: number;
  vatType: string;
  accountCode: string;
  accountName: string;
}

interface ParsedDoc {
  key: string;
  fileName: string;
  invoiceNo: string;
  date: string;
  vendorName: string;
  vendorTaxId: string;
  vendorAddress: string;
  vendorBranch: string;
  vendorId: number | null;
  vendorMatchName: string | null;
  isDuplicate: boolean;
  subtotal: number;
  vatAmount: number;
  totalAmount: number;
  withholdingTax: number;
  items: ParsedItem[];
  isTikTok: boolean;
  archivedFileUrl: string | null;
  hasErrors: boolean;
  errors: string[];
}

interface BulkParseResult {
  totalFiles: number;
  successFiles: number;
  failedFiles: number;
  documents: ParsedDoc[];
  errors: { fileName: string; error: string }[];
}

interface CreateResult {
  created: { apNo?: string; expNo?: string; id: number; vendorName?: string; subtotal?: string; vatAmount?: string; totalAmount?: string; taxInvoiceRef?: string }[];
  skipped: { apNo?: string; expNo?: string; reason: string }[];
  errors: { apNo?: string; expNo?: string; error: string }[];
  total: number;
}

function fmt(val: number): string {
  return val.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}


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
  { value: "3", label: "3% - บริการ/ค่าคอมมิชชั่น" },
  { value: "5", label: "5% - ค่าเช่า" },
];

async function readEntryAsFile(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => {
    entry.file(resolve, reject);
  });
}

async function readDirectoryEntries(dirEntry: FileSystemDirectoryEntry): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => {
    const reader = dirEntry.createReader();
    const allEntries: FileSystemEntry[] = [];
    const readBatch = () => {
      reader.readEntries((entries) => {
        if (entries.length === 0) {
          resolve(allEntries);
        } else {
          allEntries.push(...entries);
          readBatch();
        }
      }, reject);
    };
    readBatch();
  });
}

async function collectPdfFiles(entries: FileSystemEntry[]): Promise<File[]> {
  const files: File[] = [];
  const queue = [...entries];
  while (queue.length > 0) {
    const entry = queue.shift()!;
    if (entry.isFile) {
      if (entry.name.toLowerCase().endsWith(".pdf")) {
        try {
          const file = await readEntryAsFile(entry as FileSystemFileEntry);
          files.push(file);
        } catch {}
      }
    } else if (entry.isDirectory) {
      try {
        const subEntries = await readDirectoryEntries(entry as FileSystemDirectoryEntry);
        queue.push(...subEntries);
      } catch {}
    }
  }
  return files;
}

export default function PdfBulkImport() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const addFileInputRef = useRef<HTMLInputElement>(null);
  const addFolderInputRef = useRef<HTMLInputElement>(null);
  const { dateEra, dateFmt } = useDateSettings();

  const [step, setStep] = useState<"upload" | "preview" | "result">("upload");
  const [parseResult, setParseResult] = useState<BulkParseResult | null>(null);
  const [createResult, setCreateResult] = useState<CreateResult | null>(null);
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set());
  const [docType, setDocType] = useState<"purchase" | "expense">("expense");
  const [autoJournal, setAutoJournal] = useState(true);
  const [archiveToDocs, setArchiveToDocs] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState("transfer");
  const [globalWhtRate, setGlobalWhtRate] = useState("0");
  const [showJournalPreview, setShowJournalPreview] = useState(false);
  const [previewPage, setPreviewPage] = useState(0);
  const [selectedFormulaIdx, setSelectedFormulaIdx] = useState("0");
  const PAGE_SIZE = 50;

  const { data: companyPaymentMethods = [] } = useQuery<any[]>({
    queryKey: ["/api/payment-methods", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/payment-methods?companyId=${companyId}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!companyId,
  });

  const formulaDocType = docType === "expense" ? "purchase" : "purchase";
  const { data: availableFormulas = [] } = useQuery<any[]>({
    queryKey: ["/api/accounting-formulas/available", companyId, formulaDocType],
    queryFn: async () => {
      const res = await fetch(`/api/accounting-formulas/available?companyId=${companyId}&documentType=${formulaDocType}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!companyId,
  });
  const selectedFormula = availableFormulas[Number(selectedFormulaIdx)] || availableFormulas[0] || null;
  const PAYMENT_METHODS = companyPaymentMethods.length > 0
    ? companyPaymentMethods.map((m: any) => ({ value: m.code || m.name, label: m.name }))
    : FALLBACK_PAYMENT_METHODS;

  const [parseProgress, setParseProgress] = useState(0);
  const [parseTotalFiles, setParseTotalFiles] = useState(0);

  const [importedFolderCount, setImportedFolderCount] = useState(0);

  const parseMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const BATCH_SIZE = 50;
      const allDocuments: ParsedDoc[] = [];
      const allErrors: { fileName: string; error: string }[] = [];
      let totalSuccess = 0;

      setParseTotalFiles(files.length);
      setParseProgress(0);

      for (let i = 0; i < files.length; i += BATCH_SIZE) {
        const batch = files.slice(i, i + BATCH_SIZE);
        const formData = new FormData();
        for (const f of batch) formData.append("files", f);
        formData.append("companyId", String(companyId));
        if (archiveToDocs) formData.append("archiveToDocs", "true");

        const res = await fetch("/api/pdf-bulk-parse", {
          method: "POST",
          body: formData,
          credentials: "include",
        });
        if (!res.ok) {
          let msg = "ไม่สามารถอ่านไฟล์ได้";
          try { const err = await res.json(); msg = err.message || msg; } catch {}
          for (const f of batch) allErrors.push({ fileName: f.name, error: msg });
        } else {
          const result = await res.json() as BulkParseResult;
          allDocuments.push(...result.documents);
          allErrors.push(...result.errors);
          totalSuccess += result.successFiles;
        }
        setParseProgress(Math.min(i + BATCH_SIZE, files.length));
      }

      return {
        totalFiles: files.length,
        successFiles: totalSuccess,
        failedFiles: allErrors.length,
        documents: allDocuments,
        errors: allErrors,
      } as BulkParseResult;
    },
    onSuccess: (data) => {
      setImportedFolderCount(prev => prev + 1);

      if (parseResult) {
        const existingKeys = new Set(parseResult.documents.map(d => d.key));
        const newDocs = data.documents.filter(d => !existingKeys.has(d.key));
        const merged: BulkParseResult = {
          totalFiles: parseResult.totalFiles + data.totalFiles,
          successFiles: parseResult.successFiles + data.successFiles,
          failedFiles: parseResult.failedFiles + data.failedFiles,
          documents: [...parseResult.documents, ...newDocs],
          errors: [...parseResult.errors, ...data.errors],
        };
        setParseResult(merged);
        const newValidKeys = newDocs.filter(d => !d.hasErrors && !d.isDuplicate).map(d => d.key);
        setSelectedDocs(prev => {
          const next = new Set(prev);
          newValidKeys.forEach(k => next.add(k));
          return next;
        });
        if (newDocs.length > 0) {
          toast({ title: `เพิ่ม ${newDocs.length} ไฟล์ใหม่`, description: `รวมทั้งหมด ${merged.documents.length} ไฟล์` });
        } else {
          toast({ title: "ไม่มีไฟล์ใหม่", description: "ไฟล์ทั้งหมดมีอยู่แล้ว" });
        }
      } else {
        setParseResult(data);
        const validKeys = new Set(data.documents.filter(d => !d.hasErrors && !d.isDuplicate).map(d => d.key));
        setSelectedDocs(validKeys);
      }

      setStep("preview");
      setParseProgress(0);
      setParseTotalFiles(0);
      if (data.failedFiles > 0) {
        toast({ title: `อ่านไม่ได้ ${data.failedFiles} ไฟล์`, variant: "destructive" });
      }
      const hasTikTok = data.documents.some(d => d.isTikTok);
      if (hasTikTok) setDocType("expense");
      const hasPlatformFee = data.documents.some((d: any) => d.isPlatformFee);
      if (hasPlatformFee && availableFormulas.length > 0) {
        const pfIdx = availableFormulas.findIndex((f: any) => f.businessType === "platform_fee");
        if (pfIdx >= 0) setSelectedFormulaIdx(String(pfIdx));
      }
    },
    onError: (err: any) => {
      setParseProgress(0);
      setParseTotalFiles(0);
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!parseResult) throw new Error("ไม่มีข้อมูล");
      const docs = parseResult.documents.filter(d => selectedDocs.has(d.key) && !d.hasErrors);
      const whtRate = parseFloat(globalWhtRate) / 100;

      const mappedDocs = docs.map(d => {
        const wht = whtRate > 0 ? Math.round(d.subtotal * whtRate * 100) / 100 : 0;
        if (docType === "expense") {
          return {
            expNo: "(สร้างอัตโนมัติ)",
            expDate: d.date,
            apDate: d.date,
            vendorName: d.vendorMatchName || d.vendorName || "ไม่ระบุ",
            vendorTaxId: d.vendorTaxId,
            vendorAddress: d.vendorAddress,
            vendorId: d.vendorId,
            branch: d.vendorBranch,
            taxInvoiceRef: d.invoiceNo,
            subtotal: d.subtotal,
            vatAmount: d.vatAmount,
            totalAmount: d.subtotal + d.vatAmount - wht,
            withholdingTax: wht,
            priceMode: "excluded",
            paymentMethod,
            archivedFileUrl: d.archivedFileUrl || null,
            fileName: d.fileName,
            items: d.items.map(it => ({
              description: it.description || it.productName,
              amount: it.amount || it.total,
              total: it.amount || it.total,
              vatType: it.vatType,
              accountCode: it.accountCode || "",
              accountName: it.accountName || "",
            })),
          };
        } else {
          return {
            apNo: "(สร้างอัตโนมัติ)",
            apDate: d.date,
            vendorName: d.vendorMatchName || d.vendorName || "ไม่ระบุ",
            vendorTaxId: d.vendorTaxId,
            vendorAddress: d.vendorAddress,
            vendorId: d.vendorId,
            branch: d.vendorBranch,
            taxInvoiceRef: d.invoiceNo,
            subtotal: d.subtotal,
            vatAmount: d.vatAmount,
            totalAmount: d.subtotal + d.vatAmount - wht,
            withholdingTax: wht,
            priceMode: "excluded",
            items: d.items.map(it => ({
              productName: it.description || it.productName,
              description: it.description,
              qty: it.qty,
              unit: it.unit,
              unitPrice: it.unitPrice,
              discount: 0,
              total: it.amount || it.total,
              vatType: it.vatType,
            })),
          };
        }
      });

      const endpoint = docType === "expense" ? "/api/pdf-import/create-expense" : "/api/pdf-import/create-purchase";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          companyId,
          documents: mappedDocs,
          autoJournal,
          autoWht: docType === "expense" && whtRate > 0,
          paymentMethod,
          archiveToDocs,
          formulaId: autoJournal && selectedFormula?.id ? selectedFormula.id : undefined,
          formulaBusinessType: autoJournal && !selectedFormula?.id && selectedFormula?.businessType ? selectedFormula.businessType : undefined,
        }),
      });
      if (!res.ok) {
        let msg = "ไม่สามารถสร้างเอกสารได้";
        try { const err = await res.json(); msg = err.message || msg; } catch {}
        throw new Error(msg);
      }
      return res.json() as Promise<CreateResult>;
    },
    onSuccess: (data) => {
      setCreateResult(data);
      setStep("result");
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/purchases"] });
    },
    onError: (err: any) => {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    },
  });

  const [scanningFolders, setScanningFolders] = useState(false);
  const [scannedFileCount, setScannedFileCount] = useState(0);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const arr = Array.from(files).filter(f => f.type === "application/pdf" || f.name.endsWith(".pdf"));
      e.target.value = "";
      if (arr.length === 0) {
        toast({ title: "กรุณาเลือกไฟล์ PDF เท่านั้น", variant: "destructive" });
        return;
      }
      parseMutation.mutate(arr);
    }
  };

  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const arr = Array.from(files).filter(f => f.type === "application/pdf" || f.name.endsWith(".pdf"));
      e.target.value = "";
      if (arr.length === 0) {
        toast({ title: "ไม่พบไฟล์ PDF ในโฟลเดอร์", variant: "destructive" });
        return;
      }
      toast({ title: `พบ ${arr.length} ไฟล์ PDF`, description: "กำลังเริ่มอ่านข้อมูล..." });
      parseMutation.mutate(arr);
    }
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const items = e.dataTransfer.items;
    if (!items || items.length === 0) return;

    const entries: FileSystemEntry[] = [];
    let hasDirectory = false;
    for (let i = 0; i < items.length; i++) {
      const entry = items[i].webkitGetAsEntry?.();
      if (entry) {
        entries.push(entry);
        if (entry.isDirectory) hasDirectory = true;
      }
    }

    if (hasDirectory && entries.length > 0) {
      setScanningFolders(true);
      setScannedFileCount(0);
      try {
        const pdfFiles = await collectPdfFiles(entries);
        setScannedFileCount(pdfFiles.length);
        setScanningFolders(false);
        if (pdfFiles.length === 0) {
          toast({ title: "ไม่พบไฟล์ PDF ในโฟลเดอร์", variant: "destructive" });
          return;
        }
        toast({ title: `พบ ${pdfFiles.length} ไฟล์ PDF`, description: "กำลังเริ่มอ่านข้อมูล..." });
        parseMutation.mutate(pdfFiles);
      } catch {
        setScanningFolders(false);
        toast({ title: "เกิดข้อผิดพลาดในการอ่านโฟลเดอร์", variant: "destructive" });
      }
    } else {
      const files = Array.from(e.dataTransfer.files).filter(f => f.type === "application/pdf" || f.name.endsWith(".pdf"));
      if (files.length > 0) parseMutation.mutate(files);
    }
  }, [parseMutation, toast]);

  const toggleDoc = (key: string) => {
    setSelectedDocs(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleExpand = (key: string) => {
    setExpandedDocs(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAll = () => {
    if (!parseResult) return;
    const allKeys = parseResult.documents.filter(d => !d.hasErrors && !d.isDuplicate).map(d => d.key);
    setSelectedDocs(new Set(allKeys));
  };
  const deselectAll = () => setSelectedDocs(new Set());

  const selectedDocsList = parseResult?.documents.filter(d => selectedDocs.has(d.key)) || [];
  const whtRate = parseFloat(globalWhtRate) / 100;
  const totalSubtotal = selectedDocsList.reduce((s, d) => s + d.subtotal, 0);
  const totalVat = selectedDocsList.reduce((s, d) => s + d.vatAmount, 0);
  const totalWht = whtRate > 0 ? Math.round(totalSubtotal * whtRate * 100) / 100 : 0;
  const grandTotal = totalSubtotal + totalVat - totalWht;

  const paginatedDocs = parseResult?.documents.slice(previewPage * PAGE_SIZE, (previewPage + 1) * PAGE_SIZE) || [];
  const totalPages = parseResult ? Math.ceil(parseResult.documents.length / PAGE_SIZE) : 0;

  return (
    <Layout>
      <div>
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="icon" onClick={() => {
            if (step === "preview") { setStep("upload"); setParseResult(null); setImportedFolderCount(0); }
            else navigate(docType === "expense" ? "/purchases/expense" : "/purchases/ap");
          }} data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold" data-testid="text-page-title">นำเข้า PDF แบบกลุ่ม (ฟรี)</h1>
            <p className="text-sm text-gray-500">อัปโหลด Receipt / ใบกำกับภาษี หลายไฟล์พร้อมกัน — ไม่ใช้ AI</p>
          </div>
        </div>

        <ImportBatchHistory
          docType={docType === "expense" ? "expense" : "purchase_invoice"}
          invalidateKeys={docType === "expense" ? [["/api/expenses"], ["/api/expense-daily-batches"]] : [["purchase-invoices"]]}
        />

        {step === "upload" && (
          <Card>
            <CardContent className="p-8">
              <div
                className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center hover:border-[#fb9678] transition-colors cursor-pointer"
                onDrop={handleDrop}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
                onClick={() => fileInputRef.current?.click()}
                data-testid="dropzone-upload"
              >
                {scanningFolders ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-12 w-12 text-[#03c9d7] animate-spin" />
                    <p className="text-lg font-medium">กำลังสแกนโฟลเดอร์...</p>
                    <p className="text-sm text-gray-500">ค้นหาไฟล์ PDF ในโฟลเดอร์และโฟลเดอร์ย่อย</p>
                  </div>
                ) : parseMutation.isPending ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-12 w-12 text-[#fb9678] animate-spin" />
                    <p className="text-lg font-medium">กำลังอ่านไฟล์ PDF...</p>
                    {parseTotalFiles > 0 && (
                      <>
                        <p className="text-sm text-gray-500">{parseProgress} / {parseTotalFiles} ไฟล์</p>
                        <div className="w-64 bg-gray-200 rounded-full h-2">
                          <div className="bg-[#fb9678] h-2 rounded-full transition-all" style={{ width: `${Math.round((parseProgress / parseTotalFiles) * 100)}%` }} />
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <Upload className="h-12 w-12 text-gray-400" />
                    <p className="text-lg font-medium">ลากไฟล์ PDF หรือโฟลเดอร์วางที่นี่</p>
                    <p className="text-sm text-gray-500">รองรับโฟลเดอร์ (อ่าน subfolder อัตโนมัติ) — ใบเสร็จ TikTok, Shopee, ใบกำกับภาษีทั่วไป</p>
                    <p className="text-xs text-gray-400">สูงสุด 5,000 ไฟล์ — ไม่ใช้ AI</p>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-center gap-3 mt-4">
                <Button
                  variant="outline"
                  onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                  className="gap-2"
                  data-testid="button-select-files"
                >
                  <FileText className="h-4 w-4" /> เลือกไฟล์ PDF
                </Button>
                <Button
                  variant="outline"
                  onClick={(e) => { e.stopPropagation(); folderInputRef.current?.click(); }}
                  className="gap-2"
                  style={{ borderColor: "#03c9d7", color: "#03c9d7" }}
                  data-testid="button-select-folder"
                >
                  <FolderOpen className="h-4 w-4" /> เลือกโฟลเดอร์
                </Button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf"
                className="hidden"
                onChange={handleFileSelect}
                data-testid="input-pdf-files"
              />
              <input
                ref={folderInputRef}
                type="file"
                className="hidden"
                onChange={handleFolderSelect}
                {...({ webkitdirectory: "", directory: "", multiple: true } as any)}
                data-testid="input-folder"
              />
            </CardContent>
          </Card>
        )}

        {step === "preview" && parseResult && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center gap-4 justify-between">
                  <div className="flex items-center gap-4">
                    <Badge variant="outline" className="text-sm px-3 py-1">
                      อ่านได้ {parseResult.successFiles} / {parseResult.totalFiles} ไฟล์
                    </Badge>
                    <Badge variant="outline" className="text-sm px-3 py-1 bg-[#fb9678]/10 text-[#fb9678] border-[#fb9678]">
                      เลือก {selectedDocs.size} รายการ
                    </Badge>
                    {importedFolderCount > 0 && (
                      <Badge variant="outline" className="text-sm px-3 py-1 bg-[#03c9d7]/10 text-[#03c9d7] border-[#03c9d7]">
                        {importedFolderCount} รอบนำเข้า
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">ประเภท:</span>
                      <Select value={docType} onValueChange={(v: "purchase" | "expense") => setDocType(v)}>
                        <SelectTrigger className="w-[180px] h-9" data-testid="select-doc-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="expense">ค่าใช้จ่าย (EXP)</SelectItem>
                          <SelectItem value="purchase">ใบสำคัญซื้อ (AP)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">ชำระ:</span>
                      <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                        <SelectTrigger className="w-[140px] h-9" data-testid="select-payment">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PAYMENT_METHODS.map(m => (
                            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">หัก ณ ที่จ่าย:</span>
                      <Select value={globalWhtRate} onValueChange={setGlobalWhtRate}>
                        <SelectTrigger className="w-[200px] h-9" data-testid="select-wht">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {WHT_RATES.map(r => (
                            <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="flex items-center justify-between px-4 pb-2">
                  <div className="flex items-center gap-2">
                    <Button variant="link" size="sm" onClick={selectAll} className="text-xs" data-testid="button-select-all">เลือกทั้งหมด</Button>
                    <Button variant="link" size="sm" onClick={deselectAll} className="text-xs" data-testid="button-deselect-all">ยกเลิกทั้งหมด</Button>
                  </div>
                  <div className="flex items-center gap-2">
                    {parseMutation.isPending && (
                      <div className="flex items-center gap-2 text-sm text-[#03c9d7]">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>กำลังอ่าน {parseProgress}/{parseTotalFiles}...</span>
                      </div>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addFileInputRef.current?.click()}
                      disabled={parseMutation.isPending}
                      className="gap-1.5 text-xs"
                      data-testid="button-add-more-files"
                    >
                      <FileText className="h-3.5 w-3.5" /> เพิ่มไฟล์
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addFolderInputRef.current?.click()}
                      disabled={parseMutation.isPending}
                      className="gap-1.5 text-xs"
                      style={{ borderColor: "#03c9d7", color: "#03c9d7" }}
                      data-testid="button-add-more-folder"
                    >
                      <FolderOpen className="h-3.5 w-3.5" /> เพิ่มโฟลเดอร์
                    </Button>
                    <input
                      ref={addFileInputRef}
                      type="file"
                      multiple
                      accept=".pdf"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                    <input
                      ref={addFolderInputRef}
                      type="file"
                      className="hidden"
                      onChange={handleFolderSelect}
                      {...({ webkitdirectory: "", directory: "", multiple: true } as any)}
                    />
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10"></TableHead>
                        <TableHead className="w-10">#</TableHead>
                        <TableHead>ไฟล์</TableHead>
                        <TableHead>เลขที่เอกสาร</TableHead>
                        <TableHead>วันที่</TableHead>
                        <TableHead>ผู้ขาย/ผู้รับเงิน</TableHead>
                        <TableHead>เลขผู้เสียภาษี</TableHead>
                        <TableHead>รายการ</TableHead>
                        <TableHead className="text-right">ยอดรวม</TableHead>
                        <TableHead className="text-right">VAT</TableHead>
                        <TableHead className="text-right">WHT</TableHead>
                        <TableHead className="text-center">สถานะ</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedDocs.map((doc, idx) => {
                        const docWht = whtRate > 0 ? Math.round(doc.subtotal * whtRate * 100) / 100 : 0;
                        const globalIdx = previewPage * PAGE_SIZE + idx + 1;
                        return (
                          <TableRow
                            key={doc.key}
                            className={doc.isDuplicate ? "bg-yellow-50" : doc.hasErrors ? "bg-red-50" : ""}
                            data-testid={`row-doc-${idx}`}
                          >
                            <TableCell>
                              <Checkbox
                                checked={selectedDocs.has(doc.key)}
                                onCheckedChange={() => toggleDoc(doc.key)}
                                disabled={doc.hasErrors}
                                data-testid={`check-doc-${idx}`}
                              />
                            </TableCell>
                            <TableCell className="text-sm text-gray-500">{globalIdx}</TableCell>
                            <TableCell className="text-sm max-w-[150px] truncate" title={doc.fileName}>
                              <div className="flex items-center gap-1">
                                <File className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                                <span className="truncate">{doc.fileName}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm font-mono">{doc.invoiceNo || "-"}</TableCell>
                            <TableCell className="text-sm">{formatDate(doc.date, dateEra, dateFmt)}</TableCell>
                            <TableCell className="text-sm max-w-[180px]">
                              <div className="truncate" title={doc.vendorName}>
                                {doc.vendorMatchName ? (
                                  <span className="text-emerald-700">{doc.vendorMatchName}</span>
                                ) : (
                                  doc.vendorName || "-"
                                )}
                              </div>
                              {doc.vendorMatchName && doc.vendorName !== doc.vendorMatchName && (
                                <div className="text-xs text-gray-400 truncate">PDF: {doc.vendorName}</div>
                              )}
                            </TableCell>
                            <TableCell className="text-sm font-mono">{doc.vendorTaxId || "-"}</TableCell>
                            <TableCell className="text-sm max-w-[250px]">
                              {doc.items.length > 0 ? (
                                <div className="space-y-0.5">
                                  {doc.items.slice(0, 3).map((item, iIdx) => (
                                    <div key={iIdx} className="flex items-center justify-between gap-2 text-xs">
                                      <span className="truncate text-gray-700">{item.description || item.productName || "-"}</span>
                                      <span className="text-gray-500 whitespace-nowrap">
                                        {item.qty && item.qty > 1 ? `${item.qty} × ` : ""}
                                        {fmt(item.amount || item.total)}
                                      </span>
                                    </div>
                                  ))}
                                  {doc.items.length > 3 && (
                                    <div className="text-[10px] text-gray-400">+{doc.items.length - 3} รายการ</div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right text-sm font-medium">{fmt(doc.subtotal)}</TableCell>
                            <TableCell className="text-right text-sm">{doc.vatAmount > 0 ? fmt(doc.vatAmount) : "-"}</TableCell>
                            <TableCell className="text-right text-sm">{docWht > 0 ? fmt(docWht) : "-"}</TableCell>
                            <TableCell className="text-center">
                              {doc.isDuplicate ? (
                                <Badge variant="outline" className="text-yellow-600 border-yellow-400 text-xs">ซ้ำ</Badge>
                              ) : doc.hasErrors ? (
                                <Badge variant="destructive" className="text-xs">ผิดพลาด</Badge>
                              ) : doc.vendorId ? (
                                <Badge variant="outline" className="text-emerald-600 border-emerald-400 text-xs">
                                  <CheckCircle2 className="h-3 w-3 mr-1" /> จับคู่แล้ว
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-gray-500 text-xs">สร้างใหม่</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleExpand(doc.key)} data-testid={`btn-expand-${idx}`}>
                                {expandedDocs.has(doc.key) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {paginatedDocs.map((doc, idx) =>
                        expandedDocs.has(doc.key) && (
                          <TableRow key={`${doc.key}-detail`} className="bg-gray-50/50">
                            <TableCell colSpan={13} className="p-4">
                              <div className="text-sm space-y-2">
                                <div className="font-medium text-gray-700 mb-2">รายการในเอกสาร</div>
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="text-xs">#</TableHead>
                                      <TableHead className="text-xs">รายละเอียด</TableHead>
                                      <TableHead className="text-xs text-right">จำนวน</TableHead>
                                      <TableHead className="text-xs">หน่วย</TableHead>
                                      <TableHead className="text-xs text-right">ราคา/หน่วย</TableHead>
                                      <TableHead className="text-xs text-right">ยอดรวม</TableHead>
                                      <TableHead className="text-xs">VAT</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {doc.items.map((item, iIdx) => (
                                      <TableRow key={iIdx}>
                                        <TableCell className="text-xs">{iIdx + 1}</TableCell>
                                        <TableCell className="text-xs">{item.description || item.productName}</TableCell>
                                        <TableCell className="text-xs text-right">{item.qty}</TableCell>
                                        <TableCell className="text-xs">{item.unit}</TableCell>
                                        <TableCell className="text-xs text-right">{fmt(item.unitPrice)}</TableCell>
                                        <TableCell className="text-xs text-right">{fmt(item.amount || item.total)}</TableCell>
                                        <TableCell className="text-xs">
                                          <Badge variant="outline" className="text-[10px]">
                                            {item.vatType === "vat7" ? "7%" : item.vatType === "zero_rated" ? "0%" : "N/A"}
                                          </Badge>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                                {doc.vendorAddress && (
                                  <div className="text-xs text-gray-500 mt-1">ที่อยู่: {doc.vendorAddress}</div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      )}
                    </TableBody>
                  </Table>
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 py-3">
                    <Button variant="outline" size="sm" disabled={previewPage === 0} onClick={() => setPreviewPage(p => p - 1)}>ก่อนหน้า</Button>
                    <span className="text-sm text-gray-500">หน้า {previewPage + 1} / {totalPages}</span>
                    <Button variant="outline" size="sm" disabled={previewPage >= totalPages - 1} onClick={() => setPreviewPage(p => p + 1)}>ถัดไป</Button>
                  </div>
                )}

                {parseResult.errors.length > 0 && (
                  <div className="px-4 pb-3">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-red-700 font-medium text-sm mb-1">
                        <XCircle className="h-4 w-4" /> อ่านไม่ได้ {parseResult.errors.length} ไฟล์
                      </div>
                      {parseResult.errors.map((e, i) => (
                        <div key={i} className="text-xs text-red-600 ml-6">{e.fileName}: {e.error}</div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="autoJournal"
                      checked={autoJournal}
                      onCheckedChange={(v) => setAutoJournal(!!v)}
                      data-testid="check-auto-journal"
                    />
                    <label htmlFor="autoJournal" className="text-sm font-medium cursor-pointer">
                      บันทึกบัญชีอัตโนมัติ (สร้าง Journal Entry พร้อมกัน)
                    </label>
                    {autoJournal && (
                      <Button variant="outline" size="sm" onClick={() => setShowJournalPreview(!showJournalPreview)} data-testid="button-journal-preview" className="text-xs">
                        <BookOpen className="h-3.5 w-3.5 mr-1" />
                        {showJournalPreview ? "ซ่อนพรีวิวบัญชี" : "ดูพรีวิวบัญชี"}
                      </Button>
                    )}
                    <span className="mx-2 text-gray-300">|</span>
                    <Checkbox
                      id="archiveToDocs"
                      checked={archiveToDocs}
                      onCheckedChange={(v) => setArchiveToDocs(!!v)}
                      data-testid="check-archive-docs"
                    />
                    <label htmlFor="archiveToDocs" className="text-sm font-medium cursor-pointer">
                      เก็บ PDF เข้าคลังเอกสาร
                    </label>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div>ยอดรวม: <span className="font-bold">{fmt(totalSubtotal)}</span></div>
                    {totalVat > 0 && <div>VAT: <span className="font-medium text-blue-600">{fmt(totalVat)}</span></div>}
                    {totalWht > 0 && <div>WHT: <span className="font-medium text-red-600">-{fmt(totalWht)}</span></div>}
                    <div>สุทธิ: <span className="font-bold text-[#fb9678]">{fmt(grandTotal)}</span></div>
                  </div>
                </div>

                {autoJournal && availableFormulas.length > 0 && (
                  <div className="mt-3 flex items-center gap-3">
                    <label className="text-sm font-medium whitespace-nowrap">สูตรบัญชี:</label>
                    <Select value={selectedFormulaIdx} onValueChange={setSelectedFormulaIdx} data-testid="select-formula">
                      <SelectTrigger className="w-[400px]" data-testid="select-formula-trigger">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {availableFormulas.map((f: any, idx: number) => (
                          <SelectItem key={idx} value={String(idx)} data-testid={`formula-option-${idx}`}>
                            {f.nameTh} {f.source === "default" ? `(${f.businessType})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedFormula?.source === "default" && (
                      <Badge variant="outline" className="text-xs">สูตรเริ่มต้น</Badge>
                    )}
                  </div>
                )}

                {showJournalPreview && autoJournal && selectedDocsList.length > 0 && (
                  <div className="mt-4 border rounded-lg p-4 bg-blue-50/50">
                    <div className="text-sm font-medium mb-3 text-blue-800 flex items-center gap-2">
                      <BookOpen className="h-4 w-4" /> พรีวิวการบันทึกบัญชี (ตัวอย่าง — ต่อเอกสาร)
                    </div>
                    <div className="bg-white rounded border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">รหัสบัญชี</TableHead>
                            <TableHead className="text-xs">ชื่อบัญชี</TableHead>
                            <TableHead className="text-xs text-right">เดบิต</TableHead>
                            <TableHead className="text-xs text-right">เครดิต</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(() => {
                            const lines = selectedFormula?.lines?.length > 0
                              ? [...selectedFormula.lines].sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0))
                              : [
                                  { accountCode: "5xxx", accountName: "ค่าใช้จ่าย / ต้นทุน", direction: "debit", sortOrder: 1 },
                                  { accountCode: "1432000", accountName: "ภาษีซื้อ", direction: "debit", sortOrder: 2 },
                                  { accountCode: "1001000", accountName: "เงินสด/เงินฝากธนาคาร", direction: "credit", sortOrder: 3 },
                                ];

                            const isVatLine = (l: any) => {
                              const n = (l.accountName || "").toLowerCase();
                              const c = l.accountCode || "";
                              return n.includes("ภาษีซื้อ") || n.includes("input vat") || c.startsWith("143") || c === "170";
                            };

                            const debitLines = lines.filter((l: any) => l.direction === "debit");
                            const creditLines = lines.filter((l: any) => l.direction === "credit");
                            const debitMainLines = debitLines.filter((l: any) => !isVatLine(l));
                            const debitVatLines = debitLines.filter((l: any) => isVatLine(l));

                            let totalDebitAmt = 0;
                            let totalCreditAmt = 0;

                            const rows: { code: string; name: string; debit: number; credit: number }[] = [];

                            for (const l of debitMainLines) {
                              const amt = totalSubtotal / (debitMainLines.length || 1);
                              rows.push({ code: l.accountCode, name: l.accountName, debit: amt, credit: 0 });
                              totalDebitAmt += amt;
                            }

                            for (const l of debitVatLines) {
                              if (totalVat > 0) {
                                rows.push({ code: l.accountCode, name: l.accountName, debit: totalVat, credit: 0 });
                                totalDebitAmt += totalVat;
                              }
                            }

                            if (totalWht > 0) {
                              rows.push({ code: "2341000", name: "ภาษีหัก ณ ที่จ่าย", debit: 0, credit: totalWht });
                              totalCreditAmt += totalWht;
                            }

                            const remainingCredit = totalDebitAmt - totalCreditAmt;
                            for (const l of creditLines) {
                              const amt = remainingCredit / (creditLines.length || 1);
                              rows.push({ code: l.accountCode, name: l.accountName, debit: 0, credit: amt });
                              totalCreditAmt += amt;
                            }

                            return (
                              <>
                                {rows.map((r, idx) => (
                                  <TableRow key={idx}>
                                    <TableCell className="text-xs font-mono">{r.code}</TableCell>
                                    <TableCell className="text-xs">{r.name}</TableCell>
                                    <TableCell className="text-xs text-right font-medium">{r.debit > 0 ? fmt(r.debit) : "-"}</TableCell>
                                    <TableCell className="text-xs text-right font-medium">{r.credit > 0 ? fmt(r.credit) : "-"}</TableCell>
                                  </TableRow>
                                ))}
                                <TableRow className="bg-gray-50 font-bold">
                                  <TableCell className="text-xs" colSpan={2}>รวม ({selectedDocsList.length} เอกสาร)</TableCell>
                                  <TableCell className="text-xs text-right">{fmt(totalDebitAmt)}</TableCell>
                                  <TableCell className="text-xs text-right">{fmt(totalCreditAmt)}</TableCell>
                                </TableRow>
                              </>
                            );
                          })()}
                        </TableBody>
                      </Table>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">* พรีวิวยอดรวม — การบันทึกจริงจะสร้าง Journal Entry แยกต่อเอกสาร</p>
                  </div>
                )}

                <div className="flex justify-end gap-3 mt-4">
                  <Button variant="outline" onClick={() => { setStep("upload"); setParseResult(null); }} data-testid="button-cancel">
                    <X className="h-4 w-4 mr-1" /> ยกเลิก
                  </Button>
                  <Button
                    onClick={() => createMutation.mutate()}
                    disabled={selectedDocs.size === 0 || createMutation.isPending}
                    className="bg-[#fb9678] hover:bg-[#e8856a] text-white"
                    data-testid="button-create-all"
                  >
                    {createMutation.isPending ? (
                      <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> กำลังสร้าง...</>
                    ) : (
                      <><CheckCircle2 className="h-4 w-4 mr-1" /> สร้างเอกสาร {selectedDocs.size} รายการ</>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {step === "result" && createResult && (
          <Card>
            <CardContent className="p-6">
              <div className="text-center mb-6">
                <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto mb-3" />
                <h2 className="text-xl font-bold" data-testid="text-result-title">สร้างเอกสารเสร็จสิ้น</h2>
              </div>
              <div className="grid grid-cols-3 gap-4 max-w-md mx-auto mb-6">
                <div className="text-center p-3 bg-emerald-50 rounded-lg">
                  <div className="text-2xl font-bold text-emerald-600" data-testid="text-created-count">{createResult.created.length}</div>
                  <div className="text-xs text-gray-500">สร้างแล้ว</div>
                </div>
                <div className="text-center p-3 bg-yellow-50 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600" data-testid="text-skipped-count">{createResult.skipped.length}</div>
                  <div className="text-xs text-gray-500">ข้าม (ซ้ำ)</div>
                </div>
                <div className="text-center p-3 bg-red-50 rounded-lg">
                  <div className="text-2xl font-bold text-red-600" data-testid="text-error-count">{createResult.errors.length}</div>
                  <div className="text-xs text-gray-500">ผิดพลาด</div>
                </div>
              </div>

              {createResult.created.length > 0 && parseResult && (
                <div className="mb-4">
                  <div className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    ตรวจสอบการนำเข้า — เทียบ PDF กับเอกสารที่สร้าง
                  </div>
                  <div className="border rounded-lg overflow-auto max-h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead className="text-xs">#</TableHead>
                          <TableHead className="text-xs">เลขที่เอกสาร</TableHead>
                          <TableHead className="text-xs">เลข Ref (PDF)</TableHead>
                          <TableHead className="text-xs">ผู้ขาย</TableHead>
                          <TableHead className="text-xs text-right">ยอดรวม (PDF)</TableHead>
                          <TableHead className="text-xs text-right">ยอดรวม (บันทึก)</TableHead>
                          <TableHead className="text-xs text-right">VAT (PDF)</TableHead>
                          <TableHead className="text-xs text-right">VAT (บันทึก)</TableHead>
                          <TableHead className="text-xs text-center">ผล</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {createResult.created.map((saved, idx) => {
                          const pdfDoc = parseResult.documents.find(d =>
                            selectedDocs.has(d.key) && (
                              (saved.taxInvoiceRef && d.invoiceNo === saved.taxInvoiceRef) ||
                              (d.vendorName && saved.vendorName && d.vendorName === saved.vendorName && idx < parseResult.documents.filter(dd => selectedDocs.has(dd.key)).length)
                            )
                          ) || parseResult.documents.filter(d => selectedDocs.has(d.key) && !d.hasErrors && !d.isDuplicate)[idx];
                          const pdfSub = pdfDoc?.subtotal || 0;
                          const savedSub = parseFloat(String(saved.subtotal || "0"));
                          const pdfVat = pdfDoc?.vatAmount || 0;
                          const savedVat = parseFloat(String(saved.vatAmount || "0"));
                          const subMatch = Math.abs(pdfSub - savedSub) < 0.02;
                          const vatMatch = Math.abs(pdfVat - savedVat) < 0.02;
                          const allMatch = subMatch && vatMatch;
                          return (
                            <TableRow key={idx} className={allMatch ? "" : "bg-yellow-50"}>
                              <TableCell className="text-xs">{idx + 1}</TableCell>
                              <TableCell className="text-xs font-mono">{saved.apNo || saved.expNo}</TableCell>
                              <TableCell className="text-xs font-mono text-gray-500">{saved.taxInvoiceRef || pdfDoc?.invoiceNo || "-"}</TableCell>
                              <TableCell className="text-xs max-w-[150px] truncate">{saved.vendorName || "-"}</TableCell>
                              <TableCell className="text-xs text-right">{fmt(pdfSub)}</TableCell>
                              <TableCell className={`text-xs text-right font-medium ${subMatch ? "text-emerald-600" : "text-red-600"}`}>{fmt(savedSub)}</TableCell>
                              <TableCell className="text-xs text-right">{pdfVat > 0 ? fmt(pdfVat) : "-"}</TableCell>
                              <TableCell className={`text-xs text-right font-medium ${vatMatch ? "text-emerald-600" : "text-red-600"}`}>{savedVat > 0 ? fmt(savedVat) : "-"}</TableCell>
                              <TableCell className="text-center">
                                {allMatch ? (
                                  <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" />
                                ) : (
                                  <AlertCircle className="h-4 w-4 text-yellow-500 mx-auto" />
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="text-[11px] text-gray-400 mt-1">
                    * เทียบยอดเงินจาก PDF กับที่บันทึกจริง — เครื่องหมาย ✓ = ตรงกัน, ⚠ = ต่างกัน
                  </div>
                </div>
              )}

              {createResult.errors.length > 0 && (
                <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="text-sm font-medium text-red-700 mb-1">ผิดพลาด:</div>
                  {createResult.errors.map((e, i) => (
                    <div key={i} className="text-xs text-red-600">{e.apNo || e.expNo}: {e.error}</div>
                  ))}
                </div>
              )}

              <div className="flex justify-center gap-3 mt-6">
                <Button variant="outline" onClick={() => { setStep("upload"); setParseResult(null); setCreateResult(null); }} data-testid="button-import-more">
                  <Upload className="h-4 w-4 mr-1" /> นำเข้าเพิ่ม
                </Button>
                <Button
                  onClick={() => navigate(docType === "expense" ? "/purchases/expenses" : "/purchases/ap")}
                  className="bg-[#fb9678] hover:bg-[#e8856a] text-white"
                  data-testid="button-go-list"
                >
                  <FileText className="h-4 w-4 mr-1" /> ดูรายการ
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
