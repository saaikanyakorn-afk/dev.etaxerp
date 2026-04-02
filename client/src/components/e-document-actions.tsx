import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Download,
  Mail,
  Send,
  Loader2,
  CheckCircle2,
  History,
  AlertTriangle,
  RefreshCw,
  WifiOff,
  X,
} from "lucide-react";

type FormType = "tax_invoice" | "tax_invoice_receipt" | "receipt";

const FORM_OPTIONS: { key: FormType; label: string }[] = [
  { key: "tax_invoice", label: "ใบกำกับภาษี" },
  { key: "tax_invoice_receipt", label: "ใบเสร็จรับเงิน/ใบกำกับภาษี" },
  { key: "receipt", label: "ใบเสร็จรับเงิน" },
];

interface EDocumentActionsProps {
  documentType: string;
  documentId: number;
  docNo: string;
  customerEmail?: string;
  customerName?: string;
  compact?: boolean;
  showFormTypeSelector?: boolean;
}

const DOC_LABELS: Record<string, string> = {
  invoice: "ใบแจ้งหนี้",
  tax_invoice: "ใบกำกับภาษี",
  receipt: "ใบเสร็จรับเงิน",
  quotation: "ใบเสนอราคา",
  sales_order: "ใบสั่งขาย",
};

type PdfErrorType = "network" | "timeout" | "server" | "unknown";

interface PdfErrorState {
  type: PdfErrorType;
  message: string;
  detail?: string;
}

function classifyError(err: any, aborted: boolean): PdfErrorState {
  if (aborted) {
    return { type: "network", message: "การเชื่อมต่อขาดหาย", detail: "การดาวน์โหลดถูกยกเลิกเนื่องจากการเชื่อมต่อเครือข่ายขาดหาย กรุณาตรวจสอบสัญญาณอินเทอร์เน็ตแล้วลองใหม่" };
  }
  const msg = String(err?.message || "");
  if (msg.includes("Failed to fetch") || msg.includes("NetworkError") || msg.includes("network") || msg.includes("ERR_NETWORK") || msg.includes("ERR_CONNECTION")) {
    return { type: "network", message: "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้", detail: "เครือข่ายอินเทอร์เน็ตอาจขาดหาย หรือเซิร์ฟเวอร์ไม่ตอบสนอง กรุณาตรวจสอบสัญญาณแล้วลองใหม่" };
  }
  if (msg.includes("timeout") || msg.includes("Timeout")) {
    return { type: "timeout", message: "หมดเวลาสร้าง PDF", detail: "เอกสารอาจมีจำนวนรายการมากเกินไป ทำให้สร้าง PDF ไม่ทันภายในเวลาที่กำหนด กรุณาลองอีกครั้ง" };
  }
  if (msg.includes("500") || msg.includes("Server") || msg.includes("ไม่สามารถสร้าง PDF")) {
    return { type: "server", message: "เซิร์ฟเวอร์เกิดข้อผิดพลาด", detail: msg };
  }
  return { type: "unknown", message: "เกิดข้อผิดพลาด", detail: msg || "ไม่ทราบสาเหตุ กรุณาลองอีกครั้ง" };
}

const ERROR_ICONS: Record<PdfErrorType, typeof WifiOff> = {
  network: WifiOff,
  timeout: AlertTriangle,
  server: AlertTriangle,
  unknown: AlertTriangle,
};

