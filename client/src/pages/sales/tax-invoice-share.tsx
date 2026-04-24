import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Download, Printer, Loader2, FileText } from "lucide-react";
import DocumentRenderer from "@/components/document-renderer";

type PrintType = "tax_invoice" | "tax_invoice_receipt" | "invoice" | "delivery_note" | "receipt";

export default function TaxInvoiceShare() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);

  const params = new URLSearchParams(window.location.search);
  const printType = (params.get("printType") || "tax_invoice") as PrintType;

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/share/tax-invoice/${token}`);
        if (!res.ok) throw new Error("ไม่พบเอกสาร หรือลิงก์หมดอายุ");
        setData(await res.json());
      } catch (err: any) {
        setError(err.message);
      }
      setLoading(false);
    })();
  }, [token]);

  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      const pdfUrl = printType !== "tax_invoice"
        ? `/api/share/tax-invoice/${token}/pdf?printType=${printType}`
        : `/api/share/tax-invoice/${token}/pdf`;
      const res = await fetch(pdfUrl);
      if (!res.ok) throw new Error("ไม่สามารถสร้าง PDF ได้");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${data?.taxInvoiceNo || "tax-invoice"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {}
    setDownloading(false);
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen text-slate-500">กำลังโหลด...</div>;
  if (error) return <div className="flex items-center justify-center min-h-screen text-red-500">{error}</div>;
  if (!data) return null;

  const docSettings = data.documentSettings || {};

  const renderData = { ...data };
  let documentType: string = printType;
  if (printType === "invoice") {
    renderData.invoiceNo = data.taxInvoiceNo;
    renderData.invoiceDate = data.taxInvoiceDate;
  } else if (printType === "tax_invoice_receipt") {
    renderData.receiptNo = data.taxInvoiceNo;
    renderData.receiptDate = data.taxInvoiceDate;
  } else if (printType === "receipt") {
    renderData.receiptNo = data.taxInvoiceNo;
    renderData.receiptDate = data.taxInvoiceDate;
    documentType = "receipt";
  } else if (printType === "delivery_note") {
    renderData.orderNo = data.taxInvoiceNo;
    renderData.orderDate = data.taxInvoiceDate;
  }

  const FORM_LABELS: Record<string, string> = {
    tax_invoice: "ใบกำกับภาษี",
    tax_invoice_receipt: "ใบเสร็จรับเงิน/ใบกำกับภาษี",
    invoice: "ใบแจ้งหนี้",
    receipt: "ใบเสร็จรับเงิน",
    delivery_note: "ใบส่งของ",
  };

  return (
    <div className="min-h-screen bg-slate-700 print:bg-white">
      <div className="sticky top-0 z-50 bg-slate-800 border-b border-slate-600 px-4 py-2.5 flex items-center justify-between print:hidden">
        <div className="flex items-center gap-2 text-white min-w-0">
          <FileText className="h-5 w-5 text-[var(--theme-primary)] flex-shrink-0" />
          <span className="text-sm font-medium truncate">{data.taxInvoiceNo || (FORM_LABELS[printType] || "ใบกำกับภาษี")}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.print()}
            className="text-slate-300 hover:text-white hover:bg-slate-700 gap-1.5 h-8 text-xs"
            data-testid="button-print"
          >
            <Printer className="h-4 w-4" />
            <span className="hidden sm:inline">พิมพ์</span>
          </Button>
          <Button
            size="sm"
            onClick={handleDownloadPdf}
            disabled={downloading}
            className="bg-[var(--theme-primary)] hover:bg-[#e8856a] text-white gap-1.5 h-8 text-xs"
            data-testid="button-download-pdf"
          >
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            <span className="hidden sm:inline">{downloading ? "กำลังสร้าง PDF..." : "ดาวน์โหลด PDF"}</span>
            <span className="sm:hidden">{downloading ? "..." : "PDF"}</span>
          </Button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto py-6 px-4 print:!py-0 print:!px-0 print:!max-w-none print:!m-0 overflow-x-auto">
        <DocumentRenderer
          settings={docSettings}
          company={data.company}
          quotation={renderData}
          documentType={documentType}
          userSignature={data.userSignature}
          etaxEnabled={data.company?.etaxEnabled || false}
        />
      </div>
    </div>
  );
}
