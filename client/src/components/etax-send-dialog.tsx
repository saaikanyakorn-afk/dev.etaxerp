import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/lib/company-context";
import { useQueryClient } from "@tanstack/react-query";
import { Send, Loader2, Mail, ChevronDown, ChevronUp, CheckCircle2 } from "lucide-react";

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
  defaultPrintType?: FormType;
  onPrintTypeChange?: (pt: FormType) => void;
}

export function EtaxSendDialog({ open, onOpenChange, taxInvoiceId, taxInvoiceNo, defaultPrintType, onPrintTypeChange }: EtaxSendDialogProps) {
  const { toast } = useToast();
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const queryClient = useQueryClient();

  const [loading, setLoading] = useState(false);
  const [formType, setFormType] = useState<FormType>(defaultPrintType || "tax_invoice");
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);

  useEffect(() => {
    if (defaultPrintType) setFormType(defaultPrintType);
  }, [defaultPrintType]);

  useEffect(() => {
    if (!open) return;
    setDebugInfo([]);
    setShowDebug(false);
    setSendSuccess(false);
  }, [open, taxInvoiceId]);

  const handleSend = async () => {
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
            ส่ง e-Tax Invoice ไปยังกรมสรรพากร
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
            <p>เอกสาร: <span className="font-semibold">{taxInvoiceNo}</span></p>
            <p className="text-xs mt-1.5">ระบบจะสร้าง PDF/A-3 พร้อม XML ตามมาตรฐาน สพธอ. และส่งไปยังกรมสรรพากรเพื่อประทับเวลา กรมสรรพากรจะส่งเอกสารต่อให้ลูกค้าเอง</p>
          </div>

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

          {sendSuccess && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              <span>ส่ง e-Tax Invoice ไปยังกรมสรรพากรสำเร็จ — กรมสรรพากรจะส่งเอกสารที่ประทับเวลาแล้วให้ลูกค้าเอง</span>
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
                disabled={loading}
                className="bg-[#fb9678] hover:bg-[#fb9678]/90 text-white gap-1.5"
                data-testid="button-confirm-etax-send"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                ส่งไปยังกรมสรรพากร
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
