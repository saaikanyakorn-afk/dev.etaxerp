import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/lib/company-context";
import { useQueryClient } from "@tanstack/react-query";
import { Send, Loader2, Mail, AlertCircle } from "lucide-react";

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

  useEffect(() => {
    if (defaultPrintType) setFormType(defaultPrintType);
  }, [defaultPrintType]);

  useEffect(() => {
    if (open && taxInvoiceId && companyId) {
      if (existingSentTo) {
        setBuyerEmail(existingSentTo);
        setIsTestMode(false);
      } else {
        setFetching(true);
        fetch(`/api/etax/buyer-email?taxInvoiceId=${taxInvoiceId}&companyId=${companyId}`, {
          credentials: "include",
        })
          .then((r) => r.json())
          .then((data) => {
            setBuyerEmail(data.email || "");
            setIsTestMode(data.isTestEmail || false);
          })
          .catch(() => {})
          .finally(() => setFetching(false));
      }
    }
  }, [open, taxInvoiceId, companyId, existingSentTo]);

  const handleSend = async () => {
    if (!buyerEmail.trim()) {
      toast({ title: "กรุณาระบุอีเมลผู้ซื้อ", variant: "destructive" });
      return;
    }
    setLoading(true);
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
      if (!res.ok) throw new Error(data.message);
      toast({
        title: isResend ? "ส่ง e-Tax Invoice ซ้ำสำเร็จ" : "ส่ง e-Tax Invoice สำเร็จ",
        description: `ส่งถึง: ${data.to}${data.cc?.length ? ` (CC: ${data.cc.join(", ")})` : ""}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/tax-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/etax/sent-list"] });
      onOpenChange(false);
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
                disabled={isTestMode}
                data-testid="input-etax-buyer-email"
              />
            )}
            {isTestMode && (
              <p className="flex items-center gap-1 text-xs text-amber-600 mt-1">
                <AlertCircle className="h-3 w-3" />
                โหมดทดสอบ — ส่งไปที่อีเมลทดสอบที่ตั้งค่าไว้ (แก้ได้ที่หน้าตั้งค่า e-Tax)
              </p>
            )}
            {!fetching && !buyerEmail && !isTestMode && (
              <p className="flex items-center gap-1 text-xs text-amber-600 mt-1">
                <AlertCircle className="h-3 w-3" />
                ไม่พบอีเมลผู้ซื้อ กรุณากรอกอีเมลก่อนส่ง
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            ยกเลิก
          </Button>
          <Button
            onClick={handleSend}
            disabled={loading || !buyerEmail.trim()}
            className="bg-[#fb9678] hover:bg-[#fb9678]/90 text-white gap-1.5"
            data-testid="button-confirm-etax-send"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {isResend ? "ส่งซ้ำ" : "ส่ง e-Tax Invoice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