export default function EDocumentActions({
  documentType,
  documentId,
  docNo,
  customerEmail,
  customerName,
  compact = false,
  showFormTypeSelector = false,
}: EDocumentActionsProps) {
  const { toast } = useToast();
  const [downloading, setDownloading] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [pdfError, setPdfError] = useState<PdfErrorState | null>(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [email, setEmail] = useState(customerEmail || "");
  const [recipientName, setRecipientName] = useState(customerName || "");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [formType, setFormType] = useState<FormType>("tax_invoice");
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const docLabel = DOC_LABELS[documentType] || "เอกสาร";

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  const handleDownloadPdf = useCallback(() => {
    window.print();
  }, []);

  const handleCancelDownload = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setDownloading(false);
    setElapsedSec(0);
  }, []);

  const handleSendEmail = async () => {
    if (!email) return;
    setSending(true);
    try {
      const res = await fetch(`/api/documents/${documentType}/${documentId}/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          recipientEmail: email,
          recipientName,
          subject,
          message,
          ...(showFormTypeSelector && formType !== "tax_invoice" ? { printType: formType } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast({ title: "ส่งอีเมลสำเร็จ", description: data.message, variant: "success" as any });
      setEmailDialogOpen(false);
    } catch (err: any) {
      toast({ title: "ส่งอีเมลไม่สำเร็จ", description: err.message, variant: "destructive" });
    }
    setSending(false);
  };

  const openEmailDialog = () => {
    setEmail(customerEmail || "");
    setRecipientName(customerName || "");
    setSubject("");
    setMessage("");
    setEmailDialogOpen(true);
  };

  const ErrorIcon = pdfError ? ERROR_ICONS[pdfError.type] : AlertTriangle;

  const pdfErrorDialog = (
    <Dialog open={!!pdfError} onOpenChange={(open) => { if (!open) setPdfError(null); }}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2 text-red-600">
            <ErrorIcon className="h-5 w-5" />
            สร้าง PDF ไม่สำเร็จ
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="font-medium text-red-800 text-[15px]">{pdfError?.message}</p>
            {pdfError?.detail && (
              <p className="text-red-600 text-sm mt-2">{pdfError.detail}</p>
            )}
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-sm">
            <span className="text-gray-500">เอกสาร:</span>{" "}
            <span className="font-semibold">{docNo}</span>
          </div>
          {pdfError?.type === "network" && (
            <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <WifiOff className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <p>ตรวจสอบว่าเชื่อมต่ออินเทอร์เน็ตอยู่ แล้วกดปุ่ม "ลองใหม่"</p>
            </div>
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setPdfError(null)} data-testid="btn-error-close">
            ปิด
          </Button>
          <Button
            onClick={() => { setPdfError(null); handleDownloadPdf(); }}
            className="bg-[#fb9678] hover:bg-[#e8856a] text-white gap-1.5"
            data-testid="btn-error-retry"
          >
            <RefreshCw className="h-4 w-4" />
            ลองใหม่
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const emailDialog = (
    <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <Mail className="h-5 w-5 text-[#fb9678]" />
            ส่ง{docLabel}ทางอีเมล
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="bg-gray-50 rounded-lg p-3 text-sm">
            <span className="text-gray-500">เอกสาร:</span>{" "}
            <span className="font-semibold">{docNo}</span>
          </div>
          {showFormTypeSelector && (
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">รูปแบบเอกสาร</label>
              <div className="flex gap-1.5 flex-wrap">
                {FORM_OPTIONS.map(opt => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setFormType(opt.key)}
                    className={`px-2.5 py-1.5 rounded-md border text-xs transition-colors ${
                      formType === opt.key
                        ? "bg-blue-50 border-blue-400 text-blue-700 font-medium"
                        : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                    data-testid={`btn-email-form-type-${opt.key}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">อีเมลผู้รับ *</label>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="customer@example.com"
              type="email"
              data-testid="input-recipient-email"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">ชื่อผู้รับ</label>
            <Input
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="ชื่อบริษัท หรือ ชื่อผู้รับ"
              data-testid="input-recipient-name"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">หัวเรื่อง (ไม่ต้องกรอกก็ได้)</label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={`${docLabel} ${docNo}`}
              data-testid="input-email-subject"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">ข้อความเพิ่มเติม</label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="ข้อความที่ต้องการส่งถึงผู้รับ..."
              rows={3}
              data-testid="input-email-message"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>
            ยกเลิก
          </Button>
          <Button
            onClick={handleSendEmail}
            disabled={!email || sending}
            className="bg-[#fb9678] hover:bg-[#e8856a] text-white gap-1.5"
            data-testid="btn-confirm-send-email"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            ส่งอีเมล
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const downloadButton = (size: "sm" | "default" = "sm") => (
    <Button
      variant="outline"
      size={size}
      className={`gap-1.5 ${compact ? "text-sm" : ""}`}
      onClick={handleDownloadPdf}
      data-testid="btn-download-pdf"
    >
      <Download className={`${compact ? "h-3.5 w-3.5" : "h-4 w-4"} ${compact ? "" : "text-[#05b187]"}`} />
      {compact ? "PDF" : "บันทึก PDF / พิมพ์"}
    </Button>
  );

  if (compact) {
    return (
      <>
        {downloadButton("sm")}
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-sm"
          onClick={openEmailDialog}
          data-testid="btn-send-email"
        >
          <Mail className="h-3.5 w-3.5" />
          อีเมล
        </Button>
        {pdfErrorDialog}
        {emailDialog}
      </>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {downloadButton("sm")}
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={openEmailDialog}
        data-testid="btn-send-email"
      >
        <Mail className="h-4 w-4 text-[var(--theme-primary)]" />
        ส่งอีเมล
      </Button>
      {pdfErrorDialog}
      {emailDialog}
    </div>
  );
}
