import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/lib/company-context";
import { useQueryClient } from "@tanstack/react-query";
import { Send, Loader2, Mail, AlertCircle, ChevronDown, ChevronUp, CheckCircle2, XCircle } from "lucide-react";

type FormType = "tax_invoice" | "tax_invoice_receipt" | "receipt";

const FORM_OPTIONS: { key: FormType; label: string }[] = [
  { key: "tax_invoice", label: "ใบกำกับภาษี" },
  { key: "tax_invoice_receipt", label: "ใบเสร็จรับเงิน/ใบกำกับภาษี" },
  { key: "receipt", label: "ใบเสร็จรับเงิน" },
];

interface EtaxSendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taxInvoiceId: number;
  taxInvoiceNo: string;
  isResend?: boolean;
  existingSentTo?: string;
  defaultPrintType?: FormType;
  onPrintTypeChange?: (pt: FormType) => void;
}

export function EtaxSendDialog({ open, onOpenChange, taxInvoiceId, taxInvoiceNo, isResend, existingSentTo, defaultPrintType, onPrintTypeChange }: EtaxSendDialogProps) {
  const { toast } = useToast();
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const queryClient = useQueryClient();

  const [buyerEmail, setBuyerEmail] = useState("");
  const [isTestMode, setIsTestMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [formType, setFormType] = useState<FormType>(defaultPrintType || "tax_invoice");
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);

  // Blocking error — shown prominently, disables send button entirely
  const [blockingError, setBlockingError] = useState<{
    type: "fetch_failed" | "no_buyer_email";
    message: string;
    detail: string;
  } | null>(null);

  useEffect(() => {
    if (defaultPrintType) setFormType(defaultPrintType);
  }, [defaultPrintType]);

  useEffect(() => {
    if (!open) return;
    if (!taxInvoiceId || !companyId) return;

    setDebugInfo([]);
    setShowDebug(false);
    setSendSuccess(false);
    setBlockingError(null);

    if (existingSentTo) {
      setBuyerEmail(existingSentTo);
      setIsTestMode(false);
      return;
    }

    setFetching(true);
    fetch(`/api/etax/buyer-email?taxInvoiceId=${taxInvoiceId}&companyId=${companyId}`, {
      credentials: "include",
    })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status} — server ตอบกลับ error`);
        return r.json();
      })
      .then((data) => {
        setBuyerEmail(data.email || "");
        setIsTestMode(data.isTestEmail || false);

        // No email found in contact record — block send, show actionable error
        if (!data.hasEmail && !data.isTestEmail) {
          const contactLabel = data.contactName
            ? `"${data.contactName}"${data.contactId ? ` (id: ${data.contactId})` : ""}`
            : data.contactId
              ? `contact id: ${data.contactId}`
              : "ผู้ซื้อรายนี้";
          setBlockingError({
            type: "no_buyer_email",
            message: "ส่ง e-Tax ไม่ได้ — ไม่พบ Email ผู้ซื้อ",
            detail: `${contactLabel} ไม่มี email ในระบบ กรุณาเพิ่ม email ที่หน้า Contacts ก่อนส่ง e-Tax`,
          });
        }
      })
      .catch((err: Error) => {
        // Network error or non-OK response — must not silently ignore
        setBuyerEmail("");
        setBlockingError({
          type: "fetch_failed",
          message: "โหลดข้อมูลผู้ซื้อไม่สำเร็จ",
          detail: `${err.message} — ไม่สามารถส่ง e-Tax ได้จนกว่าจะโหลดข้อมูลสำเร็จ (taxInvoiceId=${taxInvoiceId}, companyId=${companyId})`,
        });
      })
      .finally(() => setFetching(false));
  }, [open, taxInvoiceId, companyId, existingSentTo]);

  const handleSend = async () => {
    if (blockingError) return; // guarded by disabled button, but double-check
    if (!buyerEmail.trim()) {
      toast({ title: "กรุณาระบุอีเมลผู้ซื้อ", variant: "destructive" });
      return;
    }
    setLoading(true);
    setDebugInfo([]);
    setShowDebug(false);
    try {
      const res = await fetch("/api/etax/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          taxInvoiceId,
          companyId,
          recipientEmailOverride: buyerEmail.trim(),
          printType: formType,
        }),
      });
      const data = await res.json();
      if (data.debugInfo?.length) {
        setDebugInfo(data.debugInfo);
        setShowDebug(true);
      }
      if (!res.ok) throw new Error(data.message);
      setSendSuccess(true);
      queryClient.invalidateQueries({ queryKey: ["/api/tax-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/etax/sent-list"] });
    } catch (err: any) {
      toast({ title: "ส่ง e-Tax ไม่สำเร็จ", description: err.message, variant: "destructive" });
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-[#fb9678]" />
            {isResend ? "ส่งซ้ำ e-Tax Invoice" : "ส่ง e-Tax Invoice"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
            <p>เอกสาร: <span className="font-semibold">{taxInvoiceNo}</span></p>
            <p className="text-xs mt-1">ระบบจะสร้าง PDF/A-3 พร้อม XML ตามมาตรฐาน สพธอ. และส่ง Email พร้อม CC ไปยัง Time Stamp</p>
          </div>

          {/* Blocking error — shown prominently before everything else, send button disabled */}
          {blockingError && (
            <div
              className="flex gap-3 bg-red-50 border border-red-400 rounded-lg p-3"
              data-testid="etax-blocking-error"
            >
              <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-red-700">{blockingError.message}</p>
                <p className="text-xs text-red-600 leading-relaxed">{blockingError.detail}</p>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              รูปแบบเอกสาร
            </label>
            <div className="flex flex-col gap-1.5">
              {FORM_OPTIONS.map(opt => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => { setFormType(opt.key); onPrintTypeChange?.(opt.key); }}
                  className={`text-left px-3 py-2 rounded-md border text-sm transition-colors ${
                    formType === opt.key
                      ? "bg-blue-50 border-blue-400 text-blue-700 font-medium"
                      : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                  data-testid={`btn-form-type-${opt.key}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email ผู้ซื้อ (ผู้รับ)
            </label>
            {fetching ? (
              <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
                <Loader2 className="h-4 w-4 animate-spin" /> กำลังโหลด...
              </div>
            ) : (
              <Input
                value={buyerEmail}
                onChange={(e) => setBuyerEmail(e.target.value)}
                placeholder="buyer@example.com"
                type="email"
                disabled={isTestMode || !!blockingError}
                data-testid="input-etax-buyer-email"
              />
            )}
            {isTestMode && (
              <p className="flex items-center gap-1 text-xs text-amber-600 mt-1">
                <AlertCircle className="h-3 w-3" />
                โหมดทดสอบ — ส่งไปที่อีเมลทดสอบที่ตั้งค่าไว้ (แก้ได้ที่หน้าตั้งค่า e-Tax)
              </p>
            )}
          </div>

          {sendSuccess && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              <span>ส่ง e-Tax Invoice สำเร็จ — อีเมลถูกส่งไปยัง csemail เพื่อประทับเวลาแล้ว</span>
            </div>
          )}

          {debugInfo.length > 0 && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setShowDebug(!showDebug)}
                className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 text-xs font-medium text-gray-600 hover:bg-gray-100"
                data-testid="btn-toggle-debug"
              >
                <span>Debug Log ({debugInfo.length} รายการ)</span>
                {showDebug ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
              {showDebug && (
                <div
                  className="bg-gray-900 text-green-400 text-xs font-mono p-3 max-h-40 overflow-y-auto space-y-0.5"
                  data-testid="debug-log-panel"
                >
                  {debugInfo.map((line, i) => (
                    <div key={i} className="leading-relaxed">{line}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {sendSuccess ? (
            <Button onClick={() => onOpenChange(false)} className="bg-[#fb9678] hover:bg-[#fb9678]/90 text-white">
              ปิด
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                ยกเลิก
              </Button>
              <Button
                onClick={handleSend}
                disabled={loading || fetching || !!blockingError || !buyerEmail.trim()}
                className="bg-[#fb9678] hover:bg-[#fb9678]/90 text-white gap-1.5"
                data-testid="button-confirm-etax-send"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {isResend ? "ส่งซ้ำ" : "ส่ง e-Tax Invoice"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
