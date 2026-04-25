import { useRef } from "react";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Printer, Download, FileText } from "lucide-react";

const FORM_LABELS: Record<string, string> = {
  tax_invoice: "ใบกำกับภาษี",
  tax_invoice_receipt: "ใบเสร็จรับเงิน/ใบกำกับภาษี",
  invoice: "ใบแจ้งหนี้",
  receipt: "ใบเสร็จรับเงิน",
  delivery_note: "ใบส่งของ",
};

export default function TaxInvoiceShare() {
  const { token } = useParams<{ token: string }>();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const params = new URLSearchParams(window.location.search);
  const printType = params.get("printType") || "tax_invoice";
  const label = FORM_LABELS[printType] || "ใบกำกับภาษี";

  const pdfUrl = `/api/share/tax_invoice/${token}/pdf${printType && printType !== "tax_invoice" ? `?printType=${printType}` : ""}`;

  return (
    <div className="min-h-screen bg-slate-700">
      <div className="sticky top-0 z-50 bg-slate-800 border-b border-slate-600 px-4 py-2.5 flex items-center justify-between print:hidden">
        <div className="flex items-center gap-2 text-white min-w-0">
          <FileText className="h-5 w-5 text-[var(--theme-primary)] flex-shrink-0" />
          <span className="text-sm font-medium">{label}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => iframeRef.current?.contentWindow?.print()}
            className="text-slate-300 hover:text-white hover:bg-slate-700 gap-1.5 h-8 text-xs"
            data-testid="button-print"
          >
            <Printer className="h-4 w-4" />
            <span className="hidden sm:inline">พิมพ์</span>
          </Button>
          <a href={pdfUrl} download>
            <Button
              size="sm"
              className="bg-[var(--theme-primary)] hover:bg-[#e8856a] text-white gap-1.5 h-8 text-xs"
              data-testid="button-download-pdf"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">ดาวน์โหลด PDF</span>
              <span className="sm:hidden">PDF</span>
            </Button>
          </a>
        </div>
      </div>
      <div className="flex justify-center">
        <iframe
          ref={iframeRef}
          src={pdfUrl}
          className="w-full max-w-4xl border-0"
          style={{ height: "calc(100vh - 48px)" }}
          title={label}
        />
      </div>
    </div>
  );
}
