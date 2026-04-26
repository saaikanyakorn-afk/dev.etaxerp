import { useState, useEffect, useRef } from "react";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Printer, Download, Loader2, FileText } from "lucide-react";

type PrintType = "tax_invoice" | "tax_invoice_receipt" | "invoice" | "delivery_note" | "receipt";

const FORM_LABELS: Record<string, string> = {
  tax_invoice: "ใบกำกับภาษี",
  tax_invoice_receipt: "ใบเสร็จรับเงิน/ใบกำกับภาษี",
  invoice: "ใบแจ้งหนี้",
  receipt: "ใบเสร็จรับเงิน",
  delivery_note: "ใบส่งของ",
};

export default function TaxInvoiceShare() {
  const { token } = useParams<{ token: string }>();
  const params = new URLSearchParams(window.location.search);
  const printType = (params.get("printType") || "tax_invoice") as PrintType;

  const [docNo, setDocNo] = useState(FORM_LABELS[printType] || "ใบกำกับภาษี");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const objUrlRef = useRef<string>("");

  useEffect(() => {
    (async () => {
      try {
        const infoRes = await fetch(`/api/share/tax-invoice/${token}`);
        if (!infoRes.ok) throw new Error("ไม่พบเอกสาร หรือลิงก์หมดอายุ");
        const d = await infoRes.json();
        setDocNo(d.taxInvoiceNo || FORM_LABELS[printType] || "ใบกำกับภาษี");

        const ptParam = printType && printType !== "tax_invoice" ? `?printType=${printType}` : "";
        const pdfRes = await fetch(`/api/share/tax-invoice/${token}/pdf${ptParam}`);
        if (!pdfRes.ok) throw new Error("สร้าง PDF ไม่สำเร็จ");
        const blob = await pdfRes.blob();
        objUrlRef.current = URL.createObjectURL(blob);
        setPdfUrl(objUrlRef.current);
      } catch (err: any) {
        setError(err.message);
      }
      setLoading(false);
    })();
    return () => { if (objUrlRef.current) URL.revokeObjectURL(objUrlRef.current); };
  }, [token, printType]);

  const handlePrint = () => iframeRef.current?.contentWindow?.print();
  const handleDownload = async () => {
    if (!pdfUrl) return;
    setDownloading(true);
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = `${docNo}.pdf`;
    a.click();
    setDownloading(false);
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen text-slate-500"><Loader2 className="h-6 w-6 animate-spin mr-2" />กำลังโหลด...</div>;
  if (error) return <div className="flex items-center justify-center min-h-screen text-red-500">{error}</div>;

  return (
    <div className="flex flex-col min-h-screen bg-slate-700">
      <div className="sticky top-0 z-50 bg-slate-800 border-b border-slate-600 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-white min-w-0">
          <FileText className="h-5 w-5 text-[var(--theme-primary)] flex-shrink-0" />
          <span className="text-sm font-medium truncate">{docNo}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="ghost" size="sm" onClick={handlePrint} className="text-slate-300 hover:text-white hover:bg-slate-700 gap-1.5 h-8 text-xs" data-testid="button-print">
            <Printer className="h-4 w-4" />
            <span className="hidden sm:inline">พิมพ์</span>
          </Button>
          <Button size="sm" onClick={handleDownload} disabled={downloading} className="bg-[var(--theme-primary)] hover:bg-[#e8856a] text-white gap-1.5 h-8 text-xs" data-testid="button-download-pdf">
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            <span className="hidden sm:inline">{downloading ? "กำลังสร้าง..." : "ดาวน์โหลด PDF"}</span>
            <span className="sm:hidden">{downloading ? "..." : "PDF"}</span>
          </Button>
        </div>
      </div>
      <iframe
        ref={iframeRef}
        src={pdfUrl!}
        className="flex-1 w-full border-0"
        title={docNo}
        data-testid="pdf-iframe"
      />
    </div>
  );
}
